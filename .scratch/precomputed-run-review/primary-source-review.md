# Primary-source review: large browser 3D scientific runs

**Research date:** 2026-08-15  
**Scope:** a browser 3D scientific/satellite visualization with about 10,000 objects, 241 time anchors, real TLE/SGP4 propagation, and derived metrics.  
**Evidence rule:** official documentation, specifications, or first-party source repositories only.

## Executive verdict

“Download one complete precomputed run” is a good **scientific production boundary** but is too simplistic as the browser’s **first-load transport strategy** at this scale.

The recommended shape is:

1. Precompute and version the authoritative TLE/SGP4 and derived-metric run server-side.
2. Publish a small, immutable manifest plus spatial/LOD and temporal binary chunks.
3. Load only a coarse first view and the selected time anchor, then refine the visible region and nearby time window.
4. Decode/decompress and transfer typed-array buffers in workers; keep the renderer’s main-thread updates incremental.
5. Cache content-addressed chunks through HTTP/CDN and optionally a service worker; retain the complete run as an export, parity, and background-prefetch artifact.

This preserves deterministic science without making cold-start latency, peak memory, or one giant parse the user’s problem.

## Scale and the project’s current contract

The requested cardinality is `10,000 × 241 = 2,410,000` object-anchor states. Even an illustrative payload of only eight `Float32` values per state is about 77.1 MB raw (`2,410,000 × 8 × 4`), before object IDs, derived metrics, indices, compression, and temporary decode/GPU copies. This is an arithmetic sizing example, not a measurement of the repository’s current assets.

The current Leo simulator already has an important correctness seam: it freezes one archived TLE publication, computes 241 common UTC anchors, and publishes a complete immutable run atomically. See the [active ADR-005](../../docs/decisions/ADR-005-tle-and-canonical-ee-simulator-contract.md), [TLE/EE SDD](../../docs/sdd/TLE-CANONICAL-EE-SIMULATOR-SDD.md), and [current handoff](../../docs/handoff/LEO-SIM-CURRENT-HANDOFF-2026-08-11.md). The recommendations below keep that seam and change only how the result is delivered and retained in the browser.

## What first-party sources establish

### Spatial tiling and view-dependent LOD

