import {
  CANONICAL_EE_CONTRACT_VERSION,
  computeCanonicalEe,
  computeCanonicalEvaluation,
  type CanonicalEeConfig,
  type CanonicalEeEvaluationSample,
  type CanonicalEeInput,
} from '../../analysis/canonicalEe';
import {
  candidateLinkKeyString,
  createForecastEeEvidence,
  validateCandidateAssignmentDelta,
  type CandidateAssignmentDelta,
  type CandidateLinkKey,
  type ForecastEeEvidence,
  type ForecastWindowProvenance,
} from './candidateDecisionContract';

export interface CanonicalForecastEeSample {
  readonly sourceFrameId: string;
  readonly epochUtcMs: number;
  readonly startSimTimeMs: number;
  readonly durationSec: number;
  readonly policyConfigHash: string;
  readonly scenarioStateHash: string;
  readonly geometryModelHash: string;
  readonly canonicalConfigHash: string;
  readonly assignmentStateHash: string;
  readonly canonicalPowerStateHash: string;
  readonly protagonistUeId: string;
  /** Full keep-serving canonical input for this future sample. */
  readonly baselineInput: CanonicalEeInput;
  /** Full assignment-substitution canonical input for this future sample. */
  readonly candidateInput: CanonicalEeInput;
  readonly ueIdsByIndex: readonly string[];
  readonly beamKeysByIndex: readonly CandidateLinkKey[];
}

export interface CanonicalForecastDigestBundle {
  readonly frameIdsOrDigest: string;
  readonly sampleDurationsDigest: string;
  readonly canonicalInputHash: string;
  readonly assignmentStateHash: string;
  readonly powerStateHash: string;
  readonly scenarioStateHash: string;
  readonly geometryModelHash: string;
  readonly canonicalConfigHash: string;
  readonly policyConfigHash: string;
}

export interface BuildCanonicalForecastEeEvidenceInput {
  readonly action: CandidateAssignmentDelta;
  readonly samples: readonly CanonicalForecastEeSample[];
  readonly digests: CanonicalForecastDigestBundle;
  readonly modelVersion?: string;
}

const CONFIG_EVENT_FIELDS = new Set<keyof CanonicalEeConfig>([
  'switchIndicatorByBeam',
]);

