# Selectable TLE pass-indexed run SDD

Status: **Active staged implementation contract; product switchover blocked on
the ADR-010 completion gate**  
Date: 2026-08-16  
Authority: `docs/decisions/ADR-010-snapshot-pass-index-run-architecture.md`  
Scientific authority: ADR-005 plus external ADR-003 for canonical EE algebra

## 1. Purpose

This SDD replaces the product execution path that propagates the entire
selected catalog at all 241 anchors before determining which satellites can
serve NTPU. It introduces a snapshot-aware pass/event index and separates two
browser payload views:

* **global**: full-constellation context as a lightweight current frame or
  requested LOD; and
* **NTPU local**: exact visibility, real pass events, serving/candidate
  sequence, canonical SINR/Power/Throughput/EE, and the immutable frame set for
  the requested window.

The two views share a content-addressed run identity and source provenance, not
necessarily the same browser payload. The public product still publishes one
accepted run atomically. Internal chunks may be prepared progressively, but the
public timeline remains locked until the full requested NTPU window is ready.

This SDD does not authorize a handover/beam policy, an energy-saving claim, a
calibrated RF scenario, or a platform upload.

## 2. Existing contract and narrow migration boundary

ADR-005 remains authoritative for:

* deterministic archive/publication and explicit UTC selection;
* one frozen publication and resolved TLE pair per admitted source record;
* the canonical `theta -> gain -> h -> gamma_req -> p_req -> cap -> actual
  power -> interference -> SINR -> rate -> power ledger -> EE` chain;
* one immutable frame identity for the four formal result projections;
* 241 common 30-second NTPU analysis anchors and 240 EE intervals; and
* fail-closed, atomic publication and no fabricated fallback.

ADR-010 supersedes only the dense execution mechanics of materializing every
resolved catalog object at every 241 anchors as the normal visibility/pass
path. The existing dense implementation remains a test-only baseline until
the zero-missed-visible-satellite gate passes on real Starlink and OneWeb
fixtures.

Current evidence of the mechanics being replaced:

* `src/tle/run/index.ts:555-616` resolves all snapshot IDs, allocates against
  the complete source set, and loops every source record at every anchor;
* `src/tle/run/index.ts:711-728` then compacts the full surviving set; and
* the current handoff records approximately 10,760 Starlink objects at 241
  anchors and 118.71 MiB of private arrays
  (`docs/handoff/LEO-SIM-CURRENT-HANDOFF-2026-08-11.md:260-265`).

The exact catalog count varies by snapshot. No design or implementation may
turn that observed count into a hardcoded shortlist size.

## 3. Terminology and identity model

### 3.1 Request identity

```ts
interface SelectableRunRequest {
  readonly archiveId: 'starlink' | 'oneweb';
  readonly publicationSha256: string;
  readonly requestedT0Utc: string;
  readonly observerId: string;
  readonly observerCoordinates: {
    readonly latitudeDeg: number;
    readonly longitudeDeg: number;
    readonly altitudeM: number;
  };
  readonly visibilityPolicyRevision: string;
  readonly coarseIndexRevision: string;
  readonly exactSgp4Revision: string;
  readonly canonicalScenarioRevision: string;
  readonly parameters: CanonicalEeInputs;
}
```

`sourceSnapshotDigest` is computed from the resolved, byte-exact records in the
frozen publication. `runKey` is a content hash over the request identity,
source snapshot digest, fixed duration/step, observer, policy, and model
revisions. A new source publication, observer, mask, algorithm, or parameter
condition produces a new identity.

Parameter-only rebuilds may reuse `sourceSnapshotDigest`, geometry identity,
and `passIndexKey` when the parameter change cannot affect visibility or pass
selection. They must publish a distinct `analysisRunId` and new canonical frame
IDs. Changes to observer, visibility policy, requested UTC, publication, or
exact model require a new pass index.

### 3.2 Shared identity, distinct payloads

```ts
interface AcceptedRunManifest {
  readonly schema: 'selectable-tle-pass-index-run-v1';
  readonly runKey: string;
  readonly geometryRunId: string;
  readonly analysisRunId: string;
  readonly passIndexKey: string;
  readonly sourceSnapshotDigest: string;
  readonly requestedT0Utc: string;
  readonly durationS: 7200;
  readonly stepS: 30;
  readonly anchorCount: 241;
  readonly status: 'accepted';
  readonly globalPayload: GlobalPayloadDescriptor;
  readonly ntpuPayload: NtpuPayloadDescriptor;
  readonly provenance: RunProvenance;
}
```

