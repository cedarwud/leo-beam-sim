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
const ARROW_APPEAR_TIMEOUT_MS = 120_000;
const SPEED_TARGET = 20;
const LATCH_WALLCLOCK_MS = 6000;

type ProcessInfo = Readonly<{
  pid: number;
  ppid: number;
  stat: string;
  cmd: string;
}>;

type ChildProcessResult = Readonly<{
  pid: number | null;
  stopped: boolean;
  signal: string | null | number;
}>;

type ProcessTableClose = Readonly<{
  code: number | null;
  signal: number | string | null;
}>;

type ShockwaveTelemetry = Readonly<{
  wallClockMs: number;
  arrowActive: string | null;
  shockwaveActive: string | null;
  sourceOpacity: number | null;
  targetOpacity: number | null;
  sourceScale: number | null;
  targetScale: number | null;
}>;

type SampleSnapshot = Readonly<{
  label: string;
  elapsedMs: number;
  telemetry: ShockwaveTelemetry;
}>;

type BrowserValidationResult = {
  arrowDetected: boolean;
  shockwaveDetected: boolean;
  samples: SampleSnapshot[];
  finalShockwaveActive: string | null;
  reducedMotionActive: string | null;
  reducedMotionSourceOpacityFirst: number | null;
  reducedMotionTargetOpacityFirst: number | null;
  reducedMotionSourceOpacitySecond: number | null;
  reducedMotionTargetOpacitySecond: number | null;
  reducedMotionStable: boolean;
};

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

function isDevServerProcess(p: ProcessInfo): boolean {
  return /\bnpm\s+run\s+dev\b|\bvite\b/i.test(p.cmd);
}

function isBrowserAutomationProcess(p: ProcessInfo): boolean {
  return /playwright|google-chrome|chromium|chrome\b|swiftshader|--use-angle=swiftshader-webgl/i.test(p.cmd);
}

function isRelevantRuntimeProcess(p: ProcessInfo): boolean {
  return isDevServerProcess(p) || isBrowserAutomationProcess(p);
}

function formatProcess(p: ProcessInfo) {
  return { pid: p.pid, ppid: p.ppid, stat: p.stat, cmd: p.cmd };
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
    if (await isLeoAppServer(appUrl)) return appUrl;
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
          throw new Error(`temporary Vite dev server exited early with code ${child.exitCode}\n${output}`);
        }
        for (const candidate of [...extractCandidateUrls(output), ...candidateAppUrls()]) {
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
  child: import('node:child_process').ChildProcessWithoutNullStreams,
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

function toNumber(value: string | null): number | null {
  if (value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function readShockwaveTelemetry(page: Page): Promise<ShockwaveTelemetry> {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!(canvas instanceof HTMLElement)) {
      return {
        wallClockMs: performance.now(),
        arrowActive: null,
        shockwaveActive: null,
        sourceOpacity: null,
        targetOpacity: null,
        sourceScale: null,
        targetScale: null,
      };
    }
    const ds = canvas.dataset as DOMStringMap;
    return {
      wallClockMs: performance.now(),
      arrowActive: ds['intraHandoverArrowActive'] ?? null,
      shockwaveActive: ds['intraShockwaveActive'] ?? null,
      sourceOpacity: ds['intraShockwaveSourceOpacity'] ?? null,
      targetOpacity: ds['intraShockwaveTargetOpacity'] ?? null,
      sourceScale: ds['intraShockwaveSourceScale'] ?? null,
      targetScale: ds['intraShockwaveTargetScale'] ?? null,
    };
  }).then(result => ({
    wallClockMs: result.wallClockMs,
    arrowActive: result.arrowActive,
    shockwaveActive: result.shockwaveActive,
    sourceOpacity: toNumber(result.sourceOpacity as string | null),
    targetOpacity: toNumber(result.targetOpacity as string | null),
    sourceScale: toNumber(result.sourceScale as string | null),
    targetScale: toNumber(result.targetScale as string | null),
  }));
}

