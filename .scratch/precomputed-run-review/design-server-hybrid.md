# Server-side versus hybrid delivery for the canonical TLE visual lab

Date: 2026-08-15  
Scope: architecture design only; no implementation is authorized by this note.

## Decision in one paragraph

Use one private deep module for canonical-run delivery and put two adapters behind
its seam:

* **A — server-side on-demand query/stream**: the server builds or opens a
  content-addressed run, caches it, and streams completed temporal/spatial
  ranges to the browser.
* **B — hybrid initial artifact + temporal/spatial chunks + Web Worker fallback**:
  the default-open path starts from a checked-in or CDN-hosted artifact; later
  ranges and custom dates use immutable chunks from the server/cache, with a
  Worker using the same canonical producer as the fail-soft compute adapter.

Recommend **B for a small academic deployment**. It keeps the default lesson
usable on a slow network without making a server request the first-paint
dependency, while retaining custom dates through the server adapter and an
offline/local Worker path. A is the cleaner operational model when many users
share a central compute/cache service; B has better leverage for the common
single-user/default-open path and better locality for an academic installation.

This is a delivery design, not a second scientific runtime. Global and NTPU
must receive projections of one accepted canonical run; neither view may
recompute SINR, power, throughput, EE, pass selection, or handover.

## Problem frame and current constraints

The target scene has roughly 10.7k renderable objects, 241 common anchors,
global/orbital and local/NTPU views, and a shared SINR/Power/Throughput/EE
result. The browser must remain interactive while the network is slow. Only
completed timeline ranges may be seekable. The common/default-open request is
the latency-sensitive path; custom date/source requests remain supported.

The current repository already gives the delivery design an important seam:

* The TLE geometry contract is 7,200 seconds at 30-second spacing, giving 241
  anchors (`src/tle/run/index.ts:19-28`). The builder reports progress and
  accepts cancellation/stale-request checks (`src/tle/run/index.ts:55-90`).
* The builder stores compact anchor-major propagation buffers and retains only
  satellites that survive all 241 anchors (`src/tle/run/index.ts:596-602`).
* `TleAnalysisRun` owns `geometryRunId`, `analysisRunId`, the pass plan,
  evaluation, handover trace, and frame access; parameter rebuilds keep the
  geometry run and pass plan frozen (`src/simulator/tleAnalysisRun.ts:63-103`,
  `src/simulator/tleAnalysisRun.ts:576-607`).
* The existing product SDD explicitly says global is real, while local/NTPU is
  still pending or partially mock; timeline/event bookmarks, story runtime, and
  clip export are also pending (`docs/sdd/MULTIBEAM-LEO-ENERGY-VISUAL-LAB-SDD.md:148-165`).
  A transport design must not silently promote those surfaces to scientific
  evidence.
* The same SDD already requires one route-facing `VisualLabSession` with
  `snapshot`, `subscribe`, and `dispatch`, and keeps cache/cancellation/atomic
  publication in a private collaborator (`docs/sdd/MULTIBEAM-LEO-ENERGY-VISUAL-LAB-SDD.md:188-205`,
  `docs/sdd/MULTIBEAM-LEO-ENERGY-VISUAL-LAB-SDD.md:273-314`). The designs below
  retain that route-facing seam rather than adding a public API per view.
* The explanatory route provides a useful artifact precedent: a compact,
  digest-bound serializable payload, with fail-closed validation and no browser
  TLE/SGP4 rebuild on first paint (`docs/sdd/SCIENTIFIC-NARRATIVE-VERTICAL-SLICE-SDD.md:630-637`,
  `docs/sdd/SCIENTIFIC-NARRATIVE-VERTICAL-SLICE-SDD.md:715-736`).

### Shared vocabulary

* **Module**: the canonical-run delivery module, hiding source selection,
  cache identity, chunk assembly, cancellation, and publication.
* **Interface**: the caller-visible types plus invariants, ordering, errors, and
  performance behavior—not merely a TypeScript `interface` declaration.
* **Seam**: the `RunSourceAdapter` slot where static artifact, HTTP/server, and
  Worker implementations can vary without changing the route or renderer.
