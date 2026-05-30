# Frontend Render Governance

## Purpose

This document is the guardrail for frontend scene rendering in `leo-beam-sim`.
It prevents the viewport from becoming an accidental stack of unrelated proof
layers while still allowing the renderer to share primitives, materials,
camera controls, labels, and panels.

`sinr-experiment` is the demonstration and safety lane. `modqn-demo` is the
baseline-reproduction experiment lane. They may share renderer mechanisms, but
they must not share viewport ownership decisions.

## Terms

- **Scene lane**: the single authoritative viewport story for the current
  frame. A lane decides which proof layer may occupy the 3D scene.
- **Composer**: lane-owned orchestration code that decides which shared
  primitives are mounted.
- **Primitive**: reusable visual component such as satellite markers, beam
  cones, cell overlays, labels, lines, and pulses.
- **Truth source**: the upstream owner of SINR, MODQN decisions, handovers,
  rewards, geometry, provenance, or replay artifacts.

## Non-Negotiable Rules

1. One viewport frame has one authoritative scene lane.
2. `appMode` alone must not mount proof layers in the 3D viewport.
3. `sceneSource=artifact-replay` owns the viewport and must not silently inherit
   live-SINR or MODQN replay proof overlays.
4. MODQN live cell preview and MODQN replay proof are separate lanes.
5. Shared primitives are allowed. Shared composers are not allowed when the
   lanes have different source ownership or proof semantics.
6. Display transforms must not alter SINR, handover events, MODQN actions,
   rewards, deterministic path IDs, geometry truth, evidence status, or
   provenance.
7. A new viewport layer must update this matrix and add or update a validator
   before it ships.
8. Presentation mode defaults to low density. Any additional MODQN cell-lane
   visual effect must earn its place and must be gated explicitly.

## Lane Matrix

| Scene lane | Owner | Source | Allowed viewport proof | Must stay off |
|---|---|---|---|---|
| `sinr-live` | live SINR demo | live simulator / configured profile | live satellites, live SINR beams, SINR handover effects, diagnostics | MODQN replay proof, MODQN cell overlay |
| `modqn-live-cell-preview` | MODQN live preview | live simulator plus Phase I earth-fixed cell schedule | cell overlay, clean cell hopping state, focused cell beam cone, minimal intra-cell reassignment cue | MODQN replay proof, legacy live beam cones, decorative live effects, artifact overlays |
| `modqn-replay-proof` | MODQN evidence proof | immutable MODQN replay display state | replay proof layer, source-backed or display-proxy replay beams, focused decision trace | live cell preview, live SINR beams, artifact overlays |
| `artifact-replay` | visual-showcase replay | immutable `visual-showcase-v1` artifact | artifact-provided frame content and replay controls | live cell preview, MODQN replay proof, live SINR proof effects |

## Current Implementation Contract

`src/app/sceneLane.ts` resolves the lane from app state. The initial contract is:

- `sceneSource=artifact-replay` resolves to `artifact-replay`.
- `appMode=modqn-demo` with `sceneSource=live-sim` resolves to
  `modqn-live-cell-preview`.
- `appMode=sinr-experiment` with `sceneSource=live-sim` resolves to `sinr-live`.
- `modqn-replay-proof` is selected only by the MODQN replay cue panel's explicit
  proof viewport toggle. It is not the default MODQN viewport lane.

`App.tsx` owns the lane decision. `MainScene` may continue to host shared
primitives, but viewport ownership policy lives in
`src/scene/sceneLaneRenderPlan.ts`, not in broad `appMode` flags.

Sidebars and top-right HUDs also follow the lane decision. Artifact replay uses
artifact-only sidebars and does not inherit MODQN training, jobs, evidence, or
Phase I preview HUD just because `modqn-demo` is persisted in local storage.
While the artifact is loading or failed, the viewport fails closed instead of
falling back to live simulation rendering.

Top-bar controls are also lane-owned. `sinr-live` owns live presentation
controls such as beam density, beam info, camera preset, spotlight, and
HO-slow. MODQN cell preview and MODQN proof lanes keep the global mode/playback
controls but do not inherit those SINR presentation controls. Artifact replay
may keep playback, UI presentation mode, replay speed, and display-only UE
focus/filter controls.

Lane-specific sidebars are part of viewport ownership:

- `sinr-live`: left = SINR controls; right = live status.
- `modqn-live-cell-preview`: left = replay/training/jobs controls; right = live
  status only.
- `modqn-replay-proof`: left = replay cue toggle; right = MODQN evidence only.
- `artifact-replay`: left/right = artifact replay/truth only.

Artifact replay also source-gates live-only decorative and diagnostic effects:
legacy earth-fixed cells, ambient footprint rings, handover links, live
handover arrows, ground shockwaves, serving ripples, UAV, and handover toast
must not mount on artifact-owned frames.
Spotlight/fog/point-light cinematic effects are also live-SINR effects and must
be gated by the scene lane render plan.
Artifact frames use a dedicated artifact scene composer and must not call the
live `useSimulation` or live `useBeamViz` composer.

`src/scene/sceneLaneRenderPlan.ts` owns lane/source compatibility. Live lanes
must receive `sceneSource=live-sim`; `artifact-replay` must receive
`sceneSource=artifact-replay`. Incompatible pairs fail closed by disabling both
live-only effects and artifact-only diagnostics.

Handover story overlays are lane-owned:

- `sinr-live` uses the existing live SINR beam and handover visuals.
- `modqn-live-cell-preview` may mount the shared profile-derived story layer
  for active/inactive/next-slot cell hopping and focused intra/inter cues; it
  must state that this is not baseline proof.
- `modqn-replay-proof` may show only producer-backed replay switch/decision
  cues. Missing active-beam mask or hopping schedule is a source gap and must
  not be animated.
- `artifact-replay` remains artifact-owned and does not mount the MODQN
  profile-derived story overlay.

## Shared Surfaces

These surfaces may remain shared:

- `Canvas`, camera controls, lighting, base ground scene, and telemetry shell.
- Plain visual primitives when their inputs are lane-owned.
- Sidebar and HUD components that present lane state without changing truth.
- Display-only scale and material helpers.

These surfaces need lane ownership:

- Viewport proof layers.
- Beam/cell/replay orchestration.
- Source-specific telemetry attributes.
- Sidebar tabs that can trigger a different viewport proof story.
- HUDs and status banners that imply a source or decision owner.

## Change Checklist

Before changing scene rendering:

1. Identify the target scene lane.
2. Identify the truth source.
3. Confirm whether the change is a primitive reuse or a composer/lane policy
   change.
4. Update the lane matrix if the viewport proof story changes.
5. Add or update a validator that checks absence of the conflicting layers.
6. Run the focused validators and a browser smoke for the affected lane.

## Completed Follow-Ups

- MODQN replay proof viewport has an explicit replay cue panel toggle before the
  3D proof layer can mount.
- Focused cell beam cone telemetry uses rendered-object count.
- User-trained provenance copy distinguishes paper-faithful, user-trained,
  fallback, and unavailable decision-overlay evidence without adding truth.
- `MainScene` uses a lane render plan for orchestration while preserving shared
  primitives.
- Top-bar controls are lane-owned: live density/callout/camera/spotlight/HO-slow
  controls are limited to `sinr-live`.
- Artifact replay now routes through a dedicated artifact scene composer, so
  live simulation and live beam composition hooks are not entered for artifact
  frames.
- Handover Story Layer added: MODQN live cell preview gets profile-derived
  active/inactive/next-slot and focused intra/inter cues, while MODQN replay
  proof reports beam-hopping source gap instead of fake hopping animation.
