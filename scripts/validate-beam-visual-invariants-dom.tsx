import { assertBeamVisualInvariants } from './validate-beam-visual-invariants-browser.ts';
import { mountJsdomApp } from './lib/jsdom-app-harness.tsx';

async function main(): Promise<void> {
  const started = performance.now();
  const app = await mountJsdomApp('?sceneSource=live-sim&appMode=sinr-experiment');
  try {
    await assertBeamVisualInvariants(app.page as unknown as Parameters<typeof assertBeamVisualInvariants>[0]);
    const wallSeconds = (performance.now() - started) / 1000;
    console.log(`[beam-visual-invariants-dom] PASS wall_seconds=${wallSeconds.toFixed(2)} harness=jsdom`);
  } finally {
    app.close();
  }
}

main().catch(error => {
  console.error('[beam-visual-invariants-dom] FAILED:', error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
