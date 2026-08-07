#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  hasSceneVisualScaleOverrides,
  resolveSceneVisualScaleMultipliers,
} from '../src/sceneVisualScale';
import { createSceneTopologyState } from '../src/sceneTopology';
import { loadProfile } from '../src/profiles';
import { TopologyTab } from '../src/ui/signal-tuning/TopologyTab';

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

function compact(value: string): string {
  return value.replace(/\s+/g, '');
}

function countOccurrences(value: string, pattern: string): number {
  return value.split(pattern).length - 1;
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function textFromMarkup(markup: string): string {
  return markup
    .replace(/<!--.*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasPrimaryCylinderArgs(groundSceneCompact: string): boolean {
  return groundSceneCompact.includes('constmarkerRadius=MARKER_RADIUS*ueMarkerMultiplier;')
    && groundSceneCompact.includes('constmarkerHeight=MARKER_HEIGHT*ueMarkerMultiplier;')
    && groundSceneCompact.includes('args={[markerRadius,markerRadius,markerHeight,MARKER_RADIAL_SEGMENTS,]}');
}

section('(a) GroundScene.tsx source contract', () => {
  const groundSceneSource = source('src/viz/GroundScene.tsx');
  const groundSceneCompact = compact(groundSceneSource);

  check(
    groundSceneCompact.includes('readonlyueMarkerMultiplier?:number;'),
    'GroundSceneProps declares optional ueMarkerMultiplier',
  );
  check(
    groundSceneCompact.includes('exportfunctionGroundScene({ues,ueMarkerMultiplier=1.0,'),
    'GroundScene defaults omitted ueMarkerMultiplier to 1.0',
  );
  check(
    hasPrimaryCylinderArgs(groundSceneCompact),
    'PrimaryUeMarker cylinder args multiply radius top, radius bottom, and height',
  );
  check(
    groundSceneCompact.includes("constmarkerY=markerShape==='sphere'?markerRadius:markerHeight/2;"),
    'PrimaryUeMarker mesh y offset scales with ueMarkerMultiplier',
  );
  check(
    groundSceneCompact.includes("constlabelY=markerShape==='sphere'?markerRadius*2.2:18*ueMarkerMultiplier;"),
    'PrimaryUeMarker text y offset scales with ueMarkerMultiplier',
  );
  check(
    groundSceneCompact.includes('fontSize={14}'),
    'PrimaryUeMarker label font size remains fixed at 14',
  );
  check(
    groundSceneCompact.includes('MARKER_RADIUS*0.6*ueMarkerMultiplier,MARKER_RADIUS*0.6*ueMarkerMultiplier,markerHeight,12'),
    'SecondaryUeInstances preserves 0.6/0.7 ratios and multiplies radius top, radius bottom, and height',
  );
  check(
    groundSceneCompact.includes("y+(markerShape==='sphere'?markerRadius:markerHeight/2)"),
    'SecondaryUeInstances y offset scales with ueMarkerMultiplier',
  );
  check(
    countOccurrences(groundSceneSource, 'const MARKER_HEIGHT = ') === 1,
    'MARKER_HEIGHT remains declared exactly once',
  );
  check(
    countOccurrences(groundSceneSource, 'const MARKER_RADIUS = ') === 1,
    'MARKER_RADIUS remains declared exactly once',
  );
  check(
    countOccurrences(groundSceneSource, 'const MARKER_RADIAL_SEGMENTS = 16;') === 1,
    'MARKER_RADIAL_SEGMENTS remains const 16 exactly once',
  );
});

section('(b) sceneVisualScale UE marker behavior', () => {
  check(
    sameJson(
      resolveSceneVisualScaleMultipliers({ sceneScale: 'paper-faithful', ueMarkerScale: 1.0 }),
      { beamFootprintMultiplier: 1.0, ueMarkerMultiplier: 1.0 },
    ),
    'ueMarkerScale 1.0 resolves to ueMarkerMultiplier 1.0',
  );
  check(
    sameJson(
      resolveSceneVisualScaleMultipliers({ sceneScale: 'paper-faithful', ueMarkerScale: 2.5 }),
      { beamFootprintMultiplier: 1.0, ueMarkerMultiplier: 2.5 },
    ),
    'ueMarkerScale 2.5 resolves to ueMarkerMultiplier 2.5',
  );
  check(
    sameJson(
      resolveSceneVisualScaleMultipliers({ sceneScale: 'paper-faithful', ueMarkerScale: 0.5 }),
      { beamFootprintMultiplier: 1.0, ueMarkerMultiplier: 0.5 },
    ),
    'ueMarkerScale 0.5 resolves to ueMarkerMultiplier 0.5',
  );
  check(
    hasSceneVisualScaleOverrides({ sceneScale: 'paper-faithful', ueMarkerScale: 2.0 }),
    'ueMarkerScale != 1.0 counts as a scene visual scale override',
  );
});

section('(c) MainScene.tsx GroundScene prop wiring', () => {
  const mainSceneCompact = compact(source('src/scene/MainScene.tsx'));
  check(
    mainSceneCompact.includes('ueMarkerMultiplier={visualScaleMultipliers.ueMarkerMultiplier}'),
    'MainScene passes visualScaleMultipliers.ueMarkerMultiplier to GroundScene',
  );
});

section('(d) TopologyTab.tsx UE marker UI contract', () => {
  const topologyTabSource = source('src/ui/signal-tuning/TopologyTab.tsx');

  for (const testId of [
    'topology-tab-ue-marker-slider',
    'topology-tab-ue-marker-effective-value',
    'topology-tab-ue-marker-reset',
  ]) {
    check(
      countOccurrences(topologyTabSource, `data-testid="${testId}"`) === 1,
      `TopologyTab.tsx contains ${testId} exactly once`,
    );
  }

  check(topologyTabSource.includes('type="range"'), 'UE marker control uses a range input');
  check(topologyTabSource.includes('min={0.5}') || topologyTabSource.includes('min="0.5"'), 'UE marker slider min is 0.5');
  check(
    topologyTabSource.includes('max={3.0}') || topologyTabSource.includes('max={3}') || topologyTabSource.includes('max="3.0"') || topologyTabSource.includes('max="3"'),
    'UE marker slider max is 3.0',
  );
  check(topologyTabSource.includes('step={0.1}') || topologyTabSource.includes('step="0.1"'), 'UE marker slider step is 0.1');
  check(topologyTabSource.includes('Effective UE marker scale'), 'TopologyTab.tsx contains Effective UE marker scale text');

  for (const testId of [
    'topology-tab-sat-count-slider',
    'topology-tab-restart-banner',
    'topology-tab-clear-override',
    'topology-tab-effective-value',
    'topology-tab-beam-count-radio',
    'topology-tab-beam-count-option-7',
    'topology-tab-beam-count-option-19',
    'topology-tab-beam-count-option-37',
    'topology-tab-beam-count-clear-override',
    'topology-tab-beam-count-effective-value',
    'topology-tab-scene-scale-radio',
    'topology-tab-scene-scale-option-paper-faithful',
    'topology-tab-scene-scale-option-demo-readability',
    'topology-tab-scene-scale-reset',
    'topology-tab-scene-scale-effective-value',
  ]) {
    check(topologyTabSource.includes(testId), `TopologyTab.tsx preserves ${testId}`);
  }
});

section('(e) TopologyTab SSR UE marker behavior', () => {
  const baseProfile = loadProfile('hobs-2024-candidate-rich');
  const noop = () => undefined;
  const topology = createSceneTopologyState();

  for (const ueMarkerScale of [1.0, 2.5, 0.5]) {
    const markup = renderToString(
      <TopologyTab
        topology={topology}
        sceneVisualScale={{ sceneScale: 'paper-faithful', ueMarkerScale }}
        baseProfile={baseProfile}
        onTopologyChange={noop}
        onSceneVisualScaleChange={noop}
        onReset={noop}
      />,
    );
    const text = textFromMarkup(markup);
    const fixed = ueMarkerScale.toFixed(2);

    check(
      markup.includes('data-testid="topology-tab-ue-marker-slider"'),
      `SSR render ${fixed} contains UE marker slider input`,
    );
    check(
      markup.includes('data-testid="topology-tab-ue-marker-effective-value"'),
      `SSR render ${fixed} contains UE marker effective-value testid`,
    );
    check(
      text.includes(`Effective UE marker scale: ${fixed}`),
      `SSR render ${fixed} contains fixed effective scale text`,
      text,
    );
  }
});

section('(f) GroundScene multiplier render fallback source checks', () => {
  const groundSceneCompact = compact(source('src/viz/GroundScene.tsx'));
  check(
    groundSceneCompact.includes('<PrimaryUeMarker')
      && groundSceneCompact.includes('ueMarkerMultiplier={ueMarkerMultiplier}')
      && groundSceneCompact.includes('markerShape={markerShape}'),
    'GroundScene forwards ueMarkerMultiplier into PrimaryUeMarker',
  );
  check(
    groundSceneCompact.includes('<SecondaryUeInstances')
      && groundSceneCompact.includes('ues={secondaryUes}')
      && groundSceneCompact.includes('ueMarkerMultiplier={ueMarkerMultiplier}')
      && groundSceneCompact.includes('markerShape={markerShape}'),
    'GroundScene forwards ueMarkerMultiplier into SecondaryUeInstances',
  );
  check(
    hasPrimaryCylinderArgs(groundSceneCompact),
    'fallback source check confirms primary cylinder args depend on multiplier',
  );
  check(
    groundSceneCompact.includes('MARKER_RADIUS*0.6*ueMarkerMultiplier,MARKER_RADIUS*0.6*ueMarkerMultiplier,markerHeight,12'),
    'fallback source check confirms secondary cylinder args depend on multiplier',
  );
});

console.log('\n---');
console.log(`[validate-phase-c-ue-marker-size] ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
