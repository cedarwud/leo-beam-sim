# Flowchart Dock Landscape Re-layout — mini-SDD

Status: APPROVED (2026-06-03) · Scope: single slice **F1** · Owner: Opus (architect+impl), codex (review gate)

## 1. Problem

`AlgorithmFlowchart` renders the MODQN decision pipeline as an SVG with
`viewBox="0 0 100 100"` + `preserveAspectRatio="xMidYMid meet"`
(`src/showcase/dashboard/AlgorithmFlowchart.tsx`). The 8 nodes are laid out in a
serpentine that spans the full `0..100` height (a ~1:1 square). Inside the
wide-short bottom **AlgorithmDock** strip (`_algorithm-dock.scss`,
`height: clamp(96px, 9.5vh, 132px)`, `width: 100%`), `meet` fits the square to
the *short* axis (height) and centres it → a small box with ~89% of the
landscape width wasted. This contradicts the dock-rehome SDD §2.1
"full-width pipeline strip". The Track-2 S1 slice only enlarged fonts inside the
square; the structural square-vs-strip mismatch was explicitly deferred to this
mini-SDD.

## 2. Lane / governance scope (the gating decision)

This is a change **internal to the 2D dashboard plane** — node coordinates,
SVG `viewBox`, edge path geometry, and presentational CSS. It does **not** cross
a scene render lane, and does **not** touch the dock mount, the
`sceneSource==='artifact-replay'` gate, imports, provenance, source-gap
semantics, or any data binding.

Consequences (verified against the validators):

- **Not a render-boundary change** → `validate:frontend:scene-lane-governance`
  and `docs/frontend-render-governance.md` Rule#9 need **zero edits**. The dock
  home / gating / import-cleanliness it pins are unchanged.
- **G1 edge bindings bind `edgeId` (`from->to`), never coordinates**
  (`flowchartModel.ts:resolveFlowchartEdgeBindings`). Re-layout changes only node
  `x/y` and `edgePath` geometry; `FLOWCHART_EDGES` order, channels, and
  animatable gating are untouched → `validate:phase-d:flowchart-scaffold` stays
  green with **zero edits**. (That validator locks edge bindings, `data-*`
  attrs, no-three, the exactly-one `animation:` declaration, and the rAF/useRef
  pulse driver — it does **not** lock `viewBox`, coordinates, font, `edgePath`,
  or aspect-ratio.)
- The rAF edge-pulse logic (`findCrossedBoundaries`/`resolvePulseEdgeIds`)
  operates on `edgeId` + bindings, **independent of coordinates** → the dynamic
  animation is unaffected by the re-layout.
- INV-1/2/3 and G2/G3/G4 untouched (pure geometry; no data semantics, no new
  per-frame React state, no three).

→ Structural (node re-layout) but governance-clean: mini-SDD authored, lane
check performed, result = no boundary crossed, no validator/doc edits required.

## 3. Layout — 7-node spine + reward feedback bus

```
 state → qnet → omega → mask → select → serving → handover
          ▲                                  │
          │  (RL feedback bus)        serving→reward ▼
          └───────────────  reward  ◄──────────┘
```

Top spine (left→right): `state qnet omega mask select serving handover`. Edges
1–5 plus `serving→handover` are all adjacent horizontal hops. `serving→reward`
drops straight down to `reward` (directly below `serving`); `reward→qnet` is the
long bottom feedback bus (the iconic RL training loop). The only two
non-left-to-right edges are both feedback — reads correctly.

`reward->qnet` keeps `sourceChannel: 'none'` (training-internal gradient, absent
from inference replay) → permanently non-animatable (unchanged G1 fact).

## 4. viewBox + fill strategy

- `viewBox="0 0 360 42"` (≈8.57:1), `preserveAspectRatio="xMidYMid meet"`
  (uniform scaling — **never** `none`, so boxes/text never distort).
- Dock CSS: `.leo-algorithm-flowchart` → `aspect-ratio: 360 / 42; width: 100%;
  height: auto; max-height: 150px`. At common widths (~1120–1350px) height
  ≈ width/8.57 < cap → the strip **fills horizontally, no side gutter**. Beyond
  ~1350px the `max-height` cap holds height at 150px and `meet` re-centres
  (minor side gutter only on ultra-wide), so the flowchart never dominates the
  dock body.
- Base `.leo-algorithm-flowchart { aspect-ratio }` migrates 1.35 → `360/42`
  (defensive consistency for the now-dead non-dock path; meet keeps a future
  narrow remount as graceful letterbox, not a broken square).

## 5. No new `variant` prop

The `AlgorithmDashboard` `variant='sidebar'` default is **dead** — after R1 the
dashboard is mounted only via `App.tsx → AlgorithmDock → AlgorithmDashboard
variant="dock"`. The flowchart has a single rendering context (the dock), so a
global landscape re-layout is correct; adding a `variant` prop would preserve a
dead square path and double layout maintenance. `meet` covers any hypothetical
narrow remount.

## 6. Node coordinates (viewBox 360×42)

`NODE_WIDTH 17→42`, `NODE_HEIGHT 9→13`.

| node | x | y | | node | x | y |
|---|---|---|---|---|---|---|
| state | 26 | 12 | | serving | 283 | 12 |
| qnet | 77 | 12 | | handover | 334 | 12 |
| omega | 129 | 12 | | reward | 283 | 31 |
| mask | 180 | 12 | | | | |
| select | 231 | 12 | | | | |

`edgePath()` simplifies: spine edges → default `rightAnchor(from)→leftAnchor(to)`;
`serving→reward` → `bottomAnchor→topAnchor` (vertical); `reward→qnet` → bottom
bus elbow `[bottom(reward), (rewardX, 40), (qnetX, 40), bottom(qnet)]`.

Presentational retune (browser-verified): edge stroke-width, node-rect stroke,
node font-size, pulse-keyframe stroke widths, and arrow `markerWidth/Height`
rescaled for the new px/unit scale (the wider viewBox renders ~2.6× larger per
unit than the old square). Values tuned against the live dock, not pre-derived.

## 7. Slice F1 + verification loop

One slice. Files: `flowchartModel.ts` (coords), `AlgorithmFlowchart.tsx`
(NODE_WIDTH/HEIGHT, viewBox, `edgePath`, marker), `main.scss` (base aspect +
stroke/font/keyframe rescale), `_algorithm-dock.scss` (fill strategy).

Loop: Opus-direct impl → main-thread re-verify (tsc + `flowchart-scaffold` +
`scene-lane-governance` + `reward-curve` + build) → `codex review --base main`
gate → Opus fixes → re-review CLEAN → ff-merge → push.

Browser smoke (`?sceneSource=artifact-replay`): flowchart **fills the dock width**
(landscape strip, not a centred square) + rAF edge pulse still fires + zero
console errors.
