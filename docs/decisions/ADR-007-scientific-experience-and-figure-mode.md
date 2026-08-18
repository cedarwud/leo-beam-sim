# ADR-007: Make scientific explanation and figure export projections of the canonical TLE run

## Status

**Accepted for a causal teaching and figure vertical slice; presentation implementation has not started**

The design decision is accepted. The presentation-implementation gate remains
open until the SDD's source-backed fixture ledger freezes both controlled pairs
and one compatible trace-backed serving change. Before that gate closes, only
the SDD's bounded diagnostic-evidence seam and read-only fixture discovery are
authorized; no explanatory route or presentation state may be implemented.

Date: 2026-08-14

Decision identifier: `LEO-SIM-SCIENTIFIC-EXPERIENCE-1`

Implementation repository: `/home/u24/demo/leo-beam-sim`

Scientific EE authority:
`/home/u24/papers/modqn-paper-reproduction/docs/ADR-003-canonical-ee-closure.md`

## Context

The active simulator already computes the central TLE scene and the SINR,
Power, Throughput, and EE projections from one canonical run. That is a
necessary scientific condition, but it is not yet a sufficient explanatory
experience. The moving satellites and beams occupy the centre, while formulas,
controls, and results remain visually detached in side rails. A viewer can see
motion and numbers without seeing the causal path between them.

The current research motivation in `/home/u24/papers/platform/intro.md` includes
TLE-based communications, resource allocation, connection switching, and
energy optimization. That document supplies motivation only. It does not
redefine the thesis equations, establish an energy-saving policy, or authorize
a Phase-1 platform data contract.

The product therefore needs a scientific explanation layer that can:

1. connect spatial geometry to the canonical angle-aware EE calculation;
2. make a controlled input change visibly propagate through the scene,
   formulas, and results;
3. explain one real serving-satellite change as a before/decision/after event;
4. guide a novice through those changes without creating a second simulator;
5. preserve free exploration of accepted evidence; and
6. freeze deterministic, source-accounted thesis-style explanatory figures.

Identity synchronization and visual highlighting are necessary but not
sufficient. A route fails this decision if it can pass while showing only one
frozen calculation, a camera tour, or unrelated panels whose values happen to
share a frame ID.

## Authority and precedence

Use this order for the new experience:

1. `ADR-005-tle-and-canonical-ee-simulator-contract.md` for TLE selection,
   scenario, atomic frame publication, and route boundaries;
2. the external ADR-003 above for equations, units, aggregation, and zero
   behavior;
3. `ADR-006-tle-canonical-handover-trace.md` for a completed TLE-run handover
   trace when that trace is shown;
4. this ADR for explanatory and figure-presentation decisions; and
5. `docs/sdd/SCIENTIFIC-NARRATIVE-VERTICAL-SLICE-SDD.md` for the first bounded
   implementation slice.

For EE equations and aggregation, ADR-003 and the canonical `run.evaluation`
result govern. Any older wording that labels evaluation EE as a single-frame
quantity is not inherited by this experience.

`docs/frontend-render-governance.md`, ADR-001, ADR-002, and the existing
director/cinematic documents remain useful renderer-governance and donor
records. They are not scientific authorities for the active TLE run.

## Decision A: one evidence state, multiple projections

Every explanatory view shall project the same accepted `TleAnalysisRun` and
the currently selected `SimulationAnalysisFrame` at each presentation state.
When a handover decision is shown, it shall use that frame's matching immutable
handover-trace anchor. Figure Mode freezes the declared accepted state,
reference/probe pair, or handover triplet for the artifact.

The implementation shall separate two state planes:

- **evidence state**: immutable run, frame, parameters, results, provenance,
  and optional handover trace; and
- **presentation state**: camera pose, current explanatory beat, visible
  annotations, selected representative entity, playback position, and figure
  composition.

Presentation state may select or reveal evidence. It may not recompute SINR,
Power, Throughput, EE, satellite identity, or handover decisions.

A scene adapter may interpolate already-completed TLE geometry for continuous
display between 30-second anchors. Quantitative labels remain attached to an
identified canonical anchor, and display interpolation never feeds back into
the scientific frame.