* **Adapter**: one concrete source implementation satisfying that seam.
* **Depth**: the amount of request/range/cache/identity behavior hidden behind
  the small interface.
* **Leverage**: the same delivery decision serving both global and NTPU views,
  timeline, result dock, and future capture.
* **Locality**: source/cache/request-race changes remain in the delivery module
  and adapters, not in scene components.

## Shared deep module and interface

The new delivery module should sit behind the existing `VisualLabSession` and
should not become a second route-facing state owner. Internally call it
`CanonicalRunDelivery` (name illustrative).

```ts
type RunRequest = {
  readonly archiveId: string;
  readonly publicationSha256: string;
  readonly requestedInstantUtc: string;
  readonly modelRevision: string;
  readonly scenarioRevision: string;
  readonly parameters: SimulatorParameters;
};

type AnchorRange = {
  readonly startInclusive: number;
  readonly endInclusive: number;
};

type ViewKind = 'global' | 'ntpu';

interface CanonicalRunDelivery {
  open(request: RunRequest, signal?: AbortSignal): Promise<RunHandle>;
}

interface RunHandle {
  readonly manifest: RunManifest;
  readonly readyRanges: readonly AnchorRange[];
  ensure(
    range: AnchorRange,
    views: readonly ViewKind[],
    signal?: AbortSignal,
  ): Promise<void>;
  read(anchorIndex: number): SharedFrame;
  subscribe(listener: (state: RunState) => void): () => void;
  close(): void;
}
```

`ensure` is a preparation request, not a seek. It may fetch or compute; it
does not publish a partial frame. `read` is synchronous only for an anchor in
the completed range intersection and throws a typed `RANGE_NOT_READY` error
otherwise. The timeline uses `readyRanges` and never calls `read` outside that
set. `close` is lifecycle cleanup, not a scientific operation.

The route-facing `VisualLabSession.dispatch()` can translate source/date edits
and timeline intent into `open`/`ensure`; the React/R3F renderer consumes the
immutable `snapshot` produced by that session. No scene component imports an
HTTP client, CacheStorage, IndexedDB, Worker, or TLE producer.

### Run identity and payload types

```ts
interface RunManifest {
  readonly schema: 'canonical-run-manifest-v1';
  readonly runKey: string;             // content-addressed request identity
  readonly geometryRunId: string;      // same for parameter variants
  readonly analysisRunId: string;      // includes canonical parameters
  readonly frameSchemaRevision: string;
  readonly anchorCount: 241;
  readonly stepS: 30;
  readonly durationS: 7200;
  readonly requiredViews: readonly ViewKind[]; // ['global', 'ntpu']
  readonly chunks: readonly ChunkDescriptor[];
  readonly source: SourceReceipt;
}

interface ChunkDescriptor {
  readonly view: ViewKind | 'canonical';
  readonly range: AnchorRange;
  readonly uri: string;
  readonly sha256: string;
  readonly byteLength: number;
}

interface SharedFrame {
  readonly identity: {
    readonly runKey: string;
    readonly geometryRunId: string;
    readonly analysisRunId: string;
    readonly frameId: string;
    readonly anchorIndex: number;
    readonly instantUtc: string;
  };
  readonly canonical: CanonicalFrameLedger;
  readonly global: GlobalViewFrame;
  readonly ntpu: NtpuViewFrame;
}
```

The logical frame is shared even if its view payloads arrived in separate
chunks. Every view projection carries the same `frameId`, `analysisRunId`,
`anchorIndex`, and source receipt. The canonical ledger is the only authority
for SINR, actual transmit power, throughput, instantaneous EE, and run-level
evaluation EE. View payloads contain object identities and render transforms,
not alternate formulas.

### Shared invariants

1. `runKey` includes archive/publication digest, requested UTC, model revision,
   scenario revision, and parameter digest. A cache hit with a mismatched key
   is a refusal, not a best-effort reuse.
2. One `geometryRunId` may have multiple `analysisRunId` values when parameters
   change. A parameter-only rebuild may reuse geometry and pass plan, but its
   canonical frames and analysis identity remain a new accepted run.
3. `readyRanges` is the contiguous intersection of all required canonical,
   global, and NTPU chunks for the chosen presentation quality. Optional detail
   can arrive later, but it cannot be labeled required evidence before it is
   complete.
