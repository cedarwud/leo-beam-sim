import * as THREE from 'three';
import { useMemo, useRef } from 'react';
import { MIN_VISIBLE_SINR_DB } from '../constants/sinr';
import { satelliteTint, satelliteTintIndex } from '../constants/beamRoleTokens';
import type { Profile } from '../profiles/types';
import {
  FOOTPRINT_RADIUS_WORLD,
  MAX_BEAMS_PER_SATELLITE,
} from './beam-layout';
import type {
  AmbientRing,
  BeamDensity,
  EventRole,
  PresentationMode,
  RuntimeConfig,
  RuntimeViewport,
  VizFrame,
  VizIntraHandoverEvent,
  VisualBeamTarget,
  VisibleSat,
} from './types';
import type { NormalizedSceneFrame } from './NormalizedSceneFrame';
import type { SceneGeometry } from './SceneGeometry';
import type { SceneVisualScaleMultipliers } from '../sceneVisualScale';
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

// P1c §E: display caps hoisted to runtime-mutable config (SDD §7, §13 Cat A).
// Module-level constants below are the **default** values; callers may
// override via the `displayCaps` parameter on `useBeamViz`. Per §13 Cat A the
// defaults differ between live-sim and artifact-replay — `liveSimToScene` and
// `showcaseArtifactToScene` callers pass mode-appropriate defaults.
//
// PERF: tested up to MAX_DISPLAY_SATS_UPPER_BOUND=32 / MAX_EVENT_SATS_UPPER_BOUND=32
// / MAX_BEAM_SATS_UPPER_BOUND=16; higher values may degrade FPS because the
// O(N²) sort + selection loops in this hook scale with these caps.
export const DEFAULT_MAX_DISPLAY_SATS = 12;
export const DEFAULT_MAX_EVENT_SATS = 8;
export const DEFAULT_MAX_BEAM_SATS = 3;
export const MAX_DISPLAY_SATS_UPPER_BOUND = 32;
export const MAX_EVENT_SATS_UPPER_BOUND = 32;
export const MAX_BEAM_SATS_UPPER_BOUND = 16;

/**
 * Runtime-tunable display caps. `undefined` fields fall back to the live
 * defaults above. Each value is clamped to its perf-tested upper bound; a
 * `console.warn` fires if the caller exceeds the bound.
 */
export interface BeamVizDisplayCaps {
  readonly maxDisplaySats?: number;
  readonly maxEventSats?: number;
  readonly maxBeamSats?: number;
}

function clampCap(name: string, requested: number | undefined, fallback: number, upperBound: number): number {
  if (requested === undefined) return fallback;
  if (!Number.isFinite(requested) || requested < 1) return fallback;
  if (requested > upperBound) {
    // eslint-disable-next-line no-console
    console.warn(
      `[useBeamViz] ${name}=${requested} exceeds tested upper bound ${upperBound}; ` +
        `clamping. Higher values may degrade FPS (O(N²) loops).`,
    );
    return upperBound;
  }
  return Math.floor(requested);
}

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

interface RelevantSatIds {
  readonly servingSatId: string | null;
  readonly servingBeamId: number | null;
  readonly pendingTargetSatId: string | null;
  readonly pendingTargetBeamId: number | null;
  readonly recentHoSourceSatId: string | null;
  readonly recentHoSourceBeamId: number | null;
  readonly recentHoTargetSatId: string | null;
  readonly recentHoTargetBeamId: number | null;
}

function primaryBeamIdForSat(
  satId: string,
  ids: RelevantSatIds,
  displayAssignmentsBySatId: Map<string, Set<number>>,
  beamCellsBySatId: Map<string, BeamCellViz[]>,
): number | null {
  if (satId === ids.servingSatId) return ids.servingBeamId;
  if (satId === ids.pendingTargetSatId) return ids.pendingTargetBeamId;
  if (satId === ids.recentHoSourceSatId) return ids.recentHoSourceBeamId;
  if (satId === ids.recentHoTargetSatId) return ids.recentHoTargetBeamId;
  const displayBeamIds = displayAssignmentsBySatId.get(satId);
  if (displayBeamIds && displayBeamIds.size > 0) return [...displayBeamIds][0] ?? null;
  const nearestBeam = nearestBeamCell(beamCellsBySatId.get(satId) ?? []);
  return nearestBeam?.beamId ?? null;
}

