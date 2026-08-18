import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { buildTleRunBundle } from '../tle/run';
import {
  loadTleSnapshotSelection,
  loadTleWebArchiveCatalog,
} from './archive';
import {
  buildSimulationAnalysisFrame,
  createSimulatorTleState,
} from './analysis';
import {
  buildTleAnalysisRun,
  anchorIndexForElapsedSec,
  elapsedSecForAnchorIndex,
  resolvePassPlanTargetSelection,
} from './tleAnalysisRun';
import { DEFAULT_SIMULATOR_PARAMETERS } from './types';

const fetchFromPublic = async (path: RequestInfo | URL): Promise<Response> => (
  new Response(await readFile(`public${String(path)}`), { status: 200 })
);

const catalog = await loadTleWebArchiveCatalog('/tle-archive/oneweb/catalog.json', fetchFromPublic);
const requestedInstantUtc = '2026-08-07T23:59:59.000Z';
const selection = await loadTleSnapshotSelection(catalog, requestedInstantUtc, fetchFromPublic);
const geometryRun = await buildTleRunBundle({
  selection,
  t0Utc: requestedInstantUtc,
  yieldEveryAnchors: 241,
});

const analysisRun = buildTleAnalysisRun({
  selection,
  geometryRun,
  parameters: DEFAULT_SIMULATOR_PARAMETERS,
});

