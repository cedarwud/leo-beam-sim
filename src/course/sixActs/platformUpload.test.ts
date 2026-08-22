#!/usr/bin/env node
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SIX_ACTS_PLATFORM_HONESTY_NOTE,
  SIX_ACTS_PLATFORM_SERIES,
  SIX_ACTS_PLATFORM_SINR_MIN_DB,
  buildSixActsOneHzPayload,
  buildSixActsRunEndPayload,
  chunkSixActsPayload,
  mergeSixActsPayloads,
  serializeSixActsPayloadAsCsv,
  serializeSixActsPayloadAsJson,
  type SixActsPlatformSeriesId,
} from './platformPayload';
import {
  SIX_ACTS_OFFLINE_MOCK_BADGE,
  SixActsUploadError,
  SixActsUploadSession,
  buildSixActsReadBackUrls,
  readSixActsCredentialsFromEnv,
  type SixActsHttpRequest,
  type SixActsHttpResponse,
} from './platformUpload';
import { resampleSixActsRunToOneHz, summarizeSixActsRun, type SixActsRuntimeSample } from './runSummary';
import { declareSixActsCourseThreshold } from './taughtConstants';

const ALL_SERIES: readonly SixActsPlatformSeriesId[] = SIX_ACTS_PLATFORM_SERIES.map(spec => spec.id);

const CREDENTIALS = Object.freeze({
  email: 'group07@example.edu',
  password: 'not-a-real-password',
  macAddress: 'AA:BB:CC:DD:EE:07',
});

function sample(overrides: Partial<SixActsRuntimeSample> = {}): SixActsRuntimeSample {
  return {
    instantMs: 0,
    durationSec: 1,
    servingSatelliteId: '49194',
    servingSinrDb: -12.345,
    bestCandidateSatelliteId: '55159',
    bestCandidateSinrDb: -9,
    ratesMbps: [10],
    systemPowerW: 2,
    ...overrides,
  };
}

function recordingFetcher(responses: readonly SixActsHttpResponse[]): {
  fetcher: (request: SixActsHttpRequest) => Promise<SixActsHttpResponse>;
  requests: SixActsHttpRequest[];
} {
  const requests: SixActsHttpRequest[] = [];
  let index = 0;
  return {
    requests,
    fetcher: async request => {
      requests.push(request);
      const response = responses[Math.min(index, responses.length - 1)];
      index += 1;
      return response;
    },
  };
}

function session(overrides: Partial<ConstructorParameters<typeof SixActsUploadSession>[0]> = {}) {
  const { fetcher, requests } = recordingFetcher([
    { status: 200, body: { token: 'server-token' } },
    { status: 200, body: { ok: true } },
  ]);
  const instance = new SixActsUploadSession({
    mode: 'live',
    credentials: CREDENTIALS,
    fetcher,
    now: () => 1_700_000_000_000,
    random: () => 0.5,
    ...overrides,
  });
  return { instance, requests };
}

test('every modelled series is one of the five historical fields', () => {
  const types = new Set(SIX_ACTS_PLATFORM_SERIES.map(spec => spec.fieldType));
  assert.deepStrictEqual(
    [...types].sort(),
    ['CURRENT_SINR', 'HANDOVER_EVENT', 'LOW_SINR_RATIO'],
  );
  // The EE fields stay out until the platform owner registers them.
  const serialized = JSON.stringify(SIX_ACTS_PLATFORM_SERIES);
  assert.ok(!serialized.includes('TOTAL_ENERGY_J'));
  assert.ok(!serialized.includes('RUN_EE_MBIT_PER_J'));
});

test('the honesty note says a 200 is receipt only', () => {
  assert.match(SIX_ACTS_PLATFORM_HONESTY_NOTE, /200/);
  assert.match(SIX_ACTS_PLATFORM_HONESTY_NOTE, /回讀/);
});

test('the 1 Hz payload uses the documented channel map', () => {
  const oneHz = resampleSixActsRunToOneHz([sample()]);
  const built = buildSixActsOneHzPayload(oneHz, ALL_SERIES);

  assert.deepStrictEqual(
    built.payload.data.map(datum => `${datum.type}:${datum.channel}`),
    ['CURRENT_SINR:0', 'CURRENT_SINR:1', 'CURRENT_SINR:2', 'HANDOVER_EVENT:0'],
  );
  // Two decimals, as the historical exporter sends.
  assert.strictEqual(built.payload.data[0].value, -12.34);
});

test('only ticked series reach the wire', () => {
  const oneHz = resampleSixActsRunToOneHz([sample()]);
  const built = buildSixActsOneHzPayload(oneHz, ['serving-sinr']);

  assert.strictEqual(built.payload.data.length, 1);
  assert.strictEqual(built.seriesCounts['candidate-sinr'], 0);
});

