/**
 * Atomic primary-UE serving-assignment boundary for the Walker handover lane.
 *
 * This module intentionally has no runtime, scene, React, or EE dependency.
 * The decision engine decides that a target may be committed; this module is
 * the small transaction that applies that receipt to the primary assignment,
 * rebuilds load, and re-measures the selected link against the resulting
 * assignment/load state.
 *
 * Two identities are kept separate throughout the transaction:
 *
 *   - `membershipCellId` is the UE's geographic cell membership; and
 *   - `servingLink` is the actual `(satelliteId, beamId)` assignment key.
 *
 * A geographic cell is therefore never silently re-used as a physical beam
 * identity. The default reducer changes only `servingLink`; a caller may
 * provide a reducer for affected UE rows, but the reducer must preserve the
 * UE/membership set and still leave one scalar serving link per UE. That
 * scalar shape is the transaction's no-DAPS invariant.
 */

import {
  candidateLinkKey,
  candidateLinkKeyString,
  createHandoverCommitReceipt,
  sameCandidateLinkKey,
  validateCandidateLinkKey,
  validateHandoverCommitReceipt,
  type CandidateLinkKey,
  type HandoverCommitReceipt,
} from './candidateDecisionContract';

export interface PrimaryUeAssignment {
  /** Stable UE identity. */
  readonly ueId: string;
  /** Geographic membership only; it is not the serving beam identity. */
  readonly membershipCellId: number | null;
  /** At most one active serving link for this UE; null means unserved. */
  readonly servingLink: CandidateLinkKey | null;
}

/**
 * Assignment/load snapshot owned by the transaction boundary.
 *
 * `assignments` may contain background UEs so a load reducer can recompute
 * the affected beam/satellite loads. The one-active-link rule is per UE: each
 * row has one scalar `servingLink`, never an array of simultaneous links.
 */
export interface PrimaryServingAssignmentState<TLoad = unknown> {
  readonly episodeId: string;
  readonly sourceFrameId: string;
  readonly epochToken: string;
  readonly primaryUeId: string;
  readonly assignments: readonly PrimaryUeAssignment[];
  readonly load: TLoad;
  /** The last accepted engine receipt, or null before the first commit. */
  readonly lastCommit: HandoverCommitReceipt | null;
}

/** A read-only before/after view carried by the transaction receipt. */
export interface PrimaryServingAssignmentSnapshot<TLoad = unknown> {
  readonly episodeId: string;
  readonly sourceFrameId: string;
  readonly epochToken: string;
  readonly primaryUeId: string;
  readonly membershipCellId: number | null;
  readonly servingLink: CandidateLinkKey | null;
  readonly activeDataLinkCount: 0 | 1;
  readonly assignments: readonly PrimaryUeAssignment[];
  readonly load: TLoad;
}

export interface PrimaryServingAssignmentReducerInput<TLoad> {
  readonly before: PrimaryServingAssignmentState<TLoad>;
  readonly engineCommitReceipt: HandoverCommitReceipt;
  readonly selectedTarget: CandidateLinkKey;
}

export interface PrimaryServingLoadReducerInput<TLoad> extends PrimaryServingAssignmentReducerInput<TLoad> {
  /** Final assignment rows after the target has been applied. */
  readonly assignments: readonly PrimaryUeAssignment[];
}

export interface PrimaryServingMeasurementInput<TLoad> {
  readonly before: PrimaryServingAssignmentSnapshot<TLoad>;
  /** Measurement MUST be taken from this final assignment/load snapshot. */
  readonly after: PrimaryServingAssignmentSnapshot<TLoad>;
  readonly engineCommitReceipt: HandoverCommitReceipt;
  readonly selectedTarget: CandidateLinkKey;
}

export interface PrimaryServingTransactionCallbacks<TLoad, TMeasurement> {
  /**
   * Optionally replace the primary assignment and any affected UE rows.
   * Throwing, returning an invalid row set, or changing membership causes a
   * full rollback to the input state.
   */
  readonly assignmentReducer?: (
    input: PrimaryServingAssignmentReducerInput<TLoad>,
  ) => readonly PrimaryUeAssignment[];
  /** Rebuild load from the final assignment rows, never from the old load. */
  readonly loadReducer: (input: PrimaryServingLoadReducerInput<TLoad>) => TLoad;
  /** Re-measure the target after both assignment and load are final. */
  readonly measureSelectedLink: (
    input: PrimaryServingMeasurementInput<TLoad>,
  ) => TMeasurement | null;
  /** Optional domain-specific validity check; false means transaction rollback. */
  readonly isMeasurementUsable?: (measurement: TMeasurement) => boolean;
}

