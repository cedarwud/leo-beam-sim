import type { HandoverStoryPhase } from '../../scene/handoverStoryFrame';
import type { TeachingPhaseId } from './handoverTeachingScript';
import {
  INSTRUCTOR_HANDOVER_SCENARIO_ID,
  INSTRUCTOR_HANDOVER_SCENARIO_VERSION,
} from './instructorHandoverScenario';

export const STUDENT_HANDOVER_ACTIVITY_SCHEMA_VERSION = 1 as const;
export const STUDENT_HANDOVER_ACTIVITY_ID = 'r6-intra-guided-flow-v1' as const;
export const STUDENT_HANDOVER_ACTIVITY_VERSION = 1 as const;
export const STUDENT_HANDOVER_ACTIVITY_RESET_IDENTITY =
  'r6-intra-guided-flow-v1:predict:clean' as const;

export type StudentHandoverActivityStep =
  | 'predict'
  | 'operate'
  | 'observe'
  | 'explain'
  | 'complete';

export const STUDENT_HANDOVER_ACTIVITY_STEPS = Object.freeze([
  'predict',
  'operate',
  'observe',
  'explain',
  'complete',
] as const satisfies readonly StudentHandoverActivityStep[]);

export type StudentHandoverPredictionChoice =
  | 'stay-serving'
  | 'switch-target'
  | 'insufficient-evidence';

export const STUDENT_HANDOVER_PREDICTION_CHOICES = Object.freeze([
  'stay-serving',
  'switch-target',
  'insufficient-evidence',
] as const satisfies readonly StudentHandoverPredictionChoice[]);

export type StudentHandoverEvidenceClaimId =
  | 'serving-below-floor'
  | 'replacement-above-floor'
  | 'replacement-beats-serving'
  | 'hold-complete'
  | 'committed';

export const STUDENT_HANDOVER_EVIDENCE_CLAIMS = Object.freeze([
  'serving-below-floor',
  'replacement-above-floor',
  'replacement-beats-serving',
  'hold-complete',
  'committed',
] as const satisfies readonly StudentHandoverEvidenceClaimId[]);

export const STUDENT_HANDOVER_COMPARABLE_EVIDENCE_CLAIMS = Object.freeze([
  'serving-below-floor',
  'replacement-above-floor',
  'replacement-beats-serving',
  'hold-complete',
] as const satisfies readonly StudentHandoverEvidenceClaimId[]);

export type StudentHandoverExplanationChoice =
  | 'all-four-conditions-held'
  | 'candidate-alone-was-enough'
  | 'highest-elevation-forced-switch'
  | 'evidence-still-insufficient';

export const STUDENT_HANDOVER_EXPLANATION_CHOICES = Object.freeze([
  'all-four-conditions-held',
  'candidate-alone-was-enough',
  'highest-elevation-forced-switch',
  'evidence-still-insufficient',
] as const satisfies readonly StudentHandoverExplanationChoice[]);

export type StudentHandoverSafeControl =
  | 'select-prediction'
  | 'lock-prediction'
  | 'start-bounded-observation'
  | 'advance-bounded-checkpoint'
  | 'select-explanation'
  | 'select-evidence-claim'
  | 'complete-activity'
  | 'reset-activity'
  | 'exit-clean-predict';

export const STUDENT_HANDOVER_SAFE_CONTROLS = Object.freeze([
  'select-prediction',
  'lock-prediction',
  'start-bounded-observation',
  'advance-bounded-checkpoint',
  'select-explanation',
  'select-evidence-claim',
  'complete-activity',
  'reset-activity',
  'exit-clean-predict',
] as const satisfies readonly StudentHandoverSafeControl[]);