`globalPayload` and `ntpuPayload` are independent descriptors. A global frame
may be geometry-only and have no canonical link/EE values. An NTPU frame may be
small because it contains only the exact confirmed pool and the local service
projection. When both refer to an anchor, their `frameRef` contains the same
`runKey`, `geometryRunId`, `analysisRunId`, `anchorIndex`, `instantUtc`, and
canonical `frameId`. This is a provenance join, not a requirement to send
identical bytes to the browser.

## 4. Modules and seams

The route-facing session remains the single owner of accepted/pending state.
The following modules are internal seams behind that session:

| Module | Owns | Must not own |
|---|---|---|
| `SnapshotResolver` | one publication, source record digests, UTC/source receipt | pass decisions or display fallback |
| `CoarseVisibilityIndex` | conservative catalog-to-observer candidate classification | canonical SINR/EE or exact pass claims |
| `ExactVisibilityConfirmer` | exact SGP4 geometry for the measured candidate pool | global animation timing |
| `PassEventIndex` | exact AOS/peak/LOS events, anchors, pool provenance | synthetic temporal offsets |
| `NtpUCanonicalRun` | local serving/candidate trace, immutable canonical frames, EE | global object rendering |
| `GlobalFrameProvider` | current-anchor/all-catalog geometry and declared LOD | NTPU service/EE results |
| `RunPublicationController` | cache identity, cancellation, complete-window gate, atomic publication | formulas or React state shape |
| `PayloadAdapter` | artifact, server/chunk, or Worker transport | source-specific scientific semantics |

The only transport seam is:

```ts
interface RunPayloadAdapter {
  resolve(request: SelectableRunRequest, signal?: AbortSignal): Promise<RunPlan>;
  loadGlobal(
    plan: RunPlan,
    request: GlobalFrameRequest,
    signal?: AbortSignal,
  ): Promise<GlobalFramePayload>;
  loadNtpU(
    plan: RunPlan,
    request: NtpuRangeRequest,
    signal?: AbortSignal,
  ): Promise<NtpuRangePayload>;
}
```

Concrete adapters may be static default artifact, HTTP/server chunks, browser
cache, or a Worker using the same neutral TLE/canonical producer revision. The
route does not know which adapter supplied a verified payload.

## 5. Run pipeline

### 5.1 Phase 0 — resolve and freeze the snapshot

1. Validate the checked-in archive manifest and requested UTC.
2. Select one publication according to ADR-005's newest-prior rule.
3. Resolve one source TLE pair per admitted record, preserving source path,
   epoch, satellite identity, and content digest.
4. Produce `SnapshotReceipt` and `sourceSnapshotDigest`.
5. Refuse if the publication, record age, or source digest is invalid.

Snapshot resolution may inspect catalog metadata for all records. It must not
be interpreted as exact propagation of all records at all anchors.

### 5.2 Phase 1 — conservative coarse shortlist

`CoarseVisibilityIndex` evaluates each resolved source record against the NTPU
observer and requested window using a conservative envelope. Its input is the
real requested UTC axis and source metadata; it never adds a per-satellite
time offset. It emits time-local chunk membership so exact work scales with
the satellites relevant to each range rather than the union of every
satellite that may appear anywhere in the two-hour window.

The index may use coarse time bins, orbital-plane/period metadata, an
observer-horizon envelope, and a declared numerical safety margin. For each
record it emits:

```ts
type CoarseDisposition =
  | { readonly kind: 'candidate'; readonly reason: string }
  | { readonly kind: 'uncertain'; readonly reason: string }
  | { readonly kind: 'excluded'; readonly proof: string };
```

`candidate` and `uncertain` records enter the exact pool. Only an explicit
`excluded` proof may remove a record. There is no `take(N)`, fixed pool size,
or silent truncation. If the index cannot prove exclusion, it over-includes.

The published index reports the actual measured pool:

```ts
interface CoarseIndexReceipt {
  readonly catalogRecordCount: number;
  readonly chunks: readonly {
    readonly startAnchor: number;
    readonly endAnchor: number;
    readonly candidateIds: readonly string[];
  }[];
  readonly candidateUnionIds: readonly string[]; // diagnostics only
  readonly uncertainIds: readonly string[];
  readonly excludedIds: readonly string[];
  readonly candidateCount: number;
  readonly policyRevision: string;
  readonly safetyMargin: Readonly<Record<string, number>>;
}
```

### 5.3 Phase 2 — exact SGP4 confirmation

