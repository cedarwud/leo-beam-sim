import type { Browser, BrowserContext, BrowserContextOptions, Page, Playwright } from '@playwright/test';

export interface BootDeterministicPageOptions {
  url: string;
  seed?: number;
  rafMs?: number;
  viewport?: BrowserContextOptions['viewport'];
  browser?: Browser;
  context?: BrowserContext;
  waitForSelector?: string;
}

function createMulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedRandom(seed: number): void {
  Math.random = createMulberry32(seed);
}

async function injectSeedRandom(page: Page, seed: number): Promise<void> {
  await page.addInitScript({ content: `
    (() => {
      const nextSeed = ${JSON.stringify(seed)};
      function createPageMulberry32(seedValue) {
        let state = seedValue >>> 0;
        return () => {
          state += 0x6d2b79f5;
          let value = state;
          value = Math.imul(value ^ (value >>> 15), value | 1);
          value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
          return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
        };
      }

      Math.random = createPageMulberry32(nextSeed);
    })();
  ` });
}

function buildFrozenRafScript(atMs: number): string {
  return `
    (() => {
      const atMs = ${JSON.stringify(atMs)};
      const callbacks = new Map();
      let nextId = 0;

      window.requestAnimationFrame = callback => {
        const id = ++nextId;
        callbacks.set(id, callback);
        window.setTimeout(() => {
          const queued = callbacks.get(id);
          if (!queued) return;
          callbacks.delete(id);
          queued(atMs);
        }, 0);
        return id;
      };

      window.cancelAnimationFrame = id => {
        callbacks.delete(id);
      };

      Date.now = () => atMs;

      try {
        Object.defineProperty(window.performance, 'now', {
          configurable: true,
          value: () => atMs,
        });
      } catch {
        // Some browser builds expose performance.now as non-configurable.
      }
    })();
  `;
}

function buildDeterministicCssScript(): string {
  const css = `
    *,
    *::before,
    *::after {
      animation-delay: 0s !important;
      animation-duration: 0s !important;
      animation-iteration-count: 1 !important;
      animation-play-state: paused !important;
      caret-color: transparent !important;
      transition-delay: 0s !important;
      transition-duration: 0s !important;
    }
  `;

  return `
    (() => {
      const css = ${JSON.stringify(css)};
      const attach = () => {
        if (document.querySelector('style[data-v3-deterministic-fixture]')) return;
        const style = document.createElement('style');
        style.dataset.v3DeterministicFixture = 'true';
        style.textContent = css;
        (document.head || document.documentElement).appendChild(style);
      };

      if (document.head || document.documentElement) {
        attach();
        return;
      }

      window.addEventListener('DOMContentLoaded', attach, { once: true });
    })();
  `;
}

export async function freezeRaf(page: Page, atMs: number): Promise<void> {
  const frozenRafScript = buildFrozenRafScript(atMs);
  const deterministicCssScript = buildDeterministicCssScript();

  await page.addInitScript({ content: frozenRafScript });
  await page.addInitScript({ content: deterministicCssScript });

  try {
    await page.evaluate(frozenRafScript);
    await page.evaluate(deterministicCssScript);
  } catch {
    // The page may not have navigated yet; addInitScript covers that path.
  }
}

export async function bootDeterministicPage(
  playwright: Pick<Playwright, 'chromium'>,
  opts: BootDeterministicPageOptions,
): Promise<Page> {
  const seed = opts.seed ?? 1337;
  const rafMs = opts.rafMs ?? 1000;
  const ownsBrowser = opts.browser === undefined && opts.context === undefined;
  const browser = opts.browser ?? (opts.context ? undefined : await playwright.chromium.launch());
  const context = opts.context ?? await (browser as Browser).newContext({
    viewport: opts.viewport ?? { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  await injectSeedRandom(page, seed);
  await freezeRaf(page, rafMs);

  try {
    await page.goto(opts.url, { waitUntil: 'domcontentloaded' });
    await page.locator(opts.waitForSelector ?? '[data-testid="info-panel-primary-sinr-status"]').waitFor({ timeout: 30000 });
    await page.evaluate(buildDeterministicCssScript());
    return page;
  } catch (error) {
    await page.close().catch(() => {});
    if (opts.context === undefined) await context.close().catch(() => {});
    if (ownsBrowser && browser) await browser.close().catch(() => {});
    throw error;
  }
}
