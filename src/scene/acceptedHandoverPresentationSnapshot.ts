import {
  candidateLinkKey,
  candidateLinkKeyString,
  sameCandidateLinkKey,
  validateHandoverDecisionFrame,
  type CandidateLinkKey,
  type HandoverCommitReceipt,
  type HandoverDecisionFrame,
  type HandoverPhase,
} from '../engine/handover/candidateDecisionContract';
import {
  buildCandidatePresentationPlan,
  type CandidatePresentationLink,
  type CandidatePresentationPlan,
} from '../engine/handover/candidatePresentationPlan';

export type AcceptedHandoverPolicyMode =
  | 'sinr-compatibility'
  | 'forecast-ee-validation'
  | 'service-continuity-protection';

export type AcceptedHandoverTriggerObjective =
  | 'sinr-offset'
  | 'initial-attach-compatibility'
  | 'service-continuity-compatibility';

export type AcceptedHandoverHardGateProfile =
  | 'sinr-compatibility'
  | 'initial-attach-compatibility'
  | 'service-continuity-compatibility';

export type AcceptedHandoverEeActivationStatus = 'blocked' | 'validation-only';

export type ServingOrigin =
  | 'bootstrap-serving-seed'
  | 'initial-attach-commit'
  | 'handover-commit'
  | 'service-continuity-commit';

export interface AcceptedHandoverPresentationCounts {
  readonly observed: number;
  readonly hardEligible: number;
  readonly triggerSatisfied: number;
  readonly tttStable: number;
  readonly displayed: number;
  readonly overflow: number;
}

export interface CandidateSceneRenderReceipt {
  readonly snapshotId: string;
  readonly sourceFrameId: string;
  readonly renderedSceneJoinKeys: readonly string[];
  readonly unmappedPairs: readonly {
    readonly key: CandidateLinkKey;
    readonly reason: 'missing-cell-placement' | 'missing-satellite-world' | 'invalid-beam-geometry';
  }[];
  readonly solidDataLinkCount: 0 | 1;
  readonly eventCueCount: number;
}

/**
 * First accepted-publication seam for the pre-activation compatibility lane.
 *
 * The immutable decision frame remains the scientific authority and the plan
 * remains the bounded presentation projection. Keeping both on one accepted
 * object lets the scene and right rail consume the exact same references while
 * the richer Forecast-EE decision fields are migrated behind the blocked
 * activation gate.
 */
export interface AcceptedHandoverPresentationSnapshot {
  readonly snapshotId: string;
  readonly episodeId: string;
  readonly primaryUeId: string;
  readonly sourceFrameId: string;
  readonly epochToken: string;
  readonly simTimeMs: number;
  readonly phase: HandoverPhase;
  readonly policyMode: AcceptedHandoverPolicyMode;
  readonly activeTriggerObjective: AcceptedHandoverTriggerObjective;
  readonly activeHardGateProfile: AcceptedHandoverHardGateProfile;
  readonly eeActivationStatus: AcceptedHandoverEeActivationStatus;
  readonly policyConfigHash: string;
  readonly serving: CandidatePresentationLink | null;
  readonly servingOrigin: ServingOrigin | null;
  readonly candidates: readonly CandidatePresentationLink[];
  readonly overflowKeys: readonly CandidateLinkKey[];
  readonly counts: AcceptedHandoverPresentationCounts;
  readonly activeDataLinkCount: 0 | 1;
  /**
   * Latest authoritative commit that still owns the current serving link.
   * Retained across subsequent guard/monitoring frames so the scene and rail
   * can finish one readable presentation from the same receipt.
   */
  readonly commit: HandoverCommitReceipt | null;
  /** Same immutable objects consumed by scene and rail; neither may rebuild it. */
  readonly decision: HandoverDecisionFrame;
  readonly plan: CandidatePresentationPlan;
}

export interface CandidateInspectionState {
  readonly episodeId: string;
  readonly basedOnSnapshotId: string;
  readonly hoveredKey: CandidateLinkKey | null;
  readonly pinnedKey: CandidateLinkKey | null;
}

export interface AcceptedHandoverPresentationSession {
  readonly snapshot: AcceptedHandoverPresentationSnapshot;
  readonly interaction: CandidateInspectionState;
  readonly renderReceipt: CandidateSceneRenderReceipt | null;
}

export interface BuildAcceptedHandoverPresentationInput {
  readonly decision: HandoverDecisionFrame;
  readonly policyConfigHash: string;
  readonly pinnedKey: CandidateLinkKey | null;
  readonly previousSnapshot?: AcceptedHandoverPresentationSnapshot | null;
}

