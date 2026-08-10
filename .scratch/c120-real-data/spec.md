# C-120 real-data adapter slice

Status: isolated backend, strict class snapshot, current-3LE/OMM pairing, and
offline provider materializer implemented and controller-tested on 2026-08-10;
one matched official OMM + 3LE pair captured and atomically bundled. Snapshot
`703f0e3ae9224c58ca8e77e9f535c06a3d71789b7a3bd07707ac7f5844201421`
adds one bounded AOS-to-LOS SGP4 trace and uses it for the TLE anchor plus every
A/B/C/clinic visual frame. Course energy consequences remain simulated pending
explicit replay-producer integration. The new snapshot passed a fresh 0/8 to
8/8 browser regression, incomplete/complete export and reopen, checkpoint,
confirmed reset + undo, keyboard, 390px narrow viewport, 1280px TLE-stage
pointer-isolation and wrong-snapshot fail-closed checks. Claim ceiling remains
`READY_FOR_3_TO_5_NOVICE_VALIDATION`.

## Checkable completion criterion

A server-side module can ingest an injected CelesTrak OneWeb GP response, verify and preserve its source identity, derive one bounded NTPU pass with server-side SGP4, invoke the pinned canonical angle-aware-EE runtime, and emit one strictly validated, JSON-round-trip-verifiable content-addressed artifact without changing the frozen C-120 provider contract or the fixture course route. A strict pre-class snapshot adds explicit truth layers and a bundled-fallback receipt. A separate current-3LE adapter binds one checksum-valid record to the same OMM epoch. An offline materializer creates a content-addressed `canonical-adapter` scenario, preserves donor-authored A/B/C/clinic evidence consequences, and replaces donor scene coordinates with time-indexed projection from the same model-derived pass. Focused tests prove success plus fail-closed behavior for stale/malformed/impossible-timestamp orbit data, bounded pass-search and visual-trace inputs, invalid ordering/endpoints, no-pass and propagation failure, canonical runtime or golden-vector hash drift, unit/identity mismatch, nested claim-upgrade fields, OMM/TLE mismatch, non-finite calculation output, and artifact tampering.

## Truth and claim layers

1. `PUBLIC_CURRENT_ORBIT_SOURCE`: CelesTrak GP/OMM or TLE bytes plus retrieval time and hash. Public orbital elements are source data, not a live onboard measurement.
2. `MODEL_DERIVED_ORBIT`: SGP4-derived state/contact/look-angle values. These are calculations, not measured truth.
3. `CANONICAL_MODEL_DERIVED_ENERGY`: results produced by the pinned external Python runtime only after runtime and golden-vector hash verification. The currently published snapshot scope is exactly `GOLDEN_VECTOR_PARITY_ONLY`; C-120 replay values have not yet been replaced by the course replay producer. Even a later replay-level runtime result remains modeled and not measured.
4. `COURSE_ASSUMPTION`: traffic, deadlines, wake/idle policy and unavailable satellite hardware/load parameters. These remain explicit until a defensible measured/official source is adopted.

The mixed-source artifact must never collapse these layers into `LIVE`, `MEASURED`, or whole-satellite truth.

## Deep module seam

Expose one orchestration interface that accepts a bounded request and injected dependencies, then returns a fully validated artifact. Keep fetch policy, parsing, hashing, freshness checks, canonical-runtime invocation, unit checks and provenance assembly inside the module. Tests cross the same interface with deterministic adapters.

## Hard boundaries

- No browser-side SGP4, link-budget, power, energy or EE formula.
- No edits to `src/course/c120/contract.ts`, UI, session/workbook, recovery or fixtures in this slice.
- No runtime coupling to the current fixture route; backend failure must leave `/course/c120` usable.
- No handwritten translation of `angle_aware_ee.py`.
- No claim upgrade without successful source-age checks, pinned SHA checks and golden-vector parity.

## Opt-in integration gate

Default remains coherent fixture mode. The browser-safe, content-addressed
bundle is available only with `source=real-data` plus the exact snapshot hash;
manifest, scenario and TLE bytes are reverified in the browser without a
backend import. Teaching-content source labels bind to that scenario. Missing
or mismatched input fails closed and does not silently select the fixture
provider. Promotion beyond limited opt-in testing requires a fresh 0/8 to 8/8
reset/resume/export/reopen browser regression on snapshot `703f0e3a…01421`.
That machine/browser regression passed on 2026-08-10. Promotion now requires
the bounded 3-to-5 novice validation; it is not a classroom-ready or 20-seat
claim.

The separate course replay producer is not part of this published bundle. Its
first independent Luna/max semantic audit blocked common Lab A workload/horizon,
Lab C zero-throughput markers, derived-output closure and strict zero-over-zero
metadata; the isolated contracts and adversarial tests were subsequently
repaired. Runtime and golden-fixture hash verification remains explicitly
delegated to the canonical adapter, and no materializer/UI integration has been
performed. A final read-only re-audit passed this only as an isolated,
non-integrated prototype. These results are therefore still not allowed to
replace the coherent simulated course evidence.

## Classroom deployment shape

The cached-pair operator is invoked explicitly; it never fetches or retries:

```bash
npm run materialize:c120:class -- \
  --out-dir /absolute/safe/output/capture-id \
  --omm-file /absolute/cache/oneweb-0314.json \
  --tle-file /absolute/cache/oneweb-0314.tle \
  --retrieved-at 2026-08-09T20:24:22Z \
  --last-retrieved-at 2026-08-09T18:23:52Z \
  --download-path /course/c120/real-data/oneweb-0314-current.tle
```

It validates the two-hour floor and the entire source/model/provider chain
before publishing a sibling temporary directory by one atomic rename. It never
overwrites an existing output directory.

Use a pre-class materialization job, not per-student external fetching:

1. fetch one bounded official GP record under the upstream cache/rate policy;
2. select and freeze one NTPU-visible window with server-side SGP4;
3. run the pinned canonical calculation adapter over explicit course assumptions;
4. write one content-addressed class snapshot plus provenance receipt;
5. let all students use that same snapshot, with a bundled identical fallback.

This preserves a fair shared scenario, deterministic replay, reopenable workbooks and two-minute fallback while avoiding a 20-client dependency on CelesTrak or the canonical Python environment during class.

CelesTrak's current official guidance is cache-first, OMM-capable output, no refetch more often than two hours, and stop/report on non-200 responses instead of retrying. The materializer must follow that policy and retain the last validated snapshot when the network is unavailable.
