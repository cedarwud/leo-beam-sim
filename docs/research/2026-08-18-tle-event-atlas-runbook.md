# Real-TLE Event Atlas runbook

Status: implemented offline mining path; canonical results require a complete
`full-reference` sweep.

## Scientific boundary

The miner searches archived Starlink or OneWeb publications without changing
their TLE lines, epochs, UTC axis, orbital phase, RAAN, or mean anomaly. Every
window is one existing 7,200-second, 241-anchor canonical analysis run. Valid
inter handovers remain the accepted 3 dB offset plus 30-second TTT trace;
forced continuity remains a separate event type.

The miner calls the existing archive resolver, SGP4 run builder, pass planner,
canonical frame producer, and immutable handover trace. It does not implement
a second SINR, Power, Throughput, EE, or handover calculation.

`full-reference` windows may carry `canonical-research` evidence.
`staged-coarse-to-fine` is available only for performance exploration and is
forced to carry `provisional-candidate-pool`; it cannot be promoted by the CLI
to canonical evidence.

If any requested window is rejected, the atlas remains a diagnostic artifact:
`coverageComplete=false`, `populationClaimsAllowed=false`, and the event-rate
field is null. Observed source-backed events remain inspectable, but their
counts are not a complete population result.

## Server preparation

The source archive is read-only:

```text
/home/sat/satellite/tle_data/starlink/tle/starlink_YYYYMMDD.tle
/home/sat/satellite/tle_data/oneweb/tle/oneweb_YYYYMMDD.tle
```

Use an isolated checkout and Node 24. The catalog pass validates every 3LE
record, checksum, epoch bound, byte length, and SHA-256. Rebuildable catalogs
and per-window receipts stay outside Git:

```bash
npm run mine:tle:event-atlas -- \
  --source-root /home/sat/satellite/tle_data \
  --constellation starlink \
  --cache-dir /home/sat/tle-event-atlas-cache/20260818 \
  --prepare-catalog-only
```

Repeat with `--constellation oneweb`.

## Canonical 7-day sweep

One process can run the complete sweep directly. Four independent shards are
preferred for Starlink because they share only immutable catalog metadata and
write disjoint UTC-keyed window receipts:

```bash
npm run mine:tle:event-atlas -- \
  --source-root /home/sat/satellite/tle_data \
  --constellation starlink \
  --cache-dir /home/sat/tle-event-atlas-cache/20260818 \
  --output-dir artifacts/tle-event-atlas/20260818-ntpu-7d \
  --start-utc 2026-08-10T00:00:00Z \
  --days 7 \
  --propagation-mode full-reference \
  --shard-count 4 \
  --shard-index 0
```

Run shard indices 0 through 3. After all shards finish, publish the compact
atlas from the cache:

```bash
npm run mine:tle:event-atlas -- \
  --source-root /home/sat/satellite/tle_data \
  --constellation starlink \
  --cache-dir /home/sat/tle-event-atlas-cache/20260818 \
  --output-dir artifacts/tle-event-atlas/20260818-ntpu-7d \
  --start-utc 2026-08-10T00:00:00Z \
  --days 7 \
  --propagation-mode full-reference \
  --aggregate-only
```

Use the same commands for OneWeb. Resume is the default: a window with the
same archive/config digest is read from cache. `--no-resume` recomputes it.

## Runtime expectation

The existing measured full Starlink path is about 9.6 seconds per two-hour
window on the prior local snapshot. A 7-day, 30-minute grid contains 336
windows: roughly 54 minutes on one process, or approximately 15-25 minutes on
four server shards before catalog and I/O overhead. A 30-day full-reference
sweep is approximately four hours single-process or about one hour on four
similar shards. These are estimates; the run logs preserve measured wall time
per window.

## Compact outputs

For each constellation the tracked output directory contains:

- `<constellation>-atlas.json`: complete window receipts, source-backed event
  variants, de-duplicated logical events, ranking dimensions, and population
  summary;
- `<constellation>-summary.md`: short human-readable result and top events;
- `<constellation>-run-manifest.json`: source/cache/config/provenance receipt.

The Git output does not contain full ephemeris arrays or per-anchor full
constellation frames. Every retained event includes its publication SHA-256,
resolved snapshot digest, TLE line pairs for the participating satellites,
original UTC, trace digest, pass selection, pre/post-commit evidence, and
three compact canonical clip anchors.
