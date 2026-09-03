import type {
  BuildSinrLiveCellHandoverEventIndexInput,
} from './sinrLiveCellHandoverEventIndex';
import type { LiveWalkerHandoverEventIndex } from './liveWalkerHandoverEventIndex';
import {
  isSinrLiveCellHandoverEventIndexWorkerMessage,
  SINR_LIVE_CELL_HANDOVER_EVENT_INDEX_WORKER_PROTOCOL,
  type SinrLiveCellHandoverEventIndexWorkerErrorCode,
  type SinrLiveCellHandoverEventIndexWorkerPreviewMessage,
  type SinrLiveCellHandoverEventIndexWorkerRequest,
  type SinrLiveCellHandoverEventIndexWorkerProgressMessage,
  type SinrLiveCellHandoverEventIndexWorkerResponse,
} from './sinrLiveCellHandoverEventIndexWorkerProtocol';

export type {
  SinrLiveCellHandoverEventIndexWorkerPreviewMessage,
  SinrLiveCellHandoverEventIndexWorkerProgressMessage,
} from './sinrLiveCellHandoverEventIndexWorkerProtocol';

export interface SinrLiveCellHandoverEventIndexWorkerPort {
  postMessage(message: SinrLiveCellHandoverEventIndexWorkerRequest): void;
  addEventListener(type: 'message', listener: (event: { readonly data: unknown }) => void): void;
  removeEventListener(type: 'message', listener: (event: { readonly data: unknown }) => void): void;
  terminate?: () => void;
}

interface SinrLiveCellHandoverEventIndexWorkerErrorPort {
  addEventListener?: (type: 'error' | 'messageerror', listener: (event: {
    readonly message?: string;
    readonly error?: unknown;
  }) => void) => void;
  removeEventListener?: (type: 'error' | 'messageerror', listener: (event: {
    readonly message?: string;
    readonly error?: unknown;
  }) => void) => void;
}

export interface SinrLiveCellHandoverEventIndexWorkerBuildOptions {
  readonly signal?: AbortSignal;
  readonly onProgress?: (message: SinrLiveCellHandoverEventIndexWorkerProgressMessage) => void;
  readonly onPreview?: (message: SinrLiveCellHandoverEventIndexWorkerPreviewMessage) => void;
}

export class SinrLiveCellHandoverEventIndexWorkerError extends Error {
  readonly code: SinrLiveCellHandoverEventIndexWorkerErrorCode;

