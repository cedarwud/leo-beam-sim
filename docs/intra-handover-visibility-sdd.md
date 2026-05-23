# Intra-Handover Visibility Mini-SDD

## 1. Purpose

The intra-satellite beam switch ("intra-HO") is one of the headline behaviors
this showcase needs to demonstrate. In the current build the effect was
almost imperceptible during live or replayed demos. Investigation in May 2026
showed two root causes that must be addressed together:

1. **Frequency.** Intra-HO events happen too rarely in the default scenario
   for a viewer to ever catch one.
2. **Visibility.** When intra-HO does fire, the visual cue is so short and so
   thin that even a watching viewer misses it.

This note defines the design contract for fixing both, without violating the
SINR / HOBS truth boundary or the simulator's rigor commitments.

It also exists to prevent a second round of UI-only "make it pop" patches
that do not address the frequency root cause.

This SDD complements `docs/intra-handover-visual-strengthening-sdd.md`,
which shipped the original Slice A arrow on 2026-05-14. That earlier slice
established the event channel and arrow component; this SDD scales both
frequency and visibility to demo-grade.

## 2. Scope

### 2.1 Goals

- Increase intra-HO event rate to a level where a 5-minute demo run shows
  multiple clearly attributable events.
- Make every intra-HO event visually unambiguous on screen for at least
  ~2.5 seconds of real time, regardless of simulation speed multiplier.
- Surface intra-HO in the same supporting infrastructure as inter-HO:
  auto-slow, HUD banner, beam-level FROM/TO state.
- Preserve TR 38.811 / HOBS truth: do not alter SINR formula, noise, fading,
  beam-pattern roll-off, or HOBS Eq. (24)–(25) intra trigger semantics.
- Make intra-HO frequency tuning explicit and bounded by named knobs, so
  future agents do not silently drift policy.

### 2.2 Non-Goals

- No new HOBS variant, no new handover algorithm, no MORL retraining.
- No change to SINR / noise / fading / beam-pattern formulas.
- No addition of an intra-HO hysteresis margin. HOBS Eq. (24)–(25)
  intentionally uses raw SINR comparison; adding hysteresis would break
  paper fidelity.
- No mandatory UE mobility for the default replay baseline. Mobility ships
  as an optional scenario preset.
- No camera shake, no audio cue, no forced auto-zoom.

## 3. Core Definitions

### 3.1 Intra-Handover

A UE changes its serving beam to a different beam on the **same** satellite
because that beam's SINR is now strictly higher.

Truth: triggered by `HandoverManager` when a same-satellite candidate beats
the serving beam's smoothed SINR continuously for `intraSwitchTimeSec`.

### 3.2 Frequency Lever

A configurable input that changes how often intra-HO events fire **without**
altering SINR truth or the trigger comparison itself.

Examples: scenario profile, `intraSwitchTimeSec` dwell, UE trajectory.
The live demo also exposes `maxIntraSwitchesPerServingEpoch`, which limits
same-satellite beam switching per serving-satellite epoch without changing
the raw SINR comparison.

### 3.3 Visibility Lever

A rendering change that makes an already-emitted intra-HO event easier to
see. Pure presentation; never changes whether the event happens, who is
involved, when it fires, or how long the truth-side guard lasts.

### 3.4 Wall-Clock vs Sim-Time

A "sim-time TTL" expires after N seconds of simulation time and is therefore
compressed at higher speed multipliers. A "wall-clock TTL" expires after N
seconds of real elapsed time regardless of speed multiplier. Intra-HO viz
must use wall-clock TTL.

## 4. Rigor Boundaries

This is the single most important section. Any agent picking up this work
must obey it.

### 4.1 Frozen — must not be touched

The following are part of paper fidelity or research truth and are off
limits to this initiative:

1. SINR numerator, denominator, noise power, fading, shadowing models.
2. Beam-pattern roll-off and `BEAM_GAIN_FLOOR_DB`.
3. The intra-HO trigger comparison itself, which is `candidate.sinrDb >
   currentSinr` with no margin. Do not introduce `intraSwitchSinrMarginDb`
   or any similar hysteresis knob.
