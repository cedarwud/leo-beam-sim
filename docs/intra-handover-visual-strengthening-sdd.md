# Intra-Handover Visual Strengthening Mini-SDD

**Date:** 2026-05-14
**Status:** Slice A — Live-end implementation
**Target repo:** /home/u24/papers/project/leo-beam-sim
**Scope:** Live-end intra-satellite handover viz strengthening (arrow connector +
extended recentSource linger)

## 1. Purpose

When the live HOBS/SINR runtime emits an `intra-switch` HandoverEvent, the
3D scene currently gives the viewer no visible cue. The previous serving
beam and new serving beam often overlap in 3D space (same satellite,
adjacent beam IDs), so role-color and dash changes are washed out by beam
overlap. Text labels in callouts are too small and slow to register.

This slice addresses live-end intra-handover visibility only. Replay-end
remains Phase 7K display-only and is not touched.

## 2. Scope

### 2.1 Goals
- Add a transient 3D arrow connector from the previous beam endpoint to
  the new beam endpoint at the moment an `intra-switch` HandoverEvent
  emits, with 2.4s fade-out.
- Extend `RECENT_HO_LINGER_SEC` from 2 to 5 and the matching
  `RECENT_HO_FADE_WINDOW_SEC` so the previous beam stays visible long
  enough to register.
- Respect `prefers-reduced-motion`: arrow renders static dashed instead
  of animated.

### 2.2 Non-goals
- No replay-end visual changes.
- No change to `handover-manager.ts` decision logic.
- No new producer-to-scene identity contract.
- No camera focusing, sound cue, or auto-pause.
- No inter-satellite handover viz.

## 3. Architecture

### 3.1 Event surface

`runtimeFrameStep.ts` already populates `state.recentHo` from the most
recent `HandoverEvent`. Add a separate transient field
`state.intraHandoverEvent: IntraHandoverEvent | null`:

interface IntraHandoverEvent {
  satId: string;
  fromBeamId: number;
  toBeamId: number;
  triggeredAtSec: number;
  expiresAtSec: number;
}

Populated only when the just-emitted event has
`action === 'intra-switch'` and both `fromBeamId` and `toBeamId` are
non-null. Cleared when `simTimeSec >= expiresAtSec`. TTL constant
`INTRA_HANDOVER_ARROW_SEC = 2.4`.

### 3.2 Linger extension

In `runtimeFrameStep.ts`: `RECENT_HO_LINGER_SEC` 2 → 5.
In `constants/beamRoleTokens.ts`: `RECENT_HO_FADE_WINDOW_SEC` 2 → 5.
Fade amplitude (`recentSource.fade.amplitude`): 0.06 → 0.10.

### 3.3 New viz component

`src/viz/IntraHandoverArrow.tsx`:
- Subscribes to VizFrame's `intraHandoverEvent` field
- Resolves `fromBeam` and `toBeam` endpoint world coordinates via the
  same beam-endpoint resolution path already used by `SatelliteBeams.tsx`
  callouts. If endpoint coordinates are not already on `VizFrame`,
  surface them via `useBeamViz.ts` rather than recomputing.
- Draws a quadratic Bezier arc with arrowhead at the `toBeam` endpoint
- Animates opacity from 1 → 0 over `INTRA_HANDOVER_ARROW_SEC`
- Honors `runtime.reducedMotion`: skips animation, renders static dashed
  line at constant 0.7 opacity
- Uses `BEAM_ROLE_TOKENS.intraHandoverArrow.color` (new token entry,
  cyan-leaning to match serving role family)

### 3.4 Mount

In `MainScene.tsx`: mount `<IntraHandoverArrow vizFrame={vizFrame}
runtime={runtime} />` after `<SatelliteBeams />` so the arrow draws on
top.

## 4. Forbidden claims

- No `19` / `37` trained-baseline MODQN evidence claim.
- No claim that this viz is producer-to-scene identity proof.
- No claim that the arrow visualizes MODQN replay evidence.
- No HOBS/SINR live output as MODQN replay evidence claim.
- No EE / HEA / Catfish scope.
- No observed inter-satellite handover claim for the selected artifact.

## 5. Validation

New validator `scripts/validate-vc-intra-handover-arrow.tsx` (V3 browser):
- Self-start dev server (do NOT pass custom APP_URL)
- Drive simulation to force an `intra-switch` event via existing forced-
  role fixture path or runtime control hook
- Assert arrow component appears within 100ms of event
- Sample opacity at t≈0.5s, t≈1.5s, t≈2.4s — must be strictly decreasing
- Assert arrow removed by t≈2.6s
- Assert with `prefers-reduced-motion: reduce` matchMedia: arrow renders
  static dashed, no opacity tween
- Assert previous beam `recentSource` visible at t≈4s, removed by t≈5.5s
- Assert console errors == 0, page errors == 0
- Assert no forbidden visible claims (reuse existing claim-scan
  boilerplate from `validate-modqn-phase7e-ui-mode-labeling-browser.mjs`)
- After run, owned dev server and browser automation processes cleaned
  up (`newDevServerProcessesAfterCleanup == []`,
  `newBrowserAutomationProcessesAfterCleanup == []`)

## 6. Acceptance

Slice A is done when all of:
1. `npm run validate:vc:intra-handover-arrow` passes.
2. `npm run validate:vc2d:role-pulse-envelopes` passes (update its
   assertions in the same commit if the linger constant change breaks
   them).
3. All Phase 7C → 7K-R2 validators still pass.
4. `npm run lint` passes.
5. mini-SDD landed at `docs/intra-handover-visual-strengthening-sdd.md`.
6. Single commit pushed to `origin/main` fast-forward.

## 7. Out of scope

- Baseline integration proof badge → future Slice B.
- Live tuning panel discoverability → future Slice C.
- Replay scene cue strengthening → Phase 7K display-only locked.
- Inter-satellite handover viz → future.
