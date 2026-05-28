# MODQN Realistic Beam Geometry Cross-Repo SDD

**Date:** 2026-05-28
**Status:** Draft — pending user review before implementation.
**Authority scope:** producer-truth boundary for MODQN beam geometry across `modqn-paper-reproduction` (training truth) and `leo-beam-sim` (live-sim viz + replay consumer).
**Target repos:** `/home/u24/papers/modqn-paper-reproduction` (producer), `/home/u24/papers/project/leo-beam-sim` (consumer).
**Predecessor SDDs (SUPERSEDED in scope of beam geometry):**
- `docs/modqn-training-truth-visualization-sdd.md` §3.1 (ASSUME-MODQN-REP-002 hex-7 nadir).
- `docs/modqn-visibility-fix-mini-sdd.md` (4-plane Walker scripted-pass coverage hack).
- `docs/phase-h-live-sim-modqn-visual-parity-sdd.md` §4.4 (beam hopping toggle as no-op).

## 0. Reading Order

Read before changing this SDD or starting any implementation slice:

1. `.agent-memory/MEMORY.md` index then every active-priority entry.
2. `paper-source/txt_all/2024_09_Handover_for_Multi-Beam_LEO_Satellite_Networks_A_Multi-Objective_Reinforcement_Learning_Method.txt` lines 99-200 + 540-620 (the entire System Model and Simulation sections — paper makes ZERO claim about beam geometric layout).
3. `paper-source/catalog/PAP-2024-MORL-MULTIBEAM.json` `beamModel` + `systemModelAssumptions` (catalog-confirmed "Not specified" for beam pattern).
4. `modqn-paper-reproduction/configs/modqn-paper-baseline.resolved-template.yaml` `beam_geometry: ASSUME-MODQN-REP-002` (the filled-in reproducer assumption being SUPERSEDED by this SDD).
5. `modqn-paper-reproduction/docs/research/angle-aware-ee-multicatfish/00-architecture-sdd.md` + `01-v2.2-ee-objective-surface-sdd.md` (the active algorithm route this SDD enables — angle-aware EE-MODQN → Multi-Catfish-MODQN).
6. Survey of LEO multi-beam BH papers in `paper-source/catalog/` (PAP-2020-BEAMHOP-DRL, PAP-2025-MAAC-BHPOWER, PAP-2025-DIST-BH-HETERO, PAP-2022-SENSORS-BH, PAP-2025-EEBH-UPLINK, PAP-2026-BHFREQREUSE, PAP-2026-DRL-BHOPT).
7. `CLAUDE.md` §3 (replay artifact immutability), §4 (vendor-on-demand engine rule), §5 (boundaries), §9 (memory bridge), and `~/.claude/CLAUDE.md` worker-compute routing rule (heavy training runs on Ubuntu server, not local WSL2).

## 1. Purpose

### 1.1 User vision (verbatim 2026-05-28)

> 應該要按照真實的衛星狀況真實呈現，讓波束變型，然後能量什麼的都會真的
> 按照 off-axis angle 來做計算，而不是像現在好像完全不理會這個角度，然後
> 波束是會不停的 hopping 確保去服務到不同的 ue 才是正常的吧?不是像現在
> 這樣只是跟著衛星平移……我希望的不只是視覺上的效果，而是要真的合理。

The user complaint after running modqn-demo: (a) beams visually translate with satellite (nadir-anchored hex-7), (b) all beam colors identical (frequency reuse = 1), (c) beams artificially "wide" relative to scene scale, (d) handover events almost never visible, (e) satellite trajectories repeat the same scripted center-pass.

### 1.2 Audit findings (this SDD's source of authority)

After grep of paper full text + catalog metadata + reproducer config + related-work survey:

