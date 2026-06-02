import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AlgorithmFlowchart } from '../src/showcase/dashboard/AlgorithmFlowchart';
import {
  FLOWCHART_EDGES,
  type FlowchartEdgeBinding,
  flowchartEdgeId,
  resolveFlowchartEdgeBindings,
} from '../src/showcase/dashboard/flowchartModel';
import {
  findCrossedBoundaries,
  FLOWCHART_DECISION_EDGE_IDS,
  mapEventTypeToEdgeIds,
  resolvePulseEdgeIds,
  type CrossedBoundary,
} from '../src/showcase/dashboard/flowchartAnimation';
import {
  buildDashboardSeriesModel,
  DASHBOARD_SERIES_CHANNEL_SPECS,
  type DashboardSeriesChannelKey,
} from '../src/showcase/dashboard/seriesModel';
import { loadValidatorVisualShowcaseArtifact } from './visualShowcaseValidatorFixture';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PASSED: string[] = [];

function pass(label: string): void {
  PASSED.push(label);
  console.log(`PASS ${String(PASSED.length).padStart(2, '0')}: ${label}`);
}

function expect(condition: boolean, label: string): void {
  assert.ok(condition, label);
  pass(label);
}

function readSource(relativePath: string): string {
  return readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

function assertNotContains(source: string, needle: string, label: string): void {
  expect(!source.includes(needle), `${label} omits ${needle}`);
}

function selectorBlock(source: string, selector: string): string {
  const start = source.indexOf(selector);
  assert.ok(start >= 0, `${selector} block exists`);
  const open = source.indexOf('{', start);
  assert.ok(open >= 0, `${selector} block has opening brace`);
  const close = source.indexOf('}', open);
  assert.ok(close > open, `${selector} block has closing brace`);
  return source.slice(start, close + 1);
}

function renderedEdgeTags(markup: string): readonly string[] {
  return [...markup.matchAll(/<path\b[^>]*data-testid="algorithm-flowchart-edge"[^>]*>/g)]
    .map(match => match[0]);
}

function attr(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`${name}="([^"]*)"`));
  return match?.[1] ?? null;
}

function validateEdgeSourceChannels(): void {
  const channelKeys = new Set<DashboardSeriesChannelKey>(
    DASHBOARD_SERIES_CHANNEL_SPECS.map(spec => spec.key),
  );

  for (const edge of FLOWCHART_EDGES) {
    expect(
      edge.sourceChannel === 'none' || channelKeys.has(edge.sourceChannel),
      `${flowchartEdgeId(edge)} source channel is none or a DashboardSeriesChannelKey`,
    );
  }
}

function validateBindingRules(): void {
  const loadedModel = buildDashboardSeriesModel(loadValidatorVisualShowcaseArtifact().artifact);
  const loadedBindings = resolveFlowchartEdgeBindings(loadedModel);
  const rewardFeedback = loadedBindings.find(binding => binding.edgeId === 'reward->qnet');

  assert.ok(rewardFeedback, 'reward feedback binding missing');
  expect(rewardFeedback.sourceChannel === 'none', 'reward->qnet is intentionally unbound');
  expect(rewardFeedback.status === 'none', 'reward->qnet binding status is none');
  expect(!rewardFeedback.animatable, 'reward->qnet is never animatable');

  for (const binding of loadedBindings) {
    if (binding.status === 'source-gap') {
      expect(!binding.animatable, `${binding.edgeId} source-gap binding is not animatable`);
    }
    if (binding.status === 'producer-backed' || binding.status === 'partial-producer-backed') {
      expect(binding.animatable, `${binding.edgeId} producer-backed binding is marked animatable for S4`);
    }
  }

  const nullBindings = resolveFlowchartEdgeBindings(buildDashboardSeriesModel(null));
  for (const binding of nullBindings) {
    expect(!binding.animatable, `${binding.edgeId} null-artifact binding is not animatable`);
  }
}

