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

console.log('[liveSimToScene.intra-handover] regression checks passed');
