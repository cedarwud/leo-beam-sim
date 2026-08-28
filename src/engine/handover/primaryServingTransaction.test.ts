import assert from 'node:assert/strict';

import {
  applyPrimaryServingAssignmentTransaction,
  getPrimaryActiveDataLinkCount,
  primaryServingAssignmentKey,
  type PrimaryServingAssignmentState,
  type PrimaryServingTransactionCallbacks,
  type PrimaryUeAssignment,
} from './primaryServingTransaction';
import {
  candidateLinkKey,
  type CandidateLinkKey,
  type HandoverCommitReceipt,
} from './candidateDecisionContract';

const PRIMARY_UE = 'ue-primary';
const SECONDARY_UE = 'ue-secondary';
const SERVING = candidateLinkKey('SAT-A', 2);
const INTRA_TARGET = candidateLinkKey('SAT-A', 7);
const INTER_TARGET = candidateLinkKey('SAT-B', 3);
type Load = { readonly loadByLink: Record<string, number> };

function assignment(
  ueId: string,
  membershipCellId: number,
  servingLink: CandidateLinkKey | null,
): PrimaryUeAssignment {
  return { ueId, membershipCellId, servingLink };
}

function state(overrides: Partial<PrimaryServingAssignmentState<Load>> = {}) {
  return {
    episodeId: 'episode-1',
    sourceFrameId: 'walker-frame-12',
    epochToken: 'walker-epoch-1',
    primaryUeId: PRIMARY_UE,
    assignments: [
      assignment(PRIMARY_UE, 42, SERVING),
      assignment(SECONDARY_UE, 99, candidateLinkKey('SAT-A', 5)),
    ],
    load: { loadByLink: { 'SAT-A|2': 1, 'SAT-A|5': 1 } },
    lastCommit: null,
    ...overrides,
  } satisfies PrimaryServingAssignmentState<Load>;
}

function receipt(
  from: CandidateLinkKey | null,
  to: CandidateLinkKey,
  overrides: Partial<HandoverCommitReceipt> = {},
): HandoverCommitReceipt {
  const kind = from === null
    ? 'initial-attach'
    : from.satelliteId === to.satelliteId ? 'intra-satellite' : 'inter-satellite';
  return {
    episodeId: 'episode-1',
    sourceFrameId: 'walker-frame-12',
    simTimeMs: 12_000,
    from,
    to,
    kind,
    mode: 'sinr-offset',
    reason: 'compatibility target passed independent TTT and selection hold',
    oldLinkEnded: from !== null,
    newLinkStarted: true,
    ...overrides,
  };
}

function callbacks(log: string[], measurement: number | null = 31): PrimaryServingTransactionCallbacks<Load, number> {
  return {
    assignmentReducer: ({ before, selectedTarget }) => {
      log.push(`assignment:${selectedTarget.satelliteId}|${selectedTarget.beamId}`);
      return before.assignments.map(item => item.ueId === before.primaryUeId
        ? { ...item, servingLink: selectedTarget }
        : item);
    },
    loadReducer: ({ assignments, selectedTarget }) => {
      log.push(`load:${selectedTarget.satelliteId}|${selectedTarget.beamId}`);
      const loadByLink: Record<string, number> = {};
      for (const item of assignments) {
        if (item.servingLink !== null) {
          const key = `${item.servingLink.satelliteId}|${item.servingLink.beamId}`;
          loadByLink[key] = (loadByLink[key] ?? 0) + 1;
        }
      }
      return { loadByLink };
    },
    measureSelectedLink: ({ after, selectedTarget }) => {
      log.push(`measure:${selectedTarget.satelliteId}|${selectedTarget.beamId}:${after.load.loadByLink[`${selectedTarget.satelliteId}|${selectedTarget.beamId}`] ?? 0}`);
      const primary = after.assignments.find(item => item.ueId === PRIMARY_UE);
      return primary?.servingLink?.satelliteId === selectedTarget.satelliteId
        && primary.servingLink.beamId === selectedTarget.beamId
        ? measurement
        : null;
    },
  };
}

