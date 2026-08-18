import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { selectCanonicalHDiagnostics } from '../../src/analysis/canonicalEe/producer';
import {
  buildSimulationAnalysisFrame,
  createSimulatorTleState,
} from '../../src/simulator/analysis';
import {
  loadTleSnapshotSelection,
  loadTleWebArchiveCatalog,
} from '../../src/simulator/archive';
import {
  buildCanonicalTleHandoverTrace,
  type CanonicalTleHandoverComparisonSample,
} from '../../src/simulator/canonicalTleHandover';
import { buildTleAnalysisRun } from '../../src/simulator/tleAnalysisRun';
import {
  DEFAULT_SIMULATOR_PARAMETERS,
  type SimulationAnalysisFrame,
  type SimulatorParameters,
} from '../../src/simulator/types';
import { buildTleRunBundle } from '../../src/tle/run';

const MAIN_INSTANT_UTC = '2026-08-07T23:59:59.000Z';
const ANGLE_REFERENCE_RAD = DEFAULT_SIMULATOR_PARAMETERS.theta3dbRad;
const ANGLE_PROBE_RAD = 4 * Math.PI / 180;
const RATE_REFERENCE_BPS = 1_000_000;
const RATE_PROBE_BPS = 10_000_000;
const CAP_TOLERANCE_W = 1e-9;

const fetchFromPublic = async (path: RequestInfo | URL): Promise<Response> => (
  new Response(await readFile(`public${String(path)}`), { status: 200 })
);

function digestParameters(parameters: SimulatorParameters): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(parameters)).digest('hex')}`;
}

function close(actual: number, expected: number, tolerance: number, label: string): void {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected} +/- ${tolerance}, got ${actual}`,
  );
}

function identityAt(frame: SimulationAnalysisFrame, userIndex: number, beamId: number) {
  assert.equal(frame.inputs.frame.servingBeamU[userIndex], beamId);
  assert.equal(frame.inputs.frame.beamActiveB[beamId], true);
  return {
    satelliteId: frame.selectedSatelliteId,
    beamId,
    userIndex,
    userId: `ue-${userIndex + 1}`,
  };
}

function representativeLinkV2(frame: SimulationAnalysisFrame) {
  const candidates = frame.inputs.frame.servingBeamU.flatMap((beamId, userIndex) => {
    if (beamId < 0 || frame.inputs.frame.beamActiveB[beamId] !== true) return [];
    const rateBps = frame.canonical.throughput.rateUBps[userIndex];
    const thetaRad = frame.inputs.frame.thetaRadUb[userIndex]?.[beamId];
    if (rateBps === undefined || thetaRad === undefined) return [];
    if (!Number.isFinite(rateBps) || rateBps <= 0 || !Number.isFinite(thetaRad)) return [];
    return [{ userIndex, beamId, thetaRad }];
  });
  candidates.sort((left, right) => (
    right.thetaRad - left.thetaRad
    || left.beamId - right.beamId
    || left.userIndex - right.userIndex
  ));
  const selected = candidates[0];
  assert.ok(selected, 'representative-link-v2 must find a finite non-zero-rate link');
  return selected;
}

function selectedTerms(frame: SimulationAnalysisFrame, userIndex: number, beamId: number) {
  const h = selectCanonicalHDiagnostics(frame.canonical, userIndex, beamId);
  const sinrLinear = frame.canonical.throughput.sinrU[userIndex]!;
  return {
    thetaRad: frame.inputs.frame.thetaRadUb[userIndex]![beamId]!,
    transmitGainLinear: frame.canonical.transmitGainUb[userIndex]![beamId]!,
    rawH: h.rawH,
    hDiv: h.hDiv,
    gammaReqLinear: frame.canonical.gammaReqB[beamId]!,
    pReqUserW: frame.canonical.power.pReqUW[userIndex]!,
    pReqBeamW: frame.canonical.power.pReqBW[beamId]!,
    actualBeamRfW: frame.canonical.power.pDlActualBW[beamId]!,
    sinrLinear,
    sinrDb: 10 * Math.log10(Math.max(sinrLinear, 1e-30)),
    rateBps: frame.canonical.throughput.rateUBps[userIndex]!,
    totalRateBps: frame.canonical.throughput.totalRateBps,
    systemPowerW: frame.canonical.power.systemPowerW,
    eeInstBitsPerJ: frame.canonical.ee.systemEeBitsPerJ,
  };
}

