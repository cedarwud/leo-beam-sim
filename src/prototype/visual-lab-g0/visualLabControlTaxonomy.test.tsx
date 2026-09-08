import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  DEFAULT_VISUAL_LAB_INPUTS,
  VISUAL_LAB_INPUT_DEFINITIONS,
  VISUAL_LAB_INPUT_GROUPS,
  VISUAL_LAB_INPUT_SUBGROUPS,
  type VisualLabInputKey,
} from '../../visualLab/experiment';
import type { VisualLabCanonicalSnapshot } from './visualLabCanonicalSnapshotAdapter';
import { VisualLabProgressiveControlDock, type VisualLabProgressiveControlDockProps } from './VisualLabProgressiveControlDock';
import { VISUAL_LAB_MODULES, type VisualLabModuleKey } from './visualLabWorkspace';

const SINR_INPUTS: readonly VisualLabInputKey[] = [
  'frequencyReuse',
  'antennaNoiseTemperatureK',
  'noiseFigureDb',
  'noiseReferenceTemperatureK',
  'g0Linear',
  'theta3dbRad',
  'carrierFrequencyGHz',
  'atmosphericZenithLossDb',
  'receiveGainDbi',
  'minimumRateBps',
  'systemBandwidthHz',
];

const POWER_INPUTS: readonly VisualLabInputKey[] = [
  'beamPowerCapW',
  'satellitePowerCapW',
  'etaMax',
  'backoffDb',
  'rfcPowerW',
  'basebandPerSatelliteW',
];

const snapshot: VisualLabCanonicalSnapshot = {
  schemaVersion: 'visual-lab-canonical-snapshot-v1',
  isMock: false,
  source: {
    frameId: 'test-frame', tleFrameId: 'test-tle-frame', instantUtc: '2026-08-12T12:00:00.000Z',
    instantTaipei: '2026-08-12T20:00:00+08:00', tleEpochUtc: '2026-08-12T00:00:00.000Z',
    selectedSatelliteId: 'test-serving', constellation: 'starlink', archiveId: 'test-archive',
    archiveDate: '20260812', selectedTlePath: 'test.tle', sourceKind: 'ARCHIVED_TLE',
    propagationModel: 'SGP4', contractVersion: 'family-b-thesis-3.13-3.17-v1',
  },
  timeline: {
    availability: 'available', instantUtc: '2026-08-12T12:00:00.000Z', anchorIndex: 0,
    anchorCount: 241, elapsedSec: 0, durationSec: 7_200, stepSec: 30,
    servingSatelliteId: 'test-serving', candidateSatelliteId: 'test-candidate',
    servingPassId: 'serving-pass', candidatePassId: 'candidate-pass',
  },
  serving: {
    availability: 'available', satelliteId: 'test-serving', beamId: 1, userId: 'ue-1',
    sinrLinear: 10, sinrDb: 10, requestedPowerW: 1, actualPowerW: 1,
    throughputBps: 1_000_000, instantaneousEeBitsPerJ: 100_000,
    distanceKm: 1_000, elevationDeg: 45, reason: null,
  },
  candidate: {
    availability: 'available', satelliteId: 'test-candidate', beamId: 1, userId: 'ue-1',
    sinrLinear: 12, sinrDb: 10.8, requestedPowerW: 0.9, actualPowerW: 0.9,
    throughputBps: 1_100_000, instantaneousEeBitsPerJ: null,
    distanceKm: 1_050, elevationDeg: 42, reason: null,
  },
  deltaSinrDb: 0.8,
  throughput: { servingRateBps: 1_000_000, candidateRateBps: 1_100_000, totalRateBps: 100_000_000, cumulativeDeliveredBits: 3_000_000_000 },
  power: { servingActualPowerW: 1, candidateActualPowerW: 0.9, systemPowerW: 100, cumulativeConsumedEnergyJ: 3_000 },
  ee: { instantaneousBitsPerJ: 1_000_000, cumulativeBitsPerJ: 1_000_000 },
  evaluation: { availability: 'available', source: 'homepage-canonical-evaluation', deliveredBits: 3_000_000_000, consumedEnergyJ: 3_000, energyEfficiencyBitsPerJ: 1_000_000, durationSec: 30 },
  handover: {
    availability: 'available', state: 'monitoring', event: 'none', offsetDb: 3,
    tttSec: 30, progressSec: 0, ratio: 0, cumulativeCount: 0, reason: 'monitoring',
    servingSatelliteId: 'test-serving', candidateSatelliteId: 'test-candidate', deltaDb: 0.8,
    eventFromSatelliteId: null, eventToSatelliteId: null,
  },
};
const source = { constellation: 'starlink' as const, localDateTime: '2026-08-12T20:00' };

