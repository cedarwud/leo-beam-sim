#!/usr/bin/env node
// validate-phase-d-decision-viz.tsx
//
// PR-nu / D-S5 acceptance validator:
//   (a) DecisionVizPanel source contract and charting dependency ban
//   (b) App.tsx imports and mounts DecisionVizPanel after RewardCurvePanel
//   (c) helper returns null for envelope=null
//   (d) helper reads focused-row policyDiagnostics
//   (e) helper returns null when focused row lacks policyDiagnostics
//   (f) helper reads dense scores and matching validity mask
//   (g) helper keeps denseScores null when denseActionScores is absent
//   (h) helper ignores length-mismatched dense validity mask
//   (i) SSR empty state contains root only
//   (j) SSR loaded state contains top-K, dense, and weights
//   (k) SSR loaded state without dense omits dense section
//   (l) DecisionVizPanel remains in the MODQN branch
//
// Run: node --import tsx/esm scripts/validate-phase-d-decision-viz.tsx

import * as fs from 'node:fs';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  MODQN_USER_TRAINED_MODE_KEY,
  createModqnReplayEnvelopeFromContents,
  type ModqnPolicyDiagnostics,
  type ModqnReplayBundleContents,
  type ModqnReplayEnvelope,
  type ModqnReplayTimelineRow,
} from '../src/modqn/replay-bundle';
import {
  DecisionVizPanel,
  buildDecisionVizFocusSnapshot,
} from '../src/ui/modqn-training/DecisionVizPanel';

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

function extractBalancedTag(source: string, tagStart: string): string {
  const start = source.indexOf(tagStart);
  if (start === -1) return '';
  const open = source.indexOf('>', start);
  if (open === -1) return '';

  let depth = 1;
  let index = open + 1;
  while (index < source.length) {
    const nextOpen = source.indexOf('<section', index);
    const nextClose = source.indexOf('</section>', index);
    if (nextClose === -1) return '';
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      index = nextOpen + '<section'.length;
      continue;
    }
    depth--;
    index = nextClose + '</section>'.length;
    if (depth === 0) return source.slice(start, index);
  }
  return '';
}

function beamReference(beamIndex: number) {
  return {
    beamId: `sat-0-beam-${beamIndex}`,
    beamIndex,
    satId: 'sat-0',
    satIndex: 0,
    localBeamIndex: beamIndex,
    validUnderDecisionMask: true,
    validUnderPostStepMask: true,
  };
}

function basePolicyDiagnostics(
  extension: Readonly<Record<string, unknown>> = {},
): ModqnPolicyDiagnostics {
  return {
    selectedScalarizedQ: 0.81,
    runnerUpScalarizedQ: 0.74,
    scalarizedMarginToRunnerUp: 0.07,
    availableActionCount: 5,
    objectiveWeights: {
      r1Throughput: 0.4,
      r2Handover: 0.3,
      r3LoadBalance: 0.3,
    },
    topCandidates: [
      {
        ...beamReference(3),
        scalarizedQ: 0.81,
      },
      {
        ...beamReference(1),
        scalarizedQ: 0.74,
      },
      {
        ...beamReference(5),
        scalarizedQ: 0.71,
      },
    ],
    ...extension,
  };
}

function syntheticRow(policyDiagnostics?: ModqnPolicyDiagnostics): ModqnReplayTimelineRow {
  const selectedServing = beamReference(3);
  const row: ModqnReplayTimelineRow = {
    slotIndex: 0,
    timeSec: 0,
    decisionTimeSec: 0,
    userId: 'user-0',
    userIndex: 0,
    userPosition: { xKm: 0, yKm: 0, zKm: 0 },
    decisionUserPosition: { xKm: 0, yKm: 0, zKm: 0 },
    previousServing: selectedServing,
    selectedServing,
    handoverEvent: { kind: 'none', eventId: null },
    beamCatalogOrder: 'satellite-major-beam-minor',
    visibilityMask: [true, true, true, true, true, true],
    actionValidityMask: [true, true, true, true, true, true],
    decisionVisibilityMask: [true, true, true, true, true, true],
    decisionActionValidityMask: [true, true, true, true, true, true],
    beamLoads: [0, 0, 0, 0, 0, 0],
    beamThroughputs: [0, 0, 0, 0, 0, 0],
    rewardVector: {
      r1Throughput: 0,
      r2Handover: 0,
      r3LoadBalance: 0,
    },
    scalarReward: 0,
    satelliteStates: [{ satId: 'sat-0', satIndex: 0 }],
    beamStates: [0, 1, 2, 3, 4, 5].map(beamReference),
    kpiOverlay: {},
  };
  return policyDiagnostics === undefined ? row : { ...row, policyDiagnostics };
}