The first slice shall additionally preserve an immutable **reference/probe
pair** for each controlled causal demonstration. Both members are accepted
canonical results. They share TLE publication, geometry run, anchor, source
time, constellation, satellite, beam, and representative UE identity. They
differ in exactly one declared editable canonical parameter. The UI may derive
and display unit-preserving deltas, but it may not derive new SINR, Power,
Throughput, or EE values.

Two controlled probes are mandatory:

1. **angle-response probe**: hold source geometry and off-axis angle fixed,
   change only the runtime field `SimulatorParameters.theta3dbRad`, whose
   value is the full half-power beamwidth represented by the thesis symbol
   `theta_3dB`, and show how the same angle is interpreted by
   `G^T(theta)` and the downstream closure; and
2. **service-target stress probe**: hold geometry, load, link identity, RF
   caps, and every other canonical input fixed, change only
   `SimulatorParameters.minimumRateBps` from `1_000_000` to `10_000_000` bit/s,
   and show how the declared per-user minimum transmission-rate target enters
   `gamma_req(U_b)` before propagating through requested/actual RF power,
   realized service, `P_sys`, and EE.

Exact reference/probe values and expected observed deltas must be frozen in
source-backed fixture manifests before presentation implementation begins. No
universal EE direction may be assumed; the fixture records the canonical
observed result.

`TleAnalysisRun.withParameters` preserves TLE selection, geometry run, and
pass plan, but it rebuilds the parameter-dependent handover trace, selected
serving sequence, frames, and run evaluation. Therefore pair identity is a
fixture assertion, not an architectural assumption. The comparison anchor
must retain the same serving satellite, beam, and UE. Run-level evaluation EE
may be compared as a matched-pair result only when the complete
serving/candidate identity sequence also matches.

The angle-response control is the simulator's full-HPBW field
`SimulatorParameters.theta3dbRad`; the existing scenario adapter supplies
one-half of it to the canonical Bessel pattern. The service-target reference
uses ADR-003's primary `R_min = 1 Mbit/s`; its probe is explicitly named and
labelled as the separately allowed `R_min = 10 Mbit/s` stress diagnostic. No
other stress value may be published under this fixture ID. Both pair members
must remain below the beam and satellite RF caps so the declared one-parameter
path is:

```text
R_min -> gamma_req -> p_req -> actual RF -> realized service -> P_sys -> EE_inst
```

The accepted results determine every downstream direction.
Non-binding is a full-vector fixture gate, not a representative-link label:
every beam demand remains below its cap by the recorded tolerance, aggregate
pre-satellite RF grouped by canonical satellite owner remains below the
satellite cap, every per-beam satellite scale equals one, and every UE
power-limited flag is false.

`beamPowerCapW` remains part of Explore and of the complete method chain, but
it is not a first-slice one-edge controlled probe. ADR-003 derives the PA
saturation reference `P_0` from the operating beam cap, so changing that field
simultaneously changes an RF constraint and the PA-efficiency reference. A
presentation may explain both canonical branches; it may not label the field
as a pure clipping intervention or alter the frozen scientific formula to make
the story simpler.

## Decision B: Explore, Guided, and Figure are three drivers of one product

The experience shall provide three modes without creating three data models:

- **Explore** lets the user scrub accepted source time, inspect entities, and
  change authorized canonical inputs through the existing rebuild contract.
- **Guided** advances a deterministic explanatory script. It controls source
  time, camera, focus, and overlays and switches only between the frozen,
  already accepted members of each controlled pair. Pair production must have
  used and recorded the same canonical rebuild and atomic-publication path as
  Explore; reveal itself does not launch another rebuild.
- **Figure** freezes one accepted evidence state, one accepted reference/probe
  pair, or one accepted handover triplet and one presentation state.
  It removes transient interaction, renders all required meaning without
  hover or animation, and exports provenance beside the visual artifact.

The Guided mode is therefore a second writer to presentation state, not a
second scientific calculator and not a prerecorded substitute for the
simulator.

Every Guided beat shall contain an authored novice-facing question,
prediction, action, expected observation, causal explanation, misconception
guard, recovery path, and completion check. Camera motion without an observable
canonical transition does not satisfy a causal beat.

## Decision C: use a linked scale grammar

The explanation shall move among four explicit spatial or analytical scales:

1. **orbital context**: constellation, Earth, NTPU observer, and accepted TLE
   instant;
2. **service area**: selected and candidate satellites, seven active cells,
   100 fixed UEs, and active beam ownership;
