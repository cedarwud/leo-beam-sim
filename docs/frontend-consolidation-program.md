# Frontend Consolidation Program — Audit Verdict + Slice Plan

**Date:** 2026-06-10. **Basis:** 4 structural audit rounds (19 read-only agents,
file:line-cited). **Question answered:** "前端是不是越改越亂、需要整頓?" → **YES,
scoped** — the live truth-to-pixel pipeline + the App control bus need ONE
consolidation program; four smaller areas get their own sequenced cleanups; the
rest of the frontend is proven clean and untouched.

## 1. The verdict map

| Subsystem | Verdict | Worst evidence |
|---|---|---|
| Beam render layers | **CORE** | 19 layers / 4 parallel cone systems / 5 serving-truth oracles; look knobs in 11+ files; `useBeamViz` = 992 lines, one ~880-line useMemo, 15 responsibilities |
| Coordinates / scale | **CORE** | NO authority: ≥7 frames, ~11 km↔world converters (≥4 disagree); satellite `worldPos` frame-punned (sky-dome wu vs ECEF km vs ground wu) disambiguated by a `magnitude>1000` guess (`useBeamViz.ts:233-241`); satellites are NOT rendered above their nadir (dome vs km ground mixing); `EARTH_KM_PER_DEG` duplicated 6×; one replay converter lacks cos(lat) |
| Satellite position/identity | **CORE** | one CLEAN propagator (`src/engine/orbit/`, keep) feeding ~8 divergent projections; `satelliteTintIndex(_satId, displayOrder)` ignores satId → per-frame color churn; `satelliteWorldById` built from display-ranked top-12 gates which TRUTH cones can draw |
| Frame step / mobility / sim→scene | **CORE** | 6 accreted frame representations (NormalizedSceneFrame migration half-done); 6 divergent reset/seek/wrap paths; `stepRuntimeFrame` = 440-line god-step, IMPURE (`performance.now()` ×3); secondary-UE mobility draws RNG per render frame → **path shape depends on FPS, seek(T)≠play-to(T)**; pause doesn't pause compute; ~27 hidden mutable cells |
| Handover populations/reset/override | **CORE** | the HandoverManager ALGORITHM is single-sourced + healthy (keep); but ~276 instances across 5 populations; 4 dt regimes feed the same 3.5s TTT (cinema index steps 30s > TTT → different sampling than live); loop-wrap `reset()` destroys eventLog (gates the 3dB re-attach relax) when only 2 clock fields need rebasing → the served-N/N crash; **decision override applies to primary ONLY** → ω modes drive 1/100 UEs; 2 live meanings of "intra"; dead `SinrOffsetPolicy`; no unit test on the 486-line class |
| App.tsx control bus | **CORE** | 1,746-line god-component, 142 hooks/43 useState, ~15 state domains, re-renders at sim heartbeat (250-700ms); ONE 25-field `runtime` object consumed whole by useBeamViz → ANY control churn (camera click, seek, drawer toggle, resize) re-runs the 880-line beam pass; control→engine via 3 parallel channels (runtime prop / profile prop / React context); lane gating split: typed renderPlan in MainScene vs 20 raw `sceneLane===` gates in App; dead controls (unreachable profile selector, severed uiMode collapse, orphan `handleModqnReplayDisplayStateChange`) |
| Camera / director / cinema | **AFTER #1** (own cleanup) | 6 pose owners + 1 duplicated FSM + dual clocks; **content-blind orbit validated**: intra pose ignores from/to framing; orbit center frozen at tween-land; live focus seek → resetAllHoManagers → UE COLD-ATTACHES to target — the from→to switch is never filmed ("FORECAST-FIDELITY LIMIT", `liveWalkerDirectorFocus.ts:24-34`); preset-vs-focus fight reachable from UI; only 2 narrow couplings into beam zone |
| Timeline / playhead authority | **AFTER #2** (own cleanup) | 4 parallel playhead stores, write-side unarbitrated; live lane runs TWO time axes 450s apart (rail markers absolute vs playhead window-relative — rail playhead lags events by ~450s); designed window-wrap is UNREACHABLE (engine modulo preempts), actual wrap restarts at 0 not 450 and skips mobility reset; scrub fires full sim reset per pointer-move; scrub-vs-armed-cinema fight (no cancellation); dead controller speed store (would double-apply if wired). ONE edge belongs in CORE: take seek/camera transport OUT of the runtime memo |
| HUD / overlay layering | **AFTER #3** (small; 1 live bug NOW) | no z-index scale (19 ad-hoc integers, -1→16.7M, stale "≤18" comment); **LIVE BUG: AdvancedSetupDrawer modal scrim (fixed z-40) stacks UNDER TimelineBar (abs z-82) — timeline clickable through the open modal** on MODQN lanes; click-steal class RECURRED at modal scale; ~200 lines dead `.leo-modqn-scene-overlay` CSS; TimelineBar occludes SinrOffsetExplainer exactly when cinema shows it; 2 unstyled banner classes |
| modqn-replay-visuals | light coordination | clean isolation (0 live-engine imports); 6 helpers duplicated in 2 files; parallel private coord stack — fold into the coordinate slice |
| Training/jobs/model UI, queue/mosaic model, dense-Q gate, lane nav | **CLEAN — do not touch** | proven zero imports from beam/scene world; mosaic is a 0-import pure model |
| Orbit propagator (`src/engine/orbit/`) | **CLEAN — keep as-is** | single-sourced Kepler+GMST+WGS84, 402 lines, validator-covered |

