# S1 fixture discovery and freeze receipt

Status: **PASS / ACCEPTED**  
Accepted at: `2026-08-14T13:07:38Z`  
Base HEAD: `61d68ccd0cf8bf2315c114bced2739b80981dcea`

## Scope

S1 was read-only with respect to product/runtime/UI code. It added only:

- `.scratch/multibeam-leo-energy-visual-lab/s1-fixture-discovery.ts`
- `.scratch/multibeam-leo-energy-visual-lab/s1-fixture-ledger.json`
- this receipt

No `/`, `/simulator`, `/explain`, scene, homepage, producer, or route file was changed during S1. Existing unrelated dirty WIP was preserved.

## Frozen evidence

- Method state: OneWeb, anchor `47`, frame `analysis-ee7fbeeb`, satellite `55796`, beam `1`, `ue-30`.
- `angle-response-v1`: same source/geometry/link; only full-HPBW `theta3dbRad` changes from `3.32 deg` to `4.00 deg`.
- `service-target-stress-v1`: same source/geometry/link; only `minimumRateBps` changes from `1,000,000` to `10,000,000 bit/s`; every beam and satellite cap is non-binding, every satellite scale is one, and all 100 UEs are not power-limited. Run-level `EE_eval` is excluded because the complete serving/candidate sequence differs.
- Serving change: source-backed forced-continuity event `tle-event-v1-e9303f64`, anchors `21/22/23`, old serving `49283`, pass-plan target/new serving `49307`.
- Negative mechanics: synthetic target reset publishes no serving-change event and cannot complete the story.
- Failed rebuild: invalid `minimumRateBps=0` is rejected while accepted run `analysis-run-03ef0a2a` and frame `analysis-ee7fbeeb` remain unchanged; stale publication and capture are refused.
- Secondary source: complete Starlink 241-anchor run `analysis-run-c2163cd8`, used only to verify constellation switching, never cross-constellation performance.

## Reproducibility

```text
discovery script SHA-256  25ebd92e7c8022bb5b9622ec3760baf003ee6d2acbe8e26f051064e80e16d5da
accepted ledger SHA-256   231f4f79c3660b8a5b1b23c5b4828d81d844e90175d1edf360e8733e1c91d1d8
```

Replay command:

```bash
node --import tsx/esm .scratch/multibeam-leo-energy-visual-lab/s1-fixture-discovery.ts
```

The latest replay returned `verdict: PASS`. JSON parsing, parameter digests, source/TLE hashes, observed-delta arithmetic, formatter distinctions, theoretical pixel floors, cap gates, immutable event provenance, and fail-closed cases passed.

Focused checks reported passing by the fresh-context reviewers:

```bash
npm run test:canonical-ee
npm run test:simulator
npm run test:tle
node --import tsx/esm src/simulator/canonicalTleHandover.test.ts
node --import tsx/esm src/simulator/canonicalLinkResult.test.ts
```

## Fresh-context review

- `s1_semantic_review`: **PASS**; no scientific/runtime blocker. Verified the exact one-parameter diffs, full-HPBW convention, raw `h`/`hDiv` scope, cap and identity gates, `EE_eval` exclusion, event provenance, negative cases, formatter distinctions, and transform calculations.
- `s1_integration_review`: **technical PASS**; verified all six mandatory fixtures plus secondary source, current-script replay, provenance/digests, fail-closed behavior, dirty-WIP preservation, and absence of unsupported savings/performance claims.

Both reviewers identified only the intentionally pending acceptance metadata and stale replay timestamp. Those fields were refreshed in the accepted ledger before this receipt was written.

## Post-acceptance digest portability correction

The first browser integration exposed last-bit floating-point differences between Node and Chromium in the handover trace digest. The digest-only canonical number encoding now normalizes finite values to nine significant digits; raw geometry, analysis values, decisions, and serving-change events are unchanged. Node and Chromium both reproduce `tle-trace-v1-ffb9b40e`, the negative trace remains `tle-trace-v1-0799fa25`, and the complete discovery replay still returns `PASS`.

## Boundary after S1

S1 closes the fixture/start gate for S2 pure evidence-model implementation. Browser pixels, visible `/explain` UI, figure capture, and owner visual acceptance remain later gates and are not claimed here.
