# MODQN Baseline Phase 3A Beam Vendor Readiness

**Date:** 2026-05-12
**Target repo:** `/home/u24/papers/project/leo-beam-sim`
**Source repo:** `/home/u24/papers/ntn-sim-core`
**Source module under audit:** `/home/u24/papers/ntn-sim-core/src/core/beam/`
**Phase:** Phase 3A, docs-only readiness audit
**Readiness status:** `READY_FOR_PHASE3B_VENDORING`

Phase 3A did not vendor files, replace runtime behavior, add controls, edit
producer artifacts, or edit `ntn-sim-core`. This document records whether the
`ntn-sim-core` beam layout truth is safe to vendor later, the smallest safe
Phase 3B file set, the validation evidence to capture, and the local
`leo-beam-sim` conflicts that must be handled before any runtime switch.

## 1. Scope And Authority

Authority read for this audit:

1. `/home/u24/papers/AGENTS.md`
2. `/home/u24/papers/project/leo-beam-sim/AGENTS.md`
3. `/home/u24/papers/project/leo-beam-sim/docs/modqn-baseline-live-integration-mini-sdd.md`
4. `/home/u24/papers/project/leo-beam-sim/docs/modqn-baseline-phase1-evidence-lock.md`
5. `/home/u24/papers/project/leo-beam-sim/docs/modqn-baseline-phase2-identity-adapter.md`
6. `/home/u24/papers/ntn-showcase-stack/README.md`
7. `/home/u24/papers/ntn-showcase-stack/AGENTS.md`
8. `/home/u24/papers/ntn-showcase-stack/docs/repo-roles.md`
9. `/home/u24/papers/ntn-showcase-stack/docs/architecture.md`
10. `/home/u24/papers/ntn-showcase-stack/docs/decisions/ADR-002-leo-beam-sim-final-runtime-host.md`
11. `/home/u24/papers/ntn-sim-core/AGENTS.md`
12. `/home/u24/papers/ntn-sim-core/agent-governance.md`
13. `/home/u24/papers/ntn-sim-core/src/core/README.md`

The controlling boundary is unchanged: `leo-beam-sim` may host the final live
demo, but rigor-critical live simulation truth must come from validated
`ntn-sim-core/src/core` modules or explicit provenance artifacts. The accepted
MODQN baseline evidence path remains the regenerated producer-owned 7-beam
bundle recorded in Phase 1 and Phase 2.

## 2. Commands And Evidence

Required `leo-beam-sim` commands:

| Command | Result |
| --- | --- |
| `git status --short` | Dirty before this audit. Existing unrelated changes were present: `.gitignore`, `package.json`, `src/ui/SignalTuningPanel.tsx`, untracked `AGENTS.md`, `CLAUDE.md`, prior Phase docs, `scripts/validate-modqn-phase2-identity-adapter.ts`, and `src/modqn/`. Phase 3A did not revert or modify those. |
| `git diff --check` | Passed with no output before adding this document. |

Required source audit commands:

| Command | Result |
| --- | --- |
| `rg -n "react|three|@react-three|viz/|app/|window|document" /home/u24/papers/ntn-sim-core/src/core/beam` | One false-positive comment/word-fragment hit: `scheduler.ts` contains "reactive" in PF documentation. No React, Three.js, `@react-three`, `viz/`, `app/`, `window`, or `document` import/use was found in the beam directory by this command. |
| `rg -n "from |import " layout.ts types.ts index.ts` | `layout.ts` imports only `type { SatelliteBeamLayout, BeamDefinition } from './types'`; `types.ts` has no imports; `index.ts` re-exports `types`, `layout`, `selection`, `active-beam-manager`, and `scheduler`. Comment lines saying the files must not import React/Three were also matched. |

Bounded source-side validation:

| Command | Result |
| --- | --- |
| `npm run validate:core-purity` in `/home/u24/papers/ntn-sim-core` | Passed: `validate-core-purity (VAL-ARCH-001): OK`. |
| `npm run validate:multibeam-gating` in `/home/u24/papers/ntn-sim-core` | Passed. The script imports `generateHexagonalBeamLayout()` and passed active-beam determinism, serviceability gating, beam-hopping authored-order grouping, scheduler wiring, and bounded-steering checks. |

