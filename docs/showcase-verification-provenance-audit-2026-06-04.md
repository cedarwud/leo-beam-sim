# Showcase Verification-Provenance Audit — 2026-06-04

Read-only multi-agent audit (6 lane auditors + synthesis + adversarial critic, 711k tokens).
Question it answers: of every "COMPLETE / browser-verified" claim across the showcase, which are
backed by REAL producer / live-engine data vs synthetic-fixture / route-mock / logic-only-string?

Driven by the user's challenge: "SDD 說開發完成，為什麼還這麼多修？還有沒修到的部分嗎？"
Short answer: features are wired + type-safe, but the artifact-replay lane's "browser-verified"
labels largely run on fixtures/mocks. The live lanes are genuinely real-data proven. Details below.

NOTE: the critic corrects the synthesis on three points — director intra-HO rows should be
"real-today-fragile" not "solid" (same LOUD-SKIP as the FIX-5 compass), phase6o overclaims an
external oracle like phase6p, and ~15 surfaces were missed (real denominator ~85-90, not 71).

---

## Synthesis — Provenance Ledger + Verdict

I have all the per-lane audit tables already provided in the task. I'll merge them into one honest report. Let me compile the merged ledger from the five lanes (artifact-replay-scene, artifact-replay-dashboard, director-cinematic, modqn-live-cell-preview, sinr-live-and-replay-proof, cross-cutting).

## Provenance Ledger