function buildSyntheticEnvelope(policyDiagnostics?: ModqnPolicyDiagnostics): ModqnReplayEnvelope {
  const row = syntheticRow(policyDiagnostics);
  const sourcePath = 'user-trained:validator-d-s5';
  const contents: ModqnReplayBundleContents = {
    sourcePath,
    manifestJson: JSON.stringify({
      bundleSchemaVersion: 'phase-03a-replay-bundle-v1',
      paperId: 'PAP-2024-MORL-MULTIBEAM',
      baselineSurface: {
        satelliteCount: 1,
        beamCountPerSatellite: 6,
        totalBeamCount: 6,
        episodesCompleted: 1,
      },
      claimBoundary: {
        notFullPaperFaithfulReproduction: true,
        not19Or37BeamTrainedEvidence: true,
      },
      beamCatalogOrder: 'satellite-major-beam-minor',
      replaySummary: {
        rowCount: 1,
        slotCount: 1,
      },
      optionalPolicyDiagnostics: {
        denseActionScores: true,
      },
    }),
    provenanceMapJson: JSON.stringify({
      bundleSchemaVersion: 'phase-03a-replay-bundle-v1',
      fields: {},
    }),
    timelineJsonl: JSON.stringify(row),
  };
  return createModqnReplayEnvelopeFromContents(contents, {
    sourcePath,
    modeKey: MODQN_USER_TRAINED_MODE_KEY,
  });
}

const panelPath = 'src/ui/modqn-training/DecisionVizPanel.tsx';
const appPath = 'src/App.tsx';
const panelSource = fs.readFileSync(panelPath, 'utf8');
const appSource = fs.readFileSync(appPath, 'utf8');
const modqnSection = extractBalancedTag(
  appSource,
  '<section\n                className="leo-modqn-sidebar-stack"',
);
const liveSection = extractBalancedTag(
  appSource,
  '<section className="leo-live-status-stack"',
);
const decisionVizTestIds = [
  'decision-viz-panel',
  'decision-viz-top-candidates',
  'decision-viz-dense-scores',
  'decision-viz-objective-weights-readout',
] as const;

