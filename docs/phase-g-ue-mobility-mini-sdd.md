# Phase G UE Mobility Mini-SDD

Status: draft for Phase G (post Phase F v2 ship to branches).
Date: 2026-05-26
Owner: `leo-beam-sim` live-engine UE mobility model + per-tick UE position update.
Target repo: `/home/u24/papers/project/leo-beam-sim`.
Cross-repo dependencies: NONE.

## 0. Reading Order

Read before changing this SDD or starting implementation:

1. `.agent-memory/project_paper_faithful_vision.md` "Phase F v2 COMPLETE
   status" — Phase G branches off PR-γ2 (Phase F final). Phase G fills
   the explicit Phase F gap: "F-S1 ships with seeded generator
   producing reproducible positions; UE positions are recomputed when
   topology.ueCount changes [...] No recomputation on simulation tick
   — static positions in v1" (per Phase F SDD §4.2).
2. `.agent-memory/project_dev_drift_audit_2026-05-25.md` Rule 4 —
   mini-SDD 釘 priority 才開 slice; this SDD is the priority anchor for
   Phase G.
3. `docs/phase-f-live-multi-ue-generator-mini-sdd.md` §12 — explicit
   deferral "UE mobility (waypoints, random-walk, Manhattan model) —
   Phase G". Phase F treated UEs as static after generation; Phase G
   adds per-tick updates.
4. `src/engine/ue/multiUeState.ts` — Phase F's seeded generator. Phase G
   extends with mobility-step functions per mode.
5. `src/scene/runtimeFrameStep.ts` — Phase F's secondary-UE loop fills
   per-UE positions once. Phase G adds per-tick position-update step
   BEFORE the SINR/handover computation.
6. `src/sceneTopology.ts` — `SceneTopologyState` shape. Phase G adds
   `ueMobilityMode: UeMobilityMode | null` field.
7. `src/ui/signal-tuning/TopologyTab.tsx` — Phase G adds 5th sub-section
   in the existing tab (after UE distribution mode).
8. `src/profiles/types.ts` — `UeMobility` interface already exists
   (`type: 'waypoints'; waypoints: UeMobilityWaypoint[]; interpolation:
   'linear'`) but is currently unused by the live engine (only consumed
   by replay artifact for producer-baked positions). Phase G activates
   it for the primary UE; secondary UEs use a separate runtime mobility
   model.
9. `CLAUDE.md` §3 (artifact immutability) + §5 (boundaries). Phase G
   does NOT touch replay artifacts; replay multi-UE positions are
   producer-baked and immutable.

## 1. Purpose

Paper baseline (PAP-2024-MORL-MULTIBEAM): 100 UEs move during each
training episode — handover decisions depend on UE position changes
relative to the satellite constellation. Phase F shipped static UE
positions (positions generated once, then frozen for the simulation
session). Phase G adds per-tick mobility so UEs move and the handover
logic exercises realistic behavior.

Phase G ships:
- `UeMobilityMode = 'static' | 'random-walk' | 'waypoints' | 'manhattan'`.
- Per-tick UE position update inside the runtime loop (BEFORE the
  per-UE SINR/handover computation each frame).
- UI selector in the Topology tab next to UE distribution.
- Mobility parameters per mode (speed for random-walk, waypoint list
  for waypoints, grid spacing for manhattan).
- Primary UE stays static for backward compat with single-UE narratives
  (mobility applies to secondary UEs only). Optional toggle to enable
  primary UE mobility (deferred).

Phase G does NOT:
- Change replay-side mobility (artifact-baked positions immutable).
- Add per-UE mobility profile diversification (all secondary UEs follow
  the same selected mode in v1).
- Add explicit time-of-day or weather-driven mobility.
- Change SINR / handover compute logic (Phase F path stays — Phase G
  just updates the position inputs each tick).
- Touch MODQN training.

## 2. Authority and Boundaries