export interface PrimaryServingTransactionInput<TLoad, TMeasurement> {
  readonly state: PrimaryServingAssignmentState<TLoad>;
  /** The authoritative receipt emitted by HandoverDecisionEngine. */
  readonly engineCommitReceipt?: HandoverCommitReceipt | null;
  /** Optional selected target from the same decision frame; must match receipt.to. */
  readonly selectedTarget?: CandidateLinkKey | null;
  /** Optional epoch check when the caller has the frame's epoch token available. */
  readonly epochToken?: string | null;
  /** Full callback bundle; kept as the explicit form for runtime adapters. */
  readonly callbacks?: PrimaryServingTransactionCallbacks<TLoad, TMeasurement>;
  /** Convenience form for the primary runtime integration. */
  readonly assignmentReducer?: PrimaryServingTransactionCallbacks<TLoad, TMeasurement>['assignmentReducer'];
  readonly loadReducer?: PrimaryServingTransactionCallbacks<TLoad, TMeasurement>['loadReducer'];
  /** Receives the candidate state after assignment and load are final. */
  readonly measureFinal?: (state: PrimaryServingAssignmentState<TLoad>) => TMeasurement | null;
  readonly isMeasurementUsable?: (measurement: TMeasurement) => boolean;
}

export interface PrimaryServingTransactionReceipt<TLoad, TMeasurement> {
  /** The exact engine receipt accepted by this transaction. */
  readonly engineCommitReceipt: HandoverCommitReceipt;
  /** Before and after are complete assignment/load snapshots, not scalar hints. */
  readonly before: PrimaryServingAssignmentSnapshot<TLoad>;
  readonly after: PrimaryServingAssignmentSnapshot<TLoad>;
  /** Measured only after `after.assignments` and `after.load` were built. */
  readonly selectedLinkMeasurement: TMeasurement;
}

export type PrimaryServingTransactionStatus =
  | 'committed'
  | 'no-op'
  | 'invalid'
  | 'stale'
  | 'rejected';

export interface PrimaryServingTransactionResult<TLoad, TMeasurement> {
  readonly status: PrimaryServingTransactionStatus;
  /** Convenient boolean projection for runtime reducers. */
  readonly ok: boolean;
  /** The original state on no-op/invalid/stale/rejected; the new state on commit. */
  readonly state: PrimaryServingAssignmentState<TLoad>;
  readonly receipt: PrimaryServingTransactionReceipt<TLoad, TMeasurement> | null;
  /** Final selected-link evidence; null on every non-commit result. */
  readonly evidence: TMeasurement | null;
  readonly rolledBack: boolean;
  readonly reason: string;
}

function fail(message: string): never {
  throw new TypeError(message);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function nonEmpty(value: string, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) fail(`${label} must be non-empty`);
  return value;
}

function copyKey(key: CandidateLinkKey | null): CandidateLinkKey | null {
  return key === null ? null : candidateLinkKey(key.satelliteId, key.beamId);
}

function copyAssignment(assignment: PrimaryUeAssignment): PrimaryUeAssignment {
  validateAssignment(assignment);
  return Object.freeze({
    ueId: assignment.ueId,
    membershipCellId: assignment.membershipCellId,
    servingLink: copyKey(assignment.servingLink),
  });
}

function validateAssignment(assignment: PrimaryUeAssignment, label = 'assignment'): void {
  if (!isObject(assignment)) fail(`${label} must be an object`);
  nonEmpty(assignment.ueId, `${label}.ueId`);
  if (assignment.membershipCellId !== null
    && (!Number.isInteger(assignment.membershipCellId) || assignment.membershipCellId < 0)) {
    fail(`${label}.membershipCellId must be null or a non-negative integer`);
  }
  if (assignment.servingLink !== null) validateCandidateLinkKey(assignment.servingLink);
}

function sameNullableKey(left: CandidateLinkKey | null, right: CandidateLinkKey | null): boolean {
  if (left === null || right === null) return left === right;
  return sameCandidateLinkKey(left, right);
}

function sameAssignmentIdentity(left: PrimaryUeAssignment, right: PrimaryUeAssignment): boolean {
  return left.ueId === right.ueId;
}

function cloneCommit(receipt: HandoverCommitReceipt | null): HandoverCommitReceipt | null {
  return receipt === null ? null : createHandoverCommitReceipt(receipt);
}

