# STATIC/PRECOMPUTED two-hour TLE run: deep-module design

Status: design only. This file proposes a browser-serving boundary; it does
not implement the builder, worker, codec, or UI integration.

## Decision

Use a content-addressed, build-time **static run artifact** with three
separate delivery lanes:

1. `ntpu-exact`: the local analysis lane. It contains exact 30-second states
   only for an empirically measured pool of real pass/candidate satellites,
   plus the precomputed canonical `SimulationAnalysisFrame` equivalent for
   all 241 anchors.
2. `global-overview`: an inexpensive all-object display lane. It contains a
   satellite dictionary and a coarse, same-UTC overview/LOD track for the
   whole constellation. It has no canonical analysis payload.
3. `global-exact`: optional on-demand all-object position chunks for a global
   zoom, inspection, or exact-anchor comparison. It is never required to
   start the local NTPU scene.

The run itself remains one real TLE-derived run: one publication, one
resolved TLE pair per admitted source satellite, one UTC axis from `t0` to
`t0 + 7,200 s`, and 241 exact 30-second anchors. The lanes are different
projections of that run, not different runs. A shared `runId` is necessary for
cross-view identity, but it does not imply equal payloads, equal sampling
density, or equal satellite counts.

The browser downloads a small manifest and a first-frame bootstrap, then
loads immutable range chunks in a Worker. It never runs SGP4, pass extraction,
or canonical EE analysis on the main thread. A timeline range becomes
seekable only after its complete lane chunk has passed shape, identity, and
hash validation. A display interpolation may use two completed exact anchors,
but canonical values always remain those of the lower stored 30-second
anchor.

## Fixed boundary and evidence

The active simulator contract is defined by `ADR-005`,
`TLE-CANONICAL-EE-SIMULATOR-SDD.md`, and the current handoff. In particular:

- the source publication and resolved TLE records are frozen at `t0`;
- crossing an archive-date or midnight boundary never changes the
  publication inside the run;
- the run has 241 inclusive anchors at 30-second spacing;
- the canonical chain is `gamma_req -> p_req -> cap -> P_DL_actual ->
  interference -> SINR -> rate -> power -> EE`;
- SINR, Power, Throughput, and EE are projections of one immutable frame;
- a candidate is a real same-instant comparison, not a handover decision or a
  fabricated second satellite; and
- a missing real candidate is represented as unavailable, never as a profile
  default or a zero invented to fill a table.

The current feasibility checkpoint for the checked-in Starlink publication
records 10,760 admitted satellites, 2.742 s for the full 241-anchor geometry
run, 124,471,680 bytes (about 118.71 MiB) for private `Float64` position and
velocity arrays, about 6.79 s for pass/analysis construction, and about 9.62
s end to end. That is useful evidence for a build-time bake, but it is not a
browser payload or a reason to send the full geometry to the NTPU lane. The
current in-memory path also scans the full constellation for observer
visibility at every anchor; this design moves that work to the bake and makes
the local payload visibility-first.

## Module

`staticRunArtifact` is the deep Module. Its responsibility is to turn one
validated artifact identity into a safe, progressively available read model.
It owns:

- manifest and schema validation;
- content-addressed fetch and cache keys;
- Worker-side decompression, hash verification, and binary decoding;
- chunk/range readiness and cancellation;
- cross-lane run/frame identity checks; and
- bounded memory and stale-request handling.

It does not own React state, camera policy, scientific formulas, or a renderer.
It does not silently fall back to Walker/Kepler propagation or to a generated
orbit. A failed lane is a failed lane; the shell may remain usable, but the
UI must say that the TLE-derived data is unavailable.

The Module boundary is intentionally small. The wire layout, cache strategy,
screening implementation, and Worker protocol remain hidden so that a future
codec or CDN layout does not leak into the scene or timeline code.

## Interface

The public runtime has three entry points: `openStaticRun`, `ensure`, and
`read`. `onUpdate` is a callback supplied to `openStaticRun`, not a fourth
control surface. `read` never starts network work and never computes a frame.

