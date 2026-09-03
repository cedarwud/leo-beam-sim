import assert from 'node:assert/strict';
import { sceneGeometryFromProfile } from '../scene/SceneGeometry';
import { createEmptyFrame } from '../scene/simulationHelpers';
import type { SinrLiveCellFrame, SinrLiveCellHandoverEvent } from '../scene/sinrLiveCellModel';
import type { SimFrame } from '../scene/types';
import { resolveRecentPrimaryIntraHandoverEvent } from '../scene/intraHandoverVisualState';
import { resolveHandoverToastState } from '../viz/handoverToastState';
import { liveSimToScene } from './liveSimToScene';

const geometry = sceneGeometryFromProfile({
  shell: { altitudeKm: 780 },
  antenna: { beamwidth3dBRad: 0.08 },
  handover: { triggerTimeSec: 0.2 },
  orbit: { shells: [{ id: 'shell-0', altitudeKm: 780 }] },
  beams: { frequencyReuse: 3 },
});

function cellFrame(
  simTimeSec: number,
  recentHandoverEvents: readonly SinrLiveCellHandoverEvent[],
): SinrLiveCellFrame {
  return {
    simTimeSec,
    cells: [],
    ues: [{
      ueId: 'live-ue-0',
      cellId: 1,
      cellDistanceKm: 0,
      offAxisDeg: 0,
      servingSatId: 'sat-a',
      beamIdentity: 'sat-a#cell1',
      frequencyIndex: 1,
      sinrDb: -4,
      handoverKind: 'none',
    }],
    illuminatedBeams: [],
    servedCellCount: 1,
    servedUeCount: 1,
    servingSatCount: 1,
    intraHandoverCount: 0,
    interHandoverCount: 0,
    cumulativeIntraHandoverCount: 0,
    cumulativeInterHandoverCount: 0,
    recentHandoverEvents,
  };
}

function baseFrame(simTimeSec: number): SimFrame {
  const frame = createEmptyFrame(simTimeSec);
  frame.serving = { satId: 'sat-a', beamId: 1, sinrDb: -4 };
  frame.perUePositions = [{
    id: 'live-ue-0',
    groundX: 0,
    groundZ: 0,
    eastKm: 0,
    northKm: 0,
    sinrDb: -4,
    servingSatId: 'sat-a',
    servingBeamId: 1,
    pendingTargetSatId: null,
    pendingTargetBeamId: null,
    triggerProgressSec: 0,
  }];
  // This is the generic policy preview that must not leak through the cell-truth
  // adapter when the primary cell has no active/recent intra event.
  frame.intraHandoverPreview = {
    satId: 'sat-a',
    fromBeamId: 1,
    toBeamId: 2,
    triggerTimeSec: 0.4,
    triggerTimeTargetSec: 0.75,
    progress: 0.53,
  };
  return frame;
}

function project(
  simTimeSec: number,
  recentHandoverEvents: readonly SinrLiveCellHandoverEvent[],
): ReturnType<typeof liveSimToScene> {
  const frame = baseFrame(simTimeSec);
  frame.sinrLiveCells = cellFrame(simTimeSec, recentHandoverEvents);
  return liveSimToScene(frame, geometry);
}

function archivedTleCellFrame(
  simTimeSec: number,
  state: 'pending' | 'committed',
): SinrLiveCellFrame {
  const servingSatId = 'tle-serving';
  const candidateSatId = 'tle-candidate';
  const sourceSatId = 'tle-source';
  const cells = Array.from({ length: 7 }, (_, cellId) => ({
    cellId,
    servingSatId,
    beamIdentity: `${servingSatId}#cell${cellId}`,
    frequencyIndex: cellId % 3,
    servingSinrDb: -20,
    candidateCount: state === 'pending' ? 2 : 1,
  }));
  const ues = Array.from({ length: 100 }, (_, index) => {
    const cellId = index % 7;
    const isPrimary = index === 0;
    return {
      ueId: `ue-${index + 1}`,
      cellId,
      cellDistanceKm: 0,
      offAxisDeg: 0,
      servingSatId,
      beamIdentity: `${servingSatId}#cell${cellId}`,
      frequencyIndex: cellId % 3,
      sinrDb: isPrimary ? -21 : -20,
      handoverKind: state === 'committed' && isPrimary ? 'inter' as const : 'none' as const,
      comparisonSatId: isPrimary && state === 'pending' ? candidateSatId : null,
      comparisonSinrDb: isPrimary && state === 'pending' ? -4 : null,
      pendingTargetSatId: isPrimary && state === 'pending' ? candidateSatId : null,
      triggerProgressSec: isPrimary && state === 'pending' ? 15 : 0,
    };
  });
  return {
    simTimeSec,
    cells,
    ues,
    illuminatedBeams: cells.map(cell => ({
      satId: servingSatId,
      cellId: cell.cellId,
      frequencyIndex: cell.frequencyIndex,
      serving: true,
    })),
    servedCellCount: 7,
    servedUeCount: 100,
    servingSatCount: 1,
    intraHandoverCount: 0,
    interHandoverCount: state === 'committed' ? 1 : 0,
    cumulativeIntraHandoverCount: 0,
    cumulativeInterHandoverCount: state === 'committed' ? 1 : 0,
    primaryUeId: 'ue-1',
    recentHandoverEvents: state === 'committed'
      ? [{
        ueId: 'ue-1',
        kind: 'inter',
        sourceTimeSec: 9,
        fromSatId: sourceSatId,
        fromCellId: 1,
        toSatId: servingSatId,
        toCellId: 0,
      }]
      : [],
  };
}

