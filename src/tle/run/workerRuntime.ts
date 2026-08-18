import {
  buildTleAnalysisRun,
  createTleAnalysisRunSnapshot,
} from '../../simulator/tleAnalysisRun';
import {
  buildTleRunBundle,
  TLE_RUN_APPROVED_CANDIDATE_POOL_OPTIONS,
  hydrateTleRunBundle,
  type TleRunProgress,
  type TleRunBundle,
} from './index';
import { isTleRunError } from './index';
import {
  TLE_RUN_WORKER_PROTOCOL,
  type TleRunWorkerAcceptedMessage,
  type TleRunWorkerBuildRequest,
  type TleRunWorkerRebuildAnalysisRequest,
  type TleRunWorkerMessage,
  type TleRunWorkerProgressMessage,
  type TleRunWorkerResponse,
} from './workerProtocol';

export interface TleRunWorkerRuntimePort {
  postMessage(message: TleRunWorkerResponse, transfer?: Transferable[]): void;
  addEventListener(type: 'message', listener: (event: { readonly data: unknown }) => void): void;
  removeEventListener(type: 'message', listener: (event: { readonly data: unknown }) => void): void;
}

export interface TleRunWorkerRuntime {
  handle(message: TleRunWorkerMessage): void;
  dispose(): void;
}

interface ActiveRequest {
  readonly requestId: string;
  readonly controller: AbortController;
}

function errorMessage(
  requestId: string,
  code: string,
  message: string,
  retryable: boolean,
): TleRunWorkerResponse {
  return {
    protocol: TLE_RUN_WORKER_PROTOCOL,
    type: 'error',
    requestId,
    code,
    message,
    retryable,
  };
}

function progress(
  requestId: string,
  phase: TleRunWorkerProgressMessage['phase'],
  value: TleRunProgress,
): TleRunWorkerProgressMessage {
  return {
    protocol: TLE_RUN_WORKER_PROTOCOL,
    type: 'progress',
    requestId,
    phase,
    progress: value,
  };
}

/**
 * One-request-at-a-time producer runtime for the module Worker. A newer build
 * aborts the old producer, and all response emission is guarded by request
 * identity so a late completion cannot become an accepted run.
 */
