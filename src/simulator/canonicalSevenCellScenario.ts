import {
  type CanonicalEeInput,
  type NumberMatrix,
} from '../analysis/canonicalEe';
import type { SimulatorParameters } from './types';
import {
  CANONICAL_DEFAULT_RICIAN_K_DB,
  CANONICAL_DEFAULT_SATELLITE_ALTITUDE_KM,
  deriveCanonicalChannelTerms,
  type CanonicalChannelTerms,
} from './canonicalChannelAdapter';
import { DISPERSED_SEVEN_CELL_AXIAL_COORDINATES } from '../topology/dispersedSevenCellTopology';
import {
  assertSupportedBeamLayoutCount,
  createCompleteHexBeamLayout,
  type CompleteHexBeamLayout,
  type SupportedBeamLayoutCount,
} from '../core/beam/completeHexPresets';
import {
  CANONICAL_GROUND_UE_SUBSTRATE,
  CANONICAL_GROUND_UE_SUBSTRATE_ID,
  CANONICAL_GROUND_UE_SUBSTRATE_MAX_RADIUS_KM,
  type CanonicalGroundUe,
} from './canonicalGroundUeSubstrate';
import {
  DEFAULT_SIMULATOR_BEAM_ILLUMINATION_MODE,
  VISUAL_LAB_BEAM_ILLUMINATION_POLICY_REVISION,
  assertSimulatorBeamIlluminationMode,
  eligibleBeamIdsForVisualLabScenario,
  type SimulatorBeamIlluminationMode,
} from './beamIlluminationScenario';

/** Boltzmann's constant in W s K^-1 (equivalently J K^-1). */
export const BOLTZMANN_CONSTANT_W_PER_HZ_K = 1.380649e-23;

export const CANONICAL_SEVEN_CELL_COUNT = 7;
export const CANONICAL_SEVEN_CELL_UE_COUNT = 100;
export const CANONICAL_SEVEN_CELL_RADIUS_KM = 20;
export const CANONICAL_SEVEN_CELL_USER_COUNTS = Object.freeze([
  15, 15, 14, 14, 14, 14, 14,
] as const);

const DEGREES_TO_RADIANS = Math.PI / 180;
const GOLDEN_ANGLE_RADIANS = Math.PI * (3 - Math.sqrt(5));
const LOCAL_USER_RADIUS_FRACTION = 0.7;

/**
 * A TLE-owned selected link.  `distanceKm` is the selected satellite's
 * slant range; the local seven-cell map below is an uncalibrated experiment
 * mapping and must not be mistaken for another TLE propagation result.
 */
export interface CanonicalSevenCellSelectedLink {
  readonly distanceKm: number;
  readonly elevationDeg: number;
  /**
   * Propagated satellite height above the WGS-84 ellipsoid, in km.  Direct
   * legacy/test callers may omit it and use the explicit canonical fallback;
   * TLE-backed analysis must always provide the propagated value.
   */
  readonly satelliteAltitudeKm?: number;
}

/**
 * Optional local tangent-plane position for one already-assigned UE.
 *
 * The override changes geometry only.  The canonical scenario deliberately
 * keeps the UE's existing index/cell assignment and therefore its beam load;
 * callers cannot use this seam to add, remove, or reassign UEs.
 */
export interface CanonicalSevenCellUserPositionOverride {
  readonly userIndex: number;
  readonly positionKm: readonly [number, number];
}

/**
 * The current simulator's editable power/gain/channel/service fields plus
 * one selected TLE link. Aggregate noise, per-beam bandwidth, and a single
 * scene-wide load scalar are intentionally absent from SimulatorParameters:
 * this seam derives the first two and owns the full seven-beam assignment.
 */
export type CanonicalSevenCellScenarioRequest = SimulatorParameters & {
  readonly selectedLink: CanonicalSevenCellSelectedLink;
  /** Optional complete-ring layout. Undefined retains the legacy dispersed-seven compatibility case. */
  readonly beamLayoutCount?: SupportedBeamLayoutCount;
  readonly frameDurationS?: number;
  readonly laggedInterferenceUW?: readonly number[];
  readonly userPositionOverridesKm?: readonly CanonicalSevenCellUserPositionOverride[];
  /** Accepted-anchor scenario policy; it is separate from the 17 formula inputs. */
  readonly beamIllumination?: {
    readonly mode: SimulatorBeamIlluminationMode;
    readonly slotIndex: number;
  };
};

