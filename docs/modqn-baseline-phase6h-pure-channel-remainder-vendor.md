# MODQN Baseline Phase 6H Pure Channel Remainder Vendor Slice

**Date:** 2026-05-12
**Status:** implementation and validation slice
**Target repo:** `/home/u24/papers/project/leo-beam-sim`
**Source repo:** `/home/u24/papers/ntn-sim-core`
**Scope:** pure channel leaf helpers only

Phase 6H vendors only the ready pure-channel leaf helpers identified by Phase
6G. It does not vendor shadow fading, link budget composition, channel barrel
exports, profile types, runtime engine channel files, UI controls, replay
artifacts, or MODQN runtime behavior.

## Copied Source

Source commit:

`54b44159084fca606afc90ad104b1ddbf23844fc`

Copied source files:

| Source path | Destination path | SHA-256 | Copy status |
| --- | --- | --- | --- |
| `/home/u24/papers/ntn-sim-core/src/core/channel/small-scale-fading.ts` | `src/core/channel/small-scale-fading.ts` | `9c16226b265a386c349d1052bed9b90351c112a0029d9a651fb9dd6cd49f0dc0` | Exact copy. |
| `/home/u24/papers/ntn-sim-core/src/core/channel/los-probability.ts` | `src/core/channel/los-probability.ts` | `1cac93ddc0c1d6f21252c1241f8f9680dbc072b0e7ca798bcbc065f4a6dff45d` | Exact copy. |
| `/home/u24/papers/ntn-sim-core/src/core/channel/doppler.ts` | `src/core/channel/doppler.ts` | `5aa97d8a056b463c6d2a0db00a38e34fca36841f7db0ac02b5f4a464a6f39f24` | Exact copy. |

Not copied:

1. `src/core/channel/shadow-fading.ts`
2. `src/core/channel/link-budget.ts`
3. `src/core/channel/index.ts`
4. `src/core/profiles/*`
5. runtime or engine channel files

Source worktree note:

`ntn-sim-core` was dirty during Phase 6H validation, but
`git status --short -- src/core/channel/small-scale-fading.ts
src/core/channel/los-probability.ts src/core/channel/doppler.ts` and
`git diff -- src/core/channel/small-scale-fading.ts
src/core/channel/los-probability.ts src/core/channel/doppler.ts` showed no
source-side diff for the copied files.

## Kill-Switch Audit

The copied source files passed the Phase 6H kill-switch audit before copying:

1. `small-scale-fading.ts` has no imports.
2. `los-probability.ts` imports only `DeploymentEnvironment` from `./types`.
3. `doppler.ts` has no imports.
4. No copied file imports React, React DOM, Three.js, `@react-three`, `viz/`,
   `app/`, browser APIs, canvas, WebGL, or `.tsx` files.
5. The only React, Three.js, or scene hits in the selected source files were
   governance comments stating that those imports are forbidden.

## Source Validation

Required source validators were run in `/home/u24/papers/ntn-sim-core` before
copying:

| Command | Result |
| --- | --- |
| `npm run validate:core-purity` | Passed: `validate-core-purity (VAL-ARCH-001): OK`. |
| `npm run validate:golden-channel` | Passed: FSPL, Bessel beam gain, 3GPP shadow/clutter table, and multi-beam SINR checks all passed. |
| `git diff --check -- src/core/channel/small-scale-fading.ts src/core/channel/los-probability.ts src/core/channel/doppler.ts` | Passed with no output. |

Whitespace checks:

| Check | Result | Interpretation |
| --- | --- | --- |
| `git diff --no-index --check -- /dev/null src/core/channel/small-scale-fading.ts` | No whitespace findings. | Exact add-copy is whitespace-clean; command exits nonzero because the files differ. |
| `git diff --no-index --check -- /dev/null src/core/channel/los-probability.ts` | No whitespace findings. | Exact add-copy is whitespace-clean; command exits nonzero because the files differ. |
| `git diff --no-index --check -- /dev/null src/core/channel/doppler.ts` | No whitespace findings. | Exact add-copy is whitespace-clean; command exits nonzero because the files differ. |

## Local Implementation

Added local validator:

`scripts/validate-modqn-phase6h-pure-channel-remainder-vendor.ts`

Added package script:

`npm run validate:modqn:phase6h-pure-channel-remainder-vendor`

The validator checks:

1. source and destination SHA-256 values match exactly for all copied files;
2. forbidden Phase 6H files were not copied;
3. import surfaces remain:
   - `small-scale-fading.ts`: no imports;
   - `los-probability.ts`: `./types` only;
   - `doppler.ts`: no imports;
4. copied files remain free of React, Three.js, browser API, `viz/`, `app/`,
   `scene`, and `.tsx` executable dependencies;
5. deterministic fixtures for `sampleShadowedRicianDb()` and `sampleLooDb()`
   with fixed RNG streams;
6. deterministic fixtures for `getLosProbabilityTr38811()` and
   `sampleLosStateTr38811()`;
7. deterministic fixtures for `computeDopplerShiftHz()`,
   `estimateRadialVelocityKmS()`, and `dopplerSinrDegradationDb()`;
8. no adoption by `src/engine/signal`, `src/engine/handover`,
   `src/scene/useSimulation.ts`, `src/profiles`, `src/ui`, or `src/modqn`;
9. `7` remains the accepted regenerated baseline MODQN evidence path; and
10. `19` and `37` remain live sensitivity/demo extensions only.

Note: `src/engine/signal/los-probability.ts` is a pre-existing local runtime
helper with matching LOS function names. Phase 6H does not replace it or import
from the new vendored `src/core/channel/los-probability.ts`.

## Runtime Adoption Boundary

Runtime adoption status: **not adopted**.

This phase intentionally does not edit or adopt behavior in:

1. `src/engine/signal/*`
2. `src/engine/handover/*`
3. `src/scene/useSimulation.ts`
4. `src/profiles/*`
5. `src/ui/*`
6. `src/modqn/*`
7. producer artifacts
8. replay or MODQN policy behavior

Live HOBS/SINR behavior still uses the existing local runtime path. The
vendored pure-channel helpers are available only for provenance, validation,
and future source-backed planning.

## Claim Boundary

This slice preserves the Phase 1 through Phase 6G boundaries:

1. `7` beams remains the accepted regenerated baseline MODQN evidence path.
2. `19` and `37` beams remain sensitivity/demo extensions only.
3. `19` and `37` must not be described as trained baseline MODQN evidence.
4. Pure-channel helper vendoring alone must not be presented as live MODQN
   runtime adoption.
5. HOBS/SINR live simulator behavior must not be labeled MODQN replay
   evidence.
6. Doppler degradation is not wired into live SINR in this phase.
7. Display-only transforms must not alter SINR/SNR, interference terms,
   handover events, policy decisions, rewards, deterministic IDs, masks, or
   provenance.

## Validation

Required destination validation for this change set:

1. `git diff --check`
2. `npm run validate:modqn:phase6d-channel-leaf-vendor`
3. `npm run validate:modqn:phase6f-beam-gain-vendor`
4. `npm run validate:modqn:phase6h-pure-channel-remainder-vendor`
5. `npm run lint`
6. unsupported `19` / `37` trained-baseline claim scan
7. `git diff --check` in `/home/u24/papers/ntn-showcase-stack` after the
   Module Vendor Log update

Phase 6H validation results:

| Command | Result |
| --- | --- |
| `git diff --check` | Passed. |
| `npm run validate:modqn:phase6d-channel-leaf-vendor` | Passed. |
| `npm run validate:modqn:phase6f-beam-gain-vendor` | Passed. |
| `npm run validate:modqn:phase6h-pure-channel-remainder-vendor` | Passed. |
| `npm run lint` | Passed. |
| unsupported `19` / `37` trained-baseline claim scan | Passed through the Phase 6H validator. |
| `git diff --check` in `/home/u24/papers/ntn-showcase-stack` | Passed after the Module Vendor Log update. |

Additional whitespace checks over the new untracked Phase 6H files and copied
source files produced no findings:

1. `scripts/validate-modqn-phase6h-pure-channel-remainder-vendor.ts`
2. `docs/modqn-baseline-phase6h-pure-channel-remainder-vendor.md`
3. `src/core/channel/small-scale-fading.ts`
4. `src/core/channel/los-probability.ts`
5. `src/core/channel/doppler.ts`

## Deviations And Blockers

Deviations:

1. None. All three copied helpers are byte-for-byte exact source copies.
2. No runtime, UI, replay, producer-artifact, profile, link-budget, shadow
   fading, index barrel, or MODQN policy adoption was performed.

Blockers:

1. None for the Phase 6H leaf vendoring slice.
