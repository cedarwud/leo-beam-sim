import {
  candidateLinkKey,
  type CandidateLinkKey,
} from '../../engine/handover/candidateDecisionContract';
import {
  createWalkerAcceptedFrameIdentity,
} from '../../engine/handover/walkerAcceptedFrameIdentity';
import {
  resolvePrimaryCellServingRecord,
} from '../../scene/sinrLiveCellModel';
import type { SimFrame } from '../../scene/types';
import type { HomepageSourceFrame } from './contracts';

/**
 * Inputs owned by the existing live runtime.  The adapter receives the epoch
 * and delta as metadata; it never advances simulation time or maintains a
 * previous-frame cursor.
 */
export interface HomepageSourceFrameAdapterInput {
  readonly frame: SimFrame;
  readonly epochUtcMs: number;
  readonly dtSec: number;
}

function fail(message: string): never {
  throw new TypeError(`homepage source frame: ${message}`);
}

function nonNegativeFinite(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) fail(`${label} must be finite and non-negative`);
  return value;
}

function copyKey(key: CandidateLinkKey | null): CandidateLinkKey | null {
  return key === null ? null : candidateLinkKey(key.satelliteId, key.beamId);
}

function resolvePrimaryUeId(frame: SimFrame): string | null {
  return frame.sinrLiveCells?.primaryUeId
    ?? frame.sinrLiveCells?.ues[0]?.ueId
    ?? frame.perUePositions[0]?.id
    ?? null;
}

/**
 * The top-level decision is authoritative whenever present.  The cell-truth
 * serving record is only a compatibility fallback for a frame that has no
 * decision yet, and it is accepted only when it carries a real beam id.
 */
function resolveServing(frame: SimFrame): CandidateLinkKey | null {
  const decision = frame.handoverDecisionFrame ?? null;
  if (decision !== null) return copyKey(decision.serving);

  const cellFrame = frame.sinrLiveCells;
  if (cellFrame === undefined) return null;
  const record = resolvePrimaryCellServingRecord(cellFrame, frame.perUePositions);
  if (
    record?.servingSatId === null
    || record?.servingSatId === undefined
    || record.servingBeamId === null
    || record.servingBeamId === undefined
  ) return null;
  return candidateLinkKey(record.servingSatId, record.servingBeamId);
}

function assertSourceJoins(
  frame: SimFrame,
  sourceFrameId: string,
  epochToken: string,
  primaryUeId: string | null,
): void {
  const decision = frame.handoverDecisionFrame ?? null;
  if (decision !== null) {
    if (decision.sourceFrameId !== sourceFrameId) {
      fail('decision/sourceFrameId does not match the Walker source identity');
    }
    if (decision.epochToken !== undefined && decision.epochToken !== epochToken) {
      fail('decision/epochToken does not match the Walker source identity');
    }
  }

  const cellSourceFrameId = frame.sinrLiveCells?.sourceFrameId;
  if (cellSourceFrameId !== undefined && cellSourceFrameId !== sourceFrameId) {
    fail('cell frame/sourceFrameId does not match the Walker source identity');
  }

  const opportunitySet = frame.sinrLiveCells?.primaryCandidateOpportunities ?? null;
  if (opportunitySet === null) return;
  if (opportunitySet.sourceFrameId !== sourceFrameId) {
    fail('candidate opportunity/sourceFrameId does not match the Walker source identity');
  }
  if (primaryUeId !== null && opportunitySet.primaryUeId !== primaryUeId) {
    fail('candidate opportunity/primaryUeId does not match the source frame');
  }
}

function assertFrameTimes(frame: SimFrame, simTimeSec: number): void {
  const cellTimeSec = frame.sinrLiveCells?.simTimeSec;
  if (cellTimeSec !== undefined
    && (!Number.isFinite(cellTimeSec) || Math.abs(cellTimeSec - simTimeSec) > 1e-9)) {
    fail('cell frame/simTimeSec does not match the Walker source frame');
  }
}

/**
 * Runtime preflight for the React publication bridge. The adapter remains
 * strict for direct callers; this boolean lets the homepage publisher skip a
 * transient old-frame bridge without throwing during render.
 */
export function isHomepageSourceFrameJoinCurrent(
  frame: SimFrame | null | undefined,
  epochUtcMs: number,
): boolean {
  try {
    if (frame === null || frame === undefined) return false;
    const simTimeSec = nonNegativeFinite(frame.simTimeSec, 'frame.simTimeSec');
    const identity = createWalkerAcceptedFrameIdentity(epochUtcMs, simTimeSec);
    assertFrameTimes(frame, simTimeSec);
    assertSourceJoins(frame, identity.sourceFrameId, identity.epochToken, resolvePrimaryUeId(frame));
    return true;
  } catch {
    return false;
  }
}

/**
 * Adapt one existing `/` live frame into the homepage source boundary.
 *
 * `createWalkerAcceptedFrameIdentity` is the existing identity authority used
 * by the live cell model.  This adapter carries that identity, the one
 * measured opportunity set, and the one canonical decision forward without
 * ranking, stepping a clock, or creating a second decision.
 */
export function adaptHomepageSourceFrame(
  input: HomepageSourceFrameAdapterInput,
): HomepageSourceFrame {
  if (input === null || typeof input !== 'object') fail('input must be an object');
  if (input.frame === null || typeof input.frame !== 'object') fail('frame must be an object');
  const simTimeSec = nonNegativeFinite(input.frame.simTimeSec, 'frame.simTimeSec');
  const dtSec = nonNegativeFinite(input.dtSec, 'dtSec');
  const identity = createWalkerAcceptedFrameIdentity(input.epochUtcMs, simTimeSec);
  const primaryUeId = resolvePrimaryUeId(input.frame);
  assertFrameTimes(input.frame, simTimeSec);
  assertSourceJoins(input.frame, identity.sourceFrameId, identity.epochToken, primaryUeId);

  const decision = input.frame.handoverDecisionFrame ?? null;
  const simTimeMs = decision?.simTimeMs ?? identity.absoluteUtcMs;
  nonNegativeFinite(simTimeMs, 'source simTimeMs');

  return Object.freeze({
    frame: input.frame,
    sourceFrameId: identity.sourceFrameId,
    epochToken: identity.epochToken,
    simTimeMs,
    simTimeSec,
    dtSec,
    primaryUeId,
    serving: resolveServing(input.frame),
    opportunitySet: input.frame.sinrLiveCells?.primaryCandidateOpportunities ?? null,
    decision,
  });
}