1. **PAP-2024-MORL-MULTIBEAM (the target paper) is SILENT on beam geometric layout.** Section II.A "System Model" lines 99-128 defines beams only as logical indices `(l, v) ∈ K`. Section IV "Simulation Result" lines 588-597 references STK orbits + 200×90 km user area but never specifies beam pointing, footprint shape, steering behavior, or earth-fixed vs satellite-fixed semantics. Paper Table I lists 7 beams per satellite without any geometry.
2. **Catalog `PAP-2024-MORL-MULTIBEAM.json` confirms paper silence**: `beamPattern: "Not specified"`, `antennaModel: "not-specified"`, `frequencyReuse: "Not specified"`, `beamHopping: false`.
3. **Reproducer `ASSUME-MODQN-REP-002` is filled-in, not paper-mandated.** `modqn-paper-baseline.resolved-template.yaml` declares `layout: hex-7, center_beam: nadir, theta_3db_deg: 2.0` — but the surrounding context describes this as `"resolved_assumptions"`, meaning the reproducer supplied this to make Python code executable, not because the paper demanded it.
4. **Reproducer's nadir-anchored choice is inconsistent with paper's 100-UE-scattered intent.** Paper Section IV places 100 users in a 200×90 km rectangle. With 2° beamwidth at 780 km altitude, the hex-7 footprint diameter is approximately 81 km — covering only ~36 % of the 200 km width of the user area. The remaining UEs are unreachable in any single snapshot. Either the paper intends some form of beam scheduling (hopping or steering to cover the whole area over time), or the paper's 100-UE scenario is geometrically inconsistent with the nadir-anchored hex-7 layout. Occam's razor: paper intends Earth-fixed cells + hopping (the standard treatment in sibling BH papers).
5. **Sibling LEO multi-beam papers all use Earth-fixed cells.** PAP-2020-BEAMHOP-DRL uses 37 hexagonal cells with K=10 active. PAP-2025-MAAC-BHPOWER uses 37 cells with K=8 active. PAP-2025-DIST-BH-HETERO uses 400 cells with K=4/sat active. PAP-2022-SENSORS-BH uses 12 active beams on Bessel J1/J3 pattern. PAP-2025-EEBH-UPLINK uses 144 cells with K=9 active. PAP-2026-BHFREQREUSE uses hex cells with 12 beams per satellite. PAP-2026-DRL-BHOPT uses 9-16 cells with 4-6 beams. The consistent pattern is **K active beams << N cells, hopping among cells**.
6. **User's angle-aware EE objective requires angle variation.** Per `modqn-paper-reproduction/docs/research/angle-aware-ee-multicatfish/01-v2.2-ee-objective-surface-sdd.md` §4.1-§4.3, the algorithm computes `g_bar = H * G_T(θ) * G_R` and `p_req = γ_req * (I + σ²) / g_bar` where θ is off-axis angle. The reward EE ∝ throughput / p_req(θ). In nadir-anchored hex-7, UEs sit near satellite nadir, so θ ≈ 0 and `G_T(θ) ≈ G_T(0)` — the angle-aware signal is essentially constant, and the algorithm cannot differentiate from baseline MODQN.

### 1.3 Why this SDD ships

The current reproducer geometry (nadir-anchored hex-7 from ASSUME-002) is:

- Inconsistent with paper's 100-UE-scattered intent (geometric coverage gap).
- Inconsistent with sibling-paper conventions (Earth-fixed cells + hopping).
- Functionally degenerate for the user's angle-aware EE-MODQN algorithm (θ ≈ 0 everywhere).
- Visually unconvincing to the user (handover invisible, beams translate not hop).

This SDD replaces ASSUME-MODQN-REP-002 with a paper-faithful **Earth-fixed cells + beam hopping + off-axis gain** environment that aligns with the paper's implicit intent, the sibling-paper conventions, and the user's algorithm differentiation requirements.

## 2. Producer-Truth Evidence

Direct quotes from the authoritative sources used to derive this SDD's claim that "the paper is silent on beam geometry":

### 2.1 Paper text (System Model, line 99-128)

> "Here we consider a multi-beam LEO satellite network in which a LEO
> constellation with L satellites serving I users, as shown in Fig.1. The set
> of LEO satellites is denoted as L = {1, 2, …, l, …, L}. Each satellite has V
> beams, the set of which is denoted as V = {1, 2, …, v, …, V}. […]
> κ = (l, v) ∈ K denotes the v-th beam of satellite l. […]
> ui,l,v(t) to express whether user i is connected with beam (l, v) or not."

The paper introduces beams only as enumerated indices. No geometric layout is given.

### 2.2 Paper text (Simulation, line 588-597)

> "We construct an LEO constellation based on System Tool Kit (STK), each
> satellite runs in the given orbit at a fixed speed. Multiple users are
> randomly distributed within a 200km×90km rectangular area centered on (40°N,
> 116°E), and each user's movement adopts the random wandering mode. […] the
> numbers of users and satellites are 100 and 4, and the speeds of the users
> and satellites are 30km/h and 7.4km/s."

The user area is specified (200×90 km, 100 users) but no beam pointing rule is given. The handover formula (4) only requires beam identity stability, not beam coordinates.

### 2.3 Catalog metadata

```json
"beamModel": {
  "type": "multi-beam (7 beams per satellite)",
  "beamsPerSatellite": 7,
  "beamPattern": "Not specified (no antenna pattern formula)",
  "bandwidthPerBeam_MHz": "500 / N_{l,v}(t) shared among users in beam",
  "frequencyReuse": "Not specified",
  "beamHopping": false,
  "notes": "Intra-satellite HO (beam switch) costs less than inter-satellite HO"
}
```

### 2.4 Reproducer ASSUME-MODQN-REP-002 (the choice being superseded)

```yaml
beam_geometry:
  assumption_id: ASSUME-MODQN-REP-002
  value:
    layout: hex-7
    center_beam: nadir
    ring_beam_count: 6
    ring_order: clockwise
    center_to_ring_spacing_rule: theta_3dB
    theta_3db_deg: 2.0
```

The `resolved_assumptions` key is the reproducer's filled-in convention. The SDD that introduced ASSUME-002 (under `modqn-paper-reproduction/docs/`) does not cite paper text for this choice. The choice is admittedly executable, not paper-mandated.

