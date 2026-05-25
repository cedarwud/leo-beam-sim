# Phase C Visual Scale Dual-Mode Mini-SDD

Status: draft for Phase C (post Phase E v1 ship to branches).
Date: 2026-05-25
Owner: `leo-beam-sim` live-scene visual scale + UE marker sizing + camera presets.
Target repo: `/home/u24/papers/project/leo-beam-sim`.
Cross-repo dependencies: NONE for any slice. Phase C is entirely live-renderer visual changes; replay artifacts are not touched.

## 0. Reading Order

Read before changing this SDD or starting implementation:

1. `.agent-memory/project_paper_faithful_vision.md` — user vision Phase C
   bullet (`Profile.sceneScale='paper-faithful' | 'demo-readability'; UE
   size relative footprint slider; Camera preset 切換`). Phase C is the
   literal answer to that bullet.
2. `.agent-memory/project_paper_faithful_vision.md` "Important technical
   facts" — `FOOTPRINT_RADIUS_WORLD = 56` fixed const at
   `src/scene/beam-geometry-pure.ts:46`; "大刀闊斧改
   `FOOTPRINT_RADIUS_WORLD = 56` 破壞 saved replay artifact scale 一致性；
   要走 sceneScale 系統". Phase C is the sceneScale system.
3. `.agent-memory/project_dev_drift_audit_2026-05-25.md` Rule 4 — mini-SDD
   釘 priority 才開 slice; this SDD is the priority anchor for Phase C.
4. `docs/phase-e-runtime-overrides-mini-sdd.md` — structural template +
   the existing `Topology` tab in `SignalTuningPanel` Phase C shares
   real-estate with. Phase C either extends that tab or adds a sibling
   `Scene scale` tab; SDD §5 decides.
5. `docs/sinr-runtime-parameter-contract.md` — Phase E already amended
   this with the `Topology Overrides (Phase E)` subsection (also a
   `Simulation Setting` tab class). Phase C amends it AGAIN with a
   `Scene Scale (Phase C)` row in the same classification.
6. `CLAUDE.md` §3 (artifact immutability) + §5 (boundaries). Phase C
   does NOT touch replay artifacts; the `sceneScale` overlay applies to
   live rendering only.

## 1. Purpose

User vision verbatim:

> Profile.sceneScale='paper-faithful' | 'demo-readability'; UE size
> relative footprint slider; Camera preset 切換

The current renderer hard-codes `FOOTPRINT_RADIUS_WORLD = 56` as the
world-unit radius the beam footprint paints on the ground plane. Six
downstream consumers (useBeamViz × 4 sites, runtimeFrameStep, replay
showcaseArtifactToScene) divide that by `footprintRadiusKm` to derive
the km→world-units scale; every visual that participates in the scene
(satellite altitude, hex spacing, UE markers, beam cones) inherits the
mapping.

Phase C exposes a `sceneScale` runtime selector that multiplies a
visual-only scale factor on top of `FOOTPRINT_RADIUS_WORLD` so users
can switch between:

- `paper-faithful` (multiplier = 1.0) — matches the saved replay
  artifacts and the existing visual layout. Default.
- `demo-readability` (multiplier > 1.0, exact value picked per SDD
  §6) — enlarges the scene so distant viewers in a presentation can
  see the beams clearly.

Phase C also exposes a UE marker size slider (separate from
`sceneScale`) and an additional camera preset that pairs with the
selected scene scale. The existing `zenith` / `oblique` / `chase`
preset triad in `ControlBar` already ships; Phase C extends it.

`sceneScale` does NOT change SINR, link budget, handover decisions, or
any physical computation. It is purely a km→world-units modifier for
the renderer. Memory note "破壞 saved replay artifact scale 一致性" is
exactly why we use a multiplier layered on top instead of editing the
constant.

## 2. Authority and Boundaries

### 2.1 Owned by Phase C

- New `SceneVisualScaleState` runtime store paralleling Phase E's
  `SceneTopologyState`. Holds `sceneScale: 'paper-faithful' |
  'demo-readability'` + `ueMarkerScale: number` (UE size relative
  factor, defaults to 1.0).
