# MODQN Baseline Phase 6S Channel Runtime Adoption Gate

**Date:** 2026-05-12
**Status:** docs-only go/no-go gate
**Target repo:** `/home/u24/papers/project/leo-beam-sim`
**Decision:** `READY_FOR_PHASE6T_EXPERIMENTAL_CHANNEL_ADOPTION`

Phase 6S defines the go/no-go gate for any future behavior-changing adoption
of the vendored `src/core/channel/` helpers into the `leo-beam-sim` live
runtime. It does not implement runtime adoption, add validators, edit source
formulas, change profiles, change UI, touch replay or producer artifacts, or
run browser smoke.

Runtime adoption status after Phase 6S: **not adopted**.

## 1. Phase 6S Decision

**Decision: `READY_FOR_PHASE6T_EXPERIMENTAL_CHANNEL_ADOPTION`.**

This is a conditional readiness decision, not a runtime switch. Phase 6T may
open a narrow experimental source-backed channel-adoption change only because
the prior gate surfaces now exist:

1. Phase 6N defined the adapter identity, geometry, channel, DPC, interference,
   output, and claim-boundary contract.
2. Phase 6O added a read-only channel-adapter parity validator and fixture set.
3. Phase 6P captured deterministic HOBS/SINR KPI baselines for the current live
   runtime path.
4. Phase 6R guarded the shared non-React `runtimeFrameStep` boundary and proved
   that the current shared helper still uses the existing HOBS/SINR engine path.

The decision is limited to an experimental Phase 6T. It does not authorize a
default runtime flip, production claim, MODQN replay claim, handover-policy
rewrite, UI control expansion, beam-count expansion, replay mutation, or
producer-artifact change.

## 2. Phase 6T Adoption Boundary

Phase 6T must keep adoption behind an explicit non-default runtime/profile
mode. The baseline mode remains `HOBS/SINR live baseline`; the new mode, if
implemented, must be labeled `source-backed channel live experimental` or an
equally explicit non-default name.

Allowed Phase 6T files:

| File or path | Allowed use |
| --- | --- |
| `src/engine/signal/` | Add a narrow source-backed channel adapter or a mode-selected link-budget path. The existing HOBS/SINR path must remain callable. |
| `src/scene/runtimeFrameStep.ts` | Thread an explicit channel runtime mode into the existing frame step and select HOBS/SINR baseline versus experimental source-backed channel behavior. |
| `src/scene/useSimulation.ts` | Pass only the explicit runtime/profile mode into `stepRuntimeFrame()` if needed. No duplicated frame-step loop. |
| `src/profiles/types.ts` and selected `src/profiles/*.json` | Add an explicit non-default profile flag or runtime mode field only if Phase 6T uses profile selection. |
| `src/signalTuning.ts` | Preserve tuning reset/evidence keys when the runtime mode becomes part of deterministic behavior. |
| `src/ui/InfoPanel.tsx`, `src/ui/DiagnosticsDrawer.tsx`, `src/ui/SignalTuningPanel.tsx` | Labels/status only if the behavior change is visible. No broad UI redesign or new beam-count controls. |
| `scripts/fixtures/`, `scripts/validate-modqn-phase6*.ts`, `docs/modqn-baseline-phase6*.md`, `package.json` | Future Phase 6T validation fixtures, scripts, docs, and narrowly scoped script entries. |

Forbidden Phase 6T files and behavior:

| File, path, or surface | Forbidden change |
| --- | --- |
| `src/core/channel/**` | Do not edit vendored source truth as part of runtime adoption. Any source sync is a separate vendor phase with source-side validation. |
| `src/core/beam/**` | Do not change beam layout or frequency-reuse semantics in the channel-adoption phase. |
| `src/modqn/**` | Do not change MODQN replay, policy, action, reward, evidence labels, or beam-count claim helpers. |
| `src/engine/handover/**` | Do not rewrite HOBS handover policy or event semantics. Channel changes may affect input SINR, but policy logic is out of scope unless separately gated. |
| `src/engine/orbit/**`, traffic, UE mobility, and beam-count controls | Do not batch unrelated truth changes into channel adoption. |
| replay bundles, producer artifacts, `artifacts/`, and external MODQN files | Do not mutate consumed evidence or producer-owned truth. |
| broad `src/ui/**`, camera, scene materials, labels unrelated to mode disclosure | Do not turn Phase 6T into a UI redesign or visual showcase change. |
| EE-MODQN, HEA-MODQN, Catfish, Multi-Catfish, Catfish-over-HEA, or energy-efficiency surfaces | Non-scope. |

