# Research-to-Implementation Backlog for `leo-beam-sim`

## Purpose

- Turn the paper survey into an executable implementation order for `leo-beam-sim`.
- Map each major simulator capability to:
  - current files
  - recommended paper baseline
  - first formula version to implement
  - later upgrade papers
  - acceptance criteria
- Keep the first working simulator grounded in deterministic, explainable baselines before adding AI policies.

## Current Codebase Snapshot

| Area | Current files | Current status | Main gap vs. papers |
|---|---|---|---|
| Profile system | `src/profiles/types.ts`, `src/profiles/hobs-2024-paper-default.json`, `src/profiles/hobs-2024-candidate-rich.json` | Multi-shell Walker profiles, `profileClass`, beam-hopping config already exist | Only HOBS-derived profiles are present; no MCCHO / DAPS / SMASH / MADQN paper-default profiles |
| Orbit engine | `src/engine/orbit/*` | Walker-shell propagation and observer-topocentric geometry already exist | No TLE / ephemeris ingestion path yet |
| Signal engine | `src/engine/signal/beam-gain.ts`, `path-loss.ts`, `link-budget.ts` | Beam gain and link budget are already in the core path | No paper-switchable channel family matrix yet: 3GPP NTN loss stack, Rayleigh, Loo, uplink EE model, RSMA composite links |
| Handover engine | `src/engine/handover/types.ts`, `handover-manager.ts` | Deterministic `sinr-offset` handover with pending target and intra-switch dwell already exists | No dual-connectivity / DAPS state, no packet duplication, no `secondary` / `prepared` roles, no soft-HO mode |
| Simulation truth path | `src/scene/useSimulation.ts` | `beamHopping`, active-beam restriction, and handover inputs are already owned by simulation truth | Missing explicit energy state, DAPS execution state, and research KPI registry |
| Visualization path | `src/scene/useBeamViz.ts`, `src/ui/InfoPanel.tsx`, `src/viz/*` | Beam and handover display pipeline already exists | Needs clearer research-state panels: DAPS, energy, scheduler reasons, blocked-by-inactive-beam vs blocked-by-energy |
| Beam hopping | `src/scene/useSimulation.ts`, `src/profiles/types.ts` | Deterministic rule-based scheduler already exists | No traffic-aware, queue-aware, or power-coupled scheduler modes yet |
| AI / policy layer | none | No explicit policy adapter yet | No offline inference hook for DQN / QMIX / PPO paper policies |
| Validation | docs only | Manual SDD acceptance exists conceptually | No paper-level regression scenarios or formula-check test cases |

## Recommended Build Order

1. Harden the deterministic baseline around `MCCHO-CORE`.
2. Add explicit `DAPS-CORE` state semantics on top of that baseline.
3. Add `HOBS` interference-aware multi-beam SINR and beam switching as the main downlink research profile.
4. Add `SMASH-MADQL` energy state and realistic 3GPP NTN loss stack.
5. Upgrade beam hopping from rule-based to paper-driven modes using `EEBH-UPLINK`, `MAAC-BHPOWER`, `QMIXBH`, and `BHFREQREUSE`.
6. Only after the simulator is stable and explainable, add offline policy adapters for `MADQN`, `MADRL`, `QMIX`, and `PPO`.

## Module-to-Paper Mapping

