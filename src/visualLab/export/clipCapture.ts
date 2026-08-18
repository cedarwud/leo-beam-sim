/**
 * Browser-side canvas capture for source-backed Visual Lab stories.
 *
 * This module deliberately has no knowledge of the scene, captions, or
 * scientific values.  The caller supplies a draw callback for every frame;
 * the callback is the only place that may composite the accepted scene and
 * its readable labels.  The recorder is consequently an output side effect,
 * never a second source of evidence.
 */

export const VISUAL_LAB_WEBM_MIME_CANDIDATES = Object.freeze([
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
] as const);

export const VISUAL_LAB_WEBM_DEFAULT_DURATION_MS = 5_000;
export const VISUAL_LAB_WEBM_DEFAULT_FPS = 30;
export const VISUAL_LAB_WEBM_MAX_DURATION_MS = 30_000;
export const VISUAL_LAB_WEBM_MAX_FPS = 60;

/**
 * The four fields are intentionally required.  A clip without an accepted
 * run, frame, story, and runtime cannot be used as source-backed evidence.
 * Additional caller-owned string fields are retained in the returned copy.
 */
export type CanvasWebmProvenanceIdentity = Readonly<{
  readonly analysisRunId: string;
  readonly frame: string;
  readonly story: string;
  readonly runtime: string;
}> & Readonly<Record<string, string>>;

export type CanvasWebmCaptureStatus = 'completed' | 'cancelled';

export type CanvasWebmCaptureErrorCode =
  | 'UNSUPPORTED'
  | 'INVALID_OPTIONS'
  | 'CANCELLED'
  | 'RECORDER_ERROR'
  | 'DRAW_ERROR'
  | 'BLOB_ERROR'
  | 'EMPTY_CAPTURE';

export class CanvasWebmCaptureError extends Error {
  readonly code: CanvasWebmCaptureErrorCode;
  readonly cause: unknown;

  constructor(code: CanvasWebmCaptureErrorCode, message: string, cause: unknown = null) {
    super(message);
    this.name = 'CanvasWebmCaptureError';
    this.code = code;
    this.cause = cause;
  }
}

export interface CanvasWebmDrawFrame<P extends CanvasWebmProvenanceIdentity = CanvasWebmProvenanceIdentity> {
  readonly canvas: HTMLCanvasElement;
  /** Zero-based frame number; frame zero is drawn before recording starts. */
  readonly frameIndex: number;
  /** Deterministic presentation time derived from frameIndex and fps. */
  readonly elapsedMs: number;
  readonly elapsedSec: number;
  readonly durationMs: number;
  readonly durationSec: number;
  readonly fps: number;
  readonly provenance: Readonly<P>;
}

export type CanvasWebmDrawCallback<P extends CanvasWebmProvenanceIdentity = CanvasWebmProvenanceIdentity> = (
  frame: CanvasWebmDrawFrame<P>,
) => void | Promise<void>;

export interface CanvasWebmMediaRecorderDataEvent {
  readonly data: Blob;
}

/** Minimal recorder surface used by the helper and by node test doubles. */
export interface CanvasWebmMediaRecorder {
  readonly state?: 'inactive' | 'recording' | 'paused' | string;
  ondataavailable: ((event: CanvasWebmMediaRecorderDataEvent) => void) | null;
  onstop: (() => void) | null;
  onerror: ((event: unknown) => void) | null;
  start(timeslice?: number): void;
  stop(): void;
}

export interface CanvasWebmMediaRecorderConstructor {
  new (stream: MediaStream, options?: { readonly mimeType?: string }): CanvasWebmMediaRecorder;
  isTypeSupported?: (mimeType: string) => boolean;
}

/** Browser capabilities are injectable so the lifecycle is testable in Node. */
export interface CanvasWebmBrowserPrimitives {
  readonly mediaRecorder?: CanvasWebmMediaRecorderConstructor;
  readonly isTypeSupported?: (mimeType: string) => boolean;
  readonly captureStream?: (canvas: HTMLCanvasElement, fps: number) => MediaStream;
  readonly createBlob?: (chunks: readonly Blob[], mimeType: string) => Blob;
  readonly blobToArrayBuffer?: (blob: Blob) => Promise<ArrayBuffer>;
}

