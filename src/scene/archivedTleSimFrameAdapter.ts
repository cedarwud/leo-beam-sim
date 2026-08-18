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
import type {
  SimulationAnalysisFrame,
  CanonicalLinkResult,
} from '../simulator/types';
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
  const current = adaptSimulationAnalysisFrameToHomepageTleScene(frame, { contextLimit: limit });
  const next = options.nextFrame;
  if (next === undefined || next === null || next.instantUtc === frame.instantUtc) return current;
  const nextScene = adaptSimulationAnalysisFrameToHomepageTleScene(next, { contextLimit: limit });
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
): BeamCellState {
  const satId = frame.selectedSatelliteId;
  const displayCell = placement?.cellByCanonicalId.get(cell.index);
  return {
    beamId: cell.index,
    offsetEastKm: displayCell?.centerKm[0] ?? cell.centerKm[0],
    offsetNorthKm: displayCell?.centerKm[1] ?? cell.centerKm[1],
    scanAngleDeg: 0,
    coreLayoutSatId: satId,
    coreBeamId: cellBeamIdentity(satId, cell.index),
    coreLocalBeamIndex: cell.index,
    reuseGroup: cell.color,
    runtimeFrequencyReuse: frame.parameters.frequencyReuse,
  };
}

function emptyAssignments(): ActiveBeamAssignment[] {
  return [];
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
): SinrLiveCellFrame {
  const selectedId = frame.selectedSatelliteId;
  const cells = frame.scenario.cells;
  const users = frame.scenario.users;
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
    const comparisonSinr = user.index === 0 ? frame.candidateLink?.sinrDb ?? null : null;
    return {
      ueId: `ue-${user.index + 1}`,
      cellId: user.cellIndex,
      cellDistanceKm: distance,
      offAxisDeg: canonicalUserOffAxisDeg(frame, user.index),
      sinrDb: canonicalUserSinrDb(frame, user.index),
      servingSatId: selectedId,
      beamIdentity: cellBeamIdentity(selectedId, user.cellIndex),
      frequencyIndex: cell.color,
      handoverKind: 'none',
      comparisonSatId: frame.tleState.candidateSatellite?.satelliteId ?? null,
      comparisonSinrDb: comparisonSinr,
      pendingTargetSatId: null,
      triggerProgressSec: 0,
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
    interHandoverCount: 0,
    cumulativeIntraHandoverCount: 0,
    cumulativeInterHandoverCount: 0,
    recentHandoverEvents: Object.freeze([]),
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
  const selectedLink = frame.links[0] ?? null;
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
  const selectedBeamCells = cells.map(cell => ({
    ...toBeamCellState(frame, cell, placement),
  }));
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
      pendingTargetSatId: null,
      pendingTargetBeamId: null,
      triggerProgressSec: 0,
    };
  });
  const selectedBeamHopState = {
    satId: selectedId,
    slotIndex: 0,
    frameSlotIndex: 0,
    activeBeamIds: cells.map(cell => cell.index),
    candidateBeamIds: [],
  };
  const cellTruth = buildCellTruth(frame, simTimeSec, placement);
  return {
    ...sim,
    satellites: [...visible],
    linkSamples: selectedLink === null ? [] : [toLinkSample(selectedLink)],
    activeAssignments: emptyAssignments(),
    displayAssignments: emptyAssignments(),
    beamCellsBySatId: new Map([[selectedId, selectedBeamCells]]),
    steeringBeamCellsBySatId: new Map([[selectedId, selectedBeamCells]]),
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
    beamHopStatesBySatId: new Map([[selectedId, selectedBeamHopState]]),
    serving: {
      satId: selectedId,
      beamId: frame.scenario.users[0]?.cellIndex ?? 0,
      sinrDb: selectedLink?.sinrDb ?? -Infinity,
    },
    pendingTargetSatId: null,
    pendingTargetBeamId: null,
    pendingTargetSinrDb: null,
    recentHoSourceSatId: null,
    recentHoTargetSatId: null,
    recentHoSourceBeamId: null,
    recentHoTargetBeamId: null,
    recentHoSourceSinrDb: null,
    recentHoTargetSinrDb: null,
    recentHoDeltaDb: null,
    lastHoEvent: null,
    handoverTriggerProgressSec: 0,
    hoCount: 0,
    intraHoCount: 0,
    lastHoReason: '',
    simTimeSec,
    intraHandoverEvent: null,
    intraHandoverPreview: null,
    intraHandoverWallClockStartMs: null,
    intraHandoverWallClockExpiresMs: null,
    interHandoverEvent: null,
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
