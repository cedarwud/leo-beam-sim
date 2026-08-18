import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SCENE_PRESENTATION_LAYER_IDS,
  SCENE_PRESENTATION_STAGE_IDS,
  isScenePresenterEnabled,
  readScenePresentationStageFromSearch,
  resolveScenePresentationPlan,
  type ScenePresentationLayerId,
} from './scenePresentation';

test('presentation stages reveal layers monotonically and full preserves every layer', () => {
  let previous = new Set<ScenePresentationLayerId>();
  for (const stage of SCENE_PRESENTATION_STAGE_IDS) {
    const plan = resolveScenePresentationPlan(stage);
    const current = new Set(
      SCENE_PRESENTATION_LAYER_IDS.filter(layer => plan.visible[layer]),
    );
    for (const layer of previous) {
      assert.equal(current.has(layer), true, `${stage} dropped ${layer}`);
    }
    previous = current;
  }

  assert.deepEqual(
    SCENE_PRESENTATION_LAYER_IDS.filter(layer => resolveScenePresentationPlan('full').visible[layer]),
    [...SCENE_PRESENTATION_LAYER_IDS],
  );
});

test('stage boundaries keep service and candidate comparison separate', () => {
  const ground = resolveScenePresentationPlan('ground').visible;
  const constellation = resolveScenePresentationPlan('constellation').visible;
  const service = resolveScenePresentationPlan('service').visible;
  const comparison = resolveScenePresentationPlan('comparison').visible;

  assert.equal(ground['serving-footprints'], false);
  assert.equal(ground['selected-satellite'], false);
  assert.equal(constellation['selected-satellite'], true);
  assert.equal(constellation['serving-beams'], false);
  assert.equal(service['serving-beams'], true);
  assert.equal(service['serving-footprints'], true);
  assert.equal(service['candidate-beams'], false);
  assert.equal(comparison['candidate-beams'], true);
  assert.equal(comparison['candidate-footprints'], true);
  assert.equal(comparison['event-effects'], false);
});

test('invalid or absent URL stages fail safely to the existing full scene', () => {
  assert.equal(readScenePresentationStageFromSearch(''), 'full');
  assert.equal(readScenePresentationStageFromSearch('?sceneStage=unknown'), 'full');
  assert.equal(readScenePresentationStageFromSearch('?sceneStage=service'), 'service');
  assert.equal(isScenePresenterEnabled('?scenePresenter=1'), true);
  assert.equal(isScenePresenterEnabled('?scenePresenter=0'), false);
});
