# Homepage multi-candidate visual recovery — Opus implementation gate

## Receipt

- **Date:** 2026-08-28
- **Reviewer:** Claude Opus 5 through a fresh-context `claude -p` session
- **Effort:** `max`
- **Mode:** read-only visual-architecture admission review
- **Session:** `5f12cfc0-ddfc-4bbe-98c5-7c3f8fb66eea`
- **Repository edits by reviewer:** none

The reviewer read ADR-014, the complete multi-candidate SDD including its
2026-08-28 amendment, the earlier S0-S2 review receipt, the current render
suppression sites, current candidate scene/rail components, and the
pre-authority central-scene carrier at `d66afbb`.

## Gate result

```text
VISUAL_RECOVERY_IMPLEMENTATION_GATE: PASS
```

The gate authorizes implementation of the visual-recovery amendment. It is not
final browser, pixel, owner, or forecast-EE-policy acceptance.

## Confirmed diagnosis

The reviewer confirmed that `multiCandidateAuthorityActive` becomes true from
the existence of a continuously published decision frame and then negates a
broad set of unrelated established layers. These include handover links,
motion guides, serving ripple, several beam/footprint/event effects, satellite
labels, and the handover receipt. The pre-authority commit `d66afbb` is a valid
visual reference for those layers.

The amendment's phase/layer-scoped ownership, renderable-output fallback,
geometry-failure telemetry, and carrier-first implementation order close the
design admission gap.

## Required implementation cautions

The PASS carries these non-blocking requirements into implementation and final
evidence:

1. Count solid data links across every link-drawing layer, not only inside the
   new candidate component.
2. Restored carrier layers must use episode satellite/beam identity tokens;
   they must not restore the old serving-yellow/candidate-blue role colours.
3. Define and test the allowed rail/scene publication skew rather than claiming
   literal same-render-time equality across the existing UI throttle.
4. Trigger additive fallback from actual rendered output, not from plan or
   decision-frame existence.
5. Publish exact unmapped `(satelliteId, beamId, sourceFrameId)` geometry keys;
   silent `null` returns do not pass.
6. Apply the new font floors only to the homepage decision board; do not
   accidentally enlarge shared controls or the retained lower calculation
   sections without layout evidence.
7. Keep the existing 390 px bottom-sheet requirement in the final responsive
   gate even though the desktop font checks target three larger viewports.
8. Do not blindly restore legacy ambient/candidate cone layers that would
   violate the seven-volume candidate presentation budget.

## Required post-implementation evidence

- scene-global one-solid-link telemetry and the exact atomic commit frame;
- satellite hue and beam shade persistence through commit, with no homepage
  role-colour leakage;
- verified non-empty inter and intra reference captures from the established
  carrier;
- a ledger for every suppressed layer: restored, or retired with a named and
  visibly observed replacement;
- rail/scene join evidence with a fixed skew rule;
- exact missing-geometry telemetry and failing fixtures;
- the continuous inter/intra recordings, viewport assertions, pixel review,
  and owner visual acceptance required by SDD section 0.4.

Forecast-EE activation remains blocked and was outside this review.
