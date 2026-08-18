import assert from 'node:assert/strict';

import {
  buildCanonicalTleHandoverTrace,
  DEFAULT_CANONICAL_TLE_HANDOVER_POLICY,
  type CanonicalTleHandoverComparisonSample,
} from './canonicalTleHandover';

function sample(
  anchorIndex: number,
  servingSatelliteId: string,
  candidateSatelliteId: string | null,
  servingSinrDb: number | null,
  candidateSinrDb: number | null,
  servingVisible = true,
): CanonicalTleHandoverComparisonSample {
  return Object.freeze({
    anchorIndex,
    instantUtc: new Date(Date.parse('2026-08-08T00:00:00.000Z') + anchorIndex * 30_000).toISOString(),
    servingSatelliteId,
    candidateSatelliteId,
    servingVisible,
    candidateVisible: candidateSatelliteId !== null,
    servingSinrDb,
    candidateSinrDb,
  });
}

const comparisons: readonly CanonicalTleHandoverComparisonSample[] = Object.freeze([
  sample(0, 'A', 'B', 10, 11),
  sample(1, 'A', 'B', 10, 14),
  sample(2, 'A', 'B', 10, 14),
  sample(3, 'B', null, 14, null),
]);

const evidenceIdentity = {
  analysisRunId: 'analysis-test-a',
  geometryRunId: 'geometry-test-a',
  resolveTargetSelection: (_anchorIndex: number, satelliteId: string) => Object.freeze({
    selectionKind: 'pass-plan' as const,
    passId: `pass-${satelliteId}`,
    satelliteId,
    sourceLocator: `passPlan.passes[passId=pass-${satelliteId}]`,
  }),
};

const trace = buildCanonicalTleHandoverTrace({
  ...evidenceIdentity,
  anchorCount: comparisons.length,
  plannedServingSatelliteId: () => 'A',
  resolveComparison: (anchorIndex, activeServingSatelliteId) => {
    if (activeServingSatelliteId === 'B' && anchorIndex === 2) return sample(2, 'B', null, 14, null);
    return comparisons[anchorIndex]!;
  },
});

