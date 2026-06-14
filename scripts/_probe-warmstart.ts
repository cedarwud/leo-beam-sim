import { loadProfile } from '../src/profiles/index';
import { recommendDemoReplayStartOffsetSec } from '../src/scene/replay-recommendation';
import { buildSinrLiveCellHandoverEventIndex } from '../src/scene/sinrLiveCellHandoverEventIndex';

const APP_EPOCH_MS = Date.UTC(2026, 0, 1, 0, 0, 0);
const profile = loadProfile('hobs-2024-candidate-rich');

const demoStartOffset = recommendDemoReplayStartOffsetSec(profile, APP_EPOCH_MS);
console.log(`demoStartOffset (recommendation) = ${demoStartOffset}s`);

function probe(label: string, epochOffsetSec: number) {
  const idx = buildSinrLiveCellHandoverEventIndex({
    profile,
    epochUtcMs: APP_EPOCH_MS + epochOffsetSec * 1000,
    simStepSec: 2,
    ueCount: 100,
  });
  const evs = (idx as any).events ?? [];
  const times = evs.map((e: any) => e.sourceTimeSec).sort((a: number, b: number) => a - b);
  const first180 = times.filter((t: number) => t <= 180).length;
  const early = times.filter((t: number) => t <= 300);
  let maxGap = 0, prev = 0;
  for (const t of early) { maxGap = Math.max(maxGap, t - prev); prev = t; }
  console.log(
    `[${label}] epochOffset=${epochOffsetSec}s  total=${evs.length}  ` +
    `firstEvent=${times.length ? times[0].toFixed(0) : 'none'}s  ` +
    `first8=${times.slice(0, 8).map((t: number) => t.toFixed(0)).join(',')}  ` +
    `first180s_events=${first180}  maxGap[0,300]=${maxGap.toFixed(0)}s`,
  );
}

probe('epoch-zero', 0);
probe('demo-start', demoStartOffset);
