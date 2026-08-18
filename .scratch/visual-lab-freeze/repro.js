async (page) => {
  page.setDefaultTimeout(5000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.reload();
  await page.getByRole('heading', { name: '多波束低軌衛星節能實驗室' }).waitFor();

  await page.evaluate(() => {
    window.__vlabLongTasks = [];
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__vlabLongTasks.push(entry.duration);
    });
    observer.observe({ type: 'longtask', buffered: true });
  });

  const durations = [];
  const probe = async (name, action) => {
    const started = Date.now();
    await action();
    const eventLoopDelayMs = await page.evaluate(() => new Promise((resolve) => {
      const before = performance.now();
      setTimeout(() => resolve(performance.now() - before), 0);
    }));
    durations.push({ name, wallMs: Date.now() - started, eventLoopDelayMs });
  };

  const moduleStrip = page.getByRole('navigation', { name: '可加入工作區的分析模組' });
  await probe('complete-mode', async () => {
    await page.getByRole('button', { name: '完整模式' }).click();
  });

  for (let cycle = 0; cycle < 3; cycle += 1) {
    await probe(`sinr-open-${cycle}`, async () => {
      await moduleStrip.getByRole('button', { name: /^SINR / }).click();
    });
    await probe(`sinr-slider-${cycle}`, async () => {
      const slider = page.locator('.vlab-progressive-control-dock input[type="range"]').first();
      await slider.evaluate(async (element) => {
        const input = element;
        const min = Number(input.min);
        const max = Number(input.max);
        for (let index = 0; index < 24; index += 1) {
          input.value = String(min + (max - min) * index / 23);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }
      });
    });

    await probe(`power-open-${cycle}`, async () => {
      await moduleStrip.getByRole('button', { name: /^Power / }).click();
    });
    await probe(`power-slider-${cycle}`, async () => {
      const slider = page.locator('.vlab-progressive-control-dock input[type="range"]').first();
      await slider.evaluate(async (element) => {
        const input = element;
        const min = Number(input.min);
        const max = Number(input.max);
        for (let index = 0; index < 24; index += 1) {
          input.value = String(min + (max - min) * (23 - index) / 23);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }
      });
    });

    await probe(`scene-open-${cycle}`, async () => {
      await moduleStrip.getByRole('button', { name: /^場景資料 / }).click();
    });
    await probe(`scale-global-${cycle}`, async () => {
      await page.locator('.vlab-progressive-control-dock').getByRole('button', { name: '全球軌道' }).click();
    });
    await probe(`scale-local-${cycle}`, async () => {
      await page.locator('.vlab-progressive-control-dock').getByRole('button', { name: 'NTPU 多波束' }).click();
    });
  }

  await probe('playback', async () => {
    await page.getByRole('button', { name: '播放' }).click();
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: '暫停' }).click();
  });

  const longTasks = await page.evaluate(() => window.__vlabLongTasks ?? []);
  const worstWallMs = Math.max(...durations.map((entry) => entry.wallMs));
  const worstEventLoopDelayMs = Math.max(...durations.map((entry) => Number(entry.eventLoopDelayMs)));
  const worstLongTaskMs = longTasks.length === 0 ? 0 : Math.max(...longTasks);
  if (worstWallMs > 5000 || worstEventLoopDelayMs > 2000 || worstLongTaskMs > 2000) {
    throw new Error(`VISUAL_LAB_FREEZE_REPRO wall=${worstWallMs} eventLoop=${worstEventLoopDelayMs} longTask=${worstLongTaskMs}`);
  }
  return { durations, longTaskCount: longTasks.length, worstWallMs, worstEventLoopDelayMs, worstLongTaskMs };
}
