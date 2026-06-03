/**
 * Phase C durable browser validator: the Director cinematic actually works in a
 * real browser on the artifact-replay lane (closes audit 2026-06-03 B3 — the
 * Director / cinematic mini-phase previously had ZERO durable browser test;
 * every "real-browser probe PASS" in memory was ad-hoc manual).
 *
 * DATA SOURCE policy (render-truth campaign rule): this gate runs against
 * whatever the dev server actually serves and reads the FIX-1
 * `data-artifact-source` honesty attribute to decide. It asserts the cinematic
 * mechanics ONLY on the real `producer-pinned` artifact (the 89s baseline MODQN
 * replay carries 82 intra-HO events). If the dev server falls back to the
 * synthetic fixture / header-absent (the pinned producer artifact is not on
 * disk in this checkout), it logs a LOUD SKIP and exits 0 — a fresh checkout
 * without the regenerated artifact must not silently red-fail, but it also must
 * not pretend it verified the real cinematic. Regenerate via the FIX-2 recipe
 * in docs/showcase-render-truth-fix-backlog.md.
 *
 * Asserts (hard): on the real intra-focus click the director FSM leaves idle,
 * the effective playback speed drops to the 0.05x cinematic tier, the camera
 * world position ACTUALLY changes (the focus tween), and Exit restores the FSM
 * to idle with the speed back to normal. Soft: the seek dim-fade overlay is
 * observed transitioning (best-effort — it is a ~300ms transient that a
 * throttled headless rAF can miss).
 *
 * Requires a running dev server (`npm run dev`); pass APP_URL or argv[2] to
 * override. Run: `npm run validate:phase-c:director-cinematic:browser`.
 */
import assert from 'node:assert/strict';
import { chromium, type Browser, type Page } from '@playwright/test';
import { detectAppUrl } from './_vc2-browser-fixture.ts';

const SHELL = '.leo-app-shell';
const CANVAS = 'canvas[data-camera-position]';
const DIRECTOR = '[data-testid="director-controls"]';
const INTRA_BTN = '[data-testid="director-intra-focus"]';
const EXIT_BTN = '[data-testid="director-exit-focus"]';
const FADE = '[data-testid="cinematic-seek-fade-overlay"]';
const CINEMATIC_SPEED = 0.05;

async function attr(page: Page, selector: string, name: string): Promise<string | null> {
  return page.getAttribute(selector, name);
}

