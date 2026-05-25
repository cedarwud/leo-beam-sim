#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createObserverContext } from '../src/engine/orbit';
import { HandoverManager } from '../src/engine/handover/handover-manager';
import type { LinkSample, SatelliteSnapshot } from '../src/engine/signal/types';
import { computeLinkBudget } from '../src/engine/signal/link-budget';
import { makeChannelMetricValue } from '../src/scene/ChannelMetricValue';
import { sceneGeometryFromProfile } from '../src/scene/SceneGeometry';
import {
  createBeamLayoutsByShellId,
  createRuntimeFrameStepState,
  createTrajectoryCache,
  getTrajectoryMaxTimeSec,
  stepRuntimeFrame,
  stepSecondaryUeHandovers,
  type RuntimePerUeSinrPosition,
} from '../src/scene/runtimeFrameStep';
import { createEmptyFrame, normalizeReplayOffset } from '../src/scene/simulationHelpers';
import type { SimFrame } from '../src/scene/types';
import { loadProfile } from '../src/profiles';
import type { Profile } from '../src/profiles/types';
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

function tunedProfile(): Profile {
  const profile = structuredClone(loadProfile('hobs-2024-candidate-rich'));
  return {
    ...profile,
    antenna: {
      ...profile.antenna,
      maxSteeringAngleDeg: 45,
      beamwidth3dBRad: 0.12,
    },
    handover: {
      ...profile.handover,
      sinrThresholdDb: -100,
      offsetDb: 1,
      triggerTimeSec: 2,
      pingPongGuardSec: 0,
      pendingTargetHoldSec: 0,
      intraSwitchTimeSec: 10,
      sinrSmoothingSec: 0,
    },
  };
}

