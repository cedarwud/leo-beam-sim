import type {
  ModqnReplayPlaybackDisplayState,
  ModqnReplayPlaybackFocusRow,
} from '../modqn/replay-bundle/playback-shell';
import type {
  ModqnBeamReference,
  ModqnBeamState,
  ModqnHandoverEventKind,
  ModqnProducerPosition,
  ModqnSatelliteState,
} from '../modqn/replay-bundle/types';
import { EARTH_KM_PER_DEG } from '../engine/orbit/earth-constants';

export const MODQN_REPLAY_SCENE_SOURCE = 'producer-row-truth-with-display-fallback' as const;
export const MODQN_REPLAY_SCENE_BEAM_COUNT = 7;
export const MODQN_REPLAY_SCENE_PRODUCER_SATELLITE_COUNT = 4;
export const MODQN_REPLAY_SCENE_BEAM_RADIUS_WORLD = 58;
export const MODQN_REPLAY_SCENE_DEFAULT_WORLD_UNITS_PER_KM = 10;
export const MODQN_REPLAY_SCENE_DEFAULT_SATELLITE_ALTITUDE_WORLD = 380;

const SOURCE_BEAM_RADIUS_MIN_WORLD = 42;
const SOURCE_BEAM_RADIUS_MAX_WORLD = 420;
const LOCAL_FRAME_VISIBLE_X_WORLD = 2600;
const LOCAL_FRAME_VISIBLE_Z_WORLD = 1800;

export interface ModqnReplaySceneVisualOptions {
  readonly worldUnitsPerKm?: number;
  readonly visualSatelliteAltitudeWorld?: number;
}

export interface ModqnReplayScenePoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export type ModqnReplaySceneGeometrySource =
  | 'producer-beam-state'
  | 'producer-display-proxy'
  | 'display-canonical-lens';

export type ModqnReplaySceneBeamRole =
  | 'inactive'
  | 'previous'
  | 'selected'
  | 'previous-and-selected';

export interface ModqnReplaySceneBeamVisual {
  readonly canonicalLocalBeamIndex: number;
  readonly canonicalBeamNumber: number;
  readonly position: ModqnReplayScenePoint;
  readonly role: ModqnReplaySceneBeamRole;
  readonly previousProducerBeamId: string | null;
  readonly selectedProducerBeamId: string | null;
  readonly producerBeamId: string | null;
  readonly producerSatId: string | null;
  readonly geometrySource: ModqnReplaySceneGeometrySource;
  readonly footprintRadiusWorld: number;
  readonly actionValidUnderDecisionMask: boolean | null;
}

export interface ModqnReplaySceneEndpointVisual {
  readonly role: 'previous' | 'selected';
  readonly producerBeamId: string;
  readonly producerSatId: string;
  readonly producerBeamIndex: number;
  readonly producerLocalBeamIndex: number;
  readonly canonicalBeamNumber: number;
  readonly position: ModqnReplayScenePoint;
  readonly geometrySource: ModqnReplaySceneGeometrySource;
  readonly label: string;
  readonly detail: string;
}

export interface ModqnReplaySceneSwitchVisual {
  readonly eventKind: ModqnHandoverEventKind;
  readonly activeHandover: boolean;
  readonly activeIntraSatelliteSwitch: boolean;
  readonly sourcePosition: ModqnReplayScenePoint;
  readonly targetPosition: ModqnReplayScenePoint;
  readonly label: string;
}

export interface ModqnReplaySceneSatelliteVisual {
  readonly producerSatId: string;
  readonly satIndex: number;
  readonly label: string;
  readonly position: ModqnReplayScenePoint;
  readonly role: 'selected' | 'previous' | 'selected-and-previous' | 'context';
  readonly localFrameVisible: boolean;
  readonly coordinateFrameKind: string | null;
}

export interface ModqnReplaySceneFocusedUserVisual {
  readonly userId: string;
  readonly userIndex: number;
  readonly position: ModqnReplayScenePoint;
  readonly source: 'decisionUserPosition' | 'userPosition';
}

export type ModqnTrainingTruthLevelId = 'T0' | 'T1' | 'T2' | 'T3' | 'T4' | 'T5';
export type ModqnTrainingTruthStatus = 'available' | 'partial' | 'absent';

export interface ModqnTrainingTruthLevelAudit {
  readonly level: ModqnTrainingTruthLevelId;
  readonly name: string;
  readonly status: ModqnTrainingTruthStatus;
  readonly reason: string;
  readonly scenePolicy: string;
}

export interface ModqnTrainingTruthAudit {
  readonly levels: readonly ModqnTrainingTruthLevelAudit[];
  readonly highestSceneLevel: ModqnTrainingTruthLevelId;
  readonly sourceGapCount: number;
}

