import assert from 'node:assert/strict';
import {
  computeTopocentricPoint,
  createObserverContext,
  generateWalkerConstellation,
  propagateOrbitElement,
} from '../src/engine/orbit/index.ts';
import { HandoverManager } from '../src/engine/handover/handover-manager.ts';
import type { ServingState } from '../src/engine/handover/types.ts';
import { computeLinkBudget } from '../src/engine/signal/link-budget.ts';
import { loadProfile } from '../src/profiles/index.ts';
import { computeBeamGeometry, generateBeamOffsetsKm } from '../src/scene/beam-layout.ts';
import { scheduleBeamCells, type CandidateBeamCell } from '../src/scene/beam-scheduler.ts';

const PROFILE_ID = 'hobs-2024-candidate-rich';
const EPOCH_UTC_MS = Date.UTC(2026, 0, 1, 0, 0, 0);
const MIN_ELEVATION_DEG = 15;
const START_SEC = 450;
const END_SEC = 750;
const STEP_SEC = 1;
const MAX_STEERING_EXTRA_RINGS = 3;
const profile = loadProfile(PROFILE_ID);
const observer = createObserverContext(profile.orbit.observerLatDeg, profile.orbit.observerLonDeg);
const elements = generateWalkerConstellation({ shells: profile.orbit.shells, epochUtcMs: EPOCH_UTC_MS });

interface ShellBeamLayout {
  footprintRadiusKm: number;
  maxOffsetRadiusKm: number;
  maxSteeringDistanceKm: number;
  maxCoverageRadiusKm: number;
  offsets: ReturnType<typeof generateBeamOffsetsKm>;
}

interface VisibleSat {
  id: string;
  shellId: string;
  altitudeKm: number;
  latDeg: number;
  lonDeg: number;
  topo: ReturnType<typeof computeTopocentricPoint>;
}

function resolveLatticeSteering(
  nadirEastKm: number,
  nadirNorthKm: number,
  layout: ShellBeamLayout,
): { steeringEastKm: number; steeringNorthKm: number } {
  let bestTargetEastKm = -nadirEastKm;
  let bestTargetNorthKm = -nadirNorthKm;
  let bestTargetDistanceKm = Math.hypot(bestTargetEastKm, bestTargetNorthKm);

  for (const beam of layout.offsets) {
    const targetEastKm = -(nadirEastKm + beam.dEastKm);
    const targetNorthKm = -(nadirNorthKm + beam.dNorthKm);
    const targetDistanceKm = Math.hypot(targetEastKm, targetNorthKm);
    if (targetDistanceKm < bestTargetDistanceKm) {
      bestTargetEastKm = targetEastKm;
      bestTargetNorthKm = targetNorthKm;
      bestTargetDistanceKm = targetDistanceKm;
    }
  }

  if (bestTargetDistanceKm <= 1e-6) {
    return { steeringEastKm: 0, steeringNorthKm: 0 };
  }

  const steeringScale = Math.min(layout.maxSteeringDistanceKm, bestTargetDistanceKm) / bestTargetDistanceKm;
  return {
    steeringEastKm: bestTargetEastKm * steeringScale,
    steeringNorthKm: bestTargetNorthKm * steeringScale,
  };
}

function createBeamLayoutsByShellId() {
  return new Map(
    profile.orbit.shells.map(shell => {
      const geometry = computeBeamGeometry(shell.altitudeKm, profile.antenna.beamwidth3dBRad);
      const offsets = generateBeamOffsetsKm(geometry.spacingKm, profile.beams.perSatellite);
      const maxOffsetRadiusKm = offsets.reduce(
        (maxRadius, beam) => Math.max(maxRadius, Math.hypot(beam.dEastKm, beam.dNorthKm)),
        0,
      );
      const steeringAngleRad = (profile.antenna.maxSteeringAngleDeg * Math.PI) / 180;
      const angleLimitedSteeringKm = shell.altitudeKm * Math.tan(steeringAngleRad);
      const geometryLimitedSteeringKm = maxOffsetRadiusKm + geometry.spacingKm * MAX_STEERING_EXTRA_RINGS;
      const maxSteeringDistanceKm = Math.min(geometryLimitedSteeringKm, angleLimitedSteeringKm);
      return [shell.id, {
        footprintRadiusKm: geometry.footprintRadiusKm,
        maxOffsetRadiusKm,
        maxSteeringDistanceKm,
        maxCoverageRadiusKm: maxOffsetRadiusKm + maxSteeringDistanceKm + geometry.footprintRadiusKm,
        offsets,
      } satisfies ShellBeamLayout];
    }),
  );
}

