import {
  MODQN_TRAINING_SCENE_TRACE_REQUIREMENTS,
  type ModqnTrainingSceneTraceField,
  type ModqnTrainingSceneTraceRequirement,
} from './contract';
import type { ModqnReplaySourceGapField } from '../replay-source-gaps';

export type ModqnTrainingSceneHandoffPriority =
  | 'P0-required'
  | 'P1-source-gap-allowed'
  | 'P2-comparison-only';

export type ModqnTrainingSceneHandoffValidationGate =
  | 'reject-trace-if-absent'
  | 'accept-trace-with-source-gap'
  | 'gate-comparison-feature';

export interface ModqnTrainingSceneProducerHandoffItem {
  readonly field: ModqnTrainingSceneTraceField;
  readonly priority: ModqnTrainingSceneHandoffPriority;
  readonly validationGate: ModqnTrainingSceneHandoffValidationGate;
  readonly requiredProducerPaths: readonly string[];
  readonly sourceGapField?: ModqnReplaySourceGapField;
  readonly producerAction: string;
  readonly consumerFailureMode: string;
}

export const MODQN_TRAINING_SCENE_P0_REQUIRED_FIELDS = [
  'provenance.schemaVersion',
  'provenance.runIdentity',
  'provenance.producerRevision',
  'provenance.artifactHashes',
  'provenance.claimBoundary',
  'provenance.seedSet',
  'environment.topology',
  'environment.scheduler',
  'environment.ueMobility',
  'environment.channelModel',
  'environment.objectiveWeights',
  'environment.handoverPenalty',
  'environment.algorithmFlags',
  'entities.satellites',
  'entities.beams',
  'entities.ues',
  'step.timeIndex',
  'step.focusUe',
  'step.previousServing',
  'step.selectedServing',
  'step.selectedAction',
  'step.decisionMasks',
  'step.activeBeamSchedule',
  'step.handoverEvent',
  'step.reward',
  'step.sourceGaps',
] as const satisfies readonly ModqnTrainingSceneTraceField[];

export const MODQN_TRAINING_SCENE_P1_SOURCE_GAP_ALLOWED_FIELDS = [
  'environment.frequencyReuse',
  'entities.cells',
  'entities.models',
  'step.satelliteState',
  'step.beamFootprints',
  'step.allUePositions',
  'step.allUeServingHistory',
  'step.nextBeamSchedule',
  'step.angleAwareTerms',
  'step.energyEfficiencyTerms',
  'step.policyDiagnostics',
] as const satisfies readonly ModqnTrainingSceneTraceField[];

export const MODQN_TRAINING_SCENE_P2_COMPARISON_ONLY_FIELDS = [
  'comparison.alignedTimebase',
  'comparison.perModelStreams',
  'comparison.aggregateMetrics',
] as const satisfies readonly ModqnTrainingSceneTraceField[];

const PRIORITY_BY_FIELD = new Map<ModqnTrainingSceneTraceField, ModqnTrainingSceneHandoffPriority>([
  ...MODQN_TRAINING_SCENE_P0_REQUIRED_FIELDS.map(field => [field, 'P0-required'] as const),
  ...MODQN_TRAINING_SCENE_P1_SOURCE_GAP_ALLOWED_FIELDS.map(field => [field, 'P1-source-gap-allowed'] as const),
  ...MODQN_TRAINING_SCENE_P2_COMPARISON_ONLY_FIELDS.map(field => [field, 'P2-comparison-only'] as const),
]);

function validationGateForPriority(
  priority: ModqnTrainingSceneHandoffPriority,
): ModqnTrainingSceneHandoffValidationGate {
  if (priority === 'P0-required') return 'reject-trace-if-absent';
  if (priority === 'P1-source-gap-allowed') return 'accept-trace-with-source-gap';
  return 'gate-comparison-feature';
}

function producerActionForRequirement(
  requirement: ModqnTrainingSceneTraceRequirement,
  priority: ModqnTrainingSceneHandoffPriority,
): string {
  if (priority === 'P0-required') {
    return `Export ${requirement.field} at ${requirement.requiredProducerPaths.join(' or ')}.`;
  }
  if (priority === 'P1-source-gap-allowed') {
    return `Export ${requirement.field} when available; otherwise emit source gap ${requirement.sourceGapField ?? 'provenance.claimBoundary'}.`;
  }
  return `Export ${requirement.field} only for aligned model-comparison artifacts.`;
}

function consumerFailureModeForRequirement(
  requirement: ModqnTrainingSceneTraceRequirement,
  priority: ModqnTrainingSceneHandoffPriority,
): string {
  if (priority === 'P0-required') {
    return 'Reject the trace as not acceptable for producer-backed training-scene replay.';
  }
  if (priority === 'P1-source-gap-allowed') {
    return `Keep the trace loadable but fail closed on the affected UI surface with ${requirement.sourceGapField ?? 'a source gap'}.`;
  }
  return 'Disable model-comparison replay and keep single-model replay available when possible.';
}

function createHandoffItem(
  requirement: ModqnTrainingSceneTraceRequirement,
): ModqnTrainingSceneProducerHandoffItem {
  const priority = PRIORITY_BY_FIELD.get(requirement.field);
  if (priority === undefined) {
    throw new Error(`MODQN training scene handoff priority missing for ${requirement.field}`);
  }
  return {
    field: requirement.field,
    priority,
    validationGate: validationGateForPriority(priority),
    requiredProducerPaths: requirement.requiredProducerPaths,
    sourceGapField: requirement.sourceGapField,
    producerAction: producerActionForRequirement(requirement, priority),
    consumerFailureMode: consumerFailureModeForRequirement(requirement, priority),
  };
}

export const MODQN_TRAINING_SCENE_PRODUCER_HANDOFF_PACKET =
  MODQN_TRAINING_SCENE_TRACE_REQUIREMENTS.map(createHandoffItem);

export function getModqnTrainingSceneProducerHandoffPacketByPriority(
  priority: ModqnTrainingSceneHandoffPriority,
): readonly ModqnTrainingSceneProducerHandoffItem[] {
  return MODQN_TRAINING_SCENE_PRODUCER_HANDOFF_PACKET.filter(item => item.priority === priority);
}

export function getModqnTrainingSceneProducerHandoffItem(
  field: ModqnTrainingSceneTraceField,
): ModqnTrainingSceneProducerHandoffItem {
  const item = MODQN_TRAINING_SCENE_PRODUCER_HANDOFF_PACKET.find(entry => entry.field === field);
  if (item === undefined) {
    throw new Error(`MODQN training scene handoff item missing for ${field}`);
  }
  return item;
}
