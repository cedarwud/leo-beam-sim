# ADR-014: Treat a satellite-beam pair as the handover candidate

## Status

Accepted for staged S0–S2 implementation by owner direction on 2026-08-27.
The earlier independent review returned `S0_S2_IMPLEMENTATION_GATE: PASS`; that
result is limited to the typed S0–S2 foundation and does not approve the
EE-policy amendment.

The repaired EE-policy amendment passed a fresh-context synthesis review on
2026-08-29 (`FABLE_MAX_IMPLEMENTATION_GATE: PASS`). This authorizes staged
implementation of the contract after the named validator-baseline prerequisite;
it does not authorize default activation or a scientific/visual acceptance claim.

The owner-directed target remains authorized in a bounded form. Governance is
strictly separated into four tiers:

1. **Owner implementation authorization:** GRANTED (2026-08-28) to repair,
   construct, and test the Walker canonical baseline plus the additive
   candidate-mode path under `homepage-ee-handover-v1`, including candidate
   satellite/beam ownership and persistent identity colour.
2. **Default activation gate:** BLOCKED. Forecast-EE selection cannot become
   the public default on `/` until the counterfactual, parity, calibration,
   candidate-window, and browser evidence below is complete and validated.
   It must not be marked PASS before those criteria are fulfilled.
3. **Scientific acceptance:** PENDING true system-EE calibration and canonical
   paper parity verification.
4. **Owner visual acceptance:** PENDING and required for the owner target.
   Automated tests, telemetry, screenshots, and cross-model or Opus review
   are evidence only; they cannot substitute for owner visual acceptance.

## Date

2026-08-27 (amended 2026-08-28; ADR-layer repair 2026-08-29)

## Context

The Walker homepage currently compresses all measured alternatives into one
comparison satellite and one pending target before the result reaches the
right rail or the 3D scene. The presentation therefore begins with an
apparently preselected “best candidate” and cannot show how several reachable
links were checked, rejected, stabilized, ranked, and finally selected.

The current model also treats inter-satellite and intra-satellite handover as
separate presentation paths. An inter-satellite event selects one satellite
and one beam, while the intra-satellite path exposes only one display-oriented
alternate beam. This prevents the simulator from explaining the same decision
procedure for:

- a switch from one satellite to another satellite;
- a switch between beams on the same satellite; and
- a mixed candidate set in which both kinds of target are available.

Finally, the current yellow/blue beam colours encode serving/candidate roles.
That convention erases identity at commit time: the selected blue target is
recoloured as a yellow serving link. It also cannot distinguish several beams
belonging to the same satellite.

## Decision

### 1. Candidate identity

The atomic decision target is a **satellite-beam pair**:

```text
CandidateLinkKey = (satelliteId, beamId)
```

A satellite is a grouping identity, not a complete handover target. The same
candidate contract is used for inter-satellite and intra-satellite decisions.
When a serving link exists, the event kind is derived after selection:

```text
target.satelliteId == serving.satelliteId  -> intra-satellite beam switch
target.satelliteId != serving.satelliteId  -> inter-satellite handover
```

Before the first serving link exists, the same candidate evaluation may end in
an `initial-attach` receipt. It must not fabricate a serving identity merely to
force the event into the intra/inter classification.
There is no keep-serving EE baseline in that state, so initial attach uses the
separately labelled compatibility-safe elevation/steering/scheduled/SINR path,
highest SINR, and stable pair key. It retains the compatibility policy's
explicit initial-attach TTT and selection-hold intervals before the external
atomic transaction; those intervals are not EE-trigger TTT. It makes no EE
improvement claim; normal EE-triggered decisions begin only after service is
established. Immediate TTT/hold bypass is reserved for the separately labelled
service-continuity fallback after an already committed serving pair disappears.

