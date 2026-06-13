# Handoff — G3 dense-Q complete; showcase roadmap done; next = optional new phase

> Authored 2026-06-13 (controller=Opus). Read this + `docs/sdd-index.md` +
> `.agent-memory/project_showcase_render_modqn_plan_2026-06-10.md` (2026-06-13 entries)
> to pick up. Repo: `leo-beam-sim`. Branch `feat/showcase-phase-0` (pushed, HEAD `65d1c08`).

## TL;DR — the planned showcase is COMPLETE

- **`docs/sdd-index.md` D1–D7 = all `complete`** (2026-06-09/10).
- **`docs/modqn-showcase-requirements-todo.md` = 53/53 `[x]`, 0 unchecked** (A–J).
- **G3 (this session) closed the last producer-data gap**: D5/D6 were "consumer dense-Q
  proof ready but blocked until the producer exports a complete non-degenerate sample".
  G3 delivered + wired the producer **Family-B Grade-2 dense-Q window** as a NEW selectable
  replay mode, so DecisionViz now actually renders proof-ready **Q1/Q2/Q3** (was source-gap
  on the degenerate baseline). Browser smoke: `sat-98-beam-28: Q1 0.572 · Q2 0.968 · Q3 2.156`,
  self-check passed, honest non-degenerate banner.
- Commits `3f39b12` (model + `phase7e` gate) · `6cddbd9` (UI selector + banner) · `dc3cd1c`
  (adversarial-review hardening) · `f3121c7` (replay-scene dual-axis fix) · `ec17099`/`65d1c08`
  (docs). All gates green except a PRE-EXISTING red (see below). Adversarial Workflow review:
  0 confirmed blockers/majors.

**There is NO active written-but-unimplemented SDD backlog.** The `*-draft` docs
(`director-cinematic-replay-sdd.md`, `sinr-live-earth-fixed-cells-mini-sdd.md`,
`phase-{b..g}-*-mini-sdd.md`, `modqn-demo-*`) are DEFERRED / background / superseded — the
index says only its listed docs define the next sequence. Anything further is a NEW phase.

## The one genuine loose end (PRODUCER-side, non-blocking) — dispatch-ready brief

leo currently runs the Family-B mode fine via a **mode-scoped tolerance** in
`src/modqn/replay-bundle/loader.ts` (family-b path tolerates a missing `bundleSchemaVersion`
in `provenance-map.json`; manifest's copy stays authoritative + strict; a present-but-wrong
version is still rejected — pinned by a `phase7e` reject test). The durable fix is producer-side:

> **PRODUCER WORKER BRIEF — fix the dense-q-window provenance-map.**
> The dense-q-**window** export shipped a 251-byte STUB `provenance-map.json` (only a
> `timeline.stepTrace.policyDiagnostics` annotation; **no `bundleSchemaVersion`, no `fields`**).
> The Grade-1 standard export AND the baseline both carry the full 63-field map via
> `build_provenance_map(cfg, metadata)` (`src/modqn_paper_reproduction/bundle/provenance.py`,
> called at `export/replay_bundle.py:369`).
> **Fix:** the window-export path (server-side; produced
> `artifacts/family-b-baseline-retrain-2026-06-12/seed-42/dense-q-proof-window-600-130/`) must
> emit `provenance-map.json` with at least `bundleSchemaVersion: "phase-03a-replay-bundle-v1"`
> and ideally the full `build_provenance_map` field map (Family-B-aware cfg/metadata). Re-export
> + re-scp to `/home/u24/papers/modqn-paper-reproduction/artifacts/dense-q-proof-window-600-130/`.
> **Verify:** `provenance-map.json` has the correct `bundleSchemaVersion`; ntn-sim-core
> `validate:visual-showcase:artifact` still OK; leo `validate:modqn:phase7e-dense-q-proof-replay-state`
> stays green. **Then** the leo mode-scoped tolerance in `loader.ts` can be removed (or kept as defense).
> NOTE: a LOCAL `build_provenance_map` regen is INFEASIBLE — the Family-B run uses a different
> cfg/metadata schema (`envConfig/evalSeed/gridIndex/...`; run_metadata = `claim_ceiling/protocol_stamp/...`)
> than `build_provenance_map` consumes (`cfg.{paper,baseline,resolved_assumptions}`), so forcing it
> would fabricate empty fields. The fix needs the producer's Family-B-aware export pipeline.

