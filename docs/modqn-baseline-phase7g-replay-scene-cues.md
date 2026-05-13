# MODQN Baseline Phase 7G Replay Scene Cues

**Date:** 2026-05-13
**Status:** `READ_ONLY_REPLAY_SCENE_CUES_IMPLEMENTED_WITH_PHASE7F_BROWSER_R1_REPAIRED`
**Target repo:** `/home/u24/papers/project/leo-beam-sim`
**Scope:** read-only replay scene-adjacent cues, focused browser smoke, and checkpoint doc

Phase 7G adds display-only scene-adjacent cues for the current Phase 7F MODQN
replay playback state. It does not connect replay rows to the live HOBS/SINR
runtime, does not map producer beam IDs onto live Three.js beam geometry, and
does not recompute SINR, handover decisions, MODQN actions, rewards, geometry
truth, policy diagnostics, or provenance.

## Cue Surface

UI components and helpers:

1. `src/modqn/replay-bundle/playback-shell.ts` exposes
   `createModqnReplayPlaybackDisplayState()`.
2. `src/ui/ModqnReplayPlaybackShell.tsx` emits the current playback display
   state through a read-only callback.
3. `src/ui/ModqnReplaySceneCues.tsx` renders the cue strip.
4. `src/App.tsx` stores the display state and places the cue strip between
   the Phase 7F playback shell and the live scene row.

The cue strip is explicitly labeled:

1. `MODQN replay artifact cues`;
2. `scene-adjacent display only`; and
3. `not live HOBS/SINR state`.

The cues show the current Phase 7F focus state:

1. selected serving satellite / beam;
2. previous serving satellite / beam;
3. producer handover event kind; and
4. current source slot / focus row identity.

## Replay Truth Preservation

Phase 7G consumes only the Phase 7F playback display model:

1. source slot and focus row come from `currentSlot`;
2. selected and previous serving come from `focusRow.selectedServing` and
   `focusRow.previousServing`;
3. handover event kind comes from `focusRow.handoverEventKind`; and
4. aggregate artifact counts remain `85` intra-satellite beam-switch rows,
   `915` no-event rows, and `0` observed inter-satellite handover rows.

The cue strip uses producer IDs and display-only beam numbers already present
in the Phase 7F model. It does not derive new replay truth and does not force
an unsafe producer-to-live-scene geometry mapping.

## Replay / Live Separation

The cues are rendered as a separate scene-adjacent label layer above the live
scene row. `MainScene`, `useSimulation`, `useBeamViz`, the HandoverManager,
HOBS/SINR formulas, beam hopping scheduler, signal tuning state, runtime
profile state, and Phase 6 source-channel behavior are unchanged by Phase 7G.

The existing Phase 7E labels and Phase 7F playback shell remain visible. The
cue layer is visually separate from the control bar, evidence strip, playback
shell, scene canvas, live tuning slot, and live status slot.

## Browser Validation

Focused validator:

```bash
npm run validate:modqn:phase7g-replay-scene-cues
```

The validator:

1. loads the selected producer artifact through the Phase 7C/7F model path;
2. checks the cue display state is derived from the Phase 7F compact playback
   model;
3. checks desktop `1440x900` and narrow `390x844` viewports;
4. confirms cue visibility and replay/live separation wording;
5. confirms scrub changes update the cue source slot, selected/previous
   serving labels, handover event kind, and focus row identity;
6. confirms play/pause updates the cue source slot;
7. checks no overlap with major controls, playback shell, evidence strip,
   scene canvas, or side panels;
8. confirms no browser console or page errors; and
9. scans visible text for unsupported `19`/`37` trained-baseline claims and
   HOBS/SINR-as-MODQN-replay-evidence claims.

Phase 7G uses DOM polling in the browser smoke because the continuously
animated scene can make Playwright locator action-stability checks wait even
when the cue layer is already visible and correct.

## Phase 7G-R1 Harness Repair

Phase 7G-R1 repairs the Phase 7F browser validation harness only. It keeps the
Phase 7F replay display model, Phase 7G cue display, replay artifact inputs,
HOBS/SINR runtime, producer-truth parsing, and claim scans unchanged.

