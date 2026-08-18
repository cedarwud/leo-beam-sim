# ADR-005: Make archived TLE propagation and canonical angle-aware EE the active simulator contract

## Status

**Accepted by owner direction**

Date: 2026-08-11

Decision identifier: `LEO-SIM-TLE-EE-1`

Implementation repository: `/home/u24/demo/leo-beam-sim`

Scientific EE authority:
`/home/u24/papers/modqn-paper-reproduction/docs/ADR-003-canonical-ee-closure.md`

## Context

The course-presentation and LoRaEnergySim delivery are no longer active product
requirements. Two simulator requirements remain accepted:

1. select a date and time from a year-scale TLE archive and immediately render
   the corresponding TLE-derived SGP4 trajectory; and
2. replace independent or teaching-only power calculations with the complete
   canonical angle-aware energy-efficiency closure used by the thesis and the
   current MODQN training path.

These requirements come from the project supervisor. They are not, by
themselves, evidence of an energy-saving strategy. The separate questions of
which policy creates a meaningful energy reduction and how the result should
integrate with the Phase-1 platform remain open.

The repository currently contains several historical energy models. Some are
useful teaching projections; others are legacy display calculations. They may
remain for historical tests, but they cannot feed a formal simulator result.

## Authority and precedence

For the active simulator direction, use this order:

1. this ADR for product and runtime decisions;
2. the external ADR-003 above for the EE algebra, zero semantics, aggregation,
   and power boundary;
3. `docs/sdd/TLE-CANONICAL-EE-SIMULATOR-SDD.md` for implementation structure;
4. `docs/handoff/LEO-SIM-CURRENT-HANDOFF-2026-08-11.md` for current execution
   state and ownership.

ADR-004 and its C-120 LoRaEnergySim SDD/handoffs remain historical records.
They no longer define the active simulator roadmap.

## Decision A: archived TLE selection and SGP4 propagation

The simulator shall provide a date-and-time selector backed by the available
year-scale TLE archive.

Hard rules:

- Internal time is an explicit UTC instant. The UI may additionally show
  Asia/Taipei time, but conversion must be visible and reversible.
- Each selected instant resolves to an explicit TLE snapshot with source,
  epoch, satellite identity, and archive provenance.
- The available OneWeb and Starlink archives are separate, selectable source
  adapters. A constellation switch must replace the catalog, published
  snapshot, SGP4 frame, and all downstream analysis atomically.
- Snapshot selection is deterministic. Among publications overlapping the
  requested validity interval, the adapter prefers the newest publication
  whose maximum epoch is not later than the requested instant; only when none
  exists may it use the newest overlapping publication. Within that single
  publication it admits only records with `epoch <= requestedInstant` and age
  not exceeding the catalog maximum. It never mixes successive publications,
  because a provider may revise TLE content while retaining an epoch. If no
  acceptable record remains, the simulator reports unavailable rather than
  substituting a generated orbit.
- A date/time request freezes one publication and one resolved TLE pair per
  satellite, then recomputes the full admitted constellation with SGP4 at 241
  common UTC anchors from `t0` through `t0 + 7,200 s` in 30-second steps.
- The complete geometry run, real-pass plan, and run-local EE evaluation must
  all succeed before a date/time change atomically replaces the published run.
  Until then the previous scene/result remain visible and the timeline stays
  locked.
- The result is labelled **TLE-derived SGP4**, not live telemetry and not a
  measured orbit.
- TLE snapshot switching is not a satellite handover decision. It must not
  increment handover counts or create energy-saving evidence.
- Playback from a selected instant uses the one frozen publication for the
  whole two-hour run. Crossing midnight or an archive-date boundary inside the
  run does not re-resolve TLEs; selecting a new `t0` starts a new explicit
  resolution.

## Decision B: one canonical EE state graph

The formal simulator shall implement this single calculation chain:

```text
theta
  -> G_T(theta)
  -> h
  -> gamma_req(U)
  -> p_req
  -> beam and satellite power caps
  -> actual P_DL
  -> U x B channel and assignment matrices
  -> physical noise (T_ant, NF, T_0, B_sys, K_FR)
  -> coupled same-colour interference
  -> realized SINR
  -> R_u and throughput
  -> PA, RFC, BB and event power
  -> P_sys
  -> instantaneous r1 and evaluation EE
```

The required identities are:

