# Two-hour archived-TLE run implementation slice

Status: implementation authorized after fresh-context audit

## Checkable completion criterion

Given one selected constellation and one Asia/Taipei date/time, the homepage
resolves exactly one archived publication at `t0`, computes and validates a
complete `[t0, t0 + 7200 s]` run at 30-second anchors (241 anchors), and only
then atomically publishes the new run.  Until publication, the previous
accepted scene stays visible and the TLE timeline is disabled.  After
publication, seeking an anchor updates the campus scene, serving/candidate
identity, bounded same-instant context satellites, and canonical result rail
from that same run anchor.

## Frozen invariants

- One publication and one resolved TLE line pair per satellite are frozen for
  the whole run; crossing midnight or an archive date never switches files.
- No Walker, modulo orbit, wall-clock, synthetic satellite, or fallback frame
  may enter the run.
- First frame and every later anchor are TLE-derived SGP4 at one common UTC.
- Duration is 7200 seconds and anchor step is 30 seconds, including both ends.
- The run is not partially seekable: progress may be shown while building, but
  the video-style timeline unlocks only after all anchors and invariants pass.
- Full-catalog geometry is computed before pass selection.  Rendering remains
  bounded: serving and candidate own beams; context satellites remain visible
  without beams.
- Service/candidate selection operates on complete pass events and applies a
  deterministic spatiotemporal-diversity policy.  It never manufactures a
  candidate when no qualifying pass exists.
- The canonical EE result at a displayed anchor consumes the same selected
  satellite geometry and immutable model parameters as the scene.
- A stale or cancelled request cannot publish after a newer request.

## Module seams and ownership

- `src/tle/run/**`: compact full-catalog ephemeris builder, progress,
  cancellation, validation, and immutable RunBundle interface.
- `src/tle/pass/**`: pass extraction and deterministic diversity planner over
  run geometry; no React or application state.
- Controller-owned integration: simulator types/analysis, homepage analysis
  hook, App timeline selection, central scene adapter, documentation, and
  browser verification.

## Initial selection defaults

- pass visible threshold: elevation at or above 0 degrees;
- high-elevation preference: peak elevation at or above 70 degrees;
- near-duplicate peak-time separation: 90 seconds;
- preferred adjacent service-peak separation: 180 seconds;
- serving/candidate overlap before handover: at least 60 seconds;
- simultaneous serving/candidate angular separation: at least 10 degrees;
- candidate continuation after serving LOS: at least 120 seconds.

These are scenario-selection policy values, not an energy-saving or handover
policy claim.  The policy revision and selected pass identities belong in run
provenance.

## Measured feasibility checkpoint (2026-08-12)

- Checked-in Starlink publication `20260808`: 10,760 admitted satellites.
- Full SGP4 geometry run: 241 anchors in 2.742 seconds on the current
  environment.
- Private typed-array ephemeris: 124,471,680 bytes (about 118.71 MiB).
- Anchor 0 and anchor 240 each materialize all 10,760 real satellites in about
  35 ms and 32 ms respectively.
- The complete Starlink analysis build adds about 6.79 seconds: 3,597 real
  passes, 17 selected service passes, 210 anchors with a real candidate, two
  truthful boundary fallbacks, and zero unavailable anchors. End-to-end load,
  geometry, pass planning, and run evaluation complete in about 9.62 seconds.
- This supports the accepted atomic-completion design; no Walker or synthetic
  first-frame substitute is needed.
