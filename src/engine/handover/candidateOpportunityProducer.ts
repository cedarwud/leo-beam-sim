import {
  candidateLinkKeyString,
  compareCandidateLinkKey,
  createCandidateGateResult,
  createMetricEvidence,
  freezeCandidateOpportunity,
  type CandidateGateResult,
  type CandidateLinkKey,
  type CandidateOpportunity,
  type MetricEvidence,
} from './candidateDecisionContract';

/**
 * Scientific input for one measured satellite-beam pair.
 *
 * The producer accepts measurements rather than scene objects so it can be
 * reused by the Walker adapter without importing React, Three.js, or display
 * budgets. Every metric must identify the same primary UE source frame.
 */
export interface CandidateLinkMeasurement {
  readonly key: CandidateLinkKey;
  readonly primaryUeId: string;
  readonly sourceFrameId: string;
  readonly beamIdentitySource: CandidateOpportunity['beamIdentitySource'];
  readonly sinrMeasurementContext?: CandidateOpportunity['sinrMeasurementContext'];
  readonly elevation: MetricEvidence;
  readonly steering: MetricEvidence;
  readonly range: MetricEvidence;
  readonly sinr: MetricEvidence;
  readonly predictedThroughput: MetricEvidence;
  readonly remainingServiceTime: MetricEvidence;
  readonly scheduledIllumination: CandidateGateResult;
}

export interface CandidateOpportunityThresholds {
  readonly minimumElevationDeg: number;
  readonly maximumSteeringDeg: number;
  readonly minimumSinrDb: number;
  readonly minimumThroughputBps: number | null;
  readonly minimumRemainingServiceTimeSec: number | null;
}

export interface CandidateOpportunityStageCounts {
  readonly observed: number;
  readonly geometricallyReachable: number;
  readonly steeringValid: number;
  readonly scheduledAndIlluminated: number;
  readonly serviceEligible: number;
}

export interface CandidateOpportunitySet {
  readonly primaryUeId: string;
  readonly sourceFrameId: string;
  readonly opportunities: readonly CandidateOpportunity[];
  readonly counts: CandidateOpportunityStageCounts;
}

