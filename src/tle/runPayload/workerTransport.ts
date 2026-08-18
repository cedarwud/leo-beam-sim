import {
  decodeRunPayloadMessage,
  roundTripRunPayloadMessage,
} from './codec';
import {
  RUN_PAYLOAD_MESSAGE_TYPES,
  type RunPayloadMessage,
  type RunPayloadRequestMessage,
  type RunPayloadResponseMessage,
  type SelectableRunRequest,
} from './types';

export interface RunPayloadWorkerMessageEvent {
  readonly data: unknown;
}

/** Small structural port keeps the transport testable without a real Worker. */
export interface RunPayloadWorkerPort {
  postMessage(message: RunPayloadMessage): void;
  addEventListener(type: 'message', listener: (event: RunPayloadWorkerMessageEvent) => void): void;
  removeEventListener(type: 'message', listener: (event: RunPayloadWorkerMessageEvent) => void): void;
}

export type RunPayloadWorkerResponseListener = (message: RunPayloadResponseMessage) => void;

/**
 * Baseline main-thread Worker transport.  It only moves validated data and
 * leaves request ownership/stale publication to the caller or adapter.
 */
export class RunPayloadWorkerTransport {
  private readonly listeners = new Set<RunPayloadWorkerResponseListener>();

  private readonly onMessage = (event: RunPayloadWorkerMessageEvent): void => {
    const message = decodeRunPayloadMessage(event.data);
    if (
      message.type === RUN_PAYLOAD_MESSAGE_TYPES.request
      || message.type === RUN_PAYLOAD_MESSAGE_TYPES.cancel
    ) return;
    for (const listener of this.listeners) listener(message);
  };

  constructor(private readonly port: RunPayloadWorkerPort) {
    port.addEventListener('message', this.onMessage);
  }

  send(message: RunPayloadMessage): void {
    this.port.postMessage(roundTripRunPayloadMessage(message));
  }

  request(requestId: string, request: SelectableRunRequest): void {
    const message: RunPayloadRequestMessage = {
      protocol: 'selectable-tle-run-payload-v1',
      type: RUN_PAYLOAD_MESSAGE_TYPES.request,
      requestId,
      request,
    };
    this.send(message);
  }

  cancel(requestId: string, reason?: string): void {
    this.send({
      protocol: 'selectable-tle-run-payload-v1',
      type: RUN_PAYLOAD_MESSAGE_TYPES.cancel,
      requestId,
      ...(reason === undefined ? {} : { reason }),
    });
  }

  subscribe(listener: RunPayloadWorkerResponseListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.port.removeEventListener('message', this.onMessage);
    this.listeners.clear();
  }
}
