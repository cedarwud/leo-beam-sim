import assert from 'node:assert/strict';

import {
  C120RealDataError,
  fetchC120CelestrakOrbitSource,
  type C120OrbitFetchResponse,
} from './orbitSource';
import {
  CELESTRAK_ONEWEB_TLE_URL,
  C120_TLE_OMM_EPOCH_TOLERANCE_MS,
  fetchC120CurrentTle,
  validateC120TleChecksum,
} from './currentTleSource';

const NOW = '2026-08-09T10:00:00Z';
const OMM_BODY = '[{"OBJECT_NAME":"ONEWEB-0314","OBJECT_ID":"2021-075AB","EPOCH":"2026-08-09T09:20:51.128160","MEAN_MOTION":13.17651252,"ECCENTRICITY":0.0001589,"INCLINATION":87.9189,"RA_OF_ASC_NODE":355.279,"ARG_OF_PERICENTER":86.873,"MEAN_ANOMALY":273.2584,"EPHEMERIS_TYPE":0,"CLASSIFICATION_TYPE":"U","NORAD_CAT_ID":49100,"ELEMENT_SET_NO":999,"REV_AT_EPOCH":24057,"BSTAR":9.4634e-5,"MEAN_MOTION_DOT":5.0e-7,"MEAN_MOTION_DDOT":0}]\r\n';

function withChecksum(prefix: string): string {
  assert.equal(prefix.length, 68, `TLE prefix must have 68 columns: ${prefix.length}`);
  let sum = 0;
  for (const character of prefix) {
    if (character >= '0' && character <= '9') sum += character.charCodeAt(0) - 48;
    else if (character === '-') sum += 1;
  }
  return `${prefix}${sum % 10}`;
}

const LINE0 = 'ONEWEB-0314';
const LINE1 = withChecksum('1 49100U 21075AB  26221.38948065  .00000050  00000-0  94634-3 0  999');
const LINE2 = withChecksum('2 49100  87.9167  11.2157 0001855  96.2926 263.8417 13.1764990123001');
const TLE_BODY = `${LINE0}\n${LINE1}\n${LINE2}\n`;

const orbitSource = await fetchC120CelestrakOrbitSource(
  { retrievedAt: NOW, now: NOW },
  async (): Promise<C120OrbitFetchResponse> => ({ status: 200, body: OMM_BODY }),
);

const request = { retrievedAt: NOW, now: NOW };
const fetchTle = async (url: string): Promise<C120OrbitFetchResponse> => {
  assert.equal(url, CELESTRAK_ONEWEB_TLE_URL);
  return { status: 200, body: TLE_BODY };
};

function expectCode(action: () => unknown | Promise<unknown>, code: string): Promise<void> | void {
  let result: unknown | Promise<unknown>;
  try {
    result = action();
  } catch (error) {
    assert.ok(error instanceof C120RealDataError && error.code === code, String(error));
    return;
  }
  if (result instanceof Promise) {
    return result.then(
      () => assert.fail(`expected ${code} failure`),
      error => assert.ok(error instanceof C120RealDataError && error.code === code, String(error)),
    );
  }
  assert.fail(`expected ${code} failure`);
}

const receipt = await fetchC120CurrentTle(orbitSource, request, fetchTle);
assert.equal(receipt.kind, 'PUBLIC_CURRENT_TLE_SOURCE');
assert.equal(receipt.format, 'TLE');
assert.equal(receipt.catalogId, 49100);
assert.equal(receipt.objectName, LINE0);
assert.equal(receipt.line0, LINE0);
assert.equal(receipt.line1, LINE1);
assert.equal(receipt.line2, LINE2);
assert.equal(receipt.epochField, '26221.38948065');
assert.equal(receipt.epochUtc, '2026-08-09T09:20:51.128Z');
assert.equal(receipt.rawContent, TLE_BODY);
assert.ok(receipt.rawContentSha256.match(/^[0-9a-f]{64}$/));
assert.equal(receipt.sourceProvenance.provider, 'CelesTrak');
assert.equal(receipt.sourceProvenance.endpoint, CELESTRAK_ONEWEB_TLE_URL);
assert.equal(receipt.sourceProvenance.rawContentSha256, receipt.rawContentSha256);
assert.equal(receipt.matchedOmm.rawContentSha256, orbitSource.rawContentSha256);
assert.ok(receipt.matchedOmm.epochDeltaMs <= C120_TLE_OMM_EPOCH_TOLERANCE_MS);
assert.equal(validateC120TleChecksum(LINE1), true);
assert.equal(validateC120TleChecksum(LINE2), true);

const paddedName = `${LINE0.padEnd(24, ' ')}\n${LINE1}\n${LINE2}\n`;
const paddedReceipt = await fetchC120CurrentTle(orbitSource, request, async () => ({ status: 200, body: paddedName }));
assert.equal(paddedReceipt.objectName, LINE0);
assert.equal(paddedReceipt.line0, LINE0);
assert.equal(paddedReceipt.rawContent, paddedName);

