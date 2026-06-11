import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from '@playwright/test';
import {
  BEAM_FREQUENCY_COLORS,
  BEAM_ROLE_TOKENS,
  SATELLITE_TINT_PALETTE,
  satelliteTint,
  satelliteTintIndex,
} from '../src/constants/beamRoleTokens.ts';
import {
  CELL_COVER_HOLD_TICKS,
  CELL_COVER_ROLE_PRIORITY,
  createCellCoverCandidate,
  generateHexGrid,
  resolveHexCellCoverAssignments,
  selectDominantCellCover,
  type CellCoverCandidate,
  type CellCoverHysteresisState,
  type CellData,
} from '../src/viz/EarthFixedCells.tsx';
import type { BeamTarget } from '../src/viz/SatelliteBeams.tsx';
import { satelliteGlyph } from '../src/viz/glyphs.ts';
import { detectAppUrl } from './_vc2-browser-fixture.ts';
import { bootDeterministicPage } from './_v3-deterministic-fixture.ts';

interface PixelRgb {
  r: number;
  g: number;
  b: number;
}

interface Vc3BrowserFixtureResult {
  canvasReady: boolean;
  cells: Array<{
    id: number;
    isServed: boolean;
    coveringBeamKey: string | null;
    debugLabel: string | null;
    outerBorderColor: string | null;
    fillColor: string | null;
    innerRoleBorderColor: string | null;
  }>;
  expected: {
    dominantBeamKey: string;
    outerBorderColor: string;
    fillColor: string;
    innerRoleBorderColor: string;
    fillOpacity: number;
  };
  samplePlan: {
    backgroundColor: string;
    viewport: { width: number; height: number };
    center: { x: number; y: number };
    outerBorderRadiusPx: number;
    innerBorderRadiusPx: number;
  };
}

const CHECKPOINT_PATH = fileURLToPath(
  new URL('../docs/visual-clarity-proposal/manual-checkpoints/vc3a-post-slice-1440x900.png', import.meta.url),
);

