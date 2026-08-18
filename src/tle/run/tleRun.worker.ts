import { isTleRunWorkerMessage } from './workerProtocol';
import { createTleRunWorkerRuntime, type TleRunWorkerRuntimePort } from './workerRuntime';

const scope = globalThis as unknown as TleRunWorkerRuntimePort;
const runtime = createTleRunWorkerRuntime(scope);

scope.addEventListener('message', event => {
  if (!isTleRunWorkerMessage(event.data)) {
    scope.postMessage({
      protocol: 'tle-run-worker-v1',
      type: 'error',
      requestId: 'unknown-request',
      code: 'INVALID_MESSAGE',
      message: 'TLE Worker received an invalid message',
      retryable: false,
    });
    return;
  }
  runtime.handle(event.data);
});

