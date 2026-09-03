import * as THREE from 'three';
import {
  eciToGeodetic,
  gstime,
  radiansToDegrees,
  type EciVec3,
} from 'satellite.js';
import type { TopocentricPoint } from '../engine/orbit';
import type {
  ActiveBeamAssignment,
  LinkSample,
} from '../engine/signal/types';
import type { HandoverEvent } from '../engine/handover/types';
import type {
  SimulationAnalysisFrame,
  CanonicalLinkResult,
} from '../simulator/types';
import type { CanonicalTleHandoverAnchorTrace } from '../simulator/canonicalTleHandover';
import { deriveObserverLinkGeometry } from '../simulator/observer';
import {
  createEmptyFrame,
  createInterpolatedTopo,
} from './simulationHelpers';
import {
  adaptSimulationAnalysisFrameToHomepageTleScene,
  type HomepageTleSceneFrame,
  type HomepageTleSceneSatellite,
} from './homepageTleSceneAdapter';
import { interpolateHomepageTleSceneFrame } from './homepageTleVisualInterpolation';
import {
  buildArchivedTleSevenCellPlacement,
  remapArchivedTleUePosition,
  type ArchivedTleSevenCellPlacement,
} from './archivedTleSevenCellPlacement';
import {
  cellBeamIdentity,
  SINR_LIVE_RECENT_HANDOVER_RETENTION_SEC,
  type CellServingRecord,
  type IlluminatedCellBeam,
  type SinrLiveCellFrame,
  type UeCellServingRecord,
} from './sinrLiveCellModel';
import type {
  BeamCellState,
  SimFrame,
  VisibleSat,
} from './types';

/** The canonical scene has one fixed seven-cell / one-hundred-UE assignment. */
export const ARCHIVED_TLE_SCENE_CELL_COUNT = 7;
export const ARCHIVED_TLE_SCENE_UE_COUNT = 100;
export const ARCHIVED_TLE_SCENE_BEAM_COUNT = 7;
export const ARCHIVED_TLE_DEFAULT_CONTEXT_LIMIT = 24;

export interface ArchivedTleSimFrameAdapterOptions {
  /** Number of above-horizon non-selected/non-candidate TLE states to expose. */
  readonly contextLimit?: number;
  /** Display scale for the original renderer's ENU ground coordinates. */
  readonly worldUnitsPerKm?: number;
  /** Optional next completed TLE frame reserved for the caller's interpolation lane. */
  readonly nextFrame?: SimulationAnalysisFrame | null;
  /** Offset into the current→next completed-anchor interval, in seconds. */
  readonly visualOffsetSec?: number;
  /** Exact source-layout projection built by the active scene profile. */
  readonly displayPlacement?: ArchivedTleSevenCellPlacement;
  /** Additional TLE identities that an event projection must keep visible. */
  readonly retainSatelliteIds?: readonly string[];
}

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new Error(`archived TLE SimFrame ${label} must be finite`);
  return value;
}

function contextLimit(value: number | undefined): number {
  const resolved = value ?? ARCHIVED_TLE_DEFAULT_CONTEXT_LIMIT;
  if (!Number.isInteger(resolved) || resolved < 0) {
    throw new RangeError('archived TLE SimFrame contextLimit must be a non-negative integer');
  }
  return resolved;
}

function worldUnitsPerKm(value: number | undefined): number {
  const resolved = value ?? 1;
  if (!Number.isFinite(resolved) || resolved <= 0) {
    throw new RangeError('archived TLE SimFrame worldUnitsPerKm must be positive');
  }
  return resolved;
}

function geodeticPosition(
  satelliteId: string,
  positionTemeKm: HomepageTleSceneSatellite['positionTemeKm'],
  instantUtc: string,
): { readonly latDeg: number; readonly lonDeg: number; readonly altitudeKm: number } {
  const instantMs = Date.parse(instantUtc);
  if (!Number.isFinite(instantMs)) throw new Error(`archived TLE SimFrame invalid instantUtc: ${instantUtc}`);
  const geodetic = eciToGeodetic(
    positionTemeKm as EciVec3<number>,
    gstime(new Date(instantMs)),
  );
  return Object.freeze({
    latDeg: finite(radiansToDegrees(geodetic.latitude), `${satelliteId} latitude`),
    lonDeg: finite(radiansToDegrees(geodetic.longitude), `${satelliteId} longitude`),
    altitudeKm: finite(geodetic.height, `${satelliteId} altitude`),
  });
}

