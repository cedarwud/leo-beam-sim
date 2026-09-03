#!/usr/bin/env node

/**
 * Differential diagnostic for the S4/S5 primary-candidate SINR gate.
 *
 * The angle-aware rows execute the real homepage authority path with a
 * diagnostic-only profile threshold override.  The rated-power rows reuse the
 * same Walker frame, candidate identities, active interference assignments,
 * geometry and clock, but replace only the candidate measurement with the
 * legacy/rated link-budget path (no angle-aware power state).  Because the
 * production model deliberately has no rated-candidate mode, rated rows are
 * labelled `engine-only counterfactual`: their leader/selection/commit counts
 * exercise the real decision engine over that counterfactual evidence, not a
 * claim that the RF transaction accepted a rated-power link.
 *
 * Run directly with:
 *   node --import tsx/esm scripts/diagnose-multi-candidate-comparison.ts
 *
 * The default 2 s cadence keeps the five threshold sweep bounded while still
 * covering the canonical 7200 s Walker window.  Pass `--step-sec 1` when a
 * one-second audit of short TTT windows is required.
 */

import assert from 'node:assert/strict';

import {
  candidateLinkKey,
  candidateLinkKeyString,
  createCandidateGateResult,
  createMetricEvidence,
  freezeCandidateOpportunity,
  type CandidateGateResult,
  type CandidateGeometryClass,
  type CandidateLinkKey,
  type CandidateOpportunity,
  type HandoverDecisionFrame,
} from '../src/engine/handover/candidateDecisionContract.ts';
import type { CandidateOpportunitySet } from '../src/engine/handover/candidateOpportunityProducer.ts';
import { HandoverDecisionEngine } from '../src/engine/handover/handoverDecisionEngine.ts';
import { SinrOffsetPolicy } from '../src/engine/handover/handoverSelectionPolicy.ts';
import {
  cellIdFromLinkBudgetBeamId,
  cellLinkBudgetBeamId,
  type CellModelSat,
} from '../src/scene/sinrLiveCellModel.ts';
import type { CellCenter, CellLayout } from '../src/engine/cells/cellLayout.ts';
import { computeLinkBudget } from '../src/engine/signal/link-budget.ts';
import type {
  ActiveBeamAssignment,
  LinkSample,
  SatelliteSnapshot,
  UEPosition,
} from '../src/engine/signal/types.ts';
import { loadProfile } from '../src/profiles/index.ts';
import type { Profile } from '../src/profiles/types.ts';
import {
  DEFAULT_MULTI_CANDIDATE_DIAGNOSTIC_EPOCH_UTC_MS,
  runMultiCandidateWindow,
  type MultiCandidateFrameObservation,
  type MultiCandidateWindowReport,
} from './diagnose-multi-candidate-window.ts';

const DIAG = 'DIAG-MC-CMP';
const DEFAULT_STEP_SEC = 2;
const DEFAULT_DURATION_SEC = 7200;
const DEFAULT_UE_COUNT = 100;
const PROFILE_ID = 'hobs-2024-candidate-rich';
const THRESHOLDS = Object.freeze([-5, -10, -12, -15, -20]);

type Mode = 'angle-aware-2w' | 'rated-power';

interface PointingResult {
  readonly axisEcefKm: readonly [number, number, number];
  readonly centerLatDeg: number;
  readonly centerLonDeg: number;
  readonly scanAngleDeg: number;
}

type LinkBudgetOptions = Parameters<typeof computeLinkBudget>[2];

interface ModelInternals {
  readonly cellLayout: CellLayout;
  readonly observer: { readonly latDeg: number; readonly lonDeg: number };
  readonly resolveCellBeamPointing: (
    sat: CellModelSat,
    cell: CellCenter,
    simTimeSec: number,
  ) => PointingResult;
  readonly uePosition: (ue: { readonly id: string; readonly eastKm: number; readonly northKm: number }) => UEPosition;
  readonly linkBudgetOptions: (
    activeAssignments: ActiveBeamAssignment[],
    simTimeSec: number,
    includeAngleAwarePower?: boolean,
  ) => LinkBudgetOptions;
}

interface FlowAccumulator {
  readonly mode: Mode;
  readonly thresholdDb: number;
  frames: number;
  observedAlternativesMax: number;
  observedAlternativePairs: Set<string>;
  eligibleFrames: number;
  eligibleAlternativesMax: number;
  firstEligibleSec: number | null;
  multipleEligibleFrames: number;
  firstMultipleEligibleSec: number | null;
  qualifiedFrames: number;
  qualifiedAlternativesMax: number;
  stableFrames: number;
  stableAlternativesMax: number;
  maxCandidateMarginDb: number | null;
  triggerSatisfiedFrames: number;
  provisionalLeaderFrames: number;
  selectedFrames: number;
  decisionCommits: number;
  replacementCommits: number;
  firstLeaderSec: number | null;
  firstSelectedSec: number | null;
  firstCommitSec: number | null;
  firstReplacementCommitSec: number | null;
}

