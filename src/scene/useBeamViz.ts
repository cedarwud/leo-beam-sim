import { useMemo, useRef } from 'react';
import { MIN_VISIBLE_SINR_DB } from '../constants/sinr';
import { satelliteTint, satelliteTintIndex } from '../constants/beamRoleTokens';
import type { Profile } from '../profiles/types';
import {
  FOOTPRINT_RADIUS_WORLD,
  MAX_BEAMS_PER_SATELLITE,
  computeBeamGeometry,
} from './beam-layout';
import type {
  AmbientRing,
  BeamDensity,
  EventRole,
  PresentationMode,
  RuntimeConfig,
  RuntimeViewport,
  SimFrame,
  VizFrame,
  VizIntraHandoverEvent,
  VisualBeamTarget,
  VisibleSat,
} from './types';
import {
  resolveBeamFrequencyIndex,
  type BeamFrequencyIndexResolution,
} from '../utils/beamFrequency';
import { satelliteGlyph } from '../viz/glyphs';
import {
  beamDistanceToUeKm,
  computeApproachPreviews,
  type ApproachPreview,
  type BeamCellViz,
  type LatchedApproachState,
  type ShellVizLayout,
} from './beamApproachPreview';

const MAX_DISPLAY_SATS = 12;
const MAX_EVENT_SATS = 8;
const MAX_BEAM_SATS = 3;
const MAX_APPROACH_PREVIEW_BEAMS = MAX_BEAMS_PER_SATELLITE - 1;
const CENTRAL_CORE_RADIUS_WORLD = 180;
const CENTRAL_FOCUS_RADIUS_WORLD = 500;
const MIN_CENTER_ELEVATION_DEG = 45;
const MIN_APPROACH_HOLD_SEC = 4;
const EVENT_ONLY_CALLOUT_CAP = 4;
const EVENT_PLUS_ONE_DESKTOP_CALLOUT_CAP = 6;
const EVENT_PLUS_ONE_COMPACT_CALLOUT_CAP = 4;
const EVENT_PLUS_ONE_DESKTOP_MIN_WIDTH = 1440;

interface BeamSelectionSpec {
  beamId: number;
  role?: EventRole;
}

interface ConeBeamEntry {
  key: string;
  satelliteId: string;
  beam: VisualBeamTarget;
  order: number;
}

type VisibleSatWithIdentity = VisibleSat & Required<
  Pick<VisibleSat, 'satelliteTintColor' | 'satelliteGlyph' | 'satelliteVisualIndex'>
>;

function isFiniteSinr(sinrDb: number | null | undefined): sinrDb is number {
  return sinrDb !== null && sinrDb !== undefined && Number.isFinite(sinrDb);
}

export function resolveConeBeamCalloutCap(
  density: BeamDensity,
  viewport: RuntimeViewport,
): number {
  switch (density) {
    case 'event-only':
      return EVENT_ONLY_CALLOUT_CAP;
    case 'event-plus-1':
      return viewport.width >= EVENT_PLUS_ONE_DESKTOP_MIN_WIDTH
        ? EVENT_PLUS_ONE_DESKTOP_CALLOUT_CAP
        : EVENT_PLUS_ONE_COMPACT_CALLOUT_CAP;
    case 'all':
      return Infinity;
  }
}

function eventRolePriority(role?: EventRole): number {
  switch (role) {
    case 'serving':
    case 'post-ho':
      return 0;
    case 'prepared':
      return 1;
    case 'approach':
      return 2;
    case 'secondary':
      return 3;
    default:
      return 4;
  }
}

function coneEntryPriority(entry: ConeBeamEntry): number {
  return eventRolePriority(entry.beam.role);
}

function coneEntryKey(satelliteId: string, beamId: number): string {
  return `${satelliteId}:B${beamId}`;
}