| Module | Current files | First paper baseline | First formula version | Later upgrade papers |
|---|---|---|---|---|
| Orbit engine | `src/engine/orbit/*` | `PAP-2024-MCCHO-CORE` | Simple Walker / circular-orbit replay with explicit slant range in the signal layer | `PAP-2025-DAPS-CORE` for TLE-like motion, `PAP-2025-SMASH-MADQL` for large constellations |
| Signal engine | `src/engine/signal/*` | `PAP-2024-HOBS` + `PAP-2024-MCCHO-CORE` | HOBS downlink SINR + Bessel gain + MCCHO path-loss / elevation dependence | `PAP-2025-SMASH-MADQL`, `PAP-2025-EEBH-UPLINK`, `PAP-2025-RSMA`, `PAP-2026-BHFREQREUSE` |
| Handover engine | `src/engine/handover/*` | `PAP-2024-MCCHO-CORE` | Conditional inter-satellite HO with overlap / pending-target logic | `PAP-2025-DAPS-CORE`, `PAP-2025-RSMA`, `PAP-2025-MADQN-MULTIBEAM` |
| DAPS / dual-connectivity | new `src/engine/handover/daps-*` or extend existing manager | `PAP-2025-DAPS-CORE` | Effective-rate and interruption-time model with packet duplication | `PAP-2024-MCCHO-CORE`, `PAP-2025-RSMA` |
| Energy engine | new `src/engine/energy/*` | `PAP-2025-SMASH-MADQL` | Satellite energy state, energy blocking, simple solar/shadow phase | `PAP-2024-HOBS`, `PAP-2025-EEBH-UPLINK` |
| Beam hopping scheduler | `src/scene/useSimulation.ts` and new scheduler helpers | Current deterministic rule-based mode, then `PAP-2024-HOBS` | Active-beam truth gating and deterministic slot schedule | `PAP-2024-QMIXBH`, `PAP-2025-EEBH-UPLINK`, `PAP-2025-MAAC-BHPOWER`, `PAP-2026-BHFREQREUSE` |
| AI policy adapter | new `src/engine/policy/*` | `PAP-2025-MADQN-MULTIBEAM` | Offline action-provider interface, not in-browser training | `PAP-2024-MADRL-CORE`, `PAP-2024-QMIXBH`, `PAP-2026-BHFREQREUSE` |
| Validation harness | new docs / test helpers | `PAP-2024-MCCHO-CORE` + `PAP-2024-HOBS` | Deterministic regression scenarios and formula snapshot tests | All later papers |

## Phase Backlog

### Phase 0: Research Profile Governance

- Goal: make paper selection explicit in the simulator before adding more physics.
- Primary files:
  - `src/profiles/index.ts`
  - `src/profiles/types.ts`
  - `src/ui/ControlBar.tsx`
  - `src/ui/InfoPanel.tsx`
- Deliverables:
  - Add profile metadata so the UI can show `paper`, `profileClass`, and `formula family`.
  - Add profile picker entries for future paper-default variants.
  - Add a small research/debug panel that shows current profile, scheduler, and handover policy.
- Acceptance:
  - The current HOBS profiles remain unchanged in behavior.
  - The simulator can label which paper family is active without reading source code.

### Phase 1: `MCCHO-CORE` Deterministic Baseline

- Goal: make `MCCHO-CORE` the first explicit paper-faithful baseline for conditional handover.
- Primary files:
  - `src/profiles/mccho-2024-paper-default.json` (new)
  - `src/engine/signal/path-loss.ts`
  - `src/engine/signal/link-budget.ts`
  - `src/engine/handover/handover-manager.ts`
  - `src/engine/handover/types.ts`
  - `src/ui/InfoPanel.tsx`
- Formula version 1:
  - `R_UE = EIRP - PL_total`
  - `SINR = R_serving / (sum R_interferer + N_0)`
  - `d(alpha) = sqrt(R_E^2 sin^2(alpha) + h_0^2 + 2 h_0 R_E) - R_E sin(alpha)`
  - `SC-HO`: target distance better than serving distance by offset
  - `MC-HO`: both source and target within overlap region
- Acceptance:
  - The UI can show `serving`, `pending target`, and `overlap-qualified` target separately.
  - Inter-satellite HO is reproducible under the same replay seed and config.
  - A no-DAPS baseline can be compared against later DAPS mode with the same orbit and signal setup.

### Phase 2: `DAPS-CORE` Dual-Connectivity and Packet Duplication

