import {
  computeCanonicalEe,
  computeCanonicalEvaluation,
  type CanonicalEeInput,
} from '../analysis/canonicalEe';
import {
  asiaTaipeiToUtc,
  parseUtcInstant,
  utcToAsiaTaipei,
} from '../tle/timezone';
import {
  createTlePropagationFrame,
  propagateTleSnapshot,
} from '../tle/propagation';
import { resolveTleSnapshot } from '../tle/resolver';
import type { Vector3 } from '../tle/types';
import type {
  LoadedTleSnapshotWindow,
  OrbitTrajectoryPoint,
  SimulationAnalysisFrame,
  SimulatorParameters,
  SimulatorTleState,
} from './types';
import { SIMULATOR_CONTRACT_VERSION, SIMULATOR_TIME_ZONE } from './types';

const TAIPEI_LATITUDE_RAD = (25.0330 * Math.PI) / 180;
const TAIPEI_LONGITUDE_RAD = (121.5654 * Math.PI) / 180;
const EARTH_RADIUS_KM = 6378.137;
const NORMALIZED_LINK_SCALE = 1e-8;
const TRAJECTORY_HALF_WINDOW_SEC = 30 * 60;
const TRAJECTORY_STEP_SEC = 5 * 60;
const CANONICAL_AUTHORITY = '/home/u24/papers/modqn-paper-reproduction/docs/ADR-003-canonical-ee-closure.md';

