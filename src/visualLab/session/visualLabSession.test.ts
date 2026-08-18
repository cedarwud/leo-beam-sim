import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  buildSimulationAnalysisFrame,
  createSimulatorTleState,
  type SimulationAnalysisFrameBuildOptions,
} from '../../simulator/analysis';
import {
  loadTleSnapshotSelection,
  loadTleWebArchiveCatalog,
} from '../../simulator/archive';
import {
  DEFAULT_SIMULATOR_PARAMETERS,
  type SimulatorParameters,
} from '../../simulator/types';
import {
  createVisualLabSession,
  type LabCommand,
  type VisualLabSessionFactoryOptions,
} from './visualLabSession';
import type { HomepageCanonicalAnalysisState } from '../../ui/signal-tuning/useHomepageCanonicalAnalysis';

const fetchFromPublic = async (path: RequestInfo | URL): Promise<Response> => (
  new Response(await readFile(`public${String(path)}`), { status: 200 })
);

const catalog = await loadTleWebArchiveCatalog('/tle-archive/oneweb/catalog.json', fetchFromPublic);
const selection = await loadTleSnapshotSelection(catalog, '2026-08-08T12:00:00.000Z', fetchFromPublic);
const tleState = createSimulatorTleState(selection, '2026-08-08T12:00:00.000Z');
const frame = buildSimulationAnalysisFrame(tleState, DEFAULT_SIMULATOR_PARAMETERS);

let parameterSetCount = 0;
let frameOptionsSetCount = 0;
const frameOptionsCalls: SimulationAnalysisFrameBuildOptions[] = [];
let sourceApplyCount = 0;
let evaluationResetCount = 0;

const analysis = {
  frame,
  acceptedRun: null,
  visualNextFrame: null,
  evaluation: {
    deliveredBits: 0,
    consumedEnergyJ: 0,
    energyEfficiencyBitsPerJ: 0,
    durationSec: 0,
  },
  resetEvaluation: () => { evaluationResetCount += 1; },
  catalog,
  status: 'ready' as const,
  error: null,
  requestedConstellation: 'oneweb' as const,
  setRequestedConstellation: () => undefined,
  resetRequestedConstellation: () => undefined,
  taipeiDateTime: '2026-08-08T20:00',
  setTaipeiDateTime: () => undefined,
  resetTaipeiDateTime: () => undefined,
  applyRequestedOrbitSettings: () => { sourceApplyCount += 1; },
  orbitSettingsDirty: false,
  parameters: DEFAULT_SIMULATOR_PARAMETERS,
  setParameters: (_next: SimulatorParameters) => { parameterSetCount += 1; },
  resetParameters: () => { parameterSetCount += 1; },
  frameOptions: { userPositionOverridesKm: [] } as SimulationAnalysisFrameBuildOptions,
  setFrameOptions: (next: SimulationAnalysisFrameBuildOptions) => {
    frameOptionsSetCount += 1;
    frameOptionsCalls.push(next);
    analysis.frameOptions = next;
  },
  resetFrameOptions: () => { frameOptionsSetCount += 1; },
  runReady: false,
  runProgress: null,
  timeResolution: null,
  timeFallbackSearch: null,
  timelineDurationSec: 7_200,
  timelineCurrentTimeSec: 0,
  timelineStepSec: 30,
  selectTimelineTimeSec: () => undefined,
};

const factoryOptions: VisualLabSessionFactoryOptions = { analysis };
const session = createVisualLabSession(factoryOptions);

