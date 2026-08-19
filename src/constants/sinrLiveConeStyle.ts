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
 *  - AMBIENT: EVERY serving sat's cone, so every serving sat is beamed
 *    (the connected-sat-has-beam must-hold). Currently 0.17
 *    ({@link SINR_LIVE_CONE_AMBIENT_OPACITY}); three de-tangling features keep the
 *    higher level legible — the apex→base alpha fade
 *    ({@link SINR_LIVE_CONE_BASE_ALPHA_FACTOR}), the near-horizon shallow-cone dim,
 *    and the pulled-back initial camera. Cones use NormalBlending
 *    ({@link SINR_LIVE_CONE_BLENDING}) so a cone's HUE is constant and only its
 *    saturation/strength varies with opacity (owner call 2026-08-06: 顏色不要洗白).
 *  - PAIR: the focused cinema handover pair (old/new cell), BRIGHT, drawn on top
 *    of the ambient layer so the handover story stands out against the faint
 *    field.
 *
 * ROLE PALETTE (2026-08-06 consolidation + FINAL owner spec). A cone's colour + opacity are
 * decided in ONE place, {@link resolveSinrLiveConeRoleStyle}, from its explicit ROLE.
 *
 * COLOUR MARKS ROLE, AND ONLY ROLE. 「只有服務波束是黃色，候選波束是藍色，其他都用灰色」 —
 * exactly two STEADY coloured roles (the beam serving you = YELLOW, the beam about to serve
 * you = BLUE, both bright and saturated at 0.80), and every other steady cone is neutral grey
 * separated by ALPHA alone: serving fan 0.17 > candidate fan 0.13 > background 0.10 > opt-in
 * non-serving 0.07. Event overlays add one deliberate distinction: an INTRA target is ORANGE
 * (same satellite, still the serving family), while an INTER target is BLUE (another satellite).
 * This is an event colour, not a third steady role.
 *
 * HIERARCHY IS ALPHA, NEVER A DARKER SWATCH. Darkening a colour in sRGB shifts its
 * perceived HUE (yellow → brown, blue → violet — both owner-reported when "one step
 * darker" variants were tried), so 「不要用濃淡好了，就用透明度就好」. A handover therefore
 * fades one hue out and the other in without either changing colour.
 *
 * Cone RENDER colour is now the SEMANTIC role/state palette
 * (docs/sinr-live-semantic-beam-colour-sdd.md): serving YELLOW `#facc15`
 * ({@link SINR_LIVE_CONE_SERVING_PRIMARY_COLOR}) / dim neutral context
 * ({@link SINR_LIVE_CONE_BACKGROUND_COLOR}) / candidate BLUE
 * ({@link SINR_LIVE_CONE_CANDIDATE_COLOR}) / a fading-yellow→acquiring-blue handover
 * flip — learnable in one glance, no legend. (This paragraph used to say "serving
 * GREEN" and "releasing-orange→acquired-green": both were left over from the palette
 * that was retired on 2026-06-22, and contradicted the actual constants below plus
 * every other comment in this file. Corrected 2026-08-06.) It is applied at the MOUNT via
 * `resolveSinrLiveConeRenderColor` (hero/kind/override/background precedence), NOT in the
 * pure resolver: the resolver item's serving-identity `color` (`colorForServingBeam`)
 * survives as the fixture default (vc1c/vc2) + the per-cell DATA, so it is not re-homed
 * here. The retired frequency-reuse mapping (`resolveSinrLiveConeColor`) remains below for
 * a future frequency-plan colour mode.
 */
import * as THREE from 'three';
import {
  frequencyReuseColor,
  INTRA_HANDOVER_SOURCE_COLOR,
  INTRA_HANDOVER_TARGET_COLOR,
} from './beamRoleTokens';

/**
 * Ambient cone opacity - the SERVING-FAN role (your satellite's other beams, neutral grey).
 *
 * The grey fan is intentionally quieter than the two coloured roles. The earlier opacity
 * iterations diagnosed colour wash and role hierarchy separately; the current value is tuned
 * for a seven-beam fan over the aerial terrain.
 *
 * The earlier 0.24 dip was a misdiagnosis (the "white/grey
 * wash" came from the ADDITIVE blend saturating the terrain, not from the opacity); the
 * 0.55 spike belonged to a rejected design in which this fan was YELLOW and therefore had
 * to out-vote the green terrain to stay yellow.
 *
 * Under the FINAL spec this layer is neutral CONTEXT, so it has no hue to defend and the
 * only question is legibility ordering. 0.17 places it clearly below the two coloured roles
 * (0.80) and above the candidate fan (0.13) and the background (0.10), while
 * reducing the persistent seven-cone grey fan's visual interference.
 *
 * PIN NOTE: `src/viz/SinrLiveCellBeamCones.test.ts` VALUE-asserts this number. Change both
 * in the same commit (this pin rotted apart once already, P2 SN-1).
 */
export const SINR_LIVE_CONE_AMBIENT_OPACITY = 0.17;

/**
 * Bright opacity for the PRIMARY serving satellite's beams (the sat serving the
 * focus/centre UE). The all-serving ambient field reads dimmer (0.17,
 * {@link SINR_LIVE_CONE_AMBIENT_OPACITY}), but the one satellite actually serving the
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
export const SINR_LIVE_CONE_SERVING_PRIMARY_OPACITY = 0.8;

/**
 * Cell-truth footprint HEX style — the ab861c4 THREE-LAYER restore (2026-06-22).
 * {@link SinrLiveCellFootprintRings} draws, per SERVING cell, the rich layered hex the
 * legacy `EarthFixedCells` drew before it was flattened to two same-colour outline
 * bands: a faint additive FILL-glow ({@link SINR_LIVE_FOOTPRINT_FILL_OPACITY}) under an
 * outer BORDER ring ({@link SINR_LIVE_FOOTPRINT_RING_OPACITY}) and a bright inner ROLE
 * ring ({@link SINR_LIVE_FOOTPRINT_INNER_BAND_OPACITY}) — all at the SAME cell-truth base
 * centre / radius as the serving cone. The COLOUR is reconciled to the SEMANTIC palette
 * (owner choice B, 2026-06-22): every layer renders the cell's resolved role colour
 * (hero serving YELLOW / candidate BLUE / context GREY), via `resolveSinrLiveConeRenderColor`
 * at the mount — so the footprint hex matches its cone + its UE dots (no per-sat rainbow).
 * It REPLACES the legacy steered `AmbientFootprintRings` (wrong — steered — positions) and
 * the persistent grey `SinrLiveCellGrid` (W4). Display-only (Rule#6).
 */
export const SINR_LIVE_FOOTPRINT_RING_OPACITY = 0.9;
/**
 * Outer BORDER ring — ab861c4 radii: a THIN rim straddling the footprint edge
 * (0.96r inner edge → 1.04r outer edge, so it sits slightly PROUD of the hex like the
 * original). Colour = the per-sat WHITE/pale tint (`satelliteTint`), so it reads as a
 * crisp white outline DISTINCT from the role-colour inner ring (the ab861c4 two-tone). */
export const SINR_LIVE_FOOTPRINT_RING_INNER_FACTOR = 0.96;
export const SINR_LIVE_FOOTPRINT_RING_OUTER_FACTOR = 1.04;
/** Tiny ground lift (world units) so the flat hexes never z-fight the terrain. */
export const SINR_LIVE_FOOTPRINT_RING_Y_LIFT = 0.6;
/**
 * ab861c4 fill-glow restore: a faint additive hexagon FILL under the two border rings,
 * so each served cell reads as the rich 3-layer hex (faint fill + outer border + bright
 * inner ring) the ab861c4 `EarthFixedCells` drew — NOT the flat 2-band outline it became.
 * Kept FAINT (a glow, not a solid fill — the rings dominate; owner confirmed the old look
 * had no solid fill) + AdditiveBlending so it lifts the terrain without a hard panel. The
 * colour is the cell's SEMANTIC role colour, resolved at the mount, so the fill matches its
 * border rings + its cone. Display-only (Rule#6). */
export const SINR_LIVE_FOOTPRINT_FILL_OPACITY = 0.16;

/**
 * W5-fix: the Beam-Info callout chip's float height (world units) above the cell
 * base centre. The W5 reimplementation anchored the `<Html>` chip at the ground
 * ({@link SINR_LIVE_FOOTPRINT_RING_Y_LIFT} = 0.6) with a `distanceFactor` (shrinks
 * to sub-pixel at the pulled-back live camera) and `zIndexRange [40,0]` (collapses
 * under the canvas at distance) → the chip mounted in the DOM but was never visible.
 * The 49db65d steered callout that DID read floated its label well above the cone
 * (`height ≈ 28` wu) with NO distanceFactor (constant screen size) and
 * `zIndexRange [80,20]`. This restores that envelope: float the chip above the cone
 * so it clears the footprint hex + the hero fill. Display-only (Rule#6).
 */
export const SINR_LIVE_CALLOUT_Y_LIFT = 26;

/**
 * ab861c4 inner ROLE ring (the BRIGHTEST element of the 3-layer hex): a thin concentric
 * inner hex band per served cell. ab861c4 radii: 0.78r → 0.84r, nested just inside the
 * outer rim (0.96r) so the gap between the two rings is TIGHT (~0.12r) — the original
 * close-set double hexagon, NOT a wide-spaced pair. Colour = the cell's SEMANTIC role
 * colour (hero serving YELLOW / candidate BLUE / context GREY): the ab861c4 "the inner
 * ring turns yellow when the serving beam hits it" two-tone (white outer + role inner).
 */
export const SINR_LIVE_FOOTPRINT_INNER_BAND_INNER_FACTOR = 0.78;
export const SINR_LIVE_FOOTPRINT_INNER_BAND_OUTER_FACTOR = 0.84;
export const SINR_LIVE_FOOTPRINT_INNER_BAND_OPACITY = 0.95;

/**
 * TRIGGERED intra-HO flash style (beam-stage ① #5 — the protagonist jog handover).
 *
 * The ambient live-handover pulse fades over SIM-TIME ({@link SINR_LIVE_RECENT_HANDOVER_RETENTION_SEC}
 * = 4 s), which at the 5× demo speed collapses to ~0.8 s of WALL-CLOCK — too brief +
 * faint (0.32) to read, and undirectional (old + new both the serving-identity hue).
 * The TRIGGERED intra (the deliberate jog) instead gets a WALL-CLOCK 3.2 s fade
 * (decoupled from sim speed, so it always reads) with a FROM/TO COLOUR SPLIT — the
 * old (handed-off) cell the serving YELLOW it was, fading out; the new (acquiring) cell
 * BLUE ("taking over"). The flash draws on top of the new serving cone + fades, so the new
 * cell reads BLUE→YELLOW = acquiring → settled serving. yellow↔blue is the complementary
 * warm/cool pair = max contrast; blue is the SAME hue as the inter candidate so blue uniformly
 * means "the beam taking over". Owner choice (2026-06-22): intra = 黃→藍; make the intra
 * colour-switch obvious
 * + legible as one satellite swapping beams — once the non-serving sats are off
 * (sinrLiveTargetSatIds = serving + imminent inter-target only), this single-sat A→B
 * flip IS the intra story. Display-only (Rule#6).
 *
 * 3200 → 5000 (2026-08-06, owner: 「現在場上的 intra/inter handover 的呈現都要跟 show
 * intra/inter 的效果一樣，2個波束要呈現出兩個交接的效果」). The real handover no longer
 * fades both cones together — it walks the SAME five-phase
 * {@link resolveHandoverConeEnvelope} the manual demonstration walks, so the sustain is
 * now a five-act budget rather than a single decay. At 3200 ms the four narrated acts get
 * 600 ms each, which is the exact duration the manual demo was raised OFF (2500 → 8000)
 * because ~600 ms is below the time it takes a viewer to move their eyes from one cone to
 * the other; the whole thing read as "two beams blinked at once". 5000 ms gives each act
 * ~937 ms plus a 1250 ms settled tail.
 *
 * Why not the manual demo's 8000 ms: the manual cue PAUSES the sim and owns the frame, so
 * it can afford to be long. The real flash fires mid-playback while the protagonist keeps
 * handing over, and a window longer than the gap to its NEXT handover gets truncated when
 * the latch in `MainScene` re-arms. Measured (100 UEs, 240 x 5 s steps, protagonist =
 * perUePositions[0]) — closest protagonist re-arm, in SIM seconds:
 *
 *   hobs-2024-candidate-rich       5 re-arms, gaps 310/150/320/210 s → min 150 s
 *   hobs-2024-tr38811-research     2 re-arms, gap 200 s             → min 200 s
 *   hobs-2024-paper-default        0 re-arms in the whole window    → n/a
 *   hobs-2024-mobile-demo-aircraft 11 re-arms, min gap 5 s          → min 5 s
 *
 * So on three of the four profiles even an 8 s window closes with room to spare; the
 * aircraft profile is the outlier where the protagonist re-arms every 5–10 s of sim time
 * and NO readable window survives above 1x playback. 5000 ms is the choice that keeps the
 * story readable everywhere and still fits the aircraft profile at 1x, where 8000 ms would
 * not. Truncation is the accepted failure mode: a re-arm restarts the envelope at "one
 * beam", so a truncated story degrades to "handovers are coming fast", never back to the
 * two-beams-blinking-in-lockstep bug this replaced.
 */
export const SINR_LIVE_TRIGGERED_INTRA_SUSTAIN_MS = 5000;
/** Peak (age-0) opacity of the triggered flash — dominates the ambient pulse (0.8 peak, fast sim-time fade). */
export const SINR_LIVE_TRIGGERED_INTRA_PEAK_OPACITY = 0.95;
/** OLD (handed-off) cell colour — the serving YELLOW it currently is, fading out as the beam
 * drops ({@link SINR_LIVE_CONE_SERVING_PRIMARY_COLOR}). No separate "releasing" hue: the
 * handover signal is the NEW cell taking the event-kind colour, while the old one just fades. */
export const SINR_LIVE_TRIGGERED_INTRA_FROM_COLOR = INTRA_HANDOVER_SOURCE_COLOR;
/** NEW (acquiring) cell colour for an INTRA handover — ORANGE keeps the event on the same
 * satellite's serving family while distinguishing it from the INTER candidate BLUE. The
 * explicit INTER demo uses {@link INTER_HANDOVER_TARGET_COLOR} through the display-spec
 * target-colour resolver. */
export const SINR_LIVE_TRIGGERED_INTRA_TO_COLOR = INTRA_HANDOVER_TARGET_COLOR;

// ---------------------------------------------------------------------------
// The SHARED handover cone envelope (2026-08-06).
//
// This used to be `resolveManualHandoverConeEnvelope` in `src/scene/manualHandoverDemo.ts`
// and only the top-bar demonstration button walked it; the REAL handover flash handed both
// of its cones ONE shared decay, so they lit together and died together. Owner: 「現在場景
// 中央上方出現 intra handover 的 badge 時，根本就沒有動畫阿，現在場上的 intra/inter handover
// 的呈現都要跟 show intra/inter 的效果一樣，2個波束要呈現出兩個交接的效果」. Both paths now
// walk this one envelope, so the name lost its `Manual` and the function moved here — the
// module that already owns "how bright is this cone", next to the sustain budget the real
// path measures its progress against.
//
// The envelope's only input is `progress01`, so the SHAPE is shared while the LENGTH is
// each caller's own: the manual demo spends `MANUAL_HANDOVER_DISPLAY_MS` (8 s, sim paused)
// walking it, the real flash spends {@link SINR_LIVE_TRIGGERED_INTRA_SUSTAIN_MS} (5 s,
// mid-playback).
// ---------------------------------------------------------------------------

/**
 * The five teaching phases, as fractions of the caller's own window. Each boundary is
 * where a phase ENDS; the last phase (`settled`) runs from `releasing` to 1.
 *
 * | phase     | progress    | old beam   | new beam  | what the viewer is being shown |
 * |-----------|-------------|------------|-----------|--------------------------------|
 * | serving   | 0–18.75%    | full       | absent    | this is the current link |
 * | measuring | 18.75–37.5% | full       | fading in | a candidate appears, measurement starts |
 * | holding   | 37.5–56.25% | full       | full      | trigger timer running, both links up |
 * | releasing | 56.25–75%   | fading out | full      | handover done, old link released |
 * | settled   | 75–100%     | absent     | full      | one beam again, on the new link |
 *
 * The `settled` tail is a quarter of the window and is load-bearing: when `from` only
 * reached alpha 0 at progress exactly 1.0, the fade finished on the very last frame and
 * the "one beam again" state was never actually on screen — the story read as single →
 * double and then stopped, missing its third act.
 */
export const HANDOVER_CONE_PHASE_END = {
  serving: 0.1875,
  measuring: 0.375,
  holding: 0.5625,
  releasing: 0.75,
} as const;

export type HandoverConePhase = 'serving' | 'measuring' | 'holding' | 'releasing' | 'settled';

export interface HandoverConeEnvelope {
  /** Alpha for the OLD (from) cone. 0 → the renderer emits no old cone. */
  readonly fromOpacity: number;
  /** Alpha for the NEW (to) cone. 0 → the renderer emits no new cone. */
  readonly toOpacity: number;
  readonly phase: HandoverConePhase;
}

/** Hermite smoothstep, clamped — a fade-in/out with no visible corner at either end. */
function smoothstep01(t: number): number {
  if (!Number.isFinite(t) || t <= 0) return 0;
  if (t >= 1) return 1;
  return t * t * (3 - 2 * t);
}

/**
 * (progress01, peakOpacity) → the two cone alphas + the phase label.
 *
 * Each cone owns its OWN alpha: the new beam ramps in over `measuring` and the old beam
 * only lets go over `releasing`, so the OVERLAP (`holding`) is visible as a deliberate
 * held state rather than being the whole event. The ramps are smoothstep, not linear, so
 * a fade has no hard start/stop edge.
 *
 * TIME-HONESTY — read this before believing the picture. On the REAL handover path this
 * envelope is a RETROSPECTIVE RE-ENACTMENT, not a live broadcast. The cell model classifies
 * a handover only AFTER it has already happened, so the flash starts at the moment the
 * event is first observed and then narrates "candidate appears → both held → old released"
 * forwards from there. The candidate did not appear at t+1 s of the animation; it appeared
 * some time BEFORE t=0. The ordering is the teaching truth (this is the sequence a handover
 * goes through), the timing is not the wall-clock truth. The MANUAL demonstration button is
 * the same shape and is not even tied to a real event. Neither path may be read as a live
 * timeline, and neither decides anything: this is display-only (Rule#6) — it returns two
 * alphas and changes no serving / SINR / handover state.
 *
 * @param progress01 elapsed / total, clamped internally to [0, 1].
 * @param peakOpacity the fully-on alpha (the caller's spec peak).
 */
export function resolveHandoverConeEnvelope(
  progress01: number,
  peakOpacity: number,
): HandoverConeEnvelope {
  const peak = Number.isFinite(peakOpacity) ? Math.max(0, peakOpacity) : 0;
  const p = !Number.isFinite(progress01) ? 0 : Math.min(1, Math.max(0, progress01));
  const { serving, measuring, holding, releasing } = HANDOVER_CONE_PHASE_END;
  // to: absent until `serving` ends, smooth in across the `measuring` window, then full.
  const toOpacity = peak * smoothstep01((p - serving) / (measuring - serving));
  // from: full until `holding` ends, then smooth out across the `releasing` window —
  // which closes at `releasing`, not at 1.0, so the settled tail is real screen time.
  const fromOpacity = peak * (1 - smoothstep01((p - holding) / (releasing - holding)));
  const phase: HandoverConePhase = p < serving
    ? 'serving'
    : p < measuring
      ? 'measuring'
      : p < holding
        ? 'holding'
        : p < releasing
          ? 'releasing'
          : 'settled';
  return { fromOpacity, toOpacity, phase };
}

/**
 * SEMANTIC palette (docs/sinr-live-semantic-beam-colour-sdd.md). The PRIMARY serving
 * beam (the one serving the centre UE) reads YELLOW = "your live serving link"
 * (connected/acquired), so the viewer knows the colour's MEANING without a legend
 * (owner-chosen 2026-06-22: serving=黃). Every OTHER served beam goes the dim
 * {@link SINR_LIVE_CONE_BACKGROUND_COLOR} context colour (NOT the old arbitrary
 * per-satellite identity hue). This is the DEFAULT of `beamDisplaySpec.heroConeColor`
 * (the mount reads the spec field; this const is the single default source). The pulse +
 * vc1c/vc2 fixtures keep resolveSinrLiveConeColor untouched. Display-only.
 */
export const SINR_LIVE_CONE_SERVING_PRIMARY_COLOR = '#facc15';
/**
 * SEMANTIC background/context colour — every served beam that is NOT the hero (your
 * serving link), NOT a candidate, NOT a live handover flash renders this dim NEUTRAL GREY,
 * so the field reads as "others are served too" context (no hue = neither serving-yellow nor
 * takeover-blue) instead of an arbitrary per-satellite rainbow. Owner-chosen 2026-06-22: the
 * prior `#46544d` 墨綠 was too dark + carried a green tint (orphaned once green left the
 * palette) → a lighter neutral grey. The DEFAULT of `beamDisplaySpec.backgroundConeColor`
 * (one-field re-tune). Threaded into the serving + non-serving cone mounts as
 * `backgroundColor`; faint at the ambient opacity. Display-only.
 *
 * OPEN TENSION (2026-08-06, NOT changed here — needs an owner palette call). Under
 * {@link SINR_LIVE_CONE_BLENDING} = Normal the composite is
 * `alpha × cone + (1 − alpha) × terrain`, and the terrain is the green campus/aerial
 * GLB. A NEUTRAL cone colour has no hue of its own, so it can only DILUTE the terrain's
 * green — never oppose it. Most cones on screen are this layer, which is why the field
 * reads green. Measured over a mid-green terrain (`#4a7a3a`), relative green cast
 * (green-excess ÷ luminance): 0.40 at alpha 0.24 → 0.25 at 0.45 → 0.19 at 0.55. Raising
 * alpha keeps helping but eats the contrast that carries the role palette, and fully
 * cancelling the green would need a cone colour with green-excess ≈ −0.27 — a
 * pink/lavender, well outside this palette. So: leave it neutral and accept a residual
 * green tint, or trade "context has no hue" for a slight cool/violet lean. That is a
 * semantics decision, not a render fix — and it is NOT reachable by the pure-alpha lever,
 * because this role is now deliberately the FAINTEST steady layer (0.22,
 * {@link SINR_LIVE_CONE_BACKGROUND_OPACITY}). STILL OPEN, needs an owner call.
 *
 * The role that USED to carry this problem across most of the screen — the serving
 * satellite's own fan — no longer uses this colour at all: it is the serving yellow
 * ({@link SINR_LIVE_CONE_SERVING_FAN_COLOR}). So the residual green tint is now confined
 * to genuine background context, which is a far smaller share of the frame.
 */
export const SINR_LIVE_CONE_BACKGROUND_COLOR = '#9ca3af';

/**
 * SERVING-FAN colour - the OTHER beams of the satellite that is serving the protagonist
 * (same sat as the hero, different cell).
 *
 * FINAL OWNER SPEC 2026-08-06: 「只有服務波束是黃色，候選波束是藍色，其他都用灰色」. COLOUR
 * MARKS ROLE, nothing else. There are exactly TWO coloured roles on this lane - the beam
 * serving you (yellow) and the beam about to serve you (blue) - and everything else is
 * neutral CONTEXT. A satellite's other beams are context, not a role, so this is an ALIAS
 * of {@link SINR_LIVE_CONE_BACKGROUND_COLOR}. Its presence is carried by ALPHA alone
 * ({@link SINR_LIVE_CONE_AMBIENT_OPACITY} 0.17 - above the candidate fan, below the two
 * coloured roles).
 *
 * TWO REJECTED ATTEMPTS, recorded so neither is retried:
 *  1. amber-600 `#ca8a04`, a "one step darker" yellow -> read as BROWN. Darkening a yellow
 *     in sRGB drops R and G together while B is already near zero, so the perceived HUE
 *     shifts to olive/brown instead of the yellow simply getting dimmer. (The blue side
 *     failed identically: a darker blue read as VIOLET.) Hence the standing rule - hue
 *     values are FIXED, hierarchy is alpha: 「不要用濃淡好了，就用透明度就好」.
 *  2. the full serving fan in the HERO yellow at a lower alpha. Legible, but it made the
 *     whole satellite read as "your link" and spent the palette's strongest signal on
 *     context. Owner rejected: the fan is 脈絡, not a role.
 */
export const SINR_LIVE_CONE_SERVING_FAN_COLOR = SINR_LIVE_CONE_BACKGROUND_COLOR;

/**
 * Ambient opacity for the BACKGROUND role - a serving cone belonging to some OTHER
 * satellite (visible under the "Other beams" power-view, `focusScope: 'allServing'`, or
 * the F4 empty-focus fallback). Owner 2026-08-06: 「那個其他波束的灰色再淡一些」.
 *
 * It used to share {@link SINR_LIVE_CONE_AMBIENT_OPACITY} with the serving fan, so "yours"
 * and "somebody else's" drew at the SAME strength. Every grey layer is now separated by
 * ALPHA alone: serving fan 0.17 > candidate fan 0.13 > this 0.10 > the opt-in non-serving
 * layer 0.07. This layer is intentionally quiet enough to preserve scene readability;
 * the hero and handover roles remain independently bright.
 *
 * Honest caveat, NOT fixable with alpha: this colour is neutral, so at ANY alpha it can
 * only dilute the green terrain, never oppose it - a faint grey cone over green imagery
 * still reads slightly green. That is the OPEN palette tension documented on
 * {@link SINR_LIVE_CONE_BACKGROUND_COLOR}; closing it needs an owner call on the context
 * HUE, not another opacity tweak.
 */
export const SINR_LIVE_CONE_BACKGROUND_OPACITY = 0.10;


/**
 * Upper BOUND on the candidate satellite's fan (cones per frame, INCLUDING the primary
 * "your next link" cone). Mirrors the serving lane's bounded-multibeam discipline (a sat
 * forms a fixed beam budget, leo = 7): the candidate fan is a bounded read-out of that
 * satellite's OWN illuminated beams, never the all-sat firehose the W9 wiring lock warns
 * about. Raising it cannot pull in a second satellite — the resolver filters on the one
 * `pendingTargetSatId` — it only widens how many of that sat's beams are drawn.
 */
export const SINR_LIVE_CANDIDATE_FAN_MAX_CONES = 7;

/**
 * G2c ambient live-handover PULSE peak opacity. When a real per-frame handover
 * fires (`frame.sinrLiveCells.recentHandoverEvents`), its old/new cells flare
 * BRIGHT then fade to 0 over the retention window
 * ({@link ../scene/sinrLiveCellModel.SINR_LIVE_RECENT_HANDOVER_RETENTION_SEC}) —
 * a continuous, no-seek/no-camera "handovers are happening" pulse on the faint
 * ambient field. Slightly brighter than the static director pair so a live flash
 * reads against it; the age-fade (not a fixed value) is what makes it a pulse.
 */
export const SINR_LIVE_CONE_PULSE_PEAK_OPACITY = 0.8;

/**
 * SEMANTIC ambient handover-pulse colours (docs/sinr-live-semantic-beam-colour-sdd.md).
 * A fired handover on a TARGET satellite (serving / imminent-target — the pulse is FOCUSED to
 * those in MainScene) briefly flares its old/new cells: the population "a handover just
 * happened here" cue. The latest owner rule (2026-08-06) keeps the two event kinds visibly
 * distinct: INTRA = orange, INTER = candidate blue. The pulse is still lighter than the solid
 * candidate role, so a transient flare is not mistaken for the steady candidate cone. The
 * INTER value intentionally matches `SINR_LIVE_CONE_CANDIDATE_COLOR` below; it is written here
 * before that declaration so the token initialisation order stays acyclic.
 * Display-only (Rule#6): a read-out of the model's classified handover, no truth touched.
 */
export const SINR_LIVE_CONE_PULSE_INTRA_COLOR = INTRA_HANDOVER_TARGET_COLOR;
export const SINR_LIVE_CONE_PULSE_INTER_COLOR = '#3b82f6';

/**
 * Candidate / contender satellite cone hue — the W9 handover-target highlight. The
 * contender + approach sats (comparisonSatId / pendingTargetSatId, NOT the hero
 * serving sat) recolour their cones to this so the duel target reads DISTINCT from the
 * protagonist's serving-identity fan. A display-only role colour (Rule#6): it is a
 * render-time `coneColorOverride`, the resolver item's serving-identity `color` is
 * unchanged, so the served UEs' colour-match authority is untouched. Distinct from the
 * soft-green ambient PULSE hue and the dim context field (a pulse is a momentary HO
 * flash; this is the steady contender). Prompt-control: "候選波束改個顏色" = set this one field.
 */
export const SINR_LIVE_CONE_CANDIDATE_COLOR = '#3b82f6';

/**
 * CANDIDATE-FAN colour + opacity, and the PRIMARY candidate cone's opacity.
 *
 * The candidate satellite draws its own BOUNDED multibeam fan (owner 2026-08-06: 「候選波束
 * 除了藍色的打在 ue 上之外，也要有其他波束打在其他地方，不能只有一個波束」) - but under the
 * FINAL colour spec only ONE of those cones is BLUE: the one landing on the protagonist's
 * cell, because that is the ROLE ("the beam about to serve you"). The rest of that
 * satellite's beams are context, so the fan colour is an ALIAS of
 * {@link SINR_LIVE_CONE_BACKGROUND_COLOR}, separated from every other grey layer by alpha
 * (0.13: below the serving fan's 0.17, above the background's 0.10).
 *
 * The PRIMARY candidate cone is an EQUAL-WEIGHT role to the hero, not a subordinate one -
 * "your current link" and "your next link" are the two halves of the handover story, so it
 * carries the same 0.80 alpha as {@link SINR_LIVE_CONE_SERVING_PRIMARY_OPACITY}. It was
 * briefly 0.50, which under NormalBlending is half green terrain: the blue read MUDDY
 * (owner: the colours should be 「比較亮比較飽合」). Over the mid-green terrain
 * (`#4a7a3a` = 74,122,58), `#3b82f6` (59,130,246) composites to (66,126,152) at 0.50 -
 * green and blue nearly tied - versus (62,128,208) at 0.80, an unambiguous blue.
 */
export const SINR_LIVE_CONE_CANDIDATE_FAN_COLOR = SINR_LIVE_CONE_BACKGROUND_COLOR;
export const SINR_LIVE_CONE_CANDIDATE_FAN_OPACITY = 0.13;
export const SINR_LIVE_CONE_CANDIDATE_OPACITY = 0.8;

/**
 * Dim opacity for the OPT-IN non-serving cone layer (Tier-2 show/dim switch,
 * `BeamDisplaySpec.showNonServingCones`, default OFF) - the co-channel / beam-hopping
 * beams that serve nobody.
 *
 * 0.04 -> 0.12 -> 0.07. 0.04 under NormalBlending means the composite is 96% terrain:
 * the layer was mounted, counted, and optically ABSENT - the same "mathematically present,
 * optically absent" failure the {@link SINR_LIVE_CONE_DIM_MIN_FACTOR} floor was raised to
 * escape. That is a real defect for an OPT-IN layer whose entire purpose is "show me the
 * beams you are not serving with": if turning it on changes nothing visible, the toggle
 * lies. (Note this mount passes NO `dimShallowCones`, so 0.07 is also the EFFECTIVE alpha
 * - it is not multiplied down further.)
 *
 * It stays the FAINTEST steady layer, below the background context role
 * ({@link SINR_LIVE_CONE_BACKGROUND_OPACITY} 0.10), so "not serving anyone" still reads as
 * the quietest thing on screen. Display-only (Rule#6): showing these cones reads
 * non-serving `illuminatedBeams` and changes no serving/SINR truth.
 */
export const SINR_LIVE_CONE_NONSERVING_OPACITY = 0.07;

/** Segments around the flat ground footprint ring of each oblique cone. */
export const SINR_LIVE_CONE_SEGMENTS = 32;

/**
 * G1-CONE-STYLE apex→base alpha factor — the per-vertex alpha at the ground
 * footprint ring relative to the (full) apex. The cone carries an RGBA vertex
 * gradient (RGB left white so the per-cone hue is unchanged — only alpha varies);
 * the final fragment alpha is `material.opacity × vertexAlpha`. At the CURRENT value
 * 1.0 the base matches the apex, so there is NO apex→base fade — the whole cone draws
 * at its per-cone level (ambient {@link SINR_LIVE_CONE_AMBIENT_OPACITY} / pulse). The
 * machinery stays so this can be lowered below 1.0 to re-introduce a ground fade for
 * de-tangling without touching truth (cones are outside the geometry-trace snapshot;
 * the apex stays fully opaque so every serving sat still shows a beam — the
 * connected-sat-has-beam must-hold).
 */
export const SINR_LIVE_CONE_BASE_ALPHA_FACTOR = 1.0;

/**
 * NormalBlending for the cones — OWNER DECISION 2026-08-06: hue correctness beats
 * glow. Verbatim ask: 「顏色不要洗白，就是原本的顏色變淡跟變濃這樣」 +
 * 「候選衛星應該要是藍色吧?怎麼會是白色?」. Under NormalBlending a cone composites at
 * its OWN colour, so low alpha = pale blue and high alpha = deep blue — the hue is
 * CONSTANT and only the strength varies, which is exactly the requested
 * "same colour, lighter↔heavier" read.
 *
 * Why Additive had to go: additive ADDS the cone's RGB onto whatever is behind it.
 * The candidate blue {@link SINR_LIVE_CONE_CANDIDATE_COLOR} `#3b82f6` is
 * (0.23, 0.51, 0.96); over the bright satellite-imagery terrain all three channels
 * saturate to 1.0 at the opacities the hero/candidate layers use → the cone renders
 * WHITE and the blue/yellow role palette stops carrying meaning. That washout was
 * already logged as the OPEN P3 紅綠場 item; this closes it in favour of the palette.
 *
 * History, because this value has now flipped three times and the trade-off is real:
 * NormalBlending (7fb5991, 2026-06-22, semantic-colour era, see
 * docs/sinr-live-semantic-beam-colour-sdd.md §8) → AdditiveBlending (8e4e1e7,
 * 2026-07-03, ab861c4 3-layer footprint restore, evidence output/shot/candshot-2.png)
 * → NormalBlending (2026-08-06, this decision). What Additive bought was the glowing
 * accumulation where several serving cones overlap; that glow is NOT worth losing the
 * hue, because the hue is the only legend-free encoding of role (serving yellow /
 * candidate + acquiring blue / context grey).
 *
 * If this flips AGAIN, update the S5-2 style-token pin in
 * src/viz/SinrLiveCellBeamCones.test.ts in the SAME commit (test and token rotted
 * apart once already, 07-03→07-07, P2 SN-1 finding).
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
 * resolved here. The ambient value is intentionally tuned below the handover
 * pulse so the persistent white/grey field does not compete with the event cue.
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
/**
 * VISIBILITY FLOOR (2026-08-06). The dim factor MULTIPLIES the layer opacity, so at
 * the old 0.05 a shallow ambient cone rendered at 0.45 × 0.05 = 0.023 effective alpha
 * — mathematically present, optically absent, which reads to a student as "the
 * connected satellite has no beam". The de-emphasis intent (a low-over-horizon beam
 * should recede, not dominate) is preserved at 0.45: a shallow cone still draws less
 * than half as strongly as an overhead one, but the newly lighter context ladder remains
 * visible. Display-only — the s0
 * connected-sat-has-beam invariant counts MOUNTED meshes, so this changes no gate,
 * only whether a mounted mesh can actually be seen.
 */
export const SINR_LIVE_CONE_DIM_MIN_FACTOR = 0.45;

export function resolveSinrLiveConeElevationDimFactor(
  apparentElevationDeg: number,
  floorDeg: number = SINR_LIVE_CONE_DIM_ELEVATION_FLOOR_DEG,
  ceilDeg: number = SINR_LIVE_CONE_DIM_ELEVATION_CEIL_DEG,
  minFactor: number = SINR_LIVE_CONE_DIM_MIN_FACTOR,
): number {
  if (!Number.isFinite(apparentElevationDeg)) return 1;
  if (apparentElevationDeg >= ceilDeg) return 1;
  if (apparentElevationDeg <= floorDeg) return minFactor;
  const t = (apparentElevationDeg - floorDeg) / (ceilDeg - floorDeg);
  return minFactor + t * (1 - minFactor);
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

/* ────────────────────────────────────────────────────────────────────────────
 * THE ONE CONE APPEARANCE DECISION POINT (2026-08-06 consolidation)
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * What a cone MEANS on screen. This is the input the appearance decision is made
 * from — it is passed/derived EXPLICITLY (`SinrLiveCellBeamConeRenderItem.role` or
 * `resolveSinrLiveConeRole`), never sniffed from an incidental signal.
 *
 * (The retired implicit signal, for the record: the hero used to be recognised by
 * `cone.opacity === undefined` AND a satId+cellId match. That coupled "is this the
 * protagonist's beam" to "does this layer happen to carry a per-item alpha" — so
 * stamping an opacity on the ambient resolver, for any reason, would have silently
 * turned the hero grey. Roles are now named.)
 *
 *  - `hero`             the protagonist's own serving beam — your live link.
 *  - `servingFan`       another beam of the SAME satellite that serves you.
 *  - `background`       a serving beam of some OTHER satellite (context: "others are served too").
 *  - `candidatePrimary` the imminent handover target's beam on YOUR cell — your next link.
 *  - `candidateFan`     another beam of that same candidate satellite.
 *  - `nonServing`       the opt-in co-channel / beam-hopping layer (not serving anyone).
 *  - `pulse`            an age-faded live-handover flare (colour by the truth `event.kind`).
 *  - `handoverSource`   the old serving side of one live-handover pulse (serving yellow).
 *  - `handoverTarget`   the acquiring side of one live-handover pulse (intra orange / inter blue).
 *  - `triggered`        the wall-clock triggered/manual handover flash (explicit from/to colour).
 */
export type SinrLiveConeRole =
  | 'hero'
  | 'servingFan'
  | 'background'
  | 'candidatePrimary'
  | 'candidateFan'
  | 'nonServing'
  | 'pulse'
  | 'handoverSource'
  | 'handoverTarget'
  | 'triggered';

/**
 * The tunable appearance inputs a MOUNT supplies (every field defaults to the token
 * above, so an omitted field is never a hole). MainScene builds ONE of these from
 * `beamDisplaySpec` and hands the SAME object to every cone/footprint mount, which is
 * what makes the five mounts share a single appearance authority instead of each
 * threading its own `heroColor` / `backgroundColor` / `coneColorOverride` trio.
 *
 * It intentionally does NOT import `BeamDisplaySpec` (that module imports THIS one — the
 * dependency must stay one-way), so the field names are the ROLE names, not spec names.
 */
export interface SinrLiveConePalette {
  readonly heroColor?: string;
  readonly servingFanColor?: string;
  readonly backgroundColor?: string;
  readonly candidateColor?: string;
  readonly candidateFanColor?: string;
  readonly pulseIntraColor?: string;
  readonly pulseInterColor?: string;
  readonly heroOpacity?: number;
  readonly servingConeOpacity?: number;
  readonly backgroundOpacity?: number;
  readonly candidateOpacity?: number;
  readonly candidateFanOpacity?: number;
  readonly nonServingOpacity?: number;
}

/** The resolved appearance of ONE cone: what colour to paint, and at what alpha. */
export interface SinrLiveConeStyle {
  readonly color: string;
  readonly opacity: number;
}

/**
 * The per-cone data the decision reads: its serving-identity colour (the last-resort
 * default + the explicit colour the triggered layer stamps), the truth handover `kind`
 * (pulse hue), and a per-ITEM opacity (the pulse age-fade / the triggered wall-clock
 * envelope) which ALWAYS wins over the role's base alpha.
 */
export interface SinrLiveConeStyleInput {
  readonly color?: string;
  readonly kind?: 'intra' | 'inter';
  readonly opacity?: number;
}

/**
 * THE decision point: (role, palette, cone) → (colour, opacity). Pure, total, and
 * VALUE-assertable — every role is asserted in `src/viz/SinrLiveCellBeamCones.test.ts`
 * rather than eyeballed in a WebGL screenshot.
 *
 * Why it lives HERE and not in the renderer: `validate:frontend:beam-display-spec-purity`
 * holds `src/viz/SinrLiveCellBeamCones.tsx` and `SinrLiveCellFootprintRings.tsx` at ZERO
 * colour literals, and names `sinrLiveConeStyle.ts` as the colour-authority home. So the
 * defaults can only be spelled here — which is also the right place, since this file is
 * already the single source of the tokens they default to.
 *
 * Precedence inside a role is fixed and shallow: an explicit per-ITEM opacity beats the
 * role's base alpha; a mount-supplied palette colour beats the token default. There is no
 * cross-role fallthrough — the ROLE decides, so "why is this cone grey?" has exactly one
 * answer to look up.
 *
 * Display-only (Rule#6): it reads role + already-classified truth (`kind`) and changes no
 * serving / SINR / handover decision.
 */
export function resolveSinrLiveConeRoleStyle(
  role: SinrLiveConeRole,
  palette: SinrLiveConePalette = {},
  cone: SinrLiveConeStyleInput = {},
): SinrLiveConeStyle {
  switch (role) {
    case 'hero':
      return {
        color: palette.heroColor ?? SINR_LIVE_CONE_SERVING_PRIMARY_COLOR,
        opacity: cone.opacity ?? palette.heroOpacity ?? SINR_LIVE_CONE_SERVING_PRIMARY_OPACITY,
      };
    case 'servingFan':
      return {
        color: palette.servingFanColor ?? SINR_LIVE_CONE_SERVING_FAN_COLOR,
        opacity: cone.opacity ?? palette.servingConeOpacity ?? SINR_LIVE_CONE_AMBIENT_OPACITY,
      };
    case 'background':
      return {
        color: palette.backgroundColor ?? SINR_LIVE_CONE_BACKGROUND_COLOR,
        opacity: cone.opacity ?? palette.backgroundOpacity ?? SINR_LIVE_CONE_BACKGROUND_OPACITY,
      };
    case 'candidatePrimary':
      return {
        color: palette.candidateColor ?? SINR_LIVE_CONE_CANDIDATE_COLOR,
        opacity: cone.opacity ?? palette.candidateOpacity ?? SINR_LIVE_CONE_CANDIDATE_OPACITY,
      };
    case 'candidateFan':
      return {
        color: palette.candidateFanColor ?? SINR_LIVE_CONE_CANDIDATE_FAN_COLOR,
        opacity: cone.opacity ?? palette.candidateFanOpacity ?? SINR_LIVE_CONE_CANDIDATE_FAN_OPACITY,
      };
    case 'nonServing':
      return {
        color: palette.backgroundColor ?? SINR_LIVE_CONE_BACKGROUND_COLOR,
        opacity: cone.opacity ?? palette.nonServingOpacity ?? SINR_LIVE_CONE_NONSERVING_OPACITY,
      };
    case 'pulse': {
      // The pulse hue comes from the model's OWN intra/inter classification. A pulse cone
      // with no kind (never emitted by the pulse resolver, but the type allows it) keeps
      // its serving-identity colour so it reads as "that cone flaring".
      const kindColor = cone.kind === 'intra'
        ? palette.pulseIntraColor ?? SINR_LIVE_CONE_PULSE_INTRA_COLOR
        : cone.kind === 'inter'
          ? palette.pulseInterColor ?? SINR_LIVE_CONE_PULSE_INTER_COLOR
          : undefined;
      return {
        color: kindColor ?? cone.color ?? SINR_LIVE_CONE_BACKGROUND_COLOR,
        opacity: cone.opacity ?? SINR_LIVE_CONE_PULSE_PEAK_OPACITY,
      };
    }
    case 'handoverSource':
      return {
        color: palette.heroColor ?? SINR_LIVE_CONE_SERVING_PRIMARY_COLOR,
        opacity: cone.opacity ?? SINR_LIVE_CONE_PULSE_PEAK_OPACITY,
      };
    case 'handoverTarget': {
      const targetColor = cone.kind === 'intra'
        ? palette.pulseIntraColor ?? SINR_LIVE_CONE_PULSE_INTRA_COLOR
        : palette.pulseInterColor ?? SINR_LIVE_CONE_PULSE_INTER_COLOR;
      return {
        color: targetColor,
        opacity: cone.opacity ?? SINR_LIVE_CONE_PULSE_PEAK_OPACITY,
      };
    }
    case 'triggered':
      // The triggered resolver stamps the explicit from/to colour on each item, so the
      // ITEM colour IS the decision here; the token is only the never-taken fallback.
      return {
        color: cone.color ?? SINR_LIVE_TRIGGERED_INTRA_FROM_COLOR,
        opacity: cone.opacity ?? SINR_LIVE_TRIGGERED_INTRA_PEAK_OPACITY,
      };
  }
}