/** Compatibility vocabulary for callers that name the seam an input. */
export type CanonicalSevenCellScenarioInput = CanonicalSevenCellScenarioRequest;

export interface CanonicalSevenCellCell {
  readonly index: number;
  readonly q: number;
  readonly r: number;
  /** Local tangent-plane center in km, relative to the selected TLE ground point. */
  readonly centerKm: readonly [number, number];
  readonly color: number;
  readonly userCount: number;
}

export interface CanonicalSevenCellUser {
  readonly index: number;
  /** Stable identity from the fixed ground-UE substrate. */
  readonly userId: string;
  readonly cellIndex: number;
  readonly cellLocalIndex: number;
  /** Deterministic local tangent-plane position in km. */
  readonly positionKm: readonly [number, number];
}

export interface CanonicalSevenCellLinkGeometry {
  readonly distanceKm: number;
  readonly elevationDeg: number;
  readonly thetaRad: number;
}

export interface CanonicalSevenCellScenarioMetadata {
  readonly scenarioId: 'canonical-seven-cell-v1' | 'canonical-complete-hex-layout-v1';
  /** Identity of the fixed ground-UE population used for this scenario. */
  readonly ueSubstrateId: string;
  readonly beamLayout: {
    readonly beamCount: number;
    readonly ringCount: number | null;
    readonly kind: 'legacy-dispersed-seven' | 'complete-hex-ring';
    readonly adjacentSpacingUv: number | null;
    readonly source: 'legacy-dispersed-seven-compatibility'
      | CompleteHexBeamLayout['source'];
  };
  readonly topology: {
    readonly cellRadiusKm: number;
    readonly description: string;
  };
  readonly selectedLink: CanonicalSevenCellSelectedLink;
  readonly cells: readonly CanonicalSevenCellCell[];
  readonly users: readonly CanonicalSevenCellUser[];
  readonly beamLoadB: readonly number[];
  readonly beamActiveB: readonly boolean[];
  readonly beamSatelliteB: readonly number[];
  readonly beamColorB: readonly number[];
  readonly beamIllumination: {
    readonly mode: SimulatorBeamIlluminationMode;
    readonly slotIndex: number;
    readonly eligibleBeamIds: readonly number[];
    readonly policyRevision: typeof VISUAL_LAB_BEAM_ILLUMINATION_POLICY_REVISION;
  };
  /** All beams share serving satellite 0; no inter-satellite term is introduced. */
  readonly interSatelliteInterferenceW: 0;
  readonly derived: {
    readonly beamBandwidthHz: number;
    readonly systemNoiseTemperatureK: number;
    readonly noisePowerW: number;
  };
  readonly geometryUb: readonly (readonly CanonicalSevenCellLinkGeometry[])[];
  readonly channelTermsUb: readonly (readonly CanonicalChannelTerms[])[];
}

export interface CanonicalSevenCellScenario {
  readonly input: CanonicalEeInput;
  readonly metadata: CanonicalSevenCellScenarioMetadata;
}

interface LocalVector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

