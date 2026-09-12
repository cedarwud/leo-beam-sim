import type {
  HandoverStoryEndpoint,
  HandoverStoryPhase,
} from '../../scene/handoverStoryFrame';
import type {
  HandoverTeachingSurfaceProjection,
} from '../../scene/handoverTeachingSurfaceProjection';
import {
  TEACHING_EE_THRESHOLD_KBIT_PER_JOULE,
} from './handoverTeachingScript';
import type {
  InstructorHandoverTransportSnapshot,
} from './instructorHandoverTransport';
import {
  STUDENT_HANDOVER_ACTIVITY_CONTRACT,
  studentHandoverCheckpoint,
  studentHandoverEvidenceClaimsForTruth,
  type StudentHandoverCheckpointId,
  type StudentHandoverCheckpointTruth,
  type StudentHandoverEvidenceClaimId,
} from './studentHandoverActivityContract';

export interface StudentHandoverEndpointEvidence {
  readonly satelliteId: string;
  readonly cellId: number | null;
  readonly satelliteLabel: string | null;
  readonly beamLabel: string | null;
  readonly eeKbitPerJoule: number;
}

export interface StudentHandoverActivityEvidence {
  readonly checkpointId: StudentHandoverCheckpointId;
  readonly scenarioId: string;
  readonly scenarioVersion: number;
  readonly instructorRunId: number;
  readonly segment: 'intra';
  readonly sourceTimeSec: number;
  readonly storyId: string;
  readonly pairKey: string;
  readonly identityKey: string;
  readonly storyPhase: HandoverStoryPhase;
  readonly truth: StudentHandoverCheckpointTruth;
  readonly evidenceClaims: readonly StudentHandoverEvidenceClaimId[];
  readonly source: StudentHandoverEndpointEvidence;
  readonly target: StudentHandoverEndpointEvidence;
  readonly thresholdKbitPerJoule: number;
  readonly holdElapsedSec: number;
  readonly holdRequiredSec: number;
}

function endpointEvidence(
  endpoint: HandoverStoryEndpoint,
  eeKbitPerJoule: number,
): StudentHandoverEndpointEvidence {
  return Object.freeze({
    satelliteId: endpoint.satelliteId,
    cellId: endpoint.cellId,
    satelliteLabel: endpoint.satelliteLabel,
    beamLabel: endpoint.beamLabel,
    eeKbitPerJoule,
  });
}

/**
 * Projects evidence from the exact R4/R5 frame at a declared bounded
 * checkpoint. This module derives no winner, phase, pair, or source time: it
 * only reads the shell-owned transport and projection and fails closed on drift.
 */
export function resolveStudentHandoverActivityEvidence(
  checkpointId: StudentHandoverCheckpointId,
  transport: InstructorHandoverTransportSnapshot | null,
  projection: HandoverTeachingSurfaceProjection | null,
): StudentHandoverActivityEvidence | null {
  if (transport === null || projection === null) return null;
  const checkpoint = studentHandoverCheckpoint(checkpointId);
  if (transport.scenarioId !== STUDENT_HANDOVER_ACTIVITY_CONTRACT.scenarioId
    || transport.scenarioVersion !== STUDENT_HANDOVER_ACTIVITY_CONTRACT.scenarioVersion
    || transport.entryKind !== 'intra'
    || transport.segment.kind !== checkpoint.segment
    || !transport.paused
    || projection.kind !== 'intra') {
    return null;
  }
  if (Math.abs(transport.sourceTimeSec - checkpoint.sourceTimeSec) > 0.001) return null;
  if (projection.frame.phase.id !== checkpoint.teachingPhase) return null;
  if (projection.binding.identity.phase !== checkpoint.storyPhase) return null;

  const truth: StudentHandoverCheckpointTruth = Object.freeze({
    servingBelowFloor: projection.frame.servingBelowThreshold,
    replacementAboveFloor: projection.frame.winner.eligible,
    replacementBeatsServing: projection.frame.replacementLeads,
    holdComplete: projection.frame.tttElapsedSec >= projection.frame.tttSec,
    committed: projection.binding.identity.committed,
  });

  return Object.freeze({
    checkpointId,
    scenarioId: transport.scenarioId,
    scenarioVersion: transport.scenarioVersion,
    instructorRunId: transport.runId,
    segment: 'intra',
    sourceTimeSec: transport.sourceTimeSec,
    storyId: projection.binding.identity.storyId,
    pairKey: projection.binding.identity.pairKey,
    identityKey: projection.binding.identityKey,
    storyPhase: projection.binding.identity.phase,
    truth,
    evidenceClaims: studentHandoverEvidenceClaimsForTruth(truth),
    source: endpointEvidence(
      projection.binding.frame.from,
      projection.frame.serving.eeKbitPerJoule,
    ),
    target: endpointEvidence(
      projection.binding.frame.to,
      projection.frame.winner.eeKbitPerJoule,
    ),
    thresholdKbitPerJoule: TEACHING_EE_THRESHOLD_KBIT_PER_JOULE,
    holdElapsedSec: projection.frame.tttElapsedSec,
    holdRequiredSec: projection.frame.tttSec,
  });
}