3. **link geometry**: one representative satellite-beam-UE path, boresight,
   off-axis angle, and antenna gain; and
4. **causal accounting**: requested and actual RF power, intra-satellite and
   inter-satellite interference, noise, realized SINR, throughput,
   consumed-power ledger, and EE.

Camera cuts, match cuts, and cross-sections may connect these scales. A globe
is an orbital-context view, not proof of a local beam footprint or an EE
result. Quantitative comparison shall use orthographic/cross-section or 2D
views rather than perspective depth alone.

The orbital and local views are different declared coordinate frames. Orbital
context uses the TLE-derived NTPU topocentric azimuth, elevation, and range.
The current canonical seven-cell link plane uses its `distanceKm` and
`elevationDeg` fields while omitting azimuth; it derives `thetaRad` separately.
A transition may preserve source time, satellite identity,
and accepted frame identity, but it shall be visibly labelled as a
recentered/reoriented explanatory projection. It may not imply continuous
geographic direction, distance, or a calibrated footprint across the cut.

The orbital/service composition keeps three roles distinct:

- the **service** satellite owns the active canonical beams and current
  serving-link results;
- the **candidate** satellite is a source-backed comparison and may show a
  separately styled comparison fan, but it is not an active beam owner or
  interference source unless the accepted frame explicitly says so; and
- other admitted TLE satellites remain **context** objects. They carry no beam,
  service, interference, power, or EE claim without canonical ownership.

Every visible beam must resolve to a named owner, beam identity, evidence role,
and source frame. The scene therefore preserves a real multi-satellite TLE
context and a multi-beam service view without claiming simultaneous
multi-satellite active-beam assignment that the current scenario does not own.
The current canonical scene has one active satellite owner; candidate and
context satellites do not increase that ownership count.

At least three scene-linked encodings shall carry quantitative meaning rather
than decorative emphasis:

- the main rays retain the accepted geometric `theta`; when that angle is too
  small to read, a separate screen-space inset may magnify it by a frozen,
  visibly disclosed factor without changing world geometry or canonical data;
- a screen-space gain meter anchored to the selected link shows the exact
  `G^T(theta)/G_0` value on a frozen, visibly disclosed non-zero display
  interval while retaining the raw `[0,1]` meaning and a `G_0` reference; and
- screen-space actual-power/cap and throughput meters show watts, cap fraction,
  and bit/s on scales held fixed across the reference/probe pair.

Each encoding requires an exact label, unit, scale, transform record, and
redundant non-color cue. It may not change a physical beam footprint, satellite
size, or world distance to encode a non-geometric quantity. EE is shown as the
linked throughput-over-system-power ratio with both terms visible rather than
as an unexplained glow.

Reference/probe fixtures must pass a declared formatter and pixel-separation
floor for the terms that carry their argument. A magnified inset or non-zero
display interval is a disclosed presentation transform only: raw values remain
visible and remain the sole inputs to formulas, exported data, and scientific
claims. Sub-formatting differences may not be rescued by an undisclosed zoom.

## Decision D: bind scene, formula, and parameter by identity

The highest-value interaction is a three-way link:

```text
scene entity <-> canonical formula term <-> editable or derived value
```

Selecting any one of the three shall highlight the other two when a real
mapping exists. The link must include run, frame, satellite, beam, UE, and term
identity as applicable. A highlight is presentation-only; values continue to
come from the canonical frame.

Highlighting alone does not satisfy the interaction. For every required causal
edge, the Guided and Figure views must visibly show the source term, operation
or constraint, target term, units, reference value, probe value, and signed
delta. If a downstream term is invariant because power control compensates for
the upstream change, the unchanged value is itself an explicit observation.

The primary explanatory dependency graph is:

```text
h = G^T(theta) * G^R * G^LS * g
h^div = max(h, epsilon_h)
gamma_req(U_b) = f(R_min, U_b, B_beam)
p_req,u = f(gamma_req, lagged I, noise, h^div)
P_req,beam = max of served-user p_req,u
P_beam^DL = beam-capped RF output before the satellite cap
tilde P_beam^DL = satellite-capped actual RF output
tilde P_beam^DL * raw h -> signal and current I_intra/I_inter
signal + current I_intra + current I_inter + noise -> SINR -> R_u -> throughput
P_0 = P_beam,max * 10^(BO/10)
tilde P_beam^DL and P_0 -> eta_PA -> P_PA
P_PA + RFC + BB + event power -> P_sys
sum_u R_u(t) / P_sys(t) -> instantaneous system EE
(run accumulated delivered bits) / (run consumed energy)
  -> evaluation EE ratio-of-sums
```

