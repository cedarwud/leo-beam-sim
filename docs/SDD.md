# leo-beam-sim — Software Design Document (v2)

## 1. Overview

LEO multi-beam handover simulator with real-time 3D visualization.

**Goals:**
- Simulate LEO satellite passes across the observer's sky with physically correct arc trajectories
- Render beam cones from satellites to ground with oblique-cone geometry
- Compute per-beam SINR using pluggable, paper-sourced formulas
- Execute handover decisions based on computed signal metrics
- Support candidate-rich handover scenarios with 3-5 simultaneous high-elevation satellites from different directions when physically valid under the selected profile/mode
- Keep signal model, handover policy, and visualization fully decoupled for easy paper-swap
- Keep `research-default`, `candidate-rich`, and `demo-readability` presentation contracts explicit and separately labeled

**Initial baseline profile:** `hobs-2024-paper-default` (paper-faithful HOBS-derived baseline)
**Initial custom profile:** `hobs-2024-candidate-rich` (3-shell sensitivity/readability variant)

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────┐
│                      App (UI)                       │
│  ControlBar + InfoPanel overlays                    │
└──────────────────────┬──────────────────────────────┘
                       │ props
┌──────────────────────▼──────────────────────────────┐
│                  MainScene (R3F)                     │
│  Canvas + Camera + Lighting + NTPU + UAV            │
│  Delegates logic to hooks, only renders             │
└──┬──────────────────────────────────────────────────┘
   │ hooks
   ├── useSimulation ─── trajectory cache + interpolation
   │                     + link budget + handover engine
   │
   └── useBeamViz ────── beam target computation
                         + display satellite filtering
       │          │            │            │
       ▼          ▼            ▼            ▼
    ┌──────┐ ┌────────┐ ┌──────────┐ ┌───────────┐
    │Orbit │ │Signal  │ │Handover  │ │Viz        │
    │Engine│ │Engine  │ │Engine    │ │(R3F comps)│
    └──────┘ └────────┘ └──────────┘ └───────────┘
       │          │            │
       ▼          ▼            ▼
    ┌─────────────────────────────────────┐
    │   Profiles (JSON) + Runtime Config  │
    │ paper-default / candidate-rich      │
    │ + presentation / replay selection   │
    └─────────────────────────────────────┘
