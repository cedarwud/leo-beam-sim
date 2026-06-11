/**
 * Phase-3 beam-load CONTENTION real-render durable browser gate.
 *
 * Provenance audit 2026-06-04 (FIX-7 finding #1): the phase-3 contention glow
 * was "browser-verified" only by `validate-phase-3-overlays.ts` source-string
 * mounts (`mainScene.includes('<BeamLoadCylinder')`). The real-render gate built
 * during FIX-7 REVEALED that the glow never fired on the live modqn-cell lane:
 * its old `sim.perUePositions` source is empty there (the modqn-demo 4-sat
 * decision-overlay path acquires no per-UE HandoverManager serving — even the
 * primary `sim.serving.satId` is null), so `data-beam-load-contention-ue-count`
 * stayed 0. That gate was removed because it could not pass honestly.
 *
 * The FIX-7 truth-ownership fix (C1) rewires the contention to the SAME
 * profile-derived cell-schedule per-UE (satId, beamIndex) assignment that
 * `modqnServiceMap` already uses to colour the markers and emit the per-cell
 * UE-count badges — the lane's authoritative *displayed* assignment
 * (`source: 'profile-derived-demo'` / `claimKind: 'overlay-demo'`, NOT producer
 * r3). This gate now PROVES the contention actually fires on real live geometry.
 *
 * DATA SOURCE: live-engine (the in-browser live Walker simulation on the
 * modqn-demo cell lane). NOT a fixture and NOT a source string. The contention
 * count is derived from the profile-derived cell schedule (overlay-demo), which
 * is the same authoritative quantity the cell UE-count badges already show.
 *
 * S-FLAG-2: the contention glow is part of the MODQN service-allocation overlay
 * family, which is now PARKED OFF by default (degenerate producer baseline). This
 * render-path gate un-parks it with the `?modqnServiceAllocation=1` dev/validator
 * override so the glow's mesh-write path stays provable; the parked default is
 * positive-controlled by `validate-phase-3-overlay-render-browser.ts`.
 *
 * Requires a running dev server.
 * Run: `npm run validate:phase-3:contention-render:browser`.
 */
import assert from 'node:assert/strict';
import { chromium, type Browser, type Page } from '@playwright/test';
import { detectAppUrl } from './_vc2-browser-fixture.ts';

const SHELL = '.leo-app-shell';
const CANVAS = 'canvas[data-camera-position]';

/**
 * Read the three contention/serving telemetry counts in ONE DOM snapshot so the
 * `contention <= served` invariant compares values from the SAME frame. The live
 * sim re-renders continuously, so three separate `getAttribute` round-trips can
 * straddle a frame boundary and read counts from different modqnServiceMap
 * snapshots (adversarial governance-gate lens caught a cross-frame FALSE-FAIL:
 * contention=77 from frame N vs served=70 from frame N+1). One `evaluate` reads
 * the dataset at a single instant — all three come from one React commit.
 */
async function readCounts(
  page: Page,
  selector: string,
): Promise<{ rendered: number; served: number; contention: number }> {
  // Inline the parse (no named inner function): tsx/esbuild `keepNames` wraps a
  // named arrow with `__name(...)`, which is undefined in the page context and
  // throws `ReferenceError: __name is not defined` inside page.evaluate.
  return page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement | null;
    const d = el?.dataset ?? {};
    return {
      rendered: d.renderedUeCount === undefined ? NaN : Number(d.renderedUeCount),
      served: d.modqnServedUeCount === undefined ? NaN : Number(d.modqnServedUeCount),
      contention: d.beamLoadContentionUeCount === undefined ? NaN : Number(d.beamLoadContentionUeCount),
    };
  }, selector);
}

async function main(): Promise<void> {
  const appUrl = process.env.APP_URL ?? process.argv[2] ?? (await detectAppUrl());
  const browser: Browser = await chromium.launch();
  try {
    const page: Page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const consoleErrors: string[] = [];
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('pageerror', e => consoleErrors.push(`PAGEERROR ${e.message}`));

    // AppModeRail is not mounted in this build, so the modqn-demo cell lane is
    // selected by seeding the persisted app mode + the live-sim scene source.
    await page.addInitScript(() => {
      window.localStorage.setItem('leo-beam-sim.app-mode.v1', 'modqn-demo');
    });
    // S-FLAG-2: un-park the service-allocation family so the contention glow's
    // render path is exercised (parked default proven elsewhere).
    await page.goto(`${appUrl}/?sceneSource=live-sim&modqnServiceAllocation=1`, { waitUntil: 'domcontentloaded' });

    assert.equal(
      await page.getAttribute(SHELL, 'data-scene-lane'),
      'modqn-live-cell-preview',
      'lane resolves to modqn-live-cell-preview',
    );
    await page.waitForSelector(CANVAS, { timeout: 20000 });

    // The live cell lane renders the 100-UE service map and the contention glow
    // actually fires. Headless SwiftShader steps rAF slowly, so poll the live
    // telemetry until the contention appears (or time out → FAIL).
    let renderedUe = NaN;
    let servedUe = NaN;
    let contentionUe = NaN;
    for (let i = 0; i < 50; i += 1) {
      ({ rendered: renderedUe, served: servedUe, contention: contentionUe } = await readCounts(page, CANVAS));
      if (contentionUe > 0) break;
      await page.waitForTimeout(300);
    }

    assert.ok(renderedUe > 1, `live cell lane renders the multi-UE service map (data-rendered-ue-count=${renderedUe})`);
    assert.ok(servedUe > 0, `live cell lane has schedule-served UEs (data-modqn-served-ue-count=${servedUe})`);
    assert.ok(
      contentionUe > 0,
      `phase-3 contention glow actually fires on real live beam-load (data-beam-load-contention-ue-count=${contentionUe})`,
    );
    // The contention overlay is a per-UE encoding of the served-UE set; it must
    // never claim more contended UEs than the schedule actually served.
    assert.ok(
      contentionUe <= servedUe,
      `contention count (${contentionUe}) must not exceed schedule-served UEs (${servedUe})`,
    );
    console.log(
      `[phase-3-contention-render] glow fires: contention=${contentionUe} / served=${servedUe} / rendered=${renderedUe}`,
    );

    // No artifact-lane leak on the live cell lane.
    assert.equal(
      await page.getAttribute(CANVAS, 'data-scene-source'),
      'live-sim',
      'cell lane scene source stays live-sim',
    );
    assert.equal(
      await page.locator('[data-testid="artifact-satellite-compass"]').count(),
      0,
      'artifact compass must not leak onto the live cell lane',
    );

    const realErrors = consoleErrors.filter(e => !/ERR_CONNECTION_REFUSED|:8765|favicon|baseline-browser/.test(e));
    assert.deepEqual(realErrors, [], `no real console errors: ${JSON.stringify(realErrors)}`);
    console.log('[phase-3-contention-render] PASS (DATA SOURCE = live modqn-cell engine, profile-derived overlay-demo)');
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('[phase-3-contention-render] FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