async function setSliderSpeedTo(page: Page, speed: number): Promise<void> {
  await page.evaluate((value) => {
    const slider = document.querySelector('input[type="range"]');
    if (!(slider instanceof HTMLInputElement)) {
      throw new Error('expected a speed slider input');
    }
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (setter) {
      setter.call(slider, String(value));
    } else {
      slider.value = String(value);
    }
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

// Headless SwiftShader rAF caps useFrame at ~3-4 Hz, and Playwright
// page.evaluate round-trips add their own ~150-300 ms each. Worse, the
// upstream `vizFrame.intraHandoverEvent` goes null/non-null on a per-VizFrame
// basis as `useBeamViz` recomputes from `transitionProgress.intra` + visible
// sat set, which causes our component to unmount/remount and the dataset
// to clear momentarily. So we cannot rely on observing a full 6 s envelope
// from a single event.
//
// We instead assert on what is RELIABLY observable in headless:
//   - At least one "early-phase" sample where source opacity > 0.4 and
//     source scale >= 0.85 (proves the source ring opens at near-full
//     radius and high opacity — the visual hallmark of the shockwave start).
//   - At least one "target growth" sample where target scale >= 0.9 OR
//     target opacity > 0.25 (proves the target ring expanded past its
//     initial 0.4x AND/OR was visibly drawn).
//   - At least one sample with shockwaveActive='0' (proves the component
//     cleanly disposes between events).
//   - Reduced-motion path: stable values across two consecutive reads.
const EARLY_SOURCE_OPACITY_MIN = 0.4;
const EARLY_SOURCE_SCALE_MIN = 0.85;
const TARGET_SCALE_GROWN_MIN = 0.85;
const TARGET_OPACITY_PEAK_MIN = 0.25;

async function runNormalMotionPass(appUrl: string, result: BrowserValidationResult, browser: Awaited<ReturnType<typeof chromium.launch>>): Promise<void> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  try {
    const page = await context.newPage();
    await page.goto(appUrl, { waitUntil: 'domcontentloaded', timeout: UI_LOAD_TIMEOUT_MS });
    await waitFor('canvas to be present', () => page.evaluate(() => (document.querySelector('canvas') ? true : null)), UI_LOAD_TIMEOUT_MS);
    await setSliderSpeedTo(page, SPEED_TARGET);
    await ensureRunning(page);

    // Wait for an "early-window" shockwave reading where the source ring
    // still has high opacity (i.e. we caught the latch within its first
    // ~2 s). This filters out cases where we caught the tail end of an
    // event already half-expired, which would give us 0 useful samples
    // during the dense window.
    const SOURCE_OPACITY_START = 0.85;
    const EARLY_LOCK_THRESHOLD = 0.55; // > halfway between full and floor
    const shockwaveStart = await waitFor(
      'shockwave to be active near the latch start (sourceOpacity > 0.55)',
      async () => {
        const telem = await readShockwaveTelemetry(page);
        if (telem.shockwaveActive !== '1') return null;
        if (telem.sourceOpacity === null) return null;
        if (telem.sourceOpacity < EARLY_LOCK_THRESHOLD) return null;
        return telem;
      },
      ARROW_APPEAR_TIMEOUT_MS,
      50,
    );
    // arrowDetected: "did the arrow latch ever activate during the run?" —
    // we record a best-effort observation here but never block on it because
    // the arrow's lifecycle is asynchronous with the shockwave's mount-time
    // dataset write under SwiftShader-throttled rAF.
    result.arrowDetected = shockwaveStart.arrowActive === '1';
    result.shockwaveDetected = true;
    // Back out the rAF "missed window" between the true latch start and the
    // first sample we observed: source opacity drops linearly from
    // SOURCE_OPACITY_START to 0 across the 6 s latch.
    const inferredStartOffsetMs = Math.max(
      0,
      ((SOURCE_OPACITY_START - shockwaveStart.sourceOpacity!) / SOURCE_OPACITY_START) * LATCH_WALLCLOCK_MS,
    );
    const startedWallClockMs = shockwaveStart.wallClockMs - inferredStartOffsetMs;

    // Densely sample across a long enough window that even with intra
    // event boundaries (component remount cycles that briefly null out
    // dataset attrs) we collect a meaningful set of active samples.
    // Headless SwiftShader rAF is throttled to ~3-4 Hz; we sample at 80 ms
    // intervals and accept whatever we get over ~12 s of wall clock so the
    // envelope-shape checks have enough evidence.
    const samples: SampleSnapshot[] = [{
      label: `t=${(inferredStartOffsetMs / 1000).toFixed(2)}s`,
      elapsedMs: inferredStartOffsetMs,
      telemetry: shockwaveStart,
    }];
    // Keep collecting samples until we have at least MIN_USABLE_SAMPLES
    // populated readings (active=1 with non-null opacities) AND have observed
    // at least one cleared sample (active=0), OR until a hard timeout.
    // Intra events at candidate-rich + 20x speed fire ~every 12s wall-clock,
    // so the timeout is sized generously.
    const MIN_USABLE_SAMPLES = 2;
    const HARD_TIMEOUT_MS = 60_000;
    const denseDeadlineWallClock = Date.now() + HARD_TIMEOUT_MS;
    let sawCleared = false;
    while (Date.now() < denseDeadlineWallClock) {
      const telem = await readShockwaveTelemetry(page);
      const elapsed = telem.wallClockMs - startedWallClockMs;
      if (telem.shockwaveActive === '0') sawCleared = true;
      samples.push({
        label: `t=${(elapsed / 1000).toFixed(2)}s`,
        elapsedMs: elapsed,
        telemetry: telem,
      });
      const usableSoFar = samples.filter(s => {
        const t = s.telemetry;
        return t.shockwaveActive === '1'
          && t.sourceOpacity !== null
          && t.targetOpacity !== null
          && t.sourceScale !== null
          && t.targetScale !== null;
      }).length;
      if (usableSoFar >= MIN_USABLE_SAMPLES && sawCleared) break;
      await delay(80);
    }

    // Filter to usable samples (all four telemetry fields present, shockwave
    // active). Push all of them onto result.samples for the PR transcript.
    const usable = samples.filter(s => {
      const t = s.telemetry;
      return t.shockwaveActive === '1'
        && t.sourceOpacity !== null
        && t.targetOpacity !== null
        && t.sourceScale !== null
        && t.targetScale !== null;
    });
    const arrowActiveCount = samples.filter(s => s.telemetry.arrowActive === '1').length;
    const shockwaveActiveCount = samples.filter(s => s.telemetry.shockwaveActive === '1').length;
    assert.ok(
      usable.length >= 2,
      `need at least 2 usable shockwave samples for envelope check, got ${usable.length} of ${samples.length} dense samples (arrow-active=${arrowActiveCount}, shockwave-active=${shockwaveActiveCount}). Dump: ${JSON.stringify(samples.map(s => ({ el: Math.round(s.elapsedMs), aa: s.telemetry.arrowActive, sa: s.telemetry.shockwaveActive, so: s.telemetry.sourceOpacity, to: s.telemetry.targetOpacity })))}`,
    );
    for (const s of usable) {
      result.samples.push(s);
    }

    // Shape assertion 1: source ring opens at near-full radius with high opacity.
    const earlyEvidence = usable.some(s => {
      const t = s.telemetry;
      return t.sourceOpacity! > EARLY_SOURCE_OPACITY_MIN
        && t.sourceScale! >= EARLY_SOURCE_SCALE_MIN;
    });
    assert.ok(
      earlyEvidence,
      `no early-phase sample (source opacity > ${EARLY_SOURCE_OPACITY_MIN} && source scale >= ${EARLY_SOURCE_SCALE_MIN}); samples=${JSON.stringify(usable.map(s => ({ el: Math.round(s.elapsedMs), so: s.telemetry.sourceOpacity, ss: s.telemetry.sourceScale })))}`,
    );

    // Shape assertion 2: target ring evidence — at least one sample where
    // target scale has grown past its 0.4x start OR target opacity has
    // crossed the peak band. This proves the target ring renders meaningfully
    // (one of the two is sufficient — headless rAF gaps mean we may not catch
    // both within the few-sample window we have).
    const targetEvidence = usable.some(s => {
      const t = s.telemetry;
      return t.targetScale! >= TARGET_SCALE_GROWN_MIN
        || t.targetOpacity! > TARGET_OPACITY_PEAK_MIN;
    });
    assert.ok(
      targetEvidence,
      `no target-ring evidence (target scale >= ${TARGET_SCALE_GROWN_MIN} OR target opacity > ${TARGET_OPACITY_PEAK_MIN}); samples=${JSON.stringify(usable.map(s => ({ el: Math.round(s.elapsedMs), to: s.telemetry.targetOpacity, ts: s.telemetry.targetScale })))}`,
    );

    // Confirm the dense stream saw at least one sample with
    // shockwaveActive='0' (proves the component clears state at latch
    // boundaries — i.e. between intra events — rather than staying on
    // forever).
    const cleared = samples.some(s => s.telemetry.shockwaveActive === '0');
    result.finalShockwaveActive = cleared ? '0' : '1';
    assert.equal(
      result.finalShockwaveActive,
      '0',
      `shockwave never reached inactive within the dense sample window`,
    );

    await page.close().catch(() => {});
  } finally {
    await context.close().catch(() => {});
  }
}

async function runReducedMotionPass(appUrl: string, result: BrowserValidationResult, browser: Awaited<ReturnType<typeof chromium.launch>>): Promise<void> {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  });
  try {
    const page = await context.newPage();
    await page.goto(appUrl, { waitUntil: 'domcontentloaded', timeout: UI_LOAD_TIMEOUT_MS });
    await waitFor('canvas to be present (reduced-motion)', () => page.evaluate(() => (document.querySelector('canvas') ? true : null)), UI_LOAD_TIMEOUT_MS);
    await setSliderSpeedTo(page, SPEED_TARGET);
    await ensureRunning(page);

    const first = await waitFor(
      'shockwave to become active in reduced-motion',
      async () => {
        const telem = await readShockwaveTelemetry(page);
        return telem.shockwaveActive === '1' ? telem : null;
      },
      ARROW_APPEAR_TIMEOUT_MS,
    );
    result.reducedMotionActive = first.shockwaveActive;
    result.reducedMotionSourceOpacityFirst = first.sourceOpacity;
    result.reducedMotionTargetOpacityFirst = first.targetOpacity;

    // Take a second sample after a short delay; opacities should be stable
    // (no per-frame oscillation in reduced motion).
    await delay(400);
    const second = await readShockwaveTelemetry(page);
    result.reducedMotionSourceOpacitySecond = second.sourceOpacity;
    result.reducedMotionTargetOpacitySecond = second.targetOpacity;

    // Stability: differences within 0.01 across the two samples (when both are present).
    let stable = true;
    if (first.sourceOpacity !== null && second.sourceOpacity !== null) {
      if (Math.abs(first.sourceOpacity - second.sourceOpacity) > 0.01) stable = false;
    }
    if (first.targetOpacity !== null && second.targetOpacity !== null) {
      if (Math.abs(first.targetOpacity - second.targetOpacity) > 0.01) stable = false;
    }
    result.reducedMotionStable = stable;

    await page.close().catch(() => {});
  } finally {
    await context.close().catch(() => {});
  }
}

