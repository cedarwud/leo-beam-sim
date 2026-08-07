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
  SINR_LIVE_CANDIDATE_FAN_MAX_CONES,
  SINR_LIVE_CONE_AMBIENT_OPACITY,
  SINR_LIVE_CONE_BACKGROUND_OPACITY,
  SINR_LIVE_CONE_CANDIDATE_FAN_COLOR,
  SINR_LIVE_CONE_CANDIDATE_FAN_OPACITY,
  SINR_LIVE_CONE_CANDIDATE_OPACITY,
  SINR_LIVE_CONE_SERVING_FAN_COLOR,
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
  SINR_LIVE_CONE_DIM_ELEVATION_FLOOR_DEG,
  SINR_LIVE_CONE_DIM_ELEVATION_CEIL_DEG,
  SINR_LIVE_CONE_DIM_MIN_FACTOR,
} from '../constants/sinrLiveConeStyle';

/**
 * WHICH satellites' beams the sinr-live cell lane draws (display-only render focus, Rule#6 —
 * it narrows what is DRAWN, never the serving truth; s0:connected-sat-has-beam still enforces
 * "no connected sat left beamless" on the resolver, not this filter).
 *  - `'heroOnly'`   — only the HERO serving satellite's fan (today's default). The imminent
 *                     inter-HO candidate is NOT folded in here — it renders as the SEPARATE
 *                     single blue candidate cone (`sinrLiveCandidateBeamConeItems`), so the
 *                     candidate reads as ONE blue "your next link" beam, not its whole fan.
 *                     (Owner-chosen 2026-06-22; an earlier `'servingPlusCandidate'` mode was
 *                     removed — folding the candidate sat into this set double-drew it: its
 *                     full fan rendered grey-background via the focus set AND the standalone
 *                     blue cone still drew. If a candidate-FAN view is ever wanted, build it
 *                     with per-sat blue colouring + suppressing the standalone cone, not here.)
 *  - `'allServing'` — every serving satellite (the "Other beams" breadth).
 *  - `{ satIds }`   — an explicit set (e.g. "just sats 4 and 7").
 */
export type BeamFocusScope =
  | 'heroOnly'
  | 'allServing'
  | { readonly satIds: readonly string[] };

