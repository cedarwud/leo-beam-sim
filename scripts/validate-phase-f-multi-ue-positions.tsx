#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSeededRng, generateUePositions } from '../src/engine/ue/multiUeState';
import { sceneGeometryFromProfile } from '../src/scene/SceneGeometry';
import { makeChannelMetricValue } from '../src/scene/ChannelMetricValue';
import { createEmptyFrame } from '../src/scene/simulationHelpers';
import type { SimFrame } from '../src/scene/types';
import { liveSimToScene } from '../src/showcase/liveSimToScene';
import { LIVE_CHANNEL_METRIC_KIND } from '../src/showcase/deriveLiveSceneFields';

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

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

section('(a) multiUeState.ts source exports', () => {
  const multiUeStateSource = source('src/engine/ue/multiUeState.ts');
  for (const expected of [
    'export interface UePosition',
    'export function generateUePositions',
    'export function createSeededRng',
  ]) {
    check(multiUeStateSource.includes(expected), `multiUeState.ts contains ${expected}`);
  }
  check(!multiUeStateSource.includes('react'), 'multiUeState.ts does not import React');
  check(!multiUeStateSource.includes('three'), 'multiUeState.ts does not import Three.js');
});

section('(b) generateUePositions behavior', () => {
  const primaryEastKm = 3.25;
  const primaryNorthKm = -1.5;
  const primaryFootprintRadiusKm = 81;
  const ueWorldScale = 0.75;
  const primaryGroundX = primaryEastKm * ueWorldScale;
  const primaryGroundZ = -primaryNorthKm * ueWorldScale;

  const single = generateUePositions({
    ueCount: 1,
    primaryEastKm,
    primaryNorthKm,
    primaryFootprintRadiusKm,
    ueWorldScale,
  });
  check(single.length === 1, 'ueCount=1 returns exactly one UE');
  check(single[0].id === 'live-ue-0', 'ueCount=1 primary id is live-ue-0');
  check(single[0].groundX === primaryGroundX, 'ueCount=1 groundX is strict legacy formula');
  check(single[0].groundZ === primaryGroundZ, 'ueCount=1 groundZ is strict legacy formula');

  const ten = generateUePositions({
    ueCount: 10,
    primaryEastKm,
    primaryNorthKm,
    primaryFootprintRadiusKm,
    ueWorldScale,
    seed: 42,
  });
  check(ten.length === 10, 'ueCount=10 returns 10 UEs');
  check(ten[0].groundX === primaryGroundX && ten[0].groundZ === primaryGroundZ, 'ueCount=10 keeps primary at observer point');
  const maxWorldRadius = primaryFootprintRadiusKm * ueWorldScale;
  check(
    ten.slice(1).every(pos => Math.hypot(pos.groundX - primaryGroundX, pos.groundZ - primaryGroundZ) <= maxWorldRadius + 1e-9),
    'ueCount=10 secondaries are inside footprint disc',
  );

  const hundredA = generateUePositions({
    ueCount: 100,
    primaryEastKm,
    primaryNorthKm,
    primaryFootprintRadiusKm,
    ueWorldScale,
    seed: 42,
  });
  const hundredB = generateUePositions({
    ueCount: 100,
    primaryEastKm,
    primaryNorthKm,
    primaryFootprintRadiusKm,
    ueWorldScale,
    seed: 42,
  });
  check(
    sameJson(
      hundredA.map(pos => [pos.groundX, pos.groundZ]),
      hundredB.map(pos => [pos.groundX, pos.groundZ]),
    ),
    'ueCount=100 seed=42 reproduces byte-for-byte x/z arrays',
  );

  const differentSeed = generateUePositions({
    ueCount: 100,
    primaryEastKm,
    primaryNorthKm,
    primaryFootprintRadiusKm,
    ueWorldScale,
    seed: 43,
  });
  check(
    !sameJson(
      hundredA.slice(1).map(pos => [pos.groundX, pos.groundZ]),
      differentSeed.slice(1).map(pos => [pos.groundX, pos.groundZ]),
    ),
    'different seeds produce different secondary scatters',
  );

  const two = generateUePositions({
    ueCount: 2,
    primaryEastKm,
    primaryNorthKm,
    primaryFootprintRadiusKm,
    ueWorldScale,
    seed: 42,
  });
  const secondaryDistance = Math.hypot(two[1].groundX - primaryGroundX, two[1].groundZ - primaryGroundZ);
  check(two.length === 2, 'ueCount=2 returns primary plus one secondary');
  check(secondaryDistance <= maxWorldRadius + 1e-9, 'ueCount=2 secondary is inside disc');
  check(secondaryDistance > 0, 'ueCount=2 secondary is not exactly at primary');
});

