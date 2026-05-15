# MODQN Demo Simplify — Mini SDD

Status: draft (awaiting user sign-off)
Owner: leo-beam-sim UI + handover policy glue
Scope: reduce all MODQN-related UI surface to two categories (read-only status,
interactive controls) and wire ω weights to live handover behavior via a
stub formula on the existing `sinr-offset` HandoverManager, so the demo
visibly couples slider → handover change without vendoring the full
`ModqnBaselineAdapter` yet.
Non-scope: vendoring `ModqnBaselineAdapter`; changing `HandoverManager`
internals; touching producer truth, replay bundle, or scene engine; new
visual-showcase-v1 fields.

## 1. Motivation

User feedback: current MODQN-related UI shows 11 components carrying
producer-debug language (`fail-closed`, `accepted-7beam-baseline`,
`phase7h`, `Selected serving`, `Reward vector`, `Source slot`, ...) that
non-MODQN viewers cannot interpret. User wants the surface reduced to
exactly two categories:

1. **真重要 (read-only status)**: a small block confirming "MODQN policy is
   active and replay is loaded", plus a one-line live-vs-replay HO compare.
2. **可調影響畫面 (interactive controls)**: sliders whose movement is
   immediately visible in 3D scene handover behavior.

ω weight tuning is the paper PAP-2024-MORL-MULTIBEAM's MO-RL knob (does not
require retraining); other hyperparameters (lr, γ, hidden dim, etc.) need
retraining and stay disabled.

## 2. Two-category UI spec

### 2.1 Read-only status block — `ModqnStatusReadout`
Three lines, plain English, no producer-debug terms:

```
✓ MODQN policy: active
Replay loaded · 10 slots
Handovers · live N | replay 85
```

- `active` is hard-coded for stub phase; will become a real adapter status
  string in Tier 2.
- `live N` reads `simState.hoCount`; `replay 85` reads
  `MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL.eventCounts.intra-satellite-beam-switch + inter-satellite-handover`.

### 2.2 Interactive control block — `ModqnObjectiveControls`
Three sliders (0–1 each, sum normalized to 1 on any change), plus an
`Apply` / `Reset` row, plus a folded hyperparameter list:

```
Objective weights
  Throughput      ●━━━━ 0.40
  Handover        ━━●━━ 0.30
  Load balance    ━━━●━ 0.30
[Apply]   [Reset]

▸ Hyperparameters (require retrain)
    learning rate   1e-3  🔒
    discount γ       0.99  🔒
    hidden dim       128   🔒
    network depth    2     🔒
    batch size       64    🔒
```

Apply commits ω into runtime; Reset returns to profile defaults `[0.4, 0.3, 0.3]`.
Hyperparameter chips are visually `disabled` with a lock icon and a hint
("Requires retrain. Tier 2 enables this surface.").

## 3. ω → effective `sinr-offset` policy formula (stub)

`applyHandoverPolicyTuning` extends to consume `modqnWeights`:

```ts
type ModqnObjectiveWeights = {
  throughput: number;   // ω_t
  handover:   number;   // ω_h
  loadBalance:number;   // ω_lb
};

effectiveOffsetDb     = clamp(baseOffsetDb     + 6 * ω_h - 3 * ω_t, 0, 10);
effectiveTriggerTime  = clamp(baseTriggerTime  + 2 * ω_lb,          0, 15);
```

Rationale (direction matches paper MO objectives):
- raising `ω_handover` → stickier (larger offset, fewer HOs).
- raising `ω_throughput` → more aggressive (smaller offset, more eager HOs).
- raising `ω_loadBalance` → longer TTT (commit slower, smoother distribution).

Constants `6`, `-3`, `2` are demo coefficients chosen so a 0→1 slide
produces a visibly different handover count within ~30 s sim time at
default `baseOffsetDb = 3`, `baseTriggerTime = 3.5`. Documented here so a
future Tier 2 vendor swap (replacing this with `adapter.selectAction()`)
keeps the same external knob shape.

The formula is internal to `applyHandoverPolicyTuning`; `HandoverManager`
still receives a single effective `policy: 'sinr-offset'` configuration. No
engine change.

## 4. Component lifecycle (keep / drop visual / fold offscreen)

| Component | Action | Why |
|---|---|---|
| `MODQNProofStrip` | Rewrite as `ModqnStatusReadout` shell (3-line block). Old proof testids kept inside its offscreen container. | Convert to read-only block |
| `ModqnReplayPlaybackShell` | Wrap entire JSX in `<div className="modqn-offscreen">` — visually hidden, DOM + testids retained | Play/scrub had no scene coupling; user-flagged dead UI |
| `ModqnReplaySceneOverlay` | Remove from `<MainScene>` render; mount via offscreen container at App root for testid retention | Center 3D overlay confused user; not coupled to slider |
| `ModqnReplaySceneCues` | Offscreen | Producer-debug |
| `ModqnBaselineReplayEvidence` | Offscreen | Producer-debug |
| `ModqnBaselineHandoverControls` (heading panel) | Offscreen | Duplicate of new readout |
| `ModeEvidenceStrip` (claim boundaries) | Offscreen | Producer-debug |
| `HandoverPolicyControls` (7 sliders) | Offscreen | Replaced by ω surface |
| `MODQN replay` sidebar tab | Re-label `MODQN status`; content becomes `ModqnStatusReadout` | Two-category alignment |
| `Live handover` sidebar tab | Re-label `MODQN controls`; content becomes `ModqnObjectiveControls` | Two-category alignment |
| `Signal formula` sidebar tab | Unchanged | Out of scope |
| `Live status` sidebar tab (right side) | Unchanged | InfoPanel + DiagnosticsDrawer still useful |
| `DiagnosticsDrawer` | Unchanged | Already collapsed v3 |
| `ControlBar` | Unchanged | Out of scope |
| `MainScene` 3D | Unchanged save for removal of `ModqnReplaySceneOverlay` | Out of scope |