The experience must show requested versus actual power distinctly. It must not
imply that a target `gamma_req` is the realized SINR, that a candidate is an
active interferer, or that a lower displayed power alone proves energy saving.
`h^div = max(h, epsilon_h)` is a numerical division guard used only for
requested power; signal, interference, and rate continue to use raw `h`.
Because `P_beam,max` is both an RF constraint and an input to the canonical
`P_0` derivation, its two outgoing edges remain explicit whenever that field
is inspected. The bounded candidate-link projection is a single-link
comparison, not a coupled system counterfactual; it cannot supply aggregate EE,
active interference, or a claim about what the full system would produce after
a switch. It keeps the selected representative UE and beam identity; if that
same-link candidate result is unavailable, the comparison is unavailable
rather than silently selecting another UE.

## Decision E: Figure Mode is a scientific artifact contract

Interactive and static outputs are separate deliverables. Figure Mode shall:

- freeze a complete accepted run/frame, reference/probe pair, or handover
  triplet and the named explanatory beat;
- use fixed camera, dimensions, device scale, theme, labels, and animation
  state;
- include units, normalization, exclusions, cap/missing/unavailable states,
  and the distinction between instantaneous and evaluation EE;
- encode roles redundantly so meaning does not depend on color alone;
- provide a caption, alt text or long description, and the underlying plotted
  values;
- export a manifest carrying source and rendering provenance; and
- fail closed when evidence is incomplete, stale, or source-incompatible.

The first slice shall export a composed raster for the WebGL scene, a separate
vector overlay where applicable, and machine-readable manifest/data files. It
shall not claim that a rasterized 3D scene is fully vector artwork. A
publisher-specific profile remains deferred until an exact venue and phase are
known.

Stable input, transformation, data, render-specification, and output-artifact
hashes are required.
Cross-GPU browser rasters are compared with an explicit visual tolerance, not
claimed to be byte-identical.

The first slice produces three separate figure arguments rather than one dense
all-purpose plate:

1. **method-chain plate**: one accepted state, the angle-aware calculation
   chain, equation/source locators, and a numbered reading order;
2. **controlled-comparison plate**: the same geometry and link identity under
   one reference/probe parameter change, with aligned panels and signed deltas;
   and
3. **serving-change-event plate**: one real ADR-006 serving change shown at
   before/decision/after anchors with serving/candidate roles, decision
   mechanism, and downstream results.

Each figure specification must freeze a reader question, one-sentence claim,
panel order, caption, equation/source references, claim boundary, and expected
takeaway before visual implementation.

## Decision F: isolate the first slice

The first implementation shall be a direct-only `/explain` route. It shall not
replace the homepage, alter `/simulator`, or add a navigation button before
human visual acceptance.

The vertical slice shall explain one representative, source-backed link from
orbital context through off-axis geometry to SINR, Throughput, Power, and EE;
execute both controlled probes; and replay one pinned real ADR-006 serving
change. The globe is reused as a cutaway, not made the permanent background of
every beat.

The trace-backed serving-change story is not optional. Before implementation,
the fixture ledger
must pin one accepted trace event and identify whether it is an
offset-and-TTT decision or a forced-continuity change. The UI may not substitute
a same-instant candidate comparison. If no compatible event exists, the slice
is blocked rather than silently shortened.

The current event anchor retains the committed post-change comparison but not
all pre-commit trigger evidence. The slice therefore also requires a
read-only, immutable event-evidence extension carrying a stable event ID,
trigger anchor/time, pre-commit serving/candidate values, qualifying anchors
for offset-and-TTT, forced-continuity visibility evidence, and the post-commit
identity. This extension may not change ADR-006's decision policy or result.
The pre-commit record must be captured before serving-state mutation and may
not be reconstructed from the committed comparison. Fixture discovery prefers
an offset-and-TTT event. A forced-continuity event remains admissible only as
the separately named continuity mechanism already defined by ADR-006; it never
inherits offset or TTT language.