## Optional future phases (none pending — a fresh decision each)

| Phase | What the frontend would gain | Gate |
|---|---|---|
| Director-cinematic v2 (`director-cinematic-replay-sdd.md`) | cinematic handover camera (fade mask, seek-to-event, pre-position); retires QUAR-C1-DIRECTOR / QUAR-C2-TIMELINE quarantines | deferred — needs go |
| Phase 3 Queue & Traffic | richer backlog-pressure visuals | future — needs a slice SDD first |
| Phase 4 Multi-Catfish + 3D | multi-challenger 3D extrusion | 🔒 GATED — needs a frozen ntn-validated multi-catfish `visual-showcase-v1` bundle (does not exist; producer is mid-retrain/collapse) |

## Pointers + gotchas for whoever picks this up

- **DUAL-AXIS (the core G3 fact):** Family-B rows carry `beamStates`=physical render-beams
  (144; beamIndex 9..49 = per-sat physical, only 37 unique) DECOUPLED from the action catalog
  A=`totalBeamCount`=28 (masks + `policyDiagnostics.{candidateActionOrder,objectiveQByAction,
  scalarizedQByAction}`). `selectedServing.beamIndex` is the CATALOG index (==`selectedActionIndex`),
  NOT the physical index. Any new consumer of the family-b envelope must resolve physical→catalog
  by `beamId` (see the `f3121c7` scene-visuals fix for the pattern).
- **Family-B mode** = `MODQN_FAMILY_B_DENSE_Q_*` in `replay-bundle/replay-state.ts`; reachable on
  the non-parked `modqn-live-cell-preview` lane's "MODQN evidence" right tab (NOT the parked
  Proof lane). Gate: `validate:modqn:phase7e-dense-q-proof-replay-state` (real bundle 1000/1000 +
  fail-closed reject tests). Bundle staged at `/tmp/leo-beam-sim/modqn-bundles/dense-q-proof-window-600-130`
  (symlink → producer artifacts).
- **🔴 PRE-EXISTING red (NOT G3, out of scope):** `validate:modqn:phase7k` fails on a `../engine`
  `EARTH_KM_PER_DEG` import in `modqnReplaySceneVisuals.ts` (S1 refactor `02424aa`; master-SDD
  Phase-2-deferred). Not in `validate:governance` nor the G3 gate set.
- **Disclosed minors (acceptable):** `bundleProvenanceKind='user-trained'` for Family-B is a
  chip-text misnomer but the SAFE direction (never implies paper-faithful); `ModqnEvidenceTab`
  shows the producer manifest's reused `baselineSurface` 4/7/28 (catalog dims) verbatim.
- **Scratch (untracked, repo convention):** `scripts/_smoke-family-b-dense-q-browser.ts` =
  the G3 Playwright smoke (`APP_URL=http://localhost:3000 node --import tsx/esm <it>`); screenshots
  in `output/g3-family-b-dense-q/`. Promote to a committed browser validator if a durable G3
  render gate is wanted (the model-level gate `phase7e` is already committed).
- **Discipline (binding):** governance-locked `src/modqn/replay-bundle/` core = controller writes +
  Workflow subagent boundary/adversarial review — **NOT codex** (no-memory re-breaks locks). Fail-closed
  asserts: allowlist, never delete. After render/UI changes: screenshot the live `:3000`/`:3001` dev
  server, don't only trust validators. DegenerateDataBanner stays honest for Family-B (Grade-2
  constrained, NOT degenerate).
