# Worker Prompt — MODQN Baseline-Collapse FIX validation (HEAVY → Ubuntu server)

> **Routing: HEAVY (RL training, > ~30 min, no browser).** Run on the Ubuntu
> server, NOT the WSL2/browser box. Setup: SSH to server → `cd
> ~/papers/modqn-paper-reproduction` → `git pull` (sync leo's diagnosis brief
> too) → confirm `.venv` (`.venv/bin/python -c "import torch,numpy"`) → open a
> Claude Code worker session there → paste the prompt below.
>
> **Repo:** `modqn-paper-reproduction` (the producer; leo does NOT train).

---

## Validated context (already confirmed locally, no training)

The Family-B B0 baseline collapses to ~1 active beam (`modal_frac≈1.0`, sub-random
on throughput/EE/fairness, see `family-b-baseline-retrain-2026-06-14`). Root cause
is **NOT** the UE distribution (UEs spread 193 km; same env yields a non-collapsed
checkpoint). The confirmed proximate cause:

- `analysis/reward_geometry.collect_reward_diagnostics` on the angle-aware-EE config
  reports **|r1|/|r2| = 447.8×, |r1|/|r3| = 42.5×** and the env prints its own
  **DOMINANCE WARNING (>100×)**. With weights [0.5,0.3,0.2] on raw rewards the R2
  (handover) and R3 (load-balance) terms are numerically negligible → the
  "multi-objective" reward is effectively single-objective (R1 = per-user
  angle-aware EE) → the policy piles users onto the best-SNR beam → collapse.
- The baseline runs with `popart_enabled=false` and all `anti_collapse_*` disabled
  (it is a bare control). PopArt + a proportional-fair objective + Cap25 admission
  all EXIST in the repo (`runtime/popart_online.py`,
  `runtime/proportional_fair_angle_aware_ee_objective.py`, anti-collapse config).

Full brief: `leo-beam-sim/docs/handoff/modqn-baseline-collapse-diagnosis-brief.md`.

## Goal

Determine whether fixing the reward-scale dominance **un-collapses** the Family-B
baseline — and if not, localize what else is needed. This resolves the producer's
"collapse cause STILL-UNDETERMINED" verdict.

## Experiments (cheap → expensive; stop early if one clearly works)

Run each as a single-seed short arm first (fast feedback), then 3-seed if promising.
Keep the frozen prereg discipline (G1/G3 parity) — each config flip is a documented
G3 deviation in its own prereg.

