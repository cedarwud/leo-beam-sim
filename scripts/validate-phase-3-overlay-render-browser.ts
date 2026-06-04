/**
 * Phase-3 S4 cylinder + S5 upload-particles real-render durable browser gate.
 *
 * Provenance audit 2026-06-04 (Top Gap #2, last fake-risk): the phase-3 3D
 * beam-load cylinder (S4) and upload particles (S5) were "browser-verified" only
 * by `validate-phase-3-overlays.ts` source-string mounts
 * (`mainScene.includes('<BeamLoadCylinder')` / `'<BeamLoadUploadParticles')`) —
 * zero runtime, zero render. A refactor that broke the render would still pass.
 *
 * Both overlays only mount in the `explain-handover` cell visual preset, so this
 * gate seeds the modqn-demo cell lane, switches to that preset via the ControlBar
 * control, and asserts that the cylinder MESH is visible AND the upload-particle
 * InstancedMeshes carry a non-zero summed instance count on real beam-load. The
 * telemetry is MESH-derived: BeamLoadCylinder publishes its post-toggle
 * `mesh.visible` and BeamLoadUploadParticles publishes the summed post-populate
 * `mesh.count` (codex P2 — a model-derived observable could pass while the mesh is
 * visually broken; reading the mesh state catches a broken mesh-write line).
 *
 * DATA SOURCE: live-engine (the in-browser live Walker simulation on the
 * modqn-demo cell lane). The beam-load is the FIX-7 profile-derived cell-schedule
 * overlay-demo assignment (NOT producer r3) — same lane truth the cell overlay
 * already shows; this gate proves the 3D encodings of it paint, nothing more.
 *
 * Requires a running dev server.
 * Run: `npm run validate:phase-3:overlay-render:browser`.
 */
import assert from 'node:assert/strict';
import { chromium, type Browser, type Page } from '@playwright/test';
import { detectAppUrl } from './_vc2-browser-fixture.ts';

const SHELL = '.leo-app-shell';
const CANVAS = 'canvas[data-camera-position]';

async function readOverlay(
  page: Page,
  selector: string,
): Promise<{
  preset: string;
  cylinderVisible: string;
  particles: number;
  contention: number;
  served: number;
  storyVisible: string;
  storyRenderedMeshes: number;
}> {
  // The cylinder/particle counts are MESH-derived: the BeamLoadCylinder /
  // BeamLoadUploadParticles components write the actual post-toggle `mesh.visible`
  // and summed InstancedMesh `mesh.count` to these dataset attrs, so a broken
  // mesh-write line is caught (codex P2: model-derived telemetry could pass while
  // the mesh is visually broken).
  return page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement | null;
    const d = el?.dataset ?? {};
    return {
      preset: d.modqnVisualLayerPreset ?? '',
      cylinderVisible: d.beamLoadCylinderRendered ?? '',
      particles: d.uploadParticleRenderedCount === undefined ? NaN : Number(d.uploadParticleRenderedCount),
      contention: d.beamLoadContentionUeCount === undefined ? NaN : Number(d.beamLoadContentionUeCount),
      served: d.modqnServedUeCount === undefined ? NaN : Number(d.modqnServedUeCount),
      storyVisible: d.handoverStoryVisible ?? '',
      storyRenderedMeshes: d.handoverStoryRenderedMeshCount === undefined ? NaN : Number(d.handoverStoryRenderedMeshCount),
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

    await page.addInitScript(() => {
      window.localStorage.setItem('leo-beam-sim.app-mode.v1', 'modqn-demo');
    });
    await page.goto(`${appUrl}/?sceneSource=live-sim`, { waitUntil: 'domcontentloaded' });
    assert.equal(
      await page.getAttribute(SHELL, 'data-scene-lane'),
      'modqn-live-cell-preview',
      'lane resolves to modqn-live-cell-preview',
    );
    await page.waitForSelector(CANVAS, { timeout: 20000 });

    // The S4/S5 overlays only mount in the explain-handover preset.
    const explainBtn = page.locator('[data-testid="modqn-layer-preset-explain-handover"]');
    await explainBtn.waitFor({ state: 'visible', timeout: 20000 });
    await explainBtn.click();

    let snap = await readOverlay(page, CANVAS);
    for (let i = 0; i < 50; i += 1) {
      snap = await readOverlay(page, CANVAS);
      if (snap.cylinderVisible === 'true' && snap.particles > 0) break;
      await page.waitForTimeout(300);
    }

    assert.equal(snap.preset, 'explain-handover', `preset switched to explain-handover (got ${snap.preset})`);
    assert.ok(snap.served > 0, `cell lane has schedule-served UEs (data-modqn-served-ue-count=${snap.served})`);
    assert.ok(snap.contention > 0, `phase-3 contention fires (data-beam-load-contention-ue-count=${snap.contention})`);
    assert.equal(
      snap.cylinderVisible,
      'true',
      `phase-3 S4 beam-load cylinder MESH is visible on real beam-load (data-beam-load-cylinder-rendered=${snap.cylinderVisible})`,
    );
    assert.ok(
      snap.particles > 0,
      `phase-3 S5 upload-particle MESH carries instances on real beam-load (data-upload-particle-rendered-count=${snap.particles})`,
    );
    // Adversarial-critic #4: the MODQN decision overlay / handover-story layer was
    // proven only by `validate-modqn-handover-story-layer.ts` source-string. The
    // explain-handover preset mounts the profile-derived story layer; assert its
    // actual scene-graph ring/cue meshes rendered (MESH-derived: the layer
    // traverses its own subtree and publishes the visible-mesh count — a broken
    // <BeamSlotRing> render is caught, unlike the model `handoverStoryActiveCount`).
    assert.ok(
      snap.storyRenderedMeshes > 0,
      `MODQN handover-story layer actually rendered ring/cue meshes on the live cell lane (data-handover-story-rendered-mesh-count=${snap.storyRenderedMeshes})`,
    );
    console.log(
      `[phase-3-overlay-render] S4 cylinder + S5 particles + story paint: cylinder=${snap.cylinderVisible}, particles=${snap.particles}, contention=${snap.contention}, storyMeshes=${snap.storyRenderedMeshes}`,
    );

    assert.equal(await page.getAttribute(CANVAS, 'data-scene-source'), 'live-sim', 'cell lane stays live-sim');

    const realErrors = consoleErrors.filter(e => !/ERR_CONNECTION_REFUSED|:8765|favicon|baseline-browser/.test(e));
    assert.deepEqual(realErrors, [], `no real console errors: ${JSON.stringify(realErrors)}`);
    console.log('[phase-3-overlay-render] PASS (DATA SOURCE = live modqn-cell engine, profile-derived overlay-demo)');
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('[phase-3-overlay-render] FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
