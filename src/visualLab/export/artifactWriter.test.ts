import assert from 'node:assert/strict';
import { unzipSync } from 'fflate';
import { buildVisualLabCaptureBundle } from './captureBundle';
import { createLocalDownloadArtifactWriter, type BrowserDownloadPrimitives } from './artifactWriter';
import { createTestSnapshot, TEST_PROFILE } from './testFixtures';

const bundle = buildVisualLabCaptureBundle(createTestSnapshot(), {
  figureProfile: TEST_PROFILE,
  caption: 'Writer caption',
  altText: 'Writer alt',
  longDescription: 'Writer long description',
});

const calls: string[] = [];
let zippedBytes: Uint8Array | null = null;
const primitives: BrowserDownloadPrimitives = {
  createBlob: (parts, mediaType) => {
    calls.push(`blob:${mediaType}:${parts.length}`);
    const firstPart = parts[0];
    if (firstPart instanceof ArrayBuffer) zippedBytes = new Uint8Array(firstPart);
    if (ArrayBuffer.isView(firstPart)) zippedBytes = new Uint8Array(firstPart.buffer, firstPart.byteOffset, firstPart.byteLength);
    return { parts, mediaType } as unknown as Blob;
  },
  createObjectUrl: () => {
    calls.push('object-url');
    return 'blob:test';
  },
  revokeObjectUrl: url => calls.push(`revoke:${url}`),
  createDownloadAnchor: () => ({
    href: '',
    download: '',
    click: () => calls.push('click'),
  }),
  appendAnchor: anchor => calls.push(`append:${anchor.download}`),
  removeAnchor: anchor => calls.push(`remove:${anchor.download}`),
};

const result = await createLocalDownloadArtifactWriter({ primitives }).write(bundle);
assert.equal(result.status, 'written');
assert.equal(result.artifacts.length, bundle.artifacts.length);
assert.equal(calls.filter(value => value === 'click').length, 1);
assert.equal(calls.filter(value => value === 'object-url').length, 1);
assert.equal(calls.filter(value => value.startsWith('revoke:')).length, 1);
assert.deepEqual(calls.filter(value => value.startsWith('append:')), [`append:${bundle.figureId}-bundle.zip`]);
assert.deepEqual(calls.filter(value => value.startsWith('remove:')), [`remove:${bundle.figureId}-bundle.zip`]);
assert.ok(zippedBytes !== null);
const archive = unzipSync(zippedBytes);
assert.deepEqual(Object.keys(archive).sort(), bundle.artifacts.map(artifact => artifact.logicalPath).sort());
for (const artifact of bundle.artifacts) {
  assert.deepEqual(archive[artifact.logicalPath], Uint8Array.from(artifact.bytes));
}

const unavailable = await createLocalDownloadArtifactWriter({
  primitives: {
    ...primitives,
    createObjectUrl: () => {
      throw new Error('object URL unavailable');
    },
  },
}).write(bundle);
assert.equal(unavailable.status, 'rejected');
assert.match(unavailable.reason ?? '', /object URL unavailable/);

console.log('visual-lab artifact writer tests passed');
