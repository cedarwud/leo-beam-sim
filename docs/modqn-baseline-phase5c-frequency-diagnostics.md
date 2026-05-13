# MODQN Baseline Phase 5C Frequency Diagnostics

**Date:** 2026-05-12
**Status:** diagnostics-only visual frequency source surfacing
**Target repo:** `/home/u24/papers/project/leo-beam-sim`
**Scope:** expose Phase 5B visual frequency metadata in the diagnostics drawer

Phase 5C surfaces the Phase 5B visual frequency source metadata for the
current primary and comparison panel beams. It does not change signal
computation, handover behavior, policy behavior, replay evidence, profile
JSON, producer artifacts, or beam-count UI controls.

## SimState Payload

Source files:

- `src/scene/types.ts`
- `src/ui/DiagnosticsDrawer.tsx`

`SimState.visualFrequencyDiagnostics` is an optional diagnostics payload with
two entries:

| Entry | Meaning |
| --- | --- |
| `primary` | The current `panelPrimary` visual frequency metadata. |
| `comparison` | The current `panelComparison` visual frequency metadata. |

Each entry carries:

| Field | Meaning |
| --- | --- |
| `satId` | The panel satellite ID, or `null` when no panel beam exists. |
| `beamId` | The Leo numeric beam ID, or `null` when no panel beam exists. |
| `frequencyIndex` | The visual frequency color/label index, or `null` when the beam is not currently visible. |
| `frequencyIndexSource` | `core-layout`, `runtime-frequency-reuse-compatibility`, `fallback-numeric-modulo`, or `not-visible`. |
| `runtimeFrequencyReuse` | Runtime HOBS/SINR K when Phase 5A metadata is present. |
| `coreLayoutFrequencyReuse` | Core layout FRF when Phase 5A metadata is present. |

The payload is shaped to carry values from `VizFrame.visualFrequencyByBeamKey`,
keyed as `${satId}:B${beamId}`. Missing panel beams and beams absent from the
current visual map are labeled `not-visible`. Phase 5C's strict staging slice
does not require broader scene-state publisher rewiring; the drawer renders the
metadata already selected by Phase 5B when a publisher provides the payload.

## Diagnostics Drawer

The diagnostics drawer includes a `VISUAL FREQUENCY SOURCE` section with
primary and comparison rows for:

1. frequency index, formatted as `F1`, `F2`, `F3`, and so on;
2. source string;
3. runtime K when present;
4. core FRF when present.

The source string is intentionally exact. For runtime K=`2`, `4`, `5`, and
`6`, the drawer must show `runtime-frequency-reuse-compatibility`, not a
core-backed truth label. `fallback-numeric-modulo` means Phase 5B did not find
reuse metadata and used the existing visual numeric modulo fallback.
`not-visible` means the current primary or comparison beam has no entry in the
visible Phase 5B frequency map.

## Claim Boundary

Visual frequency diagnostics are display diagnostics only. They are not MODQN
replay evidence, do not derive producer replay identity, and do not describe
HOBS/SINR live output as producer replay behavior.

For runtime K=`1`, `3`, and `7`, `core-layout` means the visual label came from
the vendored core layout reuse metadata. For runtime K=`2`, `4`, `5`, and `6`,
`runtime-frequency-reuse-compatibility` means Leo reused Phase 5A compatibility
labels for the current HOBS/SINR runtime; it is not core-backed reuse truth.

`19` and `37` remain sensitivity/demo extensions only and must not be
described as trained baseline MODQN evidence. Phase 5C does not add replay
playback, training, browser validation, `19 / 37` runtime controls, or
beam-count UI controls.

## Validation

Run:

```bash
npm run validate:modqn:phase5c-frequency-diagnostics
```

The validator checks:

1. `SimState` exposes a primary/comparison visual frequency diagnostics
   payload;
2. the stageable Phase 5B visual map keeps the `${satId}:B${beamId}` key
   contract;
3. the diagnostics drawer renders `F*`, source, runtime K, and core FRF rows;
4. runtime K=`2/4/5/6` wording stays runtime compatibility, not core-backed
   truth;
5. `fallback-numeric-modulo` and `not-visible` are surfaced distinctly;
6. no signal, handover, replay, training, producer artifact, or beam-count UI
   scope was introduced;
7. no unsupported 19/37 trained-baseline claim is introduced.

## Next Phase Recommendation

The next phase should remain claim-bound: either add a browser smoke for this
diagnostics readout, or start a separate rigor-critical adoption phase for any
signal/handover use of reuse metadata. Do not fold signal, handover, replay,
training, or beam-count controls into Phase 5C.
