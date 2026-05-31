import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const UI_MODE_STORAGE_KEY = 'leo-beam-sim.ui-mode.v1';
const BROWSER_USER_DATA_PREFIX = 'leo-beam-sim-phase5d-browser-';
const REQUEST_TIMEOUT_MS = 900;
const DEV_SERVER_START_TIMEOUT_MS = 30_000;
const UI_LOAD_TIMEOUT_MS = 30_000;
const SOURCE_STRINGS = [
  'core-layout',
  'runtime-frequency-reuse-compatibility',
  'fallback-numeric-modulo',
  'not-visible',
];
const REQUIRED_ROW_LABELS = [
  'Primary F',
  'Primary Source',
  'Primary Runtime K',
  'Primary Core FRF',
  'Comparison F',
  'Comparison Source',
];

function normalizeText(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function execFileText(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { cwd: ROOT_DIR }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`${command} ${args.join(' ')} failed: ${stderr || error.message}`));
        return;
      }
      resolve(stdout);
    });
  });
}

function parseProcessTable(output) {
  return output
    .split(/\r?\n/)
    .map(line => {
      const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\S+)\s+(.+)$/);
      if (!match) return null;
      return {
        pid: Number(match[1]),
        ppid: Number(match[2]),
        stat: match[3],
        cmd: match[4],
      };
    })
    .filter(Boolean);
}

function isDevServerProcess(processInfo) {
  return /\bnpm\s+run\s+dev\b|\bvite\b/i.test(processInfo.cmd);
}

function isBrowserAutomationProcess(processInfo) {
  return /playwright-mcp|chrome-devtools-mcp|google-chrome|chromium|chrome\b|swiftshader|--use-angle=swiftshader-webgl/i
    .test(processInfo.cmd);
}

function isRelevantRuntimeProcess(processInfo) {
  return isDevServerProcess(processInfo) || isBrowserAutomationProcess(processInfo);
}

async function readRuntimeProcesses() {
  const output = await execFileText('ps', ['-eo', 'pid=,ppid=,stat=,args=']);
  return parseProcessTable(output).filter(isRelevantRuntimeProcess);
}

function summarizeProcesses(processes) {
  const devServerProcesses = processes
    .filter(isDevServerProcess)
    .map(processInfo => ({
      pid: processInfo.pid,
      ppid: processInfo.ppid,
      stat: processInfo.stat,
      cmd: processInfo.cmd,
    }));

  return {
    relevantProcessCount: processes.length,
    devServerProcesses,
    browserAutomationProcessCount: processes.filter(isBrowserAutomationProcess).length,
  };
}

function candidateAppUrls() {
  return [
    'http://127.0.0.1:5173/',
    'http://127.0.0.1:5174/',
    'http://127.0.0.1:5175/',
    'http://127.0.0.1:4173/',
    'http://127.0.0.1:4174/',
    'http://127.0.0.1:3000/',
    'http://localhost:5173/',
    'http://localhost:4173/',
    'http://localhost:3000/',
  ];
}

function normalizeUrl(candidate) {
  const url = new URL(candidate);
  return `${url.origin}/`;
}

async function fetchHtml(candidate) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(candidate, { signal: controller.signal });
    if (!response.ok) return null;
    return response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function isLeoAppServer(candidate) {
  const html = await fetchHtml(candidate);
  return Boolean(html && (
    html.includes('<title>LEO Beam Sim</title>')
    || html.includes('/src/main')
    || html.includes('leo-beam-sim')
  ));
}

async function resolveExistingAppUrl() {
  const explicit = process.env.APP_URL ?? process.argv[2] ?? null;
  if (explicit) {
    const appUrl = normalizeUrl(explicit);
    if (await isLeoAppServer(appUrl)) return appUrl;
    throw new Error(`APP_URL did not resolve to a LEO Beam Sim app server: ${appUrl}`);
  }

  for (const candidate of candidateAppUrls()) {
    if (await isLeoAppServer(candidate)) return normalizeUrl(candidate);
  }
  return null;
}

async function waitFor(description, fn, timeoutMs, intervalMs = 200) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const result = await fn();
    if (result !== null) return result;
    await delay(intervalMs);
  }
  throw new Error(`Timed out waiting for ${description}`);
}

function extractUrls(output) {
  const urls = new Set();
  const regex = /https?:\/\/(?:127\.0\.0\.1|localhost):\d+\/?/g;
  for (const match of output.matchAll(regex)) {
    urls.add(normalizeUrl(match[0]));
  }
  return [...urls];
}