The current homepage commonly seeds the new decision engine from the legacy
per-cell manager with a non-null serving pair. This decision preserves that
route-entry behavior only as an explicitly typed `bootstrap-serving-seed`: it
is a pre-existing service baseline, not a fabricated initial-attach comparison
or receipt. A true `serving = null` engine path must still prove non-zero
initial TTT and selection hold before commit. After bootstrap, the legacy
manager may not select later primary-UE targets; those decisions belong to the
shared engine or the narrowly scoped service-continuity fallback.

If the current Walker implementation's `cellId` is used as a beam surrogate,
the adapter must state that provenance explicitly. It must not silently call a
logical cell a measured physical beam.

### 2. Decision pipeline

The runtime must preserve the candidate set through a shared state machine:

```text
monitoring -> evaluating -> qualifying -> selection-hold -> switching -> guard
```

The detailed candidate lifecycle follows a single, unified progression for
both intra-satellite and inter-satellite decisions:

```text
hard-eligible -> trigger-satisfied -> TTT-stable -> provisional leader
-> selected / atomic commit
```

Each hard-eligible satellite-beam pair remains present in the scientific set
and the inspectable rail even if its EE evidence is unavailable or below
threshold. Every such pair admitted to the bounded scene subset receives a
wireframe; excess pairs remain explicitly typed overflow rather than
disappearing. It keeps its own trigger state and advances its independent TTT
only while the accepted active trigger is continuously satisfied. In the
Forecast-EE-active mode that trigger is the matched EE condition; compatibility,
startup, and safety modes retain their separately labelled meanings.
After activation, the decision frame exposes an EE objective rank across every
hard-eligible pair with valid same-horizon evidence and a separate stable-set
rank used to choose the provisional leader. A pair may therefore be `EE #1`
but not yet stable; the interface must make that distinction explicit rather
than hiding it. Before activation, the same neutral rank field follows the
explicit SINR compatibility objective and is labelled `SINR #…`; a
validation-only EE rank cannot replace it.
Changing the provisional leader must not erase another candidate's timer while
that candidate remains hard-eligible and trigger-satisfied under the accepted
active objective. Only one target
may be committed. An established-serving snapshot shows exactly one active data
link; a truthful detached/initial-attach snapshot shows zero, and the count is
never greater than one.

Hold completion produces only a private commit intent. The public commit receipt
and serving change exist only after the primary assignment/load/RF transaction
succeeds and remeasures the target in the resulting state. Ordinary failure
restores the pre-step checkpoint and old sole serving link with no receipt;
failed continuity protection after the old pair disappeared produces a truthful
detach. A raw intent cannot drive the scene, rail, toast, guard, or event cue.

Decision data uses a policy-neutral `trigger-satisfied` role plus an explicit
active trigger objective. The role is labelled `能源效率條件成立` only when the
objective is Forecast EE, `SINR 比較條件成立` while the compatibility policy is
active, `首次連線條件成立` during an unattached startup decision, and
`服務連續性條件成立` in the safety fallback. A validation-only EE forecast is
never allowed to set the compatibility trigger, advance its TTT, rank, select,
or commit.

Every candidate also carries one `activeTriggerEvidence` record whose objective,
status, source frame, and policy hash match the decision frame. Forecast mode
records relative EE delta and threshold; SINR-offset mode records
candidate-minus-serving SINR and offset; initial attach and continuity record
candidate SINR versus the compatibility floor plus their supporting hard gates.
This provenance is required even when the result is unavailable, so a neutral
trigger boolean never becomes an unexplained or mislabeled decision.

Activation status and normal policy mode are exact outside the safety override:
SINR compatibility is `blocked`, Forecast-EE validation is `validation-only`,
and Forecast-EE decision authority is `active`. A service-continuity fallback
preserves the pre-fallback activation status for resumption but publishes only
its compatibility objective/gates while protection is running.

The decision frame also names its active hard-gate profile. Forecast-EE service
uses the complete geometry/scheduling/effective-SINR/primary-UE-throughput/
remaining-service gate set. Pre-activation SINR, startup attach, and the safety
fallback retain their explicitly labelled compatibility gate sets and cannot
claim that unexecuted `Rmin` or remaining-service gates passed. Validation-only
full-gate results remain inspection evidence, not active eligibility.