Additional lightweight behavior probe:

| Probe | Result |
| --- | --- |
| Imported `generateHexagonalBeamLayout()` through `node --import tsx -e` and generated 7, 19, and 37 beams for FRF 1, 3, and 7. | Counts and reuse groups were deterministic. Group distributions are recorded in Section 5. |

KPI evidence inspected:

| File | Relevance |
| --- | --- |
| `/home/u24/papers/ntn-sim-core/baseline-kpi-hobs-multibeam-baseline.json` | Relevant contextual frozen KPI for HOBS multibeam behavior. It does not directly assert the 7/19/37 layout geometry. |
| `/home/u24/papers/ntn-sim-core/baseline-kpi-bh-resource-baseline.json` | Relevant contextual frozen KPI for beam-hopping/resource behavior. It does not directly assert the 7/19/37 layout geometry. |
| `/home/u24/papers/ntn-sim-core/baseline-kpi-case9-access-baseline.json` | Access baseline KPI, useful only if Phase 3B expands beyond pure layout. |
| `/home/u24/papers/ntn-sim-core/baseline-kpi-real-trace-validation.json` | Real-trace validation KPI, not directly layout-specific. |

There is no dedicated package script found for "beam layout 7/19/37 invariant
validation" in `ntn-sim-core/package.json`. Phase 3B must therefore add a
destination-side invariant validator in `leo-beam-sim` and should treat the
source `validate:core-purity` plus `validate:multibeam-gating` pass as the
minimum source-side evidence for a layout-slice vendor PR.

## 3. Kill-Switch Purity Result

**Result:** clean for the layout vendoring slice.

`src/core/beam/layout.ts`:

1. imports only `type { SatelliteBeamLayout, BeamDefinition } from './types'`;
2. uses no React, Three.js, browser API, `viz/`, `app/`, or scene symbol;
3. contains the beam layout generator and local `assignReuseGroup()` helper.

`src/core/beam/types.ts`:

1. has no imports;
2. defines plain TypeScript interfaces only;
3. uses string beam IDs and ENU offset fields.

`src/core/beam/index.ts`:

1. has no React, Three.js, browser API, `viz/`, `app/`, or scene import;
2. re-exports more than the layout slice: `selection`, `active-beam-manager`,
   and `scheduler`.

The beam directory as a whole appears core-pure under the bounded checks, but
the smallest safe Phase 3B scope is the layout slice, not the full barrel
export. Vendoring `index.ts` unchanged would pull Phase 3B toward selection,
active-beam management, and scheduler behavior that are outside the requested
beam-layout truth port.

## 4. Exact Phase 3B Vendoring Candidate

Smallest safe source files to vendor in Phase 3B:

1. `/home/u24/papers/ntn-sim-core/src/core/beam/layout.ts`
2. `/home/u24/papers/ntn-sim-core/src/core/beam/types.ts`

These two files are sufficient for `generateHexagonalBeamLayout()` because
`layout.ts` depends only on `types.ts`.

Files not to vendor in the first Phase 3B layout slice:

1. `/home/u24/papers/ntn-sim-core/src/core/beam/index.ts` - do not copy
   unchanged unless Phase 3B intentionally vendors the whole beam module. It
   re-exports scheduler and selection surfaces outside the layout scope.
2. `/home/u24/papers/ntn-sim-core/src/core/beam/selection.ts` - beam selection
   and off-axis/gain behavior; depends on core profile and constants surfaces.
3. `/home/u24/papers/ntn-sim-core/src/core/beam/active-beam-manager.ts` -
   active-beam state mutation and round-robin behavior.
4. `/home/u24/papers/ntn-sim-core/src/core/beam/scheduler.ts` - beam-hopping
   strategy behavior and runtime scheduling.
