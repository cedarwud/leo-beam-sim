/**
 * S0 contract for the homepage multi-candidate handover lane.
 *
 * This module deliberately has no runtime or presentation dependencies.  It
 * owns the immutable join point between candidate measurement, decision state,
 * and a commit receipt; display budgets and colours belong to a later adapter.
 */

export type EvidenceStatus =
  | 'available'
  | 'unavailable'
  | 'stale'
  | 'invalid'
  | 'zero-activity';

export type ForecastEeStatus =
  | 'valid'
  | 'zero-activity'
  | 'unavailable'
  | 'stale'
  | 'invalid';

export class CandidateContractError extends Error {
  readonly code: 'INVALID_CONTRACT' | 'CLOCK_DISCONTINUITY';

  constructor(message: string, code: 'INVALID_CONTRACT' | 'CLOCK_DISCONTINUITY' = 'INVALID_CONTRACT') {
    super(message);
    this.name = 'CandidateContractError';
    this.code = code;
  }
}

function fail(message: string, code: 'INVALID_CONTRACT' | 'CLOCK_DISCONTINUITY' = 'INVALID_CONTRACT'): never {
  throw new CandidateContractError(message, code);
}

function nonEmpty(value: string, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) fail(`${label} must be non-empty`);
  return value;
}

function finite(value: number, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${label} must be finite`);
  return value;
}

function nonNegative(value: number, label: string): number {
  finite(value, label);
  if (value < 0) fail(`${label} must be non-negative`);
  return value;
}

function positive(value: number, label: string): number {
  finite(value, label);
  if (value <= 0) fail(`${label} must be positive`);
  return value;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function unique<T>(values: readonly T[], label: string, key: (value: T) => string): void {
  const seen = new Set<string>();
  for (const value of values) {
    const identity = key(value);
    if (seen.has(identity)) fail(`${label} contains duplicate ${identity}`);
    seen.add(identity);
  }
}

function freezeArray<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...values]);
}

/** A stable, typed identity for one satellite-beam decision link. */
export interface CandidateLinkKey {
  readonly satelliteId: string;
  readonly beamId: number;
}

export function candidateLinkKey(satelliteId: string, beamId: number): CandidateLinkKey {
  const id = nonEmpty(satelliteId, 'satelliteId');
  if (id.includes('|')) fail('satelliteId must not contain the candidate-key delimiter "|"');
  if (!Number.isInteger(beamId) || beamId < 0) fail('beamId must be a non-negative integer');
  return Object.freeze({ satelliteId: id, beamId });
}

export function validateCandidateLinkKey(key: CandidateLinkKey): void {
  if (!isObject(key)) fail('candidate link key must be an object');
  candidateLinkKey(key.satelliteId, key.beamId);
}

export function candidateLinkKeyString(key: CandidateLinkKey): string {
  validateCandidateLinkKey(key);
  return `${key.satelliteId}|${key.beamId}`;
}

export function sameCandidateLinkKey(left: CandidateLinkKey, right: CandidateLinkKey): boolean {
  validateCandidateLinkKey(left);
  validateCandidateLinkKey(right);
  return left.satelliteId === right.satelliteId && left.beamId === right.beamId;
}

export function compareCandidateLinkKey(left: CandidateLinkKey, right: CandidateLinkKey): number {
  const a = candidateLinkKeyString(left);
  const b = candidateLinkKeyString(right);
  return a < b ? -1 : a > b ? 1 : 0;
}

export interface MetricEvidence {
  readonly status: EvidenceStatus;
  readonly value: number | null;
  readonly unit: string;
  readonly sourceFrameId: string | null;
  readonly reason: string | null;
  /** Optional because older producers do not publish this timestamp yet. */
  readonly measuredAtSimTimeMs?: number | null;
}

export function validateMetricEvidence(evidence: MetricEvidence, label = 'metric evidence'): void {
  if (!isObject(evidence)) fail(`${label} must be an object`);
  const statuses: readonly EvidenceStatus[] = [
    'available', 'unavailable', 'stale', 'invalid', 'zero-activity',
  ];
  if (!statuses.includes(evidence.status)) fail(`${label}.status is invalid`);
  nonEmpty(evidence.unit, `${label}.unit`);
  if (evidence.sourceFrameId !== null) nonEmpty(evidence.sourceFrameId, `${label}.sourceFrameId`);
  if (evidence.measuredAtSimTimeMs !== undefined && evidence.measuredAtSimTimeMs !== null) {
    nonNegative(evidence.measuredAtSimTimeMs, `${label}.measuredAtSimTimeMs`);
  }
  if (evidence.value !== null) finite(evidence.value, `${label}.value`);
  if (evidence.status === 'available') {
    if (evidence.value === null) fail(`${label} marked available without a value`);
    if (evidence.sourceFrameId === null) fail(`${label} marked available without a source frame`);
  }
  if (evidence.status === 'unavailable' && evidence.value !== null) {
    fail(`${label} marked unavailable must not carry a value`);
  }
  if (evidence.status === 'invalid' && evidence.value !== null) {
    fail(`${label} marked invalid must not carry a value`);
  }
  if (evidence.status === 'zero-activity' && evidence.value !== null && evidence.value !== 0) {
    fail(`${label} marked zero-activity must be zero or null`);
  }
  if (evidence.status !== 'available' && (evidence.reason === null || evidence.reason.trim().length === 0)) {
    fail(`${label} non-available status requires a reason`);
  }
}

export function createMetricEvidence(input: MetricEvidence): MetricEvidence {
  validateMetricEvidence(input);
  return Object.freeze({ ...input });
}

export type GateCode =
  | 'elevation'
  | 'steering'
  | 'scheduled-illumination'
  | 'sinr'
  | 'throughput'
  | 'remaining-service-time'
  | 'ee-advantage';

export type CandidateGateCategory = 'hard-qos' | 'decision-trigger';
export type GateResult = 'pass' | 'fail' | 'unavailable';

export interface CandidateGateResult {
  readonly code: GateCode;
  readonly category: CandidateGateCategory;
  readonly result: GateResult;
  readonly measured: number | null;
  readonly threshold: number | null;
  readonly unit: string | null;
  readonly reason: string | null;
}

const ALL_GATE_CODES: readonly GateCode[] = Object.freeze([
  'elevation',
  'steering',
  'scheduled-illumination',
  'sinr',
  'throughput',
  'remaining-service-time',
  'ee-advantage',
]);

export const HARD_GATE_CODES: readonly GateCode[] = Object.freeze([
  'elevation',
  'steering',
  'scheduled-illumination',
  'sinr',
  'throughput',
  'remaining-service-time',
]);

export function validateCandidateGateResult(gate: CandidateGateResult, label = 'candidate gate'): void {
  if (!isObject(gate)) fail(`${label} must be an object`);
  if (!ALL_GATE_CODES.includes(gate.code)) fail(`${label}.code is invalid`);
  const expectedCategory: CandidateGateCategory = gate.code === 'ee-advantage' ? 'decision-trigger' : 'hard-qos';
  if (gate.category !== expectedCategory) fail(`${label}.category does not match ${gate.code}`);
  if (!(['pass', 'fail', 'unavailable'] as readonly GateResult[]).includes(gate.result)) {
    fail(`${label}.result is invalid`);
  }
  if (gate.measured !== null) finite(gate.measured, `${label}.measured`);
  if (gate.threshold !== null) finite(gate.threshold, `${label}.threshold`);
  if (gate.unit !== null) nonEmpty(gate.unit, `${label}.unit`);
  if (gate.result !== 'pass' && (gate.reason === null || gate.reason.trim().length === 0)) {
    fail(`${label} ${gate.result} result requires a reason`);
  }
}

export function createCandidateGateResult(input: CandidateGateResult): CandidateGateResult {
  validateCandidateGateResult(input);
  return Object.freeze({ ...input });
}

export interface CandidateAssignmentDelta {
  readonly primaryUeId: string;
  readonly from: CandidateLinkKey | null;
  readonly to: CandidateLinkKey;
  readonly affectedUeIds: readonly string[];
  readonly affectedBeamKeys: readonly CandidateLinkKey[];
}

export function validateCandidateAssignmentDelta(delta: CandidateAssignmentDelta): void {
  if (!isObject(delta)) fail('candidate assignment delta must be an object');
  nonEmpty(delta.primaryUeId, 'assignment delta primaryUeId');
  if (delta.from !== null) validateCandidateLinkKey(delta.from);
  validateCandidateLinkKey(delta.to);
  if (delta.from !== null && sameCandidateLinkKey(delta.from, delta.to)) {
    fail('assignment delta from and to must differ');
  }
  if (!Array.isArray(delta.affectedUeIds) || delta.affectedUeIds.length === 0) {
    fail('assignment delta affectedUeIds must be non-empty');
  }
  for (const ueId of delta.affectedUeIds) nonEmpty(ueId, 'assignment delta affectedUeIds entry');
  unique(delta.affectedUeIds, 'assignment delta affectedUeIds', value => value);
  if (!delta.affectedUeIds.includes(delta.primaryUeId)) {
    fail('assignment delta affectedUeIds must include primaryUeId');
  }
  if (!Array.isArray(delta.affectedBeamKeys) || delta.affectedBeamKeys.length === 0) {
    fail('assignment delta affectedBeamKeys must be non-empty');
  }
  for (const key of delta.affectedBeamKeys) validateCandidateLinkKey(key);
  unique(delta.affectedBeamKeys, 'assignment delta affectedBeamKeys', candidateLinkKeyString);
  if (!delta.affectedBeamKeys.some(key => sameCandidateLinkKey(key, delta.to))) {
    fail('assignment delta affectedBeamKeys must include the target');
  }
  if (delta.from !== null && !delta.affectedBeamKeys.some(key => sameCandidateLinkKey(key, delta.from!))) {
    fail('assignment delta affectedBeamKeys must include the source');
  }
}

function cloneAssignmentDelta(delta: CandidateAssignmentDelta): CandidateAssignmentDelta {
  validateCandidateAssignmentDelta(delta);
  return Object.freeze({
    ...delta,
    from: delta.from === null ? null : candidateLinkKey(delta.from.satelliteId, delta.from.beamId),
    to: candidateLinkKey(delta.to.satelliteId, delta.to.beamId),
    affectedUeIds: freezeArray(delta.affectedUeIds),
    affectedBeamKeys: freezeArray(delta.affectedBeamKeys.map(key => candidateLinkKey(key.satelliteId, key.beamId))),
  });
}

export interface ForecastWindowProvenance {
  readonly epochUtcMs: number;
  readonly startSimTimeMs: number;
  readonly endSimTimeMs: number;
  readonly frameIdsOrDigest: string;
  readonly sampleDurationsDigest: string;
  readonly baselineAssignmentKey: string | null;
  readonly canonicalInputHash: string;
  readonly assignmentStateHash: string;
  readonly powerStateHash: string;
  readonly scenarioStateHash: string;
  readonly geometryModelHash: string;
  readonly canonicalConfigHash: string;
  readonly policyConfigHash: string;
  readonly switchEventAccountingMode: 'target-once-at-horizon-start';
  readonly switchBoundarySimTimeMs: number;
  readonly switchTargetBeamIndex: number;
  readonly switchIndicatorDigest: string;
}

export function validateForecastWindowProvenance(provenance: ForecastWindowProvenance): void {
  if (!isObject(provenance)) fail('forecast provenance must be an object');
  nonNegative(provenance.epochUtcMs, 'forecast provenance epochUtcMs');
  nonNegative(provenance.startSimTimeMs, 'forecast provenance startSimTimeMs');
  if (!Number.isSafeInteger(provenance.epochUtcMs)
    || !Number.isSafeInteger(provenance.startSimTimeMs)
    || !Number.isSafeInteger(provenance.endSimTimeMs)) {
    fail('forecast provenance UTC timestamps must be safe integer milliseconds');
  }
  if (provenance.startSimTimeMs < provenance.epochUtcMs) {
    fail('forecast provenance startSimTimeMs must not precede epochUtcMs');
  }
  positive(provenance.endSimTimeMs - provenance.startSimTimeMs, 'forecast provenance duration');
  nonEmpty(provenance.frameIdsOrDigest, 'forecast provenance frameIdsOrDigest');
  nonEmpty(provenance.sampleDurationsDigest, 'forecast provenance sampleDurationsDigest');
  if (provenance.baselineAssignmentKey !== null) {
    nonEmpty(provenance.baselineAssignmentKey, 'forecast provenance baselineAssignmentKey');
  }
  nonEmpty(provenance.canonicalInputHash, 'forecast provenance canonicalInputHash');
  nonEmpty(provenance.assignmentStateHash, 'forecast provenance assignmentStateHash');
  nonEmpty(provenance.powerStateHash, 'forecast provenance powerStateHash');
  nonEmpty(provenance.scenarioStateHash, 'forecast provenance scenarioStateHash');
  nonEmpty(provenance.geometryModelHash, 'forecast provenance geometryModelHash');
  nonEmpty(provenance.canonicalConfigHash, 'forecast provenance canonicalConfigHash');
  nonEmpty(provenance.policyConfigHash, 'forecast provenance policyConfigHash');
  if (provenance.switchEventAccountingMode !== 'target-once-at-horizon-start') {
    fail('forecast provenance switchEventAccountingMode is invalid');
  }
  if (provenance.switchBoundarySimTimeMs !== provenance.startSimTimeMs) {
    fail('forecast provenance switch boundary must equal the forecast start');
  }
  if (!Number.isInteger(provenance.switchTargetBeamIndex) || provenance.switchTargetBeamIndex < 0) {
    fail('forecast provenance switchTargetBeamIndex must be a non-negative integer');
  }
  nonEmpty(provenance.switchIndicatorDigest, 'forecast provenance switchIndicatorDigest');
}

export interface ForecastEeEvidence {
  readonly status: ForecastEeStatus;
  readonly horizonSec: number | null;
  readonly deliveredBits: number | null;
  readonly consumedJoules: number | null;
  readonly eeBitPerJ: number | null;
  readonly baselineDeliveredBits: number | null;
  readonly baselineConsumedJoules: number | null;
  readonly baselineEeBitPerJ: number | null;
  readonly relativeDelta: number | null;
  readonly action: CandidateAssignmentDelta | null;
  readonly provenance: ForecastWindowProvenance | null;
  readonly modelVersion: string | null;
  readonly reason: string | null;
}

function optionalNonNegative(value: number | null, label: string): void {
  if (value !== null) nonNegative(value, label);
}

function approximatelyEqual(left: number, right: number): boolean {
  const scale = Math.max(1, Math.abs(left), Math.abs(right));
  return Math.abs(left - right) <= 1e-9 * scale;
}

export function validateForecastEeEvidence(evidence: ForecastEeEvidence): void {
  if (!isObject(evidence)) fail('forecast EE evidence must be an object');
  const statuses: readonly ForecastEeStatus[] = [
    'valid', 'zero-activity', 'unavailable', 'stale', 'invalid',
  ];
  if (!statuses.includes(evidence.status)) fail('forecast EE status is invalid');
  if (evidence.horizonSec !== null) positive(evidence.horizonSec, 'forecast EE horizonSec');
  optionalNonNegative(evidence.deliveredBits, 'forecast EE deliveredBits');
  optionalNonNegative(evidence.consumedJoules, 'forecast EE consumedJoules');
  optionalNonNegative(evidence.eeBitPerJ, 'forecast EE eeBitPerJ');
  optionalNonNegative(evidence.baselineDeliveredBits, 'forecast EE baselineDeliveredBits');
  optionalNonNegative(evidence.baselineConsumedJoules, 'forecast EE baselineConsumedJoules');
  optionalNonNegative(evidence.baselineEeBitPerJ, 'forecast EE baselineEeBitPerJ');
  if (evidence.relativeDelta !== null) finite(evidence.relativeDelta, 'forecast EE relativeDelta');
  if (evidence.action !== null) validateCandidateAssignmentDelta(evidence.action);
  if (evidence.provenance !== null) validateForecastWindowProvenance(evidence.provenance);
  if (evidence.modelVersion !== null) nonEmpty(evidence.modelVersion, 'forecast EE modelVersion');

  if (evidence.status === 'valid') {
    if (evidence.horizonSec === null || evidence.deliveredBits === null
      || evidence.consumedJoules === null || evidence.eeBitPerJ === null
      || evidence.action === null || evidence.provenance === null || evidence.modelVersion === null) {
      fail('valid forecast EE requires complete measurements, action, provenance, and model version');
    }
    if (evidence.consumedJoules <= 0) fail('valid forecast EE requires positive consumed energy');
    const expectedEe = evidence.deliveredBits / evidence.consumedJoules;
    if (!approximatelyEqual(evidence.eeBitPerJ, expectedEe)) {
      fail('valid forecast EE must equal deliveredBits / consumedJoules');
    }
    if (evidence.baselineEeBitPerJ === null) {
      if (evidence.action.from !== null) fail('handover forecast EE requires a positive baseline EE value');
      if (evidence.baselineDeliveredBits !== null || evidence.baselineConsumedJoules !== null) {
        fail('initial-attach forecast EE must not invent keep-serving activity');
      }
      if (evidence.relativeDelta !== null) fail('relativeDelta requires a baseline EE value');
    } else if (evidence.baselineEeBitPerJ > 0) {
      if (evidence.action.from === null) fail('initial-attach forecast EE cannot claim a keep-serving baseline');
      if (evidence.baselineDeliveredBits === null || evidence.baselineConsumedJoules === null) {
        fail('valid handover forecast EE requires complete baseline activity values');
      }
      if (evidence.baselineConsumedJoules <= 0) {
        fail('valid handover forecast EE requires positive baseline consumed energy');
      }
      if (!approximatelyEqual(
        evidence.baselineEeBitPerJ,
        evidence.baselineDeliveredBits / evidence.baselineConsumedJoules,
      )) {
        fail('baseline forecast EE must equal baselineDeliveredBits / baselineConsumedJoules');
      }
      if (evidence.relativeDelta === null
        || !approximatelyEqual(evidence.relativeDelta, evidence.eeBitPerJ / evidence.baselineEeBitPerJ - 1)) {
        fail('relativeDelta must match candidate and baseline EE');
      }
    } else {
      fail('valid forecast EE baseline must be positive');
    }
  }

  if (evidence.status === 'zero-activity') {
    if (evidence.horizonSec === null || evidence.deliveredBits !== 0
      || evidence.consumedJoules !== 0 || evidence.eeBitPerJ !== 0
      || evidence.action === null || evidence.provenance === null || evidence.modelVersion === null) {
      fail('zero-activity forecast EE must have a positive horizon and zero activity values');
    }
    if (evidence.relativeDelta !== null) fail('zero-activity forecast EE cannot claim relative improvement');
  }

  if (evidence.status === 'unavailable' && (evidence.eeBitPerJ !== null || evidence.deliveredBits !== null
    || evidence.consumedJoules !== null)) {
    fail('unavailable forecast EE must not carry computed activity values');
  }
  if ((evidence.status === 'stale' || evidence.status === 'invalid')
    && (evidence.reason === null || evidence.reason.trim().length === 0)) {
    fail(`${evidence.status} forecast EE requires a reason`);
  }
  if (evidence.status === 'invalid' && evidence.eeBitPerJ !== null) {
    fail('invalid forecast EE must not be rankable through an EE value');
  }
}

export function createForecastEeEvidence(input: ForecastEeEvidence): ForecastEeEvidence {
  validateForecastEeEvidence(input);
  return Object.freeze({
    ...input,
    action: input.action === null ? null : cloneAssignmentDelta(input.action),
    provenance: input.provenance === null ? null : Object.freeze({ ...input.provenance }),
  });
}

export function isForecastEeRankable(
  evidence: ForecastEeEvidence | null,
): evidence is ForecastEeEvidence & { readonly status: 'valid'; readonly eeBitPerJ: number } {
  if (evidence === null || evidence.status !== 'valid') return false;
  try {
    validateForecastEeEvidence(evidence);
    return evidence.eeBitPerJ !== null;
  } catch {
    return false;
  }
}

export type BeamIdentitySource = 'physical-beam' | 'walker-cell-surrogate';
export type CandidateSinrPowerModel = 'profile-rated-rf' | 'angle-aware-assignment';

/**
 * Provenance for the SINR value used by the candidate decision policy. The
 * active Walker compatibility lane uses rated RF admission; this is not an
 * active-link power sample and is never forecast-EE evidence.
 */
export interface CandidateSinrMeasurementContext {
  readonly purpose: 'sinr-offset-admission' | 'forecast-ee-qos';
  readonly powerModel: CandidateSinrPowerModel;
  readonly profileId: string;
  readonly epochToken: string;
  readonly ratedTransmitPowerDbm: number | null;
  readonly activeInterferenceKeys: readonly string[];
}

export type CandidateGeometryClass =
  | 'geometrically-reachable'
  | 'steering-valid'
  | 'scheduled-and-illuminated'
  | 'service-eligible';

export interface CandidateOpportunity {
  readonly key: CandidateLinkKey;
  readonly primaryUeId: string;
  readonly sourceFrameId: string;
  readonly beamIdentitySource: BeamIdentitySource;
  /** Optional only for older fixtures/producers; active candidate lanes publish it. */
  readonly sinrMeasurementContext?: CandidateSinrMeasurementContext;
  readonly geometryClass: CandidateGeometryClass;
  readonly elevation: MetricEvidence;
  readonly steering: MetricEvidence;
  readonly range: MetricEvidence;
  readonly sinr: MetricEvidence;
  readonly predictedThroughput: MetricEvidence;
  readonly remainingServiceTime: MetricEvidence;
  readonly forecastEe: ForecastEeEvidence | null;
  readonly gates: readonly CandidateGateResult[];
}

const GEOMETRY_CLASSES: readonly CandidateGeometryClass[] = Object.freeze([
  'geometrically-reachable',
  'steering-valid',
  'scheduled-and-illuminated',
  'service-eligible',
]);

export function validateCandidateOpportunity(opportunity: CandidateOpportunity): void {
  if (!isObject(opportunity)) fail('candidate opportunity must be an object');
  if (Object.prototype.hasOwnProperty.call(opportunity, 'kind')) {
    fail('candidate opportunity must not carry inter/intra handover kind');
  }
  validateCandidateLinkKey(opportunity.key);
  nonEmpty(opportunity.primaryUeId, 'candidate opportunity primaryUeId');
  nonEmpty(opportunity.sourceFrameId, 'candidate opportunity sourceFrameId');
  if (!(['physical-beam', 'walker-cell-surrogate'] as readonly BeamIdentitySource[])
    .includes(opportunity.beamIdentitySource)) {
    fail('candidate opportunity beamIdentitySource is invalid');
  }
  const sinrContext = opportunity.sinrMeasurementContext;
  if (sinrContext !== undefined) {
    if (!(['sinr-offset-admission', 'forecast-ee-qos'] as const).includes(sinrContext.purpose)) {
      fail('candidate opportunity SINR purpose is invalid');
    }
    if (!(['profile-rated-rf', 'angle-aware-assignment'] as const).includes(sinrContext.powerModel)) {
      fail('candidate opportunity SINR power model is invalid');
    }
    nonEmpty(sinrContext.profileId, 'candidate opportunity SINR profileId');
    nonEmpty(sinrContext.epochToken, 'candidate opportunity SINR epochToken');
    if (sinrContext.ratedTransmitPowerDbm !== null) {
      finite(sinrContext.ratedTransmitPowerDbm, 'candidate opportunity rated transmit power');
    }
    if (!Array.isArray(sinrContext.activeInterferenceKeys)) {
      fail('candidate opportunity active interference keys must be an array');
    }
    for (const key of sinrContext.activeInterferenceKeys) {
      nonEmpty(key, 'candidate opportunity active interference key');
    }
    unique(sinrContext.activeInterferenceKeys, 'candidate opportunity active interference keys', key => key);
    if (sinrContext.powerModel === 'profile-rated-rf' && sinrContext.ratedTransmitPowerDbm === null) {
      fail('profile-rated RF admission requires rated transmit power');
    }
  }
  if (!GEOMETRY_CLASSES.includes(opportunity.geometryClass)) fail('candidate opportunity geometryClass is invalid');
  const metrics: readonly [string, MetricEvidence][] = [
    ['elevation', opportunity.elevation],
    ['steering', opportunity.steering],
    ['range', opportunity.range],
    ['sinr', opportunity.sinr],
    ['predictedThroughput', opportunity.predictedThroughput],
    ['remainingServiceTime', opportunity.remainingServiceTime],
  ];
  for (const [name, metric] of metrics) {
    validateMetricEvidence(metric, `candidate opportunity ${name}`);
    if (metric.status === 'available' && metric.sourceFrameId !== opportunity.sourceFrameId) {
      fail(`candidate opportunity ${name} is from a different source frame`);
    }
  }
  if (opportunity.forecastEe !== null) {
    validateForecastEeEvidence(opportunity.forecastEe);
    if (opportunity.forecastEe.action !== null) {
      if (opportunity.forecastEe.action.primaryUeId !== opportunity.primaryUeId) {
        fail('forecast EE action primary UE does not match candidate opportunity');
      }
      if (!sameCandidateLinkKey(opportunity.forecastEe.action.to, opportunity.key)) {
        fail('forecast EE action target does not match candidate opportunity');
      }
    }
  }
  if (!Array.isArray(opportunity.gates)) fail('candidate opportunity gates must be an array');
  for (const gate of opportunity.gates) validateCandidateGateResult(gate);
  unique(opportunity.gates, 'candidate opportunity gates', gate => gate.code);
}

function cloneMetricEvidence(evidence: MetricEvidence): MetricEvidence {
  validateMetricEvidence(evidence);
  return Object.freeze({ ...evidence });
}

function cloneForecastEeEvidence(evidence: ForecastEeEvidence | null): ForecastEeEvidence | null {
  return evidence === null ? null : createForecastEeEvidence(evidence);
}

export function freezeCandidateOpportunity(opportunity: CandidateOpportunity): CandidateOpportunity {
  validateCandidateOpportunity(opportunity);
  return Object.freeze({
    ...opportunity,
    key: candidateLinkKey(opportunity.key.satelliteId, opportunity.key.beamId),
    sinrMeasurementContext: opportunity.sinrMeasurementContext === undefined
      ? undefined
      : Object.freeze({
        ...opportunity.sinrMeasurementContext,
        activeInterferenceKeys: freezeArray(opportunity.sinrMeasurementContext.activeInterferenceKeys),
      }),
    elevation: cloneMetricEvidence(opportunity.elevation),
    steering: cloneMetricEvidence(opportunity.steering),
    range: cloneMetricEvidence(opportunity.range),
    sinr: cloneMetricEvidence(opportunity.sinr),
    predictedThroughput: cloneMetricEvidence(opportunity.predictedThroughput),
    remainingServiceTime: cloneMetricEvidence(opportunity.remainingServiceTime),
    forecastEe: cloneForecastEeEvidence(opportunity.forecastEe),
    gates: freezeArray(opportunity.gates.map(gate => createCandidateGateResult(gate))),
  });
}

export type CandidateEligibility = 'eligible' | 'ineligible' | 'unavailable';
export type CandidateTriggerStatus = 'satisfied' | 'not-satisfied' | 'unavailable';

function gateMap(opportunity: CandidateOpportunity): ReadonlyMap<GateCode, CandidateGateResult> {
  return new Map(opportunity.gates.map(gate => [gate.code, gate] as const));
}

function metricForGate(opportunity: CandidateOpportunity, code: GateCode): MetricEvidence | null {
  switch (code) {
    case 'elevation': return opportunity.elevation;
    case 'steering': return opportunity.steering;
    case 'sinr': return opportunity.sinr;
    case 'throughput': return opportunity.predictedThroughput;
    case 'remaining-service-time': return opportunity.remainingServiceTime;
    case 'scheduled-illumination': return null;
    case 'ee-advantage': return null;
  }
}

export function deriveCandidateEligibility(opportunity: CandidateOpportunity): CandidateEligibility {
  validateCandidateOpportunity(opportunity);
  const gates = gateMap(opportunity);
  for (const code of HARD_GATE_CODES) {
    const gate = gates.get(code);
    if (gate === undefined) return 'unavailable';
    const metric = metricForGate(opportunity, code);
    if (metric !== null && metric.status !== 'available') return 'unavailable';
    if (gate.result === 'fail') return 'ineligible';
    if (gate.result === 'unavailable') return 'unavailable';
  }
  return 'eligible';
}

export function deriveCandidateTriggerStatus(opportunity: CandidateOpportunity): CandidateTriggerStatus {
  validateCandidateOpportunity(opportunity);
  const gate = gateMap(opportunity).get('ee-advantage');
  if (gate === undefined || gate.result === 'unavailable') return 'unavailable';
  if (!isForecastEeRankable(opportunity.forecastEe)) return 'unavailable';
  return gate.result === 'pass' ? 'satisfied' : 'not-satisfied';
}

export interface CandidateDecisionState {
  readonly key: CandidateLinkKey;
  readonly hardEligibility: CandidateEligibility;
  readonly triggerStatus: CandidateTriggerStatus;
  readonly qualificationSec: number;
  readonly requiredTttSec: number;
  readonly stable: boolean;
  readonly rank: number | null;
  readonly rejectionCodes: readonly GateCode[];
}

export function validateCandidateDecisionState(state: CandidateDecisionState): void {
  if (!isObject(state)) fail('candidate decision state must be an object');
  validateCandidateLinkKey(state.key);
  if (!(['eligible', 'ineligible', 'unavailable'] as readonly CandidateEligibility[])
    .includes(state.hardEligibility)) fail('candidate decision hardEligibility is invalid');
  if (!(['satisfied', 'not-satisfied', 'unavailable'] as readonly CandidateTriggerStatus[])
    .includes(state.triggerStatus)) fail('candidate decision triggerStatus is invalid');
  nonNegative(state.qualificationSec, 'candidate decision qualificationSec');
  nonNegative(state.requiredTttSec, 'candidate decision requiredTttSec');
  if (typeof state.stable !== 'boolean') fail('candidate decision stable must be boolean');
  if (state.rank !== null && (!Number.isInteger(state.rank) || state.rank < 1)) {
    fail('candidate decision rank must be null or a positive integer');
  }
  if (!Array.isArray(state.rejectionCodes)) fail('candidate decision rejectionCodes must be an array');
  for (const code of state.rejectionCodes) {
    if (!ALL_GATE_CODES.includes(code)) fail('candidate decision rejection code is invalid');
  }
  unique(state.rejectionCodes, 'candidate decision rejectionCodes', code => code);
  if (state.stable && (state.hardEligibility !== 'eligible' || state.triggerStatus !== 'satisfied'
    || state.qualificationSec < state.requiredTttSec)) {
    fail('stable candidate must be eligible, trigger-satisfied, and past TTT');
  }
  if (state.stable && state.rank === null) fail('stable candidate must have a rank');
  if (!state.stable && state.rank !== null) fail('non-stable candidate must not have a rank');
}

export function deriveCandidateDecisionState(
  opportunity: CandidateOpportunity,
  qualificationSec: number,
  requiredTttSec: number,
  rank: number | null = null,
): CandidateDecisionState {
  validateCandidateOpportunity(opportunity);
  nonNegative(qualificationSec, 'qualificationSec');
  nonNegative(requiredTttSec, 'requiredTttSec');
  const hardEligibility = deriveCandidateEligibility(opportunity);
  const triggerStatus = deriveCandidateTriggerStatus(opportunity);
  const stable = hardEligibility === 'eligible'
    && triggerStatus === 'satisfied'
    && qualificationSec >= requiredTttSec;
  const rejectionCodes = opportunity.gates
    .filter(gate => gate.result === 'fail')
    .map(gate => gate.code);
  const state: CandidateDecisionState = {
    key: opportunity.key,
    hardEligibility,
    triggerStatus,
    qualificationSec,
    requiredTttSec,
    stable,
    rank: stable ? rank : null,
    rejectionCodes: freezeArray(rejectionCodes),
  };
  validateCandidateDecisionState(state);
  return Object.freeze(state);
}

export type HandoverKind = 'initial-attach' | 'intra-satellite' | 'inter-satellite';

export function deriveHandoverKind(
  serving: CandidateLinkKey | null,
  target: CandidateLinkKey,
): HandoverKind {
  validateCandidateLinkKey(target);
  if (serving === null) return 'initial-attach';
  validateCandidateLinkKey(serving);
  if (sameCandidateLinkKey(serving, target)) fail('handover target must differ from serving link');
  return serving.satelliteId === target.satelliteId ? 'intra-satellite' : 'inter-satellite';
}

export type HandoverPhase =
  | 'initial-attach'
  | 'monitoring'
  | 'evaluating'
  | 'qualifying'
  | 'selection-hold'
  | 'switching'
  | 'guard';

export type HandoverDecisionMode =
  | 'ee-optimization'
  | 'service-continuity-protection'
  /** Migration compatibility mode while forecast-EE activation is gated. */
  | 'sinr-offset';

export interface HandoverCommitReceipt {
  readonly episodeId: string;
  readonly sourceFrameId: string;
  readonly simTimeMs: number;
  readonly from: CandidateLinkKey | null;
  readonly to: CandidateLinkKey;
  readonly kind: HandoverKind;
  readonly mode: HandoverDecisionMode;
  readonly reason: string;
  /** True only when an existing active link ended at the commit boundary. */
  readonly oldLinkEnded: boolean;
  /** A receipt is published only after the new link starts. */
  readonly newLinkStarted: boolean;
}

export function validateHandoverCommitReceipt(receipt: HandoverCommitReceipt): void {
  if (!isObject(receipt)) fail('handover commit receipt must be an object');
  nonEmpty(receipt.episodeId, 'commit receipt episodeId');
  nonEmpty(receipt.sourceFrameId, 'commit receipt sourceFrameId');
  nonNegative(receipt.simTimeMs, 'commit receipt simTimeMs');
  if (receipt.from !== null) validateCandidateLinkKey(receipt.from);
  validateCandidateLinkKey(receipt.to);
  if (!(['initial-attach', 'intra-satellite', 'inter-satellite'] as readonly HandoverKind[])
    .includes(receipt.kind)) fail('commit receipt kind is invalid');
  if (receipt.kind !== deriveHandoverKind(receipt.from, receipt.to)) fail('commit receipt kind does not match link identities');
  if (!(['ee-optimization', 'service-continuity-protection', 'sinr-offset'] as readonly HandoverDecisionMode[])
    .includes(receipt.mode)) fail('commit receipt mode is invalid');
  nonEmpty(receipt.reason, 'commit receipt reason');
  if (typeof receipt.oldLinkEnded !== 'boolean' || typeof receipt.newLinkStarted !== 'boolean') {
    fail('commit receipt link boundary flags must be boolean');
  }
  if (!receipt.newLinkStarted) fail('commit receipt cannot be published before the new link starts');
  if ((receipt.from === null) === receipt.oldLinkEnded) {
    fail('oldLinkEnded must be false for initial attach and true for a replacement');
  }
}

export function createHandoverCommitReceipt(input: HandoverCommitReceipt): HandoverCommitReceipt {
  validateHandoverCommitReceipt(input);
  return Object.freeze({
    ...input,
    from: input.from === null ? null : candidateLinkKey(input.from.satelliteId, input.from.beamId),
    to: candidateLinkKey(input.to.satelliteId, input.to.beamId),
  });
}

export type DecisionClockDiscontinuity =
  | 'none'
  | 'seek'
  | 'loop-wrap'
  | 'epoch-change'
  | 'source-change'
  | 'invalid';

export interface DecisionClockContext {
  readonly simTimeMs: number;
  readonly dtSec: number;
  readonly sourceFrameId: string;
  readonly epochToken: string;
  readonly discontinuity: DecisionClockDiscontinuity;
  readonly previousSimTimeMs?: number | null;
  readonly previousEpochToken?: string | null;
}

export interface DecisionClockClassification {
  readonly discontinuity: DecisionClockDiscontinuity;
  readonly resetRequired: boolean;
  readonly elapsedSec: number | null;
  readonly reason: string;
}

export function classifyDecisionClock(context: DecisionClockContext): DecisionClockClassification {
  const hasValidCurrent = typeof context.simTimeMs === 'number' && Number.isFinite(context.simTimeMs)
    && context.simTimeMs >= 0;
  const hasValidDt = typeof context.dtSec === 'number' && Number.isFinite(context.dtSec) && context.dtSec >= 0;
  const hasValidIdentity = typeof context.sourceFrameId === 'string' && context.sourceFrameId.trim().length > 0
    && typeof context.epochToken === 'string' && context.epochToken.trim().length > 0;
  if (!hasValidCurrent || !hasValidDt || !hasValidIdentity) {
    return Object.freeze({
      discontinuity: 'invalid',
      resetRequired: true,
      elapsedSec: null,
      reason: 'simulation time, delta, source frame, or epoch token is invalid',
    });
  }
  if (context.discontinuity !== 'none') {
    return Object.freeze({
      discontinuity: context.discontinuity,
      resetRequired: true,
      elapsedSec: context.dtSec,
      reason: `caller classified a ${context.discontinuity} discontinuity`,
    });
  }
  const previousTime = context.previousSimTimeMs ?? null;
  if (previousTime !== null && (!Number.isFinite(previousTime) || previousTime < 0)) {
    return Object.freeze({
      discontinuity: 'invalid',
      resetRequired: true,
      elapsedSec: null,
      reason: 'previous simulation time is invalid',
    });
  }
  if (context.previousEpochToken !== undefined && context.previousEpochToken !== null
    && context.previousEpochToken !== context.epochToken) {
    return Object.freeze({
      discontinuity: 'epoch-change',
      resetRequired: true,
      elapsedSec: previousTime === null ? null : (context.simTimeMs - previousTime) / 1000,
      reason: 'epoch token changed; TTT, selection hold, guard, and stale forecasts must reset',
    });
  }
  if (previousTime !== null) {
    const elapsedSec = (context.simTimeMs - previousTime) / 1000;
    if (elapsedSec < 0) {
      return Object.freeze({
        discontinuity: 'seek',
        resetRequired: true,
        elapsedSec,
        reason: 'simulation time moved backwards',
      });
    }
    if (Math.abs(elapsedSec - context.dtSec) > 1e-6) {
      return Object.freeze({
        discontinuity: 'seek',
        resetRequired: true,
        elapsedSec,
        reason: 'reported delta does not match absolute simulation time',
      });
    }
    return Object.freeze({
      discontinuity: 'none',
      resetRequired: false,
      elapsedSec,
      reason: 'continuous simulation clock',
    });
  }
  return Object.freeze({
    discontinuity: 'none',
    resetRequired: false,
    elapsedSec: null,
    reason: 'first decision frame has no previous clock sample',
  });
}

export function requiresDecisionReset(context: DecisionClockContext): boolean {
  return classifyDecisionClock(context).resetRequired;
}

export interface HandoverDecisionFrame {
  readonly episodeId: string;
  readonly sourceFrameId: string;
  readonly simTimeMs: number;
  readonly phase: HandoverPhase;
  readonly serving: CandidateLinkKey | null;
  readonly opportunities: readonly CandidateOpportunity[];
  readonly states: readonly CandidateDecisionState[];
  readonly provisionalLeader: CandidateLinkKey | null;
  readonly selectedTarget: CandidateLinkKey | null;
  readonly selectedKind: HandoverKind | null;
  readonly selectionHoldSec: number;
  readonly selectionHoldRequiredSec: number;
  readonly mode: HandoverDecisionMode;
  readonly recentCommit: HandoverCommitReceipt | null;
  /** Optional until all producers carry the clock epoch token. */
  readonly epochToken?: string;
}

const HANDOVER_PHASES: readonly HandoverPhase[] = Object.freeze([
  'initial-attach', 'monitoring', 'evaluating', 'qualifying', 'selection-hold', 'switching', 'guard',
]);

function validatePhase(phase: HandoverPhase): void {
  if (!HANDOVER_PHASES.includes(phase)) fail('handover decision phase is invalid');
}

function keyIn(keys: readonly CandidateLinkKey[], candidate: CandidateLinkKey | null): boolean {
  return candidate !== null && keys.some(key => sameCandidateLinkKey(key, candidate));
}

export function validateHandoverDecisionFrame(frame: HandoverDecisionFrame): void {
  if (!isObject(frame)) fail('handover decision frame must be an object');
  nonEmpty(frame.episodeId, 'decision frame episodeId');
  nonEmpty(frame.sourceFrameId, 'decision frame sourceFrameId');
  nonNegative(frame.simTimeMs, 'decision frame simTimeMs');
  validatePhase(frame.phase);
  if (frame.epochToken !== undefined) nonEmpty(frame.epochToken, 'decision frame epochToken');
  if (frame.serving !== null) validateCandidateLinkKey(frame.serving);
  if (!Array.isArray(frame.opportunities)) fail('decision frame opportunities must be an array');
  if (!Array.isArray(frame.states)) fail('decision frame states must be an array');
  const primaryUeId = frame.opportunities[0]?.primaryUeId ?? null;
  for (const opportunity of frame.opportunities) {
    validateCandidateOpportunity(opportunity);
    if (primaryUeId !== null && opportunity.primaryUeId !== primaryUeId) {
      fail('decision frame contains opportunities for different primary UEs');
    }
    if (opportunity.sourceFrameId !== frame.sourceFrameId) {
      fail('decision frame contains an opportunity from a different source frame');
    }
  }
  const opportunityKeys = frame.opportunities.map(opportunity => opportunity.key);
  unique(opportunityKeys, 'decision frame opportunities', candidateLinkKeyString);
  const stateKeys = frame.states.map(state => state.key);
  unique(stateKeys, 'decision frame states', candidateLinkKeyString);
  if (frame.states.length !== frame.opportunities.length
    || !opportunityKeys.every(key => stateKeys.some(stateKey => sameCandidateLinkKey(key, stateKey)))) {
    fail('decision frame states must cover exactly the opportunity set');
  }
  for (const state of frame.states) validateCandidateDecisionState(state);
  if (frame.provisionalLeader !== null) {
    validateCandidateLinkKey(frame.provisionalLeader);
    if (!keyIn(opportunityKeys, frame.provisionalLeader)) fail('provisional leader is not an opportunity');
    if (frame.serving !== null && sameCandidateLinkKey(frame.serving, frame.provisionalLeader)) {
      fail('provisional leader must not be the current serving link');
    }
  }
  if (frame.selectedTarget !== null) {
    validateCandidateLinkKey(frame.selectedTarget);
    if (!keyIn(opportunityKeys, frame.selectedTarget)) fail('selected target is not an opportunity');
    if (frame.serving !== null && sameCandidateLinkKey(frame.serving, frame.selectedTarget)) {
      fail('selected target must differ from the current serving link');
    }
    const selectedState = frame.states.find(state => sameCandidateLinkKey(state.key, frame.selectedTarget!));
    if (selectedState === undefined || !selectedState.stable) {
      fail('selected target must be a stable candidate');
    }
    const derivedKind = deriveHandoverKind(frame.serving, frame.selectedTarget);
    if (frame.selectedKind !== derivedKind) fail('selectedKind does not match serving and selected target');
  } else if (frame.selectedKind !== null) {
    fail('selectedKind requires a selected target');
  }
  nonNegative(frame.selectionHoldSec, 'decision frame selectionHoldSec');
  nonNegative(frame.selectionHoldRequiredSec, 'decision frame selectionHoldRequiredSec');
  if (!(['ee-optimization', 'service-continuity-protection', 'sinr-offset'] as readonly HandoverDecisionMode[])
    .includes(frame.mode)) fail('decision frame mode is invalid');
  if (frame.phase === 'initial-attach' && frame.serving !== null) {
    fail('initial-attach phase must not already have a serving link');
  }
  if (frame.recentCommit !== null) {
    validateHandoverCommitReceipt(frame.recentCommit);
    if (frame.recentCommit.episodeId !== frame.episodeId
      || frame.recentCommit.sourceFrameId !== frame.sourceFrameId
      || frame.recentCommit.simTimeMs !== frame.simTimeMs) {
      fail('decision frame commit receipt does not belong to the frame');
    }
    if (frame.serving === null || !sameCandidateLinkKey(frame.serving, frame.recentCommit.to)) {
      fail('a committed frame must expose the committed target as serving');
    }
  }
}

function cloneCandidateDecisionState(state: CandidateDecisionState): CandidateDecisionState {
  validateCandidateDecisionState(state);
  return Object.freeze({
    ...state,
    key: candidateLinkKey(state.key.satelliteId, state.key.beamId),
    rejectionCodes: freezeArray(state.rejectionCodes),
  });
}

function cloneCommitReceipt(receipt: HandoverCommitReceipt | null): HandoverCommitReceipt | null {
  return receipt === null ? null : createHandoverCommitReceipt(receipt);
}

export function freezeHandoverDecisionFrame(frame: HandoverDecisionFrame): HandoverDecisionFrame {
  validateHandoverDecisionFrame(frame);
  const cloned: HandoverDecisionFrame = {
    ...frame,
    serving: frame.serving === null ? null : candidateLinkKey(frame.serving.satelliteId, frame.serving.beamId),
    opportunities: freezeArray(frame.opportunities.map(freezeCandidateOpportunity)),
    states: freezeArray(frame.states.map(cloneCandidateDecisionState)),
    provisionalLeader: frame.provisionalLeader === null
      ? null : candidateLinkKey(frame.provisionalLeader.satelliteId, frame.provisionalLeader.beamId),
    selectedTarget: frame.selectedTarget === null
      ? null : candidateLinkKey(frame.selectedTarget.satelliteId, frame.selectedTarget.beamId),
    recentCommit: cloneCommitReceipt(frame.recentCommit),
  };
  validateHandoverDecisionFrame(cloned);
  return Object.freeze(cloned);
}

export const createHandoverDecisionFrame = freezeHandoverDecisionFrame;