## 2. The one disease (every round found the same thing)

**Display and truth have no boundary, and the validator regime freezes it.**
Display ranking gates truth renders; display order IS satellite identity; a
display knob (`beamFootprintMultiplier`) is a parameter of the truth step;
display anchor (`anchorToUe`) rewrites geometry inside the selection hook; and
164+ governance STRING-locks pin exact source text (including comments),
actively FORCING constant duplication ("duplicated so the validator regex can
match") and turning every fix into validator surgery. 15 failed look iterations
were selection-policy churn on top of divergent truths — not rendering defects.

## 3. Slice plan (core program; each slice = own commit + behavior-gates)

- **S0 Unlock + harness.** Convert the beam/coords/step string-locks that pin
  current tangle into behavior locks (or temporarily quarantine them); stand up
  the geometry probe + fixture harness so every later slice is data-verified.
  NEW invariant test harness: "every satellite the UI calls connected has a
  visible beam" as a TEST, not a hope.
- **S1 Coordinate authority.** One typed `WorldPoint` per frame kind (no
  punning), one km↔world scale, one ENU converter (reuse `topocentric.ts`),
  kill the magnitude>1000 guess + the 5 coercion heuristics + the 6×111.32.
  Satellites rendered above their nadir (one spatial system per viewport).
- **S2 Satellite identity + position pipeline.** Stable satId-keyed color/glyph;
  `satelliteWorldById` from truth set (display cap applied at draw, never at
  truth); OrbitTrail on sim time.
- **S3 One step, one reset.** Purify `stepRuntimeFrame` (no wall-clock in truth;
  display latches out); ONE reset recipe with scoped variants (+ HandoverManager
  clock REBASE api instead of state destruction → kills the served-crash);
  deterministic seed-replayable mobility (no per-rAF RNG); pause gates compute.
- **S4 One serving truth per lane.** sinr-live = cell model everywhere (mosaic,
  HUD, links, cones, events); kill the `servingBeamId`↔`cellId` pun; decision
  override applies to ALL populations or is honestly labeled primary-only;
  align offline event-index dt with live (or label it).
- **S5 One beam render.** truth → ONE pure selector (invariant-tested) → ONE
  cone renderer per lane → ONE style token module (color/opacity/blending in
  one file). Delete: parked ambient path duplication, hex remnants, dead
  SHOW_BEAMS, dead SinrOffsetPolicy, fabricated modqn candidate fan.
- **S6 Split the runtime bus.** Transport commands (camera, director, seek)
  OUT of the runtime identity → beam pass re-runs only on real config change;
  ONE control→engine channel; App lane-gates move into the typed render plan;
  delete dead controls.

**Sequenced after core:** C1 camera/cinema rework (content-aware framing needs
S4's event geometry — this is what makes 運鏡 meaningful: frame the from→to
pair, follow the subject, and replay warm handovers instead of cold-attach);
C2 timeline single-playhead/single-axis; C3 HUD z-token scale + dead CSS purge.

**Fix IMMEDIATELY regardless (cheap, real):** the drawer-under-timeline
click-through bug (z-40 vs z-82).

## 4. Honest effort

Core S0-S6 = a multi-week program (each slice days, with validator surgery).
This is the prerequisite for showcase goals 1+2 (好看 + 一直有換手) being
*iterable* — after S5, look changes are one-file edits guarded by invariant
tests. The MODQN proof track (producer dense-Q export,
`docs/handoff/producer-dense-q-export-request.md`) is INDEPENDENT and proceeds
in parallel; it lands in the clean replay lane.

## 5. Audit provenance

Round 1 beam (5 agents) / Round 2 motion+truth (5) / Round 3 control surface
(4) / supplementary replay-visuals (1), 2026-06-10, all read-only, all claims
file:line-cited. Full outputs in the session transcript; key citations inlined
above.
