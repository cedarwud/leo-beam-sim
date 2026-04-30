import { useMemo, useRef } from 'react';
import { MIN_VISIBLE_SINR_DB } from '../constants/sinr';
import type { Profile } from '../profiles/types';
import { scheduleBeamCells, type CandidateBeamCell } from './beam-scheduler';
import { FOOTPRINT_RADIUS_WORLD, MAX_BEAMS_PER_SATELLITE, computeBeamGeometry } from './beam-layout';
import type { PresentationMode, SimFrame, VizFrame, VisibleSat } from './types';
import { getBeamFrequencyIndex } from '../utils/beamFrequency';

const MAX_DISPLAY_SATS = 12;
const MAX_EVENT_SATS = 8;
const MAX_BEAM_SATS = 3;
const MAX_APPROACH_SATS = 2;
const MAX_APPROACH_PREVIEW_BEAMS = MAX_BEAMS_PER_SATELLITE - 1;
const CENTRAL_CORE_RADIUS_WORLD = 180;
const CENTRAL_FOCUS_RADIUS_WORLD = 500;
const MIN_CENTER_ELEVATION_DEG = 45;
const APPROACH_LOOKAHEAD_SLOTS = 5;
const APPROACH_LOOKAHEAD_DISTANCE_FACTOR = 3.2;
const APPROACH_TARGET_DISTANCE_FACTOR = 1.18;
const APPROACH_ENTRY_DISTANCE_FACTOR = 1.05;
const APPROACH_RELEASE_DISTANCE_FACTOR = 1.45;
const APPROACH_IMPROVEMENT_FOOTPRINT_RATIO = 0.14;
const APPROACH_MIN_IMPROVEMENT_KM = 6;
const MIN_APPROACH_HOLD_SEC = 4;

interface ShellVizLayout {
  footprintRadiusKm: number;
}

interface BeamCellViz {
  beamId: number;
  offsetEastKm: number;
  offsetNorthKm: number;
  scanAngleDeg: number;
}

interface ApproachPreview {
  primaryBeamId: number;
  previewBeamIds: number[];
  currentNearestDistanceKm: number;
  bestFutureDistanceKm: number;
  bestFutureSlotOffset: number;
}

interface LatchedApproachState extends ApproachPreview {
  releaseAtSec: number;
}

function beamDistanceToUeKm(beam: BeamCellViz): number {
  return Math.hypot(beam.offsetEastKm, beam.offsetNorthKm);
}

function isFiniteSinr(sinrDb: number | null | undefined): sinrDb is number {
  return sinrDb !== null && sinrDb !== undefined && Number.isFinite(sinrDb);
}

function nearestBeamCell(beamCells: BeamCellViz[]): BeamCellViz | null {
  let nearest: BeamCellViz | null = null;
  let nearestDistanceKm = Infinity;
  for (const beam of beamCells) {
    const distanceKm = beamDistanceToUeKm(beam);
    if (distanceKm < nearestDistanceKm) {
      nearest = beam;
      nearestDistanceKm = distanceKm;
    }
  }
  return nearest;
}

function scoreCentralPass(sat: VisibleSat): number {
  if (sat.topo.elevationDeg < MIN_CENTER_ELEVATION_DEG) return 0;

  const centerRadiusWorld = Math.hypot(sat.world.x, sat.world.z);
  if (centerRadiusWorld > CENTRAL_FOCUS_RADIUS_WORLD) return 0;

  const radialScore = centerRadiusWorld <= CENTRAL_CORE_RADIUS_WORLD
    ? 55
    : 55 * (
      1 - (centerRadiusWorld - CENTRAL_CORE_RADIUS_WORLD)
        / (CENTRAL_FOCUS_RADIUS_WORLD - CENTRAL_CORE_RADIUS_WORLD)
    );
  
  // Power-4 elevation score to extremely favor zenith satellites
  const elevationScore = Math.pow(sat.topo.elevationDeg / 90, 4) * 500;

  return radialScore + elevationScore;
}

