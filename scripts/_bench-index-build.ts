// THROWAWAY microbenchmark: measure buildSinrLiveCellHandoverEventIndex wall time
// matching the real sinr-live call site (App.tsx:1282) exactly.
import { buildSinrLiveCellHandoverEventIndex } from '../src/scene/sinrLiveCellHandoverEventIndex';
import { loadProfile } from '../src/profiles/index';
import { APP_EPOCH_MS } from '../src/app/appRuntimeConfig';
import { DEFAULT_UE_MOBILITY_PARAMS } from '../src/engine/ue/multiUeMobility';

const profile = loadProfile('hobs-2024-candidate-rich');

function runOnce(ueCount: number): { ms: number; events: number; gaps: number } {
  const t0 = performance.now();
  const index = buildSinrLiveCellHandoverEventIndex({
    profile,
    epochUtcMs: APP_EPOCH_MS,
    simStepSec: 30,
    ueCount,
    ueDistributionMode: 'random',
    uePrimaryAnchorMode: 'observer',
    ueDistributionScope: 'beam-footprint',
    ueDistributionRadiusKm: undefined,
    ueMobilityMode: 'static',
    ueMobilityParams: DEFAULT_UE_MOBILITY_PARAMS,
  });
  const ms = performance.now() - t0;
  return { ms, events: index.events.length, gaps: index.sourceGapReasons.length };
}

for (const ueCount of [100, 1]) {
  // warm + 3 timed runs
  runOnce(ueCount);
  const runs = [runOnce(ueCount), runOnce(ueCount), runOnce(ueCount)];
  const median = runs.map(r => r.ms).sort((a, b) => a - b)[1];
  console.log(`ueCount=${ueCount}: median=${median.toFixed(0)}ms  events=${runs[0].events}  gaps=${runs[0].gaps}  raw=[${runs.map(r => r.ms.toFixed(0)).join(',')}]`);
}
