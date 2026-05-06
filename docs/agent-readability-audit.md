# Codex Agent Readability Audit

## Status

Audit-only record. No source split or refactor has been performed.

## Date

2026-05-02

## Scope

This audit checks whether single files in `project/leo-beam-sim` are large enough
to make future Codex agent reading, review, and patching unnecessarily expensive.

Inspected scope:

- Included source, scripts, docs, tracked assets, and currently untracked local
  proposal files under `docs/visual-clarity-proposal/`.
- Excluded `.git/`, `node_modules/`, and `dist/` from split recommendations.
- Treated binary assets separately from code and markdown, because they are not
  meaningful candidates for textual decomposition.

Current local worktree note:

- The project already had modified files and untracked files before this audit.
- This audit did not attempt to normalize, revert, or refactor those changes.

## Heuristic

For future agent work in this repo, use these rough thresholds:

| File kind | Comfortable | Watch | Split candidate |
|---|---:|---:|---:|
| React / TypeScript source | <= 300 LOC | 300-700 LOC | > 700 LOC |
| One-off validation script | <= 250 LOC | 250-600 LOC | > 600 LOC if reusable logic is duplicated |
| Markdown SDD / plan | <= 500 LOC | 500-1,000 LOC | > 1,000 LOC unless it is an index plus appendices |
| Lockfile / binary asset | N/A | N/A | Do not split for readability; summarize or avoid direct reading |

These are not hard rules. A 900-line file with one linear generated table is less
dangerous than a 500-line file that mixes UI, state derivation, simulation logic,
and validation contracts.

## Inventory Summary

Excluding `.git/`, `node_modules/`, and `dist/`, the workspace contains 112 files:

| Extension | Count |
|---|---:|
| `.ts` | 47 |
| `.tsx` | 25 |
| `.md` | 23 |
| `.json` | 6 |
| `.png` | 4 |
| `.glb` | 3 |
| `.scss` | 1 |
| `.html` | 1 |
| `.gitignore` | 1 |
| `.gitattributes` | 1 |

Large generated or asset files:

| File | Size | Assessment |
|---|---:|---|
| `public/models/uav.glb` | 10.3 MB | Binary model. Do not split for Codex readability. |
| `public/scenes/NTPU.glb` | 8.1 MB | Binary scene. Do not split for Codex readability. |
| `public/models/sat.glb` | 2.6 MB | Binary model. Do not split for Codex readability. |
| `docs/visual-clarity-proposal/baselines-pre-vc/*.png` | 0.34-1.36 MB each | Baseline screenshots. Keep as evidence assets. |
| `package-lock.json` | 3,423 LOC / 117 KB | Lockfile. Avoid direct manual reading; no split. |

## Source Files Over The Readability Threshold

| Priority | File | LOC | Assessment |
|---|---:|---:|---|
| P0 | `src/ui/SignalTuningPanel.tsx` | 1,502 | Strong split candidate. This combines tuning tabs, formula map, loss controls, shared controls, page tabs, copy, and inline styles. |
| P0 | `src/scene/MainScene.tsx` | 827 | Strong split candidate. The file is no longer just a scene shell; it derives panel state, manages latching, throttles UI publication, and renders the 3D scene. |
| P0 | `src/scene/useSimulation.ts` | 767 | Strong split candidate. It owns trajectory cache, interpolation, beam geometry, link-context construction, handover updates, DPC runtime state, and frame publication in one hook. |
| P1 | `src/ui/InfoPanel.tsx` | 846 | Split candidate. It mixes formatters, badge/tile primitives, formula evidence, operational cards, policy readouts, DPC status, and debug blocks. |
| P1 | `src/scene/useBeamViz.ts` | 607 | Split candidate if visual work continues. It combines approach lookahead, satellite ranking, event-role selection, beam projection, SINR label latching, and output assembly. |
| P1 | `scripts/benchmark-hobs-tr38811-phase1.ts` | 751 | Split or share logic if benchmark work continues. It duplicates a significant slice of simulation runtime logic outside `useSimulation.ts`. |
| P2 | `scripts/validate-phase8b-path-loss-controls.tsx` | 575 | Watch. Large, but still coherent as a focused validation harness. Extract shared test helpers only if more scripts copy the same markup/assertion patterns. |
| P2 | `src/viz/SatelliteBeams.tsx` | 318 | Watch. Over threshold but cohesive as a rendering component. No immediate split needed. |
| P2 | `src/engine/handover/handover-manager.ts` | 305 | Watch. Cohesive domain state machine. No split unless policies multiply. |

