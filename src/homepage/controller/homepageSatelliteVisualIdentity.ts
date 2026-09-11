/**
 * Homepage-only satellite colour projection.
 *
 * This is a presentation adapter, not a second serving/beam authority.  It
 * consumes the already-resolved satellite identity slot from the existing
 * shared identity-palette authority, and varies only saturation/lightness for
 * beam roles and shades. The palette and its 16→6 projection live in
 * `src/appearance/satelliteIdentityPalette.ts`; this controller owns only the
 * homepage's beam/EE projection after that hue decision.
 */

import {
  HOMEPAGE_SATELLITE_COLOR_COUNT,
  HOMEPAGE_SATELLITE_HUE_FAMILIES,
  HOMEPAGE_SATELLITE_PALETTE_REFERENCE_IDS,
  homepageSatelliteBaseColor,
  homepageSatellitePaletteIndex,
} from '../../appearance/satelliteIdentityPalette';
import {
  EE_INTENSITY_CONTEXT_SHADE_RANGE,
  EE_INTENSITY_SERVING_SHADE_RANGE,
  eeIntensityOpacity,
  eeIntensityShade,
} from '../../appearance/eeIntensityShade';
import { clampUnit, hslToHex } from '../../constants/hsl';
import { servingBeamShadeIndex } from '../../constants/servingColour';

export {
  HOMEPAGE_SATELLITE_COLOR_COUNT,
  HOMEPAGE_SATELLITE_HUE_FAMILIES,
  HOMEPAGE_SATELLITE_PALETTE_REFERENCE_IDS,
  homepageSatelliteBaseColor,
  homepageSatellitePaletteIndex,
} from '../../appearance/satelliteIdentityPalette';

/*
 * There is deliberately no fixed bits/J -> 0..1 EE scale here.
 *
 * `HOMEPAGE_EE_COLOR_SCALE_MIN/MAX_BITS_PER_JOULE` (80,000 / 180,000) and
 * `homepageEeColorNormalized` lived here until they were removed. They silently
 * duplicated `HOMEPAGE_DEMO_EE_CONFIG.minimum/maximumBitsPerJoule`, with nothing
 * asserting the two agreed, and `6b9474e` used them to replace the frame-relative
 * `metric.eeNormalized` in three places -- flattening the beam gradient the
 * homepage handover story depends on.
 *
 * EE is normalized ONCE, in `beamMetrics.ts`, against the frame's own spread.
 * Callers take `eeNormalized` and pass it through
 * `homepageBeamEeProjection.ts`. Reintroducing an absolute scale here would
 * recreate both the duplication and the flattening.
 */

/** Context fallback lightness; keep ambient beams pale without washing to white. */
export const HOMEPAGE_SATELLITE_BEAM_LIGHTNESS_LEVELS = Object.freeze([
  // EE is an intensity signal: a larger EE must render deeper, not closer to
  // white. Keep every level chromatic so repeated same-satellite beams cannot
  // wash the family into a different hue when they overlap.
  0.70,
  0.64,
  0.58,
  0.52,
] as const);

const HOMEPAGE_SATELLITE_SERVING_SATURATION_LEVELS = Object.freeze([
  0.78,
  0.82,
  0.86,
  0.88,
] as const);
const HOMEPAGE_SATELLITE_CONTEXT_SATURATION_LEVELS = Object.freeze([
  // Context beams are made visually faint by the cone layer opacity, not by
  // turning their source token into a near-white pastel. Keeping real chroma
  // here preserves the satellite's hue when several translucent beams overlap.
  0.44,
  0.48,
  0.52,
  0.56,
] as const);
const HOMEPAGE_SATELLITE_SERVING_LIGHTNESS_LEVELS = Object.freeze([
  0.66,
  0.60,
  0.54,
  0.48,
] as const);
const HOMEPAGE_SATELLITE_BASE_SATURATION = 0.72;
const HOMEPAGE_SATELLITE_BASE_LIGHTNESS = 0.58;

/**
 * Context beams stay in their satellite hue family but are intentionally
 * quieter than the primary serving/candidate beam. This is applied only by
 * the homepage renderers; it never changes metric values or decision state.
 */
export const HOMEPAGE_SATELLITE_CONTEXT_RENDER_OPACITY_FACTOR = 0.64;

export interface HomepageSatelliteColorOptions {
  readonly isServing?: boolean;
  readonly eeNormalized?: number | null;
  /** Canonical accepted-snapshot palette slot; null means deterministic fallback. */
  readonly identityPaletteIndex?: number | null;
}

export interface HomepageSatelliteVisualColor {
  readonly satelliteId: string;
  readonly paletteIndex: number;
  readonly paletteName: string;
  readonly hueDegrees: number;
  readonly shadeIndex: number;
  readonly saturation: number;
  readonly lightness: number;
  readonly baseColor: string;
  readonly color: string;
  readonly emissiveColor: string;
}

/**
 * Degrees -> unit ADAPTER over the one HSL formula, in `constants/hsl.ts`.
 *
 * This file used to carry a third private copy of that formula, differing only
 * in its interface: hue in [0, 360) instead of [0, 1], with the clamps folded
 * in. An interface difference is not a reason to own a second implementation —
 * it is a reason to own an adapter. The copy is why `constants/hsl.ts`'s own
 * header ("Extracted so the two are not maintained as separate copies of the
 * same formula") was true of two of the three copies and silently false of this
 * one: every homepage satellite colour went through the private one.
 *
 * The adapter is behaviour-preserving, not merely equivalent-looking:
 *   - `positiveModulo(hueDegrees, 360) / 360` is reproduced here, so any hue
 *     outside [0, 360) normalises exactly as before;
 *   - `clampUnit` is the same clamp the private copy applied to s and l;
 *   - inside the formula, the copy's `positiveModulo(n + h * 12, 12)` and the
 *     shared `(n + h * 12) % 12` agree for every h >= 0, which is all this
 *     adapter can produce.
 */
