#!/usr/bin/env node

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(path: string): string {
  return readFileSync(join(ROOT_DIR, path), 'utf8');
}

function assertIncludes(source: string, needle: string, label: string): void {
  assert.ok(source.includes(needle), `${label} missing ${needle}`);
}

function assertNotIncludes(source: string, needle: string, label: string): void {
  assert.ok(!source.includes(needle), `${label} unexpectedly includes ${needle}`);
}

function checklistBlocks(source: string): readonly string[] {
  const starts = [...source.matchAll(/^- \[x\] \*\*[A-K][0-9]\./gm)]
    .map(match => match.index)
    .filter((index): index is number => typeof index === 'number');
  const boundaries = [...source.matchAll(/^- \[[x ]\] \*\*[A-K][0-9]\.|^## /gm)]
    .map(match => match.index)
    .filter((index): index is number => typeof index === 'number');
  return starts.map(start => {
    const end = boundaries.find(index => index > start) ?? source.length;
    return source.slice(start, end);
  });
}

console.log('validate-modqn-showcase-final-audit');

const todo = read('docs/modqn-showcase-requirements-todo.md');
const sddIndex = read('docs/sdd-index.md');

assertNotIncludes(todo, '- [ ]', 'final TODO checklist has no unchecked items');
assertIncludes(todo, '## K. Final Completion Audit', 'final audit section exists');
for (const item of [
  'K1. Every completed item has validation evidence.',
  'K2. Every source gap remains visible.',
  'K3. Existing `:3001` browser checks pass for visible changes.',
  'K4. Old SDDs are not reactivated accidentally.',
  'K5. User-facing final report checks this TODO line by line.',
]) {
  assertIncludes(todo, `- [x] **${item}**`, `final checklist item ${item}`);
}
for (const block of checklistBlocks(todo)) {
  assertIncludes(block, 'Evidence:', `checked item has evidence: ${block.split('\n')[0]}`);
}

assertIncludes(sddIndex, '## Current Active Development Entry Points', 'SDD index keeps active entry points');
assertIncludes(sddIndex, '## Reference Documents', 'SDD index has reference classification');
assertIncludes(sddIndex, '## Superseded Or Historical Documents', 'SDD index has superseded classification');
assertIncludes(sddIndex, 'Current delete candidates: none.', 'SDD index has no current delete candidates');
assertIncludes(sddIndex, '`sdd_review_report.md`', 'SDD index records the deleted placeholder');
assert.ok(
  !existsSync(join(ROOT_DIR, 'docs/sdd_review_report.md')),
  'empty sdd_review_report.md placeholder was deleted',
);

const artifactPicker = read('src/ui/modqn-training/ArtifactPicker.tsx');
for (const phrase of [
  'data-testid="artifact-picker-paper-faithful-entry"',
  'data-artifact-kind="paper-faithful"',
  'data-testid="artifact-picker-producer-empty"',
  'data-artifact-kind="producer-official"',
  'data-testid="artifact-picker-synthetic-entry"',
  'data-artifact-kind="synthetic-fixture"',
  'Not loadable as MODQN proof',
  'const loadableJobs = doneJobs.filter(job => isLoadableManifest(manifestsById[job.jobId]))',
  'disabled={!isLoadableManifest(manifest)}',
]) {
  assertIncludes(artifactPicker, phrase, `D7 model/artifact library contract ${phrase}`);
}

const app = read('src/App.tsx');
assertIncludes(app, 'onLoadPaperFaithful={handleRevertToPaperFaithful}', 'D7 paper-faithful load is wired through Model Library');
assertIncludes(app, 'artifactReplaySource={showcaseArtifactSource}', 'D7 synthetic/non-producer source is visible in Model Library');

const queueModel = read('src/scene/sinrServingMosaic.ts');
assertIncludes(queueModel, 'deriveSinrLiveServiceQueueFocusStories', 'H5/I5 queue focus model exists');
assertIncludes(queueModel, "'highest-pressure'", 'H5/I5 highest-pressure story kind exists');
assertIncludes(queueModel, "'best-rescue'", 'H5/I5 best-rescue story kind exists');

const aggregatePanel = read('src/ui/SinrServingAggregate.tsx');
assertIncludes(aggregatePanel, 'data-testid="sinr-service-queue-focus-stories"', 'H5/I5 queue focus panel exists');
assertIncludes(aggregatePanel, 'data-queue-focus-kind={story.kind}', 'H5/I5 queue focus rows expose story kind');
assertIncludes(aggregatePanel, 'data-service-surplus-bits={Math.round(story.serviceSurplusBits)}', 'I5 service surplus is exposed');
assertIncludes(aggregatePanel, 'live SINR serving · not MODQN · queue demo', 'queue focus stays lane/source labeled');

const browserGate = read('scripts/validate-phase-c-sinr-serving-mosaic-browser.ts');
assertIncludes(browserGate, 'data-testid="sinr-service-queue-focus-stories"', 'browser gate checks queue focus panel');
assertIncludes(browserGate, 'highestPressureUe', 'browser gate checks highest-pressure focus');
assertIncludes(browserGate, 'bestRescueUe', 'browser gate checks best-rescue focus');
assertIncludes(browserGate, 'queueFocusRows === 2', 'browser gate requires both queue focus rows');

const sourceGaps = read('src/modqn/replay-source-gaps/sourceGaps.ts');
for (const field of [
  'diagnostics.denseQPolicy',
  'traffic.queueRows',
  'beamHopping.activeSchedule',
  'beamHopping.nextSchedule',
]) {
  assertIncludes(sourceGaps, field, `source gap ${field} remains registered`);
}

const replayCue = read('src/ui/ModqnReplayCuePanel.tsx');
assertIncludes(replayCue, 'data-testid="modqn-replay-cinema-readiness"', 'D6 replay readiness source-gap stamp remains visible');
assertIncludes(replayCue, 'data-source-gap-fields={sourceGapFields}', 'D6 readiness exposes source-gap fields');

const replayCinemaGate = read('src/modqn/replay-bundle/replayHandoverCinemaGate.ts');
for (const forbidden of ['liveWalker', '../scene', 'useHandoverCinema']) {
  assertNotIncludes(replayCinemaGate, forbidden, `D6 replay gate stays consumer-only: ${forbidden}`);
}

const beamAudit = read('docs/beam-presentation-calibration-audit.md');
assertIncludes(beamAudit, 'This document is intentionally an audit, not a visual patch.', 'D7 beam work stayed audit-only');
assertIncludes(beamAudit, 'Do not widen beams or increase steering angle', 'D7 stop rule remains documented');

assertIncludes(todo, 'APP_URL=http://localhost:3001 npm run validate:phase-c:sinr-serving-mosaic:browser', 'final checklist records 3001 queue browser gate');
assertIncludes(todo, 'APP_URL=http://localhost:3001 npm run capture:beam-presentation-audit', 'final checklist records 3001 beam audit capture');
assertIncludes(todo, 'npm run validate:modqn:showcase-final-audit', 'final checklist records final audit validator');

console.log('PASS: MODQN showcase TODO/SDD final audit guardrails are complete');