  constructor(code: SinrLiveCellHandoverEventIndexWorkerErrorCode, message: string) {
    super(message);
    this.name = 'SinrLiveCellHandoverEventIndexWorkerError';
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

interface PendingRequest {
  readonly resolve: (index: LiveWalkerHandoverEventIndex) => void;
  readonly reject: (error: unknown) => void;
  readonly onProgress?: (message: SinrLiveCellHandoverEventIndexWorkerProgressMessage) => void;
  readonly onPreview?: (message: SinrLiveCellHandoverEventIndexWorkerPreviewMessage) => void;
  readonly signal?: AbortSignal;
  abortListener?: () => void;
}

function responseMessage(value: unknown): SinrLiveCellHandoverEventIndexWorkerResponse | null {
  if (!isSinrLiveCellHandoverEventIndexWorkerMessage(value)) return null;
  if (value.type === 'progress' || value.type === 'preview' || value.type === 'accepted' || value.type === 'error') return value;
  return null;
}

export class SinrLiveCellHandoverEventIndexWorkerTransport {
  private readonly pending = new Map<string, PendingRequest>();
  private sequence = 0;
  private disposed = false;

  private readonly onError = (event: {
    readonly message?: string;
    readonly error?: unknown;
  }): void => {
    if (this.disposed) return;
    const detail = event.error instanceof Error
      ? event.error.message
      : event.message?.trim() || 'SINR event-index Worker failed';
    for (const request of this.pending.values()) {
      if (request.signal !== undefined && request.abortListener !== undefined) {
        request.signal.removeEventListener('abort', request.abortListener);
      }
      request.reject(new SinrLiveCellHandoverEventIndexWorkerError(
        'WORKER_UNAVAILABLE',
        detail,
      ));
    }
    this.pending.clear();
  };

  /**
   * Cancellation is best effort, but settling the caller is not. A Worker may
   * already be closing when abort/dispose runs; letting that postMessage throw
   * would strand the build promise and make readiness wait forever.
   */
  private postCancellation(requestId: string, reason: string): void {
    try {
      this.port.postMessage({
        protocol: SINR_LIVE_CELL_HANDOVER_EVENT_INDEX_WORKER_PROTOCOL,
        type: 'cancel',
        requestId,
        reason,
      });
    } catch {
      // The request is rejected by the caller below even when the Worker can no
      // longer receive its cancellation message.
    }
  }

  private readonly onMessage = (event: { readonly data: unknown }): void => {
    const message = responseMessage(event.data);
    if (message === null) return;
    const request = this.pending.get(message.requestId);
    if (request === undefined) return;
    if (message.type === 'progress') {
      request.onProgress?.(message);
      return;
    }
    if (message.type === 'preview') {
      request.onPreview?.(message);
      return;
    }
    this.pending.delete(message.requestId);
    if (request.signal !== undefined && request.abortListener !== undefined) {
      request.signal.removeEventListener('abort', request.abortListener);
    }
    if (message.type === 'error') {
      request.reject(new SinrLiveCellHandoverEventIndexWorkerError(message.code, message.message));
      return;
    }
    request.resolve(message.index);
  };

  constructor(private readonly port: SinrLiveCellHandoverEventIndexWorkerPort) {
    port.addEventListener('message', this.onMessage);
    // The production module Worker exposes `terminate`; tiny protocol fakes
    // used by the deterministic tests do not. Avoid treating a fake's single
    // listener slot as an error channel while still covering real Worker
    // construction/evaluation failures.
    if (typeof port.terminate === 'function') {
      const errorPort = port as unknown as SinrLiveCellHandoverEventIndexWorkerErrorPort;
      errorPort.addEventListener?.('error', this.onError);
      errorPort.addEventListener?.('messageerror', this.onError);
    }
  }

  build(
    input: BuildSinrLiveCellHandoverEventIndexInput,
    options: SinrLiveCellHandoverEventIndexWorkerBuildOptions = {},
  ): Promise<LiveWalkerHandoverEventIndex> {
    if (this.disposed) {
      return Promise.reject(new SinrLiveCellHandoverEventIndexWorkerError(
        'WORKER_UNAVAILABLE',
        'SINR event-index Worker transport is disposed',
      ));
    }
    if (options.signal?.aborted) {
      return Promise.reject(new SinrLiveCellHandoverEventIndexWorkerError(
        'CANCELLED',
        'SINR event-index Worker request was already cancelled',
      ));
    }
    const requestId = `sinr-cell-event-index-worker-${++this.sequence}`;
    return new Promise<LiveWalkerHandoverEventIndex>((resolve, reject) => {
      const pending: PendingRequest = {
        resolve,
        reject,
        onProgress: options.onProgress,
        onPreview: options.onPreview,
        signal: options.signal,
      };
      const abortListener = () => {
        if (!this.pending.has(requestId)) return;
        this.pending.delete(requestId);
        this.postCancellation(requestId, 'SINR event-index Worker request aborted');
        reject(new SinrLiveCellHandoverEventIndexWorkerError(
          'CANCELLED',
          'SINR event-index Worker request was cancelled',
        ));
      };
      pending.abortListener = abortListener;
      this.pending.set(requestId, pending);
      options.signal?.addEventListener('abort', abortListener, { once: true });
      try {
        this.port.postMessage({
          protocol: SINR_LIVE_CELL_HANDOVER_EVENT_INDEX_WORKER_PROTOCOL,
          type: 'build',
          requestId,
          input,
        });
      } catch (error) {
        this.pending.delete(requestId);
        options.signal?.removeEventListener('abort', abortListener);
        reject(new SinrLiveCellHandoverEventIndexWorkerError(
          'WORKER_UNAVAILABLE',
          error instanceof Error ? error.message : String(error),
        ));
      }
    });
  }

  cancel(requestId: string, reason = 'SINR event-index Worker request cancelled'): void {
    const request = this.pending.get(requestId);
    if (request === undefined) return;
    this.pending.delete(requestId);
    if (request.signal !== undefined && request.abortListener !== undefined) {
      request.signal.removeEventListener('abort', request.abortListener);
    }
    this.postCancellation(requestId, reason);
    request.reject(new SinrLiveCellHandoverEventIndexWorkerError('CANCELLED', reason));
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const [requestId, request] of this.pending) {
      if (request.signal !== undefined && request.abortListener !== undefined) {
        request.signal.removeEventListener('abort', request.abortListener);
      }
      request.reject(new SinrLiveCellHandoverEventIndexWorkerError(
        'CANCELLED',
        'SINR event-index Worker transport was disposed',
      ));
      this.postCancellation(requestId, 'SINR event-index Worker transport disposed');
    }
    this.pending.clear();
    this.port.removeEventListener('message', this.onMessage);
    if (typeof this.port.terminate === 'function') {
      const errorPort = this.port as unknown as SinrLiveCellHandoverEventIndexWorkerErrorPort;
      errorPort.removeEventListener?.('error', this.onError);
      errorPort.removeEventListener?.('messageerror', this.onError);
    }
    this.port.terminate?.();
  }
}

/** Construct the Vite module Worker only in a browser-capable environment. */
export function createSinrLiveCellHandoverEventIndexWorkerTransport(): SinrLiveCellHandoverEventIndexWorkerTransport | null {
  if (typeof globalThis.Worker !== 'function') return null;
  const worker = new Worker(new URL('./sinrLiveCellHandoverEventIndex.worker.ts', import.meta.url), { type: 'module' });
  return new SinrLiveCellHandoverEventIndexWorkerTransport(worker);
}
