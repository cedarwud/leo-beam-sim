import { chromium } from 'playwright';

const read = async page => page.evaluate(() => {
  const c = document.querySelector('canvas');
  const rail = document.querySelector('[data-testid="handover-teaching-rail"]');
  return {
    phase: rail?.getAttribute('data-teaching-phase') ?? '(none)',
    elapsed: rail?.getAttribute('data-teaching-elapsed-sec') ?? '',
    teaching: c?.dataset.handoverTeachingConeGeometry ?? '(none)',
    live: c?.dataset.liveServingConeGeometry ?? '(none)',
    teachingCount: c?.dataset.handoverTeachingConeRenderedCount ?? '-',
    liveCount: c?.dataset.sinrLiveCellBeamConeRenderedCount ?? '-',
  };
});

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
page.on('pageerror', e => console.log('PAGEERROR', e.message));

await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(16000);
const baseline = await read(page);
console.log('=== NO LECTURE (live serving cones) ===');
console.log('liveCones =', baseline.liveCount);
console.log('LIVE GEOM :', baseline.live);
await page.screenshot({ path: 'geom-live-nolecture.png' });

for (const kind of ['intra', 'inter']) {
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);
  const preLive = await read(page);
  await page.click(`[data-testid="director-${kind}-focus"]`);
  await page.waitForSelector('[data-testid="handover-teaching-rail"]', { timeout: 15000 });
  await page.waitForTimeout(3000);
  const early = await read(page);
  console.log(`\n=== ${kind.toUpperCase()} ===`);
  console.log('live geom just before opening the lecture :', preLive.live);
  console.log(`first beat (phase=${early.phase} t=${early.elapsed}) TEACHING GEOM: ${early.teaching}`);
  await page.screenshot({ path: `geom-${kind}-early.png` });
  for (let i = 0; i < 30; i += 1) {
    const s = await read(page);
    if (s.phase === 'switching' && Number(s.elapsed) > 49) {
      console.log(`switching  (t=${s.elapsed}) TEACHING GEOM: ${s.teaching}`);
      await page.screenshot({ path: `geom-${kind}-switching.png` });
      break;
    }
    await page.waitForTimeout(2500);
  }
}
await browser.close();
