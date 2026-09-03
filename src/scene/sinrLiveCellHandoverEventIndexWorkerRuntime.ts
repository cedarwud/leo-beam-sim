import {
  createSinrLiveCellHandoverEventIndexBuilder,
  type BuildSinrLiveCellHandoverEventIndexInput,
  type SinrLiveCellHandoverEventIndexBuilder,
} from './sinrLiveCellHandoverEventIndex';
import {
  SINR_LIVE_CELL_HANDOVER_EVENT_INDEX_WORKER_PROTOCOL,
  type SinrLiveCellHandoverEventIndexWorkerBuildRequest,
  type SinrLiveCellHandoverEventIndexWorkerMessage,
  type SinrLiveCellHandoverEventIndexWorkerPreviewMessage,
  type SinrLiveCellHandoverEventIndexWorkerProgressMessage,
  type SinrLiveCellHandoverEventIndexWorkerResponse,
} from './sinrLiveCellHandoverEventIndexWorkerProtocol';

export interface SinrLiveCellHandoverEventIndexWorkerRuntimePort {
  postMessage(message: SinrLiveCellHandoverEventIndexWorkerResponse): void;
  addEventListener(type: 'message', listener: (event: { readonly data: unknown }) => void): void;
  removeEventListener(type: 'message', listener: (event: { readonly data: unknown }) => void): void;
}

export type SinrLiveCellHandoverEventIndexBuilderFactory = (
  input: BuildSinrLiveCellHandoverEventIndexInput,
) => SinrLiveCellHandoverEventIndexBuilder;

export interface SinrLiveCellHandoverEventIndexWorkerRuntimeOptions {
  /** Coarse steps per worker tick. One step bounds the synchronous worker turn. */
  readonly sliceSize?: number;
  /** Injectable for deterministic tests; the browser default yields a macrotask. */
  readonly schedule?: (callback: () => void) => void;
  readonly createBuilder?: SinrLiveCellHandoverEventIndexBuilderFactory;
}

export interface SinrLiveCellHandoverEventIndexWorkerRuntime {
  handle(message: SinrLiveCellHandoverEventIndexWorkerMessage): void;
  dispose(): void;
}

interface ActiveRequest {
  readonly requestId: string;
  readonly controller: AbortController;
}

const DEFAULT_SLICE_SIZE = 1;

function errorMessage(
  requestId: string,
  code: 'CANCELLED' | 'BUILD_FAILED',
  message: string,
  retryable: boolean,
): SinrLiveCellHandoverEventIndexWorkerResponse {
  return {
    protocol: SINR_LIVE_CELL_HANDOVER_EVENT_INDEX_WORKER_PROTOCOL,
    type: 'error',
    requestId,
    code,
    message,
    retryable,
  };
}

function progressMessage(
  requestId: string,
  progress: SinrLiveCellHandoverEventIndexWorkerProgressMessage['progress'],
): SinrLiveCellHandoverEventIndexWorkerProgressMessage {
  return {
    protocol: SINR_LIVE_CELL_HANDOVER_EVENT_INDEX_WORKER_PROTOCOL,
    type: 'progress',
    requestId,
    progress,
  };
}

function previewMessage(
  requestId: string,
  preview: SinrLiveCellHandoverEventIndexWorkerPreviewMessage['preview'],
): SinrLiveCellHandoverEventIndexWorkerPreviewMessage {
  return {
    protocol: SINR_LIVE_CELL_HANDOVER_EVENT_INDEX_WORKER_PROTOCOL,
    type: 'preview',
    requestId,
    preview,
  };
}

function finiteSliceSize(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.max(1, Math.trunc(value))
    : DEFAULT_SLICE_SIZE;
}

/**
 * Worker-side driver for the resumable SINR cell-truth event-index builder.
 * The builder is never imported by React or Three; only its plain preview and
 * final index receipts cross the structured-clone boundary.
 */
