#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createInitialSimState } from '../src/scene/initialSimState';
import type { SimState } from '../src/scene/types';
import { loadProfile } from '../src/profiles';
import { DiagnosticsDrawer } from '../src/ui/DiagnosticsDrawer';
import { buildPublishedPerUePositions } from '../src/scene/useSimStatePublisher';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');

let passed = 0;
let failed = 0;

function pass(label: string): void {
  console.log(`  [PASS] ${label}`);
  passed += 1;
}

function fail(label: string, detail?: string): void {
  console.error(`  [FAIL] ${label}${detail ? `: ${detail}` : ''}`);
  failed += 1;
}

function check(condition: boolean, label: string, detail?: string): void {
  if (condition) {
    pass(label);
  } else {
    fail(label, detail);
  }
}

function section(label: string, fn: () => void): void {
  console.log(`\n${label}`);
  try {
    fn();
  } catch (error) {
    fail(label, error instanceof Error ? error.message : String(error));
  }
}

function source(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function renderDrawer(perUePositions: SimState['perUePositions']): string {
  const profile = loadProfile('hobs-2024-candidate-rich');
  const simState: SimState = {
    ...createInitialSimState(profile),
    simTimeSec: 12,
    beamHopSlotSec: profile.beamHopping.slotSec,
    perUePositions,
  };

  return renderToStaticMarkup(
    <DiagnosticsDrawer
      {...simState}
      expanded
      profile={profile}
    />,
  );
}

function perUeEntries(count: number): NonNullable<SimState['perUePositions']> {
  return Array.from({ length: count }, (_, index) => ({
    id: `live-ue-${index}`,
    servingSatId: index % 2 === 0 ? 'sat-0' : 'sat-1',
    servingBeamId: index % 3,
    sinrDb: -12.5 - index,
  }));
}

function countOccurrences(value: string, pattern: string): number {
  return value.split(pattern).length - 1;
}

function assertAbsent(markup: string, testId: string, label: string): void {
  check(!markup.includes(`data-testid="${testId}"`), label);
}

function assertPresent(markup: string, testId: string, label: string): void {
  check(markup.includes(`data-testid="${testId}"`), label);
}

section('(a) SimState.perUePositions source contract', () => {
  // S4-2: per-field asserts on the record block (comment-tolerant) instead of a
  // whitespace-only monolithic regex — the record gained the typed
  // `servingCellId` (pun retirement) plus doc comments between fields.
  const typesSource = source('src/scene/types.ts');
  const blockMatch = typesSource.match(/perUePositions\?:\s*ReadonlyArray<\{([\s\S]*?)\}>;/m);
  check(blockMatch !== null, 'SimState.perUePositions optional ReadonlyArray record declared');
  const block = blockMatch?.[1] ?? '';
  for (const field of [
    'id: string;',
    'servingSatId: string | null;',
    'servingBeamId: number | null;',
    'servingCellId: number | null;',
    'sinrDb: number | null;',
  ]) {
    check(block.includes(field), `perUePositions record declares ${field}`);
  }
});

section('(b) useSimStatePublisher per-UE projection', () => {
  const publisherSource = source('src/scene/useSimStatePublisher.ts');
  check(
    /sim\.perUePositions\.length\s*>\s*1[\s\S]*sim\.perUePositions\.map\(/m.test(publisherSource),
    'publisher maps SimFrame.perUePositions only when length > 1',
  );
  for (const expected of [
    'id: position.id',
    'servingSatId: position.servingSatId',
    'servingBeamId: position.servingBeamId',
    'sinrDb: position.sinrDb',
  ]) {
    check(publisherSource.includes(expected), `publisher copies compact field ${expected}`);
  }
  // S4-3: the old ordering-sensitive regex (`length > 1 … : undefined;`) never
  // matched the projection's actual collapse text (`: undefined)`) — it only
  // happened to match unrelated latch lines depending on file order. Replaced
  // with a BEHAVIOURAL check on the exported projection itself.
  const soloSteered = { perUePositions: [{ id: 'solo', eastKm: 0, northKm: 0, servingSatId: 'S', servingBeamId: 1, sinrDb: 5 }] };
  check(
    buildPublishedPerUePositions(soloSteered as unknown as Parameters<typeof buildPublishedPerUePositions>[0]) === undefined,
    'publisher collapses SimState.perUePositions to undefined when length <= 1 (steered branch, behavioural)',
  );
  const soloCell = {
    perUePositions: [],
    sinrLiveCells: { ues: [{ ueId: 'solo', cellId: 0, cellDistanceKm: 0, offAxisDeg: 0, servingSatId: 'S', beamIdentity: 'S#cell0', frequencyIndex: 0, sinrDb: 5, handoverKind: 'none' }] },
  };
  check(
    buildPublishedPerUePositions(soloCell as unknown as Parameters<typeof buildPublishedPerUePositions>[0]) === undefined,
    'publisher collapses SimState.perUePositions to undefined when length <= 1 (cell branch, behavioural)',
  );
});

section('(c) DiagnosticsDrawer source contract', () => {
  const drawerSource = source('src/ui/DiagnosticsDrawer.tsx');
  for (const testId of [
    'per-ue-diagnostics-section',
    'per-ue-diagnostics-table',
    'per-ue-diagnostics-overflow-note',
  ]) {
    check(drawerSource.includes(testId), `DiagnosticsDrawer contains ${testId}`);
  }
  check(
    drawerSource.includes('perUePositions !== undefined && perUePositions.length > 1'),
    'DiagnosticsDrawer gates section on perUePositions !== undefined && length > 1',
  );
  check(drawerSource.includes('PER_UE_DIAGNOSTICS_ROW_LIMIT = 20'), 'DiagnosticsDrawer caps display rows at 20');
});

section('(d) SSR undefined perUePositions hides table', () => {
  const markup = renderDrawer(undefined);
  assertAbsent(markup, 'per-ue-diagnostics-section', 'section absent when perUePositions is undefined');
  assertAbsent(markup, 'per-ue-diagnostics-table', 'table absent when perUePositions is undefined');
  assertAbsent(markup, 'per-ue-diagnostics-overflow-note', 'overflow note absent when perUePositions is undefined');
});

section('(e) SSR single UE hides table', () => {
  const markup = renderDrawer([
    { id: 'live-ue-0', servingSatId: 'sat-0', servingBeamId: 1, sinrDb: -12.5 },
  ]);
  assertAbsent(markup, 'per-ue-diagnostics-section', 'section absent when perUePositions length is 1');
  assertAbsent(markup, 'per-ue-diagnostics-table', 'table absent when perUePositions length is 1');
  assertAbsent(markup, 'per-ue-diagnostics-overflow-note', 'overflow note absent when perUePositions length is 1');
});

section('(f) SSR multi-UE table renders rows and SINR', () => {
  const markup = renderDrawer([
    { id: 'live-ue-0', servingSatId: 'sat-0', servingBeamId: 1, sinrDb: -12.5 },
    { id: 'live-ue-1', servingSatId: 'sat-1', servingBeamId: 2, sinrDb: -8.25 },
    { id: 'live-ue-2', servingSatId: null, servingBeamId: null, sinrDb: null },
  ]);
  assertPresent(markup, 'per-ue-diagnostics-section', 'section present for length 3');
  assertPresent(markup, 'per-ue-diagnostics-table', 'table present for length 3');
  check(countOccurrences(markup, '<tr><td>') === 3, 'table body renders exactly 3 rows');
  check(markup.includes('-12.5 dB'), 'SINR -12.5 formats through formatDb');
  check(markup.includes('-8.3 dB'), 'SINR -8.25 formats through formatDb to one decimal');
  check(markup.includes('<td>—</td><td>—</td><td>—</td>'), 'null serving and SINR values render as em dashes');
});

section('(g) SSR overflow caps table at 20 rows', () => {
  const markup = renderDrawer(perUeEntries(25));
  assertPresent(markup, 'per-ue-diagnostics-section', 'section present for length 25');
  assertPresent(markup, 'per-ue-diagnostics-table', 'table present for length 25');
  assertPresent(markup, 'per-ue-diagnostics-overflow-note', 'overflow note present for length 25');
  check(countOccurrences(markup, '<tr><td>') === 20, 'table body renders exactly 20 capped rows');
  check(markup.includes('... and 5 more UEs'), 'overflow note reports "... and 5 more UEs"');
  check(markup.includes('live-ue-19'), 'last displayed capped row is live-ue-19');
  check(!markup.includes('live-ue-20'), 'live-ue-20 is hidden by display cap');
});

section('(h) replay adapter negative assertion', () => {
  const replaySource = source('src/showcase/showcaseArtifactToScene.ts');
  check(
    !/perUePositions|per-UE diagnostics|per-ue-diagnostics|PER_UE_DIAGNOSTICS/i.test(replaySource),
    'showcaseArtifactToScene.ts has no per-UE diagnostics references',
  );
  const worktreeDiff = execFileSync('git', ['diff', '--', 'src/showcase/showcaseArtifactToScene.ts'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  const stagedDiff = execFileSync('git', ['diff', '--cached', '--', 'src/showcase/showcaseArtifactToScene.ts'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  check(worktreeDiff.trim() === '' && stagedDiff.trim() === '', 'showcaseArtifactToScene.ts has no git diff');
});

console.log(`\n[validate-phase-f-per-ue-diagnostics] ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
