# MODQN Baseline Phase 6E Beam Gain Vendor Readiness

**Date:** 2026-05-12
**Status:** docs-only readiness audit
**Target repo:** `/home/u24/papers/project/leo-beam-sim`
**Source repo:** `/home/u24/papers/ntn-sim-core`
**Phase 6F readiness:** `READY_TO_VENDOR_WITH_DOCUMENTED_WHITESPACE_NORMALIZATION`

Phase 6E audits the future beam-gain/common-constants vendor slice after the
Phase 6D channel leaf vendor. It does not vendor source, adopt runtime
behavior, edit package scripts, update profiles, change UI controls, copy
artifacts, or update the cross-repo Module Vendor Log.

## 1. Decision

Phase 6F is ready as a narrow vendor slice if it copies only:

1. `src/core/common/constants.ts`
2. `src/core/channel/beam-gain.ts`

The existing Phase 6D `src/core/channel/types.ts` copy already satisfies the
`BeamGainInput` type dependency.

The readiness status is
`READY_TO_VENDOR_WITH_DOCUMENTED_WHITESPACE_NORMALIZATION`, not
`READY_TO_VENDOR_EXACT`, because an exact add-copy whitespace check of source
`beam-gain.ts` reports one trailing-space violation at source line 123:
`return -reduction; `. A future Phase 6F copy should either:

1. remove only that trailing space in the destination copy and record the
   normalized destination hash, or
2. clean the same whitespace in `ntn-sim-core` first and then copy exactly from
   the cleaned source commit.

No dependency, kill-switch, alias, or runtime-adoption blocker was found for
the narrow docs-audited slice.

## 2. Evidence Read

Required local documents read:

1. `/home/u24/papers/AGENTS.md`
2. `AGENTS.md`
3. `docs/modqn-baseline-live-integration-mini-sdd.md`
4. `docs/modqn-baseline-phase6c-channel-sinr-vendor-readiness.md`
5. `docs/modqn-baseline-phase6d-channel-leaf-vendor.md`

Cross-repo authority read because this is cross-repo audit work:

1. `/home/u24/papers/ntn-showcase-stack/README.md`
2. `/home/u24/papers/ntn-showcase-stack/AGENTS.md`
3. `/home/u24/papers/ntn-showcase-stack/docs/repo-roles.md`
4. `/home/u24/papers/ntn-showcase-stack/docs/artifact-contract-v1.md`
5. `/home/u24/papers/ntn-sim-core/AGENTS.md`
6. `/home/u24/papers/ntn-sim-core/agent-governance.md`
7. `/home/u24/papers/ntn-sim-core/sdd/README.md`

Source HEAD observed in `ntn-sim-core`:

`54b44159084fca606afc90ad104b1ddbf23844fc`

Source worktree note: `ntn-sim-core` was dirty during this audit, but
`git status --short -- src/core/common/constants.ts
src/core/channel/beam-gain.ts` and `git diff --
src/core/common/constants.ts src/core/channel/beam-gain.ts` showed no
source-side diff for the audited candidates.

Destination worktree note: `leo-beam-sim` was already dirty before this audit.
This phase adds only this Markdown file.

## 3. Source Dependency Map

| Source path in `ntn-sim-core` | Direct imports | Exports used by future slice | Dependency ceiling |
| --- | --- | --- | --- |
| `src/core/common/constants.ts` | none | `EARTH_RADIUS_KM` plus other common physical constants. | Leaf common constants only. No channel, orbit, profile, runtime, or UI dependency. |
| `src/core/channel/beam-gain.ts` | `EARTH_RADIUS_KM` from `@/core/common/constants`; type `BeamGainInput` from `./types` | `computeBeamGain()`, `computeOffAxisAngle()`. | Depends only on the common constants file, the already-vendored Phase 6D channel type surface, and `Math`. |

Destination alias support:

1. `tsconfig.json` maps `@/*` to `./src/*`.
2. `vite.config.ts` maps `@` to `path.resolve(__dirname, './src')`.
3. `src/core/common/constants.ts` does not currently exist in
   `leo-beam-sim`; Phase 6F must add it with the beam-gain copy.

