# MODQN Demo Controls Extension — Mini SDD

Status: draft (awaiting user sign-off)
Owner: leo-beam-sim UI + policy stub
Scope: extend the MODQN simplified demo with a substantial retrain-required
parameter surface, a Retrain stub workflow (~8 s fake training progress), a
mini reward curve readout, and policy versioning. Builds on
`docs/modqn-demo-simplify-mini-sdd.md` (already shipped Steps 1–7).
Non-scope: real training, real Q-network forward pass, vendoring
`ModqnBaselineAdapter`, scenario-level (sat count / altitude) controls.

## 1. Motivation

Current visible surface is too thin: 3 live ω sliders + 5 read-only
hyperparameter chips. User wants a richer interactive surface that
distinguishes two kinds of knobs and includes a Retrain action so the demo
narrative covers the full MODQN tuning loop:

1. **Live (runtime)** — ω scalarization weights; no retrain needed.
2. **Retrain-required (network)** — full training hyperparameters; editing
   them stages a draft, pressing Retrain runs an 8 s stub progress, then
   the "new policy" is applied to the live sim (engine still runs the
   sinr-offset stub formula; only policy version + status text changes).
3. Scenario / restart-level params (satellite count, altitude, FRF) stay
   out of scope for this extension; treat as future work.

## 2. Two control regions

### 2.1 Left sidebar — Controls
```
Live objectives
  Throughput   ●━━━━ 0.40
  Handover     ━━●━━ 0.30
  Load balance ━━━●━ 0.30
  [Apply live]    [Reset]

Network (requires retrain)
  Learning rate     1e-3  ●━━━━━
  Discount γ        0.99  ━━━━●━
  Hidden dim        128   ━━●━━━
  Network depth     2     ●━━━━━
  Batch size        64    ━●━━━━
  Optimizer         [Adam ▾]
  Double DQN        [☑ on]
  Dueling           [☐ off]
  ε start           1.0   ●━━━━━
  ε end             0.05  ●━━━━━
  Target update τ   0.01  ●━━━━━
  Replay buffer     50000 ━━━●━━
  Episodes          100   ━━●━━━

  [Retrain →]   (enabled only when draft differs from active policy)
```

`[Apply live]` only commits ω; `[Retrain →]` commits the full draft via the
stub workflow defined in §4.

### 2.2 Right sidebar — Status
```
✓ MODQN policy: active
Version:        v1
Trained at:     2026-05-15 02:55:42
Episodes:       100
Final reward:   0.62

Live KPIs
  inter · live N | replay M
  intra · live X | replay Y
  effective · offset N dB · TTT M s

Reward curve (last 100 episodes)
  ▁▁▂▂▃▄▅▆▆▆▇▇█

Retrain status
  idle
```

When Retrain runs, the `Retrain status` line becomes
`training · episode K / N` then `converged · deploying` then `idle`. The
reward curve fills in as training "progresses". Policy version bumps `v1 → v2`,
trained timestamp refreshes, final reward updates.

## 3. Parameter table

| Field | Type | Default | Range | Retrain? |
|---|---|---|---|---|
| ω_throughput | slider | 0.40 | 0–1 (normalize sum=1) | no — live |
| ω_handover | slider | 0.30 | 0–1 | no — live |
| ω_loadBalance | slider | 0.30 | 0–1 | no — live |
| learningRate | slider (log) | 1e-3 | 1e-5–1e-1 | yes |
| discountGamma | slider | 0.99 | 0.8–0.999 | yes |
| hiddenDim | slider (int) | 128 | 16–512 | yes |
| networkDepth | slider (int) | 2 | 1–5 | yes |
| batchSize | slider (int) | 64 | 8–512 | yes |
| optimizer | select | 'Adam' | Adam / SGD / RMSprop | yes |
| doubleDqn | checkbox | true | bool | yes |
| dueling | checkbox | false | bool | yes |
| epsilonStart | slider | 1.0 | 0–1 | yes |
| epsilonEnd | slider | 0.05 | 0–0.5 | yes |
| targetUpdateTau | slider (log) | 0.01 | 1e-4–1.0 | yes |
| replayBufferSize | slider (int) | 50000 | 1000–500000 | yes |
| episodes | slider (int) | 100 | 10–1000 | yes |

Total: 3 live + 13 retrain = 16 control surfaces (was 3 live + 0 + 5 chip).

## 4. Retrain stub workflow

State machine (held in App.tsx):
```
status: 'idle' | 'training' | 'deploying'
progress: 0..100
episodeNow: 0..episodes
rewardCurve: number[]   // grows during training
policyVersion: 'v1' | 'v2' | ...
trainedAtMs: number
finalReward: number
```

On Retrain click:
1. Snapshot draft network params + ω → call `startRetrain(params)`.
2. `setRetrainStatus('training'); setProgress(0); setRewardCurve([])`.
3. Use `setInterval(every 80 ms, 100 ticks total = 8 s):`
   - `progress += 1`; `episodeNow = round((progress/100) * episodes)`.
   - Append synthetic reward sample = `0.2 + 0.4 * (1 - exp(-progress/30)) + (rand() - 0.5) * 0.05`.
4. At progress=100: `setRetrainStatus('deploying')`; wait 600 ms;
   `setRetrainStatus('idle'); policyVersion = next; trainedAtMs = now;
   finalReward = lastReward; activePolicyParams = draftParams`.
5. Sim continues using the same sinr-offset formula but `versionTag`
   updates everywhere; future Tier 2 vendor swap replaces the synthetic
   reward generator with real training output.

