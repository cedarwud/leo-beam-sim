# ADR-011: Add constrained per-satellite beam layouts, Beam Hopping, and same-satellite beam-switch evidence

## Status

Accepted by owner direction for simulator implementation.

## Date

2026-08-16

## Context

The unified Visual Lab currently draws seven beams for each selected satellite:
one centre beam and six first-ring beams.  Seven is a useful lightweight layout,
but it is not the only valid complete hexagonal layout and must not remain a
product constant.

3GPP TR 38.821 V16.2.0, Table 6.1.1.1-4, defines the single-satellite
system-level-simulation baseline as a hexagonal mapping of beam boresight
directions on the satellite-frame UV plane.  Its baseline is a 19-beam layout:
one centre beam plus 18 beams on two tiers.  The same table derives adjacent
beam spacing from the 3 dB beam width as
`ABS = sqrt(3) * sin(HPBW / 2)`.  This is a simulation baseline and geometry
method, not a universal payload maximum.

A complete `r`-ring hexagonal layout contains
`B(r) = 1 + 6 * sum(k, k=1..r) = 1 + 3r(r+1)` beams.  The first layouts are
therefore 1, 7, 19, 37 and 61; accepting an arbitrary integer would produce a
partial ring unless a separately declared custom beam-drop topology supplied
all boresight identities and geometry.

The current paper uses different quantities for different purposes:
`N_V = 39` physical beam positions per satellite, `J_w = 7` local candidates
per visible satellite and `v_max = 3` as the paper experiment's simultaneous
activation limit.  None of these three quantities defines this product's
per-satellite visual beam-layout selector.  In particular, `v_max` remains a
paper experiment setting and is not exposed here as the Visual Lab beam-count
control.

The evolving `thesis-mc-modqn-faithful/` directory confirms the same Chapter 3
physics and handover vocabulary, but its README explicitly marks it as an
isolated candidate rather than the live thesis or a replacement for ADR-003.
It does not define a Beam Hopping scheduler, slot duration, duty cycle, or
operational Starlink/OneWeb illumination pattern.  Its Chapter 4 input contract
also differs from the current live `thesis-mc/`, so it cannot silently replace
the existing authority chain.

The 2026-08-16 Phase-I update was rechecked separately after its current
Chapter 4/5 source changed.  It freezes a diagnostic-only N/A/B/C
training-data-flow contract with Source Gate A, transfer-identifiability Gate B
and endpoint Gate C.  Even a Gate-C pass is only
`PHASE1-PILOT-PROMOTION-ELIGIBLE` for a later data-blind 9000-episode
preregistration; it is not an effect, ranking, win or Chapter 5 result.  The
candidate keeps Phase-I separate from the formal six compute arms and retains
per-user masked `argmax` at deployment.  Phase-I therefore does not define a
beam-layout count, Beam Hopping schedule, same-satellite beam-switch policy, or
a new runtime EE model.  It changes no control or renderer semantics in this
ADR.

The candidate is not yet textually closed: current Chapter 4/5 describe arm A
as `current online dual rollout` with rolling q80/q50, while its README still
says `current online rolling EXP`.  The Visual Lab imports neither phrase as a
runtime policy; candidate authors must reconcile that source wording upstream.

The historical Walker runtime contains useful implementation ideas for a
deterministic scheduler and same-satellite beam-switch state machine.  Its
Walker geometry, HOBS formula family, profile defaults, sub-30-second event
timing, and display heuristics do not describe the archived-TLE canonical run
and cannot be copied into the Visual Lab as scientific evidence.

## Decision

### Terminology

The Traditional-Chinese product vocabulary is fixed as follows:

| English | Traditional Chinese | Meaning |
|---|---|---|
| Beam Hopping (BH) | 波束跳躍 | the active ground-beam-position subset changes by time slot |
| beam-hopping schedule | 波束跳躍排程 | the rule that selects the eligible subset for each slot |
| fixed illumination | 固定照射 | the same bounded eligible subset is retained across slots |
| same-satellite beam switch | 同衛星換束 | one UE keeps the satellite identity but changes serving beam identity |
| cross-satellite handover | 跨衛星換手 | one UE changes serving satellite identity |

Do not use `跳波束排程`, treat `beam hop` and `handover` as synonyms, or label
an active-set change as a service event without a changed UE service pair.