function validateState<TLoad>(state: PrimaryServingAssignmentState<TLoad>): void {
  if (!isObject(state)) fail('primary serving transaction state must be an object');
  nonEmpty(state.episodeId, 'state.episodeId');
  nonEmpty(state.sourceFrameId, 'state.sourceFrameId');
  nonEmpty(state.epochToken, 'state.epochToken');
  nonEmpty(state.primaryUeId, 'state.primaryUeId');
  if (!Array.isArray(state.assignments) || state.assignments.length === 0) {
    fail('state.assignments must contain at least one UE row');
  }
  const seenUes = new Set<string>();
  let primaryCount = 0;
  for (const assignment of state.assignments) {
    validateAssignment(assignment);
    if (seenUes.has(assignment.ueId)) fail(`state.assignments contains duplicate UE ${assignment.ueId}`);
    seenUes.add(assignment.ueId);
    if (assignment.ueId === state.primaryUeId) primaryCount += 1;
  }
  if (primaryCount !== 1) fail('state.assignments must contain exactly one primary UE row');
  if (state.lastCommit !== null) {
    validateHandoverCommitReceipt(state.lastCommit);
    const primary = state.assignments.find(item => item.ueId === state.primaryUeId)!;
    if (!sameCandidateLinkKey(primary.servingLink!, state.lastCommit.to)) {
      fail('state.lastCommit.to must match the primary serving assignment');
    }
  }
}

function freezeState<TLoad>(state: PrimaryServingAssignmentState<TLoad>): PrimaryServingAssignmentState<TLoad> {
  validateState(state);
  return Object.freeze({
    ...state,
    assignments: Object.freeze(state.assignments.map(copyAssignment)),
    lastCommit: cloneCommit(state.lastCommit),
  });
}

function freezeSnapshot<TLoad>(state: PrimaryServingAssignmentState<TLoad>): PrimaryServingAssignmentSnapshot<TLoad> {
  validateState(state);
  const primary = state.assignments.find(item => item.ueId === state.primaryUeId)!;
  const servingLink = copyKey(primary.servingLink);
  const snapshot: PrimaryServingAssignmentSnapshot<TLoad> = {
    episodeId: state.episodeId,
    sourceFrameId: state.sourceFrameId,
    epochToken: state.epochToken,
    primaryUeId: state.primaryUeId,
    membershipCellId: primary.membershipCellId,
    servingLink,
    activeDataLinkCount: servingLink === null ? 0 : 1,
    assignments: Object.freeze(state.assignments.map(copyAssignment)),
    load: state.load,
  };
  return Object.freeze(snapshot);
}

function defaultAssignmentReducer<TLoad>(
  input: PrimaryServingAssignmentReducerInput<TLoad>,
): readonly PrimaryUeAssignment[] {
  return input.before.assignments.map(assignment => assignment.ueId === input.before.primaryUeId
    ? {
      ...assignment,
      servingLink: copyKey(input.selectedTarget),
    }
    : copyAssignment(assignment));
}

function result<TLoad, TMeasurement>(
  status: PrimaryServingTransactionStatus,
  state: PrimaryServingAssignmentState<TLoad>,
  reason: string,
  rolledBack: boolean,
): PrimaryServingTransactionResult<TLoad, TMeasurement> {
  return Object.freeze({
    status,
    ok: status === 'committed',
    state,
    receipt: null,
    evidence: null,
    rolledBack,
    reason,
  });
}

function safelySameKey(left: CandidateLinkKey | null, right: CandidateLinkKey | null): boolean {
  return left === null || right === null ? left === right : sameCandidateLinkKey(left, right);
}

function isSameReceipt(left: HandoverCommitReceipt, right: HandoverCommitReceipt): boolean {
  return left.episodeId === right.episodeId
    && left.sourceFrameId === right.sourceFrameId
    && left.simTimeMs === right.simTimeMs
    && safelySameKey(left.from, right.from)
    && sameCandidateLinkKey(left.to, right.to);
}

function validateSelectedTarget(target: CandidateLinkKey | null | undefined): CandidateLinkKey | null {
  if (target === undefined || target === null) return null;
  validateCandidateLinkKey(target);
  return candidateLinkKey(target.satelliteId, target.beamId);
}

/**
 * Apply one engine commit to the primary assignment atomically.
 *
 * The function never mutates `input.state`. Every failure after the reducer
 * starts returns the original state and `rolledBack: true`; no partial receipt
 * is emitted. A selected target without an engine receipt is deliberately not
 * enough to switch the serving link: selection and commit are distinct phases.
 */