4. TR 38.811 baseline parameters defined in
   `docs/hobs-tr38811-sinr-mini-sdd.md` and
   `docs/sinr-runtime-parameter-contract.md`.
5. The four `baseline-kpi-*.json` files in `ntn-sim-core`. If a port or
   change here makes one of these fail, fix the change, not the baseline.

### 4.2 Tunable as policy / scenario

The following are policy or scenario parameters and may be tuned for demo
quality, but each must remain a profile-level or runtime-level knob (not a
hidden hardcode) so the change is auditable:

1. `intraSwitchTimeSec` (default 0.75 s in all three legacy profiles).
   Empirically not a useful lever in either stationary or mobile UE
   regimes — see §5.1.A2 for evidence. Kept tunable in the slider for
   research scenarios.
2. `sinrSmoothingSec` (default 0.5 s). Use with caution; also affects inter.
3. `maxIntraSwitchesPerServingEpoch` (default 1). Caps same-satellite
   beam switches before the next inter-HO starts a new serving-satellite
   epoch, and prevents returning to a beam already served in the current
   epoch.
4. `pingPongGuardSec` (default 5 s). Affects post-inter intra ramp-up.
5. Profile selection (`hobs-2024-paper-default`,
   `hobs-2024-candidate-rich`, `hobs-2024-mobile-demo-aircraft`).
6. UE trajectory (waypoint schema, see §13.3).

Policy sequencing is not a hidden tuning knob: inter-HO offset / TTT and the
post-inter guard run before same-satellite beam refinement. Intra-HO is a local
fallback when no inter target qualifies and the global best candidate remains
on the current serving satellite.

### 4.3 Pure presentation — fully free

Anything that does not change which events are emitted, when, by whom, or
their logged values:

- `INTRA_HANDOVER_ARROW_SEC` and its TTL semantics.
- Arrow geometry, color, opacity curves, materials, render order.
- Ground-disc shockwave, satellite halo ring, HUD banner.
- Auto-slow trigger inputs (extending it to include intra is presentation
  policy, not truth).
- Beam-level versus satellite-level role tagging in `VizFrame`, as long as
  the underlying logged `HandoverEvent` is unchanged.

## 5. Two-Track Plan

Frequency and visibility are independent and must be tracked separately so
neither is used as a shortcut for the other.

### 5.1 Track A: Frequency

Three layers. After the S1 and S6 measurements, A3 is the load-bearing one.

1. **A1 — Profile.** Demo default is already `hobs-2024-candidate-rich`
   (`DEFAULT_PROFILE_ID` in `src/App.tsx`). Confirmed during the S1 attempt.
   No further action required.

2. **A2 — Dwell.** Reducing `intraSwitchTimeSec` from 0.75 s to 0.25 s was
   tested twice and confirmed to have **zero effect** on intra-HO count in
   both regimes:
   - Stationary UE: 4 / 5 min at 0.75 s; 4 / 5 min at 0.25 s.
   - Mobile UE (S6 `hobs-2024-mobile-demo-aircraft`): 50 / 5 min at 0.75 s;
     50 / 5 min at 0.25 s (mean of 3 runs each).

   Under both stationary and mobile UE, the intra-HO rate is bounded by how
   often `bestSameSatBeam` becomes true at all, not by how long the dwell
   timer takes to mature. Once dwell is short enough that any qualifying
   candidate survives long enough to trigger (0.75 s already qualifies),
   shortening it further accomplishes nothing.

   **A2 is permanently dropped.** Do not re-attempt as a future slice. If
   intra-HO rate ever needs to be raised further beyond what mobility
   provides, the lever is candidate emergence (scenario layout, beam grid
   density, UE speed / radius), not dwell.