// The public runtime is exactly the SDD's three methods.
assert.deepEqual(Object.keys(session), ['snapshot', 'subscribe', 'dispatch']);
const initial = session.snapshot();
assert.equal(initial.phase, 'cache-ready');
assert.equal(initial.accepted?.frameId, frame.frameId);
assert.equal(initial.canonical?.source.frameId, frame.frameId);
assert.equal(initial.globalScene?.frameId, frame.frameId);
assert.equal(initial.localScene?.frameId, frame.frameId);
assert.equal(initial.scenePlan?.identity?.frameId, frame.frameId);
assert.equal(initial.results.identity?.frameId, frame.frameId);
assert.equal(initial.energy.identity?.frameId, frame.frameId);
assert.equal(initial.capture.availability, 'unavailable');
assert.equal(initial.capture.locked, true);
assert.equal(initial.capture.identity?.frameId, frame.frameId);
assert.equal(Object.isFrozen(initial), true);
assert.equal(Object.isFrozen(initial.accepted), true);
assert.equal(Object.isFrozen(initial.draft), true);

// Progress-only worker publications must reach the public snapshot before the
// accepted run exists; otherwise the visible progress bar stays at zero.
let progressAnalysis: HomepageCanonicalAnalysisState = {
  ...analysis,
  runProgress: {
    status: 'running',
    completedAnchors: 24,
    totalAnchors: 241,
    anchorIndex: 23,
    anchorUtc: '2026-08-08T12:11:30.000Z',
    fraction: 24 / 241,
    progress: 24 / 241,
  },
};
const progressSession = createVisualLabSession({
  analysis: progressAnalysis,
  analysisProvider: () => progressAnalysis,
});
assert.equal(progressSession.snapshot().computation.completedAnchors, 24);
progressAnalysis = {
  ...progressAnalysis,
  runProgress: {
    ...progressAnalysis.runProgress!,
    completedAnchors: 80,
    anchorIndex: 79,
    fraction: 80 / 241,
    progress: 80 / 241,
  },
};
const progressOnlyUpdate = progressSession.snapshot();
assert.equal(progressOnlyUpdate.computation.completedAnchors, 80);
assert.equal(progressOnlyUpdate.computation.totalAnchors, 241);
assert.equal(progressOnlyUpdate.computation.status, 'running');

// A baseline freezes the exact accepted evidence, including the 17 inputs and
// bounded geometry options. The current accepted frame is the only candidate
// source; no draft-only state is captured.
const baselineResult = await session.dispatch({ type: 'saveBaseline' });
assert.equal(baselineResult.status, 'accepted');
assert.equal(baselineResult.snapshot.comparison.baseline?.identity.frameId, frame.frameId);
assert.equal(baselineResult.snapshot.comparison.candidate?.identity.frameId, frame.frameId);
assert.deepEqual(baselineResult.snapshot.comparison.changedParameterKeys, []);
assert.equal(baselineResult.snapshot.comparison.classification, 'identical');
assert.deepEqual(
  baselineResult.snapshot.comparison.baseline?.parameters,
  initial.accepted?.parameters,
);
assert.equal(
  baselineResult.snapshot.comparison.baseline?.frameOptions,
  initial.accepted?.frameOptions,
);
assert.equal(
  baselineResult.snapshot.comparison.evaluation.availability,
  'unavailable',
  'first-frame evidence has no complete accepted evaluation interval',
);
assert.equal(Object.isFrozen(baselineResult.snapshot.comparison.baseline), true);

// All projections are assembled from the same accepted identity.
assert.equal(initial.accepted?.identity.frameId, initial.globalScene?.frameId);
assert.equal(initial.accepted?.identity.frameId, initial.localScene?.frameId);
assert.equal(initial.accepted?.identity.frameId, initial.canonical?.source.frameId);
assert.equal(initial.accepted?.identity.tleFrameId, initial.globalScene?.tleFrameId);
assert.equal(initial.accepted?.identity.tleFrameId, initial.localScene?.tleFrameId);