### 2.5 Conclusion

The paper authorizes us to choose any beam geometry that:

- Preserves Table I parameters (4 satellites, 7 beams per satellite, 100 users, 200×90 km user area, 780 km altitude, 20 GHz, 500 MHz, etc.).
- Preserves the handover formula (4) (intra φ₁ < inter φ₂, identity-based).
- Preserves the SNR formula (2) and channel gain formula (1) (with whatever distance computation matches the geometry).

We therefore CAN choose Earth-fixed cells + hopping without violating paper truth.

## 3. Related-Work Survey

LEO multi-beam papers that DO specify beam geometry consistently use Earth-fixed cells + hopping. Table compiled from `paper-source/catalog/` reading:

| Paper | beamPattern | numBeams active | numCells | beamwidth | Hopping |
|---|---|---:|---:|---:|---|
| PAP-2020-BEAMHOP-DRL | ITU-R S.672-4 | K=10 | N=37 | 0.56° | DVB-S2X frame |
| PAP-2025-MAAC-BHPOWER | main lobe = cell radius | K=8 | N=37 | n/a | dwell 2 ms |
| PAP-2025-DIST-BH-HETERO | n/a (G_T(φ), G_R(ψ)) | K=4/sat | N=400 | n/a | TDMA 640 ms frame |
| PAP-2022-SENSORS-BH | Bessel J1/J3 | K=12 | n/a | **2.06°** | enabled |
| PAP-2025-EEBH-UPLINK | Bessel (3GPP TR 38.811) | K=9 | N=144 | n/a | 32 ms period |
| PAP-2026-BHFREQREUSE | Bessel J1/J3 | 12/sat | hex cells | n/a | 1280 s period |
| PAP-2026-DRL-BHOPT | custom G_tx | 4-6 | N=9-16 | 1.16° | enabled |

**Key takeaways:**

- K active << N cells in 6 of 7 papers (PAP-2020/2025-DIST/2025-MAAC/2025-EEBH/2026-BHFREQ/2026-DRL-BHOPT).
- Bessel J1/J3 antenna pattern is the most common explicit choice (PAP-2022-SENSORS, PAP-2025-EEBH, PAP-2026-BHFREQ).
- 37-cell hex layout is the canonical PAP-2020 / PAP-2025-MAAC pattern (matches our 200×90 km / 480 km² per hex = 37.5 derivation, see §4.2).
- Beam hopping is treated as a deliberate scheduling mechanism, not a toggle.

## 4. Design Proposal

### 4.1 Cell Layout

37 Earth-fixed hexagonal cells covering 200×90 km user area centered at (40°N, 116°E).

- Each cell radius `r_cell ≈ 14 km`. From `r_cell = altitude_km × tan(θ_3dB / 2) = 780 × tan(1°) = 13.62 km` rounded.
- Cell area `A_cell = (3√3/2) × r_cell² ≈ 495 km²`. Within 200×90 km = 18 000 km² area: `N_cells ≈ 18 000 / 495 = 36.4 → N = 37`.
- Hex packing: 4 columns × ~9 rows (irregular at edges). Cell centers pre-computed in Earth-fixed lat/lon.

Cell positions are computed once at startup (deterministic, profile-derived). They do not change during the simulation.

### 4.2 Beam Behavior

Each satellite has 7 beams (paper Table I). Per slot, each satellite's beams are assigned to 7 cells via the cell scheduler (§4.4). The total active beams per slot is K = 4 × 7 = 28, serving 28 of 37 cells; 9 cells are idle per slot.

The beam pointing is determined by the scheduler's cell assignment, not by satellite-fixed offsets. As the satellite moves, the beam steers electronically (modeled via off-axis angle and slant range) to maintain pointing at its assigned cell.

For visualization (`leo-beam-sim`), this is rendered as:

- 37 hexagonal cell outlines on the ground (always visible, faint).
- 28 active cells highlighted per slot (color by serving satellite tint).
- Beam cones drawn from each satellite to its 7 active cells (one cone per beam-cell pair).
- Footprint ellipse on the active cell (long axis = `r_cell / sin(elevation_angle)` to model oblique projection).

### 4.3 Channel Gain Modification

The current channel gain formula (1) `G(i,l,v) = (ξ / (4π d fc))² × A(d) × η` becomes:

```text
G(i,l,v) = FSPL(d) × A(d) × η × G_T(θ_off_axis) × G_R
```

where:

- `d` = slant range from satellite `l` to user `i` (when user `i` is in cell served by beam `v`). Replaces nadir-distance.
- `FSPL(d) = (ξ / (4π d fc))²` (unchanged).
- `A(d)` = atmospheric fading (unchanged, paper formula).
- `η` = Rician small-scale fading (unchanged, paper formula).
- `G_T(θ_off_axis)` = transmit antenna gain at off-axis angle θ. Uses existing `profile.antenna.model = "bessel-j1-j3"` (PAP-2022-SENSORS / PAP-2025-EEBH precedent).
- `G_R` = receive antenna gain (currently 0 dBi per profile).

