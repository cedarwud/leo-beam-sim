import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from '@playwright/test';

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const UI_MODE_STORAGE_KEY = 'leo-beam-sim.ui-mode.v1';
const REQUEST_TIMEOUT_MS = 900;
const DEV_SERVER_START_TIMEOUT_MS = 30_000;
const UI_LOAD_TIMEOUT_MS = 30_000;
const PLAYBACK_WAIT_TIMEOUT_MS = 12_000;

type ProcessInfo = Readonly<{
  pid: number;
  ppid: number;
  stat: string;
  cmd: string;
}>;

type ProcessTableClose = Readonly<{
  code: number | null;
  signal: number | string | null;
}>;

type ChildProcessResult = Readonly<{
  pid: number | null;
  stopped: boolean;
  signal: string | null | number;
}>;

type ModqnReplaySnapshot = Readonly<{
  slotText: string;
  rowRangeText: string;
  focusRowText: string;
  currentServing: string;
  previousServing: string;
  handoverEventText: string;
  artifactEventTotalText: string;
}>;

type EventCounts = Readonly<{
  none: number;
  intraSatelliteBeamSwitch: number;
  interSatelliteHandover: number;
}>;

type LiveControlSnapshot = Readonly<{
  policyState: string | null;
  offsetText: string;
  triggerText: string;
  thresholdText: string;
}>;

type ForbiddenCopyViolation = Readonly<{
  rule: string;
  chunk: string;
}>;

type BrowserValidationResult = {
  baselineSnapshot: ModqnReplaySnapshot;
  liveBaseline: LiveControlSnapshot;
  liveBeforeReset: LiveControlSnapshot;
  liveAfterScrub: LiveControlSnapshot;
  liveAfterPause: LiveControlSnapshot;
  liveAfterFinalReset: LiveControlSnapshot;
  telemetry: string | null;
  transitions: string[];
  forbiddenClaims: ForbiddenCopyViolation[];
  eventCounts: EventCounts;
};

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function execFileText(command: string, args: string[]): Promise<string> {
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

function parseProcessTable(output: string): ProcessInfo[] {
  return output
    .split(/\r?\n/)
    .map(line => {
      const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\S+)\s+(.+)$/u);
      if (!match) return null;
      return {
        pid: Number(match[1]),
        ppid: Number(match[2]),
        stat: match[3],
        cmd: match[4],
      };
    })
    .filter((entry): entry is ProcessInfo => entry !== null);
}

function isDevServerProcess(processInfo: ProcessInfo): boolean {
  return /\bnpm\s+run\s+dev\b|\bvite\b/i.test(processInfo.cmd);
}

function isBrowserAutomationProcess(processInfo: ProcessInfo): boolean {
  return /playwright|google-chrome|chromium|chrome\b|swiftshader|--use-angle=swiftshader-webgl/i.test(processInfo.cmd);
}

function isRelevantRuntimeProcess(processInfo: ProcessInfo): boolean {
  return isDevServerProcess(processInfo) || isBrowserAutomationProcess(processInfo);
}

function formatProcess(processInfo: ProcessInfo) {
  return {
    pid: processInfo.pid,
    ppid: processInfo.ppid,
    stat: processInfo.stat,
    cmd: processInfo.cmd,
  };
}

function summarizeProcesses(processes: ProcessInfo[]) {
  return {
    relevantProcessCount: processes.length,
    devServerProcesses: processes.filter(isDevServerProcess).map(formatProcess),
    browserAutomationProcessCount: processes.filter(isBrowserAutomationProcess).length,
  };
}

async function readRuntimeProcesses(): Promise<ProcessInfo[]> {
  const output = await execFileText('ps', ['-eo', 'pid=,ppid=,stat=,args=']);
  return parseProcessTable(output).filter(isRelevantRuntimeProcess);
}

