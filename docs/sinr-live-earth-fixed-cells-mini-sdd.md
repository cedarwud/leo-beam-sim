# SINR-Live Earth-Fixed Cells — Mini-SDD (CQ3 root fix)

**Date:** 2026-06-07
**Status:** Draft — pending codex review + user greenlight before implementation.
**Author:** Claude controller (investigation session 2026-06-07).
**Scope:** `leo-beam-sim` **SINR-live cinema lane only** (`appMode='sinr-experiment'`, `sceneLane='sinr-live'`, profile `hobs-2024-candidate-rich`). MODQN lanes (`modqn-demo`, `modqn-live-cell-preview`, artifact-replay) are **out of scope** and must not change behaviour.
**Supersedes (for the SINR-live lane only):** the CQ3 "primary-UE drift / unanchor render" plan in `.agent-memory/project_cinema_quality_2026-06-07.md` (empirically falsified — see §2).

## 0. Reading Order

1. `.agent-memory/MEMORY.md` index + `project_cinema_quality_2026-06-07` (CQ3 re-diagnosis block + this pivot).
2. This doc.
3. `docs/modqn-realistic-beam-geometry-cross-repo-sdd.md` — the **2026-05-28 cross-repo SDD** that established Earth-fixed cells + hopping + off-axis as the paper-faithful geometry. **This mini-SDD is a NEW application of that geometry**: it makes Earth-fixed cells the *live SINR truth of leo's own SINR-live lane*, which the cross-repo SDD did NOT cover (that SDD routed leo's real angle-aware SNR through a producer Phase III bundle regen, for the MODQN track).
4. `CLAUDE.md` §3 (replay immutability), §4 (vendor-on-demand), §5 (boundaries) + Frontend Render Governance Rule; `docs/frontend-render-governance.md`.
5. Key code: `src/scene/runtimeFrameStep.ts` (SINR truth), `src/scene/simulationHelpers.ts:168` (`resolveLatticeSteering`), `src/scene/useBeamViz.ts:632-754` (`anchorToUe`), `src/engine/cells/cellLayout.ts` + `cellScheduler.ts` (Earth-fixed cell oracle, leo-owned), `src/viz/CellBeamCones.tsx` (cone renderer), `src/scene/useCellSchedule.ts`.

## 1. Purpose

CQ3 goal: in the SINR-live cinema the beam must NOT keep hitting the UE dead-centre. The UE must sit at realistic positions inside/across beams (real **off-axis angle**), beams must **hop** to serve the 100-UE 200×90 km population, and **intra-HO must be visible** as a UE crossing a cell boundary / the serving cell being re-assigned. User vision (verbatim, 2026-05-28, recorded in cross-repo SDD §1.1) == today's CQ3 complaint: "波束跟著衛星平移、不理 off-axis、該 hopping 服務不同 UE … 不只視覺,要真的合理".

## 2. Problem statement + evidence (CQ3 re-diagnosed 2026-06-07)

The prior CQ3 plan ("give the primary UE drift so it crosses beam edges → visible intra-HO") was **empirically falsified** this session. Throwaway probes (`scripts/probe-cq3-*.ts`, committed for before/after verification):

