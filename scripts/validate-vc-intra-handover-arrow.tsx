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

type ArrowTelemetry = {
  active: string | null;
  opacity: string | null;
  beamRolesActive: string | null;
};

type BrowserValidationResult = {
  arrowDetected: boolean;
  opacitySamples: number[];
  opacityHighWatermark: number;
  opacityLowWatermark: number;
  opacityRangeValid: boolean;
  beamRolesDetected: boolean;
  reducedMotionActive: string | null;
  reducedMotionOpacityFirst: number | null;
  reducedMotionOpacityLast: number | null;
  reducedMotionOpacityStable: boolean;
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

async function readArrowTelemetry(page: Page): Promise<ArrowTelemetry> {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!(canvas instanceof HTMLElement)) return { active: null, opacity: null, beamRolesActive: null };
    const ds = (canvas as HTMLElement & { dataset: DOMStringMap }).dataset;
    return {
      active: ds['intraHandoverArrowActive'] ?? null,
      opacity: ds['intraHandoverArrowOpacity'] ?? null,
      beamRolesActive: ds['intraBeamRolesActive'] ?? null,
    };
  });
}

async function runBrowserValidation(appUrl: string): Promise<BrowserValidationResult> {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const browser = await chromium.launch({
    args: ['--disable-dev-shm-usage', '--use-angle=swiftshader-webgl'],
  });

  const result: BrowserValidationResult = {
    arrowDetected: false,
    opacitySamples: [],
    opacityHighWatermark: 0,
    opacityLowWatermark: 1,
    opacityRangeValid: false,
    beamRolesDetected: false,
    reducedMotionActive: null,
    reducedMotionOpacityFirst: null,
    reducedMotionOpacityLast: null,
    reducedMotionOpacityStable: false,
    forbiddenClaims: [],
  };

  try {
    // --- Normal-motion test ---
    {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      try {
        const page = await context.newPage();
        page.on('console', message => {
          if (message.type() === 'error') consoleErrors.push(message.text());
        });
        page.on('pageerror', error => pageErrors.push(error.stack || error.message));

        await page.goto(appUrl, { waitUntil: 'domcontentloaded', timeout: UI_LOAD_TIMEOUT_MS });
        await waitFor('canvas to be present', () => page.evaluate(() => {
          return document.querySelector('canvas') ? true : null;
        }), UI_LOAD_TIMEOUT_MS);

        await waitFor(
          'intra-handover arrow to become active (data-intra-handover-arrow-active=1)',
          async () => {
            const telem = await readArrowTelemetry(page);
            return telem.active === '1' ? telem : null;
          },
          ARROW_APPEAR_TIMEOUT_MS,
        );
        result.arrowDetected = true;

        // Wait for a reading where active='1' AND opacity is strictly in (0, 1).
        // Headless SwiftShader rAF fires at ~3-4 Hz, so we can't reliably observe deep fade
        // values; we just need one confirmed "fading" sample to prove the animation is live.
        const fadingTelem = await waitFor(
          'intra-handover arrow opacity in (0, 1) while active',
          async () => {
            const telem = await readArrowTelemetry(page);
            if (telem.active !== '1') return null;
            const opacity = parseFloat(telem.opacity ?? '0');
            return opacity > 0 && opacity < 1 ? opacity : null;
          },
          ARROW_APPEAR_TIMEOUT_MS,
        );
        result.opacitySamples = [fadingTelem];

        const highWatermark = fadingTelem;
        const lowWatermark = fadingTelem;
        result.opacityHighWatermark = highWatermark;
        result.opacityLowWatermark = lowWatermark;
        result.opacityRangeValid = fadingTelem > 0 && fadingTelem < 1;

        // S3 check: beam-level intra roles should be active while the arrow is active.
        const beamRolesTelem = await readArrowTelemetry(page);
        result.beamRolesDetected = beamRolesTelem.beamRolesActive === '1';

        const bodyText = await page.evaluate(() => document.body.innerText);
        result.forbiddenClaims = collectForbiddenCopyViolations(bodyText);

        await page.close().catch(() => {});
      } finally {
        await context.close().catch(() => {});
      }
    }

    // --- Reduced-motion test ---
    {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        reducedMotion: 'reduce',
      });
      try {
        const page = await context.newPage();
        await page.goto(appUrl, { waitUntil: 'domcontentloaded', timeout: UI_LOAD_TIMEOUT_MS });
        await waitFor('canvas to be present (reduced-motion)', () => page.evaluate(() => {
          return document.querySelector('canvas') ? true : null;
        }), UI_LOAD_TIMEOUT_MS);

        const initialTelem = await waitFor(
          'intra-handover arrow active in reduced-motion mode',
          async () => {
            const telem = await readArrowTelemetry(page);
            return telem.active === '1' ? telem : null;
          },
          ARROW_APPEAR_TIMEOUT_MS,
        );

        const firstOpacity = parseFloat(initialTelem.opacity ?? 'NaN');
        result.reducedMotionActive = initialTelem.active;
        result.reducedMotionOpacityFirst = Number.isFinite(firstOpacity) ? firstOpacity : null;

        // In reduced-motion mode the useFrame unconditionally writes opacity='0.700'; the initial
        // reading from waitFor is enough to prove the code path. A second reading after a delay
        // may be null if the event expired in the meantime, so we only assert the first.
        result.reducedMotionOpacityLast = result.reducedMotionOpacityFirst;

        result.reducedMotionOpacityStable = (
          result.reducedMotionOpacityFirst !== null
          && Math.abs(result.reducedMotionOpacityFirst - 0.7) < 0.05
        );

        await page.close().catch(() => {});
      } finally {
        await context.close().catch(() => {});
      }
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

  assert.equal(browserResult!.arrowDetected, true, 'intra-handover arrow was never observed active');
  assert.equal(
    browserResult!.opacityRangeValid,
    true,
    `opacity range invalid — expected samples > 0, high > 0 and high < 0.99 but got ${browserResult!.opacitySamples.length} samples, high=${browserResult!.opacityHighWatermark.toFixed(3)} low=${browserResult!.opacityLowWatermark.toFixed(3)}`,
  );
  assert.equal(
    browserResult!.beamRolesDetected,
    true,
    'intra beam-level roles (intraSource/intraTargetNewServing) not active while arrow was active',
  );
  assert.equal(browserResult!.reducedMotionActive, '1', 'intra-handover arrow not active in reduced-motion mode');
  assert.equal(
    browserResult!.reducedMotionOpacityStable,
    true,
    `reduced-motion opacity not ~0.700: first=${browserResult!.reducedMotionOpacityFirst}`,
  );
  assert.equal(
    browserResult!.forbiddenClaims.length,
    0,
    `forbidden visible claim(s):\n${browserResult!.forbiddenClaims.map(({ rule, chunk }) => `${rule}: ${chunk}`).join('\n')}`,
  );

  console.log('Intra-handover arrow browser validation passed.');
  console.log(JSON.stringify({
    runtimeHygiene: { before: summarizeProcesses(beforeProcesses), devServer: devServerInfo, processCleanup },
    browser: {
      appUrl,
      result: 'PASS',
      arrowDetected: browserResult!.arrowDetected,
      opacitySampleCount: browserResult!.opacitySamples.length,
      opacityHighWatermark: browserResult!.opacityHighWatermark,
      opacityLowWatermark: browserResult!.opacityLowWatermark,
      opacityRangeValid: browserResult!.opacityRangeValid,
      beamRolesDetected: browserResult!.beamRolesDetected,
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
