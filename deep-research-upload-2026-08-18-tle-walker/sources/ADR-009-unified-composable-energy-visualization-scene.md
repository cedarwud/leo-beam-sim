# ADR-009: Unify the clean explanation and complete simulator as one composable scene

## Status

**Accepted by owner for implementation; machine-verified product checkpoint recorded 2026-08-16**

Date: 2026-08-15

Decision identifier: `LEO-SIM-UNIFIED-SCENE-1`

Implementation repository: `/home/u24/demo/leo-beam-sim`

## Context

The project currently exposes or documents several surfaces: the established
homepage scene, the formal `/simulator` workspace, and a clean `/explain`
experience. Those surfaces grew for different implementation checkpoints, but
they do not represent three different products or three different scientific
worlds.

The intended product is one multi-beam LEO energy-visualization environment.
Its clean teaching view is the complete scene with nonessential layers hidden,
dimmed, frozen, or reframed. Restoring NTPU context, cells and UEs, satellite
GLBs, TLE-derived trajectories, context satellites, serving and candidate
beams, interference, handover evidence, and quantitative overlays must recover
the complete scene without changing scientific ownership or switching to a
parallel renderer.

The present interface also separates controls, numbers, and scene motion too
strongly. A parameter can change in a rail while the user cannot see what
changed in geometry, link quality, handover qualification, delivered data, or
energy consumption. Dense permanent panels and very small text make the
scientific controls available to the implementation but not understandable to
the intended user.

The Phase-1 platform is not the centre of this experience. It is a destination
for storing an accepted result bundle. The primary product problem is to make
energy use and the causal consequences of parameter changes visible.

## Decision

### A. One scientific runtime and one scene world

The product shall have one accepted scientific state at a time:

- one archived-TLE selection and complete SGP4 run;
- one selected canonical frame and optional accepted handover trace;
- one canonical SINR, Power, Throughput, and angle-aware EE calculation graph;
- one presentation state that chooses camera, focus, visible layers, motion,
  annotations, and disclosure depth.

Clean, guided, exploratory, complete, and figure-ready views are presentation
presets over that same state. They are not separate calculators, scene worlds,
or scientific data models. Temporary compatibility routes may remain during
migration, but a route must not own a different scientific truth or renderer.

### B. The clean view is a reversible reduction of the complete scene

The scene shall be assembled from explicit, independently visible layers:

1. orbital context and Earth;
2. archived-TLE source, epoch, and propagated trajectory;
3. NTPU observer and local reference frame;
4. local terrain or substrate, cells, and UE population;
5. selected, candidate, and context satellite GLBs;
6. serving, candidate-comparison, and source-backed interference beams;
7. angle and link-geometry annotations;
8. handover eligibility, offset, TTT, decision, and ownership transfer;
9. SINR, Power, Throughput, and EE visual explanations;
10. teaching annotations and figure overlays.

A preset may hide, dim, isolate, freeze, or emphasize a layer. It may not
invent a satellite, beam, trajectory, handover, formula value, or energy
result. Re-enabling the layers must recover the complete composition from the
same runtime state.

### C. Every editable parameter needs a visible causal contract

Every exposed control shall declare:

```text
canonical input
  -> affected scientific state
  -> visible scene or explanatory response
  -> handover consequence, when one exists
  -> Power / SINR / Throughput / EE consequence
```

The scene response must match the parameter's scientific role. Geometry inputs
may move geometry or angle annotations. Antenna-pattern inputs may reshape the
gain explanation and the source-backed beam representation. Interference and
reuse inputs may change declared interference membership and its visual links.
Power inputs may change the RF-cap and consumption ledger. Service targets may
change qualification, requested power, delivered rate, and handover evidence.
No control may trigger unrelated decorative motion merely to appear reactive.

Presentation-only controls such as camera, focus, visibility, playback speed,
and annotation depth remain explicitly separate from scientific controls.

### D. Complete controls without an engineering field wall

All genuinely editable canonical inputs used by the formal model shall remain
discoverable. Derived results shall not be rendered as disabled sliders.

The primary interaction shall use progressive disclosure:

- a small set of high-impact controls for the current scientific question;
- the persistent domains `SINR`, `Power`, `Throughput`, and `EE` as understandable
  entry points;
- an `all parameters` surface that exposes the complete authoritative set,
  grouped by causal role and searchable;
