import assert from 'node:assert/strict';
import test from 'node:test';

import { loadProfile } from '../profiles';
import {
  buildSinrLiveCellHandoverEventIndex,
  createSinrLiveCellHandoverEventIndexBuilder,
  type BuildSinrLiveCellHandoverEventIndexInput,
  type SinrLiveCellHandoverEventIndexPreview,
  type SinrLiveCellHandoverEventIndexBuilder,
} from './sinrLiveCellHandoverEventIndex';
import {
  createSinrLiveCellHandoverEventIndexWorkerRuntime,
  type SinrLiveCellHandoverEventIndexWorkerRuntimePort,
} from './sinrLiveCellHandoverEventIndexWorkerRuntime';
import {
  SINR_LIVE_CELL_HANDOVER_EVENT_INDEX_WORKER_PROTOCOL,
  type SinrLiveCellHandoverEventIndexWorkerMessage,
  type SinrLiveCellHandoverEventIndexWorkerResponse,
} from './sinrLiveCellHandoverEventIndexWorkerProtocol';
import {
  SinrLiveCellHandoverEventIndexWorkerError,
  SinrLiveCellHandoverEventIndexWorkerTransport,
  type SinrLiveCellHandoverEventIndexWorkerPort,
} from './sinrLiveCellHandoverEventIndexWorkerTransport';

class FakeRuntimePort implements SinrLiveCellHandoverEventIndexWorkerRuntimePort {
  readonly posted: SinrLiveCellHandoverEventIndexWorkerResponse[] = [];

  postMessage(message: SinrLiveCellHandoverEventIndexWorkerResponse): void {
    this.posted.push(message);
  }

  addEventListener(): void {}

  removeEventListener(): void {}
}

class FakeWorkerPort implements SinrLiveCellHandoverEventIndexWorkerPort {
  readonly posted: SinrLiveCellHandoverEventIndexWorkerMessage[] = [];
  throwOnCancel = false;
  private listener: ((event: { readonly data: unknown }) => void) | null = null;

  postMessage(message: SinrLiveCellHandoverEventIndexWorkerMessage): void {
    if (this.throwOnCancel && message.type === 'cancel') {
      throw new Error('worker is already closing');
    }
    this.posted.push(message);
  }

  addEventListener(_type: 'message', listener: (event: { readonly data: unknown }) => void): void {
    this.listener = listener;
  }

  removeEventListener(_type: 'message', listener: (event: { readonly data: unknown }) => void): void {
    if (this.listener === listener) this.listener = null;
  }

  emit(message: unknown): void {
    this.listener?.({ data: message });
  }
}

function fakeIndex(tag: string) {
  return {
    sourceOwner: 'sinr-live-cell-truth' as const,
    horizonKind: 'live-walker-window' as const,
    claimKind: 'live-truth' as const,
    durationSec: 7200 as const,
    ueScope: 'cell-truth-ue-events' as const,
    primaryUeId: 'live-ue-0',
    aggregateUeCount: 1,
    aggregateClaim: 'cell-truth-event-index' as const,
    generation: {
      profileId: tag,
      epochUtcMs: 0,
      simStepSec: 1,
      handoverPolicyKey: tag,
      topologyKey: tag,
      runtimeFramePath: 'stepRuntimeFrame+sinrLiveCells' as const,
    },
    offsetDb: 2,
    sourceGapReasons: [],
    events: [],
  };
}

function fakePreview(tag: string): SinrLiveCellHandoverEventIndexPreview {
  return {
    sourceOwner: 'sinr-live-cell-truth',
    horizonKind: 'live-walker-window-prefix',
    claimKind: 'live-truth',
    readiness: 'preview',
    complete: false,
    sourceWindow: { startSec: 0, endSec: 60 },
    coveredThroughSec: 60,
    sourceDurationSec: 7200,
    ueScope: 'cell-truth-ue-events',
    primaryUeId: 'live-ue-0',
    aggregateUeCount: 1,
    aggregateClaim: 'cell-truth-event-index-prefix',
    generation: {
      profileId: tag,
      epochUtcMs: 0,
      simStepSec: 1,
      handoverPolicyKey: tag,
      topologyKey: tag,
      runtimeFramePath: 'stepRuntimeFrame+sinrLiveCells',
    },
    offsetDb: 2,
    sourceGapReasons: [],
    events: [],
  };
}

