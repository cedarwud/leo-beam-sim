export const MODQN_REPLAY_BUNDLE_SCHEMA_VERSION = 'phase-03a-replay-bundle-v1' as const;
export const MODQN_PAPER_ID = 'PAP-2024-MORL-MULTIBEAM' as const;
export const MODQN_BEAM_CATALOG_ORDER = 'satellite-major-beam-minor' as const;

export type ModqnReplayBundleSchemaVersion = typeof MODQN_REPLAY_BUNDLE_SCHEMA_VERSION;
export type ModqnPaperId = typeof MODQN_PAPER_ID;
export type ModqnBeamCatalogOrder = typeof MODQN_BEAM_CATALOG_ORDER;

export type ModqnHandoverEventKind =
  | 'none'
  | 'intra-satellite-beam-switch'
  | 'inter-satellite-handover';

export type ModqnRewardVector = Readonly<Record<string, number>>;
export type ModqnProducerOwnedObject = Readonly<Record<string, unknown>>;
export type ModqnProducerAction = unknown;
export type ModqnProducerPosition = ModqnProducerOwnedObject;
export type ModqnKpiOverlay = ModqnProducerOwnedObject;

export interface ModqnBaselineSurface {
  readonly beamCountPerSatellite: number;
  readonly totalBeamCount: number;
  readonly episodesCompleted: number;
  readonly satelliteCount?: number;
  readonly userCount?: number;
  readonly methodFamily?: string;
  readonly [key: string]: unknown;
}

export interface ModqnClaimBoundary {
  readonly notFullPaperFaithfulReproduction: boolean;
  readonly not19Or37BeamTrainedEvidence: boolean;
  readonly paperId?: string;
  readonly [key: string]: unknown;
}

export interface ModqnUserTrainingMetadata {
  readonly jobId?: string;
  readonly submittedAtMs?: number;
  readonly trainerSubcommand?: string;
  readonly hyperparams?: ModqnProducerOwnedObject;
  readonly serviceVersion?: string;
  readonly [key: string]: unknown;
}

export interface ModqnReplayBundleManifest {
  readonly bundleSchemaVersion: ModqnReplayBundleSchemaVersion;
  readonly paperId: ModqnPaperId;
  readonly baselineSurface: ModqnBaselineSurface;
  readonly claimBoundary: ModqnClaimBoundary;
  readonly beamCatalogOrder?: ModqnBeamCatalogOrder;
  readonly replaySummary?: ModqnProducerOwnedObject;
  readonly optionalPolicyDiagnostics?: ModqnProducerOwnedObject;
  readonly userTrained?: boolean;
  readonly paperFaithful?: boolean;
  readonly userTrainingMetadata?: ModqnUserTrainingMetadata;
  readonly [key: string]: unknown;
}

export interface ModqnProvenanceMap {
  readonly bundleSchemaVersion: ModqnReplayBundleSchemaVersion;
  readonly fields?: ModqnProducerOwnedObject;
  readonly [key: string]: unknown;
}

export interface ModqnEvaluationSummary {
  readonly bundle_schema_version?: ModqnReplayBundleSchemaVersion;
  readonly paper_id?: ModqnPaperId;
  readonly [key: string]: unknown;
}

export interface ModqnBeamReference {
  readonly beamId: string;
  readonly beamIndex: number;
  readonly satId: string;
  readonly satIndex: number;
  readonly localBeamIndex: number;
  readonly validUnderDecisionMask?: boolean;
  readonly validUnderPostStepMask?: boolean;
  readonly [key: string]: unknown;
}

export interface ModqnHandoverEvent {
  readonly kind: ModqnHandoverEventKind;
  readonly eventId: string | null;
  readonly [key: string]: unknown;
}

export interface ModqnSatelliteState {
  readonly satId: string;
  readonly satIndex: number;
  readonly [key: string]: unknown;
}

