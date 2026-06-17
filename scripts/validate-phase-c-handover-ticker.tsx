#!/usr/bin/env node
// G2-TICKER wiring + honesty gate. The always-on SINR-live handover ticker is a
// DISPLAY-ONLY CUMULATIVE count of the REAL classified handovers
// (`SimState.cumulativeIntra/InterHandoverCount`, published from sim.sinrLiveCells).
// It is cumulative — NOT a sim-time window — because the window empties under the UI
// publisher throttle at fast playback, so a windowed count under-reported the live
// stream while the unthrottled pulse rendered. This gate pins that the ticker only
// RENDERS the totals (never fabricates), that App mounts it gated on the sinr-live
// lane fed the published totals, and that the publisher actually publishes them. The
// monotonic accumulation + reset-on-reset/rebase behaviour is owned by
// validate:phase-c:sinr-live-cells:model (the cumulative-totals unit test).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string): string => readFileSync(path.join(repoRoot, rel), 'utf8');

let passed = 0;
let failed = 0;
function check(label: string, fn: () => void): void {
  try {
    fn();
    passed += 1;
    console.log(`  ok ${label}`);
  } catch (error) {
    failed += 1;
    console.error(`  FAIL ${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ── (1) component is display-only + lane-truthful, fabricates nothing ──
const tickerSource = read('src/ui/SinrHandoverTicker.tsx');
check('ticker renders the published CUMULATIVE totals + stamps a lane-truthful claim', () => {
  assert.ok(tickerSource.includes('cumulativeIntra'), 'ticker consumes the cumulative intra total');
  assert.ok(tickerSource.includes('cumulativeInter'), 'ticker consumes the cumulative inter total');
  assert.ok(tickerSource.includes('data-claim-kind="sinr-handover"'), 'ticker stamps the sinr-handover claim');
  assert.ok(tickerSource.includes('not MODQN'), 'ticker disclaims MODQN/producer (honesty)');
});
check('ticker fabricates nothing (no RNG, no event construction/filtering) — it only renders the totals', () => {
  assert.ok(!/Math\.random|Date\.now|new Date|performance\.now/.test(tickerSource), 'ticker invents no timing/randomness');
  assert.ok(
    !/push\(|splice\(|classifyServingTransition|\.filter\(|\.map\(/.test(tickerSource),
    'ticker builds/filters/maps no events — it only renders the published totals (the only arithmetic is total = intra + inter)',
  );
});

// ── (2) App mounts it gated on the sinr-live lane, fed the PUBLISHED totals ──
const appSource = read('src/App.tsx');
check('App mounts SinrHandoverTicker on the sinr-live lane fed the published cumulative totals', () => {
  assert.ok(appSource.includes("from './ui/SinrHandoverTicker'"), 'App imports the ticker');
  assert.ok(appSource.includes('<SinrHandoverTicker'), 'App mounts the ticker');
  assert.ok(
    appSource.includes('cumulativeIntra={simState.cumulativeIntraHandoverCount}'),
    'ticker is fed the PUBLISHED cumulative intra total (not a re-derived one)',
  );
  assert.ok(
    appSource.includes('cumulativeInter={simState.cumulativeInterHandoverCount}'),
    'ticker is fed the PUBLISHED cumulative inter total',
  );
  assert.ok(
    /<SinrHandoverTicker[\s\S]{0,400}sceneLane === 'sinr-live'/.test(appSource),
    'ticker is lane-gated to sinr-live',
  );
});

// ── (3) the publisher publishes the cumulative totals from the cell frame ──
const publisherSource = read('src/scene/useSimStatePublisher.ts');
check('publisher publishes the cumulative totals from sim.sinrLiveCells (G2a source)', () => {
  assert.ok(
    publisherSource.includes('cumulativeIntraHandoverCount: sim.sinrLiveCells?.cumulativeIntraHandoverCount'),
    'publisher maps the cumulative intra total onto SimState',
  );
  assert.ok(
    publisherSource.includes('cumulativeInterHandoverCount: sim.sinrLiveCells?.cumulativeInterHandoverCount'),
    'publisher maps the cumulative inter total onto SimState',
  );
});

console.log(`\n[validate-phase-c-handover-ticker] ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
