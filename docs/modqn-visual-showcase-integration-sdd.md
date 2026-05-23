# MODQN visual-showcase-v1 → leo-beam-sim Integration Architecture SDD

- **Status:** DRAFT — architecture decision document. **No implementation authorized.**
  Pending dual adversarial review (`/codex challenge` + second-Claude reviewer)
  per `/home/u24/papers/AGENTS.md` §7.1.
- **Author role:** controller (Claude Code, Opus), drafting only. Executor dispatch is **not** authorized by this document.
- **Date:** 2026-05-22
- **Scope:** how `leo-beam-sim` consumes a producer-owned `visual-showcase-v1`
  artifact (MODQN paper replay) **alongside** the existing live SINR / handover
  simulation, without letting display needs rewrite research truth.
- **Trigger artifact (validated input):**
  `modqn-paper-reproduction/artifacts/phase-01h-mp5-visual-showcase-cli-smoke-2026-05-22/visual-showcase-v1.json`
  - SHA-256 `0cfaf33e6b788e0722249dba12a7615275b0e3c6ee346662b2429b104ed383ef`
  - `artifactId: "test-phase-01h-mp5-visual-showcase"`

## Authority and boundary surfaces consulted

1. `/home/u24/papers/AGENTS.md` (§1 scope split, §7 multi-tool convention, §9 heavy-compute routing)
2. `/home/u24/papers/ntn-showcase-stack/AGENTS.md` + `README.md` + `docs/repo-roles.md` + `docs/artifact-contract-v1.md`
3. `/home/u24/papers/project/leo-beam-sim/AGENTS.md`
4. `/home/u24/papers/ntn-sim-core/docs/modqn-paper-reproduction-to-leo-beam-sim-handoff.md`
5. `/home/u24/papers/ntn-sim-core/src/core/contracts/visual-showcase-v1.ts` (frozen v1.1 contract)
6. `modqn-paper-reproduction/CLAUDE.md` §Visual Showcase Handoff + governance

### Non-negotiable inherited constraints

- **R1.** `leo-beam-sim` must not recompute SINR, handover decisions, MODQN
  actions, rewards, geometry truth, or provenance for the replay path. It may
  interpolate/animate but must not invent truth states. (handoff doc §leo-beam-sim Constraints; repo-roles)
