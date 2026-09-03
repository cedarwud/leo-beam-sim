import assert from 'node:assert/strict';
import { DEFAULT_SIMULATOR_PARAMETERS, type SimulatorParameters } from '../../simulator/types';
import {
  applyCanonicalParameterChange,
  CANONICAL_PARAMETER_CONTROL_CONTRACTS,
  type CanonicalParameterKey,
} from './canonicalParameterControls';

const parameters: SimulatorParameters = { ...DEFAULT_SIMULATOR_PARAMETERS };

assert.equal(
  CANONICAL_PARAMETER_CONTROL_CONTRACTS.length,
  8,
  'canonical Power / Throughput / EE control inventory must stay complete',
);
assert.deepEqual(
  CANONICAL_PARAMETER_CONTROL_CONTRACTS.map(control => control.testId),
  [
    'power-tab-beam-cap-control',
    'power-tab-satellite-cap-control',
    'throughput-tab-minimum-rate-control',
    'throughput-tab-system-bandwidth-control',
    'ee-tab-eta-max-control',
    'ee-tab-backoff-control',
    'ee-tab-rfc-control',
    'ee-tab-bb-control',
  ],
  'every formal adjustable input needs one stable control identity',
);
assert.ok(
  CANONICAL_PARAMETER_CONTROL_CONTRACTS.every(control => control.snapshotOwner === 'accepted-frame'),
  'editable inputs must publish through the accepted-frame snapshot consumed by scene and right rail',
);

const cases: readonly { key: CanonicalParameterKey; before: number; eventValue: number; after: number }[] = [
  { key: 'beamPowerCapW', before: parameters.beamPowerCapW, eventValue: 1.75, after: 1.75 },
  { key: 'satellitePowerCapW', before: parameters.satellitePowerCapW, eventValue: 12.25, after: 12.25 },
  { key: 'minimumRateBps', before: parameters.minimumRateBps, eventValue: 123_456, after: 123_000 },
  { key: 'systemBandwidthHz', before: parameters.systemBandwidthHz, eventValue: 51_234_567, after: 51_000_000 },
  { key: 'etaMax', before: parameters.etaMax, eventValue: 0.61, after: 0.61 },
  { key: 'backoffDb', before: parameters.backoffDb, eventValue: 4.7, after: 4.7 },
  { key: 'rfcPowerW', before: parameters.rfcPowerW, eventValue: 0.512, after: 0.512 },
  { key: 'basebandPerSatelliteW', before: parameters.basebandPerSatelliteW, eventValue: 0.744, after: 0.744 },
];

for (const { key, before, eventValue, after } of cases) {
  const next = applyCanonicalParameterChange(parameters, key, eventValue);
  assert.equal(next[key], after, `${key}: UI event must update the canonical state value`);
  assert.notEqual(next[key], before, `${key}: regression event must be an actual state change`);
  for (const sibling of Object.keys(parameters) as Array<keyof SimulatorParameters>) {
    if (sibling === key) continue;
    assert.equal(next[sibling], parameters[sibling], `${key}: unrelated parameter ${sibling} changed`);
  }
}

console.log('Canonical control events update one canonical parameter and preserve all sibling inputs.');

