# MODQN Baseline Phase 6G Pure Channel Remainder Readiness

**Date:** 2026-05-12
**Status:** docs-only readiness audit
**Target repo:** `/home/u24/papers/project/leo-beam-sim`
**Source repo:** `/home/u24/papers/ntn-sim-core`
**Phase 6H readiness:** `READY_TO_VENDOR_LEAF_HELPERS`

Phase 6G audits the remaining pure-channel helper vendoring path after the
Phase 6F beam-gain slice. It does not vendor source, adopt runtime behavior,
edit package scripts, update profiles, change UI controls, copy artifacts, or
update the cross-repo Module Vendor Log.

## 1. Decision

Phase 6H is ready only as a narrow leaf-helper vendor slice.

Ready leaf set:

1. `src/core/channel/small-scale-fading.ts`
2. `src/core/channel/los-probability.ts`
3. `src/core/channel/doppler.ts`

Conditional leaf:

1. `src/core/channel/shadow-fading.ts` is pure channel math, but an exact
   source copy imports `DeploymentEnvironment` from `@/core/profiles/types`.
   Phase 6H must either avoid this file, add a minimal local type shim, or
   intentionally vendor a small profile type slice before including it.

Not ready for Phase 6H:

1. `src/core/channel/link-budget.ts` is link-budget composition, not leaf
   helper vendoring. It composes FSPL, shadow fading, beam gain, and
   small-scale fading, so it should wait until the profile-type decision is
   resolved and destination fixtures cover the composed output.
2. `src/core/channel/index.ts` is a barrel export. It should only be copied
   after the exported helpers selected for the destination actually exist.

This is `READY_TO_VENDOR_LEAF_HELPERS`, not `NEEDS_SOURCE_CLEANUP`,
`NEEDS_DECOMPOSITION`, or `BLOCKED`, because the non-profile leaf helpers have
clean import ceilings and no kill-switch contamination. If the next phase
insists on exact-copying `shadow-fading.ts` or `link-budget.ts`, the effective
status becomes `NEEDS_PROFILE_TYPE_SLICE`.

## 2. Evidence Read

Required local documents read:

1. `/home/u24/papers/AGENTS.md`
2. `AGENTS.md`
3. `docs/modqn-baseline-live-integration-mini-sdd.md`
4. `docs/modqn-baseline-phase6c-channel-sinr-vendor-readiness.md`
5. `docs/modqn-baseline-phase6d-channel-leaf-vendor.md`
6. `docs/modqn-baseline-phase6f-beam-gain-vendor.md`

Additional local context read:

1. `docs/modqn-baseline-phase6e-beam-gain-vendor-readiness.md`

Cross-repo authority read because this is cross-repo audit work:

1. `/home/u24/papers/ntn-showcase-stack/README.md`
2. `/home/u24/papers/ntn-showcase-stack/AGENTS.md`
3. `/home/u24/papers/ntn-showcase-stack/docs/repo-roles.md`
4. `/home/u24/papers/ntn-showcase-stack/docs/artifact-contract-v1.md`
5. `/home/u24/papers/ntn-sim-core/AGENTS.md`
6. `/home/u24/papers/ntn-sim-core/agent-governance.md`
7. `/home/u24/papers/ntn-sim-core/docs/leo-beam-sim-donor-map.md`
8. `/home/u24/papers/ntn-sim-core/docs/extraction-guide-for-leo-beam-sim.md`

Source HEAD observed in `ntn-sim-core`:

`54b44159084fca606afc90ad104b1ddbf23844fc`

Source worktree note: `ntn-sim-core` was dirty during this audit, but
`git status --short --` and `git diff --` on the audited channel and
profile/common dependency candidates showed no source-side diff for those
files.

Destination worktree note: `leo-beam-sim` was already dirty before this audit.
This phase adds only this Markdown file.

## 3. Source Dependency Map

