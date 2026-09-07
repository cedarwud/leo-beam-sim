import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveHomepageIntraCellAnchor } from './homepageIntraCellAnchor';

const fallback = Object.freeze({ x: 99, y: 4, z: -2 });
const placementByCellId = new Map([
  [2, { worldX: 12, worldZ: -8 }],
  [5, { worldX: 25, worldZ: -15 }],
]);

test('uses the highest-priority intra candidate and its earth-fixed placement', () => {
  const anchor = resolveHomepageIntraCellAnchor({
    presentedHandoverPairCandidate: { kind: 'intra', fromCellId: 2 },
    handoverPresentationCandidate: { kind: 'intra', from: { cellId: 5 } },
    displayHeroCellId: 5,
    placementByCellId,
    fallback,
  });

  assert.deepEqual(anchor, { x: 12, y: 0, z: -8 });
});

test('falls back to the hero cell when no handover candidate is intra', () => {
  const anchor = resolveHomepageIntraCellAnchor({
    presentedHandoverPairCandidate: { kind: 'inter', fromCellId: 2 },
    handoverPresentationCandidate: { kind: 'inter', from: { cellId: 5 } },
    displayHeroCellId: 5,
    placementByCellId,
    fallback,
  });

  assert.deepEqual(anchor, { x: 25, y: 0, z: -15 });
});

test('keeps the UE fallback when the selected cell has no drawable placement', () => {
  const anchor = resolveHomepageIntraCellAnchor({
    presentedHandoverPairCandidate: { kind: 'intra', fromCellId: 404 },
    placementByCellId,
    fallback,
  });

  assert.strictEqual(anchor, fallback);
});
