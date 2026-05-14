# MODQN Baseline Phase 6C Channel/SINR Vendor Readiness

**Date:** 2026-05-12
**Status:** docs-only readiness audit
**Target repo:** `/home/u24/papers/project/leo-beam-sim`
**Source repo:** `/home/u24/papers/ntn-sim-core`
**Phase 6D readiness:** `NEEDS_DECOMPOSITION`

Phase 6C audits the smallest safe channel/SINR vendoring path after Phase 6B.
It does not vendor source, adopt runtime behavior, edit package scripts, update
profiles, change UI controls, copy artifacts, or update the cross-repo Module
Vendor Log.

## 1. Decision

Phase 6D is **not ready** as a single channel/SINR runtime-vendoring or
behavior-adoption slice.

The safe next path needs decomposition:

1. A leaf channel math vendor slice can be planned first, with no runtime
   adoption. The smallest useful source set is `src/core/channel/types.ts`,
   `src/core/channel/sinr.ts`, and `src/core/channel/fspl.ts`.
2. A later link-budget slice can add the remaining pure channel helpers only
   after resolving `@/core/*` alias dependencies and profile-type imports.
3. Engine channel adoption must remain a separate later phase because
   `src/core/engine/channel-step.ts` and
   `src/core/engine/channel-sinr-helpers.ts` depend on core engine state,
   model bundles, beam tracking, string beam IDs, profile semantics, and KPI
   behavior.

This phase therefore records `NEEDS_DECOMPOSITION`, not `READY_TO_VENDOR`.
It is not `BLOCKED`: the inspected source candidates are not contaminated by
React, Three.js, `viz/`, or `app/` imports, but the smallest behavior-safe
boundary is narrower than "channel/SINR runtime adoption."

## 2. Evidence Read

Required local documents read:

1. `/home/u24/papers/AGENTS.md`
2. `AGENTS.md`
3. `docs/modqn-baseline-live-integration-mini-sdd.md`
4. `docs/modqn-baseline-phase6a-signal-handover-reuse-readiness.md`
5. `docs/modqn-baseline-phase6b-frequency-reuse-vendor.md`

Cross-repo authority read because this is cross-repo audit work:

1. `/home/u24/papers/ntn-showcase-stack/README.md`
2. `/home/u24/papers/ntn-showcase-stack/AGENTS.md`
3. `/home/u24/papers/ntn-showcase-stack/docs/repo-roles.md`
4. `/home/u24/papers/ntn-sim-core/AGENTS.md`
5. `/home/u24/papers/ntn-sim-core/agent-governance.md`
6. `/home/u24/papers/ntn-sim-core/sdd/README.md`

Source HEAD observed in `ntn-sim-core`:

`54b44159084fca606afc90ad104b1ddbf23844fc`

Source worktree note: `ntn-sim-core` was dirty during this audit, but
`git diff --stat -- src/core/channel/* src/core/engine/channel-step.ts
src/core/engine/channel-sinr-helpers.ts` showed no diff for the audited channel
and channel-engine candidates.

## 3. Phase 6B Runtime Non-Adoption Check

Phase 6B remains a vendor-only helper slice.

Observed local runtime state:

1. `src/core/beam/frequency-reuse.ts` exists as the Phase 6B vendored helper.
2. `scripts/validate-modqn-phase6b-frequency-reuse-vendor.ts` still scans
   `src/engine/signal`, `src/engine/handover`, `src/scene/useSimulation.ts`,
   and `src/profiles` for adoption of `src/core/beam/frequency-reuse.ts`.
3. Current live SINR still uses
   `src/engine/signal/link-budget.ts` and
   `getBeamFrequencyIndex(entry.sample.beamId, beamConfig.frequencyReuse)`.
4. Current handover still uses
   `src/engine/handover/handover-manager.ts` and numeric `beamId` state.

Conclusion: Phase 6B frequency-reuse helper is still not adopted into live
SINR, interference, handover, association, profile, UI, replay, or MODQN
policy behavior.

## 4. Source Candidate Inventory