function hueFamilyColor(hueDegrees: number, saturation: number, lightness: number): string {
  return hslToHex(
    (((hueDegrees % 360) + 360) % 360) / 360,
    clampUnit(saturation),
    clampUnit(lightness),
  );
}

function homepageBeamShadeIndex(beamId: number): number {
  // The homepage is intentionally a compact projection: it folds the shared
  // beam-id mapping into four local rungs, while finite EE may replace this
  // fallback with the frame-relative intensity bucket below.
  return servingBeamShadeIndex(beamId, HOMEPAGE_SATELLITE_BEAM_LIGHTNESS_LEVELS.length);
}

function normalizedEeBucket(eeNormalized: number): number {
  const boundedEe = Math.min(1, Math.max(0, eeNormalized));
  const bucketCount = HOMEPAGE_SATELLITE_BEAM_LIGHTNESS_LEVELS.length;
  return Math.min(bucketCount - 1, Math.floor(boundedEe * bucketCount));
}

function finiteEeBucket(eeNormalized: number | null | undefined): number | null {
  if (typeof eeNormalized !== 'number' || !Number.isFinite(eeNormalized)) return null;
  return normalizedEeBucket(eeNormalized);
}

/**
 * Lower EE is visibly quieter while the beam remains on the same hue family.
 * The ratio→opacity curve itself is `appearance/eeIntensityShade.ts`'s; this
 * wrapper only owns the homepage-specific "unknown EE reads as fully opaque"
 * default, which is a caller policy, not a property of the curve.
 */
export function homepageEeVisualOpacity(
  eeNormalized: number | null | undefined,
): number {
  if (typeof eeNormalized !== 'number' || !Number.isFinite(eeNormalized)) return 1;
  return eeIntensityOpacity(eeNormalized);
}

/**
 * Resolve one beam without changing the satellite hue family.  A finite EE
 * value selects the intensity bucket; otherwise the beam slot remains the
 * deterministic fallback for existing callers.  Serving beams stay vivid,
 * while non-serving/unknown beams are pale context.  Repeated beams receive
 * the exact same token rather than an opacity-dependent colour.
 *
 * The satellite hue slot is derived unconditionally from `satelliteId`;
 * `options?.identityPaletteIndex` is deliberately ignored.
 */
export function homepageSatelliteColorForBeam(
  satelliteId: string,
  beamId: number,
  options?: HomepageSatelliteColorOptions,
): HomepageSatelliteVisualColor {
  const paletteIndex = homepageSatellitePaletteIndex(satelliteId);
  const family = HOMEPAGE_SATELLITE_HUE_FAMILIES[paletteIndex]!;
  const eeBucket = finiteEeBucket(options?.eeNormalized);
  const shadeIndex = eeBucket
    ?? homepageBeamShadeIndex(beamId);
  const isServing = options?.isServing === true;
  // Keep the four-level `shadeIndex` API for existing consumers, but interpolate
  // the actual token when EE is finite.  This makes the beam fade every frame
  // instead of waiting for a bucket boundary, which is the visual cue used by
  // the homepage handover story.
  const intensity01 = eeBucket === null
    ? shadeIndex / Math.max(1, HOMEPAGE_SATELLITE_BEAM_LIGHTNESS_LEVELS.length - 1)
    : Math.max(0, Math.min(1, options?.eeNormalized ?? 0));
  const { saturation, lightness } = eeIntensityShade(
    intensity01,
    isServing ? EE_INTENSITY_SERVING_SHADE_RANGE : EE_INTENSITY_CONTEXT_SHADE_RANGE,
  );
  const color = hueFamilyColor(family.hueDegrees, saturation, lightness);
  return Object.freeze({
    satelliteId,
    paletteIndex,
    paletteName: family.name,
    hueDegrees: family.hueDegrees,
    shadeIndex,
    saturation,
    lightness,
    baseColor: homepageSatelliteBaseColor(satelliteId),
    color,
    emissiveColor: hueFamilyColor(
      family.hueDegrees,
      saturation,
      isServing
        ? Math.max(0.36, lightness - 0.12)
        : Math.max(0.56, lightness - 0.10),
    ),
  });
}

/** Paint-only adapter: consumers need the resolved CSS token, not the projection metadata. */
export function homepageSatelliteBeamColor(
  satelliteId: string,
  beamId: number,
  options?: HomepageSatelliteColorOptions,
): string {
  return homepageSatelliteColorForBeam(satelliteId, beamId, options).color;
}

/**
 * The homepage projection expressed as an appearance IDENTITY SOURCE.
 *
 * `src/appearance/` may not import `src/homepage/`, so the mounted-cone
 * appearance owner takes this lookup as an argument instead. Building it here,
 * once, is what stops the cone mount and the callout mount from each writing
 * their own `homepageSatelliteBeamColor(...)` call with slightly different
 * arguments — which is exactly how they came to disagree.
 *
 * `isServingOrCandidate` arrives from the appearance ladder, which is the one
 * place that decides it; this adapter only forwards it.
 */
export function homepageBeamIdentityLookup(
  eeByKey: ReadonlyMap<string, number | null> | null | undefined,
): (satelliteId: string, beamId: number, isServingOrCandidate?: boolean) => string {
  return (satelliteId, beamId, isServingOrCandidate) => homepageSatelliteBeamColor(
    satelliteId,
    beamId,
    {
      isServing: isServingOrCandidate === true,
      eeNormalized: eeByKey?.get(`${satelliteId}:${beamId}`),
    },
  );
}
