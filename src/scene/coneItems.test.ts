import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Vector3 } from 'three';
import {
  resolveCandidateConeItems,
  selectCandidateConeGeometry,
} from './candidateConeItems';
import { resolveServingConeItems } from './servingConeItems';
import {
  resolveAuthorityPairConeItems,
  resolveCinemaPairConeItems,
  resolvePulseConeItems,
  resolveTriggeredIntraConeItems,
} from './handoverConeResolvers';
import type {
  CellServingRecord,
  IlluminatedCellBeam,
  SinrLiveCellFrame,
  SinrLiveCellHandoverEvent,
} from './sinrLiveCellModel';
import type {
  SinrLiveCellBeamConeRenderItem,
  SinrLiveCellPlacement,
  SinrLiveCinemaHandoverCandidate,
} from '../viz/SinrLiveCellBeamCones';
import type { WorldPoint } from '../viz/CellFootprints';

const placementByCellId = new Map<number, SinrLiveCellPlacement>([
  [0, { cellId: 0, worldX: 10, worldZ: -20, radiusWorld: 4 }],
  [1, { cellId: 1, worldX: -30, worldZ: 15, radiusWorld: 4 }],
]);
const satelliteWorldById = new Map<string, WorldPoint>([
  ['sat-serving', { x: 0, y: 100, z: 0 }],
  ['sat-candidate', { x: 25, y: 110, z: -10 }],
]);

function frameOf(
  illuminatedBeams: readonly IlluminatedCellBeam[],
  recentHandoverEvents: readonly SinrLiveCellHandoverEvent[] = [],
): SinrLiveCellFrame {
  const servedCells = illuminatedBeams.filter(beam => beam.serving);
  const cells: readonly CellServingRecord[] = [];
  return {
    simTimeSec: 10,
    cells,
    ues: [],
    illuminatedBeams,
    servedCellCount: new Set(servedCells.map(beam => beam.cellId)).size,
    servedUeCount: 0,
    servingSatCount: new Set(servedCells.map(beam => beam.satId)).size,
    intraHandoverCount: 0,
    interHandoverCount: recentHandoverEvents.filter(event => event.kind === 'inter').length,
    cumulativeIntraHandoverCount: 0,
    cumulativeInterHandoverCount: 0,
    recentHandoverEvents,
  };
}

function beam(
  satId: string,
  cellId: number,
  serving: boolean,
  beamId: number,
): IlluminatedCellBeam {
  return { satId, cellId, serving, beamId, frequencyIndex: cellId % 3 };
}

/**
 * Records which (satellite, beam) the lane asked the identity ladder about.
 *
 * There is no `fallback` parameter any more: the ladder owns every rung,
 * including the deterministic one, so there is no slot for a caller to put a
 * colour in. What is worth pinning here is the KEY the lane asks with — that is
 * what diverged between lanes and rendered one beam in two shades.
 */
function identityColor(
  satelliteId: string,
  beamId: number,
): string {
  return `${satelliteId}/${beamId}`;
}

function keepItems(
  items: readonly SinrLiveCellBeamConeRenderItem[],
): readonly SinrLiveCellBeamConeRenderItem[] {
  return items;
}

const servingFrame = frameOf([beam('sat-serving', 0, true, 1)]);
const interCandidate: SinrLiveCinemaHandoverCandidate = {
  eventId: 'event-inter',
  ueId: 'ue-0',
  kind: 'inter',
  sourceTimeSec: 10,
  fromSatId: 'sat-serving',
  fromBeamId: 1,
  fromCellId: 0,
  toSatId: 'sat-candidate',
  toBeamId: 2,
  toCellId: 1,
};
const intraCandidate: SinrLiveCinemaHandoverCandidate = {
  ...interCandidate,
  eventId: 'event-intra',
  kind: 'intra',
  toSatId: 'sat-serving',
  toCellId: 1,
};
const interEvent: SinrLiveCellHandoverEvent = {
  ueId: 'ue-0',
  kind: 'inter',
  sourceTimeSec: 10,
  fromSatId: 'sat-serving',
  fromBeamId: 1,
  fromCellId: 0,
  toSatId: 'sat-candidate',
  toBeamId: 2,
  toCellId: 1,
};

