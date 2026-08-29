import { useEffect, useLayoutEffect, useMemo, type JSX } from 'react';
import { Billboard, Html, Line } from '@react-three/drei';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';

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
import type {
  HandoverBeamVisualIdentity,
  HandoverSatelliteVisualIdentity,
} from '../constants/handoverVisualIdentity';
import {
  cellIdFromLinkBudgetBeamId,
} from '../scene/sinrLiveCellModel';
import type { WorldPoint } from './CellFootprints';
import {
  buildObliqueBeamConePositions,
  type SinrLiveCellPlacement,
} from './SinrLiveCellBeamCones';
import type {
  MultiCandidateSceneIdentity,
  MultiCandidateSceneLinkInstruction,
  MultiCandidateScenePresentation,
} from '../scene/multiCandidateScenePresentation';
import type { CandidateSceneRenderReceipt } from '../scene/acceptedHandoverPresentationSnapshot';
import { formatSatelliteLabel } from '../utils/formatSatelliteLabel';

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
  readonly satelliteId: string;
  readonly beamId: number;
  /** Recovered from the link-budget beam surrogate, never inferred from rank. */
  readonly cellId: number;
  readonly role: CandidatePresentationRole;
  readonly isServing: boolean;
  readonly isCandidate: boolean;
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
  readonly coneVolumeCount: number;
  readonly solidDataLinkCount: 0 | 1;
  readonly unmappedPairs: readonly MultiCandidateBeamSceneUnmappedPair[];
  readonly telemetry: MultiCandidateBeamSceneTelemetry;
}

export interface MultiCandidateSatelliteIdentityGroup {
  readonly satelliteId: string;
  readonly identityInstruction: MultiCandidateBeamSceneRenderInstruction;
  readonly pairKeys: readonly string[];
  readonly sceneJoinKeys: readonly string[];
  readonly railJoinKeys: readonly string[];
  readonly beamIds: readonly number[];
}

export interface MultiCandidateBeamSceneProps extends MultiCandidateBeamSceneResolverInput {
  readonly visible?: boolean;
  /**
   * The homepage keeps its established serving cone + hex footprint carrier.
   * Set this false there so this layer adds candidate evidence without
   * repainting the current serving geometry. The serving data link and join
   * metadata remain here as the single decision-authority read-out.
   */
  readonly renderServingConeAndFootprint?: boolean;
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
});

const GROUND_FOOTPRINT_Y = 0.12;
const FOOTPRINT_OUTER_SCALE = 1.055;
const HEX_SIDE_COUNT = 6;
const ENDPOINT_RADIUS_WORLD = 2.2;
/**
 * Raw triangle-mesh wireframe exposes every fan edge and turns an oblique beam
 * into a dense visual cage. Eight ribs keep the measurement-only volume
 * legible without competing with the single solid serving link.
 */
export const MULTI_CANDIDATE_WIREFRAME_RIB_COUNT = 3;

/**
 * Deterministic outer-edge slots for different satellite/beam identities that
 * map to the same ground cell. Keeping the badges around the hex perimeter is
 * both more legible and more truthful than stacking them above the UE.
 */
const CANDIDATE_LABEL_SLOT_AZIMUTH_DEG = Object.freeze([90, -30, 210, 30, 150, 270] as const);

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
        coneOpacity: 0.24,
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
        coneOpacity: 0.18,
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
        coneOpacity: 0.32,
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
        coneOpacity: 0.14,
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