const beamLayoutsByShellId = createBeamLayoutsByShellId();

function createVisibleSats(simTimeSec: number): VisibleSat[] {
  return elements.flatMap(element => {
    const orbit = propagateOrbitElement(element, EPOCH_UTC_MS + simTimeSec * 1000);
    const topo = computeTopocentricPoint(observer, orbit.ecefKm);
    if (topo.elevationDeg < MIN_ELEVATION_DEG) return [];
    return [{
      id: element.id,
      shellId: element.shellId,
      altitudeKm: orbit.altKm,
      latDeg: orbit.latDeg,
      lonDeg: orbit.lonDeg,
      topo,
    } satisfies VisibleSat];
  });
}

function buildLinkContext(
  visibleSats: VisibleSat[],
  state: Pick<ServingState, 'satId' | 'beamId' | 'pendingTarget'>,
  simTimeSec: number,
  slotIndex: number,
) {
  const cosObsLat = Math.cos(observer.latRad);
  const snapshots = [];
  const beamHopStatesBySatId = new Map<string, {
    activeBeamIds: number[];
    candidateBeamIds: number[];
    steeringValidBeamCount: number;
  }>();

  for (const sat of visibleSats) {
    const layout = beamLayoutsByShellId.get(sat.shellId);
    if (!layout) continue;

    const nadirEastKm = (sat.lonDeg - observer.lonDeg) * 111.32 * cosObsLat;
    const nadirNorthKm = (sat.latDeg - observer.latDeg) * 111.32;
    const nadirDistanceKm = Math.hypot(nadirEastKm, nadirNorthKm);
    const { steeringEastKm, steeringNorthKm } = resolveLatticeSteering(nadirEastKm, nadirNorthKm, layout);

    const requiredBeamIds = new Set<number>();
    if (state.satId === sat.id && state.beamId !== null) {
      requiredBeamIds.add(state.beamId);
    }
    if (state.pendingTarget?.satId === sat.id) {
      requiredBeamIds.add(state.pendingTarget.beamId);
    }

    const allBeamCells = layout.offsets
      .map(beam => {
        const scanOffsetEastKm = steeringEastKm + beam.dEastKm;
        const scanOffsetNorthKm = steeringNorthKm + beam.dNorthKm;
        const scanDistanceKm = Math.hypot(scanOffsetEastKm, scanOffsetNorthKm);
        const offsetEastKm = nadirEastKm + steeringEastKm + beam.dEastKm;
        const offsetNorthKm = nadirNorthKm + steeringNorthKm + beam.dNorthKm;
        return {
          beamId: beam.beamId,
          offsetEastKm,
          offsetNorthKm,
          scanAngleDeg: (Math.atan(scanDistanceKm / Math.max(sat.altitudeKm, 1e-6)) * 180) / Math.PI,
          distanceToUeKm: Math.hypot(offsetEastKm, offsetNorthKm),
        } satisfies CandidateBeamCell;
      })
      .filter(beam => beam.scanAngleDeg <= profile.antenna.maxSteeringAngleDeg + 1e-6);
    const beamCellById = new Map(allBeamCells.map(beam => [beam.beamId, beam]));
    const candidateBeamCells = allBeamCells
      .filter(beam => beam.distanceToUeKm <= layout.maxOffsetRadiusKm + layout.footprintRadiusKm * 1.5)
      .sort((a, b) => a.distanceToUeKm - b.distanceToUeKm);
    const requiredBeamCells = [...requiredBeamIds]
      .map(beamId => beamCellById.get(beamId))
      .filter((beam): beam is CandidateBeamCell => beam !== undefined);

    if (nadirDistanceKm > layout.maxCoverageRadiusKm && requiredBeamIds.size === 0) {
      continue;
    }

    const isProtectedBeamSat = state.satId === sat.id || state.pendingTarget?.satId === sat.id;
    const protectedMinimumActiveBeamCount = isProtectedBeamSat
      ? profile.beamHopping.maxActiveBeamsPerSlot
      : 1;
    const scheduled = scheduleBeamCells(
      candidateBeamCells,
      requiredBeamCells,
      sat.id,
      slotIndex,
      profile.beamHopping,
      {
        minimumActiveBeamCount: protectedMinimumActiveBeamCount,
        fallbackBeamCells: allBeamCells,
      },
    );
    if (scheduled.activeBeamCells.length === 0) continue;

    beamHopStatesBySatId.set(sat.id, {
      activeBeamIds: scheduled.activeBeamIds,
      candidateBeamIds: scheduled.candidateBeamIds,
      steeringValidBeamCount: allBeamCells.length,
    });
    snapshots.push({
      id: sat.id,
      shellId: sat.shellId,
      altitudeKm: sat.altitudeKm,
      ecefKm: [0, 0, 0] as [number, number, number],
      rangeKm: sat.topo.rangeKm,
      elevationDeg: sat.topo.elevationDeg,
      azimuthDeg: sat.topo.azimuthDeg,
      beamCellsKm: scheduled.activeBeamCells,
    });
  }

  const activeAssignments = snapshots.flatMap(sat =>
    sat.beamCellsKm.map(beam => ({ satId: sat.id, beamId: beam.beamId })),
  );
  const linkSamples = computeLinkBudget({
    latDeg: observer.latDeg,
    lonDeg: observer.lonDeg,
    offsetEastKm: 0,
    offsetNorthKm: 0,
  }, snapshots, {
    formulaFamily: profile.formulaFamily,
    channel: profile.channel,
    antenna: profile.antenna,
    beams: profile.beams,
    activeAssignments,
    simTimeSec,
  });

  return { linkSamples, beamHopStatesBySatId };
}