async function startTemporaryDevServer() {
  const child = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173'], {
    cwd: ROOT_DIR,
    detached: true,
    env: {
      ...process.env,
      BROWSER: 'none',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';

  child.stdout?.on('data', chunk => {
    output += chunk.toString();
  });
  child.stderr?.on('data', chunk => {
    output += chunk.toString();
  });

  try {
    const appUrl = await waitFor(
      'temporary Vite dev server',
      async () => {
        if (child.exitCode !== null) {
          throw new Error(`temporary Vite dev server exited early with code ${child.exitCode}\n${output}`);
        }

        for (const candidate of [...extractUrls(output), ...candidateAppUrls()]) {
          if (await isLeoAppServer(candidate)) return normalizeUrl(candidate);
        }
        return null;
      },
      DEV_SERVER_START_TIMEOUT_MS,
    ).catch(error => {
      throw new Error(`${error.message}\nTemporary dev server output:\n${output}`);
    });

    return {
      child,
      appUrl,
      pid: child.pid ?? null,
    };
  } catch (error) {
    await terminateTemporaryDevServer(child).catch(() => {});
    throw error;
  }
}

async function terminateTemporaryDevServer(child) {
  if (!child.pid || child.exitCode !== null) {
    return { pid: child.pid ?? null, stopped: child.exitCode !== null, signal: child.signalCode ?? null };
  }

  const closed = new Promise(resolve => {
    child.once('close', (code, signal) => resolve({ code, signal }));
  });

  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    child.kill('SIGTERM');
  }

  const graceful = await Promise.race([
    closed,
    delay(5_000).then(() => null),
  ]);

  if (graceful) {
    return { pid: child.pid, stopped: true, signal: graceful.signal ?? null };
  }

  try {
    process.kill(-child.pid, 'SIGKILL');
  } catch {
    child.kill('SIGKILL');
  }

  const forced = await Promise.race([
    closed,
    delay(2_000).then(() => null),
  ]);

  return {
    pid: child.pid,
    stopped: Boolean(forced),
    signal: forced?.signal ?? 'SIGKILL',
  };
}

function assertNoUnsupportedEvidenceClaim(text, label) {
  const leaks = [];
  for (const [lineIndex, rawLine] of text.split(/\r?\n/).entries()) {
    const normalized = rawLine.replace(/\s+/g, ' ');
    const referencesExtendedCounts = /(19\s*\/\s*37|19[- ]?beam|37[- ]?beam|19\s+or\s+37)/i.test(normalized);
    const referencesEvidence = /trained[- ]baseline MODQN evidence|trained baseline MODQN evidence/i.test(normalized);
    const isNegatedBoundary = /\b(not|no|must not|does not|do not|without|unless|forbidden|reject|remain|remains|sensitivity\/demo|extension only|false|claim boundary)\b/i
      .test(normalized);
    if (referencesExtendedCounts && referencesEvidence && !isNegatedBoundary) {
      leaks.push(`${label}:${lineIndex + 1}: ${normalized.trim()}`);
    }
  }

  assert.equal(leaks.length, 0, `unsupported visible 19/37 trained-baseline claim(s):\n${leaks.join('\n')}`);
}

async function selectLiveStatusTab(page) {
  const tabList = page.locator('.leo-shell-right [role="tablist"]');
  const hasTabs = await tabList.count() > 0;
  if (hasTabs) {
    const liveStatusTab = page
      .locator('.leo-shell-right [role="tab"]')
      .filter({ hasText: 'Live status' });

    await liveStatusTab.waitFor({ timeout: UI_LOAD_TIMEOUT_MS });
    await liveStatusTab.click();
    await expectLiveStatusTabSelected(page);
  }
  await page.locator('.leo-shell-right .leo-live-status-stack').waitFor({ timeout: UI_LOAD_TIMEOUT_MS });
}

async function expectLiveStatusTabSelected(page) {
  const tabList = page.locator('.leo-shell-right [role="tablist"]');
  const hasTabs = await tabList.count() > 0;
  if (!hasTabs) return;
  await page.waitForFunction(() => {
    const tab = [...document.querySelectorAll('.leo-shell-right [role="tab"]')]
      .find(candidate => candidate.textContent?.includes('Live status'));
    return tab?.getAttribute('aria-selected') === 'true';
  }, undefined, { timeout: UI_LOAD_TIMEOUT_MS });
}

