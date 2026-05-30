import type { ModqnReplaySourceGapField } from '../replay-source-gaps';

export type ModqnTrainingSceneLane =
  | 'live-demo-profile-preview'
  | 'baseline-replay-proof'
  | 'user-trained-model-replay'
  | 'training-run-replay'
  | 'model-comparison-replay'
  | 'artifact-replay';

export type ModqnTrainingSceneContractGroup =
  | 'provenance'
  | 'environment'
  | 'entities'
  | 'step'
  | 'comparison';

export type ModqnTrainingSceneTraceField =
  | 'provenance.schemaVersion'
  | 'provenance.runIdentity'
  | 'provenance.producerRevision'
  | 'provenance.artifactHashes'
  | 'provenance.claimBoundary'
  | 'provenance.seedSet'
  | 'environment.topology'
  | 'environment.scheduler'
  | 'environment.frequencyReuse'
  | 'environment.ueMobility'
  | 'environment.channelModel'
  | 'environment.objectiveWeights'
  | 'environment.handoverPenalty'
  | 'environment.algorithmFlags'
  | 'entities.satellites'
  | 'entities.cells'
  | 'entities.beams'
  | 'entities.ues'
  | 'entities.models'
  | 'step.timeIndex'
  | 'step.satelliteState'
  | 'step.beamFootprints'
  | 'step.allUePositions'
  | 'step.allUeServingHistory'
  | 'step.focusUe'
  | 'step.previousServing'
  | 'step.selectedServing'
  | 'step.selectedAction'
  | 'step.decisionMasks'
  | 'step.activeBeamSchedule'
  | 'step.nextBeamSchedule'
  | 'step.handoverEvent'
  | 'step.reward'
  | 'step.angleAwareTerms'
  | 'step.energyEfficiencyTerms'
  | 'step.policyDiagnostics'
  | 'step.sourceGaps'
  | 'comparison.alignedTimebase'
  | 'comparison.perModelStreams'
  | 'comparison.aggregateMetrics';

export type ModqnTrainingSceneProducerOwner =
  | 'modqn-paper-reproduction'
  | 'ntn-sim-core'
  | 'visual-showcase-v1';

export interface ModqnTrainingSceneLaneContract {
  readonly lane: ModqnTrainingSceneLane;
  readonly displayName: string;
  readonly sceneLane: 'modqn-live-cell-preview' | 'modqn-replay-proof' | 'artifact-replay' | 'future-lane';
  readonly truthSource: string;
  readonly proofClaimAllowed: boolean;
  readonly profileDerivedOverlayAllowed: boolean;
  readonly sinrLiveVisualsAllowed: boolean;
  readonly missingTruthPolicy: 'display-derived-ok' | 'source-gap' | 'fail-closed';
  readonly note: string;
}

export interface ModqnTrainingSceneTraceRequirement {
  readonly field: ModqnTrainingSceneTraceField;
  readonly group: ModqnTrainingSceneContractGroup;
  readonly producerOwner: ModqnTrainingSceneProducerOwner;
  readonly requiredProducerPaths: readonly string[];
  readonly requiredForLanes: readonly ModqnTrainingSceneLane[];
  readonly displayDerivedAllowed: boolean;
  readonly sourceGapWhenAbsent: boolean;
  readonly sourceGapField?: ModqnReplaySourceGapField;
  readonly note: string;
}