function visibleSatellite(
  satellite: HomepageTleSceneSatellite,
  instantUtc: string,
  frame: SimulationAnalysisFrame,
  visualIndex: number,
): VisibleSat {
  const geo = geodeticPosition(satellite.satelliteId, satellite.positionTemeKm, instantUtc);
  const topo: TopocentricPoint = createInterpolatedTopo(
    satellite.look.azimuthDeg,
    satellite.look.elevationDeg,
    satellite.look.rangeKm,
  );
  return {
    id: satellite.satelliteId,
    // Keep the shell identity source-derived and independent from the legacy
    // Walker shell IDs.  The propagation frame remains the authority for the
    // satellite identity and TEME position.
    shellId: `archived-tle-${frame.provenance.constellation}`,
    altitudeKm: geo.altitudeKm,
    world: new THREE.Vector3(...satellite.worldPosition),
    topo,
    latDeg: geo.latDeg,
    lonDeg: geo.lonDeg,
    satelliteVisualIndex: visualIndex,
  };
}

function resolveVisualScene(
  frame: SimulationAnalysisFrame,
  options: ArchivedTleSimFrameAdapterOptions,
): HomepageTleSceneFrame {
  const limit = contextLimit(options.contextLimit);
  const next = options.nextFrame;
  const retainedEndpointIds = new Set(options.retainSatelliteIds ?? []);
  for (const trace of [frame.handover, next?.handover]) {
    if (trace?.eventFromSatelliteId !== null && trace?.eventFromSatelliteId !== undefined) {
      retainedEndpointIds.add(trace.eventFromSatelliteId);
    }
    if (trace?.eventToSatelliteId !== null && trace?.eventToSatelliteId !== undefined) {
      retainedEndpointIds.add(trace.eventToSatelliteId);
    }
  }
  const retainSatelliteIds = [...retainedEndpointIds];
  const current = adaptSimulationAnalysisFrameToHomepageTleScene(frame, {
    contextLimit: limit,
    retainSatelliteIds,
  });
  if (next === undefined || next === null || next.instantUtc === frame.instantUtc) return current;
  const nextScene = adaptSimulationAnalysisFrameToHomepageTleScene(next, {
    contextLimit: limit,
    retainSatelliteIds,
  });
  return interpolateHomepageTleSceneFrame(current, nextScene, options.visualOffsetSec ?? 0);
}

function visibleSatellites(
  scene: HomepageTleSceneFrame,
  frame: SimulationAnalysisFrame,
): readonly VisibleSat[] {
  return Object.freeze(scene.satellites.map((satellite, index) => (
    visibleSatellite(satellite, scene.instantUtc, frame, index)
  )));
}

function toBeamCellState(
  frame: SimulationAnalysisFrame,
  cell: SimulationAnalysisFrame['scenario']['cells'][number],
  placement?: ArchivedTleSevenCellPlacement,
  satelliteId = frame.selectedSatelliteId,
): BeamCellState {
  const displayCell = placement?.cellByCanonicalId.get(cell.index);
  return {
    beamId: cell.index,
    offsetEastKm: displayCell?.centerKm[0] ?? cell.centerKm[0],
    offsetNorthKm: displayCell?.centerKm[1] ?? cell.centerKm[1],
    scanAngleDeg: 0,
    coreLayoutSatId: satelliteId,
    coreBeamId: cellBeamIdentity(satelliteId, cell.index),
    coreLocalBeamIndex: cell.index,
    reuseGroup: cell.color,
    runtimeFrequencyReuse: frame.parameters.frequencyReuse,
  };
}

function assignment(satId: string, beamId: number): ActiveBeamAssignment {
  return { satId, beamId };
}

interface ArchivedTleHandoverProjection {
  readonly trace: CanonicalTleHandoverAnchorTrace | null;
  readonly representativeUserIndex: number;
  readonly representativeUeId: string;
  readonly candidateLink: CanonicalLinkResult | null;
  readonly candidateBeamId: number | null;
  readonly pendingTargetSatId: string | null;
  readonly pendingTargetBeamId: number | null;
  readonly pendingTargetSinrDb: number | null;
  readonly event: {
    readonly fromSatId: string;
    readonly toSatId: string;
    readonly fromBeamId: number;
    readonly toBeamId: number;
  } | null;
  readonly lastHoEvent: HandoverEvent | null;
}

