import type {
  ModqnBeamReference,
  ModqnDenseObjectiveQByAction,
  ModqnInvalidActionSentinel,
  ModqnPolicyDiagnostics,
  ModqnRewardVector,
} from './types';
import type { ModqnReplayEnvelopeRow } from './replay-state';
import type { ModqnReplaySourceGapField } from '../replay-source-gaps';

export const MODQN_DENSE_Q_PROOF_SOURCE_GAP_FIELD = 'diagnostics.denseQPolicy' as const;
export const MODQN_DENSE_Q_REQUIRED_TIE_BREAK = 'scalarizedQ-desc-actionOrder-asc' as const;

const SCORE_TIE_EPSILON = 1e-9;

export interface ModqnDenseQObjectiveValues {
  readonly q1Throughput: number;
  readonly q2Handover: number;
  readonly q3LoadBalance: number;
}

export interface ModqnDenseQObjectiveWeights {
  readonly throughput: number;
  readonly handover: number;
  readonly loadBalance: number;
}

export interface ModqnDenseQProofAction {
  readonly actionIndex: number;
  readonly actionLabel: string;
  readonly valid: boolean;
  readonly objectiveQ: ModqnDenseQObjectiveValues;
  readonly exportedScalarizedQ: number | null;
  readonly recomputedScalarizedQ: number;
}

export interface ModqnDenseQProofReady {
  readonly status: 'proof-ready';
  readonly sourceGapField: null;
  readonly actionCount: number;
  readonly validActionCount: number;
  readonly objectiveWeights: ModqnDenseQObjectiveWeights;
  readonly selectedActionIndex: number;
  readonly recomputedSelectedActionIndex: number;
  readonly selectedActionScore: number;
  readonly marginToRunnerUp: number | null;
  readonly tieBreak: typeof MODQN_DENSE_Q_REQUIRED_TIE_BREAK;
  readonly invalidActionSentinel: ModqnInvalidActionSentinel;
  readonly actions: readonly ModqnDenseQProofAction[];
  readonly selfCheck: {
    readonly status: 'passed';
    readonly rule: 'argmax(originalWeights * objectiveQByAction)';
  };
}

export interface ModqnDenseQProofSourceGap {
  readonly status: 'source-gap';
  readonly sourceGapField: typeof MODQN_DENSE_Q_PROOF_SOURCE_GAP_FIELD;
  readonly reasons: readonly string[];
  readonly actionCount: number;
  readonly legacyScalarizedDenseAvailable: boolean;
  readonly topKObjectiveQAvailable: boolean;
}

export type ModqnDenseQProofResult = ModqnDenseQProofReady | ModqnDenseQProofSourceGap;

export interface ModqnDenseQCounterfactualResult {
  readonly selectedActionIndex: number;
  readonly selectedActionScore: number;
  readonly isRecordedSelection: boolean;
  readonly weights: ModqnDenseQObjectiveWeights;
}