1. **Intra-HO events already abundant; drift does nothing.** `buildLiveWalkerHandoverEventIndex` on candidate-rich, STATIC UE → **75 intra + 110 inter**, spread across all 12 ten-minute buckets. Adding primary-UE circular drift (r=15..80 km) → 62–70 intra (NOT more). The satellite passing overhead already drives intra via `resolveLatticeSteering` re-snapping the nearest lattice beam. So CQ3 is not "make intra happen".
2. **CQ3 is a render-vs-truth bug.** TRUTH (`probe-cq3-offaxis.ts`): the serving beam's real ground distance to the primary UE = **mean 74.7 km / p50 27.634 km (= one lattice ring) / off-axis ≈ 2.88°** — the UE is genuinely off-axis in the SINR truth. RENDER hides it: `useBeamViz.ts:751-754` `anchorToUe` subtracts `primaryBeamCell.offset`; since `primaryBeamIdForSat` (`beamVizModel.ts:211`) returns `servingBeamId`, `groundX = (servingBeam.offset − anchorOffset) = 0` → **serving beam drawn ON the UE**, erasing the true off-axis. This is a Rule#6 display-vs-truth violation.
3. **Steered-lattice is the wrong MODEL for a multi-UE handover showcase.** `resolveLatticeSteering` (`simulationHelpers.ts:168`) electronically steers a beam onto (near) the primary UE → θ≈0 for the serving sat → no off-axis story, cannot serve 100 scattered UEs with one steered beam, and the "intra" is a lattice re-snap (a teleport), not a UE crossing a fixed cell. Cross-repo SDD §1.2.6 names this exact degeneracy.

### 2.1 Why Earth-fixed cells is the correct fix (and leo already owns it)

- `docs/modqn-realistic-beam-geometry-cross-repo-sdd.md` already established **Earth-fixed 37-hex cells + beam-hopping + off-axis-from-cell-centre** as the paper-faithful geometry (paper is silent; all sibling LEO BH papers use Earth-fixed cells).
- **leo owns the geometry oracle:** `src/engine/cells/cellLayout.ts` (37 hex cells, `cellRadius = altitude·tan(θ_3dB/2)`), `cellScheduler.ts` (K-active hopping), `CellBeamCones.tsx` (cone renderer: apex=satellite, base=fixed cell centre, tilted = real "波束變型"), `useCellSchedule.ts`. The producer's Python `env/cell_layout.py` is a documented "pure-geometry parity port of the TypeScript oracle leo-beam-sim/src/engine/cells/cellLayout.ts" — **the producer ported FROM leo.**
- Earth-fixed cells gives, by construction: real off-axis (UE at its true position within its cell), hopping (K of N cells lit per slot), and **intra-HO = UE crossing a fixed cell boundary OR the serving cell re-assigned** — visible without any render hack. The `anchorToUe` hack + steered-lattice become unnecessary for this lane.

### 2.2 Current state (what is and isn't wired)

- SINR **truth** (both lanes): `stepRuntimeFrame → buildLinkContext → resolveLatticeSteering` (steered lattice). `computeLinkBudget` already computes off-axis via `computeOffAxisDeg(dist(UE, beam.offset), alt)` + Bessel J1/J3 `beam-gain.ts`.
- Earth-fixed cells (`cellLayout`/`cellScheduler`/`CellBeamCones`/`useCellSchedule`) are a **display layer only**, gated to `modqn-live-cell-preview` (`sceneLaneRenderPlan.ts:91` `showCellOverlay`). `cellScheduler` runs off `viz.displaySats` at a cosmetic 2.5 s slot, does NOT feed SINR.

## 3. Decision

