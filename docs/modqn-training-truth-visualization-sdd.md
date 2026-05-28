# MODQN Training Truth Visualization SDD

**Date:** 2026-05-28
**Status:** Proposed / S0-S1 partially implemented in `leo-beam-sim`
**Owner boundary:** `modqn-paper-reproduction` owns training truth; `leo-beam-sim` consumes and visualizes only.
**Target repo:** `/home/u24/papers/project/leo-beam-sim`
**Producer repo:** `/home/u24/papers/modqn-paper-reproduction`

## 1. Purpose

The MODQN scene must visualize the environment and decision process used by
the producer-side MODQN training run. It is not a generic handover demo, a
front-end storytelling layer, or a live SINR scene with MODQN labels.

The intended viewer reaction is:

> This is the satellite / beam / UE / action-mask environment in which the
> MODQN policy was trained or replayed.

That means satellite motion, UE distribution, beam geometry, selected action,
handover event kind, masks, reward, and diagnostics must come from producer
truth or from a documented producer config. When producer truth is absent, the
viewer must show an unavailable/source-gap state instead of inventing geometry.

## 2. Source Of Truth

### 2.1 Authority Chain

| Fact | Owner | Consumer behavior |
|---|---|---|
| Training config, seeds, objective weights | `modqn-paper-reproduction` | Display exactly, never rewrite. |
| Replay rows, selected actions, masks, rewards | `phase-03a-replay-bundle-v1` | Parse through existing loader and display read-only. |
| User-trained artifact manifest and raw-run metadata | training backend | Use as provenance and display profile mapping only. |
| Live camera, materials, labels, panels | `leo-beam-sim` | Display-only; must not alter truth. |
| Derived coverage estimates | `leo-beam-sim` | Label as estimate unless producer exports exact footprints. |

### 2.2 Data Contract Review Summary

- Source of truth: producer artifact and producer training metadata.
- Derived copy: frontend playback envelope and display profile.
- Display-only copy: Three.js coordinates, camera compression, marker scale,
  labels, opacity, and sidebar summaries.
- Durability point: producer artifact files (`manifest.json`,
  `provenance-map.json`, `timeline/step-trace.jsonl`, optional
  `evaluation/summary.json`, and user-trained raw-run metadata).
- Visibility point: MODQN training-truth scene and side panels.
- Validation oracle: producer validators first; consumer validators must only
  verify read-only mapping and fail-closed behavior.

## 3. Current Truth Inventory

### 3.1 Profile Truth Available In `leo-beam-sim`

`src/profiles/modqn-4sat-7beam-paper-faithful.json` currently declares:

- observer: `40N / 116E`
- orbit: 4 satellites, 780 km altitude, 90 degree inclination
- beams: 7 beams per satellite
- antenna: `theta3dB = 2 deg`
- channel: 20 GHz, 500 MHz, 33 dBm, noise PSD `-174 dBm/Hz`
- UEs: 100 users in a `200 km x 90 km` uniform rectangle
- objective weights: `(0.5, 0.3, 0.2)`
- frequency reuse: `1`
- beam hopping: `enabled = false`, `maxActiveBeamsPerSlot = 7`

This profile is sufficient for a high-level environment display, but not
sufficient by itself for a thesis-grade reconstruction of every training step.

### 3.2 Replay Bundle Truth Available Today

`phase-03a-replay-bundle-v1` currently exposes, per timeline row:

- `slotIndex`, `timeSec`, `decisionTimeSec`
- `userId`, `userIndex`
- `userPosition`, `decisionUserPosition`
- `previousServing`, `selectedServing`
- `handoverEvent.kind`
- `visibilityMask`, `actionValidityMask`
- `decisionVisibilityMask`, `decisionActionValidityMask`
- `beamLoads`, `beamThroughputs`
- `rewardVector`, `scalarReward`
- `satelliteStates`
- `beamStates`
- `kpiOverlay`
- optional `policyDiagnostics.topCandidates[]`, `objectiveQ`,
  `scalarizedQ`, and objective weights

The accepted 7-beam replay artifact currently has:

- 1000 rows
- 82 intra-satellite beam-switch rows
- 918 no-event rows
- 0 inter-satellite handover rows

### 3.3 Truth Not Guaranteed Today

The current consumer path must treat these as source gaps unless the producer
artifact or raw-run metadata provides them explicitly:

- exact per-step satellite ephemeris or topocentric trajectory samples mapped
  to producer `sat-*` IDs
- exact 100-UE coordinate set and mobility trace for each relevant step
- exact beam center coordinates / footprint polygons / 3 dB contours per
  producer beam and step
- exact beam hopping active-beam schedule
- exact frequency / reuse-group assignment when `frequencyReuse > 1`
- per-UE serving history for all 100 UEs at every step
- whether `theta3dB/3dB` is interpreted as full beamwidth or half angle in the
  producer's channel and geometry code

