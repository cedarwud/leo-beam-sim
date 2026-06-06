# Baseline MODQN — Producer Data Defects Report

**For:** the `modqn-paper-reproduction` maintainer / agent
**From:** `leo-beam-sim` consumer-side investigation
**Date:** 2026-06-06
**Subject artifact:** `modqn-paper-reproduction/artifacts/visual-showcase-v1-baseline-89s-2026-06-03/visual-showcase-v1.json`
**Status:** read-only investigation. No producer code was modified (leo cannot edit
`modqn-paper-reproduction` per repo policy). All fixes below are producer-side.

---

## TL;DR

The frozen 89s baseline `visual-showcase-v1` artifact is **degenerate** and cannot
demonstrate MODQN's multi-objective multi-beam handover behavior:

- **100 UEs spread over ~93 × 85 km are ALL served by a single beam (sat-0-beam-1).**
- **0 handovers** across 89s (the 82 "handover" events are `beam-1 → beam-1` non-switches).
- **Candidate SINR is identical across all 7 beams** of a satellite (0.000 dB spread, 9000/9000 frames).
- **Only 1 satellite is ever visible** → 0 inter-satellite handovers are even possible.
- `selectedActionIndex = 1` for **all 9000 decisions**; **0 / 100 UEs ever change action.**

**The MODQN RL code/training is NOT crashed** (true 3-DQN architecture; training
converged: final scalar reward 602.8, eval mean 52.3 ± 0.16 over 5 seeds). The
defects are in the **environment channel model, the reward scaling, and the
showcase scenario** — plus one **export-omission** that drops data that already
exists. Four defects + one export gap below, in dependency order.

---

## Defect 1 — Environment has NO spatial per-beam assignment (CRITICAL, root cause)

100 UEs spread over a wide area collapse onto one beam because **UE position has no
effect on which beam serves it.**

Measured from the artifact (`timeline[5]`):
- UE spread: **93.4 km (lat) × 85.1 km (lon)**, 100 UEs (consistent with the intended ~200×90 km scatter).
- The 7 beams of sat-0 ARE spatially distinct (hexagonal, `footprintKm ≈ 27.2` each):
  `beam-0 (0.356,0.000) · beam-1 (0.601,0.000) · beam-2 (0.478,0.212) · beam-3 (0.233,0.212) · beam-4 (0.111,0.000) · beam-5 (0.233,-0.212) · beam-6 (0.478,-0.212)` (lat,lon °).
- **IF UEs were assigned to the nearest beam by position**, they would distribute as
  `{beam-4: 49, beam-3: 21, beam-5: 19, beam-0: 10, beam-2: 1}` (5 beams used).
- **ACTUAL serving distribution: `{beam-1: 100}`** — and beam-1 sits at lat 0.601
  (the far edge), while the UE cloud is centered near lat 0, so geometrically beam-1
  should serve **almost nobody**, yet it serves all 100.

**Root cause (shared with Defect 2):** the artifact runs the env's STATIC
power-surface path (`hobs_power_surface_mode = 'static-config'`). On that path,
`env/step.py:681-682` broadcasts ONE per-satellite scalar `ch.snr_linear` to all
K=7 beams; the per-beam gain branch (`step.py:684-716`, `channel_gain_per_beam`)
runs only on the non-static, `antenna_gain_enabled` path. With no per-beam antenna
pattern `G_T(θ)` and no UE-to-beam off-axis angle, all 7 beams are identical to
every UE → the env/policy has no spatial basis to assign UEs to beams → everyone
defaults to beam-1.

**Fix:** run the non-static HOBS power surface with a real per-beam antenna pattern
(per-beam boresight + `G0` + `θ_3dB`) so each beam's gain toward a UE depends on the
UE's off-axis angle → UEs distribute across beams by position.

---

## Defect 2 — Channel is SNR (no interference), flat across beams, implausibly low

- **No interference term:** `_apply_intra_satellite_sinr_interference` (`step.py:1195-1267`)
  is gated off at `step.py:720-722`; `sinr_intra_satellite_interference` defaults
  False (`step_types.py:215`) and is **validation-forbidden in static-config mode**
  (`step_types.py:381-385`). The artifact labels it `truthOwnership.sinr.channelMetricKind
  = 'snr-no-interference'`. → it is **SNR, not SINR.**
- **Flat across beams:** one scalar SNR per satellite is replicated to all 7 candidate
  beams → `ues[*].candidateSinrDbByBeamId` has 0.000 dB spread across all 9000 frames.
