# ADR-010: Snapshot-aware pass-indexed run architecture

## Status

**Accepted for staged implementation; optimized product switchover remains
blocked on the completion gate below.**

Date: 2026-08-16  
Decision identifier: `LEO-SIM-SNAPSHOT-PASS-INDEX-1`  
Implementation repository: `/home/u24/demo/leo-beam-sim`

## Context

The active simulator has two different data products that were previously
treated as one payload:

1. a **global full-constellation overview**, where the useful operation is a
   lightweight current-UTC frame or an explicitly requested level of detail;
   and
2. an **NTPU local analysis**, where serving/candidate identity, visibility,
   real pass events, canonical SINR, Throughput, Power, and EE must be exact
   over the requested two-hour window.

The current dense execution resolves the entire selected snapshot and then
propagates every resolved satellite at every one of the 241 anchors before
visibility/pass filtering (`src/tle/run/index.ts:555-616`). The checked-in
handoff measured the same scale at approximately 10,760 Starlink satellites,
241 anchors, 118.71 MiB of private typed arrays, and 9.62 seconds for the
full local request (`docs/handoff/LEO-SIM-CURRENT-HANDOFF-2026-08-11.md:248-265`).
The exact count is snapshot-dependent; the problem is the dense
`catalog-size × 241` execution, not a fixed number such as 10,755.

That execution is an unsuitable default for the NTPU product. Most catalog
objects are not visible to the NTPU observer in the requested window, while
the global view does not need an exact 241-anchor, full-catalog payload in the
browser. A conservative visibility/pass shortlist must therefore precede exact
SGP4 confirmation. The shortlist size must be the measured result of the
source, observer, time window, and policy—not a hardcoded “top N” or “a few
hundred” substitute.

The active scientific contracts remain authoritative:

* one deterministic archive publication and one resolved TLE pair per source
  record; no cross-publication merge or generated orbit;
* one common UTC axis of 241 30-second anchors for the accepted NTPU analysis
  window;
* one immutable canonical frame identity shared by SINR, Power, Throughput,
  and EE;
* canonical `P_DL_actual`, interference, rate, consumed power, and
  ratio-of-sums EE semantics; and
* atomic public publication with a locked timeline until the requested window
  is fully valid.

These contracts come from ADR-005, the TLE canonical SDD, and the current
handoff. They are not relaxed to make delivery faster.

## Decision

Introduce a snapshot-aware, content-addressed pass/event index between archive
selection and NTPU canonical analysis. Keep global and NTPU payloads separate
while binding them to one run identity.

```text
archive manifest + requested UTC + observer/policy
        |
        v
one frozen publication / snapshot receipt
        |
        v
content-addressed coarse visibility index
  conservative candidate IDs by time chunk; no hardcoded pool limit
        |
        v
exact SGP4 confirmation for the measured candidate pool
  common 241 anchors + boundary refinement from real UTC samples
        |
        v
snapshot-aware exact pass/event index
  AOS / peak / LOS / visibility / pass provenance
        |
        +--> NTPU exact canonical run and 240-interval EE evaluation
        |
        +--> global current-frame / LOD payloads on demand
        |
        v
one immutable accepted run identity; separate view payloads
```

### 1. Snapshot-aware content identity

The source identity is not merely an archive name or requested date. A
`SnapshotReceipt` freezes the publication and source content digest before any
shortlist is accepted. The pass-index key is derived from at least:

```text
PassIndexKey = SHA-256(
  archiveId,
  publicationSha256,
  resolvedSnapshotDigest,
  requestedT0Utc,
  duration=7200,
  anchorStep=30,
  observerId + observerCoordinates,
  visibility/pass policy revision,
  coarse-index revision,
  exact-SGP4 revision
)
```

The key is immutable and content-addressed. Any change to source bytes,
publication, observer, horizon mask, anchor axis, policy, or algorithm revision
creates a cache miss and a new provenance record. A mismatched cache entry is
refused, never relabelled as the new run.

The pass/event index records the measured populations rather than an assumed
population:

* `catalogRecordCount` — records in the frozen publication;
* `coarseCandidateIdsByChunk` and measured per-chunk counts — the conservative
  time-local shortlists;
* `coarseCandidateUnionIds` — diagnostic union only, not the unit of exact work;
* `exactConfirmedIds` and `exactConfirmedCount` — records actually confirmed by
  exact SGP4 visibility checks;
* `visibleIdsByAnchor` — exact above-mask identities for each common anchor;
* `events` — exact pass events with source UTC times and anchor indices;
* `denseBaselineReceipt` — the baseline fixture and digest used by the gate;
* `missedVisibleIdsByAnchor` — required to be empty at acceptance; and
* timing/RSS measurements for coarse, exact, pass, canonical, and packaging
  stages.

