/**
 * Phase C durable browser gate: the HANDOVER CINEMA (S1) works on the LIVE WALKER
 * sinr-live lane — arming a handover focus drops to 0.25x slow-mo, moves the
 * camera to the sat-pair, lights up the candidate beams (a real mesh layer), and
 * floats the SINR explainer; exiting restores everything.
 *
 * DATA SOURCE: live-engine — the in-browser live SINR Walker simulation
 * (`?sceneSource=live-sim&appMode=sinr-experiment`). The dense default Walker
 * constellation produces real inter-satellite handovers indexed into the
 * validated `liveWalkerHandoverEventIndex`. This is NOT producer MODQN truth: the
 * cinema is honestly labeled `profile-derived-forecast` (focus) and the explainer
 * carries `claim-kind="sinr-offset"` (asserted). No producer artifact required.
 *
 * Asserts (hard), all on `sinr-live`:
 *  - inter-HO focus becomes enabled (the live forecast produces inter handovers);
 *  - arming it floats the SINR explainer with `data-claim-kind="sinr-offset"`, two
 *    candidate rows (one winner-selected), and a finite live winner SINR;
 *  - the director FSM leaves idle, speed drops to the 0.25x tier, and the camera
 *    world position moves;
 *  - the candidate-beam highlight MESH layer renders (mesh-derived canvas dataset
 *    `data-candidate-handover-highlight-rendered-count` > 0) — proving the rings
 *    actually drew, not just that a prop was set;
 *  - Exit restores the FSM to idle + speed to normal AND tears the cinema down:
 *    the explainer is gone and the highlight count flag is cleared.
 *
 * Requires a running dev server (`npm run dev`); pass APP_URL or argv[2] to
 * override. Run: `npm run validate:phase-c:handover-cinema:browser`.
 */
import assert from 'node:assert/strict';
import { chromium, type Browser, type Page } from '@playwright/test';
import { detectAppUrl } from './_vc2-browser-fixture.ts';

const SHELL = '.leo-app-shell';
const CANVAS = 'canvas[data-camera-position]';
const DIRECTOR = '[data-testid="director-controls"]';
const INTER_BTN = '[data-testid="director-inter-focus"]';
const EXIT_BTN = '[data-testid="director-exit-focus"]';
const EXPLAINER = '[data-testid="handover-cinema-sinr-explainer"]';
const CANDIDATE_ROW = '[data-testid="sinr-candidate-row"]';
const HIGHLIGHT_COUNT_ATTR = 'data-candidate-handover-highlight-rendered-count';
const CINEMATIC_SPEED = 0.25;

async function attr(page: Page, selector: string, name: string): Promise<string | null> {
  return page.getAttribute(selector, name);
}