- **No per-beam gain truth** → `entities.beams[*].gainDb = null` (all 28). (Correctly
  not fabricated.)
- **Implausibly low magnitude:** `zenith_snr_db = -56.1 dB` and
  `zenith_throughput_bps = 1754` (1.75 kbps) at 20 GHz. A real LEO link should be
  positive SNR / Mbps–Gbps. The budget appears to omit Tx/Rx antenna gain →
  **likely a link-budget / units issue worth auditing** (`channel.py:353`
  `channel_gain = FSPL · A(d) · η`, no beam-direction term).

**Fix:** enable intra-satellite interference (needs >1 active beam per satellite) so
`SINR = desired / (I_intra + N0)`, and audit the link budget so zenith SNR/throughput
are physically plausible. Combined with Defect 1's per-beam gain, candidates will
finally differ.

---

## Defect 3 — Reward-scale dominance (your own diagnostic already flags it)

`bundle/evaluation/summary.json → replay_timeline.diagnostics.dominance_warnings`:

> `DOMINANCE WARNING: reward scale ratio is 982.6x (>100x threshold). r1_abs=4.91e+02, r2_abs=5.0e-01, r3_abs=1.75e+01.`

- r1 (throughput) ≈ 491, r2 (handover) ≈ 0.5, r3 (load) ≈ 17.5 → **r1/r2 = 982×.**
- The scalarized reward `0.5·r1 + 0.3·r2 + 0.2·r3` is **dominated by throughput**;
  the handover and load-balance objectives are numerically negligible.
- → MODQN's "multi-objective" behavior collapses toward single-objective
  (throughput). Even on a good scenario, the handover/load trade-off won't be visible
  — and the planned ω-slider demo (drag weights → decisions change) will barely move,
  because r2/r3 are too small to flip an argmax.

**Fix:** normalize r1/r2/r3 to comparable scales (per-objective normalization or
reward shaping) so the weighted trade-off is real.

---

## Defect 4 — Showcase scenario is degenerate + OOD-extrapolated

From `bundle/config-resolved.json`:
- `orbital_planes = 1`, `satellites_per_plane = 4`, `in_plane_spacing_deg = 90` →
  the 4 satellites are 90° apart on a single plane, so **only 1 is ever visible** →
  **0 inter-satellite handovers possible** (confirmed: 0 inter in the artifact).
- `episode_duration_s = 10` but the showcase replay is extended to **89s**
  (`modqn-export --replay-slot-count 90`) → slots 11–90 are **OOD extrapolation** of
  a 10s-trained policy. (Other export windows start=1010/1054/1064 were also tried;
  all degenerate — it is the run, not the window.)
- `topology_handling_strategy = per-topology-retrain` → a denser constellation
  requires retraining, not just re-export.

Result: `selectedActionIndex = 1` for all 9000 decisions; 0/100 UEs ever change
action; serving never changes (holds=8900, switches=0).

**Fix:** denser constellation (multiple planes / more simultaneously-visible
satellites) + UEs spread so multiple beams/satellites are real candidates → real
intra- AND inter-satellite handovers. Retrain on the new topology.

---

## Export gap (NOT a defect, but blocks the consumer story) — per-objective Q dropped

The consumer wants to display, per candidate beam, the **3 per-objective Q-values
(Q1 throughput / Q2 handover / Q3 load) and the ω-weighted result** — the literal
core of MODQN — and to drive a counterfactual ω-slider. **These values are REAL and
already computed; they are just not in the visual-showcase export.**

- True multi-objective DQN: `algorithms/modqn.py:112` =
  `self.q_nets = nn.ModuleList([DQNNetwork(...) for _ in range(3)])` (3 separate
  networks, each own optimizer + per-objective reward target). `_predict_objective_q_values`
  (`modqn.py:234-243`) returns 3 dense Q vectors per step; the docstring states
  "Three parallel DQNs … Scalarized action selection with weight row **at decision
  time**." Each Q_i is TD-trained on its OWN per-objective reward `rewards[:,obj_idx]`
  (`modqn.py:750-770`); ω enters ONLY at decision-time scalarization
  (`_scalarize_q_values`) and metric logging, NEVER in the loss. → ω is a pure
  decision-time knob; a single trained model serves any ω with no retrain. (This is
  the paper's contribution vs the `DQN_scalar` comparator, which retrains per weight
  row.)
- The producer ALREADY builds `objectiveQ = [Q1,Q2,Q3]` triplets, but only for the
  **top-k** candidates (`modqn.py:600-633`), serialized to the **replay-bundle's**
  `policyDiagnostics.topCandidates[*].objectiveQ` (`bundle/serializers.py:251-254`).
