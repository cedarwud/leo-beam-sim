import { chromium } from 'playwright';

const kind = process.argv[2] ?? 'inter';
const read = async page => page.evaluate(() => {
  const c = document.querySelector('canvas');
  const rail = document.querySelector('[data-testid="handover-teaching-rail"]');
  return {
    phase: rail?.getAttribute('data-teaching-phase') ?? '(none)',
    elapsed: rail?.getAttribute('data-teaching-elapsed-sec') ?? '',
    geom: c?.dataset.handoverTeachingConeGeometry ?? '(none)',
    cones: c?.dataset.handoverTeachingConeRenderedCount ?? '-',
    hexes: c?.dataset.handoverTeachingFootprintRenderedCount ?? '-',
    labels: [...document.querySelectorAll('canvas')].length,
  };
});
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
page.on('pageerror', e => console.log('PAGEERROR', e.message));
await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(8000);
await page.click(`[data-testid="director-${kind}-focus"]`);
await page.waitForSelector('[data-testid="handover-teaching-rail"]', { timeout: 15000 });
await page.waitForTimeout(20000);
const mid = await read(page);
console.log(`EARLY  phase=${mid.phase} t=${mid.elapsed} cones=${mid.cones} hexes=${mid.hexes}`);
console.log(`  GEOM: ${mid.geom}`);
await page.screenshot({ path: `look-${kind}-early.png` });
for (let i = 0; i < 20; i += 1) {
  const s = await read(page);
  if (s.phase === 'switching' && Number(s.elapsed) > 49) {
    console.log(`SWITCH phase=${s.phase} t=${s.elapsed} cones=${s.cones} hexes=${s.hexes}`);
    console.log(`  GEOM: ${s.geom}`);
    await page.screenshot({ path: `look-${kind}-switching.png` });
    break;
  }
  await page.waitForTimeout(2500);
}
await browser.close();