export interface ModqnReplaySceneVisualState {
  readonly source: typeof MODQN_REPLAY_SCENE_SOURCE;
  readonly coordinateFrame: 'producer-local-tangent-display-layer' | 'scene-world-display-layer';
  readonly modeLabel: string;
  readonly evidenceStatus: string;
  readonly sourceOwner: string;
  readonly sourcePath: string;
  readonly slotIndex: number;
  readonly sourceRowIndex: number;
  readonly sourceRowNumber: number;
  readonly expectedProducerSatelliteCount: number;
  readonly producerSatelliteStateCount: number;
  readonly renderedSatelliteStateCount: number;
  readonly slotDecisionRowCount: number;
  readonly eventKind: ModqnHandoverEventKind;
  readonly selectionSource:
    | 'producer'
    | 'omega-rescalarized'
    | 'omega-rescalarized-fallback';
  readonly playing: boolean;
  readonly loopEnabled: boolean;
  readonly geometrySource: ModqnReplaySceneGeometrySource;
  readonly beams: readonly ModqnReplaySceneBeamVisual[];
  readonly satellites: readonly ModqnReplaySceneSatelliteVisual[];
  readonly focusedUser: ModqnReplaySceneFocusedUserVisual | null;
  readonly previous: ModqnReplaySceneEndpointVisual;
  readonly selected: ModqnReplaySceneEndpointVisual;
  readonly switch: ModqnReplaySceneSwitchVisual;
  readonly truthAudit: ModqnTrainingTruthAudit;
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? value as Record<string, unknown>
    : null;
}

function numericField(source: unknown, key: string): number | null {
  const value = record(source)?.[key];
  return finiteNumber(value) ? value : null;
}

function stringField(source: unknown, key: string): string | null {
  const value = record(source)?.[key];
  return typeof value === 'string' ? value : null;
}

function booleanField(source: unknown, key: string): boolean | null {
  const value = record(source)?.[key];
  return typeof value === 'boolean' ? value : null;
}

function isDisplayOnlyProvenance(value: unknown): boolean {
  return booleanField(value, 'displayOnly') === true;
}

function normalizeWorldUnitsPerKm(value: number | undefined): number {
  return finiteNumber(value) && value > 0 ? value : MODQN_REPLAY_SCENE_DEFAULT_WORLD_UNITS_PER_KM;
}