assert.equal(trace.policy.offsetDb, 3);
assert.equal(trace.policy.tttSec, 30);
assert.equal(trace.policy.anchorStepSec, 30);
assert.equal(trace.anchors[0]?.cumulativeCount, 0, 'initial attach must not count as handover');
assert.equal(trace.anchors[0]?.event, 'initial-attach');
assert.equal(trace.anchors[1]?.state, 'pending');
assert.equal(trace.anchors[1]?.progressSec, 0, 'first qualifying 30-second anchor starts TTT');
assert.equal(trace.anchors[2]?.event, 'inter-handover');
assert.equal(trace.anchors[2]?.servingSatelliteId, 'B');
assert.equal(trace.anchors[2]?.cumulativeCount, 1);
assert.equal(trace.anchors[2]?.progressSec, 30);
assert.equal(trace.anchors[2]?.ratio, 1);
assert.deepEqual(
  trace.anchors.map(anchor => ({
    state: anchor.state,
    event: anchor.event,
    progressSec: anchor.progressSec,
    cumulativeCount: anchor.cumulativeCount,
    from: anchor.eventFromSatelliteId,
    to: anchor.eventToSatelliteId,
  })),
  [
    { state: 'attached', event: 'initial-attach', progressSec: 0, cumulativeCount: 0, from: null, to: null },
    { state: 'pending', event: 'none', progressSec: 0, cumulativeCount: 0, from: null, to: null },
    { state: 'handover', event: 'inter-handover', progressSec: 30, cumulativeCount: 1, from: 'A', to: 'B' },
    { state: 'attached', event: 'none', progressSec: 0, cumulativeCount: 1, from: null, to: null },
  ],
  'publishing evidence must not change the existing handover state machine',
);
assert.equal(trace.analysisRunId, 'analysis-test-a');
assert.equal(trace.geometryRunId, 'geometry-test-a');
assert.match(trace.traceDigest, /^tle-trace-v1-[0-9a-f]{8}$/);
assert.equal(trace.servingChangeEvents.length, 1);
const interEvent = trace.servingChangeEvents[0]!;
assert.equal(interEvent.sourceEvent, 'inter-handover');
assert.match(interEvent.eventId, /^tle-event-v1-[0-9a-f]{8}$/);
assert.equal(interEvent.traceDigest, trace.traceDigest);
assert.equal(interEvent.fromSatelliteId, 'A');
assert.equal(interEvent.toSatelliteId, 'B');
assert.equal(interEvent.preCommit.servingSatelliteId, 'A');
assert.equal(interEvent.preCommit.candidateSatelliteId, 'B');
assert.equal(interEvent.postCommit.servingSatelliteId, 'B');
assert.equal(interEvent.targetSelection.passId, 'pass-B');
assert.equal(interEvent.targetSelection.satelliteId, 'B');
if (interEvent.sourceEvent === 'inter-handover') {
  assert.deepEqual(
    interEvent.qualificationAnchors.map(anchor => ({
      anchorIndex: anchor.anchorIndex,
      servingSatelliteId: anchor.servingSatelliteId,
      candidateSatelliteId: anchor.candidateSatelliteId,
      deltaDb: anchor.deltaDb,
      progressSec: anchor.progressSec,
      conditionMet: anchor.conditionMet,
    })),
    [
      { anchorIndex: 1, servingSatelliteId: 'A', candidateSatelliteId: 'B', deltaDb: 4, progressSec: 0, conditionMet: true },
      { anchorIndex: 2, servingSatelliteId: 'A', candidateSatelliteId: 'B', deltaDb: 4, progressSec: 30, conditionMet: true },
    ],
  );
}
assert.ok(Object.isFrozen(trace));
assert.ok(Object.isFrozen(trace.policy));
assert.ok(Object.isFrozen(trace.anchors));
assert.ok(Object.isFrozen(trace.anchors[2]));
assert.ok(Object.isFrozen(trace.servingChangeEvents));
assert.ok(Object.isFrozen(interEvent));

const stableTrace = buildCanonicalTleHandoverTrace({
  ...evidenceIdentity,
  anchorCount: comparisons.length,
  plannedServingSatelliteId: () => 'A',
  resolveComparison: (anchorIndex, activeServingSatelliteId) => {
    if (activeServingSatelliteId === 'B' && anchorIndex === 2) return sample(2, 'B', null, 14, null);
    return comparisons[anchorIndex]!;
  },
});
assert.equal(stableTrace.servingChangeEvents[0]?.eventId, interEvent.eventId);
const otherRunTrace = buildCanonicalTleHandoverTrace({
  ...evidenceIdentity,
  analysisRunId: 'analysis-test-b',
  anchorCount: comparisons.length,
  plannedServingSatelliteId: () => 'A',
  resolveComparison: (anchorIndex, activeServingSatelliteId) => {
    if (activeServingSatelliteId === 'B' && anchorIndex === 2) return sample(2, 'B', null, 14, null);
    return comparisons[anchorIndex]!;
  },
});
assert.notEqual(otherRunTrace.servingChangeEvents[0]?.eventId, interEvent.eventId);

