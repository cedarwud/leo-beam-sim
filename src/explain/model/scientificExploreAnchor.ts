import { computeCanonicalEe } from '../../analysis/canonicalEe';
import {
  buildCanonicalSevenCellScenario,
  CANONICAL_SEVEN_CELL_UE_COUNT,
} from '../../simulator/canonicalSevenCellScenario';
import { deriveNtpuLinkGeometry } from '../../simulator/analysis';
import type { SimulatorParameters } from '../../simulator/types';
import {
  CANONICAL_TERM_KEYS,
  selectCanonicalFrameTermValue,
} from './canonicalTermMap';
import { ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST } from './evidenceFixtureManifest';
import type {
  CanonicalTermKey,
  CanonicalTermValue,
  ScientificLinkIdentity,
} from './types';
import type { ScientificExplanationArtifactPoint } from './scientificExplanationArtifact';

const LOCAL_PATH_RADIUS_FRACTION = 1;
const PARITY_TERMS: readonly CanonicalTermKey[] = Object.freeze([
  'theta',
  'transmitGain',
  'rawH',
  'pReqUser',
  'actualBeamRf',
  'sinr',
  'representativeRate',
  'totalRate',
  'systemPower',
  'eeInst',
]);

export interface ScientificExploreResult {
  readonly kind: 'scientific-fixed-anchor-explore-v1';
  readonly frameId: string;
  readonly sourceFrameId: string;
  readonly instantUtc: string;
  readonly selectedSatelliteId: string;
  readonly identity: ScientificLinkIdentity;
  readonly localPositionKm: readonly [number, number];
  readonly radialOffsetKm: number;
  readonly parameters: SimulatorParameters;
  readonly terms: Readonly<Record<CanonicalTermKey, CanonicalTermValue>>;
  readonly qosMet: boolean;
  readonly powerLimited: boolean;
}

export interface ScientificExploreAnchor {
  readonly kind: 'scientific-fixed-anchor-explore-anchor-v1';
  readonly sourceFrameId: string;
  readonly instantUtc: string;
  readonly selectedSatelliteId: string;
  readonly identity: ScientificLinkIdentity;
  readonly cellIndex: number;
  readonly cellCenterKm: readonly [number, number];
  readonly axisUnit: readonly [number, number];
  readonly pathLimitKm: number;
  readonly referenceOffsetKm: number;
  readonly referenceParameters: SimulatorParameters;
  readonly reference: ScientificExploreResult;
  readonly build: (input: ScientificExploreInput) => ScientificExploreResult;
  readonly buildAtRadialOffsetKm: (radialOffsetKm: number) => ScientificExploreResult;
}

export interface ScientificExploreInput {
  readonly radialOffsetKm: number;
  readonly parameterOverrides?: Partial<SimulatorParameters>;
}

function freeze<T>(value: T): T {
  return Object.freeze(value);
}

function fnvHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function availableValue(value: CanonicalTermValue, label: string): number {
  if (value.status === 'unavailable') throw new Error(`${label} is unavailable: ${value.reason}`);
  return value.value;
}

