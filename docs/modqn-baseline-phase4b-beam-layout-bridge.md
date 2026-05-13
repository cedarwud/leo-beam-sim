# MODQN Baseline Phase 4B Beam Layout Bridge

**Date:** 2026-05-12
**Status:** narrow adapter and validator
**Target repo:** `/home/u24/papers/project/leo-beam-sim`
**Scope:** MODQN producer replay beam identity to vendored core beam layout
identity

Phase 4B adds a local identity bridge between the accepted regenerated 7-beam
MODQN replay bundle and the Phase 3B vendored `ntn-sim-core` beam layout slice.
It does not change runtime behavior, wire replay playback, add UI controls,
copy producer artifacts, or edit scene, signal, handover, profile, or producer
files.

## Adapter

Source file:

`src/modqn/replay-bundle/beam-layout-bridge.ts`

The bridge preserves producer identity and derives separate core/layout/display
identity:

| Field | Rule |
| --- | --- |
| `producerSatId` | Preserved from the producer row, for example `sat-0`. |
| `producerBeamId` | Preserved from the producer row, for example `sat-0-beam-4`. |
| `producerBeamIndex` | Preserved as 0-based global satellite-major / beam-minor order. |
| `producerLocalBeamIndex` | Preserved as 0-based per-satellite order. |
| `coreLayoutSatId` | Defaults to `producerSatId`; may be supplied by an explicit bridge table. |
| `coreBeamId` | Derived as `${coreLayoutSatId}-b${producerLocalBeamIndex}`. |
| `leoSceneSatId` | Defaults to `producerSatId`; may be supplied by an explicit bridge table. |
| `leoLocalBeamNumericId` | Derived display helper: `producerLocalBeamIndex + 1`. |
| `leoGlobalBeamNumericId` | Derived display helper: `producerBeamIndex + 1`. |

The public helpers are:

1. `deriveCoreBeamId()`
2. `resolveCoreLayoutSatId()`
3. `resolveLeoSceneSatId()`
4. `createBeamLayoutBridgeIdentity()`
5. `createBeamLayoutBridgeCatalogByProducerId()`
6. `getModqnBeamCountBridgeClaim()`

Explicit bridge tables are strict: if a table is provided, the producer
satellite must have a mapping. This avoids silently mixing default and mapped
satellite identity.

Producer replay identity derivation is guarded by the beam-count claim returned
from `getModqnBeamCountBridgeClaim()`. `createBeamLayoutBridgeIdentity()` and
`createBeamLayoutBridgeCatalogByProducerId()` may derive `producer*` fields only
when `mayDeriveProducerBeamIdentity === true`; in the current Phase 4B scope,
that is only the accepted `7`-beam baseline path. Calls that request `19`, `37`,
or any unsupported `beamCountPerSatellite` throw before returning a bridged
identity or catalog. The `19` and `37` claims remain available as
sensitivity/demo metadata with `supportsProducerReplayEvidence: false` and
`mayDeriveProducerBeamIdentity: false`.

## Validation

Run:

```bash
npm run validate:modqn:phase4b-beam-layout-bridge
```

The validator proves:

1. the selected bundle still parses through the Phase 2 loader;
2. all timeline rows bridge without mutating producer rows;
3. all `1000 x 28` beam references preserve producer satellite IDs, beam IDs,
   global indexes, and local indexes;
4. default `coreBeamId` values match `${producerSatId}-b${producerLocalBeamIndex}`;
5. core layout lookup succeeds against `generateHexagonalBeamLayout()` for the
   7-beam layout of each producer satellite;
6. core layout order remains numeric index order and checks the `b10` versus
   `b2` lexicographic hazard with a 19-beam layout probe;
7. 7-beam parity remains `4` satellites x `7` beams = `28` mapped beams;
8. producer beam IDs are unique and core beam IDs are unique per satellite;
9. Leo numeric IDs remain derived 1-based display helpers;
10. `createBeamLayoutBridgeIdentity()` and
    `createBeamLayoutBridgeCatalogByProducerId()` reject `19`, `37`, and
    unsupported beam counts before producer identity derivation; and
11. claim labels keep `7` as the accepted regenerated baseline evidence path
    while `19` and `37` remain sensitivity/demo extensions only.

## Claim Boundary

`7` beams remains the accepted regenerated baseline MODQN evidence path for
the selected producer-owned bundle:

`/home/u24/papers/modqn-paper-reproduction/artifacts/phase-1c-regenerated-7beam-baseline-2026-05-11/phase-03a-replay-bundle-v1`

`19` and `37` remain sensitivity/demo extensions only. This bridge exposes
claim metadata for those counts, but it does not derive producer replay
identity for them and does not treat them as trained baseline MODQN evidence.

## Phase 5 Handoff

A later Phase 5 may choose one narrow runtime adoption path that consumes the
bridge output for beam geometry/reuse identity. It should keep HOBS/SINR
runtime behavior, MODQN replay evidence, and display-only numeric IDs labeled
separately, and it should avoid UI beam-count controls until runtime adoption
and reset/invalidation behavior are validated.