async function assertBrowserReadout(appUrl) {
  const consoleErrors = [];
  const pageErrors = [];
  const userDataDir = await mkdtemp(join(tmpdir(), BROWSER_USER_DATA_PREFIX));
  const context = await chromium.launchPersistentContext(userDataDir, {
    viewport: { width: 1440, height: 900 },
    args: [
      '--disable-dev-shm-usage',
      '--use-angle=swiftshader-webgl',
    ],
  });
  const browser = context.browser();
  const browserPid = browser && typeof browser.process === 'function'
    ? browser.process()?.pid ?? null
    : null;

  try {
    await context.addInitScript({
      content: `window.localStorage.setItem(${JSON.stringify(UI_MODE_STORAGE_KEY)}, 'presentation');`,
    });
    const page = context.pages()[0] ?? await context.newPage();
    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', error => {
      pageErrors.push(error.stack || error.message);
    });

    try {
      await page.goto(appUrl, { waitUntil: 'domcontentloaded', timeout: UI_LOAD_TIMEOUT_MS });
      await page.locator('.leo-app-shell[data-ui-mode="presentation"]').waitFor({ timeout: UI_LOAD_TIMEOUT_MS });
      await selectLiveStatusTab(page);
      await page.locator('.leo-shell-right .leo-info-panel').waitFor({ timeout: UI_LOAD_TIMEOUT_MS });
      const canvas = page.locator('.leo-shell-canvas canvas');
      await canvas.waitFor({ timeout: UI_LOAD_TIMEOUT_MS });
      const canvasBox = await canvas.boundingBox();
      assert.ok(canvasBox && canvasBox.width > 100 && canvasBox.height > 100, `runtime canvas did not load with usable dimensions: ${JSON.stringify(canvasBox)}`);

      await page.locator('select[aria-label="UI mode"]').selectOption('diagnostics');
      await page.locator('.leo-app-shell[data-ui-mode="diagnostics"]').waitFor({ timeout: 5_000 });

      const drawer = page.locator('[data-testid="diagnostics-drawer"]');
      await drawer.waitFor({ timeout: 5_000 });
      await page.waitForFunction(() => {
        const node = document.querySelector('[data-testid="diagnostics-drawer"]');
        return node?.getAttribute('data-drawer-state') === 'expanded';
      }, undefined, { timeout: 5_000 });
      assert.equal(
        await drawer.getAttribute('data-drawer-state'),
        'expanded',
        'diagnostics drawer should be expanded in diagnostics mode',
      );

      await page.locator('[data-testid="visual-frequency-diagnostics"]').waitFor({ timeout: 5_000 });
      await page.waitForFunction(labels => {
        const text = document.querySelector('[data-testid="visual-frequency-diagnostics"]')?.textContent ?? '';
        return labels.every(label => text.includes(label));
      }, REQUIRED_ROW_LABELS, { timeout: 5_000 });

      const drawerText = await drawer.innerText();
      const normalizedDrawerText = normalizeText(drawerText);
      assert.ok(
        normalizedDrawerText.includes('VISUAL FREQUENCY SOURCE'),
        'visual frequency source section was not visible',
      );

      for (const label of REQUIRED_ROW_LABELS) {
        assert.ok(normalizedDrawerText.includes(label), `diagnostics drawer did not render row label: ${label}`);
      }

      const visibleSources = SOURCE_STRINGS.filter(source => normalizedDrawerText.includes(source));
      assert.ok(
        visibleSources.length > 0,
        `diagnostics drawer did not show a valid visual frequency source string: ${SOURCE_STRINGS.join(', ')}`,
      );

      const bodyText = await page.locator('body').innerText();
      assertNoUnsupportedEvidenceClaim(bodyText, 'browser-visible-text');

      assert.deepEqual(pageErrors, [], `uncaught browser page error(s):\n${pageErrors.join('\n')}`);
      assert.deepEqual(consoleErrors, [], `browser console error(s):\n${consoleErrors.join('\n')}`);

      return {
        appUrl,
        browserPid,
        browserUserDataDir: userDataDir,
        rightSidebarTab: 'Live status',
        drawerState: 'expanded',
        canvas: {
          width: Math.round(canvasBox.width),
          height: Math.round(canvasBox.height),
        },
        visibleSection: 'VISUAL FREQUENCY SOURCE',
        requiredRows: REQUIRED_ROW_LABELS,
        visibleSources,
        consoleErrors: consoleErrors.length,
        pageErrors: pageErrors.length,
        unsupportedVisibleClaims: 0,
      };
    } finally {
      await page.close().catch(() => {});
    }
  } finally {
    await context.close().catch(() => {});
    await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
  }
}

