# TLE archive and canonical EE simulator SDD

Status: **Accepted contract; bounded v1 implemented and browser verified**

Date: 2026-08-11

Authority: `docs/decisions/ADR-005-tle-and-canonical-ee-simulator-contract.md`

## 1. Objective

Implement two bounded simulator capabilities:

1. select an archived date/time and recompute the real TLE-derived SGP4
   satellite state; and
2. expose SINR, EE, Power, and Throughput as four views of the same canonical
   angle-aware EE closure.

This SDD does not define an energy-saving policy or Phase-1 platform upload.

The bounded v1 is mounted at `/` and `/simulator`; the historical application
is retained at `/legacy`. It uses an explicitly uncalibrated
Taipei/nadir-reference adapter so the canonical chain is observable; this does
not elevate the adapter into thesis-scenario or calibrated-link authority.

## 2. Runtime architecture

```text
TLE archive manifest
  -> requested UTC instant
  -> deterministic snapshot resolver
  -> satellite.js / SGP4 propagation
  -> geometry frame (position, range, elevation, angle)
                                      |
scenario and model parameters --------+
                                      v
canonical EE frame producer
  -> requested power
  -> capped actual downlink power
  -> interference and SINR
  -> rate and throughput
  -> consumed-power ledger
  -> instantaneous and accumulated EE
                                      |
                                      v
one immutable SimulationAnalysisFrame
  -> SINR page
  -> EE page
  -> Power page
  -> Throughput page
```

No page owns a scientific formula. Pages render the shared frame and dispatch
validated parameter changes to the producer.

## 3. Time and TLE contract

### 3.1 User-facing time

The selector provides:

- calendar date;
- time of day;
- visible timezone (`Asia/Taipei` and UTC at minimum);
- archive availability and resolved TLE epoch; and
- reset to the archive default instant.

The state store retains an ISO-8601 UTC instant. Parsing an ambiguous local
timestamp is forbidden.

### 3.2 Archive manifest

The current year-scale sources are the read-only external archives at
`/home/u24/demo/tle_data/oneweb/tle` and
`/home/u24/demo/tle_data/starlink/tle`. At the 2026-08-11 inventory they contain
363 OneWeb snapshots and 361 Starlink source snapshots spanning 2025-07-27
through 2026-08-08. The external repository is not an implementation target
and must not be modified.

All 363 OneWeb snapshots validate. Exactly one Starlink source snapshot,
`starlink_20260528.tle`, contains an invalid 70-column line 1. The browser
archive excludes that whole snapshot through a reviewed filename + SHA-256
allowlist and records the exclusion reason in `catalog.json`; the remaining
360 snapshots retain byte-exact source content. Unexpected validation errors
or changes to the excluded source hash fail the build.

`scripts/tle_archive_query.py` is the existing build-time catalog and
provenance helper. The active browser runtime must consume a checked-in or
generated manifest derived from it; it cannot read the external filesystem.

The archive adapter normalizes existing files into entries equivalent to:

```ts
interface TleArchiveEntry {
  satelliteId: string;
  satelliteName: string;
  epochUtc: string;
  line1: string;
  line2: string;
  sourcePath: string;
  sourceKind: 'ARCHIVED_TLE';
}
```

The browser must not recursively discover arbitrary local files. A build-time
or checked-in manifest enumerates the allowed archive inputs.

The UI exposes OneWeb and Starlink as explicit choices. Switching constellation
loads and validates a different catalog, and cannot merely relabel an existing
frame.

The isolated worker seam is `src/tle/**`. Existing Walker/Kepler propagation
under `src/engine/orbit/**` remains unchanged until controller integration.

### 3.3 Snapshot resolution

For each requested constellation and instant:

1. parse and validate the catalog metadata and candidate publication ranges;
2. prefer the newest overlapping publication whose maximum epoch is not later
   than the requested instant; fall back to the newest overlapping publication
   only when no complete-prior publication exists;
3. do not merge records from different publications;
4. admit only records satisfying `epoch <= requestedInstant` and the
   manifest-declared maximum propagation age; and
5. return unavailable if no record passes.

The single-publication rule is required because successive Starlink files can
contain different element content for the same identity and epoch. Arbitrarily
merging those revisions would violate the conflict contract.

The maximum propagation age belongs to archive metadata and must not be hidden
inside a component.

### 3.4 Atomic switch

A successful time change publishes one new `TlePropagationFrame` containing:

```ts
interface TlePropagationFrame {
  frameId: string;
  requestedInstantUtc: string;
  resolvedEpochsUtc: Record<string, string>;
  sourceKind: 'ARCHIVED_TLE';
  propagationModel: 'SGP4';
  satellites: PropagatedSatelliteState[];
}
```

The scene must not display positions from the old snapshot while analysis
panels display the new instant. A failed resolution preserves the last
accepted frame and displays the refusal.

## 4. Canonical EE contract

### 4.1 Authority

The mathematical authority is:

```text
/home/u24/papers/modqn-paper-reproduction/docs/ADR-003-canonical-ee-closure.md
```

The runtime contract version is:

```text
family-b-thesis-3.13-3.17-v1
```

The TypeScript producer may adapt scenario geometry, units, and object
identities, but cannot redefine numerator, denominator, zero behavior, power
aggregation, or time aggregation.

The closest existing TypeScript donor is
`src/course/c120/backend/canonicalRuntime.ts`. It already follows the canonical
requested-power, cap, coupled-interference, rate, and power-ledger sequence,
but it is currently bound to the historical C-120 backend replay. The active
implementation must extract or adapt the science into a neutral module and
prove conformance; it must not make the current course route the new runtime
authority.

