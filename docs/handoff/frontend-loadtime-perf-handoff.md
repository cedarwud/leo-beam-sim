# Handoff — frontend load-time performance (started 2026-06-13)

> Controller=Opus. Branch `feat/showcase-phase-0`, HEAD `3559a6f` (committed, NOT pushed).
> Open this + `.agent-memory/project_frontend_loadtime_perf_2026-06-13.md` to continue.
> Scratch probes are untracked `_*.ts` in `scripts/` (repo convention keeps them).
>
> **Rank-1 (chunk the index scan) is DONE — commit `3559a6f`.** Next lever = move
> the scan to a **Web Worker** (erases the rail/paint trade the main-thread chunk
> still pays); the sim dep-graph was audited Worker-safe. See "Remaining" below.

## TL;DR

The webpage was slow to load (~44s to a usable sinr-live scene on the **dev** server).
Root-caused with a 33-agent audit workflow (`wf_57330b79-0cd`) + direct measurement.
**The dominant cost is NOT the dev server** — it is app-side synchronous work: an
offline handover-index scan (~11s, main-thread) + GLB parse + sim warm. The dev
module waterfall was only ~3s of it.

**Also found + fixed a real bug: the prod build was white-screening** (a `manualChunks`
React-split race). So "demo on `vite build`" did not even work before this session.

## What landed (commit `75601b8`, verified safe)

| # | Fix | file | effect |
|---|---|---|---|
| crash | `manualChunks` split React away from R3F (`useLayoutEffect of undefined`) → split ONLY `three`; keep react + @react-three together | `vite.config.ts:236` | prod build renders (was white screen) |
| rank1-defer | offline cinema index scan → `requestIdleCallback` (scene paints first; index output identical, only later) | `src/App.tsx:1271` effect | app-shell **16.9s → 4.7s** |
| rank4 | drop eager `NTPU_large.glb` (5.75MB) preload off sinr-live (MODQN-lane scene, loads on mount) | `src/components/scene/NTPUScene.tsx:62` | −~0.15s + less parse |

**Verified:** `tsc` clean · `validate:governance` green · 100 UEs render · deferred
index still populates (`indexPopulatedMs≈20.8s`, Director still arms) · 0 console errors.

## Measured baselines (vite preview = prod, sinr-live, `scripts/_probe-loadtime.ts`)

| milestone | DEV | PROD before | **PROD after** |
|---|---|---|---|
| domcontentloaded | 0.77s | 0.20s | 0.22s |
| **app-shell (UI visible)** | 20.2s | 16.9s | **4.7s** |
| ue-rendered (full scene) | 43.8s | 28.5s | **22.8s** |
| resource count | 250 | 12 | 11 |

How to measure: `npm run build` → `npx vite preview --port 4173 --strictPort` →
`APP_URL=http://localhost:4173 node --import tsx/esm scripts/_probe-loadtime.ts`.
(`scripts/_chk-render.ts` = render + deferred-index-populated check.)
NOTE: `vite preview` does NOT run the dev-server `/modqn-bundles` middleware → MODQN/
artifact lanes fall back gracefully; sinr-live is unaffected (measure sinr-live).

## ✅ Rank-1 DONE — chunked the index scan (commit `3559a6f`)

`buildSinrLiveCellHandoverEventIndex` is now a resumable builder
(`createSinrLiveCellHandoverEventIndexBuilder`, `runSlice`/`finalize`); the
one-shot is that builder drained in a single slice (ONE code path → chunked
output byte-identical to one-shot by construction). App drives it in batches of
**12 steps via a `setTimeout(0)` macrotask chain** — NOT `requestIdleCallback`:
the continuous rAF scene render keeps the page non-idle, so rIC slices fire only
on their 2 s timeout and the scan takes minutes (measured: rIC pump → rail never
populated in 40 s; batch=3 macrotask → 43.9 s; batch=12 → 17.9 s).

Truth gate: `validate:sinr-live:handover-index-chunked-golden` (byte-identical
across slice sizes 1/7/∞, deterministic, 2 topologies) — wired into
`validate:governance:full`. QUAR-C1-DIRECTOR lane lock now pins the builder call.

Measured (vite preview, prod, sinr-live), vs one-shot baseline:

