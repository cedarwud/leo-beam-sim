/**
 * THE identity-source decision for a handover cone.
 *
 * ## Read this first if you were sent here by a prompt
 *
 * If the change you want is any of these:
 *
 *   - "比較疊層打開時，換手錐體要用哪一組顏色"
 *   - "疊層開著的時候 accepted snapshot 的顏色沒有出現"
 *   - "pulse 錐體在疊層下要不要套換手明暗表"
 *
 * then the change is IN THIS FILE and nowhere else.
 *
 * ## Why this exists
 *
 * A measured audit found the pulse / triggered / cinema handover cones painted
 * TWICE, by two modules, with two different source sets:
 *
 *   1. `scene/handoverConeResolvers.ts` painted each item from the SCENE lookup
 *      (the accepted snapshot, and the homepage projection above it), with the
 *      item's own handover kind.
 *   2. `scene/additiveHandoverConeColoring.ts` then painted the finished items
 *      AGAIN from the comparison plan's map alone — no scene lookup at all —
 *      with a lane-owned kind, and won whenever the comparison overlay was open.
 *
 * Measured, on one inter pulse item with the accepted snapshot present:
 *
 *     first paint  #0a10a0   <- the accepted snapshot's published colour
 *     second paint #bee561   <- the deterministic rung; the snapshot discarded
 *
 * Neither module was wrong on its own. The defect was that "which source names
 * this cone" had two answers, so the accepted snapshot silently stopped
 * reaching the screen exactly when the comparison overlay asked the viewer to
 * compare identities.
 *
 * There is now one answer, here, and both passes ask for it. The second pass
 * can therefore no longer disagree with the first — a property that is pinned,
 * not assumed, by `handoverOverlayIdentityCharacterization.test.ts`.
 *
 * ## What this file is NOT
 *
 * It does not compose a colour. It chooses a paint CONTEXT — which identity
 * sources apply and which handover row applies — and hands it to
 * `paintConeItems.ts`, which is still the one composition point.
 */
import type { BeamProminence } from './beamAppearanceContract';
import type { ConePaintContext, IdentityColorLookup } from './paintConeItems';

/**
 * The accepted-comparison overlay, expressed as an identity SOURCE.
 *
 * The overlay's published colour is a legitimate identity source — it is what
 * the right-hand rail is already showing — so it belongs on ladder RUNG 0, the
 * way `resolveAuthorityPairConeItems` has always taken it. It is emphatically
 * not a licence to run the ladder a second time with a different set of rungs.
 */
export interface HandoverConeOverlay {
  /** While true, the overlay owns identity for these lanes. */
  readonly centralOverlayActive: boolean;
  /** The overlay's published colour per `${satId}/${cellId}` — ladder rung 0. */
  readonly beamColorBySatelliteCell: ReadonlyMap<string, string>;
  /**
   * The kind the OVERLAY assigns this lane, deliberately not always the item's
   * own: the overlay treats the pulse lane as steady state (no shade) however
   * each pulse item remembers its event. That was previously expressed by
   * rebuilding the item without its `kind` field — a decision made by omitting
   * a property, invisible at the call site.
   */
  readonly laneKind: 'intra' | 'inter' | null;
}

/**
 * An overlay that is not active.
 *
 * Lets a lane that has no overlay say so, instead of every caller writing its
 * own "if there is no overlay" branch — which is the shape the two disagreeing
 * paints grew out of.
 */
export const HANDOVER_CONE_OVERLAY_INACTIVE: HandoverConeOverlay = {
  centralOverlayActive: false,
  beamColorBySatelliteCell: new Map(),
  laneKind: null,
};

export interface HandoverConePaintContextInput {
  readonly overlay: HandoverConeOverlay;
  /** The cell the overlay's map is keyed by. */
  readonly cellId: number;
  /** The scene's identity lookup, used only while the overlay is not active. */
  readonly resolveIdentityColor?: IdentityColorLookup | undefined;
  /** A lane's own rung-0 source (the authority pair lane owns one). */
  readonly planColorFor?: (satId: string, beamId: number) => string | undefined;
  /** The lane's handover kind, used only while the overlay is not active. */
  readonly laneKind?: 'intra' | 'inter' | null;
  readonly prominence?: BeamProminence;
  readonly isServingOrCandidate?: boolean;
}

/**
 * THE paint context for one handover cone.
 *
 * When the overlay owns identity it supplies rung 0 and the lane's kind, and
 * the scene lookup is withheld — exactly what the retired second pass did, now
 * said once instead of implied twice. When it does not, the lane's own context
 * applies unchanged.
 */
export function handoverConePaintContext(
  input: HandoverConePaintContextInput,
): ConePaintContext {
  const prominence = input.prominence ?? 'serving';
  if (input.overlay.centralOverlayActive) {
    return {
      planColorFor: satId => input.overlay.beamColorBySatelliteCell.get(
        `${satId}/${input.cellId}`,
      ),
      laneKind: input.overlay.laneKind,
      situationKindAuthority: 'lane',
      prominence,
    };
  }
  return {
    resolveIdentityColor: input.resolveIdentityColor,
    planColorFor: input.planColorFor,
    laneKind: input.laneKind,
    prominence,
    isServingOrCandidate: input.isServingOrCandidate,
  };
}

export interface HandoverOverlayCueEndpoint {
  readonly satelliteId: string;
  readonly cellId: number;
}

export interface HandoverOverlayCueColors {
  readonly sourceColor: string;
  readonly targetColor: string;
}

/** Resolve accepted-cue endpoint colours without importing scene transition types. */
export function resolveHandoverOverlayCueColors(input: {
  readonly centralOverlayActive: boolean;
  readonly beamColorBySatelliteCell: ReadonlyMap<string, string>;
  readonly neutralColor: string;
  readonly source: HandoverOverlayCueEndpoint | null;
  readonly target: HandoverOverlayCueEndpoint | null;
  readonly resolveAcceptedCellColor: (satelliteId: string, cellId: number) => string;
}): HandoverOverlayCueColors {
  const resolveEndpoint = (endpoint: HandoverOverlayCueEndpoint | null): string => {
    if (endpoint === null) return input.neutralColor;
    if (!input.centralOverlayActive) {
      return input.resolveAcceptedCellColor(endpoint.satelliteId, endpoint.cellId);
    }
    return input.beamColorBySatelliteCell.get(`${endpoint.satelliteId}/${endpoint.cellId}`)
      ?? input.resolveAcceptedCellColor(endpoint.satelliteId, endpoint.cellId);
  };
  return {
    sourceColor: resolveEndpoint(input.source),
    targetColor: resolveEndpoint(input.target),
  };
}