export function createTleRunWorkerRuntime(
  port: Pick<TleRunWorkerRuntimePort, 'postMessage'>,
): TleRunWorkerRuntime {
  let active: ActiveRequest | undefined;
  let disposed = false;

  const isCurrent = (requestId: string, controller: AbortController): boolean => (
    !disposed
    && active?.requestId === requestId
    && active.controller === controller
    && !controller.signal.aborted
  );

  const emitProgress = (
    request: TleRunWorkerBuildRequest | TleRunWorkerRebuildAnalysisRequest,
    controller: AbortController,
    phase: TleRunWorkerProgressMessage['phase'],
    value: TleRunProgress,
  ): void => {
    if (!isCurrent(request.requestId, controller)) return;
    port.postMessage(progress(request.requestId, phase, value));
  };

  const start = (request: TleRunWorkerBuildRequest | TleRunWorkerRebuildAnalysisRequest): void => {
    const superseded = active;
    const controller = new AbortController();
    // Publish the new active identity before notifying the old request. This
    // also keeps the guard correct for deterministic test ports that dispatch
    // a response synchronously from postMessage.
    active = { requestId: request.requestId, controller };
    superseded?.controller.abort('superseded by a newer TLE run request');
    // Settle the superseded transport request explicitly. Its async producer
    // will observe the new active identity and stay silent, so without this
    // envelope the caller would retain a permanently pending Promise.
    if (superseded !== undefined && !disposed) {
      port.postMessage(errorMessage(
        superseded.requestId,
        'CANCELLED',
        'archived-TLE Worker build was superseded by a newer request',
        false,
      ));
    }
    void (async () => {
      let phase: 'geometry' | 'analysis' = request.type === 'build' ? 'geometry' : 'analysis';
      try {
        let geometryRun: TleRunBundle;
        if (request.type === 'build') {
          geometryRun = await buildTleRunBundle({
            selection: request.selection,
            t0Utc: request.t0Utc,
            candidatePool: TLE_RUN_APPROVED_CANDIDATE_POOL_OPTIONS,
            signal: controller.signal,
            isCurrent: () => isCurrent(request.requestId, controller),
            onProgress: value => emitProgress(request, controller, 'geometry', value),
          });
        } else {
          // The analysis-only request is deliberately a separate protocol
          // branch.  Hydration owns the transferred arrays and therefore
          // cannot call the geometry producer or run SGP4 a second time.
          geometryRun = hydrateTleRunBundle(request.geometryRun);
          emitProgress(request, controller, 'geometry', Object.freeze({
            status: 'complete',
            completedAnchors: geometryRun.anchorCount,
            totalAnchors: geometryRun.anchorCount,
            anchorIndex: geometryRun.anchorCount - 1,
            anchorUtc: geometryRun.getAnchorUtc(geometryRun.anchorCount - 1),
            fraction: 1,
            progress: 1,
          }));
        }
        if (!isCurrent(request.requestId, controller)) return;
        const zeroProgress: TleRunProgress = Object.freeze({
          status: 'running',
          completedAnchors: 0,
          totalAnchors: geometryRun.anchorCount,
          anchorIndex: -1,
          anchorUtc: null,
          fraction: 0,
          progress: 0,
        });
        emitProgress(request, controller, 'analysis', zeroProgress);
        phase = 'analysis';
        const analysisRun = buildTleAnalysisRun({
          selection: request.selection,
          geometryRun,
          ...(request.type === 'rebuild-analysis' ? { passPlan: request.passPlan } : {}),
          parameters: request.parameters,
          frameOptions: request.frameOptions,
        });
        if (!isCurrent(request.requestId, controller)) return;
        const analysis = createTleAnalysisRunSnapshot(analysisRun);
        const geometry = analysis.geometryRun;
        if (!isCurrent(request.requestId, controller)) return;
        const accepted: TleRunWorkerAcceptedMessage = {
          protocol: TLE_RUN_WORKER_PROTOCOL,
          type: 'accepted',
          requestId: request.requestId,
          geometryRunId: geometry.runId,
          analysisRunId: analysis.analysisRunId,
          analysis,
        };
        // The structured-clone transfer is the ownership hand-off. The
        // snapshot creator made a detached copy, so the live producer bundle
        // remains valid until this request is discarded.
        port.postMessage(accepted, [geometry.positionsTemeKm.buffer, geometry.velocitiesTemeKmPerSec.buffer]);
        active = undefined;
      } catch (error) {
        if (!isCurrent(request.requestId, controller)) return;
        active = undefined;
        const cancelled = controller.signal.aborted;
        const failureCode = cancelled
          ? 'CANCELLED'
          : isTleRunError(error)
            ? error.code
            : phase === 'analysis' ? 'ANALYSIS_FAILED' : 'WORKER_BUILD_FAILED';
        port.postMessage(errorMessage(
          request.requestId,
          failureCode,
          cancelled
            ? 'archived-TLE Worker build was cancelled'
            : error instanceof Error ? error.message : String(error),
          !cancelled,
        ));
      }
    })();
  };

  const cancel = (requestId: string, reason?: string): void => {
    if (active?.requestId !== requestId) return;
    const current = active;
    active = undefined;
    current.controller.abort(reason ?? 'archived-TLE Worker build cancelled');
    if (!disposed) port.postMessage(errorMessage(
      requestId,
      'CANCELLED',
      reason?.trim() || 'archived-TLE Worker build was cancelled',
      false,
    ));
  };

  return {
    handle(message) {
      if (disposed) return;
      if (message.type === 'build' || message.type === 'rebuild-analysis') start(message);
      else if (message.type === 'cancel') cancel(message.requestId, message.reason);
    },
    dispose() {
      disposed = true;
      active?.controller.abort('Worker disposed');
      active = undefined;
    },
  };
}