4. A range becomes ready only after schema, digest, anchor ordering, source
   identity, and cross-view frame identity checks pass. There is no synthetic
   frame, nearest-frame substitution, modulo playback, or mixed-run range.
5. A stale or cancelled request cannot publish any chunk into the accepted
   session. It may leave a private cache entry only if its digest is valid and
   its run identity remains reusable.
6. Both views are projections of the same accepted frame. The local/NTPU view
   cannot introduce a second geometry or service relationship and the global
   view cannot bypass the canonical identity check.
7. Interpolation is presentation-only and may use adjacent completed geometry;
   quantitative labels remain attached to a stored 30-second anchor. This
   preserves the existing completed-anchor rule
   (`docs/sdd/MULTIBEAM-LEO-ENERGY-VISUAL-LAB-SDD.md:445-456`).

### Error and performance contract

The interface reports typed errors rather than silently falling back:

```ts
type RunErrorCode =
  | 'SOURCE_UNAVAILABLE'
  | 'RUN_NOT_FOUND'
  | 'RANGE_NOT_READY'
  | 'DIGEST_MISMATCH'
  | 'SCHEMA_MISMATCH'
  | 'STALE_REQUEST'
  | 'CANCELLED'
  | 'BUDGET_EXCEEDED'
  | 'WORKER_UNAVAILABLE';
```

The default path must show an interactive shell and the first accepted scene
without waiting for all context detail. Range loading/computation is
abortable, coalesces duplicate requests, and keeps the last accepted snapshot
visible until the replacement satisfies its publish gate. The target quality
tier should use instancing/batched typed arrays and an LRU that retains the
current, adjacent, and one prefetched range; it must not hold all 10.7k-object
payloads for all 241 anchors in React state.

## Approach A — server-side on-demand query/stream

### Module and seam

`CanonicalRunDelivery` is implemented by a browser coordinator plus a
`ServerRunAdapter`:

```ts
interface ServerRunAdapter {
  open(request: RunRequest, signal?: AbortSignal): Promise<RunManifest>;
  fetchChunk(
    manifest: RunManifest,
    descriptor: ChunkDescriptor,
    signal?: AbortSignal,
  ): Promise<ChunkEnvelope>;
  cancel(runKey: string): Promise<void>;
}
```

The server hides catalog resolution, TLE snapshot validation, full SGP4
geometry build, canonical analysis, pass/handover trace, chunk packing, cache
lookups, request coalescing, and retention. The browser coordinator hides
transport, retries, digest verification, range assembly, and atomic
publication.

### Server protocol and payload strategy

The smallest useful protocol is:

```text
POST /runs/prepare       -> runKey + job state (idempotent)
GET  /runs/{runKey}/manifest
GET  /runs/{runKey}/chunks/{kind}/{start}-{end}.bin
POST /runs/{runKey}/cancel
```

`manifest` is small JSON. Chunks are versioned binary blocks (packed typed
arrays or another schema with explicit offsets), transported with ordinary
HTTP caching and Brotli/content encoding. Static GLB/terrain assets are
separate immutable resources and are never repeated in every temporal chunk.
Object metadata, stable IDs, bounds, and asset references belong in a static
spatial index. Temporal chunks carry only changed transforms, visibility,
service/candidate roles, beam/cell state, and canonical frame references.

The server should build and validate the complete canonical 241-anchor run
before publishing its manifest as accepted. It may then expose chunk descriptors
for delivery in any order. The browser's completed range is still the
intersection of required chunks, so an out-of-order response cannot make a
future timeline anchor seekable early.

### Default and custom request flow

* **Default open**: request the manifest, then the first global and NTPU
  presentation chunks plus canonical metrics. Prefetch the next temporal range
  only after the first frame is interactive.
* **Custom date**: submit the immutable `RunRequest`; if an identical run is
  already cached, receive its manifest immediately. Otherwise the server job
  computes once and coalesces concurrent callers.
* **Parameter-only edit**: the request has the same `geometryRunId` and can
  reuse the geometry/pass-plan cache while producing a new `analysisRunId` and
  canonical metric chunks.