`θ_off_axis(l, v, i, t)` = angle between satellite `l`'s beam `v` boresight (pointing at its assigned cell center) and the line from `l` to user `i` (who is in the same cell). For users at cell center, θ ≈ 0. For users at cell edge, θ ≈ θ_3dB / 2 (-3 dB point). For users in adjacent cells, θ is large (mainlobe edge or first sidelobe).

This change makes the user's angle-aware EE algorithm signal non-trivial:

- Users with `g_bar = H × G_T(θ) × G_R` near the cell center → high g_bar → low p_req → high EE.
- Users at cell edge → moderate g_bar → moderate p_req.
- Beam hopping causes θ to vary over time for a fixed user (cell coverage rotates).
- This is the variation the user's algorithm targets.

### 4.4 Hopping Scheduler

The cell scheduler decides which 28 of 37 cells are served by which (satellite, beam) pair per slot. The MODQN policy continues to make per-user beam access decisions (paper formula); the scheduler is a separate system module.

**Default scheduler (initial implementation):** round-robin per cell.

- Each cell is served in rotation. With K = 28 active per slot and N = 37 cells, every cell is served `28/37 ≈ 0.76` of the time on average. Full coverage cycle is `lcm(37, 28) / 37 ≈ 28 slots` for a stable rotation.
- Constraint: each satellite serves at most 7 cells per slot.
- Constraint: cells served by satellite `l` must be visible (above 15° elevation) from `l` at the current slot.
- Tie-breaking: deterministic by cell ID + slot index hash.

**Future schedulers (out of scope for this SDD):**

- Density-weighted (cells with more UEs served preferentially).
- MODQN-controlled (the RL policy jointly learns scheduler + beam access; expands action space; deferred to a future sibling SDD).

The hopping scheduler is a NEW producer-side module (`src/modqn_paper_reproduction/runtime/cell_scheduler.py`) that emits per-slot cell-to-beam assignments. The leo-beam-sim consumer reads these assignments from the replay bundle or computes them locally from the same scheduler logic vendored under `src/engine/cells/`.

### 4.5 Off-axis Gain Function

Bessel J1/J3 pattern (PAP-2022-SENSORS / PAP-2025-EEBH precedent + matches existing profile `antenna.model = "bessel-j1-j3"`):

```text
G_T(θ) = G_T_max × η_aperture × |2 J_1(u) / u|² × (1 + ε × J_3(u)/u terms)
u = π × D_ant × sin(θ) / λ
```

The existing producer-side antenna gain calculator at `src/modqn_paper_reproduction/runtime/antenna_gain.py` (or its target path) already implements Bessel J1/J3. This SDD's contribution is to ensure `G_T(θ)` is evaluated at the runtime-computed off-axis angle, not at θ = 0.

### 4.6 Inter-/Intra-Handover Semantics

Paper formula (4) unchanged. Trigger conditions in this geometry:

- **Intra-HO (cost φ₁):** user `i` in cell `c`, served by satellite `l` beam `v_a` at slot `t`. Scheduler reassigns cell `c` to satellite `l` beam `v_b` at slot `t+1`. User remains in same cell, switches beams within the same satellite.
- **Intra-HO (cost φ₁) variant:** user `i` moves from cell `c_a` to cell `c_b` between slots (random wandering). Both cells served by satellite `l` (different beams). User effectively switches within `l`.
- **Inter-HO (cost φ₂):** cell `c` served by satellite `l_a` beam `v_a` at slot `t`. Scheduler reassigns cell `c` to satellite `l_b` beam `v_b` at slot `t+1`. User in cell `c` transitions to satellite `l_b`.
- **No HO:** user remains in same (satellite, beam) → 0 cost.

The cell scheduler is the new HO driver (in addition to user mobility). This significantly increases the per-slot HO event rate, matching paper's implied research utility ("frequent handovers" per paper Section I).

### 4.7 Footprint Projection

Visualization-only (does not affect SNR math which uses slant range directly):

- For each active cell `c` at slot `t`, serving satellite `l`:
  - Compute satellite-to-cell-center vector and elevation angle `ε` from cell at sat zenith.
  - Footprint long axis along sat-projection direction = `r_cell / sin(ε)`.
  - Footprint short axis perpendicular = `r_cell` (preserves cell width).
  - Render elliptical ring on ground plane (instead of circular).

This makes oblique-angle passes visibly distinct from overhead passes.

## 5. Cross-Repo Work Plan

### 5.1 Producer side (modqn-paper-reproduction)

