# ADR-013: Keep the homepage on the Walker runtime

## Status

Accepted by owner direction

## Date

2026-08-26

## Context

The homepage was changed to mount the archived-TLE/SGP4 producer by default.
That source can reproduce orbital geometry and forced-continuity replacements,
but its current Starlink run does not provide the live Walker handover behavior
the homepage is designed to demonstrate. In particular, an occasional serving
satellite replacement caused by loss of visibility is not evidence that the
3 dB offset remained satisfied for the 30-second TTT.

The project still needs the complete checked-in Starlink and OneWeb TLE archive,
and the teaching routes need a current, source-backed reference date. Those
requirements do not require the homepage to use TLE as its runtime producer.

This decision supersedes only the homepage archived-TLE source and centre-lane
sections added to ADR-005 on 2026-08-12. ADR-005 remains authoritative for the
dedicated TLE simulator, archive validation, SGP4 provenance, and canonical EE
rules.

## Decision

- `/` mounts the synthetic Walker runtime as its only simulation producer.
- The Walker/TLE source switch remains hidden. A stored `archived-tle` value
  cannot override the homepage default while the switch is hidden.
- The homepage does not start archived-TLE catalog, SGP4, pass-plan, or
  canonical-run work in the background while Walker owns the page.
- Homepage constellation changes select the corresponding Walker profile. They
  do not select a TLE catalog.
- Homepage date and time are Walker epoch inputs. Changing either value resets
  and recomputes the Walker trajectory, serving/candidate links, central scene,
  timeline, and result rail from the same Walker state.
- The time control uses an explicit 24-hour `HH:MM` interface in
  `Asia/Taipei`; no AM/PM control is part of the homepage.
- The initial Walker civil time is aligned with the latest checked-in teaching
  TLE reference instant so the homepage and course open on the same date. This
  alignment is a presentation default only and does not make Walker
  TLE-derived.
- Archived TLE remains available to `/simulator` and source-backed teaching
  routes. The browser archive is rebuilt from `../tle_data`, validates every
  accepted snapshot, and preserves reviewed exclusions rather than repairing
  or publishing invalid TLE lines.

## Alternatives considered

### Keep archived TLE on the homepage and synthesize Walker handover fields

Rejected. It would mix a TLE geometry source with fabricated Walker policy
state and would make forced continuity look like Offset+TTT handover.

### Run Walker and TLE simultaneously

Rejected. Two active producers would make the central scene, side rails, and
timeline ownership ambiguous and would waste browser resources.

### Remove TLE archives and teaching references

Rejected. TLE/SGP4 remains necessary for the dedicated simulator and orbital
teaching experiments; only its ownership of the homepage is removed.

## Consequences

- The homepage again exposes live Walker service, candidate, TTT, and handover
  behavior.
- Date/time edits visibly change the simulated central scene without loading a
  TLE publication.
- The right rail and central callouts must consume the same accepted Walker
  frame.
- TLE archive freshness and homepage runtime ownership are validated as two
  separate contracts.

## Validation

- The homepage root reports `data-active-simulation-source="walker"` and a
  Walker-owned timeline.
- No homepage request for `/tle-archive/` or the default TLE run artifact occurs
  while the source switch is hidden.
- Changing hour, minute, date, or constellation changes the Walker epoch or
  profile and republishes the central/right-rail frame.
- The scenario time controls expose `00` through `23` and no AM/PM field.
- `npm run check:tle-archive` validates the separate Starlink and OneWeb browser
  archives against `../tle_data`.
