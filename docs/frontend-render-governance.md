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
- **Source horizon**: the time range owned by the truth source for a rail,
  scrubber, replay, or forecast. A UI horizon is not allowed to imply a longer
  producer or physics horizon than the source exports.

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
7. Within one scene lane, satellite geometry, SINR/SNR, handover events, and
   timeline/handover rail markers must share the same authoritative source or
   be explicitly labeled as an overlay/source gap.
8. A producer trace must use the producer trace horizon. It must not be
   displayed as a live Walker 20-minute or 2-hour handover timeline unless the
   producer exported that horizon.
9. A new viewport layer must update this matrix and add or update a validator
   before it ships.
10. Presentation mode defaults to low density. Any additional MODQN cell-lane
   visual effect must earn its place and must be gated explicitly.

## Lane Matrix

| Scene lane | Owner | Source | Allowed viewport proof | Must stay off |
|---|---|---|---|---|
| `sinr-live` | live SINR demo | live Walker simulator / configured profile | live satellites, live SINR beams, SINR handover effects, diagnostics, live Walker timeline/forecast rails | MODQN replay proof, MODQN cell overlay |
| `modqn-live-cell-preview` | MODQN live preview | live Walker simulator for geometry/SINR plus explicit MODQN decision overlay | cell overlay, all-UE service map, active cell UE-count badges, clean cell hopping state, explicit visual layer presets, overlay-labeled handover cues/decision rail | MODQN replay proof, legacy live beam cones, decorative live effects, artifact overlays |
| `modqn-replay-proof` | MODQN evidence proof | immutable MODQN replay artifact/display state | replay proof layer, source-backed or display-proxy replay beams, focused decision trace, producer-horizon replay rail | live cell preview, live SINR beams, artifact overlays, live Walker forecast markers |
| `artifact-replay` | visual-showcase replay | immutable `visual-showcase-v1` artifact | artifact-provided frame content, replay controls, artifact-owned event rail | live cell preview, MODQN replay proof, live SINR proof effects |

## Non-3D Dashboard Dock

`AlgorithmDock` (`src/showcase/dashboard/AlgorithmDock.tsx`) is the
full-width collapsible bottom non-3D dashboard surface. It is lane-aware:
`artifact-replay` renders the Plane-C `AlgorithmDashboard` against
`visual-showcase-v1` replay truth, while `modqn-live-cell-preview` renders the
Plane-A `LiveTelemetryPanel` against live training SSE telemetry. The live
panel is INV-1/2/3 guarded: every tile declares Plane A provenance, staleness
freezes sticky values or degrades offline, and missing producer channels render
`source gap - not shown` instead of fabricated reward curves, loss, Pareto,
Q-values, or learning-rate values.

The dock and both dashboard components import no Three/scene/viz symbols and
mount no `<Canvas>`. The dock is a normal flex child of `leo-app-shell`,
co-visible with the 3D row without viewport occlusion, and is not a second
proof lane.

The INV-1 truth-plane, INV-2 telemetry-status (the staleness `!=` offline
distinction and the frozen-tile filter), and INV-3 source-gap colours are
defined once as value-preserving `:root` design tokens in `src/styles/main.scss`
(`--leo-plane-*`, `--leo-telemetry-*`, `--leo-source-gap-*`). The migrated
selectors reference those tokens instead of scattered hex, and
`validate:frontend:scene-lane-governance` locks both the token values and the
selector references so an INV colour cannot silently drift or be re-hardcoded.

## Artifact Satellite Azimuth HUD (FIX-5 Option C)

`ArtifactSatelliteCompass` (`src/ui/ArtifactSatelliteCompass.tsx`) is a 2D DOM
(SVG) compass-rose HUD shown only on the `artifact-replay` lane. The producer
`eci-km-no-earth-rotation-proxy` flattens the satellites to the ground plane
(Y=0) on a ~7151-unit ring (the real LEO orbital radius), so the 3D markers sit
far off-frame laterally. The HUD surfaces the truthful ground-plane azimuth
(`atan2(x, z)` of the already-projected `worldPos`) so the viewer can see WHERE
the satellites are without the scene fabricating overhead geometry.

It is a governance Shared Surface, NOT a new viewport proof layer: it mounts no
`<Canvas>` and imports no three / scene / viz symbol, so it adds no 3D proof
story and needs no lane-matrix row. It stays lane-OWNED — `App.tsx` mounts it
only when `sceneLane === 'artifact-replay'`, fed `replaySceneFrame.satellites`.

It is HONEST and display-only: it renders ONLY the real azimuth + ring radius,
never the missing elevation (Option A's producer Earth-fixed projection is
blocked by a principled `earthRotationModel` source gap; Option B's leo-side
overhead placement would fabricate the Y dimension — both rejected). It carries
a fixed honesty caption stating "orbital azimuth only (ECI proxy, no
elevation/Earth-rotation)" and a data-driven `data-has-elevation` flag.

