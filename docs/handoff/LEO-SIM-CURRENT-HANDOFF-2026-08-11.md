# Leo simulator current handoff: archived TLE and canonical EE

Status: **BOUNDED V1 IMPLEMENTED / FOCUSED AND BROWSER VERIFIED**

Date: 2026-08-11

## 1. Active outcome

Complete two non-heavy workstreams in `/home/u24/demo/leo-beam-sim`:

1. date/time selection over the available TLE archive with atomic TLE-derived
   SGP4 recomputation; and
2. one canonical angle-aware EE state feeding Power, SINR, Throughput, and EE.

Do not implement an energy-saving policy or Phase-1 platform upload. Those
directions are explicitly unresolved.

## 1.1 Implemented checkpoint

Implementation commit: `c9f8982` (`feat: add archived TLE canonical EE simulator`)

The dedicated route is:

```text
/simulator
```

Implemented surfaces:

- `public/tle-archive/oneweb/`: 363 Git-LFS OneWeb snapshots plus a
  content-addressed catalog with per-file epoch bounds;
- `src/tle/**`: fail-closed archive validation, deterministic newest-prior
  resolution, Asia/Taipei conversion, and SGP4 propagation;
- `src/analysis/canonicalEe/**`: frozen Family-B canonical EE producer and
  ratio-of-sums evaluation API;
- `src/simulator/**`: epoch-window loader, immutable shared analysis frame,
  TLE-derived 3D trajectory, and exactly four formal projections; and
- `src/main.tsx`: route mounting without changing the historical default app.

The browser scenario is deliberately explicit: one Taipei ground terminal,
one nadir-reference beam, and an uncalibrated `1e-8` normalized link scale.
The adapter makes cap effects observable but is not a paper-scenario or RF
link-budget reproduction. The canonical EE algebra itself remains the frozen
contract.

## 2. Required reading

In order:

1. `docs/decisions/ADR-005-tle-and-canonical-ee-simulator-contract.md`
2. `docs/sdd/TLE-CANONICAL-EE-SIMULATOR-SDD.md`
3. `/home/u24/papers/modqn-paper-reproduction/docs/ADR-003-canonical-ee-closure.md`
4. the active runtime and frozen conformance cases in
   `/home/u24/papers/modqn-paper-reproduction`
5. repository instructions, `README.md`, and affected source/tests

ADR-004 and the C-120 LoRaEnergySim documents are historical only.

## 3. Environment snapshot and ownership

At authority freeze:

- local `main` contains broad unrelated presentation/course WIP;
- the existing C-120 next-controller handoff is already modified and must not
  be overwritten;
- the server checkout is on
  `feat/c120-lora-course-package-v1-20260811`, with an active controller and
  broad dirty C-120/LoRa WIP; and
- the server branch is not the implementation base for this direction and
  must not be merged automatically.

Preserve all unrelated WIP. Stage only exact owned paths. Do not use
`git add .`, `git add -A`, `commit -a`, reset, stash, restore, clean, or force
push.

## 4. Implementation record

The verified TLE source is `/home/u24/demo/tle_data/oneweb/tle`: 363 archived
OneWeb snapshots from 2025-07-27 through 2026-08-08 at the freeze. Treat that
repository as read-only. Use `scripts/tle_archive_query.py` as the build-time
catalog/provenance helper; the browser must consume a generated manifest.

The current main scene uses custom Walker/Kepler propagation and a fixed epoch,
not SGP4. Historical C-90 selectors replay precomputed bundles and are not an
active implementation donor.

The current live power path writes the SINR `maxTxPowerDbm` control into the
profile, lets `src/engine/signal/link-budget.ts` calculate SINR, and only then
lets `src/teaching/beamshiftCanonicalEe.ts` calculate a partial power ledger.
It therefore omits the required `gamma_req -> p_req -> cap -> actual P_DL`
upstream closure. `src/course/c120/backend/canonicalRuntime.ts` is the closest
TypeScript science donor, but its course binding is historical; extract or
adapt it into a neutral, tested producer.

Completed execution order:

1. inventoried the existing TLE and EE runtime paths;
2. froze shared types and conformance fixtures;
3. implemented and tested archive resolution and SGP4;
4. implemented and tested the canonical EE producer;
5. integrated both into one immutable `SimulationAnalysisFrame`;
6. exposed `P_beam_max` instead of an independent actual-power `P_t`;
7. mounted Power, SINR, Throughput, and EE projections; and
8. ran focused tests, production build, and fresh-browser validation.

## 5. Parallel ownership

Safe parallel work after inspection:

- TLE worker: new `src/tle/**` archive adapter/resolver/SGP4 modules and tests
  only; it must not modify `src/engine/orbit/**`;
- EE worker: new `src/analysis/canonicalEe/**` producer and conformance tests
  only;
- controller: shared types, application state, routing/tabs, migration of
  existing controls, browser validation, commits, and push.

Workers are not alone in the repository. They must not modify dirty course,
presentation, C-120, shared app, or another worker's paths.

## 6. Scientific invariants

- Actual `P_DL` is derived from required power and canonical caps.
- SINR and consumed PA power use the same actual `P_DL`.
- Throughput uses the same realized SINR.
- EE uses the same throughput numerator and full canonical power denominator.
- Evaluation EE is accumulated bits divided by accumulated joules.
- Legacy or teaching formulas do not feed formal pages.
- TLE selection is archived SGP4 evidence, not live telemetry.
- TLE switching is not handover and is not energy-saving evidence.

## 7. Verification evidence

Verified on 2026-08-11:

- `npm run test:active-simulator` passes archive integrity, TLE boundary,
  timezone, SGP4, Python-vector parity, cap, zero, ratio-of-sums, epoch-window,
  and shared-frame tests;
- 2 x 651 all-satellite resolution and propagation measured about 10 ms after
  removing repeated manifest validation;
- `npm run build` passes;
- a fresh Chromium session at `/simulator` showed all four projections with
  zero console errors;
- changing `P_beam_max` from 2 W to 1 W changed the shared actual `P_DL` from
  2 W to 1 W and propagated into SINR, throughput, and EE;
- changing 2026-08-08 to 2026-03-01 changed the TLE frame, selected satellite,
  TLE epoch, trajectory, and analysis frame atomically;
- an unavailable pre-archive instant preserved the prior accepted frame and
  displayed the refusal; and
- a 390 px browser viewport had equal scroll/client width and no horizontal
  overflow.

The repository-wide pre-commit hook remains red on the pre-existing
`validate:s0:geometry-trace` fixture drift (1610 diffs). The new route does not
modify that legacy scene geometry. Focused tests, build, and browser evidence
are green; do not normalize or silently re-baseline the old fixture here.

## 8. Remaining limits

- Evaluation EE is currently an explicitly labelled single-frame
  ratio-of-sums. Cross-time accumulation is not yet mounted in the UI.
- The normalized geometry/channel adapter is not a calibrated RF link budget
  and is not a claim of reproducing the thesis scenario.
- The canonical payload-power boundary excludes bus, TT&C, thermal, and other
  whole-spacecraft terms.
- Energy-saving policy, baseline/candidate evidence, and Phase-1 platform
  integration remain unresolved and unimplemented.