export interface ModqnBeamState extends ModqnBeamReference {
  readonly centerPosition?: ModqnProducerOwnedObject;
  readonly centerLocalTangentKm?: ModqnProducerOwnedObject;
}

export interface ModqnPolicyCandidate extends ModqnBeamReference {
  readonly objectiveQ?: ModqnRewardVector;
  readonly scalarizedQ?: number;
}

export interface ModqnDenseObjectiveQByAction {
  readonly q1Throughput?: number;
  readonly q2Handover?: number;
  readonly q3LoadBalance?: number;
  readonly r1Throughput?: number;
  readonly r2Handover?: number;
  readonly r3LoadBalance?: number;
  readonly throughput?: number;
  readonly handover?: number;
  readonly loadBalance?: number;
  readonly [key: string]: unknown;
}

export type ModqnInvalidActionSentinel = '-inf' | '-Infinity' | 'negative-infinity' | number | string;

export interface ModqnPolicyDiagnostics {
  readonly diagnosticsVersion?: string;
  readonly objectiveWeights?: ModqnRewardVector;
  readonly selectedScalarizedQ?: number;
  readonly runnerUpScalarizedQ?: number;
  readonly scalarizedMarginToRunnerUp?: number;
  readonly availableActionCount?: number;
  readonly topCandidates?: readonly ModqnPolicyCandidate[];
  /**
   * D5 dense-Q proof fields. `denseActionScores` is only scalarized display
   * data; producer proof requires full per-action objective Q plus the mask,
   * selected action, tie-break, and invalid-action sentinel below.
   */
  readonly denseActionScores?: readonly number[];
  readonly actionScoreValidityMask?: readonly boolean[];
  readonly actionOrder?: readonly string[];
  readonly objectiveQByAction?: readonly ModqnDenseObjectiveQByAction[];
  readonly scalarizedQByAction?: readonly unknown[];
  readonly selectedActionIndex?: number;
  readonly tieBreak?: string;
  readonly invalidActionSentinel?: ModqnInvalidActionSentinel;
  readonly [key: string]: unknown;
}

export interface ModqnReplayTimelineRow {
  readonly slotIndex: number;
  readonly timeSec: number;
  readonly decisionTimeSec: number;
  readonly userId: string;
  readonly userIndex: number;
  readonly action?: ModqnProducerAction;
  readonly userPosition: ModqnProducerPosition;
  readonly decisionUserPosition: ModqnProducerPosition;
  readonly previousServing: ModqnBeamReference;
  readonly selectedServing: ModqnBeamReference;
  readonly handoverEvent: ModqnHandoverEvent;
  readonly beamCatalogOrder: ModqnBeamCatalogOrder;
  readonly visibilityMask: readonly boolean[];
  readonly actionValidityMask: readonly boolean[];
  readonly decisionVisibilityMask: readonly boolean[];
  readonly decisionActionValidityMask: readonly boolean[];
  readonly beamLoads: readonly number[];
  readonly beamThroughputs: readonly number[];
  readonly rewardVector: ModqnRewardVector;
  readonly scalarReward: number;
  readonly satelliteStates: readonly ModqnSatelliteState[];
  readonly beamStates: readonly ModqnBeamState[];
  readonly kpiOverlay: ModqnKpiOverlay;
  readonly policyDiagnostics?: ModqnPolicyDiagnostics;
  readonly [key: string]: unknown;
}

export interface ModqnReplayBundle {
  readonly sourcePath?: string;
  readonly manifest: ModqnReplayBundleManifest;
  readonly provenanceMap: ModqnProvenanceMap;
  readonly timelineRows: readonly ModqnReplayTimelineRow[];
  readonly evaluationSummary?: ModqnEvaluationSummary;
}

export interface ModqnReplayBundleContents {
  readonly sourcePath?: string;
  readonly manifestJson: string;
  readonly provenanceMapJson: string;
  readonly timelineJsonl: string;
  readonly evaluationSummaryJson?: string;
}
