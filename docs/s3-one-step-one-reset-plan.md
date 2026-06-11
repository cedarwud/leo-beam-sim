# S3 — One Step, One Reset (plan)

**Parent:** [frontend-consolidation-program.md](./frontend-consolidation-program.md) §3 S3 ·
[governance-lock-strategy.md](./governance-lock-strategy.md) (QUAR-S3-STEP).
**Slice before:** S2 satellite identity (`f032560`, pushed). **Branch:** `feat/showcase-phase-0`.
**Method:** 6-dimension read-only recon (workflow `wf_9b25fd19-55d`, 6 agents, all file:line-cited)
+ controller re-verification of every headline claim against source. This doc is the
authority for the S3 cut sequence; write it before touching the god-step.

---

## 0. Locked scope (2026-06-11, user)

**Consolidation finish-line = S5, not all 9 reps.** `S3 → S4 → S5` is the render critical
path: **serving truth lives in the god-step (`runtimeFrameStep.ts:927`) → S3 and S4 are
COUPLED**; the 5 serving oracles + 19 beam layers are what caused the 15 render-iteration
failures. **S6 + C1–C3 are demand-driven / deferred** (off the render path; deferring ≠
walking back).

⟹ **S3 is scoped MINIMAL: do ONLY what S4/S5 need + what retires QUAR-S3-STEP. Do NOT
gold-plate the 440-line god-step.** Concretely that means **3 active sub-slices**
(S3-1 pure-step clock injection, S3-2 HO clock-rebase, S3-3 minimal one-reset + QUAR
retirement) and **S3-4 deterministic mobility is DEFERRED** — it is a *latent* bug
(showcase default `ueMobilityMode='static'`), off the render critical path, and neither
S4 (serving truth) nor S5 (beam render) need it. It stays a logged backlog item, not an
S3 commit. Core impl = controller + Workflow adversarial review (NOT codex — exec timeouts
here + no-memory agents re-break the governance locks). ≈ pausable one-sub-slice-per-session.

---

## 1. The disease, precisely (what the recon CHANGED about the audit framing)

The audit member #3 said: *"6 frame representations; 6 reset paths; `stepRuntimeFrame`
440-line IMPURE god-step (performance.now ×3); secondary mobility = RNG per render frame
→ FPS-dependent, seek(T)≠play(T); pause doesn't pause compute."* Recon refines every clause:

1. **The truth math is ALREADY pure.** Every handover/SINR decision is timed off sim-time
   (`replay.epochUtcMs + state.simTimeSec*1000`, `runtimeFrameStep.ts:706,865`);
   `HandoverManager.update` reads **no** wall clock. The 3 `performance.now()` reads
   (`runtimeFrameStep.ts:573,727,761`) feed **display-only** intra/inter handover viz-latch
   timing (`*VizLatch.wallClockStart/ExpiresMs`) — never SINR, never a handover decision.
   ⟹ "impure step" is **display impurity**, trivially hoistable, not a truth bug.

2. **The real structural disease is ALIASING + in-place mutation.** The step takes
   `state: RuntimeFrameStepState` by reference (an aliased `useRef.current`) and mutates
   **9 fields across ~27 write sites** (`runtimeFrameStep.ts:551-571,609-622,717-775,822-887`)
   plus the in/out `perUePositions` array (`655-685,826-831,868-888`). It does **not** return
   `nextState` — it smears next-frame state back into the input object. ⟹ "recompute frame T
   from scratch" is impossible without a fresh state object, which is *exactly* why the
   6 reset paths exist (each hand-builds a fresh `createRuntimeFrameStepState`).

3. **"6 frame representations" is really 9** (`SimFrame`, `NormalizedSceneFrame`, `VizFrame`,
   `DerivedLiveSceneFields`, `RuntimePerUeSinrPosition`, `SinrLiveCellFrame`, `CellTruthFrame`,
   `SinrLiveCellBeamConeRenderItem`, + `SimFrame.perUePositions` inline anon) — **but most belong
   to later slices** (`NormalizedSceneFrame`/`VizFrame`/coordToWorld-axis = S6/coord; the
   cell-trio = S4/S5). **S3 owns ONLY the step's own reps:** `RuntimeFrameStepState` (the
   cross-frame mutable state) + `perUePositions` (the N-UE array) + the step in/out contract.
   The render-pipeline 9-rep tangle is explicitly **out of S3 scope** (see §5).