Mode requirement:

1. The default runtime must remain the current HOBS/SINR live path.
2. The experimental source-backed channel path must be opt-in through an
   explicit profile flag, runtime mode, or validator-only branch.
3. If Phase 6T starts as validator-only, no browser-visible behavior changes
   are allowed and browser smoke remains unnecessary.
4. If Phase 6T changes browser-visible labels or runtime behavior, the UI must
   disclose the active mode and browser smoke becomes required.
5. The current HOBS/SINR path must remain selectable and must continue to pass
   the Phase 6P baseline validator before and after the Phase 6T change.

## 3. KPI Drift Gate

Before any Phase 6T behavior change, capture a before/after comparison against
the Phase 6P KPI fixture for the same profiles, epoch, windows, replay loop,
frame count, frame dt, runtime speed, default signal tuning, default handover
tuning, DPC state policy, beam count, and K=`3` reuse setting.

Required Phase 6P profiles:

1. `hobs-2024-paper-default`
2. `hobs-2024-candidate-rich`
3. `hobs-2024-tr38811-research`

Tolerated drift thresholds:

| KPI | Tolerance |
| --- | --- |
| total frames, total link samples, finite SINR count, non-finite SINR count | Exact match. Any new non-finite SINR sample is a hard fail. |
| p50 finite SINR | Absolute drift <= `0.25 dB` per profile. |
| low-SINR count below handover threshold | Absolute drift <= `max(2 samples, 2% of baseline finite SINR samples)` per profile. |
| low-SINR count below `0 dB` | Absolute drift <= `max(2 samples, 2% of baseline finite SINR samples)` per profile. |
| total HO event count | Absolute drift <= `1` event per profile, with mandatory event-log disclosure. |
| intra-switch count | Absolute drift <= `1` event per profile. |
| raw inter-handover count | Exact match unless a later handover-specific gate explicitly authorizes inter-HO drift. |
| inter-handover count excluding initial attach | Exact match; current Phase 6P baseline is `0` for all required profiles. |
| initial attach count | Exact match; current Phase 6P baseline is `1` for all required profiles. |
| initial attach handling | Must remain separately reported and must not be treated as MODQN reward evidence. |
| DPC enabled/disabled state | Exact match by profile. Non-DPC profiles must remain disabled. |
| DPC mode and update period | Exact match for `hobs-2024-tr38811-research`. |
| DPC final state count | Exact match. |
| DPC TX-power min, p50, max, and mean | Absolute drift <= `0.5 dB` for each summary value and all values must remain within profile power bounds. |
| active assignments per frame summary | Exact match for count, min, p50, max; mean drift <= `0.01`. |
| active beam cells per frame summary | Exact match for count, min, p50, max; mean drift <= `0.01`. |
| unique active assignment count and unique active beam-cell count | Exact match. |
| reuse-group distributions | Exact match for active assignments and active beam cells. |
| reuse-group source distribution | Exact match; current Phase 6P K=`3` baseline must remain `core-layout`. |

Hard fail conditions:

1. Phase 6P before snapshot is missing or not comparable.
2. Any required profile/window is missing from the comparison.
3. Any tolerated drift threshold is exceeded.
4. New NaN, new non-finite SINR, or silently dropped link samples appear.
5. Initial attach is merged into penalized inter-satellite handover evidence.
6. Inter-satellite handover excluding initial attach drifts without a separate
   handover adoption gate.
7. DPC power summary becomes unavailable for the DPC profile or appears in
   profiles where DPC is disabled.
8. Active-beam or reuse summaries drift because of unrelated scheduler,
   beam-count, or layout behavior.
9. The HOBS/SINR baseline path can no longer reproduce the Phase 6P fixture.

## 4. Channel Parity Gate

