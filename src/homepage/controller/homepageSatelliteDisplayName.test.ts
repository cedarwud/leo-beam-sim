import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildHomepageSatelliteDisplayNameMap,
  resolveHomepageSatelliteDisplayName,
} from './homepageSatelliteDisplayName';

test('homepage keeps exact active TLE names while raw IDs remain fallbacks', () => {
  const names = buildHomepageSatelliteDisplayNameMap([
    { satelliteId: 'starlink-P0-S0', satelliteName: 'STARLINK-1001' },
    { satelliteId: 'oneweb-P0-S0', satelliteName: 'ONEWEB-0001' },
  ]);

  assert.equal(resolveHomepageSatelliteDisplayName('starlink-P0-S0', names), 'STARLINK-1001');
  assert.equal(resolveHomepageSatelliteDisplayName('oneweb-P0-S0', names), 'ONEWEB-0001');
  assert.equal(resolveHomepageSatelliteDisplayName('shell-pro-53-P13-S7', null), 'G53-14-08');
  assert.equal(resolveHomepageSatelliteDisplayName(null, names), '—');
});

test('empty or blank TLE records do not override the compact fallback', () => {
  const names = buildHomepageSatelliteDisplayNameMap([
    { satelliteId: 'shell-pro-42-P0-S0', satelliteName: '   ' },
    { satelliteId: '   ', satelliteName: 'IGNORED' },
  ]);

  assert.equal(names, null);
  assert.equal(
    resolveHomepageSatelliteDisplayName('shell-pro-42-P0-S0', names),
    'G42-01-01',
  );
});
