import {
  HARD_GATE_CODES,
  candidateLinkKey,
  candidateLinkKeyString,
  compareCandidateLinkKey,
  isForecastEeRankable,
  validateCandidateLinkKey,
  validateCandidateOpportunity,
  type CandidateEligibility,
  type CandidateLinkKey,
  type CandidateOpportunity,
  type CandidateTriggerStatus,
  type GateCode,
  type HandoverDecisionMode,
} from './candidateDecisionContract';

/**
 * The policy boundary is deliberately stateless. It classifies and orders the
 * current alternatives; qualification clocks, selection hold, guard, colour,
 * and UI ordering belong to the decision engine or presentation adapter.
 */
export interface HandoverSelectionPolicyInput {
  readonly serving: CandidateOpportunity | null;
  readonly alternatives: readonly CandidateOpportunity[];
}

export interface CandidatePolicyAssessment {
  readonly key: CandidateLinkKey;
  readonly hardEligibility: CandidateEligibility;
  readonly triggerStatus: CandidateTriggerStatus;
  readonly requiredTttSec: number;
  readonly rejectionCodes: readonly GateCode[];
}

export interface HandoverPolicyEvaluation {
  readonly mode: HandoverDecisionMode;
  /** Deterministic best-first order; the first item is the policy leader. */
  readonly assessments: readonly CandidatePolicyAssessment[];
}

export interface HandoverSelectionPolicy {
  evaluate(input: HandoverSelectionPolicyInput): HandoverPolicyEvaluation;
}

export interface HandoverTttConfig {
  readonly initialTttSec: number;
  readonly interTttSec: number;
  readonly intraTttSec: number;
}

export interface SinrOffsetPolicyConfig extends HandoverTttConfig {
  readonly interOffsetDb: number;
  readonly intraOffsetDb: number;
}

export interface ForecastEePolicyConfig extends HandoverTttConfig {
  /** Relative EE difference treated as a tie before QoS tie-breaks. */
  readonly eeToleranceRelative: number;
}

export const SINR_OFFSET_REQUIRED_GATES: readonly GateCode[] = Object.freeze([
  'elevation',
  'steering',
  'scheduled-illumination',
  'sinr',
]);

const FORECAST_EE_REQUIRED_GATES: readonly GateCode[] = HARD_GATE_CODES;

type PolicyMode = Extract<HandoverDecisionMode, 'sinr-offset' | 'ee-optimization'>;

interface PreparedAssessment {
  readonly assessment: CandidatePolicyAssessment;
  readonly sinrDb: number | null;
  readonly forecastEeBitPerJ: number | null;
  readonly remainingServiceTimeSec: number | null;
  readonly predictedThroughputBps: number | null;
}

function finiteNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be finite and non-negative`);
}

function finiteNumber(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite`);
}

function validateTttConfig(config: HandoverTttConfig): void {
  finiteNonNegative(config.initialTttSec, 'initialTttSec');
  finiteNonNegative(config.interTttSec, 'interTttSec');
  finiteNonNegative(config.intraTttSec, 'intraTttSec');
}

function validateSinrConfig(config: SinrOffsetPolicyConfig): void {
  validateTttConfig(config);
  finiteNonNegative(config.interOffsetDb, 'interOffsetDb');
  finiteNonNegative(config.intraOffsetDb, 'intraOffsetDb');
}

function validateEeConfig(config: ForecastEePolicyConfig): void {
  validateTttConfig(config);
  finiteNonNegative(config.eeToleranceRelative, 'eeToleranceRelative');
}

function gateMap(opportunity: CandidateOpportunity): ReadonlyMap<GateCode, CandidateOpportunity['gates'][number]> {
  return new Map(opportunity.gates.map(gate => [gate.code, gate] as const));
}

function metricStatusForGate(
  opportunity: CandidateOpportunity,
  code: GateCode,
): CandidateOpportunity['elevation'] | null {
  switch (code) {
    case 'elevation': return opportunity.elevation;
    case 'steering': return opportunity.steering;
    case 'sinr': return opportunity.sinr;
    case 'throughput': return opportunity.predictedThroughput;
    case 'remaining-service-time': return opportunity.remainingServiceTime;
    case 'scheduled-illumination':
    case 'ee-advantage':
      return null;
  }
}