/** Timers are injectable; no wall-clock timer is required by node tests. */
export interface CanvasWebmTimerPrimitives {
  readonly now?: () => number;
  readonly setTimeout: (callback: () => void, delayMs: number) => unknown;
  readonly clearTimeout: (handle: unknown) => void;
}

export interface CanvasWebmCaptureOptions<P extends CanvasWebmProvenanceIdentity = CanvasWebmProvenanceIdentity> {
  readonly canvas: HTMLCanvasElement;
  readonly drawFrame: CanvasWebmDrawCallback<P>;
  readonly provenance: P;
  /** Bounded target duration. The result exposes this requested duration. */
  readonly durationMs?: number;
  readonly fps?: number;
  readonly signal?: AbortSignal;
  readonly mimeCandidates?: readonly string[];
  readonly browser?: CanvasWebmBrowserPrimitives;
  readonly timers?: CanvasWebmTimerPrimitives;
}

export interface CanvasWebmCaptureResult<P extends CanvasWebmProvenanceIdentity = CanvasWebmProvenanceIdentity> {
  readonly status: CanvasWebmCaptureStatus;
  readonly cancelled: boolean;
  readonly bytes: Uint8Array;
  readonly mimeType: string;
  /** Requested recording duration in milliseconds and seconds. */
  readonly durationMs: number;
  readonly durationSec: number;
  /** Alias for durationSec for consumers that use a single duration field. */
  readonly duration: number;
  readonly fps: number;
  readonly frameCount: number;
  /** Actual wall-clock span observed for a cancelled partial recording. */
  readonly capturedDurationMs: number;
  readonly provenance: Readonly<P>;
}

type TimerHandle = unknown;
type StopReason = 'completed' | 'cancelled' | 'error';

interface NormalizedOptions<P extends CanvasWebmProvenanceIdentity> {
  readonly canvas: HTMLCanvasElement;
  readonly drawFrame: CanvasWebmDrawCallback<P>;
  readonly provenance: Readonly<P>;
  readonly durationMs: number;
  readonly fps: number;
  readonly signal: AbortSignal | null;
  readonly mimeCandidates: readonly string[];
  readonly browser: CanvasWebmBrowserPrimitives;
  readonly timers: Required<CanvasWebmTimerPrimitives>;
}

function finitePositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function captureError(
  code: CanvasWebmCaptureErrorCode,
  message: string,
  cause: unknown = null,
): CanvasWebmCaptureError {
  return cause instanceof CanvasWebmCaptureError && cause.code === code
    ? cause
    : new CanvasWebmCaptureError(code, message, cause);
}

function errorMessage(value: unknown, fallback: string): string {
  if (value instanceof Error && value.message.trim().length > 0) return value.message;
  if (typeof value === 'string' && value.trim().length > 0) return value;
  if (typeof value === 'object' && value !== null) {
    const event = value as { readonly error?: unknown; readonly message?: unknown };
    if (event.error instanceof Error && event.error.message.trim().length > 0) return event.error.message;
    if (typeof event.message === 'string' && event.message.trim().length > 0) return event.message;
  }
  return fallback;
}

function freezeProvenance<P extends CanvasWebmProvenanceIdentity>(input: P): Readonly<P> {
  if (input === null || typeof input !== 'object') {
    throw captureError('INVALID_OPTIONS', 'capture provenance must be an object');
  }
  for (const field of ['analysisRunId', 'frame', 'story', 'runtime'] as const) {
    if (!nonEmpty(input[field])) {
      throw captureError('INVALID_OPTIONS', `capture provenance.${field} must be non-empty text`);
    }
  }
  const copy: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!nonEmpty(value)) {
      throw captureError('INVALID_OPTIONS', `capture provenance.${key} must be non-empty text`);
    }
    copy[key] = value;
  }
  return Object.freeze(copy) as Readonly<P>;
}

