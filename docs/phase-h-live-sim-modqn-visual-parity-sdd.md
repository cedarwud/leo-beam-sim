# Phase H Live-Sim MODQN Visual Parity SDD

**Date:** 2026-05-28
**Status:** Slice H-S1..H-S8 SHIPPED to branch `modqn-visibility-fix`. **§4.4 (beam hopping toggle) SUPERSEDED, §4.5 partially superseded, §4.6 trigger-condition updated** by `docs/modqn-realistic-beam-geometry-cross-repo-sdd.md` (2026-05-28). The un-gating work (H-S1/H-S2/H-S3) and viz polish (H-S7/H-S8) remain authoritative.
**Owner repo:** `/home/u24/papers/project/leo-beam-sim`.
**Predecessor SDD:** `docs/modqn-training-truth-visualization-sdd.md` (S0-S1 shipped 2026-05-28 in commit `42109c0`).
**Successor SDD (beam geometry):** `docs/modqn-realistic-beam-geometry-cross-repo-sdd.md`.
**Cross-repo dependencies:** None. All Phase H slices stay inside `leo-beam-sim`.

> **2026-05-28 supersession note (read first):** Phase H assumed paper-faithful
> nadir-anchored hex-7 was authoritative; subsequent paper-text grep showed
> the paper is silent on beam geometry and the nadir-anchored choice is a
> reproducer assumption. The realistic beam geometry SDD replaces beam
> hopping (H-S4) and partly the inter-HO arc trigger (H-S6) with Earth-fixed
> cell schedule semantics. Phase I (per the realistic SDD §7) implements the
> viz-side cell overlay first; backend re-training follows.

## 0. Reading Order

Read before changing this SDD or starting any Phase H slice:

1. `.agent-memory/MEMORY.md` index then every active-priority entry —
   especially `paper-faithful-vision`, `modqn-demo-visibility-bug`,
   `dev-drift-audit-2026-05-25`.
2. `docs/modqn-training-truth-visualization-sdd.md` end-to-end. Phase H
   does **not** override its §4 hard rules. Phase H slices touch the
   live-sim render path only; the replay-mode fail-closed gates from
   training-truth SDD §4-§8 stay intact.
3. `docs/modqn-visibility-fix-mini-sdd.md` (post 2026-05-28 update). The
   render-isolation work that ships with Phase H base commit `42109c0`
   removed the compressed four-satellite context lane and the
   consumer-invented satellite-to-footprint replay cones.
4. `docs/paper-faithful-mini-sdd.md` Phase A §4 (paper-faithful 4-sat
   profile) — Phase H must not inflate the paper baseline beyond 4 sats
   / 7 beams.
5. `docs/phase-d-training-visualization-mini-sdd.md` — Phase H assumes
   the Phase D right-sidebar panels (`RewardCurvePanel`,
   `DecisionVizPanel`, `ArtifactPicker`) and the Phase B training form /
   jobs panel are already mounted in modqn-demo (verified
   `src/App.tsx:1094-1211`).
6. `CLAUDE.md` §3 (replay artifact immutability) + §5 (boundaries) +
   §9 (memory bridge). Phase H does **not** touch replay artifact
   contents, MODQN reward truth, action masks, ω-handover decisions, or
   producer ephemeris truth.

## 1. Purpose

The user-stated MODQN demo bar (verbatim 2026-05-28):

> 想看到衛星數量、移動軌跡、波束跳頻效果、波束數量、intra/inter handover
> 過程，全部視覺化呈現。波束的寬度也是參考論文的設定，看一次能覆蓋多少
> UE，波束的顏色要怎麼設定，波束的呈現效果怎麼調整，可以讓使用者清楚的
> 看到換手的過程。可以參考 sinr 分頁的做法。

Audit 2026-05-28 (this session) found that the MODQN-demo 3D scene is
gated off four ways at `src/scene/MainScene.tsx:310-313`:

```ts
const showUav = runtime.appMode !== 'modqn-demo';
const showLiveBeamCones = runtime.appMode !== 'modqn-demo';
const showLiveSatelliteMarkers = runtime.appMode !== 'modqn-demo';
const showBeamCallouts =
  runtime.beamCalloutsEnabled && runtime.appMode !== 'modqn-demo';
```