function resolveRepresentativeUserIndex(frame: SimulationAnalysisFrame): number {
  const linkIndex = frame.links[0]?.userIndex;
  if (linkIndex !== undefined && frame.scenario.users.some(user => user.index === linkIndex)) {
    return linkIndex;
  }
  const servedIndex = frame.inputs.frame.servingBeamU.findIndex(beamId => beamId >= 0);
  return servedIndex >= 0 ? servedIndex : 0;
}

function buildHandoverProjection(
  frame: SimulationAnalysisFrame,
  selectedLink: CanonicalLinkResult | null,
): ArchivedTleHandoverProjection {
  const trace = frame.handover ?? null;
  const representativeIndex = resolveRepresentativeUserIndex(frame);
  const representativeUeId = `ue-${representativeIndex + 1}`;
  const candidateLink = frame.candidateLink !== null
    && frame.candidateLink.satelliteId !== frame.selectedSatelliteId
    ? frame.candidateLink
    : null;

  if (trace === null) {
    return {
      trace,
      representativeUserIndex: representativeIndex,
      representativeUeId,
      candidateLink,
      candidateBeamId: candidateLink?.beamId ?? null,
      pendingTargetSatId: null,
      pendingTargetBeamId: null,
      pendingTargetSinrDb: null,
      event: null,
      lastHoEvent: null,
    };
  }

  if (trace.servingSatelliteId !== frame.selectedSatelliteId) {
    throw new Error(
      `archived TLE SimFrame handover serving identity ${trace.servingSatelliteId} `
      + `does not match selected frame satellite ${frame.selectedSatelliteId}`,
    );
  }
  if (trace.candidateSatelliteId === frame.selectedSatelliteId) {
    throw new Error('archived TLE SimFrame handover candidate reuses the serving identity');
  }

  const candidateBeamId = candidateLink?.satelliteId === trace.candidateSatelliteId
    ? candidateLink.beamId
    : null;
  if (trace.state === 'pending') {
    if (trace.candidateSatelliteId === null) {
      throw new Error('archived TLE SimFrame pending handover has no candidate identity');
    }
    if (candidateLink === null || candidateLink.satelliteId !== trace.candidateSatelliteId) {
      throw new Error(
        `archived TLE SimFrame pending candidate ${trace.candidateSatelliteId} `
        + 'does not match the immutable candidate link',
      );
    }
  }

  const isServingChange = trace.event === 'inter-handover' || trace.event === 'forced-continuity';
  if (isServingChange) {
    if (
      trace.eventFromSatelliteId === null
      || trace.eventToSatelliteId === null
      || trace.eventFromSatelliteId === trace.eventToSatelliteId
      || trace.eventToSatelliteId !== frame.selectedSatelliteId
    ) {
      throw new Error('archived TLE SimFrame serving-change trace has inconsistent endpoint identities');
    }
  }

  const event = isServingChange
    ? {
      fromSatId: trace.eventFromSatelliteId!,
      toSatId: trace.eventToSatelliteId!,
      fromBeamId: frame.scenario.users[representativeIndex]?.cellIndex ?? 0,
      toBeamId: selectedLink?.beamId ?? frame.scenario.users[representativeIndex]?.cellIndex ?? 0,
    }
    : null;
  const lastHoEvent: HandoverEvent | null = event === null
    ? null
    : {
      timeMs: Math.round((frame.runAnchor?.elapsedSec ?? 0) * 1_000),
      action: 'inter-handover',
      fromSatId: event.fromSatId,
      fromBeamId: event.fromBeamId,
      fromSinrDb: null,
      toSatId: event.toSatId,
      toBeamId: event.toBeamId,
      toSinrDb: selectedLink?.sinrDb ?? trace.servingSinrDb ?? -Infinity,
      deltaDb: null,
    };

  return {
    trace,
    representativeUserIndex: representativeIndex,
    representativeUeId,
    candidateLink,
    candidateBeamId,
    pendingTargetSatId: trace.state === 'pending' ? trace.candidateSatelliteId : null,
    pendingTargetBeamId: trace.state === 'pending' ? candidateBeamId : null,
    pendingTargetSinrDb: trace.state === 'pending' ? trace.candidateSinrDb : null,
    event,
    lastHoEvent,
  };
}