function centralBiasWeight(mode: PresentationMode): number {
  switch (mode) {
    case 'research-default':
      return 0.5;
    case 'candidate-rich':
      return 2.0;
    case 'demo-readability':
      return 3.5;
  }
}

function primaryBeamIdForSat(
  satId: string,
  sim: SimFrame,
  displayAssignmentsBySatId: Map<string, Set<number>>,
  beamCellsBySatId: Map<string, BeamCellViz[]>,
): number | null {
  if (satId === sim.serving.satId) return sim.serving.beamId;
  if (satId === sim.pendingTargetSatId) return sim.pendingTargetBeamId;
  if (satId === sim.recentHoSourceSatId) return sim.recentHoSourceBeamId;
  if (satId === sim.recentHoTargetSatId) return sim.recentHoTargetBeamId;
  const displayBeamIds = displayAssignmentsBySatId.get(satId);
  if (displayBeamIds && displayBeamIds.size > 0) return [...displayBeamIds][0] ?? null;
  const nearestBeam = nearestBeamCell(beamCellsBySatId.get(satId) ?? []);
  return nearestBeam?.beamId ?? null;
}

function isTransitioningSourceSat(satId: string, sim: SimFrame): boolean {
  return satId === sim.serving.satId
    && sim.pendingTargetSatId !== null
    && sim.pendingTargetSatId !== sim.serving.satId;
}

function isPreparedTransitionSat(satId: string, sim: SimFrame): boolean {
  return satId === sim.pendingTargetSatId && sim.pendingTargetSatId !== sim.serving.satId;
}

function isRecentHoSourceSat(satId: string, sim: SimFrame): boolean {
  return satId === sim.recentHoSourceSatId && satId !== sim.serving.satId;
}

