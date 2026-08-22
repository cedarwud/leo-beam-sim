# 六幕教學 P0 垂直切片 SDD

**Status:** active, opened 2026-08-22.
**Parent:** [`docs/six-acts-teaching-design-proposal.md`](../six-acts-teaching-design-proposal.md) (v2 REVIEWED).
**Scope:** the P0 **vertical slice** bullet only — the one end-to-end path a
classroom can actually run:

```
OneWeb 圖集已驗證窗 → 導演腳本 v1（六 Phase）→ 同幀雙 arm 功率掃描 → Platform 抽屜 v1
```

plus the proposal's explicitly named new work item (**run-summary 遙測**), which
the sweep and the drawer both consume and which currently has **zero output in
`src/`**.

**Out of scope for this SDD** (they are P0 items, but separate slices): Act 1
time advance / shell filter / NTPU cone; Act 3 camera presets, steering slider,
θ_3dB into the numeric chain; Act 4 ping-pong dual knobs; Act 2 station ② static
card. They land after the slice is green.

## Why fixture-first

The proposal's own review round rejected "build the interaction, then find the
data". Every module below is defined so it can be exercised **headless**, against
a pinned fixture, before any of it is wired to a viewport. M1–M3 need no browser
gate at all; only M4/M5 are structural render work under
`docs/frontend-change-contract.md`.

## Module map and order

| # | Module | Path | Gate | Status |
|---|---|---|---|---|
| M1 | Teaching-window fixture + generator | `src/course/sixActs/teachingWindow.ts`, `scripts/build-six-acts-teaching-window.ts` | `node:test`, deterministic `--check` | **done** |
| M2 | Run-summary telemetry | `src/course/sixActs/runSummary.ts` | `node:test` | **done** |
| M3 | Platform drawer service (payload/ledger/mock/export) | `src/course/sixActs/platformPayload.ts`, `platformUpload.ts` | `node:test`, injected fetcher | **model done**, drawer UI open |
| M4 | Director script v1 (six Phase) | `src/course/sixActs/directorScript.ts` + UI | `node:test` + `validate:ready` | **model done**, viewport wiring open |
| M5 | Dual-arm power sweep | `src/course/sixActs/powerSweep.ts` + UI | `node:test` + `validate:ready` | **model done**, panel UI open |
| M6 | Live-replay bridge | `src/course/sixActs/liveReplayBridge.ts` | `node:test` + compile-time port conformance | **done** |
| M7 | Teaching-mode state isolation | `src/course/sixActs/teachingMode.ts` | `node:test` | **model done**, route mount open |
| M8 | Elevation guard for the plan | `src/course/sixActs/windowVisibility.ts` | `node:test` (real SGP4) | **done** |
| M9 | Arm strategy (baseline / eco) | `src/course/sixActs/armStrategy.ts` | `node:test` | **done** |
| M10 | Taught-constant provenance registry | `src/course/sixActs/taughtConstants.ts` | `node:test` + deleted-symbol guard | **done** |

M1→M2→M3 are pure data/model and land first. M4/M5 consume them.

The whole model layer is headless and green (`npm run test:six-acts`, 119 tests).
What remains for the slice is the React surface for M3–M5, plus the one thing
neither can be faked: a live replay of the pinned window that actually produces
a `SixActsLiveHandoverObservation` for the director, and the offline parameter
sweep that pins the classroom `lowSinrThresholdDb` and the power range.

### Rulings applied (2026-08-22)

**A — the "two SINR scales" premise was wrong, and withdrawn.** Both chains
compute the same quantity the same way (`engine/signal/link-budget.ts` vs
`analysis/canonicalEe/producer.ts`). The gap is a PARAMETER difference, and
measuring it named the culprit exactly:

| | reuse K | B (MHz) | B^w = B/K |
|---|---:|---:|---:|
| atlas run (`DEFAULT_SIMULATOR_PARAMETERS`) | 3 | 500 | **166.667** |
| `modqn-4sat-7beam-paper-faithful` | 1 | 500 | 500.000 |
| the other five profiles | 3 | 100 | 33.333 |

