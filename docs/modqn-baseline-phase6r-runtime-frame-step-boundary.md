# MODQN Baseline Phase 6R Runtime Frame-Step Boundary

**Date:** 2026-05-12
**Status:** read-only guard validator
**Target repo:** `/home/u24/papers/project/leo-beam-sim`
**Decision:** `READ_ONLY_RUNTIME_FRAME_STEP_BOUNDARY_GUARD_ADDED`

Phase 6R adds a focused validator for the shared HOBS/SINR runtime frame-step
helper extracted in Phase 6Q. It does not change runtime behavior, adopt
vendored channel helpers, add UI, alter profiles, edit signal formulas, change
handover behavior, touch replay or producer artifacts, or modify MODQN policy
behavior.

Runtime adoption status: **not adopted**.

## Added Surface

1. `scripts/validate-modqn-phase6r-runtime-frame-step-boundary.ts`
2. `docs/modqn-baseline-phase6r-runtime-frame-step-boundary.md`
3. `package.json` script
   `validate:modqn:phase6r-runtime-frame-step-boundary`

## Guard Checks

The validator proves:

1. `src/scene/runtimeFrameStep.ts` has no React, R3F, Three.js, DOM, browser,
   UI, JSX/TSX, or app-shell dependency.
2. `src/scene/runtimeFrameStep.ts` does not import vendored
   `src/core/channel`, `core/channel`, or `@/core/channel`.
3. The shared helper still uses the existing HOBS/SINR engine path:
   `../engine/signal/link-budget` plus `HandoverManager`.
4. `src/scene/useSimulation.ts` imports and calls `stepRuntimeFrame()` and does
   not duplicate the pre-6Q frame-step loop.
5. The Phase 6P KPI validator imports the shared helper and does not recreate
   script-local link-budget, beam-scheduler, orbit, or handover-step logic.
6. Phase 6R surfaces are limited to guard script, short doc, and package
   script. No producer replay artifact, MODQN policy, UI, profile, signal
   formula, handover behavior, DPC behavior, beam-count control, or runtime
   channel adoption is changed by this phase.
7. Claim boundaries remain intact: `7` beams remains the accepted regenerated
   baseline MODQN evidence path, `19` and `37` remain sensitivity/demo only,
   and HOBS/SINR live output is not MODQN replay evidence.

## Non-Adoption Evidence

The guard scans these runtime surfaces for Phase 6R validator tokens and
vendored channel imports:

1. `src/engine/signal`
2. `src/engine/handover`
3. `src/scene`
4. `src/profiles`
5. `src/ui`
6. `src/modqn`
7. `src/App.tsx`
8. `src/signalTuning.ts`
9. `src/handoverPolicyTuning.ts`

Expected result: `PASS`. The guard is evidence that Phase 6R did not couple
runtime code to the validator and did not adopt source-backed channel helpers.

## Claim Boundary

Phase 6R establishes no new MODQN evidence.

1. `7` beams remains the accepted regenerated baseline MODQN evidence path.
2. `19` and `37` remain sensitivity/demo only and must not be described as
   trained baseline MODQN evidence.
3. HOBS/SINR live output is not MODQN replay evidence.
4. Channel-adapter, HOBS/SINR KPI, and runtime frame-step guard validators do
   not create MODQN policy, reward, training, replay, or producer evidence.
5. EE-MODQN, HEA-MODQN, Catfish, Multi-Catfish, Catfish-over-HEA,
   Catfish-family effectiveness, and physical energy-saving claims remain
   non-scope.

## Validation

Required local validation:

1. `git diff --check`
2. `npm run validate:modqn:phase6r-runtime-frame-step-boundary`
3. `npm run validate:modqn:phase6p-hobs-sinr-kpi-baseline`
4. `npm run validate:modqn:phase6o-channel-adapter-parity`
5. `npm run lint`
6. unsupported 19/37 trained-baseline claim scan over changed files and MODQN
   phase docs
7. `git status --short`

Browser smoke is intentionally not run because Phase 6R has no browser-visible
runtime, scene, label, panel, or control behavior change.

## Recommended Phase 6S Scope

Recommended Phase 6S scope is still no runtime adoption unless a separate gate
is explicitly opened. If Phase 6S opens channel runtime adoption, it should
start with before/after Phase 6P KPI drift gates, an explicit source-backed
channel-adoption evidence record, and UI/replay labels that keep HOBS/SINR live
output separate from MODQN replay evidence.