test('serving cone projection uses a small explicit geometry and display seam', () => {
  const items = resolveServingConeItems({
    geometry: {
      cellFrame: servingFrame,
      placementByCellId,
      satelliteWorldById,
      focusSatIds: new Set(['sat-serving']),
      frequencyReuse: 3,
      servingBeamBudget: 1,
      allowHeroFallback: false,
      budgetServingFan: true,
      displayHeroRecord: { servingSatId: 'sat-serving', cellId: 0, beamId: 1 },
    },
    presentation: {
      showSinrLiveCellBeams: true,
      renderServingField: true,
      showNonServingCones: false,
      hideNormalBeamField: false,
      hidePrimaryServingBeam: false,
      preserveConfiguredServingFan: false,
      teachingLectureFieldCleared: false,
      multiCandidateCentralOverlayActive: false,
      homepageVisualIdentity: false,
      homepageBeamVisibility: new Set(),
      homepageBeamFanSatelliteIds: new Set(),
      resolveSceneAcceptedBeamColor: identityColor,
      restrictHomepageBeamItems: keepItems,
    },
  });

  assert.equal(items.length, 1);
  assert.equal(items[0]?.satId, 'sat-serving');
  assert.equal(items[0]?.cellId, 0);
  assert.equal(items[0]?.color, 'sat-serving/1', 'the serving lane asks the ladder for beam 1 of sat-serving');
  assert.equal(items[0]?.baseCenter.y, 0);
});

test('candidate cone projection keeps a bounded target fan and no React dependency', () => {
  const geometry = selectCandidateConeGeometry({
    presentedHandoverPairCandidate: null,
    showCinemaCandidateFan: false,
    renderedCandidateSatelliteId: 'sat-candidate',
    primaryServingRecord: { servingSatId: 'sat-serving', cellId: 0 },
    candidateDisplayCellFrame: frameOf([
      beam('sat-candidate', 0, false, 1),
      beam('sat-candidate', 1, false, 2),
    ]),
    cinemaInterDisplayCellFrame: undefined,
    normalSatelliteWorldById: satelliteWorldById,
    cinemaSatelliteWorldById: satelliteWorldById,
    placementByCellId,
    frequencyReuse: 3,
    maxFanCones: 2,
  });
  const items = resolveCandidateConeItems({
    geometry,
    presentation: {
      candidateComparisonSceneActive: false,
      renderCandidateField: true,
      homepageVisualIdentity: false,
      showSinrLiveCellBeams: true,
      hideCandidateFan: false,
      showCinemaCandidateFan: false,
      isInterPresentation: false,
      handoverPhase: 'measuring',
      handoverToOpacity: 0.5,
      candidateFanConeOpacity: 0.5,
      triggeredIntraPeakOpacity: 0.8,
      targetRole: 'candidate',
      acceptedHandoverPresentation: null,
      restrictHomepageBeamItems: keepItems,
    },
  });

  assert.deepEqual(items.map(item => item.role), ['candidatePrimary', 'candidateFan']);
  assert.equal(items.length, 2);
  assert.equal(items[0]?.satId, 'sat-candidate');
});

