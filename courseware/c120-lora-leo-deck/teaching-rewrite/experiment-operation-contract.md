# Experiment operation contract

This is the exact hands-on spine for the direct-teaching deck. Results below
come from the current packaged same-scenario fallback artifacts; fresh local
runs must be read from the `result_path` printed by the runner.

## What is edited

Participants do not write a new algorithm or modify the runner. They edit only
the marked constants in `student_policy.py`, one causal variable at a time.

### Lab A — awake wait or sleep during a pacing gap

1. Keep the packaged baseline and run `A / baseline`.
2. Change exactly:

   ```python
   REST_DURING_GAP = WAIT
   ```

3. Run `A / candidate --freeze`.
4. Keep the frozen policy unchanged and run `A / hidden`.

Why: WAIT avoids a wake transition but spends more time awake; SLEEP lowers
idle power but pays wake cost and may change packet timing.

Current fallback evidence:

- baseline: 4,800 delivered bit, 6.92 J, 693.641618 bit/J, service FAIL.
- candidate: 4,800 delivered bit, 8.86 J, 541.760722 bit/J, service FAIL.
- hidden: 0 delivered bit, 3.61 J, 0 bit/J, service FAIL.

Teaching conclusion: fewer wake events did not imply lower total energy, and a
low-energy hidden result with no delivered data is not a successful
energy-saving policy.

### Lab B — react immediately or require a stable quality condition

1. Keep the Lab A frozen predecessor and run `B / trace-a-baseline`.
2. Change exactly:

   ```python
   STABLE_STEPS = 1
   ```

3. Run `B / trace-a-candidate --freeze`.
4. Keep the frozen policy unchanged and run `B / trace-b`.

Why: a smaller stability requirement can send earlier, but may accept a short
quality spike and behave differently on another trace.

Current fallback evidence:

- Trace A baseline: 4,800 delivered bit, 8.86 J, 541.760722 bit/J,
  3 expired packets, service FAIL.
- Trace A candidate: 9,600 delivered bit, 10.66 J, 900.562852 bit/J,
  1 expired packet, service FAIL.
- Trace B withheld: 4,800 delivered bit, 5.43 J, 883.977901 bit/J,
  2 expired packets, service FAIL.

Teaching conclusion: the candidate delivered more data on Trace A while using
more J, but the withheld trace did not preserve that gain. Hysteresis and hold
settings are conditions, not guarantees.

### Lab C — urgent deadline margin and batching

1. Keep the Lab B frozen predecessor and run `C / baseline`.
2. Change exactly:

   ```python
   URGENT_MARGIN_S = 5
   ```

3. Run `C / candidate` without freeze.
4. Change exactly:

   ```python
   URGENT_MARGIN_S = 30
   ```

5. Run `C / revision --freeze`.
6. Keep the frozen revision unchanged and run `C / surprise`.

Why: a small margin waits longer before treating a packet as urgent; a larger
margin acts earlier. The trade-off must be judged against delivery and
deadline, not only J or bit/J.

Current fallback evidence:

- baseline: service PASS, deadline PASS, 10,400 delivered bit, 10.66 J,
  975.609756 bit/J.
- candidate (margin 5): service FAIL, deadline FAIL, 9,600 delivered bit,
  9.74 J, 985.626283 bit/J.
- revision (margin 30): service PASS, deadline PASS, 10,400 delivered bit,
  10.66 J, 975.609756 bit/J.
- surprise: service FAIL, deadline FAIL, 2,400 delivered bit, 5.41 J,
  443.622921 bit/J, 3 retransmissions and 3 expired packets.

Teaching conclusion: the candidate had a numerically higher bit/J but failed
service and deadline. Efficiency is not a valid success claim until the service
gate passes.

## Exact run commands

POSIX / WSL:

```sh
bash course.sh run --lab A --case baseline
bash course.sh run --lab A --case candidate --freeze
bash course.sh run --lab A --case hidden
bash course.sh run --lab B --case trace-a-baseline
bash course.sh run --lab B --case trace-a-candidate --freeze
bash course.sh run --lab B --case trace-b
bash course.sh run --lab C --case baseline
bash course.sh run --lab C --case candidate
bash course.sh run --lab C --case revision --freeze
bash course.sh run --lab C --case surprise
```

Windows:

```bat
course.cmd run --lab A --case baseline
course.cmd run --lab A --case candidate --freeze
course.cmd run --lab A --case hidden
course.cmd run --lab B --case trace-a-baseline
course.cmd run --lab B --case trace-a-candidate --freeze
course.cmd run --lab B --case trace-b
course.cmd run --lab C --case baseline
course.cmd run --lab C --case candidate
course.cmd run --lab C --case revision --freeze
course.cmd run --lab C --case surprise
```

After every run, use the exact `result_path` printed on stdout. The website does
not run Python; it validates the result, materializes a replay, and stores the
comparison in the workbook.
