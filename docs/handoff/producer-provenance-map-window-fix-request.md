# Producer Request — Re-emit the dense-Q **window** `provenance-map.json` (full map)

**From:** leo-beam-sim (showcase). **To:** modqn-paper-reproduction (producer).
**Type:** LIGHT — re-emit one sidecar file for an **existing** window export. **NO retrain, NO re-eval.**
**Where it runs:** producer-side, on the server where the Family-B export pipeline + the run's
cfg/metadata live (a local regen is INFEASIBLE — see the hard constraint below).
**Date:** 2026-06-13. **Follow-up to:** `producer-dense-q-export-request.md` (that ask is DONE —
Grade-2 dense-Q delivered + ntn-validated; this is the one remaining loose end).

## Why
The dense-Q **window** export shipped a **251-byte STUB** `provenance-map.json` — only a
`timeline.stepTrace.policyDiagnostics` annotation, **no `bundleSchemaVersion`, no `fields`**.
The Grade-1 standard export AND the baseline both carry the full ~63-field map via
`build_provenance_map(cfg, metadata)`
(`src/modqn_paper_reproduction/bundle/provenance.py`, called at `export/replay_bundle.py:369`).

leo currently runs the Family-B window fine via a **mode-scoped tolerance** in
`src/modqn/replay-bundle/loader.ts` (family-b path tolerates the missing
`bundleSchemaVersion` in `provenance-map.json`; the **manifest's** copy stays authoritative +
strict; a present-but-**wrong** version is still rejected, pinned by a `phase7e` reject test).
The durable fix is producer-side: emit the real map so leo can drop the tolerance.

## The fix
The window-export path (server-side; produced
`artifacts/family-b-baseline-retrain-2026-06-12/seed-42/dense-q-proof-window-600-130/`) must emit
`provenance-map.json` with:

1. **At minimum:** `bundleSchemaVersion: "phase-03a-replay-bundle-v1"` (the authoritative value
   the manifest already carries).
2. **Ideally:** the full `build_provenance_map` field map, Family-B-aware (real cfg/metadata).

Then **re-scp** to
`/home/u24/papers/modqn-paper-reproduction/artifacts/dense-q-proof-window-600-130/`.

## HARD constraint — do NOT fabricate fields (this is why a local regen was rejected)
The Family-B run uses a **different cfg/metadata schema**
(`envConfig`/`evalSeed`/`gridIndex`/…; `run_metadata` = `claim_ceiling`/`protocol_stamp`/…) than
`build_provenance_map` consumes (`cfg.{paper,baseline,resolved_assumptions}`). Naively forcing
`build_provenance_map` on the wrong schema would **fabricate empty fields** — that is exactly why
leo took the loader tolerance instead of hand-filling the map.

So: use the producer's **Family-B-aware** export pipeline. If `build_provenance_map` cannot be fed
real Family-B cfg/metadata, emit at minimum the authoritative `bundleSchemaVersion` plus whatever
fields are **genuinely real**, and leave the rest honestly source-gapped. **Never invent values.**

## Verify (acceptance)
1. `provenance-map.json` carries the correct `bundleSchemaVersion`
   (`phase-03a-replay-bundle-v1`).
2. ntn-sim-core `npm run validate:visual-showcase:artifact -- <bundle>` still passes (no
   provenance-format / unknown-source-artifact regressions).
3. leo `validate:modqn:phase7e-dense-q-proof-replay-state` stays green (real bundle 1000/1000 +
   the fail-closed reject tests).

## After acceptance
leo can remove the mode-scoped tolerance in `src/modqn/replay-bundle/loader.ts` (or keep it as
defense-in-depth). Non-blocking either way — the showcase already renders correctly today.

## Dispatch notes
- Server: producer's Ubuntu host (controller has **no key** — user carries this brief to the
  producer session and performs the scp; `scp -O` for brace-expansion, new scp uses the SFTP
  backend).
- This does **not** touch training, eval, the dense-Q arrays (self-check stays 0/1000), or the
  SINR-live lane. It only fixes one sidecar file.
