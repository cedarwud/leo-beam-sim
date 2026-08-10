#!/usr/bin/env node
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const routeSource = readFileSync(new URL('./C90CourseRoute.tsx', import.meta.url), 'utf8');
const panelSource = readFileSync(new URL('./C90CoursePanels.tsx', import.meta.url), 'utf8');
const tlePanelSource = readFileSync(new URL('./C90TlePanel.tsx', import.meta.url), 'utf8');
const sceneSource = readFileSync(new URL('./C90CourseScene.tsx', import.meta.url), 'utf8');
const styleSource = readFileSync(new URL('./C90CourseRoute.scss', import.meta.url), 'utf8');
const baseSceneLayoutSource = readFileSync(new URL('../scene/BaseSceneLayout.tsx', import.meta.url), 'utf8');
const entrySource = readFileSync(new URL('../main.tsx', import.meta.url), 'utf8');

test('isolated course route has no legacy runtime imports', () => {
  for (const forbidden of ['./App', './scene/MainScene', './scene/useSimulation', 'SimState', './teaching']) {
    assert.doesNotMatch(routeSource, new RegExp(`from ['\"]${forbidden.replace(/\//g, '\\/')}['\"]`));
  }
});

test('main entry dispatches course route before lazy-loading the legacy app', () => {
  assert.match(entrySource, /get\('course'\).*'c90'/);
  assert.match(entrySource, /import\('\.\/course\/C90CourseRoute'\)/);
  assert.match(entrySource, /import\('\.\/App'\)/);
});

test('course export is gated on a complete current snapshot and reset remounts local UI state', () => {
  assert.match(routeSource, /courseSessionReadiness/);
  assert.match(routeSource, /restoreCourseSession/);
  assert.match(routeSource, /serializeCourseSession/);
  assert.match(routeSource, /local checkpoint restored/);
  assert.match(routeSource, /const completed = completeCourse\(current\)/);
  assert.match(routeSource, /exportSnapshot\(completed\)/);
  assert.match(routeSource, /snapshot\.activeStage !== 'complete'/);
  assert.match(routeSource, /setExportedBundle\(null\)/);
  assert.match(routeSource, /key=\{`\$\{session\.resetOrdinal\}:\$\{session\.activeStage\}`\}/);
});

test('owned UI keeps the bounded flow, units, claim boundary, and leaf scene shell visible', () => {
  assert.match(panelSource, /data-testid="c90-synchronized-readout"/);
  assert.match(panelSource, /data-testid="e2-rewind"/);
  assert.match(panelSource, /data-testid="e2-freeze-rule"/);
  assert.match(panelSource, /Trace B · \{canUseB \? 'withheld' : 'locked'\}/);
  assert.match(panelSource, /const versions: readonly IoTVersion\[\] = \['baseline', 'learner', 'revision'\]/);
  assert.match(panelSource, /const learnerRule = version === 'learner'/);
  assert.match(panelSource, /const revisedRule = version === 'revision'/);
  assert.match(panelSource, /Your learner rule/);
  assert.equal((panelSource.match(/key: '/g) ?? []).length, 8);
  assert.match(panelSource, /Mbit\/J/);
  assert.match(sceneSource, /BaseSceneLayout/);
  assert.match(sceneSource, /C90_CLAIM_BOUNDARY/);
  assert.doesNotMatch(sceneSource, /MainScene|useSimulation|from ['"]\.\/teaching/);
  assert.match(baseSceneLayoutSource, /NTPUScene/);
  assert.match(styleSource, /grid-template-areas: "left scene right"/);
  assert.match(styleSource, /max-width: 360px/);
  assert.match(styleSource, /\.c90-claim-bar/);
  assert.match(styleSource, /:focus-visible/);
});

test('TLE classroom UI requires a real source path and keeps propagation backstage', () => {
  assert.match(tlePanelSource, /type="file"/);
  assert.match(tlePanelSource, /tle-source-\$\{candidate\.archiveDate\}/);
  assert.match(tlePanelSource, /tle-window-select/);
  assert.match(tlePanelSource, /tle-use-fallback/);
  assert.match(tlePanelSource, /matchImportedTle/);
  assert.match(tlePanelSource, /model-output divergence/);
  assert.match(tlePanelSource, /browser now.*不送入 producer/s);
  assert.match(tlePanelSource, /externalSources\.map/);
  assert.doesNotMatch(`${routeSource}\n${panelSource}\n${tlePanelSource}\n${sceneSource}`, /from ['"]satellite\.js['"]/);
  assert.match(sceneSource, /TLE producer frame/);
  assert.match(routeSource, /setTleTimelineIndex/);
});
