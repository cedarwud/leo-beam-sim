# Mini-SDD — Director Handover Cinematic Replay (+ live-slow-mo as a selectable mode)

> **Status:** DESIGN (authored 2026-06-02). Extends Phase 2 Director (`docs/showcase-master-sdd-v2.md` §5). Implementation deferred to a fresh session; group with the two Phase-2 Director deferred items into a "Director Mode v2 / cinematic" mini-phase.
> **Owner discipline:** Opus = architect (this SDD) / Codex = impl (codex quota must be restored first; else Opus + adversarial-workflow substitute).

## 1. Why

Shipped Phase 2 Director is **manual + live**: the `[Intra/Inter-HO Focus]` buttons (`src/ui/DirectorControls.tsx`) trigger a camera focus + **0.05× slow-mo applied to the ongoing live sim**, with manual `[Exit]`. UX problems the user hit:

1. Buttons are often **disabled** — by design (Rule#8): they enable only when `directorFocusEnabled` (live-sim + `sinr-live`/`modqn-live-cell-preview` lane + live-walker rail) AND `handoverRailEvents` currently carries a real intra/inter event (`App.tsx:1416-1441`). Catching that window manually is fiddly.
2. The user's actual desire = a **deliberate "handover cinematic"**: press → play a choreographed slow-motion of *that handover* (arranged camera + presentation) → **auto-return to normal at the end**. Not "slow down whatever is happening now."

This matches the user's original §1.1 vision ("Director Mode = auto camera tour + time-dilation"). The live-slow-mo behavior stays, as a **selectable mode**.

## 2. Two modes (user-selectable)

| Mode | Behavior | Exit |
|---|---|---|
| **Live focus + slow-mo** (existing) | Focus current live sim, 0.05× slow-mo, camera holds on the focused UE. Sim keeps advancing slowly at the current time. | Manual (`[Exit]` / Esc / canvas click) |
| **Cinematic replay** (NEW, default) | Seek to the target handover event, play *forward* through the event window at 0.05× with arranged camera, then **auto-restore**. | Auto at window end (or user-interrupt) |

**UI:** a mode toggle/checkbox selects which behavior the `[Intra/Inter-HO Focus]` buttons perform. (There is NO slow-mo checkbox today — slow-mo is auto-bundled into the focus action; the existing ControlBar `spotlight` checkbox at `ControlBar.tsx:288` is a *different* older effect — highlight serving beam — not the Director slow-mo.) The toggle is NEW.

## 3. Cinematic replay flow (the new path)

1. **Trigger** = `[Intra-HO Focus]` or `[Inter-HO Focus]`, still gated on a real `handoverRailEvents` event of that kind (`directorIntraEnabled`/`directorInterEnabled`, `App.tsx:1435-1441`) — Rule#8 preserved.
2. **Resolve target event** = the **next** intra/inter event at-or-after the current rail time; if none ahead, the **first** event of that kind in the window. (`handoverRailEvents` carries `kind` + time.)
3. **Playback window** = `[event.tSec − LEAD_IN, event.tSec + LEAD_OUT]` (defaults: `LEAD_IN ≈ 2s`, `LEAD_OUT ≈` HO dwell/settle; **confirm at impl**).
4. **Enter cinematic FSM phase** (extend the shipped `idle→acquiring→focused→restoring→idle`): fade-out overlay (mask the seek) → `seek` timeline to window start (`handleTimelineSeek` `App.tsx:1379` / `seekToTimelineFrame` `useSimulation.ts:317`) → camera pre-position to focus pose (intra = tight beam close-up / inter = wide satellite-context — already distinct in MainScene) → fade-in.
5. **Play FORWARD** at `DIRECTOR_FOCUS_SPEED = 0.05×` (`usePlaybackControls.ts:6,34`) through the window; camera holds/tracks the focus.
6. **Auto-end** when `currentTime ≥ window.end` → restoring phase: tween camera back + restore speed + re-enable OrbitControls + resume normal playback.
7. **User-interrupt** (Esc / canvas pointer-down) any time → restore early (existing interrupt path).

## 4. Transition — the "前面畫面怎麼處理" smoothness piece (user-flagged)

The seek-jump (current time → window start) is masked by a brief **fade overlay** (dip-out → seek + camera pre-position → fade-in), ~250–400ms — standard cutscene cut. **Open at impl (per user "還要再確認過"):** fade style (black vs dim) vs camera-tween-only-no-fade; fade duration; LEAD_IN/LEAD_OUT tuning; whether "first vs next" event; whether cinematic is default vs live-focus.

## 5. Governance (INV-3 / Rule#8) — clean

Replays **real sim state at a real handover event window**: seek targets a *real* event time, slow-mo is the *existing single* `effectiveSpeed` chain (no second multiplier), camera is presentation-only (leo-beam-sim owns camera). **No fabricated motion or data.** Buttons stay gated on real `handoverRailEvents` events; `directorFocusEnabled` keeps it to live-walker lanes (`sinr-live`/`modqn-live-cell-preview` live); replay-proof/artifact lanes inert (existing auto-exit + force-restore guards).

## 6. Reuse (verified anchors) vs new

**Reuse (all shipped):** `handoverRailEvents` (`App.tsx:1365`, kind+time); `directorFocusEnabled`/`directorIntraEnabled`/`directorInterEnabled` (`App.tsx:1416-1441`); timeline seek (`handleTimelineSeek` `App.tsx:1379`, `seekToTimelineFrame` `useSimulation.ts:317`); `cameraTweenRef` focus + intra/inter framing + ownership FSM (`MainScene.tsx`, `useCameraControls`); `DIRECTOR_FOCUS_SPEED` (`usePlaybackControls.ts:6`); `DirectorControls.tsx` buttons.

**New:** mode toggle UI; cinematic FSM phase (seek → play-window → auto-end); target-event + window-bounds resolver (pure); fade overlay; auto-end trigger.

## 7. Slice plan ("Director Mode v2 / cinematic" mini-phase — group with §5 deferred a/b)

- **D1** — pure target-event + window-bounds resolver (`resolveCinematicReplayWindow(events, kind, nowSec)`), tested.
- **D2** — cinematic FSM phase (seek → 0.05× play through window → auto-end) in `useCameraControls`/`MainScene`, reusing `cameraTweenRef` + slow-mo.
- **D3** — fade-overlay transition.
- **D4** — mode toggle UI (live-focus ↔ cinematic) in DirectorControls/ControlBar.
- **D5** — (Phase-2 deferred a) cone-raise: auto-switch `explain-handover` preset on focus.
- **D6** — (Phase-2 deferred b) inter-HO framing on the specific source/target satellite pair.
- **D7** — extend `validate:phase-c:camera-preset`: cinematic FSM inert on non-live-walker lanes, auto-end restores controls+speed, gated on real events; + a target-event-resolver test.

## 8. Sequencing

No cross-repo gate, small, high demo value → can run BEFORE or in parallel with P1b. User to choose order. Codex quota must be restored for the proven loop (else Opus + adversarial-workflow substitute, as used for Phase-3 S4/S5).