function freeze<T>(value: T): T {
  return Object.freeze(value);
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return value;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function finitePositive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${label} must be finite and positive`);
  return value;
}

function finiteFraction(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0 || value > 1) throw new RangeError(`${label} must be in (0, 1]`);
  return value;
}

function normalizeParameters(parameters: SimulatorParameters): SimulatorParameters {
  return freeze({
    beamPowerCapW: finitePositive(parameters.beamPowerCapW, 'beamPowerCapW'),
    satellitePowerCapW: finitePositive(parameters.satellitePowerCapW, 'satellitePowerCapW'),
    etaMax: finiteFraction(parameters.etaMax, 'etaMax'),
    rfcPowerW: finitePositive(parameters.rfcPowerW, 'rfcPowerW'),
    basebandPerSatelliteW: finitePositive(parameters.basebandPerSatelliteW, 'basebandPerSatelliteW'),
    minimumRateBps: finitePositive(parameters.minimumRateBps, 'minimumRateBps'),
    beamBandwidthHz: finitePositive(parameters.beamBandwidthHz, 'beamBandwidthHz'),
  });
}

function fnvHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function vectorSubtract(left: Vector3, right: Vector3): Vector3 {
  return { x: left.x - right.x, y: left.y - right.y, z: left.z - right.z };
}

function vectorDot(left: Vector3, right: Vector3): number {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

function vectorNorm(value: Vector3): number {
  return Math.hypot(value.x, value.y, value.z);
}

function vectorScale(value: Vector3, scale: number): Vector3 {
  return { x: value.x * scale, y: value.y * scale, z: value.z * scale };
}

function unitVector(value: Vector3): Vector3 {
  const length = vectorNorm(value);
  if (!Number.isFinite(length) || length <= 0) throw new Error('SGP4 produced a zero-length position vector');
  return vectorScale(value, 1 / length);
}

function julianDate(ms: number): number {
  return ms / 86_400_000 + 2_440_587.5;
}

/** Greenwich mean sidereal angle, sufficient for the fixed ground-site view. */
function gmstRadians(ms: number): number {
  const jd = julianDate(ms);
  const centuries = (jd - 2_451_545.0) / 36_525;
  const degrees = 280.46061837
    + 360.98564736629 * (jd - 2_451_545.0)
    + 0.000387933 * centuries ** 2
    - centuries ** 3 / 38_710_000;
  return ((degrees % 360) + 360) % 360 * Math.PI / 180;
}

/** Convert the Taipei site from Earth-fixed to the approximate TEME/ECI view. */
function taipeiPositionTemeKm(ms: number): Vector3 {
  const cosLat = Math.cos(TAIPEI_LATITUDE_RAD);
  const ecef = {
    x: EARTH_RADIUS_KM * cosLat * Math.cos(TAIPEI_LONGITUDE_RAD),
    y: EARTH_RADIUS_KM * cosLat * Math.sin(TAIPEI_LONGITUDE_RAD),
    z: EARTH_RADIUS_KM * Math.sin(TAIPEI_LATITUDE_RAD),
  };
  const theta = gmstRadians(ms);
  return {
    x: Math.cos(theta) * ecef.x - Math.sin(theta) * ecef.y,
    y: Math.sin(theta) * ecef.x + Math.cos(theta) * ecef.y,
    z: ecef.z,
  };
}

export interface LinkGeometry {
  readonly offAxisAngleRad: number;
  readonly distanceKm: number;
  readonly elevationDeg: number;
  readonly propagationGain: number;
  readonly groundPositionTemeKm: Vector3;
}

export function deriveTaipeiLinkGeometry(
  satellitePositionTemeKm: Vector3,
  instantUtc: string,
): LinkGeometry {
  const instant = parseUtcInstant(instantUtc, 'instantUtc');
  const groundPositionTemeKm = taipeiPositionTemeKm(instant.ms);
  const relative = vectorSubtract(satellitePositionTemeKm, groundPositionTemeKm);
  const distanceKm = vectorNorm(relative);
  const look = unitVector(relative);
  const groundUp = unitVector(groundPositionTemeKm);
  const satelliteNadir = vectorScale(unitVector(satellitePositionTemeKm), -1);
  const satelliteToGround = vectorScale(look, -1);
  const offAxisAngleRad = Math.acos(clamp(vectorDot(satelliteNadir, satelliteToGround), -1, 1));
  const elevationDeg = Math.asin(clamp(vectorDot(look, groundUp), -1, 1)) * 180 / Math.PI;
  // This normalized free-space factor is deliberately explicit: the formal
  // producer consumes a non-negative channel term, while this adapter keeps
  // the TLE geometry observable without claiming a calibrated RF link budget.
  // The explicit 1e-8 link scale keeps the demonstration in a useful RF-cap
  // range without pretending to be a calibrated carrier-frequency link
  // budget. It is scenario metadata, not part of the canonical EE algebra.
  const propagationGain = NORMALIZED_LINK_SCALE / Math.max((distanceKm / 1_000) ** 2, 1);
  return freeze({
    offAxisAngleRad,
    distanceKm,
    elevationDeg,
    propagationGain,
    groundPositionTemeKm: freeze(groundPositionTemeKm),
  });
}

function buildTrajectory(
  snapshot: Parameters<typeof propagateTleSnapshot>[0],
  requestedMs: number,
): readonly OrbitTrajectoryPoint[] {
  const points: OrbitTrajectoryPoint[] = [];
  for (let offset = -TRAJECTORY_HALF_WINDOW_SEC; offset <= TRAJECTORY_HALF_WINDOW_SEC; offset += TRAJECTORY_STEP_SEC) {
    const instantUtc = new Date(requestedMs + offset * 1_000).toISOString();
    const propagated = propagateTleSnapshot(snapshot, instantUtc);
    points.push(freeze({ instantUtc, positionTemeKm: propagated.positionTemeKm }));
  }
  return freeze(points);
}

export function createSimulatorTleState(
  window: LoadedTleSnapshotWindow,
  requestedInstantUtc: string,
  selectedSatelliteId?: string,
): SimulatorTleState {
  const requested = parseUtcInstant(requestedInstantUtc, 'requestedInstantUtc');
  const candidateIds = [...new Set(window.current.entries.map(entry => entry.satelliteId))].sort();
  if (candidateIds.length === 0) throw new Error('current TLE snapshot contains no satellites');
  const propagationFrame = createTlePropagationFrame(
    window.manifest,
    requested.value,
    {
      satelliteIds: candidateIds,
      maxPropagationAgeMs: window.catalog.maxPropagationAgeMs,
    },
  );
  const scored = propagationFrame.satellites
    .map(satellite => ({
      satellite,
      geometry: deriveTaipeiLinkGeometry(satellite.positionTemeKm, requested.value),
    }))
    .sort((left, right) => right.geometry.elevationDeg - left.geometry.elevationDeg);
  const selected = selectedIdsOrBest(scored, selectedSatelliteId);
  const selectedSnapshot = resolveTleSnapshot(
    window.manifest,
    requested.value,
    selected.satellite.satelliteId,
    { maxPropagationAgeMs: window.catalog.maxPropagationAgeMs },
  );
  if (selected.geometry.elevationDeg < 0) {
    throw new Error('no archived OneWeb satellite is above the Taipei horizon at the requested instant');
  }
  const selectedSatellite = selected.satellite;
  const groundPositionTemeKm = selected.geometry.groundPositionTemeKm;
  const trajectory = buildTrajectory(selectedSnapshot, requested.ms);
  return deepFreeze({
    requestedInstantUtc: requested.value,
    selectedSatelliteId: selected.satellite.satelliteId,
    selectedSnapshot,
    propagationFrame,
    selectedSatellite,
    groundPositionTemeKm,
    trajectory,
    currentArchiveDate: window.current.metadata.archiveDate,
    previousArchiveDate: window.previous?.metadata.archiveDate ?? null,
    currentSnapshot: window.current,
    previousSnapshot: window.previous,
    catalog: window.catalog,
  });
}

function selectedIdsOrBest(
  scored: readonly {
    readonly satellite: SimulatorTleState['selectedSatellite'];
    readonly geometry: LinkGeometry;
  }[],
  requestedSatelliteId?: string,
): (typeof scored)[number] {
  if (requestedSatelliteId !== undefined) {
    const requested = scored.find(candidate => candidate.satellite.satelliteId === requestedSatelliteId);
    if (requested !== undefined) return requested;
  }
  const best = scored[0];
  if (best === undefined) throw new Error('SGP4 frame contains no selected satellite');
  return best;
}

function canonicalInputFromGeometry(
  tleState: SimulatorTleState,
  parameters: SimulatorParameters,
  geometry: LinkGeometry,
): CanonicalEeInput {
  return {
    config: {
      noisePowerW: 1e-9,
      beamBandwidthHz: parameters.beamBandwidthHz,
      minimumRateBps: parameters.minimumRateBps,
      beamPowerCapW: [parameters.beamPowerCapW],
      satellitePowerCapW: parameters.satellitePowerCapW,
      g0Linear: 1,
      theta3dbRad: 0.2,
      rfcPowerW: parameters.rfcPowerW,
      basebandPerSatelliteW: parameters.basebandPerSatelliteW,
      frameDurationS: 1,
      backoffDb: 5,
      etaMax: parameters.etaMax,
      trainingEnergyJByBeam: [0],
      trainingIndicatorByBeam: [0],
      switchEnergyJ: 0,
      switchIndicatorByBeam: [0],
    },
    frame: {
      thetaRadUb: [[geometry.offAxisAngleRad]],
      propagationGainUb: [[geometry.propagationGain]],
      receiveGainUb: [[1]],
      servingBeamU: [0],
      beamActiveB: [true],
      beamLoadB: [1],
      beamSatelliteB: [0],
      beamColorB: [0],
      laggedInterferenceUW: [0],
    },
  };
}

export function buildSimulationAnalysisFrame(
  tleState: SimulatorTleState,
  rawParameters: SimulatorParameters,
): SimulationAnalysisFrame {
  const parameters = normalizeParameters(rawParameters);
  const instant = parseUtcInstant(tleState.requestedInstantUtc, 'requestedInstantUtc');
  const geometry = deriveTaipeiLinkGeometry(tleState.selectedSatellite.positionTemeKm, instant.value);
  const inputs = canonicalInputFromGeometry(tleState, parameters, geometry);
  const canonical = computeCanonicalEe(inputs);
  const evaluation = computeCanonicalEvaluation([{
    totalRateBps: canonical.throughput.totalRateBps,
    systemPowerW: canonical.power.systemPowerW,
    durationSec: inputs.config.frameDurationS,
  }]);
  const link = {
    userId: 'taipei-01',
    beamId: 0,
    satelliteId: tleState.selectedSatelliteId,
    offAxisAngleRad: geometry.offAxisAngleRad,
    distanceKm: geometry.distanceKm,
    elevationDeg: geometry.elevationDeg,
    requestedPowerW: canonical.power.pReqBW[0] ?? 0,
    actualPowerW: canonical.power.pDlActualBW[0] ?? 0,
    signalW: canonical.throughput.signalUW[0] ?? 0,
    interferenceW: canonical.throughput.interferenceUW[0] ?? 0,
    noiseW: inputs.config.noisePowerW,
    sinrLinear: canonical.throughput.sinrU[0] ?? 0,
    sinrDb: 10 * Math.log10(Math.max(canonical.throughput.sinrU[0] ?? 0, 1e-30)),
    rateBps: canonical.throughput.rateUBps[0] ?? 0,
    qosMet: canonical.throughput.qosMetU[0] ?? false,
    powerLimited: canonical.throughput.powerLimitedU[0] ?? false,
  } as const;
  const frameId = `analysis-${fnvHash(JSON.stringify({ tle: tleState.propagationFrame.frameId, parameters }))}`;
  const frame: SimulationAnalysisFrame = {
    frameId,
    instantUtc: instant.value,
    instantTaipei: utcToAsiaTaipei(instant.value),
    tleFrameId: tleState.propagationFrame.frameId,
    tleEpochUtc: tleState.selectedSnapshot.epochUtc,
    selectedSatelliteId: tleState.selectedSatelliteId,
    contractVersion: SIMULATOR_CONTRACT_VERSION,
    inputs,
    links: freeze([freeze(link)]),
    power: canonical.power,
    throughput: canonical.throughput,
    ee: freeze({
      instantaneousBitsPerJ: canonical.ee.systemEeBitsPerJ,
      evaluationBitsPerJ: evaluation.energyEfficiencyBitsPerJ,
      deliveredBits: evaluation.deliveredBits,
      consumedEnergyJ: evaluation.consumedEnergyJ,
      durationS: inputs.config.frameDurationS,
      zeroOverZero: evaluation.zeroOverZero,
      aggregation: 'ratio-of-sums',
    }),
    provenance: freeze({
      archiveCatalogUrl: '/tle-archive/oneweb/catalog.json',
      archiveId: tleState.catalog.archiveId,
      currentArchiveDate: tleState.currentArchiveDate,
      previousArchiveDate: tleState.previousArchiveDate,
      selectedTlePath: tleState.selectedSnapshot.sourcePath,
      selectedTleEpochUtc: tleState.selectedSnapshot.epochUtc,
      sourceKind: 'ARCHIVED_TLE',
      propagationModel: 'SGP4',
      analysisContractVersion: SIMULATOR_CONTRACT_VERSION,
      canonicalAuthority: CANONICAL_AUTHORITY,
      scenario: 'single-Taipei-nadir-reference-beam',
    }),
    canonical,
    tleState,
  };
  return deepFreeze(frame);
}

/** Helper for a date-time input labelled Asia/Taipei. */
export function simulatorTaipeiDateTimeToUtc(localDateTime: string): string {
  return asiaTaipeiToUtc(localDateTime);
}

export { SIMULATOR_TIME_ZONE };
