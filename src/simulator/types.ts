import type { CanonicalEeInput, CanonicalEeResult } from '../analysis/canonicalEe';
import type { CanonicalSevenCellScenarioMetadata } from './canonicalSevenCellScenario';
import type { CanonicalTleHandoverAnchorTrace } from './canonicalTleHandover';
import {
  CANONICAL_DEFAULT_ATMOSPHERIC_COEFFICIENT_DB_PER_KM,
  CANONICAL_DEFAULT_CARRIER_FREQUENCY_GHZ,
  CANONICAL_DEFAULT_RECEIVE_GAIN_DBI,
} from './canonicalChannelAdapter';
import type {
  PropagatedSatelliteState,
  ResolvedTleSnapshot,
  TleArchiveEntry,
  TleArchiveManifest,
  TlePropagationFrame,
  Vector3,
} from '../tle';

export const SIMULATOR_CONTRACT_VERSION = 'family-b-thesis-3.13-3.17-v1' as const;
export const SIMULATOR_TIME_ZONE = 'Asia/Taipei' as const;

export type SimulatorConstellation = 'oneweb' | 'starlink';

export const SIMULATOR_CONSTELLATIONS: readonly {
  readonly id: SimulatorConstellation;
  readonly label: string;
}[] = Object.freeze([
  { id: 'starlink', label: 'Starlink' },
  { id: 'oneweb', label: 'OneWeb' },
]);

export const SIMULATOR_CATALOG_URLS: Readonly<Record<SimulatorConstellation, string>> = Object.freeze({
  oneweb: '/tle-archive/oneweb/catalog.json',
  starlink: '/tle-archive/starlink/catalog.json',
});

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

export interface TleWebArchiveExcludedSnapshot {
  readonly fileName: string;
  readonly sha256: string;
  readonly reason: string;
}

export interface TleWebArchiveCatalog {
  readonly schemaVersion: 'tle-web-archive-v1';
  readonly archiveId: string;
  readonly archiveContentSha256?: string;
  readonly constellation: SimulatorConstellation;
  readonly sourceKind: 'ARCHIVED_TLE';
  readonly propagationModel: 'SGP4';
  readonly firstArchiveDate: string;
  readonly lastArchiveDate: string;
  readonly snapshotCount: number;
  readonly sourceSnapshotCount?: number;
  readonly excludedSnapshots?: readonly TleWebArchiveExcludedSnapshot[];
  readonly maxPropagationAgeMs: number;
  readonly snapshots: readonly TleWebArchiveSnapshot[];
}

export interface LoadedTleSnapshot {
  readonly metadata: TleWebArchiveSnapshot;
  readonly entries: readonly TleArchiveEntry[];
  readonly byteLength: number;
  readonly sha256: string;
}

export interface LoadedTleSnapshotSelection {
  readonly catalog: TleWebArchiveCatalog;
  readonly snapshot: LoadedTleSnapshot;
  readonly manifest: TleArchiveManifest;
}

export interface OrbitTrajectoryPoint {
  readonly instantUtc: string;
  readonly positionTemeKm: Vector3;
}

/** Immutable identity of one displayed anchor inside a completed TLE run. */
export interface SimulatorRunAnchorIdentity {
  readonly runId: string;
  readonly geometryRunId: string;
  readonly anchorIndex: number;
  readonly anchorCount: number;
  readonly elapsedSec: number;
  readonly durationSec: number;
  readonly stepSec: number;
  readonly passPolicyRevision: string;
  readonly servingPassId: string | null;
  readonly candidatePassId: string | null;
}

export interface SimulatorTleState {
  readonly requestedInstantUtc: string;
  readonly selectedSatelliteId: string;
  readonly selectedSnapshot: ResolvedTleSnapshot;
  readonly propagationFrame: TlePropagationFrame;
  readonly selectedSatellite: PropagatedSatelliteState;
  /**
   * Highest-elevation above-horizon alternative in the same propagation
   * frame.  It is a comparison candidate only; TLE switching is not a
   * handover decision.
   */
  readonly candidateSatellite: PropagatedSatelliteState | null;
  readonly groundPositionTemeKm: Vector3;
  readonly trajectory: readonly OrbitTrajectoryPoint[];
  readonly archiveDate: string;
  readonly archiveSnapshot: LoadedTleSnapshot;
  readonly catalog: TleWebArchiveCatalog;
  /** Present only for a completely validated two-hour archived-TLE run. */
  readonly runAnchor?: SimulatorRunAnchorIdentity;
}

