import type { GoldenFlowBeatId, GoldenFlowTruth } from './goldenFlowDirector';

export type GoldenFlowHandoverPhase =
  | 'comparing'
  | 'threshold-met'
  | 'ttt-running'
  | 'ttt-complete'
  | 'committing'
  | 'committed';

export type GoldenFlowHandoverTransferStage =
  | 'not-started'
  | 'release-source'
  | 'switch-owner'
  | 'establish-target'
  | 'stable-target';

export const GOLDEN_FLOW_HANDOVER_SWITCH_PROGRESS = 0.55;

export interface GoldenFlowHandoverDecisionFrame {
  readonly phase: GoldenFlowHandoverPhase;
  readonly servingSinrDb: number;
  readonly candidateSinrDb: number;
  readonly deltaDb: number;
  readonly thresholdDb: number;
  readonly thresholdMet: boolean;
  readonly tttElapsedSec: number;
  readonly tttSec: number;
  readonly tttComplete: boolean;
  readonly commitProgress: number;
  readonly transferStage: GoldenFlowHandoverTransferStage;
  readonly sourceReleaseProgress: number;
  readonly targetEstablishProgress: number;
  readonly committed: boolean;
  /** Exactly one spacecraft owns the service link in the teaching scene. */
  readonly activeService: 'source' | 'target';
  readonly servingLinkStrength: number;
  readonly candidateLinkStrength: number;
  /** Candidate quality is measured before handover, but is not a service link. */
  readonly candidateMeasurementStrength: number;
}

export interface GoldenFlowCandidateComparisonEntry {
  readonly marker: 'B1' | 'B2' | 'B3';
  readonly satelliteName: string;
  readonly sinrDb: number;
  readonly deltaDb: number;
  readonly rank: number;
  readonly selected: boolean;
  readonly thresholdMet: boolean;
}

