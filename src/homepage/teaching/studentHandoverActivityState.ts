import {
  STUDENT_HANDOVER_ACTIVITY_CONTRACT,
  STUDENT_HANDOVER_ACTIVITY_ID,
  STUDENT_HANDOVER_ACTIVITY_RESET_IDENTITY,
  STUDENT_HANDOVER_ACTIVITY_SCHEMA_VERSION,
  STUDENT_HANDOVER_ACTIVITY_VERSION,
  STUDENT_HANDOVER_COMPARABLE_EVIDENCE_CLAIMS,
  STUDENT_HANDOVER_EVIDENCE_CLAIMS,
  STUDENT_HANDOVER_EXPLANATION_CHOICES,
  STUDENT_HANDOVER_OBSERVATION_CHECKPOINTS,
  STUDENT_HANDOVER_PREDICTION_CHOICES,
  studentHandoverCheckpointAt,
  type StudentHandoverActivityStep,
  type StudentHandoverCheckpointId,
  type StudentHandoverEvidenceClaimId,
  type StudentHandoverExplanationChoice,
  type StudentHandoverPredictionChoice,
} from './studentHandoverActivityContract';

export interface StudentHandoverObservationRecord {
  readonly checkpointId: StudentHandoverCheckpointId;
  readonly evidenceClaims: readonly StudentHandoverEvidenceClaimId[];
}

export interface StudentHandoverCompletionReceipt {
  readonly schemaVersion: typeof STUDENT_HANDOVER_ACTIVITY_SCHEMA_VERSION;
  readonly activityId: typeof STUDENT_HANDOVER_ACTIVITY_ID;
  readonly activityVersion: typeof STUDENT_HANDOVER_ACTIVITY_VERSION;
  readonly scenarioId: typeof STUDENT_HANDOVER_ACTIVITY_CONTRACT.scenarioId;
  readonly scenarioVersion: typeof STUDENT_HANDOVER_ACTIVITY_CONTRACT.scenarioVersion;
  readonly segment: 'intra';
  readonly runId: string;
  readonly prediction: StudentHandoverPredictionChoice;
  readonly explanation: StudentHandoverExplanationChoice;
  readonly evidenceClaims: readonly StudentHandoverEvidenceClaimId[];
  readonly observedCheckpointIds: readonly StudentHandoverCheckpointId[];
  readonly receiptId: string;
}

export interface StudentHandoverActivityState {
  readonly active: boolean;
  readonly step: StudentHandoverActivityStep;
  readonly runId: string | null;
  readonly selectedPrediction: StudentHandoverPredictionChoice | null;
  readonly predictionLocked: boolean;
  readonly pendingCheckpointId: StudentHandoverCheckpointId | null;
  readonly observations: readonly StudentHandoverObservationRecord[];
  readonly selectedExplanation: StudentHandoverExplanationChoice | null;
  readonly selectedEvidenceClaims: readonly StudentHandoverEvidenceClaimId[];
  readonly completionReceipt: StudentHandoverCompletionReceipt | null;
  readonly resetIdentity: typeof STUDENT_HANDOVER_ACTIVITY_RESET_IDENTITY;
}

export type StudentHandoverActivityAction =
  | { readonly type: 'activate' }
  | { readonly type: 'deactivate' }
  | { readonly type: 'select-prediction'; readonly prediction: StudentHandoverPredictionChoice }
  | { readonly type: 'lock-prediction'; readonly runId: string }
  | { readonly type: 'begin-observe' }
  | { readonly type: 'request-checkpoint'; readonly checkpointId: StudentHandoverCheckpointId }
  | {
    readonly type: 'record-observation';
    readonly observation: StudentHandoverObservationRecord;
  }
  | { readonly type: 'finish-observe' }
  | { readonly type: 'select-explanation'; readonly explanation: StudentHandoverExplanationChoice }
  | { readonly type: 'toggle-evidence-claim'; readonly claim: StudentHandoverEvidenceClaimId }
  | { readonly type: 'submit-explanation' }
  | { readonly type: 'reset' };

export interface StudentHandoverActivityTransition {
  readonly state: StudentHandoverActivityState;
  readonly accepted: boolean;
  readonly reason: string;
}

