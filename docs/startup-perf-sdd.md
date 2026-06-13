# Startup / Load-Time Performance SDD — leo-beam-sim

> Status: load-time workstream **DONE for localhost at L5** (2026-06-13). Scene
> paints 100 UEs at ~5.0 s (accurate probe), under the 6–8 s target. L3 built then
> ABANDONED (regression; premise was a `waitForFunction` measurement artifact —
> see §1 + L3). Remaining levers (L1/L2/L4/L6) deferred to a networked deploy.
> Branch `feat/showcase-phase-0`. Supersedes the single-point handoff
> `docs/handoff/frontend-loadtime-perf-handoff.md` as the *systematic* plan; that
> handoff's ledger (S1 crash+defer, S2 index chunk) stays the as-built record.
> Read with `.agent-memory/project_frontend_loadtime_perf_2026-06-13.md`.

## 0. Why this exists

Two sessions attacked the *single biggest* main-thread blocker each time (crash
fix → defer index → chunk index). That is symptom-chasing. This SDD steps back to
the **standard heavy-WebGL startup playbook** — asset compression, deterministic
state baking/hydration, progressive load, LOD, off-thread compute — and sequences
it. None of this is novel; the only thing that makes leo different from a normal
heavy site is the **truth/determinism rule**, and that rule *enables* the biggest
lever (bake) rather than blocking it.

Non-goal: re-deriving web-perf from scratch. Use off-the-shelf (`gltf-transform`,
three.js `KTX2Loader`/`MeshoptDecoder`, drei `<Detailed>`/`useGLTF`, state
hydration). Bespoke code only at the determinism boundary the libs don't cover.

## 1. Measured cost model (vite preview, prod, sinr-live)

> **⚠️ MEASUREMENT CORRECTION (2026-06-13, L3 session).** The `ueRendered ≈ 18s`
> (and the post-L5 `~7.5s`) figures below were measured with Playwright
> `waitForFunction` (rAF polling), which the app's continuous R3F render loop
> **starves** → every milestone inflated by ~3 s, and the inflation grows with
> render load. An accurate `setTimeout`+`evaluate` probe
> (`scripts/_measure-loadtime.ts`) shows the **true** post-L5 numbers: the
> sinr-live scene paints all 100 UEs **at once at ~5.0 s** (already under the §6
> 6–8 s target), and the offline index rail lands ~15–16 s (off the paint path).
> So the dominant first-paint cost is **GLB decode + bundle parse (~5 s)**, NOT the
> UE-SINR warm — the "~6s UE warm scales with UE count" row below overstated a cost
> that does not gate first paint (it fits under the GLB/bundle load). This is why
> **L3 (progressive UE) was abandoned** — see L3. Re-measure with the accurate
> probe, never `waitForFunction`, for any future load-time work.

Current (waitForFunction-inflated; see correction above): `ueRendered` (scene
usable) ≈ **18s**; `app-shell` ≈ 3–5s. Where the ~18s goes (audit
`wf_57330b79-0cd` + direct probe):

| bucket | ~cost | scales with | nature |
|---|---|---|---|
| JS bundle parse/exec | ~3s | — | 2MB (vendor 587K + three 705K + index 736K) |
| **GLB decode** | big | — | uav 9.9M + NTPU 7.8M + sat 2.5M ≈ **20MB uncompressed**, main-thread parse |
| trajectory propagation | ~1.8s **×2** | sat-count × horizon | deterministic; built in index scan **and** `useSimulation` |
| **UE-SINR warm** (`computeLinkBudget` storm) | ~6s | **UE count** | 99 UEs recompute SINR every step on warm |
| offline index scan | ~8s | UE count | **already chunked** (S2, commit `3559a6f`) |
| GPU upload + shader compile | jank | — | first render |

Two structural facts drive the plan:
- Most of the heavy compute is a **pure deterministic function of (profile,
  epoch, runtime-config)** — the same property the S2 chunked golden exploits. So
  it can be **precomputed once and shipped as data** (bake/hydrate).
- The UE-SINR warm **scales with UE count** — so it can be **deferred past first
  paint** by ramping UE count (progressive load), and it does NOT block painting
  the terrain + satellites.

## 2. Principles / constraints

