import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  loadTleSnapshotSelection,
  loadTleWebArchiveCatalog,
} from '../../simulator/archive';
import { buildTleAnalysisRun } from '../../simulator/tleAnalysisRun';
import {
  DEFAULT_SIMULATOR_PARAMETERS,
  SIMULATOR_CATALOG_URLS,
} from '../../simulator/types';
import { buildTleRunBundle } from '../../tle/run';
import {
  createVisualLabSession,
  type LabSnapshot,
} from '../session';
import {
  createVisualLabStoryController,
  deriveVisualLabStoryDescriptors,
  selectVisualLabInterHandoverMarker,
  VISUAL_LAB_INTRA_HANDOVER_STORY_ID,
} from './visualLabStoryController';

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
const firstFrame = analysisRun.getFrame(0);
if (firstFrame === null) throw new Error('real fixture did not produce a first frame');

const analysis = {
  frame: firstFrame,
  acceptedRun: analysisRun,
  visualNextFrame: null,
  evaluation: analysisRun.evaluation,
  resetEvaluation: () => undefined,
  catalog,
  status: 'ready' as const,
  error: null,
  requestedConstellation: 'oneweb' as const,
  setRequestedConstellation: () => undefined,
  resetRequestedConstellation: () => undefined,
  taipeiDateTime: '2026-08-08T20:00',
  setTaipeiDateTime: () => undefined,
  resetTaipeiDateTime: () => undefined,
  applyRequestedOrbitSettings: () => undefined,
  orbitSettingsDirty: false,
  parameters: DEFAULT_SIMULATOR_PARAMETERS,
  setParameters: () => undefined,
  resetParameters: () => undefined,
  frameOptions: { userPositionOverridesKm: [] },
  setFrameOptions: () => undefined,
  resetFrameOptions: () => undefined,
  runReady: true,
  runProgress: null,
  timeResolution: null,
  timeFallbackSearch: null,
  timelineDurationSec: analysisRun.durationS,
  timelineCurrentTimeSec: 0,
  timelineStepSec: analysisRun.stepS,
  selectTimelineTimeSec: () => undefined,
};

const snapshot = createVisualLabSession({ analysis }).snapshot();
const timeline = snapshot.timeline;
if (timeline === null) throw new Error('real fixture did not produce an accepted timeline');
const realMarker = timeline.markers.find(marker => marker.event === 'inter-handover');
if (realMarker === undefined) throw new Error('real fixture did not produce an inter-handover marker');

// A real marker is selected only after complete before/decision/after checks.
const derivation = deriveVisualLabStoryDescriptors(snapshot);
const selectedMarker = selectVisualLabInterHandoverMarker(snapshot);
if (selectedMarker === null) throw new Error('real fixture did not produce a complete serving-change marker');
assert.equal(derivation.selectedMarker?.eventId, selectedMarker.eventId);
assert.equal(derivation.availability.interHandover.status, 'available');
assert.equal(derivation.availability.interHandover.selectedStoryId, selectedMarker.eventId);
assert.equal(derivation.descriptors.some(story => story.storyId === selectedMarker.eventId), true);
const interDescriptor = derivation.descriptors.find(story => story.storyId === selectedMarker.eventId);
assert.ok(interDescriptor);
assert.equal(interDescriptor?.source.kind, 'inter-handover');
if (interDescriptor?.source.kind === 'inter-handover') {
  assert.equal(interDescriptor.source.fromSatelliteId, selectedMarker.fromSatelliteId);
  assert.equal(interDescriptor.source.toSatelliteId, selectedMarker.toSatelliteId);
}

// A canonical forced-continuity marker is also a real cross-satellite serving
// change. It remains eligible for replay, while the decision beat preserves
// the source reason instead of pretending that TTT triggered it.
const forcedMarker = Object.freeze({
  ...realMarker,
  eventId: `${realMarker.eventId}-forced`,
  event: 'forced-continuity' as const,
  reason: 'serving link left the accepted continuity boundary',
});
const forcedTimeline = Object.freeze({
  ...timeline,
  markers: Object.freeze([forcedMarker]),
});
const forcedAccepted = Object.freeze({
  ...snapshot.accepted!,
  timeline: forcedTimeline,
});
const forcedSnapshot = Object.freeze({
  ...snapshot,
  accepted: forcedAccepted,
  timeline: forcedTimeline,
  energy: Object.freeze({ ...snapshot.energy, timeline: forcedTimeline }),
}) as LabSnapshot;
const forcedDerivation = deriveVisualLabStoryDescriptors(forcedSnapshot);
assert.equal(forcedDerivation.availability.interHandover.status, 'available');
assert.equal(forcedDerivation.availability.interHandover.selectedStoryId, forcedMarker.eventId);

