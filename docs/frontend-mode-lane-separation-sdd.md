# Frontend Mode and Scene Lane Separation SDD

## Status

Accepted for the initial governance and C1 implementation slice on 2026-05-29.
Implemented through the lane/source and artifact-control closure slice on
2026-05-30.

## Problem

The frontend accumulated multiple visual systems under broad runtime flags. The
most visible failure is `modqn-demo` in `live-sim`, where the Phase I
earth-fixed cell preview and the older MODQN replay proof layer can both occupy
the viewport. The result mixes cell hopping, source-proxy replay beams, live
satellite markers, handover arcs, and status panels into one visual story.

The bug is not one beam formula. It is a boundary problem: the renderer has
shared primitives but not shared ownership rules.

## Goals

- Keep SINR and MODQN from mounting conflicting viewport proof layers.
- Preserve reusable primitives and shared renderer infrastructure.
- Keep `sinr-experiment` as the stable demonstration/safety lane.
- Keep `modqn-demo` as the baseline-reproduction experiment lane.
- Make the rules discoverable for future agents through docs, ADR, AGENTS, and
  validators.

## Non-Goals

- Do not rewrite the live simulator.
- Do not rewrite MODQN training, rewards, actions, or artifact semantics.
- Do not vendor new `ntn-sim-core` modules in this slice.
- Do not duplicate the whole renderer per mode.
- Do not enable MODQN replay proof in the viewport without the explicit proof
  lane UI.

## Current Diagnosis

Current code has two independent axes:

- `appMode`, persisted as `sinr-experiment` or `modqn-demo`.
- `sceneSource`, read from URL as `live-sim` or `artifact-replay`.

The problematic gate was:

```tsx
showModqnReplayScene={appMode === 'modqn-demo'}
```

That means MODQN replay proof mounted even when the viewport lane should have
been a live cell preview. It also meant `sceneSource=artifact-replay` could
still inherit MODQN replay proof if the persisted app mode was `modqn-demo`.

## Design

Introduce a small lane resolver:

```ts
type SceneLane =
  | 'sinr-live'
  | 'modqn-live-cell-preview'
  | 'modqn-replay-proof'
  | 'artifact-replay';
```

The resolver owns lane precedence:

1. `artifact-replay` wins over app mode.
2. An explicit proof viewport toggle in the MODQN replay cue panel may select
   `modqn-replay-proof`.
3. `modqn-demo + live-sim` selects `modqn-live-cell-preview`.
4. Everything else selects `sinr-live`.

The lane controls viewport proof booleans. `appMode` still controls profile
defaults, sidebars, and runtime parameters, but it must not directly mount a
proof layer.

## Source Ownership

| Surface | Owner | May compute truth? |
|---|---|---:|
| SINR live beams | live simulator / profile runtime | yes, via live engine only |
| MODQN live cell preview | Phase I cell schedule display | no, display-only cell schedule |
| MODQN replay proof | MODQN replay bundle display state | no, display immutable replay values |
| Artifact replay | `visual-showcase-v1` artifact | no, display immutable artifact values |
| Camera, materials, labels | `leo-beam-sim` renderer | no |

## C1 Implementation Slice

1. Add `src/app/sceneLane.ts`.
2. Resolve `sceneLane` in `App.tsx`.
3. Add `data-scene-lane` to the app shell and canvas shell for browser smoke.
4. Replace `showModqnReplayScene={appMode === 'modqn-demo'}` with a lane-derived
   boolean.
5. Make sidebar tabs and MODQN HUD/status banners lane-aware so artifact replay
   does not inherit MODQN training, jobs, evidence, or Phase I preview HUD from
   persisted app mode.
6. Fail closed while an artifact replay frame is not available, instead of
   rendering live simulation as a temporary fallback.
7. Gate live-only scene effects out of artifact replay frames.
8. Make artifact replay's top-bar handover status read-only instead of offering
   live handover mode switches.
9. Make MODQN overlay status copy source-neutral: live SINR reference plus MODQN
   replay decision overlay, not fixed paper-faithful claims.
10. Add static validator coverage so the old broad gate cannot return.
11. Update replay-layer validators to understand lane-gated proof mounting.
12. Add an explicit MODQN replay proof viewport toggle so the 3D proof layer can
    return only through `modqn-replay-proof`.
13. Move `MainScene` lane policy into `src/scene/sceneLaneRenderPlan.ts`, leaving
    shared primitives in the scene while centralizing viewport ownership.
14. Replace focused cell beam cone telemetry with `resolveCellBeamConeRenderCount`
    so the canvas dataset follows renderable cone items, not schedule length.
15. Label MODQN evidence provenance as paper-faithful, user-trained, fallback, or
    unavailable without implying live truth ownership.
16. Make sidebar tab sets lane-owned: cell preview keeps right-side live status,
    proof lane keeps right-side MODQN evidence, and artifact replay keeps
    artifact-only panels.
