import {
  MODQN_TRAINING_SCENE_TRACE_REQUIREMENTS,
  type ModqnTrainingSceneTraceField,
  type ModqnTrainingSceneTraceRequirement,
} from './contract';
import type { ModqnReplaySourceGapField } from '../replay-source-gaps';

export type ModqnTrainingSceneInventorySource =
  | 'phase03a-replay-bundle'
  | 'user-trained-manifest'
  | 'visual-showcase-v1';

export type ModqnTrainingSceneCoverageStatus =
  | 'producer-backed'
  | 'partial-producer-backed'
  | 'display-derived'
  | 'source-gap';

export interface ModqnTrainingSceneSourceCoverage {
  readonly field: ModqnTrainingSceneTraceField;
  readonly source: ModqnTrainingSceneInventorySource;
  readonly status: ModqnTrainingSceneCoverageStatus;
  readonly currentConsumerPaths: readonly string[];
  readonly sourceGapField?: ModqnReplaySourceGapField;
  readonly note: string;
}

type CoverageOverride = Omit<ModqnTrainingSceneSourceCoverage, 'field' | 'source' | 'sourceGapField'>
  & { readonly sourceGapField?: ModqnReplaySourceGapField };

type CoverageOverrideMap = Partial<Record<ModqnTrainingSceneTraceField, CoverageOverride>>;

