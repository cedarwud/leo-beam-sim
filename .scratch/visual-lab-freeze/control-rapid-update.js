async (page) => {
  page.setDefaultTimeout(5000);
  page.setDefaultNavigationTimeout(30000);
  await page.reload();
  await page.getByRole('heading', { name: '多波束低軌衛星節能實驗室' }).waitFor();
  const strip = page.getByRole('navigation', { name: '可加入工作區的分析模組' });
  await page.getByRole('button', { name: '完整模式' }).click();
  await strip.getByRole('button', { name: /^SINR / }).click();
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
  const started = Date.now();
  await strip.getByRole('button', { name: /^Power / }).click();
  return { powerClickMs: Date.now() - started };
}