These gates were introduced to keep the MODQN view clean when the
training-truth SDD's S0-S1 work removed compressed context lanes. The
side effect, surfaced by the user, is that in **modqn-demo with live
sim** (no replay envelope loaded, or the live-sim path is the active
display source) the scene also hides the legitimate live 3D viz that
would let the user see satellite motion, beam coverage, and handover
events.

Phase H replaces the `appMode !== 'modqn-demo'` gates with
`sceneFrame.sceneSource === 'live-sim'` gates so:

- live-sim modqn-demo gets full 3D viz (beams, sat markers, callouts,
  natural Walker propagation, optional beam-hopping demo) — driven by
  `profile` + live engine, **not** claimed as producer truth.
- replay modqn-demo keeps the training-truth SDD §4-§8 fail-closed
  geometry: producer rows decide what the replay scene layer renders,
  and missing T1-T5 surfaces remain source gaps.

## 2. Boundary

| Lane | Source of truth | Phase H change | Truth label |
|---|---|---|---|
| **live-sim** | `liveSimToScene.ts` projects live engine state through `sceneGeometryFromProfile` to a `NormalizedSceneFrame` with `sceneSource: 'live-sim'`. | Un-gate beams / sat markers / callouts / inter-HO arc / beam hopping toggle. Walker propagation drops scripted `serviceAreaPassTargets`. | Labelled "live-sim demo · profile-derived" on HUD + callouts. **Not** paper-faithful producer evidence. |
| **artifact-replay** | `showcaseArtifactToScene.ts` projects MODQN replay bundle rows to a `NormalizedSceneFrame` with `sceneSource: 'artifact-replay'`. | **No change.** training-truth SDD §4-§8 fail-closed behaviour preserved. Replay scene layer keeps producer-display-proxy gating + T0-T5 truth audit. | Existing claim-boundary banner + user-trained chip + truth-audit chip. |

The single discriminator is `sceneFrame.sceneSource`. `appMode` stops
being the visual gate. The Phase H slices each replace one
`appMode !== 'modqn-demo'` check with a `sceneSource === 'live-sim'`
check; they do not add new conditional rendering at the replay layer.

## 3. Eight-Slice Plan

| Slice | Title | Files (est.) | LOC est. | Risk |
|---|---|---|---|---|
| **H-S1** | Un-gate live 3D beam cones (live-sim path). | `MainScene.tsx`, `SatelliteBeams.tsx`, `beamRoleTokens.ts`, new validator. | ~180 | low |
| **H-S2** | Un-gate live satellite markers (live-sim path). | `MainScene.tsx`, `SatelliteMarker.tsx`, new validator. | ~90 | low |
| **H-S3** | Un-gate beam callouts (live-sim path). | `MainScene.tsx`, `BeamCalloutContent.tsx`, new validator. | ~70 | low |
| **H-S4** | Beam hopping toggle (live-sim only, labelled non-paper). | New `BeamHoppingToggle.tsx`, `beam-scheduler.ts`, `useBeamViz.ts`, profile runtime override, new validator. | ~220 | medium |
| **H-S5** | Walker natural propagation in live-sim (drop scripted `serviceAreaPassTargetsSec`; RAAN stagger 90 deg). | profile JSON, `walker-constellation.ts`, `runtimeFrameStep.ts` SIM_DURATION_SEC, new validator. | ~130 | medium |
| **H-S6** | 3D inter-satellite handover arc. | New `InterHandoverArrow.tsx`, `MainScene.tsx`, replay-event gate, new validator. | ~250 | medium |
| **H-S7** | Beam material tuning + paper beamwidth footprint ring (estimate-labelled). | `beam-geometry-pure.ts`, `beamRoleTokens.ts`, `SatelliteBeams.tsx`, new validator. | ~200 | low |
| **H-S8** | Camera preset default + HUD with T0-T5 truth chip. | `App.tsx` initial camera, new `ModqnSceneHud.tsx`, validator. | ~160 | low |