The Phase 7F browser validator now uses bounded DOM polling for replay shell
geometry and interaction checks instead of unbounded Playwright locator
geometry/action waits. Missing or hidden surfaces now fail with the named
selector and viewport context. The validator also uses the same non-persistent
Chromium context lifecycle style as Phase 7G and keeps before/after runtime
process cleanup scoped to processes started by the validation run.

## Claim Boundary

Allowed claims:

1. The selected regenerated and re-promoted `7`-beam producer bundle can drive
   read-only scene-adjacent replay cues after Phase 7C/7D/7F/7G validation.
2. `7` beams per satellite remains the only baseline MODQN evidence shape for
   this selected artifact.
3. The selected artifact has `85` intra-satellite beam-switch rows, `915`
   no-event rows, and `0` observed inter-satellite handover rows.

Forbidden claims:

1. No recovered frozen artifact claim.
2. No full paper-faithful reproduction claim.
3. No `19` or `37` trained-baseline MODQN evidence claim.
4. No HOBS/SINR live output as MODQN replay evidence claim.
5. No EE/HEA/Catfish/Multi-Catfish/Catfish-over-HEA scope claim.
6. No observed inter-satellite handover claim for the current artifact.

## Validation Results

| Check | Result |
| --- | --- |
| `npm run validate:modqn:phase2-identity-adapter` | Passed. Confirmed selected bundle schema, paper ID, 7-beam / 28-beam shape, `1000` rows, producer identity preservation, producer diagnostics rows, and `0` observed inter-satellite handover rows. |
| `npm run validate:modqn:phase4b-beam-layout-bridge` | Passed. Confirmed Phase 2 parse, `28` producer/core/Leo bridge records, `28000` bridged beam references, no row mutation, and 19/37 producer identity derivation guards. |
| `npm run validate:modqn:phase7c-replay-state-model` | Passed. Confirmed `10` replay slots, `1000` rows, `28` identity bridge records, `100` user identities, diagnostics namespace separation, `85` intra-satellite beam-switch rows, `915` no-event rows, and `0` inter-satellite handover rows. |
| `npm run validate:modqn:phase7d-replay-diagnostics` | Passed. Confirmed selected envelope identity, re-promoted artifact status, shape, diagnostics separation, fixture-only behavior, fail-closed inputs, and claim boundaries. |
| `npm run validate:modqn:phase7e-ui-mode-labeling` | Passed after Phase 7G edits. Confirmed desktop and narrow label visibility, no overlap with control surfaces, no browser console/page errors, and clean runtime cleanup. |
| `npm run validate:modqn:phase7f-replay-playback-shell` | Passed after Phase 7G-R1 harness repair. Confirmed selected producer path, Phase 7C-derived compact display model, desktop `1440x900` and narrow `390x844` playback shell visibility, play/pause/scrub/reset behavior, no playback/control overlap, replay/live separation, event counts `85` / `915` / `0`, no browser console/page errors, no unsupported visible claims, and clean owned-process cleanup. |
| `npm run validate:modqn:phase7g-replay-scene-cues` | Passed. Confirmed Phase 7F-derived cue state, desktop `1440x900` and narrow `390x844` cue visibility, scrub and play/pause cue updates, no overlap with major controls or scene slots, replay/live separation wording, event counts `85` / `915` / `0`, no console/page errors, and clean runtime cleanup. |
| `npm run lint` | Passed. |
| `git diff --check` | Passed with no output. |
| Unsupported `19` / `37` trained-baseline claim scan | Passed by inspection. Hits are negative boundary statements, validation labels, stop-rule text, or validator guard strings only. |
| HOBS/SINR-as-MODQN-replay-evidence claim scan | Passed by inspection. Hits are negative boundary statements, replay/live separation text, or validator guard strings only. |

## Deviations And Blockers

Deviations:

1. Phase 7G uses a scene-adjacent label layer instead of canvas beam
   highlighting because the selected producer replay beam IDs are not safely
   mapped to the current live scene beam visuals.
2. Phase 7G-R1 changes only the Phase 7F browser harness. It does not add
   Phase 7H behavior or change replay truth, HOBS/SINR runtime behavior, or
   producer artifacts.

Blockers:

1. If the selected producer artifact path or required surfaces disappear,
   Phase 7G fails closed through the Phase 7C/7F model checks instead of
   falling back to fixture-only output as evidence.
