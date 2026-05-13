import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import {
  MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL,
  SELECTED_MODQN_PHASE7C_REPLAY_BUNDLE_PATH,
  createModqnReplayBundleLoadPlan,
  createModqnReplayPlaybackDisplayState,
  createModqnReplayPlaybackShellModel,
  loadModqnReplayEnvelopeFromSurfaceReader,
} from '../src/modqn/replay-bundle/index.ts';

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const UI_MODE_STORAGE_KEY = 'leo-beam-sim.ui-mode.v1';
const REQUEST_TIMEOUT_MS = 900;
const DEV_SERVER_START_TIMEOUT_MS = 30_000;
const UI_LOAD_TIMEOUT_MS = 30_000;

const REQUIRED_VISIBLE_TEXT = [
  'MODQN replay artifact cues',
  'scene-adjacent display only',
  'not live HOBS/SINR state',
  'Selected serving',
  'Previous serving',
  'Handover event',
  'Source slot / focus row',
  'MODQN replay - 7-beam producer artifact',
  'accepted-7beam-baseline',
  'HOBS/SINR live controls separated',
];

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'narrow', width: 390, height: 844 },
];

function normalizeText(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function readSurfaceFromDisk(surface) {
  if (!existsSync(surface.absolutePath)) return undefined;
  return readFileSync(surface.absolutePath, 'utf8');
}

function assertPhase7gCueModel() {
  const plan = createModqnReplayBundleLoadPlan();
  assert.equal(plan.sourcePath, SELECTED_MODQN_PHASE7C_REPLAY_BUNDLE_PATH);
  assert.ok(existsSync(plan.sourcePath), `selected producer artifact is missing: ${plan.sourcePath}`);
  for (const surface of plan.requiredSurfaces) {
    assert.ok(existsSync(surface.absolutePath), `required selected artifact surface is missing: ${surface.relativePath}`);
  }

  const envelope = loadModqnReplayEnvelopeFromSurfaceReader(readSurfaceFromDisk);
  const derivedModel = createModqnReplayPlaybackShellModel(envelope);
  assert.deepEqual(
    MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL,
    derivedModel,
    'Phase 7G cues must consume the same Phase 7F compact display model derived from Phase 7C replay state',
  );

  const firstState = createModqnReplayPlaybackDisplayState(derivedModel, 0, false, true);
  assert.equal(firstState.currentSlot.slotIndex, 1);
  assert.equal(firstState.currentSlot.focusRow.sourceRowIndex, 0);
  assert.equal(firstState.currentSlot.focusRow.previousServing.beamId, 'sat-0-beam-3');
  assert.equal(firstState.currentSlot.focusRow.selectedServing.beamId, 'sat-0-beam-4');
  assert.equal(firstState.currentSlot.focusRow.handoverEventKind, 'intra-satellite-beam-switch');

  const sixthState = createModqnReplayPlaybackDisplayState(derivedModel, 5, false, true);
  assert.equal(sixthState.currentSlot.slotIndex, 6);
  assert.equal(sixthState.currentSlot.focusRow.sourceRowIndex, 500);
  assert.equal(sixthState.currentSlot.focusRow.previousServing.beamId, 'sat-0-beam-4');
  assert.equal(sixthState.currentSlot.focusRow.selectedServing.beamId, 'sat-0-beam-4');
  assert.equal(sixthState.currentSlot.focusRow.handoverEventKind, 'none');

  assert.equal(derivedModel.eventCounts['intra-satellite-beam-switch'], 85);
  assert.equal(derivedModel.eventCounts.none, 915);
  assert.equal(derivedModel.eventCounts['inter-satellite-handover'], 0);

  return {
    sourcePath: derivedModel.sourcePath,
    rowCount: derivedModel.rowCount,
    slotCount: derivedModel.slotCount,
    eventCounts: derivedModel.eventCounts,
    cueSource: 'phase7f-playback-display-state',
  };
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

function formatProcess(processInfo) {
  return {
    pid: processInfo.pid,
    ppid: processInfo.ppid,
    stat: processInfo.stat,
    cmd: processInfo.cmd,
  };
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

function testIdSelector(testId) {
  return `[data-testid="${testId}"]`;
}

async function readVisibleBox(page, selector) {
  return page.evaluate(sel => {
    const element = document.querySelector(sel);
    if (!(element instanceof HTMLElement)) return null;
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    if (
      rect.width <= 0
      || rect.height <= 0
      || style.display === 'none'
      || style.visibility === 'hidden'
      || Number(style.opacity) === 0
    ) {
      return null;
    }

    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    };
  }, selector);
}

async function requiredBox(page, selector, label) {
  const box = await waitFor(label, () => readVisibleBox(page, selector), UI_LOAD_TIMEOUT_MS);
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
    const isNegatedBoundary = /\b(not|no|must not|does not|do not|without|unless|forbidden|separate|separated|only)\b/i
      .test(normalized);
    if (referencesHobs && referencesReplayEvidence && !isNegatedBoundary) {
      leaks.push(`${label}:chunk-${chunkIndex + 1}: ${normalized.trim()}`);
    }
  }

  assert.equal(leaks.length, 0, `HOBS/SINR-as-MODQN-replay-evidence claim leak(s):\n${leaks.join('\n')}`);
}

async function textOf(page, selector) {
  const text = await waitFor(
    `text for ${selector}`,
    () => page.evaluate(sel => {
      const element = document.querySelector(sel);
      if (!(element instanceof HTMLElement)) return null;
      return element.innerText || element.textContent || '';
    }, selector),
    UI_LOAD_TIMEOUT_MS,
  );
  return normalizeText(text);
}

async function scrubToSlotOffset(page, slotOffset) {
  const changed = await page.evaluate((nextValue) => {
    const input = document.querySelector('[data-testid="modqn-replay-scrub"]');
    if (!(input instanceof HTMLInputElement)) return false;
    const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (valueSetter) {
      valueSetter.call(input, String(nextValue));
    } else {
      input.value = String(nextValue);
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, slotOffset);
  assert.equal(changed, true, 'MODQN replay scrub control was not available');
}

async function clickTestId(page, testId) {
  await waitFor(
    `visible ${testId} control`,
    () => readVisibleBox(page, testIdSelector(testId)),
    UI_LOAD_TIMEOUT_MS,
  );
  const clicked = await page.evaluate(id => {
    const element = document.querySelector(`[data-testid="${id}"]`);
    if (!(element instanceof HTMLElement)) return false;
    element.click();
    return true;
  }, testId);
  assert.equal(clicked, true, `${testId} control was not available`);
}

async function assertCueState(page, expected) {
  await requiredBox(page, '[data-testid="modqn-replay-scene-cues"]', 'MODQN replay scene cues');

  const cueAttrs = await page.evaluate(() => {
    const element = document.querySelector('[data-testid="modqn-replay-scene-cues"]');
    return {
      currentSourceSlot: element?.getAttribute('data-current-source-slot') ?? null,
      focusSourceRow: element?.getAttribute('data-focus-source-row') ?? null,
      handoverEventKind: element?.getAttribute('data-handover-event-kind') ?? null,
    };
  });
  assert.equal(cueAttrs.currentSourceSlot, String(expected.slotIndex));
  assert.equal(cueAttrs.focusSourceRow, String(expected.sourceRowNumber));
  assert.equal(cueAttrs.handoverEventKind, expected.eventKind);
  assert.match(await textOf(page, '[data-testid="modqn-replay-scene-cue-selected"]'), expected.selectedPattern);
  assert.match(await textOf(page, '[data-testid="modqn-replay-scene-cue-previous"]'), expected.previousPattern);
  assert.match(await textOf(page, '[data-testid="modqn-replay-scene-cue-event"]'), expected.eventPattern);
  assert.match(await textOf(page, '[data-testid="modqn-replay-scene-cue-focus"]'), expected.focusPattern);
}

async function assertSceneCueInteraction(page, viewportName) {
  await clickTestId(page, 'modqn-replay-reset');
  await requiredBox(page, '[data-testid="modqn-replay-current-slot"]', `${viewportName} replay current slot`);

  assert.match(await textOf(page, '[data-testid="modqn-replay-current-slot"]'), /1 \/ 10/);
  await assertCueState(page, {
    slotIndex: 1,
    sourceRowNumber: 1,
    eventKind: 'intra-satellite-beam-switch',
    selectedPattern: /Selected serving sat-0 \/ beam 5 sat-0-beam-4 \| action 4 \| global beam 5/,
    previousPattern: /Previous serving sat-0 \/ beam 4 sat-0-beam-3 \| action 3 \| global beam 4/,
    eventPattern: /Handover event intra-satellite beam switch artifact event kind intra-satellite-beam-switch/,
    focusPattern: /Source slot \/ focus row slot 1, row 1 user-0\|0 of 1000 rows/,
  });

  await scrubToSlotOffset(page, 5);
  await waitFor(
    `${viewportName} scrubbed replay scene cue slot`,
    () => page.evaluate(() => (
      document.querySelector('[data-testid="modqn-replay-scene-cues"]')?.getAttribute('data-current-source-slot') === '6'
        ? true
        : null
    )),
    UI_LOAD_TIMEOUT_MS,
  );

  assert.match(await textOf(page, '[data-testid="modqn-replay-current-slot"]'), /6 \/ 10/);
  assert.match(await textOf(page, '[data-testid="modqn-replay-current-focus-row"]'), /501 \/ 1000/);
  await assertCueState(page, {
    slotIndex: 6,
    sourceRowNumber: 501,
    eventKind: 'none',
    selectedPattern: /Selected serving sat-0 \/ beam 5 sat-0-beam-4 \| action 4 \| global beam 5/,
    previousPattern: /Previous serving sat-0 \/ beam 5 sat-0-beam-4 \| action 4 \| global beam 5/,
    eventPattern: /Handover event none artifact event kind none/,
    focusPattern: /Source slot \/ focus row slot 6, row 501 user-0\|0 of 1000 rows/,
  });

  await clickTestId(page, 'modqn-replay-reset');
  await waitFor(
    `${viewportName} reset replay scene cue slot`,
    () => page.evaluate(() => (
      document.querySelector('[data-testid="modqn-replay-scene-cues"]')?.getAttribute('data-current-source-slot') === '1'
        ? true
        : null
    )),
    UI_LOAD_TIMEOUT_MS,
  );
  await clickTestId(page, 'modqn-replay-play-toggle');
  await waitFor(
    `${viewportName} playing replay scene cue slot`,
    () => page.evaluate(() => {
      const slot = document.querySelector('[data-testid="modqn-replay-scene-cues"]')?.getAttribute('data-current-source-slot');
      return slot !== null && slot !== '1' ? slot : null;
    }),
    10_000,
  );
  await clickTestId(page, 'modqn-replay-play-toggle');

  assert.doesNotMatch(
    await textOf(page, '[data-testid="modqn-replay-current-slot"]'),
    /1 \/ 10/,
    `${viewportName} play should advance the Phase 7G cue source slot`,
  );
  assert.notEqual(
    await page.evaluate(() => (
      document.querySelector('[data-testid="modqn-replay-scene-cues"]')?.getAttribute('data-current-source-slot') ?? null
    )),
    '1',
    `${viewportName} replay scene cue layer did not track play/pause stepping`,
  );
  assert.match(await textOf(page, '[data-testid="modqn-replay-scene-cue-event"]'), /\bnone\b/);
}

async function assertViewport(page, viewport) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(page.url(), { waitUntil: 'domcontentloaded', timeout: UI_LOAD_TIMEOUT_MS });
  await requiredBox(page, '.leo-app-shell[data-ui-mode="presentation"]', `${viewport.name} presentation app shell`);
  await requiredBox(page, '[data-testid="mode-evidence-strip"]', `${viewport.name} evidence strip`);
  await requiredBox(page, '[data-testid="modqn-replay-playback-shell"]', `${viewport.name} replay playback shell`);
  await requiredBox(page, '[data-testid="modqn-replay-scene-cues"]', `${viewport.name} replay scene cues`);
  await requiredBox(page, '.leo-shell-canvas canvas', `${viewport.name} scene canvas`);

  const rawBodyText = await page.evaluate(() => document.body.innerText);
  const bodyText = normalizeText(rawBodyText);
  for (const expected of REQUIRED_VISIBLE_TEXT) {
    assert.ok(bodyText.includes(expected), `${viewport.name} viewport missing visible cue text: ${expected}`);
  }

  const controlBarBox = await requiredBox(page, '.leo-control-bar', `${viewport.name} control bar`);
  const evidenceBox = await requiredBox(page, '[data-testid="mode-evidence-strip"]', `${viewport.name} evidence strip`);
  const playbackBox = await requiredBox(page, '[data-testid="modqn-replay-playback-shell"]', `${viewport.name} replay playback shell`);
  const cueBox = await requiredBox(page, '[data-testid="modqn-replay-scene-cues"]', `${viewport.name} replay scene cues`);
  const shellRowBox = await requiredBox(page, '.leo-shell-row', `${viewport.name} shell row`);
  const canvasSlotBox = await requiredBox(page, '.leo-shell-canvas', `${viewport.name} canvas slot`);
  const liveTuningBox = await requiredBox(page, '.leo-shell-left', `${viewport.name} live tuning slot`);
  const liveStatusBox = await requiredBox(page, '.leo-shell-right', `${viewport.name} live status slot`);

  assert.ok(cueBox.width <= viewport.width + 1, `${viewport.name} cue layer overflowed the viewport`);
  assert.ok(cueBox.height <= 120, `${viewport.name} cue layer grew beyond compact scene-adjacent height`);
  assert.ok(evidenceBox.y + evidenceBox.height <= playbackBox.y + 1, `${viewport.name} playback shell overlapped evidence strip`);
  assert.ok(playbackBox.y + playbackBox.height <= cueBox.y + 1, `${viewport.name} replay cues overlapped playback shell`);
  assert.ok(cueBox.y + cueBox.height <= shellRowBox.y + 1, `${viewport.name} replay cues overlapped live scene row`);

  assert.equal(rectOverlapArea(cueBox, controlBarBox), 0, `${viewport.name} replay cues overlapped control bar`);
  assert.equal(rectOverlapArea(cueBox, evidenceBox), 0, `${viewport.name} replay cues overlapped evidence strip`);
  assert.equal(rectOverlapArea(cueBox, playbackBox), 0, `${viewport.name} replay cues overlapped playback shell`);
  assert.equal(rectOverlapArea(cueBox, canvasSlotBox), 0, `${viewport.name} replay cues overlapped scene canvas`);
  assert.equal(rectOverlapArea(cueBox, liveTuningBox), 0, `${viewport.name} replay cues overlapped HOBS/SINR live tuning slot`);
  assert.equal(rectOverlapArea(cueBox, liveStatusBox), 0, `${viewport.name} replay cues overlapped HOBS/SINR live status slot`);

  const cueText = await textOf(page, '[data-testid="modqn-replay-scene-cues"]');
  assert.ok(cueText.includes('MODQN replay artifact cues'), `${viewport.name} cue label missing artifact source`);
  assert.ok(cueText.includes('not live HOBS/SINR state'), `${viewport.name} replay/live separation label missing`);
  assert.ok(bodyText.includes('HOBS/SINR live'), `${viewport.name} live mode label missing`);

  await assertSceneCueInteraction(page, viewport.name);
  await requiredBox(page, '[data-testid="modqn-replay-scene-cue-focus"]', `${viewport.name} focus row scene cue`);

  assertNoUnsupportedEvidenceClaim(rawBodyText, `${viewport.name}-visible-text`);
  assertNoHobsReplayEvidenceClaim(rawBodyText, `${viewport.name}-visible-text`);

  return {
    viewport: viewport.name,
    size: `${viewport.width}x${viewport.height}`,
    cueLayer: {
      width: Math.round(cueBox.width),
      height: Math.round(cueBox.height),
    },
    cueInteraction: {
      scrubUpdatedCueSourceSlot: true,
      playPauseUpdatedCueSourceSlot: true,
      replayLiveSeparationVisible: true,
    },
  };
}

async function assertBrowserReadout(appUrl) {
  const consoleErrors = [];
  const pageErrors = [];
  const browser = await chromium.launch({
    args: [
      '--disable-dev-shm-usage',
      '--use-angle=swiftshader-webgl',
    ],
  });
  const browserPid = typeof browser.process === 'function'
    ? browser.process()?.pid ?? null
    : null;
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  try {
    await context.addInitScript({
      content: `window.localStorage.setItem(${JSON.stringify(UI_MODE_STORAGE_KEY)}, 'presentation');`,
    });
    const page = await context.newPage();
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
    await browser.close().catch(() => {});
  }
}

async function cleanupOwnedRuntimeProcesses(beforeProcesses) {
  const beforePids = new Set(beforeProcesses.map(processInfo => processInfo.pid));
  const findOwnedProcesses = processes => ({
    newDevServerProcesses: processes.filter(processInfo => (
      isDevServerProcess(processInfo)
      && !beforePids.has(processInfo.pid)
    )),
    newBrowserAutomationProcesses: processes.filter(processInfo => (
      isBrowserAutomationProcess(processInfo)
      && !beforePids.has(processInfo.pid)
    )),
  });

  const firstPass = findOwnedProcesses(await readRuntimeProcesses());
  const ownedProcesses = [
    ...firstPass.newDevServerProcesses,
    ...firstPass.newBrowserAutomationProcesses,
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

  let finalPass = findOwnedProcesses(await readRuntimeProcesses());
  const forceKilledProcessIds = [];
  for (const processInfo of [
    ...finalPass.newDevServerProcesses,
    ...finalPass.newBrowserAutomationProcesses,
  ]) {
    try {
      process.kill(processInfo.pid, 'SIGKILL');
      forceKilledProcessIds.push(processInfo.pid);
    } catch {
      // It may have exited after the graceful termination pass.
    }
  }

  if (forceKilledProcessIds.length > 0) {
    await delay(750);
    finalPass = findOwnedProcesses(await readRuntimeProcesses());
  }

  return {
    killedProcessIds,
    forceKilledProcessIds,
    newDevServerProcessesAfterCleanup: finalPass.newDevServerProcesses.map(formatProcess),
    newBrowserAutomationProcessesAfterCleanup: finalPass.newBrowserAutomationProcesses.map(formatProcess),
  };
}

async function main() {
  const cueModel = assertPhase7gCueModel();
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
    ...processCleanup.newBrowserAutomationProcessesAfterCleanup,
  ];
  assert.equal(
    remainingOwnedProcesses.length,
    0,
    `owned runtime process(es) remained after cleanup:\n${JSON.stringify(remainingOwnedProcesses, null, 2)}`,
  );

  if (validationError) {
    console.error(JSON.stringify({
      cueModel,
      runtimeHygiene: {
        before: summarizeProcesses(beforeProcesses),
        devServer: devServerCleanup,
        processCleanup,
      },
      result: 'FAIL',
    }, null, 2));
    throw validationError;
  }

  console.log('MODQN Phase 7G replay scene cues browser validation passed.');
  console.log(JSON.stringify({
    cueModel,
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
      observedInterSatelliteHandoverRowsClaimed: 0,
      cueSource: 'phase7f-playback-display-state-only',
    },
    result: 'PASS',
  }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
