#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  C120_CLAIM_BOUNDARY,
  C120_CONSTRUCTED_RESPONSE_KEYS,
  C120_SEGMENTS,
} from './contract';
import { initialC120WorkbookStatus } from './workbookStatus';

function source(name: string): string {
  return readFileSync(fileURLToPath(new URL(name, import.meta.url)), 'utf8');
}

const route = source('./C120CourseRoute.tsx');
const panels = source('./C120SegmentPanels.tsx');
const scene = source('./C120CourseScene.tsx');
const session = source('./session.ts');
const recovery = source('./recovery.ts');
const learning = source('./learningState.ts');
const ledger = source('./C120EvidenceLedger.tsx');
const bundledProvider = source('./bundledProvider.ts');
const i18n = source('./i18n.tsx');
const main = source('../../main.tsx');

assert.equal(C120_SEGMENTS.reduce((total, segment) => total + segment.minutes, 0), 120);
assert.equal(C120_SEGMENTS.length, 8);
assert.equal(C120_CONSTRUCTED_RESPONSE_KEYS.length, 8);
assert.equal(new Set(C120_CONSTRUCTED_RESPONSE_KEYS).size, 8);

assert.match(main, /course\/c120/);
assert.match(main, /import\('\.\/course\/c120\/C120CourseRoute'\)/);
assert.match(route, /C120_STUB_PROVIDER/);
assert.match(route, /source.*fallback/s);
assert.match(route, /source.*real-data/s);
assert.match(route, /loadC120BundledProvider/);
assert.match(route, /SGP4 model-derived trajectory\. Course energy remains simulated data\./);
assert.match(route, /SIMULATED FIXTURE TRAJECTORY/);
assert.match(route, /先看這次課程使用的資料範圍/);
assert.doesNotMatch(route, /不需要衛星或通訊背景/);
assert.doesNotMatch(route, /No satellite or communications background/);
assert.doesNotMatch(route, /這不是即時衛星資料/);
assert.match(scene, /data-trajectory-truth/);
assert.match(route, /The simulated fixture will not be selected silently/);
assert.match(route, /Use the coherent simulated teaching fixture/);
assert.doesNotMatch(bundledProvider, /\/backend\//);
assert.match(bundledProvider, /exact TLE bytes|validateC120PinnedTleImport/);
assert.match(route, /restoreC120Session/);
assert.match(route, /initialC120WorkbookStatus/);
assert.match(route, /resetC120Session/);
assert.match(route, /makeC120WorkbookInput/);
assert.match(route, /Export reopenable workbook/);
assert.match(route, /Import and reopen workbook/);
assert.match(route, /restoreC120RecoveryBundle/);
assert.match(route, /Undo reset/);
assert.match(route, /c120-skip-link/);
assert.match(route, /Previous replay frame/);
assert.match(route, /type="range"/);
assert.match(route, /C120EvidenceLedger/);
assert.match(recovery, /c120-reopenable-workbook-bundle-v2/);
assert.match(learning, /validateC120SegmentEvidence/);
assert.match(ledger, /synchronized frame ledger/i);

for (const key of C120_CONSTRUCTED_RESPONSE_KEYS) {
  assert.match(panels, new RegExp(`responseKey="${key}"`), `missing ${key} response surface`);
}

for (const segment of C120_SEGMENTS) {
  assert.match(panels, new RegExp(`activeSegment === '${segment.id}'|segment="${segment.id}"`));
}

for (const candidate of ['App', 'MainScene', '../session', '../fixtures', 'paperEnergyEfficiency']) {
  assert.equal(
    [route, panels, scene, session].some(text => new RegExp(`from ['"][^'"]*${candidate}`).test(text)),
    false,
    `C-120 isolated route must not import ${candidate}`,
  );
}

for (const visibleSurface of [route, scene]) {
  assert.ok(visibleSurface.includes('C120_CLAIM_BOUNDARY'));
}
assert.equal(C120_CLAIM_BOUNDARY, 'SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED / NOT CANONICAL-PARITY-VERIFIED');

assert.match(route, /rejected fail closed/i);
assert.match(panels, /Freeze prediction \+ rule/);
assert.match(panels, /Freeze one revision \+ reveal held-out event/);
assert.match(panels, /Freeze feature boundary \+ prediction \+ action/);
assert.match(panels, /disabled=\{!state\.labCPredictionFrozen \|\| state\.labCBaselineSeen\}/);
assert.match(learning, /Lab C baseline cannot be revealed before prediction freeze/);
assert.match(panels, /documented recovery (?:preset|schedule)/i);
assert.match(panels, /name="mission-contract"/);
assert.match(panels, /Check evidence & continue/);
assert.match(panels, /ENERGY DECISION IDEA CARD/);
assert.match(panels, /PINNED OFFLINE IMPORT/);
assert.match(panels, /type="file"/);
assert.match(route, /C120TrialLedger/);
assert.match(route, /C120ResetDialog/);
assert.match(route, /C120LocaleProvider/);
assert.match(route, /C120LanguageSwitch/);
assert.match(panels, /useC120Locale/);
assert.match(i18n, /zh-Hant/);
assert.match(i18n, /繁中/);
assert.match(main, /local teaching surface could not start/i);

assert.equal(initialC120WorkbookStatus({
  recovered: false,
  status: 'INCOMPLETE',
  completedSegmentCount: 0,
}), 'No workbook export yet.');
assert.equal(initialC120WorkbookStatus({
  recovered: true,
  status: 'COMPLETE',
  completedSegmentCount: 8,
}), 'LOCAL SESSION RECOVERED · COMPLETE · 8/8 segments · export available');
assert.throws(
  () => initialC120WorkbookStatus({ recovered: true, status: 'INCOMPLETE', completedSegmentCount: 9 }),
  /integer from 0 to 8/,
);

console.log('C-120 isolated exact-120 route tests passed');
