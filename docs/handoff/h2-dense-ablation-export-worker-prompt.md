# H2 — Dense ablation export worker prompt (HEAVY, Ubuntu server)

> **Routing (global heavy-compute rule): RUN THIS ON THE UBUNTU SERVER, not WSL.**
> H2 = 4-arm dense rollout + export = torch forward passes over a 96-step window ×
> 100 UEs × 4 arms → **GPU, no browser/GUI, artifacts already live on the server.**
> Est. wall: **~1–4 h** (single window, no retrain; dominated by dense per-UE Q
> serialization, not training).
>
> **Setup before pasting the task below:**
> 1. `ssh` to the Ubuntu server (the box that ran H1; producer artifacts + weights are there).
> 2. `cd` to the producer repo (`modqn-paper-reproduction`), `git pull` if needed.
>    Confirm HEAD is at or after the decode commit `a9290c1` (leo P1 goldens were
>    generated against it; `e9fefa8` is fine — it is display-only figure changes on top).
> 3. Confirm the Python env (the one H1 used): `python -c "import torch; print(torch.cuda.is_available())"`.
> 4. Confirm the weights repo is present: `modqn-weights-consolidated/route-b/route-b-factorial-2026-06-27/`.
> 5. Reuse the H1 tooling on the server: `docs/handoff/h1-scene-scan/` (H1 built it; it
>    re-runs the scene scan in seconds and owns the window→step mapping). H2 extends it.
> 6. Open a Claude Code worker session **there** and paste everything under the line.

---

## TASK (paste into the server-side worker session)

You are the H2 producer-export worker for the leo-beam-sim handover simulator. You
run on the Ubuntu server with GPU + the producer repo + the frozen weights.
**No retrain.** You do eval-only rollouts on ONE pre-selected window and export a
dense ablation matrix. Everything you produce is **READINESS-ONLY numbers** — no
"MODQN wins" / no "catfish credit" verdict language (mirror
`route-b-factorial-RESULT.json`'s `READINESS_ONLY` framing and the honesty RED
LINES below).

### 0. Read first
- `docs/handoff/h1-scene-scan/` (your own H1 tooling — window selection + step
  mapping; re-run it to reproduce the window deterministically).
- `src/modqn_paper_reproduction/route_b_factorial/auction_decode.py` (the decode
  you are exporting the inputs for: `valuation` / `decode_a0_argmax` /
  `decode_af_physical_auction` / `column_greedy_decode`). leo already ported this to
  TS (P1) and gates bit-parity, so the exported `slotCell` / `decodeParams` /
  `auctionAudit` MUST match what THIS file consumes/produces.
- The leo-side contract you are feeding: `<leo>/docs/handoff/producer-dense-q-export-request.md`
  (base fields + the 4 hard-acceptance rules + the axis rule) and
  `<leo>/docs/handover-simulator-final-plan.md` §4 (the H2 additions).