```ts
type StaticSurface =
  | 'ntpu-exact'
  | 'global-overview'
  | 'global-exact';

type AnchorRange = Readonly<{
  /** Inclusive exact-run anchor indices. */
  start: number;
  end: number;
}>;

type StaticRangeRequest = AnchorRange & Readonly<{
  surface: StaticSurface;
}>;

interface StaticRunRequest {
  readonly manifestUrl: string;
  readonly signal?: AbortSignal;
  readonly onUpdate?: (update: StaticRunUpdate) => void;
}

interface StaticRunManifest {
  readonly schemaVersion: 'tle-static-run-v1';
  readonly runId: string;
  readonly geometryRunId: string;
  readonly analysisRunId: string;
  readonly archiveId: string;
  readonly publicationSha256: string;
  readonly t0Utc: string;
  readonly durationS: 7200;
  readonly stepS: 30;
  readonly anchorCount: 241;
  readonly sourceSatelliteCount: number;
  readonly localPassPoolCount: number;
  readonly admittedSatelliteCount: number;
  readonly canonicalContractVersion: 'family-b-thesis-3.13-3.17-v1';
  readonly screeningRevision: string;
  readonly passPolicyRevision: string;
  readonly parameterSetSha256: string;
  readonly satelliteDictionary: BlobDescriptor;
  readonly ntpuExact: SurfaceManifest;
  readonly globalOverview: SurfaceManifest;
  readonly globalExact?: SurfaceManifest;
  readonly bootstrap: BootstrapDescriptor;
}

interface BlobDescriptor {
  readonly url: string;
  readonly sha256: string;
  readonly encodedBytes: number;
  readonly decodedBytes: number;
  readonly contentEncoding: 'br' | 'gzip' | 'identity';
}

interface SurfaceManifest {
  readonly surface: StaticSurface;
  readonly sampleAxis: 'exact-30s' | 'overview-coarse';
  readonly chunks: readonly ChunkDescriptor[];
  readonly readyUnit: 'complete-chunk';
}

interface ChunkDescriptor extends BlobDescriptor {
  readonly chunkId: string;
  /** Inclusive exact-run anchor range covered by this chunk. */
  readonly startAnchor: number;
  readonly endAnchor: number;
  readonly frameDigestByAnchor?: readonly string[];
}

interface BootstrapDescriptor extends BlobDescriptor {
  readonly anchorIndex: 0;
  readonly surfaces: readonly StaticSurface[];
}

interface StaticRunUpdate {
  readonly runId: string;
  readonly state: 'manifest-ready' | 'loading' | 'range-ready' | 'error' | 'aborted';
  readonly surface?: StaticSurface;
  readonly requested?: AnchorRange;
  readonly readyRanges: readonly AnchorRange[];
  readonly completedBytes: number;
  readonly totalBytes: number;
  readonly errorCode?: StaticRunErrorCode;
}

interface StaticRunSession {
  /** Fetch/decode/verify a complete chunk set covering the requested range. */
  ensure(request: StaticRangeRequest): Promise<Readonly<AnchorRange>>;

  /** Return a verified anchor, or null when its complete range is not ready. */
  read(surface: StaticSurface, anchorIndex: number): StaticSurfaceAnchor | null;
}

declare function openStaticRun(request: StaticRunRequest): StaticRunSession;
```

The actual type of `StaticSurfaceAnchor` is lane-specific:

```ts
interface SourceAnchorIdentity {
  readonly runId: string;
  readonly geometryRunId: string;
  readonly anchorIndex: number;
  readonly instantUtc: string;
  readonly tleFrameId: string;
}

interface NtpUExactAnchor extends SourceAnchorIdentity {
  readonly surface: 'ntpu-exact';
  readonly localStates: readonly LocalExactState[];
  /** An exact, read-only deserialization of the canonical frame. */
  readonly canonicalFrame: StaticCanonicalFrame;
}

interface GlobalOverviewAnchor extends SourceAnchorIdentity {
  readonly surface: 'global-overview';
  readonly sampleAxis: 'overview-coarse';
  readonly allSatellitePositionsTemeKm: Float32Array;
  readonly overviewSampleUtc: string;
  readonly displayOnly: true;
}

interface GlobalExactAnchor extends SourceAnchorIdentity {
  readonly surface: 'global-exact';
  readonly sampleAxis: 'exact-30s';
  readonly allSatellitePositionsTemeKm: Float32Array;
  readonly displayOnly: true;
}

type StaticSurfaceAnchor =
  | NtpUExactAnchor
  | GlobalOverviewAnchor
  | GlobalExactAnchor;
```

`LocalExactState` is sparse and source-time keyed:

```ts
interface LocalExactState {
  readonly satelliteIndex: number;
  readonly satelliteId: string;
  readonly anchorIndex: number;
  readonly instantUtc: string;
  readonly positionTemeKm: readonly [number, number, number];
  readonly velocityTemeKmPerSec: readonly [number, number, number];
  readonly visible: boolean;
  readonly passIds: readonly string[];
}
```

There is no `LocalExactState` for an arbitrary satellite merely to make a
matrix rectangular. A missing state is absent/null and is interpreted through
the pass-plan contract. `StaticCanonicalFrame` has the semantic fields needed
by the existing four projections (inputs, link/power/throughput/EE ledgers,
candidate status, provenance, and the run-local ratio-of-sums evaluation), but
its wire representation is compact columns. It is deserialization, not a new
formula. If a legacy consumer requires the existing
`SimulationAnalysisFrame` shape, a hidden adapter materializes only the
current anchor and does not store 241 giant object graphs.

