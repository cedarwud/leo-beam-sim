/**
 * CHARACTERIZATION TEST — what the cone painters produce TODAY.
 *
 * This is not a specification. It is a photograph. Every literal below was
 * produced by running the current code, never by re-deriving the expected value
 * from the function under test — an expectation computed by calling the thing it
 * checks passes no matter what the code does, and this repo has been bitten by
 * exactly that shape of vacuous assertion before.
 *
 * Its job is to make the rendering-convergence refactor PROVABLE. `tsc` going
 * green and the line count going down are cheap signals that always say yes;
 * this table says no the moment a pixel moves. When a row below changes, that
 * change is either a bug you just introduced or a fix you meant to make — and
 * you must say which in the commit message.
 *
 * ## What this photograph recorded, and what changed
 *
 * The first version of this table was taken BEFORE the convergence and captured
 * a real defect: the same beam (sat-serving, cellId 0, beamId 1), in the same
 * intra handover, on the same snapshot state, rendered
 *
 *     pulse lane     -> #aee726
 *     triggered lane -> #a1dd17
 *     cinema lane    -> #a1dd17
 *
 * and for inter, where no shade applies at all, `pulse #bee561` against
 * `cinema #afe03e`. The cause was not a palette disagreement and not the lookup
 * key — every lane passed the right key. It was the FALLBACK: the triggered,
 * cinema and authority lanes derived their miss-path colour from the CELL id
 * while looking up by the BEAM id, and `beamId == cellId + 1` here, so a lookup
 * hit and a lookup miss described different beams one lightness rung apart.
 *
 * Routing every lane through `src/appearance/paintConeItems.ts` closed it: 54
 * rows moved, all of them a transient lane adopting the value the steady serving
 * and pulse lanes already used, with zero rows added, removed or reordered, zero
 * `LOOKUP` rows changed, and an identical opacity distribution. The table below
 * is the photograph re-taken after that fix.
 *
 * The guard against it coming back is the SECOND test in this file, not this
 * one. This table only says "something moved"; that one names the two colours
 * and the lanes that disagree. It was verified to fail against the
 * pre-convergence resolvers and pass after — a test that has never been seen to
 * fail is not evidence.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveHandoverSide } from '../appearance/handoverAppearanceModifiers';
import { resolveBaseIdentityColor } from '../appearance/resolveBeamAppearance';
import { colorForServingBeam } from '../constants/servingColour';
import { HANDOVER_VISUAL_IDENTITY_NEUTRAL_FALLBACK_COLOR } from '../constants/handoverVisualIdentity';
import { buildCandidatePresentationPlan } from '../engine/handover/candidatePresentationPlan';
import type { HandoverDecisionFrame } from '../engine/handover/candidateDecisionContract';
import { Vector3 } from 'three';

const observed: string[] = [];
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
import { resolveAcceptedBeamIdentityColor } from './acceptedBeamIdentityColor';
import { mosaicColorForServingBeam } from './sinrServingMosaic';
import { makeIdentitySources, resolvedBeamId } from '../appearance/beamAppearanceContract';
import { buildMultiCandidateScenePresentation } from './multiCandidateScenePresentation';
import type {
  CellServingRecord,
  IlluminatedCellBeam,
  SinrLiveCellFrame,
  SinrLiveCellHandoverEvent,
} from './sinrLiveCellModel';
import {
  resolveBudgetedSinrLiveBeamConeItems,
  resolveCinemaInterServingFanConeItems,
  resolveSinrLiveNonServingConeItems,
  type SinrLiveCellBeamConeRenderItem,
  type SinrLiveCellPlacement,
  type SinrLiveCinemaHandoverCandidate,
} from '../viz/SinrLiveCellBeamCones';
import { paintConeItems } from '../appearance/paintConeItems';
import type { WorldPoint } from '../viz/CellFootprints';
import type { AcceptedHandoverPresentationSnapshot } from './acceptedHandoverPresentationSnapshot';

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

function keepItems(
  items: readonly SinrLiveCellBeamConeRenderItem[],
): readonly SinrLiveCellBeamConeRenderItem[] {
  return items;
}

// A snapshot whose identity allocation HITS for sat-serving/1 and sat-candidate/2.
const hitSnapshot = {
  plan: {
    identityAllocation: {
      beamAssignmentsBySatelliteId: {
        'sat-serving': { '1': { cssColor: '#ff00aa' } },
        'sat-candidate': { '2': { cssColor: '#00ffaa' } },
      },
    },
  },
} as unknown as AcceptedHandoverPresentationSnapshot;

/**
 * Records every identity lookup as well as answering it.
 *
 * The KEY a lane passes, and the `isServingOrCandidate` flag it passes with it,
 * are appearance decisions as much as the returned colour is: the key selects a
 * rung of the lightness ladder, and the flag selects an EE shade on the
 * homepage. Pinning only the returned colour would let a refactor change either
 * one invisibly, and "the test could not see it" is how the last regression got
 * in. So the call itself is part of the photograph.
 */
function acceptedColorLookup(snapshot: AcceptedHandoverPresentationSnapshot | null) {
  return (
    satelliteId: string,
    beamId: number,
    isServingOrCandidate?: boolean,
  ): string => {
    observed.push(`LOOKUP sat=${satelliteId} key=${beamId} serving=${isServingOrCandidate === true ? 1 : 0}`);
    // The lookup no longer takes a fallback: the ladder behind it owns every
    // rung, including the deterministic one. On a snapshot MISS this returns
    // the same deterministic colour the ladder would, so the recorded rows are
    // unchanged by the signature change — which is exactly what makes the
    // EXPECTED block below a valid check that nothing moved.
    return resolveAcceptedBeamIdentityColor(
      snapshot,
      satelliteId,
      beamId,
      colorForServingBeam(satelliteId, beamId).markerColor,
    );
  };
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
const intraEvent: SinrLiveCellHandoverEvent = {
  ueId: 'ue-0',
  kind: 'intra',
  sourceTimeSec: 10,
  fromSatId: 'sat-serving',
  fromBeamId: 1,
  fromCellId: 0,
  toSatId: 'sat-serving',
  toBeamId: 3,
  toCellId: 1,
};

function dump(label: string, items: readonly SinrLiveCellBeamConeRenderItem[]): void {
  observed.push(`--- ${label} ---`);
  for (const item of items) {
    observed.push(JSON.stringify({
      satId: item.satId,
      cellId: item.cellId,
      beamId: item.beamId,
      role: (item as { role?: string }).role,
      kind: (item as { kind?: string }).kind,
      // Recorded because the lanes do not agree on how they name a side: the
      // pulse lane stamps role handoverSource/handoverTarget, while the cinema
      // and authority lanes stamp role 'triggered' and carry the side in the
      // render key. Without this field the lane-agreement test below silently
      // compares nothing.
      renderKey: item.renderKey,
      color: item.color,
      opacity: item.opacity,
    }));
  }
}

// ============ 1. resolveServingConeItems ============
for (const homepageVisualIdentity of [false, true]) {
  for (const snapshot of [null, hitSnapshot]) {
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
        homepageVisualIdentity,
        homepageBeamVisibility: new Set(['sat-serving|0']),
        homepageBeamFanSatelliteIds: new Set(['sat-serving']),
        resolveSceneAcceptedBeamColor: acceptedColorLookup(snapshot),
        restrictHomepageBeamItems: keepItems,
      },
    });
    dump(`serving homepage=${homepageVisualIdentity} snapshot=${snapshot ? 'hit' : 'miss'}`, items);
  }
}

// ============ 2. resolveCandidateConeItems ============
for (const homepageVisualIdentity of [false, true]) {
  for (const snapshot of [null, hitSnapshot]) {
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
        homepageVisualIdentity,
        showSinrLiveCellBeams: true,
        hideCandidateFan: false,
        showCinemaCandidateFan: false,
        isInterPresentation: false,
        handoverPhase: 'measuring',
        handoverToOpacity: 0.5,
        candidateFanConeOpacity: 0.5,
        triggeredIntraPeakOpacity: 0.8,
        targetRole: 'candidate',
        acceptedHandoverPresentation: snapshot,
        restrictHomepageBeamItems: keepItems,
      },
    });
    dump(`candidate homepage=${homepageVisualIdentity} snapshot=${snapshot ? 'hit' : 'miss'}`, items);
  }
}

