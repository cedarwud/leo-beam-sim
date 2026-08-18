import type {
  AcceptedEvidenceIdentity,
  AcceptedEvidenceView,
  CanonicalParameterDraft,
  FrameOptionsDraftView,
  PresentationView,
} from '../session/visualLabSession';

/**
 * Read-only controlled comparison seam for the Visual Lab.
 *
 * This module never calls a simulator/evaluator.  It compares two immutable
 * accepted projections and reports which identity gates are matched.  A
 * matched frame can therefore be inspected even when the complete-run
 * evaluation interval is not available yet.
 */
export const VISUAL_LAB_COMPARISON_SCHEMA = 'visual-lab-comparison-v1' as const;

export type ComparisonGateStatus = 'matched' | 'mismatch' | 'unavailable';

export interface ComparisonGate {
  readonly status: ComparisonGateStatus;
  readonly baseline: string | number | boolean | null;
  readonly candidate: string | number | boolean | null;
  readonly detail: string;
}

export interface ComparisonGates {
  readonly constellation: ComparisonGate;
  readonly instantUtc: ComparisonGate;
  readonly tleFrame: ComparisonGate;
  readonly sourceArchive: ComparisonGate;
  readonly linkIdentity: ComparisonGate;
  readonly geometry: ComparisonGate;
  readonly frameOptions: ComparisonGate;
  readonly contract: ComparisonGate;
  readonly evaluationInterval: ComparisonGate;
}

export type ComparisonClassification = 'identical' | 'causal' | 'exploratory';

export interface ComparisonMetricDelta {
  readonly baseline: number | null;
  readonly candidate: number | null;
  readonly delta: number | null;
}

export interface ComparisonBooleanDelta {
  readonly baseline: boolean | null;
  readonly candidate: boolean | null;
  readonly changed: boolean | null;
}

export interface ComparisonStateDelta {
  readonly baseline: string | null;
  readonly candidate: string | null;
  readonly changed: boolean | null;
}

export interface ComparisonEvidence {
  readonly identity: AcceptedEvidenceIdentity;
  readonly frameId: string;
  readonly canonical: AcceptedEvidenceView['canonical'];
  readonly parameters: CanonicalParameterDraft;
  readonly frameOptions: FrameOptionsDraftView;
  readonly presentation: PresentationView;
  /** Homepage session evaluation at the accepted frame; may be a prefix. */
  readonly frameEvaluation: AcceptedEvidenceView['canonical']['evaluation'];
  /** Complete accepted-run evaluation, when a full run has been published. */
  readonly runEvaluation: {
    readonly deliveredBits: number;
    readonly consumedEnergyJ: number;
    readonly energyEfficiencyBitsPerJ: number;
    readonly durationSec: number;
  } | null;
  readonly interval: {
    readonly analysisRunId: string | null;
    readonly geometryRunId: string | null;
    readonly durationSec: number | null;
    readonly stepSec: number | null;
    readonly anchorCount: number | null;
  };
}

export interface ComparisonDeltas {
  readonly deliveredBits: ComparisonMetricDelta;
  readonly consumedJoules: ComparisonMetricDelta;
  readonly instantaneousEeBitsPerJ: ComparisonMetricDelta;
  readonly cumulativeEeBitsPerJ: ComparisonMetricDelta;
  readonly evaluationEeBitsPerJ: ComparisonMetricDelta;
  readonly servingThroughputBps: ComparisonMetricDelta;
  readonly totalThroughputBps: ComparisonMetricDelta;
  readonly systemPowerW: ComparisonMetricDelta;
  readonly serviceState: ComparisonStateDelta;
  readonly service: ComparisonBooleanDelta;
  readonly qos: ComparisonBooleanDelta;
}

