#!/usr/bin/env node
// validate-phase-3-cpu-budget.tsx
//
// Phase 3 S1 CPU-budget gate:
//   (a) secondary UE recompute cadence is sim-time throttled at fixed Hz,
//       decoupled from render FPS and Director slow-mo wall-clock FPS
//   (b) skip frames hold the last real secondary serving snapshot
//   (c) unthrottled 100-UE secondary recompute remains below a generous
//       gross-regression ceiling; cadence assertions are the robust gate
//   (e) every useSimulation effect that depends on UE distribution/mobility
//       invariants invalidates the secondary serving cache (or recreates the
//       runtime state), so a same-count input change cannot leave stale
//       serving/SINR applied to regenerated positions (codex review [P2])
//
// Run: node --import tsx/esm scripts/validate-phase-3-cpu-budget.tsx

import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { HandoverManager } from '../src/engine/handover/handover-manager';
import { createObserverContext } from '../src/engine/orbit';
import { computeLinkBudget } from '../src/engine/signal/link-budget';
import type { SatelliteSnapshot } from '../src/engine/signal/types';
import { loadProfile } from '../src/profiles';
import type { Profile } from '../src/profiles/types';
import {
  SECONDARY_UE_RECOMPUTE_HZ,
  createBeamLayoutsByShellId,
  createRuntimeFrameStepState,
  createTrajectoryCache,
  shouldRecomputeSecondary,
  stepRuntimeFrame,
  stepSecondaryUeHandovers,
  type RuntimePerUeSinrPosition,
  type SecondaryServingSnapshot,
} from '../src/scene/runtimeFrameStep';

let passed = 0;
let failed = 0;
let measuredUnthrottledMsPerFrame = 0;
let measuredSpeedOneRecomputeCount = 0;
let measuredSlowRecomputeCount = 0;

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