```text
r1_u(t) = R_u(t) / P_sys(t)
sum_u r1_u(t) = sum_u R_u(t) / P_sys(t)
EE_eval = sum_t dt * sum_u R_u(t) / sum_t dt * P_sys(t)
```

The zero contract is inherited from ADR-003: zero delivered rate over zero
power is zero; positive delivered rate over zero power is invalid and must
fail closed.

Hard rules:

- There is exactly one formal value for actual downlink transmit power at a
  simulation instant: `P_DL_actual`.
- SINR, throughput, PA power, system power, instantaneous EE, and evaluation
  EE consume that same value and the same frame identity.
- The existing SINR `P_t` control cannot remain an independent actual-power
  override. It must be migrated to a named canonical constraint, initially
  `P_beam_max`; a satellite-wide control must be `P_sat_max`.
- `p_req`, `P_DL_actual`, active-beam count, `P_PA`, `P_sys`, SINR, rate,
  throughput, and EE are derived values and are read-only in the formal UI.
- Editable model parameters are limited to parameters with a declared role in
  ADR-003, including beam/satellite caps, PA efficiency, RFC power, BB power,
  and a formally defined event-power input. The active surface also exposes
  the declared angle/channel inputs (`G_0`, `theta_3dB`, `f_c`, explicit loss
  terms, channel scale, and `G^R_dBi`), service target `R_min`, system
  bandwidth `B_sys`, frequency reuse `K_FR`, and physical noise inputs
  (`T_ant`, `NF`, and `T_0`).
- The active homepage scenario owns exactly seven active beams and 100 fixed
  UEs. Their per-beam loads are `[15, 15, 14, 14, 14, 14, 14]`; the complete
  `U x B` angle/channel matrices, assignment vector, active-beam vector,
  satellite ownership, and reuse-colour vector are produced by the scenario
  builder and retained with the frame. A single scalar `U_b` is not an
  authoritative representation of this load.
- Per-beam bandwidth is derived as `B_beam = B_sys / K_FR`. Thermal noise is
  derived as `T_sys = T_ant + T_0(10^(NF/10) - 1)` and
  `sigma^2 = k T_sys B_beam`; aggregate noise and per-beam bandwidth are not
  independent controls.
- Same-colour interference is split into `I_intra` (other active beams on the
  serving satellite) and `I_inter` (active beams owned by other satellites).
  The current fixed seven-beam scenario assigns all seven active beams to the
  serving satellite, so `I_inter = 0` by construction. It is a derived result,
  not a hidden zero or an editable value. The candidate satellite remains a
  separate same-instant counterfactual and is not silently added as an active
  interferer.
- The SINR, EE, Power, and Throughput pages are projections of one immutable
  per-tick result. They may not recalculate separate formulas.
- Evaluation EE is the ratio of accumulated delivered bits to accumulated
  consumed energy, never the arithmetic mean of instantaneous EE values.
- Legacy and teaching-only energy models must be quarantined from the formal
  producer and visibly labelled if retained.

## Required conformance boundary

The TypeScript implementation must replay frozen cases exported from the
canonical Python runtime and compare at least:

- requested power and capped actual power;
- realized SINR and per-user rate;
- PA, RFC, BB, event, and total system power;
- per-user `r1`, the sum identity, and zero/invalid behavior; and
- evaluation ratio-of-sums across multiple unequal-duration frames.

A passing UI test alone is not formula parity.

## Explicitly unresolved

The following are not authorized implementation requirements yet:

- a handover, beam, scheduling, or resource-allocation policy claimed to save
  energy;
- baseline/candidate savings KPIs or thresholds;
- mapping simulator outputs into Phase-1 platform fields;
- network upload, query-back, dashboards, or platform feedback loops; and
- claims of measured, live, operational, or canonical platform energy.

They require a separate decision that identifies the causal control, service
constraint, comparison identity, energy boundary, and registered platform
contract.

## Consequences

- TLE work can proceed independently from EE formula work until both meet in
  the shared simulation frame.
- The four analysis pages become explanations of one calculation rather than
  four loosely related demos.
- Direct `P_t` experimentation changes meaning: it controls a declared cap,
  not an independently injected actual power.
- Historical C-120/LoRa material remains recoverable without steering current
  implementation. It remains a direct-only route with no homepage or simulator
  navigation control; removing the route, tests, bundled assets, and scripts is
  a separate cleanup decision rather than a side effect of changing the active
  simulator entry.
- The two accepted workstreams are non-heavy implementation and remain in the
  current environment unless a later task introduces long training or sweeps.