const PHASE03A_REPLAY_BUNDLE_COVERAGE = {
  'provenance.schemaVersion': {
    status: 'producer-backed',
    currentConsumerPaths: ['manifest.bundleSchemaVersion', 'envelope.sourceSchemaVersion'],
    note: 'The phase-03a replay bundle carries its bundle schema version.',
  },
  'provenance.claimBoundary': {
    status: 'producer-backed',
    currentConsumerPaths: ['manifest.claimBoundary', 'envelope.claimBoundary.sourceClaimBoundary'],
    note: 'The bundle claim boundary is preserved into the replay envelope.',
  },
  'environment.topology': {
    status: 'partial-producer-backed',
    currentConsumerPaths: [
      'manifest.baselineSurface.satelliteCount',
      'manifest.baselineSurface.beamCountPerSatellite',
      'manifest.baselineSurface.totalBeamCount',
    ],
    note: 'Current topology covers counts only, not shell, epoch, or renderable coordinate frame.',
  },
  'environment.objectiveWeights': {
    status: 'partial-producer-backed',
    currentConsumerPaths: ['timelineRows[].policyDiagnostics.objectiveWeights'],
    note: 'Objective weights may exist in per-row policy diagnostics, but are not guaranteed as a run-level environment field.',
  },
  'entities.satellites': {
    status: 'partial-producer-backed',
    currentConsumerPaths: ['timelineRows[].satelliteStates[].satId', 'timelineRows[].satelliteStates[].satIndex'],
    note: 'Satellite IDs are present, but orbital shell/plane/slot metadata is not a full entity catalog.',
  },
  'entities.beams': {
    status: 'partial-producer-backed',
    currentConsumerPaths: [
      'timelineRows[].beamStates[].beamId',
      'timelineRows[].beamStates[].satId',
      'timelineRows[].beamStates[].localBeamIndex',
    ],
    note: 'Beam identity is present, but producer footprint and angle convention are not.',
  },
  'entities.ues': {
    status: 'partial-producer-backed',
    currentConsumerPaths: [
      'timelineRows[].userId',
      'timelineRows[].userIndex',
      'timelineRows[].userPosition',
    ],
    note: 'The current bundle exposes the focused row UE, not an all-UE entity catalog or trajectory reference.',
  },
  'step.timeIndex': {
    status: 'partial-producer-backed',
    currentConsumerPaths: [
      'timelineRows[].slotIndex',
      'timelineRows[].timeSec',
      'timelineRows[].decisionTimeSec',
      'envelope.replaySlots[].rows[].sourceRowIndex',
    ],
    sourceGapField: 'timeline.sourceRowIdentity',
    note: 'Slot and time are producer-backed; sourceRowIndex is adapter order, not a stable producer row ID.',
  },
  'step.focusUe': {
    status: 'display-derived',
    currentConsumerPaths: ['timelineRows[].userId', 'timelineRows[].userIndex'],
    sourceGapField: 'timeline.focusUeSelection',
    note: 'The UI focuses the row being replayed; no producer focusUeId/focusReason is exported.',
  },
  'step.previousServing': {
    status: 'producer-backed',
    currentConsumerPaths: ['timelineRows[].previousServing'],
    note: 'Previous serving is preserved as producer replay truth.',
  },
  'step.selectedServing': {
    status: 'producer-backed',
    currentConsumerPaths: ['timelineRows[].selectedServing'],
    note: 'Selected serving is preserved as producer replay truth, but it is not schedule truth.',
  },
  'step.selectedAction': {
    status: 'partial-producer-backed',
    currentConsumerPaths: ['timelineRows[].action', 'timelineRows[].selectedServing.beamIndex'],
    note: 'Explicit action is producer-backed when present; selectedServing.beamIndex is only a display identity alias when action is absent.',
  },
  'step.decisionMasks': {
    status: 'producer-backed',
    currentConsumerPaths: [
      'timelineRows[].visibilityMask',
      'timelineRows[].actionValidityMask',
      'timelineRows[].decisionVisibilityMask',
      'timelineRows[].decisionActionValidityMask',
    ],
    note: 'Masks are producer-backed diagnostics only and must never replace active beam schedule truth.',
  },
  'step.handoverEvent': {
    status: 'partial-producer-backed',
    currentConsumerPaths: [
      'timelineRows[].handoverEvent.kind',
      'timelineRows[].previousServing',
      'timelineRows[].selectedServing',
    ],
    sourceGapField: 'timeline.handoverPenaltyAttribution',
    note: 'The event kind is producer-backed, but source/target detail and penalty attribution are not complete.',
  },
  'step.reward': {
    status: 'producer-backed',
    currentConsumerPaths: ['timelineRows[].rewardVector', 'timelineRows[].scalarReward'],
    note: 'Reward vector and scalar reward are preserved from the replay bundle.',
  },
  'step.policyDiagnostics': {
    status: 'partial-producer-backed',
    currentConsumerPaths: ['timelineRows[].policyDiagnostics'],
    note: 'Policy diagnostics are optional per row; consumers already count present/missing rows.',
  },
  'step.sourceGaps': {
    status: 'display-derived',
    currentConsumerPaths: ['createCurrentModqnReplayProofSourceGaps()'],
    note: 'Current gaps are consumer-authored because the phase-03a bundle does not export per-step sourceGaps.',
  },
} as const satisfies CoverageOverrideMap;

