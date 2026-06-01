# MODQN Handover Story Layer SDD

## Status

Accepted for the first implementation slice on 2026-05-30.

## Purpose

The handover and beam-hopping visuals need to read as an event story without
turning the renderer into a second truth source. This layer provides one shared
display model for:

- intra-satellite beam switch: old beam -> new beam on the same satellite
- inter-satellite handover: old satellite/beam -> new satellite/beam
- beam-hopping slot state: active, inactive, and next-slot preview
- multi-UE focus: one primary/recent UE is visually foregrounded while the rest
  are quiet context

The layer is presentation-only. It must not alter SINR, MODQN selected actions,
handover kind, rewards, beam masks, active-beam schedules, geometry truth, or
provenance.

## Source Ownership

| Lane | Story source | Beam-hopping policy | Claim boundary |
|---|---|---|---|
| `sinr-live` | live engine `NormalizedSceneFrame` and live `VizFrame` | live profile/scheduler state only | SINR/HOBS live demo |
| `modqn-live-cell-preview` | live engine plus Phase I earth-fixed cell schedule | profile-derived cell schedule preview | demo preview, not baseline proof |
| `modqn-replay-proof` | immutable MODQN replay display state | source-gap unless producer exports active-beam mask/schedule | producer-backed replay proof only |
| `artifact-replay` | immutable `visual-showcase-v1` artifact | artifact-owned only | artifact replay only |

## Handover Story Model

The shared model is plain data and contains:

- `lane`: the resolved scene lane.
- `source`: `sinr-live`, `profile-derived-demo`, `modqn-replay-proof`, or
  `source-gap`.
- `focus`: the foreground UE/cell/beam identity.
- `events[]`: intra/inter events with source and target satellite/beam IDs and
  display anchors.
- `beamSlots`: active cells/beams, inactive ghost cells, and next-slot preview
  cells when the current lane owns a scheduler display.
- `sourceGaps[]`: blocked surfaces such as missing producer active-beam
  schedule.

The model may derive display anchors from existing renderer coordinates, but it
must preserve upstream IDs and handover kind. It must not reclassify replay rows
or infer beam hopping from `selectedServing`, `previousServing`, validity masks,
or decision masks.

## Rendering Policy

### Intra HO

Render a high-contrast ground arc near the focused cell/UE, plus source and
target rings. The label must include old/new satellite and beam identity. When
old and new ground anchors collapse to the same cell, use concentric rings and
a lifted pulse arc so the switch is still readable.

Baseline Faithful suppresses these foreground event arcs because the cell
schedule is a profile-derived slot preview, not a source-backed primary-UE
handover event index. The Explain Handover and Debug visual presets may show
capped profile-derived intra/inter cues as a non-proof overlay. The middle
scene may still show active, inactive, next-slot beam/cell state, all-UE service
coloring, and active-cell UE counts; primary-UE event proof remains owned by the
lane-owned live Walker event index or producer replay artifact.

### Inter HO

Render a spatial transfer ribbon between old and new satellites, a target-cell
or UE-to-target cue, and old/new satellite plus beam identity. Inter-HO in the
MODQN cell preview remains suppressed for the same source-boundary reason as
intra-HO foreground arcs. Replay proof only renders inter-HO when the producer
row says the handover kind is inter-satellite.

### Multi-UE

The primary/focused UE remains foreground. Secondary UEs are dimmed or
aggregated by default so they do not compete with the active event. Replay
display filtering may choose which UE becomes primary; the artifact values stay
unchanged.

### Beam Hopping

In live/profile-derived lanes, active beams/cells are solid high-contrast,
inactive cells are ghost outlines, and next-slot cells are dashed preview
halos. These are display encodings of scheduler output only.

In `modqn-replay-proof`, missing active-beam mask or hopping schedule is a
source gap. The layer must display the gap and must not animate hopping.

Live/profile-derived MODQN UI copy must keep the claim boundary visible:
`preview · handover story · not baseline proof · backend re-train pending`.

### Visual Presets

- **Baseline Faithful** is the default for `modqn-live-cell-preview`. It shows
  the all-UE service map, satellite/cell coloring, active-cell overlay, and
  UE-count badges, with a compact profile-derived service readout for slot,
  serving count, active cells, and served/idle UEs. It keeps beam cones,
  footprint ellipses, foreground handover arcs, and diagnostics off.
- **Explain Handover** may enable focused beam cones plus capped
  profile-derived intra/inter cues. These cues are overlay-demo presentation
  only.
- **Debug** may enable footprint ellipses and diagnostics for engineering
  inspection. Its HUD may expose compact profile-derived cell schedule
  diagnostics: slot duration, next-slot change count, visible serving
  satellites, and active beam ids by satellite. Baseline Faithful and Explain
  Handover must keep this diagnostic block hidden. It remains separate from
  producer replay proof.

## Validator Plan

Add a focused validator that checks:

1. lane render plan exposes handover-story ownership only for allowed lanes;
2. `modqn-live-cell-preview` renders a profile-derived story layer and reports
   active / inactive / next-slot telemetry;
3. `modqn-replay-proof` reports beam-hopping source gap and does not mount the
   live/profile-derived story overlay;
4. `artifact-replay` does not enter the story overlay;
5. live/demo UI copy says the story is not baseline proof;
6. SINR live keeps its existing beam and handover visual path enabled.

Browser smoke should verify at least the MODQN live cell preview lane reports
`data-handover-story-layer=profile-derived-demo`, and the replay proof lane
reports a source gap rather than hopping animation.