function archivedTleProjection(state: 'pending' | 'committed'): ReturnType<typeof liveSimToScene> {
  const frame = createEmptyFrame(10);
  frame.serving = { satId: 'tle-serving', beamId: 0, sinrDb: -12 };
  frame.perUePositions = Array.from({ length: 100 }, (_, index) => ({
    id: `ue-${index + 1}`,
    groundX: 0,
    groundZ: 0,
    eastKm: 0,
    northKm: 0,
    sinrDb: -12,
    servingSatId: 'tle-serving',
    servingBeamId: index % 7,
    pendingTargetSatId: index === 0 && state === 'pending' ? 'tle-candidate' : null,
    pendingTargetBeamId: index === 0 && state === 'pending' ? 6 : null,
    triggerProgressSec: index === 0 && state === 'pending' ? 15 : 0,
  }));
  frame.sinrLiveCells = archivedTleCellFrame(10, state);
  frame.pendingTargetSatId = state === 'pending' ? 'tle-candidate' : null;
  frame.pendingTargetBeamId = state === 'pending' ? 6 : null;
  frame.pendingTargetSinrDb = state === 'pending' ? -4 : null;
  frame.handoverTriggerProgressSec = state === 'pending' ? 15 : 0;
  if (state === 'committed') {
    frame.recentHoSourceSatId = 'tle-source';
    frame.recentHoTargetSatId = 'tle-serving';
    frame.recentHoSourceBeamId = 1;
    frame.recentHoTargetBeamId = 0;
    frame.lastHoEvent = {
      timeMs: 9_000,
      action: 'inter-handover',
      fromSatId: 'tle-source',
      fromBeamId: 1,
      fromSinrDb: -18,
      toSatId: 'tle-serving',
      toBeamId: 0,
      toSinrDb: -12,
      deltaDb: 6,
    };
    frame.interHandoverEvent = {
      fromSatId: 'tle-source',
      fromBeamId: 1,
      toSatId: 'tle-serving',
      toBeamId: 0,
      triggeredAtSec: 9,
      expiresAtSec: 13,
    };
  }
  return liveSimToScene(frame, sceneGeometryFromProfile({
    shell: { altitudeKm: 780 },
    antenna: { beamwidth3dBRad: 0.08 },
    handover: { triggerTimeSec: 30 },
    orbit: { shells: [{ id: 'shell-0', altitudeKm: 780 }] },
    beams: { frequencyReuse: 3 },
  }), { source: 'archived-tle' });
}

const archivedPendingProjection = archivedTleProjection('pending');
assert.equal(archivedPendingProjection.pendingTarget?.satId, 'tle-candidate');
assert.equal(archivedPendingProjection.pendingTarget?.beamId, '6');
assert.equal(archivedPendingProjection.pendingTarget?.channelMetric?.dB, -4);
assert.equal(archivedPendingProjection.ues[0]?.targetSatelliteId, 'tle-candidate');
assert.equal(archivedPendingProjection.ues[0]?.targetBeamId, '6');
assert.equal(archivedPendingProjection.metrics.primary.dB, -12);
assert.equal(archivedPendingProjection.transitionProgress.inter?.kind, 'pending');
assert.equal(archivedPendingProjection.transitionProgress.inter?.pendingProgressSec, 15);
assert.equal(archivedPendingProjection.transitionProgress.inter?.pendingTargetSec, 30);

const archivedCommittedProjection = archivedTleProjection('committed');
assert.equal(archivedCommittedProjection.recentHo?.sourceSatId, 'tle-source');
assert.equal(archivedCommittedProjection.transitionProgress.inter?.kind, 'committed');
assert.equal(archivedCommittedProjection.transitionProgress.inter?.fromSatId, 'tle-source');
assert.equal(archivedCommittedProjection.transitionProgress.inter?.toSatId, 'tle-serving');

const intraEvent: SinrLiveCellHandoverEvent = {
  ueId: 'live-ue-0',
  kind: 'intra',
  sourceTimeSec: 9,
  fromSatId: 'sat-a',
  fromCellId: 1,
  toSatId: 'sat-a',
  toCellId: 2,
};

const interEvent: SinrLiveCellHandoverEvent = {
  ueId: 'live-ue-0',
  kind: 'inter',
  sourceTimeSec: 9,
  fromSatId: 'sat-a',
  fromCellId: 1,
  toSatId: 'sat-b',
  toCellId: 1,
};

assert.equal(
  project(10, []).transitionProgress.intra,
  undefined,
  'idle cell-truth frame must not keep a generic intra preview active',
);
assert.equal(
  project(20, [{ ...intraEvent, sourceTimeSec: 10 }]).transitionProgress.intra,
  undefined,
  'expired cell-truth intra event must not remain active',
);

