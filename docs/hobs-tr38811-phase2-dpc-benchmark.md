# HOBS + TR 38.811 Phase 2 DPC Benchmark

## Scope

This note records the first local performance benchmark for the promoted Phase 2
`beam-level power override / DPC` slice.

The benchmark isolates the incremental Phase 2 truth-path cost on the
research-profile fixture:

- `computeLinkBudget()` on the fixed multi-beam research snapshot
- per-frame `beamPowerOverrideDbmByKey` construction
- deterministic `updateBeamPowerControlStates()` bucket updates

The goal is not browser FPS. The goal is the incremental CPU cost of enabling
DPC bookkeeping on top of the already-landed Phase 1 `HOBS + TR 38.811` path.

## Command

Run from `project/leo-beam-sim/`:

```bash
npm run benchmark:hobs-tr38811-phase2:dpc
```

## Benchmark Configuration

- profile: `hobs-2024-tr38811-research`
- warmup batches: `40`
- measured batches: `200`
- frames per batch: `40`
- frame delta: `0.2 s`
- scene speed: `5x`
- simulated frame advance: `1.0 s`
- initial sim time: `60.2 s`

Because the simulated frame advance equals the DPC `updatePeriodSec`, the
benchmark exercises the research DPC path in its worst-case local cadence:
every measured frame crosses into a new power-control bucket.

## Result

`npm run benchmark:hobs-tr38811-phase2:dpc` passed.

Observed medians:

- research without DPC: `0.002400 ms`
- research with DPC: `0.003445 ms`
- relative delta: `+43.542%`
- absolute delta: `+0.001045 ms`

Observed p95:

- research without DPC: `0.009376 ms`
- research with DPC: `0.009447 ms`

Shared fixture density:

- median link samples: `4`
- median override count with DPC enabled: `4`

## Interpretation

The informative comparison here is:

- research path with DPC disabled in-memory
- research path with DPC enabled and bucket updates applied

This benchmark is intentionally narrower than the Phase 1 replay-window
benchmark. It isolates the added DPC bookkeeping instead of re-measuring the
entire scene envelope.

The relative delta looks large because the baseline fixture is extremely small:
the benchmark is only exercising a 4-link research snapshot. The more useful
interpretation is the absolute cost. On this local run, enabling DPC added
roughly `0.001 ms` per simulated frame in the isolated fixture path, which is
not a blocking runtime risk by itself.
