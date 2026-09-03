#!/usr/bin/env node

/**
 * Bounded S5 diagnostic for the homepage multi-candidate authority lane.
 *
 * This is deliberately a diagnostic, not a second simulator: it composes the
 * same Walker trajectory, `stepRuntimeFrame`, UE substrate, and
 * `attachSinrLiveCellFrame` path used by the sinr-live homepage.  It reads the
 * canonical top-level `handoverDecisionFrame` after every sampled frame and
 * reports what the authority actually observed.  In particular, it does not
 * relax steering/SINR/TTT thresholds, add candidates, or choose a target.
 *
 * Default run: the candidate-rich homepage profile, latest Walker teaching
 * epoch, the homepage's shared primary-UE story trajectory, 100 UEs, and the
 * complete 7200 s window at a deterministic 1 s diagnostic cadence. The
 * cadence is intentionally printed: it is suitable for diagnosing the
 * time-integrated gates, but it is not a claim about the browser's render-FPS
 * sampling.
 *
 * Run directly with:
 *   node --import tsx/esm scripts/diagnose-multi-candidate-window.ts
 */

import assert from 'node:assert/strict';

import { createObserverContext } from '../src/engine/orbit/index.ts';
import {
  candidateLinkKeyString,
  type CandidateDecisionState,
  type CandidateGateResult,
  type GateCode,
  type HandoverDecisionFrame,
} from '../src/engine/handover/candidateDecisionContract.ts';
import { HandoverManager } from '../src/engine/handover/handover-manager.ts';
import type { SinrLiveCellModel } from '../src/scene/sinrLiveCellModel.ts';
import type { SimFrame } from '../src/scene/types.ts';
import {
  createMobilityStates,
  DEFAULT_UE_MOBILITY_PARAMS,
} from '../src/engine/ue/multiUeMobility.ts';
import { loadProfile } from '../src/profiles/index.ts';
import type { Profile } from '../src/profiles/types.ts';
import { HOMEPAGE_NATURAL_HANDOVER_STORY_PRIMARY_JOG_KM } from '../src/homepage/controller/homepageStoryScenario.ts';
import {
  createBeamLayoutsByShellId,
  createRuntimeFrameStepState,
  createTrajectoryCache,
  getTrajectoryMaxTimeSec,
  SIM_DURATION_SEC,
  stepRuntimeFrame,
} from '../src/scene/runtimeFrameStep.ts';
import {
  attachSinrLiveCellFrame,
  buildSinrLiveCellLayout,
  createSinrLiveCellModel,
  resolveSinrLiveSceneCellCount,
} from '../src/scene/sinrLiveCellRuntime.ts';

const DIAG = 'DIAG-MC';
const PROFILE_ID = 'hobs-2024-candidate-rich';
const DEFAULT_STEP_SEC = 1;
const DEFAULT_UE_COUNT = 100;
const EPSILON_SEC = 1e-9;
/** Fixed S5 evidence epoch; independent of homepage date/TLE UI work. */
export const DEFAULT_MULTI_CANDIDATE_DIAGNOSTIC_EPOCH_UTC_MS = Date.UTC(2026, 7, 25, 12, 0, 0);

type PairKey = string;

interface TimeMark {
  readonly simTimeSec: number;
  readonly utc: string;
}

interface PeakSnapshot {
  readonly count: number;
  readonly at: TimeMark;
  readonly keys: readonly PairKey[];
}

interface GateTally {
  pass: number;
  fail: number;
  unavailable: number;
}

interface GateMeasurementRange {
  min: number;
  max: number;
}

interface TimeRange {
  first: TimeMark | null;
  last: TimeMark | null;
}

interface DecisionReceiptSummary {
  readonly simTimeSec: number;
  readonly utc: string;
  readonly kind: string;
  readonly from: PairKey | null;
  readonly to: PairKey;
  readonly sourceFrameId: string;
}

export interface MultiCandidateWindowOptions {
  /** Optional diagnostic-only profile variant. Production callers keep the checked-in profile. */
  readonly profile?: Profile;
  readonly epochUtcMs?: number;
  readonly durationSec?: number;
  readonly stepSec?: number;
  readonly ueCount?: number;
  /** Diagnostic-only policy override; production profile/runtime is untouched. */
  readonly sinrThresholdDb?: number;
  /** Make the CLI fail when the full candidate flow is not observed. */
  readonly requireFlow?: boolean;
  /** Optional read-only hook used by the differential diagnostic. */
  readonly onDecisionFrame?: (observation: MultiCandidateFrameObservation) => void;
}

export interface MultiCandidateFrameObservation {
  readonly frame: SimFrame;
  readonly decision: HandoverDecisionFrame;
  readonly cellModel: SinrLiveCellModel;
}