5. `/home/u24/papers/ntn-sim-core/src/core/beam/frequency-reuse.ts` -
   co-channel interference helper. It is related to FRF semantics but is not a
   direct dependency of the layout generator.
6. `/home/u24/papers/ntn-sim-core/src/core/engine/*` - engine integration is
   not part of the layout slice.
7. `/home/u24/papers/ntn-sim-core/scripts/validate-multibeam-gating.ts` - use
   as source-side evidence, but do not copy wholesale in a layout-only Phase 3B
   because it pulls engine, profile, selection, scheduler, and active-beam
   behavior.

Fixtures/tests:

1. No colocated `src/core/beam/fixtures/` directory was found.
2. No dedicated beam layout test fixture was found.
3. Phase 3B should add a local `leo-beam-sim` validator for the vendored
   layout invariants instead of vendoring broad source-side scripts.

Recommended Phase 3B destination shape:

1. Add a local vendored core layout module, for example
   `src/core/beam/layout.ts` and `src/core/beam/types.ts`.
2. Add a narrow local export only for layout if needed. Do not import the
   source `index.ts` unchanged unless the PR scope is expanded and approved.
3. Add a validator script, for example
   `scripts/validate-modqn-phase3b-beam-layout.ts`.
4. Add a package script only in Phase 3B, for example
   `validate:modqn:phase3b-beam-layout`.

## 5. Behavior Contract

`generateHexagonalBeamLayout(config)` accepts:

1. `satId: string`
2. `numBeams: number`
3. `beamDiameterKm: number`
4. `altitudeKm: number`
5. `frf: number`

Validation and support:

1. `numBeams` must be `>= 1`.
2. `frf` must be `1`, `3`, or `7`.
3. The function supports `7`, `19`, and `37` because it generates concentric
   hex rings until `numBeams` is reached.
4. Full-ring cumulative counts are preserved when `numBeams` equals
   `1, 7, 19, 37, 61, ...`.
5. Arbitrary non-ring counts are also possible because the function truncates
   to exact `numBeams`; Phase 3B validators should explicitly gate the MODQN
   preset path to `7 / 19 / 37`.

Output shape:

1. Returns `SatelliteBeamLayout`.
2. `layout.satId` equals input `satId`.
3. `layout.beamDiameterKm` and `layout.altitudeKm` copy the input values.
4. `layout.beams` contains `BeamDefinition[]`.
5. Each `beamId` is `${satId}-b${index}` with zero-based `index`.
6. Each beam starts with `isActive: true`.
7. Coordinates are local ENU ground offsets in kilometers relative to the
   satellite sub-point: `offsetEastKm`, `offsetNorthKm`.
8. Spacing is `beamDiameterKm * sqrt(3) / 2`.

Frequency reuse groups:

1. FRF 1: all beams use group `0`.
2. FRF 3: group is `((q - r) % 3 + 3) % 3`.
3. FRF 7: group is `((2 * q + r) % 7 + 7) % 7`.
4. Groups are deterministic and tied to axial coordinates, not to the local
   `leo-beam-sim` numeric beam ID modulo rule.

Observed group distributions from the lightweight probe:

| Beam count | FRF | Reuse group distribution |
| --- | ---: | --- |
| 7 | 1 | `{0: 7}` |
| 19 | 1 | `{0: 19}` |
| 37 | 1 | `{0: 37}` |
| 7 | 3 | `{0: 1, 1: 3, 2: 3}` |
| 19 | 3 | `{0: 7, 1: 6, 2: 6}` |
| 37 | 3 | `{0: 13, 1: 12, 2: 12}` |
| 7 | 7 | `{0: 1, 1: 2, 2: 1, 5: 1, 6: 2}` |
| 19 | 7 | `{0: 3, 1: 2, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2}` |
| 37 | 7 | `{0: 3, 1: 5, 2: 5, 3: 7, 4: 7, 5: 5, 6: 5}` |

The 7-beam FRF 7 case does not use every group. That is acceptable for the
source formula, but Phase 3B UI labels and validators must not assume every
allowed group appears in every beam count.