4. **"6 reset paths" is 7–8 entry points** through 3 mutators + the in-step `didLoopWrap`
   branch. `seekToTimelineFrame` and `resetToReplayStartFrame` are byte-identical but for the
   time arg; both do **one `paused:true, deltaSec:0` step** ⟹ seek is a **cold teleport**
   (HO managers cold, mobility reseeded to spawn origin) while play is **warm integration**.
   `didLoopWrap` (in-step, `runtimeFrameStep.ts:559-571`) and the windowLength re-loop
   (in-hook, `useSimulation.ts:467-474`) are **two** loop-restart mechanisms with **divergent**
   mobility handling (in-step leaves mobility walking; in-hook cold-reseats).

5. **Mobility RNG is FPS-coupled (latent today).** `randomWalkStep` draws `nextMulberry32`
   **once per render frame** (`multiUeMobility.ts:198`); only the step *distance* scales with
   `dt`. Draw-count = frame-count ⟹ path shape depends on FPS; seek (1 big `dt`) ≠ play (N small).
   The seeded mulberry32 means it is *deterministic given the frame sequence*, not random —
   the bug is **frame-count dependence**, not entropy. **Showcase default `ueMobilityMode='static'`**
   (`appRuntimeConfig.ts:102-104`, `useSimulation.ts:120`) ⟹ the bug is **DORMANT** in the
   shipped look and **invisible to the current golden** (static = `applyPerTickUeMobility`
   early-returns, `runtimeUeFrame.ts:201`).

6. **The served-N/N crash is a reset-policy bug, not an algorithm bug.** On every time-shift
   (loop-wrap, window re-loop, seek) the code calls `HandoverManager.reset()` which **nukes
   `eventLog`** — and the re-attach relax gate (`handover-manager.ts:163-165`,
   `eventLog.length>0 ? threshold−3dB : threshold`) then demands the **strict** threshold, so
   marginal UEs fail to re-acquire for several frames = the `served N/N → low → N/N` flicker.
   Only **2** fields are actually invalidated by a sim-time jump: `guardUntilMs`,
   `pendingSinceMs` (both sim-time-ms). ⟹ a **clock REBASE** (offset those 2, keep the rest)
   is exact and non-destructive. Precedent already exists: `clearServing()`
   (`handover-manager.ts:103-108`) is the milder content-preserving cousin of `reset()`.

7. **Pause freezes truth but not compute.** Paused ⟹ `simTimeSec` frozen, mobility `dt=0`,
   `hoManager.update` `dt=0` — truth correctly freezes. But the full god-step re-executes every
   render frame (two `buildLinkContext`, `generateUePositions`, latch expiry on wall-clock),
   and the viz-latch still ages on real time. A real paused short-circuit is a free perf win
   on the 100-UE lane and removes the last "pause doesn't pause" artifact.

---

## 2. The pure-core / impure-shell partition (the target shape)

```
                 caller (useSimulation useFrame / reset / seek)
                 ├─ reads performance.now() ONCE  ──────────┐  (display clock)
                 ├─ owns the display-latch struct           │
                 ▼                                          ▼
   stepRuntimeFrame(state, dt, nowMs, config) ── PURE ──► { frame, nextState, didWrap, … }
        truth: simTimeSec, serving, SINR, handover decisions, perUePositions
        (function of state+dt+config ONLY; nowMs used solely to stamp display latches)
```

- **Truth** = deterministic `f(state, dt, profile, trajectoryCache, managerState, mobilityState)`.
- **`nowMs`** is an **injected input** (caller reads the clock once), NOT an ambient global read.
  Latch *semantics* stay wall-clock (no sim-time conversion → no behavior change at speed≠1).