- **The visual-showcase exporter drops them** — `visual_showcase_exporter.py`
  `_decision_fields` (≈:436-468) emits only the scalarized dense `actionScores`
  (`actionScoreKind = 'full-dense-scalarized-q-vector'`). The pinned artifact's 9000
  `decisionFrames` contain no `objectiveQ` / `topCandidates` / dense per-objective Q.

**Fix (LIGHT, no retrain) — and note the requirement is stricter than top-k:** to let
the consumer reproduce the policy's argmax for ANY ω (the counterfactual ω-slider),
export, per decision frame, the **FULL DENSE per-objective Q vector over all actions
(Q1[a], Q2[a], Q3[a]) + the exact action validity mask + the invalid-action sentinel
+ the producer's tie-break order**. Top-k objectiveQ is NOT sufficient — a different
ω can promote an action outside the original top-k, so the consumer would miss the
true argmax. Also export the **MODQN-vs-baseline KPI** (handovers / throughput / load
distribution) for the outcome scoreboard.

---

## What is NOT broken

- The MODQN RL architecture and training are sound (3-DQN multi-objective; converged,
  low-variance eval).
- The visual-showcase exporter is a faithful pass-through — it does not corrupt data;
  it just forwards the upstream env's flat channel truth and the already-scalarized Q.
- `leo-beam-sim` (the consumer) is fine; it only displays. No leo change fixes any of
  the above.

---

## Recommended fix order + compute routing

| # | Fix | Repo area | Compute |
|---|---|---|---|
| 1 | Spatial per-beam assignment + per-beam antenna pattern (non-static HOBS path) | env / channel | retrain → **HEAVY (server)** |
| 2 | Enable intra-sat interference + audit link budget (zenith −56 dB / 1.75 kbps) | env / channel | with #1 → **HEAVY (server)** |
| 3 | Normalize r1/r2/r3 reward scales (kill the 982× dominance) | reward | retrain → **HEAVY (server)** |
| 4 | Denser constellation (multi-plane / >1 visible sat) + spread UEs | scenario config | retrain/re-eval → **HEAVY (server)** |
| 5 | Export FULL DENSE per-objective Q + mask + tie order into visual-showcase decision frames; export MODQN-vs-baseline KPI | export | re-export → **LIGHT (in-env)** |
| 6 | Re-validate: `ntn-sim-core npm run validate:visual-showcase:artifact` | validation | LIGHT |

Then the consumer (`leo-beam-sim`) can build the handover "cinema" + counterfactual
ω-slider: per handover → slow-motion + camera focus, highlight the real candidate
beams/satellites, show each candidate's Q1/Q2/Q3 + ω-weighted score + the winner, and
let the viewer drag ω to see the decision re-rank — all from real trained-network
output.

---

## Evidence appendix (key file:line)

- `env/step.py:681-682` — one per-sat SNR broadcast to all K beams (flat candidate SINR).
- `env/step.py:684-716` — per-beam gain branch only on non-static / antenna_gain path.
- `env/step.py:720-722`, `step_types.py:215, 381-385` — interference gated off / forbidden in static-config.
- `channel.py:353` — `channel_gain = FSPL · A(d) · η` (per-sat slant range, no beam-direction term).
- `algorithms/modqn.py:112, 234-243, 245-268` — 3-DQN multi-objective + scalarize + argmax.
- `algorithms/modqn.py:750-770` — per-objective TD update on `rewards[:,obj_idx]` (ω not in loss).
- `algorithms/modqn.py:600-633` — objectiveQ [Q1,Q2,Q3] for top-k candidates only.
- `bundle/serializers.py:209-225` — candidate SNR dB from `channel_quality`; `:251-254` objectiveQ on policyDiagnostics; `:130-206` scalarized-only dense vector.
- `export/visual_showcase_exporter.py` `_decision_fields` (≈:436-468) — scalarized-only emit.
- `bundle/evaluation/summary.json` — dominance_warnings (982×), eval/training summary, replay diagnostics (zenith_snr_db −56.1, throughput 1754 bps).
- `bundle/config-resolved.json` — orbital_planes=1, sats_per_plane=4, 90°, 100 UEs, episode_duration_s=10, per-topology-retrain.
- Artifact scan: `selectedActionIndex=1` ×9000; serving `{beam-1:100}` all 90 slots; 0/100 UEs change; candidate-SINR spread 0.000 dB ×9000; 82 `handover-intra` events all `[ue-X, sat-0, sat-0-beam-1]`.