function isTransitioningSourceSat(satId: string, ids: RelevantSatIds): boolean {
  return satId === ids.servingSatId
    && ids.pendingTargetSatId !== null
    && ids.pendingTargetSatId !== ids.servingSatId;
}

function isPreparedTransitionSat(satId: string, ids: RelevantSatIds): boolean {
  return satId === ids.pendingTargetSatId && ids.pendingTargetSatId !== ids.servingSatId;
}

function isRecentHoSourceSat(satId: string, ids: RelevantSatIds): boolean {
  return satId === ids.recentHoSourceSatId && satId !== ids.servingSatId;
}

function wallClockProgress(startMs: number | null, endMs: number | null): number {
  if (startMs === null || endMs === null) return 1;
  const durationMs = Math.max(1, endMs - startMs);
  const nowMs = typeof performance === 'undefined' ? Date.now() : performance.now();
  return Math.min(1, Math.max(0, (nowMs - startMs) / durationMs));
}

function intraPreviewTransitionProgress(progress: number): number {
  return Math.min(0.3, Math.max(0, progress) * 0.3);
}

function intraCommittedTransitionProgress(startMs: number | null, endMs: number | null): number {
  return 0.3 + wallClockProgress(startMs, endMs) * 0.7;
}

function interPendingTransitionProgress(progressSec: number, targetSec: number): number {
  const target = Math.max(targetSec, 1e-6);
  return Math.min(0.3, Math.max(0, progressSec / target) * 0.3);
}