- New `applySceneVisualScale(geometry, state) -> SceneGeometry`
  pipeline so the multiplier flows through `SceneGeometry`'s
  `shellLayouts` consumer chain.
- Live-path-only multiplier injection: replay path keeps multiplier =
  1.0 because the replay envelope was rendered against the
  paper-faithful scale.
- UI surface: extends the Phase E `Topology` tab in
  `SignalTuningPanel` with a `Scene scale` sub-section (decision per
  SDD §5).
- Camera preset triple-expansion: adds one new preset
  (`paper-faithful-closeup`) for the 4-sat constellation; updates
  `ControlBar` to render 4 buttons.
- localStorage persistence of the visual-scale state.
- Documented amendment to
  `docs/sinr-runtime-parameter-contract.md` recording the new
  `Scene Scale (Phase C)` subsection.

### 2.2 Not owned by Phase C

- `FOOTPRINT_RADIUS_WORLD` const value. Stays at `56`. Phase C never
  rewrites the const; it layers a multiplier.
- Replay artifact scale. Loaded artifacts are not re-rendered with
  the multiplier applied; replay always shows paper-faithful scale.
- Engine truth (SINR, handover, MODQN decisions, link budget). Phase
  C is purely visual.
- Live multi-UE generator. Phase C UE marker scale only changes the
  cylinder size of whichever markers already exist (1 in live path,
  up to ~100 in replay path).
- Per-camera-preset rotation / animation overhaul beyond the new
  preset entry. The existing `easeInOutCubic` tween stays.
- `modqn-demo` mode gating for the `Scene scale` selector. Phase C
  intentionally allows both modes to use either scale because
  scene-scale is purely visual and the modqn-demo paper-faithful
  baseline is about PHYSICS + topology, not visual scale. The
  selector still defaults to `paper-faithful` in modqn-demo so the
  fresh user experience matches the saved artifacts.

### 2.3 Hard bans (PR-level, all Phase C slices)

- Do NOT change `FOOTPRINT_RADIUS_WORLD = 56` constant value.
- Do NOT apply `sceneScale` multiplier to replay artifact rendering
  (`showcaseArtifactToScene` keeps multiplier = 1.0).
- Do NOT introduce per-beam or per-satellite individual scale fields.
  `sceneScale` is global to the live scene.
- Do NOT add `sceneScale` to the existing replay artifact contract
  (`phase-03a-replay-bundle-v1` or `visual-showcase-v1`).
- Do NOT edit `src/profiles/*.json` to bake a `sceneScale` field
  into individual profiles. The selector is a runtime override only.
- Do NOT introduce a 100-UE live mobility generator (Phase F).
- Do NOT touch the SINR formula tabs in `SignalTuningPanel`.

## 3. Current State

Relevant existing code:

- `src/scene/beam-geometry-pure.ts:46` — `FOOTPRINT_RADIUS_WORLD = 56`.
- `src/scene/useBeamViz.ts:7, 749, 767, 1036, 1068` — 4 read sites for
  the constant; each divides by `footprintRadiusKm` to derive scale.
- `src/scene/runtimeFrameStep.ts:12, 504` — single read site for
  trajectory-driven cone scaling.
- `src/showcase/showcaseArtifactToScene.ts:61, 266` — replay-side
  read; MUST stay at multiplier = 1.0 after Phase C.
- `src/scene/beam-layout.ts:3, 13` — re-export of the same constant.
- `src/viz/GroundScene.tsx:37-38` — `MARKER_HEIGHT = 4` +
  `MARKER_RADIUS = 6` UE marker constants. Currently fixed; Phase C
  C-S2 adds a relative-factor slider.
- `src/ui/ControlBar.tsx:74-94, 220-229` — existing camera preset
  control with 3 buttons (`zenith` / `oblique` / `chase`) + testid
  `camera-preset-control`. Phase C C-S3 adds a 4th preset.
