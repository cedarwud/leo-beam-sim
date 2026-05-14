# MODQN Baseline Phase 6M Channel Runtime Adoption Readiness

**Date:** 2026-05-12
**Status:** docs-only readiness and boundary inventory
**Target repo:** `/home/u24/papers/project/leo-beam-sim`
**Source repo:** `/home/u24/papers/ntn-sim-core`
**Decision:** `NEEDS_ADAPTER_DESIGN`

Phase 6M inventories the current `leo-beam-sim` live signal, handover, KPI,
profile, tuning, and vendored-channel surfaces before any later phase adopts
the vendored `ntn-sim-core` channel or link-budget helpers into live runtime
behavior.

This phase does not implement adapter code, validators, runtime adoption, UI
controls, browser smoke, training, artifact export, or additional vendoring.

## 1. Source Ownership

The three-repo ownership split remains unchanged:

| Repo | Current ownership |
| --- | --- |
| `modqn-paper-reproduction` | MODQN evidence authority: baseline training/evaluation artifacts, regenerated baseline evidence, action/reward/policy diagnostics, provenance, and claim boundaries. |
| `ntn-sim-core` | Validated module, contract, fixture, and validator authority: frozen `src/core` donor modules, `visual-showcase-v1` validation, source-side validators, and frozen KPI baselines. |
| `leo-beam-sim` | Final runtime/demo host: browser runtime composition, camera, scene, UI, display labels, live-demo orchestration, and later consumption of validated truth. |

`leo-beam-sim` may host live simulation under ADR-002, but rigor-critical
truth must come from producer artifacts or validated and vendored
`ntn-sim-core/src/core` modules. It must not become a second MODQN trainer or
an independent research-truth source.

## 2. Claim Boundary

The Phase 1 through Phase 6L claim boundaries remain active:

1. `7` beams remains the accepted regenerated baseline MODQN evidence path.
2. `19` and `37` remain live sensitivity/demo extensions only.
3. `19` and `37` must not be described as trained baseline MODQN evidence.
4. HOBS/SINR live runtime output must not be called MODQN replay evidence.
5. Paper baseline signal evidence is SNR-like and must stay distinct from
   source-backed live SINR with interference.
6. Producer replay artifacts are immutable inputs. `leo-beam-sim` may display
   or adapt them, but must not rewrite consumed SINR/SNR, handover, action,
   reward, geometry truth, deterministic IDs, masks, evidence status, or
   provenance.
7. No EE-MODQN, HEA-MODQN, Catfish, Multi-Catfish, Catfish-over-HEA, or
   energy-efficiency scope is established by this readiness note.

## 3. Current leo-beam-sim Runtime Inventory

### Signal And Channel Surfaces

| Local surface | Current role | Runtime adoption concern |
| --- | --- | --- |
| `src/engine/signal/types.ts` | Live runtime `LinkSample`, `ActiveBeamAssignment`, `SatelliteSnapshot`, and UE position types. Beam IDs are numeric. | No core string `beamId`, no producer ID, and no behavior-level `reuseGroup` field on signal samples. |
| `src/engine/signal/link-budget.ts` | Current HOBS-shaped live SINR path. Computes noise, local path loss, beam gain, steering loss, active-beam co-channel interference, and `sinrDb`. | Uses numeric `beamId` and `getBeamFrequencyIndex(beamId, frequencyReuse)` for co-channel grouping, not vendored core reuse-group semantics. |
| `src/engine/signal/path-loss.ts`, `beam-gain.ts`, `los-probability.ts`, `slant-range.ts` | Local signal helpers for current HOBS/TR 38.811 runtime. | These are still the behavior path even though source-owned core channel helpers now exist under `src/core/channel/`. |
| `src/engine/signal/power-control.ts` | DPC state keyed by `${satId}:${beamId}` and updated from `sample.sinrDb`. | Any link-budget or SINR change affects power-control feedback and effective TX power. |
| `src/core/channel/*` | Vendored source-owned channel helpers from `ntn-sim-core`. | Present but not adopted by `src/engine/signal`, `src/engine/handover`, `src/scene`, `src/profiles`, UI, replay, or MODQN policy behavior. |
| `src/utils/beamFrequency.ts` | Display and compatibility frequency-index helper. | Safe for visual labels; unsafe as source-backed signal truth without an adapter and validator. |

