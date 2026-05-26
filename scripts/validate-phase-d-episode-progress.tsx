#!/usr/bin/env node
// validate-phase-d-episode-progress.tsx
//
// PR-omicron / D-S7 acceptance validator:
//   (a) JobsPanel source keeps active-card controls and adds percent mode
//   (b) parseEpisodeProgress pure helper
//   (c) SSR fallback with no stdoutTail detail
//   (d) SSR fallback with stdoutTail but no episode match
//   (e) SSR determinate percent mode with episode progress
//   (f) Cross-repo prerequisite absence regression
//
// Run: node --import tsx/esm scripts/validate-phase-d-episode-progress.tsx

import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import type {
  TrainingJobDetail,
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

function countOccurrences(source: string, needle: string): number {
  let count = 0;
  let index = source.indexOf(needle);
  while (index >= 0) {
    count++;
    index = source.indexOf(needle, index + needle.length);
  }
  return count;
}

function assertJsonEqual(actual: unknown, expected: unknown, label: string): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  assert(
    actualJson === expectedJson,
    label,
    `expected ${expectedJson}, got ${actualJson}`,
  );
}

function withoutReactTextMarkers(html: string): string {
  return html.replaceAll('<!-- -->', '');
}

const require = createRequire(import.meta.url);
const React = require('react');
let mockStateSlots: readonly unknown[] = [];
let mockStateIndex = 0;

React.useState = (initialState: unknown) => {
  const slot = mockStateSlots[mockStateIndex++];
  return [slot === undefined ? initialState : slot, () => undefined];
};

const jobsPanelModule = await import('../src/ui/modqn-training/JobsPanel');
const { renderToString } = await import('react-dom/server');
const { JobsPanel, parseEpisodeProgress } = jobsPanelModule;

const ACTIVE_JOB_ID = 'job-active-progress-001';

function activeJob(): TrainingJobSummary {
  return {
    jobId: ACTIVE_JOB_ID,
    status: 'running',
    submittedAtMs: 1_700_000_000_000,
    startedAtMs: 1_700_000_000_000,
    trainerSubcommand: 'ee-modqn',
    hyperparamSummary: 'episodes=5000',
  };
}

function activeDetail(stdoutTail: string): TrainingJobDetail {
  return {
    ...activeJob(),
    hyperparams: { episodes: 5000 },
    stdoutTail,
  };
}

function renderJobsPanelWithActiveJob(
  detail: Record<string, TrainingJobDetail | undefined>,
): string {
  mockStateSlots = [[activeJob()], [], false, detail];
  mockStateIndex = 0;
  return renderToString(React.createElement(JobsPanel, { appMode: 'modqn-demo' }));
}

// ---------------------------------------------------------------------------
// (a) Source grep on src/ui/modqn-training/JobsPanel.tsx
// ---------------------------------------------------------------------------
console.log('\n(a) Source grep on src/ui/modqn-training/JobsPanel.tsx');
{
  const source = fs.readFileSync('src/ui/modqn-training/JobsPanel.tsx', 'utf8');
  assert(source.includes('export function parseEpisodeProgress'), 'JobsPanel exports parseEpisodeProgress');
  assert(
    countOccurrences(source, 'data-testid="jobs-panel-active-card-percent"') === 1,
    'JobsPanel contains jobs-panel-active-card-percent exactly once',
  );
  assert(source.includes('data-testid="jobs-panel-active-card"'), 'JobsPanel still contains active-card testid');
  assert(
    source.includes('data-testid="jobs-panel-refresh-detail"'),
    'JobsPanel still contains refresh-detail testid',
  );
  assert(
    source.includes('leo-jobs-panel__progress-indeterminate'),
    'JobsPanel still contains indeterminate progress fallback class',
  );
  assert(
    source.includes('className="leo-jobs-panel__progress-determinate"'),
    'JobsPanel contains determinate progress class',
  );
}

