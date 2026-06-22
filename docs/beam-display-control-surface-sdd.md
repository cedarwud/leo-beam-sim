# Beam-Display Control-Surface mini-SDD

**Status:** PROPOSED — awaiting owner greenlight (plan-approval gate).
**Date:** 2026-06-22.
**Owner pain (verbatim):** *"I want to adjust ALL beam-related behaviour via a quick
prompt — edit the RIGHT place once, and NOT have other rules override / overlap my
change."* The recurring complaint: every beam edit has either (a) hit the wrong file, or
(b) been silently shadowed by another rule.

This SDD is built from an exhaustive inventory (`beam-control-surface-inventory`
workflow, 7 source files, 117 beam-appearance behaviours catalogued).

---

## 1. Root cause — why "改了越亂"

Beam appearance is decided in **three disjoint places**, with **hidden precedence**
between them:

1. `beamDisplaySpec.ts` — a *partial* control surface (7 fields: opacity, width,
   candidate colour, pulse colours, callouts toggle, non-serving toggle).
2. `sinrLiveConeStyle.ts` + `servingColour.ts` + `sinrServingMosaic.ts` — **~25
   hardcoded consts** (every other colour, the 墨綠 background, blending, elevation-dim
   band, footprint, mosaic, base-alpha). NOT on the spec.
3. `MainScene.tsx` mount wiring — **which props each of the 6 cone mounts passes**, the
   `focusSatIds` narrowing (which beams exist at all), the hero selection, the
   triggered-intra memo. NOT on the spec.

The two failure modes map exactly:

- **(a) wrong place** — the knob a prompt wants is split across 3 files; the right one
  is unguessable.
- **(b) overridden** — appearance flows through a precedence chain
  (`resolveSinrLiveConeRenderColor`: hero > kind > candidate-override > background >
  item.color) **plus** a multiplicative elevation-dim **plus** a global blending mode
  **plus** the `focusScope` set that can drop a cone entirely. A value you *can* set is
  shadowed by one you *can't*. The worst is the elevation-dim: it silently multiplies a
  raised opacity down to 5%, invisible and unreachable.

## 2. Design

> **One `BeamDisplaySpec` struct is the SOLE input to a pure beam renderer. Every
> beam-appearance decision is a named field on it. Nothing outside the spec may decide
> beam appearance. A governance gate enforces this so it can never regress.**

Three guarantees, each killing one failure mode:

- **Single surface (kills a):** every beam behaviour = one named field in
  `BeamDisplaySpec`. Any beam prompt → edit one field in one file.
- **Pure renderer (kills b):** the cone/footprint/callout/mosaic renderers become a pure
  function of the spec — `render(spec) → meshes`. No const, no per-mount literal, no
  out-of-band rule can shadow a field. Precedence (hero/candidate/background) becomes a
  *single declared spec→opts mapping the renderer owns*, not JSX mount wiring.
- **Anti-regression gate (keeps it true):** `validate:frontend:beam-display-spec-purity`
  forbids any literal beam colour / opacity / blending / dim magic-number in the render
  paths outside a `BeamDisplaySpec` read. Folded into the pre-commit `validate:governance`
  batch, after the three SACRED invariants.

The consts do not disappear — they become the **defaults** (`DEFAULT_BEAM_DISPLAY_SPEC`).
So default behaviour is byte-identical; the spec just makes every value reachable.

## 3. The complete `BeamDisplaySpec` field set (~38 fields)

Grouped by category. `*` = already on the spec today (keep). Default column = current
behaviour-preserving value (the migrated const).

### Cone colour
| field | default | replaces |
|---|---|---|
| `heroConeColor` | `#22c55e` | `SINR_LIVE_CONE_SERVING_PRIMARY_COLOR` (MainScene:1725 literal) |
| `backgroundConeColor` | `#46544d` (墨綠) | `SINR_LIVE_CONE_BACKGROUND_COLOR` (MainScene:1710,1726) |
| `candidateConeColor` * | `#3b82f6` | already a field |
| `pulseIntraColor` * | `#86efac` | already a field |
| `pulseInterColor` * | `#86efac` | already a field |
| `triggeredIntraFromColor` | `#f97316` | `SINR_LIVE_TRIGGERED_INTRA_FROM_COLOR` (MainScene:1262) |
| `triggeredIntraToColor` | `#22c55e` | `SINR_LIVE_TRIGGERED_INTRA_TO_COLOR` (MainScene:1263) |