export function useBeamViz(
  sim: SimFrame,
  profile: Profile,
  mode: PresentationMode,
  latchedBeamSinrByKey?: Map<string, number>,
): VizFrame {
  const previousDisplayIdsRef = useRef<Set<string>>(new Set());
  const previousEventIdsRef = useRef<Set<string>>(new Set());
  const latchedApproachBySatRef = useRef<Map<string, LatchedApproachState>>(new Map());

  return useMemo(() => {
    const centralBias = centralBiasWeight(mode);
    const approachHoldSec = Math.max(
      MIN_APPROACH_HOLD_SEC,
      (sim.beamHopSlotSec > 0 ? sim.beamHopSlotSec : MIN_APPROACH_HOLD_SEC) * 1.5,
    );
    const shellLayouts = new Map<string, ShellVizLayout>(
      profile.orbit.shells.map(shell => {
        const geometry = computeBeamGeometry(shell.altitudeKm, profile.antenna.beamwidth3dBRad);
        return [
          shell.id,
          {
            footprintRadiusKm: geometry.footprintRadiusKm,
          },
        ];
      }),
    );

    const bestSinrPerSat = new Map<string, number>();
    for (const sample of sim.linkSamples) {
      const currentBest = bestSinrPerSat.get(sample.satId) ?? -Infinity;
      if (sample.sinrDb > currentBest) bestSinrPerSat.set(sample.satId, sample.sinrDb);
    }

    const steeringBeamCellsBySatId = new Map<string, BeamCellViz[]>(
      [...sim.steeringBeamCellsBySatId.entries()].map(([satId, beamCells]) => [
        satId,
        beamCells.map(beam => ({
          beamId: beam.beamId,
          offsetEastKm: beam.offsetEastKm,
          offsetNorthKm: beam.offsetNorthKm,
          scanAngleDeg: beam.scanAngleDeg,
        })),
      ]),
    );
    const labelSinrForSat = (satId: string): number | null => {
      if (satId === sim.recentHoSourceSatId && sim.recentHoSourceSinrDb !== null) {
        return sim.recentHoSourceSinrDb;
      }
      if (satId === sim.recentHoTargetSatId && sim.recentHoTargetSinrDb !== null) {
        return sim.recentHoTargetSinrDb;
      }
      if (satId === sim.pendingTargetSatId && sim.pendingTargetSinrDb !== null) {
        return sim.pendingTargetSinrDb;
      }
      if (satId === sim.serving.satId && Number.isFinite(sim.serving.sinrDb) && sim.serving.sinrDb > MIN_VISIBLE_SINR_DB) {
        return sim.serving.sinrDb;
      }
      const fallback = bestSinrPerSat.get(satId);
      return fallback !== undefined && Number.isFinite(fallback) ? fallback : null;
    };

    const labelSinrForBeam = (
      satId: string,
      beamId: number,
      sampleSinrDb: number | null | undefined,
    ): number | null => {
      if (
        satId === sim.serving.satId
        && beamId === sim.serving.beamId
        && isFiniteSinr(sim.serving.sinrDb)
      ) {
        return sim.serving.sinrDb;
      }
      if (
        satId === sim.pendingTargetSatId
        && beamId === sim.pendingTargetBeamId
        && isFiniteSinr(sim.pendingTargetSinrDb)
      ) {
        return sim.pendingTargetSinrDb;
      }
      if (
        satId === sim.recentHoSourceSatId
        && beamId === sim.recentHoSourceBeamId
        && isFiniteSinr(sim.recentHoSourceSinrDb)
      ) {
        return sim.recentHoSourceSinrDb;
      }
      if (
        satId === sim.recentHoTargetSatId
        && beamId === sim.recentHoTargetBeamId
        && isFiniteSinr(sim.recentHoTargetSinrDb)
      ) {
        return sim.recentHoTargetSinrDb;
      }
      if (isFiniteSinr(sampleSinrDb)) {
        return sampleSinrDb;
      }
      const latchedSinrDb = latchedBeamSinrByKey?.get(`${satId}:${beamId}`);
      if (isFiniteSinr(latchedSinrDb)) {
        return latchedSinrDb;
      }
      return null;
    };

    const blockedApproachSatIds = new Set<string>([
      sim.serving.satId,
      sim.pendingTargetSatId,
      sim.recentHoTargetSatId,
      sim.recentHoSourceSatId,
    ].filter((satId): satId is string => satId !== null));
    const approachPreviewBySatId = new Map<string, ApproachPreview>();
    const approachCandidates = [...sim.satellites]
      .filter(sat => !blockedApproachSatIds.has(sat.id))
      .flatMap(sat => {
        const layout = shellLayouts.get(sat.shellId);
        const steeringBeamCells = steeringBeamCellsBySatId.get(sat.id) ?? [];
        if (!layout || steeringBeamCells.length === 0 || !sim.beamHopEnabled || sim.beamHopSlotIndex < 0) return [];

        const allCandidateBeamCells = steeringBeamCells
          .map(beam => ({
            beamId: beam.beamId,
            offsetEastKm: beam.offsetEastKm,
            offsetNorthKm: beam.offsetNorthKm,
            scanAngleDeg: beam.scanAngleDeg,
            distanceToUeKm: beamDistanceToUeKm(beam),
          } satisfies CandidateBeamCell))
          .sort((a, b) => a.distanceToUeKm - b.distanceToUeKm || a.beamId - b.beamId);
        const currentNearestDistanceKm = allCandidateBeamCells[0]?.distanceToUeKm;
        if (currentNearestDistanceKm === undefined) return [];

        const lookaheadBeamCells = allCandidateBeamCells
          .filter(beam => beam.distanceToUeKm <= layout.footprintRadiusKm * APPROACH_LOOKAHEAD_DISTANCE_FACTOR);
        if (lookaheadBeamCells.length === 0) return [];

        const beamCellById = new Map(lookaheadBeamCells.map(beam => [beam.beamId, beam]));
        const earliestSlotOffsetByBeamId = new Map<number, number>();
        let bestFutureBeamId: number | null = null;
        let bestFutureDistanceKm = Infinity;
        let bestFutureSlotOffset = Infinity;

        for (let slotOffset = 0; slotOffset < APPROACH_LOOKAHEAD_SLOTS; slotOffset += 1) {
          const scheduled = scheduleBeamCells(
            lookaheadBeamCells,
            [],
            sat.id,
            sim.beamHopSlotIndex + slotOffset,
            profile.beamHopping,
            { minimumActiveBeamCount: 1 },
          );
          for (const beamId of scheduled.activeBeamIds) {
            if (!earliestSlotOffsetByBeamId.has(beamId)) {
              earliestSlotOffsetByBeamId.set(beamId, slotOffset);
            }
            const beamCell = beamCellById.get(beamId);
            if (!beamCell) continue;
            if (
              beamCell.distanceToUeKm < bestFutureDistanceKm
              || (
                Math.abs(beamCell.distanceToUeKm - bestFutureDistanceKm) <= 1e-6
                && slotOffset < bestFutureSlotOffset
              )
            ) {
              bestFutureBeamId = beamId;
              bestFutureDistanceKm = beamCell.distanceToUeKm;
              bestFutureSlotOffset = slotOffset;
            }
          }
        }

        if (bestFutureBeamId === null) return [];

        const minimumImprovementKm = Math.max(
          layout.footprintRadiusKm * APPROACH_IMPROVEMENT_FOOTPRINT_RATIO,
          APPROACH_MIN_IMPROVEMENT_KM,
        );
        const futureReachesApproachGate = bestFutureDistanceKm <= layout.footprintRadiusKm * APPROACH_TARGET_DISTANCE_FACTOR;
        const stillOutsideUe = currentNearestDistanceKm > layout.footprintRadiusKm * APPROACH_ENTRY_DISTANCE_FACTOR;
        const meaningfulImprovement = currentNearestDistanceKm - bestFutureDistanceKm >= minimumImprovementKm;
        const keepTrackedApproach =
          latchedApproachBySatRef.current.has(sat.id)
          && bestFutureDistanceKm <= layout.footprintRadiusKm * APPROACH_RELEASE_DISTANCE_FACTOR;
        if ((!futureReachesApproachGate || !stillOutsideUe || !meaningfulImprovement) && !keepTrackedApproach) return [];

        const previewBeamIds = [...earliestSlotOffsetByBeamId.keys()]
          .sort((beamIdA, beamIdB) => {
            const slotOffsetA = earliestSlotOffsetByBeamId.get(beamIdA) ?? Infinity;
            const slotOffsetB = earliestSlotOffsetByBeamId.get(beamIdB) ?? Infinity;
            const distanceA = beamCellById.get(beamIdA)?.distanceToUeKm ?? Infinity;
            const distanceB = beamCellById.get(beamIdB)?.distanceToUeKm ?? Infinity;
            return slotOffsetA - slotOffsetB || distanceA - distanceB || beamIdA - beamIdB;
          })
          .slice(0, MAX_APPROACH_PREVIEW_BEAMS);

        approachPreviewBySatId.set(sat.id, {
          primaryBeamId: bestFutureBeamId,
          previewBeamIds,
          currentNearestDistanceKm,
          bestFutureDistanceKm,
          bestFutureSlotOffset,
        });

        return [{
          satId: sat.id,
          currentNearestDistanceKm,
          bestFutureDistanceKm,
          bestFutureSlotOffset,
          bestSinrDb: bestSinrPerSat.get(sat.id) ?? -Infinity,
        }];
      })
      .sort((a, b) =>
        a.bestFutureDistanceKm - b.bestFutureDistanceKm
        || a.bestFutureSlotOffset - b.bestFutureSlotOffset
        || a.currentNearestDistanceKm - b.currentNearestDistanceKm
        || b.bestSinrDb - a.bestSinrDb
        || a.satId.localeCompare(b.satId))
      .slice(0, MAX_APPROACH_SATS * 2);
    const nextLatchedApproachBySat = new Map<string, LatchedApproachState>();
    for (const candidate of approachCandidates) {
      const preview = approachPreviewBySatId.get(candidate.satId);
      if (!preview) continue;
      nextLatchedApproachBySat.set(candidate.satId, {
        ...preview,
        releaseAtSec: sim.simTimeSec + approachHoldSec,
      });
    }

    for (const [satId, latched] of latchedApproachBySatRef.current.entries()) {
      if (blockedApproachSatIds.has(satId)) continue;
      if (nextLatchedApproachBySat.has(satId)) continue;
      if (latched.releaseAtSec <= sim.simTimeSec) continue;
      if (!steeringBeamCellsBySatId.has(satId)) continue;
      nextLatchedApproachBySat.set(satId, latched);
    }

    const lockedApproachIds = [...nextLatchedApproachBySat.entries()]
      .sort((a, b) =>
        b[1].releaseAtSec - a[1].releaseAtSec
        || a[1].bestFutureSlotOffset - b[1].bestFutureSlotOffset
        || a[1].bestFutureDistanceKm - b[1].bestFutureDistanceKm
        || a[0].localeCompare(b[0]))
      .map(([satId]) => satId);
    const approachSatIds = [...new Set([
      ...lockedApproachIds,
      ...approachCandidates.map(candidate => candidate.satId),
    ])].slice(0, MAX_APPROACH_SATS);
    const approachSatIdSet = new Set(approachSatIds);
    const selectedApproachPreviewBySatId = new Map<string, ApproachPreview>();
    for (const satId of approachSatIds) {
      const preview = approachPreviewBySatId.get(satId) ?? nextLatchedApproachBySat.get(satId);
      if (!preview) continue;
      selectedApproachPreviewBySatId.set(satId, preview);
    }
    latchedApproachBySatRef.current = new Map(
      approachSatIds.flatMap(satId => {
        const latched = nextLatchedApproachBySat.get(satId);
        return latched ? [[satId, latched] as const] : [];
      }),
    );
    const prioritySatIds = [...new Set([
      sim.serving.satId,
      sim.pendingTargetSatId,
      sim.recentHoTargetSatId,
      sim.recentHoSourceSatId,
      ...approachSatIds,
    ].filter((satId): satId is string => satId !== null))];

    const displaySats = [...sim.satellites].sort((a, b) => {
      const priorityA = a.id === sim.pendingTargetSatId || a.id === sim.recentHoTargetSatId
        ? 45
        : approachSatIdSet.has(a.id)
          ? 34
        : a.id === sim.recentHoSourceSatId
          ? 38
          : 0;
      const priorityB = b.id === sim.pendingTargetSatId || b.id === sim.recentHoTargetSatId
        ? 45
        : approachSatIdSet.has(b.id)
          ? 34
        : b.id === sim.recentHoSourceSatId
          ? 38
          : 0;
      const prevA = previousDisplayIdsRef.current.has(a.id) ? 15 : 0;
      const prevB = previousDisplayIdsRef.current.has(b.id) ? 15 : 0;
      const centerA = scoreCentralPass(a) * centralBias;
      const centerB = scoreCentralPass(b) * centralBias;
      const servingA = a.id === sim.serving.satId ? 10000 : 0;
      const servingB = b.id === sim.serving.satId ? 10000 : 0;
      
      // Heavy edge penalty for satellites below 35 degrees
      const edgePenaltyA = a.topo.elevationDeg < 35 ? -500 : 0;
      const edgePenaltyB = b.topo.elevationDeg < 35 ? -500 : 0;

      const scoreA = a.topo.elevationDeg + prevA + centerA + servingA + priorityA + edgePenaltyA;
      const scoreB = b.topo.elevationDeg + prevB + centerB + servingB + priorityB + edgePenaltyB;
      return scoreB - scoreA || a.id.localeCompare(b.id);
    });

    const shownSats = displaySats.slice(0, MAX_DISPLAY_SATS);
    const requiredSatIds = new Set(prioritySatIds);
    for (const requiredSatId of prioritySatIds) {
      if (shownSats.some(sat => sat.id === requiredSatId)) continue;
      const requiredSat = sim.satellites.find(sat => sat.id === requiredSatId);
      if (!requiredSat) continue;

      if (shownSats.length < MAX_DISPLAY_SATS) {
        shownSats.push(requiredSat);
      } else {
        const replaceIndex = shownSats.findIndex(sat => !requiredSatIds.has(sat.id));
        shownSats[replaceIndex >= 0 ? replaceIndex : shownSats.length - 1] = requiredSat;
      }
    }

    const eventRoles = new Map<string, VizFrame['eventRoles'] extends Map<string, infer T> ? T : never>();
    if (sim.serving.satId) {
      eventRoles.set(
        sim.serving.satId,
        sim.recentHoTargetSatId === sim.serving.satId ? 'post-ho' : 'serving',
      );
    }
    if (sim.pendingTargetSatId && sim.pendingTargetSatId !== sim.serving.satId) {
      eventRoles.set(sim.pendingTargetSatId, 'prepared');
    }
    if (
      sim.recentHoSourceSatId &&
      sim.recentHoSourceSatId !== sim.serving.satId &&
      sim.recentHoSourceSatId !== sim.pendingTargetSatId
    ) {
      eventRoles.set(sim.recentHoSourceSatId, 'secondary');
    }
    for (const satId of approachSatIds) {
      if (!eventRoles.has(satId)) eventRoles.set(satId, 'approach');
    }

    const eventSatIds = new Set<string>(eventRoles.keys());
    const rankedCandidates = [...shownSats]
      .filter(sat => !eventSatIds.has(sat.id))
      .sort((a, b) => {
        const prevA = previousEventIdsRef.current.has(a.id) ? 8 : 0;
        const prevB = previousEventIdsRef.current.has(b.id) ? 8 : 0;
        const sinrA = bestSinrPerSat.get(a.id) ?? -Infinity;
        const sinrB = bestSinrPerSat.get(b.id) ?? -Infinity;
        const centerA = scoreCentralPass(a) * (centralBias + 0.35);
        const centerB = scoreCentralPass(b) * (centralBias + 0.35);
        return (sinrB + prevB + centerB) - (sinrA + prevA + centerA) || a.id.localeCompare(b.id);
      });

    for (const sat of rankedCandidates) {
      if (eventSatIds.size >= MAX_EVENT_SATS) break;
      eventSatIds.add(sat.id);
    }

    const displayAssignmentsBySatId = new Map<string, Set<number>>();
    for (const assignment of sim.displayAssignments) {
      const satAssignments = displayAssignmentsBySatId.get(assignment.satId) ?? new Set<number>();
      satAssignments.add(assignment.beamId);
      displayAssignmentsBySatId.set(assignment.satId, satAssignments);
    }

    const shownSatIds = new Set(shownSats.map(sat => sat.id));
    const beamSatIdOrder = [
      sim.serving.satId,
      sim.pendingTargetSatId,
      sim.recentHoTargetSatId,
      sim.recentHoSourceSatId,
      ...approachSatIds,
      ...rankedCandidates.map(sat => sat.id),
    ].filter((satId): satId is string => satId !== null);
    const beamSatIds = new Set<string>();
    for (const satId of beamSatIdOrder) {
      if (!shownSatIds.has(satId)) continue;
      beamSatIds.add(satId);
      if (beamSatIds.size >= MAX_BEAM_SATS) break;
    }
    if (beamSatIds.size === 0 && sim.serving.satId) beamSatIds.add(sim.serving.satId);

    const satBeams = new Map<string, VizFrame['satBeams'] extends Map<string, infer T> ? T : never>();
    for (const sat of shownSats) {
      if (!beamSatIds.has(sat.id)) continue;

      const layout = shellLayouts.get(sat.shellId);
      if (!layout) continue;

      const scale = FOOTPRINT_RADIUS_WORLD / Math.max(layout.footprintRadiusKm, 1e-6);
      const approachPreview = selectedApproachPreviewBySatId.get(sat.id);
      const primaryBeamId = approachPreview?.primaryBeamId ?? primaryBeamIdForSat(
        sat.id,
        sim,
        displayAssignmentsBySatId,
        steeringBeamCellsBySatId,
      );
      if (primaryBeamId === null) continue;

      const beamCells = new Map((steeringBeamCellsBySatId.get(sat.id) ?? []).map(beam => [beam.beamId, beam]));
      const role = eventRoles.get(sat.id);
      const primaryBeamCell = primaryBeamId !== null ? beamCells.get(primaryBeamId) : undefined;
      const anchorToUe =
        sat.id === sim.serving.satId
        || isPreparedTransitionSat(sat.id, sim)
        || isRecentHoSourceSat(sat.id, sim)
        || sat.id === sim.recentHoTargetSatId;
      if (!anchorToUe && !primaryBeamCell) continue;
      const anchorOffsetEastKm = anchorToUe ? (primaryBeamCell?.offsetEastKm ?? 0) : 0;
      const anchorOffsetNorthKm = anchorToUe ? (primaryBeamCell?.offsetNorthKm ?? 0) : 0;

      const sampleByBeamId = new Map(
        sim.linkSamples
          .filter(entry => entry.satId === sat.id)
          .map(entry => [entry.beamId, entry]),
      );
      const scheduledActiveBeamIds = sim.beamHopStatesBySatId.get(sat.id)?.activeBeamIds ?? [];
      const chosenBeamIds = role === 'approach'
        ? [...new Set([primaryBeamId, ...(approachPreview?.previewBeamIds ?? []), ...scheduledActiveBeamIds])]
        : [...new Set([primaryBeamId, ...scheduledActiveBeamIds])];
      const cappedBeamIds = chosenBeamIds
        .slice(0, MAX_BEAMS_PER_SATELLITE)
        .sort((a, b) => a - b);

      satBeams.set(
        sat.id,
        cappedBeamIds.flatMap(beamId => {
          const beamCell = beamCells.get(beamId) as BeamCellViz | undefined;
          const sample = sampleByBeamId.get(beamId);
          const isPrimary = beamId === primaryBeamId;
          if (!isPrimary && !beamCell) return [];

          const isScheduledActive = scheduledActiveBeamIds.includes(beamId);
          // Anchor the whole beam set to the primary beam for event-focused sats so
          // common-mode steering translation does not read as sideways "sliding".
          const beamOffsetEastKm = beamCell?.offsetEastKm ?? anchorOffsetEastKm;
          const beamOffsetNorthKm = beamCell?.offsetNorthKm ?? anchorOffsetNorthKm;
          const groundX = (beamOffsetEastKm - anchorOffsetEastKm) * scale;
          const groundZ = -(beamOffsetNorthKm - anchorOffsetNorthKm) * scale;

          return [{
            beamId,
            groundX,
            groundZ,
            isServing: sat.id === sim.serving.satId && beamId === sim.serving.beamId,
            isScheduledActive,
            isPrimary,
            showBeam: true,
            role,
            frequencyIndex: getBeamFrequencyIndex(beamId, profile.beams.frequencyReuse),
            isTransitioningSource: isTransitioningSourceSat(sat.id, sim),
            sinrDb: labelSinrForBeam(sat.id, beamId, sample?.sinrDb ?? null),
          }];
        }),
      );
    }

    const sinrLabels = [...beamSatIds]
      .map(satId => {
        const sat = shownSats.find(entry => entry.id === satId);
        const sinrDb = labelSinrForSat(satId);
        if (!sat || sinrDb === null) return null;
        return {
          position: sat.world,
          sinrDb,
          isServing: satId === sim.serving.satId,
        };
      })
      .filter((label): label is NonNullable<typeof label> => label !== null);

    previousDisplayIdsRef.current = new Set(shownSats.map(sat => sat.id));
    previousEventIdsRef.current = new Set(eventSatIds);

    return {
      displaySats: shownSats,
      eventSatIds,
      eventRoles,
      beamSatIds,
      satBeams,
      sinrLabels,
      footprintRadiusWorld: FOOTPRINT_RADIUS_WORLD,
    };
  }, [latchedBeamSinrByKey, mode, profile, sim]);
}
