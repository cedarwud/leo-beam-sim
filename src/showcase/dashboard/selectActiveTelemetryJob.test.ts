#!/usr/bin/env node
/**
 * P2 unit test: active Plane-A live telemetry selector + episode progress.
 * Run: `npm run validate:phase-d:live-telemetry-select`.
 */
import type { LiveTelemetryEntry, TrainingProgressEvent } from './liveTelemetryStore';
import {
  resolveLiveEpisodeProgress,
  selectActiveTelemetryJob,
  selectTerminalRewardMetrics,
} from './selectActiveTelemetryJob';

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

function event(
  partial: Partial<TrainingProgressEvent> & Pick<TrainingProgressEvent, 'jobId' | 'tsMs' | 'type'>,
): TrainingProgressEvent {
  return {
    id: partial.id ?? partial.tsMs,
    status: partial.status ?? 'running',
    ...partial,
  } as TrainingProgressEvent;
}

function entry(args: {
  readonly jobId: string;
  readonly status?: TrainingProgressEvent['status'];
  readonly type?: TrainingProgressEvent['type'];
  readonly heartbeatMs: number;
  readonly metrics?: Record<string, number>;
  readonly progress?: {
    readonly episode?: number;
    readonly episodeBudget?: number;
  } | null;
}): LiveTelemetryEntry {
  const lastProgressEvent = args.progress === null || args.progress === undefined
    ? null
    : event({
      jobId: args.jobId,
      tsMs: args.heartbeatMs - 1,
      type: 'progress',
      status: args.status ?? 'running',
      episode: args.progress.episode,
      episodeBudget: args.progress.episodeBudget,
    });
  const lastEpisodeEvent = lastProgressEvent !== null
    && typeof lastProgressEvent.episode === 'number'
    && Number.isFinite(lastProgressEvent.episode)
    ? lastProgressEvent
    : null;
  return {
    latestEvent: event({
      jobId: args.jobId,
      tsMs: args.heartbeatMs,
      type: args.type ?? 'heartbeat',
      status: args.status ?? 'running',
      metrics: args.metrics,
    }),
    lastProgressEvent,
    lastEpisodeEvent,
    rewardHistory: [],
    lastProgressMs: lastProgressEvent?.tsMs ?? null,
    lastHeartbeatMs: args.heartbeatMs,
  };
}

check('no active job in empty snapshot => null', selectActiveTelemetryJob({}) === null);

check(
  'no active job in terminal-only snapshot => null',
  selectActiveTelemetryJob({
    done: entry({ jobId: 'done', status: 'done', type: 'done', heartbeatMs: 100 }),
    failed: entry({ jobId: 'failed', status: 'failed', type: 'failed', heartbeatMs: 200 }),
  }) === null,
);

check(
  'picks latest-heartbeat active job',
  selectActiveTelemetryJob({
    jobA: entry({ jobId: 'jobA', status: 'running', heartbeatMs: 100 }),
    jobB: entry({ jobId: 'jobB', status: 'queued', heartbeatMs: 300 }),
    jobC: entry({ jobId: 'jobC', status: 'paused', heartbeatMs: 200 }),
  }) === 'jobB',
);

check(
  'prefers an active job over a terminal job with a reward summary',
  selectActiveTelemetryJob({
    active: entry({ jobId: 'active', status: 'running', heartbeatMs: 100 }),
    terminal: entry({ jobId: 'terminal', status: 'done', type: 'done', heartbeatMs: 999, metrics: { scalarReward: 1 } }),
  }) === 'active',
);

check(
  'no active + terminal WITH reward summary => selects the terminal job (codex [P2])',
  selectActiveTelemetryJob({
    done: entry({ jobId: 'done', status: 'done', type: 'done', heartbeatMs: 400, metrics: { scalarReward: 2.5 } }),
  }) === 'done',
);

check(
  'no active + terminal WITHOUT reward summary => null',
  selectActiveTelemetryJob({
    done: entry({ jobId: 'done', status: 'done', type: 'done', heartbeatMs: 400 }),
  }) === null,
);

check(
  'no active + multiple terminal-with-reward => latest heartbeat wins',
  selectActiveTelemetryJob({
    old: entry({ jobId: 'old', status: 'done', type: 'done', heartbeatMs: 100, metrics: { scalarReward: 1 } }),
    recent: entry({ jobId: 'recent', status: 'completed', type: 'done', heartbeatMs: 800, metrics: { r1Mean: 0.4 } }),
  }) === 'recent',
);

check(
  'terminal reward summary via sticky lastProgressEvent metrics also counts',
  (() => {
    const e = entry({ jobId: 'sticky', status: 'done', type: 'done', heartbeatMs: 500 });
    const withStickyReward: LiveTelemetryEntry = {
      ...e,
      lastProgressEvent: event({ jobId: 'sticky', tsMs: 480, type: 'progress', status: 'running', metrics: { totalHandovers: 3 } }),
    };
    return selectActiveTelemetryJob({ sticky: withStickyReward }) === 'sticky';
  })(),
);

