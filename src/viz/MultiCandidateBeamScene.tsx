import { useEffect, useLayoutEffect, useMemo, type JSX } from 'react';
import { Billboard, Html, Line } from '@react-three/drei';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';

import { resolveBaseIdentityColor } from '../appearance/resolveBeamAppearance';
import { resolveSatelliteIdentityColor } from '../appearance/resolveSatelliteAppearance';
import type {
  CandidatePresentationConeStyle,
  CandidatePresentationDataLinkStyle,
  CandidatePresentationFootprintStyle,
  CandidatePresentationRole,
} from '../engine/handover/candidatePresentationPlan';
import {
  candidateLinkKey,
  candidateLinkKeyString,
  type CandidateLinkKey,
} from '../engine/handover/candidateDecisionContract';
import {
  HANDOVER_VISUAL_IDENTITY_NEUTRAL_FALLBACK_COLOR,
  type HandoverBeamVisualIdentity,
  type HandoverSatelliteVisualIdentity,
} from '../constants/handoverVisualIdentity';
import { homepageSatelliteColorForBeam } from '../homepage/controller/homepageSatelliteVisualIdentity';
import {
  cellIdFromLinkBudgetBeamId,
} from '../scene/sinrLiveCellModel';
import type { WorldPoint } from './CellFootprints';
import {
  buildObliqueBeamConePositions,
  homepageBeamEeKey,
  type SinrLiveCellPlacement,
} from './SinrLiveCellBeamCones';
import type {
  MultiCandidateSceneIdentity,
  MultiCandidateSceneLinkInstruction,
  MultiCandidateScenePresentation,
} from '../scene/multiCandidateScenePresentation';
import type { CandidateSceneRenderReceipt } from '../scene/acceptedHandoverPresentationSnapshot';
import { resolveHomepageSatelliteDisplayName } from '../homepage/controller/homepageSatelliteDisplayName';

/** A renderer-neutral point in the shared scene coordinate system. */
export type MultiCandidateScenePoint = readonly [number, number, number];

export interface MultiCandidateBeamSceneResolverInput {
  readonly presentation: MultiCandidateScenePresentation;
  readonly placementByCellId: ReadonlyMap<number, SinrLiveCellPlacement>;
  readonly satelliteWorldById: ReadonlyMap<string, WorldPoint>;
  readonly primaryUeWorld: WorldPoint | MultiCandidateScenePoint;
  /** Display-only footprint scale; it never enters the decision or link budget. */
  readonly widthScale?: number;
  /** Reduced motion keeps the same static decision distinctions without pulses. */
  readonly reducedMotion?: boolean;
  /** Root-only compact identity projection; omitted consumers keep snapshot colours. */
  readonly homepageVisualIdentity?: boolean;
  /**
   * Optional frame-local EE normalization keyed exactly as `${satId}:${beamId}`.
   * The homepage integration owner in `MainScene` will provide this map; leaving
   * it omitted preserves the existing deterministic beam-slot colour fallback.
   */
  readonly homepageBeamEeByKey?: ReadonlyMap<string, number | null>;
  /** Episode-stable palette slots published by the accepted snapshot. */
  readonly homepageIdentityPaletteIndexBySatelliteId?: ReadonlyMap<string, number | null>;
  /** Exact active-TLE display names; raw IDs remain scene join keys. */
  readonly satelliteNameById?: ReadonlyMap<string, string> | null;
  /** Display-only intra cue: keep source/target ground footprints on the serving cell. */
  readonly anchorIntraCandidatesToServingCell?: boolean;
}

export interface MultiCandidateBeamSceneFootprintRing {
  readonly points: readonly MultiCandidateScenePoint[];
  readonly lineWidth: number;
  readonly opacity: number;
  readonly dashed: boolean;
  readonly dashSize: number;
  readonly gapSize: number;
}

export interface MultiCandidateBeamSceneRenderInstruction {
  /** Stable keys copied from the scene presentation adapter. */
  readonly joinKey: string;
  readonly sceneJoinKey: string;
  readonly railJoinKey: string;
  readonly pairKey: string;
  readonly key: CandidateLinkKey;
  readonly sourceFrameId: string;
  readonly satelliteId: string;
  readonly beamId: number;
  /** Recovered from the link-budget beam surrogate, never inferred from rank. */
  readonly cellId: number;
  readonly role: CandidatePresentationRole;
  readonly isServing: boolean;
  readonly isCandidate: boolean;
  /** Homepage-only display cue for the exact beam selected for handover. */
  readonly homepageTargetHighlight?: boolean;
  readonly isPinned: boolean;
  readonly satelliteIdentity: HandoverSatelliteVisualIdentity;
  readonly beamIdentity: HandoverBeamVisualIdentity | null;
  readonly identity: MultiCandidateSceneIdentity;
  readonly satelliteColor: string;
  readonly beamColor: string;
  readonly apex: MultiCandidateScenePoint;
  readonly baseCenter: MultiCandidateScenePoint;
  readonly cone: {
    readonly style: CandidatePresentationConeStyle;
    readonly visible: boolean;
    readonly volume: 0 | 1;
    readonly baseRadiusWorld: number;
    readonly color: string;
    readonly opacity: number;
    readonly wireframe: boolean;
  };
  readonly footprint: {
    readonly style: CandidatePresentationFootprintStyle;
    readonly visible: true;
    readonly points: readonly MultiCandidateScenePoint[];
    readonly rings: readonly MultiCandidateBeamSceneFootprintRing[];
    readonly outlineCount: 1 | 2;
    readonly color: string;
  };
  readonly link: {
    readonly style: CandidatePresentationDataLinkStyle;
    readonly visible: boolean;
    readonly points: readonly [MultiCandidateScenePoint, MultiCandidateScenePoint];
    readonly color: string;
    readonly dashed: boolean;
    readonly lineWidth: number;
    readonly opacity: number;
    readonly isSolidData: boolean;
    readonly isMeasurementOnly: boolean;
  };
  readonly endpoint: {
    readonly visible: boolean;
    readonly position: MultiCandidateScenePoint;
    readonly radiusWorld: number;
    readonly color: string;
    readonly hollow: boolean;
  };
  readonly label: {
    readonly text: string;
    readonly position: MultiCandidateScenePoint;
    readonly color: string;
  } | null;
  readonly reducedMotion: boolean;
}

export interface MultiCandidateBeamSceneTelemetry {
  readonly instructionCount: number;
  readonly renderedPairCount: number;
  readonly renderedSatelliteCount: number;
  readonly visibleConeVolumeCount: number;
  readonly solidDataLinkCount: 0 | 1;
  /**
   * Presentation instructions that could not be mapped to scene geometry.
   * These are diagnostic facts, not alternate decision results.
   */
  readonly unmappedPairs: readonly MultiCandidateBeamSceneUnmappedPair[];
  readonly maxSatelliteGroups: number;
  readonly maxConeVolumes: number;
}

export type MultiCandidateBeamSceneUnmappedReason =
  | 'missing-placement'
  | 'missing-satellite-world'
  | 'invalid-radius';

export interface MultiCandidateBeamSceneUnmappedPair {
  readonly satelliteId: string;
  readonly beamId: number;
  readonly sourceFrameId: string;
  readonly reason: MultiCandidateBeamSceneUnmappedReason;
}

export interface MultiCandidateBeamSceneRenderPlan {
  readonly instructions: readonly MultiCandidateBeamSceneRenderInstruction[];
  /** Actual pair count painted after the centre-stage density gate. */
  readonly centralRenderedPairCount: number;
  readonly coneVolumeCount: number;
  readonly solidDataLinkCount: 0 | 1;
  readonly unmappedPairs: readonly MultiCandidateBeamSceneUnmappedPair[];
  readonly telemetry: MultiCandidateBeamSceneTelemetry;
}

/** A rendered beam's explicit ground-cell join, kept beside the satellite badge. */
export interface MultiCandidateBeamCellPair {
  readonly beamId: number;
  /** Zero-based scene cell identity; labels expose the corresponding one-based C#. */
  readonly cellId: number;
}

export interface MultiCandidateSatelliteIdentityGroup {
  readonly satelliteId: string;
  readonly identityInstruction: MultiCandidateBeamSceneRenderInstruction;
  /** True when this satellite owns the committed/serving pair in the scene. */
  readonly isServingSatellite: boolean;
  /** True when at least one displayed pair is a candidate for this satellite. */
  readonly hasCandidatePairs: boolean;
  /** True when at least one displayed candidate has hard/qualified evidence. */
  readonly hasEligibleCandidatePairs: boolean;
  /** True when the displayed candidate set contains an observation-only pair. */
  readonly hasObservedCandidatePairs: boolean;
  /** True when one of the displayed candidate pairs is the provisional leader. */
  readonly hasProvisionalLeader: boolean;
  /** True when one of the displayed candidate pairs is the selected target. */
  readonly hasSelectedTarget: boolean;
  /** True when an inspection pin currently points into this satellite group. */
  readonly isPinnedSatellite: boolean;
  readonly candidatePairCount: number;
  readonly eligibleCandidatePairCount: number;
  readonly pairKeys: readonly string[];
  readonly sceneJoinKeys: readonly string[];
  readonly railJoinKeys: readonly string[];
  /** Beam IDs carrying the currently committed service link. */
  readonly servingBeamIds: readonly number[];
  /** Beam IDs shown as alternate candidate measurements for this satellite. */
  readonly candidateBeamIds: readonly number[];
  readonly beamIds: readonly number[];
  /** Exact beam/cell pairs represented by the group's displayed scene instructions. */
  readonly beamCellPairs: readonly MultiCandidateBeamCellPair[];
}

export interface MultiCandidateBeamSceneProps extends MultiCandidateBeamSceneResolverInput {
  readonly visible?: boolean;
  /**
   * The homepage mounts this layer as the sole centre-stage carrier while the
   * accepted comparison snapshot is active. Keeping the switch explicit lets
   * other consumers add only candidate geometry when they need the legacy
   * ambient carrier; the serving data link and join metadata remain here as
   * the single decision-authority read-out.
   */
  readonly renderServingConeAndFootprint?: boolean;
  /**
   * Candidate carrier geometry is intentionally opt-in.  The homepage uses a
   * single measured link per shortlisted satellite during the brief review
   * beat; the complete cone/footprint roster remains available in the rail and
   * accepted snapshot without painting a wire cage over the scene.
   */
  readonly renderCandidateCarrierGeometry?: boolean;
  /**
   * Candidate ground cells can be shown without painting a translucent cone.
   * This is the default review-stage cue: a dashed footprint says where the
   * measured beam lands while the existing serving cone remains unobstructed.
   */
  readonly renderCandidateFootprints?: boolean;
  /**
   * Restrict candidate cone/footprint painting to the existing selected or
   * provisional leader. This is display-only: the other candidate links and
   * satellite identity markers remain available as dashed/marker-only cues.
   * The homepage passes this explicitly; omitted consumers retain their
   * existing candidate-render switches.
   */
  readonly limitCandidateCarrierToLeader?: boolean;
  /** Display-only link-density gate; the accepted plan and rail remain complete. */
  readonly limitCandidateLinksToLeader?: boolean;
  /**
   * Keep the established service link owned by the legacy handover carrier
   * when this layer is used as an additive candidate read-out. Candidate
   * measurement links remain rendered regardless of this flag.
   */
  readonly renderServingDataLink?: boolean;
  /** Satellite identity halos are useful in the scene, while their HTML
   * badges are intentionally optional so a comparison beat never becomes a
   * stack of floating windows over the globe.
   */
  readonly renderSatelliteIdentityMarkers?: boolean;
  readonly renderSatelliteIdentityLabels?: boolean;
  /** Pair-level HTML labels are an inspection aid, not the default scene UI. */
  readonly renderPairLabels?: boolean;
  /** Presentation-only inspection; it never feeds the decision engine. */
  readonly onCandidateSelect?: (key: CandidateLinkKey) => void;
  /** Actual mapping acknowledgement for the same accepted publication. */
  readonly renderReceipt?: CandidateSceneRenderReceipt | null;
}

export const MULTI_CANDIDATE_SCENE_TELEMETRY_KEYS = Object.freeze({
  instructionCount: 'multiCandidateSceneInstructionCount',
  renderedPairCount: 'multiCandidateSceneRenderedPairCount',
  satelliteCount: 'multiCandidateSceneSatelliteCount',
  satelliteIdentityColors: 'multiCandidateSceneSatelliteIdentityColors',
  coneVolumeCount: 'multiCandidateSceneConeVolumeCount',
  solidDataLinkCount: 'multiCandidateSceneSolidDataLinkCount',
  unmappedPairCount: 'multiCandidateSceneUnmappedPairCount',
  unmappedPairs: 'multiCandidateSceneUnmappedPairs',
  acceptedSnapshotId: 'multiCandidateSceneAcceptedSnapshotId',
  acceptedSourceFrameId: 'multiCandidateSceneAcceptedSourceFrameId',
  renderedSceneJoinKeys: 'multiCandidateSceneRenderedSceneJoinKeys',
  eventCueCount: 'multiCandidateSceneEventCueCount',
  /** Actual pair count painted in the centre after the display-density gate. */
  centralRenderedPairCount: 'multiCandidateSceneCentralRenderedPairCount',
});