`ExactVisibilityConfirmer` runs each measured chunk candidate only at that
chunk's exact common 30-second anchors. For every candidate membership and
anchor it derives the observer topocentric azimuth, elevation, range, and
visibility under the declared mask. A declared overlap provides neighboring
real samples for AOS/LOS refinement. Overlap samples are deduplicated by
`satelliteId + anchorUtc`; pass fragments are stitched only across matching
real source boundaries. Across all chunks, the published axis still contains
exactly the same 241 UTC anchors as the dense baseline.

The result is an immutable `ExactVisibilityPool`:

```ts
interface ExactVisibilityPool {
  readonly exactConfirmedIds: readonly string[];
  readonly exactConfirmedIdsByChunk: readonly (readonly string[])[];
  readonly visibleIdsByAnchor: readonly (readonly string[])[];
  readonly samplesBySatellite: Readonly<Record<string, readonly ExactLinkSample[]>>;
  readonly anchorTimesUtc: readonly string[]; // exactly 241 common values
  readonly exactModelRevision: string;
}
```

The pool is allowed to be larger than the eventual service/pass set. It must
not be smaller than the real visible population. If a coarse miss is found by
the dense-baseline gate, the index expands its margin/time resolution and
repeats. If the result still cannot be proven complete, the run is unavailable.

### 5.4 Phase 3 — exact pass/event index

`PassEventIndex` consumes the exact pool and existing pass extraction/planning
semantics. It emits complete events with:

```ts
interface ExactPassEvent {
  readonly eventId: string;
  readonly passId: string;
  readonly satelliteId: string;
  readonly aosUtc: string;
  readonly peakUtc: string;
  readonly losUtc: string;
  readonly aosTimeSec: number;
  readonly peakTimeSec: number;
  readonly losTimeSec: number;
  readonly aosAnchorIndex: number;
  readonly peakAnchorIndex: number;
  readonly losAnchorIndex: number;
  readonly maxElevationDeg: number;
  readonly sourceSnapshotDigest: string;
}
```

The existing pass contract already preserves real AOS/peak/LOS source times
and anchor indices (`src/tle/pass/types.ts:106-137`). The new index must carry
those fields through caching and payload packing. A pass event is never created
from a visual marker, a candidate-only frame, a snapshot switch, or a fake
time offset.

## 6. NTPU exact analysis payload

`NtpUCanonicalRun` consumes the exact visibility pool and pass/event index. It
selects real serving/candidate identities according to the accepted pass/TTT
contracts, then materializes the canonical seven-beam/100-UE analysis frame
for each of the 241 anchors. It retains the current scientific boundary:

* all derived SINR, power, Throughput, and EE values come from the same
  immutable frame;
* evaluation EE is delivered bits divided by consumed joules over 240
  intervals;
* the current seven-beam scenario remains one serving-satellite owner with
  derived `I_inter = 0`; and
* local cell geometry remains the documented uncalibrated experiment substrate,
  not a TLE-derived physical footprint.

The exact pool and pass index are part of the NTPU provenance, but they are not
sent as global scene objects unless a caller explicitly requests them.

## 7. Global full-constellation overview payload

Global is a separate view of the same accepted run, not a second local
analysis. Its base index contains all source identities and static metadata.
Its temporal payload is selected by request:

```ts
interface GlobalFrameRequest {
  readonly runKey: string;
  readonly anchorIndex: number;
  readonly lod: 'overview' | 'full-current';
}

interface GlobalFramePayload {
  readonly frameRef: FrameRef;
  readonly objectIds: readonly string[];
  readonly positionTemeKm: readonly number[];
  readonly visibility: readonly ('above-horizon' | 'below-horizon' | 'unknown')[];
  readonly lod: 'overview' | 'full-current';
  readonly sourceSnapshotDigest: string;
}
```

`full-current` may contain one exact current-anchor state for every source
record. `overview` may use a declared spatial LOD/instancing projection. Neither
mode requires a full `catalog-size × 241` browser buffer. The provider may load
one current global frame on demand, then retain only current/adjacent frames in
its cache.

Global payloads do not expose local `P_DL_actual`, SINR, rate, or EE as if they
had been evaluated for every global object. Those values are read from the
NTPU canonical frame only. If the corresponding NTPU frame is not loaded, the
field is unavailable.

## 8. Real temporal scheduling

Any global prefetch, event rail, guided story, or capture schedule uses a
`RealTimeMarker` derived from an exact pass/event:

```ts
interface RealTimeMarker {
  readonly eventId: string;
  readonly sourceUtc: string;
  readonly sourceTimeSec: number;
  readonly anchorIndex: number;
  readonly kind: 'aos' | 'peak' | 'los' | 'handover-decision';
}
```

It may group network work around real AOS/peak/LOS windows. It must not compute
`sourceTimeSec + satelliteIndex * offset`, use a modulo animation clock, or
invent an event when no exact marker exists. The visual clock can interpolate
between adjacent completed SGP4 positions, but quantitative labels remain tied
to the identified canonical anchor.

## 9. Publication and seek state

The internal state machine is:

```text
idle
  -> snapshot-resolving
  -> coarse-indexing
  -> exact-confirming
  -> pass-indexing
  -> ntpu-canonical-building
  -> payload-packaging
  -> accepted
```

Any phase may end in `cancelled`, `stale`, `unavailable`, or `failed` without
publishing partial evidence. Internal progress may expose counts and private
chunk readiness to diagnostics/cache warming, but the public state remains:

```ts
type PublicTimelineState =
  | { readonly kind: 'locked'; readonly reason: string }
  | { readonly kind: 'ready'; readonly runKey: string; readonly range: AnchorRange };
```

`ready` is allowed only after all 241 NTPU canonical anchors, pass/event
index, serving availability, and the 240-interval EE evaluation are valid.
There is no public partial-seek UX in this SDD. Before acceptance, Apply clears
the visible replacement scene/result/timeline according to the existing
contract; a stale or failed request cannot win. After acceptance, a global
current frame can be requested on demand without changing the accepted NTPU
run.

The public timeline must not seek to an anchor solely because its global frame
arrived. A target is seekable only when the accepted NTPU run and its required
frame identity are ready.

## 10. Content-addressed artifacts and adapters

### 10.1 Default artifact

The default artifact contains:

* `RunManifest` and all source/publication/model digests;
* the snapshot-aware pass-index receipt and exact event list;
* the first accepted NTPU canonical range or a compact reference to it;
* a global object index and first current global frame/LOD; and
* immutable descriptors for later NTPU ranges and global current-frame chunks.

It does not serialize functions, arbitrary filesystem paths, or the entire
`TleRunBundle`. Missing, stale, malformed, or digest-mismatched artifacts fail
closed. A static artifact is a cache accelerator, not a scientific authority
separate from the neutral TLE/canonical producer.

### 10.2 Server adapter

The server adapter may expose:

```text
POST /runs/prepare
GET  /runs/{runKey}/manifest
GET  /runs/{runKey}/pass-index
GET  /runs/{runKey}/global/{anchor}/{lod}
GET  /runs/{runKey}/ntpu/{range}
POST /runs/{runKey}/cancel
```

The server cache keys every response by `runKey`, `passIndexKey`, view, LOD,
and anchor/range. It computes one snapshot-aware plan, coalesces identical
requests, validates digests, and publishes the manifest only after the complete
NTPU window passes the gate.

### 10.3 Worker adapter

The Worker fallback uses the same neutral source resolver, coarse index,
exact-SGP4 confirmer, pass index, and canonical producer revision. It may keep
the browser interactive by yielding and transferring typed-array buffers. It
must not silently switch to the legacy Walker runtime, a page-local formula,
or a fake global time schedule. If producer/model parity cannot be proven, it
returns an explicit unavailable error.

### 10.4 Recommended delivery mode

The default academic deployment uses the hybrid path defined by this SDD:

* the default artifact supplies the pass-index receipt, first accepted NTPU
  range, and first global current-frame/LOD without waiting for a cold server;
* later NTPU ranges and global current frames use immutable cache/server chunks;
  and
* the Worker runs the same snapshot-aware coarse-to-exact pipeline only as a
  bounded fallback for custom dates or unavailable server data.

A server-only adapter may replace the artifact/Worker source for a maintained
multi-user deployment. It must satisfy this SDD's exact-pool, identity, digest,
publication, and no-fabrication contracts. The adapter choice must never be
observable as a different scientific result.

## 11. Parameter and source changes

* `P_beam_max`, `P_sat_max`, noise, reuse, channel, service-target, and other
  canonical EE parameters create a new `analysisRunId` and recompute NTPU
  canonical frames/evaluation.
* Geometry, snapshot, observer, exact pass policy, and pass-index identity may
  be reused only when their key inputs are unchanged.
* A parameter-only rebuild must not re-run coarse/exact visibility merely
  because the EE values changed, but it must retain the pass-index receipt and
  prove `geometryRunId` equality.