function run(): void {
  assert.equal(profile.beamHopping.enabled, true);

  const hoManager = new HandoverManager(profile.handover);
  let protectedFallbackFrames = 0;

  for (let simTimeSec = START_SEC; simTimeSec <= END_SEC; simTimeSec += STEP_SEC) {
    const visibleSats = createVisibleSats(simTimeSec);
    if (hoManager.state.satId && !visibleSats.some(sat => sat.id === hoManager.state.satId)) {
      hoManager.clearServing();
    }

    const slotIndex = Math.floor(simTimeSec / Math.max(profile.beamHopping.slotSec, 1e-6));
    const preDecision = buildLinkContext(visibleSats, hoManager.state, simTimeSec, slotIndex);
    hoManager.update(preDecision.linkSamples, STEP_SEC, EPOCH_UTC_MS + simTimeSec * 1000);
    const postDecision = buildLinkContext(visibleSats, hoManager.state, simTimeSec, slotIndex);

    const assertProtectedSat = (label: 'serving' | 'pending', satId: string | null) => {
      if (!satId) return;
      const beamHopState = postDecision.beamHopStatesBySatId.get(satId);
      assert.ok(beamHopState, `${label} sat ${satId} should remain schedulable at ${simTimeSec}s`);
      const expectedActiveBeamCount = Math.min(
        profile.beamHopping.maxActiveBeamsPerSlot,
        beamHopState.steeringValidBeamCount,
      );
      if (beamHopState.activeBeamIds.length < expectedActiveBeamCount) {
        throw new assert.AssertionError({
          message: `${label} sat ${satId} collapsed to ${beamHopState.activeBeamIds.length} beam(s) at ${simTimeSec}s`,
          actual: {
            simTimeSec,
            label,
            satId,
            servingSatId: hoManager.state.satId,
            servingBeamId: hoManager.state.beamId,
            pendingTarget: hoManager.state.pendingTarget,
            activeBeamIds: beamHopState.activeBeamIds,
            candidateBeamIds: beamHopState.candidateBeamIds,
            steeringValidBeamCount: beamHopState.steeringValidBeamCount,
            expectedActiveBeamCount,
          },
          expected: { minimumActiveBeamCount: expectedActiveBeamCount },
          operator: '>=',
        });
      }
      if (beamHopState.candidateBeamIds.length < expectedActiveBeamCount) {
        protectedFallbackFrames += 1;
      }
    };

    assertProtectedSat('serving', hoManager.state.satId);
    assertProtectedSat('pending', hoManager.state.pendingTarget?.satId ?? null);
  }

  assert.ok(protectedFallbackFrames > 0, 'expected to exercise at least one protected fallback frame');
  console.log('Serving/pending beam floor validation passed.');
  console.log(JSON.stringify({
    profileId: profile.id,
    windowSec: [START_SEC, END_SEC],
    stepSec: STEP_SEC,
    protectedFallbackFrames,
  }, null, 2));
}

run();