function normalizeSatelliteAltitude(value: number | undefined): number {
  return finiteNumber(value) && value > 0 ? value : MODQN_REPLAY_SCENE_DEFAULT_SATELLITE_ALTITUDE_WORLD;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function localTangentKm(source: unknown): { readonly east: number; readonly north: number } | null {
  const tangent = record(record(source)?.localTangentKm);
  const east = numericField(tangent, 'east');
  const north = numericField(tangent, 'north');
  return east === null || north === null ? null : { east, north };
}

function localTangentToScenePoint(
  tangent: { readonly east: number; readonly north: number },
  worldUnitsPerKm: number,
  y = 0,
): ModqnReplayScenePoint {
  return {
    x: tangent.east * worldUnitsPerKm,
    y,
    z: -tangent.north * worldUnitsPerKm,
  };
}

function producerPositionToScenePoint(
  position: ModqnProducerPosition | undefined,
  worldUnitsPerKm: number,
): ModqnReplayScenePoint | null {
  const tangent = localTangentKm(position);
  return tangent === null ? null : localTangentToScenePoint(tangent, worldUnitsPerKm, 0);
}

function satelliteSubpointToScenePoint(
  satellite: ModqnSatelliteState,
  worldUnitsPerKm: number,
  altitudeWorld: number,
): ModqnReplayScenePoint | null {
  const subpoint = record(satellite.subSatellitePoint);
  const latDeg = numericField(subpoint, 'latDeg');
  const rawLonDeg = numericField(subpoint, 'lonDeg');
  if (latDeg === null || rawLonDeg === null) return null;

  const lonDeg = ((((rawLonDeg + 180) % 360) + 360) % 360) - 180;
  return {
    x: lonDeg * EARTH_KM_PER_DEG * worldUnitsPerKm,
    y: altitudeWorld,
    z: -latDeg * EARTH_KM_PER_DEG * worldUnitsPerKm,
  };
}

function isLocalFrameVisible(position: ModqnReplayScenePoint): boolean {
  return Math.abs(position.x) <= LOCAL_FRAME_VISIBLE_X_WORLD
    && Math.abs(position.z) <= LOCAL_FRAME_VISIBLE_Z_WORLD;
}

function beamFootprintRadiusWorld(beam: ModqnBeamState, worldUnitsPerKm: number): number {
  const footprintKm = numericField(beam, 'footprintKm');
  if (footprintKm === null) return MODQN_REPLAY_SCENE_BEAM_RADIUS_WORLD;
  return clamp(
    footprintKm * worldUnitsPerKm,
    SOURCE_BEAM_RADIUS_MIN_WORLD,
    SOURCE_BEAM_RADIUS_MAX_WORLD,
  );
}

function beamFootprintIsRenderable(beam: ModqnBeamState): boolean {
  const footprintKm = numericField(beam, 'footprintKm');
  if (footprintKm === null) return false;
  if (isDisplayOnlyProvenance(record(beam)?.footprintProvenance)) return false;
  return true;
}

function beamFootprintIsDisplayProxy(beam: ModqnBeamState): boolean {
  const footprintKm = numericField(beam, 'footprintKm');
  if (footprintKm === null) return false;
  return isDisplayOnlyProvenance(record(beam)?.footprintProvenance);
}

function beamCenterIsRenderable(beam: ModqnBeamState): boolean {
  return localTangentKm({ localTangentKm: beam.centerLocalTangentKm }) !== null;
}

function producerBeamPosition(
  beam: ModqnBeamState,
  worldUnitsPerKm: number,
): ModqnReplayScenePoint | null {
  const tangent = localTangentKm({ localTangentKm: beam.centerLocalTangentKm });
  return tangent === null ? null : localTangentToScenePoint(tangent, worldUnitsPerKm, 0);
}

function satelliteCoordinateFrameKindIsProxy(kind: string | null): boolean {
  return kind !== null && kind.includes('no-earth-rotation-proxy');
}

function satelliteStateIsRenderable(satellite: ModqnSatelliteState): boolean {
  const coordinateFrameKind = stringField(satellite, 'coordinateFrameKind');
  if (coordinateFrameKind === null) return false;
  if (satelliteCoordinateFrameKindIsProxy(coordinateFrameKind)) return false;
  if (isDisplayOnlyProvenance(record(satellite)?.positionProvenance)) return false;
  return true;
}

function satelliteStateIsDisplayProxy(satellite: ModqnSatelliteState): boolean {
  return satelliteCoordinateFrameKindIsProxy(stringField(satellite, 'coordinateFrameKind'));
}

const INTRA_LENS_SEPARATION_WORLD = 54;
const INTER_LENS_SEPARATION_WORLD = 170;
const INACTIVE_LENS_RING_WORLD = 124;

function createInactiveLensPosition(index: number, count: number): ModqnReplayScenePoint {
  const safeCount = Math.max(1, count);
  const angleRad = (-Math.PI / 2) + (index / safeCount) * Math.PI * 2;
  return {
    x: Math.cos(angleRad) * INACTIVE_LENS_RING_WORLD,
    y: 0,
    z: Math.sin(angleRad) * INACTIVE_LENS_RING_WORLD,
  };
}

function createEndpointLensPositions(
  focusRow: ModqnReplayPlaybackFocusRow,
): readonly [ModqnReplayScenePoint, ModqnReplayScenePoint] {
  const sameBeam =
    focusRow.previousServing.satId === focusRow.selectedServing.satId
    && focusRow.previousServing.localBeamIndex === focusRow.selectedServing.localBeamIndex;
  if (sameBeam) return [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }];

  const sameSatellite = focusRow.previousServing.satId === focusRow.selectedServing.satId;
  const separation = sameSatellite ? INTRA_LENS_SEPARATION_WORLD : INTER_LENS_SEPARATION_WORLD;
  return [
    { x: -separation / 2, y: 0, z: 0 },
    { x: separation / 2, y: 0, z: 0 },
  ];
}

function createBeamLensPositions(
  focusRow: ModqnReplayPlaybackFocusRow,
): Map<number, ModqnReplayScenePoint> {
  const positions = new Map<number, ModqnReplayScenePoint>();
  const [previousPosition, selectedPosition] = createEndpointLensPositions(focusRow);

  positions.set(focusRow.previousServing.localBeamIndex, previousPosition);
  positions.set(focusRow.selectedServing.localBeamIndex, selectedPosition);

  const inactiveIndices = Array.from(
    { length: MODQN_REPLAY_SCENE_BEAM_COUNT },
    (_, localBeamIndex) => localBeamIndex,
  ).filter(localBeamIndex => !positions.has(localBeamIndex));

  inactiveIndices.forEach((localBeamIndex, index) => {
    positions.set(localBeamIndex, createInactiveLensPosition(index, inactiveIndices.length));
  });

  return positions;
}

