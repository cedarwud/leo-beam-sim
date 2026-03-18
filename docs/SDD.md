# leo-beam-sim — Software Design Document

## 1. Overview

LEO multi-beam handover simulator with real-time 3D visualization.

**Goals:**
- Simulate LEO satellite passes with semi-circular arc trajectories across the observer's sky
- Render visible beam cones (leo-simulator style) from satellites to ground cells
- Compute per-beam SINR using pluggable, paper-sourced formulas
- Execute handover decisions based on computed signal metrics
- Keep signal model, handover policy, and visualization fully decoupled for easy paper-swap

**Initial paper profile:** PAP-2024-HOBS (Chen et al., VTC2024-Spring)

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────┐
│                      App (UI)                       │
│  Minimal controls: play/pause, speed, profile pick  │
└──────────────────────┬──────────────────────────────┘
                       │ props / context
┌──────────────────────▼──────────────────────────────┐
│                  MainScene (R3F)                     │
│  Canvas + Camera + Lighting + Ground               │
│  Orchestrates per-frame: orbit → signal → HO → viz  │
└──┬──────────┬────────────┬────────────┬─────────────┘
   │          │            │            │
   ▼          ▼            ▼            ▼
┌──────┐ ┌────────┐ ┌──────────┐ ┌───────────┐
│Orbit │ │Signal  │ │Handover  │ │Viz        │
│Engine│ │Engine  │ │Engine    │ │(R3F comps)│
└──────┘ └────────┘ └──────────┘ └───────────┘
   │          │            │
   ▼          ▼            ▼
┌─────────────────────────────────────┐
│         Profile (JSON)              │
│  orbit params / channel params /    │
│  antenna model / HO policy config   │
└─────────────────────────────────────┘
```

### Key principle: Engine ↔ Profile decoupling

Each engine reads its config from a **Profile** object at init time. Engines expose a
pure-function interface — no engine imports another engine directly. MainScene is the
only integration point that pipes data between engines per frame.

---

## 3. Module Design

### 3.1 Profile (`src/profiles/`)

A JSON file defines all paper-specific parameters. Switching papers = switching JSON.

```typescript
interface Profile {
  id: string;                    // e.g. "hobs-2024"
  paper: string;                 // full citation

  orbit: {
    type: "walker";              // extensible: "walker" | "tle" | "custom"
    altitudeKm: number;          // 550
    inclinationDeg: number;      // 53
    planes: number;              // 22
    satsPerPlane: number;        // 72
    observerLatDeg: number;      // 40
    observerLonDeg: number;      // 116
  };

  antenna: {
    model: "bessel-j1-j3" | "bessel-j1" | "flat";
    maxGainDbi: number;          // 40
    beamwidth3dBRad: number;     // 0.058
    apertureFormula: string;     // "10c/fc"
    efficiency: number;          // 0.6
  };

  channel: {
    frequencyGHz: number;        // 28 (Ka-band)
    bandwidthMHz: number;        // 100
    maxTxPowerDbm: number;       // 50
    noisePsdDbmHz: number;       // -174
    pathLossComponents: string[];// ["fspl", "atmospheric", "scintillation", "shadow-fading"]
    shadowFadingModel: string;   // "log-normal"
  };

  handover: {
    policy: "sinr-offset" | "rsrp-a3" | "elevation";  // extensible
    sinrThresholdDb: number;     // 10
    offsetDb: number;            // 6 (gamma_os)
    triggerTimeSec: number;      // T_thr
    pingPongGuardSec: number;
  };

  beams: {
    perSatellite: number;        // 37
    maxActivePerSat: number;     // 4 (for viz)
    frequencyReuse: number;      // 1 | 3 | 4
  };
}
```

### 3.2 Orbit Engine (`src/engine/orbit/`)

**Responsibility:** Given a time `t`, return positions of all satellites.

**Files:**
- `walker-constellation.ts` — Generate Walker delta orbital elements from profile
- `propagation.ts` — Kepler propagation (from beamHO-bench, ~200 lines)
- `topocentric.ts` — ECEF → observer-local (az, el, range) (from beamHO-bench, ~100 lines)
- `math.ts` — Trig helpers (from beamHO-bench, ~25 lines)
- `types.ts` — OrbitElement, OrbitPoint, TopocentricPoint

**Interface:**
```typescript
// Pure function, no side effects
function propagateConstellation(
  elements: OrbitElement[],
  atUtcMs: number
): OrbitPoint[];

