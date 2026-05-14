# MODQN Baseline Phase 6K Link-Budget Vendor Slice

**Date:** 2026-05-12
**Status:** implementation and validation slice
**Target repo:** `/home/u24/papers/project/leo-beam-sim`
**Source repo:** `/home/u24/papers/ntn-sim-core`
**Scope:** channel link-budget composition helper only

Phase 6K vendors only `src/core/channel/link-budget.ts` after the direct
dependencies from Phases 6D, 6F, 6H, and 6J are present locally. It does not
vendor the channel barrel, profile types, runtime engine channel files, UI
controls, replay artifacts, signal behavior, handover behavior, or MODQN
policy behavior.

## Copied Source

Source commit:

`54b44159084fca606afc90ad104b1ddbf23844fc`

Source diff status:

The `ntn-sim-core` worktree was dirty during Phase 6K validation, but
`git diff -- src/core/channel/link-budget.ts` produced no output. The copied
file is clean against source HEAD at the audited commit.

Copied source file:

| Source path | Destination path | SHA-256 | Copy status |
| --- | --- | --- | --- |
| `/home/u24/papers/ntn-sim-core/src/core/channel/link-budget.ts` | `src/core/channel/link-budget.ts` | `06179394f7263291de3d6e26af8b11d44098433f7c8dc0a90ec2b53388278953` | Exact copy. |

Not copied:

1. `src/core/channel/index.ts`
2. `src/core/profiles/*`
3. runtime or engine channel files

## Kill-Switch Audit

The source `link-budget.ts` passed the Phase 6K kill-switch audit before
copying:

1. The import surface is only `./types`, `./fspl`, `./shadow-fading`,
   `./beam-gain`, and `./small-scale-fading`.
2. Every imported file already exists under local `src/core/channel`.
3. No executable code imports React, React DOM, Three.js, `@react-three`,
   `viz/`, `app/`, browser APIs, canvas, WebGL, or `.tsx` files.
4. The only React, Three.js, or scene hit in the source file is a governance
   comment stating those imports are forbidden.

## Source Validation

Required source validators were run in `/home/u24/papers/ntn-sim-core` before
copying:

| Command | Result |
| --- | --- |
| `git rev-parse HEAD` | `54b44159084fca606afc90ad104b1ddbf23844fc` |
| `git status --short` | Dirty worktree; `src/core/channel/link-budget.ts` was not listed. |
| `git diff -- src/core/channel/link-budget.ts` | Passed with no output. |
| `npm run validate:core-purity` | Passed: `validate-core-purity (VAL-ARCH-001): OK`. |
| `npm run validate:golden-channel` | Passed: FSPL, Bessel beam gain, 3GPP shadow/clutter table, and multi-beam SINR checks all passed. |
| `npm run lint` | Passed. |

## Local Implementation

Added local validator:

`scripts/validate-modqn-phase6k-link-budget-vendor.ts`

Added package script:

`npm run validate:modqn:phase6k-link-budget-vendor`

The validator checks:

1. source and destination SHA-256 values match the audited source hash;
2. destination `link-budget.ts` equals the source file exactly;
3. import surface remains only existing local channel helpers;
4. `src/core/channel/index.ts`, `src/core/profiles/*`, and runtime engine
   channel files were not copied;
5. copied file remains free of React, Three.js, browser API, `viz/`, `app/`,
   `scene`, and `.tsx` executable dependencies;
6. deterministic fixed fixtures for `computeLinkBudget()` cover Tier 0 only,
   NLOS shadow/clutter, Ka-band extended Shadowed-Rician, and Ka-band extended
   Loo NLOS composition;
7. no adoption by `src/engine/signal`, `src/engine/handover`,
   `src/scene`, `src/profiles`, `src/ui`, `src/modqn`, replay adapters, or
   runtime channel surfaces;
8. `7` remains the accepted regenerated baseline MODQN evidence path; and
9. `19` and `37` remain live sensitivity/demo extensions only.

`scripts/validate-modqn-phase6h-pure-channel-remainder-vendor.ts` and
`scripts/validate-modqn-phase6j-shadow-fading-vendor.ts` were updated so those
validators continue to validate their own copied files while no longer
forbidding the later Phase 6K `link-budget.ts` copy.

## Runtime Adoption Boundary

Runtime adoption status: **not adopted**.

This phase intentionally does not edit or adopt behavior in:

1. `src/engine/signal/*`
2. `src/engine/handover/*`
3. `src/scene/*`
4. `src/profiles/*`
5. `src/ui/*`
6. `src/modqn/*`
7. replay adapters or producer artifacts
8. MODQN policy behavior

Live HOBS/SINR behavior still uses the existing local runtime path. The
vendored link-budget helper is available only for provenance, validation, and
future source-backed planning.

## Claim Boundary

This slice preserves the Phase 1 through Phase 6J boundaries:

1. `7` beams remains the accepted regenerated baseline MODQN evidence path.
2. `19` and `37` beams remain sensitivity/demo extensions only.
3. `19` and `37` must not be described as trained baseline MODQN evidence.
4. Link-budget helper vendoring alone must not be presented as live MODQN
   runtime adoption.
5. HOBS/SINR live simulator behavior must not be labeled MODQN replay
   evidence.
6. Display-only transforms must not alter SINR/SNR, interference terms,
   handover events, policy decisions, rewards, deterministic IDs, masks, or
   provenance.

## Validation

Required destination validation for this change set:

1. `git diff --check`
2. `npm run validate:modqn:phase6d-channel-leaf-vendor`
3. `npm run validate:modqn:phase6f-beam-gain-vendor`
4. `npm run validate:modqn:phase6h-pure-channel-remainder-vendor`
5. `npm run validate:modqn:phase6j-shadow-fading-vendor`
6. `npm run validate:modqn:phase6k-link-budget-vendor`
7. `npm run lint`
8. unsupported `19` / `37` trained-baseline claim scan
9. `git diff --check` in `/home/u24/papers/ntn-showcase-stack` after the
   Module Vendor Log update

Phase 6K validation results:

| Command | Result |
| --- | --- |
| `git diff --check` | Passed. |
| `npm run validate:modqn:phase6d-channel-leaf-vendor` | Passed. |
| `npm run validate:modqn:phase6f-beam-gain-vendor` | Passed. |
| `npm run validate:modqn:phase6h-pure-channel-remainder-vendor` | Passed. |
| `npm run validate:modqn:phase6j-shadow-fading-vendor` | Passed. |
| `npm run validate:modqn:phase6k-link-budget-vendor` | Passed. |
| `npm run lint` | Passed. |
| unsupported `19` / `37` trained-baseline claim scan | Passed. |
| `git diff --check -- README.md` in `/home/u24/papers/ntn-showcase-stack` | Passed. |

## Deviations And Blockers

Deviations:

1. None. `link-budget.ts` is a byte-for-byte exact source copy.
2. No runtime, UI, replay, producer-artifact, profile, index barrel, signal,
   handover, or MODQN policy adoption was performed.

Blockers:

1. None for the Phase 6K link-budget composition helper vendoring slice.
