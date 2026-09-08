import { assertSinrLiveCellBeams } from './validate-phase-c-sinr-live-cell-beams-browser.ts';
import { mountJsdomApp } from './lib/jsdom-app-harness.tsx';

async function main(): Promise<void> {
  const started = performance.now();
  const app = await mountJsdomApp('?sceneSource=live-sim&appMode=sinr-experiment');
  try {
    await assertSinrLiveCellBeams(
      app.page as unknown as Parameters<typeof assertSinrLiveCellBeams>[0],
      app.errors,
    );
    const wallSeconds = (performance.now() - started) / 1000;
    console.log(`[sinr-live-cell-beams-dom] PASS wall_seconds=${wallSeconds.toFixed(2)} harness=jsdom`);
  } catch (error) {
    console.error('[sinr-live-cell-beams-dom] captured app errors:', JSON.stringify(app.errors));
    throw error;
  } finally {
    app.close();
  }
}

main().catch(error => {
  console.error('[sinr-live-cell-beams-dom] FAILED:', error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