```

### Key change from v1: Hook extraction

MainScene was 521 lines with trajectory cache, interpolation, link budget, handover,
beam assignment, display filtering, and rendering all in one `useFrame`. Now split into:

- **`useSimulation`** — all physics: cache build, interpolation, link budget, handover
- **`useBeamViz`** — all viz logic: beam targets, display filtering, SINR labels
- **`MainScene`** — only React rendering (~120 lines)

---

## 3. Multi-Shell Constellation Design

### 3.1 Problem

Single-inclination Walker constellations produce parallel satellite tracks from the
observer's perspective. At 40°N with 53° inclination, all visible satellites move in
roughly the same direction (NE↔SW). This fails the handover demo requirement:
**3-5 simultaneous high-elevation candidates from different directions**.

### 3.2 Academic Precedent

6/50 surveyed papers use multi-orbit/multi-shell designs:

| Paper | Design | Purpose |
|-------|--------|---------|
| PAP-2021-NETFLOW | 3 shells: 1200/800/500 km, inc 80°/60°/30° | Load distribution across layers |
| PAP-2025-DQNCHO | 5 orbits: 300-500 km | Altitude sensitivity study |
| PAP-2024-HDMMA-MOBILITY | LEO 550 km + MEO 12000 km | Hierarchical 6G |
| PAP-2025-RSMA | LEO 1000 km + GEO | Soft handover backup |
| PAP-2025-PERDDQN | 5 planes, inc 120-140° | Non-standard polar variation |
| PAP-2021-SESSION-DURATION | Walker-delta + Walker-star | Starlink vs OneWeb comparison |

Additionally, 39/50 papers use simplified custom constellations (3-300 sats) rather
than exact real-world replicas. Custom constellation design for specific research
objectives is standard practice.

### 3.3 Research Positioning

The 3-shell design in this document is a paper-grounded custom constellation profile for
directional diversity and handover readability. It is **not** a claim that PAP-2024-HOBS
itself uses this exact 3-shell deployment.

This SDD uses three explicit presentation/research contracts:

1. **`research-default`**
   - use the physically configured constellation without event-centric visual bias
   - suitable for normal algorithm comparison and non-demo runs
2. **`candidate-rich`**
   - use a source-grounded custom constellation profile intended to increase simultaneous,
     above-horizon candidate diversity
   - valid as a sensitivity/stress configuration, not as an implicit paper reproduction
3. **`demo-readability`**
   - use deterministic, explicitly labeled event-focused replay/presentation behavior to
     make a real handover transition easy to inspect
   - must not fabricate satellites, candidate links, or orbital motion

Profile IDs and traceability are kept explicit:

- `hobs-2024-paper-default`
  - HOBS-derived baseline profile
  - use for paper-faithful comparison runs
- `hobs-2024-candidate-rich`
  - custom 3-shell profile for sensitivity/readability studies
  - must never be labeled or shipped as the paper-default baseline

If the repository temporarily ships only the custom profile during refactor, its ID and
UI label must still remain `candidate-rich`; it must not masquerade as generic `hobs-2024`.

The 3-shell configuration below is therefore positioned as the default
`candidate-rich` profile for this simulator, not as the only academically acceptable
constellation contract.

### 3.4 Candidate-Rich Profile Design: 3-Shell Configuration

All shells share 550 km altitude (same as HOBS paper) but differ in inclination,
ensuring satellites cross the observer's sky from **3 distinct directions**:

| Shell | Inclination | Planes × Sats | Total | Direction at 40°N | Walker F |
|-------|-------------|---------------|-------|-------------------|----------|
| A     | 53°         | 22 × 20       | 440   | NE ↔ SW           | 1        |
| B     | 97.6° (SSO) | 18 × 18       | 324   | N ↔ S (polar)     | 1        |
| C     | 70°         | 18 × 18       | 324   | NNE ↔ SSW         | 1        |
| **Total** |         |               | **1088** |                |          |

**Expected visibility at 40°N, elevation ≥ 5°:**
- Shell A: ~5-8 satellites (53° is ideal for 40°N, frequent overhead passes)
- Shell B: ~4-6 satellites (polar orbit always crosses all latitudes)
- Shell C: ~4-6 satellites (70° provides good mid-latitude coverage)
- **Total: ~13-20 visible, of which 3-5 at high elevation (>30°) from different directions**

**Why same altitude:** Simplifies link budget (same FSPL, same beam footprint geometry).
Papers that use multiple altitudes (NETFLOW, DQNCHO) do so for altitude-dependent studies,
not for directional diversity. For handover visualization, inclination diversity is sufficient.

### 3.5 Walker Delta Phase Factor

Standard Walker(i:T/P/F) with F=1. The inter-plane phase offset is `F × 360° / T`.
With F=1 and reasonable plane counts, adjacent planes have small phase offset,
ensuring continuous coverage without synchronized gaps.

No need for large F values — the 3 different inclinations already provide directional
diversity. Within each shell, standard Walker F=1 gives even temporal distribution.

---

## 4. Module Design (Updated)

### 4.1 Profile (`src/profiles/`)

**Change from v1:** `orbit` section now contains `shells[]` array instead of single
constellation parameters.

```typescript
interface Profile {
  id: string;
  paper: string;
  profileClass: 'paper-default' | 'candidate-rich';

  orbit: {
    type: 'walker';
    shells: Shell[];              // NEW: multi-shell support
    observerLatDeg: number;
    observerLonDeg: number;
  };

  antenna: {
    model: 'bessel-j1-j3' | 'bessel-j1' | 'flat';
    maxGainDbi: number;
    beamwidth3dBRad: number;
    efficiency: number;
  };

  channel: {
    frequencyGHz: number;
    bandwidthMHz: number;
    maxTxPowerDbm: number;
    noisePsdDbmHz: number;
    pathLossComponents: string[];
  };

  handover: {
    policy: 'sinr-offset';
    sinrThresholdDb: number;
    offsetDb: number;
    triggerTimeSec: number;
    pingPongGuardSec: number;
  };