### 1. The selected window (H1 handoff — do NOT re-pick)
- **Window: `t0=9000`** (H1's adopted window #1 — the purest forced-set: the serving
  satellite genuinely drops below the horizon → the cleanest "tower moved, you didn't,
  so the link must jump" beat; best for L1–L3 teaching).
- Step range ≈ **[117, 213]** ≈ **96 sim-seconds**; H1 counts **~20 intra + ~74 inter**
  handovers in-window; argmax↔auction **Δserved ≈ 0.74** on this window.
- **Export cap: step ≤ 212.** Keep every exported slice at **nVis ≥ 3** (H1 depletion
  guard — window #1 is safe through step 212; do not export past it).
- Use H1's tooling to map `t0=9000` → the exact reset seed + step indices, and drive
  **the identical reset across all 4 arms** (same env, same seed, same window — only the
  policy/decode differs). This is non-negotiable: the frontend toggle-slam compares arms
  on ONE recording, so a per-arm reset drift would make the comparison a lie.

### 2. The 4 arms — VERIFY IDENTITY against run_metadata BEFORE locking
Controller pre-scan of `route-b-factorial-2026-06-27/{A1,A2,B1,B2}/seed-*/run_metadata.json`
(verify, do not trust blindly):

- `route_b_config.decode`: **A1, A2 = `auction`**; **B1, B2 = `argmax`**.
- **All four have `catfish_enabled = False` and `catfish_ablation = none`.**
- A1 vs A2 differ only by `gamma_per_objective` (A1=None / A2=set) +
  `value_stratified.enabled` (A1=False / A2=True) — a **MORL training-variant axis,
  NOT a catfish axis**.
- `route-b-factorial-RESULT.json` labels its eval arms **A0 / AF / RSS_max** (decode
  variants), with paired_delta **A0→AF: served +0.267, min_coverage +0.8125** (the
  de-collapse win) and **A0→RSS_max: served −0.423**.

**⚠️ Flag back to the controller/user:** the plan's "arm#3 = catfish-off twin" does
NOT map cleanly onto route-b-factorial, because **none of A1/A2/B1/B2 is catfish-ON**
— so a catfish on/off contrast cannot come from this tree. The catfish-ON counterpart
lives in a different weights tree (`modqn-weights-consolidated/catfish/…`,
e.g. `per-objective-catfish` / `catfish-faithful-route-a-pilot-2026-06-02`). Resolve
arm#3 one of two ways and RECORD which you chose in provenance:

| # | arm | trained weights | recorded `decodeKind` | purpose |
|---|---|---|---|---|
| 1 | **hero (A-column, auction-trained)** | route-b-factorial A-column — pick the A-arm H1 used as hero (likely **A1**; confirm vs H1 handoff) | `auction` (`shift_to_nonneg=True`) | carries ALL decode-time interaction (frontend re-decodes A0⇄AF, k_cap sweep, ω) off its dense Q |
| 2 | **B-column (argmax-trained)** | route-b-factorial **B1** (or B2) | `argmax` | genuinely argmax-TRAINED → stays collapsed as-trained (answers "you only swapped decode on A's Q") |
| 3 | **catfish contrast** — user lock = **A1** (per plan §1-D3 correction), VERIFY vs run_metadata | **either** the OTHER route-b A-arm as a MORL-variant twin (A1↔A2, honest "≈ no diff") **OR** a real catfish-ON arm from `catfish/…` paired against A1 | `auction` | honesty ablation:切 catfish ≈ no change (A1≈A2, RED LINE) vs 切 decode = flips |
| 4 | **RSS_max heuristic** | none (computed) | `argmax`-over-RSS (heuristic; note it is NOT a learned-Q decode) | naive/paper benchmark; the layperson "basic mode" |

If the user's "lock A1" and the pre-scan disagree, STOP and report — do not silently
pick. (User explicitly asked for a run_metadata re-verify before locking arm#3.)

### 3. Export contract (per arm, per decision step) — MUST match leo P1
**Base dense-Q fields** (from `producer-dense-q-export-request.md`, axis = dense action
catalog length `A`, satellite-major/beam-minor, NOT the physical beam list):
`candidateActionOrder` / `decisionActionValidityMask` (bool[A]) /
`objectiveQByAction` (A × {q1Throughput,q2Handover,q3LoadBalance}, **ALL actions**) /
`scalarizedQByAction` (number[A]) / `objectiveWeights` {throughput,handover,loadBalance} /
`selectedActionIndex` / `tieBreak = "scalarizedQ-desc-actionOrder-asc"` /
`invalidActionSentinel`.

**H2 additions** (final-plan §4 — without these the frontend can only re-run argmax,
not auction):

| field | shape | source in `auction_decode.py` |
|---|---|---|
| `slotCell` | `U×A` int | the `slot_cell` arg (physical cell id per (user,action); `l = a//7`, `c = slot_cell[u,a]`) |
| `decodeParams` | `{lW, kCap, gridCount, beamsPerSlot:7, shiftToNonneg}` | the arm's actual eval decode args (`l_w`, `k_cap`, `grid_count`; `beamsPerSlot` fixed 7 = the `a//7`; `shiftToNonneg=True` for learned A/B, per the file's FOLD-2 note) |
| `decodeKind` | `'argmax' \| 'auction'` | the arm's recorded decode (§2 table) |
| `auctionAudit` | `{nFallback, openedPerSlot[], demandedPerSlot[]}` | `decode_af_physical_auction(..., return_audit=True)` → `{n_fallback, opened_per_slot, demanded_per_slot}` |

**Scene fields (every frame — the red/green field + beat + EE ride-along):**
sat positions (with `coordinateFrameKind` + `positionProvenance` when proxy),
beam geometry (center / halfAngle / footprint, keep the existing displayOnly
provenance style), **per-UE geo + servingBeamId + sinrDb + candidateSinrDbByBeamId**
(this is what leo colours red/green), per-UE served/starved + throughput, handover
events (intra/inter, from→to, frame index), per-sat power/EE, coverage/fairness series.

**Provenance (per arm):** arm id + resolved weights path + env config hash + seed +
window id (`t0=9000`) + which arm#3 interpretation you chose + export self-check result.

Emit **`visual-showcase-v1.json` + `step-trace.jsonl` per arm** (same layout as the
existing `dense-q-proof-window-600-130` so leo's loader reuses its adapter).

### 4. Acceptance (you verify before handback)
1. **1-slot smoke FIRST** (final-plan §4): export ONE slot of ONE arm, hand it to leo
   to run `validate:modqn:decode-parity` + loader, confirm the contract shape, THEN run
   the full 4-arm × 96-step export. Do NOT do the full run before the smoke passes —
   avoids a contract round-trip.
2. **Self-check MUST hold** (hard-acceptance #3): for each recorded step,
   `argmax over valid actions of (objectiveWeights · objectiveQByAction) === selectedActionIndex`.
   Export the dense Q **from the same forward pass** that produced the decision. For
   auction arms, the TS auction re-run must also reproduce the `opened` set from
   `auctionAudit` (leo checks this).
3. `objectiveQByAction.length === scalarizedQByAction.length === candidateActionOrder.length === decisionActionValidityMask.length === A` per step.
4. **ntn-sim-core validator passes** on each arm's artifact:
   `cd <ntn-sim-core> && npm run validate:visual-showcase:artifact -- <path>/visual-showcase-v1.json`.
5. File-size sanity: est. 30–80 MB/arm (final-plan §4-R5); gzip is fine; if it blows
   up, `log` what you cut — do NOT silently truncate steps (nVis≥3 cap is the only
   allowed cut, and it is documented).

### 5. Handback
- Deliver the 4 arm artifacts + a one-page handoff (window facts, arm identities you
  locked + WHY, self-check pass, ntn-sim-core validate output, sizes).
- leo then adds a **per-slot (shape-2) fixture set** to `validate:modqn:decode-parity`
  (P1 currently gates the per-user shape-1 window; H2's `slotCell` U×A enables the
  auction shape-2 parity — the frontend auction path is untested until this lands).

### Guardrails (binding)
- **Read-only on weights.** No retrain, no weight edits. Only `import` the producer
  decode; do not modify `auction_decode.py`.
- **Honesty RED LINES** (from the paper, binding): win is framed in coverage / fairness
  (min_cov, active beams 3→12) + EE, **not raw scalar**; **catfish is a named component,
  NOT a proven win-cause** (A1≈A2 — the engine is the coordinated-decode step); r1 = EE.
  Keep the READINESS_ONLY framing; export numbers, claim nothing.
- **Do not touch the leo repo.** You produce artifacts + a handoff; leo consumes them.
- If any arm identity, the reset mapping, or the contract shape is ambiguous, STOP and
  report — a wrong-reset or mis-identified arm poisons the whole comparison.