/** The only formal controls exposed by the Power projection. */
export interface SimulatorPowerParameters {
  readonly beamPowerCapW: number;
  readonly satellitePowerCapW: number;
  /** Canonical producer bound for the load-dependent PA curve. */
  readonly etaMax: number;
  /** Canonical PA output back-off used by the load-dependent efficiency curve. */
  readonly backoffDb: number;
  readonly rfcPowerW: number;
  readonly basebandPerSatelliteW: number;
}

/** Canonical model inputs that shape the realized SINR without overriding it. */
export interface SimulatorSinrParameters {
  /**
   * Frequency-reuse factor K_FR. It is used both for co-channel colouring
   * and for the derived per-beam bandwidth B_beam = B_sys / K_FR.
   */
  readonly frequencyReuse: number;
  /** Receiver antenna noise temperature T_ant, in K. */
  readonly antennaNoiseTemperatureK: number;
  /** Receiver noise figure NF, in dB. */
  readonly noiseFigureDb: number;
  /** Noise-figure reference temperature T_0, in K. */
  readonly noiseReferenceTemperatureK: number;
  /** Boresight transmit gain G0 in linear units. */
  readonly g0Linear: number;
  /** Full half-power beam width in radians. */
  readonly theta3dbRad: number;
  /**
   * Legacy scenario-adapter compatibility field. The formal thesis channel
   * path does not consume it and the UI must not expose it as an editable
   * canonical input.
   */
  readonly channelGainScale: number;
  /** Carrier frequency used by the canonical path-loss adapter, in GHz. */
  readonly carrierFrequencyGHz: number;
  /** Zenith gas-absorption loss override, in dB. */
  readonly atmosphericZenithLossDb: number;
  /** Legacy non-formal extension retained for data compatibility only. */
  readonly scintillationScaleDb: number;
  /** Legacy non-formal extension retained for data compatibility only. */
  readonly shadowFadingMarginDb: number;
  /** Serving-direction receive antenna gain, in dBi. */
  readonly receiveGainDbi: number;
}

/** Throughput owns the service target and per-beam bandwidth controls. */
export interface SimulatorThroughputParameters {
  readonly minimumRateBps: number;
  /** System bandwidth B_sys, in Hz. B_beam is derived from B_sys/K_FR. */
  readonly systemBandwidthHz: number;
}

export interface SimulatorParameters extends SimulatorPowerParameters, SimulatorSinrParameters, SimulatorThroughputParameters {}

export interface CanonicalLinkResult {
  readonly userIndex: number;
  readonly userId: string;
  readonly beamId: number;
  readonly satelliteId: string;
  readonly offAxisAngleRad: number;
  readonly distanceKm: number;
  readonly elevationDeg: number;
  readonly requestedPowerW: number;
  /** Beam-level RF output after the beam cap and before the satellite cap. */
  readonly beforeSatelliteCapPowerW: number;
  readonly actualPowerW: number;
  readonly signalW: number;
  readonly interferenceW: number;
  readonly noiseW: number;
  readonly sinrLinear: number;
  readonly sinrDb: number;
  readonly rateBps: number;
  /** System EE is published only for the serving scenario, never as candidate-link EE. */
  readonly instantaneousEeBitsPerJ: number | null;
  readonly qosMet: boolean;
  readonly powerLimited: boolean;
}

export type CandidateComparisonRole = {
  readonly role: 'single-link-comparison';
  readonly activeBeamOwnership: false;
  readonly contributesToServingInterference: false;
} & (
  | {
      readonly status: 'available';
      readonly satelliteId: string;
      readonly beamId: number;
      readonly userIndex: number;
      readonly userId: string;
      readonly candidateIdentityMatch: true;
    }
  | {
      readonly status: 'unavailable';
      readonly satelliteId: string | null;
      readonly candidateIdentityMatch: null;
      readonly reason: string;
    }
);