function formatEndpointLabel(role: 'previous' | 'selected', ref: ModqnBeamReference): string {
  const prefix = role === 'previous' ? 'Previous' : 'Selected';
  return `${prefix} B${ref.localBeamIndex + 1}`;
}

function formatEndpointDetail(ref: ModqnBeamReference): string {
  return `${ref.satId} / ${ref.beamId} / action ${ref.beamIndex}`;
}

function endpointVisual(
  role: 'previous' | 'selected',
  ref: ModqnBeamReference,
  position: ModqnReplayScenePoint,
  geometrySource: ModqnReplaySceneGeometrySource,
): ModqnReplaySceneEndpointVisual | null {
  return {
    role,
    producerBeamId: ref.beamId,
    producerSatId: ref.satId,
    producerBeamIndex: ref.beamIndex,
    producerLocalBeamIndex: ref.localBeamIndex,
    canonicalBeamNumber: ref.localBeamIndex + 1,
    position,
    geometrySource,
    label: formatEndpointLabel(role, ref),
    detail: formatEndpointDetail(ref),
  };
}

const INTER_SATELLITE_LANE_OFFSET_WORLD = 34;

function applyInterSatelliteLaneOffset(
  previous: ModqnReplaySceneEndpointVisual,
  selected: ModqnReplaySceneEndpointVisual,
  enabled: boolean,
): readonly [ModqnReplaySceneEndpointVisual, ModqnReplaySceneEndpointVisual] {
  if (!enabled || previous.producerSatId === selected.producerSatId) {
    return [previous, selected];
  }

  return [
    {
      ...previous,
      position: {
        ...previous.position,
        x: previous.position.x - INTER_SATELLITE_LANE_OFFSET_WORLD,
      },
    },
    {
      ...selected,
      position: {
        ...selected.position,
        x: selected.position.x + INTER_SATELLITE_LANE_OFFSET_WORLD,
      },
    },
  ];
}

function formatSwitchLabel(eventKind: ModqnHandoverEventKind): string {
  if (eventKind === 'intra-satellite-beam-switch') return 'Intra-sat beam switch';
  if (eventKind === 'inter-satellite-handover') return 'Inter-sat handover';
  return 'No handover';
}

function resolveBeamRole(
  localBeamIndex: number,
  previous: ModqnBeamReference,
  selected: ModqnBeamReference,
): ModqnReplaySceneBeamRole {
  const isPrevious = previous.localBeamIndex === localBeamIndex;
  const isSelected = selected.localBeamIndex === localBeamIndex;

  if (isPrevious && isSelected) return 'previous-and-selected';
  if (isPrevious) return 'previous';
  if (isSelected) return 'selected';
  return 'inactive';
}

function resolveProducerBeamRole(
  beam: ModqnBeamState,
  previous: ModqnBeamReference,
  selected: ModqnBeamReference,
): ModqnReplaySceneBeamRole {
  const isPrevious = previous.beamId === beam.beamId;
  const isSelected = selected.beamId === beam.beamId;

  if (isPrevious && isSelected) return 'previous-and-selected';
  if (isPrevious) return 'previous';
  if (isSelected) return 'selected';
  return 'inactive';
}

function beamProducerSatId(
  role: ModqnReplaySceneBeamRole,
  previous: ModqnBeamReference,
  selected: ModqnBeamReference,
): string | null {
  if (role === 'previous-and-selected') return selected.satId;
  if (role === 'previous') return previous.satId;
  if (role === 'selected') return selected.satId;
  return null;
}

function createFallbackBeamVisuals(
  focusRow: ModqnReplayPlaybackFocusRow,
  positions: Map<number, ModqnReplayScenePoint>,
): readonly ModqnReplaySceneBeamVisual[] | null {
  const beams: ModqnReplaySceneBeamVisual[] = [];

  for (let localBeamIndex = 0; localBeamIndex < MODQN_REPLAY_SCENE_BEAM_COUNT; localBeamIndex += 1) {
    const position = positions.get(localBeamIndex);
    if (position === undefined) return null;

    const role = resolveBeamRole(localBeamIndex, focusRow.previousServing, focusRow.selectedServing);
    beams.push({
      canonicalLocalBeamIndex: localBeamIndex,
      canonicalBeamNumber: localBeamIndex + 1,
      position,
      role,
      previousProducerBeamId: focusRow.previousServing.localBeamIndex === localBeamIndex
        ? focusRow.previousServing.beamId
        : null,
      selectedProducerBeamId: focusRow.selectedServing.localBeamIndex === localBeamIndex
        ? focusRow.selectedServing.beamId
        : null,
      producerBeamId: role === 'previous'
        ? focusRow.previousServing.beamId
        : role === 'selected' || role === 'previous-and-selected'
          ? focusRow.selectedServing.beamId
          : null,
      producerSatId: beamProducerSatId(role, focusRow.previousServing, focusRow.selectedServing),
      geometrySource: 'display-canonical-lens',
      footprintRadiusWorld: MODQN_REPLAY_SCENE_BEAM_RADIUS_WORLD,
      actionValidUnderDecisionMask: null,
    });
  }

  return beams;
}