function assessHardGates(
  opportunity: CandidateOpportunity,
  requiredGates: readonly GateCode[],
): Pick<CandidatePolicyAssessment, 'hardEligibility' | 'rejectionCodes'> {
  const gates = gateMap(opportunity);
  const rejectionCodes: GateCode[] = [];
  let hasUnavailable = false;
  let hasFailure = false;

  for (const code of requiredGates) {
    const gate = gates.get(code);
    const metric = metricStatusForGate(opportunity, code);
    const scheduledEvidenceInvalid = code === 'scheduled-illumination'
      && gate !== undefined
      && gate.result !== 'unavailable'
      && (gate.measured !== (gate.result === 'pass' ? 1 : 0)
        || gate.threshold !== 1
        || gate.unit !== 'boolean');
    const missingEvidence = gate === undefined
      || gate.result === 'unavailable'
      || scheduledEvidenceInvalid
      || (metric !== null && metric.status !== 'available');
    if (missingEvidence) {
      hasUnavailable = true;
      if (!rejectionCodes.includes(code)) rejectionCodes.push(code);
      continue;
    }
    if (gate.result === 'fail') {
      hasFailure = true;
      rejectionCodes.push(code);
    }
  }

  return {
    // Missing evidence wins over a known failed gate: this keeps the policy
    // fail-closed and never turns an incomplete measurement into eligibility.
    hardEligibility: hasUnavailable
      ? 'unavailable'
      : hasFailure
        ? 'ineligible'
        : 'eligible',
    rejectionCodes: Object.freeze([...rejectionCodes]),
  };
}

function requiredTtt(
  serving: CandidateOpportunity | null,
  candidate: CandidateOpportunity,
  config: HandoverTttConfig,
): number {
  if (serving === null) return config.initialTttSec;
  return serving.key.satelliteId === candidate.key.satelliteId
    ? config.intraTttSec
    : config.interTttSec;
}

function hasSameKey(left: CandidateLinkKey, right: CandidateLinkKey): boolean {
  return left.satelliteId === right.satelliteId && left.beamId === right.beamId;
}

function sinrTriggerStatus(
  serving: CandidateOpportunity | null,
  candidate: CandidateOpportunity,
  hardEligibility: CandidateEligibility,
  interOffsetDb: number,
  intraOffsetDb: number,
): CandidateTriggerStatus {
  if (hardEligibility === 'unavailable') return 'unavailable';
  if (hardEligibility === 'ineligible') return 'not-satisfied';
  if (serving === null) return hardEligibility === 'eligible' ? 'satisfied' : 'not-satisfied';
  if (hasSameKey(serving.key, candidate.key)) return 'not-satisfied';
  if (serving.sinr.status !== 'available' || serving.sinr.value === null
    || candidate.sinr.status !== 'available' || candidate.sinr.value === null) {
    return 'unavailable';
  }
  const offsetDb = serving.key.satelliteId === candidate.key.satelliteId
    ? intraOffsetDb
    : interOffsetDb;
  // Keep the existing strict comparison: candidate SINR must be greater than
  // serving SINR plus the configured margin, not merely equal to it.
  return candidate.sinr.value > serving.sinr.value + offsetDb
    ? 'satisfied'
    : 'not-satisfied';
}

