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

function extractConstArray(source: string, constName: string): string {
  const start = source.indexOf(`const ${constName}`);
  if (start < 0) return '';
  const end = source.indexOf('];', start);
  if (end < 0) return '';
  return source.slice(start, end + 2);
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
  assert(isActiveStatus('paused') === true, 'isActiveStatus accepts paused');
  assert(isActiveStatus('done') === false, 'isActiveStatus rejects done');
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
    'data-testid="jobs-panel-done-card"',
    'data-testid="jobs-panel-load-into-scene"',
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
  assert(panelSource.includes('if (!enabled) return;'), 'JobsPanel useEffect has enabled early return');
  assert(panelSource.includes('computePollIntervalMs('), 'JobsPanel uses computePollIntervalMs helper');
  assert(panelSource.includes('getJobs('), 'JobsPanel calls getJobs');
  assert(panelSource.includes('getBatch('), 'JobsPanel calls getBatch for sensitivity sweep batches');
  assert(panelSource.includes('collectBatchIds('), 'JobsPanel groups jobs by batchId');
  assert(panelSource.includes('readSubmittedJobIds('), 'JobsPanel reads submitted job history');
  assert(panelSource.includes('clearTimeout('), 'JobsPanel cleans up poll timeout');
  assert(!panelSource.includes('http://127.0.0.1:8765'), 'JobsPanel does not hard-code backend base URL');
  assert(panelSource.includes('role="progressbar"'), 'JobsPanel renders indeterminate progressbar role');
  assert(panelSource.includes('onLoadIntoScene'), 'JobsPanel exposes optional load callback prop');

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
console.log('\n(d) App.tsx jobs tab wiring');
{
  const appSource = fs.readFileSync('src/App.tsx', 'utf8');
  const appRuntimeModelSource = fs.readFileSync('src/app/appRuntimeModel.ts', 'utf8');
  assert(
    appSource.includes("import { JobsPanel } from './ui/modqn-training/JobsPanel';"),
    'App.tsx imports JobsPanel',
  );
  assert(
    /<JobsPanel\s+appMode=\{appMode\}/.test(appSource),
    'App.tsx renders JobsPanel with appMode',
  );

  // S3 purpose-merge: JobsPanel no longer owns a dedicated 'jobs' left tab; it
  // lives inside the unified MODQN 'Setup' left tab (with TrainingForm + the
  // ω-objective editor). It must render in the MODQN Setup branch, never in SINR.
  const leftSidebarTypeLine = appRuntimeModelSource
    .split('\n')
    .find(line => line.includes('type LeftSidebarTab')) ?? '';
  assert(
    leftSidebarTypeLine.includes("'setup'"),
    'App runtime model LeftSidebarTab union includes the unified setup tab',
    leftSidebarTypeLine,
  );
  assert(
    appRuntimeModelSource.includes("{ key: 'setup', label: 'Setup'"),
    'App runtime model LEFT_SIDEBAR_TABS includes the Setup entry (hosts jobs)',
  );

  const modqnBlock = extractConstArray(appRuntimeModelSource, 'MODQN_LEFT_SIDEBAR_TABS');
  assert(
    modqnBlock.includes('LEFT_SIDEBAR_TABS[3]'),
    'App runtime model MODQN sidebar includes the Setup tab entry',
    modqnBlock,
  );

  const sinrBlock = extractConstArray(appRuntimeModelSource, 'SINR_LEFT_SIDEBAR_TABS');
  assert(
    !sinrBlock.includes('LEFT_SIDEBAR_TABS[3]'),
    'SINR sidebar does not include the Setup tab entry',
    sinrBlock,
  );
  assert(
    !sinrBlock.includes('setup'),
    'SINR sidebar block does not contain the setup literal',
    sinrBlock,
  );

  const setupBranchIndex = appSource.indexOf("activeLeftSidebarTab === 'setup'");
  const jobsInSetupBranch = /activeLeftSidebarTab === 'setup'[\s\S]*?<JobsPanel/.test(appSource);
  assert(
    setupBranchIndex > -1 && jobsInSetupBranch,
    "App.tsx renders JobsPanel inside the unified 'setup' left tab branch",
  );
}

console.log(`\n[validate-phase-b-jobs-panel] ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
