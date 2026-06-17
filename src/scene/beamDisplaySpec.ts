/**
 * BeamDisplaySpec — the ONE control point for display-only beam appearance
 * (consolidation P1, `docs/sinr-live-render-consolidation-sdd.md` §3.1).
 *
 * This is the DISPLAY CONTRACT layer of the four-layer beam architecture
 * (TRUTH → DISPLAY CONTRACT → RESOLVERS → RENDER). It generalises the former
 * `SceneDisplayConfig` into the single, flat, declarative object a prompt edits
 * to change how beams LOOK ("波束窄一點" = a width field; "顯示所有波束" =
 * `showNonServingCones`) without touching any truth. Fields migrate IN here one at
 * a time as each scattered render-plan flag / cone-style knob is consolidated
 * (B1 brings the two existing knobs; later slices add width / opacity / colour
 * mode / pulse styles — SDD §3.1).
 *
 * WHY A DIRECT-PROP SEAM (the "I change a beam-display value and nothing
 * re-renders" bug): every other runtime knob flows through `buildAppRuntimeConfig`
 * → the 17-input `runtime` useMemo → the `runtimeWithCinema` wrap → MainScene's
 * single `runtime` prop. Adding a display knob there means appending it to that
 * dep-array AND to the inner cone useMemos in MainScene — miss either and the edit
 * silently does not re-render. This spec bypasses that bag entirely: App holds it
 * in its own `useState` and passes it DIRECTLY to MainScene, so a
 * `setBeamDisplaySpec` call changes a distinct prop reference and re-renders
 * MainScene without touching the runtime memo. (The inner cone memos still must key
 * on these fields — see MainScene — but that is the only dep to remember, and it
 * lives next to the cone resolver, not in a 17-input bag.)
 *
 * SCOPE: display-only (CLAUDE.md Rule#6). These fields change what cones are
 * DRAWN and how they look, never which beam is serving, the SINR, handover events,
 * or any truth. No field may name a serving / SINR / handover decision (SDD §3.1).
 * Keep them primitive (booleans/numbers) so MainScene's React.memo and the inner
 * cone memos can key on stable values rather than a churning object.
 */
import {
  SINR_LIVE_CONE_AMBIENT_OPACITY,
  SINR_LIVE_CONE_PULSE_INTRA_COLOR,
  SINR_LIVE_CONE_PULSE_INTER_COLOR,
} from '../constants/sinrLiveConeStyle';

export interface BeamDisplaySpec {
  /**
   * Show the dim NON-SERVING cone layer (co-channel / secondary illuminated
   * beams) behind the serving cones. Default OFF: the serving cones are the
   * always-on field; this is an opt-in "show me every beam, not just serving"
   * switch. When ON, the non-serving cones draw at
   * `resolveSinrLiveConeLayerOpacity('nonServing')` (dimmer than ambient). It is
   * a pure display filter over the model's non-serving `illuminatedBeams`; the
   * serving-only resolver (and the s0/s4 serving must-holds it feeds) is
   * untouched.
   */
  readonly showNonServingCones: boolean;
  /**
   * Show the per-beam info callouts (the "Beam Info" toggle). Display-only label
   * overlay; feeds the renderPlan's `showBeamCallouts`. A pure display knob, so it
   * belongs on this direct-prop seam, not the 17-input runtime memo. Default ON
   * (matches the prior App default).
   */
  readonly beamCalloutsEnabled: boolean;
  /**
   * Display-only WIDTH multiplier on the RENDERED cone base radius (SDD §3.3).
   * Multiplies only the geometry drawn by `buildObliqueBeamConePositions`; the
   * resolver item's `baseRadiusWorld` and the cone userData stay = the truth cell
   * radius, so this NEVER touches the antenna beamwidth (`cellLayout.ts` /
   * `sinrLiveCellRuntime.ts`) that drives gain → SINR (Rule#6 physics lock).
   * Prompt-control: "波束窄一點" = lower this. Default 1 (behaviour-identical).
   */
  readonly coneWidthScale: number;
  /**
   * Display-only opacity of the AMBIENT serving cone field (the faint all-serving
   * layer). Feeds the serving `SinrLiveCellBeamCones` mount's `opacity` prop,
   * replacing the hardcoded `resolveSinrLiveConeLayerOpacity('ambient')` default.
   * The hero (primary serving) cone keeps its own brighter opacity, and the
   * pair / pulse / non-serving layers keep their own style tokens — this is the
   * serving-field knob only (SDD §3.1 servingConeOpacity, distinct from
   * primaryConeOpacity). Default = {@link SINR_LIVE_CONE_AMBIENT_OPACITY} (0.14,
   * the A2 screenshot-locked value), so behaviour-identical.
   */
  readonly servingConeOpacity: number;
  /**
   * Display-only PULSE colour by handover kind (C2 / Bug H). When a real handover
   * flares, the pulse resolver tags each cone with the truth `event.kind`; the
   * render paints intra pulses {@link pulseIntraColor} and inter pulses
   * {@link pulseInterColor}, so a beam-switch reads distinct from a satellite
   * handover at a glance. A cone with no kind (every non-pulse layer) keeps its
   * serving-identity colour. Prompt-control: "intra 換手用綠色" = set these. This is
   * a read-out of the model's own intra/inter classification — it alters no truth
   * (Rule#6). Defaults = the {@link SINR_LIVE_CONE_PULSE_INTRA_COLOR} /
   * {@link SINR_LIVE_CONE_PULSE_INTER_COLOR} tokens, so behaviour is single-sourced.
   */
  readonly pulseIntraColor: string;
  readonly pulseInterColor: string;
}

export const DEFAULT_BEAM_DISPLAY_SPEC: BeamDisplaySpec = {
  showNonServingCones: false,
  beamCalloutsEnabled: true,
  coneWidthScale: 1,
  servingConeOpacity: SINR_LIVE_CONE_AMBIENT_OPACITY,
  pulseIntraColor: SINR_LIVE_CONE_PULSE_INTRA_COLOR,
  pulseInterColor: SINR_LIVE_CONE_PULSE_INTER_COLOR,
};
