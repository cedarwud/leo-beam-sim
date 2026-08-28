import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('./MainScene.tsx', import.meta.url), 'utf8');
const railSource = await readFile(
  new URL('../ui/handover-evaluation/HandoverEvaluationPanel.tsx', import.meta.url),
  'utf8',
);
const sharedPlanSource = await readFile(
  new URL('../ui/handover-evaluation/useHomepageCandidatePresentationPlan.ts', import.meta.url),
  'utf8',
);

test('MainScene mounts the bounded multi-candidate presentation from the authoritative decision frame', () => {
  assert.match(source, /useHomepageCandidatePresentationPlan\(\s*['"]scene['"]/);
  assert.match(sharedPlanSource, /buildCandidatePresentationPlan\(decision/);
  assert.match(source, /buildMultiCandidateScenePresentation\(handoverCandidatePresentationPlan\)/);
  assert.match(source, /<MultiCandidateBeamScene[\s\S]*presentation=\{multiCandidateScenePresentation\}/);
  assert.match(source, /onCandidateSelect=\{toggleInspectedCandidateKey\}/);
});

test('candidate authority supersedes legacy role-colour links and beam layers', () => {
  assert.match(
    source,
    /showLiveSceneEffects\s*&& !multiCandidateAuthorityActive[\s\S]*<HandoverLinks/,
  );
  assert.match(
    source,
    /!multiCandidateAuthorityActive && presentationPlan\.visible\['serving-beams'\][\s\S]*<SinrLiveCellBeamCones/,
  );
  assert.match(
    source,
    /!multiCandidateAuthorityActive && presentationPlan\.visible\['candidate-beams'\][\s\S]*<SinrLiveCellBeamCones/,
  );
  assert.match(
    source,
    /satelliteTintColor=\{multiCandidateAuthorityActive \? undefined : sat\.satelliteTintColor\}/,
  );
});

test('multi-candidate camera holds through ordinary motion and reframes only at a safe-frame edge', () => {
  assert.match(
    source,
    /areMultiCandidateFocusPointsWithinSafeFrame\(\{/,
  );
  assert.match(
    source,
    /!compositionChanged && focusStillContained\) return/,
  );
  assert.match(
    source,
    /kind: 'multi-candidate-refit'/,
  );
  assert.match(
    source,
    /durationMs: MULTI_CANDIDATE_REFRAME_DURATION_MS/,
  );
  assert.match(
    source,
    /multiCandidateCameraFitKeyRef\.current = multiCandidateCameraFitKey/,
  );
  assert.match(
    source,
    /multiCandidateCameraUserControlledRef\.current = true/,
  );
});

test('scene and right rail consume one route-scoped candidate identity allocation', () => {
  assert.match(source, /useHomepageCandidatePresentationPlan\(\s*['"]scene['"]/);
  assert.match(railSource, /useHomepageCandidatePresentationPlan\(\s*['"]rail['"]/);
  assert.doesNotMatch(source, /multiCandidateIdentityRef/);
  assert.doesNotMatch(railSource, /previousIdentityAllocation/);
  assert.match(railSource, /data-satellite-identity-colors=/);
});
