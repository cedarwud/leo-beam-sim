# MODQN Training Scene Producer Handoff Packet

## Status

Draft producer packet for `modqn-training-scene-trace-v1` on 2026-05-31.
This is a consumer-side handoff checklist for `modqn-paper-reproduction`; it
does not implement an exporter in `leo-beam-sim`.

## Authority

- Producer truth owner: `modqn-paper-reproduction`
- Validation oracle: `ntn-sim-core`
- Display consumer: `leo-beam-sim`
- Trace target: `modqn-training-scene-trace-v1`
- Display artifact target: `visual-showcase-v1`

The typed packet lives in
`src/modqn/training-scene-trace/producerHandoff.ts`. It is derived from the
40-field contract in `src/modqn/training-scene-trace/contract.ts`.

## Priority Meaning

| Priority | Meaning | Consumer behavior when absent |
|---|---|---|
| P0 required | Minimum producer trace fields for accepted single-model training-scene replay. | Reject the trace as not acceptable for producer-backed replay. |
| P1 source-gap allowed | Important scene surfaces that may be added incrementally. | Load the trace but fail closed on the affected UI surface with a canonical source gap. |
| P2 comparison-only | Required only when the artifact claims model-comparison replay. | Disable comparison replay; single-model replay may remain available. |

## P0 Required Fields

These fields must be producer-backed before a trace can be accepted as
`modqn-training-scene-trace-v1`:

- `provenance.schemaVersion`
- `provenance.runIdentity`
- `provenance.producerRevision`
- `provenance.artifactHashes`
- `provenance.claimBoundary`
- `provenance.seedSet`
- `environment.topology`
- `environment.scheduler`
- `environment.ueMobility`
- `environment.channelModel`
- `environment.objectiveWeights`
- `environment.handoverPenalty`
- `environment.algorithmFlags`
- `entities.satellites`
- `entities.beams`
- `entities.ues`
- `step.timeIndex`
- `step.focusUe`
- `step.previousServing`
- `step.selectedServing`
- `step.selectedAction`
- `step.decisionMasks`
- `step.activeBeamSchedule`
- `step.handoverEvent`
- `step.reward`
- `step.sourceGaps`

`step.activeBeamSchedule` is P0 because replay-proof active/inactive beam
state and beam-hopping animation cannot be inferred. `selectedServing`,
`previousServing`, `actionValidityMask`, and `decisionActionValidityMask` are
decision context only.

## P1 Source-Gap Allowed Fields

These fields should be exported as soon as the producer has them. Until then,
the trace may remain loadable if the producer or consumer emits the mapped
source gap and the UI fails closed:

- `environment.frequencyReuse`
- `entities.cells`
- `entities.models`
- `step.satelliteState`
- `step.beamFootprints`
- `step.allUePositions`
- `step.allUeServingHistory`
- `step.nextBeamSchedule`
- `step.angleAwareTerms`
- `step.energyEfficiencyTerms`
- `step.policyDiagnostics`

P1 fields do not authorize fake visuals. For example, missing
`step.nextBeamSchedule` disables next-beam preview; missing
`step.energyEfficiencyTerms` disables per-step EE claims.

## P2 Comparison-Only Fields

These fields are required only when the producer exports a model-comparison
artifact:

- `comparison.alignedTimebase`
- `comparison.perModelStreams`
- `comparison.aggregateMetrics`

The frontend may compute display deltas only from producer per-model values.
It must not align unrelated runs heuristically or compute research aggregate
metrics.

## Producer Export Packet

The exporter should produce:

1. `trace.json`
   - `schemaVersion: "modqn-training-scene-trace-v1"`
   - required sections from ADR-002: `run`, `provenance`, `environment`,
     `entities`, `timeline`, `sourceGaps`, and optional `comparison`
2. `manifest.json`
   - trace artifact ID, source repo commit, config hash, producer command,
     validation status, and claim boundary
3. `source-gaps.json`
   - missing P1/P2 fields, with canonical field IDs and claim impact
4. optional `visual-showcase-v1.json`
   - derived only after trace validation and only for a selected display
     replay window

## Validator Expectations

`validate:modqn:training-scene-producer-handoff` checks:

- every field in the 40-field trace contract appears in exactly one priority;
- P0 fields use `reject-trace-if-absent`;
- P1 fields use `accept-trace-with-source-gap` and have canonical source-gap
  mappings;
- P2 fields use `gate-comparison-feature`;
- active/next beam schedule fields do not list `selectedServing`,
  `previousServing`, `actionValidityMask`, or `decisionActionValidityMask` as
  producer paths.