3. **A3 — UE Mobility (primary lever, shipped as S6).** A new optional
   UE-mobility scenario preset simulates an aircraft-class NTN UE.
   Aircraft cruise speed (~900 km/h) is the smallest believable speed that
   produces meaningful beam-grid crossings at the current scene scale: a
   5-minute run at 900 km/h covers ~75 km, which is ~2–3 beam footprint
   diameters. Lower speeds (car, HSR) move the UE less than half a beam
   footprint and do not raise intra-HO rates.

   Trajectory shape: a **Lissajous figure** with frequency ratio φ:1
   (golden ratio), radius 25 km, base period 240 s, baked into the JSON as
   31 waypoints at 10 s intervals. This gives a deterministic, replayable,
   visually pseudorandom path that stays entirely inside a 25 km disk
   around the observer. The bounded disk guarantees the UE never wanders
   into a sat-sparse latitude band (at 40°N observer, the disk is ~13°
   from the nearest Walker coverage edge).

   The stationary-UE baseline is preserved: existing profiles without a
   `ueMobility` field continue to use the observer position unchanged.

   Status: shipped in commit 9081486 as `hobs-2024-mobile-demo-aircraft`.

A3 ships as a new profile rather than mutating any existing profile, so
paper-reproduction baselines remain untouched.

### 5.2 Track B: Visibility

Five sub-slices, in order of dependency:

1. **B0 — Wall-clock latch.** Convert the intra-HO viz TTL from sim-time to
   wall-clock time. At 20× speed, the current 2.4 sim-second TTL collapses
   to ~0.12 s of real time and is invisible.
2. **B1 — Auto-slow inclusion.** `App.tsx` auto-slow currently inspects
   only `pendingTargetSatId` (inter only). Extend it to also activate when
   `intraHandoverEvent` is non-null, with the same windowing rules.
3. **B2 — Ribbon arc + pulse dot.** Replace `THREE.Line` with a
   thickness-bearing primitive (drei `<Line lineWidth>` or `TubeGeometry`),
   add an outer blue target glow and a moving white pulse dot animating from
   `from` to `to` along the Bézier.
4. **B3 — Beam-level FROM/TO role.** The current `SOURCE` / `recentSource`
   role at `runtimeFrameStep.ts:579` and `useBeamViz.ts:571` is
   satellite-level only. Add a `beam-level` role channel so an intra-HO
   can mark its from-beam as `intraSource` and its to-beam as
   `intraTargetNewServing` for the same wall-clock window as the arc.
5. **B4 — Ground shockwave.** On the ground discs of from-beam and
   to-beam, emit a one-shot ring effect: old beam ring contracts and
   fades; new beam ring expands and brightens. Cheap and unambiguous at
   the spatial scale of adjacent same-sat beams.
6. **B5 — HUD banner.** Compact transient overlay,
   `INTRA · <sat> · B<from> → B<to> · ΔSINR +x.x dB`, lifetime equal to
   the wall-clock latch window.

7. **B6 — Intra/inter color-language parity.** Inter-HO uses the same
   beam-level display language as intra-HO: yellow marks the current/source
   serving beam, blue marks the pending/target beam, and the committed
   inter-HO transition remains visible on a display-only wall-clock latch.
   The role channel is generic (`handoverRole`) so inter-HO no longer travels
   through an intra-only display prop, and source yellow keeps a visible floor
   through the full transition.
   This parity is presentation only and does not change TTT, SINR ranking,
   event timing, or handover counts.

8. **B7 — Inter-first handover priority.** SINR mode must not become
   intra-dominant just because intra is now visible. Inter-HO remains the
   serving-satellite boundary: the post-inter guard blocks immediate intra,
   qualified inter targets own pending/TTT state, and intra-HO is evaluated
   only when no inter target qualifies and the global best candidate is still
   on the current serving satellite.

Each B-slice is independently shippable and produces a visible improvement
on its own.

## 6. Current Implementation Audit

Concrete current behavior, for reference and as a checklist of touchpoints.

