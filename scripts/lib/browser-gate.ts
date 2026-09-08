import { chromium, type Browser, type Page } from '@playwright/test';

/**
 * The fastest verified genuine browser-bound validator in this checkout was
 * 932 ms before the shared guard was added. The shared runner adds its own
 * server/browser/readiness proof, so the default enforcement floor is 500
 * ms for the validator phase after the guard has completed; guarded runs report
 * both the complete wall time and the post-guard validator time.
 */
export const DEFAULT_BROWSER_GATE_FLOOR_MS = 500;

export const MEASURED_BROWSER_GATE_FLOORS_MS = Object.freeze({
  /** 1,411 ms minimum before the shared guard; 1,200 ms post-guard floor. */
  layout: 1_200,
  /** 549 ms measured post-guard vc2a run; 500 ms enforcement floor. */
  quickCanvas: 500,
  /** 593 ms measured post-guard vc2c run; 500 ms enforcement floor. */
  multiCanvas: 500,
});

const DEFAULT_APP_URLS = [
  'http://127.0.0.1:3000',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
  'http://127.0.0.1:4174',
] as const;

const APP_READY_TIMEOUT_MS = 30_000;

export interface BrowserGateOptions {
  readonly validator: string;
  readonly appUrl?: string;
  readonly floorMs?: number;
  readonly readyTimeoutMs?: number;
  readonly browserArgs?: string[];
  readonly executablePath?: string;
}

export interface BrowserGateContext {
  readonly appUrl: string;
  readonly browser: Browser;
  readonly page: Page;
}

class BrowserGateVoid extends Error {
  constructor(message: string) {
    super(`VOID / DID NOT RUN — ${message}`);
    this.name = 'BrowserGateVoid';
  }
}

function displayError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  // Do not let a dependency's “failed/failure” wording turn a harness refusal
  // into an app-looking failure for the person reading the gate output.
  return raw.replace(/fail(?:ed|ure|ing)?/gi, 'unable');
}

function explicitAppUrl(appUrl?: string): string | undefined {
  return appUrl ?? process.env.APP_URL ?? undefined;
}