### Authority boundary

1. 3GPP TR 38.821 Table 6.1.1.1-4 owns the standards-backed single-satellite
   baseline layout and adjacent-spacing method used by this ADR.
2. External ADR-003 and its canonical runtime own EE, power, load, active-beam,
   interference, zero, and aggregation semantics.
3. The live `thesis-mc/` remains the manuscript front door.  The isolated
   faithful candidate is a review input only until explicitly promoted.
4. ADR-005 and ADR-006 continue to own archived-TLE/SGP4 geometry and the
   cross-satellite decision trace.
5. This ADR owns only the Visual Lab scenario policy and the additional
   paper-compatible beam-identity trace.

The initial Beam Hopping policy is a deterministic simulator experiment.  It is
not claimed to be the thesis algorithm, a trained MODQN policy, HOBS, or an
operational Starlink/OneWeb schedule.

### Domain model

The following identities remain separate:

- `GroundCellId`: a displayed ground service region.
- `BeamPositionId v`: a physical beam position in the paper's set `V`.
- `BeamLayoutRingCount r`: the number of complete rings around the centre beam.
- `BeamLayoutCount B(r)`: the per-satellite rendered beam count derived as
  `1 + 3r(r+1)`; it is never an unconstrained integer.
- `BeamLayoutPreset`: an accepted `(r, B, HPBW, spacing, boresight identities)`
  bundle.  The initial product presets are 1, 7 and 19 beams per satellite;
  7 is the default lightweight scene and 19 adopts the topology and UV-spacing
  method of the 3GPP single-satellite simulation baseline.  The complete case
  keeps the narrower physical-spacing claim gate stated below.  Layouts of 37
  or more remain unavailable until their visual-density and runtime gates pass.
- `EligibleBeamSet E_s(t)`: positions admitted by the scenario policy for
  satellite `s` at one slot.
- `ServingPair (s,v)`: the realized satellite-beam pair selected for one UE.
- `BeamLoad U_{s,v}(t)`: the count of UEs whose realized serving pair is
  `(s,v)`.
- `BeamActive z_{s,v}(t)`: derived after association and true exactly when
  `U_{s,v}(t) > 0`.
- `ActiveBeamSet A_s(t)`: positions whose derived `z` is true; it is a subset
  of `E_s(t)`.  Its size is a result of the accepted layout, schedule and UE
  associations; it is not edited through the thesis symbol `v_max`.
- `BeamScheduleTrace`: the eligible set, realized active set, load vector, and
  association identity at every accepted run anchor.

The scheduler never writes canonical `z` directly.  It first constrains which
positions are eligible; the association step selects a service pair for each
UE; load and `z` are then derived from those realized associations.  This keeps
the runtime invariant that an active beam cannot have zero load.

### Beam-layout and scenario controls

The Visual Lab exposes two separate scenario controls:

- `每顆衛星波束配置`: `1`／`7`／`19`; no free-form integer input.  Changing it
  rebuilds boresights, footprints, association, interference and all downstream
  results atomically.  It does not silently change the paper's `N_V`, `J_w` or
  `v_max`.
- `照射模式`: `固定照射`／`波束跳躍`.

The default interaction may apply one value to every selected satellite, but
the domain owner is satellite-local.  An expert override is keyed by stable
satellite identity, so the serving satellite may use 7 beams while the
candidate satellite uses 19, or vice versa.  Such a mixed layout is labelled a
heterogeneous project scenario.  It is not labelled the 3GPP 19-beam
single-satellite baseline merely because one participant uses 19 beams.

The standards-backed baseline label is narrower than the numeric preset: it
requires a single-satellite 19-beam case whose physical boresight spacing is
actually derived from the selected HPBW.  Retaining the HPBW spacing only as
layout metadata, while rendering or evaluating a fixed ground-cell pitch, is
not enough for that label.

- `固定照射`: retain the selected layout's declared beam identities and
  boresights across slots.
- `波束跳躍`: deterministically change the eligible subset or target identity
  across slots within the selected layout/topology contract.

Inactive positions must be visually distinct and contribute no service, RF
output, or interference.  A paper-faithful MODQN experiment may still enforce
its own fixed `v_max = 3` internally, but that constraint is not renamed as, or
used to limit, the Visual Lab layout selector.

