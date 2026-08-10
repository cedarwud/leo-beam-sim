import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import {
  C120_CLAIM_BOUNDARY,
  C120_COURSE_ID,
  C120_CONTRACT_VERSION,
  C120_UNITS,
  assertC120Scenario,
  type C120CourseDataProvider,
} from '../contract';
import { C120_FIXTURE_SCENARIO, createC120ProviderFromScenario } from '../fixtures';
import { validateC120PinnedTleImport } from '../tleImport';
import {
  C120_ANGLE_AWARE_CONTRACT_VERSION,
  C120_CANONICAL_RUNTIME_SHA256,
  C120_GOLDEN_FIXTURE_SHA256,
  type C120CanonicalVerification,
} from './canonicalRuntime';
import {
  C120_BUNDLED_FALLBACK_RECEIPT_KIND,
  createC120BundledFallbackReceipt,
  materializeC120ClassSnapshot,
} from './classSnapshot';
import { fetchC120CurrentTle } from './currentTleSource';
import { createC120RealDataArtifact } from './realDataArtifact';
import {
  C120RealDataError,
  type C120OrbitFetchResponse,
} from './orbitSource';
import { projectC120OrbitScene } from './orbitSceneProjection';
import {
  materializeC120CanonicalScenario,
  type C120MaterializedScenarioRequest,
} from './materializedScenario';

const NOW = '2026-08-09T10:00:00Z';
const OMM_BODY = '[{"OBJECT_NAME":"ONEWEB-0314","OBJECT_ID":"2021-075AB","EPOCH":"2026-08-09T09:20:51.128160","MEAN_MOTION":13.17651252,"ECCENTRICITY":0.0001589,"INCLINATION":87.9189,"RA_OF_ASC_NODE":355.279,"ARG_OF_PERICENTER":86.873,"MEAN_ANOMALY":273.2584,"EPHEMERIS_TYPE":0,"CLASSIFICATION_TYPE":"U","NORAD_CAT_ID":49100,"ELEMENT_SET_NO":999,"REV_AT_EPOCH":24057,"BSTAR":9.4634e-5,"MEAN_MOTION_DOT":5.0e-7,"MEAN_MOTION_DDOT":0}]\r\n';

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function withChecksum(prefix: string): string {
  assert.equal(prefix.length, 68);
  let sum = 0;
  for (const character of prefix) {
    if (character >= '0' && character <= '9') sum += character.charCodeAt(0) - 48;
    else if (character === '-') sum += 1;
  }
  return `${prefix}${sum % 10}`;
}

const TLE_BODY = [
  'ONEWEB-0314'.padEnd(24, ' '),
  withChecksum('1 49100U 21075AB  26221.38948065  .00000050  00000-0  94634-3 0  999'),
  withChecksum('2 49100  87.9167  11.2157 0001855  96.2926 263.8417 13.1764990123001'),
].join('\n') + '\n';

function closureOutput(): Record<string, unknown> {
  return {
    composite_gain_ub: [0],
    contract_version: C120_ANGLE_AWARE_CONTRACT_VERSION,
    eta_pa_b: [0],
    gamma_req_b: [0],
    interference_u_w: [0],
    p_dl_b_w: [0],
    p_dl_before_sat_cap_b_w: [0],
    p_req_b_w: [0],
    p_req_u_w: [0],
    p_tot_b_w: [0],
    power_limited_u: [false],
    qos_met_u: [false],
    r1_u_bits_per_j: [0],
    rate_u_bps: [0],
    received_power_ub_w: [0],
    satellite_scale_b: [0],
    signal_u_w: [0],
    sinr_u: [0],
    system_accounting: {
      per_user_contributions_bits_per_j: [0],
      system_consumed_power_w: 0,
      system_ee_bits_per_j: 0,
      system_throughput_bps: 0,
      zero_over_zero: true,
    },
    system_consumed_power_w: 0,
    system_ee_bits_per_j: 0,
    system_throughput_bps: 0,
    transmit_gain_ub: [0],
  };
}