| Module | Change | LOC est. |
|---|---|---|
| `src/modqn_paper_reproduction/runtime/cell_layout.py` (new) | Pre-compute 37 hex cell centers in Earth-fixed lat/lon for 200×90 km area at (40°N, 116°E). Deterministic. Cell visibility check (elevation > 15° per satellite). | ~150 |
| `src/modqn_paper_reproduction/runtime/cell_scheduler.py` (new) | Round-robin per-cell assignment of 28 active cells to 4 sat × 7 beam pairs per slot. Visibility constraint. Stable across seeds. | ~180 |
| `src/modqn_paper_reproduction/runtime/channel_gain.py` | Add `G_T(θ_off_axis)` to `channel_gain(i, l, v, t)`. `θ_off_axis` computed from sat position + cell center + user position. Slant range `d(i, l, v, t)` = sat-to-user distance when user in beam-`v`'s assigned cell, else `+∞` (invalid). | ~80 |
| `src/modqn_paper_reproduction/runtime/handover.py` | HO trigger detection now includes cell-reassignment events from scheduler, not just per-user policy decisions. Per-user serving = the (sat, beam) that serves the cell containing the user. Cost φ₁/φ₂ unchanged. | ~60 |
| `src/modqn_paper_reproduction/state/state_encoder.py` | State now includes per-slot cell schedule snapshot (28 active cells with their (sat, beam) pair). Access vector `u_i,l,v` decoded from "is user `i` in the cell served by (sat `l`, beam `v`)?". | ~100 |
| `configs/modqn-paper-baseline.realistic-cells.resolved.yaml` (new) | New config track replacing ASSUME-002 with Earth-fixed cells + hopping. `track.label = realistic-cells`. ASSUME-002 retired with audit note pointing here. | ~80 |
| `tests/test_cell_layout.py` (new) | 37-cell hex packing math, visibility checks, scheduler determinism. | ~150 |

Total producer-side LOC: ~800.

### 5.2 Consumer side (leo-beam-sim)

| Module | Change | LOC est. |
|---|---|---|
| `src/engine/cells/cellLayout.ts` (new) | Vendor producer's cell layout math. Deterministic 37-cell hex centers. | ~120 |
| `src/engine/cells/cellScheduler.ts` (new) | Vendor producer's round-robin scheduler. Same constraints. | ~150 |
| `src/scene/beam-geometry-pure.ts` | Replace nadir-anchored footprint calc with cell-pointing calc. Slant range from sat to cell center. Off-axis angle from beam boresight (cell-pointing) to user position. | ~100 |
| `src/scene/useBeamViz.ts` | Beam viz now reads cell schedule to determine each beam's target cell. Footprint becomes elliptical per cell elevation. | ~150 |
| `src/viz/CellOverlay.tsx` (new) | Render 37 hex cells on ground plane. 28 active highlighted (sat tint), 9 idle muted. | ~180 |
| `src/viz/SatelliteBeams.tsx` | Beam cone direction now from sat to assigned cell center, not nadir. Cone half-angle θ_3dB unchanged. | ~80 |
| `src/scene/handover-viz/IntraHandoverArrow.tsx` + `InterHandoverArrow.tsx` | Trigger on cell-reassignment events (in addition to existing per-user serving change). | ~80 |
| `src/profiles/modqn-4sat-7beam-paper-faithful.json` | Add `cells: { count: 37, layoutFile: "hex-37-200x90km.json" }` and remove `beamHopping.enabled = false` redundancy (hopping is now intrinsic). | ~40 |
| `scripts/validate-realistic-beam-geometry.tsx` (new) | Source-grep + SSR + cell-layout math + scheduler determinism + off-axis angle bounds. | ~250 |

Total consumer-side LOC: ~1150.

### 5.3 Re-training

- 9000 episodes × 7 weight rows × 3 seed triplets per `00-architecture-sdd.md` ablation methodology.
- Expected wall-clock 12-24 hr on Ubuntu server (per `~/.claude/CLAUDE.md` heavy-compute routing).
- Replay bundle regeneration: producer emits new `phase-03a-replay-bundle-v2` (versioned bump to reflect schema change — cell schedule fields added).
- Baseline MODQN, angle-aware EE-MODQN, W-HOBS ablation arms ALL re-trained on new environment for fair comparison.

### 5.4 Replay Bundle Schema Bump

`phase-03a-replay-bundle-v1` → `phase-03a-replay-bundle-v2`:

- Add `cellSchedule[slotIndex] = [{cellId, satId, beamIndex}, ...]` (length 28).
- Add `cellLayout` envelope-level field (deterministic 37-cell layout).
- Keep all existing fields (timeline rows, masks, rewards, satellite states, beam states).
- Per-row `satelliteStates[].activeCells = [cellId, ...]` (replaces beam-state cell-less semantics).

`leo-beam-sim` consumer:

- v1 bundles continue to load (legacy path uses nadir-anchored viz, flagged as "legacy ASSUME-002").
- v2 bundles use new cell-overlay viz.
- Phase 7C / Phase D validators bump to accept both schemas with explicit version field check.

## 6. Algorithm Leverage Analysis

### 6.1 Angle-aware EE-MODQN

User's algorithm (from `01-v2.2-ee-objective-surface-sdd.md`):

```text
g_bar = H × G_T(θ) × G_R
p_req = γ_req × (I + σ²) / g_bar
EE objective ~ throughput / p_req
```