function defaultTimers(): Required<CanvasWebmTimerPrimitives> {
  const globals = globalThis as typeof globalThis & {
    setTimeout?: (callback: () => void, delayMs?: number) => unknown;
    clearTimeout?: (handle: unknown) => void;
  };
  if (typeof globals.setTimeout !== 'function' || typeof globals.clearTimeout !== 'function') {
    throw captureError('UNSUPPORTED', 'browser timer primitives are unavailable');
  }
  return {
    now: () => Date.now(),
    setTimeout: (callback, delayMs) => globals.setTimeout!(callback, delayMs),
    clearTimeout: handle => globals.clearTimeout!(handle),
  };
}

function defaultBrowserPrimitives(): CanvasWebmBrowserPrimitives {
  const globals = globalThis as typeof globalThis & {
    MediaRecorder?: CanvasWebmMediaRecorderConstructor;
    Blob?: new (parts?: readonly Blob[], options?: { readonly type?: string }) => Blob;
  };
  return {
    mediaRecorder: globals.MediaRecorder,
    createBlob: (chunks, mimeType) => {
      if (typeof globals.Blob !== 'function') {
        throw captureError('UNSUPPORTED', 'Blob is unavailable');
      }
      return new globals.Blob(chunks, { type: mimeType });
    },
    blobToArrayBuffer: async blob => {
      if (typeof blob.arrayBuffer !== 'function') {
        throw captureError('UNSUPPORTED', 'Blob.arrayBuffer is unavailable');
      }
      return blob.arrayBuffer();
    },
  };
}

function normalizeOptions<P extends CanvasWebmProvenanceIdentity>(
  options: CanvasWebmCaptureOptions<P>,
): NormalizedOptions<P> {
  if (options === null || typeof options !== 'object') {
    throw captureError('INVALID_OPTIONS', 'capture options must be an object');
  }
  if (options.canvas === null || typeof options.canvas !== 'object') {
    throw captureError('INVALID_OPTIONS', 'an existing HTMLCanvasElement is required');
  }
  if (typeof options.drawFrame !== 'function') {
    throw captureError('INVALID_OPTIONS', 'drawFrame must be a function');
  }
  const durationMs = options.durationMs ?? VISUAL_LAB_WEBM_DEFAULT_DURATION_MS;
  if (!finitePositive(durationMs) || durationMs > VISUAL_LAB_WEBM_MAX_DURATION_MS) {
    throw captureError(
      'INVALID_OPTIONS',
      `durationMs must be finite, positive, and at most ${VISUAL_LAB_WEBM_MAX_DURATION_MS}`,
    );
  }
  const fps = options.fps ?? VISUAL_LAB_WEBM_DEFAULT_FPS;
  if (!finitePositive(fps) || !Number.isInteger(fps) || fps > VISUAL_LAB_WEBM_MAX_FPS) {
    throw captureError(
      'INVALID_OPTIONS',
      `fps must be a positive integer at most ${VISUAL_LAB_WEBM_MAX_FPS}`,
    );
  }
  const mimeCandidates = options.mimeCandidates ?? VISUAL_LAB_WEBM_MIME_CANDIDATES;
  if (mimeCandidates.length === 0 || mimeCandidates.some(mime => (
    typeof mime !== 'string' || !/^video\/webm(?:;|$)/i.test(mime)
  ))) {
    throw captureError('INVALID_OPTIONS', 'mimeCandidates must contain only WebM video MIME types');
  }
  const browser = {
    ...defaultBrowserPrimitives(),
    ...(options.browser ?? {}),
  };
  const timerInput = options.timers ?? defaultTimers();
  if (typeof timerInput.setTimeout !== 'function' || typeof timerInput.clearTimeout !== 'function') {
    throw captureError('INVALID_OPTIONS', 'setTimeout and clearTimeout timer primitives are required');
  }
  return {
    canvas: options.canvas,
    drawFrame: options.drawFrame,
    provenance: freezeProvenance(options.provenance),
    durationMs,
    fps,
    signal: options.signal ?? null,
    mimeCandidates: Object.freeze([...mimeCandidates]),
    browser,
    timers: {
      now: timerInput.now ?? (() => Date.now()),
      setTimeout: timerInput.setTimeout,
      clearTimeout: timerInput.clearTimeout,
    },
  };
}

function globalRecorderConstructor(): CanvasWebmMediaRecorderConstructor | undefined {
  const globals = globalThis as typeof globalThis & {
    MediaRecorder?: CanvasWebmMediaRecorderConstructor;
  };
  return globals.MediaRecorder;
}