## 5. testid preservation

All 21 testids from `modqn-demo-readability-redesign-mini-sdd.md` §6 must
still grep with `count >= 1` after this work. All 7 `modqn-proof-*` new
testids likewise. Plus new additive testids:

- `modqn-status-readout`
- `modqn-objective-controls`
- `modqn-objective-weight-throughput`
- `modqn-objective-weight-handover`
- `modqn-objective-weight-loadbalance`
- `modqn-objective-apply`
- `modqn-objective-reset`
- `modqn-hyperparams-list`

`validate:vc:modqn-proof-strip` validator continues to pass (uses
`state: 'attached'` for sparkline; off-screen DOM still attached).

## 6. Engine surface changes

| File | Change | LOC |
|---|---|---|
| `src/handoverPolicyTuning.ts` | Add `ModqnObjectiveWeights` type; thread `modqnWeights` through `HandoverPolicyTuningState`; extend `applyHandoverPolicyTuning` to fold ω into `offsetDb` / `triggerTimeSec` via §3 formula | +50 |
| `src/profiles/types.ts` | Optional `modqnWeights?: ModqnObjectiveWeights` on Profile.handover; default `[0.4, 0.3, 0.3]` | +5 |
| `src/profiles/*.json` | Add `modqnWeights` to each profile (or rely on default) | +12 |
| `src/ui/ModqnStatusReadout.tsx` | New, ~70 LOC | +70 |
| `src/ui/ModqnObjectiveControls.tsx` | New, ~180 LOC (3 normalized sliders + Apply/Reset + hyperparam list) | +180 |
| `src/ui/modqn-controls/HyperparamChip.tsx` | New, ~35 LOC | +35 |
| `src/App.tsx` | Replace sidebar tab contents; wire `modqnWeights` state and `onApply` callback; wrap legacy components in `<div className="modqn-offscreen" aria-hidden="true">` | ±60 |
| `src/styles/main.scss` | New `.modqn-offscreen` class (clip-rect off-screen); new readout + control panel styles | +90 |
| `src/scene/MainScene.tsx` | Remove `<ModqnReplaySceneOverlay>` render call | -1 |

No `HandoverManager` change. No `handover-manager.ts` constructor change.
No new `policy` value in `Profile['handover']`.

## 7. Tier 2 replacement seam

When a future PR vendors `ModqnBaselineAdapter`:

1. Add `policy: 'modqn-baseline'` branch in `HandoverManager`.
2. Replace §3 stub formula in `applyHandoverPolicyTuning` with a no-op
   pass-through for `modqnWeights` (the adapter consumes them directly).
3. UI does not change: the same three ω sliders, same testids, same
   labels. Apply now triggers `adapter.setWeights(...)`.

This SDD locks the ω knob external shape so Tier 2 is a backend swap.

## 8. Acceptance checklist (must pass before merge)

- [ ] `npm run lint` pass
- [ ] All 21 SDD §6 testids + 7 `modqn-proof-*` + 8 new testids grep ≥ 1
- [ ] `validate:vc:modqn-proof-strip` pass
- [ ] `validate:phase6b:handover-policy-controls` pass
- [ ] `validate:phase6c:handover-policy-placement` pass
- [ ] Visual smoke at 1440×900: status block 3 lines visible, controls
      block 3 sliders + Apply/Reset visible, no overflow on either
- [ ] Drag `Handover` 0→1 + Apply: live HO count over next 30 s sim time
      observably lower than at 0
- [ ] Drag `Throughput` 0→1 + Apply: live HO count over next 30 s sim time
      observably higher than at 0
- [ ] `prefers-reduced-motion: reduce` honored
- [ ] No producer-truth string altered (grep audit)

## 9. Risks

| Risk | Mitigation |
|---|---|
| §3 coefficients produce too subtle a change | Bumping `6` / `-3` / `2` is one-line edit; test during smoke and adjust before merge |
| ω normalization (sum=1) on slider drag confuses users | Show explicit small print under sliders: "sum = 1; moving one rebalances others" |
| Offscreen container rendering still costs frames | `.modqn-offscreen` uses `clip: rect(0,0,0,0); position: absolute` — DOM exists but no paint; verified pattern from prior fix `1f4d1d2` |
| `ModqnReplaySceneOverlay` removal breaks a Playwright suite | Grep `tests/` for the testid `modqn-replay-scene-overlay` before merge; if found, render the overlay inside the App-root offscreen container |
| Profile JSON now needs `modqnWeights` everywhere | Provide a runtime default in `applyHandoverPolicyTuning` if undefined; profile JSON edit is additive |

## 10. Open decisions (none)

All decisions locked by user dialog 2026-05-15:
- ω slider stub-mode wiring (not full adapter vendor) — confirmed.
- Two-category UI structure (status + controls) — confirmed.
- English-only UI text — confirmed; Tier 2 vendor SDD remains separate.