| Concern | File | Line | Current |
|---|---|---|---|
| Intra trigger code | `src/engine/handover/handover-manager.ts` | 110–132 | `candidate.sinrDb > currentSinr`, dwell `intraSwitchTimeSec`, no margin; same-sat beam reuse and max intra count are policy guards |
| Handover priority | `src/engine/handover/handover-manager.ts` | decision order | Inter offset / TTT and post-inter guard run before intra; intra only evaluates when no inter target qualifies and the global best remains same-sat |
| Intra epoch guard | `src/engine/handover/handover-manager.ts` | intra epoch state | Blocks returning to a beam already served in the current serving-satellite epoch and caps intra switches by `maxIntraSwitchesPerServingEpoch`; reset by inter-HO |
| Arrow TTL constant | `src/scene/runtimeFrameStep.ts` | 49 | `INTRA_HANDOVER_ARROW_SEC = 2.4` (sim-time) |
| Arrow component | `src/viz/IntraHandoverArrow.tsx` | 1–143 | `THREE.Line` 1 px, `CTRL_POINT_LIFT = 80`, linear fade over sim-time TTL |
| Source/target role | `src/scene/runtimeFrameStep.ts` | 579 ff. | `SOURCE` / `recentSource` is satellite-level, set only on inter-HO |
| Beam role consumer | `src/scene/useBeamViz.ts` | 571 ff. | role is satellite-level; same-sat from/to invisible |
| Serving beam highlight | `src/viz/SatelliteBeams.tsx` | 405–406 | dim 0.20 non-serving, +5 Y-lift serving (HO-type agnostic) |
| Auto-slow window | `src/App.tsx` | 339 ff. | inspects `pendingTargetSatId`; intra not included |
| Intra count display | `src/ui/DiagnosticsDrawer.tsx` | 310 | total count only, no per-minute rate |
| Intra count source | `src/scene/runtimeFrameStep.ts` | 681 | `hoManager.eventLog.filter(action='intra-switch').length` |
| Dwell slider | `src/ui/DiagnosticsDrawer.tsx` | 262 | "Same-sat dwell" already exposes `intraSwitchTimeSec` |
| Intra epoch limit control | `src/ui/HandoverPolicyControls.tsx` | policy controls | "Intra-HO limit per satellite" exposes `maxIntraSwitchesPerServingEpoch` |
| Default `intraSwitchTimeSec` | three legacy profile JSONs | 54 / 52 / 61 | 0.75 s |
| Default `maxIntraSwitchesPerServingEpoch` | profile JSONs | handover block | 1 switch per serving-satellite epoch |
| UE mobility profile | `src/profiles/hobs-2024-mobile-demo-aircraft.json` | new (S6) | Lissajous waypoints, dwell 0.75 |
| UE waypoint injection | `src/scene/runtimeFrameStep.ts` | new (S6) | linear waypoint interp, clamp at ends |

## 7. Architecture Touchpoints

### 7.1 Truth-side (engine)

No change to `HandoverManager.update()` logic. Only configuration values
and optional UE-position source change.

### 7.2 Scenario-side

UE position was previously derived from
`runtimeFrameStep.ts:284–286`, anchored at the profile's observer
lat/lon. The S6 mobility path adds a deterministic time-varying offset to
that position when the active profile has a `ueMobility` field. The UE
remains a single point; only its lat/lon over time changes.

### 7.3 Frame state

Add to `RuntimeFrameStepState` a wall-clock latch for the intra viz:

```ts
interface IntraHandoverVizLatch {
  event: IntraHandoverEvent;
  wallClockStartMs: number;
  wallClockExpiresMs: number;
}
```

Latch is set when the engine emits a new `intraHandoverEvent`. Latch
expiry uses `performance.now()` and is independent of `simTimeSec` or
`speed`.

### 7.4 VizFrame

Extend `VizFrame.intraHandoverEvent` consumers to read the latch instead
of the raw event. Add beam-level role flags:

```ts
interface BeamTarget {
  ...
  handoverRole: 'intraSource' | 'intraTargetNewServing' | 'interSource' | 'interTargetNewServing' | null;
}
```

`handoverRole` is non-null during intra-HO wall-clock latch, inter-HO
pending dwell, and inter-HO wall-clock latch. Intra and inter latches are
mutually exclusive: committing an inter-HO clears the intra latch and vice
versa, so a beam never carries both an intra and an inter role at once.

### 7.5 UI

`DiagnosticsDrawer` adds:

- Intra-HO events per minute (derived from `eventLog` and elapsed sim
  time).
- A second readout for elapsed wall-clock time, so the rate is
  interpretable at speed multipliers.

`App.tsx` auto-slow inspects `vizFrame.intraHandoverEvent` in addition to
`pendingTargetSatId`.

A new transient HUD component renders the B5 banner from the same latch.

## 8. Slice Plan

One slice = one PR. No batched merges. Slice IDs are preserved for audit
trail; the execution order in §8.1 supersedes the original draft ordering.

| Slice | Tracks | Touches | Risk / Status |
|---|---|---|---|
| S1 | A1 + A2 | profile JSON, dwell tuning | dropped (no effect at stationary or mobile UE; see §5.1.A2) |
| S2 | B0 + B1 | `runtimeFrameStep.ts`, `IntraHandoverArrow.tsx`, `App.tsx` auto-slow | low — next |
| S3 | B3 | `runtimeFrameStep.ts:579`, `useBeamViz.ts:571`, `VizFrame` types, beam material consumer | medium (touches role plumbing) |
| S4 | B2 + B4 | `IntraHandoverArrow.tsx` rewrite, new ground-ring viz | low (presentation only) |
| S5 | B5 | new HUD banner component, `DiagnosticsDrawer` rate readout | low |
| S6 | A3 | new mobility profile, `ueMobility` schema, UE-position injection in `runtimeFrameStep.ts` | **shipped 2026-05-14, commit 9081486** |

### 8.1 Revised Execution Order

After the S1 finding that dwell is not the bottleneck under stationary UE,
and the S6 confirmation that mobility is the only real frequency lever,
the execution order is:

1. **S6 first.** A3 (UE mobility) is the only confirmed frequency lever.
   No visibility slice is worth measuring against a stream of 4 events /
   5 min. **Done (commit 9081486, 50 events / 5 min).**
2. **S2 second.** Wall-clock latch is the prerequisite for any visible
   intra-HO viz at speed > 1×. S2 must follow S6 immediately, before any
   S3–S5 polish, because S3–S5 all read the latch state set by S2. **Next.**
3. **S3 third.** Beam-level FROM/TO role unlocks the per-beam visual
   channel that S4 and S5 consume.
4. **S4 fourth.** Ribbon arc, pulse dot, and ground shockwave — the main
   visual payoff.
5. **S5 fifth.** HUD banner and rate readout — the final polish.
6. **A2 revisit cancelled.** S6 measurements at dwell 0.25 vs 0.75
   produced identical intra-HO counts; A2 is permanently dropped per
   §5.1.A2.

Slice S2 may begin in a separate conversation; it does not share files
with later slices.

## 9. Acceptance Criteria

### 9.1 Frequency (Track A)

Baseline (measured during S1 attempt, `hobs-2024-candidate-rich` profile,
stationary UE, speed 5×): **4 intra-HO events per 5 minutes of sim time**
(3 runs, mean 4).

S6 results (committed in 9081486, `hobs-2024-mobile-demo-aircraft`,
stationary mobility profile dwell 0.75, speed 5×):

- 3 runs: 47, 54, 49. Mean: **50** (target ≥ 12). Pass.
- Max UE-to-observer distance: 25.218 km (target ≤ 25.5 km). Pass.
- Visible sat count delta vs stationary: 0% (target < 5%). Pass.
- Truth invariance on `hobs-2024-tr38811-research`: inter-HO Δ = 0; 5
  SINR sample timepoints maxAbsDiff = 0. Pass.