export function useBeamViz(
  frame: NormalizedSceneFrame,
  geometry: SceneGeometry,
  runtime: RuntimeConfig,
  latchedBeamSinrByKey?: Map<string, number>,
  /**
   * P1c §E: runtime-tunable display caps (was module-level const). Pass
   * `undefined` to use live defaults; mode-appropriate defaults are wired by
   * the callers (live-sim vs artifact-replay) per §13 Cat A.
   */
  displayCaps?: BeamVizDisplayCaps,
  /**
   * P1d: `Profile['beamHopping']` config passed through for
   * `computeApproachPreviews`. Live caller provides from `profile`; replay
   * caller may pass a no-op or simply not call approach previews (the
   * function gates on `frame.beamHopping.enabled`).
   */
  beamHoppingConfig?: Profile['beamHopping'],
  visualScaleMultipliers?: SceneVisualScaleMultipliers,
): VizFrame {
  const previousDisplayIdsRef = useRef<Set<string>>(new Set());
  const previousEventIdsRef = useRef<Set<string>>(new Set());
  const latchedApproachBySatRef = useRef<Map<string, LatchedApproachState>>(new Map());

  return useMemo(() => {
    const beamFootprintMultiplier = visualScaleMultipliers?.beamFootprintMultiplier ?? 1.0;
    // -------------------------------------------------------------------
    // P1d local alias block — derive sim-shape values from
    // `NormalizedSceneFrame`. The renderer no longer reads `SimFrame` or
    // `Profile` directly; all downstream code branches on these aliases.
    // -------------------------------------------------------------------
    const servingSatId = frame.metrics.servingSatelliteId || null;
    const servingBeamId =
      frame.metrics.servingBeamId !== '' && frame.metrics.servingBeamId !== undefined
        ? Number(frame.metrics.servingBeamId)
        : null;
    const servingSinrDb = frame.metrics.serving.dB;
    const pendingTargetSatId = frame.pendingTarget?.satId ?? null;
    const pendingTargetBeamId = frame.pendingTarget?.beamId !== undefined && frame.pendingTarget?.beamId !== ''
      ? Number(frame.pendingTarget.beamId)
      : null;
    const pendingTargetSinrDb = frame.pendingTarget?.channelMetric?.dB ?? null;
    const recentHoSourceSatId = frame.recentHo?.sourceSatId ?? null;
    const recentHoSourceBeamId =
      frame.recentHo?.sourceBeamId !== undefined && frame.recentHo?.sourceBeamId !== ''
        ? Number(frame.recentHo.sourceBeamId)
        : null;
    const recentHoSourceSinrDb = frame.recentHo?.sourceChannelMetric?.dB ?? null;
    const recentHoTargetSatId = frame.recentHo?.targetSatId ?? null;
    // targetBeamId is `string | null` (target may be absent on source-only HO);
    // explicit null guard prevents `Number(null) === 0` masquerading as a
    // valid beam id when target is null but source is present.
    const recentHoTargetBeamIdRaw = frame.recentHo?.targetBeamId;
    const recentHoTargetBeamId =
      recentHoTargetBeamIdRaw != null && recentHoTargetBeamIdRaw !== ''
        ? Number(recentHoTargetBeamIdRaw)
        : null;
    // Live path produced a stub `recentHoTargetSinrDb`; the normalized frame
    // does not currently carry it. Renderer treats absent as null.
    const recentHoTargetSinrDb: number | null = null;
    const simTimeSec = frame.tSec;
    const beamHopSlotSec = frame.beamHopping.slotSec ?? 0;

    // Derive a sim-shape `interHandoverEvent` from `transitionProgress.inter`.
    // Used by event-role assignment for `secondary` and `post-ho` tokens.
    const interTransition = frame.transitionProgress.inter;
    const interHandoverEvent =
      interTransition !== undefined
        ? {
            fromSatId: interTransition.fromSatId,
            fromBeamId: Number(interTransition.fromBeamId),
            toSatId: interTransition.toSatId,
            toBeamId: Number(interTransition.toBeamId),
            expiresAtSec: interTransition.expiresAtSec,
          }
        : null;

    // Per-(sat,beam) link-sample lookup keyed by satId for ambient-ring fast
    // path. Wrap dB values in the legacy `{ sinrDb }` shape so the rest of
    // useBeamViz keeps its existing accessor pattern.
    const linkSampleBySatBeam = new Map<string, Map<number, { sinrDb: number }>>();
    for (const sample of frame.links) {
      const numericBeamId = Number(sample.beamId);
      const perSat = linkSampleBySatBeam.get(sample.sourceId) ?? new Map<number, { sinrDb: number }>();
      perSat.set(numericBeamId, { sinrDb: sample.channelMetric.dB });
      linkSampleBySatBeam.set(sample.sourceId, perSat);
    }

    // Display assignments — replay path leaves undefined; we build an empty
    // map there (no beam-cone display on replay).
    const displayAssignmentsBySatIdNumeric = new Map<string, Set<number>>();
    if (frame.beamHopping.displayAssignmentsBySatId) {
      for (const [satId, beamIds] of frame.beamHopping.displayAssignmentsBySatId.entries()) {
        displayAssignmentsBySatIdNumeric.set(satId, new Set(beamIds.map(Number)));
      }
    }

    // Per-sat beam-hopping active beams as numeric set.
    const beamHopActiveBySatId = new Map<string, number[]>();
    for (const [satId, state] of frame.beamHopping.bySatId.entries()) {
      beamHopActiveBySatId.set(satId, state.activeBeamIds.map(Number));
    }

    // Bundle the relevant IDs for the small helpers introduced earlier.
    const relevantIds: RelevantSatIds = {
      servingSatId,
      servingBeamId,
      pendingTargetSatId,
      pendingTargetBeamId,
      recentHoSourceSatId,
      recentHoSourceBeamId,
      recentHoTargetSatId,
      recentHoTargetBeamId,
    };

    // Build VisibleSat-equivalent list from normalized satellites. WorldPos
    // tuple → THREE.Vector3 wrapping (renderer code uses `.distanceTo` etc.).
    const satellites: VisibleSat[] = frame.satellites.map(s => ({
      id: s.id,
      shellId: s.shellId ?? '',
      altitudeKm: s.altitudeKm ?? geometry.shellAltitudeKm,
      world: new THREE.Vector3(s.worldPos[0], s.worldPos[1], s.worldPos[2]),
      topo: s.topo ?? { eastKm: 0, northKm: 0, upKm: 0, rangeKm: 0, azimuthDeg: 0, elevationDeg: 90 },
      latDeg: s.latDeg ?? 0,
      lonDeg: s.lonDeg ?? 0,
    }));

    // Per-(sat,beam) link sample lookup. Live path projects all `linkSamples`;
    // replay path leaves `links[]` with only producer-truth `channelMetric`.
    const linkSamples = frame.links;

    // Re-group beams[] into Map<satId, BeamCellViz[]> for downstream display
    // logic that expects the old shape. Layout primitives are present on the
    // live path; replay leaves them undefined and the renderer gates on
    // `beamHopping.enabled` for the beam-cone display.
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

    // Geometry-derived constants previously read from `Profile`.
    const beamFrequencyReuseCount = geometry.beamFrequencyReuseCount ?? 1;
    const handoverTriggerTimeSec = geometry.handoverTriggerTimeSec ?? 0;

    // -------------------------------------------------------------------
    // End P1d local alias block.
    // -------------------------------------------------------------------

    // Resolve caps once per memoised pass, with upper-bound clamp.
    const MAX_DISPLAY_SATS = clampCap(
      'maxDisplaySats',
      displayCaps?.maxDisplaySats,
      DEFAULT_MAX_DISPLAY_SATS,
      MAX_DISPLAY_SATS_UPPER_BOUND,
    );
    const MAX_EVENT_SATS = clampCap(
      'maxEventSats',
      displayCaps?.maxEventSats,
      DEFAULT_MAX_EVENT_SATS,
      MAX_EVENT_SATS_UPPER_BOUND,
    );
    const MAX_BEAM_SATS = clampCap(
      'maxBeamSats',
      displayCaps?.maxBeamSats,
      DEFAULT_MAX_BEAM_SATS,
      MAX_BEAM_SATS_UPPER_BOUND,
    );
    const mode = runtime.presentationMode;
    const beamDensity = runtime.beamDensity;
    const calloutCap = resolveConeBeamCalloutCap(beamDensity, runtime.viewport);
    const centralBias = centralBiasWeight(mode);
    const approachHoldSec = Math.max(
      MIN_APPROACH_HOLD_SEC,
      (beamHopSlotSec > 0 ? beamHopSlotSec : MIN_APPROACH_HOLD_SEC) * 1.5,
    );
    const shellLayouts: ReadonlyMap<string, ShellVizLayout> = geometry.shellLayouts;

    const bestSinrPerSat = new Map<string, number>();
    for (const sample of linkSamples) {
      const sampleSinrDb = sample.channelMetric.dB;
      const currentBest = bestSinrPerSat.get(sample.sourceId) ?? -Infinity;
      if (sampleSinrDb > currentBest) bestSinrPerSat.set(sample.sourceId, sampleSinrDb);
    }
    const labelSinrForSat = (satId: string): number | null => {
      if (satId === recentHoSourceSatId && recentHoSourceSinrDb !== null) {
        return recentHoSourceSinrDb;
      }
      if (satId === recentHoTargetSatId && recentHoTargetSinrDb !== null) {
        return recentHoTargetSinrDb;
      }
      if (satId === pendingTargetSatId && pendingTargetSinrDb !== null) {
        return pendingTargetSinrDb;
      }
      if (satId === servingSatId && Number.isFinite(servingSinrDb) && servingSinrDb > MIN_VISIBLE_SINR_DB) {
        return servingSinrDb;
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
        satId === servingSatId
        && beamId === servingBeamId
        && isFiniteSinr(servingSinrDb)
      ) {
        return servingSinrDb;
      }
      if (
        satId === pendingTargetSatId
        && beamId === pendingTargetBeamId
        && isFiniteSinr(pendingTargetSinrDb)
      ) {
        return pendingTargetSinrDb;
      }
      if (
        satId === recentHoSourceSatId
        && beamId === recentHoSourceBeamId
        && isFiniteSinr(recentHoSourceSinrDb)
      ) {
        return recentHoSourceSinrDb;
      }
      if (
        satId === recentHoTargetSatId
        && beamId === recentHoTargetBeamId
        && isFiniteSinr(recentHoTargetSinrDb)
      ) {
        return recentHoTargetSinrDb;
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
      frame,
      geometry,
      beamHoppingConfig: beamHoppingConfig ?? {
        enabled: false,
        slotSec: 0,
        maxActiveBeamsPerSlot: 0,
        scheduler: 'round-robin',
        frameLengthSlots: 0,
      },
      bestSinrPerSat,
      approachHoldSec,
      previousLatched: latchedApproachBySatRef.current,
      maxPreviewBeams: MAX_APPROACH_PREVIEW_BEAMS,
    });
    latchedApproachBySatRef.current = newLatchedApproachBySat;
    const prioritySatIds = [...new Set([
      servingSatId,
      pendingTargetSatId,
      recentHoTargetSatId,
      recentHoSourceSatId,
      ...approachSatIds,
    ].filter((satId): satId is string => satId !== null))];

    const displaySats = [...satellites].sort((a, b) => {
      const priorityA = a.id === pendingTargetSatId || a.id === recentHoTargetSatId
        ? 45
        : approachSatIdSet.has(a.id)
          ? 34
        : a.id === recentHoSourceSatId
          ? 38
          : 0;
      const priorityB = b.id === pendingTargetSatId || b.id === recentHoTargetSatId
        ? 45
        : approachSatIdSet.has(b.id)
          ? 34
        : b.id === recentHoSourceSatId
          ? 38
          : 0;
      const prevA = previousDisplayIdsRef.current.has(a.id) ? 15 : 0;
      const prevB = previousDisplayIdsRef.current.has(b.id) ? 15 : 0;
      const centerA = scoreCentralPass(a) * centralBias;
      const centerB = scoreCentralPass(b) * centralBias;
      const servingA = a.id === servingSatId ? 10000 : 0;
      const servingB = b.id === servingSatId ? 10000 : 0;
      
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
      const requiredSat = satellites.find(sat => sat.id === requiredSatId);
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

    const committedInterEvent =
      pendingTargetSatId === null ? interHandoverEvent : null;
    const eventRoles = new Map<string, VizFrame['eventRoles'] extends Map<string, infer T> ? T : never>();
    if (servingSatId) {
      eventRoles.set(
        servingSatId,
        recentHoTargetSatId === servingSatId || committedInterEvent?.toSatId === servingSatId
          ? 'post-ho'
          : 'serving',
      );
    }
    if (pendingTargetSatId && pendingTargetSatId !== servingSatId) {
      eventRoles.set(pendingTargetSatId, 'prepared');
    }
    if (
      recentHoSourceSatId &&
      recentHoSourceSatId !== servingSatId &&
      recentHoSourceSatId !== pendingTargetSatId
    ) {
      eventRoles.set(recentHoSourceSatId, 'secondary');
    }
    if (
      committedInterEvent
      && committedInterEvent.fromSatId !== servingSatId
      && committedInterEvent.fromSatId !== pendingTargetSatId
    ) {
      eventRoles.set(committedInterEvent.fromSatId, 'secondary');
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

    const displayAssignmentsBySatId = displayAssignmentsBySatIdNumeric;

    const shownSatIds = new Set(shownSatsWithIdentity.map(sat => sat.id));
    const beamSatIdOrder = [
      servingSatId,
      pendingTargetSatId,
      recentHoTargetSatId,
      recentHoSourceSatId,
      committedInterEvent?.toSatId ?? null,
      committedInterEvent?.fromSatId ?? null,
      ...approachSatIds,
      ...rankedCandidates.map(sat => sat.id),
    ].filter((satId): satId is string => satId !== null);
    const beamSatIds = new Set<string>();
    for (const satId of beamSatIdOrder) {
      if (!shownSatIds.has(satId)) continue;
      beamSatIds.add(satId);
      if (beamSatIds.size >= MAX_BEAM_SATS) break;
    }
    if (beamSatIds.size === 0 && servingSatId) beamSatIds.add(servingSatId);

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

      const sampleByBeamId = linkSampleBySatBeam.get(sat.id) ?? new Map<number, { sinrDb: number }>();
      const displayBeamIds = displayAssignmentsBySatId.get(sat.id) ?? new Set<number>();
      const scheduledActiveBeamIds = beamHopActiveBySatId.get(sat.id) ?? [];
      const candidateBeamIds = new Set<number>([
        ...scheduledActiveBeamIds,
        ...displayBeamIds,
      ]);
      const fallbackBeamId = primaryBeamIdForSat(
        sat.id,
        relevantIds,
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
        ? resolveVisualFrequency(selectedBeamCell, beamFrequencyReuseCount)
        : resolveBeamFrequencyIndex({
          beamId: selectedBeamId,
          frequencyReuse: beamFrequencyReuseCount,
        });
      visualFrequencyByBeamKey.set(coneEntryKey(sat.id, selectedBeamId), frequency);

      const scale = (FOOTPRINT_RADIUS_WORLD * beamFootprintMultiplier)
        / Math.max(layout.footprintRadiusKm, 1e-6);
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

      const scale = (FOOTPRINT_RADIUS_WORLD * beamFootprintMultiplier)
        / Math.max(layout.footprintRadiusKm, 1e-6);
      const approachPreview = selectedApproachPreviewBySatId.get(sat.id);
      const primaryBeamId = approachPreview?.primaryBeamId ?? primaryBeamIdForSat(
        sat.id,
        relevantIds,
        displayAssignmentsBySatId,
        steeringBeamCellsBySatId,
      );
      if (primaryBeamId === null) continue;

      const beamCells = new Map((steeringBeamCellsBySatId.get(sat.id) ?? []).map(beam => [beam.beamId, beam]));
      const role = eventRoles.get(sat.id);
      const primaryBeamCell = primaryBeamId !== null ? beamCells.get(primaryBeamId) : undefined;
      const anchorToUe =
        sat.id === servingSatId
        || isPreparedTransitionSat(sat.id, relevantIds)
        || isRecentHoSourceSat(sat.id, relevantIds)
        || sat.id === recentHoTargetSatId
        || sat.id === committedInterEvent?.fromSatId
        || sat.id === committedInterEvent?.toSatId;
      if (!anchorToUe && !primaryBeamCell) continue;
      const anchorOffsetEastKm = anchorToUe ? (primaryBeamCell?.offsetEastKm ?? 0) : 0;
      const anchorOffsetNorthKm = anchorToUe ? (primaryBeamCell?.offsetNorthKm ?? 0) : 0;

      const sampleByBeamId = linkSampleBySatBeam.get(sat.id) ?? new Map<number, { sinrDb: number }>();
      const scheduledActiveBeamIds = beamHopActiveBySatId.get(sat.id) ?? [];
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

      // Intra-HO from/to beams + progress sourced from the adapter's
      // pre-derived `transitionProgress.intra`. The renderer no longer re-
      // computes wallclock latches (those move into `deriveLiveSceneFields`).
      const intraTransition = frame.transitionProgress.intra;
      const intraTransitionTargetsSat = intraTransition !== undefined
        // Live derive sets intra.from/to to be sat-scoped via the beamHopState;
        // for this renderer, intra applies when the serving sat matches.
        && sat.id === servingSatId;
      const activeIntraForSat = intraTransitionTargetsSat && intraTransition
        ? {
          fromBeamId: Number(intraTransition.fromBeamId),
          toBeamId: Number(intraTransition.toBeamId),
        }
        : null;
      const intraTransitionProgress = intraTransitionTargetsSat && intraTransition
        ? intraTransition.progress01
        : null;
      const pendingInterActive =
        pendingTargetSatId !== null
        && pendingTargetBeamId !== null
        && pendingTargetSatId !== servingSatId;
      const interRoleByBeamId = new Map<number, 'interSource' | 'interTargetNewServing'>();
      let interTransitionProgress: number | null = null;

      if (pendingInterActive) {
        interTransitionProgress = frame.transitionProgress.inter?.progress01 ?? null;
        if (sat.id === servingSatId && servingBeamId !== null) {
          interRoleByBeamId.set(servingBeamId, 'interSource');
        }
        if (sat.id === pendingTargetSatId && pendingTargetBeamId !== null) {
          interRoleByBeamId.set(pendingTargetBeamId, 'interTargetNewServing');
        }
      } else if (committedInterEvent) {
        interTransitionProgress = frame.transitionProgress.inter?.progress01 ?? null;
        if (sat.id === committedInterEvent.fromSatId) {
          interRoleByBeamId.set(committedInterEvent.fromBeamId, 'interSource');
        }
        if (sat.id === committedInterEvent.toSatId) {
          interRoleByBeamId.set(committedInterEvent.toBeamId, 'interTargetNewServing');
        }
      }

      if (activeIntraForSat) {
        const existingBeamIds = new Set(selectionSpecs.map(s => s.beamId));
        for (const intraBeamId of [activeIntraForSat.fromBeamId, activeIntraForSat.toBeamId]) {
          if (!existingBeamIds.has(intraBeamId) && selectionSpecs.length < MAX_BEAMS_PER_SATELLITE) {
            selectionSpecs.push({ beamId: intraBeamId });
          }
        }
      }
      if (interRoleByBeamId.size > 0) {
        const existingBeamIds = new Set(selectionSpecs.map(s => s.beamId));
        for (const interBeamId of interRoleByBeamId.keys()) {
          if (!existingBeamIds.has(interBeamId) && selectionSpecs.length < MAX_BEAMS_PER_SATELLITE) {
            selectionSpecs.push({ beamId: interBeamId });
          }
        }
      }

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
          ? resolveVisualFrequency(beamCell, beamFrequencyReuseCount)
          : resolveBeamFrequencyIndex({
            beamId: spec.beamId,
            frequencyReuse: beamFrequencyReuseCount,
          });
        visualFrequencyByBeamKey.set(coneEntryKey(sat.id, spec.beamId), frequency);

        const intraRole: 'intraSource' | 'intraTargetNewServing' | null =
          activeIntraForSat?.fromBeamId === spec.beamId ? 'intraSource'
          : activeIntraForSat?.toBeamId === spec.beamId ? 'intraTargetNewServing'
          : null;
        const handoverRole = intraRole ?? interRoleByBeamId.get(spec.beamId) ?? null;
        const handoverTransitionProgress = intraRole
          ? intraTransitionProgress
          : interRoleByBeamId.has(spec.beamId)
            ? interTransitionProgress
            : null;

        return [{
          beamId: spec.beamId,
          groundX,
          groundZ,
          isServing: sat.id === servingSatId && spec.beamId === servingBeamId,
          isScheduledActive,
          isPrimary,
          showBeam: true,
          role: spec.role,
          handoverRole,
          handoverTransitionProgress,
          ...frequency,
          satelliteTintColor: sat.satelliteTintColor,
          satelliteGlyph: sat.satelliteGlyph,
          satelliteVisualIndex: sat.satelliteVisualIndex,
          isTransitioningSource: isTransitioningSourceSat(sat.id, relevantIds),
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
              frequencyReuse: beamFrequencyReuseCount,
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
          isServing: satId === servingSatId,
        };
      })
      .filter((label): label is NonNullable<typeof label> => label !== null);

    previousDisplayIdsRef.current = new Set(shownSatsWithIdentity.map(sat => sat.id));
    previousEventIdsRef.current = new Set(eventSatIds);

    let intraHandoverEvent: VizIntraHandoverEvent | null = null;
    const intraDerived = frame.transitionProgress.intra;
    if (
      intraDerived
      && intraDerived.satId !== undefined
      && intraDerived.wallClockStartMs !== undefined
      && intraDerived.wallClockExpiresMs !== undefined
      && intraDerived.triggeredAtSec !== undefined
    ) {
      const satId = intraDerived.satId;
      const fromBeamId = Number(intraDerived.fromBeamId);
      const toBeamId = Number(intraDerived.toBeamId);
      const sat = shownSatsWithIdentity.find(s => s.id === satId);
      const layout = sat ? shellLayouts.get(sat.shellId) : undefined;
      const beamCells = steeringBeamCellsBySatId.get(satId) ?? [];
      if (sat && layout) {
        const scale = (FOOTPRINT_RADIUS_WORLD * beamFootprintMultiplier)
          / Math.max(layout.footprintRadiusKm, 1e-6);
        const toCell = beamCells.find(b => b.beamId === toBeamId);
        const fromCell = beamCells.find(b => b.beamId === fromBeamId);
        if (toCell && fromCell) {
          const anchorEastKm = toCell.offsetEastKm;
          const anchorNorthKm = toCell.offsetNorthKm;
          intraHandoverEvent = {
            satId,
            fromBeamId,
            toBeamId,
            triggeredAtSec: intraDerived.triggeredAtSec,
            expiresAtSec: intraDerived.expiresAtSec,
            wallClockStartMs: intraDerived.wallClockStartMs,
            wallClockExpiresMs: intraDerived.wallClockExpiresMs,
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
      footprintRadiusWorld: FOOTPRINT_RADIUS_WORLD * beamFootprintMultiplier,
      intraHandoverEvent,
    };
  }, [
    latchedBeamSinrByKey,
    frame,
    geometry,
    runtime,
    displayCaps,
    beamHoppingConfig,
    visualScaleMultipliers,
  ]);
}