// candidate: inter presentation w/ settled vs holding phase
for (const phase of ['settled', 'holding'] as const) {
  for (const snapshot of [null, hitSnapshot]) {
    const geometry = selectCandidateConeGeometry({
      presentedHandoverPairCandidate: interCandidate,
      showCinemaCandidateFan: true,
      renderedCandidateSatelliteId: 'sat-candidate',
      primaryServingRecord: { servingSatId: 'sat-serving', cellId: 0 },
      candidateDisplayCellFrame: undefined,
      cinemaInterDisplayCellFrame: frameOf([
        beam('sat-candidate', 1, false, 2),
        beam('sat-candidate', 0, false, 1),
      ]),
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
        showCinemaCandidateFan: true,
        isInterPresentation: true,
        handoverPhase: phase,
        handoverToOpacity: 0.5,
        candidateFanConeOpacity: 0.5,
        triggeredIntraPeakOpacity: 0.8,
        targetRole: 'candidate',
        acceptedHandoverPresentation: snapshot,
        restrictHomepageBeamItems: keepItems,
      },
    });
    dump(`candidate-inter phase=${phase} snapshot=${snapshot ? 'hit' : 'miss'}`, items);
  }
}

// ============ 3. resolvePulseConeItems ============
for (const kind of ['intra', 'inter'] as const) {
  const event = kind === 'intra' ? intraEvent : interEvent;
  for (const homepageVisualIdentity of [false, true]) {
    for (const snapshot of [null, hitSnapshot]) {
      const items = resolvePulseConeItems({
        policy: {
          enabled: true,
          hideTimelinePulse: false,
          suppressNaturalHandoverLayers: false,
          renderNaturalPulse: true,
          homepageVisualIdentity,
          concurrentIntraVisualSuppressed: false,
          showOtherHandoverUes: true,
          pulseFocusFollowsScope: false,
        },
        frame: { recentHandoverEvents: [event], simTimeSec: 10 },
        geometry: {
          placementByCellId,
          satelliteWorldById,
          frequencyReuse: 3,
          focusSatIds: null,
          protagonistUeId: 'ue-0',
        },
        output: { resolveSceneAcceptedBeamColor: acceptedColorLookup(snapshot), restrictHomepageBeamItems: keepItems },
      });
      dump(`pulse kind=${kind} homepage=${homepageVisualIdentity} snapshot=${snapshot ? 'hit' : 'miss'}`, items);
    }
  }
}

// ============ 4. resolveTriggeredIntraConeItems ============
for (const phase of ['settled', 'holding'] as const) {
  for (const homepageVisualIdentity of [false, true]) {
    for (const snapshot of [null, hitSnapshot]) {
      const items = resolveTriggeredIntraConeItems({
        policy: {
          enabled: true,
          renderTriggeredIntra: true,
          homepageVisualIdentity,
          presentedCinemaHandoverActive: false,
          handoverActive: true,
          handoverEventSource: 'manual',
          handoverEventKind: 'intra',
        },
        candidate: intraCandidate,
        fallbackUeId: 'ue-0',
        envelope: { fromOpacity: 0.4, phase, toOpacity: 0.6 },
        triggeredIntraPeakOpacity: 0.8,
        geometry: {
          placementByCellId,
          satelliteWorldById,
          frequencyReuse: 3,
          manualBaseCenterOverride: new Vector3(2, 0, 3),
        },
        output: { resolveSceneAcceptedBeamColor: acceptedColorLookup(snapshot), restrictHomepageBeamItems: keepItems },
      });
      dump(`triggered phase=${phase} homepage=${homepageVisualIdentity} snapshot=${snapshot ? 'hit' : 'miss'}`, items);
    }
  }
}

// ============ 5. resolveCinemaPairConeItems ============
for (const kind of ['intra', 'inter'] as const) {
  const candidate = kind === 'intra' ? intraCandidate : interCandidate;
  for (const phase of ['settled', 'holding'] as const) {
    for (const homepageVisualIdentity of [false, true]) {
      for (const snapshot of [null, hitSnapshot]) {
        const items = resolveCinemaPairConeItems({
          policy: {
            enabled: true,
            homepageVisualIdentity,
            renderCinemaPair: true,
            handoverActive: true,
            presentedInterHandoverActive: true,
            presentedCinemaHandoverActive: false,
            handoverEventKind: null,
          },
          candidate,
          envelope: { fromOpacity: 0.4, phase, toOpacity: 0.6 },
          triggeredIntraPeakOpacity: 0.8,
          geometry: {
            placementByCellId,
            satelliteWorldById,
            frequencyReuse: 3,
            homepageIntraCellAnchor: new Vector3(2, 0, 3),
            manualHandoverGroundTarget: new Vector3(4, 0, 5),
          },
          output: { resolveSceneAcceptedBeamColor: acceptedColorLookup(snapshot), restrictHomepageBeamItems: keepItems },
        });
        dump(`cinema kind=${kind} phase=${phase} homepage=${homepageVisualIdentity} snapshot=${snapshot ? 'hit' : 'miss'}`, items);
      }
    }
  }
}

// ============ 6. resolveAuthorityPairConeItems ============
for (const kind of ['intra', 'inter'] as const) {
  const candidate = kind === 'intra' ? intraCandidate : interCandidate;
  for (const phase of ['settled', 'holding'] as const) {
    for (const homepageVisualIdentity of [false, true]) {
      for (const snapshot of [null, hitSnapshot]) {
        const items = resolveAuthorityPairConeItems({
          policy: {
            enabled: true,
            centralOverlayActive: true,
            identityTransitionActive: false,
            handoverActive: true,
            homepageVisualIdentity,
            renderAuthorityPair: true,
            authorityPresentationCommitObserved: false,
          },
          candidate,
          envelope: { fromOpacity: 0.4, phase, toOpacity: 0.6 },
          beamColorBySatelliteBeam: new Map(),
          geometry: {
            placementByCellId,
            satelliteWorldById,
            frequencyReuse: 3,
            homepageIntraCellAnchor: new Vector3(2, 0, 3),
            manualHandoverGroundTarget: new Vector3(4, 0, 5),
          },
          output: { resolveSceneAcceptedBeamColor: acceptedColorLookup(snapshot), restrictHomepageBeamItems: keepItems },
        });
        dump(`authority kind=${kind} phase=${phase} homepage=${homepageVisualIdentity} snapshot=${snapshot ? 'hit' : 'miss'}`, items);
      }
    }
  }
}

// authority w/ committed inter + settled + beamColorBySatelliteBeam populated
{
  const items = resolveAuthorityPairConeItems({
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
    output: { resolveSceneAcceptedBeamColor: acceptedColorLookup(null), restrictHomepageBeamItems: keepItems },
  });
  dump('authority committed-inter settled beamColorMap', items);
}

// ============ 7. useSinrLiveCellNonServingConeItems (pure projection) ============
// The React hook wraps a pure projection: resolveSinrLiveNonServingConeItems,
// painted with prominence: 'candidate' and keyed on the item's own beam id,
// restricted by restrictHomepageBeamItems, and gated by homepageVisualIdentity.
function resolveNonServingConeItemsPure(input: {
  readonly cellFrame: SinrLiveCellFrame;
  readonly placementByCellId: ReadonlyMap<number, SinrLiveCellPlacement>;
  readonly satelliteWorldById: ReadonlyMap<string, WorldPoint>;
  readonly focusSatIds?: ReadonlySet<string> | null;
  readonly homepageVisualIdentity: boolean;
  readonly showSinrLiveCellBeams?: boolean;
  readonly hideNormalBeamField?: boolean;
  readonly acceptedHandoverPresentation: AcceptedHandoverPresentationSnapshot | null;
  readonly restrictHomepageBeamItems: (
    items: readonly SinrLiveCellBeamConeRenderItem[],
  ) => readonly SinrLiveCellBeamConeRenderItem[];
}): readonly SinrLiveCellBeamConeRenderItem[] {
  if (
    input.showSinrLiveCellBeams === false
    || input.homepageVisualIdentity
    || input.hideNormalBeamField === true
  ) return [];
  const items = resolveSinrLiveNonServingConeItems({
    cellFrame: input.cellFrame,
    placementByCellId: input.placementByCellId,
    satelliteWorldById: input.satelliteWorldById,
    focusSatIds: input.focusSatIds ?? null,
  });
  return input.restrictHomepageBeamItems(paintConeItems(items, {
    resolveIdentityColor: (satId, beamId) =>
      resolveAcceptedBeamIdentityColor(input.acceptedHandoverPresentation, satId, beamId, ''),
    prominence: 'candidate',
  }));
}