function canonicalUserSinrDb(
  frame: SimulationAnalysisFrame,
  userIndex: number,
): number | null {
  const servingBeam = frame.inputs.frame.servingBeamU[userIndex] ?? -1;
  if (servingBeam < 0) return null;
  const sinrLinear = finite(
    frame.canonical.throughput.sinrU[userIndex] ?? 0,
    `canonical user ${userIndex} SINR`,
  );
  return 10 * Math.log10(Math.max(sinrLinear, 1e-30));
}

function canonicalUserOffAxisDeg(
  frame: SimulationAnalysisFrame,
  userIndex: number,
): number {
  const servingBeam = frame.inputs.frame.servingBeamU[userIndex] ?? -1;
  if (servingBeam < 0) return 0;
  const theta = frame.inputs.frame.thetaRadUb[userIndex]?.[servingBeam] ?? 0;
  return Math.abs(finite(theta, `canonical user ${userIndex} off-axis angle`)) * 180 / Math.PI;
}

function buildCellTruth(
  frame: SimulationAnalysisFrame,
  simTimeSec: number,
  placement?: ArchivedTleSevenCellPlacement,
  handover?: ArchivedTleHandoverProjection,
): SinrLiveCellFrame {
  const selectedId = frame.selectedSatelliteId;
  const cells = frame.scenario.cells;
  const users = frame.scenario.users;
  const primaryUserIndex = handover?.representativeUserIndex ?? resolveRepresentativeUserIndex(frame);
  const representativeUeId = `ue-${primaryUserIndex + 1}`;
  const eventSourceTimeSec = frame.runAnchor?.elapsedSec ?? simTimeSec;
  const cellById = new Map(cells.map(cell => [cell.index, cell]));
  const sinrByCell = new Map<number, number[]>();
  for (const user of users) {
    const sinrDb = canonicalUserSinrDb(frame, user.index);
    if (sinrDb === null) continue;
    const existing = sinrByCell.get(user.cellIndex) ?? [];
    existing.push(sinrDb);
    sinrByCell.set(user.cellIndex, existing);
  }

  const cellRecords: CellServingRecord[] = cells.map(cell => {
    const cellSinr = sinrByCell.get(cell.index) ?? [];
    return {
      cellId: cell.index,
      servingSatId: selectedId,
      beamIdentity: cellBeamIdentity(selectedId, cell.index),
      frequencyIndex: cell.color,
      servingSinrDb: cellSinr.length === 0
        ? null
        : cellSinr.reduce((sum, value) => sum + value, 0) / cellSinr.length,
      candidateCount: frame.tleState.candidateSatellite === null ? 1 : 2,
    };
  });

  const ueRecords: UeCellServingRecord[] = users.map(user => {
    const cell = cellById.get(user.cellIndex);
    if (cell === undefined) throw new Error(`canonical scenario missing cell ${user.cellIndex}`);
    const displayPosition = placement === undefined
      ? user.positionKm
      : remapArchivedTleUePosition(placement, user);
    const displayCell = placement?.cellByCanonicalId.get(cell.index);
    const eastDelta = displayPosition[0] - (displayCell?.centerKm[0] ?? cell.centerKm[0]);
    const northDelta = displayPosition[1] - (displayCell?.centerKm[1] ?? cell.centerKm[1]);
    const distance = Math.hypot(eastDelta, northDelta);
    const isRepresentative = user.index === primaryUserIndex;
    const comparisonSatId = isRepresentative
      ? handover?.candidateLink?.satelliteId ?? frame.tleState.candidateSatellite?.satelliteId ?? null
      : null;
    const comparisonSinr = isRepresentative
      ? handover?.candidateLink?.sinrDb ?? null
      : null;
    const isCommitted = isRepresentative && handover?.event !== null;
    return {
      ueId: `ue-${user.index + 1}`,
      cellId: user.cellIndex,
      cellDistanceKm: distance,
      offAxisDeg: canonicalUserOffAxisDeg(frame, user.index),
      sinrDb: canonicalUserSinrDb(frame, user.index),
      servingSatId: selectedId,
      beamIdentity: cellBeamIdentity(selectedId, user.cellIndex),
      frequencyIndex: cell.color,
      handoverKind: isCommitted ? 'inter' : 'none',
      comparisonSatId,
      comparisonSinrDb: comparisonSinr,
      pendingTargetSatId: isRepresentative ? handover?.pendingTargetSatId ?? null : null,
      triggerProgressSec: isRepresentative ? handover?.trace?.progressSec ?? 0 : 0,
    };
  });

  const illuminatedBeams: IlluminatedCellBeam[] = cells.map(cell => ({
    satId: selectedId,
    cellId: cell.index,
    frequencyIndex: cell.color,
    serving: true,
  }));
  return {
    simTimeSec,
    cells: Object.freeze(cellRecords),
    ues: Object.freeze(ueRecords),
    illuminatedBeams: Object.freeze(illuminatedBeams),
    servedCellCount: cells.length,
    servedUeCount: users.length,
    servingSatCount: 1,
    intraHandoverCount: 0,
    interHandoverCount: handover?.event === null || handover?.event === undefined ? 0 : 1,
    cumulativeIntraHandoverCount: 0,
    cumulativeInterHandoverCount: handover?.trace?.cumulativeCount ?? 0,
    primaryUeId: representativeUeId,
    recentHandoverEvents: handover?.event === null || handover?.event === undefined
      ? Object.freeze([])
      : Object.freeze([{
        ueId: representativeUeId,
        kind: 'inter' as const,
        sourceTimeSec: eventSourceTimeSec,
        fromSatId: handover.event.fromSatId,
        fromCellId: handover.event.fromBeamId,
        toSatId: handover.event.toSatId,
        toCellId: handover.event.toBeamId,
        fromSinrDb: null,
        toSinrDb: handover.trace?.servingSinrDb ?? null,
        deltaDb: null,
      }]),
  };
}