let notifications = 0;
const unsubscribe = session.subscribe(snapshot => {
  notifications += 1;
  assert.equal(snapshot.accepted?.identity.frameId, frame.frameId);
});
await session.dispatch({ type: 'setPresentationView', view: 'service' });
await session.dispatch({ type: 'setPresentationDensity', density: 'clean' });
await session.dispatch({ type: 'setPresentationFocus', focus: 'energy' });
await session.dispatch({ type: 'setPresentationTheme', theme: 'light' });
await session.dispatch({ type: 'setPresentationLocale', locale: 'en' });
await session.dispatch({ type: 'setPresentationExperience', experience: 'figure' });
const presentationOnly = session.snapshot();
assert.ok(notifications >= 6);
assert.equal(presentationOnly.accepted, initial.accepted, 'presentation-only commands retain accepted data');
assert.equal(presentationOnly.canonical, initial.canonical, 'presentation-only commands retain canonical projection');
assert.equal(presentationOnly.globalScene, initial.globalScene, 'presentation-only commands retain global projection');
assert.equal(presentationOnly.localScene, initial.localScene, 'presentation-only commands retain local projection');
assert.deepEqual(presentationOnly.presentation, {
  view: 'service',
  density: 'clean',
  focus: 'energy',
  theme: 'light',
  locale: 'en',
  experience: 'figure',
});

// Scientific commands cross the existing canonical owner and do not perform
// a page-local calculation.
const parameterResult = await session.dispatch({
  type: 'editCanonicalParameter',
  key: 'beamPowerCapW',
  value: 1.1,
});
assert.equal(parameterResult.status, 'accepted');
assert.equal(parameterSetCount, 1);
assert.equal(session.snapshot().draft.parameters.beamPowerCapW, 1.1);

const resetParameterResult = await session.dispatch({ type: 'resetCanonicalParameters' });
assert.equal(resetParameterResult.status, 'accepted');
assert.equal(parameterSetCount, 2);

const frameOptionsResult = await session.dispatch({
  type: 'applyRepresentativeUeFrameOptions',
  frameOptions: {
    representativeUserIndex: frame.links[0]?.userIndex,
    userPositionOverridesKm: [{
      userIndex: frame.links[0]?.userIndex ?? 0,
      positionKm: [0, 0],
    }],
  },
});
assert.equal(frameOptionsResult.status, 'accepted');
assert.equal(frameOptionsSetCount, 1);

const frameOptionsResetResult = await session.dispatch({ type: 'resetRepresentativeUeFrameOptions' });
assert.equal(frameOptionsResetResult.status, 'accepted');
assert.equal(frameOptionsSetCount, 2);
assert.equal(
  frameOptionsCalls[frameOptionsCalls.length - 1]?.beamLayoutCount,
  7,
  'resetting the UE probe preserves the default layout',
);

const beamLayoutResult = await session.dispatch({ type: 'setBeamLayoutCount', beamCount: 19 });
assert.equal(beamLayoutResult.status, 'accepted');
assert.equal(frameOptionsSetCount, 3);
assert.equal(frameOptionsCalls[frameOptionsCalls.length - 1]?.beamLayoutCount, 19);
assert.equal(beamLayoutResult.snapshot.draft.frameOptions.beamLayoutCount, 19);

const rejectedBeamLayout = await session.dispatch({
  type: 'setBeamLayoutCount',
  beamCount: 37,
} as unknown as LabCommand);
assert.equal(rejectedBeamLayout.status, 'rejected');
assert.equal(rejectedBeamLayout.error?.code, 'COMMAND_REJECTED');
assert.equal(frameOptionsSetCount, 3, 'unsupported beam layouts do not reach the canonical owner');

const overrideSatelliteId = frame.selectedSatelliteId;
const setSatelliteOverride = await session.dispatch({
  type: 'setPerSatelliteBeamLayout',
  satelliteId: overrideSatelliteId,
  beamCount: 1,
});
assert.equal(setSatelliteOverride.status, 'accepted');
assert.equal(frameOptionsSetCount, 4);
assert.equal(frameOptionsCalls[frameOptionsCalls.length - 1]?.perSatelliteBeamLayoutCount?.[overrideSatelliteId], 1);
assert.equal(setSatelliteOverride.snapshot.draft.frameOptions.perSatelliteBeamLayoutCount[overrideSatelliteId], 1);

