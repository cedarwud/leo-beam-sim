# MODQN Baseline Phase 6F Beam Gain Vendor Slice

**Date:** 2026-05-12
**Status:** implementation and validation slice
**Target repo:** `/home/u24/papers/project/leo-beam-sim`
**Source repo:** `/home/u24/papers/ntn-sim-core`
**Scope:** source-owned beam-gain leaf math plus common constants only

Phase 6F vendors the beam-gain leaf slice identified by Phase 6E. It does not
adopt these helpers into live signal, handover, association, profiles, UI
controls, replay, producer artifacts, or MODQN policy behavior.

## Copied Source

Source commit:

`54b44159084fca606afc90ad104b1ddbf23844fc`

Copied source files:

| Source path | Destination path | Source SHA-256 | Destination SHA-256 | Copy status |
| --- | --- | --- | --- | --- |
| `/home/u24/papers/ntn-sim-core/src/core/common/constants.ts` | `src/core/common/constants.ts` | `4054c6e70979539843f3216ef5e31e6876715b40464fee2d7332ddaaa0f0ab7a` | `4054c6e70979539843f3216ef5e31e6876715b40464fee2d7332ddaaa0f0ab7a` | Exact copy. |
| `/home/u24/papers/ntn-sim-core/src/core/channel/beam-gain.ts` | `src/core/channel/beam-gain.ts` | `359f2d34c67755f9f77885ea64da817c7b3caad282305994c56094a768129813` | `66e789421dca47852e583ea960464cfa81ba0f7486d23cadd850654970fbeb98` | Source copy with one documented whitespace normalization. |

Exact normalization statement:

`src/core/channel/beam-gain.ts` differs from source only by removing the
trailing space on source line 123:

`return -reduction; ` became `return -reduction;`.

Source worktree note:

`ntn-sim-core` was dirty during Phase 6F validation, but
`git status --short -- src/core/common/constants.ts
src/core/channel/beam-gain.ts` and `git diff --
src/core/common/constants.ts src/core/channel/beam-gain.ts` showed no
source-side diff for the copied files.

## Kill-Switch Audit

The copied source files passed the Phase 6F kill-switch audit before copying:

1. `constants.ts` has no imports.
2. `beam-gain.ts` imports only `@/core/common/constants` and `./types`.
3. The already-vendored `types.ts` dependency has no imports.
4. No copied file imports React, React DOM, Three.js, `@react-three`, `viz/`,
   `app/`, `scene/`, browser APIs, canvas, WebGL, or `.tsx` files.

## Source Validation

Required validators were run in `/home/u24/papers/ntn-sim-core` before
copying:

| Command | Result |
| --- | --- |
| `npm run validate:core-purity` | Passed: `validate-core-purity (VAL-ARCH-001): OK`. |
| `npm run validate:golden-channel` | Passed: FSPL, Bessel beam gain, 3GPP shadow/clutter table, and multi-beam SINR checks all passed. |
| `git diff --check -- src/core/common/constants.ts src/core/channel/beam-gain.ts` | Passed with no output. |

Whitespace checks:

| Check | Result | Interpretation |
| --- | --- | --- |
| `git diff --no-index --check -- /dev/null /home/u24/papers/ntn-sim-core/src/core/common/constants.ts` | No whitespace findings. | Exact add-copy of `constants.ts` is whitespace-clean. |
| `git diff --no-index --check -- /dev/null /home/u24/papers/ntn-sim-core/src/core/channel/beam-gain.ts` | Failed on source line 123: trailing whitespace. | Exact add-copy of `beam-gain.ts` would fail whitespace validation. |
| `git diff --no-index --check -- /dev/null src/core/channel/beam-gain.ts` | No whitespace findings after normalization. | The destination copy is whitespace-clean after removing only the known trailing space. |

## Local Implementation

Added local validator:

`scripts/validate-modqn-phase6f-beam-gain-vendor.ts`

Added package script:

`npm run validate:modqn:phase6f-beam-gain-vendor`

The validator checks:

1. `constants.ts` source, destination, and expected SHA-256 values are equal;
2. `beam-gain.ts` source hash matches the audited source, destination hash
   matches the normalized copy, and destination differs only by removing the
   line-123 trailing space;
3. import surfaces remain:
   - `constants.ts`: no imports;
   - `beam-gain.ts`: `@/core/common/constants` and `./types` only;
4. kill-switch purity for copied files and the `types.ts` dependency;
5. deterministic `computeBeamGain()` fixtures across `flat-debug`,
   `rpsat-3gpp`, `itu-r`, `bessel-j1`, and `bessel-j1j3`;
6. deterministic `computeOffAxisAngle()` fixtures;
7. no adoption by `src/engine/signal`, `src/engine/handover`,
   `src/engine/association`, `src/scene/useSimulation.ts`, `src/profiles`,
   `src/ui`, or `src/modqn`; and
8. `7` remains baseline evidence path while `19` and `37` remain
   sensitivity/demo only.

## Runtime Adoption Boundary

Runtime adoption status: **not adopted**.

This phase intentionally does not edit:

1. `src/engine/signal/*`
2. `src/engine/handover/*`
3. `src/scene/useSimulation.ts`
4. `src/profiles/*`
5. UI controls
6. producer artifacts
7. replay or MODQN policy behavior

Live HOBS/SINR behavior still uses the existing local runtime path. The
vendored beam-gain helpers are available only for provenance, validation, and
future source-backed planning.

## Claim Boundary

This slice preserves the Phase 1 through Phase 6E boundaries:

1. `7` beams remains the accepted regenerated baseline MODQN evidence path.
2. `19` and `37` beams remain sensitivity/demo extensions only.
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

## Validation

Required destination validation for this change set:

1. `git diff --check`
2. `npm run validate:modqn:phase6d-channel-leaf-vendor`
3. `npm run validate:modqn:phase6f-beam-gain-vendor`
4. `npm run lint`
5. unsupported `19` / `37` trained-baseline claim scan
6. `git diff --check` in `/home/u24/papers/ntn-showcase-stack` after the
   Module Vendor Log update

Phase 6F validation results:

| Command | Result |
| --- | --- |
| `git diff --check` | Passed. |
| `npm run validate:modqn:phase6d-channel-leaf-vendor` | Passed. |
| `npm run validate:modqn:phase6f-beam-gain-vendor` | Passed. |
| `npm run lint` | Passed. |
| unsupported `19` / `37` trained-baseline claim scan | Passed through the Phase 6F validator. |
| `git diff --check` in `/home/u24/papers/ntn-showcase-stack` | Passed after the Module Vendor Log update. |

## Deviations And Blockers

Deviations:

1. `beam-gain.ts` is not a byte-for-byte copy because the destination removes
   only the known source trailing space on line 123.
2. No runtime, UI, replay, producer-artifact, or MODQN policy adoption was
   performed.

Blockers:

1. None for the Phase 6F leaf vendoring slice.