In current nadir-anchored geometry: θ ≈ 0 for all UEs → `G_T(θ) ≈ G_T(0) = const` → `g_bar` varies only by `H` (path loss) → angle-aware signal is degenerate. Baseline MODQN's `r1 = throughput` covers most of this variation already. Algorithm advantage: minimal.

In Earth-fixed cells geometry: θ varies meaningfully:

- User at cell center: θ ≈ 0 → G_T near peak.
- User at cell edge: θ ≈ θ_3dB / 2 → G_T at -3 dB point.
- User in adjacent cell (off-axis to beam): θ ≈ θ_3dB → G_T -6 to -12 dB.
- Beam hopping moves the beam pointing, so θ for a given user oscillates as cell schedule rotates.

The angle-aware EE objective now has gradient: the algorithm learns to anticipate which (sat, beam) will have favorable θ for the user in the next slot, biasing decisions toward predictable high-EE assignments. Baseline MODQN's `r1` (throughput-only) reward does not see this gradient. Advantage: substantial.

### 6.2 Multi-Catfish

Catfish training mechanism (from `catfish/README.md` + `03-multicatfish-role-specialist-integration-sdd.md`):

1. Stratify experiences by quality criterion (originally EE).
2. Catfish agent specializes in high-value transitions.
3. Periodic intervention mixes catfish replay into main agent.

In current geometry: experiences are uniformly low-EE-variance because θ ≈ 0 → no high-vs-low EE stratification → catfish replay = main replay → mechanism degenerate.

In Earth-fixed cells geometry: high-value transitions are natural at cell-hopping boundaries (UE coverage transfers from sat-A beam-X to sat-B beam-Y; θ changes significantly; EE jumps). Catfish replay can stratify these. Multi-Catfish role specialists can target the three objectives' high-value transitions independently. Mechanism functional.

### 6.3 Fair Comparison

All algorithms (baseline MODQN, angle-aware EE-MODQN, W-HOBS ablation arms, future Multi-Catfish-MODQN) re-trained from scratch on the new environment under identical conditions:

- Same 9000 episodes × 7 weight rows × 3 seed triplets.
- Same cell layout + scheduler + channel gain modifications.
- Same evaluation seed set.

Comparison metric: same as paper (weighted reward + per-objective reward). The environment becomes more demanding for all algorithms; the question is which algorithm exploits the new structure better.

## 7. Phase Ordering (Per User Request)

**User explicitly directed: "viz first, backend re-train later".** Phases:

### Phase I (immediate): viz-side mock

- `leo-beam-sim` implements cell-overlay + elliptical footprint + hopping animation + cell-driven HO arc.
- SNR math continues to use nadir-anchored backend (mocked angle-aware viz, real angle-aware SNR deferred to Phase III).
- Replay bundles continue to be v1 (no cell schedule field).
- Cell-overlay viz read from local `cellLayout.ts` deterministic config.
- UI banner: "preview · realistic beam geometry · backend re-train pending".
- Expected delivery: 3-5 days, ~6-8 slices.

### Phase II (medium): producer Python implementation

- `modqn-paper-reproduction` adds cell_layout + cell_scheduler + channel_gain G_T(θ) + state encoder updates.
- Local unit tests pass.
- Dry-run on a small episode count (10-50 episodes) to confirm pipeline.
- No re-training yet.
- Expected delivery: 5-7 days, depends on producer-side worker availability.

### Phase III (heavy): re-training + bundle regen

- Server runs 9000 ep × 7 weights × 3 seeds for baseline + angle-aware EE + W-HOBS ablation arms.
- Replay bundle v2 emitted with cell schedule.
- leo-beam-sim consumer switches to read v2 bundle (real angle-aware SNR).
- Expected delivery: 12-24 hr server time + 1-2 days post-run review per `00-architecture-sdd.md` ablation protocol.

### Phase IV (validation): Multi-Catfish on new environment

- Once baseline + angle-aware EE are validated on the new environment, run Multi-Catfish role-specialist training.
- Compare against re-trained baseline + angle-aware EE.

Phases I-IV span ~2-3 weeks total. The user agreed: 推 1-2 週重訓 OK.

## 8. Validator Regression Matrix

Each phase ships its own validators. Phase I (viz mock) is the immediate target.

### Phase I validators (leo-beam-sim)

| Validator | Purpose | Min assertions |
|---|---|---|
| `validate:phase-i:s1-cell-layout-geometry` | 37-cell hex packing math, deterministic centers, coverage of 200×90 km. | 25 |
| `validate:phase-i:s2-cell-scheduler-determinism` | Round-robin scheduler stable across seeds, K=28 per slot, visibility constraint, no double-assignment. | 30 |
| `validate:phase-i:s3-elliptical-footprint-projection` | Footprint long axis = r_cell / sin(ε), short axis = r_cell, ε bounds 15°-90°. | 22 |
| `validate:phase-i:s4-hopping-animation` | Active cells change per slot, animation transitions, beam cones point at cell centers (not nadir). | 25 |
| `validate:phase-i:s5-cell-transition-handover` | Intra-HO fires on same-sat beam reassignment of a cell; inter-HO fires on cross-sat cell reassignment. | 28 |
| `validate:phase-i:s6-hud-cell-schedule-truth` | HUD truth chip shows "viz preview · backend SNR still nadir" until Phase III. | 18 |

