import { useMemo, useRef } from 'react';
import { MIN_VISIBLE_SINR_DB } from '../constants/sinr';
import { satelliteTintIndex } from '../constants/beamRoleTokens';
import { resolveSatelliteIdentityColor } from '../appearance/resolveSatelliteAppearance';
import type { Profile } from '../profiles/types';
import { MAX_BEAMS_PER_SATELLITE, generateBeamOffsetsKm } from './beam-layout';
import type {
  AmbientRing,
  RuntimeConfig,
  VizFrame,
  VizIntraHandoverEvent,
  VisualBeamTarget,
  VisibleSat,
} from './types';
import type { NormalizedSceneFrame } from './NormalizedSceneFrame';
import type { SceneGeometry } from './SceneGeometry';
import { SKY_DOME_V_RADIUS } from './sceneScale';
import { projectSatelliteRenderWorld } from './satelliteRenderProjection';
import type { SceneVisualScaleMultipliers } from '../sceneVisualScale';
import {
  resolveBeamFrequencyIndex,
  type BeamFrequencyIndexResolution,
} from '../utils/beamFrequency';
import { satelliteGlyph } from '../viz/glyphs';
import {
  computeApproachPreviews,
  type BeamCellViz,
  type LatchedApproachState,
  type ShellVizLayout,
} from './beamApproachPreview';
import {
  centralBiasWeight,
  coneEntryKey,
  coneEntryPriority,
  isFiniteSinr,
  isPreparedTransitionSat,
  isRecentHoSourceSat,
  isTransitioningSourceSat,
  nearestBeamCell,
  primaryBeamIdForSat,
  resolveBeamVizDisplayCaps,
  resolveConeBeamCalloutCap,
  resolveVisualFrequency,
  scoreCentralPass,
  type BeamVizDisplayCaps,
  type ConeBeamEntry,
  type RelevantSatIds,
  type VisibleSatWithIdentity,
} from './beamVizModel';

export {
  DEFAULT_MAX_BEAM_SATS,
  DEFAULT_MAX_DISPLAY_SATS,
  DEFAULT_MAX_EVENT_SATS,
  MAX_BEAM_SATS_UPPER_BOUND,
  MAX_DISPLAY_SATS_UPPER_BOUND,
  MAX_EVENT_SATS_UPPER_BOUND,
  resolveConeBeamCalloutCap,
} from './beamVizModel';
export type { BeamVizDisplayCaps } from './beamVizModel';

// P1c §E: display caps hoisted to runtime-mutable config (SDD §7, §13 Cat A).
// Module-level constants below are the **default** values; callers may
// override via the `displayCaps` parameter on `useBeamViz`. Per §13 Cat A the
// defaults differ between live-sim and artifact-replay — `liveSimToScene` and
// `showcaseArtifactToScene` callers pass mode-appropriate defaults.
//
// PERF: tested up to MAX_DISPLAY_SATS_UPPER_BOUND=32 / MAX_EVENT_SATS_UPPER_BOUND=32
// / MAX_BEAM_SATS_UPPER_BOUND=16; higher values may degrade FPS because the
// O(N²) sort + selection loops in this hook scale with these caps.
const MAX_APPROACH_PREVIEW_BEAMS = MAX_BEAMS_PER_SATELLITE - 1;
const MIN_APPROACH_HOLD_SEC = 4;

/**
 * How far above the geometrically-derived height the satellites are drawn
 * (owner call 2026-08-06: 現在衛星太低了要加高).
 *
 * The derived value is the true altitude in scene units, which puts the shell
 * so close to the ground plane that the beam cones are short and steep and the
 * satellites read as hovering rather than orbiting. This lift is DISPLAY ONLY:
 * it moves where the satellite mesh and the cone apex are drawn, and changes
 * nothing about range, elevation, path loss, SINR or the handover decision —
 * those all run on the real kilometres upstream.
 *
 * A profile that sets `visualSatelliteAltitude` explicitly opts out: its value
 * is taken verbatim, since it is already an authored display height.
 *
 * Exported because `validate:s1:coordinate-authority` reconstructs the expected
 * `satPosScaleFactor` to check the live-enu projection end-to-end. It used to
 * hard-code the fallback arithmetic, which meant this display choice lived in
 * two places and moving one silently failed the other.
 */