* **Seek**: a timeline click outside `readyRanges` requests/awaits the required
  range, but the UI remains at the last completed anchor and marks the target
  pending. It never displays a partially assembled frame.

### Depth, leverage, locality

* **Depth**: high. One server module owns expensive propagation and all
  canonical validation; the browser interface stays small.
* **Leverage**: high for many users and custom dates. One cached run serves both
  views, timeline, result dock, and future clip capture.
* **Locality**: high for scientific consistency, moderate for deployment. A
  model revision or chunk schema change is localized in the server producer and
  packer. However, server operations, cache eviction, job cancellation, and
  deployment become part of the product.
* **Seam**: clean if only `ServerRunAdapter` is visible to the coordinator;
  shallow if UI callers learn job IDs, polling, HTTP ranges, or cache policy.

### Error/performance behavior

The server must support request deduplication by `runKey`, bounded concurrency,
per-request cancellation, `ETag`/digest validation, and backpressure. A slow
network should delay only the next range, not the already completed scene. A
server timeout returns a typed pending/unavailable state; it does not silently
run a different local formula or reuse a stale date.

The principal first-paint cost is still a network round trip plus the first
chunk. A warm server cache improves this substantially, but a cold server or
unreachable network makes the default lesson unavailable unless a separate
static fallback is added—which turns A into part of B.

### Usage

```ts
const handle = await delivery.open(defaultRequest, signal);
await handle.ensure({ startInclusive: 0, endInclusive: 7 }, ['global', 'ntpu']);

const frame = handle.read(0); // complete canonical + both projections only
renderGlobal(frame.global);
renderNtpu(frame.ntpu);
renderMetrics(frame.canonical);
```

The caller never knows whether the server used memory, disk, object storage,
or a queued worker. The adapter owns those decisions.

## Approach B — hybrid artifact + chunks + Worker fallback

### Module and adapters

The public `CanonicalRunDelivery` interface is unchanged. Its source seam has
three adapters and one cache adapter:

```ts
interface RunSourceAdapter {
  resolve(request: RunRequest, signal?: AbortSignal): Promise<RunManifest>;
  load(
    manifest: RunManifest,
    descriptors: readonly ChunkDescriptor[],
    signal?: AbortSignal,
  ): Promise<readonly ChunkEnvelope[]>;
}

// Concrete adapters behind the seam:
//   DefaultArtifactAdapter  -> immutable initial artifact + packaged chunks
//   HttpChunkAdapter        -> server/CDN manifest and temporal/spatial chunks
//   WorkerComputeAdapter    -> same canonical producer, local TLE/SGP4 fallback
```

`SourceRouter` chooses an adapter by request and availability, but does not
merge payloads from different model/source identities. The default route first
uses the artifact adapter. A custom request uses a cached manifest/chunk,
then HTTP, then the Worker if the HTTP path is unavailable or exceeds a
bounded wait. Any candidate from a different `modelRevision`, source digest,
or schema is refused rather than combined.

### Default artifact shape

The artifact is not a serialized `TleAnalysisRun` or full archive. It contains:

1. run/source/model/scenario/parameter identities and digests;
2. an object/spatial index with stable IDs, roles, bounds, and asset references;
3. the first accepted global/NTPU presentation range and canonical metrics;
4. chunk descriptors for the remaining temporal and spatial ranges; and
5. enough per-anchor identity to prove that global and NTPU chunks belong to
   the same run.

This follows the existing compact scientific-artifact pattern: the accepted
payload stores serializable source identity, canonical values, compact TLE
geometry, and event evidence, not functions or the full archive
(`docs/sdd/SCIENTIFIC-NARRATIVE-VERTICAL-SLICE-SDD.md:715-729`). The current
checked-in artifact is a precedent, not a claim that it is large enough for
the 10.7k-object lab.

### Temporal/spatial chunk layout

Use immutable content-addressed resources with a manifest such as:

```text
default/<runKey>/manifest.json
default/<runKey>/index/spatial.bin
default/<runKey>/canonical/a000-a015.bin
default/<runKey>/view/global/a000-a015.bin
default/<runKey>/view/ntpu/a000-a015.bin
default/<runKey>/view/global/lod-context.bin
default/<runKey>/view/ntpu/lod-service.bin
```