### Cone opacity
| field | default | replaces |
|---|---|---|
| `servingConeOpacity` * | `0.45` | already a field (ambient field) |
| `heroConeOpacity` | `0.8` | const branch `SinrLiveCellBeamCones:786` — **a (b)-shadow today** |
| `nonServingConeOpacity` | `0.04` | `resolveSinrLiveConeLayerOpacity('nonServing')` (MainScene:1708) |
| `candidateConeOpacity` | `0.45` | split off the shared `servingConeOpacity` (MainScene:1738) |
| `pulsePeakOpacity` | `0.8` | `SINR_LIVE_CONE_PULSE_PEAK_OPACITY` default arg |
| `triggeredIntraPeakOpacity` | `0.95` | `SINR_LIVE_TRIGGERED_INTRA_PEAK_OPACITY` |

### Cone shape / compositing
| field | default | replaces |
|---|---|---|
| `coneWidthScale` * | `1` | already a field |
| `coneBlending` | `'normal'` | `SINR_LIVE_CONE_BLENDING` — string→`THREE.Blending` in renderer |
| `coneBaseAlphaFactor` | `1.0` | `SINR_LIVE_CONE_BASE_ALPHA_FACTOR` — **purity fix needed** (§5) |
| `coneSegments` | `32` | `SINR_LIVE_CONE_SEGMENTS` |
| `triggeredIntraSustainMs` | `3200` | `SINR_LIVE_TRIGGERED_INTRA_SUSTAIN_MS` |

### Elevation dim (the insidious multiplicative shadow)
| field | default | replaces |
|---|---|---|
| `elevationDimEnabled` | `true` | bare `dimShallowCones` literal (MainScene:1724,1740) |
| `elevationDimFloorDeg` | `22` | `SINR_LIVE_CONE_DIM_ELEVATION_FLOOR_DEG` |
| `elevationDimCeilDeg` | `42` | `SINR_LIVE_CONE_DIM_ELEVATION_CEIL_DEG` |
| `elevationDimMinFactor` | `0.05` | `SINR_LIVE_CONE_DIM_MIN_FACTOR` |
| `heroExemptFromElevationDim` | `true` | `&& !isHero` literal (SinrLiveCellBeamCones:787) |

### Which beams render (the biggest "changed but invisible" source)
| field | default | replaces |
|---|---|---|
| `focusScope` | `'heroOnly'` | `sinrLiveTargetSatIds` memo + `showNonServingCones`→`focusSatIds` coupling (MainScene:1098-1104,1120,1192). Type: `'heroOnly' \| 'allServing' \| {satIds[]}` |
| `pulseFocusFollowsScope` | `true` | the un-widened pulse-event filter (MainScene:1220-1223) |
| `showNonServingCones` * | `false` | already a field (now ONLY adds the co-channel layer, decoupled from scope) |

### Footprint hexes
`footprintRingsEnabled` (true), `footprintOuterOpacity` (0.55),
`footprintOuterInnerFactor` (0.93), `footprintInnerBandInnerFactor` (0.6),
`footprintInnerBandOuterFactor` (0.7), `footprintInnerBandOpacity` (0.5),
`footprintYLift` (0.6) — all migrate the `SINR_LIVE_FOOTPRINT_*` consts.

### Callouts
`beamCalloutsEnabled` * (true), `calloutYLift` (26 = `SINR_LIVE_CALLOUT_Y_LIFT`).

### Mosaic UE dots
`mosaicUnservedColor` (`#64748b`), `mosaicUnservedEmissive` (`#334155`),
`primaryUeMarkerColor` (`#ff3333`, index-0 focus dot), `servingIdentitySaturation`
(0.72 — **one knob feeding BOTH `colorForServingBeam` + `colorForServingSatellite` in
lockstep**; do not split or the dot/hex/cone colour-match desyncs).

