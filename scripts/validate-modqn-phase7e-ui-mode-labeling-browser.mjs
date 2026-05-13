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
const BROWSER_USER_DATA_PREFIX = 'leo-beam-sim-phase7e-browser-';
const REQUEST_TIMEOUT_MS = 900;
const DEV_SERVER_START_TIMEOUT_MS = 30_000;
const UI_LOAD_TIMEOUT_MS = 30_000;

const REQUIRED_VISIBLE_TEXT = [
  'MODQN replay - 7-beam producer artifact',
  'accepted-7beam-baseline',
  'newly regenerated / re-promoted',
  'not recovered frozen artifact',
  'not full paper-faithful reproduction',
  'HOBS/SINR live',
  'HOBS/SINR controls do not modify MODQN replay artifact truth',
  'Sensitivity/demo',
  '7 = baseline MODQN evidence path',
  '19/37 = sensitivity/demo only',
];

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'narrow', width: 390, height: 844 },
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
  return {
    relevantProcessCount: processes.length,
    devServerProcesses: processes.filter(isDevServerProcess).map(formatProcess),
    browserAutomationProcessCount: processes.filter(isBrowserAutomationProcess).length,
  };
}

function candidateAppUrls() {
  return [
    'http://127.0.0.1:3000/',
    'http://localhost:3000/',
    'http://127.0.0.1:5173/',
    'http://127.0.0.1:5174/',
    'http://127.0.0.1:5175/',
    'http://127.0.0.1:4173/',
    'http://localhost:5173/',
    'http://localhost:4173/',
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

function rectOverlapArea(a, b) {
  const left = Math.max(a.x, b.x);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const top = Math.max(a.y, b.y);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  return Math.max(0, right - left) * Math.max(0, bottom - top);
}

async function requiredBox(page, selector, label) {
  const box = await page.locator(selector).boundingBox();
  assert.ok(box, `${label} was not visible`);
  return box;
}

function assertNoUnsupportedEvidenceClaim(text, label) {
  const leaks = [];
  const chunks = text.split(/(?:\r?\n|[.;|])/u);
  for (const [chunkIndex, rawChunk] of chunks.entries()) {
    const normalized = rawChunk.replace(/\s+/g, ' ');
    const referencesExtendedCounts = /(19\s*\/\s*37|19[- ]?beam|37[- ]?beam|19\s+or\s+37)/i.test(normalized);
    const referencesEvidence = /trained[- ]baseline MODQN evidence|trained baseline MODQN evidence/i.test(normalized);
    const isNegatedBoundary = /\b(not|no|must not|does not|do not|without|unless|forbidden|reject|remain|remains|sensitivity\/demo|extension only|false|claim boundary)\b/i
      .test(normalized);
    if (referencesExtendedCounts && referencesEvidence && !isNegatedBoundary) {
      leaks.push(`${label}:chunk-${chunkIndex + 1}: ${normalized.trim()}`);
    }
  }

  assert.equal(leaks.length, 0, `unsupported visible 19/37 trained-baseline claim(s):\n${leaks.join('\n')}`);
}

function assertNoHobsReplayEvidenceClaim(text, label) {
  const leaks = [];
  const chunks = text.split(/(?:\r?\n|[.;|])/u);
  for (const [chunkIndex, rawChunk] of chunks.entries()) {
    const normalized = rawChunk.replace(/\s+/g, ' ');
    const referencesHobs = /\b(HOBS\/SINR|HOBS|SINR live|live SINR)\b/i.test(normalized);
    const referencesReplayEvidence = /MODQN replay evidence|producer replay evidence|MODQN replay artifact truth/i.test(normalized);
    const isNegatedBoundary = /\b(not|no|must not|does not|do not|without|unless|forbidden|separate|only)\b/i.test(normalized);
    if (referencesHobs && referencesReplayEvidence && !isNegatedBoundary) {
      leaks.push(`${label}:chunk-${chunkIndex + 1}: ${normalized.trim()}`);
    }
  }

  assert.equal(leaks.length, 0, `HOBS/SINR-as-MODQN-replay-evidence claim leak(s):\n${leaks.join('\n')}`);
}

async function assertViewport(page, viewport) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(page.url(), { waitUntil: 'domcontentloaded', timeout: UI_LOAD_TIMEOUT_MS });
  await page.locator('.leo-app-shell[data-ui-mode="presentation"]').waitFor({ timeout: UI_LOAD_TIMEOUT_MS });
  await page.locator('[data-testid="mode-evidence-strip"]').waitFor({ timeout: UI_LOAD_TIMEOUT_MS });
  await page.locator('.leo-shell-canvas canvas').waitFor({ timeout: UI_LOAD_TIMEOUT_MS });

  const rawBodyText = await page.locator('body').innerText();
  const bodyText = normalizeText(rawBodyText);
  for (const expected of REQUIRED_VISIBLE_TEXT) {
    assert.ok(bodyText.includes(expected), `${viewport.name} viewport missing visible label text: ${expected}`);
  }

  const stripBox = await requiredBox(page, '[data-testid="mode-evidence-strip"]', `${viewport.name} evidence strip`);
  const replayBox = await requiredBox(page, '[data-testid="modqn-replay-evidence-label"]', `${viewport.name} replay label`);
  const liveBox = await requiredBox(page, '[data-testid="hobs-sinr-live-label"]', `${viewport.name} live label`);
  const sensitivityBox = await requiredBox(page, '[data-testid="sensitivity-demo-boundary-label"]', `${viewport.name} sensitivity label`);
  const canvasSlotBox = await requiredBox(page, '.leo-shell-canvas', `${viewport.name} canvas slot`);
  const shellRowBox = await requiredBox(page, '.leo-shell-row', `${viewport.name} shell row`);
  const controlBarBox = await requiredBox(page, '.leo-control-bar', `${viewport.name} control bar`);
  const leftSlotBox = await requiredBox(page, '.leo-shell-left', `${viewport.name} left slot`);
  const rightSlotBox = await requiredBox(page, '.leo-shell-right', `${viewport.name} right slot`);

  assert.ok(stripBox.width <= viewport.width + 1, `${viewport.name} evidence strip overflowed the viewport`);
  assert.ok(stripBox.height <= 175, `${viewport.name} evidence strip grew beyond compact label-strip height: ${JSON.stringify(stripBox)}`);
  assert.ok(
    controlBarBox.y + controlBarBox.height <= stripBox.y + 1,
    `${viewport.name} evidence strip overlapped or preceded the control bar unexpectedly`,
  );
  assert.ok(
    stripBox.y + stripBox.height <= shellRowBox.y + 1,
    `${viewport.name} evidence strip overlapped the scene/control row`,
  );

  for (const [label, box] of [
    ['replay', replayBox],
    ['live', liveBox],
    ['sensitivity', sensitivityBox],
  ]) {
    assert.ok(box.x >= stripBox.x - 1, `${viewport.name} ${label} label escaped left of strip`);
    assert.ok(box.x + box.width <= stripBox.x + stripBox.width + 1, `${viewport.name} ${label} label escaped right of strip`);
  }

  assert.equal(rectOverlapArea(stripBox, controlBarBox), 0, `${viewport.name} evidence strip overlapped the control bar`);
  assert.equal(rectOverlapArea(stripBox, canvasSlotBox), 0, `${viewport.name} evidence strip overlapped the scene canvas`);
  assert.equal(rectOverlapArea(stripBox, leftSlotBox), 0, `${viewport.name} evidence strip overlapped the live tuning slot`);
  assert.equal(rectOverlapArea(stripBox, rightSlotBox), 0, `${viewport.name} evidence strip overlapped the signal status slot`);

  const liveText = normalizeText(await page.locator('[data-testid="hobs-sinr-live-label"]').innerText());
  assert.ok(
    liveText.includes('HOBS/SINR controls do not modify MODQN replay artifact truth'),
    `${viewport.name} live-control boundary wording drifted: ${liveText}`,
  );

  assertNoUnsupportedEvidenceClaim(rawBodyText, `${viewport.name}-visible-text`);
  assertNoHobsReplayEvidenceClaim(rawBodyText, `${viewport.name}-visible-text`);

  return {
    viewport: viewport.name,
    size: `${viewport.width}x${viewport.height}`,
    strip: {
      width: Math.round(stripBox.width),
      height: Math.round(stripBox.height),
    },
    canvasSlot: {
      width: Math.round(canvasSlotBox.width),
      height: Math.round(canvasSlotBox.height),
    },
    labelsVisible: {
      replay: true,
      live: true,
      sensitivity: true,
    },
    overlapsControlSurfaces: false,
  };
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
      const viewports = [];
      for (const viewport of VIEWPORTS) {
        viewports.push(await assertViewport(page, viewport));
      }

      assert.deepEqual(pageErrors, [], `uncaught browser page error(s):\n${pageErrors.join('\n')}`);
      assert.deepEqual(consoleErrors, [], `browser console error(s):\n${consoleErrors.join('\n')}`);

      return {
        appUrl,
        browserPid,
        browserUserDataDir: userDataDir,
        viewports,
        visibleTextAssertions: REQUIRED_VISIBLE_TEXT,
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
    phase7eBrowserProcesses: processes.filter(processInfo => (
      processInfo.cmd.includes(BROWSER_USER_DATA_PREFIX)
    )),
  });

  const firstPass = findOwnedProcesses(await readRuntimeProcesses());
  const ownedProcesses = [
    ...firstPass.newDevServerProcesses,
    ...firstPass.phase7eBrowserProcesses,
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
    phase7eBrowserProcessesAfterCleanup: finalPass.phase7eBrowserProcesses.map(formatProcess),
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
    ...processCleanup.phase7eBrowserProcessesAfterCleanup,
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

  console.log('MODQN Phase 7E UI mode labeling browser validation passed.');
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
      visibleTextHobsSinrAsModqnReplayEvidenceClaims: 0,
    },
    result: 'PASS',
  }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