const minimalVerification: C120CanonicalVerification = {
  runtimePath: '/pinned/angle_aware_ee.py',
  goldenFixturePath: '/pinned/golden-vectors.json',
  runtimeSha256: C120_CANONICAL_RUNTIME_SHA256,
  goldenFixtureSha256: C120_GOLDEN_FIXTURE_SHA256,
  contractVersion: C120_ANGLE_AWARE_CONTRACT_VERSION,
  numericTolerance: { rtol: 1e-12, atol: 1e-15 },
  cases: ['fixed_load_on_axis', 'fixed_load_off_axis', 'coupled_interference'].map(id => ({
    id,
    mode: 'closure' as const,
    output: closureOutput(),
  })),
  evaluation: {
    id: 'evaluation_vector',
    mode: 'evaluation',
    output: {
      delivered_bits: 0,
      consumed_energy_j: 0,
      energy_efficiency_bits_per_j: 0,
      zero_over_zero: true,
    },
  },
  verified: true,
};

const canonical = {
  verifyAndRunGoldenVectors: async () => minimalVerification,
  run: async () => minimalVerification.cases[0]?.output,
};
const fetchOrbit = async (): Promise<C120OrbitFetchResponse> => ({ status: 200, body: OMM_BODY });

async function buildInputs(scenarioId = C120_FIXTURE_SCENARIO.manifest.scenario.scenarioId): Promise<C120MaterializedScenarioRequest> {
  const artifact = await createC120RealDataArtifact({
    courseId: C120_COURSE_ID,
    courseContractVersion: C120_CONTRACT_VERSION,
    providerId: 'materializer-test-provider',
    scenarioId,
    orbit: { retrievedAt: NOW, now: NOW },
    propagation: {
      observer: { latitudeDeg: 24.944, longitudeDeg: 121.371, heightKm: 0.05 },
      startUtc: '2026-08-09T18:20:00Z',
      endUtc: '2026-08-09T18:50:00Z',
      sampleStepSec: 10,
      minimumElevationDeg: 10,
    },
  }, { fetchOrbit, canonical });
  const fallbackContentSha256 = sha256(`fallback artifact ${scenarioId}`);
  const fallback = createC120BundledFallbackReceipt(artifact, {
    bundleId: `materializer-fallback-${scenarioId}`,
    bundleVersion: '2026-08-09.1',
    bundleContentSha256: sha256(`fallback bundle ${scenarioId}`),
    fallbackArtifactId: `sha256:${fallbackContentSha256}`,
    fallbackArtifactContentSha256: fallbackContentSha256,
  });
  const snapshot = materializeC120ClassSnapshot({
    artifact,
    generatedAt: '2026-08-09T12:00:00Z',
    fallbackReceipt: fallback,
  });
  const source = artifact.source;
  const currentTle = await fetchC120CurrentTle(
    source,
    { retrievedAt: NOW, now: NOW },
    async () => ({ status: 200, body: TLE_BODY }),
  );
  return {
    snapshot,
    currentTle,
    donor: C120_FIXTURE_SCENARIO,
    downloadPath: '/course/c120/oneweb-0314-current.tle',
  };
}

const request = await buildInputs();
const scenario = materializeC120CanonicalScenario(request);
const identity = scenario.manifest.scenario;
assert.equal(identity.providerKind, 'canonical-adapter');
assert.match(identity.providerId, /^c120-canonical-adapter-[0-9a-f]{64}$/);
assert.match(identity.fixtureId, /^c120-materialized-fixture-[0-9a-f]{64}$/);
assert.match(identity.fixtureVersion, /^c120-materialized-canonical-adapter-v2-[0-9a-f]{64}$/);
assert.equal(identity.scenarioId, request.donor.manifest.scenario.scenarioId);
assert.equal(identity.targetUtc, request.snapshot.artifact.orbit.pass.peak.utc);
assert.equal(identity.claimBoundary, C120_CLAIM_BOUNDARY);
assert.deepEqual(identity.units, C120_UNITS);
assert.equal(scenario.tle.downloadPath, request.downloadPath);
assert.equal(scenario.tle.sourceEpochUtc, request.currentTle.epochUtc);
assert.equal(scenario.tle.targetUtc, request.snapshot.artifact.orbit.pass.peak.utc);
assert.equal(scenario.tle.recordSha256, request.currentTle.rawContentSha256);
assert.deepEqual(scenario.tle.lines, [request.currentTle.line0, request.currentTle.line1, request.currentTle.line2]);
assert.match(scenario.tle.sourceLabel, /CelesTrak current 3LE/);
assert.match(scenario.tle.producerLabel, /satellite\.js@6\.0\.2-sgp4-omm-v1/);
assert.equal(scenario.tle.frame.scene.azimuthDeg, request.snapshot.artifact.orbit.pass.peak.azimuthDeg);
assert.equal(scenario.tle.frame.scene.elevationDeg, request.snapshot.artifact.orbit.pass.peak.elevationDeg);
assert.equal(scenario.tle.frame.scene.rangeKm, request.snapshot.artifact.orbit.pass.peak.rangeKm);
const visualTrajectory = projectC120OrbitScene(request.snapshot.artifact.orbit.pass.trajectory, {
  minimumElevationDeg: request.snapshot.artifact.orbit.search.minimumElevationDeg,
});
const peakScene = visualTrajectory.points.find(point => point.utc === request.snapshot.artifact.orbit.pass.peak.utc)?.scene;
assert.ok(peakScene);
assert.deepEqual(scenario.tle.frame.scene, peakScene);
assert.notDeepEqual(scenario.tle.frame.scene.satellitePosition, request.donor.tle.frame.scene.satellitePosition);
assert.deepEqual(scenario.tle.frame.evidence, request.donor.tle.frame.evidence);
assert.deepEqual(scenario.tle.tleDoesNotContain, ['power', 'traffic', 'handover', 'energy']);

