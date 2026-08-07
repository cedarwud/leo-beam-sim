# T1–T6 operation-field coverage

Status: **ACTIVE ACCEPTANCE MATRIX — browser evidence pending**

This matrix is the controller gate for the operation path. A field is not
complete because it appears in prose; it must have a source, a visible consumer,
an operation that changes or resets it when applicable, a record instruction,
and a browser observation.

| Task | Required controls/actions | Required visible observations | Current source state | Remaining gate |
|---|---|---|---|---|
| T1 complete power chain | Transmit/RF output; PA efficiency; circuit term; restart measurement; restore defaults | RF output, PA input, circuit term, total power, units, complete equation | Source/UI tests pass; 3 W restore is separate from measurement reset | Browser confirms every row and the complete equation are co-visible; no isolated circuit-only explanation |
| T2 component and event effects | PA efficiency; circuit term; energy per handover; explicit handover action or observed event | Total power, handover count, handover energy, cumulative radio energy, total energy, Run EE, low-SINR ratio | Model/ledger tests pass; low-SINR and handover fields are wired | Browser A/B records one changed input, expected intermediate row, final energy/EE and quality tradeoff |
| T3 conditional link-to-rate path | Bandwidth; frequency reuse; fixed `U=1`, `SINR=0 dB`, start/reset | Assigned beam load, live SINR, throughput, cumulative data, serving identity and producer status | Conditional calculator is reproducible; transmit power was removed because it does not enter this controlled B/K comparison | Capture B/K, load, SINR, rate, data, service identity and status from one window; do not reintroduce transmit power as a causal field |
| T4 reset ownership | Restart measurement; restore parameter defaults | Before/after PA efficiency, circuit term, handover cost, cumulative data/energy, evaluation window, simulation clock, playback state | Separate actions implemented and source-tested | Browser confirms measurement reset preserves parameters/scene/playback while defaults restore the three energy inputs |
| T5 power-reduction falsifier | Fixed scene/window; restart measurement; compare 50 dBm with 35 dBm | RF output, total energy, delivered data, window-average rate, Run EE, low-SINR ratio, service identity and status | Aggregate observed values show energy falls while delivered data falls faster, so Run EE also falls; domain-edge tests remain internal coverage | Re-run and retain raw same-window producer evidence including U, SINR, throughput and service identity; delete the experiment if the reproduced evidence cannot support its stated purpose |
| T6 system EE | Live frame; bandwidth; reuse; actual and rated RF power; restart evaluation window | Producer status, system power, instantaneous EE, per-user contributions, contribution sum, identity PASS/FAIL, ratio-of-sums, sample/window state | Producer v2 PASS 15/15; live publisher/UI integration active | Live values, reset/seek behavior, invalid-state display, build and browser verification |

## Cross-task record fields

Every A/B record includes: scenario/profile identity, start time, window,
changed input, unchanged inputs, throughput/data, power/energy, low-SINR ratio,
handover count, EE quantity and scope, status/absence reason, interpretation,
performance tradeoff, and limitation.

## Quality-field definition

- Visible field: low-SINR ratio and its threshold.
- Current threshold: strict `< 14 dB`, explicitly a local scenario guardrail.
- Current statistic: finite low-SINR sample count divided by finite SINR sample
  count; it is a sample ratio, not a time-weighted duration.
- No finite sample means unavailable (`—`), not `0%`.
- The explicit no-service sentinel and invalid readings are not silently folded
  into the low-SINR numerator.

## Completion rule

The matrix becomes PASS only after a clean build is opened in a browser and a
reviewer who did not author the UI follows the final T1–T6 guide without reading
source code. Screenshots and observed labels/values must be attached to the
browser report; source tests alone cannot close this gate.