- **0. R1 = throughput (paper-faithful baseline) — RUN THIS FIRST, cheapest fix candidate.**
  All 13 resolved configs in this family use `r1_reward_mode=angle_aware_ee` (a producer
  EXTENSION); the paper's R1 is plain throughput and was apparently **never run** here.
  Direction matters: `angle_aware_ee` = throughput/power **rewards turning beams OFF**
  (less power → higher ratio) → concentration → collapse; plain `throughput` **rewards
  sum-rate** → spreading (eval: RANDOM's 27 beams = 5827 Mbps ≫ collapsed 1-beam = 1508).
  So R1=throughput **may not collapse at all**. If it doesn't, the fix is "drop the
  angle-aware-EE extension, use the paper R1" — no PopArt/PF needed. (The local
  reward-geometry diagnostic is mode-agnostic and could NOT settle this; only a real
  R1=throughput run can.) Set `r1_reward_mode: throughput`, retrain, eval as below.
  **Paper-faithful target (confirmed by reading Yang Sun 2024, full text in producer
  `paper-source/txt_all/2024_09_Handover_for_Multi-Beam...txt`):** channel = **SNR** (eq 2,
  γ=pG/σ², NO interference — drop SINR/S.672-4); throughput = (B/N)·log₂(1+SNR) (bandwidth
  sharing self-penalizes concentration); r1 = throughput (eq 9), r2 = handover cost −φ1/−φ2,
  r3 = −(max−min beam throughput); default scenario **100 users / 4 satellites**, 200×90 km @
  (40°N,116°E), user 30 km/h / sat 7.4 km/s, weights **[0.5,0.3,0.2]** (the paper's own choice).
  The paper has the SAME r1≫r2 scale gap yet does NOT collapse — throughput rewards SPREADING.
  Run THIS clean setup, not the angle-aware-EE / SINR env.
  **Run order (one variable at a time):** *0a* = flip **ONLY** `r1_reward_mode→throughput` in the
  EXISTING Family-B env (28-beam/SINR) — cleanest discriminator (one variable vs the exact
  collapsed B0); then *0b* = + **SNR (no interference)** + **4-sat** = full paper-faithful repro.
  **Episode budget: MATCH B0 exactly — do NOT pick a new number** (per the retrain prereg ≈ **3000
  training episodes** + the held-out eval ≈ 1440 ep; Family-B episode = 10 steps × 100 users). Reusing
  B0's budget keeps r1 the sole changed variable. **Wall-time: ~20–30 min / seed** on the 20-core
  server (Family-B step p95 ~30 ms × ~30k train steps + eval; cf. the lighter 300k-step pilot = 10.5
  min). **Run 1 seed first (~30 min)**; only go 3-seed (~1.5 h) if it un-collapses. Discriminator:
  0a un-collapses → reward-direction (this brief); 0a still collapses → the shared-Q-homogenization
  hypothesis (fable line). NOT a multi-day job.
- **A. PopArt ON** — `popart_enabled=true` (the implemented online return
  normalizer). This is the direct fix for the 448× scale dominance.
- **B. Reward calibration** — use `configs/modqn-paper-baseline.reward-calibration.resolved.yaml`
  (explicit per-objective scaling so R2/R3 are not drowned).
- **C. Proportional-fair R1** — switch R1 to the proportional-fair angle-aware-EE
  objective (`proportional_fair_angle_aware_ee_objective.py`). Addresses the
  per-user-EE-proxy ↔ system-fairness MISALIGNMENT (concentration stops being
  optimal), not just the scale.
- **D. (only if A–C insufficient) anti-collapse constraint** — enable
  `anti_collapse_min_active_beams_target` / Cap25 admission as a hard floor.

## Concrete launch mechanics (verified against the repo, 2026-06-15)

- **Launcher:** `scripts/family_b_baseline_retrain_runner.py` — flags `--seed-subset`,
  `--output-dir`, `--parity-only`, `--progress-every`. **No `--prereg`/`--config`:** it is
  HARDWIRED to the frozen `docs/research/env-foundation/retrain-prereg-family-b.json`
  (pins `r1_reward_mode: angle_aware_ee`, `episodes: 3000`, seeds [42,137,271], offset_mask on).
- **Replicate the collapsed baseline (sanity — confirms harness + reproduces collapse):**
  `MPLCONFIGDIR=/tmp/mpl .venv/bin/python scripts/family_b_baseline_retrain_runner.py
  --seed-subset 42 --output-dir artifacts/family-b-r1ee-repro-1seed --progress-every 50`
- **Throughput-r1 (0a) is NOT a CLI flag — it is a small prereg change** (launcher is
  prereg-hardwired): (i) `cp` the prereg → `…-r1throughput.json`; (ii) flip
  `r1_reward_mode: angle_aware_ee → throughput` + update `r1_reward_label` /
  `r1_reward_provenance` to document the G3 deviation (the prereg already references "the SDD-11
  throughput-r1 anchor"); (iii) repoint the loader (`src/modqn_paper_reproduction/family_b_retrain/
  runner_support.py` prereg path, or add a `--prereg` flag — ~2 lines); (iv) run the launcher with a
  new `--output-dir`. Keep episodes/seeds/eval/replay/eps-schedule IDENTICAL (only r1 changes).
- **Verdict:** read `artifacts/<out>/seed-42/seed_verdict.json` →
  `active_beam_count_mean`, `modal_frac_mean`, M1, M4, `qos_served_fraction`; compare vs collapsed
  B0 + RANDOM.
- **Check prior evidence first:** an SDD-11 throughput-r1 anchor exists
  (`docs/research/catfish-faithful-route-a/sdd11-*-prereg.json`) but on the PRE-Family-B env —
  read its collapse outcome as a prior; the clean test is throughput-r1 on the Family-B env.

## Eval / acceptance

Use the existing held-out eval + `seed_verdict` harness. For each arm, report vs the
bare baseline AND RANDOM:

- `active_beam_count_mean` (target ≫ 1), `modal_frac_mean` (target ≪ 1)
- **Jain fairness index** + `M4_load_fairness`
- system throughput (M1) + system EE (M2) + `qos_served_fraction`
- handover rate (must stay reasonable — not collapse-by-freezing)

**PASS** = a non-collapsed policy (active_beam ≫ 1, modal_frac ≪ 1) that **beats
RANDOM on system throughput** while keeping handover rate sane. Do NOT declare PASS
on throughput alone (the collapse already games per-user proxies).

## Honest caveat to test, not assume

Preliminary grep suggested some machinery-ON arms (catfish / popart cells) ALSO show
`active_beam_count_mean≈1.0`. **First action: confirm per-arm** whether any existing
machinery-ON run already un-collapsed. If A–C all still collapse, THAT is the finding:
the env / R1 proxy needs redesign (system-aligned reward), not just calibration —
escalate to a reward-redesign SDD rather than more tuning.

## Output

- New artifacts dir `artifacts/family-b-collapse-fix-<date>/` with per-arm verdicts.
- Update `fable/handoff-baseline-collapse-diagnosis.md` with the result.
- Update the producer `.agent-memory/` collapse entry.
- Report back to leo so the leo-side brief + memory get the resolved status.