export const STUDENT_HANDOVER_FORBIDDEN_CONTROLS = Object.freeze([
  'arbitrary-timeline-seek',
  'arbitrary-speed-control',
  'simulation-source-switch',
  'power-tuning',
  'ttt-tuning',
  'offset-tuning',
  'candidate-ranking-control',
  'topology-mutation',
  'direct-scientific-state-mutation',
  'instructor-direct-inter-entry',
  'instructor-play-pause',
  'instructor-restart',
  'instructor-seek',
  'shell-visibility-control',
] as const);

export interface StudentHandoverCheckpointTruth {
  readonly servingBelowFloor: boolean;
  readonly replacementAboveFloor: boolean;
  readonly replacementBeatsServing: boolean;
  readonly holdComplete: boolean;
  readonly committed: boolean;
}

export type StudentHandoverCheckpointId =
  | 'candidate-comparison'
  | 'conditions-and-hold'
  | 'commit-receipt';

/**
 * A checkpoint is only a bounded command address on the existing R5 transport.
 * It deliberately contains no expected scientific truth or answer key; those
 * live in the independent R6 acceptance contract.
 */
export interface StudentHandoverObservationCheckpoint {
  readonly id: StudentHandoverCheckpointId;
  readonly order: number;
  readonly sourceTimeSec: number;
  readonly segment: 'intra';
  readonly teachingPhase: TeachingPhaseId;
  readonly storyPhase: HandoverStoryPhase;
}

export const STUDENT_HANDOVER_OBSERVATION_CHECKPOINTS = Object.freeze([
  Object.freeze({
    id: 'candidate-comparison',
    order: 0,
    sourceTimeSec: 20,
    segment: 'intra',
    teachingPhase: 'candidate',
    storyPhase: 'measuring',
  }),
  Object.freeze({
    id: 'conditions-and-hold',
    order: 1,
    sourceTimeSec: 40,
    segment: 'intra',
    teachingPhase: 'countdown',
    storyPhase: 'holding',
  }),
  Object.freeze({
    id: 'commit-receipt',
    order: 2,
    sourceTimeSec: 52,
    segment: 'intra',
    teachingPhase: 'switching',
    storyPhase: 'switching',
  }),
] as const satisfies readonly StudentHandoverObservationCheckpoint[]);

export const STUDENT_HANDOVER_LEGAL_STEP_TRANSITIONS = Object.freeze({
  predict: Object.freeze(['operate'] as const),
  operate: Object.freeze(['observe'] as const),
  observe: Object.freeze(['observe', 'explain'] as const),
  explain: Object.freeze(['explain', 'complete'] as const),
  complete: Object.freeze(['predict'] as const),
} satisfies Readonly<Record<StudentHandoverActivityStep, readonly StudentHandoverActivityStep[]>>);

export interface StudentHandoverResetContract {
  readonly sourceTimeOwner: 'instructor-r5-transport';
  readonly sourceTimeSec: 0;
  readonly segment: 'intra';
  readonly step: 'predict';
  readonly clear: readonly [
    'prediction',
    'explanation',
    'receipt',
    'caption-hold',
    'observations',
    'temporary-selection',
    'activity-telemetry',
  ];
  readonly deterministicIdentity: typeof STUDENT_HANDOVER_ACTIVITY_RESET_IDENTITY;
}

export const STUDENT_HANDOVER_RESET_CONTRACT: StudentHandoverResetContract = Object.freeze({
  sourceTimeOwner: 'instructor-r5-transport',
  sourceTimeSec: 0,
  segment: 'intra',
  step: 'predict',
  clear: Object.freeze([
    'prediction',
    'explanation',
    'receipt',
    'caption-hold',
    'observations',
    'temporary-selection',
    'activity-telemetry',
  ] as const),
  deterministicIdentity: STUDENT_HANDOVER_ACTIVITY_RESET_IDENTITY,
});

