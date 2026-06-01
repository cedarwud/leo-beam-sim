# SDD: Live Walker Handover Event Map and Slow-Motion Focus

## Status

Implemented through Slice 5 - 2026-06-01. Design boundary for a right-sidebar
handover event map that can review a validated 7200-second live Walker window
while preserving lane-owned source horizons.

## Authority

This SDD extends:

- `docs/decisions/ADR-003-walker-source-and-timeline-boundary.md`
- `docs/modqn-walker-serving-authority-sdd.md`
- `docs/timeline-controls-sdd.md`
- `docs/frontend-render-governance.md`

The governing rule is unchanged: a UI rail must not merge source events from one
authority with a duration or proof claim from another authority.

## Problem

The bottom timeline can now cover the 7200-second live Walker window, but
intra-satellite beam switches and inter-satellite handovers are short-lived. A
linear 2-hour scrubber is useful for global seeking, but it is too sparse for
understanding when a handover happened, which kind it was, and what to inspect
around that moment.

The right sidebar needs an event-oriented map similar in spirit to
`scenario-globe-viewer`'s multi-lane link map:

- a compact source-time overview;
- lane-separated event categories;
- a current-time cursor;
- event markers that can seek the master timeline;
- a local slow-motion focus view for short handover windows.

This must not turn the legacy MODQN producer trace into a fake 2-hour replay
proof.

## Source Policy

### Live Lanes

For `sinr-live` and `modqn-live-cell-preview`, a 2-hour handover event map may
use a live Walker event index only if that index is generated from the same
runtime inputs that own the live scene:

- profile and Walker constellation;
- trajectory cache;
- SINR/link-budget runtime;
- handover policy state;
- topology/UE configuration relevant to the displayed claim.

The source owner is `live-walker`.

Claim kind:

- `sinr-live`: `live-truth` for observed playback, or `profile-derived-forecast`
  for precomputed lookahead.
- `modqn-live-cell-preview`: `overlay-demo`; MODQN decisions may be compared on
  the live Walker candidate set, but this is not producer proof.

### Replay Proof Lane

`modqn-replay-proof` must use only producer-exported rows. The selected legacy
trace remains a producer trace with its own short source horizon. It must not
inherit the 7200-second live Walker horizon and must not be backfilled from a
live Walker forecast.

### Artifact Replay Lane

`artifact-replay` uses only artifact-owned event timing and scenario duration.
Missing event indices remain source gaps.

## UX Model

### Master Timeline

The bottom timeline remains the only master scrubber. Its axis is source time.
For live Walker lanes, that source time is `0..7200s`.

The right-side event map is an index and navigation surface. Clicking a marker
seeks the bottom timeline to that marker's source time.

### Overview Map

The right-side overview should be source-time preserving. It should not stretch
events across the 2-hour axis.

Recommended lanes:

| Lane | Purpose | Source |
|---|---|---|
| `serving` | serving satellite epochs or active serving ownership bands | live Walker event index |
| `intra` | intra-satellite beam-switch markers or clusters | live Walker event index |
| `inter` | inter-satellite handover markers or clusters | live Walker event index |
| `pending` | optional TTT / pending-target windows for explainability | live Walker event index |
| `source-gap` | unavailable or unvalidated source states | lane authority |

The map may cluster dense same-time markers, but each cluster must preserve:

- source time range;
- event count;
- event kind breakdown;
- source owner;
- claim kind.

### Slow-Motion Focus

Slow motion is a display lens, not a new source horizon.

When a marker is selected, derive a local source window such as:

```text
sourceStartSec = max(0, eventTimeSec - 10)
sourceEndSec   = min(7200, eventTimeSec + 20)
displaySec     = 60 or 90
```

The focus view may stretch that 30-second source window into a 60- or 90-second
display axis. This display axis must be labeled separately from source time.

Mapping:

```text
sourceTimeSec = sourceStartSec
  + (displayTimeSec / displayDurationSec) * (sourceEndSec - sourceStartSec)
```

The bottom timeline seek target is always `sourceTimeSec`, never
`displayTimeSec`.

## Data Model

The event index should be plain data, generated outside React rendering:

```ts
export interface LiveWalkerHandoverEventIndex {
  readonly sourceOwner: 'live-walker';
  readonly horizonKind: 'live-walker-window';
  readonly claimKind: 'live-truth' | 'profile-derived-forecast' | 'overlay-demo';
  readonly durationSec: 7200;
  readonly generation: {
    readonly profileId: string;
    readonly epochUtcMs: number;
    readonly simStepSec: number;
    readonly handoverPolicyKey: string;
    readonly topologyKey: string;
  };
  readonly sourceGapReasons: readonly string[];
  readonly events: readonly LiveWalkerHandoverEvent[];
}

export interface LiveWalkerHandoverEvent {
  readonly id: string;
  readonly sourceTimeSec: number;
  readonly kind: 'intra' | 'inter';
  readonly fromSatId: string;
  readonly fromBeamId: number;
  readonly toSatId: string;
  readonly toBeamId: number;
  readonly sourceStartSec?: number;
  readonly sourceEndSec?: number;
  readonly clickTargetSec: number;
  readonly primaryUeId?: string;
  readonly count?: number;
}
```

For a first implementation, the index should state whether it is primary-UE
only or aggregated across UEs. Do not show a 100-UE aggregate count unless the
index actually computed that aggregate.

## Generation Strategy

Do not generate the full 2-hour event index inside a React render path.

Recommended first slice:

1. Build a deterministic, non-React event-index helper that steps the same live
   runtime frame path used by `useSimulation`.
2. Use the 7200-second trajectory cache proven by
   `validate:live-walker:7200-timeline`.
3. Start with primary-UE handover events only unless a validator proves the
   multi-UE aggregate path.
4. Memoize by profile id, epoch, handover policy key, topology key, and serving
   count.
5. Fail closed with `sourceGapReasons` when the index is unavailable, stale, or
   too expensive to compute within the bounded runtime budget.

The index helper may use a coarser discovery step, but final event times shown
to the user must come from the runtime event itself, not from an arbitrary
bucket label.

## Validator Plan

Before this becomes a default right-sidebar surface, add validators.

### Static Governance Validator

Extend `validate:frontend:scene-lane-governance` or add a focused validator to
check:

- live event map source owner is `live-walker`;
- live event map horizon is `live-walker-window`;
- replay proof event map does not consume live Walker event indices;
- slow-motion fields use a display axis and do not replace source time;
- marker click targets use source seconds.

### Runtime Index Validator

Add `validate:live-walker:handover-event-index-7200` to check:

- index generation completes within a bounded runtime budget;
- index duration is exactly 7200 seconds for live Walker lanes;
- events are sorted and finite;
- every event is within `0..7200s`;
- intra events stay on the same satellite and change beams;
- inter events change satellite;
- click targets clamp to source time;
- no producer trace data is used as a live event source.

The validator should not require a fixed number of handovers unless the profile
and policy are intentionally frozen for that test. A count range or structural
invariant is safer than brittle exact event counts.

### Browser Smoke Later

After UI implementation, browser smoke should verify:

- source-owner telemetry is visible per lane;
- live lanes show `live-walker` with a 7200-second horizon;
- replay proof shows `modqn-producer-trace` with the producer horizon;
- clicking an event marker seeks the bottom timeline to source time;
- selecting a marker opens a slow-motion focus view without changing the source
  horizon.

## Non-Goals

- Do not edit producer artifacts.
- Do not synthesize producer replay proof from live Walker forecasts.
- Do not replace the bottom timeline as the master scrubber.
- Do not claim measured/operator handover logs.
- Do not claim multi-UE aggregate statistics until the event index computes and
  validates them.

## Implementation Slices

1. Record this SDD and keep runtime behavior unchanged.
2. Add the deterministic event-index helper and runtime validator.
3. Render a read-only right-sidebar 2-hour overview map from the validated index.
4. Add marker click-to-seek.
5. Add slow-motion focus display, preserving source-time telemetry.
6. Add browser smoke for lane/source telemetry and click-to-seek behavior.

Implementation note (2026-06-01): Slice 5 is implemented in
`HandoverEventRail`. Selecting a source-backed live Walker marker opens a local
slow-motion focus panel with a separate `display-stretched` axis while the
rail/root axis remains source time. The focused panel is gated to
`sourceOwner=live-walker` and `horizonKind=live-walker-window`; producer-trace
and artifact rails do not open this live focus lens. The focused validator is
`validate:live-walker:handover-event-focus`.

## Acceptance Criteria

- The right-side 2-hour event map is available only for source-backed live
  Walker lanes.
- `modqn-replay-proof` never inherits the 2-hour live Walker horizon.
- Slow motion is clearly a display axis and never overwrites source time.
- Handover markers are source-ordered and click targets are source seconds.
- Missing or stale event indices fail closed with source-gap copy.
