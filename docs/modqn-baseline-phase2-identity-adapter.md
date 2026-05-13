# MODQN Baseline Phase 2 Identity Adapter

**Date:** 2026-05-11
**Status:** implemented narrow schema and identity adapter
**Scope:** accepted `phase-03a-replay-bundle-v1` only

Phase 2 adds a typed reader/parser and deterministic identity helpers for the
accepted producer-owned baseline MODQN replay bundle:

`/home/u24/papers/modqn-paper-reproduction/artifacts/phase-1c-regenerated-7beam-baseline-2026-05-11/phase-03a-replay-bundle-v1`

The bundle remains in `modqn-paper-reproduction`. No producer artifact is
copied into `leo-beam-sim`.

## Adapter Behavior

Source files:

1. `src/modqn/replay-bundle/types.ts`
2. `src/modqn/replay-bundle/loader.ts`
3. `src/modqn/replay-bundle/identity.ts`
4. `src/modqn/replay-bundle/index.ts`

The parser reads the manifest, provenance map, optional evaluation summary, and
`timeline/step-trace.jsonl` rows into typed Phase 2 surfaces. It validates the
required manifest fields, row fields, masks, beam states, reward vector, and
optional producer-owned policy diagnostics without adding missing diagnostics or
Q-values.

The identity adapter keeps producer IDs as canonical truth:

| Surface | Phase 2 behavior |
| --- | --- |
| Satellite | `sat-<index>` remains the canonical producer satellite ID. |
| Beam | `sat-<satIndex>-beam-<localBeamIndex>` remains the canonical producer beam ID. |
| Beam index | 0-based global satellite-major / beam-minor index is preserved. |
| Local beam index | 0-based per-satellite index is preserved. |
| Visual numeric beam IDs | Derived separately as 1-based local/global helpers and never replace producer IDs. |
| User | `user-<index>` plus `userIndex` produces a deterministic user key. |
| Selected action | `selectedServing.beamIndex` is the selected action index and mask position. |
| Handover event | `none`, `intra-satellite-beam-switch`, and `inter-satellite-handover` are explicit adapter kinds. |

`intra-satellite-beam-switch` maps to the repo-local `intra-switch` handover
action and `intra-satellite-beam-handover` semantic. `none` maps to `stay`.
`inter-satellite-handover` is supported by the adapter type and mapping, but
the selected artifact currently has zero such rows.

## Validation

Run:

```bash
npm run validate:modqn:phase2-identity-adapter
```

The validator reads the selected bundle by absolute path and checks:

1. schema version, paper ID, beam counts, episodes completed, and claim
   boundary flags;
2. `1000` timeline rows with `28` beam states and `28`-length mask/load arrays;
3. satellite-major beam identity round trips, selected/previous serving
   references, selected action mask preservation, and deterministic user keys;
4. intra/no-event semantics, plus adapter support for inter-satellite handover
   without requiring it in this artifact;
5. reward-vector key and scalar reward preservation; and
6. producer-owned policy diagnostics pass-through with no invented diagnostics.

## Claim Boundary

This adapter is bound to the accepted regenerated 7-beam baseline MODQN
artifact for `PAP-2024-MORL-MULTIBEAM`.

`19` and `37` beam presets remain sensitivity/demo-only labels until a future
producer-owned artifact promotes evidence for those beam counts. This Phase 2
work does not implement those presets.

The current artifact demonstrates intra-satellite beam switches and no-event
rows only. It does not demonstrate inter-satellite handover.

## Phase 3 Handoff Inputs

Phase 3 should start from:

1. the selected bundle path above;
2. the typed Phase 2 parser and identity helpers;
3. the validator output from
   `npm run validate:modqn:phase2-identity-adapter`;
4. `docs/modqn-baseline-live-integration-mini-sdd.md` Phase 3 guidance; and
5. the vendor-on-demand workflow for any future `ntn-sim-core/src/core/beam/`
   module work.

Phase 3 should not start UI/runtime replay playback until beam-layout truth and
claim labels are explicitly scoped and validated.