// Intra-handover is explicit unavailable; no identity-only trace is made up.
assert.equal(derivation.availability.intraHandover.status, 'unavailable');
assert.match(derivation.availability.intraHandover.reason ?? '', /canonical beam-identity trace/i);
const intraDescriptor = derivation.descriptors.find(
  story => story.storyId === VISUAL_LAB_INTRA_HANDOVER_STORY_ID,
);
assert.ok(intraDescriptor);
assert.equal(intraDescriptor?.availability.status, 'unavailable');

const hoppingRun = buildTleAnalysisRun({
  selection,
  geometryRun,
  parameters: DEFAULT_SIMULATOR_PARAMETERS,
  passPlan: analysisRun.passPlan,
  frameOptions: { beamLayoutCount: 7, beamIlluminationMode: 'beam-hopping' },
});
const hoppingFrame = hoppingRun.getFrame(0);
if (hoppingFrame === null) throw new Error('Beam Hopping fixture did not produce a first frame');
const hoppingSnapshot = createVisualLabSession({
  analysis: {
    ...analysis,
    frame: hoppingFrame,
    acceptedRun: hoppingRun,
    evaluation: hoppingRun.evaluation,
    frameOptions: { beamLayoutCount: 7, beamIlluminationMode: 'beam-hopping', userPositionOverridesKm: [] },
  },
}).snapshot();
const hoppingDerivation = deriveVisualLabStoryDescriptors(hoppingSnapshot);
assert.equal(hoppingDerivation.availability.intraHandover.status, 'available');
const hoppingIntra = hoppingDerivation.descriptors.find(
  story => story.storyId === VISUAL_LAB_INTRA_HANDOVER_STORY_ID,
);
assert.equal(hoppingIntra?.availability.status, 'available');
assert.equal(hoppingIntra?.source.kind, 'intra-handover');
if (hoppingIntra?.source.kind === 'intra-handover') {
  assert.ok(hoppingIntra.source.trace !== null && hoppingIntra.source.trace !== undefined);
  assert.equal(
    hoppingIntra.source.trace?.decisionAnchorIndex,
    (hoppingIntra.source.trace?.beforeAnchorIndex ?? -2) + 1,
  );
}

// The active step's time is exactly the accepted timeline point time.  The
// route can dispatch this value to the session's semantic seek command.
const controller = createVisualLabStoryController(snapshot);
assert.equal(controller.state().activeStoryId, selectedMarker.eventId);
assert.equal(controller.state().activeStep?.phase, 'before');
assert.equal(controller.state().activeStepTimeSec, controller.state().activeStep?.point?.timeSec);
assert.equal(controller.state().activeStepSeekTimeSec, controller.state().activeStepTimeSec);
assert.equal(controller.play().status, 'playing');
const decision = controller.tick();
assert.equal(decision.activeStep?.phase, 'decision');
assert.equal(decision.activeStepTimeSec, decision.activeStep?.point?.timeSec);
assert.equal(decision.activeStepTimeSec, selectedMarker.timeSec);
const after = controller.tick();
assert.equal(after.activeStep?.phase, 'after');
assert.equal(after.status, 'completed');
assert.equal(after.activeStepTimeSec, after.activeStep?.point?.timeSec);

// Semantic controls are delegated to the existing real-evidence runtime.
assert.equal(controller.restart().status, 'paused');
assert.equal(controller.next().activeStep?.phase, 'decision');
assert.equal(controller.previous().activeStep?.phase, 'before');
assert.equal(controller.inspect('handover').inspectedTarget, 'handover');
assert.equal(controller.forkToExplore().presentation.experience, 'explore');
assert.equal(controller.state().activeStepTimeSec, null);

// A timeline with no inter marker cannot produce an inter descriptor.  It is
// reported as unavailable, while the intra capability remains unavailable.
const missingTimeline = Object.freeze({
  ...timeline,
  markers: Object.freeze([]),
});
const missingAccepted = Object.freeze({
  ...snapshot.accepted!,
  timeline: missingTimeline,
});
const missingMarkerSnapshot = Object.freeze({
  ...snapshot,
  accepted: missingAccepted,
  timeline: missingTimeline,
  energy: Object.freeze({ ...snapshot.energy, timeline: missingTimeline }),
}) as LabSnapshot;
const missing = deriveVisualLabStoryDescriptors(missingMarkerSnapshot);
assert.equal(missing.availability.interHandover.status, 'unavailable');
assert.equal(missing.availability.interHandover.storyIds.length, 0);
assert.equal(missing.descriptors.some(story => story.kind === 'inter-handover'), false);
const missingController = createVisualLabStoryController(missingMarkerSnapshot);
assert.equal(missingController.state().status, 'unavailable');
assert.equal(missingController.state().activeStep, null);
const reboundToReal = missingController.updateSnapshot(snapshot);
assert.equal(reboundToReal.activeStoryId, selectedMarker.eventId);
assert.equal(reboundToReal.status, 'idle');
assert.equal(reboundToReal.activeStep?.phase, 'before');

console.log('visual-lab story controller passed');