function expectedSceneAt(elapsedSec: number, donorVisible: boolean): (typeof visualTrajectory.points)[number]['scene'] {
  const targetMs = Date.parse(identity.targetUtc) + elapsedSec * 1000;
  const firstMs = Date.parse(visualTrajectory.points[0]!.utc);
  const lastMs = Date.parse(visualTrajectory.points[visualTrajectory.points.length - 1]!.utc);
  assert.ok(targetMs >= firstMs && targetMs <= lastMs);
  let closest = visualTrajectory.points[0]!;
  let delta = Math.abs(Date.parse(closest.utc) - targetMs);
  for (const point of visualTrajectory.points.slice(1)) {
    const nextDelta = Math.abs(Date.parse(point.utc) - targetMs);
    if (nextDelta < delta) {
      closest = point;
      delta = nextDelta;
    }
  }
  return { ...closest.scene, visible: closest.scene.visible && donorVisible };
}

function assertReplayEvidenceParityWithModelScene(
  materialized: readonly { readonly replayId: string; readonly input: unknown; readonly frames: readonly { readonly elapsedSec: number; readonly scene: { readonly satellitePosition: unknown; readonly visible: boolean }; readonly evidence: unknown }[]; readonly outcome: unknown; readonly cardLedger: unknown }[],
  donor: readonly { readonly replayId: string; readonly input: unknown; readonly frames: readonly { readonly elapsedSec: number; readonly scene: { readonly satellitePosition: unknown; readonly visible: boolean }; readonly evidence: unknown }[]; readonly outcome: unknown; readonly cardLedger: unknown }[],
): void {
  assert.equal(materialized.length, donor.length);
  materialized.forEach((replay, index) => {
    const original = donor[index]!;
    assert.equal(replay.replayId, original.replayId);
    assert.deepEqual(replay.input, original.input);
    assert.deepEqual(replay.outcome, original.outcome);
    assert.deepEqual(replay.cardLedger, original.cardLedger);
    assert.equal(replay.frames.length, original.frames.length);
    replay.frames.forEach((frame, frameIndex) => {
      const originalFrame = original.frames[frameIndex]!;
      assert.deepEqual(frame.scene, expectedSceneAt(frame.elapsedSec, originalFrame.scene.visible));
      assert.notDeepEqual(frame.scene.satellitePosition, originalFrame.scene.satellitePosition);
      assert.deepEqual(frame.evidence, originalFrame.evidence);
    });
  });
}

