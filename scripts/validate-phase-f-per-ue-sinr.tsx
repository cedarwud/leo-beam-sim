#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeLinkBudget } from '../src/engine/signal/link-budget';
import type { SatelliteSnapshot } from '../src/engine/signal/types';
import { makeChannelMetricValue } from '../src/scene/ChannelMetricValue';
import { sceneGeometryFromProfile } from '../src/scene/SceneGeometry';
import { createEmptyFrame } from '../src/scene/simulationHelpers';
import type { SimFrame } from '../src/scene/types';
import {
  fillPerUeServingSinr,
  type RuntimePerUeSinrPosition,
} from '../src/scene/runtimeFrameStep';
import { loadProfile } from '../src/profiles';
import { LIVE_CHANNEL_METRIC_KIND } from '../src/showcase/deriveLiveSceneFields';
import { liveSimToScene } from '../src/showcase/liveSimToScene';

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

const profile = loadProfile('hobs-2024-candidate-rich');
const snapshots: SatelliteSnapshot[] = [
  {
    id: 'sat-a',
    shellId: 'shell-a',
    altitudeKm: 780,
    ecefKm: [0, 0, 0],
    rangeKm: 900,
    elevationDeg: 70,
    azimuthDeg: 15,
    beamCellsKm: [
      { beamId: 0, offsetEastKm: 0, offsetNorthKm: 0, scanAngleDeg: 0 },
      { beamId: 1, offsetEastKm: 90, offsetNorthKm: 0, scanAngleDeg: 6 },
    ],
  },
  {
    id: 'sat-b',
    shellId: 'shell-b',
    altitudeKm: 780,
    ecefKm: [0, 0, 0],
    rangeKm: 960,
    elevationDeg: 55,
    azimuthDeg: 210,
    beamCellsKm: [
      { beamId: 0, offsetEastKm: -50, offsetNorthKm: 40, scanAngleDeg: 4 },
      { beamId: 1, offsetEastKm: 60, offsetNorthKm: 75, scanAngleDeg: 7 },
    ],
  },
];
const activeAssignments = snapshots.flatMap(satellite =>
  satellite.beamCellsKm.map(beam => ({ satId: satellite.id, beamId: beam.beamId })),
);
const linkBudgetOptions = {
  formulaFamily: profile.formulaFamily,
  channel: profile.channel,
  antenna: profile.antenna,
  ueAntenna: profile.ueAntenna,
  beams: profile.beams,
  activeAssignments,
  simTimeSec: 12,
} satisfies Parameters<typeof computeLinkBudget>[2];
const primaryServingSatId = 'sat-a';
const primaryServingBeamId = 0;
const primarySamples = computeLinkBudget(
  { latDeg: 25, lonDeg: 121, offsetEastKm: 0, offsetNorthKm: 0 },
  snapshots,
  linkBudgetOptions,
);
const primaryServingSinrDb = primarySamples.find(
  sample => sample.satId === primaryServingSatId && sample.beamId === primaryServingBeamId,
)?.sinrDb;

function createPositions(count: number): RuntimePerUeSinrPosition[] {
  const offsets = [
    [0, 0],
    [50, 0],
    [-25, 15],
    [20, -35],
    [42, 28],
  ];
  return Array.from({ length: count }, (_, i) => {
    const [eastKm, northKm] = offsets[i] ?? [i * 8, -i * 6];
    return {
      id: `live-ue-${i}`,
      groundX: eastKm,
      groundZ: -northKm,
      eastKm,
      northKm,
      sinrDb: null,
      servingSatId: null,
      servingBeamId: null,
      pendingTargetSatId: null,
      pendingTargetBeamId: null,
      triggerProgressSec: 0,
    };
  });
}

function fillPositions(count: number): RuntimePerUeSinrPosition[] {
  if (primaryServingSinrDb === undefined) {
    throw new Error('synthetic primary serving sample missing');
  }
  const perUePositions = createPositions(count);
  return fillPerUeServingSinr({
    perUePositions,
    primaryServingSinrDb,
    primaryServingSatId,
    primaryServingBeamId,
    primaryLatDeg: 25,
    primaryLonDeg: 121,
    primaryEastKm: perUePositions[0].eastKm,
    primaryNorthKm: perUePositions[0].northKm,
    snapshots,
    linkBudgetOptions,
  });
}