No field named `maxCandidates`, `topN`, or an equivalent silent truncation is
part of this contract. A resource budget may abort with an explicit
`BUDGET_EXCEEDED` refusal; it may not drop candidates and publish a plausible
but incomplete run.

### 2. Coarse conservative shortlist, then exact confirmation

The coarse adapter may use a catalog-level orbital/temporal index, conservative
observer geometry envelopes, and coarse time bins. It must over-include when
uncertain. For every source record, it returns either:

* `candidate`: the conservative envelope can intersect the NTPU visibility
  region during the requested window;
* `excluded`: the envelope proves that no visibility intersection is possible;
  or
* `uncertain`: retained as `candidate`, never discarded.

The exact stage then runs the frozen TLE pairs through SGP4 only for the
candidate membership of each time chunk and the common 30-second anchors that
belong to that chunk. It derives the NTPU
topocentric geometry and applies the declared horizon/service mask. It refines
AOS and LOS only from neighboring real UTC samples, and records exact peak
samples and identities. Adjacent chunks carry a declared discovery/refinement
overlap; exact samples are deduplicated by source identity plus anchor UTC, and
pass fragments are stitched only when their real boundary samples agree. The
pass extractor and planner consume this stitched confirmed index, not the
whole-window candidate union or whole global catalog.

If the coarse index is not conservative enough, the build performs a bounded
rescue expansion (larger envelope/time-bin margin) or refuses. It never falls
back to a generated orbit, an invented visible satellite, a nearest arbitrary
record, or a fabricated pass.

The existing dense all-catalog implementation remains the public scientific
path during shadow validation and a validation adapter after switchover. The
time-chunked path cannot become the normal product execution until the
completion gate passes.

### 3. Global and NTPU are different payload views

The global overview is allowed to request a lightweight current anchor or LOD:

* the object index retains the full catalog identities and source roles;
* a current global frame may contain one exact SGP4 position/visibility state
  per catalog record at the requested UTC, or a declared LOD projection of
  that state;
* future global anchors are fetched or generated on demand; the browser does
  not materialize `catalog-size × 241` solely for the overview; and
* global geometry-only data does not claim NTPU link, handover, Throughput, or
  EE evidence unless the corresponding NTPU canonical frame is present.

The NTPU local payload contains the exact confirmed pool, pass/event index,
serving/candidate sequence, canonical frames, and run evaluation. It is the
authoritative payload for local SINR/Power/Throughput/EE and later story clips.

Both views carry the same `runKey`, source receipt, model/scenario revision,
requested UTC, and anchor identity when they refer to the same run. They do
**not** have to carry the same browser bytes, object count, or temporal chunk.
The global and local payload keys are separate descendants of the same
immutable run key. This is an identity relationship, not a requirement to
duplicate the NTPU analysis payload in the global view.

### 4. Real-time pass events only

All temporal marks and any delivery/render scheduling that describes satellite
movement must use exact pass times: `aosUtc`, `peakUtc`, `losUtc`, their source
seconds, and their common anchor indices. The existing `PassEvent` vocabulary
already carries these fields (`src/tle/pass/types.ts:106-137`).

The implementation must not add a per-satellite index-based delay, seeded fake
offset, modulo wrap, or “stagger” to make a global animation look populated.
If there is no real pass/event timestamp, the corresponding temporal claim is
`unavailable`. Grouping or prefetching chunks around actual pass times is a
transport optimization; it is not a new time axis.

### 5. Public atomic publication remains unchanged

The public timeline remains locked until the full requested NTPU analysis
window is ready: exact confirmed visibility/pass index, serving/candidate
sequence, all 241 canonical frames needed by the analysis, and the 240-interval
EE evaluation. Internal coarse, exact, and chunk work may progress and be
cached privately, but it must not create a new public partial-seek UX without a
later owner-approved ADR.

Global current-frame/LOD requests may be delivered after the accepted run is
published. They must retain the accepted run identity and may report their own
payload as pending without changing the canonical NTPU result.

### 6. Delivery mode

For the small academic deployment, use this hybrid delivery mode:

1. a digest-verified default artifact contains the snapshot/pass-index receipt,
   the first accepted NTPU range, and the first global current frame/LOD;
2. immutable temporal/spatial chunks are loaded from the browser cache or an
   HTTP/server adapter for later ranges and custom dates; and
3. a bounded Worker adapter can run the same coarse-to-exact and canonical
   producer revision when the server path is unavailable.

The server-only query/stream design remains a valid adapter for a multi-user
deployment; it is not a second scientific contract. The route-facing session,
run key, pass-index schema, publication gate, and payload identity checks are
the same in both modes. A single full static download is not the default because
it couples first interaction to the largest global temporal payload and cannot
express verified completed ranges economically.

