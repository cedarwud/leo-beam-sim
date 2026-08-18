import assert from 'node:assert/strict';
import { buildVisualLabCaptureBundle } from './captureBundle';
import { createPhase1UploadAdapter, type Phase1UploadResponse } from './phase1Upload';
import { createTestSnapshot, TEST_PROFILE } from './testFixtures';

const bundle = buildVisualLabCaptureBundle(createTestSnapshot(), {
  figureProfile: TEST_PROFILE,
  caption: 'Upload caption',
  altText: 'Upload alt',
  longDescription: 'Upload long description',
});

let calls = 0;
const unavailable = await createPhase1UploadAdapter().upload(bundle);
assert.equal(unavailable.status, 'unavailable');
assert.equal(unavailable.receipt, null);

const missingFetcher = await createPhase1UploadAdapter({
  schemaId: 'registered.visual-lab.v1',
  endpoint: 'https://platform.example/upload',
}).upload(bundle);
assert.equal(missingFetcher.status, 'unavailable');

const refused = await createPhase1UploadAdapter({
  schemaId: 'registered.visual-lab.v1',
  endpoint: 'https://platform.example/upload',
  fetcher: async (_endpoint, init): Promise<Phase1UploadResponse> => {
    calls += 1;
    assert.equal(init.method, 'POST');
    assert.match(init.body, /registered\.visual-lab\.v1/);
    assert.match(init.body, /figure-data\.json/);
    return { ok: false, status: 403, json: async () => ({ message: 'refused' }) };
  },
}).upload(bundle);
assert.equal(refused.status, 'rejected');
assert.equal(refused.receipt, null);

const networkFailure = await createPhase1UploadAdapter({
  schemaId: 'registered.visual-lab.v1',
  endpoint: 'https://platform.example/upload',
  fetcher: async (): Promise<Phase1UploadResponse> => {
    throw new Error('offline');
  },
}).upload(bundle);
assert.equal(networkFailure.status, 'rejected');
assert.equal(networkFailure.receipt, null);

const noReceipt = await createPhase1UploadAdapter({
  schemaId: 'registered.visual-lab.v1',
  endpoint: 'https://platform.example/upload',
  fetcher: async (): Promise<Phase1UploadResponse> => ({ ok: true, status: 200, json: async () => ({ accepted: true }) }),
}).upload(bundle);
assert.equal(noReceipt.status, 'rejected');
assert.equal(noReceipt.receipt, null);

const success = await createPhase1UploadAdapter({
  registration: {
    schemaId: 'registered.visual-lab.v1',
    endpoint: 'https://platform.example/upload',
    fetcher: async (): Promise<Phase1UploadResponse> => ({
      ok: true,
      status: 201,
      json: async () => ({ receipt: { receiptId: 'receipt-1', bundleSha256: 'provided-by-platform' } }),
    }),
  },
}).upload(bundle);
assert.equal(success.status, 'uploaded');
assert.deepEqual(success.receipt, { receiptId: 'receipt-1', bundleSha256: 'provided-by-platform' });
assert.equal(calls, 1, 'only the registered refusing platform call reached the fetcher');

console.log('visual-lab phase-1 upload tests passed');