export const DERIVED_VISUAL_ALTITUDE_LIFT = 1.5;

interface BeamSelectionSpec {
  beamId: number;
  role?: VizFrame['eventRoles'] extends Map<string, infer T> ? T : never;
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
  /**
   * S-cells-3: retire the UE-anchor for the sinr-live lane ONLY. When true the
   * serving/event beam groups are NOT translated to sit on the primary UE
   * (`anchorToUe` is forced off), so `satBeams` carry their true earth-fixed
   * ground positions and the lane's render no longer hides the off-axis. The
   * sinr-live caller passes `sceneLane === 'sinr-live'`; every other lane passes
   * `false` (or omits it) and keeps the steered-anchored render unchanged.
   */
  disableUeAnchor?: boolean,
): VizFrame {
  const previousDisplayIdsRef = useRef<Set<string>>(new Set());
  const previousEventIdsRef = useRef<Set<string>>(new Set());
  const latchedApproachBySatRef = useRef<Map<string, LatchedApproachState>>(new Map());
  const runtimeAppMode = runtime.appMode;
  const runtimePresentationMode = runtime.presentationMode;
  const runtimeBeamDensity = runtime.beamDensity;
  const runtimeViewport = runtime.viewport;

  return useMemo(() => {
    const beamFootprintMultiplier = visualScaleMultipliers?.beamFootprintMultiplier ?? 1.0;
    const alpha = geometry.visualAlpha ?? (runtimeAppMode === 'sinr-experiment' ? 0.64 : 1.0);
    const kmToWorldScale = geometry.kmPerWorldUnit !== undefined
      && Number.isFinite(geometry.kmPerWorldUnit)
      && geometry.kmPerWorldUnit > 0
      ? 1 / geometry.kmPerWorldUnit
      : null;
    const fallbackFootprintRadiusWorld = 350 * alpha * beamFootprintMultiplier;
    const firstShellLayout = geometry.shellLayouts.values().next().value as ShellVizLayout | undefined;
    const footprintRadiusWorld = firstShellLayout && kmToWorldScale !== null
      ? firstShellLayout.footprintRadiusKm * kmToWorldScale
      : fallbackFootprintRadiusWorld;
    const configuredVisualSatelliteAltitude =
      typeof geometry.visualSatelliteAltitude === 'number'
      && Number.isFinite(geometry.visualSatelliteAltitude)
      && geometry.visualSatelliteAltitude > 0
        ? geometry.visualSatelliteAltitude
        : null;
    const visualSatelliteAltitude = configuredVisualSatelliteAltitude
      ?? (kmToWorldScale !== null
        ? geometry.shellAltitudeKm * kmToWorldScale * DERIVED_VISUAL_ALTITUDE_LIFT
        : (runtimeAppMode === 'sinr-experiment' ? 600 : 900) * DERIVED_VISUAL_ALTITUDE_LIFT);
    // Rescales the sky-dome's vertical extent (SKY_DOME_V_RADIUS) up to the
    // configured visual altitude. The former bare `/ 400` magic literal hid
    // that this divisor IS the dome radius (see sceneScale.ts).
    const satPosScaleFactor = visualSatelliteAltitude / SKY_DOME_V_RADIUS;
    const footprintRadiusWorldForLayout = (layout: ShellVizLayout): number => (
      kmToWorldScale !== null
        ? layout.footprintRadiusKm * kmToWorldScale
        : fallbackFootprintRadiusWorld
    );
    const kmToWorldScaleForLayout = (layout: ShellVizLayout): number => (
      footprintRadiusWorldForLayout(layout) / Math.max(layout.footprintRadiusKm, 1e-6)
    );
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
    const satellites: VisibleSat[] = frame.satellites.map(s => {
      // S1 coordinate authority: project by the adapter-declared `worldFrame`
      // TYPE, not by guessing the frame from the coordinate magnitude.
      const world = projectSatelliteRenderWorld(
        s.worldPos,
        s.worldFrame,
        visualSatelliteAltitude,
        satPosScaleFactor,
      );
      return {
        id: s.id,
        shellId: s.shellId ?? '',
        altitudeKm: s.altitudeKm ?? geometry.shellAltitudeKm,
        world,
        topo: s.topo ?? { eastKm: 0, northKm: 0, upKm: 0, rangeKm: 0, azimuthDeg: 0, elevationDeg: 90 },
        latDeg: s.latDeg ?? 0,
        lonDeg: s.lonDeg ?? 0,
      };
    });

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
    const visualBeamColorSource: VisualBeamTarget['visualColorSource'] =
      beamFrequencyReuseCount <= 1 ? 'satellite' : 'frequency';
    // -------------------------------------------------------------------
    // End P1d local alias block.
    // -------------------------------------------------------------------

    // Resolve caps once per memoised pass, with upper-bound clamp.
    const {
      maxDisplaySats: MAX_DISPLAY_SATS,
      maxEventSats: MAX_EVENT_SATS,
      maxBeamSats: MAX_BEAM_SATS,
    } = resolveBeamVizDisplayCaps(displayCaps);
    const mode = runtimePresentationMode;
    const beamDensity = runtimeBeamDensity;
    const calloutCap = resolveConeBeamCalloutCap(beamDensity, runtimeViewport);
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

    const ueLoadByBeamKey = new Map<string, number>();
    for (const ue of frame.ues) {
      if (!ue.servingSatelliteId || ue.servingBeamId === '') continue;
      const beamId = Number(ue.servingBeamId);
      if (!Number.isFinite(beamId)) continue;
      const key = coneEntryKey(ue.servingSatelliteId, beamId);
      ueLoadByBeamKey.set(key, (ueLoadByBeamKey.get(key) ?? 0) + 1);
    }
    const maxBeamLoad = Math.max(1, ...ueLoadByBeamKey.values());

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
        satelliteTintColor: resolveSatelliteIdentityColor(sat.id, {}),
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

      const scale = kmToWorldScaleForLayout(layout);
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

      const scale = kmToWorldScaleForLayout(layout);
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
      // S-cells-3: on the sinr-live lane the UE-anchor is retired (the cell-truth
      // cones own that lane's beam render), so beams keep their true earth-fixed
      // ground positions and the UE renders off-centre.
      const anchorToUe =
        !disableUeAnchor
        && (sat.id === servingSatId
          || isPreparedTransitionSat(sat.id, relevantIds)
          || isRecentHoSourceSat(sat.id, relevantIds)
          || sat.id === recentHoTargetSatId
          || sat.id === committedInterEvent?.fromSatId
          || sat.id === committedInterEvent?.toSatId);
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
      const interTransition = frame.transitionProgress.inter;
      const intraTransitionTargetsSat = interTransition === undefined
        && intraTransition !== undefined
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
          visualColorSource: visualBeamColorSource,
          loadRatio: (ueLoadByBeamKey.get(coneEntryKey(sat.id, spec.beamId)) ?? 0) / maxBeamLoad,
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
      frame.transitionProgress.inter === undefined
      &&
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
        const scale = kmToWorldScaleForLayout(layout);
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
      // S5-2 cone-apex map: ALL projected sats (before the top-12 slice), so the
      // cell-cone render can place a cone apex for a serving sat beyond the
      // display cap (the connected-sat-has-beam must-hold). displaySats is
      // unchanged — this is a SEPARATE cone-only map, not a widened display set.
      coneApexWorldById: new Map(
        satellites.map(s => [s.id, { x: s.world.x, y: s.world.y, z: s.world.z }]),
      ),
      eventSatIds,
      eventRoles,
      beamSatIds,
      satBeams,
      ambientRings,
      visualFrequencyByBeamKey,
      sinrLabels,
      footprintRadiusWorld,
      intraHandoverEvent,
    };
  }, [
    latchedBeamSinrByKey,
    frame,
    geometry,
    runtimeAppMode,
    runtimePresentationMode,
    runtimeBeamDensity,
    runtimeViewport,
    displayCaps,
    beamHoppingConfig,
    visualScaleMultipliers,
    disableUeAnchor,
  ]);
}