function validateScenario(frame: SimulationAnalysisFrame): void {
  if (frame.scenario.cells.length !== ARCHIVED_TLE_SCENE_CELL_COUNT) {
    throw new Error(`archived TLE SimFrame requires ${ARCHIVED_TLE_SCENE_CELL_COUNT} cells`);
  }
  if (frame.scenario.users.length !== ARCHIVED_TLE_SCENE_UE_COUNT) {
    throw new Error(`archived TLE SimFrame requires ${ARCHIVED_TLE_SCENE_UE_COUNT} UEs`);
  }
  if (frame.scenario.beamActiveB.length !== ARCHIVED_TLE_SCENE_BEAM_COUNT) {
    throw new Error(`archived TLE SimFrame requires ${ARCHIVED_TLE_SCENE_BEAM_COUNT} active beams`);
  }
}

/**
 * Adapt one immutable archived-TLE/canonical frame to the existing live scene
 * renderer's `SimFrame` boundary.
 *
 * This is deliberately a projection only: it reads SGP4 states, scenario
 * geometry and published link ledgers; it never calls a link-budget function,
 * selects a handover, or advances a Walker/runtime simulation.
 */
export function adaptSimulationAnalysisFrameToArchivedTleSimFrame(
  frame: SimulationAnalysisFrame,
  options: ArchivedTleSimFrameAdapterOptions = {},
): SimFrame {
  // The adapter itself remains an immutable-frame projection.  The optional
  // interpolation inputs are accepted at this seam so MainScene can pass the
  // completed adjacent anchor without changing the renderer contract; callers
  // that need interpolation should first materialize an interpolated
  // SimulationAnalysisFrame and pass that frame here.
  if (options.nextFrame !== undefined && options.nextFrame !== null) {
    if (options.nextFrame.provenance.sourceKind !== frame.provenance.sourceKind) {
      throw new Error('archived TLE SimFrame nextFrame source kind must match current frame');
    }
    if (options.visualOffsetSec !== undefined && !Number.isFinite(options.visualOffsetSec)) {
      throw new RangeError('archived TLE SimFrame visualOffsetSec must be finite');
    }
  }
  validateScenario(frame);
  const visualScene = resolveVisualScene(frame, options);
  const visible = visibleSatellites(visualScene, frame);
  const selectedId = frame.selectedSatelliteId;
  const scale = worldUnitsPerKm(options.worldUnitsPerKm);
  const visualElapsedSec = Math.max(
    0,
    (Date.parse(visualScene.instantUtc) - Date.parse(frame.instantUtc)) / 1_000,
  );
  const simTimeSec = (frame.runAnchor?.elapsedSec ?? 0) + visualElapsedSec;
  const sim = createEmptyFrame(simTimeSec);
  const cells = frame.scenario.cells;
  const placement = options.displayPlacement ?? buildArchivedTleSevenCellPlacement({
    cells,
    sourceCellRadiusKm: frame.scenario.topology.cellRadiusKm,
  });
  const selectedLink = frame.links.find(link => (
    link.satelliteId === selectedId && link.userIndex === resolveRepresentativeUserIndex(frame)
  ))
    ?? frame.links.find(link => link.satelliteId === selectedId)
    ?? null;
  const handover = buildHandoverProjection(frame, selectedLink);
  const displaySatelliteIds = new Set<string>([selectedId]);
  if (handover.pendingTargetSatId !== null) displaySatelliteIds.add(handover.pendingTargetSatId);
  if (handover.event !== null) displaySatelliteIds.add(handover.event.fromSatId);
  if (handover.candidateLink !== null) displaySatelliteIds.add(handover.candidateLink.satelliteId);
  const beamCellsBySatId = new Map<string, BeamCellState[]>();
  const steeringBeamCellsBySatId = new Map<string, BeamCellState[]>();
  for (const satelliteId of displaySatelliteIds) {
    const satelliteCells = cells.map(cell => toBeamCellState(frame, cell, placement, satelliteId));
    beamCellsBySatId.set(satelliteId, satelliteCells);
    steeringBeamCellsBySatId.set(satelliteId, satelliteCells);
  }
  const perUePositions = frame.scenario.users.map(user => {
    const displayPosition = remapArchivedTleUePosition(placement, user);
    return {
      id: `ue-${user.index + 1}`,
      groundX: displayPosition[0] * scale,
      groundZ: -displayPosition[1] * scale,
      eastKm: displayPosition[0],
      northKm: displayPosition[1],
      sinrDb: canonicalUserSinrDb(frame, user.index),
      servingSatId: selectedId,
      servingBeamId: user.cellIndex,
      pendingTargetSatId: user.index === handover.representativeUserIndex
        ? handover.pendingTargetSatId
        : null,
      pendingTargetBeamId: user.index === handover.representativeUserIndex
        ? handover.pendingTargetBeamId
        : null,
      triggerProgressSec: user.index === handover.representativeUserIndex
        ? handover.trace?.progressSec ?? 0
        : 0,
    };
  });
  const beamHopStatesBySatId = new Map<string, {
    satId: string;
    slotIndex: number;
    frameSlotIndex: number;
    activeBeamIds: number[];
    candidateBeamIds: number[];
  }>();
  for (const satelliteId of displaySatelliteIds) {
    const isServing = satelliteId === selectedId;
    const isPending = satelliteId === handover.pendingTargetSatId;
    const beamId = isPending ? handover.pendingTargetBeamId : null;
    beamHopStatesBySatId.set(satelliteId, {
      satId: satelliteId,
      slotIndex: 0,
      frameSlotIndex: 0,
      activeBeamIds: isServing ? cells.map(cell => cell.index) : [],
      candidateBeamIds: beamId === null ? [] : [beamId],
    });
  }
  const activeAssignments: ActiveBeamAssignment[] = cells.map(cell => assignment(selectedId, cell.index));
  const displayAssignments: ActiveBeamAssignment[] = [...activeAssignments];
  if (handover.pendingTargetSatId !== null && handover.pendingTargetBeamId !== null) {
    displayAssignments.push(assignment(handover.pendingTargetSatId, handover.pendingTargetBeamId));
  }
  if (handover.event !== null) {
    displayAssignments.push(assignment(handover.event.fromSatId, handover.event.fromBeamId));
  }
  const linkSamples = [
    ...(selectedLink === null ? [] : [toLinkSample(selectedLink)]),
    ...(handover.candidateLink === null ? [] : [toLinkSample(handover.candidateLink)]),
  ];
  const cellTruth = buildCellTruth(frame, simTimeSec, placement, handover);
  const committedEvent = handover.event;
  const eventSourceTimeSec = frame.runAnchor?.elapsedSec ?? simTimeSec;
  const recentSourceSinrDb = handover.lastHoEvent?.fromSinrDb ?? null;
  const recentTargetSinrDb = handover.lastHoEvent?.toSinrDb ?? null;
  return {
    ...sim,
    satellites: [...visible],
    linkSamples,
    activeAssignments,
    displayAssignments,
    beamCellsBySatId,
    steeringBeamCellsBySatId,
    linkRangeKmBySatId: new Map(
      visualScene.satellites.map(satellite => [
        satellite.satelliteId,
        deriveObserverLinkGeometry(satellite.positionTemeKm, visualScene.instantUtc).rangeKm,
      ]),
    ),
    beamHopSlotIndex: 0,
    beamHopSlotStartSec: 0,
    beamHopSlotSec: 0,
    beamHopEnabled: false,
    beamHopStatesBySatId,
    serving: {
      satId: selectedId,
      beamId: selectedLink?.beamId ?? frame.scenario.users[handover.representativeUserIndex]?.cellIndex ?? 0,
      sinrDb: selectedLink?.sinrDb ?? -Infinity,
    },
    pendingTargetSatId: handover.pendingTargetSatId,
    pendingTargetBeamId: handover.pendingTargetBeamId,
    pendingTargetSinrDb: handover.pendingTargetSinrDb,
    recentHoSourceSatId: committedEvent?.fromSatId ?? null,
    recentHoTargetSatId: committedEvent?.toSatId ?? null,
    recentHoSourceBeamId: committedEvent?.fromBeamId ?? null,
    recentHoTargetBeamId: committedEvent?.toBeamId ?? null,
    recentHoSourceSinrDb: recentSourceSinrDb,
    recentHoTargetSinrDb: recentTargetSinrDb,
    recentHoDeltaDb: handover.lastHoEvent?.deltaDb ?? null,
    lastHoEvent: handover.lastHoEvent,
    handoverTriggerProgressSec: handover.trace?.state === 'pending'
      ? handover.trace.progressSec
      : 0,
    hoCount: handover.trace?.cumulativeCount ?? 0,
    intraHoCount: 0,
    lastHoReason: handover.trace !== null
      && (handover.trace.state === 'pending' || handover.trace.state === 'handover' || handover.trace.state === 'forced-continuity')
      ? handover.trace.reason
      : '',
    simTimeSec,
    intraHandoverEvent: null,
    intraHandoverPreview: null,
    intraHandoverWallClockStartMs: null,
    intraHandoverWallClockExpiresMs: null,
    interHandoverEvent: committedEvent === null ? null : {
      fromSatId: committedEvent.fromSatId,
      fromBeamId: committedEvent.fromBeamId,
      toSatId: committedEvent.toSatId,
      toBeamId: committedEvent.toBeamId,
      triggeredAtSec: eventSourceTimeSec,
      expiresAtSec: eventSourceTimeSec + SINR_LIVE_RECENT_HANDOVER_RETENTION_SEC,
    },
    interHandoverWallClockStartMs: null,
    interHandoverWallClockExpiresMs: null,
    ueGroundX: perUePositions[0]?.groundX ?? 0,
    ueGroundZ: perUePositions[0]?.groundZ ?? 0,
    perUePositions,
    sinrLiveCells: cellTruth,
  };
}

function toLinkSample(link: CanonicalLinkResult): LinkSample {
  const dbm = (watts: number): number => watts > 0 ? 10 * Math.log10(watts * 1000) : -Infinity;
  return {
    ueId: link.userId,
    satId: link.satelliteId,
    beamId: link.beamId,
    rsrpDbm: dbm(link.signalW),
    sinrDb: link.sinrDb,
    signalDbm: dbm(link.signalW),
    intraInterferenceDbm: dbm(link.interferenceW),
    interInterferenceDbm: -Infinity,
    noiseDbm: dbm(link.noiseW),
    denominatorDbm: dbm(link.interferenceW + link.noiseW),
    txPowerDbm: dbm(link.actualPowerW),
    pathLossDb: 0,
    beamGainDb: 0,
    steeringLossDb: 0,
    receiverGainDbi: 0,
  };
}

export const createArchivedTleSimFrame = adaptSimulationAnalysisFrameToArchivedTleSimFrame;