Dependency ceiling for Phase 6F:

1. Do not vendor `link-budget.ts`, `shadow-fading.ts`,
   `small-scale-fading.ts`, `los-probability.ts`, `doppler.ts`,
   `slant-range.ts`, `index.ts`, model wrappers, or engine channel helpers in
   the same slice.
2. Do not touch `src/engine/signal`, `src/engine/handover`,
   `src/scene/useSimulation.ts`, `src/profiles`, UI controls, producer
   artifacts, replay behavior, or MODQN policy behavior.
3. Keep this slice as provenance and fixture-validated leaf math only.

## 4. Kill-Switch Audit

The inspected candidates do not contain active imports of React, React DOM,
Three.js, `@react-three`, `viz/`, `app/`, browser APIs, canvas, WebGL, scene
code, or `.tsx` files.

The only React/Three/scene wording found in the dependency surface was the
existing governance comment in `src/core/channel/types.ts` saying that such
imports are forbidden. That file is already the Phase 6D vendored type
dependency and is not a new Phase 6F source candidate.

Kill-switch stop conditions for Phase 6F:

1. Stop if source `constants.ts`, `beam-gain.ts`, or the required
   `types.ts` dependency gains React, Three.js, browser API, `viz/`, `app/`,
   `scene`, or `.tsx` dependencies before copy.
2. Stop if Phase 6F expands into link-budget, fading, LOS, Doppler,
   slant-range, model wrappers, engine channel behavior, or runtime adoption.
3. Stop if the copy attempts to relabel Leo's current local HOBS/SINR behavior
   as source-backed MODQN replay evidence.

## 5. Source Diff And Whitespace Decision

Source candidate hashes at
`54b44159084fca606afc90ad104b1ddbf23844fc`:

| Source path | SHA-256 of current source file |
| --- | --- |
| `/home/u24/papers/ntn-sim-core/src/core/common/constants.ts` | `4054c6e70979539843f3216ef5e31e6876715b40464fee2d7332ddaaa0f0ab7a` |
| `/home/u24/papers/ntn-sim-core/src/core/channel/beam-gain.ts` | `359f2d34c67755f9f77885ea64da817c7b3caad282305994c56094a768129813` |

Whitespace checks:

| Check | Result | Interpretation |
| --- | --- | --- |
| `git -C /home/u24/papers/ntn-sim-core diff --check -- src/core/common/constants.ts src/core/channel/beam-gain.ts` | Passed with no output. | The audited files have no current source-side diff from HEAD, so source diff whitespace is clean. |
| `git diff --no-index --check -- /dev/null /home/u24/papers/ntn-sim-core/src/core/common/constants.ts` | No whitespace findings. | Adding `constants.ts` exactly would not introduce whitespace errors. |
| `git diff --no-index --check -- /dev/null /home/u24/papers/ntn-sim-core/src/core/channel/beam-gain.ts` | Failed on source line 123: trailing whitespace. | Adding `beam-gain.ts` exactly would fail whitespace checks. |

Exact-copy decision: do not claim a byte-for-byte Phase 6F copy is
whitespace-clean unless the source repo first removes the trailing space. If
Phase 6F proceeds without source cleanup, it must document that the destination
copy normalizes only the line-123 trailing whitespace and must record the
destination hash after normalization.

## 6. Phase 6D Runtime Non-Adoption Check

Phase 6D remains a leaf channel helper slice. It is still not adopted into
runtime behavior.

Observed local state:

1. `src/core/channel/types.ts`, `src/core/channel/sinr.ts`, and
   `src/core/channel/fspl.ts` exist as Phase 6D vendored helpers.
2. `scripts/validate-modqn-phase6d-channel-leaf-vendor.ts` imports those
   helpers for validator fixtures and scans runtime paths for adoption.
3. A runtime scan of `src/engine/signal`, `src/engine/handover`,
   `src/scene/useSimulation.ts`, and `src/profiles` found no imports of
   `src/core/channel`, `channel/fspl`, `channel/sinr`, `channel/types`,
   `computeFspl`, or `computeSinr`.