section('(c) createSeededRng Mulberry32 behavior', () => {
  const rngA = createSeededRng(42);
  const rngB = createSeededRng(42);
  const rngC = createSeededRng(43);
  const seqA = Array.from({ length: 10 }, () => rngA());
  const seqB = Array.from({ length: 10 }, () => rngB());
  const firstC = rngC();
  check(sameJson(seqA, seqB), 'seed=42 produces identical first 10 calls');
  check(seqA[0] !== firstC, 'different seeds diverge after first call');
  check(seqA.every(value => value >= 0 && value < 1), 'all seed=42 values are in [0, 1)');
  check(firstC >= 0 && firstC < 1, 'different-seed value is in [0, 1)');
});

section('(d) SimFrame source contract', () => {
  const typesSource = source('src/scene/types.ts');
  check(
    /perUePositions:\s*ReadonlyArray<\{\s*id:\s*string;\s*groundX:\s*number;\s*groundZ:\s*number;\s*eastKm:\s*number;\s*northKm:\s*number;/m.test(typesSource),
    'SimFrame.perUePositions declared with expected ReadonlyArray shape',
  );
  check(/\bueGroundX:\s*number;/.test(typesSource), 'SimFrame.ueGroundX is still declared');
  check(/\bueGroundZ:\s*number;/.test(typesSource), 'SimFrame.ueGroundZ is still declared');
});

section('(e) runtimeFrameStep.ts source wiring', () => {
  const runtimeSource = source('src/scene/runtimeFrameStep.ts');
  check(
    runtimeSource.includes("import { generateUePositions } from '../engine/ue/multiUeState'"),
    'runtimeFrameStep imports generateUePositions from engine/ue',
  );
  check(runtimeSource.includes('ueCount?: number'), 'runtimeFrameStep input accepts optional ueCount');
  check(runtimeSource.includes('const ueCount = inputUeCount ?? 1'), 'runtimeFrameStep defaults ueCount to 1');
  for (const expected of [
    'generateUePositions({',
    'ueCount,',
    'primaryEastKm: ueEastKm',
    'primaryNorthKm: ueNorthKm',
    'primaryFootprintRadiusKm: primaryGeometry.footprintRadiusKm',
    'ueWorldScale',
    'perUePositions,',
    'const ueGroundX = perUePositions[0].groundX',
    'const ueGroundZ = perUePositions[0].groundZ',
  ]) {
    check(runtimeSource.includes(expected), `runtimeFrameStep contains ${expected}`);
  }
});

section('(f) liveSimToScene.ts source wiring', () => {
  const liveSource = source('src/showcase/liveSimToScene.ts');
  check(liveSource.includes('live N variable'), 'liveSimToScene comment mentions live N variable');
  check(!liveSource.includes('live N=1 fixed'), 'liveSimToScene no longer contains live N=1 fixed');
  check(liveSource.includes('sim.perUePositions') && liveSource.includes('.map((pos, i)'), 'liveSimToScene maps live UE positions');
  check(liveSource.includes("const liveUeId = 'live-ue-0'"), 'liveSimToScene preserves primary live-ue-0 ID');
});

section('(g) replay path negative assertion', () => {
  const replayPath = 'src/showcase/showcaseArtifactToScene.ts';
  const replaySource = source(replayPath);
  check(!replaySource.includes('../engine/ue/multiUeState'), 'showcaseArtifactToScene.ts does not import multiUeState');
  check(!/generateUePositions|perUePositions/.test(replaySource), 'showcaseArtifactToScene.ts does not reference generateUePositions or perUePositions');
});

function createSyntheticFrame(perUeCount: number): SimFrame {
  const primary = { id: 'live-ue-0', groundX: 12.5, groundZ: -7.75, eastKm: 1.25, northKm: 0.775 };
  const frame = createEmptyFrame(12);
  frame.serving = { satId: 'sat-0', beamId: 3, sinrDb: 17.25 };
  frame.pendingTargetSatId = 'sat-1';
  frame.pendingTargetBeamId = 4;
  frame.pendingTargetSinrDb = 18;
  frame.ueGroundX = primary.groundX;
  frame.ueGroundZ = primary.groundZ;
  frame.perUePositions = Array.from({ length: perUeCount }, (_, i) => (
    i === 0
      ? primary
      : {
        id: `live-ue-${i}`,
        groundX: primary.groundX + i,
        groundZ: primary.groundZ - i,
        eastKm: primary.eastKm + i * 0.1,
        northKm: primary.northKm - i * 0.1,
      }
  ));
  return frame;
}

const syntheticGeometry = sceneGeometryFromProfile({
  shell: { altitudeKm: 780 },
  antenna: { beamwidth3dBRad: 0.08 },
  handover: { triggerTimeSec: 0.2 },
  orbit: { shells: [{ id: 'shell-0', altitudeKm: 780 }] },
  beams: { frequencyReuse: 3 },
});

section('(h) zero-drift mini-SimFrame alias check', () => {
  const frame = createSyntheticFrame(1);
  check(frame.ueGroundX === frame.perUePositions[0].groundX, 'ueGroundX mirrors perUePositions[0].groundX');
  check(frame.ueGroundZ === frame.perUePositions[0].groundZ, 'ueGroundZ mirrors perUePositions[0].groundZ');
  const normalized = liveSimToScene(frame, syntheticGeometry);
  check(normalized.ues[0].worldPos?.[0] === frame.ueGroundX, 'live adapter primary worldPos X preserves legacy alias');
  check(normalized.ues[0].worldPos?.[2] === frame.ueGroundZ, 'live adapter primary worldPos Z preserves legacy alias');
});

section('(i) liveSimToScene synthetic SSR behavior', () => {
  const one = liveSimToScene(createSyntheticFrame(1), syntheticGeometry);
  check(one.ues.length === 1, 'ueCount=1 synthetic frame projects one UE');
  check(one.ues[0].id === 'live-ue-0', 'ueCount=1 projected UE is live-ue-0');
  check(one.ues[0].channelMetric.dB === 17.25, 'ueCount=1 primary carries serving SINR');
  check(
    sameJson(one.metrics.primary, makeChannelMetricValue(LIVE_CHANNEL_METRIC_KIND, 17.25)),
    'ueCount=1 metrics primary remains legacy serving metric',
  );

  const five = liveSimToScene(createSyntheticFrame(5), syntheticGeometry);
  check(five.ues.length === 5, 'ueCount=5 synthetic frame projects five UEs');
  check(five.ues[0].id === 'live-ue-0', 'ueCount=5 primary remains live-ue-0');
  check(five.ues.slice(1).every((ue, index) => ue.id === `live-ue-${index + 1}`), 'ueCount=5 secondary IDs are live-ue-N');
  check(five.ues.slice(1).every(ue => Number.isNaN(ue.channelMetric.dB)), 'ueCount=5 secondaries carry absent SINR as NaN metric');
  check(five.ues.slice(1).every(ue => ue.servingSatelliteId === '' && ue.servingBeamId === ''), 'ueCount=5 secondaries have empty serving fields');
  check(five.ues.slice(1).every(ue => ue.targetSatelliteId === null && ue.targetBeamId === null), 'ueCount=5 secondaries have null target fields');
});

console.log(`\n[validate-phase-f-multi-ue-positions] ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