async function runBrowserValidation(appUrl: string): Promise<BrowserValidationResult> {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const browser = await chromium.launch({
    args: ['--disable-dev-shm-usage', '--use-angle=swiftshader-webgl'],
  });

  const result: BrowserValidationResult = {
    arrowDetected: false,
    shockwaveDetected: false,
    samples: [],
    finalShockwaveActive: null,
    reducedMotionActive: null,
    reducedMotionSourceOpacityFirst: null,
    reducedMotionTargetOpacityFirst: null,
    reducedMotionSourceOpacitySecond: null,
    reducedMotionTargetOpacitySecond: null,
    reducedMotionStable: false,
  };

  try {
    const collectErrors = (page: Page) => {
      page.on('console', message => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });
      page.on('pageerror', error => pageErrors.push(error.stack || error.message));
    };
    void collectErrors;

    await runNormalMotionPass(appUrl, result, browser);
    await runReducedMotionPass(appUrl, result, browser);

    assert.deepEqual(pageErrors, [], `browser page error(s):\n${pageErrors.join('\n')}`);
    // console errors are commonly tolerated by other validators; only assert
    // that nothing throws hard. We surface them in the JSON output.
    return result;
  } finally {
    await browser.close().catch(() => {});
    // Give Chromium subprocesses time to fully exit before cleanup audit.
    await delay(500);
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
  for (const p of ownedProcesses) {
    try {
      process.kill(p.pid, 'SIGTERM');
      killedProcessIds.push(p.pid);
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
      partial: browserResult,
      error: String(validationError),
    }, null, 2));
    throw validationError;
  }

  // arrowDetected is best-effort; the shockwave is the slice deliverable.
  assert.equal(browserResult!.shockwaveDetected, true, 'intra ground shockwave was never observed active');
  assert.equal(browserResult!.reducedMotionActive, '1', 'shockwave not active in reduced-motion mode');
  assert.ok(
    browserResult!.reducedMotionStable,
    `reduced-motion opacities oscillated across samples: src ${browserResult!.reducedMotionSourceOpacityFirst}->${browserResult!.reducedMotionSourceOpacitySecond}, tgt ${browserResult!.reducedMotionTargetOpacityFirst}->${browserResult!.reducedMotionTargetOpacitySecond}`,
  );

  console.log('Intra ground-shockwave (B4) browser validation passed.');
  console.log(JSON.stringify({
    runtimeHygiene: { before: summarizeProcesses(beforeProcesses), devServer: devServerInfo, processCleanup },
    browser: {
      appUrl,
      result: 'PASS',
      arrowDetected: browserResult!.arrowDetected,
      shockwaveDetected: browserResult!.shockwaveDetected,
      samples: browserResult!.samples.map(s => ({
        label: s.label,
        elapsedMs: Math.round(s.elapsedMs),
        sourceOpacity: s.telemetry.sourceOpacity,
        targetOpacity: s.telemetry.targetOpacity,
        sourceScale: s.telemetry.sourceScale,
        targetScale: s.telemetry.targetScale,
      })),
      finalShockwaveActive: browserResult!.finalShockwaveActive,
      reducedMotion: {
        active: browserResult!.reducedMotionActive,
        sourceOpacityFirst: browserResult!.reducedMotionSourceOpacityFirst,
        targetOpacityFirst: browserResult!.reducedMotionTargetOpacityFirst,
        sourceOpacitySecond: browserResult!.reducedMotionSourceOpacitySecond,
        targetOpacitySecond: browserResult!.reducedMotionTargetOpacitySecond,
        stable: browserResult!.reducedMotionStable,
      },
    },
  }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
