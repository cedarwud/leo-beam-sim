# G3 Step 3 — Family-B dense-Q replay mode (wiring plan)

> **Status: EXECUTED 2026-06-13** (Steps 3 + 4 done; commits `3f39b12` model +
> `6cddbd9` UI + `dc3cd1c` review-hardening on `feat/showcase-phase-0`, pushed).
> DecisionViz renders `data-dense-q-proof-status="proof-ready"` + Q1/Q2/Q3 for the
> Family-B window (browser smoke: `sat-98-beam-28: Q1 0.572 · Q2 0.968 · Q3 2.156`,
> self-check passed, honest non-degenerate banner). New gate
> `validate:modqn:phase7e-dense-q-proof-replay-state` = 1000/1000 proof-ready +
> fail-closed reject tests. Adversarial Workflow review: 0 confirmed blockers/majors.
> **See "Execution findings + follow-ups (2026-06-13)" at the bottom** for the
> producer provenance-map gap, the latent replay-scene trap, and disclosed minors.

> Status (original): PLANNED (recon done, not implemented). Pick this up in a fresh session.
> Authority for context: `.agent-memory/project_showcase_render_modqn_plan_2026-06-10.md`
> (the 2026-06-13 section). Recon workflow output (full ~488KB map):
> `wf_7092bde0-e08` task output. The dense-Q **adapter** bug is already FIXED +
> committed (`11abe27`); this doc is ONLY the bundle-wiring slice that follows.

## START HERE (cold-start checklist — do in order)
0. Read `.agent-memory/project_showcase_render_modqn_plan_2026-06-10.md` (the
   2026-06-13 section) + the rest of THIS doc. Context discipline: leo governance
   core = controller + Workflow review, **NOT codex** (no-memory re-breaks locks).
1. Confirm clean baseline: `git log --oneline -2` shows `93c1a17` + `11abe27`;
   run `npm run lint && npm run validate:modqn:dense-q-proof-adapter && npm run
   validate:modqn:replay-handover-cinema-gate && npm run validate:governance` — all
   green BEFORE touching anything.
2. Stage the bundle: `ln -s /home/u24/papers/modqn-paper-reproduction/artifacts/dense-q-proof-window-600-130 /tmp/leo-beam-sim/modqn-bundles/dense-q-proof-window-600-130`
   (mkdir -p the parent first). Confirm the 3 surfaces resolve (manifest.json,
   provenance-map.json, timeline/step-trace.jsonl).
3. Implement file-by-file per "File-by-file edit plan" below — controller writes the
   governance-locked core (replay-state.ts mode + dual-axis validator,
   playback-shell.ts, DegenerateDataBanner); fan-out the bounded NEW-file pieces
   (validate:phase7e script, App.tsx mode-selector) to Workflow subagents fed THIS
   doc, then review + integrate.
4. After each file group, run the matching gate. NEVER skip a fail-closed assert
   (see "Fail-closed assert TRAPS") — allowlist, don't delete.
5. Final: new `validate:modqn:phase7e` green + `validate:governance` green + browser
   smoke (DecisionViz `data-dense-q-proof-status="proof-ready"`, Q1/Q2/Q3 visible).
   Then run an adversarial Workflow review (correctness/governance/honesty) before
   commit. Commit per slice; push.
6. Honesty gate: DegenerateDataBanner must NOT call Family-B "degenerate" (it is
   Grade-2 non-degenerate but thin: 2 serving sats / 2 unique actions / 125 HOs).

## Goal
Make leo's MODQN replay lane load the producer Grade-2 dense-Q bundle as a NEW
selectable mode so DecisionViz renders Q1/Q2/Q3 (the G3 "prove MODQN integrated"
payoff). User decision (2026-06-13): **A — new dedicated Family-B mode**, do NOT
overwrite the baseline identity.

## Inputs (already done)
- Producer Grade-2 bundle on disk:
  `/home/u24/papers/modqn-paper-reproduction/artifacts/dense-q-proof-window-600-130/`
  (manifest.json + provenance-map.json + timeline/step-trace.jsonl 164MB +
  visual-showcase-v1.json 26.7MB). ntn-sim-core `validate:visual-showcase:artifact`
  = OK. Branch `feat/dense-q-export` PR#2, commit `abb0ba5`.
