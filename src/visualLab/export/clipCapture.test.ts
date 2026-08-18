import assert from 'node:assert/strict';
import {
  captureCanvasToWebm,
  CanvasWebmCaptureError,
  type CanvasWebmBrowserPrimitives,
  type CanvasWebmMediaRecorder,
  type CanvasWebmMediaRecorderConstructor,
  type CanvasWebmTimerPrimitives,
} from './clipCapture';

const CANVAS = {} as HTMLCanvasElement;
const PROVENANCE = {
  analysisRunId: 'analysis-run-7',
  frame: 'frame-42',
  story: 'story-power-cap',
  runtime: 'story-runtime-v1',
  source: 'accepted-canonical-frame',
} as const;

interface TimerTask {
  readonly callback: () => void;
  readonly delayMs: number;
  cancelled: boolean;
}

function createTimers(): {
  readonly primitives: CanvasWebmTimerPrimitives;
  readonly tasks: TimerTask[];
  readonly advanceToNext: () => Promise<void>;
  readonly currentTime: () => number;
  readonly clearCount: () => number;
} {
  const tasks: TimerTask[] = [];
  let now = 0;
  let clears = 0;
  const primitives: CanvasWebmTimerPrimitives = {
    now: () => now,
    setTimeout: (callback, delayMs) => {
      const task: TimerTask = { callback, delayMs, cancelled: false };
      tasks.push(task);
      return task;
    },
    clearTimeout: handle => {
      clears += 1;
      (handle as TimerTask).cancelled = true;
    },
  };
  const advanceToNext = async (): Promise<void> => {
    const next = tasks
      .filter(task => !task.cancelled)
      .sort((left, right) => left.delayMs - right.delayMs)[0];
    assert.notEqual(next, undefined, 'expected a queued timer');
    next.cancelled = true;
    now += next.delayMs;
    next.callback();
    await Promise.resolve();
    await Promise.resolve();
  };
  return {
    primitives,
    tasks,
    advanceToNext,
    currentTime: () => now,
    clearCount: () => clears,
  };
}

interface FakeBlob extends Blob {
  readonly payload: Uint8Array;
}

function blobFromBytes(bytes: readonly number[]): FakeBlob {
  const payload = Uint8Array.from(bytes);
  const buffer = payload.buffer.slice(0);
  return {
    payload,
    size: payload.byteLength,
    type: 'video/webm',
    arrayBuffer: async () => buffer,
    slice: () => blobFromBytes([]),
    stream: () => new ReadableStream(),
    text: async () => '',
  } as unknown as FakeBlob;
}

