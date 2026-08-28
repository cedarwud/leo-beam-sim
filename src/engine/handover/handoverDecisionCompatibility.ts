import type { ServingState } from './types';
import {
  candidateLinkKey,
  sameCandidateLinkKey,
  validateHandoverDecisionFrame,
  type CandidateLinkKey,
  type HandoverDecisionFrame,
  type HandoverDecisionMode,
  type HandoverKind,
  type HandoverPhase,
} from './candidateDecisionContract';

export type CompatibilityCommitAction =
  | 'initial-attach'
  | 'intra-switch'
  | 'inter-handover'
  | null;

/**
 * Scalar bridge for callers that have not migrated to the immutable candidate
 * frame yet. It deliberately performs no ranking and owns no timer.
 */
export interface HandoverDecisionCompatibilityProjection {
  readonly phase: HandoverPhase;
  readonly mode: HandoverDecisionMode;
  readonly servingState: ServingState;
  readonly pendingTarget: CandidateLinkKey | null;
  readonly comparisonSatId: string | null;
  readonly comparisonBeamId: number | null;
  readonly pendingTargetSinrDb: number | null;
  readonly triggerProgressSec: number;
  readonly triggerTargetSec: number;
  readonly selectionHoldProgressSec: number;
  readonly selectionHoldTargetSec: number;
  /** Initial attach stays explicit instead of masquerading as an inter-HO. */
  readonly commitAction: CompatibilityCommitAction;
  readonly scientificKind: HandoverKind | null;
  readonly commitReason: string | null;
}

function copyKey(key: CandidateLinkKey | null): CandidateLinkKey | null {
  return key === null ? null : candidateLinkKey(key.satelliteId, key.beamId);
}

function sinrFor(frame: HandoverDecisionFrame, key: CandidateLinkKey | null): number | null {
  if (key === null) return null;
  const opportunity = frame.opportunities.find(item => sameCandidateLinkKey(item.key, key));
  return opportunity?.sinr.status === 'available' && opportunity.sinr.value !== null
    ? opportunity.sinr.value
    : null;
}

function compatibilityAction(kind: HandoverKind | null): CompatibilityCommitAction {
  switch (kind) {
    case 'initial-attach': return 'initial-attach';
    case 'intra-satellite': return 'intra-switch';
    case 'inter-satellite': return 'inter-handover';
    case null: return null;
  }
}

export function projectHandoverDecisionCompatibility(
  frame: HandoverDecisionFrame,
): HandoverDecisionCompatibilityProjection {
  validateHandoverDecisionFrame(frame);
  const pendingTarget = frame.selectedTarget ?? frame.provisionalLeader;
  const pendingState = pendingTarget === null
    ? null
    : frame.states.find(state => sameCandidateLinkKey(state.key, pendingTarget)) ?? null;
  const servingSinrDb = sinrFor(frame, frame.serving);
  const pendingTargetSinrDb = sinrFor(frame, pendingTarget);
  const scientificKind = frame.recentCommit?.kind ?? frame.selectedKind;

  return Object.freeze({
    phase: frame.phase,
    mode: frame.mode,
    servingState: Object.freeze({
      satId: frame.serving?.satelliteId ?? null,
      beamId: frame.serving?.beamId ?? null,
      sinrDb: servingSinrDb ?? -Infinity,
      triggerTimeSec: pendingState?.qualificationSec ?? 0,
      pendingTarget: pendingTarget === null
        ? null
        : Object.freeze({ satId: pendingTarget.satelliteId, beamId: pendingTarget.beamId }),
    }),
    pendingTarget: copyKey(pendingTarget),
    comparisonSatId: pendingTarget?.satelliteId ?? null,
    comparisonBeamId: pendingTarget?.beamId ?? null,
    pendingTargetSinrDb,
    triggerProgressSec: pendingState?.qualificationSec ?? 0,
    triggerTargetSec: pendingState?.requiredTttSec ?? 0,
    selectionHoldProgressSec: frame.selectionHoldSec,
    selectionHoldTargetSec: frame.selectionHoldRequiredSec,
    commitAction: compatibilityAction(frame.recentCommit?.kind ?? null),
    scientificKind,
    commitReason: frame.recentCommit?.reason ?? null,
  });
}
