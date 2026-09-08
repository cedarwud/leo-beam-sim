/**
 * Serving-identity colour and satellite hue — THE ONE low-level authority.
 *
 * Consolidation SDD §3.2 (kills Bug E): both the SINR-live serving CONE
 * (`SinrLiveCellBeamCones`) and the UE serving MARKER (`sinrServingMosaic`) colour
 * by this single function of (satId, beamId), so a served UE's dot is the SAME
 * colour as the cone of the beam serving it — the user can match a UE to its beam
 * by colour. Before this, cones used the geographic frequency-reuse palette
 * (`cellId mod reuse`) while UE markers used a serving-identity hash → the same
 * (sat, cell) rendered two different colours and beam↔UE could not be matched.
 *
 * The palette is a STABLE allocation from the satellite identity plus a beam
 * lightness step: Walker spacecraft use an interleaved ID-derived palette slot
 * (adjacent spacecraft deliberately land in contrasting families), while
 * arbitrary IDs use a deterministic hash. Beams of one satellite keep one
 * non-red hue family (intra-HO = a shade shift), a different satellite is a hue
 * jump (inter-HO = a family change), and a dot/cone recolours IFF its serving
 * beam actually changed (no display-order frame-churn —
 * frontend-render-governance.md §6).
 *
 * The 16-slot identity palette and the homepage's 16→6 projection live here
 * together. `src/appearance/satelliteIdentityPalette.ts` is only the
 * appearance-facing import surface; it deliberately contains no second table.
 *
 * Lives in `constants/` (not `scene/`) on purpose: BOTH the cone resolver
 * (`viz/`) and the UE mosaic (`scene/`) import DOWN into it, so there is no
 * `constants/`→`scene/` layering inversion. Display-only (CLAUDE.md Rule#6): it
 * derives a colour from an already-computed serving (satId, beamId); it reads no
 * SINR and alters no serving / handover / geometry truth.
 *
 * ⚠️ ARG NAME: on the sinr-live earth-fixed CELL lane the "beam" unit is the
 * CELL id — the cone resolver passes `beam.cellId`, the UE mosaic passes
 * `ue.cellId`. Pass the SAME id on both sides or the two colours diverge and the
 * colour-match invariant false-greens.
 */

/** Marker/cone colour pair for one serving (satId, beamId). */
export interface ServingIdentityColor {
  readonly markerColor: string;
  readonly markerEmissive: string;
}

export const SERVING_IDENTITY_SATURATION = 0.72;
/**
 * Deliberately interleaved hue families for the satellites shown in the scene.
 *
 * The order is not a rainbow on purpose: adjacent palette slots jump between
 * warm/cool and green/purple families, so two spacecraft that happen to hash
 * to neighbouring slots do not collapse into one yellow/green/blue-looking
 * group.  Red/carmine slots are excluded, and the blue/violet entries use a
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

/**
 * A contrast-optimised permutation makes neighbouring Walker IDs use distant
 * palette slots. This is intentionally separate from the palette's hue order:
 * the sequence alternates warm/cool and green/purple families instead of
 * walking through three visually similar colours. The palette has 16 entries,
 * so the permutation is a complete deterministic cycle and can be rotated by a
 * shell namespace without changing contrast.
 */
const INTERLEAVED_PALETTE_SLOTS = [
  // Keep the one-plane audit sequence well separated while avoiding the
  // cyan/green and blue/violet near-collisions seen in the handover trace.
  6, 12, 0, 15, 1, 13, 14, 2,
  8, 7, 9, 5, 11, 3, 4, 10,
] as const;

/**
 * Walker planes use a separate stride before entering the interleaved cycle.
 * A stride of 14 keeps plane-to-plane handover pairs out of the same nearby
 * hue slots while the slot coordinate still walks the complete 16-colour
 * cycle. This is presentation-only; it does not alter the orbital phase.
 */
const WALKER_PLANE_PALETTE_STRIDE = 14;

/** Six compact homepage families projected from the canonical source slots. */
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

/** Compact projection; collisions are intentional and are carried by non-hue cues. */
const HOMEPAGE_SOURCE_SLOT_TO_FAMILY = Object.freeze([
  2, 5, 1, 5, 2, 4, 2, 3,
  2, 5, 5, 1, 1, 4, 0, 3,
] as const);

/**
 * Seven explicit same-satellite shade levels.  The cell-truth lane exposes
 * seven configured beams, so a five-step cycle made beam 2 and beam 7 share a
 * colour and made an intra-satellite switch look like a no-op.  The hue
 * remains the satellite identity cue; the lightness step identifies the beam.
 */