export interface BuildModqnDenseQProofInput {
  readonly policyDiagnostics: ModqnPolicyDiagnostics | undefined;
  readonly actionOrder: readonly ModqnBeamReference[];
  readonly decisionActionValidityMask: readonly boolean[];
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function finiteNumberArray(value: unknown): readonly number[] | null {
  return Array.isArray(value)
    && value.length > 0
    && value.every(item => typeof item === 'number' && Number.isFinite(item))
    ? value
    : null;
}

function readComponent(
  objectiveQ: ModqnDenseObjectiveQByAction,
  keys: readonly string[],
): number | null {
  for (const key of keys) {
    const value = finiteNumber(objectiveQ[key]);
    if (value !== null) return value;
  }
  return null;
}

function readObjectiveQ(
  objectiveQ: ModqnDenseObjectiveQByAction,
): ModqnDenseQObjectiveValues | null {
  const q1Throughput = readComponent(objectiveQ, ['q1Throughput', 'r1Throughput', 'throughput']);
  const q2Handover = readComponent(objectiveQ, ['q2Handover', 'r2Handover', 'handover']);
  const q3LoadBalance = readComponent(objectiveQ, ['q3LoadBalance', 'r3LoadBalance', 'loadBalance']);
  if (q1Throughput === null || q2Handover === null || q3LoadBalance === null) return null;
  return { q1Throughput, q2Handover, q3LoadBalance };
}

function readWeight(
  weights: ModqnRewardVector,
  keys: readonly string[],
): number | null {
  for (const key of keys) {
    const value = finiteNumber(weights[key]);
    if (value !== null) return value;
  }
  return null;
}

function readObjectiveWeights(weights: ModqnRewardVector | undefined): ModqnDenseQObjectiveWeights | null {
  if (weights === undefined) return null;
  const throughput = readWeight(weights, ['throughput', 'q1Throughput', 'r1Throughput']);
  const handover = readWeight(weights, ['handover', 'q2Handover', 'r2Handover']);
  const loadBalance = readWeight(weights, ['loadBalance', 'q3LoadBalance', 'r3LoadBalance']);
  if (throughput === null || handover === null || loadBalance === null) return null;
  return { throughput, handover, loadBalance };
}

function scoreObjectiveQ(
  objectiveQ: ModqnDenseQObjectiveValues,
  weights: ModqnDenseQObjectiveWeights,
): number {
  return (weights.throughput * objectiveQ.q1Throughput)
    + (weights.handover * objectiveQ.q2Handover)
    + (weights.loadBalance * objectiveQ.q3LoadBalance);
}

function actionLabel(action: ModqnBeamReference, fallbackIndex: number): string {
  return action.beamId || `${action.satId}-beam-${action.localBeamIndex}` || `action-${fallbackIndex}`;
}

function sourceGap(
  reasons: readonly string[],
  policyDiagnostics: ModqnPolicyDiagnostics | undefined,
  actionCount: number,
): ModqnDenseQProofSourceGap {
  const denseActionScores = finiteNumberArray(policyDiagnostics?.denseActionScores);
  return {
    status: 'source-gap',
    sourceGapField: MODQN_DENSE_Q_PROOF_SOURCE_GAP_FIELD,
    reasons,
    actionCount,
    legacyScalarizedDenseAvailable: denseActionScores !== null,
    topKObjectiveQAvailable: policyDiagnostics?.topCandidates?.some(candidate => candidate.objectiveQ !== undefined) === true,
  };
}

function findBestValidAction(actions: readonly ModqnDenseQProofAction[]): number | null {
  let bestIndex: number | null = null;
  let bestScore = -Infinity;
  for (const action of actions) {
    if (!action.valid) continue;
    const score = action.recomputedScalarizedQ;
    if (
      bestIndex === null
      || score > bestScore + SCORE_TIE_EPSILON
      || (Math.abs(score - bestScore) <= SCORE_TIE_EPSILON && action.actionIndex < bestIndex)
    ) {
      bestIndex = action.actionIndex;
      bestScore = score;
    }
  }
  return bestIndex;
}

function marginToRunnerUp(
  actions: readonly ModqnDenseQProofAction[],
  selectedActionIndex: number,
): number | null {
  const validScores = actions
    .filter(action => action.valid)
    .map(action => action.recomputedScalarizedQ)
    .sort((a, b) => b - a);
  if (validScores.length < 2) return null;
  const selected = actions[selectedActionIndex]?.recomputedScalarizedQ;
  return selected === undefined ? null : selected - validScores[1];
}

export function buildModqnDenseQProof(
  input: BuildModqnDenseQProofInput,
): ModqnDenseQProofResult {
  const { policyDiagnostics, actionOrder, decisionActionValidityMask } = input;
  const actionCount = actionOrder.length;
  const reasons: string[] = [];

  if (actionCount === 0) reasons.push('producer action order is absent');
  if (policyDiagnostics === undefined) {
    return sourceGap(['policyDiagnostics are absent', ...reasons], policyDiagnostics, actionCount);
  }

  const objectiveQByAction = policyDiagnostics.objectiveQByAction;
  const scalarizedQByAction = policyDiagnostics.scalarizedQByAction;
  const objectiveWeights = readObjectiveWeights(policyDiagnostics.objectiveWeights);
  const rawSelectedActionIndex = policyDiagnostics.selectedActionIndex;
  const selectedActionIndex = typeof rawSelectedActionIndex === 'number'
    && Number.isInteger(rawSelectedActionIndex)
    ? rawSelectedActionIndex
    : null;
  const tieBreak = policyDiagnostics.tieBreak;
  const invalidActionSentinel = policyDiagnostics.invalidActionSentinel;

  if (!Array.isArray(objectiveQByAction)) reasons.push('objectiveQByAction is absent');
  if (!Array.isArray(scalarizedQByAction)) reasons.push('scalarizedQByAction is absent');
  if (objectiveWeights === null) reasons.push('objectiveWeights are absent or incomplete');
  if (selectedActionIndex === null) reasons.push('selectedActionIndex is absent');
  if (tieBreak !== MODQN_DENSE_Q_REQUIRED_TIE_BREAK) {
    reasons.push(`tieBreak must be ${MODQN_DENSE_Q_REQUIRED_TIE_BREAK}`);
  }
  if (invalidActionSentinel === undefined) reasons.push('invalidActionSentinel is absent');
  if (decisionActionValidityMask.length !== actionCount) {
    reasons.push('decisionActionValidityMask length does not match action order');
  }
  if (Array.isArray(objectiveQByAction) && objectiveQByAction.length !== actionCount) {
    reasons.push('objectiveQByAction does not cover the full action order');
  }
  if (Array.isArray(scalarizedQByAction) && scalarizedQByAction.length !== actionCount) {
    reasons.push('scalarizedQByAction does not cover the full action order');
  }
  if (
    selectedActionIndex !== null
    && (selectedActionIndex < 0 || selectedActionIndex >= actionCount)
  ) {
    reasons.push('selectedActionIndex is outside action order');
  }

  if (
    reasons.length > 0
    || !Array.isArray(objectiveQByAction)
    || !Array.isArray(scalarizedQByAction)
    || objectiveWeights === null
    || selectedActionIndex === null
    || tieBreak !== MODQN_DENSE_Q_REQUIRED_TIE_BREAK
    || invalidActionSentinel === undefined
  ) {
    return sourceGap(reasons, policyDiagnostics, actionCount);
  }
  const selectedIndex = selectedActionIndex;

  const actions: ModqnDenseQProofAction[] = [];
  for (let index = 0; index < actionCount; index++) {
    const rawObjectiveQ = objectiveQByAction[index];
    if (rawObjectiveQ === undefined) {
      reasons.push(`objectiveQByAction[${index}] is missing`);
      continue;
    }
    const objectiveQ = readObjectiveQ(rawObjectiveQ);
    if (objectiveQ === null) {
      reasons.push(`objectiveQByAction[${index}] is missing Q1/Q2/Q3`);
      continue;
    }
    const valid = decisionActionValidityMask[index] === true;
    const exportedScalarizedQ = valid ? finiteNumber(scalarizedQByAction[index]) : null;
    if (valid && exportedScalarizedQ === null) {
      reasons.push(`scalarizedQByAction[${index}] is not finite for a valid action`);
      continue;
    }
    actions.push({
      actionIndex: index,
      actionLabel: actionLabel(actionOrder[index] as ModqnBeamReference, index),
      valid,
      objectiveQ,
      exportedScalarizedQ,
      recomputedScalarizedQ: scoreObjectiveQ(objectiveQ, objectiveWeights),
    });
  }

  if (actions.length !== actionCount) reasons.push('not every action has dense-Q proof data');
  const validActionCount = actions.filter(action => action.valid).length;
  if (validActionCount === 0) reasons.push('no valid action exists under the decision mask');
  if (decisionActionValidityMask[selectedIndex] !== true) {
    reasons.push('selectedActionIndex is not valid under the decision mask');
  }

  const recomputedSelectedActionIndex = findBestValidAction(actions);
  if (recomputedSelectedActionIndex === null) {
    reasons.push('original-weight argmax has no valid action');
  } else if (recomputedSelectedActionIndex !== selectedIndex) {
    reasons.push('original-weight self-check does not reproduce selectedActionIndex');
  }

  if (reasons.length > 0 || recomputedSelectedActionIndex === null) {
    return sourceGap(reasons, policyDiagnostics, actionCount);
  }

  return {
    status: 'proof-ready',
    sourceGapField: null,
    actionCount,
    validActionCount,
    objectiveWeights,
    selectedActionIndex: selectedIndex,
    recomputedSelectedActionIndex,
    selectedActionScore: actions[selectedIndex]?.recomputedScalarizedQ ?? Number.NaN,
    marginToRunnerUp: marginToRunnerUp(actions, selectedIndex),
    tieBreak,
    invalidActionSentinel,
    actions,
    selfCheck: {
      status: 'passed',
      rule: 'argmax(originalWeights * objectiveQByAction)',
    },
  };
}

export function buildModqnDenseQProofFromReplayRow(
  row: ModqnReplayEnvelopeRow,
): ModqnDenseQProofResult {
  const diagnostics = row.producerTruth.policyDiagnostics;
  // The dense-Q arrays (objectiveQByAction / scalarizedQByAction / the per-action
  // mask) are indexed by the policy's action catalog
  // (policyDiagnostics.candidateActionOrder, length A), NOT the physical beam
  // list (producerTruth.candidateActionOrder = beamStates). Under a windowed
  // action space (L_w x cells) those lengths differ (e.g. 28 catalog vs 144
  // physical beams) and feeding beamStates source-gaps every row. Prefer the
  // catalog when the producer exports it; legacy bundles without a dense catalog
  // fall back to the physical order and stay source-gap (no objectiveQByAction).
  const actionOrder = diagnostics?.candidateActionOrder
    ?? row.producerTruth.candidateActionOrder;
  return buildModqnDenseQProof({
    policyDiagnostics: diagnostics,
    actionOrder,
    decisionActionValidityMask: row.producerTruth.decisionActionValidityMask,
  });
}

export function isModqnDenseQProofReady(
  result: ModqnDenseQProofResult,
): result is ModqnDenseQProofReady {
  return result.status === 'proof-ready';
}

export function rerankModqnDenseQProof(
  proof: ModqnDenseQProofReady,
  weights: ModqnDenseQObjectiveWeights,
): ModqnDenseQCounterfactualResult {
  let selectedActionIndex = proof.selectedActionIndex;
  let selectedActionScore = -Infinity;
  for (const action of proof.actions) {
    if (!action.valid) continue;
    const score = scoreObjectiveQ(action.objectiveQ, weights);
    if (
      score > selectedActionScore + SCORE_TIE_EPSILON
      || (Math.abs(score - selectedActionScore) <= SCORE_TIE_EPSILON && action.actionIndex < selectedActionIndex)
    ) {
      selectedActionIndex = action.actionIndex;
      selectedActionScore = score;
    }
  }
  return {
    selectedActionIndex,
    selectedActionScore,
    isRecordedSelection: selectedActionIndex === proof.selectedActionIndex,
    weights,
  };
}

export function denseQProofSourceGapField(): ModqnReplaySourceGapField {
  return MODQN_DENSE_Q_PROOF_SOURCE_GAP_FIELD;
}