| Source path in `ntn-sim-core` | Direct imports | Candidate role | Phase 6D risk |
| --- | --- | --- | --- |
| `src/core/channel/types.ts` | none | Shared channel result, SINR result, beam-gain, link-budget, and deployment types. | Leaf-safe. Required by `sinr.ts` and `link-budget.ts`. |
| `src/core/channel/sinr.ts` | type `SinrResult` from `./types` | Pure received-power SINR combiner. Separates intra and inter interference arrays. | Leaf-safe, but by itself does not define interferer selection. |
| `src/core/channel/fspl.ts` | none | Pure FSPL formula. | Leaf-safe. |
| `src/core/channel/beam-gain.ts` | `EARTH_RADIUS_KM` from `@/core/common/constants`; type `BeamGainInput` from `./types` | Beam gain and off-axis angle helper. | Pure but requires alias resolution or vendored common constants. |
| `src/core/channel/shadow-fading.ts` | type `ShadowFadingParams` from `./types`; type `DeploymentEnvironment` from `@/core/profiles/types` | 3GPP TR 38.811 shadow/clutter lookup and seeded sampling. | Pure but pulls profile type dependency. |
| `src/core/channel/small-scale-fading.ts` | none | Shadowed-Rician and Loo fading sampling. | Pure but stochastic; destination tests need seeded expectations or fixture checks. |
| `src/core/channel/los-probability.ts` | type `DeploymentEnvironment` from `./types` | 3GPP LOS probability table and deterministic seed hash. | Leaf-safe. |
| `src/core/channel/slant-range.ts` | `EARTH_RADIUS_KM` from `@/core/common/constants`; orbit types and topocentric helpers | TR 38.811 slant range plus per-UE topocentric geometry. | Pulls orbit/topocentric dependency; do not include in smallest leaf slice unless engine helper work is in scope. |
| `src/core/channel/doppler.ts` | none | Doppler shift and SINR degradation helper. | Leaf-safe, but behavior adoption changes SINR if enabled. |
| `src/core/channel/link-budget.ts` | `types`, `fspl`, `shadow-fading`, `beam-gain`, `small-scale-fading` | Composes Tier 0-5 link budget and received power. | Pure, but broader than leaf SINR; needs several dependent modules and destination golden tests. |
| `src/core/channel/index.ts` | barrel exports from channel modules | Optional export convenience. | Safe only after the exported files are vendored. |
| `src/core/models/path-loss.ts` | `../channel/link-budget.js`; channel types | Model-bundle adapter for path-loss family. | Adds `.js` import style and model-bundle contract surface; not needed for leaf SINR. |
| `src/core/models/sinr.ts` | `../channel/sinr` | Model-bundle adapter that subtracts Doppler degradation. | Small, but assumes model-bundle adoption shape. |
| `src/core/models/beam-gain.ts` | `../channel/beam-gain.js`; channel type | Model-bundle adapter for beam-gain family. | Not needed before link-budget/model-bundle decomposition. |
| `src/core/engine/channel-sinr-helpers.ts` | beam types, channel helpers, LOS/Doppler/slant geometry, orbit types, engine state | Computes received power, link geometry, LOS seed, tx EIRP, beam gain, and bundle SINR calls. | Engine-bound. Do not vendor with leaf channel math. |
| `src/core/engine/channel-step.ts` | orbit types, beam types, beam-gain/slant helpers, engine state, bootstrap, beam-tracking, channel helpers | Builds UE/satellite evaluations, serving candidates, reuse-group interference, inter-sat caps, and shared-serving SINR. | Heavy engine integration. Requires separate behavior phase and KPI gates. |

Equivalent path-loss module present locally in source: `src/core/channel/fspl.ts`
is the inspected FSPL module. `src/core/models/path-loss.ts` is a wrapper over
`src/core/channel/link-budget.ts`, not a separate FSPL implementation.

## 5. Source Dependency Map

Recommended decomposition map:

| Slice | Source files | Dependency ceiling | Why this boundary |
| --- | --- | --- | --- |
| Leaf SINR/FSPL | `types.ts`, `sinr.ts`, `fspl.ts` | No runtime, profile, orbit, model-bundle, beam-selection, or UI dependencies. | Smallest auditable vendor unit. It proves local import and validator shape without behavior adoption. |
| Pure channel formulas | Leaf slice plus `beam-gain.ts`, `shadow-fading.ts`, `small-scale-fading.ts`, `los-probability.ts`, `doppler.ts`, `link-budget.ts`, optional `index.ts` | Requires `@/core/common/constants` and either profile type vendoring or a local pure type shim. | This is the first useful link-budget slice, but it is broader than Phase 6B helper parity. |
| Model wrappers | `src/core/models/path-loss.ts`, `src/core/models/sinr.ts`, `src/core/models/beam-gain.ts` | Requires model-bundle contract decisions and import-extension alignment. | Only needed if Leo adopts the source model-bundle shape instead of calling leaf functions directly. |
| Engine channel integration | `channel-sinr-helpers.ts`, `channel-step.ts` plus beam tracking/bootstrap/state dependencies | Requires beam selection, layout, profiles, model bundles, UE positions, handover/KPI surfaces, and string beam IDs. | Behavior-changing. Must not be batched with leaf vendoring. |

