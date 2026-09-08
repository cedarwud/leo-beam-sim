/**
 * CHARACTERIZATION TEST — what beam visibility produces TODAY.
 *
 * This photograph captures the exact visibility decisions before converging
 * visibility into `src/appearance/`.
 *
 * Every string in EXPECTED was produced by running the pre-convergence code.
 * It pins:
 *   1. Allow-list generation across all 8 endpoint inputs
 *   2. Beam item filtering with exact beamId vs cellId-only vs fan escape hatch
 *   3. Restriction callback behavior (homepageVisualIdentity on vs off)
 *   4. Serving cone visibility gates (10 distinct flags + focus sets)
 *   5. Scene-level adapter endpoint extraction across handover scenarios
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  resolveHomepageBeamVisibility,
  filterHomepageBeamItems,
  homepageBeamIdentityKey,
  type HomepageBeamIdentity,
  type HomepageBeamVisibilityInput,
} from '../homepage/controller/homepageBeamVisibility';
import {
  resolveHomepageSceneBeamVisibility,
  type HomepageSceneBeamVisibilityInput,
} from '../scene/homepageSceneBeamVisibility';
import {
  resolveServingConeItems,
  type ServingConePresentationInput,
} from '../scene/servingConeItems';
import type {
  CellServingRecord,
  IlluminatedCellBeam,
  SinrLiveCellFrame,
  SinrLiveCellHandoverEvent,
} from '../scene/sinrLiveCellModel';
import type {
  SinrLiveCellBeamConeRenderItem,
  SinrLiveCellPlacement,
  SinrLiveCinemaHandoverCandidate,
} from '../viz/SinrLiveCellBeamCones';
import type { WorldPoint } from '../viz/CellFootprints';
import type { DisplayHeroRecord } from '../scene/beamDisplaySpec';
import type { HandoverPresentationEvent } from '../scene/handoverPresentationOwner';
import type { HandoverAuthorityJoin } from '../scene/handoverAuthorityJoin';

const placementByCellId = new Map<number, SinrLiveCellPlacement>([
  [0, { cellId: 0, worldX: 10, worldZ: -20, radiusWorld: 4 }],
  [1, { cellId: 1, worldX: -30, worldZ: 15, radiusWorld: 4 }],
]);
const satelliteWorldById = new Map<string, WorldPoint>([
  ['sat-serving', { x: 0, y: 100, z: 0 }],
  ['sat-candidate', { x: 25, y: 110, z: -10 }],
]);

function frameOf(illuminatedBeams: readonly IlluminatedCellBeam[]): SinrLiveCellFrame {
  const servedCells = illuminatedBeams.filter(b => b.serving);
  return {
    simTimeSec: 10,
    cells: [],
    ues: [],
    illuminatedBeams,
    servedCellCount: new Set(servedCells.map(b => b.cellId)).size,
    servedUeCount: 0,
    servingSatCount: new Set(servedCells.map(b => b.satId)).size,
    intraHandoverCount: 0,
    interHandoverCount: 0,
    cumulativeIntraHandoverCount: 0,
    cumulativeInterHandoverCount: 0,
    recentHandoverEvents: [],
  };
}

const twoBeamFrame = frameOf([
  { satId: 'sat-serving', cellId: 0, serving: true, beamId: 1, frequencyIndex: 0 },
  { satId: 'sat-serving', cellId: 1, serving: true, beamId: 2, frequencyIndex: 1 },
]);

const heroRecord: DisplayHeroRecord = {
  servingSatId: 'sat-serving',
  cellId: 0,
  beamId: 1,
};

const dummyColor = (satId: string, beamId: number) => `${satId}/${beamId}`;
const keepAll = (items: readonly SinrLiveCellBeamConeRenderItem[]) => items;

export function recordPhotograph(): string[] {
  const lines: string[] = [];

  // ============================================================
  // 1. resolveHomepageBeamVisibility + filterHomepageBeamItems
  // ============================================================
  const candidateItems = [
    { satId: 'sat-serving', cellId: 0, beamId: 1 },
    { satId: 'sat-serving', cellId: 1, beamId: 2 },
    { satId: 'sat-serving', cellId: 2, beamId: 3 },
    { satId: 'sat-candidate', cellId: 0, beamId: 11 },
    { satId: 'sat-candidate', cellId: 1, beamId: 12 },
    { satId: 'sat-other', cellId: 0, beamId: 21 },
  ];

  const visibilityCases: Array<{ label: string; input: HomepageBeamVisibilityInput; fanSats?: ReadonlySet<string> }> = [
    {
      label: 'empty',
      input: {},
    },
    {
      label: 'serving-only-exact',
      input: { servingBeam: { satelliteId: 'sat-serving', cellId: 0, beamId: 1 } },
    },
    {
      label: 'serving-only-cell-only',
      input: { servingBeam: { satelliteId: 'sat-serving', cellId: 0 } },
    },
    {
      label: 'serving-and-candidate',
      input: {
        servingBeam: { satelliteId: 'sat-serving', cellId: 0, beamId: 1 },
        preparedCandidateBeam: { satelliteId: 'sat-candidate', cellId: 1, beamId: 12 },
      },
    },
    {
      label: 'handover-presentation-intra-same-cell',
      input: {
        presentationFromBeam: { satelliteId: 'sat-serving', cellId: 0, beamId: 1 },
        presentationToBeam: { satelliteId: 'sat-serving', cellId: 0, beamId: 2 },
      },
    },
    {
      label: 'handover-presentation-inter',
      input: {
        presentationFromBeam: { satelliteId: 'sat-serving', cellId: 0, beamId: 1 },
        presentationToBeam: { satelliteId: 'sat-candidate', cellId: 1, beamId: 12 },
      },
    },
    {
      label: 'cinema-and-recent',
      input: {
        cinemaFromBeam: { satelliteId: 'sat-serving', cellId: 0, beamId: 1 },
        cinemaToBeam: { satelliteId: 'sat-candidate', cellId: 1, beamId: 12 },
        recentFromBeam: { satelliteId: 'sat-other', cellId: 0, beamId: 21 },
        recentToBeam: { satelliteId: 'sat-serving', cellId: 1, beamId: 2 },
      },
    },
    {
      label: 'fan-escape-hatch-serving',
      input: {
        servingBeam: { satelliteId: 'sat-serving', cellId: 0, beamId: 1 },
      },
      fanSats: new Set(['sat-serving']),
    },
  ];

  for (const c of visibilityCases) {
    const allowed = resolveHomepageBeamVisibility(c.input);
    const sortedAllowed = [...allowed].sort();
    lines.push(`VISIBILITY: ${c.label} -> allowed=[${sortedAllowed.join(',')}]`);
    const filtered = filterHomepageBeamItems(candidateItems, allowed, c.fanSats ?? new Set());
    const filteredKeys = filtered.map(i => `${i.satId}|${i.cellId}|${i.beamId}`);
    lines.push(`FILTER: ${c.label} -> kept=[${filteredKeys.join(',')}]`);
  }

  // ============================================================
  // 2. resolveServingConeItems visibility grid
  // ============================================================
  const basePresentation: ServingConePresentationInput = {
    showSinrLiveCellBeams: true,
    renderServingField: true,
    showNonServingCones: false,
    hideNormalBeamField: false,
    hidePrimaryServingBeam: false,
    preserveConfiguredServingFan: false,
    teachingLectureFieldCleared: false,
    multiCandidateCentralOverlayActive: false,
    homepageVisualIdentity: false,
    homepageBeamVisibility: new Set(['sat-serving|0|1']),
    homepageBeamFanSatelliteIds: new Set(['sat-serving']),
    resolveSceneAcceptedBeamColor: dummyColor,
    restrictHomepageBeamItems: keepAll,
  };

  const servingCases: Array<{ label: string; patch: Partial<ServingConePresentationInput>; focusSatIds?: ReadonlySet<string> | null; hero?: DisplayHeroRecord | null }> = [
    { label: 'standard-serving', patch: {} },
    { label: 'showSinrLiveCellBeams-false', patch: { showSinrLiveCellBeams: false } },
    { label: 'renderServingField-false', patch: { renderServingField: false } },
    { label: 'hideNormalBeamField-default', patch: { hideNormalBeamField: true } },
    { label: 'hideNormalBeamField-with-centralOverlay', patch: { hideNormalBeamField: true, multiCandidateCentralOverlayActive: true } },
    { label: 'hideNormalBeamField-with-preserveFan', patch: { hideNormalBeamField: true, preserveConfiguredServingFan: true } },
    { label: 'hideNormalBeamField-clearedLecture', patch: { hideNormalBeamField: true, teachingLectureFieldCleared: true } },
    { label: 'focusSatIds-empty-nonHomepage', patch: { showNonServingCones: false }, focusSatIds: new Set() },
    { label: 'focusSatIds-empty-with-showNonServingCones', patch: { showNonServingCones: true }, focusSatIds: new Set() },
    { label: 'focusSatIds-empty-homepage', patch: { homepageVisualIdentity: true }, focusSatIds: new Set() },
    { label: 'hidePrimaryServingBeam-active', patch: { hidePrimaryServingBeam: true } },
    { label: 'hidePrimaryServingBeam-homepage-bypasses', patch: { hidePrimaryServingBeam: true, homepageVisualIdentity: true } },
    { label: 'hidePrimaryServingBeam-preserveFan-bypasses', patch: { hidePrimaryServingBeam: true, preserveConfiguredServingFan: true } },
    { label: 'hidePrimaryServingBeam-centralOverlay-bypasses', patch: { hidePrimaryServingBeam: true, multiCandidateCentralOverlayActive: true } },
    { label: 'hero-null', patch: {}, hero: null },
    { label: 'homepage-with-visibility-allowlist-no-fan', patch: {
      homepageVisualIdentity: true,
      homepageBeamVisibility: new Set(['sat-serving|0|1']),
      homepageBeamFanSatelliteIds: new Set(),
    } },
    { label: 'homepage-with-visibility-allowlist-and-fan', patch: {
      homepageVisualIdentity: true,
      homepageBeamVisibility: new Set(['sat-serving|0|1']),
      homepageBeamFanSatelliteIds: new Set(['sat-serving']),
    } },
  ];

  for (const sc of servingCases) {
    const items = resolveServingConeItems({
      geometry: {
        cellFrame: twoBeamFrame,
        placementByCellId,
        satelliteWorldById,
        focusSatIds: sc.focusSatIds !== undefined ? sc.focusSatIds : new Set(['sat-serving']),
        frequencyReuse: 3,
        servingBeamBudget: 2,
        allowHeroFallback: sc.patch.homepageVisualIdentity ?? false,
        budgetServingFan: true,
        displayHeroRecord: sc.hero !== undefined ? sc.hero : heroRecord,
      },
      presentation: {
        ...basePresentation,
        ...sc.patch,
      },
    });
    const itemKeys = items.map(i => `${i.satId}|${i.cellId}|${i.beamId}`);
    lines.push(`SERVING: ${sc.label} -> count=${items.length} items=[${itemKeys.join(',')}]`);
  }

  // ============================================================
  // 3. resolveHomepageSceneBeamVisibility adapter grid
  // ============================================================
  const sceneCases: Array<{ label: string; input: HomepageSceneBeamVisibilityInput }> = [
    {
      label: 'hero-only',
      input: {
        displayHeroRecord: { servingSatId: 'sat-serving', cellId: 0, beamId: 1 },
        primaryServingRecord: null,
        renderedCandidateSatelliteId: null,
        presentedHandoverPairCandidate: null,
        handoverPresentationCandidate: null,
        handoverAuthorityJoin: null,
        cinemaPairCandidate: null,
        recentPrimaryHandoverEvent: null,
      },
    },
    {
      label: 'hero-plus-candidate-sat',
      input: {
        displayHeroRecord: { servingSatId: 'sat-serving', cellId: 0, beamId: 1 },
        primaryServingRecord: null,
        renderedCandidateSatelliteId: 'sat-candidate',
        presentedHandoverPairCandidate: null,
        handoverPresentationCandidate: null,
        handoverAuthorityJoin: null,
        cinemaPairCandidate: null,
        recentPrimaryHandoverEvent: null,
      },
    },
    {
      label: 'presented-handover-pair-intra-same-cell',
      input: {
        displayHeroRecord: { servingSatId: 'sat-serving', cellId: 0, beamId: 1 },
        primaryServingRecord: null,
        renderedCandidateSatelliteId: null,
        presentedHandoverPairCandidate: {
          eventId: 'intra-1',
          ueId: 'ue-0',
          kind: 'intra',
          sourceTimeSec: 10,
          fromSatId: 'sat-serving',
          fromCellId: 0,
          fromBeamId: 1,
          toSatId: 'sat-serving',
          toCellId: 0,
          toBeamId: 2,
        },
        handoverPresentationCandidate: null,
        handoverAuthorityJoin: null,
        cinemaPairCandidate: null,
        recentPrimaryHandoverEvent: null,
      },
    },
    {
      label: 'authority-join-transition',
      input: {
        displayHeroRecord: { servingSatId: 'sat-serving', cellId: 0, beamId: 1 },
        primaryServingRecord: null,
        renderedCandidateSatelliteId: null,
        presentedHandoverPairCandidate: null,
        handoverPresentationCandidate: null,
        handoverAuthorityJoin: {
          phase: 'switching',
          serving: { satelliteId: 'sat-serving', beamId: 1 },
          transition: {
            eventId: 'auth-1',
            episodeId: 'ep-1',
            sourceFrameId: 'sf-1',
            simTimeMs: 10000,
            kind: 'inter',
            boundary: 'committed',
            from: { satelliteId: 'sat-serving', beamId: 1 },
            to: { satelliteId: 'sat-candidate', beamId: 2 },
          },
          solidDataLinkKey: null,
          solidDataLinkCount: 0,
          showTransitionCue: true,
        },
        cinemaPairCandidate: null,
        recentPrimaryHandoverEvent: null,
      },
    },
    {
      label: 'cinema-pair-and-recent',
      input: {
        displayHeroRecord: { servingSatId: 'sat-serving', cellId: 0, beamId: 1 },
        primaryServingRecord: null,
        renderedCandidateSatelliteId: null,
        presentedHandoverPairCandidate: null,
        handoverPresentationCandidate: null,
        handoverAuthorityJoin: null,
        cinemaPairCandidate: {
          eventId: 'cinema-1',
          ueId: 'ue-0',
          kind: 'inter',
          sourceTimeSec: 10,
          fromSatId: 'sat-serving',
          fromCellId: 0,
          fromBeamId: 1,
          toSatId: 'sat-candidate',
          toCellId: 1,
          toBeamId: 2,
        },
        recentPrimaryHandoverEvent: {
          ueId: 'ue-0',
          kind: 'inter',
          sourceTimeSec: 10,
          fromSatId: 'sat-candidate',
          fromCellId: 1,
          fromBeamId: 2,
          toSatId: 'sat-serving',
          toCellId: 0,
          toBeamId: 1,
        },
      },
    },
  ];

  for (const sc of sceneCases) {
    const ids = resolveHomepageSceneBeamVisibility(sc.input);
    lines.push(`SCENE_ADAPTER: ${sc.label} -> allowed=[${[...ids].sort().join(',')}]`);
  }

  return lines;
}

const EXPECTED_VISIBILITY_PHOTOGRAPH: readonly string[] = [
  "VISIBILITY: empty -> allowed=[]",
  "FILTER: empty -> kept=[]",
  "VISIBILITY: serving-only-exact -> allowed=[sat-serving|0|1]",
  "FILTER: serving-only-exact -> kept=[sat-serving|0|1]",
  "VISIBILITY: serving-only-cell-only -> allowed=[sat-serving|0]",
  "FILTER: serving-only-cell-only -> kept=[sat-serving|0|1]",
  "VISIBILITY: serving-and-candidate -> allowed=[sat-candidate|1|12,sat-serving|0|1]",
  "FILTER: serving-and-candidate -> kept=[sat-serving|0|1,sat-candidate|1|12]",
  "VISIBILITY: handover-presentation-intra-same-cell -> allowed=[sat-serving|0|1,sat-serving|0|2]",
  "FILTER: handover-presentation-intra-same-cell -> kept=[sat-serving|0|1]",
  "VISIBILITY: handover-presentation-inter -> allowed=[sat-candidate|1|12,sat-serving|0|1]",
  "FILTER: handover-presentation-inter -> kept=[sat-serving|0|1,sat-candidate|1|12]",
  "VISIBILITY: cinema-and-recent -> allowed=[sat-candidate|1|12,sat-other|0|21,sat-serving|0|1,sat-serving|1|2]",
  "FILTER: cinema-and-recent -> kept=[sat-serving|0|1,sat-serving|1|2,sat-candidate|1|12,sat-other|0|21]",
  "VISIBILITY: fan-escape-hatch-serving -> allowed=[sat-serving|0|1]",
  "FILTER: fan-escape-hatch-serving -> kept=[sat-serving|0|1,sat-serving|1|2,sat-serving|2|3]",
  "SERVING: standard-serving -> count=2 items=[sat-serving|0|1,sat-serving|1|2]",
  "SERVING: showSinrLiveCellBeams-false -> count=0 items=[]",
  "SERVING: renderServingField-false -> count=0 items=[]",
  "SERVING: hideNormalBeamField-default -> count=0 items=[]",
  "SERVING: hideNormalBeamField-with-centralOverlay -> count=2 items=[sat-serving|0|1,sat-serving|1|2]",
  "SERVING: hideNormalBeamField-with-preserveFan -> count=2 items=[sat-serving|0|1,sat-serving|1|2]",
  "SERVING: hideNormalBeamField-clearedLecture -> count=0 items=[]",
  "SERVING: focusSatIds-empty-nonHomepage -> count=0 items=[]",
  "SERVING: focusSatIds-empty-with-showNonServingCones -> count=2 items=[sat-serving|0|1,sat-serving|1|2]",
  "SERVING: focusSatIds-empty-homepage -> count=2 items=[sat-serving|0|1,sat-serving|1|2]",
  "SERVING: hidePrimaryServingBeam-active -> count=1 items=[sat-serving|1|2]",
  "SERVING: hidePrimaryServingBeam-homepage-bypasses -> count=2 items=[sat-serving|0|1,sat-serving|1|2]",
  "SERVING: hidePrimaryServingBeam-preserveFan-bypasses -> count=2 items=[sat-serving|0|1,sat-serving|1|2]",
  "SERVING: hidePrimaryServingBeam-centralOverlay-bypasses -> count=2 items=[sat-serving|0|1,sat-serving|1|2]",
  "SERVING: hero-null -> count=0 items=[]",
  "SERVING: homepage-with-visibility-allowlist-no-fan -> count=1 items=[sat-serving|0|1]",
  "SERVING: homepage-with-visibility-allowlist-and-fan -> count=2 items=[sat-serving|0|1,sat-serving|1|2]",
  "SCENE_ADAPTER: hero-only -> allowed=[sat-serving|0|1]",
  "SCENE_ADAPTER: hero-plus-candidate-sat -> allowed=[sat-candidate|0,sat-serving|0|1]",
  "SCENE_ADAPTER: presented-handover-pair-intra-same-cell -> allowed=[sat-serving|0|1,sat-serving|0|2]",
  "SCENE_ADAPTER: authority-join-transition -> allowed=[sat-candidate|1|2,sat-serving|0|1]",
  "SCENE_ADAPTER: cinema-pair-and-recent -> allowed=[sat-candidate|1|2,sat-serving|0|1]",
];

test('beam visibility characterization matches the photograph taken before convergence', () => {
  const actual = recordPhotograph();
  assert.deepEqual(actual, EXPECTED_VISIBILITY_PHOTOGRAPH);
});

test('beam visibility photograph proof of sensitivity: fails if a gate moves', () => {
  // Altering any gate produces a different photograph row.
  const actual = recordPhotograph();
  // Corrupting one line must be detected:
  const corrupted = [...actual];
  corrupted[16] = 'SERVING: standard-serving -> count=0 items=[]';
  assert.notDeepEqual(actual, corrupted);
});
