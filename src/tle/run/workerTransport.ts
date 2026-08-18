import {
  hydrateTleAnalysisRunSnapshot,
  type TleAnalysisRun,
} from '../../simulator/tleAnalysisRun';
import {
  createTleRunBundleSnapshot,
  type TleRunBundle,
} from './index';
import type { PassPlan } from '../pass';
import type {
  LoadedTleSnapshotSelection,
  SimulatorParameters,
} from '../../simulator/types';
import type { SimulationAnalysisFrameBuildOptions } from '../../simulator/analysis';
import {
  TLE_RUN_WORKER_PROTOCOL,
  isTleRunWorkerMessage,
  type TleRunWorkerAcceptedMessage,
  type TleRunWorkerBuildRequest,
  type TleRunWorkerMessage,
  type TleRunWorkerProgressMessage,
  type TleRunWorkerRebuildAnalysisRequest,
  type TleRunWorkerResponse,
} from './workerProtocol';

export type { TleRunWorkerProgressMessage } from './workerProtocol';

// Every accepted Worker response carries one immutable geometry snapshot at
// `analysis.geometryRun`. Retain that payload beside the hydrated live facade
// so later analysis-only edits do not rescan and recopy the complete 241-anchor
// geometry inside the user input event.
const acceptedGeometrySnapshotCache = new WeakMap<
  TleRunBundle,
  ReturnType<typeof createTleRunBundleSnapshot>
>();

export interface TleRunWorkerPort {
  postMessage(message: TleRunWorkerMessage, transfer?: Transferable[]): void;
  addEventListener(type: 'message', listener: (event: { readonly data: unknown }) => void): void;
  removeEventListener(type: 'message', listener: (event: { readonly data: unknown }) => void): void;
  terminate?: () => void;
}

export interface TleRunWorkerBuildInput {
  readonly selection: LoadedTleSnapshotSelection;
  readonly t0Utc: string;
  readonly parameters: SimulatorParameters;
  readonly frameOptions: Readonly<SimulationAnalysisFrameBuildOptions>;
}

export interface TleRunWorkerRebuildAnalysisInput {
  readonly selection: LoadedTleSnapshotSelection;
  /** A completed live geometry run; it is copied into a detached snapshot. */
  readonly geometryRun: TleRunBundle;
  readonly passPlan: PassPlan;
  readonly parameters: SimulatorParameters;
  readonly frameOptions: Readonly<SimulationAnalysisFrameBuildOptions>;
}

export interface TleRunWorkerBuildOptions {
  readonly signal?: AbortSignal;
  readonly onProgress?: (message: TleRunWorkerProgressMessage) => void;
}

export interface TleRunWorkerBuildResult {
  readonly geometryRun: import('./index').TleRunBundle;
  readonly analysisRun: TleAnalysisRun;
}

export type TleRunWorkerErrorCode =
  | 'CANCELLED'
  | 'WORKER_UNAVAILABLE'
  | 'WORKER_BUILD_FAILED'
  | 'PROPAGATION_FAILED'
  | 'ANALYSIS_FAILED'
  | 'IDENTITY_MISMATCH';

export class TleRunWorkerError extends Error {
  readonly code: TleRunWorkerErrorCode;