### Interface invariants

- The manifest must state exactly `durationS = 7200`, `stepS = 30`, and
  `anchorCount = 241`; otherwise `openStaticRun` fails closed.
- `sourceSatelliteCount` and `admittedSatelliteCount` are measured build
  outputs. They are not inferred from the local pool count.
- `localPassPoolCount` is a manifest fact, not a prose estimate. A build gate
  records the actual count and the screening method that produced it.
- `runId` includes archive/publication identity, `t0Utc`, exact axis, pass and
  screening policy revisions, canonical contract version, and the parameter
  set identity. A change in any of these creates a new run identity.
- Every lane carries the same `runId`, `geometryRunId`, and source UTC axis.
  `surfaceDigest`/chunk hashes may differ. A lane cannot be joined to another
  run merely because the wall-clock timestamp happens to match.
- `global-overview` never contains or feeds a canonical EE result. Only
  `ntpu-exact` owns the canonical frame. `global-exact` is display geometry and
  may be used to cross-check a selected satellite, but it is not an alternate
  analysis producer.
- An anchor is visible to callers only after its whole chunk is verified. A
  decoded half-chunk, one valid satellite, or an HTTP response with a bad hash
  is not a ready anchor.

## Seam

The Seam is between build-time science and browser-time presentation.

Today, `buildTleRunBundle` and `buildTleAnalysisRun` can be reused as the
build-side science source. They must not be imported by the browser route for
this strategy. The bake command runs those authorities (or their extracted
equivalents) in Node/CI, writes the artifact, and then closes the seam with a
manifest hash. At runtime:

```text
archive catalog + selected publication + t0
  -> build-time SGP4 / pass / canonical EE
  -> content-addressed static manifest and lane chunks
  == browser staticRunArtifact.open ==
  -> Worker decode and verified ranges
  -> one exact NTPU anchor + optional global projection
  -> existing scene/result adapters
```

The controller still owns draft/apply state and decides whether a new run is
published over the current run. `staticRunArtifact` never mutates application
state and cannot let a stale request win. On Apply, the controller may clear
the current scene according to the existing product contract; the new session
publishes no data until its bootstrap has passed identity/hash validation.

The artifact manifest is a complete server-side run even while the browser is
hydrating it. Thus progressive client readiness does not mean a partial
scientific run was published. If an integration gate requires all 241 chunks
to be client-ready before any UI publication, the controller calls `ensure`
for the full range; that is a slower compatibility mode, not a different
scientific result.

## Adapter

### Build adapters

`TlePublicationAdapter` resolves one archive publication and one TLE pair per
admitted satellite using the current deterministic archive contract. It emits
the `publicationSha256`, TLE epochs, IDs, and source provenance used in the
run identity. It never merges adjacent publications.

`CoarseVisibilityAdapter` performs the first local screen in the build
worker. It propagates every admitted TLE with SGP4 at a coarse, common UTC
axis (for example, 120–300 seconds; the chosen value is a measured artifact
field, not an implicit assumption). It computes conservative observer
elevation/range bounds for the NTPU observer and retains any satellite whose
sampled visibility, horizon crossing, or uncertainty margin could intersect
the two-hour window.

The coarse pass is a candidate filter, not proof of absence. The builder must
either use a certified elevation-rate/error envelope or conservatively retain
the uncertain interval/satellite. If a bound cannot be certified, it runs a
full-catalog exact pass audit at build time and records that fact. It never
claims that a coarse grid proved that an omitted satellite was invisible.

`ExactLocalPassAdapter` propagates the measured candidate pool at all 241
30-second anchors, derives exact NTPU look angles, extracts actual AOS/peak/LOS
events, and expands/repeats the pool when a coarse uncertainty or boundary
crossing is found. The final `localPassPoolCount` is the actual union of
satellites that have a real visible/pass/candidate role or a truthful boundary
continuation. A threshold such as 1,024 is a build-budget guard, not a claim
that the pool is always small; the manifest reports the real number.

`CanonicalRunAdapter` evaluates the fixed seven-beam/100-UE canonical
scenario from exact selected geometry and writes one immutable frame per
anchor plus the 240-interval ratio-of-sums evaluation. Its outputs are stored
in `ntpu-exact` chunks. It does not consume global coarse positions.

`GlobalOverviewAdapter` stores all admitted IDs and positions at the chosen
coarse source times, with an explicit `overview-coarse` label. Optional global
exact chunks store all-object positions at exact 30-second anchors for an
on-demand viewport/inspection path. Neither adapter shifts an object in time
to make a pretty formation.

### Browser adapters