function forecastTriggerStatus(
  serving: CandidateOpportunity | null,
  candidate: CandidateOpportunity,
  hardEligibility: CandidateEligibility,
  commonWindowValid: boolean,
): CandidateTriggerStatus {
  if (hardEligibility === 'unavailable') return 'unavailable';
  if (hardEligibility === 'ineligible') return 'not-satisfied';
  if (serving !== null && hasSameKey(serving.key, candidate.key)) return 'not-satisfied';
  const eeGate = gateMap(candidate).get('ee-advantage');
  const evidence = candidate.forecastEe;
  if (!commonWindowValid || !isForecastEeRankable(evidence)) return 'unavailable';
  const expectedBaselineKey = serving === null ? null : candidateLinkKeyString(serving.key);
  const actionFromMatches = serving === null
    ? evidence.action?.from === null
    : evidence.action?.from !== null
      && evidence.action?.from !== undefined
      && hasSameKey(evidence.action.from, serving.key);
  const provenanceDurationSec = evidence.provenance === null
    ? null
    : (evidence.provenance.endSimTimeMs - evidence.provenance.startSimTimeMs) / 1000;
  if (!actionFromMatches
    || evidence.provenance?.baselineAssignmentKey !== expectedBaselineKey
    || provenanceDurationSec === null
    || evidence.horizonSec === null
    || Math.abs(provenanceDurationSec - evidence.horizonSec) > 1e-9) {
    return 'unavailable';
  }
  if (serving === null) {
    // Initial attach ranks valid candidate forecasts, but makes no EE-advantage
    // claim against a nonexistent serving baseline.
    return hardEligibility === 'eligible' ? 'satisfied' : 'not-satisfied';
  }
  if (eeGate === undefined || eeGate.result === 'unavailable'
    || evidence.baselineEeBitPerJ === null || evidence.baselineEeBitPerJ <= 0
    || evidence.relativeDelta === null
    || eeGate.measured === null || eeGate.threshold === null || eeGate.unit !== 'ratio'
    || Math.abs(eeGate.measured - evidence.relativeDelta) > 1e-9 * Math.max(1, Math.abs(evidence.relativeDelta))
    || (eeGate.result === 'pass') !== (evidence.relativeDelta >= eeGate.threshold)) {
    return 'unavailable';
  }
  return eeGate.result === 'pass' ? 'satisfied' : 'not-satisfied';
}

function forecastWindowSignature(candidate: CandidateOpportunity): string | null {
  try {
    const evidence = candidate.forecastEe;
    if (!isForecastEeRankable(evidence) || evidence.provenance === null || evidence.horizonSec === null) return null;
    const provenance = evidence.provenance;
    return JSON.stringify([
      evidence.horizonSec,
      provenance.startSimTimeMs,
      provenance.endSimTimeMs,
      provenance.frameIdsOrDigest,
      provenance.sampleDurationsDigest,
      provenance.baselineAssignmentKey,
      provenance.canonicalConfigHash,
      evidence.modelVersion,
    ]);
  } catch {
    return null;
  }
}

function hasOneCommonForecastWindow(candidates: readonly CandidateOpportunity[]): boolean {
  const signatures = new Set(candidates.map(forecastWindowSignature).filter(
    (signature): signature is string => signature !== null,
  ));
  return signatures.size <= 1;
}

function failClosedAssessment(
  key: CandidateLinkKey,
  requiredGates: readonly GateCode[],
  requiredTttSec: number,
  triggerCode: GateCode | null,
): CandidatePolicyAssessment {
  const rejectionCodes = triggerCode === null || requiredGates.includes(triggerCode)
    ? [...requiredGates]
    : [...requiredGates, triggerCode];
  return Object.freeze({
    key,
    hardEligibility: 'unavailable',
    triggerStatus: 'unavailable',
    requiredTttSec,
    rejectionCodes: Object.freeze(rejectionCodes),
  });
}

function validateInput(input: HandoverSelectionPolicyInput): void {
  if (input === null || typeof input !== 'object') throw new Error('policy input must be an object');
  if (!Array.isArray(input.alternatives)) throw new Error('policy alternatives must be an array');
  if (input.serving !== null) validateCandidateOpportunity(input.serving);
  const seen = new Set<string>();
  for (const candidate of input.alternatives) {
    // Validate identity up front so a malformed pair cannot be silently
    // dropped. Metric/gate structure is checked per candidate below and is
    // converted to an unavailable assessment on failure.
    validateCandidateLinkKey(candidate.key);
    const key = candidateLinkKeyString(candidate.key);
    if (seen.has(key)) throw new Error(`duplicate policy alternative ${key}`);
    seen.add(key);
  }
}