### 2.1 Owned by Phase G

- New `src/engine/ue/multiUeMobility.ts` (or extend existing
  `multiUeState.ts`) with per-mode mobility-step functions.
- Extension of `SceneTopologyState` with `ueMobilityMode` field.
- Per-tick position-update step in `runtimeFrameStep` ahead of the F-S2
  per-UE SINR loop.
- UI selector in TopologyTab.
- Mobility-state ref in `useSimulation` for stateful modes
  (random-walk needs prev direction; waypoints need current segment
  index).
- Documented amendment to
  `docs/sinr-runtime-parameter-contract.md` "UE Mobility (Phase G)"
  subsection.

### 2.2 Not owned by Phase G

- Primary UE mobility (defer to a future slice unless explicitly
  required).
- Mobility-aware MODQN policy inference (live policy gated by
  Phase 6W).
- Time-varying speed / direction within a single mobility mode.
- Per-UE mobility plan diversification.
- Mobility-driven handover prediction (Phase F's per-UE handover
  state machine handles handover as a reactive response; predictive
  handover is out of scope).

### 2.3 Hard bans

- Do NOT touch `src/showcase/showcaseArtifactToScene.ts` (replay path
  immutable).
- Do NOT change `FOOTPRINT_RADIUS_WORLD`.
- Do NOT add MODQN per-UE policy.
- Do NOT change primary UE position behavior in v1 (Phase F zero-drift
  preserved).
- Do NOT introduce new UI library / mobility-physics dep.

## 3. Current State

- `src/engine/ue/multiUeState.ts` (Phase F PR-χ + PR-β2): exports
  `generateUePositions` with 3 distribution modes. No mobility.
- `src/scene/runtimeFrameStep.ts` (Phase F PR-χ): fills
  `frame.perUePositions` once per frame from the generator. Positions
  ARE recomputed every frame today, but the generator is deterministic
  (same seed + same args → same output) so positions appear static.
- `src/sceneTopology.ts` (Phase F PR-π / PR-β2): `SceneTopologyState`
  has `ueCount`, `ueDistributionMode` fields. No `ueMobilityMode`.
- `src/profiles/types.ts:9-21` — `UeMobility` interface exists but
  is currently unused on live path.
- `src/ui/signal-tuning/TopologyTab.tsx` — has 26 testids (5 phases of
  sub-sections). Phase G adds a 6th sub-section.

## 4. Slice Plan

3 core slices + 1 optional. Naming continues numbered-suffix
convention from Phase F (Greek alphabet exhausted): `δ2`, `ε2`, `ζ2`
for cores; `η2` optional.

| Slice | Subject | Touches | Cross-repo? |
|---|---|---|---|
| PR-δ2 (G-S1) | UeMobilityMode type + per-tick position update + threading | new `src/engine/ue/multiUeMobility.ts`, `runtimeFrameStep` per-tick step, `sceneTopology` field, App→MainScene→useSimulation→runtimeFrameStep threading, validator | none |
| PR-ε2 (G-S2) | TopologyTab UE mobility mode selector UI + contract md amendment | extend TopologyTab with radio + reset + banner; amend `docs/sinr-runtime-parameter-contract.md`; validator | none |
| PR-ζ2 (G-S3) | Mobility parameters (random-walk speed, waypoint list, manhattan grid spacing) | extend `SceneTopologyState` with `ueMobilityParams`, generator functions consume params, UI slider/input controls, validator | none |
| PR-η2 (G-S4 OPTIONAL) | UE trail visualization (last N positions per UE rendered as a fading line) | new `src/viz/UeTrail.tsx`, `GroundScene` mounts, validator | none |

Each slice = 1 PR.

### 4.1 Mobility modes (G-S1)

- **static** (default): no per-tick update; positions stay as generated.
  Zero-drift with Phase F.