function toTopocentric(
  point: OrbitPoint,
  observer: ObserverContext
): TopocentricPoint;   // { azDeg, elDeg, rangeKm }
```

**Source:** beamHO-bench `sim/orbit/` (copy with minimal edits — remove PaperProfile dependency, accept plain config object)

### 3.3 Signal Engine (`src/engine/signal/`)

**Responsibility:** Given satellite positions + beam assignments, compute per-beam SINR.

**Files:**
- `path-loss.ts` — Composite path loss: L = L_fs + L_g + L_sc + L_sf
- `beam-gain.ts` — Antenna gain G(θ) with pluggable model (Bessel J1+J3, J1, flat)
- `link-budget.ts` — Assembles SINR: signal power / (intra + inter interference + noise)
- `types.ts` — LinkSample { satId, beamId, sinrDb, rsrpDbm }

**Interface:**
```typescript
// Pure function — computes SINR for one UE against all visible beams
function computeLinkBudget(
  ue: UEPosition,
  satellites: SatelliteSnapshot[],
  config: Profile["channel"] & Profile["antenna"]
): LinkSample[];

// Individual components also exported for testing/replacement
function computePathLossDb(distKm: number, freqGHz: number, elDeg: number, components: string[]): number;
function computeBeamGainDb(offAxisDeg: number, model: AntennaModel): number;
```

**Source:** beamHO-bench `sim/channel/` (copy beam-gain.ts, large-scale.ts, link-budget.ts — replace PaperProfile import with plain config)

### 3.4 Handover Engine (`src/engine/handover/`)

**Responsibility:** Given current serving state + LinkSamples, decide handover actions.

**Files:**
- `handover-manager.ts` — State machine + policy dispatcher
- `policies/sinr-offset.ts` — HOBS policy (Algorithm 2: SINR offset + trigger time)
- `policies/rsrp-a3.ts` — (future) 3GPP A3 event
- `policies/elevation.ts` — (future) geometry-based
- `types.ts` — HandoverState, HandoverEvent, HandoverPolicy interface

**Interface:**
```typescript
interface HandoverPolicy {
  evaluate(
    current: ServingState,
    candidates: LinkSample[],
    dt: number
  ): HandoverDecision;  // { action: "stay" | "intra-switch" | "inter-handover", target? }
}

// Factory — profile selects which policy
function createPolicy(config: Profile["handover"]): HandoverPolicy;
```

**Initial policy (HOBS, Algorithm 2):**
1. Sort candidate beams by SINR descending
2. If best is same satellite & SINR > current → intra-LEO beam switch
3. If different satellite & `SINR_target - γ_os > SINR_current` AND `T_trig ≥ T_thr` → inter-LEO handover
4. Otherwise → stay

### 3.5 Visualization (`src/viz/`)

**Responsibility:** 3D rendering only. No signal computation, no handover logic.

**Files:**
- `SatelliteBeams.tsx` — Cone geometry from satellite to ground cell (from leo-simulator, 186 lines)
- `EarthFixedCells.tsx` — Hexagonal ground cells with polarization colors (from leo-simulator, ~300 lines)
- `SatelliteLinks.tsx` — Connection lines: serving (blue), target (green), candidate (gray) (from leo-simulator, ~220 lines)
- `SatelliteMarker.tsx` — Simple satellite icon/sphere + label
- `SinrOverlay.tsx` — Per-beam SINR value as floating text label (new, ~50 lines)
- `GroundScene.tsx` — Ground plane + observer marker

**Input contract:** Each viz component receives plain data props:
```typescript
// SatelliteBeams only needs:
{
  satellitePosition: THREE.Vector3;
  cells: { id: number; position: { x: number; z: number }; radius: number }[];
  beamAssignments: { beamId: number; cellId: number; isActive: boolean }[];
  primaryCellId?: number;
}

