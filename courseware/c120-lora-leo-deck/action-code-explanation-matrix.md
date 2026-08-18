# C-120 action and `student_policy.py` explanation matrix

Status: `DIRECT-TEACHING CONTENT CONTRACT / EXACT CASE COMMANDS FROZEN`

The runner normally completes each case quickly.  The teaching weight belongs
to reading the original branch, explaining the single marked edit, predicting
its consequence, and comparing the before/after evidence.  A lab therefore
uses one compact run/receipt slide (Lab C may use two because it has one
evidence-driven revision); repeated waiting or command slides are not lesson
content.

Every final operation or code slide must expose all five fields below on-slide. Speaker notes may deepen the explanation but may not be the only place it exists.

## Package / setup / run / import actions

| ID | Do | Why | Mechanism | Expect | Interpret / recover |
|---|---|---|---|---|---|
| ACT-01 | Obtain the named release ZIP or immutable `c120-v1` tag. | Start from reviewed course source, not a moving branch. | Pins wrapper, policy API, scenario, schema and license provenance. | Expected release root contains README, setup launchers, lock, policy, runner and schemas. | URL/tag is currently `PLACEHOLDER`; missing/mixed files mean use the named release archive, not an arbitrary branch. |
| ACT-02 | Run the OS-specific setup launcher; it creates `.venv`. | Keep course packages separate from system/other project Python. | Creates an isolated interpreter and package location. | Setup marks the environment stage passed. | Failure is operational evidence, not an energy result; use the OS diagnostic or same-scenario fallback. |
| ACT-03 | Install the hash-pinned dependency lock through setup. | Reproduce the reviewed graph instead of taking latest packages. | Resolves only the tested runner dependencies. | Lock SHA and install stage pass. | Hash/version failure blocks the runner; never remove pins during class. |
| ACT-04 | Run `bash course.sh verify` or `course.cmd verify`. | Fail before changing policy when runtime, release or scenario is incompatible. | Validates Python, wrapper, lock, policy API and scenario schema. | Machine-readable `READY` receipt. | Any other receipt identifies the failed gate; use the matching same-scenario fallback if the environment cannot be recovered. |
| ACT-05 | Open the fixed scenario JSON read-only. | Separate experimental conditions from student controls. | Exposes scenario identity, contact/quality trace, traffic, units, energy scope and mission boundary. | Same `scenario_id` appears in runner and Leo. | Editing invalidates the comparison; restore the scenario from the release. |
| ACT-06 | Open only the marked region of `student_policy.py` and its API card. | Learn legal observations/actions without future leakage. | Bounds policy input, policy state and editable constants. | Learner can paraphrase the condition and identify forbidden future fields. | If API/version differs, stop and restore the pinned policy. Exact lines are `PLACEHOLDER`. |
| ACT-07 | Record a queue/service/state-time/energy prediction before each run. | Make the result capable of confirming or falsifying a causal idea. | Binds a pre-action expectation to later evidence. | Workbook stores prediction before result ID exists. | An unpredicted run can be explored but cannot satisfy the causal checkpoint. |
| ACT-08A | Run `bash course.sh run --lab A --case baseline` or the Windows equivalent. | Establish a fair control with the inherited policy. | Executes the fixed scenario/case seed before any marked edit. | Baseline run ID, policy hash, packet/service/state/energy artifact. | Failure leaves no partial result and may use the matching fallback baseline. |
| ACT-08B | Run the untouched Lab B Trace A baseline. | Establish the same-trace control before threshold/hysteresis edits. | Executes the inherited accepted Lab A policy on Trace A. | Trace A baseline identity and evidence artifact. | A different predecessor policy makes the comparison invalid. |
| ACT-08C | Run the untouched Lab C baseline. | Establish queue/service/state/energy control before batching/urgency edits. | Executes inherited frozen Lab B policy on the fixed Lab C case. | Baseline queue, packet, state and endpoint-energy evidence. | Null or mismatched identity blocks the candidate comparison. |
| ACT-09 | Change only the active lab's marked constant(s) or branch. | Manipulate the decision rule without modifying engine/evidence. | Changes policy bytes and selected actions. | Small source diff and new policy SHA. | Syntax/illegal action reports the marked line; restore only the active block. |
| ACT-10A | Set `REST_DURING_GAP = WAIT`, then run `A / candidate --freeze`. | Test awake waiting against the release baseline sleep behavior. | Moves gap time from sleep/wake transitions into awake-idle time. | Candidate diff, policy hash, state/packet/service/J evidence and freeze receipt. | Null evidence diff fails the lab; a surprising direction must be explained rather than hidden. |
| ACT-10B | Set `STABLE_STEPS = 1`, then run `B / trace-a-candidate --freeze`. | Test immediate reaction against the inherited two-step stability requirement. | Allows entry after one qualifying observation and may accept a brief quality spike. | Trace A diff and frozen policy SHA. | Non-Lab-B edit or missing predecessor fails before execution. |
| ACT-10C1 | Set `URGENT_MARGIN_S = 5`, then run `C / candidate`. | Test a policy that waits longer before declaring a packet urgent. | Delays the `SEND_URGENT` branch until less time remains. | Candidate evidence diff. | A higher bit/J is not success when service or deadline fails. |
| ACT-10C2 | Inspect evidence, set `URGENT_MARGIN_S = 30`, and record the revised prediction. | Revise the mechanism from evidence instead of random retuning. | Makes the `SEND_URGENT` branch act earlier while leaving the rest of the policy unchanged. | One small diff and revised prediction. | A second revision or non-Lab-C edit is rejected. |
| ACT-10C3 | Run the Lab C revision and freeze it. | Evaluate the one revision before the surprise case. | Executes revised policy bytes under the same boundary. | Revision evidence and frozen SHA. | Null evidence change fails; syntax error returns only to the one revision step. |
| ACT-11 | Inspect `result.json`, then import it into Leo. | Move machine-readable evidence without executing learner code. | Validates schema, scenario/hash, seed, policy, units, events and provenance. | All-or-nothing receipt and matching endpoint replay identity. | Mismatch leaves the session unchanged; correct the named artifact or use same-scenario fallback. Current UI is `PLACEHOLDER`. |
| ACT-12A | Run Lab A hidden case without editing. | Test pace/rest under a hidden cost/window condition. | Requires Lab A freeze receipt and unchanged policy bytes. | Hidden replay with identical policy identity. | Changed bytes are retuning; restore frozen file/receipt. |
| ACT-12B | Run Lab B Trace B without editing. | Test hysteresis on a withheld trace. | Requires Trace A receipt and unchanged policy SHA. | Trace B replay and counterexample verdict. | Changed bytes do not count; restore frozen file/receipt. |
| ACT-12C | Run Lab C surprise case without editing. | Test batching/urgency under the surprise event. | Requires revision receipt and unchanged policy SHA. | Surprise replay, queue/service/energy ledger. | Changed bytes or a second revision do not count. |
| ACT-13 | Export, close and reopen the workbook. | Preserve the complete evidence chain, not only a final value. | Serializes identity, receipts, predictions, results, recovery and clauses. | `COMPLETE` or explicit `INCOMPLETE` reopens with the same scenario. | Missing evidence stays visible; never fabricate completion. |