Normal-operation selection uses forecast energy efficiency (EE) as the ranking
and TTT trigger objective over a common horizon $H$. The threshold is supplied
by the active policy profile; this ADR does not establish a numeric
$\epsilon_{\text{EE}}$ default:

$$\hat{\eta}_H(\text{candidate}) \ge \hat{\eta}_H(\text{baseline}) \times (1 + \epsilon_{\text{EE}}^{\text{profile}})$$

The corresponding `relativeDelta` is exactly
$\hat{\eta}_H(\text{candidate}) / \hat{\eta}_H(\text{baseline}) - 1$. Both EEs
must be finite and the baseline must be strictly positive; otherwise the
comparison fails closed rather than using an infinite, clamped, or absolute
difference.

After Forecast-EE activation, SINR is retained strictly as a **hard QoS floor**
(minimum threshold gate $\text{SINR} \ge \text{SINR}_{\min}$) and is not that
mode's ranking or trigger metric. Before activation, the explicitly labelled
SINR compatibility policy remains the active decision authority and
validation-only EE cannot replace it. The existing separately labelled service-continuity
fallback is narrower: it may run only when the serving pair is absent after the
same-frame transaction, using the compatibility elevation, steering,
scheduled/illumination and SINR gates plus stable-key highest-SINR selection.
It commits immediately, does not use candidate EE, `Rmin`, or remaining-service
forecasts, and must never be presented as an EE-optimal decision.

### 3. Bounded EE-policy authorization & `homepage-ee-handover-v1`

ADR-005 deliberately left energy-saving handover policies unresolved. This ADR
is the separate bounded decision that ADR-005 requires, and supersedes only
ADR-005 lines 182–195 for the Walker homepage work described here. The owner
authorization covers the Walker canonical baseline and the additive candidate
path; it does not freeze numerical policy defaults or satisfy the separately
blocked default-activation gate.

#### Walker canonical baseline and causal counterfactual

The authorized Walker canonical baseline retains the explicit ownership map for
candidate satellite-beam pairs. Its presentation plan also assigns a stable
identity colour to every displayed candidate satellite and controlled beam
shade. Ownership is scientific provenance; colour is presentation identity.
Neither may be used as a hidden ranking, load, or interference input.

The five ADR-005 boundaries are mandatory:

- **causal control:** replace the primary UE's assignment from its current
  satellite-beam pair with one candidate pair in the same Walker canonical
  frame. The counterfactual must update the assignment matrix, active-beam
  state, and affected per-beam/per-satellite loads, then recompute
  inter-satellite interference and all downstream SINR, rate, system power,
  and system-EE values. A scalar label swap is not a causal control.
  Candidate pairs are evaluated one action at a time against the same baseline;
  displaying several candidates does not activate them simultaneously. An
  inter-satellite action incurs the newly required target satellite/beam power
  and interference, while every other alternative target retains its baseline
  state. A source beam deactivates only when its recomputed load reaches zero.
- **comparison identity:** keep the current assignment over the identical
  forecast window, source-frame sequence, canonical configuration, and
  non-treatment UE state. Only the candidate assignment action may differ
  between baseline and counterfactual.
- **energy boundary:** use canonical Walker system power and delivered bits for
  the complete affected assignment/power state, using ADR-005's one state
  graph. $E_{\text{switch}}$ is resolved from the canonical `switchEnergyJ`
  configuration and included under the profile's
  `target-once-at-horizon-start` convention. Every matched-baseline indicator
  is zero; exactly the target-beam indicator is one in the candidate's first
  forecast sample, and every other candidate indicator is zero. The Walker
  builder constructs that sequence; `canonicalForecastEeEvaluator` is the final
  enforcement owner and rejects non-binary, missing, repeated, baseline, or
  wrong-boundary event witnesses before evidence becomes valid, so integration
  contributes exactly one `switchEnergyJ` event and
  does not also charge the source beam. The convention and event boundary are
  policy-hashed provenance, not paper constants. Before evidence exists,
  diagnostic `switchEnergyJ = 0 J` is permitted only when explicitly labelled
  as a zero-switch-energy diagnostic with known bias; its event witness is still
  required, and it cannot pass the policy gate or support a savings claim.
  Exogenous canonical training indicators remain identical in the matched pair;
  v1 does not invent candidate-only training energy. A future causal training
  term requires a named profile amendment and its own exactly-once boundary.