- Goal: extend the current single-serving-state model into a DAPS-capable state machine.
- Primary files:
  - `src/engine/handover/types.ts`
  - `src/engine/handover/handover-manager.ts`
  - `src/scene/types.ts`
  - `src/scene/useSimulation.ts`
  - `src/ui/InfoPanel.tsx`
  - `src/viz/HandoverLinks.tsx`
- New state concepts:
  - `source`
  - `target`
  - `prepared`
  - `dual-active`
  - `path-switched`
- Formula version 1:
  - `R_effective = (1 - beta) R_source + R_target`
  - DAPS feasibility guard: `T_DAPS <= T_HIT`
  - Simplified duplicate-packet ratio `beta` exposed as a runtime / profile parameter first
- Acceptance:
  - DAPS enabled and disabled modes are switchable on the same profile.
  - DAPS mode avoids service interruption in cases where classic HO drops service.
  - The UI exposes duplicate-packet / dual-active status rather than only a single serving beam.

### Phase 3: `HOBS` Multi-Beam Downlink Truth Path

- Goal: make HOBS the main downlink research profile for multi-beam interference and beam switching.
- Primary files:
  - `src/profiles/hobs-2024-paper-default.json`
  - `src/engine/signal/beam-gain.ts`
  - `src/engine/signal/link-budget.ts`
  - `src/scene/useSimulation.ts`
  - `src/ui/InfoPanel.tsx`
- Formula version 1:
  - `gamma = P H G_T G_R a / (I_intra + I_inter + sigma^2)`
  - `E_eff = R_tot / sum P`
  - Dynamic power-control heuristic from HOBS, but exposed first as a toggleable simplified rule
- Acceptance:
  - Intra-satellite beam switch and inter-satellite HO are both visible in one scenario.
  - Active-beam restriction changes SINR and serviceability in a deterministic way.
  - The simulator can explain whether a service drop came from low SINR, inactive beam, or handover timing.

### Phase 4: Energy State and NTN Channel Realism

- Goal: add a real energy-aware system state instead of only reporting SINR and HO.
- Primary files:
  - `src/engine/energy/*` (new)
  - `src/engine/signal/path-loss.ts`
  - `src/engine/signal/link-budget.ts`
  - `src/scene/useSimulation.ts`
  - `src/ui/InfoPanel.tsx`
- First paper baseline: `PAP-2025-SMASH-MADQL`
- Formula version 1:
  - Satellite energy budget and energy blocking condition from SMASH
  - 3GPP NTN loss stack `PL_FS + PL_SH + PL_C + PL_A + PL_SC`
  - Minimum elevation threshold as a first-class profile parameter
- Upgrade path:
  - `PAP-2024-HOBS` for energy-efficiency reporting
  - `PAP-2025-EEBH-UPLINK` for uplink weighted-sum EE
- Acceptance:
  - Satellites can become unavailable due to energy state, not only geometry.
  - The UI can distinguish `blocked by energy`, `blocked by elevation`, and `blocked by inactive beam`.

### Phase 5: Beam-Hopping Scheduler Upgrade Path

- Goal: separate scheduler sophistication levels instead of keeping only one generic rule-based scheduler.
- Primary files:
  - `src/scene/useSimulation.ts`
  - `src/profiles/types.ts`
  - `src/ui/InfoPanel.tsx`
  - `src/ui/ControlBar.tsx`
  - new `src/engine/scheduler/*`
- Scheduler levels:
  - `deterministic-baseline`: existing round-robin / distance-priority
  - `hobs-inspired`: priority for the currently serving / pending / recent HO beams
  - `traffic-aware`: queue / demand-weighted beam activation
  - `policy-driven`: offline policy output drives active-beam selection
- Upgrade papers:
  - `PAP-2024-QMIXBH`
  - `PAP-2025-EEBH-UPLINK`
  - `PAP-2025-MAAC-BHPOWER`
  - `PAP-2026-BHFREQREUSE`
- Acceptance:
  - Scheduler decisions are visible and explainable per slot.
  - The handover manager never selects an inactive beam.
  - Changing scheduler mode changes service outcomes without breaking replay determinism.

