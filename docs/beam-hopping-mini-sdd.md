# Beam Hopping Mini-SDD

## 1. Purpose

This note defines the minimum design contract required before implementing
beam hopping in `leo-beam-sim`.

The current repository already simulates:

- LEO satellite visibility and motion
- per-beam SINR
- intra-satellite beam switching
- inter-satellite handover
- 3D event-focused visualization

What it does **not** yet implement as a first-class simulation feature is
time-slot-driven beam hopping. The current "hopping" behavior in the UI is a
visual heuristic in `src/scene/useBeamViz.ts`; it is not the simulation source
of truth.

This mini-SDD exists to prevent a second round of UI-only hopping logic.

## 2. Scope

### 2.1 Goals

- Make beam hopping part of simulation truth, not only visualization.
- Define a deterministic slot scheduler for each satellite.
- Make beam availability affect service, SINR, and interference.
- Preserve the distinction between:
  - intra-satellite beam switch
  - inter-satellite handover
  - beam hopping schedule
- Add UI that explains slot state clearly enough for debugging and demos.

### 2.2 Non-Goals for Phase 1

- No ML- or queue-optimization scheduler.
- No traffic-demand estimation from external data.
- No full MAC-layer throughput or packet simulation.
- No claim that the initial scheduler is paper-faithful to HOBS.

Phase 1 is a rule-based beam hopping baseline that integrates correctly with the
existing simulator architecture.

## 3. Core Definitions

### 3.1 Beam Hopping

Beam hopping means a satellite has more candidate beam cells than it can
illuminate simultaneously, so it activates only a subset during each time slot
and rotates that active subset over time.

The key property is **time-varying service availability** per ground cell.

### 3.2 Beam Switching

Beam switching means the UE changes from one beam to another beam on the same
satellite because another beam is better.

This is already modeled by the current handover engine as `intra-switch`.

### 3.3 Handover

Handover means the UE changes its serving satellite.

This is already modeled by the current handover engine as `inter-handover`.

### 3.4 Required Separation

The simulator must treat these as three different layers:

1. scheduler chooses which beams are active in the current slot
2. signal engine evaluates only beams that are active and visible
3. handover engine chooses among currently serviceable beams

The handover engine must not invent beams that the scheduler did not activate.

## 4. Design Principles

### 4.1 Source of Truth Order

For beam hopping behavior, prefer this authority order:

1. profile and runtime beam hopping config
2. scheduler output for the current slot
3. signal engine results based on active beams
4. handover decisions based on signal results
5. visualization of the above

Visualization must never be the source of truth for active-beam state.

### 4.2 Determinism

Given the same profile, replay epoch, replay offset, and runtime config, the
beam hopping schedule must be deterministic.

### 4.3 Explainability

Each visible active beam should be explainable as:

- active because scheduled in slot `k`
- inactive because not selected in slot `k`
- unavailable because outside steering or coverage limits

## 5. Proposed Architecture

```
Profile + RuntimeConfig
        |
        v
Beam Hop Scheduler
        |
        v
Active Beam Set Per Satellite / Slot
        |
        v
Signal / Link Budget
        |
        v
Handover Engine
        |
        v
Visualization + Debug UI
```

### 5.1 Module Boundaries

- `useSimulation`
  - owns slot time, scheduler execution, active beam state, signal computation,
    and handover input/output
- `useBeamViz`
  - renders scheduler state already decided by simulation
- `InfoPanel` and future beam hopping panels
  - expose slot/debug state

### 5.2 Current Gap

Today, the simulator builds candidate beam cells in `useSimulation`, but
"hopping" auxiliary beams are selected later in `useBeamViz`. That means the UI
can show a hopped beam that does not actually participate in service or
interference. Phase 1 must remove that split-brain behavior.

## 6. Data Model

### 6.1 Profile Additions

Add a `beamHopping` section to profile JSON.

```ts
interface BeamHoppingConfig {
  enabled: boolean;
  slotSec: number;
  maxActiveBeamsPerSlot: number;
  scheduler: 'round-robin' | 'distance-priority';
  frameLengthSlots: number;
}
```

Recommended Phase 1 defaults:

- `enabled: false` for legacy profiles
- `slotSec: 0.75`
- `maxActiveBeamsPerSlot: 4`
- `scheduler: 'round-robin'`
- `frameLengthSlots: perSatelliteBeamCount`

### 6.2 Runtime State

Add scheduler state to `SimFrame`.

```ts
interface SatBeamHopState {
  satId: string;
  slotIndex: number;
  frameSlotIndex: number;
  activeBeamIds: number[];
  candidateBeamIds: number[];
}

interface SimFrame {
  ...
  beamHopSlotIndex: number;
  beamHopSlotStartSec: number;
  beamHopSlotSec: number;
  beamHopStatesBySatId: Map<string, SatBeamHopState>;
}
```