function props(activeModule: VisualLabModuleKey): VisualLabProgressiveControlDockProps {
  return {
    locale: 'zh-Hant',
    activeModule,
    inputs: DEFAULT_VISUAL_LAB_INPUTS,
    acceptedSource: source,
    draftSource: source,
    applyingSource: false,
    sourceDirty: false,
    beamLayoutCount: 7,
    beamIlluminationMode: 'fixed',
    onDraftSourceChange: () => undefined,
    onApplySource: () => undefined,
    onBeamLayoutCountChange: () => undefined,
    onBeamIlluminationModeChange: () => undefined,
    onInputChange: () => undefined,
    onResetInput: () => undefined,
    onResetAll: () => undefined,
    snapshot,
  };
}

function markup(activeModule: VisualLabModuleKey): string {
  return renderToStaticMarkup(<VisualLabProgressiveControlDock {...props(activeModule)} />);
}

function dataInputKeys(rendered: string): string[] {
  return [...rendered.matchAll(/data-input-key="([^"]+)"/g)].map((match) => match[1]!);
}

assert.deepEqual(
  VISUAL_LAB_MODULES.map((module) => module.key),
  ['scene', 'sinr', 'power'],
  'the left control strip contains scenario and editable SINR/Power inputs only',
);
assert.equal(
  VISUAL_LAB_MODULES.some((module) => module.key === 'handover' || module.key === 'throughput' || module.key === 'ee'),
  false,
  'derived handover/throughput/EE values stay in the right result dock',
);

assert.deepEqual(
  VISUAL_LAB_INPUT_GROUPS.map((group) => group.key),
  ['sinr', 'power'],
  'editable inputs have exactly two owners',
);
assert.deepEqual(
  [...new Set(VISUAL_LAB_INPUT_DEFINITIONS.map((definition) => definition.group))].sort(),
  ['power', 'sinr'],
);

assert.equal(VISUAL_LAB_INPUT_DEFINITIONS.length, 17, 'the canonical editable inventory remains 17 inputs');
assert.deepEqual(VISUAL_LAB_INPUT_DEFINITIONS.filter((definition) => definition.group === 'sinr').map((definition) => definition.key), SINR_INPUTS);
assert.deepEqual(VISUAL_LAB_INPUT_DEFINITIONS.filter((definition) => definition.group === 'power').map((definition) => definition.key), POWER_INPUTS);
assert.deepEqual(VISUAL_LAB_INPUT_SUBGROUPS.filter((subgroup) => subgroup.group === 'sinr').map((subgroup) => subgroup.key), ['antenna-channel', 'noise-interference', 'bandwidth-service-demand']);
assert.deepEqual(VISUAL_LAB_INPUT_SUBGROUPS.filter((subgroup) => subgroup.group === 'power').map((subgroup) => subgroup.key), ['limits', 'amplifier', 'rf-baseband-circuitry']);

const sinrMarkup = markup('sinr');
const powerMarkup = markup('power');
const controlsMarkup = `${sinrMarkup}${powerMarkup}`;
const renderedInputKeys = dataInputKeys(controlsMarkup);
// The default SINR power term and the Power module are formula/readout
// surfaces; retired QoS and power-ledger inputs are not editable here.
const selectedSinrAndPowerKeys = new Set<string>();
assert.equal(
  renderedInputKeys.length,
  selectedSinrAndPowerKeys.size,
  'default SINR power and Power surfaces render no retired editable controls',
);
for (const key of renderedInputKeys) assert.equal(selectedSinrAndPowerKeys.has(key), true, `${key} belongs to the visible control owners`);
for (const key of selectedSinrAndPowerKeys) assert.equal(renderedInputKeys.filter((renderedKey) => renderedKey === key).length, 1, `${key} has exactly one control card`);
assert.equal((controlsMarkup.match(/type="range"/g) ?? []).length, selectedSinrAndPowerKeys.size);
assert.equal((controlsMarkup.match(/type="number"/g) ?? []).length, selectedSinrAndPowerKeys.size);

for (const derivedOutput of ['B_beam', 'gamma_req', 'P_DL_actual', 'rate', 'throughput', 'P_sys', 'EE']) {
  assert.doesNotMatch(controlsMarkup, new RegExp(`data-input-key="${derivedOutput}"`), `${derivedOutput} remains derived/read-only`);
}

const hiddenResultMarkup = `${markup('throughput')}${markup('ee')}`;
assert.match(hiddenResultMarkup, /data-compatibility-only="result-focus"/);
assert.doesNotMatch(hiddenResultMarkup, /type="(?:range|number)"/, 'result-focus compatibility keys cannot render editable controls');

const sceneMarkup = markup('scene');
assert.doesNotMatch(sceneMarkup, /簡化場景|場景背景/, 'the scene panel no longer exposes a simplified background mode');
assert.doesNotMatch(sceneMarkup, /收起|聚焦場景/);
assert.match(sinrMarkup, /visual-lab-sinr-top-formula/);
assert.match(sinrMarkup, /visual-lab-sinr-formula-interference/);

console.log('Visual-lab control taxonomy keeps derived Throughput/EE out of the editable left surface.');