  constructor(code: TleRunWorkerErrorCode, message: string) {
    super(message);
    this.name = 'TleRunWorkerError';
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

interface PendingRequest {
  readonly resolve: (result: TleRunWorkerBuildResult) => void;
  readonly reject: (error: unknown) => void;
  readonly onProgress?: (message: TleRunWorkerProgressMessage) => void;
  readonly signal?: AbortSignal;
  abortListener?: () => void;
}

function responseMessage(value: unknown): TleRunWorkerResponse | null {
  if (!isTleRunWorkerMessage(value)) return null;
  if (value.type === 'progress' || value.type === 'accepted' || value.type === 'error') return value;
  return null;
}

/** Main-thread transport for the Vite module Worker. */
export class TleRunWorkerTransport {
  private readonly pending = new Map<string, PendingRequest>();
  private sequence = 0;
  private disposed = false;

  private readonly onMessage = (event: { readonly data: unknown }): void => {
    const message = responseMessage(event.data);
    if (message === null) return;
    const request = this.pending.get(message.requestId);
    if (request === undefined) return;
    if (message.type === 'progress') {
      request.onProgress?.(message);
      return;
    }
    this.pending.delete(message.requestId);
    if (request.signal !== undefined && request.abortListener !== undefined) {
      request.signal.removeEventListener('abort', request.abortListener);
    }
    if (message.type === 'error') {
      const code: TleRunWorkerErrorCode = message.code === 'CANCELLED'
        ? 'CANCELLED'
        : message.code === 'PROPAGATION_FAILED'
          ? 'PROPAGATION_FAILED'
          : message.code === 'ANALYSIS_FAILED'
            ? 'ANALYSIS_FAILED'
            : 'WORKER_BUILD_FAILED';
      request.reject(new TleRunWorkerError(
        code,
        message.message,
      ));
      return;
    }
    try {
      request.resolve(this.hydrateAccepted(message));
    } catch (error) {
      request.reject(error instanceof TleRunWorkerError
        ? error
        : new TleRunWorkerError('IDENTITY_MISMATCH', error instanceof Error ? error.message : String(error)));
    }
  };

  constructor(private readonly port: TleRunWorkerPort) {
    port.addEventListener('message', this.onMessage);
  }

  private hydrateAccepted(message: TleRunWorkerAcceptedMessage): TleRunWorkerBuildResult {
    const geometry = message.analysis.geometryRun;
    if (message.geometryRunId !== geometry.runId || message.geometryRunId !== message.analysis.geometryRunId) {
      throw new TleRunWorkerError('IDENTITY_MISMATCH', 'Worker geometry identity disagrees across accepted payloads');
    }
    const sourceIdentity = message.analysis.sourceIdentity;
    if (
      sourceIdentity.archiveId !== geometry.archiveId
      || sourceIdentity.publicationSha256 !== geometry.publicationSha256
      || sourceIdentity.t0Utc !== geometry.t0Utc
      || sourceIdentity.geometryRunId !== geometry.runId
    ) {
      throw new TleRunWorkerError('IDENTITY_MISMATCH', 'Worker TLE source identity disagrees with its canonical geometry payload');
    }
    if (message.analysisRunId !== message.analysis.analysisRunId || message.analysisRunId !== message.analysis.runId) {
      throw new TleRunWorkerError('IDENTITY_MISMATCH', 'Worker analysis identity disagrees across accepted payloads');
    }
    // hydrateTleAnalysisRunSnapshot validates the TLE, geometry, analysis,
    // pass, frame, and source identities before this result can resolve.
    const analysisRun = hydrateTleAnalysisRunSnapshot(message.analysis);
    if (analysisRun.geometryRunId !== message.geometryRunId || analysisRun.analysisRunId !== message.analysisRunId) {
      throw new TleRunWorkerError('IDENTITY_MISMATCH', 'hydrated Worker run identity disagrees with the response envelope');
    }
    acceptedGeometrySnapshotCache.set(analysisRun.geometryRun, geometry);
    return { geometryRun: analysisRun.geometryRun, analysisRun };
  }

  private dispatch(
    request: TleRunWorkerBuildRequest | TleRunWorkerRebuildAnalysisRequest,
    options: TleRunWorkerBuildOptions,
  ): Promise<TleRunWorkerBuildResult> {
    if (this.disposed) return Promise.reject(new TleRunWorkerError('WORKER_UNAVAILABLE', 'TLE Worker transport is disposed'));
    const requestId = request.requestId;
    if (options.signal?.aborted) return Promise.reject(new TleRunWorkerError('CANCELLED', 'TLE Worker request was already cancelled'));
    return new Promise<TleRunWorkerBuildResult>((resolve, reject) => {
      const pending: PendingRequest = {
        resolve,
        reject,
        onProgress: options.onProgress,
        signal: options.signal,
      };
      const abortListener = () => {
        if (!this.pending.has(requestId)) return;
        this.pending.delete(requestId);
        this.port.postMessage({
          protocol: TLE_RUN_WORKER_PROTOCOL,
          type: 'cancel',
          requestId,
          reason: 'TLE Worker request aborted',
        });
        reject(new TleRunWorkerError('CANCELLED', 'TLE Worker request was cancelled'));
      };
      pending.abortListener = abortListener;
      this.pending.set(requestId, pending);
      options.signal?.addEventListener('abort', abortListener, { once: true });
      try {
        this.port.postMessage(request);
      } catch (error) {
        this.pending.delete(requestId);
        options.signal?.removeEventListener('abort', abortListener);
        reject(new TleRunWorkerError('WORKER_UNAVAILABLE', error instanceof Error ? error.message : String(error)));
      }
    });
  }

  build(input: TleRunWorkerBuildInput, options: TleRunWorkerBuildOptions = {}): Promise<TleRunWorkerBuildResult> {
    return this.dispatch({
      protocol: TLE_RUN_WORKER_PROTOCOL,
      type: 'build',
      requestId: `tle-run-worker-${++this.sequence}`,
      selection: input.selection,
      t0Utc: input.t0Utc,
      parameters: input.parameters,
      frameOptions: input.frameOptions,
    }, options);
  }

  /**
   * Rebuild only analysis from a completed geometry/pass-plan pair.  The live
   * RunBundle remains owned by the caller; snapshotting copies its typed
   * arrays instead of transferring or detaching them.
   */
  rebuildAnalysis(
    input: TleRunWorkerRebuildAnalysisInput,
    options: TleRunWorkerBuildOptions = {},
  ): Promise<TleRunWorkerBuildResult> {
    let geometryRun: ReturnType<typeof createTleRunBundleSnapshot>;
    try {
      geometryRun = acceptedGeometrySnapshotCache.get(input.geometryRun)
        ?? createTleRunBundleSnapshot(input.geometryRun);
      acceptedGeometrySnapshotCache.set(input.geometryRun, geometryRun);
    } catch (error) {
      return Promise.reject(new TleRunWorkerError(
        'WORKER_BUILD_FAILED',
        error instanceof Error ? error.message : String(error),
      ));
    }
    return this.dispatch({
      protocol: TLE_RUN_WORKER_PROTOCOL,
      type: 'rebuild-analysis',
      requestId: `tle-run-worker-${++this.sequence}`,
      selection: input.selection,
      geometryRun,
      passPlan: input.passPlan,
      parameters: input.parameters,
      frameOptions: input.frameOptions,
    }, options);
  }

  run(input: TleRunWorkerBuildInput, options: TleRunWorkerBuildOptions = {}): Promise<TleRunWorkerBuildResult> {
    return this.build(input, options);
  }

  cancel(requestId: string, reason = 'TLE Worker request cancelled'): void {
    const request = this.pending.get(requestId);
    if (request === undefined) return;
    this.pending.delete(requestId);
    if (request.signal !== undefined && request.abortListener !== undefined) request.signal.removeEventListener('abort', request.abortListener);
    this.port.postMessage({
      protocol: TLE_RUN_WORKER_PROTOCOL,
      type: 'cancel',
      requestId,
      reason,
    });
    request.reject(new TleRunWorkerError('CANCELLED', reason));
  }

  cancelAll(reason = 'TLE Worker transport disposed'): void {
    for (const [requestId, request] of [...this.pending.entries()]) {
      this.port.postMessage({
        protocol: TLE_RUN_WORKER_PROTOCOL,
        type: 'cancel',
        requestId,
        reason,
      });
      this.pending.delete(requestId);
      if (request.signal !== undefined && request.abortListener !== undefined) {
        request.signal.removeEventListener('abort', request.abortListener);
      }
      request.reject(new TleRunWorkerError('CANCELLED', reason));
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelAll();
    this.port.removeEventListener('message', this.onMessage);
    this.port.terminate?.();
  }
}

/** Construct the Vite module Worker only in a browser-capable environment. */
export function createTleRunWorkerTransport(): TleRunWorkerTransport | null {
  if (typeof globalThis.Worker !== 'function') return null;
  const worker = new Worker(new URL('./tleRun.worker.ts', import.meta.url), { type: 'module' });
  return new TleRunWorkerTransport(worker);
}
