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
- Satellite state is recomputed with SGP4 at the selected instant. Date/time
  changes atomically replace the selected snapshot and all derived positions.
- The result is labelled **TLE-derived SGP4**, not live telemetry and not a
  measured orbit.
- TLE snapshot switching is not a satellite handover decision. It must not
  increment handover counts or create energy-saving evidence.
- Playback from a selected instant uses the resolved snapshot only within its
  declared validity window. Crossing an archive boundary requires a new,
  explicit snapshot resolution.

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
  -> coupled interference
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
  and a formally defined event-power input.
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
The original Walker/handover application remains the `/` entry. Owner direction
keeps the two surfaces separately addressable and does not add navigation
buttons between them at this stage. The homepage presents `SINR / EE / Power /
Throughput` in its existing visual system; its added Power and Throughput pages
remain explicitly non-canonical teaching projections. The `/simulator` route is
still the canonical shared-frame implementation.
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
