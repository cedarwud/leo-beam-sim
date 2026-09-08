import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { MEASURED_BROWSER_GATE_FLOORS_MS, runBrowserValidator } from './lib/browser-gate.ts';

const BASE_URL = process.env.APP_URL ?? 'http://127.0.0.1:3000';
const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
] as const;

async function main(): Promise<void> {
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-crashpad', '--disable-breakpad'],
});

try {
  for (const viewport of VIEWPORTS) {
    const page = await browser.newPage({ viewport });
    await page.goto(new URL('/', BASE_URL).toString(), { waitUntil: 'domcontentloaded' });
    const tabs = page.locator('[data-testid="sinr-formula-tabs"] [role="tab"]');
    await tabs.first().waitFor({ state: 'visible', timeout: 30_000 });

    const result = await tabs.evaluateAll((elements) => {
      const items = elements.map((element) => {
        const box = element.getBoundingClientRect();
        const symbol = element.querySelector<HTMLElement>('[data-formula-tab-symbol]');
        if (!symbol) throw new Error('formula tab is missing its visible symbol');
        const content = symbol.getBoundingClientRect();
        return {
          label: element.getAttribute('aria-label') ?? element.textContent?.trim() ?? '',
          box: { left: box.left, right: box.right, top: box.top, bottom: box.bottom },
          content: { left: content.left, right: content.right, top: content.top, bottom: content.bottom },
          scrollWidth: symbol.scrollWidth,
          clientWidth: symbol.clientWidth,
        };
      });
      const escaped = items.filter(item => (
        item.content.left < item.box.left - 0.5
        || item.content.right > item.box.right + 0.5
        || item.scrollWidth > item.clientWidth + 1
      ));
      const overlaps: Array<readonly [string, string]> = [];
      for (let leftIndex = 0; leftIndex < items.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < items.length; rightIndex += 1) {
          const left = items[leftIndex]!;
          const right = items[rightIndex]!;
          if (
            left.content.left < right.content.right
            && left.content.right > right.content.left
            && left.content.top < right.content.bottom
            && left.content.bottom > right.content.top
          ) overlaps.push([left.label, right.label]);
        }
      }
      return { escaped: escaped.map(item => item.label), overlaps };
    });

    assert.deepEqual(result.escaped, [], `${viewport.width}x${viewport.height}: formula content escaped its tab`);
    assert.deepEqual(result.overlaps, [], `${viewport.width}x${viewport.height}: formula terms overlapped`);
    await page.screenshot({
      path: `output/playwright/home-walker-sinr-layout-${viewport.width}x${viewport.height}.png`,
      fullPage: false,
    });
    await page.close();
  }
  console.log('[homepage-sinr-formula-layout-browser] PASS — formula terms stay contained at 1440x900 and 1280x720');
} finally {
  await browser.close();
}
}

await runBrowserValidator(
  {
    validator: 'validate-homepage-sinr-formula-layout-browser',
    appUrl: BASE_URL,
    floorMs: MEASURED_BROWSER_GATE_FLOORS_MS.layout,
  },
  async () => main(),
);