function mapPresentationInstruction(
  source: MultiCandidateSceneLinkInstruction,
  placementByCellId: ReadonlyMap<number, SinrLiveCellPlacement>,
  satelliteWorldById: ReadonlyMap<string, WorldPoint>,
  sourceFrameId: string,
  primaryUeWorld: MultiCandidateScenePoint,
  widthScale: number,
  reducedMotion: boolean,
): MultiCandidateBeamSceneMappingResult {
  const expectedPairKey = candidateLinkKeyString(source.key);
  if (source.pairKey !== expectedPairKey
    || source.key.satelliteId !== source.satelliteId
    || source.key.beamId !== source.beamId) {
    fail(`displayed pair is not joined by satellite and beam: ${source.joinKey}`);
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
  const placement = placementByCellId.get(cellId);
  const satelliteWorld = satelliteWorldById.get(source.satelliteId);
  if (!placement) return unmappedPair(source, sourceFrameId, 'missing-placement');
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
  // An observed pair exposed during evaluation keeps a clean translucent
  // volume even though its noisy full-height measurement line is suppressed.
  // Pinning may add that line without changing serving authority.
  const roleStyle = roleVisualStyle(
    source.role,
    source.isPinned,
    source.cone.style === 'wireframe' && source.cone.visible,
  );
  const footprintDashed = source.footprint.style !== 'solid';
  const coneVisible = source.cone.visible && source.cone.volume === 1;
  const coneColor = source.identity.beam?.threeColor ?? source.identity.satellite.threeColor;
  const satelliteColor = source.identity.satellite.threeColor;
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
    satelliteId: source.satelliteId,
    beamId: source.beamId,
    cellId,
    role: source.role,
    isServing: source.isServing,
    isCandidate: source.isCandidate,
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
      color: coneColor,
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
  for (const source of input.presentation.instructions) {
    const pairKey = candidateLinkKeyString(source.key);
    if (seenPairs.has(pairKey)) fail(`duplicate displayed pair ${pairKey}`);
    seenPairs.add(pairKey);
    const instruction = mapPresentationInstruction(
      source,
      input.placementByCellId,
      input.satelliteWorldById,
      input.presentation.sourceFrameId,
      primaryUeWorld,
      widthScale,
      reducedMotion,
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
  return Object.freeze({
    instructions,
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
            satelliteId: instruction.satelliteId,
            beamId: instruction.beamId,
            cellId: instruction.cellId,
            role: instruction.role,
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
            role: instruction.role,
            wireframeRib: true,
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
}: {
  readonly instruction: MultiCandidateBeamSceneRenderInstruction;
  /** Small presentation-only nesting when several pairs share one Cell. */
  readonly displayScale: number;
}): JSX.Element {
  return (
    <group
      name={`multi-candidate-footprint-${instruction.satelliteId}-b${instruction.beamId}`}
      userData={{
        pairKey: instruction.pairKey,
        joinKey: instruction.joinKey,
        sceneJoinKey: instruction.sceneJoinKey,
        satelliteId: instruction.satelliteId,
        beamId: instruction.beamId,
        cellId: instruction.cellId,
        role: instruction.role,
        footprintStyle: instruction.footprint.style,
        footprintOutlineCount: instruction.footprint.outlineCount,
        color: instruction.footprint.color,
      }}
    >
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
            satelliteId: instruction.satelliteId,
            beamId: instruction.beamId,
            cellId: instruction.cellId,
            role: instruction.role,
            footprintStyle: instruction.footprint.style,
            ringIndex: index,
            color: instruction.footprint.color,
          }}
        />
      ))}
    </group>
  );
}

function MultiCandidateEndpoint({
  instruction,
}: {
  readonly instruction: MultiCandidateBeamSceneRenderInstruction;
}): JSX.Element | null {
  if (!instruction.endpoint.visible) return null;
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
        satelliteId: instruction.satelliteId,
        beamId: instruction.beamId,
        role: instruction.role,
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
  candidateLane,
  satelliteBiasLane,
  showSatelliteInLabel,
  onCandidateSelect,
}: {
  readonly instruction: MultiCandidateBeamSceneRenderInstruction;
  readonly renderServingConeAndFootprint: boolean;
  readonly candidateLane: number;
  readonly satelliteBiasLane: number;
  readonly showSatelliteInLabel: boolean;
  readonly onCandidateSelect?: (key: CandidateLinkKey) => void;
}): JSX.Element {
  const renderCarrierGeometry = !instruction.isServing || renderServingConeAndFootprint;
  const renderIdentityLabel = shouldRenderMultiCandidateIdentityLabel(
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
        satelliteColor: instruction.satelliteColor,
        beamColor: instruction.beamColor,
        coneStyle: instruction.cone.style,
        footprintStyle: instruction.footprint.style,
        linkStyle: instruction.link.style,
        coneVolume: instruction.cone.volume,
        isSolidData: instruction.link.isSolidData,
        reducedMotion: instruction.reducedMotion,
      }}
      onClick={handleClick}
    >
      {renderCarrierGeometry && instruction.cone.visible && <MultiCandidateConeMesh instruction={instruction} />}
      {renderCarrierGeometry && instruction.footprint.visible && (
        <MultiCandidateFootprint instruction={instruction} displayScale={footprintDisplayScale} />
      )}
      {instruction.link.visible && (
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
            isSolidData: instruction.link.isSolidData,
            linkStyle: instruction.link.style,
            color: instruction.link.color,
          }}
        />
      )}
      <MultiCandidateEndpoint instruction={instruction} />
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
              fontSize: '14px',
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
  if (instruction.role === 'observed') return instruction.isPinned;
  return true;
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
  return Object.freeze([...bySatellite.entries()].map(([satelliteId, group]) => Object.freeze({
    satelliteId,
    identityInstruction: group[0]!,
    pairKeys: Object.freeze(group.map(instruction => instruction.pairKey)),
    sceneJoinKeys: Object.freeze(group.map(instruction => instruction.sceneJoinKey)),
    railJoinKeys: Object.freeze(group.map(instruction => instruction.railJoinKey)),
    beamIds: Object.freeze(group.map(instruction => instruction.beamId)),
  })));
}