const forced = buildCanonicalTleHandoverTrace({
  ...evidenceIdentity,
  anchorCount: 3,
  policy: DEFAULT_CANONICAL_TLE_HANDOVER_POLICY,
  plannedServingSatelliteId: anchorIndex => (anchorIndex === 0 ? 'A' : 'B'),
  resolveComparison: (anchorIndex, activeServingSatelliteId) => {
    if (anchorIndex === 0) return sample(0, 'A', 'B', 12, 12);
    if (activeServingSatelliteId === 'A') return sample(anchorIndex, 'A', 'B', null, 15, false);
    return sample(anchorIndex, 'B', null, 15, null);
  },
});
assert.equal(forced.anchors[1]?.event, 'forced-continuity');
assert.equal(forced.anchors[1]?.state, 'forced-continuity');
assert.equal(forced.anchors[1]?.servingSatelliteId, 'B');
assert.equal(forced.anchors[1]?.eventFromSatelliteId, 'A');
assert.equal(forced.anchors[1]?.eventToSatelliteId, 'B');
assert.equal(forced.anchors[1]?.cumulativeCount, 1);
assert.equal(forced.servingChangeEvents.length, 1);
const forcedEvent = forced.servingChangeEvents[0]!;
assert.equal(forcedEvent.sourceEvent, 'forced-continuity');
assert.equal(forcedEvent.preCommit.servingSatelliteId, 'A');
assert.equal(forcedEvent.preCommit.candidateSatelliteId, 'B');
assert.equal(forcedEvent.preCommit.servingVisible, false);
assert.equal(forcedEvent.preCommit.candidateVisible, true);
assert.equal(forcedEvent.postCommit.servingSatelliteId, 'B');
if (forcedEvent.sourceEvent === 'forced-continuity') {
  assert.deepEqual(forcedEvent.qualificationAnchors, []);
  assert.deepEqual(forcedEvent.continuity, {
    servingVisible: false,
    targetVisible: true,
    targetSatelliteId: 'B',
    reasonCode: 'serving-lost-visibility',
    reason: 'serving TLE satellite A left the NTPU horizon',
  });
}

const fallback = buildCanonicalTleHandoverTrace({
  analysisRunId: 'analysis-fallback',
  geometryRunId: 'geometry-fallback',
  resolveTargetSelection: () => null,
  anchorCount: 2,
  plannedServingSatelliteId: anchorIndex => (anchorIndex === 0 ? 'A' : 'B'),
  resolveComparison: (anchorIndex, activeServingSatelliteId) => {
    if (anchorIndex === 0) return sample(0, 'A', 'B', 12, 12);
    if (activeServingSatelliteId === 'A') return sample(1, 'A', 'B', null, 15, false);
    return sample(1, 'B', null, 15, null);
  },
});
assert.equal(fallback.anchors[1]?.event, 'forced-continuity');
assert.deepEqual(fallback.servingChangeEvents, [], 'a geometry fallback may not publish event evidence');

assert.throws(
  () => buildCanonicalTleHandoverTrace({
    ...evidenceIdentity,
    anchorCount: 2,
    plannedServingSatelliteId: () => 'A',
    resolveComparison: (anchorIndex, activeServingSatelliteId) => {
      if (anchorIndex === 0) return sample(0, 'A', 'B', 12, 12);
      if (activeServingSatelliteId === 'A') return sample(1, 'X', 'B', null, 15, false);
      return sample(1, 'B', null, 15, null);
    },
  }),
  /returned X for active A/,
  'forced continuity must reject a pre-commit sample for a different serving identity',
);

const reset = buildCanonicalTleHandoverTrace({
  ...evidenceIdentity,
  anchorCount: 4,
  plannedServingSatelliteId: () => 'A',
  resolveComparison: anchorIndex => [
    sample(0, 'A', null, 10, null),
    sample(1, 'A', 'B', 10, 14),
    sample(2, 'A', 'C', 10, 14),
    sample(3, 'A', null, 10, null),
  ][anchorIndex]!,
});
assert.equal(reset.anchors[1]?.state, 'pending');
assert.equal(reset.anchors[2]?.state, 'pending', 'a new target restarts TTT');
assert.equal(reset.anchors[2]?.progressSec, 0);
assert.equal(reset.anchors[3]?.state, 'attached');
assert.equal(reset.anchors[3]?.cumulativeCount, 0);

console.log('Canonical TLE handover trace tests passed');
