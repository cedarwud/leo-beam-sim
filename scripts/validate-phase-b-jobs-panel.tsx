#!/usr/bin/env node
// validate-phase-b-jobs-panel.tsx
//
// PR-eta acceptance validator:
//   (a) jobsPolling pure helpers
//   (b) JobsPanel exposes required testids
//   (c) JobsPanel has adaptive poll loop, mode gate, and read-only service calls
//   (d) App.tsx wires the jobs tab into the MODQN sidebar only
//
// Run: node --import tsx/esm scripts/validate-phase-b-jobs-panel.tsx

import * as fs from 'node:fs';
import {
  computePollIntervalMs,
  countActiveJobs,
  formatRunningFor,
  isActiveStatus,
  isCancellableStatus,
  isDoneStatus,
  shortJobId,
} from '../src/modqn/training-trigger/jobsPolling';
import type {
  JobStatus,
  TrainingJobSummary,
} from '../src/modqn/training-trigger/types';

let passed = 0;
let failed = 0;

function pass(label: string): void {
  console.log(`  [PASS] ${label}`);
  passed++;
}

function fail(label: string, detail?: string): void {
  console.error(`  [FAIL] ${label}${detail ? `: ${detail}` : ''}`);
  failed++;
}

function assert(cond: boolean, label: string, detail?: string): void {
  if (cond) {
    pass(label);
  } else {
    fail(label, detail);
  }
}

function jobWithStatus(status: JobStatus): TrainingJobSummary {
  return { status } as unknown as TrainingJobSummary;
}

// ---------------------------------------------------------------------------
// (a) jobsPolling pure helpers
// ---------------------------------------------------------------------------
console.log('\n(a) jobsPolling pure helpers');
{
  assert(computePollIntervalMs(0) === 30000, 'computePollIntervalMs uses 30s idle cadence');
  assert(computePollIntervalMs(1) === 3000, 'computePollIntervalMs uses 3s active cadence for one job');
  assert(computePollIntervalMs(5) === 3000, 'computePollIntervalMs uses 3s active cadence for many jobs');
  assert(countActiveJobs([]) === 0, 'countActiveJobs returns zero for empty list');
  assert(
    countActiveJobs([
      jobWithStatus('queued'),
      jobWithStatus('done'),
      jobWithStatus('running'),
      jobWithStatus('paused'),
    ]) === 3,
    'countActiveJobs counts queued, running, and paused',
  );
  assert(formatRunningFor(0) === '0s', 'formatRunningFor formats zero');
  assert(formatRunningFor(5000) === '5s', 'formatRunningFor formats seconds');
  assert(formatRunningFor(75000) === '1m 15s', 'formatRunningFor formats minutes and seconds');
  assert(formatRunningFor(3700000) === '1h 1m', 'formatRunningFor formats hours and minutes');
  assert(formatRunningFor(-1) === '0s', 'formatRunningFor clamps negative elapsed time');
  assert(shortJobId('01HXY00000000000000000ABCD').length <= 12, 'shortJobId truncates long job IDs');
  assert(shortJobId('short') === 'short', 'shortJobId preserves short job IDs');
  assert(isActiveStatus('queued') === true, 'isActiveStatus accepts queued');
  assert(isActiveStatus('paused') === true, 'isActiveStatus keeps paused visible as a reserved non-terminal state');
  assert(isActiveStatus('done') === false, 'isActiveStatus rejects done');
  assert(isCancellableStatus('queued') === true, 'isCancellableStatus accepts queued');
  assert(isCancellableStatus('running') === true, 'isCancellableStatus accepts running');
  assert(isCancellableStatus('paused') === false, 'isCancellableStatus rejects reserved paused');
  assert(isCancellableStatus('done') === false, 'isCancellableStatus rejects done');
  assert(isDoneStatus('done') === true, 'isDoneStatus accepts done');
  assert(isDoneStatus('completed') === true, 'isDoneStatus accepts completed alias');
  assert(isDoneStatus('running') === false, 'isDoneStatus rejects running');
}

