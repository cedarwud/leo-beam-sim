import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from '@playwright/test';

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const REQUEST_TIMEOUT_MS = 900;
const DEV_SERVER_START_TIMEOUT_MS = 30_000;
const UI_LOAD_TIMEOUT_MS = 30_000;
const ARROW_APPEAR_TIMEOUT_MS = 90_000;
const REQUIRED_SERVER_ORIGIN = 'http://127.0.0.1:5173';
const SPEED_TARGET = 20;
const INTRA_VISUAL_LATCH_MS = 6000;
const SAMPLE_TARGET_SECONDS = [0, 1, 2, 3, 4.5, 6];

type ForbiddenCopyViolation = Readonly<{
  rule: string;
  chunk: string;
}>;

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

type ArrowTelemetry = Readonly<{
  wallClockMs: number;
  active: string | null;
  opacity: string | null;
  sceneText: string;
}>;

type IntraHandoverSample = Readonly<{
  targetSec: number;
  elapsedSec: number;
  opacity: number | null;
  speed: number | null;
  active: string | null;
  wallClockMs: number;
}>;

type FrameSample = Readonly<{
  wallClockMs: number;
  active: string | null;
  opacity: number | null;
  speed: number | null;
}>;

/** Local inverse of Readonly<T> for the one construction site that fills the
 *  result in place; everything downstream still reads the Readonly view. */
type Mutable<T> = { -readonly [K in keyof T]: T[K] };

type BrowserValidationResult = Readonly<{
  arrowDetected: boolean;
  startWallClockMs: number | null;
  samples: ReadonlyArray<IntraHandoverSample>;
  frameSamples: ReadonlyArray<FrameSample>;
  frameActiveCount: number;
  frameTotalCount: number;
  opacityMin: number | null;
  opacityMax: number | null;
  forbiddenClaims: ReadonlyArray<ForbiddenCopyViolation>;
  finalSpeed: number | null;
  autoSlowObserved: boolean;
  pageUrl: string | null;
  reducedMotionActive: string | null;
  reducedMotionOpacityFirst: number | null;
  reducedMotionOpacityLast: number | null;
  reducedMotionOpacityStable: boolean;
}>;

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
    .split(/\r?\n/u)
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
  return { pid: processInfo.pid, ppid: processInfo.ppid, stat: processInfo.stat, cmd: processInfo.cmd };
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
  return [`${REQUIRED_SERVER_ORIGIN}/`];
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