- `src/scene/MainScene.tsx:78-94` — `CAMERA_PRESET_POSES` record.
  Phase C C-S3 adds a 4th entry.
- `src/scene/types.ts:14` — `CameraPreset = 'zenith' | 'oblique' |
  'chase'`. Phase C C-S3 widens the union.
- `src/sceneTopology.ts` (shipped in Phase E PR-π) — pattern reference
  for the new `src/sceneVisualScale.ts`. Same shape (state +
  create/apply/hasOverrides/resetKey/evidenceKey + persistence
  constant).
- Phase E `TopologyTab.tsx` — Phase C extends with a "Scene scale"
  sub-section sharing the `topology` tab key OR forks a new tab; SDD
  §5 decides.

## 4. Slice Plan

Phase C is sized at 3 shippable slices. One slice per PR.

| Slice | Subject | Touches | Cross-repo dep? |
|---|---|---|---|
| PR-τ (C-S1) | sceneScale runtime selector + multiplier through SceneGeometry | new `src/sceneVisualScale.ts`, `src/App.tsx` (compose), `src/scene/SceneGeometry.ts` (carry multiplier), `src/scene/useBeamViz.ts` (consume multiplier at 4 sites), `src/scene/runtimeFrameStep.ts` (consume at 1 site), `src/ui/signal-tuning/TopologyTab.tsx` (add Scene scale sub-section), validator | none |
| PR-υ (C-S2) | UE marker size relative slider | extend `src/sceneVisualScale.ts` (add ueMarkerScale field), `src/viz/GroundScene.tsx` (consume scale prop), pass-through from `MainScene` → `GroundScene`, extend Topology tab UI, validator | none |
| PR-φ (C-S3) | add `paper-faithful-closeup` camera preset | extend `src/scene/types.ts` CameraPreset union, `src/scene/MainScene.tsx` CAMERA_PRESET_POSES entry, `src/ui/ControlBar.tsx` button entry, validator | none |

Each slice is one PR. PR-υ stacks on PR-τ (uses the same
`SceneVisualScaleState` store). PR-φ is independent — can land in any
order relative to τ/υ.

### 4.1 Slice ordering rationale

PR-τ first because the multiplier infrastructure (state store, apply
function, consumer threading) is the highest-leverage piece. Getting
the `sceneScale` end-to-end right under one selector proves the
multiplier path before PR-υ adds a second tunable on top.

PR-υ next because UE marker scale shares the same state store and the
same `Topology` tab UI — natural extension.

PR-φ last and optional because the camera preset triple already exists
in the codebase; adding a 4th preset is a 3-line change with no
state-store implication. Can ship before or after τ/υ — it does not
depend on the multiplier.

### 4.2 C-S1 selector values and multipliers

| sceneScale | beamFootprintMultiplier | Rationale |
|---|---:|---|
| `paper-faithful` | 1.0 | Matches saved replay artifacts and pre-Phase-C visual layout. Default. |
| `demo-readability` | 1.6 | ~60% larger beams; tested target for the 4-sat × 7-beam constellation so neighbouring beam footprints visually overlap less. Final value tuned in PR-τ browser smoke; the SDD records 1.6 as the seed. |

The multiplier is encoded inside `applySceneVisualScale` as a
const-table lookup; not user-editable in v1 (the user picks the
named scale, not a free slider). A free-multiplier slider can be a
v2 follow-up if tuning intent emerges.

### 4.3 C-S2 UE marker scale range

UE marker size is a separate `ueMarkerScale: number` field in
`SceneVisualScaleState`:

- Default: `1.0` (current `MARKER_HEIGHT = 4`, `MARKER_RADIUS = 6`).
- Range: `[0.5, 3.0]` continuous slider, step `0.1`.
- Renders as `MARKER_HEIGHT × ueMarkerScale` and `MARKER_RADIUS ×
  ueMarkerScale` in `GroundScene.tsx`. Secondary instances inherit the
  same factor.
- The slider value is INDEPENDENT of `sceneScale`. A user can pick
  `paper-faithful` scene scale + 2× UE markers, OR `demo-readability`
  scene scale + 0.5× UE markers.