`StaticFetchAdapter` is Worker-only. It fetches the manifest/chunks, uses the
server's Brotli/gzip content encoding (or a Worker decompressor), verifies
SHA-256 over decoded bytes, and transfers validated buffers to the main
thread. It uses immutable hash URLs with long cache lifetimes. It does not
fetch arbitrary local files or depend on the build machine's TLE directory.

`StaticCanonicalAdapter` turns one `NtpUExactAnchor` into the existing
read-only result projections. It may normalize/deduplicate dictionaries, but
it may not call a channel, power, pass, or EE calculator. A frame digest and
the embedded contract version make accidental page-local recalculation
detectable.

`GlobalSceneAdapter` writes all-object overview/exact positions into an
instanced global scene with LOD and viewport culling. It receives no local
canonical fields. `NtpUSceneAdapter` reads selected/candidate/context states
from the same source-time exact anchor and projects TEME through the existing
Earth-fixed/NTPU look-angle display conversion. If that conversion or
interpolation is too expensive for a busy frame, it can run in the same
Worker; it is still display conversion, not SGP4 or analysis.

`TimelineReadyRangeAdapter` maps the session's per-surface ready interval set
to the controls. It marks only complete chunks as seekable and keeps playback
inside the highest contiguous ready range. A jump to a later, independently
ready chunk is allowed only as an explicit completed-range seek; playback does
not leap across an unready gap.

## Coarse-to-exact local screening

The local lane must not repeat the current pattern of retaining and scanning
10,760 full satellite states at every 241-anchor NTPU read. The bake uses this
ordered process:

1. Resolve and freeze the one source publication and all admitted TLE pairs.
2. Propagate all admitted satellites on a coarse **common UTC** axis with
   SGP4. Compute observer elevation/range and a conservative crossing margin.
3. Keep the union of satellites/intervals that can be above the horizon or
   meet the configured service mask, plus neighbors around sign changes and
   uncertain extrema. Record coarse sample count, mask, and margin.
4. Propagate that candidate pool at every exact 30-second anchor. Refine
   AOS/LOS/peak from real adjacent samples and build complete pass events.
5. If an exact result lands near a screening boundary, if an interval is not
   bracketed, or if an audit finds a possible missed pass, expand the pool and
   repeat steps 3–4. If no conservative certificate is available, perform a
   full-catalog exact pass audit offline before publishing the artifact.
6. Run the deterministic diversity/continuation planner only over the exact
   pool. The resulting selected serving and real candidate identities are
   stored per anchor; absent candidates remain null.
7. Build canonical EE only from the exact selected/candidate geometry and the
   fixed local scenario, then freeze all 241 frames and the 240 intervals.

The pool is expected to be much smaller than the constellation for an NTPU
observer, but the design deliberately does not write “tens” or “hundreds” as
a fact. The bake report and manifest must show, for the selected publication
and `t0`, for example:

```text
sourceSatelliteCount       = measured source count
admittedSatelliteCount     = measured post-TLE-validation count
coarseCandidateCount       = measured after conservative screen
localPassPoolCount         = measured exact union
exactPassCount              = measured extracted events
selectedPassCount           = measured planner output
candidateAnchorCount       = measured anchors with a real candidate
screeningAudit              = certified | full-catalog-exact | failed
```

If `screeningAudit = failed`, no local artifact is publishable. If the pool
grows beyond the intended transfer budget, the builder can still publish a
larger truthful local lane, or it can fail the selected artifact and request a
different source/time; it must not discard satellites merely to meet a size
target.

## Exact temporal semantics and no staggering

Every local row carries an `anchorIndex` and its actual `instantUtc`. A pass
window carries real AOS, peak, and LOS times derived from the exact samples.
The planner may choose an overlapping candidate only when it is simultaneously
visible and satisfies the recorded overlap/continuation policy.

No adapter may phase-shift a satellite, assign each satellite its own
“convenient” epoch, or repeat a single position over a fake service window.
Global overview decimation is also same-UTC: all objects at one overview
sample use the same source time, and an interpolated display value is clearly
an overview value. NTPU interpolation between two exact anchors uses the
adjacent position/velocity states for that same satellite at their actual
times. It never produces a new canonical analysis frame.

When a local pool satellite has no exact state at an anchor because it is not
visible, the state is absent. The selected service sequence must still provide
a real serving state at every anchor required by the run contract or the
artifact is rejected/marked unavailable. A candidate can be null. A global
overview marker may be present at that time, but it cannot be used to fill a
missing local candidate or to derive SINR, throughput, power, or EE.

## Depth

This is a deep Module because the application knows only `openStaticRun`,
`ensure`, and `read`; it does not know:

