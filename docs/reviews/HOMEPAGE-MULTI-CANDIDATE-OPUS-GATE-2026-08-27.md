# Homepage multi-candidate handover — Opus design gate

## Receipt

- **Date:** 2026-08-27
- **Reviewer:** Claude Opus 4.6 Thinking through a fresh-context `agy` session
- **Mode:** read-only architecture and scientific review
- **Files reviewed:** ADR-014, the multi-candidate/multibeam SDD, ADR-013,
  ADR-005, the canonical EE SDD, and the cited current source seams
- **Repository edits by reviewer:** none

The installed Opus model exposes its native thinking mode and does not accept a
separate `--effort` option. The gate therefore used
`claude-opus-4-6-thinking` directly.

## Gate result

```text
S0_S2_IMPLEMENTATION_GATE: PASS
EE_POLICY_ACTIVATION_GATE: BLOCKED
```

The reviewer reported no blocking architecture issue for beginning the typed
contracts, candidate-opportunity producer, compatibility SINR parity work, and
counterfactual EE construction/parity work in S0–S2.

The activation block is intentional and fail-closed. Forecast EE must not
become the homepage decision policy and candidate EE claims must not appear
until the following are frozen and verified:

- common forecast horizon `H`;
- minimum relative EE advantage `epsilon_EE`;
- contact-prediction cadence, failure tolerance, and window boundary;
- service-continuity rescue hold/threshold configuration and deterministic
  safety behavior; and
- canonical TypeScript/Python parity, including unequal-duration
  ratio-of-sums and zero/invalid behavior.

## Scope of the pass

The pass authorizes staged implementation only. It is not scientific acceptance
of a final EE policy, not evidence of energy savings, and not visual acceptance
of the resulting interface. Those claims remain subject to the SDD's activation
and browser/human gates.