function freezeObservation(
  observation: StudentHandoverObservationRecord,
): StudentHandoverObservationRecord {
  return Object.freeze({
    checkpointId: observation.checkpointId,
    evidenceClaims: Object.freeze([...observation.evidenceClaims]),
  });
}

function freezeReceipt(
  receipt: StudentHandoverCompletionReceipt | null,
): StudentHandoverCompletionReceipt | null {
  if (receipt === null) return null;
  return Object.freeze({
    ...receipt,
    evidenceClaims: Object.freeze([...receipt.evidenceClaims]),
    observedCheckpointIds: Object.freeze([...receipt.observedCheckpointIds]),
  });
}

function freezeState(
  state: Omit<StudentHandoverActivityState, 'resetIdentity'>,
): StudentHandoverActivityState {
  return Object.freeze({
    ...state,
    observations: Object.freeze(state.observations.map(freezeObservation)),
    selectedEvidenceClaims: Object.freeze([...state.selectedEvidenceClaims]),
    completionReceipt: freezeReceipt(state.completionReceipt),
    resetIdentity: STUDENT_HANDOVER_ACTIVITY_RESET_IDENTITY,
  });
}

function cleanState(active: boolean): StudentHandoverActivityState {
  return freezeState({
    active,
    step: 'predict',
    runId: null,
    selectedPrediction: null,
    predictionLocked: false,
    pendingCheckpointId: null,
    observations: [],
    selectedExplanation: null,
    selectedEvidenceClaims: [],
    completionReceipt: null,
  });
}

export function createInactiveStudentHandoverActivityState(): StudentHandoverActivityState {
  return cleanState(false);
}

export function createActiveStudentHandoverActivityState(): StudentHandoverActivityState {
  return cleanState(true);
}

function accept(
  state: StudentHandoverActivityState,
  reason: string,
): StudentHandoverActivityTransition {
  return Object.freeze({ state, accepted: true, reason });
}

function reject(
  state: StudentHandoverActivityState,
  reason: string,
): StudentHandoverActivityTransition {
  return Object.freeze({ state, accepted: false, reason });
}

function includesPrediction(value: StudentHandoverPredictionChoice): boolean {
  return STUDENT_HANDOVER_PREDICTION_CHOICES.includes(value);
}

function includesExplanation(value: StudentHandoverExplanationChoice): boolean {
  return STUDENT_HANDOVER_EXPLANATION_CHOICES.includes(value);
}

function includesEvidenceClaim(value: StudentHandoverEvidenceClaimId): boolean {
  return STUDENT_HANDOVER_EVIDENCE_CLAIMS.includes(value);
}

function normalizedSelectedClaims(
  claims: readonly StudentHandoverEvidenceClaimId[],
): readonly StudentHandoverEvidenceClaimId[] {
  const selected = new Set(claims);
  return Object.freeze(STUDENT_HANDOVER_EVIDENCE_CLAIMS.filter(claim => selected.has(claim)));
}

function observationClaimsAreValid(
  claims: readonly StudentHandoverEvidenceClaimId[],
): boolean {
  if (claims.length === 0 || claims.some(claim => !includesEvidenceClaim(claim))) return false;
  return normalizedSelectedClaims(claims).length === claims.length;
}

function hasComparableEvidence(
  claims: readonly StudentHandoverEvidenceClaimId[],
): boolean {
  const comparable = new Set<StudentHandoverEvidenceClaimId>(
    STUDENT_HANDOVER_COMPARABLE_EVIDENCE_CLAIMS,
  );
  return claims.some(claim => comparable.has(claim));
}

