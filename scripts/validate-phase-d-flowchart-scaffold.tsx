import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AlgorithmFlowchart } from '../src/showcase/dashboard/AlgorithmFlowchart';
import {
  FLOWCHART_EDGES,
  flowchartEdgeId,
  resolveFlowchartEdgeBindings,
} from '../src/showcase/dashboard/flowchartModel';
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
  assertNotContains(componentSource, 'requestAnimationFrame', 'AlgorithmFlowchart');
  assertNotContains(componentSource, '@keyframes', 'AlgorithmFlowchart');
  assertNotContains(componentSource, 'animation:', 'AlgorithmFlowchart');

  const flowchartStyleStart = styleSource.indexOf('.leo-algorithm-flowchart');
  const flowchartStyleEnd = styleSource.indexOf('.leo-modqn-objective-controls', flowchartStyleStart);
  assert.ok(flowchartStyleStart >= 0, 'leo-algorithm-flowchart style block exists');
  assert.ok(flowchartStyleEnd > flowchartStyleStart, 'leo-algorithm-flowchart style block has an end boundary');
  const flowchartStyles = styleSource.slice(flowchartStyleStart, flowchartStyleEnd);

  assertNotContains(flowchartStyles, '@keyframes', 'flowchart styles');
  assertNotContains(flowchartStyles, 'animation:', 'flowchart styles');
  expect(
    flowchartStyles.includes('leo-algorithm-flowchart__edge--idle')
      && flowchartStyles.includes('stroke-dasharray'),
    'flowchart styles keep non-animatable edges visibly idle',
  );
}

validateEdgeSourceChannels();
validateBindingRules();
validateRenderedMarkup();
validateStaticScaffoldSource();

console.log(`validate-phase-d-flowchart-scaffold: PASS (${PASSED.length}/0 assertions)`);