export interface ComparisonView {
  readonly schemaVersion: typeof VISUAL_LAB_COMPARISON_SCHEMA;
  readonly availability: 'available' | 'unavailable';
  readonly reason: string | null;
  readonly baseline: ComparisonEvidence | null;
  readonly candidate: ComparisonEvidence | null;
  readonly gates: ComparisonGates;
  readonly changedParameterKeys: readonly string[];
  readonly classification: ComparisonClassification | null;
  readonly frame: {
    readonly availability: 'available' | 'unavailable';
    readonly reason: string | null;
    readonly deltas: ComparisonDeltas;
  };
  readonly evaluation: {
    readonly availability: 'available' | 'unavailable';
    readonly reason: string | null;
    readonly deltas: Pick<ComparisonDeltas, 'deliveredBits' | 'consumedJoules' | 'evaluationEeBitsPerJ'>;
  };
}

export type ComparisonEvidenceSource = {
  readonly accepted: AcceptedEvidenceView;
  readonly parameters: CanonicalParameterDraft;
  readonly frameOptions: FrameOptionsDraftView;
  readonly presentation: PresentationView;
  readonly runEvaluation: ComparisonEvidence['runEvaluation'];
};

function freeze<T>(value: T): T {
  return Object.freeze(value);
}

function gate(
  baseline: string | number | boolean | null,
  candidate: string | number | boolean | null,
  detail: string,
  available = true,
): ComparisonGate {
  if (!available) return freeze({ status: 'unavailable', baseline, candidate, detail });
  return freeze({
    status: baseline === candidate ? 'matched' : 'mismatch',
    baseline,
    candidate,
    detail,
  });
}

function frameOptionsSignature(options: FrameOptionsDraftView): string {
  return JSON.stringify({
    representativeUserIndex: options.representativeUserIndex,
    userPositionOverridesKm: options.userPositionOverridesKm.map(override => ({
      userIndex: override.userIndex,
      positionKm: [override.positionKm[0], override.positionKm[1]],
    })),
  });
}

function linkIdentitySignature(evidence: ComparisonEvidence): string {
  const canonical = evidence.canonical;
  return JSON.stringify({
    serving: {
      satelliteId: canonical.serving.satelliteId,
      beamId: canonical.serving.beamId,
      userId: canonical.serving.userId,
    },
    candidate: {
      satelliteId: canonical.candidate.satelliteId,
      beamId: canonical.candidate.beamId,
      userId: canonical.candidate.userId,
    },
  });
}

function geometrySignature(evidence: ComparisonEvidence): string | null {
  const geometryRunId = evidence.identity.geometryRunId;
  if (geometryRunId === null) return null;
  return JSON.stringify({ geometryRunId, frameOptions: frameOptionsSignature(evidence.frameOptions) });
}

function intervalSignature(evidence: ComparisonEvidence): string | null {
  if (evidence.runEvaluation === null) return null;
  const { interval } = evidence;
  if (
    interval.analysisRunId === null
    || interval.geometryRunId === null
    || interval.durationSec === null
    || interval.stepSec === null
    || interval.anchorCount === null
  ) return null;
  return JSON.stringify(interval);
}

function metric(baseline: number | null, candidate: number | null): ComparisonMetricDelta {
  return freeze({
    baseline,
    candidate,
    delta: baseline === null || candidate === null ? null : candidate - baseline,
  });
}

function booleanMetric(baseline: boolean | null, candidate: boolean | null): ComparisonBooleanDelta {
  return freeze({
    baseline,
    candidate,
    changed: baseline === null || candidate === null ? null : baseline !== candidate,
  });
}

function stateMetric(baseline: string | null, candidate: string | null): ComparisonStateDelta {
  return freeze({
    baseline,
    candidate,
    changed: baseline === null || candidate === null ? null : baseline !== candidate,
  });
}

function valuesEqual(left: number, right: number): boolean {
  return Object.is(left, right);
}

function changedParameterKeys(
  baseline: CanonicalParameterDraft,
  candidate: CanonicalParameterDraft,
): readonly string[] {
  return Object.freeze(Object.keys(baseline).filter(key => {
    const left = baseline[key as keyof CanonicalParameterDraft];
    const right = candidate[key as keyof CanonicalParameterDraft];
    return typeof left === 'number' && typeof right === 'number'
      ? !valuesEqual(left, right)
      : left !== right;
  }));
}