function fail(message: string): never {
  throw new TypeError(`accepted handover presentation: ${message}`);
}

function requireNonEmpty(value: string | undefined, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) fail(`${label} must be non-empty`);
  return value;
}

function copyKey(key: CandidateLinkKey): CandidateLinkKey {
  return candidateLinkKey(key.satelliteId, key.beamId);
}

function keyToken(key: CandidateLinkKey | null): string {
  return key === null ? '-' : candidateLinkKeyString(key);
}

function fnv1a32(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/** Browser-safe deterministic hash for the effective compatibility profile. */
export function createHandoverPresentationPolicyConfigHash(identity: string): string {
  return `homepage-ee-handover-v1:fnv1a32-${fnv1a32(requireNonEmpty(identity, 'policy identity'))}`;
}

function policyProjection(decision: HandoverDecisionFrame): Readonly<{
  policyMode: AcceptedHandoverPolicyMode;
  activeTriggerObjective: AcceptedHandoverTriggerObjective;
  activeHardGateProfile: AcceptedHandoverHardGateProfile;
  eeActivationStatus: AcceptedHandoverEeActivationStatus;
}> {
  if (decision.mode === 'service-continuity-protection') {
    return Object.freeze({
      policyMode: 'service-continuity-protection',
      activeTriggerObjective: 'service-continuity-compatibility',
      activeHardGateProfile: 'service-continuity-compatibility',
      eeActivationStatus: 'blocked',
    });
  }
  if (decision.serving === null) {
    return Object.freeze({
      policyMode: decision.mode === 'ee-optimization' ? 'forecast-ee-validation' : 'sinr-compatibility',
      activeTriggerObjective: 'initial-attach-compatibility',
      activeHardGateProfile: 'initial-attach-compatibility',
      eeActivationStatus: decision.mode === 'ee-optimization' ? 'validation-only' : 'blocked',
    });
  }
  return Object.freeze({
    policyMode: decision.mode === 'ee-optimization' ? 'forecast-ee-validation' : 'sinr-compatibility',
    activeTriggerObjective: 'sinr-offset',
    activeHardGateProfile: 'sinr-compatibility',
    eeActivationStatus: decision.mode === 'ee-optimization' ? 'validation-only' : 'blocked',
  });
}

function servingOrigin(
  decision: HandoverDecisionFrame,
  previous: AcceptedHandoverPresentationSnapshot | null,
): ServingOrigin | null {
  if (decision.serving === null) return null;
  if (decision.recentCommit !== null && sameCandidateLinkKey(decision.recentCommit.to, decision.serving)) {
    if (decision.recentCommit.kind === 'initial-attach') return 'initial-attach-commit';
    if (decision.recentCommit.mode === 'service-continuity-protection') return 'service-continuity-commit';
    return 'handover-commit';
  }
  if (
    previous !== null
    && previous.serving !== null
    && sameCandidateLinkKey(previous.serving.key, decision.serving)
    && previous.servingOrigin !== null
  ) {
    return previous.servingOrigin;
  }
  return 'bootstrap-serving-seed';
}

function retainedPresentationCommit(
  decision: HandoverDecisionFrame,
  previous: AcceptedHandoverPresentationSnapshot | null,
  epochToken: string,
): HandoverCommitReceipt | null {
  if (decision.recentCommit !== null) return decision.recentCommit;
  const previousCommit = previous?.commit ?? null;
  if (
    previousCommit === null
    || previous?.epochToken !== epochToken
    || decision.simTimeMs < previous.simTimeMs
    || decision.serving === null
    || !sameCandidateLinkKey(previousCommit.to, decision.serving)
  ) return null;
  return previousCommit;
}

function deterministicSnapshotId(
  decision: HandoverDecisionFrame,
  policyConfigHash: string,
  plan: CandidatePresentationPlan,
): string {
  const material = [
    decision.episodeId,
    decision.sourceFrameId,
    String(decision.simTimeMs),
    decision.phase,
    decision.mode,
    policyConfigHash,
    keyToken(decision.serving),
    keyToken(decision.provisionalLeader),
    keyToken(decision.selectedTarget),
    keyToken(plan.pinnedKey),
    ...plan.displayedLinks.map(link => `${link.joinKey}:${link.role}:${link.visual.dataLinkStyle}`),
  ].join('\u001f');
  return `${decision.episodeId}:${fnv1a32(material)}`;
}

function candidateKeysNotDisplayed(plan: CandidatePresentationPlan): readonly CandidateLinkKey[] {
  const displayed = new Set(
    plan.displayedLinks.filter(link => link.isCandidate).map(link => candidateLinkKeyString(link.key)),
  );
  return Object.freeze(
    plan.scientificCandidateKeys
      .filter(key => !displayed.has(candidateLinkKeyString(key)))
      .map(copyKey),
  );
}

function assertPlanJoins(plan: CandidatePresentationPlan): void {
  const seen = new Set<string>();
  for (const link of plan.displayedLinks) {
    if (link.joinKey !== link.sceneJoinKey || link.joinKey !== link.railJoinKey) {
      fail(`scene and rail join keys diverge for ${candidateLinkKeyString(link.key)}`);
    }
    if (seen.has(link.joinKey)) fail(`duplicate displayed join key ${link.joinKey}`);
    seen.add(link.joinKey);
  }
}

export function buildAcceptedHandoverPresentationSession(
  input: BuildAcceptedHandoverPresentationInput,
): AcceptedHandoverPresentationSession {
  validateHandoverDecisionFrame(input.decision);
  const policyConfigHash = requireNonEmpty(input.policyConfigHash, 'policyConfigHash');
  const epochToken = requireNonEmpty(input.decision.epochToken, 'decision.epochToken');
  const primaryUeId = requireNonEmpty(
    input.decision.opportunities[0]?.primaryUeId,
    'decision primaryUeId',
  );
  const previous = input.previousSnapshot?.episodeId === input.decision.episodeId
    ? input.previousSnapshot
    : null;
  const plan = buildCandidatePresentationPlan(input.decision, undefined, {
    pinnedKey: input.pinnedKey,
    previousIdentityAllocation: previous?.plan.identityAllocation ?? null,
  });
  assertPlanJoins(plan);

  const serving = plan.displayedLinks.find(link => link.isServing) ?? null;
  if ((serving === null) !== (input.decision.serving === null)) {
    fail('serving presentation does not match decision serving truth');
  }
  if (plan.activeDataLinkCount !== (serving === null ? 0 : 1)) {
    fail('active data-link count does not match serving truth');
  }

  const candidateStates = input.decision.states.filter(state => (
    input.decision.serving === null || !sameCandidateLinkKey(state.key, input.decision.serving)
  ));
  const candidates = Object.freeze(plan.displayedLinks.filter(link => link.isCandidate));
  const overflowKeys = candidateKeysNotDisplayed(plan);
  const counts = Object.freeze({
    observed: candidateStates.length,
    hardEligible: candidateStates.filter(state => state.hardEligibility === 'eligible').length,
    triggerSatisfied: candidateStates.filter(state => (
      state.hardEligibility === 'eligible' && state.triggerStatus === 'satisfied'
    )).length,
    tttStable: candidateStates.filter(state => (
      state.hardEligibility === 'eligible' && state.triggerStatus === 'satisfied' && state.stable
    )).length,
    displayed: candidates.length,
    overflow: overflowKeys.length,
  });
  if (counts.displayed + counts.overflow !== counts.observed) {
    fail('displayed and overflow candidate counts do not cover the observed set');
  }
  if (counts.tttStable > counts.triggerSatisfied || counts.triggerSatisfied > counts.hardEligible) {
    fail('candidate stage counts must form a monotonic eligibility pipeline');
  }

  const policy = policyProjection(input.decision);
  const snapshotId = deterministicSnapshotId(input.decision, policyConfigHash, plan);
  const commit = retainedPresentationCommit(input.decision, previous, epochToken);
  const snapshot: AcceptedHandoverPresentationSnapshot = Object.freeze({
    snapshotId,
    episodeId: input.decision.episodeId,
    primaryUeId,
    sourceFrameId: input.decision.sourceFrameId,
    epochToken,
    simTimeMs: input.decision.simTimeMs,
    phase: input.decision.phase,
    ...policy,
    policyConfigHash,
    serving,
    servingOrigin: servingOrigin(input.decision, previous),
    candidates,
    overflowKeys,
    counts,
    activeDataLinkCount: plan.activeDataLinkCount,
    commit,
    decision: input.decision,
    plan,
  });
  if ((snapshot.serving === null) !== (snapshot.servingOrigin === null)) {
    fail('serving and servingOrigin nullability must match');
  }

  return Object.freeze({
    snapshot,
    interaction: Object.freeze({
      episodeId: snapshot.episodeId,
      basedOnSnapshotId: snapshot.snapshotId,
      hoveredKey: null,
      pinnedKey: plan.pinnedKey === null ? null : copyKey(plan.pinnedKey),
    }),
    renderReceipt: null,
  });
}
