import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  createInterHandoverReplayDescriptor,
  createIntraHandoverReplayDescriptor,
  createVisualLabPresentationState,
  type AcceptedCanonicalBeamIdentityTrace,
} from '../presentation/visualLabPresentationContract';
import { adaptSimulationAnalysisFrameToVisualLabCanonicalSnapshot } from '../visualLabCanonicalSnapshotAdapter';
import { adaptTleAnalysisRunToVisualLabTimeline } from '../visualLabCanonicalTimelineAdapter';
import { loadTleSnapshotSelection, loadTleWebArchiveCatalog } from '../../../simulator/archive';
import { buildTleAnalysisRun } from '../../../simulator/tleAnalysisRun';
import { DEFAULT_SIMULATOR_PARAMETERS, SIMULATOR_CATALOG_URLS } from '../../../simulator/types';
import { buildTleRunBundle } from '../../../tle/run';
import { createVisualLabStoryRuntime } from './visualLabStoryRuntime';

const fetchFromPublic = async (path: RequestInfo | URL): Promise<Response> => (
  new Response(await readFile(`public${String(path)}`), { status: 200 })
);

const instantUtc = '2026-08-08T12:00:00.000Z';
const catalog = await loadTleWebArchiveCatalog(SIMULATOR_CATALOG_URLS.oneweb, fetchFromPublic);
const selection = await loadTleSnapshotSelection(catalog, instantUtc, fetchFromPublic);
const geometryRun = await buildTleRunBundle({ selection, t0Utc: instantUtc });
const analysisRun = buildTleAnalysisRun({
  selection,
  geometryRun,
  parameters: DEFAULT_SIMULATOR_PARAMETERS,
});
const timeline = adaptTleAnalysisRunToVisualLabTimeline(analysisRun, 1);
const firstFrame = analysisRun.getFrame(0);
if (firstFrame === null) throw new Error('real fixture did not produce a first frame');
const snapshot = adaptSimulationAnalysisFrameToVisualLabCanonicalSnapshot({
  frame: firstFrame,
  evaluation: {
    deliveredBits: analysisRun.evaluation.deliveredBits,
    consumedEnergyJ: analysisRun.evaluation.consumedEnergyJ,
    energyEfficiencyBitsPerJ: analysisRun.evaluation.evaluationBitsPerJ,
    durationSec: analysisRun.evaluation.durationS,
  },
});
const event = analysisRun.handoverTrace.servingChangeEvents.find(candidate => candidate.sourceEvent === 'inter-handover');
if (event === undefined) throw new Error('real fixture did not produce an inter-handover event');
const inter = createInterHandoverReplayDescriptor({ evidence: event });
assert.equal(inter.availability.status, 'available');

const guided = createVisualLabPresentationState({
  theme: 'dark',
  locale: 'zh-Hant',
  experience: 'guided',
});
const input = { snapshot, timeline, stories: [inter], presentation: guided };
const runtime = createVisualLabStoryRuntime(input);
const secondRuntime = createVisualLabStoryRuntime(input);

const replaySignature = (candidate: ReturnType<typeof createVisualLabStoryRuntime>) => (
  [candidate.dispatch({ type: 'play' }), candidate.tick(), candidate.tick()].map(state => ({
    status: state.status,
    index: state.activeStepIndex,
    phase: state.activeStep?.phase,
    anchor: state.activeStep?.anchorIndex,
  }))
);

assert.equal(runtime.state().status, 'idle');
assert.equal(runtime.state().activeStep?.phase, 'before');
assert.equal(runtime.state().activeStep?.point?.servingSatelliteId, event.fromSatelliteId);
assert.equal(runtime.state().stories[0]?.availability.status, 'available');
assert.equal(runtime.state().stories[0]?.steps.length, 3);

const observed: string[] = [];
const unsubscribe = runtime.subscribe(state => observed.push(`${state.status}:${state.activeStepIndex ?? 'none'}`));
assert.equal(runtime.dispatch({ type: 'play' }).status, 'playing');
assert.equal(runtime.tick().activeStep?.phase, 'decision');
assert.equal(runtime.tick().status, 'completed');
assert.equal(runtime.state().activeStep?.point?.servingSatelliteId, event.toSatelliteId);
assert.deepEqual(
  replaySignature(secondRuntime),
  replaySignature(createVisualLabStoryRuntime(input)),
  'same accepted run and story descriptor replay deterministically',
);
assert.ok(observed.length >= 3);
unsubscribe();