function capChecks(frame: SimulationAnalysisFrame) {
  const totalBeforeSatelliteCapW = frame.canonical.power.pDlBeforeSatelliteCapBW
    .reduce((total, value) => total + value, 0);
  return {
    allBeamCapsNonBinding: frame.canonical.power.pReqBW.every(
      value => value < frame.parameters.beamPowerCapW - CAP_TOLERANCE_W,
    ),
    satelliteCapNonBinding: totalBeforeSatelliteCapW
      < frame.parameters.satellitePowerCapW - CAP_TOLERANCE_W,
    allSatelliteScalesOne: frame.canonical.power.satelliteScaleB.every(value => value === 1),
    allUsersNotPowerLimited: frame.canonical.throughput.powerLimitedU.every(value => value === false),
    maxBeamRequestW: Math.max(...frame.canonical.power.pReqBW),
    totalBeforeSatelliteCapW,
  };
}

function resetSample(
  anchorIndex: number,
  candidateSatelliteId: string | null,
): CanonicalTleHandoverComparisonSample {
  return Object.freeze({
    anchorIndex,
    instantUtc: new Date(Date.parse('2026-08-08T00:00:00.000Z') + anchorIndex * 30_000).toISOString(),
    servingSatelliteId: 'A',
    candidateSatelliteId,
    servingVisible: true,
    candidateVisible: candidateSatelliteId !== null,
    servingSinrDb: 10,
    candidateSinrDb: candidateSatelliteId === null ? null : 14,
  });
}

const oneWebCatalog = await loadTleWebArchiveCatalog(
  '/tle-archive/oneweb/catalog.json',
  fetchFromPublic,
);
const oneWebSelection = await loadTleSnapshotSelection(
  oneWebCatalog,
  MAIN_INSTANT_UTC,
  fetchFromPublic,
);
const geometryRun = await buildTleRunBundle({
  selection: oneWebSelection,
  t0Utc: MAIN_INSTANT_UTC,
  yieldEveryAnchors: 241,
});
const referenceRun = buildTleAnalysisRun({
  selection: oneWebSelection,
  geometryRun,
  parameters: DEFAULT_SIMULATOR_PARAMETERS,
});
const angleRun = referenceRun.withParameters({
  ...DEFAULT_SIMULATOR_PARAMETERS,
  theta3dbRad: ANGLE_PROBE_RAD,
});
const rateRun = referenceRun.withParameters({
  ...DEFAULT_SIMULATOR_PARAMETERS,
  minimumRateBps: RATE_PROBE_BPS,
});

const methodAnchorIndex = 47;
const methodReference = referenceRun.getFrame(methodAnchorIndex);
const angleProbe = angleRun.getFrame(methodAnchorIndex);
assert.ok(methodReference && angleProbe, 'angle pair frames must be available');
const methodSelector = representativeLinkV2(methodReference);
assert.deepEqual(methodSelector, {
  beamId: 1, userIndex: 29, thetaRad: 0.011240719179150774,
});
assert.deepEqual(identityAt(methodReference, 29, 1), {
  satelliteId: '55796', beamId: 1, userIndex: 29, userId: 'ue-30',
});
assert.deepEqual(identityAt(angleProbe, 29, 1), identityAt(methodReference, 29, 1));
assert.equal(methodReference.tleFrameId, angleProbe.tleFrameId);
assert.equal(referenceRun.geometryRunId, angleRun.geometryRunId);
assert.equal(methodReference.instantUtc, angleProbe.instantUtc);
close(methodSelector.thetaRad, 0.011240719179150774, 1e-15, 'method theta');
const angleReferenceTerms = selectedTerms(methodReference, 29, 1);
const angleProbeTerms = selectedTerms(angleProbe, 29, 1);
close(angleReferenceTerms.transmitGainLinear, 1807.121891561789, 1e-9, 'angle reference Gt');
close(angleProbeTerms.transmitGainLinear, 1865.2235869334672, 1e-9, 'angle probe Gt');
assert.notEqual(angleReferenceTerms.rawH, angleProbeTerms.rawH);
assert.notEqual(angleReferenceTerms.pReqUserW, angleProbeTerms.pReqUserW);
assert.notEqual(angleReferenceTerms.totalRateBps, angleProbeTerms.totalRateBps);
assert.notEqual(angleReferenceTerms.systemPowerW, angleProbeTerms.systemPowerW);
assert.notEqual(angleReferenceTerms.eeInstBitsPerJ, angleProbeTerms.eeInstBitsPerJ);

