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
| `sinr-live` | live SINR demo | live Walker simulator / configured profile plus `sinrLiveCells` cell-truth trajectory for D4 focus | live satellites, live SINR beams, SINR handover effects, diagnostics, `sinrLiveCells` source-time handover rail for cell-truth focus, handover-cinema candidate-beam highlight + SINR explainer + focus-scoped old/new off-axis beam pair (`sinr-offset` / `live-truth` claim), SINR-serving mosaic (UE markers coloured by serving beam — its OWN layer, NOT the MODQN cell overlay) + aggregate readout (served N/N, per-beam load, mean SINR; `sinr-serving` claim, always-on ambient default) | MODQN replay proof, MODQN cell overlay |
| `modqn-live-cell-preview` | MODQN live preview | live Walker simulator for geometry/SINR plus explicit MODQN decision overlay | hex cell overlay, cell beam cones, satellite markers, director cinema, scene HUD; the all-UE service map + per-cell UE-count badges + service readout/legend/diagnostics grid + phase-3 beam-load cylinder/particles are the **service-allocation family, producer-gated and PARKED OFF by default** (S-FLAG-2); clean cell hopping state, explicit visual layer presets, overlay-labeled handover cues/decision rail | MODQN replay proof, legacy live beam cones, decorative live effects, artifact overlays, the service-allocation family while the producer baseline is degenerate |
| `modqn-replay-proof` | MODQN evidence proof | immutable MODQN replay artifact/display state | replay proof layer, source-backed or display-proxy replay beams, focused decision trace, producer-horizon replay rail | live cell preview, live SINR beams, artifact overlays, live Walker forecast markers |
| `artifact-replay` | visual-showcase replay | immutable `visual-showcase-v1` artifact | artifact-provided frame content, replay controls, artifact-owned event rail | live cell preview, MODQN replay proof, live SINR proof effects |

## Non-3D Decision Metrics (Dashboard view removed)

History: the MODQN dashboard first lived as a squished bottom dock (R1), then C3
moved it into a full-area **Dashboard view** toggled by a top-level
`ViewModeToggle` (3D Scene ↔ Dashboard, `?view=dashboard`). **C5 removed that
Dashboard view and the `ViewModeToggle`**: the app now always renders the 3D
**Scene** + sidebars, with no view switching. The pipeline **flowchart** is
deferred to a future, paper-grade MODQN data-flow diagram project; its component
code (`AlgorithmDock.tsx`, `AlgorithmFlowchart.tsx`, `ViewModeToggle.tsx`) is
**retained on disk but no longer mounted**, so it can be revived for that
project. `appPersistence` still exports the `?view` helpers for the same reason.

