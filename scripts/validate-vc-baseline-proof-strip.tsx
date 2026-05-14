import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const REQUEST_TIMEOUT_MS = 900;
const DEV_SERVER_START_TIMEOUT_MS = 30_000;
const UI_LOAD_TIMEOUT_MS = 30_000;

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

type ForbiddenCopyViolation = Readonly<{
  rule: string;
  chunk: string;
}>;

type BrowserValidationResult = {
  stampPresent: boolean;
  baselineDate: string | null;
  baselineRows: string | null;
  textContainsDate: boolean;
  textContainsRows: boolean;
  textContainsBeamCount: boolean;
  forbiddenClaims: ForbiddenCopyViolation[];
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

function collectForbiddenProofStampViolations(stampText: string): ForbiddenCopyViolation[] {
  const normalized = stampText.replace(/\s+/g, ' ').trim().toLowerCase();
  const violations: ForbiddenCopyViolation[] = [];
  const rules: Array<{ name: string; pattern: RegExp }> = [
    {
      name: '19-beam forbidden claim on proof stamp',
      pattern: /\b19[-\s]?beam\b/i,
    },
    {
      name: '37-beam forbidden claim on proof stamp',
      pattern: /\b37[-\s]?beam\b/i,
    },
  ];
  for (const rule of rules) {
    if (rule.pattern.test(normalized)) {
      violations.push({ rule: rule.name, chunk: normalized });
    }
  }
  return violations;
}

async function runBrowserValidation(appUrl: string): Promise<BrowserValidationResult> {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const browser = await chromium.launch({
    args: ['--disable-dev-shm-usage', '--use-angle=swiftshader-webgl'],
  });

  const result: BrowserValidationResult = {
    stampPresent: false,
    baselineDate: null,
    baselineRows: null,
    textContainsDate: false,
    textContainsRows: false,
    textContainsBeamCount: false,
    forbiddenClaims: [],
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

      await waitFor('proof stamp element to be present', () => page.evaluate(() => {
        return document.querySelector('[data-testid="modqn-baseline-proof-stamp"]') ? true : null;
      }), UI_LOAD_TIMEOUT_MS);

      result.stampPresent = true;

      const stampData = await page.evaluate(() => {
        const el = document.querySelector('[data-testid="modqn-baseline-proof-stamp"]') as HTMLElement | null;
        if (!el) return null;
        return {
          baselineDate: el.getAttribute('data-baseline-date'),
          baselineRows: el.getAttribute('data-baseline-rows'),
          textContent: el.textContent ?? '',
        };
      });

      assert.ok(stampData !== null, 'proof stamp element not found after waitFor');

      result.baselineDate = stampData.baselineDate;
      result.baselineRows = stampData.baselineRows;

      const stampText = stampData.textContent ?? '';
      result.textContainsDate = stampText.includes('2026-05-11');
      result.textContainsRows = stampText.includes('1000');
      result.textContainsBeamCount = stampText.includes('7');
      result.forbiddenClaims = collectForbiddenProofStampViolations(stampText);

      assert.deepEqual(pageErrors, [], `browser page error(s):\n${pageErrors.join('\n')}`);
      assert.deepEqual(consoleErrors, [], `browser console error(s):\n${consoleErrors.join('\n')}`);

      await page.close().catch(() => {});
    } finally {
      await context.close().catch(() => {});
    }

    return result;
  } finally {
    await browser.close().catch(() => {});
  }
}

async function cleanupOwnedRuntimeProcesses(beforeProcesses: ProcessInfo[]) {
  const beforePids = new Set(beforeProcesses.map(p => p.pid));
  const findOwnedProcesses = (processes: ProcessInfo[]) => {
    const newProcesses = processes.filter(p => !beforePids.has(p.pid));
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
    }, null, 2));
    throw validationError;
  }

  assert.equal(browserResult!.stampPresent, true, 'modqn-baseline-proof-stamp element not present in DOM');
  assert.equal(
    browserResult!.baselineDate,
    '2026-05-11',
    `data-baseline-date expected "2026-05-11" but got "${browserResult!.baselineDate}"`,
  );
  assert.equal(
    browserResult!.baselineRows,
    '1000',
    `data-baseline-rows expected "1000" but got "${browserResult!.baselineRows}"`,
  );
  assert.equal(
    browserResult!.textContainsDate,
    true,
    'proof stamp visible text does not contain "2026-05-11"',
  );
  assert.equal(
    browserResult!.textContainsRows,
    true,
    'proof stamp visible text does not contain "1000"',
  );
  assert.equal(
    browserResult!.textContainsBeamCount,
    true,
    'proof stamp visible text does not contain "7" (beam count)',
  );
  assert.equal(
    browserResult!.forbiddenClaims.length,
    0,
    `forbidden claim(s) on proof stamp:\n${browserResult!.forbiddenClaims.map(({ rule, chunk }) => `${rule}: ${chunk}`).join('\n')}`,
  );

  console.log('Baseline proof strip browser validation passed.');
  console.log(JSON.stringify({
    runtimeHygiene: { before: summarizeProcesses(beforeProcesses), devServer: devServerInfo, processCleanup },
    browser: {
      appUrl,
      result: 'PASS',
      stampPresent: browserResult!.stampPresent,
      baselineDate: browserResult!.baselineDate,
      baselineRows: browserResult!.baselineRows,
      textContainsDate: browserResult!.textContainsDate,
      textContainsRows: browserResult!.textContainsRows,
      textContainsBeamCount: browserResult!.textContainsBeamCount,
      forbiddenClaims: browserResult!.forbiddenClaims.length,
    },
  }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