const nonServingFrame = frameOf([
  beam('sat-serving', 0, false, 1),
  beam('sat-candidate', 1, false, 2),
]);
for (const homepageVisualIdentity of [false, true]) {
  for (const snapshot of [null, hitSnapshot]) {
    const items = resolveNonServingConeItemsPure({
      cellFrame: nonServingFrame,
      placementByCellId,
      satelliteWorldById,
      homepageVisualIdentity,
      showSinrLiveCellBeams: true,
      hideNormalBeamField: false,
      acceptedHandoverPresentation: snapshot,
      restrictHomepageBeamItems: keepItems,
    });
    dump(`non-serving homepage=${homepageVisualIdentity} snapshot=${snapshot ? 'hit' : 'miss'}`, items);
  }
}

// ============ 8. useSinrLiveCinemaInterServingFanConeItems (pure projection) ============
// The React hook wraps a pure projection: resolveCinemaInterServingFanConeItems
// budgeted by resolveBudgetedSinrLiveBeamConeItems, painted with prominence: 'candidate'
// and keyed on the item's own beam id, restricted by restrictHomepageBeamItems, and
// gated by homepageVisualIdentity.
function resolveCinemaInterServingFanConeItemsPure(input: {
  readonly candidate: SinrLiveCinemaHandoverCandidate | null;
  readonly opacity: number;
  readonly placementByCellId: ReadonlyMap<number, SinrLiveCellPlacement>;
  readonly satelliteWorldById: ReadonlyMap<string, WorldPoint>;
  readonly frequencyReuse: number;
  readonly cellFrame?: SinrLiveCellFrame;
  readonly sourceBeamBudget: number;
  readonly homepageVisualIdentity: boolean;
  readonly showSinrLiveCellBeams?: boolean;
  readonly showCinemaCandidateFan?: boolean;
  readonly acceptedHandoverPresentation: AcceptedHandoverPresentationSnapshot | null;
  readonly restrictHomepageBeamItems: (
    items: readonly SinrLiveCellBeamConeRenderItem[],
  ) => readonly SinrLiveCellBeamConeRenderItem[];
}): readonly SinrLiveCellBeamConeRenderItem[] {
  if (
    input.showSinrLiveCellBeams === false
    || input.homepageVisualIdentity
    || input.showCinemaCandidateFan === false
    || input.candidate?.kind !== 'inter'
  ) return [];
  const rawItems = resolveCinemaInterServingFanConeItems({
    candidate: input.candidate,
    opacity: input.opacity,
    placementByCellId: input.placementByCellId,
    satelliteWorldById: input.satelliteWorldById,
    frequencyReuse: input.frequencyReuse,
    cellFrame: input.cellFrame,
    maxFanCones: input.sourceBeamBudget,
  });
  const items = resolveBudgetedSinrLiveBeamConeItems({
    existingItems: rawItems,
    satId: input.candidate.fromSatId,
    maxCones: Math.max(0, input.sourceBeamBudget - 1),
    placementByCellId: input.placementByCellId,
    satelliteWorldById: input.satelliteWorldById,
    frequencyReuse: input.frequencyReuse,
    role: 'servingFan',
    renderKeyPrefix: 'cinema-serving-display-fan',
  }).map(item => ({ ...item, opacity: input.opacity }));
  return input.restrictHomepageBeamItems(paintConeItems(items, {
    resolveIdentityColor: (satId, beamId) =>
      resolveAcceptedBeamIdentityColor(input.acceptedHandoverPresentation, satId, beamId, ''),
    prominence: 'candidate',
  }));
}

const cinemaInterServingFrame = frameOf([
  beam('sat-serving', 0, true, 1),
  beam('sat-serving', 1, false, 2),
]);
for (const homepageVisualIdentity of [false, true]) {
  for (const snapshot of [null, hitSnapshot]) {
    const items = resolveCinemaInterServingFanConeItemsPure({
      candidate: interCandidate,
      opacity: 0.2,
      placementByCellId,
      satelliteWorldById,
      frequencyReuse: 3,
      cellFrame: cinemaInterServingFrame,
      sourceBeamBudget: 2,
      homepageVisualIdentity,
      showSinrLiveCellBeams: true,
      showCinemaCandidateFan: true,
      acceptedHandoverPresentation: snapshot,
      restrictHomepageBeamItems: keepItems,
    });
    dump(`cinema-inter-serving-fan homepage=${homepageVisualIdentity} snapshot=${snapshot ? 'hit' : 'miss'}`, items);
  }
}



/**
 * The photograph. 284 rows across eight cone-painting paths and the cross-product
 * of {intra, inter} x {source, target} x {settled, non-settled} x {homepage on,
 * off} x {identity lookup hits, misses}.
 */