function nonEmpty(value: string, label: string): void {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${label} must be non-empty`);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function fnv1a32(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function digest(label: string, value: unknown): string {
  return `${label}:fnv1a32-${fnv1a32(stableJson(value))}`;
}

export function buildCanonicalForecastConfigHash(config: CanonicalEeConfig): string {
  return digest('walker-canonical-config', config);
}

function sameJson(left: unknown, right: unknown): boolean {
  return stableJson(left) === stableJson(right);
}

function sameFiniteVector(left: readonly number[], right: readonly number[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((value, index) => {
    const other = right[index];
    if (!Number.isFinite(value) || other === undefined || !Number.isFinite(other)) return false;
    const scale = Math.max(1, Math.abs(value), Math.abs(other));
    return Math.abs(value - other) <= 1e-12 * scale;
  });
}

function assertSamePhysicalConfig(baseline: CanonicalEeConfig, candidate: CanonicalEeConfig): void {
  const baselineCore = Object.fromEntries(
    Object.entries(baseline).filter(([key]) => !CONFIG_EVENT_FIELDS.has(key as keyof CanonicalEeConfig)),
  );
  const candidateCore = Object.fromEntries(
    Object.entries(candidate).filter(([key]) => !CONFIG_EVENT_FIELDS.has(key as keyof CanonicalEeConfig)),
  );
  if (!sameJson(baselineCore, candidateCore)) {
    throw new Error('baseline and candidate must use the same non-event canonical configuration');
  }
}

function assertSameHorizonPhysicalConfig(first: CanonicalEeConfig, current: CanonicalEeConfig): void {
  const omitted = new Set<keyof CanonicalEeConfig>(['frameDurationS', 'switchIndicatorByBeam']);
  const firstCore = Object.fromEntries(
    Object.entries(first).filter(([key]) => !omitted.has(key as keyof CanonicalEeConfig)),
  );
  const currentCore = Object.fromEntries(
    Object.entries(current).filter(([key]) => !omitted.has(key as keyof CanonicalEeConfig)),
  );
  if (!sameJson(firstCore, currentCore)) {
    throw new Error('canonical physical configuration must remain stable across the forecast horizon');
  }
}

function assertSameGeometryAndOwnership(baseline: CanonicalEeInput, candidate: CanonicalEeInput): void {
  const pairs: readonly [unknown, unknown, string][] = [
    [baseline.frame.thetaRadUb, candidate.frame.thetaRadUb, 'thetaRadUb'],
    [baseline.frame.propagationGainUb, candidate.frame.propagationGainUb, 'propagationGainUb'],
    [baseline.frame.receiveGainUb, candidate.frame.receiveGainUb, 'receiveGainUb'],
    [baseline.frame.beamSatelliteB, candidate.frame.beamSatelliteB, 'beamSatelliteB'],
    [baseline.frame.beamColorB, candidate.frame.beamColorB, 'beamColorB'],
  ];
  for (const [left, right, label] of pairs) {
    if (!sameJson(left, right)) throw new Error(`${label} must be identical across one counterfactual pair`);
  }
}

function indexOfKey(keys: readonly CandidateLinkKey[], target: CandidateLinkKey): number {
  const encoded = candidateLinkKeyString(target);
  return keys.findIndex(key => candidateLinkKeyString(key) === encoded);
}

function assertActionWitness(sample: CanonicalForecastEeSample, action: CandidateAssignmentDelta): void {
  const baselineFrame = sample.baselineInput.frame;
  const candidateFrame = sample.candidateInput.frame;
  if (sample.ueIdsByIndex.length !== baselineFrame.servingBeamU.length) {
    throw new Error('ueIdsByIndex must cover every canonical UE');
  }
  if (sample.beamKeysByIndex.length !== baselineFrame.beamActiveB.length) {
    throw new Error('beamKeysByIndex must cover every canonical beam');
  }
  if (candidateFrame.servingBeamU.length !== baselineFrame.servingBeamU.length
    || candidateFrame.beamActiveB.length !== baselineFrame.beamActiveB.length) {
    throw new Error('baseline and candidate canonical shapes must match');
  }
  const primaryUeIndex = sample.ueIdsByIndex.indexOf(action.primaryUeId);
  if (primaryUeIndex < 0) throw new Error('primary UE is missing from the canonical action witness');
  const targetBeamIndex = indexOfKey(sample.beamKeysByIndex, action.to);
  if (targetBeamIndex < 0) throw new Error('candidate target beam is missing from the canonical action witness');
  const sourceBeamIndex = action.from === null ? -1 : indexOfKey(sample.beamKeysByIndex, action.from);
  if (action.from !== null && sourceBeamIndex < 0) {
    throw new Error('serving source beam is missing from the canonical action witness');
  }
  if (baselineFrame.servingBeamU[primaryUeIndex] !== sourceBeamIndex) {
    throw new Error('baseline primary assignment does not match the declared action source');
  }
  if (candidateFrame.servingBeamU[primaryUeIndex] !== targetBeamIndex) {
    throw new Error('candidate primary assignment does not match the declared action target');
  }
  const affectedUeIds = new Set(action.affectedUeIds);
  for (let user = 0; user < sample.ueIdsByIndex.length; user += 1) {
    if (baselineFrame.servingBeamU[user] === candidateFrame.servingBeamU[user]) continue;
    const ueId = sample.ueIdsByIndex[user];
    if (ueId === undefined || !affectedUeIds.has(ueId)) {
      throw new Error(`counterfactual changed undeclared UE assignment at index ${user}`);
    }
  }
  const affectedBeamKeys = new Set(action.affectedBeamKeys.map(candidateLinkKeyString));
  for (let beam = 0; beam < sample.beamKeysByIndex.length; beam += 1) {
    const changed = baselineFrame.beamActiveB[beam] !== candidateFrame.beamActiveB[beam]
      || baselineFrame.beamLoadB[beam] !== candidateFrame.beamLoadB[beam];
    if (!changed) continue;
    const beamKey = sample.beamKeysByIndex[beam];
    if (beamKey === undefined || !affectedBeamKeys.has(candidateLinkKeyString(beamKey))) {
      throw new Error(`counterfactual changed undeclared beam state at index ${beam}`);
    }
  }
}

function binaryIndicatorVector(
  value: CanonicalEeConfig['switchIndicatorByBeam'],
  beamCount: number,
  label: string,
): readonly number[] {
  const indicators = value === undefined
    ? Array.from({ length: beamCount }, () => 0)
    : typeof value === 'number'
      ? Array.from({ length: beamCount }, () => value)
      : [...value];
  if (indicators.length !== beamCount) {
    throw new Error(`${label} must cover every canonical beam`);
  }
  indicators.forEach((indicator, beamIndex) => {
    if (!Number.isFinite(indicator) || (indicator !== 0 && indicator !== 1)) {
      throw new Error(`${label}[${beamIndex}] must be binary`);
    }
  });
  return indicators;
}

function assertExactlyOnceSwitchWitness(
  samples: readonly CanonicalForecastEeSample[],
  action: CandidateAssignmentDelta,
): { readonly targetBeamIndex: number; readonly indicatorDigest: string } {
  const indicatorWitness: Array<{
    readonly baseline: readonly number[];
    readonly candidate: readonly number[];
  }> = [];
  let firstTargetBeamIndex = -1;
  for (let sampleIndex = 0; sampleIndex < samples.length; sampleIndex += 1) {
    const sample = samples[sampleIndex]!;
    const beamCount = sample.beamKeysByIndex.length;
    const targetBeamIndex = indexOfKey(sample.beamKeysByIndex, action.to);
    if (targetBeamIndex < 0) {
      throw new Error('candidate target beam is missing from the switch-event witness');
    }
    if (sampleIndex === 0) firstTargetBeamIndex = targetBeamIndex;
    if (targetBeamIndex !== firstTargetBeamIndex) {
      throw new Error('candidate target beam index must remain stable across the forecast horizon');
    }
    const baselineIndicators = binaryIndicatorVector(
      sample.baselineInput.config.switchIndicatorByBeam,
      beamCount,
      `samples[${sampleIndex}].baseline switchIndicatorByBeam`,
    );
    const candidateIndicators = binaryIndicatorVector(
      sample.candidateInput.config.switchIndicatorByBeam,
      beamCount,
      `samples[${sampleIndex}].candidate switchIndicatorByBeam`,
    );
    for (let beamIndex = 0; beamIndex < beamCount; beamIndex += 1) {
      if (baselineIndicators[beamIndex] !== 0) {
        throw new Error('matched baseline must not contain a switch-event indicator');
      }
      const expectedCandidateIndicator = sampleIndex === 0 && beamIndex === targetBeamIndex ? 1 : 0;
      if (candidateIndicators[beamIndex] !== expectedCandidateIndicator) {
        throw new Error('candidate must contain exactly one target-beam switch event at the forecast boundary');
      }
    }
    indicatorWitness.push({ baseline: baselineIndicators, candidate: candidateIndicators });
  }
  return {
    targetBeamIndex: firstTargetBeamIndex,
    indicatorDigest: `fnv1a32-${fnv1a32(stableJson(indicatorWitness))}`,
  };
}

function validateSequence(
  samples: readonly CanonicalForecastEeSample[],
  action: CandidateAssignmentDelta,
  expectedPolicyConfigHash: string,
): {
  readonly epochUtcMs: number;
  readonly startSimTimeMs: number;
  readonly endSimTimeMs: number;
  readonly horizonSec: number;
  readonly switchTargetBeamIndex: number;
  readonly switchIndicatorDigest: string;
} {
  if (samples.length === 0) throw new Error('forecast samples are unavailable');
  nonEmpty(expectedPolicyConfigHash, 'digests.policyConfigHash');
  let expectedStartMs: number | null = null;
  let horizonSec = 0;
  const first = samples[0]!;
  const firstUeIds = first.ueIdsByIndex;
  const firstBeamKeys = first.beamKeysByIndex.map(candidateLinkKeyString);
  if (firstUeIds.length === 0 || new Set(firstUeIds).size !== firstUeIds.length
    || firstUeIds.some(ueId => typeof ueId !== 'string' || ueId.trim().length === 0)) {
    throw new Error('canonical UE index mapping must contain unique non-empty identities');
  }
  if (firstBeamKeys.length === 0 || new Set(firstBeamKeys).size !== firstBeamKeys.length) {
    throw new Error('canonical beam index mapping must contain unique identities');
  }
  if (action.primaryUeId !== first.protagonistUeId) {
    throw new Error('candidate action primary UE must match the forecast protagonist');
  }
  const sourceFrameIds = new Set<string>();
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index]!;
    nonEmpty(sample.sourceFrameId, `samples[${index}].sourceFrameId`);
    if (sourceFrameIds.has(sample.sourceFrameId)) throw new Error('forecast source-frame identities must be unique');
    sourceFrameIds.add(sample.sourceFrameId);
    nonEmpty(sample.policyConfigHash, `samples[${index}].policyConfigHash`);
    nonEmpty(sample.scenarioStateHash, `samples[${index}].scenarioStateHash`);
    nonEmpty(sample.geometryModelHash, `samples[${index}].geometryModelHash`);
    nonEmpty(sample.canonicalConfigHash, `samples[${index}].canonicalConfigHash`);
    nonEmpty(sample.assignmentStateHash, `samples[${index}].assignmentStateHash`);
    nonEmpty(sample.canonicalPowerStateHash, `samples[${index}].canonicalPowerStateHash`);
    nonEmpty(sample.protagonistUeId, `samples[${index}].protagonistUeId`);
    if (sample.policyConfigHash !== expectedPolicyConfigHash) {
      throw new Error('forecast sample policyConfigHash does not match the evidence digest bundle');
    }
    if (sample.epochUtcMs !== first.epochUtcMs
      || sample.scenarioStateHash !== first.scenarioStateHash
      || sample.geometryModelHash !== first.geometryModelHash
      || sample.protagonistUeId !== first.protagonistUeId) {
      throw new Error('forecast epoch, scenario, geometry, and protagonist must remain stable');
    }
    if (!sameJson(sample.ueIdsByIndex, firstUeIds)
      || !sameJson(sample.beamKeysByIndex.map(candidateLinkKeyString), firstBeamKeys)) {
      throw new Error('canonical UE and beam index mappings must remain stable across the forecast horizon');
    }
    if (!Number.isSafeInteger(sample.epochUtcMs) || sample.epochUtcMs < 0
      || !Number.isSafeInteger(sample.startSimTimeMs) || sample.startSimTimeMs < sample.epochUtcMs) {
      throw new Error(`samples[${index}] must use safe absolute UTC milliseconds at or after epochUtcMs`);
    }
    if (!Number.isFinite(sample.durationSec) || sample.durationSec <= 0) {
      throw new Error(`samples[${index}].durationSec must be finite and positive`);
    }
    if (!Number.isSafeInteger(sample.durationSec * 1000)) {
      throw new Error(`samples[${index}].durationSec must resolve to whole milliseconds`);
    }
    if (expectedStartMs !== null && Math.abs(sample.startSimTimeMs - expectedStartMs) > 1e-6) {
      throw new Error('forecast samples must form one contiguous equal-horizon sequence');
    }
    if (Math.abs(sample.baselineInput.config.frameDurationS - sample.durationSec) > 1e-9
      || Math.abs(sample.candidateInput.config.frameDurationS - sample.durationSec) > 1e-9) {
      throw new Error('canonical frameDurationS must match the forecast sample duration');
    }
    assertSamePhysicalConfig(sample.baselineInput.config, sample.candidateInput.config);
    assertSameHorizonPhysicalConfig(first.baselineInput.config, sample.baselineInput.config);
    assertSameGeometryAndOwnership(sample.baselineInput, sample.candidateInput);
    assertActionWitness(sample, action);
    expectedStartMs = sample.startSimTimeMs + sample.durationSec * 1000;
    horizonSec += sample.durationSec;
  }
  const switchWitness = assertExactlyOnceSwitchWitness(samples, action);
  return {
    epochUtcMs: first.epochUtcMs,
    startSimTimeMs: first.startSimTimeMs,
    endSimTimeMs: expectedStartMs!,
    horizonSec,
    switchTargetBeamIndex: switchWitness.targetBeamIndex,
    switchIndicatorDigest: switchWitness.indicatorDigest,
  };
}

/** Rebuild every public evidence digest from the exact sample/action payload. */
export function buildCanonicalForecastDigestBundle(
  samples: readonly CanonicalForecastEeSample[],
  action: CandidateAssignmentDelta,
): CanonicalForecastDigestBundle {
  if (samples.length === 0) throw new Error('cannot digest an empty canonical forecast');
  validateCandidateAssignmentDelta(action);
  const first = samples[0]!;
  const computedCanonicalConfigHashes = samples.map((sample, index) => {
    const computed = buildCanonicalForecastConfigHash(sample.baselineInput.config);
    if (sample.canonicalConfigHash !== computed) {
      throw new Error(`samples[${index}].canonicalConfigHash does not match its canonical baseline configuration`);
    }
    return computed;
  });
  return Object.freeze({
    frameIdsOrDigest: digest('walker-forecast-frames', samples.map(sample => ({
      sourceFrameId: sample.sourceFrameId,
      epochUtcMs: sample.epochUtcMs,
      scenarioStateHash: sample.scenarioStateHash,
      geometryModelHash: sample.geometryModelHash,
    }))),
    sampleDurationsDigest: digest('walker-forecast-durations', samples.map(sample => ({
      startSimTimeMs: sample.startSimTimeMs,
      durationSec: sample.durationSec,
    }))),
    canonicalInputHash: digest('walker-canonical-inputs', samples.map(sample => ({
      sourceFrameId: sample.sourceFrameId,
      baselineInput: sample.baselineInput,
      candidateInput: sample.candidateInput,
    }))),
    assignmentStateHash: digest('walker-forecast-assignments', {
      source: samples.map(sample => sample.assignmentStateHash),
      action,
      baseline: samples.map(sample => ({
        servingBeamU: sample.baselineInput.frame.servingBeamU,
        beamActiveB: sample.baselineInput.frame.beamActiveB,
        beamLoadB: sample.baselineInput.frame.beamLoadB,
      })),
      candidate: samples.map(sample => ({
        servingBeamU: sample.candidateInput.frame.servingBeamU,
        beamActiveB: sample.candidateInput.frame.beamActiveB,
        beamLoadB: sample.candidateInput.frame.beamLoadB,
      })),
    }),
    powerStateHash: digest('walker-forecast-power', {
      source: samples.map(sample => sample.canonicalPowerStateHash),
      baselineLagged: samples.map(sample => sample.baselineInput.frame.laggedInterferenceUW),
      candidateLagged: samples.map(sample => sample.candidateInput.frame.laggedInterferenceUW),
    }),
    scenarioStateHash: first.scenarioStateHash,
    geometryModelHash: first.geometryModelHash,
    canonicalConfigHash: digest('walker-canonical-config-sequence', computedCanonicalConfigHashes),
    policyConfigHash: first.policyConfigHash,
  });
}

function buildProvenance(
  input: BuildCanonicalForecastEeEvidenceInput,
  bounds: {
    readonly epochUtcMs: number;
    readonly startSimTimeMs: number;
    readonly endSimTimeMs: number;
    readonly switchTargetBeamIndex: number;
    readonly switchIndicatorDigest: string;
  },
): ForecastWindowProvenance {
  const digests = input.digests;
  for (const [key, value] of Object.entries(digests)) nonEmpty(value, `digests.${key}`);
  return Object.freeze({
    epochUtcMs: bounds.epochUtcMs,
    startSimTimeMs: bounds.startSimTimeMs,
    endSimTimeMs: bounds.endSimTimeMs,
    frameIdsOrDigest: digests.frameIdsOrDigest,
    sampleDurationsDigest: digests.sampleDurationsDigest,
    baselineAssignmentKey: input.action.from === null ? null : candidateLinkKeyString(input.action.from),
    canonicalInputHash: digests.canonicalInputHash,
    assignmentStateHash: digests.assignmentStateHash,
    powerStateHash: digests.powerStateHash,
    scenarioStateHash: digests.scenarioStateHash,
    geometryModelHash: digests.geometryModelHash,
    canonicalConfigHash: digests.canonicalConfigHash,
    policyConfigHash: digests.policyConfigHash,
    switchEventAccountingMode: 'target-once-at-horizon-start',
    switchBoundarySimTimeMs: bounds.startSimTimeMs,
    switchTargetBeamIndex: bounds.switchTargetBeamIndex,
    switchIndicatorDigest: bounds.switchIndicatorDigest,
  });
}

function unavailableEvidence(reason: string): ForecastEeEvidence {
  return createForecastEeEvidence({
    status: 'unavailable',
    horizonSec: null,
    deliveredBits: null,
    consumedJoules: null,
    eeBitPerJ: null,
    baselineDeliveredBits: null,
    baselineConsumedJoules: null,
    baselineEeBitPerJ: null,
    relativeDelta: null,
    action: null,
    provenance: null,
    modelVersion: null,
    reason,
  });
}

/**
 * Evaluate already-built full canonical baseline/candidate samples. This seam
 * deliberately does not invent future geometry, thresholds, or assignments.
 */
export function buildCanonicalForecastEeEvidence(
  input: BuildCanonicalForecastEeEvidenceInput,
): ForecastEeEvidence {
  try {
    validateCandidateAssignmentDelta(input.action);
  } catch (error) {
    return createForecastEeEvidence({
      status: 'invalid',
      horizonSec: null,
      deliveredBits: null,
      consumedJoules: null,
      eeBitPerJ: null,
      baselineDeliveredBits: null,
      baselineConsumedJoules: null,
      baselineEeBitPerJ: null,
      relativeDelta: null,
      action: null,
      provenance: null,
      modelVersion: input.modelVersion ?? CANONICAL_EE_CONTRACT_VERSION,
      reason: error instanceof Error ? error.message : 'candidate action is invalid',
    });
  }
  if (input.samples.length === 0) return unavailableEvidence('forecast samples are unavailable');
  let horizonSec: number | null = null;
  let provenance: ForecastWindowProvenance | null = null;
  try {
    const bounds = validateSequence(input.samples, input.action, input.digests.policyConfigHash);
    const expectedDigests = buildCanonicalForecastDigestBundle(input.samples, input.action);
    for (const [key, expected] of Object.entries(expectedDigests)) {
      if (input.digests[key as keyof CanonicalForecastDigestBundle] !== expected) {
        throw new Error(`forecast digest ${key} does not match the canonical sample payload`);
      }
    }
    horizonSec = bounds.horizonSec;
    provenance = buildProvenance(input, bounds);
    const baselineSamples: CanonicalEeEvaluationSample[] = [];
    const candidateSamples: CanonicalEeEvaluationSample[] = [];
    let expectedBaselineLagged: readonly number[] | null = null;
    let expectedCandidateLagged: readonly number[] | null = null;
    for (let sampleIndex = 0; sampleIndex < input.samples.length; sampleIndex += 1) {
      const sample = input.samples[sampleIndex]!;
      const baselineLagged = sample.baselineInput.frame.laggedInterferenceUW;
      const candidateLagged = sample.candidateInput.frame.laggedInterferenceUW;
      if (sampleIndex === 0) {
        if (!sameFiniteVector(baselineLagged, candidateLagged)) {
          throw new Error('baseline and candidate must start from the same accepted lagged-interference state');
        }
      } else if (expectedBaselineLagged === null || expectedCandidateLagged === null
        || !sameFiniteVector(baselineLagged, expectedBaselineLagged)
        || !sameFiniteVector(candidateLagged, expectedCandidateLagged)) {
        throw new Error('forecast lagged interference must follow each counterfactual previous canonical result');
      }
      const baseline = computeCanonicalEe(sample.baselineInput);
      const candidate = computeCanonicalEe(sample.candidateInput);
      expectedBaselineLagged = baseline.throughput.interferenceUW;
      expectedCandidateLagged = candidate.throughput.interferenceUW;
      baselineSamples.push({
        totalRateBps: baseline.throughput.totalRateBps,
        systemPowerW: baseline.power.systemPowerW,
        durationSec: sample.durationSec,
      });
      candidateSamples.push({
        totalRateBps: candidate.throughput.totalRateBps,
        systemPowerW: candidate.power.systemPowerW,
        durationSec: sample.durationSec,
      });
    }
    const baselineEvaluation = computeCanonicalEvaluation(baselineSamples);
    const candidateEvaluation = computeCanonicalEvaluation(candidateSamples);
    if (candidateEvaluation.status === 'zero-activity') {
      return createForecastEeEvidence({
        status: 'zero-activity',
        horizonSec,
        deliveredBits: 0,
        consumedJoules: 0,
        eeBitPerJ: 0,
        baselineDeliveredBits: baselineEvaluation.deliveredBits,
        baselineConsumedJoules: baselineEvaluation.consumedEnergyJ,
        baselineEeBitPerJ: baselineEvaluation.energyEfficiencyBitsPerJ,
        relativeDelta: null,
        action: input.action,
        provenance,
        modelVersion: input.modelVersion ?? CANONICAL_EE_CONTRACT_VERSION,
        reason: 'candidate counterfactual has zero delivered data and zero consumed energy',
      });
    }
    const baselineEe = baselineEvaluation.energyEfficiencyBitsPerJ;
    if (baselineEvaluation.status !== 'valid' || !Number.isFinite(baselineEe) || baselineEe <= 0) {
      throw new Error('keep-serving baseline EE must be finite and positive');
    }
    const candidateEe = candidateEvaluation.energyEfficiencyBitsPerJ;
    const relativeDelta = candidateEe / baselineEe - 1;
    if (!Number.isFinite(candidateEe) || !Number.isFinite(relativeDelta)) {
      throw new Error('candidate EE and relativeDelta must be finite');
    }
    return createForecastEeEvidence({
      status: 'valid',
      horizonSec,
      deliveredBits: candidateEvaluation.deliveredBits,
      consumedJoules: candidateEvaluation.consumedEnergyJ,
      eeBitPerJ: candidateEe,
      baselineDeliveredBits: baselineEvaluation.deliveredBits,
      baselineConsumedJoules: baselineEvaluation.consumedEnergyJ,
      baselineEeBitPerJ: baselineEe,
      relativeDelta,
      action: input.action,
      provenance,
      modelVersion: input.modelVersion ?? CANONICAL_EE_CONTRACT_VERSION,
      reason: null,
    });
  } catch (error) {
    return createForecastEeEvidence({
      status: 'invalid',
      horizonSec,
      deliveredBits: null,
      consumedJoules: null,
      eeBitPerJ: null,
      baselineDeliveredBits: null,
      baselineConsumedJoules: null,
      baselineEeBitPerJ: null,
      relativeDelta: null,
      action: input.action,
      provenance,
      modelVersion: input.modelVersion ?? CANONICAL_EE_CONTRACT_VERSION,
      reason: error instanceof Error ? error.message : 'canonical forecast evaluation failed',
    });
  }
}
