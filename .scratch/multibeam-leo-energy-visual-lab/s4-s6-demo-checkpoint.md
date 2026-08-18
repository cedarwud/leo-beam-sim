# S4-S6 additive demo checkpoint

Date: 2026-08-15 (Asia/Taipei)

Status: implementation and browser checkpoint PASS. Human visual acceptance is
still pending. This record does not close S7 guided teaching, S8 figure mode,
or S9 owner acceptance.

## Delivered surface

- `/explain` opens directly into the three-column scientific demo without a
  landing page.
- A single central WebGL canvas switches between the archived-TLE orbit source
  and the local link cutaway. The source view uses the same precomputed artifact
  point and does not create a second renderer or rebuild the two-hour run.
- Explore mode lets the UE move on the accepted seven-cell local path by either
  dragging the UE plane or using the accessible range input. UE position,
  off-axis angle, canonical frame, and displayed results rebuild together.
- Full HPBW, minimum-rate target, and frequency reuse remain explicit inputs.
  The central five-term chain and the right evidence ledger update from the same
  frame.
- The angle and service-target controlled pairs expose reference/probe values,
  signed deltas, cap/QoS status, and the terms needed to trace the accepted
  causal path.
- The serving-change story renders the accepted before/decision/after frames.
  Satellite identities and event mechanism come from typed event evidence, not
  fixture-specific UI literals. A collapsed evidence panel exposes trigger,
  pre-commit visibility, pass-plan target, event ID, and trace identity.

## Scientific boundaries retained

- Controlled frame-scoped pairs serialize `EE_eval` as unavailable and retain
  the explicit excluded policy. Run-level `EE_eval` remains available only
  where its aggregation scope is valid.
- The orbit view shows archived TLE / SGP4 / TEME evidence. The transition to
  the local link is disclosed as recentering and reorientation, not continuous
  geographic scale.
- Link line width, light intensity, cone opacity, and energy particles are not
  used as quantitative RF encodings. Actual RF is printed as a value in the
  scene and repeated in the canonical ledger.
- When large HPBW would leave the local viewport, only the visual boundary is
  compressed. The actual HPBW and all canonical calculations remain unchanged
  and the compression is visibly disclosed.
- The three handover frames may use different representative links. Their
  values are observations of each complete frame, not a same-link causal delta
  and not an energy-saving claim.

## Verification

Machine gates:

- `npm run test:explain` — PASS
- `npm run lint` — PASS
- `npm run build` — PASS
- `npm run test:simulator` — PASS
- `npm run generate:explain:artifact -- --check` — PASS, 573801 bytes

Browser replay on `http://127.0.0.1:3000/explain`:

- 1440x900: direct load, TLE source switch, HPBW 3.32 to 8 degrees,
  service-target 1 to 10 Mbit/s, UE drag, and handover topic all executed with
  zero application errors.
- 768x900 and 390x844: single-column responsive flow; no horizontal clipping
  and no inherited 14vh route padding.
- The remaining console messages are Chromium WebGL driver `ReadPixels`
  performance warnings, not application exceptions.

Captured evidence:

- `output/playwright/explain-s4-s6-wip-1440x900.png`
- `output/playwright/explain-orbit-source-1440x900.png`
- `output/playwright/explain-hpbw-8deg-1440x900.png`
- `output/playwright/explain-responsive-fixed-768x900.png`
- `output/playwright/explain-responsive-390x844.png`

## Remaining boundary

- S7: prediction/reveal teaching reducer and cross-view term focus.
- S8: deterministic figure mode, crop-safe captions, and capture metadata.
- S9: controller-led browser review and human visual acceptance.