function assertNear(label: string, actual: number, expected: number): void {
  const tolerance = Math.max(1e-12, Math.abs(expected) * 1e-9);
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label} drifted from accepted frame (${actual} != ${expected})`);
  }
}

function selectedSatellite(point: ScientificExplanationArtifactPoint) {
  const satellite = point.scene.satellites.find(candidate => (
    candidate.satelliteId === point.selectedSatelliteId
  ));
  if (satellite === undefined) {
    throw new Error(`accepted frame is missing service satellite ${point.selectedSatelliteId}`);
  }
  return satellite;
}

export function createScientificExploreAnchor(
  point: ScientificExplanationArtifactPoint,
): ScientificExploreAnchor {
  const identity = point.identity;
  if (identity.satelliteId !== point.selectedSatelliteId) {
    throw new Error('accepted representative identity does not match its service satellite');
  }
  const satellite = selectedSatellite(point);
  const geometry = deriveNtpuLinkGeometry(satellite.positionTemeKm, point.instantUtc);
  const parameters = ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST.referenceParameters;
  const baselineScenario = buildCanonicalSevenCellScenario({
    ...parameters,
    selectedLink: {
      distanceKm: geometry.distanceKm,
      elevationDeg: geometry.elevationDeg,
    },
    frameDurationS: 1,
    laggedInterferenceUW: Array.from(
      { length: CANONICAL_SEVEN_CELL_UE_COUNT },
      () => 0,
    ),
  });
  const referenceUser = baselineScenario.metadata.users[identity.userIndex];
  if (referenceUser === undefined || referenceUser.cellIndex !== identity.beamId) {
    throw new Error('accepted representative UE does not match the canonical seven-cell assignment');
  }
  const cell = baselineScenario.metadata.cells[referenceUser.cellIndex];
  if (cell === undefined) throw new Error(`canonical cell ${referenceUser.cellIndex} is unavailable`);
  const deltaX = referenceUser.positionKm[0] - cell.centerKm[0];
  const deltaY = referenceUser.positionKm[1] - cell.centerKm[1];
  const radialLength = Math.hypot(deltaX, deltaY);
  const axisUnit = freeze(radialLength > 1e-9
    ? [deltaX / radialLength, deltaY / radialLength] as [number, number]
    : [1, 0] as [number, number]);
  const pathLimitKm = baselineScenario.metadata.topology.cellRadiusKm * LOCAL_PATH_RADIUS_FRACTION;
  const referenceOffsetKm = deltaX * axisUnit[0] + deltaY * axisUnit[1];

  const build = ({ radialOffsetKm, parameterOverrides }: ScientificExploreInput): ScientificExploreResult => {
    if (!Number.isFinite(radialOffsetKm) || Math.abs(radialOffsetKm) > pathLimitKm + 1e-9) {
      throw new RangeError(`radialOffsetKm must stay within ±${pathLimitKm} km`);
    }
    const localPositionKm = freeze([
      cell.centerKm[0] + axisUnit[0] * radialOffsetKm,
      cell.centerKm[1] + axisUnit[1] * radialOffsetKm,
    ] as [number, number]);
    const currentParameters = freeze({ ...parameters, ...parameterOverrides });
    const scenario = buildCanonicalSevenCellScenario({
      ...currentParameters,
      selectedLink: {
        distanceKm: geometry.distanceKm,
        elevationDeg: geometry.elevationDeg,
      },
      frameDurationS: 1,
      laggedInterferenceUW: Array.from(
        { length: CANONICAL_SEVEN_CELL_UE_COUNT },
        () => 0,
      ),
      userPositionOverridesKm: [{ userIndex: identity.userIndex, positionKm: localPositionKm }],
    });
    const canonical = computeCanonicalEe(scenario.input);
    const frame = {
      selectedSatelliteId: point.selectedSatelliteId,
      parameters: currentParameters,
      scenario: scenario.metadata,
      inputs: scenario.input,
      canonical,
    };
    const terms = freeze(Object.fromEntries(CANONICAL_TERM_KEYS.map(term => [
      term,
      selectCanonicalFrameTermValue(term, { frame, identity }),
    ])) as Record<CanonicalTermKey, CanonicalTermValue>);
    return freeze({
      kind: 'scientific-fixed-anchor-explore-v1' as const,
      frameId: `explore-${fnvHash(JSON.stringify({
        sourceFrameId: point.frameId,
        userIndex: identity.userIndex,
        localPositionKm,
        parameters: currentParameters,
      }))}`,
      sourceFrameId: point.frameId,
      instantUtc: point.instantUtc,
      selectedSatelliteId: point.selectedSatelliteId,
      identity,
      localPositionKm,
      radialOffsetKm,
      parameters: currentParameters,
      terms,
      qosMet: canonical.throughput.qosMetU[identity.userIndex] ?? false,
      powerLimited: canonical.throughput.powerLimitedU[identity.userIndex] ?? false,
    });
  };

  const buildAtRadialOffsetKm = (radialOffsetKm: number): ScientificExploreResult => build({ radialOffsetKm });

  const reference = buildAtRadialOffsetKm(referenceOffsetKm);
  for (const term of PARITY_TERMS) {
    assertNear(
      `Explore baseline ${term}`,
      availableValue(reference.terms[term], `rebuilt ${term}`),
      availableValue(point.terms[term], `accepted ${term}`),
    );
  }

  return freeze({
    kind: 'scientific-fixed-anchor-explore-anchor-v1' as const,
    sourceFrameId: point.frameId,
    instantUtc: point.instantUtc,
    selectedSatelliteId: point.selectedSatelliteId,
    identity,
    cellIndex: cell.index,
    cellCenterKm: cell.centerKm,
    axisUnit,
    pathLimitKm,
    referenceOffsetKm,
    referenceParameters: parameters,
    reference,
    build,
    buildAtRadialOffsetKm,
  });
}
