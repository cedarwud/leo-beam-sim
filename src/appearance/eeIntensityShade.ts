/**
 * THE EE-intensity → paint contract.
 *
 * ## What problem this solves
 *
 * Three surfaces render "how strong is this link's energy efficiency" as a
 * visual: the homepage 3-D scene's beam cones (`homepage/controller/
 * homepageSatelliteVisualIdentity.ts`), the right-rail's own EE bar
 * (`appearance/candidateRailPresentation.ts`), and the Inter/Intra Handover
 * teaching lecture's cones (`viz/HandoverTeachingBeamCones.tsx`). Each of
 * those three legitimately computes ITS OWN ratio — frame-relative strength,
 * distance from the configurable handover threshold, and an authored teaching
 * value, respectively — and that difference is correct: the three ratios
 * answer different questions and must not be merged into one.
 *
 * What must NOT differ between them is what a given ratio LOOKS like once
 * computed. Before this module, the "ratio → lightness/opacity" arithmetic
 * was reinvented independently in at least two of the three places, with
 * different curves and no way to notice if they drifted further apart.
 *
 * This module is the one owner of that second step: given an already-
 * normalized 0..1 ratio (from wherever), how deep/opaque does it render.
 *
 * ## Boundary this module must never cross
 *
 * This is PROMINENCE-axis-adjacent per `beamAppearanceContract.ts`'s four
 * axes: "PROMINENCE may make a cone dimmer, but may never give it a different
 * hue, because hue is IDENTITY." Every function here takes a bare `ratio01`
 * and returns lightness/saturation/opacity NUMBERS or a shaded copy of a
 * caller-supplied colour — never a caller-supplied event kind, decision
 * state, or "is this real or teaching" flag. That is what makes it safe for
 * BOTH the real homepage pipeline and the teaching lecture to call: the
 * function has no way to know or care which one is asking, so it cannot
 * become a second place where real and authored EE get confused with each
 * other (see `src/homepage/teaching/handoverTeachingScript.ts`'s own header
 * for why that boundary matters — a scripted lecture's numbers must never be
 * mistaken for measured ones).
 *
 * Direction, matching the existing production tuning this module was
 * extracted from: a HIGHER ratio renders DEEPER (lower lightness, higher
 * saturation) and MORE OPAQUE, never closer to white. A link fading toward
 * the floor goes pale and faint; a link pulling ahead goes vivid and solid.
 *
 * ## Layering
 *
 * Lives beside `beamAppearanceContract.ts`, at the bottom of `appearance/`.
 * Pure by construction: no React, no clock, no module-level mutable state.
 * Imports only `constants/hsl.ts`, matching `intraHandoverShade.ts`'s own
 * layering.
 */
import { clampUnit, hexToHsl, hslToHex } from '../constants/hsl';

/** Continuous saturation/lightness endpoints a ratio of 0 and 1 interpolate between. */
export interface EeIntensityShadeRange {
  readonly saturationAtZero: number;
  readonly saturationAtOne: number;
  readonly lightnessAtZero: number;
  readonly lightnessAtOne: number;
}

/**
 * The homepage scene's own proven serving/context ranges, moved here
 * verbatim from `homepageSatelliteVisualIdentity.ts` so the teaching lecture
 * can render the identical visual language rather than inventing a second
 * one. Constants, not defaults baked into the functions below, so a caller
 * that legitimately wants a different range (the rail's own bar, say) can
 * still use the same interpolation math with its own numbers.
 */
export const EE_INTENSITY_SERVING_SHADE_RANGE: EeIntensityShadeRange = Object.freeze({
  saturationAtZero: 0.70,
  saturationAtOne: 0.88,
  lightnessAtZero: 0.72,
  lightnessAtOne: 0.48,
});
export const EE_INTENSITY_CONTEXT_SHADE_RANGE: EeIntensityShadeRange = Object.freeze({
  saturationAtZero: 0.40,
  saturationAtOne: 0.56,
  lightnessAtZero: 0.74,
  lightnessAtOne: 0.52,
});