// membershipCellId remains geographic membership; it is not overwritten by
// the beam id during an inter-satellite commit.
{
  const log: string[] = [];
  const before = state();
  const result = applyPrimaryServingAssignmentTransaction({
    state: before,
    engineCommitReceipt: receipt(SERVING, INTER_TARGET),
    selectedTarget: INTER_TARGET,
    callbacks: callbacks(log),
  });
  assert.equal(result.status, 'committed');
  assert.equal(result.rolledBack, false);
  assert.deepEqual(log, ['assignment:SAT-B|3', 'load:SAT-B|3', 'measure:SAT-B|3:1']);
  assert.equal(result.state.assignments.find(item => item.ueId === PRIMARY_UE)?.membershipCellId, 42);
  assert.deepEqual(result.state.assignments.find(item => item.ueId === PRIMARY_UE)?.servingLink, INTER_TARGET);
  assert.equal(getPrimaryActiveDataLinkCount(result.state), 1);
  assert.equal(result.receipt?.before.membershipCellId, 42);
  assert.deepEqual(result.receipt?.before.servingLink, SERVING);
  assert.deepEqual(result.receipt?.after.servingLink, INTER_TARGET);
  assert.deepEqual(result.receipt?.engineCommitReceipt.from, result.receipt?.before.servingLink);
  assert.deepEqual(result.receipt?.engineCommitReceipt.to, result.receipt?.after.servingLink);
  assert.equal(result.receipt?.after.activeDataLinkCount, 1);
  assert.equal(result.receipt?.selectedLinkMeasurement, 31);
  assert.equal(result.state.lastCommit?.to.satelliteId, 'SAT-B');
  assert.equal(before.assignments.find(item => item.ueId === PRIMARY_UE)?.servingLink?.satelliteId, 'SAT-A');
}

// The same procedure accepts an intra-satellite beam switch; the pair key,
// not the satellite alone, is the atomic target identity.
{
  const result = applyPrimaryServingAssignmentTransaction({
    state: state(),
    engineCommitReceipt: receipt(SERVING, INTRA_TARGET),
    callbacks: callbacks([]),
  });
  assert.equal(result.status, 'committed');
  assert.equal(result.receipt?.engineCommitReceipt.kind, 'intra-satellite');
  assert.equal(primaryServingAssignmentKey(result.state.assignments[0]), 'SAT-A|7');
}

