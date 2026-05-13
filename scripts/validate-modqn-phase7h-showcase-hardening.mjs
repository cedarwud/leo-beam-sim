import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { chromium } from '@playwright/test';
import {
  MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL,
  SELECTED_MODQN_PHASE7C_REPLAY_BUNDLE_PATH,
  createModqnReplayBundleLoadPlan,
  createModqnReplayPlaybackDisplayState,
  createModqnReplayPlaybackShellModel,
  getModqnReplayPlaybackModelValidationIssue,
  loadModqnReplayEnvelopeFromSurfaceReader,
} from '../src/modqn/replay-bundle/index.ts';
import { ModqnReplayPlaybackShell } from '../src/ui/ModqnReplayPlaybackShell.tsx';
import { ModqnReplaySceneCues } from '../src/ui/ModqnReplaySceneCues.tsx';

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const UI_MODE_STORAGE_KEY = 'leo-beam-sim.ui-mode.v1';
const REQUEST_TIMEOUT_MS = 2_500;
const DEV_SERVER_START_TIMEOUT_MS = 30_000;
const UI_LOAD_TIMEOUT_MS = 30_000;

const REQUIRED_VISIBLE_TEXT = [
  'MODQN replay - 7-beam producer artifact',
  'accepted-7beam-baseline',
  'newly regenerated / re-promoted',
  'not recovered frozen artifact',
  'not full paper-faithful reproduction',
  'HOBS/SINR live',
  'HOBS/SINR live is separate',
  'HOBS/SINR controls do not modify MODQN replay artifact truth',
  'Sensitivity/demo',
  '7 = baseline MODQN evidence path',
  '19/37 = sensitivity/demo only',
  'Baseline MODQN integrated in frontend',
  'Replay evidence loaded',
  'Live handover controls active',
  'Open handover controls',
  'Replay truth is read-only',
  'adjustable live handover simulator',
  'read-only source-slot playback',
  'HOBS/SINR live controls separated',
  'Artifact event total',
  'none 915 | intra-sat 85 | inter-sat 0',
  'MODQN replay artifact cues',
  'scene-adjacent display only',
  'not live HOBS/SINR state',
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

function assertPhase7hDisplayModel() {
  const plan = createModqnReplayBundleLoadPlan();
  assert.equal(plan.sourcePath, SELECTED_MODQN_PHASE7C_REPLAY_BUNDLE_PATH);
  assert.ok(existsSync(plan.sourcePath), `selected producer artifact is missing: ${plan.sourcePath}`);
  for (const surface of plan.requiredSurfaces) {
    assert.ok(
      existsSync(surface.absolutePath),
      `required selected artifact surface is missing: ${surface.relativePath}`,
    );
  }

  const envelope = loadModqnReplayEnvelopeFromSurfaceReader(readSurfaceFromDisk);
  const derivedModel = createModqnReplayPlaybackShellModel(envelope);
  assert.deepEqual(
    MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL,
    derivedModel,
    'Phase 7H default display model must remain derived from the Phase 7C replay envelope',
  );
  assert.equal(getModqnReplayPlaybackModelValidationIssue(derivedModel), null);
  assert.equal(derivedModel.modeLabel, 'MODQN replay - 7-beam producer artifact');
  assert.equal(derivedModel.evidenceStatus, 'accepted-7beam-baseline');
  assert.equal(derivedModel.rowCount, 1000);
  assert.equal(derivedModel.slotCount, 10);
  assert.equal(derivedModel.eventCounts['intra-satellite-beam-switch'], 85);
  assert.equal(derivedModel.eventCounts.none, 915);
  assert.equal(derivedModel.eventCounts['inter-satellite-handover'], 0);

  return {
    sourcePath: derivedModel.sourcePath,
    rowCount: derivedModel.rowCount,
    slotCount: derivedModel.slotCount,
    eventCounts: derivedModel.eventCounts,
    modelValidationIssue: null,
  };
}

function assertFailClosedComponentRender() {
  const invalidModel = {
    ...MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL,
    slots: [],
  };
  const issue = getModqnReplayPlaybackModelValidationIssue(invalidModel);
  assert.ok(issue, 'invalid replay display model should produce a validation issue');
  assert.equal(issue.code, 'missing-slots');

  const playbackHtml = renderToStaticMarkup(
    React.createElement(ModqnReplayPlaybackShell, { model: invalidModel }),
  );
  assert.match(playbackHtml, /MODQN replay unavailable - fail closed/);
  assert.match(playbackHtml, /selected producer artifact missing or invalid/);
  assert.match(playbackHtml, /no fixture fallback promoted/);
  assert.match(playbackHtml, /HOBS\/SINR live remains separate/);
  assert.doesNotMatch(playbackHtml, /Play replay/);

  const cueHtml = renderToStaticMarkup(
    React.createElement(ModqnReplaySceneCues, {
      displayState: null,
      failClosedReason: issue.message,
    }),
  );
  assert.match(cueHtml, /MODQN replay artifact cues unavailable/);
  assert.match(cueHtml, /fail-closed display only/);
  assert.match(cueHtml, /missing or invalid/);
  assert.match(cueHtml, /not live HOBS\/SINR state/);

  return {
    invalidModelIssue: issue,
    playbackFailClosedVisible: true,
    cueFailClosedVisible: true,
    fixtureFallbackPromoted: false,
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
    'http://127.0.0.1:5173/',
    'http://127.0.0.1:5174/',
    'http://127.0.0.1:5175/',
    'http://localhost:5173/',
    'http://127.0.0.1:3000/',
    'http://localhost:3000/',
    'http://127.0.0.1:4173/',
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
  let lastError = null;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const result = await fn();
      if (result !== null) return result;
    } catch (error) {
      lastError = error;
    }
    await delay(intervalMs);
  }
  const suffix = lastError instanceof Error ? ` Last error: ${lastError.message}` : '';
  throw new Error(`Timed out after ${timeoutMs}ms waiting for ${description}.${suffix}`);
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
  const box = await waitFor(
    `visible ${label} (${selector})`,
    () => readVisibleBox(page, selector),
    UI_LOAD_TIMEOUT_MS,
  );
  assert.ok(box, `${label} was missing or hidden: ${selector}`);
  return box;
}