thesis-mc ch5 Table 5-2 says 3-colour reuse, `B^w = 166.667 MHz`. **The atlas
already matches the paper; none of the shipped homepage profiles do.** The
profile named `paper-faithful` is the one that matches it least (wrong reuse AND
3x the beam bandwidth). Precondition 1 therefore resolves to: bring the live
side to the atlas parameters, not the reverse — an owner change to a profile,
not something this slice may do quietly.

`LOW_SINR_RATIO` now binds to a LABELLED constant, not a number:
`SixActsRunSummaryInput.lowSinrThreshold` takes a `SixActsTaughtConstant`, so a
bare threshold no longer type-checks. The engine's `-5 dB` is registered as
`ENGINE-OPERATING` with `sourceRef: null` and a caption that says in as many
words that it is the engine's rule and not a paper value. Same for the 3 dB
re-attach relaxation.

The γ_req comment is now an assertion (`deletedSymbols.test.ts`): the runtime
surface and the comment-stripped source of every six-acts file are both scanned.

⚠ **Finding to escalate:** `canonicalEe/producer.ts:411-431` does not merely
compute `gammaReqB`; it inverts it to `pReqUW` and then to
`pDlBeforeSatelliteCapBW`. **The engine's entire downlink power allocation IS
required-power inversion.** This is not a vestigial name.
It also RESOLVES a tension rather than creating one: with `p_req = γ_req·(I+σ²)/G`,
holding the beam load and interference fixed gives
`p(t)/p(t-1) = G^T(θ(t-1))/G^T(θ(t))` exactly — which is the Act 3 recursion the
proposal specifies, "within one served segment". So Act 3 can teach the ratio
form honestly; it is algebraically what the engine does. What must not happen is
naming `γ_req` on screen, and the guard now enforces that.

**B — Act 4 timeline offsets kept; the visibility worry did not survive
measurement.** Axis is `SIX_ACTS_TIMELINE_AXIS_UNIT = 'seconds-relative-to-commit'`,
never steps, asserted in test. The −300 s worry assumed a 485–540 km satellite
(≈378 s pass). This window is OneWeb at ≈1190 km (mean motion 13.187 →
109 min period), measured by SGP4 at NTPU:

| t rel. commit | serving 49194 | candidate 55159 |
|---:|---:|---:|
| −300 s | **35.32°** | 6.35° |
| −90 s | 13.04° | 48.78° |
| −30 s | 8.65° | **88.98°** |
| 0 s | 6.66° | 65.51° |
| ≥10° window | −897 s .. −50 s (14.1 min) | −260 s .. +198 s (7.6 min) |

−300 s is comfortably inside the serving pass. Each phase now declares
`requiresVisible`, and `assertSixActsPlanVisibility` checks it against real SGP4
at the horizon the atlas chain used. The SGP4 elevation at commit reproduces the
atlas's `minimumEventElevationDeg` to <0.05°, which cross-validates the geometry.

Teaching bonus the measurement handed over: at commit−30 s the candidate is at
**88.98°** (near zenith) while the serving is at 8.65°. 3 dB + 30 s TTT waited
until the old link was nearly on the ground and the new one nearly overhead —
visual proof of "conditional handover lives in the low-elevation band".

**C — `eco` changes the selection rule, not the physics.** `baseline` ranks by
`R_{u,s,v}`, `eco` by `R_{u,s,v} / P^N`. An arm spec has exactly five fields and
none of them is a power or a seed, asserted in test. `SixActsPowerSweep` now
carries `beamPowerCapW` (default `1.65 W`, ch5 Table 5-2) and rejects a point
whose cap differs — expressing an arm as a lower cap is a typed failure. The
choice reports `armsAgree`, including `null` when the comparison cannot be
evaluated, so a lesson never claims a difference the data does not show.

### Delivered teaching surfaces (2026-08-22)

Owner direction: build the whole teaching UI / animation / flow first, and park
the paper-dependent numbers. Six routes, all reachable from the running order:

| Route | Act | What a student does |
|---|---|---|
| `/course/six-acts` | 動線 | The running order, with each act's bridge to the next |
| `/prototype/global-constellation` | 1 | Guess the count, filter shells, drag ±90 min, click a satellite |
| `/course/tle-journey` | 2 | Walk 69 columns, break a digit, drag a pass curve |
| `/course/angle-lab` | 3 | Three cameras, steer the beam axis, hit −3 dB |
| `/course/handover-theatre` | 4 | Six phases, auto-pause at the condition, read the receipt |
| `/course/energy-lab` | 5 + 6 | Bet, sweep, reveal, then tick fields and walk the upload |

Deviation from the proposal, deliberate: Acts 4–6 are their own routes rather
than panels bolted onto the 2,903-line homepage. The teaching content is
identical and the homepage's engineering surface is untouched, which keeps this
work off the heavy render-governance path entirely. Folding them back into the
homepage's teaching mode remains open, and `teachingMode.ts` already holds the
route flag and the persisted-state isolation it will need.

Act 5's numbers come from `energyLabFixture.ts`: the authority's formulas over a
DEMO parameter set tuned so the EE peak lands mid-slider, badged as such on the
page. Two findings from building it:

- Without the interference term the curve has NO right-hand segment — rate never
  saturates, so "報酬遞減" cannot be shown. Interference rising with the swept
  power is what produces the peak, exactly as the proposal says.
- The interference coupling also sets γ's ceiling, so it decides whether
  `LOW_SINR_RATIO` can move at all. At κ = 3 the whole sweep sat below the
  engine's −5 dB rule and the field pinned at 100 %. κ = 2 puts the operating
  range across the threshold and the second-order trap becomes visible. The
  THRESHOLD was not touched: it is the engine's rule, not a demo knob.

### Open before the slice can be run in a room

1. **Owner: unify the live profile with the atlas** (reuse 3, `B^w = 166.667 MHz`).
   Until then Act 5's live chain and the atlas window are not comparable.
2. **Owner: `canonicalEe/producer.ts` `gammaReq`/`pReq` naming.** Engine truth
   file; renaming is not this slice's call. The course-facing guard is in place.
3. **Offline parameter sweep** — after (1), re-measure whether `LOW_SINR_RATIO`
   actually moves in this window. If it is pinned at 100 %, that is a WINDOW
   selection problem, not a threshold problem: pick a window where the ratio
   moves. Heavy-compute: run it on the server.
4. **Act 6 drawer, Act 5 panel, Act 4 overlay, teaching-mode mount** — the React
   surfaces. Structural render work: vite up, before/after screenshots,
   `validate:ready` pasted.

### Provenance classes on screen

`SOURCE` — anything in the fixture (real TLE, atlas-computed SINR).
`MODEL-DERIVED` — anything the live replay recomputes.
`COURSE-ASSUMPTION` — narrative the engine does not produce.

## M2 — run-summary telemetry

Currently `src/` computes none of these. This module is the single producer.

| Output | Definition | Note |
|---|---|---|
| `TOTAL_ENERGY_J` | Σ_t P^N Δt | J |
| `DELIVERED_DATA_MBIT` | Σ_t Σ_u R Δt | Mbit |
| `RUN_EE_MBIT_PER_J` | ratio-of-sums, via `computeEvaluationEeFromTotals` | Mbit/J; **not** a mean of per-step EE |
| `LOW_SINR_RATIO` | share of 1 Hz samples with serving SINR < threshold | integer percent per platform spec |
| `NUM_HANDOVERS` | committed serving changes | run total |

Plus the **1 Hz sampling bridge**: the runtime steps at replay dt, the platform
wants one sample per second. The bridge is an explicit resampler with a stated
rule (last-sample-wins per whole second; a handover anywhere inside a second sets
that second's `HANDOVER_EVENT` to 1 — an OR, not a last-wins, or handovers
between sample instants vanish).

`LOW_SINR_RATIO` counts **outage samples as failing**, not as absent — an
unattached UE is the low-SINR case the Act 5 trap is about. Dropping them would
launder the trap away.

Fail-closed: the module reuses `CanonicalEeInputError` semantics; it never
returns a laundered zero for an invalid input.

## M3 — Platform drawer service

Payload shape is fixed by the historical script
(`upload_baseline_modqn_platform.py`): `{"data": [{type, channel, value, timestamp}]}`
to `POST {base}/iot_data/<mac>` with a Bearer token from
`POST {base}/account/login`; `base = https://edu.nthu-smart-farming.kits.tw/api/api`.

