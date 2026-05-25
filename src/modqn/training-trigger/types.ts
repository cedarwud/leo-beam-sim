export type TrainerSubcommand = 'baseline' | 'ee-modqn' | 'multi-catfish';

export type JobStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled' | 'expired';

export interface TrainingHyperparams {
  readonly episodes: number;
  readonly learningRate?: number;
  readonly discountGamma?: number;
  readonly hiddenDim?: number;
  readonly batchSize?: number;
  readonly objectiveWeights?: {
    readonly throughput: number;
    readonly handover: number;
    readonly loadBalance: number;
  };
  readonly seedTriplet?: readonly [number, number, number];
  readonly [key: string]: unknown;
}

export interface TrainingRequest {
  readonly trainerSubcommand: TrainerSubcommand;
  readonly hyperparams: TrainingHyperparams;
}

export interface TrainingJobSummary {
  readonly jobId: string;
  readonly status: JobStatus;
  readonly submittedAtMs: number;
  readonly finishedAtMs?: number;
  readonly trainerSubcommand: TrainerSubcommand;
  readonly hyperparamSummary: string;
  readonly artifactPath?: string;
  readonly [key: string]: unknown;
}

export interface TrainingJobDetail extends TrainingJobSummary {
  readonly hyperparams: TrainingHyperparams;
  readonly errorMessage?: string;
  readonly stdoutTail?: string;
  readonly stderrTail?: string;
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
