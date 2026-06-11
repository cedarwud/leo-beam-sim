# ADR-001: Use Scene Lanes for Frontend Viewport Ownership

## Status

Accepted

## Date

2026-05-29

## Context

`leo-beam-sim` is the final visual-first showcase and live-demo host for the
NTN Showcase Stack. The frontend must present both SINR live demonstration
stories and MODQN baseline-reproduction stories without becoming a second truth
source.

The renderer had accumulated mode checks in separate places. In particular,
`modqn-demo` could mount both the Phase I earth-fixed cell preview and the older
MODQN replay proof layer. The same broad gate could also affect
`sceneSource=artifact-replay` if the persisted app mode was MODQN.

This produced a cluttered viewport and confused source ownership.

## Decision

Introduce an explicit `SceneLane` boundary:

- `sinr-live`
- `modqn-live-cell-preview`
- `modqn-replay-proof`
- `artifact-replay`

`App.tsx` resolves the lane from `appMode`, `sceneSource`, and a future explicit
proof request. The resolved lane, not `appMode` alone, decides whether
viewport proof layers, HUDs, training status banners, and sidebar tab sets
mount.

Artifact replay is source-owned: live-only scene effects and handover controls
are disabled or read-only on artifact frames.

The implementation keeps `modqn-demo + live-sim` on
`modqn-live-cell-preview` by default. The MODQN replay proof viewport layer can
mount only after the replay cue panel explicitly requests `modqn-replay-proof`.
`MainScene` uses a lane render plan so shared primitives stay reusable while
viewport ownership remains centralized.
Sidebar tab ownership follows the same lane: live cell preview shows live status
only on the right, replay proof shows MODQN evidence only, and artifact replay
shows artifact-only panels.
Top-bar ownership follows the same lane. `sinr-live` owns live beam density,
beam info, camera preset, spotlight, and HO-slow controls. MODQN lanes keep
global mode/playback controls without inheriting those SINR presentation
controls. Artifact replay keeps replay-safe playback, UI mode, speed, and
display-only UE focus/filter controls.

The lane render plan also owns source compatibility: live lanes require
`sceneSource=live-sim`, while artifact replay requires
`sceneSource=artifact-replay`. Incompatible pairs fail closed by disabling
live-only effects and artifact-only diagnostics.
Artifact replay additionally uses a dedicated artifact scene composer, so
artifact-owned frames do not enter the live simulation hook or live beam
composer.
Cinematic spotlight, fog, and point-light effects are part of the live SINR
presentation lane and are gated by the render plan.

The Handover Story Layer follows the same lane boundary. `modqn-live-cell-preview`
may mount a shared profile-derived overlay for demo readability and must label it
as not baseline proof. `modqn-replay-proof` may only show producer-backed replay
switch/decision cues; if the producer artifact lacks an active-beam schedule, the
proof lane reports a source gap instead of animating beam hopping. `artifact-replay`
keeps handover story ownership inside the immutable artifact and does not mount
the profile-derived overlay.

## Alternatives Considered

### Keep `appMode` as the render gate

Rejected. `appMode` is too broad. It combines profile defaults, sidebar sets,
handover mode defaults, runtime parameters, and viewport proof selection.

### Fork the whole renderer into SINR and MODQN copies

Rejected. It would reduce accidental overlap but duplicate camera, lighting,
materials, labels, telemetry, and primitive maintenance.

### Big-bang rewrite of `MainScene`

Rejected. The immediate failure is one ownership boundary. A full scene-composer
split is a valid follow-up, but it should be protected by lane validators first.

## Consequences

- The default MODQN live viewport becomes the clean cell preview lane.
- Artifact replay no longer inherits MODQN HUD, training/job tabs, or evidence
  tabs from persisted localStorage mode.
- Artifact replay no longer mounts live-only decoration and handover effects
  just because the MODQN cell overlay is off.
- Artifact replay's top bar reports read-only artifact handover status instead
  of offering live handover mode switches.
- MODQN replay proof remains available as data and side-panel evidence; its 3D
  proof layer now requires an explicit replay cue panel toggle.
- Focused cell beam cone telemetry reports renderable cone count, not schedule
  assignment count.
- Decision-overlay evidence copy distinguishes paper-faithful, user-trained,
  fallback, and unavailable states without changing truth ownership.
- Sidebar tab sets now reinforce lane ownership instead of leaving evidence,
  live status, and artifact panels available concurrently.
- MODQN and artifact top-bar controls no longer expose SINR-only live controls.
- Hidden render-isolation and canvas telemetry now report lane-derived render
  ownership rather than broad `appMode` assumptions.
- Artifact replay avoids live simulation/composer side effects instead of only
  hiding their rendered output.
- Spotlight/fog/point-light effects can no longer bypass the render plan.
- Handover story overlays can no longer cross from profile-derived demo lanes
  into replay-proof or artifact-owned lanes.
- Shared primitives remain allowed, but shared viewport ownership is not.
- Validators can now reject broad mode-gated proof mounts.
- S-FLAG-2: the MODQN service-allocation overlay family (all-UE service map,
  per-cell UE-count badges, service readout/legend/diagnostics, phase-3 beam-load
  cylinder + upload particles) on `modqn-live-cell-preview` is gated by a dedicated
  producer-readiness flag (`showModqnServiceAllocation`) rather than the broad
  `showCellOverlay`, so the degenerate producer baseline is parked off the default
  surface while the code + data path is preserved for the producer un-park.

## Validation

- `validate:frontend:scene-lane-governance` checks the lane resolver, docs, ADR,
  and App wiring.
- Existing MODQN replay validators are updated to require lane-gated replay
  mounting instead of broad `appMode` mounting.
- Browser smoke should verify that `modqn-live-cell-preview` exposes cell
  telemetry without `data-modqn-replay-scene-layer`.
- Browser smoke should verify that `modqn-live-cell-preview` exposes
  profile-derived handover story telemetry and that `modqn-replay-proof` reports
  a beam-hopping source gap instead of fake hopping animation when schedule truth
  is absent.
- Browser smoke should verify that `artifact-replay` hides live handover,
  density, callout, camera, spotlight, and HO-slow controls.