Total estimate: ~1300 LOC across 8 commits. Average 165 LOC / slice.
Each slice is dispatched to Codex CLI per
`feedback_subagent_prefer_codex` memory; main thread re-verifies each
per `feedback_modqn_demo_subagent_verify`.

## 4. Slice Detail

### 4.1 H-S1 — Live 3D Beam Cones

Replace `MainScene.tsx:311`:

```ts
const showLiveBeamCones = sceneFrame.sceneSource === 'live-sim';
```

`SatelliteBeams.tsx` already exists for live-sim. The component reads
`profile.antenna.beamwidth3dBRad` via `sceneGeometryFromProfile` to size
cone geometry. Live-sim path is the SINR-experiment path (already
verified visually). Only the gate flips.

`beamRoleTokens.ts`: add an explicit live-sim color palette mirroring
SINR-experiment (serving = amber emissive, candidate = cyan,
idle = slate) so cones in modqn-demo look like the SINR scene.

Validator `scripts/validate-phase-h-s1-live-sim-beams.tsx`:

- Source-grep confirms `appMode !== 'modqn-demo'` removed from the
  `showLiveBeamCones` derivation.
- SSR a `NormalizedSceneFrame` with `sceneSource: 'live-sim'` and
  `appMode: 'modqn-demo'` → `data-beam-cone-count` on canvas root ≥ 1.
- SSR with `sceneSource: 'artifact-replay'` → live cone count = 0
  (replay layer owns rendering; gate behaviour preserved).
- Phase 7K replay-scene-layer validator regression: must stay PASS.

### 4.2 H-S2 — Live Satellite Markers

Replace `MainScene.tsx:312`:

```ts
const showLiveSatelliteMarkers = sceneFrame.sceneSource === 'live-sim';
```

`SatelliteMarker.tsx` keeps its existing props. Label format already
exists; for live-sim modqn-demo it shows `sat-{N}` plus elevation chip.
Replay markers continue to use the proxy-label per training-truth SDD
§8.

Validator: SSR `sceneSource: 'live-sim'` + 4 sats → 4 markers; SSR
`sceneSource: 'artifact-replay'` → 0 markers in this path (replay layer
draws its own proxy markers).

### 4.3 H-S3 — Beam Callouts

Replace `MainScene.tsx:313`:

```ts
const showBeamCallouts =
  runtime.beamCalloutsEnabled
  && sceneFrame.sceneSource === 'live-sim';
```

`BeamCalloutContent.tsx` shows beam ID + live SINR + role chip + a
small "live-sim" provenance tag (per training-truth SDD: the consumer
must never let display-only text look like producer-evidenced truth).

### 4.4 H-S4 — Beam Hopping Toggle (Live-Sim Only)

New `src/ui/modqn-controls/BeamHoppingToggle.tsx` mounted inside the
left sidebar's MODQN tab list. Default **off**; label reads
`Beam hopping demo · live-sim only · not paper baseline`.

When on, runtime overrides `beamHopping.enabled = true` and the
`beam-scheduler.ts` round-robin slot animation runs (`slotSec` user-
configurable [1, 5]). The replay path is unchanged: any active
`sceneSource: 'artifact-replay'` frame ignores the override and follows
the bundle's `beamHopping.enabled` (currently `false`, per
training-truth SDD §7.5 — T4 absent in baseline).

Validator:

- Toggle off → no slot animation; all 7 beams render continuously.
- Toggle on (live-sim) → `data-beam-hopping-active-slot-index` cycles
  per `slotSec`.
- Toggle on but `sceneSource = 'artifact-replay'` → live override is
  suppressed; replay path's `beamHopping.enabled === false` wins.
- Regression: training-truth SDD §4.2 "do not invent beam hopping" is
  preserved (no beam-hopping animation in artifact-replay).

### 4.5 H-S5 — Walker Natural Propagation

`src/profiles/modqn-4sat-7beam-paper-faithful.json`:

- Remove `serviceAreaPassTargetsSec: [100, 400, 700, 1000]`.
- Add `raanStaggerDeg: 90` so the 4 planes are spaced 90° apart by
  RAAN (sat-0 = 0°, sat-1 = 90°, sat-2 = 180°, sat-3 = 270°).
- Keep `inclinationDeg: 90`, `planes: 4`, `satsPerPlane: 1`. Paper
  baseline 4 sats unchanged.

`src/engine/orbit/walker-constellation.ts` honours
`raanStaggerDeg` when `serviceAreaPassTargetsSec` is absent. The
existing service-area phasing path stays as a fallback when the field
is present (other profiles, including any older replay calibrations,
keep working).

`src/scene/runtimeFrameStep.ts`: bump `SIM_DURATION_SEC` to `2400`
when the active profile is `modqn-4sat-7beam-paper-faithful` so the
user sees two or three full passes before the live cycle wraps.

Validator browser smoke: `data-visible-satellite-count` ≥ 1 for ≥ 80 %
of integer-second ticks in `[0, 2400]`. Phase D/F/G validators
regression must stay PASS (they assume 4 sats).

### 4.6 H-S6 — 3D Inter-Satellite Handover Arc

New `src/scene/handover-viz/InterHandoverArrow.tsx`, structured after
the existing `IntraHandoverArrow`. Detection rule:

- **Live-sim**: when `recentHoSourceSatId` and `recentHoTargetSatId`
  are both defined **and** differ, draw the arc between the two
  satellites' world positions.
- **Artifact-replay**: additionally require the focused row's
  `handoverEvent.kind === 'inter-satellite-handover'`. The accepted
  paper-faithful baseline has zero inter-satellite rows, so the arc
  never fires in replay — consistent with training-truth SDD §7.4.

Arc geometry: quadratic Bezier with mid-point lifted along the local
zenith vector; ends in an arrow head; pulse dot tracks `clock` time;
source-end label `sat-X`, target-end label `sat-Y → serving`.

### 4.7 H-S7 — Beam Material Tuning + Paper Beamwidth Footprint

`src/scene/beam-geometry-pure.ts` adds:

- Serving beam emissive intensity 0.6 (cone material) for live-sim.
- Opacity cap raised to 0.55 for `selected` role (existing cap 0.2 is
  tuned for the 2D replay board; in the 3D scene it reads as invisible).

Footprint ring radius derived from the training-truth SDD §5 formula:

```text
radius_km = altitude_km * tan(beamwidth_3dB_rad / 2)
         = 780     * tan(0.03490658503988659 / 2)
        ~= 13.6 km
ground_area_km2 ~= pi * 13.6^2 ~= 581 km^2
expected_ues_per_beam ~= 100 * 581 / 18000 ~= 3.2
```

Worlds units derived from `paperUserArea.kmPerWorldUnit` (already in
`MainScene.tsx`). The ring is labelled `estimate · profile beamwidth`
on its callout — never `producer truth`.

### 4.8 H-S8 — Camera Preset Default + Truth-Level HUD

`App.tsx` initial state: when `appMode === 'modqn-demo'`, default
camera preset = `'paper-faithful-closeup'` (already declared in
`MainScene.tsx:200-203`).

New `src/ui/modqn-controls/ModqnSceneHud.tsx` overlay (top-right of
the canvas) shows:

- sim time `t = NNNN.N s`
- active satellite count
- active beam count
- intra-HO total this session
- inter-HO total this session (live-sim only)
- truth-level chip from `visualState.truthAudit` (replay path) or
  `live-sim · profile-derived` (live-sim path)

One-shot onboarding hint (localStorage gated on
`leo-beam-sim.modqn-onboarding.v1`) explains the sidebar tabs —
training form, jobs, artifact picker, reward curve, decision viz —
all of which already exist from Phase B + D but are easy to miss.

## 5. Replay-Mode Behaviour Unchanged

Phase H must not change any of the following:

1. `src/modqn/replay-bundle/playback-shell.ts` validation behaviour.
2. `src/modqn/replay-bundle/replay-state.ts` envelope/shell construction.
3. `src/scene/modqn-replay-visuals/index.tsx` `producer-display-proxy`
   gating, `producer-beam-state` rendering, or arc/pulse behaviour.
