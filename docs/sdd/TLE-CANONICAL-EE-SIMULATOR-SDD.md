# TLE archive and canonical EE simulator SDD

Status: **Implemented contract; homepage publishes one complete two-hour archived-TLE run atomically**

Date: 2026-08-13

Authority: `docs/decisions/ADR-005-tle-and-canonical-ee-simulator-contract.md`

## 1. Objective

Implement two bounded simulator capabilities:

1. select an archived date/time and precompute the real TLE-derived SGP4 state
   for the complete two-hour playback window; and
2. expose SINR, EE, Power, and Throughput as four views of the same canonical
   angle-aware EE closure.

This SDD does not define an energy-saving policy or Phase-1 platform upload.

The complete formal workspace remains mounted at `/simulator`; `/` retains the
established three-column application shell and central main/campus scene. Both
routes use an explicitly uncalibrated NTPU/nadir-reference adapter for the
canonical analysis chain; this does not elevate the adapter into
thesis-scenario or calibrated-link authority. One lifted state owns the
homepage side rails' accepted run: the left rail contains source selection
plus every genuinely editable and fixed input parameter, while the right rail
contains the same-frame serving/candidate comparison plus persistent,
independently collapsible SINR, Power, Throughput, and EE result groups. Left
input-tab changes do not select, scroll, or hide right-rail results. The
homepage centre consumes the selected anchor of the same
last-accepted immutable run through an explicit
TEME-to-Earth-fixed-to-NTPU-look-angle display
adapter. It preserves the campus/camera shell without mounting the Walker,
handover, or legacy cell-schedule runtime. The Earth/orbit sphere scene remains
on `/simulator`. Internal frame identity remains
available for tests and reproducibility but is not printed as primary homepage
content. The homepage must not expose direct `P_t` or a page-local EE/throughput
formula as part of the canonical side-rail calculation.

## 2. Runtime architecture

