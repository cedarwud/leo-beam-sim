# Pre-implementation Readiness Report

## Executive summary

Status: YELLOW — Phase 1A can start, but commit scope should include the newly installed Playwright dependency and generated readiness assets.

Readiness:

- STEP 0 PASS: required existing validation scripts are present; Playwright was not previously configured.
- STEP 1 PASS: both existing baseline validation commands passed.
- STEP 2 PASS: four baseline screenshots were captured after first handover.
- STEP 3 PASS: V3 deterministic fixture helper and smoke validation are in place; the final screenshot hash smoke is deterministic.

Follow-ups before merge:

- Review and commit the setup-owned files: `package.json`, `package-lock.json`, `scripts/_v3-deterministic-fixture.ts`, `scripts/validate-vc-fixture-smoke.ts`, `scripts/capture-baseline-pre-vc.ts`, `docs/visual-clarity-proposal/pre-impl-readiness-report.md`, and `docs/visual-clarity-proposal/baselines-pre-vc/*.png`.
- `validate:vc-fixture:smoke` has already been added to `package.json`.
- `npm install -D @playwright/test` reported `5 vulnerabilities (1 moderate, 4 high)`. This setup did not run `npm audit fix`; treat dependency audit cleanup as a separate follow-up.
- `docs/visual-clarity-proposal/` was already an untracked tree before this setup. This setup added the readiness report and baseline screenshot directory inside that tree; it did not modify the SDD files.

Runtime cleanup:

- Dev server kept: an unowned same-repo Vite server was later observed at `http://127.0.0.1:5173` (`node .../node_modules/.bin/vite --host 127.0.0.1 --port 5173`, PID observed as `96946`). It was not started by this prompt and was left running.
- Temporary dev servers stopped: the task-owned Vite server at `http://127.0.0.1:3000` was stopped via exec session `31189`; `127.0.0.1:3000` returned `ECONNREFUSED` after cleanup.
- Playwright/Chrome processes stopped: the Playwright browsers launched by `scripts/capture-baseline-pre-vc.ts` and `scripts/validate-vc-fixture-smoke.ts` closed normally. The hung sandboxed `npx playwright install chromium` process was also terminated before retrying with approved network access.
- Intentionally retained background process: the unowned `5173` Vite server noted above. Existing MCP/browser processes from other active sessions were not touched.

Setup-owned git changes:

```text
M  package-lock.json
M  package.json
?? docs/visual-clarity-proposal/pre-impl-readiness-report.md
?? docs/visual-clarity-proposal/baselines-pre-vc/baseline-pre-vc-1440x900.png
?? docs/visual-clarity-proposal/baselines-pre-vc/baseline-pre-vc-1366x768.png
?? docs/visual-clarity-proposal/baselines-pre-vc/baseline-pre-vc-768x1024.png
?? docs/visual-clarity-proposal/baselines-pre-vc/baseline-pre-vc-390x844.png
?? scripts/_v3-deterministic-fixture.ts
?? scripts/capture-baseline-pre-vc.ts
?? scripts/validate-vc-fixture-smoke.ts
```

Other dirty files were present in the worktree and were not modified by this setup:

```text
M docs/frontend-ux-redesign-sdd.md
M docs/sinr-runtime-parameter-contract.md
M scripts/validate-phase1a-recent-ho-ui.tsx
M scripts/validate-phase7b-sinr-display-ownership.tsx
M scripts/validate-phase8b-path-loss-controls.tsx
M scripts/validate-phase9d-formula-evidence-stability.tsx
M src/App.tsx
M src/scene/MainScene.tsx
M src/styles/main.scss
M src/ui/InfoPanel.tsx
M src/ui/SignalTuningPanel.tsx
```

## STEP 0 — Environment inventory

### A. Validation scripts

`package.json` contains these `validate:*` scripts:

```text
validate:beam-floor = node --import tsx/esm scripts/validate-serving-pending-beam-floor.ts
validate:phase1a:recent-ho-ui = node --import tsx/esm scripts/validate-phase1a-recent-ho-ui.tsx
validate:phase2d:forced-role-state-visuals = node --import tsx/esm scripts/validate-phase2d-forced-role-state-visuals.ts
validate:phase4b:receiver-gain = node --import tsx/esm scripts/validate-phase4b-receiver-gain.ts
validate:phase5b:diagnostics-dpc-status = node --import tsx/esm scripts/validate-phase5b-diagnostics-dpc-status.tsx
validate:phase6b:handover-policy-controls = node --import tsx/esm scripts/validate-phase6b-handover-policy-controls.tsx
validate:phase6c:handover-policy-placement = node --import tsx/esm scripts/validate-phase6b-handover-policy-controls.tsx
validate:phase7b:sinr-display-ownership = node --import tsx/esm scripts/validate-phase7b-sinr-display-ownership.tsx
validate:phase8b:path-loss-controls = node --import tsx/esm scripts/validate-phase8b-path-loss-controls.tsx
validate:phase9b:power-noise-separation = node --import tsx/esm scripts/validate-phase9b-power-noise-separation.tsx
validate:phase9d:formula-evidence-stability = node --import tsx/esm scripts/validate-phase9d-formula-evidence-stability.tsx
validate:phase9f:formula-map = node --import tsx/esm scripts/validate-phase9f-formula-map.tsx
validate:phase9h:coverage-audit-demotion = node --import tsx/esm scripts/validate-phase9h-coverage-audit-demotion.tsx
validate:hobs-tr38811-phase1 = node --import tsx/esm scripts/validate-hobs-tr38811-phase1.ts
validate:hobs-tr38811-phase2:dpc = node --import tsx/esm scripts/validate-hobs-tr38811-phase2-dpc.ts
```

Required entries are present:

- `validate:phase2d:forced-role-state-visuals` -> `scripts/validate-phase2d-forced-role-state-visuals.ts`
- `validate:phase5b:diagnostics-dpc-status` -> `scripts/validate-phase5b-diagnostics-dpc-status.tsx`

### B. Playwright installation/configuration

- `package.json` has no `@playwright/test` or `playwright` entry in `dependencies` or `devDependencies`.
- `.playwright-cli/` exists, but the inventory only found the directory itself and no files under max depth 2.
- `node_modules/@playwright/` does not exist.
- No repo-root `playwright.config.ts` or `playwright.config.js` exists.
- `npx` is available at `/home/u24/.nvm/versions/node/v24.11.1/bin/npx`.

Conclusion: Playwright is not configured in this repo yet. STEP 2 will need `npm install -D @playwright/test` and `npx playwright install chromium` before using Playwright.

### C. Existing browser validation framework

`scripts/validate-hobs-tr38811-phase2-browser.ts` does not use Puppeteer or Playwright. It directly launches `google-chrome` with `node:child_process.spawn`, opens a remote debugging port, and drives the page through a custom Chrome DevTools Protocol WebSocket client.

Relevant opening imports:

```ts
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
```

Relevant launch mode:

```ts
const chrome = spawn('google-chrome', [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  `--remote-debugging-port=${remoteDebuggingPort}`,
  `--user-data-dir=${userDataDir}`,
  'about:blank',
], {
  stdio: 'ignore',
});
```

## STEP 1 — Existing validation smoke

### D. `npm run validate:phase2d:forced-role-state-visuals`

Result: PASS (exit 0)

Last 5 lines of stdout:

```text
      }
    }
  ],
  "forbiddenRawRoleLeakCheck": "passed"
}
```

### E. `npm run validate:phase5b:diagnostics-dpc-status`

Result: PASS (exit 0)

Last 5 lines of stdout:

```text
      "Tuning mode editable-control surface",
      "legacy profile Diagnostics"
    ]
  }
}
```

Gate result: both existing validation commands passed. Continue to STEP 2.

## STEP 2 — Baseline screenshots

Playwright setup:

- `npm install -D @playwright/test` completed successfully.
- First sandboxed `npx playwright install chromium` attempt hung without output and was terminated. The likely cause was restricted network / browser-cache access inside the sandbox.
- Retried `npx playwright install chromium` with escalated network permission. It completed successfully and downloaded:
  - Chromium v1217 to `/home/u24/.cache/ms-playwright/chromium-1217`
  - Chromium headless shell v1217 to `/home/u24/.cache/ms-playwright/chromium_headless_shell-1217`