export interface ComparisonFlowRow {
  readonly mode: Mode;
  readonly thresholdDb: number;
  readonly authority: 'real-homepage-path' | 'decision-engine-only-counterfactual';
  readonly frames: number;
  readonly observedAlternativesMax: number;
  readonly observedAlternativePairs: number;
  readonly eligibleAlternativesMax: number;
  readonly eligibleFrames: number;
  readonly firstEligibleSec: number | null;
  readonly multipleEligibleFrames: number;
  readonly firstMultipleEligibleSec: number | null;
  readonly qualifiedAlternativesMax: number;
  readonly qualifiedFrames: number;
  readonly stableAlternativesMax: number;
  readonly stableFrames: number;
  readonly maxCandidateMarginDb: number | null;
  readonly triggerSatisfiedFrames: number;
  readonly provisionalLeaderFrames: number;
  readonly selectedFrames: number;
  /** Includes initial attach, matching the engine's receipt stream. */
  readonly decisionCommits: number;
  /** Replacement commits only; initial attach is excluded. */
  readonly replacementCommits: number;
  readonly firstLeaderSec: number | null;
  readonly firstSelectedSec: number | null;
  readonly firstCommitSec: number | null;
  readonly firstReplacementCommitSec: number | null;
}

export interface MultiCandidateComparisonReport {
  readonly profileId: string;
  readonly epochUtcMs: number;
  readonly durationSec: number;
  readonly stepSec: number;
  readonly ueCount: number;
  readonly thresholdsDb: readonly number[];
  readonly angleAwareRows: readonly ComparisonFlowRow[];
  readonly ratedPowerRows: readonly ComparisonFlowRow[];
  readonly ratedCandidateSinrRangeDb: { readonly min: number | null; readonly max: number | null };
  readonly angleAwareCandidateSinrRangeDb: { readonly min: number | null; readonly max: number | null };
  readonly angleAwarePrimaryPowerRangeW: {
    readonly first: number | null;
    readonly min: number | null;
    readonly max: number | null;
  };
  /** The same measured frame path used for rated rows; no alternate RF commit was claimed. */
  readonly ratedMeasurementEvidence: 'same-frame-same-interference-field-counterfactual';
}

function finiteOrNull(value: number | null | undefined): number | null {
  return value !== null && value !== undefined && Number.isFinite(value) ? value : null;
}

function gateByCode(opportunity: CandidateOpportunity, code: CandidateGateResult['code']): CandidateGateResult | null {
  return opportunity.gates.find(gate => gate.code === code) ?? null;
}

function geometryClassForGates(gates: readonly CandidateGateResult[]): CandidateGeometryClass {
  const pass = (code: CandidateGateResult['code']): boolean => (
    gates.find(gate => gate.code === code)?.result === 'pass'
  );
  if (pass('elevation') && pass('steering') && pass('scheduled-illumination')
    && pass('sinr') && pass('throughput') && pass('remaining-service-time')) {
    return 'service-eligible';
  }
  if (pass('elevation') && pass('steering') && pass('scheduled-illumination')) {
    return 'scheduled-and-illuminated';
  }
  if (pass('elevation') && pass('steering')) return 'steering-valid';
  return 'geometrically-reachable';
}

function stageCounts(opportunities: readonly CandidateOpportunity[]): CandidateOpportunitySet['counts'] {
  const stage: Readonly<Record<CandidateGeometryClass, number>> = {
    'geometrically-reachable': 0,
    'steering-valid': 1,
    'scheduled-and-illuminated': 2,
    'service-eligible': 3,
  };
  const atLeast = (minimum: CandidateGeometryClass): number => opportunities.filter(
    opportunity => stage[opportunity.geometryClass] >= stage[minimum],
  ).length;
  return Object.freeze({
    observed: opportunities.length,
    geometricallyReachable: opportunities.length,
    steeringValid: atLeast('steering-valid'),
    scheduledAndIlluminated: atLeast('scheduled-and-illuminated'),
    serviceEligible: atLeast('service-eligible'),
  });
}