async function isReachable(candidate: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(candidate, { method: 'HEAD', signal: controller.signal });
    return response.status === 200;
  } catch {
    return false;
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
    assertAppUrlOn5173(appUrl);
    return appUrl;
  }
  for (const candidate of candidateAppUrls()) {
    if (!(await isReachable(candidate))) continue;
    if (await isLeoAppServer(candidate)) return normalizeUrl(candidate);
  }
  return null;
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function collectForbiddenCopyViolations(bodyText: string): ForbiddenCopyViolation[] {
  const normalized = normalizeText(bodyText).toLowerCase();
  const chunks = normalized.split(/[.;\n|]/u);
  const violations: ForbiddenCopyViolation[] = [];
  const ignoreContext = /\b(not|no|does not|do not|without|separate|separated|read-only|read only|only|forbidden|must not|sensitivity\/demo)\b/i;
  const rules: Array<{ name: string; pattern: RegExp }> = [
    {
      name: 'HOBS/SINR live as MODQN replay evidence', // forbidden-claim rule name — this validator BANS the phrase (not a claim)
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

async function startTemporaryDevServer() {
  const child = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173'], {
    cwd: ROOT_DIR,
    detached: true,
    env: { ...process.env, BROWSER: 'none' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout?.on('data', (chunk: Buffer) => { output += chunk.toString(); });
  child.stderr?.on('data', (chunk: Buffer) => { output += chunk.toString(); });

  try {
    const appUrl = await waitFor(
      'temporary Vite dev server',
      async () => {
        if (child.exitCode !== null) {
          throw new Error(`temporary Vite dev server exited early with code ${child.exitCode}`);
        }
        for (const candidate of [...extractCandidateUrls(output), ...candidateAppUrls()]) {
          if (!(await isReachable(candidate))) continue;
          if (await isLeoAppServer(candidate)) return candidate;
        }
        return null;
      },
      DEV_SERVER_START_TIMEOUT_MS,
    );
    return { child, appUrl, pid: child.pid ?? null };
  } catch (error) {
    await terminateTemporaryDevServer(child).catch(() => {});
    throw error;
  }
}

async function terminateTemporaryDevServer(
  // The real spawn() return under stdio ['ignore','pipe','pipe'] (stdin is null).
  child: import('node:child_process').ChildProcessByStdio<null, import('node:stream').Readable, import('node:stream').Readable>,
): Promise<ChildProcessResult> {
  if (!child.pid || child.exitCode !== null) {
    return { pid: child.pid ?? null, stopped: child.exitCode !== null, signal: child.signalCode ?? null };
  }

  const closed = new Promise<ProcessTableClose>(resolve => {
    child.once('close', (code, signal) => resolve({ code: code ?? -1, signal }));
  });
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    child.kill('SIGTERM');
  }
  const graceful = await Promise.race([closed, delay(5_000).then(() => null)]);
  if (graceful) return { pid: child.pid, stopped: true, signal: graceful.signal ?? null };

  try {
    process.kill(-child.pid, 'SIGKILL');
  } catch {
    child.kill('SIGKILL');
  }
  const forced = await Promise.race([closed, delay(2_000).then(() => null)]);
  return { pid: child.pid, stopped: Boolean(forced), signal: forced?.signal ?? 'SIGKILL' };
}

function assertAppUrlOn5173(pageUrl: string): void {
  const parsed = new URL(pageUrl);
  assert.equal(
    parsed.origin,
    REQUIRED_SERVER_ORIGIN,
    `validator must target ${REQUIRED_SERVER_ORIGIN}, got ${parsed.origin}`,
  );
}

function toNumber(value: string | number | null): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseSceneSpeed(sceneText: string | undefined): number | null {
  // `?? ''` is output-identical to the pre-typed behaviour: exec(undefined)
  // coerced to the string "undefined", which this pattern never matches either.
  const match = /Scene:\s*([0-9.]+)x(?:\s*\(([^)]*)\))?/u.exec(sceneText ?? '');
  return Number.isFinite(Number(match?.[1])) ? Number(match?.[1]) : null;
}

async function waitFor<T>(
  description: string,
  evaluator: () => Promise<T | null> | T | null,
  timeoutMs: number,
  intervalMs = 250,
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

async function readArrowState(page: Page): Promise<ArrowTelemetry> {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const allDivs = [...document.querySelectorAll('div')];
    const sceneNode = allDivs.find(div => /^Scene:/u.test((div.textContent ?? '').trim()));
    return {
      wallClockMs: performance.now(),
      active: canvas ? canvas.getAttribute('data-intra-handover-arrow-active') : null,
      opacity: canvas ? canvas.getAttribute('data-intra-handover-arrow-opacity') : null,
      sceneText: sceneNode ? (sceneNode.textContent ?? '') : '',
    };
  });
}

async function setSliderSpeedTo(page: Page, speed: number): Promise<void> {
  await page.evaluate((value) => {
    const slider = document.querySelector<HTMLInputElement>('input[type="range"]');
    if (!slider) {
      throw new Error('expected a speed slider input');
    }
    slider.value = String(value);
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    slider.dispatchEvent(new Event('change', { bubbles: true }));
  }, speed);
}

async function ensureRunning(page: Page): Promise<void> {
  const pauseButtons = page.locator('button', { hasText: /^(Play|Pause)$/u });
  if (await pauseButtons.count() > 0) {
    const text = await pauseButtons.first().textContent();
    if ((text ?? '').trim() === 'Play') await pauseButtons.first().click();
  }
}

async function collectTargetSamples(
  page: Page,
  startWallClockMs: number,
  startSample?: FrameSample,
): Promise<{
  sampledByTarget: ReadonlyMap<number, FrameSample>;
  frameSamples: FrameSample[];
}> {
  const targetSeconds = SAMPLE_TARGET_SECONDS;
  const targetSet = new Set(targetSeconds);
  const sampledByTarget = new Map<number, FrameSample>();
  const frameSamples: FrameSample[] = [];
  const sampleWindowMs = INTRA_VISUAL_LATCH_MS + 600;

  // Honest union: the only call site always passes `startSample` (a FrameSample,
  // which has no sceneText), so the readArrowState fallback branch is dead at
  // runtime today; the old `as FrameSample` cast mislabeled ArrowTelemetry
  // (opacity is a string there). toNumber/parseSceneSpeed accept both members.
  const initialSource: (FrameSample & { sceneText?: undefined }) | ArrowTelemetry =
    startSample ?? await readArrowState(page);
  const initialSample: FrameSample = {
    wallClockMs: Number.isFinite(initialSource.wallClockMs) ? initialSource.wallClockMs : performance.now(),
    active: initialSource.active,
    opacity: toNumber(initialSource.opacity),
    speed: parseSceneSpeed(initialSource.sceneText),
  };
  frameSamples.push(initialSample);
  for (const targetSec of targetSeconds) {
    if (targetSec <= 0) sampledByTarget.set(targetSec, initialSample);
  }

  const deadline = Date.now() + sampleWindowMs;
  let elapsedMs = 0;
  while (Date.now() < deadline && sampledByTarget.size < targetSet.size) {
    const telemetry = await readArrowState(page);
    const frameSample: FrameSample = {
      wallClockMs: telemetry.wallClockMs,
      active: telemetry.active,
      opacity: toNumber(telemetry.opacity),
      speed: parseSceneSpeed(telemetry.sceneText),
    };
    frameSamples.push(frameSample);
    elapsedMs = frameSample.wallClockMs - startWallClockMs;
    for (const targetSec of targetSeconds) {
      if (!sampledByTarget.has(targetSec) && elapsedMs >= targetSec * 1000) {
        sampledByTarget.set(targetSec, frameSample);
      }
    }

    if (elapsedMs >= INTRA_VISUAL_LATCH_MS) break;
    await delay(16);
  }

  const result = {
    sampledByTarget: [...sampledByTarget.entries()],
    samples: frameSamples,
  };

  return {
    sampledByTarget: new Map(result.sampledByTarget),
    frameSamples: result.samples,
  };
}

function intersectInBandDuration(y0: number | null, y1: number | null, t0: number, t1: number, low: number, high: number): number {
  if (y0 === null || y1 === null) return 0;
  const dt = t1 - t0;
  const in0 = y0 > low && y0 < high;
  const in1 = y1 > low && y1 < high;
  if (in0 && in1) return dt;
  if (y0 === y1) return 0;
  const uLow = (low - y0) / (y1 - y0);
  const uHigh = (high - y0) / (y1 - y0);
  const uStart = Math.max(0, Math.min(uLow, uHigh));
  const uEnd = Math.min(1, Math.max(uLow, uHigh));
  const overlapStart = Math.max(0, Math.min(1, uStart));
  const overlapEnd = Math.max(0, Math.min(1, uEnd));
  if (in0) {
    return Math.max(0, (overlapEnd - overlapStart) * dt);
  }
  if (in1) {
    return Math.max(0, (overlapEnd - overlapStart) * dt);
  }
  if (overlapEnd > overlapStart) return (overlapEnd - overlapStart) * dt;
  return 0;
}

function interpolateSampleAtWallClock(
  samples: ReadonlyArray<FrameSample>,
  targetWallClockMs: number,
): FrameSample {
  if (samples.length === 0) {
    throw new Error('no frame samples available');
  }
  let prev = samples[0];
  if (targetWallClockMs <= prev.wallClockMs) {
    return { ...prev, wallClockMs: targetWallClockMs };
  }

  for (let i = 1; i < samples.length; i += 1) {
    const curr = samples[i];
    const prevWall = prev.wallClockMs;
    const currWall = curr.wallClockMs;
    if (currWall < prevWall) continue;
    if (currWall < targetWallClockMs) {
      prev = curr;
      continue;
    }
    const ratio = currWall === prevWall ? 0 : (targetWallClockMs - prevWall) / (currWall - prevWall);
    const prevOpacity = prev.opacity;
    const currOpacity = curr.opacity;
    const opacity = (prevOpacity === null || currOpacity === null)
      ? currOpacity ?? prevOpacity
      : prevOpacity + (currOpacity - prevOpacity) * ratio;
    return {
      wallClockMs: targetWallClockMs,
      active: ratio >= 0.5 ? curr.active : prev.active,
      opacity,
      speed: curr.speed ?? prev.speed ?? null,
    };
  }

  return { ...samples[samples.length - 1], wallClockMs: targetWallClockMs };
}

function inBandDurationFromFrameSamples(samples: ReadonlyArray<FrameSample>, low: number, high: number): number {
  if (samples.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < samples.length; i += 1) {
    const prev = samples[i - 1];
    const next = samples[i];
    total += intersectInBandDuration(prev.opacity, next.opacity, prev.wallClockMs, next.wallClockMs, low, high);
  }
  return total / 1000;
}

function isMonotonicSamples(samples: ReadonlyArray<IntraHandoverSample>): boolean {
  for (let i = 1; i < samples.length; i += 1) {
    const prev = samples[i - 1].opacity;
    const current = samples[i].opacity;
    if (prev === null || current === null) return false;
    if (current - prev > 0.005) return false;
  }
  return true;
}

async function runBrowserValidation(appUrl: string): Promise<BrowserValidationResult> {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const browser = await chromium.launch({
    args: ['--disable-dev-shm-usage', '--use-angle=swiftshader-webgl'],
  });

  const result: Mutable<BrowserValidationResult> = {
    arrowDetected: false,
    startWallClockMs: null,
    samples: [],
    frameSamples: [],
    frameActiveCount: 0,
    frameTotalCount: 0,
    opacityMin: null,
    opacityMax: null,
    forbiddenClaims: [],
    finalSpeed: null,
    autoSlowObserved: false,
    pageUrl: null,
    reducedMotionActive: null,
    reducedMotionOpacityFirst: null,
    reducedMotionOpacityLast: null,
    reducedMotionOpacityStable: false,
  };

  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    try {
      const page = await context.newPage();
      page.on('console', message => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });
      page.on('pageerror', error => pageErrors.push(error.stack || error.message));

      await page.goto(appUrl, { waitUntil: 'domcontentloaded', timeout: UI_LOAD_TIMEOUT_MS });
      await waitFor('canvas to be present', () => page.evaluate(() => (document.querySelector('canvas') ? true : null)), UI_LOAD_TIMEOUT_MS);

      result.pageUrl = await page.evaluate(() => window.location.href);
      assertAppUrlOn5173(result.pageUrl);

      await delay(100);

      await setSliderSpeedTo(page, SPEED_TARGET);
      await ensureRunning(page);

      let previouslyActive = false;
      const eventStart = await waitFor(
        'intra-handover arrow to become active on a rising edge',
        async () => {
          const telem = await readArrowState(page);
          const isActive = telem.active === '1';
          if (!isActive) {
            previouslyActive = false;
            return null;
          }
          if (previouslyActive) return null;
          previouslyActive = true;
          return telem;
        },
        ARROW_APPEAR_TIMEOUT_MS,
        16,
      );
      const eventStartOpacity = toNumber(eventStart.opacity);
      const inferredStartOffsetMs = eventStartOpacity === null
        ? 0
        : Math.max(0, (1 - eventStartOpacity) * INTRA_VISUAL_LATCH_MS);
      const correctedStartWallClockMs = eventStart.wallClockMs - inferredStartOffsetMs;
      result.startWallClockMs = correctedStartWallClockMs;
      result.arrowDetected = true;
      const eventStartFrameSample: FrameSample = {
        wallClockMs: correctedStartWallClockMs,
        active: eventStart.active,
        opacity: 1,
        speed: parseSceneSpeed(eventStart.sceneText),
      };

      const postStart = await collectTargetSamples(page, result.startWallClockMs, eventStartFrameSample);

      const samples = SAMPLE_TARGET_SECONDS.map(targetSec => {
        // Same value as result.startWallClockMs (assigned from this const above);
        // the local keeps the non-null type across the callback boundary.
        const targetWallClockMs = correctedStartWallClockMs + targetSec * 1000;
        const frameSample = interpolateSampleAtWallClock(postStart.frameSamples, targetWallClockMs);
        return {
          targetSec,
          elapsedSec: (frameSample.wallClockMs - correctedStartWallClockMs) / 1000,
          wallClockMs: frameSample.wallClockMs,
          opacity: frameSample.opacity,
          speed: frameSample.speed,
          active: frameSample.active,
        };
      });

      for (const sample of samples) {
        if (sample.opacity !== null) {
          result.opacityMin = result.opacityMin === null ? sample.opacity : Math.min(result.opacityMin, sample.opacity);
          result.opacityMax = result.opacityMax === null ? sample.opacity : Math.max(result.opacityMax, sample.opacity);
        }
      }

      result.samples = samples;
      result.frameSamples = postStart.frameSamples;
      result.frameActiveCount = postStart.frameSamples.filter(sample => sample.active === '1').length;
      result.frameTotalCount = postStart.frameSamples.length;

      const finalTelemetry = await readArrowState(page);
      result.finalSpeed = parseSceneSpeed(finalTelemetry.sceneText);
      result.autoSlowObserved = result.samples.some(sample => sample.speed !== null && sample.speed < SPEED_TARGET);
      if (!result.autoSlowObserved && result.finalSpeed !== null && result.finalSpeed < SPEED_TARGET) {
        result.autoSlowObserved = true;
      }

      const bodyText = await page.evaluate('document.body.innerText') as string;
      result.forbiddenClaims = collectForbiddenCopyViolations(bodyText);

      await page.close().catch(() => {});
    } finally {
      await context.close().catch(() => {});
    }

    const reducedContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'reduce',
    });
    try {
      const reducedPage = await reducedContext.newPage();
      await reducedPage.goto(appUrl, { waitUntil: 'domcontentloaded', timeout: UI_LOAD_TIMEOUT_MS });
      await waitFor(
        'canvas to be present (reduced-motion)',
        () => reducedPage.evaluate(() => (document.querySelector('canvas') ? true : null)),
        UI_LOAD_TIMEOUT_MS,
      );

      const reducedTelem = await readArrowState(reducedPage);
      result.reducedMotionActive = reducedTelem.active;
      const initialOpacity = toNumber(reducedTelem.opacity);
      result.reducedMotionOpacityFirst = initialOpacity;
      result.reducedMotionOpacityLast = initialOpacity;
      result.reducedMotionOpacityStable = (
        initialOpacity !== null
        && Math.abs(initialOpacity - 0.7) < 0.05
      );

      await reducedPage.close().catch(() => {});
    } finally {
      await reducedContext.close().catch(() => {});
    }

    assert.deepEqual(pageErrors, [], `browser page error(s):\n${pageErrors.join('\n')}`);
    assert.deepEqual(consoleErrors, [], `browser console error(s):\n${consoleErrors.join('\n')}`);
    return result;
  } finally {
    await browser.close().catch(() => {});
  }
}

