/**
 * THE cone-painting ritual. Every cone lane calls this and none paints its own.
 *
 * ## What this replaces
 *
 * Eight cone resolvers each carried their own copy of the same three-step
 * ritual — resolve an identity colour, maybe shade it for a handover, hand it
 * downstream — and the copies had drifted apart on all three steps:
 *
 *   - THE FALLBACK, AND ITS DISAGREEMENT WITH THE KEY. Every lane passed the
 *     right lookup KEY — the link-budget beam id. But each supplied its own
 *     `fallback` argument, computed a different way: `item.color` here,
 *     `resolveServingIdentityColor(sat, CELL id, NEUTRAL)` there, a bare neutral
 *     literal somewhere else. In the triggered, cinema and authority lanes the
 *     fallback was derived from the CELL id while the key was the BEAM id, and
 *     `beamId == cellId + 1` on this lane. So a lookup HIT returned one beam's
 *     colour and a lookup MISS returned its neighbour's — adjacent rungs of the
 *     same lightness ladder. One beam therefore rendered in two shades depending
 *     on which lane drew it and whether the snapshot happened to hold it, during
 *     a handover, which is exactly when it is being watched. A fallback is a
 *     colour decision, so eight fallbacks were eight colour authorities.
 *   - THE SIDE. Which side of a handover an item was on was read three ways:
 *     `role === 'handoverSource'`, `renderKey.endsWith('-trig-to')`, and
 *     `renderKey.endsWith('-from')`.
 *
 * All three now have exactly one implementation. The SIDE is resolved by
 * `handoverAppearanceModifiers.ts`, the beam id by {@link coneItemBeamId}, and
 * the FALLBACK is gone as a caller decision: this file no longer composes a
 * colour at all. It translates a render item into the four axes and hands them
 * to `resolveBeamAppearance`, which is the module's one composition point. A
 * second copy of that composition lived here for a pass, and having two of them
 * inside the module whose premise is "there is one" meant a single visual change
 * still needed two files audited — the exact failure this directory exists to
 * end, reproduced in the fix for it.
 *
 * ## What this does NOT do
 *
 * It does not touch opacity. The lanes currently fold their opacity factors
 * into the geometry call before the cone exists, and moving that is a separate,
 * separately-provable change. Colour was the reported pain; opacity converges
 * next, through `HANDOVER_TRANSITION_*_OPACITY_FACTOR` in
 * `handoverAppearanceModifiers.ts`. Doing both at once would make the
 * characterization diff unreadable, and an unreadable diff is how the last
 * refactor shipped a regression nobody could see.
 */
import { cellLinkBudgetBeamId } from '../scene/sinrLiveCellModel';
import {
  resolveServingOrCandidateFlag,
  resolvedBeamId,
  type BeamProminence,
  type HandoverSituation,
  type IdentitySources,
} from './beamAppearanceContract';
import { resolveHandoverSide } from './handoverAppearanceModifiers';
import { resolveBeamAppearance } from './resolveBeamAppearance';

/** The shape every cone render item already has. Structural, not nominal. */
export interface PaintableConeItem {
  readonly satId: string;
  readonly cellId: number;
  readonly beamId?: number;
  readonly color: string;
  readonly role?: string | undefined;
  readonly renderKey?: string | undefined;
  readonly kind?: 'intra' | 'inter' | undefined;
}

/**
 * The caller's identity lookup, in the shape MainScene already exposes as
 * `resolveSceneAcceptedBeamColor`.
 *
 * ## This is the ADAPTED shape, not the contract
 *
 * The contract is {@link IdentitySources}: lookups that answer `undefined` on a
 * miss, with the precedence between them owned by `resolveBaseIdentityColor`.
 * When a lookup returns `undefined`, paintConeItem falls through to the ladder
 * rather than forcing a caller to invent a fallback colour.
 *
 * When MainScene hands over `IdentitySources` directly, delete this type and
 * the adapter with it.
 *
 * The lookup no longer takes a fallback at all, because the ladder behind it
 * owns every rung including the deterministic one — there is no slot for a
 * caller to put a colour in.
 */
export type IdentityColorLookup = (
  satId: string,
  beamId: number,
  isServingOrCandidate?: boolean,
) => string | undefined;

