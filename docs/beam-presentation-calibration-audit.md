# Beam Presentation Calibration Audit

**Status:** D7 audit artifact, 2026-06-10.
**Scope:** inventory and guardrails before any change to beam color, beam
hopping display, beam width, steering angle, or cone visibility.

This document is intentionally an audit, not a visual patch. It records the
current beam-affecting surfaces, the source owner for each surface, and the
contract that must be accepted before changing visuals. D7 must not tune beam
width, steering angle, or hopping cadence to make coverage, handover, queue
drain, or replay proof look better.

## Before Capture

Repeatable capture command:

```bash
APP_URL=http://localhost:3001 npm run capture:beam-presentation-audit
```

The command writes ignored local evidence to:

- `output/beam-presentation-audit/2026-06-10/telemetry.json`
- `output/beam-presentation-audit/2026-06-10/sinr-live.png`
- `output/beam-presentation-audit/2026-06-10/sinr-tuning-beam.png`
- `output/beam-presentation-audit/2026-06-10/modqn-live-cell-preview.png`
- `output/beam-presentation-audit/2026-06-10/modqn-live-advanced.png`
- `output/beam-presentation-audit/2026-06-10/modqn-replay-proof.png`
- `output/beam-presentation-audit/2026-06-10/artifact-replay.png`

The capture script enforces `localhost:3001` and does not start a dev server.
The `output/` directory is ignored by git.

## Inventory

| Surface | Main paths | Lane / owner | What changes | Truth boundary | D7 decision |
|---|---|---|---|---|---|
| SINR tuning beam controls | `src/ui/SignalTuningPanel.tsx`, `src/signalTuning.ts` | `sinr-live` live runtime | Max transmit gain, 3 dB beamwidth, beam gain model, max steering angle, scan loss, frequency reuse | Live SINR parameter truth for the interactive simulator only | Keep as tuning UI. Do not change defaults in D7. Any future default change needs KPI/browser evidence. |
| Beam density / callouts | `src/ui/ControlBar.tsx`, `src/scene/sceneLaneRenderPlan.ts` | `sinr-live` presentation controls | Cone/callout density and labels | Display filter over live truth | Keep visible only on SINR. It must not alter service, SINR, or replay proof. |
| MODQN visual-layer presets | `src/ui/modqn-controls/ModqnAdvancedDisplayControls.tsx`, `src/scene/modqnVisualLayers.ts` | `modqn-live-cell-preview` profile-derived demo | Cell overlay, service map, beam cone, handover story display depth | Display/demo preset; not producer proof | Keep in Advanced drawer. No new main-surface buttons. |
| Live steered beam cones | `src/viz/SatelliteBeams.tsx`, `src/scene/MainScene.tsx`, `src/constants/beamRoleTokens.ts` | `sinr-live` renderer over live runtime beams | Cone/disc opacity, role color, callouts, footprint radius | Consumes runtime beam targets; does not own service decisions | Do not retune color/opacity/width in D7. Use this as the before baseline. |
| SINR cell-truth beam cones | `src/viz/SinrLiveCellBeamCones.tsx`, `src/scene/sceneLaneRenderPlan.ts` | `sinr-live` cell-truth model | Earth-fixed cell cone display | Model is computed, ambient cones are parked; D4 focus pair is source-scoped | Keep ambient parked. Focus pair remains D4 cell-truth only. |
| Candidate handover highlight | `src/viz/CandidateBeamHighlight.tsx`, `src/app/handoverCinema.ts` | `sinr-live` handover cinema | Old/new candidate rings | Geometry-only display command from active cinema event | Keep lane-owned to `sinr-live`; no MODQN replay borrowing. |
| MODQN cell overlay / profile cones | `src/viz/CellBeamCones.tsx`, `src/scene/useCellSchedule.ts`, `src/scene/modqnVisualLayers.ts` | `modqn-live-cell-preview` | Profile-derived cell schedule and optional cones | Demo/display projection, not producer proof | Keep labeled as profile-derived. Do not promote to replay proof. |
| MODQN replay scene layer | `src/scene/ModqnReplaySceneLayer.tsx`, `src/scene/modqnReplaySceneVisuals.ts` | `modqn-replay-proof` | Canonical board or producer beam-state footprints | Source-backed only when producer geometry passes gates; otherwise display lens/source gaps | Do not consume live SINR/Walker geometry or beam hopping state. |
| Training form beam parameters | `src/ui/modqn-training/TrainingForm.tsx`, producer request envelope | Producer backend request | Beams per satellite, beamwidth, capacity caps | Training job parameters, not live scene controls | Keep as producer request metadata. Loading a model must expose claim boundary. |
| Beam hopping schedule | `src/scene/runtimeFrameStep.ts`, `src/scene/beam-scheduler.ts`, `src/modqn/replay-source-gaps/sourceGaps.ts` | Live runtime for SINR; producer trace for replay | Active/inactive beam availability by slot | Visualization consumes scheduler output; replay proof source-gaps without producer active/next schedule | No UI-only hopping. No inference from selected/previous serving or masks. |