// SinrOverlay only needs:
{
  beams: { position: THREE.Vector3; sinrDb: number; isServing: boolean }[];
}
```

No viz component imports from `engine/`. MainScene converts engine output → viz props.

### 3.6 Scene Orchestration (`src/scene/MainScene.tsx`)

Per-frame loop (useFrame):
```
1. time += dt * speed
2. positions = orbitEngine.propagate(constellation, time)
3. topocentric = positions.map(p => toTopocentric(p, observer))
4. visible = topocentric.filter(t => t.elDeg >= minElevation)
5. linkSamples = signalEngine.computeLinkBudget(ue, visible, config)
6. hoDecision = handoverEngine.evaluate(servingState, linkSamples, dt)
7. update servingState
8. convert to viz props → render
```

### 3.7 UI (`src/ui/`)

Minimal, no complex sidebar:
- `ControlBar.tsx` — Play/pause, speed slider, profile dropdown
- `InfoPanel.tsx` — Current serving satellite, SINR value, handover event log
- `MetricsPanel.tsx` — (optional) Running stats: HO count, avg SINR, throughput

---

## 4. Data Flow

```
Profile (JSON)
  │
  ├──→ Orbit Engine ──→ SatelliteSnapshot[]
  │                         │
  ├──→ Signal Engine ◄──────┘──→ LinkSample[]
  │                                   │
  ├──→ Handover Engine ◄──────────────┘──→ HandoverDecision
  │
  └──→ Viz (receives all above as plain props, renders only)
```

**Immutable data flow:** Engines produce new data each frame. No engine mutates shared state.
Only exception: HandoverManager maintains internal trigger-time counters (encapsulated).

---

## 5. File Structure

```
leo-beam-sim/
├── docs/
│   └── SDD.md                          # this file
├── src/
│   ├── engine/
│   │   ├── orbit/
│   │   │   ├── types.ts                # OrbitElement, OrbitPoint, TopocentricPoint
│   │   │   ├── math.ts                 # deg↔rad, normalize angle
│   │   │   ├── walker-constellation.ts # generate Walker delta elements
│   │   │   ├── propagation.ts          # Kepler propagation
│   │   │   └── topocentric.ts          # ECEF → az/el/range
│   │   ├── signal/
│   │   │   ├── types.ts                # LinkSample, AntennaModel
│   │   │   ├── path-loss.ts            # composite path loss
│   │   │   ├── beam-gain.ts            # Bessel J1/J3 antenna gain
│   │   │   └── link-budget.ts          # SINR = signal / (interference + noise)
│   │   └── handover/
│   │       ├── types.ts                # HandoverPolicy, HandoverState, HandoverDecision
│   │       ├── handover-manager.ts     # state machine + policy dispatch
│   │       └── policies/
│   │           └── sinr-offset.ts      # HOBS Algorithm 2
│   ├── profiles/
│   │   ├── types.ts                    # Profile interface
│   │   └── hobs-2024.json              # PAP-2024-HOBS parameters
│   ├── viz/
│   │   ├── SatelliteBeams.tsx          # beam cones (from leo-simulator)
│   │   ├── EarthFixedCells.tsx         # hex ground cells (from leo-simulator)
│   │   ├── SatelliteLinks.tsx          # connection lines (from leo-simulator)
│   │   ├── SatelliteMarker.tsx         # satellite icon + label
│   │   ├── SinrOverlay.tsx             # per-beam SINR floating labels
│   │   └── GroundScene.tsx             # ground plane + observer
│   ├── scene/
│   │   └── MainScene.tsx               # orchestrator (orbit → signal → HO → viz)
│   ├── ui/
│   │   ├── ControlBar.tsx              # play/pause, speed, profile
│   │   └── InfoPanel.tsx               # serving info, HO log
│   ├── App.tsx
│   └── main.tsx
├── public/
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 6. Pluggability Contract

