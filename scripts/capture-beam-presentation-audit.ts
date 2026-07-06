#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, type Page } from '@playwright/test';

const APP_URL = process.env.APP_URL ?? 'http://localhost:3001';
const OUT_DIR = join('output', 'beam-presentation-audit', '2026-06-10');
const SHELL = '.leo-app-shell';
const SEG = (lane: string) => `[data-testid="lane-experience-${lane}"]`;
const MV = (lane: string) => `[data-testid="modqn-view-${lane}"]`;

interface Snapshot {
  readonly label: string;
  readonly shell: Record<string, string | undefined>;
  readonly canvas: Record<string, string | undefined>;
  readonly controls: Record<string, string | boolean | null>;
}

function assertLocalhost3001(url: string): void {
  const parsed = new URL(url);
  assert.equal(parsed.hostname, 'localhost', 'D7 before capture must use the existing localhost server');
  assert.equal(parsed.port, '3001', 'D7 before capture must use port 3001');
}

// DOMStringMap spreads type as string | undefined per key.
async function dataset(page: Page, selector: string): Promise<Record<string, string | undefined>> {
  return page.$eval(selector, element => ({ ...(element as HTMLElement).dataset }));
}

async function attr(page: Page, selector: string, name: string): Promise<string | null> {
  const locator = page.locator(selector).first();
  return (await locator.count()) === 0 ? null : locator.getAttribute(name);
}

async function exists(page: Page, selector: string): Promise<boolean> {
  return (await page.locator(selector).count()) > 0;
}

async function clickAndWaitLane(page: Page, selector: string, lane: string): Promise<void> {
  await page.click(selector);
  await page.waitForFunction(
    ([shell, expected]) => document.querySelector(shell)?.getAttribute('data-scene-lane') === expected,
    [SHELL, lane] as const,
    { timeout: 15_000 },
  );
}

async function collect(page: Page, label: string): Promise<Snapshot> {
  await page.waitForSelector('canvas', { timeout: 20_000 });
  await page.waitForTimeout(600);
  const shell = await dataset(page, SHELL);
  const canvas = await dataset(page, 'canvas');
  const controls = {
    beamDensityControl: await exists(page, '[data-testid="beam-density-control"]'),
    beamInfoToggle: await exists(page, '[data-testid="beam-info-toggle"]'),
    signalTuningPanel: await exists(page, '[data-testid="signal-tuning-panel"]'),
    modqnLayerPreset: await attr(page, '[data-testid="modqn-layer-preset-control"]', 'data-modqn-layer-preset'),
    replayCinemaStatus: await attr(page, '[data-testid="modqn-replay-cinema-readiness"]', 'data-replay-cinema-status'),
    replayCinemaSourceGaps: await attr(page, '[data-testid="modqn-replay-cinema-readiness"]', 'data-source-gap-fields'),
  };
  return { label, shell, canvas, controls };
}

async function openAdvanced(page: Page): Promise<void> {
  await page.waitForSelector('[data-testid="advanced-setup-trigger"]', { timeout: 15_000 });
  await page.click('[data-testid="advanced-setup-trigger"]');
  await page.waitForSelector('[data-testid="advanced-setup-drawer"]', { timeout: 15_000 });
}

async function openSignalTuningBeamTab(page: Page): Promise<void> {
  const signalTab = page.locator('#left-sidebar-tab-signal');
  if ((await signalTab.count()) > 0) {
    await signalTab.click();
  }
  if (await exists(page, '[data-testid="signal-tuning-drawer-handle"]')) {
    await page.click('[data-testid="signal-tuning-drawer-handle"]');
  }
  await page.waitForSelector('[data-testid="signal-tuning-drawer-content"]', { timeout: 15_000 });
  await page.waitForSelector('[role="tab"][id="sinr-formula-tab-beam"]', { timeout: 15_000 });
  await page.click('[role="tab"][id="sinr-formula-tab-beam"]');
  await page.waitForSelector('[data-testid="beam-gain-controls"]', { timeout: 15_000 });
}

async function main(): Promise<void> {
  assertLocalhost3001(APP_URL);
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const snapshots: Snapshot[] = [];

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(SHELL, { timeout: 20_000 });
    await page.waitForSelector('[data-testid="lane-experience-bar"]', { timeout: 15_000 });
    snapshots.push(await collect(page, 'sinr-live'));
    await page.screenshot({ path: join(OUT_DIR, 'sinr-live.png'), fullPage: true });

    await openSignalTuningBeamTab(page);
    snapshots.push(await collect(page, 'sinr-tuning-beam'));
    await page.screenshot({ path: join(OUT_DIR, 'sinr-tuning-beam.png'), fullPage: true });

    await clickAndWaitLane(page, SEG('modqn-live-cell-preview'), 'modqn-live-cell-preview');
    snapshots.push(await collect(page, 'modqn-live-cell-preview'));
    await page.screenshot({ path: join(OUT_DIR, 'modqn-live-cell-preview.png'), fullPage: true });

    await openAdvanced(page);
    snapshots.push(await collect(page, 'modqn-live-advanced'));
    await page.screenshot({ path: join(OUT_DIR, 'modqn-live-advanced.png'), fullPage: true });
    await page.keyboard.press('Escape');

    await clickAndWaitLane(page, MV('modqn-replay-proof'), 'modqn-replay-proof');
    snapshots.push(await collect(page, 'modqn-replay-proof'));
    await page.screenshot({ path: join(OUT_DIR, 'modqn-replay-proof.png'), fullPage: true });

    await clickAndWaitLane(page, MV('artifact-replay'), 'artifact-replay');
    snapshots.push(await collect(page, 'artifact-replay'));
    await page.screenshot({ path: join(OUT_DIR, 'artifact-replay.png'), fullPage: true });

    await writeFile(
      join(OUT_DIR, 'telemetry.json'),
      `${JSON.stringify({
        appUrl: APP_URL,
        capturedAt: new Date().toISOString(),
        snapshots,
      }, null, 2)}\n`,
      'utf8',
    );
  } finally {
    await browser.close();
  }

  console.log(`PASS: D7 beam presentation before capture written to ${OUT_DIR}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
