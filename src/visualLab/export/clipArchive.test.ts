import assert from 'node:assert/strict';
import { unzipSync } from 'fflate';
import {
  buildVisualLabClipZip,
  downloadVisualLabClipArchive,
  prepareVisualLabClipArchive,
  VisualLabClipArchiveError,
  type ClipArchiveBrowserPrimitives,
  type ClipArchiveWriteResult,
} from './clipArchive';
import type { CanvasWebmCaptureResult } from './clipCapture';

const PROVENANCE = {
  analysisRunId: 'analysis-run-7',
  frame: 'frame-42',
  story: 'story-power-cap',
  runtime: 'story-runtime-v1',
  source: 'accepted-canonical-frame',
} as const;

const CAPTURE: CanvasWebmCaptureResult<typeof PROVENANCE> = {
  status: 'completed',
  cancelled: false,
  bytes: Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x02]),
  mimeType: 'video/webm;codecs=vp8',
  durationMs: 250,
  durationSec: 0.25,
  duration: 0.25,
  fps: 10,
  frameCount: 3,
  capturedDurationMs: 250,
  provenance: PROVENANCE,
};

function archiveEntries(bytes: Uint8Array): Record<string, Uint8Array> {
  return unzipSync(bytes);
}

function expectArchiveError(action: () => unknown, code: VisualLabClipArchiveError['code']): void {
  let error: unknown = null;
  try {
    action();
  } catch (candidate) {
    error = candidate;
  }
  assert.ok(error instanceof VisualLabClipArchiveError);
  assert.equal(error.code, code);
}

function createDownloadPrimitives(options: { readonly clickError?: Error } = {}): {
  readonly primitives: ClipArchiveBrowserPrimitives;
  readonly calls: string[];
  readonly zipBytes: () => Uint8Array | null;
} {
  const calls: string[] = [];
  let capturedZip: Uint8Array | null = null;
  const anchor = {
    href: '',
    download: '',
    click: () => {
      calls.push('click');
      if (options.clickError !== undefined) throw options.clickError;
    },
  };
  const primitives: ClipArchiveBrowserPrimitives = {
    createBlob: (parts, mediaType) => {
      calls.push(`blob:${mediaType}`);
      const part = parts[0];
      if (part instanceof ArrayBuffer) capturedZip = new Uint8Array(part.slice(0));
      else if (ArrayBuffer.isView(part)) capturedZip = new Uint8Array(part.buffer.slice(part.byteOffset, part.byteOffset + part.byteLength));
      else throw new Error('expected one binary ZIP part');
      return { size: capturedZip.byteLength, type: mediaType } as unknown as Blob;
    },
    createObjectUrl: () => {
      calls.push('object-url');
      return 'blob:visual-lab-clip';
    },
    revokeObjectUrl: url => calls.push(`revoke:${url}`),
    createDownloadAnchor: () => {
      calls.push('anchor');
      return anchor;
    },
    appendAnchor: value => calls.push(`append:${value.download}`),
    removeAnchor: value => calls.push(`remove:${value.download}`),
  };
  return { primitives, calls, zipBytes: () => capturedZip };
}

