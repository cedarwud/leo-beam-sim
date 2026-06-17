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
 *
 * beam-stage ① #3 (legible footprint circles): lowered 0.52 → 0.36 so the bright
 * hero FILL no longer blobs over the cell footprint RINGS — the crisp ground ring
 * (`SinrLiveCellFootprintRings`) is now the dominant "this is a beam circle" cue,
 * with the fill a supporting wash. The hero still reads brightest of the field.
 */
export const SINR_LIVE_CONE_SERVING_PRIMARY_OPACITY = 0.36;

/**
 * Cell-truth footprint RING style (beam-stage ① #3 — legible circles).
 * {@link SinrLiveCellFootprintRings} draws one crisp ground ring per SERVING cell,
 * at the SAME cell-truth base centre / radius / serving-identity colour as the
 * serving cone, so each beam reads as a distinct CIRCLE with its UEs scattered
 * off-centre inside it (it REPLACES the legacy steered `AmbientFootprintRings`,
 * which sat at the wrong — steered — positions). Display-only (Rule#6).
 */
export const SINR_LIVE_FOOTPRINT_RING_OPACITY = 0.55;
/** Ring inner edge as a fraction of the footprint radius (→ a thin crisp annulus). */
export const SINR_LIVE_FOOTPRINT_RING_INNER_FACTOR = 0.93;
/** Ring tessellation (matches the cone base segment count for a smooth circle). */
export const SINR_LIVE_FOOTPRINT_RING_SEGMENTS = 64;
/** Tiny ground lift (world units) so the flat ring never z-fights the terrain. */
export const SINR_LIVE_FOOTPRINT_RING_Y_LIFT = 0.6;

/**
 * TRIGGERED intra-HO flash style (beam-stage ① #5 — the protagonist jog handover).
 *
 * The ambient live-handover pulse fades over SIM-TIME ({@link SINR_LIVE_RECENT_HANDOVER_RETENTION_SEC}
 * = 4 s), which at the 5× demo speed collapses to ~0.8 s of WALL-CLOCK — too brief +
 * faint (0.32) to read, and undirectional (old + new both the serving-identity hue).
 * The TRIGGERED intra (the deliberate jog) instead gets a WALL-CLOCK 2.5 s fade
 * (decoupled from sim speed, so it always reads) with a FROM/TO COLOUR SPLIT — the
 * old (handed-off) cell warm, the new (acquired) cell cool — so the handover DIRECTION
 * is legible. This is what makes it DISTINCT from the ambient pulse (owner choice A:
 * colour-split + ~2.5 s sustain, no slow-mo / no camera). Display-only (Rule#6).
 */
export const SINR_LIVE_TRIGGERED_INTRA_SUSTAIN_MS = 2500;
/** Peak (age-0) opacity of the triggered flash — brighter than the ambient pulse (0.32). */
export const SINR_LIVE_TRIGGERED_INTRA_PEAK_OPACITY = 0.62;
/** OLD (handed-off) cell colour — WARM amber, "leaving". */
export const SINR_LIVE_TRIGGERED_INTRA_FROM_COLOR = '#f5a524';
/** NEW (acquired) cell colour — COOL cyan, "arriving". */
export const SINR_LIVE_TRIGGERED_INTRA_TO_COLOR = '#22d3ee';

/**
 * Display palette for the live beam field (a-cone follow-up). The PRIMARY serving
 * beam (the one serving the centre UE) reads SATURATED YELLOW so it pops as "your
 * serving beam". Every OTHER beam keeps the geographic frequency-reuse palette
 * (faint context — NOT recoloured). This override applies only where MainScene
 * passes it (the hero cone); the pulse + vc1c/vc2 fixtures keep
 * resolveSinrLiveConeColor untouched. Display-only.
 */
export const SINR_LIVE_CONE_SERVING_PRIMARY_COLOR = '#facc15';

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
 * C2 (Bug H): per-KIND pulse colours so a fired handover reads as intra vs inter at
 * a glance, instead of every pulse flaring in its serving-identity hue. The pulse
 * resolver tags each cone with the truth `event.kind` (`sinrLiveCellModel`); the
 * render maps that to one of these via `beamDisplaySpec.pulseIntraColor /
 * pulseInterColor`, falling back to the serving-identity colour when a cone carries
 * no kind (every non-pulse layer). Display-only (Rule#6): the colour is a read-out
 * of the model's own intra/inter classification, it changes no truth.
 *  - intra (same-sat beam switch): EMERALD — the "minor, in-place" hop.
 *  - inter (satellite handover): ROSE — the "you changed satellite" event; distinct
 *    from the hero yellow ({@link SINR_LIVE_CONE_SERVING_PRIMARY_COLOR}).
 */
export const SINR_LIVE_CONE_PULSE_INTRA_COLOR = '#34d399';
export const SINR_LIVE_CONE_PULSE_INTER_COLOR = '#f472b6';

/**
 * Dim opacity for the OPT-IN non-serving cone layer (Tier-2 show/dim switch,
 * `BeamDisplaySpec.showNonServingCones`, default OFF). Dimmer than the ambient
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
 *  - `pulse`: a real per-frame handover flaring then age-fading (peak brightness) —
 *    the SINGLE handover-visual layer after C3 collapsed the cinema pair into it.
 *  - `nonServing`: the OPT-IN dim co-channel / non-serving beams (default OFF).
 */
export type SinrLiveConeLayer = 'ambient' | 'pulse' | 'nonServing';

/**
 * The ONE place mapping a cone layer to its base opacity — Tier-2 beam-display
 * seam (mirrors the clean per-role `resolveBeamConeRoleFactors` for the steered
 * cones). Before this, the ambient level was a default inside the renderer and the
 * pulse peak was a bare const — so "the ambient cones are too faint / non-serving
 * should be dimmer" had no single edit point. Now every cone layer's opacity is
 * resolved here. Returns the screenshot-locked hybrid values verbatim (D-STYLE A),
 * so this is behaviour-identical; it only consolidates the CHOICE.
 */
export function resolveSinrLiveConeLayerOpacity(layer: SinrLiveConeLayer): number {
  switch (layer) {
    case 'ambient':
      return SINR_LIVE_CONE_AMBIENT_OPACITY;
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
