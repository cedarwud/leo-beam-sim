import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveRenderedLiveSatelliteMarkers } from './renderedLiveSatelliteMarkers';

test('retains ambient markers, applies identity colours, and adds only requested apex markers', () => {
  const markers = resolveRenderedLiveSatelliteMarkers({
    displaySats: [
      { id: 'ambient', world: { x: 1, y: 2, z: 3 } as never },
    ],
    handoverMarkerSatelliteIds: new Set(['ambient', 'event-sat', 'missing']),
    identityColorBySatelliteId: new Map([['ambient', '#accepted']]),
    coneApexWorldById: new Map([
      ['event-sat', { x: 10, y: 20, z: 30 }],
    ]),
    resolveFallbackColor: satelliteId => `fallback:${satelliteId}`,
  });

  assert.equal(markers.length, 2);
  assert.equal(markers[0]?.id, 'ambient');
  assert.equal(markers[0]?.satelliteTintColor, '#accepted');
  assert.equal(markers[1]?.id, 'event-sat');
  assert.deepEqual(
    markers[1]?.world && { x: markers[1].world.x, y: markers[1].world.y, z: markers[1].world.z },
    { x: 10, y: 20, z: 30 },
  );
  assert.equal(markers[1]?.satelliteTintColor, 'fallback:event-sat');
});

test('does not duplicate a displayed satellite when it is also in the event set', () => {
  const markers = resolveRenderedLiveSatelliteMarkers({
    displaySats: [
      { id: 'sat-a', world: { x: 0, y: 1, z: 2 } as never },
      { id: 'sat-b', world: { x: 3, y: 4, z: 5 } as never },
    ],
    handoverMarkerSatelliteIds: new Set(['sat-b']),
    identityColorBySatelliteId: new Map(),
    coneApexWorldById: new Map(),
    resolveFallbackColor: satelliteId => satelliteId,
  });

  assert.deepEqual(markers.map(marker => marker.id), ['sat-a', 'sat-b']);
});
