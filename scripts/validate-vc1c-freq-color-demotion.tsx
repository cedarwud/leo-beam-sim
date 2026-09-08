import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { chromium, type Browser, type Page } from '@playwright/test';
import { DEFAULT_BROWSER_GATE_FLOOR_MS, runBrowserValidator } from './lib/browser-gate.ts';
import {
  BEAM_FREQUENCY_COLORS,
  BEAM_ROLE_TOKENS,
  frequencyReuseColor,
  resolveBeamVisualEncoding,
  type BeamCodeRole,
  type BeamVisualRole,
} from '../src/constants/beamRoleTokens.ts';
import { BeamCalloutContent, type BeamTarget } from '../src/viz/SatelliteBeams.tsx';

type FixtureRole = 'serving' | 'pending' | 'approach' | 'recentSource' | 'otherActive';

interface RoleFixture {
  name: FixtureRole;
  codeRole?: BeamCodeRole;
  visualRole: BeamVisualRole;
  isServing: boolean;
  isPrimary: boolean;
  beamId: number;
  frequencyIndex: number;
}

interface BrowserFixtureResult {
  visualRole: BeamVisualRole;
  roleSurfaceColor: string;
  discFillColor: string;
  discOpacity: number;
  frequencySwatchColor: string;
  operatorLabel: string | null;
  canvasReady: boolean;
}

interface CanvasSample {
  width: number;
  height: number;
  nonBackgroundPixels: number;
}

const fixtures: RoleFixture[] = [
  {
    name: 'serving',
    codeRole: 'serving',
    visualRole: 'serving',
    isServing: true,
    isPrimary: true,
    beamId: 5,
    frequencyIndex: 1,
  },
  {
    name: 'pending',
    codeRole: 'prepared',
    visualRole: 'pending',
    isServing: false,
    isPrimary: true,
    beamId: 5,
    frequencyIndex: 1,
  },
  {
    name: 'approach',
    codeRole: 'approach',
    visualRole: 'approach',
    isServing: false,
    isPrimary: true,
    beamId: 5,
    frequencyIndex: 1,
  },
  {
    name: 'recentSource',
    codeRole: 'secondary',
    visualRole: 'recentSource',
    isServing: false,
    isPrimary: true,
    beamId: 5,
    frequencyIndex: 1,
  },
  {
    name: 'otherActive',
    visualRole: 'otherActive',
    isServing: false,
    isPrimary: false,
    beamId: 5,
    frequencyIndex: 1,
  },
];

function normalizeColor(color: string): string {
  return color.trim().toLowerCase();
}

function assertNotFrequencyColor(color: string, message: string): void {
  const normalized = normalizeColor(color);
  for (const frequencyColor of BEAM_FREQUENCY_COLORS) {
    assert.notEqual(normalized, normalizeColor(frequencyColor), message);
  }
}

function assertEncodingInvariants(): void {
  for (const fixture of fixtures) {
    const frequencyColor = frequencyReuseColor(fixture.frequencyIndex);
    const encoding = resolveBeamVisualEncoding({
      role: fixture.codeRole,
      isPrimary: fixture.isPrimary,
      isServing: fixture.isServing,
      isScheduledActive: true,
      frequencyColor,
    });

    assert.equal(encoding.visualRole, fixture.visualRole, `${fixture.name} resolved to the wrong visual role`);
    assert.equal(
      encoding.frequencySwatchColor,
      frequencyColor,
      `${fixture.name} did not retain the T3 frequency swatch color`,
    );

    if (fixture.visualRole === 'otherActive') {
      assert.equal(encoding.color, frequencyColor, 'otherActive cone/spine/endpoint should keep frequency color');
      assert.equal(encoding.discOpacity, BEAM_ROLE_TOKENS.otherActive.discOpacity);
      continue;
    }

    assert.equal(
      encoding.color,
      BEAM_ROLE_TOKENS[fixture.visualRole].color,
      `${fixture.name} role-owned surfaces should use role color`,
    );
    assertNotFrequencyColor(
      encoding.color,
      `${fixture.name} role-owned surfaces must not use a frequency palette entry`,
    );
    assert.ok(
      encoding.discOpacity <= 0.32,
      `${fixture.name} disc opacity ${encoding.discOpacity} exceeded the role-dominant visibility cap`,
    );
  }
}