Make **Earth-fixed cells the live SINR truth of the SINR-live lane**, reusing leo's own `cellLayout`/`cellScheduler`/`computeLinkBudget`/`beam-gain` — no producer dependency, no re-training (this lane is leo's own SINR-offset compute, NOT MODQN truth). Render the cells on the SINR-live lane (`CellBeamCones`) with UE markers at true positions, so the UE shows real off-axis and intra-HO is visible. MODQN lanes unchanged. SceneLane enum stays 4 (Rule#4).

**This makes the ENVIRONMENT faithful to MODQN's training scene — NOT MODQN's decisions** (those still require the producer bundle; separate blocker per `project_handover_cinema_data_ceiling_2026-06-06`). Honesty labels ("not MODQN") stay.

## 4. Coverage / parameters (empirical, `probe-cq3-cell-coverage.ts`)

100 uniform UEs in 200×90, nearest-cell coverage of leo `cellLayout`:

| beamwidth | cells | alt | cell-centre span | UEs covered | off-axis p95 |
|---|---|---|---|---|---|
| 2.0° (producer) | 37 | 780 | 141×123 km | **79/100** | 2.29° |
| 3.32° | 37 | 780 | 235×203 km | **100/100** | 1.49° |
| 2.0° | 61 | 780 | 189×163 km | 95/100 | 1.02° |
| 3.32° (leo orbit) | 37 | 550 | 166×143 km | 92/100 | 2.28° |

**Finding:** producer's 2°/37 tiles only 141×123 km → ~21 edge UEs uncovered; full 200×90 needs a wider beam and/or more cells. Plus beam-hopping (K active of N) ⇒ instantaneous coverage < 100 %, cycling (honest; the S2 aggregate already surfaces this).

**Recommended param defaults (pin in S-cells-4):**
- **Constellation:** keep leo `hobs-2024-candidate-rich` (large multi-shell pool, proven coverage + inter-HO). Do NOT adopt the producer 4-sat single-plane proxy (coverage-degenerate; cross-repo SDD line 180: needs P≈384).
- **Altitude:** keep leo 550 km (it's the orbit). Cell radius derives from it.
- **Coverage:** tune `{beamwidth3dB, cellCount}` to tile the full 200×90 at 550 km (candidate: cellCount 61 and/or beamwidth widened toward ~3.3°). Confirm 100 % nearest-cell coverage + acceptable off-axis spread via the coverage probe.
- **Serving count L / active-cells-per-slot K:** start from the cross-repo SDD's K=28/37; reconcile with leo's beam-hopping profile (`beamHopping.maxActiveBeamsPerSlot`).

## 5. Design

### 5.1 Target SINR truth (the core change)

Replace, **for the SINR-live lane only**, the steered-lattice beam geometry in `buildLinkContext` with **cell-pointing geometry**:
- Build the Earth-fixed cell layout once (`buildCellLayout`, same params as the render).
- Per visible satellite, the set of beams it lights = the cells the scheduler assigns to it this slot (`cellScheduler` run on the REAL orbit/sat geo + real slot, not the cosmetic display path), filtered by elevation/steering reach.
- Each lit beam's ground position = its **fixed cell centre** (relative to the UE for `computeLinkBudget`). `computeLinkBudget` then yields off-axis = dist(UE, cell-centre) → real angle-aware SINR (off-axis Bessel J1/J3 + interference from co-channel cells via frequency reuse).
- The primary UE's serving = the sat/beam serving the cell the UE is in (or best SINR among reachable cells). Handover manager logic stays (sinr-offset), but the candidate set is now cell-pointing beams, not steered-lattice beams.

### 5.2 Render

- SINR-live lane renders `CellBeamCones` at fixed cell centres (gated by a new render-plan flag, NOT `showCellOverlay` which stays MODQN-only). UE markers continue from `perUePositions` (true positions) → UE visibly off-centre in its cell.
- Retire `anchorToUe` for this lane (its purpose — cancel steered-lattice common-mode slide — is moot once beams are at fixed cells). Keep the steered-lattice render path intact for any lane still using it.
- Footprint: `coneGeometry` circular base is acceptable for v1 (tilt = "波束變型" is real); elliptical off-angle footprint = optional later polish. Raise opacity vs the faint 0.1 overlay for cinema legibility.

### 5.3 Handover semantics + event index

- intra-HO = serving cell re-assigned to a different beam of the same sat, OR (with CQ3b mobility) the UE crosses into an adjacent cell. inter-HO = serving cell taken over by a different sat.
- `buildLiveWalkerHandoverEventIndex` (drives the cinema seek) must be re-derived from the cell model so the cinema seeks to real cell-based events. Re-run the intra/inter count probe; expect events to remain abundant and now spatially legible.

### 5.4 Honest design UNKNOWNS — resolve in the S-cells-1 spike (do NOT hand-wave)

1. **UE→cell→serving mapping for the primary UE + 100 secondaries.** Multiple UEs share a cell/beam. Define: primary serving = its cell's serving sat/beam; secondaries likewise. Reconcile with the existing per-UE `HandoverManager` + `stepSecondaryUeHandovers`.
2. **Where the cell scheduler runs in the truth path.** Today `cellScheduler` is display-side (MainScene, off `displaySats`). The truth needs it inside/feeding `stepRuntimeFrame` on the real orbit + real slot. Decide: vendor scheduler call into the engine vs pass schedule in.
3. **Interference model under cells.** Co-channel interference now comes from other lit cells (frequency reuse coloring). Confirm `computeLinkBudget`'s `activeAssignments` interference path works with cell-pointing beams.
4. **Cinema framing.** Camera focus presets assume the serving beam sits on the UE. With fixed cells the serving cell is offset from the UE — re-check `directorFocusPose` / S1 candidate highlight (mesh-derived) / S2 mosaic re-pointing.

## 6. Slice plan (execute in a FRESH conversation; per-slice: cavecrew-reviewer → affected validators → governance Rule#9 → browser-verify real :3001 → commit, push deferred)

- **S-cells-1 (SPIKE + truth):** cell-based SINR truth for the primary UE in `stepRuntimeFrame`/`buildLinkContext` behind a SINR-live-only switch. Resolve §5.4 unknowns. Deliverable: off-axis probe shows real distribution (not θ≈0) + 100 % nearest-cell coverage + sane intra/inter counts. Validators: new `validate:phase-c:sinr-live-cells:model` + existing runtime baseline must not drift on other lanes.
- **S-cells-2 (render):** SINR-live lane renders `CellBeamCones` (new render-plan flag, lane-owned), UE markers true pos, retire `anchorToUe` for this lane, opacity tuned. Governance: render-plan matrix + lane locks. Browser: UE visibly off-centre, beams at fixed cells, hopping.
- **S-cells-3 (handover/cinema):** re-derive `buildLiveWalkerHandoverEventIndex` from cells; S1 candidate highlight + S2 mosaic re-pointed to cells; cinema framing re-checked. Validators: handover-cinema model+browser, sinr-serving-mosaic, director-cinematic, phase-h sinr-live-render all green.
- **S-cells-4 (coverage + mobility):** pin `{beamwidth, cellCount}` for full 200×90 coverage; add CQ3b primary-UE mobility (now meaningful: UE crosses fixed cells → visible intra-HO). Coverage probe green.

## 7. Governance / validators / boundaries

- Rule#4: SceneLane enum stays 4. New render-plan flag is lane-gated to sinr-live; MODQN `showCellOverlay` untouched.
- Rule#6: cells are the TRUTH for this lane (not a display transform over a different truth) — render and SINR now agree. Update `validate:frontend:scene-lane-governance` with the new flag's lane ownership + a lock that the cell-truth path is sinr-live-only.
- Affected validators to re-run each slice: `validate:live-render` (incl. handover-cinema model+browser, sinr-serving-mosaic, director-cinematic live+artifact, phase-h sinr-live-render), scene-lane-governance, runtime baseline, camera-preset, lint.
- Not heavy-compute (pure TS) → stays in the local dev env, no Ubuntu server.

## 8. Risks / blast radius

- SINR truth path is rigor-critical; changing `buildLinkContext` risks the existing steered-lattice lanes — gate the new path strictly to sinr-live, keep steered path intact.
- S1 candidate highlight is mesh-derived (reads cone positions) — must follow the new cones.
- S2 mosaic / aggregate read `perUePositions` — unaffected positionally, but serving-beam coloring keys change to cell ids.
- Cinema camera framing assumes beam-on-UE — re-tune.

## 9. Handoff

Implementation runs in a fresh conversation to keep context light. Bootstrap: read `.agent-memory/MEMORY.md` → `project_cinema_quality_2026-06-07` → this SDD, then start S-cells-1. Probes `scripts/probe-cq3-*.ts` are committed for before/after off-axis + coverage verification.