- **R2.** `modqn-paper-reproduction` is the producer/truth owner. Display needs
  in `leo-beam-sim` must not change training, eval, reward, action, SINR,
  handover, evidence, or provenance semantics. (modqn `CLAUDE.md` §Visual Showcase Handoff #5)
- **R3.** Validate every external artifact through `ntn-sim-core`
  (`npm run validate:visual-showcase:artifact -- <artifact>`) before rendering.
- **R4.** No big-bang merge with `ntn-sim-core`; live-sim rigor comes from
  vendored `src/core/{module}` only. This SDD does **not** add a live-sim
  module port.
- **R5.** The artifact carries `provenance.claimBoundary` / `evidenceStatus`;
  the UI must surface them and must not promote forbidden claims (Multi-Catfish,
  Catfish-EE, general EE-MODQN superiority, physical energy saving, etc.).
- **R6.** **Live-engine single-UE invariant.** `core/channel` interference
  behaviour is validated only at N=1; live-sim UE count is **hard-locked at 1**
  for P1–P5. Multi-UE live-sim is **out of scope** for this SDD. Cat A
  "Active UE count" therefore exposes a control with live default = 1 (fixed,
  not user-mutable) and replay = display-filter only. Adding multi-UE live
  rendering requires a separate validator + SDD bump (not authorized here).

---

## 1. Problem statement

`leo-beam-sim` today is a **single-UE live simulator**: every frame it computes
SINR and handover decisions in-browser from vendored `src/core/channel` +
`src/core/beam` and renders the result. The validated artifact is the opposite
shape: a **multi-UE, frozen, producer-owned replay** in which SINR (actually
paper **SNR**), geometry, handover kind, MODQN action, reward, and policy
diagnostics are all source truth that **must not be recomputed**.

The integration must let the existing renderer present the artifact **without**
the live engine touching it, while keeping both paths first-class. The central
risk is the frontend silently re-deriving research truth (re-running SINR,
re-classifying handover, mislabeling SNR as SINR) to make the demo convenient —
which would violate R1/R2 and make the artifact non-defensible.

---

## 2. Current-state findings (evidence)

### 2.1 Live-sim path (exists)

- `src/scene/useSimulation.ts:273-304` — `useFrame()` advances sim time and calls
  `stepRuntimeFrame()` every frame.
- `src/scene/runtimeFrameStep.ts:404-712` — `stepRuntimeFrame()` interpolates
  satellites, filters by elevation, computes SINR via `buildLinkContext()` →
  `computeLinkBudget()` (vendored `src/core/channel`), runs `HandoverManager.update()`,
  and emits a `SimFrame`.
- `src/scene/runtimeFrameStep.ts:495-507` — builds **exactly one** `ueObserver`
  per frame. **No multi-UE loop exists.** This is the **single-UE invariant**
  for the live path (R6 binding): live UE count remains 1 throughout P1–P5;
  any control labelled "UE count" in the shared settings panel is read-only at
  live and is a display-filter at replay.
- Render input model: `SimFrame` (`src/scene/types.ts:226-265`) →
  `useBeamViz()` (`src/scene/useBeamViz.ts:223-892`) → `VizFrame`
  (`src/scene/types.ts:285-296`) → scene components.
- Display culling: `MAX_DISPLAY_SATS = 12`, `MAX_EVENT_SATS = 8`,
  `MAX_BEAM_SATS = 3` (`src/scene/useBeamViz.ts`).

### 2.2 Existing "MODQN replay" is a decision overlay, NOT source-truth replay

- `src/ui/useModqnHandoverState.ts` defines handover modes
  `'sinr-offset' | 'modqn-replay' | 'omega-heuristic'`.
- `src/scene/useSimulation.ts:137-178` — in `modqn-replay` mode it calls
  `reScalarize()` to **override the handover decision**, but **geometry and SINR
  still come from the live engine** (`buildLinkContext`/`computeLinkBudget`).
- The consumed format is the **old MODQN replay bundle**
  (`src/modqn/replay-bundle/loader.ts`, `runtime-fetch.ts`): `manifest.json` +
  `timeline/step-trace.jsonl` + `provenance-map.json`, served by a Vite plugin at
  `/modqn-bundles/...` (`vite.config.ts`).
- **Conclusion:** the existing replay mode is "live SINR/geometry + replayed
  decision". It is **not** the source-truth replay the `visual-showcase-v1`
  contract requires, and it is single-UE. Reusing it for the artifact would
  violate R1 (it recomputes SINR/geometry).

### 2.3 visual-showcase-v1 consumer — NOT FOUND

There is **no** code in `leo-beam-sim` that loads or parses the single-file
`visual-showcase-v1` contract. The only "replay" code is the older bundle loader
in §2.2. This integration is greenfield on the consumer side.

### 2.4 The artifact (verified + inferred)

Verified from the file (`diagnostics` block + contract):

- 4 satellites (`sat-0`…`sat-3`), **7 beams each → 28-action space**;
  `validActionCount: 7` per decision; action order satellite-major / beam-minor.
- `actionScoreKind: "full-dense-scalarized-q-vector"`; invalid-action sentinel
  `-1000000000.0` (`invalidActionScoreKind: finite-masked-action-sentinel-not-policy-q`),
  gated by `decisionActionValidityMask`.
- 1 Hz timeline (`timesSec: 0,1,2,…`).

Known from the handoff contract for `scenario.profile: "modqn-multi-ue"`
(handoff doc §Multi-UE MODQN Profile):

- `truthOwnership.sinr.channelMetricKind: "snr-no-interference"` — **`sinrDb` is
  paper SNR, not interference-aware SINR.**
- per-UE candidate channel at `timeline[].ues[].candidateSinrDbByBeamId`.
- each `timeline[].ues[].decisionRef` resolves to a
  `diagnostics.decisionFrames[]` entry with matching `ueId`;
  `modqnDecision.diagnosticsRef` is the **primary-UE** summary.
- coordinates may be `coordinateFrameKind: "eci-km-no-earth-rotation-proxy"`
  stored in `positionEcefKm`, each carrying `positionProvenance`.
- `modqn-paper-reproduction` may own `sinr`, `geometry`, `handover` in `truthOwnership`.

> ✅ **Confirmed by codex CLI direct parse of the 31 MB JSON
> (2026-05-22):** **100 UEs, 61 timeline frames, 4 satellites, 28 beams**
> (7 per sat); handover-kind distribution = **1 intra-satellite frame + 60
> `none` frames** (zero inter-satellite handover events in this smoke artifact).
> OQ-1 closed. Implication for P4: this artifact alone cannot exercise the
> inter-satellite overlay path — a multi-handover artifact is required to
> validate P4. Implication for P2 budget: ~100 UE × 4 sat × 7 beam ≈ 2 800
> per-UE candidate channel values per frame.

---

## 3. The eight architecture questions, answered

### Q1 — Should artifact replay and live SINR sim be split into two data-source/profiles?

**Yes — but on a new axis, not as a fourth handover mode.** Introduce a
top-level `sceneSource` discriminator:

```
sceneSource = 'live-sim' | 'artifact-replay'
```

- `live-sim` keeps the existing `profile` (constellation/signal config) and
  `handoverMode` (`sinr-offset`/`modqn-replay`/`omega-heuristic`) machinery.
- `artifact-replay` is **orthogonal**: when active, the live engine
  (`stepRuntimeFrame`, `core/channel`, `HandoverManager`) is **bypassed
  entirely**; profile/handoverMode/signal-tuning controls are **disabled** because
  all truth comes from the artifact.

Rationale: the two paths differ in *who owns SINR/geometry/handover*. That is a
data-provenance distinction, so it belongs above `profile`/`handoverMode` (both
of which are live-sim concepts). Modeling artifact replay as a 4th `handoverMode`
(see Rejected Alt A) would keep the live SINR engine in the loop and violate R1.

### Q2 — Should the two paths share the same 3D rendering components?

**Yes — sharing the renderer is the entire point.** Both paths must emit a
single **normalized scene frame** (Q7) consumed by the same
satellite/beam/link/Earth/camera components. The exceptions are scale-driven:

- **Reuse as-is:** `SatelliteMarker`, `SatelliteBeams` (cones), `OrbitTrail`,
  Earth/`EarthFixedCells`, camera (`useCameraControls`), handover overlays
  (`IntraHandoverArrow`, `HandoverLinks`, `HandoverToastOverlay`).
- **Generalize for N UEs:** the UE/ground + per-UE link layer (`GroundScene`,
  link rendering) is single-UE today and must become instanced/batched for the
  multi-UE artifact (Phase 2). This is additive; it must not regress the
  single-UE live path.

The renderer must stay **source-agnostic**: it renders the normalized frame and
never reads the raw artifact (prevents truth-reinvention — see Rejected Alt C).

### Q3 — What is producer-owned truth vs leo-beam-sim display-only projection?

The split is exactly the `visual-showcase-v1` `truthOwnership` contract. See the
**Data Ownership Table (§6)**. Summary:

- **Producer-owned (immutable):** SINR/SNR values + `channelMetricKind`, satellite
  & UE positions and coordinate frame, beam footprint/half-angle/gain (or its
  disclosed gap), handover kind/phase/`sourceHandoverOccurred`, MODQN
  action/validity-mask/scores, reward scalar+vector, decision diagnostics, claim
  boundary, evidence status, provenance.
- **Display-only (leo-beam-sim):** camera path, inter-sample interpolation for
  motion, label density/anchors, materials/colors/role styling, beam-cone *visual
  mesh* derived from half-angle+position, culling/LOD, panel layout, which subset
  of UEs is visually highlighted.

Litmus test: if a value appears in the contract's `timeline`/`metrics`/
`diagnostics`/`truthOwnership`, it is producer truth and is read-only. If it only
changes *how it looks*, it is display-only.

### Q4 — UE / satellite / beam counts and handover condition: which layer owns each?

| Quantity | artifact-replay | live-sim | frontend display |
|---|---|---|---|
| **UE count** | **fixed artifact content** (the artifact's UE set, e.g. 100) | runtime parameter (currently fixed at 1) | may *filter which UEs are shown*; must not change the underlying set |
| **Satellite count** | **fixed artifact content** (`entities.satellites`, 4) | runtime parameter (constellation/profile) | display cull/LOD only (e.g. 12-sat cap) |
| **Beam count** | **fixed artifact content** (7/sat = 28) | runtime parameter (`profile.perSatellite`) | cone-render cap only (e.g. 3-sat cap) |
| **Handover condition** | **producer truth** (`handoverState.kind`, `sourceHandoverOccurred`) — read-only | computed by live `HandoverManager` | **never** a frontend condition; frontend only *renders* the given state |

Principle: **counts/states that are truth** belong to the data source (fixed in
the artifact; runtime parameter in live-sim). The frontend owns only **display
filters and LOD caps** layered on top — never the underlying truth count, and
**never** the handover condition.

**Tunable-control axis (orthogonal to truth-ownership above).** The user must
be able to adjust scene / scenario rendering parameters (UE count to render,
satellite display caps, beam color, beam line width, LOD thresholds, camera
presets, label density, etc.) **from both views** with only the **defaults**
differing per mode — never hardcoded into one view. The truth-ownership table
above is about *who decides the underlying value*; the 3-category split in §13
**Shared tuning surface contract** is about *which view exposes a tuning
control for it*. Cat A = shared tunable; Cat B = same control surface but
disabled in replay because the value is producer truth there; Cat C =
MODQN-only because the control is an algorithm-specific extension with no
live-SINR analog.

### Q5 — Can intra/inter handover visuals + classification be shared? How to avoid the frontend reinventing research truth?

- **Share the visual components** (`IntraHandoverArrow` Bézier arc, beam role
  color tokens, `HandoverLinks`, toast) — they are display.
- **Do NOT share/duplicate the classification logic across sources.** Today
  classification is *computed* by `runtimeFrameStep.ts:530-596` +
  `useBeamViz.ts:415-445` (`eventRoles`, beam role tokens) for the live path.
  For the artifact path, **intra vs inter is producer truth**
  (`handoverState.kind`, source-owned).
- **Mechanism that prevents reinvention — `useBeamViz` is SPLIT (C1 refactor,
  binding).** Today `useBeamViz` mixes two responsibilities — (a) **derive**
  role / event / handover-progress tokens from `SimFrame` by ID comparison
  (`useBeamViz.ts:415-444`) + reading `profile.handover.triggerTimeSec`
  (`useBeamViz.ts:679`) + live event-latch fields, and (b) **compute display
  props** (positions, colors, label anchors, cone mesh sizing) for the
  renderer. Responsibility (a) is **live-engine derivation** and must move OUT
  of `useBeamViz`, INTO the two adapters:
  - `liveSimToScene` keeps the current ID-comparison + wallclock-latch logic
    and writes pre-derived `eventRoles` / `transitionProgress` /
    `handoverState.kind` into `NormalizedSceneFrame`.
  - `showcaseArtifactToScene` reads producer truth (`handoverState.kind`,
    `phase`, `sourceHandoverOccurred`) and writes the same fields into
    `NormalizedSceneFrame`.
  - `useBeamViz` is narrowed to responsibility (b) only and consumes
    `NormalizedSceneFrame.eventRoles` / `transitionProgress` directly. The
    renderer never re-derives intra/inter from ID comparison on any path.
- **`handoverState.kind` is `?: string` in the frozen contract.** When `kind`
  is absent in a replay frame, the adapter MUST raise a load error and **block
  replay** — it must NOT fall back to ID-comparison classification.
- **Consistency assertion is one-way:** the adapter MAY check that `kind`
  matches `servingSatelliteId` vs `targetSatelliteId` and surface a validation
  warning, but the producer's `kind` always wins; the renderer never reads the
  comparison.
- Net: shared = the role→render mapping in `useBeamViz` (b); **not** shared =
  the role *derivation*, which lives per-source in the two adapters.

### Q6 — `sinrDb` is actually paper SNR. How to cleanly separate it from the live SINR mode in UI/legend/provenance?

This is the highest-risk correctness item. Mandatory rules:

1. **Carry the metric kind through the data layer.** The adapter must propagate
   `truthOwnership.sinr.channelMetricKind` (`"snr-no-interference"`) into the
   normalized scene frame as an explicit field (e.g. `channelMetricKind`). Never
   drop it.
2. **Source-driven legend label** — never hardcode "SINR":
   - live-sim → `"SINR (dB) — interference-aware (live)"`
   - artifact-replay → `"SNR (dB) — paper, no interference (replay proxy)"`
3. **Distinct color scale + badge.** Do not feed artifact SNR through the live
   SINR color ramp as if equivalent; tag the scale with the metric kind and show
   a persistent "no-interference / paper SNR" badge in replay.
4. **Provenance panel** shows `truthOwnership.sinr.note` +
   `channelMetricFormula` + source commits + `evidenceStatus`/`claimBoundary`.
5. **Hard rule:** the string "SINR" must not appear on any artifact-sourced value.
6. **Audit list (binding for P1 exit).** Every SINR-rendering surface today is
   hardcoded "SINR" or carries a SINR-named type. P1 must source-tag every
   one of them with `channelMetricKind`:
   - `src/ui/LiveKpiStrip.tsx:104` — `<KpiRow label="SINR" …/>` hard string
   - `src/viz/SatelliteBeams.tsx:256` — `formatBeamSinr(beam.sinrDb)` cone callout
   - `src/viz/BeamCalloutContent.tsx` — beam-callout SINR formatting
   - `src/scene/types.ts:269-273` — `SinrLabel` type and `VizFrame.sinrLabels`
   - `src/ui/info-panel/formatters.ts` — `formatSinr` / `sinrColor` helpers
   - `src/ui/InfoPanel.tsx` — info-panel SINR rendering
   - `src/ui/DuelSignalColumn.tsx`, `src/ui/DuelCard.tsx` — duel column SINR
   - `src/ui/FormulaTermsReadout.tsx` — formula-terms `source.sinrDb` rendering
   - contract field names: `series.sinrDb`, `ues[].sinrDb`, `links[].sinrDb`
     (cannot rename in the wire schema; consumer must thread `channelMetricKind`)
7. **Renderer-side typed wrapper + propagation scope.** Introduce a
   `ChannelMetricValue = { kind: VisualShowcaseChannelMetricKind, dB: number }`
   in `NormalizedSceneFrame`; the renderer reads `.kind` to choose label and
   never sees a bare `sinrDb` field downstream of the adapter. **Propagation
   scope (binding):** every chart / export / screenshot / demo-packaging
   surface that consumes a SINR/SNR numeric MUST carry the metric kind
   alongside the value — never as a bare `number`. This includes (i) series
   chart components reading `series.sinrDb` (wrap the wire array into
   `{ kind, values }` at the adapter), (ii) screenshot / PNG export overlays,
   (iii) CSV / JSON export of channel values, (iv) any future demo-packaging
   bundle. If a downstream surface accepts a bare `number`, the adapter must
   reject the data path or the surface must be refactored.
8. **Per-surface unit / visual test (binding for P1 exit).** Each surface in
   the audit list above must have one test that drives the surface from a
   replay frame (`channelMetricKind === 'snr-no-interference'`) and **fails**
   if the rendered text contains the substring `"SINR"` or omits `"SNR"` /
   the no-interference badge.

### Q7 — Does leo-beam-sim need a normalized scene model / adapter layer?

**Yes. This is the load-bearing recommendation.** Introduce a single
**`NormalizedSceneFrame`** as the renderer's only input, with two adapters:

```
live-sim:        useSimulation → SimFrame ──[liveSimToScene]──┐
                                                              ├─► NormalizedSceneFrame ─► useBeamViz/renderer
artifact-replay: artifact JSON → [showcaseArtifactToScene] ──┘   (source-agnostic)
```

- **Decision (binding, OQ-3 CLOSED):** `NormalizedSceneFrame` is a **NEW**
  type, NOT an extension of `SimFrame`. Reason: `SimFrame` is deeply read by
  `useBeamViz` via `sim.*` field access (single-UE, live-engine event latches,
  wallclock fields); extending it in place would pollute the live hot path
  with replay-only / N-UE fields. `liveSimToScene(SimFrame): NormalizedSceneFrame`
  is a thin pure projection (no logic, no truth derivation).
- `showcaseArtifactToScene` is **new**: it maps a `visual-showcase-v1` timeline
  frame (+ entities + diagnostics) to `NormalizedSceneFrame`, performing
  **only** coordinate-frame conversion (via `coordToWorld`, see below) +
  pre-derived role/event/progress tokens from producer truth (per C1) — never
  recomputing SINR / handover / geometry. It carries `channelMetricKind`,
  per-field provenance, and claim boundary.
- **C4 — `SceneGeometry` decoupling (binding, recorded as D9).** Today
  `useBeamViz` reads `Profile.shell.altitudeKm`,
  `profile.antenna.beamwidth3dBRad`, `profile.frequencyReuse.*`,
  `profile.handover.triggerTimeSec` directly. The artifact has none of these
  as a `Profile`. Refactor `useBeamViz` to take a separate `SceneGeometry`
  interface (`{ shellAltitudeKm, beamwidth3dBRad, frequencyReuseGroups,
  handoverTriggerTimeSec? }`). Live: `liveSimToScene` derives `SceneGeometry`
  from `Profile`. Replay: `showcaseArtifactToScene` derives `SceneGeometry`
  from `artifact.entities.shell` (NEW required block in the producer-side
  schema, see OQ-9) + `entities.beams[].halfAngleDeg`. Rejected sub-alts: (a)
  synthesize a stub `Profile` from artifact = adapter inventing producer
  constants (R1 risk); (c) producer adds a full Profile-shape to artifact =
  larger cross-repo schema change. **(b) is the smallest decoupling.**
- **C5 — `coordToWorld` adapter purity (recorded as D10).**
  `coordToWorld(positionEcefKm, coordinateFrameKind)` is a pure helper inside
  `showcaseArtifactToScene`. For
  `coordinateFrameKind === 'eci-km-no-earth-rotation-proxy'`, the function
  treats `positionEcefKm` AS-IS with **NO** Earth-rotation compensation —
  the artifact is the proxy by design; adding rotation would invent geometry
  (R1 violation). For `'ecef-km'`, standard ECEF→world. Any other kind blocks
  load.
- The adapter layer is the **single seam** where the truth boundary is enforced
  and the only place allowed to touch the raw artifact. The renderer becomes
  unable to reinvent truth because it never sees the wire format.

`NormalizedSceneFrame` fields (binding shape — full enumeration; any
unenumerated live-engine `sim.*` field that `useBeamViz` consumes today
MUST land here or move into the adapter that produces it):

- `satellites[]`: id, worldPos, coordFrameKind, displayRole, visible, provenance.
- `ues[]` (live N = 1 fixed per R6; replay N ≤ 100): id, geo, worldPos,
  servingSatelliteId, servingBeamId, targetSatelliteId?, targetBeamId?,
  channelMetric: `ChannelMetricValue`, candidatesByBeamId?:
  `Record<string, ChannelMetricValue>`, decisionRef?.
- `beams[]`: id, satelliteId, worldCenter, halfAngleDeg, role token,
  gainDb?, frequencyReuseGroup, provenance subset.
- `links[]`: id, sourceId, targetId, beamId, role,
  channelMetric: `ChannelMetricValue`.
- `eventRoles`: pre-derived per-sat / per-beam role tokens (`serving`,
  `prepared`, `post-ho`, `secondary`, `approach`, `inactive`).
- `transitionProgress`: `{ intra?: { fromBeamId, toBeamId, progress01,
  expiresAtSec }, inter?: { fromSatId, fromBeamId, toSatId, toBeamId,
  progress01, expiresAtSec } }`. Live: `liveSimToScene` derives from
  HandoverManager wallclock latches (`intraHandoverWallClockStartMs/ExpiresMs`,
  `handoverTriggerProgressSec`, `interTransitionProgress`). Replay:
  `showcaseArtifactToScene` reads producer truth and synthesises `progress01`
  from `phase`.
- `beamHopping`: `Map<satId, { activeBeamIds: string[], hopSlot?: number }>`
  — captures the live `beamHopStatesBySatId.activeBeamIds` semantic. Replay:
  derived from `timeline[].beams[].role === 'serving'`.
- `pendingTarget`: `{ satId, beamId, channelMetric?: ChannelMetricValue }?` —
  replaces live `sim.pendingTargetSatId / pendingTargetBeamId /
  pendingTargetSinrDb`. Replay: derived from
  `handoverState.targetSatelliteId / targetBeamId` when `kind !== 'none'`.
- `recentHo`: `{ sourceSatId, sourceBeamId, targetSatId, targetBeamId,
  sourceChannelMetric?: ChannelMetricValue, ageSec }?` — replaces live
  `sim.recentHoSourceSatId / recentHoSourceBeamId / recentHoSourceSinrDb /
  recentHoTargetSatId`.
- `handover`: `{ kind, phase, phaseSource, sourceHandoverOccurred }`.
- `metrics`: `{ channelMetricKind, primary: ChannelMetricValue, serving:
  ChannelMetricValue, candidates?, servingSatelliteId, servingBeamId,
  throughputMbps?, rewardScalar?, rewardVector? }`.
- `perUeDecisions[]` (replay; live empty): id, ueId, actionIndex, actionLabel,
  selectedActionScore, runnerUpActionScore, scoreMargin, mask, sources.
- `geometry: SceneGeometry`.
- `channelMetricKind` (top-level redundant carrier for the legend driver).
- `provenance`, `claimBoundary`, `evidenceStatus`.

**`computeApproachPreviews` (whole-Profile consumer) decoupling (binding).**
`useBeamViz.ts:342` passes the whole `Profile` to `computeApproachPreviews`.
On the replay path there is no `Profile`. Two acceptable resolutions, no
other: **(i) refactor** `computeApproachPreviews` to take a
`SceneGeometry + NormalizedSceneFrame` pair (preferred — keeps single-renderer
goal); **(ii) exclude** approach-preview rendering from the artifact-replay
path entirely and gate it on `sceneSource === 'live-sim'` (trades a visual
feature for less refactor). Decision deferred to P1 design, but the replay
adapter MUST NOT pass a synthesized `Profile` to it (R1).

**Replay adapter MUST reject live-derived `SceneGeometry`.** A runtime
assertion in `showcaseArtifactToScene` verifies the `SceneGeometry` instance
was produced by the artifact builder (e.g. via a private brand symbol or a
builder-tagged factory), not by `liveSimToScene`. This prevents P1 from
accidentally filling `geometry` with the live `Profile` on the replay path.

### Q8 — What is the first deliverable slice?

**Slice 1 = artifact loader + `showcaseArtifactToScene` adapter + static
single-frame render (with correct SNR legend/provenance), behind a feature
flag.** Not full 100-UE, not playback, not overlays.

Rationale: Slice 1 exercises the entire risky seam — producer → adapter →
source-agnostic renderer — at minimum surface, and proves the truth boundary
(R1/R2) + the SNR/SINR separation (Q6) before investing in scale and playback.
The metric-kind-correct legend is included in Slice 1 because even a static frame
shows a channel legend; shipping it mislabeled would itself be a truth violation.

Full ordering in §9.

---

## 4. Recommended architecture

```
                         ┌─────────────────────────────────────────────┐
                         │ sceneSource: 'live-sim' | 'artifact-replay'  │  ← new top-level axis
                         └───────────────┬──────────────────────────────┘
            live-sim │                                    │ artifact-replay
                     ▼                                    ▼
   useSimulation → stepRuntimeFrame           loadShowcaseArtifact(json)
   (core/channel, HandoverManager,            → validate (schemaVersion, profile,
    single UE)  → SimFrame                       claimBoundary present)
                     │                            → ShowcaseReplayController
            liveSimToScene (thin)                   (timeline cursor, NO recompute)
                     │                                    │
                     │                            showcaseArtifactToScene
                     │                            (coord convert only; carries
                     │                             channelMetricKind, provenance)
                     ▼                                    ▼
        ┌──────────────────────  NormalizedSceneFrame  ─────────────────────┐
        │  satellites[] (pos + frame)   ues[] (N)   beams[]   links[]        │
        │  handover{kind,phase,source}  metrics{channelMetricKind,...}       │
        │  decisions{perUE}  provenance  claimBoundary  evidenceStatus       │
        └───────────────────────────────┬───────────────────────────────────┘
                                         ▼
                       useBeamViz → VizFrame (source-agnostic)
                                         ▼
      shared renderer: SatelliteMarker, SatelliteBeams, HandoverLinks,
      IntraHandoverArrow, Earth, camera   +   NEW multi-UE instanced UE/link layer
                                         ▼
      source-driven UI: SNR/SINR legend (metricKind), provenance panel,
      claim-boundary banner, decision inspector
```

Key decisions:

- **D1.** New `sceneSource` axis; artifact-replay bypasses the live engine.
- **D2.** `NormalizedSceneFrame` is a **NEW** type, **not** an extension of
  `SimFrame` (OQ-3 CLOSED). It is the renderer's only input; the renderer is
  source-agnostic.
- **D3.** `showcaseArtifactToScene` is the only code allowed to read the raw
  artifact and is the single enforcement seam for R1/R2.
- **D4.** SNR/SINR separation is data-driven from `channelMetricKind`. The
  renderer reads `ChannelMetricValue.kind` (typed wrapper) — never a bare
  `sinrDb` — and applies the §3 Q6 audit-list source-tagging at every surface.
- **D5.** Handover intra/inter classification is **read** from the artifact on
  the replay path. `useBeamViz` is **split (C1)**: role / event / progress
  derivation moves to the two adapters; `useBeamViz` becomes display-only.
- **D6.** N-UE rendering is additive; the single-UE live path is unchanged.
  P2 must include a regression test that runs the live-sim path with profile
  `modqn-1sat-7beam` (or equivalent) under a **deterministic state-snapshot
  protocol**: (1) fixed-step `useFrame` driver (no real wallclock), (2)
  seeded RNG, (3) serialise `SimFrame` + derived `NormalizedSceneFrame`
  after N fixed steps to a stable JSON, (4) diff vs pre-refactor baseline
  snapshot with numeric tolerance `1e-6` on floats. **Pixel comparison is
  NOT used** (WebGL + GPU/driver nondeterminism makes pixel-stable
  comparison infeasible across CI / dev / GPU vendors). The snapshot covers
  all live-engine event-latch fields + role tokens + per-sat/per-beam
  binding-shape fields (§3 Q7) to catch C1-split regressions.
- **D7.** `ntn-sim-core` artifact validation is a required pre-render gate (R3).
- **D8.** **Forbidden-claim enforcement seam (R5).** The renderer reads
  `provenance.claimBoundary.allowedClaims` and refuses to render any
  claim/banner string outside the allow-list. A unit test must drive a
  synthetic artifact that **(i) passes `ntn-sim-core` validation** (i.e.
  schema-valid, `claimBoundary` shape correct, required forbidden families
  present per `forbiddenClaims`) **and (ii) carries a banner / `storyKind`
  string outside `allowedClaims`** — then assert the leo-beam-sim renderer
  rejects load (or hides the banner). The test design must be verified
  against the current `ntn-sim-core` validator behaviour before P1; if the
  validator itself rejects upstream on banner-content mismatch, switch the
  test mode from "renderer rejects load" to "renderer rejects banner render
  but allows the rest of the frame", and document the chosen mode in the P1
  commit.
- **D9.** **`SceneGeometry` decoupling (C4).** `useBeamViz` is refactored to
  consume a `SceneGeometry` interface, not `Profile` directly. Both adapters
  fill it. Without this, the artifact-replay path cannot supply shell altitude
  / beamwidth / FRF and would fall back to live `Profile` (R1 risk).
- **D10.** **Coord adapter purity (C5).** `coordToWorld` is a pure helper in
  `showcaseArtifactToScene`; for `eci-km-no-earth-rotation-proxy` it does NOT
  apply Earth-rotation compensation (artifact is the proxy by design — R1).

---

## 5. Rejected alternatives

- **Alt A — Reuse the existing `modqn-replay` handover-mode for visual-showcase-v1.**
  Rejected: that path keeps the live SINR/geometry engine in the loop
  (`buildLinkContext`/`computeLinkBudget`) and only overlays the decision →
  recomputes producer truth (violates R1). Also single-UE.
- **Alt B — Frontend recomputes SINR/handover from artifact geometry via vendored
  `core/channel` to "fill gaps".** Rejected: the artifact's channel metric is
  paper **SNR (no interference)**; recomputing would synthesize a *different*
  metric (interference-aware SINR) and destroy provenance (violates R1/R2).
- **Alt C — Renderer reads the raw `visual-showcase-v1` JSON directly (no
  adapter).** Rejected: couples the renderer to the wire format and invites
  truth-reinvention (e.g. reclassifying handover by comparing IDs, re-deriving
  roles). No single seam to enforce the boundary.
- **Alt D — Overload `SimFrame` in place to be live + replay + multi-UE.**
  Rejected as the primary plan: risks the live-sim hot path and is a larger
  refactor. A milder variant (extend `SimFrame` minimally and adapt) is recorded
  as OQ-3 for the reviewer to weigh against a separate `NormalizedSceneFrame`.
- **Alt E — Make leo-beam-sim run a 100-UE *live* sim to match the artifact.**
  Rejected: turns leo-beam-sim into a second MODQN/NTN truth source (forbidden by
  repo-roles + R4); 100-UE live truth is not validated; the artifact is the
  promoted truth surface.
- **Alt F — Build the showcase as a separate standalone app.** Rejected: defeats
  the purpose of sharing the renderer. (A separate *route/view inside the same
  app* that reuses the shared scene is acceptable and is effectively what the
  `sceneSource` axis provides.)

---

## 6. Data ownership table

| Truth family (`truthOwnership.*`) | live-sim source | artifact-replay source (producer) | leo-beam-sim role |
|---|---|---|---|
| **sinr** (value + `channelMetricKind`) | live `core/channel` `computeLinkBudget` | `modqn-paper-reproduction` — **paper SNR, no interference** | display only; label by metric kind; no recompute |
| **geometry** (sat/UE position, coord frame) | live orbit interpolation → world coords | `modqn-paper-reproduction` (`positionEcefKm` + `coordinateFrameKind` + `positionProvenance`) | coord→world conversion for render; interpolate for motion only |
| **handover** (`kind`, `phase`, `sourceHandoverOccurred`) | live `HandoverManager` | `modqn-paper-reproduction` | render given state; never reclassify replay |
| **modqnAction** (index, mask, scores) | re-scalarized from old bundle (live mode) | `modqn-paper-reproduction` (`-1e9` sentinel + `decisionActionValidityMask`) | display; honor mask; no inference |
| **reward** (scalar + vector) | n/a (live has none) | `modqn-paper-reproduction` | display only |
| **beam** (footprint, half-angle, gain, FRF group) | `core/beam` layout | `modqn-paper-reproduction` / disclosed gap (`displayOnly`) | cone *mesh* is display; numeric truth read-only |
| **provenance / claimBoundary / evidenceStatus** (top-level) | repo build info | `modqn-paper-reproduction` artifact | surface in UI; renderer enforces allow-list (R5 / D8) |
| **`positionProvenance`** (per satellite sample) | n/a | `modqn-paper-reproduction` | display per-sample in provenance panel; never overridden |
| **`frequencyReuseProvenance`** (per beam entity) | n/a | `modqn-paper-reproduction` (`displayOnly` allowed) | display in provenance panel; FRF group respected for color, never inferred |
| **`gainProvenance`** (per beam sample) | `core/beam` derived | `modqn-paper-reproduction` (`displayOnly` allowed when `gainDb` null) | display when present; do not synthesize when absent |
| **`handoverProvenance`** (per handover state) | n/a | `modqn-paper-reproduction` | display in provenance panel; `phaseSource: 'visual-policy'` allowed under NS-2 disclosure |
| **series** (chart duplicates) | derived from `SimFrame` | artifact `series` (secondary to timeline) | display only |
| **display** (camera, labels, styles) | leo-beam-sim | leo-beam-sim | **owned by leo-beam-sim** |

---

## 7. Frontend shared / reused vs new modules

**Reused unchanged (consume `NormalizedSceneFrame`):**
- `src/scene/MainScene.tsx` Canvas + scene graph
- `src/viz/SatelliteMarker.tsx`, `src/viz/SatelliteBeams.tsx`,
  `src/viz/OrbitTrail.tsx`, `src/viz/AmbientFootprintRings.tsx`
- Earth/`EarthFixedCells.tsx`, `src/useCameraControls.ts`
- `src/viz/IntraHandoverArrow.tsx`, `src/viz/HandoverToastOverlay.tsx`

**Refactored (must change before P1):**
- `src/scene/useBeamViz.ts` — **split (C1)**: role / event /
  handover-progress derivation moves OUT into the two adapters;
  `useBeamViz` becomes display-only and consumes
  `NormalizedSceneFrame.eventRoles` / `transitionProgress` / `handoverState`
  + the full per-sat / per-beam fields enumerated in §3 Q7 binding shape
  (`beamHopping`, `pendingTarget`, `recentHo`, …). Takes a new
  `SceneGeometry` parameter (D9), no longer reads `Profile` directly.
  Module-level `const`s `MAX_DISPLAY_SATS=12 / MAX_EVENT_SATS=8 /
  MAX_BEAM_SATS=3` (`useBeamViz.ts:37-39`) must be **hoisted** to a
  runtime-mutable config (passed through `NormalizedSceneFrame` or a
  settings-panel prop) so §13 Cat A "display caps" are actually tunable.
- `src/ui/LiveKpiStrip.tsx`, `src/viz/SatelliteBeams.tsx`,
  `src/viz/BeamCalloutContent.tsx`, `src/ui/info-panel/formatters.ts`,
  `src/ui/InfoPanel.tsx`, `src/ui/DuelSignalColumn.tsx`,
  `src/ui/DuelCard.tsx`, `src/ui/FormulaTermsReadout.tsx` — branch
  SINR/SNR label on `ChannelMetricValue.kind` (§3 Q6 audit list).
- `src/viz/HandoverToastOverlay.tsx`, `src/scene/useSimStatePublisher.ts`,
  `src/scene/beamApproachPreview.ts`, `src/ui/usePanelModeInference.ts`,
  `src/scene/MainScene.tsx`, `src/ui/DiagnosticsDrawer.tsx` — currently
  consume `sim: SimFrame` and/or `profile: Profile`; refactor to consume
  `NormalizedSceneFrame` (+ `SceneGeometry` where needed). Each component's
  refactor must include a unit test that exercises the replay path.
- **OQ-7 rename scope (binding for P1 housekeeping, not deferred):**
  `grep -rn "'modqn-replay'\|\"modqn-replay\"\|MODQN replay" src/` lists all
  sites; rename every occurrence to `'decision-overlay-on-live-sinr'` (or
  the analogous user-facing label) — including `src/ui/ControlBar.tsx:48`
  and any tests / fixtures.

**Generalized (additive, must not regress single-UE live path):**
- UE/ground + per-UE link layer (`GroundScene.tsx`, link rendering) → instanced N-UE.
- `src/viz/HandoverLinks.tsx` — currently uses a hardcoded
  `UE_ANCHOR = [0, 6, 0]` drawing all links from a single origin; generalize
  to per-UE anchors before P2 / P4 (originally miscategorised as
  "reuse as-is" in v1).

**New modules:**
- `src/showcase/loadShowcaseArtifact.ts` — fetch + schema / profile / claim
  guard; blocks load when `scenario.profile` unsupported, when
  `handoverState.kind` absent on any frame, or when
  `provenance.claimBoundary` missing.
- `src/showcase/showcaseArtifactToScene.ts` — adapter (the enforcement seam);
  contains `coordToWorld`, role / event / progress derivation from artifact
  truth, and `SceneGeometry` synthesis from `artifact.entities.shell` +
  `entities.beams[]`.
- `src/showcase/ShowcaseReplayController.ts` — timeline cursor / playback state.
- `src/scene/NormalizedSceneFrame.ts` — shared scene-model type +
  `ChannelMetricValue` + `liveSimToScene` thin projection.
- `src/scene/SceneGeometry.ts` — interface + builders (live from `Profile`,
  replay from artifact).
- UI: source-driven legend, provenance / claim panel,
  `<ReplayInspectorPanel>` (Cat C controls per §13).

**Untouched (live-sim only):** `runtimeFrameStep.ts`, `core/channel`,
`core/beam`, `HandoverManager`, the old `src/modqn/replay-bundle/*`
decision-overlay path (but its UI menu label `'modqn-replay'` is renamed in
`ControlBar.tsx` to `'decision-overlay-on-live-sinr'` — see §10 OQ-7).

---

## 8. Mode / profile boundary

- **`sceneSource`** (NEW, top-level): `'live-sim' | 'artifact-replay'`. Selects
  truth ownership and which pipeline runs.
- **`profile`** (existing, live-engine knob — Cat B per §13): constellation +
  signal config (`hobs-2024-*`, `modqn-1sat-7beam`). Control surface remains
  present in both views; **disabled with "from artifact" hint in replay**
  because the constellation comes from `artifact.entities.satellites`.
- **`handoverMode`** (existing, live-engine knob — Cat B): `sinr-offset` /
  `modqn-replay` (decision overlay on live SINR) / `omega-heuristic`. Same UI
  location in both views; **disabled in replay** (handover from artifact). The
  existing menu label "MODQN replay" must be renamed (e.g.
  `decision-overlay-on-live-sinr`) so the new `sceneSource='artifact-replay'`
  is not confused with it (see §10 OQ-7).
- **Tunable-control exclusivity (refined by §13 Shared tuning surface contract):**
  - **Cat A — shared tunable, different defaults:** scene / scenario rendering
    parameters (UE count to render, satellite display caps, beam color/width,
    LOD thresholds, camera presets, label density, animation easing, time
    speed). **Both views expose the same control surface** with mode-appropriate
    defaults; never hardcoded into one view.
  - **Cat B — same control surface, replay-disabled:** live-engine knobs whose
    values become producer truth in replay (`profile`, `handoverMode`,
    signal-tuning, handover-policy-tuning, SINR offset thresholds, hysteresis).
    Control present in both views; replay greys it with a "from artifact" hint.
  - **Cat C — replay-only (MODQN-only):** algorithm-extension knobs that have
    no live-SINR analog (e.g. ω scalarization weights, MODQN action-validity
    mask display toggle, top-K action breakdown, reward-vector component view,
    decision-margin inspector). Not added to the live view.
- Do **not** add artifact-replay as a 4th `handoverMode` (Rejected Alt A).

---

## 9. Implementation phases

> **Compute routing (per `/home/u24/papers/AGENTS.md` §9 and global rules):**
> every phase below is **non-heavy** frontend / browser work (Vite + react-three-fiber).
> None require training, sweeps, pilots, or the Ubuntu GPU server. All stay in
> the local environment. No phase modifies `modqn-paper-reproduction` training,
> eval, or artifacts.

| Phase | Deliverable | Exit criteria |
|---|---|---|
| **P1 — Loader + adapter + static frame (first slice)** | `loadShowcaseArtifact`, `showcaseArtifactToScene` (incl. `coordToWorld` + role / event derivation + binding-shape full fill per §3 Q7), `NormalizedSceneFrame`, `SceneGeometry`, `useBeamViz` C1-split, all §7 Refactored components rewired, OQ-7 rename done, render **one** timeline frame through existing components at reduced scale; **SNR-correct legend + provenance / claim panel + claim-boundary banner**; feature-flagged | (a) artifact loads behind `ntn-sim-core` validation (R3) and rejects load when `handoverState.kind` absent or `claimBoundary` missing; (b) **negative-path enforcement (two-pronged, both required):** (b1) an ESLint `no-restricted-imports` rule forbids `src/showcase/**` and any code reachable only under `sceneSource === 'artifact-replay'` from importing `core/channel`, `core/beam`, `HandoverManager`, `computeLinkBudget`, `buildLinkContext`, `runtimeFrameStep`; (b2) a module-mock test (jest / vitest `vi.spyOn` import-side-effect probe) asserts that under `sceneSource === 'artifact-replay'` none of those modules are evaluated at runtime — individually either is insufficient; (c) §3 Q6 audit list — **every** SINR-rendering surface (`LiveKpiStrip.tsx:104`, `SatelliteBeams.tsx:256`, `BeamCalloutContent.tsx`, `VizFrame.sinrLabels`, `formatters.ts`, `InfoPanel.tsx`, `DuelSignalColumn.tsx`, `DuelCard.tsx`, `FormulaTermsReadout.tsx`) renders `"SNR"` + no-interference badge on a replay frame; (d) D8 enforcement test per validator-precondition design; (e) D6 regression: live-sim path under **deterministic state-snapshot protocol** per D6 (fixed-step driver + seeded RNG + JSON-state diff with 1e-6 float tolerance — **NOT pixel comparison**) |
| **P2 — Multi-UE rendering at scale** | instanced N-UE ground + per-UE link layer; display-filter for shown UEs | renders the artifact's full UE set (OQ-1) at acceptable FPS; single-UE live path unregressed |
| **P3 — Timeline playback** | `ShowcaseReplayController` cursor, play/pause/seek over `timesSec`; **inter-frame position interpolation occurs in world space, after `coordToWorld`** — NEVER in raw `positionEcefKm` (ECI-proxy) coordinate space, because re-applying the proxy assumption to synthesized intermediate positions invents geometry (R1) | scrubbing matches `timebase`; no truth recompute between samples; interpolation-space test: assert intermediate frame positions are linear in world space between consecutive samples |
| **P4 — Handover overlay from artifact truth** | map `handoverState.kind` → existing intra/inter overlays; consistency assertion (Q5) | intra/inter visuals driven solely by artifact `kind`; assertion fires on mismatch, never overrides |
| **P5 — Decision / diagnostics inspector** | per-UE decision panel from `decisionFrames` (mask, scores, margin, reward vector); primary-UE via `diagnosticsRef`; reconciles `decisionActionValidityMask` from BOTH `timeline[].modqnDecision` AND `diagnostics.decisionFrames[]` and raises a validation warning on mismatch | inspector reads producer diagnostics only; honors `-1e9` mask sentinel; mask-reconciliation test: synthetic artifact with mismatched masks across the two locations fails inspector load |

Each phase: one concern, browser smoke / screenshot evidence, no batched scope.
P1 is the gate — P2–P5 do not start until the truth boundary in P1 is reviewer-accepted.

---

## 10. Open questions requiring review before coding

- **OQ-1 (CLOSED 2026-05-22):** confirmed by codex direct parse of the 31 MB
  JSON — **100 UEs, 61 frames, 4 satellites, 28 beams**, handover dist =
  1 intra + 60 none. See §2.4.
- **OQ-2 (CLOSED, decision recorded as D10):** for
  `coordinateFrameKind === 'eci-km-no-earth-rotation-proxy'`, the adapter uses
  `positionEcefKm` AS-IS with no Earth-rotation compensation. For `'ecef-km'`,
  standard ECEF→world. Any other kind blocks load. Implemented in
  `coordToWorld` inside `showcaseArtifactToScene`.
- **OQ-3 (CLOSED, decision recorded as D2):** `NormalizedSceneFrame` is a
  **NEW** type, not an extension of `SimFrame`. See §3 Q7.
- **OQ-4:** N-UE rendering technique + perf target (instancing, link batching) at
  the OQ-1 scale. Acceptable FPS / draw-call budget?
- **OQ-5:** handover-overlay display policy at N UEs — show all handovers, or only
  the focused/primary UE? (Display-filter product decision; does not affect truth.)
- **OQ-6:** which UE is "primary" for the existing single-UE side panels.
  Proposal: the UE referenced by `modqnDecision.diagnosticsRef`. Confirm.
- **OQ-7 (CLOSED, decision):** the two replay formats coexist with
  non-overlapping purposes — the old `src/modqn/replay-bundle/*` is a
  decision-overlay-on-live-sim path; the new `visual-showcase-v1` is
  source-truth replay. **All `'modqn-replay'` string occurrences in `src/`
  (per `grep -rn`) are renamed to `'decision-overlay-on-live-sinr'` in P1
  housekeeping** — not deferred, not implementation-detail. UI menu labels
  likewise renamed. No consolidation now.
- **OQ-8:** CI / runtime validation gate — should
  `validate:visual-showcase:artifact` run as a pre-render check in
  `leo-beam-sim` (e.g. dev plugin / test), not just manually? Recommended yes.
- **OQ-9 (producer-side, three paths now — was 2 in v3):** the
  artifact-replay `SceneGeometry` requires shell altitude + beamwidth +
  frequency-reuse-groups + (optional) handover trigger time. The frozen
  `visual-showcase-v1` contract carries `entities.beams[].halfAngleDeg` and
  `frequencyReuseGroup` per beam, but no shared shell record. Three paths:
  (i) **producer reopen (preferred):** request `modqn-paper-reproduction`
  to ship a v1.2 contract bump adding `entities.shell: { altitudeKm,
  antennaBeamwidth3dBRad? }` (additive, validator-backward-compatible).
  Cross-repo SDD required, **must contain an explicit "export-only, no
  training / eval / reward / SINR / handover / action / evidence semantic
  change" clause** so the modqn-paper-reproduction governance (Visual
  Showcase Handoff #5) is satisfied. Producer agreement + ntn-sim-core
  validator bump + producer PR are tracked dependencies.
  (ii) **deterministic derivation pact (acknowledged R1-adjacent fallback):**
  if (i) is rejected or delayed, leo-beam-sim maintains a frozen
  `shellGeometryDefaults` table keyed by
  `artifact.entities.satellites[].shellId` carrying ONLY shell-level physical
  constants (`altitudeKm`, `antennaBeamwidth3dBRad`). Table entries are
  pre-agreed with the producer and signed off as "physical constants the
  producer also uses internally, externalised here only because the artifact
  does not carry them" — NOT display-driven defaults. Table is frozen per
  `shellId`; no per-frame variation; no consumer-side fitting.
  (iii) **scope cut:** if neither (i) nor (ii) materialises before P1, drop
  beam-cone half-angle / FRF-group visualisation from artifact-replay and
  render UEs + satellite markers only (no cones, no FRF colouring). Documented
  scope reduction, not a silent feature gap.
  **Default: (i); fallback chain (i)→(ii)→(iii). Resolution required before
  P1 kicks off.**
- **OQ-10 (new, producer-side):** the trigger artifact has 0
  inter-satellite handover events (§2.4). P4 cannot be validated on this
  artifact. Producer request: emit a second smoke artifact with at least 1
  inter-satellite handover event for the P4 visual-test fixture. Fallback:
  a synthetic hand-crafted artifact under `fixtures/visual-showcase-v1/`
  that must still pass `ntn-sim-core validate:visual-showcase:artifact`.
  Resolution required before P4, not P1.

---

**v4 is the final SDD iteration.** Acceptance gate for v4 dual review:
- **SOUND** → P1 implementation authorised.
- **PARTIALLY-SOUND with zero new CRITICAL** → P1 implementation authorised;
  residual MAJOR / MINOR risk tracked via P1 implementation tests.
- **PARTIALLY-SOUND with any new CRITICAL** → freeze v4 SDD; do not
  implement; declare leo-beam-sim integration suspended pending separate
  decision.

The cap is not motivated reasoning: it is the recognition that no amount of
SDD-text iteration can fully describe an architecture this complex; some
residual risk must be discovered during P1 implementation under the
truth-boundary tests v4 specifies.

---

## 11. Governance / claim boundary

- This SDD authorizes **no implementation, no executor dispatch, no training,
  no artifact changes**. It is a decision document pending dual review.
- The integration **must not** promote any forbidden claim (Multi-Catfish
  effectiveness, Catfish-EE, general EE-MODQN superiority, active-TX EE recovery,
  physical energy saving, full RA-EE-MODQN). The artifact's `claimBoundary` /
  `evidenceStatus` govern what the UI may state (R5).
- The trigger artifact is a Phase 01H multi-UE **baseline MODQN handover**
  smoke; render it as such. Display needs never feed back into producer semantics
  (R2).
- `leo-beam-sim` must not become a second MODQN trainer or NTN truth source (R4 /
  repo-roles).

### Dual-review history

- **v1 (2026-05-22, initial draft):** dual-review = PARTIALLY-SOUND. 2
  CRITICAL (codex) + 3 CRITICAL (Opus) + 9 MAJOR + 1 MINOR. Findings folded
  into v2 (tuning-rule addition) and v3 (11 verbatim edits).
- **v2 (2026-05-22, +tuning rule):** internal increment for §13 contract;
  not separately reviewed.
- **v3 (2026-05-22, +11 reviewer-finding edits):** dual-review =
  PARTIALLY-SOUND. 0 CRITICAL (codex) + 3 CRITICAL (Opus, grep-validated) +
  ~13 MAJOR + 4 MINOR. 9 / 11 v2 findings RESOLVED, 2 PARTIAL. New
  CRITICALs: §13 vs §2.1 contradiction, C1 split field-enumeration
  incomplete, OQ-9 cross-repo dependency unmanaged.
- **v4 (this revision, +12 consolidated edits):** addresses 3 new
  CRITICAL + the grep-validated incomplete enumerations.
  **Final SDD iteration.** Per §10 v4 closure declaration: P1 authorised
  iff v4 dual review returns SOUND or PARTIALLY-SOUND with zero new
  CRITICAL; otherwise SDD freezes and integration suspends.

## 12. Review checklist (for the dual adversarial review)

1. Does the architecture keep **all** SINR/SNR, geometry, handover, action,
   reward truth on the producer side for the replay path (R1/R2)? Any hidden recompute?
2. Is the SNR-vs-SINR separation (Q6) sufficient to prevent mislabeling?
3. Is the `sceneSource` axis correct, or should artifact-replay be modeled
   differently? Is the live-sim path provably untouched?
4. Is `NormalizedSceneFrame` + single adapter seam the right boundary, or is OQ-3
   (extend `SimFrame`) better?
5. Are any of the rejected alternatives actually preferable?
6. Are the open questions complete, or is a load-bearing unknown missing?
7. Does the phase plan keep the truth boundary verifiable at P1 before scale/playback?

---

## 13. Shared tuning surface contract

This section specifies which UI controls / tuning knobs are exposed in which
view, and on what semantic. Goal: **single set of rendering code; tuning the
look-and-feel in one place changes both views; truth-bearing values are never
tunable from the renderer.** Three categories (plus a Cat D fixed-truth list
for completeness).

### Cat A — Shared tunable, different defaults

Both views expose the same control. Defaults differ per mode. Underlying
semantics differ where indicated (live = truth-affecting; replay = display
filter only), but the **UI surface is one component, the renderer code path is
one**.

| Control | live-sim semantic / default | artifact-replay semantic / default |
|---|---|---|
| Active UE count | **fixed at 1 (R6 invariant)** — control read-only in live view | display filter: subset of artifact's UEs to render (default = all 100); UI MUST display "showing X of N" — never bare "X UEs" — so a filtered subset is never read as the total population |
| Satellite display cap (was const, **hoisted in P1**; see §7) | LOD cap on visible constellation (default 12) | LOD cap (default 4 = match artifact entity count) |
| Beam-cone render cap (was const, **hoisted in P1**; see §7) | cone mesh budget (default 3) | cone budget (default 4) |
| Event-sat cap (was const, **hoisted in P1**; see §7) | role-event budget (default 8) | role-event budget (default 4) |
| Per-role beam color (serving / prepared / post-ho / secondary / inactive) | single token table | same token table |
| Beam cone half-angle visual scale | display exaggeration factor | same |
| Beam cone opacity / line width / segment count | shared | shared |
| Camera preset (zenith / oblique / chase) | shared | shared (default: oblique survey for multi-UE) |
| Earth-fixed cell grid density | display | display |
| Label density / font scale | display | display |
| LOD distance thresholds | display | display |
| UE marker size / colour | shared | shared |
| Link line style per role (solid / dashed / dotted) | shared | shared |
| Orbit trail length / opacity | shared | shared |
| Playback time speed factor | scales `useFrame` delta | scales `ShowcaseReplayController` cursor |
| Animation easing / interpolation rate | display | display |
| Handover overlay focus mode (all / primary-UE-only) | shared | shared |

Rule: changing any Cat A control mutates **only** display state and applies
identically to both pipelines through `NormalizedSceneFrame` / shared renderer.

### Cat B — Same control surface, replay-disabled

Live-engine knobs whose value becomes producer truth in replay. The same UI
control exists at the same UI location in both views, but in `artifact-replay`
the control is **disabled** with a "from artifact" hint and shows the artifact's
value as read-only.

| Control | live behaviour | replay behaviour |
|---|---|---|
| Profile (constellation / signal config) | tunable | disabled; shows `artifact.entities.satellites` summary |
| Handover mode selector | tunable (`sinr-offset` / renamed `decision-overlay-on-live-sinr` / `omega-heuristic`) | disabled; shows "handover from artifact" |
| Handover trigger time / hysteresis | tunable | disabled; "from artifact `handoverState`" |
| SINR offset thresholds | tunable | disabled; "no live SINR engine in replay" |
| Signal tuning (path-loss / formula overrides) | tunable | disabled; "artifact SNR fixed" |

Rule: Cat B controls never affect replay rendering. The replay pipeline does
not read Cat B state.

### Cat C — Replay-only (MODQN algorithm extension)

Knobs that exist only because the artifact is a MODQN multi-objective policy
output. They have **no analog** in live SINR and are **not** added to the live
view.

| Control | Purpose | Where wired |
|---|---|---|
| ω scalarization weights (3 weights) | MODQN multi-objective reward weighting visualization | replay-only side panel |
| MODQN action-validity mask display toggle | show / hide masked (`-1e9` sentinel) actions | replay decision inspector |
| Top-K action breakdown | per-decision top-K action scores + margin | replay decision inspector |
| Reward-vector component view | per-component reward decomposition | replay decision inspector |
| Primary-UE override | switch which UE drives the side panel (default: `modqnDecision.diagnosticsRef`) | replay-only |
| Q-value scale / normalisation | display tuning for action-score chart | replay-only |

Rule: Cat C controls do not appear in the live view's UI. They consume
producer truth only and never reach the live engine.

### Cat D — Producer truth, not tunable anywhere

Listed for completeness. The UI **must not** expose a tunable control for
these; they flow from the source through the adapter into rendering, read-only.

- `channelMetricKind` (set by source: live = `sinr-with-interference`; replay = `snr-no-interference`)
- `claimBoundary` / `evidenceStatus` (banner content, read-only)
- `handoverState.kind` and `sourceHandoverOccurred` in replay (producer truth)
- SINR / SNR numeric values
- Reward scalar + vector values
- MODQN action index / valid-action count / scores
- Satellite / UE position values (inter-sample interpolation is display-only and falls under Cat A animation easing)
- `positionProvenance` / `frequencyReuseProvenance` / `gainProvenance` / `handoverProvenance` per-field records (display in provenance panel only)

### Implementation guidance

- Cat A and Cat B controls share a **single React component tree** rooted in
  the shared settings panel. Each control's `disabled` and `defaultValue` are
  computed from the current `sceneSource`.
- Cat C controls live in a separate `<ReplayInspectorPanel>` mounted only when
  `sceneSource === 'artifact-replay'`. They do not appear elsewhere.
- The `NormalizedSceneFrame` adapter must reject any attempt to map a Cat B /
  Cat D field from a frontend tuning value on the replay path; the adapter is
  the enforcement seam.
- A change to a Cat A control should require **zero** modifications to the
  live-sim engine or to the artifact-replay adapter — only to the shared
  renderer / shared settings layer. If a Cat A change is forcing an adapter or
  engine change, the control has been miscategorised; reclassify (likely Cat B).
- Test rule: for each Cat A control, one unit/visual test must drive it from
  both pipelines and assert identical rendering behaviour at the same input.