## Markdown Files Over The Readability Threshold

| Priority | File | LOC | Assessment |
|---|---:|---:|---|
| P0 | `docs/frontend-ux-redesign-sdd.md` | 2,899 | Strong documentation split candidate. It has become an SDD plus phase log plus closure notes. Future agents must search through too much historical material. |
| P1 | `docs/SDD.md` | 703 | Watch and update. It is still readable, but its file-size estimates are stale: it says `useSimulation.ts` is about 200 lines and `MainScene.tsx` about 120 lines; actual counts are 767 and 827. |
| P2 | `docs/hobs-tr38811-sinr-mini-sdd.md` | 451 | Acceptable. It is long but structured and still below the split threshold. |
| P2 | `docs/beam-hopping-mini-sdd.md` | 371 | Acceptable. |
| P2 | `docs/sinr-runtime-parameter-contract.md` | 312 | Acceptable. |
| P2 | `docs/visual-clarity-proposal/visual-clarity-sdd/*.md` | 322-495 each | Acceptable. This folder is a good example of splitting a large SDD into phase files. |

## Detailed Findings

### 1. `src/ui/SignalTuningPanel.tsx`

This is the highest-value split candidate.

Current responsibilities:

- top-level `SignalTuningPanel` orchestration
- page tabs between SINR formula and handover policy
- six SINR tuning tabs
- formula ownership map
- shared numeric/select/toggle controls
- loss-control sections and TR 38.811 conditional copy
- inline layout and visual styles

Recommended future split:

- `src/ui/signal-tuning/types.ts`
- `src/ui/signal-tuning/tuningConfig.tsx`
- `src/ui/signal-tuning/TuningPageTabs.tsx`
- `src/ui/signal-tuning/NumericControl.tsx`
- `src/ui/signal-tuning/FormulaMap.tsx`
- `src/ui/signal-tuning/LossControls.tsx`
- keep `src/ui/SignalTuningPanel.tsx` as the small orchestrator

Good split target:

- `SignalTuningPanel.tsx` <= 300 LOC
- each child module <= 250 LOC

### 2. `src/scene/MainScene.tsx`

This file appears to have outgrown the design described in `docs/SDD.md`.

Current responsibilities:

- React Three Fiber canvas shell
- lights/camera/controls scene composition
- simulation hook binding
- visual hook binding
- UI state derivation for `InfoPanel`
- physical-serving vs panel-primary vs comparison normalization
- stale/latch handling for SINR, topology, and budgets
- update throttling and `onSimUpdate` publication

Recommended future split:

- `src/scene/panel-state.ts` for pure panel-state derivation helpers
- `src/scene/usePanelStatePublisher.ts` for latching, throttling, and `onSimUpdate`
- `src/scene/SceneContent.tsx` for scene composition
- keep `src/scene/MainScene.tsx` as the canvas shell

This split should be done carefully because the current latching behavior is
part of the UI truth contract.

### 3. `src/scene/useSimulation.ts`

This hook is a domain-heavy runtime coordinator, not just a React hook.

Current responsibilities:

- orbit cache generation
- satellite interpolation
- sky/world position projection
- beam layout construction
- beam hopping slot state
- beam power control / DPC bucket state
- link-context construction
- handover manager update
- recent-handover linger state
- `SimFrame` assembly

Recommended future split:

- `src/scene/simulation/trajectory-cache.ts`
- `src/scene/simulation/interpolation.ts`
- `src/scene/simulation/link-context.ts`
- `src/scene/simulation/recent-handover.ts`
- keep `useSimulation.ts` as the hook that wires refs, effects, and `useFrame`

This would also reduce duplicated runtime logic in
`scripts/benchmark-hobs-tr38811-phase1.ts`.

### 4. `src/ui/InfoPanel.tsx`

This file is readable in chunks, but it mixes several UI surfaces.

Current responsibilities:

- formatting helpers
- `StatusBadge`, `DebugRow`, `MetricTile`
- formula term evidence card
- serving/comparison operational cards
- handover metric card
- beam hopping card
- handover policy diagnostics
- DPC diagnostics
- validation/debug block

Recommended future split:

- `src/ui/info-panel/formatters.ts`
- `src/ui/info-panel/FormulaTermsReadout.tsx`
- `src/ui/info-panel/SignalStatusCards.tsx`
- `src/ui/info-panel/HandoverReadout.tsx`
- `src/ui/info-panel/DiagnosticsBlocks.tsx`
- keep `InfoPanel.tsx` as a composition layer

### 5. `src/scene/useBeamViz.ts`

This file is still under 700 LOC, but it is cognitively dense.

Current responsibilities:

- approach-beam lookahead and latching
- display satellite ranking
- event-role selection
- beam satellite selection
- beam output projection
- SINR label selection
- previous-display/event latching

Recommended future split if visual clarity work continues:

- `src/scene/viz-ranking.ts`
- `src/scene/approach-preview.ts`
- `src/scene/beam-viz-output.ts`
- keep `useBeamViz.ts` as a memoized orchestrator

### 6. Validation And Benchmark Scripts

The validation scripts are intentionally self-contained, but a pattern is
emerging:

- `scripts/benchmark-hobs-tr38811-phase1.ts` repeats simulation runtime concepts.
- `scripts/validate-phase8b-path-loss-controls.tsx` contains reusable markup
  helpers and source-string assertions.
- Many `validate-phase*.tsx` scripts likely share assertion and SSR patterns.

Recommended future split:

- Create `scripts/lib/assertions.ts` for `assertContains`, `assertNotContains`,
  `assertClose`, and markup text decoding.
- Create `scripts/lib/render.tsx` if SSR validation scripts keep rendering
  `InfoPanel` and `SignalTuningPanel`.
- Consider a reusable non-React simulation runner for benchmarks instead of
  copying runtime logic from `useSimulation.ts`.

Do not split every script immediately. The split only pays off when two or more
scripts need the same helper.

## Recommended Order If Refactoring Is Approved Later

1. Split `SignalTuningPanel.tsx`.
   - Lowest domain risk.
   - Highest immediate Codex readability gain.
   - Mostly UI component extraction.
2. Split `InfoPanel.tsx`.
   - Also UI-heavy.
   - Keep data truth labels and test IDs stable.
3. Extract panel-state derivation from `MainScene.tsx`.
   - Medium risk because latching and truth-status semantics matter.
4. Extract pure simulation helpers from `useSimulation.ts`.
   - Higher risk because runtime behavior and benchmark expectations can shift.
5. Reuse the extracted simulation helpers in benchmark scripts.
   - Should follow, not precede, the `useSimulation.ts` extraction.
6. Split `docs/frontend-ux-redesign-sdd.md`.
   - Convert to an index plus phase files or archive completed phase notes.
   - Keep canonical current decisions easy to find.

## Do Not Split

Do not split these for agent readability:

- `package-lock.json`
- `.glb` model files
- `.png` baseline screenshots
- small focused engine modules under `src/engine/signal/`
- small focused orbit modules under `src/engine/orbit/`

For binary and generated files, future agents should rely on metadata,
screenshots, asset names, or targeted tooling rather than reading raw contents.

## Acceptance Criteria For A Future Split

Any future split should preserve these constraints:

- No behavior changes unless explicitly requested.
- Preserve public exports imported by existing code or add stable re-export
  shims during migration.
- Preserve `data-testid`, `data-*`, and visible labels used by validation
  scripts unless the SDD explicitly changes them.
- After each split, run at minimum `npm run lint` plus the validation script(s)
  that cover the moved surface.
- Update `docs/SDD.md` if file ownership or line-size assumptions change.

## Bottom Line

The project does have a small number of oversized, agent-unfriendly files. The
most meaningful splits are not mechanical line-count splits; they should follow
existing responsibility boundaries:

- UI controls and formula-map components out of `SignalTuningPanel.tsx`
- panel truth derivation out of `MainScene.tsx`
- pure simulation/link-context helpers out of `useSimulation.ts`
- formula/diagnostics subcomponents out of `InfoPanel.tsx`
- visual ranking/approach helpers out of `useBeamViz.ts`

No immediate split should be made without a follow-up implementation request.