function rewriteSinr(
  opportunity: CandidateOpportunity,
  sinrDb: number | null,
  thresholdDb: number,
): CandidateOpportunity {
  const available = sinrDb !== null && Number.isFinite(sinrDb);
  const sinr = available
    ? createMetricEvidence({
      status: 'available',
      value: sinrDb,
      unit: 'dB',
      sourceFrameId: opportunity.sourceFrameId,
      reason: null,
    })
    : createMetricEvidence({
      status: 'unavailable',
      value: null,
      unit: 'dB',
      sourceFrameId: null,
      reason: 'rated-power counterfactual did not produce a finite candidate sample',
    });
  const originalGate = gateByCode(opportunity, 'sinr');
  assert.ok(originalGate !== null, 'candidate opportunity must have a SINR gate');
  const sinrGate = createCandidateGateResult({
    ...originalGate,
    result: available && sinrDb >= thresholdDb ? 'pass' : available ? 'fail' : 'unavailable',
    measured: available ? sinrDb : null,
    threshold: thresholdDb,
    unit: 'dB',
    reason: available && sinrDb >= thresholdDb
      ? null
      : available
        ? 'sinr does not meet the diagnostic threshold'
        : 'rated-power counterfactual did not produce a finite candidate sample',
  });
  const gates = opportunity.gates.map(gate => (
    gate.code === 'sinr' ? sinrGate : createCandidateGateResult(gate)
  ));
  return freezeCandidateOpportunity({
    ...opportunity,
    geometryClass: geometryClassForGates(gates),
    sinr,
    gates,
  });
}

function rewriteSet(
  base: CandidateOpportunitySet,
  sinrByPair: ReadonlyMap<string, number>,
  thresholdDb: number,
): CandidateOpportunitySet {
  const opportunities = base.opportunities.map(opportunity => rewriteSinr(
    opportunity,
    finiteOrNull(sinrByPair.get(candidateLinkKeyString(opportunity.key))),
    thresholdDb,
  ));
  return Object.freeze({
    primaryUeId: base.primaryUeId,
    sourceFrameId: base.sourceFrameId,
    opportunities: Object.freeze(opportunities),
    counts: stageCounts(opportunities),
  });
}

function makeAccumulator(mode: Mode, thresholdDb: number): FlowAccumulator {
  return {
    mode,
    thresholdDb,
    frames: 0,
    observedAlternativesMax: 0,
    observedAlternativePairs: new Set<string>(),
    eligibleFrames: 0,
    eligibleAlternativesMax: 0,
    firstEligibleSec: null,
    multipleEligibleFrames: 0,
    firstMultipleEligibleSec: null,
    qualifiedFrames: 0,
    qualifiedAlternativesMax: 0,
    stableFrames: 0,
    stableAlternativesMax: 0,
    maxCandidateMarginDb: null,
    triggerSatisfiedFrames: 0,
    provisionalLeaderFrames: 0,
    selectedFrames: 0,
    decisionCommits: 0,
    replacementCommits: 0,
    firstLeaderSec: null,
    firstSelectedSec: null,
    firstCommitSec: null,
    firstReplacementCommitSec: null,
  };
}

function consumeEngineFrame(
  accumulator: FlowAccumulator,
  decision: HandoverDecisionFrame,
  simTimeSec: number,
): void {
  const states = decision.states.filter(state => (
    decision.serving === null || candidateLinkKeyString(state.key) !== candidateLinkKeyString(decision.serving)
  ));
  const timeSec = simTimeSec;
  accumulator.frames += 1;
  accumulator.observedAlternativesMax = Math.max(accumulator.observedAlternativesMax, states.length);
  for (const state of states) accumulator.observedAlternativePairs.add(candidateLinkKeyString(state.key));
  const eligible = states.filter(state => state.hardEligibility === 'eligible');
  const qualified = states.filter(state => (
    state.hardEligibility === 'eligible' && state.triggerStatus === 'satisfied'
  ));
  const stable = states.filter(state => state.stable);
  accumulator.eligibleAlternativesMax = Math.max(accumulator.eligibleAlternativesMax, eligible.length);
  accumulator.qualifiedAlternativesMax = Math.max(accumulator.qualifiedAlternativesMax, qualified.length);
  accumulator.stableAlternativesMax = Math.max(accumulator.stableAlternativesMax, stable.length);
  if (eligible.length > 0) {
    accumulator.eligibleFrames += 1;
    accumulator.firstEligibleSec ??= timeSec;
  }
  if (eligible.length >= 2) {
    accumulator.multipleEligibleFrames += 1;
    accumulator.firstMultipleEligibleSec ??= timeSec;
  }
  if (qualified.length > 0) accumulator.qualifiedFrames += 1;
  if (stable.length > 0) accumulator.stableFrames += 1;
  if (decision.provisionalLeader !== null) {
    accumulator.provisionalLeaderFrames += 1;
    accumulator.firstLeaderSec ??= timeSec;
  }
  if (decision.selectedTarget !== null) {
    accumulator.selectedFrames += 1;
    accumulator.firstSelectedSec ??= timeSec;
  }
  const receipt = decision.recentCommit;
  if (receipt !== null) {
    accumulator.decisionCommits += 1;
    accumulator.firstCommitSec ??= timeSec;
    if (receipt.from !== null) {
      accumulator.replacementCommits += 1;
      accumulator.firstReplacementCommitSec ??= timeSec;
    }
  }
}