- leo dense-Q adapter fix `11abe27` (action-order sourced from the catalog) — the
  proof returns **1000/1000 proof-ready** once the envelope loads this bundle.

## THE KEY FINDING — the bundle is DUAL-AXIS (why this is real work, not a label)
Per-row shape (verified):

| array | length | axis |
|---|---|---|
| `beamStates` | **144** | PHYSICAL render-beams (4 sats; 144 unique `beamId`, only 37 unique `beamIndex`) |
| `visibilityMask` / `actionValidityMask` / `decisionVisibilityMask` / `decisionActionValidityMask` | **28** | action catalog (A) |
| `beamLoads` / `beamThroughputs` | **28** | action catalog |
| `policyDiagnostics.{candidateActionOrder,objectiveQByAction,scalarizedQByAction}` | **28** | action catalog |
| `satelliteStates` | 4 | — |
| manifest `baselineSurface` | `{satelliteCount:4, beamCountPerSatellite:7, totalBeamCount:28}` | declares the **catalog** (28), NOT the 144 physical |

leo's replay model assumed `beamStates` IS the action catalog (single axis). BOTH
shape validators hard-require `beamStates.length === totalBeamCount`:
- `validateEvidenceCapableBundleShape` (baseline) `replay-state.ts:358` (also pins
  sourcePath===SELECTED, 28-beam, event counts 82/0/918).
- `validateUserTrainedBundleShape` (flexible) `replay-state.ts:442` — fails at
  `:466` (beamStates len), `:475` (unique beamId count===totalBeamCount), `:477`
  (unique beamIndex count===totalBeamCount).

So **riding user-trained does NOT work**; Family-B needs its OWN dual-axis shape
validator. This is the same physical-vs-catalog conflation as the original adapter
bug, now at the bundle-shape level.

## New dual-axis shape validator spec (`validateFamilyBDenseQBundleShape`)
Per row, assert:
- `satelliteStates.length === satelliteCount` (4).
- catalog-axis arrays (`visibilityMask`, `actionValidityMask`,
  `decisionVisibilityMask`, `decisionActionValidityMask`, `beamLoads`,
  `beamThroughputs`) length `=== totalBeamCount` (28).
- `policyDiagnostics.{candidateActionOrder,objectiveQByAction,scalarizedQByAction}`
  length `=== totalBeamCount` (28). (This is what unlocks the dense-Q proof.)
- `beamStates.length >= totalBeamCount`, with UNIQUE `beamId` (144 unique) — do
  NOT assert unique `beamIndex` (only 37 unique; beamIndex repeats across sats).
  The physical count (144) is not in the manifest; either accept `>= totalBeamCount`
  + uniqueness, OR add a manifest field `physicalBeamCount` (decide at impl).
- `previousServing` / `selectedServing` reference a beam in `beamStates` (physical,
  144) — reuse `assertReferenceMatchesBeamCatalog` against the beamStates map.
- 1000 rows, 10 slots (or leave row/slot flexible — see risk below).
- Event counts: flexible, sum to rowCount (125 HOs — NOT baseline 82/0/918).

## File-by-file edit plan (~6-8 files, ~20 points — all governance-locked)
1. `src/modqn/replay-bundle/replay-state.ts`
   - New consts after :49: `MODQN_FAMILY_B_DENSE_Q_MODE_KEY` (`'modqn-family-b-dense-q'`),
     `_MODE_LABEL` (`'MODQN Family-B dense-Q proof'`), `_EVIDENCE_STATUS`
     (`'family-b-dense-q'`), `_BUNDLE_PATH` (`/tmp/leo-beam-sim/modqn-bundles/dense-q-proof-window-600-130`).
   - Extend `ModqnReplayEvidenceStatus` (:61), `ModqnReplayAdapterModeKey` (:66),
     `ModqnReplayAdapterModeLabel` (:71).
   - NEW `validateFamilyBDenseQBundleShape` (after `validateUserTrainedBundleShape` :482) — spec above.
   - `createModqnReplayBundleLoadPlan` (:715): add a branch for the new modeKey;
     **allowlist** the new path at the fail-closed asserts `:359` and `:757`
     (currently `sourcePath !== SELECTED → fail`).
   - `createClaimBoundary` (:484): 4th branch (`acceptedEvidenceShape:'family-b-dense-q-proof-window'`,
     `artifactStatus:'family-b-dense-q-window'`, allowedClaims = honest non-paper-faithful
     Grade-2 wording; keep shared forbiddenClaims).
   - `createIdentityMap` (:534): skip beam-layout bridges for the new evidence status
     (like user-trained — return empty bridges).
   - `createModqnReplayEnvelopeFromBundle` (:808/:818): call the new validator +
     map evidenceStatus → new modeKey/modeLabel.
   - `createDiagnostics` (:699): bridgeStatus `'skipped-family-b-dense-q-window'`.
   - `loadModqnReplayEnvelopeFromSurfaceReader` (:914): modeKey override for the new status.