function safePreparedAssessment(
  serving: CandidateOpportunity | null,
  candidate: CandidateOpportunity,
  requiredGates: readonly GateCode[],
  config: HandoverTttConfig,
  triggerCode: GateCode | null,
  build: (hard: Pick<CandidatePolicyAssessment, 'hardEligibility' | 'rejectionCodes'>) => CandidateTriggerStatus,
): PreparedAssessment {
  const requiredTttSec = requiredTtt(serving, candidate, config);
  try {
    validateCandidateOpportunity(candidate);
    const hard = assessHardGates(candidate, requiredGates);
    const triggerStatus = build(hard);
    const rejectionCodes = triggerStatus === 'satisfied' || triggerCode === null
      ? hard.rejectionCodes
      : Object.freeze([...hard.rejectionCodes, ...(hard.rejectionCodes.includes(triggerCode) ? [] : [triggerCode])]);
    return {
      assessment: Object.freeze({
        key: candidateLinkKey(candidate.key.satelliteId, candidate.key.beamId),
        hardEligibility: hard.hardEligibility,
        triggerStatus,
        requiredTttSec,
        rejectionCodes,
      }),
      sinrDb: candidate.sinr.status === 'available' ? candidate.sinr.value : null,
      forecastEeBitPerJ: isForecastEeRankable(candidate.forecastEe)
        ? candidate.forecastEe.eeBitPerJ
        : null,
      remainingServiceTimeSec: candidate.remainingServiceTime.status === 'available'
        ? candidate.remainingServiceTime.value
        : null,
      predictedThroughputBps: candidate.predictedThroughput.status === 'available'
        ? candidate.predictedThroughput.value
        : null,
    };
  } catch {
    // A valid key is still useful for a visible unavailable row. An invalid key
    // is a structural contract error and cannot be safely represented.
    validateCandidateLinkKey(candidate.key);
    return {
      assessment: failClosedAssessment(
        candidateLinkKey(candidate.key.satelliteId, candidate.key.beamId),
        requiredGates,
        requiredTttSec,
        triggerCode,
      ),
      sinrDb: null,
      forecastEeBitPerJ: null,
      remainingServiceTimeSec: null,
      predictedThroughputBps: null,
    };
  }
}

function eligibilityPriority(assessment: CandidatePolicyAssessment): number {
  if (assessment.hardEligibility === 'eligible' && assessment.triggerStatus === 'satisfied') return 0;
  if (assessment.hardEligibility === 'eligible' && assessment.triggerStatus === 'not-satisfied') return 1;
  if (assessment.hardEligibility === 'eligible') return 2;
  if (assessment.hardEligibility === 'ineligible') return 3;
  return 4;
}

function compareSinrPrepared(left: PreparedAssessment, right: PreparedAssessment): number {
  const priority = eligibilityPriority(left.assessment) - eligibilityPriority(right.assessment);
  if (priority !== 0) return priority;
  const leftSinr = left.sinrDb;
  const rightSinr = right.sinrDb;
  if (leftSinr !== null && rightSinr !== null && leftSinr !== rightSinr) return rightSinr - leftSinr;
  if (leftSinr !== null && rightSinr === null) return -1;
  if (leftSinr === null && rightSinr !== null) return 1;
  return compareCandidateLinkKey(left.assessment.key, right.assessment.key);
}

function compareEeTieBreak(left: PreparedAssessment, right: PreparedAssessment): number {
  const leftEe = left.forecastEeBitPerJ;
  const rightEe = right.forecastEeBitPerJ;
  if (leftEe !== null && rightEe === null) return -1;
  if (leftEe === null && rightEe !== null) return 1;

  const leftRemaining = left.remainingServiceTimeSec;
  const rightRemaining = right.remainingServiceTimeSec;
  if (leftRemaining !== null && rightRemaining !== null && leftRemaining !== rightRemaining) {
    return rightRemaining - leftRemaining;
  }
  if (leftRemaining !== null && rightRemaining === null) return -1;
  if (leftRemaining === null && rightRemaining !== null) return 1;

  const leftThroughput = left.predictedThroughputBps;
  const rightThroughput = right.predictedThroughputBps;
  if (leftThroughput !== null && rightThroughput !== null && leftThroughput !== rightThroughput) {
    return rightThroughput - leftThroughput;
  }
  if (leftThroughput !== null && rightThroughput === null) return -1;
  if (leftThroughput === null && rightThroughput !== null) return 1;
  return compareCandidateLinkKey(left.assessment.key, right.assessment.key);
}

