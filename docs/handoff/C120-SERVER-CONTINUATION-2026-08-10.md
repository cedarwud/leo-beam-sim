# C-120 server continuation checkpoint — 2026-08-10

## Claim ceiling

Current ceiling: `READY_FOR_3_TO_5_NOVICE_VALIDATION`.

Do not claim classroom readiness, a 20-seat pass, canonical parity, measured
results, live satellite telemetry, or live-backend completion. Every learner
surface must continue to show exactly:

`SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED / NOT CANONICAL-PARITY-VERIFIED`

## Current teaching path

- `/course/c120` is an isolated C-120 route with eight segments totaling
  exactly 120 minutes and at most eight constructed responses.
- The default class path uses one coherent simulated fixture and one stable
  `scenario_id` across the TLE anchor, Labs A/B/C, clinic, recovery, and the
  reopenable Energy Decision Workbook.
- A pinned public OneWeb element set and server-side SGP4-derived pass are
  available only through the opt-in, content-addressed `source=real-data`
  bundle. This is model-derived orbital data, not live or measured data.
- Course service, power, energy, and bit/J consequences remain simulated. The
  isolated backend replay producer is not integrated into the default learner
  route.

## Completed at this checkpoint

- `C120-IMP-00` Gate 0 passes provider replacement, stable identity, action-
  changed authoritative replay, workbook binding, and fail-closed identity and
  unit checks.
- The learner route is Traditional-Chinese-first with an English switch. The
  preference uses a C-120-local storage key and now synchronizes `<html lang>`.
- The UI has returned to the original simulator's blue-black visual identity:
  dark navy surfaces, teal action accent, amber data-boundary warnings, red
  errors, real WebGL scene, larger learner text, 44px controls, and restrained
  structural radii.
- The rejected light/warm theme and the copy claiming that learners need no
  satellite or communications background have been removed and guarded by a
  focused source test.
- Latest local gates passed: `npm run test:c120`, `npm run lint`,
  `npm run build`, and `git diff --check`.
- The repository-wide pre-commit hook remains red at
  `validate:s0:geometry-trace`: 1,610 legacy world-coordinate golden diffs.
  The same failure and first diff (`416.367594` versus `624.551391`) were
  reproduced in an isolated detached worktree at the untouched parent HEAD
  `d3ab66794cfda75f55bfd98d25202ca45289b3ae`. No C-120 checkpoint file owns
  that validator, its scene dependencies, or its golden. Treat this as a
  separate pre-existing gate; do not rebaseline it as part of C-120.
- Fresh dark-theme browser checks passed at 1440x1000, 390x844, and 320x800:
  no horizontal overflow and no visible primary control below 44px. The exact
  disclaimer fills its data-scope notice. The language selection persists
  after reload and the first keyboard Tab reaches the skip link; Enter moves
  focus to `#c120-learning-workbench`.

## Active data and local-only outputs

- Active bundled snapshot:
  `703f0e3ae9224c58ca8e77e9f535c06a3d71789b7a3bd07707ac7f5844201421`.
- The superseded `77c3...89fa` bundle and raw capture directories are ignored;
  do not promote them or treat them as current input.
- `dist/`, `output/`, `.playwright-cli/`, dependencies, and browser runtime
  files are reproducible machine-local outputs and are intentionally not
  versioned.

## First server priorities

1. Re-run preflight and all machine gates on the pushed commit in a clean
   server checkout. The server's current TLE archive is
   `/home/sat/satellite/tle_data`; validate the donor fixture with
   `node scripts/c90-generate-tle-study.mjs --check --tle-data-root /home/sat/satellite/tle_data`.
   A changed `latest` archive must be reviewed as a provenance/scenario change,
   never accepted as an automatic teaching-fixture replacement.
2. Start a fresh headless browser run against the dark redesign. Complete all
   eight segments with coherent fixture data, then verify incomplete and
   complete export/reopen, reset/undo, resume, keyboard-only operation, 320px
   and 390px viewports, and real 200% browser zoom if the runner supports it.
3. Review every segment as a first-time learner: one action, one prediction,
   one observable consequence, and one recovery path. Simplify only where
   evidence shows cognitive overload; preserve contracts, replay identity,
   inputs, URLs, and the WebGL scene.
4. Keep the fixture critical path stable. Continue backend work only in
   independent files after contract freeze, and never let it block the
   teaching route.
5. Conduct the bounded 3-to-5 novice validation before any higher readiness
   claim.

## Parallel-work boundary

The controller owns shared contracts, integration, fixtures, session/workbook
state, browser evidence, and final claim language. Use at most two concurrent
Luna/max workers. Give every worker mutually exclusive exact paths, state that
other writers are active, forbid reverting others' changes, and require focused
tests. Backend workers must not co-write UI, session, fixtures, or browser
evidence.

## Design method

For this redesign-preserve product UI, apply `design-taste-frontend` only to
brand preservation, theme lock, anti-template checks, and copy self-audit. It
explicitly does not govern multi-step product interfaces. Use the product UI,
accessibility, and Playwright skills for forms, state, keyboard, responsive
behavior, and end-to-end evidence.