  beams: {
    perSatellite: number;
    maxActivePerSat: number;
    frequencyReuse: number;
  };
}

interface Shell {
  id: string;                    // e.g. "shell-a"
  altitudeKm: number;
  inclinationDeg: number;
  planes: number;
  satsPerPlane: number;
}
```

`presentation mode` is intentionally **not** embedded into the paper profile JSON. It is
runtime/UI state, so paper-derived physical parameters remain separable from
event-focused readability policy.

#### Runtime Config (`App` / scene-owned, not paper metadata)

```typescript
type PresentationMode = 'research-default' | 'candidate-rich' | 'demo-readability';

interface ReplayConfig {
  /** Fixed orbit epoch for deterministic replay; not encoded into profile JSON */
  epochUtcMs: number;
  /** Starting offset inside the cached simulation window */
  startOffsetSec: number;
  /** Whether the replay wraps or clamps at the end of the cached window */
  loop: boolean;
}

interface RuntimeConfig {
  presentationMode: PresentationMode;
  replay: ReplayConfig;
}
```

Phase 1 may hardcode a default `RuntimeConfig` in `App` while keeping the type boundary
in place. Phase 2 exposes runtime selection in UI controls.

Because `candidate-rich` exists both as a **profile class** and as a **runtime contract**,
the UI should either:

1. expose separate selectors for `profile` and `presentation`, or
2. expose named presets that internally map to both values

It must not present one unlabeled `candidate-rich` toggle that hides which layer changed.

### 4.2 Orbit Engine (`src/engine/orbit/`)

**Change from v1:** `walker-constellation.ts` accepts `Shell[]` and generates
combined elements with shell-prefixed IDs (e.g. `A-P3-S7`, `B-P0-S12`).

**Files (unchanged):**
- `math.ts` — Trig helpers (20 lines)
- `types.ts` — OrbitElement, OrbitPoint, ObserverContext, TopocentricPoint (38 lines)
- `propagation.ts` — Kepler propagation (105 lines)
- `topocentric.ts` — ECEF → az/el/range (73 lines)
- `walker-constellation.ts` — Generate Walker delta elements → **updated for Shell[]**
- `index.ts` — Re-exports (4 lines)

### 4.3 Signal Engine (`src/engine/signal/`)

**No changes from v1.** Pure functions, profile-driven.

- `beam-gain.ts` — Bessel J1/J3 antenna gain with alpha>10 clamp (76 lines)
- `path-loss.ts` — FSPL + atmospheric + scintillation + shadow fading (61 lines)
- `link-budget.ts` — SINR computation (95 lines)
- `types.ts` — LinkSample, SatelliteSnapshot, UEPosition (24 lines)

### 4.4 Handover Engine (`src/engine/handover/`)

**No changes from v1.**

- `types.ts` — HandoverPolicy interface, ServingState, HandoverDecision (37 lines)
- `policies/sinr-offset.ts` — HOBS Algorithm 2 (69 lines)
- `handover-manager.ts` — State machine + policy factory (80 lines)

### 4.5 Scene Hooks (NEW — extracted from MainScene)

#### `src/scene/useSimulation.ts` (~200 lines)

**Responsibility:** All physics computation. Returns per-frame simulation state.

```typescript
interface SimFrame {
  /** All visible satellites with interpolated positions */
  satellites: VisibleSat[];
  /** Link budget results for satellites above MIN_ELEVATION */
  linkSamples: LinkSample[];
  /** Current handover state */
  serving: { satId: string | null; beamId: number | null; sinrDb: number };
  /** Handover event log */
  hoCount: number;
  lastHoReason: string;
}