const rateAnchorIndex = 0;
const rateReference = referenceRun.getFrame(rateAnchorIndex);
const rateProbe = rateRun.getFrame(rateAnchorIndex);
assert.ok(rateReference && rateProbe, 'service-target pair frames must be available');
assert.deepEqual(identityAt(rateReference, 14, 0), {
  satelliteId: '49283', beamId: 0, userIndex: 14, userId: 'ue-15',
});
assert.deepEqual(identityAt(rateProbe, 14, 0), identityAt(rateReference, 14, 0));
assert.equal(rateReference.tleFrameId, rateProbe.tleFrameId);
assert.equal(referenceRun.geometryRunId, rateRun.geometryRunId);
assert.equal(rateReference.parameters.minimumRateBps, RATE_REFERENCE_BPS);
assert.equal(rateProbe.parameters.minimumRateBps, RATE_PROBE_BPS);
const rateReferenceTerms = selectedTerms(rateReference, 14, 0);
const rateProbeTerms = selectedTerms(rateProbe, 14, 0);
const rateReferenceCaps = capChecks(rateReference);
const rateProbeCaps = capChecks(rateProbe);
assert.ok(Object.values(rateReferenceCaps).slice(0, 4).every(Boolean));
assert.ok(Object.values(rateProbeCaps).slice(0, 4).every(Boolean));
close(rateReferenceTerms.gammaReqLinear, 0.06437018245335979, 1e-15, 'rate reference gamma');
close(rateProbeTerms.gammaReqLinear, 0.8660659830736148, 1e-15, 'rate probe gamma');

const acceptedFrameIdBeforeFailure = methodReference.frameId;
let failedRebuildMessage = '';
try {
  referenceRun.withParameters({
    ...DEFAULT_SIMULATOR_PARAMETERS,
    minimumRateBps: 0,
  });
  assert.fail('invalid rebuild must throw');
} catch (error) {
  failedRebuildMessage = error instanceof Error ? error.message : String(error);
}
assert.match(failedRebuildMessage, /minimumRateBps must be finite and positive/);
assert.equal(referenceRun.getFrame(methodAnchorIndex)?.frameId, acceptedFrameIdBeforeFailure);
assert.ok(Object.isFrozen(referenceRun));
assert.ok(Object.isFrozen(methodReference));

const resetTrace = buildCanonicalTleHandoverTrace({
  analysisRunId: 'analysis-synthetic-target-reset-v1',
  geometryRunId: 'geometry-synthetic-target-reset-v1',
  anchorCount: 4,
  plannedServingSatelliteId: () => 'A',
  resolveTargetSelection: (_anchorIndex, satelliteId) => Object.freeze({
    selectionKind: 'pass-plan' as const,
    passId: `synthetic-pass-${satelliteId}`,
    satelliteId,
    sourceLocator: `synthetic.passPlan[${satelliteId}]`,
  }),
  resolveComparison: anchorIndex => [
    resetSample(0, null),
    resetSample(1, 'B'),
    resetSample(2, 'C'),
    resetSample(3, null),
  ][anchorIndex]!,
});
assert.deepEqual(resetTrace.anchors.map(anchor => anchor.state), [
  'attached', 'pending', 'pending', 'attached',
]);
assert.equal(resetTrace.anchors[2]?.progressSec, 0);
assert.equal(resetTrace.anchors[3]?.cumulativeCount, 0);
assert.equal(resetTrace.servingChangeEvents.length, 0);

const starlinkCatalog = await loadTleWebArchiveCatalog(
  '/tle-archive/starlink/catalog.json',
  fetchFromPublic,
);
const starlinkSelection = await loadTleSnapshotSelection(
  starlinkCatalog,
  MAIN_INSTANT_UTC,
  fetchFromPublic,
);
const starlinkState = createSimulatorTleState(starlinkSelection, MAIN_INSTANT_UTC);
const starlinkFrame = buildSimulationAnalysisFrame(starlinkState, DEFAULT_SIMULATOR_PARAMETERS);
assert.equal(starlinkFrame.provenance.constellation, 'starlink');
assert.notEqual(starlinkFrame.provenance.archiveId, methodReference.provenance.archiveId);
assert.notEqual(starlinkFrame.tleFrameId, methodReference.tleFrameId);
const starlinkGeometryRun = await buildTleRunBundle({
  selection: starlinkSelection,
  t0Utc: MAIN_INSTANT_UTC,
  yieldEveryAnchors: 241,
});
const starlinkAnalysisRun = buildTleAnalysisRun({
  selection: starlinkSelection,
  geometryRun: starlinkGeometryRun,
  parameters: DEFAULT_SIMULATOR_PARAMETERS,
});
assert.equal(
  starlinkAnalysisRun.anchorSelections.filter(anchor => anchor.selectionKind === 'unavailable').length,
  0,
);