- **service constraints:** apply geometry, satellite/beam ownership,
  scheduling/illumination and hopping eligibility, the primary UE's
  candidate-counterfactual per-UE predicted rate, the effective SINR floor,
  remaining-service threshold, TTT, selection hold, and guard gates.
  $R_{\min}$ is a threshold on the primary UE's same-source-frame canonical
  `rateUBps` under the candidate counterfactual assignment/load, not a horizon
  average, aggregate, cell-centre, or serving-load value. The effective SINR
  floor is $\max(\text{profile floor}, \gamma_{\text{req}})$, with the values
  expressed in the same domain. Any change to a related input requires the
  affected candidate values and gates to be recomputed. In plain terms, the
  effective SINR floor is `max(profile SINR floor, derived gamma_req)`.
- **claim boundary:** counterfactual forecast EE in a simulation, never
  measured savings, operational optimization, live energy, or platform-energy
  claims.

Every candidate must therefore recompute delivered bits, consumed canonical
system energy, load, angle-dependent link values, and inter-satellite
interference over the selected window. It is forbidden to copy serving
instantaneous EE or scalar metrics onto candidate pairs.

The future-frame authority is a pure data path from one frozen accepted Walker
anchor. It generates the deterministic orbital elements with
`generateWalkerConstellation`, propagates them at each requested absolute time
with `propagateOrbitElement`, and retains the returned ECEF/geodetic geometry.
The anchor carries numeric `epochUtcMs`; all requested sample times, returned
frame times, and canonical `startSimTimeMs` are UTC absolute milliseconds, with
replay offset derived as `(absoluteUtcMs - epochUtcMs) / 1000`.

Per-UE future positions start from the accepted frame's ENU identities and
typed frozen motion owner: the current protagonist replays `profile.ueMobility`,
secondary UEs clone `UePerMobilityState`, and former protagonists retain their
frozen ENU drift. The focus/protagonist identity remains fixed for one forecast
window and is hash provenance. The 20-second elevation-filtered trajectory cache,
sky-dome/Three.js world coordinates, cell-centre substitutes, and current
`[0, 0, 0]` snapshot ECEF placeholders are not scientific forecast sources.

The frame records a geometry-model hash that explicitly names the current
WGS84 orbit/topocentric model, spherical-6371 beam/link model, and flat-111.32
local ENU projection. This mixed but declared boundary must not be described as
one Earth model or changed without parity evidence. Every satellite carries
`OrbitPoint` plus `TopocentricPoint`; every UE carries ENU/geodetic/ECEF; every
beam carries a finite normalized ECEF-axis direction plus either an earth-fixed
target or exact accepted-sample frame/bucket provenance, together with schedule,
active/load, ownership, and reuse state.
The provider cannot mutate the live clock, assignments, timers, or mobility
state; failure to reproduce this pure source is a stop condition, not
permission to infer geometry from the rendered scene.

#### Profile values, measurement, and lifecycle

The named experimental profile remains `homepage-ee-handover-v1`, but its
numeric policy values are not canonical paper constants:

- **Chosen horizon:** 17.5 s may be retained only as a chosen `7 x 2.5 s`
  horizon pending measurement. It must not be described as a full hopping
  period or frame.
- **Hopping semantics:** the default `7-cell` layout/index assignment does not
  rotate. Its `K < N` illuminated window may still advance per `hopSlotSec`;
  this temporal hopping is not layout rotation. A `19-cell` schedule has a
  19-cell period, not 7. Neither schedule fact
  establishes that the chosen 17.5 s horizon defines a full hopping period.