assert.equal(analysisRun.durationS, 7_200);
assert.equal(analysisRun.stepS, 30);
assert.equal(analysisRun.anchorCount, 241);
assert.equal(analysisRun.passPlan.anchorTimesSec.length, 241);
assert.equal(analysisRun.evaluation.durationS, 7_200);
assert.equal(analysisRun.evaluation.sampleCount, 240);
assert.equal(analysisRun.evaluation.aggregation, 'ratio-of-sums');
assert.equal(analysisRun.anchorSelections.length, 241);
assert.equal(
  analysisRun.anchorSelections.filter(anchor => anchor.selectionKind === 'unavailable').length,
  0,
  'the checked-in OneWeb reference window must have a real serving identity at every evaluation anchor',
);
assert.ok(analysisRun.anchorSelections.every(anchor => anchor.selectedSatelliteId !== null));
assert.ok(Object.isFrozen(analysisRun));
assert.ok(Object.isFrozen(analysisRun.anchorSelections));
assert.ok(Object.isFrozen(analysisRun.handoverTrace));
assert.ok(Object.isFrozen(analysisRun.handoverTrace.anchors));
assert.equal(analysisRun.handoverTrace.anchors.length, 241);
assert.equal(analysisRun.handoverTrace.analysisRunId, analysisRun.analysisRunId);
assert.equal(analysisRun.handoverTrace.geometryRunId, analysisRun.geometryRunId);
assert.match(analysisRun.handoverTrace.traceDigest, /^tle-trace-v1-[0-9a-f]{8}$/);
assert.ok(
  analysisRun.handoverTrace.servingChangeEvents.length > 0,
  'the accepted reference run must expose at least one pass-plan-backed serving change',
);
assert.ok(Object.isFrozen(analysisRun.handoverTrace.servingChangeEvents));
for (const event of analysisRun.handoverTrace.servingChangeEvents) {
  assert.ok(Object.isFrozen(event));
  assert.equal(event.analysisRunId, analysisRun.analysisRunId);
  assert.equal(event.geometryRunId, analysisRun.geometryRunId);
  assert.equal(event.traceDigest, analysisRun.handoverTrace.traceDigest);
  assert.equal(event.fromSatelliteId, event.preCommit.servingSatelliteId);
  assert.equal(event.toSatelliteId, event.preCommit.candidateSatelliteId);
  assert.equal(event.toSatelliteId, event.postCommit.servingSatelliteId);
  assert.equal(event.targetSelection.selectionKind, 'pass-plan');
  assert.equal(event.targetSelection.satelliteId, event.toSatelliteId);
  assert.match(event.targetSelection.sourceLocator, new RegExp(event.targetSelection.passId));
  const plannedEventAnchor = analysisRun.passPlan.serviceAnchors[event.triggerAnchorIndex];
  assert.ok(
    [plannedEventAnchor?.servingPassId, plannedEventAnchor?.candidatePassId]
      .includes(event.targetSelection.passId),
    'published target provenance must be one of the planner-selected passes at the trigger anchor',
  );
  const targetPass = analysisRun.passPlan.passes.find(pass => pass.passId === event.targetSelection.passId);
  assert.ok(targetPass, `event ${event.eventId} target pass must resolve in the same pass plan`);
  assert.equal(targetPass?.satelliteId, event.toSatelliteId);
  assert.equal(analysisRun.handoverTrace.anchors[event.triggerAnchorIndex]?.event, event.sourceEvent);
  if (event.sourceEvent === 'inter-handover') {
    assert.ok(event.qualificationAnchors.length >= 2);
    const finalQualification = event.qualificationAnchors[event.qualificationAnchors.length - 1];
    assert.equal(finalQualification?.anchorIndex, event.triggerAnchorIndex);
    assert.ok(event.qualificationAnchors.every(anchor => (
      anchor.servingSatelliteId === event.fromSatelliteId
      && anchor.candidateSatelliteId === event.toSatelliteId
      && anchor.deltaDb >= event.decision.offsetDb
      && anchor.conditionMet
    )));
    assert.ok((finalQualification?.progressSec ?? -1) >= event.decision.tttSec);
  } else {
    assert.deepEqual(event.qualificationAnchors, []);
    assert.equal(event.continuity.servingVisible, false);
    assert.equal(event.continuity.targetVisible, true);
    assert.equal(event.continuity.targetSatelliteId, event.toSatelliteId);
  }
}
let unplannedActivePassProbe: {
  readonly anchorIndex: number;
  readonly satelliteId: string;
} | null = null;
for (const anchor of analysisRun.anchorSelections) {
  const planned = analysisRun.passPlan.serviceAnchors[anchor.anchorIndex];
  const activeUnplanned = analysisRun.passPlan.passes.find(pass => (
    pass.aosAnchorIndex <= anchor.anchorIndex
    && pass.losAnchorIndex >= anchor.anchorIndex
    && pass.passId !== planned?.servingPassId
    && pass.passId !== planned?.candidatePassId
  ));
  if (activeUnplanned !== undefined) {
    unplannedActivePassProbe = {
      anchorIndex: anchor.anchorIndex,
      satelliteId: activeUnplanned.satelliteId,
    };
    break;
  }
}
assert.ok(unplannedActivePassProbe, 'reference run must contain an active but unplanned pass provenance probe');
assert.equal(
  resolvePassPlanTargetSelection(
    analysisRun.passPlan,
    analysisRun.anchorSelections[unplannedActivePassProbe!.anchorIndex]!,
    unplannedActivePassProbe!.anchorIndex,
    unplannedActivePassProbe!.satelliteId,
  ),
  null,
  'an active geometry fallback must not be promoted merely because some pass covers it',
);
const publishedEventAnchors = new Set(
  analysisRun.handoverTrace.servingChangeEvents.map(event => event.triggerAnchorIndex),
);
for (const anchor of analysisRun.handoverTrace.anchors.filter(anchor => (
  anchor.event === 'inter-handover' || anchor.event === 'forced-continuity'
))) {
  const targetPass = analysisRun.passPlan.passes.find(pass => (
    pass.satelliteId === anchor.eventToSatelliteId
    && pass.aosAnchorIndex <= anchor.anchorIndex
    && pass.losAnchorIndex >= anchor.anchorIndex
  ));
  if (targetPass === undefined) {
    assert.equal(
      publishedEventAnchors.has(anchor.anchorIndex),
      false,
      'a visible-geometry fallback must remain unavailable as event evidence',
    );
  }
}
assert.ok(analysisRun.anchorSelections.every((anchor, index) => (
  anchor.selectedSatelliteId === analysisRun.handoverTrace.anchors[index]?.servingSatelliteId
)));

assert.equal(anchorIndexForElapsedSec(-1), 0);
assert.equal(anchorIndexForElapsedSec(15), 1);
assert.equal(anchorIndexForElapsedSec(7_201), 240);
assert.equal(elapsedSecForAnchorIndex(-1), 0);
assert.equal(elapsedSecForAnchorIndex(240), 7_200);
assert.equal(elapsedSecForAnchorIndex(999), 7_200);

