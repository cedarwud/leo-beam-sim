# Producer Request — Dense Per-Action Q Export (MODQN proof unblock)

**From:** leo-beam-sim (final showcase). **To:** modqn-paper-reproduction (producer).
**Type:** HEAVY (export / bundle run on the Ubuntu server, not WSL). **Retrain:** NOT required.
**Date:** 2026-06-10.

## Why
leo's "prove MODQN is integrated" = show **Q1/Q2/Q3 per candidate beam** at each
handover decision. The leo frontend gate is **already built and fail-closed**
(`src/modqn/replay-bundle/denseQProof.ts`, `validate:modqn:dense-q-proof-adapter`
green). It renders nothing today because **no bundle exports the full dense
per-action Q** — `grep objectiveQByAction` hits only leo types/adapter, never data.
The producer already computes per-objective Q (it lives in
`policyDiagnostics.topCandidates[].objectiveQ`, top-K only) and drops the full
dense set on export. The ask: **dump the FULL per-action dense Q + mask + weights
+ tie-break** into the replay / visual-showcase bundle. Same forward pass, no
retrain.

## Exact contract leo consumes (must match `denseQProof.ts`)
Per decision sample, under `policyDiagnostics`, with `A` = number of candidate
actions in a stable canonical order (`satellite-major, beam-minor`, REP-012):

| Field | Shape | Meaning |
|---|---|---|
| `candidateActionOrder` | `A` beam refs `{satId, beamId, localBeamIndex}` | the action catalog order; length defines `A` |
| `decisionActionValidityMask` | `boolean[A]` | true = valid action at decision time (mask BEFORE argmax) |
| `objectiveQByAction` | `A` objects `{q1Throughput, q2Handover, q3LoadBalance}` | per-action Q of each of the 3 objective heads (accepts aliases `r1Throughput/throughput`, etc.) — **ALL actions, not top-K** |
| `scalarizedQByAction` | `number[A]` | per-action `w·Q` exactly as the policy scalarized at decision time |
| `objectiveWeights` | `{throughput, handover, loadBalance}` | the ω used at THIS decision |
| `selectedActionIndex` | int in `[0, A)` | the action the policy actually chose |
| `tieBreak` | literal **`"scalarizedQ-desc-actionOrder-asc"`** | the argmax tie rule the export used |
| `invalidActionSentinel` | the Q value stuffed for invalid actions (e.g. `-1e9`) | so leo never argmaxes a masked action |

## Hard acceptance (leo will verify)
1. `validate:modqn:dense-q-proof-adapter` passes against the new bundle.
2. The dense-Q gate flips **source-gap → proof-ready** (DecisionViz shows Q1/Q2/Q3).
3. **Self-check MUST hold:** `argmax over valid actions of (objectiveWeights · objectiveQByAction) === selectedActionIndex`. If the exported Q + weights don't reproduce the recorded decision, leo fails closed (this catches export drift). So export the dense Q **from the same forward pass** that produced `selectedActionIndex`, not a re-derivation.
4. `objectiveQByAction.length === scalarizedQByAction.length === candidateActionOrder.length === decisionActionValidityMask.length === A`.

## Two grades — pick per how fast you need the proof
- **Grade 1 (FAST, no retrain):** re-export the EXISTING trained run's bundle with the dense fields above. → leo immediately shows Q1/Q2/Q3 = **proves MODQN is wired**. Caveat: the current run is degenerate (0 handovers, all UEs on 1 beam) so the *scene* is boring, but the Q proof is real.
- **Grade 2 (FULL):** pair Grade-1 export with the env rebuild (D1 180/9/1 + D2a area-tracking pointing, your `04-rebuild-decisions-d1-d7.md`) + retrain on that env → dense Q on a non-degenerate, multi-handover scene. This is the version that also looks good.

## Notes
- This export change does NOT touch the SINR-live showcase lane (decoupled, leo's own world). It only feeds leo's MODQN replay lane.
- Keep the existing top-K `objectiveQ` for backward compat; ADD the full per-action arrays.
- **Axis rule (length A):** `objectiveQByAction`, `scalarizedQByAction`,
  `decisionActionValidityMask`, and `candidateActionOrder` MUST all be indexed by
  the dense action catalog (length `A`, `satellite-major, beam-minor`), NOT the
  physical beam list (`beamStates`, which under a windowed action space is longer,
  e.g. 144 vs 28). leo sources the dense-Q action order from
  `policyDiagnostics.candidateActionOrder`; a mask exported on the physical-beam
  axis makes leo fail closed (source-gap).
- Reference the leo contract literally: `src/modqn/replay-bundle/denseQProof.ts` (lines 16–35 = field shapes; 220–293 = the mask/tie/self-check rules).
