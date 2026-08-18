import type { SimulationAnalysisFrameBuildOptions } from '../../simulator/analysis';
import type { LoadedTleSnapshotSelection, SimulatorParameters } from '../../simulator/types';
import type { TleAnalysisRunSnapshot } from '../../simulator/tleAnalysisRun';
import type { PassPlan } from '../pass';
import type { TleRunBundleSnapshot, TleRunProgress } from './index';

export const TLE_RUN_WORKER_PROTOCOL = 'tle-run-worker-v1' as const;

export interface TleRunWorkerBuildRequest {
  readonly type: 'build';
  readonly protocol: typeof TLE_RUN_WORKER_PROTOCOL;
  readonly requestId: string;
  readonly selection: LoadedTleSnapshotSelection;
  readonly t0Utc: string;
  readonly parameters: SimulatorParameters;
  readonly frameOptions: Readonly<SimulationAnalysisFrameBuildOptions>;
}

/**
 * Rebuild only the canonical analysis projections from an accepted geometry
 * snapshot and pass plan.  The geometry snapshot is detached at the Worker
 * boundary, but it is never rebuilt or propagated again.
 */
export interface TleRunWorkerRebuildAnalysisRequest {
  readonly type: 'rebuild-analysis';
  readonly protocol: typeof TLE_RUN_WORKER_PROTOCOL;
  readonly requestId: string;
  readonly selection: LoadedTleSnapshotSelection;
  readonly geometryRun: TleRunBundleSnapshot;
  readonly passPlan: PassPlan;
  readonly parameters: SimulatorParameters;
  readonly frameOptions: Readonly<SimulationAnalysisFrameBuildOptions>;
}

export interface TleRunWorkerCancelRequest {
  readonly type: 'cancel';
  readonly protocol: typeof TLE_RUN_WORKER_PROTOCOL;
  readonly requestId: string;
  readonly reason?: string;
}

export type TleRunWorkerRequest =
  | TleRunWorkerBuildRequest
  | TleRunWorkerRebuildAnalysisRequest
  | TleRunWorkerCancelRequest;

export interface TleRunWorkerProgressMessage {
  readonly type: 'progress';
  readonly protocol: typeof TLE_RUN_WORKER_PROTOCOL;
  readonly requestId: string;
  readonly phase: 'geometry' | 'analysis' | 'snapshot';
  readonly progress: TleRunProgress;
}

export interface TleRunWorkerAcceptedMessage {
  readonly type: 'accepted';
  readonly protocol: typeof TLE_RUN_WORKER_PROTOCOL;
  readonly requestId: string;
  readonly geometryRunId: string;
  readonly analysisRunId: string;
  /** The canonical geometry payload lives only at `analysis.geometryRun`. */
  readonly analysis: TleAnalysisRunSnapshot;
}

export interface TleRunWorkerErrorMessage {
  readonly type: 'error';
  readonly protocol: typeof TLE_RUN_WORKER_PROTOCOL;
  readonly requestId: string;
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
}

export type TleRunWorkerResponse =
  | TleRunWorkerProgressMessage
  | TleRunWorkerAcceptedMessage
  | TleRunWorkerErrorMessage;

export type TleRunWorkerMessage = TleRunWorkerRequest | TleRunWorkerResponse;

export function isTleRunWorkerMessage(value: unknown): value is TleRunWorkerMessage {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const message = value as Record<string, unknown>;
  return message.protocol === TLE_RUN_WORKER_PROTOCOL
    && typeof message.type === 'string'
    && typeof message.requestId === 'string'
    && message.requestId.trim() !== '';
}