The reason UE marker scale is a free slider while sceneScale is a
two-choice toggle: UE marker visibility depends on presentation
context (screen size, projection vs. monitor) where a single fixed
multiplier doesn't fit, while beam footprint scale only has two
useful modes (paper-baseline vs. demo).

### 4.4 C-S3 camera preset

New `paper-faithful-closeup` preset:

```ts
'paper-faithful-closeup': {
  position: [0, 320, 380],  // closer than oblique, tighter on 4-sat constellation
  target: [0, 80, 0],       // raised slightly to keep sat altitude in frame
},
```

Position numbers seed values; PR-φ browser smoke confirms the framing.
The preset is intended to pair with the
`modqn-4sat-7beam-paper-faithful` profile + `paper-faithful` scene
scale so the 4-sat hex is centered without the ground plane dominating
the frame.

## 5. UI Placement

Add `Scene scale` + `UE marker size` controls to the existing Phase E
`Topology` tab inside `SignalTuningPanel`. Both options were
considered:

A. Extend `Topology` tab with new sub-sections.
B. Add a new `Scene scale` left tab in `SignalTuningPanel`.

Phase C picks option A. Reasons:

- `Topology` is already a `Simulation Setting` tab (per Phase E SDD
  §9); `Scene scale` is the same classification — purely visual /
  rendering, not paper-facing SINR formula. Grouping the two together
  preserves the SINR formula vs. simulation-setting boundary.
- Option B requires a second tab descriptor + accent color + short
  label + tabClass plumbing for the same boundary classification.
  Net new work is the same as option A but with twice the file
  surface.
- The user is more likely to want `sceneScale` + `ueMarkerScale`
  adjacent to the `satsPerPlane` + `beamCountPerSatellite` overrides
  because all four are "what does the scene look like" knobs.
- If user feedback after Phase C lands says the tab is too long, a
  follow-up PR can split into two sub-tabs inside the same tab key
  without re-architecting.

Phase C does NOT gate the `Scene scale` sub-section on app mode.
Both `sinr-experiment` and `modqn-demo` show it because scene scale
is purely visual; it does not violate the paper-faithful PHYSICS
boundary. The default value is `paper-faithful` in both modes so a
fresh user sees the canonical layout.

The Topology tab after Phase C:

```
┌─ Topology / sim setting ──────────────────────┐
│  [Sat count section]      (Phase E PR-π)      │
│  [Beam count section]     (Phase E PR-ρ)      │
│  ─────────────────────────────────────────────│
│  [Scene scale section]    (Phase C PR-τ)      │
│  [UE marker size section] (Phase C PR-υ)      │
└───────────────────────────────────────────────┘
```

## 6. SceneVisualScaleState Contract

New file `src/sceneVisualScale.ts` (sibling to `sceneTopology.ts`):

```ts
export type SceneScale = 'paper-faithful' | 'demo-readability';

export interface SceneVisualScaleState {
  sceneScale: SceneScale;
  ueMarkerScale: number;
}

export interface SceneVisualScaleMultipliers {
  /** Multiplier applied on top of FOOTPRINT_RADIUS_WORLD for live rendering. */
  beamFootprintMultiplier: number;
  /** Multiplier applied to MARKER_HEIGHT / MARKER_RADIUS in GroundScene. */
  ueMarkerMultiplier: number;
}

export const DEFAULT_SCENE_VISUAL_SCALE_STATE: SceneVisualScaleState = {
  sceneScale: 'paper-faithful',
  ueMarkerScale: 1.0,
};

export const SCENE_VISUAL_SCALE_OVERRIDES_KEY =
  'leo-beam-sim.scene-visual-scale.v1';

const SCENE_SCALE_MULTIPLIERS: Record<SceneScale, number> = {
  'paper-faithful': 1.0,
  'demo-readability': 1.6,
};

export function createSceneVisualScaleState(): SceneVisualScaleState {
  return { ...DEFAULT_SCENE_VISUAL_SCALE_STATE };
}

export function resolveSceneVisualScaleMultipliers(
  state: SceneVisualScaleState,
): SceneVisualScaleMultipliers {
  return {
    beamFootprintMultiplier: SCENE_SCALE_MULTIPLIERS[state.sceneScale],
    ueMarkerMultiplier: state.ueMarkerScale,
  };
}

export function hasSceneVisualScaleOverrides(
  state: SceneVisualScaleState,
): boolean {
  return state.sceneScale !== DEFAULT_SCENE_VISUAL_SCALE_STATE.sceneScale
    || state.ueMarkerScale !== DEFAULT_SCENE_VISUAL_SCALE_STATE.ueMarkerScale;
}

export function getSceneVisualScaleResetKey(
  state: SceneVisualScaleState,
): string {
  return [state.sceneScale, state.ueMarkerScale.toFixed(2)].join('|');
}

export function getSceneVisualScaleEvidenceKey(
  state: SceneVisualScaleState,
): string {
  return [state.sceneScale, state.ueMarkerScale.toFixed(2)].join('|');
}
```