// Keep the seven beam steps far enough apart that an intra-satellite switch is
// visible in the short handover envelope.  The previous 0.06 staircase made
// B2/B7 look almost identical once the GLB/material and dark-scene compositing
// were applied.
const SERVING_IDENTITY_BEAM_LIGHTNESS_LEVELS = [0.56, 0.64, 0.72, 0.80, 0.87, 0.92, 0.96, 0.99] as const;
// Blue/violet hues need a higher floor on the dark globe.  This rail also keeps
// the same-satellite shade separation; it only lifts the family rather than
// changing the satellite/beam identity contract.
const SERVING_IDENTITY_BLUE_BEAM_LIGHTNESS_LEVELS = [0.72, 0.78, 0.84, 0.89, 0.93, 0.96, 0.98, 0.99] as const;

/**
 * THE beam-id → shade-rung mapping for the full serving projection.
 *
 * This deliberately knows the index arithmetic but not the lightness values:
 * `SERVING_IDENTITY_*_LIGHTNESS_LEVELS` is the separate ladder decision. The
 * homepage calls the same mapping with its four-rung compact projection, so
 * that surface remains intentionally remapped rather than flattened into the
 * full scene ladder.
 */
export function servingBeamShadeIndex(beamId: number, shadeCount: number): number {
  const normalizedBeamId = Number.isFinite(beamId) ? Math.abs(Math.trunc(beamId)) : 0;
  return normalizedBeamId % shadeCount;
}

/** FNV-1a string hash → [0, 1). Deterministic, display-order independent. */
function hashStringToUnit(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 1_000_000) / 1_000_000;
}