export const MODQN_TRAINING_SCENE_LANE_CONTRACTS = [
  {
    lane: 'live-demo-profile-preview',
    displayName: 'Live demo / profile-derived preview',
    sceneLane: 'modqn-live-cell-preview',
    truthSource: 'live/profile runtime plus Phase I cell schedule',
    proofClaimAllowed: false,
    profileDerivedOverlayAllowed: true,
    sinrLiveVisualsAllowed: true,
    missingTruthPolicy: 'display-derived-ok',
    note: 'May tell a demo story, but must stay labelled as not baseline proof.',
  },
  {
    lane: 'baseline-replay-proof',
    displayName: 'Baseline replay proof',
    sceneLane: 'modqn-replay-proof',
    truthSource: 'immutable producer replay bundle or validated visual-showcase-v1 artifact',
    proofClaimAllowed: true,
    profileDerivedOverlayAllowed: false,
    sinrLiveVisualsAllowed: false,
    missingTruthPolicy: 'source-gap',
    note: 'May only show producer-backed replay truth; missing active schedule remains a source gap.',
  },
  {
    lane: 'user-trained-model-replay',
    displayName: 'User-trained model replay',
    sceneLane: 'modqn-replay-proof',
    truthSource: 'immutable user-trained bundle and manifest',
    proofClaimAllowed: false,
    profileDerivedOverlayAllowed: false,
    sinrLiveVisualsAllowed: false,
    missingTruthPolicy: 'source-gap',
    note: 'Uses replay-proof rendering discipline but carries user-trained claim status.',
  },
  {
    lane: 'training-run-replay',
    displayName: 'Training run replay',
    sceneLane: 'future-lane',
    truthSource: 'producer training-run trace with episode/checkpoint timebase',
    proofClaimAllowed: false,
    profileDerivedOverlayAllowed: false,
    sinrLiveVisualsAllowed: false,
    missingTruthPolicy: 'source-gap',
    note: 'Shows training evolution only from producer trace fields, not from browser inference.',
  },
  {
    lane: 'model-comparison-replay',
    displayName: 'Model comparison replay',
    sceneLane: 'future-lane',
    truthSource: 'producer comparison artifact with aligned seeds and timebase',
    proofClaimAllowed: false,
    profileDerivedOverlayAllowed: false,
    sinrLiveVisualsAllowed: false,
    missingTruthPolicy: 'source-gap',
    note: 'Viewport ownership stays with one selected model; comparison deltas come from producer streams.',
  },
  {
    lane: 'artifact-replay',
    displayName: 'Artifact replay',
    sceneLane: 'artifact-replay',
    truthSource: 'validated visual-showcase-v1 artifact',
    proofClaimAllowed: true,
    profileDerivedOverlayAllowed: false,
    sinrLiveVisualsAllowed: false,
    missingTruthPolicy: 'fail-closed',
    note: 'Artifact-owned replay path; does not mount MODQN replay-proof overlays.',
  },
] as const satisfies readonly ModqnTrainingSceneLaneContract[];

const PROOF_LANES = [
  'baseline-replay-proof',
  'user-trained-model-replay',
  'training-run-replay',
  'model-comparison-replay',
] as const satisfies readonly ModqnTrainingSceneLane[];

const REPLAY_AND_ARTIFACT_LANES = [
  ...PROOF_LANES,
  'artifact-replay',
] as const satisfies readonly ModqnTrainingSceneLane[];