Phase 6O must remain `PASS` before and after Phase 6T. The parity validator is
the source-backed channel-adapter gate; adoption cannot proceed if it fails or
if its claim scans fail.

Required Phase 6O boundaries:

1. K=`1`, K=`3`, and K=`7` are the only core-backed FRF semantics.
2. Core-backed cases must use `reuseGroupSource === 'core-layout'`.
3. Core-backed co-channel grouping must use same-`reuseGroup` semantics from
   vendored core layout metadata, not numeric modulo fallback.
4. K=`2`, K=`4`, K=`5`, and K=`6` remain compatibility cases.
5. Compatibility cases must stay labeled `INTENTIONAL_NON_CORE_PARITY`.
6. Compatibility cases must not emit source-backed FRF claims.
7. The parity fixture must continue to cover no-interference, intra-only,
   inter-only, mixed interference, inactive same-reuse exclusion,
   different-reuse exclusion, TR 38.811 NLOS, fixed DPC, and K coverage cases.

## 5. Claim Boundary

Phase 6S establishes no new MODQN evidence.

1. `7` beams remains the accepted regenerated baseline MODQN evidence path.
2. `19` and `37` remain sensitivity/demo only.
3. `19` and `37` must not be described as trained baseline MODQN evidence.
4. HOBS/SINR live output is not MODQN replay evidence.
5. Source-backed channel live mode is not MODQN policy, reward, replay,
   training, or producer evidence.
6. Channel parity, KPI parity, and runtime frame-step guards do not create
   MODQN policy, reward, training, replay, or producer evidence.
7. EE-MODQN, HEA-MODQN, Catfish, Multi-Catfish, Catfish-over-HEA,
   Catfish-family effectiveness, and physical energy-saving claims remain
   non-scope.
8. Paper baseline signal evidence remains distinct from live SINR with
   interference. Any future label must distinguish paper/replay evidence from
   HOBS/SINR live and source-backed channel live behavior.

## 6. Required Validation For Future Phase 6T

Future Phase 6T must run:

1. Phase 6P before/after KPI comparison, including the thresholds in this
   Phase 6S gate.
2. `npm run validate:modqn:phase6o-channel-adapter-parity`
3. `npm run validate:modqn:phase6r-runtime-frame-step-boundary`, or an updated
   equivalent if Phase 6T intentionally changes the boundary.
4. `npm run lint`
5. Unsupported `19` / `37` trained-baseline claim scan over changed files and
   MODQN phase docs.
6. HOBS/SINR-live-as-MODQN-replay-evidence claim scan over changed files and
   MODQN phase docs.
7. Browser smoke only if Phase 6T changes UI labels, panels, controls, scene
   rendering, or browser-visible runtime behavior.

Phase 6T must also record:

1. whether HOBS/SINR baseline and source-backed channel experimental mode are
   both available;
2. which mode is default;
3. the full before/after KPI drift summary;
4. the Phase 6O and Phase 6R validation result;
5. any intentional non-parity or residual risk; and
6. the claim boundary copied from this Phase 6S gate.

## 7. Recommended Phase 6T Scope

Recommended Phase 6T scope: add the smallest opt-in source-backed channel live
mode that compares `src/core/channel` helper output against the current
HOBS/SINR path without changing handover policy, beam-count controls, replay
truth, MODQN policy, or default runtime behavior.

The preferred first shape is one of:

1. validator-only branch that computes source-backed channel results beside the
   baseline frame step and writes a before/after KPI report; or
2. non-default runtime/profile flag that can be enabled explicitly while the
   HOBS/SINR baseline remains default and selectable.

Do not batch Phase 6T with UI redesign, handover-policy changes, beam-count
expansion, replay integration, producer export, EE/HEA/Catfish work, or
default-mode promotion.

## 8. Phase 6S Validation

Required validation for this docs-only Phase 6S slice:

1. `git diff --check`
2. `git diff --no-index --check /dev/null docs/modqn-baseline-phase6s-channel-runtime-adoption-gate.md`
3. unsupported `19` / `37` trained-baseline claim scan over MODQN phase docs
4. `git status --short`

Browser smoke is intentionally not run because Phase 6S has no
browser-visible runtime, scene, label, panel, or control behavior change.