export interface SimulatorEeLedger {
  readonly instantaneousBitsPerJ: number;
  readonly evaluationBitsPerJ: number;
  readonly deliveredBits: number;
  readonly consumedEnergyJ: number;
  readonly durationS: number;
  readonly zeroOverZero: boolean;
  readonly aggregation: 'ratio-of-sums';
}

/** Ratio-of-sums accumulated over the fixed run intervals. */
export interface SimulatorRunEvaluation {
  readonly evaluationBitsPerJ: number;
  readonly deliveredBits: number;
  readonly consumedEnergyJ: number;
  readonly durationS: number;
  readonly sampleCount: number;
  readonly zeroOverZero: boolean;
  readonly aggregation: 'ratio-of-sums';
}

export interface SimulatorProvenance {
  readonly constellation: SimulatorConstellation;
  readonly archiveCatalogUrl: string;
  readonly archiveId: string;
  readonly archiveDate: string;
  readonly selectedTlePath: string;
  readonly selectedTleEpochUtc: string;
  readonly sourceKind: 'ARCHIVED_TLE';
  readonly propagationModel: 'SGP4';
  readonly analysisContractVersion: typeof SIMULATOR_CONTRACT_VERSION;
  readonly canonicalAuthority: string;
  readonly scenario:
    | 'canonical-seven-cell-fixed-load'
    | 'canonical-complete-hex-fixed-load'
    | 'canonical-complete-hex-beam-hopping';
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
  /**
   * The normalized editable model inputs that produced this immutable frame.
   * Keeping the parameter set with the frame lets session accumulators detect
   * an experiment-condition change without mistaking a new TLE instant for a
   * new model.
   */
  readonly parameters: SimulatorParameters;
  /**
   * The fixed seven-cell/100-UE assignment and its derived physical noise
   * terms. This metadata is produced beside `canonical`, never reconstructed
   * by a page-specific projection.
   */
  readonly scenario: CanonicalSevenCellScenarioMetadata;
  /** Same-UE, single-link counterfactual metadata; never a joint RF frame. */
  readonly candidateScenario: CanonicalSevenCellScenarioMetadata | null;
  readonly inputs: CanonicalEeInput;
  readonly links: readonly CanonicalLinkResult[];
  /**
   * Same-instant, same-parameter single-link counterfactual for the bounded
   * candidate comparison.  It is produced atomically with the serving link,
   * not recomputed by the right rail.
   */
  readonly candidateLink: CanonicalLinkResult | null;
  /** Explicit scientific scope and identity status for `candidateLink`. */
  readonly candidateComparison: CandidateComparisonRole;
  readonly power: CanonicalEeResult['power'];
  readonly throughput: CanonicalEeResult['throughput'];
  readonly ee: SimulatorEeLedger;
  readonly provenance: SimulatorProvenance;
  readonly canonical: CanonicalEeResult;
  readonly tleState: SimulatorTleState;
  /** The immutable 30-second TLE-run decision result used by this frame. */
  readonly handover?: CanonicalTleHandoverAnchorTrace;
  /** Mirrors `tleState.runAnchor` for non-scene consumers. */
  readonly runAnchor?: SimulatorRunAnchorIdentity;
}

export type SimulatorTab = 'sinr' | 'power' | 'throughput' | 'ee';

export const SIMULATOR_TABS: readonly { readonly id: SimulatorTab; readonly label: string; readonly shortLabel: string }[] = Object.freeze([
  { id: 'sinr', label: 'SINR', shortLabel: '鏈路品質' },
  { id: 'ee', label: 'EE', shortLabel: '能效' },
  { id: 'power', label: 'Power', shortLabel: '功率' },
  { id: 'throughput', label: 'Throughput', shortLabel: '吞吐量' },
]);

/**
 * Primary ownership for every editable canonical parameter.
 *
 * A parameter may be shown as read-only evidence on another page, but its
 * editable control must have exactly one owner here. `satisfies` makes a
 * newly added SimulatorParameters key fail the typecheck until it is placed
 * on one of the four canonical pages.
 */
export interface SimulatorParameterOwnership {
  readonly tab: SimulatorTab;
  readonly controlTestId: string;
}

