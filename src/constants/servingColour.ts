/**
 * Serving-identity colour — THE ONE authority for "who serves this UE".
 *
 * Consolidation SDD §3.2 (kills Bug E): both the SINR-live serving CONE
 * (`SinrLiveCellBeamCones`) and the UE serving MARKER (`sinrServingMosaic`) colour
 * by this single function of (satId, beamId), so a served UE's dot is the SAME
 * colour as the cone of the beam serving it — the user can match a UE to its beam
 * by colour. Before this, cones used the geographic frequency-reuse palette
 * (`cellId mod reuse`) while UE markers used a serving-identity hash → the same
 * (sat, cell) rendered two different colours and beam↔UE could not be matched.
 *
 * The colour is a STABLE allocation from the satellite identity plus a beam
 * lightness step: Walker spacecraft use an interleaved ID-derived palette slot
 * (adjacent spacecraft deliberately land in contrasting families), while
 * arbitrary IDs use a deterministic hash. Beams of one satellite keep one
 * non-red hue family (intra-HO = a shade shift), a different satellite is a hue
 * jump (inter-HO = a family change), and a dot/cone recolours IFF its serving
 * beam actually changed (no display-order frame-churn —
 * frontend-render-governance.md §6).
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

const SERVING_IDENTITY_SATURATION = 0.72;
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
  { hueDegrees: 208, baseLightness: 0.70 }, // sky
  { hueDegrees: 92, baseLightness: 0.60 },  // lime
  { hueDegrees: 260, baseLightness: 0.66 }, // violet
  { hueDegrees: 164, baseLightness: 0.60 }, // mint
  { hueDegrees: 228, baseLightness: 0.70 }, // periwinkle (lifted blue)
  { hueDegrees: 68, baseLightness: 0.61 },  // yellow-green
  { hueDegrees: 284, baseLightness: 0.66 }, // orchid
  { hueDegrees: 188, baseLightness: 0.64 }, // cyan
  { hueDegrees: 124, baseLightness: 0.60 }, // green
  { hueDegrees: 244, baseLightness: 0.70 }, // indigo (lifted blue)
  { hueDegrees: 52, baseLightness: 0.62 },  // amber
  { hueDegrees: 196, baseLightness: 0.70 }, // azure
  { hueDegrees: 104, baseLightness: 0.61 }, // spring green
  { hueDegrees: 276, baseLightness: 0.66 }, // purple
  { hueDegrees: 148, baseLightness: 0.62 }, // seafoam
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
  5, 0, 14, 2, 3, 6, 1, 11,
  9, 12, 13, 8, 7, 4, 10, 15,
] as const;

/**
 * Walker planes use a separate stride before entering the interleaved cycle.
 * A stride of 14 keeps plane-to-plane handover pairs out of the same nearby
 * hue slots while the slot coordinate still walks the complete 16-colour
 * cycle. This is presentation-only; it does not alter the orbital phase.
 */
const WALKER_PLANE_PALETTE_STRIDE = 14;

/**
 * Five explicit same-satellite shade levels.  A relative +/- offset was too
 * subtle for adjacent beam IDs (and the blue floor collapsed its first two
 * values to the same colour), so the renderer now uses visible 7-point
 * lightness steps.  The hue remains the satellite identity cue.
 */
const SERVING_IDENTITY_BEAM_LIGHTNESS_LEVELS = [0.53, 0.60, 0.67, 0.74, 0.81] as const;
const SERVING_IDENTITY_BLUE_BEAM_LIGHTNESS_LEVELS = [0.64, 0.69, 0.74, 0.79, 0.84] as const;

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
  const beamMod = Math.abs(Math.trunc(beamId));
  const hue = satHue;
  const isBlueFamily = paletteEntry.hueDegrees >= 200 && paletteEntry.hueDegrees <= 255;
  // Blue/cyan identities use a lifted range so even their darkest beam shade
  // cannot read as navy/black against the dark globe.  Other identities use a
  // broader range to make adjacent beam IDs visibly distinguishable.
  const lightnessLevels = isBlueFamily
    ? SERVING_IDENTITY_BLUE_BEAM_LIGHTNESS_LEVELS
    : SERVING_IDENTITY_BEAM_LIGHTNESS_LEVELS;
  const lightness = lightnessLevels[beamMod % lightnessLevels.length]!;
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
