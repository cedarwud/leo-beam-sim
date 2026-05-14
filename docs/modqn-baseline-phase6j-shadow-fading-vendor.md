# MODQN Baseline Phase 6J Shadow Fading Vendor Slice

**Date:** 2026-05-12
**Status:** implementation and validation slice
**Target repo:** `/home/u24/papers/project/leo-beam-sim`
**Source repo:** `/home/u24/papers/ntn-sim-core`
**Scope:** cleaned shadow-fading leaf helper only

Phase 6J vendors only the cleaned `shadow-fading.ts` leaf helper after the
accepted Phase 6I source-side import cleanup. It does not vendor link-budget
composition, the channel barrel, profile types, runtime engine channel files,
UI controls, replay artifacts, or MODQN runtime behavior.

## Capability

Purpose:

Use the validated 3GPP TR 38.811 shadow-fading and clutter-loss table helper as
a source-backed local provenance/validation helper for future live-sim planning.

Donor source:

`/home/u24/papers/ntn-sim-core/src/core/channel/shadow-fading.ts`

Target owner:

`leo-beam-sim`, under `src/core/channel/shadow-fading.ts`.

Transfer mode:

Exact copy of the accepted Phase 6I cleaned source.

Dependencies:

Only `src/core/channel/types.ts`, already vendored in Phase 6D.

Fixture or oracle:

Destination validator fixtures cover `classifyBand()`,
`getShadowFadingParams()`, and `sampleShadowFading()` with deterministic
expected values.

Validation:

`npm run validate:modqn:phase6j-shadow-fading-vendor`

Known assumptions:

The source worktree carries the accepted Phase 6I scoped cleanup while source
HEAD remains `54b44159084fca606afc90ad104b1ddbf23844fc`.

Do not copy:

1. `src/core/channel/link-budget.ts`
2. `src/core/channel/index.ts`
3. `src/core/profiles/*`
4. runtime or engine channel files

## Copied Source

Source commit:

`54b44159084fca606afc90ad104b1ddbf23844fc`

Accepted Phase 6I source cleanup:

```diff
-import type { ShadowFadingParams } from './types';
-import type { DeploymentEnvironment } from '@/core/profiles/types';
+import type { DeploymentEnvironment, ShadowFadingParams } from './types';
```

Cleaned source SHA-256:

`b49b08a3dcbcdcdd2753b88cf809869054c603f89a39cbd96ee4943861626935`

Copied source file:

| Source path | Destination path | SHA-256 | Copy status |
| --- | --- | --- | --- |
| `/home/u24/papers/ntn-sim-core/src/core/channel/shadow-fading.ts` | `src/core/channel/shadow-fading.ts` | `b49b08a3dcbcdcdd2753b88cf809869054c603f89a39cbd96ee4943861626935` | Exact copy of cleaned Phase 6I source. |

Not copied:

1. `src/core/channel/link-budget.ts`
2. `src/core/channel/index.ts`
3. `src/core/profiles/*`
4. runtime or engine channel files

Source worktree note:

`ntn-sim-core` was dirty during Phase 6J validation. The relevant
`shadow-fading.ts` source-side diff is the accepted Phase 6I import cleanup
shown above, and the cleaned worktree file hash matches the recorded SHA-256.

## Kill-Switch Audit

The copied source file passed the Phase 6J kill-switch audit before copying:

1. `shadow-fading.ts` imports only `DeploymentEnvironment` and
   `ShadowFadingParams` from `./types`.
2. No `@/core/profiles/types` import remains.
3. The file does not import React, React DOM, Three.js, `@react-three`, `viz/`,
   `app/`, browser APIs, canvas, WebGL, or `.tsx` files.
4. The only React, Three.js, or scene hit in the selected source file is a
   governance comment stating those imports are forbidden.

## Source Validation

Required source validators were run in `/home/u24/papers/ntn-sim-core` before
copying:

| Command | Result |
| --- | --- |
| `git diff --check` | Passed with no output. |
| `git diff --check -- src/core/channel/shadow-fading.ts` | Passed with no output. |
| `npm run validate:core-purity` | Passed: `validate-core-purity (VAL-ARCH-001): OK`. |
| `npm run validate:golden-channel` | Passed: FSPL, Bessel beam gain, 3GPP shadow/clutter table, and multi-beam SINR checks all passed. |
| `npm run lint` | Passed. |