const EXPECTED: readonly string[] = [
  "LOOKUP sat=sat-serving key=1 serving=1",
  "--- serving homepage=false snapshot=miss ---",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"color\":\"#bee561\"}",
  "LOOKUP sat=sat-serving key=1 serving=1",
  "--- serving homepage=false snapshot=hit ---",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"color\":\"#ff00aa\"}",
  "LOOKUP sat=sat-serving key=1 serving=1",
  "--- serving homepage=true snapshot=miss ---",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"color\":\"#bee561\"}",
  "LOOKUP sat=sat-serving key=1 serving=1",
  "--- serving homepage=true snapshot=hit ---",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"color\":\"#ff00aa\"}",
  "--- candidate homepage=false snapshot=miss ---",
  "{\"satId\":\"sat-candidate\",\"cellId\":0,\"beamId\":1,\"role\":\"candidatePrimary\",\"renderKey\":\"candidate-sat-candidate-0-1\",\"color\":\"#9fbfef\"}",
  "{\"satId\":\"sat-candidate\",\"cellId\":1,\"beamId\":2,\"role\":\"candidateFan\",\"renderKey\":\"candidate-fan-sat-candidate-1-2\",\"color\":\"#b9d0f4\"}",
  "--- candidate homepage=false snapshot=hit ---",
  "{\"satId\":\"sat-candidate\",\"cellId\":0,\"beamId\":1,\"role\":\"candidatePrimary\",\"renderKey\":\"candidate-sat-candidate-0-1\",\"color\":\"#9fbfef\"}",
  "{\"satId\":\"sat-candidate\",\"cellId\":1,\"beamId\":2,\"role\":\"candidateFan\",\"renderKey\":\"candidate-fan-sat-candidate-1-2\",\"color\":\"#00ffaa\"}",
  "--- candidate homepage=true snapshot=miss ---",
  "--- candidate homepage=true snapshot=hit ---",
  "--- candidate-inter phase=settled snapshot=miss ---",
  "{\"satId\":\"sat-candidate\",\"cellId\":0,\"beamId\":1,\"role\":\"candidateFan\",\"renderKey\":\"candidate-fan-sat-candidate-0-1\",\"color\":\"#9fbfef\",\"opacity\":0.4}",
  "--- candidate-inter phase=settled snapshot=hit ---",
  "{\"satId\":\"sat-candidate\",\"cellId\":0,\"beamId\":1,\"role\":\"candidateFan\",\"renderKey\":\"candidate-fan-sat-candidate-0-1\",\"color\":\"#9fbfef\",\"opacity\":0.4}",
  "--- candidate-inter phase=holding snapshot=miss ---",
  "{\"satId\":\"sat-candidate\",\"cellId\":0,\"beamId\":1,\"role\":\"candidateFan\",\"renderKey\":\"candidate-fan-sat-candidate-0-1\",\"color\":\"#9fbfef\",\"opacity\":0.25}",
  "--- candidate-inter phase=holding snapshot=hit ---",
  "{\"satId\":\"sat-candidate\",\"cellId\":0,\"beamId\":1,\"role\":\"candidateFan\",\"renderKey\":\"candidate-fan-sat-candidate-0-1\",\"color\":\"#9fbfef\",\"opacity\":0.25}",
  "LOOKUP sat=sat-serving key=3 serving=1",
  "LOOKUP sat=sat-serving key=1 serving=1",
  "--- pulse kind=intra homepage=false snapshot=miss ---",
  "{\"satId\":\"sat-serving\",\"cellId\":1,\"beamId\":3,\"role\":\"handoverTarget\",\"kind\":\"intra\",\"renderKey\":\"ue-0-10-to\",\"color\":\"#eaf9c8\",\"opacity\":0.8}",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"role\":\"handoverSource\",\"kind\":\"intra\",\"renderKey\":\"ue-0-10-from\",\"color\":\"#aee726\",\"opacity\":0.8}",
  "LOOKUP sat=sat-serving key=3 serving=1",
  "LOOKUP sat=sat-serving key=1 serving=1",
  "--- pulse kind=intra homepage=false snapshot=hit ---",
  "{\"satId\":\"sat-serving\",\"cellId\":1,\"beamId\":3,\"role\":\"handoverTarget\",\"kind\":\"intra\",\"renderKey\":\"ue-0-10-to\",\"color\":\"#eaf9c8\",\"opacity\":0.8}",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"role\":\"handoverSource\",\"kind\":\"intra\",\"renderKey\":\"ue-0-10-from\",\"color\":\"#d70993\",\"opacity\":0.8}",
  "LOOKUP sat=sat-serving key=3 serving=1",
  "LOOKUP sat=sat-serving key=1 serving=1",
  "--- pulse kind=intra homepage=true snapshot=miss ---",
  "{\"satId\":\"sat-serving\",\"cellId\":1,\"beamId\":3,\"role\":\"handoverTarget\",\"kind\":\"intra\",\"renderKey\":\"ue-0-10-to\",\"color\":\"#eaf9c8\",\"opacity\":0.8}",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"role\":\"handoverSource\",\"kind\":\"intra\",\"renderKey\":\"ue-0-10-from\",\"color\":\"#aee726\",\"opacity\":0.8}",
  "LOOKUP sat=sat-serving key=3 serving=1",
  "LOOKUP sat=sat-serving key=1 serving=1",
  "--- pulse kind=intra homepage=true snapshot=hit ---",
  "{\"satId\":\"sat-serving\",\"cellId\":1,\"beamId\":3,\"role\":\"handoverTarget\",\"kind\":\"intra\",\"renderKey\":\"ue-0-10-to\",\"color\":\"#eaf9c8\",\"opacity\":0.8}",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"role\":\"handoverSource\",\"kind\":\"intra\",\"renderKey\":\"ue-0-10-from\",\"color\":\"#d70993\",\"opacity\":0.8}",
  "LOOKUP sat=sat-candidate key=2 serving=0",
  "LOOKUP sat=sat-serving key=1 serving=0",
  "--- pulse kind=inter homepage=false snapshot=miss ---",
  "{\"satId\":\"sat-candidate\",\"cellId\":1,\"beamId\":2,\"role\":\"handoverTarget\",\"kind\":\"inter\",\"renderKey\":\"ue-0-10-to\",\"color\":\"#b9d0f4\",\"opacity\":0.8}",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"role\":\"handoverSource\",\"kind\":\"inter\",\"renderKey\":\"ue-0-10-from\",\"color\":\"#bee561\",\"opacity\":0.8}",
  "LOOKUP sat=sat-candidate key=2 serving=0",
  "LOOKUP sat=sat-serving key=1 serving=0",
  "--- pulse kind=inter homepage=false snapshot=hit ---",
  "{\"satId\":\"sat-candidate\",\"cellId\":1,\"beamId\":2,\"role\":\"handoverTarget\",\"kind\":\"inter\",\"renderKey\":\"ue-0-10-to\",\"color\":\"#00ffaa\",\"opacity\":0.8}",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"role\":\"handoverSource\",\"kind\":\"inter\",\"renderKey\":\"ue-0-10-from\",\"color\":\"#ff00aa\",\"opacity\":0.8}",
  "LOOKUP sat=sat-candidate key=2 serving=0",
  "LOOKUP sat=sat-serving key=1 serving=0",
  "--- pulse kind=inter homepage=true snapshot=miss ---",
  "{\"satId\":\"sat-candidate\",\"cellId\":1,\"beamId\":2,\"role\":\"handoverTarget\",\"kind\":\"inter\",\"renderKey\":\"ue-0-10-to\",\"color\":\"#b9d0f4\",\"opacity\":0.8}",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"role\":\"handoverSource\",\"kind\":\"inter\",\"renderKey\":\"ue-0-10-from\",\"color\":\"#bee561\",\"opacity\":0.8}",
  "LOOKUP sat=sat-candidate key=2 serving=0",
  "LOOKUP sat=sat-serving key=1 serving=0",
  "--- pulse kind=inter homepage=true snapshot=hit ---",
  "{\"satId\":\"sat-candidate\",\"cellId\":1,\"beamId\":2,\"role\":\"handoverTarget\",\"kind\":\"inter\",\"renderKey\":\"ue-0-10-to\",\"color\":\"#00ffaa\",\"opacity\":0.8}",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"role\":\"handoverSource\",\"kind\":\"inter\",\"renderKey\":\"ue-0-10-from\",\"color\":\"#ff00aa\",\"opacity\":0.8}",
  "LOOKUP sat=sat-serving key=1 serving=0",
  "LOOKUP sat=sat-serving key=2 serving=0",
  "--- triggered phase=settled homepage=false snapshot=miss ---",
  "{\"satId\":\"sat-serving\",\"cellId\":1,\"beamId\":2,\"kind\":\"intra\",\"renderKey\":\"ue-0-10-trig-to\",\"color\":\"#e3f7b5\",\"opacity\":0.8}",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"kind\":\"intra\",\"renderKey\":\"ue-0-10-trig-from\",\"color\":\"#aee726\",\"opacity\":0.4}",
  "LOOKUP sat=sat-serving key=1 serving=0",
  "LOOKUP sat=sat-serving key=2 serving=0",
  "--- triggered phase=settled homepage=false snapshot=hit ---",
  "{\"satId\":\"sat-serving\",\"cellId\":1,\"beamId\":2,\"kind\":\"intra\",\"renderKey\":\"ue-0-10-trig-to\",\"color\":\"#e3f7b5\",\"opacity\":0.8}",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"kind\":\"intra\",\"renderKey\":\"ue-0-10-trig-from\",\"color\":\"#d70993\",\"opacity\":0.4}",
  "LOOKUP sat=sat-serving key=1 serving=0",
  "LOOKUP sat=sat-serving key=2 serving=0",
  "--- triggered phase=settled homepage=true snapshot=miss ---",
  "{\"satId\":\"sat-serving\",\"cellId\":1,\"beamId\":2,\"kind\":\"intra\",\"renderKey\":\"ue-0-10-trig-to\",\"color\":\"#e3f7b5\",\"opacity\":0.8}",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"kind\":\"intra\",\"renderKey\":\"ue-0-10-trig-from\",\"color\":\"#aee726\",\"opacity\":0.4}",
  "LOOKUP sat=sat-serving key=1 serving=0",
  "LOOKUP sat=sat-serving key=2 serving=0",
  "--- triggered phase=settled homepage=true snapshot=hit ---",
  "{\"satId\":\"sat-serving\",\"cellId\":1,\"beamId\":2,\"kind\":\"intra\",\"renderKey\":\"ue-0-10-trig-to\",\"color\":\"#e3f7b5\",\"opacity\":0.8}",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"kind\":\"intra\",\"renderKey\":\"ue-0-10-trig-from\",\"color\":\"#d70993\",\"opacity\":0.4}",
  "LOOKUP sat=sat-serving key=1 serving=0",
  "LOOKUP sat=sat-serving key=2 serving=0",
  "--- triggered phase=holding homepage=false snapshot=miss ---",
  "{\"satId\":\"sat-serving\",\"cellId\":1,\"beamId\":2,\"kind\":\"intra\",\"renderKey\":\"ue-0-10-trig-to\",\"color\":\"#e3f7b5\",\"opacity\":0.6}",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"kind\":\"intra\",\"renderKey\":\"ue-0-10-trig-from\",\"color\":\"#aee726\",\"opacity\":0.4}",
  "LOOKUP sat=sat-serving key=1 serving=0",
  "LOOKUP sat=sat-serving key=2 serving=0",
  "--- triggered phase=holding homepage=false snapshot=hit ---",
  "{\"satId\":\"sat-serving\",\"cellId\":1,\"beamId\":2,\"kind\":\"intra\",\"renderKey\":\"ue-0-10-trig-to\",\"color\":\"#e3f7b5\",\"opacity\":0.6}",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"kind\":\"intra\",\"renderKey\":\"ue-0-10-trig-from\",\"color\":\"#d70993\",\"opacity\":0.4}",
  "LOOKUP sat=sat-serving key=1 serving=0",
  "LOOKUP sat=sat-serving key=2 serving=0",
  "--- triggered phase=holding homepage=true snapshot=miss ---",
  "{\"satId\":\"sat-serving\",\"cellId\":1,\"beamId\":2,\"kind\":\"intra\",\"renderKey\":\"ue-0-10-trig-to\",\"color\":\"#e3f7b5\",\"opacity\":0.6}",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"kind\":\"intra\",\"renderKey\":\"ue-0-10-trig-from\",\"color\":\"#aee726\",\"opacity\":0.4}",
  "LOOKUP sat=sat-serving key=1 serving=0",
  "LOOKUP sat=sat-serving key=2 serving=0",
  "--- triggered phase=holding homepage=true snapshot=hit ---",
  "{\"satId\":\"sat-serving\",\"cellId\":1,\"beamId\":2,\"kind\":\"intra\",\"renderKey\":\"ue-0-10-trig-to\",\"color\":\"#e3f7b5\",\"opacity\":0.6}",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"kind\":\"intra\",\"renderKey\":\"ue-0-10-trig-from\",\"color\":\"#d70993\",\"opacity\":0.4}",
  "LOOKUP sat=sat-serving key=1 serving=0",
  "LOOKUP sat=sat-serving key=2 serving=0",
  "--- cinema kind=intra phase=settled homepage=false snapshot=miss ---",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"role\":\"triggered\",\"kind\":\"intra\",\"renderKey\":\"cinema-event-intra-from\",\"color\":\"#aee726\",\"opacity\":0.4}",
  "{\"satId\":\"sat-serving\",\"cellId\":1,\"beamId\":2,\"role\":\"triggered\",\"kind\":\"intra\",\"renderKey\":\"cinema-event-intra-to\",\"color\":\"#e3f7b5\",\"opacity\":0.8}",
  "LOOKUP sat=sat-serving key=1 serving=0",
  "LOOKUP sat=sat-serving key=2 serving=0",
  "--- cinema kind=intra phase=settled homepage=false snapshot=hit ---",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"role\":\"triggered\",\"kind\":\"intra\",\"renderKey\":\"cinema-event-intra-from\",\"color\":\"#d70993\",\"opacity\":0.4}",
  "{\"satId\":\"sat-serving\",\"cellId\":1,\"beamId\":2,\"role\":\"triggered\",\"kind\":\"intra\",\"renderKey\":\"cinema-event-intra-to\",\"color\":\"#e3f7b5\",\"opacity\":0.8}",
  "LOOKUP sat=sat-serving key=1 serving=0",
  "LOOKUP sat=sat-serving key=2 serving=0",
  "--- cinema kind=intra phase=settled homepage=true snapshot=miss ---",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"role\":\"triggered\",\"kind\":\"intra\",\"renderKey\":\"cinema-event-intra-from\",\"color\":\"#aee726\",\"opacity\":0.4}",
  "{\"satId\":\"sat-serving\",\"cellId\":1,\"beamId\":2,\"role\":\"triggered\",\"kind\":\"intra\",\"renderKey\":\"cinema-event-intra-to\",\"color\":\"#e3f7b5\",\"opacity\":0.8}",
  "LOOKUP sat=sat-serving key=1 serving=0",
  "LOOKUP sat=sat-serving key=2 serving=0",
  "--- cinema kind=intra phase=settled homepage=true snapshot=hit ---",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"role\":\"triggered\",\"kind\":\"intra\",\"renderKey\":\"cinema-event-intra-from\",\"color\":\"#d70993\",\"opacity\":0.4}",
  "{\"satId\":\"sat-serving\",\"cellId\":1,\"beamId\":2,\"role\":\"triggered\",\"kind\":\"intra\",\"renderKey\":\"cinema-event-intra-to\",\"color\":\"#e3f7b5\",\"opacity\":0.8}",
  "LOOKUP sat=sat-serving key=1 serving=0",
  "LOOKUP sat=sat-serving key=2 serving=0",
  "--- cinema kind=intra phase=holding homepage=false snapshot=miss ---",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"role\":\"triggered\",\"kind\":\"intra\",\"renderKey\":\"cinema-event-intra-from\",\"color\":\"#aee726\",\"opacity\":0.4}",
  "{\"satId\":\"sat-serving\",\"cellId\":1,\"beamId\":2,\"role\":\"triggered\",\"kind\":\"intra\",\"renderKey\":\"cinema-event-intra-to\",\"color\":\"#e3f7b5\",\"opacity\":0.6}",
  "LOOKUP sat=sat-serving key=1 serving=0",
  "LOOKUP sat=sat-serving key=2 serving=0",
  "--- cinema kind=intra phase=holding homepage=false snapshot=hit ---",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"role\":\"triggered\",\"kind\":\"intra\",\"renderKey\":\"cinema-event-intra-from\",\"color\":\"#d70993\",\"opacity\":0.4}",
  "{\"satId\":\"sat-serving\",\"cellId\":1,\"beamId\":2,\"role\":\"triggered\",\"kind\":\"intra\",\"renderKey\":\"cinema-event-intra-to\",\"color\":\"#e3f7b5\",\"opacity\":0.6}",
  "LOOKUP sat=sat-serving key=1 serving=0",
  "LOOKUP sat=sat-serving key=2 serving=0",
  "--- cinema kind=intra phase=holding homepage=true snapshot=miss ---",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"role\":\"triggered\",\"kind\":\"intra\",\"renderKey\":\"cinema-event-intra-from\",\"color\":\"#aee726\",\"opacity\":0.4}",
  "{\"satId\":\"sat-serving\",\"cellId\":1,\"beamId\":2,\"role\":\"triggered\",\"kind\":\"intra\",\"renderKey\":\"cinema-event-intra-to\",\"color\":\"#e3f7b5\",\"opacity\":0.6}",
  "LOOKUP sat=sat-serving key=1 serving=0",
  "LOOKUP sat=sat-serving key=2 serving=0",
  "--- cinema kind=intra phase=holding homepage=true snapshot=hit ---",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"role\":\"triggered\",\"kind\":\"intra\",\"renderKey\":\"cinema-event-intra-from\",\"color\":\"#d70993\",\"opacity\":0.4}",
  "{\"satId\":\"sat-serving\",\"cellId\":1,\"beamId\":2,\"role\":\"triggered\",\"kind\":\"intra\",\"renderKey\":\"cinema-event-intra-to\",\"color\":\"#e3f7b5\",\"opacity\":0.6}",
  "LOOKUP sat=sat-serving key=1 serving=0",
  "LOOKUP sat=sat-candidate key=2 serving=0",
  "--- cinema kind=inter phase=settled homepage=false snapshot=miss ---",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"role\":\"triggered\",\"kind\":\"inter\",\"renderKey\":\"cinema-event-inter-from\",\"color\":\"#bee561\",\"opacity\":0.4}",
  "{\"satId\":\"sat-candidate\",\"cellId\":1,\"beamId\":2,\"role\":\"triggered\",\"kind\":\"inter\",\"renderKey\":\"cinema-event-inter-to\",\"color\":\"#b9d0f4\",\"opacity\":0.8}",
  "LOOKUP sat=sat-serving key=1 serving=0",
  "LOOKUP sat=sat-candidate key=2 serving=0",
  "--- cinema kind=inter phase=settled homepage=false snapshot=hit ---",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"role\":\"triggered\",\"kind\":\"inter\",\"renderKey\":\"cinema-event-inter-from\",\"color\":\"#ff00aa\",\"opacity\":0.4}",
  "{\"satId\":\"sat-candidate\",\"cellId\":1,\"beamId\":2,\"role\":\"triggered\",\"kind\":\"inter\",\"renderKey\":\"cinema-event-inter-to\",\"color\":\"#00ffaa\",\"opacity\":0.8}",
  "LOOKUP sat=sat-serving key=1 serving=0",
  "LOOKUP sat=sat-candidate key=2 serving=0",
  "--- cinema kind=inter phase=settled homepage=true snapshot=miss ---",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"role\":\"triggered\",\"kind\":\"inter\",\"renderKey\":\"cinema-event-inter-from\",\"color\":\"#bee561\",\"opacity\":0.4}",
  "{\"satId\":\"sat-candidate\",\"cellId\":1,\"beamId\":2,\"role\":\"triggered\",\"kind\":\"inter\",\"renderKey\":\"cinema-event-inter-to\",\"color\":\"#b9d0f4\",\"opacity\":0.8}",
  "LOOKUP sat=sat-serving key=1 serving=0",
  "LOOKUP sat=sat-candidate key=2 serving=0",
  "--- cinema kind=inter phase=settled homepage=true snapshot=hit ---",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"role\":\"triggered\",\"kind\":\"inter\",\"renderKey\":\"cinema-event-inter-from\",\"color\":\"#ff00aa\",\"opacity\":0.4}",
  "{\"satId\":\"sat-candidate\",\"cellId\":1,\"beamId\":2,\"role\":\"triggered\",\"kind\":\"inter\",\"renderKey\":\"cinema-event-inter-to\",\"color\":\"#00ffaa\",\"opacity\":0.8}",
  "LOOKUP sat=sat-serving key=1 serving=0",
  "LOOKUP sat=sat-candidate key=2 serving=0",
  "--- cinema kind=inter phase=holding homepage=false snapshot=miss ---",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"role\":\"triggered\",\"kind\":\"inter\",\"renderKey\":\"cinema-event-inter-from\",\"color\":\"#bee561\",\"opacity\":0.4}",
  "{\"satId\":\"sat-candidate\",\"cellId\":1,\"beamId\":2,\"role\":\"triggered\",\"kind\":\"inter\",\"renderKey\":\"cinema-event-inter-to\",\"color\":\"#b9d0f4\",\"opacity\":0.6}",
  "LOOKUP sat=sat-serving key=1 serving=0",
  "LOOKUP sat=sat-candidate key=2 serving=0",
  "--- cinema kind=inter phase=holding homepage=false snapshot=hit ---",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"role\":\"triggered\",\"kind\":\"inter\",\"renderKey\":\"cinema-event-inter-from\",\"color\":\"#ff00aa\",\"opacity\":0.4}",
  "{\"satId\":\"sat-candidate\",\"cellId\":1,\"beamId\":2,\"role\":\"triggered\",\"kind\":\"inter\",\"renderKey\":\"cinema-event-inter-to\",\"color\":\"#00ffaa\",\"opacity\":0.6}",
  "LOOKUP sat=sat-serving key=1 serving=0",
  "LOOKUP sat=sat-candidate key=2 serving=0",
  "--- cinema kind=inter phase=holding homepage=true snapshot=miss ---",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"role\":\"triggered\",\"kind\":\"inter\",\"renderKey\":\"cinema-event-inter-from\",\"color\":\"#bee561\",\"opacity\":0.4}",
  "{\"satId\":\"sat-candidate\",\"cellId\":1,\"beamId\":2,\"role\":\"triggered\",\"kind\":\"inter\",\"renderKey\":\"cinema-event-inter-to\",\"color\":\"#b9d0f4\",\"opacity\":0.6}",
  "LOOKUP sat=sat-serving key=1 serving=0",
  "LOOKUP sat=sat-candidate key=2 serving=0",
  "--- cinema kind=inter phase=holding homepage=true snapshot=hit ---",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"role\":\"triggered\",\"kind\":\"inter\",\"renderKey\":\"cinema-event-inter-from\",\"color\":\"#ff00aa\",\"opacity\":0.4}",
  "{\"satId\":\"sat-candidate\",\"cellId\":1,\"beamId\":2,\"role\":\"triggered\",\"kind\":\"inter\",\"renderKey\":\"cinema-event-inter-to\",\"color\":\"#00ffaa\",\"opacity\":0.6}",
  "LOOKUP sat=sat-serving key=1 serving=1",
  "LOOKUP sat=sat-serving key=2 serving=1",
  "--- authority kind=intra phase=settled homepage=false snapshot=miss ---",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"role\":\"triggered\",\"kind\":\"intra\",\"renderKey\":\"cinema-event-intra-from\",\"color\":\"#aee726\",\"opacity\":0.248}",
  "{\"satId\":\"sat-serving\",\"cellId\":1,\"beamId\":2,\"role\":\"triggered\",\"kind\":\"intra\",\"renderKey\":\"cinema-event-intra-to\",\"color\":\"#e3f7b5\",\"opacity\":0.528}",
  "LOOKUP sat=sat-serving key=1 serving=1",
  "LOOKUP sat=sat-serving key=2 serving=1",
  "--- authority kind=intra phase=settled homepage=false snapshot=hit ---",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"role\":\"triggered\",\"kind\":\"intra\",\"renderKey\":\"cinema-event-intra-from\",\"color\":\"#d70993\",\"opacity\":0.248}",
  "{\"satId\":\"sat-serving\",\"cellId\":1,\"beamId\":2,\"role\":\"triggered\",\"kind\":\"intra\",\"renderKey\":\"cinema-event-intra-to\",\"color\":\"#e3f7b5\",\"opacity\":0.528}",
  "LOOKUP sat=sat-serving key=1 serving=1",
  "LOOKUP sat=sat-serving key=2 serving=1",
  "--- authority kind=intra phase=settled homepage=true snapshot=miss ---",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"role\":\"triggered\",\"kind\":\"intra\",\"renderKey\":\"cinema-event-intra-from\",\"color\":\"#aee726\",\"opacity\":0.248}",
  "{\"satId\":\"sat-serving\",\"cellId\":1,\"beamId\":2,\"role\":\"triggered\",\"kind\":\"intra\",\"renderKey\":\"cinema-event-intra-to\",\"color\":\"#e3f7b5\",\"opacity\":0.528}",
  "LOOKUP sat=sat-serving key=1 serving=1",
  "LOOKUP sat=sat-serving key=2 serving=1",
  "--- authority kind=intra phase=settled homepage=true snapshot=hit ---",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"role\":\"triggered\",\"kind\":\"intra\",\"renderKey\":\"cinema-event-intra-from\",\"color\":\"#d70993\",\"opacity\":0.248}",
  "{\"satId\":\"sat-serving\",\"cellId\":1,\"beamId\":2,\"role\":\"triggered\",\"kind\":\"intra\",\"renderKey\":\"cinema-event-intra-to\",\"color\":\"#e3f7b5\",\"opacity\":0.528}",
  "LOOKUP sat=sat-serving key=1 serving=1",
  "LOOKUP sat=sat-serving key=2 serving=1",
  "--- authority kind=intra phase=holding homepage=false snapshot=miss ---",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"role\":\"triggered\",\"kind\":\"intra\",\"renderKey\":\"cinema-event-intra-from\",\"color\":\"#aee726\",\"opacity\":0.248}",
  "{\"satId\":\"sat-serving\",\"cellId\":1,\"beamId\":2,\"role\":\"triggered\",\"kind\":\"intra\",\"renderKey\":\"cinema-event-intra-to\",\"color\":\"#e3f7b5\",\"opacity\":0.528}",
  "LOOKUP sat=sat-serving key=1 serving=1",
  "LOOKUP sat=sat-serving key=2 serving=1",
  "--- authority kind=intra phase=holding homepage=false snapshot=hit ---",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"role\":\"triggered\",\"kind\":\"intra\",\"renderKey\":\"cinema-event-intra-from\",\"color\":\"#d70993\",\"opacity\":0.248}",
  "{\"satId\":\"sat-serving\",\"cellId\":1,\"beamId\":2,\"role\":\"triggered\",\"kind\":\"intra\",\"renderKey\":\"cinema-event-intra-to\",\"color\":\"#e3f7b5\",\"opacity\":0.528}",
  "LOOKUP sat=sat-serving key=1 serving=1",
  "LOOKUP sat=sat-serving key=2 serving=1",
  "--- authority kind=intra phase=holding homepage=true snapshot=miss ---",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"role\":\"triggered\",\"kind\":\"intra\",\"renderKey\":\"cinema-event-intra-from\",\"color\":\"#aee726\",\"opacity\":0.248}",
  "{\"satId\":\"sat-serving\",\"cellId\":1,\"beamId\":2,\"role\":\"triggered\",\"kind\":\"intra\",\"renderKey\":\"cinema-event-intra-to\",\"color\":\"#e3f7b5\",\"opacity\":0.528}",
  "LOOKUP sat=sat-serving key=1 serving=1",
  "LOOKUP sat=sat-serving key=2 serving=1",
  "--- authority kind=intra phase=holding homepage=true snapshot=hit ---",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"role\":\"triggered\",\"kind\":\"intra\",\"renderKey\":\"cinema-event-intra-from\",\"color\":\"#d70993\",\"opacity\":0.248}",
  "{\"satId\":\"sat-serving\",\"cellId\":1,\"beamId\":2,\"role\":\"triggered\",\"kind\":\"intra\",\"renderKey\":\"cinema-event-intra-to\",\"color\":\"#e3f7b5\",\"opacity\":0.528}",
  "LOOKUP sat=sat-serving key=1 serving=0",
  "LOOKUP sat=sat-candidate key=2 serving=0",
  "--- authority kind=inter phase=settled homepage=false snapshot=miss ---",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"role\":\"triggered\",\"kind\":\"inter\",\"renderKey\":\"cinema-event-inter-from\",\"color\":\"#bee561\",\"opacity\":0.248}",
  "{\"satId\":\"sat-candidate\",\"cellId\":1,\"beamId\":2,\"role\":\"triggered\",\"kind\":\"inter\",\"renderKey\":\"cinema-event-inter-to\",\"color\":\"#b9d0f4\",\"opacity\":0.528}",
  "LOOKUP sat=sat-serving key=1 serving=0",
  "LOOKUP sat=sat-candidate key=2 serving=0",
  "--- authority kind=inter phase=settled homepage=false snapshot=hit ---",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"role\":\"triggered\",\"kind\":\"inter\",\"renderKey\":\"cinema-event-inter-from\",\"color\":\"#ff00aa\",\"opacity\":0.248}",
  "{\"satId\":\"sat-candidate\",\"cellId\":1,\"beamId\":2,\"role\":\"triggered\",\"kind\":\"inter\",\"renderKey\":\"cinema-event-inter-to\",\"color\":\"#00ffaa\",\"opacity\":0.528}",
  "LOOKUP sat=sat-serving key=1 serving=0",
  "LOOKUP sat=sat-candidate key=2 serving=0",
  "--- authority kind=inter phase=settled homepage=true snapshot=miss ---",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"role\":\"triggered\",\"kind\":\"inter\",\"renderKey\":\"cinema-event-inter-from\",\"color\":\"#bee561\",\"opacity\":0.248}",
  "{\"satId\":\"sat-candidate\",\"cellId\":1,\"beamId\":2,\"role\":\"triggered\",\"kind\":\"inter\",\"renderKey\":\"cinema-event-inter-to\",\"color\":\"#b9d0f4\",\"opacity\":0.528}",
  "LOOKUP sat=sat-serving key=1 serving=0",
  "LOOKUP sat=sat-candidate key=2 serving=0",
  "--- authority kind=inter phase=settled homepage=true snapshot=hit ---",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"role\":\"triggered\",\"kind\":\"inter\",\"renderKey\":\"cinema-event-inter-from\",\"color\":\"#ff00aa\",\"opacity\":0.248}",
  "{\"satId\":\"sat-candidate\",\"cellId\":1,\"beamId\":2,\"role\":\"triggered\",\"kind\":\"inter\",\"renderKey\":\"cinema-event-inter-to\",\"color\":\"#00ffaa\",\"opacity\":0.528}",
  "LOOKUP sat=sat-serving key=1 serving=0",
  "LOOKUP sat=sat-candidate key=2 serving=0",
  "--- authority kind=inter phase=holding homepage=false snapshot=miss ---",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"role\":\"triggered\",\"kind\":\"inter\",\"renderKey\":\"cinema-event-inter-from\",\"color\":\"#bee561\",\"opacity\":0.248}",
  "{\"satId\":\"sat-candidate\",\"cellId\":1,\"beamId\":2,\"role\":\"triggered\",\"kind\":\"inter\",\"renderKey\":\"cinema-event-inter-to\",\"color\":\"#b9d0f4\",\"opacity\":0.528}",
  "LOOKUP sat=sat-serving key=1 serving=0",
  "LOOKUP sat=sat-candidate key=2 serving=0",
  "--- authority kind=inter phase=holding homepage=false snapshot=hit ---",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"role\":\"triggered\",\"kind\":\"inter\",\"renderKey\":\"cinema-event-inter-from\",\"color\":\"#ff00aa\",\"opacity\":0.248}",
  "{\"satId\":\"sat-candidate\",\"cellId\":1,\"beamId\":2,\"role\":\"triggered\",\"kind\":\"inter\",\"renderKey\":\"cinema-event-inter-to\",\"color\":\"#00ffaa\",\"opacity\":0.528}",
  "LOOKUP sat=sat-serving key=1 serving=0",
  "LOOKUP sat=sat-candidate key=2 serving=0",
  "--- authority kind=inter phase=holding homepage=true snapshot=miss ---",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"role\":\"triggered\",\"kind\":\"inter\",\"renderKey\":\"cinema-event-inter-from\",\"color\":\"#bee561\",\"opacity\":0.248}",
  "{\"satId\":\"sat-candidate\",\"cellId\":1,\"beamId\":2,\"role\":\"triggered\",\"kind\":\"inter\",\"renderKey\":\"cinema-event-inter-to\",\"color\":\"#b9d0f4\",\"opacity\":0.528}",
  "LOOKUP sat=sat-serving key=1 serving=0",
  "LOOKUP sat=sat-candidate key=2 serving=0",
  "--- authority kind=inter phase=holding homepage=true snapshot=hit ---",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"role\":\"triggered\",\"kind\":\"inter\",\"renderKey\":\"cinema-event-inter-from\",\"color\":\"#ff00aa\",\"opacity\":0.248}",
  "{\"satId\":\"sat-candidate\",\"cellId\":1,\"beamId\":2,\"role\":\"triggered\",\"kind\":\"inter\",\"renderKey\":\"cinema-event-inter-to\",\"color\":\"#00ffaa\",\"opacity\":0.528}",
  "--- authority committed-inter settled beamColorMap ---",
  "{\"satId\":\"sat-candidate\",\"cellId\":1,\"beamId\":2,\"role\":\"triggered\",\"kind\":\"inter\",\"renderKey\":\"cinema-event-inter-to\",\"color\":\"#222222\",\"opacity\":0.528}",
  "--- non-serving homepage=false snapshot=miss ---",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"color\":\"#bee561\"}",
  "{\"satId\":\"sat-candidate\",\"cellId\":1,\"beamId\":2,\"color\":\"#b9d0f4\"}",
  "--- non-serving homepage=false snapshot=hit ---",
  "{\"satId\":\"sat-serving\",\"cellId\":0,\"beamId\":1,\"color\":\"#ff00aa\"}",
  "{\"satId\":\"sat-candidate\",\"cellId\":1,\"beamId\":2,\"color\":\"#00ffaa\"}",
  "--- non-serving homepage=true snapshot=miss ---",
  "--- non-serving homepage=true snapshot=hit ---",
  "--- cinema-inter-serving-fan homepage=false snapshot=miss ---",
  "{\"satId\":\"sat-serving\",\"cellId\":1,\"beamId\":2,\"role\":\"servingFan\",\"renderKey\":\"cinema-event-inter-from-fan-1-2\",\"color\":\"#cceb84\",\"opacity\":0.2}",
  "--- cinema-inter-serving-fan homepage=false snapshot=hit ---",
  "{\"satId\":\"sat-serving\",\"cellId\":1,\"beamId\":2,\"role\":\"servingFan\",\"renderKey\":\"cinema-event-inter-from-fan-1-2\",\"color\":\"#cceb84\",\"opacity\":0.2}",
  "--- cinema-inter-serving-fan homepage=true snapshot=miss ---",
  "--- cinema-inter-serving-fan homepage=true snapshot=hit ---"
];