## 6. Local Conflict Inventory

Phase 3B must account for these conflicts before any runtime switch.

### Current Layout Cap

`src/scene/beam-layout.ts` currently defines:

1. `MAX_BEAMS_PER_SATELLITE = 7`
2. `generateBeamOffsetsKm()` truncates to `Math.min(maxBeams, 7)`
3. `BeamOffsetKm.beamId` is numeric
4. IDs start at `1`
5. ring positions are generated by evenly spaced polar angle, not by the core
   axial hex walk

This is compatible with the accepted 7-beam baseline path, but it blocks true
19/37 beam layout truth.

### Identity Shape Conflict

Current identity surfaces do not match:

| Surface | Current shape |
| --- | --- |
| Phase 2 producer canonical beam ID | `sat-<satIndex>-beam-<localBeamIndex>` |
| Phase 2 producer indexes | 0-based global satellite-major / beam-minor and 0-based local beam index |
| `ntn-sim-core` layout beam ID | `${satId}-b${index}` with 0-based local `index` |
| Current `leo-beam-sim` scene beam ID | numeric, local, commonly 1-based |
| Current `leo-beam-sim` visual/global helpers | derived 1-based local/global numeric IDs in Phase 2 |

Phase 3B must not choose one of these implicitly. It needs an explicit adapter
map that preserves producer IDs, core IDs, scene IDs, local indexes, and any
1-based visual label separately.

### Numeric Beam ID Surface Area

The local runtime is broadly numeric-beam-ID based. The audit found numeric
`beamId` expectations in:

1. `src/engine/signal/types.ts`
2. `src/engine/signal/power-control.ts`
3. `src/engine/handover/types.ts`
4. `src/engine/handover/handover-manager.ts`
5. `src/scene/types.ts`
6. `src/scene/beam-scheduler.ts`
7. `src/scene/useSimulation.ts`
8. `src/scene/useBeamViz.ts`
9. `src/viz/SatelliteBeams.tsx`
10. `src/viz/EarthFixedCells.tsx`
11. `src/viz/SpineParticles.tsx`
12. `src/viz/ServingGroundRipple.tsx`
13. `src/utils/beamFrequency.ts`
14. `src/utils/formatSatelliteLabel.ts`
15. validation fixtures under `src/validation/`

Phase 3B should not globally change these types in the same PR as vendoring.
The safe first step is to keep the vendored layout isolated and validate the
mapping contract.

### Frequency Reuse Conflict

Local `src/utils/beamFrequency.ts` computes:

`frequencyIndex = (numericBeamId - 1) % frequencyReuse`

The core layout computes reuse groups from axial coordinates. These are not
equivalent in general. Phase 3B must ensure color labels, interference grouping,
and diagnostics use the vendored `reuseGroup` when the vendored layout is the
truth source. Until that integration exists, the local modulo label remains a
visual/local helper only.

### Profile And Scheduler Conflict

`src/profiles/types.ts` has:

1. `beams.perSatellite`
2. `beams.maxActivePerSat`
3. `beams.frequencyReuse`
4. `beamHopping.maxActiveBeamsPerSlot`
5. `beamHopping.frameLengthSlots`

Current checked profiles use `7` beams. There is no MODQN beam-count preset
discriminator or claim label for `7 / 19 / 37`. `src/scene/beam-scheduler.ts`
also uses numeric beam IDs, numeric sort order, and profile frame lengths.
Phase 3B must not expose `19 / 37` through profiles or scheduler behavior until
the identity and reuse-group mapping are validated.

### Visual Density Conflict

`RuntimeConfig.beamDensity` is a display-density control
(`event-only`, `event-plus-1`, `all`). It is not a truth-level beam-count
control. Phase 3B must not relabel visual density as a `7 / 19 / 37` runtime
parameter.

### Existing HOBS Runtime Context

Current local profiles and live scene code are HOBS/SINR oriented, not MODQN
baseline evidence. A future layout port must not imply that current HOBS
policy, SINR offset handover, or local scheduler behavior is MODQN-trained
baseline behavior.

