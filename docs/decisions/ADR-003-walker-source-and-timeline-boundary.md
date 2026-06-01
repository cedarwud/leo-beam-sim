# ADR-003: Keep Walker Source and Timeline Horizons Lane-Owned

## Status

Accepted

## Date

2026-05-31

## Context

`leo-beam-sim` now has bottom timeline controls and a right-side handover rail.
That surfaced a source-boundary problem: live-sim scenes use a Walker-based
runtime for satellite geometry and SINR, while the selected Phase 7C MODQN
bundle is a short legacy producer trace with its own producer time range and
4-satellite proxy assumptions.

Displaying a legacy producer trace on the live Walker 20-minute scrubber makes
the trace look like live Walker handover history. Extending that same display to
a 2-hour handover map would be worse: it would imply source-backed producer or
physics evidence that the legacy bundle does not export.

The issue is not whether Walker geometry is acceptable. The issue is whether a
single scene lane mixes satellite geometry, SINR, handover events, decisions,
and timeline horizons from different authorities without labeling them.

## Decision

Keep Walker geometry as the intended live comparison substrate, but make source
ownership lane-specific:

- `sinr-live`: authoritative source is the live Walker engine. Satellite
  rendering, live SINR, live HandoverManager state, and live timeline/forecast
  rails must come from that live runtime.
- `modqn-live-cell-preview`: authoritative geometry and SINR source is still the
  live Walker engine. MODQN behavior may be overlaid for comparison, but it must
  be labeled as an overlay/demo unless every relevant value is producer-backed.
- `modqn-replay-proof`: authoritative source is the producer artifact only. The
  replay proof lane may display only producer-exported geometry, channel metrics,
  decisions, handover events, reward diagnostics, provenance, and source gaps.
  It must not use the live Walker engine to fill missing producer truth.
- `artifact-replay`: authoritative source is the immutable `visual-showcase-v1`
  artifact and its scenario duration.

Timeline and handover rail horizons follow the same rule. A rail must use the
time horizon exported by its source. A legacy 10-second producer trace may be
kept and displayed as legacy evidence, but it must not be stretched or labeled
as a live Walker 20-minute or 2-hour handover timeline.

Future 2-hour intra/inter handover maps require a source-backed input:

1. a profile-derived live Walker forecast from the same engine state used for
   live rendering and SINR, labeled as forecast/demo; or
2. a producer-exported Walker-based MODQN replay or `visual-showcase-v1`
   artifact, labeled as producer proof.

## Alternatives Considered

### Use the live Walker engine to reinterpret the legacy MODQN trace

Rejected. It would make the replay proof lane a display-side reconstruction
instead of producer evidence.

### Stretch legacy producer events across a longer UI timeline

Rejected. The UI would imply a longer source horizon than the producer exported.

### Delete the legacy bundle

Rejected. The legacy trace is still useful as accepted baseline evidence and as
a regression fixture. It should be preserved, labeled, and isolated instead.

### Split every lane into separate renderer implementations

Rejected. Shared primitives are still useful. The required separation is source
ownership and timeline horizon ownership, not duplicated rendering code.

## Consequences

- Live SINR and live handover displays remain Walker-based and internally
  consistent.
- MODQN live overlay can compare decisions on the same live Walker candidate set
  without pretending to be replay proof.
- MODQN replay proof remains evidence-oriented and fail-closed on missing
  producer fields.
- The legacy Phase 7C producer trace remains available, but UI must label it as
  legacy/producer trace and use its own horizon.
- New source/horizon labels and validators should be added before any handover
  rail, forecast rail, or replay rail becomes a default demo surface.

## Validation

- `validate:frontend:scene-lane-governance` should continue to reject broad
  mode-gated proof mounting and should be extended when rail source labels
  become load-bearing.
- `validate:modqn:handover-story-layer` should continue to reject fake replay
  beam-hopping or handover story truth when producer fields are absent.
- Browser smoke for timeline/rail work should check the visible source owner,
  source horizon, and marker owner for each affected lane.
