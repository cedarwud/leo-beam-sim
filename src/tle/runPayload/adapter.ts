import type {
  RunPayloadGlobalFramePayload,
  RunPayloadGlobalRequest,
  RunPayloadNtpuRangePayload,
  RunPayloadNtpuRangeRequest,
  RunPayloadPlan,
  SelectableRunRequest,
} from './types';

export type RunPayloadAdapterKind = 'in-process' | 'worker' | 'api' | 'artifact';

/**
 * The only producer seam the route should depend on.
 *
 * All returned values are serializable data contracts.  Implementations may
 * use the current dense builder, a Worker, an HTTP service, or an immutable
 * artifact, but none of those choices should leak into the UI controller.
 */
export interface RunPayloadAdapter {
  readonly kind: RunPayloadAdapterKind;

  resolve(request: SelectableRunRequest, signal?: AbortSignal): Promise<RunPayloadPlan>;

  loadGlobal(
    plan: RunPayloadPlan,
    request: RunPayloadGlobalRequest,
    signal?: AbortSignal,
  ): Promise<RunPayloadGlobalFramePayload>;

  loadNtpU(
    plan: RunPayloadPlan,
    request: RunPayloadNtpuRangeRequest,
    signal?: AbortSignal,
  ): Promise<RunPayloadNtpuRangePayload>;

  /** Optional transport-specific cancellation hook; AbortSignal remains canonical. */
  cancel?(requestId: string, reason?: string): void | Promise<void>;
}

/** Named baseline seam for the first in-process implementation. */
export interface InProcessRunPayloadAdapter extends RunPayloadAdapter {
  readonly kind: 'in-process';
}
