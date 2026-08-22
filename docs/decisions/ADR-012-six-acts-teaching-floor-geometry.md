# ADR-012: Keep the teaching floor as a display-only regular seven-cell cluster

## Status

Accepted

## Date

2026-08-22

## Context

The teaching floor needs a compact seven-cell arrangement that can be read as
one classroom scene. Before `7d914b6`, the archived-TLE homepage display
borrowed centres from the irregular 37-cell substrate. That made the visible
floor depend on a historical display lattice instead of the seven cells that
the teaching surface actually presents.

The change in `7d914b6` is therefore a presentation projection, not a change to
the canonical TLE frame, serving decisions, handover managers, or EE inputs.
Canonical cell ids remain `0..6`; the placement owns the explicit mapping to
the historical display ids and remaps UE local offsets through one shared
immutable placement.

## Decision

Use a regular pointy-hex seven-cell cluster for the archived-TLE teaching floor:
one centre cell plus a six-cell axial ring. Keep the display ring slightly open
(`ARCHIVED_TLE_DISPLAY_RING_SPACING = 1.05`) so the renderer's outer footprint
rim does not paint across a shared edge. Keep the fit-scale and bounds checks in
the display placement so the complete floor remains inside the campus bounds.

The placement remains display-only. The canonical frame continues to own the
scientific cell centres and all serving/candidate truth; the teaching floor may
rearrange only the visual projection and UE local offsets.

## Alternatives considered

### Continue borrowing the irregular 37-cell centres

Rejected: the seven-cell teaching scene would inherit an unrelated display
substrate and its visual topology would not match the classroom story.

### Change the canonical cell frame to match the teaching floor

Rejected: a presentation correction must not rewrite TLE-derived geometry or
the runtime decision source.

### Revert the seven-cell projection

Rejected after validation: the projection unit test passes, and the S4 failure
exists unchanged before and after the commit, so reverting it would not repair
the simulator gate.

## Validation record

- `node --import tsx/esm src/scene/archivedTleSevenCellPlacement.test.ts` — pass.
- `npm run validate:s0:geometry-trace` — pass; the canonical trace remains
  deterministic.
- `7d914b6^`: `validate-s4-cell-served-survives-wrap` fails its positive control
  with `reset=100, rebase=100, gap=0`.
- Current checkout: the same validator fails the same assertion with
  `reset=100, rebase=100, gap=0`.

The matched failure means the S4 red point predates the teaching-floor geometry
change. It remains a separate simulator/runtime issue and is not repaired by
changing the display projection.

## Consequences

- The teaching floor has a stable, reviewable seven-cell visual topology.
- Canonical scientific geometry and serving truth remain untouched by the
  projection.
- Future spacing changes must update this record and re-run both placement and
  canonical geometry gates; they must not be hidden in a floor-switch change.