| Source path in `ntn-sim-core` | Direct imports or exports | Candidate role | Phase 6H dependency ceiling |
| --- | --- | --- | --- |
| `src/core/channel/shadow-fading.ts` | `ShadowFadingParams` from `./types`; `DeploymentEnvironment` from `@/core/profiles/types` | 3GPP TR 38.811 shadow/clutter lookup plus seeded Gaussian sampling. | Pure helper, but exact copy needs profile type resolution. |
| `src/core/channel/small-scale-fading.ts` | none | Shadowed-Rician and Loo fading sampling. | Leaf-safe. Requires deterministic seeded fixtures because output is stochastic. |
| `src/core/channel/los-probability.ts` | `DeploymentEnvironment` from `./types` | 3GPP TR 38.811 LOS probability lookup plus deterministic seed hash. | Leaf-safe. Uses already-vendored Phase 6D channel type. |
| `src/core/channel/doppler.ts` | none | Doppler shift, radial-velocity estimate, and Doppler SINR degradation helper. | Leaf-safe. Do not adopt degradation into live SINR in the same phase. |
| `src/core/channel/link-budget.ts` | `ChannelResult`, `LinkBudgetOptions` from `./types`; `computeFspl` from `./fspl`; `getShadowFadingParams`, `sampleShadowFading` from `./shadow-fading`; `computeBeamGain` from `./beam-gain`; `sampleShadowedRicianDb`, `sampleLooDb` from `./small-scale-fading` | Composes channel tiers into received power. | Composition slice. Depends on shadow-fading profile type decision and destination golden fixtures. |
| `src/core/channel/index.ts` | Barrel exports from `./types`, `./fspl`, `./shadow-fading`, `./beam-gain`, `./sinr`, `./link-budget`, `./small-scale-fading`, and `./doppler` | Optional channel barrel. | Safe only after exported destination files exist. It does not currently export `los-probability.ts`. |

Already-vendored dependencies in `leo-beam-sim`:

| Destination path | Source role |
| --- | --- |
| `src/core/channel/types.ts` | Defines `ChannelResult`, `SinrResult`, `BeamGainInput`, `InterferingSignal`, `SinrComputeOptions`, `LargeScaleModel`, `DeploymentEnvironment`, `LinkBudgetOptions`, and `ShadowFadingParams`. |
| `src/core/channel/fspl.ts` | FSPL leaf helper. |
| `src/core/channel/sinr.ts` | SINR combiner leaf helper. |
| `src/core/common/constants.ts` | Common physical constants used by beam gain. |
| `src/core/channel/beam-gain.ts` | Beam-gain and off-axis-angle leaf helper, normalized only for the documented source line-123 trailing space. |

Profile type dependency ceiling if `shadow-fading.ts` is exact-copied:

| Source path | Direct imports | Why this is larger than a channel leaf slice |
| --- | --- | --- |
| `src/core/profiles/types.ts` | `./runtime-schema`, `./bundle-vocabulary`, and re-exported `../common/types` | Barrel for the whole profile schema, not just `DeploymentEnvironment`. |
| `src/core/profiles/runtime-schema.ts` | `../common/types`, `../orbit/types` | Pulls runtime profile, orbit, RF, beam, channel, handover, energy, and UE config types. |
| `src/core/profiles/bundle-vocabulary.ts` | `../common/types`, `../orbit/types`, `./runtime-schema` | Pulls profile-family, scenario, model-bundle, and experiment vocabulary. |
| `src/core/common/types.ts` | none | Shared provenance and runtime vocabulary. Larger than needed for shadow fading. |
| `src/core/orbit/types.ts` | none | Orbit structural contracts. Larger than needed for shadow fading. |

Preferred Phase 6H type decision:

1. Do not vendor the full profile type barrel only to satisfy
   `DeploymentEnvironment` for `shadow-fading.ts`.
2. If `shadow-fading.ts` is included, prefer a minimal local shim such as
   `src/core/profiles/types.ts` that exports only the compatible
   `DeploymentEnvironment` type, or first clean the source import to use the
   already-local `./types` definition.
3. Record any shim as a destination-owned type compatibility decision, not as
   runtime profile adoption.

## 4. Leaf Vs Composition Boundary

Leaf-safe Phase 6H behavior:

1. Copy only pure helper files that do not read runtime state, profiles, UI,
   scene state, artifacts, handover state, association state, or live signal
   samples.
2. Add deterministic destination fixtures for:
   - `sampleShadowedRicianDb()` and `sampleLooDb()` with fixed RNG streams;
   - `getLosProbabilityTr38811()` and `sampleLosStateTr38811()` with fixed
     elevation/environment/seed keys;
   - `computeDopplerShiftHz()`, `estimateRadialVelocityKmS()`, and
     `dopplerSinrDegradationDb()`.
3. Keep the helpers unused by live runtime paths.

Composition boundary for later phases:

1. `link-budget.ts` should wait for a separate composed-channel phase because
   it changes the unit under test from single formulas to total received power.
2. Link-budget vendoring must decide the `shadow-fading.ts` profile type issue
   first.
3. Link-budget vendoring should compare source and destination outputs for
   fixed tier combinations before any live SINR path switches over.
4. Engine channel adoption remains out of scope. It would affect serving
   selection, interference grouping, power control, handover, KPI, diagnostics,
   and UI claims.

## 5. Kill-Switch Audit

The inspected source candidates did not contain active imports of React, React
DOM, Three.js, `@react-three`, `viz/`, `app/`, browser APIs, canvas, WebGL, or
`.tsx` files.

The only React, Three.js, or scene wording found in the inspected files was in
governance comments saying such imports are forbidden.

Kill-switch stop conditions for Phase 6H:

1. Stop if any selected source file gains React, Three.js, browser API,
   `viz/`, `app/`, `scene`, or `.tsx` dependencies before copy.
2. Stop if Phase 6H expands from leaf helpers into `link-budget.ts`,
   `channel-step.ts`, `channel-sinr-helpers.ts`, model wrappers, profile
   defaults, UI, runtime, or replay behavior.
3. Stop if Doppler degradation is wired into live SINR during a leaf-vendor
   phase.
4. Stop if local HOBS/SINR runtime behavior is relabeled as MODQN replay
   evidence or source-backed channel adoption.

## 6. Source Diff And Whitespace Risks

Source candidate hashes at
`54b44159084fca606afc90ad104b1ddbf23844fc`:

| Source path | SHA-256 |
| --- | --- |
| `/home/u24/papers/ntn-sim-core/src/core/channel/shadow-fading.ts` | `546647443934bf2fa8074030cc18e584d7e3baa11972ef2704e724b569b007c1` |
| `/home/u24/papers/ntn-sim-core/src/core/channel/small-scale-fading.ts` | `9c16226b265a386c349d1052bed9b90351c112a0029d9a651fb9dd6cd49f0dc0` |
| `/home/u24/papers/ntn-sim-core/src/core/channel/los-probability.ts` | `1cac93ddc0c1d6f21252c1241f8f9680dbc072b0e7ca798bcbc065f4a6dff45d` |
| `/home/u24/papers/ntn-sim-core/src/core/channel/doppler.ts` | `5aa97d8a056b463c6d2a0db00a38e34fca36841f7db0ac02b5f4a464a6f39f24` |
| `/home/u24/papers/ntn-sim-core/src/core/channel/link-budget.ts` | `06179394f7263291de3d6e26af8b11d44098433f7c8dc0a90ec2b53388278953` |
| `/home/u24/papers/ntn-sim-core/src/core/channel/index.ts` | `a393bf18c5e19003b60fe1debb045bdde9ab2cfe4730b353fa9e0eea8b230b14` |

Profile/common dependency hashes:

| Source path | SHA-256 |
| --- | --- |
| `/home/u24/papers/ntn-sim-core/src/core/profiles/types.ts` | `9e3cf082cd7b127192a3ab674a5ed375f0f09d8a0159951fd377158359a3e777` |
| `/home/u24/papers/ntn-sim-core/src/core/profiles/runtime-schema.ts` | `badc499967f13e3c6b60f3f0072d4577d45d75704612f40b1cf8782ea0555856` |
| `/home/u24/papers/ntn-sim-core/src/core/profiles/bundle-vocabulary.ts` | `b4f7d13b9e5c0056a15154413fab8b9accb34e773bd55fd071d67582e633e748` |
| `/home/u24/papers/ntn-sim-core/src/core/common/constants.ts` | `4054c6e70979539843f3216ef5e31e6876715b40464fee2d7332ddaaa0f0ab7a` |

Whitespace and diff observations:

1. `git -C /home/u24/papers/ntn-sim-core diff --check --` over the audited
   channel candidates and profile/common type dependencies passed with no
   output.
2. No-index add-copy whitespace checks over
   `shadow-fading.ts`, `small-scale-fading.ts`, `los-probability.ts`,
   `doppler.ts`, `link-budget.ts`, `index.ts`, `profiles/types.ts`,
   `profiles/runtime-schema.ts`, `profiles/bundle-vocabulary.ts`, and
   `common/constants.ts` produced no whitespace findings. The no-index command
   exits nonzero because `/dev/null` and the source file differ, not because of
   whitespace findings.
3. Source EOL metadata for the audited files was `i/lf w/lf`.
4. The prior Phase 6F `beam-gain.ts` source trailing-space issue remains a
   documented Phase 6F normalization only; it is not a new Phase 6H source
   candidate risk.

## 7. Runtime Non-Adoption Summary

Phase 6D and Phase 6F helpers remain not adopted into runtime behavior.

Observed local state:

1. Runtime import scans over `src/engine/signal`, `src/engine/handover`,
   `src/scene/useSimulation.ts`, `src/profiles`, `src/ui`, and `src/modqn`
   found no imports from `src/core/channel`, `@/core/channel`, or the
   vendored `channel/fspl`, `channel/sinr`, `channel/types`, or
   `channel/beam-gain` files.
2. Runtime symbol scans over the same paths found no use of `computeFspl`,
   `computeSinr`, `computeBeamGain`, or `computeOffAxisAngle`.
3. The only observed uses of the vendored helpers are in `src/core/channel/*`
   and the Phase 6D / Phase 6F validators.
4. Live signal behavior still uses the local `src/engine/signal/*` HOBS/TR
   38.811 path.
5. Live handover behavior still uses the local `src/engine/handover/*` path.