- whether a range is one file, several files, or a CDN object;
- whether the Worker uses Brotli, gzip, delta coding, or a future codec;
- whether local visibility was screened at 120 s or 300 s;
- how the local sparse pool is indexed;
- how global LOD is selected; or
- how stale requests and cache pressure are handled.

The narrow Interface places leverage at one truth boundary. A shallow design
would let each scene fetch JSON and select its own “best” satellite, which
would reintroduce independent clock, visibility, candidate, and formula
decisions. The deep Module instead returns one verified source identity and
one exact local frame to every consumer.

## Leverage

- **Main-thread cost:** all SGP4, coarse/exact pass work, canonical EE, binary
  decode, and hash verification leave the UI thread. The main thread only
  adopts typed buffers and updates bounded GPU instances.
- **Payload cost:** the NTPU lane scales with the measured local pass pool, not
  with 10,760 objects. The global default scales with coarse all-object LOD;
  exact global detail is on demand.
- **First paint:** a manifest, dictionary, and one-anchor bootstrap can paint
  a truthful first local/global view while later ranges download. No fake
  first frame is needed.
- **Repeat load:** hash-addressed chunks are reusable across sessions and
  parameter variants when `geometryRunId` matches. The manifest is the only
  short-lived object; immutable chunks can be cached for a year.
- **Cross-view truth:** the local canonical frame owns the analysis result;
  global lanes carry the same run/UTC identity but cannot become a second
  science producer.
- **Failure containment:** a corrupt or slow global exact chunk does not block
  an already-ready NTPU local range, and a missing candidate does not poison
  the global overview.

## Locality

Each `StaticRunSession` owns its `runId`, abort signal, ready-range index,
pending requests, and LRU buffers. A chunk key is
`(runId, surface, chunkId, codecVersion)`. There is no process-global current
run that a late Worker message can overwrite.

Each exact anchor is the smallest shared truth unit between views. The NTPU
scene, the four analysis panels, and any exact global comparison receive the
same `SourceAnchorIdentity`. They may create display-local projections, but
they cannot mutate or replace the canonical fields. A global overview anchor
has the same run identity and source-time mapping but an explicit display-only
surface and coarse sampling label.

The build artifact keeps provenance local to the run: archive ID, publication
hash, TLE epoch dictionary, `t0Utc`, policy revisions, screening report,
parameter hash, and codec/schema versions are in the manifest. No view has to
consult a hidden current date or a second TLE source.

## Ordering, error, and performance characteristics

### Ordering

1. `openStaticRun` validates the URL/request shape and starts a Worker; it
   does not synchronously parse a large payload or change the current scene.
2. The Worker fetches and validates the manifest, source identity, exact axis,
   and lane descriptors before fetching a range.
3. It fetches the dictionary plus bootstrap, verifies decoded-byte hashes,
   validates dimensions and frame IDs, and emits the first ready ranges.
4. `ensure` maps an inclusive request to complete chunk descriptors, first
   using the browser/CacheStorage cache, then fetching only misses. At most a
   small bounded number of chunks is in flight.
5. A chunk is atomically promoted from `downloading` to `ready` only after all
   sections decode, all anchors have the advertised shape, and every anchor
   references the manifest `runId` and expected UTC axis.
6. `read` is O(1) over the ready chunk index. It returns an existing typed
   view or `null`; it never waits, fetches, calls SGP4, or computes EE.
7. `onUpdate` is coalesced per task/frame, not emitted once per satellite, so
   progress cannot flood React or the render loop.

### Errors and stale work

```ts
type StaticRunErrorCode =
  | 'MANIFEST_INVALID'
  | 'SCHEMA_UNSUPPORTED'
  | 'RUN_ID_MISMATCH'
  | 'AXIS_MISMATCH'
  | 'CHUNK_HASH_MISMATCH'
  | 'CHUNK_SHAPE_INVALID'
  | 'NETWORK'
  | 'RANGE_NOT_READY'
  | 'ABORTED'
  | 'SCREENING_UNCERTIFIED';
```

`ensure` rejects with a typed error for a requested range; it never resolves
with a partial range. A hash failure quarantines the cache entry and retries
the one chunk. A network failure leaves previously ready chunks usable. A
newer session or aborted signal causes late Worker responses to be ignored by
`runId`/request token. The controller keeps the old accepted run only when
its product state policy permits it; it never displays an old frame under the
new run identity.

### Slow-network behavior

- The interactive shell, camera controls that do not require data, and honest
  loading/error copy render before the artifact completes.
- If the bootstrap succeeds, only its complete range is seekable. The local
  playhead stops at the highest contiguous ready anchor and requests the next
  chunk; it does not advance into a hole or synthesize a frame.
- A direct jump requests its target chunk. Until that chunk is complete, the
  seek target is disabled/marked buffering. If the target later succeeds, its
  completed range is seekable even when an earlier range is still missing;
  playback does not cross the gap.
