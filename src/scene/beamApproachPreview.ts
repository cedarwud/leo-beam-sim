import type { Profile } from '../profiles/types';
import type { MetadataBackedFrequencyIndexSource } from '../utils/beamFrequency';
import { scheduleBeamCells, type CandidateBeamCell } from './beam-scheduler';
import type { CoreLayoutFrequencyReuse } from './beam-layout';
import type { NormalizedSceneFrame } from './NormalizedSceneFrame';
import type { SceneGeometry } from './SceneGeometry';

export const APPROACH_LOOKAHEAD_SLOTS = 5;
export const APPROACH_LOOKAHEAD_DISTANCE_FACTOR = 3.2;
export const APPROACH_TARGET_DISTANCE_FACTOR = 1.18;
export const APPROACH_ENTRY_DISTANCE_FACTOR = 1.05;
export const APPROACH_RELEASE_DISTANCE_FACTOR = 1.45;
export const APPROACH_IMPROVEMENT_FOOTPRINT_RATIO = 0.14;
export const APPROACH_MIN_IMPROVEMENT_KM = 6;
export const MAX_APPROACH_SATS = 2;
export const MAX_APPROACH_PREVIEW_BEAMS = 6; // MAX_BEAMS_PER_SATELLITE - 1; caller may override

export interface BeamCellViz {
  beamId: number;
  offsetEastKm: number;
  offsetNorthKm: number;
  scanAngleDeg: number;
  reuseGroup?: number;
  reuseGroupSource?: MetadataBackedFrequencyIndexSource;
  runtimeFrequencyReuse?: number;
  coreLayoutFrequencyReuse?: CoreLayoutFrequencyReuse;
}

export interface ApproachPreview {
  primaryBeamId: number;
  previewBeamIds: number[];
  currentNearestDistanceKm: number;
  bestFutureDistanceKm: number;
  bestFutureSlotOffset: number;
}

export interface LatchedApproachState extends ApproachPreview {
  releaseAtSec: number;
}

export interface ShellVizLayout {
  footprintRadiusKm: number;
}

export interface ApproachComputationResult {
  approachSatIds: string[];
  approachSatIdSet: Set<string>;
  selectedApproachPreviewBySatId: Map<string, ApproachPreview>;
  newLatchedApproachBySat: Map<string, LatchedApproachState>;
}

export function beamDistanceToUeKm(beam: BeamCellViz): number {
  return Math.hypot(beam.offsetEastKm, beam.offsetNorthKm);
}

export function computeApproachPreviews({
  frame,
  geometry,
  beamHoppingConfig,
  bestSinrPerSat,
  approachHoldSec,
  previousLatched,
  maxPreviewBeams,
}: {
  frame: NormalizedSceneFrame;
  geometry: SceneGeometry;
  beamHoppingConfig: Profile['beamHopping'];
  bestSinrPerSat: Map<string, number>;
  approachHoldSec: number;
  previousLatched: Map<string, LatchedApproachState>;
  maxPreviewBeams: number;
}): ApproachComputationResult {
  // Approach previews require live-only beam-hopping scheduler state. Replay
  // path leaves `slotIndex`/`enabled` undefined; return empty.
  const beamHopEnabled = frame.beamHopping.enabled ?? false;
  const beamHopSlotIndex = frame.beamHopping.slotIndex ?? -1;
  const simTimeSec = frame.tSec;
  if (!beamHopEnabled || beamHopSlotIndex < 0) {
    return {
      approachSatIds: [],
      approachSatIdSet: new Set<string>(),
      selectedApproachPreviewBySatId: new Map<string, ApproachPreview>(),
      newLatchedApproachBySat: new Map<string, LatchedApproachState>(),
    };
  }

  const blockedApproachSatIds = new Set<string>(
    [
      frame.handover.servingSatelliteId || null,
      frame.handover.targetSatelliteId ?? null,
      frame.recentHo?.targetSatId ?? null,
      frame.recentHo?.sourceSatId ?? null,
    ].filter((satId): satId is string => satId !== null && satId !== ''),
  );

  // Re-group beams[] back into per-satellite BeamCellViz lists for the
  // scheduler. Beam IDs revert to numeric form (live convention).
  const steeringBeamCellsBySatId = new Map<string, BeamCellViz[]>();
  for (const beam of frame.beams) {
    if (beam.offsetEastKm === undefined || beam.offsetNorthKm === undefined) continue;
    const list = steeringBeamCellsBySatId.get(beam.satelliteId) ?? [];
    list.push({
      beamId: Number(beam.id),
      offsetEastKm: beam.offsetEastKm,
      offsetNorthKm: beam.offsetNorthKm,
      scanAngleDeg: beam.scanAngleDeg ?? 0,
      reuseGroup: beam.reuseGroup,
      reuseGroupSource: beam.reuseGroupSource,
      runtimeFrequencyReuse: beam.runtimeFrequencyReuse,
      coreLayoutFrequencyReuse: beam.coreLayoutFrequencyReuse,
    });
    steeringBeamCellsBySatId.set(beam.satelliteId, list);
  }

  const approachPreviewBySatId = new Map<string, ApproachPreview>();
  const approachCandidates = [...frame.satellites]
    .filter(sat => !blockedApproachSatIds.has(sat.id))
    .flatMap(sat => {
      const shellId = sat.shellId ?? '';
      const layout =
        geometry.shellLayouts.get(shellId)
        ?? geometry.shellLayouts.values().next().value;
      const steeringBeamCells = steeringBeamCellsBySatId.get(sat.id) ?? [];
      if (!layout || steeringBeamCells.length === 0) return [];

      const allCandidateBeamCells = steeringBeamCells
        .map(beam => ({
          beamId: beam.beamId,
          offsetEastKm: beam.offsetEastKm,
          offsetNorthKm: beam.offsetNorthKm,
          scanAngleDeg: beam.scanAngleDeg,
          reuseGroup: beam.reuseGroup,
          reuseGroupSource: beam.reuseGroupSource,
          runtimeFrequencyReuse: beam.runtimeFrequencyReuse,
          coreLayoutFrequencyReuse: beam.coreLayoutFrequencyReuse,
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
          beamHopSlotIndex + slotOffset,
          beamHoppingConfig,
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
        previousLatched.has(sat.id)
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
        .slice(0, maxPreviewBeams);

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
      releaseAtSec: simTimeSec + approachHoldSec,
    });
  }

  for (const [satId, latched] of previousLatched.entries()) {
    if (blockedApproachSatIds.has(satId)) continue;
    if (nextLatchedApproachBySat.has(satId)) continue;
    if (latched.releaseAtSec <= simTimeSec) continue;
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
  const newLatchedApproachBySat = new Map(
    approachSatIds.flatMap(satId => {
      const latched = nextLatchedApproachBySat.get(satId);
      return latched ? [[satId, latched] as const] : [];
    }),
  );

  return {
    approachSatIds,
    approachSatIdSet,
    selectedApproachPreviewBySatId,
    newLatchedApproachBySat,
  };
}