function decodeHtmlText(markup: string): string {
  return markup
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractAttr(markup: string, attr: string): string {
  const match = markup.match(new RegExp(`${attr}="([^"]*)"`));
  assert.ok(match, `expected rendered markup to include ${attr}`);
  return match[1];
}

function assertCalloutSwatchMarkup(): void {
  for (const fixture of fixtures) {
    const frequencyColor = frequencyReuseColor(fixture.frequencyIndex);
    const encoding = resolveBeamVisualEncoding({
      role: fixture.codeRole,
      isPrimary: fixture.isPrimary,
      isServing: fixture.isServing,
      isScheduledActive: true,
      frequencyColor,
    });
    const beam: Pick<BeamTarget, 'beamId' | 'frequencyIndex'> = {
      beamId: fixture.beamId,
      frequencyIndex: fixture.frequencyIndex,
    };
    const markup = renderToStaticMarkup(
      <BeamCalloutContent
        satelliteId="shell-pro-53-P0-S3"
        beam={beam}
        style={encoding}
        color={encoding.color}
        sinrLabel="18.4 dB"
        isEmphasized={encoding.isEmphasized}
      />,
    );
    const text = decodeHtmlText(markup);

    assert.ok(text.includes('F2 B5'), `${fixture.name} callout dropped the F2 B5 token: ${text}`);
    if (fixture.visualRole === 'otherActive') {
      assert.ok(
        !markup.includes('data-testid="beam-callout-frequency-swatch"'),
        'otherActive callout should not add the event-role frequency swatch',
      );
      continue;
    }

    assert.ok(
      markup.includes('data-testid="beam-callout-frequency-swatch"'),
      `${fixture.name} callout did not render the frequency swatch`,
    );
    assert.equal(
      extractAttr(markup, 'data-frequency-swatch-color'),
      frequencyColor,
      `${fixture.name} callout swatch did not use the matching frequency color`,
    );
  }
}

async function detectAppUrl(): Promise<string> {
  const explicit = process.env.APP_URL ?? process.argv[2];
  const candidates = explicit
    ? [explicit]
    : [
      'http://127.0.0.1:3000',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:4173',
      'http://127.0.0.1:4174',
    ];

  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate);
      if (!response.ok) continue;
      const html = await response.text();
      if (html.includes('<title>LEO Beam Sim</title>') || html.includes('/src/main')) return candidate;
    } catch {
      // Try next candidate.
    }
  }

  throw new Error(`Could not find a running LEO Beam Sim dev server. Tried: ${candidates.join(', ')}`);
}

async function installBrowserFixture(page: Page): Promise<void> {
  await page.addScriptTag({
    type: 'module',
    content: `
      import { renderVc1cFrequencyDemotionFixture } from '/src/validation/vc1cFrequencyDemotionFixture.tsx';
      window.__renderVc1cFrequencyDemotionFixture = renderVc1cFrequencyDemotionFixture;
    `,
  });
  await page.waitForFunction(() => typeof window.__renderVc1cFrequencyDemotionFixture === 'function');
}

async function sampleCanvas(page: Page): Promise<CanvasSample> {
  return page.evaluate(async () => {
    const source = document.querySelector('canvas');
    if (!(source instanceof HTMLCanvasElement)) throw new Error('vc1c canvas was not rendered');

    const image = new Image();
    image.src = source.toDataURL('image/png');
    await image.decode();

    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('could not allocate 2D canvas for vc1c pixel sample');
    context.drawImage(image, 0, 0);

    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let nonBackgroundPixels = 0;
    for (let index = 0; index < data.length; index += 4) {
      const dr = Math.abs(data[index] - 2);
      const dg = Math.abs(data[index + 1] - 9);
      const db = Math.abs(data[index + 2] - 18);
      if (dr + dg + db > 18) nonBackgroundPixels += 1;
    }

    return {
      width: canvas.width,
      height: canvas.height,
      nonBackgroundPixels,
    };
  });
}