const activeIntra = project(10, [intraEvent]).transitionProgress.intra;
assert.equal(activeIntra?.kind, 'recent', 'recent intra event is projected as recent intra');
assert.equal(activeIntra?.fromBeamId, '1', 'recent intra keeps the source beam');
assert.equal(activeIntra?.toBeamId, '2', 'recent intra keeps the target beam');

const activeInter = project(10, [interEvent]).transitionProgress;
assert.equal(activeInter.intra, undefined, 'recent inter event must not activate intra');
assert.equal(activeInter.inter?.kind, 'recent', 'recent inter event remains an inter state');

const interStillOwnsMixedWindow = project(10, [interEvent, intraEvent]).transitionProgress;
assert.equal(
  interStillOwnsMixedWindow.intra,
  undefined,
  'a retained intra event must not replace an active inter in the same primary-UE window',
);
assert.equal(
  interStillOwnsMixedWindow.inter?.fromSatId,
  'sat-a',
  'the central scene keeps the source satellite from the active inter story',
);

assert.equal(
  resolveRecentPrimaryIntraHandoverEvent({
    events: [interEvent, intraEvent],
    primaryUeId: 'live-ue-0',
    simTimeSec: 10,
  }),
  intraEvent,
  'only the primary recent intra event may arm the triggered intra visual',
);
assert.equal(
  resolveRecentPrimaryIntraHandoverEvent({
    events: [interEvent],
    primaryUeId: 'live-ue-0',
    simTimeSec: 10,
  }),
  null,
  'an inter event must not arm the triggered intra visual',
);
assert.equal(
  resolveRecentPrimaryIntraHandoverEvent({
    events: [intraEvent],
    primaryUeId: 'live-ue-0',
    simTimeSec: 13,
  }),
  null,
  'an expired intra event must not arm the triggered intra visual',
);

assert.equal(
  resolveHandoverToastState({
    transitionProgress: {
      intra: {
        fromBeamId: '1',
        toBeamId: '2',
        progress01: 1,
        expiresAtSec: 14,
        kind: 'recent',
        satId: 'sat-a',
        recentProgressSec: 4,
        recentTargetSec: 4,
      },
    },
  }, 2, 0),
  null,
  'a completed recent intra event must not remain an active toast',
);

const mixedTransitionToast = resolveHandoverToastState({
  preferredKind: 'inter',
  transitionProgress: {
    intra: {
      fromBeamId: '1',
      toBeamId: '2',
      progress01: 0.4,
      expiresAtSec: 14,
      kind: 'recent',
      satId: 'sat-a',
      recentProgressSec: 1,
      recentTargetSec: 4,
    },
    inter: {
      fromSatId: 'sat-a',
      fromBeamId: '1',
      toSatId: 'sat-b',
      toBeamId: '1',
      progress01: 0.4,
      expiresAtSec: 14,
      kind: 'recent',
      recentProgressSec: 1,
      recentTargetSec: 4,
    },
  },
}, 2, 0);
assert.equal(
  mixedTransitionToast?.kind,
  'inter',
  'the active inter presentation owner wins when a stale intra latch is also present',
);

// Focused-cell regression: the cell-truth model may nominate a non-zero UE as
// primary. The scene adapter must carry that identity into the renderer's
// first-UE convention, including its world anchor and serving truth.
const focusedCellFrame = cellFrame(10, []);
const focusedBaseFrame = baseFrame(10);
const focusedScene = liveSimToScene({
  ...focusedBaseFrame,
  perUePositions: [
    ...focusedBaseFrame.perUePositions,
    {
      id: 'live-ue-5',
      groundX: 50,
      groundZ: 60,
      eastKm: 50,
      northKm: -60,
      sinrDb: -7,
      servingSatId: 'sat-b',
      servingBeamId: 5,
      pendingTargetSatId: null,
      pendingTargetBeamId: null,
      triggerProgressSec: 0,
    },
  ],
  sinrLiveCells: {
    ...focusedCellFrame,
    primaryUeId: 'live-ue-5',
    ues: [
      ...focusedCellFrame.ues,
      {
        ...focusedCellFrame.ues[0],
        ueId: 'live-ue-5',
        cellId: 5,
        servingSatId: 'sat-b',
        beamIdentity: 'sat-b#cell5',
        frequencyIndex: 2,
      },
    ],
  },
}, geometry);
assert.equal(focusedScene.ues[0]?.id, 'live-ue-5', 'focused UE is normalized to the renderer primary slot');
assert.deepEqual(focusedScene.ues[0]?.worldPos, [50, 0, 60], 'focused UE keeps its scene anchor');
assert.equal(focusedScene.metrics.servingSatelliteId, 'sat-b', 'focused cell serving truth reaches scene metrics');
assert.equal(focusedScene.ues[0]?.servingBeamId, 'sat-b#cell5', 'focused cell serving truth reaches the UE marker');

console.log('[liveSimToScene.intra-handover] regression checks passed');