## Implementation record

Bounded v1 was implemented in commit `c9f8982` and mounted at `/simulator`.
At that checkpoint, the original Walker/handover application remained the `/`
entry. The later homepage-centre adapter decision below supersedes only that
centre data-source boundary. Owner direction keeps the two surfaces separately addressable and does not add navigation
buttons between them at this stage. The homepage presents `SINR / EE / Power /
Throughput` in its existing visual system. All four homepage projections now
consume one explicitly identified archived-TLE canonical analysis frame; the
direct `P_t/maxTxPowerDbm` control and the page-local teaching power/throughput
formulas are excluded from that visible surface. This paragraph records the
pre-adapter checkpoint; the current homepage centre behavior is specified in
the final 2026-08-12 section below.
The `/simulator` route remains the complete canonical workspace where the SGP4
scene, time selector, and the four projections share one frame.
The follow-up constellation checkpoint adds selectable OneWeb and Starlink
archives: 363 valid OneWeb snapshots and 360 of 361 Starlink source snapshots.
The one excluded Starlink source file is identified by filename, SHA-256, and
validation reason in its catalog; no TLE is repaired or fabricated. The route
resolves one epoch-covering published snapshot, propagates with SGP4, and publishes one
immutable analysis frame to SINR, EE, Power, and Throughput. Focused tests,
production build, desktop browser interaction, fail-closed retention, and a
390 px responsive check are required for the checkpoint.

The current scenario adapter is explicitly uncalibrated and the UI labels
evaluation EE as single-frame. No energy-saving or Phase-1 platform decision
is implied by this implementation record.

### 2026-08-12 active-surface cleanup

The former homepage classroom experiment chain is retired, not merely hidden.
The active application no longer constructs the teaching power ledger, the
50/35 dBm comparison arms, or T1-T6 capture/export state. Their right-panel
cards, hidden energy tab, domain modules, generator, and dedicated tests are
removed. Timeline seeks still increment a generic analysis-window reset epoch
so the retained canonical producer never accumulates evidence across a
discontinuous time jump.

This cleanup did not itself change the canonical archived-TLE producer, the four
shared projections, then-current scene behavior, `/simulator`, or the historical
direct-only `/course/c120` route. The separate historical paper-EE card is not
part of this decision and remains quarantined from the active formal pages.

### 2026-08-12 homepage input/result ownership

The homepage uses one lifted archived-TLE analysis state for both side rails.
The left rail owns the OneWeb／Starlink selector, Asia/Taipei date/time, every
editable model input, and the fixed or geometry-derived parameters needed to
understand the calculation. The right rail owns the final SINR, EE, Power, and
Throughput values and their interpretation. Left-rail tabs only organize input
parameters. The right rail always retains the serving/candidate comparison and
all four result groups from the same accepted immutable frame in the fixed order
SINR, Power, Throughput, and EE. Each result group is independently collapsible;
left-tab changes must not change right-rail expansion state or scroll position.

Walker handover-policy controls are excluded from this homepage rail. They
belong to the retained legacy scene runtime and do not contribute to the
archived-TLE analysis frame or its right-rail results.

Starlink is the homepage default; OneWeb remains an equal selectable source.
Changing constellation or time is fail-closed: the new request must pass the
catalog, snapshot, and TLE checks before it replaces the prior accepted result.
The homepage no longer prints contract version, analysis frame ID, or an
all-caps canonical provenance banner. Those fields remain in the internal frame
for reproducibility and remain visible on the dedicated `/simulator` route.

### 2026-08-12 homepage centre boundary correction

Owner correction: the `/` homepage retains the established central
main/campus scene, quick controls, camera interactions, and timeline. It was
not replaced by the Earth/orbit TLE renderer. The Earth/orbit sphere renderer
and its complete shared-frame scene remain on the dedicated `/simulator`
route.

At this intermediate checkpoint, the homepage side rails consumed the same lifted immutable
`SimulationAnalysisFrame` for their canonical archived-TLE parameters,
serving/candidate comparison, and SINR/EE/Power/Throughput results. That
side-rail/candidateLink record is same-instant and same-parameter, but the
homepage centre was not yet a TLE projection and could not be described as
sharing the TLE frame. A deliberate TEME/TLE-to-existing-visual adapter was
still required before any homepage centre same-frame claim was allowed; a
direct `SimulationAnalysisFrame -> NormalizedSceneFrame` coercion remains
forbidden because TEME orbit coordinates are not the legacy ENU/display frame.