// ---------------------------------------------------------------------------
// (b) source grep: JobsPanel exposes required testids
// ---------------------------------------------------------------------------
console.log('\n(b) JobsPanel required testids');
{
  const panelSource = fs.readFileSync('src/ui/modqn-training/JobsPanel.tsx', 'utf8');
  for (const testId of [
    'data-testid="jobs-panel"',
    'data-testid="jobs-panel-active-card"',
    'data-testid="jobs-panel-completed-history-card"',
    'data-testid="jobs-panel-terminal-card"',
    'data-testid="jobs-panel-expired-card"',
    'data-testid="jobs-panel-empty"',
    'data-testid="jobs-panel-offline"',
    'data-testid="jobs-panel-batch-card"',
    'data-testid="jobs-panel-batch-progress"',
    'data-testid="jobs-panel-batch-cell"',
    'data-testid="jobs-panel-refresh-batch"',
  ]) {
    assert(panelSource.includes(testId), `JobsPanel includes ${testId}`);
  }
}

// ---------------------------------------------------------------------------
// (c) source grep: JobsPanel poll loop + mode gate
// ---------------------------------------------------------------------------
console.log('\n(c) JobsPanel poll loop and mode gate');
{
  const panelSource = fs.readFileSync('src/ui/modqn-training/JobsPanel.tsx', 'utf8');
  assert(panelSource.includes("appMode === 'modqn-demo'"), 'JobsPanel gates on modqn-demo app mode');
  assert(panelSource.includes('if (!enabled) return null;'), 'JobsPanel component has enabled null return');
  assert(panelSource.includes('if (!pollEnabled) return;'), 'JobsPanel useEffect has pollEnabled early return');
  assert(panelSource.includes('computePollIntervalMs('), 'JobsPanel uses computePollIntervalMs helper');
  assert(panelSource.includes('getJobs('), 'JobsPanel calls getJobs');
  assert(panelSource.includes('getBatch('), 'JobsPanel calls getBatch for sensitivity sweep batches');
  assert(panelSource.includes('collectBatchIds('), 'JobsPanel groups jobs by batchId');
  assert(panelSource.includes('readSubmittedJobIds('), 'JobsPanel reads submitted job history');
  assert(panelSource.includes('clearTimeout('), 'JobsPanel cleans up poll timeout');
  assert(!panelSource.includes('http://127.0.0.1:8765'), 'JobsPanel does not hard-code backend base URL');
  assert(panelSource.includes('role="progressbar"'), 'JobsPanel renders indeterminate progressbar role');
  assert(
    !panelSource.includes('onLoadIntoScene'),
    'D2: JobsPanel no longer exposes load callback; Model Library owns Load into scene',
  );
  assert(
    !panelSource.includes('data-testid="jobs-panel-load-into-scene"'),
    'D2: JobsPanel no longer renders a Load into scene button',
  );
  assert(
    panelSource.includes("j.status === 'failed' || j.status === 'cancelled' || j.status === 'expired'"),
    'D2: JobsPanel keeps failed/cancelled/expired rows in terminal job history',
  );
  assert(
    panelSource.includes('disabled={!cancellable}'),
    'D2: JobsPanel disables cancel outside queued/running statuses',
  );
  assert(
    panelSource.includes('function trainingSpeedFromTelemetry'),
    'D2: JobsPanel computes training speed from telemetry episode deltas',
  );
  assert(
    panelSource.includes('previousEpisodeEvent') && panelSource.includes('lastEpisodeEvent'),
    'D2: JobsPanel training speed uses previous/current producer progress events',
  );
  assert(
    panelSource.includes('data-testid="jobs-panel-training-speed"'),
    'D2: JobsPanel exposes training speed when producer progress deltas are available',
  );
  assert(
    !panelSource.includes('postPauseJob') && !panelSource.includes('postResumeJob'),
    'D2: JobsPanel does not import pause/resume lifecycle helpers',
  );

  const formSource = fs.readFileSync('src/ui/modqn-training/TrainingForm.tsx', 'utf8');
  assert(
    formSource.includes('batchId: response.batchId'),
    'TrainingForm persists batchId with submitted sweep jobs',
  );

  const submittedJobsSource = fs.readFileSync('src/modqn/training-trigger/submittedJobs.ts', 'utf8');
  assert(
    submittedJobsSource.includes('readonly batchId?: string'),
    'submitted job history accepts optional batchId',
  );
}