function selectMimeType(
  candidates: readonly string[],
  browser: CanvasWebmBrowserPrimitives,
  recorderConstructor: CanvasWebmMediaRecorderConstructor,
): string {
  const isTypeSupported = browser.isTypeSupported
    ?? recorderConstructor.isTypeSupported;
  if (typeof isTypeSupported !== 'function') {
    throw captureError('UNSUPPORTED', 'MediaRecorder.isTypeSupported is unavailable');
  }
  for (const candidate of candidates) {
    try {
      if (isTypeSupported(candidate)) return candidate;
    } catch {
      // A malformed/unsupported candidate is skipped deterministically. The
      // helper still fails closed when no candidate is accepted.
    }
  }
  throw captureError('UNSUPPORTED', 'no supported WebM MediaRecorder MIME type is available');
}

interface CanvasCaptureVideoTrackLike {
  readonly requestFrame?: () => void;
  getSettings?: () => MediaTrackSettings;
}

interface CanvasCaptureStreamLike {
  getVideoTracks?: () => readonly CanvasCaptureVideoTrackLike[];
}

type CanvasCaptureTrackInspection =
  | 'manual'
  | 'positive-fps'
  | 'unsupported-manual'
  | 'no-track-api'
  | 'no-video-track';

function inspectCanvasCaptureTrack(stream: MediaStream): CanvasCaptureTrackInspection {
  const candidate = stream as CanvasCaptureStreamLike;
  if (typeof candidate.getVideoTracks !== 'function') return 'no-track-api';
  let tracks: readonly CanvasCaptureVideoTrackLike[];
  try {
    tracks = candidate.getVideoTracks();
  } catch {
    return 'no-video-track';
  }
  const track = tracks[0];
  if (track === undefined) return 'no-video-track';
  if (typeof track.requestFrame === 'function') return 'manual';
  const frameRate = track.getSettings?.().frameRate;
  return finitePositive(frameRate ?? Number.NaN) ? 'positive-fps' : 'unsupported-manual';
}

function canvasCaptureStream(
  canvas: HTMLCanvasElement,
  fps: number,
  browser: CanvasWebmBrowserPrimitives,
): MediaStream {
  const candidate = canvas as HTMLCanvasElement & {
    captureStream?: (frameRate?: number) => MediaStream;
  };
  const nativeCapture = typeof candidate.captureStream === 'function'
    ? (sourceCanvas: HTMLCanvasElement, frameRate: number) => sourceCanvas.captureStream!(frameRate)
    : undefined;
  const capture = browser.captureStream ?? (
    nativeCapture
  );
  if (capture === undefined) {
    throw captureError('UNSUPPORTED', 'HTMLCanvasElement.captureStream is unavailable');
  }

  let stream: MediaStream;
  try {
    // The public capture helper requests a positive frame rate.  A caller may
    // still intentionally return a stream created with captureStream(0) for
    // manual requestFrame() capture, so inspect the returned track before the
    // recorder is constructed rather than silently producing an empty WebM.
    stream = capture(canvas, fps);
  } catch (error) {
    throw captureError(
      'UNSUPPORTED',
      `canvas.captureStream failed: ${errorMessage(error, 'unknown error')}`,
      error,
    );
  }
  if (stream === null || stream === undefined) {
    throw captureError('UNSUPPORTED', 'canvas.captureStream returned no MediaStream');
  }

  const inspection = inspectCanvasCaptureTrack(stream);
  if (
    inspection === 'manual'
    || inspection === 'positive-fps'
    || inspection === 'no-track-api'
  ) {
    return stream;
  }

  // A custom capture factory can hide a native captureStream(0) call (as the
  // replay integration does).  If that manual track cannot request a frame,
  // prefer the real canvas's positive-fps stream when it is available, then
  // retry the injectable factory.  This keeps the existing API while making
  // the manual-frame capability check fail closed before MediaRecorder starts.
  stopCaptureStream(stream);
  const fallbackFactories: Array<{
    readonly capture: (sourceCanvas: HTMLCanvasElement, frameRate: number) => MediaStream;
    readonly label: string;
  }> = [];
  if (browser.captureStream !== undefined && nativeCapture !== undefined) {
    fallbackFactories.push({ capture: nativeCapture, label: 'native positive-fps' });
  }
  if (browser.captureStream !== undefined) {
    fallbackFactories.push({ capture: browser.captureStream, label: 'positive-fps' });
  }

  let fallbackFailure: unknown = null;
  for (const fallbackFactory of fallbackFactories) {
    let fallback: MediaStream;
    try {
      fallback = fallbackFactory.capture(canvas, fps);
    } catch (error) {
      fallbackFailure = error;
      continue;
    }
    if (fallback === null || fallback === undefined) {
      fallbackFailure = new Error(`${fallbackFactory.label} captureStream returned no MediaStream`);
      continue;
    }
    const fallbackInspection = inspectCanvasCaptureTrack(fallback);
    if (
      fallbackInspection === 'manual'
      || fallbackInspection === 'positive-fps'
      || fallbackInspection === 'no-track-api'
    ) {
      return fallback;
    }
    stopCaptureStream(fallback);
    fallbackFailure = new Error(
      `${fallbackFactory.label} captureStream returned an unusable video track`,
    );
  }

  throw captureError(
    'UNSUPPORTED',
    'canvas.captureStream returned a video track without requestFrame; '
      + 'the positive-fps fallback did not provide a verifiable capture rate',
    fallbackFailure,
  );
}