- **State crosses the boundary explicitly** (`nextState` returned), no aliasing.

---

## 3. Cut sequence — 4 structural sub-slices + a fold-in retirement (1 commit each)

Every sub-slice is **ZERO-diff** on the existing golden (`fixtures/s0-geometry/candidate-rich-baseline.json`,
`loop:false`, static mobility, no seek) **and** lands its own **non-vacuous** new gate (S0 §3.3
discipline: 退行為必附 gate; run-twice A==B; perturbation positive control). `truth.*` ZERO-diff
is mandatory and may NOT be `S0_TRACE_IGNORE`'d (truth-layer rule). Beam visuals FROZEN throughout.

### S3-1 · Pure-step clock injection (keystone-lite, behavior-invariant)
- Thread `nowMs: number` through `RuntimeFrameStepInput`; caller reads `performance.now()`/`Date.now()`
  **once** and passes it in. Replace the 3 ambient reads (`573,727,761`) with `input.nowMs`.
- Keep wall-clock latch durations identical (`HANDOVER_VISUAL_LATCH_WALLCLOCK_MS=6000` unchanged;
  NO sim-time conversion).
- **New gate `validate:s3:pure-step`**: step produces byte-identical `truth.*` + display latches
  for identical `(state, dt, nowMs)` **with NO `performance.now`/`Date.now` monkey-patch** (the
  proof the ambient read left truth). Non-vacuous (latch actually stamped), run-twice A==B,
  perturbation control (different `nowMs` ⟹ different latch expiry, same truth).
- Keep green: `validate:s0:geometry-trace` (now injects `nowMs` instead of patching the clock for
  the step), `validate:s0:connected-sat-has-beam`, `validate:s2:wall-clock-latch`.
- **QUAR safety:** touches the step signature + `useSimulation`'s `stepRuntimeFrame` call, NOT any
  pinned needle (`MIN_ELEVATION_DEG=15`, the `'sinrLiveCell'` absence, the MainScene cell-gate
  strings all untouched). Group stays executing.

### S3-2 · HandoverManager clock-rebase (the served-N/N fix — VISIBLE win)
- Add `HandoverManager.rebase(deltaMs)`: offset **only** `guardUntilMs` and `pendingSinceMs` by
  `deltaMs` (clamp `guardUntilMs≥0`; backward jump → null a future `pendingSinceMs`). Keep
  `eventLog`, `state` (serving), `smoothedSinrByAssignment`, serving-epoch trio, `triggerTimeSec`.
- Swap `reset()` → `rebase(deltaMs)` at **time-shift** sites: the in-step `didLoopWrap` branch
  (`runtimeFrameStep.ts:561-562`, primary + every secondary), the windowLength re-loop, and seek.
  Keep `reset()` at **cold-start** sites (mount, profile change, signalReset, handoverReset).
- **New gate `validate:s3:served-survives-wrap`**: drive a real loop-wrap (`loop:true`, short
  window, 100 UEs candidate-rich); assert served-UE count does **not** crash across the wrap
  (rebase keeps serving). **Positive control:** the old `reset()` path MUST trip a served-count
  drop (proves the gate detects the bug). Run-twice A==B.
- **ZERO-diff:** the golden is `loop:false` → never wraps → `truth.*` unchanged. (This is a
  truth-*fixing* slice whose fix is only reachable under loop; the golden does not reach it.)
