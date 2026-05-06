# SDD Contracts (cross-cutting)

> Part of the [Visual Clarity & Story-Readability SDD](./README.md). This
> file collects the rules that **every phase** must obey:
> [Validation Tiers](#validation-tiers),
> [Mode & Density Plumbing](#mode--density-plumbing),
> [Three-Tier Visual Contract](#three-tier-visual-contract),
> [Accessibility & Motion](#accessibility--motion),
> [Performance Budget](#performance-budget),
> [Cross-cutting Conventions](#cross-cutting-conventions).
>
> Phase files
> ([1](./phase-1-identity-first.md),
> [2](./phase-2-non-text-channels.md),
> [3](./phase-3-ground-cinematic.md),
> [4](./phase-4-panel-restructure.md))
> reference these by section anchor.

---

## Validation Tiers

Every `validate:vc*` script in this SDD belongs to **exactly one** of three
tiers. Slices must declare their tier in the slice's "Validation evidence"
block, and acceptance criteria must be expressible by the chosen tier's
capability.

| Tier | Tooling | What it can verify | What it cannot verify |
|---|---|---|---|
| **V1 Unit invariant** | plain `tsx` / `ts` script asserting on pure functions, token tables, helper outputs | helper return values, token field equality, palette ΔE / luminance, geometry counts | anything rendered |
| **V2 React SSR text** | `renderToStaticMarkup` of React components, then text/HTML attribute assertions (current pattern in `scripts/validate-phase5b-...tsx`) | text content, `data-*` attributes, structural class names, panel ↔ scene string equality | WebGL pixels, Three.js fog, `useFrame` animation envelopes, GLB material state, glyph mesh shape |
| **V3 Browser canvas** | Playwright + headless Chrome rendering the full Vite dev server, screenshot capture, perceptual / pixel-region color sampling | WebGL pixels, animation envelopes via timed screenshots, fog application, glyph silhouette, Canvas bounding-rect, `OrbitControls` drag behavior | non-deterministic pixels (Starfield random) unless seeded |

Hard rules:

- A slice that asserts on **pixel color**, **animation timing**, **fog**,
  or **3D mesh shape** must be V3. Claiming V1/V2 for these targets is a
  blocker-grade SDD bug.
- A slice that asserts on **callout text**, **panel text**, **`data-*`
  attributes**, or **token-table equality** should be V2 or V1.
- V3 scripts must seed `Math.random` (used by `Starfield`) and freeze
  `requestAnimationFrame` time before screenshot capture; otherwise the
  screenshot is not deterministic and `validate` will be flaky.
- Every slice's `Touched files` block must list:
  - `scripts/validate-vc{slice}-{name}.{ts,tsx}` — the new validation
    script.
  - `package.json` — to register the new `validate:vc{slice}:...` script.

## Mode & Density Plumbing

The simulator currently has two independent mode states that this SDD
extends:

- `PresentationMode` (`research-default | candidate-rich | demo-readability`)
  — used by `useBeamViz` to weight central-pass scoring (see
  `src/scene/useBeamViz.ts:130-141` and `App.tsx:resolvePresentationMode`).
- `UiMode` (`presentation | tuning | diagnostics`) — used only by panel
  components, persisted to localStorage in `src/ui/uiMode.ts`. **Currently
  not threaded into `useBeamViz` or `MainScene` simulation logic.**

This SDD requires both modes to remain, but adds new runtime fields that
gate density, animation, and cinematic effects. They live on
`RuntimeConfig` in `src/scene/types.ts` so `MainScene` and `useBeamViz`
can read them in one shape:

```ts
// Additions to RuntimeConfig (src/scene/types.ts)
export interface RuntimeConfig {
  presentationMode: PresentationMode;     // existing
  replay: ReplayConfig;                    // existing
  signalResetKey?: string;                 // existing
  handoverResetKey?: string;               // existing

  // Phase 1B
  beamDensity: 'event-only' | 'event-plus-1' | 'all';

  // Phase 3B / 3C / 3D
  effectsEnabled: {
    spineParticles: boolean;
    orbitTrail: boolean;
    servingRipple: boolean;
    pendingRipple: boolean;   // Phase 3D pending-variant ripple (independent gate from servingRipple)
  };

  // Phase 3E
  cinematicMode: 'off' | 'spotlight';

  // Phase 4C
  cameraCommand?: {
    preset: 'zenith' | 'oblique' | 'chase';
    issuedAtMs: number;
  };

  // Accessibility (cross-cutting)
  reducedMotion: boolean;
}
```

Default mapping from `UiMode` to runtime fields (computed in `App.tsx` and
written into `RuntimeConfig` per-frame):

| UiMode | beamDensity | spineParticles | orbitTrail | servingRipple | pendingRipple | cinematicMode |
|---|---|---|---|---|---|---|
| `presentation` | `event-plus-1` | true | true | true | true | `off` (operator may toggle to `spotlight`) |
| `tuning` | `all` | false | false | false | false | `off` |
| `diagnostics` | `all` | false | false | false | false | `off` |

`reducedMotion` always overrides to `false` for all `effectsEnabled`
booleans and disables the Phase 2D pulses. See
[Accessibility & Motion](#accessibility--motion) below.

**Recovery semantics**: when `reducedMotion` returns to `false` (user
toggles the OS preference off mid-session, or the OS reports
`no-preference`), `App.tsx` re-derives every `effectsEnabled.*` from
the current `UiMode` default mapping. The forced-`false` override does
not persist; the user's last `UiMode` selection is the authoritative
default once accessibility pressure lifts. (See Phase 1B's reduced-motion
listener invariant for where this recomputation lives.)

`presentationMode` keeps its existing role (central-pass scoring inside
`useBeamViz`); it does **not** drive density or effects in this SDD.

**Wiring path (mandatory for any slice that touches mode behavior):**
`UiMode` (App state) → derive `beamDensity`, `effectsEnabled`,
`cinematicMode` → write into `RuntimeConfig` → pass to
`<MainScene runtime={...}/>` → forward to `useSimulation`/`useBeamViz`.
`UiMode` itself is not pushed into `useBeamViz`; it is translated into the
runtime fields at the App boundary so future modes can be added without
reaching into render code.

## Three-Tier Visual Contract

This SDD locks in the following layer assignment. **Every phase
references this contract.** Channels are decomposed at sub-element
granularity so each pixel surface has exactly one tier owner.

### Channel registry

| Channel | Where it lives in code | Tier owner | Encodes |
|---|---|---|---|
| `cone.fill` | `meshBasicMaterial` on `coneGeo` in `SatelliteBeams.tsx` | T1 (event roles) **or** T3 (non-event roles) — never both | role color (event) or frequency color (non-event) |
| `disc.fill` | `meshBasicMaterial` on `discGeo` | T3 | frequency color (always; reduced opacity for event roles to keep T1 dominant elsewhere) |
| `disc.outerRing` | new `ringGeometry` outside the disc radius | T2 | satellite tint |
| `disc.innerRoleRing` | new `ringGeometry` inside the disc radius (event roles only) | T1 | role color (cyan/amber/violet/slate) |
| `spine.outer` | outer of the dual `Line` from satellite to ground | T2 | satellite tint |
| `spine.inner` | inner of the dual `Line` | T1 | role color (event) or frequency color (non-event) |
| `endpoint.shape` | `triangleGeometry` / `octahedronGeometry` / etc. in `glyphs.ts` | T2 | satellite glyph |
| `endpoint.color` | `meshBasicMaterial` color on the endpoint mesh | T1 | role color |
| `endpoint.fill` | filled vs hollow rendering | T1 | role active/passive |
| `cone.opacity` | static + pulse modulation | T1 | role + role-specific pulse pattern |
| `cone.dash` | `Line.dashed` flag | T1 | **only inactive uses dash** after Phase 2D |
| `callout.borderLeft` | `borderLeft` style in `Html` | T1 | role color |
| `callout.satChip` | first-line text + chip background; **also hosts the inline Unicode glyph** (`▲ ◆ ● ★`) added by Phase 2B as a textual echo of `endpoint.shape` | T2 | satellite identity string + satellite glyph |
| `callout.identityLine` | second-line text | T1 + T3 (composed text; see note below) | `SERVING · F2 B5` |
| `callout.freqSwatch` | `<span>` color block next to `F#` | T3 | frequency color |
| `panel.satChip` | InfoPanel duel-card identity row chip; mirror of `callout.satChip` including the inline glyph (Phase 4A consumes Phase 2B's glyph here) | T2 | satellite identity string + satellite glyph |
| `marker.bodyTint` | `MeshStandardMaterial.color` on cloned GLB | T2 | satellite tint |
| `marker.pointLight` | `<pointLight>` color on the marker group | T2 (color) + T1 (intensity) | satellite tint at role-driven intensity |
| `marker.textLabel` | `Text` above marker | T1 (color) + T2 (string) | role accent + satellite tag |
| `cell.outerBorder` | hex border outside cell | T2 | satellite tint of the dominant covering beam |
| `cell.innerRoleBorder` | hex border just inside cell (event-role beams only) | T1 | role color |
| `cell.fill` | hex `meshBasicMaterial` | T3 | frequency color of the dominant covering beam |
| `groundRipple` | new `ringGeometry` at serving disc center, animated radius | T1 | role color (serving / pending) |
| `spineParticles` | small particle set animating along spine | T2 | satellite tint |
| `orbitTrail` | trailing line behind satellite | T2 | satellite tint |

### Forbidden cross-uses (validated as invariants)

1. `cone.fill` MUST NOT carry a frequency color when the beam role is one
   of `serving`, `pending`, `approach`, `recentSource`. (Phase 1C
   invariant.)
2. `disc.outerRing` MUST NOT use a role color or a frequency color. Only
   satellite-tint palette entries are allowed.
3. `cell.outerBorder` MUST NOT use a role color **or a frequency color**.
   Only satellite tints. (The frequency-color exclusion makes the rule
   match cross-use #2's wording for the parallel T2 channel and lets
   Phase 3A's pixel ΔE assertion verify the rule directly.)
4. `cell.innerRoleBorder` is permitted **only** for serving/pending event
   roles, never for `approach`, `otherActive`, or `inactive`.
5. `cone.dash = true` is permitted **only** for the `inactive` role and
   for off-slot variants of serving/pending. No other role may render
   dashed after Phase 2D.
6. **T2 satellite-tint colors MUST NOT be written into T1- or T3-owned
   surfaces.** Specifically, `SATELLITE_TINT_PALETTE` entries MUST NOT
   appear in `cone.fill`, `disc.fill`, `cell.fill`, `endpoint.color`,
   `disc.innerRoleRing`, `cell.innerRoleBorder`, `groundRipple`, or
   `callout.borderLeft`. (This is the source-side mirror of cross-uses
   #2 and #3, codifying the "channels do not alias" rule that the
   channel registry implies but did not previously enumerate.)

The contract holds **per-beam**. A beam may simultaneously be `T1=serving`,
`T2=Sat-A`, `T3=F2`; each tier reads from disjoint channels. Validation
slices must explicitly assert at least one of the six forbidden
cross-uses above.

### Composed-text channel: `callout.identityLine`

`callout.identityLine` is the **only** registry entry whose tier
ownership is split. The line text (e.g. `SERVING · F2 B5`) is composed
of substrings from two tiers:

- **T1 substring**: the leading role label (`SERVING`, `PENDING`,
  `APPROACH`, `SOURCE`, or empty for non-event roles). Sourced from
  `BEAM_ROLE_TOKENS[visualRole].operatorLabel`.
- **T3 substring**: the trailing `F# B#` token. Sourced from
  `formatBeamIdentity({ ..., frequencyReuse })` (Phase 1A) and
  `formatFrequencyLabel(frequencyIndex)` (existing utility).

The `·` separator between substrings is decorative and tier-neutral.

Validation rule: a V2 SSR test must verify that **the two substrings
are textually present in the rendered output**; no V3 pixel sample is
needed because the line is plain text rendered inside the `Html`
overlay. If a future slice adds a glyph or color marker between the
two substrings, that marker registers as its own channel (e.g.
`callout.freqSwatch`) and inherits its own tier; do not treat
`callout.identityLine` as a catch-all for inline markup.

## Accessibility & Motion

This SDD introduces multiple animation cues (Phase 2D pulses, Phase 3B
particles, Phase 3D ripple, Phase 3C trail, Phase 4C camera tween).
Accumulated, these can cause discomfort for vestibular-sensitive users
and visual fatigue in long demos. The SDD adopts the following policy:

- **`prefers-reduced-motion`**: a media-query listener sets
  `runtime.reducedMotion = true` whenever the OS reports the preference.
  Every animation-driven slice must consult `runtime.reducedMotion` and
  collapse to its static state when set:
  - Phase 2D pulses → static opacity at the role's mean.
  - Phase 3B particles → no particles rendered.
  - Phase 3C orbit trail → no trail rendered.
  - Phase 3D ground ripple → no ripple rendered.
  - Phase 4C camera preset → instant snap, no tween.
- **Motion budget**: at most 3 simultaneously animating cues per role
  group (serving / pending). If Phase 3D ripple, Phase 3B particles, and
  Phase 2D pulse are all enabled, no further animation should be added
  to that beam without first downgrading another cue.
- **Manual disable toggles**: `RuntimeConfig.effectsEnabled` (per
  [Mode & Density Plumbing](#mode--density-plumbing)) lets a `ControlBar`
  switch (added in Phase 4C as a follow-up if needed) disable each
  animation channel individually, independent of `UiMode`.
- **Validation**: every Phase 2D / 3B / 3C / 3D / 4C V3 script must
  include a `reducedMotion = true` fixture and assert no animation fires.

Colorblind considerations:

- Phase 2D's role-pulse rhythm difference (2.4 s vs 1.4 s) is the
  primary deuteranopia-safe distinguisher between pending and approach,
  because their colors (amber and violet) shift hue under deuteranopia
  but their pulse rhythms do not.
- Phase 2A spine tint and Phase 2B glyph are both colorblind-safe by
  construction (off-white tints + distinct shapes).
- Open Question: a `colorblind-mode` toggle that swaps cyan ↔ amber
  to a deuteranopia-safe palette is deferred to a future SDD; this
  SDD's secondary-encoding policy (line width, dash, glyph, pulse) is
  declared sufficient pending real-user evaluation.

## Performance Budget

The SDD targets 60 fps on a 2020-class laptop GPU at `1440x900`. Each
slice must respect the budget below; slices that exceed it must
explicitly justify in their "Implementation guidance" block:

| Resource | Budget (steady state) | Per-slice cap |
|---|---|---|
| Three.js `draw calls` | ≤ 200 / frame | each slice adds ≤ 30 |
| `useFrame` callbacks | ≤ 12 active | each slice adds ≤ 2 |
| `BufferGeometry` allocations | ≤ 4 / frame **after mount** | each slice ≤ 1 / frame after mount; cache aggressively. **Mount-time allocations** (one-shot per visible-sat enter, e.g. Phase 3C orbit-trail pre-allocation) are not budgeted — they execute outside the per-frame critical path. |
| `Html` overlays | ≤ 12 / frame | each slice does not increase total beyond Phase 1B's cap |
| `pointLight` instances | ≤ 6 active | only `cinematicMode = 'spotlight'` and Phase 2C marker lights (≤ 4) |
| Per-tick CPU work (cell cover, glyph cache, palette mapping) | ≤ 1 ms | Phase 3A budget is 0.3 ms |

The "≤ 4 / frame" `BufferGeometry` budget applies to **per-tick steady
state** (i.e., after all visible satellites have entered the scene
and their pre-allocated buffers exist). Mount-time pre-allocation,
disposal-on-exit, and one-time geometry creation when a satellite
enters the visible set are explicitly **outside** this budget.
Phase 3C's pre-allocated `Float32Array` buffers (one per visible
satellite at mount, updated in place per tick) are compliant under
this clarification; per-tick `new BufferGeometry()` would not be.

Validation: Phase 4C V3 script asserts an end-to-end frame time ≤ 16.6
ms median on a fixed reference scene at `1440x900` after all slices
ship.

## Cross-cutting Conventions

The following apply to every slice:

- **Unicode glyph font**: the inline glyphs `▲ ◆ ● ★` must be rendered
  via a known-stable monospace font fallback (`ui-monospace, SFMono-Regular,
  Menlo, Consolas, monospace`); `font-feature-settings: 'liga' 0;` and
  text-rendering hints disable color emoji substitution. Validation
  fallback fixture: a fixture loaded with `font-display: block` and the
  primary font deliberately failing must still render distinguishable
  glyph silhouettes (a V3 test condition).
- **`Html` overlay z-index**: callouts use `zIndexRange={[80, 20]}`
  today (`SatelliteBeams.tsx:255`); Phase 4A duel card and Phase 4D
  diagnostics drawer must use a higher CSS `z-index` than `Html` overlays
  if they ever extend over the canvas (rare, since they sit in flex
  shells in 4B-pre, but explicit ordering avoids surprises).
- **`Math.random` seeding**: `Starfield.tsx` uses `Math.random()` per
  render. V3 validation harnesses must seed `Math.random` (e.g., via
  `seedrandom` injected into `window`) before mounting the app, and
  freeze `requestAnimationFrame` time to a fixed value before screenshot
  capture. Without seeding, V3 screenshots are non-deterministic and
  validation flakes.
- **`package.json` script registration**: every new `validate:vc*`
  script must be added to `package.json` `scripts` block. The
  implementing slice's "Touched files" already lists `package.json`; the
  slice must not omit this in the diff.
- **i18n / locale**: callouts contain Latin-script identifiers
  (`G53-01-04 · F2 B5`) and English role labels (`SERVING`,
  `PENDING`). No locale-aware formatting is required; identifiers are
  technical, not user-readable text.
- **Mobile / tablet viewports** (`768x1024`, `390x844`): Phase 4B-pre
  layout shell is the only slice that affects mobile/tablet layout
  directly. Validation viewports `768x1024` and `390x844` are mandatory
  for 4B-pre and optional for 4A, 4D. Phase 1A callout owner-tag chip
  must wrap to a second line if its rendered width exceeds the
  callout's `minWidth`.