4. `useReplaySceneTelemetry.tsx` T0-T5 audit publication.
5. `ClaimBoundaryBanner` content or `user-trained` chip.
6. Phase 7C strict assertions (`MODQN_EXPECTED_*` constants).
7. The `validate-modqn-render-isolation.ts` invariant — Phase H must
   not reintroduce compressed context lanes or static producer-context
   markers.

If a Phase H slice would have to weaken any of the above, the slice
stops and reopens the relevant training-truth SDD section first.

## 6. Validator Regression Matrix

Each slice runs the following before claiming PASS:

1. `npm run lint` (`tsc --noEmit`) clean.
2. The slice's own named validator (per §3 table).
3. `npm run validate:modqn-render-isolation` (no consumer-invented
   geometry reintroduced).
4. `npm run validate:modqn-omega-s3-replay-mode-wiring` (55 / 0).
5. `npm run validate:modqn-phase7k-replay-scene-layer` (T0-T5 audit).
6. The Phase B/C/D/E/F/G validators relevant to the slice (replay
   loader, scene scale, app-wire, sat-count override, per-UE
   handover, UE mobility step, UE trail viz).
7. Browser smoke for the slice's visible change (modqn-demo path).

A slice fails its own validator → controller does not commit and
reopens the brief with Codex.

## 7. Acceptance Criteria for Phase H

1. A user opening the modqn-demo tab sees 4 satellites moving in
   continuous Walker propagation; beam cones from each satellite are
   rendered with paper-faithful 2-degree beamwidth footprints; UE
   markers stand visibly above the ground; handover events (intra and
   inter) draw 3D arcs.
2. Loading any replay bundle (paper-faithful or user-trained) keeps the
   training-truth SDD §4-§8 fail-closed behaviour — no invented beam
   hopping, no invented frequency colors, no claimed inter-sat
   handover in the zero-row baseline.
3. The HUD makes it clear which lane the user is in (live-sim demo vs
   replay artifact) and what truth level the replay is unlocking.
4. The MODQN training form, jobs panel, artifact picker, reward curve,
   and decision viz panels (all shipped by Phase B + D) remain
   discoverable and continue to function.
5. The 4-satellite paper-literal baseline is not inflated.

## 8. Open Questions

1. Should the live-sim path expose the ω-handover decision overlay
   (training-truth SDD §7) or stay pure live-engine? Phase H baseline
   keeps it pure live-engine.
2. Should the beam-hopping toggle persist across sessions? Phase H
   defaults to localStorage with an opt-out chip.
3. Inter-HO arc cooldown for visual pacing when the live engine fires
   many handovers in a short window? Phase H uses a 2-second cooldown.

## 9. Cross-References

- `docs/modqn-training-truth-visualization-sdd.md` — predecessor SDD
  (§4 hard rules, §5 beamwidth formula, §7 visualization grammar,
  §8 truth levels, §9 implementation plan S0-S5).
- `docs/modqn-visibility-fix-mini-sdd.md` — 2026-05-28 update (render
  isolation + paper-follow-on profile).
- `docs/paper-faithful-mini-sdd.md` — Phase A profile lineage.
- `docs/phase-d-training-visualization-mini-sdd.md` — Phase D right-
  sidebar panels (RewardCurvePanel, DecisionVizPanel).
- `docs/phase-f-live-multi-ue-generator-mini-sdd.md` — 100-UE
  generator already shipped.
- `docs/phase-g-ue-mobility-mini-sdd.md` — UE mobility step + trail
  viz already shipped.
- `src/scene/MainScene.tsx:310-313` — the four gate lines Phase H
  replaces.
- `src/scene/NormalizedSceneFrame.ts:369` — `sceneSource` discriminator.
- `src/showcase/liveSimToScene.ts:260` — live-sim emitter.
- `src/showcase/showcaseArtifactToScene.ts:577` — artifact-replay
  emitter.
- `.agent-memory/MEMORY.md` — controller priority index.
