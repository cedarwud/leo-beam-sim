#!/usr/bin/env node
import assert from 'node:assert/strict';

import {
  C120_CLAIM_BOUNDARY,
  C120_CONSTRUCTED_RESPONSE_KEYS,
} from './contract';
import {
  C120_CONSTRUCTED_RESPONSE_DEFINITIONS,
  C120_TEACHING_CONTENT,
  C120_TEACHING_CONTENT_IDS,
  assertC120TeachingScenarioId,
} from './teachingContent';

assert.equal(C120_TEACHING_CONTENT.header.contentId, 'c120-teaching-content-v1');
assert.equal(C120_TEACHING_CONTENT.header.exactMinutes, 120);
assert.equal(C120_TEACHING_CONTENT.header.scenarioId, C120_TEACHING_CONTENT_IDS.scenarioId);
assert.equal(C120_TEACHING_CONTENT.tleAnchor.offlineImport.scenarioId, C120_TEACHING_CONTENT_IDS.scenarioId);
assert.equal(C120_TEACHING_CONTENT.tleAnchor.offlineImport.fixtureVersion, C120_TEACHING_CONTENT_IDS.fixtureVersion);

assert.doesNotThrow(() => assertC120TeachingScenarioId(C120_TEACHING_CONTENT_IDS.scenarioId));
assert.throws(
  () => assertC120TeachingScenarioId('c120-wrong-scenario'),
  /teaching content scenario mismatch/,
);

assert.equal(C120_CONSTRUCTED_RESPONSE_DEFINITIONS.length, 8, 'C-120 has at most eight constructed responses');
assert.deepEqual(
  C120_CONSTRUCTED_RESPONSE_DEFINITIONS.map(definition => definition.key),
  [...C120_CONSTRUCTED_RESPONSE_KEYS],
  'constructed response order stays aligned with the frozen contract',
);
assert.equal(
  new Set(C120_CONSTRUCTED_RESPONSE_DEFINITIONS.map(definition => definition.key)).size,
  8,
  'constructed response keys are unique',
);
assert.equal(
  C120_CONSTRUCTED_RESPONSE_DEFINITIONS.filter(definition => definition.fieldKind === 'SHORT-CLAUSE').length,
  2,
  'only transfer hypothesis and falsifier are free short clauses',
);

const scheduleIds = C120_TEACHING_CONTENT.labC.boundedSchedules.map(schedule => schedule.id);
assert.equal(new Set(scheduleIds).size, scheduleIds.length, 'bounded schedule IDs are unique');
assert.deepEqual(C120_TEACHING_CONTENT.labC.actionableSlotIds, ['slot-2', 'slot-3', 'slot-5', 'slot-6']);
for (const schedule of C120_TEACHING_CONTENT.labC.boundedSchedules) {
  assert.equal(schedule.slots.length, 6);
  assert.equal(schedule.slots[0], 'fixed-contact');
  assert.equal(schedule.slots[3], 'fixed-outage');
  assert.equal(schedule.learnerCanRevise, true);
}

const clinicLabels = C120_TEACHING_CONTENT.clinic.featureCards.map(card => card.neutralLabel);
assert.equal(new Set(clinicLabels).size, clinicLabels.length, 'clinic labels are unique and neutral');
assert.ok(clinicLabels.every(label => /^Card [A-E] · /.test(label)));
assert.ok(clinicLabels.every(label => !/future|result|outcome|leak/i.test(label)), 'labels must not leak availability or answer');
assert.equal(C120_TEACHING_CONTENT.clinic.featureCards.length, 5, 'clinic keeps a borderline timestamp card in the set');
assert.ok(C120_TEACHING_CONTENT.clinic.featureCards.some(card => card.timestampLabel === 't = 1'));

const contentText = JSON.stringify(C120_TEACHING_CONTENT);
assert.ok(contentText.includes(C120_CLAIM_BOUNDARY), 'exact claim boundary must be present in the authored content');
const copyWithoutBoundary = contentText.split(C120_CLAIM_BOUNDARY).join('');
assert.doesNotMatch(copyWithoutBoundary, /\b(?:LIVE|CANONICAL)\b/i, 'teaching copy must not make live/canonical claims');
assert.doesNotMatch(copyWithoutBoundary, /live\s+backend|canonical\s+parity|measured\s+truth/i);

assert.equal(C120_TEACHING_CONTENT.claimDetective.workedTrace.slots.length, 2);
assert.equal(C120_TEACHING_CONTENT.labB.workedTrace.events.length, 5);
assert.equal(C120_TEACHING_CONTENT.transfer.ideaCardFields.length, 8);
assert.deepEqual(
  C120_TEACHING_CONTENT.transfer.ideaCardFields.map(field => field.id),
  ['baseline', 'state-data', 'control', 'power-time-pathway', 'boundary-unit', 'service-constraint', 'held-out-case', 'falsifier'],
);

console.log('C-120 teaching content tests passed');