Future Track A slices must include:

- A baseline measurement at the prior-slice configuration, recorded in
  the PR description.
- An after measurement at the new configuration, recorded in the PR
  description.
- A truth-invariance check on `hobs-2024-tr38811-research` with the same
  seed and trajectory cache.

### 9.2 Visibility (Track B)

- After S2, at speed multiplier 20× the intra-HO arrow remains visible
  for at least 2.5 s of wall-clock time after trigger.
- A headless capture using the existing SwiftShader-compatible validator
  (see `feedback_validator_headless_opacity` memory) records at least one
  frame with `data-intra-handover-arrow-opacity` in the open interval
  (0.3, 0.9) during an intra-HO event.
- After S3, an intra-HO event renders the from-beam and to-beam with
  visibly distinct ground discs for the duration of the wall-clock latch.
  The source fades down in the serving-yellow family while the target ramps up
  in the same blue target family used by inter-HO pending/target beams.
- After S4, the ribbon arc has a measurable on-screen width greater than
  1 px and the moving pulse dot reaches the to-beam endpoint within the
  latch window.
- After S5, the HUD banner appears within the same frame as the event
  and disappears at latch expiry.

### 9.3 Truth invariance

For a fixed replay seed and fixed `intraSwitchTimeSec`, before-and-after
diffs across every slice show:

- Identical `HandoverEvent` log for inter-handover entries (same actions,
  same fromSatId, same fromBeamId, same toSatId, same toBeamId, same
  triggeredAtSec to within float tolerance, same SINR samples to within
  float tolerance).
- Identical per-beam SINR samples.
- Identical `baseline-kpi-*.json` cross-checks when run against
  `ntn-sim-core`.
- For intra-switch entries: identical action / fromSatId / fromBeamId /
  toSatId / toBeamId across the slice boundary. Intra `triggeredAtSec`
  must match to within float tolerance **prior to B7**; from B7 onwards
  the intra dwell timer accumulates only on ticks where no inter target
  qualified, so intra `triggeredAtSec` may shift by up to one full
  inter-pending window relative to pre-B7 baselines. This drift is the
  visible signature of B7's "intra is local fallback when no inter
  target qualifies" semantics (§4.2 policy sequencing paragraph; §5.2
  B7) and is acceptable as long as the intra event identity (sat / beam
  endpoints) and the inter event log remain byte-identical.

Per-slice baselines recorded before B7 (e.g. the S6 capture in §9.1)
remain valid for inter and SINR comparisons but must be re-recorded for
intra `triggeredAtSec` once B7 lands.

## 10. Measurement and Telemetry

Required diagnostics for each slice landing:

- Intra-HO events per minute, wall-clock-normalized.
- Inter-HO events per minute, for regression watch.
- Mean wall-clock visibility window per intra-HO event (computed from
  latch start and end).
- Optional: histogram of `ΔSINR = candidate.sinrDb - currentSinr` at
  trigger, for tuning.

The `DiagnosticsDrawer` is the canonical surface for these.

## 11. Rollback

Every slice must be reversible without data loss:

- A1 and A2 are non-actions and require no rollback.
- B0–B5 revert by reverting the touching file; the truth-side engine is
  never modified.
- A3 (S6) reverts by switching the active profile away from
  `hobs-2024-mobile-demo-aircraft` (DEFAULT_PROFILE_ID unchanged) or by
  reverting commit 9081486.

No slice may introduce a state that requires migration on rollback.

## 12. Immediate Next Implementation Tasks

Recommended order:

1. ~~S1 (A1 + A2)~~ — dropped per §5.1.A2.
2. ~~S6 (A3)~~ — shipped 2026-05-14, commit 9081486.
3. **S2 (B0 + B1)** — next slice. Wall-clock latch in
   `runtimeFrameStep.ts`, plumbed into `IntraHandoverArrow.tsx` and
   `App.tsx` auto-slow.