interface SourceBeamVisualLayout {
  readonly beams: readonly ModqnReplaySceneBeamVisual[];
  readonly previousPosition: ModqnReplayScenePoint;
  readonly selectedPosition: ModqnReplayScenePoint;
}

function decisionMaskValue(
  focusRow: ModqnReplayPlaybackFocusRow,
  catalogIndex: number | null,
): boolean | null {
  const mask = focusRow.decisionActionValidityMask ?? focusRow.actionValidityMask;
  if (!mask || catalogIndex === null || catalogIndex < 0 || catalogIndex >= mask.length) return null;
  return mask[catalogIndex] === true;
}

function createSourceBeamVisualLayout(
  focusRow: ModqnReplayPlaybackFocusRow,
  worldUnitsPerKm: number,
  geometrySource: 'producer-beam-state' | 'producer-display-proxy',
): SourceBeamVisualLayout | null {
  const beamStates = focusRow.beamStates;
  if (!beamStates || beamStates.length === 0) return null;

  const beams: ModqnReplaySceneBeamVisual[] = [];
  let previousPosition: ModqnReplayScenePoint | null = null;
  let selectedPosition: ModqnReplayScenePoint | null = null;

  // The decision mask is CATALOG-axis (length A). Under the dual-axis Family-B
  // window, beamStates is the physical render-beam list whose beamIndex is the
  // per-satellite physical index (range 9..49, NOT the catalog index), so resolve
  // each physical beam to its catalog slot via the dense candidateActionOrder (by
  // beamId). Baseline / legacy bundles carry no dense catalog and beamStates.beamIndex
  // IS the catalog index, so fall back to keying by beamIndex (behaviour unchanged).
  const denseCatalog = focusRow.policyDiagnostics?.candidateActionOrder;
  const catalogIndexByBeamId = denseCatalog
    ? new Map(denseCatalog.map((entry, index) => [entry.beamId, index]))
    : null;

  for (const beam of beamStates) {
    const footprintAllowed = geometrySource === 'producer-beam-state'
      ? beamFootprintIsRenderable(beam)
      : beamFootprintIsDisplayProxy(beam);
    if (!beamCenterIsRenderable(beam) || !footprintAllowed) continue;

    const position = producerBeamPosition(beam, worldUnitsPerKm);
    if (position === null) continue;

    const catalogIndex = catalogIndexByBeamId
      ? (catalogIndexByBeamId.get(beam.beamId) ?? null)
      : beam.beamIndex;
    const actionValidUnderDecisionMask = decisionMaskValue(focusRow, catalogIndex);
    const role = resolveProducerBeamRole(beam, focusRow.previousServing, focusRow.selectedServing);
    const shouldRender = actionValidUnderDecisionMask === true || role !== 'inactive';
    if (!shouldRender) continue;

    if (role === 'previous') previousPosition = position;
    if (role === 'selected' || role === 'previous-and-selected') selectedPosition = position;
    if (role === 'previous-and-selected') previousPosition = position;

    beams.push({
      canonicalLocalBeamIndex: beam.localBeamIndex,
      canonicalBeamNumber: beam.localBeamIndex + 1,
      position,
      role,
      previousProducerBeamId: role === 'previous' || role === 'previous-and-selected'
        ? focusRow.previousServing.beamId
        : null,
      selectedProducerBeamId: role === 'selected' || role === 'previous-and-selected'
        ? focusRow.selectedServing.beamId
        : null,
      producerBeamId: beam.beamId,
      producerSatId: beam.satId,
      geometrySource,
      footprintRadiusWorld: beamFootprintRadiusWorld(beam, worldUnitsPerKm),
      actionValidUnderDecisionMask,
    });
  }

  if (beams.length === 0 || previousPosition === null || selectedPosition === null) return null;
  return { beams, previousPosition, selectedPosition };
}

