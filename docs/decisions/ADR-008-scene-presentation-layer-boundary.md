# ADR-008: Make the homepage scene presentation-layer modular without adding a second renderer

## Status

Accepted for implementation

Date: 2026-08-14

Decision identifier: `LEO-SIM-PRESENTATION-LAYERS-1`

Implementation repository: `/home/u24/demo/leo-beam-sim`

## Context

The homepage scene now has several visible responsibilities: the orbital
context, the local service-area grid, user equipment, selected and candidate
satellites, beam volumes, link overlays, and explanatory annotations. These
objects need to support a gradual move from a clean scientific view to the
complete multi-satellite/multi-beam composition. Rebuilding the scene for each
view would make later figure and teaching work slow and would risk changing
the established renderer while adding presentation features.

The active simulator already has a route and renderer that are the product
authority. Its evidence state contains the archived-TLE run, the selected
canonical frame, and any accepted handover trace. Its presentation state
contains camera, emphasis, visibility, and explanatory composition. The two
planes must remain separate: changing what is visible must never create a new
scientific result or silently change satellite, beam, handover, or energy
ownership.

This decision covers a safe presentation seam only. It does not reopen the
scientific or product decisions in ADR-005, ADR-006, or ADR-007.

## Decision

### A. Keep one homepage renderer

`MainScene` remains the sole homepage scene renderer and remains responsible
for mounting the established homepage scene lanes. The modular presentation
layer is a pure visibility/composition contract consumed by those existing
mounts; it is not a second scene tree and not a second calculator.

The default presentation is the complete existing composition. With the
default contract, the established orbital context, local grid, UE population,
selected/candidate/context satellites, beam rendering, and accepted overlays
remain mounted with their current evidence source and visual behavior.

### B. Use a pure stage contract

The presentation module shall expose a small, stable contract with:

- named presentation layer identifiers;
- a finite set of authored stage plans or presets;
- visibility and emphasis decisions for each existing layer; and
- a default `full` plan that preserves the current homepage composition.

Stage plans may only suppress, reveal, or emphasize mounts that the current
lane already authorizes. They may not create a satellite, beam, UE, handover
event, formula value, power value, throughput value, EE value, or TLE sample.
The module must remain pure and must not import scientific producers,
canonical EE evaluators, TLE adapters, handover state machines, or the scene
renderer itself.

The first implementation may include a clean/context progression such as a
clean canvas, orbital context, service area, selected link, candidate
comparison, and full composition. Names are implementation details, but every
stage must state which existing presentation layers it reveals and why. A
stage is a view composition, not a new simulation mode.

### C. Preserve evidence identity

All visible quantitative labels and highlights continue to read from the same
accepted run/frame already supplied to the homepage. A stage change may
reveal a previously hidden result or focus an existing entity, but it must not
recompute or replace the evidence state. TLE source selection, SGP4 geometry,
canonical SINR/Power/Throughput/EE, seven-cell ownership, 100-UE load,
interference, and handover decisions remain owned by their existing runtime
paths.

The candidate and context roles remain unchanged: only the accepted service
owner may own the active canonical beams; a candidate comparison fan is
display-only where the current frame authorizes it; context satellites own no
beams. A presentation plan cannot turn a context object into an active
interferer or a candidate into a handover event.

### D. Keep controls presentation-only

If a stage selector, presenter toolbar, or query-string driver is added, it is
strictly a presentation control. It may select an existing stage plan and
camera/emphasis state. It must not expose a second parameter editor, alter
canonical inputs, bypass atomic publication, unlock an incomplete TLE run, or
change the scientific route. A query or toolbar is optional and must not be
required for the default homepage to work.

## Explicitly discarded alternatives

### A second parallel renderer

Rejected. A parallel renderer would duplicate ownership of the central scene,
camera, and visible satellite/beam objects. It would make it possible for the
scene and the side projections to show different frame identities, and it
would encourage presentation code to grow a second scientific path. The
existing `MainScene` is the only homepage renderer.

### Replacing the established scene with a clean-canvas implementation

Rejected. A clean view is one optional stage in the existing renderer, not a
replacement for the established campus/grid/satellite/beam composition. The
full stage must remain the compatibility baseline.

### Making stage plans own scientific data

Rejected. Visibility presets must not contain TLE records, derived geometry,
formula inputs, calculated metrics, handover decisions, or synthetic fallback
data. Doing so would duplicate or conceal the canonical evidence graph.

### Treating visual beam count or target changes as presentation toggles

Rejected for this slice. Changing active beam ownership, target assignment,
interference membership, or UE load is a scientific/runtime change. Those
controls require a separate decision and a source-backed frame contract.

## Consequences

- Later guided and figure views can be added as small presentation plans while
  reusing the same homepage renderer and evidence state.
- The complete composition remains the visual regression baseline, so the first
  modularization can be checked against current screenshots and route behavior.
- Pure stage resolution is easy to unit-test without a browser or a TLE archive.
- The codebase can remove only residue proven to be retired and unreachable;
  historical donor code or dirty work with unresolved ownership remains
  untouched.
- Camera transitions, annotations, and screen-space explanatory meters may be
  layered on later, but they must remain presentation projections of accepted
  evidence.

## Acceptance boundary for the first implementation

The first implementation is complete only when all of the following are true:

1. the pure stage module has no imports from scientific producers or canonical
   evaluators;
2. `MainScene` still mounts the established homepage scene lanes and is the
   only homepage renderer;
3. the default full stage is behaviorally equivalent to the current complete
   composition;
4. non-default stages only alter presentation visibility/emphasis;
5. the stage contract has focused tests for default completeness and for the
   absence of scientific ownership; and
6. any deleted residue has an explicit zero-reference or retired-runtime
   finding recorded by the implementation review.

This ADR does not claim that the visual result has passed human acceptance or
that the complete scientific-explanation experience is finished.

