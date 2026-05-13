# MODQN Baseline Base Adapter PR Readiness

**Date:** 2026-05-13
**Status:** `BASE_ADAPTER_PR_READY_PENDING_HUMAN_REVIEW`
**Target repo:** `/home/u24/papers/project/leo-beam-sim`
**Scope:** docs-only checkpoint for PR sequencing between the base adapter and
the later Phase 7 replay evidence demo

This checkpoint records a staging plan only. It does not stage files, commit,
push, reset, restore, regenerate bundles, copy producer artifacts, edit runtime
behavior, change UI behavior, recompute research truth, or start Phase 8.

## Review Status

Read-only sub-agent review was requested for dependency, claim-boundary, and
mixed-file review. All three sub-agent runs errored before producing findings
because the sub-agent usage limit was reached. The lead agent completed the
same review locally and kept the edit scope to this docs-only checkpoint.

The required PR order is:

1. Base adapter PR.
2. Phase 7 replay evidence demo PR.
3. Optional cleanup, runtime-adoption, or Phase 8 PRs.

## Base Adapter PR Scope

The base adapter PR should land before Phase 7 because the Phase 7 replay demo
depends on these earlier contract surfaces:

1. Phase 1 selected producer artifact and claim boundary.
2. Phase 2 replay-bundle parser and identity adapter.
3. Phase 3B vendored beam-layout truth slice.
4. Phase 4B producer-to-core beam-layout bridge.

Whole-file candidates for the base adapter PR:

1. `docs/modqn-baseline-live-integration-mini-sdd.md`
2. `docs/modqn-baseline-phase1-evidence-lock.md`
3. `docs/modqn-baseline-phase2-identity-adapter.md`
4. `docs/modqn-baseline-phase3a-beam-vendor-readiness.md`
5. `docs/modqn-baseline-phase3b-beam-layout-vendor.md`
6. `docs/modqn-baseline-phase4a-runtime-adoption-contract.md`
7. `docs/modqn-baseline-phase4b-beam-layout-bridge.md`
8. `docs/modqn-baseline-base-adapter-pr-readiness.md`
9. `scripts/validate-modqn-phase2-identity-adapter.ts`
10. `scripts/validate-modqn-phase3b-beam-layout.ts`
11. `scripts/validate-modqn-phase4b-beam-layout-bridge.ts`
12. `src/core/beam/layout.ts`
13. `src/core/beam/types.ts`
14. `src/modqn/replay-bundle/types.ts`
15. `src/modqn/replay-bundle/loader.ts`
16. `src/modqn/replay-bundle/identity.ts`
17. `src/modqn/replay-bundle/beam-layout-bridge.ts`

Patch-stage-only candidates for the base adapter PR:

1. `package.json`: stage only the Phase 2, Phase 3B, and Phase 4B script lines:
   `validate:modqn:phase2-identity-adapter`,
   `validate:modqn:phase3b-beam-layout`, and
   `validate:modqn:phase4b-beam-layout-bridge`.
2. `src/modqn/replay-bundle/index.ts`: stage only the base exports:
   `./types`, `./loader`, `./identity`, and `./beam-layout-bridge`.

Do not whole-file stage `src/modqn/replay-bundle/index.ts` for the base PR,
because it also contains Phase 7 exports for `./replay-state` and
`./playback-shell`.

## Phase 7 PR Scope

The later Phase 7 replay evidence demo PR should be staged only after the base
adapter PR is reviewed and landed.

Whole-file candidates for the Phase 7 PR:

1. `docs/modqn-baseline-phase7a-r1-evidence-input-invalidation.md`
2. `docs/modqn-baseline-phase7b-replay-live-adapter-contract.md`
3. `docs/modqn-baseline-phase7c-replay-state-model.md`
4. `docs/modqn-baseline-phase7d-replay-diagnostics.md`
5. `docs/modqn-baseline-phase7e-ui-mode-labeling.md`
6. `docs/modqn-baseline-phase7f-replay-playback-shell.md`
7. `docs/modqn-baseline-phase7g-replay-scene-cues.md`
8. `docs/modqn-baseline-phase7h-showcase-hardening.md`
9. `docs/modqn-baseline-phase7i-final-delivery-checkpoint.md`
10. `docs/modqn-baseline-phase7j-pr-readiness.md`
11. `scripts/validate-modqn-phase7c-replay-state-model.ts`
12. `scripts/validate-modqn-phase7d-replay-diagnostics.ts`
13. `scripts/validate-modqn-phase7e-ui-mode-labeling-browser.mjs`
14. `scripts/validate-modqn-phase7f-replay-playback-browser.mjs`
15. `scripts/validate-modqn-phase7g-replay-scene-cues-browser.mjs`
16. `scripts/validate-modqn-phase7h-showcase-hardening.mjs`
17. `src/modqn/replay-bundle/replay-state.ts`
18. `src/modqn/replay-bundle/playback-shell.ts`
19. `src/ui/ModeEvidenceStrip.tsx`
20. `src/ui/ModqnReplayPlaybackShell.tsx`
21. `src/ui/ModqnReplaySceneCues.tsx`

Patch-stage-only candidates for the Phase 7 PR:

1. `package.json`: stage only the Phase 7 script lines:
   `validate:modqn:phase7c-replay-state-model`,
   `validate:modqn:phase7d-replay-diagnostics`,
   `validate:modqn:phase7e-ui-mode-labeling`,
   `validate:modqn:phase7f-replay-playback-shell`,
   `validate:modqn:phase7g-replay-scene-cues`, and
   `validate:modqn:phase7h-showcase-hardening`.
2. `src/modqn/replay-bundle/index.ts`: stage only the Phase 7 export additions:
   `./replay-state` and `./playback-shell`.
3. `src/App.tsx`: stage only Phase 7 replay imports, replay display state,
   replay display-state change handler, and the three replay evidence UI
   insertions.
4. `src/styles/main.scss`: stage only the Phase 7 evidence strip, replay
   playback shell, replay scene cue, and directly required responsive layout
   rules.

`src/App.tsx` and `src/styles/main.scss` are broad product surfaces. Even
though the current hunks are Phase 7-oriented, they should remain patch-stage
review items rather than automatic whole-file staging targets.

## Explicit Exclusions

Exclude these from the base adapter PR:

1. All Phase 7 docs, validators, replay-state/playback-shell source, UI
   components, `src/App.tsx` hunks, `src/styles/main.scss` hunks, and Phase 7
   package-script lines.
2. All Phase 5 and Phase 6 docs, validators, fixtures, vendored channel files,
   runtime-adoption notes, signal/handover runtime surfaces, and channel KPI
   files.
3. `src/core/beam/frequency-reuse.ts`, because it is a later Phase 6B vendor
   surface, not part of the Phase 3B layout-only base.
4. `.gitignore`, `README.md`, `AGENTS.md`, `CLAUDE.md`,
   `scripts/validate-phase8b-path-loss-controls.tsx`, and any Phase 8 path-loss
   work.
5. Modified scene/runtime/UI/support files outside the base adapter:
   `src/scene/MainScene.tsx`, `src/scene/beam-layout.ts`,
   `src/scene/types.ts`, `src/scene/useBeamViz.ts`,
   `src/scene/useSimulation.ts`, `src/ui/DiagnosticsDrawer.tsx`,
   `src/ui/InfoPanel.tsx`, `src/ui/SignalTuningPanel.tsx`,
   `src/utils/beamFrequency.ts`, `src/scene/beamVizHelpers.ts`,
   `src/scene/panelState.ts`, `src/scene/runtimeFrameStep.ts`,
   `src/scene/simulationHelpers.ts`, `src/scene/useSimStatePublisher.ts`,
   `src/ui/info-panel/**`, and `src/ui/signal-tuning/**`.

Exclude these from the Phase 7 PR unless a human explicitly expands scope:

1. Phase 5 and Phase 6 runtime, channel, fixture, and KPI files.
2. `.gitignore`, `README.md`, `AGENTS.md`, `CLAUDE.md`, and Phase 8 path-loss
   files.
3. `docs/modqn-baseline-phase7a-integration-checkpoint.md`, which is
   Phase 7-adjacent but pre-R1 and should be a separate human-review decision.
4. Any producer artifact under `modqn-paper-reproduction`.
5. Any regenerated or generated artifact.

## Barrel And Package Recommendations

`src/modqn/replay-bundle/index.ts` is a mixed untracked barrel:

1. Base PR: stage `./types`, `./loader`, `./identity`, and
   `./beam-layout-bridge`.
2. Phase 7 PR: add `./replay-state` and `./playback-shell`.

`package.json` has one contiguous MODQN script hunk:

1. Base PR: stage only Phase 2, Phase 3B, and Phase 4B validation scripts.
2. Phase 7 PR: stage only Phase 7C through Phase 7H validation scripts.
3. Phase 5 and Phase 6 validation scripts stay out of both PRs unless a
   separate cleanup or vendor PR is opened.

## Validation Snapshot

The base adapter validation commands passed in this workspace on
2026-05-13:

1. `npm run validate:modqn:phase2-identity-adapter`
2. `npm run validate:modqn:phase3b-beam-layout`
3. `npm run validate:modqn:phase4b-beam-layout-bridge`
4. `npm run lint`

The selected producer artifact remains external and immutable:

`/home/u24/papers/modqn-paper-reproduction/artifacts/phase-1c-regenerated-7beam-baseline-2026-05-11/phase-03a-replay-bundle-v1`

Required producer surfaces for the selected path are:

1. `manifest.json`
2. `provenance-map.json`
3. `timeline/step-trace.jsonl`

## Claim Boundary

This checkpoint does not promote any new research claim.

Allowed:

1. The base adapter surfaces can parse and bridge the selected regenerated
   7-beam producer bundle after validation.
2. The base adapter preserves producer identity, reward, handover, diagnostics,
   ordering, and provenance boundaries.
3. The base adapter must land before Phase 7 replay evidence UI work.

Forbidden:

1. No recovered frozen artifact claim.
2. No full paper-faithful reproduction claim.
3. No 19-beam or 37-beam trained-baseline MODQN evidence claim.
4. No HOBS/SINR live output as MODQN replay evidence claim.
5. No EE, HEA, Catfish, Multi-Catfish, Catfish-over-HEA, or
   Catfish-over-HEA-on-HEA evidence claim.
6. No replay recomputation of SINR, handover, reward, geometry truth, MODQN
   action truth, diagnostics, or provenance.