function orderEePrepared(
  values: readonly PreparedAssessment[],
  tolerance: number,
): PreparedAssessment[] {
  const result: PreparedAssessment[] = [];
  const priorities = [...new Set(values.map(value => eligibilityPriority(value.assessment)))].sort((a, b) => a - b);
  for (const priority of priorities) {
    const rankable = values.filter(value => eligibilityPriority(value.assessment) === priority
      && value.forecastEeBitPerJ !== null);
    const unrankable = values.filter(value => eligibilityPriority(value.assessment) === priority
      && value.forecastEeBitPerJ === null);
    rankable.sort((left, right) => {
      const leftEe = left.forecastEeBitPerJ ?? -Infinity;
      const rightEe = right.forecastEeBitPerJ ?? -Infinity;
      return rightEe - leftEe || compareCandidateLinkKey(left.assessment.key, right.assessment.key);
    });
    while (rankable.length > 0) {
      const anchor = rankable[0]!;
      const anchorEe = anchor.forecastEeBitPerJ ?? 0;
      const tieGroup = rankable.filter(value => {
        const ee = value.forecastEeBitPerJ ?? 0;
        return Math.abs(anchorEe - ee) <= tolerance * Math.max(Math.abs(anchorEe), Math.abs(ee), 1e-12);
      });
      const tieKeys = new Set(tieGroup.map(value => candidateLinkKeyString(value.assessment.key)));
      rankable.splice(0, rankable.length, ...rankable.filter(
        value => !tieKeys.has(candidateLinkKeyString(value.assessment.key)),
      ));
      tieGroup.sort(compareEeTieBreak);
      result.push(...tieGroup);
    }
    unrankable.sort(compareEeTieBreak);
    result.push(...unrankable);
  }
  return result;
}

function evaluatePolicy(
  mode: PolicyMode,
  input: HandoverSelectionPolicyInput,
  requiredGates: readonly GateCode[],
  config: HandoverTttConfig,
  triggerCode: GateCode | null,
  buildTrigger: (candidate: CandidateOpportunity, hard: Pick<CandidatePolicyAssessment, 'hardEligibility' | 'rejectionCodes'>) => CandidateTriggerStatus,
  order: (values: readonly PreparedAssessment[]) => readonly PreparedAssessment[],
): HandoverPolicyEvaluation {
  validateInput(input);
  const prepared = input.alternatives.map(candidate => safePreparedAssessment(
    input.serving,
    candidate,
    requiredGates,
    config,
    triggerCode,
    hard => buildTrigger(candidate, hard),
  ));
  const ordered = order(prepared);
  return Object.freeze({
    mode,
    assessments: Object.freeze(ordered.map(item => item.assessment)),
  });
}

export class SinrOffsetPolicy implements HandoverSelectionPolicy {
  private readonly config: SinrOffsetPolicyConfig;

  constructor(config: SinrOffsetPolicyConfig) {
    validateSinrConfig(config);
    this.config = Object.freeze({ ...config });
  }

  evaluate(input: HandoverSelectionPolicyInput): HandoverPolicyEvaluation {
    return evaluatePolicy(
      'sinr-offset',
      input,
      SINR_OFFSET_REQUIRED_GATES,
      this.config,
      null,
      (candidate, hard) => sinrTriggerStatus(
        input.serving,
        candidate,
        hard.hardEligibility,
        this.config.interOffsetDb,
        this.config.intraOffsetDb,
      ),
      values => [...values].sort(compareSinrPrepared),
    );
  }
}

export class ForecastEePolicy implements HandoverSelectionPolicy {
  private readonly config: ForecastEePolicyConfig;

  constructor(config: ForecastEePolicyConfig) {
    validateEeConfig(config);
    this.config = Object.freeze({ ...config });
  }

  evaluate(input: HandoverSelectionPolicyInput): HandoverPolicyEvaluation {
    validateInput(input);
    const commonWindowValid = hasOneCommonForecastWindow(input.alternatives);
    return evaluatePolicy(
      'ee-optimization',
      input,
      FORECAST_EE_REQUIRED_GATES,
      this.config,
      'ee-advantage',
      (candidate, hard) => forecastTriggerStatus(
        input.serving,
        candidate,
        hard.hardEligibility,
        commonWindowValid,
      ),
      values => orderEePrepared(values, this.config.eeToleranceRelative),
    );
  }
}