const badChecksum = `${LINE0}\n${LINE1.slice(0, -1)}${LINE1.endsWith('0') ? '1' : '0'}\n${LINE2}\n`;
await expectCode(
  () => fetchC120CurrentTle(orbitSource, request, async () => ({ status: 200, body: badChecksum })),
  'VALIDATION_FAILED',
);

const malformed = `${LINE0}\n${LINE1}\n${LINE2}\nEXTRA\n`;
await expectCode(
  () => fetchC120CurrentTle(orbitSource, request, async () => ({ status: 200, body: malformed })),
  'MALFORMED_SOURCE',
);
const malformedLine = `${LINE0}\n${LINE1.slice(0, 67)}\n${LINE2}\n`;
await expectCode(
  () => fetchC120CurrentTle(orbitSource, request, async () => ({ status: 200, body: malformedLine })),
  'MALFORMED_SOURCE',
);

const wrongObject = `${'ONEWEB-0315'}\n${LINE1}\n${LINE2}\n`;
await expectCode(
  () => fetchC120CurrentTle(orbitSource, request, async () => ({ status: 200, body: wrongObject })),
  'SOURCE_IDENTITY_MISMATCH',
);
const wrongCatalogLine1 = withChecksum(`${LINE1.slice(0, 2)}49101${LINE1.slice(7, -1)}`);
const wrongCatalog = `${LINE0}\n${wrongCatalogLine1}\n${LINE2}\n`;
await expectCode(
  () => fetchC120CurrentTle(orbitSource, request, async () => ({ status: 200, body: wrongCatalog })),
  'SOURCE_IDENTITY_MISMATCH',
);
await expectCode(
  () => fetchC120CurrentTle({ ...orbitSource, catalogId: 49101 }, request, fetchTle),
  'SOURCE_IDENTITY_MISMATCH',
);
await expectCode(
  () => fetchC120CurrentTle({ ...orbitSource, objectName: 'ONEWEB-0315' }, request, fetchTle),
  'SOURCE_IDENTITY_MISMATCH',
);

const invalidEpoch = withChecksum(`${LINE1.slice(0, 18)}26200.00000000${LINE1.slice(32, -1)}`);
await expectCode(
  () => fetchC120CurrentTle(orbitSource, request, async () => ({ status: 200, body: `${LINE0}\n${invalidEpoch}\n${LINE2}\n` })),
  'SOURCE_IDENTITY_MISMATCH',
);
const malformedEpoch = withChecksum(`${LINE1.slice(0, 18)}26221.3894806 ${LINE1.slice(32, -1)}`);
await expectCode(
  () => fetchC120CurrentTle(orbitSource, request, async () => ({ status: 200, body: `${LINE0}\n${malformedEpoch}\n${LINE2}\n` })),
  'TIMESTAMP_INVALID',
);
await expectCode(
  () => fetchC120CurrentTle({ ...orbitSource, sourceEpoch: '2026-08-09T09:20:00Z' }, request, fetchTle),
  'SOURCE_IDENTITY_MISMATCH',
);

await expectCode(
  () => fetchC120CurrentTle(orbitSource, request, async () => ({ status: 503, body: '' })),
  'HTTP_ERROR',
);
await expectCode(
  () => fetchC120CurrentTle(orbitSource, request, async () => ({ status: 99, body: '' })),
  'FETCH_FAILED',
);
await expectCode(
  () => fetchC120CurrentTle(orbitSource, { ...request, maxResponseBytes: 8 }, fetchTle),
  'RESPONSE_TOO_LARGE',
);
await expectCode(
  () => fetchC120CurrentTle(orbitSource, { ...request, maxResponseBytes: 17_000 }, fetchTle),
  'VALIDATION_FAILED',
);
await expectCode(
  () => fetchC120CurrentTle(orbitSource, { ...request, retrievedAt: '2026-08-09T10:00:00' }, fetchTle),
  'TIMESTAMP_INVALID',
);
await expectCode(
  () => fetchC120CurrentTle(orbitSource, { ...request, lastRetrievedAt: '2026-08-09T09:00:01Z' }, fetchTle),
  'SOURCE_REFRESH_TOO_SOON',
);
await expectCode(
  () => fetchC120CurrentTle(orbitSource, { ...request, minRefreshIntervalMs: 60 * 60 * 1000 }, fetchTle),
  'VALIDATION_FAILED',
);
await expectCode(
  () => fetchC120CurrentTle(orbitSource, { ...request, now: '2026-08-20T10:00:00Z' }, fetchTle),
  'SOURCE_STALE',
);

console.log('C-120 current-TLE source tests passed');
