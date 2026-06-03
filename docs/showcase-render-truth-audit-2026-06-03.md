# Showcase Render-Truth Audit — 2026-06-03

Read-only audit (5-agent workflow + main-thread eyes-on browser matrix) of what the
showcase **actually renders** vs what memory marks "COMPLETE + browser-verified".
Trigger: user observed the artifact-replay scene as "one orange dot, UEs stacked,
no satellites, no beams — meaningless".

Conclusion: the observation is real. The **artifact-replay lane is fed fake data
in dev and is empty in a real build**, and essentially **no user-facing visual
surface was ever verified against real producer data** — verification used a
synthetic fixture or a route-mock. The flowchart F1 slice this session is correct
but was verified on that same fake scene. The **live lanes are healthy**.

---

## A. Core problem (BLOCKER / MAJOR)

| # | Finding | Detail | Evidence |
|---|---|---|---|
| A1 | **Producer `visual-showcase-v1.json` is GONE** | The pinned path `modqn-paper-reproduction/artifacts/phase-01h-mp5-visual-showcase-cli-smoke-2026-05-22/visual-showcase-v1.json` (and its parent dir) does not exist; no visual-showcase artifact anywhere in the producer repo. | `vite.config.ts:93`; `find … -iname '*visual-showcase*'` → empty |
| A2 | **Dev = silent SYNTHETIC fixture** | `npm run dev` vite middleware intercepts `/showcase-artifacts/visual-showcase-v1.json` and serves `scripts/visualShowcaseValidatorFixture.ts` (4 sats, 100 UEs in a 10×10 grid, synthetic SINR/handover, 0 beams) with header `X-Showcase-Artifact-Source: synthetic-fixture-fallback`. The artifact-replay 3D scene + dashboard + flowchart + director cinematic all ride this fake data. | `vite.config.ts:92-130`; `visualShowcaseValidatorFixture.ts` |
| A3 | **Prod/static build = 404 → fail-closed blank** | The fallback lives only in `configureServer` (dev). A static build has no middleware → fetch 404 → `shouldRenderMainScene=false` → empty `artifact-scene-fail-closed` div (no sats/beams/UEs). | `App.tsx:1683,1906-1915,1246` |
| A4 | **App can't tell fake from real** | `App.tsx:1246` fetch never reads `X-Showcase-Artifact-Source`. The ONLY fixture-vs-real signal is the fixture self-declaring `evidenceStatus=validator-only`, surfaced by the `ClaimBoundaryBanner` (itself an unstyled-defect until T2-S5 `5ca1978`). No console warning, no scene data-attribute. | grep: no header reader in `src/` |

**This is what the user saw.** They were on artifact-replay (the flowchart lane): fixture's 4 sats are off-frame (camera ground-focused), 0 beams (artifact lane renders none by design), UEs are a synthetic grid + one highlighted primary ("the orange dot").

## B. Verification never touched real data (MAJOR)

| # | Finding | Evidence |
|---|---|---|
| B1 | dashboard/flowchart "browser-verified" = the **synthetic fixture** (route-fulfilled). Never real producer JSON. F1 landscape re-layout included. | `validate-phase-d-dashboard-browser.ts:47-49` |
| B2 | live-telemetry P2/P4/P3a "browser-verified" = **100% route-mock** (`route.fulfill`, no backend, hand-built SSE). The "curve" scenario feeds synthetic per-episode reward the producer doesn't emit. | `validate-phase-d-live-telemetry-browser.ts:77-95,214-235` |
| B3 | **Director Phase-2 + the whole cinematic mini-phase (D1-D6, D3 fade) have NO durable browser validator.** Every "real-browser probe PASS" in memory was ad-hoc manual; the only gates are SSR/unit (camera-preset/director-pose/cinematic-window). | `ls scripts | grep -i director\|cinematic` → empty |
| B4 | Phase-3 overlays verified via unit + a no-WebGL-error shader smoke on synthetic/forecast data, never real producer beam-load. | `validate:phase-3` = unit/SSR |
| B5 | Only **P3b Tier-2a** touched real producer data — and only the producer parser side; the consumer real-data render was explicitly skipped as "redundant". | memory 132-135 |

