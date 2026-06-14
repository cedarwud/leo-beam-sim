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
const INTRA_EVENT_TIMEOUT_MS = 120_000;
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

type DiagnosticsReadings = Readonly<{
  intraHoPerSimMin: number | null;
  interHoPerSimMin: number | null;
  wallClockElapsedSec: number | null;
  simTimeSec: number | null;
  intraHoCount: number | null;
  hoCount: number | null;
}>;

type BrowserValidationResult = {
  drawerExpanded: boolean;
  intraArrowDetected: boolean;
  before: DiagnosticsReadings | null;
  after: DiagnosticsReadings | null;
  wallClockDeltaSec: number | null;
  simTimeDeltaSec: number | null;
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

async function readDiagnosticsDrawer(page: Page): Promise<DiagnosticsReadings> {
  return page.evaluate(() => {
    const drawer = document.querySelector('[data-testid="diagnostics-drawer"][data-drawer-state="expanded"]');
    const ds = drawer instanceof HTMLElement ? drawer.dataset : null;
    return {
      intraHoPerSimMin: ds?.intraHoPerSimMin ?? null,
      interHoPerSimMin: ds?.interHoPerSimMin ?? null,
      wallClockElapsedSec: ds?.simWallclockElapsedSec ?? null,
      simTimeSec: ds?.simTimeSec ?? null,
      intraHoCount: ds?.intraHoCount ?? null,
      hoCount: ds?.hoCount ?? null,
    };
  }).then(result => ({
    intraHoPerSimMin: toNumber(result.intraHoPerSimMin),
    interHoPerSimMin: toNumber(result.interHoPerSimMin),
    wallClockElapsedSec: toNumber(result.wallClockElapsedSec),
    simTimeSec: toNumber(result.simTimeSec),
    intraHoCount: toNumber(result.intraHoCount),
    hoCount: toNumber(result.hoCount),
  }));
}

async function runBrowserValidation(appUrl: string): Promise<BrowserValidationResult> {
  const browser = await chromium.launch({
    args: ['--disable-dev-shm-usage', '--use-angle=swiftshader-webgl'],
  });
  const result: BrowserValidationResult = {
    drawerExpanded: false,
    intraArrowDetected: false,
    before: null,
    after: null,
    wallClockDeltaSec: null,
    simTimeDeltaSec: null,
  };

  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    try {
      const page = await context.newPage();
      await page.goto(appUrl, { waitUntil: 'domcontentloaded', timeout: UI_LOAD_TIMEOUT_MS });
      await waitFor('canvas to be present', () => page.evaluate(() => (document.querySelector('canvas') ? true : null)), UI_LOAD_TIMEOUT_MS);
      await waitFor(
        'DiagnosticsDrawer to be present',
        () => page.evaluate(() => (
          document.querySelector('[data-testid="diagnostics-drawer"]') ? true : null
        )),
        UI_LOAD_TIMEOUT_MS,
      );
      await page.locator('[data-testid="diagnostics-drawer-tab"]').click();
      await page.locator('[data-testid="diagnostics-drawer"][data-drawer-state="expanded"]').waitFor({ timeout: 5000 });
      result.drawerExpanded = true;

      await setSliderSpeedTo(page, SPEED_TARGET);
      await ensureRunning(page);
      await waitFor(
        'intra-handover arrow active dataset flag',
        () => page.evaluate(() => {
          const canvas = document.querySelector('canvas');
          const active = canvas instanceof HTMLElement ? canvas.dataset.intraHandoverArrowActive : null;
          return active === '1' ? true : null;
        }),
        INTRA_EVENT_TIMEOUT_MS,
      );
      result.intraArrowDetected = true;

      // The DiagnosticsDrawer reads simState through useSimStatePublisher, which
      // commits after the canvas useFrame attr write. Wait for the drawer's own
      // data-intra-ho-count >= 1 before reading rate attrs to avoid a stale-DOM
      // race where the canvas latch is active but React has not yet committed.
      const before = await waitFor(
        'DiagnosticsDrawer to publish intraHoCount >= 1',
        async () => {
          const reading = await readDiagnosticsDrawer(page);
          if (reading.intraHoCount !== null && reading.intraHoCount >= 1 && reading.intraHoPerSimMin !== null && reading.intraHoPerSimMin > 0) {
            return reading;
          }
          return null;
        },
        INTRA_EVENT_TIMEOUT_MS,
      );
      result.before = before;
      assert.ok(before.intraHoPerSimMin !== null && before.intraHoPerSimMin > 0, 'intra-HO per-sim-min not positive after intra fired');
      assert.ok(before.interHoPerSimMin !== null && before.interHoPerSimMin >= 0, 'inter-HO per-sim-min negative or missing');
      assert.ok(before.wallClockElapsedSec !== null, 'wall-clock elapsed missing');
      assert.ok(before.simTimeSec !== null, 'sim time missing');
      assert.ok(before.intraHoCount !== null && before.intraHoCount >= 1, 'intra-HO count missing after intra fired');
      assert.ok(before.hoCount !== null && before.hoCount >= 1, 'HO count missing after intra fired');

      // Wall-clock readout updates via a 1 Hz setInterval inside the drawer.
      // A fixed delay(1500) can read between two consecutive setInterval ticks
      // (e.g. before-read just after tick T captures elapsed=N, after-read
      // just before tick T+2 still captures N+1 = +1.0 floor; loaded systems
      // can even miss the tick boundary entirely). Wait actively for the
      // attr to advance by >= 1.0 sec, with a generous timeout so we never
      // assert on a not-yet-ticked sample.
      const beforeWallClock = before.wallClockElapsedSec;
      const after = await waitFor(
        'wall-clock elapsed to advance >= 1.0 sec',
        async () => {
          const reading = await readDiagnosticsDrawer(page);
          if (reading.wallClockElapsedSec !== null && reading.wallClockElapsedSec - beforeWallClock >= 1.0) {
            return reading;
          }
          return null;
        },
        5_000,
      );
      result.after = after;
      assert.ok(after.wallClockElapsedSec !== null, 'wall-clock elapsed missing after delay');
      assert.ok(after.simTimeSec !== null, 'sim time missing after delay');
      result.wallClockDeltaSec = after.wallClockElapsedSec - before.wallClockElapsedSec;
      result.simTimeDeltaSec = after.simTimeSec - before.simTimeSec;
      assert.ok(result.wallClockDeltaSec >= 1.0, 'wall-clock elapsed not advancing');
      assert.ok(result.simTimeDeltaSec > 0, 'sim time not advancing at speed 20x');

      await page.close().catch(() => {});
    } finally {
      await context.close().catch(() => {});
    }
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

  console.log('Diagnostics rate S5 browser validation passed.');
  console.log(JSON.stringify({
    runtimeHygiene: { before: summarizeProcesses(beforeProcesses), devServer: devServerInfo, processCleanup },
    browser: {
      appUrl,
      result: 'PASS',
      drawerExpanded: browserResult!.drawerExpanded,
      intraArrowDetected: browserResult!.intraArrowDetected,
      before: browserResult!.before,
      after: browserResult!.after,
      wallClockDeltaSec: browserResult!.wallClockDeltaSec,
      simTimeDeltaSec: browserResult!.simTimeDeltaSec,
    },
  }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