test('handover outputs are independently resolvable through four pure seams', () => {
  const pulseItems = resolvePulseConeItems({
    policy: {
      enabled: true,
      hideTimelinePulse: false,
      suppressNaturalHandoverLayers: false,
      renderNaturalPulse: true,
      homepageVisualIdentity: false,
      concurrentIntraVisualSuppressed: false,
      showOtherHandoverUes: true,
      pulseFocusFollowsScope: false,
    },
    frame: { recentHandoverEvents: [interEvent], simTimeSec: 10 },
    geometry: {
      placementByCellId,
      satelliteWorldById,
      frequencyReuse: 3,
      focusSatIds: null,
      protagonistUeId: 'ue-0',
    },
    output: { resolveSceneAcceptedBeamColor: identityColor, restrictHomepageBeamItems: keepItems },
  });
  assert.equal(pulseItems.length, 2);
  assert.deepEqual(pulseItems.map(item => item.kind), ['inter', 'inter']);

  const triggeredItems = resolveTriggeredIntraConeItems({
    policy: {
      enabled: true,
      renderTriggeredIntra: true,
      homepageVisualIdentity: false,
      presentedCinemaHandoverActive: false,
      handoverActive: true,
      handoverEventSource: 'manual',
      handoverEventKind: 'intra',
    },
    candidate: intraCandidate,
    fallbackUeId: 'ue-0',
    envelope: { fromOpacity: 0.4, phase: 'holding', toOpacity: 0.6 },
    triggeredIntraPeakOpacity: 0.8,
    geometry: {
      placementByCellId,
      satelliteWorldById,
      frequencyReuse: 3,
      manualBaseCenterOverride: new Vector3(2, 0, 3),
    },
    output: { resolveSceneAcceptedBeamColor: identityColor, restrictHomepageBeamItems: keepItems },
  });
  assert.equal(triggeredItems.length, 2);
  assert.deepEqual(triggeredItems.map(item => item.opacity), [0.6, 0.4]);
  assert.equal(triggeredItems[0]?.baseCenter.x, 2);

  const cinemaItems = resolveCinemaPairConeItems({
    policy: {
      enabled: true,
      homepageVisualIdentity: false,
      renderCinemaPair: true,
      handoverActive: false,
      presentedInterHandoverActive: true,
      presentedCinemaHandoverActive: false,
      handoverEventKind: null,
    },
    candidate: interCandidate,
    envelope: { fromOpacity: 0.4, phase: 'holding', toOpacity: 0.6 },
    triggeredIntraPeakOpacity: 0.8,
    geometry: {
      placementByCellId,
      satelliteWorldById,
      frequencyReuse: 3,
      homepageIntraCellAnchor: new Vector3(2, 0, 3),
      manualHandoverGroundTarget: new Vector3(4, 0, 5),
    },
    output: { resolveSceneAcceptedBeamColor: identityColor, restrictHomepageBeamItems: keepItems },
  });
  assert.equal(cinemaItems.length, 2);
  assert.equal(cinemaItems[0]?.baseCenter.x, 4);

  const authorityItems = resolveAuthorityPairConeItems({
    policy: {
      enabled: true,
      centralOverlayActive: true,
      identityTransitionActive: false,
      handoverActive: true,
      homepageVisualIdentity: true,
      renderAuthorityPair: true,
      authorityPresentationCommitObserved: false,
    },
    candidate: interCandidate,
    envelope: { fromOpacity: 0.4, phase: 'holding', toOpacity: 0.6 },
    beamColorBySatelliteBeam: new Map([
      ['sat-serving/1', '#111111'],
      ['sat-candidate/2', '#222222'],
    ]),
    geometry: {
      placementByCellId,
      satelliteWorldById,
      frequencyReuse: 3,
      homepageIntraCellAnchor: new Vector3(2, 0, 3),
      manualHandoverGroundTarget: new Vector3(4, 0, 5),
    },
    output: { resolveSceneAcceptedBeamColor: identityColor, restrictHomepageBeamItems: keepItems },
  });
  assert.equal(authorityItems.length, 2);

  const committedItems = resolveAuthorityPairConeItems({
    policy: {
      enabled: true,
      centralOverlayActive: true,
      identityTransitionActive: false,
      handoverActive: true,
      homepageVisualIdentity: true,
      renderAuthorityPair: true,
      authorityPresentationCommitObserved: true,
    },
    candidate: interCandidate,
    envelope: { fromOpacity: 0.4, phase: 'settled', toOpacity: 0.6 },
    beamColorBySatelliteBeam: new Map([
      ['sat-serving/1', '#111111'],
      ['sat-candidate/2', '#222222'],
    ]),
    geometry: {
      placementByCellId,
      satelliteWorldById,
      frequencyReuse: 3,
      homepageIntraCellAnchor: new Vector3(2, 0, 3),
      manualHandoverGroundTarget: new Vector3(4, 0, 5),
    },
    output: { resolveSceneAcceptedBeamColor: identityColor, restrictHomepageBeamItems: keepItems },
  });
  assert.equal(committedItems.length, 1);
  assert.equal(committedItems[0]?.satId, 'sat-candidate');
});

console.log('coneItems.test.ts: PASS');