BeamShift supplies a useful interaction donor but not a numerical authority: it
owns seven stable logical beams per emitter (centre plus six outer-ring beams)
and exposes a visual `1..7` active-set control over its own 25-cell teaching
scenario.  `leo-satcom-lab` owns only the angle-aware EE binding/parity seam and
does not define a beam-layout count, range or scheduler.

The first accepted scientific slot axis is the existing completed 30-second TLE
anchor axis.  A faster visual transition may interpolate presentation state,
but it cannot create a sub-anchor service decision, metric, or event.  A future
finer scientific axis requires its own validated run contract.

### Association and event classification

At each accepted anchor, the scenario adapter computes feasible candidates and
a deterministic baseline association among eligible beam positions.  It then
publishes the complete per-UE serving-pair vector before canonical EE is
evaluated.

For each UE, consecutive accepted serving pairs are classified as:

- identical `(s,v) -> (s,v)`: stay;
- same satellite, different beam `(s,v1) -> (s,v2)`: same-satellite beam
  switch;
- different satellite `(s1,v1) -> (s2,v2)`: cross-satellite handover;
- unserved to served: initial attach or re-attach;
- served to unserved: service loss.

A Beam Hopping slot change does not by itself guarantee a same-satellite beam
switch.  The story becomes available only when the accepted trace proves the
same UE, same satellite, different beam identities and provides aligned before,
decision, and after anchors.  A schedule change with an unchanged service pair,
or with service loss only, is not relabelled as intra handover.

### One immutable publication

One run/frame identity must own, at the same anchor:

- archived-TLE/SGP4 satellite geometry;
- eligible beam positions and realized active mask;
- per-UE service assignments and per-beam load;
- off-axis angles, channel matrices, reuse colours, and interference members;
- requested and capped actual RF power;
- SINR, throughput, system power, instantaneous EE, and ratio-of-sums
  evaluation state;
- schedule, same-satellite beam-switch, service-loss, and cross-satellite
  handover trace entries.

The scene, controls, result dock, story rail, comparison, and capture bundle
consume this same publication.  No renderer or story module may recalculate a
beam schedule or manufacture an event.

## Reuse boundary

The historical scheduler may donate deterministic ordering, bounded active-set
selection, and test patterns.  The historical handover manager may donate the
event-classification vocabulary and dwell/guard ideas only after those rules are
explicitly accepted for the TLE scientific axis.

The Visual Lab must not import the old Walker orbit source, HOBS formula family,
profile defaults, UI-only beam selection, 2.5/3.5-second timing, or historical
serving state.  New code belongs behind the `VisualLabSession` and archived-TLE
analysis-run seams.

## Evidence inspected

- 3GPP TR 38.821 V16.2.0, Table 6.1.1.1-4: 19-beam, two-tier hexagonal
  single-satellite baseline and HPBW-derived adjacent spacing.
- `thesis-mc/ch5-experimental-result.md`: `N_V=39`, `J_w=7`, `v_max=3` are
  distinct research quantities.
- `docs/ADR-003-canonical-ee-closure.md`: the 3/7-based domains are project
  mappings rather than standard-mandated beam-layout counts.
- BeamShift `docs/adr/ADR-014-cross-repo-ee-authority-routing.md` and
  `src/teaching/beamHoppingVisualSchedule.ts`: 25-cell teaching scenario,
  seven stable beams per emitter and a local visual 1..7 active-set control.
- `leo-satcom-lab/contracts/angle-aware-ee-v1/README.md`: formula binding and
  parity only; no topology or beam-count authority.
- `thesis-mc-modqn-faithful/README.md`, `ch4-method.md` and
  `ch5-experimental-result.md`: Phase-I N/A/B/C is diagnostic-only and remains
  outside deployment beam scheduling and empirical claims.

## Alternatives considered

### Hard-code seven beams per satellite

Rejected because seven is one complete-ring preset, not the only supported
layout and not a standards-defined maximum.

### Allow any positive integer beam count

Rejected because a regular hexagonal layout grows by complete rings.  The
initial UI accepts only 1, 7 and 19; a custom count requires a named topology
with complete boresight geometry rather than a number-only slider.

### Treat every schedule transition as an intra handover

