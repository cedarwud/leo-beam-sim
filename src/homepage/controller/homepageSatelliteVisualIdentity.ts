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

function positiveModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

function hslToHex(hueDegrees: number, saturation: number, lightness: number): string {
  const h = positiveModulo(hueDegrees, 360) / 360;
  const boundedSaturation = Math.min(1, Math.max(0, saturation));
  const boundedLightness = Math.min(1, Math.max(0, lightness));
  const a = boundedSaturation * Math.min(boundedLightness, 1 - boundedLightness);
  const channel = (n: number): string => {
    const k = positiveModulo(n + h * 12, 12);
    const c = boundedLightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
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

/** Lower EE is visibly quieter while the beam remains on the same hue family. */
export function homepageEeVisualOpacity(
  eeNormalized: number | null | undefined,
): number {
  if (typeof eeNormalized !== 'number' || !Number.isFinite(eeNormalized)) return 1;
  return 0.30 + 0.70 * Math.max(0, Math.min(1, eeNormalized));
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
  const mix = (low: number, high: number): number => low + (high - low) * intensity01;
  const saturation = isServing
    ? mix(0.70, 0.88)
    : mix(0.40, 0.56);
  const lightness = isServing
    ? mix(0.72, 0.48)
    : mix(0.74, 0.52);
  const color = hslToHex(family.hueDegrees, saturation, lightness);
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
    emissiveColor: hslToHex(
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