function fakeBuilder(tag: string): SinrLiveCellHandoverEventIndexBuilder {
  let completed = 0;
  return {
    totalSteps: 2,
    stepsCompleted: () => completed,
    isDone: () => completed >= 2,
    runSlice: (maxSteps: number) => {
      completed = Math.min(2, completed + Math.max(1, Math.trunc(maxSteps)));
      return completed >= 2;
    },
    preview: () => completed >= 1 ? fakePreview(tag) : null,
    finalize: () => fakeIndex(tag),
  };
}

const fakeInput = {} as BuildSinrLiveCellHandoverEventIndexInput;

test('worker runtime suppresses stale completion and supports cancellation', () => {
  const queue: Array<() => void> = [];
  const port = new FakeRuntimePort();
  const runtime = createSinrLiveCellHandoverEventIndexWorkerRuntime(port, {
    schedule: callback => queue.push(callback),
    createBuilder: input => fakeBuilder(input === fakeInput ? 'fake' : 'other'),
  });
  const build = (requestId: string, input = fakeInput): SinrLiveCellHandoverEventIndexWorkerMessage => ({
    protocol: SINR_LIVE_CELL_HANDOVER_EVENT_INDEX_WORKER_PROTOCOL,
    type: 'build',
    requestId,
    input,
  });

  runtime.handle(build('stale-1'));
  runtime.handle(build('fresh-2', {} as BuildSinrLiveCellHandoverEventIndexInput));
  while (queue.length > 0) queue.shift()!();

  assert.deepEqual(
    port.posted.filter(message => message.type === 'accepted').map(message => message.requestId),
    ['fresh-2'],
  );
  assert.equal(
    port.posted.some(message => message.type === 'accepted' && message.requestId === 'stale-1'),
    false,
  );
  assert.equal(
    port.posted.some(message => message.type === 'error' && message.requestId === 'stale-1' && message.code === 'CANCELLED'),
    true,
  );
  assert.deepEqual(
    port.posted.filter(message => message.type === 'preview').map(message => message.requestId),
    ['fresh-2'],
  );

  const cancelPort = new FakeRuntimePort();
  const cancelQueue: Array<() => void> = [];
  const cancelRuntime = createSinrLiveCellHandoverEventIndexWorkerRuntime(cancelPort, {
    schedule: callback => cancelQueue.push(callback),
    createBuilder: () => fakeBuilder('cancelled'),
  });
  cancelRuntime.handle(build('cancel-3'));
  cancelRuntime.handle({
    protocol: SINR_LIVE_CELL_HANDOVER_EVENT_INDEX_WORKER_PROTOCOL,
    type: 'cancel',
    requestId: 'cancel-3',
    reason: 'test cancellation',
  });
  while (cancelQueue.length > 0) cancelQueue.shift()!();
  assert.deepEqual(
    cancelPort.posted.filter(message => message.type === 'accepted'),
    [],
  );
  assert.equal(
    cancelPort.posted.some(message => message.type === 'error' && message.code === 'CANCELLED'),
    true,
  );
  assert.deepEqual(
    cancelPort.posted.filter(message => message.type === 'preview'),
    [],
  );
  runtime.dispose();
  cancelRuntime.dispose();
});