const GROUND_FOOTPRINT_Y = 0.12;
const FOOTPRINT_OUTER_SCALE = 1.055;
const HEX_SIDE_COUNT = 6;
const ENDPOINT_RADIUS_WORLD = 2.2;
/**
 * Satellite identity markers intentionally use a much larger visual scale
 * than the old single ring. The centre-stage camera is shared with the live
 * satellite models, so the marker must be legible at the normal 1680x1050
 * composition without moving that camera.
 */
const SATELLITE_IDENTITY_HALO_SEGMENTS = 48;
const SATELLITE_SERVING_HALO_INNER_RADIUS_WORLD = 12;
const SATELLITE_SERVING_HALO_OUTER_RADIUS_WORLD = 16;
const SATELLITE_OBSERVED_HALO_INNER_RADIUS_WORLD = 14;
const SATELLITE_OBSERVED_HALO_OUTER_RADIUS_WORLD = 18;
// Keep the candidate ring a cue around the GLB rather than a large disc that
// competes with its identity label.  The label is owned by SatelliteMarker and
// is lifted above the ring in MainScene.
const SATELLITE_CANDIDATE_HALO_INNER_RADIUS_WORLD = 13;
const SATELLITE_CANDIDATE_HALO_OUTER_RADIUS_WORLD = 18;
/**
 * Satellite labels stay over their own spacecraft projection.  Earlier
 * versions pushed lanes horizontally by a fixed world-space distance; that
 * made a valid label leave the narrow centre-stage viewport whenever the
 * satellite was near an edge.  Reading lanes vertically is deterministic and
 * keeps the identity attached to the moving GLB instead of to an arbitrary
 * screen-side offset.
 */
// Keep the badge directly above the GLB.  Earlier versions used a world-space
// left/centre/right ladder here; at the homepage camera that detached the
// candidate window from its spacecraft and made it look like a floating panel
// in the middle of the scene.  Close projections are separated by the
// screen-space Y ladder below, so no horizontal world offset is needed.
const SATELLITE_LABEL_LANE_OFFSET_WORLD = 0;
const SATELLITE_LABEL_LANE_BAND_OFFSET_WORLD = 10;
// A 64px ladder still collided at the narrow 1366px acceptance viewport when
// two Walker spacecraft projected within one label-height of one another.
// Keep the ladder screen-space (marker/beam/camera remain untouched) and give
// each satellite identity badge enough vertical separation to be read as a
// distinct candidate at the default scene scale.
const SATELLITE_LABEL_SCREEN_LANE_GAP_PX = 26;
// Keep the badge close to its spacecraft.  The earlier 82px baseline was
// added to compensate for a world-space -100 offset; once the badge is
// anchored beside the GLB it pushed the identity far below the satellite and
// made the scene-to-label relationship impossible to read.  A positive ladder
// starts below the canvas seam, which matters on the compact 780px acceptance
// viewport where a centred lane-0 badge would otherwise clip at the top.
const SATELLITE_LABEL_SCREEN_BASE_OFFSET_PX = 4;
/**
 * Raw triangle-mesh wireframe exposes every fan edge and turns an oblique beam
 * into a dense visual cage. Three ribs keep the measurement-only volume
 * legible without competing with the single solid serving link.
 */
export const MULTI_CANDIDATE_WIREFRAME_RIB_COUNT = 3;

/**
 * The rail keeps the complete measured beam roster, but the centre stage is a
 * visual explanation rather than a beam inventory.  Showing one representative
 * pair per candidate satellite is enough to answer "which spacecrafts are in
 * contention?" while keeping the established serving field visible.  The
 * representative is chosen from the same role/rank ordering as the accepted
 * presentation plan; it never re-ranks or changes the decision.
 */
export const MAX_CENTRAL_CANDIDATE_PAIRS_PER_SATELLITE = 1 as const;

/**
 * A normal comparison scene should communicate a small shortlist, not paint
 * every measured spacecraft in the constellation.  The rail still retains
 * the complete accepted measurement/qualification roster; this cap applies
 * only to the central visual layer and keeps the service satellite plus at
 * most two alternate candidate satellites readable at once.
 */
export const MAX_CENTRAL_CANDIDATE_SATELLITES = 2 as const;

/**
 * Deterministic outer-edge slots for different satellite/beam identities that
 * map to the same ground cell. Keeping the badges around the hex perimeter is
 * both more legible and more truthful than stacking them above the UE.
 */
const CANDIDATE_LABEL_SLOT_AZIMUTH_DEG = Object.freeze([90, -30, 210, 30, 150, 270] as const);

/**
 * Keep the one satellite badge per displayed satellite readable when the
 * projected spacecraft positions are close. Lanes are offsets in the
 * Billboard's camera plane, so this does not move the camera or the marker
 * itself and remains deterministic across frames.
 */
export function resolveSatelliteIdentityLabelPosition(
  satelliteLane: number,
  satelliteLaneCount: number,
): MultiCandidateScenePoint {
  if (!Number.isInteger(satelliteLane) || satelliteLane < 0) {
    fail('satellite label lane must be a non-negative integer');
  }
  if (!Number.isInteger(satelliteLaneCount) || satelliteLaneCount < 1) {
    fail('satellite label lane count must be a positive integer');
  }
  const laneCount = Math.min(3, satelliteLaneCount);
  const lane = satelliteLane % 3;
  const laneCenter = (laneCount - 1) / 2;
  const band = Math.floor(satelliteLane / 3);
  return Object.freeze([
    (lane - laneCenter) * SATELLITE_LABEL_LANE_OFFSET_WORLD || 0,
    // Place the badge just above its own spacecraft.  A small per-band lift
    // separates any fourth-or-later group without moving the satellite, beam,
    // footprint, or camera pose.
    // The GLB carrier is scaled independently of this HTML badge.  Ten world
    // units keeps the badge in the same visual neighbourhood as the model at
    // the homepage camera; the old 20-unit lift made it read like a panel in
    // the middle of the canvas rather than an identity attached to a satellite.
    10 + band * SATELLITE_LABEL_LANE_BAND_OFFSET_WORLD,
    0,
  ] as const);
}

/**
 * Clamp an identity badge's visual centre to the R3F canvas without moving
 * its spacecraft anchor. `projectedNdcX` is the camera projection of the
 * satellite apex; the returned pixel delta is applied only to the HTML badge.
 */
export function resolveSatelliteIdentityLabelHorizontalCorrection(
  projectedNdcX: number,
  viewportWidth: number,
  labelMaxWidth = 300,
  edgeInset = 12,
): number {
  if (!Number.isFinite(projectedNdcX)) fail('projected label x must be finite');
  if (!Number.isFinite(viewportWidth) || viewportWidth <= 0) {
    fail('label viewport width must be positive');
  }
  if (!Number.isFinite(labelMaxWidth) || labelMaxWidth <= 0) {
    fail('label max width must be positive');
  }
  if (!Number.isFinite(edgeInset) || edgeInset < 0) {
    fail('label edge inset must be non-negative');
  }
  const projectedPx = ((projectedNdcX + 1) / 2) * viewportWidth;
  const availableWidth = Math.max(0, viewportWidth - edgeInset * 2);
  const labelWidth = Math.min(labelMaxWidth, availableWidth);
  if (labelWidth <= 0) return 0;
  const halfWidth = labelWidth / 2;
  const minCenter = halfWidth + edgeInset;
  const maxCenter = Math.max(minCenter, viewportWidth - halfWidth - edgeInset);
  const clampedCenter = Math.min(maxCenter, Math.max(minCenter, projectedPx));
  return clampedCenter - projectedPx;
}

export function resolveCandidateLabelPosition(
  instruction: MultiCandidateBeamSceneRenderInstruction,
  candidateLane: number,
  satelliteBiasLane = 0,
): MultiCandidateScenePoint {
  if (!Number.isInteger(candidateLane) || candidateLane < 0) {
    fail('candidate label lane must be a non-negative integer');
  }
  if (!instruction.isCandidate || instruction.label === null) {
    return instruction.label?.position ?? instruction.baseCenter;
  }
  if (!Number.isInteger(satelliteBiasLane)) {
    fail('candidate satellite label bias lane must be an integer');
  }
  const slot = candidateLane % CANDIDATE_LABEL_SLOT_AZIMUTH_DEG.length;
  const ring = Math.floor(candidateLane / CANDIDATE_LABEL_SLOT_AZIMUTH_DEG.length);
  const azimuthRad = CANDIDATE_LABEL_SLOT_AZIMUTH_DEG[slot]! * Math.PI / 180;
  const distance = instruction.cone.baseRadiusWorld * (1.16 + ring * 0.24);
  return Object.freeze([
    instruction.baseCenter[0]
      + Math.cos(azimuthRad) * distance
      + satelliteBiasLane * instruction.cone.baseRadiusWorld * 0.62,
    GROUND_FOOTPRINT_Y + 12 + ring * 5,
    instruction.baseCenter[2] + Math.sin(azimuthRad) * distance,
  ] as const);
}

interface RoleVisualStyle {
  readonly coneOpacity: number;
  readonly footprintLineWidth: number;
  readonly footprintOpacity: number;
  readonly footprintDashSize: number;
  readonly footprintGapSize: number;
  readonly footprintOutlineCount: 1 | 2;
  readonly linkLineWidth: number;
  readonly linkOpacity: number;
}

type MultiCandidateBeamSceneMappingResult =
  | MultiCandidateBeamSceneRenderInstruction
  | MultiCandidateBeamSceneUnmappedPair;

function fail(message: string): never {
  throw new TypeError(`multi-candidate beam scene: ${message}`);
}

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) fail(`${label} must be finite`);
  return value;
}

function pointFromWorld(world: WorldPoint | MultiCandidateScenePoint, label: string): MultiCandidateScenePoint {
  if (Array.isArray(world)) {
    if (world.length !== 3) fail(`${label} must contain three coordinates`);
    return [finite(world[0]!, `${label}.x`), finite(world[1]!, `${label}.y`), finite(world[2]!, `${label}.z`)];
  }
  if ('x' in world && 'y' in world && 'z' in world) {
    return [finite(world.x, `${label}.x`), finite(world.y, `${label}.y`), finite(world.z, `${label}.z`)];
  }
  fail(`${label} must be a world point or a three-coordinate tuple`);
}

function normalizedWidthScale(value: number | undefined): number {
  if (value === undefined) return 1;
  if (!Number.isFinite(value)) fail('widthScale must be finite');
  return Math.max(0, value);
}

function samePoint(a: MultiCandidateScenePoint, b: MultiCandidateScenePoint): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

function unmappedPair(
  source: MultiCandidateSceneLinkInstruction,
  sourceFrameId: string,
  reason: MultiCandidateBeamSceneUnmappedReason,
): MultiCandidateBeamSceneUnmappedPair {
  return Object.freeze({
    satelliteId: source.satelliteId,
    beamId: source.beamId,
    sourceFrameId,
    reason,
  });
}

export function buildSparseMultiCandidateConeRibs(
  instruction: MultiCandidateBeamSceneRenderInstruction,
  requestedCount: number = MULTI_CANDIDATE_WIREFRAME_RIB_COUNT,
): readonly (readonly [MultiCandidateScenePoint, MultiCandidateScenePoint])[] {
  if (!Number.isInteger(requestedCount) || requestedCount < 1) {
    fail('wireframe rib count must be a positive integer');
  }
  const footprint = instruction.footprint.points;
  if (footprint.length === 0) return Object.freeze([]);
  const uniquePointCount = footprint.length > 1 && samePoint(footprint[0]!, footprint[footprint.length - 1]!)
    ? footprint.length - 1
    : footprint.length;
  const ribCount = Math.min(requestedCount, uniquePointCount);
  return Object.freeze(Array.from({ length: ribCount }, (_, index) => {
    const footprintIndex = Math.floor((index * uniquePointCount) / ribCount);
    return Object.freeze([
      instruction.apex,
      footprint[footprintIndex]!,
    ] as const);
  }));
}