function assertBoxTouchesViewport(box, viewport, label) {
  assert.ok(box.x + box.width > 0, `${label} was left of the viewport`);
  assert.ok(box.x < viewport.width, `${label} was right of the viewport`);
  assert.ok(box.y + box.height > 0, `${label} was above the viewport`);
  assert.ok(box.y < viewport.height, `${label} was below the viewport`);
}

function assertBoxInside(outer, inner, label) {
  const tolerancePx = 1;
  assert.ok(inner.x + tolerancePx >= outer.x, `${label} was left of its container`);
  assert.ok(inner.y + tolerancePx >= outer.y, `${label} was above its container`);
  assert.ok(
    inner.x + inner.width <= outer.x + outer.width + tolerancePx,
    `${label} was right of its container`,
  );
  assert.ok(
    inner.y + inner.height <= outer.y + outer.height + tolerancePx,
    `${label} was below its container`,
  );
}

function assertBoxHorizontallyInside(outer, inner, label) {
  const tolerancePx = 1;
  assert.ok(inner.x + tolerancePx >= outer.x, `${label} was left of its container`);
  assert.ok(
    inner.x + inner.width <= outer.x + outer.width + tolerancePx,
    `${label} was right of its container`,
  );
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

function assertNoObservedInterSatelliteClaim(text, label) {
  const leaks = [];
  const chunks = text.split(/(?:\r?\n|[.;|])/u);
  for (const [chunkIndex, rawChunk] of chunks.entries()) {
    const normalized = rawChunk.replace(/\s+/g, ' ');
    const referencesObservedInterSatellite = /observed\s+inter[- ]satellite\s+handover/i.test(normalized);
    const isZeroOrNegated = /\b(0|zero|no|not|none|without)\b/i.test(normalized);
    if (referencesObservedInterSatellite && !isZeroOrNegated) {
      leaks.push(`${label}:chunk-${chunkIndex + 1}: ${normalized.trim()}`);
    }
  }

  assert.equal(leaks.length, 0, `positive observed inter-satellite handover claim(s):\n${leaks.join('\n')}`);
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
    `visible ${testId} control (${testIdSelector(testId)})`,
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

async function assertReplayInteraction(page, viewportName) {
  await clickTestId(page, 'modqn-replay-reset');
  assert.match(await textOf(page, '[data-testid="modqn-replay-current-slot"]'), /1 \/ 10/);
  assert.match(await textOf(page, '[data-testid="modqn-replay-current-row-range"]'), /1-100 \/ 1000/);
  await assertCueState(page, {
    slotIndex: 1,
    sourceRowNumber: 1,
    eventKind: 'intra-satellite-beam-switch',
    selectedPattern: /sat-0 \/ beam 5/,
    previousPattern: /sat-0 \/ beam 4/,
    eventPattern: /intra-satellite beam switch/,
    focusPattern: /slot 1, row 1/,
  });

  await scrubToSlotOffset(page, 5);
  await waitFor(
    `${viewportName} scrubbed replay source slot`,
    () => page.evaluate(() => (
      document.querySelector('[data-testid="modqn-replay-current-slot"]')?.textContent?.includes('6 / 10')
        ? true
        : null
    )),
    UI_LOAD_TIMEOUT_MS,
  );
  assert.match(await textOf(page, '[data-testid="modqn-replay-current-slot"]'), /6 \/ 10/);
  assert.match(await textOf(page, '[data-testid="modqn-replay-current-row-range"]'), /501-600 \/ 1000/);
  await assertCueState(page, {
    slotIndex: 6,
    sourceRowNumber: 501,
    eventKind: 'none',
    selectedPattern: /sat-0 \/ beam 5/,
    previousPattern: /sat-0 \/ beam 5/,
    eventPattern: /\bnone\b/,
    focusPattern: /slot 6, row 501/,
  });

  await clickTestId(page, 'modqn-replay-reset');
  await clickTestId(page, 'modqn-replay-play-toggle');
  await waitFor(
    `${viewportName} playing replay source slot`,
    () => page.evaluate(() => {
      const text = document.querySelector('[data-testid="modqn-replay-current-slot"]')?.textContent ?? '';
      return !text.includes('1 / 10') ? true : null;
    }),
    10_000,
  );
  await clickTestId(page, 'modqn-replay-play-toggle');
  assert.doesNotMatch(
    await textOf(page, '[data-testid="modqn-replay-current-slot"]'),
    /1 \/ 10/,
    `${viewportName} play should step away from the first source slot`,
  );
  assert.notEqual(
    await page.evaluate(() => (
      document.querySelector('[data-testid="modqn-replay-scene-cues"]')?.getAttribute('data-current-source-slot') ?? null
    )),
    '1',
    `${viewportName} cue layer did not track play/pause stepping`,
  );
}

async function assertViewport(page, viewport) {
  console.error(`[phase7h] checking ${viewport.name} viewport ${viewport.width}x${viewport.height}`);
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(page.url(), { waitUntil: 'domcontentloaded', timeout: UI_LOAD_TIMEOUT_MS });
  await requiredBox(page, '.leo-app-shell[data-ui-mode="presentation"]', `${viewport.name} presentation app shell`);
  await requiredBox(page, '.leo-shell-canvas canvas', `${viewport.name} scene canvas`);
  await page.evaluate(() => {
    document
      .querySelectorAll('details[data-phase7h-open-for-validation="true"]')
      .forEach(element => {
        if (element instanceof HTMLDetailsElement) element.open = true;
      });
  });

  const rawBodyText = await page.evaluate(() => document.body.innerText);
  const bodyText = normalizeText(rawBodyText);
  for (const expected of REQUIRED_VISIBLE_TEXT) {
    assert.ok(bodyText.includes(expected), `${viewport.name} viewport missing visible Phase 7H text: ${expected}`);
  }

  const controlBarBox = await requiredBox(page, '.leo-control-bar', `${viewport.name} control bar`);
  const evidenceBox = await requiredBox(page, '[data-testid="mode-evidence-strip"]', `${viewport.name} evidence strip`);
  const playbackBox = await requiredBox(page, '[data-testid="modqn-replay-playback-shell"]', `${viewport.name} playback shell`);
  const cueBox = await requiredBox(page, '[data-testid="modqn-replay-scene-cues"]', `${viewport.name} cue layer`);
  const shellRowBox = await requiredBox(page, '.leo-shell-row', `${viewport.name} shell row`);
  const canvasSlotBox = await requiredBox(page, '.leo-shell-canvas', `${viewport.name} canvas slot`);
  const liveTuningBox = await requiredBox(page, '.leo-shell-left', `${viewport.name} live tuning slot`);
  const liveStatusBox = await requiredBox(page, '.leo-shell-right', `${viewport.name} live status slot`);
  const modqnSidebarBox = await requiredBox(page, '.leo-modqn-sidebar-stack', `${viewport.name} MODQN replay sidebar stack`);
  const liveHandoverStackBox = await requiredBox(page, '.leo-sidebar-content-stack', `${viewport.name} live handover sidebar stack`);

  for (const [label, box] of [
    ['control bar', controlBarBox],
    ['evidence strip', evidenceBox],
    ['canvas slot', canvasSlotBox],
    ['live tuning slot', liveTuningBox],
    ['live status slot', liveStatusBox],
    ['MODQN replay sidebar stack', modqnSidebarBox],
  ]) {
    assertBoxTouchesViewport(box, viewport, `${viewport.name} ${label}`);
  }

  assert.ok(evidenceBox.width <= viewport.width + 1, `${viewport.name} evidence strip overflowed the viewport`);
  assert.ok(playbackBox.width <= viewport.width + 1, `${viewport.name} playback shell overflowed the viewport`);
  assert.ok(cueBox.width <= viewport.width + 1, `${viewport.name} cue layer overflowed the viewport`);
  assert.ok(evidenceBox.height <= 175, `${viewport.name} evidence strip exceeded compact height`);
  assert.ok(
    shellRowBox.y <= controlBarBox.y + controlBarBox.height + 18,
    `${viewport.name} shell row did not start directly after the control bar`,
  );
  assertBoxHorizontallyInside(liveTuningBox, liveHandoverStackBox, `${viewport.name} live handover sidebar stack`);
  assertBoxHorizontallyInside(liveStatusBox, modqnSidebarBox, `${viewport.name} MODQN replay sidebar stack`);
  assert.ok(
    modqnSidebarBox.y + 1 >= liveStatusBox.y && modqnSidebarBox.y < liveStatusBox.y + liveStatusBox.height,
    `${viewport.name} MODQN replay sidebar stack did not start inside the status slot`,
  );
  assertBoxHorizontallyInside(modqnSidebarBox, evidenceBox, `${viewport.name} evidence strip`);
  assertBoxHorizontallyInside(modqnSidebarBox, playbackBox, `${viewport.name} playback shell`);
  assertBoxHorizontallyInside(modqnSidebarBox, cueBox, `${viewport.name} cue layer`);
  assert.ok(evidenceBox.y + evidenceBox.height <= playbackBox.y + 1, `${viewport.name} playback shell overlapped evidence strip`);
  assert.ok(playbackBox.y + playbackBox.height <= cueBox.y + 1, `${viewport.name} cue layer overlapped playback shell`);

  for (const [label, box] of [
    ['control bar', controlBarBox],
    ['evidence strip', evidenceBox],
    ['scene canvas', canvasSlotBox],
    ['live tuning slot', liveTuningBox],
  ]) {
    assert.equal(rectOverlapArea(cueBox, box), 0, `${viewport.name} cue layer overlapped ${label}`);
  }
  assert.equal(rectOverlapArea(playbackBox, controlBarBox), 0, `${viewport.name} playback shell overlapped control bar`);
  assert.equal(rectOverlapArea(playbackBox, evidenceBox), 0, `${viewport.name} playback shell overlapped evidence strip`);
  assert.equal(rectOverlapArea(playbackBox, canvasSlotBox), 0, `${viewport.name} playback shell overlapped scene canvas`);
  assert.equal(rectOverlapArea(playbackBox, liveTuningBox), 0, `${viewport.name} playback shell overlapped HOBS/SINR tuning slot`);

  const scrollAndOverflowState = await page.evaluate(() => {
    function metrics(selector) {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) return null;
      const style = window.getComputedStyle(element);
      return {
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        overflowY: style.overflowY,
      };
    }
    return {
      liveHandoverStack: metrics('.leo-sidebar-content-stack'),
      modqnStack: metrics('.leo-modqn-sidebar-stack'),
      playbackShell: metrics('[data-testid="modqn-replay-playback-shell"]'),
      cueLayer: metrics('[data-testid="modqn-replay-scene-cues"]'),
    };
  });
  assert.ok(
    ['auto', 'scroll'].includes(scrollAndOverflowState.liveHandoverStack?.overflowY),
    `${viewport.name} live handover sidebar stack did not allow vertical scrolling`,
  );
  assert.ok(
    ['auto', 'scroll'].includes(scrollAndOverflowState.modqnStack?.overflowY),
    `${viewport.name} MODQN sidebar stack did not allow vertical scrolling`,
  );
  assert.equal(
    scrollAndOverflowState.playbackShell?.overflowY,
    'visible',
    `${viewport.name} playback shell should rely on the sidebar scroll area`,
  );
  assert.equal(
    scrollAndOverflowState.cueLayer?.overflowY,
    'visible',
    `${viewport.name} cue layer should rely on the sidebar scroll area`,
  );
  assert.ok(
    scrollAndOverflowState.liveHandoverStack.clientHeight <= liveTuningBox.height + 1,
    `${viewport.name} live handover sidebar stack exceeded its slot instead of scrolling`,
  );
  assert.ok(
    scrollAndOverflowState.modqnStack.clientHeight <= liveStatusBox.height + 1,
    `${viewport.name} MODQN sidebar stack exceeded its slot instead of scrolling`,
  );

  const playbackState = await page.locator('[data-testid="modqn-replay-playback-shell"]').getAttribute('data-replay-state');
  assert.notEqual(playbackState, 'fail-closed', `${viewport.name} valid selected artifact unexpectedly rendered fail closed`);
  assert.ok(bodyText.includes('HOBS/SINR live is separate'), `${viewport.name} replay/live separation text missing`);
  assert.ok(!bodyText.includes('trained-baseline evidence for 19'), `${viewport.name} leaked 19-beam trained-baseline wording`);
  assert.ok(!bodyText.includes('trained-baseline evidence for 37'), `${viewport.name} leaked 37-beam trained-baseline wording`);

  await assertReplayInteraction(page, viewport.name);
  console.error(`[phase7h] ${viewport.name} replay interaction checks passed`);

  const finalRawBodyText = await page.evaluate(() => document.body.innerText);
  assertNoUnsupportedEvidenceClaim(finalRawBodyText, `${viewport.name}-visible-text`);
  assertNoHobsReplayEvidenceClaim(finalRawBodyText, `${viewport.name}-visible-text`);
  assertNoObservedInterSatelliteClaim(finalRawBodyText, `${viewport.name}-visible-text`);

  return {
    viewport: viewport.name,
    size: `${viewport.width}x${viewport.height}`,
    surfacesVisible: {
      evidenceStrip: true,
      playbackShell: true,
      cueLayer: true,
      sceneCanvas: true,
      liveSidePanels: true,
    },
    compactHeights: {
      evidenceStrip: Math.round(evidenceBox.height),
      playbackShell: Math.round(playbackBox.height),
      cueLayer: Math.round(cueBox.height),
    },
    replayInteraction: {
      scrubUpdatedSourceSlotAndCueText: true,
      playPauseUpdatedSourceSlotAndCueText: true,
      resetReturnedToFirstSourceSlot: true,
    },
    visibleClaimLeaks: 0,
  };
}

async function assertBrowserReadout(appUrl) {
  const consoleErrors = [];
  const pageErrors = [];
  console.error(`[phase7h] launching Chromium for ${appUrl}`);
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
  console.error('[phase7h] checking selected replay display model');
  const displayModel = assertPhase7hDisplayModel();
  console.error('[phase7h] checking fail-closed component rendering');
  const failClosedRender = assertFailClosedComponentRender();
  console.error('[phase7h] inspecting runtime processes');
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
      displayModel,
      failClosedRender,
      runtimeHygiene: {
        before: summarizeProcesses(beforeProcesses),
        devServer: devServerCleanup,
        processCleanup,
      },
      result: 'FAIL',
    }, null, 2));
    throw validationError;
  }

  console.log('MODQN Phase 7H showcase hardening browser validation passed.');
  console.log(JSON.stringify({
    displayModel,
    failClosedRender,
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
      visibleTextPositiveObservedInterSatelliteHandoverClaims: 0,
      currentArtifactEventCounts: {
        intraSatelliteBeamSwitchRows: 85,
        noneRows: 915,
        observedInterSatelliteHandoverRows: 0,
      },
    },
    result: 'PASS',
  }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