function tunedProfile(): Profile {
  const profile = JSON.parse(JSON.stringify(loadProfile('hobs-2024-candidate-rich'))) as Profile;
  return {
    ...profile,
    handover: {
      ...profile.handover,
      sinrThresholdDb: -120,
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

function secondarySnapshot(position: RuntimePerUeSinrPosition): SecondaryServingSnapshot {
  return {
    sinrDb: position.sinrDb,
    servingSatId: position.servingSatId,
    servingBeamId: position.servingBeamId,
    pendingTargetSatId: position.pendingTargetSatId,
    pendingTargetBeamId: position.pendingTargetBeamId,
    triggerProgressSec: position.triggerProgressSec,
  };
}

function sameSnapshot(
  left: SecondaryServingSnapshot | null | undefined,
  right: SecondaryServingSnapshot | null | undefined,
): boolean {
  if (!left || !right) return false;
  return Object.is(left.sinrDb, right.sinrDb)
    && left.servingSatId === right.servingSatId
    && left.servingBeamId === right.servingBeamId
    && left.pendingTargetSatId === right.pendingTargetSatId
    && left.pendingTargetBeamId === right.pendingTargetBeamId
    && Object.is(left.triggerProgressSec, right.triggerProgressSec);
}

function expectedRecomputeCount(frames: number, deltaSec: number, speed: number): number {
  if (frames <= 0) return 0;
  const intervalSec = 1 / SECONDARY_UE_RECOMPUTE_HZ;
  const sampledSimSecAfterFirstFrame = Math.max(0, frames - 1) * deltaSec * Math.max(0, speed);
  return 1 + Math.floor((sampledSimSecAfterFirstFrame + 1e-12) / intervalSec);
}

interface CadenceRun {
  recomputeCount: number;
  recomputeFlags: boolean[];
  cacheHoldChecks: number;
  cacheHoldViolations: number;
  previousHoldChecks: number;
  previousHoldViolations: number;
}

function runRuntimeCadence(input: {
  readonly frames: number;
  readonly deltaSec: number;
  readonly speed: number;
  readonly ueCount: number;
}): CadenceRun {
  const profile = tunedProfile();
  const replay = {
    epochUtcMs: Date.UTC(2026, 0, 1),
    startOffsetSec: 0,
    loop: true,
  };
  const observer = createObserverContext(profile.orbit.observerLatDeg, profile.orbit.observerLonDeg);
  const trajectoryCache = createTrajectoryCache(profile, observer, replay.epochUtcMs);
  const state = createRuntimeFrameStepState(0);
  const secondaryHoManagers = Array.from(
    { length: Math.max(0, input.ueCount - 1) },
    () => new HandoverManager(profile.handover),
  );
  const common = {
    profile,
    replay,
    paused: false,
    observer,
    beamLayoutsByShellId: createBeamLayoutsByShellId(profile),
    trajectoryCache,
    hoManager: new HandoverManager(profile.handover),
    secondaryHoManagers,
    ueCount: input.ueCount,
    ueDistributionMode: 'random' as const,
    ueDistributionScope: 'service-area' as const,
    state,
  };

  let recomputeCount = 0;
  let previousSnapshot: SecondaryServingSnapshot | null = null;
  let cacheHoldChecks = 0;
  let cacheHoldViolations = 0;
  let previousHoldChecks = 0;
  let previousHoldViolations = 0;
  const recomputeFlags: boolean[] = [];

  for (let frameIndex = 0; frameIndex < input.frames; frameIndex += 1) {
    const output = stepRuntimeFrame({
      ...common,
      speed: input.speed,
      deltaSec: input.deltaSec,
    });
    recomputeFlags.push(output.secondaryRecomputedThisFrame);
    if (output.secondaryRecomputedThisFrame) recomputeCount += 1;

    const secondary = output.frame.perUePositions[1];
    if (secondary) {
      const current = secondarySnapshot(secondary);
      if (!output.secondaryRecomputedThisFrame) {
        const cached = state.secondaryServingCache?.[0] ?? null;
        cacheHoldChecks += 1;
        if (!sameSnapshot(current, cached)) cacheHoldViolations += 1;

        if (previousSnapshot) {
          previousHoldChecks += 1;
          if (!sameSnapshot(current, previousSnapshot)) previousHoldViolations += 1;
        }
      }
      previousSnapshot = current;
    }
  }

  return {
    recomputeCount,
    recomputeFlags,
    cacheHoldChecks,
    cacheHoldViolations,
    previousHoldChecks,
    previousHoldViolations,
  };
}

function buildBenchmarkSnapshots(): SatelliteSnapshot[] {
  const satelliteCenters = [
    { eastKm: 0, northKm: 0, elevationDeg: 84, azimuthDeg: 0 },
    { eastKm: 125, northKm: 0, elevationDeg: 78, azimuthDeg: 45 },
    { eastKm: -125, northKm: 0, elevationDeg: 76, azimuthDeg: 90 },
    { eastKm: 0, northKm: 95, elevationDeg: 74, azimuthDeg: 135 },
    { eastKm: 0, northKm: -95, elevationDeg: 72, azimuthDeg: 180 },
    { eastKm: 95, northKm: 70, elevationDeg: 70, azimuthDeg: 225 },
  ];
  const localBeamOffsets = [
    [0, 0],
    [48, 0],
    [-48, 0],
    [0, 48],
    [0, -48],
    [34, 34],
    [-34, 34],
  ] as const;

  return satelliteCenters.map((sat, satIndex) => ({
    id: `bench-sat-${satIndex}`,
    shellId: 'bench-shell',
    altitudeKm: 780,
    ecefKm: [0, 0, 0],
    rangeKm: 820 + satIndex * 18,
    elevationDeg: sat.elevationDeg,
    azimuthDeg: sat.azimuthDeg,
    beamCellsKm: localBeamOffsets.map(([eastOffsetKm, northOffsetKm], beamIndex) => {
      const scanAngleDeg = (Math.hypot(eastOffsetKm, northOffsetKm) / 780) * (180 / Math.PI);
      return {
        beamId: satIndex * 10 + beamIndex,
        offsetEastKm: sat.eastKm + eastOffsetKm,
        offsetNorthKm: sat.northKm + northOffsetKm,
        scanAngleDeg,
      };
    }),
  }));
}

function createBenchmarkPositions(count: number): RuntimePerUeSinrPosition[] {
  const columns = 11;
  const rows = 9;
  return Array.from({ length: count }, (_value, index) => {
    if (index === 0) return emptyPosition('bench-ue-0', 0, 0);
    const secondaryIndex = index - 1;
    const column = secondaryIndex % columns;
    const row = Math.floor(secondaryIndex / columns) % rows;
    const eastKm = -100 + (200 * column) / Math.max(1, columns - 1);
    const northKm = -45 + (90 * row) / Math.max(1, rows - 1);
    return emptyPosition(`bench-ue-${index}`, eastKm, northKm);
  });
}

function runUnthrottledSecondaryBenchmark(): number {
  const profile = tunedProfile();
  const snapshots = buildBenchmarkSnapshots();
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
    simTimeSec: 0,
  } satisfies Parameters<typeof computeLinkBudget>[2];
  const perUePositions = createBenchmarkPositions(100);
  const secondaryHoManagers = Array.from(
    { length: perUePositions.length - 1 },
    () => new HandoverManager(profile.handover),
  );
  for (let frameIndex = 0; frameIndex < 5; frameIndex += 1) {
    linkBudgetOptions.simTimeSec = frameIndex / 60;
    stepSecondaryUeHandovers({
      perUePositions,
      secondaryHoManagers,
      primaryLatDeg: 25,
      primaryLonDeg: 121,
      primaryEastKm: perUePositions[0].eastKm,
      primaryNorthKm: perUePositions[0].northKm,
      snapshots,
      linkBudgetOptions,
      dtSec: 1 / 60,
      simTimeMs: Date.UTC(2026, 0, 1) + (frameIndex * 1000) / 60,
    });
  }
  const frames = 40;
  const startMs = performance.now();

  for (let frameIndex = 0; frameIndex < frames; frameIndex += 1) {
    linkBudgetOptions.simTimeSec = frameIndex / 60;
    stepSecondaryUeHandovers({
      perUePositions,
      secondaryHoManagers,
      primaryLatDeg: 25,
      primaryLonDeg: 121,
      primaryEastKm: perUePositions[0].eastKm,
      primaryNorthKm: perUePositions[0].northKm,
      snapshots,
      linkBudgetOptions,
      dtSec: 1 / 60,
      simTimeMs: Date.UTC(2026, 0, 1) + (frameIndex * 1000) / 60,
    });
  }

  return (performance.now() - startMs) / frames;
}

section('(a) production throttle helper contract', () => {
  check(SECONDARY_UE_RECOMPUTE_HZ === 12, 'SECONDARY_UE_RECOMPUTE_HZ is the v2 §4 midpoint 12 Hz');
  check(shouldRecomputeSecondary(0, false), 'cache miss forces secondary recompute');
  check(
    !shouldRecomputeSecondary((1 / SECONDARY_UE_RECOMPUTE_HZ) / 2, true),
    'valid cache below interval skips recompute',
  );
  check(
    shouldRecomputeSecondary(1 / SECONDARY_UE_RECOMPUTE_HZ, true),
    'valid cache at interval recomputes',
  );
});

section('(b) cadence decoupling through stepRuntimeFrame', () => {
  const frames = 120;
  const deltaSec = 1 / 60;
  const normal = runRuntimeCadence({ frames, deltaSec, speed: 1, ueCount: 100 });
  const slow = runRuntimeCadence({ frames, deltaSec, speed: 0.05, ueCount: 100 });
  const expectedNormal = expectedRecomputeCount(frames, deltaSec, 1);
  const expectedSlow = expectedRecomputeCount(frames, deltaSec, 0.05);
  measuredSpeedOneRecomputeCount = normal.recomputeCount;
  measuredSlowRecomputeCount = slow.recomputeCount;

  console.log(`  [INFO] recompute fires: speed=1 ${normal.recomputeCount}/${frames}, speed=0.05 ${slow.recomputeCount}/${frames}`);
  check(
    Math.abs(normal.recomputeCount - expectedNormal) <= 1,
    `speed=1 recomputes at about ${SECONDARY_UE_RECOMPUTE_HZ} Hz sim-time`,
    `actual=${normal.recomputeCount}, expected=${expectedNormal}`,
  );
  check(
    Math.abs(slow.recomputeCount - expectedSlow) <= 1,
    'speed=0.05 recomputes far less often under render-rate-equivalent frames',
    `actual=${slow.recomputeCount}, expected=${expectedSlow}`,
  );
  check(
    slow.recomputeCount < normal.recomputeCount / 6,
    'Director slow-mo cadence is decoupled from render FPS',
    `speed=1=${normal.recomputeCount}, speed=0.05=${slow.recomputeCount}`,
  );
  check(normal.cacheHoldChecks > 0, 'speed=1 run exercised skip frames');
  check(normal.cacheHoldViolations === 0, 'skip frames copy the cached secondary snapshot');
  check(normal.previousHoldViolations === 0, 'skip frames keep secondary serving identical to previous frame');
  check(slow.cacheHoldChecks > 0, 'speed=0.05 run exercised skip frames');
  check(slow.cacheHoldViolations === 0, 'slow skip frames copy the cached secondary snapshot');
});

section('(c) no recompute while accumulator stays below interval', () => {
  const run = runRuntimeCadence({
    frames: 60,
    deltaSec: 1 / 600,
    speed: 0.001,
    ueCount: 100,
  });
  check(run.recomputeCount === 1, 'sub-threshold run has zero recomputes after first cache fill');
  check(run.recomputeFlags.slice(1).every(flag => !flag), 'every post-fill frame is a skip frame');
  check(run.cacheHoldChecks === 59, 'post-fill skip frames all checked against cache');
  check(run.cacheHoldViolations === 0, 'post-fill skip frames hold the cached snapshot exactly');
});

section('(d) unthrottled 100-UE secondary microbench', () => {
  measuredUnthrottledMsPerFrame = runUnthrottledSecondaryBenchmark();
  console.log(`  [INFO] unthrottled secondary recompute: ${measuredUnthrottledMsPerFrame.toFixed(3)} ms/frame (100 UE, 99 secondary, 6 sats x 7 beams, K=40, warmup=5)`);
  check(
    measuredUnthrottledMsPerFrame < 33,
    'unthrottled secondary recompute stays under generous gross-regression ceiling',
    `${measuredUnthrottledMsPerFrame.toFixed(3)} ms/frame`,
  );
});

section('(e) useSimulation invalidates the secondary cache on distribution/mobility change', () => {
  const useSimulationSource = fs.readFileSync(
    fileURLToPath(new URL('../src/scene/useSimulation.ts', import.meta.url)),
    'utf8',
  );
  check(
    useSimulationSource.includes('secondaryServingCache = null'),
    'useSimulation invalidates the secondary serving cache somewhere',
  );
  // Staleness can only arise where UE positions are REGENERATED (a
  // `resetMobilityStates()` call), not merely where a position-affecting input
  // appears in a dep array (e.g. the publish-only refresh effect, which does
  // not move UEs). So audit exactly the position-regeneration call sites: each
  // must, within its block, either recreate the runtime state
  // (`createRuntimeFrameStepState`) or clear the secondary serving cache
  // (`secondaryServingCache = null`). Otherwise the throttle could apply stale
  // serving/SINR to the regenerated positions.
  const CALL = 'resetMobilityStates();';
  // Wide enough to span an explanatory comment between the regeneration call
  // and its cache/state reset, but far smaller than the gap between the
  // distinct call sites (each in its own function/effect, >1500 chars apart),
  // so a window cannot borrow a sibling site's invalidation.
  const PROXIMITY_CHARS = 800;
  let regenSites = 0;
  let staleSites = 0;
  let searchFrom = useSimulationSource.indexOf(CALL);
  while (searchFrom !== -1) {
    regenSites += 1;
    const window = useSimulationSource.slice(searchFrom, searchFrom + PROXIMITY_CHARS);
    const invalidates =
      window.includes('createRuntimeFrameStepState')
      || window.includes('secondaryServingCache = null');
    if (!invalidates) staleSites += 1;
    searchFrom = useSimulationSource.indexOf(CALL, searchFrom + CALL.length);
  }
  check(regenSites >= 4, 'found the position-regeneration call sites to audit', `regenSites=${regenSites}`);
  check(
    staleSites === 0,
    'every position regeneration recreates state or clears the secondary cache',
    `${staleSites} regeneration site(s) leave the secondary cache stale`,
  );
});

console.log(`\nPhase 3 CPU budget validator: ${passed} passed, ${failed} failed`);
console.log(
  `Summary: unthrottled=${measuredUnthrottledMsPerFrame.toFixed(3)} ms/frame; `
  + `speed=1 recomputes=${measuredSpeedOneRecomputeCount}; `
  + `speed=0.05 recomputes=${measuredSlowRecomputeCount}`,
);
if (failed > 0) {
  process.exitCode = 1;
}