Whitespace check:

| Check | Result | Interpretation |
| --- | --- | --- |
| `git diff --no-index --check -- /dev/null src/core/channel/shadow-fading.ts` | No whitespace findings. | Cleaned `shadow-fading.ts` is add-copy clean; command exits nonzero because `/dev/null` and the source file differ. |

## Local Implementation

Added local validator:

`scripts/validate-modqn-phase6j-shadow-fading-vendor.ts`

Added package script:

`npm run validate:modqn:phase6j-shadow-fading-vendor`

The validator checks:

1. source and destination SHA-256 values match the cleaned source hash;
2. destination `shadow-fading.ts` equals the cleaned source exactly;
3. import surface remains only `./types`;
4. no `@/core/profiles/types` import remains;
5. `link-budget.ts`, `index.ts`, `src/core/profiles/*`, and runtime engine
   channel files were not copied;
6. copied file remains free of React, Three.js, browser API, `viz/`, `app/`,
   `scene`, and `.tsx` executable dependencies;
7. deterministic fixtures for `classifyBand()`;
8. deterministic fixtures for `getShadowFadingParams()`;
9. deterministic fixtures for `sampleShadowFading()`;
10. no adoption by `src/engine/signal`, `src/engine/handover`,
    `src/scene/useSimulation.ts`, `src/profiles`, `src/ui`, or `src/modqn`;
11. `7` remains the accepted regenerated baseline MODQN evidence path; and
12. `19` and `37` remain live sensitivity/demo extensions only.

`scripts/validate-modqn-phase6h-pure-channel-remainder-vendor.ts` was also
updated so the Phase 6H validator still validates the Phase 6H files while no
longer forbidding the later Phase 6J shadow-fading copy.

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
vendored shadow-fading helper is available only for provenance, validation, and
future source-backed planning.

## Claim Boundary

This slice preserves the Phase 1 through Phase 6H boundaries:

1. `7` beams remains the accepted regenerated baseline MODQN evidence path.
2. `19` and `37` beams remain sensitivity/demo extensions only.
3. `19` and `37` must not be described as trained baseline MODQN evidence.
4. Shadow-fading helper vendoring alone must not be presented as live MODQN
   runtime adoption.
5. HOBS/SINR live simulator behavior must not be labeled MODQN replay
   evidence.
6. Display-only transforms must not alter SINR/SNR, interference terms,
   handover events, policy decisions, rewards, deterministic IDs, masks, or
   provenance.

## Validation

Required destination validation for this change set:

1. `git diff --check`
2. `npm run validate:modqn:phase6h-pure-channel-remainder-vendor`
3. `npm run validate:modqn:phase6j-shadow-fading-vendor`
4. `npm run lint`
5. unsupported `19` / `37` trained-baseline claim scan
6. `git diff --check` in `/home/u24/papers/ntn-showcase-stack` after the
   Module Vendor Log update

Phase 6J validation results:

| Command | Result |
| --- | --- |
| `git diff --check` | Passed. |
| `npm run validate:modqn:phase6h-pure-channel-remainder-vendor` | Passed. |
| `npm run validate:modqn:phase6j-shadow-fading-vendor` | Passed. |
| `npm run lint` | Passed. |
| unsupported `19` / `37` trained-baseline claim scan | Passed through the Phase 6J validator. |
| `git diff --check` in `/home/u24/papers/ntn-showcase-stack` | Passed after the Module Vendor Log update. |

Additional whitespace checks over the new untracked Phase 6J files and copied
source file produced no findings:

1. `scripts/validate-modqn-phase6j-shadow-fading-vendor.ts`
2. `docs/modqn-baseline-phase6j-shadow-fading-vendor.md`
3. `src/core/channel/shadow-fading.ts`

## Deviations And Blockers

Deviations:

1. None. `shadow-fading.ts` is a byte-for-byte exact copy of the cleaned Phase
   6I source.
2. No runtime, UI, replay, producer-artifact, profile, link-budget, index
   barrel, or MODQN policy adoption was performed.

Blockers:

1. None for the Phase 6J shadow-fading vendoring slice.