## 4. Hard Rules

1. Do not draw compressed satellite lanes, static orbit posters, or manually
   arranged four-satellite context markers in the main MODQN training scene.
2. Do not invent beam hopping. If the producer says beam hopping is disabled
   or does not export an active-beam schedule, the scene must show no producer
   beam hopping schedule.
3. Do not invent frequency colors. If `frequencyReuse = 1` or no producer
   reuse group is exported, color must not imply different frequencies.
4. Do not use SINR live-scene beam cones as MODQN training truth unless they
   are driven by producer-equivalent geometry and clearly labeled as such.
5. Do not convert display-only coverage estimates into evidence claims.
6. Do not promote user-trained artifacts to paper-faithful evidence.
7. Do not alter producer-selected actions, rewards, masks, or training
   semantics for camera framing or visual clarity.
8. Do not render `footprintProvenance.displayOnly === true` as physical T2
   beam-footprint truth. Display-only footprints may appear in the main scene
   only as a clearly labeled proxy / estimate layer whose truth audit keeps T2
   absent.
9. Do not render `coordinateFrameKind` values containing
   `no-earth-rotation-proxy` as real satellite trajectory or position truth in
   the MODQN training scene.
10. Do not treat `centerLocalTangentKm` alone as physical beam-footprint truth.
    It may support textual/decision cues, but T2 footprint rendering requires
    renderable footprint provenance and a producer-owned angle/contour
    convention.

## 5. Beamwidth And Coverage Standard

The default display may show a 3 dB footprint estimate only when it is labeled
as an estimate:

```text
beam_3db_radius_km = altitude_km * tan(theta3dB_deg / 2)
beam_3db_area_km2 = pi * beam_3db_radius_km^2
expected_ues_per_beam = ue_count * beam_3db_area_km2 / ue_area_km2
```

For the current Track-2 defaults:

```text
altitude = 780 km
theta3dB = 2 deg
UE area = 200 km x 90 km = 18000 km2
UE count = 100
beam_3db_radius ~= 13.6 km
beam_3db_area ~= 581 km2
expected_ues_per_beam ~= 3.2
expected_ues_per_satellite_7beam ~= 22.6
```

This estimate is not a substitute for producer-exported beam center /
footprint geometry. If producer geometry uses slant range, earth curvature,
steering loss, off-axis gain, or a different full-width/half-angle convention,
the producer-exported value wins.

### 5.1 Renderable Geometry Gate

`leo-beam-sim` must fail closed when producer rows expose geometry-like fields
whose provenance says they are not renderable physical truth.

To render T2 physical beam footprints, all of the following must be true for
the focused row's previous/selected and decision-valid beams:

- a finite producer beam center is present
- a finite producer footprint or contour is present
- `footprintProvenance.displayOnly` is not `true`
- the producer owns the footprint/angle convention or exports the contour

If any required field fails this gate, the main scene must not use
`producer-beam-state` geometry. The source-gap panel may still state that
`beamStates` exist, but T2 remains absent.

When the producer supplies useful display-only centers/footprints, the
consumer may render a `producer-display-proxy` layer so the training decision
is visible. That layer must:

- use clearly different telemetry/provenance from `producer-beam-state`
- keep T2 `absent`
- show source gaps instead of evidence claims
- avoid frequency coloring and beam-hopping animation unless those producer
  truths are exported separately

To render T1 satellite markers or paths, the row must expose satellite
positions in a renderable producer scene frame, ECEF/topocentric projection, or
other non-proxy frame with provenance that does not block scene rendering.
Legacy `coordinateFrameKind = "eci-km-no-earth-rotation-proxy"` is source data,
not MODQN scene geometry; if drawn, it must be drawn only as a proxy marker and
must not unlock T1 as fully renderable orbit truth.

The current accepted replay bundle exposes `beamStates.centerLocalTangentKm`
and `footprintKm`, but the footprint provenance is `displayOnly: true`; it also
exposes satellite states with `eci-km-no-earth-rotation-proxy`. Therefore the
consumer may show a proxy/estimate layer for readability, but it must display
source gaps and must not claim physical beam footprints, beam hopping, frequency
reuse, or real satellite ephemeris truth.

## 6. Required Producer Contract For Full Visualization

A full training-truth visualization needs either a new producer-owned artifact
surface or an extension to the existing replay bundle. Suggested contract name:
`modqn-training-visualization-v1`.

### 6.1 Environment Surface

Required fields:

- run ID, producer commit, config path, config sha256
- training profile / arm
- objective weights
- RNG seeds and RNG implementation notes
- satellite count, beam count, UE count
- UE area dimensions and coordinate frame
- altitude, inclination, observer, epoch
- channel and antenna parameters
- beam hopping enabled/disabled and scheduler settings
- frequency reuse / reuse groups