- If local exact data is ready but global exact data is slow, NTPU analysis and
  results remain live while global stays at its coarse LOD. Conversely, a
  global overview failure does not invent NTPU data.
- Retry/backoff and a small two-chunk prefetch window run in the Worker. No
  retry loop blocks render or input handling.

### First and repeat load

The first request is manifest + dictionary + one-anchor bootstrap. The
bootstrap is deliberately not a full 8-anchor range: a typical budget is
`<=256 KiB` compressed for local metadata, the selected/candidate local
state, canonical frame, and the first global overview sample. The UI can
show a verified first frame without waiting for all 241 anchors.

Repeat loads use immutable hash URLs and `Cache-Control: public,
max-age=31536000, immutable` for chunks. A normal HTTP cache is sufficient;
an optional CacheStorage layer can retain chunks across service-worker
lifetimes. Decoded chunks are an in-memory LRU, not an unbounded retained
copy. A cache miss re-downloads only the missing lane/range.

## Hidden implementation

### Build-time artifact layout

```text
public/tle-runs/<runId>/
  manifest.json                 # small; can be revalidated
  dictionary.bin.br             # IDs, names, TLE epochs, source refs
  bootstrap.bin.br              # exact local anchor 0 + overview anchor 0
  ntpu/r000-0007.bin.br        # local sparse states + canonical frames
  ntpu/r0008-0015.bin.br
  ...
  global-overview/g000-0024.bin.br   # all objects at common coarse UTCs
  global-exact/x0000-0007.bin.br     # optional, all-object positions
  ...
```

The builder writes to a temporary directory, verifies every chunk and the
cross-file manifest, and renames/publishes the manifest last. A manifest
cannot advertise a chunk that is not present and hash-verified. Hash URLs
may be a subdirectory or a filename suffix; the Module does not depend on
either convention.

Each range binary has a fixed header containing schema, surface, run ID hash,
inclusive anchor bounds, satellite/index counts, UTC axis offsets, and section
offsets. The sections are columnar/typed rather than nested per-satellite
JSON. Local sparse rows carry `(satelliteIndex, anchorIndex)` and do not fill
non-visible slots. Canonical arrays are stored in a stable order with a
dictionary for repeated IDs and provenance strings.

The full-resolution global lane uses positions for all objects and can omit
velocities except for the display-selected set. The local lane stores exact
position/velocity for the measured pass pool. If a future scene requires all
global velocities, that is an explicit larger `global-exact` variant; it is
not silently added to the NTPU payload.

### Browser Worker and memory

The Worker owns fetch, decompression, SHA-256, header/shape validation, and
binary decode. The main thread receives transferable buffers (no
`SharedArrayBuffer` or cross-origin-isolation requirement) and creates views
for one current anchor. The main thread never receives or parses a giant
JSON object graph.

The recommended cache budget is bootstrap plus two or three local chunks and
one global overview/exact chunk. An 8-anchor global exact chunk containing
all-object `Float32` positions is about:

```text
10,760 satellites * 8 anchors * 3 coordinates * 4 bytes
= 1,032,960 bytes (about 0.99 MiB), before headers/compression.
```

Eight anchors keeps slow-network retries bounded while giving roughly four
minutes of exact playback per chunk. Sixteen anchors halves request count but
roughly doubles the retry unit; the artifact manifest can choose the value
after measured transfer tests. The NTPU chunk size should be chosen from the
measured local pool and target compressed bytes, not from the full catalog.

## Payload estimate and partition strategy

These are planning estimates; the bake report is the authority. The existing
124,471,680-byte private `Float64` full position+velocity buffer is the exact
baseline. The static artifact deliberately does not ship that buffer as the
first local payload.

| Lane | Default content | Raw-size formula/order | Transfer behavior |
| --- | --- | --- | --- |
| `ntpu-exact` | exact states for measured pool + 241 canonical frames | `poolCount * 241 * 6 * 4` bytes for F32 display position/velocity, plus roughly 5–25 MiB for compact full canonical columns depending on diagnostics retained | bootstrap first; 8–16 anchor chunks; only real pass/candidate rows |
| `global-overview` | all IDs + coarse same-UTC positions | at 5-minute samples: `10,760 * 25 * 3 * 4 = 3,228,000` bytes before metadata; at 2-minute samples: about 7.9 MB | small LOD lane, first load; explicitly display-only |
| `global-exact` | all-object exact positions, no analysis | `10,760 * 241 * 3 * 4 = 31,117,920` bytes for F32 positions; 8-anchor chunk about 0.99 MiB | on demand, viewport/inspection, independently cacheable |
| full exact all-state fallback | all-object position + velocity | `10,760 * 241 * 6 * 4 = 62,235,840` bytes F32; current F64 baseline is 124,471,680 bytes | never part of first local load; only an explicit global detail variant |