function roleVisualStyle(
  role: CandidatePresentationRole,
  isPinned: boolean,
  exposedMeasurementCue: boolean,
): RoleVisualStyle {
  switch (role) {
    case 'serving':
    case 'committed-serving':
      return {
        coneOpacity: 0.34,
        footprintLineWidth: 2.1,
        footprintOpacity: 0.82,
        footprintDashSize: 0,
        footprintGapSize: 0,
        footprintOutlineCount: 1,
        linkLineWidth: 2.4,
        linkOpacity: 0.88,
      };
    case 'observed':
      if (isPinned) {
        return {
          coneOpacity: 0.36,
          footprintLineWidth: 2,
          footprintOpacity: 0.82,
          footprintDashSize: 3.8,
          footprintGapSize: 2.8,
          footprintOutlineCount: 1,
          linkLineWidth: 1.9,
          linkOpacity: 0.86,
        };
      }
      if (exposedMeasurementCue) {
        return {
          coneOpacity: 0.22,
          footprintLineWidth: 1.5,
          footprintOpacity: 0.62,
          footprintDashSize: 2.4,
          footprintGapSize: 3.2,
          footprintOutlineCount: 1,
          linkLineWidth: 1.35,
          linkOpacity: 0.62,
        };
      }
      return {
        coneOpacity: 0,
        footprintLineWidth: 2,
        footprintOpacity: 0.72,
        footprintDashSize: 2.6,
        footprintGapSize: 3.2,
        footprintOutlineCount: 1,
        linkLineWidth: 0,
        linkOpacity: 0,
      };
    case 'qualified':
      return {
        coneOpacity: 0.16,
        footprintLineWidth: 1.7,
        footprintOpacity: 0.62,
        footprintDashSize: 4.5,
        footprintGapSize: 3.2,
        footprintOutlineCount: 1,
        linkLineWidth: 1.45,
        linkOpacity: 0.68,
      };
    case 'hard-eligible':
      return {
        coneOpacity: 0.12,
        footprintLineWidth: 1.7,
        footprintOpacity: 0.68,
        footprintDashSize: 3.4,
        footprintGapSize: 3.6,
        footprintOutlineCount: 1,
        linkLineWidth: 1.3,
        linkOpacity: 0.6,
      };
    case 'provisional-leader':
      return {
        coneOpacity: 0.26,
        footprintLineWidth: 2.25,
        footprintOpacity: 0.9,
        footprintDashSize: 5.5,
        footprintGapSize: 3.2,
        footprintOutlineCount: 2,
        linkLineWidth: 1.75,
        linkOpacity: 0.82,
      };
    case 'selected-target':
      return {
        coneOpacity: 0.16,
        footprintLineWidth: 2.1,
        footprintOpacity: 0.84,
        footprintDashSize: 6,
        footprintGapSize: 3.5,
        footprintOutlineCount: 2,
        linkLineWidth: 1.7,
        linkOpacity: 0.78,
      };
  }
}

function scaledFootprintPoints(
  points: readonly MultiCandidateScenePoint[],
  center: MultiCandidateScenePoint,
  scale: number,
): readonly MultiCandidateScenePoint[] {
  return points.map(point => [
    center[0] + (point[0] - center[0]) * scale,
    point[1],
    center[2] + (point[2] - center[2]) * scale,
  ] as const);
}

function buildHexFootprintPoints(
  center: MultiCandidateScenePoint,
  radiusWorld: number,
): readonly MultiCandidateScenePoint[] {
  return Object.freeze(Array.from({ length: HEX_SIDE_COUNT + 1 }, (_, index) => {
    const angle = Math.PI / 6 + (index % HEX_SIDE_COUNT) * Math.PI / 3;
    return [
      center[0] + Math.cos(angle) * radiusWorld,
      GROUND_FOOTPRINT_Y,
      center[2] + Math.sin(angle) * radiusWorld,
    ] as const;
  }));
}

function buildFootprintRings(
  points: readonly MultiCandidateScenePoint[],
  center: MultiCandidateScenePoint,
  style: RoleVisualStyle,
  dashed: boolean,
): readonly MultiCandidateBeamSceneFootprintRing[] {
  const inner = Object.freeze({
    points,
    lineWidth: style.footprintLineWidth,
    opacity: style.footprintOpacity,
    dashed,
    dashSize: style.footprintDashSize,
    gapSize: style.footprintGapSize,
  });
  if (style.footprintOutlineCount === 1) return Object.freeze([inner]);
  const outer = Object.freeze({
    points: scaledFootprintPoints(points, center, FOOTPRINT_OUTER_SCALE),
    lineWidth: Math.max(1, style.footprintLineWidth - 0.75),
    opacity: style.footprintOpacity * 0.72,
    dashed,
    dashSize: style.footprintDashSize,
    gapSize: style.footprintGapSize,
  });
  return Object.freeze([outer, inner]);
}

function acceptedMultiCandidateBeamColor(
  source: MultiCandidateSceneLinkInstruction,
): string {
  if (source.identity.beam !== null) return source.identity.beam.threeColor;
  return source.identity.satellite.threeColor;
}

function homepageMultiCandidateBeamColor(
  source: MultiCandidateSceneLinkInstruction,
  homepageBeamEeByKey: ReadonlyMap<string, number | null> | undefined,
  homepageIdentityPaletteIndexBySatelliteId: ReadonlyMap<string, number | null> | undefined,
): string {
  return homepageSatelliteColorForBeam(source.satelliteId, source.beamId, {
    identityPaletteIndex: homepageIdentityPaletteIndexBySatelliteId?.get(source.satelliteId) ?? null,
    isServing: source.isServing,
    eeNormalized: homepageBeamEeByKey?.get(
      homepageBeamEeKey(source.satelliteId, source.beamId),
    ),
  }).color;
}

function homepageMultiCandidateSatelliteColor(
  source: MultiCandidateSceneLinkInstruction,
  homepageIdentityPaletteIndexBySatelliteId: ReadonlyMap<string, number | null> | undefined,
): string {
  return homepageSatelliteColorForBeam(source.satelliteId, source.beamId, {
    identityPaletteIndex: homepageIdentityPaletteIndexBySatelliteId?.get(source.satelliteId) ?? null,
    isServing: source.isServing,
  }).baseColor;
}

/**
 * The scene supplies accepted-snapshot and homepage adapters; the appearance
 * ladder owns which identity source wins. Keeping this adapter here preserves
 * the scene's existing homepage serving flag and exact EE key.
 */
function resolveMultiCandidateBeamIdentityColor(
  source: MultiCandidateSceneLinkInstruction,
  homepageVisualIdentity: boolean,
  homepageBeamEeByKey: ReadonlyMap<string, number | null> | undefined,
  homepageIdentityPaletteIndexBySatelliteId: ReadonlyMap<string, number | null> | undefined,
): string {
  return resolveBaseIdentityColor(
    source.satelliteId,
    source.beamId,
    {
      homepageColorFor: homepageVisualIdentity
        ? () => homepageMultiCandidateBeamColor(
          source,
          homepageBeamEeByKey,
          homepageIdentityPaletteIndexBySatelliteId,
        )
        : undefined,
      acceptedColorFor: () => acceptedMultiCandidateBeamColor(source),
    },
    { isServingOrCandidate: source.isServing },
  );
}

function resolveMultiCandidateSatelliteIdentityColor(
  source: MultiCandidateSceneLinkInstruction,
  homepageVisualIdentity: boolean,
  homepageIdentityPaletteIndexBySatelliteId: ReadonlyMap<string, number | null> | undefined,
): string {
  return resolveSatelliteIdentityColor(source.satelliteId, {
    homepageColorFor: homepageVisualIdentity
      ? () => homepageMultiCandidateSatelliteColor(
        source,
        homepageIdentityPaletteIndexBySatelliteId,
      )
      : undefined,
    acceptedColorFor: () => source.identity.satellite.threeColor,
  });
}

function mapPresentationInstruction(
  source: MultiCandidateSceneLinkInstruction,
  placementByCellId: ReadonlyMap<number, SinrLiveCellPlacement>,
  satelliteWorldById: ReadonlyMap<string, WorldPoint>,
  sourceFrameId: string,
  primaryUeWorld: MultiCandidateScenePoint,
  widthScale: number,
  reducedMotion: boolean,
  homepageVisualIdentity: boolean,
  homepageBeamEeByKey: ReadonlyMap<string, number | null> | undefined,
  homepageIdentityPaletteIndexBySatelliteId: ReadonlyMap<string, number | null> | undefined,
  anchorCellId: number | null,
): MultiCandidateBeamSceneMappingResult {
  const expectedPairKey = candidateLinkKeyString(source.key);
  if (source.pairKey !== expectedPairKey
    || source.key.satelliteId !== source.satelliteId
    || source.key.beamId !== source.beamId) {
    fail(`displayed pair is not joined by satellite and beam: ${source.joinKey}`);
  }
  if (source.sourceFrameId !== sourceFrameId) {
    fail(`source-frame mismatch for ${expectedPairKey}`);
  }
  if (source.isServing === source.isCandidate) {
    fail(`displayed pair must be exactly serving or candidate: ${expectedPairKey}`);
  }
  if (source.isCandidate && source.link.isSolidData) {
    fail(`candidate cannot emit a solid data link: ${expectedPairKey}`);
  }
  if (source.isCandidate && !source.link.isMeasurementOnly) {
    fail(`candidate must remain measurement-only: ${expectedPairKey}`);
  }

  // The Walker cell surrogate is the only supported scene mapping in this
  // lane.  Never use rank, array position, or a satellite-only fallback to
  // fabricate a footprint.
  const cellId = cellIdFromLinkBudgetBeamId(source.beamId);
  const sourcePlacement = placementByCellId.get(cellId);
  const placement = anchorCellId === null
    ? sourcePlacement
    : placementByCellId.get(anchorCellId) ?? sourcePlacement;
  const satelliteWorld = satelliteWorldById.get(source.satelliteId);
  // Validate the source beam's real cell first. The shared-cell anchor is only
  // a presentation override; it must never make an invalid pair drawable.
  if (!sourcePlacement || !placement) return unmappedPair(source, sourceFrameId, 'missing-placement');
  if (!satelliteWorld) return unmappedPair(source, sourceFrameId, 'missing-satellite-world');
  const satellite = pointFromWorld(satelliteWorld, `satellite ${source.satelliteId}`);
  const baseCenter: MultiCandidateScenePoint = [placement.worldX, 0, placement.worldZ];
  const radiusWorld = placement.radiusWorld * widthScale;
  if (!Number.isFinite(radiusWorld) || !(radiusWorld > 0)) {
    return unmappedPair(source, sourceFrameId, 'invalid-radius');
  }

  // The established homepage uses six-sided ground cells. Candidate authority
  // changes identity colour and line grammar, not the footprint shape.
  const footprintPoints = buildHexFootprintPoints(baseCenter, radiusWorld);
  // An unqualified observation stays a neutral dotted footprint. Pinning may
  // add its identity-coloured sparse guide without changing serving authority.
  const roleStyle = roleVisualStyle(
    source.role,
    source.isPinned,
    source.cone.style === 'wireframe' && source.cone.visible,
  );
  const footprintDashed = source.footprint.style !== 'solid';
  const coneVisible = source.cone.visible && source.cone.volume === 1;
  const coneColor = resolveMultiCandidateBeamIdentityColor(
    source,
    homepageVisualIdentity,
    homepageBeamEeByKey,
    homepageIdentityPaletteIndexBySatelliteId,
  );
  const satelliteColor = resolveMultiCandidateSatelliteIdentityColor(
    source,
    homepageVisualIdentity,
    homepageIdentityPaletteIndexBySatelliteId,
  );
  const footprintColor = source.role === 'observed' && !source.isPinned
    ? HANDOVER_VISUAL_IDENTITY_NEUTRAL_FALLBACK_COLOR
    : coneColor;
  const linkVisible = source.link.style !== 'none';
  const solidData = source.link.isSolidData;
  const linkDashed = linkVisible && !solidData;
  const label = Object.freeze({
    // Produced once by CandidatePresentationPlan and consumed verbatim here
    // and in the right rail; colour is never the only join cue.
    text: source.displayKey,
    position: [
      baseCenter[0],
      GROUND_FOOTPRINT_Y + 11,
      baseCenter[2] + radiusWorld * 0.72,
    ] as const,
    color: coneColor,
  });

  return Object.freeze({
    joinKey: source.joinKey,
    sceneJoinKey: source.sceneJoinKey,
    railJoinKey: source.railJoinKey,
    pairKey: expectedPairKey,
    key: candidateLinkKey(source.key.satelliteId, source.key.beamId),
    sourceFrameId,
    satelliteId: source.satelliteId,
    beamId: source.beamId,
    cellId,
    role: source.role,
    isServing: source.isServing,
    isCandidate: source.isCandidate,
    homepageTargetHighlight: homepageVisualIdentity
      && source.isCandidate
      && (source.role === 'provisional-leader' || source.role === 'selected-target'),
    isPinned: source.isPinned,
    satelliteIdentity: source.satelliteIdentity,
    beamIdentity: source.beamIdentity,
    identity: source.identity,
    satelliteColor,
    beamColor: coneColor,
    apex: satellite,
    baseCenter,
    cone: Object.freeze({
      style: source.cone.style,
      visible: coneVisible,
      volume: coneVisible ? 1 : 0,
      baseRadiusWorld: radiusWorld,
      color: coneColor,
      opacity: coneVisible ? roleStyle.coneOpacity : 0,
      wireframe: source.cone.style === 'wireframe',
    }),
    footprint: Object.freeze({
      style: source.footprint.style,
      visible: true,
      points: footprintPoints,
      rings: buildFootprintRings(footprintPoints, baseCenter, roleStyle, footprintDashed),
      outlineCount: roleStyle.footprintOutlineCount,
      color: footprintColor,
    }),
    link: Object.freeze({
      style: source.link.style,
      visible: linkVisible,
      points: [primaryUeWorld, satellite] as const,
      color: coneColor,
      dashed: linkDashed,
      lineWidth: linkVisible ? roleStyle.linkLineWidth : 0,
      opacity: linkVisible ? roleStyle.linkOpacity : 0,
      isSolidData: solidData,
      isMeasurementOnly: source.link.isMeasurementOnly,
    }),
    endpoint: Object.freeze({
      visible: source.isCandidate && linkVisible,
      position: primaryUeWorld,
      radiusWorld: ENDPOINT_RADIUS_WORLD,
      color: coneColor,
      hollow: source.isCandidate,
    }),
    label,
    reducedMotion,
  });
}