// ---------------------------------------------------------------------------
// (b) Helper unit parseEpisodeProgress
// ---------------------------------------------------------------------------
console.log('\n(b) Helper unit parseEpisodeProgress');
{
  assertJsonEqual(parseEpisodeProgress(undefined), null, 'undefined input returns null');
  assertJsonEqual(parseEpisodeProgress(''), null, 'empty input returns null');
  assertJsonEqual(parseEpisodeProgress('warming up...'), null, 'no-match input returns null');
  assertJsonEqual(
    parseEpisodeProgress('episode 250 / 5000'),
    { current: 250, total: 5000, percent: 5 },
    'episode 250 / 5000 parses to 5%',
  );
  assertJsonEqual(
    parseEpisodeProgress('episode 1 / 1'),
    { current: 1, total: 1, percent: 100 },
    'episode 1 / 1 parses to 100%',
  );
  assertJsonEqual(
    parseEpisodeProgress('episode 0 / 1000'),
    { current: 0, total: 1000, percent: 0 },
    'episode 0 / 1000 parses to 0%',
  );
  assertJsonEqual(
    parseEpisodeProgress('episode 1 / 100\nsome line\nepisode 50 / 100'),
    { current: 50, total: 100, percent: 50 },
    'last matching episode pair wins',
  );
  assertJsonEqual(
    parseEpisodeProgress('episode  42/100'),
    { current: 42, total: 100, percent: 42 },
    'whitespace variations parse',
  );
  assertJsonEqual(parseEpisodeProgress('episode 5 / 0'), null, 'zero total returns null');
  assertJsonEqual(
    parseEpisodeProgress('episode -1 / 100'),
    null,
    'negative-ish input is rejected by the strict digit regex',
  );
  assertJsonEqual(
    parseEpisodeProgress('episode 999 / 100'),
    { current: 999, total: 100, percent: 100 },
    'over-100 percent clamps to 100',
  );
}

// ---------------------------------------------------------------------------
// (c) SSR fallback with no stdoutTail detail
// ---------------------------------------------------------------------------
console.log('\n(c) SSR fallback with no stdoutTail detail');
{
  const html = renderJobsPanelWithActiveJob({});
  assert(html.includes('data-testid="jobs-panel-active-card"'), 'SSR includes active-card testid');
  assert(
    html.includes('leo-jobs-panel__progress-indeterminate'),
    'SSR includes indeterminate progress fallback',
  );
  assert(
    !html.includes('jobs-panel-active-card-percent'),
    'SSR omits percent testid without stdoutTail',
  );
  assert(
    !html.includes('leo-jobs-panel__progress-determinate'),
    'SSR omits determinate progress without stdoutTail',
  );
}

// ---------------------------------------------------------------------------
// (d) SSR fallback with stdoutTail but no episode match
// ---------------------------------------------------------------------------
console.log('\n(d) SSR fallback with stdoutTail but no episode match');
{
  const html = renderJobsPanelWithActiveJob({
    [ACTIVE_JOB_ID]: activeDetail('warming up...'),
  });
  assert(
    !html.includes('jobs-panel-active-card-percent'),
    'SSR omits percent testid for stdoutTail without match',
  );
  assert(
    html.includes('leo-jobs-panel__progress-indeterminate'),
    'SSR keeps indeterminate fallback for stdoutTail without match',
  );
}

// ---------------------------------------------------------------------------
// (e) SSR determinate percent mode with episode progress
// ---------------------------------------------------------------------------
console.log('\n(e) SSR determinate percent mode with episode progress');
{
  const html = renderJobsPanelWithActiveJob({
    [ACTIVE_JOB_ID]: activeDetail('Training started\nepisode 250 / 5000\nLoss: 0.42'),
  });
  const textHtml = withoutReactTextMarkers(html);
  assert(html.includes('jobs-panel-active-card-percent'), 'SSR includes percent testid');
  assert(textHtml.includes('episode 250 / 5000 · 5%'), 'SSR includes formatted percent readout');
  assert(html.includes('aria-valuenow="5"'), 'SSR includes aria-valuenow=5');
  assert(
    html.includes('leo-jobs-panel__progress-determinate'),
    'SSR includes determinate progress container',
  );
  assert(
    html.includes('width:5%') || html.includes('width: 5%'),
    'SSR includes determinate fill width style',
  );
  assert(
    !html.includes('leo-jobs-panel__progress-indeterminate'),
    'SSR replaces indeterminate progress in percent mode',
  );
}

// ---------------------------------------------------------------------------
// (f) Cross-repo prerequisite absence regression
// ---------------------------------------------------------------------------
console.log('\n(f) Cross-repo prerequisite absence regression');
{
  assertJsonEqual(
    parseEpisodeProgress('Training started\nLoss: 0.42\nValidation accuracy: 0.85'),
    null,
    'realistic backend output without episode format returns null',
  );
  assertJsonEqual(
    parseEpisodeProgress('Episode 100/5000'),
    null,
    'capitalized Episode output is rejected by the case-sensitive regex',
  );
}

console.log(`\n[validate-phase-d-episode-progress] ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