function useSimulation(
  profile: Profile,
  replay: ReplayConfig,
  speed: number,
  paused: boolean,
): SimFrame;
```

**Internal structure:**
1. `useMemo` — generate elements from selected profile shells and build deterministic trajectory cache
2. `useFrame` — interpolate cache using replay config, compute link budget, run handover engine

**Trajectory cache design:**
- Pre-compute at mount from `replay.epochUtcMs`: propagate all elements over 3600s at 10s steps
- Per-frame: interpolate between cached steps (az/el/range/lat/lon)
- Azimuth wraparound handling (shortest arc interpolation)
- Two elevation thresholds: CACHE_EL=1° (smooth visual exit), LINK_EL=5° (physics)
- Replay progression is controlled by `replay.startOffsetSec` and `replay.loop`

#### `src/scene/useBeamViz.ts` (~80 lines)

**Responsibility:** Convert SimFrame → viz-ready data. Pure display logic.

```typescript
interface VizFrame {
  /** Broad physical sky context shown as markers */
  displaySats: VisibleSat[];
  /** Small event-focused subset used for visual emphasis */
  eventSatIds: Set<string>;
  /** Visual role for each emphasized event satellite.
   *  'secondary' and 'prepared' are Phase 2 / CHO extensions, not HOBS baseline behavior.
   *  Initial implementation: only 'serving' and 'post-ho' are used. */
  eventRoles: Map<string, 'serving' | 'secondary' | 'prepared' | 'post-ho'>;
  /** Which satellites show beam cones */
  beamSatIds: Set<string>;
  /** Per-sat beam targets in world coordinates */
  satBeams: Map<string, BeamTarget[]>;
  /** SINR labels to show */
  sinrLabels: SinrLabel[];
}

