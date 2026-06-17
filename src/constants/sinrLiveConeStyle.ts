/**
 * SINR-live cell-cone render STYLE tokens — consolidation S5-2 (D-TOKEN,
 * docs/s5-one-beam-render-plan.md §4).
 *
 * The ONE place the un-parked cell-truth cone render's visual style lives, so the
 * "one cone renderer per lane" has a single style source instead of literals
 * scattered across `SinrLiveCellBeamCones` + `MainScene`. New module (not an
 * extension of the 479-line `beamRoleTokens`) for a small blast radius during the
 * frozen-beam slice and cleaner VALUE asserts.
 *
 * The HYBRID look (D-STYLE A → hybrid, user-locked 2026-06-11; screenshot-tuned
 * on :3000):
 *  - AMBIENT: EVERY serving sat's cone, FAINT, so every serving sat is beamed
 *    (the connected-sat-has-beam must-hold) without washing the map. RE-TUNED to
 *    0.14 (A2, consolidation SDD §8): the original 0.08 was "present but invisible"
 *    (the "connected sat, no [visible] beam" complaint), and three de-tangling
 *    features added since let a higher level read clean — the apex→base alpha fade
 *    ({@link SINR_LIVE_CONE_BASE_ALPHA_FACTOR}), the near-horizon shallow-cone dim,
 *    and the pulled-back initial camera. 0.18+ washes in dense low-overlap slots
 *    (the look the user rejected, screenshot-verified), so 0.14 is the legible-
 *    without-washing setting. NormalBlending alpha-composites each cone to a
 *    bounded translucency — overlaps darken but never white out — so all connected
 *    sats can show a beam at one opacity.
 *  - PAIR: the focused cinema handover pair (old/new cell), BRIGHT, drawn on top
 *    of the ambient layer so the handover story stands out against the faint
 *    field.
 *
 * Cone COLOUR is the SERVING-IDENTITY colour (`colorForServingBeam(satId, cellId)`,
 * `constants/servingColour`) — the same authority the UE mosaic uses, so a cone is
 * the colour of the UE dots it serves (A1, SDD §3.2). It is per-cell DATA set in
 * the pure resolver, not a mesh style knob, so it is not re-homed here. The retired
 * frequency-reuse mapping (`resolveSinrLiveConeColor`) remains below for a future
 * frequency-plan colour mode.
 */
import * as THREE from 'three';
import { frequencyReuseColor } from './beamRoleTokens';

/** Faint ambient cone opacity — every serving sat's beam (screenshot-locked 0.14). */
export const SINR_LIVE_CONE_AMBIENT_OPACITY = 0.14;

/**
 * Bright opacity for the PRIMARY serving satellite's beams (the sat serving the
 * focus/centre UE). The all-serving ambient field reads faint (0.14) so the
 * multibeam context does not blow out, but the one satellite actually serving the
 * protagonist should read SATURATED + BRIGHT like the original steered serving cone
 * (BEAM_ROLE_TOKENS.serving was 0.58). It is exempt from the near-horizon dim so the
 * hero beam always pops, even at moderate elevation. Display-only; serving truth +
 * cone count unchanged.
 */
export const SINR_LIVE_CONE_SERVING_PRIMARY_OPACITY = 0.52;

/**
 * Display palette for the live beam field (a-cone follow-up). The PRIMARY serving
 * beam (the one serving the centre UE) reads SATURATED YELLOW so it pops as "your
 * serving beam". The ONE handover-candidate beam (the inter-sat target the centre
 * UE is about to switch to) reads SATURATED CYAN-BLUE + bright so it stands out as
 * "the beam you're about to hand over to". Every OTHER beam keeps the geographic
 * frequency-reuse palette (faint context — NOT recoloured). These overrides apply
 * only where MainScene passes them; the cinema pair/pulse + vc1c/vc2 fixtures keep
 * resolveSinrLiveConeColor untouched. Display-only.
 */
