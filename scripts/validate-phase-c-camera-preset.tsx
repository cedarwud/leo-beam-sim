#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ControlBar } from '../src/ui/ControlBar';
import type { CameraPreset } from '../src/scene/types';

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

function countOccurrences(value: string, pattern: RegExp): number {
  return value.match(pattern)?.length ?? 0;
}

function extractConstArray(sourceText: string, constName: string): string {
  const match = sourceText.match(new RegExp(`const\\s+${constName}:[\\s\\S]*?=\\s*\\[([\\s\\S]*?)\\];`));
  return match?.[1] ?? '';
}

function extractConstObject(sourceText: string, constName: string): string {
  const match = sourceText.match(new RegExp(`const\\s+${constName}:[\\s\\S]*?=\\s*\\{([\\s\\S]*?)\\};`));
  return match?.[1] ?? '';
}

function renderControlBarMarkup(): string {
  const noop = () => undefined;
  const onCameraPresetSelect = (_preset: CameraPreset) => undefined;
  return renderToString(
    <ControlBar
      selectedProfileId="hobs-2024-candidate-rich"
      profileOptions={[{ id: 'hobs-2024-candidate-rich', label: 'HOBS candidate rich' }]}
      paused={false}
      speed={1}
      effectiveSpeed={1}
      autoSlowActive={false}
      autoSlowApplied={false}
      autoSlowEnabled={true}
      uiMode="presentation"
      beamDensity="event-plus-1"
      beamCalloutsEnabled={true}
      cinematicMode="off"
      onProfileChange={noop}
      onUiModeChange={noop}
      onBeamDensityChange={noop}
      onToggleBeamCallouts={noop}
      onCameraPresetSelect={onCameraPresetSelect}
      onCinematicModeChange={noop}
      onTogglePause={noop}
      onSpeedChange={noop}
      onDismissAutoSlow={noop}
      onToggleAutoSlow={noop}
      onHandoverModeChange={noop}
    />,
  );
}

const expectedPresets = ['zenith', 'oblique', 'chase', 'paper-faithful-closeup'] as const;
const expectedTestIds = expectedPresets.map(preset => `camera-preset-${preset}`);

section('(a) CameraPreset union source', () => {
  const typesSource = source('src/scene/types.ts');
  check(
    typesSource.includes("export type CameraPreset = 'zenith' | 'oblique' | 'chase' | 'paper-faithful-closeup'"),
    'CameraPreset union includes paper-faithful-closeup after the existing presets',
  );
});

section('(b) MainScene camera pose source', () => {
  const mainSceneSource = source('src/scene/MainScene.tsx');
  const poseRecord = extractConstObject(mainSceneSource, 'CAMERA_PRESET_POSES');
  check(poseRecord.includes("'paper-faithful-closeup'"), 'CAMERA_PRESET_POSES contains paper-faithful-closeup key');
  check(/'paper-faithful-closeup'[\s\S]*?position:\s*\[\s*0,\s*320,\s*380\s*\]/.test(poseRecord), 'paper-faithful-closeup position is [0, 320, 380]');
  check(/'paper-faithful-closeup'[\s\S]*?target:\s*\[\s*0,\s*80,\s*0\s*\]/.test(poseRecord), 'paper-faithful-closeup target is [0, 80, 0]');
  check(/Record<CameraPreset/.test(mainSceneSource), 'CAMERA_PRESET_POSES remains typed as Record<CameraPreset, ...>');
});

section('(c) ControlBar camera preset source', () => {
  const controlBarSource = source('src/ui/ControlBar.tsx');
  const presetArray = extractConstArray(controlBarSource, 'CAMERA_PRESETS');
  check(countOccurrences(presetArray, /\bpreset:/g) === 4, 'CAMERA_PRESETS array contains 4 preset entries');
  check(presetArray.includes('Paper-faithful close-up'), 'CAMERA_PRESETS contains Paper-faithful close-up label');
  check(presetArray.includes("preset: 'paper-faithful-closeup'"), 'CAMERA_PRESETS contains paper-faithful-closeup preset literal');
  for (const preset of ['zenith', 'oblique', 'chase']) {
    check(presetArray.includes(`preset: '${preset}'`), `CAMERA_PRESETS preserves ${preset}`);
  }
});

section('(d) ControlBar SSR camera preset buttons', () => {
  const markup = renderControlBarMarkup();
  check(markup.includes('data-testid="camera-preset-control"'), 'SSR render preserves camera-preset-control parent testid');
  for (const testId of expectedTestIds) {
    check(markup.includes(`data-testid="${testId}"`), `SSR render contains ${testId}`);
  }
});

section('(e) CameraPreset Record exhaustiveness source', () => {
  const mainSceneSource = source('src/scene/MainScene.tsx');
  const poseRecord = extractConstObject(mainSceneSource, 'CAMERA_PRESET_POSES');
  for (const preset of expectedPresets) {
    const keyPattern = preset === 'paper-faithful-closeup'
      ? /'paper-faithful-closeup'\s*:/
      : new RegExp(`\\b${preset}\\s*:`);
    check(keyPattern.test(poseRecord), `CAMERA_PRESET_POSES contains ${preset} key`);
  }
  check(countOccurrences(poseRecord, /\bposition:\s*\[/g) === 4, 'CAMERA_PRESET_POSES contains 4 position entries');
  check(countOccurrences(poseRecord, /\btarget:\s*\[/g) === 4, 'CAMERA_PRESET_POSES contains 4 target entries');
});

section('(f) Regression: existing preset testids still produce-able', () => {
  const controlBarSource = source('src/ui/ControlBar.tsx');
  const presetArray = extractConstArray(controlBarSource, 'CAMERA_PRESETS');
  for (const preset of ['zenith', 'oblique', 'chase']) {
    check(presetArray.includes(`preset: '${preset}'`), `existing ${preset} array entry still feeds camera-preset-${preset}`);
  }
  check(
    controlBarSource.includes('data-testid={`camera-preset-${option.preset}`}'),
    'ControlBar still derives child camera testids from option.preset',
  );
});

console.log('\n---');
console.log(`[validate-phase-c-camera-preset] ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
