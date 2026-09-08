/**
 * THE handover appearance table.
 *
 * ## Read this first if you were sent here by a prompt
 *
 * If the change you want is any of these:
 *
 *   - "intra 換手時 source/target 的顏色變化改成 X"
 *   - "inter 換手的 target 也要有強調"
 *   - "換手來源在 settled 之後要更暗"
 *   - "換手兩側的透明度對比再拉開一點"
 *
 * then the change is IN THIS FILE, in {@link HANDOVER_APPEARANCE_MODIFIERS}
 * below, and nowhere else. That is the entire point of this module. If you find
 * yourself editing a second file to finish a handover appearance change, the
 * convergence has sprung a leak — fix the leak rather than making the same edit
 * twice, because "the same edit in two places" is exactly how this codebase
 * arrived at the state that made the owner give up.
 *
 * ## Why a table and not branches
 *
 * Before this, the intra source/target treatment was applied at nine call sites
 * across two files, and each site decided which side an item was on by its own
 * method: one read `item.role === 'handoverSource'`, another tested
 * `renderKey.endsWith('-trig-to')`, a third tested `renderKey.endsWith('-from')`.
 * Those three methods can disagree, and when they disagreed the same cone got a
 * different treatment depending on which lane rendered it. A table has no such
 * failure mode: there is one row per (kind, side), the rows are data, and the
 * side is resolved once by {@link resolveHandoverSide}.
 *
 * ## The invariant that must not be broken
 *
 * A modifier may SHADE or DIM an identity colour. It must never REPLACE it with
 * a colour of its own. Every shade below is derived from the incoming colour and
 * preserves its hue, so a viewer can always still tell which satellite they are
 * looking at during a handover. A modifier that returns a fixed hue would make
 * an intra handover look like an inter handover — a change of satellite — which
 * is a lie about the physics, not a style choice.
 */
import { hexToHsl } from '../constants/hsl';
import { emphasizeIntraHandoverColor } from './intraHandoverShade';
import type { HandoverSide, HandoverSituation } from './beamAppearanceContract';

/** How one (kind, side) combination modifies an identity colour. */
export interface HandoverAppearanceModifier {
  /**
   * Hue-preserving shade applied to the identity colour, or `null` to leave the
   * identity colour untouched.
   */
  readonly shade: HandoverSide | null;
  /** Multiplier on the geometry layer's opacity, in [0, 1]. */
  readonly opacityFactor: number;
  /** Why this row is what it is. Prose, for the next person holding a prompt. */
  readonly rationale: string;
}

/**
 * Source and target opacity factors for the accepted-comparison lane.
 *
 * Moved here from `beamConeIdentityColors.ts` so that "how transparent is the
 * outgoing side of a handover" is answered in the same file as "what colour is
 * it" — they are one visual decision and were previously two edits.
 */
export const HANDOVER_TRANSITION_SOURCE_OPACITY_FACTOR = 0.62;
export const HANDOVER_TRANSITION_TARGET_OPACITY_FACTOR = 0.88;

/**
 * THE TABLE. One row per (handover kind, side).
 *
 * Current behaviour, preserved exactly from the pre-convergence code:
 *   - intra shades both sides (source darker, target brighter) because an
 *     intra handover keeps one satellite hue, so shade is the ONLY channel
 *     left to tell the two beams apart;
 *   - inter shades neither, because the two sides are already different
 *     satellites and therefore already different hues — shading them too would
 *     double-encode the same fact and muddy the identity.
 */
export const HANDOVER_APPEARANCE_MODIFIERS: {
  readonly [K in 'intra' | 'inter']: { readonly [S in HandoverSide]: HandoverAppearanceModifier };
} = {
  intra: {
    source: {
      shade: 'source',
      opacityFactor: 1,
      rationale: 'same satellite hue on both sides; darken the outgoing beam so the pair reads as two beams',
    },
    target: {
      shade: 'target',
      opacityFactor: 1,
      rationale: 'same satellite hue on both sides; brighten the incoming beam so the arrival is legible',
    },
  },
  inter: {
    source: {
      shade: null,
      opacityFactor: 1,
      rationale: 'different satellites already differ in hue; shading would imply an intra shade-shift',
    },
    target: {
      shade: null,
      opacityFactor: 1,
      rationale: 'different satellites already differ in hue; the hue jump IS the inter cue',
    },
  },
} as const;