function candidateAppUrls(): string[] {
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

function normalizeUrl(candidate: string): string {
  const url = new URL(candidate);
  return `${url.origin}/`;
}

function extractCandidateUrls(output: string): string[] {
  const urls = new Set<string>();
  const regex = /https?:\/\/(?:127\.0\.0\.1|localhost):\d+\/?/g;
  for (const match of output.matchAll(regex)) {
    urls.add(normalizeUrl(match[0]));
  }
  return [...urls];
}

async function fetchHtml(candidate: string): Promise<string | null> {
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

async function isLeoAppServer(candidate: string): Promise<boolean> {
  const html = await fetchHtml(candidate);
  return Boolean(
    html && (
      html.includes('<title>LEO Beam Sim</title>')
      || html.includes('/src/main')
      || html.includes('leo-beam-sim')
    ),
  );
}

async function resolveExistingAppUrl(): Promise<string | null> {
  const explicit = process.env.APP_URL ?? process.argv[2] ?? null;
  if (explicit) {
    const appUrl = normalizeUrl(explicit);
    if (await isLeoAppServer(appUrl)) {
      return appUrl;
    }
    throw new Error(`APP_URL did not resolve to a LEO Beam Sim app server: ${appUrl}`);
  }

  for (const candidate of candidateAppUrls()) {
    if (await isLeoAppServer(candidate)) return normalizeUrl(candidate);
  }

  return null;
}

async function waitFor<T>(
  description: string,
  evaluator: () => Promise<T | null> | T | null,
  timeoutMs: number,
  intervalMs = 200,
): Promise<T> {
  const startedAt = Date.now();
  let lastError: unknown = null;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const result = await evaluator();
      if (result !== null) return result;
    } catch (error) {
      lastError = error;
    }
    await delay(intervalMs);
  }

  const suffix = lastError instanceof Error ? ` Last error: ${lastError.message}` : '';
  throw new Error(`Timed out waiting for ${description}.${suffix}`);
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

        for (const candidate of [...extractCandidateUrls(output), ...candidateAppUrls()]) {
          if (await isLeoAppServer(candidate)) return candidate;
        }
        return null;
      },
      DEV_SERVER_START_TIMEOUT_MS,
    );

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