async function cleanupOwnedRuntimeProcesses(beforeProcesses: ProcessInfo[]) {
  const beforePids = new Set(beforeProcesses.map(p => p.pid));
  const findOwnedProcesses = (processes: ProcessInfo[]) => {
    const newProcesses = processes.filter(p => !beforePids.has(p.pid) && !beforePids.has(p.ppid));
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
      // already exited
    }
  }
  if (killedProcessIds.length > 0) await delay(750);
  const finalPass = findOwnedProcesses(await readRuntimeProcesses());
  return {
    killedProcessIds,
    newDevServerProcessesAfterCleanup: finalPass.newDevServerProcesses,
    newBrowserAutomationProcessesAfterCleanup: finalPass.newBrowserAutomationProcesses,
  };
}

function inBandDurationFromSamples(samples: ReadonlyArray<IntraHandoverSample>): number {
  let inBandStart: number | null = null;
  let longest = 0;
  for (const sample of samples) {
    if (sample.opacity === null) {
      if (inBandStart !== null) {
        longest = Math.max(longest, sample.elapsedSec - inBandStart);
        inBandStart = null;
      }
      continue;
    }
    if (sample.opacity > 0.3 && sample.opacity < 0.9) {
      if (inBandStart === null) inBandStart = sample.elapsedSec;
    } else if (inBandStart !== null) {
      longest = Math.max(longest, sample.elapsedSec - inBandStart);
      inBandStart = null;
    }
  }
  if (inBandStart !== null && samples.length > 0) {
    longest = Math.max(longest, samples[samples.length - 1].elapsedSec - inBandStart);
  }
  return longest;
}

