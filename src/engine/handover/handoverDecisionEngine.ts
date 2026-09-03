import {
  candidateLinkKey,
  candidateLinkKeyString,
  classifyDecisionClock,
  createHandoverCommitReceipt,
  createHandoverDecisionFrame,
  deriveCandidateEligibility,
  deriveHandoverKind,
  sameCandidateLinkKey,
  validateCandidateLinkKey,
  validateCandidateOpportunity,
  validateHandoverCommitReceipt,
  type CandidateDecisionState,
  type CandidateLinkKey,
  type CandidateOpportunity,
  type DecisionClockContext,
  type GateCode,
  type HandoverDecisionFrame,
  type HandoverCommitReceipt,
  type HandoverPhase,
} from './candidateDecisionContract';
import type { CandidateOpportunitySet } from './candidateOpportunityProducer';
import type {
  CandidatePolicyAssessment,
  HandoverPolicyEvaluation,
  HandoverSelectionPolicy,
} from './handoverSelectionPolicy';

export interface HandoverDecisionEngineConfig {
  readonly episodeId: string;
  readonly policy: HandoverSelectionPolicy;
  readonly selectionHoldSec: number;
  readonly guardSec: number;
  /** A missing pair retains its TTT only for this much simulation time. */
  readonly candidateAbsenceToleranceSec?: number;
  /** Optional selection floor; zero keeps the historical single-candidate behaviour. */
  readonly minimumDistinctCandidateSatellites?: number;
  readonly initialServing?: CandidateLinkKey | null;
}

interface CandidateTimer {
  readonly qualificationSec: number;
  readonly absentSec: number;
}

/**
 * Serializable copy of one candidate timer kept by the stateful decision
 * engine.  The candidate key is part of the snapshot instead of relying on a
 * Map's iteration order so callers can persist or validate the checkpoint.
 */
export interface HandoverDecisionEngineTimerSnapshot {
  readonly key: CandidateLinkKey;
  readonly qualificationSec: number;
  readonly absentSec: number;
}

/**
 * Complete mutable decision state checkpoint.
 *
 * Configuration and policy are immutable constructor dependencies and are
 * intentionally not included.  Every mutable field below is represented so
 * an external transaction can restore the engine without losing elapsed
 * clock, candidate TTT, leader/hold, guard, or episode continuity.
 */
export interface HandoverDecisionEngineSnapshot {
  readonly serving: CandidateLinkKey | null;
  readonly timers: readonly HandoverDecisionEngineTimerSnapshot[];
  readonly provisionalLeader: CandidateLinkKey | null;
  readonly armedTarget: CandidateLinkKey | null;
  readonly selectionHoldSec: number;
  readonly guardUntilSimTimeMs: number;
  readonly previousSimTimeMs: number | null;
  readonly previousEpochToken: string | null;
  readonly episodeGeneration: number;
  readonly currentEpisodeId: string;
}