export interface StudentHandoverActivityContract {
  readonly schemaVersion: typeof STUDENT_HANDOVER_ACTIVITY_SCHEMA_VERSION;
  readonly activityId: typeof STUDENT_HANDOVER_ACTIVITY_ID;
  readonly version: typeof STUDENT_HANDOVER_ACTIVITY_VERSION;
  readonly scenarioId: typeof INSTRUCTOR_HANDOVER_SCENARIO_ID;
  readonly scenarioVersion: typeof INSTRUCTOR_HANDOVER_SCENARIO_VERSION;
  readonly segment: 'intra';
  readonly entryPointSec: 0;
  readonly steps: typeof STUDENT_HANDOVER_ACTIVITY_STEPS;
  readonly legalStepTransitions: typeof STUDENT_HANDOVER_LEGAL_STEP_TRANSITIONS;
  readonly safeControls: typeof STUDENT_HANDOVER_SAFE_CONTROLS;
  readonly forbiddenControls: typeof STUDENT_HANDOVER_FORBIDDEN_CONTROLS;
  readonly predictionChoices: typeof STUDENT_HANDOVER_PREDICTION_CHOICES;
  readonly observationCheckpoints: typeof STUDENT_HANDOVER_OBSERVATION_CHECKPOINTS;
  readonly explanationChoices: typeof STUDENT_HANDOVER_EXPLANATION_CHOICES;
  readonly minimumEvidenceClaims: 1;
  readonly reset: typeof STUDENT_HANDOVER_RESET_CONTRACT;
}

export const STUDENT_HANDOVER_ACTIVITY_CONTRACT: StudentHandoverActivityContract = Object.freeze({
  schemaVersion: STUDENT_HANDOVER_ACTIVITY_SCHEMA_VERSION,
  activityId: STUDENT_HANDOVER_ACTIVITY_ID,
  version: STUDENT_HANDOVER_ACTIVITY_VERSION,
  scenarioId: INSTRUCTOR_HANDOVER_SCENARIO_ID,
  scenarioVersion: INSTRUCTOR_HANDOVER_SCENARIO_VERSION,
  segment: 'intra',
  entryPointSec: 0,
  steps: STUDENT_HANDOVER_ACTIVITY_STEPS,
  legalStepTransitions: STUDENT_HANDOVER_LEGAL_STEP_TRANSITIONS,
  safeControls: STUDENT_HANDOVER_SAFE_CONTROLS,
  forbiddenControls: STUDENT_HANDOVER_FORBIDDEN_CONTROLS,
  predictionChoices: STUDENT_HANDOVER_PREDICTION_CHOICES,
  observationCheckpoints: STUDENT_HANDOVER_OBSERVATION_CHECKPOINTS,
  explanationChoices: STUDENT_HANDOVER_EXPLANATION_CHOICES,
  minimumEvidenceClaims: 1,
  reset: STUDENT_HANDOVER_RESET_CONTRACT,
});

export function studentHandoverCheckpoint(
  id: StudentHandoverCheckpointId,
): StudentHandoverObservationCheckpoint {
  const checkpoint = STUDENT_HANDOVER_OBSERVATION_CHECKPOINTS.find(item => item.id === id);
  if (checkpoint === undefined) throw new Error(`Unknown R6 checkpoint: ${id}`);
  return checkpoint;
}

export function studentHandoverCheckpointAt(
  order: number,
): StudentHandoverObservationCheckpoint | null {
  return STUDENT_HANDOVER_OBSERVATION_CHECKPOINTS[order] ?? null;
}

export function studentHandoverEvidenceClaimsForTruth(
  truth: StudentHandoverCheckpointTruth,
): readonly StudentHandoverEvidenceClaimId[] {
  const claims: StudentHandoverEvidenceClaimId[] = [];
  if (truth.servingBelowFloor) claims.push('serving-below-floor');
  if (truth.replacementAboveFloor) claims.push('replacement-above-floor');
  if (truth.replacementBeatsServing) claims.push('replacement-beats-serving');
  if (truth.holdComplete) claims.push('hold-complete');
  if (truth.committed) claims.push('committed');
  return Object.freeze(claims);
}