The producer includes one bounded `candidateLink`: a real, simultaneously
visible next-pass candidate selected by the deterministic pass-diversity plan
and evaluated with the same canonical parameters. This is a single-link
counterfactual, not a
handover decision. Therefore ΔSINR may be shown, but handover offset, TTT,
progress, and count remain unavailable; the UI must not substitute profile
defaults or zeroes.

This unavailable-policy boundary was later superseded by
`ADR-006-tle-canonical-handover-trace.md`, which accepts a separate immutable
offset/TTT trace over the completed TLE run. The prohibition on Walker profile
defaults and fabricated zeroes remains in force.

The left rail must expose every genuinely editable input used by the canonical
frame, with units, ranges, source, and reset semantics; all derived values
remain read-only. The right rail remains the calculated-value owner. `/simulator`
continues to disclose the accepted TLE frame, Earth/orbit scene, and scientific
provenance; homepage frame identity remained internal test/reproducibility
metadata until the centre adapter was implemented and verified below.

Homepage evaluation EE is run-local ratio-of-sums over the 240 fixed
30-second intervals in the published two-hour run. Changing a canonical model
parameter reuses the frozen geometry and pass plan but recomputes all 240 EE
intervals before publishing the new analysis-run identity. This result is not
persisted experiment evidence.

The formal SINR input surface separates orbit geometry from RF/channel
conditions. TLE/SGP4 owns range, elevation, off-axis angle, position, and
velocity only. The left rail may independently adjust carrier frequency, the
formal atmospheric coefficient, and receive gain in dB. For each selected TLE
link, the adapter computes the thesis large-scale loss `L` from free-space loss
plus its formal atmospheric term and derives `H = 10^(-L/10)`. `H`, `p_req`,
`P_DL_actual`, SINR, throughput, power, and EE remain derived. Carrier,
atmospheric-coefficient, receive-gain, and other input defaults are scenario
assumptions, not measured weather or a full thesis-hardware calibration. A
parameter change starts a new evaluation condition rather than mixing its
samples with the preceding condition.

The serialized parameter record still carries `channelGainScale`,
`scintillationScaleDb`, and `shadowFadingMarginDb` for compatibility with
earlier checkpoints. The formal thesis adapter ignores them, they have no
left-rail control, and they must not be described as canonical experiment
inputs or inserted into `H`.

### 2026-08-12 homepage centre TLE adapter implementation

The pending homepage centre adapter is now implemented. The central campus,
camera, and three-column shell remain; the Earth/orbit sphere remains confined
to `/simulator`. On the homepage, however, the central satellite geometry is no
longer produced by the legacy Walker runtime. `MainScene` receives the same
last-accepted immutable `SimulationAnalysisFrame` as the right rail and mounts
the archived-TLE scene lane without starting `useSimulation`, the Walker cache,
the handover manager, or the legacy cell schedule.

The display adapter preserves the SGP4 TEME vector as provenance but never
coerces TEME axes into campus coordinates. At each requested UTC instant it
performs TEME to Earth-fixed conversion, derives topocentric look angles at the
canonical NTPU observer (`24.9441667`, `121.3713889`), and only then maps azimuth
and elevation into the existing campus sky-dome convention (east `+X`, up
`+Y`, north `-Z`). The selected satellite, same-frame candidate, and bounded
above-horizon context set all derive from that one accepted TLE frame. The
homepage renders those positions with the established satellite models; it
does not draw a continuous trajectory line or a ground-to-satellite centre
line. UE markers, UAV, the selected/candidate seven-cell beam volumes, and
campus remain display substrate and do not enter SINR, throughput, power, or
EE. Context satellites own no beams.

The left date/time input accepts second-level values within the archive's
resolvable coverage. Constellation/time edits are drafts and do not start work
until the explicit Apply action. Draft edits leave the accepted scene intact;
Apply clears the centre, right rail, evaluation, and timeline before rebuilding.
No intermediate anchor or previous-request result remains visible under the new
request. A complete run publishes the centre and right rail atomically; failure
keeps both surfaces empty until the settings are adjusted or retried. The switch
creates no handover decision. Internal browser telemetry verifies
analysis-frame ID, TLE-frame ID, selected satellite, requested instant, and
selected TEME position equality between centre and right rail.

### 2026-08-12 complete two-hour run implementation

