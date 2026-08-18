import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  beamCountForCompleteHexRings,
  createHexBeamLayout,
  SUPPORTED_BEAM_LAYOUT_COUNTS,
} from './index';

test('complete hexagonal rings produce 1, 7, 19, 37, and 61 beams', () => {
  assert.deepEqual(
    [0, 1, 2, 3, 4].map(beamCountForCompleteHexRings),
    [1, 7, 19, 37, 61],
  );
});

test('the initial product exposes only the accepted 1, 7, and 19 presets', () => {
  assert.deepEqual(SUPPORTED_BEAM_LAYOUT_COUNTS, [1, 7, 19]);
  for (const invalidCount of [0, 2, 6, 8, 18, 20, 37]) {
    assert.throws(
      () => createHexBeamLayout({
        satelliteId: 'sat-a',
        beamCount: invalidCount,
        halfPowerBeamWidthDeg: 3.32,
      }),
      /beamCount must be one of 1, 7, or 19/,
    );
  }
});

test('each accepted preset creates complete rings for one satellite', () => {
  const expectedTierCounts = new Map([
    [1, [1]],
    [7, [1, 6]],
    [19, [1, 6, 12]],
  ]);

  for (const beamCount of SUPPORTED_BEAM_LAYOUT_COUNTS) {
    const layout = createHexBeamLayout({
      satelliteId: 'sat-a',
      beamCount,
      halfPowerBeamWidthDeg: 3.32,
    });
    assert.equal(layout.beamPositions.length, beamCount);
    assert.ok(layout.beamPositions.every(position => position.satelliteId === 'sat-a'));
    assert.deepEqual(
      Array.from({ length: layout.ringCount + 1 }, (_, tier) => (
        layout.beamPositions.filter(position => position.tier === tier).length
      )),
      expectedTierCounts.get(beamCount),
    );
  }
});

test('the 19-beam preset records TR 38.821 HPBW-derived UV spacing without claiming evaluated baseline geometry', () => {
  const layout = createHexBeamLayout({
    satelliteId: 'sat-a',
    beamCount: 19,
    halfPowerBeamWidthDeg: 3.32,
  });
  const expectedSpacing = Math.sqrt(3) * Math.sin((3.32 * Math.PI / 180) / 2);
  assert.ok(Math.abs(layout.adjacentSpacingUv - expectedSpacing) < 1e-15);
  assert.equal(
    layout.source,
    '3gpp-tr-38.821-table-6.1.1.1-4-topology-and-uv-spacing-metadata',
  );

  const firstRing = layout.beamPositions.filter(position => position.tier === 1);
  assert.equal(firstRing.length, 6);
  for (const position of firstRing) {
    assert.ok(Math.abs(Math.hypot(position.u, position.v) - expectedSpacing) < 1e-15);
  }
});