Important source behavior note: `channel-step.ts` does co-channel filtering from
`beam.reuseGroup` on the core `BeamSelectionResult`, not from numeric
`beamId % frequencyReuse`. This is the behavior Phase 6A identified as missing
from Leo's live signal path, but adopting it means adopting more than the
frequency-reuse helper.

## 6. Kill-Switch Audit

The inspected source candidates did not contain active imports of React,
React DOM, Three.js, `@react-three`, `viz/`, `app/`, browser globals, canvas,
or WebGL APIs.

The only hits for React/Three/scene wording were governance comments in source
files stating that such imports are forbidden.

Kill-switch risks for Phase 6D:

1. Stop if a future source diff adds React, Three.js, browser APIs, `viz/`,
   `app/`, or `.tsx` under the vendored source set.
2. Stop if Phase 6D attempts to vendor `channel-step.ts` without its engine
   dependencies and KPI gates.
3. Stop if Phase 6D rewrites Leo runtime SINR to use core reuse groups while
   still leaving numeric beam identity, active-assignment, and handover state
   unresolved.
4. Stop if Phase 6D treats local display helpers as channel truth.
5. Stop if K=`2/4/5/6` compatibility labels are promoted to core-backed FRF
   truth.

## 7. Destination Conflict Map

| Leo path | Current role | Conflict before behavior adoption |
| --- | --- | --- |
| `src/engine/signal/types.ts` | Numeric `LinkSample.beamId`, `ActiveBeamAssignment.beamId`, and `SatelliteSnapshot.beamCellsKm[].beamId`. | No core string `beamId`, `coreBeamId`, `reuseGroup`, or producer identity on the behavior-level signal type. |
| `src/engine/signal/link-budget.ts` | Current live HOBS/TR 38.811 SINR path. | Co-channel grouping uses numeric modulo through `getBeamFrequencyIndex()`, not core `reuseGroup`. |
| `src/engine/signal/power-control.ts` | DPC state keyed by `${satId}:${beamId}` and driven by `sample.sinrDb`. | Any SINR port changes power-control feedback and effective TX power. |
| `src/engine/handover/types.ts` | Numeric serving, pending target, decision, and event beam IDs. | Core channel/engine path uses string beam IDs such as `${satId}-b${index}`. |
| `src/engine/handover/handover-manager.ts` | HOBS SINR-offset live handover manager. | Sorts local `LinkSample[]` by SINR, logs initial attach as `inter-handover`, and must not be relabeled MODQN replay behavior. |
| `src/scene/beam-layout.ts` | Core layout bridge with Leo numeric IDs and metadata. | Still hard-caps `MAX_BEAMS_PER_SATELLITE = 7`; current `19/37` truth presets are not runtime behavior. |
| `src/scene/useSimulation.ts` | React/R3F live orchestration for orbit, beams, signal, handover, DPC, and frame publication. | Calls local `computeLinkBudget()` and builds numeric assignments. This file is not a core-purity destination for vendored engine logic. |
| `src/scene/simulationHelpers.ts` and `src/scene/types.ts` | Scene frame helpers and types, including Three.js vectors and visual state. | These are visual/runtime surfaces, not a safe destination for source-truth channel code. |
| `src/utils/beamFrequency.ts` | Display and compatibility frequency-index helper. | Safe for labels, unsafe as the source for signal truth. |
| `src/ui/SignalTuningPanel.tsx`, `src/signalTuning.ts`, `src/profiles/*` | Expose and apply live HOBS/SINR tuning, including `frequencyReuse`. | Current controls change local HOBS behavior, not source-backed core channel behavior. |
| `src/ui/InfoPanel.tsx` and `src/ui/DiagnosticsDrawer.tsx` | Display HOBS live SINR, formulas, handover state, and visual frequency diagnostics. | Claim risk if visual reuse metadata or HOBS live SINR is presented as MODQN replay evidence. |

## 8. Required Validators And KPI Gates

Minimum source-side validators before any Phase 6D leaf vendoring:

1. `npm run validate:core-purity` in `/home/u24/papers/ntn-sim-core`
2. `npm run validate:golden-channel` in `/home/u24/papers/ntn-sim-core`