## Exact course policy edits

Directional effects are hypotheses to test, not guaranteed KPI outcomes.

| Edit ID | Original → changed value | Why | Mechanism | Expect before run | Interpret / recover |
|---|---|---|---|---|---|
| A-REST | `REST_DURING_GAP = SLEEP` → `WAIT` | Test whether avoiding wake transitions offsets the extra awake-idle time. | Gap steps stay awake instead of sleeping and waking before later work. | Wake count should fall; total J may rise or fall depending on awake-idle duration. | Compare service first, then state duration, wake count and endpoint J; restore the release block if syntax or policy guard fails. |
| B-HOLD | `STABLE_STEPS = 2` → `1` | Test faster entry into send-ready mode. | One qualifying observation is enough, so a short quality spike can trigger an attempt. | The first attempt may occur earlier and delivery may change; robustness is unknown until Trace B. | Compare Trace A before/after, then keep the frozen policy unchanged for Trace B. |
| C-URGENT-1 | `URGENT_MARGIN_S = 20` → `5` | Test waiting longer before urgency overrides batching and pacing. | `SEND_URGENT` activates only when five seconds or less remain. | Endpoint J may fall, but delivery/deadline risk should be checked first. | If service/deadline fails, do not call a higher bit/J successful. |
| C-URGENT-2 | `URGENT_MARGIN_S = 5` → `30` | Make the one evidence-driven revision and act earlier. | `SEND_URGENT` activates with a wider deadline margin. | Service/deadline may recover while energy returns toward baseline. | Freeze this revision, then run surprise without retuning; restore the frozen checkpoint if lineage fails. |

## Freeze dependencies before final teaching pages

- Immutable release URL/tag and package tree.
- Supported Python version and dependency lock/hash.
- Exact Windows/POSIX commands, case IDs, output paths and receipt fields.
- Released `student_policy.py`, API version, marked line numbers and error messages.
- Current deterministic scenario/result/freeze artifacts.
- Current Leo import/error/replay/workbook browser evidence.

Any change to these release APIs invalidates the affected screenshots, code callouts, speaker notes and quick sheet until regenerated and rechecked.
