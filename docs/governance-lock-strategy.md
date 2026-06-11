# Governance Lock Strategy — Consolidation S0

**Date:** 2026-06-11. **Parent:** [frontend-consolidation-program.md](./frontend-consolidation-program.md) §3 S0.
**Code:** `scripts/governance-quarantine/tangle-locks.ts` (registry) +
`tangleLockGroup(...)` wrappers in `scripts/validate-frontend-scene-lane-governance.ts`.

## 1. Problem (audit §2, one disease)

The governance gate held ~630 string asserts. A large minority pin EXACT source
text of the files S1-S6/C1-C2 must rewrite — internal expressions, call shapes
with embedded newlines, JSX indentation, literal constants, even comment prose.
They froze the display↔truth tangle and forced duplication (the
`runtimeFrameStep.ts:66` "duplicated so the validator regex can match" class).
15 failed look iterations were selection-policy churn on top of divergent
truths; every fix attempt became validator surgery.

## 2. S0 split — quarantine, don't weaken

Every assert was classified (4-round audit + S0 census, all file:line cited):

- **PERMANENT (stays, ~470 asserts + all 136 behavioral):** behavioral matrix
  asserts that call real resolvers (`resolveSceneLaneRenderPlan`,
  `resolveTimelineRailDescriptor`, sidebar-tab model), lane mount/suppress
  rules, truth-boundary import bans (BLOCK-3 class), honesty/claim-kind/
  telemetry-observable locks, fail-closed gates, R3F dispose/no-setState
  discipline, docs/package sync.
- **QUARANTINED (~160 asserts in 35 wrapped blocks, 7 groups):** TANGLE-PIN
  locks wrapped in-place in `tangleLockGroup('<id>', ...)`. They still EXECUTE
  on every run — no silent regression window — but are scheduled for wholesale
  retirement:

| Group | Retires with | Replacement gates |
|---|---|---|
| QUAR-RENDER-RESET | sinr-live render reset (or S5) | un-parked render-plan matrix + cell-cone invariant |
| ~~QUAR-S3-STEP~~ **RETIRED 2026-06-11 (S3-3)** | S3 one step, one reset | ✅ replaced wholesale by `validate:s3:one-reset` (behavior + structural single-path + imported-constant VALUE asserts — kills the 15° literal triple-pin + the FROZEN text pin), alongside `validate:s3:pure-step` + `validate:s3:served-survives-wrap`. Registry entry + all 3 `tangleLockGroup` blocks deleted. |
| ~~QUAR-S4-SERVING~~ **RETIRED 2026-06-11 (S4-3)** | S4 one serving truth | ✅ 20 of 23 needles replaced by behaviour/VALUE asserts: `validate:s4:serving-equivalence` (cell truth == published records == mosaic == HUD == queue == cone data on the REAL exported projection + behavioural publisher-shape assert + antenna imported-constant VALUE asserts via `consistentPeakGainDbi` + factory wiring), alongside `validate:s4:pun-retired` (S4-2) + `validate:s4:cell-served-survives-wrap` (S4-1) and the EXTENDED `validate:phase-c:sinr-serving-mosaic:model`/`:browser` + `validate:phase-c:sinr-live-cells:model` behaviour gates. Per the S4-3 3-lens review: 2 MainScene render-WIRING needles (mosaic derivation lane gate + colour-oracle cell-truth selection) re-wrapped into QUAR-S5-BEAMRENDER (only S5's shared selection resolver replaces them behaviourally) and 1 net-new publisher call-edge pin joined QUAR-S6-BUS. Registry entry + all 5 blocks deleted; effective-steering assert + `profile.antenna` mutation ban stayed permanent. |
| QUAR-S5-BEAMRENDER | S5 one beam render | ONE pure selector under invariant tests, mesh-telemetry render gates, ONE style token module |
| QUAR-S6-BUS | S6 split runtime bus | typed render-plan gates, single control channel contract, lane-transition behavior test |
| QUAR-C1-DIRECTOR | C1 camera rework | content-aware framing behavior gates on S4 event geometry |
| QUAR-C2-TIMELINE | C2 single playhead | single-axis descriptor gates + rail==playhead equivalence |

- **DELETED (3):** pure comment-text pins (`useCellSchedule` doc-comment,
  MainScene "RENDER RESET" comment, contention provenance comment) — zero
  behavior content.

Conservation: 632 grep-lines before → 629 after (= −3 deletions; every other
assert still executes). The gate prints a per-group summary and FAILS if a
registered group stops executing (`assertAndSummarizeTangleLockGroups`).

## 3. Binding rules (every slice)

1. A group is deleted WHOLESALE by its retiring slice, in the SAME commit that
   lands its replacement behavior gates. Never retire without replacement.
2. Never patch a needle inside a group. If a needle breaks before its slice,
   the edit is premature — revert it or bring the slice forward.
3. New locks during the program must be BEHAVIOR locks (call the function,
   render the frame, read telemetry). A newly met tangle pin gets wrapped into
   its matching group, not duplicated.
4. The permanent gate file is append-only during the program.

## 4. The S0 behavior-invariant harness (replacement-gate infrastructure)

- **`validate:s0:connected-sat-has-beam`** — the program's named invariant
  ("every satellite the UI calls connected has a visible beam") as a TEST.
  Drives the real runtime (100 UEs, candidate-rich) + the real display pipeline
  (`liveSimToScene` → `useBeamViz` via the headless probe), evaluates
  `src/validation/connectedSatBeamInvariant.ts` per step. `must-hold`
  violations fail; the audit's documented defects are measured KNOWN-GAPs, each
  tagged with its retiring slice (first baseline run: cell-vs-steered dual
  oracle = 760 claim-steps unbeamed; population-beyond-display-cap = 1;
  primary serving sat ALWAYS beamed — the must-hold baseline). Positive
  control: deleting the primary beam from a captured frame must trip the gate.
- **`validate:s0:geometry-trace`** — paired truth(SimFrame)+display(VizFrame)
  golden trace (`fixtures/s0-geometry/candidate-rich-baseline.json`, 1e-6),
  d6 protocol: monotonic-clock patch, run-twice determinism, perturbation
  positive control. Truth-layer slices diff clean on `truth.*`; display-layer
  slices declare legitimate changes via `S0_TRACE_IGNORE` prefix paths and
  re-baseline in their own commit.
- Shared pieces: `src/validation/vizFrameProbe.tsx` (headless VizFrame capture,
  vc1d pattern), `src/validation/geometrySnapshot.ts` (serialize + tolerance
  diff with ignore-paths).

Known harness limits (documented, not hidden): single-frame probe resets
useBeamViz hysteresis refs (latch-dependent fields out of scope until a
persistent-root fixture is needed); the steered mount predicate is a REPLICA of
MainScene JSX until S5/S6 extract a shared resolver (the QUAR-S5 text locks pin
the JSX meanwhile, so the replica cannot silently diverge).