/** Pure HSL→hex (h,s,l in [0,1]); avoids a THREE dependency in the model. */
function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number): string => {
    const k = (n + h * 12) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

interface HslColor {
  readonly hue: number;
  readonly saturation: number;
  readonly lightness: number;
}

function hexToHsl(color: string): HslColor | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(color.trim());
  if (match === null) return null;
  const channels = match[1]!.match(/../g)!.map(channel => Number.parseInt(channel, 16) / 255);
  const [red, green, blue] = channels;
  const maximum = Math.max(red!, green!, blue!);
  const minimum = Math.min(red!, green!, blue!);
  const delta = maximum - minimum;
  const lightness = (maximum + minimum) / 2;
  if (delta <= Number.EPSILON) {
    return { hue: 0, saturation: 0, lightness };
  }
  const saturation = delta / (1 - Math.abs((2 * lightness) - 1));
  const hue = maximum === red
    ? ((green! - blue!) / delta) % 6
    : maximum === green
      ? ((blue! - red!) / delta) + 2
      : ((red! - green!) / delta) + 4;
  return {
    hue: ((hue / 6) % 1 + 1) % 1,
    saturation,
    lightness,
  };
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Make the two sides of an intra-satellite handover readable for the short
 * transition envelope while retaining the allocated satellite hue.  This is
 * intentionally a transient render treatment: steady-state beam colours and
 * the right-rail identity allocation continue to use their original tokens.
 * The source is a restrained darker shade and the target is a brighter shade;
 * both are derived from the same input hue, so the change cannot be mistaken
 * for an inter-satellite identity swap or for a role colour.
 */
export function emphasizeIntraHandoverColor(
  color: string,
  side: 'source' | 'target',
): string {
  const hsl = hexToHsl(color);
  if (hsl === null) return color;
  const saturation = clampUnit(Math.max(0.78, Math.min(0.92, hsl.saturation * 1.12)));
  const lightness = side === 'source'
    ? Math.min(0.62, Math.max(0.42, hsl.lightness * 0.64 + 0.12))
    : Math.min(0.94, Math.max(0.74, hsl.lightness * 0.50 + 0.48));
  return hslToHex(hsl.hue, saturation, lightness);
}

function positiveModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

/**
 * Stable palette slot for one satellite. Exported so the candidate rail can
 * consume the same identity table as the Three.js scene instead of allocating
 * a second role-dependent colour for the same spacecraft.
 */
export function servingIdentityPaletteIndex(satId: string): number {
  // Walker IDs are emitted as `${shellId}-P${plane}-S${slot}`. Use those
  // semantic coordinates when present so a display-order reshuffle cannot
  // make adjacent spacecraft collapse into the same yellow/green/blue family.
  // The shell namespace offset keeps two shells with the same P/S coordinates
  // from receiving the exact same first colour while preserving the local
  // interleaving within each shell.
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

export function servingIdentityPaletteColorAt(index: number): string {
  const paletteEntry = SERVING_IDENTITY_PALETTE[
    positiveModulo(Math.trunc(index), SERVING_IDENTITY_PALETTE.length)
  ]!;
  return hslToHex(
    paletteEntry.hueDegrees / 360,
    SERVING_IDENTITY_SATURATION,
    paletteEntry.baseLightness,
  );
}

export function servingIdentityPaletteHueAt(index: number): number {
  return SERVING_IDENTITY_PALETTE[
    positiveModulo(Math.trunc(index), SERVING_IDENTITY_PALETTE.length)
  ]!.hueDegrees;
}

export function servingIdentityPaletteNameAt(index: number): string {
  return SERVING_IDENTITY_PALETTE_NAMES[
    positiveModulo(Math.trunc(index), SERVING_IDENTITY_PALETTE_NAMES.length)
  ]!;
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

/** Homepage-only identity projection; non-homepage lanes fall through. */
export function resolveHomepageSatelliteIdentityColor(
  satelliteId: string,
  homepageVisualIdentity: boolean,
): string | undefined {
  return homepageVisualIdentity ? homepageSatelliteBaseColor(satelliteId) : undefined;
}

function paletteEntryForServingSatellite(satId: string) {
  return SERVING_IDENTITY_PALETTE[servingIdentityPaletteIndex(satId)]!;
}

/**
 * Stable, vivid serving-identity colour for a serving (satId, beamId):
 * - the satellite identity drives a stable, non-red HUE FAMILY;
 * - the beam selects a lightness step only, so beams of the same satellite keep
 *   exactly one hue family (intra-HO = a shade shift) while a different
 *   satellite is a hue jump (inter-HO = a family change).
 */
export function colorForServingBeam(satId: string, beamId: number): ServingIdentityColor {
  const paletteEntry = paletteEntryForServingSatellite(satId);
  const satHue = paletteEntry.hueDegrees / 360;
  const hue = satHue;
  const isBluePurpleFamily = paletteEntry.hueDegrees >= 200 && paletteEntry.hueDegrees <= 300;
  // Blue/cyan/purple identities use a lifted range so even their darkest beam
  // shade cannot read as navy or a near-black violet against the dark globe.
  // Other identities use a broader range to make adjacent beam IDs visibly
  // distinguishable without changing the satellite hue.
  const lightnessLevels = isBluePurpleFamily
    ? SERVING_IDENTITY_BLUE_BEAM_LIGHTNESS_LEVELS
    : SERVING_IDENTITY_BEAM_LIGHTNESS_LEVELS;
  const lightness = lightnessLevels[servingBeamShadeIndex(beamId, lightnessLevels.length)]!;
  return {
    markerColor: hslToHex(hue, SERVING_IDENTITY_SATURATION, lightness),
    markerEmissive: hslToHex(hue, SERVING_IDENTITY_SATURATION, Math.max(0.28, lightness - 0.18)),
  };
}

/**
 * Per-SATELLITE hue (semantic-beam-colour SDD §5, owner-chosen Option A): a stable
 * colour from the satellite identity ALONE — no per-beam hue jitter, no per-cell
 * lightness step. The sinr-live UE mosaic colours its ground dots by this, so the ~100
 * dots partition by SERVING SATELLITE ("these UEs belong to sat X") — far fewer colours
 * than the per-(satId, cellId) {@link colorForServingBeam} rainbow, a partition the
 * viewer reads without a legend.
 *
 * Trade-off (owner-accepted): an INTRA handover (same sat, beam→beam) no longer recolours
 * a per-satellite UE dot — the cone/ring shade transition carries the intra story;
 * only an INTER handover (a serving-satellite change) repartitions the dots' colour. The
 * hue is the SAME non-red family anchor used by `colorForServingBeam`, so a
 * satellite's beam shades stay centred on one readable hue. Display-only
 * (CLAUDE.md Rule#6): derives a colour from an already-computed serving satId; reads no
 * SINR, alters no truth.
 */
export function colorForServingSatellite(satId: string): ServingIdentityColor {
  const paletteEntry = paletteEntryForServingSatellite(satId);
  const hue = paletteEntry.hueDegrees / 360;
  const lightness = paletteEntry.baseLightness;
  return {
    markerColor: hslToHex(hue, SERVING_IDENTITY_SATURATION, lightness),
    markerEmissive: hslToHex(hue, SERVING_IDENTITY_SATURATION, Math.max(0.28, lightness - 0.18)),
  };
}
