/**
 * Immutable handover decision trace for a completed archived-TLE run.
 *
 * This module is deliberately independent from React, the historical Walker
 * handover manager, and the TLE materializer.  The caller first supplies one
 * same-instant canonical comparison sample per anchor; this module then runs
 * the small, deterministic offset/TTT state machine over that materialized
 * sequence.  Keeping the two passes separate prevents the decision trace from
 * becoming a display-only overlay or from accidentally counting pass-plan
 * changes as handovers.
 */

export const CANONICAL_TLE_HANDOVER_OFFSET_DB = 3 as const;
export const CANONICAL_TLE_HANDOVER_TTT_SEC = 30 as const;
export const CANONICAL_TLE_HANDOVER_ANCHOR_STEP_SEC = 30 as const;

export type CanonicalTleHandoverState =
  | 'attached'
  | 'monitoring'
  | 'pending'
  | 'handover'
  | 'forced-continuity';

export type CanonicalTleHandoverEvent =
  | 'none'
  | 'initial-attach'
  | 'inter-handover'
  | 'forced-continuity';

export interface CanonicalTleHandoverPolicy {
  readonly offsetDb: number;
  readonly tttSec: number;
  /** Decision resolution.  The first implementation is fixed at 30 seconds. */
  readonly anchorStepSec: number;
}

export const DEFAULT_CANONICAL_TLE_HANDOVER_POLICY: Readonly<CanonicalTleHandoverPolicy> = Object.freeze({
  offsetDb: CANONICAL_TLE_HANDOVER_OFFSET_DB,
  tttSec: CANONICAL_TLE_HANDOVER_TTT_SEC,
  anchorStepSec: CANONICAL_TLE_HANDOVER_ANCHOR_STEP_SEC,
});

/** A same-instant pair materialized from the completed TLE run. */
export interface CanonicalTleHandoverComparisonSample {
  readonly anchorIndex: number;
  readonly instantUtc: string;
  readonly servingSatelliteId: string;
  readonly candidateSatelliteId: string | null;
  readonly servingVisible: boolean;
  readonly candidateVisible: boolean;
  readonly servingSinrDb: number | null;
  readonly candidateSinrDb: number | null;
}

export interface CanonicalTleHandoverAnchorTrace {
  readonly anchorIndex: number;
  readonly instantUtc: string;
  readonly offsetDb: number;
  readonly tttSec: number;
  readonly progressSec: number;
  readonly ratio: number;
  readonly cumulativeCount: number;
  readonly state: CanonicalTleHandoverState;
  readonly event: CanonicalTleHandoverEvent;
  readonly reason: string;
  readonly servingSatelliteId: string;
  readonly candidateSatelliteId: string | null;
  readonly servingVisible: boolean;
  readonly candidateVisible: boolean;
  readonly servingSinrDb: number | null;
  readonly candidateSinrDb: number | null;
  readonly deltaDb: number | null;
  /** The serving identity before an event, when the anchor commits one. */
  readonly eventFromSatelliteId: string | null;
  /** The serving identity after an event, when the anchor commits one. */
  readonly eventToSatelliteId: string | null;
}

export interface CanonicalTleHandoverTargetSelection {
  readonly selectionKind: 'pass-plan';
  readonly passId: string;
  readonly satelliteId: string;
  readonly sourceLocator: string;
}

export interface CanonicalTleHandoverQualificationAnchor {
  readonly anchorIndex: number;
  readonly instantUtc: string;
  readonly servingSatelliteId: string;
  readonly candidateSatelliteId: string;
  readonly deltaDb: number;
  readonly progressSec: number;
  readonly conditionMet: true;
}

