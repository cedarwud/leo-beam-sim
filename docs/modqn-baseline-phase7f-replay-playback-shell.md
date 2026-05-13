# MODQN Baseline Phase 7F Replay Playback Shell

**Date:** 2026-05-13
**Status:** `READ_ONLY_REPLAY_PLAYBACK_SHELL_IMPLEMENTED`
**Target repo:** `/home/u24/papers/project/leo-beam-sim`
**Scope:** read-only replay playback shell, compact browser smoke, and checkpoint doc

Phase 7F adds a small read-only playback shell for the Phase 7C MODQN replay
envelope. It does not connect MODQN replay rows to the live HOBS/SINR runtime,
does not recompute SINR, handover decisions, MODQN actions, rewards, geometry
truth, or policy diagnostics, and does not edit producer artifacts, copied
artifacts, vendored `src/core/**`, baseline KPI files, HandoverManager
behavior, or Phase 6 source-channel adoption behavior.

## Playback Surface

UI component:

`src/ui/ModqnReplayPlaybackShell.tsx`

Display helper:

`src/modqn/replay-bundle/playback-shell.ts`

The shell displays:

1. `MODQN replay - 7-beam producer artifact`
2. `accepted-7beam-baseline`
3. read-only source-slot playback controls
4. current source slot
5. current source row range
6. representative focus source row for the current slot
7. selected serving and previous serving from producer truth
8. producer handover event kind
9. scalar reward and reward vector from producer truth
10. producer diagnostics status

Playback steps source slots only. The Phase 7F display model uses one
representative source row per slot, the first row in producer order for that
slot, and preserves the slot's producer row range and event counts. It does
not create interpolated decisions, handover events, rewards, diagnostics, or
geometry truth.

The selected artifact remains:

`/home/u24/papers/modqn-paper-reproduction/artifacts/phase-1c-regenerated-7beam-baseline-2026-05-11/phase-03a-replay-bundle-v1`

The compact shell model is validated against the Phase 7C envelope before the
browser smoke runs. If the selected producer path or a required surface is
missing, the Phase 7F validator fails closed.

## Replay Truth Preservation

Phase 7F reads from the Phase 7C envelope shape and keeps replay truth
source-owned:

1. source slot indexes and row ranges come from `replaySlots`;
2. selected and previous serving come from `producerTruth`;
3. handover event kind comes from `producerTruth.handoverEvent.kind`;
4. scalar reward and reward vector come from `producerTruth`;
5. policy diagnostics status comes from producer diagnostics presence; and
6. aggregate event counts remain `85` intra-satellite beam-switch rows, `915`
   no-event rows, and `0` observed inter-satellite handover rows.

The shell owns only UI playback state: play/pause, scrub slot offset, loop,
and reset. These controls update displayed source slot and row summary only.

## Replay / Live Separation

The Phase 7F shell is placed below the Phase 7E mode evidence strip and above
the live scene row. The existing control bar, signal tuning panel, signal
status panel, diagnostics drawer, HOBS/SINR formulas, and live runtime remain
visually separate from MODQN replay playback.

HOBS/SINR controls do not affect replay artifact truth. HOBS/SINR live output
is not MODQN replay evidence.

## Claim Boundary

Allowed claims:

1. The selected regenerated and re-promoted `7`-beam producer bundle can be
   displayed as evidence-capable MODQN replay after Phase 7C/7D/7F validation.
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

## Validation

Focused validator:

```bash
npm run validate:modqn:phase7f-replay-playback-shell
```

The validator:

1. loads the Phase 7C replay envelope from the selected producer path;
2. checks the compact display model is derived from that envelope;
3. checks source-slot stepping, row ranges, event counts, producer truth
   summary fields, and diagnostics status;
4. starts or reuses a local app server;
5. checks desktop `1440x900` and narrow `390x844` viewports;
6. confirms play/pause, scrub, reset, and loop controls are visible and usable;
7. confirms playback changes displayed source slot and row range only;
8. confirms labels do not overlap the control bar, evidence strip, scene
   canvas, live tuning slot, or live status slot; and
9. scans visible text for unsupported `19`/`37` trained-baseline claims and
   HOBS/SINR-as-MODQN-replay-evidence claims.

## Validation Results

Validation results are recorded after the Phase 7F implementation run:

| Check | Result |
| --- | --- |
| `npm run validate:modqn:phase2-identity-adapter` | Passed. Confirmed selected bundle schema, paper ID, 7-beam / 28-beam shape, `1000` rows, producer identity preservation, producer diagnostics rows, and `0` observed inter-satellite handover rows. |
| `npm run validate:modqn:phase4b-beam-layout-bridge` | Passed. Confirmed Phase 2 parse, `28` producer/core/Leo bridge records, `28000` bridged beam references, no row mutation, and 19/37 producer identity derivation guards. |
| `npm run validate:modqn:phase7c-replay-state-model` | Passed. Confirmed `10` replay slots, `1000` rows, `28` identity bridge records, `100` user identities, diagnostics namespace separation, `85` intra-satellite beam-switch rows, `915` no-event rows, and `0` inter-satellite handover rows. |
| `npm run validate:modqn:phase7d-replay-diagnostics` | Passed. Confirmed selected envelope identity, re-promoted artifact status, shape, diagnostics separation, fixture-only behavior, fail-closed inputs, and claim boundaries. |
| `npm run validate:modqn:phase7e-ui-mode-labeling` | Passed after Phase 7F edits. Confirmed desktop `1440x900` and narrow `390x844` label visibility, no overlap with control surfaces, and no browser console/page errors. |
| `npm run validate:modqn:phase7f-replay-playback-shell` | Passed. Confirmed selected producer path, Phase 7C-derived compact display model, `1000` rows, `10` source slots, event counts `85` / `915` / `0`, desktop and narrow viewport visibility, no playback/control overlap, play/pause/scrub/reset behavior, replay/live separation, and no browser console/page errors. |
| `npm run lint` | Passed. |
| `git diff --check` | Passed with no output. |
| Unsupported `19` / `37` trained-baseline claim scan | Passed by inspection. Hits are negative boundary statements, validator guard strings, stop-rule text, or validation-scope text only. |
| HOBS/SINR-as-MODQN-replay-evidence claim scan | Passed by inspection. Hits are negative boundary statements or replay/live separation text only. |
| Browser runtime cleanup | Passed. Phase 7E and 7F validators stopped their temporary Vite dev servers and closed their Chromium contexts. No owned Phase 7E/7F browser or temporary dev-server processes remained after cleanup. |

## Deviations And Blockers

Deviations:

1. Playback is source-slot granular for Phase 7F. It does not expose all
   `1000` rows in the browser UI, avoiding a copied 12 MB timeline artifact in
   `leo-beam-sim`.

Blockers:

1. None at implementation time. If the selected producer artifact path or
   required surfaces disappear, the Phase 7F validator fails closed.