function rowFromAccumulator(
  accumulator: FlowAccumulator,
  authority: ComparisonFlowRow['authority'],
): ComparisonFlowRow {
  return Object.freeze({
    mode: accumulator.mode,
    thresholdDb: accumulator.thresholdDb,
    authority,
    frames: accumulator.frames,
    observedAlternativesMax: accumulator.observedAlternativesMax,
    observedAlternativePairs: accumulator.observedAlternativePairs.size,
    eligibleAlternativesMax: accumulator.eligibleAlternativesMax,
    eligibleFrames: accumulator.eligibleFrames,
    firstEligibleSec: accumulator.firstEligibleSec,
    multipleEligibleFrames: accumulator.multipleEligibleFrames,
    firstMultipleEligibleSec: accumulator.firstMultipleEligibleSec,
    qualifiedAlternativesMax: accumulator.qualifiedAlternativesMax,
    qualifiedFrames: accumulator.qualifiedFrames,
    stableAlternativesMax: accumulator.stableAlternativesMax,
    stableFrames: accumulator.stableFrames,
    maxCandidateMarginDb: accumulator.maxCandidateMarginDb,
    triggerSatisfiedFrames: accumulator.triggerSatisfiedFrames,
    provisionalLeaderFrames: accumulator.provisionalLeaderFrames,
    selectedFrames: accumulator.selectedFrames,
    decisionCommits: accumulator.decisionCommits,
    replacementCommits: accumulator.replacementCommits,
    firstLeaderSec: accumulator.firstLeaderSec,
    firstSelectedSec: accumulator.firstSelectedSec,
    firstCommitSec: accumulator.firstCommitSec,
    firstReplacementCommitSec: accumulator.firstReplacementCommitSec,
  });
}

function snapshotForOpportunity(
  opportunity: CandidateOpportunity,
  sat: CellModelSat,
  cell: CellCenter,
  pointing: PointingResult,
): SatelliteSnapshot {
  const elevationDeg = finiteOrNull(opportunity.elevation.value) ?? sat.topo.elevationDeg;
  const rangeKm = Math.max(finiteOrNull(opportunity.range.value) ?? sat.altitudeKm, 1e-6);
  return {
    id: sat.id,
    shellId: sat.shellId,
    altitudeKm: sat.altitudeKm,
    latDeg: sat.latDeg,
    lonDeg: sat.lonDeg,
    ecefKm: [0, 0, 0],
    rangeKm,
    elevationDeg,
    azimuthDeg: sat.topo.azimuthDeg,
    beamCellsKm: [{
      beamId: opportunity.key.beamId,
      offsetEastKm: cell.localXKm,
      offsetNorthKm: cell.localYKm,
      scanAngleDeg: finiteOrNull(opportunity.steering.value) ?? pointing.scanAngleDeg,
      beamCenterLatDeg: pointing.centerLatDeg,
      beamCenterLonDeg: pointing.centerLonDeg,
      beamAxisEcefKm: pointing.axisEcefKm,
    }],
  };
}

