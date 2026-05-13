import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import {
  MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL,
  MODQN_REPLAY_7BEAM_EVIDENCE_STATUS,
  MODQN_REPLAY_7BEAM_MODE_KEY,
  MODQN_REPLAY_7BEAM_MODE_LABEL,
  SELECTED_MODQN_PHASE7C_REPLAY_BUNDLE_PATH,
  createModqnReplayBundleLoadPlan,
  createModqnReplayPlaybackShellModel,
  loadModqnReplayEnvelopeFromSurfaceReader,
} from '../src/modqn/replay-bundle/index.ts';

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const UI_MODE_STORAGE_KEY = 'leo-beam-sim.ui-mode.v1';
const REQUEST_TIMEOUT_MS = 900;
const DEV_SERVER_START_TIMEOUT_MS = 30_000;
const UI_LOAD_TIMEOUT_MS = 30_000;

const REQUIRED_DEFAULT_VISIBLE_TEXT = [
  'MODQN replay - 7-beam producer artifact',
  'accepted-7beam-baseline',
  'MODQN replay',
  'baseline evidence',
  'Play replay',
  'Reset',
  'Loop',
  'Scrub source slot',
  'Replay/live boundary',
  'Source slot details',
  'Producer truth details',
  'Baseline MODQN integrated in frontend',
  'Replay evidence loaded',
  'Live handover controls active',
  'Open handover controls',
];