Dev server:

- `http://localhost:3000` and `http://127.0.0.1:3000` were not listening.
- An existing same-repo Vite dev server was already running and responding at `http://127.0.0.1:5173`, so this setup reused it instead of starting a second dev server.
- Existing dev-server process chain observed: `npm run dev --host 127.0.0.1 --port 5173` -> `vite --host 127.0.0.1 --port 5173` -> `node .../node_modules/.bin/vite --host 127.0.0.1 --port 5173`.

New reusable capture script:

- `scripts/capture-baseline-pre-vc.ts`

Capture behavior:

- Loaded `http://127.0.0.1:5173`.
- Waited for `[data-testid="info-panel-primary-sinr-status"]`.
- Used diagnostics mode only to observe `HO Count`.
- Set speed to `20x`, waited until `hoCount = 1`, clicked `Pause`, then switched back to presentation mode before screenshots.

Generated baseline files:

```text
baseline-pre-vc-1440x900.png  1364968 bytes
baseline-pre-vc-1366x768.png  1047458 bytes
baseline-pre-vc-768x1024.png   738203 bytes
baseline-pre-vc-390x844.png    338886 bytes
```

All four screenshots are above the 5 KB blank-screen threshold. No screenshot retry was needed.

## STEP 3 — V3 deterministic fixture

New reusable helper:

- `scripts/_v3-deterministic-fixture.ts`

Exports:

- `seedRandom(seed: number): void`
- `freezeRaf(page, atMs: number): Promise<void>`
- `bootDeterministicPage(playwright, opts): Promise<Page>`

Implementation notes:

- Uses an in-repo Mulberry32 PRNG; no extra dependency beyond `@playwright/test` was added.
- Injects seeded `Math.random` before page scripts run.
- Freezes `requestAnimationFrame` callback timestamps.
- Freezes `Date.now()` and `performance.now()` to the same fixture timestamp.
- Injects deterministic CSS that pauses CSS animations and transitions. This was required because the current `Starfield` uses CSS animation timing in addition to `Math.random`; RAF freeze alone was not enough for full-page screenshot hash stability.
- Uses script-string injection for browser patches so TSX transform artifacts do not leak into the page context.

New smoke test:

- `scripts/validate-vc-fixture-smoke.ts`
- Registered script: `validate:vc-fixture:smoke`

Smoke execution:

- Initial sandboxed run could not connect to the local Vite server: `connect EPERM 127.0.0.1:3000`. It was rerun with escalated local runtime permission.
- First fixture attempt produced unequal screenshot hashes at viewport `800x600`, seed `1337`, proving RAF + seeded random alone was insufficient:
  - `4282533cff7f51fa0aba5c2a845d01d37b599ad2606a08031e2fecc90a899e09`
  - `140efcbe5880f6586c28f6e3af1359580dbda6b1b3de0ae2ca85f17ce5a263b9`
- After adding CSS animation/transition freeze and using plain script-string browser injection, the smoke passed.

Final result: PASS

```text
appUrl: http://127.0.0.1:3000
viewport: 800x600
seed: 1337
rafMs: 1000
hash: 9b7f52d5e3a90f97c27442750f3c755535846d150e745ac53009bd3fc4996308
```

## Suggested next command for Phase 1A implementer

```bash
cd /home/u24/papers/project/leo-beam-sim
sed -n '1,220p' docs/visual-clarity-proposal/visual-clarity-sdd/README.md
sed -n '1,460p' docs/visual-clarity-proposal/visual-clarity-sdd/phase-1-identity-first.md
rg -n "formatBeamIdentity|formatFrequencyLabel|identityLine|callout.identityLine" src docs/visual-clarity-proposal/visual-clarity-sdd
npm run validate:vc-fixture:smoke -- http://127.0.0.1:5173
# After implementing Phase 1A, register and run:
npm run validate:vc1a:live-legend
```