function collectRatedCandidateSinr(
  observation: MultiCandidateFrameObservation,
): { readonly base: CandidateOpportunitySet; readonly sinrByPair: ReadonlyMap<string, number>; readonly range: { min: number | null; max: number | null } } | null {
  const base = observation.frame.handoverDecisionFrame?.opportunities === undefined
    ? null
    : Object.freeze({
      primaryUeId: observation.frame.sinrLiveCells?.primaryUeId
        ?? observation.frame.perUePositions[0]?.id
        ?? 'primary-ue',
      sourceFrameId: observation.decision.sourceFrameId,
      opportunities: observation.decision.opportunities,
      counts: Object.freeze({
        observed: observation.decision.opportunities.length,
        geometricallyReachable: observation.decision.opportunities.length,
        steeringValid: observation.decision.opportunities.filter(opportunity => (
          gateByCode(opportunity, 'steering')?.result === 'pass'
        )).length,
        scheduledAndIlluminated: observation.decision.opportunities.filter(opportunity => (
          gateByCode(opportunity, 'scheduled-illumination')?.result === 'pass'
        )).length,
        serviceEligible: observation.decision.opportunities.filter(opportunity => (
          opportunity.geometryClass === 'service-eligible'
        )).length,
      }),
    });
  if (base === null) return null;
  const cellFrame = observation.frame.sinrLiveCells;
  const primaryUeId = cellFrame?.primaryUeId ?? observation.frame.perUePositions[0]?.id;
  const primaryPosition = primaryUeId === undefined
    ? undefined
    : observation.frame.perUePositions.find(position => position.id === primaryUeId);
  if (cellFrame === undefined || primaryPosition === undefined) return null;

  const model = observation.cellModel as unknown as ModelInternals;
  const activeAssignments: ActiveBeamAssignment[] = [];
  const activeKeys = new Set<string>();
  for (const beam of cellFrame.illuminatedBeams) {
    if (!beam.serving) continue;
    const assignment = {
      satId: beam.satId,
      beamId: cellLinkBudgetBeamId(beam.cellId),
    };
    const key = `${assignment.satId}:${assignment.beamId}`;
    if (activeKeys.has(key)) continue;
    activeKeys.add(key);
    activeAssignments.push(assignment);
  }
  const satById = new Map<string, CellModelSat>(observation.frame.satellites.map(sat => [sat.id, sat]));
  const snapshots: SatelliteSnapshot[] = [];
  const snapshotKeys = new Set<string>();
  for (const opportunity of base.opportunities) {
    const sat = satById.get(opportunity.key.satelliteId);
    const cellId = cellIdFromLinkBudgetBeamId(opportunity.key.beamId);
    const cell = model.cellLayout.centers.find(candidate => candidate.cellId === cellId);
    if (sat === undefined || cell === undefined) continue;
    const key = candidateLinkKeyString(opportunity.key);
    if (snapshotKeys.has(key)) continue;
    snapshotKeys.add(key);
    const pointing = model.resolveCellBeamPointing.call(
      observation.cellModel,
      sat,
      cell,
      observation.frame.simTimeSec,
    );
    snapshots.push(snapshotForOpportunity(opportunity, sat, cell, pointing));
  }
  if (snapshots.length === 0) return null;
  const uePosition = model.uePosition.call(observation.cellModel, {
    id: primaryPosition.id,
    eastKm: primaryPosition.eastKm,
    northKm: primaryPosition.northKm,
  });
  const ratedOptions = model.linkBudgetOptions.call(
    observation.cellModel,
    activeAssignments,
    observation.frame.simTimeSec,
    false,
  );
  const samples = computeLinkBudget(uePosition, snapshots, ratedOptions);
  const sinrByPair = new Map<string, number>();
  let min: number | null = null;
  let max: number | null = null;
  for (const sample of samples) {
    if (!Number.isFinite(sample.sinrDb)) continue;
    const key = candidateLinkKeyString(candidateLinkKey(sample.satId, sample.beamId));
    sinrByPair.set(key, sample.sinrDb);
    min = min === null ? sample.sinrDb : Math.min(min, sample.sinrDb);
    max = max === null ? sample.sinrDb : Math.max(max, sample.sinrDb);
  }
  return { base, sinrByPair, range: { min, max } };
}

function summarizeRealReport(
  report: MultiCandidateWindowReport,
  thresholdDb: number,
): ComparisonFlowRow {
  const accumulator = makeAccumulator('angle-aware-2w', thresholdDb);
  accumulator.frames = report.decisionFrames;
  accumulator.observedAlternativesMax = report.observedAlternatives.max;
  accumulator.observedAlternativePairs = new Set(Array.from({ length: report.observedAlternatives.uniquePairs }, (_, index) => String(index)));
  accumulator.eligibleAlternativesMax = report.eligible.max;
  accumulator.eligibleFrames = report.eligible.frames;
  accumulator.firstEligibleSec = report.eligible.first?.simTimeSec ?? null;
  accumulator.qualifiedAlternativesMax = report.qualified.max;
  accumulator.qualifiedFrames = report.qualified.frames;
  accumulator.stableAlternativesMax = report.stable.max;
  accumulator.stableFrames = report.stable.frames;
  accumulator.maxCandidateMarginDb = null;
  accumulator.triggerSatisfiedFrames = report.qualified.frames;
  accumulator.provisionalLeaderFrames = report.provisionalLeaderFrames;
  accumulator.selectedFrames = report.selectedFrames;
  accumulator.decisionCommits = report.decisionCommits.length;
  accumulator.replacementCommits = report.decisionCommits.filter(commit => commit.from !== null).length;
  accumulator.firstLeaderSec = report.provisionalLeaderTimes.first?.simTimeSec ?? null;
  accumulator.firstSelectedSec = report.selectedTimes.first?.simTimeSec ?? null;
  accumulator.firstCommitSec = report.decisionCommits[0]?.simTimeSec ?? null;
  accumulator.firstReplacementCommitSec = report.decisionCommits.find(commit => commit.from !== null)?.simTimeSec ?? null;
  accumulator.multipleEligibleFrames = report.multipleEligibleFrames;
  accumulator.firstMultipleEligibleSec = report.firstMultipleEligible?.at.simTimeSec ?? null;
  return rowFromAccumulator(accumulator, 'real-homepage-path');
}