test('an unattached second is reported at the floor and counted, not dropped', () => {
  const oneHz = resampleSixActsRunToOneHz([
    sample({ instantMs: 0 }),
    sample({
      instantMs: 1000,
      servingSatelliteId: null,
      servingSinrDb: null,
      bestCandidateSinrDb: null,
      ratesMbps: [0],
    }),
  ]);
  const built = buildSixActsOneHzPayload(oneHz, ['serving-sinr']);

  assert.strictEqual(built.payload.data.length, 2);
  assert.strictEqual(built.payload.data[1].value, SIX_ACTS_PLATFORM_SINR_MIN_DB);
  assert.strictEqual(built.unattachedSecondCount, 1);
});

test('out-of-range SINR is clamped and the clamp is surfaced', () => {
  const oneHz = resampleSixActsRunToOneHz([sample({ servingSinrDb: 120 })]);
  const built = buildSixActsOneHzPayload(oneHz, ['serving-sinr']);

  assert.strictEqual(built.payload.data[0].value, 60);
  assert.strictEqual(built.clampedValueCount, 1);
});

test('LOW_SINR_RATIO is a single run-end integer percent', () => {
  const summary = summarizeSixActsRun({
    runId: 'r',
    strategyId: 'baseline',
    scenarioId: 's',
    lowSinrThreshold: declareSixActsCourseThreshold(-10, '測試用門檻'),
    samples: [sample({ instantMs: 0 }), sample({ instantMs: 1000, servingSinrDb: -5 })],
  });
  const built = buildSixActsRunEndPayload(summary, ALL_SERIES);

  assert.strictEqual(built.payload.data.length, 1);
  assert.strictEqual(built.payload.data[0].type, 'LOW_SINR_RATIO');
  assert.strictEqual(built.payload.data[0].value, 50);
  assert.ok(Number.isInteger(built.payload.data[0].value));
});

test('merged payloads keep every sample and every count', () => {
  const oneHz = resampleSixActsRunToOneHz([sample()]);
  const merged = mergeSixActsPayloads(
    buildSixActsOneHzPayload(oneHz, ['serving-sinr']),
    buildSixActsOneHzPayload(oneHz, ['handover-event']),
  );

  assert.strictEqual(merged.payload.data.length, 2);
  assert.strictEqual(merged.seriesCounts['serving-sinr'], 1);
  assert.strictEqual(merged.seriesCounts['handover-event'], 1);
});

test('chunking preserves order and loses nothing', () => {
  const payload = {
    data: Array.from({ length: 7 }, (_unused, index) => ({
      type: 'HANDOVER_EVENT' as const,
      channel: 0,
      value: index,
      timestamp: index * 1000,
    })),
  };
  const batches = chunkSixActsPayload(payload, 3);

  assert.deepStrictEqual(batches.map(batch => batch.data.length), [3, 3, 1]);
  assert.deepStrictEqual(batches.flatMap(batch => batch.data.map(d => d.value)), [0, 1, 2, 3, 4, 5, 6]);
});

test('the CSV export carries exactly the wire rows', () => {
  const oneHz = resampleSixActsRunToOneHz([sample()]);
  const built = buildSixActsOneHzPayload(oneHz, ['serving-sinr']);
  const csv = serializeSixActsPayloadAsCsv(built.payload);

  const lines = csv.trim().split('\n');
  assert.strictEqual(lines[0], 'type,channel,value,timestamp,iso_utc');
  assert.strictEqual(lines.length, 2);
  assert.match(lines[1], /^CURRENT_SINR,0,-12.34,0,1970-01-01T00:00:00.000Z$/);
  assert.ok(serializeSixActsPayloadAsJson(built.payload).endsWith('\n'));
});

test('missing credentials name the variable, never a value', () => {
  assert.throws(
    () => readSixActsCredentialsFromEnv({ SMARTFARM_EMAIL: 'a@b.c', SMARTFARM_PASSWORD: 'secret' }),
    error => {
      assert.ok(error instanceof SixActsUploadError);
      assert.strictEqual(error.code, 'MISSING_CREDENTIALS');
      assert.match(error.message, /SMARTFARM_MAC/);
      assert.ok(!error.message.includes('secret'));
      return true;
    },
  );
});

test('the token is fetched once and reused across batches', async () => {
  const { instance, requests } = session();
  const payload = { data: [{ type: 'HANDOVER_EVENT' as const, channel: 0, value: 1, timestamp: 0 }] };

  await instance.uploadBatch(payload);
  await instance.uploadBatch(payload);

  assert.strictEqual(requests.filter(request => request.url.endsWith('/account/login')).length, 1);
  assert.strictEqual(requests.filter(request => request.url.includes('/iot_data/')).length, 2);
  assert.strictEqual(requests[1].headers.Authorization, 'Bearer server-token');
});

test('the ledger never carries a credential or a token', async () => {
  const { instance } = session();
  await instance.uploadBatch({
    data: [{ type: 'HANDOVER_EVENT' as const, channel: 0, value: 1, timestamp: 0 }],
  });

  const serialized = JSON.stringify(instance.ledger);
  assert.ok(!serialized.includes(CREDENTIALS.password));
  assert.ok(!serialized.includes(CREDENTIALS.email));
  assert.ok(!serialized.includes('server-token'));
  assert.ok(serialized.includes('已接收'));
});