The exact range width should be measured; 8–16 anchors is a reasonable first
packing experiment because it amortizes request overhead without making one
slow transfer block the whole two-hour timeline. The contract does not depend
on that width. A range is accepted only after required canonical/global/NTPU
blocks are present and digest-verified. Optional context LOD can continue to
load after the accepted base range, but it cannot change canonical values.

Static geometry and GLB assets are referenced once. Repeated per-anchor data
uses packed typed arrays, quantization only where the declared visual error
budget allows it, and delta-friendly ordering. No JSON array of 10.7k object
records is emitted for every anchor.

### Worker fallback

The Worker adapter is a real computation adapter, not a mock playback source.
It loads the validated source selection and invokes the same neutral
`buildTleRunBundle` / `buildTleAnalysisRun` producer revision used for the
offline artifact/server. It must:

* run one custom request at a time (or use a bounded queue);
* use transferable typed-array buffers rather than copying the full scene into
  React state;
* yield regularly and honor `AbortSignal`/stale request identity;
* publish chunks only after the complete canonical run and required range checks
  pass; and
* expose `geometryRunId`, `analysisRunId`, source digest, and model revision so
  parity with server/artifact data is testable.

The Worker is allowed to keep the browser interactive while it computes, but
it is not allowed to invent a range or to replace an unavailable canonical
field with a display value. If the producer package or model revision cannot
be proven equivalent, the adapter returns `WORKER_UNAVAILABLE`.

### Default and custom request flow

* **Default open**: load the digest-verified artifact and first required
  range from the same origin/cache. Render the first common global/NTPU frame
  immediately; begin prefetch in the background.
* **Slow network**: keep the accepted first range interactive; show a bounded
  completed-range bar. Seek only inside ready ranges; a future range remains
  pending instead of freezing the canvas or showing a partial object set.
* **Custom date**: resolve the run manifest from HTTP/cache. If the server is
  slow/offline, start the Worker with the validated source and preserve the
  previous accepted snapshot until a new range/run satisfies publication.
* **Same date, new SINR/power parameters**: reuse the cached geometry run and
  pass plan when identities permit; recompute canonical analysis and range
  payloads under the new `analysisRunId`.
* **Capture**: freeze a `CaptureState` from the accepted run and ready ranges;
  capture is a consumer of evidence, never a source that can fill missing
  ranges.

### Depth, leverage, locality

* **Depth**: highest for the default caller. The session hides source routing,
  cache lookup, Worker lifecycle, range intersection, and stale publication.
* **Leverage**: highest for a small deployment. One artifact serves the common
  first paint; the same chunk contract serves both views, custom dates, offline
  fallback, and later capture.
* **Locality**: excellent if all adapters share one manifest/chunk schema and
  canonical producer package. Network changes stay in `HttpChunkAdapter`; local
  compute changes stay in `WorkerComputeAdapter`; UI remains unchanged.
* **Seam**: real, not hypothetical, because the artifact, HTTP, and Worker
  adapters are independently useful. The seam must not leak a source-specific
  `Promise`/job/polling shape into the route.

### Error/performance behavior

The static artifact makes default first paint independent of a cold server. The
HTTP adapter can reuse immutable browser/CDN caches. The Worker is a bounded
fallback, not an unconditional second computation, so it does not compete with
normal rendering until needed. Memory is bounded by retaining the current and
adjacent ranges plus an LRU of recent chunks; static GLB assets are managed by
the renderer/asset cache.

The cost is duplicated producer/runtime packaging and a parity obligation:
server, offline generator, and Worker must agree on model revision, schema, and
content digest. A parity failure is intentionally visible as refusal. This is
more work than A, but avoids making the common academic demonstration depend on
server availability.

### Usage

The caller remains identical to Approach A:

```ts
const handle = await delivery.open(request, signal);
await handle.ensure({ startInclusive: 0, endInclusive: 7 }, ['global', 'ntpu']);
const frame = handle.read(0);
```

Only `SourceRouter` decides whether those bytes came from the default artifact,
an HTTP chunk, a browser cache, or a validated Worker result.