4. `src/engine/signal/path-loss.ts` still has an existing local
   `computeFsplDb()` function; that is not an import or adoption of the Phase
   6D vendored `computeFspl()` helper.
5. Live signal behavior still uses the local HOBS/TR 38.811 runtime path under
   `src/engine/signal`.
6. Live handover behavior still uses the local HOBS handover path under
   `src/engine/handover`.

Conclusion: Phase 6D leaf helpers remain not adopted into live SINR,
interference, handover, association, profile, UI, replay, producer-artifact, or
MODQN policy behavior.

## 7. Claim Boundary Summary

The Phase 1 through Phase 6D claim boundaries remain unchanged:

1. `7` beams remains the accepted regenerated baseline MODQN evidence path.
2. `19` and `37` remain live sensitivity/demo extensions only.
3. `19` and `37` must not be described as trained baseline MODQN evidence.
4. Beam-gain vendoring alone must not be presented as live MODQN runtime
   adoption.
5. HOBS/SINR live simulator behavior must not be labeled MODQN replay
   evidence.
6. Paper baseline signal evidence is SNR-like; source-backed live SINR with
   interference must be labeled separately if adopted in a later phase.
7. Display-only transforms must not alter SINR/SNR, interference terms,
   handover events, policy decisions, rewards, deterministic IDs, masks, or
   provenance.

## 8. Required Validators For Future Vendoring

Minimum source-side gates before Phase 6F copies files:

1. `npm run validate:core-purity` in `/home/u24/papers/ntn-sim-core`
2. `npm run validate:golden-channel` in `/home/u24/papers/ntn-sim-core`
3. `git diff --check -- src/core/common/constants.ts
   src/core/channel/beam-gain.ts` in `/home/u24/papers/ntn-sim-core`
4. no-index add-copy whitespace checks for both candidate files
5. source HEAD, source diff status, and source hashes recorded in the Phase
   6F implementation doc

Minimum destination-side gates after a future Phase 6F copy:

1. a new `npm run validate:modqn:phase6f-beam-gain-vendor` validator that
   checks copied hashes, import purity, deterministic `computeBeamGain()` and
   `computeOffAxisAngle()` fixtures, and runtime non-adoption;
2. `npm run validate:modqn:phase6d-channel-leaf-vendor`;
3. `npm run lint`;
4. unsupported `19` / `37` trained-baseline claim scan;
5. `git diff --check`;
6. no-index whitespace check for any new untracked files before they are
   staged or committed.

KPI gates are not required for a no-runtime-adoption beam-gain leaf copy. KPI
baselines become required before any later behavior-changing channel,
link-budget, engine, association, handover, or policy adoption. At minimum,
that later behavior phase must record the relevant frozen `ntn-sim-core`
baseline KPI file before porting and prove no drift after porting.

Do not update the cross-repo Module Vendor Log during Phase 6E. Update it only
in a future phase that actually vendors source.

## 9. Deviations And Blockers

Phase 6E deviations:

1. None. This phase is docs-only and does not vendor source or update package
   scripts, profiles, UI, artifacts, runtime behavior, or vendor logs.

Current blockers:

1. No behavioral blocker was found for the narrow Phase 6F vendor slice.
2. Strict byte-for-byte exact vendoring is blocked by one trailing space in
   source `beam-gain.ts` line 123 unless the source repo is cleaned first.
3. `ntn-sim-core` and `leo-beam-sim` both have broader dirty worktrees, but
   the audited source candidate files are clean against source HEAD and this
   phase touches only this new doc.

## 10. Phase 6E Validation Results

Required validation for this docs-only audit:

| Check | Result |
| --- | --- |
| `git diff --check` | Passed with no output. |
| `git diff --no-index --check -- /dev/null docs/modqn-baseline-phase6e-beam-gain-vendor-readiness.md` | No whitespace findings. The command exits nonzero because `/dev/null` and the new file differ, not because of a whitespace error. |
| unsupported `19` / `37` trained-baseline claim scan | Passed. All hits were negated boundary statements such as "must not be described" or "not trained baseline MODQN evidence." |
| `git status --short` | Completed. The worktree was already dirty; the only Phase 6E file added by this audit is this doc. |