- **Sampling step:** `dt = 2.5 s` may be the chosen sampling configuration;
  it is not evidence that the horizon is a full hopping period.
- **Throughput gate:** `Rmin` is a profile-configured threshold on the primary
  UE's per-UE predicted rate under the candidate counterfactual load. The
  owner profile may provisionally carry `Rmin = 1 Mbit/s`, but that is a
  configuration value, not a canonical paper constant; its evidence remains
  subject to the blocked gate.
- **Effective SINR gate:** use
  `max(profile SINR floor, derived gamma_req)`; changes to `Rmin`, load,
  bandwidth, or any `gamma_req` input trigger recomputation of the rate, floor,
  gates, and EE evidence.
- **EE threshold:** there is no fixed percentage default. `epsilon_EE`
  remains TBD until the true canonical system-EE `relativeDelta` distribution
  over 7,200 s is complete for both intra-satellite and inter-satellite
  cases. The distribution must use matched causal controls and system
  ratio-of-sums EE, not a per-link or instantaneous proxy.
- **Tie tolerance:** tie tolerance is an adjustable policy configuration value,
  not a paper constant. Its numeric value is TBD pending the same profile and
  calibration evidence.
- **Remaining service and guard:** for this profile,
  `remainingServiceThresholdSec` is the derived
  `requiredTttSec + selectionHoldSec + guardSec + H`, not a second adjustable
  number. Its inputs and result are stored in policy hash and gate provenance.
  A future added margin requires a separately sourced and accepted field.

Calibration records the unthresholded valid `relativeDelta` distribution,
numerical repeatability, intra/inter opportunity counts, service outcomes, and
reversal behavior; it must not tune for a desired animation count. A separate
dated acceptance receipt must freeze the chosen threshold/tolerance and profile
hash before default activation.

A policy configuration change covers the complete decision surface: `H`,
`forecastSampleStepSec`, `forecastRefreshCadenceSec`, the
`ForecastExecutionBudget` hash, `epsilon_EE`, `tieToleranceRelative`, minimum
elevation, maximum steering, schedule/hopping-plan hash, `Rmin`, `SINRmin`,
`initialTttSec`, `requiredTttSec`, `selectionHoldSec`, `candidateAbsenceToleranceSec`,
the derived `remainingServiceThresholdSec`, `contactPredictionStepSec`,
`contactDropToleranceSec`, `contactPredictionWindowSec`, `guardSec`,
`E_switch` (resolved through canonical `switchEnergyJ`),
`switchEventAccountingMode`, `canonicalContractVersion`, `canonicalConfigHash`,
the immutable Walker scenario-config hash, and the
profile ID/version. The canonical serialized configuration must
be hashed; the hash belongs in cache keys, forecast provenance, and the
presentation snapshot. On any hash change, candidate/forecast caches are
cleared and TTT, selection hold, guard, and episode state are reset atomically.
No evidence, timer, or presentation snapshot from the prior policy hash may be
reused. A still-valid committed serving assignment remains the new episode's
starting truth and retains its existing serving origin; the config reset alone
must not fabricate a bootstrap, detach, attach, or handover.

This authorizes implementation and validation of the forecast-EE policy under
the named profile, not its default activation. Until the blocked activation
gate passes, `SinrOffsetPolicy` remains the active compatibility baseline. A
complete canonical candidate forecast may appear only as a clearly labelled
`validation experiment` excluded from ranking, TTT, selection, and commit;
otherwise candidate EE remains explicitly pending/unavailable rather than zero.

### 4. Scientific and presentation separation

Four interfaces own different concerns:

1. `CandidateOpportunityProducer` produces scientific candidate facts.
2. `HandoverDecisionEngine` keeps non-EE hard eligibility distinct from the EE
   trigger, then applies independent timers, objective/stable-set ranks,
   selection hold, commit, and guard state.
3. `CandidatePresentationPlan` applies display budgets, stable identity
   colours, visual roles, labels, and overflow disclosure.
