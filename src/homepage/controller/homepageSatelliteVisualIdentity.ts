/**
 * Homepage-only satellite colour projection.
 *
 * This is a presentation adapter, not a second serving/beam authority.  It
 * consumes the already-resolved satellite identity slot from the existing
 * serving-colour allocator, compresses that identity into a small homepage
 * palette, and varies only saturation/lightness for beam roles and shades.
 * Keeping this seam under
 * the homepage controller makes the later SceneProjection/RailProjection
 * integration use the same colour function without changing other routes.
 */

import { servingIdentityPaletteIndex } from '../../constants/servingColour';

export const HOMEPAGE_SATELLITE_COLOR_COUNT = 6 as const;

/** Fixed EE scale shared by the homepage rail and the 3-D beam colours. */
export const HOMEPAGE_EE_COLOR_SCALE_MIN_BITS_PER_JOULE = 80_000;
export const HOMEPAGE_EE_COLOR_SCALE_MAX_BITS_PER_JOULE = 180_000;

/**
 * Six restrained hue families are enough for the compact homepage stage. A
 * satellite may share a family with another satellite; its ID/glyph remains
 * the identity cue. No beam role is allowed to choose a different hue.
 */
export const HOMEPAGE_SATELLITE_HUE_FAMILIES = Object.freeze([
  // Keep the six families visibly separated on the hue wheel. The old 32° /
  // 42° pair was only ten degrees apart, so an inter-satellite handover could
  // read as one amber colour after blending. These anchors avoid red and
  // violet while leaving blue as the only blue/purple-adjacent family.
  Object.freeze({ name: 'gold', hueDegrees: 55 }),
  Object.freeze({ name: 'blue', hueDegrees: 225 }),
  Object.freeze({ name: 'green', hueDegrees: 115 }),
  Object.freeze({ name: 'cyan', hueDegrees: 190 }),
  // Keep the blue family, but remove the adjacent purple/violet family so
  // the homepage never presents blue and purple as competing identities.
  Object.freeze({ name: 'teal', hueDegrees: 155 }),
  Object.freeze({ name: 'orange', hueDegrees: 25 }),
] as const);

/**
 * Lookup-only IDs for the palette catalogues. The IDs are deliberately passed
 * through the same source-slot allocator as runtime satellites; they are not
 * simulation entities and never enter a decision, snapshot, or scene join.
 */
export const HOMEPAGE_SATELLITE_PALETTE_REFERENCE_IDS = Object.freeze([
  'homepage-palette-ref-6',
  'homepage-palette-ref-3',
  'homepage-palette-ref-2',
  'homepage-palette-ref-4',
  'homepage-palette-ref-1',
  'homepage-palette-ref-0',
] as const);

/**
 * Compress the existing 16-slot identity allocator without reintroducing its
 * neighbouring near-colours. The source allocator's Walker order is already
 * an interleaved contrast sequence; this table keeps that order spread across
 * the six homepage families instead of using `slot % 6` (which made adjacent
 * identities collapse onto the same gold/cyan family). The explicit sequence
 * also keeps the representative inter-satellite source/target pairs separated
 * after the 16-slot palette is compressed. The source slot remains the stable
 * identity authority, so the result is independent of render order and
 * unchanged by beam overlap or handover role.
 */
const HOMEPAGE_SOURCE_SLOT_TO_FAMILY = Object.freeze([
  2, 5, 1, 5, 2, 4, 2, 3,
  2, 5, 5, 1, 1, 4, 0, 3,
] as const);

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

function normalizedBeamSlot(beamId: number): number {
  return Number.isFinite(beamId) ? Math.abs(Math.trunc(beamId)) : 0;
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

/** Map the bounded homepage EE value to one fixed visual scale. */
export function homepageEeColorNormalized(
  eeBitsPerJoule: number | null | undefined,
): number | null {
  if (typeof eeBitsPerJoule !== 'number' || !Number.isFinite(eeBitsPerJoule)) return null;
  return Math.max(
    0,
    Math.min(
      1,
      (eeBitsPerJoule - HOMEPAGE_EE_COLOR_SCALE_MIN_BITS_PER_JOULE)
        / (HOMEPAGE_EE_COLOR_SCALE_MAX_BITS_PER_JOULE - HOMEPAGE_EE_COLOR_SCALE_MIN_BITS_PER_JOULE),
    ),
  );
}

/** Lower EE is visibly quieter while the beam remains on the same hue family. */
export function homepageEeVisualOpacity(
  eeNormalized: number | null | undefined,
): number {
  if (typeof eeNormalized !== 'number' || !Number.isFinite(eeNormalized)) return 1;
  return 0.30 + 0.70 * Math.max(0, Math.min(1, eeNormalized));
}

/** Stable compact palette slot derived from the existing identity allocator. */
export function homepageSatellitePaletteIndex(
  satelliteId: string,
  identityPaletteIndex?: number | null,
): number {
  const sourceSlot = positiveModulo(
    Number.isInteger(identityPaletteIndex) && (identityPaletteIndex ?? -1) >= 0
      ? identityPaletteIndex!
      : servingIdentityPaletteIndex(satelliteId),
    HOMEPAGE_SOURCE_SLOT_TO_FAMILY.length,
  );
  return HOMEPAGE_SOURCE_SLOT_TO_FAMILY[sourceSlot]!;
}

/** One satellite's base hue token, independent of beam and render order. */
export function homepageSatelliteBaseColor(
  satelliteId: string,
  identityPaletteIndex?: number | null,
): string {
  const paletteIndex = homepageSatellitePaletteIndex(satelliteId, identityPaletteIndex);
  const family = HOMEPAGE_SATELLITE_HUE_FAMILIES[paletteIndex]!;
  return hslToHex(
    family.hueDegrees,
    HOMEPAGE_SATELLITE_BASE_SATURATION,
    HOMEPAGE_SATELLITE_BASE_LIGHTNESS,
  );
}

/**
 * Resolve one beam without changing the satellite hue family.  A finite EE
 * value selects the intensity bucket; otherwise the beam slot remains the
 * deterministic fallback for existing callers.  Serving beams stay vivid,
 * while non-serving/unknown beams are pale context.  Repeated beams receive
 * the exact same token rather than an opacity-dependent colour.
 */
export function homepageSatelliteColorForBeam(
  satelliteId: string,
  beamId: number,
  options?: HomepageSatelliteColorOptions,
): HomepageSatelliteVisualColor {
  const paletteIndex = homepageSatellitePaletteIndex(satelliteId, options?.identityPaletteIndex);
  const family = HOMEPAGE_SATELLITE_HUE_FAMILIES[paletteIndex]!;
  const eeBucket = finiteEeBucket(options?.eeNormalized);
  const shadeIndex = eeBucket
    ?? normalizedBeamSlot(beamId) % HOMEPAGE_SATELLITE_BEAM_LIGHTNESS_LEVELS.length;
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
    baseColor: homepageSatelliteBaseColor(satelliteId, options?.identityPaletteIndex),
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
