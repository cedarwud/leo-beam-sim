/**
 * CHARACTERIZATION TEST — what a HANDOVER CONE draws under the comparison overlay.
 *
 * This is a photograph, not a specification. Every literal below was produced by
 * running the code.
 *
 * ## The blind spot this closes
 *
 * `scene/appearanceCharacterization.test.ts` photographs the handover cone
 * RESOLVERS with no overlay. The overlay was applied afterwards, by a second
 * module, and won — so the photographed values and the drawn values were
 * different numbers whenever the comparison overlay was open, and nothing
 * compared them. Measured, before the convergence, on one inter pulse item with
 * the accepted snapshot present:
 *
 *     resolver -> #0a10a0   (the accepted snapshot's published colour)
 *     overlay  -> #bee561   (the deterministic rung; the snapshot discarded)
 *
 * ## What is pinned here
 *
 *   1. The overlay is now ONE paint context asked for in one place, so the two
 *      passes cannot reach different answers. The idempotence assertion below
 *      is the guard: `overlayPass(resolve(x)) === resolve(x)`.
 *   2. What each lane draws with the overlay open, and with it closed — the
 *      values that were previously invisible to any test.
 *   3. That the overlay's rung-0 hit outranks the deterministic rung, and that a
 *      MISS falls through to the ladder rather than to a caller's invention.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  handoverConePaintContext,
  HANDOVER_CONE_OVERLAY_INACTIVE,
  type HandoverConeOverlay,
} from './handoverOverlayIdentity';
import { paintConeItem } from './paintConeItems';
import { resolveAdditiveHandoverConeColoring } from '../scene/additiveHandoverConeColoring';
import { resolvePulseConeItems } from '../scene/handoverConeResolvers';

const planMap = new Map<string, string>([
  ['sat-serving/0', '#112233'],
  ['sat-candidate/1', '#445566'],
]);

const overlayOf = (
  laneKind: 'intra' | 'inter' | null,
  beamColorBySatelliteCell = planMap,
): HandoverConeOverlay => ({
  centralOverlayActive: true,
  beamColorBySatelliteCell,
  laneKind,
});

/** The single paint every handover lane now performs. */
function onePaint(
  item: { satId: string; cellId: number; beamId?: number; color: string; role?: string; renderKey?: string; kind?: 'intra' | 'inter' },
  overlay: HandoverConeOverlay,
  sceneLookup?: (satId: string, beamId: number) => string | undefined,
): string {
  return paintConeItem(item, handoverConePaintContext({
    overlay,
    cellId: item.cellId,
    resolveIdentityColor: sceneLookup,
    laneKind: item.kind ?? null,
  })).color;
}

const sourceItem = {
  satId: 'sat-serving', cellId: 0, beamId: 1, color: '#unused',
  role: 'handoverSource', renderKey: 'evt-from', kind: 'intra' as const,
};
const targetItem = {
  satId: 'sat-candidate', cellId: 1, beamId: 2, color: '#unused',
  role: 'handoverTarget', renderKey: 'evt-to', kind: 'inter' as const,
};

test('the overlay supplies rung 0, and rung 0 outranks the deterministic rung', () => {
  // Pinned literals, produced by running the code.
  // laneKind null -> no shade: the overlay's published colour, unmodified.
  assert.equal(onePaint(sourceItem, overlayOf(null)), '#112233');
  assert.equal(onePaint(targetItem, overlayOf(null)), '#445566');
  // laneKind 'intra' -> the handover table shades the overlay's OWN colour, so
  // the shade is a modifier on the identity rather than a replacement for it.
  assert.equal(onePaint(sourceItem, overlayOf('intra')), '#186bbf');
  // `#445566` measures saturation 0.091, below the shade guard's 0.40 floor, so
  // it is passed through untouched: a colour with no usable hue is left alone
  // rather than having one invented for it. That guard firing here is part of
  // the photograph, not an accident of the fixture.
  assert.equal(onePaint(targetItem, overlayOf('intra')), '#445566');
  // laneKind 'inter' -> the table's inter rows shade neither side.
  assert.equal(onePaint(sourceItem, overlayOf('inter')), '#112233');
  assert.equal(onePaint(targetItem, overlayOf('inter')), '#445566');
});

