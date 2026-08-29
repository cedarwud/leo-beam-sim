import {
  computeCanonicalEe,
  type CanonicalEeConfig,
  type CanonicalEeInput,
  type NumberMatrix,
} from '../../analysis/canonicalEe';
import { createObserverContext, computeTopocentricPoint } from '../orbit';
import { deriveCanonicalChannelTerms } from '../../simulator/canonicalChannelAdapter';
import {
  candidateLinkKeyString,
  validateCandidateAssignmentDelta,
  type CandidateAssignmentDelta,
  type CandidateLinkKey,
} from './candidateDecisionContract';
import type {
  CanonicalForecastDigestBundle,
  CanonicalForecastEeSample,
} from './canonicalForecastEeEvaluator';
import { buildCanonicalForecastDigestBundle } from './canonicalForecastEeEvaluator';
import type {
  WalkerForecastBeamState,
  WalkerForecastFrame,
} from './walkerForecastFrameProvider';

export interface WalkerCanonicalForecastPolicy {
  readonly policyConfigHash: string;
  readonly switchEventAccountingMode: 'target-once-at-horizon-start';
  /** Validation-only until the dated activation gate passes. */
  readonly activationState: 'validation-only';
}

export interface WalkerCanonicalForecastBuildResult {
  readonly samples: readonly CanonicalForecastEeSample[];
  readonly digests: CanonicalForecastDigestBundle;
}

export class WalkerCanonicalForecastBuildError extends RangeError {
  constructor(message: string) {
    super(message);
    this.name = 'WalkerCanonicalForecastBuildError';
  }
}

type JsonRecord = Record<string, unknown>;
type Vector3 = readonly [number, number, number];

function fail(message: string): never {
  throw new WalkerCanonicalForecastBuildError(message);
}

function nonEmpty(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) fail(`${label} must be non-empty`);
  return value;
}

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) fail(`${label} must be finite`);
  return value;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepClone<T>(value: T): T {
  if (Array.isArray(value)) return value.map(item => deepClone(item)) as T;
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, deepClone(child)])) as T;
  }
  return value;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as JsonRecord)) deepFreeze(child);
  }
  return value;
}

