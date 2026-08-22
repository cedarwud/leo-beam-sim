#!/usr/bin/env node
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { act1FrameOffsets } from './act1FrameSchedule';
import { parseAct1OrbitCatalog, alignAct1ShellsToArtifact } from './act1TleCatalog';

test('frames are emitted centre-outward so the usable span grows around now', () => {
  const offsets = act1FrameOffsets(180, 60);

  assert.deepStrictEqual(offsets, [0, 60, -60, 120, -120, 180, -180]);
  assert.strictEqual(offsets[0], 0);
});

test('the offset set covers the full span exactly once each side', () => {
  const offsets = act1FrameOffsets(90 * 60, 60);

  assert.strictEqual(offsets.length, 181);
  assert.strictEqual(new Set(offsets).size, 181);
  assert.strictEqual(Math.max(...offsets), 5400);
  assert.strictEqual(Math.min(...offsets), -5400);
});

test('a 3LE record yields an id stripped of its leading zeros', () => {
  const text = [
    'ONEWEB-0325',
    '1 49194U 21083J   26222.54204203  .00000060  00000+0  11940-3 0  9998',
    '2 49194  87.9202 324.6537 0001941 103.3463 256.7886 13.18683671237178',
  ].join('\n');
  const [record] = parseAct1OrbitCatalog(text);

  assert.strictEqual(record.satelliteId, '49194');
  assert.strictEqual(record.satelliteName, 'ONEWEB-0325');
  assert.strictEqual(record.inclinationDeg, 87.9202);
  assert.strictEqual(record.shell, 'polar');
});

test('an id the catalogue does not carry stays unclassified, not guessed', () => {
  const text = [
    'ONEWEB-0325',
    '1 49194U 21083J   26222.54204203  .00000060  00000+0  11940-3 0  9998',
    '2 49194  87.9202 324.6537 0001941 103.3463 256.7886 13.18683671237178',
  ].join('\n');
  const aligned = alignAct1ShellsToArtifact(['49194', '99999'], parseAct1OrbitCatalog(text));

  assert.deepStrictEqual(aligned, ['polar', null]);
});