function emptyPosition(id: string, eastKm: number, northKm: number): RuntimePerUeSinrPosition {
  return {
    id,
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
}

function sample(satId: string, beamId: number, sinrDb: number): LinkSample {
  return {
    satId,
    beamId,
    sinrDb,
    rsrpDbm: sinrDb,
    signalDbm: sinrDb,
    intraInterferenceDbm: -Infinity,
    interInterferenceDbm: -Infinity,
    noiseDbm: -100,
    denominatorDbm: -100,
    txPowerDbm: 40,
    pathLossDb: 100,
    beamGainDb: 0,
    steeringLossDb: 0,
    receiverGainDbi: 0,
  };
}

section('(a) SimFrame.perUePositions source contract', () => {
  const typesSource = source('src/scene/types.ts');
  for (const expected of [
    'sinrDb: number | null;',
    'servingSatId: string | null;',
    'servingBeamId: number | null;',
    'pendingTargetSatId: string | null;',
    'pendingTargetBeamId: number | null;',
    'triggerProgressSec: number;',
  ]) {
    check(typesSource.includes(expected), `perUePositions entry includes ${expected}`);
  }
});

section('(b) useSimulation.ts per-UE manager wiring', () => {
  const useSimulationSource = source('src/scene/useSimulation.ts');
  check(useSimulationSource.includes('new S3HandoverManager(profile.handover)'), 'primary hoManager still uses S3HandoverManager');
  check(useSimulationSource.includes('const secondaryHoManagers = useMemo('), 'useSimulation tracks secondaryHoManagers with useMemo');
  check(useSimulationSource.includes('new HandoverManager(profile.handover)'), 'useSimulation creates base HandoverManager instances for secondaries');
  check(useSimulationSource.includes('function resetAllHoManagers') || useSimulationSource.includes('const resetAllHoManagers'), 'useSimulation declares resetAllHoManagers helper');
  check(useSimulationSource.includes('secondaryHoManagers.forEach(manager => manager.reset())'), 'resetAllHoManagers resets all secondary managers');
  check(useSimulationSource.includes('secondaryHoManagers,') && useSimulationSource.includes('ueCount: effectiveUeCount'), 'stepRuntimeFrame receives secondary managers and ueCount');
});

section('(c) runtimeFrameStep.ts secondary handover loop', () => {
  const runtimeSource = source('src/scene/runtimeFrameStep.ts');
  check(runtimeSource.includes('secondaryHoManagers?: readonly HandoverManager[]'), 'stepRuntimeFrame accepts optional secondaryHoManagers');
  check(runtimeSource.includes('export function stepSecondaryUeHandovers'), 'runtime exports secondary handover helper');
  check(runtimeSource.includes('const secondarySamples = computeLinkBudget('), 'secondary loop calls computeLinkBudget per UE');
  check(runtimeSource.includes('manager.update(secondarySamples, dtSec, simTimeMs)'), 'secondary loop updates each HandoverManager');
  for (const expected of [
    'ueSecondary.servingSatId = manager.state.satId',
    'ueSecondary.servingBeamId = manager.state.beamId',
    'ueSecondary.pendingTargetSatId = manager.state.pendingTarget?.satId ?? null',
    'ueSecondary.pendingTargetBeamId = manager.state.pendingTarget?.beamId ?? null',
    'ueSecondary.triggerProgressSec = manager.state.pendingTarget ? manager.state.triggerTimeSec : 0',
  ]) {
    check(runtimeSource.includes(expected), `secondary loop fills ${expected}`);
  }
});

section('(d) liveSimToScene.ts per-UE serving projection', () => {
  const liveSource = source('src/showcase/liveSimToScene.ts');
  for (const expected of [
    'servingSatelliteId: sim.serving.satId ??',
    'String(sim.serving.beamId)',
    'targetSatelliteId: sim.pendingTargetSatId',
    'servingSatelliteId: pos.servingSatId ??',
    'pos.servingBeamId !== null ? String(pos.servingBeamId) :',
    'targetSatelliteId: pos.pendingTargetSatId',
    'pos.pendingTargetBeamId !== null ? String(pos.pendingTargetBeamId) : null',
  ]) {
    check(liveSource.includes(expected), `liveSimToScene contains ${expected}`);
  }
});

section('(e) handover-manager.ts negative assertion', () => {
  const handoverSource = source('src/engine/handover/handover-manager.ts');
  check(!/secondaryHoManagers|perUePositions|ueCount|RuntimePerUe/.test(handoverSource), 'handover-manager.ts has no PR-omega per-UE API wiring');
  check(handoverSource.includes('export class HandoverManager'), 'handover-manager.ts still exposes the reused HandoverManager class');
});

section('(f) replay adapter negative assertion', () => {
  const replaySource = source('src/showcase/showcaseArtifactToScene.ts');
  check(!/generateUePositions|perUePositions|secondaryHoManagers/.test(replaySource), 'showcaseArtifactToScene.ts has no live per-UE handover symbols');
  check(replaySource.includes('showcaseArtifactToScene'), 'showcaseArtifactToScene.ts remains the replay adapter surface');
});

section('(g) constructed secondary handover behavior', () => {
  const profile = tunedProfile();
  const snapshots: SatelliteSnapshot[] = [
    {
      id: 'sat-east',
      shellId: 'shell-a',
      altitudeKm: 780,
      ecefKm: [0, 0, 0],
      rangeKm: 900,
      elevationDeg: 80,
      azimuthDeg: 90,
      beamCellsKm: [{ beamId: 1, offsetEastKm: 80, offsetNorthKm: 0, scanAngleDeg: 0 }],
    },
    {
      id: 'sat-west',
      shellId: 'shell-b',
      altitudeKm: 780,
      ecefKm: [0, 0, 0],
      rangeKm: 900,
      elevationDeg: 80,
      azimuthDeg: 270,
      beamCellsKm: [{ beamId: 2, offsetEastKm: -80, offsetNorthKm: 0, scanAngleDeg: 0 }],
    },
    {
      id: 'sat-north',
      shellId: 'shell-c',
      altitudeKm: 780,
      ecefKm: [0, 0, 0],
      rangeKm: 900,
      elevationDeg: 80,
      azimuthDeg: 0,
      beamCellsKm: [{ beamId: 3, offsetEastKm: 0, offsetNorthKm: 80, scanAngleDeg: 0 }],
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
    simTimeSec: 10,
  } satisfies Parameters<typeof computeLinkBudget>[2];
  const positions = [
    emptyPosition('live-ue-0', 0, 0),
    emptyPosition('live-ue-1', 80, 0),
    emptyPosition('live-ue-2', -80, 0),
    emptyPosition('live-ue-3', 0, 80),
  ];
  const managers = Array.from({ length: 3 }, () => new HandoverManager(profile.handover));
  stepSecondaryUeHandovers({
    perUePositions: positions,
    secondaryHoManagers: managers,
    primaryLatDeg: 25,
    primaryLonDeg: 121,
    primaryEastKm: 0,
    primaryNorthKm: 0,
    snapshots,
    linkBudgetOptions,
    dtSec: 0.5,
    simTimeMs: 1000,
  });

  const expected = positions.slice(1).map(pos => {
    const best = computeLinkBudget(
      { latDeg: 25 + pos.northKm / 111.32, lonDeg: 121 + pos.eastKm / 111.32, offsetEastKm: pos.eastKm, offsetNorthKm: pos.northKm },
      snapshots,
      linkBudgetOptions,
    ).sort((a, b) => b.sinrDb - a.sinrDb)[0];
    return `${best.satId}:${best.beamId}`;
  });
  const actual = positions.slice(1).map(pos => `${pos.servingSatId}:${pos.servingBeamId}`);
  check(sameJson(actual, expected), 'each secondary picks its own best-SINR computed candidate');
  check(new Set(actual).size === 3, 'secondary serving choices are not copied from one primary serving');

  const pendingManagers = Array.from({ length: 2 }, () => new HandoverManager(profile.handover));
  pendingManagers[0].update([sample('sat-a', 0, 10), sample('sat-b', 0, 8)], 0.1, 0);
  pendingManagers[1].update([sample('sat-a', 0, 10), sample('sat-b', 0, 8)], 0.1, 0);
  pendingManagers[0].update([sample('sat-a', 0, 0), sample('sat-b', 0, 8)], 0.5, 1000);
  pendingManagers[1].update([sample('sat-a', 0, 10), sample('sat-b', 0, 8)], 0.5, 1000);
  check(pendingManagers[0].state.pendingTarget?.satId === 'sat-b', 'one UE can hold an independent pending target');
  check(pendingManagers[0].state.triggerTimeSec > 0, 'one UE accumulates trigger progress');
  check(pendingManagers[1].state.pendingTarget === null, 'other UE pending target is unaffected');
  check(pendingManagers[1].state.triggerTimeSec === 0, 'other UE trigger progress is unaffected');
});

section('(h) ueCount=1 zero-drift behavior', () => {
  const profile = tunedProfile();
  const observer = createObserverContext(profile.orbit.observerLatDeg, profile.orbit.observerLonDeg);
  const replay = { epochUtcMs: Date.UTC(2026, 0, 1), startOffsetSec: 30, loop: true };
  const trajectoryCache = createTrajectoryCache(profile, observer, replay.epochUtcMs);
  const maxTimeSec = getTrajectoryMaxTimeSec(trajectoryCache);
  const state = createRuntimeFrameStepState(normalizeReplayOffset(replay.startOffsetSec, maxTimeSec, true));
  const { frame } = stepRuntimeFrame({
    profile,
    replay,
    speed: 1,
    paused: false,
    deltaSec: 0.1,
    ueCount: 1,
    secondaryHoManagers: [],
    observer,
    beamLayoutsByShellId: createBeamLayoutsByShellId(profile),
    trajectoryCache,
    hoManager: new HandoverManager(profile.handover),
    state,
  });
  check(frame.perUePositions.length === 1, 'ueCount=1 has exactly one perUePositions entry');
  check(frame.perUePositions[0].servingSatId === frame.serving.satId, 'primary servingSatId mirrors sim.serving.satId');
  check(frame.perUePositions[0].servingBeamId === frame.serving.beamId, 'primary servingBeamId mirrors sim.serving.beamId');
  check(frame.perUePositions[0].pendingTargetSatId === frame.pendingTargetSatId, 'primary pendingTargetSatId mirrors sim.pendingTargetSatId');
  check(frame.perUePositions[0].pendingTargetBeamId === frame.pendingTargetBeamId, 'primary pendingTargetBeamId mirrors sim.pendingTargetBeamId');
  check(frame.perUePositions[0].triggerProgressSec === frame.handoverTriggerProgressSec, 'primary triggerProgressSec mirrors sim.handoverTriggerProgressSec');
});

const syntheticGeometry = sceneGeometryFromProfile({
  shell: { altitudeKm: 780 },
  antenna: { beamwidth3dBRad: 0.08 },
  handover: { triggerTimeSec: 0.2 },
  orbit: { shells: [{ id: 'shell-0', altitudeKm: 780 }] },
  beams: { frequencyReuse: 3 },
});

function createSyntheticFrame(): SimFrame {
  const frame = createEmptyFrame(20);
  frame.serving = { satId: 'primary-sat', beamId: 7, sinrDb: -4 };
  frame.pendingTargetSatId = 'primary-target';
  frame.pendingTargetBeamId = 8;
  frame.handoverTriggerProgressSec = 1.25;
  frame.perUePositions = [
    {
      id: 'live-ue-0',
      groundX: 0,
      groundZ: 0,
      eastKm: 0,
      northKm: 0,
      sinrDb: -4,
      servingSatId: 'ignored-primary-pos-sat',
      servingBeamId: 99,
      pendingTargetSatId: null,
      pendingTargetBeamId: null,
      triggerProgressSec: 0,
    },
    {
      id: 'live-ue-1',
      groundX: 10,
      groundZ: -2,
      eastKm: 10,
      northKm: 2,
      sinrDb: -8,
      servingSatId: 'secondary-a',
      servingBeamId: 1,
      pendingTargetSatId: 'secondary-a-target',
      pendingTargetBeamId: 2,
      triggerProgressSec: 0.5,
    },
    {
      id: 'live-ue-2',
      groundX: -8,
      groundZ: 4,
      eastKm: -8,
      northKm: -4,
      sinrDb: -12,
      servingSatId: 'secondary-b',
      servingBeamId: 3,
      pendingTargetSatId: null,
      pendingTargetBeamId: null,
      triggerProgressSec: 0,
    },
  ];
  return frame;
}

section('(i) liveSimToScene SSR per-UE serving projection', () => {
  const normalized = liveSimToScene(createSyntheticFrame(), syntheticGeometry);
  check(normalized.ues.length === 3, 'synthetic frame projects 3 UEs');
  check(normalized.ues[0].servingSatelliteId === 'primary-sat', 'primary UE uses sim.serving.satId');
  check(normalized.ues[0].servingBeamId === '7', 'primary UE uses sim.serving.beamId');
  check(normalized.ues[0].targetSatelliteId === 'primary-target', 'primary UE uses sim.pendingTargetSatId');
  check(normalized.ues[1].servingSatelliteId === 'secondary-a', 'secondary 1 uses pos.servingSatId');
  check(normalized.ues[1].servingBeamId === '1', 'secondary 1 uses pos.servingBeamId');
  check(normalized.ues[1].targetSatelliteId === 'secondary-a-target', 'secondary 1 uses pos.pendingTargetSatId');
  check(normalized.ues[1].targetBeamId === '2', 'secondary 1 uses pos.pendingTargetBeamId');
  check(normalized.ues[2].servingSatelliteId === 'secondary-b', 'secondary 2 uses pos.servingSatId');
  check(normalized.ues[2].targetSatelliteId === null, 'secondary 2 preserves null pending target');
  check(
    sameJson(normalized.metrics.primary, makeChannelMetricValue(LIVE_CHANNEL_METRIC_KIND, -4)),
    'primary metrics remain sim.serving-derived',
  );
});

console.log(`\n[validate-phase-f-per-ue-handover] ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
