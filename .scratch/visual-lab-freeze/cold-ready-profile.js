async (page) => {
  page.setDefaultTimeout(120000);
  page.setDefaultNavigationTimeout(120000);
  await page.addInitScript(() => {
    window.__vlabLongTasks = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__vlabLongTasks.push({ start: entry.startTime, duration: entry.duration });
    }).observe({ type: 'longtask', buffered: true });
  });
  const started = Date.now();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '多波束低軌衛星節能實驗室' }).waitFor();
  const headingMs = Date.now() - started;
  await page.getByText('全球軌道 · 真實 TLE / SGP4', { exact: true }).waitFor();
  const readyMs = Date.now() - started;
  const longTasks = await page.evaluate(() => window.__vlabLongTasks ?? []);
  const strip = page.getByRole('navigation', { name: '可加入工作區的分析模組' });
  const clickStarted = Date.now();
  await page.getByRole('button', { name: '完整模式' }).click();
  await strip.getByRole('button', { name: /^SINR / }).click();
  await strip.getByRole('button', { name: /^Power / }).click();
  const readyInteractionMs = Date.now() - clickStarted;
  return {
    headingMs,
    readyMs,
    readyInteractionMs,
    longTaskCount: longTasks.length,
    worstLongTaskMs: longTasks.length === 0 ? 0 : Math.max(...longTasks.map((entry) => entry.duration)),
    totalLongTaskMs: longTasks.reduce((sum, entry) => sum + entry.duration, 0),
  };
}