* A date, constellation, publication, observer, visibility mask, or model
  revision change invalidates the pass index and starts a new source request.
* Global LOD changes are presentation/payload requests; they do not create a
  new canonical analysis run unless they alter an identity-bearing model
  revision.

## 12. Completion and performance gate

The optimized index is not accepted on speed alone. The report must contain
both correctness and resource measurements.

### 12.1 Dense-baseline correctness

For at least one real archived Starlink publication and one real archived
OneWeb publication, record the fixture IDs and SHA-256 digests. For each:

1. run the existing dense all-catalog path as a validation baseline;
2. record `visibleIdsByAnchor` and exact pass/event times from that baseline;
3. run the coarse-to-exact path with the same UTC axis, observer, mask, and
   source publication;
4. assert `denseVisibleIdsByAnchor - exactVisibleIdsByAnchor` is empty for all
   241 anchors;
5. compare AOS/peak/LOS and selected pass identities under declared tolerances;
6. report false-positive candidate count separately; and
7. write a machine-readable report containing `missedVisibleIdsByAnchor`,
   `coarseCandidateCount`, `exactConfirmedCount`, and all policy/model digests.

Zero missed visible satellites is a hard gate. A nonzero miss is a refusal even
when the selected serving satellite happens to remain unchanged.

### 12.2 Cold/warm time and RSS

Report wall time and peak resident memory separately for:

* source/snapshot resolution;
* coarse shortlist;
* exact SGP4 confirmation;
* pass extraction and service planning;
* NTPU canonical frame/EE build; and
* global payload and NTPU payload packing.

`cold` means a fresh process/Worker with no pass-index or payload cache for the
fixture. `warm` means an immediate repeated request with the same immutable
key and populated cache. The report records host/Node/browser version, cache
state, fixture digests, wall-clock method, and peak RSS method. No unmeasured
performance claim is accepted; dense-baseline and optimized numbers are
reported side by side.

### 12.3 Public behavior

Browser validation must prove:

* default artifact/cache warming does not require all global anchors before
  the shell becomes interactive;
* the public timeline remains locked while the requested NTPU window is
  incomplete, even if internal/global chunks are ready;
* after acceptance, global current-frame/LOD and NTPU local payloads retain the
  same run/frame identity where they overlap;
* a stale/cancelled request cannot publish a new frame or event rail; and
* all event markers and any temporal staggering trace to exact real UTC pass
  events, with no synthetic per-satellite offset.

## 13. Migration map

1. Keep the current dense `TleRunBundle` path behind a named baseline adapter
   and freeze its output as the correctness oracle.
2. Add snapshot digest and time-chunked pass-index types without changing
   ADR-005 EE types.
3. Implement coarse conservative candidate indexing in shadow mode and report
   both per-chunk memberships and their diagnostic whole-window union.
4. Implement exact chunk confirmation, boundary deduplication, and pass
   stitching; adapt pass extraction/planning to read that index while preserving
   existing real AOS/peak/LOS semantics.
5. Make `NtpUCanonicalRun` consume exact pool/pass index and publish the same
   immutable `SimulationAnalysisFrame` contract.
6. Add independent global current-frame/LOD payloads keyed by the accepted run.
7. Add default artifact, server/chunk, and Worker adapters behind one payload
   seam; do not add route-specific source branches.
8. Keep the current dense path public while the shadow path runs the
   Starlink/OneWeb dense-baseline, cold/warm time/RSS, identity, event, and
   locked-timeline gates; switch the product default only after all pass.

## 14. Explicit non-goals

This SDD does not:

* define a new beam scheduler, intra/inter handover policy, or energy-saving
  policy;
* turn a global visible dot or candidate link into a local serving event;
* allow a snapshot switch to count as a handover;
* make the local seven-cell display grid a TLE-derived footprint;
* use a hardcoded pool count, synthetic visibility, or fake time staggering;
* expose partially computed anchors through the current public timeline; or
* authorize implementation before ADR-010 acceptance and the completion gates.

## 15. References

* `docs/decisions/ADR-010-snapshot-pass-index-run-architecture.md`
* `docs/decisions/ADR-005-tle-and-canonical-ee-simulator-contract.md`
* `docs/sdd/TLE-CANONICAL-EE-SIMULATOR-SDD.md`
* `docs/handoff/LEO-SIM-CURRENT-HANDOFF-2026-08-11.md`
* `src/tle/run/index.ts`
* `src/tle/pass/types.ts`