export const SINR_LIVE_CONE_SERVING_PRIMARY_COLOR = '#facc15';
// Cyan-leaning blue (not the #3b82f6 indigo that read as purple over terrain).
export const SINR_LIVE_CONE_CANDIDATE_COLOR = '#0ea5e9';
/** Bright opacity for the single handover-candidate beam so it is clearly visible. */
export const SINR_LIVE_CONE_CANDIDATE_OPACITY = 0.6;

/**
 * Bright focused handover-pair cone opacity (cinema), drawn over the ambient
 * field so the old/new handover cells read against the faint all-serving layer.
 */
export const SINR_LIVE_CONE_PAIR_OPACITY = 0.3;

/**
 * G2c ambient live-handover PULSE peak opacity. When a real per-frame handover
 * fires (`frame.sinrLiveCells.recentHandoverEvents`), its old/new cells flare
 * BRIGHT then fade to 0 over the retention window
 * ({@link ../scene/sinrLiveCellModel.SINR_LIVE_RECENT_HANDOVER_RETENTION_SEC}) —
 * a continuous, no-seek/no-camera "handovers are happening" pulse on the faint
 * ambient field. Slightly brighter than the static director pair so a live flash
 * reads against it; the age-fade (not a fixed value) is what makes it a pulse.
 */
export const SINR_LIVE_CONE_PULSE_PEAK_OPACITY = 0.32;

/**
 * Dim opacity for the OPT-IN non-serving cone layer (Tier-2 show/dim switch,
 * `SceneDisplayConfig.showNonServingCones`, default OFF). Dimmer than the ambient
 * serving field ({@link SINR_LIVE_CONE_AMBIENT_OPACITY} = 0.14) so co-channel /
 * non-serving illuminated beams read as faint background context behind the
 * serving cones, never competing with them. Display-only (Rule#6): showing these
 * cones reads non-serving `illuminatedBeams` and changes no serving/SINR truth.
 */
export const SINR_LIVE_CONE_NONSERVING_OPACITY = 0.04;

/** Segments around the flat ground footprint ring of each oblique cone. */
export const SINR_LIVE_CONE_SEGMENTS = 32;

/**
 * G1-CONE-STYLE apex→base alpha fade. Each cone is brightest at its apex (the
 * serving satellite) and fades toward the flat ground footprint ring, via a
 * per-vertex alpha gradient (RGBA vertex colours, RGB left white so the per-cone
 * `frequencyReuseColor` hue is unchanged — only alpha is graded). The final
 * fragment alpha is `material.opacity × vertexAlpha`, so the per-cone level
 * (ambient {@link SINR_LIVE_CONE_AMBIENT_OPACITY} / pair / pulse) is preserved at
 * the apex and the ground-level overlap — where many cones criss-cross the map —
 * fades to this fraction, de-tangling the field without touching truth (cones are
 * outside the geometry-trace snapshot; the apex stays fully opaque so every
 * serving sat still shows a beam — the connected-sat-has-beam must-hold).
 */
export const SINR_LIVE_CONE_BASE_ALPHA_FACTOR = 0.16;

/**
 * Alpha-composite blending for the cones: bounded, uniform translucency. Additive
 * blending accumulates (no usable middle between too-faint and blown-out at the
 * all-serving population), so NormalBlending is what lets every serving sat show a
 * beam at one moderate opacity.
 */
export const SINR_LIVE_CONE_BLENDING: THREE.Blending = THREE.NormalBlending;

/**
 * Which sinr-live cone LAYER a style is being resolved for. The lane draws three
 * cone layers over the same oblique geometry, each at its own brightness:
 *  - `ambient`: every serving sat's beam, faint, always-on (the base field).
 *  - `pair`: the focused cinema handover pair (old/new cell), bright, on top.
 *  - `pulse`: a real per-frame handover flaring then age-fading (peak brightness).
 *  - `nonServing`: the OPT-IN dim co-channel / non-serving beams (default OFF).
 */
export type SinrLiveConeLayer = 'ambient' | 'pair' | 'pulse' | 'nonServing';