## 7. Claim Boundary

This audit preserves the Phase 1 and Phase 2 claim boundary:

1. `7` beams remains the accepted regenerated baseline MODQN artifact path.
2. `19` and `37` beams are live sensitivity/demo extensions only.
3. Vendoring beam layout truth must not imply that `19` or `37` has trained
   baseline MODQN evidence.
4. The selected producer bundle remains immutable downstream input.
5. `leo-beam-sim` must not train MODQN or alter producer truth values.
6. Paper-faithful baseline SNR evidence must remain distinct from live
   SINR/interference computations.
7. No EE-MODQN, HEA-MODQN, Catfish, Multi-Catfish, Catfish-over-HEA, or
   energy-efficiency effectiveness claim is created by beam layout vendoring.

If a future 19/37 live demo reuses a 7-beam trained policy, projects it,
masks it, or falls back to a deterministic/heuristic selector, the UI and docs
must label that behavior as sensitivity/demo adapter behavior, not trained
baseline MODQN evidence.

## 8. Phase 3B Validation Plan

### Source-Side Validation Before Vendoring

Run in `/home/u24/papers/ntn-sim-core` immediately before copying files:

```bash
npm run validate:core-purity
npm run validate:multibeam-gating
```

Record:

1. command output;
2. source git commit or diff context;
3. source file paths copied;
4. relevant frozen KPI files inspected.

For a pure layout-slice PR, the currently relevant KPI files are contextual
rather than direct layout or 7/19/37 geometry baselines:

1. `baseline-kpi-hobs-multibeam-baseline.json`
2. `baseline-kpi-bh-resource-baseline.json`

If Phase 3B expands to scheduler, active-beam manager, selection, channel,
or engine integration, it must capture the matching frozen KPI evidence and
perform no-drift comparison. Do not adjust `baseline-kpi-*.json` to make a port
pass.

### Destination-Side Validator To Add

Add a `leo-beam-sim` validator after vendoring, for example:

```bash
npm run validate:modqn:phase3b-beam-layout
```

The script should import the local vendored layout module and assert the
invariants below for `7`, `19`, and `37` beams.

Required invariants:

1. `generateHexagonalBeamLayout()` returns exactly `N` beams for `N in
   [7, 19, 37]`.
2. Beam IDs are exactly `${satId}-b0` through `${satId}-b${N - 1}` with no gaps
   and no duplicates.
3. The first beam is the center beam at `(0, 0)` km.
4. Coordinates are finite ENU kilometer offsets.
5. Layouts for `7`, `19`, and `37` complete rings with max axial radius
   `1`, `2`, and `3`, respectively. If the validator does not expose axial
   coordinates, it should assert the expected unique radius/coordinate counts
   from the generated ENU geometry.
6. No generated coordinate pair is duplicated.
7. `beamDiameterKm` and `altitudeKm` round-trip unchanged.
8. `isActive` is `true` for all generated beams before later scheduling logic.
9. FRF accepts only `1`, `3`, and `7`; invalid FRF throws.
10. `numBeams < 1` throws.
11. Reuse groups are in `[0, frf - 1]`.
12. FRF 1 produces only group `0`.
13. FRF 3 and FRF 7 produce the deterministic distributions recorded in
    Section 5 for `7 / 19 / 37`.
14. Authored output order is stable and numeric-index ordered; validators must
    not sort lexicographically by ID.
15. The Phase 2 identity adapter still maps producer IDs, local beam indexes,
    and 1-based visual IDs without mutating producer truth.
16. `7` remains the only baseline MODQN evidence preset in docs or emitted
    metadata; `19 / 37` remain sensitivity/demo-only.

Recommended destination command set after Phase 3B in `leo-beam-sim`:

```bash
git diff --check
npm run validate:modqn:phase2-identity-adapter
npm run validate:modqn:phase3b-beam-layout
```

If Phase 3B also adds a local core-purity validator for vendored modules, run
it here. Otherwise, `ntn-sim-core`'s `validate:core-purity` remains source-side
pre-copy evidence, not an existing `leo-beam-sim` command.