function freeze<T>(value: T): T {
  return Object.freeze(value);
}

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite`);
  return value;
}

function positive(value: number, label: string): number {
  finite(value, label);
  if (value <= 0) throw new RangeError(`${label} must be positive`);
  return value;
}

function nonNegative(value: number, label: string): number {
  finite(value, label);
  if (value < 0) throw new RangeError(`${label} must be non-negative`);
  return value;
}

function integerPositive(value: number, label: string): number {
  positive(value, label);
  if (!Number.isInteger(value)) throw new RangeError(`${label} must be an integer`);
  return value;
}

function normalizeColor(value: number, frequencyReuse: number): number {
  return ((value % frequencyReuse) + frequencyReuse) % frequencyReuse;
}

function dot(left: LocalVector3, right: LocalVector3): number {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

function length(value: LocalVector3): number {
  return Math.hypot(value.x, value.y, value.z);
}

function vectorFromSatellite(satellite: LocalVector3, ground: readonly [number, number]): LocalVector3 {
  return {
    x: satellite.x - ground[0],
    y: satellite.y - ground[1],
    z: satellite.z,
  };
}

/**
 * Build either the legacy dispersed-seven compatibility layout or one complete
 * regular hex ring preset. The stable order is the beam index order used by
 * the canonical frame.
 */
function buildCells(
  frequencyReuse: number,
  beamLayoutCount: SupportedBeamLayoutCount | undefined,
  halfPowerBeamWidthDeg: number,
): {
  readonly cells: readonly CanonicalSevenCellCell[];
  readonly layout: CanonicalSevenCellScenarioMetadata['beamLayout'];
} {
  const radius = CANONICAL_SEVEN_CELL_RADIUS_KM;
  const completeLayout = beamLayoutCount === undefined
    ? null
    : createCompleteHexBeamLayout({
        satelliteId: 'selected-satellite',
        beamCount: beamLayoutCount,
        halfPowerBeamWidthDeg,
      });
  const positions = completeLayout === null
    ? DISPERSED_SEVEN_CELL_AXIAL_COORDINATES.map(({ id, q, r }) => ({ index: id, q, r }))
    : completeLayout.beamPositions.map(position => ({
        index: position.beamId,
        q: position.axialQ,
        r: position.axialR,
      }));
  const baseUsers = Math.floor(CANONICAL_SEVEN_CELL_UE_COUNT / positions.length);
  const extraUsers = CANONICAL_SEVEN_CELL_UE_COUNT % positions.length;
  const cells = freeze(positions.map(({ index, q, r }) => freeze({
    index,
    q,
    r,
    centerKm: freeze([
      radius * Math.sqrt(3) * (q + r / 2),
      radius * 1.5 * r,
    ] as [number, number]),
    color: normalizeColor(q - r, frequencyReuse),
    userCount: baseUsers + (index < extraUsers ? 1 : 0),
  })));
  return freeze({
    cells,
    layout: completeLayout === null
      ? freeze({
          beamCount: CANONICAL_SEVEN_CELL_COUNT,
          ringCount: null,
          kind: 'legacy-dispersed-seven',
          adjacentSpacingUv: null,
          source: 'legacy-dispersed-seven-compatibility',
        })
      : freeze({
          beamCount: completeLayout.beamCount,
          ringCount: completeLayout.ringCount,
          kind: 'complete-hex-ring',
          adjacentSpacingUv: completeLayout.adjacentSpacingUv,
          source: completeLayout.source,
        }),
  });
}

function normalizeUserPositionOverrides(
  overrides: readonly CanonicalSevenCellUserPositionOverride[] | undefined,
): readonly CanonicalSevenCellUserPositionOverride[] | undefined {
  if (overrides === undefined) return undefined;
  if (!Array.isArray(overrides)) {
    throw new RangeError('userPositionOverridesKm must be an array');
  }
  const seen = new Set<number>();
  const normalized = overrides.map((override, overrideIndex) => {
    if (override === null || typeof override !== 'object') {
      throw new RangeError(`userPositionOverridesKm[${overrideIndex}] must be an object`);
    }
    const userIndex = override.userIndex;
    if (!Number.isInteger(userIndex)) {
      throw new RangeError(`userPositionOverridesKm[${overrideIndex}].userIndex must be an integer`);
    }
    if (userIndex < 0 || userIndex >= CANONICAL_SEVEN_CELL_UE_COUNT) {
      throw new RangeError(
        `userPositionOverridesKm[${overrideIndex}].userIndex must be in [0, ${CANONICAL_SEVEN_CELL_UE_COUNT - 1}]`,
      );
    }
    if (seen.has(userIndex)) {
      throw new RangeError(`userPositionOverridesKm contains duplicate userIndex ${userIndex}`);
    }
    seen.add(userIndex);
    const position = override.positionKm;
    if (!Array.isArray(position) || position.length !== 2) {
      throw new RangeError(
        `userPositionOverridesKm[${overrideIndex}].positionKm must be a two-dimensional [x, y] point`,
      );
    }
    finite(position[0], `userPositionOverridesKm[${overrideIndex}].positionKm[0]`);
    finite(position[1], `userPositionOverridesKm[${overrideIndex}].positionKm[1]`);
    const distanceFromSubstrateOriginKm = Math.hypot(position[0], position[1]);
    if (distanceFromSubstrateOriginKm > CANONICAL_GROUND_UE_SUBSTRATE_MAX_RADIUS_KM + 1e-9) {
      throw new RangeError(
        `userPositionOverridesKm[${overrideIndex}].positionKm must remain within the fixed substrate spatial bound of ${CANONICAL_GROUND_UE_SUBSTRATE_MAX_RADIUS_KM} km`,
      );
    }
    return freeze({
      userIndex,
      positionKm: freeze([position[0], position[1]] as [number, number]),
    });
  });
  // Sort only the copied representation.  This gives frame identities a
  // stable meaning when callers provide the same overrides in another order.
  normalized.sort((left, right) => left.userIndex - right.userIndex);
  return freeze(normalized);
}

function validateUserPositionOverrideCellBounds(
  overrides: readonly CanonicalSevenCellUserPositionOverride[] | undefined,
  cells: readonly CanonicalSevenCellCell[],
): void {
  if (overrides === undefined) return;
  let firstUserIndex = 0;
  for (const cell of cells) {
    const lastUserIndex = firstUserIndex + cell.userCount;
    for (const override of overrides) {
      if (override.userIndex < firstUserIndex || override.userIndex >= lastUserIndex) continue;
      const distanceFromCellCenterKm = Math.hypot(
        override.positionKm[0] - cell.centerKm[0],
        override.positionKm[1] - cell.centerKm[1],
      );
      if (distanceFromCellCenterKm > CANONICAL_SEVEN_CELL_RADIUS_KM + 1e-9) {
        throw new RangeError(
          `userPositionOverridesKm userIndex ${override.userIndex} must remain within cell ${cell.index}`,
        );
      }
    }
    firstUserIndex = lastUserIndex;
  }
}

function buildUsers(
  cells: readonly CanonicalSevenCellCell[],
  overrides: readonly CanonicalSevenCellUserPositionOverride[] | undefined,
): readonly CanonicalSevenCellUser[] {
  const overrideByUserIndex = overrides === undefined
    ? undefined
    : new Map(overrides.map(override => [override.userIndex, override.positionKm] as const));
  const users: CanonicalSevenCellUser[] = [];
  let index = 0;
  for (const cell of cells) {
    for (let cellLocalIndex = 0; cellLocalIndex < cell.userCount; cellLocalIndex += 1) {
      const radialFraction = cellLocalIndex === 0
        ? 0
        : LOCAL_USER_RADIUS_FRACTION * Math.sqrt(cellLocalIndex / cell.userCount);
      const angle = cellLocalIndex * GOLDEN_ANGLE_RADIANS + cell.index * 0.37;
      const generatedPositionKm = [
        cell.centerKm[0] + CANONICAL_SEVEN_CELL_RADIUS_KM * radialFraction * Math.cos(angle),
        cell.centerKm[1] + CANONICAL_SEVEN_CELL_RADIUS_KM * radialFraction * Math.sin(angle),
      ] as [number, number];
      users.push(freeze({
        index,
        userId: `ue-${index + 1}`,
        cellIndex: cell.index,
        cellLocalIndex,
        positionKm: freeze(overrideByUserIndex?.get(index) ?? generatedPositionKm),
      }));
      index += 1;
    }
  }
  return freeze(users);
}

function buildUsersFromGroundSubstrate(
  substrate: typeof CANONICAL_GROUND_UE_SUBSTRATE,
  overrides: readonly CanonicalSevenCellUserPositionOverride[] | undefined,
): readonly CanonicalSevenCellUser[] {
  const overrideByUserIndex = overrides === undefined
    ? undefined
    : new Map(overrides.map(override => [override.userIndex, override.positionKm] as const));
  return freeze(substrate.users.map((groundUe: CanonicalGroundUe) => freeze({
    index: groundUe.index,
    userId: groundUe.userId,
    // Association is deliberately filled after the selected layout's
    // angle-aware geometry is built. -1 is an internal pre-association value.
    cellIndex: -1,
    cellLocalIndex: groundUe.sourceCellLocalIndex,
    positionKm: freeze([
      ...(overrideByUserIndex?.get(groundUe.index) ?? groundUe.positionKm),
    ] as [number, number]),
  })));
}

/**
 * Associate a fixed ground UE with the beam whose actual local boresight has
 * the smallest off-axis angle.  Iterating beam IDs in ascending order and
 * treating near-equal angles as ties makes the lowest beam ID deterministic.
 */
function associateGroundUsers(
  users: readonly CanonicalSevenCellUser[],
  geometryUb: readonly (readonly CanonicalSevenCellLinkGeometry[])[],
  beamCount: number,
  eligibleBeamIds: readonly number[],
): readonly number[] {
  if (eligibleBeamIds.length === 0) throw new Error('ground UE association requires at least one eligible beam');
  const associations = users.map(user => {
    const geometryRow = geometryUb[user.index];
    if (geometryRow === undefined || geometryRow.length !== beamCount) {
      throw new Error(`missing angle-aware geometry for ground UE ${user.index}`);
    }
    let selectedBeam = eligibleBeamIds[0]!;
    let selectedTheta = geometryRow[selectedBeam]?.thetaRad ?? Infinity;
    for (const beam of eligibleBeamIds.slice(1)) {
      const theta = geometryRow[beam]?.thetaRad ?? Infinity;
      if (theta < selectedTheta - 1e-12) {
        selectedBeam = beam;
        selectedTheta = theta;
      }
      // Equal/near-equal values intentionally leave the earlier (lower) beam
      // ID selected.  This is the tie-break contract, not an input preference.
    }
    return selectedBeam;
  });
  return freeze(associations);
}

function assignServingBeams(
  users: readonly CanonicalSevenCellUser[],
  servingBeamU: readonly number[],
): readonly CanonicalSevenCellUser[] {
  return freeze(users.map(user => freeze({
    ...user,
    cellIndex: servingBeamU[user.index] ?? -1,
  })));
}

function deriveBeamLoads(
  servingBeamU: readonly number[],
  beamCount: number,
): readonly number[] {
  const loads = Array.from({ length: beamCount }, () => 0);
  for (const beam of servingBeamU) {
    if (!Number.isInteger(beam) || beam < 0 || beam >= beamCount) {
      throw new Error(`ground UE association references invalid beam ${beam}`);
    }
    loads[beam] = (loads[beam] ?? 0) + 1;
  }
  return freeze(loads);
}

function cellsWithDerivedUserCounts(
  cells: readonly CanonicalSevenCellCell[],
  beamLoadB: readonly number[],
): readonly CanonicalSevenCellCell[] {
  return freeze(cells.map(cell => freeze({
    ...cell,
    userCount: beamLoadB[cell.index] ?? 0,
  })));
}

function linkGeometry(
  satellite: LocalVector3,
  beamCenterKm: readonly [number, number],
  userPositionKm: readonly [number, number],
): CanonicalSevenCellLinkGeometry {
  const beamAxis = vectorFromSatellite(satellite, beamCenterKm);
  const userRay = vectorFromSatellite(satellite, userPositionKm);
  const beamAxisLength = length(beamAxis);
  const userRayLength = length(userRay);
  const cosTheta = Math.min(1, Math.max(-1, dot(beamAxis, userRay) / (beamAxisLength * userRayLength)));
  const horizontalDistance = Math.hypot(userRay.x, userRay.y);
  return freeze({
    distanceKm: userRayLength,
    elevationDeg: Math.atan2(userRay.z, horizontalDistance) / DEGREES_TO_RADIANS,
    thetaRad: Math.acos(cosTheta),
  });
}

function buildLocalSatellite(selectedLink: CanonicalSevenCellSelectedLink): LocalVector3 {
  const elevationRad = selectedLink.elevationDeg * DEGREES_TO_RADIANS;
  return {
    // The selected TLE ground-point azimuth is not needed by this local map;
    // choose a stable tangent-plane x-axis for the experiment topology.
    x: selectedLink.distanceKm * Math.cos(elevationRad),
    y: 0,
    z: selectedLink.distanceKm * Math.sin(elevationRad),
  };
}

function validateRequest(request: CanonicalSevenCellScenarioRequest): void {
  positive(request.selectedLink.distanceKm, 'selectedLink.distanceKm');
  finite(request.selectedLink.elevationDeg, 'selectedLink.elevationDeg');
  if (request.selectedLink.elevationDeg <= 0 || request.selectedLink.elevationDeg > 90) {
    throw new RangeError('selectedLink.elevationDeg must be in (0, 90]');
  }
  if (request.selectedLink.satelliteAltitudeKm !== undefined) {
    positive(request.selectedLink.satelliteAltitudeKm, 'selectedLink.satelliteAltitudeKm');
  }
  positive(request.systemBandwidthHz, 'systemBandwidthHz');
  integerPositive(request.frequencyReuse, 'frequencyReuse');
  positive(request.antennaNoiseTemperatureK, 'antennaNoiseTemperatureK');
  nonNegative(request.noiseFigureDb, 'noiseFigureDb');
  positive(request.noiseReferenceTemperatureK, 'noiseReferenceTemperatureK');
  if (request.frameDurationS !== undefined) positive(request.frameDurationS, 'frameDurationS');
  if (request.laggedInterferenceUW !== undefined) {
    if (request.laggedInterferenceUW.length !== CANONICAL_SEVEN_CELL_UE_COUNT) {
      throw new RangeError(`laggedInterferenceUW must have ${CANONICAL_SEVEN_CELL_UE_COUNT} entries`);
    }
    request.laggedInterferenceUW.forEach((value, index) => nonNegative(value, `laggedInterferenceUW[${index}]`));
  }
  positive(request.beamPowerCapW, 'beamPowerCapW');
  positive(request.satellitePowerCapW, 'satellitePowerCapW');
  positive(request.etaMax, 'etaMax');
  nonNegative(request.backoffDb, 'backoffDb');
  nonNegative(request.rfcPowerW, 'rfcPowerW');
  nonNegative(request.basebandPerSatelliteW, 'basebandPerSatelliteW');
  positive(request.g0Linear, 'g0Linear');
  positive(request.theta3dbRad, 'theta3dbRad');
  positive(request.channelGainScale, 'channelGainScale');
  positive(request.carrierFrequencyGHz, 'carrierFrequencyGHz');
  nonNegative(request.atmosphericZenithLossDb, 'atmosphericZenithLossDb');
  nonNegative(request.scintillationScaleDb, 'scintillationScaleDb');
  nonNegative(request.shadowFadingMarginDb, 'shadowFadingMarginDb');
  finite(request.receiveGainDbi, 'receiveGainDbi');
  nonNegative(request.minimumRateBps, 'minimumRateBps');
  if (request.beamLayoutCount !== undefined) {
    assertSupportedBeamLayoutCount(request.beamLayoutCount);
  }
  if (request.beamIllumination !== undefined) {
    assertSimulatorBeamIlluminationMode(request.beamIllumination.mode);
    if (!Number.isSafeInteger(request.beamIllumination.slotIndex) || request.beamIllumination.slotIndex < 0) {
      throw new RangeError('beamIllumination.slotIndex must be a non-negative integer');
    }
    if (request.beamLayoutCount === undefined && request.beamIllumination.mode === 'beam-hopping') {
      throw new RangeError('Beam Hopping requires an explicit complete-ring beam layout');
    }
  }
}

function freezeMatrix<T>(matrix: readonly (readonly T[])[]): readonly (readonly T[])[] {
  return freeze(matrix.map(row => freeze([...row])));
}

/**
 * Build one immutable seven-beam Family-B input.  TLE owns only the selected
 * satellite's slant range/elevation.  User and beam positions are a clearly
 * labelled, uncalibrated local 20-km-radius experiment mapping used to make
 * the U x B angle/channel matrix explicit; they are not synthetic TLE motion.
 */
export function buildCanonicalSevenCellScenario(
  request: CanonicalSevenCellScenarioRequest,
): CanonicalSevenCellScenario {
  validateRequest(request);
  const { cells: initialCells, layout: beamLayout } = buildCells(
    request.frequencyReuse,
    request.beamLayoutCount,
    request.theta3dbRad * 180 / Math.PI,
  );
  const illuminationMode = request.beamIllumination?.mode
    ?? DEFAULT_SIMULATOR_BEAM_ILLUMINATION_MODE;
  const illuminationSlotIndex = request.beamIllumination?.slotIndex ?? 0;
  const eligibleBeamIds = eligibleBeamIdsForVisualLabScenario(
    assertSupportedBeamLayoutCount(initialCells.length),
    illuminationMode,
    illuminationSlotIndex,
  );
  const userPositionOverridesKm = normalizeUserPositionOverrides(request.userPositionOverridesKm);
  const explicitCompleteRing = request.beamLayoutCount !== undefined;
  if (!explicitCompleteRing) {
    // Keep the historical dispersed-seven path intact, including its
    // assigned-cell safety check and fixed loads.  Complete-ring comparisons
    // use the shared substrate below and intentionally do not use this check.
    validateUserPositionOverrideCellBounds(userPositionOverridesKm, initialCells);
  }
  let cells = initialCells;
  let users = explicitCompleteRing
    ? buildUsersFromGroundSubstrate(CANONICAL_GROUND_UE_SUBSTRATE, userPositionOverridesKm)
    : buildUsers(initialCells, userPositionOverridesKm);
  let servingBeamU: readonly number[] = users.map(user => user.cellIndex);
  let beamLoadB: readonly number[] = freeze(initialCells.map(cell => cell.userCount));
  let beamActiveB: readonly boolean[] = freeze(initialCells.map(() => true));
  const beamBandwidthHz = request.systemBandwidthHz / request.frequencyReuse;
  const systemNoiseTemperatureK = request.antennaNoiseTemperatureK
    + request.noiseReferenceTemperatureK * (10 ** (request.noiseFigureDb / 10) - 1);
  const noisePowerW = BOLTZMANN_CONSTANT_W_PER_HZ_K * systemNoiseTemperatureK * beamBandwidthHz;
  positive(beamBandwidthHz, 'derived beamBandwidthHz');
  positive(systemNoiseTemperatureK, 'derived systemNoiseTemperatureK');
  positive(noisePowerW, 'derived noisePowerW');

  const localSatellite = buildLocalSatellite(request.selectedLink);
  const geometryUb: CanonicalSevenCellLinkGeometry[][] = [];
  const channelTermsUb: CanonicalChannelTerms[][] = [];
  const thetaRadUb: number[][] = [];
  const propagationGainUb: number[][] = [];
  const receiveGainUb: number[][] = [];
  const channelParameters = {
    carrierFrequencyGHz: request.carrierFrequencyGHz,
    // The legacy simulator field is now the formal χ_atm coefficient. TLE
    // analysis supplies the propagated satellite altitude; only direct
    // legacy/test callers use the explicit canonical fallback.
    atmosphericCoefficientDbPerKm: request.atmosphericZenithLossDb,
    satelliteAltitudeKm: request.selectedLink.satelliteAltitudeKm
      ?? CANONICAL_DEFAULT_SATELLITE_ALTITUDE_KM,
    ricianKDb: CANONICAL_DEFAULT_RICIAN_K_DB,
    receiveGainDbi: request.receiveGainDbi,
  };

  for (const user of users) {
    const geometryRow: CanonicalSevenCellLinkGeometry[] = [];
    const channelRow: CanonicalChannelTerms[] = [];
    const thetaRow: number[] = [];
    const propagationRow: number[] = [];
    const receiveRow: number[] = [];
    for (const cell of cells) {
      const geometry = linkGeometry(localSatellite, cell.centerKm, user.positionKm);
      const channel = deriveCanonicalChannelTerms(
        geometry.distanceKm,
        geometry.elevationDeg,
        channelParameters,
      );
      geometryRow.push(geometry);
      channelRow.push(channel);
      thetaRow.push(geometry.thetaRad);
      propagationRow.push(channel.propagationGain);
      receiveRow.push(channel.receiveGainLinear);
    }
    geometryUb.push(geometryRow);
    channelTermsUb.push(channelRow);
    thetaRadUb.push(thetaRow);
    propagationGainUb.push(propagationRow);
    receiveGainUb.push(receiveRow);
  }

  if (explicitCompleteRing) {
    servingBeamU = associateGroundUsers(users, geometryUb, cells.length, eligibleBeamIds);
    users = assignServingBeams(users, servingBeamU);
    beamLoadB = deriveBeamLoads(servingBeamU, cells.length);
    beamActiveB = freeze(beamLoadB.map(load => load > 0));
    cells = cellsWithDerivedUserCounts(cells, beamLoadB);
  }
  const beamSatelliteB = freeze(cells.map(() => 0));
  const beamColorB = freeze(cells.map(cell => cell.color));

  const laggedInterferenceUW = request.laggedInterferenceUW === undefined
    ? Array.from({ length: CANONICAL_SEVEN_CELL_UE_COUNT }, () => 0)
    : [...request.laggedInterferenceUW];
  const input: CanonicalEeInput = {
    config: freeze({
      noisePowerW,
      beamBandwidthHz,
      minimumRateBps: request.minimumRateBps,
      beamPowerCapW: request.beamPowerCapW,
      satellitePowerCapW: request.satellitePowerCapW,
      g0Linear: request.g0Linear,
      // The current simulator field is full HPBW; the frozen producer takes
      // its one-sided half-power angle at this explicit boundary.
      theta3dbRad: request.theta3dbRad / 2,
      rfcPowerW: request.rfcPowerW,
      basebandPerSatelliteW: request.basebandPerSatelliteW,
      frameDurationS: request.frameDurationS ?? 1,
      backoffDb: request.backoffDb,
      etaMax: request.etaMax,
      trainingEnergyJByBeam: freeze(Array.from({ length: cells.length }, () => 0)),
      trainingIndicatorByBeam: freeze(Array.from({ length: cells.length }, () => 0)),
      switchEnergyJ: 0,
      switchIndicatorByBeam: freeze(Array.from({ length: cells.length }, () => 0)),
    }),
    frame: freeze({
      thetaRadUb: freezeMatrix(thetaRadUb) as NumberMatrix,
      propagationGainUb: freezeMatrix(propagationGainUb) as NumberMatrix,
      receiveGainUb: freezeMatrix(receiveGainUb) as NumberMatrix,
      servingBeamU: freeze([...servingBeamU]),
      beamActiveB,
      beamLoadB,
      beamSatelliteB,
      beamColorB,
      laggedInterferenceUW: freeze(laggedInterferenceUW),
    }),
  };
  const metadata: CanonicalSevenCellScenarioMetadata = {
    scenarioId: request.beamLayoutCount === undefined
      ? 'canonical-seven-cell-v1'
      : 'canonical-complete-hex-layout-v1',
    ueSubstrateId: explicitCompleteRing
      ? CANONICAL_GROUND_UE_SUBSTRATE_ID
      : 'legacy-dispersed-seven-generated-v1',
    beamLayout,
    topology: {
      cellRadiusKm: CANONICAL_SEVEN_CELL_RADIUS_KM,
      description: explicitCompleteRing
        ? `Uncalibrated local tangent-plane complete-hex-ring experiment mapping (${beamLayout.beamCount} beams); TLE owns satellite geometry.`
        : 'Uncalibrated local tangent-plane dispersed-seven-cell experiment mapping; TLE owns satellite geometry.',
    },
    selectedLink: freeze({ ...request.selectedLink }),
    cells,
    users,
    beamLoadB,
    beamActiveB,
    beamSatelliteB,
    beamColorB,
    beamIllumination: freeze({
      mode: illuminationMode,
      slotIndex: illuminationSlotIndex,
      eligibleBeamIds: freeze([...eligibleBeamIds]),
      policyRevision: VISUAL_LAB_BEAM_ILLUMINATION_POLICY_REVISION,
    }),
    interSatelliteInterferenceW: 0,
    derived: freeze({ beamBandwidthHz, systemNoiseTemperatureK, noisePowerW }),
    geometryUb: freezeMatrix(geometryUb),
    channelTermsUb: freezeMatrix(channelTermsUb),
  };
  return freeze({ input: freeze(input), metadata: freeze(metadata) });
}

/** Preferred factory alias for integration callers. */
export const createCanonicalSevenCellScenario = buildCanonicalSevenCellScenario;