Rejected because Beam Hopping changes availability, while handover is a
per-UE serving-identity transition.  Conflating them fabricates event counts and
handover cost.

### Reuse the Walker/HOBS runtime unchanged

Rejected because it would create a second geometry, formula, clock, and serving
truth under a TLE-labelled scene.

### Wait for the thesis to define a scheduler

Rejected as unnecessary for a clearly labelled simulator experiment.  The
scenario adapter can remain outside the paper method while obeying its physical
constraints and claim ceiling.

## Consequences

- ADR-005's seven-cell substrate becomes the default 7-beam layout preset rather
  than an immutable topology.
- The 1／7／19 selector changes the complete per-satellite beam layout; it is a
  scenario input, not one of the 17 canonical formula inputs and not `v_max`.
- A global 7-beam default is a bulk-edit convenience, not a cross-satellite
  equality constraint.  Stable satellite-ID overrides may select different
  complete-ring layouts for serving and candidate satellites.
- Fixed illumination remains available as a controlled comparison over the
  selected layout.
- Beam Hopping can change load, interference, requested/actual power,
  throughput, and EE only through the same canonical frame rebuild.
- A real same-satellite beam-switch story can be added without fabricating a
  source trace; it may legitimately remain unavailable for runs that contain no
  qualifying event.
- No energy-saving claim follows from adding the mode.  Savings require a
  matched comparison with an explicit service-equivalence gate and the same
  evaluation interval.

## Completion gates

1. The layout selector accepts exactly 1, 7 or 19 and produces the matching
   complete hexagonal boresight/footprint identities for every selected satellite.
2. The 19-beam topology follows TR 38.821 Table 6.1.1.1-4's two-tier shape.  A
   case receives the full standards-baseline label only after its evaluated
   physical boresight spacing follows the HPBW-derived adjacent-spacing rule.
3. `v_max` is absent from the Visual Lab layout control; paper-faithful runs keep
   that paper setting inside their own experiment contract.
4. Active iff positive load is checked before canonical EE evaluation.
5. Fixed and Beam Hopping modes produce deterministic, digest-bound schedules.
6. Inactive positions contribute zero RF output and zero interference.
7. A layout or mode change rebuilds and publishes the entire run atomically.
8. Schedule changes and service transitions have separate trace types.
9. Same-satellite beam-switch replay uses complete accepted identity and metric
   anchors or fails closed.
10. Existing archived-TLE, canonical EE, comparison, capture, and route gates
   remain green.

## Implementation checkpoint — 2026-08-16

The current Visual Lab satisfies the runtime portion of these gates:

- `beamIlluminationScenario.ts` owns the deterministic fixed／Beam-Hopping
  eligible-set policy. Association runs only over eligible identities; load and
  active state are derived afterward, so inactive or zero-load beams cannot
  contribute RF output or interference.
- `TleAnalysisRun` publishes a digest-bound, 241-anchor `BeamScheduleTrace`
  with complete per-UE serving-pair evidence. Snapshot／hydrate validation binds
  it to both analysis and geometry run identities.
- the session and Story runtime expose same-satellite replay only for an actual
  consecutive `(UE, satellite, beam)` transition with exact before／decision／after
  accepted anchors. The 3D scene follows that UE and realized beam at each beat;
  schedule-only transitions remain unavailable as handover evidence.
- each Story beat reads the per-anchor canonical instantaneous SINR, throughput,
  system power and EE. The separate timeline keeps cumulative delivered data,
  energy and EE, so an anchor-zero beat is not mislabelled as zero instantaneous
  EE merely because no evaluation interval has elapsed yet.
- layout, illumination, UE and formula edits reuse the accepted TLE geometry and
  PassPlan through the analysis-only Worker path. The previous scene/results
  remain accepted until the complete replacement run is validated and published.

Focused TLE／Worker, simulator, homepage-projection and Visual-Lab suites plus a
production build pass at this checkpoint. Live-browser verification records an
input-event dispatch at approximately 0.19 s; the complete 241-anchor analysis
then finished in the background in approximately 12–17 s and published one
atomic result change with an available source-backed same-satellite replay.
Newer edits terminate the prior analysis Worker instead of waiting behind stale
synchronous analysis work. These observations are a current-browser benchmark,
not a general performance guarantee, owner visual acceptance, or an
energy-saving claim.
