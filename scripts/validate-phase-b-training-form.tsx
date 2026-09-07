#!/usr/bin/env node
// validate-phase-b-training-form.tsx
//
// PR-zeta acceptance validator:
//   (a) submittedJobs localStorage helpers preserve newest-first, dedupe, and cap
//   (b) TrainingForm exposes required testids
//   (c) TrainingForm has MODQN-mode gate, clamp, presets, postTrain, and persistence
//   (d) App.tsx wires the Advanced drawer; the drawer hosts TrainingForm
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
    appendSubmittedJobId({ jobId: 'B', batchId: 'batch-1', submittedAtMs: 2, hyperparamSummary: 'y' });
    assert(readSubmittedJobIds()[0]?.jobId === 'B', 'submitted jobIds read newest first after two appends');
    assert(readSubmittedJobIds().length === 2, 'submitted jobIds preserve two records');
    assert(readSubmittedJobIds()[0]?.batchId === 'batch-1', 'submitted jobIds preserve optional batchId');

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
    'data-testid="training-form-coverage-estimate"',
    'data-testid="training-form-theta3db-deg"',
    'data-testid="training-form-random-wandering-max-turn"',
    'data-testid="training-form-atmospheric-loss"',
    'data-testid="training-form-main-share-floor"',
    'data-testid="training-form-vdn-loss-scale"',
    'data-testid="training-form-snapshot-batch-size"',
    'data-testid="training-form-softmax-temperature"',
    'data-testid="training-form-eval-qos-tiers"',
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
  const modelSource = fs.readFileSync('src/ui/modqn-training/trainingFormModel.ts', 'utf8');
  assert(formSource.includes("appMode === 'modqn-demo'"), 'TrainingForm gates on modqn-demo app mode');
  assert(formSource.includes('if (!enabled) return null;'), 'TrainingForm component has enabled null return');
  assert(formSource.includes('if (!enabled) return;'), 'TrainingForm useEffect has enabled early return');
  assert(modelSource.includes('EPISODES_BACKEND_CAP = 5000'), 'TrainingForm model defines 5000 episode backend cap');
  assert(formSource.includes('Full (5000 ep)'), 'TrainingForm uses exact Full preset label');
  assert(formSource.includes('Quick'), 'TrainingForm includes Quick preset label fragment');
  assert(formSource.includes('postTrain'), 'TrainingForm imports/calls postTrain');
  assert(formSource.includes('appendSubmittedJobId'), 'TrainingForm persists submitted jobIds');
  assert(formSource.includes('<legend>Training Objective (ω config)</legend>'), 'TrainingForm owns objective weights in training flow');
  assert(formSource.includes('Coverage estimate'), 'TrainingForm shows beamwidth-to-UE coverage estimate');
  assert(modelSource.includes('theta3dbDeg: state.theta3dbDeg'), 'TrainingForm model submits beamwidth theta3dbDeg');
  assert(
    modelSource.includes("ueDistribution: 'uniform-rectangle'"),
    'TrainingForm model defaults to paper 200x90 km rectangular UE distribution',
  );
  assert(
    modelSource.includes("'track2.envAxes.qosThresholdBps': evalOnlyQosThresholds"),
    'TrainingForm model submits evaluation-only QoS tiers under evalOnlyAxes',
  );
  assert(formSource.includes('postSensitivitySweep'), 'TrainingForm imports/calls postSensitivitySweep');
}

// ---------------------------------------------------------------------------
// (d) source grep: App.tsx wires the Advanced drawer; drawer hosts TrainingForm
// ---------------------------------------------------------------------------
console.log('\n(d) Advanced drawer training wiring');
{
  const appSource = fs.readFileSync('src/App.tsx', 'utf8');
  const appRuntimeModelSource = fs.readFileSync('src/app/appRuntimeModel.ts', 'utf8');
  const drawerSource = fs.readFileSync('src/ui/AdvancedSetupDrawer.tsx', 'utf8');
  // Removed implementation-detail pin: AdvancedSetupDrawer's direct import path is not a runtime contract.
  assert(
    appSource.includes('<AdvancedSetupDrawer'),
    'App.tsx mounts AdvancedSetupDrawer',
  );
  assert(
    drawerSource.includes("import { TrainingForm } from './modqn-training/TrainingForm';"),
    'AdvancedSetupDrawer imports TrainingForm',
  );
  assert(
    drawerSource.includes('<TrainingForm appMode={appMode} />'),
    'AdvancedSetupDrawer renders TrainingForm with appMode',
  );

  const leftSidebarTypeLine = appRuntimeModelSource
    .split('\n')
    .find(line => line.includes('type LeftSidebarTab')) ?? '';
  assert(
    !leftSidebarTypeLine.includes("'training'"),
    'S4: App runtime model LeftSidebarTab union no longer includes training',
    leftSidebarTypeLine,
  );
  assert(
    !appRuntimeModelSource.includes("{ key: 'training', label: 'MODQN training'"),
    'S4: App runtime model LEFT_SIDEBAR_TABS no longer includes MODQN training entry',
  );

  const modqnBlock = extractConstArray(appRuntimeModelSource, 'MODQN_LEFT_SIDEBAR_TABS');
  assert(
    !modqnBlock.includes('training'),
    'S4: MODQN sidebar block does not include training literal',
    modqnBlock,
  );
  assert(
    !modqnBlock.includes('LEFT_SIDEBAR_TABS[0]'),
    'App runtime model MODQN sidebar no longer exposes legacy objective tab',
    modqnBlock,
  );
  assert(
    appRuntimeModelSource.includes("return 'evidence';"),
    'S4: App runtime model defaults MODQN sidebar to Evidence/Replay tab',
  );

  const sinrBlock = extractConstArray(appRuntimeModelSource, 'SINR_LEFT_SIDEBAR_TABS');
  assert(
    !sinrBlock.includes('training'),
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
  const appRuntimeModelSource = fs.readFileSync('src/app/appRuntimeModel.ts', 'utf8');
  const formSource = fs.readFileSync('src/ui/modqn-training/trainingFormModel.ts', 'utf8');
  const modqnBlock = extractConstArray(appRuntimeModelSource, 'MODQN_LEFT_SIDEBAR_TABS');
  assert(
    !modqnBlock.includes('training'),
    'S4: App runtime model MODQN sidebar keeps TrainingForm in Advanced drawer, not a left tab',
    modqnBlock,
  );
  assert(
    appRuntimeModelSource.includes("return 'evidence';"),
    'S4: App runtime model defaults MODQN sidebar to Evidence/Replay tab',
  );
  for (const subcommand of ["'baseline'", "'multi-catfish'"]) {
    assert(formSource.includes(subcommand), `TrainingForm includes trainer subcommand ${subcommand}`);
  }
  assert(
    formSource.includes("arm === 'a1' ? 'baseline' : 'multi-catfish'"),
    'TrainingForm maps Track-2 a1 to baseline and a4/a5_hobs to multi-catfish',
  );
}

console.log(`\n[validate-phase-b-training-form] ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