### Colour-match reconciliation modes (new capability)
`footprintColorMode`, `calloutColorMode`, `mosaicServedColorMode` — each
`'identity' | 'matchConeRender'`, **default `'identity'` = today's behaviour**. Today the
hex / chip / dot read raw `item.color` and bypass the cone's resolved colour, so
recolouring a cone (hero/candidate/background) leaves its hex + dot on the old hue.
`'matchConeRender'` routes them through `resolveSinrLiveConeRenderColor` so "make beam X
and its UEs colour Y" actually moves all three together.

## 4. Out-of-band override map (the 15 "(b) shadow" sites)

These are the sites where appearance is decided OUTSIDE the spec and can shadow a field.
Each is closed by migrating its value into the spec (above). The non-obvious ones:

- **`SinrLiveCellBeamCones:786`** — hero opacity forces `0.8`, ignoring the
  `servingConeOpacity` field. → `heroConeOpacity` field + threaded prop.
- **elevation-dim** (`MainScene:1724,1740` + `SinrLiveCellBeamCones:673-675,787`) —
  multiplies the resolved opacity down to 5%, always-on literal, hero-exempt by literal.
  The most invisible shadow. → the `elevationDim*` cluster.
- **`SinrLiveCellBeamCones:719,189`** — global blending + import-time alpha buffer
  re-shade EVERY colour. → `coneBlending` + `coneBaseAlphaFactor` (purity fix §5).
- **`MainScene:1098-1104,1120,1192,1220`** — the `focusSatIds` set decides which cones
  exist; a colour/opacity edit looks dead when this dropped the cone. → `focusScope`.
- **footprint / callout / mosaic read `item.color` directly** — a separate colour
  authority from the cone. → the `*ColorMode` fields.
- **`MainScene:527`** — the MODQN-preview lane passes an inline spec literal. → make it a
  named `modqnPreviewBeamDisplaySpec` preset derived from the default (one declared
  object, not a buried literal).

**Lane gates** (`sceneLaneRenderPlan.ts` `showSinrLiveCellBeams/Pulse/Mosaic`) stay OUT
of the spec **by design** (one-lane-one-proof render governance). They are the precedence
ceiling — documented, not folded in.

## 5. Renderer-purity gaps (blockers to `render(spec)`)

1. **`CONE_VERTEX_COLORS`** is a module-level buffer built ONCE at import from
   `BASE_ALPHA_FACTOR` (`SinrLiveCellBeamCones:189`). A spec field can't take effect
   until this becomes a `useMemo` keyed on `coneBaseAlphaFactor` (default 1.0 → byte-
   identical). *(Commit 11.)*
2. **Precedence lives in JSX** — which opt props each mount passes decides the colour
   precedence, not the spec. Fold per-mount opt selection into one `spec→opts` mapping
   the renderer owns.
3. **Hero opacity / blending / dim band** read module consts inside the component, not
   props. Each must become a threaded prop.
4. **Footprint + callouts** have their own non-spec colour path → same `spec→colour`
   resolution must apply.
5. **Mosaic dot** colour comes from a different module (`colorForServingSatellite`) than
   the cone (`colorForServingBeam`) — two authorities feed one "colour-match" claim.
6. **`focusScope`** is an appearance-determining input not in the spec.
7. **triggered-intra** colours/opacity/sustain read consts inside a MainScene memo — the
   most-visible layer is decided entirely outside the spec/renderer boundary.

## 6. Migration order — 18 behaviour-preserving, gated commits