const USER_TRAINED_MANIFEST_COVERAGE = {
  'provenance.schemaVersion': {
    status: 'partial-producer-backed',
    currentConsumerPaths: ['TrainingServiceManifest.schema', 'replayBundle.manifest.bundleSchemaVersion'],
    note: 'The training-service manifest and replay bundle each carry schema markers, but no unified training-scene trace schema exists yet.',
  },
  'provenance.runIdentity': {
    status: 'partial-producer-backed',
    currentConsumerPaths: [
      'TrainingServiceManifest.jobId',
      'TrainingServiceManifest.batchId',
      'TrainingServiceManifest.arm',
      'ModqnUserTrainingMetadata.jobId',
    ],
    note: 'Job and arm identity exist; modelId, policyId, and checkpoint identity are not complete.',
  },
  'provenance.artifactHashes': {
    status: 'partial-producer-backed',
    currentConsumerPaths: [
      'TrainingServiceManifest.requestSha256',
      'TrainingServiceManifest.configFingerprintSha256',
      'TrainingServiceManifest.rawRun.path',
      'TrainingServiceManifest.replayBundle.path',
    ],
    note: 'Request/config hashes may exist, but per-file artifact hashes are not guaranteed.',
  },
  'provenance.claimBoundary': {
    status: 'producer-backed',
    currentConsumerPaths: [
      'TrainingServiceManifest.artifactTag',
      'TrainingServiceManifest.userTrained',
      'TrainingServiceManifest.paperFaithful',
      'TrainingServiceManifest.effectivenessClaimAuthorized',
      'TrainingServiceManifest.claimMode',
    ],
    note: 'The user-trained manifest explicitly blocks paper-faithful/effectiveness promotion.',
  },
  'provenance.seedSet': {
    status: 'partial-producer-backed',
    currentConsumerPaths: [
      'TrainingHyperparams.seedTriplet',
      'TrainingTruth.seedTriplet',
      'TrainingRunMetadata.seed_triplet',
    ],
    note: 'Seed triplets may be present, but the manifest is not a full deterministic replay trace.',
  },
  'environment.topology': {
    status: 'partial-producer-backed',
    currentConsumerPaths: ['TrainingTruth.envAxes', 'Track2Config.envAxes'],
    note: 'Training env axes can describe topology, but they are not per-step renderable entity state.',
  },
  'environment.scheduler': {
    status: 'partial-producer-backed',
    currentConsumerPaths: ['EnvAxes.antiCollapseMaxUsersPerBeam'],
    sourceGapField: 'beamHopping.activeSchedule',
    note: 'Scheduler context may exist, but no active beam/cell schedule is exported.',
  },
  'environment.ueMobility': {
    status: 'partial-producer-backed',
    currentConsumerPaths: ['EnvAxes.nUsers', 'EnvAxes.userSpeedKmh', 'EnvAxes.ueArea'],
    sourceGapField: 'entities.ues.positionTrace',
    note: 'Mobility settings are available, but the per-step UE trajectory remains absent.',
  },
  'environment.channelModel': {
    status: 'partial-producer-backed',
    currentConsumerPaths: ['EnvAxes.channel', 'EnvAxes.antenna', 'HobsConfig'],
    note: 'Channel/antenna settings may be present, but not per-step angle-aware terms.',
  },
  'environment.objectiveWeights': {
    status: 'producer-backed',
    currentConsumerPaths: [
      'TrainingHyperparams.objectiveWeights',
      'TrainingTruth.objectiveWeights',
      'TrainingRunMetadata.objective_weights',
    ],
    note: 'User-trained artifacts can carry the objective weights used by the run.',
  },
  'environment.handoverPenalty': {
    status: 'partial-producer-backed',
    currentConsumerPaths: ['HobsConfig.eHoPerEventJ'],
    sourceGapField: 'timeline.handoverPenaltyAttribution',
    note: 'Penalty constants may exist, but per-step penalty attribution is not exported.',
  },
  'environment.algorithmFlags': {
    status: 'partial-producer-backed',
    currentConsumerPaths: [
      'TrainingServiceManifest.trainerSubcommand',
      'TrainingServiceManifest.arm',
      'Track2Config.r1RewardMode',
      'Track2Config.multiCatfishV2',
    ],
    note: 'Algorithm family and flags are manifest-level context, not a policy diagnostic stream.',
  },
  'entities.models': {
    status: 'partial-producer-backed',
    currentConsumerPaths: [
      'TrainingServiceManifest.jobId',
      'TrainingServiceManifest.rawRun.checkpointPaths',
      'TrainingServiceManifest.trainerSubcommand',
    ],
    note: 'Job/checkpoint paths can identify a user-trained run, but modelId/policyId are not formalized.',
  },
  'step.sourceGaps': {
    status: 'display-derived',
    currentConsumerPaths: ['createCurrentModqnReplayProofSourceGaps()'],
    note: 'The manifest path does not currently export per-step source gaps; the consumer adds current known gaps.',
  },
} as const satisfies CoverageOverrideMap;

