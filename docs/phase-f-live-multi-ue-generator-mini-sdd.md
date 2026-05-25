# Phase F Live Multi-UE Generator Mini-SDD

Status: draft for Phase F (post Phase C v1 ship to branches).
Date: 2026-05-25
Owner: `leo-beam-sim` live-engine multi-UE generator + per-UE SINR + per-UE handover state.
Target repo: `/home/u24/papers/project/leo-beam-sim`.
Cross-repo dependencies: NONE for any slice. Phase F is entirely live-engine + viz changes.

## 0. Reading Order

Read before changing this SDD or starting implementation:

1. `.agent-memory/project_paper_faithful_vision.md` — user vision Phase E
   bullet listing UE count alongside sat/beam count. Phase F UNLOCKS the
   PR-σ (E-S3) UE-count slider Phase E SDD §4.4 DEFERRED.
2. `.agent-memory/project_paper_faithful_vision.md` "Phase C v1 COMPLETE"
   — current chain state; Phase F branches off Phase C PR-φ.
3. `.agent-memory/project_dev_drift_audit_2026-05-25.md` Rule 4 — mini-SDD
   釘 priority 才開 slice; this SDD is the priority anchor for Phase F.
4. `docs/phase-e-runtime-overrides-mini-sdd.md` §4.4 — the deferred
   `PR-σ (E-S3)` UE-count slider that Phase F unblocks. `SceneTopologyState
   .ueCount: number | null` field is already declared in
   `src/sceneTopology.ts` (shipped PR-π). Phase F activates the apply
   path + UI.
5. `src/scene/useSimulation.ts` — single-UE engine entry. Hosts
   `HandoverManager` instance + `SimFrame` ref. Phase F extends this
   for multi-UE.
6. `src/scene/runtimeFrameStep.ts:509-510` — single UE ground position
   `ueGroundX` / `ueGroundZ` derived from observer. Phase F replaces
   with a UE position array.
7. `src/showcase/liveSimToScene.ts:177-185` — R6 invariant
   "live N=1 fixed"; single-element `ues` array. Phase F widens.
8. `src/viz/GroundScene.tsx` — ALREADY supports multi-UE rendering
   (primary + secondary instanced mesh). No render-side change needed
   for F-S1. PR-υ already wires ueMarkerMultiplier; works for N UEs.
9. `src/engine/handover/handover-manager.ts` — single-instance handover
   state. Phase F needs N independent instances OR a shared timing
   config with per-UE state vectors.
10. `CLAUDE.md` §5 (boundaries) — Phase F does NOT touch replay
    artifacts, MODQN training, or any vendored core module.

## 1. Purpose

User vision verbatim:

> 我希望真的可以在 leo-beam-sim 上完整重現這篇論文

The PAP-2024-MORL-MULTIBEAM paper baseline operates with **100 UEs** per
scenario. The current `leo-beam-sim` live path hardcodes **1 UE**
(`liveSimToScene.ts:177` R6 invariant). Phase E SDD §4.4 deferred the
UE-count slider (E-S3) explicitly because the live multi-UE generator
did not exist.

Phase F closes that gap by:

- Extending the live engine to maintain N independent UE state vectors
  (`N ∈ [1, 200]`).
- Computing per-UE SINR each frame against all visible satellite beams.
- Running independent per-UE handover state machines so each UE can
  select / switch its serving sat+beam autonomously.
- Generating UE positions via a deterministic seeded distribution
  inside the primary observer footprint.
- Activating the `SceneTopologyState.ueCount` field (already declared
  in PR-π) + shipping the UE-count slider in the Topology tab
  (Phase E E-S3 unlock).

Phase F does NOT change replay-side multi-UE rendering (which has
already worked for ~100 UEs via artifact-baked positions since the
visual-showcase contract landed). Phase F does NOT introduce MODQN
training in the browser; the live multi-UE simulation is for
interactive exploration, paper sensitivity sweeps, and demo, not for
training. Training stays in `modqn-paper-reproduction` Python backend.