### Handover And KPI Surfaces

| Local surface | Current role | Runtime adoption concern |
| --- | --- | --- |
| `src/engine/handover/types.ts` | Numeric serving state, pending target, handover decision, and event shape. Supports `stay`, `intra-switch`, and `inter-handover`. | Event vocabulary is compatible in concept, but identity shape is not compatible with core string beam IDs or producer replay IDs. |
| `src/engine/handover/handover-manager.ts` | Active HOBS SINR-offset handover manager. Sorts smoothed `LinkSample[]` by SINR, applies thresholds/timers, logs events, and commits initial attach as `inter-handover`. | Any SINR change changes attach, intra-switch, inter-handover, pending-target, guard, and event timing behavior. Initial attach must not be treated as MODQN penalized inter-satellite handover without source authority. |
| `src/engine/handover/policies/sinr-offset.ts` | Legacy HOBS Algorithm 2 style policy surface. | HOBS policy logic must not be relabeled as MODQN policy replay. |
| `src/scene/useSimulation.ts` | Composes orbit, visible satellites, core-layout beam cells, active assignments, DPC, local link budget, handover manager, recent-HO latch, and frame state. | This is the current behavior integration hub and is not a core-purity destination. Channel adoption here would affect signal, handover, display, and KPI-like state together. |
| `src/scene/types.ts`, `src/scene/useSimStatePublisher.ts`, `src/scene/panelState.ts` | Publishes panel-facing SINR, budgets, trigger progress, `hoCount`, last HO reason, serving/pending/recent-HO identities, and visual frequency diagnostics. | These are KPI/readout surfaces affected by any channel or SINR behavior change. |
| `src/ui/InfoPanel.tsx`, `src/ui/DiagnosticsDrawer.tsx`, `src/ui/SignalTuningPanel.tsx` | Displays live SINR, formula terms, handover progress, diagnostics, and tuning state. | UI labels must distinguish HOBS/SINR live behavior from MODQN replay evidence after any adoption. |

### Profile And Tuning Surfaces

| Local surface | Current role | Runtime adoption concern |
| --- | --- | --- |
| `src/profiles/types.ts` | Defines HOBS-oriented profile schema: formula family, antenna, UE antenna, channel, handover, beams, and beam hopping. | No MODQN runtime profile discriminator or source-backed channel adapter contract exists. |
| `src/profiles/hobs-2024-candidate-rich.json` | Default demo profile. `7` beams, K=`3`, 28 GHz, 100 MHz, HOBS legacy formula, beam hopping enabled. | Demo HOBS/SINR profile only; not MODQN evidence. |
| `src/profiles/hobs-2024-paper-default.json` | HOBS paper-default profile. `7` beams, K=`3`, HOBS legacy formula, beam hopping disabled. | HOBS profile only; not MODQN baseline replay evidence. |
| `src/profiles/hobs-2024-tr38811-research.json` | HOBS + TR 38.811 profile with DPC. `7` beams, K=`3`, DPC threshold and power bounds. | DPC and TR 38.811 live behavior would drift if SINR or link-budget semantics change. |
| `src/signalTuning.ts` | Applies runtime signal tuning into antenna, UE antenna, channel, path-loss components, TR 38.811 clutter, and `beams.frequencyReuse`. | Direct behavior input to the current local signal path. K=`2/4/5/6` remain Leo compatibility labels, not core-backed FRF truth. |
| `src/handoverPolicyTuning.ts` | Applies runtime SINR-offset handover thresholds and timers. | Direct behavior input to current HOBS handover. |
| `src/App.tsx` | Defaults to `hobs-2024-candidate-rich`, applies signal and handover tuning, and passes reset/evidence keys into runtime. | Default runtime remains HOBS/SINR live demo, not MODQN replay. |

