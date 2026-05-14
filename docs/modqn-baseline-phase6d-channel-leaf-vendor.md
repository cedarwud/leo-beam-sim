# MODQN Baseline Phase 6D Channel Leaf Vendor Slice

**Date:** 2026-05-12
**Status:** implementation and validation slice
**Target repo:** `/home/u24/papers/project/leo-beam-sim`
**Source repo:** `/home/u24/papers/ntn-sim-core`
**Scope:** source-owned channel leaf math only

Phase 6D vendors only the source-owned leaf channel math files identified by
Phase 6C. It does not adopt these helpers into live signal, handover,
association, profiles, UI controls, replay, producer artifacts, or MODQN policy
behavior.

## Copied Source

Source commit:

`54b44159084fca606afc90ad104b1ddbf23844fc`

Copied source files:

| Source path | Destination path | SHA-256 |
| --- | --- | --- |
| `/home/u24/papers/ntn-sim-core/src/core/channel/types.ts` | `src/core/channel/types.ts` | `6b6faa287c5affe9f35342da64e536e95658f13db7323fde0213c3b810ee4e84` |
| `/home/u24/papers/ntn-sim-core/src/core/channel/sinr.ts` | `src/core/channel/sinr.ts` | `b344fa62c9161b041acabf47145eff615cf4ba1678a7d7740126c41eb357788d` |
| `/home/u24/papers/ntn-sim-core/src/core/channel/fspl.ts` | `src/core/channel/fspl.ts` | `5bf7c1089d560be9dcfbcb2901fc57c9090b1af27ffef9cb3e4d082d0bbf2da1` |

Source worktree note:

`ntn-sim-core` was dirty during Phase 6D validation, but
`git diff -- src/core/channel/types.ts src/core/channel/sinr.ts
src/core/channel/fspl.ts` showed no source-side diff for the copied files.

## Kill-Switch Audit

The source files passed the Phase 6D kill-switch audit before copying:

1. `types.ts` has no imports.
2. `fspl.ts` has no imports.
3. `sinr.ts` has only one leaf-local type import: `SinrResult` from
   `./types`.
4. No copied file imports React, React DOM, Three.js, `@react-three`, `viz/`,
   `app/`, or `scene/` code.
5. No copied file uses browser APIs in executable code.

The only hits for React, Three.js, or scene wording were governance comments in
source files stating that those imports are forbidden.

## Source Validation

Required validators were run in `/home/u24/papers/ntn-sim-core` before
copying:

| Command | Result |
| --- | --- |
| `npm run validate:core-purity` | Passed: `validate-core-purity (VAL-ARCH-001): OK`. |
| `npm run validate:golden-channel` | Passed: FSPL, Bessel beam gain, 3GPP shadow/clutter table, and multi-beam SINR checks all passed. |

## Local Implementation

Added local validator:

`scripts/validate-modqn-phase6d-channel-leaf-vendor.ts`

Added package script:

`npm run validate:modqn:phase6d-channel-leaf-vendor`

The validator checks:

1. copied file SHA-256 values match the recorded source values;
2. import purity remains leaf-only;
3. `computeFspl()` matches independent deterministic formula fixtures;
4. `computeSinr()` matches independent deterministic linear-power fixtures;
5. `src/engine/signal/*`, `src/engine/handover/*`,
   `src/scene/useSimulation.ts`, and `src/profiles/*` have not imported or
   consumed `src/core/channel` leaf helpers;
6. `7` remains the accepted regenerated baseline MODQN evidence path; and
7. `19` and `37` remain live sensitivity/demo extensions only.

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
vendored channel helpers are available only for provenance, validation, and
future source-backed planning.

## Claim Boundary

This slice preserves the Phase 1 through Phase 6C boundaries:

1. `7` beams remains the accepted regenerated baseline MODQN evidence path.
2. `19` and `37` beams remain sensitivity/demo extensions only.
3. `19` and `37` must not be described as trained baseline MODQN evidence.
4. HOBS/SINR live simulator behavior must not be labeled MODQN replay
   evidence.
5. Paper baseline signal evidence is SNR-like; source-backed live SINR with
   interference must be labeled separately if adopted in a later phase.
6. Display-only transforms must not alter SINR/SNR, interference terms,
   handover events, policy decisions, rewards, deterministic IDs, masks, or
   provenance.

## Validation

Required destination validation for this change set:

1. `git diff --check`
2. `npm run validate:modqn:phase6b-frequency-reuse-vendor`
3. `npm run validate:modqn:phase6d-channel-leaf-vendor`
4. `npm run lint`
5. unsupported `19` / `37` trained-baseline claim scan
6. `git diff --check` in `/home/u24/papers/ntn-showcase-stack` after the
   Module Vendor Log update

Phase 6D validation results:

| Command | Result |
| --- | --- |
| `git diff --check` | Passed. |
| `npm run validate:modqn:phase6b-frequency-reuse-vendor` | Passed. |
| `npm run validate:modqn:phase6d-channel-leaf-vendor` | Passed. |
| `npm run lint` | Passed. |
| unsupported `19` / `37` trained-baseline claim scan | Passed through the Phase 6D validator. |
| `git diff --check` in `/home/u24/papers/ntn-showcase-stack` | Passed after the Module Vendor Log update. |