// The pure builder emits exactly one WebM and one provenance manifest, while
// preserving the captured bytes and the complete source identity.
{
  const prepared = prepareVisualLabClipArchive(CAPTURE, {
    clipId: 'story/power-cap',
    title: 'Power cap replay',
    claimBoundary: 'Archived-TLE model projection only.',
    sourceLocators: ['/tle-archive/starlink/catalog.json'],
    locale: 'en',
    theme: 'dark',
  });
  assert.equal(prepared.filename, 'story-power-cap.zip');
  assert.equal(prepared.archiveBytes, prepared.zipBytes.length);
  assert.equal(prepared.webmBytes, CAPTURE.bytes.length);
  assert.ok(prepared.manifestBytes > 0);
  const entries = archiveEntries(prepared.zipBytes);
  assert.deepEqual(Object.keys(entries).sort(), ['clip.webm', 'provenance.json']);
  assert.deepEqual(entries['clip.webm'], CAPTURE.bytes);
  const manifest = JSON.parse(new TextDecoder().decode(entries['provenance.json'])) as Record<string, unknown>;
  assert.equal(manifest.schema, 'visual-lab-clip-archive-v1');
  assert.deepEqual(manifest.provenance, PROVENANCE);
  assert.equal(manifest.clipId, 'story/power-cap');
  assert.equal((manifest.webm as Record<string, unknown>).bytes, CAPTURE.bytes.length);
  assert.deepEqual(buildVisualLabClipZip(CAPTURE, {
    clipId: 'story/power-cap',
    title: 'Power cap replay',
    claimBoundary: 'Archived-TLE model projection only.',
    sourceLocators: ['/tle-archive/starlink/catalog.json'],
    locale: 'en',
    theme: 'dark',
  }), prepared.zipBytes);
}

// The browser adapter creates one download and always revokes its object URL.
{
  const fixture = createDownloadPrimitives();
  const result = await downloadVisualLabClipArchive({
    capture: CAPTURE,
    clipId: '../story:power-cap',
    title: 'Power cap replay',
  }, { primitives: fixture.primitives });
  assert.equal(result.status, 'written');
  assert.equal(result.filename, 'story-power-cap.zip');
  assert.equal(result.bytes, result.archiveBytes);
  assert.equal(result.sizeBytes, result.archiveBytes);
  assert.equal(result.webmBytes, CAPTURE.bytes.length);
  assert.ok(result.manifestBytes > 0);
  assert.equal(result.reason, null);
  assert.deepEqual(fixture.calls, [
    'blob:application/zip',
    'object-url',
    'anchor',
    'append:story-power-cap.zip',
    'click',
    'remove:story-power-cap.zip',
    'revoke:blob:visual-lab-clip',
  ]);
  assert.deepEqual(archiveEntries(fixture.zipBytes()!), {
    'clip.webm': CAPTURE.bytes,
    'provenance.json': archiveEntries(prepareVisualLabClipArchive(CAPTURE, {
      clipId: '../story:power-cap',
      title: 'Power cap replay',
    }).zipBytes)['provenance.json'],
  });
}

// Invalid captures fail closed before any browser side effect.
{
  const fixture = createDownloadPrimitives();
  const cancelled = await downloadVisualLabClipArchive({
    ...CAPTURE,
    status: 'cancelled',
    cancelled: true,
  }, { primitives: fixture.primitives });
  assert.equal(cancelled.status, 'rejected');
  assert.equal(cancelled.code, 'CAPTURE_NOT_COMPLETED');
  assert.equal(fixture.calls.length, 0);

  expectArchiveError(() => prepareVisualLabClipArchive({ ...CAPTURE, bytes: new Uint8Array() }), 'EMPTY_CAPTURE');
  expectArchiveError(() => prepareVisualLabClipArchive({ ...CAPTURE, provenance: { ...PROVENANCE, runtime: '' } }), 'INVALID_PROVENANCE');
}

// A click failure still revokes the URL and is reported as a rejected write.
{
  const fixture = createDownloadPrimitives({ clickError: new Error('download blocked') });
  const result: ClipArchiveWriteResult = await downloadVisualLabClipArchive(CAPTURE, { primitives: fixture.primitives });
  assert.equal(result.status, 'rejected');
  assert.equal(result.code, 'DOWNLOAD_FAILED');
  assert.match(result.reason ?? '', /download blocked/);
  assert.equal(fixture.calls.filter(call => call.startsWith('revoke:')).length, 1);
}

// Node has no document-backed download port, so the default path is explicit
// unavailable rather than probing a server or pretending that a file exists.
{
  const result = await downloadVisualLabClipArchive(CAPTURE);
  assert.equal(result.status, 'unavailable');
  assert.equal(result.code, 'UNAVAILABLE');
  assert.equal(result.bytes, 0);
}

console.log('visual-lab clip archive tests passed');