- one canonical control instance for a shared parameter, with cross-links from
  every relevant domain rather than duplicated mutable fields;
- Chinese names, thesis symbols, units, source, valid range, reset value, and
  a concise statement of the observable effect.

Selecting or adjusting a control shall focus the related scene object and open
its causal path. Result summaries remain available independent of which input
domain is open.

### E. Make energy visible as a process, not a colour or one EE number

The experience shall make at least these quantities visually distinguishable:

- delivered data over time;
- actual RF transmission power;
- PA, RFC, BB, and declared event-power contributions within the canonical
  energy boundary;
- cumulative consumed energy;
- instantaneous EE and accumulated evaluation EE;
- handover events and their temporal relationship to service continuity,
  power demand, delivered data, and cumulative energy.

Brightness alone is not a quantitative encoding. The preferred grammar uses a
throughput flow plus a segmented power/energy ledger on the same time axis,
with handover markers linking the scene to both. A baseline/candidate saving
claim requires a separately accepted causal policy, matched comparison, service
constraints, and energy boundary. Until then the product may explain energy
use and EE but must not claim that an unregistered policy saved energy.

### F. TLE is an observable transformation, not only a date picker

The selected archive publication, TLE epoch, SGP4 propagation, observer frame,
trajectory, elevation opportunity, and admitted service/candidate roles shall
be connected through progressive visual explanation. The first visible frame
may be precomputed and cached, but every displayed trajectory and quantitative
anchor must remain traceable to the accepted TLE-derived run.

### G. The Phase-1 platform is a secondary export adapter

The central experience does not need a Phase-1 dashboard, feedback loop, or
special platform navigation. Once a result bundle and upload schema are
registered, an accepted run may expose a secondary `upload result` action.
Storage success does not constitute an energy-saving claim and does not alter
the local scientific state.

### H. Readability is a scientific acceptance condition

The complete control set must not be achieved through tiny text or permanently
narrow rails. The main scene remains the dominant surface; controls and
details use contextual drawers, trays, or sheets that can be opened without
creating a second product.

Machine reachability is insufficient. Desktop, tablet, mobile, guided, full,
and figure-ready compositions require visible browser review. Text, units,
formula symbols, focus states, targets, contrast, and scene occlusion must pass
explicit acceptance thresholds in the product SDD.

### I. Expose one deep session interface, not a public layer framework

All active routes and React surfaces shall consume one route-facing module:

```ts
interface VisualLabSession {
  snapshot(): LabSnapshot;
  subscribe(listener: (snapshot: LabSnapshot) => void): () => void;
  dispatch(command: LabCommand): Promise<DispatchResult>;
}
```

The session hides cache validation, request cancellation, complete TLE-run
construction, canonical parameter application, handover trace, frame selection,
scene projection, energy story, comparison, capture, and atomic publication.
It publishes one immutable read model so callers cannot combine scene state,
formula values, results, handover, or energy from different identities.

Visual decomposition remains modular inside the implementation. A pure private
`ScenePlanCompiler` converts accepted evidence plus presentation intent into a
finite typed `ScenePlan`; one exhaustive `ScenePlanRenderer` renders that plan
inside the single R3F Canvas. NTPU, orbit, satellite, cell, UE, beam,
interference, handover, energy, and annotation code may live in separate files,
but they are not public capabilities, do not own stores, and cannot fetch or
recalculate scientific data.

Local export and a future Phase-1 upload are two real artifact-writer adapters.
No renderer port, dynamic plug-in framework, or public interface per visual
layer is introduced for hypothetical replacement.

### J. Treat bounded representative-UE movement as a scenario experiment

The complete formula control surface contains 17 canonical model inputs, but
scene interaction also needs one separately classified geometry experiment.
The user may move one declared representative UE within its already assigned
cell through the canonical `userPositionOverridesKm` scenario seam.

This interaction is not presentation-only. Dragging creates a draft ghost;
Apply rebuilds the same seven-cell scenario and canonical run before atomically
publishing new angle/channel, SINR, Power, Throughput, EE, and compatible
handover evidence. The other UEs, seven-cell topology, load vector, assignment,
beam ownership, TLE trajectory, and satellite identities remain fixed unless a
separate accepted source/scenario change says otherwise.

Camera movement, playback pause/speed, focus selection, and showing fewer
context objects remain presentation controls. Changing active beam/UE counts,
ownership, beam targets, or arbitrary UE mobility is not authorized by this
bounded probe.