### Switching papers (e.g. from HOBS to A4EVENT):

1. **Create new profile JSON** in `src/profiles/` with different parameters
2. **If new antenna model needed:** Add case to `beam-gain.ts` switch
3. **If new path loss components:** Add computation to `path-loss.ts`
4. **If new handover policy:** Implement `HandoverPolicy` interface in `policies/`
5. **No changes to:** viz components, MainScene orchestration, orbit engine

### Invariant:
- `engine/` never imports from `viz/`
- `viz/` never imports from `engine/`
- `engine/signal/` never imports from `engine/handover/` (or vice versa)
- Only `MainScene` and `App` cross boundaries

---

## 7. Migration Source Map

| Target file | Source | Modifications |
|---|---|---|
| `engine/orbit/math.ts` | `beamHO-bench/src/sim/orbit/math.ts` | None |
| `engine/orbit/types.ts` | `beamHO-bench/src/sim/orbit/types.ts` | Remove SatRec (Kepler only initially) |
| `engine/orbit/propagation.ts` | `beamHO-bench/src/sim/orbit/propagation.ts` | Keep Kepler only, remove SGP4 import |
| `engine/orbit/topocentric.ts` | `beamHO-bench/src/sim/orbit/topocentric.ts` | Remove PaperProfile dependency |
| `engine/signal/beam-gain.ts` | `beamHO-bench/src/sim/channel/beam-gain.ts` | Replace GainModel import with local type |
| `engine/signal/path-loss.ts` | `beamHO-bench/src/sim/channel/large-scale.ts` | Extract path-loss functions, simplify interface |
| `engine/signal/link-budget.ts` | `beamHO-bench/src/sim/channel/link-budget.ts` | Replace PaperProfile with plain config |
| `viz/SatelliteBeams.tsx` | `leo-simulator/src/features/beam-hopping/components/SatelliteBeams.tsx` | Minor type adjustments |
| `viz/EarthFixedCells.tsx` | `leo-simulator/src/features/beam-hopping/components/EarthFixedCells.tsx` | Minor type adjustments |
| `viz/SatelliteLinks.tsx` | `leo-simulator/src/components/satellite/EnhancedSatelliteLinks.tsx` | Simplify props |

---

## 8. Walker Constellation Design

For observer at 40°N with Starlink-like parameters:
- 550 km altitude, 53° inclination
- 22 orbital planes, RAAN spaced 360°/22 = 16.36°
- 72 satellites per plane, mean anomaly spaced 360°/72 = 5°
- Generates ~1584 elements, but only ~10-15 visible at any moment
- Multiple orbital planes guarantee staggered passes (not simultaneous)
- 53° inclination ensures frequent high-elevation passes at 40°N

---

## 9. Initial Paper Profile: HOBS (PAP-2024-HOBS)

Source: Chen et al., "Energy-Efficient Joint Handover and Beam Switching Scheme for Multi-LEO Networks," VTC2024-Spring.

| Parameter | Value | Equation |
|---|---|---|
| Altitude | 550 km | — |
| Beams per satellite | 37 | — |
| Ka-band frequency | 28 GHz | — |
| Bandwidth | 100 MHz | — |
| Max Tx power | 50 dBm | — |
| Noise PSD | -174 dBm/Hz | — |
| Max antenna gain | 40 dBi | — |
| 3dB beamwidth | 0.058 rad | — |
| Path loss | L_fs + L_g + L_sc + L_sf | Eq. (1)-(2) |
| Antenna gain | Bessel J1+J3 | Eq. (3) |
| SINR | P·H·G^T·G^R / (I^a + I^b + σ²) | Eq. (4) |
| Intra-LEO interference I^a | Sum over other beams of same sat | Eq. (5) |
| Inter-LEO interference I^b | Sum over beams of other sats | Eq. (6) |
| SINR threshold γ_thr | 10 dB | — |
| HO offset γ_os | 6 dB | Eq. (24) |
| Trigger time T_thr | configurable | Eq. (25) |
