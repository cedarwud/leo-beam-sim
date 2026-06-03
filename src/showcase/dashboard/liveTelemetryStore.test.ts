#!/usr/bin/env node
/**
 * P1 unit test: Plane-A live telemetry store + INV-2 staleness resolver.
 * Run: `npm run validate:phase-d:live-telemetry-store`.
 */
import type { TrainingProgressEvent } from '../../modqn/training-trigger/types';
import {
  HEARTBEAT_INTERVAL_MS,
  OFFLINE_AFTER_MS,
  STALL_AFTER_MS,
  resolveTelemetryStatus,
  publishTelemetryEvent,
  clearTelemetry,
  reconcileTelemetry,
  resetTelemetryStore,
  getTelemetrySnapshot,
} from './liveTelemetryStore';

let passed = 0;
const failures: string[] = [];

function check(label: string, cond: boolean): void {
  if (cond) {
    passed += 1;
    console.log(`  [PASS] ${label}`);
  } else {
    failures.push(label);
    console.error(`  [FAIL] ${label}`);
  }
}

function event(partial: Partial<TrainingProgressEvent> & Pick<TrainingProgressEvent, 'jobId' | 'tsMs' | 'type'>): TrainingProgressEvent {
  return {
    id: partial.id ?? 1,
    status: partial.status ?? 'running',
    ...partial,
  } as TrainingProgressEvent;
}

// --- resolveTelemetryStatus (INV-2) ---

check('threshold ordering sane (stall < offline, heartbeat 10s)',
  HEARTBEAT_INTERVAL_MS === 10_000 && STALL_AFTER_MS < OFFLINE_AFTER_MS);

check('null heartbeat => offline',
  resolveTelemetryStatus(null, null, 1_000, 'running') === 'offline');

check('terminal job (done) => offline even when fresh',
  resolveTelemetryStatus(1_000, 1_000, 1_500, 'done') === 'offline');

check('terminal job (failed) => offline',
  resolveTelemetryStatus(1_000, 1_000, 1_500, 'failed') === 'offline');

check('terminal job (cancelled) => offline',
  resolveTelemetryStatus(1_000, 1_000, 1_500, 'cancelled') === 'offline');

check('terminal job (completed alias) => offline even when fresh',
  resolveTelemetryStatus(1_000, 1_000, 1_500, 'completed') === 'offline');

check('terminal job (expired) => offline even when fresh',
  resolveTelemetryStatus(1_000, 1_000, 1_500, 'expired') === 'offline');

check('active job (paused) + both fresh => live (not terminal)',
  resolveTelemetryStatus(0, 0, 1_000, 'paused') === 'live');

check('active job (queued) + heartbeat fresh + no progress => live (not stalled before start)',
  resolveTelemetryStatus(null, 0, 1_000, 'queued') === 'live');

check('running + heartbeat lost (> OFFLINE_AFTER_MS) => offline',
  resolveTelemetryStatus(0, 0, OFFLINE_AFTER_MS + 1, 'running') === 'offline');

check('running + heartbeat fresh + no progress yet => live (no frozen-progress evidence)',
  resolveTelemetryStatus(null, 0, 1_000, 'running') === 'live');

check('running + heartbeat fresh + progress aged (> STALL_AFTER_MS) => stalled',
  resolveTelemetryStatus(0, STALL_AFTER_MS, STALL_AFTER_MS + 1, 'running') === 'stalled');

check('paused + progress aged => live (only running stalls)',
  resolveTelemetryStatus(0, STALL_AFTER_MS, STALL_AFTER_MS + 1, 'paused') === 'live');

check('running + both fresh => live',
  resolveTelemetryStatus(0, 0, 1_000, 'running') === 'live');

check('boundary: heartbeat age == OFFLINE_AFTER_MS is NOT offline (strict >)',
  resolveTelemetryStatus(OFFLINE_AFTER_MS, 0, OFFLINE_AFTER_MS, 'running') === 'live');

check('boundary: progress age == STALL_AFTER_MS is NOT stalled (strict >)',
  resolveTelemetryStatus(0, STALL_AFTER_MS, STALL_AFTER_MS, 'running') === 'live');

// --- store ---

resetTelemetryStore();
check('reset => empty snapshot', Object.keys(getTelemetrySnapshot()).length === 0);

const emptyRef = getTelemetrySnapshot();
check('snapshot referentially stable with no publish', getTelemetrySnapshot() === emptyRef);

publishTelemetryEvent(event({ jobId: 'job-a', tsMs: 100, type: 'progress', episode: 3, metrics: { scalarReward: 1.5 } }));
const afterPublish = getTelemetrySnapshot();
check('publish changes snapshot identity', afterPublish !== emptyRef);
check('progress event sets entry', afterPublish['job-a'] !== undefined);
check('progress event sets lastProgressMs', afterPublish['job-a'].lastProgressMs === 100);
check('progress event sets lastHeartbeatMs', afterPublish['job-a'].lastHeartbeatMs === 100);

publishTelemetryEvent(event({ jobId: 'job-b', tsMs: 200, type: 'heartbeat' }));
const both = getTelemetrySnapshot();
check('heartbeat-only job has null lastProgressMs', both['job-b'].lastProgressMs === null);
check('heartbeat-only job has lastHeartbeatMs', both['job-b'].lastHeartbeatMs === 200);
check('publishing job-b leaves job-a intact', both['job-a'].lastProgressMs === 100);

