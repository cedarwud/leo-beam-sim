/**
 * THE satellite identity hue/palette authority.
 *
 * A satellite's identity is the stable hue family allocated from its id. The
 * serving scene and the compact homepage use different resolutions of that
 * same decision: the scene keeps all sixteen source slots, while the homepage
 * compresses them into six readable families. Both tables live here so changing
 * the identity palette is one edit and cannot make those surfaces drift apart.
 *
 * Beam lightness, EE intensity, prominence, and handover shading are not owned
 * here. They are projections or modifiers applied after this hue decision, so
 * an intra-satellite beam switch can change shade without changing identity.
 *
 * Pure by construction: no React, no canvas, no refs, no clock, and no import
 * from a renderer or controller.
 */

export const SERVING_IDENTITY_SATURATION = 0.72;

/**
 * Deliberately interleaved hue families for the satellites shown in the scene.
 *
 * The order is not a rainbow on purpose: adjacent palette slots jump between
 * warm/cool and green/purple families, so two spacecraft that happen to hash
 * to neighbouring slots do not collapse into one yellow/green/blue-looking
 * group. Red/carmine slots are excluded, and the blue/violet entries use a
 * higher base lightness so they never become the deep navy accent that was
 * previously hard to read against the dark globe.
 */
const SERVING_IDENTITY_PALETTE = [
  { hueDegrees: 48, baseLightness: 0.60 },  // gold
  { hueDegrees: 216, baseLightness: 0.76 }, // sky (lifted)
  { hueDegrees: 78, baseLightness: 0.54 },  // lime (separated from spring)
  { hueDegrees: 264, baseLightness: 0.78 }, // violet (lifted purple)
  { hueDegrees: 168, baseLightness: 0.60 }, // mint
  { hueDegrees: 232, baseLightness: 0.80 }, // periwinkle (lifted blue)
  { hueDegrees: 60, baseLightness: 0.61 },  // yellow-green
  { hueDegrees: 300, baseLightness: 0.80 }, // orchid (lifted purple)
  { hueDegrees: 184, baseLightness: 0.57 }, // cyan (separated from indigo)
  { hueDegrees: 126, baseLightness: 0.72 }, // green (separated from lime)
  { hueDegrees: 242, baseLightness: 0.80 }, // indigo (lifted blue)
  { hueDegrees: 32, baseLightness: 0.62 },  // amber
  { hueDegrees: 202, baseLightness: 0.76 }, // azure (lifted)
  { hueDegrees: 108, baseLightness: 0.78 }, // spring green (separated from lime)
  { hueDegrees: 280, baseLightness: 0.82 }, // purple (lifted purple)
  { hueDegrees: 144, baseLightness: 0.64 }, // seafoam (separated from spring)
] as const;

const SERVING_IDENTITY_PALETTE_NAMES = [
  'gold',
  'sky',
  'lime',
  'violet',
  'mint',
  'periwinkle',
  'yellow-green',
  'orchid',
  'cyan',
  'green',
  'indigo',
  'amber',
  'azure',
  'spring',
  'purple',
  'seafoam',
] as const;

/** Contrast-optimised source-slot order for one Walker plane. */
const INTERLEAVED_PALETTE_SLOTS = [
  6, 12, 0, 15, 1, 13, 14, 2,
  8, 7, 9, 5, 11, 3, 4, 10,
] as const;

/** Plane stride keeps plane-to-plane pairs out of nearby hue slots. */
const WALKER_PLANE_PALETTE_STRIDE = 14;

/** Six compact families are the homepage projection of the same source slots. */
export const HOMEPAGE_SATELLITE_COLOR_COUNT = 6 as const;

export const HOMEPAGE_SATELLITE_HUE_FAMILIES = Object.freeze([
  Object.freeze({ name: 'gold', hueDegrees: 55 }),
  Object.freeze({ name: 'blue', hueDegrees: 225 }),
  Object.freeze({ name: 'green', hueDegrees: 115 }),
  Object.freeze({ name: 'cyan', hueDegrees: 190 }),
  Object.freeze({ name: 'teal', hueDegrees: 155 }),
  Object.freeze({ name: 'orange', hueDegrees: 25 }),
] as const);

export const HOMEPAGE_SATELLITE_PALETTE_REFERENCE_IDS = Object.freeze([
  'homepage-palette-ref-6',
  'homepage-palette-ref-3',
  'homepage-palette-ref-2',
  'homepage-palette-ref-4',
  'homepage-palette-ref-1',
  'homepage-palette-ref-0',
] as const);

