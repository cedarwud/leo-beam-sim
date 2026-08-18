# ADR-006: Derive homepage handover state from the completed TLE run

## Status

Accepted by owner direction

## Date

2026-08-13

## Context

ADR-005 deliberately limited the homepage candidate to a same-instant link
comparison.  It therefore required handover offset, time-to-trigger (TTT),
progress, and count to remain unavailable.  The owner has now required those
fields to be backed by an actual decision process rather than hidden or filled
with profile defaults.

The completed archived-TLE run already supplies real SGP4 geometry, a bounded
serving/candidate pass sequence, and canonical link results at 241 common
anchors separated by 30 seconds.  The historical Walker handover manager owns
a different runtime and must not be reused as if its events came from TLE.

## Decision

Add an immutable TLE-run handover trace with these rules:

- The serving and candidate identities are admitted satellites from the frozen
  TLE publication and completed SGP4 run. No generated satellite or Walker
  state may enter the trace.
- The decision metric is
  `candidate SINR - serving SINR` from the same canonical parameter set and
  run anchor.
- The safety offset is 3.0 dB and TTT is 30 seconds for the first bounded
  implementation.
- Decisions are evaluated only on the completed 30-second anchor axis. The UI
  must not imply sub-anchor precision or reuse the historical 3.5-second
  Walker timer.
- A candidate must remain the same identity and meet the offset continuously
  for TTT before becoming the serving satellite. A target change, missing
  candidate, or failed offset resets progress.
- When the current serving satellite is no longer visible, the run may perform
  a forced continuity switch to a real visible planned satellite without
  waiting for TTT. This event is explicitly distinguished from an
  offset-and-TTT trigger.
- Initial attachment is not counted. Every later completed serving-identity
  change increments the run-local cumulative handover count exactly once.
- The selected satellite used by the centre scene and canonical frame is the
  state-machine result. The UI may not overlay a decision trace on a different
  serving sequence.
- Changing the TLE request or canonical parameters rebuilds the entire trace
  before atomic publication. The trace is not persisted experimental evidence.

The right rail displays the safety offset, TTT progress and target, current
decision state, and cumulative count from the accepted frame. Missing trace
data continues to fail closed rather than falling back to Walker defaults.

## Alternatives considered

### Display the historical Walker values

Rejected because the Walker profile and event log do not describe the
archived-TLE canonical run.

### Count every pass-planner service change without a state machine

Rejected because a pass schedule alone does not explain a safety offset or
TTT and would make the displayed timer unrelated to selection.

### Claim a 3.5-second TTT on the 30-second calculation axis

Rejected because the current canonical link results do not exist at that
decision resolution. A later change may add a separately verified finer
calculation axis.

## Consequences

- The ADR-005 statements that homepage handover fields are unavailable are
  superseded only for frames carrying this completed trace.
- The candidate remains TLE-derived; it becomes a decision input rather than a
  display-only comparison.
- The first implementation may show only forced handovers when the canonical
  power-control closure keeps serving and candidate SINR within 3 dB. That is
  a valid result, not permission to lower the threshold silently.
- Energy-saving claims and Phase-1 platform integration remain unresolved.