Every commit: add field(s) with a behaviour-preserving default, thread into the renderer,
repoint any source-pinned validator **in the same commit** (Rule#9), gate before moving on.

1. **Governance scaffold** — add `beam-display-spec-purity` validator in **WARN/allowlist**
   mode (lists every current const site → green now, tightens as fields migrate). Wire into
   `validate:governance` + `validate-static-all.mjs`.
2. `heroConeColor` · 3. `backgroundConeColor` · 4. `candidateConeOpacity` (split) ·
   5. `nonServingConeOpacity` · 6. `heroConeOpacity` · 7. `pulsePeakOpacity`.
8. **triggered-intra cluster** (from/to colour, peak, sustain) — one commit, coupled layer.
9. **elevation-dim cluster** (enabled, floor, ceil, min, hero-exempt).
10. `coneBlending` + `coneSegments`.
11. **`coneBaseAlphaFactor`** — the renderer-purity commit (useMemo the vertex buffer).
12. **footprint cluster** (7 fields). · 13. `calloutYLift`.
14. **colour-match MODE fields** (footprint/callout/mosaic, default `'identity'`) — careful
    commit, touches the `beam:colour-match` invariant; default path unchanged, `matchConeRender`
    is a tested NEW capability.
15. mosaic colours (unserved, emissive, primary-UE). · 16. `servingIdentitySaturation`.
17. **`focusScope` + `pulseFocusFollowsScope`** — the WHICH-beams field, **LAST, highest
    blast radius**: untangles the `showNonServingCones`↔`focusSatIds`↔pulse-filter coupling.
    Default `'heroOnly'` reproduces today exactly. Isolate in a worktree, dual-lane pixel proof,
    per the frontend-change-contract dispatch protocol.
18. **Flip the purity gate WARN→ENFORCE** — allowlist emptied, assert the renderer reads
    ONLY the spec. Update `validate:governance` + `validate:static:all` atomically.

### Proposed phasing (execution, not design)

- **Phase A — core capability (commits 1-3, 5, 6, 8, 9, 17, + gate in WARN):** the colours,
  opacities, elevation-dim, and `focusScope`. This covers ~90% of real beam prompts
  ("候選改紅", "服務波束更亮", "墨綠提亮", "顯示全部/只服務", "低空斜錐砍掉", "換手閃色"). The
  gate runs in WARN/allowlist for the not-yet-migrated rest, so what IS migrated can't
  regress.
- **Phase B — completeness (commits 4, 7, 10-16, 18):** footprint, callout, mosaic, blending,
  segments, saturation, colour-match modes, then flip the gate to ENFORCE.

Recommendation: **Phase A first.** Fastest path to the actual capability; Phase B is
incremental and the gate prevents backsliding.

## 7. Governance gate spec

`validate:frontend:beam-display-spec-purity` (v2; fast, in the pre-commit `validate:governance`
batch; discovered by `validate:static:all` + CI `static-gates`). **The gate header is the
authoritative scope — this section must stay in sync with it (an independent review 2026-06-22
found v1 over-claimed; v2 + this section state the EXACT scope honestly).**

**COVERED (turns RED today):**
1. a colour LITERAL in any form (`#rgb` / `#rrggbb` / `#rrggbbaa` / `0xRRGGBB` /
   `rgb()`/`rgba()`/`hsl()`/`hsla()`) at a geometry-colour render site —
   `SinrLiveCellBeamCones`, `SinrLiveCellFootprintRings`, the mosaic cone/dot colour — outside
   the per-file allowlist. A RE-TINT of an allowlisted literal gets ONE clear message (update
   the entry or migrate), never a contradictory pair.
2. a colour / numeric-opacity / `THREE.*Blending` LITERAL, or a migrated appearance const, in a
   `<SinrLiveCellBeamCones …/>` MOUNT in MainScene (mounts must pass `beamDisplaySpec.*`).
3. a migrated appearance const re-appearing ANYWHERE in MainScene.
4. a NEW `src/viz/SinrLiveCell*` render file not classified in the gate (closes the new-file bypass).

**KNOWN GAPS (NOT yet covered — Phase B; do not trust the gate for these):**
- non-hex appearance consts read INSIDE the render components (`SINR_LIVE_CONE_BLENDING`,
  `_SEGMENTS`, `_BASE_ALPHA_FACTOR`, the `SINR_LIVE_FOOTPRINT_*` factors, callout Y-lift) — still
  hardcoded in-component; Phase B migrates them + extends the gate to forbid their import.
- `servingColour.ts` (the `colorForServingBeam` identity authority) — it legitimately COMPUTES the
  palette (a colour-authority home, like `sinrLiveConeStyle`); the separate `beam:colour-match`
  gate covers its CONSISTENCY; this gate does not police its values.
- `GroundScene` UE-marker colours + OTHER scene lanes (`EarthFixedCells`, `CellBeamCones`, …) —
  a different render lane, out of this lane's spec by render-governance lane separation.

**ESCAPE for COMPUTED colour (the F3 finding):** a flat spec field cannot hold a colour FUNCTION
(e.g. SINR-band red/amber/green, a per-cell heatmap). The sanctioned home for a colour ramp /
data→colour mapping is a RESOLVER like `resolveSinrLiveConeRenderColor` (a `coneColorMode` field
selects the mode; the resolver owns the ramp literals). The gate does NOT forbid literals inside
such a resolver — that is the blessed indirection, not scatter. Build it when a data-driven mode
is actually needed (YAGNI until then).

Runs alongside `s0:connected-sat-has-beam`, `s0:geometry-trace` zero-diff, and `beam:colour-match`
in the governance batch (SACRED invariants preserved).

**Right-size the validation — colour/opacity tweaks are FAST.** A pure colour or opacity
VALUE change (edit one spec-field default in `sinrLiveConeStyle.ts`, no geometry / lane /
blending / mount-structure change) needs only `validate:governance` (~16s, includes
`colour-match`) + ONE `:3000` screenshot (~10s) — NOT `validate:ready` (~T+930s browser smoke)
or `validate:static:all` (~8min), which verify STRUCTURE a recolour cannot move. See the
"Fast-path — NON-STRUCTURAL changes" carve-out in `docs/frontend-change-contract.md` (colour
is one row of a broader family — CSS/text/DOM/pose all qualify, with the counted-invariant guardrails).
This is why every recolour commit in this plan validated in ~30s, not minutes; running the
heavy browser/static gates on a one-hex change is the "why is changing a colour so slow?"
anti-pattern.

## 8. Risks / invariants (immovable)

- **Validator source-pins** — the repo pins validators by body STRING. The colour/footprint/
  blending consts are likely pinned by `phase-c:sinr-live-cells:render` + the colour-match
  gates. Each "const → default" commit MUST repoint its pinning string in the same commit;
  run `validate:static:all` (8min) before each handoff. (Known live rot: `phase-c:sinr-live-cells:render`
  `BASE_ALPHA_FACTOR=1.0` vs a fade-in `(0,1)` assert is already orphaned-RED — fix or
  re-quarantine when commit 11 touches the alpha buffer.)
- **`s0:connected-sat-has-beam`** — counts MOUNTED meshes, so opacity/colour fields are
  safe; but `focusScope` (commit 17) changes WHICH cones mount. `'allServing'` must still
  mount a cone for every serving sat; `'heroOnly'` default must reproduce today's mounted
  set exactly; a `{satIds}` scope must be a display FILTER over the serving set, never able
  to hide a serving sat below the must-hold.
- **`s0:geometry-trace` zero-diff** (Rule#6 display-only) — no migration may touch
  `baseRadiusWorld`/`userData`/placement. `coneBaseAlphaFactor` (commit 11) must produce a
  byte-identical buffer at default 1.0.
- **`beam:colour-match`** — commits 14 + 16 are the blast-radius ones. `'identity'` defaults
  preserve the match; `matchConeRender` is a divergence-RECONCILING path that needs its own
  colour-match assert. `servingIdentitySaturation` must stay a single knob feeding both colour
  fns or the dot/hex desync.
- **MODQN-preview lane** shares this render (`MainScene:527`); every field needs a behaviour-
  preserving default AND the MODQN preset must be a declared object, or a default change
  silently alters the MODQN lane.
- **`coneBlending` back to Additive** re-shades every colour over the bright terrain (the
  documented 顏色調不準 root) — keep default Normal; additive is explicit opt-in only.

## 9. Open decisions for owner

1. **Phasing** — Phase A core-first (recommended), or the full 18-commit run in order?
2. **Execution** — dispatch the migration to worktree-isolated agents per the
   frontend-change-contract (recommended for the higher-blast commits 11/14/17), or do it
   inline?
3. **`focusScope` default semantics** — keep `'heroOnly'` as the shipped default (today's
   look), or change the *default* to `'allServing'` / serving+candidate while we're here?
   (The field makes it a one-word prompt either way; this is only about what ships by
   default.)
