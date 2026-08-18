import assert from 'node:assert/strict';

import {
  DEFAULT_VISUAL_LAB_FORM_VALUES,
  DEFAULT_VISUAL_LAB_INPUTS,
  VISUAL_LAB_DERIVED_RESULT_DOMAINS,
  VISUAL_LAB_INPUT_DEFINITIONS,
  VISUAL_LAB_INPUT_GROUPS,
  VISUAL_LAB_INPUT_KEYS,
  VISUAL_LAB_INPUT_SUBGROUPS,
  fromVisualLabFormValues,
  toVisualLabFormValues,
  type LocalizedCopy,
  type VisualLabInputKey,
  type VisualLabInputValues,
} from './visualLabExperimentSchema';
import type { SimulatorParameters } from '../../simulator/types';

const EXPECTED_KEYS = [
  'frequencyReuse',
  'antennaNoiseTemperatureK',
  'noiseFigureDb',
  'noiseReferenceTemperatureK',
  'g0Linear',
  'theta3dbRad',
  'carrierFrequencyGHz',
  'atmosphericZenithLossDb',
  'receiveGainDbi',
  'beamPowerCapW',
  'satellitePowerCapW',
  'minimumRateBps',
  'systemBandwidthHz',
  'etaMax',
  'backoffDb',
  'rfcPowerW',
  'basebandPerSatelliteW',
] as const satisfies readonly VisualLabInputKey[];

assert.equal(VISUAL_LAB_INPUT_DEFINITIONS.length, 17);
assert.equal(new Set(VISUAL_LAB_INPUT_DEFINITIONS.map((item) => item.key)).size, 17);
assert.deepEqual([...VISUAL_LAB_INPUT_KEYS], [...EXPECTED_KEYS]);
assert.deepEqual(
  [...VISUAL_LAB_INPUT_DEFINITIONS].map((item) => item.key),
  [...EXPECTED_KEYS],
  'the definition order is the canonical searchable order',
);
assert.deepEqual(Object.keys(DEFAULT_VISUAL_LAB_INPUTS).sort(), [...EXPECTED_KEYS].sort());

const formDefaults = toVisualLabFormValues(DEFAULT_VISUAL_LAB_INPUTS);
const roundTrippedDefaults = fromVisualLabFormValues(formDefaults);
for (const key of EXPECTED_KEYS) {
  const expected = DEFAULT_VISUAL_LAB_INPUTS[key];
  const actual = roundTrippedDefaults[key];
  assert.ok(
    Math.abs(actual - expected) <= Math.max(1e-12, Math.abs(expected) * 1e-12),
    `${key} must survive the canonical/display-unit/default round trip`,
  );
}
assert.deepEqual(DEFAULT_VISUAL_LAB_FORM_VALUES, formDefaults);

const compatibilityFields: Pick<SimulatorParameters, 'channelGainScale' | 'scintillationScaleDb' | 'shadowFadingMarginDb'> = {
  channelGainScale: 1,
  scintillationScaleDb: 0,
  shadowFadingMarginDb: 0,
};
const fullDefaults: SimulatorParameters = {
  ...DEFAULT_VISUAL_LAB_INPUTS,
  ...compatibilityFields,
};
const fullRoundTrip = fromVisualLabFormValues(
  toVisualLabFormValues(fullDefaults as VisualLabInputValues),
  fullDefaults,
);
assert.deepEqual(fullRoundTrip, fullDefaults, 'full SimulatorParameters round trip preserves non-form fields');

const frequencyReuse = VISUAL_LAB_INPUT_DEFINITIONS.find((item) => item.key === 'frequencyReuse');
assert.ok(frequencyReuse);
assert.equal(frequencyReuse.valueKind, 'integer');
assert.equal(frequencyReuse.min, 1);
assert.equal(frequencyReuse.max, 7);
assert.equal(frequencyReuse.step, 1);
assert.equal(Number.isInteger(frequencyReuse.defaultValue), true);
assert.equal(Number.isInteger(fromVisualLabFormValues({ ...formDefaults, frequencyReuse: 5 }).frequencyReuse), true);

assert.deepEqual(
  [...new Set(VISUAL_LAB_INPUT_DEFINITIONS.map((item) => item.group))].sort(),
  ['power', 'sinr'],
);
assert.deepEqual(VISUAL_LAB_INPUT_GROUPS.map((group) => group.key), ['sinr', 'power']);
assert.deepEqual(VISUAL_LAB_DERIVED_RESULT_DOMAINS.map((domain) => domain.key), ['throughput', 'ee']);
assert.ok(VISUAL_LAB_DERIVED_RESULT_DOMAINS.every((domain) => domain.readOnly && domain.inputOwner === null));
assert.ok(VISUAL_LAB_INPUT_DEFINITIONS.every((item) => item.group === 'sinr' || item.group === 'power'));
assert.ok(VISUAL_LAB_INPUT_SUBGROUPS.every((subgroup) => subgroup.group === 'sinr' || subgroup.group === 'power'));

const localeFields = (item: { label: LocalizedCopy; description: LocalizedCopy; causalPath?: LocalizedCopy; provenance?: LocalizedCopy }) => {
  for (const field of [item.label, item.description, item.causalPath, item.provenance]) {
    if (field === undefined) continue;
    assert.equal(typeof field['zh-Hant'], 'string');
    assert.equal(typeof field.en, 'string');
    assert.ok(field['zh-Hant'].trim().length > 0);
    assert.ok(field.en.trim().length > 0);
  }
};

for (const item of VISUAL_LAB_INPUT_DEFINITIONS) {
  localeFields(item);
  localeFields(item.copy);
  assert.ok(item.searchTerms['zh-Hant'].length > 0);
  assert.ok(item.searchTerms.en.length > 0);
  assert.ok(item.causalTargetTags.length > 0);
  assert.ok(item.sceneHighlightTargets.length > 0);
  const searchableText = JSON.stringify({
    label: item.label,
    description: item.description,
    causalPath: item.causalPath,
    provenance: item.provenance,
    searchTerms: item.searchTerms,
  }).toLowerCase();
  const forbiddenTerms = [['mo', 'ck'].join(''), ['proto', 'type'].join('')];
  for (const forbiddenTerm of forbiddenTerms) {
    assert.equal(searchableText.includes(forbiddenTerm), false, `${item.key} copy must stay source-accounted`);
  }
}

for (const subgroup of VISUAL_LAB_INPUT_SUBGROUPS) {
  localeFields(subgroup);
  localeFields(subgroup.copy);
  assert.ok(subgroup.searchTerms['zh-Hant'].length > 0);
  assert.ok(subgroup.searchTerms.en.length > 0);
}

for (const group of VISUAL_LAB_INPUT_GROUPS) {
  localeFields(group);
  localeFields(group.copy);
  assert.ok(group.searchTerms['zh-Hant'].length > 0);
  assert.ok(group.searchTerms.en.length > 0);
}

for (const domain of VISUAL_LAB_DERIVED_RESULT_DOMAINS) {
  localeFields(domain);
  localeFields(domain.copy);
  assert.ok(domain.searchTerms['zh-Hant'].length > 0);
  assert.ok(domain.searchTerms.en.length > 0);
}

console.log('Visual Lab experiment schema: 17 unique inputs, bilingual copy, ownership, tags, and pure unit round trips pass.');