class FakeRecorder implements CanvasWebmMediaRecorder {
  static supportedMimeTypes: readonly string[] = [];
  static latest: FakeRecorder | null = null;
  readonly stream: MediaStream;
  readonly mimeType: string;
  state: 'inactive' | 'recording' = 'inactive';
  ondataavailable: ((event: { readonly data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  startCalls = 0;
  stopCalls = 0;

  constructor(stream: MediaStream, options: { readonly mimeType?: string } = {}) {
    this.stream = stream;
    this.mimeType = options.mimeType ?? '';
    FakeRecorder.latest = this;
  }

  static isTypeSupported(mimeType: string): boolean {
    return FakeRecorder.supportedMimeTypes.includes(mimeType);
  }

  start(): void {
    this.startCalls += 1;
    this.state = 'recording';
  }

  stop(): void {
    this.stopCalls += 1;
    this.state = 'inactive';
    this.ondataavailable?.({ data: blobFromBytes([0x1, 0x2, 0x3]) });
    this.onstop?.();
  }

  emitError(error: unknown): void {
    this.onerror?.(error);
    if (this.state !== 'inactive') this.stop();
  }
}

const RECORDER = FakeRecorder as unknown as CanvasWebmMediaRecorderConstructor;

function browserFor(
  timers: ReturnType<typeof createTimers>,
  supportedMimeTypes: readonly string[] = ['video/webm;codecs=vp8'],
): CanvasWebmBrowserPrimitives {
  FakeRecorder.supportedMimeTypes = supportedMimeTypes;
  return {
    mediaRecorder: RECORDER,
    captureStream: (_canvas, fps) => ({ fps } as unknown as MediaStream),
    createBlob: chunks => {
      const bytes = chunks.flatMap(chunk => Array.from((chunk as unknown as FakeBlob).payload));
      return blobFromBytes(bytes);
    },
    blobToArrayBuffer: async blob => blob.arrayBuffer(),
  };
}

interface FakeCaptureTrack {
  readonly requestFrame?: () => void;
  readonly getSettings: () => MediaTrackSettings;
  readonly stop: () => void;
  stopCalls: number;
}

function createCaptureTrack(options: {
  readonly frameRate?: number;
  readonly requestFrame?: boolean;
} = {}): FakeCaptureTrack {
  const track: FakeCaptureTrack = {
    getSettings: () => ({
      ...(options.frameRate === undefined ? {} : { frameRate: options.frameRate }),
    }),
    stopCalls: 0,
    stop: () => {
      track.stopCalls += 1;
    },
  };
  if (options.requestFrame) {
    (track as { requestFrame?: () => void }).requestFrame = () => undefined;
  }
  return track;
}

function streamForTrack(track: FakeCaptureTrack): MediaStream {
  return {
    getVideoTracks: () => [track],
    getTracks: () => [track],
  } as unknown as MediaStream;
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function expectCaptureError(
  promise: Promise<unknown>,
  code: CanvasWebmCaptureError['code'],
): Promise<CanvasWebmCaptureError> {
  let error: unknown = null;
  try {
    await promise;
  } catch (candidate) {
    error = candidate;
  }
  assert.notEqual(error, null, 'expected capture promise to reject');
  assert.ok(error instanceof CanvasWebmCaptureError);
  assert.equal(error.code, code);
  return error;
}

// Success chooses the first supported deterministic MIME and records each
// callback-owned presentation frame without creating any scientific values.
{
  const timers = createTimers();
  const drawnFrames: number[] = [];
  const capture = captureCanvasToWebm({
    canvas: CANVAS,
    provenance: PROVENANCE,
    durationMs: 250,
    fps: 10,
    browser: browserFor(timers, ['video/webm']),
    timers: timers.primitives,
    drawFrame: frame => {
      drawnFrames.push(frame.frameIndex);
      assert.equal(frame.canvas, CANVAS);
      assert.deepEqual(frame.provenance, PROVENANCE);
      // The helper passes timing/identity only; the callback owns all labels.
    },
  });
  await settle();
  assert.ok(FakeRecorder.latest);
  assert.equal(FakeRecorder.latest?.startCalls, 1);
  while (timers.tasks.some(task => !task.cancelled)) await timers.advanceToNext();
  const result = await capture;
  assert.equal(result.status, 'completed');
  assert.equal(result.cancelled, false);
  assert.equal(result.mimeType, 'video/webm');
  assert.deepEqual(Array.from(result.bytes), [1, 2, 3]);
  assert.equal(result.durationMs, 250);
  assert.equal(result.durationSec, 0.25);
  assert.equal(result.duration, 0.25);
  assert.equal(result.fps, 10);
  assert.deepEqual(drawnFrames, [0, 1, 2]);
  assert.equal(Object.isFrozen(result.provenance), true);
  assert.equal(result.provenance.source, 'accepted-canonical-frame');
}

// No recorder or canvas stream support is an explicit unavailable path.
{
  const timers = createTimers();
  const error = await expectCaptureError(
    captureCanvasToWebm({
      canvas: CANVAS,
      provenance: PROVENANCE,
      browser: {
        isTypeSupported: () => false,
        captureStream: () => ({}) as MediaStream,
      },
      timers: timers.primitives,
      drawFrame: () => undefined,
    }),
    'UNSUPPORTED',
  );
  assert.match(error.message, /MediaRecorder is unavailable|WebM/);
}

// A recorder error stops the recorder once and rejects rather than publishing
// a partial WebM as if it were a completed clip.
{
  const timers = createTimers();
  const capture = captureCanvasToWebm({
    canvas: CANVAS,
    provenance: PROVENANCE,
    durationMs: 1_000,
    fps: 10,
    browser: browserFor(timers),
    timers: timers.primitives,
    drawFrame: () => undefined,
  });
  await settle();
  assert.ok(FakeRecorder.latest);
  FakeRecorder.latest?.emitError(new Error('encoder failed'));
  const error = await expectCaptureError(capture, 'RECORDER_ERROR');
  assert.match(error.message, /encoder failed/);
  assert.equal(FakeRecorder.latest?.stopCalls, 1);
}

// Abort resolves a bounded partial result with an explicit cancelled status;
// it never leaves frame/completion timers running.
{
  const timers = createTimers();
  const controller = new AbortController();
  const capture = captureCanvasToWebm({
    canvas: CANVAS,
    provenance: PROVENANCE,
    durationMs: 1_000,
    fps: 10,
    signal: controller.signal,
    browser: browserFor(timers),
    timers: timers.primitives,
    drawFrame: () => undefined,
  });
  await settle();
  controller.abort();
  const result = await capture;
  assert.equal(result.status, 'cancelled');
  assert.equal(result.cancelled, true);
  assert.equal(result.mimeType, 'video/webm;codecs=vp8');
  assert.equal(result.provenance.analysisRunId, PROVENANCE.analysisRunId);
  assert.equal(FakeRecorder.latest?.stopCalls, 1);
  assert.ok(timers.clearCount() >= 1);
  assert.equal(timers.tasks.some(task => !task.cancelled), false);
}

// The helper copies and freezes identity before drawing; later caller changes
// cannot relabel an already-captured accepted frame/story/runtime.
{
  const timers = createTimers();
  const mutable = {
    analysisRunId: 'run-before',
    frame: 'frame-before',
    story: 'story-before',
    runtime: 'runtime-before',
  };
  const capture = captureCanvasToWebm({
    canvas: CANVAS,
    provenance: mutable,
    durationMs: 100,
    fps: 10,
    browser: browserFor(timers),
    timers: timers.primitives,
    drawFrame: () => undefined,
  });
  mutable.analysisRunId = 'run-after';
  mutable.frame = 'frame-after';
  await settle();
  while (timers.tasks.some(task => !task.cancelled)) await timers.advanceToNext();
  const result = await capture;
  assert.deepEqual(result.provenance, {
    analysisRunId: 'run-before',
    frame: 'frame-before',
    story: 'story-before',
    runtime: 'runtime-before',
  });
  assert.equal(Object.isFrozen(result.provenance), true);
}

// A native/manual stream can expose requestFrame() even when its requested
// frame rate is zero.  That capability is accepted and passed to the recorder
// without opening a second stream.
{
  const timers = createTimers();
  const manualTrack = createCaptureTrack({ requestFrame: true, frameRate: 0 });
  const stream = streamForTrack(manualTrack);
  const calls: number[] = [];
  FakeRecorder.latest = null;
  const capture = captureCanvasToWebm({
    canvas: CANVAS,
    provenance: PROVENANCE,
    durationMs: 100,
    fps: 10,
    browser: {
      ...browserFor(timers),
      captureStream: (_canvas, fps) => {
        calls.push(fps);
        return stream;
      },
    },
    timers: timers.primitives,
    drawFrame: () => undefined,
  });
  await settle();
  while (timers.tasks.some(task => !task.cancelled)) await timers.advanceToNext();
  await capture;
  assert.deepEqual(calls, [10]);
  const recorder = FakeRecorder.latest as FakeRecorder | null;
  assert.ok(recorder);
  assert.equal(recorder.stream, stream);
}

// A custom factory may hide captureStream(0).  When that manual track cannot
// request frames, the helper retries with positive fps and records only the
// verified fallback stream.
{
  const timers = createTimers();
  const manualTrack = createCaptureTrack({ frameRate: 0 });
  const positiveTrack = createCaptureTrack({ frameRate: 10 });
  const manualStream = streamForTrack(manualTrack);
  const positiveStream = streamForTrack(positiveTrack);
  const streams = [manualStream, positiveStream];
  const calls: number[] = [];
  FakeRecorder.latest = null;
  const capture = captureCanvasToWebm({
    canvas: CANVAS,
    provenance: PROVENANCE,
    durationMs: 100,
    fps: 10,
    browser: {
      ...browserFor(timers),
      captureStream: (_canvas, fps) => {
        calls.push(fps);
        return streams.shift() as MediaStream;
      },
    },
    timers: timers.primitives,
    drawFrame: () => undefined,
  });
  await settle();
  while (timers.tasks.some(task => !task.cancelled)) await timers.advanceToNext();
  const result = await capture;
  assert.equal(result.status, 'completed');
  assert.deepEqual(calls, [10, 10]);
  assert.equal(manualTrack.stopCalls, 1);
  const recorder = FakeRecorder.latest as FakeRecorder | null;
  assert.ok(recorder);
  assert.equal(recorder.stream, positiveStream);
}

// When an integration callback returns a manual stream but the canvas itself
// supports the native API, prefer the native positive-fps stream.  This is the
// portability path for browsers that expose captureStream(0) but not
// CanvasCaptureMediaStreamTrack.requestFrame().
{
  const timers = createTimers();
  const manualTrack = createCaptureTrack({ frameRate: 0 });
  const positiveTrack = createCaptureTrack({ frameRate: 10 });
  const manualStream = streamForTrack(manualTrack);
  const positiveStream = streamForTrack(positiveTrack);
  const customCalls: number[] = [];
  const nativeCalls: number[] = [];
  const nativeCanvas = {
    captureStream: (fps: number) => {
      nativeCalls.push(fps);
      return positiveStream;
    },
  } as unknown as HTMLCanvasElement;
  FakeRecorder.latest = null;
  const capture = captureCanvasToWebm({
    canvas: nativeCanvas,
    provenance: PROVENANCE,
    durationMs: 100,
    fps: 10,
    browser: {
      ...browserFor(timers),
      captureStream: (_canvas, fps) => {
        customCalls.push(fps);
        return manualStream;
      },
    },
    timers: timers.primitives,
    drawFrame: () => undefined,
  });
  await settle();
  while (timers.tasks.some(task => !task.cancelled)) await timers.advanceToNext();
  const result = await capture;
  assert.equal(result.status, 'completed');
  assert.deepEqual(customCalls, [10]);
  assert.deepEqual(nativeCalls, [10]);
  assert.equal(manualTrack.stopCalls, 1);
  const recorder = FakeRecorder.latest as FakeRecorder | null;
  assert.ok(recorder);
  assert.equal(recorder.stream, positiveStream);
}

// If neither the manual track nor the positive-fps retry can capture frames,
// fail before constructing/starting MediaRecorder instead of publishing an
// empty or misleading clip.
{
  const timers = createTimers();
  const unsupportedTracks = [createCaptureTrack({ frameRate: 0 }), createCaptureTrack({ frameRate: 0 })];
  const unsupportedStreams = unsupportedTracks.map(streamForTrack);
  const calls: number[] = [];
  FakeRecorder.latest = null;
  const error = await expectCaptureError(
    captureCanvasToWebm({
      canvas: CANVAS,
      provenance: PROVENANCE,
      durationMs: 100,
      fps: 10,
      browser: {
        ...browserFor(timers),
        captureStream: (_canvas, fps) => {
          calls.push(fps);
          return unsupportedStreams.shift() as MediaStream;
        },
      },
      timers: timers.primitives,
      drawFrame: () => undefined,
    }),
    'UNSUPPORTED',
  );
  assert.match(error.message, /without requestFrame|positive-fps/);
  assert.deepEqual(calls, [10, 10]);
  assert.equal(unsupportedTracks[0]?.stopCalls, 1);
  assert.equal(unsupportedTracks[1]?.stopCalls, 1);
  assert.equal(FakeRecorder.latest, null);
}

console.log('visual-lab canvas WebM capture tests passed');
