#!/usr/bin/env node
// G2-TICKER model + wiring gate. The always-on SINR-live handover ticker is a
// DISPLAY-ONLY rolling count of the REAL classified handover events
// (`SimState.recentHandoverEvents`, published from `sim.sinrLiveCells`). This gate
// pins that it only TALLIES (positive controls) and never fabricates, that App
// mounts it gated on the sinr-live lane fed the published log, and that the
// publisher actually publishes that log (Rule#6 truth-sensitive display).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { summarizeRecentHandovers } from '../src/ui/SinrHandoverTicker.tsx';

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

// ── (1) pure summarizer: positive controls — it TALLIES, never invents ──
check('empty / undefined → all zero (no handovers fabricated)', () => {
  assert.deepEqual(summarizeRecentHandovers(undefined), { inter: 0, intra: 0, total: 0 });
  assert.deepEqual(summarizeRecentHandovers([]), { inter: 0, intra: 0, total: 0 });
});
check('counts inter vs intra by kind; total = inter + intra', () => {
  const events = [
    { kind: 'inter' as const },
    { kind: 'intra' as const },
    { kind: 'inter' as const },
    { kind: 'inter' as const },
  ];
  assert.deepEqual(summarizeRecentHandovers(events), { inter: 3, intra: 1, total: 4 });
});
check('inter-only and intra-only tally correctly', () => {
  assert.deepEqual(summarizeRecentHandovers([{ kind: 'inter' }, { kind: 'inter' }]), { inter: 2, intra: 0, total: 2 });
  assert.deepEqual(summarizeRecentHandovers([{ kind: 'intra' }]), { inter: 0, intra: 1, total: 1 });
});

// ── (2) component is display-only + lane-truthful, fabricates nothing ──
const tickerSource = read('src/ui/SinrHandoverTicker.tsx');
check('ticker reads the published rolling log + stamps a lane-truthful claim', () => {
  assert.ok(tickerSource.includes('recentHandoverEvents'), 'ticker consumes the rolling handover log');
  assert.ok(tickerSource.includes('data-claim-kind="sinr-handover"'), 'ticker stamps the sinr-handover claim');
  assert.ok(tickerSource.includes('not MODQN'), 'ticker disclaims MODQN/producer (honesty)');
});
check('ticker fabricates no handover (no RNG, no event construction, no time filtering)', () => {
  assert.ok(!/Math\.random|Date\.now|new Date|performance\.now/.test(tickerSource), 'ticker invents no timing/randomness');
  assert.ok(!/push\(|splice\(|classifyServingTransition/.test(tickerSource), 'ticker builds no synthetic events — it only counts');
});

// ── (3) App mounts it gated on the sinr-live lane, fed the PUBLISHED log ──
const appSource = read('src/App.tsx');
check('App mounts SinrHandoverTicker on the sinr-live lane fed the published log', () => {
  assert.ok(appSource.includes("from './ui/SinrHandoverTicker'"), 'App imports the ticker');
  assert.ok(appSource.includes('<SinrHandoverTicker'), 'App mounts the ticker');
  assert.ok(appSource.includes('recentHandoverEvents={simState.recentHandoverEvents}'), 'ticker is fed the PUBLISHED log (not a re-derived one)');
  assert.ok(appSource.includes('retentionSec={SINR_LIVE_RECENT_HANDOVER_RETENTION_SEC}'), 'ticker labels the real retention window');
  assert.ok(/visible=\{sceneLane === 'sinr-live'\}[\s\S]{0,80}\/>\s*\{\/\* G2-TICKER|<SinrHandoverTicker[\s\S]{0,400}sceneLane === 'sinr-live'/.test(appSource), 'ticker is lane-gated to sinr-live');
});

// ── (4) the publisher actually publishes the rolling log from the cell frame ──
const publisherSource = read('src/scene/useSimStatePublisher.ts');
check('publisher publishes recentHandoverEvents from sim.sinrLiveCells (G2a source)', () => {
  assert.ok(publisherSource.includes('recentHandoverEvents: sim.sinrLiveCells?.recentHandoverEvents'), 'publisher maps the rolling log onto SimState');
});

console.log(`\n[validate-phase-c-handover-ticker] ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
