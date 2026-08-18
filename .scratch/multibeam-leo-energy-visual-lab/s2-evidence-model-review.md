# S2 pure evidence-model receipt

Status: **PASS**  
Base HEAD: `61d68ccd0cf8bf2315c114bced2739b80981dcea`

## Delivered boundary

- One immutable `ScientificStoryEvidence` resolver binds the accepted method state, angle-response pair, service-target pair, and real serving-change triplet.
- Representative-link selection is deterministic and pair-aware. Term selection rejects mixed run/frame/anchor/identity inputs and reads numeric values back from the canonical run-owned frame.
- The canonical term registry includes source selectors, scene targets, dependencies, dependents, and an acyclic causal graph.
- Requested user power depends on the explicit prior-state interference estimate `laggedInterferenceUW`, matching the canonical producer; it does not depend on realized current-frame interference.
- Probe pairs bind exact source catalog digest, snapshot digest/path/date, geometry publication/run/time, parameter digest, frame identity, and the declared one-parameter difference.
- Manifest parsing is closed-schema, anchor-bounded, recursively frozen, and fail-closed for missing, extra, non-finite, pending, forged, or stale evidence.
- Runtime numeric parity uses a tested `1e-10` relative tolerance for non-zero values and `1e-18` absolute tolerance at exact zero. Source, digest, run, frame, anchor, and identity gates remain exact.
- `EE_inst` and `EE_eval`, representative-link and system-aggregate, cap, zero, unavailable, and forced-continuity boundaries remain explicit.

## Adversarial coverage

Focused tests include:

- forged user ID, frame ID, anchor, mixed run/frame, and forged scientific payload;
- out-of-run manifest anchor, unknown root/source fields, extra negative fixture IDs, shallow-frozen root, and malformed required term sets;
- probe source/TLE drift, undeclared parameter changes, parameter-digest forgery, non-finite values, unequal identity sequences, and missing serving-change events;
- dependency graph cycle detection and canonical selector coverage for every registered term.

## Verification and review

Passed on current bytes:

```bash
npm run test:explain
npm run test:simulator
npm run test:canonical-ee
npm run test:tle
node --import tsx/esm src/simulator/canonicalTleHandover.test.ts
npm run lint
npm run build
```

- Fresh-context scientific-semantic review: **PASS**.
- Fresh-context adversarial code review: **PASS**.
- Browser-safe module scan and Node/Chromium evidence replay: **PASS**.

No rendering claim beyond the S3 shell is made here. No commit or push was performed.