/**
 * The accepted-comparison lane additionally pulls the two sides apart by
 * opacity. Kept as a separate overlay on the table rather than as duplicate
 * rows, so a change to the intra shade does not have to be made twice.
 */
export const HANDOVER_TRANSITION_OPACITY_OVERLAY: {
  readonly [S in HandoverSide]: number;
} = {
  source: HANDOVER_TRANSITION_SOURCE_OPACITY_FACTOR,
  target: HANDOVER_TRANSITION_TARGET_OPACITY_FACTOR,
};

/**
 * Which side of a handover an item is on — resolved ONCE, here.
 *
 * Accepts the three signals that used to be read independently at different
 * call sites, in explicit precedence order. `role` is the intentional signal and
 * wins; the `renderKey` suffixes are the legacy geometry-emitted signal and are
 * only consulted when a resolver did not set a role. Keeping the legacy suffixes
 * readable here (rather than deleting them immediately) is what lets the
 * convergence be proven behaviour-preserving before the suffixes are retired.
 */
export function resolveHandoverSide(item: {
  readonly role?: string | undefined;
  readonly renderKey?: string | undefined;
}): HandoverSide | null {
  if (item.role === 'handoverSource') return 'source';
  if (item.role === 'handoverTarget') return 'target';
  const renderKey = item.renderKey;
  if (renderKey === undefined) return null;
  // `-trig-from` / `-trig-to` need no separate cases: they already end in
  // `-from` / `-to`. Listing them would only suggest they carry extra meaning.
  if (renderKey.endsWith('-from')) return 'source';
  if (renderKey.endsWith('-to')) return 'target';
  return null;
}

/** Look up the modifier for a situation. Steady state contributes nothing. */
export function handoverModifierFor(
  situation: HandoverSituation,
): HandoverAppearanceModifier | null {
  if (situation.kind === null || situation.side === null) return null;
  return HANDOVER_APPEARANCE_MODIFIERS[situation.kind][situation.side];
}

/**
 * Saturation below which a colour carries no usable hue.
 *
 * `emphasizeIntraHandoverColor` raises saturation to at least 0.78 to keep the
 * two sides of an intra handover legible. On a colour that HAS a hue that is
 * exactly right. On a colour that does not, it invents one: feeding it the grey
 * `#808080` returns `#c81919` — red — and the neutral identity fallback
 * `#94a3b8` comes back as the vivid blue `#2d79e5`. Either result breaks this
 * module's own stated invariant, that a modifier may shade an identity colour
 * but never replace it, and a beam turning red is a strong visual signal in this
 * scene that would be pure fiction.
 *
 * The threshold sits in a measured gap, not a guessed one. Across every real
 * identity colour the palette can produce (`colorForServingBeam` over 8 beams x
 * several satellite id shapes, plus `colorForServingSatellite`) the MINIMUM
 * saturation is 0.600. The neutral identity fallback `#94a3b8` measures 0.202,
 * and a true grey measures 0.000. So 0.40 separates "a real identity, shade it"
 * from "not an identity, leave it alone" with room on both sides, and no real
 * palette colour can drift across it without the palette itself changing
 * character.
 */
const MIN_SHADEABLE_SATURATION = 0.40;

function saturationOf(color: string): number | null {
  return hexToHsl(color)?.saturation ?? null;
}

/**
 * Apply a modifier to an identity colour.
 *
 * The one place `emphasizeIntraHandoverColor` may be called. Every other module
 * asks for a modifier by (kind, side) instead of reaching for the shade
 * function directly — which is what makes the table the single edit point.
 */
export function applyHandoverShade(
  identityColor: string,
  modifier: HandoverAppearanceModifier | null,
): string {
  if (modifier === null || modifier.shade === null) return identityColor;
  const saturation = saturationOf(identityColor);
  // An unparseable colour is passed through untouched rather than guessed at:
  // the shade function would return it unchanged anyway, and inventing a hue
  // for something we could not read is exactly the failure mode above.
  if (saturation === null || saturation < MIN_SHADEABLE_SATURATION) return identityColor;
  return emphasizeIntraHandoverColor(identityColor, modifier.shade);
}