export interface MultiCandidateWindowReport {
  readonly profileId: string;
  readonly epochUtcMs: number;
  readonly durationSec: number;
  readonly stepSec: number;
  readonly ueCount: number;
  readonly primaryJogEastKm: number;
  readonly primaryJogNorthKm: number;
  readonly frames: number;
  readonly decisionFrames: number;
  readonly observedAll: { readonly max: number; readonly uniquePairs: number };
  readonly observedAlternatives: { readonly max: number; readonly uniquePairs: number };
  readonly eligible: { readonly max: number; readonly frames: number; readonly first: TimeMark | null };
  readonly qualified: { readonly max: number; readonly frames: number; readonly first: TimeMark | null };
  readonly stable: { readonly max: number; readonly frames: number; readonly first: TimeMark | null };
  /** Number of sampled frames with at least two eligible alternatives. */
  readonly multipleEligibleFrames: number;
  /** Number of sampled frames with at least two eligible alternate satellites. */
  readonly multipleEligibleSatelliteFrames: number;
  readonly eligibleDistinctCandidateSatellites: { readonly max: number; readonly frames: number };
  readonly selectionFloorSatisfiedFrames: number;
  readonly selectionFloorBlockedFrames: number;
  readonly provisionalLeaderFrames: number;
  readonly provisionalLeaderTimes: TimeRange;
  readonly selectedFrames: number;
  readonly selectedTimes: TimeRange;
  readonly selectionHoldFrames: number;
  readonly decisionCommits: readonly DecisionReceiptSummary[];
  readonly decisionCommitKinds: Readonly<Record<'intra' | 'inter', number>>;
  readonly cellTruthEvents: Readonly<Record<'intra' | 'inter', number>>;
  readonly cellTruthEventTimes: Readonly<Record<'intra' | 'inter', TimeRange>>;
  readonly gateTallies: ReadonlyMap<GateCode, GateTally>;
  readonly gateMeasurementRanges: ReadonlyMap<GateCode, GateMeasurementRange>;
  readonly rejectionTallies: ReadonlyMap<GateCode, number>;
  readonly maxQualificationSec: number;
  readonly maxRequiredTttSec: number;
  readonly maxSelectionHoldSec: number;
  readonly phaseCounts: ReadonlyMap<HandoverDecisionFrame['phase'], number>;
  readonly firstMultipleEligible: PeakSnapshot | null;
  readonly peakObservedAll: PeakSnapshot;
  readonly peakObservedAlternatives: PeakSnapshot;
  readonly peakEligible: PeakSnapshot;
  readonly peakQualified: PeakSnapshot;
  readonly peakStable: PeakSnapshot;
  readonly primaryCellTruthEventTimes: readonly (TimeMark & { readonly kind: 'intra' | 'inter' })[];
}

