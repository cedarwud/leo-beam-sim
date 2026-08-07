#!/usr/bin/env node

import assert from 'node:assert/strict';
import { chromium, type Browser, type Page } from '@playwright/test';
import { detectAppUrl } from './_vc2-browser-fixture.ts';

const SHELL = '.leo-app-shell';
const TIMELINE = '[data-testid="timeline-bar"]';
const TRANSPORT = `${TIMELINE} [aria-label="Timeline transport controls"]`;
const LATEST_SOURCE_TIME_SEC = 7200;

async function attr(page: Page, selector: string, name: string): Promise<string | null> {
  return page.getAttribute(selector, name);
}

async function main(): Promise<void> {
  const appUrl = process.env.APP_URL ?? process.argv[2] ?? (await detectAppUrl());
  const browser: Browser = await chromium.launch();

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${appUrl}/?sceneSource=live-sim&appMode=sinr-experiment`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await page.waitForSelector(TIMELINE, { timeout: 60_000, state: 'attached' });
    await page.waitForFunction(
      selector => document.querySelector(selector)?.getAttribute('data-disabled') === 'false',
      TIMELINE,
      { timeout: 60_000, polling: 250 },
    );

    const transportButtonIds = await page.locator(`${TRANSPORT} button`).evaluateAll(buttons => (
      buttons.map(button => button.getAttribute('data-testid'))
    ));
    assert.deepEqual(
      transportButtonIds.at(-1),
      'timeline-jump-end',
      'jump-to-latest is the rightmost transport button',
    );

    if (await attr(page, TIMELINE, 'data-paused') !== 'true') {
      await page.click('[data-testid="timeline-toggle-play"]');
      await page.waitForFunction(
        selector => document.querySelector(selector)?.getAttribute('data-paused') === 'true',
        TIMELINE,
        { timeout: 10_000, polling: 100 },
      );
    }

    await page.click('[data-testid="timeline-jump-end"]');
    await page.waitForFunction(
      ({ selector, expected }) => document.querySelector(selector)?.getAttribute('data-live-timeline-seek-target') === expected,
      { selector: SHELL, expected: LATEST_SOURCE_TIME_SEC.toFixed(3) },
      { timeout: 10_000, polling: 100 },
    );
    await page.waitForFunction(
      selector => Number(document.querySelector(selector)?.getAttribute('data-current-time-sec') ?? '0') > 1,
      TIMELINE,
      { timeout: 10_000, polling: 100 },
    );

    const snapshot = await page.evaluate(({ shellSelector, timelineSelector }) => {
      const shell = document.querySelector(shellSelector);
      const timeline = document.querySelector(timelineSelector);
      return {
        seekTarget: shell?.getAttribute('data-live-timeline-seek-target'),
        currentTime: timeline?.getAttribute('data-current-time-sec'),
        duration: timeline?.getAttribute('data-duration-sec'),
        progress: timeline?.getAttribute('data-progress-pct'),
      };
    }, { shellSelector: SHELL, timelineSelector: TIMELINE });
    const currentTimeSec = Number(snapshot.currentTime);
    const durationSec = Number(snapshot.duration);
    assert.equal(
      snapshot.seekTarget,
      LATEST_SOURCE_TIME_SEC.toFixed(3),
      'jump-to-latest requests the latest source time, not the timeline start or an overrun',
    );
    assert.ok(
      currentTimeSec > 1 && currentTimeSec >= durationSec * 0.9,
      `jump-to-latest lands near the timeline tail (current=${snapshot.currentTime}, duration=${snapshot.duration}, progress=${snapshot.progress})`,
    );
    console.log(`PASS: jump-to-latest landed at source=${snapshot.seekTarget}, timeline=${snapshot.currentTime}/${snapshot.duration}`);
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