4. The accepted-snapshot publisher validates and deep-freezes one presentation
   publication for all consumers; it is not a second decision engine.

`useSimStatePublisher` synchronously builds one accepted
`AcceptedHandoverPresentationSnapshot` and publishes that exact object reference
as `SimState.acceptedHandoverPresentation`. On the resulting App commit, App
passes the same accepted object to both `MainScene` and the right sidebar
(`WalkerResultsRail` / `HandoverEvaluationPanel`). Neither consumer reads a
private synchronous hook return. `HandoverDecisionFrame` and
`CandidatePresentationPlan` are inputs to the immutable publication, not
independently recomputed feeds.

The snapshot is built once per authoritative decision publication; scene and
rail receive the same instance. It includes the concrete satellite/beam colour,
glyph, pattern, hex/cone/link visual treatment, bounded slot, and overflow
fields required for direct rendering, so neither consumer performs a second
identity allocation or role-to-style plan.
When that publisher is disabled, the route is not live Walker, or no decision
frame exists, it returns a null session and publishes a null accepted snapshot;
no stale live-Walker object may remain visible on another lane.
The accepted-snapshot path bypasses the legacy one-second scalar/teaching
throttle for source-frame, config, phase, leader, selected, and commit changes.
Hover/pin state is a separate route-scoped inspection object and never mutates
scientific evidence. Pin swaps are resolved once by the central publisher, not
once per consumer.

Because `recentCommit` exists only on the engine's atomic commit frame, the
accepted snapshot retains the latest receipt while all of these remain true:
same episode, same epoch, non-decreasing simulation time, and the receipt target
is still the current serving pair. The retained receipt is cleared on rewind or
identity change. Both scene and rail use this one snapshot field; neither may
infer commit from a wall-clock animation phase or maintain a competing
scientific receipt latch.

For every candidate present in the snapshot, the candidate overlay and rail row
must join with zero field divergence on identity, phase, role, metric evidence, and `sourceFrameId`.
The `sourceFrameId` is the scientific source-frame join
key; a rail or overlay may not silently substitute a newer or older metric.
Every `MetricEvidence` status retains that non-empty opportunity-frame key;
`unavailable`, `stale`, `invalid`, and `zero-activity` evidence uses a typed
reason instead of erasing provenance with `sourceFrameId = null`. A future
forecast sequence remains separate provenance and does not replace this anchor.
This contract replaces a requirement for literal same-render-time equality.
Continuous geometry may be interpolated between adjacent accepted snapshots for
smooth presentation, but identity, phase, role, metric, and `sourceFrameId`
must remain those of an accepted snapshot and may not be interpolated or
invented. At the atomic commit boundary, publish the new accepted snapshot immediately:
the old solid link ends and the new solid link begins at that
boundary, without a UI-throttle delay.

Because WebGL cell/satellite mapping is resolved inside `MainScene`, the scene
publishes a render receipt keyed by `snapshotId` and `sourceFrameId`, listing
rendered pair keys, unmapped reasons, solid-link count, and event-cue count.
This receipt may report a mapping failure but cannot rewrite the snapshot's
metrics or roles. In this migration the established serving/event carrier is
unconditional and cannot be hidden by plan or receipt state. The matching
actual render receipt instead validates additive candidate mapping and prevents
an optional replacement decoration from claiming ownership before it exists.

Scientific candidate records do not contain colours, opacity, row order, or
other presentation-only values. Display limits must not alter which candidates
the decision engine evaluates.

The presentation budget is bounded:
- At most **3 satellite groups** (serving satellite + at most 2 alternate
  satellites).
- The candidate subset is `3x2` (`3 × 2`) candidate beam slots; the serving
  beam is one additional established carrier, for a maximum of 7 total cone
  volumes in the mixed-event presentation.
- Overflow candidates beyond this display budget are explicitly summarized as
  `+N` in the right rail and can be pinned for inspection.