function parseNumberFlag(argv: readonly string[], flag: string, fallback: number): number {
  const index = argv.indexOf(flag);
  if (index < 0) return fallback;
  const raw = argv[index + 1];
  if (raw === undefined) throw new Error(`${flag} requires a numeric value`);
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${flag} must be finite and > 0`);
  return value;
}

function makeRatedEngines(
  thresholdDb: number,
  epochUtcMs: number,
  profile: Profile,
  initialServing: CandidateLinkKey | null,
): HandoverDecisionEngine {
  return new HandoverDecisionEngine({
    episodeId: `diagnostic-rated:${epochUtcMs}:${thresholdDb}`,
    initialServing,
    policy: new SinrOffsetPolicy({
      initialTttSec: profile.handover.triggerTimeSec,
      interTttSec: profile.handover.triggerTimeSec,
      intraTttSec: profile.handover.triggerTimeSec,
      interOffsetDb: profile.handover.offsetDb,
      intraOffsetDb: profile.handover.offsetDb,
    }),
    selectionHoldSec: 1,
    guardSec: profile.handover.pingPongGuardSec,
    candidateAbsenceToleranceSec: 0,
  });
}

export function runMultiCandidateComparison(options: {
  readonly epochUtcMs?: number;
  readonly durationSec?: number;
  readonly stepSec?: number;
  readonly ueCount?: number;
  readonly thresholdsDb?: readonly number[];
} = {}): MultiCandidateComparisonReport {
  const epochUtcMs = options.epochUtcMs ?? DEFAULT_MULTI_CANDIDATE_DIAGNOSTIC_EPOCH_UTC_MS;
  const durationSec = options.durationSec ?? DEFAULT_DURATION_SEC;
  const stepSec = options.stepSec ?? DEFAULT_STEP_SEC;
  const ueCount = Math.max(1, Math.trunc(options.ueCount ?? DEFAULT_UE_COUNT));
  const thresholdsDb = Object.freeze([...(options.thresholdsDb ?? THRESHOLDS)]);
  assert.ok(thresholdsDb.length > 0, 'comparison must include at least one SINR threshold');
  const angleAwareReports = new Map<number, MultiCandidateWindowReport>();
  const ratedAccumulators = new Map<number, FlowAccumulator>();
  const ratedEngines = new Map<number, HandoverDecisionEngine>();
  let previousRatedTimeSec: number | null = null;
  let ratedRangeMin: number | null = null;
  let ratedRangeMax: number | null = null;
  let angleRangeMin: number | null = null;
  let angleRangeMax: number | null = null;
  let anglePowerFirst: number | null = null;
  let anglePowerMin: number | null = null;
  let anglePowerMax: number | null = null;
  const baseThreshold = thresholdsDb[0]!;
  const baseline = runMultiCandidateWindow({
    epochUtcMs,
    durationSec,
    stepSec,
    ueCount,
    sinrThresholdDb: baseThreshold,
    onDecisionFrame: observation => {
      const counterfactual = collectRatedCandidateSinr(observation);
      if (counterfactual === null) return;
      const angleValues = observation.decision.opportunities
        .map(opportunity => finiteOrNull(opportunity.sinr.value))
        .filter((value): value is number => value !== null);
      for (const value of angleValues) {
        angleRangeMin = angleRangeMin === null ? value : Math.min(angleRangeMin, value);
        angleRangeMax = angleRangeMax === null ? value : Math.max(angleRangeMax, value);
      }
      const primaryRecord = observation.frame.sinrLiveCells?.ues.find(record => (
        record.ueId === observation.frame.sinrLiveCells?.primaryUeId
      ));
      const primaryPowerW = finiteOrNull(primaryRecord?.servingLinkSample?.angleAware?.powerW);
      if (primaryPowerW !== null) {
        anglePowerFirst ??= primaryPowerW;
        anglePowerMin = anglePowerMin === null ? primaryPowerW : Math.min(anglePowerMin, primaryPowerW);
        anglePowerMax = anglePowerMax === null ? primaryPowerW : Math.max(anglePowerMax, primaryPowerW);
      }
      if (counterfactual.range.min !== null) {
        ratedRangeMin = ratedRangeMin === null
          ? counterfactual.range.min
          : Math.min(ratedRangeMin, counterfactual.range.min);
      }
      if (counterfactual.range.max !== null) {
        ratedRangeMax = ratedRangeMax === null
          ? counterfactual.range.max
          : Math.max(ratedRangeMax, counterfactual.range.max);
      }
      if (ratedEngines.size === 0) {
        for (const thresholdDb of thresholdsDb) {
          ratedAccumulators.set(thresholdDb, makeAccumulator('rated-power', thresholdDb));
          ratedEngines.set(thresholdDb, makeRatedEngines(
            thresholdDb,
            epochUtcMs,
            profileForEngine,
            observation.decision.serving,
          ));
        }
      }
      const currentDtSec = previousRatedTimeSec === null
        ? 0
        : Math.max(0, observation.frame.simTimeSec - previousRatedTimeSec);
      previousRatedTimeSec = observation.frame.simTimeSec;
      for (const thresholdDb of thresholdsDb) {
        const accumulator = ratedAccumulators.get(thresholdDb)!;
        const engine = ratedEngines.get(thresholdDb)!;
        const ratedSet = rewriteSet(counterfactual.base, counterfactual.sinrByPair, thresholdDb);
        const servingKey = engine.servingLink;
        const serving = servingKey === null
          ? null
          : ratedSet.opportunities.find(opportunity => (
            candidateLinkKeyString(opportunity.key) === candidateLinkKeyString(servingKey)
          )) ?? null;
        if (serving?.sinr.status === 'available' && serving.sinr.value !== null) {
          const maxMargin = ratedSet.opportunities
            .filter(opportunity => (
              candidateLinkKeyString(opportunity.key) !== candidateLinkKeyString(serving.key)
              && gateByCode(opportunity, 'elevation')?.result === 'pass'
              && gateByCode(opportunity, 'steering')?.result === 'pass'
              && gateByCode(opportunity, 'scheduled-illumination')?.result === 'pass'
              && gateByCode(opportunity, 'sinr')?.result === 'pass'
              && opportunity.sinr.status === 'available'
              && opportunity.sinr.value !== null
            ))
            .reduce<number | null>((best, opportunity) => {
              const margin = opportunity.sinr.value! - serving.sinr.value!;
              return best === null ? margin : Math.max(best, margin);
            }, null);
          if (maxMargin !== null) {
            accumulator.maxCandidateMarginDb = accumulator.maxCandidateMarginDb === null
              ? maxMargin
              : Math.max(accumulator.maxCandidateMarginDb, maxMargin);
            if (maxMargin > profileForEngine.handover.offsetDb) accumulator.triggerSatisfiedFrames += 1;
          }
        }
        // The rated lane is a measurement counterfactual, not a second
        // transaction owner. If its diagnostic serving pair leaves the current
        // observed set, mirror the baseline authority's current serving (or
        // detach) before stepping. This prevents a stale initial seed from
        // making every later trigger "unavailable" merely because its source
        // pair disappeared.
        if (
          servingKey !== null
          && serving === null
        ) {
          const baselineServing = observation.decision.serving;
          const baselineServingPresent = baselineServing !== null
            && ratedSet.opportunities.some(opportunity => (
              candidateLinkKeyString(opportunity.key) === candidateLinkKeyString(baselineServing)
            ));
          engine.reset(baselineServingPresent ? baselineServing : null);
        }
        const decision = engine.step(ratedSet, {
          simTimeMs: epochUtcMs + observation.frame.simTimeSec * 1000,
          dtSec: currentDtSec,
          sourceFrameId: ratedSet.sourceFrameId,
          epochToken: `walker:${epochUtcMs}`,
          discontinuity: 'none',
        });
        consumeEngineFrame(accumulator, decision, observation.frame.simTimeSec);
      }
    },
  });
  angleAwareReports.set(baseThreshold, baseline);

  for (const thresholdDb of thresholdsDb.slice(1)) {
    angleAwareReports.set(thresholdDb, runMultiCandidateWindow({
      epochUtcMs,
      durationSec,
      stepSec,
      ueCount,
      sinrThresholdDb: thresholdDb,
    }));
  }

  const angleAwareRows = thresholdsDb.map(thresholdDb => summarizeRealReport(
    angleAwareReports.get(thresholdDb)!,
    thresholdDb,
  ));
  const ratedPowerRows = thresholdsDb.map(thresholdDb => rowFromAccumulator(
    ratedAccumulators.get(thresholdDb) ?? makeAccumulator('rated-power', thresholdDb),
    'decision-engine-only-counterfactual',
  ));
  return Object.freeze({
    profileId: PROFILE_ID,
    epochUtcMs,
    durationSec,
    stepSec,
    ueCount,
    thresholdsDb,
    angleAwareRows: Object.freeze(angleAwareRows),
    ratedPowerRows: Object.freeze(ratedPowerRows),
    ratedCandidateSinrRangeDb: Object.freeze({ min: ratedRangeMin, max: ratedRangeMax }),
    angleAwareCandidateSinrRangeDb: Object.freeze({ min: angleRangeMin, max: angleRangeMax }),
    angleAwarePrimaryPowerRangeW: Object.freeze({
      first: anglePowerFirst,
      min: anglePowerMin,
      max: anglePowerMax,
    }),
    ratedMeasurementEvidence: 'same-frame-same-interference-field-counterfactual',
  });
}

function formatRow(row: ComparisonFlowRow): string {
  return [
    `mode=${row.mode}`,
    `threshold=${row.thresholdDb}dB`,
    `authority=${row.authority}`,
    `observedMax=${row.observedAlternativesMax}`,
    `observedUnique=${row.observedAlternativePairs}`,
    `eligible>=2:max=${row.eligibleAlternativesMax},frames=${row.multipleEligibleFrames},first=${row.firstMultipleEligibleSec ?? 'none'}`,
    `qualified:max=${row.qualifiedAlternativesMax},frames=${row.qualifiedFrames}`,
    `stable:max=${row.stableAlternativesMax},frames=${row.stableFrames}`,
    `maxCandidateMargin=${row.maxCandidateMarginDb?.toFixed(3) ?? 'none'}dB,triggerFrames=${row.triggerSatisfiedFrames}`,
    `leader=${row.provisionalLeaderFrames},first=${row.firstLeaderSec ?? 'none'}`,
    `selected=${row.selectedFrames},first=${row.firstSelectedSec ?? 'none'}`,
    `commits=${row.decisionCommits},replacement=${row.replacementCommits},first=${row.firstReplacementCommitSec ?? 'none'}`,
  ].join(' ');
}

function printReport(report: MultiCandidateComparisonReport): void {
  console.log(`[${DIAG}] profile=${report.profileId} epoch=${new Date(report.epochUtcMs).toISOString()} duration=${report.durationSec}s step=${report.stepSec}s ueCount=${report.ueCount}`);
  console.log(`[${DIAG}] thresholds=${report.thresholdsDb.join(',')}dB`);
  console.log(`[${DIAG}] angle-aware candidate SINR range=[${report.angleAwareCandidateSinrRangeDb.min?.toFixed(3) ?? 'none'},${report.angleAwareCandidateSinrRangeDb.max?.toFixed(3) ?? 'none'}] dB; primary angle-aware power W first/min/max=[${report.angleAwarePrimaryPowerRangeW.first?.toFixed(6) ?? 'none'},${report.angleAwarePrimaryPowerRangeW.min?.toFixed(6) ?? 'none'},${report.angleAwarePrimaryPowerRangeW.max?.toFixed(6) ?? 'none'}] (2 W segment start when no prior state)`);
  console.log(`[${DIAG}] rated-power candidate SINR range=[${report.ratedCandidateSinrRangeDb.min?.toFixed(3) ?? 'none'},${report.ratedCandidateSinrRangeDb.max?.toFixed(3) ?? 'none'}] dB; same-frame/same-active-field measurement, decision-engine-only counterfactual`);
  for (const row of report.angleAwareRows) console.log(`[${DIAG}] ${formatRow(row)}`);
  for (const row of report.ratedPowerRows) console.log(`[${DIAG}] ${formatRow(row)}`);
  console.log(`[${DIAG}] NOTE rated-power rows are not production RF transaction receipts; they isolate measurement/policy effects without changing runtime truth`);
}

// `SinrLiveCellModel` keeps the profile private by design.  The decision
// engine needs only these policy constants; load the same checked-in profile
// used by the real homepage rather than duplicating any policy literal here.
const profileForEngine = loadProfile(PROFILE_ID);

function parseArgs(argv: readonly string[]): { readonly durationSec: number; readonly stepSec: number; readonly ueCount: number } {
  return {
    durationSec: parseNumberFlag(argv, '--duration-sec', DEFAULT_DURATION_SEC),
    stepSec: parseNumberFlag(argv, '--step-sec', DEFAULT_STEP_SEC),
    ueCount: parseNumberFlag(argv, '--ue-count', DEFAULT_UE_COUNT),
  };
}

const isMain = process.argv[1]?.endsWith('diagnose-multi-candidate-comparison.ts') ?? false;
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  printReport(runMultiCandidateComparison(args));
}