test('transport resolves accepted indexes, forwards progress, and ignores stale responses', async () => {
  const port = new FakeWorkerPort();
  const transport = new SinrLiveCellHandoverEventIndexWorkerTransport(port);
  const progress: number[] = [];
  const previews: string[] = [];
  const result = transport.build(fakeInput, {
    onProgress: message => progress.push(message.progress.completedSteps),
    onPreview: message => previews.push(`${message.preview.readiness}:${message.preview.coveredThroughSec}`),
  });
  const request = port.posted[0];
  assert.equal(request?.type, 'build');
  assert.ok(request?.requestId);
  port.emit({
    protocol: SINR_LIVE_CELL_HANDOVER_EVENT_INDEX_WORKER_PROTOCOL,
    type: 'progress',
    requestId: request!.requestId,
    progress: { status: 'running', completedSteps: 1, totalSteps: 2, fraction: 0.5 },
  });
  port.emit({
    protocol: SINR_LIVE_CELL_HANDOVER_EVENT_INDEX_WORKER_PROTOCOL,
    type: 'preview',
    requestId: request!.requestId,
    preview: fakePreview('transport'),
  });
  port.emit({
    protocol: SINR_LIVE_CELL_HANDOVER_EVENT_INDEX_WORKER_PROTOCOL,
    type: 'accepted',
    requestId: request!.requestId,
    index: fakeIndex('transport'),
  });
  assert.equal((await result).generation.profileId, 'transport');
  assert.deepEqual(progress, [1]);
  assert.deepEqual(previews, ['preview:60']);

  const abort = new AbortController();
  const stale = transport.build(fakeInput, { signal: abort.signal });
  const staleRequest = port.posted[port.posted.length - 1];
  abort.abort();
  await assert.rejects(
    stale,
    error => error instanceof SinrLiveCellHandoverEventIndexWorkerError && error.code === 'CANCELLED',
  );
  port.emit({
    protocol: SINR_LIVE_CELL_HANDOVER_EVENT_INDEX_WORKER_PROTOCOL,
    type: 'accepted',
    requestId: staleRequest!.requestId,
    index: fakeIndex('stale'),
  });
  port.emit({
    protocol: SINR_LIVE_CELL_HANDOVER_EVENT_INDEX_WORKER_PROTOCOL,
    type: 'preview',
    requestId: staleRequest!.requestId,
    preview: fakePreview('stale'),
  });
  assert.deepEqual(previews, ['preview:60']);
  transport.dispose();
});

test('transport settles cancellation when the Worker cannot receive cancel', async () => {
  const port = new FakeWorkerPort();
  const transport = new SinrLiveCellHandoverEventIndexWorkerTransport(port);
  const controller = new AbortController();
  const aborted = transport.build(fakeInput, { signal: controller.signal });
  port.throwOnCancel = true;
  controller.abort();
  await assert.rejects(
    aborted,
    error => error instanceof SinrLiveCellHandoverEventIndexWorkerError && error.code === 'CANCELLED',
  );

  const explicit = transport.build(fakeInput);
  const request = port.posted[port.posted.length - 1];
  assert.ok(request?.type === 'build');
  assert.doesNotThrow(() => transport.cancel(request.requestId, 'test cancellation'));
  await assert.rejects(
    explicit,
    error => error instanceof SinrLiveCellHandoverEventIndexWorkerError && error.code === 'CANCELLED',
  );

  const disposedPort = new FakeWorkerPort();
  const disposedTransport = new SinrLiveCellHandoverEventIndexWorkerTransport(disposedPort);
  const disposed = disposedTransport.build(fakeInput);
  disposedPort.throwOnCancel = true;
  assert.doesNotThrow(() => disposedTransport.dispose());
  await assert.rejects(
    disposed,
    error => error instanceof SinrLiveCellHandoverEventIndexWorkerError && error.code === 'CANCELLED',
  );
  transport.dispose();
});

test('worker runtime reports a scheduler failure instead of stranding the request', () => {
  const port = new FakeRuntimePort();
  const runtime = createSinrLiveCellHandoverEventIndexWorkerRuntime(port, {
    schedule: () => {
      throw new Error('scheduler unavailable');
    },
    createBuilder: () => fakeBuilder('scheduler-failure'),
  });
  runtime.handle({
    protocol: SINR_LIVE_CELL_HANDOVER_EVENT_INDEX_WORKER_PROTOCOL,
    type: 'build',
    requestId: 'scheduler-failure-1',
    input: fakeInput,
  });
  assert.equal(
    port.posted.some(message => message.type === 'error'
      && message.requestId === 'scheduler-failure-1'
      && message.code === 'BUILD_FAILED'
      && message.message === 'scheduler unavailable'),
    true,
  );
  runtime.dispose();
});