## 2. Authority and Boundaries

### 2.1 Owned by Phase F

- New `src/engine/ue/multiUeState.ts` (or similar) holding the per-UE
  position generator, mobility step, and N-vector state.
- Extension of `SimFrame` to carry an array of per-UE serving / SINR
  / handover-progress instead of a single `sim.serving` field.
  Backward-compat: a `sim.primaryServing` alias preserves the single-UE
  display narratives.
- Extension of `runtimeFrameStep` to compute SINR + handover per UE.
  This unfreezes the file scope-locally for Phase F (the S3 freeze was
  for the ω-handover slice; Phase F predicates on careful audit).
- Extension of `HandoverManager` to accept N independent per-UE state
  blocks (OR replication of the manager N times — design decision in
  §6).
- Activation of `SceneTopologyState.ueCount` apply path in
  `applySceneTopology` (currently the ueCount field is reserved but
  has no apply behavior).
- UE-count slider UI in the Topology tab (E-S3 unlock).
- UE distribution generator: deterministic seeded random uniform
  inside the primary observer footprint, with optional
  density variants in later slices.
- Live multi-UE per-UE diagnostics surfacing (per-UE SINR readout in a
  follow-up slice, NOT in v1).

### 2.2 Not owned by Phase F

- Live MODQN policy inference per UE. The ω-handover decision
  override + replay overlay continue to apply ONLY to the primary UE
  (legacy live-mode narratives). Per-UE MODQN policy inference is
  out of scope; the Phase 6W antenna pattern provenance gate still
  applies for live policy.
- Replay artifact contract. Phase F does NOT change
  `phase-03a-replay-bundle-v1` or `visual-showcase-v1`. Replay
  envelopes continue to carry their own producer-baked UE arrays
  (already up to ~100 elements).
- UE mobility model beyond static random scatter in v1. F-S2
  introduces per-UE static positions; mobility (waypoints,
  random-walk, Manhattan model) is a Phase G future SDD.
- Multi-shell support. Phase F's UE generator scatters inside the
  primary observer footprint (single-shell intent). Multi-shell
  candidate-rich profiles still work but UEs only experience the
  primary shell's serving set.
- 100-UE simulation correctness validation against paper baseline KPIs.
  Phase F gets the live N-UE compute correct as a behavior; rigorous
  KPI replication remains the producer-side Python repo's job.

### 2.3 Hard bans (PR-level, all Phase F slices)

- Do NOT touch `src/showcase/showcaseArtifactToScene.ts`. Replay
  multi-UE rendering is producer-owned.
