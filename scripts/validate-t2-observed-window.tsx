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
const INTRA_EVENT_TIMEOUT_MS = 180_000;
const SPEED_TARGET = 20;
const LATCH_WINDOW_MS = 6000;

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

type ObservedWindowReadings = Readonly<{
  count: number | null;
  meanMs: number | null;
  lastMs: number | null;
  pending: string | null;
}>;

type BrowserValidationResult = {
  drawerExpanded: boolean;
  reading: ObservedWindowReadings | null;
  pendingSamples: string[];
  pendingToggleObserved: boolean;
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

async function readDiagnosticsDrawer(page: Page): Promise<ObservedWindowReadings> {
  return page.evaluate(() => {
    const drawer = document.querySelector('[data-testid="diagnostics-drawer"][data-drawer-state="expanded"]');
    if (!(drawer instanceof HTMLElement)) {
      return {
        count: null,
        meanMs: null,
        lastMs: null,
        pending: null,
      };
    }
    const ds = drawer.dataset;
    return {
      count: ds.intraObservedCount ?? null,
      meanMs: ds.intraObservedMeanMs ?? null,
      lastMs: ds.intraObservedLastMs ?? null,
      pending: ds.intraObservedPending ?? null,
    };
  }).then(result => ({
    count: toNumber(result.count),
    meanMs: toNumber(result.meanMs),
    lastMs: toNumber(result.lastMs),
    pending: result.pending,
  }));
}

function assertValidObservedWindow(reading: ObservedWindowReadings): void {
  assert.ok(reading.count !== null && Number.isInteger(reading.count) && reading.count >= 2, 'observed-window count missing or below 2');
  assert.ok(reading.meanMs !== null && Number.isFinite(reading.meanMs), 'observed-window mean missing or non-finite');
  assert.ok(reading.lastMs !== null && Number.isFinite(reading.lastMs), 'observed-window last missing or non-finite');
  assert.ok(reading.meanMs > 0 && reading.meanMs <= LATCH_WINDOW_MS, 'observed-window mean out of (0, 6000]');
  assert.ok(reading.lastMs > 0 && reading.lastMs <= LATCH_WINDOW_MS, 'observed-window last out of (0, 6000]');
  assert.ok(reading.pending === '0' || reading.pending === '1', 'observed-window pending flag must be 0 or 1');
}

async function readPendingSamples(page: Page): Promise<string[]> {
  const samples: string[] = [];
  const startedAt = Date.now();
  while (Date.now() - startedAt < 3_000) {
    const reading = await readDiagnosticsDrawer(page);
    assert.ok(reading.pending === '0' || reading.pending === '1', 'observed-window pending flag must be 0 or 1 while sampling');
    samples.push(reading.pending);
    await delay(200);
  }
  return samples;
}

async function runBrowserValidation(appUrl: string): Promise<BrowserValidationResult> {
  const browser = await chromium.launch({
    args: ['--disable-dev-shm-usage', '--use-angle=swiftshader-webgl'],
  });
  const result: BrowserValidationResult = {
    drawerExpanded: false,
    reading: null,
    pendingSamples: [],
    pendingToggleObserved: false,
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
      const reading = await waitFor(
        'DiagnosticsDrawer observed-window count >= 2',
        async () => {
          const current = await readDiagnosticsDrawer(page);
          if (current.count !== null && current.count >= 2) {
            return current;
          }
          return null;
        },
        INTRA_EVENT_TIMEOUT_MS,
      );
      result.reading = reading;
      assertValidObservedWindow(reading);

      result.pendingSamples = await readPendingSamples(page);
      result.pendingToggleObserved = new Set(result.pendingSamples).size > 1;

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

  console.log('Observed window T2 browser validation passed.');
  console.log(JSON.stringify({
    runtimeHygiene: { before: summarizeProcesses(beforeProcesses), devServer: devServerInfo, processCleanup },
    browser: {
      appUrl,
      result: 'PASS',
      drawerExpanded: browserResult!.drawerExpanded,
      reading: browserResult!.reading,
      pendingSamples: browserResult!.pendingSamples,
      pendingToggleObserved: browserResult!.pendingToggleObserved,
    },
  }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