- **Scope note:** `sinrLiveCellModel.reset()` (cell lane) has the same wipe-on-wrap; **deferred
  to S4** (cell lane is S4's serving truth) — logged, not fixed here, to keep S3-2 surgical.

### S3-3 · Minimal one reset recipe + QUAR-S3-STEP retirement (the structural cut)
Scope to what the **one-reset gate + S4 + QUAR retirement** need — do NOT gold-plate.
Full immutable-state de-aliasing (`nextState` return, ~27 write sites) is done **only as far
as a clean single reset recipe requires**; if the recipe collapses cleanly without de-aliasing
every cell, leave the rest (§0). This commit also folds in the **QUAR-S3-STEP retirement** (§3 S3-5).
- `stepRuntimeFrame` returns `nextState` (immutable in/out) **to the extent the one-reset recipe
  needs it**; stop mutating the aliased `state` where it blocks "construct fresh state at T".
  `perUePositions` becomes a pure derived value (serving-fill returns, not mutates) — this is the
  seam S4 builds its serving-truth unification on (god-step serving at `runtimeFrameStep.ts:927`).
- Collapse the 7–8 reset/seek/wrap entry points into **ONE** parametrized recipe
  `buildRuntimeStateAt({ toSec, intent: 'cold-start'|'seek'|'wrap' })` that all effects + the
  in-step wrap call. Fold the `useSimulation.ts:429` cache-invalidation hack and the
  `signalResetKey` empty-frame flicker into it.
- **Decision D1 (recommended default): seek = explicit COLD-reseat** (no warm O(N) replay on a
  7200s timeline). Make it a *tested contract*, not incidental. Position convergence comes from
  S3-4 (pure mobility), not from warm replay; HO-in-progress visuals stay cold on seek (documented).
- **New gate `validate:s3:one-reset`**: every reset/seek/wrap funnels through the single recipe
  (one code path, asserted); seek(T) cold-reseat is byte-stable + matches its documented contract;
  no path publishes a blank frame. Non-vacuous, run-twice A==B.
- **ZERO-diff:** golden only exercises step-0 initial-state build + forward play → unchanged.

### S3-4 · Deterministic sim-time mobility — **DEFERRED (§0 scope-min, NOT an S3 commit)**
The FPS-coupled `seek(T)≠play(T)` mobility bug is **latent**: showcase default
`ueMobilityMode='static'` (`appRuntimeConfig.ts:102-104`) ⟹ `applyPerTickUeMobility`
early-returns (`runtimeUeFrame.ts:201`) ⟹ zero visual effect today, and **neither S4
(serving truth) nor S5 (beam render) depend on it**. Fixing it would be gold-plating the
god-step against the locked scope. **Logged as backlog**, not done in S3:
- *If ever revived:* rewrite secondary mobility as a pure `f(seed, ueIndex, simTime, originPrimary)`
  modelled on the existing pure primary path `resolveWaypointObserver` (`trajectoryFrame.ts:72`);
  fixed sim-tick draw count = `floor(simTime/tick)` (preserves the zig-zag; closed-form is
  intractable); eliminate `mobilityStatesRef` accumulation; new `validate:s3:mobility-seek-eq-play`
  gate on a non-static fixture (seek(T)==play(T) + FPS-invariance). The static golden is unaffected.

### S3-5 · Retire QUAR-S3-STEP (folds INTO S3-3)
Per governance rule 1, the group deletes **wholesale** in the SAME commit that lands ALL its
replacements. Mapping (recon dimension F):

| QUAR-S3-STEP needle (file:line) | protects VALUE | replacement (this slice) |
|---|---|---|
| block #1 `validate-…governance.ts:1642-1659` — MainScene/useSimulation cell-gate **strings** (incl. the `\n`-indent call-shape pin) | cell model built/stepped ONLY on sinr-live, byte-additive | behavior: render-plan/step per lane ⟹ `cellModel===null` + `frame.sinrLiveCells===undefined` off-lane (extend geometry-trace other-lane ZERO-drift) |
| block #2 `:1689-1695` — `assertNotContains(runtimeFrameStep, 'sinrLiveCell')` FROZEN text pin | step doesn't produce/touch cell truth | structural: cell adapter ∉ step callee set (or fold into `truth.cellServing` ZERO-diff) |
| block #3 `:1712-1728` — 15° **literal triple-pin** (`MIN_ELEVATION_DEG=15` / `DEFAULT_MIN_ELEVATION_DEG=15` / `SINR_LIVE_CELL_MIN_ELEVATION_DEG=…`) | elevation-mask parity runtime==cell-layout==cell-adapter | imported-constant **VALUE** asserts: `MIN_ELEVATION_DEG === DEFAULT_MIN_ELEVATION_DEG === SINR_LIVE_CELL_MIN_ELEVATION_DEG === 15`; collapse to ONE exported source + de-dup the `trajectoryFrame.ts` copy (the `runtimeFrameStep.ts:66` comment's promise) |

Commit must also delete the registry entry `tangle-locks.ts:45-49` (else the meta-gate
`assertAndSummarizeTangleLockGroups` throws "registered but never executed"). Pure-step +
one-reset behavior gates (S3-1/S3-3) are the contract's named replacements.

---

## 4. Genuine decisions (surfaced; defaults chosen, confirm if wrong)

- **D1 seek semantics** → COLD-reseat (tested contract), not warm replay. *Default chosen.*
- **D2 viz-latch clock** → keep WALL-clock via injected `nowMs`, no sim-time conversion (sim-time
  would change latch duration at speed≠1). *Default chosen.*
- **D3 mobility model** → N/A — **mobility DEFERRED** (§0). Backlog default if revived: fixed sim-tick.
- **D4 backward-seek rebase** → offset by exact `deltaMs`, clamp `guardUntilMs≥0`, null a future
  `pendingSinceMs`. *Default chosen; confirm.*
- **D5 cell-model rebase** → DEFER to S4 (cell lane = S4 serving truth); S3-2 logs it. *Default chosen.*
- **D6 mobility re-baseline** → N/A — static golden untouched; mobility DEFERRED (§0).

These are leo-OWNED live-sim truth (not producer truth, CLAUDE.md Rule#2/#6 satisfied: no producer
SINR/handover/provenance is rewritten). The mobility path-shape change (S3-4) is the only visible
truth change and is gated behind a non-default mobility mode.

---

## 5. Explicitly OUT of S3 scope (do not let it sprawl)

- `NormalizedSceneFrame`/`VizFrame` consolidation, the THREE↔tuple↔THREE satellite round-trip,
  `coordToWorld` identity-map + unreconciled live/replay axis → **S6 / coordinate slice**.
- The cell-lane frame trio (`SinrLiveCellFrame`/`CellTruthFrame`/cone item) + `CellTruthFrame`'s
  hand-maintained structural-subtype of `SimFrame` → **S4/S5**.
- `satelliteWorldById` display-top-12 truth-cone gating → **S5** (already deferred from S2).
- S1c cos-lat + "satellites above nadir" → blocked on producer data (separate fork).

---

## 6. Verification protocol (every sub-slice)

1. `npm run lint` (tsc --noEmit; there is no `typecheck` script).
2. `validate:s0:geometry-trace` — `truth.*` ZERO-diff, NO `S0_TRACE_IGNORE` (truth-layer).
3. `validate:s0:connected-sat-has-beam` — regression guard (truth-stable invariant, no flip).
4. The sub-slice's own new `validate:s3:*` gate (non-vacuous + A==B + perturbation control).
5. `validate:phase-g:ue-mobility-*` + `validate:modqn:phase6r…` boundary — other-lane ZERO drift.
6. Browser gate where a visual surface moves (`APP_URL=http://localhost:3001`); :3001 before/after
   screenshots (beam look FROZEN — must be identical). S3-1/S3-3 are non-visual; S3-2 visible only
   under loop; S3-4 visible only in non-static mode.
7. Adversarial review before commit (Workflow 3-lens or cavecrew-reviewer; codex exec times out here).
8. Restore validator side-effect PNGs (`git checkout -- docs/visual-clarity-proposal/manual-checkpoints/*.png`);
   confirm clean tree.

**Recommended order (3 active sub-slices):** S3-1 (keystone, lowest risk) → S3-2 (visible
served-crash win) → S3-3 (minimal one-reset + QUAR-S3-STEP retirement). **S3-4 mobility =
DEFERRED backlog** (§0). Then S4 (one serving truth) → S5 (one beam render) = consolidation
finish-line. Do not push without asking.