const VISUAL_SHOWCASE_V1_COVERAGE = {
  'provenance.schemaVersion': {
    status: 'producer-backed',
    currentConsumerPaths: ['VisualShowcaseArtifact.schemaVersion'],
    note: 'The visual-showcase artifact is schema-gated before rendering.',
  },
  'provenance.runIdentity': {
    status: 'partial-producer-backed',
    currentConsumerPaths: [
      'VisualShowcaseArtifact.artifactId',
      'provenance.sourceArtifactIds',
      'provenance.sourceArtifacts[].id',
    ],
    note: 'Artifact identity exists, but modelId/policyId/runId are not guaranteed as training-scene fields.',
  },
  'provenance.producerRevision': {
    status: 'producer-backed',
    currentConsumerPaths: [
      'provenance.sourceRepos[].commit',
      'provenance.sourceCommits',
      'provenance.ntnSimCoreCommit',
      'provenance.modqnPaperReproductionCommit',
    ],
    note: 'Source repository commits are part of visual-showcase-v1 provenance.',
  },
  'provenance.artifactHashes': {
    status: 'partial-producer-backed',
    currentConsumerPaths: ['provenance.sourceArtifacts[].path', 'provenance.sourceArtifacts[].id'],
    note: 'Source artifact references exist, but the frozen visual-showcase-v1 type does not require sha256 per artifact.',
  },
  'provenance.claimBoundary': {
    status: 'producer-backed',
    currentConsumerPaths: ['provenance.claimBoundary', 'provenance.evidenceStatus'],
    note: 'Claim boundary and evidence status are load-bearing visual-showcase fields.',
  },
  'environment.topology': {
    status: 'partial-producer-backed',
    currentConsumerPaths: ['scenario', 'timebase', 'entities.satellites', 'entities.beams', 'entities.ues'],
    note: 'The artifact carries display topology and entities, but not necessarily the full training environment axes.',
  },
  'environment.frequencyReuse': {
    status: 'producer-backed',
    currentConsumerPaths: [
      'entities.beams[].frequencyReuseGroup',
      'entities.beams[].frequencyReuseProvenance',
    ],
    note: 'Frequency reuse coloring can be source-backed when exported by visual-showcase-v1.',
  },
  'environment.channelModel': {
    status: 'partial-producer-backed',
    currentConsumerPaths: ['truthOwnership.sinr', 'truthOwnership.geometry', 'scenario.coordinateFrame'],
    note: 'The artifact declares channel metric ownership and coordinate frame, but not all training channel parameters.',
  },
  'environment.objectiveWeights': {
    status: 'producer-backed',
    currentConsumerPaths: ['diagnostics.objectiveWeights'],
    note: 'Objective weights are present in visual-showcase diagnostics.',
  },
  'environment.algorithmFlags': {
    status: 'partial-producer-backed',
    currentConsumerPaths: ['diagnostics.policyName', 'scenario.storyKind', 'scenario.truthMode'],
    note: 'Policy name and story labels exist, but angle-aware/multi-catfish flags are not formal trace fields.',
  },
  'entities.satellites': {
    status: 'producer-backed',
    currentConsumerPaths: ['entities.satellites[].id', 'entities.satellites[].sourceId', 'entities.satellites[].shellId'],
    note: 'Satellite entity identities are producer artifact fields.',
  },
  'entities.beams': {
    status: 'producer-backed',
    currentConsumerPaths: [
      'entities.beams[].id',
      'entities.beams[].sourceId',
      'entities.beams[].satelliteId',
      'entities.beams[].localBeamIndex',
    ],
    note: 'Beam identity and satellite binding are producer artifact fields.',
  },
  'entities.ues': {
    status: 'producer-backed',
    currentConsumerPaths: ['entities.ues[].id', 'entities.ues[].sourceId', 'entities.ues[].trajectoryKind'],
    note: 'UE identities and trajectory kind are producer artifact fields.',
  },
  'step.timeIndex': {
    status: 'partial-producer-backed',
    currentConsumerPaths: [
      'timeline[].tSec',
      'timeline[].sourceRefs.sourceSlotIndex',
      'timebase.timesSec',
      'timebase.sourceSlotIndexBySample',
    ],
    sourceGapField: 'timeline.sourceRowIdentity',
    note: 'Visual-showcase has artifact sample timing and source slot refs, not full episode/step/source row identity.',
  },
  'step.satelliteState': {
    status: 'producer-backed',
    currentConsumerPaths: ['timeline[].satellites[].positionEcefKm', 'timeline[].satellites[].coordinateFrameKind'],
    note: 'Renderable satellite samples are exported by the artifact.',
  },
  'step.beamFootprints': {
    status: 'producer-backed',
    currentConsumerPaths: ['timeline[].beams[].center', 'timeline[].beams[].footprintKm', 'timeline[].beams[].gainProvenance'],
    note: 'Renderable beam footprint samples are exported by the artifact.',
  },
  'step.allUePositions': {
    status: 'producer-backed',
    currentConsumerPaths: ['timeline[].ues[].geo'],
    note: 'Per-frame UE positions are exported by the artifact.',
  },
  'step.allUeServingHistory': {
    status: 'producer-backed',
    currentConsumerPaths: ['timeline[].ues[].servingSatelliteId', 'timeline[].ues[].servingBeamId'],
    note: 'Per-frame UE serving state is exported by the artifact.',
  },
  'step.previousServing': {
    status: 'producer-backed',
    currentConsumerPaths: ['timeline[].modqnDecision.previousSatelliteId', 'timeline[].modqnDecision.previousBeamId'],
    note: 'Previous serving is part of each visual-showcase MODQN decision frame.',
  },
  'step.selectedServing': {
    status: 'producer-backed',
    currentConsumerPaths: ['timeline[].modqnDecision.selectedSatelliteId', 'timeline[].modqnDecision.selectedBeamId'],
    note: 'Selected serving is part of each visual-showcase MODQN decision frame.',
  },
  'step.selectedAction': {
    status: 'producer-backed',
    currentConsumerPaths: ['timeline[].modqnDecision.actionIndex', 'timeline[].modqnDecision.actionLabel'],
    note: 'The selected action is explicit in visual-showcase-v1.',
  },
  'step.decisionMasks': {
    status: 'partial-producer-backed',
    currentConsumerPaths: [
      'timeline[].modqnDecision.decisionActionValidityMask',
      'diagnostics.decisionFrames[].decisionActionValidityMask',
    ],
    note: 'Decision validity masks may be present; they remain masks only, not scheduler truth.',
  },
  'step.handoverEvent': {
    status: 'partial-producer-backed',
    currentConsumerPaths: [
      'timeline[].handoverState.kind',
      'timeline[].handoverState.servingSatelliteId',
      'timeline[].handoverState.servingBeamId',
      'timeline[].handoverState.targetSatelliteId',
      'timeline[].handoverState.targetBeamId',
    ],
    sourceGapField: 'timeline.handoverPenaltyAttribution',
    note: 'Handover kind/source/target are exported, but penalty attribution is not a visual-showcase-v1 field.',
  },
  'step.reward': {
    status: 'producer-backed',
    currentConsumerPaths: ['timeline[].metrics.rewardScalar', 'timeline[].metrics.rewardVector', 'series.reward'],
    note: 'Reward values are exported by visual-showcase-v1.',
  },
  'step.angleAwareTerms': {
    status: 'partial-producer-backed',
    currentConsumerPaths: [
      'timeline[].beams[].gainDb',
      'timeline[].beams[].gainProvenance',
      'timeline[].satellites[].positionEcefKm',
    ],
    sourceGapField: 'metrics.angleAwareTerms',
    note: 'Some angle-adjacent display fields exist, but off-axis angle/steering loss terms are not formalized.',
  },
  'step.energyEfficiencyTerms': {
    status: 'partial-producer-backed',
    currentConsumerPaths: ['timeline[].metrics.throughputMbps'],
    sourceGapField: 'metrics.energyEfficiencyTerms',
    note: 'Throughput is present, but power, consumed energy, and Joule/bit terms are missing.',
  },
  'step.policyDiagnostics': {
    status: 'producer-backed',
    currentConsumerPaths: [
      'diagnostics.actionScores',
      'diagnostics.selectedAction',
      'diagnostics.decisionFrames',
      'timeline[].modqnDecision.selectedActionScore',
    ],
    note: 'Policy diagnostics are part of visual-showcase-v1.',
  },
  'step.sourceGaps': {
    status: 'display-derived',
    currentConsumerPaths: ['consumer source-gap registry'],
    note: 'visual-showcase-v1 has provenance and assumptions, but no structured per-step sourceGaps array.',
  },
} as const satisfies CoverageOverrideMap;

