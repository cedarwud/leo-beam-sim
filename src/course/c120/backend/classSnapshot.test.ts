import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

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
  reopenC120ClassSnapshot,
  serializeC120ClassSnapshot,
  type C120BundledFallbackReceipt,
} from './classSnapshot';
import { createC120RealDataArtifact } from './realDataArtifact';
import { C120RealDataError, type C120OrbitFetchResponse } from './orbitSource';

const BODY = '[{"OBJECT_NAME":"ONEWEB-0314","OBJECT_ID":"2021-075AB","EPOCH":"2026-08-09T09:20:51.128160","MEAN_MOTION":13.17651252,"ECCENTRICITY":0.0001589,"INCLINATION":87.9189,"RA_OF_ASC_NODE":355.279,"ARG_OF_PERICENTER":86.873,"MEAN_ANOMALY":273.2584,"EPHEMERIS_TYPE":0,"CLASSIFICATION_TYPE":"U","NORAD_CAT_ID":49100,"ELEMENT_SET_NO":999,"REV_AT_EPOCH":24057,"BSTAR":9.4634e-5,"MEAN_MOTION_DOT":5.0e-7,"MEAN_MOTION_DDOT":0}]\r\n';

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
}

function readdressNestedArtifactAndSnapshot(candidate: Record<string, any>): void {
  const artifactPayload = { ...candidate.artifact };
  delete artifactPayload.artifactId;
  delete artifactPayload.contentSha256;
  const artifactContentSha256 = sha256(canonicalJson(artifactPayload));
  candidate.artifact.contentSha256 = artifactContentSha256;
  candidate.artifact.artifactId = `sha256:${artifactContentSha256}`;
  candidate.artifactRef.contentSha256 = artifactContentSha256;
  candidate.artifactRef.artifactId = `sha256:${artifactContentSha256}`;
  const snapshotPayload = { ...candidate };
  delete snapshotPayload.snapshotId;
  delete snapshotPayload.contentSha256;
  const snapshotContentSha256 = sha256(canonicalJson(snapshotPayload));
  candidate.contentSha256 = snapshotContentSha256;
  candidate.snapshotId = `sha256:${snapshotContentSha256}`;
}