interface CanonicalTleServingChangeEvidenceBase {
  readonly eventId: string;
  readonly analysisRunId: string;
  readonly geometryRunId: string;
  readonly traceDigest: string;
  readonly sourceEvent: 'inter-handover' | 'forced-continuity';
  readonly fromSatelliteId: string;
  readonly toSatelliteId: string;
  readonly targetSelection: CanonicalTleHandoverTargetSelection;
  readonly triggerAnchorIndex: number;
  readonly triggerInstantUtc: string;
  readonly preCommit: {
    readonly servingSatelliteId: string;
    readonly candidateSatelliteId: string;
    readonly servingVisible: boolean;
    readonly candidateVisible: boolean;
    readonly servingSinrDb: number | null;
    readonly candidateSinrDb: number | null;
    readonly deltaDb: number | null;
  };
  readonly postCommit: {
    readonly servingSatelliteId: string;
    readonly anchorIndex: number;
    readonly instantUtc: string;
  };
  readonly reason: string;
}

export type CanonicalTleServingChangeEvidence =
  | (CanonicalTleServingChangeEvidenceBase & {
      readonly sourceEvent: 'inter-handover';
      readonly decision: {
        readonly offsetDb: number;
        readonly tttSec: number;
      };
      readonly qualificationAnchors: readonly CanonicalTleHandoverQualificationAnchor[];
    })
  | (CanonicalTleServingChangeEvidenceBase & {
      readonly sourceEvent: 'forced-continuity';
      readonly qualificationAnchors: readonly [];
      readonly continuity: {
        readonly servingVisible: false;
        readonly targetVisible: true;
        readonly targetSatelliteId: string;
        readonly reasonCode: 'serving-lost-visibility';
        readonly reason: string;
      };
    });

export interface CanonicalTleHandoverTrace {
  readonly analysisRunId: string;
  readonly geometryRunId: string;
  readonly traceDigest: string;
  readonly policy: CanonicalTleHandoverPolicy;
  readonly anchorCount: number;
  readonly anchors: readonly CanonicalTleHandoverAnchorTrace[];
  /** Pass-plan-backed events only; display fallbacks remain unavailable. */
  readonly servingChangeEvents: readonly CanonicalTleServingChangeEvidence[];
}

export interface CanonicalTleHandoverTraceInput {
  readonly analysisRunId: string;
  readonly geometryRunId: string;
  readonly anchorCount: number;
  readonly policy?: CanonicalTleHandoverPolicy;
  /** The pass-plan identity is a target hint, never a handover event. */
  readonly plannedServingSatelliteId: (anchorIndex: number) => string | null;
  /** Materialize the current serving/candidate comparison at one anchor. */
  readonly resolveComparison: (
    anchorIndex: number,
    activeServingSatelliteId: string,
  ) => CanonicalTleHandoverComparisonSample;
  /** Resolve only a real pass-plan target; return null for display fallback. */
  readonly resolveTargetSelection: (
    anchorIndex: number,
    targetSatelliteId: string,
  ) => CanonicalTleHandoverTargetSelection | null;
}

function freeze<T>(value: T): T {
  return Object.freeze(value);
}

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite`);
  return value;
}

function nonEmpty(value: string, label: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${label} must not be empty`);
  return value;
}