Additional source-side validators before link-budget or engine-channel
behavior adoption:

1. `npm run validate:multibeam-gating`
2. `npm run validate:golden-engine`
3. `npm run validate:runtime`
4. `npm run validate:stage` if profiles, model bundles, engine state, KPI, or
   runtime contracts are touched
5. MODQN validators only if replay or MODQN bridge semantics are touched:
   `npm run validate:modqn`, `npm run validate:modqn:m2`,
   `npm run validate:modqn:m3`, `npm run validate:modqn:parity`,
   `npm run validate:modqn:bundle`, and `npm run validate:modqn:bundle-ui`

Frozen KPI baselines that must be recorded before any behavior-changing port:

| Baseline file | Why it gates channel/SINR adoption |
| --- | --- |
| `/home/u24/papers/ntn-sim-core/baseline-kpi-hobs-multibeam-baseline.json` | Main multibeam SINR, reuse-group interference, beam switching, throughput, and outage baseline. |
| `/home/u24/papers/ntn-sim-core/baseline-kpi-case9-access-baseline.json` | Access-family SINR and handover baseline. |
| `/home/u24/papers/ntn-sim-core/baseline-kpi-bh-resource-baseline.json` | Beam-hopping/resource baseline where active beams and FRF semantics matter. |
| `/home/u24/papers/ntn-sim-core/baseline-kpi-real-trace-validation.json` | Real-trace orbit/timing validation path if channel helpers are adopted under real-trace runtime. |

Destination-side gates needed after future vendoring:

1. A new `leo-beam-sim` Phase 6D validator that proves copied source hashes,
   import purity, and no runtime adoption for leaf-only vendoring.
2. A later behavior validator that compares source and destination channel
   outputs for fixed fixtures before any live SINR path switches over.
3. A no-drift KPI comparison against the matching frozen `ntn-sim-core`
   baseline before claiming behavior parity.

No destination-side behavior validator currently proves KPI no-drift for core
channel adoption.

## 9. Claim Boundary Summary

The Phase 1 through Phase 6B claim boundaries remain unchanged:

1. `7` beams remains the accepted regenerated baseline MODQN evidence path.
2. `19` and `37` remain live sensitivity/demo extensions only.
3. `19` and `37` must not be described as trained baseline MODQN evidence.
4. HOBS/SINR live simulator behavior must not be labeled MODQN replay evidence.
5. Paper baseline signal evidence is SNR-like; source-backed live SINR with
   interference must be labeled separately.
6. Display-only transforms must not alter SINR/SNR, interference terms,
   handover events, policy decisions, rewards, deterministic IDs, masks, or
   provenance.

## 10. Phase 6D Exit Criteria

A decomposed Phase 6D leaf-vendor slice would be ready only if it limits itself
to source-copying and validation of leaf math, and explicitly does not touch
runtime behavior.

Required Phase 6D constraints:

1. Copy one leaf source unit only.
2. Run source-side `validate:core-purity` and `validate:golden-channel`.
3. Add a destination validator for source hash, import purity, and claim
   boundary text.
4. Keep `src/engine/signal/*`, `src/engine/handover/*`,
   `src/scene/useSimulation.ts`, `src/profiles/*`, UI controls, artifacts, and
   replay behavior unchanged.
5. Do not update the Module Vendor Log unless a real vendor copy happens in
   that future phase.

Full live SINR adoption needs a later phase after string/numeric beam identity,
core reuse-group behavior, profile parameters, power-control feedback,
handover event semantics, KPI gates, and UI claim labeling are all planned as
separate changes.

## 11. Deviations And Blockers

Deviations in this Phase 6C audit:

1. None. This phase is docs-only and does not vendor source or update package
   scripts, profiles, UI, artifacts, or vendor logs.

Current blockers to full Phase 6D runtime adoption:

1. Leo live signal truth is still numeric-beam-ID based.
2. Leo live interference still uses numeric modulo grouping.
3. Core engine channel behavior uses string beam IDs, model bundles, beam
   tracking, source profiles, and engine state.
4. Leo's current runtime remains capped to 7 beams per satellite.
5. No destination-side no-drift KPI validator exists for channel/SINR behavior
   adoption.
6. Adopting channel behavior would also affect DPC, handover, KPI, diagnostics,
   and UI claims.

## 12. Phase 6C Validation Plan

Required validation for this docs-only audit:

1. `git diff --check`
2. no-index whitespace check for this new doc if it is untracked
3. unsupported `19/37` trained-baseline claim scan
4. `git status --short`