`App.tsx` composition:

```ts
const [sceneVisualScale, setSceneVisualScale] = useState<SceneVisualScaleState>(
  () => loadFromLocalStorage(),
);

const visualScaleMultipliers = useMemo(
  () => resolveSceneVisualScaleMultipliers(sceneVisualScale),
  [sceneVisualScale],
);

// effectiveProfile composition stays from Phase E:
//   effectiveProfile = applySceneTopology(applySignalTuning(baseProfile, signalTuning), sceneTopology)
// Phase C does NOT touch the profile composition. Instead, visualScaleMultipliers
// passes alongside profile into MainScene as a sibling prop.

<MainScene
  profile={effectiveProfile}
  visualScaleMultipliers={visualScaleMultipliers}
  ...
/>
```

The multipliers flow through `MainScene` as a prop (NOT through
`Profile`). Reason: `Profile` is the paper-truth contract and must
not gain runtime visual fields. The multipliers ride alongside the
profile.

## 7. State and Persistence

One new localStorage key, versioned `.v1`:

```ts
const SCENE_VISUAL_SCALE_OVERRIDES_KEY =
  'leo-beam-sim.scene-visual-scale.v1';
```

Behavior:

- Stored shape: `SceneVisualScaleState` JSON.
- Read on App init. If parse fails, fallback to
  `createSceneVisualScaleState()` silently.
- Writes happen on every state change.
- A `Reset visual scale` button in the Topology tab calls
  `setSceneVisualScale(createSceneVisualScaleState())` and removes
  the key.

Per `paper_faithful_vision` constraint 1 the visual-scale overrides
do not fork the scene; the same MainScene re-renders with the new
multiplier values applied at the consumer sites.

## 8. Multiplier Threading Architecture

PR-τ rewires 6 consumer sites. The change pattern is uniform:

Today:
```ts
const scale = FOOTPRINT_RADIUS_WORLD / Math.max(footprintRadiusKm, 1e-6);
```

After PR-τ:
```ts
const scale = (FOOTPRINT_RADIUS_WORLD * beamFootprintMultiplier)
  / Math.max(footprintRadiusKm, 1e-6);
```

The `beamFootprintMultiplier` enters via one of:

- **useBeamViz**: new optional `visualScaleMultipliers?: SceneVisualScaleMultipliers`
  parameter on the hook signature. `MainScene` passes it from the prop. The
  hook reads it once per render and applies at the 4 sites.
- **runtimeFrameStep**: new optional `beamFootprintMultiplier?: number`
  parameter on the function signature. `useSimulation` passes it through.
- **showcaseArtifactToScene** (replay path): NO change. Multiplier always =
  1.0 for replay. The replay envelope's beam footprint world coordinates
  were baked at paper-faithful scale.

When the new parameter is omitted (e.g. test fixtures that don't pass
it), the consumer defaults to multiplier = 1.0 — preserves existing
behavior end-to-end. PR-τ validator asserts the default-fallback
behavior.

## 9. SINR Contract Amendment

