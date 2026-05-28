# MODQN Render Isolation / Visibility Fix Mini-SDD

**2026-05-28 update:** The render-isolation parts of this document still
apply, but any mention of four producer-context satellite models, compressed
context lanes, or replay cone cues has been superseded by
`docs/modqn-training-truth-visualization-sdd.md`. MODQN replay visualization
now prefers producer row `satelliteStates` / `beamStates` and otherwise
fails closed to T0 cues.

**2026-05-28 (later) supersession:** §2 producer-truth anchors (4-plane Walker
scripted-pass coverage hack, `serviceAreaPassTargetsSec [100, 400, 700, 1000]`,
hex-7 nadir 2° beam) are SUPERSEDED for beam geometry by
`docs/modqn-realistic-beam-geometry-cross-repo-sdd.md`. The scripted-pass
hack was a coverage workaround for the nadir-anchored single-pass-per-cycle
issue; in the realistic Earth-fixed cell model the scheduler drives coverage
regardless of satellite trajectory, so scripted passes are no longer needed.
This document's render-isolation discipline (no compressed lanes, no
consumer-invented satellite-context positions) stays authoritative.

## 1. Problem

The live `modqn-demo` scene had three user-visible problems:

1. The 780 km paper shell was drawn at physical scale relative to a
   200 km x 90 km ground area, so satellites often sat outside the camera
   framing.
2. `modqn-demo` could enter a no-serving state where no beam cones were drawn,
   making the scene look satellite-less even when satellites were present.
3. The MODQN scene reused SINR live-scene markers: flat UE markers and the UAV
   model appeared even though the public MODQN view should read as a
   satellite/UE/beam scene.

This is a live-rendering and scene-profile issue. It is not a replay artifact
issue and must not be solved by changing `showcaseArtifactToScene.ts`,
producer replay values, SINR truth, reward truth, global handover thresholds,
or MODQN training semantics.

## 2. Producer Truth Anchors

The MODQN scene follows the producer-side paper-faithful follow-on config for
research facts:

- `altitude_km: 780`
- `inclination_deg: 90.0`
- ground point `(40°N, 116°E)`
- UE area `uniform-rectangle`, `200 km x 90 km`
- 7 beams per satellite
- `theta_3db_deg = 2.0` stored as radians in the frontend profile
- primary baseline objective weights `[0.5, 0.3, 0.2]`

Sources:

- `modqn-paper-reproduction/configs/modqn-paper-baseline.paper-faithful-follow-on.resolved.yaml`
- `modqn-paper-reproduction/configs/modqn-paper-baseline.resolved-template.yaml`
- `modqn-paper-reproduction/docs/phase-01-python-baseline-reproduction-sdd.md`
- `modqn-paper-reproduction/docs/modqn-reproduction-assumption-register.md`

The previous `50 km` circular UE scatter is an older executable proxy
(`ASSUME-MODQN-REP-021`). The public MODQN paper-faithful scene uses
`ASSUME-MODQN-REP-022`: uniform sampling inside the paper-backed
`200 km x 90 km` rectangle.

## 3. Chosen Design

### 3.1 Visual Satellite Altitude

Keep the producer truth altitude at `780 km`, but introduce an explicit
`visualSatelliteAltitude` scene hint. `useBeamViz` prefers this value for
world-space satellite placement. This is display-only camera/framing
compression:

- it does not change `Profile.orbit.shells[*].altitudeKm`;
- it does not feed link budget, handover, action masks, rewards, or producer
  artifacts;
- SINR and MODQN can use different visual scene configs without sharing marker
  decisions.

### 3.2 Service-Area Phased MODQN Live Profile

The producer follow-on config uses a rotated single-plane proxy:

```json
{
  "altitude_km": 780,
  "orbital_planes": 1,
  "satellites_per_plane": 4,
  "in_plane_spacing_deg": 90,
  "inclination_deg": 90.0
}
```

For the live 3D showcase, the frontend keeps the same total count (`4`) and
truth altitude (`780 km`), but distributes the four display satellites as one
service-area-phased satellite per plane:

```json
{
  "planes": 4,
  "satsPerPlane": 1,
  "serviceAreaPassTargetsSec": [100, 400, 700, 1000],
  "phasePerturbation": false
}
```

The field is semantic rather than absolute RAAN: each target time asks the
orbit module to initialize that plane's satellite so it passes near the
observer at the configured simulation second. This avoids epoch-sensitive
hard-coded RAAN arrays and prevents a 16+ satellite visual inflation.

### 3.3 Mode-Scoped Scene Objects

`MainScene` keeps SINR and MODQN visual layers separated:

- `modqn-demo`: spherical UE markers, UAV hidden, live orbit satellite marker
  hidden, and live SINR beam cones hidden. The replay layer renders producer
  row satellite / beam geometry when `satelliteStates` and `beamStates` are
  available; otherwise it falls back to T0 row-level cues.
- `sinr-experiment`: existing cylindrical UE marker default and UAV remain.

The separation is exposed through `data-testid="render-isolation-probe"` and
canvas dataset telemetry so browser smoke can assert the active mode without
reading Three.js internals.

### 3.4 Display-Only Candidate Beam Fallback

If `modqn-demo` has visible satellites but no serving link, `useBeamViz` can
still compute a display-only 7-beam candidate layout around the shown
satellite. The current replay scene no longer mounts those live SINR cones in
MODQN mode; the replay layer owns the visible beam cues. This keeps the
"no beams / no satellite" failure closed without fabricating a serving state:

- `servingSatelliteId` and `servingBeamId` remain empty;
- beam SINR labels remain absent when there is no link sample;
- link budget, handover, MODQN actions, rewards, and producer artifacts remain
  untouched.

## 4. Boundary Rules

- `visualSatelliteAltitude` is camera/framing only.
- `serviceAreaPassTargetsSec` is live-scene profile geometry only.
- The field must be ignored unless `planes > 0`, `satsPerPlane === 1`, and the
  caller provides an observer position.
- Standard Walker behavior remains the fallback for all existing profiles.
- Satellite IDs remain `shellId-P{plane}-S0`.
- `MIN_ELEVATION_DEG` remains unchanged.
- `showcaseArtifactToScene.ts` remains untouched.
- The replay artifact path remains immutable and producer-owned.
- No frontend display path may promote exploration/user-trained output into
  paper-faithful or evaluation-mode evidence.
- No MODQN-specific marker or beam fallback may affect the SINR mode defaults.

## 5. Alternatives Rejected

1. `demoStartOffsetSec` only shifts the short visibility window. It does not
   make the 1200 second cycle continuously visible.
2. Lowering `MIN_ELEVATION_DEG` weakens all profiles and changes a global live
   simulation rule.
3. A 16 satellite Walker shell improves visual density but changes the paper
   baseline count.
4. Absolute RAAN / mean-anomaly arrays are brittle across epoch changes and
   make the caller responsible for orbital initialization math.

## 6. Validation

The fix is accepted only if:

1. `npm run validate:modqn:render-isolation` passes.
2. The validator locks producer-truth fields: observer `40/116`, altitude
   `780`, inclination `90`, `theta_3db = 2°`, objective weights
   `[0.5, 0.3, 0.2]`, 4 total satellites, 7 beams, and `uniform-rectangle`
   `200 km x 90 km`.
3. The validator confirms mode isolation hooks: MODQN sphere UE markers, MODQN
   UAV hidden, SINR cylinder default, and display-only candidate beam fallback.
4. `npm run lint` is clean.
5. `npm run build` is clean.
6. Browser smoke confirms:
   - `modqn-demo`: `data-ue-marker-shape="sphere"`,
     `data-uav-visible="0"`, replay renderer active, and live beam cone count
     `0` because MODQN beam cues are owned by the replay layer.
   - `sinr-experiment`: `data-ue-marker-shape="cylinder"`,
     `data-uav-visible="1"`, existing serving link still active.

## 7. 2026-05-27 Implementation Evidence

Static gates:

- `npm run validate:modqn:render-isolation` passed.
- `npm run lint` passed.
- `npm run build` passed, with only the existing Vite large-chunk warning.

Browser smoke against `http://127.0.0.1:5174/`:

- `modqn-demo`
  - probe: `appMode=modqn-demo`, `ueMarkerShape=sphere`,
    `uavVisible=0`
  - canvas: `visibleSatelliteCount=2`, `visualSatelliteAltitude=380`,
    `beamSatelliteCount=2`, `beamConeCount=14`
  - note: this evidence predates the 2026-05-28 training-truth visualization
    change and should not be used as authority for MODQN replay geometry.
  - screenshot: `output/playwright/modqn-render-isolation-after-doc.png`
  - console errors were only expected training-service health checks against
    `127.0.0.1:8765/health` while the backend was not running.
- `sinr-experiment`
  - probe: `appMode=sinr-experiment`, `ueMarkerShape=cylinder`,
    `uavVisible=1`
  - canvas: `visibleSatelliteCount=12`, `visualSatelliteAltitude=360`,
    `servingSatelliteId=shell-pro-53-P18-S1`, `servingBeamId=6`,
    `beamConeCount=2`
  - screenshot: `output/playwright/sinr-render-isolation-after-doc.png`
  - console had no errors and only the existing
    `KHR_materials_pbrSpecularGlossiness` GLTF warning.
