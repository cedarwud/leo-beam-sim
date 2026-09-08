import assert from 'node:assert/strict';
import test from 'node:test';

import {
  LIVE_WALKER_HANDOVER_EVENT_INDEX_DURATION_SEC,
  type LiveWalkerHandoverEvent,
  type LiveWalkerHandoverEventIndex,
} from '../scene/liveWalkerHandoverEventIndex';
import type { HandoverRailEvent } from '../ui/HandoverEventRail';
import {
  deriveAppTimelineCore,
  deriveAppTimelineDisabled,
  deriveAppTimelineRailProjection,
  selectAppHandoverRailEvents,
  type AppTimelineCoreInput,
} from './appTimelinePresentation';

function event(overrides: Partial<LiveWalkerHandoverEvent> = {}): LiveWalkerHandoverEvent {
  const kind = overrides.kind ?? 'intra';
  return {
    id: 'event-default',
    sourceTimeSec: 0,
    kind,
    fromSatId: 'sat-a',
    fromBeamId: 1,
    toSatId: kind === 'inter' ? 'sat-b' : 'sat-a',
    toBeamId: 2,
    ueId: 'live-ue-0',
    fromCellId: 3,
    toCellId: 3,
    fromSinrDb: -2,
    toSinrDb: 1,
    deltaDb: 3,
    sourceStartSec: 0,
    sourceEndSec: 0,
    clickTargetSec: 0,
    primaryUeId: 'live-ue-0',
    count: 1,
    ...overrides,
  };
}

function index(events: readonly LiveWalkerHandoverEvent[]): LiveWalkerHandoverEventIndex {
  return {
    sourceOwner: 'sinr-live-cell-truth',
    horizonKind: 'live-walker-window',
    claimKind: 'live-truth',
    durationSec: LIVE_WALKER_HANDOVER_EVENT_INDEX_DURATION_SEC,
    ueScope: 'cell-truth-ue-events',
    primaryUeId: 'live-ue-0',
    aggregateUeCount: 1,
    aggregateClaim: 'cell-truth-event-index',
    generation: {
      profileId: 'test-profile',
      epochUtcMs: 1,
      simStepSec: 30,
      handoverPolicyKey: 'test-policy',
      topologyKey: 'test-topology',
      runtimeFramePath: 'stepRuntimeFrame+sinrLiveCells',
    },
    offsetDb: 3,
    sourceGapReasons: [],
    events,
  };
}

function baseInput(overrides: Partial<AppTimelineCoreInput> = {}): AppTimelineCoreInput {
  return {
    sceneLane: 'sinr-live',
    sceneSource: 'live-sim',
    isRootHomepage: true,
    isWalkerSceneActive: true,
    isArchivedTleSceneActive: false,
    demoStartOffsetSec: 450,
    liveDurationSec: 7200,
    liveSimTimeSec: 480,
    artifactCurrentTimeSec: 0,
    showcaseArtifact: null,
    liveWalkerHandoverEventIndex: null,
    liveWalkerHandoverEventIndexBuilding: false,
    focusedUeId: 'live-ue-0',
    archivedTleRunReady: false,
    archivedTleDurationSec: 7200,
    archivedTleCurrentTimeSec: 0,
    archivedTleStepSec: 30,
    ...overrides,
  };
}

test('derives one coherent live timeline core across replay, index, and descriptors', () => {
  const core = deriveAppTimelineCore(baseInput());

  assert.equal(core.liveTimelineWindowStartSec, 450);
  assert.equal(core.liveTimelineElapsedSec, 30);
  assert.equal(core.timelineRailDescriptor.timeline.sourceOwner, 'live-walker');
  assert.equal(core.activeTimelineDescriptor, core.timelineRailDescriptor.timeline);
  assert.equal(core.timelineDurationSec, 7200);
  assert.equal(core.timelineCurrentTimeSec, 30);
  assert.deepEqual(core.liveWalkerHandoverRailEvents, []);
});