/**
 * Compatibility fields that remain present in serialized parameter records
 * but are outside the formal thesis channel equation. They have no editable
 * control and cannot be counted as canonical experiment inputs.
 */
export const NON_EDITABLE_SIMULATOR_PARAMETER_KEYS = Object.freeze([
  'channelGainScale',
  'scintillationScaleDb',
  'shadowFadingMarginDb',
] as const);

export type NonEditableSimulatorParameterKey =
  (typeof NON_EDITABLE_SIMULATOR_PARAMETER_KEYS)[number];

export const SIMULATOR_PARAMETER_OWNERSHIP = Object.freeze({
  beamPowerCapW: { tab: 'power', controlTestId: 'power-tab-beam-cap-control' },
  satellitePowerCapW: { tab: 'power', controlTestId: 'power-tab-satellite-cap-control' },
  etaMax: { tab: 'ee', controlTestId: 'ee-tab-eta-max-control' },
  backoffDb: { tab: 'ee', controlTestId: 'ee-tab-backoff-control' },
  rfcPowerW: { tab: 'ee', controlTestId: 'ee-tab-rfc-control' },
  basebandPerSatelliteW: { tab: 'ee', controlTestId: 'ee-tab-bb-control' },
  frequencyReuse: { tab: 'sinr', controlTestId: 'sinr-tab-frequency-reuse-control' },
  antennaNoiseTemperatureK: { tab: 'sinr', controlTestId: 'sinr-tab-antenna-noise-temperature-control' },
  noiseFigureDb: { tab: 'sinr', controlTestId: 'sinr-tab-noise-figure-control' },
  noiseReferenceTemperatureK: { tab: 'sinr', controlTestId: 'sinr-tab-noise-reference-temperature-control' },
  g0Linear: { tab: 'sinr', controlTestId: 'sinr-tab-g0-control' },
  theta3dbRad: { tab: 'sinr', controlTestId: 'sinr-tab-theta3db-control' },
  carrierFrequencyGHz: { tab: 'sinr', controlTestId: 'sinr-tab-carrier-frequency-control' },
  atmosphericZenithLossDb: { tab: 'sinr', controlTestId: 'sinr-tab-atmospheric-loss-control' },
  receiveGainDbi: { tab: 'sinr', controlTestId: 'sinr-tab-receiver-gain-control' },
  minimumRateBps: { tab: 'throughput', controlTestId: 'throughput-tab-minimum-rate-control' },
  systemBandwidthHz: { tab: 'throughput', controlTestId: 'throughput-tab-system-bandwidth-control' },
} as const satisfies Record<
  Exclude<keyof SimulatorParameters, NonEditableSimulatorParameterKey>,
  SimulatorParameterOwnership
>);

export const DEFAULT_SIMULATOR_PARAMETERS: Readonly<SimulatorParameters> = Object.freeze({
  beamPowerCapW: 1.65,
  satellitePowerCapW: 10 ** (13 / 10),
  etaMax: 0.35,
  backoffDb: 5,
  rfcPowerW: 0.338,
  basebandPerSatelliteW: 0.2,
  frequencyReuse: 3,
  antennaNoiseTemperatureK: 150,
  noiseFigureDb: 1.2,
  noiseReferenceTemperatureK: 290,
  g0Linear: 2_000,
  theta3dbRad: 3.32 * Math.PI / 180,
  channelGainScale: 1,
  carrierFrequencyGHz: CANONICAL_DEFAULT_CARRIER_FREQUENCY_GHZ,
  // Kept under the legacy field name until the UI control is renamed; the
  // formal adapter interprets this value as chi_atm in dB/km.
  atmosphericZenithLossDb: CANONICAL_DEFAULT_ATMOSPHERIC_COEFFICIENT_DB_PER_KM,
  // Formal Eq. (3.9) excludes these legacy extension terms.
  scintillationScaleDb: 0,
  shadowFadingMarginDb: 0,
  receiveGainDbi: CANONICAL_DEFAULT_RECEIVE_GAIN_DBI,
  minimumRateBps: 1_000_000,
  systemBandwidthHz: 500_000_000,
});

export type SimulatorLoadStatus = 'loading' | 'ready' | 'error';
