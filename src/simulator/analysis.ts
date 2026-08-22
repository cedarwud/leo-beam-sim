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
  createTlePropagationFrameWithSatelliteExclusions,
  deriveSatelliteAltitudeKm,
  propagateTleSnapshot,
} from '../tle/propagation';
import { resolveTleSnapshot } from '../tle/resolver';
import type { Vector3 } from '../tle/types';
import type { TleRunBundle } from '../tle/run';
import type {
  CanonicalLinkResult,
  LoadedTleSnapshotSelection,
  OrbitTrajectoryPoint,
  SimulationAnalysisFrame,
  SimulatorParameters,
  SimulatorRunEvaluation,
  SimulatorRunAnchorIdentity,
  SimulatorTleState,
} from './types';
import {
  SIMULATOR_CATALOG_URLS,
  SIMULATOR_CONTRACT_VERSION,
  SIMULATOR_TIME_ZONE,
} from './types';
import { deriveObserverLinkGeometry } from './observer';
import {
  buildCanonicalSevenCellScenario,
  type CanonicalSevenCellScenario,
  type CanonicalSevenCellUserPositionOverride,
} from './canonicalSevenCellScenario';
import {
  DEFAULT_BEAM_LAYOUT_COUNT,
  assertSupportedBeamLayoutCount,
  type SupportedBeamLayoutCount,
} from '../core/beam/completeHexPresets';
import {
  normalizePerSatelliteBeamLayoutCount,
  resolveBeamLayoutCountForSatellite,
  type PerSatelliteBeamLayoutCount,
} from './beamLayoutOverrides';
import {
  DEFAULT_SIMULATOR_BEAM_ILLUMINATION_MODE,
  assertSimulatorBeamIlluminationMode,
  type SimulatorBeamIlluminationMode,
} from './beamIlluminationScenario';

// The fixed canonical scenario owns seven active beams and 100 assigned UEs.
// The previous-step interference estimate is still derived from the accepted
// frame/state rather than exposed as an independent sidebar parameter.
const REFERENCE_FRAME_LAGGED_INTERFERENCE_W = 0;
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

function finitePositive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${label} must be finite and positive`);
  return value;
}

function finiteFraction(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0 || value > 1) throw new RangeError(`${label} must be in (0, 1]`);
  return value;
}

function finiteNonNegative(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${label} must be finite and non-negative`);
  return value;
}