### 6.2 Entity Surface

Required fields:

- `satellites[]`: stable producer ID, orbital element or ephemeris source,
  display name, shell ID
- `beams[]`: stable producer ID, satellite ID, local beam index, beam index,
  center or layout definition, footprint definition, frequency/reuse group
- `ues[]`: stable producer ID, initial coordinate, mobility trace or static
  coordinate, seed provenance

### 6.3 Step Surface

For each decision step or replay row:

- timestamp / episode / slot
- per-satellite position or reference to ephemeris sample
- per-beam center / footprint if time-varying
- active beam mask if beam hopping exists
- visibility mask and action validity mask
- selected action and selected serving
- previous serving
- handover event kind
- reward vector and scalar reward
- policy diagnostics
- per-UE serving state if the view must show all 100 UE handover processes

### 6.4 Source-Gap Reporting

If any of the fields above are absent, the producer should export a structured
source gap:

```json
{
  "field": "beamHopping.activeBeamMask",
  "status": "absent",
  "reason": "training config has beam_hopping.enabled=false",
  "visualizationPolicy": "do-not-render-beam-hopping"
}
```

The consumer should display source gaps in the MODQN evidence/truth panel and
avoid rendering unsupported claims.

## 7. Visualization Design

### 7.1 Main 3D Training Scene

The main scene should render only producer-supported geometry:

- the 200 km x 90 km UE training area
- 100 UE markers from producer coordinates
- satellites from producer ephemeris / orbit config
- beam footprints from producer beam geometry
- selected serving and previous serving for the focused row
- validity/visibility mask state for the 28-action catalog

Camera compression is allowed only as a display transform and must not change
labels, telemetry, or producer truth.

### 7.2 Per-UE And Aggregate View

The scene should not try to draw 100 large handover arcs at once. Use layered
visual grammar:

- all UE markers colored by current serving satellite / beam if producer
  per-UE serving state exists
- focused UE marker enlarged for the current replay row
- selected serving beam highlighted
- previous serving beam outlined
- aggregate counts by satellite and beam in a side panel
- timeline scrubber for event clusters

If only the focused row's UE is available, the all-UE serving map must be
disabled or labeled unavailable.

### 7.3 Intra-Satellite Handover

Render intra-satellite handover only when:

- `handoverEvent.kind = intra-satellite-beam-switch`
- previous and selected serving share the same `satId`
- previous and selected beams are valid under the producer masks

Visual grammar:

- same satellite identity retained
- previous footprint outline fades
- selected footprint fills/pulses
- focused UE pulse at the decision coordinate
- short local transfer cue between beam footprints if beam centers are known

If beam centers are unknown, the sidebar may show the event textually, but the
main scene must not fabricate a physical footprint transition.

### 7.4 Inter-Satellite Handover

Render inter-satellite handover only when:

- `handoverEvent.kind = inter-satellite-handover`
- previous and selected serving have different `satId`
- both actions are valid under the producer masks

Visual grammar:

- previous satellite/beam link fades
- selected satellite/beam link appears
- focused UE pulse uses a distinct inter-satellite color
- aggregate counters update

The current accepted baseline has `0` inter-satellite rows, so the paper
baseline view must not claim observed inter-satellite handover.

### 7.5 Beam Hopping

Beam hopping visualization is allowed only if the producer exports an active
beam mask or schedule.

Current profile state:

```text
beamHopping.enabled = false
maxActiveBeamsPerSlot = 7
beamsPerSatellite = 7
```

Therefore current MODQN paper-faithful display should not animate beam
hopping. It may show `beam hopping schedule absent/disabled` in the truth
panel.

## 8. Consumer Fail-Closed Behavior

The consumer must classify visualization capability by truth level:

| Level | Name | Required truth | Allowed scene |
|---|---|---|---|
| T0 | replay-row truth | current `phase-03a` row fields | focused row, masks, rewards, textual event |
| T1 | environment truth | exact config, UE coordinates, orbit mapping | environment scene with satellites and UEs |
| T2 | beam geometry truth | beam centers / footprints / angle convention | physical beam footprints and coverage |
| T3 | all-UE serving truth | per-UE serving history | full 100-UE serving/handover map |
| T4 | scheduler truth | active beam mask / hopping schedule | beam hopping animation |
| T5 | frequency truth | reuse group / frequency assignment | frequency coloring |

Missing a level must not block lower-level display, but it must block that
level's visual claim.

Presence of a field is not sufficient to unlock its level. `satelliteStates`
with proxy coordinate frames may count as raw producer state for T1 diagnostics
and may be drawn as proxy markers, but not as real orbit truth. `beamStates`
with display-only footprints may count as raw producer state for diagnostics
and may be drawn as proxy footprints, but not as T2 geometry truth.