The current live path is only partial: `src/engine/signal/link-budget.ts`
accepts profile/override transmit power and produces SINR, while
`src/teaching/beamshiftCanonicalEe.ts` consumes that already-produced SINR and
a common RF output. This ordering must be replaced for the formal path because
it omits `gamma_req`, `p_req`, and canonical beam/satellite cap resolution.

### 4.2 Editable inputs versus derived outputs

| Category | Field | UI behavior |
|---|---|---|
| Editable | `P_beam_max` | power constraint, replaces independent SINR `P_t` |
| Editable | `P_sat_max` | satellite aggregate power constraint |
| Editable | `eta_PA` | bounded amplifier efficiency |
| Editable | `P_RFC` | per-active-beam RF-chain power |
| Editable | `P_BB` | satellite baseband power, apportioned by active beams |
| Editable | `P_event` inputs | only when an event-energy model is enabled and identified |
| Derived | `gamma_req` | determined by service/load contract |
| Derived | `p_req` | required transmit power before caps |
| Derived | `P_DL_actual` | actual post-cap power used everywhere downstream |
| Derived | interference and SINR | uses current frame actual powers |
| Derived | `R_u`, throughput | uses current frame realized SINR |
| Derived | `P_PA`, `P_sys` | canonical consumed-power ledger |
| Derived | instantaneous and evaluation EE | canonical aggregation only |

All editable numeric inputs require units, valid ranges, source/provenance, and
a reset value. Invalid inputs are rejected without partially updating the
frame.

### 4.3 Producer order

At each simulation tick:

1. consume one accepted propagation/geometry frame;
2. derive angle-aware gain and channel terms;
3. calculate `gamma_req(U)` and `p_req`;
4. apply beam cap, then the canonical satellite cap allocation;
5. freeze `P_DL_actual` for all active links;
6. calculate coupled interference from those actual powers;
7. calculate realized SINR and rate;
8. assemble PA, RFC, BB, event, per-beam, and system power;
9. calculate per-user `r1` and verify the system sum identity; and
10. append delivered bits and consumed joules to the evaluation accumulator.

No downstream step may read the requested power after actual power has been
resolved.

### 4.4 Shared result

The producer publishes one result equivalent to:

```ts
interface SimulationAnalysisFrame {
  frameId: string;
  instantUtc: string;
  tleFrameId: string;
  contractVersion: 'family-b-thesis-3.13-3.17-v1';
  inputs: CanonicalEeInputs;
  links: CanonicalLinkResult[];
  power: CanonicalPowerLedger;
  throughput: CanonicalThroughputLedger;
  ee: CanonicalEeLedger;
  provenance: AnalysisProvenance;
}
```

All four pages receive this object. They do not receive independent power or
SINR calculators.

## 5. Page responsibilities

### Power

- edits only declared power-model inputs;
- shows requested versus capped actual downlink power;
- explains which cap bound each link;
- shows PA, RFC, BB, event, and total system power with units; and
- never presents a derived quantity as an editable control.

### SINR

- shows signal, interference, noise, and realized SINR;
- displays the shared `P_DL_actual` as read-only evidence;
- links the active power cap back to the Power page; and
- removes the independent actual `P_t` state.

### Throughput

- shows per-user rate, service-set sum rate, and accumulated delivered bits;
- explains bandwidth and spectral-efficiency inputs; and
- uses the same realized SINR as the SINR page.

### EE

- shows the instantaneous numerator and denominator;
- shows accumulated delivered bits and consumed energy;
- computes evaluation EE as ratio-of-sums; and
- exposes zero/invalid status without substituting a plausible number.

## 6. Migration boundary

Existing implementations are classified before integration:

- canonical-compatible functions may be reused after conformance tests;
- teaching-only functions remain labelled and disconnected from formal state;
- legacy power or coverage-weighted metrics cannot feed the four formal pages;
- the current `maxTxPowerDbm` / `P_t` UI state is migrated to a precise
  canonical cap and is not silently reused as actual `P_DL`.

The controller owns changes to shared application state, routing, tab
composition, and the final producer. Workers must use mutually exclusive
module and test paths.

The isolated EE worker seam is `src/analysis/canonicalEe/**`. Existing
`src/teaching/**`, `src/utils/**`, `src/App.tsx`, and live scene publishers are
controller-owned integration or historical paths and must not be edited by
that worker.

## 7. Verification

### TLE gates

- first, middle, and last available archive instants resolve deterministically;
- OneWeb and Starlink each load their own content-addressed catalog and produce
  distinct TLE frame provenance;
- timezone round-trips preserve the UTC instant;
- malformed or unavailable snapshots fail closed;
- switching time changes the TLE frame and recomputes SGP4 positions;
- scene and panels share the same frame identity; and
- no TLE switch creates a handover or energy-saving event.

### EE gates

- frozen Python canonical cases replay within declared numeric tolerance;
- requested and actual power are distinct and caps are visible;
- SINR and PA power use the identical `P_DL_actual` values;
- throughput consumes the identical realized SINR values;
- per-user `r1` sums to system instantaneous EE;
- unequal-duration frames prove ratio-of-sums rather than mean-of-ratios;
- zero/zero and positive-rate/zero-power behavior match ADR-003; and
- no teaching or legacy consumer reaches the formal pages.

### Product gates

- TypeScript checks and focused unit tests pass;
- production build passes;
- a fresh browser run demonstrates date/time switching and all four pages;
- labels disclose TLE-derived SGP4 and the EE contract version; and
- no UI copy claims energy savings or Phase-1 platform integration.

## 8. Deferred decisions

A later ADR must define the energy-saving experiment and Phase-1 platform
integration. It must freeze the causal policy, baseline/candidate identity,
service-equivalence gates, energy boundary, exported artifact, registered
fields, upload behavior, and query-back verification before implementation.