The resulting figures are deterministic method and mechanism artifacts. They
are not calibrated empirical evidence and do not establish a thesis Chapter 5
result.

## Decision G: preserve the energy-saving claim boundary

This ADR authorizes explanation of current canonical calculations and
controlled model-parameter effects. It does not authorize an energy-saving
claim.

A later energy-policy baseline/candidate comparison may become another
projection of the
same visual grammar only after a separate decision fixes:

- the causal control or policy;
- service and handover constraints;
- baseline/candidate comparison identity;
- the energy boundary and evaluation interval; and
- the Phase-1 platform field, upload, and query-back contract.

Until then, the UI may describe energy consumption and energy efficiency, but
not savings, reduction, optimization success, or platform-validated impact.
The reference/probe pairs above are mechanism demonstrations, not competing
energy policies and not savings evidence.

## Rejected alternatives

### Add more explanatory copy to the existing side rails

Rejected as the primary solution. It can clarify fields but does not create a
spatial causal link among geometry, equations, and results.

### Build a prerecorded video first

Rejected. It would separate the story from the accepted run and make
parameter-sensitive or source-accounted explanation difficult to verify.

### Put every chart and formula inside the Three.js scene

Rejected. WebGL is appropriate for spatial geometry. DOM/SVG is more legible,
accessible, and exportable for formulas, axes, ledgers, and exact labels.

### Rebuild the homepage around a new design system

Rejected for the first slice. The explanatory architecture must be proven in
an isolated route before any homepage integration decision.

### Introduce a motion, video, or figure framework immediately

Rejected for the first slice. Existing React, Three.js, R3F, camera,
timeline, and browser-capture infrastructure are sufficient to test the core
state and explanation model. A dependency requires a demonstrated gap.

### Treat `beamPowerCapW` as a pure clipping experiment

Rejected for the first controlled pair. Under ADR-003 the same operating cap
also derives the PA saturation reference, so changing it has two canonical
outgoing paths. Hiding one path would teach the wrong mechanism; splitting the
scientific parameter only for presentation would violate formula authority.

## Consequences

- Scientific correctness and narrative direction become independently
  testable.
- Existing scene, timeline, camera, and globe components can be reused through
  adapters without making them truth owners.
- A parameter edit has a visible pending/rebuild boundary instead of producing
  an animated but scientifically stale response.
- A controlled comparison retains both accepted states, so the cause and
  observed downstream differences remain inspectable after the rebuild.
- The first thesis-style output is three bounded explanatory arguments, not a
  general figure-authoring application.
- A real trace-backed serving-change fixture and a fresh-viewer comprehension
  gate become release
  prerequisites rather than optional polish.
- Energy-saving and Phase-1 platform integration remain visible future seams
  rather than implicit claims.

## Acceptance conditions for presentation implementation start

Before these conditions are met, only the SDD's narrow S0.5 diagnostic-evidence
seams and read-only S1 fixture discovery are authorized by this design. Route,
scene, teaching UI, and Figure Mode implementation may begin when the SDD:

1. names every evidence owner and new presentation seam;
2. freezes exact source-backed reference/probe fixtures for the angle-response
   and service-target stress demonstrations;
3. freezes one real ADR-006 serving-change fixture;
4. authors the novice-facing narration and completion check for every beat;
5. defines quantitative scene-linked scales, raw/display transform
   disclosures, coordinate-frame disclosure, scene-role ownership, and three
   figure arguments;
6. defines failure, unavailable, recovery, and reset states;
7. reuses the current canonical run-building and result pipeline without
   duplicating calculations;
8. exposes canonical-owned `h^div`, same-UE candidate-link identity/role, and
   pre/post serving-change evidence without changing formula or decision
   semantics;
9. defines fresh interactive-viewer and static-figure acceptance tests; and
10. has no overlap with current dirty WIP ownership.

Implementation is complete only when a fresh interactive viewer can, without
source-code knowledge, predict both probes before reveal, explain the observed
`theta/G^T/h/power/SINR/rate/P_sys/EE` paths afterward, and distinguish the
trace-backed serving-change event from a same-instant candidate comparison.
An independent static reader must also recover each figure's reader question,
claim, and boundary at final print size. Machine checks, static-reader checks,
interactive-viewer checks, and owner visual acceptance are separate gates.