/**
 * Resolve the plan into geometry and style instructions for the independent
 * R3F renderer.  The resolver is presentation-only: it consumes the plan's
 * already bounded links and does not recalculate, rank, or mutate any
 * scientific evidence.
 */
export function resolveMultiCandidateBeamScene(
  input: MultiCandidateBeamSceneResolverInput,
): MultiCandidateBeamSceneRenderPlan {
  if (input.presentation === null || typeof input.presentation !== 'object') {
    fail('presentation must be an object');
  }
  const widthScale = normalizedWidthScale(input.widthScale);
  const reducedMotion = input.reducedMotion === true;
  const primaryUeWorld = pointFromWorld(input.primaryUeWorld, 'primaryUeWorld');
  const seenPairs = new Set<string>();
  const mapped: MultiCandidateBeamSceneRenderInstruction[] = [];
  const unmappedPairs: MultiCandidateBeamSceneUnmappedPair[] = [];
  const servingInstruction = input.presentation.serving;
  const servingCellId = servingInstruction === null
    ? null
    : cellIdFromLinkBudgetBeamId(servingInstruction.beamId);
  for (const source of input.presentation.instructions) {
    const pairKey = candidateLinkKeyString(source.key);
    if (seenPairs.has(pairKey)) fail(`duplicate displayed pair ${pairKey}`);
    seenPairs.add(pairKey);
    const anchorCellId = input.anchorIntraCandidatesToServingCell === true
      && source.isCandidate
      && servingInstruction !== null
      && source.satelliteId === servingInstruction.satelliteId
      && servingCellId !== null
      ? servingCellId
      : null;
    const instruction = mapPresentationInstruction(
      source,
      input.placementByCellId,
      input.satelliteWorldById,
      input.presentation.sourceFrameId,
      primaryUeWorld,
      widthScale,
      reducedMotion,
      input.homepageVisualIdentity === true,
      input.homepageBeamEeByKey,
      input.homepageIdentityPaletteIndexBySatelliteId,
      anchorCellId,
    );
    if ('reason' in instruction) unmappedPairs.push(instruction);
    else mapped.push(instruction);
  }
  const instructions = Object.freeze(mapped);
  const unmapped = Object.freeze(unmappedPairs);
  const renderedSatelliteCount = new Set(
    instructions.map(instruction => instruction.satelliteId),
  ).size;
  if (renderedSatelliteCount > input.presentation.budget.maxSatelliteGroups) {
    fail(
      `visible satellite budget exceeded: ${renderedSatelliteCount} > ${input.presentation.budget.maxSatelliteGroups}`,
    );
  }
  const coneVolumeCount = instructions.reduce((count, instruction) => count + instruction.cone.volume, 0);
  if (coneVolumeCount > input.presentation.budget.maxConeVolumes) {
    fail(
      `visible cone volume budget exceeded: ${coneVolumeCount} > ${input.presentation.budget.maxConeVolumes}`,
    );
  }
  const solidDataLinkCount = instructions.reduce(
    (count, instruction) => count + (instruction.link.isSolidData ? 1 : 0),
    0,
  );
  if (solidDataLinkCount > 1) fail(`more than one solid data link: ${solidDataLinkCount}`);
  const telemetry: MultiCandidateBeamSceneTelemetry = Object.freeze({
    instructionCount: input.presentation.instructions.length,
    renderedPairCount: instructions.length,
    renderedSatelliteCount,
    visibleConeVolumeCount: coneVolumeCount,
    solidDataLinkCount: solidDataLinkCount as 0 | 1,
    unmappedPairs: unmapped,
    maxSatelliteGroups: input.presentation.budget.maxSatelliteGroups,
    maxConeVolumes: input.presentation.budget.maxConeVolumes,
  });
  const centralInstructions = input.homepageVisualIdentity === true
    ? selectHomepageCandidateSceneInstructions(instructions)
    : selectCentralMultiCandidateSceneInstructions(instructions);
  return Object.freeze({
    instructions,
    centralRenderedPairCount: centralInstructions.length,
    coneVolumeCount,
    solidDataLinkCount: solidDataLinkCount as 0 | 1,
    unmappedPairs: unmapped,
    telemetry,
  });
}

function MultiCandidateConeMesh({
  instruction,
}: {
  readonly instruction: MultiCandidateBeamSceneRenderInstruction;
}): JSX.Element {
  const geometry = useMemo(() => {
    const positions = buildObliqueBeamConePositions(
      new THREE.Vector3(...instruction.apex),
      new THREE.Vector3(...instruction.baseCenter),
      instruction.cone.baseRadiusWorld,
    );
    const next = new THREE.BufferGeometry();
    next.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    next.computeBoundingSphere();
    return next;
  }, [instruction]);
  const sparseRibs = useMemo(
    // Wireframe candidates are measurement-only geometry. Keep the familiar
    // cone axis, but replace the filled translucent wedge with a bounded set
    // of ribs so several candidates remain legible at once.
    () => instruction.cone.wireframe
      ? buildSparseMultiCandidateConeRibs(instruction)
      : Object.freeze([]),
    [instruction],
  );
  const renderFilledVolume = !instruction.cone.wireframe;

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <group name={`multi-candidate-cone-group-${instruction.satelliteId}-b${instruction.beamId}`}>
      {renderFilledVolume && (
        <mesh
          geometry={geometry}
          name={`multi-candidate-cone-${instruction.satelliteId}-b${instruction.beamId}`}
          renderOrder={10}
          frustumCulled={false}
          userData={{
            pairKey: instruction.pairKey,
            joinKey: instruction.joinKey,
            sceneJoinKey: instruction.sceneJoinKey,
            railJoinKey: instruction.railJoinKey,
            satelliteId: instruction.satelliteId,
            beamId: instruction.beamId,
            cellId: instruction.cellId,
            role: instruction.role,
            isServing: instruction.isServing,
            isCandidate: instruction.isCandidate,
            isPinned: instruction.isPinned,
            isProvisionalLeader: instruction.role === 'provisional-leader',
            isSelectedTarget: instruction.role === 'selected-target',
            isSolidData: instruction.link.isSolidData,
            isMeasurementOnly: instruction.link.isMeasurementOnly,
            coneStyle: instruction.cone.style,
            coneVolume: instruction.cone.volume,
            color: instruction.cone.color,
            satelliteColor: instruction.satelliteColor,
            beamColor: instruction.beamColor,
            reducedMotion: instruction.reducedMotion,
            sparseWireframeRibCount: sparseRibs.length,
          }}
        >
          <meshBasicMaterial
            color={instruction.cone.color}
            transparent
            opacity={instruction.cone.opacity}
            wireframe={false}
            depthWrite={false}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
      )}
      {sparseRibs.map((points, index) => (
        <Line
          key={`${instruction.sceneJoinKey}/wireframe-rib/${index}`}
          name={`multi-candidate-cone-rib-${instruction.satelliteId}-b${instruction.beamId}-${index}`}
          points={points}
          color={instruction.cone.color}
          lineWidth={1.6}
          transparent
          opacity={Math.min(0.82, Math.max(0.62, instruction.cone.opacity * 2.4))}
          depthWrite={false}
          renderOrder={11}
          userData={{
            pairKey: instruction.pairKey,
            joinKey: instruction.joinKey,
            sceneJoinKey: instruction.sceneJoinKey,
            railJoinKey: instruction.railJoinKey,
            role: instruction.role,
            isServing: instruction.isServing,
            isCandidate: instruction.isCandidate,
            isPinned: instruction.isPinned,
            isProvisionalLeader: instruction.role === 'provisional-leader',
            isSelectedTarget: instruction.role === 'selected-target',
            wireframeRib: true,
            isSolidData: instruction.link.isSolidData,
            isMeasurementOnly: instruction.link.isMeasurementOnly,
          }}
        />
      ))}
    </group>
  );
}

function MultiCandidateFootprint({
  instruction,
  displayScale,
  renderFill,
}: {
  readonly instruction: MultiCandidateBeamSceneRenderInstruction;
  /** Small presentation-only nesting when several pairs share one Cell. */
  readonly displayScale: number;
  /** Measurement-only candidates keep only their dashed/dotted outline. */
  readonly renderFill: boolean;
}): JSX.Element {
  const targetPoints = instruction.homepageTargetHighlight === true
    ? (displayScale === 1
      ? instruction.footprint.points
      : scaledFootprintPoints(instruction.footprint.points, instruction.baseCenter, displayScale))
    : [];
  const targetHighlightPoints = targetPoints.length > 0
    ? [...targetPoints, targetPoints[0]!] as readonly MultiCandidateScenePoint[]
    : null;
  return (
    <group
      name={`multi-candidate-footprint-${instruction.satelliteId}-b${instruction.beamId}`}
      userData={{
        pairKey: instruction.pairKey,
        joinKey: instruction.joinKey,
        sceneJoinKey: instruction.sceneJoinKey,
        railJoinKey: instruction.railJoinKey,
        satelliteId: instruction.satelliteId,
        beamId: instruction.beamId,
        cellId: instruction.cellId,
        role: instruction.role,
        isServing: instruction.isServing,
        isCandidate: instruction.isCandidate,
        homepageTargetHighlight: instruction.homepageTargetHighlight === true,
        isPinned: instruction.isPinned,
        isProvisionalLeader: instruction.role === 'provisional-leader',
        isSelectedTarget: instruction.role === 'selected-target',
        isSolidData: instruction.link.isSolidData,
        isMeasurementOnly: instruction.link.isMeasurementOnly,
        footprintStyle: instruction.footprint.style,
        footprintOutlineCount: instruction.footprint.outlineCount,
        color: instruction.footprint.color,
      }}
    >
      {renderFill && (
        <mesh
          name={`multi-candidate-footprint-fill-${instruction.satelliteId}-b${instruction.beamId}`}
          position={[instruction.baseCenter[0], GROUND_FOOTPRINT_Y - 0.01, instruction.baseCenter[2]]}
          rotation={[-Math.PI / 2, 0, Math.PI / 6]}
          renderOrder={12}
        >
          <circleGeometry args={[instruction.cone.baseRadiusWorld * displayScale, 6]} />
          <meshBasicMaterial
            color={instruction.footprint.color}
            transparent
            opacity={instruction.isServing
              ? 0.08
              : instruction.role === 'observed' ? 0.055 : 0.07}
            side={THREE.DoubleSide}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      )}
      {instruction.footprint.rings.map((ring, index) => (
        <Line
          key={`${instruction.sceneJoinKey}/footprint/${index}`}
          points={displayScale === 1
            ? ring.points
            : scaledFootprintPoints(ring.points, instruction.baseCenter, displayScale)}
          color={instruction.footprint.color}
          lineWidth={ring.lineWidth}
          transparent
          opacity={ring.opacity}
          dashed={ring.dashed}
          dashSize={ring.dashSize}
          gapSize={ring.gapSize}
          depthWrite={false}
          renderOrder={13 + index}
          userData={{
            pairKey: instruction.pairKey,
            joinKey: instruction.joinKey,
            sceneJoinKey: instruction.sceneJoinKey,
            railJoinKey: instruction.railJoinKey,
            satelliteId: instruction.satelliteId,
            beamId: instruction.beamId,
            cellId: instruction.cellId,
            role: instruction.role,
            isServing: instruction.isServing,
            isCandidate: instruction.isCandidate,
            homepageTargetHighlight: instruction.homepageTargetHighlight === true,
            isPinned: instruction.isPinned,
            isProvisionalLeader: instruction.role === 'provisional-leader',
            isSelectedTarget: instruction.role === 'selected-target',
            isSolidData: instruction.link.isSolidData,
            isMeasurementOnly: instruction.link.isMeasurementOnly,
            footprintStyle: instruction.footprint.style,
            ringIndex: index,
            color: instruction.footprint.color,
          }}
        />
      ))}
      {targetHighlightPoints !== null ? (
        <Line
          key={`${instruction.sceneJoinKey}/target-highlight`}
          name={`multi-candidate-target-highlight-${instruction.satelliteId}-b${instruction.beamId}`}
          points={targetHighlightPoints}
          color={instruction.beamColor}
          lineWidth={3.8}
          transparent
          opacity={0.98}
          depthWrite={false}
          renderOrder={18}
          userData={{
            pairKey: instruction.pairKey,
            joinKey: instruction.joinKey,
            sceneJoinKey: instruction.sceneJoinKey,
            railJoinKey: instruction.railJoinKey,
            satelliteId: instruction.satelliteId,
            beamId: instruction.beamId,
            cellId: instruction.cellId,
            role: instruction.role,
            isServing: instruction.isServing,
            isCandidate: instruction.isCandidate,
            targetHighlight: true,
            isSolidData: instruction.link.isSolidData,
            isMeasurementOnly: instruction.link.isMeasurementOnly,
          }}
        />
      ) : null}
    </group>
  );
}