1. **Determinism makes baking truth-safe + verifiable.** Precomputing the engine's
   t0 frame at build time and hydrating it is NOT display inventing truth — it is
   the *same* engine truth computed earlier, pinned by a golden (`baked == live`,
   byte-identical, exactly like S2's chunked golden). This is consistent with the
   existing offline index scan, which is already a precompute. It does NOT violate
   CLAUDE.md §5 (display must not rewrite SINR/handover/serving) — bake emits the
   engine's own output, untouched.
2. **Every lossy or truth-touching change carries a gate.** Lossy asset compression
   → screenshot-diff within tolerance. Bake/memoize/progressive → determinism or
   end-state-equivalence golden. Pure display-timing (defer/LOD-low-q) → render
   smoke only.
3. **One lever per PR** (vendor-rule discipline). No batched perf landings.
4. **Off the governed core.** All levers stay out of `src/modqn/replay-bundle/` and
   do not touch the S0–S5 render-truth invariants. Run `validate:governance:full`
   + the new per-lever gate before each handoff.
5. **Honest degradation.** A progressive/low-q state must SAY so (e.g. served
   aggregate "32/100 loading"), never claim the full picture early.

## 3. Levers

Each lever is an independent slice: goal · approach · files · truth-gate · risk ·
reward. `★` = high reward/effort.

### L1 ★ — GLB asset compression (meshopt geometry + KTX2 textures)
- **Goal:** cut the ~20MB GLB decode + (on a networked deploy) the 20MB+ transfer.
- **Approach:** build-time `@gltf-transform/cli`. Geometry → **meshopt** (faster
  decode than draco; drei `useGLTF` has native meshopt support); textures → **KTX2**
  (GPU-ready, zero main-thread decode). See §5 for exact commands + drei wiring.
- **Files:** a `scripts/build-compress-glb.*` (or npm `prebuild` step) emitting
  `public/models/*.ktx2.glb`; a singleton loader util `src/scene/gltfLoaders.ts`
  (KTX2Loader + transcoder); the 3 `useGLTF` call sites — `UAV.tsx:14`,
  `NTPUScene.tsx:11`, `SatelliteMarker.tsx` — switched to the meshopt+KTX2 path.
  Vendor the basis transcoder into `public/` (don't depend on the unpkg CDN at
  runtime for an offline demo).
- **Gate:** screenshot-diff (rendered scene before/after within pixel tolerance) —
  reuse the browser-validator harness. KTX2/meshopt are lossy.
- **Risk:** low–med. Transcoder path must pin `three@0.180.0`. KTX2 "multiple
  active loaders" warning → singleton.
- **Reward:** localhost ~1.8s decode; **networked deploy: potentially the single
  biggest real win** (transfer dominates — current preview measurements hide it).

### L2 ★ — Bake + hydrate the default initial frame ("先算好存起來")
- **Goal:** stop recomputing the t0 scene + trajectory on every load for the common
  "just open the page" (default-config) case. Cut the ~6s UE-SINR warm + ~1.8s
  trajectory from the first-paint path.
- **Approach:** at BUILD time, run the engine for the **default runtime config** and
  emit the t0 render frame (sat transforms, UE positions/colours, beam params) +
  a trajectory seed to `src/generated/sinrLiveWarmStart.<hash>.json`. At runtime,
  if the live config hash == the baked hash, **hydrate the first paint from JSON**
  (poster frame) while the live sim warms in the background, then swap to live —
  seamless because `baked == live` by determinism. Non-default config → fall back
  to live compute (today's path). Pair with **L5 trajectory memo** so the live sim
  doesn't rebuild what was baked.
- **Files:** `scripts/bake-sinr-live-warmstart.ts` (build emitter, reuses
  `buildSinrLiveCellHandoverEventIndex`'s engine setup); a hydration path in
  `useSimulation` / the sinr-live scene mount; the generated JSON.
- **Gate:** `validate:startup:warm-start-bake` — assert the baked snapshot is
  **byte-identical** to a live recompute of the default config (same pattern as
  S2's `validate:sinr-live:handover-index-chunked-golden`). Self-verifying: if the
  profile/epoch/default-config drifts, the gate fails → rebake.
- **Risk:** med. Snapshot scope = **t0 render frame only** (small); do NOT bake the
  full 7200s trajectory (multi-MB) — memoize it live (L5) instead. The baked→live
  swap must be invisible (guaranteed by the golden).
- **Reward:** removes most of the ~8s warm from first paint for the default open.

### L3 ✗ ABANDONED (2026-06-13) — Progressive UE load (ramp count past first paint)
> **Built, fully gated (lint + `validate:governance:full` + a new
> `validate:startup:progressive-ue` truth golden all green), then REVERTED after
> accurate measurement showed it is a net regression with no first-paint win.**
> The premise below — that the UE-count-scaling warm blocks first paint — was a
> **measurement artifact**: the prior `_chk-render` probe used Playwright
> `waitForFunction` (rAF polling), which the app's continuous R3F render loop
> STARVES, inflating every milestone by ~3 s. An accurate `setTimeout`+`evaluate`
> probe (`scripts/_measure-loadtime.ts`, immune to rAF starvation) measured, same
> machine, 3 runs each:
>
> | median | BEFORE (L5) | AFTER (L3) |
> |---|---|---|
> | first-paint (1st UE) | **4.97 s** | 5.11 s |
> | full-pop (100 UE) | **4.97 s** | **7.96 s** |
>
> L5 already paints all 100 UEs **at once at ~5.0 s** (no gap) — first paint is
> **GLB-decode + bundle-bound, NOT UE-warm-bound**, so dropping the count to 1
> saves nothing on first paint and the ramp merely delays full population by ~3 s
> (staggered fill ends LATER than L5's instant-100, perceptually worse too). The
> ~5.0 s figure is already **under** the §6 target (6–8 s). The only count-truth
> work (prefix-stable `createMobilityStates`, count-independent engine serving)
> verified clean — the lever's failure was the cost model, not the truth.
> ~~Original goal/approach kept below for the record.~~
- **Goal:** paint terrain + satellites + primary UE immediately; stream the other
  ~99 UEs in after first paint so there is no "waiting" feel. Defers the
  UE-count-scaling ~6s warm off the critical path.
- **Approach:** start `ueCount` low (1 or a small N), then ramp (e.g. 1→25→100)
  over a few hundred ms after the first canvas frame. UE SINR/serving per UE is
  unchanged — only the *count present at time T* is sequenced.
- **Files:** the sinr-live runtime-config path (`appRuntimeConfig.ts`
  `SINR_LIVE_DEFAULT_UE_COUNT`, the App `runtime.ueCount` plumbing into
  `useSimulation`); the existing S2 aggregate `src/ui/SinrServingAggregate.tsx`
  must show honest "served N / loaded M (→100)".
- **Gate:** end-state equivalence (ramped 100-UE steady state == one-shot 100-UE)
  + an aggregate-honesty assertion (label states loading count, never claims 100
  early). Builds on the S2 mosaic/aggregate truth work — do not fight its
  stable-hash colouring or churn handling.
- **Risk:** med. Changing `ueCount` mid-sim re-inits mobility/HandoverManager
  arrays — keep ramp steps few (1→25→100) to bound re-init cost; watch the S2
  "service churn at transitions" note.
- **Reward:** biggest **perceived**-load win (scene visible in seconds).

### L4 — LOD / progressive quality ("先低品質再恢復")
- **Goal:** low-poly / low-res first, stream to full quality.
- **Approach:** drei `<Detailed>` (three.js `LOD`) with a `gltf-transform simplify`
  low-poly variant per model; KTX2 mipmap/UASTC streaming for blur-up textures.
- **Files:** model components + generated low-poly GLBs.
- **Gate:** screenshot-diff at full quality (low-q is display-only).
- **Risk:** med–high (needs generated low-poly assets).
- **Reward:** polish; pushes the "empty scene visible" floor down further.

### L5 — Memoize trajectory + defer non-critical models
- **Goal:** stop building `createTrajectoryCache` **twice** (~1.8s) and defer the
  9.9MB `uav.glb` full clone off first paint.
- **Approach:** module-level memo keyed by `shells + epoch + observer` (pure fn,
  deterministic); lazy the `uav.glb` preload + 325-node clone (`UAV.tsx:47,17-30`).
- **Files:** `runtimeFrameStep.ts` (trajectory memo), `useSimulation.ts:244`,
  `sinrLiveCellHandoverEventIndex.ts:256`, `UAV.tsx`.
- **Gate:** memo = determinism (output identical); defer = render smoke.
- **Risk:** low. **Prerequisite for L2** (don't bake what you can cheaply memo).
- **Reward:** ~1.8s + smoother first paint. Best effort/reward after L1.

### L6 — Web Worker the offline index scan
- **Goal:** move the (already chunked) ~8s index scan fully off-thread so the
  canvas renders at full rAF and the cinema rail fills in ~8s pure compute.
- **Approach + risks:** see the prior handoff §Remaining (dep-graph audited
  Worker-safe; worker calls the one-shot; governance relock; builder+golden stay).
- **Gate:** S2 chunked golden already pins output identity; add a worker smoke
  (no browser-global throw).
- **Reward:** fixes the rail/paint frame-tax the main-thread chunk still pays.

## 4. Sequencing + the one open decision

**OPEN DECISION — deploy target reorders the plan:** is the real "open the page"
over **localhost** or **a network/remote deploy**? The preview measurements are
localhost, which *hides transfer cost*. If networked, the 20MB+ GLB download likely
dominates → **L1 jumps to first**.

**STATUS (2026-06-13, after the accurate re-measure): localhost load-time
workstream is effectively DONE at L5.** The sinr-live scene paints 100 UEs at
~5.0 s — under the 6–8 s target. The remaining levers do not earn their cost on
localhost:

1. ✅ **L5** (memoize trajectory + defer uav) — DONE; the de-facto finish line.
2. ✗ **L3** (progressive UE) — ABANDONED: net regression, premise was a
   measurement artifact (see L3).
3. ⏸ **L2** (bake/hydrate default t0) — the t0 warm is NOT the first-paint
   blocker (GLB is), so the win is small on localhost; deferred. Still the
   compute lever if a future change makes the warm gate paint.
4. ⏸ **L1** (GLB meshopt+KTX2) — the real first-paint lever (~5 s is GLB+bundle
   bound), BUT: KTX2 needs the missing `ktx` encoder + risks washing the hero
   terrain photo; WebP is transfer-only (≈free on localhost). **Promote to #1
   only for a networked/remote deploy** (transfer dominates there).
5. ⏸ **L4** (LOD) / **L6** (Worker index) — polish / rail; diminishing returns
   on localhost.

If a networked deploy lands, re-open L1 first.

Fold the remaining `computeLinkBudget` storm reduction
(`sinrLiveCellModel.ts:771-800`, SINR-truth golden) into L2/L3 work where it
overlaps the warm path.

## 5. Tooling specifics (web-verified 2026-06-13; pin to installed versions)

Installed: `three ^0.180.0`, `@react-three/fiber ^9.4.0`, `@react-three/drei
^10.7.6`, `vite ^7.1.12`. No draco/meshopt/KTX2/LOD configured today (all plain
`useGLTF`).

**Compression (build step), `@gltf-transform/cli`:**
```bash
# one-pass: meshopt geometry + KTX2 textures
gltf-transform optimize in.glb out.glb --compress meshopt --texture-compress ktx2
# granular texture control (color vs data maps):
gltf-transform uastc in.glb t1.glb --slots "{normalTexture,occlusionTexture,metallicRoughnessTexture}" --level 4 --rdo --zstd 18
gltf-transform etc1s t1.glb out.glb --quality 255
# low-poly LOD variant (L4):
gltf-transform simplify in.glb lod1.glb --ratio 0.25 --error 0.01
```

**drei `useGLTF` wiring (meshopt = 3rd arg, KTX2 = 4th `extendLoader`):**
```ts
// src/scene/gltfLoaders.ts — singleton (avoids "multiple active KTX2 loaders")
import { KTX2Loader } from 'three-stdlib';
const ktx2 = new KTX2Loader().setTranscoderPath('/basis/'); // VENDOR transcoder into public/basis/ (pin three@0.180.0), do NOT rely on unpkg CDN at runtime

// in a component (gl from useThree()):
const { scene } = useGLTF(
  path,
  false,           // useDraco
  true,            // useMeshOpt  ← drei wires MeshoptDecoder
  (loader) => loader.setKTX2Loader(ktx2.detectSupport(gl)), // extendLoader → KTX2
);
```
Notes: meshopt decodes faster than draco (preferred for load-time); KTX2 textures
upload to the GPU without a main-thread decode. Transcoder version MUST match
`three@0.180.0`. Vendor the basis transcoder files locally for the offline demo.

## 6. Measurement protocol + targets

Harness: `npm run build` → `npx vite preview --port 4173 --strictPort` →
`APP_URL=http://localhost:4173 RUNS=3 node --import tsx/esm
scripts/_measure-loadtime.ts`. Always measure **sinr-live** (preview lacks the
`/modqn-bundles` middleware). ⚠️ **Use `_measure-loadtime.ts` (setTimeout+evaluate
polling), NOT `_chk-render.ts` / `_probe-loadtime.ts` (Playwright
`waitForFunction`)** — the rAF-polling probes are starved by the R3F render loop
and report ~3 s late (see §1 correction). Kill the preview by its port pid (`ss
-ltnp | grep 4173`), never `pkill -f "vite preview"` (kills your own shell).

True baseline (accurate probe, post-L5, 2026-06-13): **first-paint = full-pop ≈
5.0 s** (100 UEs at once) · index rail ≈ 15–16 s (off the paint path) · 100 UEs ·
0 errors. **Target scene-visible ≤ 6–8 s is MET.** Hold the line: no truth
regression (`validate:governance:full` green) and don't regress the ~5 s paint.

## 7. Out of scope / non-goals

- No WebGPU/OffscreenCanvas renderer pivot (big, separate).
- No change to research truth: SINR/handover/serving/MODQN math, replay-bundle
  core, S0–S5 invariants untouched.
- No batched landings — one lever per PR, each gated.
</content>
