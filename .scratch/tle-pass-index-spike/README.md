# Archived-TLE pass-index spike

This non-production spike tests one question before changing the active
simulator: can a conservative, snapshot-aware candidate pass reduce the
full-catalog work without omitting any satellite that the existing dense
30-second NTPU baseline sees above the horizon?

The spike uses the checked-in archive loader and snapshot resolver, the same
`satellite.js` SGP4/TEME-to-ECF operations, and the authoritative NTPU WGS84
coordinates. The observer calculation is copied locally so this scratch
checkpoint remains runnable before the newer observer module is committed; a
product implementation must call the shared adapter instead of duplicating it.
The spike does not edit or replace the current `src/tle/run/**` path.

## Method

1. Resolve one atomic archived publication for the requested UTC instant.
2. Sample every admitted TLE once at 120-second cadence from 120 seconds before
   the requested window through 120 seconds after it.
3. Admit a satellite when any coarse sample reaches `-20 deg` elevation.
   Coarse propagation failures are admitted fail-closed.
4. Build 10-minute time-local candidate chunks from that shared coarse scan,
   then run each exact 30-second anchor only against its owning chunk. The
   benchmark also reports the less useful whole-window candidate union so the
   difference is visible.
5. Independently run the same exact scan over the entire publication and
   compare identities.

`PASS` means the measured snapshot/window had zero missed visible identities
and the candidate-only exact result equalled the dense reference. It is an
empirical gate, not a mathematical guarantee for every orbit and archive
publication. Production admission thresholds must remain versioned and must
be regression-tested across representative Starlink and OneWeb snapshots.

## Run

```bash
node --import tsx/esm .scratch/tle-pass-index-spike/benchmark.ts \
  --constellation starlink \
  --time 2026-08-08T12:00:00.000Z

node --import tsx/esm .scratch/tle-pass-index-spike/benchmark.ts \
  --constellation oneweb \
  --time 2026-08-08T12:00:00.000Z
```

Optional tuning flags are `--coarse-step`, `--chunk-duration`, `--guard`, and
`--padding`, all in seconds except `--guard`, which is degrees.