const probeWithSatelliteOverride = await session.dispatch({
  type: 'applyRepresentativeUeFrameOptions',
  frameOptions: {
    representativeUserIndex: frame.links[0]?.userIndex,
    userPositionOverridesKm: [{
      userIndex: frame.links[0]?.userIndex ?? 0,
      positionKm: [1, 1],
    }],
  },
});
assert.equal(probeWithSatelliteOverride.status, 'accepted');
assert.equal(frameOptionsSetCount, 5);
assert.equal(
  frameOptionsCalls[frameOptionsCalls.length - 1]?.perSatelliteBeamLayoutCount?.[overrideSatelliteId],
  1,
  'moving the representative UE preserves satellite-local beam layout choices',
);

const removeSatelliteOverride = await session.dispatch({
  type: 'removePerSatelliteBeamLayout',
  satelliteId: overrideSatelliteId,
});
assert.equal(removeSatelliteOverride.status, 'accepted');
assert.equal(frameOptionsSetCount, 6);
assert.equal(frameOptionsCalls[frameOptionsCalls.length - 1]?.perSatelliteBeamLayoutCount?.[overrideSatelliteId], undefined);
assert.equal(removeSatelliteOverride.snapshot.draft.frameOptions.perSatelliteBeamLayoutCount[overrideSatelliteId], undefined);

const evaluationResetResult = await session.dispatch({ type: 'resetEvaluation' });
assert.equal(evaluationResetResult.status, 'accepted');
assert.equal(evaluationResetCount, 1);

// Rejected/unavailable are explicit and preserve the previous accepted view.
const unavailableSeek = await session.dispatch({ type: 'seek', timeSec: 30 });
assert.equal(unavailableSeek.status, 'unavailable');
assert.equal(unavailableSeek.error?.code, 'TIMELINE_UNAVAILABLE');
assert.equal(unavailableSeek.snapshot.accepted, initial.accepted);

const unavailableParameter = await session.dispatch({
  type: 'editCanonicalParameter',
  key: 'channelGainScale',
  value: 2,
} as unknown as LabCommand);
assert.equal(unavailableParameter.status, 'unavailable');
assert.equal(unavailableParameter.error?.code, 'COMMAND_UNAVAILABLE');
assert.equal(unavailableParameter.snapshot.accepted, initial.accepted);

const rejectedOutOfRangeParameter = await session.dispatch({
  type: 'editCanonicalParameter',
  key: 'frequencyReuse',
  value: 8,
});
assert.equal(rejectedOutOfRangeParameter.status, 'rejected');
assert.equal(rejectedOutOfRangeParameter.error?.code, 'COMMAND_REJECTED');
assert.equal(parameterSetCount, 2, 'invalid values do not reach the canonical parameter owner');

const rejectedFractionalGroup = await session.dispatch({
  type: 'editCanonicalParameter',
  key: 'frequencyReuse',
  value: 2.5,
});
assert.equal(rejectedFractionalGroup.status, 'rejected');
assert.equal(rejectedFractionalGroup.error?.code, 'COMMAND_REJECTED');
assert.equal(parameterSetCount, 2, 'fractional reuse groups do not reach the canonical parameter owner');

const rejectedFrameOptions = await session.dispatch({
  type: 'applyRepresentativeUeFrameOptions',
  frameOptions: {
    userPositionOverridesKm: [
      { userIndex: 1, positionKm: [0, 0] },
      { userIndex: 2, positionKm: [0, 0] },
    ],
  },
});
assert.equal(rejectedFrameOptions.status, 'rejected');
assert.equal(rejectedFrameOptions.error?.code, 'COMMAND_REJECTED');
assert.equal(rejectedFrameOptions.snapshot.accepted, initial.accepted);

const clearBaselineResult = await session.dispatch({ type: 'clearBaseline' });
assert.equal(clearBaselineResult.status, 'accepted');
assert.equal(clearBaselineResult.snapshot.comparison.baseline, null);
assert.equal(clearBaselineResult.snapshot.comparison.candidate, null);

unsubscribe();
console.log('visual-lab session facade passed');