function recorderIsInactive(recorder: CanvasWebmMediaRecorder): boolean {
  return recorder.state === 'inactive';
}

function blobHasData(blob: Blob): boolean {
  return blob !== null && blob !== undefined && (
    typeof blob.size !== 'number' || blob.size > 0
  );
}

function stopCaptureStream(stream: MediaStream): void {
  const candidate = stream as MediaStream & {
    getTracks?: () => readonly MediaStreamTrack[];
  };
  if (typeof candidate.getTracks !== 'function') return;
  try {
    for (const track of candidate.getTracks()) track.stop();
  } catch {
    // Stream cleanup is best effort. Recorder/blob errors remain the
    // authoritative capture result and are never hidden by a track cleanup
    // implementation detail.
  }
}

/**
 * Capture one bounded WebM clip from an existing canvas.
 *
 * The promise rejects for unsupported capabilities, drawing failures, and
 * recorder/blob failures.  Abort after recording starts resolves with a
 * `cancelled` partial result so callers can distinguish an intentional stop
 * from a failed capture; no caller identity or scientific value is invented.
 */
export async function captureCanvasToWebm<
  P extends CanvasWebmProvenanceIdentity = CanvasWebmProvenanceIdentity,
>(options: CanvasWebmCaptureOptions<P>): Promise<CanvasWebmCaptureResult<P>> {
  const config = normalizeOptions(options);
  if (config.signal?.aborted) {
    throw captureError('CANCELLED', 'canvas capture was cancelled before it started');
  }

  const browser = config.browser;
  const recorderConstructor = browser.mediaRecorder ?? globalRecorderConstructor();
  if (typeof recorderConstructor !== 'function') {
    throw captureError('UNSUPPORTED', 'MediaRecorder is unavailable');
  }
  const mimeType = selectMimeType(config.mimeCandidates, browser, recorderConstructor);
  let stream: MediaStream;
  try {
    stream = canvasCaptureStream(config.canvas, config.fps, browser);
  } catch (error) {
    throw error instanceof CanvasWebmCaptureError
      ? error
      : captureError('UNSUPPORTED', `canvas.captureStream failed: ${errorMessage(error, 'unknown error')}`, error);
  }

  let recorder: CanvasWebmMediaRecorder;
  try {
    recorder = new recorderConstructor(stream, { mimeType });
  } catch (error) {
    stopCaptureStream(stream);
    throw captureError(
      'RECORDER_ERROR',
      `MediaRecorder construction failed: ${errorMessage(error, 'unknown error')}`,
      error,
    );
  }

  const chunks: Blob[] = [];
  const intervalMs = 1_000 / config.fps;
  const startedAt = config.timers.now();
  let frameCount = 0;
  let nextFrameIndex = 1;
  let started = false;
  let stopping = false;
  let settled = false;
  let stopReason: StopReason = 'completed';
  let stopError: CanvasWebmCaptureError | null = null;
  let completionTimer: TimerHandle | null = null;
  let frameTimer: TimerHandle | null = null;
  let finishScheduled = false;
  let streamStopped = false;

  const cleanupStream = (): void => {
    if (streamStopped) return;
    streamStopped = true;
    stopCaptureStream(stream);
  };

  const clearTimers = (): void => {
    if (completionTimer !== null) {
      config.timers.clearTimeout(completionTimer);
      completionTimer = null;
    }
    if (frameTimer !== null) {
      config.timers.clearTimeout(frameTimer);
      frameTimer = null;
    }
  };

  const cleanupSignal = (): void => {
    config.signal?.removeEventListener('abort', onAbort);
  };

  let resolveCapture!: (result: CanvasWebmCaptureResult<P>) => void;
  let rejectCapture!: (error: CanvasWebmCaptureError) => void;
  const resultPromise = new Promise<CanvasWebmCaptureResult<P>>((resolve, reject) => {
    resolveCapture = resolve;
    rejectCapture = reject;
  });

  const rejectImmediately = (error: CanvasWebmCaptureError): void => {
    if (settled) return;
    settled = true;
    clearTimers();
    cleanupSignal();
    cleanupStream();
    rejectCapture(error);
  };

  const finish = async (): Promise<void> => {
    if (settled) return;
    settled = true;
    clearTimers();
    cleanupSignal();
    cleanupStream();
    if (stopError !== null) {
      rejectCapture(stopError);
      return;
    }
    const createBlob = browser.createBlob;
    const blobToArrayBuffer = browser.blobToArrayBuffer;
    try {
      if (typeof createBlob !== 'function' || typeof blobToArrayBuffer !== 'function') {
        throw captureError('UNSUPPORTED', 'Blob construction/read primitives are unavailable');
      }
      if (chunks.length === 0 && stopReason === 'completed') {
        throw captureError('EMPTY_CAPTURE', 'MediaRecorder produced no WebM data');
      }
      const blob = createBlob(chunks.slice(), mimeType);
      const buffer = await blobToArrayBuffer(blob);
      const bytes = new Uint8Array(buffer).slice();
      const finishedAt = config.timers.now();
      const capturedDurationMs = Math.max(0, Math.min(
        config.durationMs,
        Number.isFinite(finishedAt - startedAt) ? finishedAt - startedAt : config.durationMs,
      ));
      resolveCapture(Object.freeze({
        status: stopReason === 'cancelled' ? 'cancelled' : 'completed',
        cancelled: stopReason === 'cancelled',
        bytes,
        mimeType,
        durationMs: config.durationMs,
        durationSec: config.durationMs / 1_000,
        duration: config.durationMs / 1_000,
        fps: config.fps,
        frameCount,
        capturedDurationMs,
        provenance: config.provenance,
      }) as CanvasWebmCaptureResult<P>);
    } catch (error) {
      const normalized = error instanceof CanvasWebmCaptureError
        ? error
        : captureError(
          'BLOB_ERROR',
          `WebM bytes could not be read: ${errorMessage(error, 'unknown error')}`,
          error,
        );
      rejectCapture(normalized);
    }
  };

  const scheduleFinish = (): void => {
    if (finishScheduled || settled) return;
    finishScheduled = true;
    // Give a final dataavailable event queued by stop() a chance to run
    // before assembling the Blob.
    void Promise.resolve().then(() => {
      finishScheduled = false;
      return finish();
    });
  };

  const stopRecorder = (reason: StopReason, error: CanvasWebmCaptureError | null = null): void => {
    if (settled) return;
    if (reason === 'error' && stopError === null) stopError = error;
    if (reason === 'cancelled') stopReason = 'cancelled';
    if (stopping) return;
    stopping = true;
    clearTimers();
    if (!started) {
      rejectImmediately(
        (reason === 'cancelled'
          ? captureError('CANCELLED', 'canvas capture was cancelled before recording started')
          : stopError)
          ?? error
          ?? captureError('RECORDER_ERROR', 'capture stopped before MediaRecorder started'),
      );
      return;
    }
    if (recorderIsInactive(recorder)) {
      scheduleFinish();
      return;
    }
    try {
      recorder.stop();
      // Browser `dataavailable` and `stop` events are queued after stop().
      // Finalizing merely because `state` changed synchronously can assemble
      // an empty Blob before those events arrive, so `onstop` owns completion.
    } catch (stopFailure) {
      stopError = stopError ?? captureError(
        'RECORDER_ERROR',
        `MediaRecorder.stop failed: ${errorMessage(stopFailure, 'unknown error')}`,
        stopFailure,
      );
      scheduleFinish();
    }
  };

  const onAbort = (): void => {
    stopRecorder('cancelled');
  };

  recorder.ondataavailable = (event): void => {
    if (event === null || event === undefined || event.data === null || event.data === undefined) return;
    if (blobHasData(event.data)) chunks.push(event.data);
  };
  recorder.onstop = (): void => {
    scheduleFinish();
  };
  recorder.onerror = (event): void => {
    const error = captureError(
      'RECORDER_ERROR',
      `MediaRecorder error: ${errorMessage(event, 'unknown recorder error')}`,
      event,
    );
    stopRecorder('error', error);
  };
  config.signal?.addEventListener('abort', onAbort, { once: true });

  const draw = async (frameIndex: number): Promise<void> => {
    if (stopping || settled) return;
    if (config.signal?.aborted) {
      stopRecorder('cancelled');
      return;
    }
    const elapsedMs = Math.min(config.durationMs, frameIndex * intervalMs);
    const frame = Object.freeze({
      canvas: config.canvas,
      frameIndex,
      elapsedMs,
      elapsedSec: elapsedMs / 1_000,
      durationMs: config.durationMs,
      durationSec: config.durationMs / 1_000,
      fps: config.fps,
      provenance: config.provenance,
    }) as CanvasWebmDrawFrame<P>;
    try {
      await config.drawFrame(frame);
      frameCount = Math.max(frameCount, frameIndex + 1);
    } catch (error) {
      const drawFailure = captureError(
        'DRAW_ERROR',
        `canvas drawFrame failed: ${errorMessage(error, 'unknown drawing error')}`,
        error,
      );
      stopRecorder('error', drawFailure);
    }
  };

  const scheduleNextFrame = (): void => {
    if (stopping || settled || nextFrameIndex * intervalMs >= config.durationMs) return;
    const frameIndex = nextFrameIndex;
    nextFrameIndex += 1;
    frameTimer = config.timers.setTimeout(() => {
      frameTimer = null;
      void draw(frameIndex).then(scheduleNextFrame);
    }, intervalMs);
  };

  try {
    // Resolve support and install handlers before any caller draw side effect.
    await draw(0);
    if (settled) return resultPromise;
    if (config.signal?.aborted) {
      stopRecorder('cancelled');
      return resultPromise;
    }
    // Mark the start attempt before invoking the browser.  Some test doubles
    // and browser implementations can synchronously report an error from
    // start(), after transitioning to recording but before start() returns;
    // that path must still be stopped rather than abandoned.
    started = true;
    try {
      recorder.start();
    } catch (error) {
      const startFailure = captureError(
        'RECORDER_ERROR',
        `MediaRecorder.start failed: ${errorMessage(error, 'unknown recorder error')}`,
        error,
      );
      stopError = startFailure;
      if (recorderIsInactive(recorder)) rejectImmediately(startFailure);
      else stopRecorder('error', startFailure);
      return resultPromise;
    }
    if (settled || stopping) return resultPromise;
    completionTimer = config.timers.setTimeout(() => {
      stopRecorder('completed');
    }, config.durationMs);
    scheduleNextFrame();
  } catch (error) {
    const failure = error instanceof CanvasWebmCaptureError
      ? error
      : captureError('DRAW_ERROR', errorMessage(error, 'canvas capture setup failed'), error);
    if (started) {
      stopRecorder('error', failure);
    } else {
      rejectImmediately(failure);
    }
  }

  return resultPromise;
}

/** Capitalization aliases keep the helper easy to discover at integration sites. */
export const captureCanvasToWebM = captureCanvasToWebm;
export const captureVisualLabClip = captureCanvasToWebm;