function normalizeParameters(parameters: SimulatorParameters): SimulatorParameters {
  return freeze({
    beamPowerCapW: finitePositive(parameters.beamPowerCapW, 'beamPowerCapW'),
    satellitePowerCapW: finitePositive(parameters.satellitePowerCapW, 'satellitePowerCapW'),
    etaMax: finiteFraction(parameters.etaMax, 'etaMax'),
    backoffDb: finiteNonNegative(parameters.backoffDb, 'backoffDb'),
    rfcPowerW: finitePositive(parameters.rfcPowerW, 'rfcPowerW'),
    basebandPerSatelliteW: finitePositive(parameters.basebandPerSatelliteW, 'basebandPerSatelliteW'),
    frequencyReuse: Number.isInteger(parameters.frequencyReuse) && parameters.frequencyReuse > 0
      ? parameters.frequencyReuse
      : (() => { throw new RangeError('frequencyReuse must be a positive integer'); })(),
    antennaNoiseTemperatureK: finitePositive(parameters.antennaNoiseTemperatureK, 'antennaNoiseTemperatureK'),
    noiseFigureDb: finiteNonNegative(parameters.noiseFigureDb, 'noiseFigureDb'),
    noiseReferenceTemperatureK: finitePositive(parameters.noiseReferenceTemperatureK, 'noiseReferenceTemperatureK'),
    g0Linear: finitePositive(parameters.g0Linear, 'g0Linear'),
    theta3dbRad: finitePositive(parameters.theta3dbRad, 'theta3dbRad'),
    channelGainScale: finitePositive(parameters.channelGainScale, 'channelGainScale'),
    carrierFrequencyGHz: finitePositive(parameters.carrierFrequencyGHz, 'carrierFrequencyGHz'),
    atmosphericZenithLossDb: finiteNonNegative(parameters.atmosphericZenithLossDb, 'atmosphericZenithLossDb'),
    scintillationScaleDb: finiteNonNegative(parameters.scintillationScaleDb, 'scintillationScaleDb'),
    shadowFadingMarginDb: finiteNonNegative(parameters.shadowFadingMarginDb, 'shadowFadingMarginDb'),
    receiveGainDbi: Number.isFinite(parameters.receiveGainDbi)
      ? parameters.receiveGainDbi
      : (() => { throw new RangeError('receiveGainDbi must be finite'); })(),
    minimumRateBps: finitePositive(parameters.minimumRateBps, 'minimumRateBps'),
    systemBandwidthHz: finitePositive(parameters.systemBandwidthHz, 'systemBandwidthHz'),
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

export interface LinkGeometry {
  readonly offAxisAngleRad: number;
  readonly distanceKm: number;
  readonly elevationDeg: number;
  readonly groundPositionTemeKm: Vector3;
}

export function deriveTaipeiLinkGeometry(
  satellitePositionTemeKm: Vector3,
  instantUtc: string,
): LinkGeometry {
  const observerGeometry = deriveObserverLinkGeometry(satellitePositionTemeKm, instantUtc);
  const distanceKm = observerGeometry.rangeKm;
  return freeze({
    offAxisAngleRad: observerGeometry.offAxisAngleRad,
    distanceKm,
    elevationDeg: observerGeometry.elevationDeg,
    groundPositionTemeKm: observerGeometry.groundPositionTemeKm,
  });
}

/** Preferred name; the Taipei-named export remains as a compatibility alias. */
export const deriveNtpuLinkGeometry = deriveTaipeiLinkGeometry;

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
  selection: LoadedTleSnapshotSelection,
  requestedInstantUtc: string,
  selectedSatelliteId?: string,
): SimulatorTleState {
  const requested = parseUtcInstant(requestedInstantUtc, 'requestedInstantUtc');
  const candidateIds = [...new Set(selection.manifest.entries.map(entry => entry.satelliteId))].sort();
  if (candidateIds.length === 0) throw new Error('current TLE snapshot contains no satellites');
  const propagationFrame = createTlePropagationFrameWithSatelliteExclusions(
    selection.manifest,
    requested.value,
    {
      satelliteIds: candidateIds,
      maxPropagationAgeMs: selection.catalog.maxPropagationAgeMs,
    },
  );
  const scored = propagationFrame.satellites
    .map(satellite => ({
      satellite,
      geometry: deriveTaipeiLinkGeometry(satellite.positionTemeKm, requested.value),
    }))
    .sort((left, right) => right.geometry.elevationDeg - left.geometry.elevationDeg);
  const selected = selectedIdsOrBest(scored, selectedSatelliteId);
  const candidate = scored.find(entry => (
    entry.satellite.satelliteId !== selected.satellite.satelliteId
    && entry.geometry.elevationDeg >= 0
  )) ?? null;
  const selectedSnapshot = resolveTleSnapshot(
    selection.manifest,
    requested.value,
    selected.satellite.satelliteId,
    { maxPropagationAgeMs: selection.catalog.maxPropagationAgeMs },
  );
  if (selected.geometry.elevationDeg < 0) {
    throw new Error(`no archived ${selection.catalog.constellation} satellite is above the NTPU horizon at the requested instant`);
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
    candidateSatellite: candidate?.satellite ?? null,
    groundPositionTemeKm,
    trajectory,
    archiveDate: selection.snapshot.metadata.archiveDate,
    archiveSnapshot: selection.snapshot,
    catalog: selection.catalog,
  });
}

export interface SimulatorRunAnchorSelection {
  readonly selectedSatelliteId: string;
  readonly candidateSatelliteId: string | null;
  readonly identity: SimulatorRunAnchorIdentity;
}

/**
 * Materialize one simulator state from a completed run without propagating or
 * resolving TLEs again. The full frame supplies same-instant context markers;
 * the planner-selected identities supply the only serving/candidate roles.
 */
export function createSimulatorTleStateFromRunAnchor(
  selection: LoadedTleSnapshotSelection,
  run: TleRunBundle,
  anchorIndex: number,
  anchorSelection: SimulatorRunAnchorSelection,
): SimulatorTleState {
  if (anchorSelection.identity.geometryRunId !== run.runId) {
    throw new Error('run-anchor identity does not match the completed geometry run');
  }
  if (anchorSelection.identity.anchorIndex !== anchorIndex) {
    throw new Error('run-anchor identity does not match the requested anchor');
  }
  if (anchorSelection.candidateSatelliteId === anchorSelection.selectedSatelliteId) {
    throw new Error('serving and candidate satellites must be different');
  }

  const propagationFrame = run.materializeFrame(anchorIndex);
  const selectedSatelliteIndex = run.getSatelliteIndex(anchorSelection.selectedSatelliteId);
  if (selectedSatelliteIndex === undefined) {
    throw new Error(`completed run has no serving satellite ${anchorSelection.selectedSatelliteId}`);
  }
  const selectedSatellite = propagationFrame.satellites[selectedSatelliteIndex];
  const selectedSnapshot = run.resolvedSnapshots[selectedSatelliteIndex];
  if (selectedSatellite === undefined || selectedSnapshot === undefined) {
    throw new Error(`completed run cannot materialize serving satellite ${anchorSelection.selectedSatelliteId}`);
  }
  const selectedGeometry = deriveObserverLinkGeometry(
    selectedSatellite.positionTemeKm,
    propagationFrame.requestedInstantUtc,
  );
  if (!selectedGeometry.visible) {
    throw new Error(`planned serving satellite ${anchorSelection.selectedSatelliteId} is below the NTPU horizon`);
  }

  const candidateSatellite = anchorSelection.candidateSatelliteId === null
    ? null
    : (() => {
      const candidateIndex = run.getSatelliteIndex(anchorSelection.candidateSatelliteId!);
      if (candidateIndex === undefined) {
        throw new Error(`completed run has no candidate satellite ${anchorSelection.candidateSatelliteId}`);
      }
      const candidate = propagationFrame.satellites[candidateIndex];
      if (candidate === undefined) {
        throw new Error(`completed run cannot materialize candidate satellite ${anchorSelection.candidateSatelliteId}`);
      }
      const geometry = deriveObserverLinkGeometry(candidate.positionTemeKm, propagationFrame.requestedInstantUtc);
      if (!geometry.visible) {
        throw new Error(`planned candidate satellite ${anchorSelection.candidateSatelliteId} is below the NTPU horizon`);
      }
      return candidate;
    })();

  const trajectory = freeze(Array.from({ length: run.anchorCount }, (_unused, index) => {
    const state = run.readStateByIndex(index, selectedSatelliteIndex);
    return freeze({ instantUtc: state.requestedInstantUtc, positionTemeKm: state.positionTemeKm });
  }));

  return deepFreeze({
    requestedInstantUtc: propagationFrame.requestedInstantUtc,
    selectedSatelliteId: selectedSatellite.satelliteId,
    selectedSnapshot,
    propagationFrame,
    selectedSatellite,
    candidateSatellite,
    groundPositionTemeKm: selectedGeometry.groundPositionTemeKm,
    trajectory,
    archiveDate: selection.snapshot.metadata.archiveDate,
    archiveSnapshot: selection.snapshot,
    catalog: selection.catalog,
    runAnchor: anchorSelection.identity,
  });
}

/** Stable analysis-run identity: geometry, policy and model parameters. */
export function createSimulationAnalysisRunId(
  geometryRunId: string,
  passPolicyRevision: string,
  rawParameters: SimulatorParameters,
  scenarioIdentity?: Readonly<SimulationAnalysisFrameBuildOptions>,
): string {
  const parameters = normalizeParameters(rawParameters);
  const normalizedScenarioIdentity = frameScenarioIdentity(scenarioIdentity);
  return `analysis-run-${fnvHash(JSON.stringify({
    geometryRunId,
    passPolicyRevision,
    parameters,
    ...(normalizedScenarioIdentity === undefined ? {} : { scenarioIdentity: normalizedScenarioIdentity }),
  }))}`;
}

export interface SimulationRunEvaluationSample {
  readonly instantUtc: string;
  readonly positionTemeKm: Vector3;
  readonly durationSec: number;
  /** Stable satellite identity used to resolve a per-satellite layout override. */
  readonly satelliteId?: string;
}

/** Minimal accepted-anchor service ownership used to publish BeamScheduleTrace. */
export interface SimulationBeamScheduleProjection {
  readonly anchorIndex: number;
  readonly instantUtc: string;
  readonly satelliteId: string;
  readonly beamLayoutCount: SupportedBeamLayoutCount;
  readonly halfPowerBeamWidthDeg: number;
  readonly mode: SimulatorBeamIlluminationMode;
  readonly associations: readonly {
    readonly userId: string;
    readonly satelliteId: string | null;
    readonly beamId: number | null;
  }[];
}

export interface SimulationRunComputation {
  readonly evaluation: SimulatorRunEvaluation;
  /** Null only for legacy callers that did not select a complete-ring scenario. */
  readonly beamScheduleProjections: readonly SimulationBeamScheduleProjection[] | null;
  /**
   * Canonical \hat I_u input for every accepted anchor, including the
   * display-only endpoint.  Entry 0 is the contract's zero initial state;
   * entry n+1 is the previous interval's realized I_u.
   */
  readonly laggedInterferenceByAnchor: readonly (readonly number[])[];
}

function projectBeamScheduleScenario(
  scenario: CanonicalSevenCellScenario,
  sample: SimulationRunEvaluationSample,
  anchorIndex: number,
): SimulationBeamScheduleProjection | null {
  if (sample.satelliteId === undefined || scenario.metadata.beamLayout.kind !== 'complete-hex-ring') {
    return null;
  }
  const satelliteId = sample.satelliteId;
  return freeze({
    anchorIndex,
    instantUtc: sample.instantUtc,
    satelliteId,
    beamLayoutCount: assertSupportedBeamLayoutCount(scenario.metadata.beamLayout.beamCount),
    halfPowerBeamWidthDeg: scenario.metadata.beamLayout.adjacentSpacingUv === null
      ? (() => { throw new Error('complete-ring beam layout is missing spacing metadata'); })()
      : scenario.input.config.theta3dbRad * 2 * 180 / Math.PI,
    mode: scenario.metadata.beamIllumination.mode,
    associations: freeze(scenario.input.frame.servingBeamU.map((beamId, userIndex) => freeze({
      userId: scenario.metadata.users[userIndex]?.userId ?? `ue-${userIndex + 1}`,
      satelliteId: beamId < 0 ? null : satelliteId,
      beamId: beamId < 0 ? null : beamId,
    }))),
  });
}

/** Build one endpoint/source-backed schedule projection without publishing a metric interval. */
export function buildSimulationBeamScheduleProjection(
  sample: SimulationRunEvaluationSample,
  rawParameters: SimulatorParameters,
  options: Pick<SimulationAnalysisFrameBuildOptions, 'userPositionOverridesKm' | 'beamLayoutCount' | 'perSatelliteBeamLayoutCount' | 'beamIlluminationMode'> | undefined,
  anchorIndex: number,
): SimulationBeamScheduleProjection | null {
  const parameters = normalizeParameters(rawParameters);
  const geometry = deriveTaipeiLinkGeometry(sample.positionTemeKm, sample.instantUtc);
  if (geometry.elevationDeg < 0) {
    throw new Error(`beam schedule anchor ${anchorIndex} serving satellite is below the NTPU horizon`);
  }
  return projectBeamScheduleScenario(
    canonicalScenarioFromGeometry(
      parameters,
      geometry,
      options,
      sample.satelliteId,
      anchorIndex,
      deriveSatelliteAltitudeKm(sample.positionTemeKm, sample.instantUtc),
    ),
    sample,
    anchorIndex,
  );
}

/**
 * Evaluate the canonical numerator and denominator across fixed run intervals.
 * The endpoint anchor is displayable but owns no interval; callers therefore
 * pass the 240 interval-start samples for a 241-anchor, 7,200-second run.
 */
export function computeSimulationRunComputation(
  samples: readonly SimulationRunEvaluationSample[],
  rawParameters: SimulatorParameters,
  options?: Pick<SimulationAnalysisFrameBuildOptions, 'userPositionOverridesKm' | 'beamLayoutCount' | 'perSatelliteBeamLayoutCount' | 'beamIlluminationMode'>,
): SimulationRunComputation {
  const parameters = normalizeParameters(rawParameters);
  const beamScheduleProjections: SimulationBeamScheduleProjection[] = [];
  const zeroLaggedInterference = Array.from({ length: 100 }, () => 0);
  let laggedInterferenceUW = zeroLaggedInterference;
  const laggedInterferenceByAnchor: number[][] = [];
  let scheduleProjectionAvailable = true;
  const evaluationFrames = samples.map((sample, index) => {
    const durationSec = finitePositive(sample.durationSec, `run sample ${index}.durationSec`);
    const geometry = deriveTaipeiLinkGeometry(sample.positionTemeKm, sample.instantUtc);
    if (geometry.elevationDeg < 0) {
      throw new Error(`run sample ${index} serving satellite is below the NTPU horizon`);
    }
    const scenario = canonicalScenarioFromGeometry(
      parameters,
      geometry,
      options,
      sample.satelliteId,
      index,
      deriveSatelliteAltitudeKm(sample.positionTemeKm, sample.instantUtc),
      laggedInterferenceUW,
    );
    laggedInterferenceByAnchor.push([...laggedInterferenceUW]);
    const scheduleProjection = projectBeamScheduleScenario(scenario, sample, index);
    if (scheduleProjection === null) scheduleProjectionAvailable = false;
    else beamScheduleProjections.push(scheduleProjection);
    const canonical = computeCanonicalEe(scenario.input);
    // The current accepted frame is the sole source of the next frame's
    // lagged estimate. Candidate comparisons are built separately and never
    // participate in this state transition.
    laggedInterferenceUW = [...canonical.throughput.interferenceUW];
    return {
      totalRateBps: canonical.throughput.totalRateBps,
      systemPowerW: canonical.power.systemPowerW,
      durationSec,
    };
  });
  // The endpoint has no owned evaluation interval, but it is still a
  // displayable accepted anchor and must consume the preceding interval's
  // realized interference vector.
  laggedInterferenceByAnchor.push([...laggedInterferenceUW]);
  const evaluation = computeCanonicalEvaluation(evaluationFrames);
  const runEvaluation = freeze({
    evaluationBitsPerJ: evaluation.energyEfficiencyBitsPerJ,
    deliveredBits: evaluation.deliveredBits,
    consumedEnergyJ: evaluation.consumedEnergyJ,
    durationS: evaluationFrames.reduce((sum, frame) => sum + frame.durationSec, 0),
    sampleCount: evaluationFrames.length,
    zeroOverZero: evaluation.zeroOverZero,
    aggregation: 'ratio-of-sums' as const,
  });
  return freeze({
    evaluation: runEvaluation,
    beamScheduleProjections: scheduleProjectionAvailable
      ? freeze(beamScheduleProjections)
      : null,
    laggedInterferenceByAnchor: freeze(
      laggedInterferenceByAnchor.map(vector => freeze([...vector])),
    ),
  });
}

export function computeSimulationRunEvaluation(
  samples: readonly SimulationRunEvaluationSample[],
  rawParameters: SimulatorParameters,
  options?: Pick<SimulationAnalysisFrameBuildOptions, 'userPositionOverridesKm' | 'beamLayoutCount' | 'perSatelliteBeamLayoutCount' | 'beamIlluminationMode'>,
): SimulatorRunEvaluation {
  return computeSimulationRunComputation(samples, rawParameters, options).evaluation;
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

function canonicalScenarioFromGeometry(
  parameters: SimulatorParameters,
  geometry: LinkGeometry,
  options?: Pick<SimulationAnalysisFrameBuildOptions, 'userPositionOverridesKm' | 'beamLayoutCount' | 'perSatelliteBeamLayoutCount' | 'beamIlluminationMode'>,
  satelliteId?: string,
  slotIndex = 0,
  satelliteAltitudeKm?: number,
  laggedInterferenceUW?: readonly number[],
): CanonicalSevenCellScenario {
  const perSatelliteBeamLayoutCount = normalizePerSatelliteBeamLayoutCount(options?.perSatelliteBeamLayoutCount);
  const globalBeamLayoutCount = options?.beamLayoutCount
    ?? (
      Object.keys(perSatelliteBeamLayoutCount).length > 0
      || options?.beamIlluminationMode !== undefined
        ? DEFAULT_BEAM_LAYOUT_COUNT
        : undefined
    );
  const beamLayoutCount = satelliteId === undefined
    ? globalBeamLayoutCount
    : resolveBeamLayoutCountForSatellite(globalBeamLayoutCount, perSatelliteBeamLayoutCount, satelliteId);
  const beamIlluminationMode = options?.beamIlluminationMode === undefined
    ? DEFAULT_SIMULATOR_BEAM_ILLUMINATION_MODE
    : assertSimulatorBeamIlluminationMode(options.beamIlluminationMode);
  return buildCanonicalSevenCellScenario({
    ...parameters,
    selectedLink: {
      distanceKm: geometry.distanceKm,
      elevationDeg: geometry.elevationDeg,
      ...(satelliteAltitudeKm === undefined ? {} : { satelliteAltitudeKm }),
    },
    frameDurationS: 1,
    laggedInterferenceUW: laggedInterferenceUW ?? Array.from(
      { length: 100 },
      () => REFERENCE_FRAME_LAGGED_INTERFERENCE_W,
    ),
    ...(options?.userPositionOverridesKm === undefined
      ? {}
      : { userPositionOverridesKm: options.userPositionOverridesKm }),
    ...(beamLayoutCount === undefined
      ? {}
      : { beamLayoutCount }),
    ...(beamLayoutCount === undefined
      ? {}
      : { beamIllumination: { mode: beamIlluminationMode, slotIndex } }),
  });
}

function buildCanonicalLinkResult(
  satelliteId: string,
  geometry: LinkGeometry,
  inputs: CanonicalEeInput,
  canonical: ReturnType<typeof computeCanonicalEe>,
  userIndex: number,
  expectedBeamId: number | null,
  instantaneousEeBitsPerJ: number | null,
): CanonicalLinkResult | null {
  const beamId = inputs.frame.servingBeamU[userIndex];
  if (beamId === undefined || beamId < 0 || (expectedBeamId !== null && beamId !== expectedBeamId)) {
    return null;
  }
  return freeze({
    userIndex,
    userId: `ue-${userIndex + 1}`,
    beamId,
    satelliteId,
    offAxisAngleRad: inputs.frame.thetaRadUb[userIndex]?.[beamId] ?? 0,
    distanceKm: geometry.distanceKm,
    elevationDeg: geometry.elevationDeg,
    requestedPowerW: canonical.power.pReqUW[userIndex] ?? 0,
    beforeSatelliteCapPowerW: canonical.power.pDlBeforeSatelliteCapBW[beamId] ?? 0,
    actualPowerW: canonical.power.pDlActualBW[beamId] ?? 0,
    signalW: canonical.throughput.signalUW[userIndex] ?? 0,
    interferenceW: canonical.throughput.interferenceUW[userIndex] ?? 0,
    noiseW: inputs.config.noisePowerW,
    sinrLinear: canonical.throughput.sinrU[userIndex] ?? 0,
    sinrDb: 10 * Math.log10(Math.max(canonical.throughput.sinrU[userIndex] ?? 0, 1e-30)),
    rateBps: canonical.throughput.rateUBps[userIndex] ?? 0,
    instantaneousEeBitsPerJ,
    qosMet: canonical.throughput.qosMetU[userIndex] ?? false,
    powerLimited: canonical.throughput.powerLimitedU[userIndex] ?? false,
  });
}

function selectRepresentativeUserIndex(
  inputs: CanonicalEeInput,
  canonical: ReturnType<typeof computeCanonicalEe>,
): number {
  // A multi-UE scenario keeps one deterministic representative link: the
  // served UE with the largest own p_req,U. The first UE wins an exact tie.
  const representativeUserIndex = inputs.frame.servingBeamU.reduce(
    (selected, servingBeam, userIndex) => {
      if (servingBeam < 0) return selected;
      if (selected < 0) return userIndex;
      return (canonical.power.pReqUW[userIndex] ?? -Infinity)
        > (canonical.power.pReqUW[selected] ?? -Infinity)
        ? userIndex
        : selected;
    },
    -1,
  );
  if (representativeUserIndex < 0) {
    throw new Error('canonical frame has no served representative UE');
  }
  return representativeUserIndex;
}

export interface SimulationAnalysisFrameBuildOptions {
  /** Product scenario preset; not a canonical formula input and not a legacy formula symbol. */
  readonly beamLayoutCount?: SupportedBeamLayoutCount;
  /** Stable satellite-specific complete-ring choices; global count remains the fallback. */
  readonly perSatelliteBeamLayoutCount?: PerSatelliteBeamLayoutCount;
  /** Product scenario policy; not a canonical formula input. */
  readonly beamIlluminationMode?: SimulatorBeamIlluminationMode;
  /** Move existing UEs in the canonical local tangent-plane scenario only. */
  readonly userPositionOverridesKm?: readonly CanonicalSevenCellUserPositionOverride[];
  /** Pin the single representative link while retaining the complete 100-UE frame. */
  readonly representativeUserIndex?: number;
}

function validatePinnedRepresentativeUserIndex(
  inputs: CanonicalEeInput,
  representativeUserIndex: number,
): number {
  if (!Number.isInteger(representativeUserIndex)) {
    throw new RangeError('representativeUserIndex must be an integer');
  }
  if (representativeUserIndex < 0 || representativeUserIndex >= inputs.frame.servingBeamU.length) {
    throw new RangeError(
      `representativeUserIndex must be in [0, ${inputs.frame.servingBeamU.length - 1}]`,
    );
  }
  if ((inputs.frame.servingBeamU[representativeUserIndex] ?? -1) < 0) {
    throw new RangeError('representativeUserIndex must identify a served UE');
  }
  return representativeUserIndex;
}

function frameScenarioIdentity(
  options: SimulationAnalysisFrameBuildOptions | undefined,
): {
  readonly beamLayoutCount?: SupportedBeamLayoutCount;
  readonly perSatelliteBeamLayoutCount?: PerSatelliteBeamLayoutCount;
  readonly beamIlluminationMode?: SimulatorBeamIlluminationMode;
  readonly userPositionOverridesKm: readonly CanonicalSevenCellUserPositionOverride[];
  readonly representativeUserIndex?: number;
} | undefined {
  const overrides = options?.userPositionOverridesKm;
  const representativeUserIndex = options?.representativeUserIndex;
  const beamLayoutCount = options?.beamLayoutCount;
  const perSatelliteBeamLayoutCount = normalizePerSatelliteBeamLayoutCount(options?.perSatelliteBeamLayoutCount);
  const beamIlluminationMode = options?.beamIlluminationMode;
  const hasOverrides = overrides !== undefined && overrides.length > 0;
  const hasSatelliteOverrides = Object.keys(perSatelliteBeamLayoutCount).length > 0;
  if (!hasOverrides && representativeUserIndex === undefined && beamLayoutCount === undefined && !hasSatelliteOverrides && beamIlluminationMode === undefined) return undefined;
  return {
    ...(beamLayoutCount === undefined ? {} : { beamLayoutCount }),
    ...(hasSatelliteOverrides ? { perSatelliteBeamLayoutCount } : {}),
    ...(beamIlluminationMode === undefined
      ? {}
      : { beamIlluminationMode: assertSimulatorBeamIlluminationMode(beamIlluminationMode) }),
    ...(hasOverrides
      ? {
          userPositionOverridesKm: [...overrides!]
            .map(override => ({
              userIndex: override.userIndex,
              positionKm: [override.positionKm[0], override.positionKm[1]] as [number, number],
            }))
            .sort((left, right) => left.userIndex - right.userIndex),
        }
      : { userPositionOverridesKm: [] }),
    ...(representativeUserIndex === undefined ? {} : { representativeUserIndex }),
  };
}

function buildSimulationAnalysisFrameInternal(
  tleState: SimulatorTleState,
  rawParameters: SimulatorParameters,
  runEvaluation?: SimulatorRunEvaluation,
  options?: SimulationAnalysisFrameBuildOptions,
  laggedInterferenceUW?: readonly number[],
): SimulationAnalysisFrame {
  const parameters = normalizeParameters(rawParameters);
  const instant = parseUtcInstant(tleState.requestedInstantUtc, 'requestedInstantUtc');
  const geometry = deriveTaipeiLinkGeometry(tleState.selectedSatellite.positionTemeKm, instant.value);
  const scenarioSlotIndex = tleState.runAnchor?.anchorIndex ?? 0;
  const scenario = canonicalScenarioFromGeometry(
    parameters,
    geometry,
    options,
    tleState.selectedSatelliteId,
    scenarioSlotIndex,
    deriveSatelliteAltitudeKm(tleState.selectedSatellite.positionTemeKm, instant.value),
    laggedInterferenceUW,
  );
  const { input: inputs } = scenario;
  const canonical = computeCanonicalEe(inputs);
  const evaluation = computeCanonicalEvaluation([{
    totalRateBps: canonical.throughput.totalRateBps,
    systemPowerW: canonical.power.systemPowerW,
    durationSec: inputs.config.frameDurationS,
  }]);
  const representativeUserIndex = options?.representativeUserIndex === undefined
    ? selectRepresentativeUserIndex(inputs, canonical)
    : validatePinnedRepresentativeUserIndex(inputs, options.representativeUserIndex);
  const link = buildCanonicalLinkResult(
    tleState.selectedSatelliteId,
    geometry,
    inputs,
    canonical,
    representativeUserIndex,
    null,
    canonical.ee.systemEeBitsPerJ,
  );
  if (link === null) throw new Error('canonical representative link is unavailable');
  let candidateLink: CanonicalLinkResult | null = null;
  let candidateScenario: CanonicalSevenCellScenario | null = null;
  let candidateComparison: SimulationAnalysisFrame['candidateComparison'];
  if (tleState.candidateSatellite === null) {
    candidateComparison = freeze({
      role: 'single-link-comparison',
      activeBeamOwnership: false,
      contributesToServingInterference: false,
      status: 'unavailable',
      satelliteId: null,
      candidateIdentityMatch: null,
      reason: 'same-instant candidate satellite is unavailable',
    });
  } else if (tleState.candidateSatellite.satelliteId === tleState.selectedSatelliteId) {
    candidateComparison = freeze({
      role: 'single-link-comparison',
      activeBeamOwnership: false,
      contributesToServingInterference: false,
      status: 'unavailable',
      satelliteId: tleState.candidateSatellite.satelliteId,
      candidateIdentityMatch: null,
      reason: 'candidate comparison has the same satellite identity as serving',
    });
  } else {
      const candidateGeometry = deriveTaipeiLinkGeometry(
        tleState.candidateSatellite.positionTemeKm,
        instant.value,
      );
      candidateScenario = canonicalScenarioFromGeometry(
        parameters,
      candidateGeometry,
      options,
      tleState.candidateSatellite.satelliteId,
      scenarioSlotIndex,
      deriveSatelliteAltitudeKm(tleState.candidateSatellite.positionTemeKm, instant.value),
    );
      const candidateInputs = candidateScenario.input;
      const candidateCanonical = computeCanonicalEe(candidateInputs);
      candidateLink = buildCanonicalLinkResult(
        tleState.candidateSatellite.satelliteId,
        candidateGeometry,
        candidateInputs,
        candidateCanonical,
        link.userIndex,
        null,
        null,
      );
      candidateComparison = candidateLink === null
        ? freeze({
            role: 'single-link-comparison',
            activeBeamOwnership: false,
            contributesToServingInterference: false,
            status: 'unavailable',
            satelliteId: tleState.candidateSatellite.satelliteId,
            candidateIdentityMatch: null,
            reason: 'candidate scenario cannot preserve the serving representative UE',
          })
        : freeze({
            role: 'single-link-comparison',
            activeBeamOwnership: false,
            contributesToServingInterference: false,
            status: 'available',
            satelliteId: candidateLink.satelliteId,
            beamId: candidateLink.beamId,
            userIndex: candidateLink.userIndex,
            userId: candidateLink.userId,
            candidateIdentityMatch: true,
          });
  }
  const frameIdentity = frameScenarioIdentity(options);
  const frameId = `analysis-${fnvHash(JSON.stringify({
    tle: tleState.propagationFrame.frameId,
    parameters,
    runAnchor: tleState.runAnchor ?? null,
    ...(frameIdentity === undefined ? {} : { scenario: frameIdentity }),
  }))}`;
  const frame: SimulationAnalysisFrame = {
    frameId,
    instantUtc: instant.value,
    instantTaipei: utcToAsiaTaipei(instant.value),
    tleFrameId: tleState.propagationFrame.frameId,
    tleEpochUtc: tleState.selectedSnapshot.epochUtc,
    selectedSatelliteId: tleState.selectedSatelliteId,
    contractVersion: SIMULATOR_CONTRACT_VERSION,
    parameters,
    scenario: scenario.metadata,
    candidateScenario: candidateScenario?.metadata ?? null,
    inputs,
    links: freeze([link]),
    candidateLink,
    candidateComparison,
    power: canonical.power,
    throughput: canonical.throughput,
    ee: freeze({
      instantaneousBitsPerJ: canonical.ee.systemEeBitsPerJ,
      evaluationBitsPerJ: runEvaluation?.evaluationBitsPerJ ?? evaluation.energyEfficiencyBitsPerJ,
      deliveredBits: runEvaluation?.deliveredBits ?? evaluation.deliveredBits,
      consumedEnergyJ: runEvaluation?.consumedEnergyJ ?? evaluation.consumedEnergyJ,
      durationS: runEvaluation?.durationS ?? inputs.config.frameDurationS,
      zeroOverZero: runEvaluation?.zeroOverZero ?? evaluation.zeroOverZero,
      aggregation: 'ratio-of-sums',
    }),
    provenance: freeze({
      constellation: tleState.catalog.constellation,
      archiveCatalogUrl: SIMULATOR_CATALOG_URLS[tleState.catalog.constellation],
      archiveId: tleState.catalog.archiveId,
      archiveDate: tleState.archiveDate,
      selectedTlePath: tleState.selectedSnapshot.sourcePath,
      selectedTleEpochUtc: tleState.selectedSnapshot.epochUtc,
      sourceKind: 'ARCHIVED_TLE',
      propagationModel: 'SGP4',
      analysisContractVersion: SIMULATOR_CONTRACT_VERSION,
      canonicalAuthority: CANONICAL_AUTHORITY,
      scenario: scenario.metadata.beamLayout.kind === 'legacy-dispersed-seven'
        ? 'canonical-seven-cell-fixed-load'
        : scenario.metadata.beamIllumination.mode === 'beam-hopping'
          ? 'canonical-complete-hex-beam-hopping'
          : 'canonical-complete-hex-fixed-load',
    }),
    canonical,
    tleState,
    ...(tleState.runAnchor === undefined ? {} : { runAnchor: tleState.runAnchor }),
  };
  return deepFreeze(frame);
}

/** Build one canonical frame with the contract-defined previous-step estimate. */
export function buildSimulationAnalysisFrameWithLaggedInterference(
  tleState: SimulatorTleState,
  rawParameters: SimulatorParameters,
  runEvaluation: SimulatorRunEvaluation | undefined,
  options: SimulationAnalysisFrameBuildOptions | undefined,
  laggedInterferenceUW: readonly number[],
): SimulationAnalysisFrame {
  return buildSimulationAnalysisFrameInternal(
    tleState,
    rawParameters,
    runEvaluation,
    options,
    laggedInterferenceUW,
  );
}

export function buildSimulationAnalysisFrame(
  tleState: SimulatorTleState,
  rawParameters: SimulatorParameters,
  runEvaluation?: SimulatorRunEvaluation,
  options?: SimulationAnalysisFrameBuildOptions,
): SimulationAnalysisFrame {
  return buildSimulationAnalysisFrameInternal(tleState, rawParameters, runEvaluation, options);
}

/** Helper for a date-time input labelled Asia/Taipei. */
export function simulatorTaipeiDateTimeToUtc(localDateTime: string): string {
  return asiaTaipeiToUtc(localDateTime);
}

export { SIMULATOR_TIME_ZONE };
