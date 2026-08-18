# Request-time TLE benchmark (shadow only)

This directory measures the selectable-archive request path against the committed
2026-08-08 Starlink and OneWeb snapshots. It is deliberately not imported by the
simulator and does not change the browser/runtime path.

Run both real fixtures from the repository root:

```bash
npx tsx .scratch/tle-request-time-benchmark/benchmark.ts --constellation=both
```

The command writes `results/oneweb-20260808.json` and
`results/starlink-20260808.json`.

The measured path is:

1. load and validate the mutable catalog;
2. resolve, SHA-256-check, and parse one atomic snapshot;
3. prepare every valid 3LE record into one reusable `satrec`;
4. sample the observer look angle coarsely to create time-local candidate pools;
5. generate exact geometry once for admitted candidate/anchor pairs into typed arrays;
6. derive 0/15/30-degree per-anchor pool counts from those arrays;
7. extract complete horizon events from retained elevation samples.

The event and pool phases must not call SGP4 again. The JSON reports the
propagation-attempt delta, which should be zero. It also runs an in-process
same-content-key warm lookup and records which catalog, parsed TLE, preparation,
geometry, pool, and event artifacts are reused.

The cache key includes the archive identity, catalog content digest (when
published), selected snapshot SHA-256, requested UTC instant, observer, every
sampling parameter, and the benchmark revision strings. A source digest is kept
beside the result so a warm hit cannot silently reuse another archive publication.

## Apply contract emitted for the future UI

Each result also contains `applyContract`, kept as a UI-facing shadow contract
without wiring it into the current app:

- `input` is the Apply payload: constellation, requested UTC instant, observer,
  7,200-second window, 30-second exact step, selected archive date, snapshot
  SHA-256, and content-addressed cache key.
- `progress` exposes twelve time-local chunks, their anchor ranges and candidate
  counts, completed/total anchors, percentage, and stage timings. The intended
  UI rule is monotonic progress with the timeline locked until all 241 anchors,
  all 240 EE intervals, retained pool counts, and pass events are complete.
- `readyBoundary` separates a complete shadow result from production
  publication. The benchmark records the complete-run boundary, propagation
  failures, geometry failures, and the explicit production gate status.
- `cache` reports cold creation and same-key warm reuse, including the source
  digest equality check. A changed catalog or snapshot digest produces a new key.
- `result` exposes the event count, the 0/15/30-degree pool summaries, candidate
  union size, and exact geometry propagation count. `errorPolicy` specifies
  fail-closed UI behavior: no synthetic TLE or time-shifted fallback, retain the
  last accepted result, surface the error, and keep the timeline locked.

This is a performance/correctness spike, not a product acceptance gate. The
coarse guard is a sampled empirical screen and is not a mathematical proof of
non-visibility. A production change still needs exact visibility/pass parity,
serving/handover/canonical-frame parity, and the locked-complete-run publication
gates from the simulator SDD/ADR.