async function main(): Promise<void> {
  const appUrl = process.env.APP_URL ?? process.argv[2] ?? (await detectAppUrl());
  const browser: Browser = await chromium.launch();
  let skipped = false;
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`${appUrl}/?sceneSource=artifact-replay`, { waitUntil: 'domcontentloaded' });
    // Hard-require the artifact to load. A load failure (404 / error / never
    // reaching loaded=true) must FAIL the gate, not silently take the skip path
    // — otherwise the gate would pass exactly when artifact-replay is broken.
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="artifact-replay-sidebar"]')
          ?.getAttribute('data-artifact-loaded') === 'true',
      undefined,
      { timeout: 30000 },
    );

    // ── DATA SOURCE gate (FIX-1 honesty attribute) ──
    // The artifact loaded; only an EXPLICIT known non-producer source is a legit
    // durable skip. Anything unexpected (pending / absent) is a FAILURE, since
    // the lane is resolved once loaded=true.
    const KNOWN_NON_PRODUCER = ['synthetic-fixture-fallback', 'header-absent', 'external-artifact-path'];
    const source = await attr(page, SHELL, 'data-artifact-source');
    if (source !== 'producer-pinned') {
      if (source && KNOWN_NON_PRODUCER.includes(source)) {
        skipped = true;
        console.log(
          `[director-cinematic] SKIP — data-artifact-source="${source}", not the real ` +
            `producer artifact. The Director cinematic real-data gate needs the ` +
            `producer-pinned 89s artifact (82 intra-HO events). Regenerate via FIX-2 ` +
            `(docs/showcase-render-truth-fix-backlog.md), then re-run. Exiting 0 (durable skip).`,
        );
        return;
      }
      throw new Error(
        `unexpected data-artifact-source="${source ?? 'absent'}" after the artifact loaded — ` +
          `the gate cannot trust the lane state`,
      );
    }
    console.log(`[director-cinematic] DATA SOURCE = producer-pinned (real 89s baseline MODQN replay)`);

    // Content invariant (codex P2): producer-pinned alone is NOT sufficient — the
    // header could in principle be stamped for a different pinned artifact (e.g.
    // the legacy 10s phase-01h smoke via VISUAL_SHOWCASE_ARTIFACT_PATH). Assert
    // this is the intended 60-120s baseline replay (a 10s smoke is excluded by
    // the window bound, and would never satisfy the exporter contract anyway)
    // and the real baseline MODQN scenario, before certifying the gate.
    const playbackStatus = await page
      .locator('[data-testid="artifact-replay-playback-status"]')
      .innerText()
      .catch(() => '');
    const durMatch = playbackStatus.match(/\/\s*(\d+(?:\.\d+)?)s/);
    const durationSec = durMatch ? Number(durMatch[1]) : NaN;
    assert.ok(
      durationSec >= 60 && durationSec <= 120,
      `artifact duration in the 60-120s window contract (got ${durationSec}s from "${playbackStatus.trim()}") — not the legacy 10s smoke`,
    );
    const summary = await page
      .locator('[data-testid="artifact-replay-source-summary"]')
      .innerText()
      .catch(() => '');
    assert.ok(
      /baseline\s*modqn|phase\s*01h/i.test(summary),
      `real baseline MODQN scenario surfaced (got "${summary.replace(/\s+/g, ' ').trim().slice(0, 100)}")`,
    );
    console.log(
      `[director-cinematic] content invariant OK: duration=${durationSec}s, scenario="${summary.replace(/\s+/g, ' ').trim().slice(0, 60)}"`,
    );

    // Director controls present, intra focus offered on real intra rail events.
    assert.equal(await page.locator(DIRECTOR).count(), 1, 'director controls mount on artifact-replay');
    assert.equal(
      await attr(page, DIRECTOR, 'data-director-intra-enabled'),
      '1',
      'intra-HO focus is enabled (real artifact carries intra rail events)',
    );
    assert.equal(await attr(page, DIRECTOR, 'data-director-phase'), 'idle', 'director starts idle');

    // Baselines before focus.
    await page.waitForSelector(CANVAS, { timeout: 15000 });
    const cameraBefore = await attr(page, CANVAS, 'data-camera-position');
    const speedBefore = Number(await attr(page, SHELL, 'data-effective-speed'));
    assert.ok(speedBefore > CINEMATIC_SPEED, `normal speed before focus (${speedBefore})`);
    console.log(`[director-cinematic] before: phase=idle speed=${speedBefore} camera=${cameraBefore}`);

    // ── Enter intra cinematic focus ──
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

    await page.click(INTRA_BTN);

    // FSM leaves idle.
    await page.waitForFunction(
      () => document.querySelector('.leo-app-shell')?.getAttribute('data-director-phase') !== 'idle',
      undefined,
      { timeout: 8000 },
    );
    const phaseDuring = await attr(page, SHELL, 'data-director-phase');
    assert.ok(['acquiring', 'focused', 'restoring'].includes(phaseDuring ?? ''), `director FSM active (${phaseDuring})`);

    // Speed drops to the 0.05x cinematic tier.
    await page.waitForFunction(
      () => Number(document.querySelector('.leo-app-shell')?.getAttribute('data-effective-speed')) <= 0.05,
      undefined,
      { timeout: 8000 },
    );
    const speedDuring = Number(await attr(page, SHELL, 'data-effective-speed'));
    assert.ok(speedDuring <= CINEMATIC_SPEED, `speed dropped to cinematic tier (${speedDuring})`);

    // Camera world position actually changes (the focus tween; headless rAF is
    // throttled so poll with a generous window).
    await page.waitForFunction(
      (before: string | null) =>
        document.querySelector('canvas[data-camera-position]')?.getAttribute('data-camera-position') !== before,
      cameraBefore,
      { timeout: 12000 },
    );
    const cameraDuring = await attr(page, CANVAS, 'data-camera-position');
    assert.notEqual(cameraDuring, cameraBefore, 'camera pose actually moved on focus');
    console.log(`[director-cinematic] during: phase=${phaseDuring} speed=${speedDuring} camera=${cameraDuring} fadeObserved=${fadeObserved}`);

    await fadeWatch;
    if (!fadeObserved) {
      console.log(`[director-cinematic] WARN: dim-fade transition not caught (headless rAF throttle; ~300ms transient). Overlay present=${(await page.locator(FADE).count()) === 1}.`);
    } else {
      console.log(`[director-cinematic] dim-fade overlay observed transitioning (D3)`);
    }

    // ── Exit restores the FSM + speed ──
    await page.click(EXIT_BTN);
    await page.waitForFunction(
      () => document.querySelector('.leo-app-shell')?.getAttribute('data-director-phase') === 'idle',
      undefined,
      { timeout: 8000 },
    );
    await page.waitForFunction(
      () => Number(document.querySelector('.leo-app-shell')?.getAttribute('data-effective-speed')) > 0.05,
      undefined,
      { timeout: 8000 },
    );
    const phaseAfter = await attr(page, SHELL, 'data-director-phase');
    const speedAfter = Number(await attr(page, SHELL, 'data-effective-speed'));
    assert.equal(phaseAfter, 'idle', 'director restored to idle after exit');
    assert.ok(speedAfter > CINEMATIC_SPEED, `speed restored after exit (${speedAfter})`);
    console.log(`[director-cinematic] after exit: phase=${phaseAfter} speed=${speedAfter}`);

    const realErrors = consoleErrors.filter(e => !/ERR_CONNECTION_REFUSED|:8765|favicon/.test(e));
    assert.equal(realErrors.length, 0, `no real console errors: ${JSON.stringify(realErrors)}`);

    console.log('[director-cinematic] PASS — camera moved, speed dropped to 0.05x, FSM restored on exit (DATA SOURCE = real producer-pinned artifact)');
  } finally {
    await browser.close();
  }
  if (skipped) return;
}

main().catch(err => {
  console.error('[director-cinematic] FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