function validateRenderedMarkup(): void {
  const { artifact } = loadValidatorVisualShowcaseArtifact();
  const loadedMarkup = renderToStaticMarkup(<AlgorithmFlowchart artifact={artifact} />);
  const loadedEdges = renderedEdgeTags(loadedMarkup);

  expect(
    loadedMarkup.includes('data-testid="algorithm-flowchart"'),
    'rendered SVG exposes algorithm-flowchart test id',
  );
  expect(
    loadedMarkup.includes('data-pulse-driver="raf"'),
    'rendered SVG exposes raf pulse driver marker',
  );
  expect(
    loadedEdges.length === FLOWCHART_EDGES.length,
    'rendered SVG exposes every flowchart edge',
  );

  for (const tag of loadedEdges) {
    const edgeId = attr(tag, 'data-edge-id');
    expect(edgeId !== null && edgeId.length > 0, 'rendered edge has data-edge-id');
    expect(attr(tag, 'data-source-channel') !== null, `${edgeId ?? 'edge'} has data-source-channel`);
    expect(attr(tag, 'data-source-status') !== null, `${edgeId ?? 'edge'} has data-source-status`);
    const animatable = attr(tag, 'data-animatable');
    expect(animatable === 'true' || animatable === 'false', `${edgeId ?? 'edge'} has data-animatable`);
    if (animatable === 'false') {
      expect(
        tag.includes('leo-algorithm-flowchart__edge--idle'),
        `${edgeId ?? 'edge'} non-animatable edge uses idle style`,
      );
    }
  }

  const nullMarkup = renderToStaticMarkup(<AlgorithmFlowchart artifact={null} />);
  const nullEdges = renderedEdgeTags(nullMarkup);
  expect(nullEdges.length === FLOWCHART_EDGES.length, 'null artifact renders every flowchart edge');
  for (const tag of nullEdges) {
    expect(
      attr(tag, 'data-animatable') === 'false',
      `${attr(tag, 'data-edge-id') ?? 'edge'} null artifact edge is idle`,
    );
    expect(
      tag.includes('leo-algorithm-flowchart__edge--idle'),
      `${attr(tag, 'data-edge-id') ?? 'edge'} null artifact edge uses idle style`,
    );
  }
}

function validateStaticScaffoldSource(): void {
  const componentSource = readSource('src/showcase/dashboard/AlgorithmFlowchart.tsx');
  const styleSource = readSource('src/styles/main.scss');

  assertNotContains(componentSource, "from 'three", 'AlgorithmFlowchart');
  assertNotContains(componentSource, 'from "three', 'AlgorithmFlowchart');
  assertNotContains(componentSource, '@react-three/', 'AlgorithmFlowchart');
  assertNotContains(componentSource, '../scene/', 'AlgorithmFlowchart');
  assertNotContains(componentSource, '../viz/', 'AlgorithmFlowchart');
  assertNotContains(componentSource, '<Canvas', 'AlgorithmFlowchart');
  assertNotContains(componentSource, 'setInterval', 'AlgorithmFlowchart');
  assertNotContains(componentSource, '@keyframes', 'AlgorithmFlowchart');
  assertNotContains(componentSource, 'animation:', 'AlgorithmFlowchart');
  assertNotContains(componentSource, 'useState', 'AlgorithmFlowchart pulse driver');
  assertNotContains(componentSource, 'setState', 'AlgorithmFlowchart pulse driver');
  expect(componentSource.includes('useRef'), 'AlgorithmFlowchart pulse driver uses refs');
  expect(componentSource.includes('requestAnimationFrame'), 'AlgorithmFlowchart pulse driver uses requestAnimationFrame');
  expect(
    componentSource.includes('data-pulse-driver="raf"'),
    'AlgorithmFlowchart SVG declares data-pulse-driver raf',
  );
  expect(
    componentSource.includes('classList.add(ACTIVE_EDGE_CLASS)')
      && componentSource.includes('classList.remove(ACTIVE_EDGE_CLASS)'),
    'AlgorithmFlowchart pulse driver toggles edge classes imperatively',
  );

  const flowchartStyleStart = styleSource.indexOf('.leo-algorithm-flowchart');
  const flowchartStyleEnd = styleSource.indexOf('.leo-modqn-objective-controls', flowchartStyleStart);
  assert.ok(flowchartStyleStart >= 0, 'leo-algorithm-flowchart style block exists');
  assert.ok(flowchartStyleEnd > flowchartStyleStart, 'leo-algorithm-flowchart style block has an end boundary');
  const flowchartStyles = styleSource.slice(flowchartStyleStart, flowchartStyleEnd);

  assertNotContains(selectorBlock(flowchartStyles, '.leo-algorithm-flowchart__edge {'), 'animation:', 'base edge styles');
  assertNotContains(
    selectorBlock(flowchartStyles, '.leo-algorithm-flowchart__edge--static'),
    'animation:',
    'static edge styles',
  );
  assertNotContains(
    selectorBlock(flowchartStyles, '.leo-algorithm-flowchart__edge--idle'),
    'animation:',
    'idle edge styles',
  );
  expect(
    selectorBlock(flowchartStyles, '.leo-algorithm-flowchart__edge--active').includes('animation:'),
    'active edge style owns the flowchart animation declaration',
  );
  expect(
    flowchartStyles.includes('@keyframes leo-algorithm-flowchart-edge-pulse')
      && flowchartStyles.includes('.leo-algorithm-flowchart__edge--active'),
    'flowchart keyframes are paired with the active edge class',
  );
  const animationOccurrences = flowchartStyles.match(/animation:/g)?.length ?? 0;
  expect(animationOccurrences === 1, 'flowchart styles contain exactly one animation declaration');
  expect(
    flowchartStyles.includes('leo-algorithm-flowchart__edge--idle')
      && flowchartStyles.includes('stroke-dasharray'),
    'flowchart styles keep non-animatable edges visibly idle',
  );
}

