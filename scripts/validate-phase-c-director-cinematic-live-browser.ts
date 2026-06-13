/**
 * ITEM #C durable browser gate: the Director "cinematic" seek-to-next-handover +
 * satellite-pair framing + 0.25x slow-mo actually works on the LIVE WALKER lane
 * (the analog of validate-phase-c-director-cinematic-browser.ts, which covers the
 * artifact-replay lane).
 *
 * DATA SOURCE: live-engine — the in-browser live SINR simulation
 * (`?sceneSource=live-sim&appMode=sinr-experiment`). The dense default
 * constellation (hobs-2024-candidate-rich) genuinely produces inter-satellite
 * handovers. Since the cell-truth cinema migration (e7a08dc, 2026-06-10) the
 * sinr-live lane is backed by the earth-fixed cell-truth model (real live SINR
 * engine truth), so the live Director focus is honestly labeled `live-truth`
 * (asserted below) — this is still NOT producer MODQN proof. No producer artifact
 * required. (Pre-migration the claim was `profile-derived-forecast`; this gate was
 * synced to the shipped `live-truth` claim on 2026-06-13.)
 *
 * Asserts (hard): the live lane resolves to `sinr-live`; the inter-HO focus
 * becomes enabled (the live forecast produces inter handovers); clicking it
 * (1) seeks the live timeline to a real source-time handover event
 * (`data-live-timeline-seek-target` populates with a finite source second),
 * (2) leaves the director FSM idle, (3) drops the effective speed to the 0.25x
 * cinematic tier, (4) actually moves the camera world position (the sat-pair focus
 * tween); and Exit restores the FSM to idle with the speed back to normal. Honesty:
 * the live Director focus claim stays `live-truth` (real live SINR, not producer proof).
 *
 * Requires a running dev server (`npm run dev`); pass APP_URL or argv[2] to
 * override. Run: `npm run validate:phase-c:director-cinematic:live:browser`.
 */
import assert from 'node:assert/strict';
import { chromium, type Browser, type Page } from '@playwright/test';
import { detectAppUrl } from './_vc2-browser-fixture.ts';
import { CINEMATIC_LEAD_IN_SEC } from '../src/scene/cinematicReplayWindow.ts';

