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

## 90-day extension and diagnostics

The recommended escalation after a 30-day sweep is a 90-day full-reference
search. It reuses every compatible cached window and does not change the orbit,
TLE, or handover policy. The 90-day grid contains 4,320 windows:

```bash
npm run mine:tle:event-atlas -- \
  --source-root /home/sat/satellite/tle_data \
  --constellation starlink \
  --cache-dir /home/sat/tle-event-atlas-cache/20260818 \
  --output-dir artifacts/tle-event-atlas/20260818-ntpu-90d \
  --start-utc 2026-05-19T00:00:00Z \
  --days 90 \
  --propagation-mode full-reference \
  --atlas-compression gzip \
  --shard-count 16 \
  --shard-index 0
```

Run shard indices 0 through 15 and repeat for OneWeb. After all shards finish,
aggregate with `--aggregate-only --atlas-compression gzip`. Gzip is transport
only; the JSON schema and source-backed contents are unchanged. The
uncompressed 90-day atlas is intentionally not committed as one large Git
object.

After aggregation, create the read-only gate diagnostic from the same window
cache. It reports candidate visibility, qualification ΔSINR, elevation,
residual visibility, power limiting, and near-miss examples without rerunning
any canonical calculation:

```bash
npm run diagnose:tle:event-atlas -- \
  --cache-dir /home/sat/tle-event-atlas-cache/20260818 \
  --constellation starlink \
  --config-digest <config-digest-from-shard-log> \
  --output-dir artifacts/tle-event-atlas/20260818-ntpu-90d \
  --start-utc 2026-05-19T00:00:00Z \
  --days 90
```

## Compact outputs

For each constellation the tracked output directory contains:

- `<constellation>-atlas.json` or `<constellation>-atlas.json.gz`: compact
  window receipts, source-backed event variant receipts, de-duplicated logical
  events, ranking dimensions, population summary, and at most 200 complete
  top-ranked teaching clips;
- `<constellation>-summary.md`: short human-readable result and top events;
- `<constellation>-run-manifest.json`: source/cache/config/provenance receipt.
- `<constellation>-diagnostics.json` and `<constellation>-diagnostics.md`:
  read-only gate diagnostics derived from accepted window receipts.

The Git output does not contain full ephemeris arrays or per-anchor full
constellation frames. Every retained event includes its publication SHA-256,
resolved snapshot digest, TLE line pairs for the participating satellites,
original UTC, trace digest, pass selection, pre/post-commit evidence, and
three compact canonical clip anchors.