- Cesium describes 3D Tiles as hierarchical LOD in which only visible tiles and the most important tiles for the current view are streamed. Geometric error and screen-space metrics drive refinement, while a tile’s refinement strategy determines whether children replace or add to the parent. See [Cesium 3D Tiles Essentials](https://cesium.com/why-cesium/3d-tiles/3d-tiles-essentials/).
- The [OGC 3D Tiles 1.1 specification](https://docs.ogc.org/cs/22-025r4/22-025r4.html) defines implicit tiling as a concise quadtree/octree representation with a subdivision scheme, refinement strategy, bounding volume, geometric error, and availability. That is a standards-backed model for an index and tile hierarchy, not a recommendation to put every application’s time series in a single file.
- Cesium’s [Cesium3DTileset API](https://cesium.com/learn/cesiumjs/ref-doc/Cesium3DTileset.html) exposes `maximumScreenSpaceError`, `skipLevelOfDetail`, `cullRequestsWhileMoving`, progressive-resolution prioritization, and foveated loading. The documented intent is to trade visual error and request priority for a quicker useful view, not to fetch every descendant before rendering.
- NASA Web WorldWind’s first-party [TiledImageLayer API](https://worldwind.arc.nasa.gov/autodocs/WebWorldWind/TiledImageLayer.html) uses a multi-resolution tile pyramid: level zero is the lowest resolution, each level increases resolution, and each higher level contains four times as many quarter-area tiles. It also exposes a detail-control threshold and a concurrent retrieval queue. WorldWind’s [layers tutorial](https://worldwind.arc.nasa.gov/web/tutorials/layers/) explicitly uses a low-resolution single image as a quick base while higher-resolution imagery is retrieved.
- deck.gl’s first-party [TileLayer documentation](https://deck.gl/docs/api-reference/geo-layers/tile-layer) says a very large dataset should be sliced into tiles with a bounding box and level of detail; the layer fetches and renders what is visible in the current viewport instead of fetching the entire dataset. It also documents cancellation signals for tiles that are no longer visible.

**Implication:** spatial locality and LOD are established patterns for getting a useful frame quickly. For moving satellites, use the same selection idea with a project-owned spatial index and time dimension; do not assume that a static 3D Tileset alone models temporal SGP4 state.

### Incremental loading and main-thread safety

- loaders.gl’s [streaming-loader guide](https://loaders.gl/docs/developer-guide/using-streaming-loaders) says batched parsing can handle inputs that exceed browser memory limits, avoid freezing the main thread by parsing smaller chunks, and process/display data while it is arriving. Its [`parseInBatches` API](https://loaders.gl/docs/modules/core/api-reference/parse-in-batches) yields batches from a `Response.body` stream or async iterator while the response is still being read.
- deck.gl’s [loading-data guide](https://deck.gl/docs/developer-guide/loading-data) documents worker-backed loaders for performance-sensitive formats and recommends passing abort signals through custom tile fetches. Its [performance guide](https://deck.gl/docs/developer-guide/performance) warns that changing a large `data` prop causes expensive CPU/GPU buffer regeneration and recommends incremental chunks rather than repeatedly replacing one growing array.
- MDN’s [Web Workers API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) states that laborious processing can run on a background thread so the UI thread is not blocked or slowed. MDN’s [transferable-objects guide](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects) documents transferring an `ArrayBuffer` rather than copying its bytes between the worker and main thread.
- MDN’s [readable-stream guide](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Using_readable_streams) documents reading `fetch()` response bodies chunk by chunk and cancelling a fetch with `AbortController`/`AbortSignal`.

**Implication:** a single large JSON response is the wrong default for a cold browser path. Binary chunks can be decoded in a worker and handed to the renderer as typed-array views; render updates should be bounded batches, not one 2.41-million-row object-array conversion.

### Binary and typed-array transport

- deck.gl’s [binary-data performance section](https://deck.gl/docs/developer-guide/performance#use-binary-data) recommends server or worker processing for data-intensive applications and identifies protobuf, Arrow, or a custom binary blob as more efficient than JSON. It also warns that reconstructing JavaScript object arrays consumes CPU and considerably more memory than the binary form.
- loaders.gl’s [binary-data guide](https://loaders.gl/docs/developer-guide/concepts/binary-data) standardizes on `ArrayBuffer`, notes that it is a natural WebGL input, and calls out ownership transfer between workers and the main thread as a performance advantage.

**Implication:** use a versioned binary schema for positions, velocities, IDs, visibility/LOD fields, and derived metrics. Keep the canonical metric semantics in the server-side/precomputed producer; the client may decode, select, interpolate display state, and render, but must not silently recompute a different EE/SINR truth path.

### Browser cache, CDN reuse, and offline behavior

- MDN’s [HTTP caching guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching) recommends explicit `Cache-Control` headers instead of relying on heuristic caching. For immutable, cache-busted resources it gives the concrete pattern `Cache-Control: public, max-age=31536000, immutable`, with `ETag`/`Last-Modified` as useful validators.
- MDN’s [Service Worker guide](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers) describes a service worker as a programmable proxy and documents cache-first/offline-first behavior: cached assets can provide a default experience before more data arrives from the network.

**Implication:** hash or otherwise version each manifest/chunk URL. Give immutable chunks long shared-cache lifetimes; keep the small manifest revalidated. A service worker can retain recently used runs for repeat lessons/offline use, but it cannot improve a first cold load and cannot make a monolithic payload cheap to parse.

## Strategy comparison

| Strategy | Strength | Failure mode at 10k × 241 | Recommended role |
|---|---|---|---|
| One complete precomputed run in one file | Simplest atomic provenance, deterministic replay, easy export and parity checking | Downloads invisible/time-unneeded data; one large response, parse, allocation, and GPU upload create startup latency, peak memory, and cache invalidation coupling | Keep as authoritative export/parity artifact and optional background cache; do not make it the only first-load path |
| Immutable spatial + temporal binary chunks | Fetches only visible objects/LOD and needed anchors; CDN-friendly; partial retries and reuse | Requires manifest, tile selection, chunk identity, and boundary rules | **Default transport for this project** |
| Server-side query endpoint | Useful for ad-hoc object/time/filter queries and very large datasets; can avoid shipping unused data | Adds network round trips, server availability, query-version reproducibility, and a risk of per-frame request chatter | Optional analysis/query lane; return versioned immutable result IDs and avoid per-animation-frame queries |
| Client-side SGP4 and derived-metric computation | Less precomputed data on the wire; can support small offline scenarios | CPU, memory, battery, and numerical/provenance drift; a large synchronous run freezes the UI | Only small visible subsets or a worker fallback; canonical derived metrics remain precomputed |
| Service-worker/browser cache | Repeat visits, classroom/offline resilience, chunk reuse | No benefit on the first cold download; cache eviction/storage quotas still exist | Layer on top of immutable chunks, not a substitute for chunking |
| JSON object arrays | Easy to inspect and prototype | Parse/repack overhead and larger memory footprint; repeated updates rebuild buffers | Manifest/debug samples only; not the hot path |
| Typed arrays/custom binary | Compact, direct GPU/worker handoff, predictable schema | Requires schema/version/endianness/precision and tooling | Use for every large chunk, with explicit schema metadata |

## Ranked recommendation for Leo

### 1. Keep the immutable complete-run contract, but make it a manifest plus chunks

The authoritative build should still produce one run identity containing the frozen TLE publication, source hashes, 241-anchor time axis, scenario identity, canonical metric schema/version, and a parity digest. Publish a small manifest first. It should point to content-addressed artifacts such as:

- a static object catalog and ID-to-index mapping;
- a coarse summary/initial-anchor payload for immediate display;
- spatial tiles or buckets with explicit bounds and LOD metadata; and
- temporal chunks covering bounded anchor windows, each with positions/velocities and the precomputed derived fields required by the selected view.

The exact spatial partition and time-window size need measurement; they are project design parameters, not values prescribed by the cited libraries. The important property is that each artifact is independently addressable, verifiable, cancellable, and reusable. A complete-run bundle may still be generated for download, offline packaging, and end-to-end parity, but it should be assembled in the background rather than blocking the first frame.

### 2. Apply viewport/time selection and LOD before decoding

Start with one coarse level for the initial camera and selected anchor. Refine only the visible spatial buckets, then prefetch adjacent time chunks for timeline scrubbing. Use parent/coarse data while children are pending and retire chunks that leave the view or exceed a memory budget. The Cesium, deck.gl, and WorldWind sources all support the general pattern of bounded, view-dependent retrieval; a Three.js/React Three Fiber implementation can adopt the pattern without replacing the current renderer.

For an orbit view that sees most of the globe, “visible” may still be a large fraction of the constellation. That does not invalidate tiling: it bounds individual allocations, enables progressive rendering, allows cancellation/retry, and prevents an unrelated time window or hidden metric from joining the first decode.

### 3. Decode and hand off binary data in workers

Use a worker for binary decode, decompression, validation, and any unavoidable SGP4 work. Transfer ownership of `ArrayBuffer`s rather than copying typed arrays. Keep the main thread responsible for scene state, camera, and bounded GPU updates. If a client-side calculation is added later, it must be explicitly labelled as a display projection or fallback and compared against the frozen server artifact; it must not become a second canonical EE producer.

### 4. Make cache identity and provenance explicit

Use URLs keyed by run hash, scenario/TLE publication hash, schema version, spatial tile, LOD, and temporal chunk. Serve immutable chunks with a long `max-age` and `immutable`; serve the manifest with validation (`ETag`/`Last-Modified`) so a new run changes the manifest rather than mutating old chunk URLs. A service worker may cache the manifest plus a bounded recent-chunk set and serve the last accepted run offline.

### 5. Make slow-network behavior a product contract

The browser should behave as follows on a slow or interrupted connection:

1. Render the application shell and provenance/status controls without waiting for all objects.
2. Fetch the manifest, then the smallest coarse/initial-anchor payload. Show a labelled coarse/partial state rather than a blank canvas.
3. Stream/decode visible chunks in bounded batches. Render each accepted batch; never `JSON.parse` or repack the whole run on the main thread.
4. Abort requests and worker jobs for invisible tiles or superseded draft time/constellation requests. Do not cache or publish incomplete results.
5. Keep the last accepted immutable frame visible while a new run is being built. Only unlock the timeline and replace the result panels after the required run-local artifacts and canonical metrics validate together, matching the existing atomic-switch contract.
6. If the network fails, keep cached/last-accepted data with an explicit stale/offline label, expose retry, and never present missing derived metrics as zero or as a completed scientific run.
7. Prefetch neighboring time chunks only after the first frame is usable; on very slow links, prefer the selected anchor and coarse LOD over speculative full-run download.

## Decision

For this project, **precompute the complete run, but do not require the browser to download and materialize the complete run before first interaction**. The first-load default should be a manifest + coarse selected-anchor payload, followed by spatial/LOD and temporal chunk refinement. The complete run remains the source-of-truth/export/parity object, while transport and rendering become progressive.

This is especially important because the current contract intentionally treats a run as immutable and atomically accepted: chunking must not weaken that scientific gate. A chunk may be displayed as a coarse/progressive projection, but a canonical result claim is made only after the same run identity, TLE provenance, anchor identity, and derived-metric validation are present.

## Suggested validation before implementation

Run a focused bake-off against the existing complete-run path, without changing scientific formulas:

- cold-cache and warm-cache loads on a throttled slow connection;
- one monolithic JSON/binary complete run versus manifest + spatial/temporal chunks;
- first useful frame time, total bytes before first frame, peak JS/GPU memory, long main-thread tasks, and timeline seek latency;
- cancellation/retry when changing time or constellation mid-load; and
- byte/hash and canonical-metric parity for every selected chunk against the current immutable run.

Set project acceptance thresholds before choosing chunk sizes. If the measured complete run is genuinely small and the first frame arrives within those thresholds, retaining a single-file fast path is reasonable; otherwise the chunked path should be the default and the complete file should remain a background/export path.

## Primary sources

All links below are first-party documentation or specifications used above.

1. [Cesium — 3D Tiles Essentials](https://cesium.com/why-cesium/3d-tiles/3d-tiles-essentials/)
2. [CesiumJS — Cesium3DTileset API](https://cesium.com/learn/cesiumjs/ref-doc/Cesium3DTileset.html)
3. [OGC — 3D Tiles 1.1 Community Standard](https://docs.ogc.org/cs/22-025r4/22-025r4.html)
4. [deck.gl — Performance Optimization](https://deck.gl/docs/developer-guide/performance)
5. [deck.gl — TileLayer](https://deck.gl/docs/api-reference/geo-layers/tile-layer)
6. [deck.gl — Loading Data / Web Workers](https://deck.gl/docs/developer-guide/loading-data)
7. [loaders.gl — Using Batched Loaders](https://loaders.gl/docs/developer-guide/using-streaming-loaders)
8. [loaders.gl — parseInBatches API](https://loaders.gl/docs/modules/core/api-reference/parse-in-batches)
9. [loaders.gl — Binary Data](https://loaders.gl/docs/developer-guide/concepts/binary-data)
10. [NASA Web WorldWind — TiledImageLayer API](https://worldwind.arc.nasa.gov/autodocs/WebWorldWind/TiledImageLayer.html)
11. [NASA Web WorldWind — Layers tutorial](https://worldwind.arc.nasa.gov/web/tutorials/layers/)
12. [MDN — Web Workers API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)
13. [MDN — Transferable objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects)
14. [MDN — Using readable streams](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Using_readable_streams)
15. [MDN — HTTP caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching)
16. [MDN — Using Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers)