`docs/sinr-runtime-parameter-contract.md` already gained
`### Topology Overrides (Phase E)` in PR-π. Phase C appends:

> ### Scene Scale (Phase C)
>
> Phase C adds a second `Simulation Setting` sub-section to the
> `Topology` tab covering visual scale and UE marker size. Like
> Topology, these controls are NOT paper-facing SINR formula
> parameters; they only change the km → world-units rendering
> mapping (`sceneScale`) and the GroundScene marker cylinder
> geometry (`ueMarkerScale`). They do NOT alter SINR, link budget,
> handover decisions, or any physical computation. Replay artifacts
> are rendered with multiplier = 1.0 regardless of the live
> selector (artifacts were baked at paper-faithful scale per
> Phase 7 contract). See Phase C SDD §6 + §8.

The amendment lands in PR-τ alongside the C-S1 implementation.

## 10. Acceptance Per Slice

### 10.1 PR-τ (C-S1, sceneScale selector + multiplier threading)

- New file `src/sceneVisualScale.ts` exports the named functions /
  constants from §6.
- New section inside `src/ui/signal-tuning/TopologyTab.tsx`:
  Scene scale 2-option radio (`paper-faithful` / `demo-readability`)
  + `Reset visual scale` button + effective-value readout.
  Banner copy: "Adjusting scene scale takes effect on next render
  frame (no simulation restart)."
- testids required by validator: `topology-tab-scene-scale-radio`,
  `topology-tab-scene-scale-option-paper-faithful`,
  `topology-tab-scene-scale-option-demo-readability`,
  `topology-tab-scene-scale-reset`,
  `topology-tab-scene-scale-effective-value`.
- `src/App.tsx` adds `sceneVisualScale` state + localStorage
  hydration/persistence + `resolveSceneVisualScaleMultipliers` memo
  + `<MainScene visualScaleMultipliers={...}>` prop.
- `src/scene/MainScene.tsx` accepts the new prop; passes it into
  `useBeamViz` (new optional 6th arg) and `useSimulation` (already
  takes a runtime config — runtime.beamFootprintMultiplier gains a
  field, OR a new arg, whichever fits the existing signature with
  the smallest delta).
- `src/scene/useBeamViz.ts` reads the multiplier from the new param;
  applies at the 4 documented sites. When param omitted, defaults to
  1.0 (no behavior change).
- `src/scene/runtimeFrameStep.ts` reads the multiplier at the 1
  documented site; defaults to 1.0 when absent.
- `src/showcase/showcaseArtifactToScene.ts` UNCHANGED (replay
  multiplier stays at 1.0).
- `docs/sinr-runtime-parameter-contract.md` gains §"Scene Scale
  (Phase C)" subsection per §9.
- New `scripts/validate-phase-c-scene-scale-override.tsx`:
  - Source grep on `sceneVisualScale.ts` exports.
  - Behavioral `resolveSceneVisualScaleMultipliers`:
    `{ sceneScale: 'paper-faithful', ueMarkerScale: 1.0 }` →
    `{ beamFootprintMultiplier: 1.0, ueMarkerMultiplier: 1.0 }`.
    `{ sceneScale: 'demo-readability', ueMarkerScale: 1.0 }` →
    `{ beamFootprintMultiplier: 1.6, ueMarkerMultiplier: 1.0 }`.
  - `App.tsx` source grep: contains the new state + memo +
    `visualScaleMultipliers` prop on `<MainScene>`.
  - `useBeamViz.ts` source grep: contains `beamFootprintMultiplier`
    consumption at 4 sites; default-fallback path tested.
  - `runtimeFrameStep.ts` source grep: contains
    `beamFootprintMultiplier` consumption at 1 site.
  - `showcaseArtifactToScene.ts` source grep: NEGATIVE assertion —
    the file does NOT reference `beamFootprintMultiplier` (replay
    path keeps multiplier = 1.0).
  - TopologyTab source grep: 5 new testids + banner copy.
  - SSR/behavioral: render TopologyTab with `paper-faithful` and
    `demo-readability` states; assert effective-value text differs.
  - Contract md source grep: "Scene Scale (Phase C)" subsection.