```text
TLE archive manifest
  -> requested UTC instant
  -> deterministic snapshot resolver
  -> freeze one publication and one TLE pair per satellite
  -> satellite.js / SGP4 at 241 shared anchors (30 s)
  -> immutable 7,200 s geometry RunBundle
  -> complete real-pass extraction and deterministic diversity plan
                                      |
scenario and model parameters --------+
                                      v
canonical EE run/frame producer
  -> fixed seven-beam / 100-UE assignment and full U x B matrices
  -> angle-aware gain and absolute physical channel terms
  -> T_sys, B_beam, and sigma^2 from T_ant / NF / T_0 / B_sys / K_FR
  -> requested power
  -> capped actual downlink power
  -> I_intra / I_inter same-colour interference and SINR
  -> rate and throughput
  -> consumed-power ledger
  -> instantaneous EE and 240-interval ratio-of-sums evaluation EE
                                      |
                                      v
one immutable TleAnalysisRun, materializing one SimulationAnalysisFrame per anchor
  -> `/simulator` Earth/orbit TLE constellation / selected trajectory scene
  -> `/` campus sky-dome selected/candidate/context satellite-model projection
  -> `/` serving and same-instant candidate comparison in the side rails
  -> SINR page
  -> EE page
  -> Power page
  -> Throughput page

`/` central main/campus scene keeps the established display shell. Its
satellite geometry comes from the selected run anchor's
`SimulationAnalysisFrame.tleState`: TEME is rotated to Earth-fixed coordinates
at the accepted instant, converted to NTPU topocentric look angles, and only
then mapped to the campus sky-dome.
The campus, UE, UAV, and selected/candidate seven-cell beam geometry are
display-only substrate. It contains a faint radius-two honeycomb of 19 cells;
the seven active targets are the pairwise non-adjacent axial cells `(0,0)`,
`(2,0)`, `(2,-2)`, `(0,-2)`, `(-2,0)`, `(-2,2)`, and `(0,2)`. All 100
display UEs are assigned to an active cell and move with that cell. Selected
and candidate satellites may illuminate only those seven active targets;
context satellites own zero beams and no cell hopping is mounted. The grid is
a fixed experiment service area and is not derived from TLE orbital data; TLE
controls each beam apex through satellite position and motion only. The
homepage draws no continuous orbit/reference centre lines and never restores
the Walker scheduler or handover runtime.

The canonical scenario is not a single-reference-beam calculation. It owns
seven active beams with per-beam loads `[15, 15, 14, 14, 14, 14, 14]` and
100 fixed UEs. The producer retains the complete `U x B` angle, propagation,
and receive-gain matrices plus assignment, active-beam, satellite-ownership,
and reuse-colour vectors. All seven active beams currently belong to the
serving satellite, so the derived inter-satellite term is `I_inter = 0`; the
candidate satellite is computed as a separate same-instant counterfactual and
is not silently added as an active interferer. The canonical local scenario
uses the same seven active axial coordinates as the display substrate, keeping
topology and counts aligned while retaining an uncalibrated local coordinate
mapping. These cells are not TLE-derived physical footprints.
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
`/home/u24/demo/tle_data/starlink/tle`. At the 2026-08-26 inventory they contain
379 OneWeb snapshots through 2026-08-25 and 377 Starlink source snapshots
through 2026-08-24; both series begin on 2025-07-27. The external repository is
not an implementation target and must not be modified.

All 379 OneWeb snapshots validate. Exactly one Starlink source snapshot,
`starlink_20260528.tle`, contains an invalid 70-column line 1. The browser
archive excludes that whole snapshot through a reviewed filename + SHA-256
allowlist and records the exclusion reason in `catalog.json`; the remaining
376 snapshots retain byte-exact source content. Unexpected validation errors
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

### 3.4 Complete run and atomic switch

A source/date request freezes the selected publication and its resolved TLE
line pair for each satellite at `t0`. It then propagates the full admitted
constellation at one common UTC axis from `t0` through `t0 + 7,200 s`, inclusive,
at 30-second spacing. The result contains exactly 241 anchors. Midnight or an
archive-date boundary inside that run does not switch publications.

The full geometry run is validated before complete real passes are extracted.
Pass selection prefers high-elevation and spatiotemporally distinct events. A
candidate is published only when a real, simultaneously visible event satisfies
the overlap and continuation gates. A boundary-visible serving satellite may be
identified from real same-anchor geometry when its AOS or LOS lies outside the
two-hour window; this is explicitly marked as a geometry fallback and is never
invented as a complete pass.

A successful request publishes one immutable run equivalent to:

```ts
interface TleAnalysisRun {
  geometryRunId: string;
  durationS: 7200;
  stepS: 30;
  anchorCount: 241;
  passPlan: PassPlan;
  evaluation: SimulatorRunEvaluation;
  getFrame(anchorIndex: number): SimulationAnalysisFrame | null;
}
```

Constellation/time controls are a draft until the explicit Apply action. Draft
edits retain the current published frame. Apply clears the scene, result rail,
evaluation, and timeline, then starts the new build. While any geometry anchor,
pass event, or EE interval is still being computed, the timeline is locked and
no incomplete or previous-request frame is visible. Only a fully validated run
may publish the scene and result rail together. A failed request remains empty
and displays the refusal; a stale request cannot publish. Timeline seek
selects source time only inside the completed run and never routes through
Walker seek, modulo motion, or a synthetic first frame. The canonical frame is
the lower stored 30-second anchor. Once unlocked, transport step buttons retain
the 30-second anchor interval while the video-like scrubber accepts one-second
source positions. The centre renderer may interpolate only
between that anchor and its adjacent completed anchor by using their SGP4 TEME
position and velocity vectors; after cubic Hermite interpolation it must
recompute NTPU topocentric look angles for the intermediate UTC. This continuous
display projection must not be fed back into the canonical result frame.

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
| Editable | `K_FR` | frequency-reuse group count; colours active beams and derives `B_beam` |
| Editable | `T_ant` | antenna noise temperature in K |
| Editable | `NF` | receiver noise figure in dB |
| Editable | `T_0` | noise-reference temperature in K |
| Editable | `B_sys` | system bandwidth in Hz; `B_beam` is derived |
| Editable | `G_0`, `theta_3dB` | angle-aware transmit-gain inputs |
| Editable | `R_min` | service-rate target used by `gamma_req(U)` |
| Editable | `f_c` | carrier-frequency input to the channel adapter; never a TLE field |
| Editable | `chi_atm` | formal atmospheric attenuation coefficient used by the thesis large-scale path-loss term |
| Editable | `G^R_dBi` | receive-side gain converted once to canonical linear `G^R` |
| Compatibility-only | `channelGainScale`, `scintillationScaleDb`, `shadowFadingMarginDb` | retained in older serialized parameter records; ignored by the formal adapter and not rendered as controls |
| Derived | `gamma_req` | determined by service/load contract |
| Derived | `p_req` | required transmit power before caps |
| Derived | `H`, linear `G^R` | channel/receiver terms consumed by the immutable frame |
| Derived | `T_sys`, `B_beam`, `sigma^2` | physical noise terms from the editable noise/bandwidth inputs |
| Derived | `I_intra`, `I_inter`, `I_total` | same-colour interference decomposition |
| Derived | `P_DL_actual` | actual post-cap power used everywhere downstream |
| Derived | interference and SINR | uses current frame actual powers |
| Derived | `R_u`, throughput | uses current frame realized SINR |
| Derived | `P_PA`, `P_sys` | canonical consumed-power ledger |
| Derived | instantaneous and evaluation EE | canonical aggregation only |

For each link, the selected TLE/SGP4 range and elevation feed the formal
path-loss adapter. It computes `L` as free-space loss plus the thesis
atmospheric term, then derives the dimensionless power gain
`H = 10^(-L/10)`. Carrier, atmospheric-coefficient, receive-gain, and other
input defaults are scenario assumptions; they are not measured weather inputs
or a full thesis-hardware calibration. Compatibility-only channel extensions
cannot alter this formal path.

The left rail must expose every genuinely editable numeric input used by the
canonical frame. Each editable input requires units, valid ranges,
source/provenance, and a reset value. Invalid inputs are rejected without
partially updating the frame. Derived values are never editable and remain
read-only wherever they are shown.

The active defaults align with ADR-003: `P_beam,max = 1.65 W`,
`P_sat,max = 10^(13/10) W`, `eta_max = 0.35`, back-off `5 dB`, `P_RFC =
0.338 W`, `P_BB = 0.2 W`, `K_FR = 3`, `T_ant = 150 K`, `NF = 1.2 dB`, `T_0 =
290 K`, `G_0 = 2,000`, full `theta_3dB = 3.32°`, `R_min = 1 Mbit/s`, and
`B_sys = 500 MHz`. Carrier/atmospheric-coefficient/receive-gain defaults belong
to the explicit scenario channel adapter and are not measured weather or
thesis hardware calibration values.

### 4.3 Producer order

At each simulation tick:

1. consume one accepted propagation/geometry frame;
2. derive the full seven-beam angle/channel matrices and physical noise terms;
3. calculate `gamma_req(U)` and `p_req` for all 100 assigned UEs;
4. apply beam cap, then the canonical satellite cap allocation;
5. freeze `P_DL_actual` for all active links;
6. calculate same-colour `I_intra` and `I_inter` from those actual powers;
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
  candidateLink: CanonicalLinkResult | null;
  power: CanonicalPowerLedger;
  throughput: CanonicalThroughputLedger;
  ee: CanonicalEeLedger;
  scenario: CanonicalSevenCellScenarioMetadata;
  provenance: AnalysisProvenance;
}
```

