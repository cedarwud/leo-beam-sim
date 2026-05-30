import {
  MODQN_TRAINING_SCENE_TRACE_REQUIREMENTS,
  type ModqnTrainingSceneTraceRequirement,
} from './contract';

export const MODQN_TRAINING_SCENE_TRACE_SCHEMA_VERSION = 'modqn-training-scene-trace-v1' as const;
export const MODQN_TRAINING_SCENE_DISPLAY_ARTIFACT_SCHEMA_VERSION = 'visual-showcase-v1' as const;

export type ModqnTrainingSceneTraceSchemaVersion =
  typeof MODQN_TRAINING_SCENE_TRACE_SCHEMA_VERSION;
export type ModqnTrainingSceneDisplayArtifactSchemaVersion =
  typeof MODQN_TRAINING_SCENE_DISPLAY_ARTIFACT_SCHEMA_VERSION;

export type ModqnTrainingSceneArtifactTargetRole =
  | 'producer-training-trace'
  | 'display-replay-artifact';

export interface ModqnTrainingSceneArtifactTargetDecision {
  readonly status: 'accepted';
  readonly producerTraceSchema: ModqnTrainingSceneTraceSchemaVersion;
  readonly displayArtifactSchema: ModqnTrainingSceneDisplayArtifactSchemaVersion;
  readonly producerTraceRole: ModqnTrainingSceneArtifactTargetRole;
  readonly displayArtifactRole: ModqnTrainingSceneArtifactTargetRole;
  readonly sourceTruthOwner: 'modqn-paper-reproduction';
  readonly validationOracle: 'ntn-sim-core';
  readonly consumerRole: 'leo-beam-sim-read-only-renderer';
  readonly visualShowcasePolicy: 'derive-after-producer-trace-validation';
  readonly rationale: readonly string[];
  readonly rejectedAlternatives: readonly {
    readonly target: string;
    readonly reason: string;
  }[];
}

export type ModqnTrainingSceneTraceRequiredSection =
  | 'schemaVersion'
  | 'run'
  | 'provenance'
  | 'environment'
  | 'entities'
  | 'timeline'
  | 'sourceGaps'
  | 'comparison';

export const MODQN_TRAINING_SCENE_TRACE_REQUIRED_SECTIONS = [
  'schemaVersion',
  'run',
  'provenance',
  'environment',
  'entities',
  'timeline',
  'sourceGaps',
  'comparison',
] as const satisfies readonly ModqnTrainingSceneTraceRequiredSection[];

export const MODQN_TRAINING_SCENE_ARTIFACT_TARGET_DECISION = {
  status: 'accepted',
  producerTraceSchema: MODQN_TRAINING_SCENE_TRACE_SCHEMA_VERSION,
  displayArtifactSchema: MODQN_TRAINING_SCENE_DISPLAY_ARTIFACT_SCHEMA_VERSION,
  producerTraceRole: 'producer-training-trace',
  displayArtifactRole: 'display-replay-artifact',
  sourceTruthOwner: 'modqn-paper-reproduction',
  validationOracle: 'ntn-sim-core',
  consumerRole: 'leo-beam-sim-read-only-renderer',
  visualShowcasePolicy: 'derive-after-producer-trace-validation',
  rationale: [
    'Training runs and model comparisons need episode/checkpoint streams, aligned seeds, per-model decisions, and per-step source gaps beyond the display-first visual-showcase-v1 contract.',
    'visual-showcase-v1 remains the final offline display artifact for 60-120 second replay windows and should not be expanded into a trainer trace ledger.',
    'leo-beam-sim can render either validated visual-showcase-v1 or a future validated trace adapter, but it must not become the producer of missing training truth.',
  ],
  rejectedAlternatives: [
    {
      target: 'extend-visual-showcase-v1-directly',
      reason: 'Rejected for the first training-trace slice because it would mix display replay fields with training-run/checkpoint/comparison provenance.',
    },
    {
      target: 'infer-training-trace-in-leo-beam-sim',
      reason: 'Rejected because renderer convenience cannot own active schedules, reward terms, policy diagnostics, or comparison alignment.',
    },
    {
      target: 'reuse-phase03a-replay-bundle-as-scene-trace',
      reason: 'Rejected because the current bundle is focused-row replay proof, not a scene-complete multi-UE training trace.',
    },
  ],
} as const satisfies ModqnTrainingSceneArtifactTargetDecision;

export function getModqnTrainingSceneTraceHandoffChecklist():
readonly ModqnTrainingSceneTraceRequirement[] {
  return MODQN_TRAINING_SCENE_TRACE_REQUIREMENTS;
}

export function getModqnTrainingSceneTraceBlockedFields():
readonly ModqnTrainingSceneTraceRequirement[] {
  return MODQN_TRAINING_SCENE_TRACE_REQUIREMENTS.filter(requirement => (
    requirement.sourceGapWhenAbsent
  ));
}
