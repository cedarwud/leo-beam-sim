import type {
  BuildSinrLiveCellHandoverEventIndexInput,
  SinrLiveCellHandoverEventIndexPreview,
} from './sinrLiveCellHandoverEventIndex';
import type { LiveWalkerHandoverEventIndex } from './liveWalkerHandoverEventIndex';

export const SINR_LIVE_CELL_HANDOVER_EVENT_INDEX_WORKER_PROTOCOL =
  'sinr-live-cell-handover-event-index-worker-v1' as const;

export interface SinrLiveCellHandoverEventIndexWorkerBuildRequest {
  readonly type: 'build';
  readonly protocol: typeof SINR_LIVE_CELL_HANDOVER_EVENT_INDEX_WORKER_PROTOCOL;
  readonly requestId: string;
  readonly input: BuildSinrLiveCellHandoverEventIndexInput;
}

export interface SinrLiveCellHandoverEventIndexWorkerCancelRequest {
  readonly type: 'cancel';
  readonly protocol: typeof SINR_LIVE_CELL_HANDOVER_EVENT_INDEX_WORKER_PROTOCOL;
  readonly requestId: string;
  readonly reason?: string;
}

export type SinrLiveCellHandoverEventIndexWorkerRequest =
  | SinrLiveCellHandoverEventIndexWorkerBuildRequest
  | SinrLiveCellHandoverEventIndexWorkerCancelRequest;

export interface SinrLiveCellHandoverEventIndexWorkerProgress {
  readonly status: 'running' | 'complete';
  readonly completedSteps: number;
  readonly totalSteps: number;
  readonly fraction: number;
}

export interface SinrLiveCellHandoverEventIndexWorkerProgressMessage {
  readonly type: 'progress';
  readonly protocol: typeof SINR_LIVE_CELL_HANDOVER_EVENT_INDEX_WORKER_PROTOCOL;
  readonly requestId: string;
  readonly progress: SinrLiveCellHandoverEventIndexWorkerProgress;
}

export interface SinrLiveCellHandoverEventIndexWorkerPreviewMessage {
  readonly type: 'preview';
  readonly protocol: typeof SINR_LIVE_CELL_HANDOVER_EVENT_INDEX_WORKER_PROTOCOL;
  readonly requestId: string;
  readonly preview: SinrLiveCellHandoverEventIndexPreview;
}

export interface SinrLiveCellHandoverEventIndexWorkerAcceptedMessage {
  readonly type: 'accepted';
  readonly protocol: typeof SINR_LIVE_CELL_HANDOVER_EVENT_INDEX_WORKER_PROTOCOL;
  readonly requestId: string;
  readonly index: LiveWalkerHandoverEventIndex;
}

export type SinrLiveCellHandoverEventIndexWorkerErrorCode =
  | 'CANCELLED'
  | 'BUILD_FAILED'
  | 'WORKER_UNAVAILABLE'
  | 'INVALID_MESSAGE';

export interface SinrLiveCellHandoverEventIndexWorkerErrorMessage {
  readonly type: 'error';
  readonly protocol: typeof SINR_LIVE_CELL_HANDOVER_EVENT_INDEX_WORKER_PROTOCOL;
  readonly requestId: string;
  readonly code: SinrLiveCellHandoverEventIndexWorkerErrorCode;
  readonly message: string;
  readonly retryable: boolean;
}

export type SinrLiveCellHandoverEventIndexWorkerResponse =
  | SinrLiveCellHandoverEventIndexWorkerProgressMessage
  | SinrLiveCellHandoverEventIndexWorkerPreviewMessage
  | SinrLiveCellHandoverEventIndexWorkerAcceptedMessage
  | SinrLiveCellHandoverEventIndexWorkerErrorMessage;

export type SinrLiveCellHandoverEventIndexWorkerMessage =
  | SinrLiveCellHandoverEventIndexWorkerRequest
  | SinrLiveCellHandoverEventIndexWorkerResponse;

export function isSinrLiveCellHandoverEventIndexWorkerRequest(
  value: unknown,
): value is SinrLiveCellHandoverEventIndexWorkerRequest {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const message = value as Record<string, unknown>;
  return message.protocol === SINR_LIVE_CELL_HANDOVER_EVENT_INDEX_WORKER_PROTOCOL
    && (message.type === 'build' || message.type === 'cancel')
    && typeof message.requestId === 'string'
    && message.requestId.trim() !== ''
    && (message.type !== 'build' || message.input !== null && typeof message.input === 'object');
}

export function isSinrLiveCellHandoverEventIndexWorkerMessage(
  value: unknown,
): value is SinrLiveCellHandoverEventIndexWorkerMessage {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const message = value as Record<string, unknown>;
  return message.protocol === SINR_LIVE_CELL_HANDOVER_EVENT_INDEX_WORKER_PROTOCOL
    && typeof message.type === 'string'
    && typeof message.requestId === 'string'
    && message.requestId.trim() !== '';
}
