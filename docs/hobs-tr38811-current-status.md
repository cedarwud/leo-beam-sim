# HOBS + TR 38.811 Current Status

## Purpose

This note is the high-level rollup for the `leo-beam-sim` HOBS + TR 38.811
upgrade path.

Use it when a future dialog needs to understand the current truth quickly
without reconstructing status from the mini-SDD, validation notes, benchmark
notes, and checkpoints.

## Current Recommendation

Treat the current implementation as **sufficient for the original goal**:

> make `project/leo-beam-sim` SINR behavior materially align with the
> `ntn-sim-core` HOBS + TR 38.811 research path

The current recommendation is to **stop here unless the goal expands from SINR
alignment into deeper power-allocation or platform-parity work**.

## What Is Landed

### Phase 1: Research-Grade Channel Baseline

Landed and locally validated:

- explicit research profile: `hobs-2024-tr38811-research`
- orthogonal `formulaFamily = 'hobs-tr38811'`
- runtime profile selector in the app UI
- `TR 38.811 Eq. (6.6-3)` slant range `d(alpha)`
- seeded suburban LOS probability
- additive NLOS clutter proxy for the research path
- explicit `I^a / I^b` interference split in the link-budget path
- additive formula-family disclosure in the info panel

### Phase 2 Slice: Beam-Level Power Override / DPC

Landed and locally validated:

- research-only `beamPowerControl` block on the research profile
- deterministic 1-second bucket DPC state update
- beam-level transmit-power override map consumed inside the signal path
- DPC state reset on profile change
- browser QA confirming profile switching and research-path disclosure remain
  stable after the DPC slice

## What This Means Practically

The simulator now has a bounded research path that is clearly distinct from the
demo-oriented legacy path:

- legacy/demo profiles remain `hobs-legacy`
- the research profile uses `HOBS + TR 38.811` channel closure
- the research path no longer assumes uniform beam power

This is already beyond a cosmetic "formula rewrite". The active research path
now covers the core signal-truth pieces that were missing at the start of the
upgrade effort.

## Evidence Map

### Design Authority

- `docs/hobs-tr38811-sinr-mini-sdd.md`

### Phase 1 Evidence

- `docs/hobs-tr38811-phase1-validation.md`
- `docs/hobs-tr38811-phase1-benchmark.md`

### Phase 2 DPC Evidence

- `docs/hobs-tr38811-phase2-dpc-validation.md`
- `docs/hobs-tr38811-phase2-dpc-benchmark.md`

### Runtime / Handoff Checkpoints

- `~/.gstack/projects/cedarwud-leo-beam-sim/checkpoints/20260421-203417-hobs-tr38811-phase1-baseline.md`
- `~/.gstack/projects/cedarwud-leo-beam-sim/checkpoints/20260421-205116-hobs-tr38811-phase2-dpc.md`

## Intentionally Deferred

These items are **not** required to say the SINR-alignment goal is complete:

- per-satellite `Pmax` normalization
- fuller energy-model coupling
- DAPS / dual connectivity
- Doppler ICI
- multi-UE geometry
- broader `ntn-sim-core` platform parity beyond the current signal path

These are valid future research/parity slices, but they are not the minimum
stop line for the original SINR-upgrade request.

## Suggested Stop Line

Unless a new requirement is introduced, the clean stop line is:

1. Phase 1 research channel baseline landed
2. Phase 2 DPC slice landed
3. validation, benchmark, and browser QA evidence recorded
4. current state committed and checkpointed

At that point, the repo can be described as having:

> a runtime-selectable, locally validated HOBS + TR 38.811 research SINR path
> with deterministic beam-level DPC, while preserving the existing
> demo-oriented legacy profiles

## If Work Resumes Later

Resume only if the goal changes to one of these:

- deeper HOBS-P / `ntn-sim-core` power-allocation parity
- energy-aware or normalized transmit-power policy
- a wider research program beyond SINR alignment

If work resumes, start from this note first, then open the mini-SDD and the
Phase 2 DPC checkpoint.