export const MODQN_TRAINING_SCENE_TRACE_REQUIREMENTS = [
  {
    field: 'provenance.schemaVersion',
    group: 'provenance',
    producerOwner: 'modqn-paper-reproduction',
    requiredProducerPaths: ['schemaVersion'],
    requiredForLanes: REPLAY_AND_ARTIFACT_LANES,
    displayDerivedAllowed: false,
    sourceGapWhenAbsent: true,
    sourceGapField: 'provenance.claimBoundary',
    note: 'Consumers need an explicit schema version before treating replay fields as truth.',
  },
  {
    field: 'provenance.runIdentity',
    group: 'provenance',
    producerOwner: 'modqn-paper-reproduction',
    requiredProducerPaths: ['runId', 'artifactId', 'modelId', 'policyId'],
    requiredForLanes: PROOF_LANES,
    displayDerivedAllowed: false,
    sourceGapWhenAbsent: true,
    sourceGapField: 'provenance.claimBoundary',
    note: 'Run, artifact, model, and policy IDs anchor replay evidence and comparison labels.',
  },
  {
    field: 'provenance.producerRevision',
    group: 'provenance',
    producerOwner: 'modqn-paper-reproduction',
    requiredProducerPaths: ['producer.repo', 'producer.commit', 'producer.branch', 'producer.dirty'],
    requiredForLanes: REPLAY_AND_ARTIFACT_LANES,
    displayDerivedAllowed: false,
    sourceGapWhenAbsent: true,
    sourceGapField: 'provenance.claimBoundary',
    note: 'Commit provenance cannot be reconstructed by leo-beam-sim.',
  },
  {
    field: 'provenance.artifactHashes',
    group: 'provenance',
    producerOwner: 'modqn-paper-reproduction',
    requiredProducerPaths: ['artifacts[].path', 'artifacts[].sha256'],
    requiredForLanes: REPLAY_AND_ARTIFACT_LANES,
    displayDerivedAllowed: false,
    sourceGapWhenAbsent: true,
    sourceGapField: 'provenance.claimBoundary',
    note: 'Artifact hashes are required before comparing or promoting evidence.',
  },
  {
    field: 'provenance.claimBoundary',
    group: 'provenance',
    producerOwner: 'modqn-paper-reproduction',
    requiredProducerPaths: ['provenance.claimBoundary', 'provenance.evidenceStatus'],
    requiredForLanes: REPLAY_AND_ARTIFACT_LANES,
    displayDerivedAllowed: false,
    sourceGapWhenAbsent: true,
    sourceGapField: 'provenance.claimBoundary',
    note: 'Evidence chips are producer claims, not display labels.',
  },
  {
    field: 'provenance.seedSet',
    group: 'provenance',
    producerOwner: 'modqn-paper-reproduction',
    requiredProducerPaths: ['seeds.environment', 'seeds.mobility', 'seeds.policy'],
    requiredForLanes: PROOF_LANES,
    displayDerivedAllowed: false,
    sourceGapWhenAbsent: true,
    sourceGapField: 'provenance.claimBoundary',
    note: 'Seeds are needed for deterministic replay and comparison auditability.',
  },
  {
    field: 'environment.topology',
    group: 'environment',
    producerOwner: 'modqn-paper-reproduction',
    requiredProducerPaths: ['environment.satellites', 'environment.shell', 'environment.coordinateFrame'],
    requiredForLanes: REPLAY_AND_ARTIFACT_LANES,
    displayDerivedAllowed: false,
    sourceGapWhenAbsent: true,
    sourceGapField: 'entities.satellites.trajectory',
    note: 'Topology controls whether satellite and beam identities are comparable across steps.',
  },
  {
    field: 'environment.scheduler',
    group: 'environment',
    producerOwner: 'modqn-paper-reproduction',
    requiredProducerPaths: ['environment.scheduler.activeBeamCapacity', 'environment.scheduler.beamHoppingEnabled'],
    requiredForLanes: PROOF_LANES,
    displayDerivedAllowed: false,
    sourceGapWhenAbsent: true,
    sourceGapField: 'beamHopping.activeSchedule',
    note: 'Scheduler settings are context only; per-step schedules still need step.activeBeamSchedule.',
  },
  {
    field: 'environment.frequencyReuse',
    group: 'environment',
    producerOwner: 'modqn-paper-reproduction',
    requiredProducerPaths: ['environment.frequencyReuseGroups'],
    requiredForLanes: REPLAY_AND_ARTIFACT_LANES,
    displayDerivedAllowed: false,
    sourceGapWhenAbsent: true,
    sourceGapField: 'timeline.frequencyReuseGroups',
    note: 'Frequency colors must not be invented from display beam indices.',
  },
  {
    field: 'environment.ueMobility',
    group: 'environment',
    producerOwner: 'modqn-paper-reproduction',
    requiredProducerPaths: ['environment.ueMobility', 'timeline[].ues[].position'],
    requiredForLanes: PROOF_LANES,
    displayDerivedAllowed: false,
    sourceGapWhenAbsent: true,
    sourceGapField: 'entities.ues.positionTrace',
    note: 'A static display position is not a producer mobility trace.',
  },
  {
    field: 'environment.channelModel',
    group: 'environment',
    producerOwner: 'modqn-paper-reproduction',
    requiredProducerPaths: ['environment.channel', 'environment.antenna', 'environment.pathLossModel'],
    requiredForLanes: REPLAY_AND_ARTIFACT_LANES,
    displayDerivedAllowed: false,
    sourceGapWhenAbsent: true,
    sourceGapField: 'metrics.angleAwareTerms',
    note: 'Channel labels and angle-aware terms need producer model parameters.',
  },
  {
    field: 'environment.objectiveWeights',
    group: 'environment',
    producerOwner: 'modqn-paper-reproduction',
    requiredProducerPaths: ['environment.objectiveWeights', 'reward.weights'],
    requiredForLanes: PROOF_LANES,
    displayDerivedAllowed: false,
    sourceGapWhenAbsent: true,
    sourceGapField: 'metrics.reward',
    note: 'Reward charts require the objective weights used by the run.',
  },
  {
    field: 'environment.handoverPenalty',
    group: 'environment',
    producerOwner: 'modqn-paper-reproduction',
    requiredProducerPaths: ['environment.handoverPenalty', 'reward.handoverPenaltyDefinition'],
    requiredForLanes: PROOF_LANES,
    displayDerivedAllowed: false,
    sourceGapWhenAbsent: true,
    sourceGapField: 'metrics.reward',
    note: 'Inter/intra penalty copy must match the producer reward definition.',
  },
  {
    field: 'environment.algorithmFlags',
    group: 'environment',
    producerOwner: 'modqn-paper-reproduction',
    requiredProducerPaths: ['environment.algorithmFlags.angleAware', 'environment.algorithmFlags.multiCatfish'],
    requiredForLanes: PROOF_LANES,
    displayDerivedAllowed: false,
    sourceGapWhenAbsent: true,
    sourceGapField: 'diagnostics.policy',
    note: 'The UI may not infer angle-aware or multi-catfish mode from display labels.',
  },
  {
    field: 'entities.satellites',
    group: 'entities',
    producerOwner: 'modqn-paper-reproduction',
    requiredProducerPaths: ['entities.satellites[].id', 'entities.satellites[].sourceId'],
    requiredForLanes: REPLAY_AND_ARTIFACT_LANES,
    displayDerivedAllowed: false,
    sourceGapWhenAbsent: true,
    sourceGapField: 'entities.satellites.trajectory',
    note: 'Stable satellite IDs are required for old/new serving identity.',
  },
  {
    field: 'entities.cells',
    group: 'entities',
    producerOwner: 'modqn-paper-reproduction',
    requiredProducerPaths: ['entities.cells[].id', 'entities.cells[].geometry'],
    requiredForLanes: PROOF_LANES,
    displayDerivedAllowed: false,
    sourceGapWhenAbsent: true,
    sourceGapField: 'timeline.activeCellState',
    note: 'Cell geometry is needed before active/inactive cell claims.',
  },
  {
    field: 'entities.beams',
    group: 'entities',
    producerOwner: 'modqn-paper-reproduction',
    requiredProducerPaths: ['entities.beams[].id', 'entities.beams[].satelliteId', 'entities.beams[].localBeamIndex'],
    requiredForLanes: REPLAY_AND_ARTIFACT_LANES,
    displayDerivedAllowed: false,
    sourceGapWhenAbsent: true,
    sourceGapField: 'entities.beams.footprints',
    note: 'Beam labels can be formatted in the UI, but identities must be producer-owned.',
  },
  {
    field: 'entities.ues',
    group: 'entities',
    producerOwner: 'modqn-paper-reproduction',
    requiredProducerPaths: ['entities.ues[].id', 'entities.ues[].trajectoryRef'],
    requiredForLanes: PROOF_LANES,
    displayDerivedAllowed: false,
    sourceGapWhenAbsent: true,
    sourceGapField: 'entities.ues.positionTrace',
    note: 'Focus UE and mobility stories require stable UE identity.',
  },
  {
    field: 'entities.models',
    group: 'entities',
    producerOwner: 'modqn-paper-reproduction',
    requiredProducerPaths: ['models[].modelId', 'models[].checkpointId', 'models[].claimStatus'],
    requiredForLanes: ['user-trained-model-replay', 'training-run-replay', 'model-comparison-replay'],
    displayDerivedAllowed: false,
    sourceGapWhenAbsent: true,
    sourceGapField: 'diagnostics.policy',
    note: 'Model labels and comparison lanes need producer-owned model identity.',
  },
  {
    field: 'step.timeIndex',
    group: 'step',
    producerOwner: 'modqn-paper-reproduction',
    requiredProducerPaths: ['timeline[].episodeIndex', 'timeline[].slotIndex', 'timeline[].stepIndex', 'timeline[].timeSec'],
    requiredForLanes: REPLAY_AND_ARTIFACT_LANES,
    displayDerivedAllowed: false,
    sourceGapWhenAbsent: true,
    sourceGapField: 'timeline.sourceRowIdentity',
    note: 'Timeline ordering must come from producer step identity.',
  },
  {
    field: 'step.satelliteState',
    group: 'step',
    producerOwner: 'modqn-paper-reproduction',
    requiredProducerPaths: ['timeline[].satellites[].position', 'timeline[].satellites[].elevation', 'timeline[].satellites[].azimuth'],
    requiredForLanes: REPLAY_AND_ARTIFACT_LANES,
    displayDerivedAllowed: false,
    sourceGapWhenAbsent: true,
    sourceGapField: 'entities.satellites.trajectory',
    note: 'Satellite paths shown as truth require producer renderable samples.',
  },
  {
    field: 'step.beamFootprints',
    group: 'step',
    producerOwner: 'modqn-paper-reproduction',
    requiredProducerPaths: ['timeline[].beams[].footprint', 'timeline[].beams[].angleConvention'],
    requiredForLanes: REPLAY_AND_ARTIFACT_LANES,
    displayDerivedAllowed: false,
    sourceGapWhenAbsent: true,
    sourceGapField: 'entities.beams.footprints',
    note: 'Physical beam footprints cannot be inferred from a seven-beam display template.',
  },
  {
    field: 'step.allUePositions',
    group: 'step',
    producerOwner: 'modqn-paper-reproduction',
    requiredProducerPaths: ['timeline[].ues[].position'],
    requiredForLanes: PROOF_LANES,
    displayDerivedAllowed: false,
    sourceGapWhenAbsent: true,
    sourceGapField: 'entities.ues.positionTrace',
    note: 'All-UE overlays and focus trails need producer UE positions.',
  },
  {
    field: 'step.allUeServingHistory',
    group: 'step',
    producerOwner: 'modqn-paper-reproduction',
    requiredProducerPaths: ['timeline[].ues[].serving.satelliteId', 'timeline[].ues[].serving.beamId'],
    requiredForLanes: PROOF_LANES,
    displayDerivedAllowed: false,
    sourceGapWhenAbsent: true,
    sourceGapField: 'timeline.allUeServingHistory',
    note: 'Serving maps require all UE serving state, not only the focused decision row.',
  },
  {
    field: 'step.focusUe',
    group: 'step',
    producerOwner: 'modqn-paper-reproduction',
    requiredProducerPaths: ['timeline[].focusUeId', 'timeline[].focusReason'],
    requiredForLanes: PROOF_LANES,
    displayDerivedAllowed: true,
    sourceGapWhenAbsent: true,
    sourceGapField: 'timeline.focusUeSelection',
    note: 'The UI may display-select a UE only when labelled as display-selected.',
  },
  {
    field: 'step.previousServing',
    group: 'step',
    producerOwner: 'modqn-paper-reproduction',
    requiredProducerPaths: ['timeline[].previousServing.satelliteId', 'timeline[].previousServing.beamId'],
    requiredForLanes: PROOF_LANES,
    displayDerivedAllowed: false,
    sourceGapWhenAbsent: true,
    sourceGapField: 'timeline.allUeServingHistory',
    note: 'Old serving identity supports handover narrative but is not beam hopping schedule truth.',
  },
  {
    field: 'step.selectedServing',
    group: 'step',
    producerOwner: 'modqn-paper-reproduction',
    requiredProducerPaths: ['timeline[].selectedServing.satelliteId', 'timeline[].selectedServing.beamId'],
    requiredForLanes: PROOF_LANES,
    displayDerivedAllowed: false,
    sourceGapWhenAbsent: true,
    sourceGapField: 'timeline.allUeServingHistory',
    note: 'Selected serving identity supports decision narrative but is not active-beam schedule truth.',
  },
  {
    field: 'step.selectedAction',
    group: 'step',
    producerOwner: 'modqn-paper-reproduction',
    requiredProducerPaths: ['timeline[].selectedAction.index', 'timeline[].selectedAction.identity'],
    requiredForLanes: PROOF_LANES,
    displayDerivedAllowed: false,
    sourceGapWhenAbsent: true,
    sourceGapField: 'diagnostics.policy',
    note: 'Action labels can be formatted, but the action identity must be exported.',
  },
  {
    field: 'step.decisionMasks',
    group: 'step',
    producerOwner: 'modqn-paper-reproduction',
    requiredProducerPaths: ['timeline[].visibilityMask', 'timeline[].actionValidityMask', 'timeline[].decisionActionValidityMask'],
    requiredForLanes: PROOF_LANES,
    displayDerivedAllowed: false,
    sourceGapWhenAbsent: true,
    sourceGapField: 'diagnostics.policy',
    note: 'Masks explain candidate validity but must never replace active schedule truth.',
  },
  {
    field: 'step.activeBeamSchedule',
    group: 'step',
    producerOwner: 'modqn-paper-reproduction',
    requiredProducerPaths: ['timeline[].activeBeamSchedule[].cellId', 'timeline[].activeBeamSchedule[].satId', 'timeline[].activeBeamSchedule[].beamId'],
    requiredForLanes: PROOF_LANES,
    displayDerivedAllowed: false,
    sourceGapWhenAbsent: true,
    sourceGapField: 'beamHopping.activeSchedule',
    note: 'Required before active/inactive beam rendering or beam hopping animation.',
  },
  {
    field: 'step.nextBeamSchedule',
    group: 'step',
    producerOwner: 'modqn-paper-reproduction',
    requiredProducerPaths: ['timeline[].nextActiveBeamSchedule[].cellId', 'timeline[].nextActiveBeamSchedule[].satId', 'timeline[].nextActiveBeamSchedule[].beamId'],
    requiredForLanes: PROOF_LANES,
    displayDerivedAllowed: false,
    sourceGapWhenAbsent: true,
    sourceGapField: 'beamHopping.nextSchedule',
    note: 'Required before next-beam preview or lookahead animation.',
  },
  {
    field: 'step.handoverEvent',
    group: 'step',
    producerOwner: 'modqn-paper-reproduction',
    requiredProducerPaths: ['timeline[].handoverEvent.kind', 'timeline[].handoverEvent.source', 'timeline[].handoverEvent.target'],
    requiredForLanes: PROOF_LANES,
    displayDerivedAllowed: false,
    sourceGapWhenAbsent: true,
    sourceGapField: 'timeline.handoverPenaltyAttribution',
    note: 'Inter/intra labels must come from producer event truth.',
  },
  {
    field: 'step.reward',
    group: 'step',
    producerOwner: 'modqn-paper-reproduction',
    requiredProducerPaths: ['timeline[].reward.scalar', 'timeline[].reward.vector'],
    requiredForLanes: PROOF_LANES,
    displayDerivedAllowed: false,
    sourceGapWhenAbsent: true,
    sourceGapField: 'metrics.reward',
    note: 'Reward values and handover penalty attribution are producer metrics.',
  },
  {
    field: 'step.angleAwareTerms',
    group: 'step',
    producerOwner: 'modqn-paper-reproduction',
    requiredProducerPaths: ['timeline[].angleAwareTerms.offAxisAngleDeg', 'timeline[].angleAwareTerms.antennaGainDb'],
    requiredForLanes: PROOF_LANES,
    displayDerivedAllowed: false,
    sourceGapWhenAbsent: true,
    sourceGapField: 'metrics.angleAwareTerms',
    note: 'Angle-aware visual proof requires producer-exported per-step terms.',
  },
  {
    field: 'step.energyEfficiencyTerms',
    group: 'step',
    producerOwner: 'modqn-paper-reproduction',
    requiredProducerPaths: ['timeline[].energyEfficiencyTerms.throughputBps', 'timeline[].energyEfficiencyTerms.joulePerBit'],
    requiredForLanes: PROOF_LANES,
    displayDerivedAllowed: false,
    sourceGapWhenAbsent: true,
    sourceGapField: 'metrics.energyEfficiencyTerms',
    note: 'Energy efficiency labels require producer power and throughput terms.',
  },
  {
    field: 'step.policyDiagnostics',
    group: 'step',
    producerOwner: 'modqn-paper-reproduction',
    requiredProducerPaths: ['timeline[].policyDiagnostics.qValues', 'timeline[].policyDiagnostics.topCandidates'],
    requiredForLanes: ['training-run-replay', 'model-comparison-replay'],
    displayDerivedAllowed: false,
    sourceGapWhenAbsent: true,
    sourceGapField: 'diagnostics.policy',
    note: 'Q values and policy candidate comparisons must be producer diagnostics.',
  },
  {
    field: 'step.sourceGaps',
    group: 'step',
    producerOwner: 'modqn-paper-reproduction',
    requiredProducerPaths: ['timeline[].sourceGaps[]'],
    requiredForLanes: PROOF_LANES,
    displayDerivedAllowed: true,
    sourceGapWhenAbsent: false,
    note: 'Consumers may add display source gaps, but must preserve producer gaps when present.',
  },
  {
    field: 'comparison.alignedTimebase',
    group: 'comparison',
    producerOwner: 'modqn-paper-reproduction',
    requiredProducerPaths: ['comparison.sharedEnvironmentId', 'comparison.timebase', 'comparison.seedSet'],
    requiredForLanes: ['model-comparison-replay'],
    displayDerivedAllowed: false,
    sourceGapWhenAbsent: true,
    sourceGapField: 'comparison.alignedTimebase',
    note: 'Comparison requires producer alignment; the renderer must not align unrelated runs heuristically.',
  },
  {
    field: 'comparison.perModelStreams',
    group: 'comparison',
    producerOwner: 'modqn-paper-reproduction',
    requiredProducerPaths: ['comparison.models[].timeline[]', 'comparison.models[].sourceGaps[]'],
    requiredForLanes: ['model-comparison-replay'],
    displayDerivedAllowed: false,
    sourceGapWhenAbsent: true,
    sourceGapField: 'diagnostics.policy',
    note: 'Per-model decisions, rewards, and handover events are producer streams.',
  },
  {
    field: 'comparison.aggregateMetrics',
    group: 'comparison',
    producerOwner: 'modqn-paper-reproduction',
    requiredProducerPaths: ['comparison.aggregateMetrics'],
    requiredForLanes: ['model-comparison-replay'],
    displayDerivedAllowed: false,
    sourceGapWhenAbsent: true,
    sourceGapField: 'metrics.reward',
    note: 'Aggregate comparison metrics must be computed by the producer.',
  },
] as const satisfies readonly ModqnTrainingSceneTraceRequirement[];

