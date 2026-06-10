/**
 * Phase C durable browser gate: the HANDOVER CINEMA (D4/S3a) works on the
 * SINR-live cell-truth lane — arming a handover focus drops to 0.25x slow-mo,
 * moves the camera to the sat-pair, lights up the candidate cells, renders the
 * focused old/new off-axis beam pair, and floats the SINR explainer.
 *
 * DATA SOURCE: `sinrLiveCells` — the same earth-fixed cell-truth trajectory the
 * SINR-serving mosaic uses. The script enables the existing UE mobility topology
 * override so intra-HO events exist; if the source has no event, the button must
 * stay disabled/source-gapped rather than fabricating one. No producer artifact
 * required and no new dev server is started.
 *
 * Asserts (hard), all on `sinr-live`:
 *  - intra-HO and inter-HO focus become enabled from source events;
 *  - arming it floats the SINR explainer with `data-claim-kind="sinr-offset"`, two
 *    candidate rows (one winner-selected), finite live SINR, cell ids, and off-axis
 *    values;
 *  - the director FSM leaves idle, speed drops to the 0.25x tier, and the camera
 *    world position moves;
 *  - the candidate-cell highlight and old/new cell beam pair both render real
 *    meshes from the same event id/source owner;
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
const INTRA_BTN = '[data-testid="director-intra-focus"]';
const INTER_BTN = '[data-testid="director-inter-focus"]';
const EXIT_BTN = '[data-testid="director-exit-focus"]';
const EXPLAINER = '[data-testid="handover-cinema-sinr-explainer"]';
const CANDIDATE_ROW = '[data-testid="sinr-candidate-row"]';
const HIGHLIGHT_COUNT_ATTR = 'data-candidate-handover-highlight-rendered-count';
const PAIR_RENDERED_COUNT_ATTR = 'data-sinr-live-cell-handover-pair-cone-rendered-count';
const PAIR_RENDERED_SOURCE_ATTR = 'data-sinr-live-cell-handover-pair-cone-rendered-source-owner';
const PAIR_RENDERED_EVENT_ATTR = 'data-sinr-live-cell-handover-pair-cone-rendered-event-id';
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
    await page.addInitScript(() => {
      window.localStorage.setItem('leo-beam-sim.scene-topology.v1', JSON.stringify({
        satsPerPlane: null,
        beamCountPerSatellite: null,
        cellServingCount: null,
        ueCount: 100,
        ueDistributionMode: 'random',
        ueMobilityMode: 'random-walk',
        ueMobilityParams: {
          speedKmPerSec: 5,
          waypointCount: 4,
          manhattanGridSpacingKm: 5,
        },
        enableUeTrails: null,
      }));
    });

    await page.goto(`${appUrl}/?sceneSource=live-sim&appMode=sinr-experiment`, { waitUntil: 'domcontentloaded' });

    // Live SINR Walker lane + canvas + director controls.
    assert.equal(await attr(page, SHELL, 'data-scene-lane'), 'sinr-live', 'lane resolves to sinr-live');
    await page.waitForSelector(CANVAS, { timeout: 20000 });
    assert.equal(await page.locator(DIRECTOR).count(), 1, 'director controls mount on the live lane');

    // Honesty: the live focus is sourced from sinrLiveCells cell truth (not producer proof).
    assert.equal(
      await attr(page, SHELL, 'data-live-director-focus-claim'),
      'live-truth',
      'live focus is honestly labeled live-truth',
    );
    assert.equal(
      await attr(page, SHELL, 'data-live-director-focus-source-owner'),
      'sinr-live-cell-truth',
      'live focus source owner is sinrLiveCells cell truth',
    );
    assert.equal(await attr(page, '[data-testid="handover-event-rail"]', 'data-source-owner'), 'sinr-live-cell-truth',
      'rail source owner is cell truth');
    console.log('[handover-cinema] DATA SOURCE = sinrLiveCells cell-truth trajectory');

    // The mobility-backed cell-truth source produces both intra and inter events.
    // Poll generously: the app builds the 7200s cell-truth event index on load.
    await page.waitForFunction(
      () =>
        document.querySelector('[data-testid="director-controls"]')?.getAttribute('data-director-intra-enabled') === '1'
        && document.querySelector('[data-testid="director-controls"]')?.getAttribute('data-director-inter-enabled') === '1',
      undefined,
      { timeout: 60000, polling: 250 },
    );
    assert.equal(await attr(page, SHELL, 'data-director-phase'), 'idle', 'director starts idle');

    // No cinema before arming: the explainer is absent.
    assert.equal(await page.locator(EXPLAINER).count(), 0, 'SINR explainer absent before arming');

    const cameraBefore = await attr(page, CANVAS, 'data-camera-position');
    const speedBefore = Number(await attr(page, SHELL, 'data-effective-speed'));
    assert.ok(speedBefore > CINEMATIC_SPEED, `normal speed before arming (${speedBefore})`);

    // ── Arm the intra-HO cinema: same satellite, different earth-fixed cells. ──
    await page.click(INTRA_BTN);

    // 1) The SINR explainer floats with the lane-truthful claim.
    await page.waitForSelector(EXPLAINER, { timeout: 12000 });
    assert.equal(await attr(page, EXPLAINER, 'data-claim-kind'), 'sinr-offset',
      'SINR explainer carries claim-kind="sinr-offset" (lane-truthful, not MODQN/producer)');
    assert.equal(await attr(page, EXPLAINER, 'data-focus-kind'), 'intra', 'explainer focus kind = intra');
    assert.equal(await attr(page, EXPLAINER, 'data-source-owner'), 'sinr-live-cell-truth',
      'explainer reads the cell-truth event source');
    const focusedEventId = await attr(page, SHELL, 'data-live-director-focus-event-id');
    assert.ok(focusedEventId && focusedEventId.length > 0, 'shell exposes focused event id');
    assert.equal(await attr(page, EXPLAINER, 'data-event-id'), focusedEventId,
      'explainer event id matches director focus event id');
    const focusEventSec = Number(await attr(page, SHELL, 'data-live-director-focus-event-sec'));
    const explainerSourceSec = Number(await attr(page, EXPLAINER, 'data-source-time-sec'));
    assert.ok(Math.abs(explainerSourceSec - focusEventSec) <= 0.001,
      `explainer source time ${explainerSourceSec} matches focused source time ${focusEventSec}`);

    // Two candidate rows (serving + winner), exactly one selected, with finite
    // live SINR + live provenance + cell/off-axis data.
    const rowCount = await page.locator(CANDIDATE_ROW).count();
    assert.equal(rowCount, 2, `explainer shows the two candidate beams (got ${rowCount})`);
    const selectedCount = await page.locator(`${CANDIDATE_ROW}[data-is-selected="true"]`).count();
    assert.equal(selectedCount, 1, 'exactly one candidate row is the selected winner');
    const winner = page.locator(`${CANDIDATE_ROW}[data-is-selected="true"]`).first();
    const serving = page.locator(`${CANDIDATE_ROW}[data-role="serving"]`).first();
    assert.equal(await winner.getAttribute('data-provenance-plane'), 'live', 'winner row is live-provenance');
    const winnerSinr = Number(await winner.getAttribute('data-sinr-db'));
    assert.ok(Number.isFinite(winnerSinr), `winner row carries a finite live SINR (got "${winnerSinr}")`);
    const servingSatId = await serving.getAttribute('data-sat-id');
    const winnerSatId = await winner.getAttribute('data-sat-id');
    assert.equal(servingSatId, winnerSatId, 'intra-HO keeps the same serving satellite');
    const servingCellId = await serving.getAttribute('data-cell-id');
    const winnerCellId = await winner.getAttribute('data-cell-id');
    assert.ok(servingCellId && winnerCellId && servingCellId !== winnerCellId,
      `intra-HO switches earth-fixed cells (${servingCellId} -> ${winnerCellId})`);
    const servingOffAxis = Number(await serving.getAttribute('data-off-axis-deg'));
    const winnerOffAxis = Number(await winner.getAttribute('data-off-axis-deg'));
    assert.ok(servingOffAxis > 0.1, `serving row carries visible off-axis ${servingOffAxis}`);
    assert.ok(winnerOffAxis > 0.1, `winner row carries visible off-axis ${winnerOffAxis}`);
    console.log(`[handover-cinema] explainer armed: event=${focusedEventId} sourceTime=${explainerSourceSec}s winner SINR=${winnerSinr} dB offAxis=${servingOffAxis}->${winnerOffAxis}`);

    // 2) FSM leaves idle.
    await page.waitForFunction(
      () => document.querySelector('.leo-app-shell')?.getAttribute('data-director-phase') !== 'idle',
      undefined,
      { timeout: 45000, polling: 100 },
    );
    const phaseDuring = await attr(page, SHELL, 'data-director-phase');
    assert.ok(['acquiring', 'focused', 'restoring'].includes(phaseDuring ?? ''), `director FSM active (${phaseDuring})`);

    // 3) Speed drops to the 0.25x cinematic tier.
    await page.waitForFunction(
      () => Number(document.querySelector('.leo-app-shell')?.getAttribute('data-effective-speed')) <= 0.25,
      undefined,
      { timeout: 30000, polling: 250 },
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

    // 4b) The old/new off-axis cell beam pair renders as real meshes and carries
    // the SAME event/source owner as the explainer.
    await page.waitForFunction(
      ({ canvasSel, countAttr }: { canvasSel: string; countAttr: string }) => {
        const v = document.querySelector(canvasSel)?.getAttribute(countAttr);
        return v !== null && Number(v) === 2;
      },
      { canvasSel: CANVAS, countAttr: PAIR_RENDERED_COUNT_ATTR },
      { timeout: 15000, polling: 250 },
    );
    const pairCount = Number(await attr(page, CANVAS, PAIR_RENDERED_COUNT_ATTR));
    assert.equal(pairCount, 2, 'old/new cell-truth beam pair rendered exactly two cone meshes');
    assert.equal(await attr(page, CANVAS, PAIR_RENDERED_SOURCE_ATTR), 'sinr-live-cell-truth',
      'old/new pair source owner matches cell truth');
    assert.equal(await attr(page, CANVAS, PAIR_RENDERED_EVENT_ATTR), focusedEventId,
      'old/new pair event id matches explainer/director event id');

    // 5) Camera world position actually moves (sat-pair focus tween).
    await page.waitForFunction(
      (before: string | null) =>
        document.querySelector('canvas[data-camera-position]')?.getAttribute('data-camera-position') !== before,
      cameraBefore,
      { timeout: 15000 },
    );
    const cameraDuring = await attr(page, CANVAS, 'data-camera-position');
    assert.notEqual(cameraDuring, cameraBefore, 'camera pose moved on focus');
    console.log(`[handover-cinema] during: phase=${phaseDuring} speed=${speedDuring} highlight=${highlightCount} pair=${pairCount} camera moved`);

    // CQ1 moving-camera coverage is owned by the director-cinematic gates. D4
    // only requires that the auto camera moves to the source-backed event; the
    // cell-truth focus can auto-restore before a stable hold sample is available
    // on slow headless runs.
    const phaseBeforeOrbitProbe = await attr(page, SHELL, 'data-director-phase');
    if (phaseBeforeOrbitProbe === 'focused') {
      const holdPos = await attr(page, CANVAS, 'data-camera-position');
      try {
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
        console.log(`[handover-cinema] CQ1 orbit observed during focused hold (${holdPos} -> ${holdPosLater})`);
      } catch {
        console.log('[handover-cinema] CQ1 orbit probe skipped; D4 source-sync assertions already passed and focus moved/restored quickly');
      }
    }

    // ── Exit restores + tears the cinema down ──
    if ((await attr(page, SHELL, 'data-director-phase')) !== 'idle') {
      try {
        await page.click(EXIT_BTN, { timeout: 2000 });
      } catch {
        // The focus can auto-restore while Playwright is preparing the click.
        // Cleanup below is the acceptance condition; the button press is only a
        // fast path when the focus is still active.
      }
    }
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
    await page.waitForFunction(
      ({ canvasSel, countAttr }: { canvasSel: string; countAttr: string }) => {
        const v = document.querySelector(canvasSel)?.getAttribute(countAttr);
        return v === null || Number(v) === 0;
      },
      { canvasSel: CANVAS, countAttr: PAIR_RENDERED_COUNT_ATTR },
      { timeout: 8000, polling: 250 },
    );
    const phaseAfter = await attr(page, SHELL, 'data-director-phase');
    assert.equal(phaseAfter, 'idle', 'director restored to idle after exit');
    assert.equal(await page.locator(EXPLAINER).count(), 0, 'SINR explainer torn down after exit');
    console.log(`[handover-cinema] after exit: phase=${phaseAfter}, explainer gone, highlight/pair cleared`);

    // No artifact-lane leak onto the live lane.
    assert.equal(await page.locator('[data-testid="artifact-satellite-compass"]').count(), 0, 'artifact compass must not leak onto the live lane');
    assert.equal(await page.locator('[data-testid="artifact-source-badge"]').count(), 0, 'artifact source badge must not leak onto the live lane');

    const realErrors = consoleErrors.filter(e => !/ERR_CONNECTION_REFUSED|:8765|favicon/.test(e));
    assert.deepEqual(realErrors, [], `no real console errors: ${JSON.stringify(realErrors)}`);

    console.log('[handover-cinema] PASS — cell-truth intra focus: source-time event id shared by explainer + candidate rings + old/new off-axis beam pair + 0.25x camera focus; exit restored and tore down');
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('[handover-cinema] FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