function roundSeconds(value: number | null): number | null {
  return value === null || Number.isNaN(value) ? null : Number(value.toFixed(3));
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
    ...processCleanup!.newDevServerProcessesAfterCleanup,
    ...processCleanup!.newBrowserAutomationProcessesAfterCleanup,
  ];
  assert.equal(
    leftoverProcesses.length,
    0,
    `owned runtime process(es) remained after cleanup:\n${JSON.stringify(leftoverProcesses, null, 2)}`,
  );

  if (validationError) {
    console.error(JSON.stringify({
      runtimeHygiene: { before: summarizeProcesses(beforeProcesses), devServer: devServerInfo, processCleanup },
      result: 'FAIL',
      error: String(validationError),
    }, null, 2));
    throw validationError;
  }

  assert.equal(browserResult!.arrowDetected, true, 'intra-handover arrow was never observed active');
  assert.equal(browserResult!.samples.length, SAMPLE_TARGET_SECONDS.length, 'did not collect all target samples');

  const sampleMap = new Map(browserResult!.samples.map(item => [item.targetSec, item]));
  const t0 = roundSeconds(sampleMap.get(0)?.opacity ?? null);
  const t1 = roundSeconds(sampleMap.get(1)?.opacity ?? null);
  const t2 = roundSeconds(sampleMap.get(2)?.opacity ?? null);
  const t3 = roundSeconds(sampleMap.get(3)?.opacity ?? null);
  const t4_5 = roundSeconds(sampleMap.get(4.5)?.opacity ?? null);
  const t6 = roundSeconds(sampleMap.get(6)?.opacity ?? null);

  const inBandDurationSamples = inBandDurationFromSamples(browserResult!.samples);
  const inBandDurationFrames = inBandDurationFromFrameSamples(browserResult!.frameSamples, 0.3, 0.9);
  const inBandDuration = Math.max(inBandDurationSamples, inBandDurationFrames);
  const firstTransitionSamples = browserResult!.samples.filter(sample => sample.targetSec <= 4.5);

  if (process.env.S2_DUMP_SAMPLES === '1') {
    console.log(
      JSON.stringify({
        startWallClockMs: browserResult!.startWallClockMs,
        sampleRows: browserResult!.samples,
        frameSamples: browserResult!.frameSamples.slice(0, 80),
      }, null, 2),
    );
  }

  const isAutoSlowObserved = browserResult!.autoSlowObserved;
  const minSpeed = Math.min(...browserResult!.samples.map(sample => sample.speed ?? Number.POSITIVE_INFINITY));

  assert.equal(t0 !== null && t0 > 0.9, true, `t=0.0 opacity unexpected: ${t0}`);
  assert.equal(t3 !== null && t3 >= 0.4 && t3 <= 0.6, true, `t=3.0 opacity unexpected: ${t3}`);
  assert.equal(t4_5 !== null && t4_5 >= 0.15 && t4_5 <= 0.35, true, `t=4.5 opacity unexpected: ${t4_5}`);
  assert.equal(isMonotonicSamples(firstTransitionSamples), true, 'opacity should be non-increasing within the first observed wall-clock transition');
  assert.equal(inBandDuration >= 3.3, true, `opacity was in (0.3, 0.9) for only ${inBandDuration.toFixed(3)}s`);
  assert.equal(isAutoSlowObserved || Number.isFinite(minSpeed) && minSpeed < SPEED_TARGET, true, 'auto-slow not observed in window');

  console.log('S2 wall-clock intra-handover latch validation passed.');
  console.log(JSON.stringify({
    runtimeHygiene: { before: summarizeProcesses(beforeProcesses), devServer: devServerInfo, processCleanup },
    browser: {
      appUrl,
      samples: browserResult!.samples,
      sampleSummary: {
        t0,
        t1,
        t2,
        t3,
        t45: t4_5,
        t6,
        opacityMin: browserResult!.opacityMin,
        opacityMax: browserResult!.opacityMax,
        inBandDuration: inBandDuration,
      },
      finalSpeed: browserResult!.finalSpeed,
      minSpeedDuringWindow: Number.isFinite(minSpeed) ? minSpeed : null,
      autoSlowObserved: isAutoSlowObserved,
      pageUrl: browserResult!.pageUrl,
      reducedMotion: {
        active: browserResult!.reducedMotionActive,
        opacityFirst: browserResult!.reducedMotionOpacityFirst,
        opacityLast: browserResult!.reducedMotionOpacityLast,
        stable: browserResult!.reducedMotionOpacityStable,
      },
      forbiddenClaims: browserResult!.forbiddenClaims.length,
    },
  }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
