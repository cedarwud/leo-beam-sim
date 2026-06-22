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
 * The colour is a STABLE hash of (satId, beamId): the satellite identity drives
 * the HUE FAMILY, the beam a small hue jitter + lightness step — so beams of one
 * satellite are a colour family (intra-HO = a shade shift), a different satellite
 * is a hue jump (inter-HO = a family change), and a dot/cone recolours IFF its
 * serving beam actually changed (no display-order frame-churn —
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

/**
 * Stable, vivid serving-identity colour for a serving (satId, beamId):
 * - the satellite identity drives the HUE FAMILY (stable string hash);
 * - the beam drives a small hue jitter + lightness step, so beams of the same
 *   satellite are a colour family (intra-HO = a shade shift) while a different
 *   satellite is a hue jump (inter-HO = a family change).
 */
export function colorForServingBeam(satId: string, beamId: number): ServingIdentityColor {
  const satHue = hashStringToUnit(satId);
  const beamMod = Math.abs(Math.trunc(beamId));
  const beamHueJitter = ((beamMod % 6) - 2.5) / 60; // ±~0.04 in hue space
  const hue = ((satHue + beamHueJitter) % 1 + 1) % 1;
  const lightness = 0.52 + (beamMod % 3) * 0.07; // 0.52 .. 0.66
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
 * a dot — the cone's releasing-orange→acquired-green flash carries the intra story now;
 * only an INTER handover (a serving-satellite change) repartitions the dots' colour. The
 * hue is the SAME `hashStringToUnit(satId)` family anchor `colorForServingBeam` jitters
 * around, so a sat's (retired) per-cell family still centres on this hue. Display-only
 * (CLAUDE.md Rule#6): derives a colour from an already-computed serving satId; reads no
 * SINR, alters no truth.
 */
export function colorForServingSatellite(satId: string): ServingIdentityColor {
  const hue = hashStringToUnit(satId);
  const lightness = 0.55;
  return {
    markerColor: hslToHex(hue, SERVING_IDENTITY_SATURATION, lightness),
    markerEmissive: hslToHex(hue, SERVING_IDENTITY_SATURATION, Math.max(0.28, lightness - 0.18)),
  };
}