It renders ONLY for the flattened ECI proxy frame
(`deriveSatelliteAzimuths().isFlatEciProxy`: all surfaced satellites are
`coordFrameKind === 'eci-km-no-earth-rotation-proxy'` with no elevation). A
standard `ecef-km` artifact (real overhead geometry the 3D scene draws
correctly), a mixed/unknown frame, or any elevation-bearing frame gets NO
compass — the proxy "no elevation" caption would otherwise overclaim a
limitation that frame does not have. This also suppresses the misleading compass
on the FIX-1 synthetic fixture (which carries elevation while the caption would
claim none).
The azimuth math is a pure, unit-tested helper (`deriveSatelliteAzimuths`).
`validate:frontend:scene-lane-governance` locks the honesty caption, the
no-3D-import property, and the lane-gated single mount.

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

MODQN live-cell visual presets are lane-owned:

- **Baseline Faithful** is the default. It shows the 100-UE service map,
  satellite/cell coloring, active cell overlay, per-cell UE-count badges, and
  a compact profile-derived service readout for slot/L/cell/UE allocation.
  It keeps beam cones, footprint ellipses, foreground handover cues, and debug
  diagnostics off.
- **Service Allocation** may add low-opacity, satellite-tinted cell beam cones
  for all serving satellites so the 100-UE / multi-satellite allocation can be
  inspected. It stays profile-derived overlay/demo, keeps foreground handover
  cues off, and must not appear in replay proof or artifact lanes.
- **Explain Handover** may add focused beam cones and capped profile-derived
  intra/inter cell reassignment cues. These cues are overlay/demo presentation,
  not producer proof.
- **Debug** may additionally show footprint ellipses and diagnostic surfaces.
  For MODQN live-cell preview, this can include compact HUD diagnostics for
  slot duration, next-slot cell changes, visible serving satellites, and active
  beam ids. These diagnostics must remain `source=profile-derived-demo` /
  `claimKind=overlay-demo` and must not appear in replay proof or artifact
  lanes. It is not the default presentation surface.

Handover story overlays are lane-owned:

- `sinr-live` uses the existing live SINR beam and handover visuals.
- `modqn-live-cell-preview` may mount the shared profile-derived story layer
  for active/inactive/next-slot cell hopping; foreground intra/inter event cues
  stay off in Baseline Faithful and may appear only through an explicit
  Explain/Debug visual preset as a capped non-proof overlay. It must state that
  this is not baseline proof.
- `modqn-replay-proof` may show only producer-backed replay switch/decision
  cues. Missing active-beam mask or hopping schedule is a source gap and must
  not be animated.
- `artifact-replay` remains artifact-owned and does not mount the MODQN
  profile-derived story overlay.

Timeline and handover rail ownership follows the same lane boundary:

- `sinr-live` may show live Walker observations or a profile-derived live
  forecast, but it must label forecasts as profile-derived and not producer
  proof.
- `modqn-live-cell-preview` may compare MODQN decisions against the live Walker
  SINR candidate set, but the rail must be labeled as an overlay on live Walker
  state.
- `modqn-replay-proof` must use the producer replay artifact's own time range.
  Legacy 10-second producer traces remain valid evidence surfaces, but they are
  not live Walker 20-minute or 2-hour timelines.
- `artifact-replay` uses only artifact-owned event timing and must fail closed
  on missing artifact event truth.

The planned right-sidebar 2-hour handover event map follows
`docs/live-walker-handover-event-map-sdd.md`: live lanes may use a validated
live Walker event index, replay proof stays on the producer horizon, and
slow-motion inspection is a display axis rather than a new source horizon.

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
3. Identify the source horizon for any timeline, scrubber, rail, marker, or
   forecast.
4. Confirm whether the change is a primitive reuse or a composer/lane policy
   change.
5. Update the lane matrix if the viewport proof story changes.
6. Add or update a validator that checks absence of the conflicting layers.
7. Run the focused validators and a browser smoke for the affected lane.

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
  active/inactive/next-slot cues without foregrounding them as source-backed
  primary-UE handover events, while MODQN replay proof reports beam-hopping
  source gap instead of fake hopping animation.
- MODQN live-cell preview now owns visual layer presets: Baseline Faithful
  shows an all-UE service map and active-cell UE counts; Service Allocation can
  add all-serving-satellite profile-derived beam cones; Explain/Debug can add
  capped profile-derived handover cues without changing replay proof claims.
  Debug can additionally expose profile-derived cell schedule diagnostics in
  the HUD while keeping Baseline Faithful, Service Allocation, and Explain
  Handover clean.
- Director focus is lane-gated by the render plan. On the live walker lanes
  (`sinr-live`, `modqn-live-cell-preview`) it is "live focus": camera focus +
  the single 0.05x slow-mo tier on the running sim. On `artifact-replay` it is
  "cinematic replay": it seeks the replay to the next handover window, applies
  the same 0.05x speed as replay playback rate, and auto-restores. Both are
  display-only — camera focus and replay/playback speed, which artifact-replay
  may own — and gate on real handover rail events of that kind (Rule#8). It
  stays inert on `modqn-replay-proof` and on any source-incompatible lane.
  Validator: `validate:phase-c:camera-preset`.
