import { chromium } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5173/';
const TIMEOUT_MS = 120_000;
const SAMPLE_SEC = [0, 1.0, 2.0, 3.0, 4.5, 6.0, 6.5];

async function readArrow(page) {
  return await page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (!c) return { active: null, opacity: null };
    return {
      active: c.dataset.intraHandoverArrowActive ?? null,
      opacity: c.dataset.intraHandoverArrowOpacity ?? null,
    };
  });
}

async function main() {
  const browser = await chromium.launch({
    args: ['--disable-dev-shm-usage', '--use-angle=swiftshader-webgl'],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on('console', m => console.log('[browser]', m.type(), m.text()));
  page.on('pageerror', e => console.log('[browser-error]', e.message));

  await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForSelector('canvas', { timeout: 30_000 });

  // Set speed = 20 via the range input
  const slider = page.locator('input[type="range"]').first();
  await slider.evaluate((el, v) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, String(v));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, 20);
  console.log('speed set to 20x');

  // Wait for natural intra-HO event
  const deadline = Date.now() + TIMEOUT_MS;
  let firstActiveAt = null;
  while (Date.now() < deadline) {
    const t = await readArrow(page);
    if (t.active === '1' && t.opacity !== null && Number(t.opacity) > 0.5) {
      firstActiveAt = performance.now();
      console.log(`intra-HO active at t=0, opacity=${t.opacity}`);
      break;
    }
    await new Promise(r => setTimeout(r, 50));
  }
  if (firstActiveAt === null) {
    console.error('TIMEOUT: no intra-HO event seen in', TIMEOUT_MS / 1000, 's');
    await browser.close();
    process.exit(2);
  }

  const samples = [];
  for (const targetSec of SAMPLE_SEC) {
    const targetMs = firstActiveAt + targetSec * 1000;
    while (performance.now() < targetMs) await new Promise(r => setTimeout(r, 5));
    const t = await readArrow(page);
    const elapsedSec = (performance.now() - firstActiveAt) / 1000;
    samples.push({ targetSec, elapsedSec: +elapsedSec.toFixed(3), active: t.active, opacity: t.opacity });
    console.log(`t=${targetSec.toFixed(1)}s (actual ${elapsedSec.toFixed(3)}s): active=${t.active} opacity=${t.opacity}`);
  }

  console.log('\n=== RESULT ===');
  console.log(JSON.stringify(samples, null, 2));

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