test('cone painters produce exactly the appearance recorded before the convergence', () => {
  assert.deepEqual(observed, EXPECTED);
});


/**
 * THE INVARIANT the whole convergence exists to establish.
 *
 * One beam, in one handover situation, must have ONE colour — no matter which
 * lane happens to draw it. Before this pass that was false and provably so: the
 * same (sat-serving, cellId 0, beamId 1) intra source rendered `#aee726` in the
 * pulse lane and `#a1dd17` in the triggered and cinema lanes, because those
 * lanes derived their fallback colour from the CELL id while using the BEAM id
 * as the lookup key.
 *
 * The census found no test anywhere in the repo asserting that one satellite
 * gets one colour across two surfaces, and `validate:beam:colour-match` cannot
 * supply it: that validator joins on `${satId}:${cellId}` only
 * (scripts/validate-beam-colour-match.ts:144), so a beam-id-keyed divergence is
 * structurally invisible to it.
 *
 * This test is deliberately NOT a photograph. The rows above pin what the code
 * does; this pins what it must never stop doing. If a future change makes one
 * beam two colours again, this fails with the two colours named, whereas the
 * photograph would only say "something moved".
 */
test('one beam in one situation has one colour, whichever lane draws it', () => {
  interface Row { lane: string; key: string; color: string }
  const rows: Row[] = [];
  let lane = '';
  for (const line of observed) {
    const label = /^--- (.+) ---$/.exec(line);
    if (label !== null) { lane = label[1]!; continue; }
    if (line.startsWith('LOOKUP')) continue;
    const item = JSON.parse(line) as {
      satId: string; cellId: number; beamId?: number;
      role?: string; kind?: string; renderKey?: string; color: string;
    };
    // The situation, not the lane, is what may legitimately change a colour:
    // who the beam is, what kind of handover it is in, and which side it is on.
    //
    // The side MUST come from `resolveHandoverSide` — the same resolver
    // production uses — and not from `role` alone. Deriving it from `role` was
    // this test's first version, and it was a false green: the pulse lane names
    // its sides in `role` while the cinema and authority lanes name theirs in
    // `renderKey` and stamp `role: 'triggered'`, so role-only grouping put the
    // two lanes in different buckets and compared them to nothing. The test
    // passed identically before and after the divergence was fixed, which is
    // the exact shape of measurement failure this codebase keeps repeating: a
    // query that quietly matches nothing, read as evidence of agreement.
    const side = resolveHandoverSide(item) ?? (item.role ?? 'none');
    rows.push({
      lane,
      key: `${item.satId}|cell${item.cellId}|beam${item.beamId ?? 'none'}|${item.kind ?? 'steady'}|${side}`,
      color: item.color,
    });
  }

  // Only compare lanes that share an identity-lookup outcome: a `snapshot=hit`
  // row legitimately differs from a `snapshot=miss` row, and the homepage flag
  // legitimately selects a different identity source. Grouping across those
  // would manufacture a failure that is not a divergence.
  const groups = new Map<string, Map<string, string[]>>();
  for (const row of rows) {
    const snapshot = row.lane.includes('snapshot=hit') ? 'hit' : 'miss';
    const homepage = row.lane.includes('homepage=true') ? 'home' : 'main';
    // A lane handed an explicit `beamColorBySatelliteBeam` entry is being told
    // the colour by the accepted comparison plan, which outranks every derived
    // source. That is a different identity input, not a divergence, and must be
    // bucketed apart for the same reason `snapshot=hit` is.
    const override = row.lane.includes('beamColorMap') ? 'override' : 'derived';
    const bucket = `${snapshot}/${homepage}/${override}/${row.key}`;
    const byColor = groups.get(bucket) ?? new Map<string, string[]>();
    byColor.set(row.color, [...(byColor.get(row.color) ?? []), row.lane]);
    groups.set(bucket, byColor);
  }

  const divergences: string[] = [];
  for (const [bucket, byColor] of groups) {
    if (byColor.size > 1) {
      const detail = [...byColor.entries()]
        .map(([color, lanes]) => `${color} (${lanes.join(', ')})`)
        .join('  vs  ');
      divergences.push(`${bucket}\n      ${detail}`);
    }
  }

  assert.deepEqual(
    divergences,
    [],
    `the same beam is rendered in more than one colour:\n  ${divergences.join('\n  ')}`,
  );
});