export interface BeamDisplaySpec {
  /** Display-only filter for the secondary UEs that are currently in handover. */
  readonly showOtherHandoverUes: boolean;
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
   * primaryConeOpacity). Default = {@link SINR_LIVE_CONE_AMBIENT_OPACITY} (0.40 — the top
   * of the neutral-grey alpha ladder, below the two coloured roles at 0.80).
   */
  readonly servingConeOpacity: number;
  /**
   * Display-only PULSE colour by handover kind (C2 / Bug H). When a real handover
   * flares, the pulse resolver tags each cone with the truth `event.kind`; the
   * render paints intra pulses {@link pulseIntraColor} and inter pulses
   * {@link pulseInterColor}, so a beam-switch reads distinct from a satellite
   * handover at a glance. A cone with no kind (every non-pulse layer) keeps its
   * serving-identity colour. Prompt-control: "intra 換手用橘色" = set these. This is
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
   * Display-only SERVING-FAN cone colour (2026-08-06) — the OTHER beams of the satellite
   * that serves the protagonist (same sat as the hero, different cell). Before this they
   * shared {@link backgroundConeColor}, a hueless grey, so under NormalBlending the whole
   * fan could only dilute the green terrain and read green (owner: 「服務波束目前看起來還是
   * 很綠」). Now the fan is the low-luminance sibling of {@link heroConeColor}, so the
   * serving satellite reads as ONE yellow family with the hero as its brightest member.
   * Prompt-control: "服務扇形換個黃" = set this. Default =
   * {@link SINR_LIVE_CONE_SERVING_FAN_COLOR}. Display-only (Rule#6).
   */
  readonly servingFanConeColor: string;
  /**
   * Display-only opacity of the BACKGROUND role — a serving cone belonging to some OTHER
   * satellite (seen under the "Other beams" power-view / `focusScope: 'allServing'` / the
   * empty-focus fallback). It used to share {@link servingConeOpacity}, so "your fan" and
   * "someone else's fan" drew at the same strength; with the serving fan promoted to
   * yellow the context layer must step back (owner: 「那個其他波束的灰色再淡一些」).
   * Prompt-control: "其他衛星的波束再淡一點/明顯一點" = set this. Default =
   * {@link SINR_LIVE_CONE_BACKGROUND_OPACITY}. Display-only.
   */
  readonly backgroundConeOpacity: number;
  /**
   * Display-only CANDIDATE-FAN colour + opacity + cone BOUND (2026-08-06). The candidate
   * satellite now draws its own bounded multibeam fan, not a single cone (owner: 「候選波
   * 束…也要有其他波束打在其他地方，不能只有一個波束」). The cone on YOUR cell keeps
   * {@link candidateConeColor} (your next link); the rest of that satellite's beams take
   * neutral GREY (FINAL spec: only the beam about to serve YOU is blue — the candidate
   * satellite's other beams are context). Hierarchy across the grey layers is alpha alone:
   * serving fan 0.40 > candidate fan 0.28 > background 0.18 > non-serving 0.12. {@link candidateFanMaxCones} bounds how many of that ONE satellite's
   * beams are drawn (it can never pull in a second satellite). Prompt-control:
   * "候選扇形再多/再少幾根" = the max; "候選扇形再淡一點" = the opacity. Defaults = the
   * SINR_LIVE_CONE_CANDIDATE_FAN_* / SINR_LIVE_CANDIDATE_FAN_MAX_CONES tokens.
   * Display-only (Rule#6): a geometric read-out of that sat's illuminated beams.
   */
  readonly candidateFanConeColor: string;
  readonly candidateFanConeOpacity: number;
  readonly candidateFanMaxCones: number;
  /**
   * Display-only opacity of the PRIMARY candidate cone (the one landing on YOUR cell).
   * Its own field rather than borrowing {@link servingConeOpacity}, so "the serving fan
   * beats the candidate" is a value a gate can assert instead of an accident of two mounts
   * passing the same field. Default = {@link SINR_LIVE_CONE_CANDIDATE_OPACITY} (0.5).
   */
  readonly candidateConeOpacity: number;
  /**
   * Display-only opacity of the OPT-IN non-serving cone layer (the dim co-channel /
   * beam-hopping beams shown when {@link showNonServingCones} is ON). Feeds the
   * non-serving mount's `opacity` prop, replacing the hardcoded
   * `resolveSinrLiveConeLayerOpacity('nonServing')` call at the mount (override-map
   * site #4 — the non-serving layer ignored the only opacity field that existed). Dimmer
   * than the ambient serving field so co-channel beams read as faint background context.
   * Prompt-control: "其他/非服務波束明顯一點" = raise this. Default =
   * {@link SINR_LIVE_CONE_NONSERVING_OPACITY} (0.12 — 0.04 was optically absent under
   * NormalBlending, so the opt-in toggle changed nothing visible). Display-only.
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
   * new acquiring cell ({@link triggeredIntraToColor}, the INTRA target ORANGE that then settles
   * to the serving colour). The explicit INTER demonstration uses `candidateConeColor` (BLUE)
   * for its target. Before this, all four were consts read inside a MainScene memo — a
   * disjoint code path from the ambient pulse colours, so "change the handover flash colour"
   * edited the wrong field and the visible flash was unchanged (override-map site for the
   * triggered layer). Defaults = the SINR_LIVE_TRIGGERED_INTRA_* consts (behaviour-identical).
   * Prompt-control: "換手閃光改色/更久/更亮" = these. Display-only (Rule#6).
   */
  readonly triggeredIntraFromColor: string;
  readonly triggeredIntraToColor: string;
  readonly triggeredIntraPeakOpacity: number;
  readonly triggeredIntraSustainMs: number;
  /**
   * Apparent-elevation DIM band for the ambient cone field — a display de-emphasis of
   * near-horizontal cones (a low-over-the-horizon serving sat paints a shallow cone that
   * shoots sideways). {@link elevationDimEnabled} turns it on/off; the band fades cones whose
   * rendered apex→base angle is between {@link elevationDimFloorDeg} (full dim →
   * {@link elevationDimMinFactor}) and {@link elevationDimCeilDeg} (no dim). The hero beam is
   * exempt when {@link heroExemptFromElevationDim} so the protagonist always pops.
   *
   * This is the INSIDIOUS multiplicative shadow the control surface unmasks: the dim
   * MULTIPLIES the resolved opacity (down to 5%), silently undercutting a raised
   * servingConeOpacity, with no field to turn it off — until now. Defaults reproduce the
   * 22°/42°/0.05/exempt behaviour exactly. Prompt-control: "別把低空波束調暗 / 只壓 15° 以下" =
   * these. Display-only (Rule#6): every serving cone still mounts (s0 counts meshes, not
   * opacity); this only fades the rendered alpha.
   */
  readonly elevationDimEnabled: boolean;
  readonly elevationDimFloorDeg: number;
  readonly elevationDimCeilDeg: number;
  readonly elevationDimMinFactor: number;
  readonly heroExemptFromElevationDim: boolean;
  /**
   * WHICH satellites' beams the serving / non-serving / footprint / callout / pulse layers
   * draw (see {@link BeamFocusScope}). The renderer derives the focus sat-id set from this +
   * the primary serving record; `'allServing'` lifts the filter (every serving sat), the
   * "Other beams" toggle ({@link showNonServingCones}) still forces breadth too. Before this
   * the set was a hardcoded MainScene memo ({serving} only). Default `'heroOnly'` reproduces
   * today exactly (the candidate stays its own single blue cone, not folded in). Prompt-control:
   * "畫全部波束 / 只畫某幾顆衛星". Display-only (Rule#6).
   */
  readonly focusScope: BeamFocusScope;
  /**
   * Whether the ambient handover PULSE follows {@link focusScope} (only flares handovers on the
   * focused sats) or fires for every sat. Default true = today (the pulse is focused to the
   * serving sat). Set false to see handover blips across the whole field regardless of focus.
   */
  readonly pulseFocusFollowsScope: boolean;
}

