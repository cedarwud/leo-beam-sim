# ADR-014: Treat a satellite-beam pair as the handover candidate

## Status

Accepted for staged S0–S2 implementation by owner direction. The independent
Claude Opus 4.6 Thinking review on 2026-08-27 returned
`S0_S2_IMPLEMENTATION_GATE: PASS`. Public activation of forecast-EE selection
remains blocked by the calibration and parity evidence defined below.

## Date

2026-08-27

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

If the current Walker implementation's `cellId` is used as a beam surrogate,
the adapter must state that provenance explicitly. It must not silently call a
logical cell a measured physical beam.

### 2. Decision pipeline

The runtime must preserve the candidate set through a shared state machine:

```text
monitoring -> evaluating -> qualifying -> selection-hold -> switching -> guard
```

Each eligible satellite-beam pair keeps its own qualification/TTT progress.
Changing the provisional leader must not erase another candidate's timer while
that candidate continues to meet the qualification conditions. Only one
target may be committed, and only one data-serving link may be shown as active.

Normal-operation selection uses forecast energy efficiency as the primary
objective after geometry and service-quality gates. SINR remains a measured
quality constraint; it is no longer the normal-operation ranking objective.
A separately labelled service-continuity fallback may select by safety/QoS
when the current link is failing. The fallback must never be presented as an
EE-optimal decision.

### 3. Bounded EE-policy authorization

ADR-005 deliberately left energy-saving handover policies unresolved. This ADR
is the separate bounded decision that ADR-005 requires, and supersedes only
ADR-005 lines 182–195 for the Walker homepage work described here:

- **causal control:** replace the primary UE's assignment from its current
  satellite-beam pair with one candidate pair;
- **comparison identity:** keep the current assignment over the identical
  forecast window;
- **energy boundary:** canonical Walker system power and delivered bits for the
  complete affected assignment/power state, using ADR-005's one state graph;
- **service constraints:** geometry, scheduling/illumination, SINR, throughput,
  remaining service time, guard, and dwell gates; and
- **claim boundary:** counterfactual forecast EE in a simulation, never measured
  savings, operational optimization, or platform energy.

This authorizes construction and validation of the forecast-EE policy. It does
not authorize enabling that policy by default until the forecast horizon,
minimum EE advantage, contact-prediction cadence, and safety order have frozen
values with provenance, and TypeScript/Python canonical parity passes. Until
then `SinrOffsetPolicy` remains the active compatibility policy and the UI must
not show candidate EE values or savings claims.

### 4. Scientific and presentation separation

Three interfaces own different concerns:

1. `CandidateOpportunityProducer` produces scientific candidate facts.
2. `HandoverDecisionEngine` applies qualification, independent timers,
   ranking, selection hold, commit, and guard state.
3. `CandidatePresentationPlan` applies display budgets, stable identity
   colours, visual roles, labels, and overflow disclosure.

Scientific candidate records do not contain colours, opacity, row order, or
other presentation-only values. Display limits must not alter which candidates
the decision engine evaluates.

### 5. Colour semantics

Colour identifies a satellite for the duration of a handover episode. Beams on
the same satellite use controlled lightness variants of the same hue. A target
keeps its identity colour after it becomes the serving link.

Role is encoded redundantly through line style, fill, opacity, outline, motion,
and text—not by replacing the identity colour:

- serving: solid link, solid footprint edge, restrained translucent fill;
- measured: thin/dotted outline, no active data-link implication;
- qualifying: dashed outline plus a TTT progress cue;
- selected: double outline and explicit “selected target” label;
- committed: new solid link appears only when the old solid link ends.

The satellite GLB keeps its realistic material. Identity colour is applied to
its label/ring, beam family, footprints, and corresponding right-rail group.

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

- `comparisonSatId` and `pendingTargetSatId` become compatibility projections,
  not the source of candidate truth.
- The upper Walker right-rail comparison area must be structurally replaced;
  the lower formula/metric accordions may remain and become contextual.
- The 3D scene must render a bounded presentation of multiple candidate beams.
- Forecast EE requires a counterfactual calculation over an equal horizon; the
  current serving link's instantaneous EE cannot be copied onto candidates.
- Candidate computation and display need separate cadence and capacity limits.
- Existing role-colour tests and screenshots for the homepage must be replaced
  with identity-persistence and one-active-link tests.

## Detailed design

See
[`HOMEPAGE-MULTI-CANDIDATE-MULTIBEAM-EE-HANDOVER-SDD.md`](../sdd/HOMEPAGE-MULTI-CANDIDATE-MULTIBEAM-EE-HANDOVER-SDD.md).