function canonicalJson(value: unknown): string {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('handover trace digest cannot include a non-finite number');
    // V8 in Node and Chromium can differ below the scientifically meaningful
    // precision after otherwise identical trigonometric chains.  The trace
    // digest binds decision evidence, not platform-specific last-bit noise.
    const normalized = Object.is(value, -0) ? 0 : Number(value.toPrecision(9));
    return JSON.stringify(normalized);
  }
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .filter(key => record[key] !== undefined)
    .map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(',')}}`;
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function servingChangeEventId(
  analysisRunId: string,
  sourceEvent: 'inter-handover' | 'forced-continuity',
  triggerAnchorIndex: number,
  fromSatelliteId: string,
  toSatelliteId: string,
): string {
  return `tle-event-v1-${stableHash(canonicalJson({
    analysisRunId,
    sourceEvent,
    triggerAnchorIndex,
    fromSatelliteId,
    toSatelliteId,
  }))}`;
}

function preCommitEvidence(sample: CanonicalTleHandoverComparisonSample): CanonicalTleServingChangeEvidenceBase['preCommit'] {
  if (sample.candidateSatelliteId === null) {
    throw new Error(`handover event at anchor ${sample.anchorIndex} has no candidate identity`);
  }
  return {
    servingSatelliteId: sample.servingSatelliteId,
    candidateSatelliteId: sample.candidateSatelliteId,
    servingVisible: sample.servingVisible,
    candidateVisible: sample.candidateVisible,
    servingSinrDb: sample.servingSinrDb,
    candidateSinrDb: sample.candidateSinrDb,
    deltaDb: sample.servingSinrDb === null || sample.candidateSinrDb === null
      ? null
      : sample.candidateSinrDb - sample.servingSinrDb,
  };
}

function validatedTargetSelection(
  input: CanonicalTleHandoverTraceInput,
  anchorIndex: number,
  targetSatelliteId: string,
): CanonicalTleHandoverTargetSelection | null {
  const selection = input.resolveTargetSelection(anchorIndex, targetSatelliteId);
  if (selection === null) return null;
  if (selection.selectionKind !== 'pass-plan' || selection.satelliteId !== targetSatelliteId) {
    throw new Error(`handover target selection mismatch at anchor ${anchorIndex}`);
  }
  nonEmpty(selection.passId, 'handover target passId');
  nonEmpty(selection.sourceLocator, 'handover target sourceLocator');
  return selection;
}

function validatePolicy(rawPolicy: CanonicalTleHandoverPolicy | undefined): CanonicalTleHandoverPolicy {
  const policy = rawPolicy ?? DEFAULT_CANONICAL_TLE_HANDOVER_POLICY;
  const offsetDb = finite(policy.offsetDb, 'handover offsetDb');
  const tttSec = finite(policy.tttSec, 'handover tttSec');
  const anchorStepSec = finite(policy.anchorStepSec, 'handover anchorStepSec');
  if (offsetDb < 0) throw new RangeError('handover offsetDb must be non-negative');
  if (tttSec <= 0) throw new RangeError('handover tttSec must be positive');
  if (anchorStepSec <= 0) throw new RangeError('handover anchorStepSec must be positive');
  if (tttSec < anchorStepSec || tttSec % anchorStepSec !== 0) {
    throw new RangeError('handover tttSec must be an integer number of decision anchors');
  }
  return freeze({ offsetDb, tttSec, anchorStepSec });
}

function validateSample(sample: CanonicalTleHandoverComparisonSample, anchorIndex: number): void {
  if (sample.anchorIndex !== anchorIndex) {
    throw new Error(`handover comparison sample anchor mismatch at ${anchorIndex}`);
  }
  if (typeof sample.instantUtc !== 'string' || sample.instantUtc.length === 0) {
    throw new Error(`handover comparison sample ${anchorIndex} has no UTC instant`);
  }
  if (typeof sample.servingSatelliteId !== 'string' || sample.servingSatelliteId.length === 0) {
    throw new Error(`handover comparison sample ${anchorIndex} has no serving TLE identity`);
  }
  if (sample.candidateSatelliteId === sample.servingSatelliteId) {
    throw new Error(`handover comparison sample ${anchorIndex} reuses serving identity as candidate`);
  }
  if (sample.candidateVisible && sample.candidateSatelliteId === null) {
    throw new Error(`handover comparison sample ${anchorIndex} marks a missing candidate visible`);
  }
  for (const [label, value] of [
    ['servingSinrDb', sample.servingSinrDb],
    ['candidateSinrDb', sample.candidateSinrDb],
  ] as const) {
    if (value !== null && !Number.isFinite(value)) {
      throw new Error(`handover comparison sample ${anchorIndex}.${label} must be finite or null`);
    }
  }
}

function ratio(progressSec: number, tttSec: number): number {
  return Math.min(1, Math.max(0, progressSec / tttSec));
}

function isQualified(
  sample: CanonicalTleHandoverComparisonSample,
  policy: CanonicalTleHandoverPolicy,
): boolean {
  if (!sample.servingVisible || !sample.candidateVisible) return false;
  if (sample.candidateSatelliteId === null || sample.servingSinrDb === null || sample.candidateSinrDb === null) return false;
  return sample.candidateSinrDb - sample.servingSinrDb >= policy.offsetDb;
}

function traceAnchor(
  sample: CanonicalTleHandoverComparisonSample,
  policy: CanonicalTleHandoverPolicy,
  cumulativeCount: number,
  state: CanonicalTleHandoverState,
  event: CanonicalTleHandoverEvent,
  progressSec: number,
  reason: string,
  eventFromSatelliteId: string | null = null,
  eventToSatelliteId: string | null = null,
): CanonicalTleHandoverAnchorTrace {
  const deltaDb = sample.servingSinrDb === null || sample.candidateSinrDb === null
    ? null
    : sample.candidateSinrDb - sample.servingSinrDb;
  return freeze({
    anchorIndex: sample.anchorIndex,
    instantUtc: sample.instantUtc,
    offsetDb: policy.offsetDb,
    tttSec: policy.tttSec,
    progressSec: Math.min(policy.tttSec, Math.max(0, progressSec)),
    ratio: ratio(progressSec, policy.tttSec),
    cumulativeCount,
    state,
    event,
    reason,
    servingSatelliteId: sample.servingSatelliteId,
    candidateSatelliteId: sample.candidateSatelliteId,
    servingVisible: sample.servingVisible,
    candidateVisible: sample.candidateVisible,
    servingSinrDb: sample.servingSinrDb,
    candidateSinrDb: sample.candidateSinrDb,
    deltaDb,
    eventFromSatelliteId,
    eventToSatelliteId,
  });
}

/**
 * Build the complete immutable decision trace from materialized comparisons.
 * The first anchor attaches without incrementing the cumulative count.  A
 * qualifying target starts at zero progress; each subsequent qualifying
 * 30-second anchor adds one decision interval.  If the serving identity is no
 * longer visible, the resolver must provide a real visible target and the
 * trace records a forced-continuity event immediately.
 */
export function buildCanonicalTleHandoverTrace(
  input: CanonicalTleHandoverTraceInput,
): CanonicalTleHandoverTrace {
  const analysisRunId = nonEmpty(input.analysisRunId, 'handover analysisRunId');
  const geometryRunId = nonEmpty(input.geometryRunId, 'handover geometryRunId');
  if (!Number.isInteger(input.anchorCount) || input.anchorCount <= 0) {
    throw new RangeError('handover anchorCount must be a positive integer');
  }
  const policy = validatePolicy(input.policy);
  const anchors: CanonicalTleHandoverAnchorTrace[] = [];
  const servingChangeEventDrafts: CanonicalTleServingChangeEvidence[] = [];
  let activeServingSatelliteId: string | null = null;
  let pendingTargetSatelliteId: string | null = null;
  let qualificationAnchors: CanonicalTleHandoverQualificationAnchor[] = [];
  let progressSec = 0;
  let cumulativeCount = 0;

  for (let anchorIndex = 0; anchorIndex < input.anchorCount; anchorIndex += 1) {
    const plannedServingSatelliteId = input.plannedServingSatelliteId(anchorIndex);
    const initialServingId = activeServingSatelliteId ?? plannedServingSatelliteId;
    if (initialServingId === null) {
      throw new Error(`handover trace has no real initial serving TLE identity at anchor ${anchorIndex}`);
    }
    let sample = input.resolveComparison(anchorIndex, initialServingId);
    validateSample(sample, anchorIndex);

    if (anchorIndex === 0) {
      if (!sample.servingVisible) throw new Error('handover trace initial serving satellite is not visible');
      activeServingSatelliteId = sample.servingSatelliteId;
      if (isQualified(sample, policy)) {
        pendingTargetSatelliteId = sample.candidateSatelliteId;
        progressSec = 0;
        qualificationAnchors = [{
          anchorIndex: sample.anchorIndex,
          instantUtc: sample.instantUtc,
          servingSatelliteId: sample.servingSatelliteId,
          candidateSatelliteId: sample.candidateSatelliteId!,
          deltaDb: sample.candidateSinrDb! - sample.servingSinrDb!,
          progressSec,
          conditionMet: true,
        }];
        anchors.push(traceAnchor(
          sample,
          policy,
          cumulativeCount,
          'pending',
          'initial-attach',
          progressSec,
          'initial TLE attachment; a real candidate currently satisfies the SINR offset',
        ));
      } else {
        qualificationAnchors = [];
        anchors.push(traceAnchor(
          sample,
          policy,
          cumulativeCount,
          'attached',
          'initial-attach',
          0,
          'initial TLE attachment',
        ));
      }
      continue;
    }

    if (activeServingSatelliteId === null) {
      throw new Error(`handover trace lost active serving identity at anchor ${anchorIndex}`);
    }
    if (sample.servingSatelliteId !== activeServingSatelliteId) {
      throw new Error(`handover comparison returned ${sample.servingSatelliteId} for active ${activeServingSatelliteId}`);
    }

    // A resolver may return a visibility sample for the old serving identity
    // even when it is no longer visible.  In that case its candidate is the
    // only legal immediate continuity target.
    if (!sample.servingVisible) {
      const forcedTarget = sample.candidateSatelliteId;
      if (forcedTarget === null || !sample.candidateVisible) {
        throw new Error(`handover trace cannot maintain continuity at anchor ${anchorIndex}`);
      }
      const preCommit = preCommitEvidence(sample);
      const triggerInstantUtc = sample.instantUtc;
      const previousServingSatelliteId = activeServingSatelliteId;
      const eventReason = `serving TLE satellite ${previousServingSatelliteId} left the NTPU horizon`;
      const targetSelection = validatedTargetSelection(input, anchorIndex, forcedTarget);
      activeServingSatelliteId = forcedTarget;
      pendingTargetSatelliteId = null;
      qualificationAnchors = [];
      progressSec = 0;
      cumulativeCount += 1;
      sample = input.resolveComparison(anchorIndex, activeServingSatelliteId);
      validateSample(sample, anchorIndex);
      if (!sample.servingVisible || sample.servingSatelliteId !== activeServingSatelliteId) {
        throw new Error(`forced continuity target ${activeServingSatelliteId} is not visible at anchor ${anchorIndex}`);
      }
      if (sample.instantUtc !== triggerInstantUtc) {
        throw new Error(`forced continuity target ${activeServingSatelliteId} changed the trigger instant at anchor ${anchorIndex}`);
      }
      anchors.push(traceAnchor(
        sample,
        policy,
        cumulativeCount,
        'forced-continuity',
        'forced-continuity',
        0,
        eventReason,
        previousServingSatelliteId,
        activeServingSatelliteId,
      ));
      if (targetSelection !== null) {
        servingChangeEventDrafts.push({
          eventId: servingChangeEventId(
            analysisRunId,
            'forced-continuity',
            anchorIndex,
            previousServingSatelliteId,
            activeServingSatelliteId,
          ),
          analysisRunId,
          geometryRunId,
          traceDigest: '',
          sourceEvent: 'forced-continuity',
          fromSatelliteId: previousServingSatelliteId,
          toSatelliteId: activeServingSatelliteId,
          targetSelection,
          triggerAnchorIndex: anchorIndex,
          triggerInstantUtc,
          preCommit,
          postCommit: {
            servingSatelliteId: activeServingSatelliteId,
            anchorIndex,
            instantUtc: sample.instantUtc,
          },
          reason: eventReason,
          qualificationAnchors: [],
          continuity: {
            servingVisible: false,
            targetVisible: true,
            targetSatelliteId: activeServingSatelliteId,
            reasonCode: 'serving-lost-visibility',
            reason: eventReason,
          },
        });
      }
      continue;
    }

    if (isQualified(sample, policy)) {
      const candidateSatelliteId = sample.candidateSatelliteId!;
      if (pendingTargetSatelliteId === candidateSatelliteId) {
        progressSec += policy.anchorStepSec;
      } else {
        pendingTargetSatelliteId = candidateSatelliteId;
        progressSec = 0;
        qualificationAnchors = [];
      }
      qualificationAnchors.push({
        anchorIndex: sample.anchorIndex,
        instantUtc: sample.instantUtc,
        servingSatelliteId: sample.servingSatelliteId,
        candidateSatelliteId,
        deltaDb: sample.candidateSinrDb! - sample.servingSinrDb!,
        progressSec,
        conditionMet: true,
      });
      if (progressSec >= policy.tttSec) {
        const preCommit = preCommitEvidence(sample);
        const triggerInstantUtc = sample.instantUtc;
        const previousServingSatelliteId = activeServingSatelliteId;
        const eventReason = `candidate TLE satellite ${candidateSatelliteId} exceeded the serving SINR by ${policy.offsetDb} dB for ${policy.tttSec} s`;
        const targetSelection = validatedTargetSelection(input, anchorIndex, candidateSatelliteId);
        activeServingSatelliteId = candidateSatelliteId;
        pendingTargetSatelliteId = null;
        cumulativeCount += 1;
        const committedSample = input.resolveComparison(anchorIndex, activeServingSatelliteId);
        validateSample(committedSample, anchorIndex);
        if (!committedSample.servingVisible || committedSample.servingSatelliteId !== activeServingSatelliteId) {
          throw new Error(`handover target ${activeServingSatelliteId} is not visible at anchor ${anchorIndex}`);
        }
        if (committedSample.instantUtc !== triggerInstantUtc) {
          throw new Error(`handover target ${activeServingSatelliteId} changed the trigger instant at anchor ${anchorIndex}`);
        }
        sample = committedSample;
        anchors.push(traceAnchor(
          sample,
          policy,
          cumulativeCount,
          'handover',
          'inter-handover',
          policy.tttSec,
          eventReason,
          previousServingSatelliteId,
          activeServingSatelliteId,
        ));
        if (targetSelection !== null) {
          servingChangeEventDrafts.push({
            eventId: servingChangeEventId(
              analysisRunId,
              'inter-handover',
              anchorIndex,
              previousServingSatelliteId,
              activeServingSatelliteId,
            ),
            analysisRunId,
            geometryRunId,
            traceDigest: '',
            sourceEvent: 'inter-handover',
            fromSatelliteId: previousServingSatelliteId,
            toSatelliteId: activeServingSatelliteId,
            targetSelection,
            triggerAnchorIndex: anchorIndex,
            triggerInstantUtc,
            preCommit,
            postCommit: {
              servingSatelliteId: activeServingSatelliteId,
              anchorIndex,
              instantUtc: sample.instantUtc,
            },
            reason: eventReason,
            decision: {
              offsetDb: policy.offsetDb,
              tttSec: policy.tttSec,
            },
            qualificationAnchors: qualificationAnchors.map(anchor => ({ ...anchor })),
          });
        }
        qualificationAnchors = [];
        progressSec = 0;
        continue;
      }
      anchors.push(traceAnchor(
        sample,
        policy,
        cumulativeCount,
        'pending',
        'none',
        progressSec,
        `candidate TLE satellite ${candidateSatelliteId} satisfies the SINR offset; TTT is in progress`,
      ));
      continue;
    }

    pendingTargetSatelliteId = null;
    qualificationAnchors = [];
    progressSec = 0;
    anchors.push(traceAnchor(
      sample,
      policy,
      cumulativeCount,
      sample.candidateSatelliteId === null ? 'attached' : 'monitoring',
      'none',
      0,
      sample.candidateSatelliteId === null
        ? 'no real visible candidate is available at this anchor'
        : `candidate SINR does not exceed the serving link by ${policy.offsetDb} dB`,
    ));
  }

  const traceDigest = `tle-trace-v1-${stableHash(canonicalJson({
    analysisRunId,
    geometryRunId,
    policy,
    anchors,
  }))}`;
  const servingChangeEvents = servingChangeEventDrafts.map(event => deepFreeze({
    ...event,
    traceDigest,
  }));

  return deepFreeze({
    analysisRunId,
    geometryRunId,
    traceDigest,
    policy,
    anchorCount: input.anchorCount,
    anchors: freeze(anchors),
    servingChangeEvents: freeze(servingChangeEvents),
  });
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return value;
}