function unavailableGates(reason: string): ComparisonGates {
  const missing = gate(null, null, reason, false);
  return freeze({
    constellation: missing,
    instantUtc: missing,
    tleFrame: missing,
    sourceArchive: missing,
    linkIdentity: missing,
    geometry: missing,
    frameOptions: missing,
    contract: missing,
    evaluationInterval: missing,
  });
}

function emptyDeltas(): ComparisonDeltas {
  const empty = metric(null, null);
  const emptyBoolean = booleanMetric(null, null);
  const emptyState = stateMetric(null, null);
  return freeze({
    deliveredBits: empty,
    consumedJoules: empty,
    instantaneousEeBitsPerJ: empty,
    cumulativeEeBitsPerJ: empty,
    evaluationEeBitsPerJ: empty,
    servingThroughputBps: empty,
    totalThroughputBps: empty,
    systemPowerW: empty,
    serviceState: emptyState,
    service: emptyBoolean,
    qos: emptyBoolean,
  });
}

function unavailableView(reason: string): ComparisonView {
  return freeze({
    schemaVersion: VISUAL_LAB_COMPARISON_SCHEMA,
    availability: 'unavailable',
    reason,
    baseline: null,
    candidate: null,
    gates: unavailableGates(reason),
    changedParameterKeys: Object.freeze([]),
    classification: null,
    frame: freeze({ availability: 'unavailable', reason, deltas: emptyDeltas() }),
    evaluation: freeze({
      availability: 'unavailable',
      reason,
      deltas: freeze({
        deliveredBits: metric(null, null),
        consumedJoules: metric(null, null),
        evaluationEeBitsPerJ: metric(null, null),
      }),
    }),
  });
}

function collectDeltas(baseline: ComparisonEvidence, candidate: ComparisonEvidence): ComparisonDeltas {
  const b = baseline.canonical;
  const c = candidate.canonical;
  const serviceBaseline = b.serving.availability === 'available' && b.serving.satelliteId !== null;
  const serviceCandidate = c.serving.availability === 'available' && c.serving.satelliteId !== null;
  return freeze({
    deliveredBits: metric(b.evaluation.deliveredBits, c.evaluation.deliveredBits),
    consumedJoules: metric(b.evaluation.consumedEnergyJ, c.evaluation.consumedEnergyJ),
    instantaneousEeBitsPerJ: metric(b.ee.instantaneousBitsPerJ, c.ee.instantaneousBitsPerJ),
    cumulativeEeBitsPerJ: metric(b.ee.cumulativeBitsPerJ, c.ee.cumulativeBitsPerJ),
    evaluationEeBitsPerJ: metric(
      baseline.runEvaluation?.energyEfficiencyBitsPerJ ?? null,
      candidate.runEvaluation?.energyEfficiencyBitsPerJ ?? null,
    ),
    servingThroughputBps: metric(b.throughput.servingRateBps, c.throughput.servingRateBps),
    totalThroughputBps: metric(b.throughput.totalRateBps, c.throughput.totalRateBps),
    systemPowerW: metric(b.power.systemPowerW, c.power.systemPowerW),
    serviceState: stateMetric(
      serviceBaseline ? 'available' : 'unavailable',
      serviceCandidate ? 'available' : 'unavailable',
    ),
    service: booleanMetric(serviceBaseline, serviceCandidate),
    qos: booleanMetric(b.serving.qosMet ?? null, c.serving.qosMet ?? null),
  });
}

export function captureComparisonEvidence(source: ComparisonEvidenceSource): ComparisonEvidence {
  const { accepted } = source;
  const interval = accepted.timeline === null
    ? {
      analysisRunId: null,
      geometryRunId: null,
      durationSec: null,
      stepSec: null,
      anchorCount: null,
    }
    : {
      analysisRunId: accepted.timeline.analysisRunId,
      geometryRunId: accepted.timeline.geometryRunId,
      durationSec: accepted.timeline.durationSec,
      stepSec: accepted.timeline.stepSec,
      anchorCount: accepted.timeline.anchorCount,
    };
  return freeze({
    identity: accepted.identity,
    frameId: accepted.frameId,
    canonical: accepted.canonical,
    parameters: source.parameters,
    frameOptions: source.frameOptions,
    presentation: source.presentation,
    frameEvaluation: accepted.canonical.evaluation,
    runEvaluation: source.runEvaluation,
    interval,
  });
}