function createSatelliteVisuals(
  focusRow: ModqnReplayPlaybackFocusRow,
  worldUnitsPerKm: number,
  visualSatelliteAltitudeWorld: number,
  allowProxy: boolean,
): readonly ModqnReplaySceneSatelliteVisual[] {
  const satelliteStates = focusRow.satelliteStates ?? [];
  const selectedSatId = focusRow.selectedServing.satId;
  const previousSatId = focusRow.previousServing.satId;

  return satelliteStates.flatMap(satellite => {
    const renderable = satelliteStateIsRenderable(satellite);
    const proxy = allowProxy && satelliteStateIsDisplayProxy(satellite);
    if (!renderable && !proxy) return [];

    const position = satelliteSubpointToScenePoint(
      satellite,
      worldUnitsPerKm,
      visualSatelliteAltitudeWorld,
    );
    if (position === null) return [];
    if (proxy && !isLocalFrameVisible(position)) return [];

    const selected = satellite.satId === selectedSatId;
    const previous = satellite.satId === previousSatId;
    const role = selected && previous
      ? 'selected-and-previous'
      : selected
        ? 'selected'
        : previous
          ? 'previous'
          : 'context';

    return [{
      producerSatId: satellite.satId,
      satIndex: satellite.satIndex,
      label: `SAT ${satellite.satIndex}`,
      position,
      role,
      localFrameVisible: isLocalFrameVisible(position),
      coordinateFrameKind: stringField(satellite, 'coordinateFrameKind'),
    }];
  });
}

function createFocusedUserVisual(
  focusRow: ModqnReplayPlaybackFocusRow,
  worldUnitsPerKm: number,
): ModqnReplaySceneFocusedUserVisual | null {
  const decisionPoint = producerPositionToScenePoint(focusRow.decisionUserPosition, worldUnitsPerKm);
  if (decisionPoint !== null) {
    return {
      userId: focusRow.userId,
      userIndex: focusRow.userIndex,
      position: decisionPoint,
      source: 'decisionUserPosition',
    };
  }

  const point = producerPositionToScenePoint(focusRow.userPosition, worldUnitsPerKm);
  return point === null
    ? null
    : {
      userId: focusRow.userId,
      userIndex: focusRow.userIndex,
      position: point,
      source: 'userPosition',
    };
}

function hasProducerFrequencyTruth(focusRow: ModqnReplayPlaybackFocusRow): boolean {
  return (focusRow.beamStates ?? []).some(beam => {
    const reuseGroup = stringField(beam, 'frequencyReuseGroup');
    return reuseGroup !== null
      && reuseGroup !== 'paper-unspecified'
      && !isDisplayOnlyProvenance(record(beam)?.frequencyReuseProvenance);
  });
}

function hasDisplayOnlyBeamFootprint(focusRow: ModqnReplayPlaybackFocusRow): boolean {
  return (focusRow.beamStates ?? []).some(beam => (
    isDisplayOnlyProvenance(record(beam)?.footprintProvenance)
  ));
}

function hasProxySatelliteState(focusRow: ModqnReplayPlaybackFocusRow): boolean {
  return (focusRow.satelliteStates ?? []).some(satellite => (
    satelliteCoordinateFrameKindIsProxy(stringField(satellite, 'coordinateFrameKind'))
  ));
}