For the local lane, each retained pool satellite costs 5,784 bytes for 241
anchors of F32 position+velocity before compression: 64 satellites is about
0.35 MB, 256 about 1.41 MB, and 512 about 2.95 MB. Those values are not
predictions of the pool; the manifest records the actual measured count.
Canonical frames should retain full UxB matrices and ledger fields needed by
the four projections, but use typed columns and dictionary references so
repeated metadata is not serialized 241 times. A first bake should report the
actual encoded/decoded bytes and numeric parity rather than relying on this
estimate.

The recommended partition is:

- one manifest/dictionary;
- one exact local bootstrap and exact local chunks in 8–16-anchor ranges;
- one coarse global overview bootstrap/chunk set; and
- optional exact global chunks in the same 8–16-anchor range convention.

The local and global chunks may have different boundaries and codecs. The
cross-lane join key is `(runId, anchorIndex, instantUtc, tleFrameId)`, not a
shared URL or a shared byte offset.

## Usage example

```ts
const session = openStaticRun({
  manifestUrl: `/tle-runs/${runId}/manifest.json`,
  signal: requestAbort.signal,
  onUpdate: update => dispatch({ type: 'static-run-update', update }),
});

// `ensure` is the only operation that may fetch. The Worker resolves the
// bootstrap and returns only after the requested complete range is verified.
await session.ensure({ surface: 'ntpu-exact', start: 0, end: 7 });
await session.ensure({ surface: 'global-overview', start: 0, end: 7 });

const local = session.read('ntpu-exact', 0);
const overview = session.read('global-overview', 0);
if (local === null || overview === null) {
  // This is a loading state, not a permission to synthesize a frame.
  return renderDataPendingShell();
}

if (local.runId !== overview.runId || local.instantUtc !== overview.instantUtc) {
  throw new Error('cross-surface source identity mismatch');
}

// Both adapters consume the same source anchor identity. The global adapter
// is display-only; the NTPU adapter is the sole canonical analysis consumer.
const ntpu = adaptNtpUScene(local);
const global = adaptGlobalOverviewScene(overview);
publishAtomically({
  runId: local.runId,
  anchorIndex: local.anchorIndex,
  ntpu,
  global,
  canonical: local.canonicalFrame,
});

// Later, an exact global chunk can be requested for inspection without
// replacing the NTPU payload or recalculating its analysis.
await session.ensure({ surface: 'global-exact', start: 64, end: 71 });
const exactGlobal = session.read('global-exact', 64);
```

The `adapt*` functions above are dependency adapters outside the Module. They
must not call `ensure` implicitly during render. If an exact adjacent anchor
is not ready, the timeline shows buffering or freezes at the last ready anchor.

## Performance characteristics

### First load

The shell and static controls can render while the manifest is pending. The
first truthful data response is the verified bootstrap, not a synthetic
Walker frame. A bootstrap is one exact local anchor and one common-UTC global
overview sample; it is sized for a small request rather than an 118 MiB
in-memory run. The canonical result rail and NTPU scene can become visible at
that anchor without waiting for all 241 chunks.

### Repeat load

The same `runId` resolves the same immutable hash URLs. Browser HTTP cache or
CacheStorage supplies the bootstrap/chunks without rebuilding TLE state. A
new parameter set or screening/pass policy has a new `runId` and cannot
accidentally reuse an old canonical frame. Geometry chunks may be shared by
analysis variants only when their `geometryRunId` and frame digest agree.

### Interactive playback

The render loop reads only a completed anchor/chunk and uploads bounded scene
buffers. It does not wait on a Promise, parse JSON, or run an SGP4 step. A
one-second visual scrub may interpolate selected/candidate display geometry
between adjacent completed exact anchors, but the four canonical panels stay
on the lower 30-second frame. Global overview interpolation is similarly
display-only and labelled coarse.

### Memory

With 8-anchor chunks, the global exact lane is about 1 MiB raw per chunk for
positions, while a local chunk scales with the actual pass pool. Retaining
three chunks plus a small canonical object is bounded and predictable. An LRU
may evict a completed chunk; after eviction, that range becomes not-ready for
the current session until reloaded, and the UI must not treat an evicted
anchor as available from a stale pointer.

## Monolithic JSON comparison