## 4. Vendored Source Available Locally

### Channel And Link-Budget Surfaces

The following source-owned helpers are now present under `src/core/channel/`
after Phases 6D, 6F, 6H, 6J, 6K, and 6L:

| Local path | Current availability |
| --- | --- |
| `src/core/channel/types.ts` | Channel, SINR, beam-gain, link-budget, deployment, and shadow-fading types. |
| `src/core/channel/fspl.ts` | FSPL leaf helper. |
| `src/core/channel/sinr.ts` | SINR combiner from serving received power, noise, and interferer received powers. |
| `src/core/channel/beam-gain.ts` | Beam gain and off-axis angle helper. |
| `src/core/channel/small-scale-fading.ts` | Shadowed-Rician and Loo fading helpers. |
| `src/core/channel/los-probability.ts` | TR 38.811 LOS probability helper. |
| `src/core/channel/doppler.ts` | Doppler shift and degradation helpers. |
| `src/core/channel/shadow-fading.ts` | Cleaned TR 38.811 shadow/clutter helper. |
| `src/core/channel/link-budget.ts` | Source-owned channel tier composition helper. |
| `src/core/channel/index.ts` | Barrel export for the vendored channel helper set. |
| `src/core/common/constants.ts` | Common source constants needed by vendored channel helpers. |

Runtime adoption status for all of these files is still **not adopted**.

### Beam, Frequency, And Layout Surfaces

Relevant vendored beam surfaces are also present:

| Local path | Current availability |
| --- | --- |
| `src/core/beam/layout.ts` | Hexagonal layout generator with cumulative beam counts `1, 7, 19, 37, ...` and FRF `1 / 3 / 7` reuse groups. |
| `src/core/beam/types.ts` | Source beam layout and beam selection type shapes with string `beamId`. |
| `src/core/beam/frequency-reuse.ts` | Source co-channel helper based on same-`reuseGroup` semantics. |
| `src/scene/beam-layout.ts` | Leo scene adapter that calls the vendored core layout for current 7-beam geometry, preserves 1-based numeric Leo IDs, and carries `coreBeamId`, `coreLocalBeamIndex`, `reuseGroup`, and reuse-source metadata. |

The Phase 5A scene adapter already uses vendored layout geometry for the
current runtime beam cells, but current live signal behavior still consumes
numeric Leo IDs and `profile.beams.frequencyReuse`.

## 5. Current Runtime Conflict Map

