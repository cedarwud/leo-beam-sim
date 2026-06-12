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
 *    (the connected-sat-has-beam must-hold) without washing the map. 0.22 washed
 *    out (the look the user rejected), 0.10 read as a rainbow streak, 0.08 reads
 *    clean (map + hex footprints + UE dots show through). NormalBlending
 *    alpha-composites each cone to a bounded translucency — overlaps darken but
 *    never white out — so all connected sats can show a beam at one opacity.
 *  - PAIR: the focused cinema handover pair (old/new cell), BRIGHT, drawn on top
 *    of the ambient layer so the handover story stands out against the faint
 *    field.
 *
 * Cone COLOUR is the geographic frequency-reuse pattern (`frequencyReuseColor`,
 * `beamRoleTokens`) — adjacent cells use different frequencies — set per cell in
 * the pure resolver (it is per-cell DATA, not a mesh style knob), so it is not
 * re-homed here.
 */
import * as THREE from 'three';

/** Faint ambient cone opacity — every serving sat's beam (screenshot-locked 0.08). */
export const SINR_LIVE_CONE_AMBIENT_OPACITY = 0.08;

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

/** Segments around the flat ground footprint ring of each oblique cone. */
export const SINR_LIVE_CONE_SEGMENTS = 32;

/**
 * Alpha-composite blending for the cones: bounded, uniform translucency. Additive
 * blending accumulates (no usable middle between too-faint and blown-out at the
 * all-serving population), so NormalBlending is what lets every serving sat show a
 * beam at one moderate opacity.
 */
export const SINR_LIVE_CONE_BLENDING: THREE.Blending = THREE.NormalBlending;
