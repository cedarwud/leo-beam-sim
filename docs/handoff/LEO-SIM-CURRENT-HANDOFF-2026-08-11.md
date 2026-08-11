# Leo simulator current handoff: archived TLE and canonical EE

Status: **AUTHORITY FROZEN / IMPLEMENT IN THIS CONTROLLER SESSION**

Date: 2026-08-11

## 1. Active outcome

Complete two non-heavy workstreams in `/home/u24/demo/leo-beam-sim`:

1. date/time selection over the available TLE archive with atomic TLE-derived
   SGP4 recomputation; and
2. one canonical angle-aware EE state feeding Power, SINR, Throughput, and EE.

Do not implement an energy-saving policy or Phase-1 platform upload. Those
directions are explicitly unresolved.

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

## 4. Execution order

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

Execution order:

1. inventory the existing TLE and EE runtime paths;
2. freeze new shared types and conformance fixtures under controller ownership;
3. implement TLE archive resolution and tests in an isolated module;
4. implement canonical EE producer and tests in an isolated module;
5. integrate both into one shared analysis frame;
6. replace the independent SINR `P_t` state with the canonical cap input;
7. mount Power, SINR, Throughput, and EE projections;
8. run focused tests, typecheck/build, and fresh-browser validation; and
9. commit and push only reviewed paths authorized in this session.

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

## 7. Completion evidence

Do not call the work complete without:

- deterministic archive-boundary and timezone tests;
- canonical Python-to-TypeScript conformance cases;
- cap, coupled-power, zero, and ratio-of-sums tests;
- production build;
- fresh-browser evidence for date/time switching and all four pages; and
- a final path-scoped diff showing unrelated WIP was not staged.