const progressEntry = entry({
  jobId: 'progress',
  heartbeatMs: 500,
  progress: { episode: 7, episodeBudget: 12 },
});
const progress = resolveLiveEpisodeProgress(progressEntry);
check('extracts episode progress from lastProgressEvent', progress?.episode === 7 && progress.budget === 12);

const noBudget = resolveLiveEpisodeProgress(entry({
  jobId: 'no-budget',
  heartbeatMs: 600,
  progress: { episode: 8 },
}));
check('episode progress budget is null when episodeBudget is absent', noBudget?.episode === 8 && noBudget.budget === null);

check(
  'episode progress is null when lastProgressEvent is absent',
  resolveLiveEpisodeProgress(entry({ jobId: 'absent', heartbeatMs: 700, progress: null })) === null,
);

check(
  'episode progress is null when episode is absent',
  resolveLiveEpisodeProgress(entry({ jobId: 'missing-episode', heartbeatMs: 800, progress: {} })) === null,
);

check(
  'episode tile freezes the last real episode across a metrics-only final progress (codex [P2])',
  (() => {
    const finalMetricsOnly: LiveTelemetryEntry = {
      latestEvent: event({ jobId: 'x', tsMs: 100, type: 'progress', metrics: { scalarReward: 1 } }),
      lastProgressEvent: event({ jobId: 'x', tsMs: 100, type: 'progress', metrics: { scalarReward: 1 } }),
      lastEpisodeEvent: event({ jobId: 'x', tsMs: 90, type: 'progress', episode: 5, episodeBudget: 10 }),
      rewardHistory: [],
      lastProgressMs: 100,
      lastHeartbeatMs: 100,
    };
    const resolved = resolveLiveEpisodeProgress(finalMetricsOnly);
    return resolved?.episode === 5 && resolved.budget === 10;
  })(),
);

// selectTerminalRewardMetrics — terminal summary vs per-episode sample (codex [P2]).
function terminalEntry(args: {
  readonly status: TrainingProgressEvent['status'];
  readonly type: TrainingProgressEvent['type'];
  readonly latestMetrics?: Record<string, number>;
  readonly lastProgress?: { readonly episode?: number; readonly metrics?: Record<string, number> } | null;
}): LiveTelemetryEntry {
  const lastProgressEvent = args.lastProgress == null ? null : event({
    jobId: 't', tsMs: 50, type: 'progress', status: 'running',
    episode: args.lastProgress.episode, metrics: args.lastProgress.metrics,
  });
  return {
    latestEvent: event({ jobId: 't', tsMs: 60, type: args.type, status: args.status, metrics: args.latestMetrics }),
    lastProgressEvent,
    lastEpisodeEvent: lastProgressEvent !== null && typeof lastProgressEvent.episode === 'number' ? lastProgressEvent : null,
    rewardHistory: [],
    lastProgressMs: lastProgressEvent?.tsMs ?? null,
    lastHeartbeatMs: 60,
  };
}

check('terminal metrics: running job => undefined (no end-of-run summary)',
  selectTerminalRewardMetrics(terminalEntry({ status: 'running', type: 'progress', latestMetrics: { scalarReward: 1 } })) === undefined);
check('terminal metrics: terminal event carries metrics => returns them',
  selectTerminalRewardMetrics(terminalEntry({ status: 'done', type: 'done', latestMetrics: { scalarReward: 2 } }))?.scalarReward === 2);
check('terminal metrics: metrics-only FINAL progress line (reward, NO episode) => returns it',
  selectTerminalRewardMetrics(terminalEntry({ status: 'done', type: 'done', lastProgress: { metrics: { scalarReward: 3 } } }))?.scalarReward === 3);
check('terminal metrics: final scalar line surfaces while still running, before the terminal SSE (codex [P2])',
  selectTerminalRewardMetrics(terminalEntry({ status: 'running', type: 'progress', lastProgress: { metrics: { scalarReward: 5 } } }))?.scalarReward === 5);
check('terminal metrics: episode-bearing progress reward is NOT a terminal summary (codex [P2])',
  selectTerminalRewardMetrics(terminalEntry({ status: 'failed', type: 'failed', lastProgress: { episode: 7, metrics: { scalarReward: 4 } } })) === undefined);
check('terminal metrics: no reward anywhere => undefined',
  selectTerminalRewardMetrics(terminalEntry({ status: 'cancelled', type: 'cancelled', lastProgress: { episode: 7 } })) === undefined);

if (failures.length > 0) {
  throw new Error(`[live-telemetry-select] ${passed} passed, ${failures.length} failed: ${failures.join('; ')}`);
}
console.log(`\n[live-telemetry-select] ${passed} passed, 0 failed`);
