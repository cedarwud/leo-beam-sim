#!/usr/bin/env node
// QUARANTINED 2026-09-07 — the only entry step this gate has is clicking a
// LaneExperienceBar segment that the public homepage no longer mounts. The contract it
// actually protects -- the Advanced drawer is non-modal, draws no scrim, and leaves the
// timeline operable -- has NOT been repealed: the drawer still mounts conditionally on the
// MODQN lane and governance still requires this npm key to exist. Entry parked, protection
// still live, so this is a quarantine and not a retirement. Fix the entry step once a
// supported public entry returns; do not bypass the public interaction by setting React
// state directly.
// Frontend — Advanced setup drawer MODALITY behavior gate (MODQN lane).
//
// History: the MODQN Advanced drawer used to be a left-anchored MODAL with a
// fixed full-viewport scrim (.leo-advanced-setup-overlay) that dimmed the whole
// screen and topped every HUD layer. The user found the screen-graying
// unnecessary for the showcase (the advanced tools are degenerate-data power
// tools, rarely touched live), so the MODQN drawer was flipped to a NON-MODAL
// inline disclosure: it expands in-flow at the foot of the left aside, NO scrim,
// the scene + timeline stay live while it is open.
//
// This gate BEHAVIOR-locks the non-modal intent (so a refactor can't silently
// re-introduce the scrim / click-block). Asserts, on a real browser against
// APP_URL (default :3001), MODQN lane, with the drawer OPEN:
//   1. NO .leo-advanced-setup-overlay scrim exists in the DOM (no screen dim).
//   2. elementFromPoint over the timeline transport resolves INTO the timeline
//      bar — the open drawer does NOT cover it, so the timeline stays clickable.
//   3. Non-vacuous: the drawer is genuinely open + rendered (testid present with
//      a real bounding box) while 1 and 2 hold.
//
// STAGE env var only changes the screenshot filename (before/after evidence
// loops); assertions are identical in every stage.
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const APP_URL = process.env.APP_URL ?? 'http://localhost:3001';
const STAGE = process.env.STAGE ?? 'check';
const OUT_DIR = join('output', 'frontend-consolidation');
const SHELL = '.leo-app-shell';

function fail(message: string): never {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(SHELL, { timeout: 30_000 });

    // Switch to the MODQN segment (drawer trigger is gated off sinr-live).
    await page.click('[data-testid="lane-experience-modqn-live-cell-preview"]');
    await page.waitForSelector(`${SHELL}[data-scene-lane="modqn-live-cell-preview"]`, { timeout: 30_000 });
    await page.waitForSelector('[data-testid="advanced-setup-trigger"]', { timeout: 30_000 });
    await page.waitForSelector('[data-testid="timeline-bar"]', { timeout: 30_000 });

    await page.click('[data-testid="advanced-setup-trigger"]');
    await page.waitForSelector('[data-testid="advanced-setup-drawer"]', { timeout: 10_000 });

    await page.screenshot({ path: join(OUT_DIR, `advanced-drawer-modality-${STAGE}.png`), fullPage: true });

    // 1. No screen dim: the modal scrim must not exist while the drawer is open.
    const scrimCount = await page.locator('.leo-advanced-setup-overlay').count();
    if (scrimCount !== 0) {
      fail(`drawer open but ${scrimCount} .leo-advanced-setup-overlay scrim present — screen-graying modal re-introduced`);
    }

    // 2. Timeline stays interactive: probe the play toggle's own centre, which is
    //    guaranteed to live inside the timeline bar, and confirm nothing (no
    //    scrim, no inline drawer body) covers it.
    const toggleBox = await page.locator('[data-testid="timeline-toggle-play"]').boundingBox();
    if (!toggleBox) fail('missing timeline play-toggle bounding box');
    const probeX = toggleBox.x + toggleBox.width / 2;
    const probeY = toggleBox.y + toggleBox.height / 2;
    const hit = await page.evaluate(([x, y]) => {
      const el = document.elementFromPoint(x as number, y as number);
      if (!el) return 'nothing';
      if (el.closest('[data-testid="advanced-setup-drawer"]')) return 'drawer';
      if (el.closest('.leo-advanced-setup-overlay')) return 'overlay';
      if (el.closest('[data-testid="timeline-bar"]')) return 'timeline';
      return `other:${el.tagName}.${(el as HTMLElement).className}`;
    }, [probeX, probeY]);
    if (hit !== 'timeline') {
      fail(`drawer open but elementFromPoint over the play toggle hits "${hit}" — open drawer covers the timeline`);
    }

    // 3. Non-vacuous: the drawer really is open + rendered with a real box.
    const drawerBox = await page.locator('[data-testid="advanced-setup-drawer"]').boundingBox();
    if (!drawerBox || drawerBox.width <= 0 || drawerBox.height <= 0) {
      fail('advanced-setup-drawer has no visible bounding box — gate measured nothing');
    }

    console.log(`PASS advanced-drawer-modality (non-modal inline) stage=${STAGE} probe=(${Math.round(probeX)},${Math.round(probeY)})`);
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