function makeClosureOutput(): Record<string, unknown> {
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

const closureIds = ['fixed_load_on_axis', 'fixed_load_off_axis', 'coupled_interference'] as const;
const minimalVerification: C120CanonicalVerification = {
  runtimePath: '/pinned/angle_aware_ee.py',
  goldenFixturePath: '/pinned/golden-vectors.json',
  runtimeSha256: C120_CANONICAL_RUNTIME_SHA256,
  goldenFixtureSha256: C120_GOLDEN_FIXTURE_SHA256,
  contractVersion: C120_ANGLE_AWARE_CONTRACT_VERSION,
  numericTolerance: { rtol: 1e-12, atol: 1e-15 },
  cases: closureIds.map(id => ({ id, mode: 'closure' as const, output: makeClosureOutput() })),
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

const fetchOrbit = async (): Promise<C120OrbitFetchResponse> => ({ status: 200, body: BODY });
const canonical = {
  verifyAndRunGoldenVectors: async () => minimalVerification,
  run: async () => minimalVerification.cases[0]?.output,
};

const artifact = await createC120RealDataArtifact({
  courseId: 'C-120-ENERGY-DECISION-1R',
  courseContractVersion: 'c120-fixture-first-v2',
  providerId: 'snapshot-test-provider',
  scenarioId: 'snapshot-shared-scenario-v1',
  orbit: {
    retrievedAt: '2026-08-09T10:00:00Z',
    now: '2026-08-09T10:00:00Z',
  },
  propagation: {
    observer: { latitudeDeg: 24.944, longitudeDeg: 121.371, heightKm: 0.05 },
    startUtc: '2026-08-09T18:20:00Z',
    endUtc: '2026-08-09T18:50:00Z',
    sampleStepSec: 10,
    minimumElevationDeg: 10,
  },
}, { fetchOrbit, canonical });

const fallbackArtifactContentSha256 = sha256('bundled fallback artifact bytes');
const fallbackReceipt = createC120BundledFallbackReceipt(artifact, {
  bundleId: 'c120-fallback-bundle-v1',
  bundleVersion: '2026-08-09.1',
  bundleContentSha256: sha256('bundled fallback bundle bytes'),
  fallbackArtifactId: `sha256:${fallbackArtifactContentSha256}`,
  fallbackArtifactContentSha256,
});

const request = {
  artifact,
  generatedAt: '2026-08-09T12:00:00Z',
  fallbackReceipt,
};
const snapshot = materializeC120ClassSnapshot(request);
assert.equal(snapshot.scenarioId, artifact.scenarioId);
assert.equal(snapshot.sourceMode, 'bundled');
assert.equal(snapshot.generatedAt, '2026-08-09T12:00:00Z');
assert.equal(snapshot.sourceRetrievedAt, artifact.source.retrievedAt);
assert.notEqual(snapshot.generatedAt, snapshot.sourceRetrievedAt);
assert.equal(snapshot.measured, false);
assert.equal(snapshot.wholeSatelliteCanonical, false);
assert.equal(snapshot.artifactRef.artifactId, artifact.artifactId);
assert.equal(snapshot.fallbackReceipt.kind, C120_BUNDLED_FALLBACK_RECEIPT_KIND);
assert.deepEqual(snapshot.truthLayers.map(layer => layer.kind), [
  'PUBLIC_CURRENT_ORBIT_SOURCE',
  'MODEL_DERIVED_ORBIT',
  'CANONICAL_MODEL_DERIVED_ENERGY',
  'COURSE_ASSUMPTION',
  'BUNDLED_FALLBACK_RECEIPT',
]);
assert.equal(snapshot.artifact.energy.scope, 'GOLDEN_VECTOR_PARITY_ONLY');
assert.ok(snapshot.artifact.orbit.pass.trajectory.length >= 2);
assert.deepEqual(snapshot.artifact.orbit.pass.trajectory[0], snapshot.artifact.orbit.pass.aos);
assert.deepEqual(
  snapshot.artifact.orbit.pass.trajectory[snapshot.artifact.orbit.pass.trajectory.length - 1],
  snapshot.artifact.orbit.pass.los,
);
assert.ok(snapshot.artifact.orbit.pass.trajectory.some(point => (
  JSON.stringify(point) === JSON.stringify(snapshot.artifact.orbit.pass.peak)
)));
assert.equal(Object.isFrozen(snapshot.artifact.orbit.pass.trajectory), true);
assert.equal(Object.prototype.hasOwnProperty.call(snapshot, 'replayEnergy'), false);
assert.equal(Object.prototype.hasOwnProperty.call(snapshot, 'live'), false);

const serialized = serializeC120ClassSnapshot(snapshot);
const reopened = reopenC120ClassSnapshot(serialized);
assert.deepEqual(reopened, snapshot);
assert.equal(serializeC120ClassSnapshot(reopened), serialized);
assert.equal(snapshot.snapshotId, `sha256:${snapshot.contentSha256}`);
assert.equal(fallbackReceipt.receiptId, `sha256:${fallbackReceipt.contentSha256}`);

const snapshotAgain = materializeC120ClassSnapshot(request);
assert.equal(snapshotAgain.snapshotId, snapshot.snapshotId);
assert.equal(snapshotAgain.contentSha256, snapshot.contentSha256);
assert.equal(serializeC120ClassSnapshot(snapshotAgain), serialized);
const changedGeneration = materializeC120ClassSnapshot({ ...request, generatedAt: '2026-08-09T12:00:01Z' });
assert.notEqual(changedGeneration.contentSha256, snapshot.contentSha256);
assert.equal(changedGeneration.sourceRetrievedAt, snapshot.sourceRetrievedAt);

function expectArtifactInvalid(action: () => unknown): void {
  assert.throws(action, error => error instanceof C120RealDataError && error.code === 'ARTIFACT_INVALID');
}

const tamperedScenario = JSON.parse(serialized) as Record<string, any>;
tamperedScenario.scenarioBinding.scenarioId = 'wrong-scenario';
expectArtifactInvalid(() => reopenC120ClassSnapshot(JSON.stringify(tamperedScenario)));

const tamperedIdentity = JSON.parse(serialized) as Record<string, any>;
tamperedIdentity.artifactRef.contentSha256 = '0'.repeat(64);
expectArtifactInvalid(() => reopenC120ClassSnapshot(JSON.stringify(tamperedIdentity)));

const tamperedUnits = JSON.parse(serialized) as Record<string, any>;
tamperedUnits.scenarioBinding.units.power = 'J';
expectArtifactInvalid(() => reopenC120ClassSnapshot(JSON.stringify(tamperedUnits)));

const tamperedArtifact = JSON.parse(serialized) as Record<string, any>;
tamperedArtifact.artifact.source.objectName = 'WRONG-OBJECT';
expectArtifactInvalid(() => reopenC120ClassSnapshot(JSON.stringify(tamperedArtifact)));

// Re-address the tampered nested artifact as well: rejection must come from
// the strict truth-layer allowlist, not merely from a stale outer hash.
const rehashedClaimUpgrade = JSON.parse(serialized) as Record<string, any>;
rehashedClaimUpgrade.artifact.live = 'MEASURED_TELEMETRY';
readdressNestedArtifactAndSnapshot(rehashedClaimUpgrade);
assert.notEqual(rehashedClaimUpgrade.contentSha256, snapshot.contentSha256);
assert.equal(rehashedClaimUpgrade.artifact.artifactId, rehashedClaimUpgrade.artifactRef.artifactId);
expectArtifactInvalid(() => reopenC120ClassSnapshot(JSON.stringify(rehashedClaimUpgrade)));

const rehashedEnergyUpgrade = JSON.parse(serialized) as Record<string, any>;
rehashedEnergyUpgrade.artifact.energy.measuredTelemetry = true;
readdressNestedArtifactAndSnapshot(rehashedEnergyUpgrade);
expectArtifactInvalid(() => reopenC120ClassSnapshot(JSON.stringify(rehashedEnergyUpgrade)));

const rehashedTrajectoryUpgrade = JSON.parse(serialized) as Record<string, any>;
rehashedTrajectoryUpgrade.artifact.orbit.pass.trajectory[0].measuredTelemetry = true;
readdressNestedArtifactAndSnapshot(rehashedTrajectoryUpgrade);
expectArtifactInvalid(() => reopenC120ClassSnapshot(JSON.stringify(rehashedTrajectoryUpgrade)));

const rehashedTrajectoryEndpoint = JSON.parse(serialized) as Record<string, any>;
rehashedTrajectoryEndpoint.artifact.orbit.pass.trajectory[0] = {
  ...rehashedTrajectoryEndpoint.artifact.orbit.pass.trajectory[1],
};
readdressNestedArtifactAndSnapshot(rehashedTrajectoryEndpoint);
expectArtifactInvalid(() => reopenC120ClassSnapshot(JSON.stringify(rehashedTrajectoryEndpoint)));

const rehashedTrajectoryOrder = JSON.parse(serialized) as Record<string, any>;
const middleIndex = Math.floor(rehashedTrajectoryOrder.artifact.orbit.pass.trajectory.length / 2);
const previousMiddle = rehashedTrajectoryOrder.artifact.orbit.pass.trajectory[middleIndex - 1];
rehashedTrajectoryOrder.artifact.orbit.pass.trajectory[middleIndex - 1] =
  rehashedTrajectoryOrder.artifact.orbit.pass.trajectory[middleIndex];
rehashedTrajectoryOrder.artifact.orbit.pass.trajectory[middleIndex] = previousMiddle;
readdressNestedArtifactAndSnapshot(rehashedTrajectoryOrder);
expectArtifactInvalid(() => reopenC120ClassSnapshot(JSON.stringify(rehashedTrajectoryOrder)));

for (const mutate of [
  (candidate: Record<string, any>) => { candidate.artifact.source.record.measuredTelemetry = true; },
  (candidate: Record<string, any>) => { candidate.artifact.orbit.pass.measuredTelemetry = true; },
  (candidate: Record<string, any>) => { candidate.artifact.assumptions.measuredTelemetry = true; },
  (candidate: Record<string, any>) => { candidate.artifact.provenance[0].measuredTelemetry = true; },
]) {
  const rehashedNestedUpgrade = JSON.parse(serialized) as Record<string, any>;
  mutate(rehashedNestedUpgrade);
  readdressNestedArtifactAndSnapshot(rehashedNestedUpgrade);
  expectArtifactInvalid(() => reopenC120ClassSnapshot(JSON.stringify(rehashedNestedUpgrade)));
}

const tamperedFallback = JSON.parse(serialized) as Record<string, any>;
tamperedFallback.fallbackReceipt.scenarioId = 'wrong-fallback-scenario';
expectArtifactInvalid(() => reopenC120ClassSnapshot(JSON.stringify(tamperedFallback)));

const mismatchedFallback = {
  ...fallbackReceipt,
  scenarioId: 'different-scenario',
};
expectArtifactInvalid(() => materializeC120ClassSnapshot({ ...request, fallbackReceipt: mismatchedFallback as C120BundledFallbackReceipt }));

expectArtifactInvalid(() => reopenC120ClassSnapshot('{not-json'));
expectArtifactInvalid(() => reopenC120ClassSnapshot(JSON.stringify({ ...snapshot, contentSha256: '0'.repeat(64) })));

console.log('C-120 class-snapshot tests passed');