/**
 * The ONE place mapping a cone layer to its base opacity — Tier-2 beam-display
 * seam (mirrors the clean per-role `resolveBeamConeRoleFactors` for the steered
 * cones). Before this, the ambient level was a default inside the renderer, the
 * pair level was picked at the MainScene mount, and the pulse peak was a bare
 * const — so "the ambient cones are too faint / non-serving should be dimmer"
 * had no single edit point. Now every cone layer's opacity is resolved here.
 * Returns the screenshot-locked hybrid values verbatim (D-STYLE A), so this is
 * behaviour-identical; it only consolidates the CHOICE.
 */
export function resolveSinrLiveConeLayerOpacity(layer: SinrLiveConeLayer): number {
  switch (layer) {
    case 'ambient':
      return SINR_LIVE_CONE_AMBIENT_OPACITY;
    case 'pair':
      return SINR_LIVE_CONE_PAIR_OPACITY;
    case 'pulse':
      return SINR_LIVE_CONE_PULSE_PEAK_OPACITY;
    case 'nonServing':
      return SINR_LIVE_CONE_NONSERVING_OPACITY;
  }
}

/**
 * Apparent-elevation DIM band for the ambient cone field — a DISPLAY-only de-
 * emphasis of near-horizontal cones. A satellite that serves a cell while sitting
 * low over the horizon (down to the 15° elevation mask) paints a geometrically
 * SHALLOW cone that reads as "a beam shooting sideways across / off the field"
 * rather than a beam coming DOWN onto a UE. The truth (which sat serves which cell)
 * is unchanged — every serving cone still mounts (the s0:connected-sat-has-beam
 * invariant counts mounted meshes, not opacity); we only fade the ones whose
 * RENDERED apex→base angle is shallow, so the ambient field reads cleanly. Mirrors
 * the steered-beam display's existing "< 35° elevation is an edge sat" intuition
 * (useBeamViz edge penalty). Tunable here, applied in `ObliqueConeMesh` (gated by
 * the ambient mount's `dimShallowCones`).
 */
export const SINR_LIVE_CONE_DIM_ELEVATION_FLOOR_DEG = 22;
export const SINR_LIVE_CONE_DIM_ELEVATION_CEIL_DEG = 42;
export const SINR_LIVE_CONE_DIM_MIN_FACTOR = 0.05;

export function resolveSinrLiveConeElevationDimFactor(apparentElevationDeg: number): number {
  if (!Number.isFinite(apparentElevationDeg)) return 1;
  if (apparentElevationDeg >= SINR_LIVE_CONE_DIM_ELEVATION_CEIL_DEG) return 1;
  if (apparentElevationDeg <= SINR_LIVE_CONE_DIM_ELEVATION_FLOOR_DEG) return SINR_LIVE_CONE_DIM_MIN_FACTOR;
  const t = (apparentElevationDeg - SINR_LIVE_CONE_DIM_ELEVATION_FLOOR_DEG)
    / (SINR_LIVE_CONE_DIM_ELEVATION_CEIL_DEG - SINR_LIVE_CONE_DIM_ELEVATION_FLOOR_DEG);
  return SINR_LIVE_CONE_DIM_MIN_FACTOR + t * (1 - SINR_LIVE_CONE_DIM_MIN_FACTOR);
}

/**
 * The ONE place resolving a sinr-live cone's COLOUR — Tier-2 beam-display seam.
 * Today every sinr-live cone is coloured by the geographic frequency-reuse
 * pattern (`frequencyReuseColor`, `cellId mod reuse` — adjacent cells differ),
 * which was previously called inline at three sites inside the renderer. Routing
 * it through this resolver makes a future re-colour (e.g. by serving-sat tint or
 * SINR band) a single edit instead of a hunt across the renderer. Behaviour-
 * identical: it returns exactly `frequencyReuseColor(frequencyIndex)`.
 */
export function resolveSinrLiveConeColor(frequencyIndex: number): string {
  return frequencyReuseColor(frequencyIndex);
}