const first = analysisRun.getFrame(0);
const firstFromTime = analysisRun.getFrameAtElapsedSec(1);
const second = analysisRun.getFrame(1);
const third = analysisRun.getFrame(2);
const penultimate = analysisRun.getFrame(239);
const last = analysisRun.getFrame(240);
assert.ok(first);
assert.ok(firstFromTime);
assert.ok(second);
assert.ok(third);
assert.ok(penultimate);
assert.ok(last);
assert.equal(first?.frameId, firstFromTime?.frameId);
assert.equal(first?.instantUtc, requestedInstantUtc);
assert.equal(last?.instantUtc, geometryRun.getAnchorUtc(240));
assert.equal(first?.runAnchor?.runId, analysisRun.runId);
assert.equal(first?.runAnchor?.geometryRunId, geometryRun.runId);
assert.equal(first?.runAnchor?.anchorIndex, 0);
assert.equal(last?.runAnchor?.anchorIndex, 240);
assert.equal(first?.tleState.selectedSatelliteId, analysisRun.anchorSelections[0]?.selectedSatelliteId);
assert.equal(first?.tleState.selectedSatellite.positionTemeKm.x, geometryRun.readState(0, first!.selectedSatelliteId).positionTemeKm.x);
assert.equal(first?.ee.evaluationBitsPerJ, analysisRun.evaluation.evaluationBitsPerJ);
const cacheEquivalentFirst = buildSimulationAnalysisFrame(
  createSimulatorTleState(selection, requestedInstantUtc),
  DEFAULT_SIMULATOR_PARAMETERS,
);
assert.equal(
  first?.candidateLink?.satelliteId ?? null,
  cacheEquivalentFirst.candidateLink?.satelliteId ?? null,
  'accepted anchor 0 must preserve the real candidate identity shown by the cache-equivalent first frame',
);
assert.deepEqual(
  first?.candidateScenario?.beamLayout ?? null,
  cacheEquivalentFirst.candidateScenario?.beamLayout ?? null,
  'accepted anchor 0 must preserve candidate beam-layout evidence when the candidate is real',
);
assert.ok(first?.inputs.frame.laggedInterferenceUW.every(value => value === 0));
assert.deepEqual(
  second?.inputs.frame.laggedInterferenceUW,
  first?.throughput.interferenceUW,
  'anchor 1 must consume anchor 0 realized interference',
);
assert.deepEqual(
  third?.inputs.frame.laggedInterferenceUW,
  second?.throughput.interferenceUW,
  'anchor 2 must consume anchor 1 realized interference',
);
assert.deepEqual(
  last?.inputs.frame.laggedInterferenceUW,
  penultimate?.throughput.interferenceUW,
  'endpoint anchor must consume the preceding interval interference',
);
for (const anchorIndex of [0, 120, 240]) {
  const frame = analysisRun.getFrame(anchorIndex);
  const trace = analysisRun.handoverTrace.anchors[anchorIndex];
  assert.ok(frame);
  assert.ok(trace);
  assert.equal(frame?.selectedSatelliteId, trace?.servingSatelliteId);
  assert.equal(frame?.handover?.servingSatelliteId, trace?.servingSatelliteId);
  assert.equal(frame?.handover?.cumulativeCount, trace?.cumulativeCount);
  assert.equal(frame?.candidateLink?.satelliteId ?? null, trace?.candidateSatelliteId);
  assert.notEqual(geometryRun.getSatelliteIndex(trace!.servingSatelliteId), undefined);
  if (trace?.candidateSatelliteId !== null) {
    assert.notEqual(geometryRun.getSatelliteIndex(trace.candidateSatelliteId), undefined);
  }
}

const changed = analysisRun.withParameters({
  ...DEFAULT_SIMULATOR_PARAMETERS,
  antennaNoiseTemperatureK: DEFAULT_SIMULATOR_PARAMETERS.antennaNoiseTemperatureK * 2,
});
assert.equal(changed.geometryRun, analysisRun.geometryRun, 'parameter rebuild must retain the completed TLE run');
assert.equal(changed.passPlan, analysisRun.passPlan, 'parameter rebuild must retain the frozen pass plan');
assert.notEqual(changed.runId, analysisRun.runId);
assert.notEqual(changed.getFrame(0)?.frameId, first?.frameId);
assert.equal(changed.evaluation.sampleCount, 240);