assertReplayEvidenceParityWithModelScene(scenario.labA.replays, request.donor.labA.replays);
assertReplayEvidenceParityWithModelScene(scenario.labB.replays, request.donor.labB.replays);
assertReplayEvidenceParityWithModelScene(scenario.labC.replays, request.donor.labC.replays);
assertReplayEvidenceParityWithModelScene(scenario.clinic.replays, request.donor.clinic.replays);
const fixedOutageFrame = scenario.labC.replays[0]?.frames.find(frame => frame.actionLabel === 'hold fixed outage');
assert.equal(fixedOutageFrame?.scene.visible, false);
assert.deepEqual(scenario.labA.candidates, request.donor.labA.candidates);
assert.deepEqual(scenario.labB.rules, request.donor.labB.rules);
assert.deepEqual(scenario.labB.traceALabel, request.donor.labB.traceALabel);
assert.deepEqual(scenario.labC.allowedActionsBySlot, request.donor.labC.allowedActionsBySlot);
assert.deepEqual(scenario.clinic.featureCards, request.donor.clinic.featureCards);
assert.deepEqual(scenario.clinic.actions, request.donor.clinic.actions);

assertC120Scenario(scenario, { kind: 'canonical-adapter', providerId: identity.providerId });
const provider: C120CourseDataProvider = createC120ProviderFromScenario('canonical-adapter', identity.providerId, scenario);
const workbook = provider.buildWorkbook({
  scenarioId: identity.scenarioId,
  sessionId: 'materializer-workbook-test',
  status: 'INCOMPLETE',
  checkpointOrdinal: 0,
  sourceMode: 'bundled',
  completedSegments: [],
  constructedResponses: {},
  missionContractId: null,
  replayRecords: [],
  hintProvenance: [],
  transfer: {
    domainId: null,
    retrievalAnswerId: null,
    retrievalPowerEnergyId: null,
    retrievalDynamicPolicyId: null,
    retrievalPredictionSavingId: null,
    transferWhatIfId: null,
    powerTimePathwayId: null,
  },
});
assert.equal(workbook.identity.providerKind, 'canonical-adapter');
assert.equal(workbook.identity.providerId, identity.providerId);
assert.equal(workbook.identity.scenarioId, identity.scenarioId);
assert.equal(workbook.claimBoundary, C120_CLAIM_BOUNDARY);
assert.deepEqual(workbook.tle.lines, scenario.tle.lines);
assert.equal(workbook.provenance.browserScientificFormula, false);
assert.equal(workbook.provenance.deterministicReplay, true);
assert.equal(request.snapshot.fallbackReceipt.kind, C120_BUNDLED_FALLBACK_RECEIPT_KIND);
const importedTle = validateC120PinnedTleImport(
  request.currentTle.rawContent,
  'oneweb-0314-current.tle',
  scenario.tle,
);
assert.equal(importedTle.recordSha256, request.currentTle.rawContentSha256);
assert.deepEqual(importedTle.importedLines, scenario.tle.lines);
assert.throws(() => validateC120PinnedTleImport(
  request.currentTle.rawContent.replace('ONEWEB-0314', 'ONEWEB-0315'),
  'oneweb-0314-current.tle',
  scenario.tle,
));

assert.equal(Object.isFrozen(scenario), true);
assert.equal(Object.isFrozen(scenario.labA.replays[0]), true);
assert.equal(Object.isFrozen(scenario.labA.replays[0]?.frames[0]?.scene), true);
assert.throws(() => {
  (scenario.labA.replays[0]!.frames[0]!.scene as unknown as { rangeKm: number }).rangeKm = 1;
}, TypeError);

function expectInvalid(action: () => unknown): void {
  assert.throws(action, error => error instanceof C120RealDataError && error.code === 'ARTIFACT_INVALID');
}

const mismatchedSnapshot = await buildInputs('materialized-other-scenario');
expectInvalid(() => materializeC120CanonicalScenario(mismatchedSnapshot));
expectInvalid(() => materializeC120CanonicalScenario({ ...request, downloadPath: '/tmp/not-bundled.tle' }));
expectInvalid(() => materializeC120CanonicalScenario({
  ...request,
  currentTle: { ...request.currentTle, unknownField: true } as never,
}));
expectInvalid(() => materializeC120CanonicalScenario({
  ...request,
  currentTle: { ...request.currentTle, rawContentSha256: '0'.repeat(64) },
}));
expectInvalid(() => materializeC120CanonicalScenario({
  ...request,
  currentTle: {
    ...request.currentTle,
    matchedOmm: { ...request.currentTle.matchedOmm, sourceEpoch: '2026-08-09T09:00:00Z' },
  },
}));
expectInvalid(() => materializeC120CanonicalScenario({
  ...request,
  snapshot: { ...request.snapshot, contentSha256: '0'.repeat(64) },
}));

console.log('C-120 materialized-scenario tests passed');
