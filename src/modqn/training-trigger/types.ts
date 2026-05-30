export type TrainerSubcommand = 'baseline' | 'ee-modqn' | 'multi-catfish';
export type TrainingProfile = 'legacy-baseline' | 'track2';
export type TrainingArm = 'a1' | 'a4' | 'a5_hobs';
export type TrainingRequestMode = 'exploration' | 'evaluation';

export type JobStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled' | 'expired';

export interface ObjectiveWeights {
  readonly throughput: number;
  readonly handover: number;
  readonly loadBalance: number;
}

export interface TrainingHyperparams {
  readonly episodes: number;
  readonly learningRate?: number;
  readonly discountGamma?: number;
  readonly hiddenDim?: number;
  readonly batchSize?: number;
  readonly objectiveWeights?: ObjectiveWeights;
  readonly seedTriplet?: readonly [number, number, number];
  readonly device?: 'cpu' | 'cuda' | string;
  readonly [key: string]: unknown;
}

export interface UeAreaConfig {
  readonly distribution: 'uniform-circular' | 'uniform-rectangle';
  readonly radiusKm?: number;
  readonly widthKm?: number;
  readonly heightKm?: number;
  readonly mobilityModel: 'deterministic-heading' | 'random-wandering';
  readonly randomWanderingMaxTurnRad?: number;
}

export interface AntennaConfig {
  readonly beamsPerSatellite: 7;
  readonly theta3dbDeg: number;
}

export interface ChannelConfig {
  readonly carrierFrequencyGhz: number;
  readonly bandwidthMhz: number;
  readonly txPowerW: number;
  readonly ricianKDb: number;
  readonly atmosphericAttenuationDbPerKm: number;
}

export interface EnvAxes {
  readonly nSatellites: number;
  readonly altitudeKm: number;
  readonly satelliteSpeedKmS: number;
  readonly nUsers: number;
  readonly userSpeedKmh: number;
  readonly antiCollapseMaxUsersPerBeam: number;
  readonly qosThresholdBps: number;
  readonly ueArea: UeAreaConfig;
  readonly antenna: AntennaConfig;
  readonly channel: ChannelConfig;
}

export interface HobsConfig {
  readonly gammaOsDb: number;
  readonly tThresholdSteps: number;
  readonly eHoPerEventJ: number;
}

export interface MultiCatfishV2Config {
  readonly catfishEnabled: true;
  readonly catfishAlpha?: number;
  readonly quotaEe?: number;
  readonly quotaHo?: number;
  readonly quotaLoad?: number;
  readonly mainShareFloor?: number;
  readonly vdnLossScale?: number;
  readonly vdnPooling?: 'mean';
  readonly identityMode?: 'one_hot';
  readonly snapshotBatchSize?: number;
  readonly featureNormalization?: boolean;
  readonly softmaxTemperature?: number;
}

export interface EvaluationProvenance {
  readonly preRegSddPath: string;
  readonly preRegSddSha256: string;
  readonly preRegJsonPath: string;
  readonly preRegJsonSha256: string;
}

export interface Track2Config {
  readonly arm: TrainingArm;
  readonly r1RewardMode?: 'angle_aware_ee';
  readonly envAxes: EnvAxes;
  readonly hobsConfig?: HobsConfig;
  readonly multiCatfishV2?: MultiCatfishV2Config;
  readonly requestMode?: TrainingRequestMode;
  readonly evaluationProvenance?: EvaluationProvenance;
  readonly evalOnlyAxes?: Record<string, readonly number[]>;
}

export interface TrainingRequest {
  readonly trainingProfile?: TrainingProfile;
  readonly trainerSubcommand?: TrainerSubcommand;
  readonly hyperparams: TrainingHyperparams;
  readonly track2?: Track2Config;
}

export interface LeoTrainingRunConfig {
  readonly schema: 'leo-modqn-training-run-config-v1';
  readonly jobId: string;
  readonly createdAtMs: number;
  readonly producerTruthOwner: 'modqn-paper-reproduction';
  readonly orchestrator: {
    readonly owner: 'leo-beam-sim';
    readonly role: 'job-orchestration-only';
    readonly producerServiceBaseUrl: string;
    readonly ntnSimCoreRuntimeDependency: false;
  };
  readonly request: TrainingRequest;
}

export interface LeoProducerDispatchEnvelope {
  readonly schema: 'leo-modqn-producer-dispatch-request-v1';
  readonly producerTruthOwner: 'modqn-paper-reproduction';
  readonly consumerOwner: 'leo-beam-sim';
  readonly requestedBy: 'leo-beam-sim-training-orchestrator';
  readonly ntnSimCoreRuntimeDependency: false;
  readonly runConfig: LeoTrainingRunConfig;
}

export interface TrainingDispatchAck {
  readonly status: 'accepted';
  readonly schema: 'leo-modqn-producer-dispatch-request-v1' | string;
  readonly producerTruthOwner: 'modqn-paper-reproduction' | string;
  readonly consumerOwner: 'leo-beam-sim' | string;
  readonly truthMutation: 'none' | string;
  readonly ntnSimCoreRuntimeDependency: false;
}

export interface PostTrainResponse {
  readonly jobId: string;
  readonly status: 'queued';
  readonly estimatedStartAtMs: number | null;
  readonly trainingProfile?: TrainingProfile;
  readonly arm?: TrainingArm | null;
  readonly artifactTag?: 'user-trained';
  readonly dispatch?: TrainingDispatchAck | null;
  readonly [key: string]: unknown;
}

