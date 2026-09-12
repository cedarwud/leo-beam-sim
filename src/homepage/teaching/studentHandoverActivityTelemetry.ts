import type { HandoverSurfaceBinding } from '../../scene/handoverSurfaceBinding';
import type { InstructorHandoverTransportSnapshot } from './instructorHandoverTransport';
import {
  STUDENT_HANDOVER_ACTIVITY_ID,
  STUDENT_HANDOVER_ACTIVITY_SCHEMA_VERSION,
  STUDENT_HANDOVER_ACTIVITY_VERSION,
} from './studentHandoverActivityContract';
import {
  currentStudentHandoverCheckpointId,
  type StudentHandoverActivityState,
} from './studentHandoverActivityState';

export type StudentHandoverActivityTelemetrySurface =
  | 'root'
  | 'scene'
  | 'rail'
  | 'caption'
  | 'activity';

export interface StudentHandoverActivityTelemetryAttributes {
  readonly 'data-student-activity-surface': StudentHandoverActivityTelemetrySurface;
  readonly 'data-student-activity-binding': 'active' | 'none';
  readonly 'data-student-activity-schema-version': string;
  readonly 'data-student-activity-id': string;
  readonly 'data-student-activity-version': string;
  readonly 'data-student-activity-step': string;
  readonly 'data-student-activity-run-id': string;
  readonly 'data-student-activity-prediction': string;
  readonly 'data-student-activity-prediction-locked': string;
  readonly 'data-student-activity-checkpoint-id': string;
  readonly 'data-student-activity-observed-checkpoints': string;
  readonly 'data-student-activity-explanation': string;
  readonly 'data-student-activity-evidence-claims': string;
  readonly 'data-student-activity-receipt-id': string;
  readonly 'data-student-activity-reset-identity': string;
  readonly 'data-student-activity-scenario-id': string;
  readonly 'data-student-activity-scenario-version': string;
  readonly 'data-student-activity-segment': string;
  readonly 'data-student-activity-instructor-run-id': string;
  readonly 'data-student-activity-source-time-sec': string;
  readonly 'data-student-activity-story-id': string;
  readonly 'data-student-activity-pair-key': string;
  readonly 'data-student-activity-story-phase': string;
  readonly 'data-student-activity-committed': string;
}

function inactiveAttributes(
  surface: StudentHandoverActivityTelemetrySurface,
): StudentHandoverActivityTelemetryAttributes {
  return {
    'data-student-activity-surface': surface,
    'data-student-activity-binding': 'none',
    'data-student-activity-schema-version': '',
    'data-student-activity-id': '',
    'data-student-activity-version': '',
    'data-student-activity-step': '',
    'data-student-activity-run-id': '',
    'data-student-activity-prediction': '',
    'data-student-activity-prediction-locked': '',
    'data-student-activity-checkpoint-id': '',
    'data-student-activity-observed-checkpoints': '',
    'data-student-activity-explanation': '',
    'data-student-activity-evidence-claims': '',
    'data-student-activity-receipt-id': '',
    'data-student-activity-reset-identity': '',
    'data-student-activity-scenario-id': '',
    'data-student-activity-scenario-version': '',
    'data-student-activity-segment': '',
    'data-student-activity-instructor-run-id': '',
    'data-student-activity-source-time-sec': '',
    'data-student-activity-story-id': '',
    'data-student-activity-pair-key': '',
    'data-student-activity-story-phase': '',
    'data-student-activity-committed': '',
  };
}

export function studentHandoverActivityTelemetryAttributes(
  surface: StudentHandoverActivityTelemetrySurface,
  state: StudentHandoverActivityState | null,
  transport: InstructorHandoverTransportSnapshot | null,
  binding: HandoverSurfaceBinding | null,
): StudentHandoverActivityTelemetryAttributes {
  if (state === null || !state.active) return inactiveAttributes(surface);
  const checkpointId = currentStudentHandoverCheckpointId(state);
  return {
    'data-student-activity-surface': surface,
    'data-student-activity-binding': 'active',
    'data-student-activity-schema-version': String(STUDENT_HANDOVER_ACTIVITY_SCHEMA_VERSION),
    'data-student-activity-id': STUDENT_HANDOVER_ACTIVITY_ID,
    'data-student-activity-version': String(STUDENT_HANDOVER_ACTIVITY_VERSION),
    'data-student-activity-step': state.step,
    'data-student-activity-run-id': state.runId ?? '',
    'data-student-activity-prediction': state.selectedPrediction ?? '',
    'data-student-activity-prediction-locked': state.predictionLocked ? 'true' : 'false',
    'data-student-activity-checkpoint-id': checkpointId ?? '',
    'data-student-activity-observed-checkpoints': state.observations
      .map(observation => observation.checkpointId)
      .join(','),
    'data-student-activity-explanation': state.selectedExplanation ?? '',
    'data-student-activity-evidence-claims': state.selectedEvidenceClaims.join(','),
    'data-student-activity-receipt-id': state.completionReceipt?.receiptId ?? '',
    'data-student-activity-reset-identity': state.resetIdentity,
    'data-student-activity-scenario-id': transport?.scenarioId ?? '',
    'data-student-activity-scenario-version': transport === null
      ? ''
      : String(transport.scenarioVersion),
    'data-student-activity-segment': transport?.segment.kind ?? '',
    'data-student-activity-instructor-run-id': transport === null
      ? ''
      : String(transport.runId),
    'data-student-activity-source-time-sec': transport === null
      ? ''
      : String(transport.sourceTimeSec),
    'data-student-activity-story-id': binding?.identity.storyId ?? '',
    'data-student-activity-pair-key': binding?.identity.pairKey ?? '',
    'data-student-activity-story-phase': binding?.identity.phase ?? '',
    'data-student-activity-committed': binding === null
      ? ''
      : binding.identity.committed ? 'true' : 'false',
  };
}
