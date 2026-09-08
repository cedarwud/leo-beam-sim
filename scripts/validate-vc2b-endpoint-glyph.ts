import assert from 'node:assert/strict';
import {
  SATELLITE_GLYPH_LIBRARY,
  createGlyphOutlinePoints,
  glyphSymbolForKind,
  satelliteGlyph,
} from '../src/viz/glyphs.ts';
import { satelliteTintIndex } from '../src/constants/beamRoleTokens.ts';
import { assertCanvasNonBlank, sampleCanvas, withVc2Browser } from './_vc2-browser-fixture.ts';
import { MEASURED_BROWSER_GATE_FLOORS_MS, runBrowserValidator } from './lib/browser-gate.ts';

function assertGlyphMapping(): void {
  const satIds = ['shell-pro-53-P0-S0', 'shell-pro-53-P0-S1', 'shell-pro-53-P0-S2', 'shell-pro-53-P0-S3'];
  const libraryKinds = new Set(SATELLITE_GLYPH_LIBRARY.map(entry => entry.kind));
  for (const satId of satIds) {
    // S2: the glyph derives from the satId-stable visual index, INVARIANT to
    // display order (collisions into the glyph library are acceptable — the
    // retired behaviour mapped display-order 0..3 onto the library in order).
    const glyph = satelliteGlyph(satelliteTintIndex(satId));
    assert.ok(libraryKinds.has(glyph), `${satId} glyph ${glyph} is not a SATELLITE_GLYPH_LIBRARY kind`);
    for (const displayOrder of [0, 3, 50]) {
      assert.equal(
        satelliteGlyph(satelliteTintIndex(satId, displayOrder)),
        glyph,
        `${satId} glyph churned with display order ${displayOrder}`,
      );
    }
  }
}

function assertShapeDistinctness(): void {
  const signatures = SATELLITE_GLYPH_LIBRARY.map(entry => {
    const points = createGlyphOutlinePoints(entry.kind, 12);
    const xs = points.map(point => point[0]);
    const ys = points.map(point => point[1]);
    return {
      kind: entry.kind,
      symbol: glyphSymbolForKind(entry.kind),
      pointCount: points.length,
      width: Math.round(Math.max(...xs) - Math.min(...xs)),
      height: Math.round(Math.max(...ys) - Math.min(...ys)),
    };
  });
  const uniqueSignatures = new Set(signatures.map(signature =>
    `${signature.pointCount}:${signature.width}:${signature.height}:${signature.symbol}`,
  ));

  assert.equal(uniqueSignatures.size, SATELLITE_GLYPH_LIBRARY.length, 'endpoint glyph silhouettes are not pairwise distinct');
}

async function assertBrowserFixture() {
  return withVc2Browser(async page => {
    const result = await page.evaluate(async () => window.__renderVc2NonTextChannelsFixture());
    const sample = await sampleCanvas(page);
    assertCanvasNonBlank(sample, 'Phase 2B');

    const expectedSymbols = SATELLITE_GLYPH_LIBRARY.map(entry => entry.symbol).join('');
    // S2: the inline CALLOUT glyphs follow the fixture's satId-stable visual
    // index (a permutation of the library), so assert the SET. The fallback
    // probe renders SATELLITE_GLYPH_LIBRARY in order and is S2-INVARIANT — keep
    // its exact-order check.
    const symbolSet = (text: string): string => [...text].sort().join('');
    assert.equal(symbolSet(result.inlineGlyphText), symbolSet(expectedSymbols), 'callout inline glyph echo did not render all four symbols');
    assert.equal(result.fallbackGlyphText, expectedSymbols, 'font fallback fixture did not render all four glyph symbols in library order');

    const fallbackStyle = await page.locator('[data-testid="vc2-glyph-fallback-probe"]').evaluate(element => {
      const style = getComputedStyle(element);
      return {
        fontFamily: style.fontFamily,
        fontFeatureSettings: style.fontFeatureSettings,
      };
    });
    assert.match(fallbackStyle.fontFamily, /monospace/i, 'glyph fallback fixture did not retain monospace fallback');
    assert.notEqual(fallbackStyle.fontFeatureSettings, 'normal', 'glyph fallback fixture did not disable ligatures');

    for (const beam of result.beams) {
      assert.equal(
        beam.satelliteGlyph,
        satelliteGlyph(beam.satelliteVisualIndex),
        `${beam.satId} glyph did not match the Phase 2A visual index`,
      );
      assert.equal(
        beam.satelliteGlyphSymbol,
        glyphSymbolForKind(beam.satelliteGlyph),
        `${beam.satId} inline glyph symbol mismatch`,
      );
    }

    return {
      sample,
      inlineGlyphText: result.inlineGlyphText,
      fallbackGlyphText: result.fallbackGlyphText,
      fixtureBeams: result.beams.map(beam => ({
        satId: beam.satId,
        glyph: beam.satelliteGlyph,
        symbol: beam.satelliteGlyphSymbol,
      })),
    };
  });
}

async function main(): Promise<void> {
  assertGlyphMapping();
  assertShapeDistinctness();
  const browser = await assertBrowserFixture();

  console.log('Visual Clarity Phase 2B endpoint-glyph validation passed.');
  console.log(JSON.stringify({
    v1: {
      glyphMapping: 'passed',
      shapeDistinctness: 'passed',
    },
    v3: browser,
    result: 'PASS',
  }, null, 2));
}

void runBrowserValidator(
  {
    validator: 'validate-vc2b-endpoint-glyph',
    appUrl: process.env.APP_URL ?? process.argv[2],
    floorMs: MEASURED_BROWSER_GATE_FLOORS_MS.quickCanvas,
  },
  async () => main(),
).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