const SHELL = '.leo-app-shell';
const CANVAS = 'canvas[data-camera-position]';
const DIRECTOR = '[data-testid="director-controls"]';
const INTER_BTN = '[data-testid="director-inter-focus"]';
const EXIT_BTN = '[data-testid="director-exit-focus"]';
const FADE = '[data-testid="cinematic-seek-fade-overlay"]';
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

    // Live SINR Walker lane is selected and the canvas mounts.
    assert.equal(await attr(page, SHELL, 'data-scene-lane'), 'sinr-live', 'lane resolves to sinr-live');
    await page.waitForSelector(CANVAS, { timeout: 20000 });
    assert.equal(await page.locator(DIRECTOR).count(), 1, 'director controls mount on the live lane');

    // ── DATA SOURCE / honesty gate ──
    // The sinr-live Director focus is real live SINR cell-truth, NOT producer proof.
    assert.equal(
      await attr(page, SHELL, 'data-live-director-focus-claim'),
      'live-truth',
      'live Director focus is honestly labeled live-truth (real live SINR, not producer/MODQN proof)',
    );
    console.log('[director-cinematic-live] DATA SOURCE = live SINR cell-truth (live-truth)');

    // The live Walker handover index builds in an effect; wait for the inter-HO
    // focus to enable (the dense default constellation produces inter handovers).
    // Headless SwiftShader is slow, so poll generously — a never-enabled inter
    // button means the live forecast failed to produce an inter handover (FAIL).
    await page.waitForFunction(
      () => document.querySelector('[data-testid="director-controls"]')?.getAttribute('data-director-inter-enabled') === '1',
      undefined,
      { timeout: 60000, polling: 250 },
    );
    assert.equal(await attr(page, SHELL, 'data-director-phase'), 'idle', 'director starts idle');

    // Baselines before focus.
    const cameraBefore = await attr(page, CANVAS, 'data-camera-position');
    const speedBefore = Number(await attr(page, SHELL, 'data-effective-speed'));
    const seekBefore = await attr(page, SHELL, 'data-live-timeline-seek-target');
    assert.ok(speedBefore > CINEMATIC_SPEED, `normal speed before focus (${speedBefore})`);
    console.log(`[director-cinematic-live] before: phase=idle speed=${speedBefore} camera=${cameraBefore} seek="${seekBefore}"`);

    // ── Enter inter cinematic focus ──
    let fadeObserved = false;
    const fadeWatch = page
      .waitForFunction(
        () => {
          const p = document.querySelector('[data-testid="cinematic-seek-fade-overlay"]')?.getAttribute('data-fade-phase');
          return p === 'dimming' || p === 'clearing';
        },
        undefined,
        { timeout: 6000, polling: 16 },
      )
      .then(() => { fadeObserved = true; })
      .catch(() => {});

    await page.click(INTER_BTN);

    // 1) The live timeline seeks to a real source-time handover event. The seek
    //    target populates (was empty / different) with a finite source second.
    await page.waitForFunction(
      (before: string | null) => {
        const v = document.querySelector('.leo-app-shell')?.getAttribute('data-live-timeline-seek-target');
        return v !== null && v !== '' && v !== before && Number.isFinite(Number(v));
      },
      seekBefore,
      { timeout: 12000, polling: 50 },
    );
    const seekTarget = Number(await attr(page, SHELL, 'data-live-timeline-seek-target'));
    assert.ok(Number.isFinite(seekTarget) && seekTarget >= 0 && seekTarget <= 7200,
      `live timeline seeked to a source-time handover event (got ${seekTarget}s)`);

    // 1b) Bind the seek to a REAL indexed handover event, not just any in-range
    //     value: the resolved event's source-time is exposed as honesty telemetry,
    //     and the seek target must equal it minus the lead-in (clamped to >= 0).
    const eventSec = Number(await attr(page, SHELL, 'data-live-director-focus-event-sec'));
    assert.ok(Number.isFinite(eventSec) && eventSec >= 0 && eventSec <= 7200,
      `live Director resolved a real indexed event source-time (got ${eventSec}s)`);
    const expectedSeek = Math.max(0, eventSec - CINEMATIC_LEAD_IN_SEC);
    assert.ok(Math.abs(seekTarget - expectedSeek) < 0.01,
      `seek target ${seekTarget}s == real event ${eventSec}s minus ${CINEMATIC_LEAD_IN_SEC}s lead-in (expected ${expectedSeek}s) — proves seek-to-a-real-HO-event`);
    console.log(`[director-cinematic-live] seek bound to real event: eventSec=${eventSec}s → seek=${seekTarget}s (lead-in ${CINEMATIC_LEAD_IN_SEC}s)`);

    // 2) FSM leaves idle.
    await page.waitForFunction(
      () => document.querySelector('.leo-app-shell')?.getAttribute('data-director-phase') !== 'idle',
      undefined,
      { timeout: 12000 },
    );
    const phaseDuring = await attr(page, SHELL, 'data-director-phase');
    assert.ok(['acquiring', 'focused', 'restoring'].includes(phaseDuring ?? ''), `director FSM active (${phaseDuring})`);

    // 3) Speed drops to the 0.25x cinematic tier.
    await page.waitForFunction(
      () => Number(document.querySelector('.leo-app-shell')?.getAttribute('data-effective-speed')) <= 0.25,
      undefined,
      { timeout: 12000 },
    );
    const speedDuring = Number(await attr(page, SHELL, 'data-effective-speed'));
    assert.ok(speedDuring <= CINEMATIC_SPEED, `speed dropped to cinematic tier (${speedDuring})`);

    // 4) Camera world position actually changes (the sat-pair focus tween). Headless
    //    rAF is throttled so poll with a generous window.
    await page.waitForFunction(
      (before: string | null) =>
        document.querySelector('canvas[data-camera-position]')?.getAttribute('data-camera-position') !== before,
      cameraBefore,
      { timeout: 15000 },
    );
    const cameraDuring = await attr(page, CANVAS, 'data-camera-position');
    assert.notEqual(cameraDuring, cameraBefore, 'camera pose actually moved on focus');
    console.log(`[director-cinematic-live] during: phase=${phaseDuring} speed=${speedDuring} seek=${seekTarget}s camera=${cameraDuring} fadeObserved=${fadeObserved}`);

    await fadeWatch;
    if (!fadeObserved) {
      console.log(`[director-cinematic-live] WARN: dim-fade transition not caught (headless rAF throttle; ~300ms transient). Overlay present=${(await page.locator(FADE).count()) === 1}.`);
    } else {
      console.log(`[director-cinematic-live] dim-fade overlay observed transitioning`);
    }

    // ── Exit restores the FSM + speed ──
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
    const phaseAfter = await attr(page, SHELL, 'data-director-phase');
    const speedAfter = Number(await attr(page, SHELL, 'data-effective-speed'));
    assert.equal(phaseAfter, 'idle', 'director restored to idle after exit');
    assert.ok(speedAfter > CINEMATIC_SPEED, `speed restored after exit (${speedAfter})`);
    console.log(`[director-cinematic-live] after exit: phase=${phaseAfter} speed=${speedAfter}`);

    // No artifact-lane leak: the artifact compass + source badge stay off.
    assert.equal(await page.locator('[data-testid="artifact-satellite-compass"]').count(), 0, 'artifact compass must not leak onto the live lane');
    assert.equal(await page.locator('[data-testid="artifact-source-badge"]').count(), 0, 'artifact source badge must not leak onto the live lane');

    const realErrors = consoleErrors.filter(e => !/ERR_CONNECTION_REFUSED|:8765|favicon/.test(e));
    assert.deepEqual(realErrors, [], `no real console errors: ${JSON.stringify(realErrors)}`);

    console.log('[director-cinematic-live] PASS — live timeline seeked to a real HO event, camera moved to the sat-pair, speed dropped to 0.25x, FSM restored on exit (DATA SOURCE = live Walker forecast)');
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('[director-cinematic-live] FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