function validateFlowchartAnimationModel(): void {
  assert.deepEqual(
    mapEventTypeToEdgeIds('handover-prepared'),
    ['serving->handover'],
    'handover-prepared maps to serving->handover',
  );
  pass('handover-prepared maps to serving->handover');
  assert.deepEqual(
    mapEventTypeToEdgeIds('handover-dual-active'),
    ['serving->handover'],
    'handover-dual-active maps to serving->handover',
  );
  pass('handover-dual-active maps to serving->handover');
  assert.deepEqual(
    mapEventTypeToEdgeIds('handover'),
    ['serving->handover'],
    'generic handover maps to serving->handover (matches S1 isHandoverEvent)',
  );
  pass('generic handover maps to serving->handover (matches S1 isHandoverEvent)');
  assert.deepEqual(
    mapEventTypeToEdgeIds('rl-action'),
    ['mask->select', 'select->serving'],
    'rl-action maps to action selection edges',
  );
  pass('rl-action maps to action selection edges');
  assert.deepEqual(
    mapEventTypeToEdgeIds('reward-change'),
    ['serving->reward'],
    'reward-change maps to serving->reward',
  );
  pass('reward-change maps to serving->reward');
  assert.deepEqual(mapEventTypeToEdgeIds('unknown'), [], 'unknown event maps to no edges');
  pass('unknown event maps to no edges');

  const boundaries = findCrossedBoundaries(
    0,
    1,
    [
      { tSec: 0, type: 'reward-change' },
      { tSec: 0.5, type: 'handover-committed' },
      { tSec: 1, type: 'rl-action' },
      { tSec: 1.5, type: 'reward-change' },
      { tSec: 0.75, type: 'unknown' },
    ],
    [
      { tSec: 0 },
      { tSec: 0.25 },
      { tSec: 1.25 },
    ],
  );
  assert.deepEqual(
    boundaries.map(boundary => boundary.tSec),
    [0.25, 0.5, 1],
    'findCrossedBoundaries uses half-open interval and sorts by tSec',
  );
  pass('findCrossedBoundaries uses half-open interval and sorts by tSec');
  assert.deepEqual(
    findCrossedBoundaries(1, 1.5, [{ tSec: 1, type: 'rl-action' }], [{ tSec: 1 }]),
    [],
    'findCrossedBoundaries does not refire a boundary at prevSec',
  );
  pass('findCrossedBoundaries does not refire a boundary at prevSec');
  assert.deepEqual(
    findCrossedBoundaries(1, 0.5, [{ tSec: 0.75, type: 'rl-action' }], [{ tSec: 0.8 }]),
    [],
    'findCrossedBoundaries returns no pulses on backward seek',
  );
  pass('findCrossedBoundaries returns no pulses on backward seek');
  assert.deepEqual(
    findCrossedBoundaries(0, 0.25, [], [{ tSec: 0.25 }])[0]?.edgeIds,
    FLOWCHART_DECISION_EDGE_IDS,
    'decision-frame boundary maps to thinking path',
  );
  pass('decision-frame boundary maps to thinking path');

  const bindings: readonly FlowchartEdgeBinding[] = [
    { edgeId: 'state->qnet', sourceChannel: 'actionScores', status: 'producer-backed', animatable: true },
    { edgeId: 'qnet->omega', sourceChannel: 'objectiveWeights', status: 'producer-backed', animatable: true },
    { edgeId: 'omega->mask', sourceChannel: 'actionScores', status: 'producer-backed', animatable: true },
    { edgeId: 'mask->select', sourceChannel: 'selectedAction', status: 'producer-backed', animatable: true },
    { edgeId: 'select->serving', sourceChannel: 'servingSatellite', status: 'source-gap', animatable: false },
    { edgeId: 'serving->handover', sourceChannel: 'handover', status: 'producer-backed', animatable: true },
    { edgeId: 'serving->reward', sourceChannel: 'rewardScalar', status: 'producer-backed', animatable: true },
    { edgeId: 'reward->qnet', sourceChannel: 'none', status: 'none', animatable: false },
  ];
  const crossed: readonly CrossedBoundary[] = [
    { tSec: 1, edgeIds: ['mask->select', 'select->serving', 'reward->qnet'] },
    { tSec: 2, edgeIds: ['mask->select', 'serving->reward'] },
  ];
  const pulseIds = resolvePulseEdgeIds(crossed, bindings);
  assert.deepEqual(
    pulseIds,
    ['mask->select', 'serving->reward'],
    'resolvePulseEdgeIds dedupes and excludes non-animatable edges',
  );
  pass('resolvePulseEdgeIds dedupes and excludes non-animatable edges');
  expect(!pulseIds.includes('select->serving'), 'source-gap select->serving never pulses');
  expect(!pulseIds.includes('reward->qnet'), 'unbound reward->qnet never pulses');
}

validateEdgeSourceChannels();
validateBindingRules();
validateRenderedMarkup();
validateStaticScaffoldSource();
validateFlowchartAnimationModel();

console.log(`validate-phase-d-flowchart-scaffold: PASS (${PASSED.length}/0 assertions)`);
