# SDD: MainScene Renderer Decoupling & Multi-UE Visual Readiness

## Status

**Draft** — 2026-05-31. Acts as the architectural blueprint for simplifying the frontend 3D viewport, removing duplicate layouts, decoupling telemetry DOM mutations, and preparing the rendering pipeline for multi-UE handover visualizations.

---

## 1. Context & Problems

The `MainScene.tsx` component is the absolute rendering core of `leo-beam-sim`. While recent work successfully established `SceneLane` governance, the implementation left several architectural pain points that make future rendering additions difficult:

1. **Severe Code Duplication**:
   To prevent simulation side-effects during offline replay, the file was split into two internal components: `SceneContent` (for live lanes) and `ArtifactSceneContent` (for static artifact frames). However, this resulted in duplicating core R3F infrastructure:
   - `<PerspectiveCamera>` and `<OrbitControls>`
   - Hemisphere, Ambient, and Directional lighting setups
   - `<NTPUScene>` static terrain layout
   - `<GroundScene>` and `<SatelliteMarker>` loops
   Any change to base lighting, camera presets, or markers requires modifying both components.

2. **Telemetry Clutter**:
   More than 30 variables are written directly to `gl.domElement.dataset` in a massive `useEffect` block inside the rendering components to support headless Playwright smoke tests. This mixes DOM-level state reporting directly into the React-Three-Fiber render loop, making the JSX tree hard to read.

3. **Multi-UE Handover Visual Overhead**:
   With 100 UEs in MODQN demo mode, rendering beam cones, shockwaves, or arcs for every single UE leads to severe visual noise. The pipeline needs a clean way to handle **Focus UE vs. Background UE** styles, preparing the scene for event-driven highlight pulses.

---

## 2. Design Goals

- **Zero Duplicate Infrastructure**: Combine camera, lighting, terrain, and controls into a single shared `BaseSceneLayout` component.
- **Clean JSX Tree**: Remove all `gl.domElement.dataset` mutations from `SceneContent` and `ArtifactSceneContent`, moving them to an isolated telemetry helper.
- **Validator Parity**: Ensure that 100% of the existing scene-lane, handover-story, and render-isolation validators continue to pass perfectly without any regressions.
- **Multi-UE Visual Foundations**: Expose hooks to elegantly dim/scale background UEs while preserving high-contrast rendering for the Focus UE.

---

## 3. Proposed Architecture

### A. The Unified Rendering Tree
Instead of duplicating the camera, lights, and terrain inside the two conditional blocks, we will wrap them in a shared component tree:

```
MainScene (Component)
  └── Starfield
        └── Canvas
              └── BaseSceneLayout (Shared R3F Infrastructure)
                    ├── PerspectiveCamera & OrbitControls
                    ├── Ambient, Hemisphere, & Directional Lights
                    ├── NTPUScene (Terrain)
                    └── SceneLaneComposer (Lane-specific Layer Mounting)
                          ├── IF lane === 'artifact-replay'
                          │     └── ArtifactSceneLayers (SatelliteMarkers, GroundScene)
                          └── ELSE (Live Sim Lanes)
                                └── LiveSceneLayers
                                      ├── CellOverlay, CellBeamCones
                                      ├── HandoverStoryLayer, CellHandoverArcs
                                      ├── AmbientFootprintRings, ServingGroundRipple
                                      └── ModqnReplaySceneLayer, etc.
```

### B. Decoupled Telemetry Layer
We will extract all `gl.domElement.dataset` writes into a dedicated, side-effect-free React hook or component:
- `useSceneTelemetry({ sceneFrame, sceneLane, renderPlan, ... })`
This hook will run in a single unified effect, keeping the layout and rendering nodes 100% pure.

### C. Multi-UE Viewport Gating
We will formalize secondary UE dimming inside the layout:
- Primary/Focused UE: Standard scale/opacity, full visual overlay.
- Secondary UEs: Dimmed scale and opacity (configured via `secondaryOpacity=0.24`, `secondaryScale=0.72` on the `GroundScene` component, gated by `sceneLane`).

---

## 4. Phased Implementation Slices

### Slice R1: Extract Shared `BaseSceneLayout`
- Create a new component `src/scene/BaseSceneLayout.tsx` that owns `<PerspectiveCamera>`, `<OrbitControls>`, lights, and `<NTPUScene>`.
- Remove these elements from `SceneContent` and `ArtifactSceneContent`.
- Keep R3F `useThree` context binding functional, ensuring camera presets and tweens continue to work flawlessly.
- Run `validate:frontend:scene-lane-governance` to ensure layout structure parity.

### Slice R2: Decouple Telemetry Mutations
- Create `src/scene/useSceneTelemetry.tsx` containing the dataset attribute mutation block.
- Remove all `gl.domElement.dataset` mutations from `SceneContent` and `ArtifactSceneContent`.
- Mount `useSceneTelemetry` as a pure helper hook.
- Run existing validators to verify that all Playwright/smoke test data attributes are still correctly written to the canvas DOM element.

### Slice R3: Multi-UE Visual Scaling & Gating
- Clean up conditional flags in the JSX layout.
- Ensure `GroundScene` secondary UE styling is consistently wired across live and artifact lanes using the newly structured layout.
- Run all validator suites to confirm zero regressions.

---

## 5. Verification Checklist

Ensure the following commands run and pass perfectly after each slice:
```bash
npm run lint
npm run validate:frontend:scene-lane-governance
npm run validate:modqn:handover-story-layer
npm run validate:modqn:training-scene-source-gaps
```