The homepage source/date selector now builds a complete `TleRunBundle` before
publication. The run contains the full admitted constellation at 241 shared
30-second anchors over 7,200 seconds. It then extracts complete real visibility
passes, applies a deterministic high-elevation and spatiotemporal-diversity
plan, and evaluates canonical EE as delivered bits divided by consumed joules
over 240 intervals. The endpoint remains displayable but owns no additional
evaluation interval.

After explicit Apply, computation has no visible run. Progress reports completed
SGP4 anchors; the TLE timeline remains disabled until geometry, pass planning,
serving availability at all 241 anchors, and run evaluation all validate.
Publication is atomic and stale or aborted requests cannot win. The homepage
timeline is owned by `archived-tle-run` and does not
call the Walker seek/rebase path. Canonical SINR／Power／Throughput／EE stays on
the lower stored 30-second anchor. The centre-only display path uses adjacent
completed SGP4 position-and-velocity state vectors for bounded cubic Hermite
interpolation, then recomputes NTPU look angles at the intermediate UTC. This
produces continuous TLE-derived motion without inventing an uncomputed
full-constellation frame or changing the immutable analysis frame. The homepage
also omits legacy handover quick controls because this TLE run defines no
handover policy.

The TLE centre may reuse established satellite-model and beam-cone visual
components, but it must not restore their former Walker, wall-clock,
beam-hopping, or handover data producers. Both the selected and real
same-instant candidate satellites may show a fixed seven-cell comparison fan.
The display substrate is a faint radius-two honeycomb of 19 cells. Seven
selected active cells are dispersed and pairwise non-adjacent at axial
coordinates `(0,0)`, `(2,0)`, `(2,-2)`, `(0,-2)`, `(-2,0)`, `(-2,2)`, and
`(0,2)`. All 100 display UEs are assigned to those active cells and move with
their assigned cell; context satellites own zero beams, and no cell hopping is
mounted. The seven active targets are the only cells illuminated by the
selected/candidate comparison fan. This grid is a fixed display-only
experiment service area, not a claim that TLE generated seven physical
footprints. Every beam apex comes from a stored SGP4 state or its bounded
position-and-velocity interpolation. All transport controls, including play,
speed, step, jump, keyboard, and scrub input, remain disabled while a
replacement run is incomplete.

### 2026-08-13 fixed seven-beam canonical scenario

The active producer now evaluates all seven active beams and all 100 assigned
UEs at every accepted anchor. The frame retains the complete `U x B` angle,
propagation, and receive-gain matrices, plus assignment, active-beam,
satellite-ownership, reuse-colour, and per-beam-load vectors. The seven beams
use the same dispersed active axial coordinates `(0,0)`, `(2,0)`, `(2,-2)`,
`(0,-2)`, `(-2,0)`, `(-2,2)`, and `(0,2)` as the display substrate. This keeps
the canonical local scenario topology aligned with the central scene while
the local coordinate mapping remains uncalibrated; the selected and candidate
satellite apexes and trajectories remain TLE/SGP4-derived, and the active
cells must not be described as TLE-derived physical footprints.

The noise path is physical and single-sourced: editable `T_ant`, `NF`, `T_0`,
`B_sys`, and `K_FR` produce read-only `T_sys`, `B_beam`, and `sigma^2`.
`K_FR` also determines the reuse-colour assignment, so changing it can change
both per-beam bandwidth/noise and same-colour interference. The canonical
producer publishes `I_intra`, `I_inter`, and their total. Because all seven
currently active beams are owned by the selected serving satellite, the
current scenario has `I_inter = 0`; the candidate is evaluated separately as
a same-instant, same-parameter counterfactual and is not inserted as a second
active interfering satellite.

The canonical defaults are aligned with ADR-003 (including `P_beam,max = 1.65
W`, `P_sat,max = 10^(13/10) W`, `K_FR = 3`, `T_ant = 150 K`, `NF = 1.2 dB`,
`T_0 = 290 K`, `B_sys = 500 MHz`, `G_0 = 2,000`, full `theta_3dB = 3.32°`,
and `R_min = 1 Mbit/s`). The channel adapter now uses the formal large-scale
path-loss gain from the selected TLE geometry without a page-level gain
multiplier. Carrier, atmospheric-coefficient, receive-gain, and other defaults
are scenario assumptions, not measured weather inputs or full thesis-hardware
calibration, and this remains neither a complete multi-satellite thesis
scenario nor a calibrated link-budget claim.