function useBeamViz(
  sim: SimFrame,
  profile: Profile,
  mode: PresentationMode,
): VizFrame;
```

**Display filtering:**
- `display set` — broad physical context, not equivalent to HO candidate set
- `event set` — small emphasized subset
  - Phase 1 / HOBS: serving / just-switched target
  - Phase 2 / CHO extension: secondary / prepared may also appear
- `MAX_DISPLAY_SATS = 8` — show top 8 by elevation, serving sat always included
- `MAX_EVENT_SATS = 3` — of those, at most 3 event-relevant satellites are foregrounded
- `MAX_BEAM_SATS = 3` — beam cones follow the event set, not the full display set
- Beam ground targets: satellite dome ground projection + beam offset × visual scale
- Stable filtering: avoid frame-to-frame jitter by preferring previously-shown sats
- `candidateSatelliteLimit`-style HO logic must not, by itself, collapse the broader display set

### 4.6 MainScene (`src/scene/MainScene.tsx` ~120 lines)

**Only rendering.** No physics, no filtering logic.

```typescript
function SceneContent({ profile, speed, paused, runtime, onSimUpdate }) {
  const sim = useSimulation(profile, runtime.replay, speed, paused);
  const viz = useBeamViz(sim, profile, runtime.presentationMode);

  useEffect(() => onSimUpdate(sim), [sim]);

  return (
    <>
      <Camera /><Controls /><Lights />
      <NTPUScene /><UAV />
      <GroundScene /><EarthFixedCells />
      {viz.displaySats.map(s => <SatelliteMarker ... />)}
      {viz beam cones}
      <SinrOverlay />
    </>
  );
}
```

### 4.7 Visualization (`src/viz/`)

**Files:**
- `SatelliteBeams.tsx` — Oblique cone (apex=satellite, base circle on ground) + ground disc (185 lines)
- `EarthFixedCells.tsx` — Hex ground cells, decorative overlay (121 lines)
- `SatelliteMarker.tsx` — Satellite GLB model + label (49 lines)
- `SinrOverlay.tsx` — Floating SINR dB labels (36 lines)
- `GroundScene.tsx` — Observer marker (24 lines)

**Planned Phase 1 cleanup:** `src/viz/SatelliteLinks.tsx` is currently present but not
part of the target architecture and should be removed once the hook refactor lands.

### 4.8 Sky Dome Projection

**Problem:** Physical satellite positions (ECEF/km) don't map to the 3D scene scale.
Scene ground is ~700×480 world units; satellite altitude is 550 km.

**Solution:** Elliptical sky dome projection (VISUAL-ONLY):

```
X = H_RADIUS × cos(el) × sin(az)      // horizontal
Y = V_RADIUS × sin(el)                 // vertical
Z = -H_RADIUS × cos(el) × cos(az)     // horizontal (north = -Z)
```

| Parameter | Value | Effect |
|-----------|-------|--------|
| H_RADIUS | 700 | Satellites at 1° enter at horiz=700, well beyond scene edge (~420) |
| V_RADIUS | 400 | Zenith height = 400, comfortable viewing |

This ensures:
- Satellites enter/exit beyond scene boundary (no pop-in)
- Arc trajectory follows physical az/el path
- Zenith height is visually proportional

**Beam ground targets** use a separate visual scale:
`vizScale = footprintRadiusWorld / footprintRadiusKm` (~3.5 world/km).
This keeps beam cones within the scene regardless of satellite nadir distance.

### 4.9 Observer-Sky Handover Presentation Contract

The frontend uses three distinct sets:

1. **display set**
   - the broader physical sky context rendered in the scene
2. **handover candidate set**
   - the satellites eligible for handover decision in the current frame
3. **event set**
   - a small, display-only subset of the display set that is visually emphasized
     for handover readability

Rules:

1. The scene center is treated as a **handover focus corridor**, not an exact target point.
2. The package optimizes for readable serving-to-target transition, not zenith crowding.
3. The focus corridor may contain 2-3 event-relevant satellites at high elevation when the
   physical geometry supports it.
4. The broader sky must remain visible around the event set so the result still reads as
   observer-centric pass geometry rather than a handover-only overlay.
5. `demo-readability` mode may choose a deterministic event-rich replay window, but it must:
   - stay explicitly labeled non-default
   - preserve orbital positions and signal computation
   - avoid synthetic fill-in or fake density
6. `candidate-rich` mode may use the 3-shell configuration for directional diversity, but it
   must be described as a sensitivity/readability profile rather than a universal baseline.
7. Frontend emphasis remains `VISUAL-ONLY`; runtime handover ranking and KPI accumulation stay
   owned by the physics/signal/handover path.

---

## 5. Data Flow (Updated)

```
Selected profile (JSON) + runtime config
  │
  ├─ shells[] ──→ walker-constellation.ts ──→ OrbitElement[] (all shells combined)
  │
  ├──→ useSimulation ──→ SimFrame { satellites, linkSamples, serving, hoCount }
  │     ▲
  │     └── replay config { epochUtcMs, startOffsetSec, loop }
  │     ├── trajectory cache (pre-computed at mount)
  │     ├── interpolation (per frame)
  │     ├── link budget (per frame, el ≥ 5° sats only)
  │     └── handover engine (per frame)
  │
  ├──→ useBeamViz ──→ VizFrame { displaySats, eventSatIds, eventRoles, beamSatIds, satBeams, sinrLabels }
  │     ▲
  │     └── presentationMode
  │     ├── display set selection (broad sky context)
  │     ├── event set selection (serving / target readability)
  │     ├── beam sat selection (event-focused subset)
  │     └── beam target world coords (dome projection + visual scale offset)
  │
  └──→ MainScene renders VizFrame using viz components