export function createSinrLiveCellHandoverEventIndexWorkerRuntime(
  port: Pick<SinrLiveCellHandoverEventIndexWorkerRuntimePort, 'postMessage'>,
  options: SinrLiveCellHandoverEventIndexWorkerRuntimeOptions = {},
): SinrLiveCellHandoverEventIndexWorkerRuntime {
  const createBuilder = options.createBuilder ?? createSinrLiveCellHandoverEventIndexBuilder;
  const schedule = options.schedule ?? (callback => setTimeout(callback, 0));
  const sliceSize = finiteSliceSize(options.sliceSize);
  let active: ActiveRequest | undefined;
  let disposed = false;

  const isCurrent = (requestId: string, controller: AbortController): boolean => (
    !disposed
    && active?.requestId === requestId
    && active.controller === controller
    && !controller.signal.aborted
  );

  const emitProgress = (
    requestId: string,
    controller: AbortController,
    builder: SinrLiveCellHandoverEventIndexBuilder,
    status: 'running' | 'complete',
  ): void => {
    if (!isCurrent(requestId, controller)) return;
    const totalSteps = builder.totalSteps;
    const completedSteps = builder.stepsCompleted();
    port.postMessage(progressMessage(requestId, Object.freeze({
      status,
      completedSteps,
      totalSteps,
      fraction: totalSteps === 0 ? 1 : Math.min(1, completedSteps / totalSteps),
    })));
  };

  const start = (request: SinrLiveCellHandoverEventIndexWorkerBuildRequest): void => {
    const superseded = active;
    const controller = new AbortController();
    active = { requestId: request.requestId, controller };
    superseded?.controller.abort('superseded by a newer SINR event-index request');
    if (superseded !== undefined && !disposed) {
      port.postMessage(errorMessage(
        superseded.requestId,
        'CANCELLED',
        'SINR event-index build was superseded by a newer request',
        false,
      ));
    }

    let previewEmitted = false;
    const emitPreviewIfReady = (builder: SinrLiveCellHandoverEventIndexBuilder): void => {
      if (previewEmitted || !isCurrent(request.requestId, controller)) return;
      const preview = builder.preview();
      if (preview === null) return;
      port.postMessage(previewMessage(request.requestId, preview));
      previewEmitted = true;
    };

    const reportBuildFailure = (error: unknown): void => {
      if (!isCurrent(request.requestId, controller)) return;
      active = undefined;
      port.postMessage(errorMessage(
        request.requestId,
        'BUILD_FAILED',
        error instanceof Error ? error.message : String(error),
        true,
      ));
    };

    const scheduleAdvance = (callback: () => void): void => {
      try {
        schedule(callback);
      } catch (error) {
        // A failed scheduler is a worker failure, not a reason to leave the
        // transport's readiness promise pending indefinitely.
        reportBuildFailure(error);
      }
    };

    let builder: SinrLiveCellHandoverEventIndexBuilder;
    try {
      builder = createBuilder(request.input);
      emitPreviewIfReady(builder);
      emitProgress(request.requestId, controller, builder, 'running');
    } catch (error) {
      if (!isCurrent(request.requestId, controller)) return;
      active = undefined;
      port.postMessage(errorMessage(
        request.requestId,
        'BUILD_FAILED',
        error instanceof Error ? error.message : String(error),
        true,
      ));
      return;
    }

    const advance = (): void => {
      if (!isCurrent(request.requestId, controller)) return;
      try {
        const done = builder.runSlice(sliceSize);
        if (!isCurrent(request.requestId, controller)) return;
        emitPreviewIfReady(builder);
        emitProgress(request.requestId, controller, builder, done ? 'complete' : 'running');
        if (!done) {
          scheduleAdvance(advance);
          return;
        }
        const index = builder.finalize();
        if (!isCurrent(request.requestId, controller)) return;
        port.postMessage({
          protocol: SINR_LIVE_CELL_HANDOVER_EVENT_INDEX_WORKER_PROTOCOL,
          type: 'accepted',
          requestId: request.requestId,
          index,
        });
        active = undefined;
      } catch (error) {
        if (!isCurrent(request.requestId, controller)) return;
        active = undefined;
        const cancelled = controller.signal.aborted;
        port.postMessage(errorMessage(
          request.requestId,
          cancelled ? 'CANCELLED' : 'BUILD_FAILED',
          cancelled
            ? 'SINR event-index build was cancelled'
            : error instanceof Error ? error.message : String(error),
          !cancelled,
        ));
      }
    };
    scheduleAdvance(advance);
  };

  const cancel = (requestId: string, reason?: string): void => {
    if (active?.requestId !== requestId) return;
    const current = active;
    active = undefined;
    current.controller.abort(reason ?? 'SINR event-index build cancelled');
    if (!disposed) {
      port.postMessage(errorMessage(
        requestId,
        'CANCELLED',
        reason?.trim() || 'SINR event-index build was cancelled',
        false,
      ));
    }
  };

  return {
    handle(message) {
      if (disposed) return;
      if (message.type === 'build') start(message);
      else if (message.type === 'cancel') cancel(message.requestId, message.reason);
    },
    dispose() {
      disposed = true;
      active?.controller.abort('Worker disposed');
      active = undefined;
    },
  };
}