| Concern | Monolithic JSON download | StaticRunArtifact |
| --- | --- | --- |
| First frame | waits for the whole response and then main-thread JSON parse/GC | manifest + verified bootstrap; shell remains interactive |
| Current full geometry | 15,558,960 position/velocity scalars become a very large text/object graph; 200–400 MB text is plausible before metadata | local payload is pool-sized; all-object global data is coarse or on demand |
| Threading | parse and any fallback analysis contend with rendering; SGP4 is easy to accidentally reintroduce | Worker fetch/decode/hash; no browser SGP4/analysis |
| Seekability | all-or-nothing unless bespoke range semantics are added | complete chunk interval set; gaps are visibly unseekable |
| Retry | one corrupt/slow response retries the whole object | one immutable chunk can retry without losing ready ranges |
| Cache reuse | one giant cache entry; a small change invalidates everything | geometry, overview, and local/analysis chunks can be reused by identity |
| Cross-view truth | each consumer may select/dereference different nested records | every exact anchor carries one run/frame identity and one canonical frame |
| Dynamic parameters | can hide many variants in an even larger file, or compute in browser | parameter set is in run identity; bake variants or use a separate Worker path |
| Implementation effort | low initial schema effort | higher builder, manifest, codec, Worker, and readiness gates |
| Debuggability | human-readable but too large to inspect safely | binary needs tooling, but hashes and chunk fixtures are deterministic |

HTTP compression can shrink monolithic JSON bytes, but it does not remove the
main-thread parse/object-allocation pause or make an incomplete response
truthfully seekable. A monolithic binary file would improve parse cost but
would still lose the bootstrap, lane separation, per-range retry, and cache
locality that motivate this Module.

## Trade-offs and limits

### Benefits

- Keeps scientific computation in one build authority and makes the browser a
  deterministic reader.
- Makes NTPU transfer proportional to actual local visibility rather than the
  global constellation.
- Keeps a useful all-object global context without pretending that coarse LOD
  positions are canonical link inputs.
- Degrades honestly on slow or broken networks and does not freeze input or
  the 3D shell.
- Allows repeat loads and analysis-parameter variants to share geometry by
  content identity.

### Costs

- The build now has a screening certificate/audit and a new binary artifact
  schema to maintain.
- A conservative screen can retain more satellites than hoped, and a failed
  certificate must fall back to a full exact build or refuse publication.
- Static canonical parameter edits require prebaked parameter variants. If
  arbitrary UI edits remain mandatory, a separate Worker-only canonical
  recompute path must be explicitly designed; the static Module must not hide
  a main-thread fallback.
- Binary codec changes require schema versioning and fixture parity. A
  dictionary/hash mismatch is a hard error, not a best-effort repair.
- Global exact inspection can still be large. LOD/on-demand fetch is a
  product choice, not a claim that 10,760 exact states are free.
- Coarse global visualization is not a replacement for exact local analysis;
  labels and provenance must make that boundary visible.

## Verification gates

### Bake gates

- the selected archive/publication, TLE pair set, `t0Utc`, and run identity
  are deterministic;
- the exact axis has 241 anchors and one common UTC timestamp per anchor;
- coarse-to-exact screening records measured counts, margins, and either a
  certificate or a full-catalog exact audit;
- every retained local pass/candidate has actual exact AOS/peak/LOS evidence;
- no satellite row has a shifted epoch or synthetic continuity interval;
- selected serving states exist at every required anchor, and absent
  candidates are null/unavailable;
- canonical frozen cases match the approved Family-B runtime and the run
  evaluation uses 240 intervals with ratio-of-sums;
- all chunk hashes, dimensions, frame digests, and cross-lane identities
  validate before the manifest is published; and
- a full exact all-object build remains available as a safety oracle for
  screening-regression tests, even if it is not shipped to the first browser
  request.

### Browser gates

- the production bundle does not import `satellite.js`, pass extraction, or
  canonical EE producer code on the static route;
- a fresh load shows the shell before the artifact completes and never blocks
  the main thread on a large JSON parse;
- `read` returns null for every unverified/incomplete range;
- timeline seek/playback never crosses a missing chunk or creates a frame;
- NTPU scene, four result views, and exact global comparison reject mismatched
  `(runId, anchorIndex, instantUtc, tleFrameId)` identities;
- global overview is visibly labelled as coarse/display-only and cannot feed
  analysis panels;
- offline cache replay and slow-network retry preserve ready ranges and do
  not freeze the UI;
- a corrupt chunk fails closed and retries only that chunk; and
- first and repeat loads use the same artifact hashes and show the same
  selected/candidate identities and canonical frame digest.

## Non-goals

- No energy-saving policy, baseline/candidate savings claim, or Phase-1 upload.
- No live telemetry or orbit measurement claim; the source remains archived
  TLE-derived SGP4.
- No per-satellite temporal staggering, phase shifting, or synthetic pass
  continuation.
- No promise that the local pool is always “tens” or “hundreds”; only the
  measured manifest value is authoritative.
- No monolithic full-run JSON fallback hidden behind a loading screen.

