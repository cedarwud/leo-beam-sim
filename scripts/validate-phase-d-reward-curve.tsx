#!/usr/bin/env node
// validate-phase-d-reward-curve.tsx
//
// PR-mu / D-S4 acceptance validator:
//   (a) RewardCurvePanel source imports the replay envelope type, exports the
//       panel, has exactly the expected testids, and imports no charting lib
//   (b) App.tsx imports and mounts RewardCurvePanel in the MODQN proof section
//   (c) helper builds scalar + rewardVector series from a 2-slot synthetic bundle
//   (d) helper falls back to 0 for a missing rewardVector key
//   (e) helper returns empty series for envelope=null
//   (f) SSR empty state includes the panel root and no chart testids
//   (g) SSR loaded state includes the panel root, four chart testids, polyline,
//       and highlight line
//   (h) RewardCurvePanel remains in the MODQN branch, not the SINR/live branch
//
// Run: node --import tsx/esm scripts/validate-phase-d-reward-curve.tsx

import * as fs from 'node:fs';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  MODQN_USER_TRAINED_MODE_KEY,
  createModqnReplayEnvelopeFromContents,
  type ModqnReplayBundleContents,
  type ModqnReplayEnvelope,
  type ModqnReplayTimelineRow,
} from '../src/modqn/replay-bundle';
import {
  RewardCurvePanel,
  buildRewardCurveSeries,
} from '../src/ui/modqn-training/RewardCurvePanel';
import {
  DASHBOARD_SERIES_CHANNEL_SPECS,
  buildDashboardSeriesModel,
  getDashboardSeriesChannelExpectedStatus,
  type DashboardSeriesChannelKey,
  type DashboardSeriesModel,
} from '../src/showcase/dashboard/seriesModel';
import { loadValidatorVisualShowcaseArtifact } from './visualShowcaseValidatorFixture';

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
  return source.split(needle).length - 1;
}

function countExactStringLiteral(source: string, value: string): number {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [...source.matchAll(new RegExp(`(['"])${escaped}\\1`, 'g'))].length;
}

function arraysEqual(actual: readonly number[], expected: readonly number[]): boolean {
  return actual.length === expected.length
    && actual.every((value, index) => Object.is(value, expected[index]));
}

function channelProvenance(model: DashboardSeriesModel, key: DashboardSeriesChannelKey) {
  return model[key].provenance;
}