async function terminateTemporaryDevServer(
  child: import('node:child_process').ChildProcessWithoutNullStreams,
): Promise<ChildProcessResult> {
  if (!child.pid || child.exitCode !== null) {
    return {
      pid: child.pid ?? null,
      stopped: child.exitCode !== null,
      signal: child.signalCode ?? null,
    };
  }

  const closed = new Promise<ProcessTableClose>(resolve => {
    child.once('close', (code, signal) => resolve({ code: code ?? -1, signal }));
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
    return {
      pid: child.pid,
      stopped: true,
      signal: graceful.signal ?? null,
    };
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

function testIdSelector(testId: string): string {
  return `[data-testid="${testId}"]`;
}

async function readVisibleBox(page: Page, selector: string) {
  return page.evaluate((sel: string) => {
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

async function requiredBox(page: Page, selector: string, label: string) {
  const box = await waitFor(
    `visible ${label} (${selector})`,
    () => readVisibleBox(page, selector),
    UI_LOAD_TIMEOUT_MS,
  );
  assert.ok(box, `${label} was missing or hidden: ${selector}`);
  return box;
}

async function textOf(page: Page, selector: string): Promise<string> {
  const text = await waitFor(
    `text for ${selector}`,
    () => page.evaluate((sel: string) => {
      const element = document.querySelector(sel);
      if (!(element instanceof HTMLElement)) return null;
      return element.innerText || element.textContent || '';
    }, selector),
    UI_LOAD_TIMEOUT_MS,
  );
  return normalizeText(text);
}

async function textOrNull(page: Page, selector: string): Promise<string | null> {
  try {
    const text = await textOf(page, selector);
    return text;
  } catch {
    return null;
  }
}

async function readAttribute(page: Page, selector: string, attribute: string): Promise<string | null> {
  return page.evaluate(({ sel, key }: { sel: string; key: string }) => {
    const element = document.querySelector(sel);
    if (!(element instanceof HTMLElement)) return null;
    return element.getAttribute(key);
  }, { sel: selector, key: attribute });
}

async function clickTestId(page: Page, testId: string): Promise<void> {
  await requiredBox(page, testIdSelector(testId), `${testId} control`);
  const clicked = await page.evaluate((id: string) => {
    const element = document.querySelector(`[data-testid="${id}"]`);
    if (!(element instanceof HTMLElement)) return false;
    element.click();
    return true;
  }, testId);
  assert.equal(clicked, true, `${testId} control was not available`);
}

async function setRangeValue(page: Page, testId: string, value: number): Promise<void> {
  const changed = await page.evaluate(
    ({ id, nextValue }: { id: string; nextValue: number }) => {
      const input = document.querySelector(`[data-testid="${id}"]`);
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
    },
    { id: testId, nextValue: value },
  );
  assert.equal(changed, true, `range input ${testId} was not available`);
}

async function setUiMode(page: Page, mode: 'presentation' | 'tuning' | 'diagnostics'): Promise<void> {
  await page.selectOption('select[aria-label="UI mode"]', mode);
  await page.waitForTimeout(250);
}

function parseReplaySlot(text: string): { slot: number; total: number } | null {
  const match = text.match(/(\d+)\s*\/\s*(\d+)/);
  if (!match) return null;
  return { slot: Number(match[1]), total: Number(match[2]) };
}

function parseRowRange(text: string): { start: number; end: number; total: number } | null {
  const match = text.match(/(\d+)\s*-\s*(\d+)\s*\/\s*(\d+)/);
  if (!match) return null;
  return { start: Number(match[1]), end: Number(match[2]), total: Number(match[3]) };
}

async function captureReplayState(page: Page): Promise<ModqnReplaySnapshot> {
  return {
    slotText: await textOf(page, testIdSelector('modqn-replay-current-slot')),
    rowRangeText: await textOf(page, testIdSelector('modqn-replay-current-row-range')),
    focusRowText: await textOf(page, testIdSelector('modqn-replay-current-focus-row')),
    currentServing: await textOf(page, testIdSelector('modqn-replay-selected-serving')),
    previousServing: await textOf(page, testIdSelector('modqn-replay-previous-serving')),
    handoverEventText: await textOf(page, testIdSelector('modqn-replay-handover-event')),
    artifactEventTotalText: await textOf(page, testIdSelector('modqn-replay-artifact-event-total')),
  };
}

async function captureLiveState(page: Page): Promise<LiveControlSnapshot> {
  return {
    policyState: await readAttribute(page, testIdSelector('modqn-baseline-handover-controls'), 'data-live-handover-policy-state'),
    offsetText: await textOf(page, testIdSelector('modqn-live-handover-offset')),
    triggerText: await textOf(page, testIdSelector('modqn-live-handover-trigger')),
    thresholdText: await textOf(page, testIdSelector('modqn-live-handover-threshold')),
  };
}

function parseEventCounts(text: string): EventCounts {
  const normalizedText = text.toLowerCase();
  const noneMatch = normalizedText.match(/none\s+(\d+)/i);
  const intraMatch = normalizedText.match(/intra[-\s]sat(?:ellite)?\s+(\d+)/i);
  const interMatch = normalizedText.match(/inter[-\s]sat(?:ellite)?\s+(\d+)/i);
  assert.ok(noneMatch, `artifact event total missing "none" count in "${text}"`);
  assert.ok(intraMatch, `artifact event total missing "intra-satellite-beam-switch" count in "${text}"`);
  assert.ok(interMatch, `artifact event total missing "inter-satellite-handover" count in "${text}"`);
  return {
    none: Number(noneMatch[1]),
    intraSatelliteBeamSwitch: Number(intraMatch[1]),
    interSatelliteHandover: Number(interMatch[1]),
  };
}

function assertExpectedEventCounts(eventCounts: EventCounts, label: string): void {
  assert.equal(eventCounts.none, 915, `${label} none count should be 915`);
  assert.equal(eventCounts.intraSatelliteBeamSwitch, 85, `${label} intra-satellite-beam-switch count should be 85`);
  assert.equal(eventCounts.interSatelliteHandover, 0, `${label} inter-satellite-handover count should be 0`);
}

function collectForbiddenCopyViolations(bodyText: string): ForbiddenCopyViolation[] {
  const normalized = normalizeText(bodyText).toLowerCase();
  const chunks = normalized.split(/[.;\n|]/u);
  const violations: ForbiddenCopyViolation[] = [];

  const ignoreContext = /\b(not|no|does not|do not|without|separate|separated|read-only|read only|only|forbidden|must not|sensitivity\/demo)\b/i;
  const rules: Array<{ name: string; pattern: RegExp }> = [
    {
      name: 'HOBS/SINR live as MODQN replay evidence',
      pattern: /\bhobs\/sinr\b(?:(?![.;\n]).){0,120}\bmodqn\b(?:(?![.;\n]).){0,120}\b(?:replay|artifact)\b(?:(?![.;\n]).){0,80}\b(?:evidence|truth|ground truth|provenance)\b/i,
    },
    {
      name: 'source-channel live is adopted',
      pattern: /\bsource[-\s]?channel\b(?:(?![.;\n]).){0,120}\blive\b(?:(?![.;\n]).){0,100}\b(?:adopted|active|active?\s+runt|enabled|runtime|adopt|source)\b/i,
    },
    {
      name: '19/37 trained-baseline claim',
      pattern: /\b(?:19\/37|19|37|19[-\s]beam|37[-\s]beam)\b(?:(?![.;\n]).){0,100}\b(?:trained baseline|baseline MODQN|trained)\b(?:(?![.;\n]).){0,100}\b(?:evidence|eviden|truth)\b/i,
    },
    {
      name: 'scene cue is producer geometry truth',
      pattern: /\bscene\s*cue[s]?\b(?:(?![.;\n]).){0,160}\b(?:producer|live|geometry)\b(?:(?![.;\n]).){0,160}\b(?:truth|evidence|geometry)\b/i,
    },
    {
      name: 'observed inter-satellite handover claim',
      pattern: /\bobserved\b(?:(?![.;\n]).){0,120}\binter[-\s]satellite\b(?:(?![.;\n]).){0,120}\bhandover\b(?:(?![.;\n]).){0,80}\b(?:exists|evidence|event)\b/i,
    },
    {
      name: 'EE/HEA/Catfish scope claim',
      pattern: /\b(ee|hea|catfish|multi[-\s]catfish|catfish-over-hea)\b(?:(?![.;\n]).){0,120}\b(?:scope|modqn|evidence|integration|control|effectiveness)\b/i,
    },
  ];

  for (const chunk of chunks) {
    for (const rule of rules) {
      if (rule.pattern.test(chunk) && !ignoreContext.test(chunk)) {
        violations.push({ rule: rule.name, chunk });
      }
    }
  }
  return violations;
}

async function captureDebugTelemetryIfAvailable(page: Page): Promise<string | null> {
  try {
    await setUiMode(page, 'diagnostics');
    const drawerState = await readAttribute(page, testIdSelector('diagnostics-drawer'), 'data-drawer-state');
    if (drawerState === 'expanded') {
      return await textOrNull(page, testIdSelector('diagnostics-drawer-debug-validation'));
    }
    return null;
  } finally {
    await setUiMode(page, 'presentation');
  }
}

function assertBoundaryCopy(bodyText: string): ForbiddenCopyViolation[] {
  return collectForbiddenCopyViolations(bodyText);
}

async function assertViewportAndCapture(page: Page): Promise<{ replay: ModqnReplaySnapshot; live: LiveControlSnapshot; }> {
  await requiredBox(page, '.leo-app-shell[data-ui-mode="presentation"]', 'presentation app shell');
  await requiredBox(page, '[data-testid="leo-shell-canvas"]', 'canvas slot');
  await requiredBox(page, '.leo-shell-left', 'left control slot');
  await requiredBox(page, '.leo-shell-right', 'right status slot');
  await requiredBox(page, testIdSelector('modqn-replay-playback-shell'), 'replay playback shell');
  await requiredBox(page, testIdSelector('modqn-baseline-handover-controls'), 'live handover controls');
  await requiredBox(page, testIdSelector('modqn-baseline-integration-panel'), 'integration replay panel');

  const replay = await captureReplayState(page);
  const live = await captureLiveState(page);
  return { replay, live };
}

async function runBrowserValidation(appUrl: string): Promise<BrowserValidationResult> {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const browser = await chromium.launch({
    args: ['--disable-dev-shm-usage', '--use-angle=swiftshader-webgl'],
  });

  const result: BrowserValidationResult = {
    baselineSnapshot: null as unknown as ModqnReplaySnapshot,
    liveBaseline: null as unknown as LiveControlSnapshot,
    liveBeforeReset: null as unknown as LiveControlSnapshot,
    liveAfterScrub: null as unknown as LiveControlSnapshot,
    liveAfterPause: null as unknown as LiveControlSnapshot,
    liveAfterFinalReset: null as unknown as LiveControlSnapshot,
    telemetry: null,
    transitions: [],
    forbiddenClaims: [],
    eventCounts: {
      none: 0,
      intraSatelliteBeamSwitch: 0,
      interSatelliteHandover: 0,
    },
  };

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  try {
    await context.addInitScript({
      content: `window.localStorage.setItem(${JSON.stringify(UI_MODE_STORAGE_KEY)}, 'presentation');`,
    });
    const page = await context.newPage();

    page.on('console', message => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });
    page.on('pageerror', error => {
      pageErrors.push(error.stack || error.message);
    });

    try {
      await page.goto(appUrl, { waitUntil: 'domcontentloaded', timeout: UI_LOAD_TIMEOUT_MS });

      const base = await assertViewportAndCapture(page);
      result.baselineSnapshot = base.replay;
      result.liveBaseline = base.live;
      const eventCounts = parseEventCounts(base.replay.artifactEventTotalText);
      assertExpectedEventCounts(eventCounts, 'baseline');
      result.eventCounts = eventCounts;
      const baselineRowRange = parseRowRange(base.replay.rowRangeText);
      assert.ok(baselineRowRange !== null, 'baseline row-range text must parse');
      result.transitions.push(`baseline: slot=${base.replay.slotText} rows=${base.replay.rowRangeText}`);

      // Baseline reset behavior.
      await clickTestId(page, 'modqn-replay-reset');
      const resetState = await waitFor(
        'replay reset applying to first slot',
        async () => {
          const state = await captureReplayState(page);
          const slot = parseReplaySlot(state.slotText);
          const rows = parseRowRange(state.rowRangeText);
          return slot?.slot === 1 && rows?.start === 1 ? state : null;
        },
        PLAYBACK_WAIT_TIMEOUT_MS,
      );
      const resetRows = parseRowRange(resetState.rowRangeText);
      const resetSlot = parseReplaySlot(resetState.slotText);
      assert.ok(resetSlot !== null && resetRows !== null, 'reset state must include parseable slot/range');
      result.transitions.push(`after-reset: slot=${resetState.slotText} rows=${resetState.rowRangeText}`);
      result.liveBeforeReset = await captureLiveState(page);
      assert.deepEqual(result.liveBeforeReset, result.liveBaseline, 'live controls changed after replay reset');

      // Scrub interaction should update playback slot, but keep event totals and live controls unchanged.
      await setRangeValue(page, 'modqn-replay-scrub', 5);
      const scrubbedState = await waitFor(
        'scrubbed replay slot update',
        async () => {
          const state = await captureReplayState(page);
          return parseReplaySlot(state.slotText)?.slot === 6 ? state : null;
        },
        PLAYBACK_WAIT_TIMEOUT_MS,
      );
      const scrubbedRowRange = parseRowRange(scrubbedState.rowRangeText);
      assert.ok(scrubbedRowRange !== null && scrubbedRowRange.start === 501, 'scrubbed slot should begin at row 501');
      assert.ok(scrubbedState.artifactEventTotalText === base.replay.artifactEventTotalText, 'artifact totals changed during scrub');
      assert.deepEqual(parseEventCounts(scrubbedState.artifactEventTotalText), eventCounts, 'artifact totals drifted during scrub');
      result.transitions.push(`after-scrub: slot=${scrubbedState.slotText} rows=${scrubbedState.rowRangeText} event=${scrubbedState.handoverEventText}`);

      const liveAfterScrub = await captureLiveState(page);
      result.liveAfterScrub = liveAfterScrub;
      assert.deepEqual(liveAfterScrub, result.liveBaseline, 'live controls changed after replay scrub');

      // Play/pause interaction.
      await clickTestId(page, 'modqn-replay-play-toggle');
      const playingState = await waitFor(
        'replay slot to advance after play',
        async () => {
          const state = await captureReplayState(page);
          const slot = parseReplaySlot(state.slotText);
          return slot?.slot !== 6 ? state : null;
        },
        PLAYBACK_WAIT_TIMEOUT_MS,
      );
      result.transitions.push(`after-play: slot=${playingState.slotText} rows=${playingState.rowRangeText}`);
      await clickTestId(page, 'modqn-replay-play-toggle');
      await delay(250);
      const pauseState = await captureReplayState(page);
      result.liveAfterPause = await captureLiveState(page);
      result.transitions.push(`after-pause: slot=${pauseState.slotText} rows=${pauseState.rowRangeText}`);

      // Final reset to verify replay scrub/play do not alter live control values.
      await clickTestId(page, 'modqn-replay-reset');
      const finalState = await waitFor(
        'replay final reset to first slot',
        async () => {
          const state = await captureReplayState(page);
          return parseReplaySlot(state.slotText)?.slot === 1 ? state : null;
        },
        PLAYBACK_WAIT_TIMEOUT_MS,
      );
      result.liveAfterFinalReset = await captureLiveState(page);
      const finalRows = parseRowRange(finalState.rowRangeText);
      const finalSlot = parseReplaySlot(finalState.slotText);
      assert.ok(finalSlot !== null && finalRows !== null, 'final reset state must include parseable slot/range');
      assert.equal(finalSlot.slot, 1, 'final reset must return slot to first');
      assert.equal(finalRows.start, 1, 'final reset must return source rows to first slot chunk');
      result.transitions.push(`after-final-reset: slot=${finalState.slotText} rows=${finalState.rowRangeText}`);
      assert.deepEqual(parseEventCounts(finalState.artifactEventTotalText), eventCounts, 'artifact totals drifted after final reset');
      assertExpectedEventCounts(eventCounts, 'final');

      const collapsedText = await page.evaluate(() => document.body.innerText);
      await page.evaluate(() => {
        document
          .querySelectorAll('[data-phase7h-open-for-validation="true"]')
          .forEach(element => {
            if (element instanceof HTMLDetailsElement) {
              element.open = true;
            }
          });
      });
      const openedText = await page.evaluate(() => document.body.innerText);
      result.forbiddenClaims = assertBoundaryCopy(`${collapsedText} ${openedText}`);
      assert.equal(
        result.forbiddenClaims.length,
        0,
        `forbidden visible claim(s):\n${result.forbiddenClaims.map(({ rule, chunk }) => `${rule}: ${chunk}`).join('\n')}`,
      );

      result.telemetry = await captureDebugTelemetryIfAvailable(page);
      assert.deepEqual(pageErrors, [], `browser page error(s):\n${pageErrors.join('\n')}`);
      assert.deepEqual(consoleErrors, [], `browser console error(s):\n${consoleErrors.join('\n')}`);
      return result;
    } finally {
      await page.close().catch(() => {});
    }
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

async function cleanupOwnedRuntimeProcesses(beforeProcesses: ProcessInfo[]) {
  const beforePids = new Set(beforeProcesses.map(processInfo => processInfo.pid));
  const findOwnedProcesses = (processes: ProcessInfo[]) => {
    const newProcesses = processes.filter(processInfo => !beforePids.has(processInfo.pid));
    return {
      newDevServerProcesses: newProcesses.filter(isDevServerProcess).map(formatProcess),
      newBrowserAutomationProcesses: newProcesses.filter(isBrowserAutomationProcess).map(formatProcess),
    };
  };

  const firstPass = findOwnedProcesses(await readRuntimeProcesses());
  const ownedProcesses = [...firstPass.newDevServerProcesses, ...firstPass.newBrowserAutomationProcesses];
  const killedProcessIds: number[] = [];
  for (const processInfo of ownedProcesses) {
    try {
      process.kill(processInfo.pid, 'SIGTERM');
      killedProcessIds.push(processInfo.pid);
    } catch {
      // Process may have already exited by this point.
    }
  }

  if (killedProcessIds.length > 0) {
    await delay(750);
  }

  const finalPass = findOwnedProcesses(await readRuntimeProcesses());
  return {
    killedProcessIds,
    newDevServerProcessesAfterCleanup: finalPass.newDevServerProcesses,
    newBrowserAutomationProcessesAfterCleanup: finalPass.newBrowserAutomationProcesses,
  };
}

async function main() {
  const beforeProcesses = await readRuntimeProcesses();
  const existingAppUrl = await resolveExistingAppUrl();
  let temporaryServer = null as null | Awaited<ReturnType<typeof startTemporaryDevServer>>;
  let appUrl = existingAppUrl;
  let devServerInfo = {
    reusedDevServer: Boolean(existingAppUrl),
    keptDevServer: existingAppUrl,
    temporaryServerPid: null as number | null,
    stoppedTemporaryServer: null as ChildProcessResult | null,
  };
  let browserResult: BrowserValidationResult | null = null;
  let validationError: unknown = null;
  let processCleanup = null as Awaited<ReturnType<typeof cleanupOwnedRuntimeProcesses>> | null;

  try {
    if (!appUrl) {
      temporaryServer = await startTemporaryDevServer();
      appUrl = temporaryServer.appUrl;
      devServerInfo = {
        reusedDevServer: false,
        keptDevServer: null,
        temporaryServerPid: temporaryServer.pid,
        stoppedTemporaryServer: null,
      };
    }
    browserResult = await runBrowserValidation(appUrl);
  } catch (error) {
    validationError = error;
  } finally {
    if (temporaryServer) {
      devServerInfo.stoppedTemporaryServer = await terminateTemporaryDevServer(temporaryServer.child);
    }
    processCleanup = await cleanupOwnedRuntimeProcesses(beforeProcesses);
  }

  const leftoverProcesses = [
    ...processCleanup.newDevServerProcessesAfterCleanup,
    ...processCleanup.newBrowserAutomationProcessesAfterCleanup,
  ];
  assert.equal(
    leftoverProcesses.length,
    0,
    `owned runtime process(es) remained after cleanup:\n${JSON.stringify(leftoverProcesses, null, 2)}`,
  );

  if (validationError) {
    console.error(JSON.stringify({
      runtimeHygiene: {
        before: summarizeProcesses(beforeProcesses),
        devServer: devServerInfo,
        processCleanup,
      },
      result: 'FAIL',
    }, null, 2));
    throw validationError;
  }

  assert.deepEqual(
    browserResult!.liveBaseline,
    browserResult!.liveAfterFinalReset,
    'live handover control snapshot changed across replay control actions',
  );
  assert.deepEqual(
    browserResult!.liveBaseline,
    browserResult!.liveBeforeReset,
    'live controls changed after initial replay reset',
  );
  assert.deepEqual(
    browserResult!.liveBaseline,
    browserResult!.liveAfterScrub,
    'live controls changed after replay scrub',
  );
  assert.deepEqual(
    browserResult!.liveBaseline,
    browserResult!.liveAfterPause,
    'live controls changed after replay play/pause',
  );

  console.log('MODQN Phase 7K-R2 control-plane browser smoke validation passed.');
  console.log(JSON.stringify({
    runtimeHygiene: {
      before: summarizeProcesses(beforeProcesses),
      devServer: devServerInfo,
      processCleanup,
    },
    browser: {
      appUrl,
      result: 'PASS',
      eventCounts: browserResult!.eventCounts,
      forbiddenClaims: browserResult!.forbiddenClaims.length,
      liveTelemetryAvailable: browserResult!.telemetry !== null,
      transitions: browserResult!.transitions,
    },
  }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