## Canonical Color Language Proposal

No colors change in this D7 audit. Future visual changes should follow this
single hierarchy before touching code:

| Meaning | Current source | Canonical role |
|---|---|---|
| Selected / serving beam | `BEAM_ROLE_TOKENS.serving`, UI semantic serving | Primary current service state |
| Candidate / target beam | `BEAM_ROLE_TOKENS.pending`, UI semantic candidate | Potential next service state |
| Previous / source beam in handover | handover source tokens / candidate highlight source role | Old service path, not current service |
| Frequency reuse | `frequencyReuseColor(index)` / `BEAM_FREQUENCY_COLORS` | Only frequency grouping; never a hidden serving-state channel |
| Satellite identity | `SATELLITE_TINT_PALETTE` and satellite markers | Identity context, lower priority than service role |
| Source gap / blocked proof | amber source-gap panels and `data-source-gap-field` | Missing producer truth, never a beam status |

Rule: role color wins for handover explanation, frequency color wins only when
the layer is explicitly explaining reuse, and source-gap color must never be
used as a normal beam state.

## Beam-Hopping Display Contract

Beam hopping is a schedule truth, not a visual effect.

- Live runtime may show active/inactive beams only from scheduler output such as
  `beamHopStatesBySatId`, active assignments, and explicit slot metadata.
- MODQN replay proof may show active/next beams only when the producer exports
  active/next schedule fields. Current replay keeps
  `beamHopping.activeSchedule` and `beamHopping.nextSchedule` as fail-closed
  source gaps.
- `selectedServing`, `previousServing`, `actionValidityMask`, and
  `decisionActionValidityMask` are forbidden aliases for beam-hopping truth.
- Display filters may hide beams for readability, but they must not make an
  inactive beam look served or make a source-gapped replay look scheduled.

## Stop Rules

- Do not widen beams or increase steering angle to improve handover visibility,
  queue draining, or coverage.
- Do not globally re-enable parked SINR cell cones without screenshot-backed
  review and governance updates.
- Do not add another MODQN beam preset or top-level button; route display depth
  through Advanced.
- Do not use live SINR, live Walker, or profile-derived cell overlays to fill
  MODQN replay proof holes.
- Do not change beam role token colors, opacity, or line width without updating
  this audit, screenshot evidence, and the relevant validators.

## Validation

- `npm run validate:beam-presentation:audit`
- `APP_URL=http://localhost:3001 npm run capture:beam-presentation-audit`
- `npm run validate:frontend:scene-lane-governance`
- `npm run validate:phase-h:s4-beam-hopping-toggle`
- `npm run validate:phase-h:s7-beam-material`
- `npm run validate:phase-i:s3-beam-geometry`
- `npm run validate:phase-i:s5b-cell-beam-cones`
- `git diff --check`
