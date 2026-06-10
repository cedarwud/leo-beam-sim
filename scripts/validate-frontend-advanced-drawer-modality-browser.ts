#!/usr/bin/env node
// Frontend consolidation — Advanced setup drawer MODALITY behavior gate.
//
// Live bug this guards (audit 2026-06-10, docs/frontend-consolidation-program.md
// HUD row): the drawer scrim (.leo-advanced-setup-overlay, position:fixed) and
// the TimelineBar (.leo-timeline-bar, position:absolute) resolve in the SAME
// root stacking context, so if the scrim's z-index is below the timeline's the
// timeline stays clickable THROUGH the open modal. This is the second recurrence
// of the click-steal class (first: DiagnosticsDrawer chip over Director arm
// buttons, fixed in S1), so it gets a BEHAVIOR lock, not a string lock: the gate
// asserts hit-testing and click semantics, not CSS source text.
//
// Asserts, on a real browser against APP_URL (default :3001), MODQN lane:
//   1. With the drawer open, elementFromPoint over the timeline transport
//      resolves INTO the drawer overlay (modal actually covers the timeline).
//   2. Clicking that point closes the drawer (backdrop semantics) and does NOT
//      reach the timeline play/pause toggle underneath.
//   3. Sanity (non-vacuous): after the drawer closes, the same point hit-tests
//      to the timeline bar — proving step 1 measured a genuine overlap.
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

    // Pick a probe point that is inside the timeline bar but clear of the drawer
    // panel, so a click there is backdrop territory (scrim), never panel body.
    const timelineBox = await page.locator('[data-testid="timeline-bar"]').boundingBox();
    const panelBox = await page.locator('.leo-advanced-setup-panel').boundingBox();
    if (!timelineBox || !panelBox) fail('missing timeline or drawer panel bounding box');
    const probeX = Math.min(
      timelineBox.x + timelineBox.width - 40,
      Math.max(panelBox.x + panelBox.width + 40, timelineBox.x + 40),
    );
    const probeY = timelineBox.y + timelineBox.height / 2;
    if (probeX <= panelBox.x + panelBox.width || probeX >= timelineBox.x + timelineBox.width) {
      fail(`probe point x=${probeX} not in (panel right, timeline right) — layout assumption broke`);
    }

    await page.screenshot({ path: join(OUT_DIR, `advanced-drawer-modality-${STAGE}.png`), fullPage: true });

    // 1. Hit test: the open modal must own the pixel above the timeline.
    const hit = await page.evaluate(([x, y]) => {
      const el = document.elementFromPoint(x as number, y as number);
      if (!el) return 'nothing';
      if (el.closest('[data-testid="advanced-setup-drawer"]')) return 'overlay';
      if (el.closest('[data-testid="timeline-bar"]')) return 'timeline';
      return `other:${el.tagName}.${(el as HTMLElement).className}`;
    }, [probeX, probeY]);
    if (hit !== 'overlay') {
      fail(`drawer open but elementFromPoint over timeline hits "${hit}" — timeline clickable through modal`);
    }

    // 2. Click semantics: backdrop click closes the drawer, play toggle untouched.
    const playLabelBefore = await page.getAttribute('[data-testid="timeline-toggle-play"]', 'aria-label');
    await page.mouse.click(probeX, probeY);
    const drawerStillOpen = await page.locator('[data-testid="advanced-setup-drawer"]').count();
    if (drawerStillOpen !== 0) fail('click over timeline did not close the drawer (backdrop semantics broken)');
    const playLabelAfter = await page.getAttribute('[data-testid="timeline-toggle-play"]', 'aria-label');
    if (playLabelBefore !== playLabelAfter) {
      fail(`backdrop click leaked to the timeline: play toggle "${playLabelBefore}" -> "${playLabelAfter}"`);
    }

    // 3. Non-vacuous: with the drawer closed, the same point belongs to the timeline.
    const hitClosed = await page.evaluate(([x, y]) => {
      const el = document.elementFromPoint(x as number, y as number);
      return el?.closest('[data-testid="timeline-bar"]') ? 'timeline' : 'other';
    }, [probeX, probeY]);
    if (hitClosed !== 'timeline') {
      fail('probe point does not hit the timeline even with the drawer closed — gate measured nothing');
    }

    console.log(`PASS advanced-drawer-modality stage=${STAGE} probe=(${Math.round(probeX)},${Math.round(probeY)})`);
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
