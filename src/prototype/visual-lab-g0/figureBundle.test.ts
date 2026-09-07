import assert from 'node:assert/strict';
import { test } from 'node:test';
import { unzipSync, zipSync } from 'fflate';

import {
  buildVisualLabFigureBundleArchive,
  downloadVisualLabFigureBundle,
  parseFigureBundle,
  uploadVisualLabFigureBundle,
  type FigureBundleBuildInput,
} from './figureBundle';
import { createTestSnapshot, TEST_PROFILE } from '../../visualLab/export/testFixtures';
import type { Phase1UploadResponse } from '../../visualLab/export';

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01]);

const INPUT: FigureBundleBuildInput = {
  snapshot: createTestSnapshot(),
  figureProfile: TEST_PROFILE,
  figureId: 'round-trip-figure',
  capturedPng: { bytes: PNG, mediaType: 'image/png' },
  caption: 'Round-trip figure.',
  claimBoundary: 'Model projection only.',
  sourceLocators: ['/writer.tle'],
  equationLocators: ['ADR-003'],
};

test('figure archive Blob round-trips through the parser without data loss', async () => {
  const archive = buildVisualLabFigureBundleArchive(INPUT);
  const parsed = await parseFigureBundle(archive.blob);

  assert.notEqual(parsed, archive.bundle);
  assert.deepEqual(parsed, archive.bundle);
  assert.equal(parsed.manifest.figureId, 'round-trip-figure');
  assert.deepEqual(parsed.artifacts.map(item => item.role).sort((left, right) => left.localeCompare(right)), [
    'figure-data-json',
    'manifest-json',
    'composed-png',
    'quantitative-data-csv',
  ].sort((left, right) => left.localeCompare(right)));
  const png = parsed.artifacts.find(item => item.role === 'composed-png');
  assert.deepEqual(png?.bytes, Array.from(PNG));
});

test('figure parser rejects a ZIP without its manifest', async () => {
  const bytes = zipSync({ 'figures/round-trip-figure/figure-data.json': new TextEncoder().encode('{}') });
  await assert.rejects(
    () => parseFigureBundle(bytes),
    error => error instanceof Error && error.message.includes('exactly one manifest.json'),
  );
});

test('figure parser rejects an artifact whose digest no longer matches the manifest', async () => {
  const archive = buildVisualLabFigureBundleArchive(INPUT);
  const pngArtifact = archive.bundle.artifacts.find(item => item.role === 'composed-png');
  assert.ok(pngArtifact);
  const entries = unzipSync(archive.zipBytes);
  const pngBytes = entries[pngArtifact.logicalPath];
  assert.ok(pngBytes);
  pngBytes[pngBytes.length - 1] ^= 0x01;

  await assert.rejects(
    () => parseFigureBundle(zipSync(entries)),
    error => error instanceof Error && error.message.includes('digest mismatch'),
  );
});

test('figure download and upload adapters accept explicit pure-module inputs', async () => {
  const writes: string[] = [];
  const downloaded = await downloadVisualLabFigureBundle({
    ...INPUT,
    writer: {
      write: async bundle => {
        writes.push(bundle.figureId);
        return { status: 'written', artifacts: [], reason: null };
      },
    },
  });
  assert.equal(downloaded.write.status, 'written');
  assert.deepEqual(writes, ['round-trip-figure']);

  let requestBody = '';
  const response: Phase1UploadResponse = {
    ok: true,
    status: 201,
    json: async () => ({ receipt: { receiptId: 'receipt-round-trip' } }),
  };
  const uploaded = await uploadVisualLabFigureBundle({
    bundle: downloaded.bundle,
    endpoint: 'https://platform.example/visual-lab',
    schemaId: 'registered.visual-lab.v1',
    fetcher: async (_endpoint, init) => {
      requestBody = init.body;
      return response;
    },
  });
  assert.equal(uploaded.status, 'uploaded');
  assert.deepEqual(uploaded.receipt, { receiptId: 'receipt-round-trip' });
  assert.match(requestBody, /registered\.visual-lab\.v1/);
  assert.match(requestBody, /round-trip-figure/);
});