test('an overlay MISS falls through to the ladder, not to an invented colour', () => {
  const empty = new Map<string, string>();
  // The deterministic rung for the SAME beam id the lookup was keyed by.
  assert.equal(onePaint(sourceItem, overlayOf(null, empty)), '#bee561');
  assert.equal(onePaint(targetItem, overlayOf(null, empty)), '#b9d0f4');
});

test('the overlay withholds the scene lookup; the inactive overlay restores it', () => {
  const sceneLookup = (satId: string, beamId: number) => (
    satId === 'sat-serving' && beamId === 1 ? '#ff00aa' : undefined
  );
  // Overlay open: the scene lookup is not consulted — the plan map names the beam.
  assert.equal(onePaint(sourceItem, overlayOf(null), sceneLookup), '#112233');
  // Overlay closed: the scene lookup is rung 2 again, and the item's own kind
  // owns the handover row (here `intra`, so the source side is shaded).
  assert.equal(
    onePaint(sourceItem, HANDOVER_CONE_OVERLAY_INACTIVE, sceneLookup),
    '#d70993',
  );
});

test('the lane owns the kind under the overlay, whatever the item remembers', () => {
  // `sourceItem.kind` is 'intra'. Under the overlay the LANE's kind decides, so
  // a pulse lane (laneKind null) leaves it unshaded even though the item knows
  // it belongs to an intra event. This was previously expressed by rebuilding
  // the item without its `kind` field.
  assert.equal(onePaint(sourceItem, overlayOf(null)), '#112233');
  assert.equal(handoverConePaintContext({
    overlay: overlayOf(null), cellId: 0, resolveIdentityColor: undefined,
  }).situationKindAuthority, 'lane');
  assert.equal(handoverConePaintContext({
    overlay: HANDOVER_CONE_OVERLAY_INACTIVE, cellId: 0, resolveIdentityColor: undefined,
  }).situationKindAuthority, undefined);
});

test('the overlay pass is IDEMPOTENT — it can no longer disagree with the resolver', () => {
  // This is the guard that the two-authority defect cannot come back. The
  // resolvers paint with the overlay; the downstream pass recomputes with the
  // SAME owner and must reach the same answer for every lane and every kind.
  for (const beamColorBySatelliteCell of [planMap, new Map<string, string>()]) {
    for (const presentationPairKind of ['intra', 'inter', null] as const) {
      const resolvedPulse = [sourceItem, targetItem].map(item => ({
        ...item,
        color: onePaint(item, overlayOf(null, beamColorBySatelliteCell)),
      }));
      const resolvedTriggered = [sourceItem, targetItem].map(item => ({
        ...item,
        color: onePaint(item, overlayOf('intra', beamColorBySatelliteCell)),
      }));
      const resolvedCinema = [sourceItem, targetItem].map(item => ({
        ...item,
        color: onePaint(item, overlayOf(presentationPairKind, beamColorBySatelliteCell)),
      }));

      const after = resolveAdditiveHandoverConeColoring({
        pulseItems: resolvedPulse,
        triggeredIntraItems: resolvedTriggered,
        cinemaPairItems: resolvedCinema,
        centralOverlayActive: true,
        authorityPresentationCommitObserved: false,
        beamColorBySatelliteCell,
        presentationPairKind,
      });

      assert.deepEqual(
        after.pulseItems.map(cone => cone.color),
        resolvedPulse.map(cone => cone.color),
        `pulse lane drifted (kind=${presentationPairKind})`,
      );
      assert.deepEqual(
        after.triggeredIntraItems.map(cone => cone.color),
        resolvedTriggered.map(cone => cone.color),
        `triggered lane drifted (kind=${presentationPairKind})`,
      );
      assert.deepEqual(
        after.cinemaPairItems.map(cone => cone.color),
        resolvedCinema.map(cone => cone.color),
        `cinema lane drifted (kind=${presentationPairKind})`,
      );
    }
  }
});

