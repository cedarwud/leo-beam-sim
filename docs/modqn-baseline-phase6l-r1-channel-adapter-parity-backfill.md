# MODQN Baseline Phase 6L-R1 Channel Adapter Parity Backfill

**Date:** 2026-05-12
**Status:** late read-only backfill validator added
**Target repo:** `/home/u24/papers/project/leo-beam-sim`
**Decision:** `MISMATCHES_QUANTIFIED`

Phase 6L-R1 is a late backfill after Phase 6L channel index vendoring. It
renames the stale channel-adapter parity comparator into a non-conflicting
backfill surface:

```bash
npm run validate:modqn:phase6l-r1-channel-adapter-parity-backfill
```

The validator runs fixed scenarios through the current
`src/engine/signal/link-budget.ts` runtime path and a validator-local
vendored-core channel path from `src/core/channel/index.ts`.

This backfill does not replace the accepted
`docs/modqn-baseline-phase6m-channel-runtime-adoption-readiness.md` readiness
record. It is superseded and expanded by later Phase 6O channel-adapter parity,
Phase 6T source-channel shadow KPI, and Phase 6U beam-gain mismatch evidence.

Runtime adoption status: **not adopted**. The validator does not edit
`src/engine/signal`, `src/engine/handover`, `src/scene`, `src/profiles`,
`src/ui`, replay artifacts, or MODQN policy behavior.

## Comparator Policy

The Phase 6L-R1 backfill comparator intentionally does not use a local
implementation-loss shim to force parity. It enables deterministic source
channel tiers where the vendored helper supports them, disables stochastic
fading tiers, and reports component-level drift for:

1. received signal, SINR, denominator, noise, and interference subtotals;
2. local path loss versus source channel path-loss terms;
3. beam gain and steering/scan loss;
4. runtime numeric K reuse grouping versus core layout reuse grouping; and
5. UE receiver-gain convention differences.

Observed mismatches are readiness evidence only. They do not authorize a
runtime behavior switch and do not rewrite the live HOBS/SINR path.

## Claim Boundary

1. `7` beams remains the accepted regenerated baseline MODQN evidence path.
2. `19` and `37` beams remain live sensitivity/demo extensions only, not
   trained baseline MODQN evidence.
3. HOBS/SINR live output remains separate from MODQN replay evidence.
4. Channel adapter parity does not create MODQN policy, reward, training, or
   replay evidence.

Browser smoke is not required for Phase 6L-R1 because this backfill adds only
a terminal validator and package-script wiring.
