import assert from 'node:assert/strict';

import {
  C120_MAX_ORBIT_SAMPLES,
  C120_MIN_ORBIT_SAMPLE_STEP_SEC,
  C120_SGP4_MODEL_VERSION,
  deriveC120OrbitPass,
} from './orbitPropagation';
import {
  C120RealDataError,
  fetchC120CelestrakOrbitSource,
  type C120OrbitFetchResponse,
} from './orbitSource';

// Pinned offline OMM bytes keep this test deterministic and network-free.
const BODY = '[{"OBJECT_NAME":"ONEWEB-0314","OBJECT_ID":"2021-075AB","EPOCH":"2026-08-09T09:20:51.128160","MEAN_MOTION":13.17651252,"ECCENTRICITY":0.0001589,"INCLINATION":87.9189,"RA_OF_ASC_NODE":355.279,"ARG_OF_PERICENTER":86.873,"MEAN_ANOMALY":273.2584,"EPHEMERIS_TYPE":0,"CLASSIFICATION_TYPE":"U","NORAD_CAT_ID":49100,"ELEMENT_SET_NO":999,"REV_AT_EPOCH":24057,"BSTAR":9.4634e-5,"MEAN_MOTION_DOT":5.0e-7,"MEAN_MOTION_DDOT":0}]\r\n';
const EXPECTED_SOURCE_SHA = '900127441642d85dcc81fd423e0cdb0db90e108157096f086662435311bd9c70';
const request = {
  observer: { latitudeDeg: 24.944, longitudeDeg: 121.371, heightKm: 0.05 },
  startUtc: '2026-08-09T18:20:00Z',
  endUtc: '2026-08-09T18:50:00Z',
  sampleStepSec: 60,
  minimumElevationDeg: 10,
  expectedSourceSha256: EXPECTED_SOURCE_SHA,
  expectedCatalogId: 49100,
  expectedObjectName: 'ONEWEB-0314',
} as const;

const source = await fetchC120CelestrakOrbitSource(
  { retrievedAt: '2026-08-09T10:00:00Z', now: '2026-08-09T10:00:00Z' },
  async (): Promise<C120OrbitFetchResponse> => ({ status: 200, body: BODY }),
);

function expectCode(action: () => unknown, code: C120RealDataError['code']): void {
  assert.throws(action, error => error instanceof C120RealDataError && error.code === code);
}

function assertDeepFrozen(value: unknown, label: string): void {
  if (typeof value !== 'object' || value === null) return;
  assert.equal(Object.isFrozen(value), true, `${label} is frozen`);
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertDeepFrozen(item, `${label}[${index}]`));
  } else {
    Object.entries(value).forEach(([key, child]) => assertDeepFrozen(child, `${label}.${key}`));
  }
}

const first = deriveC120OrbitPass(source, request);
const second = deriveC120OrbitPass(source, request);
const trajectory = first.pass.trajectory;
const utcMs = trajectory.map(point => Date.parse(point.utc));

assert.equal(first.kind, 'MODEL_DERIVED_ORBIT');
assert.equal(first.model, C120_SGP4_MODEL_VERSION);
assert.equal(first.measured, false);
assert.deepEqual(first, second, 'same source/request produces the same content');
assert.ok(trajectory.length >= 3, 'trace contains boundaries and at least one sampled point');
assert.equal(trajectory[0], first.pass.aos, 'AOS is the first trajectory object');
assert.equal(trajectory[trajectory.length - 1], first.pass.los, 'LOS is the final trajectory object');
assert.ok(trajectory.some(point => point === first.pass.peak), 'declared sampled peak is in the trace');
assert.equal(new Set(trajectory.map(point => point.utc)).size, trajectory.length, 'UTCs are unique');
for (let index = 1; index < utcMs.length; index += 1) {
  assert.ok(utcMs[index] > utcMs[index - 1], 'trajectory UTCs are strictly increasing');
}
for (const point of trajectory) {
  assert.equal(Number.isFinite(point.azimuthDeg), true);
  assert.equal(Number.isFinite(point.elevationDeg), true);
  assert.equal(Number.isFinite(point.rangeKm), true);
  assert.ok(point.rangeKm > 0);
}
assert.ok(trajectory.length <= first.search.sampleCount);
assert.ok(trajectory.length <= C120_MAX_ORBIT_SAMPLES);
assertDeepFrozen(first, 'receipt');

expectCode(
  () => deriveC120OrbitPass(source, null as unknown as typeof request),
  'ORBIT_REQUEST_INVALID',
);

const clipped = deriveC120OrbitPass(source, {
  ...request,
  startUtc: '2026-08-09T18:34:00Z',
  endUtc: '2026-08-09T18:36:00Z',
});
assert.equal(clipped.pass.clippedAtWindowStart, true);
assert.equal(clipped.pass.clippedAtWindowEnd, true);
assert.equal(clipped.pass.trajectory[0].utc, '2026-08-09T18:34:00.000Z');
assert.equal(clipped.pass.trajectory[clipped.pass.trajectory.length - 1]?.utc, '2026-08-09T18:36:00.000Z');
assert.equal(clipped.pass.aos.utc, clipped.pass.trajectory[0].utc);
assert.equal(clipped.pass.los.utc, clipped.pass.trajectory[clipped.pass.trajectory.length - 1]?.utc);

expectCode(
  () => deriveC120OrbitPass(source, { ...request, sampleStepSec: C120_MIN_ORBIT_SAMPLE_STEP_SEC / 2 }),
  'ORBIT_REQUEST_INVALID',
);
expectCode(
  () => deriveC120OrbitPass(source, { ...request, sampleStepSec: Number.POSITIVE_INFINITY }),
  'ORBIT_REQUEST_INVALID',
);
expectCode(
  () => deriveC120OrbitPass(source, { ...request, startUtc: '2026-08-09T18:20:00+08:00' }),
  'ORBIT_REQUEST_INVALID',
);
expectCode(
  () => deriveC120OrbitPass(source, { ...request, expectedSourceSha256: '0'.repeat(64) }),
  'ORBIT_IDENTITY_MISMATCH',
);
expectCode(
  () => deriveC120OrbitPass(source, {
    ...request,
    startUtc: '2026-08-09T10:00:00Z',
    endUtc: '2026-08-09T10:10:00Z',
  }),
  'ORBIT_NO_PASS',
);
expectCode(
  () => deriveC120OrbitPass(source, {
    ...request,
    startUtc: '2026-08-09T18:20:00Z',
    endUtc: '2026-08-09T18:21:41Z',
    sampleStepSec: C120_MIN_ORBIT_SAMPLE_STEP_SEC,
  }),
  'ORBIT_REQUEST_INVALID',
);

console.log('C-120 orbit propagation trajectory tests passed');