publishTelemetryEvent(event({ jobId: 'job-a', tsMs: 300, type: 'heartbeat' }));
const sticky = getTelemetrySnapshot();
check('heartbeat after progress keeps lastProgressMs sticky', sticky['job-a'].lastProgressMs === 100);
check('heartbeat after progress advances lastHeartbeatMs', sticky['job-a'].lastHeartbeatMs === 300);

// sticky progress PAYLOAD across heartbeat/terminal (codex [P2]: heartbeat/done
// events carry no episode/metrics and must not blank the displayable payload).
// Uses a fresh job id (job-c), so job-a/job-b stay intact for the clear tests.
publishTelemetryEvent(event({ jobId: 'job-c', tsMs: 10, type: 'progress', episode: 5, episodeBudget: 12, metrics: { scalarReward: 2 } }));
check('progress sets lastProgressEvent payload', getTelemetrySnapshot()['job-c'].lastProgressEvent?.episode === 5);
check('progress sets lastEpisodeEvent', getTelemetrySnapshot()['job-c'].lastEpisodeEvent?.episode === 5);
check('progress sets latestEvent', getTelemetrySnapshot()['job-c'].latestEvent.type === 'progress');

publishTelemetryEvent(event({ jobId: 'job-c', tsMs: 20, type: 'heartbeat' }));
const afterHb = getTelemetrySnapshot()['job-c'];
check('heartbeat keeps lastProgressEvent episode sticky', afterHb.lastProgressEvent?.episode === 5);
check('heartbeat keeps lastProgressEvent metrics sticky', afterHb.lastProgressEvent?.metrics?.scalarReward === 2);
check('heartbeat keeps lastEpisodeEvent sticky', afterHb.lastEpisodeEvent?.episode === 5);
check('heartbeat is the latestEvent', afterHb.latestEvent.type === 'heartbeat');

publishTelemetryEvent(event({ jobId: 'job-c', tsMs: 30, type: 'done', status: 'done' }));
const afterDone = getTelemetrySnapshot()['job-c'];
check('done keeps lastProgressEvent episode sticky', afterDone.lastProgressEvent?.episode === 5);
check('done keeps lastEpisodeEvent sticky', afterDone.lastEpisodeEvent?.episode === 5);
check('done is the latestEvent', afterDone.latestEvent.type === 'done');

// producer FINAL scalar line = a metrics-only progress (episodeBudget, NO
// episode) that arrives AFTER the last real episode; it must update reward
// metrics but NOT blank the sticky episode (codex [P2]). Fresh job-d.
publishTelemetryEvent(event({ jobId: 'job-d', tsMs: 10, type: 'progress', episode: 5, episodeBudget: 12, metrics: { scalarReward: 2 } }));
publishTelemetryEvent(event({ jobId: 'job-d', tsMs: 15, type: 'progress', episodeBudget: 12, metrics: { scalarReward: 9, r1Mean: 1 } }));
const afterFinalProgress = getTelemetrySnapshot()['job-d'];
check('metrics-only final progress keeps lastEpisodeEvent sticky (episode 5)', afterFinalProgress.lastEpisodeEvent?.episode === 5);
check('metrics-only final progress updates lastProgressEvent metrics', afterFinalProgress.lastProgressEvent?.metrics?.scalarReward === 9);
check('metrics-only final progress has no episode on lastProgressEvent', afterFinalProgress.lastProgressEvent?.episode === undefined);
clearTelemetry('job-d');

const beforeClear = getTelemetrySnapshot();
clearTelemetry('job-b');
const afterClear = getTelemetrySnapshot();
check('clearTelemetry removes the job', afterClear['job-b'] === undefined);
check('clearTelemetry changes snapshot identity', afterClear !== beforeClear);
check('clearTelemetry leaves other jobs', afterClear['job-a'] !== undefined);

clearTelemetry('job-missing');
check('clearTelemetry on missing job is a no-op (stable identity)', getTelemetrySnapshot() === afterClear);

// reconcileTelemetry prunes deleted / LRU-expired jobs (codex [P2]).
resetTelemetryStore();
publishTelemetryEvent(event({ jobId: 'keep', tsMs: 10, type: 'progress', episode: 1 }));
publishTelemetryEvent(event({ jobId: 'gone', tsMs: 20, type: 'done', status: 'done', metrics: { scalarReward: 3 } }));
const beforeReconcile = getTelemetrySnapshot();
reconcileTelemetry(new Set(['keep']));
const afterReconcile = getTelemetrySnapshot();
check('reconcile removes jobs absent from the known set', afterReconcile['gone'] === undefined);
check('reconcile keeps jobs in the known set', afterReconcile['keep'] !== undefined);
check('reconcile changes snapshot identity when it prunes', afterReconcile !== beforeReconcile);
reconcileTelemetry(new Set(['keep']));
check('reconcile is a no-op (stable identity) when nothing is pruned', getTelemetrySnapshot() === afterReconcile);
reconcileTelemetry(new Set());
check('reconcile to empty set clears all entries', Object.keys(getTelemetrySnapshot()).length === 0);

resetTelemetryStore();

// --- summary ---
if (failures.length > 0) {
  throw new Error(`[live-telemetry-store] ${passed} passed, ${failures.length} failed: ${failures.join('; ')}`);
}
console.log(`\n[live-telemetry-store] ${passed} passed, 0 failed`);