function nonEmpty(value: string, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${label} must be non-empty`);
  }
  return value;
}

function nonNegative(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError(`${label} must be finite and non-negative`);
  }
  return value;
}

function copyKey(key: CandidateLinkKey | null): CandidateLinkKey | null {
  return key === null ? null : candidateLinkKey(key.satelliteId, key.beamId);
}

function keyEquals(left: CandidateLinkKey | null, right: CandidateLinkKey | null): boolean {
  return left !== null && right !== null && sameCandidateLinkKey(left, right);
}

function parseTimerKey(key: string): CandidateLinkKey {
  const delimiter = key.lastIndexOf('|');
  if (delimiter <= 0 || delimiter === key.length - 1) {
    throw new Error(`invalid internal candidate timer key ${key}`);
  }
  const satelliteId = key.slice(0, delimiter);
  const beamId = Number(key.slice(delimiter + 1));
  return candidateLinkKey(satelliteId, beamId);
}

function cloneEngineSnapshot(snapshot: HandoverDecisionEngineSnapshot): HandoverDecisionEngineSnapshot {
  if (snapshot === null || typeof snapshot !== 'object') {
    throw new TypeError('decision engine snapshot must be an object');
  }
  if (!Array.isArray(snapshot.timers)) {
    throw new TypeError('decision engine snapshot timers must be an array');
  }

  const timerKeys = new Set<string>();
  const timers: HandoverDecisionEngineTimerSnapshot[] = [];
  for (const timer of snapshot.timers) {
    if (timer === null || typeof timer !== 'object') {
      throw new TypeError('decision engine timer snapshot must be an object');
    }
    validateCandidateLinkKey(timer.key);
    const key = candidateLinkKey(timer.key.satelliteId, timer.key.beamId);
    const keyString = candidateLinkKeyString(key);
    if (timerKeys.has(keyString)) {
      throw new Error(`decision engine snapshot contains duplicate timer ${keyString}`);
    }
    timerKeys.add(keyString);
    timers.push(Object.freeze({
      key,
      qualificationSec: nonNegative(timer.qualificationSec, `qualificationSec for ${keyString}`),
      absentSec: nonNegative(timer.absentSec, `absentSec for ${keyString}`),
    }));
  }

  const serving = snapshot.serving === null
    ? null
    : (validateCandidateLinkKey(snapshot.serving), candidateLinkKey(
      snapshot.serving.satelliteId,
      snapshot.serving.beamId,
    ));
  const provisionalLeader = snapshot.provisionalLeader === null
    ? null
    : (validateCandidateLinkKey(snapshot.provisionalLeader), candidateLinkKey(
      snapshot.provisionalLeader.satelliteId,
      snapshot.provisionalLeader.beamId,
    ));
  const armedTarget = snapshot.armedTarget === null
    ? null
    : (validateCandidateLinkKey(snapshot.armedTarget), candidateLinkKey(
      snapshot.armedTarget.satelliteId,
      snapshot.armedTarget.beamId,
    ));
  const previousSimTimeMs = snapshot.previousSimTimeMs === null
    ? null
    : nonNegative(snapshot.previousSimTimeMs, 'previousSimTimeMs');
  const previousEpochToken = snapshot.previousEpochToken === null
    ? null
    : nonEmpty(snapshot.previousEpochToken, 'previousEpochToken');
  const episodeGeneration = nonNegative(snapshot.episodeGeneration, 'episodeGeneration');
  if (!Number.isInteger(episodeGeneration)) {
    throw new TypeError('episodeGeneration must be an integer');
  }

  return Object.freeze({
    serving,
    timers: Object.freeze(timers),
    provisionalLeader,
    armedTarget,
    selectionHoldSec: nonNegative(snapshot.selectionHoldSec, 'selectionHoldSec'),
    guardUntilSimTimeMs: nonNegative(snapshot.guardUntilSimTimeMs, 'guardUntilSimTimeMs'),
    previousSimTimeMs,
    previousEpochToken,
    episodeGeneration,
    currentEpisodeId: nonEmpty(snapshot.currentEpisodeId, 'currentEpisodeId'),
  });
}

function failedGateCodes(opportunity: CandidateOpportunity): readonly GateCode[] {
  return Object.freeze(opportunity.gates.filter(gate => gate.result === 'fail').map(gate => gate.code));
}

function validateOpportunitySet(set: CandidateOpportunitySet, sourceFrameId: string): void {
  if (set === null || typeof set !== 'object') throw new TypeError('candidate opportunity set must be an object');
  nonEmpty(set.primaryUeId, 'candidate opportunity set primaryUeId');
  nonEmpty(set.sourceFrameId, 'candidate opportunity set sourceFrameId');
  if (set.sourceFrameId !== sourceFrameId) {
    throw new Error('candidate opportunity set and decision clock must share one source frame');
  }
  if (!Array.isArray(set.opportunities)) throw new TypeError('candidate opportunities must be an array');
  const seen = new Set<string>();
  for (const opportunity of set.opportunities) {
    validateCandidateOpportunity(opportunity);
    if (opportunity.primaryUeId !== set.primaryUeId || opportunity.sourceFrameId !== set.sourceFrameId) {
      throw new Error('candidate opportunity set contains mixed UE or source-frame evidence');
    }
    const key = candidateLinkKeyString(opportunity.key);
    if (seen.has(key)) throw new Error(`candidate opportunity set contains duplicate ${key}`);
    seen.add(key);
  }
}

function validatePolicyEvaluation(
  evaluation: HandoverPolicyEvaluation,
  alternatives: readonly CandidateOpportunity[],
): void {
  if (evaluation === null || typeof evaluation !== 'object' || !Array.isArray(evaluation.assessments)) {
    throw new TypeError('handover policy must return an assessment array');
  }
  const expected = new Set(alternatives.map(item => candidateLinkKeyString(item.key)));
  const seen = new Set<string>();
  for (const assessment of evaluation.assessments) {
    validateCandidateLinkKey(assessment.key);
    const key = candidateLinkKeyString(assessment.key);
    if (!expected.has(key)) throw new Error(`handover policy returned unknown candidate ${key}`);
    if (seen.has(key)) throw new Error(`handover policy returned duplicate candidate ${key}`);
    seen.add(key);
    nonNegative(assessment.requiredTttSec, `required TTT for ${key}`);
  }
  if (seen.size !== expected.size) throw new Error('handover policy must assess every alternative exactly once');
}

function frozenState(
  opportunity: CandidateOpportunity,
  assessment: CandidatePolicyAssessment | null,
  qualificationSec: number,
  rank: number | null,
  triggerBlocked: boolean,
  selectionBlocked = false,
): CandidateDecisionState {
  const servingState = assessment === null;
  const hardEligibility = servingState
    ? deriveCandidateEligibility(opportunity)
    : assessment.hardEligibility;
  const triggerStatus = servingState
    ? 'not-satisfied' as const
    : triggerBlocked
      ? 'unavailable' as const
      : assessment.triggerStatus;
  const requiredTttSec = assessment?.requiredTttSec ?? 0;
  const stable = !servingState
    && !triggerBlocked
    && !selectionBlocked
    && hardEligibility === 'eligible'
    && triggerStatus === 'satisfied'
    && qualificationSec >= requiredTttSec;
  return Object.freeze({
    key: candidateLinkKey(opportunity.key.satelliteId, opportunity.key.beamId),
    hardEligibility,
    triggerStatus,
    qualificationSec,
    requiredTttSec,
    stable,
    rank: stable ? rank : null,
    rejectionCodes: assessment?.rejectionCodes ?? failedGateCodes(opportunity),
  });
}

/**
 * Stateful scientific decision module. It owns candidate timers and commit
 * state, while measurement, policy comparison, presentation, and wall-clock
 * pacing remain outside this interface.
 */
export class HandoverDecisionEngine {
  private readonly config: Readonly<Required<Pick<
    HandoverDecisionEngineConfig,
    | 'episodeId'
    | 'selectionHoldSec'
    | 'guardSec'
    | 'candidateAbsenceToleranceSec'
    | 'minimumDistinctCandidateSatellites'
  >>>;
  private readonly policy: HandoverSelectionPolicy;
  private readonly timers = new Map<string, CandidateTimer>();
  private serving: CandidateLinkKey | null;
  private provisionalLeader: CandidateLinkKey | null = null;
  private armedTarget: CandidateLinkKey | null = null;
  private selectionHoldSec = 0;
  private guardUntilSimTimeMs = 0;
  private previousSimTimeMs: number | null = null;
  private previousEpochToken: string | null = null;
  private episodeGeneration = 0;
  private currentEpisodeId: string;

  constructor(config: HandoverDecisionEngineConfig) {
    if (config === null || typeof config !== 'object') throw new TypeError('decision engine config must be an object');
    if (config.policy === null || typeof config.policy !== 'object' || typeof config.policy.evaluate !== 'function') {
      throw new TypeError('decision engine policy must implement evaluate()');
    }
    const episodeId = nonEmpty(config.episodeId, 'decision engine episodeId');
    this.config = Object.freeze({
      episodeId,
      selectionHoldSec: nonNegative(config.selectionHoldSec, 'selectionHoldSec'),
      guardSec: nonNegative(config.guardSec, 'guardSec'),
      candidateAbsenceToleranceSec: nonNegative(
        config.candidateAbsenceToleranceSec ?? 0,
        'candidateAbsenceToleranceSec',
      ),
      minimumDistinctCandidateSatellites: (() => {
        const value = config.minimumDistinctCandidateSatellites ?? 0;
        if (!Number.isSafeInteger(value) || value < 0) {
          throw new TypeError('minimumDistinctCandidateSatellites must be a non-negative safe integer');
        }
        return value;
      })(),
    });
    this.policy = config.policy;
    this.serving = copyKey(config.initialServing ?? null);
    this.currentEpisodeId = episodeId;
  }

  get servingLink(): CandidateLinkKey | null {
    return copyKey(this.serving);
  }

  /**
   * Capture every mutable field owned by the decision engine.
   *
   * The returned object is deeply copied and frozen at the key/record/array
   * boundaries.  This makes it safe to hand to an external transaction while
   * keeping the engine's internal Map and candidate keys private.
   */
  snapshot(): HandoverDecisionEngineSnapshot {
    return cloneEngineSnapshot({
      serving: this.serving,
      timers: [...this.timers].map(([key, timer]) => ({
        key: parseTimerKey(key),
        qualificationSec: timer.qualificationSec,
        absentSec: timer.absentSec,
      })),
      provisionalLeader: this.provisionalLeader,
      armedTarget: this.armedTarget,
      selectionHoldSec: this.selectionHoldSec,
      guardUntilSimTimeMs: this.guardUntilSimTimeMs,
      previousSimTimeMs: this.previousSimTimeMs,
      previousEpochToken: this.previousEpochToken,
      episodeGeneration: this.episodeGeneration,
      currentEpisodeId: this.currentEpisodeId,
    });
  }

  /**
   * Restore a previously captured checkpoint without retaining aliases to its
   * records or timer collection.  Validation completes before this instance
   * is mutated, so malformed input cannot leave a partially restored engine.
   */
  restore(snapshot: HandoverDecisionEngineSnapshot): void {
    const normalized = cloneEngineSnapshot(snapshot);
    const timers = new Map<string, CandidateTimer>();
    for (const timer of normalized.timers) {
      timers.set(candidateLinkKeyString(timer.key), Object.freeze({
        qualificationSec: timer.qualificationSec,
        absentSec: timer.absentSec,
      }));
    }

    this.serving = copyKey(normalized.serving);
    this.timers.clear();
    for (const [key, timer] of timers) this.timers.set(key, timer);
    this.provisionalLeader = copyKey(normalized.provisionalLeader);
    this.armedTarget = copyKey(normalized.armedTarget);
    this.selectionHoldSec = normalized.selectionHoldSec;
    this.guardUntilSimTimeMs = normalized.guardUntilSimTimeMs;
    this.previousSimTimeMs = normalized.previousSimTimeMs;
    this.previousEpochToken = normalized.previousEpochToken;
    this.episodeGeneration = normalized.episodeGeneration;
    this.currentEpisodeId = normalized.currentEpisodeId;
  }

  /**
   * Synchronize an already measured and atomically accepted continuity commit.
   * Normal TTT commits are owned by `step()` and must not call this method.
   * The explicit safety lane uses it only after its external assignment/load/RF
   * transaction succeeds, preserving this episode and applying the same guard
   * interval as a normal commit.
   */
  acceptServiceContinuityCommit(receipt: HandoverCommitReceipt): void {
    validateHandoverCommitReceipt(receipt);
    if (receipt.mode !== 'service-continuity-protection') {
      throw new Error('external engine synchronization accepts only service-continuity commits');
    }
    if (receipt.episodeId !== this.currentEpisodeId) {
      throw new Error('service-continuity receipt belongs to a different decision episode');
    }
    if (this.previousSimTimeMs !== receipt.simTimeMs) {
      throw new Error('service-continuity receipt must belong to the latest stepped simulation frame');
    }
    const sourceMatches = receipt.from === null
      ? this.serving === null
      : this.serving !== null && sameCandidateLinkKey(receipt.from, this.serving);
    if (!sourceMatches) {
      throw new Error('service-continuity receipt source does not match the active engine serving pair');
    }

    this.serving = copyKey(receipt.to);
    this.clearCandidateSelection();
    this.guardUntilSimTimeMs = receipt.simTimeMs + (this.config.guardSec * 1000);
  }

  /** Cold reset. Unlike a clock discontinuity, this may replace serving. */
  reset(serving: CandidateLinkKey | null = null): void {
    if (serving !== null) validateCandidateLinkKey(serving);
    this.serving = copyKey(serving);
    this.clearDecisionContinuity();
    this.previousSimTimeMs = null;
    this.previousEpochToken = null;
    this.startNextEpisode();
  }

  step(set: CandidateOpportunitySet, clock: DecisionClockContext): HandoverDecisionFrame {
    validateOpportunitySet(set, clock.sourceFrameId);
    const previousSimTimeMs = this.previousSimTimeMs;
    const clockClassification = classifyDecisionClock({
      ...clock,
      previousSimTimeMs,
      previousEpochToken: this.previousEpochToken,
    });
    let elapsedSec = clockClassification.elapsedSec ?? clock.dtSec;
    if (clockClassification.resetRequired) {
      // A seek/source/epoch discontinuity invalidates decision time, but does
      // not fabricate a detach. Current service persists until measured logic
      // explicitly replaces it.
      this.clearDecisionContinuity();
      this.startNextEpisode();
      elapsedSec = 0;
    }
    elapsedSec = nonNegative(elapsedSec, 'decision elapsedSec');
    this.previousSimTimeMs = clock.simTimeMs;
    this.previousEpochToken = clock.epochToken;

    const servingOpportunity = this.serving === null
      ? null
      : set.opportunities.find(item => sameCandidateLinkKey(item.key, this.serving!)) ?? null;
    const alternatives = set.opportunities.filter(
      item => this.serving === null || !sameCandidateLinkKey(item.key, this.serving),
    );
    const evaluation = this.policy.evaluate({ serving: servingOpportunity, alternatives });
    validatePolicyEvaluation(evaluation, alternatives);
    const assessmentByKey = new Map(
      evaluation.assessments.map(assessment => [candidateLinkKeyString(assessment.key), assessment] as const),
    );
    const alternativeKeys = new Set(alternatives.map(item => candidateLinkKeyString(item.key)));
    const guardActive = clock.simTimeMs < this.guardUntilSimTimeMs;
    // A sparse caller may publish no frame during the guard interval. In that
    // case the first post-guard delta spans guarded and active time; only the
    // active suffix may advance candidate TTT or leader hold.
    const decisionElapsedSec = guardActive
      ? 0
      : previousSimTimeMs !== null
        && previousSimTimeMs < this.guardUntilSimTimeMs
        && clock.simTimeMs >= this.guardUntilSimTimeMs
          ? Math.min(elapsedSec, Math.max(0, (clock.simTimeMs - this.guardUntilSimTimeMs) / 1000))
          : elapsedSec;
    const servingEvidenceMissing = this.serving !== null && servingOpportunity === null;

    if (guardActive) {
      this.timers.clear();
    } else {
      for (const [key, timer] of this.timers) {
        if (alternativeKeys.has(key)) continue;
        const absentSec = timer.absentSec + decisionElapsedSec;
        if (absentSec > this.config.candidateAbsenceToleranceSec) {
          this.timers.delete(key);
        } else {
          this.timers.set(key, Object.freeze({ qualificationSec: timer.qualificationSec, absentSec }));
        }
      }
      for (const assessment of evaluation.assessments) {
        const key = candidateLinkKeyString(assessment.key);
        const previous = this.timers.get(key);
        const triggerActive = !servingEvidenceMissing
          && assessment.hardEligibility === 'eligible'
          && assessment.triggerStatus === 'satisfied';
        this.timers.set(key, Object.freeze({
          qualificationSec: triggerActive ? (previous?.qualificationSec ?? 0) + decisionElapsedSec : 0,
          absentSec: 0,
        }));
      }
    }

    const preRankStates = alternatives.map(opportunity => {
      const key = candidateLinkKeyString(opportunity.key);
      const assessment = assessmentByKey.get(key)!;
      return frozenState(
        opportunity,
        assessment,
        guardActive ? 0 : this.timers.get(key)?.qualificationSec ?? 0,
        1,
        servingEvidenceMissing || guardActive,
      );
    });
    const eligibleAlternateSatelliteIds = new Set(
      preRankStates
        .filter(state => state.hardEligibility === 'eligible')
        .map(state => state.key.satelliteId)
        .filter(satelliteId => this.serving === null || satelliteId !== this.serving.satelliteId),
    );
    const selectionFloorSatisfied = this.config.minimumDistinctCandidateSatellites === 0
      || eligibleAlternateSatelliteIds.size >= this.config.minimumDistinctCandidateSatellites;
    // The distinct-satellite floor protects an INTER replacement from being
    // chosen before the requested number of independent spacecraft has been
    // compared.  It must not suppress an INTRA beam switch: a same-satellite
    // target is a valid alternate beam, but it cannot increase the count of
    // alternate satellites by definition.  Keeping this exception here lets
    // the unified decision set produce a measured intra event even while an
    // inter comparison is still below its two-spacecraft floor.
    const selectionFloorAllows = (key: CandidateLinkKey): boolean =>
      selectionFloorSatisfied
      || (
        this.serving !== null
        && key.satelliteId === this.serving.satelliteId
      );
    const stableKeys = new Set(
      preRankStates
        .filter(state => selectionFloorAllows(state.key) && state.stable)
        .map(state => candidateLinkKeyString(state.key)),
    );
    const orderedStableKeys = evaluation.assessments
      .map(assessment => assessment.key)
      .filter(key => stableKeys.has(candidateLinkKeyString(key)));
    const rankByKey = new Map(orderedStableKeys.map((key, index) => [candidateLinkKeyString(key), index + 1]));
    const stateByKey = new Map(preRankStates.map(state => [candidateLinkKeyString(state.key), state] as const));
    const states = set.opportunities.map(opportunity => {
      if (this.serving !== null && sameCandidateLinkKey(opportunity.key, this.serving)) {
        return frozenState(opportunity, null, 0, null, false);
      }
      const key = candidateLinkKeyString(opportunity.key);
      const assessment = assessmentByKey.get(key)!;
      const preRank = stateByKey.get(key)!;
      return frozenState(
        opportunity,
        assessment,
        preRank.qualificationSec,
        rankByKey.get(key) ?? null,
        servingEvidenceMissing || guardActive,
        !selectionFloorAllows(opportunity.key),
      );
    });
    const topStable = orderedStableKeys[0] ?? null;

    if (!guardActive && decisionElapsedSec > 0
      && this.armedTarget !== null && keyEquals(this.armedTarget, topStable)) {
      const target = copyKey(this.armedTarget)!;
      const from = copyKey(this.serving);
      const kind = deriveHandoverKind(from, target);
      const receipt = createHandoverCommitReceipt({
        episodeId: this.currentEpisodeId,
        sourceFrameId: set.sourceFrameId,
        simTimeMs: clock.simTimeMs,
        from,
        to: target,
        kind,
        mode: evaluation.mode,
        reason: evaluation.mode === 'ee-optimization'
          ? 'EE target remained first through independent TTT and selection hold'
          : 'SINR compatibility target remained first through independent TTT and selection hold',
        oldLinkEnded: from !== null,
        newLinkStarted: true,
      });
      this.serving = target;
      this.clearCandidateSelection();
      this.guardUntilSimTimeMs = clock.simTimeMs + (this.config.guardSec * 1000);
      return createHandoverDecisionFrame({
        episodeId: this.currentEpisodeId,
        sourceFrameId: set.sourceFrameId,
        simTimeMs: clock.simTimeMs,
        phase: 'switching',
        serving: target,
        opportunities: set.opportunities,
        states,
        provisionalLeader: null,
        selectedTarget: null,
        selectedKind: null,
        selectionHoldSec: 0,
        selectionHoldRequiredSec: this.config.selectionHoldSec,
        mode: evaluation.mode,
        recentCommit: receipt,
        selectionGate: {
          minimumDistinctCandidateSatellites: this.config.minimumDistinctCandidateSatellites,
          eligibleDistinctCandidateSatellites: eligibleAlternateSatelliteIds.size,
          satisfied: selectionFloorSatisfied,
        },
        epochToken: clock.epochToken,
      });
    }

    let phase: HandoverPhase;
    let selectedTarget: CandidateLinkKey | null = null;
    if (guardActive) {
      this.clearCandidateSelection();
      phase = 'guard';
    } else if (topStable !== null) {
      if (keyEquals(this.provisionalLeader, topStable)) {
        this.selectionHoldSec += decisionElapsedSec;
      } else {
        this.provisionalLeader = copyKey(topStable);
        this.armedTarget = null;
        this.selectionHoldSec = decisionElapsedSec;
      }
      if (this.selectionHoldSec >= this.config.selectionHoldSec) {
        this.armedTarget = copyKey(topStable);
        selectedTarget = copyKey(topStable);
        phase = 'switching';
      } else {
        phase = 'selection-hold';
      }
    } else {
      // Losing the current leader resets only leader/hold state. Independent
      // candidate TTT clocks keep running while their own triggers remain true.
      this.clearLeaderSelection();
      const anyQualifying = states.some(state => state.hardEligibility === 'eligible'
        && state.triggerStatus === 'satisfied');
      phase = this.serving === null
        ? 'initial-attach'
        : anyQualifying
          ? 'qualifying'
          : alternatives.length > 0
            ? 'evaluating'
            : 'monitoring';
    }

    return createHandoverDecisionFrame({
      episodeId: this.currentEpisodeId,
      sourceFrameId: set.sourceFrameId,
      simTimeMs: clock.simTimeMs,
      phase,
      serving: this.serving,
      opportunities: set.opportunities,
      states,
      provisionalLeader: copyKey(this.provisionalLeader),
      selectedTarget,
      selectedKind: selectedTarget === null ? null : deriveHandoverKind(this.serving, selectedTarget),
      selectionHoldSec: this.selectionHoldSec,
      selectionHoldRequiredSec: this.config.selectionHoldSec,
      mode: evaluation.mode,
      recentCommit: null,
      selectionGate: {
        minimumDistinctCandidateSatellites: this.config.minimumDistinctCandidateSatellites,
        eligibleDistinctCandidateSatellites: eligibleAlternateSatelliteIds.size,
        satisfied: selectionFloorSatisfied,
      },
      epochToken: clock.epochToken,
    });
  }

  private clearCandidateSelection(): void {
    this.timers.clear();
    this.clearLeaderSelection();
  }

  private clearLeaderSelection(): void {
    this.provisionalLeader = null;
    this.armedTarget = null;
    this.selectionHoldSec = 0;
  }

  private clearDecisionContinuity(): void {
    this.clearCandidateSelection();
    this.guardUntilSimTimeMs = 0;
  }

  private startNextEpisode(): void {
    this.episodeGeneration += 1;
    this.currentEpisodeId = `${this.config.episodeId}/${this.episodeGeneration}`;
  }
}
