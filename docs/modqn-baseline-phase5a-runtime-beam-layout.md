# MODQN Baseline Phase 5A Runtime Beam Layout

**Date:** 2026-05-12
**Status:** narrow runtime geometry adapter
**Target repo:** `/home/u24/papers/project/leo-beam-sim`
**Scope:** adopt the vendored core beam layout for current scene-runtime beam
geometry and reuse metadata only

Phase 5A adds the narrow scene-compatible adapter needed for the current
`leo-beam-sim` runtime beam-cell shape, backed by the vendored `ntn-sim-core`
beam layout slice. The strict Phase 5A-C staging slice keeps this adapter
self-contained in the allowed files; runtime consumer rewiring is a separate
runtime-owned change. This phase does not add replay playback, training, UI
beam-count controls, producer artifact changes, new vendored modules, or
signal/handover rewrites.

## Runtime Adapter

Source file:

`src/scene/beam-layout.ts`

The scene-compatible adapter is `generateCoreSceneBeamOffsetsKm()`. It calls
`generateHexagonalBeamLayout()` and maps the core layout into the current Leo
runtime cell shape:

| Field | Rule |
| --- | --- |
| `beamId` | Derived Leo numeric compatibility ID, `coreLocalBeamIndex + 1`. |
| `dEastKm`, `dNorthKm` | Copied from core `offsetEastKm`, `offsetNorthKm`. |
| `coreLayoutSatId` | The scene satellite ID supplied to the core layout generator. |
| `coreBeamId` | Copied from core, shaped as `${coreLayoutSatId}-b${coreLocalBeamIndex}`. |
| `coreLocalBeamIndex` | 0-based local index from the core beam order. |
| `reuseGroup` | Copied from the core layout only when runtime K is `1`, `3`, or `7`; for legacy HOBS/SINR K=`2`, `4`, `5`, or `6`, this is a Leo compatibility label derived from `coreLocalBeamIndex % runtimeFrequencyReuse`. |
| `runtimeFrequencyReuse` | The normalized runtime HOBS/SINR frequency reuse value requested by the profile or tuning panel. |
| `coreLayoutFrequencyReuse` | The FRF value passed to `generateHexagonalBeamLayout()`. It is always one of the core-supported values `1`, `3`, or `7`. |
| `reuseGroupSource` | `core-layout` for core-supported K, or `runtime-frequency-reuse-compatibility` when `reuseGroup` is a Leo runtime compatibility label. |

Existing downstream HOBS/SINR and handover surfaces still receive
`beamId: number` when a runtime consumer adopts this adapter, so the numeric
compatibility contract is preserved. The strict Phase 5A-C PR does not require
staging broader runtime extraction helpers.

## Frequency Reuse Compatibility

The vendored core layout generator supports FRF `1`, `3`, and `7`. Existing
HOBS/SINR tuning exposes K=`1` through K=`7`, so the scene adapter resolves the
runtime K before calling core:

| Runtime K | Core FRF passed to layout | `reuseGroupSource` |
| --- | --- | --- |
| `1`, `3`, `7` | Same as runtime K | `core-layout` |
| `2`, `4`, `5`, `6` | `1` | `runtime-frequency-reuse-compatibility` |

For unsupported runtime K, geometry still comes from
`generateHexagonalBeamLayout()`, but the core call is geometry-only. The emitted
`reuseGroup` is a compatibility label for Leo's current HOBS/SINR runtime and
must not be treated as core-backed reuse truth by Phase 5B diagnostics or
claiming.

## Claim Boundary

The runtime geometry source is now the vendored core beam layout, but the
runtime HOBS/SINR output is still live simulator output. It is not MODQN replay
evidence and must not be labeled as producer replay behavior.

This phase does not derive producer replay identity in scene runtime code.
Producer identity remains owned by the replay-bundle adapters and artifacts.

`19` and `37` remain sensitivity/demo extensions only. Phase 5A keeps the
current runtime path capped to 7 beams and does not expose `7 / 19 / 37` as UI
controls.

## Validation

Run:

```bash
npm run validate:modqn:phase5a-runtime-beam-layout
```

The validator checks:

1. The scene adapter offsets and reuse groups match
   `generateHexagonalBeamLayout()` for the current 7-beam path.
2. Leo numeric beam IDs remain derived 1-based compatibility IDs.
3. Core layout metadata is present on `BeamCellState`.
4. The strict Phase 5A-C adapter/type allowlist does not derive producer
   replay identity.
5. No `7 / 19 / 37` beam-count UI control was added.
6. The 19/37 claim boundary remains sensitivity/demo only.

## Phase 5B Recommendation

Phase 5B should keep replay evidence, HOBS/SINR live output, and scene display
IDs separated while proving that the reuse metadata can be consumed by visual
diagnostics or interference/color diagnostics without changing numeric
handover behavior. UI beam-count controls should remain out of scope until a
later reset/invalidation and claim-labeling phase validates true 19/37 runtime
truth.
