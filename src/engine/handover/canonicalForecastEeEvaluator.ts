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
  readonly startSimTimeMs: number;
  readonly durationSec: number;
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
  readonly canonicalConfigHash: string;
}

export interface BuildCanonicalForecastEeEvidenceInput {
  readonly action: CandidateAssignmentDelta;
  readonly samples: readonly CanonicalForecastEeSample[];
  readonly digests: CanonicalForecastDigestBundle;
  readonly modelVersion?: string;
}

const CONFIG_EVENT_FIELDS = new Set<keyof CanonicalEeConfig>([
  'trainingIndicatorByBeam',
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

function sameJson(left: unknown, right: unknown): boolean {
  return stableJson(left) === stableJson(right);
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

function validateSequence(
  samples: readonly CanonicalForecastEeSample[],
  action: CandidateAssignmentDelta,
): { readonly startSimTimeMs: number; readonly endSimTimeMs: number; readonly horizonSec: number } {
  if (samples.length === 0) throw new Error('forecast samples are unavailable');
  let expectedStartMs: number | null = null;
  let horizonSec = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index]!;
    nonEmpty(sample.sourceFrameId, `samples[${index}].sourceFrameId`);
    if (!Number.isFinite(sample.startSimTimeMs) || sample.startSimTimeMs < 0) {
      throw new Error(`samples[${index}].startSimTimeMs must be finite and non-negative`);
    }
    if (!Number.isFinite(sample.durationSec) || sample.durationSec <= 0) {
      throw new Error(`samples[${index}].durationSec must be finite and positive`);
    }
    if (expectedStartMs !== null && Math.abs(sample.startSimTimeMs - expectedStartMs) > 1e-6) {
      throw new Error('forecast samples must form one contiguous equal-horizon sequence');
    }
    if (Math.abs(sample.baselineInput.config.frameDurationS - sample.durationSec) > 1e-9
      || Math.abs(sample.candidateInput.config.frameDurationS - sample.durationSec) > 1e-9) {
      throw new Error('canonical frameDurationS must match the forecast sample duration');
    }
    assertSamePhysicalConfig(sample.baselineInput.config, sample.candidateInput.config);
    assertSameGeometryAndOwnership(sample.baselineInput, sample.candidateInput);
    assertActionWitness(sample, action);
    expectedStartMs = sample.startSimTimeMs + sample.durationSec * 1000;
    horizonSec += sample.durationSec;
  }
  return {
    startSimTimeMs: samples[0]!.startSimTimeMs,
    endSimTimeMs: expectedStartMs!,
    horizonSec,
  };
}

function buildProvenance(
  input: BuildCanonicalForecastEeEvidenceInput,
  bounds: { readonly startSimTimeMs: number; readonly endSimTimeMs: number },
): ForecastWindowProvenance {
  const digests = input.digests;
  for (const [key, value] of Object.entries(digests)) nonEmpty(value, `digests.${key}`);
  return Object.freeze({
    startSimTimeMs: bounds.startSimTimeMs,
    endSimTimeMs: bounds.endSimTimeMs,
    frameIdsOrDigest: digests.frameIdsOrDigest,
    sampleDurationsDigest: digests.sampleDurationsDigest,
    baselineAssignmentKey: input.action.from === null ? null : candidateLinkKeyString(input.action.from),
    canonicalInputHash: digests.canonicalInputHash,
    assignmentStateHash: digests.assignmentStateHash,
    powerStateHash: digests.powerStateHash,
    canonicalConfigHash: digests.canonicalConfigHash,
  });
}

function unavailableEvidence(reason: string): ForecastEeEvidence {
  return createForecastEeEvidence({
    status: 'unavailable',
    horizonSec: null,
    deliveredBits: null,
    consumedJoules: null,
    eeBitPerJ: null,
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
    const bounds = validateSequence(input.samples, input.action);
    horizonSec = bounds.horizonSec;
    provenance = buildProvenance(input, bounds);
    const baselineSamples: CanonicalEeEvaluationSample[] = [];
    const candidateSamples: CanonicalEeEvaluationSample[] = [];
    for (const sample of input.samples) {
      const baseline = computeCanonicalEe(sample.baselineInput);
      const candidate = computeCanonicalEe(sample.candidateInput);
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
        baselineEeBitPerJ: baselineEvaluation.energyEfficiencyBitsPerJ,
        relativeDelta: null,
        action: input.action,
        provenance,
        modelVersion: input.modelVersion ?? CANONICAL_EE_CONTRACT_VERSION,
        reason: 'candidate counterfactual has zero delivered data and zero consumed energy',
      });
    }
    const baselineEe = baselineEvaluation.energyEfficiencyBitsPerJ;
    return createForecastEeEvidence({
      status: 'valid',
      horizonSec,
      deliveredBits: candidateEvaluation.deliveredBits,
      consumedJoules: candidateEvaluation.consumedEnergyJ,
      eeBitPerJ: candidateEvaluation.energyEfficiencyBitsPerJ,
      baselineEeBitPerJ: baselineEe,
      relativeDelta: baselineEe > 0
        ? candidateEvaluation.energyEfficiencyBitsPerJ / baselineEe - 1
        : null,
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
      baselineEeBitPerJ: null,
      relativeDelta: null,
      action: input.action,
      provenance,
      modelVersion: input.modelVersion ?? CANONICAL_EE_CONTRACT_VERSION,
      reason: error instanceof Error ? error.message : 'canonical forecast evaluation failed',
    });
  }
}