Cancel button while training: optional; out of scope (no abort path).

`prefers-reduced-motion: reduce` → bypass animation, jump straight from
`idle` to `deploying` to `idle` over 200 ms; reward curve renders final state
only.

## 5. Files touched

| File | Change | LOC |
|---|---|---|
| `src/handoverPolicyTuning.ts` | Extend `ModqnObjectiveWeights` and policy state to carry `networkParams: ModqnNetworkParams` (typed dict of the 13 fields above). `applyHandoverPolicyTuning` keeps ω→offset/TTT stub formula unchanged; `networkParams` is plumbed through but does not alter engine numbers (stub). | +90 |
| `src/profiles/types.ts` | Add `modqnNetworkParams?: ModqnNetworkParams` and `modqnPolicyVersion?: string` to `Profile.handover`. | +12 |
| `src/ui/ModqnObjectiveControls.tsx` | Adds the Network section: 13 inputs (sliders/select/checkbox), Retrain button, draft change detection separate from ω draft. | +260 |
| `src/ui/modqn-controls/NetworkParamInput.tsx` | New — single-row labeled input that picks slider/select/checkbox per param spec. | +130 |
| `src/ui/ModqnStatusReadout.tsx` | Adds version/trained/episodes/final-reward lines, mini reward sparkline, retrain status line. | +110 |
| `src/ui/modqn-controls/MiniRewardCurve.tsx` | New — 200×40 px canvas line chart; respects reduced-motion. | +90 |
| `src/App.tsx` | New state: `modqnNetworkDraft`, `modqnNetworkActive`, `retrainStatus`, `retrainProgress`, `episodeNow`, `rewardCurve`, `policyVersion`, `trainedAtMs`, `finalReward`. New callback `handleRetrain` running the §4 state machine. Threads everything to Controls + Readout. | +180 |
| `src/styles/main.scss` | New `.leo-modqn-network-section`, `.leo-modqn-retrain-button`, `.leo-modqn-mini-reward-curve`, `.leo-modqn-retrain-status`. | +100 |

Total new LOC ≈ 970. No engine, no producer-truth, no replay-bundle change.

## 6. testid preservation + additions

Keep all existing testids per `modqn-demo-readability-redesign-mini-sdd.md` §6
plus the 8 added by `modqn-demo-simplify-mini-sdd.md` plus the new
`modqn-proof-effective-policy` and `modqn-status-effective-policy`.

New additive testids:
- `modqn-network-section`
- `modqn-network-learning-rate`
- `modqn-network-discount-gamma`
- `modqn-network-hidden-dim`
- `modqn-network-depth`
- `modqn-network-batch-size`
- `modqn-network-optimizer`
- `modqn-network-double-dqn`
- `modqn-network-dueling`
- `modqn-network-epsilon-start`
- `modqn-network-epsilon-end`
- `modqn-network-target-update`
- `modqn-network-replay-buffer`
- `modqn-network-episodes`
- `modqn-retrain-button`
- `modqn-retrain-status`
- `modqn-retrain-progress`
- `modqn-policy-version`
- `modqn-policy-trained-at`
- `modqn-policy-final-reward`
- `modqn-mini-reward-curve`

## 7. Acceptance checklist

- [ ] `npm run lint` pass
- [ ] All 21 SDD-§6 + 8 simplify + 2 effective + 21 new testids grep ≥ 1
- [ ] `validate:vc:modqn-proof-strip` pass
- [ ] `validate:phase6b:handover-policy-controls` pass
- [ ] `validate:phase6c:handover-policy-placement` pass
- [ ] Drag ω → Apply live → `modqn-status-effective-policy` updates within
      one render
- [ ] Edit any Network param → Retrain enables; click → 8 s progress fills
      to 100; status transitions idle → training → deploying → idle;
      version bumps v1 → v2; reward curve fills
- [ ] `prefers-reduced-motion: reduce` → progress completes in ≤ 200 ms;
      no animation on reward curve
- [ ] No producer-truth field altered (grep audit)

## 8. Tier 2 swap seam

When `ModqnBaselineAdapter` is vendored:
- `applyHandoverPolicyTuning` stops folding ω into offset/TTT; `HandoverManager`
  gains `policy: 'modqn-baseline'` branch and consumes ω directly.
- Retrain stub becomes a real call (e.g., POST to a Python training process);
  the UI state machine in §4 stays the same.
- `networkParams` becomes the actual training config payload.

Nothing in §3 / §4 / §6 needs to change.

## 9. Open decisions

All bounded for sign-off:
1. Stub training duration **8 s** (fast enough to feel like a demo action;
   slow enough to read the progress).
2. Reward curve synthetic shape: monotonic-ish exponential with noise; not
   meaningful, purely cosmetic.
3. Version naming `v1, v2, ...` (no semver, no timestamp suffix).
4. No cancel-during-training button.

Sign off these and proceed.

## 10. Risk

| Risk | Mitigation |
|---|---|
| 13 network inputs balloon left sidebar height | Network section wrapped in `<details open>` by default; user can collapse; horizontal compact 2-column grid for small fields |
| Retrain progress confuses user as "real training" | Status text always says `stub · cosmetic`; Reward curve labelled `(simulated)` |
| `setInterval(80ms)` while user clicks Apply live mid-train | Apply live disabled while `retrainStatus !== 'idle'`; Retrain disabled while live Apply pending |
| Mini chart fails on SwiftShader headless | Canvas 2D fallback (no WebGL); respect reduced-motion |
| Memory leak in long demo from setInterval | clear on unmount + on status=idle transition |
