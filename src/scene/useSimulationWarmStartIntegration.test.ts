import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./useSimulation.ts', import.meta.url), 'utf8');

test('homepage cold-start stays at replay origin instead of silently jumping into the candidate window', () => {
  assert.match(source, /const replayStartColdResetKey = \[/);
  assert.match(source, /const lastReplayStartColdResetKeyRef = useRef<string \| null>\(null\)/);
  assert.match(
    source,
    /if \(!options\?\.timeShift\) \{\s*if \(lastReplayStartColdResetKeyRef\.current === replayStartColdResetKey\) return;/,
  );
  assert.match(source, /lastReplayStartColdResetKeyRef\.current = replayStartColdResetKey/);
  assert.match(source, /warmupSec: options\?\.timeShift \|\| !SINR_LIVE_INITIAL_WARMUP_ENABLED/);
  assert.match(source, /const SINR_LIVE_INITIAL_WARMUP_ENABLED = false/);
  assert.match(source, /resolveInitialReplayWarmupSec\(\{/);
  assert.match(source, /enabled:\s*SINR_LIVE_INITIAL_WARMUP_ENABLED/);
  assert.match(source, /alreadyWarmed:\s*hasWarmedOnceRef\.current/);
  assert.match(source, /cellTruthAvailable:\s*sinrLiveCellModel !== null/);
  assert.match(source, /options\?\.timeShift \|\| !SINR_LIVE_INITIAL_WARMUP_ENABLED/);
});