- `npm run lint` clean.
- Phase E validators (`validate-phase-e-sat-count-override` 44/0,
  `validate-phase-e-beam-count-override` 33/0) still pass.
- S3 omega validator still passes.

### 10.2 PR-υ (C-S2, UE marker size slider)

- `src/sceneVisualScale.ts` already declares `ueMarkerScale`; PR-υ
  exercises the path end-to-end.
- `src/viz/GroundScene.tsx` accepts a new `ueMarkerMultiplier: number`
  prop (default 1.0 when omitted). Multiplies `MARKER_HEIGHT` and
  `MARKER_RADIUS` by the prop value for both primary and secondary
  instances.
- `src/scene/MainScene.tsx` passes
  `visualScaleMultipliers.ueMarkerMultiplier` down to `<GroundScene>`.
- `TopologyTab.tsx` adds UE marker slider control (range `[0.5, 3.0]`,
  step `0.1`) with effective-value readout + `Reset UE size` button.
- testids: `topology-tab-ue-marker-slider`,
  `topology-tab-ue-marker-effective-value`,
  `topology-tab-ue-marker-reset`.
- New `scripts/validate-phase-c-ue-marker-size.tsx`:
  - Behavioral `resolveSceneVisualScaleMultipliers` with non-default
    `ueMarkerScale` returns expected multiplier.
  - `GroundScene.tsx` source grep: accepts `ueMarkerMultiplier` prop,
    applies it at primary + secondary marker sites.
  - SSR render `GroundScene` with `ueMarkerMultiplier=2.0` and
    `=0.5`; assert cylinder geometry args differ (read the
    `cylinderGeometry args={[...]}` output for both).
  - TopologyTab testid grep.
- `npm run lint` clean; PR-τ + Phase E validators still pass.

### 10.3 PR-φ (C-S3, paper-faithful-closeup camera preset)

- `src/scene/types.ts` widens `CameraPreset` union to include
  `'paper-faithful-closeup'`.
- `src/scene/MainScene.tsx` `CAMERA_PRESET_POSES` gains entry per
  SDD §4.4.
- `src/ui/ControlBar.tsx` `CAMERA_PRESETS` array gains 4th button.
  Label: `Paper-faithful close-up`. testid:
  `camera-preset-paper-faithful-closeup`.
- New `scripts/validate-phase-c-camera-preset.tsx`:
  - `types.ts` source grep: union widened.
  - `MainScene.tsx` source grep: `paper-faithful-closeup` pose
    present.
  - `ControlBar.tsx` source grep: 4th button entry + testid.
  - SSR render ControlBar; assert all 4 buttons present.
- `npm run lint` clean; PR-τ + PR-υ + Phase E validators still pass.

## 11. Cross-Repo Dependencies

NONE for any Phase C slice. Phase C is entirely live-renderer visual
changes inside `leo-beam-sim`. No backend, no sibling repo, no replay
artifact contract change.

## 12. Out of Scope

Not in Phase C:

- Free-multiplier slider for `sceneScale` (only the 2-option
  selector ships in v1).
- Per-beam or per-satellite individual scale overrides.
- Replay artifact rescaling (`showcaseArtifactToScene` keeps
  multiplier = 1.0).
- Camera preset animation overhaul (existing easing stays).
- New camera presets beyond `paper-faithful-closeup`.
- UE marker color / shape changes — only size factor.
- Adding `sceneScale` field to any profile JSON.
- Adding visual-scale fields to replay envelope shape.
- Live multi-UE generator (Phase F).

## 13. Risks

- **Multiplier missed at a consumer site**. The 6 read sites are
  documented in §3, but a future consumer added without reading this
  SDD would silently revert that surface to the unscaled version.
  Mitigation: PR-τ validator source-greps all 6 sites; future
  reviewers see the validator failing.
