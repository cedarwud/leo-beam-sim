# MODQN Baseline Phase 5D Frequency Diagnostics Browser Smoke

**Date:** 2026-05-13
**Status:** browser smoke for Phase 5C diagnostics readout under the Phase 7K sidebar tab model
**Target repo:** `/home/u24/papers/project/leo-beam-sim`
**Scope:** real-browser validation only

Phase 5D adds a browser smoke that proves the Phase 5C diagnostics drawer
readout is visible in the real app and that the runtime still loads without
uncaught browser errors. It does not change runtime behavior, signal or
handover engines, profile JSON, producer artifacts, replay playback, training,
or beam-count controls.

## Browser Smoke

Source file:

`scripts/validate-modqn-phase5d-frequency-diagnostics-browser.mjs`

Package script:

```bash
npm run validate:modqn:phase5d-frequency-diagnostics-browser
```

The smoke follows local runtime hygiene:

1. inspect existing Vite, `npm run dev`, Playwright, Chrome/Chromium, and
   SwiftShader-related processes before browser work;
2. reuse an existing Leo Beam Sim app server when one is reachable;
3. otherwise start one temporary Vite dev server for this validation only;
4. launch Chromium through Playwright;
5. close the Playwright browser and stop any temporary dev server it started;
6. assert no new runtime process remains after cleanup.

## Assertions

The browser smoke loads the real app, switches the Phase 7K right sidebar from
the default `MODQN replay` tab to `Live status`, switches to Diagnostics mode
through the UI mode selector, and checks:

1. the app shell, info panel, and runtime canvas load;
2. the diagnostics drawer is expanded;
3. the `VISUAL FREQUENCY SOURCE` section is visible;
4. the primary and comparison rows render:
   `Primary F`, `Primary Source`, `Primary Runtime K`,
   `Primary Core FRF`, `Comparison F`, and `Comparison Source`;
5. at least one exact source string is visible:
   `core-layout`, `runtime-frequency-reuse-compatibility`,
   `fallback-numeric-modulo`, or `not-visible`;
6. browser-visible text does not claim unsupported 19/37 trained baseline
   MODQN evidence;
7. no browser page error or console error is emitted during the Phase 5A/5B/5C
   diagnostics path load.

## Claim Boundary

This phase is diagnostics-only browser validation. Visual frequency diagnostics
remain display diagnostics, not MODQN replay evidence. `19` and `37` remain
sensitivity/demo extensions only and must not be described as trained baseline
MODQN evidence.

## Validation

Run:

```bash
npm run validate:modqn:phase5d-frequency-diagnostics-browser
```

The required delivery gate for this slice is the full Phase 2 through Phase 5D
validator set plus lint and the unsupported 19/37 claim text scan.

## Next Phase Recommendation

The next phase should stay claim-bound. If signal or handover behavior starts
using reuse metadata, it should be a separate rigor-critical adoption phase with
vendored `ntn-sim-core` truth and KPI validation, not a browser-smoke extension.