### 6.3 Visualization State

`VizFrame` should consume, not invent, scheduler output.

```ts
interface BeamTarget {
  beamId: number;
  ...
  isScheduledActive: boolean;
  isServing: boolean;
  isPrimary: boolean;
}
```

## 7. Scheduling Model

### 7.1 Phase 1 Scheduler

Use a deterministic per-satellite scheduler.

For each visible satellite:

1. generate serviceable beam cells from current geometry and steering limits
2. rank candidate beams
3. choose at most `maxActiveBeamsPerSlot`
4. expose only the selected beams as active for this slot

### 7.2 Phase 1 Ranking Policy

Two supported policies are enough initially:

- `round-robin`
  - fairness-oriented baseline
  - rotate through candidate beam ids in a deterministic order
- `distance-priority`
  - keeps beams closest to UE active more often
  - useful when showing how service remains concentrated near the UE

The default should be `round-robin`, because it makes slot behavior easier to
understand and debug.

### 7.3 Slot Semantics

- `slotIndex = floor(simTimeSec / slotSec)`
- all satellites share the same global slot clock
- per-satellite schedule may be phase-shifted deterministically by `satId`
- slot transitions occur inside `useSimulation`, not inside `useBeamViz`

## 8. Signal and Service Model

### 8.1 Candidate vs Active

The simulator must distinguish between:

- candidate beams
  - geometrically valid and potentially serviceable
- active beams
  - candidate beams selected by the scheduler for the current slot

Only active beams are passed to link budget and interference evaluation.

### 8.2 Link Budget Impact

`computeLinkBudget` should evaluate:

- serving and candidate SINR only for scheduled active beams
- interference only from scheduled active beams

Inactive beams should have no service contribution in that slot.

### 8.3 Service Availability Impact

If the currently serving beam is not scheduled active in the current slot, the
simulator must choose one explicit behavior. Phase 1 should use:

- service unavailable for that slot unless another active beam on the same
  satellite or a different satellite becomes the serving beam through the normal
  decision logic

This keeps the model simple and makes beam hopping visible in the state machine.

## 9. Handover Interaction

### 9.1 Input Constraint

The handover manager may only see active beams.

### 9.2 Intra-Satellite Beam Switching

An intra-switch remains legal only if the target beam is active in the current
slot.

### 9.3 Inter-Satellite Handover

An inter-satellite handover remains legal only if the target satellite has at
least one active candidate beam satisfying the offset and trigger conditions.

### 9.4 Debug Requirement

When a handover or intra-switch cannot happen because a beam is inactive, the
UI/debug reason should say so explicitly.

## 10. UI Requirements

### 10.1 Minimum New UI

Add one lightweight beam hopping debug panel or section showing:

- current slot index
- slot duration
- serving satellite active beam ids
- pending target satellite active beam ids
- whether the serving beam is active this slot

### 10.2 3D Scene Requirements

The 3D scene should visually distinguish:

- active scheduled beams
- inactive candidate beams, if shown at all
- serving beam
- pending target beam

If inactive beams are rendered for context, they must look clearly inactive.
They must not be visually equivalent to active beams.

### 10.3 Controls

Phase 1 does not need a full scheduler editor, but it should expose:

- beam hopping enabled/disabled
- slot duration
- scheduler type

These may begin as hardcoded runtime options if the state boundary is already in
place.

## 11. Rollout Plan

### Phase 1: Simulation Correctness

- add `beamHopping` config to profiles and runtime types
- move slot calculation into `useSimulation`
- compute `beamHopStatesBySatId`
- restrict active beam set passed into signal engine
- remove UI-only auxiliary hopping as a source of truth

### Phase 2: UI Explainability

- add beam hopping debug panel
- expose active vs inactive visual states in scene
- add basic runtime controls

### Phase 3: Scheduler Expansion

- add alternative ranking policies
- add cell-demand weighting
- add per-cell service metrics such as duty cycle or slot misses

## 12. Acceptance Criteria

Beam hopping Phase 1 is done only when all of the following are true:

1. changing the slot changes active beam sets in simulation, not only in UI
2. inactive beams no longer contribute to service or interference
3. handover decisions operate only on active beams
4. the UI can explain which beams are active in the current slot
5. `useBeamViz` no longer fabricates hopped beams independently of simulation

## 13. Immediate Next Implementation Tasks

Recommended first implementation order:

1. extend types in `src/profiles/types.ts` and `src/scene/types.ts`
2. add scheduler logic inside `src/scene/useSimulation.ts`
3. update `src/engine/signal/link-budget.ts` inputs if needed so only scheduled
   beams are evaluated
4. refactor `src/scene/useBeamViz.ts` to consume scheduler output
5. add a compact debug section to `src/ui/InfoPanel.tsx` or a dedicated
   beam-hopping panel

This order keeps the simulation truthful before polishing the visualization.