| Lane | Surface | DataSource | RealData? | Severity | Gap |
|---|---|---|---|---|---|
| modqn-live-cell-preview | Phase-3 contention glow (S3 instanced glow) | logic-only-string | no | fake-risk | Source-string mount assert only; audit B4 + FIX-6 residual #2: glow NEVER eyes-on on real beam-load. |
| modqn-live-cell-preview | Phase-3 3D beam-load cylinder (S4) | logic-only-string | no | fake-risk | Mount proven by `mainScene.includes('<BeamLoadCylinder')` only; never rendered on real data (audit B4, FIX-6 residual #2 open). |
| artifact-replay-scene | Dashboard + flowchart on real data (artifact-replay dock) | route-mock / synthetic-fixture | no | fake-risk | Standing "browser-verified" gate is 100% route-mock fed the synthetic fixture (audit B1). Real-data was a single manual smoke. Green CI here proves nothing about real producer data. |
| cross-cutting | Live-telemetry browser gate (INV-1/2 render, fail-closed) | route-mock | no | fake-risk | "curve" scenario feeds a per-episode reward shape the producer does NOT emit; 100% route-mock, no backend. Reads as verified, never touched a real training stream (audit B2). |
| artifact-replay-scene | Fail-closed (static build / 404 → `artifact-scene-fail-closed`) | unverified | no | unknown | No validator exercises the 404/fail-closed render path. Logic visible in `App.tsx:1716,1948-1956`, never tested. |
| artifact-replay-scene | Replay interpolation world-space linearity | synthetic-fixture | no | weak | Loader pins OLD missing `phase-01h-mp5` path → runs synthetic fixture; pure adapter math sound but unverified on real producer geometry. |
| artifact-replay-scene | `showcaseArtifactToScene` adapter (counts/brand/coord/claimBoundary) | synthetic-fixture | no | weak | Asserts 28 beams + claimBoundary.storyKind; REAL artifact has 0 beams + `claimBoundary: undefined`. Passes only because fixture fabricates them. |
| artifact-replay-scene | 3D scene 100-UE markers (artifact-replay) | mixed (p2a synthetic; real only via uncommitted manual smoke) | no | weak | Only real-data check is a one-time ad-hoc playwright run + screenshot; durable p2a runs synthetic 10×10 grid. No standing gate proves real 100-UE render. |
| artifact-replay-scene | Satellite azimuth compass (FIX-5 Option C) | real-producer (browser) + pure-unit | yes | weak | Browser validator reads live `producer-pinned` real ring, BUT LOUD-SKIPs exit-0 when source≠producer-pinned; 89s artifact not committed → fresh checkout silently green-skips. Real today, fragile. |
| artifact-replay-scene | Artifact source badge / honesty surface (FIX-1) | logic-only-string + real-producer (one-time manual no-badge smoke) | no | weak | Standing gates are `readFileSync + includes`. `decideArtifactSourceBadge` has no unit test. Producer-pinned no-badge path real-data verified ONCE manually, not by any committed validator. |
| artifact-replay-scene | Claim boundary banner (artifact-replay) | pure-unit (SSR snapshot) | no | weak | SSR-renders with hand-built input, not real artifact frame. Real `claimBoundary: undefined` graceful-fallback observed manually, not asserted. |
| artifact-replay-scene | FIX-2 artifact regen / `producer-pinned` emitter | real-producer (manual curl/smoke) + logic-only-string | yes | weak | Emitter genuinely stat()s + serves real 46MB artifact, BUT only durable gate is a string assert; artifact not committed anywhere → emitter silently falls to synthetic if wiped. |
| artifact-replay-dashboard | AlgorithmDashboard (mode=artifact, data-artifact-loaded) | route-mock | no | weak | Durable validator route-fulfills SYNTHETIC fixture ("does not depend on pinned producer artifact"). Real-data check was one-off manual smoke, not committed. |
| artifact-replay-dashboard | AlgorithmFlowchart 8 nodes / 8 edges (F1 landscape) | mixed (route-mock + SSR-synthetic) | no | weak | Node/edge counts asserted only vs synthetic fixture. No real-producer node/edge assertion in any durable gate. |
| artifact-replay-dashboard | Flowchart edge pulse (rAF, fires on intra-HO events) | route-mock + pure-unit | no | weak | Pulse-on-real-82-intra-HO is ad-hoc manual. Durable pulse runs on synthetic handover events; mapping is pure-unit; rAF marker is a string assert. |
| artifact-replay-dashboard | Provenance chips (>=8 INV-1 chips per tile) | route-mock | no | weak | Chip count asserted vs synthetic fixture provenance. "Real artifact provenance chips" never asserted in a durable gate. |
| artifact-replay-dashboard | RewardCurvePanel + dashboard series provenance (Plane-C) | synthetic-fixture | no | weak | All series/SSR/provenance run on hand-coded envelope + synthetic fixture. No real-producer reward series exercised. |
| artifact-replay-dashboard | DecisionVizPanel (top-K / dense scores / weights) | synthetic-fixture + logic-only-string | no | weak | Snapshot/SSR driven by synthetic envelope; App-wiring asserts are string greps. No real-producer-bundle decision data exercised. |
| artifact-replay-dashboard | Episode-progress JobsPanel (determinate percent bar) | pure-unit + manual-adhoc (mocked useState SSR) | no | weak | parseEpisodeProgress pure-unit (solid for parser). SSR uses hand-mocked useState + fabricated stdoutTail. Regex is case-sensitive `episode N/M`, NOT producer's actual `[…ep N/M]` format — a real-data gap. |
| director-cinematic | Inter-HO focus button | pure-unit | no | weak | Structurally untestable: 0 inter events in only real artifact. Real inter-HO cinematic (seek+pair-frame+camera) never exercised on real data. |
| director-cinematic | D3 dim-fade seek overlay | mixed | no | weak | Browser observation is SOFT (headless rAF throttle can miss → WARN, not fail). Fade-renders proof is opportunistic, not asserted. |
| director-cinematic | D6 sat-pair framing (inter centroid pose) | pure-unit | no | weak | D6 only activates for inter-HO → never reached in browser gate. Pure-math + source-string only; no real-data render. |
| director-cinematic | Camera preset poses (zenith/oblique/chase/closeup) | logic-only-string + SSR | no | weak | 21 of 31 checks are readFileSync+string-assert; no runtime/browser proof presets frame the scene. |
| modqn-live-cell-preview | Footprint + cell handover arcs | logic-only-string | no | weak | Mount/telemetry wiring proven only by `mainSceneSource.includes('<CellHandoverArcs')`; no runtime/browser render. |
| modqn-live-cell-preview | MODQN decision overlay (serviceMap / handoverStory layers) | logic-only-string | no | weak | Lane gating proven by render-plan booleans + source `.includes()`; no browser proof overlay actually paints on real live bundle. |
| modqn-live-cell-preview | Visual layer presets (modqnVisualLayers gating) | logic-only-string | no | weak | Preset→layer mapping verified by string assertions only; no browser run across presets on real data. |
| modqn-live-cell-preview | Phase-3 upload particles (S5) | pure-unit | no | weak | Caps/gates/cone-plans pure-tested with synthetic THREE cones; mount is source-string; no browser render on real beam-load. |
| modqn-live-cell-preview | Live telemetry dock — LiveTelemetryPanel (P2) | route-mock | no | weak | 100% route-mock: no real :8765 backend, hand-built /jobs+SSE. Never seen real trainer SSE in browser. |
| modqn-live-cell-preview | MiniRewardCurve render (P3a) | synthetic-fixture | no | weak | Curve fed synthetic fixture + route-mock reward producer didn't emit pre-G-A; no real reward stream render. |
| modqn-live-cell-preview | P3b reward-curve population (producer parser branch) | route-mock | no | weak | Only producer parser side touched real stdout; consumer real-data render skipped as "redundant" (audit B5). Real E2E never run. |
| modqn-live-cell-preview | TrainingTelemetryFeed SSE (single store publisher) | route-mock | no | weak | Real code opens real EventSource to :8765, but every test mocks network; never validated against live training service SSE. |
| modqn-live-cell-preview | Episode progress tile (JobsPanel) | logic-only-string | no | weak | parseEpisodeProgress pure but tile render is SSR/source-string; no real backend progress lines. |
| modqn-live-cell-preview | MODQN decision viz panel (top-K / dense scores) | logic-only-string | no | weak | SSR'd with inline data + source-string wiring; not driven by real producer policyDiagnostics in a browser. |
| sinr-live-and-replay-proof | sinr-live beam rendering (live SINR cones/footprint) | logic-only-string | no | weak | S1 validator only string-greps MainScene gate; "rich render" rests on eyes-on audit D1, no durable browser gate asserting cones paint. |
| sinr-live-and-replay-proof | sinr-live satellite markers | logic-only-string | no | weak | String-only grep of sceneLaneRenderPlan.ts; no runtime assertion sats render in viewport. |
| sinr-live-and-replay-proof | sinr-live callouts / beam-hopping / orbit-trail / inter-HO arc / HUD camera | logic-only-string | no | weak | Entire Phase-H S3-S6,S8 suite is readSource+includes; behavior never exercised. |
| sinr-live-and-replay-proof | HOBS SINR KPI baseline (Phase 6P) | synthetic-fixture | no | weak | Asserts vs checked-in fixture JSON, not a fresh engine/producer run; parity is to a frozen snapshot. |
| sinr-live-and-replay-proof | MODQN replay scene layer wiring (Phase7k) | logic-only-string | no | weak | Pure source-string; no runtime render of the replay-proof scene. |
| sinr-live-and-replay-proof | vc2a-d spine/endpoint/satellite tint, role pulse | logic-only-string | no | weak | Static token/source checks; behavior not exercised. |
| sinr-live-and-replay-proof | vc3b-e spine-particles/orbit-trail/serving-ripple/spotlight-fog | mixed | no | weak | Mostly source-string; effect presence not behaviorally exercised. |
| sinr-live-and-replay-proof | vc4b-d tuning/controlbar/diagnostics drawers | live-engine | yes | weak | Exercises real UI but not SINR/HO data truth — lane-adjacent UX. |
| sinr-live-and-replay-proof | vc-baseline-proof-strip (browser) | live-engine | yes | weak | Live app render of strip; presentation, not data-truth. |
| cross-cutting | Scene-lane governance (lane matrix, FIX-1/4/5 honesty locks) | mixed (logic-exec resolvers + logic-only-string) | no | weak | Lane logic executed, but FIX honesty wiring (badge mount, director-phase, compass caption) verified only by source.includes — no runtime render. |
| cross-cutting | Phase6p HOBS/SINR KPI baseline | live-engine vs committed self-snapshot | no | weak | Real engine recompute BUT compared to leo's OWN fixture, NOT `ntn-sim-core/baseline-kpi-*.json` (0 refs). Self-regression lock; "baseline" overclaims an external oracle. |
| cross-cutting | Timeline authority — scrubber clamp/seek + descriptor | pure-unit (clamp) + logic-only-string | no | weak | Clamp math real pure-unit; TimelineBar wiring is SSR string-presence. No real producer/live data exercises the scrubber UI. |
| cross-cutting | P3b producer-progress parser — consumer side | pure-unit + logic-only-string + synthetic-fixture | no | weak | Consumer parse/select/staleness pure-unit; curve render SSR over synthetic bundle. Real-data only producer-side Tier-2a; consumer real-data render skipped as "redundant." |
| artifact-replay-scene | Azimuth derivation (`deriveSatelliteAzimuths`) | pure-unit | no | solid | Pure function, hand-built sat inputs. Correct + load-bearing (proxy gate logic), but constructed vectors, not real artifact. |
| artifact-replay-dashboard | Dock collapse / restore | route-mock | no | solid | Behavior is data-independent (DOM toggle); route-mock adequate. Only the data-source label is non-real. |
| artifact-replay-dashboard | Flowchart static scaffold (no three/Canvas; rAF pulse; single CSS anim) | logic-only-string + synthetic-fixture (SSR) + pure-unit | no | solid | Structural/import-ban asserts correct; render+bindings on synthetic. Solid for contract; NOT a real-data render proof. |
| director-cinematic | Camera focus tween (camera actually moves on focus) | real-producer | yes | solid | Verified on real producer-pinned artifact; gate LOUD-SKIPs exit-0 if artifact absent; not in any aggregate/CI — durability rests on non-committed producer-disk file. |
| director-cinematic | 0.05x cinematic speed tier | real-producer | yes | solid | effectiveSpeed→0.05x on focus, restored on exit, real artifact. Same skip-on-absent caveat. |
| director-cinematic | Ownership FSM (idle→acquiring→focused→restoring→idle) | real-producer | yes | solid | Browser proves phase transitions on real artifact; §(j) pairing is logic-only-string. |
| director-cinematic | Intra-HO focus button (enable + click) | real-producer | yes | solid | intra enabled on real 82 intra-HO events; click drives focus. Best-covered surface. |
| director-cinematic | cinematicReplayWindow selection (next-event, clamp, auto-end) | pure-unit | no | solid | Pure-unit is right tool for pure function; no real-data claim made. |
| modqn-live-cell-preview | Cell overlay (10-cell live overlay) | live-engine | yes | solid | Browser gate asserts overlay mounts + no console errors + source-gap, NOT cell-schedule numeric correctness on real bundle. |
| modqn-live-cell-preview | Cell scheduler (slot schedule / active-idle) | pure-unit | no | solid | Pure deterministic scheduler test; no live-lane render assertion of scheduled cells. |
| modqn-live-cell-preview | Beam geometry (cell beam cones geometry) | pure-unit | no | solid | S5b mount gate is `.includes()` string asserts; no browser render of cones on real data. |
| modqn-live-cell-preview | 100-UE service map (distributed UEs colored by serving) | live-engine | yes | solid | Eyes-on healthy is ad-hoc screenshot; durable gate checks lane mounts + no errors, NOT UE color/serving truth. |
| modqn-live-cell-preview | Phase-3 beam-load contention (model) | pure-unit | no | solid | Pure function fully tested; not exercised on real bundle UE serving in a render. |
| modqn-live-cell-preview | Phase-3 CPU budget throttle (S1 §8) | live-engine | yes | solid | Real engine throttle cadence + 100-UE microbench. Data is synthetic benchmark snapshots, exercises live engine path. |
| modqn-live-cell-preview | INV-2 staleness resolver (live/stalled/offline) | pure-unit | no | solid | Pure resolver exhaustively unit-tested; browser badges driven by route-mock timestamps, not real heartbeats. |
| modqn-live-cell-preview | HUD preview banner / cell-schedule truth | logic-only-string | no | solid | Banner text + toggle-removal via SSR + App.tsx includes; honest source-gap labeling, low truth-risk. |
| modqn-live-cell-preview | Constellation coverage / serving-count selector | synthetic-fixture | no | solid | "RealGeo" fixture is self-computed synthetic geometry (misleading name), fed to real scheduler; deterministic, low risk. |
| sinr-live-and-replay-proof | sinr-live beam material opacity tokens (S7) | pure-unit | no | solid | Pure constant check; doesn't prove render, but token is the truth source. |
| sinr-live-and-replay-proof | Live walker 7200s timeline + trajectory cache | live-engine | yes | solid | Runs real orbit+handover engine end-to-end; strong (engine, not browser). |
| sinr-live-and-replay-proof | Live walker handover event index (7200) | pure-unit | no | solid | Exercises real index builder funcs; partly source-string for wiring. |
| sinr-live-and-replay-proof | Handover event rail focus (SSR) | pure-unit | no | solid | SSR + pure deriver on hand-built events; no live data. |
| sinr-live-and-replay-proof | Handover event focus (browser, 3 lanes) | live-engine | yes | solid | Real live engine in browser; replay-proof case opens real bundle viewport. |
| sinr-live-and-replay-proof | HOBS TR 38.811 SINR link budget / LOS / slant-range (Phase 1) | pure-unit | no | solid | Real algorithm, hand-built sat fixtures; numeric ground truth via independent formula. |
| sinr-live-and-replay-proof | HOBS TR 38.811 dynamic power control (Phase 2) | pure-unit | no | solid | Real engine fns, fixture inputs. |
| sinr-live-and-replay-proof | MODQN replay state model (Phase7c) | real-producer | yes | solid | Runs real `.venv/bin/modqn-export` on on-disk baseline; fixture-only branch fenced. |
| sinr-live-and-replay-proof | MODQN replay diagnostics (Phase7d) | real-producer | yes | solid | Real exported bundle surfaces; fixture-only path fenced. |
| sinr-live-and-replay-proof | vc1a-d live legend / density / freq-color / identity (SSR) | pure-unit | no | solid | SSR of real components; presentation logic, no live data needed. |
| sinr-live-and-replay-proof | vc3a hex paint (color on rendered tile) | live-engine | yes | solid | Reads real rendered canvas pixels; JSON fixture = expected-ΔE table, not data under test. |
| sinr-live-and-replay-proof | vc4a duel-card (browser layout) | live-engine | yes | solid | Drives real app page; layout measured on live render. |
| sinr-live-and-replay-proof | vc-intra-handover-arrow (browser) | live-engine | yes | solid | Real live engine arrow lifecycle. |
| sinr-live-and-replay-proof | s2 wall-clock latch (intra-HO arrow vs clock) | live-engine | yes | solid | Real live sim arrow+clock; drives speed slider. |
| sinr-live-and-replay-proof | s4/s4b intra shockwave / ribbon | live-engine | yes | solid | Real live render. |
| sinr-live-and-replay-proof | s5 diagnostics rate | live-engine | yes | solid | Real live engine diagnostics. |
| sinr-live-and-replay-proof | t1 ΔSINR histogram | live-engine | yes | solid | Real live-computed ΔSINR; bucket-sum + single-increment invariants. |
| sinr-live-and-replay-proof | t2 observed window | live-engine | yes | solid | Real live engine window stats. |
| sinr-live-and-replay-proof | vc-fixture smoke | synthetic-fixture | no | solid | By-design fixture smoke; not a product surface claim. |
| cross-cutting | Architecture import boundaries | live-engine (real import-graph walk) | no | solid | Whole-tree import-graph traversal; static-truth check (N/A for producer data). |
| cross-cutting | MODQN render isolation (UE marker/sat altitude/Walker visibility) | mixed (live-engine orbit + logic-only-string) | no | solid | Natural-Walker visibility is real numeric geometry check; MainScene probes string-presence only. |
| cross-cutting | Phase6 channel/beam vendor parity vs ntn-sim-core (6d/f/h/j/k/o/v) | live-engine (real numeric compute compare) | no | solid | Genuine numeric parity (tol 1e-12 channel / 0.25 dB adapter) + SHA-256 byte-identical source pin. Strongest evidence in cross-cutting lane. |
| cross-cutting | Timeline authority — live-walker 7200s rail/horizon | live-engine | no | solid | Real Walker propagation + frame step drives horizon assertions. |

## Counts

| Metric | Count |
|---|---|
| **total** | 71 |
| **solid** | 36 |
| **weak** | 29 |
| **fake-risk** | 4 |
| **unverified (unknown)** | 1 |
| **realDataVerified** | 21 |

Per-lane reconciliation: artifact-replay-scene 10 (solid 1 / weak 7 / fake-risk 1 / unknown 1; realData 2) + artifact-replay-dashboard 8 (solid 2 / weak 6; realData 0) + director-cinematic 9 (solid 4 / weak 5; realData 4) + modqn-live-cell-preview 18 (solid 7 / weak 9 / fake-risk 2; realData 3) + sinr-live-and-replay-proof 27 (solid 18 / weak 9; realData 12) + cross-cutting 9 (solid 4 / weak 4 / fake-risk 1; realData 0) = **71 total** (solid 36 / weak 29 / fake-risk 4 / unknown 1; realData 21). Note: realData counts are independent of the solid/weak/fake-risk axis — a row can be weak-but-real (e.g. FIX-5 compass) or solid-but-not-real (e.g. Phase6 vendor parity).

## Top Gaps (ranked)

1. **artifact-replay dashboard/flowchart "browser-verified" runs on synthetic fixture** (fake-risk). The standing `validate:phase-d:dashboard:browser` gate route-fulfills the synthetic fixture and can pass forever on fake data; the FIX-6 real-82-intra-HO claim (`d4d5721`) was a one-off manual smoke. **Action:** add a durable `validate:phase-d:dashboard:real-data` browser gate that asserts `data-artifact-source=producer-pinned` + node/edge/chip counts + pulse on real handover events, FAIL-on-load-failure, no LOUD-SKIP. `[in-env]`

2. **Phase-3 contention glow (S3) + 3D beam-load cylinder (S4) never rendered on real beam-load** (fake-risk ×2). Backed ONLY by `mainScene.includes('<BeamLoadCylinder')` source-string mounts; audit B4 + FIX-6 residual #2 confirm zero eyes-on. **Action:** one durable browser gate that drives the live modqn-cell lane with real beam-load and asserts the glow/cylinder instances actually paint (instance count > 0). `[in-env]`

3. **Live-telemetry browser gate feeds a reward shape the producer does not emit** (fake-risk). 100% route-mock; the per-episode reward in the "curve" scenario was never produced pre-G-A. **Action:** repoint the curve scenario to the real P3b parser output shape (or run the Tier-2 server E2E and capture a real SSE fixture), then assert the curve renders from it. `[needs-server]`

4. **Inter-HO director cinematic path has NEVER executed on real data** (weak, but load-bearing). Button-enable, seek, D6 sat-pair frame, inter camera pull-back are all pure-unit + SSR; the only real artifact has 0 inter-satellite handovers (82 intra). **Action:** generate/obtain a producer artifact containing at least one satellite handover and run the FIX-4 director browser gate clicking the inter button. `[needs-different-data]`

5. **3D 100-UE artifact-replay scene + FIX-1 no-badge path proven only by one-time manual playwright** (weak). Durable p2a/p3/p1ab run the synthetic 10×10 grid (loader pins the OLD missing `phase-01h-mp5` path); no standing gate proves the real 100-UE render or the producer-pinned no-badge surface. **Action:** add a real-data scene browser gate gated on `producer-pinned` asserting 100 UE markers render + no badge; add a unit test for `decideArtifactSourceBadge`. `[in-env]`

6. **FIX-2 producer-pinned emitter + FIX-5 compass + FIX-4 director gates depend on an uncommitted 46MB artifact** (weak/real-today-but-fragile). All three are real today but the 89s artifact is in neither leo nor producer git; if wiped, emitter silently falls to synthetic and the real-data browser gates LOUD-SKIP exit-0. **Action:** commit the artifact (or a git-LFS/checked-in regen lock) and convert the LOUD-SKIP to FAIL-on-absent so a fresh checkout cannot green-skip. `[in-env]`

7. **Episode-progress / P3b consumer regex mismatches the producer format** (weak). The SSR percent-bar validator uses case-sensitive `episode N / M`, but the real producer emits `[…ep N/M]` (per the P3b parser pivot). **Action:** align the consumer-side test regex to the real producer line and exercise it against a captured real stdout sample. `[needs-server]`

8. **Phase-H sinr-live "rich render" (beams/sats/callouts) has no durable browser gate** (weak). Entire Phase-H S1-S6,S8 suite is `readSource()+includes()`; the rich-render claim rests on eyes-on audit D1 only. **Action:** add a Phase-H durable browser gate (parity with FIX-4 director) asserting cones/sats/callouts actually paint on the live lane. `[in-env]`

9. **Fail-closed (404 → empty honest div) reasoned-about, never tested** (unknown). No validator exercises the `App.tsx:1948-1956` fail-closed branch. **Action:** add a browser/SSR gate that serves a 404 and asserts the fail-closed div renders (and no synthetic fallback leaks). `[in-env]`

10. **Phase6p "KPI baseline" overclaims an external oracle** (weak). Despite the name it deep-equals leo's own committed fixture, not `ntn-sim-core/baseline-kpi-*.json` (0 refs). **Action:** either rename it to "self-regression snapshot" or wire it to actually compare against the authoritative `ntn-sim-core` baseline. `[in-env]`

## Honest Verdict

The live/engine half of the showcase is genuinely real-data proven and that is where the strength concentrates: the entire **sinr-live + modqn-replay-proof** lane (real `.venv/bin/modqn-export` producer bundle, real in-browser live-sim engine for vc/s/t arrows, ΔSINR, walker-7200), the **cross-cutting Phase6 vendor parity** (real numeric compare to 1e-12 with SHA-256 byte-identical pins), and the **director intra-HO cinematic** (FIX-4 browser gate on the real producer-pinned artifact) are not fixture theater — 21 of 71 surfaces are backed by real producer or live-engine data. But the **artifact-replay lane is the opposite story and several of its "COMPLETE + browser-verified" claims are not real-data verified at all**: the dashboard/flowchart/glow/cylinder/live-telemetry "browser-verified" labels (4 fake-risk) run on synthetic fixtures or route-mocks that can pass green forever without ever touching real data, and the FIX-6 real-82-intra-HO and FIX-2 real-100-UE evidence is one-time manual playwright smoke with no committed durable gate behind it. The single most material honesty gap is structural, not fixable by a test: the **inter-HO cinematic path has never executed on real data because the only producer artifact contains zero satellite handovers** — that feature ships unverified and is honestly logged as such. Compounding the fragility, the three genuinely-real artifact-replay gates all depend on an uncommitted 46MB artifact that, if deleted, causes silent synthetic fallback or exit-0 LOUD-SKIPs rather than failures, so a fresh checkout's "green" proves nothing. Net: roughly half the showcase is real-data proven, the other half is fixture/mock/string-lock, and at least four surfaces marked complete are verified only on fabricated data — the live lanes are trustworthy, the artifact-replay lane's completeness claims should be read as "wired and type-safe," not "proven on real producer data."

---

## Adversarial Critic

All confirmed:
- **`validate-phase-3-overlays.ts`** (line 22,28,55,73-84): pure `readFileSync` + `mainScene.includes('<BeamLoadCylinder')` — exactly the source-string mount the report flagged as fake-risk for S3/S4. Independently confirmed.
- **`modqn-handover-story-layer`** (line 73,77,81): `readFileSync` + `source.includes` — logic-only-string, matching the report.
- The `grep` for "fail-closed" found those tokens in browser validators that merely *reference* the concept (e.g. as a console-error filter or comment), NOT a dedicated 404 fail-closed render test. The report's "unknown — never tested" rating holds.
- **live-walker-handover-event-focus-browser**: real lanes (sinr-live / modqn-live-cell-preview / modqn-replay-proof), no LOUD-SKIP — genuine live-engine. Report's "solid yes" correct.

I now have enough independently-verified evidence to deliver the adversarial critique.

---

## Missed Surfaces

The lane audit's 71 rows omit several user-facing surfaces and a whole `validate:*` family that carry implicit "COMPLETE" status. None are fake-risk, but their absence means the report's `total=71` understates coverage and hides two real-data engine surfaces.

| Missed Surface | Where it's claimed | DataSource (verified) | Severity | Evidence |
|---|---|---|---|---|
| **UE mobility step** (multi-UE walk + handover recompute) | `validate:phase-g:ue-mobility-step` | **live-engine** (real `mobilityStep` + `HandoverManager` + `createObserverContext`) | solid, realData=**yes** | `scripts/validate-phase-g-ue-mobility-step.tsx:7-26` imports real engine modules. Missing from report — a genuine real-data surface uncounted. |
| **UE mobility UI / params / trail-viz** | `validate:phase-g:ue-mobility-{ui,params,trail-viz}` | logic-only-string (17/34/30 `includes()` asserts each) | weak | `scripts/validate-phase-g-ue-mobility-ui.tsx` (17 string-asserts, 3 ssr). Three more "phase-g COMPLETE" surfaces uncounted. |
| **Multi-UE positions / per-UE SINR / per-UE handover / count-slider / distribution-mode / per-UE diagnostics** | `validate:phase-f:*` (6 validators) | mixed (engine-backed math + SSR/string wiring) | weak/solid | `package.json:126-131`. The entire Phase-F multi-UE family — the live-lane's core 100-UE story — is absent from the report. |
| **Serving/pending beam-floor** | `validate:beam-floor` | live-engine (real `HandoverManager`) | solid | `scripts/validate-serving-pending-beam-floor.ts:3` imports real engine. Uncounted. |
| **Recent-HO UI (phase1a)** | `validate:phase1a:recent-ho-ui` | pure-unit + SSR (real `HandoverManager` → `renderToStaticMarkup`) | solid | `scripts/validate-phase1a-recent-ho-ui.tsx:1-4`. Uncounted. |
| **Forced role-state visuals (phase2d)** | `validate:phase2d:forced-role-state-visuals` | — | unknown | `package.json:13`. Not classified. |
| **Frequency-reuse / beam-layout vendor chain** (phase3b/4b/5a/5b/5c, phase5d browser) | `validate:modqn:phase{3b..5d}` | mixed (real `src/core` compute + `.mjs` browser for 5d) | solid | `package.json:78-83`. The report's cross-cutting "Phase6 vendor parity" row collapses 6d/f/h/j/k/o/v but **omits the entire phase3b-5d frequency-reuse vendor lineage**, which is also real-numeric. |
| **Training-scene source-gaps + trace contract/inventory/producer-handoff** | `validate:modqn:training-scene-*` (6 validators incl. a browser one) | logic-only-string + 1 browser | weak | `package.json:145-150`. A whole contract family uncounted; `…source-gaps:browser` is the only training-scene browser gate and isn't classified. |
| **User-trained bundle fetch / user-trained mode** | `validate:phase-d:user-trained-{bundle-fetch,mode}` | route-mock/SSR | weak | `package.json:46-47`. The "train-your-own then replay" user flow is entirely unclassified. |
| **localStorage migration / D6/D8 forbidden-claim / SNR-surface audit (p1c/p1e family)** | `validate:modqn:visual-showcase:p1e:*` | logic-only-string | solid (contract) | `package.json:105-112`. The honesty/forbidden-claim contract suite is uncounted. |

The report's denominator should be roughly **85-90 surfaces**, not 71. The omissions skew *optimistic-for-coverage* in one direction (it drops ~3 real engine surfaces) but the bigger distortion is that the live/multi-UE lane (Phase-F/G) — the lane the report calls "trustworthy" — is under-sampled, so its "trustworthy" verdict rests on fewer rows than implied.

## Over-Optimistic Ratings

I re-read the backing scripts. These rows are rated more favorably than the evidence supports:

1. **Director intra-HO cinematic (intra-focus, FSM, 0.05× tier, camera tween)** — rated **solid + realData=yes** (4 rows). The ONLY backing is `validate-phase-c-director-cinematic-browser.ts`, which **LOUD-SKIPs exit-0** when `data-artifact-source` is any of `synthetic-fixture-fallback | header-absent | external-artifact-path` (`:72-84`). The real artifact (`visual-showcase-v1-baseline-89s/visual-showcase-v1.json`, 46 MB) is **uncommitted** — present today (`Jun 3 22:55`) but in neither leo nor producer git. So this gate **green-passes on a fresh checkout without ever asserting anything**. "solid" is wrong for a gate that cannot fail when its subject is absent; it should be **weak / real-today-fragile** at best. Same applies to the **FIX-5 satellite compass** (`validate-phase-c-artifact-satellite-compass-browser.ts:76-84`, identical skip) — the report already softened it to weak, but it shares the director's fatal property and the director rows did not get the same haircut. *Inconsistency: same skip mechanism, two different severities.*

2. **Phase6 channel/beam vendor parity vs ntn-sim-core** — rated **solid, "strongest evidence in cross-cutting lane,"** "real numeric compute compare." Half-true. `validate-modqn-phase6o-channel-adapter-parity.ts` does import real `src/core/channel/index.ts` (`computeLinkBudget`, `computeSinr`, `:5-6`), but the *expected* side is a committed `scripts/fixtures/modqn-phase6o-channel-adapter-parity.json` (`:195`) with explicit `fixture-literal` range/off-axis sources (`:54,:67`). It is a **leo-internal compute-vs-frozen-fixture** check, not a live recompute against `ntn-sim-core`'s authoritative `baseline-kpi-*.json`. Genuinely strong as a self-regression lock, but "compare to ntn-sim-core" overclaims an external oracle — the **same flaw the report correctly flagged for phase6p**, left uncorrected for phase6o. Should be **solid-self-regression, not solid-vendor-parity**.

3. **Phase6p "KPI baseline"** — the report rated it weak and flagged the overclaim, which is correct, BUT the realData column shows it as not-real "live-engine vs committed self-snapshot." Confirmed: `validate-modqn-phase6p-hobs-sinr-kpi-baseline.ts:217,674` deep-equals its own `scripts/fixtures/...json` (`schemaVersion phase6p-...-v1`). 0 refs to `ntn-sim-core/baseline-kpi`. Rating is fair; flagging here only to confirm the report's one *correct* call on this pattern, which makes the phase6o omission (#2) a real inconsistency.

4. **vc3a hex-paint** rated **solid live-engine yes** — this one I confirm is *correct* (`validate-vc3a-hex-paint.tsx:5,94-101,305` real chromium + real canvas pixel deltaE). Listed here only to note the report's live-engine calls are NOT uniformly inflated — the inflation is concentrated in the artifact-replay/director rows that depend on the uncommitted file.

## Confirmed Fake-Risks

I independently confirm all four fake-risk items, plus the report under-counts by one:

1. **Phase-3 contention glow (S3) + 3D beam-load cylinder (S4)** — CONFIRMED genuine. `validate-phase-3-overlays.ts:28,55,73-84` is pure `readFileSync` + `mainScene.includes('<BeamLoadCylinder')` / `.includes('<BeamLoadUploadParticles')`. Zero runtime, zero render, zero real beam-load. A typo-free refactor that *broke* the render would still pass as long as the JSX string survives. Both rows fake-risk = correct.

2. **artifact-replay dashboard/flowchart "browser-verified"** — CONFIRMED. `validate-phase-d-dashboard-browser.ts:47-49` calls `loadValidatorVisualShowcaseArtifact()` and `page.route(ARTIFACT_ROUTE, … JSON.stringify(artifact))`, with the file's own docstring admitting it "does not depend on the pinned producer artifact" (`:8-10`). The 8-node/8-edge/≥8-chip/pulse asserts (`:123-129`) all run on the synthetic fixture. The standing CI gate can be green forever on fabricated data. fake-risk = correct.

3. **Live-telemetry browser gate feeds a reward shape the producer doesn't emit** — CONFIRMED and sharper than the report stated. `validate-phase-d-live-telemetry-browser.ts:49-56` lists `live-telemetry-reward-curve` in `EXPECTED_SOURCE_GAP_TILES` with the inline comment "G-A producer gate, **not yet wired**." So the gate doesn't just feed a non-producer reward shape — it *asserts the curve is a source-gap*, i.e. it bakes in the absence of real reward data as the passing condition. 100% route-mock (`:40-41,67`). fake-risk = correct.

4. **MODQN decision overlay / handover-story layer** — the report rated this weak (logic-only-string); I'd argue it belongs alongside the S3/S4 fake-risks. `validate-modqn-handover-story-layer.ts:73,77,81` is `readFileSync` + `source.includes`/`!source.includes` only — a user-facing overlay whose "it paints" claim has *no* render proof, same risk profile as the phase-3 overlays. Borderline, but the report's own bar (source-string mount = fake-risk for S3/S4) should classify this consistently.

**Under-count:** the **404 / fail-closed render path** is rated `unknown`, which is right, but it should be escalated — it's a *user-facing degraded state* (`App.tsx:1948-1956`) with literally **zero** exercising test. My grep for `fail-closed`/`404` across `scripts/` and `src/` found only validators that *mention* the token in comments/console-filters, none that serve a 404 and assert the honest-empty div renders without synthetic leak. For a render-truth campaign whose entire premise is "don't silently show fake/empty data as real," an untested fail-closed path is closer to fake-risk than unknown.

## Final Note

The audit is **directionally trustworthy but not complete, and slightly inconsistent** — it needs one more pass. Its core thesis (live lanes real, artifact-replay lane is "wired and type-safe, not proven on real data," 4+ surfaces verified only on fabricated data) is independently confirmed against the actual scripts. But three things undercut its precision: (a) it **omits ~15 surfaces**, including the entire Phase-F/G multi-UE live lane it leans on for its "trustworthy" verdict and 2-3 genuinely real-data engine gates; (b) it applies its own severity bar **inconsistently** — the director intra-HO rows keep "solid" despite sharing the exact LOUD-SKIP-on-missing-uncommitted-artifact mechanism it (correctly) used to downgrade the FIX-5 compass, and phase6o gets "solid vendor parity" despite the same self-fixture overclaim it flagged on phase6p; and (c) every "solid+realData=yes" rating on the artifact-replay/director side hangs on a single **uncommitted 46 MB file that exists today but is in no git** — so the report's realData=21 count is "21 *if the file survives*," and a fresh clone would silently drop those to green-skips. Recommend a second pass that re-counts with the missed surfaces, normalizes director severity to match the compass, and reframes the artifact-dependent realData rows as "real-today-fragile" pending the artifact being committed or the LOUD-SKIPs converted to fail-on-absent.

---

## Tier-A Fixes Applied (2026-06-04, in-env)

User chose "全部 in-env 修". Closed the audit's in-env gaps with REAL verification
(DATA SOURCE stated per gate). All on the dev server serving the producer-pinned
89s artifact.

| Gap (audit rank) | Fix | DATA SOURCE / result |
|---|---|---|
| #6 durability | `REQUIRE_PRODUCER_ARTIFACT=1` turns the director + compass + scene + dashboard real-data gates' LOUD-SKIP into hard FAIL; new `validate:real-data` aggregate runs them in that mode | aggregate PASS on real producer-pinned (green now means really verified, not green-skip) |
| #1 dashboard real | `validate:phase-d:dashboard:real-data:browser` — no route-mock, hits real producer artifact, asserts 8 nodes/8 edges/8 chips + pulse on REAL handover events | real-producer PASS |
| #5 100-UE scene | new `data-rendered-ue-count` canvas telemetry + `validate:phase-c:artifact-scene:real-data:browser` | real-producer PASS (`data-rendered-ue-count=100`, not fail-closed, no badge) |
| #9 fail-closed | `validate:phase-c:artifact-fail-closed:browser` (route-mock-404) asserts the honest empty div renders, lane stays artifact-replay, no canvas/synthetic leak | route-mock-404 PASS ("HTTP error 404") |
| #8 Phase-H rich render | `validate:phase-h:sinr-live-render:browser` drives the REAL live SINR engine, asserts satellites + beam cones actually render | live-engine PASS (12 sats / 2 cones) |
| #7 episode regex | `parseEpisodeProgress` now matches the producer `[ep N/M]` / `[modqn ep N/M]` / `[v2-ep N/M]` format (was `episode N/M` only), case-sensitive guard kept | unit 36/0 (producer-format cases added) |
| #10 phase6o/p overclaim | honest docstring on both: SELF-REGRESSION vs a committed leo fixture, NOT the ntn-sim-core baseline-kpi oracle | docstring relabel (no compute change) |
| FIX-1 badge | `decideArtifactSourceBadge` unit test (silent for producer-pinned/null, loud + source-aware for synthetic/header-absent/unknown) | pure-unit 6/0 |

## Discovered while fixing (NEW findings — surfaced, not papered over)

1. **Phase-3 contention glow input is EMPTY in the live modqn-cell lane.** The new
   `data-beam-load-contention-ue-count` telemetry reads **0** while the same lane's
   service map shows ~75 served UEs. Root cause: the contention glow derives from
   `sim.perUePositions` (MainScene), but that array is empty in this lane, whereas
   the service map derives from `sceneFrame.ues` (75 served). So the phase-3
   contention glow (audit #2 fake-risk) likely does NOT render at all in the live
   lane — upgraded from "unverified" to "evidence of non-functional." A real-render
   gate was built, REVEALED this, and was REMOVED (it could not pass honestly; the
   telemetry observable is kept). Needs investigation: wire the glow to the working
   per-UE source or fix `sim.perUePositions` population (a truth-ownership decision,
   not a quick edit). The phase-3 3D cylinder (S4) additionally needs the
   explain-handover preset + a focused UE with load.

2. **`validate:modqn:phase6p-hobs-sinr-kpi-baseline` was RED — RESOLVED 2026-06-04 (stale snapshot re-captured).**
   It failed with "baselines drifted from scripts/fixtures/modqn-phase6p-...json" at
   HEAD `fdf4337` too (NOT caused by the docstring relabel). **Diagnosed:** the fixture
   was last committed at `5d3079d`, BEFORE a batch of deliberate model-evolution commits
   (`677f7f3` PR-IS7a realistic constellation P=384 + serving cap + K=28 hopping,
   `b763520` UE spread, Phase F/G per-UE SINR/handover/mobility, plus the ω-handover +
   training-policy tuning-key expansion — the stored `handoverPolicyKey` carries 8 params,
   the current compute 22). The SINR distribution drifted only slightly and sanely (mean
   -1.45 → -1.03 dB, no -Infinity / degenerate collapse), `recentHoLatchTimeline` went
   from empty to populated (a feature added after) — i.e. a **STALE self-regression
   snapshot**, NOT a compute regression. **Fix (legitimate, cause understood):** re-captured
   via the validator's `--capture` flag; re-running `--capture` a second time produced a
   byte-identical fixture → the compute is DETERMINISTIC (the `timeSec` field is sim-derived,
   not wallclock), so it will not drift again. Validator now PASS. This is a self-snapshot
   refresh of leo's OWN current compute, NOT the ntn-sim-core baseline-kpi oracle (per the
   S3 docstring relabel), and NOT masking a bug (the drift cause is the documented feature work).

## Still NOT closed (correctly out of in-env scope)

- **#2 phase-3 contention render** — blocked by discovered finding #1 (needs a
  truth-ownership investigation of the empty `sim.perUePositions`), not a gate.
- **#3 live-telemetry real SSE** — needs the server (P3b Tier-2 E2E). HEAVY → Ubuntu.
- **#4 inter-HO cinematic** — needs a producer artifact with a satellite handover
  (the 89s baseline has 0). Structural; no in-env fix.