### K. Resolve stale ADR-005 control and pending-state wording

The active editable formula set is the exact 17-key inventory in the product
SDD and current simulator ownership registry. ADR-005's earlier generic phrase
`channel scale` does not authorize `channelGainScale`: ADR-005's later
implementation record and the current formal adapter classify
`channelGainScale`, `scintillationScaleDb`, and `shadowFadingMarginDb` as
serialized compatibility fields with no canonical control or effect.

During any source or parameter rebuild, the previous accepted evidence remains
visible as accepted and the new draft is visibly pending; transport is locked
where moving beyond complete evidence would be unsafe. No new draft value may
be displayed as though it produced the old results. Success atomically replaces
the complete accepted snapshot. Failure returns to the unchanged accepted
state with a structured refusal. This supersedes ADR-005's 2026-08-12
implementation-record wording that Apply clears the centre/results and leaves
them empty after failure; that wording describes current residue to migrate,
not the target product contract.

## Authority and supersession boundary

This ADR changes product composition, route semantics, the bounded UE probe,
and stale control/pending-state implementation wording. It does not change the
canonical equations, units, power boundary, TLE resolution, or handover rule.

It preserves:

- ADR-005 for archived-TLE resolution, SGP4 propagation, atomic publication,
  canonical EE algebra, editable-versus-derived scientific ownership, and
  formula parity;
- ADR-006 for accepted handover-trace semantics;
- ADR-007 for evidence/presentation separation and figure provenance; and
- ADR-008 for presentation-layer purity and the ban on a second renderer.

The sole scenario extension in this ADR is Decision J's bounded representative-
UE position probe. It preserves ADR-005's 100-UE count, seven-cell topology,
load/assignment, active-beam vector and satellite ownership; it does not
authorize arbitrary mobility or a second scenario.

It supersedes earlier wording that treats the homepage, `/simulator`, and
`/explain` as permanently separate product experiences, or that forbids the
clean experience from progressively recovering the complete scene and full
canonical control surface. Historical routes may remain as migration aliases
until an implementation decision removes them.

## Alternatives considered

Three independent fresh-context designs were compared by interface depth,
locality, and seam placement: a minimal three-entry-point facade, a
common-flow session with explicit internal collaborators, and a typed scene-plan
compiler. The accepted hybrid uses the facade publicly and the compiler plus
collaborators privately.

### Expose run, schema, projection, composition, focus, and energy as public modules

Rejected. Although each responsibility is real, exposing all of them allows
callers to combine different frame identities and makes one route learn the
ordering and failure modes of the whole product. They remain private
collaborators behind `VisualLabSession`.

### Use a capability or scene-layer plug-in framework

Rejected. Capability presence would become another state model and every new
visual would add an interface. A finite typed node union and exhaustive renderer
make extensions explicit without creating a public plug-in system.

### Keep a clean teaching page beside the complete simulator

Rejected. The two pages would drift in rendering, controls, and scientific
identity, and the transition between them would remain visually discontinuous.

### Put all controls back into permanent left and right rails

Rejected. It preserves completeness but reproduces the dense engineering UI,
shrinks the scene, and does not establish causal linkage.

### Keep only a few curated controls

Rejected. It produces a clearer demo but cannot serve as the complete
experimental surface. Progressive disclosure must improve access, not remove
valid canonical inputs.

### Encode energy only through beam brightness or colour

Rejected. One visual channel cannot distinguish RF power, total system power,
delivered data, cumulative energy, and EE, and it is unsuitable for precise
teaching or publication figures.

## Consequences

- A product-level SDD must replace the current `/explain`-only scope and define
  the complete layer stack, parameter inventory, causal mappings, interaction
  transactions, visual grammar, responsive behavior, and acceptance gates.
- The existing vertical-slice SDD remains a bounded evidence fixture and test
  source, not the product information architecture.
- Existing scientific producers and useful scene primitives should be reused;
  route-local shells, duplicated renderers, legacy calculations, and stale
  presentation residue are not inherited automatically.
- Implementation shall proceed additively from a clean composition while
  proving that the same scene can recover the complete NTPU/TLE/multi-satellite/
  multi-beam state.
- No product implementation begins until the owner accepts the product-level
  SDD and its requirement-traceability matrix.