17. Make ControlBar controls lane-owned: `sinr-live` owns live beam density,
    beam info, camera preset, spotlight, and HO-slow controls; MODQN and
    artifact lanes do not inherit those controls.
18. Make `sceneLaneRenderPlan` enforce lane/source compatibility so incompatible
    live/artifact pairs fail closed instead of inheriting effects from either
    side.
19. Route artifact replay frames through a dedicated artifact scene composer so
    artifact-owned frames do not enter live `useSimulation` or live `useBeamViz`
    composition.
20. Move spotlight/fog/point-light cinematic effects under `sceneLaneRenderPlan`
    so they cannot bypass lane/source ownership.
21. Add the Handover Story Layer policy to `sceneLaneRenderPlan`: SINR live keeps
    the existing live handover visuals, MODQN live cell preview may mount a
    profile-derived demo story layer, MODQN replay proof stays source-backed and
    fail-closed for missing beam-hopping schedule, and artifact replay remains
    artifact-owned.

## Validation Requirements

Static validators must check:

- `App.tsx` imports and uses `resolveSceneLane`.
- The old `showModqnReplayScene={appMode === 'modqn-demo'}` gate is absent.
- `modqn-live-cell-preview` does not render `ModqnReplaySceneLayer`.
- `artifact-replay` does not render `ModqnReplaySceneLayer`.
- `modqn-replay-proof` is the only lane that enables the MODQN replay scene
  layer, and it requires the explicit proof viewport toggle.
- Governance docs and ADR exist.
- Artifact replay uses artifact-only sidebar tabs and hides MODQN live-cell HUD
  and training-service status surfaces.
- Artifact replay does not render live simulation while the artifact frame is
  loading or failed.
- Artifact replay source-gates legacy live-only effects from `MainScene`.
- Artifact replay top bar exposes a read-only artifact handover status.
- MODQN overlay Live status no longer hard-codes paper-faithful / pre-trained
  language.
- `modqn-live-cell-preview` does not expose a MODQN evidence right sidebar tab.
- `modqn-replay-proof` exposes only the replay cue left tab and MODQN evidence
  right tab.
- Artifact replay does not expose live beam density, beam info, camera preset,
  spotlight, or HO-slow top-bar controls.
- MODQN cell preview and MODQN proof lanes do not expose SINR-only beam density,
  beam info, camera preset, spotlight, or HO-slow top-bar controls.
- Scene render plan rejects incompatible lane/source pairs.
- Scene render plan disables spotlight/fog/point-light cinematic effects outside
  `sinr-live`.
- Artifact replay does not call the live simulation hook or live beam composer.
- Handover Story telemetry is lane-gated: `modqn-live-cell-preview` reports the
  profile-derived story layer, `modqn-replay-proof` reports a source gap instead
  of fake beam hopping when producer schedule truth is absent, and
  `artifact-replay` does not mount the profile-derived overlay.

Browser smoke should check at least:

- `modqn-demo + live-sim` reports `data-scene-lane=modqn-live-cell-preview`.
- Cell overlay telemetry is present.
- `data-modqn-replay-scene-layer` is absent or empty in the cell lane.
- Clicking the explicit replay proof viewport toggle changes the lane to
  `modqn-replay-proof`, hides the cell overlay, and shows MODQN evidence.
- `sceneSource=artifact-replay` with persisted `modqn-demo` reports
  `data-scene-lane=artifact-replay` and does not show MODQN viewport proof or
  MODQN training/evidence tabs.
- `sceneSource=artifact-replay` does not show live handover mode buttons in the
  top bar.
- `sceneSource=artifact-replay` does not show live beam density, beam info,
  camera preset, spotlight, or HO-slow top-bar controls.
- `sceneSource=artifact-replay` reports `data-live-simulation-enabled=0`.
- `modqn-demo + live-sim` does not show SINR-only beam density, beam info,
  camera preset, spotlight, or HO-slow top-bar controls.

## Follow-Up Slice Status

- C2 done: MODQN replay proof is controlled by the replay cue panel's explicit
  proof viewport toggle.
- C3 done: `MainScene` orchestration uses `sceneLaneRenderPlan` while preserving
  shared primitives.
- C4 done: schedule-count telemetry was replaced with rendered-object telemetry
  for
  focused cell beam cones.
- C5 done: user-trained provenance and fallback states report the
  current decision source without implying producer truth ownership.
- Sidebar lane ownership done: cell preview, proof, SINR, and artifact lanes no
  longer share right-panel ownership.
- Top-bar ownership done: SINR-only live controls no longer appear in MODQN or
  artifact lanes.
- Render-plan source compatibility done: live lanes and artifact lanes no
  longer accept each other's source discriminator for effect ownership.
- Artifact composer isolation done: artifact replay frames no longer enter the
  live simulation or live beam composition hooks.
- Cinematic effect ownership done: spotlight/fog/point-light effects are gated
  by `sceneLaneRenderPlan`.
- Handover Story first slice done: shared profile-derived story overlay is
  lane-gated to MODQN live cell preview, while replay proof and artifact replay
  preserve their source boundaries.