An Apply/request race follows the existing fail-closed behavior: the previous
accepted run remains the only public evidence until the new requested run
passes its publication gate; a failed or stale request cannot publish any
scene, timeline, result, or event marker. The internal cache may retain a
verified abandoned artifact for a later identical request.

## Scope of supersession

This ADR supersedes **only** ADR-005's dense all-admitted-catalog execution
mechanics: the requirement to materialize every resolved satellite at every 241
anchors as the normal route to NTPU visibility/pass analysis. It does not
supersede:

* deterministic one-publication snapshot selection and source provenance;
* explicit UTC and one frozen publication for the requested two-hour window;
* the 241 common 30-second anchors for the accepted NTPU canonical run;
* the canonical EE state graph, `P_DL_actual`, interference, rate, power, and
  ratio-of-sums rules;
* immutable shared frame identities and atomic publication;
* TLE/SGP4 as archived evidence rather than live telemetry;
* the distinction between candidate comparison and a handover event; or
* the prohibition on fabricated or silently substituted fallback data.

The dense path remains allowed and required as a test-only baseline until the
zero-missed-visible-satellite gate is closed on real Starlink and OneWeb
snapshots.

## Alternatives considered

### Keep dense full-catalog propagation as the product path

Rejected. It conflates global overview with NTPU analysis, pays the
approximately 10k-by-241 cost before visibility is known, creates unnecessary
browser/server payload, and makes the local result sensitive to unrelated
global objects. It remains the regression baseline, not the default execution.

### Use one identical browser payload for global and NTPU

Rejected. Shared run identity is necessary for provenance; identical payloads
are not. Global needs current-frame/LOD geometry, while NTPU needs exact
visibility, pass events, and canonical link/EE values. Forcing one payload
reintroduces the dense coupling this ADR removes.

### Select a hardcoded top-N or fixed pool size

Rejected. A fixed count can miss a real visible satellite under a different
constellation, date, observer, or archive publication. The measured shortlist
is part of the pass-index artifact; resource exhaustion is an explicit refusal.

### Add synthetic per-satellite time offsets

Rejected. It creates a visually plausible but source-unbacked temporal story
and can mislabel an event. Only exact pass times on the frozen UTC axis may
drive event markers, prefetch grouping, or narrative timing.

## Consequences

Positive:

* NTPU exact work scales with the measured visibility/pass pool rather than the
  complete global catalog in ordinary runs.
* Global full-constellation context remains available as a lightweight
  current-frame/LOD product without forcing a 241-anchor dense payload.
* Pass/event provenance becomes reusable by handover rails and deterministic
  story clips, while canonical EE remains in one immutable frame.
* The existing atomic public timeline and fail-closed semantics remain intact.

Costs and risks:

* A new coarse-index adapter and pass-index schema need independent validation.
* False negatives are unacceptable, so the dense baseline comparison and rescue
  path are mandatory—not optional performance tests.
* Server, artifact, and Worker adapters must share key/schema/model revisions;
  transport differences must not create separate scientific results.
* Global geometry-only payloads must be clearly labelled so a visual overview is
  not mistaken for local SINR/EE evidence.

## Required completion gate

ADR-010 cannot move from Proposed to Accepted, and the dense path cannot be
retired from validation, until a machine-readable report and owner review show:

1. at least one real archived Starlink publication and one real archived OneWeb
   publication, each with source/publication/snapshot digests;
2. the optimized coarse-to-exact index has
   `missedVisibleIdsByAnchor = []` against the dense all-catalog baseline at
   every common anchor, with event-time tolerances declared and checked;
3. the report records the actual coarse candidate and exact confirmed pool
   counts for each fixture, with no hardcoded pool limit or silent truncation;
4. cold and warm wall time plus peak RSS are reported separately for snapshot
   resolution, coarse shortlist, exact confirmation, pass indexing, canonical
   analysis, and payload publication;
5. the accepted NTPU run has exactly 241 common anchors, 240 EE intervals, a
   valid immutable frame identity, and a public timeline that stayed locked
   until the full requested window passed; and
6. global current-frame/LOD payloads and NTPU payloads retain the same run
   identity without pretending to be the same browser payload, and all
   temporal marks are traceable to real UTC pass times.

## References

* `docs/decisions/ADR-005-tle-and-canonical-ee-simulator-contract.md`
* `docs/sdd/TLE-CANONICAL-EE-SIMULATOR-SDD.md`
* `docs/handoff/LEO-SIM-CURRENT-HANDOFF-2026-08-11.md`
* `src/tle/run/index.ts`
* `src/tle/pass/types.ts`