### Phase II validators (modqn-paper-reproduction, Python)

| Validator | Purpose |
|---|---|
| `tests/test_cell_layout.py` | Cell math + visibility checks |
| `tests/test_cell_scheduler.py` | Determinism + constraint compliance |
| `tests/test_channel_gain_angle_aware.py` | `G_T(θ)` mathematics matches Bessel J1/J3 reference |
| `tests/test_handover_cell_driven.py` | Intra-HO + Inter-HO trigger correctness |

### Phase III validators (cross-repo)

| Validator | Purpose |
|---|---|
| `validate-realistic-beam-geometry-end-to-end` (new) | End-to-end producer→consumer replay bundle v2 round-trip |
| Existing 7 Phase H validators | Must continue to PASS or be updated with version-aware checks |
| Existing `validate-modqn-render-isolation` + `validate-modqn-phase7k-replay-scene-layer` | Update for v2 schema acceptance |

## 9. Acceptance Criteria

### Phase I (viz only)

1. Open modqn-demo. See 37 hexagonal cells outlined on the ground inside the 200×90 km user area.
2. See 28 cells highlighted (color-tinted by serving satellite) per slot. 9 cells muted/dim per slot.
3. See beam cones from each satellite pointing at its 7 assigned cells (not at nadir).
4. See cells "hop" — active set rotates every slot. Over 10 slots, all cells touched.
5. See elliptical footprints on cells at oblique angles (not circular).
6. See intra-HO arc when a cell's serving beam switches within the same satellite.
7. See inter-HO arc when a cell's serving satellite changes.
8. See HUD truth chip showing "viz preview · backend SNR nadir (Phase III pending)".
9. SINR-experiment tab unchanged.
10. Replay-loaded bundles (Phase B+D paper-faithful + user-trained) continue to load and render their existing scene without disruption.

### Phase II (producer Python)

1. `python -m modqn_paper_reproduction.cli train --config realistic-cells --episodes 10` runs without error.
2. Per-episode metrics (throughput, HO count, load balance) within expected ranges.
3. Replay bundle v2 emitted with cell schedule populated.
4. `python -m modqn_paper_reproduction.tests` all PASS.

### Phase III (re-training)

1. 9000 episodes × 7 weights × 3 seeds completes for baseline MODQN, angle-aware EE-MODQN, W-HOBS arms.
2. Final-episode policy snapshots saved.
3. Evaluation summary per `00-architecture-sdd.md` protocol.
4. Comparison plot: angle-aware EE vs baseline MODQN on new environment.

### Phase IV (Multi-Catfish)

1. 3-role Multi-Catfish-MODQN trained on new environment.
2. Catfish replay stratification operational (high-value transitions captured).
3. Comparison vs re-trained baseline + angle-aware EE.

## 10. Open Questions

1. **Cell scheduler ownership in MODQN state.** Should the scheduler's output (which 28 cells active this slot) be part of the MDP state observable by the MODQN policy? Current proposal: yes — state includes `cellSchedule[slot]`. Alternative: scheduler is environment-internal, MODQN sees only `Gamma(t)` (beam locations) as in paper. Decision deferred to Phase II implementation; user has final call.
2. **Density-weighted scheduler activation.** Should the default scheduler be round-robin or density-weighted? Phase I defaults to round-robin for simplicity; density-weighted reserved as a future ablation.
3. **DAPS / multi-connectivity hook.** Future Multi-Catfish + DAPS work may want users to access 2 cells simultaneously. Out of scope here; flagged for future SDD.
4. **Cell layout deterministic seed.** 37 hex packing has slight irregularity at 200×90 km rectangle edges. Use deterministic packing algorithm (e.g., row-major with apothem shift) with a documented seed.
5. **Visual altitude bump for scene.** Per user 2026-05-28 request: visual satellite altitude in NTPU_LARGE_CONFIG 380 → 600 world units (cosmetic only, does not affect math). Ship in Phase I.
6. **Beam hopping toggle from Phase H §4.4.** That toggle was a misnomer (Earth-fixed cells hopping is intrinsic, not toggleable). Phase H toggle UI ships as DEPRECATED in Phase I, removed in Phase III when v2 bundles arrive.
7. **PAP-2024-MORL-MULTIBEAM authors disclosure.** If we publish results based on this realistic geometry, we should clearly disclose that ASSUME-MODQN-REP-002 was the reproducer's assumption, paper was silent, and we replaced it with sibling-paper convention. This is a research contribution (identifying paper ambiguity), not a paper-fidelity violation.

## 11. Supersession Declarations

This SDD SUPERSEDES the following sections in other SDDs. The next session must respect these supersession rules to avoid drifting back to the old design.

### 11.1 `docs/modqn-training-truth-visualization-sdd.md`