assert.equal(runtime.dispatch({ type: 'restart' }).status, 'paused');
assert.equal(runtime.dispatch({ type: 'play' }).status, 'playing');
assert.equal(runtime.dispatch({ type: 'pause' }).status, 'paused');
assert.equal(runtime.dispatch({ type: 'previous' }).activeStep?.phase, 'before');
assert.equal(runtime.dispatch({ type: 'next' }).activeStep?.phase, 'decision');
assert.equal(runtime.dispatch({ type: 'inspect', target: 'energy-efficiency' }).inspectedTarget, 'energy-efficiency');
const forked = runtime.dispatch({ type: 'fork-to-explore' });
assert.equal(forked.activeStoryId, null);
assert.equal(forked.activeStep, null);
assert.equal(forked.presentation.experience, 'explore');
assert.equal(forked.forkedFromStoryId, inter.storyId);

const intraBeforePoint = timeline.points.find((point, index, points) => (
  points[index + 1]?.anchorIndex === point.anchorIndex + 1
  && points[index + 2]?.anchorIndex === point.anchorIndex + 2
  && points[index + 1]?.servingSatelliteId === point.servingSatelliteId
  && points[index + 2]?.servingSatelliteId === point.servingSatelliteId
));
if (intraBeforePoint === undefined) throw new Error('real fixture has no stable three-anchor serving interval');
const intraDecisionPoint = timeline.points.find(point => point.anchorIndex === intraBeforePoint.anchorIndex + 1)!;
const intraAfterPoint = timeline.points.find(point => point.anchorIndex === intraBeforePoint.anchorIndex + 2)!;
const intraBeforeFrame = analysisRun.getFrame(intraBeforePoint.anchorIndex)!;
const intraDecisionFrame = analysisRun.getFrame(intraDecisionPoint.anchorIndex)!;
const intraAfterFrame = analysisRun.getFrame(intraAfterPoint.anchorIndex)!;

const intraTrace: AcceptedCanonicalBeamIdentityTrace = {
  adapter: 'accepted-canonical-beam-identity-trace-v1',
  sourceKind: 'real-tle-canonical',
  traceId: 'beam-trace-real-identity-fixture',
  analysisRunId: analysisRun.analysisRunId,
  geometryRunId: analysisRun.geometryRunId,
  frameId: intraDecisionFrame.frameId,
  instantUtc: intraDecisionFrame.instantUtc,
  traceDigest: 'fixture-trace-digest',
  beforeAnchorIndex: intraBeforePoint.anchorIndex,
  decisionAnchorIndex: intraDecisionPoint.anchorIndex,
  afterAnchorIndex: intraAfterPoint.anchorIndex,
  beforeFrameId: intraBeforeFrame.frameId,
  decisionFrameId: intraDecisionFrame.frameId,
  afterFrameId: intraAfterFrame.frameId,
  beforeInstantUtc: intraBeforePoint.instantUtc,
  decisionInstantUtc: intraDecisionPoint.instantUtc,
  afterInstantUtc: intraAfterPoint.instantUtc,
  from: { satelliteId: intraBeforePoint.servingSatelliteId, beamId: 1, userIndex: 0, userId: 'ue-0' },
  to: { satelliteId: intraBeforePoint.servingSatelliteId, beamId: 2, userIndex: 0, userId: 'ue-0' },
};
const intra = createIntraHandoverReplayDescriptor({
  source: { kind: 'accepted-canonical-beam-identity', trace: intraTrace },
});
const intraRuntime = createVisualLabStoryRuntime({ ...input, stories: [intra] });
assert.equal(intraRuntime.state().status, 'idle');
assert.equal(intraRuntime.state().activeStep?.beamTrace?.from.beamId, 1);
assert.equal(intraRuntime.tick().activeStep?.phase, 'before', 'tick is inert until play');
assert.equal(intraRuntime.dispatch({ type: 'play' }).status, 'playing');
assert.equal(intraRuntime.tick().activeStep?.phase, 'decision');

const missingIntra = createIntraHandoverReplayDescriptor({ source: { kind: 'missing' } });
const unavailableRuntime = createVisualLabStoryRuntime({ ...input, timeline: null, stories: [missingIntra] });
assert.equal(unavailableRuntime.state().status, 'unavailable');
assert.equal(unavailableRuntime.state().activeStep, null);
const unavailableStory = unavailableRuntime.state().stories[0];
assert.ok(unavailableStory !== undefined);
assert.equal(unavailableStory.availability.status, 'unavailable');
if (unavailableStory.availability.status === 'unavailable') {
  assert.match(unavailableStory.availability.reason, /canonical beam-identity trace/i);
}

const missingTimelineRuntime = createVisualLabStoryRuntime({ ...input, timeline: null, stories: [inter] });
assert.equal(missingTimelineRuntime.state().status, 'unavailable');
assert.equal(missingTimelineRuntime.state().stories[0]?.steps.length, 0);
assert.equal(missingTimelineRuntime.dispatch({ type: 'play' }).status, 'unavailable');

console.log('visual-lab story runtime passed');
