# MODQN Baseline Phase 5B Visual Reuse Metadata

**Date:** 2026-05-12
**Status:** visual and diagnostic metadata adoption
**Target repo:** `/home/u24/papers/project/leo-beam-sim`
**Scope:** consume Phase 5A beam reuse metadata for visual beam colors and
ambient rings only

Phase 5B makes the scene visualization prefer Phase 5A runtime reuse metadata
when it is present on `BeamCellState`. It does not change signal computation,
handover behavior, policy behavior, replay evidence, profile JSON, producer
artifacts, or beam-count UI controls.

## Runtime Visual Resolver

Source files:

- `src/utils/beamFrequency.ts`
- `src/scene/useBeamViz.ts`
- `src/scene/types.ts`

`resolveBeamFrequencyIndex()` is the visual frequency-label resolver. It
returns both the numeric `frequencyIndex` used by colors/labels and a
diagnostic `frequencyIndexSource`.

| Input state | Visual `frequencyIndex` | `frequencyIndexSource` |
| --- | --- | --- |
| `BeamCellState.reuseGroup` is present and `reuseGroupSource` is `core-layout` | `reuseGroup` | `core-layout` |
| `BeamCellState.reuseGroup` is present and `reuseGroupSource` is `runtime-frequency-reuse-compatibility` | `reuseGroup` | `runtime-frequency-reuse-compatibility` |
| `BeamCellState.reuseGroup` is absent | `(beamId - 1) % frequencyReuse` | `fallback-numeric-modulo` |

`useBeamViz()` now applies this resolver when building:

1. visual beam targets in `VizFrame.satBeams`;
2. ambient footprint rings in `VizFrame.ambientRings`;
3. the diagnostic `VizFrame.visualFrequencyByBeamKey` map.

The resolver does not change numeric `beamId`. The beam ID remains the Leo
1-based compatibility ID from the current runtime path.

## Diagnostic Metadata

Diagnostics can read the source of each visual frequency label from:

- `VizFrame.visualFrequencyByBeamKey`, keyed as `${satelliteId}:B${beamId}`;
- each `AmbientRing`, which carries the same frequency source metadata.

The map values carry:

| Field | Meaning |
| --- | --- |
| `frequencyIndex` | The visual frequency color/label index. |
| `frequencyIndexSource` | `core-layout`, `runtime-frequency-reuse-compatibility`, or `fallback-numeric-modulo`. |
| `reuseGroup` | Present only when metadata backed the label. |
| `reuseGroupSource` | The Phase 5A metadata source when present. |
| `runtimeFrequencyReuse` | Runtime HOBS/SINR K when present. |
| `coreLayoutFrequencyReuse` | Core layout FRF used by Phase 5A when present. |

## Claim Boundary

For runtime K=`1`, `3`, and `7`, metadata-backed visual labels may be described
as core layout reuse metadata.

For runtime K=`2`, `4`, `5`, and `6`, metadata-backed visual labels are runtime
compatibility labels. They must not be described as core-backed reuse truth.

The visual frequency labels are not MODQN replay evidence. HOBS/SINR live
runtime output remains live simulator output and must not be presented as
producer replay behavior.

`19` and `37` remain sensitivity/demo extensions only and must not be described
as trained baseline MODQN evidence. Phase 5B does not add replay playback,
training, browser validation, `19 / 37` runtime controls, or beam-count UI
controls.

## Validation

Run:

```bash
npm run validate:modqn:phase5b-visual-reuse-metadata
```

The validator checks:

1. metadata-backed labels override numeric modulo for visual beam targets;
2. metadata-backed labels override numeric modulo for ambient rings;
3. K=`1/3/7` metadata labels are exposed as `core-layout`;
4. K=`2/4/5/6` metadata labels are exposed as
   `runtime-frequency-reuse-compatibility`;
5. fallback numeric modulo is used only when reuse metadata is absent;
6. diagnostic source metadata is exposed on `VizFrame`;
7. scene/viz code does not derive producer replay identity;
8. no unsupported 19/37 trained-baseline claim is introduced.

## Phase 5C Recommendation

Phase 5C should keep signal and handover behavior out of scope unless it starts
a dedicated rigor-critical vendor/adoption phase. A safe next step is a
diagnostics-only surface that displays the `frequencyIndexSource` and clarifies
whether each label is core layout reuse metadata, runtime compatibility, or
numeric fallback.