test('a failed batch is buffered and resent with the next one', async () => {
  const { fetcher, requests } = recordingFetcher([
    { status: 200, body: { token: 'server-token' } },
    { status: 503, body: 'unavailable' },
    { status: 200, body: { ok: true } },
  ]);
  const instance = new SixActsUploadSession({
    mode: 'live',
    credentials: CREDENTIALS,
    fetcher,
    now: () => 0,
    random: () => 0,
  });

  const first = await instance.uploadBatch({
    data: [{ type: 'HANDOVER_EVENT' as const, channel: 0, value: 1, timestamp: 0 }],
  });
  assert.strictEqual(first.outcome, 'buffered');
  assert.strictEqual(instance.bufferedSampleCount, 1);

  const second = await instance.uploadBatch({
    data: [{ type: 'HANDOVER_EVENT' as const, channel: 0, value: 0, timestamp: 1000 }],
  });
  assert.strictEqual(second.outcome, 'ok');
  assert.strictEqual(second.sampleCount, 2);
  assert.strictEqual(instance.bufferedSampleCount, 0);

  const uploads = requests.filter(request => request.url.includes('/iot_data/'));
  assert.strictEqual(JSON.parse(uploads[1].body as string).data.length, 2);
});

test('a login failure is a typed error, not a silent no-op', async () => {
  const { fetcher } = recordingFetcher([{ status: 401, body: 'nope' }]);
  const instance = new SixActsUploadSession({
    mode: 'live',
    credentials: CREDENTIALS,
    fetcher,
    now: () => 0,
    random: () => 0,
  });

  await assert.rejects(
    instance.uploadBatch({ data: [{ type: 'HANDOVER_EVENT', channel: 0, value: 1, timestamp: 0 }] }),
    error => {
      assert.ok(error instanceof SixActsUploadError);
      assert.strictEqual(error.code, 'LOGIN_FAILED');
      return true;
    },
  );
  assert.strictEqual(instance.ledger[0].outcome, 'failed');
});

test('offline mock walks the whole flow without touching the network', async () => {
  const { fetcher, requests } = recordingFetcher([{ status: 500, body: 'must not be called' }]);
  const instance = new SixActsUploadSession({
    mode: 'offline-mock',
    credentials: CREDENTIALS,
    fetcher,
    now: () => 42,
    random: () => 0,
  });

  const result = await instance.uploadBatch({
    data: [{ type: 'HANDOVER_EVENT' as const, channel: 0, value: 1, timestamp: 0 }],
  });

  assert.strictEqual(requests.length, 0);
  assert.strictEqual(result.outcome, 'ok');
  assert.deepStrictEqual(instance.ledger.map(entry => entry.kind), ['login', 'upload']);
  for (const entry of instance.ledger) {
    assert.strictEqual(entry.mode, 'offline-mock');
    assert.ok(entry.detail.includes(SIX_ACTS_OFFLINE_MOCK_BADGE));
  }
});

test('dispatch times carry one per-session jitter, not a per-batch redraw', () => {
  let draws = 0;
  const { fetcher } = recordingFetcher([{ status: 200, body: { token: 't' } }]);
  const instance = new SixActsUploadSession({
    mode: 'live',
    credentials: CREDENTIALS,
    fetcher,
    now: () => 0,
    random: () => {
      draws += 1;
      return 0.25;
    },
  });

  const times = instance.planDispatchTimes(1_000_000, 3);

  assert.strictEqual(draws, 1);
  assert.strictEqual(instance.jitterSec, 2.5);
  assert.deepStrictEqual(times, [1_002_500, 1_032_500, 1_062_500]);
});

test('an unsupported batch interval is rejected', () => {
  const { fetcher } = recordingFetcher([{ status: 200, body: { token: 't' } }]);
  assert.throws(
    () => new SixActsUploadSession({
      mode: 'live',
      credentials: CREDENTIALS,
      fetcher,
      now: () => 0,
      random: () => 0,
      batchIntervalSec: 7,
    }),
    error => {
      assert.ok(error instanceof SixActsUploadError);
      assert.strictEqual(error.code, 'INVALID_BATCH_INTERVAL');
      return true;
    },
  );
});

test('the read-back chain is the documented four-step GET sequence', () => {
  const urls = buildSixActsReadBackUrls({
    account: 'ntpu-class',
    areaId: 'area-1',
    groupId: 'group-2',
    sensorType: 'CURRENT_SINR',
    sensorId: 'sensor-3',
    fromMs: 1000,
    toMs: 2000,
  });

  assert.deepStrictEqual(urls, [
    'https://edu.nthu-smart-farming.kits.tw/api/api/area/ntpu-class',
    'https://edu.nthu-smart-farming.kits.tw/api/api/sensorgroup_in_area/area-1',
    'https://edu.nthu-smart-farming.kits.tw/api/api/sensors_in_group/group-2',
    'https://edu.nthu-smart-farming.kits.tw/api/api/sensors_in_timeinterval/CURRENT_SINR/sensor-3/1000/2000',
  ]);
});