- **Replay scene scale leak**. If a future agent wires the multiplier
  through `showcaseArtifactToScene` "for symmetry", the replay
  envelope will be visually inconsistent with its baked coordinates.
  Mitigation: PR-τ validator has a NEGATIVE assertion that
  `showcaseArtifactToScene.ts` does NOT reference
  `beamFootprintMultiplier`.
- **Multiplier value choice**. `1.6` for `demo-readability` is a
  seed; the right value depends on display device + room size.
  Mitigation: SDD §4.2 records the value as tunable; a follow-up
  slice can promote it to a free slider if needed.
- **TopologyTab visual density**. Adding 2 more sub-sections (Scene
  scale + UE marker) to a tab that already has 2 sub-sections (sat
  count + beam count) may overflow on small viewports. Mitigation:
  Topology tab content already scrolls via the `SidebarTabShell`
  container; if it gets unwieldy, a future slice can re-split the
  tab.
- **Camera preset name confusion**. `paper-faithful-closeup` reads
  as if it ONLY works with `paper-faithful` sceneScale. Phase C does
  NOT couple them — the preset is a pose, the scale is a multiplier;
  any combination works. The README in
  `paper-faithful-vision` memory makes this explicit; no code
  enforcement needed.

## 14. Validation Plan (per Phase C slice)

Each slice's PR runs:

- `npm run lint`.
- The relevant focused validator script.
- Phase E PR-π `validate-phase-e-sat-count-override` (44/0) regression.
- Phase E PR-ρ `validate-phase-e-beam-count-override` (33/0) regression.
- S3 omega
  `validate-modqn-omega-s3-replay-mode-wiring` (55/0) regression.
- Manual source-grep: no `FOOTPRINT_RADIUS_WORLD = 56` value change,
  no `src/profiles/*.json` edit, no `showcaseArtifactToScene.ts`
  edit (PR-τ NEGATIVE assertion).
- Browser smoke for PR-τ and PR-υ: open dev server, switch app mode
  to sinr-experiment, open Topology tab, flip scene-scale selector,
  observe beam footprints visibly scale. Confirm replay path (load a
  user-trained bundle from Phase D) renders at multiplier = 1.0
  regardless of the live selector.
- Per `feedback-validator-canvas-vs-react-attr` rule, any validator
  assertion against a re-rendered React-DOM attribute (e.g. the
  effective-value text) gates on the same DOM element's own attr.
- Per `feedback-modqn-demo-subagent-verify` rule, codex sub-agent
  PASS reports are re-verified in the controller main thread before
  PR push.

## 15. Assumptions To Verify Before PR-τ Lands

- The 6 FOOTPRINT_RADIUS_WORLD consumer sites enumerated in §3 are
  the complete list. Run `grep -rn FOOTPRINT_RADIUS_WORLD src/`
  before PR-τ to confirm no new consumer was added since this SDD
  was drafted.
- `useBeamViz` signature accepts a new optional parameter without
  breaking existing callers (tests, fixtures). If the hook signature
  is `(frame, geometry, runtime, latched, optionalCaps,
  beamHopping)` and Phase C adds `visualScaleMultipliers` as a 7th
  optional arg, all existing call sites stay compatible.
- `runtimeFrameStep` accepts the multiplier via either a new field
  on its existing runtime-config arg or a new positional arg,
  whichever results in the smallest call-site diff.
- The `Topology` tab can host 4 sub-sections (sat-count,
  beam-count, scene-scale, ue-marker) without a layout refactor.
  Visual smoke verifies; if not, the Topology tab splits into
  collapsible sub-sections in a follow-up — Phase C v1 does not
  block on this.
- `MainScene` accepts a new `visualScaleMultipliers` prop without
  affecting `MainScene`'s other consumers. The replay path
  (`useReplayPlayback` or whatever drives the replay scene in
  Phase D) does NOT receive the prop because replay renders at
  multiplier = 1.0.
- The `paper-faithful-closeup` camera pose numbers seed in §4.4 give
  a usable framing on the 4-sat constellation. PR-φ browser smoke
  verifies; if the framing is off, tune the position vector in the
  same PR.

If any assumption is contradicted before implementation, update this
SDD rather than patching display behavior around it.