4. S3 (B3) — beam-level intra role on `VizFrame` and `useBeamViz`.
5. S4 (B2 + B4) — ribbon arc, pulse dot, ground shockwave.
6. S5 (B5) — HUD banner and rate readout.

S2 unblocks all later visibility work and is the highest leverage next
step.

## 13. Resolved Decisions

These were open questions in the draft and have been settled. They are
binding on the slice implementations.

### 13.1 Wall-clock latch window

Fixed at **3.0 s of wall-clock time**, not derived from inter-HO
auto-slow.

Rationale: 2.5 s is the visibility floor required by §9.2 and leaves no
margin for a viewer to read the HUD banner. Inter-HO auto-slow exists to
let the camera follow a sat change; intra-HO is a local beam swap with
different cognitive needs, so coupling the two timings is a false
economy. A fixed constant is also easier to assert against in §9.2.

### 13.2 `intraSwitchTimeSec` scope

Cancelled. A2 was tested and dropped; see §5.1.A2.

All three legacy profiles and the new mobility profile keep
`intraSwitchTimeSec = 0.75 s`. The slider in `DiagnosticsDrawer` remains
available for research tweaks but ships no new default.

### 13.3 UE mobility format

**Waypoints** (lat/lon plus time), JSON-authored, with explicit
interpolation. Parametric path types (`lissajous`, `circular`, `linear`)
are **deferred** to a follow-up slice; for S6, the trajectory is
generated by an external script (`scripts/generate-lissajous-waypoints.ts`)
and **baked** into the profile JSON as a flat waypoint list. This keeps
the runtime schema minimal and the JSON itself fully auditable.

Rationale: waypoints are auditable in diff review, deterministic across
replays, and consistent with the existing profile JSON style. The S6
schema, as shipped:

```json
"ueMobility": {
  "type": "waypoints",
  "waypoints": [
    { "timeSec": 0,   "latDeg": 40.000000, "lonDeg": 116.000000 },
    { "timeSec": 10,  "latDeg": 40.012345, "lonDeg": 116.067890 },
    { "timeSec": 20,  "latDeg": 39.989012, "lonDeg": 116.123456 }
    /* ... 31 points total at 10 s intervals, baked from Lissajous ... */
  ],
  "interpolation": "linear",
  "generator": "lissajous(R=25km, f1=1.618, f2=1, T=240s, observerLat=40, observerLon=116)"
}
```

The S6 trajectory is generated by:

- `x(t) = R * sin(2π * f1 * t / T)` (east displacement, km)
- `z(t) = R * sin(2π * f2 * t / T)` (north displacement, km)
- `R = 25` km, `f1 = 1.618` (golden ratio), `f2 = 1`, `T = 240` s
- Sampled at `t = 0, 10, 20, ..., 300` s (31 waypoints)
- Each (east_km, north_km) is converted to lat/lon offsets from observer

Properties of this choice:

- Average path speed ≈ 900 km/h (aircraft cruise class, TR 38.821 NTN UE).
- Path is bounded inside a 25 km disk around the observer for all `t`.
- Golden-ratio frequency makes the path quasi-aperiodic, so a 5-minute
  run visually looks pseudorandom but is 100% deterministic.
- The `generator` field is metadata only; the runtime consumes the baked
  waypoints. Future regeneration uses this field to reproduce the path.

The stationary-UE baseline corresponds to omitting `ueMobility` from the
profile, not to a special-case waypoint list. All legacy profiles remain
stationary (no `ueMobility` field) so that paper-reproduction runs are
unaffected.

### 13.4 HUD banner overlap

**Replace in place**, no stacking and no counter in the first cut of S5.

Rationale: a stacked banner risks visual clutter and competes with the
3D scene for the same eye-tracking region; a counter loses per-event
`ΔSINR`. Replacement is the simplest behavior that still always shows
the freshest event. A `+N more` collapse may be added later if demo
feedback shows back-to-back intra-HOs are being missed, but it is not a
blocker for S5 acceptance.