function resolveVisualFrequency(
  beam: Pick<
    BeamCellViz,
    | 'beamId'
    | 'reuseGroup'
    | 'reuseGroupSource'
    | 'runtimeFrequencyReuse'
    | 'coreLayoutFrequencyReuse'
  >,
  frequencyReuse: number,
): BeamFrequencyIndexResolution {
  return resolveBeamFrequencyIndex({
    beamId: beam.beamId,
    frequencyReuse,
    reuseGroup: beam.reuseGroup,
    reuseGroupSource: beam.reuseGroupSource,
    runtimeFrequencyReuse: beam.runtimeFrequencyReuse,
    coreLayoutFrequencyReuse: beam.coreLayoutFrequencyReuse,
  });
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
  runtime: RuntimeConfig,
  latchedBeamSinrByKey?: Map<string, number>,
): VizFrame {
  const previousDisplayIdsRef = useRef<Set<string>>(new Set());
  const previousEventIdsRef = useRef<Set<string>>(new Set());
  const latchedApproachBySatRef = useRef<Map<string, LatchedApproachState>>(new Map());

  return useMemo(() => {
    const mode = runtime.presentationMode;
    const beamDensity = runtime.beamDensity;
    const calloutCap = resolveConeBeamCalloutCap(beamDensity, runtime.viewport);
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
          reuseGroup: beam.reuseGroup,
          reuseGroupSource: beam.reuseGroupSource,
          runtimeFrequencyReuse: beam.runtimeFrequencyReuse,
          coreLayoutFrequencyReuse: beam.coreLayoutFrequencyReuse,
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

    const {
      approachSatIds,
      approachSatIdSet,
      selectedApproachPreviewBySatId,
      newLatchedApproachBySat,
    } = computeApproachPreviews({
      sim,
      profile,
      shellLayouts,
      steeringBeamCellsBySatId,
      bestSinrPerSat,
      approachHoldSec,
      previousLatched: latchedApproachBySatRef.current,
      maxPreviewBeams: MAX_APPROACH_PREVIEW_BEAMS,
    });
    latchedApproachBySatRef.current = newLatchedApproachBySat;
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

    const shownSatsWithIdentity: VisibleSatWithIdentity[] = shownSats.map((sat, displayOrder) => {
      const satelliteVisualIndex = satelliteTintIndex(sat.id, displayOrder);
      return {
        ...sat,
        satelliteVisualIndex,
        satelliteTintColor: satelliteTint(sat.id, displayOrder),
        satelliteGlyph: satelliteGlyph(satelliteVisualIndex),
      };
    });

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
    const rankedCandidates = [...shownSatsWithIdentity]
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

    const shownSatIds = new Set(shownSatsWithIdentity.map(sat => sat.id));
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

    let satBeams = new Map<string, VisualBeamTarget[]>();
    const ambientRings: AmbientRing[] = [];
    const visualFrequencyByBeamKey = new Map<string, BeamFrequencyIndexResolution>();
    const coneEntries: ConeBeamEntry[] = [];
    const footprintRadiusKmBySatId = new Map<string, number>();
    let coneOrder = 0;

    const chooseHighestSinrActiveBeamId = (
      beamIds: Iterable<number>,
      sampleByBeamId: Map<number, { sinrDb: number }>,
    ): number | null => {
      let bestBeamId: number | null = null;
      let bestSinrDb = -Infinity;

      for (const beamId of beamIds) {
        const sampleSinrDb = sampleByBeamId.get(beamId)?.sinrDb ?? -Infinity;
        if (
          bestBeamId === null
          || sampleSinrDb > bestSinrDb
          || (sampleSinrDb === bestSinrDb && beamId < bestBeamId)
        ) {
          bestBeamId = beamId;
          bestSinrDb = sampleSinrDb;
        }
      }

      return bestBeamId;
    };

    const createAmbientRingForSat = (sat: VisibleSat): AmbientRing | null => {
      const layout = shellLayouts.get(sat.shellId);
      if (!layout) return null;

      const beamCells = new Map((steeringBeamCellsBySatId.get(sat.id) ?? []).map(beam => [beam.beamId, beam]));
      if (beamCells.size === 0) return null;

      const sampleByBeamId = new Map(
        sim.linkSamples
          .filter(entry => entry.satId === sat.id)
          .map(entry => [entry.beamId, entry]),
      );
      const displayBeamIds = displayAssignmentsBySatId.get(sat.id) ?? new Set<number>();
      const scheduledActiveBeamIds = sim.beamHopStatesBySatId.get(sat.id)?.activeBeamIds ?? [];
      const candidateBeamIds = new Set<number>([
        ...scheduledActiveBeamIds,
        ...displayBeamIds,
      ]);
      const fallbackBeamId = primaryBeamIdForSat(
        sat.id,
        sim,
        displayAssignmentsBySatId,
        steeringBeamCellsBySatId,
      );
      if (fallbackBeamId !== null) candidateBeamIds.add(fallbackBeamId);

      const selectedBeamId = chooseHighestSinrActiveBeamId(candidateBeamIds, sampleByBeamId)
        ?? fallbackBeamId;
      if (selectedBeamId === null) return null;

      const selectedBeamCell = beamCells.get(selectedBeamId);
      const beamCell = selectedBeamCell ?? nearestBeamCell([...beamCells.values()]);
      if (!beamCell) return null;

      const frequency = selectedBeamCell
        ? resolveVisualFrequency(selectedBeamCell, profile.beams.frequencyReuse)
        : resolveBeamFrequencyIndex({
          beamId: selectedBeamId,
          frequencyReuse: profile.beams.frequencyReuse,
        });
      visualFrequencyByBeamKey.set(coneEntryKey(sat.id, selectedBeamId), frequency);

      const scale = FOOTPRINT_RADIUS_WORLD / Math.max(layout.footprintRadiusKm, 1e-6);
      return {
        satelliteId: sat.id,
        beamId: selectedBeamId,
        groundX: beamCell.offsetEastKm * scale,
        groundZ: -beamCell.offsetNorthKm * scale,
        footprintRadiusKm: layout.footprintRadiusKm,
        ...frequency,
      };
    };

    for (const sat of shownSatsWithIdentity) {
      if (!beamSatIds.has(sat.id)) continue;

      const layout = shellLayouts.get(sat.shellId);
      if (!layout) continue;
      footprintRadiusKmBySatId.set(sat.id, layout.footprintRadiusKm);

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
      const selectionSpecs: BeamSelectionSpec[] = (() => {
        if (beamDensity === 'all') {
          return chosenBeamIds
            .slice(0, MAX_BEAMS_PER_SATELLITE)
            .sort((a, b) => a - b)
            .map(beamId => ({ beamId, role }));
        }

        if (beamDensity === 'event-only') {
          return role ? [{ beamId: primaryBeamId, role }] : [];
        }

        const specs: BeamSelectionSpec[] = [];
        const ambientCandidateBeamIds = new Set<number>([
          ...scheduledActiveBeamIds,
          ...(displayAssignmentsBySatId.get(sat.id) ?? new Set<number>()),
        ]);

        if (role) {
          specs.push({ beamId: primaryBeamId, role });
          ambientCandidateBeamIds.delete(primaryBeamId);
        } else {
          ambientCandidateBeamIds.add(primaryBeamId);
        }

        const bestAmbientBeamId = chooseHighestSinrActiveBeamId(ambientCandidateBeamIds, sampleByBeamId);
        if (bestAmbientBeamId !== null) {
          specs.push({ beamId: bestAmbientBeamId });
        }

        return specs.slice(0, MAX_BEAMS_PER_SATELLITE);
      })();

      const targets = selectionSpecs.flatMap(spec => {
        const beamCell = beamCells.get(spec.beamId) as BeamCellViz | undefined;
        const sample = sampleByBeamId.get(spec.beamId);
        const isPrimary = spec.beamId === primaryBeamId;
        if (!isPrimary && !beamCell) return [];

        const isScheduledActive = scheduledActiveBeamIds.includes(spec.beamId);
        // Anchor event-focused beam groups to the primary beam so common-mode
        // steering translation does not read as sideways "sliding".
        const beamOffsetEastKm = beamCell?.offsetEastKm ?? anchorOffsetEastKm;
        const beamOffsetNorthKm = beamCell?.offsetNorthKm ?? anchorOffsetNorthKm;
        const groundX = (beamOffsetEastKm - anchorOffsetEastKm) * scale;
        const groundZ = -(beamOffsetNorthKm - anchorOffsetNorthKm) * scale;
        const frequency = beamCell
          ? resolveVisualFrequency(beamCell, profile.beams.frequencyReuse)
          : resolveBeamFrequencyIndex({
            beamId: spec.beamId,
            frequencyReuse: profile.beams.frequencyReuse,
          });
        visualFrequencyByBeamKey.set(coneEntryKey(sat.id, spec.beamId), frequency);

        return [{
          beamId: spec.beamId,
          groundX,
          groundZ,
          isServing: sat.id === sim.serving.satId && spec.beamId === sim.serving.beamId,
          isScheduledActive,
          isPrimary,
          showBeam: true,
          role: spec.role,
          ...frequency,
          satelliteTintColor: sat.satelliteTintColor,
          satelliteGlyph: sat.satelliteGlyph,
          satelliteVisualIndex: sat.satelliteVisualIndex,
          isTransitioningSource: isTransitioningSourceSat(sat.id, sim),
          sinrDb: labelSinrForBeam(sat.id, spec.beamId, sample?.sinrDb ?? null),
        }];
      });

      if (targets.length > 0) {
        satBeams.set(sat.id, targets);
        for (const beam of targets) {
          coneEntries.push({
            key: coneEntryKey(sat.id, beam.beamId),
            satelliteId: sat.id,
            beam,
            order: coneOrder,
          });
          coneOrder += 1;
        }
      }
    }

    if (beamDensity === 'event-plus-1') {
      for (const sat of shownSatsWithIdentity) {
        if (beamSatIds.has(sat.id)) continue;
        const ring = createAmbientRingForSat(sat);
        if (ring) ambientRings.push(ring);
      }
    }

    if (Number.isFinite(calloutCap) && coneEntries.length > calloutCap) {
      const keptKeys = new Set(
        [...coneEntries]
          .sort((a, b) =>
            coneEntryPriority(a) - coneEntryPriority(b)
            || (b.beam.sinrDb ?? -Infinity) - (a.beam.sinrDb ?? -Infinity)
            || a.order - b.order)
          .slice(0, calloutCap)
          .map(entry => entry.key),
      );
      const cappedSatBeams = new Map<string, VisualBeamTarget[]>();

      for (const [satelliteId, beams] of satBeams.entries()) {
        const keptBeams: VisualBeamTarget[] = [];
        for (const beam of beams) {
          const key = coneEntryKey(satelliteId, beam.beamId);
          if (keptKeys.has(key)) {
            keptBeams.push(beam);
            continue;
          }

          if (beamDensity === 'event-plus-1') {
            const frequency = visualFrequencyByBeamKey.get(key) ?? resolveBeamFrequencyIndex({
              beamId: beam.beamId,
              frequencyReuse: profile.beams.frequencyReuse,
            });
            ambientRings.push({
              satelliteId,
              beamId: beam.beamId,
              groundX: beam.groundX,
              groundZ: beam.groundZ,
              footprintRadiusKm: footprintRadiusKmBySatId.get(satelliteId) ?? 0,
              ...frequency,
            });
          }
        }
        if (keptBeams.length > 0) cappedSatBeams.set(satelliteId, keptBeams);
      }

      satBeams = cappedSatBeams;
    }

    const sinrLabels = [...beamSatIds]
      .map(satId => {
        const sat = shownSatsWithIdentity.find(entry => entry.id === satId);
        const sinrDb = labelSinrForSat(satId);
        if (!sat || sinrDb === null) return null;
        return {
          position: sat.world,
          sinrDb,
          isServing: satId === sim.serving.satId,
        };
      })
      .filter((label): label is NonNullable<typeof label> => label !== null);

    previousDisplayIdsRef.current = new Set(shownSatsWithIdentity.map(sat => sat.id));
    previousEventIdsRef.current = new Set(eventSatIds);

    let intraHandoverEvent: VizIntraHandoverEvent | null = null;
    if (
      sim.intraHandoverEvent !== null
      && sim.intraHandoverWallClockStartMs !== null
      && sim.intraHandoverWallClockExpiresMs !== null
    ) {
      const { satId, fromBeamId, toBeamId } = sim.intraHandoverEvent;
      const sat = shownSatsWithIdentity.find(s => s.id === satId);
      const layout = sat ? shellLayouts.get(sat.shellId) : undefined;
      const beamCells = steeringBeamCellsBySatId.get(satId) ?? [];
      if (sat && layout) {
        const scale = FOOTPRINT_RADIUS_WORLD / Math.max(layout.footprintRadiusKm, 1e-6);
        const toCell = beamCells.find(b => b.beamId === toBeamId);
        const fromCell = beamCells.find(b => b.beamId === fromBeamId);
        if (toCell && fromCell) {
          const anchorEastKm = toCell.offsetEastKm;
          const anchorNorthKm = toCell.offsetNorthKm;
          intraHandoverEvent = {
            ...sim.intraHandoverEvent,
            wallClockStartMs: sim.intraHandoverWallClockStartMs,
            wallClockExpiresMs: sim.intraHandoverWallClockExpiresMs,
            fromGroundX: (fromCell.offsetEastKm - anchorEastKm) * scale,
            fromGroundZ: -(fromCell.offsetNorthKm - anchorNorthKm) * scale,
            toGroundX: 0,
            toGroundZ: 0,
          };
        }
      }
    }

    return {
      displaySats: shownSatsWithIdentity,
      eventSatIds,
      eventRoles,
      beamSatIds,
      satBeams,
      ambientRings,
      visualFrequencyByBeamKey,
      sinrLabels,
      footprintRadiusWorld: FOOTPRINT_RADIUS_WORLD,
      intraHandoverEvent,
    };
  }, [latchedBeamSinrByKey, profile, runtime, sim]);
}