export function buildComparisonView(
  baseline: ComparisonEvidence | null,
  candidate: ComparisonEvidence | null,
): ComparisonView {
  if (baseline === null) return unavailableView('no baseline A has been registered');
  if (candidate === null) {
    return freeze({
      ...unavailableView('no accepted candidate B is available'),
      baseline,
    });
  }

  const baselineIdentity = baseline.identity;
  const candidateIdentity = candidate.identity;
  const gates = freeze({
    constellation: gate(baselineIdentity.constellation, candidateIdentity.constellation, 'archived constellation'),
    instantUtc: gate(baselineIdentity.instantUtc, candidateIdentity.instantUtc, 'accepted instant'),
    tleFrame: gate(baselineIdentity.tleFrameId, candidateIdentity.tleFrameId, 'TLE frame identity'),
    sourceArchive: gate(
      `${baselineIdentity.archiveId}/${baselineIdentity.archiveDate}/${baselineIdentity.selectedTlePath}`,
      `${candidateIdentity.archiveId}/${candidateIdentity.archiveDate}/${candidateIdentity.selectedTlePath}`,
      'archived TLE source',
    ),
    linkIdentity: gate(linkIdentitySignature(baseline), linkIdentitySignature(candidate), 'serving/candidate link identities'),
    geometry: gate(geometrySignature(baseline), geometrySignature(candidate), 'accepted geometry run and frame options', geometrySignature(baseline) !== null && geometrySignature(candidate) !== null),
    frameOptions: gate(frameOptionsSignature(baseline.frameOptions), frameOptionsSignature(candidate.frameOptions), 'bounded scenario geometry options'),
    contract: gate(baselineIdentity.contractVersion, candidateIdentity.contractVersion, 'canonical contract version'),
    evaluationInterval: gate(intervalSignature(baseline), intervalSignature(candidate), 'complete accepted evaluation interval', intervalSignature(baseline) !== null && intervalSignature(candidate) !== null),
  });

  const changed = changedParameterKeys(baseline.parameters, candidate.parameters);
  const allFrameGates = [
    gates.constellation,
    gates.instantUtc,
    gates.tleFrame,
    gates.sourceArchive,
    gates.linkIdentity,
    gates.geometry,
    gates.frameOptions,
    gates.contract,
  ];
  const frameGateMismatch = allFrameGates.some(item => item.status === 'mismatch');
  const frameGateUnavailable = allFrameGates.some(item => item.status === 'unavailable');
  const frameAvailable = !frameGateMismatch && !frameGateUnavailable;
  const classification = changed.length === 0
    ? 'identical' as const
    : changed.length === 1
      ? 'causal' as const
      : 'exploratory' as const;
  const deltas = collectDeltas(baseline, candidate);
  const evaluationAvailable = frameAvailable && gates.evaluationInterval.status === 'matched';

  return freeze({
    schemaVersion: VISUAL_LAB_COMPARISON_SCHEMA,
    availability: frameAvailable ? 'available' : 'unavailable',
    reason: frameAvailable
      ? null
      : frameGateMismatch
        ? 'matched frame identity gates failed; comparison is withheld'
        : 'matched frame identity is not available for this accepted pair',
    baseline,
    candidate,
    gates,
    changedParameterKeys: changed,
    classification,
    frame: freeze({
      availability: frameAvailable ? 'available' : 'unavailable',
      reason: frameAvailable ? null : 'frame-level identity gates are not all matched',
      deltas,
    }),
    evaluation: freeze({
      availability: evaluationAvailable ? 'available' : 'unavailable',
      reason: evaluationAvailable
        ? null
        : 'complete accepted evaluation identity or interval is unavailable; frame deltas remain inspectable',
      deltas: freeze({
        deliveredBits: deltas.deliveredBits,
        consumedJoules: deltas.consumedJoules,
        evaluationEeBitsPerJ: deltas.evaluationEeBitsPerJ,
      }),
    }),
  });
}