function channelValueCount(model: DashboardSeriesModel, key: DashboardSeriesChannelKey): number {
  switch (key) {
    case 'rewardScalar':
      return model.rewardScalar.primary.values.length + model.rewardScalar.timeline.values.length;
    case 'rewardComponents':
      return Object.values(model.rewardComponents.byComponent)
        .reduce((sum, series) => sum + series.values.length, 0);
    case 'objectiveWeights':
      return Object.keys(model.objectiveWeights.values).length;
    case 'selectedAction':
      return model.selectedAction.actionIndex.values.length
        + model.selectedAction.selectedAction.values.length
        + model.selectedAction.timelineDecisions.length
        + model.selectedAction.decisionFrames.length;
    case 'actionScores':
      return model.actionScores.dense.values.length + model.actionScores.decisionFrames.length;
    case 'servingSatellite':
      return model.servingSatellite.series.values.length;
    case 'handover':
      return model.handover.phase.values.length + model.handover.states.length + model.handover.events.length;
    case 'sinr':
      return model.sinr.primary.values.length + model.sinr.serving.values.length;
    case 'throughput':
      return model.throughput.series.values.length;
    default: {
      const exhaustive: never = key;
      return exhaustive;
    }
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

function shortBeamReference() {
  return {
    beamId: 'sat-0-beam-0',
    beamIndex: 0,
    satId: 'sat-0',
    satIndex: 0,
    localBeamIndex: 0,
    validUnderDecisionMask: true,
    validUnderPostStepMask: true,
  };
}

function syntheticRow(
  rowIndex: number,
  rewardVector: Readonly<Record<string, number>>,
): ModqnReplayTimelineRow {
  const beam = shortBeamReference();
  return {
    slotIndex: rowIndex < 3 ? 1 : 2,
    timeSec: rowIndex,
    decisionTimeSec: rowIndex,
    userId: `user-${rowIndex}`,
    userIndex: rowIndex,
    userPosition: { xKm: rowIndex, yKm: 0, zKm: 0 },
    decisionUserPosition: { xKm: rowIndex, yKm: 0, zKm: 0 },
    previousServing: beam,
    selectedServing: beam,
    handoverEvent: { kind: 'none', eventId: null },
    beamCatalogOrder: 'satellite-major-beam-minor',
    visibilityMask: [true],
    actionValidityMask: [true],
    decisionVisibilityMask: [true],
    decisionActionValidityMask: [true],
    beamLoads: [0],
    beamThroughputs: [0],
    rewardVector,
    scalarReward: rowIndex + 1,
    satelliteStates: [{ satId: 'sat-0', satIndex: 0 }],
    beamStates: [beam],
    kpiOverlay: {},
  };
}

function buildSyntheticEnvelope(options: {
  readonly omitR2AtIndex?: number;
} = {}): ModqnReplayEnvelope {
  const rows = Array.from({ length: 6 }, (_value, rowIndex) => {
    const rewardVector: Record<string, number> = {
      r1Throughput: 10 + rowIndex,
      r2Handover: rowIndex % 2 === 0 ? 0 : -1,
      r3LoadBalance: -5,
    };
    if (options.omitR2AtIndex === rowIndex) delete rewardVector.r2Handover;
    return syntheticRow(rowIndex, rewardVector);
  });
  const sourcePath = 'user-trained:validator-d-s4';
  const contents: ModqnReplayBundleContents = {
    sourcePath,
    manifestJson: JSON.stringify({
      bundleSchemaVersion: 'phase-03a-replay-bundle-v1',
      paperId: 'PAP-2024-MORL-MULTIBEAM',
      baselineSurface: {
        satelliteCount: 1,
        beamCountPerSatellite: 1,
        totalBeamCount: 1,
        episodesCompleted: 1,
      },
      claimBoundary: {
        notFullPaperFaithfulReproduction: true,
        not19Or37BeamTrainedEvidence: true,
      },
      beamCatalogOrder: 'satellite-major-beam-minor',
      replaySummary: {
        rowCount: rows.length,
        slotCount: 2,
      },
    }),
    provenanceMapJson: JSON.stringify({
      bundleSchemaVersion: 'phase-03a-replay-bundle-v1',
      fields: {},
    }),
    timelineJsonl: rows.map(row => JSON.stringify(row)).join('\n'),
  };
  return createModqnReplayEnvelopeFromContents(contents, {
    sourcePath,
    modeKey: MODQN_USER_TRAINED_MODE_KEY,
  });
}

const panelPath = 'src/ui/modqn-training/RewardCurvePanel.tsx';
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
const chartTestIds = [
  'reward-curve-chart-scalar',
  'reward-curve-chart-r1-throughput',
  'reward-curve-chart-r2-handover',
  'reward-curve-chart-r3-load-balance',
] as const;

// ---------------------------------------------------------------------------
// (a) RewardCurvePanel source contract
// ---------------------------------------------------------------------------
console.log('\n(a) RewardCurvePanel source contract');
{
  assert(
    /import\s+type\s*\{\s*ModqnReplayEnvelope\s*\}\s*from\s*['"]\.\.\/\.\.\/modqn\/replay-bundle['"];/.test(panelSource),
    'RewardCurvePanel imports ModqnReplayEnvelope type from replay-bundle barrel',
  );
  assert(
    !panelSource.includes('chart.js')
      && !panelSource.includes('recharts')
      && !panelSource.includes("from 'd3")
      && !panelSource.includes('from "d3'),
    'RewardCurvePanel imports no Chart.js, Recharts, or d3 charting library',
  );
  assert(
    /export function RewardCurvePanel/.test(panelSource),
    'RewardCurvePanel is exported',
  );
  assert(
    countExactStringLiteral(panelSource, 'reward-curve-panel') === 1,
    'root reward-curve-panel testid appears exactly once',
  );
  for (const testId of chartTestIds) {
    assert(
      countExactStringLiteral(panelSource, testId) === 1,
      `${testId} testid appears exactly once`,
    );
  }
}

// ---------------------------------------------------------------------------
// (b) App.tsx source mount
// ---------------------------------------------------------------------------
console.log('\n(b) App.tsx source mount');
{
  // Removed implementation-detail pin: RewardCurvePanel's direct import path is not a runtime contract.
  assert(
    modqnSection.includes('<RewardCurvePanel'),
    'RewardCurvePanel mounts inside leo-modqn-sidebar-stack section',
  );
  assert(
    modqnSection.includes('envelope={modqnReplayEnvelope}'),
    'RewardCurvePanel receives modqnReplayEnvelope',
  );
  assert(
    modqnSection.includes('slotOffset={modqnReplaySlotOffset}'),
    'RewardCurvePanel receives modqnReplaySlotOffset',
  );
  assert(
    modqnSection.includes('bundleProvenanceKind={bundleProvenanceKind}'),
    'RewardCurvePanel receives bundleProvenanceKind',
  );
}

// ---------------------------------------------------------------------------
// (c) Behavioral series construction
// ---------------------------------------------------------------------------
console.log('\n(c) Behavioral series construction');
{
  const envelope = buildSyntheticEnvelope();
  const curves = buildRewardCurveSeries(envelope);
  assert(arraysEqual(curves.scalar, [1, 2, 3, 4, 5, 6]), 'scalarReward series has 6 producer values');
  assert(arraysEqual(curves.r1Throughput, [10, 11, 12, 13, 14, 15]), 'r1Throughput series has 6 producer values');
  assert(arraysEqual(curves.r2Handover, [0, -1, 0, -1, 0, -1]), 'r2Handover series has 6 producer values');
  assert(arraysEqual(curves.r3LoadBalance, [-5, -5, -5, -5, -5, -5]), 'r3LoadBalance series has 6 producer values');
  assert(curves.highlightAt(0) === 0, 'slotOffset 0 highlights first flattened row');
  assert(curves.highlightAt(1) === 3, 'slotOffset 1 highlights first row of second slot');
  assert(curves.highlightAt(99) === 3, 'out-of-bounds slotOffset clamps to last slot');
}

// ---------------------------------------------------------------------------
// (d) Behavioral missing-key fallback
// ---------------------------------------------------------------------------
console.log('\n(d) Behavioral missing-key fallback');
{
  const envelope = buildSyntheticEnvelope({ omitR2AtIndex: 4 });
  const curves = buildRewardCurveSeries(envelope);
  assert(curves.r2Handover[4] === 0, 'missing r2Handover rewardVector key plots 0');
  assert(curves.r2Handover.length === 6, 'missing key does not drop the row');
}

// ---------------------------------------------------------------------------
// (e) Behavioral envelope=null helper
// ---------------------------------------------------------------------------
console.log('\n(e) Behavioral envelope=null helper');
{
  const curves = buildRewardCurveSeries(null);
  assert(curves.scalar.length === 0, 'null envelope scalar series is empty');
  assert(curves.r1Throughput.length === 0, 'null envelope r1Throughput series is empty');
  assert(curves.r2Handover.length === 0, 'null envelope r2Handover series is empty');
  assert(curves.r3LoadBalance.length === 0, 'null envelope r3LoadBalance series is empty');
  assert(curves.highlightAt(0) === -1, 'null envelope highlighter returns -1');
}

// ---------------------------------------------------------------------------
// (f) SSR envelope=null empty state
// ---------------------------------------------------------------------------
console.log('\n(f) SSR envelope=null empty state');
{
  const html = renderToString(
    <RewardCurvePanel
      envelope={null}
      slotOffset={0}
      bundleProvenanceKind="paper-faithful"
    />,
  );
  assert(html.includes('data-testid="reward-curve-panel"'), 'empty-state SSR includes panel root testid');
  for (const testId of chartTestIds) {
    assert(!html.includes(`data-testid="${testId}"`), `empty-state SSR omits ${testId}`);
  }
  assert(html.includes('No envelope loaded'), 'empty-state SSR includes No envelope loaded text');
}

// ---------------------------------------------------------------------------
// (g) SSR loaded envelope charts
// ---------------------------------------------------------------------------
console.log('\n(g) SSR loaded envelope charts');
{
  const envelope = buildSyntheticEnvelope();
  const loadedHtml = renderToString(
    <RewardCurvePanel
      envelope={envelope}
      slotOffset={1}
      bundleProvenanceKind="user-trained"
    />,
  );
  const emptyHtml = renderToString(
    <RewardCurvePanel
      envelope={null}
      slotOffset={1}
      bundleProvenanceKind="user-trained"
    />,
  );
  assert(loadedHtml.includes('data-testid="reward-curve-panel"'), 'loaded SSR includes panel root testid');
  for (const testId of chartTestIds) {
    assert(loadedHtml.includes(`data-testid="${testId}"`), `loaded SSR includes ${testId}`);
  }
  assert(loadedHtml.includes('<polyline'), 'loaded SSR contains at least one polyline');
  assert(
    countOccurrences(loadedHtml, '<line') > countOccurrences(emptyHtml, '<line'),
    'loaded SSR contains highlight/axis line elements beyond empty state',
  );
}

// ---------------------------------------------------------------------------
// (h) Hidden in sinr-experiment / live branch
// ---------------------------------------------------------------------------
console.log('\n(h) MODQN branch placement regression');
{
  const modqnBranchStart = appSource.lastIndexOf(': (', appSource.indexOf('className="leo-modqn-sidebar-stack"'));
  const modqnBranchEnd = appSource.indexOf(')}\n          </SidebarTabShell>', appSource.indexOf('className="leo-modqn-sidebar-stack"'));
  const modqnBranch = modqnBranchStart === -1 || modqnBranchEnd === -1
    ? ''
    : appSource.slice(modqnBranchStart, modqnBranchEnd);
  assert(
    modqnBranch.includes('<RewardCurvePanel'),
    'RewardCurvePanel mount is between the MODQN conditional opener and closer',
  );
  assert(
    !liveSection.includes('<RewardCurvePanel'),
    'RewardCurvePanel is absent from the live/SINR status section',
  );
}

// ---------------------------------------------------------------------------
// (i) Phase 1a S1 Plane-C dashboard series provenance
// ---------------------------------------------------------------------------
console.log('\n(i) Phase 1a S1 Plane-C dashboard series provenance');
{
  const { artifact, source } = loadValidatorVisualShowcaseArtifact();
  const model = buildDashboardSeriesModel(artifact);

  assert(model.plane === 'visual-showcase-v1', 'dashboard series model declares Plane C');
  assert(
    DASHBOARD_SERIES_CHANNEL_SPECS.length === 9,
    'dashboard series model exposes the expected Phase 1a S1 channel set',
  );

  for (const spec of DASHBOARD_SERIES_CHANNEL_SPECS) {
    const provenance = channelProvenance(model, spec.key);
    assert(
      provenance.plane === 'visual-showcase-v1',
      `${spec.key} provenance plane is visual-showcase-v1`,
    );
    assert(
      provenance.inventoryField === spec.inventoryField,
      `${spec.key} provenance binds to ${spec.inventoryField}`,
    );
    assert(
      provenance.status === getDashboardSeriesChannelExpectedStatus(spec.key),
      `${spec.key} provenance status agrees with VISUAL_SHOWCASE_V1_COVERAGE`,
      `${source.label} produced ${provenance.status}`,
    );
    if (provenance.status === 'source-gap') {
      assert(
        channelValueCount(model, spec.key) === 0,
        `${spec.key} source-gap channel carries no values`,
      );
    }
  }

  for (const event of model.handover.events) {
    assert(
      event.type === 'handover' || event.type.startsWith('handover-'),
      `handover channel event ${event.id} is handover-typed`,
      `got ${event.type}`,
    );
  }

  const nullModel = buildDashboardSeriesModel(null);
  for (const spec of DASHBOARD_SERIES_CHANNEL_SPECS) {
    const provenance = channelProvenance(nullModel, spec.key);
    assert(
      provenance.status === 'source-gap',
      `${spec.key} null artifact resolves to source-gap`,
    );
    assert(
      channelValueCount(nullModel, spec.key) === 0,
      `${spec.key} null artifact source-gap carries no values`,
    );
  }
}

console.log(`\n[validate-phase-d-reward-curve] ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
