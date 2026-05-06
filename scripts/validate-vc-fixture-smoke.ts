import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chromium, type Browser } from '@playwright/test';
import { bootDeterministicPage } from './_v3-deterministic-fixture.ts';

const DEFAULT_SEED = 1337;
const DEFAULT_RAF_MS = 1000;
const DEFAULT_VIEWPORT = { width: 800, height: 600 };

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

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

async function captureHash(browser: Browser, url: string): Promise<string> {
  const page = await bootDeterministicPage({ chromium }, {
    url,
    browser,
    seed: DEFAULT_SEED,
    rafMs: DEFAULT_RAF_MS,
    viewport: DEFAULT_VIEWPORT,
  });

  try {
    await page.evaluate(() => document.fonts?.ready);
    await page.waitForTimeout(500);
    const screenshot = await page.screenshot();
    return sha256(screenshot);
  } finally {
    await page.context().close();
  }
}

async function main(): Promise<void> {
  const appUrl = await detectAppUrl();
  const browser = await chromium.launch();
  let firstHash: string;
  let secondHash: string;

  try {
    firstHash = await captureHash(browser, appUrl);
    secondHash = await captureHash(browser, appUrl);
  } finally {
    await browser.close();
  }

  assert.equal(
    secondHash,
    firstHash,
    `Deterministic fixture hashes differ for viewport ${DEFAULT_VIEWPORT.width}x${DEFAULT_VIEWPORT.height}, seed ${DEFAULT_SEED}: ${firstHash} !== ${secondHash}`,
  );

  console.log(JSON.stringify({
    appUrl,
    viewport: DEFAULT_VIEWPORT,
    seed: DEFAULT_SEED,
    rafMs: DEFAULT_RAF_MS,
    hash: firstHash,
    result: 'PASS',
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