| Conflict | Current Leo behavior | Vendored/core behavior or required boundary | Adoption risk |
| --- | --- | --- | --- |
| Numeric beam IDs vs core/string identity | Live signal, handover, DPC, panels, and labels use numeric `beamId`, generally 1-based. | Core layout uses string IDs like `${satId}-b${index}` plus 0-based `coreLocalBeamIndex`; producer replay also has its own local beam identity. | Direct adoption can break active-assignment keys, event logs, labels, and replay identity unless a map preserves Leo display IDs and core IDs together. |
| SNR/SINR naming | Current live runtime computes SINR with co-channel interference and displays `sinrDb`. | MODQN baseline signal evidence is SNR-like; core live channel helpers can support source-backed SINR with explicit interference. | UI/docs must not call live HOBS/SINR output MODQN replay evidence. |
| Path-loss and link-budget shape | Local `src/engine/signal/link-budget.ts` computes RSRP, local path loss, beam gain, steering loss, intra/inter interference, denominator, and SINR in one runtime function. | Vendored `src/core/channel/link-budget.ts` computes per-link `ChannelResult.rxPowerDbm`; vendored `computeSinr()` combines serving received power, noise, and interferer received powers. | A parity adapter must map local profile fields and intermediate terms into core `LinkBudgetOptions` and `SinrComputeOptions` before behavior can switch. |
| Frequency reuse and interference semantics | Live interference currently uses `getBeamFrequencyIndex(beamId, frequencyReuse)`, so numeric modulo controls co-channel grouping. | Core frequency reuse is same-`reuseGroup` over vendored layout output for FRF `1 / 3 / 7`. K=`2/4/5/6` are Leo compatibility labels only. | Switching grouping changes SINR, DPC, handover, diagnostics, and KPI-like state. Compatibility K values must not be treated as core truth. |
| Profile and tuning coupling | `signalTuning` mutates antenna/channel/path-loss/frequency reuse; `handoverPolicyTuning` mutates SINR-offset thresholds/timers. | Core channel helpers expect explicit per-call options and do not own Leo UI tuning semantics. | Runtime adoption needs a stable parameter adapter and reset policy so UI tuning does not silently change source-backed claims. |
| Handover KPI coupling | Handover manager sorts by smoothed SINR and updates pending target, intra-switch dwell, inter-HO timer, event log, `hoCount`, recent-HO latch, and UI readouts. | Core channel adoption changes the signal stream that feeds those decisions. | KPI baseline capture is required before any behavior-changing switch. |
| Unit assumptions | Leo mixes GHz, MHz, dBm, dB, km, radians for beamwidth, degrees for scan/elevation, local ENU offsets, topocentric range, and world vectors for display. | Core channel helpers expect km, GHz, dBm/dB, explicit noise power in dBm, explicit tier flags, scan degrees, and typed channel options. | Adapter must convert noise PSD plus bandwidth to noise power, beamwidth to beam diameter/off-axis inputs, tx power to EIRP semantics, and keep display-world coordinates out of channel truth. |
| Frame assumptions | Leo builds beam cells in local observer-relative ENU offsets, then renders in Three.js world coordinates. | Core layout operates in local ENU offsets relative to satellite subpoint and core channel functions are coordinate-system agnostic once distances/angles are supplied. | Adapter must document whether values come from topocentric range, TR 38.811 slant range helper, or runtime scene offsets. |
| Runtime labels | Current default is a HOBS demo profile with visual and diagnostics modes. | MODQN replay labels are producer-owned; core channel labels are source-backed live-sim labels. | Runtime must label HOBS/SINR live, source-backed channel live, and MODQN replay as distinct modes/statuses. |

## 6. Future Adapter Contract

A later adapter must be explicit and testable before any behavior-changing
runtime adoption.

Required preservation rules:

1. Preserve existing Leo UI/display IDs where needed. Panels, labels, visual
   beam keys, DPC keys, and handover readouts may keep numeric Leo IDs only if
   the adapter also carries the source/core identity beside them.
2. Preserve vendored channel input/output semantics. Calls into
   `src/core/channel` must use source-shaped options and must not backfill
   missing terms with display-only state.
3. Preserve frequency-reuse semantics. Core-backed FRF uses same-`reuseGroup`
   for K=`1 / 3 / 7`; K=`2 / 4 / 5 / 6` are compatibility behavior unless a
   later source-backed module says otherwise.
4. Preserve producer replay immutability. No adapter may mutate producer
   replay samples, action choices, rewards, masks, evidence status, or
   provenance.
5. Preserve claim boundaries. Channel/live SINR parity does not inflate MODQN
   evidence, does not authorize trained `19` or `37` claims, and does not
   create EE/HEA/Catfish/Multi-Catfish scope.
6. Preserve runtime labels. UI and diagnostics must explicitly distinguish
   HOBS/SINR live runtime from MODQN replay and from any future
   source-backed channel-live mode.
7. Preserve KPI comparability. Any behavior-changing switch must have
   before/after KPI snapshots using the same profile, epoch, replay window,
   tuning state, and deterministic runtime settings.

Minimum adapter fields:

| Adapter field group | Required data |
| --- | --- |
| Identity map | Leo `satId`, Leo numeric `beamId`, core `satId`, core string `beamId`, core local beam index, producer identity when replay is involved, and deterministic serialization key. |
| Geometry inputs | Link range source, elevation, scan angle, beam center ENU offsets, UE ENU offset, beam diameter or derived beamwidth mapping, and altitude. |
| Channel inputs | Frequency, bandwidth/noise conversion, TX/EIRP convention, RX gain, path-loss tier flags, TR 38.811 environment, LOS/NLOS source, shadow/fading RNG seed policy, scan-loss options, and DPC power override. |
| Interference inputs | Active assignments, serving beam, interferer beams, reuse groups, intra/inter classification if Leo panels keep separate interference readouts. |
| Output map | Core `ChannelResult`, core `SinrResult`, Leo `LinkSample`, local budget terms, label/status metadata, and reason code for any intentionally unmatched term. |