async function assertBrowserFixture(
  page: Page,
  fixture: RoleFixture,
): Promise<{ fixture: FixtureRole; swatchVisible: boolean; sample: CanvasSample }> {
  const result = await page.evaluate(
    async input => window.__renderVc1cFrequencyDemotionFixture(input),
    {
      role: fixture.name,
      beamId: fixture.beamId,
      frequencyIndex: fixture.frequencyIndex,
    },
  ) as BrowserFixtureResult;
  const frequencyColor = frequencyReuseColor(fixture.frequencyIndex);
  await page.locator('canvas').waitFor({ timeout: 5000 });
  const sample = await sampleCanvas(page);

  assert.equal(result.canvasReady, true, `${fixture.name} browser fixture did not report a rendered canvas`);
  assert.equal(result.visualRole, fixture.visualRole, `${fixture.name} browser fixture resolved the wrong visual role`);
  assert.ok(sample.nonBackgroundPixels > 150, `${fixture.name} canvas sample looked blank`);

  if (fixture.visualRole === 'otherActive') {
    assert.equal(result.roleSurfaceColor, frequencyColor, 'otherActive browser fixture did not keep frequency on role surfaces');
    assert.equal(result.discFillColor, frequencyColor, 'otherActive browser fixture did not keep frequency on disc.fill');
    assert.equal(
      await page.locator('[data-testid="beam-callout-frequency-swatch"]').count(),
      0,
      'otherActive browser fixture unexpectedly rendered the event-role frequency swatch',
    );
    return { fixture: fixture.name, swatchVisible: false, sample };
  }

  assert.equal(
    result.roleSurfaceColor,
    BEAM_ROLE_TOKENS[fixture.visualRole].color,
    `${fixture.name} browser fixture did not keep cone/spine/endpoint on role color`,
  );
  assertNotFrequencyColor(
    result.roleSurfaceColor,
    `${fixture.name} browser fixture leaked frequency color into role-owned surfaces`,
  );
  assert.equal(
    result.discFillColor,
    BEAM_ROLE_TOKENS[fixture.visualRole].color,
    `${fixture.name} browser fixture did not keep disc.fill on role color`,
  );
  assert.ok(result.discOpacity <= 0.32, `${fixture.name} browser fixture exceeded role-dominant disc opacity cap`);
  assert.equal(result.frequencySwatchColor, frequencyColor, `${fixture.name} browser fixture swatch color mismatch`);

  const swatch = page.locator('[data-testid="vc1c-callout-probe"] [data-testid="beam-callout-frequency-swatch"]');
  await swatch.waitFor({ state: 'attached', timeout: 5000 });
  const swatchBox = await swatch.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      width: rect.width || Number.parseFloat(style.width),
      height: rect.height || Number.parseFloat(style.height),
      backgroundColor: style.backgroundColor,
    };
  });
  assert.ok(swatchBox.width >= 7 && swatchBox.width <= 9, `${fixture.name} swatch width was ${swatchBox.width}`);
  assert.ok(swatchBox.height >= 7 && swatchBox.height <= 9, `${fixture.name} swatch height was ${swatchBox.height}`);
  assert.notEqual(swatchBox.backgroundColor, 'rgba(0, 0, 0, 0)', `${fixture.name} swatch background was transparent`);

  return { fixture: fixture.name, swatchVisible: true, sample };
}

async function assertBrowserFixtures(): Promise<{
  appUrl: string;
  fixtures: Array<{ fixture: FixtureRole; swatchVisible: boolean; sample: CanvasSample }>;
}> {
  const appUrl = await detectAppUrl();
  const browser: Browser = await chromium.launch();

  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
    await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
    await installBrowserFixture(page);
    const results = [];
    for (const fixture of fixtures) {
      results.push(await assertBrowserFixture(page, fixture));
    }
    await page.close();
    return { appUrl, fixtures: results };
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  assertEncodingInvariants();
  assertCalloutSwatchMarkup();
  const browser = await assertBrowserFixtures();

  console.log('Visual Clarity Phase 1C frequency-color demotion validation passed.');
  console.log(JSON.stringify({
    v1: {
      eventRoleSurfaces: 'role color',
      eventRoleDiscFill: 'role color capped <= 0.32 opacity',
      otherActiveSurfaces: 'frequency color retained',
    },
    v2: {
      calloutText: 'F2 B5 retained',
      eventRoleFrequencySwatch: 'rendered',
    },
    v3: browser,
    result: 'PASS',
  }, null, 2));
}

void runBrowserValidator(
  {
    validator: 'validate-vc1c-freq-color-demotion',
    appUrl: process.env.APP_URL ?? process.argv[2],
    floorMs: DEFAULT_BROWSER_GATE_FLOOR_MS,
  },
  async () => main(),
).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