- **random-walk**: each tick, each secondary UE picks a random direction
  (uniform [0, 2π]) and steps a fixed distance. Speed default 5 km/sec
  in v1. Clamped inside primary footprint (reflect off boundary).
- **waypoints**: each UE assigned a circular tour of K waypoints
  (default K=4, randomly placed inside footprint). Interpolates
  linearly between waypoints. Speed default 5 km/sec.
- **manhattan**: UE position constrained to a grid of streets (NS/EW
  axis-aligned). Per tick, UE moves one grid step in the current
  heading; at intersections it turns randomly. Grid spacing default
  5 km. Speed default 5 km/sec.

All modes deterministic via Mulberry32 seed (per Phase F PR-β2 pattern).
Primary UE stays at origin in ALL modes (deferred to future slice).

### 4.2 Per-tick step

`runtimeFrameStep` adds a per-tick step BEFORE the F-S2 SINR loop:

```ts
if (ueMobilityMode && ueMobilityMode !== 'static') {
  for (let i = 1; i < perUePositions.length; i++) {  // secondaries only
    perUePositions[i] = mobilityStep(perUePositions[i], mobilityMode, mobilityParams, deltaSec, rngStateRef[i]);
  }
}
```

`mobilityStep` is a pure function in `multiUeMobility.ts` that takes
the current position + mode + params + delta + per-UE RNG state, and
returns the new position. Per-UE RNG state preserves determinism for
seeded modes (random-walk, waypoints sub-paths, manhattan turn
decisions).

### 4.3 Performance

200 UEs × per-tick mobility step is O(N). At 30 FPS = 6K ops/sec —
trivial. Adds negligible overhead to existing Phase F per-tick budget.

### 4.4 Reset semantics

`ueMobilityMode` change → trajectory cache rebuild (per Phase F
pattern). Per-UE RNG state resets. Positions snap back to initial
scatter (per current distribution mode), then mobility starts.

## 5. UI Placement

Extends Phase E/C/F Topology tab with a 6th sub-section: "UE mobility".
3-option radio (static / random-walk / waypoints / manhattan — 4
options actually). Beneath UE distribution mode section.

testids: `topology-tab-ue-mobility-radio`,
`topology-tab-ue-mobility-option-{static|random-walk|waypoints|manhattan}`,
`topology-tab-ue-mobility-reset`. 6 new testids (radio + 4 options +
reset). All 26 existing TopologyTab testids preserved. Total = 32.

Gated on `sinr-experiment` mode; modqn-demo bypass forces 'static'.

## 6. SceneTopologyState Extension

```ts
export type UeMobilityMode = 'static' | 'random-walk' | 'waypoints' | 'manhattan';

export interface UeMobilityParams {
  speedKmPerSec: number;        // random-walk + waypoints + manhattan
  waypointCount: number;         // waypoints only
  manhattanGridSpacingKm: number; // manhattan only
}

export interface SceneTopologyState {
  satsPerPlane: number | null;
  beamCountPerSatellite: number | null;
  ueCount: number | null;
  ueDistributionMode: UeDistributionMode | null;
  ueMobilityMode: UeMobilityMode | null;        // NEW in G-S1
  ueMobilityParams: UeMobilityParams | null;     // NEW in G-S3
}
```

`createSceneTopologyState` returns both new fields as null.
`getSceneTopologyResetKey` joins mobility mode + params.
`hasSceneTopologyOverrides` returns true when ueMobilityMode !== null
AND !== 'static'.

## 7. SINR Contract Amendment

`docs/sinr-runtime-parameter-contract.md` already has 4 subsections.
Phase G appends:

> ### UE Mobility (Phase G)
>
> Phase G activates per-tick UE position update so secondary UEs move
> through the primary observer footprint each simulation tick.
> Selector lives in the Topology tab as a `Simulation Setting`
> alongside Phase F sat/beam/UE-count overrides. Modes:
>
> - `static` (default; zero-drift with Phase F).
> - `random-walk` (uniform direction per tick, fixed speed).
> - `waypoints` (per-UE circular waypoint tour).
> - `manhattan` (axis-aligned grid streets).
>
> Replay artifacts continue to consume producer-baked positions
> (mobility values inside artifacts are immutable per Phase 7
> contract). Primary UE remains static for backward compat with
> single-UE narratives.