// ---------------------------------------------------------------------------
// (d) source grep: App.tsx wires jobs tab into MODQN sidebar only
// ---------------------------------------------------------------------------
console.log('\n(d) App.tsx jobs wiring (S4: relocated into the Advanced setup drawer)');
{
  const appSource = fs.readFileSync('src/App.tsx', 'utf8');
  const appRuntimeModelSource = fs.readFileSync('src/app/appRuntimeModel.ts', 'utf8');
  const drawerSource = fs.readFileSync('src/ui/AdvancedSetupDrawer.tsx', 'utf8');

  // S4 drawer move: JobsPanel left the left rail. It now lives inside the
  // AdvancedSetupDrawer (with TrainingForm + the ω-objective editor), reachable
  // via the opt-in Advanced trigger on the MODQN lanes. App imports + mounts the
  // drawer, not JobsPanel directly.
  assert(
    drawerSource.includes("import { JobsPanel } from './modqn-training/JobsPanel';"),
    'Advanced setup drawer imports JobsPanel',
  );
  assert(
    /<JobsPanel\s+appMode=\{appMode\}/.test(drawerSource),
    'Advanced setup drawer renders JobsPanel with appMode',
  );
  assert(
    !appSource.includes("import { JobsPanel } from './ui/modqn-training/JobsPanel';"),
    'App.tsx no longer imports JobsPanel directly (moved to the Advanced drawer)',
  );
  assert(
    appSource.includes("import { AdvancedSetupDrawer } from './ui/AdvancedSetupDrawer';"),
    'App.tsx imports the Advanced setup drawer',
  );
  assert(
    appSource.includes('<AdvancedSetupDrawer'),
    'App.tsx mounts the Advanced setup drawer',
  );
  for (const [needle, label] of [
    ['appMode={appMode}', 'appMode'],
    ['handoverMode={handoverMode}', 'handoverMode'],
    ['modqnVisualLayerPreset={modqnVisualLayerPreset}', 'MODQN visual-layer preset'],
    ["showDecisionPolicyControls={sceneLane === 'modqn-live-cell-preview'}", 'live-cell decision-policy gate'],
    ['onModqnVisualLayerPresetChange={setModqnVisualLayerPreset}', 'MODQN visual-layer setter'],
    ['onModqnDecisionPolicyChange={handleModqnDecisionPolicyChange}', 'MODQN decision-policy setter'],
  ] as const) {
    assert(
      appSource.includes(needle),
      `App.tsx wires Advanced setup drawer ${label}`,
    );
  }

  // The drawer is gated on the MODQN lanes; SINR never shows the Setup tools.
  assert(
    /sceneLane !== 'sinr-live' && \(\s*<AdvancedSetupDrawer/.test(appSource),
    'App.tsx gates the Advanced drawer on the MODQN lanes (never on SINR)',
  );

  // S4: the left rail has no 'setup' tab anymore — neither MODQN nor SINR.
  const leftSidebarTypeLine = appRuntimeModelSource
    .split('\n')
    .find(line => line.includes('type LeftSidebarTab')) ?? '';
  assert(
    !leftSidebarTypeLine.includes("'setup'"),
    'S4: App runtime model LeftSidebarTab union no longer includes a setup tab',
    leftSidebarTypeLine,
  );
  assert(
    !appRuntimeModelSource.includes("key: 'setup'"),
    'S4: App runtime model LEFT_SIDEBAR_TABS no longer includes a Setup entry',
  );
  assert(
    !appSource.includes("activeLeftSidebarTab === 'setup'"),
    "S4: App.tsx no longer renders a 'setup' left tab branch",
  );
}

console.log(`\n[validate-phase-b-jobs-panel] ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