Five historical fields only (EE fields are P1, blocked on owner registration):

| Field | Channel | Cadence |
|---|---|---|
| `CURRENT_SINR` | 0 serving / 1 best candidate / 2 gain | 1 Hz |
| `HANDOVER_EVENT` | 0 | 1 Hz, 0/1 |
| `LOW_SINR_RATIO` | 0 | **run end, 1 sample** (spec cadence; the historical script sent it per second — the difference is recorded, not silently reconciled) |

Required behaviour:

- **batch + jitter** — 30 s batches (configurable 30/60/300), per-group random
  0–10 s jitter, login-once token reuse. A class of ~30 groups hitting the API on
  the same wall-clock second is a self-inflicted thundering herd.
- **ledger** — every attempt recorded: time, sample count, HTTP status.
- **offline mock** — the full upload→ledger→read-back path against a fake token
  and pre-recorded read-back, with a permanent `OFFLINE MOCK` badge.
- **local export** — JSON/CSV of exactly what would have been uploaded.
- **honesty line, always visible** — HTTP 200 means *received*; it does not mean
  persisted or queryable. Read-back is the only evidence.

Network access is an **injected fetcher** (the `phase1Upload.ts` pattern), so
every test runs offline.

Credentials come only from `SMARTFARM_*` environment variables and are never
written to the ledger, the export, or a log line.

## M4 — director script v1

Six phases (A 接手初期 / B 品質下滑 / C 候選出現 / D 條件判斷·自動暫停 /
E 執行換手 / F 新常態) over the M1 window, driven by the existing
`src/visualLab/story` director and `guidedReplay` annotation overlay. Phase D
auto-pauses.

Reuse, do not rebuild: `handoverPolicyTuning`, `HandoverEventRail`,
`liveWalkerHandoverEventIndex`, `storyDirector`, `annotationPlan`.

The existing `visualLabStoryDirector` derives a 3-beat
(`before`/`decision`/`after`) cue. Six phases is a **superset**, not a
replacement: the new script maps its six phases onto that beat vocabulary rather
than adding a second director. No second story lane.

Teaching-mode persisted state uses its own `appPersistence` namespace so a
classroom knob never leaks into the engineering workflow.

## M5 — dual-arm power sweep

Two arms (`baseline`, `eco`) over the **same immutable replay frames** —
deterministic replay is what makes the comparison legitimate. Each recorded point
carries `runId` / `strategyId` / `scenarioId`, and produces R, P^N, η via M2.

Classroom parameters (B^w, reuse, UE layout, time window) are pinned into the
fixture offline so the EE peak lands mid-slider; the same fixture doubles as the
offline fallback.

## Symbol discipline

Frontend-visible formulas follow the 2026-08-17 ACTIVE SYMBOL AUTHORITY via
`src/explain/model/canonicalTermMap.ts`:
`γ_{u,s,v}`, `R_{u,s,v}`, `P^p = p/ξ`, `P^N = P^f + Σ P^p`, `η_{u,s,v}`.
Deleted symbols (`γ_req`, required-power inversion, `P_max` cap, `v_max`,
`\widetilde`) must not reappear. Engineering-layer quantities (`P_RFC`, `P_BB`,
the PA curve) are badged 實作層 and aggregate into `P^f` / `ξ`; they are not
public formula terms.

## Honesty badges

`DEMO` · `CANONICAL` (= symbol authority) · `COURSE-ASSUMPTION` · `實作層`.
The one currently-known `COURSE-ASSUMPTION` in this slice: "low power → more
handovers" does **not** happen in this engine (inter-HO is a relative rule;
attach/drop are not counted as handovers). Act 5 tells the true story instead —
power, `LOW_SINR_RATIO`, outage, EE.

## Definition of done for the slice

1. `npm run test:six-acts` green (M1–M10 unit tests). — **green, 119 tests**
2. `npm run check:six-acts:teaching-window` green (fixture is deterministic).
3. `npm run validate:ready` green **and pasted** once M4/M5 touch the viewport.
4. One classroom dry-run of the slice end to end, offline mock included.
