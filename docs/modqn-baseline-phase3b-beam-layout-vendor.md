# MODQN Baseline Phase 3B Beam Layout Vendor Slice

**Date:** 2026-05-12
**Status:** implementation and validation slice
**Target repo:** `/home/u24/papers/project/leo-beam-sim`
**Source repo:** `/home/u24/papers/ntn-sim-core`
**Scope:** beam-layout truth only

Phase 3B vendors the smallest beam-layout truth slice from `ntn-sim-core` into
`leo-beam-sim`. It does not switch scene/runtime behavior, expose UI controls,
copy producer artifacts, add replay playback, or migrate existing numeric beam
IDs in scene, signal, handover, or visualization surfaces.

## Copied Source

Source commit:

`54b44159084fca606afc90ad104b1ddbf23844fc`

Source worktree note:

`ntn-sim-core` was dirty during Phase 3B source validation, but the copied
source files had no diff against the source commit:

1. `/home/u24/papers/ntn-sim-core/src/core/beam/layout.ts`
2. `/home/u24/papers/ntn-sim-core/src/core/beam/types.ts`

Destination files:

1. `src/core/beam/layout.ts`
2. `src/core/beam/types.ts`

The source `src/core/beam/index.ts` was not copied because it re-exports beam
selection, active-beam manager, and scheduler surfaces that are outside this
layout-only slice.

## Source Validation

Required validators were run in `/home/u24/papers/ntn-sim-core` before copying:

| Command | Result |
| --- | --- |
| `npm run validate:core-purity` | Passed: `validate-core-purity (VAL-ARCH-001): OK`. |
| `npm run validate:multibeam-gating` | Passed: active-beam determinism, serviceability gating, beam-hopping authored-order grouping, scheduler wiring, and bounded-steering checks all passed. |

Kill-switch inspection:

1. `layout.ts` imports only `type { SatelliteBeamLayout, BeamDefinition } from './types'`.
2. `types.ts` has no imports.
3. The layout slice has no React, Three.js, `@react-three`, browser API,
   `viz/`, `app/`, scene, or runtime UI dependency.

## Local Implementation

Added local validator:

`scripts/validate-modqn-phase3b-beam-layout.ts`

Added package script:

`npm run validate:modqn:phase3b-beam-layout`

The validator imports the local vendored `generateHexagonalBeamLayout()` and
checks beam counts, zero-based ordered IDs, center beam placement, finite and
unique ENU offsets, `beamDiameterKm` and `altitudeKm` round-trip, `isActive`
defaults, FRF acceptance and rejection, reuse-group ranges, deterministic FRF
distributions, ring-complete counts for `7 / 19 / 37`, numeric-index output
order, and claim-boundary text.

## Destination Validation

Required destination validation for this change set:

| Command | Result |
| --- | --- |
| `npm run validate:modqn:phase3b-beam-layout` | Passed after the local validator landed. It checks the `7 / 19 / 37` layout invariants and claim-boundary text. |
| `git diff --check` | Passed with no output. |
| `npm run validate:modqn:phase2-identity-adapter` | Passed. The accepted 7-beam producer bundle still has 1000 timeline rows, 85 intra-satellite beam-switch rows, 915 no-event rows, and 0 observed inter-satellite handover rows. |
| `npm run lint` | Passed: `tsc --noEmit`. |

## Beam Layout Invariant Boundary

The local validator preserves these Phase 3B layout facts:

| Beam count | Ring radius | Claim boundary |
| ---: | ---: | --- |
| `7` | `1` | Accepted regenerated baseline MODQN evidence path from the selected producer artifact. |
| `19` | `2` | Live sensitivity/demo extension only. |
| `37` | `3` | Live sensitivity/demo extension only. |

Expected deterministic reuse-group distributions:

| Beam count | FRF | Distribution |
| ---: | ---: | --- |
| `7` | `3` | `{0: 1, 1: 3, 2: 3}` |
| `19` | `3` | `{0: 7, 1: 6, 2: 6}` |
| `37` | `3` | `{0: 13, 1: 12, 2: 12}` |
| `7` | `7` | `{0: 1, 1: 2, 2: 1, 5: 1, 6: 2}` |
| `19` | `7` | `{0: 3, 1: 2, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2}` |
| `37` | `7` | `{0: 3, 1: 5, 2: 5, 3: 7, 4: 7, 5: 5, 6: 5}` |

FRF 1 must produce only reuse group `0` for every supported count.

## Claim Boundary

This slice preserves the Phase 1 and Phase 2 boundaries:

1. `7` beams remains the accepted regenerated baseline MODQN evidence path.
2. `19` and `37` beams remain sensitivity/demo extensions only.
3. Vendoring layout truth does not create broader paper-faithful reproduction.
4. Vendoring layout truth does not create EE-MODQN, HEA-MODQN, Catfish,
   Multi-Catfish, Catfish-over-HEA, or energy-efficiency evidence.
5. The current accepted producer artifact remains immutable and has no observed
   inter-satellite handover rows.
6. Existing `src/scene/beam-layout.ts` runtime behavior remains unchanged.

## Phase 3C Handoff

Recommended next step is a separate controller-approved Phase 3C that updates
the cross-repo `ntn-showcase-stack` Module Vendor Log if this repo-local slice
does not perform that external doc edit, then plans runtime adoption separately.
Runtime adoption must explicitly map producer IDs, core layout IDs, and current
Leo numeric beam IDs before any `7 / 19 / 37` controls or behavior changes are
introduced.