export interface ProduceCandidateOpportunitySetInput {
  readonly primaryUeId: string;
  readonly sourceFrameId: string;
  readonly thresholds: CandidateOpportunityThresholds;
  readonly measurements: readonly CandidateLinkMeasurement[];
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite`);
}

function assertThresholds(thresholds: CandidateOpportunityThresholds): void {
  assertFinite(thresholds.minimumElevationDeg, 'minimumElevationDeg');
  assertFinite(thresholds.maximumSteeringDeg, 'maximumSteeringDeg');
  assertFinite(thresholds.minimumSinrDb, 'minimumSinrDb');
  if (thresholds.minimumThroughputBps !== null) {
    assertFinite(thresholds.minimumThroughputBps, 'minimumThroughputBps');
  }
  if (thresholds.minimumRemainingServiceTimeSec !== null) {
    assertFinite(thresholds.minimumRemainingServiceTimeSec, 'minimumRemainingServiceTimeSec');
  }
  if (thresholds.maximumSteeringDeg < 0) throw new Error('maximumSteeringDeg must be non-negative');
  if (thresholds.minimumThroughputBps !== null && thresholds.minimumThroughputBps < 0) {
    throw new Error('minimumThroughputBps must be non-negative');
  }
  if (thresholds.minimumRemainingServiceTimeSec !== null && thresholds.minimumRemainingServiceTimeSec < 0) {
    throw new Error('minimumRemainingServiceTimeSec must be non-negative');
  }
}

function metricGate(
  code: Exclude<CandidateGateResult['code'], 'scheduled-illumination' | 'ee-advantage'>,
  evidence: MetricEvidence,
  threshold: number | null,
  passes: (value: number, threshold: number) => boolean,
): CandidateGateResult {
  if (threshold === null) {
    return createCandidateGateResult({
      code,
      category: 'hard-qos',
      result: 'unavailable',
      measured: evidence.status === 'available' ? evidence.value : null,
      threshold: null,
      unit: evidence.unit,
      reason: `${code} threshold has not been frozen`,
    });
  }
  if (evidence.status !== 'available' || evidence.value === null) {
    return createCandidateGateResult({
      code,
      category: 'hard-qos',
      result: 'unavailable',
      measured: null,
      threshold,
      unit: evidence.unit,
      reason: evidence.reason ?? `${code} evidence is unavailable`,
    });
  }
  const pass = passes(evidence.value, threshold);
  return createCandidateGateResult({
    code,
    category: 'hard-qos',
    result: pass ? 'pass' : 'fail',
    measured: evidence.value,
    threshold,
    unit: evidence.unit,
    reason: pass ? null : `${code} does not meet the configured threshold`,
  });
}

function copyMeasurementEvidence(
  measurement: CandidateLinkMeasurement,
  expectedPrimaryUeId: string,
  expectedSourceFrameId: string,
): CandidateLinkMeasurement {
  if (measurement.primaryUeId !== expectedPrimaryUeId) {
    throw new Error(`candidate ${candidateLinkKeyString(measurement.key)} belongs to a different primary UE`);
  }
  if (measurement.sourceFrameId !== expectedSourceFrameId) {
    throw new Error(`candidate ${candidateLinkKeyString(measurement.key)} belongs to a different source frame`);
  }
  const normalizeMetric = (metric: MetricEvidence, name: string): MetricEvidence => {
    createMetricEvidence(metric);
    if (metric.sourceFrameId !== null && metric.sourceFrameId !== expectedSourceFrameId) {
      throw new Error(`candidate ${candidateLinkKeyString(measurement.key)} has mixed-frame ${name} evidence`);
    }
    return createMetricEvidence({
      ...metric,
      sourceFrameId: expectedSourceFrameId,
    });
  };
  if (measurement.scheduledIllumination.code !== 'scheduled-illumination') {
    throw new Error('scheduledIllumination must use the scheduled-illumination gate code');
  }
  if (
    measurement.scheduledIllumination.result !== 'unavailable'
    && measurement.scheduledIllumination.measured !== 0
    && measurement.scheduledIllumination.measured !== 1
  ) {
    throw new Error('scheduledIllumination measured value must be 0 or 1');
  }
  createCandidateGateResult(measurement.scheduledIllumination);
  return {
    ...measurement,
    elevation: normalizeMetric(measurement.elevation, 'elevation'),
    steering: normalizeMetric(measurement.steering, 'steering'),
    range: normalizeMetric(measurement.range, 'range'),
    sinr: normalizeMetric(measurement.sinr, 'sinr'),
    predictedThroughput: normalizeMetric(measurement.predictedThroughput, 'predicted-throughput'),
    remainingServiceTime: normalizeMetric(measurement.remainingServiceTime, 'remaining-service-time'),
  };
}

function latestGeometryClass(gates: readonly CandidateGateResult[]): CandidateOpportunity['geometryClass'] {
  const byCode = new Map(gates.map(gate => [gate.code, gate]));
  const elevationPasses = byCode.get('elevation')?.result === 'pass';
  const steeringPasses = elevationPasses && byCode.get('steering')?.result === 'pass';
  const scheduledPasses = steeringPasses && byCode.get('scheduled-illumination')?.result === 'pass';
  const hardGateCodes: readonly CandidateGateResult['code'][] = [
    'elevation',
    'steering',
    'scheduled-illumination',
    'sinr',
    'throughput',
    'remaining-service-time',
  ];
  const serviceEligible = hardGateCodes.every(code => byCode.get(code)?.result === 'pass');
  if (serviceEligible) return 'service-eligible';
  if (scheduledPasses) return 'scheduled-and-illuminated';
  if (steeringPasses) return 'steering-valid';
  return 'geometrically-reachable';
}

function produceOpportunity(
  measurementInput: CandidateLinkMeasurement,
  input: ProduceCandidateOpportunitySetInput,
): CandidateOpportunity {
  const measurement = copyMeasurementEvidence(
    measurementInput,
    input.primaryUeId,
    input.sourceFrameId,
  );
  const thresholds = input.thresholds;
  const gates: readonly CandidateGateResult[] = [
    metricGate('elevation', measurement.elevation, thresholds.minimumElevationDeg, (value, threshold) => value >= threshold),
    metricGate('steering', measurement.steering, thresholds.maximumSteeringDeg, (value, threshold) => value <= threshold),
    createCandidateGateResult(measurement.scheduledIllumination),
    metricGate('sinr', measurement.sinr, thresholds.minimumSinrDb, (value, threshold) => value >= threshold),
    metricGate('throughput', measurement.predictedThroughput, thresholds.minimumThroughputBps, (value, threshold) => value >= threshold),
    metricGate(
      'remaining-service-time',
      measurement.remainingServiceTime,
      thresholds.minimumRemainingServiceTimeSec,
      (value, threshold) => value >= threshold,
    ),
    createCandidateGateResult({
      code: 'ee-advantage',
      category: 'decision-trigger',
      result: 'unavailable',
      measured: null,
      threshold: null,
      unit: null,
      reason: 'forecast-EE policy activation gate has not passed',
    }),
  ];
  return freezeCandidateOpportunity({
    key: measurement.key,
    primaryUeId: measurement.primaryUeId,
    sourceFrameId: measurement.sourceFrameId,
    beamIdentitySource: measurement.beamIdentitySource,
    sinrMeasurementContext: measurement.sinrMeasurementContext,
    geometryClass: latestGeometryClass(gates),
    elevation: measurement.elevation,
    steering: measurement.steering,
    range: measurement.range,
    sinr: measurement.sinr,
    predictedThroughput: measurement.predictedThroughput,
    remainingServiceTime: measurement.remainingServiceTime,
    forecastEe: null,
    gates,
  });
}

function stageCounts(opportunities: readonly CandidateOpportunity[]): CandidateOpportunityStageCounts {
  const stageValue: Readonly<Record<CandidateOpportunity['geometryClass'], number>> = {
    'geometrically-reachable': 0,
    'steering-valid': 1,
    'scheduled-and-illuminated': 2,
    'service-eligible': 3,
  };
  const atLeast = (minimum: CandidateOpportunity['geometryClass']) => opportunities.filter(
    opportunity => stageValue[opportunity.geometryClass] >= stageValue[minimum],
  ).length;
  return Object.freeze({
    observed: opportunities.length,
    geometricallyReachable: opportunities.length,
    steeringValid: atLeast('steering-valid'),
    scheduledAndIlluminated: atLeast('scheduled-and-illuminated'),
    serviceEligible: atLeast('service-eligible'),
  });
}

/**
 * Preserve the complete scientific candidate set. This function performs no
 * ranking, TTT accumulation, display truncation, or colour assignment.
 */
export function produceCandidateOpportunitySet(
  input: ProduceCandidateOpportunitySetInput,
): CandidateOpportunitySet {
  if (input.primaryUeId.trim().length === 0) throw new Error('primaryUeId must be non-empty');
  if (input.sourceFrameId.trim().length === 0) throw new Error('sourceFrameId must be non-empty');
  assertThresholds(input.thresholds);
  const seen = new Set<string>();
  const opportunities = input.measurements.map(measurement => {
    const key = candidateLinkKeyString(measurement.key);
    if (seen.has(key)) throw new Error(`duplicate candidate measurement ${key}`);
    seen.add(key);
    return produceOpportunity(measurement, input);
  }).sort((left, right) => compareCandidateLinkKey(left.key, right.key));
  return Object.freeze({
    primaryUeId: input.primaryUeId,
    sourceFrameId: input.sourceFrameId,
    opportunities: Object.freeze(opportunities),
    counts: stageCounts(opportunities),
  });
}

export interface LegacySinrOffsetSelectionInput {
  readonly serving: CandidateLinkKey;
  readonly opportunities: readonly CandidateOpportunity[];
  readonly offsetDb: number;
}

/**
 * Migration-only parity projection for the existing inter-satellite manager.
 * It is not the future multi-candidate decision engine and owns no timer.
 */
export function selectLegacyInterSinrOffsetTarget(
  input: LegacySinrOffsetSelectionInput,
): CandidateLinkKey | null {
  assertFinite(input.offsetDb, 'offsetDb');
  const serving = input.opportunities.find(
    opportunity => candidateLinkKeyString(opportunity.key) === candidateLinkKeyString(input.serving),
  );
  const servingSinr = serving?.sinr.status === 'available' ? serving.sinr.value : null;
  if (servingSinr === null) return null;
  const candidates = input.opportunities.filter(opportunity => {
    if (opportunity.key.satelliteId === input.serving.satelliteId) return false;
    if (opportunity.sinr.status !== 'available' || opportunity.sinr.value === null) return false;
    const scheduled = opportunity.gates.find(gate => gate.code === 'scheduled-illumination');
    return scheduled?.result === 'pass' && opportunity.sinr.value - input.offsetDb > servingSinr;
  });
  candidates.sort((left, right) => {
    const bySinr = (right.sinr.value ?? -Infinity) - (left.sinr.value ?? -Infinity);
    return bySinr !== 0 ? bySinr : compareCandidateLinkKey(left.key, right.key);
  });
  return candidates[0]?.key ?? null;
}