// These timing-immune checks stop at the identity-authority path. They do not
// assert that every rendered cone equals colorForServingBeam: semantic-role
// surfaces and accepted/homepage presentation projections deliberately apply
// their own display treatment downstream.
test('a valid resolved beam identity maps to its canonical identity colour', () => {
  const identity = { satId: 'sat-serving', cellId: 0, beamId: 1 };
  const beamId = resolvedBeamId(identity, cellId => cellId + 1);

  assert.equal(
    resolveBaseIdentityColor(identity.satId, beamId, makeIdentitySources({
      plan: null,
      homepageProjection: null,
      acceptedSnapshot: null,
    })),
    '#bee561',
  );
});

test('the same (satellite, beam) resolves to ONE colour across the identity-authority surfaces', () => {
  const satelliteId = 'sat-serving';
  const beamId = 1;
  const surfaceColours = [
    colorForServingBeam(satelliteId, beamId).markerColor,
    mosaicColorForServingBeam(satelliteId, beamId).markerColor,
    resolveBaseIdentityColor(satelliteId, beamId, makeIdentitySources({
      plan: null,
      homepageProjection: null,
      acceptedSnapshot: null,
    })),
  ];

  assert.equal(new Set(surfaceColours).size, 1, `identity surfaces diverged: ${surfaceColours.join(' vs ')}`);
});