- §3.1 "Profile Truth Available In `leo-beam-sim`" — the hex-7 nadir assumption (`theta3dB = 2 deg`, `center_beam: nadir`) is preserved as a value but its **semantic interpretation** changes from "nadir-anchored fixed hex grid" to "Earth-fixed cells with 2° beamwidth steering".
- §4.4 "Do not use SINR live-scene beam cones as MODQN training truth" — the constraint stays, but the interpretation of "live-scene beam cones" now includes cell-pointed beams (rendered from cell schedule). Replay path still does not invent producer-truth.
- §5 "Beamwidth And Coverage Standard" — the formula `radius_km = altitude_km × tan(theta3dB / 2)` is preserved but interpreted as cell radius, not nadir-anchored footprint.
- §7.5 "Beam Hopping" — the rule "Do not invent beam hopping" applies to v1 replay bundles; v2 bundles will carry producer-truth cell schedule and hopping animation is allowed.

### 11.2 `docs/modqn-visibility-fix-mini-sdd.md`

- Entire §2 (Producer Truth Anchors / Render Isolation) — superseded for beam geometry. The 4-plane Walker scripted-pass coverage hack is replaced by Earth-fixed cells; satellites no longer need scripted center-pass timing because cell schedule drives coverage regardless of satellite position (as long as cells are within elevation > 15°).
- `serviceAreaPassTargetsSec: [100, 400, 700, 1000]` becomes obsolete in Phase III. Phase I keeps it (live-sim runs alongside legacy nadir SNR until backend swap).

### 11.3 `docs/phase-h-live-sim-modqn-visual-parity-sdd.md`

- §4.4 "H-S4 — Beam Hopping Toggle (Live-Sim Only)" — SUPERSEDED. The toggle was a misnomer. Phase I removes the toggle UI (beam hopping is intrinsic to Earth-fixed cells, not toggleable).
- §4.5 "H-S5 — Walker Natural Propagation" — Phase H scope reduction was correct (4 polar sats can't continuously cover 40°N). Phase I + III address this differently: cell coverage drives the demo, not satellite trajectory; orbits can return to natural Walker without breaking coverage.
- §4.6 "H-S6 — 3D Inter-Satellite Handover Arc" — preserved but trigger condition updated to fire on cell reassignment, not satellite recent-HO ID change.
- §4.7 "H-S7 — Beam Material Tuning" — preserved as-is.
- §4.8 "H-S8 — Camera Preset Default + HUD" — preserved; HUD truth chip extended to show cell schedule state.

### 11.4 Memory entries

- `.agent-memory/MEMORY.md` "Active priority" must add a pointer to this SDD as TOP priority.
- `.agent-memory/project_paper_faithful_vision.md` — phase plan updated: Phase H' (this SDD) supersedes Phase H bigger redesign for beam geometry.
- `.agent-memory/project_modqn_demo_visibility_bug.md` — partially addressed by Phase I (cell coverage replaces single-sat scripted pass).
- `.agent-memory/project_phase_h_complete.md` — annotate that Phase H was a partial visual fix; Phase I provides the real geometry alignment.

## 12. Cross-References

- `paper-source/txt_all/2024_09_Handover_for_Multi-Beam_LEO_Satellite_Networks_A_Multi-Objective_Reinforcement_Learning_Method.txt` — paper full text.
- `paper-source/catalog/PAP-2024-MORL-MULTIBEAM.json` — paper metadata.
- `modqn-paper-reproduction/configs/modqn-paper-baseline.resolved-template.yaml` — ASSUME-MODQN-REP-002 to be retired.
- `modqn-paper-reproduction/configs/modqn-paper-baseline.realistic-cells.resolved.yaml` (new) — replacement config.
- `modqn-paper-reproduction/docs/research/angle-aware-ee-multicatfish/00-architecture-sdd.md` — algorithm architecture.
- `modqn-paper-reproduction/docs/research/angle-aware-ee-multicatfish/01-v2.2-ee-objective-surface-sdd.md` — `g_bar`, `p_req`, EE objective.
- `modqn-paper-reproduction/docs/research/angle-aware-ee-multicatfish/03-multicatfish-role-specialist-integration-sdd.md` — Multi-Catfish training plan.
- `catfish/README.md` — Catfish concept anchor.
- `docs/modqn-training-truth-visualization-sdd.md` — SUPERSEDED in scope per §11.1.
- `docs/modqn-visibility-fix-mini-sdd.md` — SUPERSEDED in scope per §11.2.
- `docs/phase-h-live-sim-modqn-visual-parity-sdd.md` — partially SUPERSEDED per §11.3.
- `~/.claude/CLAUDE.md` — worker-compute routing (heavy training on Ubuntu server).
- `CLAUDE.md` — repo boundary rules.
- Sibling LEO multi-beam BH paper catalog files: PAP-2020-BEAMHOP-DRL, PAP-2025-MAAC-BHPOWER, PAP-2025-DIST-BH-HETERO, PAP-2022-SENSORS-BH, PAP-2025-EEBH-UPLINK, PAP-2026-BHFREQREUSE, PAP-2026-DRL-BHOPT.
