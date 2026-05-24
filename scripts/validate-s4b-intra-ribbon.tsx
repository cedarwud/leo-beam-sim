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

type RibbonTelemetry = Readonly<{
  wallClockMs: number;
  arrowActive: string | null;
  pulseProgress: number | null;
  ribbonRadiusWorld: number | null;
  outerGlowOpacity: number | null;
}>;

type BrowserRibbonSample = Readonly<{
  wallClockMs: number;
  arrowActive: string | null;
  pulseProgress: string | null;
  ribbonRadiusWorld: string | null;
  outerGlowOpacity: string | null;
}>;

type SampleSnapshot = Readonly<{
  label: string;
  elapsedMs: number;
  telemetry: RibbonTelemetry;
}>;

type BrowserValidationResult = {
  arrowDetected: boolean;
  samples: SampleSnapshot[];
  finalArrowActive: string | null;
  reducedMotionActive: string | null;
  reducedMotionPulseFirst: number | null;
  reducedMotionGlowFirst: number | null;
  reducedMotionPulseSecond: number | null;
  reducedMotionGlowSecond: number | null;
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

function normalizeBrowserSample(sample: BrowserRibbonSample): RibbonTelemetry {
  return {
    wallClockMs: sample.wallClockMs,
    arrowActive: sample.arrowActive,
    pulseProgress: toNumber(sample.pulseProgress),
    ribbonRadiusWorld: toNumber(sample.ribbonRadiusWorld),
    outerGlowOpacity: toNumber(sample.outerGlowOpacity),
  };
}

async function startRibbonSampler(page: Page): Promise<void> {
  await page.evaluate(`
    (() => {
      if (window.__s4bRibbonTimer !== undefined) {
        window.clearInterval(window.__s4bRibbonTimer);
      }
      window.__s4bRibbonSamples = [];
      window.__s4bRibbonRead = () => {
        const canvas = document.querySelector('canvas');
        const ds = canvas instanceof HTMLElement ? canvas.dataset : null;
        window.__s4bRibbonSamples.push({
          wallClockMs: performance.now(),
          arrowActive: ds?.intraHandoverArrowActive ?? null,
          pulseProgress: ds?.intraPulseProgress ?? null,
          ribbonRadiusWorld: ds?.intraRibbonRadiusWorld ?? null,
          outerGlowOpacity: ds?.intraOuterGlowOpacity ?? null
        });
      };
      window.__s4bRibbonRead();
      window.__s4bRibbonTimer = window.setInterval(window.__s4bRibbonRead, 80);
    })()
  `);
}

async function stopRibbonSampler(page: Page): Promise<void> {
  await page.evaluate(`
    (() => {
      if (window.__s4bRibbonTimer !== undefined) {
        window.clearInterval(window.__s4bRibbonTimer);
        window.__s4bRibbonTimer = undefined;
      }
    })()
  `).catch(() => {});
}

async function readRibbonSampleSnapshots(page: Page): Promise<SampleSnapshot[]> {
  const raw = await page.evaluate(() => {
    type StoredSample = {
      wallClockMs: number;
      arrowActive: string | null;
      pulseProgress: string | null;
      ribbonRadiusWorld: string | null;
      outerGlowOpacity: string | null;
    };
    const sampledWindow = window as Window & typeof globalThis & {
      __s4bRibbonSamples?: StoredSample[];
    };
    return sampledWindow.__s4bRibbonSamples ?? [];
  });
  const telemetry = raw.map(normalizeBrowserSample);
  const firstActive = telemetry.find(isUsable);
  const startedWallClockMs = firstActive?.wallClockMs ?? telemetry[0]?.wallClockMs ?? 0;
  return telemetry.map(t => {
    const elapsedMs = t.wallClockMs - startedWallClockMs;
    return {
      label: `t=${(elapsedMs / 1000).toFixed(2)}s`,
      elapsedMs,
      telemetry: t,
    };
  });
}

async function readRibbonTelemetry(page: Page): Promise<RibbonTelemetry> {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!(canvas instanceof HTMLElement)) {
      return {
        wallClockMs: performance.now(),
        arrowActive: null,
        pulseProgress: null,
        ribbonRadiusWorld: null,
        outerGlowOpacity: null,
      };
    }
    const ds = canvas.dataset as DOMStringMap;
    return {
      wallClockMs: performance.now(),
      arrowActive: ds['intraHandoverArrowActive'] ?? null,
      pulseProgress: ds['intraPulseProgress'] ?? null,
      ribbonRadiusWorld: ds['intraRibbonRadiusWorld'] ?? null,
      outerGlowOpacity: ds['intraOuterGlowOpacity'] ?? null,
    };
  }).then(result => ({
    wallClockMs: result.wallClockMs,
    arrowActive: result.arrowActive,
    pulseProgress: toNumber(result.pulseProgress as string | null),
    ribbonRadiusWorld: toNumber(result.ribbonRadiusWorld as string | null),
    outerGlowOpacity: toNumber(result.outerGlowOpacity as string | null),
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

function isUsable(t: RibbonTelemetry): boolean {
  return t.arrowActive === '1'
    && t.pulseProgress !== null
    && t.ribbonRadiusWorld !== null
    && t.outerGlowOpacity !== null
    && Number.isFinite(t.wallClockMs);
}

function sampleDump(samples: SampleSnapshot[]): string {
  return JSON.stringify(samples.map(s => ({
    el: Math.round(s.elapsedMs),
    aa: s.telemetry.arrowActive,
    pulse: s.telemetry.pulseProgress,
    radius: s.telemetry.ribbonRadiusWorld,
    glow: s.telemetry.outerGlowOpacity,
  })));
}

function hasMotionEvidence(usable: SampleSnapshot[]): boolean {
  for (let i = 0; i < usable.length; i += 1) {
    const prev = usable[i].telemetry.pulseProgress!;
    if (prev <= 0) continue;
    for (let j = i + 1; j < usable.length; j += 1) {
      const next = usable[j].telemetry.pulseProgress!;
      if (next > prev + 0.05) return true;
      if (next < prev) break;
    }
  }
  return false;
}

async function runNormalMotionPass(appUrl: string, result: BrowserValidationResult, browser: Awaited<ReturnType<typeof chromium.launch>>): Promise<void> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  try {
    const page = await context.newPage();
    await page.goto(appUrl, { waitUntil: 'domcontentloaded', timeout: UI_LOAD_TIMEOUT_MS });
    await waitFor('canvas to be present', () => page.evaluate(() => (document.querySelector('canvas') ? true : null)), UI_LOAD_TIMEOUT_MS);
    await setSliderSpeedTo(page, SPEED_TARGET);
    await ensureRunning(page);
    await startRibbonSampler(page);

    const samples = await waitFor(
      'intra ribbon endpoint, motion, and cleanup evidence',
      async () => {
        const currentSamples = await readRibbonSampleSnapshots(page);
        const usableSoFar = currentSamples.filter(s => isUsable(s.telemetry));
        const sawEarlyPulse = usableSoFar.some(s => {
          const pulse = s.telemetry.pulseProgress!;
          return pulse > 0 && pulse <= 0.85;
        });
        const sawClearedSoFar = currentSamples.some(s => s.telemetry.arrowActive === '0');
        const maxPulseSoFar = usableSoFar.length > 0
          ? Math.max(...usableSoFar.map(s => s.telemetry.pulseProgress!))
          : 0;
        if (
          usableSoFar.length >= 2
          && sawEarlyPulse
          && sawClearedSoFar
          && maxPulseSoFar >= 0.95
          && hasMotionEvidence(usableSoFar)
        ) return currentSamples;
        return null;
      },
      ARROW_APPEAR_TIMEOUT_MS,
      200,
    );
    result.arrowDetected = true;
    await stopRibbonSampler(page);

    const usable = samples.filter(s => isUsable(s.telemetry));
    const MIN_USABLE_SAMPLES = 2;
    assert.ok(
      usable.length >= MIN_USABLE_SAMPLES,
      `need at least ${MIN_USABLE_SAMPLES} usable ribbon samples, got ${usable.length} of ${samples.length}. Dump: ${sampleDump(samples)}`,
    );
    for (const s of usable) {
      result.samples.push(s);
    }

    const maxPulse = Math.max(...usable.map(s => s.telemetry.pulseProgress!));
    assert.ok(
      maxPulse >= 0.95,
      `pulse never reached endpoint band (max ${maxPulse}); samples=${sampleDump(samples)}`,
    );

    const moved = hasMotionEvidence(usable);
    assert.ok(
      moved,
      `pulse did not show forward motion > 0.05 between usable samples; samples=${sampleDump(samples)}`,
    );

    for (const s of usable) {
      assert.ok(
        s.telemetry.ribbonRadiusWorld! >= 2.0,
        `ribbon radius below 2.0 world units; samples=${sampleDump(samples)}`,
      );
    }

    const glowVisible = usable.some(s => s.telemetry.outerGlowOpacity! > 0 && s.telemetry.outerGlowOpacity! < 1);
    assert.ok(
      glowVisible,
      `outer glow opacity never entered (0, 1); samples=${sampleDump(samples)}`,
    );

    const sawCleared = samples.some(s => s.telemetry.arrowActive === '0');
    result.finalArrowActive = sawCleared ? '0' : '1';
    assert.equal(
      result.finalArrowActive,
      '0',
      `arrow never reached inactive within the dense sample window; samples=${sampleDump(samples)}`,
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
      'intra ribbon to become active in reduced-motion',
      async () => {
        const telem = await readRibbonTelemetry(page);
        return isUsable(telem) ? telem : null;
      },
      ARROW_APPEAR_TIMEOUT_MS,
    );
    result.reducedMotionActive = first.arrowActive;
    result.reducedMotionPulseFirst = first.pulseProgress;
    result.reducedMotionGlowFirst = first.outerGlowOpacity;

    await delay(400);
    const second = await readRibbonTelemetry(page);
    result.reducedMotionPulseSecond = second.pulseProgress;
    result.reducedMotionGlowSecond = second.outerGlowOpacity;

    assert.ok(
      first.pulseProgress !== null && Math.abs(first.pulseProgress - 0.7) <= 0.0001,
      `reduced-motion pulse progress expected 0.7000 +/- 0.0001, got ${first.pulseProgress}`,
    );

    let stable = true;
    if (first.pulseProgress !== null && second.pulseProgress !== null) {
      if (Math.abs(first.pulseProgress - second.pulseProgress) > 0.01) stable = false;
    }
    if (first.outerGlowOpacity !== null && second.outerGlowOpacity !== null) {
      if (Math.abs(first.outerGlowOpacity - second.outerGlowOpacity) > 0.01) stable = false;
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
    samples: [],
    finalArrowActive: null,
    reducedMotionActive: null,
    reducedMotionPulseFirst: null,
    reducedMotionGlowFirst: null,
    reducedMotionPulseSecond: null,
    reducedMotionGlowSecond: null,
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
    return result;
  } finally {
    await browser.close().catch(() => {});
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

  assert.equal(browserResult!.arrowDetected, true, 'intra ribbon arrow was never observed active');
  assert.equal(browserResult!.reducedMotionActive, '1', 'ribbon not active in reduced-motion mode');
  assert.ok(
    browserResult!.reducedMotionStable,
    `reduced-motion pulse/glow oscillated across samples: pulse ${browserResult!.reducedMotionPulseFirst}->${browserResult!.reducedMotionPulseSecond}, glow ${browserResult!.reducedMotionGlowFirst}->${browserResult!.reducedMotionGlowSecond}`,
  );

  console.log('Intra ribbon S4b browser validation passed.');
  console.log(JSON.stringify({
    runtimeHygiene: { before: summarizeProcesses(beforeProcesses), devServer: devServerInfo, processCleanup },
    browser: {
      appUrl,
      result: 'PASS',
      arrowDetected: browserResult!.arrowDetected,
      samples: browserResult!.samples.map(s => ({
        label: s.label,
        elapsedMs: Math.round(s.elapsedMs),
        arrowActive: s.telemetry.arrowActive,
        pulseProgress: s.telemetry.pulseProgress,
        ribbonRadiusWorld: s.telemetry.ribbonRadiusWorld,
        outerGlowOpacity: s.telemetry.outerGlowOpacity,
      })),
      finalArrowActive: browserResult!.finalArrowActive,
      reducedMotion: {
        active: browserResult!.reducedMotionActive,
        pulseFirst: browserResult!.reducedMotionPulseFirst,
        glowFirst: browserResult!.reducedMotionGlowFirst,
        pulseSecond: browserResult!.reducedMotionPulseSecond,
        glowSecond: browserResult!.reducedMotionGlowSecond,
        stable: browserResult!.reducedMotionStable,
      },
    },
  }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