### Phase 6: AI Policy Adapter, Not Browser Training

- Goal: allow paper-inspired decisions without embedding RL training inside the website.
- Primary files:
  - new `src/engine/policy/*`
  - `src/scene/useSimulation.ts`
  - `src/profiles/types.ts`
  - `src/ui/ControlBar.tsx`
- First policy shape:
  - load or compute action scores from a deterministic adapter
  - support at least `beam-select`, `sat-select`, and `beam-hop-slot action` outputs
- Recommended paper order:
  - `PAP-2025-MADQN-MULTIBEAM`
  - `PAP-2024-MADRL-CORE`
  - `PAP-2024-QMIXBH`
  - `PAP-2026-BHFREQREUSE`
- Acceptance:
  - Policy mode can be turned on or off without changing the rest of the simulator.
  - Deterministic replays remain deterministic under the same action trace.

### Phase 7: Optional TLE / Ephemeris Ingest

- Goal: support papers that depend on real orbit traces.
- Primary files:
  - `src/engine/orbit/*`
  - `src/profiles/types.ts`
  - `src/profiles/*`
- First paper driver: `PAP-2025-DAPS-CORE`
- Notes:
  - This should come after the simulator has a stable synthetic-constellation baseline.
  - Use TLE as an additional orbit source, not a replacement for the existing Walker-shell path.
- Acceptance:
  - The same handover / signal / scheduler stack can run on either Walker or TLE sources.

## Which Formula Version Should Be Implemented First

| Capability | First formula choice | Why |
|---|---|---|
| Slant range + elevation-aware baseline | `PAP-2024-MCCHO-CORE` | Explicit, simple, and already aligned with current deterministic handover structure |
| Multi-beam downlink SINR | `PAP-2024-HOBS` | Best match for `beam configuration + HO + EE` |
| DAPS / dual-active execution | `PAP-2025-DAPS-CORE` | Explicit state stages and simplest effective-rate formula |
| Energy state | `PAP-2025-SMASH-MADQL` | Cleanest explicit energy-blocking model |
| Uplink EE extension | `PAP-2025-EEBH-UPLINK` | Strongest explicit EE objective, but uplink-specific, so not phase 1 |
| BH + power allocation | `PAP-2025-MAAC-BHPOWER` | Simpler than `BHFREQREUSE` for an early power-aware BH module |
| Advanced multibeam resource coupling | `PAP-2026-BHFREQREUSE` | Best later-stage paper for joint BH + FR + power + HO |
| Soft backup-link HO | `PAP-2025-RSMA` | Architecturally valuable, but optimization is too heavy for early browser implementation |

## Profile Backlog

- `mccho-2024-paper-default.json`
- `daps-2025-paper-default.json`
- `smash-2025-paper-default.json`
- `madqn-2025-multibeam-paper-default.json`
- `qmixbh-2024-paper-default.json`
- `bhfreqreuse-2026-paper-default.json`
- `eebh-uplink-2025-paper-default.json`

## Validation Backlog

- Add formula snapshot tests for:
  - slant range
  - off-axis beam gain
  - path loss
  - single-link SINR / SNR
  - DAPS effective rate
  - energy blocking condition
- Add deterministic replay scenarios for:
  - no-HO stable pass
  - MCCHO overlap-triggered HO
  - DAPS vs classic HO interruption comparison
  - HOBS beam-switch + inter-satellite HO
  - energy-blocked candidate rejection
- Add UI acceptance checklist:
  - serving / pending / dual-active / recent-HO states readable
  - blocked reason readable
  - active-beam vs inactive-beam distinction readable

## Explicit Non-Goals for the First Working Version

- No in-browser RL training loop.
- No full 5G core signaling reproduction.
- No exact RSMA convex optimization in the browser.
- No forced TLE dependency in the first deterministic baseline.
- No attempt to make every paper's simulator numerically identical before the core state model is stable.
