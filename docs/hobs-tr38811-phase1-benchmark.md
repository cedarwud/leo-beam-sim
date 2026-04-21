# HOBS + TR 38.811 Phase 1 Benchmark

## Scope

This note records the first local performance benchmark for the Phase 1
`HOBS + TR 38.811` signal-path upgrade.

The benchmark mirrors the `useSimulation` frame core at the local harness
level:

- visible-satellite interpolation from cached trajectory samples
- pre-decision link-context build
- handover-manager update
- post-decision link-context build

The goal is not browser FPS. The goal is the CPU cost of the simulation truth
path that Phase 1 modified.

## Command

Run from `project/leo-beam-sim/`:

```bash
npm run benchmark:hobs-tr38811-phase1
```

## Benchmark Configuration

- epoch: `2026-01-01T00:00:00Z`
- warmup frames: `20`
- measured frames: `120`
- simulated render delta: `0.2 s`
- scene speed: `5x`
- dense-window start offset for formula-isolated pair: `1065 s`
- dense-window start offset for candidate-rich operational baseline: `450 s`

## Result

### Formula-Isolated Pair

This is the primary Phase 1 guardrail check because both profiles share the same
single-shell HOBS-oriented layout:

- baseline: `hobs-2024-paper-default`
- research: `hobs-2024-tr38811-research`

Observed medians:

- paper-default legacy median frame core: `0.180 ms`
- tr38811 research median frame core: `0.172 ms`
- formula delta: `-4.444%`

Guardrail:

- Phase 1 budget: `+25%`
- observed status: `within budget`

Breakdown medians:

- paper-default pre-context: `0.080 ms`
- paper-default decision: `0.004 ms`
- paper-default post-context: `0.079 ms`
- research pre-context: `0.077 ms`
- research decision: `0.002 ms`
- research post-context: `0.079 ms`

Shared scene density in this dense-window pair:

- visible satellites median: `45`
- link satellites median: `1`
- link samples median: `4`

### Operational Baseline Context

This is not the formula-only guardrail, but it provides runtime context versus
the current app default:

- baseline: `hobs-2024-candidate-rich`
- research: `hobs-2024-tr38811-research`

Observed medians:

- candidate-rich median frame core: `0.275 ms`
- research median frame core: `0.172 ms`
- operational delta: `-37.455%`

This is expected because `candidate-rich` still carries a broader multi-shell,
beam-hopping-heavy scene envelope than the single-shell research profile.

## Interpretation

The Phase 1 `TR 38.811` additions did not produce a measurable regression in the
formula-isolated benchmark. On this local run, the research path was slightly
faster than the legacy paper-default path, which means the current overhead of:

- `d(alpha)` slant-range closure
- seeded LOS sampling
- additive NLOS clutter branch
- explicit `I^a / I^b` split

is not a blocking performance risk for the current single-shell research slice.

## Outcome

No Phase 1 optimization slice was required after the first benchmark pass.