/**
 * The teaching lecture's own, deliberately wider range. Sharing the CURVE
 * (this module) with the real scene is the contract; sharing the exact
 * numeric endpoints is not — `EE_INTENSITY_SERVING_SHADE_RANGE` and
 * `EE_INTENSITY_CONTEXT_SHADE_RANGE` already differ from each other for
 * the same reason. A lecture's whole job is teaching the viewer to READ
 * "deeper colour = higher EE" as a signal; a narrow swing tuned to stay
 * subtle in a live, data-dense scene under-serves that job when the
 * viewer's attention is on exactly two cones. Kept end-to-end darker/more
 * saturated than the context range at every ratio, preserving the same
 * serving-outranks-context hierarchy the real scene uses.
 */
export const EE_INTENSITY_TEACHING_SERVING_SHADE_RANGE: EeIntensityShadeRange = Object.freeze({
  saturationAtZero: 0.30,
  saturationAtOne: 0.95,
  lightnessAtZero: 0.85,
  lightnessAtOne: 0.32,
});
export const EE_INTENSITY_TEACHING_CONTEXT_SHADE_RANGE: EeIntensityShadeRange = Object.freeze({
  saturationAtZero: 0.20,
  saturationAtOne: 0.75,
  lightnessAtZero: 0.86,
  lightnessAtOne: 0.42,
});

/** Linear interpolation, ratio 0 → `atZero`, ratio 1 → `atOne`. */
function mix(atZero: number, atOne: number, ratio01: number): number {
  return atZero + (atOne - atZero) * ratio01;
}

/**
 * Ratio → saturation/lightness. The one place either number is computed from
 * an EE ratio; every caller either applies these directly (already has a hue
 * in hand) or via `applyEeIntensityShade` (has a resolved colour to shade).
 */
export function eeIntensityShade(
  ratio01: number,
  range: EeIntensityShadeRange,
): { readonly saturation: number; readonly lightness: number } {
  const clamped = clampUnit(ratio01);
  return {
    saturation: clampUnit(mix(range.saturationAtZero, range.saturationAtOne, clamped)),
    lightness: clampUnit(mix(range.lightnessAtZero, range.lightnessAtOne, clamped)),
  };
}

/**
 * Shade an EXISTING hex colour by EE ratio, hue preserved exactly. For
 * callers that already hold a resolved identity colour (the teaching
 * lecture's fixed per-role hex) rather than a bare hue, mirroring
 * `intraHandoverShade.ts`'s `emphasizeIntraHandoverColor` shape.  An
 * unparseable colour is returned unchanged rather than guessed at, the same
 * fail-closed choice `handoverAppearanceModifiers.ts` documents for the same
 * reason: inventing a hue for something unreadable is a worse failure than a
 * skipped shade.
 */
export function applyEeIntensityShade(
  color: string,
  ratio01: number,
  range: EeIntensityShadeRange,
): string {
  const hsl = hexToHsl(color);
  if (hsl === null) return color;
  const { saturation, lightness } = eeIntensityShade(ratio01, range);
  return hslToHex(hsl.hue, saturation, lightness);
}

/**
 * The homepage scene's proven opacity range (0.30..1.0), moved here verbatim
 * from `homepageSatelliteVisualIdentity.ts`'s `homepageEeVisualOpacity`.
 */
export const EE_INTENSITY_OPACITY_FLOOR = 0.30;
export const EE_INTENSITY_OPACITY_CEILING = 1.0;

/** Ratio → opacity. Higher EE renders more solid; never fully transparent. */
export function eeIntensityOpacity(
  ratio01: number,
  floor: number = EE_INTENSITY_OPACITY_FLOOR,
  ceiling: number = EE_INTENSITY_OPACITY_CEILING,
): number {
  return mix(floor, ceiling, clampUnit(ratio01));
}