function createTruthAudit({
  displayState,
  geometrySource,
  focusedUser,
  sourceBeamCount,
  rawBeamStateCount,
  rawSatelliteStateCount,
  renderedSatelliteStateCount,
  renderableSatelliteStateCount,
  displayOnlyBeamFootprint,
  proxySatelliteState,
}: {
  readonly displayState: ModqnReplayPlaybackDisplayState;
  readonly geometrySource: ModqnReplaySceneGeometrySource;
  readonly focusedUser: ModqnReplaySceneFocusedUserVisual | null;
  readonly sourceBeamCount: number;
  readonly rawBeamStateCount: number;
  readonly rawSatelliteStateCount: number;
  readonly renderedSatelliteStateCount: number;
  readonly renderableSatelliteStateCount: number;
  readonly displayOnlyBeamFootprint: boolean;
  readonly proxySatelliteState: boolean;
}): ModqnTrainingTruthAudit {
  const focusRow = displayState.currentSlot.focusRow;
  const hasRenderableT1Partial = renderableSatelliteStateCount > 0 && focusedUser !== null;
  const hasProxyT1Partial = renderedSatelliteStateCount > 0 && proxySatelliteState && focusedUser !== null;
  const hasRawT1Partial = rawSatelliteStateCount > 0 && focusedUser !== null;
  const hasT2Partial = geometrySource === 'producer-beam-state' && sourceBeamCount > 0;
  const hasFrequencyTruth = hasProducerFrequencyTruth(focusRow);

  const levels: readonly ModqnTrainingTruthLevelAudit[] = [
    {
      level: 'T0',
      name: 'replay-row truth',
      status: 'available',
      reason: 'selected action, previous action, event kind, scalar objective value, and masks are read from the replay row.',
      scenePolicy: 'Render focused row and textual/role cues.',
    },
    {
      level: 'T1',
      name: 'environment truth',
      status: hasRenderableT1Partial || hasProxyT1Partial || hasRawT1Partial ? 'partial' : 'absent',
      reason: hasRenderableT1Partial
        ? 'Focused UE and renderable per-row satellite states are present; all-UE coordinates are not retained in the playback shell.'
        : hasProxyT1Partial
          ? 'Focused UE and proxy satellite states are visible, but the satellite frame is a no-earth-rotation proxy and is not real orbit truth.'
        : hasRawT1Partial && proxySatelliteState
          ? 'Focused UE and raw satellite states are present, but the satellite frame is a no-earth-rotation proxy and is blocked from scene rendering.'
          : hasRawT1Partial
            ? 'Focused UE and raw satellite states are present, but they do not pass the renderable satellite geometry gate.'
            : 'Focused UE and satellite state fields are unavailable in the active display model.',
      scenePolicy: hasRenderableT1Partial
        ? 'Render focused UE and source-backed local-frame satellite markers.'
        : hasProxyT1Partial
          ? 'Render focused UE and proxy satellite markers with source gaps.'
          : hasRawT1Partial
            ? 'Render focused UE and report satellite source gaps; do not draw real satellite markers.'
          : 'Do not render environment geometry beyond row-level cues.',
    },
    {
      level: 'T2',
      name: 'beam geometry truth',
      status: hasT2Partial ? 'partial' : 'absent',
      reason: hasT2Partial
        ? 'Producer beamStates expose centers and footprint fields for the focused row.'
        : rawBeamStateCount > 0 && displayOnlyBeamFootprint
          ? 'Producer beamStates are present, but footprintProvenance.displayOnly=true blocks physical footprint rendering.'
          : rawBeamStateCount > 0
            ? 'Producer beamStates are present, but they do not pass the renderable beam geometry gate.'
            : 'Producer beam center/footprint fields are unavailable in the active display model.',
      scenePolicy: hasT2Partial
        ? 'Render producer beamState footprints for decision-valid beams.'
        : 'Use canonical board only; do not claim physical footprint truth.',
    },
    {
      level: 'T3',
      name: 'all-UE serving truth',
      status: 'absent',
      reason: 'The playback shell exposes one focused row, not per-UE serving history for every UE at every step.',
      scenePolicy: 'Do not color all UEs by serving beam.',
    },
    {
      level: 'T4',
      name: 'beam hopping scheduler truth',
      status: 'absent',
      reason: 'No active-beam mask or beam hopping schedule is exported for the active replay model.',
      scenePolicy: 'Do not animate beam hopping.',
    },
    {
      level: 'T5',
      name: 'frequency truth',
      status: hasFrequencyTruth ? 'available' : 'absent',
      reason: hasFrequencyTruth
        ? 'At least one producer beamState exposes a non-paper-unspecified frequency reuse group.'
        : 'The active replay model does not expose producer frequency/reuse assignments.',
      scenePolicy: hasFrequencyTruth
        ? 'Frequency coloring may be enabled by a separate source-backed layer.'
        : 'Do not use color to imply different frequencies.',
    },
  ];

  const availableLevels = levels.filter(level => level.status === 'available' || level.status === 'partial');
  const highestSceneLevel = availableLevels[availableLevels.length - 1]?.level ?? 'T0';
  const sourceGapCount = levels.filter(level => level.status !== 'available').length;

  return {
    levels,
    highestSceneLevel,
    sourceGapCount,
  };
}