async function main(): Promise<void> {
  const appUrl = process.env.APP_URL ?? process.argv[2] ?? (await detectAppUrl());
  const browser: Browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', e => consoleErrors.push(`PAGEERROR ${e.message}`));

    await page.goto(`${appUrl}/?sceneSource=live-sim&appMode=sinr-experiment`, { waitUntil: 'domcontentloaded' });

    // Live SINR Walker lane + canvas + director controls.
    assert.equal(await attr(page, SHELL, 'data-scene-lane'), 'sinr-live', 'lane resolves to sinr-live');
    await page.waitForSelector(CANVAS, { timeout: 20000 });
    assert.equal(await page.locator(DIRECTOR).count(), 1, 'director controls mount on the live lane');

    // Honesty: the live focus claim is profile-derived-forecast (not producer proof).
    assert.equal(
      await attr(page, SHELL, 'data-live-director-focus-claim'),
      'profile-derived-forecast',
      'live focus is honestly labeled profile-derived-forecast',
    );
    console.log('[handover-cinema] DATA SOURCE = live Walker forecast (profile-derived-forecast)');

    // The inter-HO focus enables once the live Walker index builds (dense default
    // constellation produces inter handovers). Poll generously (headless is slow).
    await page.waitForFunction(
      () => document.querySelector('[data-testid="director-controls"]')?.getAttribute('data-director-inter-enabled') === '1',
      undefined,
      { timeout: 60000, polling: 250 },
    );
    assert.equal(await attr(page, SHELL, 'data-director-phase'), 'idle', 'director starts idle');

    // No cinema before arming: the explainer is absent.
    assert.equal(await page.locator(EXPLAINER).count(), 0, 'SINR explainer absent before arming');

    const cameraBefore = await attr(page, CANVAS, 'data-camera-position');
    const speedBefore = Number(await attr(page, SHELL, 'data-effective-speed'));
    assert.ok(speedBefore > CINEMATIC_SPEED, `normal speed before arming (${speedBefore})`);

    // ── Arm the inter-HO cinema ──
    await page.click(INTER_BTN);

    // 1) The SINR explainer floats with the lane-truthful claim.
    await page.waitForSelector(EXPLAINER, { timeout: 12000 });
    assert.equal(await attr(page, EXPLAINER, 'data-claim-kind'), 'sinr-offset',
      'SINR explainer carries claim-kind="sinr-offset" (lane-truthful, not MODQN/producer)');
    assert.equal(await attr(page, EXPLAINER, 'data-focus-kind'), 'inter', 'explainer focus kind = inter');

    // Two candidate rows (serving + winner), exactly one selected, with a finite
    // live winner SINR + live provenance.
    const rowCount = await page.locator(CANDIDATE_ROW).count();
    assert.equal(rowCount, 2, `explainer shows the two candidate beams (got ${rowCount})`);
    const selectedCount = await page.locator(`${CANDIDATE_ROW}[data-is-selected="true"]`).count();
    assert.equal(selectedCount, 1, 'exactly one candidate row is the selected winner');
    const winner = page.locator(`${CANDIDATE_ROW}[data-is-selected="true"]`).first();
    assert.equal(await winner.getAttribute('data-provenance-plane'), 'live', 'winner row is live-provenance');
    const winnerSinr = Number(await winner.getAttribute('data-sinr-db'));
    assert.ok(Number.isFinite(winnerSinr), `winner row carries a finite live SINR (got "${winnerSinr}")`);
    console.log(`[handover-cinema] explainer armed: winner SINR=${winnerSinr} dB, claim=sinr-offset`);

    // 2) FSM leaves idle.
    await page.waitForFunction(
      () => document.querySelector('.leo-app-shell')?.getAttribute('data-director-phase') !== 'idle',
      undefined,
      { timeout: 15000, polling: 100 },
    );
    const phaseDuring = await attr(page, SHELL, 'data-director-phase');
    assert.ok(['acquiring', 'focused', 'restoring'].includes(phaseDuring ?? ''), `director FSM active (${phaseDuring})`);

    // 3) Speed drops to the 0.25x cinematic tier.
    await page.waitForFunction(
      () => Number(document.querySelector('.leo-app-shell')?.getAttribute('data-effective-speed')) <= 0.25,
      undefined,
      { timeout: 12000, polling: 250 },
    );
    const speedDuring = Number(await attr(page, SHELL, 'data-effective-speed'));
    assert.ok(speedDuring <= CINEMATIC_SPEED, `speed dropped to cinematic tier (${speedDuring})`);

    // 4) The candidate-beam highlight MESH layer renders (mesh-derived telemetry).
    await page.waitForFunction(
      (canvasSel: string) => {
        const v = document.querySelector(canvasSel)?.getAttribute('data-candidate-handover-highlight-rendered-count');
        return v !== null && Number(v) > 0;
      },
      CANVAS,
      { timeout: 15000, polling: 250 },
    );
    const highlightCount = Number(await attr(page, CANVAS, HIGHLIGHT_COUNT_ATTR));
    assert.ok(highlightCount > 0, `candidate-beam highlight rendered ${highlightCount} ring mesh(es)`);
    assert.ok(highlightCount <= 2, `candidate highlight is the two-beam set, not a flood (got ${highlightCount})`);

    // 5) Camera world position actually moves (sat-pair focus tween).
    await page.waitForFunction(
      (before: string | null) =>
        document.querySelector('canvas[data-camera-position]')?.getAttribute('data-camera-position') !== before,
      cameraBefore,
      { timeout: 15000 },
    );
    const cameraDuring = await attr(page, CANVAS, 'data-camera-position');
    assert.notEqual(cameraDuring, cameraBefore, 'camera pose moved on focus');
    console.log(`[handover-cinema] during: phase=${phaseDuring} speed=${speedDuring} highlight=${highlightCount} camera moved`);

    // 6) CQ1: during the focused HOLD the camera keeps moving (continuous orbit),
    //    NOT a static freeze. Wait for the hold to settle, snapshot the pose, then
    //    prove it changes again WHILE still focused — the old behaviour held a single
    //    static pose, so this distinguishes the orbit from a frozen zoom.
    await page.waitForFunction(
      () => document.querySelector('.leo-app-shell')?.getAttribute('data-director-phase') === 'focused',
      undefined,
      { timeout: 14000, polling: 100 },
    );
    const holdPos = await attr(page, CANVAS, 'data-camera-position');
    await page.waitForFunction(
      (prev: string | null) => {
        const shell = document.querySelector('.leo-app-shell');
        if (shell?.getAttribute('data-director-phase') !== 'focused') return false;
        const v = document.querySelector('canvas[data-camera-position]')?.getAttribute('data-camera-position');
        return v !== null && v !== prev;
      },
      holdPos,
      { timeout: 8000, polling: 100 },
    );
    const holdPosLater = await attr(page, CANVAS, 'data-camera-position');
    assert.notEqual(holdPosLater, holdPos, 'camera continues to orbit during the focused hold (CQ1, not a static freeze)');
    console.log(`[handover-cinema] CQ1 orbit: camera moved during the focused hold (${holdPos} -> ${holdPosLater})`);

    // ── Exit restores + tears the cinema down ──
    await page.click(EXIT_BTN);
    await page.waitForFunction(
      () => document.querySelector('.leo-app-shell')?.getAttribute('data-director-phase') === 'idle',
      undefined,
      { timeout: 12000 },
    );
    await page.waitForFunction(
      () => Number(document.querySelector('.leo-app-shell')?.getAttribute('data-effective-speed')) > 0.25,
      undefined,
      { timeout: 12000 },
    );
    // The explainer is gone and the highlight count flag is cleared / zero.
    await page.waitForFunction(
      () => document.querySelector('[data-testid="handover-cinema-sinr-explainer"]') === null,
      undefined,
      { timeout: 8000, polling: 100 },
    );
    await page.waitForFunction(
      (canvasSel: string) => {
        const v = document.querySelector(canvasSel)?.getAttribute('data-candidate-handover-highlight-rendered-count');
        return v === null || Number(v) === 0;
      },
      CANVAS,
      { timeout: 8000, polling: 250 },
    );
    const phaseAfter = await attr(page, SHELL, 'data-director-phase');
    assert.equal(phaseAfter, 'idle', 'director restored to idle after exit');
    assert.equal(await page.locator(EXPLAINER).count(), 0, 'SINR explainer torn down after exit');
    console.log(`[handover-cinema] after exit: phase=${phaseAfter}, explainer gone, highlight cleared`);

    // No artifact-lane leak onto the live lane.
    assert.equal(await page.locator('[data-testid="artifact-satellite-compass"]').count(), 0, 'artifact compass must not leak onto the live lane');
    assert.equal(await page.locator('[data-testid="artifact-source-badge"]').count(), 0, 'artifact source badge must not leak onto the live lane');

    const realErrors = consoleErrors.filter(e => !/ERR_CONNECTION_REFUSED|:8765|favicon/.test(e));
    assert.deepEqual(realErrors, [], `no real console errors: ${JSON.stringify(realErrors)}`);

    console.log('[handover-cinema] PASS — armed SINR explainer (claim=sinr-offset) + candidate-beam highlight mesh + 0.25x + camera move on sinr-live; exit restored and tore down (DATA SOURCE = live Walker forecast)');
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('[handover-cinema] FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