test('builder preview is a non-complete 0-60 prefix with the full config identity', () => {
  const input: BuildSinrLiveCellHandoverEventIndexInput = {
    profile: loadProfile('modqn-1sat-7beam'),
    epochUtcMs: Date.parse('2026-08-16T00:00:00.000Z'),
    simStepSec: 60,
    ueCount: 1,
    beamPointingMode: 'sampled-steering',
    multiCandidateDecisionEnabled: true,
  };
  const builder = createSinrLiveCellHandoverEventIndexBuilder(input);
  assert.equal(builder.preview(), null);
  assert.equal(builder.runSlice(1), false);
  const preview = builder.preview();
  assert.ok(preview);
  assert.equal(preview.complete, false);
  assert.equal(preview.readiness, 'preview');
  assert.equal(preview.horizonKind, 'live-walker-window-prefix');
  assert.deepEqual(preview.sourceWindow, { startSec: 0, endSec: 60 });
  assert.equal(preview.sourceDurationSec, 7200);
  assert.equal(preview.aggregateClaim, 'cell-truth-event-index-prefix');
  assert.ok(preview.events.every(event => event.sourceTimeSec <= 60));
  assert.ok(preview.events.every(event => event.clickTargetSec === event.sourceTimeSec));

  while (!builder.runSlice(16)) {}
  const complete = builder.finalize();
  assert.equal(complete.durationSec, 7200);
  assert.equal(complete.horizonKind, 'live-walker-window');
  assert.deepEqual(preview.generation, complete.generation);
  assert.deepEqual(
    preview.events,
    complete.events.filter(event => event.sourceTimeSec <= 60),
  );
  assert.deepEqual(complete, buildSinrLiveCellHandoverEventIndex(input));

  const changedConfigBuilder = createSinrLiveCellHandoverEventIndexBuilder({
    ...input,
    beamPointingMode: 'earth-fixed-cell',
  });
  changedConfigBuilder.runSlice(1);
  const changedConfigPreview = changedConfigBuilder.preview();
  assert.ok(changedConfigPreview);
  assert.notEqual(
    changedConfigPreview.generation.topologyKey,
    preview.generation.topologyKey,
  );

  const nonBoundaryBuilder = createSinrLiveCellHandoverEventIndexBuilder({
    ...input,
    simStepSec: 45,
  });
  nonBoundaryBuilder.runSlice(2);
  assert.equal(
    nonBoundaryBuilder.preview(),
    null,
    'a cadence without a completed 60-second boundary must not claim a preview',
  );
});

test('worker-drained builder is equivalent to the one-shot event-index builder', () => {
  const input: BuildSinrLiveCellHandoverEventIndexInput = {
    profile: loadProfile('modqn-1sat-7beam'),
    epochUtcMs: Date.parse('2026-08-16T00:00:00.000Z'),
    simStepSec: 7200,
    ueCount: 1,
  };
  const oneShot = buildSinrLiveCellHandoverEventIndex(input);
  const builder = createSinrLiveCellHandoverEventIndexBuilder(input);
  while (!builder.runSlice(1)) {}
  assert.deepEqual(builder.finalize(), oneShot);

  const port = new FakeRuntimePort();
  const runtime = createSinrLiveCellHandoverEventIndexWorkerRuntime(port, {
    sliceSize: 1,
    schedule: callback => callback(),
  });
  runtime.handle({
    protocol: SINR_LIVE_CELL_HANDOVER_EVENT_INDEX_WORKER_PROTOCOL,
    type: 'build',
    requestId: 'real-1',
    input,
  });
  const accepted = port.posted.find(message => message.type === 'accepted');
  assert.ok(accepted && accepted.type === 'accepted');
  assert.deepEqual(accepted.index, oneShot);
  runtime.dispose();
});
