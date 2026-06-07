# SINR-Live Earth-Fixed Cells — Mini-SDD (CQ3 root fix)

**Date:** 2026-06-07
**Status:** Revised post-codex-review (5 BLOCK + 7 MAJOR + 2 MINOR addressed). Pending implementation in a fresh conversation.
**Author:** Claude controller (investigation session 2026-06-07).
**Scope:** `leo-beam-sim` **SINR-live cinema lane only** (`appMode='sinr-experiment'`, `sceneLane='sinr-live'`, profile `hobs-2024-candidate-rich`). MODQN lanes (`modqn-demo`, `modqn-live-cell-preview`, artifact-replay) are **out of scope** and must not change behaviour.
**Supersedes (for the SINR-live lane only):** the CQ3 "primary-UE drift / unanchor render" plan in `.agent-memory/project_cinema_quality_2026-06-07.md`.
**Decisions locked (user, 2026-06-07):** **A1** = no S0 unanchor slice (it only un-hides the degenerate steered off-axis and is thrown away once the lane renders cells; go straight to the cell model). **B3** = hybrid serving-truth model (see §5.1).

## 0. Reading Order

1. `.agent-memory/MEMORY.md` index + `project_cinema_quality_2026-06-07` (CQ3 re-diagnosis + this pivot).
2. This doc.
3. `docs/modqn-realistic-beam-geometry-cross-repo-sdd.md` — the 2026-05-28 cross-repo SDD that established Earth-fixed cells + hopping + off-axis as paper-faithful geometry **for the MODQN/producer track**. This mini-SDD is a NEW, SEPARATE application: Earth-fixed cells as the live SINR truth of leo's OWN SINR-live lane (leo-owned live SINR-offset compute, **NOT** MODQN/producer/paper proof — see §7).
4. `CLAUDE.md` §3/§4/§5 + Frontend Render Governance Rule; `docs/frontend-render-governance.md`, `docs/frontend-mode-lane-separation-sdd.md`.
5. Code: `src/scene/runtimeFrameStep.ts` (`stepRuntimeFrame`, `buildLinkContext`), `src/scene/simulationHelpers.ts:168` (`resolveLatticeSteering`), `src/scene/useBeamViz.ts:632-754` (`anchorToUe`), `src/engine/cells/cellLayout.ts` + `cellScheduler.ts`, `src/scene/useCellSchedule.ts`, `src/viz/CellBeamCones.tsx`, `src/engine/signal/link-budget.ts` + `beam-gain.ts` + `slant-range.ts`, `src/scene/runtimeUeFrame.ts`, `src/scene/liveWalkerHandoverEventIndex.ts`, `src/engine/handover/handover-manager.ts`, `src/scene/sceneLaneRenderPlan.ts:90`.

## 1. Purpose

In the SINR-live cinema the beam must NOT keep hitting the UE dead-centre. UEs must sit at real positions inside/across cells (real **off-axis angle**), beams must **hop** to serve the 100-UE 200×90 km population, and **intra/inter-HO must be visible** (UE crossing a fixed cell boundary / the serving sat changing). User vision (verbatim 2026-05-28, cross-repo SDD §1.1) == today's CQ3 complaint: "波束跟著衛星平移、不理 off-axis、該 hopping 服務不同 UE … 不只視覺,要真的合理".

## 2. Problem statement + evidence (CQ3 re-diagnosed 2026-06-07)

The prior CQ3 plan ("primary-UE drift → visible intra-HO") was empirically falsified. Throwaway probes (`scripts/probe-cq3-*.ts`, committed):

