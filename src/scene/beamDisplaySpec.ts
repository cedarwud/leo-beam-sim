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
 * → the 17-input `runtime` useMemo → MainScene's single `runtime` prop. Adding a
 * display knob there means appending it to that dep-array AND to the inner cone
 * useMemos in MainScene — miss either and the edit silently does not re-render.
 * This spec bypasses that bag entirely: App holds it
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
  SINR_LIVE_CONE_CANDIDATE_COLOR,
  SINR_LIVE_CONE_SERVING_PRIMARY_COLOR,
  SINR_LIVE_CONE_BACKGROUND_COLOR,
  SINR_LIVE_CONE_NONSERVING_OPACITY,
  SINR_LIVE_CONE_SERVING_PRIMARY_OPACITY,
  SINR_LIVE_TRIGGERED_INTRA_FROM_COLOR,
  SINR_LIVE_TRIGGERED_INTRA_TO_COLOR,
  SINR_LIVE_TRIGGERED_INTRA_PEAK_OPACITY,
  SINR_LIVE_TRIGGERED_INTRA_SUSTAIN_MS,
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
   * primaryConeOpacity). Default = {@link SINR_LIVE_CONE_AMBIENT_OPACITY} (0.45,
   * the screenshot-locked value), so behaviour-identical.
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
  /**
   * Display-only CANDIDATE cone colour (W9 handover-target highlight). The contender /
   * approach sats (comparisonSatId / pendingTargetSatId off the primary cell record,
   * NOT the hero serving sat) render their cones at this hue via `coneColorOverride`, so
   * the duel target reads distinct from the protagonist's serving fan. A render-time
   * role colour: the resolver item's serving-identity `color` is unchanged, so the
   * served-UE colour-match authority is untouched (Rule#6). Prompt-control:
   * "候選/接手衛星的波束改成藍色" = set this. Default = {@link SINR_LIVE_CONE_CANDIDATE_COLOR}.
   */
  readonly candidateConeColor: string;
  /**
   * Display-only HERO cone colour — the PRIMARY serving beam (the cone serving the
   * focus/centre UE) renders this via the serving mount's `heroColor` prop (the highest
   * `resolveSinrLiveConeRenderColor` precedence). SEMANTIC green = "your live serving
   * link". Before this it was the hardcoded {@link SINR_LIVE_CONE_SERVING_PRIMARY_COLOR}
   * literal at the mount, the top-precedence colour a prompt could not reach (override
   * map site #2). Prompt-control: "服務波束改成黃色" = set this. Default = the const, so
   * behaviour-identical; the const stays as the single default source. Display-only
   * (Rule#6): it recolours the hero cone RENDER, the resolver item's serving-identity
   * `color` (the colour-match authority) is untouched.
   */
  readonly heroConeColor: string;
  /**
   * Display-only BACKGROUND/context cone colour — every served cone that is NOT the hero,
   * NOT a candidate, NOT a live handover flash renders this dim colour (the
   * `resolveSinrLiveConeRenderColor` `backgroundColor` branch on the serving + non-serving
   * mounts), so the field reads as "others are served too" context. Before this it was the
   * hardcoded {@link SINR_LIVE_CONE_BACKGROUND_COLOR} literal (the 墨綠 the user asked about),
   * shadowing item.color with no field to reach it (override map site #3). Prompt-control:
   * "背景波束改暖灰一點" = set this. Default = the const (behaviour-identical). Display-only.
   */
  readonly backgroundConeColor: string;
  /**
   * Display-only opacity of the OPT-IN non-serving cone layer (the dim co-channel /
   * beam-hopping beams shown when {@link showNonServingCones} is ON). Feeds the
   * non-serving mount's `opacity` prop, replacing the hardcoded
   * `resolveSinrLiveConeLayerOpacity('nonServing')` call at the mount (override-map
   * site #4 — the non-serving layer ignored the only opacity field that existed). Dimmer
   * than the ambient serving field so co-channel beams read as faint background context.
   * Prompt-control: "其他/非服務波束明顯一點" = raise this. Default =
   * {@link SINR_LIVE_CONE_NONSERVING_OPACITY} (0.04), so behaviour-identical. Display-only.
   */
  readonly nonServingConeOpacity: number;
  /**
   * Display-only opacity of the HERO (primary serving) cone — the one beam serving the
   * focus/centre UE, rendered brighter than the ambient field so it pops. Threaded as the
   * serving mount's `heroOpacity` prop. Before this, the hero branch forced the hardcoded
   * {@link SINR_LIVE_CONE_SERVING_PRIMARY_OPACITY} and IGNORED {@link servingConeOpacity}
   * (override-map site #1 — editing the serving opacity did nothing to the protagonist
   * beam). Now both are spec fields and the precedence (per-item pulse opacity > hero >
   * ambient) is explicit. Prompt-control: "主角波束亮一點/暗一點" = set this. Default =
   * the const (0.8), so behaviour-identical. Display-only (Rule#6).
   */
  readonly heroConeOpacity: number;
  /**
   * The TRIGGERED intra-HO flash (the protagonist's deliberate handover) — its FROM/TO
   * colours, peak opacity, and wall-clock sustain. The handover reads as the old serving
   * cell ({@link triggeredIntraFromColor}, the serving colour it was, fading) handing to the
   * new acquiring cell ({@link triggeredIntraToColor}, the takeover BLUE that then settles to
   * the serving colour). Before this, all four were consts read inside a MainScene memo — a
   * disjoint code path from the ambient pulse colours, so "change the handover flash colour"
   * edited the wrong field and the visible flash was unchanged (override-map site for the
   * triggered layer). Defaults = the SINR_LIVE_TRIGGERED_INTRA_* consts (behaviour-identical).
   * Prompt-control: "換手閃光改色/更久/更亮" = these. Display-only (Rule#6).
   */
  readonly triggeredIntraFromColor: string;
  readonly triggeredIntraToColor: string;
  readonly triggeredIntraPeakOpacity: number;
  readonly triggeredIntraSustainMs: number;
}

export const DEFAULT_BEAM_DISPLAY_SPEC: BeamDisplaySpec = {
  showNonServingCones: false,
  beamCalloutsEnabled: true,
  coneWidthScale: 1,
  servingConeOpacity: SINR_LIVE_CONE_AMBIENT_OPACITY,
  pulseIntraColor: SINR_LIVE_CONE_PULSE_INTRA_COLOR,
  pulseInterColor: SINR_LIVE_CONE_PULSE_INTER_COLOR,
  candidateConeColor: SINR_LIVE_CONE_CANDIDATE_COLOR,
  heroConeColor: SINR_LIVE_CONE_SERVING_PRIMARY_COLOR,
  backgroundConeColor: SINR_LIVE_CONE_BACKGROUND_COLOR,
  nonServingConeOpacity: SINR_LIVE_CONE_NONSERVING_OPACITY,
  heroConeOpacity: SINR_LIVE_CONE_SERVING_PRIMARY_OPACITY,
  triggeredIntraFromColor: SINR_LIVE_TRIGGERED_INTRA_FROM_COLOR,
  triggeredIntraToColor: SINR_LIVE_TRIGGERED_INTRA_TO_COLOR,
  triggeredIntraPeakOpacity: SINR_LIVE_TRIGGERED_INTRA_PEAK_OPACITY,
  triggeredIntraSustainMs: SINR_LIVE_TRIGGERED_INTRA_SUSTAIN_MS,
};