## 7. Decision

**Phase 6M decision status: `NEEDS_ADAPTER_DESIGN`.**

Rationale:

1. This is not `NEEDS_MORE_VENDORING` for the pure channel/link-budget helper
   path. The needed leaf, composed link-budget, channel barrel, beam layout,
   and frequency-reuse helper surfaces are already present locally.
2. This is not yet `READY_FOR_PARITY_VALIDATOR` because the current Leo signal
   path and the vendored channel path do not share an adapter contract for
   identity, units, tier flags, noise conversion, EIRP/TX-power convention,
   LOS/fading seed policy, reuse-group selection, DPC overrides, and
   intra/inter interference readout mapping.
3. A parity validator written before that adapter design would risk comparing
   mismatched formulas or silently normalizing away exactly the behavior that a
   later runtime adoption would change.

The next phase should design the adapter and fixture contract first, then move
to a parity validator once the mapping is explicit.

## 8. Validation And KPI Gate Plan

Minimum checks before any behavior-changing adoption:

1. Targeted parity validator for current Leo signal output versus vendored
   channel output. It should consume fixed runtime snapshots and report
   component-level differences for link budget, serving signal, interference,
   noise, denominator, and SINR. The first validator should be read-only and
   must not switch runtime behavior.
2. KPI baseline capture before runtime change. Capture the current HOBS/SINR
   baseline for fixed profile, epoch, replay window, tuning state, and speed:
   `hoCount`, event action counts, serving timeline, pending-target timeline,
   recent-HO latch counts, finite-SINR distribution, minimum SINR/outage
   counts, DPC TX-power summary where enabled, and active-beam/reuse summary.
3. Post-change KPI comparison after any runtime adoption. Compare the same
   metrics and disclose expected drift versus regressions.
4. Lint/type checks after adapter or runtime code changes: at minimum
   `npm run lint`, plus the existing Phase 6 vendor validators that remain
   relevant.
5. Unsupported `19` / `37` trained-baseline claim scan over changed docs, UI
   labels, validators, and phase notes.
6. Browser smoke only when UI, diagnostics, labels, panels, controls, scene
   rendering, or browser runtime behavior changes. Docs-only and pure validator
   phases do not require browser smoke.

Stop conditions for a future adoption phase:

1. Stop if adapter logic mutates producer replay data.
2. Stop if HOBS/SINR output is labeled MODQN replay evidence.
3. Stop if `19` or `37` is labeled trained baseline MODQN evidence.
4. Stop if K=`2/4/5/6` compatibility reuse labels are treated as core-backed
   FRF truth.
5. Stop if source-backed channel adoption requires batching signal, handover,
   profiles, UI controls, KPI validators, and replay behavior in one change.
6. Stop if KPI baseline capture is missing before behavior changes.

## 9. Recommended Phase 6N Scope

Recommended Phase 6N scope: adapter design and parity-fixture specification
only, still no runtime behavior switch.

Phase 6N should:

1. Draft the concrete `LeoChannelCoreAdapter` contract for identity, geometry,
   channel options, interference sets, and output mapping.
2. Define fixed parity fixtures from existing Leo profiles and runtime
   snapshots without changing runtime behavior.
3. Decide how to represent intentional non-parity cases between local HOBS
   link-budget terms and source-backed core channel terms.
4. Specify the future read-only parity validator inputs, tolerances, and
   output report.
5. Preserve all Phase 6M claim boundaries and stop rules.

Phase 6N should not adopt runtime behavior, add UI beam-count controls, mutate
producer artifacts, vendor more source files by default, or run browser smoke
unless it changes browser-visible diagnostics.