function stableJson(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'number') return Number.isFinite(value) ? `number:${value}` : `number:${String(value)}`;
  if (typeof value === 'string') return `string:${JSON.stringify(value)}`;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (isRecord(value)) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(',')}}`;
  }
  return `unsupported:${Object.prototype.toString.call(value)}`;
}

function keyList(beams: readonly WalkerForecastBeamState[]): readonly string[] {
  return beams.map(beam => candidateLinkKeyString(beam.key));
}

function sameJson(left: unknown, right: unknown): boolean {
  return stableJson(left) === stableJson(right);
}

function indexOfKey(keys: readonly CandidateLinkKey[], target: CandidateLinkKey): number {
  const encoded = candidateLinkKeyString(target);
  return keys.findIndex(key => candidateLinkKeyString(key) === encoded);
}

function normalizePolicy(policy: WalkerCanonicalForecastPolicy): WalkerCanonicalForecastPolicy {
  if (policy === null || typeof policy !== 'object') fail('policy must be an object');
  const policyConfigHash = nonEmpty(policy.policyConfigHash, 'policy.policyConfigHash');
  if (policy.switchEventAccountingMode !== 'target-once-at-horizon-start') {
    fail('policy.switchEventAccountingMode must be target-once-at-horizon-start');
  }
  if (policy.activationState !== 'validation-only') {
    fail('Walker canonical forecast builder cannot activate the public EE policy');
  }
  return Object.freeze({
    policyConfigHash,
    switchEventAccountingMode: policy.switchEventAccountingMode,
    activationState: policy.activationState,
  });
}

function assertActionScope(action: CandidateAssignmentDelta): void {
  try {
    validateCandidateAssignmentDelta(action);
  } catch (error) {
    fail(error instanceof Error ? error.message : 'candidate action is invalid');
  }
  if (action.from === null) {
    fail('Walker Forecast-EE handover comparison requires an established serving beam');
  }
  if (action.affectedUeIds.length !== 1 || action.affectedUeIds[0] !== action.primaryUeId) {
    fail('Walker Forecast-EE v1 supports one explicitly mapped primary-UE assignment change');
  }
  const expected = new Set([candidateLinkKeyString(action.from), candidateLinkKeyString(action.to)]);
  const actual = new Set(action.affectedBeamKeys.map(candidateLinkKeyString));
  if (expected.size !== actual.size || [...expected].some(key => !actual.has(key))) {
    fail('Walker Forecast-EE v1 affectedBeamKeys must contain exactly the source and target beams');
  }
}

function validateFrameSequence(
  frames: readonly WalkerForecastFrame[],
  policy: WalkerCanonicalForecastPolicy,
): {
  readonly ueIds: readonly string[];
  readonly beamKeys: readonly CandidateLinkKey[];
  readonly durationSec: number;
} {
  if (frames.length === 0) fail('walker forecast frames are unavailable');
  const first = frames[0]!;
  const durationSec = first.canonicalConfig.frameDurationS;
  if (!Number.isFinite(durationSec) || durationSec <= 0) fail('canonical frame duration must be finite and positive');
  const ueIds = first.ues.map(ue => ue.ueId);
  const beamKeys = first.beams.map(beam => beam.key);
  const satelliteIds = first.satellites.map(satellite => satellite.satelliteId);
  if (new Set(ueIds).size !== ueIds.length) fail('Walker forecast UE identities must be unique');
  if (new Set(keyList(first.beams)).size !== beamKeys.length) fail('Walker forecast beam identities must be unique');
  if (new Set(satelliteIds).size !== satelliteIds.length) fail('Walker forecast satellite identities must be unique');

  frames.forEach((frame, index) => {
    nonEmpty(frame.sourceFrameId, `frames[${index}].sourceFrameId`);
    if (frame.policyConfigHash !== policy.policyConfigHash) {
      fail(`frames[${index}].policyConfigHash does not match the requested policy`);
    }
    if (frame.scenarioStateHash !== first.scenarioStateHash
      || frame.geometryModels.geometryModelHash !== first.geometryModels.geometryModelHash
      || frame.canonicalConfigHash !== first.canonicalConfigHash) {
      fail('Walker forecast frames must share one immutable scenario, geometry model, and canonical configuration');
    }
    if (!sameJson(frame.canonicalConfig, first.canonicalConfig)
      || !sameJson(frame.canonicalChannel, first.canonicalChannel)
      || !sameJson(frame.beamConfiguration, first.beamConfiguration)
      || !sameJson(frame.beamHopping, first.beamHopping)) {
      fail('Walker forecast canonical configuration drifted inside one horizon');
    }
    if (!sameJson(frame.ues.map(ue => ue.ueId), ueIds)
      || !sameJson(keyList(frame.beams), keyList(first.beams))
      || !sameJson(frame.satellites.map(satellite => satellite.satelliteId), satelliteIds)) {
      fail('Walker forecast UE, beam, and satellite index mappings must remain stable');
    }
    if (frame.protagonistUeId !== first.protagonistUeId) {
      fail('Walker forecast protagonist identity must remain stable');
    }
    if (!Number.isFinite(frame.absoluteUtcMs) || !Number.isFinite(frame.epochUtcMs)) {
      fail(`frames[${index}] uses a non-finite absolute UTC axis`);
    }
    if (index > 0 && frame.absoluteUtcMs - frames[index - 1]!.absoluteUtcMs !== durationSec * 1000) {
      fail('Walker forecast frames must form one contiguous canonical-duration sequence');
    }
    if (frame.servingBeamIndexByUe.length !== ueIds.length
      || frame.laggedInterferenceWByUe.length !== ueIds.length) {
      fail(`frames[${index}] must cover every canonical UE`);
    }
    frame.laggedInterferenceWByUe.forEach((value, userIndex) => {
      if (!Number.isFinite(value) || value < 0) fail(`frames[${index}].laggedInterferenceWByUe[${userIndex}] is invalid`);
    });
    if (frame.beams.length !== beamKeys.length) fail(`frames[${index}] must cover every canonical beam`);
    frame.beams.forEach((beam, beamIndex) => {
      const satellite = frame.satellites[beam.satelliteIndex];
      if (satellite === undefined || satellite.satelliteId !== beam.key.satelliteId) {
        fail(`frames[${index}].beams[${beamIndex}] has invalid satellite ownership`);
      }
      if (!Number.isInteger(beam.load) || beam.load < 0 || beam.active !== (beam.load > 0)) {
        fail(`frames[${index}].beams[${beamIndex}] has invalid canonical active/load state`);
      }
      if (!Number.isInteger(beam.reuseColorIndex) || beam.reuseColorIndex < 0) {
        fail(`frames[${index}].beams[${beamIndex}] has invalid reuse ownership`);
      }
      if (beam.active && !beam.scheduled) {
        fail(`frames[${index}].beams[${beamIndex}] is active outside the declared hopping schedule`);
      }
    });
    const realizedLoads = frame.beams.map(() => 0);
    frame.servingBeamIndexByUe.forEach((beamIndex, userIndex) => {
      if (!Number.isInteger(beamIndex) || beamIndex < -1 || beamIndex >= frame.beams.length) {
        fail(`frames[${index}].servingBeamIndexByUe[${userIndex}] is invalid`);
      }
      if (beamIndex >= 0) realizedLoads[beamIndex] += 1;
    });
    frame.beams.forEach((beam, beamIndex) => {
      if (beam.load !== realizedLoads[beamIndex]) {
        fail(`frames[${index}].beams[${beamIndex}].load disagrees with serving assignments`);
      }
    });
  });
  return { ueIds, beamKeys, durationSec };
}

function subtract(left: Vector3, right: Vector3): [number, number, number] {
  return [left[0] - right[0], left[1] - right[1], left[2] - right[2]];
}

function normalized(vector: Vector3, label: string): Vector3 {
  vector.forEach((value, index) => finite(value, `${label}[${index}]`));
  const norm = Math.hypot(...vector);
  if (!Number.isFinite(norm) || norm <= 0) fail(`${label} must have positive finite length`);
  return [vector[0] / norm, vector[1] / norm, vector[2] / norm];
}

function angleBetween(left: Vector3, right: Vector3): number {
  const a = normalized(left, 'beam axis');
  const b = normalized(right, 'satellite-to-UE ray');
  const cosine = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  return Math.acos(cosine);
}

function buildPhysicalMatrices(frame: WalkerForecastFrame): {
  readonly thetaRadUb: NumberMatrix;
  readonly propagationGainUb: NumberMatrix;
  readonly receiveGainUb: NumberMatrix;
} {
  const thetaRadUb: number[][] = [];
  const propagationGainUb: number[][] = [];
  const receiveGainUb: number[][] = [];
  for (const ue of frame.ues) {
    const thetaRow: number[] = [];
    const propagationRow: number[] = [];
    const receiveRow: number[] = [];
    const ueObserver = createObserverContext(ue.latDeg, ue.lonDeg, 0);
    for (const beam of frame.beams) {
      const satellite = frame.satellites[beam.satelliteIndex]!;
      const ray = subtract(ue.ecefKm, satellite.orbitPoint.ecefKm);
      const rangeKm = Math.hypot(...ray);
      if (!Number.isFinite(rangeKm) || rangeKm <= 0) fail('Walker satellite-to-UE range must be positive and finite');
      const thetaRad = angleBetween(beam.axis.axisEcefUnit, ray);
      const topocentric = computeTopocentricPoint(ueObserver, satellite.orbitPoint.ecefKm);
      const channel = deriveCanonicalChannelTerms(rangeKm, topocentric.elevationDeg, {
        carrierFrequencyGHz: frame.canonicalChannel.carrierFrequencyGHz,
        atmosphericCoefficientDbPerKm: frame.canonicalChannel.atmosphericCoefficientDbPerKm,
        satelliteAltitudeKm: satellite.orbitPoint.altKm,
        ricianKDb: frame.canonicalChannel.ricianKDb,
        receiveGainDbi: frame.canonicalChannel.receiveGainDbi,
      });
      thetaRow.push(thetaRad);
      propagationRow.push(channel.propagationGain);
      // v1 explicitly uses the canonical fixed-boresight receive-gain model;
      // it is profile/provenance backed and shared by both counterfactuals.
      receiveRow.push(channel.receiveGainLinear);
    }
    thetaRadUb.push(thetaRow);
    propagationGainUb.push(propagationRow);
    receiveGainUb.push(receiveRow);
  }
  return {
    thetaRadUb: deepFreeze(thetaRadUb),
    propagationGainUb: deepFreeze(propagationGainUb),
    receiveGainUb: deepFreeze(receiveGainUb),
  };
}

function configForSample(
  source: CanonicalEeConfig,
  durationSec: number,
  beamCount: number,
  targetBeamIndex: number,
  includeSwitchEvent: boolean,
): CanonicalEeConfig {
  const switchIndicatorByBeam = Array.from({ length: beamCount }, (_, beamIndex) => (
    includeSwitchEvent && beamIndex === targetBeamIndex ? 1 : 0
  ));
  return deepFreeze({
    ...deepClone(source),
    frameDurationS: durationSec,
    switchIndicatorByBeam,
  });
}

function loadForAssignments(servingBeamU: readonly number[], beamCount: number): readonly number[] {
  const loads = Array.from({ length: beamCount }, () => 0);
  servingBeamU.forEach(beamIndex => {
    if (beamIndex >= 0) loads[beamIndex] += 1;
  });
  return Object.freeze(loads);
}

function assertActiveBeamBudgets(
  frame: WalkerForecastFrame,
  loads: readonly number[],
  label: string,
): void {
  const activeBySatellite = new Map<number, number>();
  loads.forEach((load, beamIndex) => {
    if (load <= 0) return;
    const beam = frame.beams[beamIndex];
    if (beam === undefined) fail(`${label} names an unknown beam index ${beamIndex}`);
    if (!beam.scheduled) fail(`${label} activates ${candidateLinkKeyString(beam.key)} outside its schedule`);
    activeBySatellite.set(
      beam.satelliteIndex,
      (activeBySatellite.get(beam.satelliteIndex) ?? 0) + 1,
    );
  });
  for (const [satelliteIndex, activeCount] of activeBySatellite) {
    const limit = frame.beamHopping.enabled
      ? Math.min(
        frame.beamConfiguration.maxActivePerSat,
        frame.beamHopping.maxActiveBeamsPerSlot,
      )
      : frame.beamConfiguration.maxActivePerSat;
    if (activeCount > limit) {
      const satelliteId = frame.satellites[satelliteIndex]?.satelliteId ?? `index ${satelliteIndex}`;
      fail(`${label} activates ${activeCount} beams on ${satelliteId}, above the declared limit ${limit}`);
    }
  }
}

function canonicalInput(
  config: CanonicalEeConfig,
  matrices: ReturnType<typeof buildPhysicalMatrices>,
  servingBeamU: readonly number[],
  beamLoadB: readonly number[],
  frame: WalkerForecastFrame,
  laggedInterferenceUW: readonly number[],
): CanonicalEeInput {
  return deepFreeze({
    config,
    frame: {
      thetaRadUb: matrices.thetaRadUb,
      propagationGainUb: matrices.propagationGainUb,
      receiveGainUb: matrices.receiveGainUb,
      servingBeamU: Object.freeze([...servingBeamU]),
      beamActiveB: Object.freeze(beamLoadB.map(load => load > 0)),
      beamLoadB: Object.freeze([...beamLoadB]),
      beamSatelliteB: Object.freeze(frame.beams.map(beam => beam.satelliteIndex)),
      beamColorB: Object.freeze(frame.beams.map(beam => beam.reuseColorIndex)),
      laggedInterferenceUW: Object.freeze([...laggedInterferenceUW]),
    },
  });
}

export function buildWalkerCanonicalForecastSamples(
  frames: readonly WalkerForecastFrame[],
  action: CandidateAssignmentDelta,
  policyInput: WalkerCanonicalForecastPolicy,
): readonly CanonicalForecastEeSample[] {
  const policy = normalizePolicy(policyInput);
  assertActionScope(action);
  const sequence = validateFrameSequence(frames, policy);
  if (action.primaryUeId !== frames[0]!.protagonistUeId) {
    fail('candidate action primary UE must match the accepted Walker protagonist');
  }
  const primaryUeIndex = sequence.ueIds.indexOf(action.primaryUeId);
  if (primaryUeIndex < 0) fail('primary UE is absent from the Walker forecast frame');
  const sourceBeamIndex = indexOfKey(sequence.beamKeys, action.from!);
  const targetBeamIndex = indexOfKey(sequence.beamKeys, action.to);
  if (sourceBeamIndex < 0 || targetBeamIndex < 0) fail('source and target beams must exist in the Walker forecast beam set');

  let baselineLagged = Object.freeze([...frames[0]!.laggedInterferenceWByUe]);
  let candidateLagged = Object.freeze([...frames[0]!.laggedInterferenceWByUe]);
  const samples: CanonicalForecastEeSample[] = [];
  frames.forEach((frame, sampleIndex) => {
    if (frame.servingBeamIndexByUe[primaryUeIndex] !== sourceBeamIndex) {
      fail(`frames[${sampleIndex}] baseline primary assignment does not match the declared source beam`);
    }
    if (!frame.beams[sourceBeamIndex]!.scheduled || !frame.beams[targetBeamIndex]!.scheduled) {
      fail(`frames[${sampleIndex}] source and target beams must remain scheduled across the forecast horizon`);
    }
    const matrices = buildPhysicalMatrices(frame);
    const baselineServing = Object.freeze([...frame.servingBeamIndexByUe]);
    const candidateServing = [...baselineServing];
    candidateServing[primaryUeIndex] = targetBeamIndex;
    const baselineLoads = loadForAssignments(baselineServing, frame.beams.length);
    const candidateLoads = loadForAssignments(candidateServing, frame.beams.length);
    assertActiveBeamBudgets(frame, baselineLoads, `frames[${sampleIndex}] baseline`);
    assertActiveBeamBudgets(frame, candidateLoads, `frames[${sampleIndex}] candidate`);
    const baselineInput = canonicalInput(
      configForSample(frame.canonicalConfig, sequence.durationSec, frame.beams.length, targetBeamIndex, false),
      matrices,
      baselineServing,
      baselineLoads,
      frame,
      baselineLagged,
    );
    const candidateInput = canonicalInput(
      configForSample(
        frame.canonicalConfig,
        sequence.durationSec,
        frame.beams.length,
        targetBeamIndex,
        sampleIndex === 0,
      ),
      matrices,
      candidateServing,
      candidateLoads,
      frame,
      candidateLagged,
    );
    const baselineResult = computeCanonicalEe(baselineInput);
    const candidateResult = computeCanonicalEe(candidateInput);
    baselineLagged = Object.freeze([...baselineResult.throughput.interferenceUW]);
    candidateLagged = Object.freeze([...candidateResult.throughput.interferenceUW]);
    samples.push(deepFreeze({
      sourceFrameId: frame.sourceFrameId,
      epochUtcMs: frame.epochUtcMs,
      startSimTimeMs: frame.absoluteUtcMs,
      durationSec: sequence.durationSec,
      policyConfigHash: policy.policyConfigHash,
      scenarioStateHash: frame.scenarioStateHash,
      geometryModelHash: frame.geometryModels.geometryModelHash,
      canonicalConfigHash: frame.canonicalConfigHash,
      assignmentStateHash: frame.assignmentStateHash,
      canonicalPowerStateHash: frame.canonicalPowerStateHash,
      protagonistUeId: frame.protagonistUeId,
      baselineInput,
      candidateInput,
      ueIdsByIndex: Object.freeze([...sequence.ueIds]),
      beamKeysByIndex: Object.freeze(sequence.beamKeys.map(key => Object.freeze({ ...key }))),
    }));
  });
  return Object.freeze(samples);
}

export function buildWalkerCanonicalForecast(
  frames: readonly WalkerForecastFrame[],
  action: CandidateAssignmentDelta,
  policy: WalkerCanonicalForecastPolicy,
): WalkerCanonicalForecastBuildResult {
  const samples = buildWalkerCanonicalForecastSamples(frames, action, policy);
  const digests: CanonicalForecastDigestBundle = buildCanonicalForecastDigestBundle(samples, action);
  return deepFreeze({ samples, digests });
}
