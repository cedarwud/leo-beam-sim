# MODQN Baseline Phase 7H Showcase Hardening

**Date:** 2026-05-13
**Status:** `SHOWCASE_HARDENING_DELIVERY_CHECKPOINT_IMPLEMENTED`
**Target repo:** `/home/u24/papers/project/leo-beam-sim`
**Scope:** demo-readiness hardening for the Phase 7E/7F/7G replay evidence UI, focused browser smoke, and final checkpoint doc

Phase 7H hardens the existing read-only MODQN replay showcase path. It does
not add replay truth computation, connect replay rows to the HOBS/SINR live
runtime, recompute SINR, handover decisions, MODQN actions, rewards, geometry
truth, policy diagnostics, or provenance, and does not edit producer artifacts,
copied artifacts, vendored `src/core/**`, baseline KPI files, HandoverManager
behavior, or Phase 6 source-channel adoption behavior.

## Hardened Surfaces

Changed display and validation surfaces:

1. `src/modqn/replay-bundle/playback-shell.ts` adds a display-model validation
   helper for the accepted Phase 7F compact model.
2. `src/ui/ModqnReplayPlaybackShell.tsx` renders a visible fail-closed panel
   when the selected replay display model is missing or invalid instead of
   throwing or showing fallback evidence.
3. `src/ui/ModqnReplaySceneCues.tsx` renders a matching fail-closed cue strip
   when no valid playback display state is available.
4. `src/App.tsx` clears the cue display state if the playback shell reports an
   invalid display model.
5. `src/ui/ModeEvidenceStrip.tsx` keeps the Phase 7E labels visible and makes
   the replay/live separation text explicit.
6. `src/styles/main.scss` tightens desktop and narrow/mobile sizing for the
   evidence strip, playback shell, and cue layer.
7. `scripts/validate-modqn-phase7g-replay-scene-cues-browser.mjs` hardens
   cleanup for newly spawned browser processes.
8. `scripts/validate-modqn-phase7h-showcase-hardening.mjs` adds the focused
   Phase 7H validation script.
9. `package.json` adds `validate:modqn:phase7h-showcase-hardening`.

## Visible Claim Labels

The browser UI now continues to show these required boundaries in the normal
valid selected-artifact path:

| Surface | Visible wording |
| --- | --- |
| Replay mode | `MODQN replay - 7-beam producer artifact` |
| Evidence status | `accepted-7beam-baseline` |
| Artifact status | `newly regenerated / re-promoted`, `not recovered frozen artifact`, `not full paper-faithful reproduction` |
| Replay/live split | `HOBS/SINR live is separate`; HOBS/SINR controls do not modify MODQN replay artifact truth |
| Beam-count boundary | `7 = baseline MODQN evidence path`; `19/37 = sensitivity/demo only` |
| Playback boundary | `read-only source-slot playback`; `HOBS/SINR live controls separated` |
| Cue boundary | `MODQN replay artifact cues`; `scene-adjacent display only`; `not live HOBS/SINR state` |

The current accepted artifact event totals remain `85`
`intra-satellite-beam-switch` rows, `915` `none` rows, and `0`
`inter-satellite-handover` rows. The UI does not claim an observed
inter-satellite handover.

## Fail-Closed UX

Phase 7H adds a component-level display guard for the playback shell model. If
the UI path receives a missing or invalid selected replay display model, it
renders:

1. `MODQN replay unavailable - fail closed`;
2. `no accepted replay displayed`;
3. `selected producer artifact missing or invalid`;
4. `no fixture fallback promoted`; and
5. a blocked cue strip labeled `MODQN replay artifact cues unavailable`.

The fail-closed state is display-only. It does not attempt to repair the
artifact, promote fixture data, infer replay truth, or connect HOBS/SINR live
controls to MODQN replay evidence.

## Responsive Hardening

The Phase 7H browser smoke checks desktop `1440x900` and narrow `390x844`.
Observed compact heights from the passing run:

| Viewport | Evidence strip | Playback shell | Cue layer |
| --- | ---: | ---: | ---: |
| `1440x900` | `80px` | `190px` | `88px` |
| `390x844` | `130px` | `132px` | `78px` |

The smoke confirmed the evidence strip, playback shell, cue layer, scene
canvas, live tuning slot, and live status slot are visible and do not overlap
each other.

## Validation Results

Validation results recorded for the final Phase 7H checkpoint:

| Check | Result |
| --- | --- |
| `npm run validate:modqn:phase2-identity-adapter` | Passed. Confirmed selected regenerated `7`-beam bundle, `1000` rows, `85` intra-satellite beam switches, `915` none rows, and `0` inter-satellite handover rows. |
| `npm run validate:modqn:phase4b-beam-layout-bridge` | Passed. Confirmed `28` producer/core/Leo bridge records per row, `28000` bridged references, no row mutation, and 19/37 producer identity derivation guards. |
| `npm run validate:modqn:phase7c-replay-state-model` | Passed. Confirmed accepted envelope identity, `10` slots, `1000` rows, diagnostics namespace separation, event counts, and fail-closed fixture-only boundaries. |
| `npm run validate:modqn:phase7d-replay-diagnostics` | Passed. Confirmed selected envelope identity, re-promoted artifact status, diagnostics separation, fixture-only behavior, fail-closed inputs, and claim boundaries. |
| `npm run validate:modqn:phase7e-ui-mode-labeling -- http://127.0.0.1:5173/` | Passed. Confirmed desktop and narrow label visibility, no overlap, no console/page errors, and zero unsupported visible claims. |
| `npm run validate:modqn:phase7f-replay-playback-shell -- http://127.0.0.1:5173/` | Passed. Confirmed desktop and narrow playback visibility, play/pause/scrub/reset behavior, replay/live separation, no console/page errors, and clean browser cleanup. |
| `npm run validate:modqn:phase7g-replay-scene-cues -- http://127.0.0.1:5173/` | Passed after Phase 7H cleanup hardening. Confirmed desktop and narrow cue visibility, scrub and play/pause cue updates, replay/live separation, no console/page errors, and clean owned-process cleanup. |
| `npm run validate:modqn:phase7h-showcase-hardening` | Passed. Confirmed selected display model, fail-closed component rendering, desktop and narrow surface visibility, play/pause/scrub/reset updates, no overlap, no console/page errors, temporary server cleanup, and zero unsupported visible claims. |
| `npm run lint` | Passed. |
| `git diff --check` | Passed with no output. |
| Unsupported `19` / `37` trained-baseline claim scan | Passed by inspection. Hits are negative boundary statements, validator guard strings, or validation-scope text only. |
| HOBS/SINR-as-MODQN-replay-evidence claim scan | Passed by inspection. Hits are negative boundary or replay/live separation statements only. |

## Browser Runtime Cleanup

The final browser validation reused a local Vite server at
`http://127.0.0.1:5173/` that was started for this Phase 7H smoke pass. The
Phase 7E/7F/7G/7H validators closed their Chromium contexts and cleaned the
browser processes they started. Phase 7G and Phase 7H cleanup now perform a
bounded force-kill pass for newly spawned browser children that survive the
graceful SIGTERM pass.

The owned Vite server was stopped after validation. Pre-existing MCP/browser
processes and an unrelated pre-existing `npm run dev` process were not
terminated by this checkpoint.

## Deviations And Blockers

Deviations:

1. The Phase 7H fail-closed UX validates the UI display-model path. Browser
   JavaScript still cannot read the external producer artifact path directly;
   artifact presence remains enforced by the Node-side validators before the
   browser smoke starts.
2. Phase 7H keeps the existing source-slot replay granularity. It does not add
   row-level playback or canvas beam highlighting.

Blockers:

1. None for the selected regenerated and re-promoted `7`-beam artifact at the
   time this checkpoint was written.
2. If the selected producer artifact path or required surfaces disappear again,
   the validation chain fails closed before demo smoke instead of promoting
   fixture data as evidence.