2. `src/modqn/replay-bundle/playback-shell.ts`
   - Import the new consts; extend the validation-code union (~:110); add dispatcher
     branch (`:150` — else currently returns `'unexpected-mode'`); NEW
     `validateFamilyBDenseQPlaybackModel` (rowCount/slotCount + flexible event sum).
3. `vite.config.ts` — serve the new bundle over `/modqn-bundles/<basename>/...`:
   add a 2nd accepted basename (`:154` exact-match check) OR symlink + a 2nd FS path
   const. Skip `ensureModqnBundleExport` for it (producer already exported). NOTE the
   separate `/showcase-artifacts/visual-showcase-v1.json` middleware is a DIFFERENT
   consumer — leave it or repoint independently.
4. `src/App.tsx` — mode-selector state/UI; pass `modeKey` +
   `sourcePath` to `fetchModqnReplayBundleEnvelope`. Must NOT default-select Family-B.
5. `src/ui/DegenerateDataBanner.tsx` — **HONESTY**: Family-B is Grade-2-constrained
   (2 serving sats, 2 unique selected actions, 125 HOs) — NOT degenerate. Gate the
   banner on `evidenceStatus`/`modeKey`; Family-B needs its own honest disclosure,
   not the baseline "degenerate" text. (CLAUDE.md Rule#3 — governance review.)
6. NEW `scripts/validate-modqn-phase7e-dense-q-proof-replay-state.ts` (parallel to
   phase7c) — load the Family-B bundle from disk, assert envelope identity + dual-axis
   shape + dense-Q proof-ready over the rows.
7. Extend `scripts/validate-modqn-phase7d-replay-diagnostics.ts` for the new mode
   (Rule#9 atomic — gate + aggregate together).
8. Staging: `ln -s /home/u24/papers/modqn-paper-reproduction/artifacts/dense-q-proof-window-600-130 /tmp/leo-beam-sim/modqn-bundles/dense-q-proof-window-600-130`
   (or copy). Needed for both disk validators AND the dev-server fetch.

## Fail-closed assert TRAPS (allowlist, do NOT delete)
`replay-state.ts:359`, `:757` (sourcePath===SELECTED), `playback-shell.ts:150`
dispatcher else→`'unexpected-mode'`, `createClaimBoundary` 3-status ternary,
`MODQN_EXPECTED_EVENT_COUNTS` (baseline 82/0/918) — none must fire for the new mode.
Miss one and the demo fails-closed (source-gap) with no Q1/Q2/Q3.

## Validation sequence
`npm run lint` → new `validate:modqn:phase7e` → `validate:modqn:replay-handover-cinema-gate`
→ `validate:modqn:dense-q-proof-adapter` → `validate:governance` → un-park Proof
sub-view (parked by `408f488`; `ModqnViewToggle` Proof segment + `canToggleModqnReplayProof`)
→ browser smoke (DecisionViz `data-dense-q-proof-status="proof-ready"`, Q1/Q2/Q3 visible).

## Honesty notes
- Grade-2 = non-degenerate (125 HOs) but THIN (2 serving sats / 2 unique selected
  actions). Banner/labels must say "Grade-2 constrained, non-paper-faithful trained
  replay", never overclaim.
- This is the MODQN replay lane only; SINR-live showcase stays decoupled.

## Open questions for impl
- Physical beam count (144): accept `beamStates.length >= totalBeamCount` + beamId
  uniqueness, or add a manifest `physicalBeamCount` field? (simplest = the former.)
- Row/slot count: pin 1000/10 (matches this window) or leave flexible for future windows?
- Mode selector UI placement (ControlBar vs sidebar vs ModqnViewToggle).

## Execution findings + follow-ups (2026-06-13)

**How it was built (vs the plan):**
- Resolved the open questions: physical beam count → `beamStates.length > totalBeamCount`
  (STRICT, dual-axis) + unique beamId (NOT unique beamIndex); row/slot → flexible
  (`>= 1`); mode selector → a small load/back-to-baseline control in the MODQN
  evidence sidebar (co-located with DecisionViz).
- The serving-ref check could NOT reuse `assertReferenceMatchesBeamCatalog` (it asserts
  `beam.beamIndex === ref.beamIndex`, but the serving ref carries the CATALOG index
  while physical beamStates carry the physical index). Added
  `assertServingReferenceResolvesPhysicalBeam` (matches satId/satIndex/localBeamIndex,
  not beamIndex) + a dual-axis bridge (`selectedServing.beamIndex === selectedActionIndex`
  ∈ [0,A) and `candidateActionOrder[sel].beamId === selectedServing.beamId`).
- The **Proof-lane un-park was NOT needed**: DecisionViz is reachable on the non-parked
  `modqn-live-cell-preview` lane's "MODQN evidence" right tab (appRuntimeModel returns
  the modqn right tab there). So `ModqnViewToggle` / `canToggleModqnReplayProof` were
  left untouched.

**🔴 PRODUCER GAP (needs a durable producer-side fix):** the dense-q-**window** export
shipped a 251-byte STUB `provenance-map.json` (no `bundleSchemaVersion`, 0 fields). The
Grade-1 standard export + the baseline both carry the full 63-field map via the producer's
`build_provenance_map`. Root cause: the window-export path (server-side) did not call
`build_provenance_map`. leo's fix is a MODE-SCOPED tolerance in `loader.ts` (family-b only;
the manifest's `bundleSchemaVersion` stays authoritative + strictly checked; a PRESENT-but-
wrong version is still rejected — pinned by a phase7e reject test). **Durable fix = the
producer window-export should emit the full provenance map; re-export + re-scp.** (A local
`build_provenance_map` regen was rejected: the Family-B run uses a different cfg/metadata
schema than that function consumes → would fabricate empty fields.)

