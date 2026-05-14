# MODQN Baseline Phase 6L Channel Index Vendor Slice

**Date:** 2026-05-12
**Status:** implementation and validation slice
**Target repo:** `/home/u24/papers/project/leo-beam-sim`
**Source repo:** `/home/u24/papers/ntn-sim-core`
**Scope:** channel barrel `index.ts` only

Phase 6L vendors only `src/core/channel/index.ts` after the exported channel
helpers from Phases 6D, 6F, 6H, 6J, and 6K are present locally. This phase
does not adopt the channel helpers into live runtime behavior.

## Copied Source

Source commit:

`54b44159084fca606afc90ad104b1ddbf23844fc`

Source diff status:

`git status --short -- src/core/channel/index.ts` produced no output, and
`git diff -- src/core/channel/index.ts` produced no output. The source barrel
was clean against source HEAD before copying.

Copied source file:

| Source path | Destination path | SHA-256 | Copy status |
| --- | --- | --- | --- |
| `/home/u24/papers/ntn-sim-core/src/core/channel/index.ts` | `src/core/channel/index.ts` | `a393bf18c5e19003b60fe1debb045bdde9ab2cfe4730b353fa9e0eea8b230b14` | Exact copy. |

Not copied:

1. `src/core/profiles/*`
2. runtime or engine channel files
3. `src/core/engine/channel-step.ts`
4. `src/core/engine/channel-sinr-helpers.ts`
5. runtime adoption files in signal, handover, scene, profiles, UI, or MODQN

## Kill-Switch Audit

The source `index.ts` passed the Phase 6L kill-switch audit before copying:

1. It has no import statements.
2. It exports only local `./types`, `./fspl`, `./shadow-fading`,
   `./beam-gain`, `./sinr`, `./link-budget`, `./small-scale-fading`, and
   `./doppler` modules.
3. Every exported module exists locally under `src/core/channel`.
4. It does not export `./los-probability`; the destination validator requires
   the destination barrel to match the source decision.
5. No executable code imports React, React DOM, Three.js, `@react-three`,
   `viz/`, `app/`, `scene`, profile, runtime, browser API, canvas, WebGL, or
   `.tsx` files.

## Source Validation

Required source validators were run in `/home/u24/papers/ntn-sim-core` before
copying:

| Command | Result |
| --- | --- |
| `git rev-parse HEAD` | `54b44159084fca606afc90ad104b1ddbf23844fc` |
| `git status --short -- src/core/channel/index.ts` | Passed with no output. |
| `git diff -- src/core/channel/index.ts` | Passed with no output. |
| `git diff --check -- src/core/channel/index.ts` | Passed with no output. |
| `npm run validate:core-purity` | Passed: `validate-core-purity (VAL-ARCH-001): OK`. |
| `npm run validate:golden-channel` | Passed: FSPL, Bessel beam gain, 3GPP shadow/clutter table, and multi-beam SINR checks all passed. |
| `npm run lint` | Passed. |

## Local Implementation

Added local validator:

`scripts/validate-modqn-phase6l-channel-index-vendor.ts`

Added package script:

`npm run validate:modqn:phase6l-channel-index-vendor`

The validator checks:

1. source and destination SHA-256 values match the audited source hash;
2. destination `index.ts` equals the source file exactly;
3. the barrel remains import-free and kill-switch clean;
4. every exported module resolves to an existing local vendored file;
5. `index.ts` does not export `./los-probability` unless the source barrel
   does;
6. profile, runtime, and engine channel-step/channel-SINR helper files were not
   copied;
7. no runtime adoption by signal, handover, scene, profiles, UI, or MODQN
   surfaces;
8. `7` remains the accepted regenerated baseline MODQN evidence path; and
9. `19` and `37` remain live sensitivity/demo extensions only.

Prior validator updates:

1. `scripts/validate-modqn-phase6h-pure-channel-remainder-vendor.ts`
2. `scripts/validate-modqn-phase6j-shadow-fading-vendor.ts`
3. `scripts/validate-modqn-phase6k-link-budget-vendor.ts`

Those validators now allow the later Phase 6L `src/core/channel/index.ts`
barrel copy while still forbidding `src/core/profiles/*` and runtime/engine
channel copies. Their profile/runtime/engine non-adoption checks were not
loosened.

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
vendored channel barrel is available only for provenance, validation, and
future source-backed planning.

## Claim Boundary

This slice preserves the Phase 1 through Phase 6K boundaries:

1. `7` beams remains the accepted regenerated baseline MODQN evidence path.
2. `19` and `37` beams remain live sensitivity/demo extensions only.
3. `19` and `37` must not be described as trained baseline MODQN evidence.
4. Channel barrel vendoring alone must not be presented as live MODQN runtime
   adoption.
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
7. `npm run validate:modqn:phase6l-channel-index-vendor`
8. `npm run lint`
9. unsupported `19` / `37` trained-baseline claim scan
10. `git diff --check` in `/home/u24/papers/ntn-showcase-stack` after the
    Module Vendor Log update

Phase 6L validation results:

| Command | Result |
| --- | --- |
| `git diff --check` | Passed. |
| `npm run validate:modqn:phase6d-channel-leaf-vendor` | Passed. |
| `npm run validate:modqn:phase6f-beam-gain-vendor` | Passed. |
| `npm run validate:modqn:phase6h-pure-channel-remainder-vendor` | Passed. |
| `npm run validate:modqn:phase6j-shadow-fading-vendor` | Passed. |
| `npm run validate:modqn:phase6k-link-budget-vendor` | Passed. |
| `npm run validate:modqn:phase6l-channel-index-vendor` | Passed. |
| `npm run lint` | Passed. |
| unsupported `19` / `37` trained-baseline claim scan | Passed through the Phase 6L validator. |
| `git diff --check -- README.md` in `/home/u24/papers/ntn-showcase-stack` | Passed. |

## Deviations And Blockers

Deviations:

1. None. `index.ts` is a byte-for-byte exact source copy.
2. No runtime, UI, replay, producer-artifact, profile, signal, handover, or
   MODQN policy adoption was performed.

Blockers:

1. None for the Phase 6L channel barrel vendoring slice.