// The compact integration form accepts state + engine receipt + a final-state
// measurement callback and exposes `{ ok, state, receipt, evidence }`.
{
  const result = applyPrimaryServingAssignmentTransaction({
    state: state(),
    engineCommitReceipt: receipt(SERVING, INTRA_TARGET),
    loadReducer: ({ assignments }) => ({
      loadByLink: Object.fromEntries(assignments
        .filter(item => item.servingLink !== null)
        .map(item => [primaryServingAssignmentKey(item), 1])),
    }),
    measureFinal: finalState => {
      const primary = finalState.assignments.find(item => item.ueId === PRIMARY_UE);
      return primary?.servingLink?.satelliteId === INTRA_TARGET.satelliteId
        && primary.servingLink.beamId === INTRA_TARGET.beamId
        ? finalState.load.loadByLink['SAT-A|7'] ?? null
        : null;
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.evidence, 1);
  assert.equal(result.receipt?.selectedLinkMeasurement, 1);
}

// Empty decision input is an explicit no-op and never invokes reducers.
{
  let calls = 0;
  const result = applyPrimaryServingAssignmentTransaction({
    state: state(),
    engineCommitReceipt: null,
    selectedTarget: null,
    callbacks: {
      loadReducer: () => { calls += 1; return {}; },
      measureSelectedLink: () => { calls += 1; return 1; },
    },
  });
  assert.equal(result.status, 'no-op');
  assert.equal(result.receipt, null);
  assert.equal(result.state, result.state);
  assert.equal(calls, 0);
}

// A selected target is not a commit. It may be inspected, but it cannot alter
// the serving assignment until the engine emits its receipt.
{
  const result = applyPrimaryServingAssignmentTransaction({
    state: state(),
    selectedTarget: INTER_TARGET,
    callbacks: callbacks([]),
  });
  assert.equal(result.status, 'invalid');
  assert.equal(result.rolledBack, false);
  assert.deepEqual(result.state.assignments[0].servingLink, SERVING);
}

// Structurally malformed receipts are invalid, not stale, and never reach a
// reducer.
{
  let calls = 0;
  const result = applyPrimaryServingAssignmentTransaction({
    state: state(),
    engineCommitReceipt: {
      ...receipt(SERVING, INTER_TARGET),
      newLinkStarted: false,
    },
    callbacks: {
      loadReducer: () => { calls += 1; return {}; },
      measureSelectedLink: () => { calls += 1; return 1; },
    },
  });
  assert.equal(result.status, 'invalid');
  assert.equal(calls, 0);
}

// A delayed result from a different source frame is stale and cannot replace
// a newer primary assignment.
{
  const result = applyPrimaryServingAssignmentTransaction({
    state: state(),
    engineCommitReceipt: receipt(SERVING, INTER_TARGET, { sourceFrameId: 'walker-frame-11' }),
    callbacks: callbacks([]),
  });
  assert.equal(result.status, 'stale');
  assert.equal(result.rolledBack, false);
  assert.deepEqual(result.state.assignments[0].servingLink, SERVING);
}

// A duplicate/older receipt is stale after a successful commit.
{
  const first = applyPrimaryServingAssignmentTransaction({
    state: state(),
    engineCommitReceipt: receipt(SERVING, INTER_TARGET),
    callbacks: callbacks([]),
  });
  assert.equal(first.status, 'committed');
  const duplicate = applyPrimaryServingAssignmentTransaction({
    state: first.state,
    engineCommitReceipt: receipt(SERVING, INTER_TARGET),
    callbacks: callbacks([]),
  });
  assert.equal(duplicate.status, 'stale');
  assert.deepEqual(duplicate.state.assignments[0].servingLink, INTER_TARGET);
}

// If the selected link cannot be measured after final assignment/load, the
// transaction returns the exact pre-commit state and emits no receipt.
{
  const before = state();
  const result = applyPrimaryServingAssignmentTransaction({
    state: before,
    engineCommitReceipt: receipt(SERVING, INTER_TARGET),
    callbacks: callbacks([], null),
  });
  assert.equal(result.status, 'rejected');
  assert.equal(result.rolledBack, true);
  assert.equal(result.receipt, null);
  assert.deepEqual(result.state.assignments, before.assignments);
  assert.deepEqual(result.state.load, before.load);
  assert.equal(result.state.lastCommit, null);
}

// A malformed reducer result that introduces a second primary row is rejected
// before load or measurement; DAPS cannot leak through the seam.
{
  let calls = 0;
  const before = state();
  const result = applyPrimaryServingAssignmentTransaction({
    state: before,
    engineCommitReceipt: receipt(SERVING, INTER_TARGET),
    callbacks: {
      assignmentReducer: ({ before: source, selectedTarget }) => [
        ...source.assignments,
        assignment(PRIMARY_UE, 42, selectedTarget),
      ],
      loadReducer: () => { calls += 1; return {}; },
      measureSelectedLink: () => { calls += 1; return 1; },
    },
  });
  assert.equal(result.status, 'rejected');
  assert.equal(result.rolledBack, true);
  assert.equal(calls, 0);
  assert.deepEqual(result.state.assignments, before.assignments);
}

// The epoch token check prevents a commit from an old Walker continuity
// epoch, even when episode/source strings happen to be reused by a caller.
{
  const result = applyPrimaryServingAssignmentTransaction({
    state: state(),
    engineCommitReceipt: receipt(SERVING, INTER_TARGET),
    epochToken: 'walker-epoch-old',
    callbacks: callbacks([]),
  });
  assert.equal(result.status, 'stale');
}

console.log('primaryServingTransaction tests passed');
