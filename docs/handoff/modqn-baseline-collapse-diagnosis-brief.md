# MODQN Baseline-Collapse Diagnosis Brief (leo-side, producer-facing)

- **Date:** 2026-06-15
- **Author scope:** `leo-beam-sim` (consumer). This is a **read-only artifact
  diagnosis** done from the producer artifacts staged for leo. It does NOT edit
  or retrain anything in `modqn-paper-reproduction` (CLAUDE.md §5 #1 / §2.boundary).
- **Producer-side owner of the real fix:** `modqn-paper-reproduction`
  (`fable/handoff-baseline-collapse-diagnosis.md`). This brief feeds that file.
- **Why it exists:** the user asked whether the MODQN beam-collapse is a basic,
  well-solved problem and whether it can be validated locally without a long
  server training run. This records the evidence-checked answer so a future
  session does not re-derive it (and does not repeat the wrong first guess).

> **🟥 STATUS (2026-06-16): DEFINITIVE (Phase 1) — the paper's MODQN baseline does NOT reproduce, in the
> paper's OWN clean simple env.** A fresh paper env (4-sat / 7-beam / SNR / no-interference, frozen
> `algorithms/modqn.py` byte-unchanged, Table-I params, 9000 ep, BOTH [0.5,0.3,0.2] and [1,1,1]) →
> **COLLAPSED** (`active_beam_count_mean=1.0`, `modal_frac=1.0` every ckpt; achieved Σr1≈0.9 vs paper
> Table II ≈33). The paper's Σr1≈33 = the **exploratory/random** level (ε=1→r1≈32.5, monotonic decay to
> ~2 at ε=0.01); the learned greedy policy is **worse than random**. **Root cause = the LETTER's own
> formulation** (shared-policy net + homogeneous users + global-only load N(t) + simultaneous assignment →
> identical per-user argmax → one beam): an UNTRAINED net already collapses; widening the user area breaks
> it (#unique beams 1→2→7 at 200×90→4000²→10000² km); training saturates the first tanh layer 98–99%
> (cross-user Q dispersion→0). **Ruled out: NOT a modqn.py bug, NOT reward-direction, NOT encoder-saturation.**
> → reward-direction hypothesis (mine) DEAD; shared-policy-homogenization (fable) CONFIRMED + cleanly
> localized to the letter (ALL Family-B confounds — Cap25/SINR/EE/28-beam — ruled out). The letter omits the
> symmetry-breaker (plausibly real STK per-user geometry / per-agent nets / sequential assignment /
> eval-under-exploration). **This is a reproducibility finding — NOT the user's env or implementation.**
> Committed `91c4723`; report `docs/research/paper-baseline-modqn-phase1-verdict.md`; code `paper_baseline/`.
> Thesis implication: reframe around "diagnose + FIX the published collapse" (stronger than "beat a working
> baseline"); the repo's step3-cause-ablation already found escape arms (active_beam 2.5–7). The Arm-0a note
> below (throughput on Family-B) is now subsumed by this stronger clean-env result.
>
> **🔴 (superseded by Phase 1 above) STATUS: HYPOTHESIS REFUTED by the Arm-0a training run.** Flipping r1→throughput
> on the Family-B env (3000 ep, seed 42) **STILL COLLAPSED**: `active_beam_count_mean=1.0`,
> `modal_frac_mean=1.0`, `collapse_class=COLLAPSED`, M1=1701 Mbps = 29% of RANDOM's 5827 (sub-random) —
> the SAME signature as the angle-aware-EE baseline. **So the collapse is NOT the reward direction.**
> RANDOM proves spreading yields 3.4× the throughput, yet the policy could not learn to spread → this is
> the **shared-Q per-user-argmax homogenization** (the fable hypothesis), now CONFIRMED. The reward-scale
> dominance (448×) and the angle-aware-EE-vs-throughput direction analysis below were a **RED HERRING**
> (at most secondary); the per-objective reward mechanics are kept for the record but **do NOT explain the
> collapse.** Lever forward = coordination/architecture (B1=more-state confirmed won't fix it — same state,
> still collapsed; catfish/B3 = fable's only untried lever, flagged may-fail). Open: does the 4-sat
> paper-faithful scenario (Arm 0b) also collapse? = scale-vs-architecture question.

## TL;DR

1. **It is NOT a UE-setup / "UEs too similar" problem.** Ruled out by evidence.
2. The collapsed artifact people keep citing (`family-b-baseline-retrain-2026-06-14`)
   is a **bare B0 baseline CONTROL** — PopArt OFF, every anti-collapse knob OFF,
   `r1_reward_mode=angle_aware_ee`, weights `[0.5, 0.3, 0.2]`. A bare baseline
   collapsing is *expected*; it is not "MODQN broken."
3. The producer **already implements** the standard anti-collapse machinery
   (proportional-fairness objective, PopArt return normalization, Cap25
   admission mask, anti-collapse constraints). They are simply **disabled** in
   the baseline control.
4. **The genuinely-hard part:** at least some machinery-ON arms
   (catfish / popart-on cells) **also** show `active_beam_count_mean ≈ 1.0`,
   `modal_frac ≈ 1.0`. So turning the known fixes ON does **not** reliably
   un-collapse on *this* env. That is why the producer's own verdict is
   **"collapse cause STILL-UNDETERMINED"** — not triviality, not incompetence.
5. **Correction to an earlier glib read:** "they naively removed fairness, just
   add proportional fairness" is **wrong**. PF/PopArt exist; the open question is
   why they don't hold on the S.672-4 / 28-beam / Cap25 env.

**VALIDATED 2026-06-15 (local, no training):** `analysis/reward_geometry.collect_reward_diagnostics`
on the angle-aware-EE config reports **|r1|/|r2| = 447.8×, |r1|/|r3| = 42.5×** — and the
env prints its **own DOMINANCE WARNING (>100×)**. Sample magnitudes: r1≈223.9, r2(beam)=−0.5,
r2(sat)=−1.0, r3≈−5.26. Under weights [0.5,0.3,0.2] the R2 (handover) and R3 (load-balance)
terms are numerically negligible → the "multi-objective" reward is effectively
**single-objective (R1 = per-user angle-aware EE)** → the policy concentrates onto the
best-SNR beam → collapse. This is the **confirmed proximate cause**. Whether PopArt
normalization alone un-collapses (vs. needing a system-aligned / proportional-fair R1) is
the open FIX question → server.

**⚠️ Scope correction (do NOT over-read the 448×):** the reward-geometry diagnostic is
**mode-agnostic** — it reports RAW component magnitudes (throughput ≈224 bps / handover
penalty 0.5 / load-balance 5.26), so overriding `r1_reward_mode→throughput` returned
**identical** numbers and did NOT test throughput-R1's behavior. The 448× is a reward-**UNITS**
mismatch (bps vs a {0,1} indicator), present for ANY R1. Collapse **direction** depends on R1
mode: `angle_aware_ee` (= throughput/power) rewards turning beams OFF → concentration →
collapse; plain `throughput` rewards sum-rate → spreading → likely does NOT collapse. **All 13
resolved configs use `angle_aware_ee`; the paper-faithful `throughput` R1 was apparently never
run in this collapse family.** So R1=throughput is the cheapest, untested, likely-non-collapsing
fix candidate → it is the FIRST server arm.

**ROOT CAUSE (read the actual paper, 2026-06-15) — supersedes "scale dominance is the cause":**
Yang Sun 2024 (full text in producer `paper-source/txt_all/2024_09_Handover_for_Multi-Beam...txt`)
uses **r1 = throughput** (eq 9) on an **SNR** channel (eq 2, no interference), default scenario
**100 users / 4 satellites**, weights **[0.5,0.3,0.2]** (the producer copied the weights). The
paper has the SAME r1≫r2 scale gap, yet does NOT collapse — because throughput **rewards
spreading** (bandwidth sharing B/N self-penalizes piling users on one beam). The producer
SWAPPED r1 → **angle_aware_EE = throughput/power**, which **rewards turning beams OFF**
(concentration). So the scale-dominance only AMPLIFIES whichever direction r1 points:
throughput → spread (paper, fine); EE-ratio → collapse (producer). **The proximate cause is the
r1=angle_aware_EE extension + the added SINR/interference, NOT the scale gap per se.** Fix = run
the paper-faithful r1=throughput + SNR + 4-sat scenario — never run here (all 13 configs are
angle_aware_ee). "Why 4 sats works" = it is the paper's default test point; the paper sweeps
#sat/#user (Fig 3/4) and MODQN beats RSS_max / DQN_throughput / DQN_scalar across all — the
collapse is about the swapped reward + added interference, not the satellite count.

## Evidence (all from staged producer artifacts, read-only)

### Ruled OUT — UE setup / "states too close"
Source: `dense-q-proof-window-600-130/timeline/step-trace.jsonl` (1000 rows = 100 UE × 10 slots).
- UE spread ≈ **193 km E-W × 89 km N-S** (full user area). UEs are NOT clustered.
- The policy **responds to UE position**: at slot 5 the action split is clean by
  longitude (west UEs → action 8, east UEs → action 21).
- **Decisive:** the *same* env/UE distribution produces BOTH a non-collapsed
  policy (the dense-q-window checkpoint: 6–20 active beams) AND a collapsed one
  (retrain-06-14: ~1 beam). Same UEs → different outcome → the cause is in
  **training/reward/config**, not the UE layout.

### The collapsed run is a bare baseline control
Source: `family-b-baseline-retrain-2026-06-14/seed-42/run_metadata.json`.
- `r1_reward_mode: "angle_aware_ee"` (per-user EE *ratio*, throughput/power flavor)
- `objective_weights: [0.5, 0.3, 0.2]`  (R1 EE / R2 handover / R3 load-balance)
- `popart_enabled: false`
- `anti_collapse_constraint_mode: "disabled"`, `anti_collapse_max_users_per_beam: 0`,
  `anti_collapse_min_active_beams_target: 0`, `anti_collapse_action_constraint_enabled: false`
- All 3 seeds (42/137/271) CONVERGED but COLLAPSED (report: "READINESS-ONLY, no
  beats-baseline claim").

### The collapsed policy is sub-random on system metrics
Source: `seed-42/seed_verdict.json` (held-out eval, B0_argmax vs RANDOM):

| metric | B0 (collapsed) | RANDOM | who wins |
|---|---|---|---|
| M1 throughput (Mbps) | 1508 | 5827 | RANDOM (3.9×) |
| M2 system EE (bits/J) | 3.64e8 | 5.82e8 | RANDOM (1.6×) |
| M4 load fairness | −96 | −2.6 | RANDOM |
| handover rate /step | **10** | 96 | **B0** (only win) |
| QoS served frac | 0.30 | 0.34 | RANDOM |
| active beams | 1.03 | 27.3 | — |

- The collapsed policy loses to RANDOM on throughput, system-EE, fairness, and
  QoS — winning **only** on handover rate.
- Implication: the **per-user `angle_aware_ee` training reward is misaligned with
  the system metrics** — the policy maximizes a per-user EE *proxy* (favoring
  concentration / not moving) while system throughput/EE/fairness end up
  sub-random. This is a credit-assignment / reward-proxy issue, NOT "single beam
  is the global optimum."

### Machinery-ON also collapses (the crux — confirm per-arm)
Crude grep over `coordinated-multi-catfish-pilot-2026-06-03/` and
`catfish-faithful-route-a-pilot-2026-06-02/` surfaced `active_beam_count_mean: 1.0`
/ `modal_frac_mean: 1.0`. **TODO (producer):** confirm which arm each value
belongs to before concluding the machinery fails outright — the grep did not
separate baseline arms from treatment arms.

## Source paper + literature (the problem is known, the fix is not exotic)

- Source: **Yang Sun et al., "Handover for Multi-Beam LEO Satellite Networks: A
  Multi-Objective Reinforcement Learning Method," IEEE Communications Letters,
  2024** (IEEE Xplore 10700698; paywalled — exact weights not retrievable).
  Its 3 objectives = throughput / handover-frequency / load-balance = exactly the
  producer's q1/q2/q3. The reproduction matched the *objective set* but added its
  own extensions (Cap25, VDN, Catfish, angle-aware-EE, 28-beam) and runs the
  baseline with the anti-collapse machinery off.
- Genre reward (from a close public paper, arXiv 2605.02416, Dueling-DDQN):
  `r_u = α·throughput − β·blocking − γ·switching`, weights stated "adaptive" but
  **no concrete update algorithm published** → reproductions must re-derive the
  weight/penalty schedule the authors used. This is a real, common repro gap.
- Literature treats **fairness ↔ sum-rate** as the central issue (Pareto /
  adaptive-weight rewards; Jain index up to 0.92; "users↑ → fairness↓").

## Can it be validated locally without a long server train?

- **CAUSE validation — DONE (2026-06-15): confirmed 447.8× scale dominance** (env's own DOMINANCE WARNING; see VALIDATED note above). The producer already
  ships the tools: `analysis/reward_geometry.py` (`collect_reward_diagnostics`,
  `build_reward_geometry_scale_table`), `analysis/fidelity_env_landscape_probe.py`,
  `analysis/faithful_env_materiality_probe.py`. Plus a pure forward-eval: score a
  *concentrated* vs a *spread* allocation under `r1_reward_mode=angle_aware_ee`
  and check which scores higher per-user. This confirms/refutes "the bare reward
  favors concentration" with zero RL training.
- **FIX validation — needs training → Ubuntu server (heavy).** Enabling PopArt +
  anti-collapse + stronger fairness and showing it un-collapses is a config-flip
  experiment, but a *full* run is heavy (per the global worker-routing rule). A
  short reduced-episode probe could show a tendency locally (~10–30 min CPU), but
  because machinery-ON arms apparently also collapse, a quick probe may NOT give a
  clean answer. Do not promise "flip PF on → fixed."

## leo consequence (unchanged)

- The collapse blocks ONLY the "MODQN beats baseline" (effectiveness) claim — which
  the leo showcase never makes.
- leo should keep using `dense-q-proof-window-600-130` for the **Q-mechanism +
  ω-counterfactual** proof (it has real per-action q1/q2/q3; objectives disagree,
  so ω-reweighting genuinely flips the pick), surface the honesty chip, and put the
  "constant handovers / intra-HO" story on the **live SINR lane** (the dense-q
  window has 0 intra handovers; its 125 inter are 80% a window-reset spike).

## Recommended next actions

1. (Producer, heavy → server) The real fix lives in
   `fable/handoff-baseline-collapse-diagnosis.md`: align the per-user reward proxy
   with system metrics, decide a concrete adaptive-weight / fairness schedule
   (the paper under-specifies it), and run a machinery-ON arm to a non-collapsed,
   beats-random result. Verify with Jain fairness index + active-beam-count, not
   throughput alone.
2. (leo or producer, cheap → local) Run the reward-geometry / env-landscape probes
   to confirm the concentration mechanism without training.
3. (leo) Proceed with the showcase on the mechanism proof; do not block on (1).