All four pages receive this object. They do not receive independent power or
SINR calculators.

The candidate link is a bounded same-instant, same-parameter single-link
counterfactual produced atomically with the serving link. It is not a handover
event. Until a handover policy is separately accepted, offset, TTT, progress,
and handover count remain visibly unavailable rather than receiving profile
defaults or zeroes. The comparison exposes each link's `p_req`,
`P_DL_actual`, and `R_u` so target-tracking cases with equal realized SINR do
not hide different required powers.

ADR-006 now supplies the separately accepted policy: the completed TLE run
owns an immutable 3 dB offset／30-second TTT trace, and its selected identity,
progress, event, and cumulative count are published with the same analysis
frame. Frames without that trace continue to show unavailable values.

## 5. Page responsibilities

### Power

- edits only declared power-model inputs;
- shows requested versus capped actual downlink power;
- explains which cap bound each link;
- shows PA, RFC, BB, event, and total system power with units; and
- never presents a derived quantity as an editable control.

### SINR

- shows signal, interference, noise, and realized SINR;
- shows the derived `T_sys`, `B_beam`, and `sigma^2` terms from the physical
  noise inputs;
- separates same-satellite `I_intra` from other-satellite `I_inter`; the
  current seven-beam frame reports `I_inter = 0` because it has one active
  satellite owner;
- displays the shared `P_DL_actual` as read-only evidence;
- links the active power cap back to the Power page; and
- removes the independent actual `P_t` state.

### Throughput

- shows per-user rate, service-set sum rate, and accumulated delivered bits;
- shows editable `B_sys` and read-only `B_beam = B_sys / K_FR`, together with
  the fixed seven-beam load vector rather than a misleading single `U_b`;
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
- teaching-only functions must remain labelled and disconnected from formal
  state when retained; the former homepage ledger, 50/35 dBm comparison, and
  T1-T6 capture chain were retired on 2026-08-12 because they had no active
  formal consumer;
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

The retained `src/teaching/**` surface contains only canonical EE helpers used
by the active producer. Timeline discontinuities may reset a generic analysis
epoch, but no removed classroom ledger state or compatibility tab may be
reintroduced through that reset seam.

## 7. Verification

