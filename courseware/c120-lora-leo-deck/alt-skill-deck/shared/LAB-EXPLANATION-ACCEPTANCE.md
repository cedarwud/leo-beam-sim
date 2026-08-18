# Lab explanation acceptance

This checklist is required before any Lab A, B, or C chunk is published to
`latest/`. A one-line edit is a controlled experimental variable, not the whole
lab.

## Required teaching moves for every lab

1. Plain-language purpose and baseline behavior.
2. Exact file and exact marked-block name.
3. Small readable excerpt of the currently annotated `student_policy.py`, plus
   a nearby plain-Chinese explanation of the relevant source lines.
4. Explicit before and after, with all unchanged lines/files named.
5. Mechanism sentence: why this value can change action or transition timing.
6. Exact platform command and expected success signal or artifact path.
7. Baseline/candidate/freeze/withheld order as applicable.
8. Paired `result.json` and `endpoint-replay.json` handling.
9. Website reading order: service, packet/delivery, state/event, endpoint J,
   efficiency.
10. Causal explanation and claim boundary; a smaller J does not override service
    failure.

## Lab A

- File: `student_policy.py`
- Block: `lab-a-pace-rest`
- Before: `REST_DURING_GAP = SLEEP`
- After: `REST_DURING_GAP = WAIT`
- Unchanged: `PACE_GAP_STEPS = 2`, Lab B/C blocks, runner, scenario, schemas.
- Mechanism: pacing-gap action changes sleep, awake-idle, and wake intervals.
- Runs: baseline -> candidate with freeze -> hidden with frozen policy.
- Evidence: state duration, wake/process/TX/RX buckets, packet outcome, service,
  endpoint J.

## Lab B

- File: `student_policy.py`
- Block: `lab-b-enter-exit-hold`
- Before: `STABLE_STEPS = 2`
- After: `STABLE_STEPS = 1`
- Unchanged: `ENTER_QUALITY = 2`, `EXIT_QUALITY = 1`, frozen Lab A block, Lab C
  block, runner, scenario, schemas.
- Mechanism: the required consecutive stable observations change the time at
  which send mode becomes ready.
- Runs: Trace A baseline -> Trace A candidate with freeze -> withheld Trace B.
- Evidence: transition timing, attempt/retry/delivery, service, endpoint J.

## Lab C

- File: `student_policy.py`
- Block: `lab-c-batch-urgent`
- Before: `URGENT_MARGIN_S = 20`
- Candidate: `URGENT_MARGIN_S = 5`
- Revision: `URGENT_MARGIN_S = 30`
- Unchanged: `BATCH_SIZE = 3`, frozen Lab A/B blocks, runner, scenario, schemas.
- Mechanism: the threshold changes how early the urgent branch returns
  `SEND_URGENT`.
- Runs: baseline -> candidate -> revision with freeze -> withheld surprise.
- Evidence: urgent-action timing, deadline, delivered/expired outcome, service,
  endpoint J.