The amendment lands in PR-ε2.

## 8. Acceptance Per Slice

### 8.1 PR-δ2 (G-S1)

- new `src/engine/ue/multiUeMobility.ts`: exports `UeMobilityMode` type +
  `mobilityStep(position, mode, params, deltaSec, rngState) → newPosition`.
- `src/sceneTopology.ts`: `ueMobilityMode` field declared; reset key
  joins it.
- `src/scene/runtimeFrameStep.ts`: per-tick mobility step BEFORE
  per-UE SINR loop. `static` mode is a no-op (zero-drift).
- `src/scene/useSimulation.ts` + App.tsx + MainScene: thread
  ueMobilityMode through prop chain.
- validator: source grep + behavioral 4-mode tests + zero-drift on
  `static` mode + NEGATIVE on showcaseArtifactToScene + ueCount=1
  primary stays at origin in all modes.

### 8.2 PR-ε2 (G-S2)

- TopologyTab adds "UE mobility" sub-section with 4-option radio.
- Contract md amendment "UE Mobility (Phase G)" subsection.
- 6 new testids; all 26 prior preserved.
- validator: source grep + SSR with each mode active + modqn-demo
  bypass.

### 8.3 PR-ζ2 (G-S3)

- `SceneTopologyState.ueMobilityParams` field activates.
- TopologyTab gains slider/input controls per mode-specific param.
- runtimeFrameStep consumes params.
- validator: behavioral with non-default params + UI controls.

### 8.4 PR-η2 (G-S4) OPTIONAL

- New `src/viz/UeTrail.tsx`: renders last N positions per UE as
  fading polyline. Per-UE history ring buffer in scene state.
- GroundScene mounts UeTrail conditionally (`enableUeTrails`).
- validator: SSR with N positions per UE producing visible polylines.

## 9. Cross-Repo Dependencies

NONE for any slice.

## 10. Out of Scope

- Primary UE mobility.
- Predictive mobility-aware handover.
- Time-varying speed.
- Per-UE diverse mobility plans.
- Vehicle / pedestrian classes.
- Indoor / outdoor distinction.

## 11. Risks

- **Per-UE RNG state explosion**: 200 UEs × per-tick RNG state = 200
  Mulberry32 states. ~1.6KB. Trivial.
- **Mobility-driven handover storm**: fast mobility could trigger
  handover ping-pong. Mitigation: existing pingPongGuardSec already
  enforces hysteresis per Phase F per-UE handover (per profile.handover
  config).
- **Visual jitter at high speed**: 5 km/sec × 30 FPS = ~0.17 km/frame.
  Smooth at default speed. Higher speeds OK until ~50 km/sec when
  per-frame jumps become visible.
- **modqn-demo bypass omission**: forgetting modqn-demo bypass would
  let mobility leak into paper-faithful demo. Mitigation: PR-δ2
  validator asserts bypass.

## 12. Validation

Per `feedback-validator-canvas-vs-react-attr` + `feedback-modqn-demo-subagent-verify`
rules — main thread re-verify lint + validator + NEGATIVE assertions
+ regression on all prior validators.

## 13. Assumptions To Verify Before PR-δ2

- `runtimeFrameStep` per-tick budget can absorb per-UE mobility step
  (likely true — negligible cost).
- `multiUeState.ts` Mulberry32 RNG usable for per-UE seeded mobility
  (likely true — already used for distribution).
- modqn-demo bypass pattern from Phase F applicable as-is.
- Reflective boundary (random-walk modes) doesn't cause UE to escape
  primary footprint disc.

If any assumption broken, update this SDD.