```

**Coordinate systems (kept separate):**

| System | Used by | Units |
|--------|---------|-------|
| ECEF km | Orbit engine, topocentric | km |
| Observer-relative km | Link budget (beam offsets, off-axis) | km |
| Sky dome world | Viz satellite positions | world units (H=700, V=400) |
| Scene world | Viz beam ground targets, cells | world units (~700×480 extent) |

---

## 6. File Structure (Updated)

```
leo-beam-sim/
├── docs/
│   └── SDD.md                          # this file
├── src/
│   ├── engine/
│   │   ├── orbit/
│   │   │   ├── types.ts
│   │   │   ├── math.ts
│   │   │   ├── walker-constellation.ts # → accepts Shell[], multi-inclination
│   │   │   ├── propagation.ts
│   │   │   ├── topocentric.ts
│   │   │   └── index.ts
│   │   ├── signal/
│   │   │   ├── types.ts
│   │   │   ├── path-loss.ts
│   │   │   ├── beam-gain.ts
│   │   │   └── link-budget.ts
│   │   └── handover/
│   │       ├── types.ts
│   │       ├── handover-manager.ts
│   │       └── policies/
│   │           └── sinr-offset.ts
│   ├── profiles/
│   │   ├── types.ts                    # → Shell interface, profileClass, orbit.shells[]
│   │   ├── index.ts
│   │   ├── hobs-2024-paper-default.json
│   │   └── hobs-2024-candidate-rich.json
│   ├── viz/
│   │   ├── SatelliteBeams.tsx          # oblique cone + ground disc
│   │   ├── EarthFixedCells.tsx         # hex cells (decorative)
│   │   ├── SatelliteMarker.tsx         # GLB model + label
│   │   ├── SinrOverlay.tsx             # SINR labels
│   │   └── GroundScene.tsx             # observer marker
│   ├── scene/
│   │   ├── useSimulation.ts            # NEW: physics hook
│   │   ├── useBeamViz.ts               # NEW: viz logic hook
│   │   └── MainScene.tsx               # → render only (~120 lines)
│   ├── components/
│   │   ├── scene/
│   │   │   ├── NTPUScene.tsx
│   │   │   └── UAV.tsx
│   │   └── ui/
│   │       └── Starfield.tsx
│   ├── ui/
│   │   ├── ControlBar.tsx
│   │   └── InfoPanel.tsx
│   ├── config/
│   │   └── ntpu.config.ts
│   ├── App.tsx
│   └── main.tsx
├── public/
│   ├── models/
│   │   ├── sat.glb
│   │   └── uav.glb
│   └── scenes/
│       └── NTPU.glb
├── package.json
├── tsconfig.json
└── vite.config.ts
```

**Planned Phase 1 cleanup:** `src/viz/SatelliteLinks.tsx` remains only as a leftover and
should be deleted once `useSimulation` / `useBeamViz` own the scene pipeline.

---

## 7. Constants & Magic Numbers Registry

All visual-only constants are centralized and documented:

| Constant | Value | Location | Purpose |
|----------|-------|----------|---------|
| SKY_DOME_H_RADIUS | 700 | useSimulation | Horizontal dome radius (entry/exit beyond scene) |
| SKY_DOME_V_RADIUS | 400 | useSimulation | Vertical dome radius (zenith height) |
| MIN_ELEVATION_DEG | 5 | useSimulation | Link budget threshold |
| CACHE_ELEVATION_DEG | 1 | useSimulation | Cache threshold (smooth visual exit) |
| SIM_DURATION_SEC | 3600 | useSimulation | Trajectory cache window (1 hour) |
| SIM_STEP_SEC | 10 | useSimulation | Cache step interval |
| MAX_DISPLAY_SATS | 8 | useBeamViz | Max satellite markers shown |
| MAX_EVENT_SATS | 3 | useBeamViz | Max event-emphasized satellites shown in focus corridor |
| MAX_BEAM_SATS | 3 | useBeamViz | Max satellites with beam cones |
| FOCUS_CORRIDOR_Y_CENTER | TBD | useBeamViz | Visual center of handover-readable high-elevation band (finalize during implementation) |
| FOCUS_CORRIDOR_Y_HALFSPAN | TBD | useBeamViz | Acceptable vertical half-span for event emphasis (finalize during implementation) |
| footprintRadiusWorld | 56 | useBeamViz | Beam cone base radius (visual) |
| cellRadius | 80 | MainScene | Hex cell visual radius |

---

## 8. Pluggability Contract

### Switching papers:
1. Create new profile JSON with different `shells[]`, `channel`, `antenna`, `handover`
2. If new antenna model: add case to `beam-gain.ts`
3. If new handover policy: implement `HandoverPolicy` interface
4. **No changes to:** viz components, hooks structure, MainScene

### Switching profile class / presentation:
1. `paper-default` ↔ `candidate-rich` is a **profile** change and must stay visible in profile ID/label
2. `research-default` ↔ `demo-readability` is a **runtime config** change and must not rewrite profile metadata
3. deterministic replay settings are runtime config, not paper metadata

### Switching constellation design:
1. Edit `shells[]` in profile JSON
2. No code changes — walker-constellation.ts handles arbitrary Shell[]

### Invariants:
- `engine/` never imports from `viz/` or `scene/`
- `viz/` never imports from `engine/`
- `scene/` hooks import from `engine/` (read-only)
- `scene/` MainScene imports from `viz/` (render) and hooks (data)
- `engine/signal/` never imports from `engine/handover/` (or vice versa)
- `demo-readability` must not silently replace `research-default`
- display-set emphasis must not rewrite handover candidates or KPI-driving state

---

## 9. Validation & Acceptance

The architecture is not complete from code structure alone. A passing implementation must
also satisfy these observer-sky / handover presentation checks:

1. **V1: No fake density**
   - every displayed and emphasized satellite maps to a real propagated orbit state
   - no synthetic fill-in is used to increase center density
2. **V2: Display / candidate / event separation**
   - the broad display set remains larger than the event set
   - reducing handover candidates does not collapse the visible sky
3. **V3: Anti-cluster preservation**
   - the scene must not regress into a long-lived center-top pack of satellites
4. **V4: Role-transition readability**
   - Phase 1 minimum: the user can identify serving and post-handover target in the scene
   - Phase 2 / CHO extension: prepared and secondary roles are also distinguishable
5. **V5: Mode labeling**
   - `research-default`, `candidate-rich`, and `demo-readability` runs are explicitly labeled
6. **V6: Deterministic event-focused replay**
   - if demo/readability mode is used, the selected replay window is deterministic and does
     not alter physics or KPI semantics

Minimum implementation evidence:

1. `npm run lint`
2. `npm run build`
3. deterministic replay check for the chosen profile/mode tuple
4. manual visual check that the scene reads as:
   - `rise -> pass -> set`
   - readable handover event in the focus corridor
   - no center-top crowding
   - broader physical sky context preserved

---

## 10. Implementation Checklist

Sections 2-9 describe the **target architecture**. Delivery is staged:

- **Phase 1** establishes the final profile/runtime boundaries, deterministic replay plumbing,
  multi-shell support, and hook split. It may still ship with a fixed default `RuntimeConfig`
  and only the Phase 1 event roles (`serving`, `post-ho`).
- **Phase 2** exposes runtime profile/mode/replay selection in UI and adds the richer
  event-presentation contract for research/demo governance.

### Phase 1 — Multi-shell + Hook refactor (core)

| # | Task | Files | Status |
|---|------|-------|--------|
| 1 | Update Profile types: add `profileClass` and `orbit.shells[]` | profiles/types.ts | TODO |
| 2 | Split profile IDs into baseline and custom variants | profiles/hobs-2024-paper-default.json + profiles/hobs-2024-candidate-rich.json + profiles/index.ts | TODO |
| 3 | Add `RuntimeConfig` / `ReplayConfig` plumbing with fixed defaults | App + scene/useSimulation.ts + scene/MainScene.tsx | TODO |
| 4 | Update walker-constellation: accept Shell[] | engine/orbit/walker-constellation.ts | TODO |
| 5 | Extract useSimulation hook | scene/useSimulation.ts (new) | TODO |
| 6 | Extract useBeamViz hook | scene/useBeamViz.ts (new) | TODO |
| 7 | Rewrite MainScene (render only) | scene/MainScene.tsx | TODO |
| 8 | Delete SatelliteLinks.tsx | viz/SatelliteLinks.tsx | TODO |
| 9 | Clean dead code | various | TODO |
| 10 | npm run lint && npm run build | — | TODO |

### Phase 2 — Presentation mode + research governance (after Phase 1 is stable)

| # | Task | Files | Status |
|---|------|-------|--------|
| 11 | Expose either separate profile/presentation selectors or explicit named presets in UI; include replay choice | App + ui/ControlBar.tsx | TODO |
| 12 | Add display-set / event-set separation and event-role emphasis | scene/useBeamViz.ts + viz components | TODO |
| 13 | Finalize focus corridor constants (FOCUS_CORRIDOR_Y_*) | scene/useBeamViz.ts | TODO |
| 14 | Add validation checks / manual acceptance checklist for anti-cluster + role readability | docs + test helpers | TODO |
| 15 | Add CHO-oriented `secondary` / `prepared` role semantics only if policy/model support is introduced | handover + scene/useBeamViz.ts | FUTURE |