const REQUIRED_DISCLOSURE_TEXT = [
  'newly regenerated / re-promoted',
  'not recovered frozen artifact',
  'not full paper-faithful reproduction',
  'HOBS/SINR live',
  'HOBS/SINR live is separate',
  'HOBS/SINR controls do not modify MODQN replay artifact truth',
  'Sensitivity/demo',
  '7 = baseline MODQN evidence path',
  '19/37 = sensitivity/demo only',
  'Replay truth is read-only',
  'adjustable live handover simulator',
  'read-only source-slot playback',
  'producer diagnostics present-from-producer',
  'HOBS/SINR live controls separated',
  'Current slot',
  'Source rows',
  'Focus source row',
  'Selected serving',
  'Previous serving',
  'Handover event',
  'Scalar reward',
  'Reward vector',
  'Diagnostics',
  'Artifact event total',
  'none 915 | intra-sat 85 | inter-sat 0',
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

function assertPhase7fPlaybackModel() {
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
    'Phase 7F compact display model must be derived from the Phase 7C replay envelope',
  );
  assert.equal(derivedModel.modeKey, MODQN_REPLAY_7BEAM_MODE_KEY);
  assert.equal(derivedModel.modeLabel, MODQN_REPLAY_7BEAM_MODE_LABEL);
  assert.equal(derivedModel.evidenceStatus, MODQN_REPLAY_7BEAM_EVIDENCE_STATUS);
  assert.equal(derivedModel.sourceOwner, 'modqn-paper-reproduction');
  assert.equal(derivedModel.stepKind, 'source-slot');
  assert.equal(derivedModel.rowCount, 1000);
  assert.equal(derivedModel.slotCount, 10);
  assert.equal(derivedModel.eventCounts['intra-satellite-beam-switch'], 85);
  assert.equal(derivedModel.eventCounts.none, 915);
  assert.equal(derivedModel.eventCounts['inter-satellite-handover'], 0);
  assert.equal(derivedModel.diagnosticsStatus, 'present-from-producer');

  for (const [slotOffset, slot] of derivedModel.slots.entries()) {
    assert.equal(slot.slotIndex, slotOffset + 1, `slot ${slotOffset} must keep producer slot index`);
    assert.equal(slot.rowCount, 100, `slot ${slot.slotIndex} must keep source row count`);
    assert.equal(slot.sourceRowStartIndex, slotOffset * 100);
    assert.equal(slot.sourceRowEndIndex, slotOffset * 100 + 99);
    assert.equal(slot.focusRow.sourceRowIndex, slot.sourceRowStartIndex);
    assert.equal(slot.focusRow.slotRowIndex, 0);
    assert.equal(slot.focusRow.diagnosticsStatus, 'present-from-producer');
    assert.equal(slot.focusRow.availableActionCount, 7);
  }

  return {
    sourcePath: derivedModel.sourcePath,
    rowCount: derivedModel.rowCount,
    slotCount: derivedModel.slotCount,
    eventCounts: derivedModel.eventCounts,
    diagnosticsStatus: derivedModel.diagnosticsStatus,
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
  const suffix = lastError instanceof Error
    ? ` Last error: ${lastError.message}`
    : '';
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

async function scrollElementIntoView(page, selector, label) {
  const scrolled = await page.evaluate(sel => {
    const element = document.querySelector(sel);
    if (!(element instanceof HTMLElement)) return false;
    element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    return true;
  }, selector);
  assert.equal(scrolled, true, `${label} was missing before scroll: ${selector}`);
  return requiredBox(page, selector, label);
}

async function assertPlaybackInteraction(page, viewportName) {
  await clickTestId(page, 'modqn-replay-reset');
  await requiredBox(page, '[data-testid="modqn-replay-current-slot"]', `${viewportName} current replay slot`);

  assert.match(await textOf(page, '[data-testid="modqn-replay-current-slot"]'), /1 \/ 10/);
  assert.match(await textOf(page, '[data-testid="modqn-replay-current-row-range"]'), /1-100 \/ 1000/);
  assert.match(await textOf(page, '[data-testid="modqn-replay-current-focus-row"]'), /1 \/ 1000/);
  assert.match(await textOf(page, '[data-testid="modqn-replay-handover-event"]'), /intra-satellite-beam-switch/);
  assert.match(await textOf(page, '[data-testid="modqn-replay-previous-serving"]'), /sat-0-beam-3/);
  assert.match(await textOf(page, '[data-testid="modqn-replay-selected-serving"]'), /sat-0-beam-4/);
  assert.match(await textOf(page, '[data-testid="modqn-replay-diagnostics-status"]'), /present-from-producer/);

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
  assert.match(await textOf(page, '[data-testid="modqn-replay-current-focus-row"]'), /501 \/ 1000/);
  assert.match(await textOf(page, '[data-testid="modqn-replay-handover-event"]'), /\bnone\b/);
  assert.match(await textOf(page, '[data-testid="modqn-replay-scalar-reward"]'), /3\.591/);

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
  assert.doesNotMatch(await textOf(page, '[data-testid="modqn-replay-current-row-range"]'), /1-100 \/ 1000/);
  assert.match(await textOf(page, '[data-testid="modqn-replay-handover-event"]'), /\bnone\b/);
  assert.match(await textOf(page, '[data-testid="modqn-replay-previous-serving"]'), /sat-0-beam-4/);
}

async function assertViewport(page, viewport) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(page.url(), { waitUntil: 'domcontentloaded', timeout: UI_LOAD_TIMEOUT_MS });
  await requiredBox(page, '.leo-app-shell[data-ui-mode="presentation"]', `${viewport.name} presentation app shell`);
  await requiredBox(page, '[data-testid="modqn-replay-playback-shell"]', `${viewport.name} replay playback shell`);
  await requiredBox(page, '.leo-shell-canvas canvas', `${viewport.name} scene canvas`);

  const defaultRawBodyText = await page.evaluate(() => document.body.innerText);
  const defaultBodyText = normalizeText(defaultRawBodyText);
  for (const expected of REQUIRED_DEFAULT_VISIBLE_TEXT) {
    assert.ok(defaultBodyText.includes(expected), `${viewport.name} viewport missing default playback text: ${expected}`);
  }
  for (const hiddenByDefault of [
    'read-only source-slot playback',
    'producer diagnostics present-from-producer',
  ]) {
    assert.ok(
      !defaultBodyText.includes(hiddenByDefault),
      `${viewport.name} disclosure detail was visible by default: ${hiddenByDefault}`,
    );
  }

  const controlBarBox = await requiredBox(page, '.leo-control-bar', `${viewport.name} control bar`);
  const playbackBox = await requiredBox(page, '[data-testid="modqn-replay-playback-shell"]', `${viewport.name} replay playback shell`);
  const shellRowBox = await requiredBox(page, '.leo-shell-row', `${viewport.name} shell row`);
  const canvasSlotBox = await requiredBox(page, '.leo-shell-canvas', `${viewport.name} canvas slot`);
  const liveTuningBox = await requiredBox(page, '.leo-shell-left', `${viewport.name} live tuning slot`);
  const liveStatusBox = await requiredBox(page, '.leo-shell-right', `${viewport.name} live status slot`);
  const modqnSidebarBox = await requiredBox(page, '.leo-modqn-sidebar-stack', `${viewport.name} MODQN replay sidebar stack`);

  assert.ok(playbackBox.width <= viewport.width + 1, `${viewport.name} playback shell overflowed the viewport`);
  assert.ok(
    shellRowBox.y <= controlBarBox.y + controlBarBox.height + 18,
    `${viewport.name} shell row did not start directly after the single control bar row`,
  );
  assert.ok(
    playbackBox.x + 1 >= liveStatusBox.x
      && playbackBox.x + playbackBox.width <= liveStatusBox.x + liveStatusBox.width + 1,
    `${viewport.name} playback shell was not horizontally inside the right sidebar`,
  );
  assert.ok(
    playbackBox.y + 1 >= liveStatusBox.y && playbackBox.y < liveStatusBox.y + liveStatusBox.height,
    `${viewport.name} playback shell did not start inside the right sidebar`,
  );
  assert.ok(
    modqnSidebarBox.y + 1 >= liveStatusBox.y && modqnSidebarBox.y < liveStatusBox.y + liveStatusBox.height,
    `${viewport.name} MODQN sidebar stack did not start inside the right sidebar`,
  );

  assert.equal(rectOverlapArea(playbackBox, controlBarBox), 0, `${viewport.name} playback shell overlapped control bar`);
  assert.equal(rectOverlapArea(playbackBox, canvasSlotBox), 0, `${viewport.name} playback shell overlapped scene canvas`);
  assert.equal(rectOverlapArea(playbackBox, liveTuningBox), 0, `${viewport.name} playback shell overlapped HOBS/SINR live tuning slot`);

  await page.evaluate(() => {
    document
      .querySelectorAll('details[data-phase7h-open-for-validation="true"]')
      .forEach(element => {
        if (element instanceof HTMLDetailsElement) element.open = true;
      });
  });
  const expandedRawBodyText = await page.evaluate(() => document.body.innerText);
  const expandedBodyText = normalizeText(expandedRawBodyText);
  for (const expected of REQUIRED_DISCLOSURE_TEXT) {
    assert.ok(expandedBodyText.includes(expected), `${viewport.name} viewport missing expanded playback text: ${expected}`);
  }

  const shellText = await textOf(page, '[data-testid="modqn-replay-playback-shell"]');
  assert.ok(shellText.includes('HOBS/SINR live controls separated'), `${viewport.name} replay/live separation label missing`);
  assert.ok(!shellText.includes('HOBS/SINR controls do not modify MODQN replay artifact truth'), `${viewport.name} replay shell reused live-label wording as a replay control`);

  await assertPlaybackInteraction(page, viewport.name);

  await scrollElementIntoView(
    page,
    '[data-testid="modqn-replay-selected-serving"]',
    `${viewport.name} selected serving summary`,
  );
  await scrollElementIntoView(
    page,
    '[data-testid="modqn-replay-reward-vector"]',
    `${viewport.name} reward vector summary`,
  );
  await scrollElementIntoView(
    page,
    '[data-testid="modqn-replay-diagnostics-status"]',
    `${viewport.name} diagnostics summary`,
  );

  assertNoUnsupportedEvidenceClaim(expandedRawBodyText, `${viewport.name}-visible-text`);
  assertNoHobsReplayEvidenceClaim(expandedRawBodyText, `${viewport.name}-visible-text`);

  return {
    viewport: viewport.name,
    size: `${viewport.width}x${viewport.height}`,
    playbackShell: {
      width: Math.round(playbackBox.width),
      height: Math.round(playbackBox.height),
    },
    playbackInteraction: {
      scrubChangedSourceSlotOnly: true,
      playPauseChangedSourceSlotOnly: true,
      resetReturnedToFirstSourceSlot: true,
    },
    defaultDisclosureState: 'collapsed',
    replayLiveSeparationVisible: true,
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
        visibleTextAssertions: {
          default: REQUIRED_DEFAULT_VISIBLE_TEXT,
          expandedDisclosure: REQUIRED_DISCLOSURE_TEXT,
        },
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

  const finalPass = findOwnedProcesses(await readRuntimeProcesses());

  return {
    killedProcessIds,
    newDevServerProcessesAfterCleanup: finalPass.newDevServerProcesses.map(formatProcess),
    newBrowserAutomationProcessesAfterCleanup: finalPass.newBrowserAutomationProcesses.map(formatProcess),
  };
}

async function main() {
  const playbackModel = assertPhase7fPlaybackModel();
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
      playbackModel,
      runtimeHygiene: {
        before: summarizeProcesses(beforeProcesses),
        devServer: devServerCleanup,
        processCleanup,
      },
      result: 'FAIL',
    }, null, 2));
    throw validationError;
  }

  console.log('MODQN Phase 7F replay playback shell browser validation passed.');
  console.log(JSON.stringify({
    playbackModel,
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
      fixtureOnlyBaselineClaims: 0,
      observedInterSatelliteHandoverRowsClaimed: 0,
    },
    result: 'PASS',
  }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