section('(a) SimFrame.perUePositions source contract', () => {
  const typesSource = source('src/scene/types.ts');
  check(
    /perUePositions:\s*ReadonlyArray<\{\s*id:\s*string;\s*groundX:\s*number;\s*groundZ:\s*number;\s*eastKm:\s*number;\s*northKm:\s*number;\s*sinrDb:\s*number\s*\|\s*null;/m.test(typesSource),
    'perUePositions entry includes id/groundX/groundZ/eastKm/northKm/sinrDb',
  );
});

section('(b) runtimeFrameStep.ts source wiring', () => {
  const runtimeSource = source('src/scene/runtimeFrameStep.ts');
  check(runtimeSource.includes('export function fillPerUeServingSinr'), 'runtime exports focused per-UE SINR helper');
  check(
    /for\s*\(\s*let\s+i\s*=\s*1;\s*i\s*<\s*perUePositions\.length;/.test(runtimeSource),
    'runtime iterates secondary UEs from index 1',
  );
  check(runtimeSource.includes('const secondarySamples = computeLinkBudget('), 'runtime calls computeLinkBudget for secondary UEs');
  check(
    runtimeSource.includes('perUePositions[0].sinrDb = primaryServingSinrDb')
      && runtimeSource.includes('const primaryServingSinrDb = hoManager.state.sinrDb'),
    'primary per-UE SINR is copied from existing serving SINR state',
  );
  check(
    runtimeSource.includes('primaryServingSatId === null || primaryServingBeamId === null'),
    'runtime sets secondary SINR null when primary serving is absent',
  );
});

section('(c) liveSimToScene.ts secondary metric wiring', () => {
  const liveSource = source('src/showcase/liveSimToScene.ts');
  check(liveSource.includes('pos.sinrDb ?? NaN'), 'liveSimToScene uses pos.sinrDb with NaN fallback');
  check(
    !liveSource.includes('channelMetric: makeChannelMetricValue(LIVE_CHANNEL_METRIC_KIND, NaN)'),
    'liveSimToScene no longer hard-codes NaN as secondary channelMetric',
  );
});

section('(d) focused per-UE SINR behavior', () => {
  const two = fillPositions(2);
  check(two[0].sinrDb === primaryServingSinrDb, 'primary sinrDb matches snapshot-derived primary value byte-for-byte');
  check(two[1].sinrDb !== null && Number.isFinite(two[1].sinrDb), 'secondary sinrDb is finite');
  check(two[1].sinrDb !== two[0].sinrDb, 'secondary sinrDb differs from primary');

  const five = fillPositions(5);
  check(five.every(pos => pos.sinrDb !== null && Number.isFinite(pos.sinrDb)), 'synthetic 5-UE scatter has finite SINR for every UE');
  const four = fillPositions(4);
  check(four.length === 4 && four.every(pos => pos.sinrDb !== null), 'removing one UE position produces N-1 SINR entries');
  check(new Set(five.map(pos => pos.sinrDb)).size > 1, '5-UE SINR values are not duplicated from primary');
});

section('(e) ueCount=1 zero-drift behavior', () => {
  const one = fillPositions(1);
  check(one.length === 1, 'ueCount=1 keeps one perUePositions entry');
  check(one[0].sinrDb === primaryServingSinrDb, 'ueCount=1 primary sinrDb is strict zero-drift copy');
});

section('(f) replay adapter negative assertion', () => {
  const replaySource = source('src/showcase/showcaseArtifactToScene.ts');
  check(
    !/generateUePositions|perUePositions|perUeSinr|fillPerUeServingSinr|RuntimePerUeSinr/.test(replaySource),
    'showcaseArtifactToScene.ts does not reference F-S2 live per-UE SINR symbols',
  );
});

section('(g) handover manager negative assertion', () => {
  const handoverSource = source('src/engine/handover/handover-manager.ts');
  check(
    !/perUe|per-UE|ueCount|multiUe|fillPerUeServingSinr|RuntimePerUeSinr/.test(handoverSource),
    'handover-manager.ts has no F-S2 per-UE handover/SINR wiring',
  );
});

const syntheticGeometry = sceneGeometryFromProfile({
  shell: { altitudeKm: 780 },
  antenna: { beamwidth3dBRad: 0.08 },
  handover: { triggerTimeSec: 0.2 },
  orbit: { shells: [{ id: 'shell-0', altitudeKm: 780 }] },
  beams: { frequencyReuse: 3 },
});

function createSyntheticFrameWithSinr(values: readonly number[]): SimFrame {
  const frame = createEmptyFrame(20);
  frame.serving = { satId: 'sat-a', beamId: 0, sinrDb: values[0] };
  frame.ueGroundX = 0;
  frame.ueGroundZ = 0;
  frame.perUePositions = values.map((sinrDb, i) => ({
    id: `live-ue-${i}`,
    groundX: i * 12,
    groundZ: -i * 6,
    eastKm: i * 12,
    northKm: i * 6,
    sinrDb,
    servingSatId: i === 0 ? frame.serving.satId : null,
    servingBeamId: i === 0 ? frame.serving.beamId : null,
    pendingTargetSatId: null,
    pendingTargetBeamId: null,
    triggerProgressSec: 0,
  }));
  return frame;
}

section('(h) liveSimToScene SSR per-UE channel metrics', () => {
  const frame = createSyntheticFrameWithSinr([-12, -8, -15]);
  const normalized = liveSimToScene(frame, syntheticGeometry);
  check(normalized.ues.length === 3, 'synthetic live frame projects 3 UEs');
  check(normalized.ues[0].channelMetric.dB === -12, 'primary gets -12 from sim.serving.sinrDb');
  check(normalized.ues[1].channelMetric.dB === -8, 'secondary 1 gets -8 from pos.sinrDb');
  check(normalized.ues[2].channelMetric.dB === -15, 'secondary 2 gets -15 from pos.sinrDb');
  check(
    sameJson(normalized.metrics.primary, makeChannelMetricValue(LIVE_CHANNEL_METRIC_KIND, -12)),
    'primary metrics remain existing serving metric',
  );
});

console.log(`\n[validate-phase-f-per-ue-sinr] ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