export function getTrainingSceneLaneContract(
  lane: ModqnTrainingSceneLane,
): ModqnTrainingSceneLaneContract {
  const contract = MODQN_TRAINING_SCENE_LANE_CONTRACTS.find(item => item.lane === lane);
  if (contract === undefined) {
    throw new Error(`Unknown MODQN training scene lane: ${lane}`);
  }
  return contract;
}

export function getTrainingSceneTraceRequirementsForLane(
  lane: ModqnTrainingSceneLane,
): readonly ModqnTrainingSceneTraceRequirement[] {
  return MODQN_TRAINING_SCENE_TRACE_REQUIREMENTS.filter(requirement => (
    (requirement.requiredForLanes as readonly ModqnTrainingSceneLane[]).includes(lane)
  ));
}

export function getTrainingSceneSourceGapFieldsForLane(
  lane: ModqnTrainingSceneLane,
): readonly ModqnReplaySourceGapField[] {
  const fields = new Set<ModqnReplaySourceGapField>();
  for (const requirement of getTrainingSceneTraceRequirementsForLane(lane)) {
    if (requirement.sourceGapWhenAbsent && requirement.sourceGapField !== undefined) {
      fields.add(requirement.sourceGapField);
    }
  }
  return [...fields];
}

export function getDisplayDerivedTrainingSceneFields(): readonly ModqnTrainingSceneTraceField[] {
  return MODQN_TRAINING_SCENE_TRACE_REQUIREMENTS
    .filter(requirement => requirement.displayDerivedAllowed)
    .map(requirement => requirement.field);
}
