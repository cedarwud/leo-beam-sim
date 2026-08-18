import assert from 'node:assert/strict';

import {
  buildVisualLabHexField,
  VISUAL_LAB_BACKGROUND_CELL_COUNT,
} from './visualLabHexField';

const radiusWorld = .635;
const largeNtpuBounds = {
  widthWorld: 9.1,
  depthWorld: 9.1 * 1528.740601 / 2140.236755,
};

const full = buildVisualLabHexField(radiusWorld, largeNtpuBounds);
assert.equal(full.length, VISUAL_LAB_BACKGROUND_CELL_COUNT);
assert.deepEqual(full.map(cell => cell.cellId), Array.from({ length: 37 }, (_unused, index) => index));

const croppedBounds = { widthWorld: 6.2, depthWorld: 4.1 };
const cropped = buildVisualLabHexField(radiusWorld, croppedBounds);
assert.ok(cropped.length > 0 && cropped.length < full.length);
for (const cell of cropped) {
  for (let index = 0; index < 6; index += 1) {
    const angle = Math.PI / 6 + index * Math.PI / 3;
    const x = cell.x + Math.cos(angle) * radiusWorld * 1.04;
    const z = cell.z + Math.sin(angle) * radiusWorld * 1.04;
    assert.ok(Math.abs(x) <= croppedBounds.widthWorld / 2 - .08 + 1e-9);
    assert.ok(Math.abs(z) <= croppedBounds.depthWorld / 2 - .08 + 1e-9);
  }
}

assert.throws(
  () => buildVisualLabHexField(0, largeNtpuBounds),
  /radiusWorld must be positive/,
);

console.log('visual-lab historical double-rim hex field passed');