export interface GoldenFlowCandidateComparisonFrame {
  readonly entries: readonly GoldenFlowCandidateComparisonEntry[];
  readonly selectedMarker: GoldenFlowCandidateComparisonEntry['marker'];
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function ease(value: number): number {
  const bounded = clamp01(value);
  return bounded * bounded * (3 - 2 * bounded);
}

function progressBetween(value: number, start: number, end: number): number {
  if (end <= start) return value >= end ? 1 : 0;
  return clamp01((value - start) / (end - start));
}

/**
 * Candidate-pool comparison used by the default Starlink teaching scenario.
 * Only B1 is promoted into qualification; B2/B3 are controlled alternatives
 * that make the selection step visible and are never presented as TLE-derived
 * SINR samples. Source-backed variants remain single-candidate and do not gain
 * invented alternatives.
 */
export function buildGoldenFlowCandidateComparisonFrame(
  progress: number,
  truth: GoldenFlowTruth,
): GoldenFlowCandidateComparisonFrame {
  const decision = buildGoldenFlowHandoverDecisionFrame('candidate', progress, truth);
  const sourceSinrDb = decision.servingSinrDb;
  const actualTarget: GoldenFlowCandidateComparisonEntry = Object.freeze({
    marker: 'B1',
    satelliteName: truth.targetSatelliteName,
    sinrDb: decision.candidateSinrDb,
    deltaDb: decision.deltaDb,
    rank: 1,
    selected: true,
    thresholdMet: decision.deltaDb >= decision.thresholdDb,
  });
  const entries: readonly GoldenFlowCandidateComparisonEntry[] = truth.eventKind === 'teaching-handover'
    ? Object.freeze([
      actualTarget,
      Object.freeze({
        marker: 'B2' as const,
        satelliteName: 'STARLINK C',
        sinrDb: sourceSinrDb + 1.4,
        deltaDb: 1.4,
        rank: 2,
        selected: false,
        thresholdMet: false,
      }),
      Object.freeze({
        marker: 'B3' as const,
        satelliteName: 'STARLINK D',
        sinrDb: sourceSinrDb - 0.5,
        deltaDb: -0.5,
        rank: 3,
        selected: false,
        thresholdMet: false,
      }),
    ])
    : Object.freeze([actualTarget]);
  return Object.freeze({ entries, selectedMarker: 'B1' });
}

/**
 * One coherent presentation frame shared by the Act 4 scene and its readout.
 * The Starlink default is explicitly a controlled teaching scenario.  The
 * optional OneWeb route still uses source anchors; interpolation is only a
 * visual bridge between those event states, never a claim of live telemetry.
 */
export function buildGoldenFlowHandoverDecisionFrame(
  beat: GoldenFlowBeatId,
  progress: number,
  truth: GoldenFlowTruth,
): GoldenFlowHandoverDecisionFrame {
  const p = ease(progress);
  const thresholdDb = truth.offsetDb;
  const finalDeltaDb = truth.deltaSinrDb ?? thresholdDb + 0.4;
  const finalServingSinrDb = truth.sourceSinrDb ?? -8.2;
  let deltaDb = finalDeltaDb;
  let tttElapsedSec = 0;
  let commitProgress = 0;
  let transferStage: GoldenFlowHandoverTransferStage = 'not-started';
  let sourceReleaseProgress = 0;
  let targetEstablishProgress = 0;
  let activeService: GoldenFlowHandoverDecisionFrame['activeService'] = 'source';
  let phase: GoldenFlowHandoverPhase = 'threshold-met';
  const sourceFirstAnchorDeltaDb = truth.qualification[0]?.deltaDb ?? finalDeltaDb;
  const sourceLastAnchorDeltaDb = truth.qualification[truth.qualification.length - 1]?.deltaDb ?? finalDeltaDb;
  const isControlledTeachingScenario = truth.eventKind === 'teaching-handover';

  if (beat === 'candidate') {
    // B1 is already the selected best candidate when this beat begins. Keep it
    // above the controlled B2 value (+1.4 dB) at every visible frame so the
    // ranking and displayed SINR never contradict one another.
    deltaDb = isControlledTeachingScenario
      ? 1.8 + (finalDeltaDb - 1.8) * p
      : sourceFirstAnchorDeltaDb;
    phase = deltaDb >= thresholdDb ? 'threshold-met' : 'comparing';
  } else if (beat === 'qualification') {
    deltaDb = isControlledTeachingScenario
      ? thresholdDb + (finalDeltaDb - thresholdDb) * p
      : sourceFirstAnchorDeltaDb;
    phase = 'threshold-met';
  } else if (beat === 'ttt') {
    // Source-backed events expose discrete qualification anchors, not a
    // fabricated per-frame SINR trace. Hold the first anchor during the policy
    // timer and reveal the final anchor only when TTT completes.
    deltaDb = isControlledTeachingScenario
      ? Math.max(thresholdDb, finalDeltaDb + Math.sin(p * Math.PI) * 0.08)
      : p >= 1 ? sourceLastAnchorDeltaDb : sourceFirstAnchorDeltaDb;
    tttElapsedSec = truth.tttSec * p;
    phase = p >= 1 ? 'ttt-complete' : 'ttt-running';
  } else if (beat === 'trace') {
    deltaDb = isControlledTeachingScenario ? finalDeltaDb : sourceLastAnchorDeltaDb;
    tttElapsedSec = truth.tttSec;
    phase = 'ttt-complete';
  } else if (beat === 'commit') {
    tttElapsedSec = truth.tttSec;
    commitProgress = p;
    sourceReleaseProgress = progressBetween(p, 0.12, GOLDEN_FLOW_HANDOVER_SWITCH_PROGRESS);
    targetEstablishProgress = progressBetween(p, GOLDEN_FLOW_HANDOVER_SWITCH_PROGRESS, 0.9);
    // The baseline handover is break-before-make, not DAPS.  Switch ownership
    // at one explicit decision point; never cross-fade two service links.
    activeService = p >= GOLDEN_FLOW_HANDOVER_SWITCH_PROGRESS ? 'target' : 'source';
    transferStage = p < 0.12
      ? 'not-started'
      : p < GOLDEN_FLOW_HANDOVER_SWITCH_PROGRESS
        ? 'release-source'
        : p < 0.64
          ? 'switch-owner'
          : p < 0.9
            ? 'establish-target'
            : 'stable-target';
    phase = activeService === 'target' ? 'committed' : 'committing';
  } else if (beat === 'receipt' || beat === 'new-normal') {
    tttElapsedSec = truth.tttSec;
    commitProgress = 1;
    sourceReleaseProgress = 1;
    targetEstablishProgress = 1;
    transferStage = 'stable-target';
    activeService = 'target';
    phase = 'committed';
  }

  const thresholdMet = deltaDb >= thresholdDb;
  const tttComplete = tttElapsedSec >= truth.tttSec;
  const committed = phase === 'committed';
  const candidateAdvantage = clamp01((deltaDb - 0.5) / Math.max(0.5, finalDeltaDb - 0.5));
  const servingBeforeCommit = 0.82 - candidateAdvantage * 0.28;
  const candidateMeasurementStrength = activeService === 'source'
    ? 0.42 + candidateAdvantage * 0.54
    : 0;
  const servingLinkStrength = activeService === 'source'
    ? servingBeforeCommit * (beat === 'commit' ? 1 - sourceReleaseProgress * 0.82 : 1)
    : 0;
  const candidateLinkStrength = activeService === 'target'
    ? beat === 'commit' ? 0.18 + targetEstablishProgress * 0.82 : 1
    : 0;

  return Object.freeze({
    phase,
    servingSinrDb: finalServingSinrDb,
    candidateSinrDb: finalServingSinrDb + deltaDb,
    deltaDb,
    thresholdDb,
    thresholdMet,
    tttElapsedSec,
    tttSec: truth.tttSec,
    tttComplete,
    commitProgress,
    transferStage,
    sourceReleaseProgress,
    targetEstablishProgress,
    committed,
    activeService,
    servingLinkStrength,
    candidateLinkStrength,
    candidateMeasurementStrength,
  });
}
