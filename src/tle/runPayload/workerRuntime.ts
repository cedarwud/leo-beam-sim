import {
  RUN_PAYLOAD_MESSAGE_TYPES,
  RUN_PAYLOAD_PROTOCOL_SCHEMA,
  type RunPayloadAcceptedMessage,
  type RunPayloadBootstrapMessage,
  type RunPayloadMessage,
  type RunPayloadProgressMessage,
  type RunPayloadResponseMessage,
  type RunPayloadRequestMessage,
  type SelectableRunRequest,
  type RunPayloadWorkerBuildResult,
} from './types';

export interface RunPayloadWorkerBuildContext {
  readonly signal: AbortSignal;
  readonly reportProgress: (
    progress: Omit<RunPayloadProgressMessage, 'protocol' | 'type' | 'requestId'>,
  ) => void;
}

/**
 * Injectable producer seam for the baseline Worker.  The first adapter can
 * wrap the existing dense builder; tests inject a tiny deterministic builder.
 */
export type RunPayloadDenseBuilder = (
  request: SelectableRunRequest,
  context: RunPayloadWorkerBuildContext,
) => Promise<RunPayloadWorkerBuildResult>;

export interface RunPayloadWorkerRuntime {
  handle(message: RunPayloadMessage): void;
  dispose(): void;
}

export type RunPayloadResponseEmitter = (message: RunPayloadResponseMessage) => void;

interface ActiveRequest {
  readonly requestId: string;
  readonly controller: AbortController;
}

function errorMessage(
  requestId: string,
  phase: 'cancelled' | 'failed',
  code: string,
  message: string,
  retryable: boolean,
): RunPayloadResponseMessage {
  return {
    protocol: RUN_PAYLOAD_PROTOCOL_SCHEMA,
    type: RUN_PAYLOAD_MESSAGE_TYPES.error,
    requestId,
    phase,
    code,
    message,
    retryable,
  };
}

/**
 * Runtime state for a dedicated Worker entry.  A newer request supersedes an
 * older one; late builder completion is ignored by requestId identity and can
 * never publish bootstrap or accepted data for the stale request.
 */
export function createRunPayloadWorkerRuntime(
  build: RunPayloadDenseBuilder,
  emit: RunPayloadResponseEmitter,
): RunPayloadWorkerRuntime {
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
    progress: Omit<RunPayloadProgressMessage, 'protocol' | 'type' | 'requestId'>,
  ): void => {
    if (!isCurrent(requestId, controller)) return;
    emit({
      protocol: RUN_PAYLOAD_PROTOCOL_SCHEMA,
      type: RUN_PAYLOAD_MESSAGE_TYPES.progress,
      requestId,
      ...progress,
    });
  };

  const start = (message: RunPayloadRequestMessage): void => {
    if (disposed) return;
    active?.controller.abort();
    const controller = new AbortController();
    active = { requestId: message.requestId, controller };

    void (async () => {
      try {
        const result = await build(message.request, {
          signal: controller.signal,
          reportProgress: progress => emitProgress(message.requestId, controller, progress),
        });
        if (!isCurrent(message.requestId, controller)) return;

        const bootstrap: RunPayloadBootstrapMessage = {
          protocol: RUN_PAYLOAD_PROTOCOL_SCHEMA,
          type: RUN_PAYLOAD_MESSAGE_TYPES.bootstrap,
          requestId: message.requestId,
          identity: result.plan.identity,
          payload: result.bootstrap,
        };
        emit(bootstrap);
        if (!isCurrent(message.requestId, controller)) return;

        const accepted: RunPayloadAcceptedMessage = {
          protocol: RUN_PAYLOAD_PROTOCOL_SCHEMA,
          type: RUN_PAYLOAD_MESSAGE_TYPES.accepted,
          requestId: message.requestId,
          identity: result.plan.identity,
          payload: result.accepted,
        };
        emit(accepted);
        active = undefined;
      } catch (error) {
        if (!isCurrent(message.requestId, controller)) return;
        active = undefined;
        const detail = error instanceof Error && error.message.trim() !== ''
          ? error.message
          : 'dense builder failed without a diagnostic';
        emit(errorMessage(
          message.requestId,
          controller.signal.aborted ? 'cancelled' : 'failed',
          controller.signal.aborted ? 'cancelled' : 'builder-failed',
          detail,
          !controller.signal.aborted,
        ));
      }
    })();
  };

  const cancel = (requestId: string, reason?: string): void => {
    if (!active || active.requestId !== requestId) return;
    const controller = active.controller;
    active = undefined;
    controller.abort(reason);
    if (!disposed) {
      emit(errorMessage(
        requestId,
        'cancelled',
        'cancelled',
        reason?.trim() || 'run request cancelled',
        false,
      ));
    }
  };

  return {
    handle(message) {
      if (disposed) return;
      if (message.type === RUN_PAYLOAD_MESSAGE_TYPES.request) {
        start(message);
      } else if (message.type === RUN_PAYLOAD_MESSAGE_TYPES.cancel) {
        cancel(message.requestId, message.reason);
      }
    },
    dispose() {
      disposed = true;
      active?.controller.abort('worker disposed');
      active = undefined;
    },
  };
}