export function reduceStudentHandoverActivity(
  state: StudentHandoverActivityState,
  action: StudentHandoverActivityAction,
): StudentHandoverActivityTransition {
  if (action.type === 'activate') {
    if (state.active) return reject(state, 'activity-already-active');
    return accept(createActiveStudentHandoverActivityState(), 'activity-activated');
  }

  if (action.type === 'deactivate') {
    const cleanPredict = state.active
      && state.step === 'predict'
      && state.runId === null
      && !state.predictionLocked
      && state.observations.length === 0
      && state.completionReceipt === null;
    if (!cleanPredict) return reject(state, 'exit-requires-clean-predict');
    return accept(createInactiveStudentHandoverActivityState(), 'activity-deactivated');
  }

  if (!state.active) return reject(state, 'activity-inactive');

  if (action.type === 'select-prediction') {
    if (state.step !== 'predict') return reject(state, 'prediction-only-in-predict');
    if (state.predictionLocked) return reject(state, 'prediction-locked');
    if (!includesPrediction(action.prediction)) return reject(state, 'unknown-prediction');
    return accept(freezeState({
      ...state,
      selectedPrediction: action.prediction,
    }), 'prediction-selected');
  }

  if (action.type === 'lock-prediction') {
    if (state.step !== 'predict') return reject(state, 'lock-only-from-predict');
    if (state.predictionLocked) return reject(state, 'prediction-already-locked');
    if (state.selectedPrediction === null) return reject(state, 'prediction-required');
    if (action.runId.trim().length === 0) return reject(state, 'run-id-required');
    return accept(freezeState({
      ...state,
      step: 'operate',
      runId: action.runId,
      predictionLocked: true,
    }), 'prediction-locked');
  }

  if (action.type === 'begin-observe') {
    if (state.step !== 'operate') return reject(state, 'operate-required');
    const first = studentHandoverCheckpointAt(0);
    if (first === null) return reject(state, 'checkpoint-contract-empty');
    return accept(freezeState({
      ...state,
      step: 'observe',
      pendingCheckpointId: first.id,
    }), 'bounded-observation-started');
  }

  if (action.type === 'request-checkpoint') {
    if (state.step !== 'observe') return reject(state, 'observe-required');
    if (state.pendingCheckpointId !== null) return reject(state, 'checkpoint-already-pending');
    const expected = studentHandoverCheckpointAt(state.observations.length);
    if (expected === null) return reject(state, 'all-checkpoints-observed');
    if (action.checkpointId !== expected.id) return reject(state, 'checkpoint-order-violation');
    return accept(freezeState({
      ...state,
      pendingCheckpointId: action.checkpointId,
    }), 'checkpoint-requested');
  }

  if (action.type === 'record-observation') {
    if (state.step !== 'observe') return reject(state, 'observe-required');
    if (state.pendingCheckpointId === null) return reject(state, 'no-checkpoint-pending');
    if (action.observation.checkpointId !== state.pendingCheckpointId) {
      return reject(state, 'observation-checkpoint-mismatch');
    }
    const expected = studentHandoverCheckpointAt(state.observations.length);
    if (expected === null || expected.id !== action.observation.checkpointId) {
      return reject(state, 'observation-order-violation');
    }
    if (!observationClaimsAreValid(action.observation.evidenceClaims)) {
      return reject(state, 'observation-evidence-invalid');
    }
    return accept(freezeState({
      ...state,
      pendingCheckpointId: null,
      observations: [...state.observations, action.observation],
    }), 'observation-recorded');
  }

  if (action.type === 'finish-observe') {
    if (state.step !== 'observe') return reject(state, 'observe-required');
    if (state.pendingCheckpointId !== null) return reject(state, 'checkpoint-still-pending');
    if (state.observations.length !== STUDENT_HANDOVER_OBSERVATION_CHECKPOINTS.length) {
      return reject(state, 'all-checkpoints-required');
    }
    return accept(freezeState({
      ...state,
      step: 'explain',
    }), 'observation-complete');
  }

  if (action.type === 'select-explanation') {
    if (state.step !== 'explain') return reject(state, 'explain-required');
    if (!includesExplanation(action.explanation)) return reject(state, 'unknown-explanation');
    return accept(freezeState({
      ...state,
      selectedExplanation: action.explanation,
    }), 'explanation-selected');
  }

  if (action.type === 'toggle-evidence-claim') {
    if (state.step !== 'explain') return reject(state, 'explain-required');
    if (!includesEvidenceClaim(action.claim)) return reject(state, 'unknown-evidence-claim');
    const observedClaims = new Set(
      state.observations.flatMap(observation => observation.evidenceClaims),
    );
    if (!observedClaims.has(action.claim)) return reject(state, 'claim-not-observed');
    const selected = new Set(state.selectedEvidenceClaims);
    if (selected.has(action.claim)) selected.delete(action.claim);
    else selected.add(action.claim);
    return accept(freezeState({
      ...state,
      selectedEvidenceClaims: normalizedSelectedClaims([...selected]),
    }), 'evidence-selection-updated');
  }

  if (action.type === 'submit-explanation') {
    if (state.step !== 'explain') return reject(state, 'explain-required');
    if (state.selectedExplanation === null) return reject(state, 'explanation-required');
    if (state.selectedEvidenceClaims.length < STUDENT_HANDOVER_ACTIVITY_CONTRACT.minimumEvidenceClaims) {
      return reject(state, 'evidence-claim-required');
    }
    if (!hasComparableEvidence(state.selectedEvidenceClaims)) {
      return reject(state, 'comparable-evidence-required');
    }
    if (state.runId === null || state.selectedPrediction === null) {
      return reject(state, 'locked-run-identity-required');
    }
    const observedCheckpointIds = Object.freeze(
      state.observations.map(observation => observation.checkpointId),
    );
    const receipt: StudentHandoverCompletionReceipt = Object.freeze({
      schemaVersion: STUDENT_HANDOVER_ACTIVITY_SCHEMA_VERSION,
      activityId: STUDENT_HANDOVER_ACTIVITY_ID,
      activityVersion: STUDENT_HANDOVER_ACTIVITY_VERSION,
      scenarioId: STUDENT_HANDOVER_ACTIVITY_CONTRACT.scenarioId,
      scenarioVersion: STUDENT_HANDOVER_ACTIVITY_CONTRACT.scenarioVersion,
      segment: STUDENT_HANDOVER_ACTIVITY_CONTRACT.segment,
      runId: state.runId,
      prediction: state.selectedPrediction,
      explanation: state.selectedExplanation,
      evidenceClaims: Object.freeze([...state.selectedEvidenceClaims]),
      observedCheckpointIds,
      receiptId: `${STUDENT_HANDOVER_ACTIVITY_ID}:${state.runId}:complete`,
    });
    return accept(freezeState({
      ...state,
      step: 'complete',
      completionReceipt: receipt,
    }), 'activity-complete');
  }

  if (action.type === 'reset') {
    if (state.step !== 'complete') return reject(state, 'reset-only-after-complete');
    return accept(createActiveStudentHandoverActivityState(), 'activity-reset');
  }

  return reject(state, 'unknown-action');
}