function formatProcess(processInfo) {
  return {
    pid: processInfo.pid,
    ppid: processInfo.ppid,
    stat: processInfo.stat,
    cmd: processInfo.cmd,
  };
}

async function cleanupOwnedRuntimeProcesses(beforeProcesses) {
  const beforePids = new Set(beforeProcesses.map(processInfo => processInfo.pid));
  const findOwnedProcesses = processes => ({
    newDevServerProcesses: processes.filter(processInfo => (
      isDevServerProcess(processInfo)
      && !beforePids.has(processInfo.pid)
    )),
    phase5dBrowserProcesses: processes.filter(processInfo => (
      processInfo.cmd.includes(BROWSER_USER_DATA_PREFIX)
    )),
  });

  const firstPass = findOwnedProcesses(await readRuntimeProcesses());
  const ownedProcesses = [
    ...firstPass.newDevServerProcesses,
    ...firstPass.phase5dBrowserProcesses,
  ];
  const killedProcessIds = [];

  for (const processInfo of ownedProcesses) {
    try {
      process.kill(processInfo.pid, 'SIGTERM');
      killedProcessIds.push(processInfo.pid);
    } catch {
      // It may have exited between process inspection and termination.
    }
  }

  if (killedProcessIds.length > 0) {
    await delay(750);
  }

  const finalPass = findOwnedProcesses(await readRuntimeProcesses());

  return {
    killedProcessIds,
    newDevServerProcessesAfterCleanup: finalPass.newDevServerProcesses.map(formatProcess),
    phase5dBrowserProcessesAfterCleanup: finalPass.phase5dBrowserProcesses.map(formatProcess),
  };
}

async function main() {
  const beforeProcesses = await readRuntimeProcesses();
  const existingAppUrl = await resolveExistingAppUrl();
  let temporaryServer = null;
  let appUrl = existingAppUrl;
  let browserResult;
  let validationError = null;
  let processCleanup = null;
  let devServerCleanup = {
    reusedDevServer: Boolean(existingAppUrl),
    keptDevServer: existingAppUrl,
    temporaryDevServerPid: null,
    stoppedTemporaryDevServer: null,
  };

  try {
    if (!appUrl) {
      temporaryServer = await startTemporaryDevServer();
      appUrl = temporaryServer.appUrl;
      devServerCleanup = {
        reusedDevServer: false,
        keptDevServer: null,
        temporaryDevServerPid: temporaryServer.pid,
        stoppedTemporaryDevServer: null,
      };
    }

    browserResult = await assertBrowserReadout(appUrl);
  } catch (error) {
    validationError = error;
  } finally {
    if (temporaryServer) {
      devServerCleanup.stoppedTemporaryDevServer = await terminateTemporaryDevServer(temporaryServer.child);
    }
    processCleanup = await cleanupOwnedRuntimeProcesses(beforeProcesses);
  }

  const remainingOwnedProcesses = [
    ...processCleanup.newDevServerProcessesAfterCleanup,
    ...processCleanup.phase5dBrowserProcessesAfterCleanup,
  ];
  assert.equal(
    remainingOwnedProcesses.length,
    0,
    `owned runtime process(es) remained after cleanup:\n${JSON.stringify(remainingOwnedProcesses, null, 2)}`,
  );

  if (validationError) {
    console.error(JSON.stringify({
      runtimeHygiene: {
        before: summarizeProcesses(beforeProcesses),
        devServer: devServerCleanup,
        processCleanup,
      },
      result: 'FAIL',
    }, null, 2));
    throw validationError;
  }

  console.log('MODQN Phase 5D frequency diagnostics browser validation passed.');
  console.log(JSON.stringify({
    runtimeHygiene: {
      before: summarizeProcesses(beforeProcesses),
      devServer: devServerCleanup,
      browser: {
        pid: browserResult.browserPid,
        closed: true,
      },
      processCleanup,
    },
    browser: browserResult,
    claimBoundary: {
      visibleTextUnsupported19Or37TrainedBaselineClaims: 0,
    },
    result: 'PASS',
  }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