## 9. Implementation Plan

### S0: Remove Consumer-Invented Context Geometry

- Remove compressed orbit lanes and static producer-context satellite markers
  from the main MODQN scene.
- Keep only producer-supported replay cues.
- Add validator checks that forbid hardcoded four-satellite display lanes in
  the training-truth scene.

### S1: Source-Gap Audit

- Add a consumer-side audit that inspects the loaded replay bundle and reports
  which truth levels T0-T5 are available.
- Surface the audit in the MODQN evidence/truth panel.
- Do not change producer artifacts in this slice.

### S2: Producer Contract Patch

- In `modqn-paper-reproduction`, add or document
  `modqn-training-visualization-v1`.
- Export exact UE coordinates, satellite/beam mapping, and source gaps.
- If beam hopping is disabled, explicitly export that fact.

### S3: Training-Truth Adapter

- Add a `leo-beam-sim` adapter that consumes the producer visualization
  surface.
- Map producer IDs to scene entities without rewriting truth.
- Keep visual transforms separately labeled as display-only.

### S4: Scene Rendering

- Render environment, focused UE decision, masks, beam footprints, and
  aggregate counts based on truth level.
- Use fail-closed placeholders for missing T2-T5 fields.

### S5: Browser And Contract Validation

- Browser smoke: 100 UE field visible, selected/focused UE clear, source-gap
  panel accurate, no unsupported beam hopping/frequency colors.
- Static validators: no display-only geometry promoted to producer truth.
- Cross-repo validator: producer artifact contract accepted before frontend
  display enables T1+ levels.

## 10. Acceptance Criteria

1. A user can tell which parts of the scene are producer truth and which are
   display-only transforms.
2. The scene never shows beam hopping unless producer truth exports a schedule
   or active mask.
3. The scene never shows frequency colors unless producer truth exports reuse
   or frequency groups.
4. The beamwidth display uses producer geometry when available; otherwise it
   shows a clearly labeled estimate using the documented formula.
5. The accepted baseline does not claim inter-satellite handover because it
   has zero inter-satellite rows.
6. User-trained artifacts remain labeled user-trained and non-paper-faithful.
7. Missing truth fields are visible as source gaps, not silently filled.

## 11. Open Questions

1. Does the original paper training environment include beam hopping, or is the
   current `beamHopping.enabled=false` profile the intended Track-2 baseline?
2. Does the producer interpret `theta3dB=2deg` as full width or half angle in
   every channel/geometry path?
3. Are current `beamStates.centerPosition` / `centerLocalTangentKm` populated
   in accepted artifacts, or only optional in the TypeScript contract?
4. Does the accepted replay bundle represent one focused UE per row or all 100
   UE decisions per step? If it is one focused UE per row, what producer
   surface owns the all-UE serving map?
5. Should `modqn-training-visualization-v1` be a new artifact file or a
   `phase-03a-replay-bundle-v2` extension?

## 12. 2026-05-28 S0-S1 Consumer Implementation Notes

Implemented in `leo-beam-sim`:

- Removed the compressed four-satellite context lane from `MainScene`.
- Removed static/fallback producer-context satellite positions and
  consumer-invented satellite-to-footprint replay cones.
- Preserved producer row fields in the playback shell:
  `userPosition`, `decisionUserPosition`, masks, `satelliteStates`, and
  `beamStates`.
- Updated the replay scene layer to inspect producer `beamStates` and
  `satelliteStates` when present, but only render them after the renderable
  geometry gate passes. If footprints are display-only or satellite positions
  are proxy frames, the layer falls back to the canonical T0 board and labels
  the geometry source accordingly.
- Added a T0-T5 truth audit in the replay cue panel and canvas telemetry:
  replay row, environment, beam geometry, all-UE serving, beam hopping
  scheduler, and frequency truth.
- Added validator coverage that forbids returning to consumer-invented
  compressed context lanes and static producer-context positions.
- Superseded the earlier "prefer producer beamStates/satelliteStates whenever
  present" behavior. The new invariant is: producer fields unlock rendering
  only when their provenance and coordinate frame say they are renderable
  geometry.

Important observed producer artifact fact:

- The currently exported accepted bundle at
  `/tmp/leo-beam-sim/modqn-bundles/baseline-modqn-pilot02-rerun-2026-05-15-export`
  still declares legacy `uniform-circular` 50 km UE scatter and
  ground point `(0, 0)` in its manifest, while the frontend profile has been
  adjusted toward the Track-2/paper-follow-on `200 km x 90 km` rectangle and
  `40N / 116E` observer. The consumer must display artifact truth for loaded
  replay rows and keep profile-level paper-follow-on defaults as display
  defaults only until the producer exports the Track-2 visualization contract.
