import {
  isSinrLiveCellHandoverEventIndexWorkerRequest,
  SINR_LIVE_CELL_HANDOVER_EVENT_INDEX_WORKER_PROTOCOL,
} from './sinrLiveCellHandoverEventIndexWorkerProtocol';
import {
  createSinrLiveCellHandoverEventIndexWorkerRuntime,
  type SinrLiveCellHandoverEventIndexWorkerRuntimePort,
} from './sinrLiveCellHandoverEventIndexWorkerRuntime';

const scope = globalThis as unknown as SinrLiveCellHandoverEventIndexWorkerRuntimePort;
// Keep the UI completely independent from the offline scan while amortizing
// message/timer overhead inside the worker. Twelve simulation steps is the
// same bounded batch used by the deterministic main-thread fallback.
const runtime = createSinrLiveCellHandoverEventIndexWorkerRuntime(scope, {
  sliceSize: 12,
});

scope.addEventListener('message', event => {
  if (!isSinrLiveCellHandoverEventIndexWorkerRequest(event.data)) {
    const requestId = event.data !== null && typeof event.data === 'object'
      && typeof (event.data as { requestId?: unknown }).requestId === 'string'
      ? (event.data as { requestId: string }).requestId
      : 'unknown-request';
    scope.postMessage({
      protocol: SINR_LIVE_CELL_HANDOVER_EVENT_INDEX_WORKER_PROTOCOL,
      type: 'error',
      requestId,
      code: 'INVALID_MESSAGE',
      message: 'SINR event-index Worker received an invalid message',
      retryable: false,
    });
    return;
  }
  runtime.handle(event.data);
});