- **Hover/pin cross-highlighting:** Hovering or clicking a candidate row in
  the right rail cross-highlights the matching beam cone and footprint in the
  3D scene, and vice versa.

### 5. Colour semantics and link uniqueness

Colour identifies a satellite for the duration of a handover episode. Beams on
the same satellite use controlled lightness/tonal variants of the same hue
(同星波束階調). A satellite retains its identity colour persistently before,
during, and after commit, as well as throughout the completion receipt (顏色衛星恆定).

Role is encoded redundantly through line style, fill, opacity, outline, motion,
and text—not by replacing the identity colour:

- **serving:** solid edge, restrained translucent fill, sole solid data link;
- **observed:** thin/dotted outline, hollow measurement endpoint, no active link;
- **hard-eligible:** visible wireframe in the bounded scene subset even when EE
  evidence is unavailable or the EE threshold is not met; excess pairs remain
  typed, inspectable overflow;
- **trigger-satisfied:** dashed outline plus its independent TTT progress cue;
  public wording follows the accepted trigger objective;
- **TTT-stable:** stable marker distinct from provisional leadership;
- **provisional leader:** strengthened outline and directional pulse;
- **selected:** double outline, chevron, and explicit “selected target” label;
- **committed:** new solid link appears only at the exact commit boundary where
  the old solid link ends.

At no point in time may two solid links appear simultaneously. The count is
`1` when service is established, `0` only while detached or before initial
attach, and never greater than one. Dual active links (DAPS) must not be
rendered or implied.

For inter-satellite presentation, this also applies to filled cone ownership:
before the matching receipt, only the source may own the established filled
transition cone and the target remains wireframe/dashed; after the receipt,
only the target may own it. `holding`, `releasing`, and `settled` are timing
vocabulary, not commit evidence, and cannot change the owner or completion
copy by themselves.

The satellite GLB keeps its realistic material. Identity colour is applied to
its label/ring, beam family, footprints, and corresponding right-rail group.
Its material remains opaque and never fades to encode candidate status. The
established serving cone, hex footprint, callout, sole serving particles, and
handover event choreography remain the carrier; the multi-candidate renderer
adds candidate-only wireframes/hex footprints and never replaces that carrier.
Candidate/rank/phase changes do not trigger automatic camera pan, zoom, refit,
or orbit; manual camera control remains available.

If the inspectable overflow contains more satellite identities than the
collision-free palette can supply, repeated hues are explicitly typed with
`colorMayRepeat` and paired with stable, shared glyph/pattern and ID cues.
Pinning such a row may change the bounded subset but may not recolour an
existing episode identity or make colour the only join cue.

This decision supersedes the homepage portion of
`docs/sinr-live-semantic-beam-colour-sdd.md`, where yellow and blue encoded the
serving and candidate roles. It also supersedes, for this homepage candidate
mode only, the role-colour ownership and forbidden T2-to-cone cross-use rules in
`docs/visual-clarity-proposal/visual-clarity-sdd/contracts.md`. Implementation
must introduce a route-scoped channel registry and update the corresponding
source validators; it must not weaken those rules for other lanes.

Inter/intra event type remains visible through explicit wording, icon/shape,
and pulse path. Removing role colour must not remove event-kind information.

### 6. Homepage source boundary

This decision applies to the Walker-only homepage established by ADR-013. It
does not connect the homepage date/time selector to archived TLE propagation,
and it does not change the dedicated TLE teaching routes.

### 7. Acceptance and evidence boundary

Before any S4/S5 change lands, the existing scene-lane governance validator must
first be restored to a green baseline by updating its stale serving-footprint
and active-toast needles and resolving its earlier timeline-descriptor abort.
That prerequisite strengthens the current carrier checks; it does not authorize
deleting them or weakening another lane.

The 2026-08-29 fresh-context synthesis review returned
`FABLE_MAX_IMPLEMENTATION_GATE: PASS` with no remaining design MUST. The
`EE_POLICY_ACTIVATION_GATE` nevertheless remains BLOCKED until the repaired
contract is backed by:

- matched causal baseline/candidate system-EE evidence over 7,200 s, including
  the intra/inter `relativeDelta` distributions needed to choose `epsilon_EE`;
- measured horizon and hopping semantics, canonical `switchEnergyJ` evidence,
  effective SINR and primary-UE `Rmin` counterfactual proofs, and
  TypeScript/Python parity;
- hash-keyed cache invalidation and atomic policy-reset tests;
- `AcceptedHandoverPresentationSnapshot` joins proving zero divergence for
  identity, phase, role, metric, and `sourceFrameId`, continuous-geometry-only
  interpolation, and immediate commit publication;
- browser evidence retaining the owner target's additive Walker carrier,
  `3x2` candidate budget, exactly one solid data link in every established-
  serving snapshot, zero only for truthful detached/initial attach, and never
  more than one; and
- explicit owner visual acceptance.

Automation may assert invariants, hashes, joins, counts, and failure states,
but automation is not visual acceptance. Owner review remains the acceptance
authority for the scene/rail readability and the latest owner-directed target.

## Alternatives considered

### A. Publish a candidate list but retain the single-target manager

This is the smallest code change, but the UI would appear to compare several
links after the manager had already selected one. It would be an explanatory
animation rather than a representation of the decision process. Rejected.

### B. Preserve opportunities, then decide through policy adapters

This makes the full candidate set first-class, shares one state machine between
intra and inter events, and permits a SINR baseline policy and a forecast-EE
policy without duplicating orchestration. Selected.

### C. Introduce a separate event-sourced teaching reducer

This would make replay and narration flexible, but it would create a second
handover state beside the live runtime and invite drift between the explanation
and the actual decision. Rejected for the homepage. Event receipts may still
be derived from the single decision frame.

## Consequences

- `comparisonSatId` and `pendingTargetSatId` remain compatibility projections,
  not the source of candidate truth.
- The upper Walker right-rail comparison area is replaced while its lower
  formula/metric accordions remain contextual for the serving or pinned pair.
- The central scene and right rail publish through
  `AcceptedHandoverPresentationSnapshot`, with a `3x2` candidate budget plus
  one serving carrier (maximum 7 cone volumes).
- Normal handover uses profile-controlled forecast EE and the hard SINR floor.
  `Rmin` is the primary UE's per-UE predicted-rate gate under candidate
  counterfactual load, and the effective floor is `max(profile SINR floor,
  derived gamma_req)`.
- The chosen 17.5 s (`7 x 2.5 s`) horizon remains pending measurement only.
  The default 7-cell layout/index assignment does not rotate, while its
  illuminated window may advance per slot; a 19-cell schedule has period 19,
  not 7, and no full-hopping-period claim follows.
- `epsilon_EE` is TBD until true system-EE `relativeDelta` distributions over
  7,200 s are complete for both intra- and inter-satellite cases. Tie tolerance
  is configuration, not a paper constant, and is also TBD.
- Policy changes hash the full control surface, clear relevant caches, and
  atomically reset TTT, selection hold, guard, and episode state.
- Candidate assignment, active state, load, and inter-satellite interference are
  recomputed for every causal counterfactual.
- `E_switch` uses canonical `switchEnergyJ` exactly once on the target beam in
  the first candidate forecast sample; the matched baseline has no switch
  indicator. Diagnostic zero is allowed only when explicitly labelled as
  biased zero-switch-energy evidence and still carries the event witness.
- Satellite identity colours remain constant across the episode, with beam tone
  variations, exactly one solid data link whenever service is established,
  zero only for detached/initial attach, and never more than one.
- The default activation gate remains BLOCKED, and owner visual acceptance is
  required; automation and cross-model review cannot substitute for it.

## Detailed design

See
[`HOMEPAGE-MULTI-CANDIDATE-MULTIBEAM-EE-HANDOVER-SDD.md`](../sdd/HOMEPAGE-MULTI-CANDIDATE-MULTIBEAM-EE-HANDOVER-SDD.md).