function positiveFinite(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be finite and > 0`);
  }
  return value;
}

function mark(epochUtcMs: number, simTimeSec: number): TimeMark {
  const safeSec = Number(simTimeSec.toFixed(3));
  return {
    simTimeSec: safeSec,
    utc: new Date(epochUtcMs + safeSec * 1000).toISOString(),
  };
}

function markText(value: TimeMark | null): string {
  return value === null
    ? 'none'
    : `t=${value.simTimeSec.toFixed(3)}s (${value.utc})`;
}

function peakAt(
  count: number,
  time: TimeMark,
  keys: readonly PairKey[],
): PeakSnapshot {
  return Object.freeze({
    count,
    at: time,
    keys: Object.freeze([...keys]),
  });
}

function incrementGate(
  tallies: Map<GateCode, GateTally>,
  gate: CandidateGateResult,
): void {
  const tally = tallies.get(gate.code) ?? { pass: 0, fail: 0, unavailable: 0 };
  tally[gate.result] += 1;
  tallies.set(gate.code, tally);
}

function incrementCount<K extends string>(map: Map<K, number>, key: K, amount = 1): void {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function includeMeasurement(
  ranges: Map<GateCode, GateMeasurementRange>,
  gate: CandidateGateResult,
): void {
  if (gate.measured === null || !Number.isFinite(gate.measured)) return;
  const previous = ranges.get(gate.code);
  if (previous === undefined) {
    ranges.set(gate.code, { min: gate.measured, max: gate.measured });
  } else {
    previous.min = Math.min(previous.min, gate.measured);
    previous.max = Math.max(previous.max, gate.measured);
  }
}

function candidateStates(
  decision: HandoverDecisionFrame,
): readonly CandidateDecisionState[] {
  const servingKey = decision.serving === null
    ? null
    : candidateLinkKeyString(decision.serving);
  return decision.states.filter(state => candidateLinkKeyString(state.key) !== servingKey);
}

function sortedKeys(states: readonly CandidateDecisionState[]): readonly PairKey[] {
  return states.map(state => candidateLinkKeyString(state.key)).sort();
}

function parseArgs(argv: readonly string[]): MultiCandidateWindowOptions {
  const read = (flag: string): number | undefined => {
    const index = argv.indexOf(flag);
    if (index < 0) return undefined;
    const raw = argv[index + 1];
    if (raw === undefined) throw new Error(`${flag} requires a numeric value`);
    const value = Number(raw);
    return positiveFinite(value, flag);
  };
  return {
    stepSec: read('--step-sec'),
    durationSec: read('--duration-sec'),
    ueCount: read('--ue-count'),
    sinrThresholdDb: argv.includes('--sinr-threshold-db')
      ? (() => {
        const index = argv.indexOf('--sinr-threshold-db');
        const raw = argv[index + 1];
        if (raw === undefined) throw new Error('--sinr-threshold-db requires a numeric value');
        const value = Number(raw);
        if (!Number.isFinite(value)) throw new Error('--sinr-threshold-db must be finite');
        return value;
      })()
      : undefined,
    requireFlow: argv.includes('--require-flow'),
  };
}

export interface RequiredFlowSummary {
  readonly observedAlternativesMax: number;
  readonly eligibleAlternativesMax: number;
  /** Optional stronger check for distinct alternate satellite identities. */
  readonly eligibleDistinctSatellitesMax?: number;
  readonly provisionalLeaderFrames: number;
  readonly selectedFrames: number;
  readonly decisionCommits: number;
}

/**
 * Pure acceptance predicate for the diagnostic's `--require-flow` mode.
 *
 * This deliberately checks the observable authority stages rather than
 * treating a non-empty candidate set as evidence that a handover happened.
 * The default report remains informational/exit-0; callers opt into this
 * red-capable assertion explicitly.
 */
export function requiredFlowFailures(summary: RequiredFlowSummary): readonly string[] {
  const failures: string[] = [];
  if (summary.observedAlternativesMax < 1) failures.push('no observed alternative candidate pair');
  const eligibleDistinctSatellitesMax = summary.eligibleDistinctSatellitesMax
    ?? summary.eligibleAlternativesMax;
  if (eligibleDistinctSatellitesMax < 2) failures.push('fewer than two simultaneously eligible alternatives');
  if (summary.provisionalLeaderFrames < 1) failures.push('no provisional leader frame');
  if (summary.selectedFrames < 1) failures.push('no selected target frame');
  if (summary.decisionCommits < 1) failures.push('no decision commit receipt');
  return Object.freeze(failures);
}

/** Execute the real homepage authority path over one deterministic window. */
export function runMultiCandidateWindow(
  options: MultiCandidateWindowOptions = {},
): MultiCandidateWindowReport {
  const epochUtcMs = options.epochUtcMs ?? DEFAULT_MULTI_CANDIDATE_DIAGNOSTIC_EPOCH_UTC_MS;
  const durationSec = options.durationSec ?? SIM_DURATION_SEC;
  const stepSec = options.stepSec ?? DEFAULT_STEP_SEC;
  const ueCount = Math.max(1, Math.trunc(options.ueCount ?? DEFAULT_UE_COUNT));
  positiveFinite(epochUtcMs, 'epochUtcMs');
  positiveFinite(durationSec, 'durationSec');
  positiveFinite(stepSec, 'stepSec');
  assert.ok(durationSec <= SIM_DURATION_SEC, 'diagnostic duration cannot exceed canonical 7200 s');

  const loadedProfile = options.profile ?? loadProfile(PROFILE_ID);
  // The threshold override is a counterfactual diagnostic input.  Keep the
  // checked-in profile and all runtime production callers unchanged while
  // allowing a differential sweep to isolate the SINR gate.
  const profile = options.sinrThresholdDb === undefined
    ? loadedProfile
    : {
      ...loadedProfile,
      handover: {
        ...loadedProfile.handover,
        sinrThresholdDb: options.sinrThresholdDb,
      },
    };
  const observer = createObserverContext(
    profile.orbit.observerLatDeg,
    profile.orbit.observerLonDeg,
  );
  const trajectoryCache = createTrajectoryCache(profile, observer, epochUtcMs);
  const maxTimeSec = getTrajectoryMaxTimeSec(trajectoryCache);
  assert.equal(
    maxTimeSec,
    SIM_DURATION_SEC,
    `Walker trajectory must cover the canonical ${SIM_DURATION_SEC}s window`,
  );

  // These are the same effective homepage defaults produced by
  // buildAppRuntimeConfig/useSimulation: seven-cell asymmetric UEs, static
  // mobility, 7 serving/candidate beams, sampled steering, and the explicit
  // homepage multi-candidate authority gate.
  const sceneCellCount = resolveSinrLiveSceneCellCount(profile.beams.perSatellite);
  const cellLayout = buildSinrLiveCellLayout(profile, sceneCellCount);
  const cellCentersKm = cellLayout.centers.map(center => ({
    eastKm: center.localXKm,
    northKm: center.localYKm,
  }));
  const beamLayoutsByShellId = createBeamLayoutsByShellId(profile);
  const hoManager = new HandoverManager(profile.handover, {
    enforceSharedHandoverInterval: true,
  });
  const secondaryHoManagers = Array.from(
    { length: Math.max(0, ueCount - 1) },
    () => new HandoverManager(profile.handover),
  );
  const mobilityStates = createMobilityStates(
    ueCount,
    'static',
    DEFAULT_UE_MOBILITY_PARAMS,
    profile.ueDistribution?.seed ?? 42,
  );
  const runtimeState = createRuntimeFrameStepState(0);
  const cellModel = createSinrLiveCellModel(
    profile,
    true,
    epochUtcMs,
    {},
    sceneCellCount,
    sceneCellCount,
    false,
    'sampled-steering',
    true,
  );
  assert.ok(cellModel !== null, 'homepage cell model must be available behind the authority gate');
  const { east: primaryJogEastKm, north: primaryJogNorthKm } =
    HOMEPAGE_NATURAL_HANDOVER_STORY_PRIMARY_JOG_KM;

  const replay = {
    epochUtcMs,
    startOffsetSec: 0,
    loop: false,
    windowLengthSec: SIM_DURATION_SEC,
  };

  const observedAllPairs = new Set<PairKey>();
  const observedAlternativePairs = new Set<PairKey>();
  const gateTallies = new Map<GateCode, GateTally>();
  const gateMeasurementRanges = new Map<GateCode, GateMeasurementRange>();
  const rejectionTallies = new Map<GateCode, number>();
  const phaseCounts = new Map<HandoverDecisionFrame['phase'], number>();
  const seenDecisionReceipts = new Set<string>();
  const decisionCommits: DecisionReceiptSummary[] = [];
  const decisionCommitKinds = { intra: 0, inter: 0 };
  const seenCellEvents = new Set<string>();
  const primaryCellTruthEventTimes: Array<TimeMark & { readonly kind: 'intra' | 'inter' }> = [];
  const cellTruthEvents = { intra: 0, inter: 0 };
  const cellTruthEventTimes: Record<'intra' | 'inter', TimeRange> = {
    intra: { first: null, last: null },
    inter: { first: null, last: null },
  };
  let frames = 0;
  let decisionFrames = 0;
  let eligibleFrames = 0;
  let multipleEligibleFrames = 0;
  let multipleEligibleSatelliteFrames = 0;
  let maxEligibleDistinctCandidateSatellites = 0;
  let eligibleDistinctCandidateSatelliteFrames = 0;
  let selectionFloorSatisfiedFrames = 0;
  let selectionFloorBlockedFrames = 0;
  let qualifiedFrames = 0;
  let stableFrames = 0;
  let provisionalLeaderFrames = 0;
  const provisionalLeaderTimes: TimeRange = { first: null, last: null };
  let selectedFrames = 0;
  const selectedTimes: TimeRange = { first: null, last: null };
  let selectionHoldFrames = 0;
  let maxQualificationSec = 0;
  let maxRequiredTttSec = 0;
  let maxSelectionHoldSec = 0;
  let firstEligible: TimeMark | null = null;
  let firstQualified: TimeMark | null = null;
  let firstStable: TimeMark | null = null;
  let firstMultipleEligible: PeakSnapshot | null = null;
  let peakObservedAll = peakAt(0, mark(epochUtcMs, 0), []);
  let peakObservedAlternatives = peakAt(0, mark(epochUtcMs, 0), []);
  let peakEligible = peakAt(0, mark(epochUtcMs, 0), []);
  let peakQualified = peakAt(0, mark(epochUtcMs, 0), []);
  let peakStable = peakAt(0, mark(epochUtcMs, 0), []);
  let lastFrame = stepRuntimeFrame({
    profile,
    replay,
    speed: 1,
    paused: true,
    deltaSec: 0,
    nowMs: 1_000_000,
    observer,
    beamLayoutsByShellId,
    trajectoryCache,
    hoManager,
    secondaryHoManagers,
    ueCount,
    ueDistributionMode: 'seven-cell-asymmetric',
    uePrimaryAnchorMode: 'observer',
    ueDistributionScope: 'beam-footprint',
    primaryJogEastKm,
    primaryJogNorthKm,
    ueDistributionCellCentersKm: cellCentersKm,
    ueDistributionCellRadiusKm: cellLayout.cellRadiusKm,
    ueMobilityMode: 'static',
    ueMobilityParams: DEFAULT_UE_MOBILITY_PARAMS,
    mobilityStates,
    focusCellId: null,
    focusUeId: null,
    state: runtimeState,
  });

  const inspect = (frame: typeof lastFrame.frame): void => {
    frames += 1;
    attachSinrLiveCellFrame(frame, cellModel, frame.simTimeSec - lastFrame.previousSimTimeSec);
    const decision = frame.handoverDecisionFrame;
    const cellFrame = frame.sinrLiveCells;
    const time = mark(epochUtcMs, frame.simTimeSec);
    if (cellFrame !== undefined) {
      for (const event of cellFrame.recentHandoverEvents) {
        const eventKey = [
          event.ueId,
          event.kind,
          event.sourceTimeSec,
          event.fromSatId,
          event.fromCellId,
          event.toSatId,
          event.toCellId,
        ].join('|');
        if (seenCellEvents.has(eventKey)) continue;
        seenCellEvents.add(eventKey);
        cellTruthEvents[event.kind] += 1;
        const eventTime = mark(epochUtcMs, event.sourceTimeSec);
        cellTruthEventTimes[event.kind].first ??= eventTime;
        cellTruthEventTimes[event.kind].last = eventTime;
        if (event.ueId === cellFrame.primaryUeId) {
          primaryCellTruthEventTimes.push({
            ...mark(epochUtcMs, event.sourceTimeSec),
            kind: event.kind,
          });
        }
      }
    }
    if (decision === null || decision === undefined) return;
    decisionFrames += 1;
    options.onDecisionFrame?.({ frame, decision, cellModel });
    incrementCount(phaseCounts, decision.phase);
    const states = candidateStates(decision);
    const allKeys = decision.opportunities.map(opportunity => candidateLinkKeyString(opportunity.key));
    const alternativeKeys = sortedKeys(states);
    for (const key of allKeys) observedAllPairs.add(key);
    for (const key of alternativeKeys) observedAlternativePairs.add(key);

    if (allKeys.length > peakObservedAll.count) {
      peakObservedAll = peakAt(allKeys.length, time, [...allKeys].sort());
    }
    if (alternativeKeys.length > peakObservedAlternatives.count) {
      peakObservedAlternatives = peakAt(alternativeKeys.length, time, alternativeKeys);
    }
    const eligibleStates = states.filter(state => state.hardEligibility === 'eligible');
    // Prefer the authority's pre-commit selection-gate count.  On a commit
    // frame `decision.serving` already contains the new service link, while
    // the gate was evaluated against the old one; deriving from the post-
    // commit frame would therefore under-count alternate satellites exactly
    // at the handover boundary.  The state-derived path is kept for legacy
    // frames that predate selectionGate.
    const servingSatelliteId = decision.serving?.satelliteId ?? null;
    const eligibleAlternateStates = eligibleStates.filter(state => (
      servingSatelliteId === null || state.key.satelliteId !== servingSatelliteId
    ));
    const eligibleDistinctCandidateSatelliteCount = decision.selectionGate?.eligibleDistinctCandidateSatellites
      ?? new Set(eligibleAlternateStates.map(state => state.key.satelliteId)).size;
    maxEligibleDistinctCandidateSatellites = Math.max(
      maxEligibleDistinctCandidateSatellites,
      eligibleDistinctCandidateSatelliteCount,
    );
    if (eligibleDistinctCandidateSatelliteCount > 0) eligibleDistinctCandidateSatelliteFrames += 1;
    if (eligibleDistinctCandidateSatelliteCount >= 2) multipleEligibleSatelliteFrames += 1;
    if (decision.selectionGate?.satisfied === true) selectionFloorSatisfiedFrames += 1;
    if (decision.selectionGate?.satisfied === false) selectionFloorBlockedFrames += 1;
    const qualifiedStates = states.filter(state => (
      state.hardEligibility === 'eligible' && state.triggerStatus === 'satisfied'
    ));
    const stableStates = states.filter(state => state.stable);
    const eligibleCount = eligibleStates.length;
    const qualifiedCount = qualifiedStates.length;
    const stableCount = stableStates.length;
    if (eligibleCount > 0) {
      eligibleFrames += 1;
      firstEligible ??= time;
    }
    if (qualifiedCount > 0) {
      qualifiedFrames += 1;
      firstQualified ??= time;
    }
    if (stableCount > 0) {
      stableFrames += 1;
      firstStable ??= time;
    }
    if (eligibleCount >= 2 && firstMultipleEligible === null) {
      firstMultipleEligible = peakAt(eligibleCount, time, sortedKeys(eligibleStates));
    }
    if (eligibleCount >= 2) multipleEligibleFrames += 1;
    if (eligibleCount > peakEligible.count) {
      peakEligible = peakAt(eligibleCount, time, sortedKeys(eligibleStates));
    }
    if (qualifiedCount > peakQualified.count) {
      peakQualified = peakAt(qualifiedCount, time, sortedKeys(qualifiedStates));
    }
    if (stableCount > peakStable.count) {
      peakStable = peakAt(stableCount, time, sortedKeys(stableStates));
    }
    for (const opportunity of decision.opportunities) {
      if (decision.serving !== null && candidateLinkKeyString(opportunity.key) === candidateLinkKeyString(decision.serving)) {
        continue;
      }
      for (const gate of opportunity.gates) {
        incrementGate(gateTallies, gate);
        includeMeasurement(gateMeasurementRanges, gate);
      }
      const state = states.find(item => candidateLinkKeyString(item.key) === candidateLinkKeyString(opportunity.key));
      for (const code of state?.rejectionCodes ?? []) {
        incrementCount(rejectionTallies, code);
      }
      if (state !== undefined) {
        maxQualificationSec = Math.max(maxQualificationSec, state.qualificationSec);
        maxRequiredTttSec = Math.max(maxRequiredTttSec, state.requiredTttSec);
      }
    }
    maxSelectionHoldSec = Math.max(maxSelectionHoldSec, decision.selectionHoldSec);
    if (decision.provisionalLeader !== null) {
      provisionalLeaderFrames += 1;
      provisionalLeaderTimes.first ??= time;
      provisionalLeaderTimes.last = time;
    }
    if (decision.selectedTarget !== null) {
      selectedFrames += 1;
      selectedTimes.first ??= time;
      selectedTimes.last = time;
    }
    if (decision.phase === 'selection-hold') selectionHoldFrames += 1;
    if (decision.recentCommit !== null) {
      const receipt = decision.recentCommit;
      const receiptKey = [
        receipt.episodeId,
        receipt.sourceFrameId,
        receipt.simTimeMs,
        candidateLinkKeyString(receipt.to),
      ].join('|');
      if (!seenDecisionReceipts.has(receiptKey)) {
        seenDecisionReceipts.add(receiptKey);
        const kind = receipt.kind === 'intra-satellite' ? 'intra' : 'inter';
        decisionCommitKinds[kind] += 1;
        decisionCommits.push({
          simTimeSec: time.simTimeSec,
          utc: time.utc,
          kind,
          from: receipt.from === null ? null : candidateLinkKeyString(receipt.from),
          to: candidateLinkKeyString(receipt.to),
          sourceFrameId: receipt.sourceFrameId,
        });
      }
    }
  };

  // The paused frame is a real populated t=0 frame, matching the one-reset
  // recipe's initial reseat.  Use a local `previous` update so attach receives
  // the exact elapsed sim-time for each subsequent step.
  inspect(lastFrame.frame);
  let previousSimTimeSec = lastFrame.frame.simTimeSec;
  while (previousSimTimeSec < durationSec - EPSILON_SEC) {
    const deltaSec = Math.min(stepSec, durationSec - previousSimTimeSec);
    lastFrame = stepRuntimeFrame({
      profile,
      replay,
      speed: 1,
      paused: false,
      deltaSec,
      nowMs: 1_000_000,
      observer,
      beamLayoutsByShellId,
      trajectoryCache,
      hoManager,
      secondaryHoManagers,
      ueCount,
      ueDistributionMode: 'seven-cell-asymmetric',
      uePrimaryAnchorMode: 'observer',
      ueDistributionScope: 'beam-footprint',
      primaryJogEastKm,
      primaryJogNorthKm,
      ueDistributionCellCentersKm: cellCentersKm,
      ueDistributionCellRadiusKm: cellLayout.cellRadiusKm,
      ueMobilityMode: 'static',
      ueMobilityParams: DEFAULT_UE_MOBILITY_PARAMS,
      mobilityStates,
      focusCellId: null,
      focusUeId: null,
      state: runtimeState,
    });
    inspect(lastFrame.frame);
    previousSimTimeSec = lastFrame.frame.simTimeSec;
  }

  assert.equal(
    Number(previousSimTimeSec.toFixed(6)),
    Number(durationSec.toFixed(6)),
    'diagnostic must land exactly on the requested window end',
  );
  assert.ok(decisionFrames > 0, 'authority gate must publish a decision frame');

  return {
    profileId: profile.id,
    epochUtcMs,
    durationSec,
    stepSec,
    ueCount,
    primaryJogEastKm,
    primaryJogNorthKm,
    frames,
    decisionFrames,
    observedAll: { max: peakObservedAll.count, uniquePairs: observedAllPairs.size },
    observedAlternatives: { max: peakObservedAlternatives.count, uniquePairs: observedAlternativePairs.size },
    eligible: { max: peakEligible.count, frames: eligibleFrames, first: firstEligible },
    multipleEligibleFrames,
    multipleEligibleSatelliteFrames,
    eligibleDistinctCandidateSatellites: {
      max: maxEligibleDistinctCandidateSatellites,
      frames: eligibleDistinctCandidateSatelliteFrames,
    },
    selectionFloorSatisfiedFrames,
    selectionFloorBlockedFrames,
    qualified: { max: peakQualified.count, frames: qualifiedFrames, first: firstQualified },
    stable: { max: peakStable.count, frames: stableFrames, first: firstStable },
    provisionalLeaderFrames,
    provisionalLeaderTimes,
    selectedFrames,
    selectedTimes,
    selectionHoldFrames,
    decisionCommits: Object.freeze(decisionCommits),
    decisionCommitKinds: Object.freeze({ ...decisionCommitKinds }),
    cellTruthEvents: Object.freeze({ ...cellTruthEvents }),
    cellTruthEventTimes,
    gateTallies,
    gateMeasurementRanges,
    rejectionTallies,
    maxQualificationSec,
    maxRequiredTttSec,
    maxSelectionHoldSec,
    phaseCounts,
    firstMultipleEligible,
    peakObservedAll,
    peakObservedAlternatives,
    peakEligible,
    peakQualified,
    peakStable,
    primaryCellTruthEventTimes: Object.freeze(primaryCellTruthEventTimes),
  };
}

function formatPeak(label: string, peak: PeakSnapshot): string {
  if (peak.keys.length === 0) return `${label} max=${peak.count} at ${markText(peak.at)}`;
  const shownKeys = peak.keys.slice(0, 12).join(',');
  const suffix = peak.keys.length > 12 ? `,+${peak.keys.length - 12} more` : '';
  return `${label} max=${peak.count} at ${markText(peak.at)} keys=${shownKeys}${suffix}`;
}

function formatGateTallies(tallies: ReadonlyMap<GateCode, GateTally>): string {
  const codes: readonly GateCode[] = [
    'elevation',
    'steering',
    'scheduled-illumination',
    'sinr',
    'throughput',
    'remaining-service-time',
    'ee-advantage',
  ];
  return codes.map(code => {
    const tally = tallies.get(code) ?? { pass: 0, fail: 0, unavailable: 0 };
    return `${code}{pass=${tally.pass},fail=${tally.fail},unavailable=${tally.unavailable}}`;
  }).join(' ');
}

function formatRejections(tallies: ReadonlyMap<GateCode, number>): string {
  const values = [...tallies.entries()].sort((left, right) => right[1] - left[1]);
  return values.length === 0 ? 'none' : values.map(([code, count]) => `${code}=${count}`).join(' ');
}

function formatMeasurementRanges(ranges: ReadonlyMap<GateCode, GateMeasurementRange>): string {
  const values = [...ranges.entries()];
  return values.length === 0
    ? 'none'
    : values.map(([code, range]) => `${code}=[${range.min.toFixed(3)},${range.max.toFixed(3)}]`).join(' ');
}

function printReport(report: MultiCandidateWindowReport): void {
  const epoch = new Date(report.epochUtcMs).toISOString();
  console.log(`[${DIAG}] profile=${report.profileId} epoch=${epoch} duration=${report.durationSec}s step=${report.stepSec}s ueCount=${report.ueCount} primaryJog=(${report.primaryJogEastKm},${report.primaryJogNorthKm})km`);
  console.log(`[${DIAG}] frames=${report.frames} decisionFrames=${report.decisionFrames}`);
  console.log(`[${DIAG}] ${formatPeak('observed(all opportunities)', report.peakObservedAll)} unique=${report.observedAll.uniquePairs}`);
  console.log(`[${DIAG}] ${formatPeak('observed(alternatives)', report.peakObservedAlternatives)} unique=${report.observedAlternatives.uniquePairs}`);
  console.log(`[${DIAG}] ${formatPeak('eligible(alternatives)', report.peakEligible)} frames=${report.eligible.frames} first=${markText(report.eligible.first)}`);
  console.log(`[${DIAG}] eligible>=2 frames=${report.multipleEligibleFrames} first=${report.firstMultipleEligible === null ? 'none' : markText(report.firstMultipleEligible.at)}`);
  console.log(`[${DIAG}] eligible>=2 distinct satellites frames=${report.multipleEligibleSatelliteFrames} maxDistinct=${report.eligibleDistinctCandidateSatellites.max} framesWithEligible=${report.eligibleDistinctCandidateSatellites.frames}`);
  console.log(`[${DIAG}] selectionFloor satisfied=${report.selectionFloorSatisfiedFrames} blocked=${report.selectionFloorBlockedFrames}`);
  console.log(`[${DIAG}] ${formatPeak('qualified(hard eligible + SINR trigger)', report.peakQualified)} frames=${report.qualified.frames} first=${markText(report.qualified.first)}`);
  console.log(`[${DIAG}] ${formatPeak('stable(after TTT)', report.peakStable)} frames=${report.stable.frames} first=${markText(report.stable.first)}`);
  console.log(`[${DIAG}] multipleEligible=${report.firstMultipleEligible === null ? 'NO' : `YES first=${markText(report.firstMultipleEligible.at)} count=${report.firstMultipleEligible.count} keys=${report.firstMultipleEligible.keys.join(',')}`}`);
  console.log(`[${DIAG}] leaderFrames=${report.provisionalLeaderFrames} first=${markText(report.provisionalLeaderTimes.first)} last=${markText(report.provisionalLeaderTimes.last)} selectedFrames=${report.selectedFrames} first=${markText(report.selectedTimes.first)} last=${markText(report.selectedTimes.last)} selectionHoldFrames=${report.selectionHoldFrames} maxSelectionHold=${report.maxSelectionHoldSec.toFixed(3)}s`);
  console.log(`[${DIAG}] decisionCommits=${report.decisionCommits.length} intra=${report.decisionCommitKinds.intra} inter=${report.decisionCommitKinds.inter}`);
  for (const commit of report.decisionCommits) {
    console.log(`[${DIAG}] commit ${commit.kind} ${commit.from ?? 'none'} -> ${commit.to} at t=${commit.simTimeSec.toFixed(3)}s (${commit.utc}) frame=${commit.sourceFrameId}`);
  }
  console.log(`[${DIAG}] cellTruthEvents(all UEs) intra=${report.cellTruthEvents.intra} (${markText(report.cellTruthEventTimes.intra.first)} -> ${markText(report.cellTruthEventTimes.intra.last)}) inter=${report.cellTruthEvents.inter} (${markText(report.cellTruthEventTimes.inter.first)} -> ${markText(report.cellTruthEventTimes.inter.last)})`);
  console.log(`[${DIAG}] primaryCellTruthEvents=${report.primaryCellTruthEventTimes.length}${report.primaryCellTruthEventTimes.length > 0 ? ` ${report.primaryCellTruthEventTimes.map(event => `${event.kind}@${markText(event)}`).join(', ')}` : ''}`);
  console.log(`[${DIAG}] maxQualification=${report.maxQualificationSec.toFixed(3)}s requiredTttMax=${report.maxRequiredTttSec.toFixed(3)}s`);
  console.log(`[${DIAG}] gateTallies(per alternative-frame) ${formatGateTallies(report.gateTallies)}`);
  console.log(`[${DIAG}] gateMeasuredRanges(min,max) ${formatMeasurementRanges(report.gateMeasurementRanges)}`);
  console.log(`[${DIAG}] rejectionCodes ${formatRejections(report.rejectionTallies)}`);
  console.log(`[${DIAG}] phases ${[...report.phaseCounts.entries()].map(([phase, count]) => `${phase}=${count}`).join(' ')}`);

  const hardGateLimited = report.eligible.max === 0;
  const triggerLimited = report.eligible.max > 0 && report.qualified.max === 0;
  const tttLimited = report.qualified.max > 0 && report.stable.max === 0;
  const selectionLimited = report.stable.max > 0 && report.selectedFrames === 0;
  const commitLimited = report.selectedFrames > 0 && report.decisionCommits.length === 0;
  const verdict = hardGateLimited
    ? 'HARD-GATE-LIMITED: no alternative pair was hard-eligible in the sampled window'
    : triggerLimited
      ? 'SINR/TRIGGER-LIMITED: hard-eligible alternatives existed, but none beat the SINR offset'
      : tttLimited
        ? 'TTT-LIMITED: trigger-satisfied alternatives never reached the required TTT'
        : selectionLimited
          ? 'SELECTION-LIMITED: stable alternatives existed, but no provisional target was selected'
          : commitLimited
            ? 'TRANSACTION-LIMITED: a target was selected, but no post-measurement commit receipt was published'
            : 'FLOW-OBSERVED: the authority produced at least one selected/commit path';
  console.log(`[${DIAG}] VERDICT ${verdict}`);
}

const isMain = process.argv[1]?.endsWith('diagnose-multi-candidate-window.ts') ?? false;
if (isMain) {
  const options = parseArgs(process.argv.slice(2));
  const report = runMultiCandidateWindow(options);
  printReport(report);
  if (options.requireFlow) {
    const failures = requiredFlowFailures({
      observedAlternativesMax: report.observedAlternatives.max,
      eligibleAlternativesMax: report.eligible.max,
      eligibleDistinctSatellitesMax: report.eligibleDistinctCandidateSatellites.max,
      provisionalLeaderFrames: report.provisionalLeaderFrames,
      selectedFrames: report.selectedFrames,
      decisionCommits: report.decisionCommits.length,
    });
    if (failures.length > 0) {
      console.error(`[${DIAG}] REQUIRE-FLOW FAILED: ${failures.join('; ')}`);
      process.exitCode = 1;
    } else {
      console.log(`[${DIAG}] REQUIRE-FLOW PASSED`);
    }
  }
}