const COVERAGE_BY_SOURCE: Record<ModqnTrainingSceneInventorySource, CoverageOverrideMap> = {
  'phase03a-replay-bundle': PHASE03A_REPLAY_BUNDLE_COVERAGE,
  'user-trained-manifest': USER_TRAINED_MANIFEST_COVERAGE,
  'visual-showcase-v1': VISUAL_SHOWCASE_V1_COVERAGE,
};

const STATUS_RANK: Readonly<Record<ModqnTrainingSceneCoverageStatus, number>> = {
  'source-gap': 0,
  'display-derived': 1,
  'partial-producer-backed': 2,
  'producer-backed': 3,
};

function defaultGapCoverage(
  source: ModqnTrainingSceneInventorySource,
  requirement: ModqnTrainingSceneTraceRequirement,
): ModqnTrainingSceneSourceCoverage {
  return {
    field: requirement.field,
    source,
    status: 'source-gap',
    currentConsumerPaths: [],
    sourceGapField: requirement.sourceGapField,
    note: `No current ${source} consumer field satisfies ${requirement.field}.`,
  };
}

function withIdentity(
  source: ModqnTrainingSceneInventorySource,
  requirement: ModqnTrainingSceneTraceRequirement,
  override: CoverageOverride,
): ModqnTrainingSceneSourceCoverage {
  return {
    field: requirement.field,
    source,
    sourceGapField: override.sourceGapField ?? requirement.sourceGapField,
    ...override,
  };
}

