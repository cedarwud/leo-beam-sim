/**
 * Beam VISUAL invariants — the end-to-end "done == looks right" gate.
 *
 * WHY THIS EXISTS (sinr-live-render-consolidation-sdd.md §4, the keystone): every
 * other beam gate asserts MODEL facts (servingBeams == servedCellCount) while NO
 * gate guarded what the USER sees. A 25-frame live poll found `served-cell-count >
 * rendered-cone-count` in 4/25 frames — a UE coloured "connected" with no cone —
 * UNDER all-green gates (Bug A). This gate closes that gap: it asserts the VISUAL
 * invariant over many live frames, so an agent's "done" can no longer be green
 * while the viewport is broken.
 *
 * INVARIANT (coverage): every served earth-fixed cell has a rendered serving cone
 *   → `data-sinr-live-cell-beam-cone-count >= data-sinr-live-cell-served-count`
 *   on EVERY sampled frame (a served UE always sits under a drawn beam).
 *
 * This is a CONTRACT/behaviour assertion, not a source-text pin (SDD §5).
 *
 * Requires a running dev server. Run: `npm run validate:beam:visual-invariants:browser`.
 * DATA SOURCE: live-engine (in-browser live SINR cell simulation).
 */
import assert from 'node:assert/strict';
import { chromium, type Browser, type Page } from '@playwright/test';
import { detectAppUrl } from './_vc2-browser-fixture.ts';

const SHELL = '.leo-app-shell';
const CANVAS = 'canvas[data-camera-position]';
const FRAMES = 30;
const FRAME_GAP_MS = 700;

async function numAttr(page: Page, name: string): Promise<number> {
  const v = await page.getAttribute(CANVAS, name);
  return v === null || v === '' ? NaN : Number(v);
}

async function main(): Promise<void> {
  const appUrl = process.env.APP_URL ?? process.argv[2] ?? (await detectAppUrl());
  const browser: Browser = await chromium.launch();
  try {
    const page: Page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${appUrl}/?sceneSource=live-sim&appMode=sinr-experiment`, { waitUntil: 'domcontentloaded' });
    assert.equal(await page.getAttribute(SHELL, 'data-scene-lane'), 'sinr-live', 'lane resolves to sinr-live');
    await page.waitForSelector(CANVAS, { timeout: 20000, state: 'attached' });

    // Toggle the "Other beams" checkbox on to make sure all serving cones render.
    const checkboxSelector = 'input[data-testid="non-serving-cones-toggle"]';
    await page.waitForSelector(checkboxSelector, { state: 'visible' });
    await page.click(checkboxSelector);

    // Wait for the rich render to come up before sampling.
    for (let i = 0; i < 40; i += 1) {
      if ((await numAttr(page, 'data-beam-cone-count')) > 0) break;
      await page.waitForTimeout(300);
    }

    const violations: string[] = [];
    let worstGap = -Infinity;
    let sampled = 0;
    for (let i = 0; i < FRAMES; i += 1) {
      // ATOMIC read: served + cones from the SAME dataset snapshot in one JS tick,
      // so a frame commit between two getAttribute calls can never fabricate a gap
      // (the read-race lesson — project_browser_gate_drift).
      const snap = await page.evaluate((sel) => {
        const el = document.querySelector(sel) as HTMLElement | null;
        if (!el) return null;
        const sv = el.dataset.sinrLiveCellServedCount;
        const cv = el.dataset.sinrLiveCellBeamConeCount;
        const tv = el.dataset.simTimeSec;
        return {
          served: sv === undefined || sv === '' ? NaN : Number(sv),
          cones: cv === undefined || cv === '' ? NaN : Number(cv),
          t: tv === undefined || tv === '' ? NaN : Number(tv),
        };
      }, CANVAS);
      const served = snap?.served ?? NaN;
      const cones = snap?.cones ?? NaN;
      const t = snap?.t ?? NaN;
      if (Number.isFinite(served) && Number.isFinite(cones)) {
        sampled += 1;
        const gap = served - cones; // > 0 ⇒ a served cell with NO rendered serving cone
        worstGap = Math.max(worstGap, gap);
        if (gap > 0) {
          violations.push(`t=${t.toFixed(1)}s served=${served} cones=${cones} (gap=${gap})`);
        }
      }
      await page.waitForTimeout(FRAME_GAP_MS);
    }

    assert.ok(sampled >= FRAMES / 2, `sampled enough live frames (${sampled}/${FRAMES})`);
    console.log(`[beam-visual-invariants] sampled ${sampled} frames, worst served-minus-cones gap = ${worstGap}`);
    assert.deepEqual(
      violations,
      [],
      `COVERAGE INVARIANT VIOLATED — served cells with no rendered serving cone (every served UE must sit under a drawn beam):\n  ${violations.join('\n  ')}`,
    );
    console.log('[beam-visual-invariants] PASS — every served cell had a rendered serving cone on every sampled frame');
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('[beam-visual-invariants] FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