**🟡 LATENT (fix before un-parking the family-b 3D replay scene):**
`src/scene/modqnReplaySceneVisuals.ts` `decisionMaskValue(focusRow, beam.beamIndex)` keys
the 28-length catalog decision mask by the PHYSICAL `beam.beamIndex` (9..49). Under the
144/28 envelope this mis-resolves beam validity. It is OFF the shipped path (only the
PARKED `modqn-replay-proof` lane renders these beams; `shouldRenderModqnReplayScene`).
Fix when that lane is un-parked for family-b: resolve each physical beam to its catalog
index via `policyDiagnostics.candidateActionOrder` (by beamId) before reading the mask.

**🟢 DISCLOSED minors (acceptable as-is):**
- `bundleProvenanceKind='user-trained'` for Family-B drives a literally-inaccurate
  "user-trained" chip/disclaimer on ClaimBoundaryBanner / ModqnEvidenceTab. Kept because it
  is the SAFE direction (never implies paper-faithful/green; every string carries
  "do not cite" / "not PAP-2024 baseline proof"). A precise fix = extend the flag to a 3rd
  value (blast radius) or neutralize the Family-B chip wording.
- `ModqnEvidenceTab` surfaces the producer manifest's reused `baselineSurface`
  (satelliteCount 4 / beamsPerSat 7 / totalBeamCount 28) verbatim — these are the
  ACTION-CATALOG dims, not the real 180/9/1 + 144-physical Family-B scenario. Disclosed
  producer-manifest naming reuse; the banner already says "Grade-2 constrained".
- `phase7d` was not extended; `phase7e` subsumes the family-b diagnostics coverage.
