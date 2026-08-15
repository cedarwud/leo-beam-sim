# Archived-TLE pass-index spike

This non-production spike tests one question before changing the active
simulator: can a conservative, snapshot-aware candidate pass reduce the
full-catalog work without omitting any satellite that the existing dense
30-second NTPU baseline sees above the horizon?

The spike uses the checked-in archive loader and snapshot resolver, the same
`satellite.js` SGP4/TEME-to-ECF operations, and the authoritative NTPU WGS84
coordinates. The observer calculation and candidate classifier are local to
this scratch checkpoint; the spike deliberately does not import the current
dirty/untracked production pass-index or pass-planner modules. It does not
edit or replace the current `src/tle/run/**` path.

## Method

1. Resolve one atomic archived publication for the requested UTC instant.
2. Sample every admitted TLE once at 120-second cadence from 120 seconds before
   the requested window through 120 seconds after it. The exact offset arrays
   are recorded in the report; if a requested axis is not divisible, the final
   endpoint is represented explicitly rather than inferred from an index.
3. Admit a satellite when any coarse sample reaches `-20 deg` elevation.
   A valid sample below the horizon is distinct from an `unknown` sample.
   Coarse propagation failures are admitted to every chunk fail-closed.
4. Build 10-minute time-local candidate chunks from that shared coarse scan,
   then run each exact 30-second anchor only against its owning chunk. The
   benchmark also reports the less useful whole-window candidate union so the
   difference is visible.
5. Independently run the same exact scan over the entire publication and
   compare identities.
6. Extract complete horizon-to-horizon events from both exact sample sets and
   compare satellite, AOS anchor, peak anchor, LOS anchor, interpolated event
   times, and peak elevation. A propagation failure invalidates that
   satellite's exact result and no partial visibility or pass event is
   published for it.

`spikeParity: PASS` means the measured snapshot/window had zero missed visible
identities or per-anchor samples, equal propagation-failure sets, equal
complete-pass event key sets, and every paired event stayed within the
reported numeric tolerances. It is an empirical result, not a mathematical
guarantee for every orbit and archive publication. The top-level
`status=PASS_SPIKE_NOT_ACCEPTANCE_GATE` intentionally does not claim that the
active production pass extractor/planner has parity: those modules are still
dirty/untracked in this checkpoint, so `formalProductionPassParity` remains
`BLOCKED` until a committed adapter can be audited. Production admission
thresholds must remain versioned and must be regression-tested across
representative Starlink and OneWeb snapshots.

## Run

```bash
node --import tsx/esm .scratch/tle-pass-index-spike/benchmark.ts \
  --constellation starlink \
  --time 2026-08-08T12:00:00.000Z

node --import tsx/esm .scratch/tle-pass-index-spike/benchmark.ts \
  --constellation oneweb \
  --time 2026-08-08T12:00:00.000Z
```

Optional tuning flags are `--duration`, `--exact-step`, `--coarse-step`,
`--chunk-duration`, `--guard`, and `--padding`, all in seconds except
`--guard`, which is degrees. The exact axis may have a non-divisible endpoint;
the explicit endpoint offset is retained and used for event interpolation.
The chunk duration must align to the coarse cadence, and endpoint padding must
cover at least one full coarse interval so a chunked event has real neighboring
samples for boundary refinement.

The reproducibility section of each JSON report records the resolved archive
and snapshot SHA-256, NTPU observer coordinates, exact/coarse sample offsets,
`satellite.js` version, scratch source hashes, and event comparison
tolerances. The checked-in result is a measurement receipt, not a runtime
cache or acceptance artifact.