function MultiCandidateEndpoint({
  instruction,
  visibleOverride,
}: {
  readonly instruction: MultiCandidateBeamSceneRenderInstruction;
  /** Display-only override used to hide unselected candidate endpoint rings. */
  readonly visibleOverride?: boolean;
}): JSX.Element | null {
  if (!instruction.endpoint.visible || visibleOverride === false) return null;
  return (
    <mesh
      name={`multi-candidate-endpoint-${instruction.satelliteId}-b${instruction.beamId}`}
      position={instruction.endpoint.position}
      rotation={[-Math.PI / 2, 0, 0]}
      renderOrder={21}
      userData={{
        pairKey: instruction.pairKey,
        joinKey: instruction.joinKey,
        sceneJoinKey: instruction.sceneJoinKey,
        railJoinKey: instruction.railJoinKey,
        satelliteId: instruction.satelliteId,
        beamId: instruction.beamId,
        role: instruction.role,
        isServing: instruction.isServing,
        isCandidate: instruction.isCandidate,
        isPinned: instruction.isPinned,
        isProvisionalLeader: instruction.role === 'provisional-leader',
        isSelectedTarget: instruction.role === 'selected-target',
        isSolidData: instruction.link.isSolidData,
        isMeasurementOnly: instruction.link.isMeasurementOnly,
        hollow: instruction.endpoint.hollow,
        color: instruction.endpoint.color,
      }}
    >
      <ringGeometry args={[instruction.endpoint.radiusWorld * 0.68, instruction.endpoint.radiusWorld, 24]} />
      <meshBasicMaterial
        color={instruction.endpoint.color}
        transparent
        opacity={0.9}
        side={THREE.DoubleSide}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

function MultiCandidatePair({
  instruction,
  renderServingConeAndFootprint,
  renderCandidateCarrierGeometry,
  renderCandidateFootprints,
  limitCandidateCarrierToLeader,
  candidateCarrierLeaderPairKey,
  limitCandidateLinksToLeader,
  candidateDisplayLinkPairKey,
  renderServingDataLink,
  renderPairLabels,
  candidateLane,
  satelliteBiasLane,
  showSatelliteInLabel,
  onCandidateSelect,
}: {
  readonly instruction: MultiCandidateBeamSceneRenderInstruction;
  readonly renderServingConeAndFootprint: boolean;
  readonly renderCandidateCarrierGeometry: boolean;
  readonly renderCandidateFootprints: boolean;
  readonly limitCandidateCarrierToLeader: boolean;
  readonly candidateCarrierLeaderPairKey: string | null;
  readonly limitCandidateLinksToLeader: boolean;
  readonly candidateDisplayLinkPairKey: string | null;
  readonly renderServingDataLink: boolean;
  readonly renderPairLabels: boolean;
  readonly candidateLane: number;
  readonly satelliteBiasLane: number;
  readonly showSatelliteInLabel: boolean;
  readonly onCandidateSelect?: (key: CandidateLinkKey) => void;
}): JSX.Element {
  const renderCarrierGeometry = shouldRenderMultiCandidateCarrierGeometry(
    instruction,
    instruction.isServing ? renderServingConeAndFootprint : renderCandidateCarrierGeometry,
    limitCandidateCarrierToLeader,
    candidateCarrierLeaderPairKey,
  );
  const renderFootprint = shouldRenderMultiCandidateCarrierGeometry(
    instruction,
    instruction.isServing ? renderServingConeAndFootprint : renderCandidateFootprints,
    limitCandidateCarrierToLeader,
    candidateCarrierLeaderPairKey,
  );
  const renderFootprintFill = shouldRenderMultiCandidateFootprintFill(
    instruction,
    renderCarrierGeometry,
  );
  const renderIdentityLabel = renderPairLabels && shouldRenderMultiCandidateIdentityLabel(
    instruction,
    renderServingConeAndFootprint,
  );
  const footprintDisplayScale = instruction.isCandidate ? 1 + candidateLane * 0.08 : 1;
  const visibleIdentityLabel = showSatelliteInLabel
    ? instruction.label?.text ?? ''
    : `B${instruction.beamId} / C${instruction.cellId + 1}`;
  const visibleLabelPosition = resolveCandidateLabelPosition(
    instruction,
    candidateLane,
    satelliteBiasLane,
  );
  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (!instruction.isCandidate || onCandidateSelect === undefined) return;
    event.stopPropagation();
    onCandidateSelect(instruction.key);
  };
  return (
    <group
      key={instruction.sceneJoinKey}
      name={`multi-candidate-pair-${instruction.satelliteId}-b${instruction.beamId}`}
      userData={{
        pairKey: instruction.pairKey,
        joinKey: instruction.joinKey,
        sceneJoinKey: instruction.sceneJoinKey,
        railJoinKey: instruction.railJoinKey,
        satelliteId: instruction.satelliteId,
        beamId: instruction.beamId,
        cellId: instruction.cellId,
        role: instruction.role,
        isServing: instruction.isServing,
        isCandidate: instruction.isCandidate,
        isPinned: instruction.isPinned,
        isProvisionalLeader: instruction.role === 'provisional-leader',
        isSelectedTarget: instruction.role === 'selected-target',
        satelliteColor: instruction.satelliteColor,
        beamColor: instruction.beamColor,
        coneStyle: instruction.cone.style,
        footprintStyle: instruction.footprint.style,
        linkStyle: instruction.link.style,
        coneVolume: instruction.cone.volume,
        limitCandidateCarrierToLeader,
        candidateCarrierLeaderPairKey,
        limitCandidateLinksToLeader,
        candidateDisplayLinkPairKey,
        isSolidData: instruction.link.isSolidData,
        isMeasurementOnly: instruction.link.isMeasurementOnly,
        reducedMotion: instruction.reducedMotion,
      }}
      onClick={handleClick}
    >
      {renderCarrierGeometry && instruction.cone.visible && <MultiCandidateConeMesh instruction={instruction} />}
      {renderFootprint && instruction.footprint.visible && (
        <MultiCandidateFootprint
          instruction={instruction}
          displayScale={footprintDisplayScale}
          renderFill={renderFootprintFill}
        />
      )}
      {shouldRenderMultiCandidateDataLink(
        instruction,
        renderServingDataLink,
        limitCandidateLinksToLeader,
        candidateDisplayLinkPairKey,
      ) && (
        <Line
          points={instruction.link.points}
          color={instruction.link.color}
          lineWidth={instruction.link.lineWidth}
          transparent
          opacity={instruction.link.opacity}
          dashed={instruction.link.dashed}
          dashSize={6}
          gapSize={4}
          depthWrite={false}
          renderOrder={20}
          userData={{
            pairKey: instruction.pairKey,
            joinKey: instruction.joinKey,
            sceneJoinKey: instruction.sceneJoinKey,
            satelliteId: instruction.satelliteId,
            beamId: instruction.beamId,
            role: instruction.role,
            isServing: instruction.isServing,
            isCandidate: instruction.isCandidate,
            isPinned: instruction.isPinned,
            isProvisionalLeader: instruction.role === 'provisional-leader',
            isSelectedTarget: instruction.role === 'selected-target',
            isSolidData: instruction.link.isSolidData,
            isMeasurementOnly: instruction.link.isMeasurementOnly,
            linkStyle: instruction.link.style,
            color: instruction.link.color,
          }}
        />
      )}
      <MultiCandidateEndpoint
        instruction={instruction}
        visibleOverride={instruction.isCandidate
          ? instruction.isPinned
            || instruction.role === 'provisional-leader'
            || instruction.role === 'selected-target'
          : undefined}
      />
      {renderIdentityLabel && instruction.label !== null && (
        <Html
          position={visibleLabelPosition}
          center
          zIndexRange={[80, 20]}
          style={{
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          <div
            className="multi-candidate-label"
            data-testid="multi-candidate-label"
            data-satellite-id={instruction.satelliteId}
            data-satellite-color={instruction.satelliteColor}
            data-beam-id={instruction.beamId}
            data-cell-id={instruction.cellId}
            data-scene-join-key={instruction.sceneJoinKey}
            data-rail-join-key={instruction.railJoinKey}
            data-pair-key={instruction.pairKey}
            data-candidate-lane={candidateLane}
            data-role={instruction.role}
            data-label={visibleIdentityLabel}
            data-show-satellite-in-label={showSatelliteInLabel ? '1' : '0'}
            data-is-serving={instruction.isServing ? '1' : '0'}
            data-is-candidate={instruction.isCandidate ? '1' : '0'}
            data-is-pinned={instruction.isPinned ? '1' : '0'}
            data-is-provisional-leader={instruction.role === 'provisional-leader' ? '1' : '0'}
            data-is-selected-target={instruction.role === 'selected-target' ? '1' : '0'}
            style={{
              pointerEvents: 'none',
              userSelect: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 7px',
              borderRadius: '4px',
              border: `1px solid ${instruction.label.color}`,
              background: 'rgba(2, 6, 23, 0.88)',
              boxShadow: instruction.isPinned || instruction.role === 'provisional-leader' || instruction.role === 'selected-target'
                ? `0 0 8px ${instruction.label.color}66`
                : '0 2px 6px rgba(0, 0, 0, 0.6)',
              color: '#f8fafc',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              fontSize: '16px',
              fontWeight: 600,
              lineHeight: 1.2,
              textAlign: 'center',
              whiteSpace: 'nowrap',
              textShadow: '0 1px 2px rgba(0, 0, 0, 0.9)',
            }}
          >
            <span>{visibleIdentityLabel}</span>
          </div>
        </Html>
      )}
    </group>
  );
}

export function shouldRenderMultiCandidateIdentityLabel(
  instruction: MultiCandidateBeamSceneRenderInstruction,
  renderServingConeAndFootprint: boolean,
): boolean {
  if (instruction.isServing) return renderServingConeAndFootprint;
  if (instruction.isPinned) return true;
  return instruction.role === 'provisional-leader' || instruction.role === 'selected-target';
}

export function groupMultiCandidateSatelliteIdentities(
  instructions: readonly MultiCandidateBeamSceneRenderInstruction[],
): readonly MultiCandidateSatelliteIdentityGroup[] {
  const bySatellite = new Map<string, MultiCandidateBeamSceneRenderInstruction[]>();
  for (const instruction of instructions) {
    const group = bySatellite.get(instruction.satelliteId) ?? [];
    group.push(instruction);
    bySatellite.set(instruction.satelliteId, group);
  }
  const orderedGroups = [...bySatellite.entries()].sort(([leftId, left], [rightId, right]) => {
    const leftServing = left.some(instruction => instruction.isServing);
    const rightServing = right.some(instruction => instruction.isServing);
    if (leftServing !== rightServing) return leftServing ? -1 : 1;
    return leftId.localeCompare(rightId);
  });
  return Object.freeze(orderedGroups.map(([satelliteId, group]) => {
    const candidateInstructions = group.filter(instruction => instruction.isCandidate);
    const eligibleCandidateInstructions = candidateInstructions.filter(
      instruction => instruction.role !== 'observed',
    );
    const hasProvisionalLeader = candidateInstructions.some(
      instruction => instruction.role === 'provisional-leader',
    );
    const hasSelectedTarget = candidateInstructions.some(
      instruction => instruction.role === 'selected-target',
    );
    const beamCellPairs = Object.freeze(
      [...new Map(group.map(instruction => [
        `${instruction.beamId}/${instruction.cellId}`,
        Object.freeze({ beamId: instruction.beamId, cellId: instruction.cellId }),
      ])).values()]
        .sort((left, right) => left.beamId - right.beamId || left.cellId - right.cellId),
    );
    return Object.freeze({
      satelliteId,
      identityInstruction: group[0]!,
      isServingSatellite: group.some(instruction => instruction.isServing),
      hasCandidatePairs: candidateInstructions.length > 0,
      hasEligibleCandidatePairs: eligibleCandidateInstructions.length > 0,
      hasObservedCandidatePairs: candidateInstructions.some(instruction => instruction.role === 'observed'),
      hasProvisionalLeader,
      hasSelectedTarget,
      isPinnedSatellite: group.some(instruction => instruction.isPinned),
      candidatePairCount: candidateInstructions.length,
      eligibleCandidatePairCount: eligibleCandidateInstructions.length,
      pairKeys: Object.freeze(group.map(instruction => instruction.pairKey)),
      sceneJoinKeys: Object.freeze(group.map(instruction => instruction.sceneJoinKey)),
      railJoinKeys: Object.freeze(group.map(instruction => instruction.railJoinKey)),
      servingBeamIds: Object.freeze(group
        .filter(instruction => instruction.isServing)
        .map(instruction => instruction.beamId)),
      candidateBeamIds: Object.freeze(group
        .filter(instruction => instruction.isCandidate)
        .map(instruction => instruction.beamId)),
      beamIds: Object.freeze(group.map(instruction => instruction.beamId)),
      beamCellPairs,
    });
  }));
}

function centralCandidateRolePriority(role: CandidatePresentationRole): number {
  switch (role) {
    case 'selected-target': return 0;
    case 'provisional-leader': return 1;
    case 'qualified': return 2;
    case 'hard-eligible': return 3;
    case 'observed': return 4;
    case 'serving':
    case 'committed-serving': return -1;
  }
}

/**
 * Select the one candidate whose existing presentation role may own carrier
 * geometry in leader-only mode. This deliberately consumes role metadata from
 * the accepted scene instructions; it does not inspect metrics, ranks, or
 * recompute a handover decision.
 */
export function resolveCandidateCarrierLeaderPairKey(
  instructions: readonly MultiCandidateBeamSceneRenderInstruction[],
): string | null {
  const instructionOrder = new Map(
    instructions.map((instruction, index) => [instruction, index] as const),
  );
  const leader = [...instructions]
    .filter(instruction => instruction.isCandidate
      && (
        instruction.role === 'selected-target'
        || instruction.role === 'provisional-leader'
      ))
    .sort((left, right) => (
      centralCandidateRolePriority(left.role) - centralCandidateRolePriority(right.role)
      || (instructionOrder.get(left) ?? 0) - (instructionOrder.get(right) ?? 0)
      || left.satelliteId.localeCompare(right.satelliteId)
      || left.beamId - right.beamId
    ))[0];
  return leader?.pairKey ?? null;
}

/**
 * Select the one candidate measurement link allowed on the centre stage. A
 * selected/provisional leader wins when present; before that role exists, the
 * first stable qualified/hard-eligible instruction is only a visual
 * representative. This function never changes the accepted decision or rail.
 */
export function resolveCandidateDisplayLinkPairKey(
  instructions: readonly MultiCandidateBeamSceneRenderInstruction[],
): string | null {
  const leaderPairKey = resolveCandidateCarrierLeaderPairKey(instructions);
  if (leaderPairKey !== null) return leaderPairKey;
  return [...instructions]
    .filter(instruction => instruction.isCandidate
      && (instruction.role === 'qualified' || instruction.role === 'hard-eligible'))
    .sort((left, right) => (
      centralCandidateRolePriority(left.role) - centralCandidateRolePriority(right.role)
      || left.satelliteId.localeCompare(right.satelliteId)
      || left.beamId - right.beamId
    ))[0]?.pairKey ?? null;
}

export function shouldRenderMultiCandidateDataLink(
  instruction: MultiCandidateBeamSceneRenderInstruction,
  renderServingDataLink: boolean,
  limitCandidateLinksToLeader: boolean,
  candidateDisplayLinkPairKey: string | null,
): boolean {
  if (!instruction.link.visible) return false;
  if (!instruction.isCandidate) return renderServingDataLink;
  return !limitCandidateLinksToLeader || instruction.pairKey === candidateDisplayLinkPairKey;
}

/**
 * Render contract for candidate carrier geometry and footprint painting.
 * Serving instructions intentionally bypass the leader key so the established
 * serving carrier is unchanged; candidate links themselves remain governed by
 * their presentation plan and are not hidden by this helper.
 */
export function shouldRenderMultiCandidateCarrierGeometry(
  instruction: MultiCandidateBeamSceneRenderInstruction,
  requested: boolean,
  limitToLeader: boolean,
  leaderPairKey: string | null,
): boolean {
  if (!requested) return false;
  if (instruction.isServing) return true;
  if (!instruction.isCandidate) return false;
  return !limitToLeader || instruction.pairKey === leaderPairKey;
}

/**
 * Filled footprint polygons belong to the carrier geometry.  A candidate
 * footprint can still be requested as a dashed/dotted measurement marker,
 * but it must not gain a solid fill merely because that marker is visible.
 */
export function shouldRenderMultiCandidateFootprintFill(
  instruction: MultiCandidateBeamSceneRenderInstruction,
  renderCarrierGeometry: boolean,
): boolean {
  return renderCarrierGeometry && (instruction.isServing || instruction.isCandidate);
}

/**
 * Collapse the complete scene instruction list into the small set that is
 * actually painted in the centre stage.  All instructions remain available to
 * the rail, join metadata, and resolver tests; this is only a display-density
 * gate.  A serving link is always retained, and each alternate satellite gets
 * one stable representative pair (selected/leader first, then role and beam).
 */
export function selectCentralMultiCandidateSceneInstructions(
  instructions: readonly MultiCandidateBeamSceneRenderInstruction[],
): readonly MultiCandidateBeamSceneRenderInstruction[] {
  const serving = instructions.filter(instruction => instruction.isServing);
  const servingSatelliteIds = new Set(serving.map(instruction => instruction.satelliteId));
  const bySatellite = new Map<string, MultiCandidateBeamSceneRenderInstruction[]>();
  for (const instruction of instructions) {
    if (!instruction.isCandidate) continue;
    const group = bySatellite.get(instruction.satelliteId) ?? [];
    group.push(instruction);
    bySatellite.set(instruction.satelliteId, group);
  }
  const representativeItems = [...bySatellite.entries()]
    .map(([satelliteId, group]) => {
      const representative = [...group].sort((left, right) => (
        centralCandidateRolePriority(left.role) - centralCandidateRolePriority(right.role)
        || Number(right.isPinned) - Number(left.isPinned)
        || instructions.indexOf(left) - instructions.indexOf(right)
        || left.beamId - right.beamId
        || left.cellId - right.cellId
      )).slice(0, MAX_CENTRAL_CANDIDATE_PAIRS_PER_SATELLITE)[0];
      return representative === undefined
        ? undefined
        : {
          satelliteId,
          representative,
          firstInstructionIndex: instructions.indexOf(group[0]!),
      };
    })
    .filter((item): item is {
      readonly satelliteId: string;
      readonly representative: MultiCandidateBeamSceneRenderInstruction;
      readonly firstInstructionIndex: number;
    } => item !== undefined)
    .sort((left, right) => (
      centralCandidateRolePriority(left.representative.role)
      - centralCandidateRolePriority(right.representative.role)
      || Number(right.representative.isPinned) - Number(left.representative.isPinned)
      || left.firstInstructionIndex - right.firstInstructionIndex
      || left.satelliteId.localeCompare(right.satelliteId)
    ));
  // A same-satellite beam candidate belongs to the serving spacecraft's
  // identity (and is useful for intra-satellite handover), but it must not
  // consume one of the *alternate satellite* shortlist slots. Otherwise a
  // seven-beam serving fan can hide the second spacecraft the user is meant
  // to compare. Keep one representative same-satellite candidate, then cap
  // only distinct alternate spacecrafts at the central display boundary.
  const sameServingRepresentatives = representativeItems
    .filter(item => servingSatelliteIds.has(item.satelliteId))
    .map(item => item.representative);
  const alternateRepresentatives = representativeItems
    .filter(item => !servingSatelliteIds.has(item.satelliteId))
    .slice(0, MAX_CENTRAL_CANDIDATE_SATELLITES)
    .map(item => item.representative);
  return Object.freeze([
    ...serving,
    ...sameServingRepresentatives,
    ...alternateRepresentatives,
  ]);
}

/**
 * Homepage comparison projection: keep the serving instruction and one
 * stable measurement representative for every satellite that is present in
 * the accepted candidate plan.  Unlike the legacy density selector this does
 * not cap alternate satellites.  The right rail is the complete qualified
 * candidate roster, so the centre must expose the same satellite identities
 * (one dashed measurement line each); only carrier geometry is still limited
 * separately to the selected/provisional leader.
 *
 * This is a projection-only choice. It does not add candidates, rank them, or
 * alter the accepted decision. Other routes continue to use the bounded
 * `selectCentralMultiCandidateSceneInstructions` selector.
 */
export function selectHomepageCandidateSceneInstructions(
  instructions: readonly MultiCandidateBeamSceneRenderInstruction[],
): readonly MultiCandidateBeamSceneRenderInstruction[] {
  const serving = instructions.filter(instruction => instruction.isServing);
  const servingSatelliteIds = new Set(serving.map(instruction => instruction.satelliteId));
  const representativeBySatellite = new Map<string, MultiCandidateBeamSceneRenderInstruction>();
  const firstInstructionIndexBySatellite = new Map<string, number>();

  for (const [index, instruction] of instructions.entries()) {
    if (!instruction.isCandidate) continue;
    const current = representativeBySatellite.get(instruction.satelliteId);
    if (current === undefined) {
      representativeBySatellite.set(instruction.satelliteId, instruction);
      firstInstructionIndexBySatellite.set(instruction.satelliteId, index);
      continue;
    }
    const currentIndex = firstInstructionIndexBySatellite.get(instruction.satelliteId) ?? index;
    const preferred = [...[current, instruction]].sort((left, right) => (
      centralCandidateRolePriority(left.role) - centralCandidateRolePriority(right.role)
      || Number(right.isPinned) - Number(left.isPinned)
      || (firstInstructionIndexBySatellite.get(left.satelliteId) ?? currentIndex)
        - (firstInstructionIndexBySatellite.get(right.satelliteId) ?? index)
      || left.beamId - right.beamId
      || left.cellId - right.cellId
    ))[0]!;
    representativeBySatellite.set(instruction.satelliteId, preferred);
  }

  const representatives = [...representativeBySatellite.entries()]
    .map(([satelliteId, representative]) => ({
      satelliteId,
      representative,
      firstInstructionIndex: firstInstructionIndexBySatellite.get(satelliteId) ?? Number.MAX_SAFE_INTEGER,
    }))
    .sort((left, right) => (
      centralCandidateRolePriority(left.representative.role)
      - centralCandidateRolePriority(right.representative.role)
      || Number(right.representative.isPinned) - Number(left.representative.isPinned)
      || left.firstInstructionIndex - right.firstInstructionIndex
      || left.satelliteId.localeCompare(right.satelliteId)
    ))
    .map(item => item.representative);

  const sameServingRepresentatives = representatives.filter(instruction => (
    servingSatelliteIds.has(instruction.satelliteId)
  ));
  const alternateRepresentatives = representatives.filter(instruction => (
    !servingSatelliteIds.has(instruction.satelliteId)
  ));
  return Object.freeze([
    ...serving,
    ...sameServingRepresentatives,
    ...alternateRepresentatives,
  ]);
}

function satelliteIdentityRoleTag(
  group: MultiCandidateSatelliteIdentityGroup,
  homepageVisualIdentity = false,
): string {
  const replacement = homepageVisualIdentity ? '替代' : '候選';
  if (group.isServingSatellite && group.hasSelectedTarget) return `服務／${replacement}勝出`;
  if (group.isServingSatellite && group.hasProvisionalLeader) return `服務／${replacement}暫列`;
  if (group.isServingSatellite) return '服務';
  if (group.hasSelectedTarget) return `${replacement}勝出`;
  if (group.hasProvisionalLeader) return `${replacement}暫列`;
  if (group.hasEligibleCandidatePairs) return replacement;
  if (group.hasObservedCandidatePairs) return '觀測';
  return '背景';
}

function formatBeamIdSummary(beamIds: readonly number[]): string {
  const sorted = [...new Set(beamIds)].sort((left, right) => left - right);
  if (sorted.length === 0) return '無波束';
  const ranges: string[] = [];
  let start = sorted[0]!;
  let end = start;
  for (const beamId of sorted.slice(1)) {
    if (beamId === end + 1) {
      end = beamId;
      continue;
    }
    ranges.push(start === end ? `B${start}` : `B${start}–B${end}`);
    start = beamId;
    end = beamId;
  }
  ranges.push(start === end ? `B${start}` : `B${start}–B${end}`);
  return ranges.join('／');
}

/**
 * Keep the physical/display join visible without making the right rail the
 * only place where a cell identity can be verified.  The badge is deliberately
 * capped because comparison mode can contain the complete seven-beam roster;
 * the rail still carries every pair and its full source-frame key.
 */
export function formatBeamCellPairSummary(
  pairs: readonly MultiCandidateBeamCellPair[],
  maxPairs = 4,
): string {
  if (!Number.isInteger(maxPairs) || maxPairs < 1) {
    throw new TypeError('maxPairs must be a positive integer');
  }
  const unique = [...new Map(pairs.map(pair => [
    `${pair.beamId}/${pair.cellId}`,
    pair,
  ])).values()]
    .sort((left, right) => left.beamId - right.beamId || left.cellId - right.cellId);
  if (unique.length === 0) return '無波束';
  const visible = unique.slice(0, maxPairs)
    .map(pair => `B${pair.beamId}/C${pair.cellId + 1}`);
  const hiddenCount = unique.length - visible.length;
  return hiddenCount > 0
    ? `${visible.join(' · ')} · +${hiddenCount}`
    : visible.join(' · ');
}

function formatSatelliteBeamSummary(
  group: MultiCandidateSatelliteIdentityGroup,
  roleTag: string,
  homepageVisualIdentity = false,
): string {
  const servingBeamSet = new Set(group.servingBeamIds);
  const servingPairs = group.beamCellPairs.filter(pair => servingBeamSet.has(pair.beamId));
  const candidatePairs = group.beamCellPairs.filter(pair => !servingBeamSet.has(pair.beamId));
  // Keep the badge itself a single, glanceable row.  The complete B/C mapping
  // remains available through data-beam-cell-pairs and the rail; rendering all
  // seven pairs in the world-space badge makes the CSS shrink-to-fit wrapper
  // cover the scene. One pair plus a bounded count is enough to join the
  // satellite to a visible ground cell; the rail carries every measured pair.
  const pairSummary = (pairs: readonly MultiCandidateBeamCellPair[]) =>
    formatBeamCellPairSummary(pairs, 1);
  if (group.isServingSatellite && group.candidateBeamIds.length > 0) {
    const replacement = homepageVisualIdentity ? '替代' : '候選';
    const roleSummary = `服務 ${pairSummary(servingPairs)} · ${replacement} ${pairSummary(candidatePairs)}`;
    return `${roleTag === '服務' ? '' : `${roleTag} · `}${roleSummary}`;
  }
  if (group.isServingSatellite) {
    return `${roleTag === '服務' ? '' : `${roleTag} · `}服務 ${pairSummary(servingPairs)}`;
  }
  return `${roleTag} · ${pairSummary(group.beamCellPairs)}`;
}

function MultiCandidateSatelliteIdentityMarker({
  group,
  satelliteLane,
  satelliteLaneCount,
  candidateOrdinal,
  renderLabel,
  satelliteNameById,
  homepageVisualIdentity,
}: {
  readonly group: MultiCandidateSatelliteIdentityGroup;
  readonly satelliteLane: number;
  readonly satelliteLaneCount: number;
  /** 1-based central shortlist position; absent for the serving satellite. */
  readonly candidateOrdinal: number | null;
  readonly renderLabel: boolean;
  readonly satelliteNameById?: ReadonlyMap<string, string> | null;
  readonly homepageVisualIdentity?: boolean;
}): JSX.Element {
  const instruction = group.identityInstruction;
  const camera = useThree(state => state.camera);
  const viewportWidth = useThree(state => state.size.width);
  const markerRole = group.hasSelectedTarget
    ? 'selected-target'
    : group.hasProvisionalLeader
      ? 'provisional-leader'
      : group.isServingSatellite
        ? 'serving'
        : group.hasEligibleCandidatePairs
          ? 'candidate'
          : group.hasCandidatePairs
            ? 'observed'
            : 'context';
  const candidateHaloIsStrong = group.hasEligibleCandidatePairs || group.isPinnedSatellite;
  const candidateHaloInnerRadius = candidateHaloIsStrong
    ? SATELLITE_CANDIDATE_HALO_INNER_RADIUS_WORLD
    : SATELLITE_OBSERVED_HALO_INNER_RADIUS_WORLD;
  const candidateHaloOuterRadius = candidateHaloIsStrong
    ? SATELLITE_CANDIDATE_HALO_OUTER_RADIUS_WORLD
    : SATELLITE_OBSERVED_HALO_OUTER_RADIUS_WORLD;
  const candidateHaloOpacity = candidateHaloIsStrong ? 0.64 : 0.30;
  const satelliteLabelPosition = resolveSatelliteIdentityLabelPosition(
    satelliteLane,
    satelliteLaneCount,
  );
  const satelliteLabelTranslateX = useMemo(() => {
    const projected = new THREE.Vector3(...instruction.apex).project(camera);
    return resolveSatelliteIdentityLabelHorizontalCorrection(projected.x, viewportWidth);
  }, [camera, instruction.apex, viewportWidth]);
  // Use a small CSS-pixel ladder in addition to the world-space band.  This
  // remains stable at every camera distance and avoids overlap when several
  // candidate spacecraft project into the same part of the sky.
  // The small ladder separates close projected spacecraft while keeping each
  // badge visually attached to its GLB. It is still a label-only offset; the
  // GLB, beam, footprint, and camera remain untouched.
  const satelliteLabelTranslateY = (satelliteLane % 3) * SATELLITE_LABEL_SCREEN_LANE_GAP_PX
    + SATELLITE_LABEL_SCREEN_BASE_OFFSET_PX;
  const roleTag = satelliteIdentityRoleTag(group, homepageVisualIdentity);
  const joinMetadata = Object.freeze({
    satelliteId: group.satelliteId,
    pairKeys: group.pairKeys,
    sceneJoinKeys: group.sceneJoinKeys,
    railJoinKeys: group.railJoinKeys,
    beamIds: group.beamIds,
    beamCellPairs: group.beamCellPairs,
    satelliteColor: instruction.satelliteColor,
    markerRole,
    role: markerRole,
    isServing: group.isServingSatellite,
    isCandidate: group.hasCandidatePairs,
    isProvisionalLeader: group.hasProvisionalLeader,
    isSelectedTarget: group.hasSelectedTarget,
    isLeader: group.hasProvisionalLeader,
    isSelected: group.hasSelectedTarget,
    roleTag,
    isServingSatellite: group.isServingSatellite,
    hasCandidatePairs: group.hasCandidatePairs,
    hasEligibleCandidatePairs: group.hasEligibleCandidatePairs,
    hasObservedCandidatePairs: group.hasObservedCandidatePairs,
    hasProvisionalLeader: group.hasProvisionalLeader,
    hasSelectedTarget: group.hasSelectedTarget,
    isPinnedSatellite: group.isPinnedSatellite,
    candidatePairCount: group.candidatePairCount,
    eligibleCandidatePairCount: group.eligibleCandidatePairCount,
    centralShortlistOrdinal: candidateOrdinal,
  });
  const satelliteLabel = resolveHomepageSatelliteDisplayName(
    instruction.satelliteId,
    satelliteNameById,
  );
  const beamSummary = formatSatelliteBeamSummary(group, roleTag, homepageVisualIdentity);
  const visibleSatelliteLabel = `${satelliteLabel} · ${beamSummary}`;
  // The full B/C mapping remains in data attributes and the right rail.  The
  // centre stage only needs a glanceable role + spacecraft identity; repeating
  // every measured beam in a floating badge is what previously covered the
  // scene and made candidates appear to flicker as their roster changed.
  const replacement = homepageVisualIdentity ? '替代' : '候選';
  const compactSatelliteLabel = `${group.isServingSatellite
    ? group.hasCandidatePairs ? `服務／${replacement}` : '服務'
    : group.hasSelectedTarget
      ? `接手${replacement}`
      : group.hasProvisionalLeader
        ? `${replacement}暫列`
        : candidateOrdinal === null
          ? replacement
          : `${replacement} ${candidateOrdinal}`} · ${satelliteLabel}`;
  return (
    <Billboard
      position={instruction.apex}
      follow
      lockX={false}
      lockY={false}
      lockZ={false}
      name={`multi-candidate-satellite-identity-${instruction.satelliteId}`}
      userData={joinMetadata}
    >
      {group.isServingSatellite && (
        <mesh
          name={`multi-candidate-serving-halo-${instruction.satelliteId}`}
          renderOrder={28}
          userData={{ ...joinMetadata, haloRole: 'serving' }}
        >
          <ringGeometry args={[
            SATELLITE_SERVING_HALO_INNER_RADIUS_WORLD,
            SATELLITE_SERVING_HALO_OUTER_RADIUS_WORLD,
            SATELLITE_IDENTITY_HALO_SEGMENTS,
          ]} />
          <meshBasicMaterial
            color={instruction.satelliteColor}
            transparent
            opacity={0.98}
            side={THREE.DoubleSide}
            depthTest={false}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      )}
      {group.hasCandidatePairs && (
        <mesh
          name={`multi-candidate-candidate-halo-${instruction.satelliteId}`}
          renderOrder={16}
          userData={{
            ...joinMetadata,
            haloRole: candidateHaloIsStrong ? 'candidate' : 'observed',
          }}
        >
          <ringGeometry args={[
            candidateHaloInnerRadius,
            candidateHaloOuterRadius,
            SATELLITE_IDENTITY_HALO_SEGMENTS,
          ]} />
          <meshBasicMaterial
            color={instruction.satelliteColor}
            transparent
            opacity={candidateHaloOpacity}
            side={THREE.DoubleSide}
            depthTest={false}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      )}
      {renderLabel && (
        <Html
          position={satelliteLabelPosition}
          center
          zIndexRange={[90, 30]}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          <div
            className="multi-candidate-satellite-marker"
            data-testid="multi-candidate-satellite-label"
            data-satellite-id={instruction.satelliteId}
            data-satellite-color={instruction.satelliteColor}
            data-scene-join-key={instruction.sceneJoinKey}
            data-rail-join-key={instruction.railJoinKey}
            data-pair-key={instruction.pairKey}
            data-scene-join-keys={JSON.stringify(group.sceneJoinKeys)}
            data-rail-join-keys={JSON.stringify(group.railJoinKeys)}
            data-pair-keys={JSON.stringify(group.pairKeys)}
            data-beam-ids={JSON.stringify(group.beamIds)}
            data-beam-cell-pairs={JSON.stringify(group.beamCellPairs)}
            data-marker-role={markerRole}
            data-role={markerRole}
            data-role-tag={roleTag}
            data-beam-summary={beamSummary}
            data-label={visibleSatelliteLabel}
            data-compact-label={compactSatelliteLabel}
            data-is-serving={group.isServingSatellite ? '1' : '0'}
            data-is-candidate={group.hasCandidatePairs ? '1' : '0'}
            data-is-leader={group.hasProvisionalLeader ? '1' : '0'}
            data-is-provisional-leader={group.hasProvisionalLeader ? '1' : '0'}
            data-is-selected-target={group.hasSelectedTarget ? '1' : '0'}
            data-is-pinned={group.isPinnedSatellite ? '1' : '0'}
            data-is-serving-satellite={group.isServingSatellite ? '1' : '0'}
            data-has-candidate-pairs={group.hasCandidatePairs ? '1' : '0'}
            data-has-eligible-candidate-pairs={group.hasEligibleCandidatePairs ? '1' : '0'}
            data-has-observed-candidate-pairs={group.hasObservedCandidatePairs ? '1' : '0'}
            data-has-provisional-leader={group.hasProvisionalLeader ? '1' : '0'}
            data-has-selected-target={group.hasSelectedTarget ? '1' : '0'}
            data-is-pinned-satellite={group.isPinnedSatellite ? '1' : '0'}
            data-candidate-pair-count={group.candidatePairCount}
            data-eligible-candidate-pair-count={group.eligibleCandidatePairCount}
            data-central-shortlist-ordinal={candidateOrdinal === null ? 'serving' : String(candidateOrdinal)}
            data-label-lane={satelliteLane}
            aria-label={visibleSatelliteLabel}
            style={{
              padding: '4px 9px',
              border: `2px solid ${instruction.satelliteColor}`,
              borderRadius: '999px',
              background: 'rgba(2, 6, 23, 0.96)',
              color: '#ffffff',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              fontSize: '15px',
              fontWeight: 800,
              lineHeight: 1.25,
              // R3F Html uses an absolutely positioned shrink-to-fit wrapper.
              // nowrap + max-content prevents it from collapsing to a vertical
              // min-content column. The compact text and 300px cap leave the
              // ground scene visible on the narrow centre stage; the rail and
              // data attributes retain the full mapping.
              width: 'max-content',
              maxWidth: 'min(300px, calc(100vw - 24px))',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              textAlign: 'center',
              textShadow: '0 1px 3px rgba(0, 0, 0, 1)',
              transform: `translate(${satelliteLabelTranslateX}px, ${satelliteLabelTranslateY}px)`,
            }}
          >
            {compactSatelliteLabel}
          </div>
        </Html>
      )}
    </Billboard>
  );
}

/**
 * Independent R3F scene renderer for the bounded presentation plan.  It does
 * not mount or tint satellite GLB materials; existing satellite markers remain
 * responsible for the spacecraft model, while this layer paints only the
 * identity-coloured beam/footprint/link read-out.
 */
export function MultiCandidateBeamScene(props: MultiCandidateBeamSceneProps): JSX.Element | null {
  const resolved = useMemo(() => resolveMultiCandidateBeamScene(props), [
    props.presentation,
    props.placementByCellId,
    props.satelliteWorldById,
    props.primaryUeWorld,
    props.widthScale,
    props.reducedMotion,
    props.homepageVisualIdentity,
    props.homepageBeamEeByKey,
    props.homepageIdentityPaletteIndexBySatelliteId,
    props.satelliteNameById,
    props.anchorIntraCandidatesToServingCell,
  ]);
  const renderServingConeAndFootprint = props.renderServingConeAndFootprint !== false;
  const renderCandidateCarrierGeometry = props.renderCandidateCarrierGeometry === true;
  const renderCandidateFootprints = props.renderCandidateFootprints
    ?? renderCandidateCarrierGeometry;
  const limitCandidateCarrierToLeader = props.limitCandidateCarrierToLeader === true;
  const limitCandidateLinksToLeader = props.limitCandidateLinksToLeader === true;
  const renderServingDataLink = props.renderServingDataLink !== false;
  const renderSatelliteIdentityMarkers = props.renderSatelliteIdentityMarkers !== false;
  const renderSatelliteIdentityLabels = props.renderSatelliteIdentityLabels !== false;
  const renderPairLabels = props.renderPairLabels === true;
  const centralInstructions = useMemo(
    () => props.homepageVisualIdentity === true
      ? selectHomepageCandidateSceneInstructions(resolved.instructions)
      : selectCentralMultiCandidateSceneInstructions(resolved.instructions),
    [props.homepageVisualIdentity, resolved.instructions],
  );
  const candidateCarrierLeaderPairKey = limitCandidateCarrierToLeader
    ? resolveCandidateCarrierLeaderPairKey(centralInstructions)
    : null;
  const candidateDisplayLinkPairKey = limitCandidateLinksToLeader
    ? resolveCandidateDisplayLinkPairKey(centralInstructions)
    : null;
  const mountedConeVolumeCount = centralInstructions.reduce(
    (count, instruction) => count + (
      instruction.cone.visible
      && shouldRenderMultiCandidateCarrierGeometry(
        instruction,
        instruction.isServing ? renderServingConeAndFootprint : renderCandidateCarrierGeometry,
        limitCandidateCarrierToLeader,
        candidateCarrierLeaderPairKey,
      )
        ? 1
        : 0
    ),
    0,
  );
  const gl = useThree(state => state.gl);

  useLayoutEffect(() => {
    const dataset = gl.domElement.dataset;
    dataset[MULTI_CANDIDATE_SCENE_TELEMETRY_KEYS.instructionCount]
      = String(resolved.telemetry.instructionCount);
    dataset[MULTI_CANDIDATE_SCENE_TELEMETRY_KEYS.renderedPairCount]
      = String(resolved.telemetry.renderedPairCount);
    dataset[MULTI_CANDIDATE_SCENE_TELEMETRY_KEYS.centralRenderedPairCount]
      = String(centralInstructions.length);
    dataset[MULTI_CANDIDATE_SCENE_TELEMETRY_KEYS.satelliteCount]
      = String(resolved.telemetry.renderedSatelliteCount);
    dataset[MULTI_CANDIDATE_SCENE_TELEMETRY_KEYS.satelliteIdentityColors]
      = JSON.stringify(Object.fromEntries(
        [...new Map(resolved.instructions.map(instruction => [
          instruction.satelliteId,
          instruction.satelliteColor,
        ])).entries()].sort((left, right) => left[0].localeCompare(right[0])),
      ));
    dataset[MULTI_CANDIDATE_SCENE_TELEMETRY_KEYS.coneVolumeCount]
      = String(mountedConeVolumeCount);
    dataset[MULTI_CANDIDATE_SCENE_TELEMETRY_KEYS.solidDataLinkCount]
      = String(resolved.telemetry.solidDataLinkCount);
    dataset[MULTI_CANDIDATE_SCENE_TELEMETRY_KEYS.unmappedPairCount]
      = String(resolved.telemetry.unmappedPairs.length);
    dataset[MULTI_CANDIDATE_SCENE_TELEMETRY_KEYS.unmappedPairs]
      = JSON.stringify(resolved.telemetry.unmappedPairs);
    if (props.renderReceipt !== null && props.renderReceipt !== undefined) {
      dataset[MULTI_CANDIDATE_SCENE_TELEMETRY_KEYS.acceptedSnapshotId]
        = props.renderReceipt.snapshotId;
      dataset[MULTI_CANDIDATE_SCENE_TELEMETRY_KEYS.acceptedSourceFrameId]
        = props.renderReceipt.sourceFrameId;
      dataset[MULTI_CANDIDATE_SCENE_TELEMETRY_KEYS.renderedSceneJoinKeys]
        = JSON.stringify(props.renderReceipt.renderedSceneJoinKeys);
      dataset[MULTI_CANDIDATE_SCENE_TELEMETRY_KEYS.eventCueCount]
        = String(props.renderReceipt.eventCueCount);
    } else {
      delete dataset[MULTI_CANDIDATE_SCENE_TELEMETRY_KEYS.acceptedSnapshotId];
      delete dataset[MULTI_CANDIDATE_SCENE_TELEMETRY_KEYS.acceptedSourceFrameId];
      delete dataset[MULTI_CANDIDATE_SCENE_TELEMETRY_KEYS.renderedSceneJoinKeys];
      delete dataset[MULTI_CANDIDATE_SCENE_TELEMETRY_KEYS.eventCueCount];
    }
    return () => {
      delete dataset[MULTI_CANDIDATE_SCENE_TELEMETRY_KEYS.instructionCount];
      delete dataset[MULTI_CANDIDATE_SCENE_TELEMETRY_KEYS.renderedPairCount];
      delete dataset[MULTI_CANDIDATE_SCENE_TELEMETRY_KEYS.centralRenderedPairCount];
      delete dataset[MULTI_CANDIDATE_SCENE_TELEMETRY_KEYS.satelliteCount];
      delete dataset[MULTI_CANDIDATE_SCENE_TELEMETRY_KEYS.satelliteIdentityColors];
      delete dataset[MULTI_CANDIDATE_SCENE_TELEMETRY_KEYS.coneVolumeCount];
      delete dataset[MULTI_CANDIDATE_SCENE_TELEMETRY_KEYS.solidDataLinkCount];
      delete dataset[MULTI_CANDIDATE_SCENE_TELEMETRY_KEYS.unmappedPairCount];
      delete dataset[MULTI_CANDIDATE_SCENE_TELEMETRY_KEYS.unmappedPairs];
      delete dataset[MULTI_CANDIDATE_SCENE_TELEMETRY_KEYS.acceptedSnapshotId];
      delete dataset[MULTI_CANDIDATE_SCENE_TELEMETRY_KEYS.acceptedSourceFrameId];
      delete dataset[MULTI_CANDIDATE_SCENE_TELEMETRY_KEYS.renderedSceneJoinKeys];
      delete dataset[MULTI_CANDIDATE_SCENE_TELEMETRY_KEYS.eventCueCount];
    };
  }, [centralInstructions, gl, mountedConeVolumeCount, props.renderReceipt, resolved]);

  if (props.visible === false) return null;
  const satelliteIdentityGroups = groupMultiCandidateSatelliteIdentities(centralInstructions);
  const satelliteBiasLaneById = new Map(satelliteIdentityGroups.map((group, index) => [
    group.satelliteId,
    index,
  ]));
  // Keep the visible C1/C2 labels deterministic and identical to the central
  // selector (and therefore to the rail's comparison-board order). A
  // same-satellite replacement beam belongs to the serving marker and does not
  // consume an alternate-satellite slot.
  const servingSatelliteIds = new Set(
    centralInstructions
      .filter(instruction => instruction.isServing)
      .map(instruction => instruction.satelliteId),
  );
  const candidateOrdinalBySatelliteId = new Map<string, number>();
  let candidateOrdinal = 0;
  for (const instruction of centralInstructions) {
    if (!instruction.isCandidate || servingSatelliteIds.has(instruction.satelliteId)) continue;
    if (candidateOrdinalBySatelliteId.has(instruction.satelliteId)) continue;
    candidateOrdinal += 1;
    candidateOrdinalBySatelliteId.set(instruction.satelliteId, candidateOrdinal);
  }
  const nextLaneByCellId = new Map<number, number>();
  const candidateLaneByPair = new Map<string, number>();
  const firstCandidatePairBySatelliteId = new Map<string, string>();
  for (const instruction of centralInstructions) {
    if (!instruction.isCandidate) continue;
    if (!firstCandidatePairBySatelliteId.has(instruction.satelliteId)) {
      firstCandidatePairBySatelliteId.set(instruction.satelliteId, instruction.pairKey);
    }
    const lane = nextLaneByCellId.get(instruction.cellId) ?? 0;
    candidateLaneByPair.set(instruction.pairKey, lane);
    nextLaneByCellId.set(instruction.cellId, lane + 1);
  }
  return (
    <group
      name="multi-candidate-beam-scene"
      userData={{
        instructionCount: resolved.telemetry.instructionCount,
        renderedPairCount: resolved.telemetry.renderedPairCount,
        centralRenderedPairCount: resolved.centralRenderedPairCount,
        renderedSatelliteCount: resolved.telemetry.renderedSatelliteCount,
        coneCount: mountedConeVolumeCount,
        coneVolumeCount: mountedConeVolumeCount,
        maxConeVolumes: resolved.telemetry.maxConeVolumes,
        maxSatelliteGroups: resolved.telemetry.maxSatelliteGroups,
        limitCandidateCarrierToLeader,
        candidateCarrierLeaderPairKey,
        solidDataLinkCount: resolved.telemetry.solidDataLinkCount,
        unmappedPairCount: resolved.telemetry.unmappedPairs.length,
        unmappedPairs: resolved.telemetry.unmappedPairs,
        sceneJoinKeys: resolved.instructions.map(instruction => instruction.sceneJoinKey),
        acceptedSnapshotId: props.renderReceipt?.snapshotId ?? null,
        acceptedSourceFrameId: props.renderReceipt?.sourceFrameId ?? null,
        reducedMotion: props.reducedMotion === true,
      }}
    >
      {renderSatelliteIdentityMarkers && satelliteIdentityGroups.map(group => (
        <MultiCandidateSatelliteIdentityMarker
          group={group}
          satelliteLane={satelliteBiasLaneById.get(group.satelliteId) ?? 0}
          satelliteLaneCount={satelliteIdentityGroups.length}
          candidateOrdinal={servingSatelliteIds.has(group.satelliteId)
            ? null
            : candidateOrdinalBySatelliteId.get(group.satelliteId) ?? null}
          renderLabel={renderSatelliteIdentityLabels}
          satelliteNameById={props.satelliteNameById}
          homepageVisualIdentity={props.homepageVisualIdentity}
          key={`satellite-identity/${group.satelliteId}`}
        />
      ))}
      {centralInstructions.map(instruction => (
        <MultiCandidatePair
          instruction={instruction}
          key={instruction.sceneJoinKey}
          renderServingConeAndFootprint={renderServingConeAndFootprint}
          renderCandidateCarrierGeometry={renderCandidateCarrierGeometry}
          renderCandidateFootprints={renderCandidateFootprints}
          limitCandidateCarrierToLeader={limitCandidateCarrierToLeader}
          candidateCarrierLeaderPairKey={candidateCarrierLeaderPairKey}
          limitCandidateLinksToLeader={limitCandidateLinksToLeader}
          candidateDisplayLinkPairKey={candidateDisplayLinkPairKey}
          renderServingDataLink={renderServingDataLink}
          renderPairLabels={renderPairLabels}
          candidateLane={candidateLaneByPair.get(instruction.pairKey) ?? 0}
          satelliteBiasLane={satelliteBiasLaneById.get(instruction.satelliteId) ?? 0}
          showSatelliteInLabel={instruction.isServing
            || firstCandidatePairBySatelliteId.get(instruction.satelliteId) === instruction.pairKey}
          onCandidateSelect={props.onCandidateSelect}
        />
      ))}
    </group>
  );
}