What survives in the UI is the **per-frame MODQN decision metric tiles** (C4):
`AlgorithmDashboard` takes a `content` prop (`'metrics' | 'flowchart' | 'all'`,
stamped as `data-content`). App mounts it with `content="metrics"` +
`variant="sidebar"` in the **artifact-replay right sidebar** (Scene view), so the
reward scalar/components, objective ω weights, selected action + top scores,
serving, handover, and SINR/throughput read out **co-visible with the 3D replay
and update per frame**. It is display-only (Rule#6): it reads the same
`visual-showcase-v1` truth through `buildDashboardSeriesModel`, keeps the INV-1
provenance chips, and fails closed with `source gap - not shown`. The sidebar
metrics are lane-owned — mounted only inside the `artifact-replay` right-sidebar
branch, never on a live lane.

`AlgorithmDashboard` imports no Three/scene/viz symbols and mounts no `<Canvas>`;
it is a normal sidebar child and is not a second proof lane. (The retained but
unmounted `AlgorithmDock` / `LiveTelemetryPanel` keep the same no-3D contract.)

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

## Lane Experience Switcher

`LaneExperienceBar` (`src/ui/LaneExperienceBar.tsx`) is the single top-level
in-app entry point for the primary experience axis. It exposes two top-level
segments, `SINR` and `MODQN`, while the authoritative `SceneLane` enum remains
four-valued (`sinr-live`, `modqn-live-cell-preview`, `modqn-replay-proof`,
`artifact-replay`). `ModqnViewToggle` is the in-MODQN sub-view control that
selects Live / Proof / Artifact beneath the single MODQN top tab.

The nav surface is intentionally non-injective: all three MODQN sub-lanes map
back to the active MODQN top segment, and `App.handleExperienceChange`
translates the selected lane into the combination of `sceneSource` (live-sim vs
artifact-replay), `appMode` (SINR vs MODQN), and the
`modqnReplayProofRequested` flag. Before this control,
`sceneSource` had no setter at all — the entire `artifact-replay` lane (and its
flowchart, Plane-C dashboard, satellite compass, and real-artifact Director
cinematic) was reachable only via the `?sceneSource=artifact-replay` URL param,
and the `modqn-replay-proof` lane was three sidebar clicks deep.

The transition is governance-safe, NOT a naive `setSceneSource`:

- It cancels any armed-but-unfired or active Director focus
  (`cancelPendingLiveFocus` + `camera.exitDirectorFocus`) on every switch so a
  cinematic sat-pair pose cannot leak across lanes.
- Leaving `artifact-replay` tears down the artifact-replay state
  (`showcaseArtifact`, `showcaseArtifactSource`, `showcaseError`,
  `showcaseLoading`) so a re-entry re-runs the artifact fetch and the FIX-1
  honesty badge can never show stale provenance from a previous visit.
- It re-keys the lane through the existing `sceneSource`-dependent effects (the
  artifact fetch at the `sceneSource === 'artifact-replay'` guard and the
  fail-closed render gate `shouldRenderMainScene`), so a switch INTO
  `artifact-replay` still fails closed (shows the artifact-scene-fail-closed
  placeholder) while the artifact streams, and never inherits live overlays.
- `syncSceneSourceToUrl` mirrors the applied lane into the URL so it stays
  deep-linkable and reload-stable. This is display-only — it follows state, it
  never drives truth.

`LaneExperienceBar` is a governance Shared Surface, not a new viewport proof
layer: it imports no three / react-three / Canvas symbol and mounts no `<Canvas>`,
so it needs no lane-matrix row. `App` mounts it exactly once, fed the resolved
`sceneLane` as its value. `validate:frontend:scene-lane-governance` locks the
single lane-owned mount, the no-3D-import property, and the governance-safe
transition (the Director-focus cancel on switch).

## Current Implementation Contract

`src/app/sceneLane.ts` resolves the lane from app state. The initial contract is:

- `sceneSource=artifact-replay` resolves to `artifact-replay`.
- `appMode=modqn-demo` with `sceneSource=live-sim` resolves to
  `modqn-live-cell-preview`.
- `appMode=sinr-experiment` with `sceneSource=live-sim` resolves to `sinr-live`.
- `modqn-replay-proof` is selected only by an explicit MODQN proof entry
  (`ModqnViewToggle` / replay cue proof control), which sets
  `modqnReplayProofRequested`. It is not the default MODQN viewport lane.

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
- `modqn-live-cell-preview`: left = the unified Evidence / Replay rail only (the
  decision trace + the replay-proof toggle); right = live status (default) +
  co-visible opt-in MODQN evidence. **S4** moved the Setup power tools (training /
  jobs / the ω-weight editor `ModqnObjectiveTab`) off the left rail into an opt-in
  **Advanced setup drawer** (`AdvancedSetupDrawer`), so the default MODQN left
  surface is the evidence/replay story, not a training console. The MODQN evidence
  tab (`ArtifactPicker` / `RewardCurvePanel` / `DecisionVizPanel`, bundle
  diagnostics) is reachable on the right rail without entering the dedicated
  replay-proof lane; the drawer + the evidence tab are display-only / overlay-demo
  against the loaded bundle and never assert producer proof. `live` stays the
  default right tab; `modqn` is opt-in. **S-ADV-4** relocated the legacy Top-K
  decision preview off the default Evidence rail into the Advanced drawer
  (`ModqnTopKDecisionPreview`) — on the degenerate baseline producer artifact its
  rows are an empty/fail-closed "top-K" with no dense-Q proof, so the default
  Evidence rail keeps only the meaningful disclosure rows (provenance / mode /
  source gaps / active ω) + bundle manifest. It is a pure UI-mount move: the same
  `buildDecisionTrace` (which still feeds the provenance fallback status) renders
  the same section/testids in the drawer, mutating no producer or live truth.
- `modqn-replay-proof`: left = unified Evidence / Replay rail; right = MODQN evidence only.
- `artifact-replay`: left = Evidence rail (artifact source summary); right = artifact truth only.

All three MODQN sub-lanes share that single Evidence / Replay left rail (no
per-sub-lane reshuffle), and the Advanced setup drawer is gated on the MODQN
lanes (`sceneLane !== 'sinr-live'`) — SINR never shows the Setup tools.

Every MODQN lane replays a **degenerate baseline run** (the pinned producer
artifact: 100 UEs on one beam, 0 handovers, 1 satellite — see the baseline MODQN
producer-data defects report). App therefore mounts a persistent, non-citable
`DegenerateDataBanner` ("…do not cite. Awaiting a non-degenerate producer
artifact.") across the top of every MODQN lane (gated `sceneLane !== 'sinr-live'`);
the only removal path is to leave MODQN for the SINR tab.

The `Advanced setup` drawer is also the home for optional MODQN display controls.
`ModqnAdvancedDisplayControls` exposes the visual-layer preset control
(`modqn-layer-preset-control`) there, not in the top `ControlBar`. The live
MODQN decision-policy toggle (`modqn-decision-policy-control`) is shown only on
`modqn-live-cell-preview`; replay-proof and artifact lanes keep the display
controls but do not expose a live handover-policy selector. The decision-policy
toggle flips the live handover decision between the paper-faithful decision
overlay (`decision-overlay-on-live-sinr`) and the deprecated heuristic omega
scoring (`omega-heuristic`) WITHIN `modqn-demo`, with no `appMode` switch. The
`omega-heuristic` mode is explicitly NOT paper MODQN: whenever it is active on
the live-cell preview lane App co-mounts the persistent
`HeuristicNotPaperBanner` ("Heuristic ω-scoring — NOT paper MODQN") — the mode
is never surfaced without its disclosure. It stays non-persistable
(`runtimeControls.persistHandoverMode` skips it) and is reachable only through
the on-screen live-cell drawer toggle, never a keyboard shortcut or URL handler.
The lane experience switcher restores `decision-overlay-on-live-sinr` when it
moves to a MODQN replay/artifact lane so the replay-proof toggle (which requires
the decision overlay) keeps working and the banner clears.

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

The MODQN **service-allocation overlay family** is producer-gated (S-FLAG-2). The
all-UE service map (UE marker colouring + per-cell UE-count badges), its HUD
readout / legend / diagnostics grid, and the phase-3 beam-load cylinder + upload
particles all replay the degenerate producer baseline (100 UEs on one beam, 0
handovers, 1 satellite — see the baseline MODQN producer-data defects report), so
the map-wide allocation is meaningless noise that drowns the handover-cinema north
star. The whole family is therefore PARKED OFF by default behind a single
producer-readiness gate (`showModqnServiceAllocation`, computed from
`MODQN_SERVICE_ALLOCATION_PRODUCER_READY` in `sceneLaneRenderPlan.ts`), while the
code + data path stays intact (it is the G3 dense-Q proof scaffolding). The default
`modqn-live-cell-preview` surface keeps the hex cell overlay, cell beam cones,
satellite markers, director cinema, and the scene HUD. The family is `modqn-live-cell-preview`
ONLY (the gate is AND-ed with `showCellOverlay`, so it can never leak onto a SINR /
replay-proof / artifact lane) and un-parks in one move when the producer dense-Q
export plus the four baseline-defect fixes land
(`docs/handoff/producer-dense-q-export-request.md`); a `?modqnServiceAllocation=1`
URL override force-enables it for dev/validator render-path proof without flipping
the production default. The preset descriptions below describe the family when it is
un-parked.

MODQN live-cell visual presets are lane-owned:

- **Minimal** is the default (S-ADV-3). It shows the hex cell rings only — no
  service map, no UE-count badges, no beam cones, no profile-derived story cues,
  and no handover arcs. It is the clean default surface (hex overlay + cones +
  satellite markers + director cinema + scene HUD), and it keeps the default
  minimal even after the producer un-park flips the service-allocation gate on (a
  user must switch to Baseline / Service in the Advanced setup drawer to inspect
  the all-UE map). The richer presets below are an explicit Advanced opt-in.
- **Baseline Faithful** shows the 100-UE service map,
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
  not producer proof. The next-slot cell-change arcs (`CellHandoverArcs`) carry an
  explicit visible honesty caption — "Next-slot cell changes (synthetic preview)"
  (S-ADV-3) — so the per-arc identity labels are never mistaken for producer-recorded
  handover events.
- **Debug** may additionally show footprint ellipses and diagnostic surfaces.
  For MODQN live-cell preview, this can include compact HUD diagnostics for
  slot duration, next-slot cell changes, visible serving satellites, and active
  beam ids. These diagnostics must remain `source=profile-derived-demo` /
  `claimKind=overlay-demo` and must not appear in replay proof or artifact
  lanes. It is not the default presentation surface.

### MODQN degenerate-data parking — producer un-park checklist (S-DOC-6)

Every MODQN lane currently replays a **degenerate producer baseline** (1 satellite,
100 UEs on one beam, 0 handovers, flat SINR — see the baseline MODQN producer-data
defects report). The 2026-06-12 consolidation (S-FLAG-2 / S-ADV-3 / S-ADV-4 /
S-LABEL-5) THINNED the default MODQN-LIVE surface to the clean hex overlay + cones +
satellite markers + director cinema + scene HUD, parking the degenerate readouts
behind flags / Advanced **without deleting code or data paths** (it is the G3
dense-Q proof scaffolding). What is parked, where it lives, and how to revive it:

| Parked surface | Gate / location now | Un-park action |
|---|---|---|
| All-UE service map, UE-count badges, HUD service readout/legend/diagnostics, phase-3 beam-load cylinder + upload particles | `showModqnServiceAllocation` (= `showCellOverlay && modqnServiceAllocationEnabled`), default OFF via `MODQN_SERVICE_ALLOCATION_PRODUCER_READY=false` | Flip `MODQN_SERVICE_ALLOCATION_PRODUCER_READY` true (or wire a runtime producer-readiness signal into the render-plan input); `?modqnServiceAllocation=1` is the dev/validator override |
| Rich cell layers (service map, story cues, next-slot arcs) off the default preset | default preset `minimal` (`DEFAULT_MODQN_VISUAL_LAYER_PRESET`) | User opt-in to Baseline / Service / Explain / Debug in the Advanced setup drawer (kept) |
| Legacy Top-K decision preview | relocated to the Advanced setup drawer (`ModqnTopKDecisionPreview`) | Goes live as real evidence once the producer ships dense-Q; consider re-homing to the default Evidence rail then |
| MODQN Proof sub-view | hidden until `canToggleModqnReplayProof` | producer dense-Q export flips `buildModqnDenseQProof` → `proof-ready` (re-shows the Proof segment) |

**Single producer trigger:** the dense-Q export request
(`docs/handoff/producer-dense-q-export-request.md`) plus the four baseline-defect
fixes (spatial per-beam UE assignment / per-beam pattern+interference / reward-scale
normalization vs the 982× throughput dominance / real inter-intra HO events). When
that lands, the honesty relabels (S-LABEL-5: the ModqnSceneHud banner, the ω-editor
inert note, the DiagnosticsDrawer "not producer proof" note) must be revisited too.

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

- `sinr-live` D4 focus uses the `sinrLiveCells` cell-truth event index on the
  live Walker source horizon. Any legacy live-Walker / steered-beam forecast
  path must stay labeled `profile-derived-forecast` and must not be presented
  as synchronized cell-truth focus or producer proof.
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
live-window event index (`sinr-live` cell truth, MODQN preview live-Walker
overlay), replay proof stays on the producer horizon, and slow-motion
inspection is a display axis rather than a new source horizon.

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

- S-FLAG-2: the MODQN service-allocation overlay family (all-UE service map + UE
  marker colouring, per-cell UE-count badges, HUD service readout/legend/diagnostics
  grid, phase-3 beam-load cylinder + upload particles) is parked behind a single
  producer-readiness gate (`showModqnServiceAllocation`, default OFF) instead of the
  broad `showCellOverlay`. The degenerate producer baseline makes the all-UE
  allocation meaningless noise on the default `modqn-live-cell-preview` surface; the
  family is parked while the code + data path stays intact (G3 dense-Q proof
  scaffolding) and un-parks via the producer dense-Q export or the
  `?modqnServiceAllocation=1` dev/validator override. The default surface keeps the
  hex cell overlay, cell beam cones, satellite markers, director cinema, and the
  scene HUD. `validate:frontend:scene-lane-governance` locks the gate definition,
  the App/persistence un-park wiring, and every MainScene consumer (and that the gate
  is AND-ed with `showCellOverlay` so it cannot leak to a SINR/replay/artifact lane);
  `validate:phase-3:overlay-render:browser` positive-controls both directions (parked
  default renders nothing; the override restores the cylinder/particle render path).
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
- Phase-3 beam-load contention glow (`modqn-live-cell-preview`) derives from the
  same profile-derived cell-schedule per-UE (satId, beamIndex) assignment that
  `deriveModqnServiceMap` already uses to colour the UE markers and emit the
  per-cell UE-count badges. Provenance audit 2026-06-04 (FIX-7 finding #1) found
  its prior `sim.perUePositions` source is empty on this lane — the modqn-demo
  4-sat decision-overlay live path acquires no per-UE HandoverManager serving
  (even the primary `sim.serving.satId` is null), so the glow never fired. There
  is no producer per-UE serving on the live cell lane (that exists only on the
  replay `allUeServingHistory` path), so the glow is a per-UE visual encoding of
  the already-shown `source: 'profile-derived-demo'` / `claimKind: 'overlay-demo'`
  cell load, NOT producer r3 proof — it adds no claim the cell overlay does not
  already make. The enable gate (`showCellOverlay && serviceMap`) is unchanged, so
  no lane gains or loses the glow. Validators: `validate:frontend:scene-lane-governance`
  locks the C1 source (and forbids a regression to the empty `sim.perUePositions`
  serving), and `validate:phase-3:contention-render:browser` proves it actually
  fires on real live geometry (`data-beam-load-contention-ue-count > 0`).
- Phase-3 S4 3D beam-load cylinder + S5 upload particles (explain-handover cell
  preset) now have a durable real-render gate
  (`validate:phase-3:overlay-render:browser`, audit gap #2 — they were source-string
  mounts only). It switches to the explain-handover preset and asserts
  `data-beam-load-cylinder-rendered=true` + `data-upload-particle-rendered-count > 0`
  on real beam-load. These observables are MESH-derived: `BeamLoadCylinder`
  publishes its actual post-toggle `mesh.visible` and `BeamLoadUploadParticles`
  publishes the summed post-populate InstancedMesh `mesh.count`, so a broken
  mesh-write line is caught (a model-derived observable would pass while the mesh is
  visually broken). Both encode the FIX-7 overlay-demo contention model — no new
  claim. The same gate also asserts the MODQN profile-derived handover-story layer
  actually rendered its ring/cue meshes on the real live bundle: `HandoverStoryLayer`
  traverses its own scene subtree and publishes the visible-mesh count
  (`data-handover-story-rendered-mesh-count > 0`), a MESH-derived observable that
  catches a broken `<BeamSlotRing>` render — closing the audit's source-string-only
  handover-story surface (adversarial #4).
  `validate:frontend:scene-lane-governance` locks the component telemetry writes.
- Director focus is lane-gated by the render plan. On BOTH live-window lanes
  (`sinr-live`, `modqn-live-cell-preview`) the Intra/Inter-HO Focus buttons seek
  the live timeline to the next indexed handover of that kind, drop to the single
  0.25x slow-mo tier, and frame the involved sat/cell pair — mirroring the
  artifact cinematic, against a validated live-window event index (ITEM #C,
  `docs/live-walker-handover-event-map-sdd.md`). D4 splits the source claim:
  `sinr-live` uses `sinrLiveCells` cell-truth events with
  `data-live-director-focus-claim="live-truth"`, while
  `modqn-live-cell-preview` keeps the legacy live-Walker overlay/demo event
  index with `data-live-director-focus-claim="overlay-demo"`. Neither is
  producer proof. The seek target is always a real source-time
  (`data-live-director-focus-event-sec` = the resolved event's source second; the
  seek lands at that minus the lead-in). The live focus defers its camera command
  until the async live seek lands so the pose reads the post-seek scene frame,
  never a pre-seek/stale satellite pair, and cancels any armed-but-unfired focus on
  a lane switch or an exit/Escape during the arming window. On `artifact-replay` it
  is "cinematic replay": it seeks the replay to the next handover window, applies
  the same 0.25x speed as replay playback rate, and auto-restores. All are
  display-only — camera focus and replay/playback speed — and gate on real
  handover rail events of that kind (Rule#8). It stays inert on
  `modqn-replay-proof` and on any source-incompatible lane. Validators:
  `validate:phase-c:camera-preset`, `validate:phase-c:live-walker-focus-window`,
  `validate:phase-c:director-cinematic:live:browser`,
  `validate:phase-c:handover-cinema:browser`, and
  `validate:live-walker:handover-event-focus`.
  - Fidelity limits (live lanes only): `sinr-live` D4 now reuses the same
    `sinrLiveCells` source for the event, explainer, candidate highlight, focused
    old/new beam pair, and camera target. The MODQN live-cell preview still uses
    the legacy live-Walker overlay/demo forecast path and must keep that claim
    label. Neither path is a producer-recorded MODQN replay. D6 adds only a
    consumer readiness/source-gap gate for producer-backed MODQN replay cinema;
    current artifacts stay blocked until one producer sample contains event ID,
    renderable geometry, reward, masks, and dense-Q proof.
- Handover cinema (S1/D4) is lane-owned to `sinr-live` and additive over the
  Director focus above. It wraps the existing Director handlers
  (`useHandoverCinema` — arm / intra-inter filter / exit, never a rewrite).
  S1 first used the live Walker event index; D4 supersedes the SINR focus path
  with a `sinrLiveCells` cell-truth event index while keeping the legacy
  live-Walker path labeled for MODQN live-cell overlay/demo use. On `sinr-live`,
  the focus surfaces below are driven by the same cell-truth event
  (`sourceOwner=sinr-live-cell-truth`, source time, event ID, UE ID, cell IDs,
  off-axis telemetry; no producer dependency, `docs/handover-cinema-sdd.md` §7):
  - **Candidate-beam highlight** (`CandidateBeamHighlight`, `src/viz/`): coloured
    ground rings on the old/new candidates of the focused handover, using the
    existing handover-role colours. Cell-truth events place the rings from the
    earth-fixed cell IDs instead of the legacy steered-beam positions. It is
    gated by the render plan flag `showCandidateHandoverHighlight`
    (= `showSinrLiveViewport && cinematicMode === 'director'`) — sinr-live ONLY,
    inert on
    `modqn-live-cell-preview`, `modqn-replay-proof` (Rule#8), and `artifact-replay`.
    It is display-only (reads geometry fields only; no SINR/decision payload in
    the scene command, alters no truth) and publishes a MESH-derived observable
    (`data-candidate-handover-highlight-rendered-count` on the canvas) so the
    validator proves the rings actually drew.
  - **SINR explainer** (`SinrOffsetExplainer`, `src/ui/`): a floating, focus-scoped
    card that explains the handover in SINR terms only — old/new SINR, delta,
    the SINR-offset rule, off-axis, and old/new sat/cell/beam IDs. It is stamped
    with source owner, event ID, source time, UE ID, and
    `data-claim-kind="sinr-offset"`; it NEVER mentions MODQN/producer and NEVER
    claims decision proof. It renders only while the cinema is engaged and tears
    down on exit.
  - **Focused old/new beam pair** (`SinrLiveCellBeamCones`, `src/viz/`): D4 mounts
    a separate focus-only pair for the old/new cell-truth beams. The ambient
    all-cell cone layer remains parked on every lane; D4 does not globally
    re-enable the rejected full-viewport cone render.
  The candidate command threaded to the scene is geometry-only
  (`RuntimeCandidateHighlightCommand` — source/event/cell geometry, no
  SINR/decision). Validators:
  `validate:phase-c:handover-cinema:model` (pure lane-gating + SINR projection,
  never fabricates), `validate:phase-c:handover-cinema:browser` (arm on sinr-live →
  explainer `sinr-offset` + cell-truth highlight/pair meshes + 0.25x + camera move
  → exit restores + tears down), `validate:live-walker:handover-event-focus`
  (legacy live-Walker and D4 cell-truth focus owners stay separated), and
  `validate:frontend:scene-lane-governance` locks the render-plan gate, the gated
  MainScene mount, the mesh observables, the ambient-cone parked state, and the
  explainer claim/source stamps.
- Cinema quality (CQ1/CQ2) refines the SAME director-focus surface — it adds no new
  viewport lane, layer, or proof claim, only display-only camera motion + pacing
  (Rule#6), so the lane matrix is unchanged and the existing director-cinematic +
  handover-cinema gates (camera-moves + restores) still cover it:
  - **CQ1 moving camera**: after the acquire tween lands, the focus no longer holds a
    single static pose — it gently ORBITS the subject (slow azimuth arc + subtle
    dolly/rise breathing, `advanceDirectorFocusOrbit` in `MainScene`, shared by the
    live `SceneContent` and artifact `useDirectorCameraFocus` consumers). The framing
    is also pulled WIDER (`directorFocusPose` intra offset up 220→320 / back 260→440;
    inter-pair fit 1.35→1.6, min-back 260→360). Orbit is suppressed under reduced
    motion and cleared by any restore / force-restore / re-target / manual preset.
  - **CQ2 pacing**: the slow-mo tier is raised `0.05x → 0.25x`
    (`DIRECTOR_FOCUS_SPEED`, `usePlaybackControls`) and the focus HOLD gains a
    wall-clock auto-exit (`FOCUS_AUTO_EXIT_MS` in `useCameraControls`) so the live
    cinema — which has no window-based auto-end — self-finishes instead of holding
    until the user hits Exit. Both are display-only speed/timing (dt scales in
    lockstep; SINR/HO/decision truth untouched). The three director/cinema browser
    gates assert the new `0.25x` tier.
- SINR-serving mosaic (S2) is lane-owned to `sinr-live` and is the always-on ambient
  default (NOT director-gated) that proves G3 — every UE marker is coloured by its
  serving beam (by SINR), so the ~100 UE dots partition into a coloured cell mosaic; a
  handover = a dot changes colour. It is a DISTINCT SINR-serving visualisation, NOT the
  MODQN cell overlay (`deriveModqnServiceMap`): a separate pure model
  (`src/scene/sinrServingMosaic.ts`) colours UEs by a STABLE hash of their serving
  (satId, beamId) — never the display-order `satelliteVisualIndex`, so a dot recolours
  IFF its serving beam actually changed. It is gated by the render-plan flag
  `showSinrServingMosaic` (= `showSinrLiveViewport`), so it is inert on
  `modqn-live-cell-preview` (which owns the MODQN cell overlay instead),
  `modqn-replay-proof` (Rule#8), and `artifact-replay`.
  - **3D colouring** reuses the existing shared `GroundScene` instanced UE markers
    (`markerColor`): on `sinr-live` MainScene feeds them mosaic colours; on the MODQN
    lane it feeds `deriveModqnServiceMap` colours — the two never mix (the primary UE
    stays the red focus anchor; only the secondary population is mosaic-coloured).
    `GroundScene` publishes a MESH-derived observable
    (`data-sinr-serving-mosaic-color-count` = distinct colours actually written to the
    `instanceColor` buffer) so the validator proves the partition really rendered.
  - **Aggregate readout** (`SinrServingAggregate`, `src/ui/`): a lane-gated DOM HUD fed
    ONLY by the live `SimState.perUePositions` serving truth. It shows `served N/N`, the
    distinct serving-beam count, per-beam load, and the mean served SINR, stamped
    `data-claim-kind="sinr-serving"`; it NEVER mentions MODQN/producer and claims no
    decision proof. It is the ambient low-density default (Rule#10).
  - **Default population:** the `sinr-experiment` runtime UE-count default is raised from
    1 to 100 (matching the TopologyTab's already-shown `DEFAULT_UE_COUNT` — the runtime
    falling back to 1 was a UI/runtime mismatch) so the ambient mosaic is the literal
    default screen (SDD §3.1/§5.4). An explicit Advanced override still wins.
  - **Map-wide spread (coverage is the constellation's job, not a UE knob):** the
    `sinr-experiment` profile (`hobs-2024-candidate-rich`) now carries a uniform-rectangle
    `ueDistribution` over the 200×90 km user area (same as the MODQN paper profile), so the
    100 UEs spread across the WHOLE map like a real population. This is served because a
    single candidate-rich satellite reaches ~154 km off-nadir (16 km footprint + 27.6 km
    7-beam lattice + 110.5 km steering @ 12°) — wider than the 100 km map half-width — and
    several satellites are overhead (5 shells). The PRIMARY UE still anchors at the observer
    so the handover cinema is unaffected. (An earlier S2 cut clustered UEs by sizing the
    distribution to the static beam-lattice radius ~43 km, which wrongly ignored the
    steering reach — fixed.)
  Validators: `validate:phase-c:sinr-serving-mosaic:model` (pure colour stability +
  aggregate counting, never fabricates), `validate:phase-c:sinr-serving-mosaic:browser`
  (real sinr-live: aggregate `served N/N` with a multi-beam partition + finite mean SINR
  + `sinr-serving` claim + the mesh distinct-colour count > 1; absent on the MODQN lane),
  and `validate:frontend:scene-lane-governance` locks the render-plan gate, the distinct
  module (no MODQN-map import), the gated MainScene mount, the mesh observable, and the
  aggregate claim stamp.
