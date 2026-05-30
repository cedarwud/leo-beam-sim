# ADR-002: Use a Dedicated MODQN Training Scene Trace Artifact

## Status

Accepted

## Date

2026-05-30

## Context

`leo-beam-sim` needs to eventually replay the real multi-catfish,
angle-aware EE-MODQN training scene with producer-backed old/new serving
identity, focus UE, active/next beam schedules, angle-aware terms,
energy-efficiency terms, reward, handover penalty attribution, training-run
progress, and model comparison timelines.

The existing `visual-showcase-v1` contract is display-first. It is good at
offline replay windows: provenance, truth ownership, timebase, entities,
sampled frames, decisions, metrics, series, diagnostics, and display hints.
It is also already validated by `ntn-sim-core` and consumed by
`leo-beam-sim` as `artifact-replay`.

The current `phase-03a` MODQN replay bundle is narrower. It preserves a
focused-row replay proof with serving identity, masks, rewards, and optional
policy diagnostics, but it does not contain a scene-complete multi-UE
training trace. User-trained manifests add claim boundary, job/config/seed
context, and artifact pointers, but do not provide per-step replay truth.

For training-run replay and model comparison, the producer needs a trace
ledger, not only a 60-120 second display artifact.

## Decision

Define a dedicated producer-owned artifact target:

- `modqn-training-scene-trace-v1`

This trace is owned and emitted by `modqn-paper-reproduction`. It is the
source for training-run replay, user-trained replay trace enrichment, model
comparison replay, and any future bridge into a display artifact.

Keep `visual-showcase-v1` as the display/offline replay artifact:

- producer trace validation happens before display artifact derivation;
- `visual-showcase-v1` may be derived from a validated
  `modqn-training-scene-trace-v1` window;
- `leo-beam-sim` consumes validated artifacts and source gaps, but does not
  infer missing research truth.

The typed decision lives in
`src/modqn/training-scene-trace/artifactTarget.ts`. The handoff checklist is
the existing training scene trace requirement registry in
`src/modqn/training-scene-trace/contract.ts`.

## Required Producer Handoff

The producer trace must include the sections required by
`MODQN_TRAINING_SCENE_TRACE_REQUIRED_SECTIONS`:

- `schemaVersion`
- `run`
- `provenance`
- `environment`
- `entities`
- `timeline`
- `sourceGaps`
- `comparison`

The initial checklist is the 40-field consumer contract in
`MODQN_TRAINING_SCENE_TRACE_REQUIREMENTS`. Fields that remain unavailable must
be emitted as source gaps by the producer or preserved as consumer source gaps
by `leo-beam-sim`.

In particular, active/next beam schedule truth requires producer schedule
fields. `selectedServing`, `previousServing`, `actionValidityMask`, and
`decisionActionValidityMask` are decision context only and must not be used as
beam-hopping truth.

## Alternatives Considered

### Extend `visual-showcase-v1` Directly

Rejected for the first training-trace slice. `visual-showcase-v1` is a final
display replay artifact. Adding episode/checkpoint streams, per-model aligned
comparison streams, producer source gaps, and training-run ledger metadata
would mix display replay concerns with producer training-trace concerns.

### Infer Training Trace Inside `leo-beam-sim`

Rejected. `leo-beam-sim` is the renderer and interaction shell. It must not
create active schedules, reward terms, policy diagnostics, energy-efficiency
terms, or comparison alignment.

### Reuse the Phase-03A Replay Bundle as the Training Trace

Rejected. The current replay bundle is focused-row proof. It can support
baseline replay panels, but it does not carry full-scene all-UE state,
producer focus selection, active cell state, active/next beam schedule, or
comparison alignment.

## Consequences

- `modqn-paper-reproduction` gets a clear producer target for training-scene
  truth.
- `ntn-sim-core` remains the validation oracle for display artifacts and
  should host or mirror schema validation before `leo-beam-sim` consumes a
  trace as proof.
- `visual-showcase-v1` remains stable as the offline display replay contract.
- `leo-beam-sim` can build trace adapters later without changing viewport
  ownership or weakening source-gap policy.
- Existing source gaps remain valid until a producer trace closes them.

## Validation

- `validate:modqn:training-scene-artifact-target` checks this ADR, the SDD,
  the typed artifact decision, required sections, rejected alternatives, and
  schedule-truth guardrails.
- `validate:modqn:training-scene-trace-contract` checks the 40-field consumer
  requirement registry.
- `validate:modqn:training-scene-trace-inventory` checks current source
  coverage and keeps active/next schedule truth as source gaps.
