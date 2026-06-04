# Showcase Render-Truth Fix Backlog

Driven by `docs/showcase-render-truth-audit-2026-06-03.md` (the read-only audit).
Work items, sequenced. Each is a focused slice; follow the proven loop
(impl → main-thread re-verify → codex review --base main → fix → ff-merge → push).
**New rule for THIS backlog: every "verified" claim must state the DATA SOURCE
(real producer / fixture / route-mock). No more "browser-verified" without it.**

State at backlog creation: leo-beam-sim HEAD `4d9be1a`; audit was read-only, no
code changed. Untracked: this file + the audit doc + the flowchart SDD.

---

## Sequenced items

- [x] **FIX-1 — Make the synthetic-fixture fallback LOUD** · non-heavy · in-environment · **DONE `b9964af` (2026-06-03)**
  - App now reads `X-Showcase-Artifact-Source` on the replay fetch into state;
    `console.warn` + `data-artifact-source` shell attribute + a visible
    `ArtifactSourceBadge` banner fire for any non-producer source. Display-only
    (reads a transport header, never SINR/handover/MODQN/reward/geometry truth).
  - A completed 200 with NO header (static/preview server, route mock) maps to a
    distinct `HEADER_ABSENT_SOURCE` sentinel (not the loading `null`) so it still
    trips the badge — caught by codex review (would otherwise be silently
    bypassed). Warn copy is source-aware: only the synthetic fixture is called
    "synthetic"; header-absent / unknown is reported as unverified, never
    overclaimed.
  - **Emitter fix (codex-caught):** `vite.config.ts` no longer hardcodes
    `synthetic-fixture-fallback` on the loader fallback path — it derives the
    header from the loader's resolved source, so an env-provided real artifact
    (`VISUAL_SHOWCASE_ARTIFACT_PATH`) stamps `external-artifact-path`, not fake.
    Only the canonical pinned path earns `producer-pinned` (§3: an unvalidated
    external artifact must not silently pass as proof).
  - **Verified (DATA SOURCE explicit):** tsc 0; governance/app-wire 41-0/
    banner-copy 25-0 green; playwright smoke on the **synthetic-fixture-fallback**
    dev path + a **route-mocked header-absent** 200 (badge+warn+attr, no live-lane
    leak); curl on the emitter (default→synthetic; env real artifact→external,
    5.9MB/200). `producer-pinned` no-badge path is logic-verified
    (`decideArtifactSourceBadge` + emitter ternary) — **no real producer artifact
    on disk yet (FIX-2)**, so it was NOT browser-verified on real data. codex
    review 4 rounds → CLEAN (3 real P2s fixed, round-4 no findings).