test('the published evaluation rail and scene agree for the same (satellite, beam)', () => {
  // CandidatePresentationPlan is the authority for the full evaluation rail:
  // CandidateSetPanel publishes link.beamIdentity.cssColor, and the scene
  // consumes the same plan through buildMultiCandidateScenePresentation.
  // This deliberately excludes HomepageBeamRail: its homepage-only
  // homepageSatelliteColorForBeam projection remaps compact-family hues and
  // is allowed to differ from this non-homepage shared-plan surface.
  const decision: HandoverDecisionFrame = {
    episodeId: 'appearance-characterization-rail',
    sourceFrameId: 'appearance-characterization-frame',
    simTimeMs: 0,
    phase: 'monitoring',
    serving: { satelliteId: 'sat-serving', beamId: 1 },
    opportunities: [],
    states: [],
    provisionalLeader: null,
    selectedTarget: null,
    selectedKind: null,
    selectionHoldSec: 0,
    selectionHoldRequiredSec: 1,
    mode: 'sinr-offset',
    recentCommit: null,
  };
  const plan = buildCandidatePresentationPlan(decision);
  const scene = buildMultiCandidateScenePresentation(plan);
  const railLink = plan.displayedLinks.find(link => (
    link.satelliteId === decision.serving?.satelliteId
    && link.beamId === decision.serving?.beamId
  ));
  const sceneInstruction = scene.instructions.find(instruction => (
    instruction.satelliteId === decision.serving?.satelliteId
    && instruction.beamId === decision.serving?.beamId
  ));

  assert.ok(railLink?.beamIdentity, 'the published rail link must carry beam identity');
  assert.ok(sceneInstruction?.identity.beam, 'the scene instruction must carry beam identity');
  assert.equal(
    railLink.beamIdentity.cssColor,
    sceneInstruction.identity.beam.cssColor,
    'the same published satellite/beam identity must not diverge between rail and scene',
  );
});

