import { mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, type Page } from '@playwright/test';

const OUTPUT_DIR = 'docs/visual-clarity-proposal/baselines-pre-vc';
const UI_MODE_STORAGE_KEY = 'leo-beam-sim.ui-mode.v1';
const EMPTY_SCREENSHOT_THRESHOLD_BYTES = 5 * 1024;

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
] as const;

async function sleep(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms));
}

async function detectAppUrl(): Promise<string> {
  const explicit = process.env.APP_URL ?? process.argv[2];
  const candidates = explicit
    ? [explicit]
    : [
      'http://127.0.0.1:3000',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:4173',
      'http://127.0.0.1:4174',
    ];

  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate);
      if (!response.ok) continue;
      const html = await response.text();
      if (html.includes('<title>LEO Beam Sim</title>') || html.includes('/src/main')) {
        return candidate;
      }
    } catch {
      // Try next candidate.
    }
  }

  throw new Error(`Could not find a running LEO Beam Sim dev server. Tried: ${candidates.join(', ')}`);
}

function readHoCountFromBody(): number {
  const lines = document.body.innerText
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  const index = lines.indexOf('HO Count');
  if (index < 0) return 0;
  const parsed = Number(lines[index + 1]);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function setSpeed(page: Page, speed: number): Promise<void> {
  await page.locator('input[type="range"]').evaluate((input, nextSpeed) => {
    if (!(input instanceof HTMLInputElement)) return;
    input.value = String(nextSpeed);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, speed);
}

async function selectUiMode(page: Page, mode: 'presentation' | 'diagnostics'): Promise<void> {
  await page.locator('select[aria-label="UI mode"]').selectOption(mode);
}

async function pauseIfRunning(page: Page): Promise<void> {
  const pauseButton = page.getByRole('button', { name: 'Pause' });
  if (await pauseButton.count()) {
    await pauseButton.click();
    await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 2000 });
  }
}

async function prepareScene(page: Page, appUrl: string): Promise<number> {
  await page.addInitScript(storageKey => {
    window.localStorage.setItem(storageKey, 'diagnostics');
  }, UI_MODE_STORAGE_KEY);

  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-testid="info-panel-primary-sinr-status"]').waitFor({ timeout: 30000 });
  await setSpeed(page, 20);

  const hoCount = await page.waitForFunction(readHoCountFromBody, undefined, {
    timeout: 90000,
    polling: 250,
  });
  const value = await hoCount.jsonValue();

  await pauseIfRunning(page);
  await selectUiMode(page, 'presentation');
  await page.locator('[data-testid="info-panel-primary-sinr-status"]').waitFor({ timeout: 5000 });
  await sleep(800);

  return Number(value);
}

async function captureViewport(page: Page, width: number, height: number): Promise<{ file: string; size: number; retried: boolean }> {
  await page.setViewportSize({ width, height });
  await sleep(800);

  const file = `baseline-pre-vc-${width}x${height}.png`;
  const path = join(OUTPUT_DIR, file);
  await page.screenshot({ path });
  let size = (await stat(path)).size;
  let retried = false;

  if (size < EMPTY_SCREENSHOT_THRESHOLD_BYTES) {
    retried = true;
    await sleep(10000);
    await page.screenshot({ path });
    size = (await stat(path)).size;
  }

  return { file, size, retried };
}

async function main(): Promise<void> {
  const appUrl = await detectAppUrl();
  await mkdir(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    const hoCount = await prepareScene(page, appUrl);
    const captures = [];
    for (const viewport of VIEWPORTS) {
      captures.push(await captureViewport(page, viewport.width, viewport.height));
    }

    console.log(JSON.stringify({ appUrl, hoCount, captures }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