- Do NOT change `src/profiles/*.json` to bake a `ueCount` field.
  The selector is a runtime override only (per Phase E's pattern).
- Do NOT introduce MODQN training in the browser.
- Do NOT modify `FOOTPRINT_RADIUS_WORLD` or any visual-scale const.
  Phase F is engine + state, NOT visual-scale.
- Do NOT widen the live-UE rendering to use WebGL instancing changes;
  GroundScene already handles multi-UE via InstancedMesh since pre-F.
- Do NOT remove the primary UE distinction (label "UE", larger marker,
  non-instanced rendering) — primary UE keeps existing visual prominence
  so single-UE demo narratives still read clearly.
- Do NOT change the existing `live-ue-0` ID for the primary UE.
  Secondary UEs use `live-ue-1` through `live-ue-(N-1)`.

## 3. Current State

Relevant existing code:

- `src/scene/useSimulation.ts:97-311` — `useSimulation` hook. Single
  `HandoverManager` instance (`hoManager`). Single `SimFrame` ref
  (`frameRef`).
- `src/scene/runtimeFrameStep.ts:509-510` —
  `const ueGroundX = ueEastKm * ueWorldScale;` derives ONE UE ground
  position from observer-East/North. Phase F replaces with N-vector.
- `src/showcase/liveSimToScene.ts:153-185` — `liveUeId = 'live-ue-0'`
  hardcoded; `ues: NormalizedUe[]` is a single-element array. Comment
  "R6: live N=1 fixed" must be widened in Phase F.
- `src/showcase/deriveLiveSceneFields.ts` — derives roles / progress
  / handover for a SINGLE UE (the implied primary). Phase F either
  loops per UE or keeps this single-primary-only and adds a parallel
  per-secondary derivation.
- `src/engine/handover/handover-manager.ts` — `HandoverManager` class.
  State: `pendingTargetSatId`, `pendingTargetBeamId`,
  `triggerProgressSec`, `lastHoEvent`, etc. All single-UE. Phase F
  needs N instances OR a refactor to store N state vectors keyed by UE.
- `src/sceneTopology.ts:7` — `SceneTopologyState.ueCount: number | null`
  field ALREADY declared (PR-π forward-compat reservation).
  `applySceneTopology` does NOT touch ueCount in PR-π's impl;
  Phase F activates this.
- `src/viz/GroundScene.tsx` — already handles multi-UE (primary +
  secondary instanced mesh; PR-υ adds ueMarkerMultiplier). Replay path
  already uses this for ~100 artifact-baked UEs. Phase F's live-side
  N-UE array consumes the same renderer.
- `src/scene/NormalizedSceneFrame.ts` (read via `liveSimToScene.ts:55-63`)
  — `NormalizedUe` interface + `NormalizedUeDecision`. Already an array
  type; just needs the live path to fill more entries.

## 4. Slice Plan

Phase F is sized at 4 shippable slices + 2 optional stretch. One slice
per PR.

| Slice | Subject | Touches | Cross-repo dep? |
|---|---|---|---|
| PR-χ (F-S1) | live N-UE position generator + N-UE ground projection (display only; still single-UE SINR/handover) | new `src/engine/ue/multiUeState.ts`, `runtimeFrameStep` extends to fill UE position array, `liveSimToScene` widens `ues[]`, validator | none |
| PR-ψ (F-S2) | per-UE SINR computation each frame (no per-UE handover yet — all UEs share primary's serving) | extends `runtimeFrameStep` to compute SINR per UE against all visible beams, fills `NormalizedUe.sinrDb`-equivalent (or per-UE entry in `links[]`/`metrics`), validator | none |
| PR-ω (F-S3) | per-UE independent handover state machine + per-UE serving sat/beam selection | extends `HandoverManager` for N-vector state OR replicates N instances; per-UE servingByUeId map in SimFrame; validator | none |
| PR-α2 (F-S4) | UE-count slider activate `SceneTopologyState.ueCount` + UI in Topology tab; trajectory cache rebuild on change | `applySceneTopology` activates ueCount apply path, TopologyTab adds slider `[40, 200]`, A pp.tsx remount-key joins ueCount, validator | none |
| PR-β2 (F-S5 OPTIONAL) | UE distribution mode selector (random / grid / clustered) | extends `multiUeState.ts` with distribution modes, TopologyTab dropdown, validator | none |
| PR-γ2 (F-S6 OPTIONAL) | per-UE diagnostics surface in DiagnosticsDrawer | extends DiagnosticsDrawer with per-UE table view, validator | none |

PR-χ ships first because it establishes the N-vector state contract.
PR-ψ stacks on χ to add SINR. PR-ω stacks on ψ for handover. PR-α2
unblocks the user-facing slider once the underlying compute exists.

### 4.1 Greek letter exhaustion

The Greek lower-case alphabet (24 letters) ran out of unused slots:
- Used by prior phases: α, β, γ (Phase A), δ, ε, ζ, η, θ (Phase B),
  ι, κ, λ, μ, ν, ξ, ο (Phase D), π, ρ, σ (Phase E),
  τ, υ, φ (Phase C).
- Remaining: χ, ψ, ω (3 letters).

Phase F core needs 4 slots (F-S1..S4). After the 3 unused Greek letters
are consumed by F-S1/F-S2/F-S3, the SDD adopts numbered suffix
`α2`, `β2`, `γ2` for F-S4 / F-S5 / F-S6 (re-using α/β/γ with an
explicit `2` suffix). Future SDDs naming convention:
`<lowercase-greek>[<n>]` where `n=2,3,...` indicates a re-use cycle.

### 4.2 F-S1 UE position generator design

Deterministic seeded random scatter inside the primary observer
footprint. Default range matches paper sensitivity: `[40, 200]` UEs,
default `100`. F-S1 ships with seeded generator producing
reproducible positions:

```ts
function generateUePositions(
  ueCount: number,
  primaryFootprintRadiusKm: number,
  observerLat: number,
  observerLon: number,
  seed: number,
): UePosition[] {
  // Mulberry32 or LCG with the seed; uniform random in a disc of
  // radius `primaryFootprintRadiusKm` around observer.
}
```

Seed defaults to a fixed value (e.g. `42`) so the same UE count
produces the same scatter across reloads. A future slice can expose
a seed input if needed; F-S1 fixes the seed.

UE positions are recomputed when:
- `topology.ueCount` changes.
- `profile.orbit.observerLatDeg` / `observerLonDeg` change.
- (No recomputation on simulation tick — static positions in v1.)

### 4.3 F-S2 per-UE SINR computation

For each UE in the array, compute SINR against all visible satellite
beams using the existing single-UE SINR pipeline applied N times. The
expensive path is the link-budget computation per (sat, beam, UE)
triple; N=200 UEs × ~28 beams × ~30 sats = ~170K muls per frame.
At 30 FPS = 5M muls/sec — acceptable JS performance.

F-S2 does NOT add per-UE serving selection. All UEs share the
primary UE's serving sat/beam. The per-UE SINR values are surfaced
in `NormalizedUe.sinrDb` (or equivalent) for display only.

### 4.4 F-S3 per-UE handover state machine

Two design options for the N-vector handover state:

**Option A: N independent HandoverManager instances.**

```ts
const hoManagers: HandoverManager[] = [];
for (let i = 0; i < ueCount; i++) {
  hoManagers.push(new HandoverManager(profile.handover));
}
```

Pros: minimal HandoverManager refactor; each instance owns its
state cleanly. Cons: memory N×, no batched updates.

**Option B: Refactor HandoverManager to keep N state vectors.**

```ts
class HandoverManager {
  private states: Map<UeId, HandoverState>;
  update(ueId, candidates, dt, simTimeMs, override) { ... }
}
```

Pros: single class instance; batched updates possible. Cons: bigger
refactor; touches the existing class's API every consumer relies on.

F-S3 picks **Option A** (N instances) for v1 to minimize HandoverManager
refactor risk. The N instances share the immutable
`profile.handover` config so memory overhead is just the per-UE state
struct (≈200B × 200 UEs = 40KB — negligible).

### 4.5 F-S4 UE-count slider activation

`SceneTopologyState.ueCount` apply path activates in `applySceneTopology`:

```ts
export function applySceneTopology(profile, topology) {
  // ... existing satsPerPlane + beamCountPerSatellite path ...

  // Phase F: ueCount carried by sibling MainScene prop, NOT inside Profile
  // (Profile stays paper-truth contract). Like Phase C's
  // visualScaleMultipliers, the ueCount override rides alongside Profile.

  return profile; // unchanged for orbit/beams; ueCount overlay handled in App.tsx
}
```

UE count is NOT inside Profile (per the same architectural rule
shipped in Phase C: runtime overlays don't pollute Profile). The
override rides via a new prop on `<MainScene>`:

```ts
<MainScene
  profile={effectiveProfile}
  visualScaleMultipliers={...}
  ueCountOverride={appMode === 'sinr-experiment' ? sceneTopology.ueCount : null}
/>
```

`MainScene` resolves the effective UE count from override or profile
default (or hardcoded `100` baseline if profile has none). Reset semantics:
UE count change = trajectory cache rebuild (per Phase E
`getSceneTopologyResetKey` already joins ueCount).

UI: slider in Topology tab beneath the beam-count radio. Range
`[40, 200]` step `1`. Banner "Adjusting UE count restarts the
simulation."

## 5. UI Placement

Phase F's UE-count slider lives in the existing Phase E/C Topology tab
inside `SignalTuningPanel`. Same `Simulation Setting` classification.

The Topology tab after Phase F:

```
┌─ Topology / sim setting ──────────────────────┐
│  [Sat count section]      (Phase E PR-π)      │
│  [Beam count section]     (Phase E PR-ρ)      │
│  [Scene scale section]    (Phase C PR-τ)      │
│  [UE marker size section] (Phase C PR-υ)      │
│  ─────────────────────────────────────────────│
│  [UE count section]       (Phase F PR-α2)     │
└───────────────────────────────────────────────┘
```

Both `sinr-experiment` and `modqn-demo` modes show the selector?
No — `sinr-experiment` only. modqn-demo keeps the paper-faithful
fixed 100-UE baseline (matching the modqn-4sat-7beam-paper-faithful
profile's implied UE count). Same gating pattern as Phase E sat/beam
count overrides.

## 6. Architecture: N-Vector SimFrame Shape

Current `SimFrame` shape (truncated):

```ts
interface SimFrame {
  simTimeSec: number;
  serving: { satId, beamId, sinrDb, ... };
  pendingTarget: { satId, beamId, ... };
  satellites: Array<...>;
  // ... no per-UE array
}
```

Phase F extends:

```ts
interface SimFrame {
  simTimeSec: number;
  primaryServing: { satId, beamId, sinrDb, ... };  // alias for serving — backward compat
  serving: { satId, beamId, sinrDb, ... };          // primary UE's serving (deprecated alias)
  pendingTarget: { satId, beamId, ... };            // primary UE's pendingTarget
  perUeServing: Array<{ ueId, satId, beamId, sinrDb, pendingTargetSatId?, ... }>;
  satellites: Array<...>;
  // ... existing fields unchanged
}
```

`perUeServing[0]` is ALWAYS the primary UE. `liveSimToScene` projects
`perUeServing` into `NormalizedUe[]`. Consumers that read `sim.serving`
keep working (it now equals `perUeServing[0]` for backward compat).

Existing single-UE-state consumers (`useSimStatePublisher`,
`useBeamViz`, ω-handover override) all read `sim.serving` —
unchanged behavior.

## 7. State and Persistence

`SceneTopologyState.ueCount` (already declared in PR-π) gets persistence
in F-S4. Same localStorage key
`leo-beam-sim.scene-topology.v1` shared with Phase E sat/beam overrides.

## 8. Reset Semantics

UE count change:
- Triggers trajectory cache rebuild (because UE positions feed into
  per-UE channel observers).
- Triggers HandoverManager reset (per-UE state).
- Triggers per-UE SINR re-init.
- All three flow through the existing `getSceneTopologyResetKey` chain
  (which already includes `ueCount` per PR-π's
  `getSceneTopologyResetKey` joining `topology.satsPerPlane ??
  base | topology.beamCountPerSatellite ?? base` — Phase F extends
  to include `topology.ueCount ?? base`).

The same remount-key pattern Phase E established already handles
this; no new reset mechanism.

## 9. SINR Contract Amendment

`docs/sinr-runtime-parameter-contract.md` has subsections "Topology
Overrides (Phase E)" + "Scene Scale (Phase C)". Phase F appends:

> ### UE Count (Phase F)
>
> Phase F activates the Phase E DEFERRED `ueCount` field in
> `SceneTopologyState`. The slider sits in the Topology tab alongside
> sat-count and beam-count overrides as a `Simulation Setting`. The
> UE-count override extends the live engine to maintain N independent
> per-UE state vectors with per-UE SINR + per-UE handover state. The
> override is gated on `appMode === 'sinr-experiment'`; in
> `modqn-demo` the paper-faithful 100-UE baseline applies.

The amendment ships in PR-α2 alongside the UE-count slider UI.

## 10. Acceptance Per Slice

### 10.1 PR-χ (F-S1, live N-UE position generator + ground projection)

- New file `src/engine/ue/multiUeState.ts` exports
  `generateUePositions(ueCount, primaryFootprintRadiusKm,
  observerLat, observerLon, seed): UePosition[]` (deterministic
  seeded uniform random scatter inside footprint disc).
- `src/scene/runtimeFrameStep.ts` accepts new optional
  `ueCount?: number` arg; defaults to 1 (preserves single-UE behavior).
  When `ueCount > 1`, fills `SimFrame.perUeServing` array AND populates
  per-UE ground positions via the new generator.
- `src/showcase/liveSimToScene.ts` widens `ues[]` from R6
  single-element to length `perUeServing.length`. R6 comment updated
  with "live N variable, single primary preserved at index 0".
  Primary UE keeps existing `live-ue-0` ID; secondaries use
  `live-ue-N` where N=1..(ueCount-1).
- F-S1 does NOT add per-UE SINR (all secondary UEs report `sinrDb:
  null` for now — F-S2 fills them).
- F-S1 does NOT add per-UE handover (all UEs visually share primary's
  serving — F-S3 fixes).
- New validator `scripts/validate-phase-f-multi-ue-positions.tsx`:
  - generator unit: 100 UEs from seed=42 produces 100 distinct
    positions inside the disc; rerun produces identical positions.
  - runtimeFrameStep grep: accepts ueCount arg; defaults to 1.
  - liveSimToScene grep: widens ues[] from single element.
  - SSR GroundScene with 5 UEs renders 1 primary + 4 secondary.
- `npm run lint` clean.
- All prior validators still pass (Phase C/E + S3 omega).

### 10.2 PR-ψ (F-S2, per-UE SINR computation)

- `runtimeFrameStep` computes SINR per UE against all visible
  (sat, beam) pairs. Per-UE SINR fills
  `SimFrame.perUeServing[i].sinrDb`.
- All UEs still share primary's `(servingSatId, servingBeamId)`.
- liveSimToScene populates `NormalizedUe.sinrDb` per UE (or
  equivalent slot in the normalized frame).
- New validator `scripts/validate-phase-f-per-ue-sinr.tsx`:
  - For a synthetic 5-UE scatter, each UE has finite SINR computed.
  - Removing one UE position produces N-1 SINR entries.
  - SINR values differ across UEs (proves per-UE compute, not
    duplication of primary's value).
- `npm run lint` clean.
- All prior validators still pass.

### 10.3 PR-ω (F-S3, per-UE handover state machine)

- N `HandoverManager` instances created in `useSimulation` (Option A
  per SDD §4.4).
- Per-UE serving selection: each UE's HandoverManager runs against its
  own candidate set (filtered by per-UE SINR).
- `SimFrame.perUeServing[i]` gains
  `{ servingSatId, servingBeamId, pendingTargetSatId,
  pendingTargetBeamId, triggerProgressSec, ...}`.
- Primary UE behavior UNCHANGED (still uses `sim.serving` for
  ω-handover override + existing display).
- New validator `scripts/validate-phase-f-per-ue-handover.tsx`:
  - 3-UE scatter with 2 sats visible; each UE selects best-SINR sat
    independently.
  - Triggering a handover on one UE does NOT cascade to others.
  - Per-UE pendingTargetSatId is independent.
- `npm run lint` clean.

### 10.4 PR-α2 (F-S4, UE-count slider activation)

- `SceneTopologyState.ueCount` field activates in
  `applySceneTopology` (overlay rides as MainScene prop, NOT inside
  Profile, per SDD §4.5).
- TopologyTab adds UE count slider section beneath UE marker size.
  Range `[40, 200]` step `1`. Banner "Adjusting UE count restarts
  the simulation." 3 new testids: `topology-tab-ue-count-slider`,
  `topology-tab-ue-count-effective-value`, `topology-tab-ue-count-reset`.
  Slider only renders when `appMode === 'sinr-experiment'`.
- `docs/sinr-runtime-parameter-contract.md` gains §"UE Count (Phase F)"
  subsection per §9.
- App.tsx joins `topology.ueCount` into the remount key
  (`getSceneTopologyResetKey` already includes it from PR-π — verify
  no change needed).
- modqn-demo mode bypasses the override (paper-faithful 100-UE
  baseline applies).
- New validator `scripts/validate-phase-f-ue-count-slider.tsx`:
  - TopologyTab grep for 3 new testids.
  - Slider attribute grep min=40 max=200 step=1.
  - applySceneTopology behavioral: ueCount=50 vs ueCount=null result
    in different remount keys.
  - SignalTuningPanel mode gate — UE count section NOT rendered in
    modqn-demo mode.
  - Contract md grep "UE Count (Phase F)" subsection.
- `npm run lint` clean.

### 10.5 PR-β2 (F-S5, OPTIONAL — UE distribution mode)

Out of scope for Phase F v1. Future SDD if needed.

### 10.6 PR-γ2 (F-S6, OPTIONAL — per-UE diagnostics)

Out of scope for Phase F v1. Future SDD if needed.

## 11. Frozen-File Audit

The S3 ω-handover SDD locked `runtimeFrameStep.ts` against
modification during S3. Phase F unfreezes that lock specifically for
F-S1..F-S3 because:

- The S3 lock was scope-limited to the S3 implementation window. S3
  has shipped (memory: "S0-S4 all on main 2026-05-15/16"). The freeze
  no longer applies.
- Phase F's multi-UE extension is additive (new args, new SimFrame
  fields) and does NOT alter S3's `decisionOverride` flow for the
  primary UE.

PR-χ validator includes a regression assertion that the S3 omega
validator still passes on the post-F-S1 codebase. PR-ψ + PR-ω
re-check the same regression.

## 12. Out of Scope

Not in Phase F v1:

- UE mobility (waypoints, random-walk, Manhattan model) — Phase G.
- Per-UE MODQN policy inference — blocked by Phase 6W antenna pattern
  provenance gate.
- UE clustering / hotspot distributions (only random uniform in v1).
- Per-UE diagnostics surfacing in DiagnosticsDrawer (F-S6 deferred).
- Multi-shell UE distribution (UEs always scatter inside primary
  shell's footprint).
- 100-UE KPI replication against paper baseline (correctness via
  behavior, not KPI matching).
- Live per-UE bandwidth allocation / scheduling.
- Per-UE QoS classes.
- UE birth/death (UE count is fixed per topology state).

## 13. Risks

- **Performance**. 200 UEs × per-frame SINR × per-UE handover state
  machine. Rough estimate: 200 × 30 × ~50 muls/SINR per UE per beam
  + 200 × ~20 ops/handover-tick = ~310K ops/frame. At 30 FPS =
  9.3M ops/sec. JavaScript single-thread can handle this. Mitigation:
  PR-ψ adds a perf budget benchmark.
- **HandoverManager state contention**. N independent managers run
  per-frame in a loop. If a future refactor consolidates them, the
  per-UE order must be deterministic. Mitigation: PR-ω uses
  insertion-ordered UE IDs (`live-ue-N` ascending).
- **Position generator non-determinism**. If the seed is not pinned,
  reloads produce different scatters. Mitigation: seed default is a
  fixed const; PR-χ validator asserts identity of two consecutive
  generations.
- **Replay regression**. The replay path already supports multi-UE
  through artifact-baked positions. Phase F must not collide with
  that path. Mitigation: PR-χ NEGATIVE assertion that
  `showcaseArtifactToScene.ts` is unchanged (already a Phase C
  pattern; reuse).
- **Frozen-file revival**. Unfreezing `runtimeFrameStep.ts` re-opens
  surface area that S3 carefully bounded. Mitigation: Phase F slices
  are additive (new args / new fields); existing behavior at
  `beamFootprintMultiplier=1, ueCount=1` is byte-equivalent.
- **Primary UE narrative regression**. Existing single-UE-focused
  diagnostics, ω-handover override, and replay narratives consume
  `sim.serving`. Phase F MUST keep `sim.serving` == `perUeServing[0]`
  byte-for-byte. Mitigation: PR-χ validator asserts equality on the
  `ueCount=1` path.
- **GroundScene visual scaling**. `ueMarkerMultiplier` applies to all
  UEs including secondaries. Verifying 200 markers don't visually
  overwhelm the scene is browser smoke (not in scope of validators).
  Mitigation: PR-α2 acceptance includes a browser smoke step at
  N=200 with ueMarkerScale=0.5 to confirm secondary markers stay
  legible.

## 14. Validation Plan (per Phase F slice)

Each slice's PR runs:

- `npm run lint`.
- The relevant focused validator script.
- ALL prior Phase A/B/C/D/E validators that exist on the branch.
- S3 omega regression validator (frozen-file canary).
- Manual source-grep: no `showcaseArtifactToScene.ts` edit
  (NEGATIVE assertion), no profile JSON edit, no
  `FOOTPRINT_RADIUS_WORLD` const change.
- Browser smoke for PR-α2: open dev server, switch app mode to
  sinr-experiment, open Topology tab, drag UE count slider to 100,
  observe ~100 UE markers render. Confirm sim restart fires.
- Per `feedback-validator-canvas-vs-react-attr` rule, any validator
  assertion against a re-rendered React-DOM attribute gates on the
  same DOM element's own attr.
- Per `feedback-modqn-demo-subagent-verify` rule, codex sub-agent
  PASS reports are re-verified in the controller main thread before
  PR push.

## 15. Assumptions To Verify Before PR-χ Lands

- `runtimeFrameStep.ts` accepts a new optional `ueCount` arg without
  breaking existing callers (other slice integrations, test fixtures).
  Trace `stepRuntimeFrame` call sites: if any call site relies on the
  arg signature precisely, update accordingly.
- `SimFrame` shape extension (adding `perUeServing` array + retaining
  `serving` alias) does not break consumers. Particularly check
  `useSimStatePublisher`, `useBeamViz`, `ModqnReplayPlaybackShellModel`
  — none of these should be aware of the new field, just keep reading
  `sim.serving`.
- The S3 freeze on `runtimeFrameStep.ts` is informally lifted (S3
  shipped to main; the freeze was scope-locked to S3). Phase F's
  additive changes are safe.
- `HandoverManager` constructor cost is low enough that creating N
  instances per topology-change is acceptable (memory says ~200B per
  instance, 200 × 200B = 40KB).
- The Mulberry32 or LCG seeded RNG produces visually-distinct UE
  scatter at N=200 (no obvious clustering, no gaps). Browser smoke
  verifies.
- The primary UE's serving in `perUeServing[0]` exactly equals
  `sim.serving` after the refactor (zero-drift invariant for backward
  compat).
- localStorage `leo-beam-sim.scene-topology.v1` key handles the new
  `ueCount` field gracefully — existing keys without it deserialize
  to `ueCount=null` which is the no-override case.

If any assumption is contradicted before implementation, update this
SDD rather than patching display behavior around it.

## 16. Greek-letter Slice Naming Convention

After Phase F consumes χ/ψ/ω + α2/β2/γ2, future phases must continue
the numbered-suffix convention. Phase G's first slice would be `δ2`
(re-use δ with suffix 2), Phase G's second `ε2`, etc. The original
letters (α/β/γ/δ/ε/ζ/η/θ/ι/κ/λ/μ/ν/ξ/ο/π/ρ/σ/τ/υ/φ/χ/ψ/ω) are now
exhausted as identifiers; the suffix '2' indicates the second cycle.