### TLE gates

- first, middle, and last available archive instants resolve deterministically;
- OneWeb and Starlink each load their own content-addressed catalog and produce
  distinct TLE frame provenance;
- timezone round-trips preserve the UTC instant;
- malformed or unavailable snapshots fail closed;
- switching time changes the TLE frame and recomputes SGP4 positions;
- every accepted homepage run contains exactly 241 shared 30-second anchors
  over 7,200 seconds and freezes one publication across the whole window;
- every accepted anchor has a real above-horizon serving satellite; candidates
  are either real and simultaneously visible or explicitly null;
- draft edits cannot replace the accepted run; after Apply, a stale or failed
  request cannot publish any scene or result, and the timeline remains locked
  until the full run is valid;
- while locked, play, speed, step, jump, keyboard, scrub, and programmatic seek
  cannot select any incomplete anchor;
- `/simulator` scene and its panels share the same frame identity; and
- serving and candidate link values are produced inside that same immutable
  frame; and
- homepage centre and side-rail calculations share that immutable frame;
- centre/right frame ID, TLE frame ID, selected satellite, instant, and
  selected TEME position and velocity remain equal through accepted switches;
- the centre adapter performs TEME to Earth-fixed to NTPU topocentric
  conversion before campus projection and never treats TEME as ENU; and
- no TLE switch creates a handover or energy-saving event.

### EE gates

- frozen Python canonical cases replay within declared numeric tolerance;
- requested and actual power are distinct and caps are visible;
- every accepted frame contains seven active beams, 100 assigned UEs, the
  `[15, 15, 14, 14, 14, 14, 14]` load vector, and full `U x B` matrices;
- `B_beam = B_sys / K_FR`, `T_sys = T_ant + T_0(10^(NF/10)-1)`, and
  `sigma^2 = k T_sys B_beam` are derived once and consumed by the same frame;
- the interference ledger exposes `I_intra` and `I_inter`, with current
  one-satellite seven-beam frames yielding derived `I_inter = 0`;
- SINR and PA power use the identical `P_DL_actual` values;
- throughput consumes the identical realized SINR values;
- per-user `r1` sums to system instantaneous EE;
- unequal-duration frames prove ratio-of-sums rather than mean-of-ratios;
- the homepage run evaluation contains exactly 240 30-second intervals and the
  endpoint anchor contributes no duplicate interval;
- zero/zero and positive-rate/zero-power behavior match ADR-003; and
- no teaching or legacy consumer reaches the formal pages.

### Product gates

- TypeScript checks and focused unit tests pass;
- production build passes;
- a fresh browser run demonstrates OneWeb／Starlink and date/time switching plus
  all four paired parameter/result pages;
- the homepage serving/candidate comparison and right-side results expose the
  same internal analysis/TLE frame identity after every accepted switch;
- the homepage retains the established central main/campus scene and camera;
  its selected/candidate/context satellite models visibly change with the
  accepted left-side constellation/date/time frame;
- its visible satellite positions come only from stored fully-published SGP4
  anchors or the bounded position-and-velocity interpolation between adjacent
  anchors; context satellites own zero beams, while selected and a real
  candidate may each render the fixed seven-cell comparison fan;
- the homepage left rail has no final-value duplication and the right rail has
  no editable inputs;
- the right rail retains independently collapsible SINR, Power, Throughput, and
  EE result groups; left-tab changes do not alter their expansion state, scroll
  position, or visibility;
- the homepage left rail exposes every genuinely editable input used by the
  canonical frame, and all derived values remain read-only;
- the homepage left rail does not mix Walker handover-policy controls into the
  archived-TLE parameter set;
- the homepage does not mount legacy HO Slow／Intra／Inter quick controls;
- no legacy Walker/handover runtime is mounted behind the homepage TLE centre;
- the dedicated `/simulator` route discloses TLE-derived SGP4 and the EE
  contract version while homepage provenance remains internal; and
- changing an RF/noise/reuse input changes the canonical frame and dependent
  results without changing the accepted TLE position, velocity, or trajectory;
- the central scene's radius-two 19-cell display grid and seven dispersed
  active cells share topology and load counts with the canonical frame; all
  100 UEs move with their assigned active cell, while local coordinates are not
  presented as calibrated or TLE-derived physical footprints; and
- no UI copy claims energy savings or Phase-1 platform integration.

## 8. Deferred decisions

A later ADR must define the energy-saving experiment and Phase-1 platform
integration. It must freeze the causal policy, baseline/candidate identity,
service-equivalence gates, energy boundary, exported artifact, registered
fields, upload behavior, and query-back verification before implementation.