const representative = first!.links[0]!;
const representativeUser = first!.scenario.users[representative.userIndex]!;
const representativeCell = first!.scenario.cells[representativeUser.cellIndex]!;
const movedPositionKm = [
  (representativeUser.positionKm[0] + representativeCell.centerKm[0]) / 2,
  (representativeUser.positionKm[1] + representativeCell.centerKm[1]) / 2,
] as const;
const movedScenario = analysisRun.withFrameOptions({
  representativeUserIndex: representative.userIndex,
  userPositionOverridesKm: [{
    userIndex: representative.userIndex,
    positionKm: movedPositionKm,
  }],
});
const movedFirst = movedScenario.getFrame(0)!;
assert.equal(movedScenario.geometryRun, analysisRun.geometryRun, 'UE probe must retain archived-TLE geometry');
assert.equal(movedScenario.passPlan, analysisRun.passPlan, 'UE probe must retain the frozen pass plan');
assert.notEqual(movedScenario.analysisRunId, analysisRun.analysisRunId);
assert.notEqual(movedFirst.frameId, first!.frameId);
assert.deepEqual(movedFirst.scenario.users[representative.userIndex]?.positionKm, movedPositionKm);
assert.equal(movedFirst.links[0]?.userIndex, representative.userIndex);
assert.equal(movedFirst.links[0]?.satelliteId, first!.links[0]?.satelliteId);
assert.deepEqual(movedFirst.scenario.beamLoadB, first!.scenario.beamLoadB);
assert.deepEqual(movedFirst.scenario.beamSatelliteB, first!.scenario.beamSatelliteB);
assert.equal(movedScenario.evaluation.sampleCount, 240);

const heterogeneousAnchor = analysisRun.anchorSelections.find(anchor => anchor.candidateSatelliteId !== null);
assert.ok(heterogeneousAnchor);
const heterogeneousBaseFrame = analysisRun.getFrame(heterogeneousAnchor.anchorIndex)!;
const heterogeneousCandidateId = heterogeneousAnchor.candidateSatelliteId!;
const heterogeneousOptions = {
  beamLayoutCount: 19 as const,
  perSatelliteBeamLayoutCount: {
    [heterogeneousCandidateId]: 1 as const,
  },
  representativeUserIndex: 50,
};
const heterogeneous = analysisRun.withFrameOptions(heterogeneousOptions);
const heterogeneousFirst = heterogeneous.getFrame(0)!;
assert.equal(heterogeneous.frameOptions.beamLayoutCount, 19);
assert.equal(
  heterogeneous.frameOptions.perSatelliteBeamLayoutCount?.[heterogeneousCandidateId],
  1,
);
const heterogeneousAnchorFrame = heterogeneous.getFrame(heterogeneousAnchor.anchorIndex)!;
assert.equal(heterogeneousAnchorFrame.scenario.beamLayout.beamCount, 19);
assert.equal(heterogeneousAnchorFrame.candidateScenario?.beamLayout.beamCount, 1);
assert.equal(heterogeneousAnchorFrame.scenario.ueSubstrateId, heterogeneousAnchorFrame.candidateScenario?.ueSubstrateId);
assert.deepEqual(
  heterogeneousAnchorFrame.scenario.users.map(user => ({ userId: user.userId, positionKm: user.positionKm })),
  heterogeneousAnchorFrame.candidateScenario?.users.map(user => ({ userId: user.userId, positionKm: user.positionKm })),
);
assert.notEqual(heterogeneous.analysisRunId, analysisRun.analysisRunId);
assert.ok(Object.isFrozen(heterogeneous.frameOptions.perSatelliteBeamLayoutCount));
const reorderedHeterogeneous = analysisRun.withFrameOptions({
  ...heterogeneousOptions,
  perSatelliteBeamLayoutCount: {
    [heterogeneousBaseFrame.selectedSatelliteId]: 19,
    [heterogeneousCandidateId]: 1,
  },
});
const sameHeterogeneous = analysisRun.withFrameOptions({
  ...heterogeneousOptions,
  perSatelliteBeamLayoutCount: {
    [heterogeneousCandidateId]: 1,
    [heterogeneousBaseFrame.selectedSatelliteId]: 19,
  },
});
assert.equal(reorderedHeterogeneous.analysisRunId, sameHeterogeneous.analysisRunId);

console.log(`TLE analysis run: ${geometryRun.satelliteCount} satellites, ${analysisRun.passPlan.passes.length} real passes, ${analysisRun.evaluation.sampleCount} evaluation intervals`);
console.log('TLE analysis run tests passed');