test('the inactive overlay contributes nothing', () => {
  assert.equal(HANDOVER_CONE_OVERLAY_INACTIVE.centralOverlayActive, false);
  assert.equal(HANDOVER_CONE_OVERLAY_INACTIVE.laneKind, null);
  assert.equal(HANDOVER_CONE_OVERLAY_INACTIVE.beamColorBySatelliteCell.size, 0);
  const context = handoverConePaintContext({
    overlay: HANDOVER_CONE_OVERLAY_INACTIVE,
    cellId: 0,
    resolveIdentityColor: undefined,
    laneKind: 'inter',
    isServingOrCandidate: true,
  });
  assert.equal(context.planColorFor, undefined);
  assert.equal(context.laneKind, 'inter');
  assert.equal(context.isServingOrCandidate, true);
});

/**
 * WIRING, not just the owner.
 *
 * The tests above prove the DECISION is single. They cannot prove the resolvers
 * actually ask for it — a seam nobody calls is the same as no seam, and this
 * repo has shipped exactly that before. So this runs the real pulse resolver
 * over real geometry, with and without the overlay, and pins what it emits.
 */
test('the pulse resolver consults the overlay, so its one paint is the drawn value', () => {
  const placementByCellId = new Map([
    [0, { cellId: 0, worldX: 10, worldZ: -20, radiusWorld: 4 }],
    [1, { cellId: 1, worldX: -30, worldZ: 15, radiusWorld: 4 }],
  ]);
  const satelliteWorldById = new Map([
    ['sat-serving', { x: 0, y: 100, z: 0 }],
    ['sat-candidate', { x: 25, y: 110, z: -10 }],
  ]);
  const interEvent = {
    ueId: 'ue-0', kind: 'inter' as const, sourceTimeSec: 10,
    fromSatId: 'sat-serving', fromBeamId: 1, fromCellId: 0,
    toSatId: 'sat-candidate', toBeamId: 2, toCellId: 1,
  };
  const run = (overlay: HandoverConeOverlay) => resolvePulseConeItems({
    policy: {
      enabled: true, hideTimelinePulse: false, suppressNaturalHandoverLayers: false,
      renderNaturalPulse: true, homepageVisualIdentity: false,
      concurrentIntraVisualSuppressed: false, showOtherHandoverUes: true,
      pulseFocusFollowsScope: false,
    },
    frame: { recentHandoverEvents: [interEvent], simTimeSec: 10 },
    geometry: {
      placementByCellId, satelliteWorldById, frequencyReuse: 3,
      focusSatIds: null, protagonistUeId: null,
    },
    output: {
      // A HITTING accepted snapshot: this is the value the overlay used to discard.
      resolveSceneAcceptedBeamColor: (satId, beamId) => (
        satId === 'sat-serving' && beamId === 1 ? '#ff00aa' : undefined
      ),
      restrictHomepageBeamItems: items => items,
    },
    overlay,
  }).map(cone => `${cone.renderKey}=${cone.color}`);

  // Overlay CLOSED: the accepted snapshot reaches the screen (rung 2 hit on the
  // source beam; the target beam misses and falls to the deterministic rung).
  assert.deepEqual(run(HANDOVER_CONE_OVERLAY_INACTIVE), [
    'ue-0-10-to=#b9d0f4',
    'ue-0-10-from=#ff00aa',
  ]);
  // Overlay OPEN: the plan map names both beams, in one paint.
  assert.deepEqual(run(overlayOf(null)), [
    'ue-0-10-to=#445566',
    'ue-0-10-from=#112233',
  ]);
  // Overlay OPEN with an empty plan map: a MISS still falls through the ladder
  // to the deterministic rung rather than to any caller's fallback.
  assert.deepEqual(run(overlayOf(null, new Map())), [
    'ue-0-10-to=#b9d0f4',
    'ue-0-10-from=#bee561',
  ]);
});