| milestone | one-shot (defer) | **chunk batch=12** |
|---|---|---|
| ueRendered (canvas usable) | 22.8s | **18.1s** |
| index-populated (rail/Director arms) | 20.8s | **17.9s** |

100 UEs render, 0 console errors, `tsc` + `validate:governance:full` green.

**Honest limit (the next lever):** a main-thread chunk CANNOT win both metrics —
each macrotask yield lets the heavy 100-UE scene render a ~0.3 s frame, so build
wall ≈ `7s + (240/batch)×0.3s`. Bigger batch → faster rail but coarser scene
stutter; smaller → smoother scene but slow rail (batch=3's 43.9 s). batch=12 is
the empirical sweet spot but still pays the frame tax.

## Remaining — the next session's work (ranked)

1. **🥇 Move the scan to a Web Worker (erases the rail/paint trade).** Off-thread
   → the canvas renders at full rAF the whole time (no frame competition) AND the
   rail fills in ~8 s of pure compute — beats batch=12 on BOTH axes. The sim
   dep-graph was **kill-switch audited Worker-safe** (entry layer
   `sinrLiveCellHandoverEventIndex` + `sinrLiveCellRuntime`/`Model`,
   `runtimeFrameStep`, `handover-manager`, `multiUeMobility`, `orbit` have no
   `window`/DOM/Three/React — only the word "window" in sim-time comments). Plan:
   `new Worker(new URL('./sinrLiveCellHandoverEventIndexWorker.ts', import.meta.url),
   {type:'module'})`, postMessage the `BuildSinrLiveCellHandoverEventIndexInput`
   (Profile is structured-cloneable plain JSON), worker calls the **one-shot**
   (no chunking needed off-thread) and posts the index back; App `setLiveWalker…`
   on message, `terminate()` on cleanup/cancel. **Risks to verify:** (a) a
   transitive import touching a browser global → run a worker smoke before wiring;
   (b) governance relock (App will postMessage, not call the builder — update the
   QUAR-C1-DIRECTOR lock to pin the worker wiring); (c) the chunked builder +
   golden stay (the one-shot IS the builder; golden still guards determinism).
   Medium effort.
2. **computeLinkBudget storm (~6s).** `src/scene/sinrLiveCellModel.ts:771-796,800` — a
   12 Hz gate is bypassed in-scan so 99 UEs × cells recompute SINR every step; selection
   (`:800`) needs SINR only at serving-transition rows → lazy-FILL (not drop) `sinrDb`
   at event rows. **Truth-sensitive (SINR math, Rule#2): per-row golden.** Medium.
3. **memoize `createTrajectoryCache` (~1.8s).** Built TWICE (~1.06M propagations each):
   `sinrLiveCellHandoverEventIndex.ts:256` + `src/scene/useSimulation.ts:244`. Module-level
   memo keyed by shells+epoch+observer. Deterministic pure fn → low risk. Small.
4. **GLB meshopt compression (~1.8s real-network; ~0 localhost).** No GLB uses draco/
   meshopt/KTX2; prod ships 25.7MB uncompressed (`public/models/uav.glb` 9.9M = UE drone,
   `public/scenes/NTPU.glb` 7.8M). `gltfpack -cc`; lossy → screenshot-diff. Small.
5. **defer `uav.glb` preload + 325-node clone** (`src/components/scene/UAV.tsx:47,17-30`). Medium.
6. Code-split non-sinr-live lane panels (`src/App.tsx:99-134`). ~90ms. Low value.

## Pointers / gotchas

- Audit workflow result (ranked plan + 10 confirmed findings) is in this session's
  task `wnh5cg77h` output. 13 verify agents failed on a session usage-limit (resets
  7:30pm Asia/Taipei) — the surviving plan is sound + matches direct measurement.
- The index scan fires on lane entry for BOTH sinr-live (`buildSinrLiveCellHandoverEventIndex`)
  and modqn-live-cell-preview (`buildLiveWalkerHandoverEventIndex`). The defer covers both.
- Pre-existing red validators carry over (NOT this work): phase6b, phase6r, phase7k,
  handover-story-layer, s5-diagnostics-rate, vc4a/vc4d/vc1a/phase1a.
- This work is OFF the governance-locked `src/modqn/replay-bundle/` core. Cinematic
  taste-tune (B1) is still pending (separate handoff `g3-dense-q-complete-and-next-handoff.md`).