- [x] **FIX-2 — Regenerate producer `visual-showcase-v1.json`** · **NON-HEAVY (in-environment, ~60s)** · **DONE `555ba6a` (2026-06-03)**
  - **STEP 0 verdict (reversed the "likely HEAVY" guess):** the CLI `modqn-visual-showcase --bundle <dir> --output <json>` is a pure JSON transform (no training). BUT the on-disk baseline run is a **10s episode** (`run_metadata: episode_duration_s=10, slot_duration_s=1`) and `visual_showcase_exporter.py:82` hard-requires a deterministic **60-120s window** → a plain re-export from the existing 10s bundle is `BLOCK_WITH_GAPS`.
  - **Cheap path that works (user-picked "investigate extended-replay"):** `modqn-export --input <baseline-run> --output-dir <bundle> --replay-slot-count 90` (40s, env keeps stepping past the 10s training horizon on the continuous orbital sim → 89s bundle) → `modqn-visual-showcase --bundle <bundle> --output visual-showcase-v1.json --modqn-commit <40hex> --ntn-sim-core-commit <40hex> --artifact-id visual-showcase-v1-baseline-89s-2026-06-03` (20s, 46MB). **ntn-sim-core `validate:visual-showcase:artifact` = OK** (commits MUST be full 40-hex or it fails `PROVENANCE_COMMIT_FORMAT`).
  - **Artifact path (persistent, clean-named):** `modqn-paper-reproduction/artifacts/visual-showcase-v1-baseline-89s-2026-06-03/{bundle/,visual-showcase-v1.json}` (lives on producer disk, NOT committed to leo; regenerate with the two commands above if wiped).
  - **leo change = ONE line:** `vite.config.ts` pins the new path; `fs.stat` first-branch finds it → serves `producer-pinned` → FIX-1 badge correctly disappears. Loader `PINNED_VISUAL_SHOWCASE_ARTIFACT_PATH`/`SHA256` left unchanged on purpose (static-frame validator's frozen trigger concept; the regen carries env RNG, not byte-pinned).
  - **Verified (DATA SOURCE = REAL producer artifact — FIRST real-data check):** tsc 0; scene-lane-governance green; curl emitter → `producer-pinned` (46MB); playwright real-data smoke = **NO honesty badge** (FIX-1 no-badge path now real-data verified, was logic-only), shell `data-artifact-source=producer-pinned`, no warn, artifact-loaded, scene not fail-closed, real scenario "Phase 01H Baseline MODQN Multi-UE Replay"; **screenshot eyes-on = real 100-UE ground distribution + populated dashboard/flowchart dock** (the audit's "one orange dot meaningless" is gone). codex review CLEAN.
  - **⚠️ Producer-contract caveat (surfaced, not resolved):** slots 11-90 are an OOD extrapolation of a policy trained on 10s episodes — deterministic + real geometry, and the producer exporter treats a 60-120s greedy replay as valid `evidenceStatus=baseline`, but it is replay past the training horizon. leo only displays the status faithfully.
  - **➡ FIX-6 follow-ups found:** real artifact has top-level `claimBoundary: undefined` (synthetic fixture had one) → `ClaimBoundaryBanner` takes its graceful fallback path; satellites still off-frame (C2) + no beams in artifact lane (C3) = FIX-5 design calls; the real artifact is intra/inter-HO content not yet eyes-on verified for Director cinematic (FIX-4).

- [ ] **FIX-3 — Decide the demo's PRIMARY lane** · decision (user) · non-heavy
  - If `modqn-live-cell-preview` (real bundle on disk, cells + 100 UEs) is the
    centerpiece, artifact-replay emptiness is lower priority. If artifact-replay
    is the showcase, FIX-2 is mandatory. Drives the rest of the sequence.
  - **Update (post-FIX-2):** the forcing function is gone — artifact-replay now
    carries REAL producer data (89s, 4 sats / 100 UEs), so BOTH lanes are viable
    showcases. This is now a pure preference call, not a "fix the empty lane" call.

- [x] **FIX-4 — Durable Director/cinematic browser validator** · non-heavy · in-environment · **DONE `4a8e284` (2026-06-03)**
  - New `scripts/validate-phase-c-director-cinematic-browser.ts` +
    `validate:phase-c:director-cinematic:browser`. Runs against the dev server,
    reads the FIX-1 `data-artifact-source` honesty attr + a content invariant
    (duration ∈ 60-120s + baseline-MODQN scenario) so it certifies ONLY the real
    89s producer artifact; LOUD-SKIPs (exit 0) on an explicit known non-producer
    source; FAILS on artifact load failure (never green-passes while the lane is
    broken). Hard asserts on intra-focus: FSM leaves idle, effective speed → 0.05×,
    camera world position actually changes (focus tween), Exit restores idle + speed.
    Soft: D3 dim-fade transient. Added shell telemetry `data-director-phase` +
    `data-effective-speed` (governance-locked, Rule#9).
  - **Verified on REAL data:** PASS — before idle/1×/cam(0,400,500) → intra-focus
    acquiring/0.05×/cam moved/fade observed → exit idle/1×. codex 3 rounds CLEAN
    (P2 silent-skip-on-load-failure, P3 waitForFunction arg-slot, P2 content-invariant
    all fixed). **Inter-HO NOT testable here: the 89s baseline artifact has 0 inter
    events (82 intra only) — honest gap, the inter button stays correctly disabled.**

- [x] **FIX-5 (design) — artifact-replay scene richness + camera framing** · investigation DONE 2026-06-03; **Option C BUILT + merged `7707715` (2026-06-04), codex 2-round CLEAN**
  - **✅ Option C DONE (`7707715`):** leo-only honest satellite-azimuth HUD compass.
    `src/ui/artifactSatelliteAzimuths.ts` = pure `deriveSatelliteAzimuths` (bearing
    `atan2(x,z)` + ring radius `hypot(x,z)` + data-driven `hasElevationData` +
    `isFlatEciProxy` gate), unit-tested 8/8. `src/ui/ArtifactSatelliteCompass.tsx` =
    2D SVG compass-rose DOM HUD (NOT a 3D viewport layer — no three/Canvas/scene
    runtime import), lane-owned (`App.tsx` mounts once gated
    `sceneLane==='artifact-replay'`, fed `replaySceneFrame.satellites`),
    `pointer-events:none`, fixed honesty caption "Satellites — orbital azimuth only
    (ECI proxy, no elevation/Earth-rotation)". Display-only (reads projected
    `worldPos`, never alters truth). `scene-lane-governance` + governance doc lock the
    caption + no-3D property + lane-gated single mount + the proxy gate.
    `validate:phase-c:artifact-satellite-compass:browser` real-data gate added.
  - **codex P2 (proxy-only gate) fixed:** the azimuth-only / "no elevation" caption is
    truthful ONLY for the flattened ECI proxy. The compass now renders ONLY when
    `isFlatEciProxy` (every surfaced sat is `coordFrameKind==='eci-km-no-earth-rotation-proxy'`
    with no elevation). A real `ecef-km` artifact (3D draws real overhead geometry),
    a mixed/unknown frame, or the FIX-1 synthetic fixture (carries elevation) gets NO
    compass — so it never overclaims a missing limitation in the opposite direction.
  - **Verified (DATA SOURCE = REAL producer-pinned 89s artifact):** tsc 0; unit 8/8;
    `scene-lane-governance` green; real-data browser smoke = 4 sats sat-0..3 at azimuths
    `[89.9, 359.9, 269.8, 179.8]°`, ring gaps all ~90° (the real flat ring),
    `data-has-elevation=false`, `data-frame-kind=eci-km-no-earth-rotation-proxy`, honesty
    caption exact, NO leak on the live SINR lane; screenshot eyes-on = clean glass
    compass top-right of the viewport with N/E/S/W rose + 4 satellite bearings + caption.
    director-cinematic browser smoke still PASS (no mount regression). codex review
    2 rounds → CLEAN (P2 proxy-gate fixed round 1, round 2 no findings).

  *(historical investigation preserved below)*

- [~] **FIX-5 (historical investigation log)**
  - **C2 root cause is NOT camera angle (investigation, read-only):** the artifact's
    4 satellites are placed by the producer's `eci-km-no-earth-rotation-proxy` at
    a FLAT ring on the ground plane (Y=0) at radius ~7151 world units (sat-0=+X,
    sat-1=+Z, sat-2=−X, sat-3=−Z, slowly rotating). `MainScene` artifact path
    renders `<SatelliteMarker position={Vector3(...satellite.worldPos)}/>` with NO
    display scale, so sats sit 7151 units out while UEs are within ~150 → off-frame
    laterally. Radius 7151 ≈ Earth radius 6371 + ~780 km = the REAL LEO orbital
    radius; the azimuths are REAL; only inclination/elevation is missing (flattened
    to the equatorial plane). **All sat Y = 0 — the proxy has NO overhead dimension.**
  - **Why sinr-live has no problem:** it self-generates sat geometry via SceneGeometry
    + a `visualSatelliteAltitude` display scale (`satPosScaleFactor = visualSatelliteAltitude/400`,
    `useBeamViz.ts:124`) placing sats overhead at a controlled visual altitude. The
    artifact lane CONSUMES the producer proxy that discarded elevation.
  - **Option A (producer Earth-fixed projection) = BLOCKED, principled source-gap.**
    The MODQN source has `startEpochIso` (1) but NO `earthRotationModel` / `eciToEcefEpochIso`
    → the producer's `visual_showcase_source_gap.py` (`:81,:271,:373`) DELIBERATELY
    refuses to fake ECEF without source-owned earth-rotation inputs ("Do not convert
    ECI to ECEF without source-owned conversion inputs") — the SAME render-truth ethos
    leo enforces. Honest overhead geometry would need the upstream MODQN sim to add an
    earth-rotation model (far upstream, out of visual-showcase scope).
  - **Option B (leo re-place sats overhead) = OUT** — the proxy has no elevation, so
    leo would FABRICATE the Y dimension = geometry-truth violation (§3 / Rule#6), the
    exact thing this campaign protects against. Camera change = OUT (ring 7151 vs UE 150).
  - **DECISION = Option C (user-picked): a leo-only HONEST satellite direction / orbital
    context indicator.** Use the REAL azimuths (the ring is azimuthally truthful) to
    surface where the satellites are — e.g. an orbital-ring minimap or edge/compass
    azimuth markers + an honest "satellites at orbital distance (ECI proxy, no
    elevation)" label — WITHOUT fabricating overhead elevation. Display-only overlay,
    governance-safe (no geometry change, no lane-ownership change). Build it next.
  - **C3 (beams/cells in artifact lane) = governance LANE-MATRIX LOCKED** — the
    frontend-render-governance lane matrix forbids artifact-replay from mounting live
    cell/beam layers. NOT a free design call; would need a governance change + ADR-001
    update. Out of scope for FIX-5 unless explicitly reopened.

  - **C build spec (technical anchors so the new session skips re-investigation):**
    - **Sat data at runtime:** `showcaseArtifactToSceneInterpolated(showcaseArtifact, currentTimeSec).satellites[]`
      (already computed in `App.tsx` as `replaySceneFrame`, and in the artifact `MainScene`
      path as `visibleSatellites`). Each entry: `{ id: 'sat-0'..'sat-3', worldPos: [x, 0, z],
      displayRole: 'context', visible, geo: {latDeg, lonDeg} }`. **All `worldPos[1]` (Y) = 0.**
      Azimuth (compass bearing on the ground plane) = `Math.atan2(x, z)` → 4 sats ~90° apart,
      rotating slowly over the 89s (sat-0 starts +X, sat-1 +Z, sat-2 −X, sat-3 −Z). Ring
      radius `Math.hypot(x, z)` ≈ 7151 (constant per sat). `geo.latDeg/lonDeg` are also present
      if a lat/lon readout is preferred over XZ azimuth.
    - **Mount (governance-lightest):** a **2D DOM HUD overlay** (compass rose / small orbital
      minimap) — NOT a new 3D viewport layer (a 3D in-scene ring would be a new viewport proof
      layer → Rule#9 matrix+validator change). A DOM HUD that presents lane state is a shared/HUD
      surface (frontend-render-governance "Shared Surfaces"). Mount on the artifact-replay
      `leo-shell-canvas` `<main>` (App.tsx ~1873) gated to `sceneLane==='artifact-replay'`, fed the
      sat azimuths from `replaySceneFrame`/`showcaseArtifact`. New component e.g.
      `src/ui/ArtifactSatelliteCompass.tsx` with a pure `deriveSatelliteAzimuths(satellites)` helper
      (unit-testable) + a `data-testid` for the browser smoke.
    - **Honesty (the whole point):** render only the REAL azimuths; do NOT synthesize elevation.
      Include an explicit label like "Satellites — orbital azimuth only (ECI proxy, no
      elevation/Earth-rotation)". This is display-only (reads sat worldPos, never alters geometry
      truth) and must stay governance-clean (no lane-ownership change; add a scene-lane-governance
      assertion locking the honesty label + the no-3D-viewport-layer property).
    - **Verify:** tsc + governance + a **real-data** browser smoke (dev server serving the
      `producer-pinned` 89s artifact) asserting the compass shows 4 azimuth markers matching the
      real ring (DATA SOURCE = real producer artifact, explicit) → codex review → ff → push.

- [~] **FIX-6 — Re-verify the "COMPLETE" surfaces on REAL data** · mixed · **artifact-replay lane DONE (2026-06-03); 3 residual items logged below**
  - ✅ **artifact-replay 3D scene on real data:** FIX-2 smoke + screenshot = real
    100-UE ground distribution, scene not fail-closed (`555ba6a`).
  - ✅ **dashboard + flowchart on real data:** real-data smoke = `data-artifact-source=producer-pinned`,
    dock mode=artifact, dashboard artifact-loaded, 8 flowchart nodes / 8 edges,
    8 provenance chips (real artifact provenance), and the **flowchart edge pulse
    fires on the REAL 82 intra-HO events** (rAF pulse), no console errors. (Scene
    viewport occasionally shows a transient "Loading…" while the 46MB artifact's
    terrain/textures stream — render-state timing, not a data-truth issue; the
    100-UE frame renders per the FIX-2 capture. Demo-load polish → note for FIX-5.)
  - ✅ **director cinematic on real data:** FIX-4 gate (intra-focus, real artifact).
  - **Residual gaps (logged, not silently dropped):**
    1. **Inter-HO cinematic** — the 89s baseline artifact has **0 inter-HO events**
       (82 intra only) → not testable on this artifact; the inter button stays
       correctly disabled. Needs an artifact/run that produces a satellite handover.
    2. **Phase-3 overlays on real beam-load** — phase-3 (contention glow / 3D
       cylinder / particles) lives on the `modqn-live-cell-preview` LIVE lane
       (real bundle, audit D1 = HEALTHY), NOT artifact-replay. A live-lane eyes-on
       on the real bundle would replace its "synthetic/forecast" verification note.
       In-env, lower priority (live lane already marked healthy).
    3. **P3b Tier-2 server E2E** (pre-existing): real training run → dock
       MiniRewardCurve fills live. HEAVY → Ubuntu server; push producer `4c03665`
       (now part of producer HEAD `302ed53`) to origin first.

---


- [~] **FIX-7 — Verification-provenance audit + Tier-A in-env hardening** · 2026-06-04 · **audit DONE + Tier-A DONE; 2 new findings + 2 deferred**
  - Full read-only multi-agent provenance audit (`docs/showcase-verification-provenance-audit-2026-06-04.md`):
    71 surfaces classified, ~21 real-data/live-engine, 4-6 fake-risk. Live lanes trustworthy;
    artifact-replay lane "wired + type-safe", several "browser-verified" labels ran on
    synthetic-fixture / route-mock. Root cause of the whole FIX campaign = fixture/mock verification,
    not broken features.
  - **Tier-A in-env fixes APPLIED + verified on REAL data** (see audit doc table): durability
    (`REQUIRE_PRODUCER_ARTIFACT=1` LOUD-SKIP→FAIL + `validate:real-data` aggregate), dashboard
    real-data gate, 100-UE scene real-data gate (`data-rendered-ue-count` telemetry), fail-closed
    404 gate, Phase-H sinr-live render gate (live-engine), episode regex (producer `[ep N/M]`),
    phase6o/p honest relabel, badge unit test. All green (real-producer / live-engine / route-mock-404,
    DATA SOURCE stated per gate).
  - **NEW findings (surfaced, not papered over):** (1) phase-3 contention glow input `sim.perUePositions`
    is EMPTY in the live modqn-cell lane (`data-beam-load-contention-ue-count=0` vs serviceMap served=75
    from `sceneFrame.ues`) → glow likely non-functional; the real-render gate REVEALED it then was REMOVED
    (couldn't pass honestly); telemetry kept; needs a truth-ownership investigation, not a quick edit.
    (2) **RESOLVED `7493289`:** `validate:modqn:phase6p-hobs-sinr-kpi-baseline` was RED (pre-existing
    drift). Diagnosed = STALE snapshot (fixture from `5d3079d`, before PR-IS7a P=384 geometry +
    UE spread + Phase F/G + ω-handover tuning-key expansion); SINR drift sane (mean -1.45→-1.03 dB,
    no collapse), NOT a regression. Re-captured via `--capture`; deterministic (re-capture byte-identical,
    `timeSec` sim-derived), validator now PASS. Self-snapshot refresh of leo's own compute, not the
    ntn-sim-core oracle, not masking a bug.
  - **REMAINING in-env = 1 (new conversation):** finding (1) phase-3 contention glow — truth-ownership
    investigation of the empty `sim.perUePositions` (wire glow to `sceneFrame.ues` vs fix population),
    then a real-render gate via the kept `data-beam-load-contention-ue-count` telemetry.
  - **Deferred (out of in-env scope):** #3 live-telemetry server E2E (HEAVY→Ubuntu, push producer
    `302ed53`), #4 inter-HO cinematic (needs an artifact with a satellite handover). Plus the
    audit's ~29 "weak" surfaces = verification-strength preference, not bugs (live lanes healthy).
  - **✅ FINDING #1 RESOLVED 2026-06-04 (C1 truth-ownership fix).** Empirically diagnosed via live
    browser probe: on the modqn-demo cell lane the live HandoverManager acquires NO per-UE serving
    — even the primary `sim.serving.satId` is `""` (4-sat + decision-overlay profile behaviour;
    sinr-live's 1-UE lane DOES acquire serving, so not a global crash). So the prior two candidate
    fixes are BOTH dead: (a) `sceneFrame.ues` serving ≡ the same empty `sim` serving via
    `liveSimToScene` → still 0; (b) "fix `perUePositions` population" = altering rigor-critical /
    vendor-governed HandoverManager truth for a display need = §2/Rule#6 forbidden. There is no
    producer per-UE serving on this LIVE lane (that lives only on the replay `allUeServingHistory`
    source-gap). **User picked C1:** wire the contention to the SAME profile-derived cell-schedule
    per-UE (satId, beamIndex) assignment `deriveModqnServiceMap` already uses to colour the markers
    and emit the `ueCountByCellId` UE-count badges — the lane's authoritative *displayed* serving.
    `source:'profile-derived-demo'` / `claimKind:'overlay-demo'`, **NOT** producer r3 (the glow adds
    no claim the cell overlay does not already make). `cellScheduler.usedBeamKeys` makes each
    (satId,beamIndex) 1:1 with a display cell, so the codex-S2 cell-splitting concern does not arise.
    **DATA SOURCE proven:** `validate:phase-3:contention-render:browser` (new) drives the real live
    modqn-cell engine and asserts `data-beam-load-contention-ue-count > 0` (was 0; now ≈70-88 =
    served, ≤ served). Governance validator locks the C1 source + forbids regression to the empty
    `sim.perUePositions`. New `validate:live-render` aggregate = sinr-live-render + contention-render.
    Verified: tsc 0 / governance pass / phase-3 aggregate 17-0 / both live gates PASS / codex review
    GATE PASS ([P2] = new validator untracked-in-diff, resolved by committing it) / 4-lens adversarial
    workflow all `refuted:false` (HONESTY nit on the replay-branch docstring fixed → marked the
    `allUeServingHistory` r3 path as a not-yet-wired source gap). Authority: governance doc
    "Completed Follow-Ups" + `src/scene/beamLoadContention.ts` header.
  - **✅ AUDIT GAP #2 LAST FAKE-RISK CLOSED 2026-06-04 (`4df2ed7`).** The phase-3 S4 3D
    cylinder + S5 upload particles + the MODQN handover-story layer were source-string mounts
    only. New `validate:phase-3:overlay-render:browser` drives the live modqn-cell lane, switches
    to the explain-handover preset (ControlBar control), and asserts all three actually paint via
    MESH-DERIVED telemetry — `BeamLoadCylinder` publishes its post-toggle `mesh.visible`,
    `BeamLoadUploadParticles` the summed visible-`mesh.count`, `HandoverStoryLayer` traverses its
    own subtree for the visible ring/cue mesh count. Codex flagged a model/plan-derived observable
    TWICE (could pass while the mesh is visually broken) → reworked to mesh-derived → codex CLEAN.
    Added to `validate:live-render`; governance locks the three component writes. Verified
    cylinder=true / particles=128 / storyMeshes=65, 3× stable. (Audit gap #7 episode regex confirmed
    already matching producer `[ep N/M]` via Tier-A; phase6o overclaim already relabeled honestly.)
  - **Durability (audit gap #6) — Option A chosen 2026-06-04 (NOT a code change):** do NOT commit the
    45MB producer `visual-showcase-v1` artifact into leo — it is a producer-owned §3 immutable replay
    input; vendoring a binary copy (git-LFS) crosses cross-repo ownership and is not a free call. The
    durability guard is `validate:real-data` with `REQUIRE_PRODUCER_ARTIFACT=1` (LOUD-SKIP → hard FAIL
    on absent) = the CI-enforced real gate. Standalone real-data gates keep LOUD-SKIP as dev
    convenience; **their fresh-checkout green is NOT proof — CI must run `validate:real-data` (artifact
    present) for the artifact-replay lane to count as verified**, and `validate:live-render` (live-
    engine, no artifact) is always runnable. Recorded decision, not an open gap.
  - **🎯 FIX-7 in-env FULLY CLOSED** (findings #1+#2, audit gaps #1-#2,#5-#10 all closed in-env;
    gap #6 durability = recorded Option A). **Remaining = out-of-in-env only:** #3 live-telemetry
    server E2E (HEAVY→Ubuntu, push producer `302ed53` first) + #4 inter-HO cinematic. **#4
    INVESTIGATED + RESOLVED-AS-CONCLUSION-B 2026-06-04 (in-env export probe, NOT a leo code change):
    this baseline can NEVER yield an exportable inter-HO artifact at any epoch/offset — needs different
    producer data. Full evidence in the "#4 inter-HO — RESOLVED" section below.** ~20 unranked weak
    source-string surfaces = verification-strength preference (user chose to stop; audit never ranked
    them as problems).

## #4 inter-HO cinematic — RESOLVED-AS-CONCLUSION-B (in-env export probe, 2026-06-04)

**Verdict: this baseline (`baseline-modqn-pilot02-rerun-2026-05-15`, the source of the 89s artifact)
can NEVER produce an *exportable* inter-HO `visual-showcase-v1` artifact at ANY epoch / start-offset.
Inter-satellite handover physically EXISTS in the orbital dynamics, but it is a HARD handover across a
~592 s coverage gap, which (a) needs a ~1064 s-from-t=0 replay to reach (≫ the 120 s exporter cap) and
(b) is intrinsically preceded by gap rows with empty `candidateSinrDbByBeamId` / `sinrDb` / `actionScores`
that make the producer exporter `BLOCK_WITH_GAPS` on every window that contains the handover. No
overlapping-visibility (make-before-break) handover exists. → #4 needs DIFFERENT producer data (denser
constellation with overlapping coverage, or a different scenario / longer training horizon) = a
producer/training change, NOT an in-env export-knob change. No longer an in-env open item.**

This is the FIX-2-class hypothesis ("maybe it's a cheap ~60 s in-env re-export, not a server job")
genuinely tested and **falsified by evidence**, not by guess.

### Evidence (three independent, agreeing lines)

The only `modqn-export` knobs are `--replay-start-time-s` (orbital reset time) and `--replay-slot-count`
(window length, slot = 1 s); there are NO constellation / min-elevation / scenario knobs (`--help`
confirmed). The 60–120 s window cap is in `visual_showcase_exporter.py:82` (the visual-showcase JSON
step). `modqn-export` (the bundle step) is uncapped, so the orbital dynamics can be probed cheaply with
one long bundle.

1. **Geometry (analytic).** The artifact's 4 satellites sit on a SINGLE polar orbit plane, evenly spaced
   90° apart in true anomaly (sat-0 over the ground point (0,0); sat-1 N pole; sat-2 antipode; sat-3 S
   pole). Measured mean motion = 0.05929 °/s → period 6072 s (101.2 min). At radius 7151 km (alt 780 km)
   the elev-0° horizon half-angle is `arccos(6371/7151)=27.0°`, so each satellite is above the horizon for
   only `2·27/0.05929 = 911 s`, while a satellite passes overhead only every `6072/4 = 1518 s`. **Gap
   between consecutive visibility windows = 1518−911 = 607 s** → no two satellites are EVER visible at
   once. (Even at the most generous elev=0° threshold; a realistic min-elevation only widens the gap.)

2. **Empirical orbital sweep** (`modqn-export --replay-slot-count 1600`, start=0, one bundle, ~3.5 min):
   - **MAX simultaneously-visible satellites across all 1600 slots = 1** (never 2) — confirms (1).
   - All 100 UEs are served by **sat-0 only** for t=1–462 s, then a **coverage gap t≈463–1054 s** where
     `visibilityMask` is all-False (no satellite visible) yet UEs stay STALE-attached to the now-set sat-0
     (`selectedServing.satId='sat-0'`, but `candidateSnrDbByBeamId` EMPTY — all 60 686 gap rows empty).
   - Then sat-3 rises (~t=1055 s) and **all 100 UEs emit a real `inter-satellite-handover` event
     (sat-0 → sat-3) at slots 1056–1071** (u0 at slot 1064). So inter-HO is real — but ~1064 s out and
     gap-gated.

3. **Empirical export attempts** (the decisive test — `modqn-export` → `modqn-visual-showcase`):
   - `start=1010 count=90` (window t=1011–1100, contains all 100 sat-0→sat-3 inter events): 5177/9000
     rows empty-candidate → exporter **BLOCKED**, no JSON.
   - `start=1054 count=62` (t=1055–1116, 100 inter events, tightest that still catches the full handover):
     777 empty rows → **BLOCKED** (2531 source-gap lines).
   - `start=1064 count=62` (t=1065–1126, 40 inter events): even just 82 empty-candidate rows → **BLOCKED**
     (326 source-gap lines).
   - Why unavoidable: the pre-handover `previousServing='sat-0'` rows are exactly the coverage-gap rows
     where sat-0 is below the horizon and has no channel → empty `candidateSinrDbByBeamId`/`sinrDb`/
     `actionScores` → `_validate_required_sources` source-gap. Any window containing the handover contains
     those rows. A window with NO gap rows (entirely inside sat-3's clean service) has 0 inter (just another
     intra-only window like the existing baseline).

Scratch probe logs kept at `/home/u24/interho-probe/` (`analysis_out.txt`, `*-vsc.log`; heavy bundles
deleted). Reproduce: `modqn-export --input artifacts/baseline-modqn-pilot02-rerun-2026-05-15/run
--replay-start-time-s 1054 --replay-slot-count 62 --output-dir <dir>` then `modqn-visual-showcase --bundle
<dir> ...` → BLOCK on empty candidate SINR. No leo code, no `vite.config.ts` change, no governance touch
(read-only producer-side investigation).

### What WOULD unblock #4 (out of in-env scope, for a future producer/server session)

A `visual-showcase-v1` artifact that carries ≥1 inter-satellite handover with **overlapping (make-before-
break) coverage** so the departing satellite still has a real channel (non-empty candidate SINR) through
the switch — i.e. a denser / multi-plane constellation, a wider beam footprint (higher altitude), or a
scenario with shorter inter-satellite spacing. That is a producer training/scenario change in
`modqn-paper-reproduction` (NOT a leo or export-flag change), then re-pin in `vite.config.ts` and run
`validate:phase-c:director-cinematic:browser` clicking the **inter** button (it will then be enabled). The
FIX-4 director gate + the disabled inter button on the current 89s artifact remain correct as-is.

---

#3 (live-telemetry server E2E) is the only other out-of-in-env remainder — server work (8765 short job +
dashboard eyes-on `MiniRewardCurve`; push producer `302ed53` first) — unrelated to this #4 investigation.


## Resume prompt for a fresh conversation (FIX-5 C2 → build option C)

> 延續 leo-beam-sim render-truth FIX campaign。FIX-1/2/3/4 + FIX-6-artifact-lane
> 全部 DONE。先讀 `docs/showcase-render-truth-fix-backlog.md`（尤其 FIX-5 entry =
> 完整 C2 診斷 + Option C 決定）+ `.agent-memory/MEMORY.md`（行尾 FIX-5 block）。
> 確認 git sync（HEAD 應 `d4d5721` 或更新）。
> 任務 = 建 **FIX-5 Option C：leo-only 誠實衛星方位 / 軌道 context 指示器**。
> 已診斷：artifact 4 顆衛星是 producer ECI-no-earth-rotation proxy 壓平到 Y=0、
> 半徑 7151 的環（方位真、仰角無）；A（producer 投影）被 principled source-gap
> 卡死（無 earthRotationModel）；B（leo 擺頭頂）= 捏造幾何禁止。C = 用真方位畫
> 指示器（orbital-ring minimap / 邊緣 compass 方位標 + 誠實 label），display-only
> overlay，不動 geometry/lane-ownership。proven loop：impl → tsc + governance +
> 真資料 browser smoke（dev server serve `producer-pinned` 89s artifact）→ codex
> review --base main → CLEAN → ff → push。真資料 DATA SOURCE 必明寫。繁中對話。
>
> 剩餘 residual（非 C2，需 server/不同資料）：FIX-6(1) inter-HO（89s artifact 0
> inter）、FIX-6(2) phase-3 live-lane eyes-on（in-env 低優先）、FIX-6(3) P3b
> Tier-2 server E2E（HEAVY→Ubuntu，先 push producer `302ed53` 到 origin）。
> C3（beams/cells in artifact lane）= governance lane-matrix LOCKED，需 ADR，不碰。

## Original resume prompt (FIX-1, historical)

> Continue the leo-beam-sim render-truth FIX campaign. Read first:
> `docs/showcase-render-truth-audit-2026-06-03.md`,
> `docs/showcase-render-truth-fix-backlog.md`, and `.agent-memory/MEMORY.md`
> (the RENDER-TRUTH AUDIT block). Confirm git sync (HEAD should be `4d9be1a`).
> Then start FIX-1 (loud synthetic fallback). 繁中對話.
