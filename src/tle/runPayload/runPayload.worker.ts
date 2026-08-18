import { decodeRunPayloadMessage, RunPayloadCodecError } from './codec';
import {
  createRunPayloadWorkerRuntime,
  type RunPayloadDenseBuilder,
  type RunPayloadResponseEmitter,
} from './workerRuntime';
import {
  RUN_PAYLOAD_MESSAGE_TYPES,
  RUN_PAYLOAD_PROTOCOL_SCHEMA,
  type RunPayloadMessage,
  type RunPayloadResponseMessage,
} from './types';
import type { RunPayloadWorkerMessageEvent, RunPayloadWorkerPort } from './workerTransport';

export interface RunPayloadDedicatedWorkerScope extends RunPayloadWorkerPort {}

/**
 * Dedicated-worker entry seam.  The dense producer is injected so the entry
 * stays neutral: the first production adapter may wrap the current dense
 * builder, while tests use a small deterministic builder.
 */
export function installRunPayloadWorker(
  scope: RunPayloadDedicatedWorkerScope,
  build: RunPayloadDenseBuilder,
): () => void {
  const emit: RunPayloadResponseEmitter = message => scope.postMessage(message);
  const runtime = createRunPayloadWorkerRuntime(build, emit);
  const onMessage = (event: RunPayloadWorkerMessageEvent): void => {
    try {
      const message = decodeRunPayloadMessage(event.data);
      runtime.handle(message);
    } catch (error) {
      const requestId = extractRequestId(event.data);
      const detail = error instanceof RunPayloadCodecError
        ? error.message
        : 'worker received an invalid run-payload message';
      const response: RunPayloadResponseMessage = {
        protocol: RUN_PAYLOAD_PROTOCOL_SCHEMA,
        type: RUN_PAYLOAD_MESSAGE_TYPES.error,
        requestId,
        phase: 'failed',
        code: 'invalid-message',
        message: detail,
        retryable: false,
      };
      scope.postMessage(response);
    }
  };
  scope.addEventListener('message', onMessage);
  return () => {
    scope.removeEventListener('message', onMessage);
    runtime.dispose();
  };
}

function extractRequestId(value: unknown): string {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const requestId = (value as Record<string, unknown>).requestId;
    if (typeof requestId === 'string' && requestId.trim() !== '') return requestId;
  }
  return 'unknown-request';
}

export type { RunPayloadMessage };