export function getCurrentTrainingSceneTraceCoverage(
  source: ModqnTrainingSceneInventorySource,
): readonly ModqnTrainingSceneSourceCoverage[] {
  const overrides = COVERAGE_BY_SOURCE[source];
  return MODQN_TRAINING_SCENE_TRACE_REQUIREMENTS.map(requirement => {
    const override = overrides[requirement.field];
    return override === undefined
      ? defaultGapCoverage(source, requirement)
      : withIdentity(source, requirement, override);
  });
}

export function getCurrentTrainingSceneTraceCoverageForField(
  field: ModqnTrainingSceneTraceField,
): readonly ModqnTrainingSceneSourceCoverage[] {
  return (Object.keys(COVERAGE_BY_SOURCE) as ModqnTrainingSceneInventorySource[])
    .map(source => getCurrentTrainingSceneTraceCoverage(source).find(item => item.field === field))
    .filter((item): item is ModqnTrainingSceneSourceCoverage => item !== undefined);
}

export function getBestCurrentTrainingSceneTraceCoverage(
  field: ModqnTrainingSceneTraceField,
): ModqnTrainingSceneSourceCoverage {
  const coverage = getCurrentTrainingSceneTraceCoverageForField(field);
  if (coverage.length === 0) {
    throw new Error(`No MODQN training scene coverage entries for ${field}`);
  }
  return [...coverage].sort((a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status])[0];
}

export function countCurrentTrainingSceneTraceCoverageByStatus(
  source: ModqnTrainingSceneInventorySource,
): Readonly<Record<ModqnTrainingSceneCoverageStatus, number>> {
  const counts: Record<ModqnTrainingSceneCoverageStatus, number> = {
    'producer-backed': 0,
    'partial-producer-backed': 0,
    'display-derived': 0,
    'source-gap': 0,
  };
  for (const item of getCurrentTrainingSceneTraceCoverage(source)) {
    counts[item.status] += 1;
  }
  return counts;
}