export const DEFAULT_BEAM_DISPLAY_SPEC: BeamDisplaySpec = {
  showOtherHandoverUes: false,
  showNonServingCones: false,
  beamCalloutsEnabled: true,
  coneWidthScale: 1,
  servingConeOpacity: SINR_LIVE_CONE_AMBIENT_OPACITY,
  pulseIntraColor: SINR_LIVE_CONE_PULSE_INTRA_COLOR,
  pulseInterColor: SINR_LIVE_CONE_PULSE_INTER_COLOR,
  candidateConeColor: SINR_LIVE_CONE_CANDIDATE_COLOR,
  heroConeColor: SINR_LIVE_CONE_SERVING_PRIMARY_COLOR,
  backgroundConeColor: SINR_LIVE_CONE_BACKGROUND_COLOR,
  servingFanConeColor: SINR_LIVE_CONE_SERVING_FAN_COLOR,
  backgroundConeOpacity: SINR_LIVE_CONE_BACKGROUND_OPACITY,
  candidateFanConeColor: SINR_LIVE_CONE_CANDIDATE_FAN_COLOR,
  candidateFanConeOpacity: SINR_LIVE_CONE_CANDIDATE_FAN_OPACITY,
  candidateFanMaxCones: SINR_LIVE_CANDIDATE_FAN_MAX_CONES,
  candidateConeOpacity: SINR_LIVE_CONE_CANDIDATE_OPACITY,
  nonServingConeOpacity: SINR_LIVE_CONE_NONSERVING_OPACITY,
  heroConeOpacity: SINR_LIVE_CONE_SERVING_PRIMARY_OPACITY,
  triggeredIntraFromColor: SINR_LIVE_TRIGGERED_INTRA_FROM_COLOR,
  triggeredIntraToColor: SINR_LIVE_TRIGGERED_INTRA_TO_COLOR,
  triggeredIntraPeakOpacity: SINR_LIVE_TRIGGERED_INTRA_PEAK_OPACITY,
  triggeredIntraSustainMs: SINR_LIVE_TRIGGERED_INTRA_SUSTAIN_MS,
  elevationDimEnabled: true,
  elevationDimFloorDeg: SINR_LIVE_CONE_DIM_ELEVATION_FLOOR_DEG,
  elevationDimCeilDeg: SINR_LIVE_CONE_DIM_ELEVATION_CEIL_DEG,
  elevationDimMinFactor: SINR_LIVE_CONE_DIM_MIN_FACTOR,
  heroExemptFromElevationDim: true,
  focusScope: 'heroOnly',
  pulseFocusFollowsScope: true,
};

/**
 * Resolve the target colour for the triggered/manual handover layer.
 *
 * The live primary latch is currently intra-only, while the top-bar demonstration can show
 * either kind. Keeping this mapping beside the display spec prevents the renderer from
 * hard-coding a second inter colour path: intra reads the dedicated event colour, inter reuses
 * the candidate/next-link blue. Display-only; it changes no handover truth.
 */
export function resolveTriggeredHandoverTargetColor(
  kind: 'intra' | 'inter',
  spec: Pick<BeamDisplaySpec, 'triggeredIntraToColor' | 'candidateConeColor'>,
): string {
  return kind === 'intra' ? spec.triggeredIntraToColor : spec.candidateConeColor;
}

/**
 * Resolve {@link BeamFocusScope} → the focus sat-id set the render memos filter by, or `null`
 * for "no focus filter" (every serving sat = breadth). Pure (testable; the colour-match /
 * scene-lane gates can value-assert it). `'heroOnly'` returns just the serving sat — the
 * byte-identical default. Tolerant of missing record fields (optional). Display-only (Rule#6).
 */
export function resolveBeamFocusSatIds(
  focusScope: BeamFocusScope,
  record: { readonly servingSatId?: string | null } | null,
): Set<string> | null {
  if (focusScope === 'allServing') return null; // null = lift the focus filter = every serving sat
  if (focusScope && typeof focusScope === 'object') return new Set(focusScope.satIds); // `&&` guards a type-unsafe null
  // 'heroOnly': the serving sat alone (the byte-identical default). The candidate is a SEPARATE
  // single blue cone, deliberately NOT folded in (see BeamFocusScope).
  const ids = new Set<string>();
  if (record?.servingSatId) ids.add(record.servingSatId);
  return ids;
}
