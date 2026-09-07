import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const presentationSource = await readFile(new URL('./scenePresentation.ts', import.meta.url), 'utf8');
const mainSceneSource = await readFile(new URL('../MainScene.tsx', import.meta.url), 'utf8');
const baseLayoutSource = await readFile(new URL('../BaseSceneLayout.tsx', import.meta.url), 'utf8');
const groundUeLayerSource = await readFile(new URL('../SceneGroundUeLayer.tsx', import.meta.url), 'utf8');

test('presentation plan stays independent of scientific producers', () => {
  for (const forbiddenImport of [
    'analysis',
    'simulator',
    'tle',
    'useSimulation',
    'handover',
  ]) {
    assert.doesNotMatch(
      presentationSource,
      new RegExp(`from ['\"][^'\"]*${forbiddenImport}`, 'i'),
      `presentation plan imported ${forbiddenImport}`,
    );
  }
});

test('one shared MainScene renderer consumes the plan only as a mount gate', () => {
  assert.match(mainSceneSource, /function ArchivedTleSceneContent\(/);
  assert.match(mainSceneSource, /function SceneRenderContent\(/);
  assert.match(mainSceneSource, /presentationPlan\.visible\[['"]serving-beams['"]\]/);
  assert.match(mainSceneSource, /presentationPlan\.visible\[['"]candidate-beams['"]\]/);
  assert.match(mainSceneSource, /presentationPlan\.visible\[['"]motion-guides['"]\] && !showCellOverlay/);
  assert.match(mainSceneSource, /loadOverlaysVisible: presentationPlan\.visible\[['"]load-overlays['"]\]/);
  assert.match(groundUeLayerSource, /appearance\.beamLoadContentionEnabled/);
  assert.match(mainSceneSource, /eventEffectsVisible: presentationPlan\.visible\[['"]event-effects['"]\]/);
  assert.match(groundUeLayerSource, /ue\.isOtherHandover === true/);
  assert.doesNotMatch(mainSceneSource, /<HomepageTleSceneContent\b/);
  assert.match(baseLayoutSource, /campusVisible && \(/);
});
