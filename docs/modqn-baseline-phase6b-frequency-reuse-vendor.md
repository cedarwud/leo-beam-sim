# MODQN Baseline Phase 6B Frequency Reuse Vendor Slice

**Date:** 2026-05-12
**Status:** implementation and validation slice
**Target repo:** `/home/u24/papers/project/leo-beam-sim`
**Source repo:** `/home/u24/papers/ntn-sim-core`
**Scope:** source-owned frequency-reuse helper only

Phase 6B vendors only the source-owned co-channel frequency-reuse helper from
`ntn-sim-core`. It does not adopt the helper into live SINR, interference,
handover, association, profile, UI, replay, or MODQN policy behavior.

## Copied Source

Source commit:

`54b44159084fca606afc90ad104b1ddbf23844fc`

Copied source file:

`/home/u24/papers/ntn-sim-core/src/core/beam/frequency-reuse.ts`

Destination file:

`src/core/beam/frequency-reuse.ts`

Copied source SHA-256:

`45c1f4e3d94e28d1acacfe4c9c17c0f1b6beb1cbbf1d3bff7a8b39099c841feb`

Source worktree note:

`ntn-sim-core` was dirty during Phase 6B validation, but the copied source file
had no source-side diff against the source commit.

## Kill-Switch Audit

The source file passed the Phase 6B kill-switch audit before copying:

1. No import statements.
2. No React, Three.js, `@react-three`, browser API, `viz/`, `app/`, or
   `scene/` dependency.
3. No dependency beyond the already vendored beam layout reuse-group array
   contract.

The only audit hit for React, Three.js, or scene wording was the source file's
own governance comment stating that those imports are forbidden.

## Source Validation

Required validators were run in `/home/u24/papers/ntn-sim-core` before
copying:

| Command | Result |
| --- | --- |
| `npm run validate:core-purity` | Passed: `validate-core-purity (VAL-ARCH-001): OK`. |
| `npm run validate:multibeam-gating` | Passed: active-beam determinism, serviceability gating, beam-hopping authored-order grouping, scheduler wiring, and bounded-steering checks all passed. |
| `npm run validate:golden-channel` | Passed: FSPL, Bessel beam gain, 3GPP shadow/clutter table, and multi-beam SINR order-of-magnitude checks all passed. |

## Local Implementation

Added local validator:

`scripts/validate-modqn-phase6b-frequency-reuse-vendor.ts`

Added package script:

`npm run validate:modqn:phase6b-frequency-reuse-vendor`

The validator imports the local vendored `generateHexagonalBeamLayout()`,
`getCoChannelBeams()`, and `expectedCoChannelCount()` helpers and checks:

1. `7`, `19`, and `37` beam layouts under FRF `1`, `3`, and `7`.
2. Co-channel sets exclude the serving beam.
3. Co-channel indices stay in range and remain numeric-index ordered.
4. Repeated calls are deterministic.
5. Co-channel membership exactly matches same-`reuseGroup` semantics from the
   vendored layout.
6. `expectedCoChannelCount()` is treated only as a helper heuristic for FRF
   `3` and `7`, where uneven hex group sizes make exact per-beam counts vary.
7. `src/engine/signal/*`, `src/engine/handover/*`,
   `src/scene/useSimulation.ts`, and `src/profiles/*` have not imported or
   consumed `src/core/beam/frequency-reuse.ts`.
8. `7` remains the accepted regenerated baseline MODQN evidence path, while
   `19` and `37` remain live sensitivity/demo extensions only.

## Runtime Adoption Boundary

Runtime adoption status: **not adopted**.

This phase intentionally does not edit:

1. `src/engine/signal/*`
2. `src/engine/handover/*`
3. `src/scene/useSimulation.ts`
4. `src/profiles/*`
5. UI controls

Live HOBS/SINR interference and handover behavior still use the existing local
runtime path. The vendored helper is available only for validation and future
source-backed planning.

## Claim Boundary

This slice preserves the Phase 1 through Phase 6A boundaries:

1. `7` beams remains the accepted regenerated baseline MODQN evidence path.
2. `19` and `37` beams remain sensitivity/demo extensions only.
3. `19` and `37` must not be described as trained baseline MODQN evidence.
4. HOBS/SINR live simulator behavior must not be labeled MODQN replay evidence.
5. Display-only reuse metadata must not alter SINR, interference, handover
   events, policy decisions, rewards, deterministic IDs, masks, or provenance.

## Validation

Required destination validation for this change set:

1. `git diff --check`
2. `npm run validate:modqn:phase3b-beam-layout`
3. `npm run validate:modqn:phase6b-frequency-reuse-vendor`
4. `npm run lint`
5. unsupported `19` / `37` trained-baseline claim scan
6. `git diff --check` in `/home/u24/papers/ntn-showcase-stack` after the
   Module Vendor Log update
