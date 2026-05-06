import assert from 'node:assert/strict';
import { chromium, type Browser, type Page } from '@playwright/test';

export interface CanvasSample {
  width: number;
  height: number;
  nonBackgroundPixels: number;
}

export async function detectAppUrl(): Promise<string> {
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

export async function installVc2Fixture(page: Page): Promise<void> {
  await page.addScriptTag({
    type: 'module',
    content: `
      import { renderVc2NonTextChannelsFixture } from '/src/validation/vc2NonTextChannelsFixture.tsx';
      window.__renderVc2NonTextChannelsFixture = renderVc2NonTextChannelsFixture;
    `,
  });
  await page.waitForFunction(() => typeof window.__renderVc2NonTextChannelsFixture === 'function');
}

export async function sampleCanvas(page: Page): Promise<CanvasSample> {
  return page.evaluate(async () => {
    const source = document.querySelector('canvas');
    if (!(source instanceof HTMLCanvasElement)) throw new Error('vc2 canvas was not rendered');

    const image = new Image();
    image.src = source.toDataURL('image/png');
    await image.decode();

    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('could not allocate 2D canvas for vc2 pixel sample');
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

export async function withVc2Browser<T>(
  fn: (page: Page, appUrl: string) => Promise<T>,
): Promise<T & { appUrl: string }> {
  const appUrl = await detectAppUrl();
  const browser: Browser = await chromium.launch();

  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 720 } });
    await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
    await installVc2Fixture(page);
    const result = await fn(page, appUrl);
    await page.close();
    return { ...result, appUrl };
  } finally {
    await browser.close();
  }
}

export function assertCanvasNonBlank(sample: CanvasSample, label: string): void {
  assert.ok(sample.nonBackgroundPixels > 250, `${label} canvas sample looked blank`);
}
