#!/usr/bin/env node
/**
 * shot-flow.ts — screenshot a teaching surface AFTER walking its opening flow.
 *
 * The six-acts routes gate the stage behind an interaction (Act 1's guess, and
 * later the story director's beats), so `scripts/shot.ts` finds an invisible
 * canvas and gives up. This clicks through first, which also means the capture
 * exercises the real flow instead of a state a student never sees.
 *
 *   node --import tsx/esm scripts/shot-flow.ts <label> --url <url> \
 *     --click "text=約 10,000 顆" --click "text=進入星座畫面" [--wait 4000]
 *
 * Tolerant like shot.ts: no vite, no browser -> warn and exit 0.
 */
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const OUT = join('output', 'shot');

function optionValues(name: string): string[] {
  const values: string[] = [];
  process.argv.forEach((argument, index) => {
    if (argument === name && process.argv[index + 1] !== undefined) values.push(process.argv[index + 1]!);
  });
  return values;
}

async function main(): Promise<void> {
  const label = process.argv[2] ?? 'flow';
  const url = optionValues('--url')[0] ?? 'http://localhost:3000/';
  const clicks = optionValues('--click');
  const waitMs = Number(optionValues('--wait')[0] ?? 6000);
  await mkdir(OUT, { recursive: true });

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
  } catch {
    process.stdout.write(`[shot-flow] ${url} is not reachable — skipping (run npm run dev)\n`);
    return;
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1680, height: 1050 } });
  const consoleErrors: string[] = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15_000 }).catch(() => {});
  for (const selector of clicks) {
    try {
      await page.locator(selector).first().click({ timeout: 10_000 });
      await page.waitForTimeout(400);
    } catch {
      process.stdout.write(`[shot-flow] step not found, continuing: ${selector}\n`);
    }
  }
  await page.waitForTimeout(waitMs);

  const full = join(OUT, `${label}-full.png`);
  await page.screenshot({ path: full, fullPage: false });
  await browser.close();
  process.stdout.write(`[shot-flow] captured ${full} · steps=${clicks.length} · consoleErrors=${consoleErrors.length}\n`);
  for (const error of consoleErrors.slice(0, 5)) process.stdout.write(`  console: ${error}\n`);
}

void main().catch((error: unknown) => {
  process.stdout.write(`[shot-flow] skipped: ${error instanceof Error ? error.message : String(error)}\n`);
});