function MultiCandidateSatelliteIdentityMarker({
  group,
}: {
  readonly group: MultiCandidateSatelliteIdentityGroup;
}): JSX.Element {
  const instruction = group.identityInstruction;
  const joinMetadata = {
    satelliteId: group.satelliteId,
    pairKeys: group.pairKeys,
    sceneJoinKeys: group.sceneJoinKeys,
    railJoinKeys: group.railJoinKeys,
    beamIds: group.beamIds,
  };
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
      <mesh renderOrder={28} userData={joinMetadata}>
        <ringGeometry args={[12, 17, 40]} />
        <meshBasicMaterial
          color={instruction.satelliteColor}
          transparent
          opacity={0.9}
          side={THREE.DoubleSide}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <Html
        position={[0, 26, 0]}
        center
        zIndexRange={[90, 30]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div
          data-testid="multi-candidate-satellite-label"
          data-satellite-id={instruction.satelliteId}
          style={{
            padding: '3px 8px',
            border: `1px solid ${instruction.satelliteColor}`,
            borderRadius: '999px',
            background: 'rgba(2, 6, 23, 0.9)',
            color: '#f8fafc',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            fontSize: '15px',
            fontWeight: 760,
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            textShadow: '0 1px 2px rgba(0, 0, 0, 0.95)',
          }}
        >
          {formatSatelliteLabel(instruction.satelliteId)}
        </div>
      </Html>
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
  ]);
  const renderServingConeAndFootprint = props.renderServingConeAndFootprint !== false;
  const mountedConeVolumeCount = resolved.instructions.reduce(
    (count, instruction) => count + (
      instruction.cone.visible
      && (renderServingConeAndFootprint || !instruction.isServing)
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
  }, [gl, mountedConeVolumeCount, props.renderReceipt, resolved]);

  if (props.visible === false) return null;
  const satelliteIdentityGroups = groupMultiCandidateSatelliteIdentities(resolved.instructions);
  const satelliteBiasLaneById = new Map(satelliteIdentityGroups.map((group, index) => [
    group.satelliteId,
    index,
  ]));
  const nextLaneByCellId = new Map<number, number>();
  const candidateLaneByPair = new Map<string, number>();
  const firstCandidatePairBySatelliteId = new Map<string, string>();
  for (const instruction of resolved.instructions) {
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
        renderedSatelliteCount: resolved.telemetry.renderedSatelliteCount,
        coneCount: mountedConeVolumeCount,
        coneVolumeCount: mountedConeVolumeCount,
        maxConeVolumes: resolved.telemetry.maxConeVolumes,
        maxSatelliteGroups: resolved.telemetry.maxSatelliteGroups,
        solidDataLinkCount: resolved.telemetry.solidDataLinkCount,
        unmappedPairCount: resolved.telemetry.unmappedPairs.length,
        unmappedPairs: resolved.telemetry.unmappedPairs,
        sceneJoinKeys: resolved.instructions.map(instruction => instruction.sceneJoinKey),
        acceptedSnapshotId: props.renderReceipt?.snapshotId ?? null,
        acceptedSourceFrameId: props.renderReceipt?.sourceFrameId ?? null,
        reducedMotion: props.reducedMotion === true,
      }}
    >
      {satelliteIdentityGroups.map(group => (
        <MultiCandidateSatelliteIdentityMarker
          group={group}
          key={`satellite-identity/${group.satelliteId}`}
        />
      ))}
      {resolved.instructions.map(instruction => (
        <MultiCandidatePair
          instruction={instruction}
          key={instruction.sceneJoinKey}
          renderServingConeAndFootprint={renderServingConeAndFootprint}
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
