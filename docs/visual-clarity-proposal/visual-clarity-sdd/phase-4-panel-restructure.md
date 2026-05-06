# Phase 4 — Panel & UI Restructure

> Part of the [Visual Clarity & Story-Readability SDD](./README.md). For
> the cross-cutting rules this phase obeys, see
> [`contracts.md`](./contracts.md):
> [Validation Tiers](./contracts.md#validation-tiers),
> [Mode & Density Plumbing](./contracts.md#mode--density-plumbing),
> [Three-Tier Visual Contract](./contracts.md#three-tier-visual-contract)
> (Phase 4A's duel-card identity row consumes `panel.satChip` from the
> channel registry; Phase 4D moves diagnostics surfaces between
> registered components),
> [Accessibility & Motion](./contracts.md#accessibility--motion)
> (Phase 4C's camera tween must collapse to instant snap when
> `runtime.reducedMotion = true`),
> [Cross-cutting Conventions](./contracts.md#cross-cutting-conventions).
>
> Phase 4 reshapes the surrounding UI so the in-canvas storytelling from
> [Phase 1](./phase-1-identity-first.md) –
> [Phase 3](./phase-3-ground-cinematic.md) is supported by panels that
> match it instead of competing with it. This phase touches `InfoPanel`,
> `SignalTuningPanel`, and `ControlBar` but does not change the
> underlying state contract from
> `docs/frontend-ux-redesign-sdd.md` Phase 1A.

Slices:

- [Phase 4A: InfoPanel Duel Card](#phase-4a-infopanel-duel-card)
- [Phase 4B-pre: Layout Shell Migration](#phase-4b-pre-layout-shell-migration)
- [Phase 4B (proper): Drawer Behavior](#phase-4b-proper-drawer-behavior)
- [Phase 4C: ControlBar Density Slider & Camera Preset](#phase-4c-controlbar-density-slider--camera-preset)
- [Phase 4D: Diagnostics Drawer](#phase-4d-diagnostics-drawer)

---

## Phase 4A: InfoPanel Duel Card

Merge `ACTIVE SERVING` and `PENDING TARGET` blocks into a single
side-by-side "duel" card with the SINR delta and trigger progress in
the center.

Scope:

- Replace the two stacked cards in `InfoPanel.tsx` with one container
  card with three columns:
  - Left: serving identity
    ([Phase 1A canonical string](./phase-1-identity-first.md#phase-1a-live-legend-identity)),
    serving SINR with `sinrColor`, serving `el / range` row.
  - Center: `Δ SINR` value, `need offset` value, trigger progress bar,
    handover state badge.
  - Right: pending/comparison identity, SINR, topo row.
- Each column uses the matching role accent (serving cyan / pending
  amber / recent-source slate), keeping current `boxShadow` glow rules.
- The duel card replaces the current standalone `SINR Delta` and
  `Trigger Time` block. That block dissolves into the center column.

Non-goals:

- No change to `SimState` contract or to how `panelPrimary` /
  `panelComparison` are computed.
- No change to `BEAM HOPPING` block, `FORMULA` block, or
  `DEBUG/VALIDATION` block in this slice.

Implementation guidance:

- The center column needs to remain compact at `width = 280px`. If the
  trigger bar and `Δ SINR` row do not fit, the trigger bar may stack
  below.

Touched files:

- `src/ui/InfoPanel.tsx` — new `DuelCard` component, removal of split
  blocks.
- `scripts/validate-vc4a-duel-card.tsx` — V2 + V3 validation.
- `package.json` — register `validate:vc4a:duel-card`.

Acceptance:

- One card replaces two; the third middle column shows `Δ` and trigger
  progress.
- Visual regression at `1440x900` and `1366x768` shows no overlap with
  the 3D canvas or other panels.
- Phase 1A canonical identity strings in both side columns match scene
  callouts.

Validation evidence:

- `npm run validate:vc4a:duel-card` renders the duel card with three
  fixture states (idle / pending / recent-HO) and asserts expected
  copy.
- Browser validation captures one frame per fixture state.

---

## Phase 4B: SignalTuningPanel Drawer

Drawer-ize the left tuning panel so presentation mode hides it and
tuning / diagnostics modes reflow the canvas instead of overlaying it.

This slice is split into a **prerequisite layout-shell slice (4B-pre)**
and the **drawer slice itself (4B)** because converting from
absolute-positioned overlays to a flex layout shell touches multiple
unrelated files (`App.tsx`, `MainScene.tsx`, `SignalTuningPanel.tsx`,
`InfoPanel.tsx`, `styles/main.scss`) and risks breaking R3F Canvas
hit-testing if done in one pass.

### Phase 4B-pre: Layout Shell Migration

Migrate the existing absolute-positioned panel layout
(`SignalTuningPanel` at `position: absolute; left: 12, top: 76`,
`InfoPanel` at `position: absolute; top: 12, right: 12`, `MainScene`
container at `width: 100%; height: 100%`) to an explicit flex shell.

Scope:

- New top-level layout in `App.tsx`:
  ```
  <div data-ui-mode={uiMode} className="leo-app-shell">
    <ControlBar ... />
    <div className="leo-shell-row">
      <aside className="leo-shell-left">    {/* SignalTuningPanel slot */}
      <main  className="leo-shell-canvas">  {/* MainScene slot */}
      <aside className="leo-shell-right">   {/* InfoPanel + DiagnosticsDrawer slot */}
    </div>
  </div>
  ```
- The canvas slot owns its own pointer-events; the side panels must not
  intercept pointer events outside their visible bounds.
- Side panels migrate from `position: absolute` to flex children. Their
  internal layout (controls inside the panel) is unchanged.
- `MainScene.tsx`'s `<Canvas>` must respond to its container's resized
  bounds via the existing R3F resize observer (default behavior).
  Verify this still functions after migration.
- Update `src/styles/main.scss` to add the new shell classes; preserve
  existing global resets.

Non-goals:

- No drawer behavior in this slice. `SignalTuningPanel` remains
  always-open (current width) and `InfoPanel` remains always-open.
- No diagnostics drawer in this slice.
- No `UiMode`-driven width changes.

Touched files:

- `src/App.tsx` — root layout shell.
- `src/scene/MainScene.tsx` — outer container relinquishes
  `width: 100%; height: 100%` overlay style; relies on flex parent for
  sizing. Confirm `Starfield` (currently a child of `MainScene`'s
  outer wrapper) still positions correctly.
- `src/ui/SignalTuningPanel.tsx` — `panelStyle` removes `position:
  absolute`, `top`, `left`; keeps internal layout.
- `src/ui/InfoPanel.tsx` — same migration as `SignalTuningPanel`.
- `src/styles/main.scss` — shell classes.
- `scripts/validate-vc4b-pre-layout-shell.tsx` — new V3 browser script.
- `package.json` — register `validate:vc4b-pre:layout-shell`.

Acceptance:

- Existing `validate:phase1a:recent-ho-ui` and other Phase 1A–9H
  validation scripts continue to pass.
- V3 browser test confirms:
  - The Canvas bounding-rect is non-zero and matches the flex slot
    width.
  - Mouse-drag inside the canvas slot rotates the camera (verifies
    `OrbitControls` still receives pointer events).
  - Mouse hover on the right `InfoPanel` does not rotate the camera.
- No regression at the four existing validation viewports (`1440x900`,
  `1366x768`, `768x1024`, `390x844`).

### Phase 4B (proper): Drawer Behavior

After 4B-pre lands, this slice adds `UiMode`-driven drawer width state:

Scope:

- The left `SignalTuningPanel` becomes a left-edge drawer with three
  states keyed by `UiMode`:
  - `presentation`: collapsed to a 28 px handle (handle visible, panel
    contents hidden).
  - `tuning`: open to current 520 px width.
  - `diagnostics`: open to 360 px (compact controls only; rest moves to
    the diagnostics drawer at
    [Phase 4D](#phase-4d-diagnostics-drawer)).
- When drawer width changes, the canvas slot reflows automatically via
  the flex shell from 4B-pre.
- Tuning controls preserve their authority per
  `docs/sinr-runtime-parameter-contract.md`. No control is moved or
  removed.

Non-goals:

- No change to which controls live in which tab.
- No change to `applySignalTuning` runtime behavior.

Touched files:

- `src/ui/SignalTuningPanel.tsx` — drawer state, collapsed-state
  handle.
- `src/App.tsx` — pass `UiMode` to drawer.
- `scripts/validate-vc4b-tuning-drawer.tsx` — new V3 browser script.
- `package.json` — register `validate:vc4b:tuning-drawer`.

Acceptance:

- V3 browser test in three modes:
  - `presentation`: canvas occupies the full width minus right panel +
    28 px handle.
  - `tuning`: drawer at 520 px; canvas reflows; clicking a control does
    not propagate to canvas.
  - `diagnostics`: drawer at 360 px; canvas reflows.
- `OrbitControls` drag works correctly in all three modes (browser
  validation step).

---

## Phase 4C: ControlBar Density Slider & Camera Preset

Promote presentation-density and camera angle to first-class controls.

Scope:

- `ControlBar` gains:
  - A three-step segmented control for beam density labelled `few` /
    `normal` / `many`, wired to `RuntimeConfig.beamDensity` from
    [Phase 1B](./phase-1-identity-first.md#phase-1b-presentation-density-floor).
  - A three-button camera preset (`Zenith` / `Oblique` / `Chase`).
    `OrbitControls` target/distance/azimuth presets are predefined;
    pressing a button animates the camera to the preset.
- A small `BH` status pill appears at the right edge of the control
  bar.

UI label ↔ runtime mapping (canonical):

| ControlBar label | `runtime.beamDensity` value |
|---|---|
| `few` | `event-only` |
| `normal` | `event-plus-1` |
| `many` | `all` |

This mapping is bidirectional: when `UiMode` changes, the segmented
control highlights the label corresponding to the UiMode-derived
default; when the user presses a label, that value is written to
`runtime.beamDensity` directly.

Default behavior and override precedence:

- On every `UiMode` transition, `App.tsx` writes the
  UiMode-derived default into `runtime.beamDensity` per the
  [Mode & Density Plumbing default mapping](./contracts.md#mode--density-plumbing).
  The current default mapping is `presentation → event-plus-1`,
  `tuning → all`, `diagnostics → all` — i.e., the segmented control
  initially highlights `normal`, `many`, `many` respectively.
- After a UiMode transition, the user may press a different segment;
  this writes the chosen label's runtime value and **supersedes**
  the UiMode default until the next `UiMode` change.
- The user override does **not** persist across `UiMode` changes. Each
  `UiMode` change re-resets to that mode's default. (Avoids surprise
  drift between sessions.)
- `runtime.beamDensity = 'event-only'` is reachable only by user
  override; no `UiMode` defaults to it. This is by design — `event-only`
  is a "make it as quiet as possible" presentation override, not a
  baseline.

Non-goals:

- No new mode beyond Phase 3A in the existing UX SDD.
- No camera path animation library; lerp by hand using `OrbitControls`'
  `target` and `position`.

Camera command bus:

`ControlBar` is a sibling of `MainScene` (both children of `App`), so
`ControlBar` cannot grab a `ref` to `MainScene`'s internal
`OrbitControls`. Instead, introduce a one-shot **camera command** field
on `RuntimeConfig` (already declared in
[Mode & Density Plumbing](./contracts.md#mode--density-plumbing)):

```ts
cameraCommand?: {
  preset: 'zenith' | 'oblique' | 'chase';
  issuedAtMs: number;     // disambiguates rapid repeated presses
};
```

`MainScene` reads `runtime.cameraCommand` in a `useEffect` keyed by
`issuedAtMs`; on a new value, it animates the camera and the
`OrbitControls` target via internal refs. `ControlBar` issues a command
by setting
`runtime.cameraCommand = { preset, issuedAtMs: performance.now() }`
through an `App`-owned setter.

`OrbitControls`' current call site (`src/scene/MainScene.tsx:659-667`)
does not expose a ref. The implementing slice adds an internal ref and
keeps the `OrbitControls` props otherwise unchanged.

Touched files:

- `src/scene/types.ts` — `RuntimeConfig.cameraCommand` field.
- `src/scene/MainScene.tsx` — internal `OrbitControls` ref; effect
  reacting to `cameraCommand`; tween logic for camera position +
  target.
- `src/App.tsx` — `cameraCommand` state; setter passed to
  `<ControlBar>`; pipes `beamDensity` into `RuntimeConfig` per the
  [Mode & Density Plumbing](./contracts.md#mode--density-plumbing)
  default mapping.
- `src/ui/ControlBar.tsx` — density segmented control, camera preset
  buttons, BH pill.
- `scripts/validate-vc4c-controlbar-density-camera.tsx` — V3 browser
  validation.
- `package.json` — register `validate:vc4c:controlbar-density-camera`.

Acceptance:

- Pressing density buttons updates Phase 1B's floor live without
  restarting simulation. Browser test confirms cone-beam count changes
  within one frame of the click.
- Pressing camera preset smoothly moves camera + `OrbitControls.target`
  to the preset within 600 ms. The animation uses a deterministic
  easing so V3 browser tests can sample at fixed time offsets.
- `runtime.reducedMotion` collapses the camera tween to an instant snap
  (per [Accessibility & Motion](./contracts.md#accessibility--motion)).
- BH pill reflects `beamHopEnabled` and `beamHopSlotIndex` from
  `SimState`.

Validation evidence:

- V3 browser portion: three density frames + three camera-preset
  end-state frames captured at `1440x900`, plus one
  `reducedMotion = true` instant-snap frame asserting the camera
  arrives at the preset target on the first frame after the button
  click (no tween).

---

## Phase 4D: Diagnostics Drawer

Move all `diagnostics`-only content out of `InfoPanel` into a separate
right-bottom drawer so the duel card and BH pill are the only persistent
right-side elements regardless of mode.

Scope:

- A new `DiagnosticsDrawer.tsx` component renders:
  - `BEAM HOPPING` slot detail.
  - `Handover policy (effective)` readout.
  - `DPC: research power policy` block.
  - `DEBUG / VALIDATION` block.
- The drawer collapses to a small bottom-right tab in `presentation`
  and `tuning` modes; expands to a fixed-height panel only in
  `diagnostics` mode.
- Content moved out of `InfoPanel.tsx` is deleted from there once
  `DiagnosticsDrawer` reads from the same `SimState` props.

Existing validation script update (mandatory):

`scripts/validate-phase5b-diagnostics-dpc-status.tsx` currently renders
`<InfoPanel ...>` directly and asserts DPC text in the rendered output
(lines 111–115, 158–169). Moving the DPC block out of `InfoPanel`
**will break this script**. The implementing slice must update the
script to render an AppShell-equivalent wrapper containing both
`<InfoPanel>` and `<DiagnosticsDrawer>`, then assert DPC text in the
combined output:

```tsx
function renderInfoText(profile: Profile, uiMode: UiMode): string {
  const state = createSimState(profile, createBudgetTerms(47.5));
  return decodeHtmlText(renderToStaticMarkup(
    <>
      <InfoPanel {...state} uiMode={uiMode} profile={profile} />
      <DiagnosticsDrawer {...state} uiMode={uiMode} profile={profile} />
    </>
  ));
}
```

Identical assertion text; only the rendering scaffold changes. The
Phase 4D slice owns this script update.

Non-goals:

- No change to which fields are rendered, only where.
- No change to `formatHandoverReason` or any helper.

Touched files:

- `src/ui/DiagnosticsDrawer.tsx` — new file.
- `src/ui/InfoPanel.tsx` — removes the four diagnostics blocks.
- `src/App.tsx` — renders `DiagnosticsDrawer` in the right shell slot
  (per
  [Phase 4B-pre layout](#phase-4b-pre-layout-shell-migration)).
- `scripts/validate-phase5b-diagnostics-dpc-status.tsx` — **update
  existing script** to render the combined panel (see above).
- `scripts/validate-vc4d-diagnostics-drawer.tsx` — new V3 validation.
- `package.json` — register `validate:vc4d:diagnostics-drawer`.

Acceptance:

- In diagnostics mode, all original diagnostic data is reachable
  (verified by the updated `validate:phase5b` script).
- In presentation mode, the right side shows only duel card + BH pill +
  collapsed diagnostics tab.
- Existing `npm run validate:phase5b:diagnostics-dpc-status` continues
  to pass after script update.
- New `npm run validate:vc4d:diagnostics-drawer` exercises the
  three-mode collapse/expand and asserts text moves to
  `DiagnosticsDrawer`.