export interface TrainingJobSummary {
  readonly jobId: string;
  readonly status: JobStatus;
  readonly submittedAtMs: number;
  readonly startedAtMs?: number;
  readonly finishedAtMs?: number;
  readonly trainerSubcommand: TrainerSubcommand;
  readonly trainingProfile?: TrainingProfile;
  readonly arm?: TrainingArm | null;
  readonly batchId?: string | null;
  readonly submissionSchema?: 'modqn-training-request-v1' | 'leo-modqn-producer-dispatch-request-v1' | string | null;
  readonly artifactTag?: 'user-trained';
  readonly hyperparamSummary: string;
  readonly artifactPath?: string;
  readonly [key: string]: unknown;
}

export interface TrainingJobDetail extends TrainingJobSummary {
  readonly hyperparams: TrainingHyperparams;
  readonly request?: TrainingRequest | null;
  readonly manifestPath?: string | null;
  readonly dispatchEnvelope?: LeoProducerDispatchEnvelope | null;
  readonly progressEventCount?: number;
  readonly trainingTruth?: TrainingTruth | null;
  readonly errorMessage?: string;
  readonly stdoutTail?: string;
  readonly stderrTail?: string;
}

export interface TrainingTruth {
  readonly envAxes?: EnvAxes;
  readonly objectiveWeights?: ObjectiveWeights;
  readonly seedTriplet?: readonly number[];
  readonly hobsConfig?: HobsConfig | null;
  readonly multiCatfishV2?: MultiCatfishV2Config | null;
}

export interface TrainingServiceManifest {
  readonly schema: 'modqn-training-service-artifact-manifest-v1' | string;
  readonly serviceVersion?: string;
  readonly jobId: string;
  readonly batchId?: string | null;
  readonly artifactTag: 'user-trained';
  readonly claimMode?: 'exploration' | 'pre-registered-evaluation' | string;
  readonly userTrained: true;
  readonly paperFaithful: false;
  readonly effectivenessClaimAuthorized: false;
  readonly trainingProfile?: TrainingProfile;
  readonly trainerSubcommand?: TrainerSubcommand;
  readonly arm?: TrainingArm;
  readonly requestSha256?: string;
  readonly configFingerprintSha256?: string;
  readonly rawRun?: {
    readonly path?: string;
    readonly manifestPresent?: boolean;
    readonly manifestPath?: string | null;
    readonly trainingLogPath?: string;
    readonly runMetadataPath?: string;
    readonly checkpointPaths?: readonly string[];
  };
  readonly replayBundle?: {
    readonly present?: boolean;
    readonly path?: string | null;
    readonly manifestPath?: string | null;
    readonly exportError?: string | null;
  };
  readonly trainingTruth?: TrainingTruth;
  readonly raw?: Record<string, unknown>;
}

export interface TrainingRunMetadata {
  readonly schema?: string;
  readonly arm?: TrainingArm | string;
  readonly seed_triplet?: readonly number[];
  readonly episode_count?: number;
  readonly episode_budget?: number;
  readonly objective_weights?: readonly number[];
  readonly [key: string]: unknown;
}

export interface TrainingProgressEvent {
  readonly id: number;
  readonly tsMs: number;
  readonly jobId: string;
  readonly type: 'queued' | 'heartbeat' | 'progress' | 'done' | 'failed' | string;
  readonly status: JobStatus | 'running';
  readonly episode?: number;
  readonly episodeBudget?: number;
  readonly metrics?: Record<string, number>;
  readonly manifestPath?: string;
  readonly errorMessage?: string;
  readonly exitCode?: number | null;
  readonly [key: string]: unknown;
}

export interface SweepAxis {
  readonly path: string;
  readonly values: readonly unknown[];
}

export interface SensitivitySweepRequest {
  readonly requestMode?: TrainingRequestMode;
  readonly baseRequest: TrainingRequest;
  readonly matrix: {
    readonly axes: readonly SweepAxis[];
    readonly mode?: 'single-axis-from-base';
  };
  readonly seeds?: readonly (readonly [number, number, number])[];
  readonly evalOnlyAxes?: Record<string, readonly number[]>;
}

export interface SensitivitySweepResponse {
  readonly batchId: string;
  readonly status: 'queued' | 'running' | 'done' | 'failed' | 'partial';
  readonly jobIds: readonly string[];
  readonly requestSha256: string;
  readonly deduplicated: boolean;
}

export interface BatchJobSummary {
  readonly jobId: string;
  readonly status: JobStatus;
  readonly cellIndex: number;
  readonly seedIndex: number;
  readonly axisLabel: string;
  readonly axisValue: string;
  readonly artifactPath?: string | null;
  readonly errorMessage?: string | null;
}

export interface BatchDetail {
  readonly batchId: string;
  readonly status: 'queued' | 'running' | 'done' | 'failed' | 'partial';
  readonly submittedAtMs: number;
  readonly finishedAtMs?: number | null;
  readonly requestSha256: string;
  readonly counts: Record<string, number>;
  readonly jobs: readonly BatchJobSummary[];
  readonly errorMessage?: string | null;
}

export interface ServiceClientConfig {
  readonly baseUrl: string;
  readonly probeTimeoutMs?: number;
}

export interface ServiceAvailability {
  readonly reachable: boolean;
  readonly latencyMs: number | null;
  readonly version?: string;
  readonly error?: string;
}
