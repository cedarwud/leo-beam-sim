import assert from 'node:assert/strict';
import {
  formatCalloutEe,
  formatHomepageCalloutEe,
} from './SinrLiveCellBeamCallouts';

assert.equal(formatCalloutEe(141_176), 'EE 141.18 kbit/J');
assert.equal(formatCalloutEe(1_200_000), 'EE 1.2 Mbit/J');
assert.equal(formatHomepageCalloutEe(141_176), 'EE 141.18 Kbit/J');
assert.equal(formatHomepageCalloutEe(1_200_000), 'EE 1200.00 Kbit/J');
assert.equal(formatCalloutEe(null), 'EE —');
assert.equal(formatCalloutEe(Number.NaN), 'EE —');

console.log('homepage Beam Info uses compact EE values and preserves unavailable EE as EE —.');