// ---------------------------------------------------------------------------
// (a) DecisionVizPanel source contract
// ---------------------------------------------------------------------------
console.log('\n(a) DecisionVizPanel source contract');
{
  assert(
    /import\s+type\s*\{\s*ModqnReplayEnvelope\s*\}\s*from\s*['"]\.\.\/\.\.\/modqn\/replay-bundle['"];/.test(panelSource),
    'DecisionVizPanel imports ModqnReplayEnvelope type from replay-bundle barrel',
  );
  assert(
    !panelSource.includes('chart.js')
      && !panelSource.includes('recharts')
      && !panelSource.includes("from 'd3")
      && !panelSource.includes('from "d3'),
    'DecisionVizPanel imports no Chart.js, Recharts, or d3 charting library',
  );
  assert(/export function DecisionVizPanel/.test(panelSource), 'DecisionVizPanel is exported');
  assert(/export function buildDecisionVizFocusSnapshot/.test(panelSource), 'buildDecisionVizFocusSnapshot is exported');
  for (const testId of decisionVizTestIds) {
    assert(panelSource.includes(testId), `${testId} testid appears in source`);
  }
}

// ---------------------------------------------------------------------------
// (b) App.tsx source mount
// ---------------------------------------------------------------------------
console.log('\n(b) App.tsx source mount');
{
  assert(
    appSource.includes("import { DecisionVizPanel } from './ui/modqn-training/DecisionVizPanel';"),
    'App.tsx imports DecisionVizPanel from modqn-training path',
  );
  assert(modqnSection.includes('<DecisionVizPanel'), 'DecisionVizPanel mounts inside leo-modqn-sidebar-stack section');
  assert(
    modqnSection.indexOf('<RewardCurvePanel') !== -1
      && modqnSection.indexOf('<DecisionVizPanel') > modqnSection.indexOf('<RewardCurvePanel'),
    'DecisionVizPanel mount appears after RewardCurvePanel',
  );
  assert(modqnSection.includes('envelope={modqnReplayEnvelope}'), 'DecisionVizPanel receives modqnReplayEnvelope');
  assert(modqnSection.includes('slotOffset={modqnReplaySlotOffset}'), 'DecisionVizPanel receives modqnReplaySlotOffset');
  assert(modqnSection.includes('bundleProvenanceKind={bundleProvenanceKind}'), 'DecisionVizPanel receives bundleProvenanceKind');
}

// ---------------------------------------------------------------------------
// (c) Behavioral envelope=null helper
// ---------------------------------------------------------------------------
console.log('\n(c) Behavioral envelope=null helper');
{
  assert(buildDecisionVizFocusSnapshot(null, 0) === null, 'null envelope returns null snapshot');
}

// ---------------------------------------------------------------------------
// (d) Behavioral focused row diagnostics
// ---------------------------------------------------------------------------
console.log('\n(d) Behavioral focused row diagnostics');
{
  const snapshot = buildDecisionVizFocusSnapshot(buildSyntheticEnvelope(basePolicyDiagnostics()), 0);
  assert(snapshot !== null, 'snapshot is present when focused row has policyDiagnostics');
  assert(snapshot?.selectedBeamId === 'sat-0-beam-3', 'selectedBeamId is producer selected serving beam');
  assert(snapshot?.selectedScalarizedQ === 0.81, 'selectedScalarizedQ is read from diagnostics');
  assert(snapshot?.scalarizedMarginToRunnerUp === 0.07, 'scalarized margin is read from diagnostics');
  assert(snapshot?.runnersUpCount === 2, 'runnersUpCount is topCandidates length minus selected');
  assert(snapshot?.objectiveWeights?.r1 === 0.4, 'objectiveWeights r1 is compacted from r1Throughput');
  assert(snapshot?.topCandidates.length === 3, 'topCandidates has 3 candidates');
  assert(snapshot?.topCandidates[0]?.isSelected === true, 'first top candidate is selected');
  assert(snapshot?.topCandidates[1]?.isSelected === false, 'second top candidate is not selected');
  assert(
    snapshot !== null
      && snapshot.topCandidates.every((candidate, index, candidates) => (
        index === 0
          || (candidates[index - 1]?.scalarizedQ ?? -Infinity) >= (candidate.scalarizedQ ?? -Infinity)
      )),
    'topCandidates are sorted by scalarizedQ descending',
  );
}

// ---------------------------------------------------------------------------
// (e) Behavioral missing policyDiagnostics
// ---------------------------------------------------------------------------
console.log('\n(e) Behavioral missing policyDiagnostics');
{
  assert(
    buildDecisionVizFocusSnapshot(buildSyntheticEnvelope(undefined), 0) === null,
    'focused row without policyDiagnostics returns null snapshot',
  );
}

// ---------------------------------------------------------------------------
// (f) Behavioral dense scores and validity mask
// ---------------------------------------------------------------------------
console.log('\n(f) Behavioral dense scores and validity mask');
{
  const snapshot = buildDecisionVizFocusSnapshot(
    buildSyntheticEnvelope(basePolicyDiagnostics({
      denseActionScores: [0.81, 0.74, 0.50, 0.71, 0.30],
      actionScoreValidityMask: [true, true, false, true, true],
    })),
    0,
  );
  assert(snapshot?.denseScores?.length === 5, 'denseScores has 5 bars');
  assert(snapshot?.denseScores?.[2]?.isInvalid === true, 'denseScores[2] is invalid from mask=false');
  assert(snapshot?.denseScores?.[0]?.isInvalid === false, 'denseScores[0] remains valid');
  assert(snapshot?.denseScores?.[3]?.isSelected === true, 'denseScores[3] is selected by selectedServing beamIndex');
}

// ---------------------------------------------------------------------------
// (g) Behavioral dense scores absent
// ---------------------------------------------------------------------------
console.log('\n(g) Behavioral dense scores absent');
{
  const snapshot = buildDecisionVizFocusSnapshot(buildSyntheticEnvelope(basePolicyDiagnostics()), 0);
  assert(snapshot?.denseScores === null, 'denseScores is null when denseActionScores is absent');
}

// ---------------------------------------------------------------------------
// (h) Behavioral length-mismatched mask ignored
// ---------------------------------------------------------------------------
console.log('\n(h) Behavioral length-mismatched mask ignored');
{
  const snapshot = buildDecisionVizFocusSnapshot(
    buildSyntheticEnvelope(basePolicyDiagnostics({
      denseActionScores: [0.81, 0.74, 0.50, 0.71, 0.30],
      actionScoreValidityMask: [true, true, false, true],
    })),
    0,
  );
  assert(
    snapshot?.denseScores?.length === 5
      && snapshot.denseScores.every(score => score.isInvalid === false),
    'length-mismatched dense validity mask is ignored',
  );
}

// ---------------------------------------------------------------------------
// (i) SSR envelope=null empty state
// ---------------------------------------------------------------------------
console.log('\n(i) SSR envelope=null empty state');
{
  const html = renderToString(
    <DecisionVizPanel
      envelope={null}
      slotOffset={0}
      bundleProvenanceKind="paper-faithful"
    />,
  );
  assert(html.includes('data-testid="decision-viz-panel"'), 'empty-state SSR includes panel root testid');
  assert(html.includes('policy diagnostics absent for this row'), 'empty-state SSR includes absent diagnostics text');
  for (const testId of decisionVizTestIds.filter(testId => testId !== 'decision-viz-panel')) {
    assert(!html.includes(`data-testid="${testId}"`), `empty-state SSR omits ${testId}`);
  }
}

// ---------------------------------------------------------------------------
// (j) SSR loaded diagnostics with dense scores
// ---------------------------------------------------------------------------
console.log('\n(j) SSR loaded diagnostics with dense scores');
{
  const html = renderToString(
    <DecisionVizPanel
      envelope={buildSyntheticEnvelope(basePolicyDiagnostics({
        denseActionScores: [0.81, 0.74, 0.50, 0.71, 0.30],
        actionScoreValidityMask: [true, true, false, true, true],
      }))}
      slotOffset={0}
      bundleProvenanceKind="user-trained"
    />,
  );
  for (const testId of decisionVizTestIds) {
    assert(html.includes(`data-testid="${testId}"`), `loaded SSR includes ${testId}`);
  }
  assert(html.includes('sat-0-beam-3'), 'loaded SSR includes selected beam header text');
  assert(html.includes('0.40'), 'loaded SSR includes formatted r1 weight');
}

// ---------------------------------------------------------------------------
// (k) SSR loaded diagnostics without dense scores
// ---------------------------------------------------------------------------
console.log('\n(k) SSR loaded diagnostics without dense scores');
{
  const html = renderToString(
    <DecisionVizPanel
      envelope={buildSyntheticEnvelope(basePolicyDiagnostics())}
      slotOffset={0}
      bundleProvenanceKind="paper-faithful"
    />,
  );
  assert(html.includes('data-testid="decision-viz-panel"'), 'loaded no-dense SSR includes panel root testid');
  assert(html.includes('data-testid="decision-viz-top-candidates"'), 'loaded no-dense SSR includes top candidates testid');
  assert(html.includes('data-testid="decision-viz-objective-weights-readout"'), 'loaded no-dense SSR includes weights testid');
  assert(!html.includes('data-testid="decision-viz-dense-scores"'), 'loaded no-dense SSR omits dense scores testid');
}

// ---------------------------------------------------------------------------
// (l) MODQN branch placement regression
// ---------------------------------------------------------------------------
console.log('\n(l) MODQN branch placement regression');
{
  const modqnBranchStart = appSource.lastIndexOf(': (', appSource.indexOf('className="leo-modqn-sidebar-stack"'));
  const modqnBranchEnd = appSource.indexOf(')}\n          </SidebarTabShell>', appSource.indexOf('className="leo-modqn-sidebar-stack"'));
  const modqnBranch = modqnBranchStart === -1 || modqnBranchEnd === -1
    ? ''
    : appSource.slice(modqnBranchStart, modqnBranchEnd);
  assert(
    modqnBranch.includes('<DecisionVizPanel'),
    'DecisionVizPanel mount is between the MODQN conditional opener and closer',
  );
  assert(
    !liveSection.includes('<DecisionVizPanel'),
    'DecisionVizPanel is absent from the live/SINR status section',
  );
}

console.log(`\n[validate-phase-d-decision-viz] ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
