import type { CanonicalEeInput, CanonicalEeResult } from '../analysis/canonicalEe';
import type {
  PropagatedSatelliteState,
  ResolvedTleSnapshot,
  TleArchiveEntry,
  TleArchiveManifest,
  TlePropagationFrame,
  Vector3,
} from '../tle';

export const SIMULATOR_CONTRACT_VERSION = 'family-b-thesis-3.13-3.17-v1' as const;
export const SIMULATOR_CATALOG_URL = '/tle-archive/oneweb/catalog.json';
export const SIMULATOR_TIME_ZONE = 'Asia/Taipei' as const;

export interface TleWebArchiveSnapshot {
  readonly archiveDate: string;
  readonly path: string;
  readonly byteLength: number;
  readonly recordCount: number;
  readonly identityCount: number;
  readonly minEpochUtc: string;
  readonly maxEpochUtc: string;
  readonly sha256: string;
}

export interface TleWebArchiveCatalog {
  readonly schemaVersion: 'tle-web-archive-v1';
  readonly archiveId: string;
  readonly archiveContentSha256?: string;
  readonly constellation: 'oneweb';
  readonly sourceKind: 'ARCHIVED_TLE';
  readonly propagationModel: 'SGP4';
  readonly firstArchiveDate: string;
  readonly lastArchiveDate: string;
  readonly snapshotCount: number;
  readonly maxPropagationAgeMs: number;
  readonly snapshots: readonly TleWebArchiveSnapshot[];
}

export interface LoadedTleSnapshot {
  readonly metadata: TleWebArchiveSnapshot;
  readonly entries: readonly TleArchiveEntry[];
  readonly byteLength: number;
  readonly sha256: string;
}

export interface LoadedTleSnapshotPair {
  readonly catalog: TleWebArchiveCatalog;
  readonly current: LoadedTleSnapshot;
  readonly previous: LoadedTleSnapshot | null;
  readonly snapshots: readonly LoadedTleSnapshot[];
  readonly manifest: TleArchiveManifest;
}

/** Preferred name: the loaded set is an epoch-covering window, not just a pair. */
export type LoadedTleSnapshotWindow = LoadedTleSnapshotPair;

export interface OrbitTrajectoryPoint {
  readonly instantUtc: string;
  readonly positionTemeKm: Vector3;
}

export interface SimulatorTleState {
  readonly requestedInstantUtc: string;
  readonly selectedSatelliteId: string;
  readonly selectedSnapshot: ResolvedTleSnapshot;
  readonly propagationFrame: TlePropagationFrame;
  readonly selectedSatellite: PropagatedSatelliteState;
  readonly groundPositionTemeKm: Vector3;
  readonly trajectory: readonly OrbitTrajectoryPoint[];
  readonly currentArchiveDate: string;
  readonly previousArchiveDate: string | null;
  readonly currentSnapshot: LoadedTleSnapshot;
  readonly previousSnapshot: LoadedTleSnapshot | null;
  readonly catalog: TleWebArchiveCatalog;
}

/** The only formal controls exposed by the Power projection. */
export interface SimulatorPowerParameters {
  readonly beamPowerCapW: number;
  readonly satellitePowerCapW: number;
  /** Canonical producer bound for the load-dependent PA curve. */
  readonly etaMax: number;
  readonly rfcPowerW: number;
  readonly basebandPerSatelliteW: number;
}

/** Throughput owns the service target and per-beam bandwidth controls. */
export interface SimulatorThroughputParameters {
  readonly minimumRateBps: number;
  readonly beamBandwidthHz: number;
}

export interface SimulatorParameters extends SimulatorPowerParameters, SimulatorThroughputParameters {}

export interface CanonicalLinkResult {
  readonly userId: string;
  readonly beamId: number;
  readonly satelliteId: string;
  readonly offAxisAngleRad: number;
  readonly distanceKm: number;
  readonly elevationDeg: number;
  readonly requestedPowerW: number;
  readonly actualPowerW: number;
  readonly signalW: number;
  readonly interferenceW: number;
  readonly noiseW: number;
  readonly sinrLinear: number;
  readonly sinrDb: number;
  readonly rateBps: number;
  readonly qosMet: boolean;
  readonly powerLimited: boolean;
}

export interface SimulatorEeLedger {
  readonly instantaneousBitsPerJ: number;
  readonly evaluationBitsPerJ: number;
  readonly deliveredBits: number;
  readonly consumedEnergyJ: number;
  readonly durationS: number;
  readonly zeroOverZero: boolean;
  readonly aggregation: 'ratio-of-sums';
}

export interface SimulatorProvenance {
  readonly archiveCatalogUrl: string;
  readonly archiveId: string;
  readonly currentArchiveDate: string;
  readonly previousArchiveDate: string | null;
  readonly selectedTlePath: string;
  readonly selectedTleEpochUtc: string;
  readonly sourceKind: 'ARCHIVED_TLE';
  readonly propagationModel: 'SGP4';
  readonly analysisContractVersion: typeof SIMULATOR_CONTRACT_VERSION;
  readonly canonicalAuthority: string;
  readonly scenario: 'single-Taipei-nadir-reference-beam';
}

/**
 * One immutable value shared by the 3D scene and every analysis projection.
 * `canonical` is retained for parity/debugging; projections must read the
 * ledgers on this object rather than recomputing a page-specific formula.
 */
export interface SimulationAnalysisFrame {
  readonly frameId: string;
  readonly instantUtc: string;
  readonly instantTaipei: string;
  readonly tleFrameId: string;
  readonly tleEpochUtc: string;
  readonly selectedSatelliteId: string;
  readonly contractVersion: typeof SIMULATOR_CONTRACT_VERSION;
  readonly inputs: CanonicalEeInput;
  readonly links: readonly CanonicalLinkResult[];
  readonly power: CanonicalEeResult['power'];
  readonly throughput: CanonicalEeResult['throughput'];
  readonly ee: SimulatorEeLedger;
  readonly provenance: SimulatorProvenance;
  readonly canonical: CanonicalEeResult;
  readonly tleState: SimulatorTleState;
}

export type SimulatorTab = 'sinr' | 'power' | 'throughput' | 'ee';

export const SIMULATOR_TABS: readonly { readonly id: SimulatorTab; readonly label: string; readonly shortLabel: string }[] = Object.freeze([
  { id: 'sinr', label: 'SINR', shortLabel: '鏈路品質' },
  { id: 'power', label: 'Power', shortLabel: '功率' },
  { id: 'throughput', label: 'Throughput', shortLabel: '吞吐量' },
  { id: 'ee', label: 'EE', shortLabel: '能效' },
]);

export const DEFAULT_SIMULATOR_PARAMETERS: Readonly<SimulatorParameters> = Object.freeze({
  beamPowerCapW: 2,
  satellitePowerCapW: 3,
  etaMax: 0.35,
  rfcPowerW: 0.338,
  basebandPerSatelliteW: 0.2,
  minimumRateBps: 100_000,
  beamBandwidthHz: 1_000_000,
});

export type SimulatorLoadStatus = 'loading' | 'ready' | 'error';