## Comparison

| Criterion | A: server query/stream | B: hybrid artifact/chunks/Worker |
|---|---|---|
| Default-open latency | Depends on network and warm server | Static first range; best common path |
| Slow-network interaction | Good after first chunk; cold first paint fragile | Good; accepted range remains usable while next ranges load |
| Custom date | Strong; central compute/cache | Strong; HTTP first, Worker fallback |
| Offline/default classroom | Fails without a server or extra static fallback | Works for default artifact; custom date may be unavailable |
| Scientific producer count | One central producer | Shared producer package plus parity checks |
| Server operations | Substantial job/cache/observability surface | Small server/CDN adapter can start static-only |
| Browser CPU | Low | Low for default; bounded Worker cost on fallback |
| Cache locality | Central and shared across users | Strong browser/CDN locality for immutable ranges |
| Failure isolation | Server failure blocks new/default runs | HTTP failure is isolated by artifact/Worker path |
| Implementation locality | Simple if server is the only adapter | More adapters, but all hidden behind one seam |
| Academic deployment fit | Best when a maintained server already exists | Best when one small deployment needs a reliable demo |
| Main risk | First-paint/network availability and backend scope | Producer parity drift and duplicated packaging |

### Why not one full static download?

A single static file is initially simple, but it couples first paint to the
largest payload: all 10.7k-object temporal data, all 241 anchors, and any view
duplication arrive before the user can interact. It increases transfer time,
decode time, browser memory pressure, and cache invalidation size; custom dates
still require a new producer path. It also prevents an honest completed-range
timeline because the UI has only `loaded` versus `not loaded`, not verified
temporal/spatial readiness. A static **first-range artifact plus immutable
chunks** retains the operational simplicity without accepting those costs.

## Recommendation and bounded rollout

Adopt B as the product seam, while implementing the HTTP adapter so it can later
be used as A's central server without changing the route interface:

1. Freeze `RunManifest`, `ChunkDescriptor`, `SharedFrame`, run/error identity,
   and the `readyRanges` rule. Add schema/digest fixtures before transport code.
2. Build the default artifact and first common global/NTPU range from the
   existing neutral pipeline. Keep the artifact compact; never serialize
   functions or the complete `TleRunBundle`.
3. Add immutable temporal/spatial chunks and a browser cache. Prove that both
   views render the same `frameId`, `analysisRunId`, `anchorIndex`, and source
   receipt.
4. Put the server/CDN adapter behind the same seam for custom dates and cache
   misses. A small academic deployment may serve immutable files first and add
   `POST /runs/prepare` only when custom-date demand justifies it.
5. Add the Worker fallback only after producer parity and cancellation tests
   exist. It must reuse the same canonical producer revision, not copy a
   simplified formula into the browser.
6. Connect `VisualLabSession` and the single renderer. The right results,
   timeline, global view, NTPU view, and future capture all consume the same
   accepted snapshot.

### Acceptance gates

The design is ready for implementation only when these checks are explicit:

* default artifact digest/source/model validation fails closed;
* a range cannot become seekable until canonical, global, and NTPU required
  chunks are complete and cross-identity validated;
* a stale custom request cannot replace the accepted run;
* server, artifact, and Worker variants with the same request either produce
  the same canonical IDs/values within the declared serialization tolerance or
  refuse as a parity failure;
* parameter-only variants share `geometryRunId` but have distinct
  `analysisRunId`/frame identities;
* no view owns a formula or a second TLE/EE calculation;
* a browser slow-network test confirms first accepted interaction before
  later ranges complete and confirms that out-of-range seek remains pending;
* the local/NTPU implementation truth table is updated before it is described
  as evidence-backed (`docs/sdd/MULTIBEAM-LEO-ENERGY-VISUAL-LAB-SDD.md:148-165`).

The resulting architecture is deep because callers ask for an accepted frame
and completed range, while the module absorbs source selection, cache policy,
transport, Worker scheduling, digest checks, cancellation, and atomic
publication. It is local because changing delivery does not change the
canonical producer or either renderer. It has leverage because one immutable
run powers both global and NTPU views, the timeline, metrics, and any later
deterministic story clip.