Use `npm run lint` and `npm run build` only if Phase 3B adds TypeScript surfaces
or package scripts that require full repo compilation. Do not run browser or
dev-server validation in Phase 3B unless runtime/UI behavior is explicitly
changed.

## 9. Phase 3B Acceptance Criteria

Smallest safe Phase 3B implementation:

1. Vendor only `ntn-sim-core/src/core/beam/layout.ts`.
2. Vendor only `ntn-sim-core/src/core/beam/types.ts`.
3. Place them under a clearly owned local core/vendor path.
4. Add a layout invariant validator.
5. Add a package script for that validator.
6. Keep existing `src/scene/beam-layout.ts` runtime behavior unchanged unless a
   separate runtime-switch phase is explicitly scoped.
7. Keep Phase 2 producer identity adapter tests passing.
8. Update documentation with source commit, copied paths, validation output,
   and claim boundary.
9. Update the `ntn-showcase-stack/README.md` Module Vendor Log in the same PR
   if the future task scope permits cross-repo doc edits.

Expected Phase 3B changed files:

1. `src/core/beam/layout.ts`
2. `src/core/beam/types.ts`
3. optional local narrow `src/core/beam/index.ts` if it exports only the
   layout slice
4. `scripts/validate-modqn-phase3b-beam-layout.ts`
5. `package.json` for the new validator script
6. a Phase 3B evidence doc or update to this Phase 3A document
7. `ntn-showcase-stack/README.md` Module Vendor Log, if cross-repo update is in
   Phase 3B scope

Expected files not changed in the smallest Phase 3B:

1. `src/scene/beam-layout.ts`
2. `src/scene/useSimulation.ts`
3. `src/scene/useBeamViz.ts`
4. `src/scene/beam-scheduler.ts`
5. `src/engine/signal/*`
6. `src/engine/handover/*`
7. producer artifacts under `/home/u24/papers/modqn-paper-reproduction/`
8. source files under `/home/u24/papers/ntn-sim-core/`

Stop rules for Phase 3B:

1. Stop with `BLOCKED_CONTAMINATED_SOURCE` if the copied source files gain any
   React, Three.js, browser API, `viz/`, `app/`, or scene dependency.
2. Stop with `BLOCKED_VALIDATION_GAP` if `validate:core-purity`,
   `validate:multibeam-gating`, or the new destination layout validator fails.
3. Stop with `NEEDS_CONTROLLER_DECISION` if implementation pressure requires
   vendoring `selection.ts`, `scheduler.ts`, `active-beam-manager.ts`,
   `frequency-reuse.ts`, or engine/channel files in the same PR.
4. Stop with `NEEDS_CONTROLLER_DECISION` if Phase 3B must change runtime
   numeric beam ID types across scene, signal, handover, and viz surfaces.
5. Stop if any wording implies `19 / 37` trained baseline MODQN evidence.
6. Stop if any wording introduces EE/HEA/Catfish/Multi-Catfish claims.
7. Stop if a local display transform would alter producer truth, policy
   decisions, reward values, handover classifications, deterministic IDs, or
   provenance.

## 10. Phase 3B Recommendation

Proceed to Phase 3B as a narrow layout-slice vendor PR:

1. Copy only `layout.ts` and `types.ts`.
2. Add a local invariant validator for `7 / 19 / 37`.
3. Preserve the Phase 2 producer identity adapter as the canonical MODQN
   evidence identity boundary.
4. Do not switch runtime scene layout, expose `19 / 37` controls, or change
   numeric beam ID surfaces in the same PR.
5. Split any runtime adoption into a later phase after the local adapter can
   map producer IDs, core layout IDs, and scene numeric IDs without claim drift.

This is ready for Phase 3B vendoring because the source layout slice is clean,
the source-side purity and multibeam validators pass, and the local conflicts
are understood. The remaining work is implementation discipline: keep the first
vendor step isolated, validate exact invariants, and do not use vendoring as an
implicit runtime or MODQN evidence expansion.