console.log(JSON.stringify({
  gate: 'S1-fixture-discovery',
  verdict: 'PASS',
  source: {
    requestedInstantUtc: MAIN_INSTANT_UTC,
    constellation: oneWebSelection.catalog.constellation,
    archiveId: oneWebSelection.catalog.archiveId,
    archiveDate: oneWebSelection.snapshot.metadata.archiveDate,
    selectedTlePath: oneWebSelection.snapshot.metadata.path,
    selectedTleSha256: oneWebSelection.snapshot.sha256,
    geometryRunId: referenceRun.geometryRunId,
  },
  method: {
    anchorIndex: methodAnchorIndex,
    analysisRunId: referenceRun.analysisRunId,
    frameId: methodReference.frameId,
    identity: identityAt(methodReference, 29, 1),
    thetaRad: methodSelector.thetaRad,
    terms: angleReferenceTerms,
    evaluation: referenceRun.evaluation,
  },
  angleResponse: {
    control: { key: 'theta3dbRad', reference: ANGLE_REFERENCE_RAD, probe: ANGLE_PROBE_RAD, unit: 'rad' },
    parameterDigests: [digestParameters(referenceRun.parameters), digestParameters(angleRun.parameters)],
    memberRunIds: [referenceRun.analysisRunId, angleRun.analysisRunId],
    memberFrameIds: [methodReference.frameId, angleProbe.frameId],
    identity: identityAt(methodReference, 29, 1),
    reference: angleReferenceTerms,
    probe: angleProbeTerms,
  },
  serviceTargetStress: {
    control: { key: 'minimumRateBps', reference: RATE_REFERENCE_BPS, probe: RATE_PROBE_BPS, unit: 'bit/s' },
    parameterDigests: [digestParameters(referenceRun.parameters), digestParameters(rateRun.parameters)],
    memberRunIds: [referenceRun.analysisRunId, rateRun.analysisRunId],
    memberFrameIds: [rateReference.frameId, rateProbe.frameId],
    identity: identityAt(rateReference, 14, 0),
    reference: rateReferenceTerms,
    probe: rateProbeTerms,
    capToleranceW: CAP_TOLERANCE_W,
    capChecks: { reference: rateReferenceCaps, probe: rateProbeCaps },
    eeEvalExcluded: true,
  },
  handover: {
    traceDigest: referenceRun.handoverTrace.traceDigest,
    event: referenceRun.handoverTrace.servingChangeEvents.find(event => event.eventId === 'tle-event-v1-e9303f64'),
    tripletAnchors: [21, 22, 23],
    tripletFrameIds: [21, 22, 23].map(index => referenceRun.getFrame(index)?.frameId ?? null),
  },
  negativeMechanics: {
    synthetic: true,
    traceDigest: resetTrace.traceDigest,
    states: resetTrace.anchors.map(anchor => anchor.state),
    progressSec: resetTrace.anchors.map(anchor => anchor.progressSec),
    cumulativeCounts: resetTrace.anchors.map(anchor => anchor.cumulativeCount),
    servingChangeEventCount: resetTrace.servingChangeEvents.length,
    storyCompletionRefused: resetTrace.servingChangeEvents.length === 0,
  },
  failedRebuild: {
    attemptedControl: { key: 'minimumRateBps', value: 0, unit: 'bit/s' },
    error: failedRebuildMessage,
    retainedAnalysisRunId: referenceRun.analysisRunId,
    retainedFrameId: referenceRun.getFrame(methodAnchorIndex)?.frameId,
    stalePublicationAllowed: false,
    captureAllowed: false,
  },
  secondarySource: {
    purpose: 'constellation-switch-only-not-performance-comparison',
    constellation: starlinkSelection.catalog.constellation,
    archiveId: starlinkSelection.catalog.archiveId,
    archiveDate: starlinkSelection.snapshot.metadata.archiveDate,
    selectedTlePath: starlinkSelection.snapshot.metadata.path,
    selectedTleSha256: starlinkSelection.snapshot.sha256,
    selectedSatelliteId: starlinkFrame.selectedSatelliteId,
    selectedTleEpochUtc: starlinkFrame.tleEpochUtc,
    tleFrameId: starlinkFrame.tleFrameId,
    frameId: starlinkFrame.frameId,
    geometryRunId: starlinkAnalysisRun.geometryRunId,
    analysisRunId: starlinkAnalysisRun.analysisRunId,
    satelliteCount: starlinkGeometryRun.satelliteCount,
    passCount: starlinkAnalysisRun.passPlan.passes.length,
    unavailableAnchorCount: starlinkAnalysisRun.anchorSelections.filter(
      anchor => anchor.selectionKind === 'unavailable',
    ).length,
  },
}, null, 2));