export interface StudentHandoverNormalizedResetState {
  readonly active: boolean;
  readonly step: StudentHandoverActivityStep;
  readonly runId: string | null;
  readonly prediction: StudentHandoverPredictionChoice | null;
  readonly predictionLocked: boolean;
  readonly pendingCheckpointId: StudentHandoverCheckpointId | null;
  readonly observationCount: number;
  readonly explanation: StudentHandoverExplanationChoice | null;
  readonly evidenceClaimCount: number;
  readonly receiptId: string | null;
  readonly resetIdentity: typeof STUDENT_HANDOVER_ACTIVITY_RESET_IDENTITY;
}

export function normalizeStudentHandoverResetState(
  state: StudentHandoverActivityState,
): StudentHandoverNormalizedResetState {
  return Object.freeze({
    active: state.active,
    step: state.step,
    runId: state.runId,
    prediction: state.selectedPrediction,
    predictionLocked: state.predictionLocked,
    pendingCheckpointId: state.pendingCheckpointId,
    observationCount: state.observations.length,
    explanation: state.selectedExplanation,
    evidenceClaimCount: state.selectedEvidenceClaims.length,
    receiptId: state.completionReceipt?.receiptId ?? null,
    resetIdentity: state.resetIdentity,
  });
}

export function studentHandoverResetEquivalent(
  state: StudentHandoverActivityState,
): boolean {
  return JSON.stringify(normalizeStudentHandoverResetState(state))
    === JSON.stringify(normalizeStudentHandoverResetState(createActiveStudentHandoverActivityState()));
}

export function currentStudentHandoverCheckpointId(
  state: StudentHandoverActivityState,
): StudentHandoverCheckpointId | null {
  if (state.pendingCheckpointId !== null) return state.pendingCheckpointId;
  return state.observations[state.observations.length - 1]?.checkpointId ?? null;
}
