/**
 * Phase C durable browser gate (C5): the always-on CUMULATIVE handover ticker tracks
 * the live handover stream — it RISES monotonically as handovers fire and is never
 * stuck while the pulse renders. The regression guard for the throttle-drop bug
 * (project_sinr_render_consolidation_plan): the ticker formerly read the throttled
 * sim-time `recentHandoverEvents` WINDOW, which empties between the UI publisher's
 * ~700ms ticks at 20x, so it read 0 while the unthrottled pulse rendered cones. C5
 * publishes a monotonic cumulative total instead; this gate proves the HUD now moves.
 *
 * INVARIANTS (read live at 20x — a cumulative total is monotonic, so no pause /
 * atomic-pair is needed; sampling lag cannot break monotonicity or the rise):
 *  A. MONOTONIC: `data-ho-total` never decreases across the sampled window.
 *  B. RISES WITH THE STREAM: the total strictly increases over the window while the
 *     pulse renders handover cones — the HUD honestly reflects "一直有換手", not the
 *     throttled 0.
 *  C. THE PULSE FIRED: the mesh-derived pulse rendered-count went > 0 during the
 *     window (handovers actually happened — the rise is real, not vacuous).
 *
 * Warm-up: the first post-guard handover is ~42s of sim-time out (pingPongGuardSec 30
 * + TTT 3.5); crank 20x so it elapses in a few seconds of wall time. The cumulative
 * epoch legitimately reads 0 before that first HO, so warm up until total>0 AND a
 * pulse cone has rendered before sampling.
 *
 * Requires a running dev server. Run: `npm run validate:phase-c:handover-ticker:render:browser`.
 * DATA SOURCE: live-engine (in-browser live SINR cell simulation).
 */
import assert from 'node:assert/strict';
import { chromium, type Browser, type Page } from '@playwright/test';
import { detectAppUrl } from './_vc2-browser-fixture.ts';

const SHELL = '.leo-app-shell';
const CANVAS = 'canvas[data-camera-position]';
const TICKER = '[data-testid="sinr-handover-ticker"]';

interface Snap {
  total: number;
  pulse: number;
}

async function readSnap(page: Page): Promise<Snap> {
  return page.evaluate(({ canvasSel, tickerSel }) => {
    const t = document.querySelector(tickerSel);
    const c = document.querySelector(canvasSel);
    const totalRaw = Number(t?.getAttribute('data-ho-total') ?? 'NaN');
    const renderedRaw = Number(c?.getAttribute('data-sinr-live-handover-pulse-cone-rendered-count') ?? 'NaN');
    const countRaw = Number(c?.getAttribute('data-sinr-live-handover-pulse-cone-count') ?? 'NaN');
    return {
      total: Number.isFinite(totalRaw) ? totalRaw : 0,
      pulse: Math.max(
        Number.isFinite(renderedRaw) ? renderedRaw : 0,
        Number.isFinite(countRaw) ? countRaw : 0,
      ),
    };
  }, { canvasSel: CANVAS, tickerSel: TICKER });
}

async function main(): Promise<void> {
  const appUrl = process.env.APP_URL ?? process.argv[2] ?? (await detectAppUrl());
  const browser: Browser = await chromium.launch();
  try {
    const page: Page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const consoleErrors: string[] = [];
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('pageerror', e => consoleErrors.push(`PAGEERROR ${e.message}`));

    await page.goto(`${appUrl}/?sceneSource=live-sim&appMode=sinr-experiment`, { waitUntil: 'domcontentloaded' });
    assert.equal(await page.getAttribute(SHELL, 'data-scene-lane'), 'sinr-live', 'lane resolves to sinr-live');
    assert.ok((await page.locator(TICKER).count()) > 0, 'the cumulative handover ticker is mounted on the sinr-live lane');
    await page.waitForSelector(CANVAS, { timeout: 20000, state: 'attached' });
    for (let i = 0; i < 40; i += 1) {
      const v = await page.getAttribute(CANVAS, 'data-sinr-live-cell-beam-cone-count');
      if (v && Number(v) > 0) break;
      await page.waitForTimeout(300);
    }
    const fast = page.locator('[data-testid="timeline-speed-20x"]').first();
    if (await fast.count()) await fast.click();

    // Warm up until the first handover is both RENDERED (pulse) AND COUNTED (total>0):
    // the cumulative epoch starts at 0 before the first post-guard HO.
    let warmed = false;
    for (let i = 0; i < 80 && !warmed; i += 1) {
      const s = await readSnap(page);
      if (s.total > 0 && s.pulse > 0) warmed = true;
      else await page.waitForTimeout(500);
    }
    assert.ok(warmed, 'a handover fired, rendered a pulse cone, and was counted into the cumulative total (warm-up)');

    // Sample the live stream: the cumulative total must be monotonic and strictly rise
    // while the pulse keeps firing.
    const totals: number[] = [];
    let everPulse = false;
    for (let i = 0; i < 24; i += 1) {
      const s = await readSnap(page);
      totals.push(s.total);
      if (s.pulse > 0) everPulse = true;
      await page.waitForTimeout(300);
    }
    const first = totals[0];
    const last = totals[totals.length - 1];
    const monotonic = totals.every((v, i) => i === 0 || v >= totals[i - 1]);

    // A — monotonic (a cumulative total never decrements).
    assert.ok(monotonic, `MONOTONIC — the cumulative handover total never decreases (series=[${totals.join(',')}])`);
    // C — the pulse fired during the window (handovers really happened, so the rise is real).
    assert.ok(everPulse, 'the ambient pulse rendered handover cones during the sampled window (the rise is not vacuous)');
    // B — the total strictly rose: the HUD tracks "一直有換手", never the throttle-dropped 0.
    assert.ok(
      last > first,
      `RISES — the cumulative total tracked the live handover stream (first=${first} last=${last}); a stuck / throttle-dropped ticker would not move`,
    );

    const realErrors = consoleErrors.filter(e => !/ERR_CONNECTION_REFUSED|:8765|favicon/.test(e));
    assert.deepEqual(realErrors, [], `no real console errors: ${JSON.stringify(realErrors)}`);
    console.log(
      `[handover-ticker-render] PASS — cumulative ticker monotonic + rose ${first}->${last} while the pulse fired; ` +
        `the "一直有換手" HUD tracks the live stream (no throttle drop)`,
    );
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('[handover-ticker-render] FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