test('keeps homepage event markers, demo window, and button events on one source pair', () => {
  const events = [
    event({
      id: 'intra-26',
      kind: 'intra',
      sourceTimeSec: 26,
      sourceStartSec: 16,
      sourceEndSec: 46,
      clickTargetSec: 26,
    }),
    event({
      id: 'inter-62',
      kind: 'inter',
      sourceTimeSec: 62,
      sourceStartSec: 52,
      sourceEndSec: 82,
      clickTargetSec: 62,
      fromSatId: 'sat-a',
    }),
  ];
  const eventIndex = index(events);
  const core = deriveAppTimelineCore(baseInput({ liveWalkerHandoverEventIndex: eventIndex }));
  const projection = deriveAppTimelineRailProjection({
    sceneLane: 'sinr-live',
    sceneSource: 'live-sim',
    isRootHomepage: true,
    isWalkerSceneActive: true,
    isArchivedTleSceneActive: false,
    timelineDurationSec: core.timelineDurationSec,
    liveWalkerHandoverEventIndexBuilding: false,
    liveWalkerHandoverEventIndex: eventIndex,
    focusedUeId: 'live-ue-0',
    liveObservedHandoverRailEvents: [],
    core,
  });

  assert.deepEqual(projection.homepageDemoWindow?.events.map(item => item.id), ['intra-26', 'inter-62']);
  assert.deepEqual(projection.homepageTimelineEventMarkers.map(marker => marker.kind), ['intra', 'inter']);
  assert.deepEqual(projection.liveWalkerDirectorHandoverEventsForButtons.map(item => item.id), ['intra-26', 'inter-62']);
  assert.deepEqual(projection.homepageDirectorHandoverRailEvents.map(item => item.id), ['intra-26', 'inter-62']);
  assert.deepEqual(projection.handoverRailEvents.map(item => item.id), ['intra-26', 'inter-62']);
});

test('selects the active rail owner without rebuilding an event source', () => {
  const artifact: readonly HandoverRailEvent[] = [{
    id: 'artifact-1', timeSec: 1, kind: 'inter', title: 'artifact',
    fromLabel: 'a', toLabel: 'b', source: 'artifact-replay',
  }];
  const observed: readonly HandoverRailEvent[] = [{
    id: 'observed-1', timeSec: 1, kind: 'intra', title: 'observed',
    fromLabel: 'a', toLabel: 'b', source: 'live-observed',
  }];
  const core = deriveAppTimelineCore(baseInput());

  assert.equal(selectAppHandoverRailEvents({
    sceneSource: 'artifact-replay', sceneLane: 'artifact-replay',
    isArchivedTleSceneActive: false, core: { ...core, artifactHandoverRailEvents: artifact },
    liveObservedHandoverRailEvents: observed,
  }), artifact);
  assert.equal(selectAppHandoverRailEvents({
    sceneSource: 'live-sim', sceneLane: 'sinr-live',
    isArchivedTleSceneActive: false, core, liveObservedHandoverRailEvents: observed,
  }), core.liveWalkerHandoverRailEvents);
  assert.equal(selectAppHandoverRailEvents({
    sceneSource: 'live-sim', sceneLane: 'artifact-replay',
    isArchivedTleSceneActive: false, core, liveObservedHandoverRailEvents: observed,
  }), observed);
  assert.equal(selectAppHandoverRailEvents({
    sceneSource: 'live-sim', sceneLane: 'sinr-live',
    isArchivedTleSceneActive: true, core, liveObservedHandoverRailEvents: observed,
  }).length, 0);
});

test('keeps timeline disabled decisions pure and explicit', () => {
  assert.equal(deriveAppTimelineDisabled({
    isWalkerSceneActive: true,
    manualHandoverRequested: true,
    isArchivedTleSceneActive: false,
    archivedTleRunReady: true,
    sceneSource: 'live-sim',
    replayControllerReady: true,
    showcaseLoading: false,
    showcaseError: null,
    timelineDurationSec: 7200,
  }), true);
  assert.equal(deriveAppTimelineDisabled({
    isWalkerSceneActive: false,
    manualHandoverRequested: false,
    isArchivedTleSceneActive: true,
    archivedTleRunReady: false,
    sceneSource: 'live-sim',
    replayControllerReady: true,
    showcaseLoading: false,
    showcaseError: null,
    timelineDurationSec: 7200,
  }), true);
  assert.equal(deriveAppTimelineDisabled({
    isWalkerSceneActive: false,
    manualHandoverRequested: false,
    isArchivedTleSceneActive: false,
    archivedTleRunReady: false,
    sceneSource: 'artifact-replay',
    replayControllerReady: false,
    showcaseLoading: false,
    showcaseError: null,
    timelineDurationSec: 7200,
  }), true);
  assert.equal(deriveAppTimelineDisabled({
    isWalkerSceneActive: false,
    manualHandoverRequested: false,
    isArchivedTleSceneActive: false,
    archivedTleRunReady: false,
    sceneSource: 'live-sim',
    replayControllerReady: false,
    showcaseLoading: false,
    showcaseError: null,
    timelineDurationSec: 7200,
  }), false);
});