export interface ConePaintContext {
  readonly resolveIdentityColor?: IdentityColorLookup;
  /** The accepted comparison plan's own published colour. Outranks everything. */
  readonly planColorFor?: (satId: string, beamId: number) => string | undefined;
  /**
   * The lane's handover kind, used only for items that do not carry their own
   * `kind`. The pulse lane tags each item; the pair lanes know it per-lane.
   */
  readonly laneKind?: 'intra' | 'inter' | null;
  /**
   * WHO owns the handover kind for this paint: the item, or the lane.
   *
   * `'item'` (the default) reads `item.kind` and falls back to `laneKind`.
   * `'lane'` ignores `item.kind` entirely, so `laneKind` alone decides — which
   * is what a lane means when it says "every cone I draw is one intra pair"
   * regardless of what each cone remembers about its own event.
   *
   * This existed before as a TRICK rather than an option: the additive overlay
   * rebuilt each item without its `kind` field and its docstring explained that
   * "the item's own `kind` is deliberately not forwarded". A decision expressed
   * by omitting a property is invisible to anyone reading the call site, and it
   * forced a second paint of an already-painted item to express it. Naming it
   * lets the ONE paint say which authority applies.
   */
  readonly situationKindAuthority?: 'item' | 'lane';
  readonly phase?: HandoverSituation['phase'];
  readonly prominence?: BeamProminence;
  /**
   * Whether this item counts as serving-or-candidate for the homepage's EE
   * shade projection.
   *
   * Explicit, because the alternative was worse: lanes were encoding this
   * boolean by choosing a PROMINENCE that happened to derive it, passing
   * `'hero'` to mean "false" on cones that are not heroes. That makes the
   * prominence axis carry something that is not loudness, contradicting its own
   * contract, and it means a later change to what `'hero'` implies would
   * silently recolour beams. Say the flag when you mean the flag.
   *
   * Defaults to the prominence-derived value so existing callers are unchanged.
   */
  readonly isServingOrCandidate?: boolean;
}

/**
 * The ONE beam id for an item.
 *
 * `cellId + 1` is a fallback for items that genuinely carry no link-budget id.
 * It is not a licence to ignore an id the item does carry — ignoring it is what
 * split the lanes in the first place.
 */
export function coneItemBeamId(item: Pick<PaintableConeItem, 'cellId' | 'beamId'>): number {
  return resolvedBeamId(item, cellLinkBudgetBeamId);
}

/**
 * THE boundary between the lanes' lookup shape and the appearance contract.
 *
 * `IdentityColorLookup` lands on the ladder's rung 2 (ACCEPTED SNAPSHOT); a miss
 * (`undefined` or empty string) falls through to the ladder's deterministic rung.
 *
 * Two things are deliberately NOT here:
 *
 *   - No `callerFallback`. The lookup signature provides no slot for a caller to
 *     smuggle its own fallback in — the ladder's deterministic rung 3 owns it.
 *   - No composition. The adapter maps a shape; it does not decide a colour.
 *     Every colour decision on this path is made by `resolveBeamAppearance`.
 */
function identitySourcesFromLookup(
  lookup: IdentityColorLookup | undefined,
  planColorFor: ((satId: string, beamId: number) => string | undefined) | undefined,
  isServingOrCandidate: boolean,
): IdentitySources {
  return {
    planColorFor,
    acceptedColorFor: lookup !== undefined
      ? (satId, beamId) => {
          const result = lookup.length >= 4
            ? (lookup as unknown as (s: string, b: number, f: string, sc?: boolean) => string | undefined)(
                satId,
                beamId,
                '',
                isServingOrCandidate,
              )
            : lookup(satId, beamId, isServingOrCandidate);
          return result !== undefined && result.length > 0 ? result : undefined;
        }
      : undefined,
  };
}

/**
 * Paint one item: identity colour, then the handover table's shade. Exported so
 * a sink that legitimately handles a single item can reach the same answer
 * without rebuilding an array.
 *
 * The three-step ritual is NOT implemented here. This function only translates a
 * render item into the four axes and asks {@link resolveBeamAppearance} for the
 * answer. An earlier version composed identity and the handover shade itself,
 * next to a `resolveBeamAppearance` that composed the same two things the same
 * way — two composition paths inside the module whose entire premise is that
 * there is one. Changing a single visual decision then meant auditing both,
 * which is the failure this directory exists to end.
 *
 * OPACITY is still dropped on the floor here, deliberately: the lanes fold their
 * opacity factors into the geometry call before the cone exists, so
 * opacity has nowhere to go yet.
 */
export function paintConeItem<T extends PaintableConeItem>(item: T, context: ConePaintContext): T {
  const prominence = context.prominence ?? 'serving';
  const isServingOrCandidate = resolveServingOrCandidateFlag(
    prominence,
    context.isServingOrCandidate,
  );
  const situation: HandoverSituation = {
    kind: context.situationKindAuthority === 'lane'
      ? context.laneKind ?? null
      : item.kind ?? context.laneKind ?? null,
    side: resolveHandoverSide(item),
    phase: context.phase ?? null,
  };
  const appearance = resolveBeamAppearance({
    identity: { satId: item.satId, cellId: item.cellId, beamId: item.beamId },
    beamId: coneItemBeamId(item),
    prominence,
    isServingOrCandidate,
    situation,
    sources: identitySourcesFromLookup(
      context.resolveIdentityColor,
      context.planColorFor,
      isServingOrCandidate,
    ),
  });
  return { ...item, color: appearance.color };
}

/** Paint a whole lane. */
export function paintConeItems<T extends PaintableConeItem>(
  items: readonly T[],
  context: ConePaintContext,
): readonly T[] {
  return items.map(item => paintConeItem(item, context));
}