Conclusion: Phase 6D and Phase 6F helpers remain validation/provenance helpers
only. No live SINR, interference, handover, association, profile, UI, replay,
producer-artifact, or MODQN policy behavior was adopted by this Phase 6G audit.

## 8. Required Validators For Future Vendoring

Minimum source-side gates before Phase 6H copies leaf helpers:

1. `npm run validate:core-purity` in `/home/u24/papers/ntn-sim-core`
2. `npm run validate:golden-channel` in `/home/u24/papers/ntn-sim-core`
3. `git diff --check --` over the selected source files and any selected type
   shim/profile dependency files
4. no-index add-copy whitespace checks for every selected source file
5. source HEAD, source diff status, and source hashes recorded in the Phase
   6H implementation doc

Minimum destination-side gates after a future leaf-helper copy:

1. a new `npm run validate:modqn:phase6h-pure-channel-remainder-vendor`
   validator checking copied hashes, import purity, kill-switch purity,
   deterministic fixtures, type-shim boundaries if used, and runtime
   non-adoption;
2. `npm run validate:modqn:phase6d-channel-leaf-vendor`;
3. `npm run validate:modqn:phase6f-beam-gain-vendor`;
4. `npm run lint`;
5. unsupported `19` / `37` trained-baseline claim scan;
6. `git diff --check`;
7. no-index whitespace check for any new untracked files before staging or
   committing.

Additional validators before link-budget or behavior adoption:

1. a source/destination composed-channel fixture validator for `computeLinkBudget()`;
2. `npm run validate:multibeam-gating` in `ntn-sim-core`;
3. `npm run validate:golden-engine` in `ntn-sim-core`;
4. `npm run validate:runtime` in `ntn-sim-core`;
5. the relevant frozen KPI baseline from:
   - `/home/u24/papers/ntn-sim-core/baseline-kpi-hobs-multibeam-baseline.json`
   - `/home/u24/papers/ntn-sim-core/baseline-kpi-case9-access-baseline.json`
   - `/home/u24/papers/ntn-sim-core/baseline-kpi-bh-resource-baseline.json`
   - `/home/u24/papers/ntn-sim-core/baseline-kpi-real-trace-validation.json`

KPI gates are not required for a no-runtime-adoption leaf helper copy. They are
required before any later live channel, link-budget, engine, association,
handover, power-control, policy, or UI behavior adoption.

## 9. Claim Boundary Summary

The Phase 1 through Phase 6F claim boundaries remain unchanged:

1. `7` beams remains the accepted regenerated baseline MODQN evidence path.
2. `19` and `37` beams remain live sensitivity/demo extensions only.
3. `19` and `37` must not be described as trained baseline MODQN evidence.
4. Phase 6H leaf-helper vendoring must not be presented as live MODQN runtime
   adoption.
5. HOBS/SINR live simulator behavior must not be labeled MODQN replay
   evidence.
6. Paper baseline signal evidence is SNR-like; source-backed live SINR with
   interference must be labeled separately if adopted in a later phase.
7. Display-only transforms must not alter SINR/SNR, interference terms,
   handover events, policy decisions, rewards, deterministic IDs, masks, or
   provenance.

## 10. Deviations And Blockers

Phase 6G deviations:

1. None. This phase is docs-only and does not vendor source or update package
   scripts, profiles, UI, artifacts, runtime behavior, or vendor logs.

Current blockers:

1. No blocker was found for a narrow Phase 6H leaf-helper copy limited to
   `small-scale-fading.ts`, `los-probability.ts`, and `doppler.ts`.
2. Exact-copying `shadow-fading.ts` is blocked until the
   `@/core/profiles/types` import is resolved by a minimal local type shim,
   a deliberate profile type slice, or a source-side import cleanup.
3. `link-budget.ts` is blocked from Phase 6H leaf vendoring because it is a
   composition helper and depends on `shadow-fading.ts`.
4. `index.ts` should not be copied until the destination channel module has
   the exported files it references.
5. `ntn-sim-core` and `leo-beam-sim` both have broader dirty worktrees, but
   this audit touched only this new doc and the audited source candidates were
   clean against source HEAD.

## 11. Phase 6G Validation Results

Required validation for this docs-only audit:

| Check | Result |
| --- | --- |
| `git diff --check` | Passed with no output. |
| `git diff --no-index --check -- /dev/null docs/modqn-baseline-phase6g-pure-channel-remainder-readiness.md` | No whitespace findings. The command exits nonzero because `/dev/null` and this new file differ, not because of whitespace errors. |
| unsupported `19` / `37` trained-baseline claim scan | Passed. All relevant hits are negated boundary statements or validation labels, such as "must not be described as trained baseline MODQN evidence." |
| `git status --short` | Completed. The worktree was already dirty; the only Phase 6G file added by this audit is this doc. |
