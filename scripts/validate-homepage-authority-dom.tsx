import { assertHomepageAuthority } from './validate-homepage-authority-browser.ts';
import { mountJsdomApp } from './lib/jsdom-app-harness.tsx';

async function main(): Promise<void> {
  const started = performance.now();
  const app = await mountJsdomApp('?');
  try {
    await assertHomepageAuthority(
      app.page as unknown as Parameters<typeof assertHomepageAuthority>[0],
      app.requests,
      app.errors,
    );
    const wallSeconds = (performance.now() - started) / 1000;
    console.log(`[homepage-authority-dom] PASS wall_seconds=${wallSeconds.toFixed(2)} harness=jsdom`);
  } catch (error) {
    console.error('[homepage-authority-dom] captured app errors:', JSON.stringify(app.errors));
    throw error;
  } finally {
    app.close();
  }
}

main().catch(error => {
  console.error('[homepage-authority-dom] FAILED:', error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