function hexToRgb(hex: string): PixelRgb {
  const normalized = hex.replace('#', '');
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function linearize(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function labFromRgb(rgb: PixelRgb): [number, number, number] {
  const r = linearize(rgb.r);
  const g = linearize(rgb.g);
  const b = linearize(rgb.b);
  let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  let y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.0;
  let z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (value: number) => (value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116);
  x = f(x);
  y = f(y);
  z = f(z);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

function deltaERgb(left: PixelRgb, right: PixelRgb): number {
  const a = labFromRgb(left);
  const b = labFromRgb(right);
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function deltaE(left: string, right: string): number {
  return deltaERgb(hexToRgb(left), hexToRgb(right));
}

function additiveBlend(backgroundHex: string, foregroundHex: string, opacity: number): PixelRgb {
  const background = hexToRgb(backgroundHex);
  const foreground = hexToRgb(foregroundHex);
  return {
    r: Math.min(255, Math.round(background.r + foreground.r * opacity)),
    g: Math.min(255, Math.round(background.g + foreground.g * opacity)),
    b: Math.min(255, Math.round(background.b + foreground.b * opacity)),
  };
}

function makeBeam(input: {
  satelliteId: string;
  displayOrder: number;
  beamId: number;
  role?: BeamTarget['role'];
  isServing?: boolean;
  isScheduledActive?: boolean;
  frequencyIndex?: number;
  sinrDb?: number;
  groundX?: number;
  groundZ?: number;
}): BeamTarget {
  const satelliteVisualIndex = satelliteTintIndex(input.satelliteId, input.displayOrder);
  return {
    beamId: input.beamId,
    groundX: input.groundX ?? 0,
    groundZ: input.groundZ ?? 0,
    isServing: input.isServing ?? false,
    isScheduledActive: input.isScheduledActive ?? true,
    isPrimary: Boolean(input.role || input.isServing),
    showBeam: true,
    frequencyIndex: input.frequencyIndex ?? 0,
    satelliteTintColor: satelliteTint(input.satelliteId, input.displayOrder),
    satelliteGlyph: satelliteGlyph(satelliteVisualIndex),
    satelliteVisualIndex,
    role: input.role,
    sinrDb: input.sinrDb ?? 0,
  };
}

function makeCandidate(input: {
  satelliteId: string;
  displayOrder: number;
  beamId: number;
  role?: BeamTarget['role'];
  isServing?: boolean;
  frequencyIndex?: number;
  sinrDb?: number;
  groundX?: number;
  groundZ?: number;
  footprintRadius?: number;
}): CellCoverCandidate {
  const candidate = createCellCoverCandidate({
    satelliteId: input.satelliteId,
    displayOrder: input.displayOrder,
    footprintRadius: input.footprintRadius ?? 48,
    beam: makeBeam(input),
  });
  assert.ok(candidate, `expected ${input.satelliteId}:B${input.beamId} to produce a cover candidate`);
  return candidate;
}

function centralCell(radius = 40): CellData {
  return generateHexGrid({
    rows: 1,
    cols: 1,
    cellRadius: radius,
    centerX: 0,
    centerZ: 0,
  })[0];
}

function coverFingerprint(cells: CellData[]): Array<{ id: number; beamKey: string | null }> {
  return cells.map(cell => ({ id: cell.id, beamKey: cell.coveringBeam?.beamKey ?? null }));
}

function assertCoverMapSelection(): void {
  const cell = centralCell();
  const candidates = [
    makeCandidate({
      satelliteId: 'shell-pro-53-P0-S0',
      displayOrder: 2,
      beamId: 1,
      sinrDb: 45,
      frequencyIndex: 0,
    }),
    makeCandidate({
      satelliteId: 'shell-pro-53-P0-S1',
      displayOrder: 1,
      beamId: 2,
      role: 'prepared',
      sinrDb: 35,
      frequencyIndex: 1,
    }),
    makeCandidate({
      satelliteId: 'shell-pro-53-P0-S2',
      displayOrder: 0,
      beamId: 3,
      role: 'serving',
      isServing: true,
      sinrDb: 5,
      frequencyIndex: 2,
    }),
  ];

  const dominant = selectDominantCellCover(candidates);
  assert.equal(dominant?.role, 'serving', 'serving must beat pending and otherActive regardless of SINR');
  assert.equal(CELL_COVER_ROLE_PRIORITY.serving, 0, 'serving must remain the highest cover priority');

  const sameRoleHigherSinr = selectDominantCellCover([
    makeCandidate({
      satelliteId: 'shell-pro-53-P0-S3',
      displayOrder: 3,
      beamId: 4,
      sinrDb: 12,
      frequencyIndex: 3,
    }),
    makeCandidate({
      satelliteId: 'shell-pro-53-P0-S4',
      displayOrder: 2,
      beamId: 5,
      sinrDb: 18,
      frequencyIndex: 4,
    }),
  ]);
  assert.equal(sameRoleHigherSinr?.beamKey, 'shell-pro-53-P0-S4:B5', 'same-role overlap must pick higher SINR');

  const sameRoleTie = selectDominantCellCover([
    makeCandidate({
      satelliteId: 'shell-pro-53-P0-S5',
      displayOrder: 2,
      beamId: 6,
      sinrDb: 18,
      frequencyIndex: 5,
    }),
    makeCandidate({
      satelliteId: 'shell-pro-53-P0-S6',
      displayOrder: 1,
      beamId: 7,
      sinrDb: 18,
      frequencyIndex: 0,
    }),
  ]);
  assert.equal(sameRoleTie?.beamKey, 'shell-pro-53-P0-S6:B7', 'same-role SINR tie must pick display-order winner');

  const painted = resolveHexCellCoverAssignments({
    cells: [cell],
    beams: candidates,
    hysteresis: new Map(),
  });
  assert.equal(painted[0].coveringBeam?.beamKey, 'shell-pro-53-P0-S2:B3');
  // S2: tint is satId-stable (was display-order 0 => palette[0]).
  assert.equal(painted[0].coveringBeam?.satTintColor, satelliteTint('shell-pro-53-P0-S2'));
  assert.equal(painted[0].coveringBeam?.frequencyColor, BEAM_FREQUENCY_COLORS[2]);
  assert.equal(painted[0].coveringBeam?.roleColor, BEAM_ROLE_TOKENS.serving.color);
  assert.equal(painted[0].coveringBeam?.isServingOrPending, true);
}

function assertHysteresis(): void {
  const cells = [centralCell()];
  const state: CellCoverHysteresisState = new Map();
  const lower = makeCandidate({
    satelliteId: 'shell-pro-53-P0-S0',
    displayOrder: 0,
    beamId: 1,
    sinrDb: 8,
  });
  const higher = makeCandidate({
    satelliteId: 'shell-pro-53-P0-S1',
    displayOrder: 1,
    beamId: 2,
    sinrDb: 18,
  });

  const initial = resolveHexCellCoverAssignments({ cells, beams: [lower], hysteresis: state });
  assert.equal(initial[0].coveringBeam?.beamKey, lower.beamKey, 'initial cover assignment did not latch');

  const firstCompetingTick = resolveHexCellCoverAssignments({ cells, beams: [lower, higher], hysteresis: state });
  assert.equal(
    firstCompetingTick[0].coveringBeam?.beamKey,
    lower.beamKey,
    'hysteresis must hold previous cover for the first competing tick',
  );

  const secondCompetingTick = resolveHexCellCoverAssignments({ cells, beams: [lower, higher], hysteresis: state });
  assert.equal(
    secondCompetingTick[0].coveringBeam?.beamKey,
    higher.beamKey,
    `hysteresis must switch after ${CELL_COVER_HOLD_TICKS} consecutive candidate ticks`,
  );

  const repeat = resolveHexCellCoverAssignments({ cells, beams: [lower, higher], hysteresis: state });
  assert.deepEqual(
    coverFingerprint(repeat),
    coverFingerprint(secondCompetingTick),
    'same SimFrame repeated after latch must produce identical cover-map output',
  );
}

function assertForbiddenCrossUseSourceInvariant(): void {
  for (const tint of SATELLITE_TINT_PALETTE) {
    for (const token of Object.values(BEAM_ROLE_TOKENS)) {
      assert.ok(deltaE(tint, token.color) >= 15, `${tint} is too close to role color ${token.color}`);
    }
    for (const frequencyColor of BEAM_FREQUENCY_COLORS) {
      assert.ok(deltaE(tint, frequencyColor) >= 15, `${tint} is too close to frequency color ${frequencyColor}`);
    }
  }
}

async function installVc3Fixture(page: Page): Promise<void> {
  await page.addScriptTag({
    type: 'module',
    content: `
      import { renderVc3HexPaintFixture } from '/src/validation/vc3HexPaintFixture.tsx';
      window.__renderVc3HexPaintFixture = renderVc3HexPaintFixture;
    `,
  });
  await page.waitForFunction(() => typeof window.__renderVc3HexPaintFixture === 'function');
}

async function sampleVc3Canvas(
  page: Page,
  result: Vc3BrowserFixtureResult,
): Promise<{
  nonBackgroundPixels: number;
  centerFillDeltaE: number;
  fillDeltaE: number;
  outerBorderDeltaE: number;
  innerBorderDeltaE: number;
  fillBestPixel: PixelRgb;
  outerBestPixel: PixelRgb;
  innerBestPixel: PixelRgb;
  outerBorderNearestRoleDeltaE: number;
  outerBorderNearestFrequencyDeltaE: number;
}> {
  const fixture = {
    ...result,
    roleColors: Object.values(BEAM_ROLE_TOKENS).map(token => token.color),
    frequencyColors: [...BEAM_FREQUENCY_COLORS],
  };

  return page.evaluate(`
    (() => {
      const fixture = ${JSON.stringify(fixture)};
      function hexToRgbLocal(hex) {
        const normalized = hex.replace('#', '');
        return {
          r: Number.parseInt(normalized.slice(0, 2), 16),
          g: Number.parseInt(normalized.slice(2, 4), 16),
          b: Number.parseInt(normalized.slice(4, 6), 16),
        };
      }
      function linearizeLocal(value) {
        const normalized = value / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      }
      function labLocal(rgb) {
        const r = linearizeLocal(rgb.r);
        const g = linearizeLocal(rgb.g);
        const b = linearizeLocal(rgb.b);
        let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
        let y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.0;
        let z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
        const f = value => (value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116);
        x = f(x);
        y = f(y);
        z = f(z);
        return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
      }
      function deltaLocal(a, b) {
        const left = labLocal(a);
        const right = labLocal(b);
        return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2]);
      }
      function additiveBlendLocal(backgroundHex, foregroundHex, opacity) {
        const background = hexToRgbLocal(backgroundHex);
        const foreground = hexToRgbLocal(foregroundHex);
        return {
          r: Math.min(255, Math.round(background.r + foreground.r * opacity)),
          g: Math.min(255, Math.round(background.g + foreground.g * opacity)),
          b: Math.min(255, Math.round(background.b + foreground.b * opacity)),
        };
      }
      function pixelAt(data, width, x, y) {
        const index = (Math.round(y) * width + Math.round(x)) * 4;
        return { r: data[index], g: data[index + 1], b: data[index + 2] };
      }
      function nearestDelta(data, target, background) {
        let bestDelta = Infinity;
        let bestPixel = background;
        for (let index = 0; index < data.length; index += 4) {
          const pixel = { r: data[index], g: data[index + 1], b: data[index + 2] };
          if (deltaLocal(pixel, background) < 3) continue;
          const nextDelta = deltaLocal(pixel, target);
          if (nextDelta < bestDelta) {
            bestDelta = nextDelta;
            bestPixel = pixel;
          }
        }
        return { bestDelta, bestPixel };
      }

      const source = document.querySelector('canvas');
      if (!(source instanceof HTMLCanvasElement)) throw new Error('vc3a canvas was not rendered');
      const sampleCanvas = document.createElement('canvas');
      sampleCanvas.width = source.width;
      sampleCanvas.height = source.height;
      const context = sampleCanvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('could not allocate 2D canvas for vc3a pixel sample');
      context.drawImage(source, 0, 0);
      const data = context.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height).data;
      const background = hexToRgbLocal(fixture.samplePlan.backgroundColor);
      const fillTarget = additiveBlendLocal(
        fixture.samplePlan.backgroundColor,
        fixture.expected.fillColor,
        fixture.expected.fillOpacity,
      );
      const outerTarget = hexToRgbLocal(fixture.expected.outerBorderColor);
      const innerTarget = hexToRgbLocal(fixture.expected.innerRoleBorderColor);
      const center = { x: sampleCanvas.width / 2, y: sampleCanvas.height / 2 };
      const centerPixels = [
        pixelAt(data, sampleCanvas.width, center.x, center.y),
        pixelAt(data, sampleCanvas.width, center.x - 1, center.y),
        pixelAt(data, sampleCanvas.width, center.x + 1, center.y),
        pixelAt(data, sampleCanvas.width, center.x, center.y - 1),
        pixelAt(data, sampleCanvas.width, center.x, center.y + 1),
      ];
      const centerFillDeltaE = Math.min(...centerPixels.map(pixel => deltaLocal(pixel, fillTarget)));
      const fill = nearestDelta(data, fillTarget, background);
      const outer = nearestDelta(data, outerTarget, background);
      const inner = nearestDelta(data, innerTarget, background);
      const roleTargets = fixture.roleColors.map(hexToRgbLocal);
      const frequencyTargets = fixture.frequencyColors.map(hexToRgbLocal);
      const outerBorderNearestRoleDeltaE = Math.min(...roleTargets.map(target => deltaLocal(outer.bestPixel, target)));
      const outerBorderNearestFrequencyDeltaE = Math.min(...frequencyTargets.map(target => deltaLocal(outer.bestPixel, target)));
      let nonBackgroundPixels = 0;
      for (let index = 0; index < data.length; index += 4) {
        const pixel = { r: data[index], g: data[index + 1], b: data[index + 2] };
        if (deltaLocal(pixel, background) >= 3) nonBackgroundPixels += 1;
      }
      return {
        nonBackgroundPixels,
        centerFillDeltaE,
        fillDeltaE: fill.bestDelta,
        outerBorderDeltaE: outer.bestDelta,
        innerBorderDeltaE: inner.bestDelta,
        fillBestPixel: fill.bestPixel,
        outerBestPixel: outer.bestPixel,
        innerBestPixel: inner.bestPixel,
        outerBorderNearestRoleDeltaE,
        outerBorderNearestFrequencyDeltaE,
      };
    })()
  `);
}

type Vc3CanvasPixelSample = Awaited<ReturnType<typeof sampleVc3Canvas>>;

function vc3PixelSamplePasses(pixel: Vc3CanvasPixelSample): boolean {
  return pixel.nonBackgroundPixels > 500
    && pixel.fillDeltaE <= 20
    && pixel.outerBorderDeltaE <= 8
    && pixel.innerBorderDeltaE <= 8
    && pixel.outerBorderNearestRoleDeltaE >= 15
    && pixel.outerBorderNearestFrequencyDeltaE >= 15;
}

async function waitForVc3CanvasSample(
  page: Page,
  result: Vc3BrowserFixtureResult,
): Promise<Vc3CanvasPixelSample> {
  let lastPixel: Vc3CanvasPixelSample | null = null;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (attempt > 0) await page.waitForTimeout(150);
    lastPixel = await sampleVc3Canvas(page, result);
    if (vc3PixelSamplePasses(lastPixel)) return lastPixel;
  }

  assert.ok(lastPixel, 'Phase 3A pixel sampler did not return a canvas sample');
  return lastPixel;
}

async function assertBrowserFixture(
  browser: Browser,
  appUrl: string,
): Promise<{ appUrl: string; pixel: Vc3CanvasPixelSample; fixture: Vc3BrowserFixtureResult }> {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  try {
    await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
    await installVc3Fixture(page);
    const result = await page.evaluate(async () => window.__renderVc3HexPaintFixture()) as Vc3BrowserFixtureResult;
    await page.locator('canvas').waitFor({ timeout: 5000 });
    await page.waitForTimeout(500);
    const pixel = await waitForVc3CanvasSample(page, result);

    assert.equal(result.canvasReady, true, 'Phase 3A browser fixture did not report a canvas');
    assert.equal(result.cells[0].coveringBeamKey, result.expected.dominantBeamKey, 'fixture cell covered wrong beam');
    assert.equal(result.cells[0].outerBorderColor, result.expected.outerBorderColor);
    assert.equal(result.cells[0].fillColor, result.expected.fillColor);
    assert.equal(result.cells[0].innerRoleBorderColor, result.expected.innerRoleBorderColor);
    assert.ok(pixel.nonBackgroundPixels > 500, 'Phase 3A fixture canvas looked blank');
    assert.ok(
      pixel.fillDeltaE <= 20,
      `cell.fill sample deltaE ${pixel.fillDeltaE.toFixed(2)} exceeded blended-frequency tolerance (center ${pixel.centerFillDeltaE.toFixed(2)})`,
    );
    assert.ok(
      pixel.outerBorderDeltaE <= 8,
      `cell.outerBorder sample deltaE ${pixel.outerBorderDeltaE.toFixed(2)} exceeded satellite-tint tolerance; best=${JSON.stringify(pixel.outerBestPixel)} expected=${result.expected.outerBorderColor}`,
    );
    assert.ok(
      pixel.innerBorderDeltaE <= 8,
      `cell.innerRoleBorder sample deltaE ${pixel.innerBorderDeltaE.toFixed(2)} exceeded role-color tolerance; best=${JSON.stringify(pixel.innerBestPixel)} expected=${result.expected.innerRoleBorderColor}`,
    );
    assert.ok(
      pixel.outerBorderNearestRoleDeltaE >= 15,
      `cell.outerBorder pixel was too close to a role color: ${pixel.outerBorderNearestRoleDeltaE.toFixed(2)}`,
    );
    assert.ok(
      pixel.outerBorderNearestFrequencyDeltaE >= 15,
      `cell.outerBorder pixel was too close to a frequency color: ${pixel.outerBorderNearestFrequencyDeltaE.toFixed(2)}`,
    );

    return { appUrl, pixel, fixture: result };
  } finally {
    await page.close().catch(() => {});
  }
}

async function captureManualCheckpoint(browser: Browser, appUrl: string): Promise<string> {
  await mkdir(dirname(CHECKPOINT_PATH), { recursive: true });
  const page = await bootDeterministicPage({ chromium }, {
    url: appUrl,
    browser,
    seed: 3301,
    rafMs: 1800,
    viewport: { width: 1440, height: 900 },
  });

  try {
    await page.evaluate(() => document.fonts?.ready);
    await page.waitForTimeout(300);
    await page.screenshot({ path: CHECKPOINT_PATH });
    return CHECKPOINT_PATH;
  } finally {
    await page.context().close().catch(() => {});
  }
}

async function main(): Promise<void> {
  assertCoverMapSelection();
  assertHysteresis();
  assertForbiddenCrossUseSourceInvariant();

  const appUrl = await detectAppUrl();
  const browser = await chromium.launch();
  let browserFixture: Awaited<ReturnType<typeof assertBrowserFixture>>;
  let checkpointPath: string;

  try {
    browserFixture = await assertBrowserFixture(browser, appUrl);
    checkpointPath = await captureManualCheckpoint(browser, appUrl);
  } finally {
    await browser.close();
  }

  console.log('Visual Clarity Phase 3A hex-paint validation passed.');
  console.log(JSON.stringify({
    v2: {
      coverPriority: 'passed',
      sameRoleSinrTieBreak: 'passed',
      hysteresis: 'passed',
      forbiddenCrossUseSourceInvariant: 'passed',
    },
    v3: {
      appUrl: browserFixture.appUrl,
      pixel: browserFixture.pixel,
      dominantBeamKey: browserFixture.fixture.expected.dominantBeamKey,
      manualScreenshotCheckpoint: checkpointPath,
    },
    result: 'PASS',
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