1. **Intra-HO already abundant; drift does nothing.** `buildLiveWalkerHandoverEventIndex` on candidate-rich, STATIC UE → **75 intra + 110 inter** across all 12 ten-minute buckets. Drift (r=15..80 km) → 62-70 intra (NOT more). CQ3 is not "make intra happen".
2. **CQ3 is render-vs-truth.** TRUTH (`probe-cq3-offaxis.ts`): serving beam ground-dist to primary UE = **mean 74.7 km / p50 27.634 km / off-axis ≈2.88°** — UE is genuinely off-axis. RENDER hides it: `useBeamViz.ts:751-754` `anchorToUe` subtracts `primaryBeamCell.offset` (= the serving beam's own offset, since `primaryBeamIdForSat` `beamVizModel.ts:211` returns `servingBeamId`) → `groundX = 0` → serving beam drawn ON the UE.
3. **Steered-lattice degeneracy.** `resolveLatticeSteering` (`simulationHelpers.ts:168`) re-snaps a beam onto (near) the primary UE → off-axis is a single re-snapping ring (~27.6 km), not a rich distribution; cannot serve 100 scattered UEs with one steered beam; "intra" = lattice teleport, not a UE crossing a cell.

### 2.1 codex review verdict (2026-06-07) and how it is resolved here

codex (consult, 642k tok) returned 5 BLOCK + 7 MAJOR + 2 MINOR. Resolutions:

- **BLOCK-1 (SDD overstates root fix; unanchor is the minimal fix for the narrow bug).** Accepted as framing: unanchor fixes only "UE centred" and exposes the *degenerate* steered off-axis; it does NOT deliver the multi-UE / hopping / cross-cell-HO showcase the user requires, and it is thrown away once the lane renders cells. **Decision A1: skip S0 unanchor; the cell model is the chosen scope.** This doc no longer claims cells are the *necessary* fix for the narrow bug — they are the chosen fix for the *showcase goal* (§1). The narrow off-axis bug is a subset that the cell model also fixes.
- **BLOCK-2 (UE→cell→serving is the core truth contract, not an unknown; "membership OR best-SINR" are incompatible).** Resolved by **Decision B3** (§5.1): pick the hybrid explicitly.
- **BLOCK-3 (`cellScheduler` is a display round-robin, not a serving oracle).** Resolved: the TRUTH path does NOT use `cellScheduler`'s round-robin assignment. Serving is selected by SINR + handover policy per §5.1. `cellScheduler`/`useCellSchedule` stay display-only on the MODQN lane, untouched.
- **BLOCK-4 (intra-HO identity).** Resolved: four identities separated in §5.2; intra/inter defined by serving-SAT change, not scheduler bookkeeping.
- **BLOCK-5 (S-cells-1 collapses spike+truth).** Resolved: §6 splits a pure-model spike (no runtime mutation) from the runtime truth switch.
- **MAJORs** (slant range per-cell, scan-angle/steering-loss from sat-nadir→cell-centre, freq reuse by stable cell identity, secondaries use the same model, idle-cell semantics under K<N, governance flag not `showCellOverlay`, stop paper/MODQN-proof framing): folded into §5/§6/§7.
- **MINORs** (cinema framing is downstream; revised ordering): folded into §6.

## 3. Decision

Make **Earth-fixed cells the live SINR truth of the SINR-live lane**, reusing leo's own `cellLayout.ts` geometry + `computeLinkBudget`/`beam-gain`/`slant-range`. Serving is chosen by SINR + handover policy (NOT the round-robin display scheduler). Render cells (`CellBeamCones`) on the lane with UE markers at true positions → real off-axis + visible cross-cell HO. No producer dependency, no re-training (this lane is leo's own SINR-offset compute, NOT MODQN truth). MODQN lanes unchanged; SceneLane enum stays 4 (Rule#4).

## 4. Coverage / parameters (empirical, `probe-cq3-cell-coverage.ts`)

100 uniform UEs in 200×90, nearest-cell coverage:

| beamwidth | cells | alt | cell-centre span | UEs covered | off-axis p95 |
|---|---|---|---|---|---|
| 2.0° (producer) | 37 | 780 | 141×123 km | 79/100 | 2.29° |
| 3.32° | 37 | 780 | 235×203 km | 100/100 | 1.49° |
| 2.0° | 61 | 780 | 189×163 km | 95/100 | 1.02° |
| 3.32° (leo orbit) | 37 | 550 | 166×143 km | 92/100 | 2.28° |

**Decisions:**
- **Constellation:** keep leo `hobs-2024-candidate-rich` (large multi-shell pool). Do NOT adopt the producer 4-sat/780 km proxy (coverage-degenerate; cross-repo SDD line 180 needs P≈384).
- **Altitude:** keep leo 550 km. Cell radius = `alt·tan(θ_3dB/2)` derives from it.
- **Tile coverage vs served coverage (MAJOR):** tune `{beamwidth3dB, cellCount}` so all UEs fall in a cell (candidate: cellCount 61 and/or beamwidth ~3.3° at 550 km). But **nearest-cell coverage ≠ served coverage under K<N hopping** — define idle-cell semantics (§5.3).
- **This is a showcase-pragmatic leo live-SINR surface at 550 km — NOT the producer's 780 km/2° baseline.** Do not frame the two as the same truth (MAJOR). Honesty labels stay.

## 5. Design

### 5.1 Serving truth model — Decision B3 (hybrid)

- **UE → cell (membership):** every UE is assigned to the **nearest earth-fixed cell centre**. Stable; this is what produces the visible "UE crosses from cell A to cell B" narrative when the UE moves (CQ3b).
- **cell → serving sat/beam (SINR + HO policy):** for each cell, the candidate serving satellites = those that can illuminate the cell (elevation mask + steering reach to the cell centre). Among candidates, choose serving by **SINR + the existing sinr-offset handover policy** (hysteresis/offset/trigger-time, reuse `HandoverManager` logic on cell-pointing candidates). This REPLACES the round-robin `cellScheduler` assignment for the truth path (resolves BLOCK-3).
- **primary UE serving = the serving of the cell it is in.** Off-axis SINR = `computeLinkBudget` with the serving beam pointed at the cell centre and the UE at its true position → off-axis = dist(UE, cell-centre) (resolves the CQ3 bug at the truth layer).
- **K<N hopping** is a separate display/scheduling concern layered on top; the *serving truth* is continuity-stable (a UE keeps its serving sat until SINR/policy says otherwise), not slot-rotated.

### 5.2 Four identities (resolves BLOCK-4)

- **cell identity:** fixed earth-fixed cell id (geography, from `cellLayout`).
- **beam identity:** a satellite's beam pointed at a given cell (sat × cell).
- **frequency identity:** stable reuse colour per cell = `cellId mod reuseFactor` (the producer's `local_beam_index_mod_reuse_factor`), NOT a rotating per-slot `beamIndex` (resolves the freq-reuse MAJOR). Co-channel interference = simultaneously-lit cells of the same colour.
- **handover identity:** a change in the UE's SERVING. **intra-HO = serving SAT unchanged, serving CELL/beam changes** (UE crosses a boundary into another cell served by the same sat, or that sat re-points). **inter-HO = serving SAT changes.** A scheduler beam-index shuffle is NOT a handover.

### 5.3 Link-budget geometry corrections (resolve MAJORs)

**Antenna self-consistency (S-cells-4a, DONE).** Peak gain and 3 dB beamwidth are
NOT independent for one aperture, but `link-budget.ts` adds `antenna.maxGainDbi`
as a free constant — the candidate-rich profile encodes a physically-impossible
40 dBi @ 3.32° (>100 % efficiency). The SINR-live lane fixes this **as a decoupled
sinr-live-only truth-input override**, NOT a profile edit (chosen over editing the
shared profile because the profile is also the steered lane's SINR oracle + a
baseline-KPI window — editing it would ripple into both): the cell model takes
`maxGainDbiOverrideDbi` / `maxSteeringAngleOverrideDeg` / `scanLossAtMaxSteeringOverrideDb`
/ `beamwidthOverrideRad`, layered over `profile.antenna` without mutating it, so
the steered lane + `baseline-kpi-*.json` stay byte-identical (verified:
`validate:modqn:phase6p-hobs-sinr-kpi-baseline` `failures:[]`). The lane runs
`maxGainDbi = consistentPeakGainDbi(θ, η) ≈ 33.5 dBi` (θ = 0.058 rad, η = 0.6) and
`maxSteeringAngleDeg = 50°` (the 12° profile limit was the real coverage bottleneck —
only 1–3 of ~46 above-mask sats could reach the area). The runtime gate locks
`|maxGainDbi − consistentPeakGainDbi| < 0.5 dB` so the pair can never silently drift
back to a >100 %-efficiency antenna. Empirical demo-window result (37 cells):
served SINR p50 ≈ −2.5 dB (the gain de-bias does NOT collapse serving), off-axis
p95 ≈ 2.2°, 1–4 serving sats.

For each (UE, candidate serving sat, cell):
- **scan angle** = angle from sat nadir to the **fixed cell centre** (not `resolveLatticeSteering` offsets) → feeds `computeSteeringLossDb`.
- **slant range** = per-(sat, cell) from the sat to the cell centre (per-cell elevation → `slant-range.ts`), not one `sat.rangeKm` for all cells (the 200×90 span makes this material).
- **off-axis** = dist(UE true position, cell centre) → `computeOffAxisDeg` + Bessel J1/J3.
- **idle-cell semantics:** define explicitly — a UE whose cell is not lit this slot is `unserved` (honest; the S2 aggregate already surfaces transient unserved), with optional neighbour-cell fallback as a later polish. Pin in S-cells-5.

### 5.4 Secondaries (resolve MAJOR)

The 100-UE mosaic/aggregate must use the SAME cell model as the primary (`runtimeUeFrame.ts` `stepSecondaryUeHandovers`/`fillPerUeServingSinr`). Primary-only cell truth would make cinema + aggregate disagree. All UEs: nearest-cell membership + cell-serving from the shared cell-truth object.

### 5.5 Render

- SINR-live lane renders `CellBeamCones` from the SAME cell-truth object (apex=sat, base=fixed cell centre, tilted), gated by a NEW render-plan flag (NOT `showCellOverlay`, which stays MODQN-only — resolves governance MAJOR). UE markers from `perUePositions` (true positions) → UE visibly off-centre.
- Retire `anchorToUe` for this lane only; keep the steered-lattice render path intact for any lane still using it.
- `coneGeometry` circular base acceptable for v1 (tilt = real "波束變型"); elliptical footprint = later polish. Raise opacity vs the faint 0.1 overlay.

## 6. Slice plan (fresh conversation; per-slice: cavecrew-reviewer → affected validators → governance Rule#9 → browser-verify real :3001 → commit, push deferred)

- **S-cells-1 — PURE MODEL CONTRACT spike (NO runtime mutation).** New pure module: given orbit/sat geo + cell layout + UE positions + handover policy, emit per-UE cell membership, per-cell serving sat/beam (SINR + HO policy, §5.1), the four identities (§5.2), per-(sat,cell) scan angle / slant range / off-axis (§5.3), and intra/inter classification (§5.2). Deliverable: pure functions + unit tests + a probe showing real off-axis distribution + nearest-cell coverage + sane intra/inter counts. **`buildLinkContext` unchanged.** Validator: `validate:phase-c:sinr-live-cells:model`.
- **S-cells-2 — ADDITIVE runtime truth (DONE — supersedes the original "wire into `buildLinkContext`").** Decision **S-cells-2-A** (locked, `.agent-memory/project_cinema_quality_2026-06-07`): the cell truth is layered ADDITIVELY, `runtimeFrameStep.ts` (`stepRuntimeFrame`/`buildLinkContext`) stays **FROZEN** (no rewrite — avoids the truth→render coupling that would break a steered-render frame whose serving beamId no longer exists, and respects the frozen-file convention S3 used). Wiring: a pure adapter `src/scene/sinrLiveCellRuntime.ts` (`createSinrLiveCellModel` returns `null` off lane → `attachSinrLiveCellFrame` is a no-op) gated by `useEarthFixedCellTruth = sceneLane === 'sinr-live'` (passed from `MainScene.tsx` into `useSimulation.ts`). After each `stepRuntimeFrame` (reset/seek/useFrame) the adapter runs `SinrLiveCellModel.step` over `frame.satellites` + `frame.perUePositions` and hangs the result on a NEW optional `SimFrame.sinrLiveCells`; the cell model is reset in `resetAllHoManagers`. **Existing frame fields are byte-identical → the three MODQN/artifact lanes + the current sinr-live render see zero drift; the visible scene does not change yet.** This covers BOTH primary and secondaries (one model over all UEs, §5.4). Validators: `validate:phase-c:sinr-live-cells:runtime` (lane gate + additive zero-drift + populated cell frame + reset wiring) + the S-cells-1 model gate; governance Rule#9 lane-ownership lock added.
- **S-cells-3 — render (DONE).** Cell-truth cones render on sinr-live from `frame.sinrLiveCells` (the SINR + HandoverManager truth, NOT the round-robin scheduler). NEW pure resolver + dumb render component `src/viz/SinrLiveCellBeamCones.tsx` (apex = serving sat, base = FIXED cell centre via the SAME `buildSinrLiveCellLayout(profile)` + `worldUnitsPerKm` the UE markers use → off-centre is real; idle/unrendered-sat cells skipped honestly). NEW render-plan flag `showSinrLiveCellBeams` (= `showSinrLiveViewport`, sinr-live only — NOT `showCellOverlay`). The steered `<SatelliteBeams>` cones are SUPPRESSED on this lane (`&& !showSinrLiveCellBeams`) so they don't double-draw, and `useBeamViz` retires the UE-anchor on sinr-live only via a new `disableUeAnchor` param (other lanes unchanged). `data-beam-cone-count` on this lane now reports the cell cones that actually render (honest). UE markers stay at true `perUePositions` → UE visibly off-centre. Validators: `validate:phase-c:sinr-live-cells:render` (resolver model gate, 7 checks) + `:render:browser` (added to `validate:live-render`); governance Rule#9 flipped the `.sinrLiveCells` render-consume lock (assertNotContains→assertContains) + added the flag lane-ownership matrix + mount/suppress/anchor/import-purity/placement locks. Verified real :3001: off-axis ≈ 1.0–1.6° (the CQ3 fix — steered render collapsed it to ~0), served cells hop 3–58 at the demo window, all 7 live-render gates green (modqn lanes zero-drift). ⚠️ honest: headless first-frame init ~30 s under CPU contention (cell model 161 link budgets/frame, S-cells-2) — the optional cell-model throttle stays the S-cells-5 lever.
- **S-cells-4 — antenna truth-input + render scope + re-point (IN PROGRESS, split a–e).**
  - **(a) DONE** — self-consistent antenna truth-input override (33.5 dBi / 50° steering / 3.32° / cellCount 37) as a decoupled sinr-live-only override (profile untouched; baselines byte-identical); new `consistentPeakGainDbi` + `|maxGainDbi − consistent| < 0.5 dB` gate. See §5.3.
  - **(b)** cone render scope = focus-subset (~2–7, reuse the modqn `beamConeScope` idea) + draw ILLUMINATED beams (not only served) + raise cone opacity.
  - **(c) mosaic + aggregate DONE** — the 3D UE mosaic + the served-N/N aggregate HUD + per-UE diagnostics read `sim.sinrLiveCells` (cell truth): a UE is coloured/counted only when its cell is lit + served, so dots + cones + counter agree. Honest result: served drops ~69→~12-38/100 (cell truth is geometry-limited vs the steered beam-on-UE), avg served SINR improves (cell-centre serving). **DEFERRED to (c2):** the S1 candidate highlight + `buildLiveWalkerHandoverEventIndex` are still STEERED — re-deriving the index needs an offline cell-model trajectory pass (a genuine design choice + cinema-seek risk), so it is split into its own slice. The ambient scene (the default surface) is fully cell-truth; only the cinema-seek index lags.
  - **(d)** retire/reconcile the old `EarthFixedCells` 20-hex green-disc ground paint (`showEarthFixedCells`, `validate:vc3a:hex-paint`).
  - **(e)** confirm cellCount 37 vs 19 on real :3001 at the demo window.
  - Validators: handover-cinema model+browser, sinr-serving-mosaic, director-cinematic, phase-h sinr-live-render, sinr-live-cells render.
- **S-cells-5 — coverage + mobility + idle-cell.** Pin `{beamwidth, cellCount}` for full 200×90 coverage at 550 km; define idle-cell semantics (§5.3); add CQ3b primary-UE mobility (UE crosses fixed cells → visible intra-HO). Coverage probe green.

## 7. Governance / boundaries

- Rule#4: SceneLane enum stays 4. New render-plan flag lane-gated to sinr-live; MODQN `showCellOverlay` untouched. Update `validate:frontend:scene-lane-governance` with the new flag's lane ownership.
- Rule#6: cells are the TRUTH for this lane (render and SINR agree) — not a display transform over a different truth.
- **Not MODQN/paper proof.** This is leo's own live SINR-offset surface at 550 km; it is NOT the producer's 780 km baseline and NOT MODQN decisions. Keep "not MODQN" honesty labels; do not imply producer/paper proof (MAJOR).
- Vendor-on-demand (CLAUDE.md §4): reusing leo's OWN `cellLayout.ts` as live SINR geometry does not violate it (leo-owned live sim, not a foreign rigor-critical port). The serving/handover logic reuses leo's existing `HandoverManager`.
- Affected validators each slice: `validate:live-render` (handover-cinema model+browser, sinr-serving-mosaic, director-cinematic live+artifact, phase-h sinr-live-render), scene-lane-governance, runtime baseline, camera-preset, lint. Not heavy-compute (pure TS) → local env.

## 8. Risks / blast radius

- SINR truth path is rigor-critical; gate the cell path strictly to sinr-live, keep the steered path intact for other lanes.
- Serving selection on cell-pointing candidates must reuse `HandoverManager` cleanly (hysteresis/offset) — get continuity right or it churns.
- Per-cell slant range / scan angle / steering loss are real geometry changes — verify against the off-axis probe.
- S1 candidate highlight (mesh-derived) must follow the new cones; S2 mosaic keys change to cell ids; cinema framing assumes beam-on-UE (re-tune).

## 9. Handoff

Implementation runs in a fresh conversation. Bootstrap: read `.agent-memory/MEMORY.md` → `project_cinema_quality_2026-06-07` → this SDD, then start **S-cells-1** (pure model spike, no runtime mutation). Decisions locked: **A1** (no S0) + **B3** (hybrid serving). Probes `scripts/probe-cq3-*.ts` committed for before/after off-axis + coverage verification.