export function applyPrimaryServingAssignmentTransaction<TLoad, TMeasurement>(
  input: PrimaryServingTransactionInput<TLoad, TMeasurement>,
): PrimaryServingTransactionResult<TLoad, TMeasurement> {
  if (!isObject(input)) fail('primary serving transaction input must be an object');
  validateState(input.state);
  const beforeState = freezeState(input.state);
  const beforeSnapshot = freezeSnapshot(beforeState);
  const selectedTarget = validateSelectedTarget(input.selectedTarget);
  const suppliedReceipt = input.engineCommitReceipt ?? null;

  if (suppliedReceipt === null) {
    if (selectedTarget === null) {
      return result('no-op', beforeState, 'no engine commit receipt or selected target was supplied', false);
    }
    if (sameNullableKey(selectedTarget, beforeSnapshot.servingLink)) {
      return result('no-op', beforeState, 'selected target is already the primary serving link', false);
    }
    return result(
      'invalid',
      beforeState,
      'a selected target cannot change the serving assignment without an engine commit receipt',
      false,
    );
  }

  let receipt: HandoverCommitReceipt;
  try {
    validateHandoverCommitReceipt(suppliedReceipt);
    receipt = createHandoverCommitReceipt(suppliedReceipt);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'engine commit receipt is invalid';
    return result('invalid', beforeState, reason, false);
  }

  if (selectedTarget !== null && !sameCandidateLinkKey(selectedTarget, receipt.to)) {
    return result('invalid', beforeState, 'selected target does not match engine commit receipt.to', false);
  }
  const target = copyKey(receipt.to)!;

  if (input.epochToken !== undefined && input.epochToken !== null) {
    if (typeof input.epochToken !== 'string' || input.epochToken.trim().length === 0) {
      return result('invalid', beforeState, 'transaction epochToken must be non-empty when supplied', false);
    }
    if (input.epochToken !== beforeState.epochToken) {
      return result('stale', beforeState, 'engine commit belongs to a different epoch token', false);
    }
  }

  // A valid receipt from another episode/frame, or from a different current
  // assignment, is stale rather than malformed. This is the handoff guard
  // against applying a delayed engine result to a newer runtime frame.
  if (receipt.episodeId !== beforeState.episodeId || receipt.sourceFrameId !== beforeState.sourceFrameId) {
    return result('stale', beforeState, 'engine commit belongs to a different episode or source frame', false);
  }
  if (!sameNullableKey(receipt.from, beforeSnapshot.servingLink)) {
    return result('stale', beforeState, 'engine commit.from does not match the current primary assignment', false);
  }
  if (beforeState.lastCommit !== null) {
    if (isSameReceipt(beforeState.lastCommit, receipt) || receipt.simTimeMs <= beforeState.lastCommit.simTimeMs) {
      return result('stale', beforeState, 'engine commit is duplicate or older than the last accepted commit', false);
    }
  }

  const callbackBundle = input.callbacks;
  const assignmentReducer = input.assignmentReducer ?? callbackBundle?.assignmentReducer;
  const loadReducer = input.loadReducer ?? callbackBundle?.loadReducer;
  const measureFinal = input.measureFinal;
  const measureSelectedLink = callbackBundle?.measureSelectedLink;
  const isMeasurementUsable = input.isMeasurementUsable ?? callbackBundle?.isMeasurementUsable;
  if (typeof loadReducer !== 'function'
    || (typeof measureFinal !== 'function' && typeof measureSelectedLink !== 'function')) {
    return result('invalid', beforeState, 'transaction requires loadReducer and measureFinal (or the full callback bundle)', false);
  }

  let nextAssignments: readonly PrimaryUeAssignment[];
  try {
    const reducer = assignmentReducer ?? defaultAssignmentReducer;
    const reduced = reducer({
      before: beforeState,
      engineCommitReceipt: receipt,
      selectedTarget: target,
    });
    if (!Array.isArray(reduced)) throw new TypeError('assignmentReducer must return an array');
    nextAssignments = Object.freeze(reduced.map(copyAssignment));
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'assignment reducer failed';
    return result('rejected', beforeState, `assignment transaction rolled back: ${reason}`, true);
  }

  try {
    if (nextAssignments.length !== beforeState.assignments.length) {
      throw new Error('assignment reducer must preserve the UE row set');
    }
    const beforeByUe = new Map(beforeState.assignments.map(item => [item.ueId, item] as const));
    const nextByUe = new Map(nextAssignments.map(item => [item.ueId, item] as const));
    if (nextByUe.size !== beforeByUe.size) throw new Error('assignment reducer returned duplicate UE rows');
    for (const beforeAssignment of beforeState.assignments) {
      const afterAssignment = nextByUe.get(beforeAssignment.ueId);
      if (afterAssignment === undefined) throw new Error(`assignment reducer removed UE ${beforeAssignment.ueId}`);
      if (afterAssignment.membershipCellId !== beforeAssignment.membershipCellId) {
        throw new Error(`assignment reducer changed geographic membershipCellId for ${beforeAssignment.ueId}`);
      }
    }
    const nextPrimary = nextByUe.get(beforeState.primaryUeId)!;
    if (!sameCandidateLinkKey(nextPrimary.servingLink!, target)) {
      throw new Error('assignment reducer did not apply the selected target to the primary UE');
    }
    // This check is intentionally explicit even though the row shape is
    // scalar: it documents and protects the no-DAPS invariant at the seam.
    const activeDataLinkCount = nextPrimary.servingLink === null ? 0 : 1;
    if (activeDataLinkCount !== 1) throw new Error('committed primary assignment must have exactly one active data link');
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'assignment reducer produced an invalid final assignment';
    return result('rejected', beforeState, `assignment transaction rolled back: ${reason}`, true);
  }

  let nextLoad: TLoad;
  try {
    nextLoad = loadReducer({
      before: beforeState,
      engineCommitReceipt: receipt,
      selectedTarget: target,
      assignments: nextAssignments,
    });
    if (nextLoad === undefined) throw new Error('loadReducer returned undefined');
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'load reducer failed';
    return result('rejected', beforeState, `assignment/load transaction rolled back: ${reason}`, true);
  }

  const nextState = freezeState({
    ...beforeState,
    assignments: nextAssignments,
    load: nextLoad,
    lastCommit: receipt,
  });
  const afterSnapshot = freezeSnapshot(nextState);

  let selectedLinkMeasurement: TMeasurement | null;
  try {
    selectedLinkMeasurement = typeof measureFinal === 'function'
      ? measureFinal(nextState)
      : measureSelectedLink!({
        before: beforeSnapshot,
        after: afterSnapshot,
        engineCommitReceipt: receipt,
        selectedTarget: target,
      });
    if (selectedLinkMeasurement === null || selectedLinkMeasurement === undefined) {
      throw new Error('selected link measurement is unavailable after final assignment/load');
    }
    if (isMeasurementUsable !== undefined
      && !isMeasurementUsable(selectedLinkMeasurement)) {
      throw new Error('selected link measurement failed its validity check');
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'selected link remeasurement failed';
    return result('rejected', beforeState, `assignment/load transaction rolled back: ${reason}`, true);
  }

  // These checks are redundant with the reducer validation but keep the
  // receipt contract executable: a consumer cannot observe a receipt whose
  // before/after values disagree with the engine's from/to pair.
  if (!sameNullableKey(beforeSnapshot.servingLink, receipt.from)
    || !sameNullableKey(afterSnapshot.servingLink, receipt.to)
    || afterSnapshot.activeDataLinkCount !== 1
    || nextState.lastCommit === null
    || !sameCandidateLinkKey(nextState.lastCommit.to, afterSnapshot.servingLink!)) {
    return result('rejected', beforeState, 'receipt and final assignment were inconsistent; transaction rolled back', true);
  }

  const transactionReceipt: PrimaryServingTransactionReceipt<TLoad, TMeasurement> = Object.freeze({
    engineCommitReceipt: receipt,
    before: beforeSnapshot,
    after: afterSnapshot,
    selectedLinkMeasurement,
  });
  return Object.freeze({
    status: 'committed',
    ok: true,
    state: nextState,
    receipt: transactionReceipt,
    evidence: selectedLinkMeasurement,
    rolledBack: false,
    reason: 'engine commit applied atomically after final assignment/load remeasurement',
  });
}

/** The primary assignment's active data-link cardinality (always 0 or 1). */
export function getPrimaryActiveDataLinkCount<TLoad>(
  state: PrimaryServingAssignmentState<TLoad>,
): 0 | 1 {
  validateState(state);
  const primary = state.assignments.find(item => item.ueId === state.primaryUeId)!;
  return primary.servingLink === null ? 0 : 1;
}

/** Stable pair identity helper for transaction-adjacent load maps/tests. */
export function primaryServingAssignmentKey(assignment: PrimaryUeAssignment): string | null {
  validateAssignment(assignment);
  return assignment.servingLink === null ? null : candidateLinkKeyString(assignment.servingLink);
}