## C. Intended-minimal / honest-empty (NOT bugs, but read as "broken")

| # | Finding | Evidence |
|---|---|---|
| C1 | modqn-demo default preset `baseline-faithful` renders **0 beam cones** (gated to explain-handover/service-allocation/debug presets). Cells DO render. | `modqnVisualLayers.ts:24,33-43`; `MainScene.tsx:1156` |
| C2 | **Satellites are never clearly framed** — camera is ground-focused in every lane; the 4/12 sats sit at altitude above the viewport. Not culled, just off-frame. | `sceneLaneRenderPlan.ts:88-92` |
| C3 | artifact-replay scene is **minimal by design**: even a real artifact = only satellites + UE dots (no beams, no cells, no effects). | `MainScene.tsx:348-462` |
| C4 | Backend `:8765` down → `LiveTelemetryPanel` Idle, `JobsPanel` offline, `ArtifactPicker` empty, `ServiceStatusBanner` unreachable. Honest fail-closed, but in modqn-demo reads as a half-built dashboard. | `LiveTelemetryPanel.tsx:142-173`; `JobsPanel.tsx:271-274` |
| C5 | 4 permanent source-gap telemetry tiles (Loss/Pareto/Q/LR) + queue-depth "not modeled (full-buffer)" — by design. | `LiveTelemetryPanel.tsx:256-290`; `ModqnSceneHud.tsx:127-132` |

## D. Healthy (good news)

| # | Finding | Evidence |
|---|---|---|
| D1 | **Live lanes are NOT broken.** sinr-live = rich (satellites + yellow beam cone + ground footprint + earth-fixed cells). modqn-live-cell-preview = satellites + 10-cell overlay + 100 distributed UEs colored by service map. | eyes-on screenshots; telemetry sat=12 |
| D2 | **MODQN replay bundle chain is on disk** (baseline run dir, `.venv/bin/modqn-export`, `/tmp` manifest/provenance/step-trace all present) → modqn-replay-proof / live-cell lanes have REAL producer bundle data; missing bundle fails LOUD (visible banner), not silent. | `replay-state.ts:35-39`; per-file `test -f` |
| D3 | Code-default lane (`sinr-experiment` / `sinr-live`) is clean: AlgorithmDock + modqn empty panels don't mount. The "broken" perception is conditional on modqn-demo / artifact-replay. | `appExperienceMode.ts:8`; `sceneLane.ts` |

## E. Needs a clean eyes-on

- "UEs stacked" — the fixture is a 10×10 grid (should spread); live UEs spread unless radius collapses to 0. Possibly a camera-zoom artifact (the earlier director-focus click) rather than a layout bug. Verify on a clean artifact-replay load (no director click). `multiUeState.ts:248-252`

---

## Prioritized fixes (separate from this read-only audit)

1. **Regenerate the producer `visual-showcase-v1.json`** so artifact-replay shows real data. Producer CLI `.venv/bin/modqn-visual-showcase` + exporter modules exist; baseline run dir is on disk. Scope heavy-vs-not next; likely route to the Ubuntu server if it needs a replay pass. **#1.**
2. **Make the synthetic fallback LOUD** (read `X-Showcase-Artifact-Source` → console warn + a scene `data-artifact-source` attribute + a visible dev badge) so fake data can never be mistaken for a result. Small in-repo, in-environment.
3. **Decide the demo's primary lane.** If `modqn-live-cell-preview` (real bundle, cells, UEs) is the centerpiece, artifact-replay emptiness matters less. If artifact-replay is the showcase, fix #1 is mandatory.
4. **Add a durable Director/cinematic browser validator** (assert the camera actually moves + slow-mo + fade) — close the B3 gap.
5. (design) Whether artifact-replay should render beams/cells (C3), and whether a default camera framing should show satellites (C2).