/**
 * Compress the sixteen source slots without reintroducing neighbouring
 * near-colours. The homepage may intentionally collide distinct satellites;
 * labels, glyphs, lightness, and opacity carry the remaining identity load.
 */
const HOMEPAGE_SOURCE_SLOT_TO_FAMILY = Object.freeze([
  2, 5, 1, 5, 2, 4, 2, 3,
  2, 5, 5, 1, 1, 4, 0, 3,
] as const);

function positiveModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

function hslToHex(h: number, saturation: number, lightness: number): string {
  const a = saturation * Math.min(lightness, 1 - lightness);
  const channel = (n: number): string => {
    const k = (n + h * 12) % 12;
    const c = lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

function hashStringToUnit(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 1_000_000) / 1_000_000;
}

/** Stable source palette slot for one satellite id. */
export function servingIdentityPaletteIndex(satId: string): number {
  const walkerMatch = /^(.*)-P(\d+)-S(\d+)$/.exec(satId);
  const paletteIndex = walkerMatch === null
    ? Math.floor(hashStringToUnit(satId) * SERVING_IDENTITY_PALETTE.length)
    : (() => {
      const namespaceOffset = Math.floor(
        hashStringToUnit(walkerMatch[1] ?? '') * SERVING_IDENTITY_PALETTE.length,
      );
      const planeIndex = Number(walkerMatch[2]);
      const slotIndex = Number(walkerMatch[3]);
      const ordinal = namespaceOffset + planeIndex * WALKER_PLANE_PALETTE_STRIDE + slotIndex;
      const cycleIndex = positiveModulo(ordinal, INTERLEAVED_PALETTE_SLOTS.length);
      return INTERLEAVED_PALETTE_SLOTS[cycleIndex]!;
    })();
  return positiveModulo(paletteIndex, SERVING_IDENTITY_PALETTE.length);
}

function paletteEntryAt(index: number) {
  return SERVING_IDENTITY_PALETTE[
    positiveModulo(Math.trunc(index), SERVING_IDENTITY_PALETTE.length)
  ]!;
}

export function servingIdentityPaletteColorAt(index: number): string {
  const paletteEntry = paletteEntryAt(index);
  return hslToHex(
    paletteEntry.hueDegrees / 360,
    SERVING_IDENTITY_SATURATION,
    paletteEntry.baseLightness,
  );
}

export function servingIdentityPaletteHueAt(index: number): number {
  return paletteEntryAt(index).hueDegrees;
}

export function servingIdentityPaletteNameAt(index: number): string {
  return SERVING_IDENTITY_PALETTE_NAMES[
    positiveModulo(Math.trunc(index), SERVING_IDENTITY_PALETTE_NAMES.length)
  ]!;
}

/** Stable serving identity colour; beam shade composition remains elsewhere. */
export function colorForServingSatellite(satId: string): {
  readonly markerColor: string;
  readonly markerEmissive: string;
} {
  const paletteEntry = paletteEntryAt(servingIdentityPaletteIndex(satId));
  const hue = paletteEntry.hueDegrees / 360;
  const lightness = paletteEntry.baseLightness;
  return {
    markerColor: hslToHex(hue, SERVING_IDENTITY_SATURATION, lightness),
    markerEmissive: hslToHex(hue, SERVING_IDENTITY_SATURATION, Math.max(0.28, lightness - 0.18)),
  };
}

/** Homepage compact family derived from the canonical source palette slot. */
export function homepageSatellitePaletteIndex(
  satelliteId: string,
  _identityPaletteIndex?: number | null,
): number {
  const sourceSlot = positiveModulo(
    servingIdentityPaletteIndex(satelliteId),
    HOMEPAGE_SOURCE_SLOT_TO_FAMILY.length,
  );
  return HOMEPAGE_SOURCE_SLOT_TO_FAMILY[sourceSlot]!;
}

export function homepageSatelliteBaseColor(
  satelliteId: string,
  _identityPaletteIndex?: number | null,
): string {
  const family = HOMEPAGE_SATELLITE_HUE_FAMILIES[homepageSatellitePaletteIndex(satelliteId)]!;
  return hslToHex(family.hueDegrees / 360, 0.72, 0.58);
}

/**
 * The compact projection is present only on the homepage root. Other lanes
 * deliberately return `undefined` so the shared ladder can continue to the
 * accepted snapshot or deterministic identity without changing their palette.
 */
export function resolveHomepageSatelliteIdentityColor(
  satelliteId: string,
  homepageVisualIdentity: boolean,
): string | undefined {
  return homepageVisualIdentity ? homepageSatelliteBaseColor(satelliteId) : undefined;
}