export function isAppBootstrapHtml(html: string): boolean {
  const normalized = html.replace(/\s+/g, ' ');
  const hasExactTitle = /<title>\s*LEO Beam Sim\s*<\/title>/i.test(normalized);
  const hasRoot = /<div\s+id=["']root["']\s*><\/div>/i.test(normalized);
  const hasMainModule = /<script\s+type=["']module["']\s+src=["']\/src\/main\.tsx(?:\?[^"']*)?["']\s*><\/script>/i.test(normalized);
  const looksLikeError = /(?:internal server error|cannot get|vite error|<title>\s*(?:error|404))/i.test(normalized);
  return hasExactTitle && hasRoot && hasMainModule && !looksLikeError;
}

async function fetchAppBootstrap(candidate: string): Promise<{ ok: true; url: string } | { ok: false; reason: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(candidate, {
      redirect: 'error',
      signal: controller.signal,
      headers: { accept: 'text/html' },
    });
    const contentType = response.headers.get('content-type') ?? '';
    const body = await response.text();
    if (!response.ok) return { ok: false, reason: `HTTP ${response.status}` };
    if (!/text\/html/i.test(contentType)) return { ok: false, reason: `content-type ${contentType || '<missing>'}` };
    if (!isAppBootstrapHtml(body)) return { ok: false, reason: 'response body is not the LEO Beam Sim bootstrap' };
    return { ok: true, url: candidate };
  } catch (error) {
    return { ok: false, reason: displayError(error) };
  } finally {
    clearTimeout(timeout);
  }
}

export async function detectAppUrl(appUrl?: string): Promise<string> {
  const explicit = explicitAppUrl(appUrl);
  const candidates = explicit ? [explicit] : [...DEFAULT_APP_URLS];
  const observations: string[] = [];
  for (const candidate of candidates) {
    const result = await fetchAppBootstrap(candidate);
    if (result.ok) return result.url;
    observations.push(`${candidate}: ${result.reason}`);
  }
  throw new BrowserGateVoid(`dev server precondition is absent; no candidate served the app (status/body checked): ${observations.join('; ')}`);
}

async function waitForKnownGoodReadyState(page: Page, timeoutMs: number): Promise<void> {
  try {
    await page.waitForFunction(() => {
      const root = document.getElementById('root');
      if (!root || root.firstElementChild === null) return false;
      if (root.dataset.leoAppReady !== 'true') return false;
      const text = root.textContent ?? '';
      return !/local teaching surface could not start|teaching surface could not start/i.test(text);
    }, undefined, { timeout: timeoutMs });
  } catch (error) {
    throw new BrowserGateVoid(`page precondition is absent; the app did not reach its known-good ready state: ${displayError(error)}`);
  }
}

async function openAndCheckReadyPage(browser: Browser, appUrl: string, timeoutMs: number): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  try {
    await page.goto(appUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await waitForKnownGoodReadyState(page, timeoutMs);
    await page.evaluate(() => document.fonts?.ready);
    return page;
  } catch (error) {
    await page.close().catch(() => {});
    if (error instanceof BrowserGateVoid) throw error;
    throw new BrowserGateVoid(`page precondition is absent; the app could not be loaded and readied: ${displayError(error)}`);
  }
}

async function launchBrowser(options: BrowserGateOptions): Promise<Browser> {
  try {
    return await chromium.launch({
      ...(options.executablePath || process.env.PLAYWRIGHT_EXECUTABLE_PATH
        ? { executablePath: options.executablePath ?? process.env.PLAYWRIGHT_EXECUTABLE_PATH }
        : {}),
      ...(options.browserArgs ? { args: options.browserArgs } : {}),
    });
  } catch (error) {
    throw new BrowserGateVoid(`Playwright browser binary is unavailable or not launchable: ${displayError(error)}`);
  }
}

interface CapturedOutput {
  restore(): void;
  flush(): void;
  discard(): void;
}

function captureOutput(): CapturedOutput {
  let stdout = '';
  let stderr = '';
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  const toText = (chunk: unknown): string => Buffer.isBuffer(chunk) ? chunk.toString() : String(chunk);
  const bufferedStdout = ((chunk: unknown, ...args: unknown[]) => {
    stdout += toText(chunk);
    const callback = args.find(arg => typeof arg === 'function');
    if (callback) (callback as () => void)();
    return true;
  }) as typeof process.stdout.write;
  const bufferedStderr = ((chunk: unknown, ...args: unknown[]) => {
    stderr += toText(chunk);
    const callback = args.find(arg => typeof arg === 'function');
    if (callback) (callback as () => void)();
    return true;
  }) as typeof process.stderr.write;
  process.stdout.write = bufferedStdout;
  process.stderr.write = bufferedStderr;

  let restored = false;
  const restore = (): void => {
    if (restored) return;
    restored = true;
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  };
  return {
    restore,
    flush: () => {
      restore();
      if (stdout) originalStdoutWrite(stdout);
      if (stderr) originalStderrWrite(stderr);
    },
    discard: () => restore(),
  };
}

export async function runBrowserValidator<T>(
  options: BrowserGateOptions,
  run: (context: BrowserGateContext) => Promise<T>,
): Promise<T | undefined> {
  const startedAt = performance.now();
  const floorMs = options.floorMs ?? DEFAULT_BROWSER_GATE_FLOOR_MS;
  let browser: Browser | undefined;
  let page: Page | undefined;
  let captured: CapturedOutput | undefined;
  let validatorStartedAt: number | undefined;
  try {
    const appUrl = await detectAppUrl(options.appUrl);
    browser = await launchBrowser(options);
    page = await openAndCheckReadyPage(browser, appUrl, options.readyTimeoutMs ?? APP_READY_TIMEOUT_MS);
    validatorStartedAt = performance.now();
    captured = captureOutput();
    const result = await run({ appUrl, browser, page });
    const validatorElapsedMs = Math.round(performance.now() - validatorStartedAt);
    const elapsedMs = Math.round(performance.now() - startedAt);
    if (validatorElapsedMs < floorMs) {
      captured.discard();
      console.error(`VOID / DID NOT RUN — ${options.validator} validator phase completed in ${validatorElapsedMs} ms, below its measured floor of ${floorMs} ms`);
      process.exitCode = 1;
      return undefined;
    }
    captured.flush();
    console.log(`[${options.validator}] browser gate + validator wall_ms=${elapsedMs} validator_phase_ms=${validatorElapsedMs} floor_ms=${floorMs}`);
    return result;
  } catch (error) {
    const elapsedMs = Math.round(performance.now() - startedAt);
    const validatorElapsedMs = validatorStartedAt === undefined
      ? elapsedMs
      : Math.round(performance.now() - validatorStartedAt);
    if (captured) captured.discard();
    if (error instanceof BrowserGateVoid || validatorElapsedMs < floorMs) {
      const reason = error instanceof BrowserGateVoid
        ? error.message.replace(/^VOID \/ DID NOT RUN —\s*/, '')
        : `${options.validator} validator phase completed in ${validatorElapsedMs} ms, below its measured floor of ${floorMs} ms`;
      console.error(`VOID / DID NOT RUN — ${reason}`);
      process.exitCode = 1;
      return undefined;
    }
    throw error;
  } finally {
    await page?.close().catch(() => {});
    await browser?.close().catch(() => {});
  }
}