test('a VALID identity never resolves to the neutral fallback HANDOVER_VISUAL_IDENTITY_NEUTRAL_FALLBACK_COLOR', () => {
  // This checks only the pure identity resolver. Cone mount role colours are
  // intentionally outside this invariant because they are semantic-role
  // presentation, not identity authority.
  const resolvedColour = resolveBaseIdentityColor('sat-serving', 1, makeIdentitySources({
    plan: null,
    homepageProjection: null,
    acceptedSnapshot: null,
  }));

  assert.notEqual(resolvedColour, HANDOVER_VISUAL_IDENTITY_NEUTRAL_FALLBACK_COLOR);
});

/**
 * Closes a blind spot the convergence itself opened.
 *
 * The photograph above only pins the lightness rungs its fixtures happen to
 * reach. Moving every lane off the cell id and onto the beam id moved all of
 * them to rungs >= 1, so rung 0 stopped being exercised — and a real edit to it
 * (0.56 -> 0.57) was verified to leave the whole file GREEN. A net with a hole
 * in it is worse than a known-absent net, because it is trusted.
 *
 * So the ladder is pinned here directly, every rung, independent of which rungs
 * the cone fixtures wander onto. These literals were read off the running code,
 * not recomputed from it.
 */
test('every rung of the identity lightness ladder is pinned', () => {
  const rungs = [0, 1, 2, 3, 4, 5, 6, 7]
    .map(beamId => colorForServingBeam('sat-serving', beamId).markerColor);
  assert.deepEqual(rungs, [
    '#afe03e', '#bee561', '#cceb84', '#dbf1a7',
    '#e7f6c6', '#f0f9dc', '#f8fced', '#fdfefb',
  ]);

  // Same for a blue/violet identity, which uses the separate lifted ladder —
  // a rung table the cone fixtures never touch at all.
  const lifted = [0, 1, 2, 3]
    .map(beamId => colorForServingBeam('shell-a-P0-S3', beamId).markerColor);
  assert.deepEqual(lifted, ['#84adeb', '#9fbfef', '#b9d0f4', '#cfdff7']);
});
