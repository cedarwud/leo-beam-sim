#!/usr/bin/env node
// validate-phase-b-training-form.tsx
//
// PR-zeta acceptance validator:
//   (a) submittedJobs localStorage helpers preserve newest-first, dedupe, and cap
//   (b) TrainingForm exposes required testids
//   (c) TrainingForm has MODQN-mode gate, clamp, presets, postTrain, and persistence
//   (d) App.tsx wires the training tab into the MODQN sidebar only
//   (e) TRAINER_SUBCOMMANDS stays aligned with the backend allowlist
//
// Run: node --import tsx/esm scripts/validate-phase-b-training-form.tsx

import * as fs from 'node:fs';
import {
  appendSubmittedJobId,
  readSubmittedJobIds,
  SUBMITTED_JOB_IDS_CAP,
} from '../src/modqn/training-trigger/submittedJobs';

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

function extractConstArray(source: string, constName: string): string {
  const start = source.indexOf(`const ${constName}`);
  if (start < 0) return '';
  const end = source.indexOf('];', start);
  if (end < 0) return '';
  return source.slice(start, end + 2);
}

// ---------------------------------------------------------------------------
// (a) submittedJobs localStorage helpers
// ---------------------------------------------------------------------------
console.log('\n(a) submittedJobs localStorage helpers');
{
  const originalWindow = (globalThis as any).window;
  const store = new Map<string, string>();
  (globalThis as any).window = {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
    },
  };

  try {
    appendSubmittedJobId({ jobId: 'A', submittedAtMs: 1, hyperparamSummary: 'x' });
    appendSubmittedJobId({ jobId: 'B', submittedAtMs: 2, hyperparamSummary: 'y' });
    assert(readSubmittedJobIds()[0]?.jobId === 'B', 'submitted jobIds read newest first after two appends');
    assert(readSubmittedJobIds().length === 2, 'submitted jobIds preserve two records');

    appendSubmittedJobId({ jobId: 'A', submittedAtMs: 3, hyperparamSummary: 'z' });
    assert(readSubmittedJobIds().length === 2, 'submitted jobIds dedupe by jobId');
    assert(readSubmittedJobIds()[0]?.jobId === 'A', 'deduped submitted jobId moves to newest first');

    for (let index = 0; index < 51; index++) {
      appendSubmittedJobId({
        jobId: `job-${index}`,
        submittedAtMs: 10 + index,
        hyperparamSummary: `ep=${index}`,
      });
    }
    assert(
      readSubmittedJobIds().length === SUBMITTED_JOB_IDS_CAP,
      'submitted jobIds cap at 50 records',
      `got ${readSubmittedJobIds().length}`,
    );
  } finally {
    if (originalWindow === undefined) {
      delete (globalThis as any).window;
    } else {
      (globalThis as any).window = originalWindow;
    }
  }
}

// ---------------------------------------------------------------------------
// (b) source grep: TrainingForm exposes required testids
// ---------------------------------------------------------------------------
console.log('\n(b) TrainingForm required testids');
{
  const formSource = fs.readFileSync('src/ui/modqn-training/TrainingForm.tsx', 'utf8');
  for (const testId of [
    'data-testid="training-form"',
    'data-testid="training-form-quick"',
    'data-testid="training-form-full"',
    'data-testid="training-form-submit"',
    'data-testid="training-form-episodes-input"',
  ]) {
    assert(formSource.includes(testId), `TrainingForm includes ${testId}`);
  }
}

// ---------------------------------------------------------------------------
// (c) source grep: TrainingForm has mode gate + early return
// ---------------------------------------------------------------------------
console.log('\n(c) TrainingForm mode gate and submit path');
{
  const formSource = fs.readFileSync('src/ui/modqn-training/TrainingForm.tsx', 'utf8');
  assert(formSource.includes("appMode === 'modqn-demo'"), 'TrainingForm gates on modqn-demo app mode');
  assert(formSource.includes('if (!enabled) return null;'), 'TrainingForm component has enabled null return');
  assert(formSource.includes('if (!enabled) return;'), 'TrainingForm useEffect has enabled early return');
  assert(formSource.includes('EPISODES_BACKEND_CAP = 5000'), 'TrainingForm defines 5000 episode backend cap');
  assert(formSource.includes('Full (5000 ep)'), 'TrainingForm uses exact Full preset label');
  assert(formSource.includes('Quick'), 'TrainingForm includes Quick preset label fragment');
  assert(formSource.includes('postTrain'), 'TrainingForm imports/calls postTrain');
  assert(formSource.includes('appendSubmittedJobId'), 'TrainingForm persists submitted jobIds');
}

// ---------------------------------------------------------------------------
// (d) source grep: App.tsx wires training tab into MODQN sidebar only
// ---------------------------------------------------------------------------
console.log('\n(d) App.tsx training tab wiring');
{
  const appSource = fs.readFileSync('src/App.tsx', 'utf8');
  assert(
    appSource.includes("import { TrainingForm } from './ui/modqn-training/TrainingForm';"),
    'App.tsx imports TrainingForm',
  );

  const leftSidebarTypeLine = appSource
    .split('\n')
    .find(line => line.startsWith('type LeftSidebarTab')) ?? '';
  assert(
    leftSidebarTypeLine.includes("'training'"),
    'LeftSidebarTab union includes training',
    leftSidebarTypeLine,
  );
  assert(
    appSource.includes("{ key: 'training', label: 'MODQN training'"),
    'LEFT_SIDEBAR_TABS includes MODQN training entry',
  );
  assert(
    appSource.includes('<TrainingForm appMode={appMode} />'),
    'App.tsx renders TrainingForm with appMode',
  );

  const modqnBlock = extractConstArray(appSource, 'MODQN_LEFT_SIDEBAR_TABS');
  assert(
    modqnBlock.includes('LEFT_SIDEBAR_TABS[3]'),
    'MODQN sidebar includes training tab entry',
    modqnBlock,
  );

  const sinrBlock = extractConstArray(appSource, 'SINR_LEFT_SIDEBAR_TABS');
  assert(
    !sinrBlock.includes('LEFT_SIDEBAR_TABS[3]'),
    'SINR sidebar does not include training tab entry',
    sinrBlock,
  );
  assert(
    !sinrBlock.includes('training'),
    'SINR sidebar block does not contain training literal',
    sinrBlock,
  );
}

// ---------------------------------------------------------------------------
// (e) TRAINER_SUBCOMMANDS aligned with backend
// ---------------------------------------------------------------------------
console.log('\n(e) TRAINER_SUBCOMMANDS backend allowlist');
{
  const formSource = fs.readFileSync('src/ui/modqn-training/TrainingForm.tsx', 'utf8');
  for (const subcommand of ["'baseline'", "'ee-modqn'", "'multi-catfish'"]) {
    assert(formSource.includes(subcommand), `TrainingForm includes trainer subcommand ${subcommand}`);
  }
}

console.log(`\n[validate-phase-b-training-form] ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
