# Homepage multi-candidate EE-policy — Fable implementation gate

## Receipt

- **Date:** 2026-08-29
- **Reviewer:** Claude Fable 5 through fresh-context `claude -p` sessions
- **Effort:** `max`
- **Mode:** read-only scientific, authority, presentation, and final synthesis review
- **Repository edits by reviewers:** none

The requested Opus max retry began at approximately 03:11 UTC+8 but returned no
review text before its 180-second request timeout. Its CLI session was
`a8582393-9b7b-4298-8ddd-c90c0ba55e97` and request UUID was
`1d1ce346-89fc-400c-972c-9d41a563fbea`. It is recorded as **no verdict**, not
as a pass or failure. One initial broad Fable request likewise timed out with no
review text (CLI session `3edcab85-d354-46da-a42f-0774e6512b7f`, request UUID
`22a5fbd2-208c-4c45-a07d-1c420850f4b9`). A Fable health probe then succeeded,
so the review was split into bounded gates and followed by one final synthesis.

Successful review receipts:

1. Scientific and decision-contract gate: CLI session
   `72353e4b-e56b-4c3c-bce8-51d7dfa2c346`, request UUID
   `d0ec32d1-2d74-4c12-96b6-6c9e4811f2c9`.
2. Presentation and authority gate: CLI session
   `4095a4e8-fa81-4f33-b40f-d99f177960ac`, request UUID
   `ce58c82c-5d7f-41b8-8a04-f751f464c2d1`.
3. Final synthesis gate: CLI session
   `54c1aeb9-3b3b-4a13-948f-f77f04afd8a3`, request UUID
   `176d5e62-31af-4776-b26d-7a0fa2246a8a`.

## Gate result

```text
FABLE_MAX_IMPLEMENTATION_GATE: PASS
EE_POLICY_ACTIVATION_GATE: BLOCKED
OWNER_VISUAL_ACCEPTANCE: PENDING
```

The final synthesis reported no remaining design MUST. It accepted the repaired
SDD and ADR as mutually consistent on:

- Walker construction and evaluator enforcement of the exactly-once switch
  witness, with non-positive or non-finite baseline EE failing closed;
- typed active-trigger evidence tied to the active objective, measured value,
  threshold, comparator, unit, reason, source frame, and policy hash;
- the distinction between a fixed 7-cell layout/index assignment and temporal
  advancement of the illuminated `K < N` window;
- null publication and stale-snapshot clearing outside a live Walker decision;
- the atomic old-to-new decision-field migration;
- one shared display key and matching scene wireframe/right-rail row for every
  bounded hard-eligible pair; and
- the governance-validator repair as an implementation prerequisite rather
  than a design contradiction.

## Mandatory implementation prerequisite

Before any S4/S5 seam change lands, restore
`scripts/validate-frontend-scene-lane-governance.ts` to a green baseline. Repair
its stale serving-footprint and active-toast needles and its earlier
timeline-descriptor abort without deleting or weakening another lane's rules.
Record that green baseline before proceeding to the accepted-snapshot publisher
or right-rail integration.

## Scope and remaining gates

This PASS authorizes implementation of the repaired contract only. It does not
activate Forecast EE as the homepage default, establish an energy-saving claim,
prove TypeScript/Python parity, accept browser readability, or replace owner
visual acceptance. The empirical, parity, candidate-window, continuous browser,
and owner evidence listed in SDD section 15.5 remains outstanding.

The reviewer also noted one editorial improvement, now absorbed: the validator
prerequisite appears before the activation-evidence lead-in in ADR-014 so it
cannot be mistaken for activation evidence.