export function deriveModqnReplaySceneVisualState(
  displayState: ModqnReplayPlaybackDisplayState | null,
  options: ModqnReplaySceneVisualOptions = {},
): ModqnReplaySceneVisualState | null {
  if (displayState === null) return null;

  const focusRow = displayState.currentSlot.focusRow;
  const worldUnitsPerKm = normalizeWorldUnitsPerKm(options.worldUnitsPerKm);
  const visualSatelliteAltitudeWorld = normalizeSatelliteAltitude(options.visualSatelliteAltitudeWorld);
  const renderableSourceLayout = createSourceBeamVisualLayout(
    focusRow,
    worldUnitsPerKm,
    'producer-beam-state',
  );
  const proxySourceLayout = renderableSourceLayout ?? createSourceBeamVisualLayout(
    focusRow,
    worldUnitsPerKm,
    'producer-display-proxy',
  );
  const sourceLayout = proxySourceLayout;
  const geometrySource: ModqnReplaySceneGeometrySource = sourceLayout === null
    ? 'display-canonical-lens'
    : sourceLayout.beams[0]?.geometrySource ?? 'display-canonical-lens';

  let rawPrevious: ModqnReplaySceneEndpointVisual | null = null;
  let rawSelected: ModqnReplaySceneEndpointVisual | null = null;
  let beams: readonly ModqnReplaySceneBeamVisual[] | null = null;

  if (sourceLayout !== null) {
    rawPrevious = endpointVisual(
      'previous',
      focusRow.previousServing,
      sourceLayout.previousPosition,
      geometrySource,
    );
    rawSelected = endpointVisual(
      'selected',
      focusRow.selectedServing,
      sourceLayout.selectedPosition,
      geometrySource,
    );
    beams = sourceLayout.beams;
  } else {
    const lensPositions = createBeamLensPositions(focusRow);
    const previousLensPosition = lensPositions.get(focusRow.previousServing.localBeamIndex);
    const selectedLensPosition = lensPositions.get(focusRow.selectedServing.localBeamIndex);
    if (previousLensPosition === undefined || selectedLensPosition === undefined) return null;

    rawPrevious = endpointVisual(
      'previous',
      focusRow.previousServing,
      previousLensPosition,
      'display-canonical-lens',
    );
    rawSelected = endpointVisual(
      'selected',
      focusRow.selectedServing,
      selectedLensPosition,
      'display-canonical-lens',
    );
    beams = createFallbackBeamVisuals(focusRow, lensPositions);
  }

  if (rawPrevious === null || rawSelected === null || beams === null) return null;

  const [previous, selected] = applyInterSatelliteLaneOffset(
    rawPrevious,
    rawSelected,
    geometrySource === 'display-canonical-lens',
  );
  const activeHandover = focusRow.handoverEventKind !== 'none';
  const satellites = createSatelliteVisuals(
    focusRow,
    worldUnitsPerKm,
    visualSatelliteAltitudeWorld,
    geometrySource === 'producer-display-proxy',
  );
  const focusedUser = createFocusedUserVisual(focusRow, worldUnitsPerKm);
  const rawBeamStateCount = focusRow.beamStates?.length ?? 0;
  const rawSatelliteStateCount = focusRow.satelliteStates?.length ?? 0;
  const renderableSatelliteStateCount = (focusRow.satelliteStates ?? [])
    .filter(satelliteStateIsRenderable)
    .length;
  const sourceBeamCount = beams.filter(beam => beam.geometrySource === 'producer-beam-state').length;
  const truthAudit = createTruthAudit({
    displayState,
    geometrySource,
    focusedUser,
    sourceBeamCount,
    rawBeamStateCount,
    rawSatelliteStateCount,
    renderedSatelliteStateCount: satellites.length,
    renderableSatelliteStateCount,
    displayOnlyBeamFootprint: hasDisplayOnlyBeamFootprint(focusRow),
    proxySatelliteState: hasProxySatelliteState(focusRow),
  });

  return {
    source: MODQN_REPLAY_SCENE_SOURCE,
    coordinateFrame: geometrySource === 'producer-beam-state'
      ? 'producer-local-tangent-display-layer'
      : geometrySource === 'producer-display-proxy'
        ? 'producer-local-tangent-display-layer'
      : 'scene-world-display-layer',
    modeLabel: displayState.modeLabel,
    evidenceStatus: displayState.evidenceStatus,
    sourceOwner: displayState.sourceOwner,
    sourcePath: displayState.sourcePath,
    slotIndex: displayState.currentSlot.slotIndex,
    sourceRowIndex: focusRow.sourceRowIndex,
    sourceRowNumber: focusRow.sourceRowIndex + 1,
    expectedProducerSatelliteCount: MODQN_REPLAY_SCENE_PRODUCER_SATELLITE_COUNT,
    producerSatelliteStateCount: rawSatelliteStateCount,
    renderedSatelliteStateCount: satellites.length,
    slotDecisionRowCount: displayState.currentSlot.rowCount,
    eventKind: focusRow.handoverEventKind,
    selectionSource: focusRow.selectedServingSource ?? 'producer',
    playing: displayState.playing,
    loopEnabled: displayState.loopEnabled,
    geometrySource,
    beams,
    satellites,
    focusedUser,
    previous,
    selected,
    switch: {
      eventKind: focusRow.handoverEventKind,
      activeHandover,
      activeIntraSatelliteSwitch: focusRow.handoverEventKind === 'intra-satellite-beam-switch',
      sourcePosition: previous.position,
      targetPosition: selected.position,
      label: formatSwitchLabel(focusRow.handoverEventKind),
    },
    truthAudit,
  };
}
