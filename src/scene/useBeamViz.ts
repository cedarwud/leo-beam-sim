import { useMemo, useRef } from 'react';
import { MIN_VISIBLE_SINR_DB } from '../constants/sinr';
import type { Profile } from '../profiles/types';
import { FOOTPRINT_RADIUS_WORLD, computeBeamGeometry } from './beam-layout';
import type { PresentationMode, SimFrame, VizFrame, VisibleSat } from './types';

const MAX_DISPLAY_SATS = 12;
const MAX_EVENT_SATS = 8;
const CENTRAL_CORE_RADIUS_WORLD = 180;
const CENTRAL_FOCUS_RADIUS_WORLD = 500;
const MIN_CENTER_ELEVATION_DEG = 45;

interface ShellVizLayout {
  footprintRadiusKm: number;
}

interface BeamCellViz {
  beamId: number;
  offsetEastKm: number;
  offsetNorthKm: number;
  scanAngleDeg: number;
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
  activeAssignmentsBySatId: Map<string, Set<number>>,
): number | null {
  if (satId === sim.serving.satId) return sim.serving.beamId;
  if (satId === sim.pendingTargetSatId) return sim.pendingTargetBeamId;
  if (satId === sim.recentHoSourceSatId) return sim.recentHoSourceBeamId;
  if (satId === sim.recentHoTargetSatId) return sim.recentHoTargetBeamId;
  const activeBeamIds = activeAssignmentsBySatId.get(satId);
  if (!activeBeamIds || activeBeamIds.size === 0) return null;
  return [...activeBeamIds][0] ?? null;
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

  return useMemo(() => {
    const centralBias = centralBiasWeight(mode);
    const interSatHandoverActive =
      sim.pendingTargetSatId !== null && sim.pendingTargetSatId !== sim.serving.satId;
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
      if (sampleSinrDb !== null && sampleSinrDb !== undefined && Number.isFinite(sampleSinrDb) && sampleSinrDb > MIN_VISIBLE_SINR_DB) {
        return sampleSinrDb;
      }
      const latchedSinrDb = latchedBeamSinrByKey?.get(`${satId}:${beamId}`);
      if (latchedSinrDb !== undefined && Number.isFinite(latchedSinrDb) && latchedSinrDb > MIN_VISIBLE_SINR_DB) {
        return latchedSinrDb;
      }
      if (
        satId === sim.serving.satId
        && beamId === sim.serving.beamId
        && Number.isFinite(sim.serving.sinrDb)
        && sim.serving.sinrDb > MIN_VISIBLE_SINR_DB
      ) {
        return sim.serving.sinrDb;
      }
      if (
        satId === sim.pendingTargetSatId
        && beamId === sim.pendingTargetBeamId
        && sim.pendingTargetSinrDb !== null
        && Number.isFinite(sim.pendingTargetSinrDb)
        && sim.pendingTargetSinrDb > MIN_VISIBLE_SINR_DB
      ) {
        return sim.pendingTargetSinrDb;
      }
      if (
        satId === sim.recentHoSourceSatId
        && beamId === sim.recentHoSourceBeamId
        && sim.recentHoSourceSinrDb !== null
        && Number.isFinite(sim.recentHoSourceSinrDb)
        && sim.recentHoSourceSinrDb > MIN_VISIBLE_SINR_DB
      ) {
        return sim.recentHoSourceSinrDb;
      }
      if (
        satId === sim.recentHoTargetSatId
        && beamId === sim.recentHoTargetBeamId
        && sim.recentHoTargetSinrDb !== null
        && Number.isFinite(sim.recentHoTargetSinrDb)
        && sim.recentHoTargetSinrDb > MIN_VISIBLE_SINR_DB
      ) {
        return sim.recentHoTargetSinrDb;
      }
      return null;
    };

    const prioritySatIds = [...new Set([
      sim.serving.satId,
      sim.pendingTargetSatId,
      sim.recentHoTargetSatId,
      sim.recentHoSourceSatId,
    ].filter((satId): satId is string => satId !== null))];

    const displaySats = [...sim.satellites].sort((a, b) => {
      const priorityA = a.id === sim.pendingTargetSatId || a.id === sim.recentHoTargetSatId
        ? 45
        : a.id === sim.recentHoSourceSatId
          ? 38
          : 0;
      const priorityB = b.id === sim.pendingTargetSatId || b.id === sim.recentHoTargetSatId
        ? 45
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

    const beamSatIds = interSatHandoverActive
      ? new Set(
        [sim.serving.satId, sim.pendingTargetSatId]
          .filter((satId): satId is string => satId !== null),
      )
      : new Set<string>(eventRoles.keys());
    if (beamSatIds.size === 0 && sim.serving.satId) beamSatIds.add(sim.serving.satId);

    const satBeams = new Map<string, VizFrame['satBeams'] extends Map<string, infer T> ? T : never>();
    for (const sat of shownSats) {
      if (!beamSatIds.has(sat.id)) continue;

      const layout = shellLayouts.get(sat.shellId);
      if (!layout) continue;

      const scale = FOOTPRINT_RADIUS_WORLD / Math.max(layout.footprintRadiusKm, 1e-6);
      const primaryBeamId = primaryBeamIdForSat(sat.id, sim, displayAssignmentsBySatId);
      if (primaryBeamId === null) continue;

      const beamCells = new Map(
        (sim.beamCellsBySatId.get(sat.id) ?? []).map(beam => [beam.beamId, beam]),
      );
      const role = eventRoles.get(sat.id);
      const primaryBeamCell = primaryBeamId !== null ? beamCells.get(primaryBeamId) : undefined;
      const anchorToUe =
        sat.id === sim.serving.satId
        || isPreparedTransitionSat(sat.id, sim)
        || isRecentHoSourceSat(sat.id, sim)
        || sat.id === sim.recentHoTargetSatId;
      if (!anchorToUe && !primaryBeamCell) continue;

      const sampleByBeamId = new Map(
        sim.linkSamples
          .filter(entry => entry.satId === sat.id)
          .map(entry => [entry.beamId, entry]),
      );
      const scheduledActiveBeamIds = sim.beamHopStatesBySatId.get(sat.id)?.activeBeamIds ?? [];
      const chosenBeamIds = [...new Set([primaryBeamId, ...scheduledActiveBeamIds])];

      satBeams.set(
        sat.id,
        chosenBeamIds.flatMap(beamId => {
          const beamCell = beamCells.get(beamId) as BeamCellViz | undefined;
          const sample = sampleByBeamId.get(beamId);
          const isPrimary = beamId === primaryBeamId;
          if (!isPrimary && !beamCell) return [];

          const isScheduledActive = scheduledActiveBeamIds.includes(beamId);
          const groundX = isPrimary
            ? (anchorToUe ? 0 : beamCell!.offsetEastKm * scale)
            : beamCell!.offsetEastKm * scale;
          const groundZ = isPrimary
            ? (anchorToUe ? 0 : -beamCell!.offsetNorthKm * scale)
            : -beamCell!.offsetNorthKm * scale;

          return [{
            beamId,
            groundX,
            groundZ,
            isServing: sat.id === sim.serving.satId && beamId === sim.serving.beamId,
            isScheduledActive,
            isPrimary,
            showBeam: true,
            role,
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
