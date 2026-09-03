import assert from 'node:assert/strict';
import test from 'node:test';
import {
  resolveHomepageSceneGeometryPolicy,
  type HomepageSceneGeometryPolicyInput,
} from './homepageSceneGeometryPolicy';

const baseInput: HomepageSceneGeometryPolicyInput = {
  homepageVisualIdentity: true,
  candidateReviewActive: false,
  authorityTransitionActive: false,
  presentationActive: false,
  presentationSource: null,
  presentationKind: null,
  presentationMode: 'idle',
  naturalPulseAvailable: false,
};

test('homepage steady state keeps only the configured serving field', () => {
  const policy = resolveHomepageSceneGeometryPolicy(baseInput);
  assert.equal(policy.owner, 'steady');
  assert.equal(policy.renderServingField, true);
  assert.equal(policy.renderCandidateField, false);
  assert.equal(policy.renderNaturalPulse, false);
  assert.equal(policy.renderCinemaPair, false);
  assert.equal(policy.renderAuthorityPair, false);
});

test('candidate review keeps the serving fan but delegates candidate geometry to the accepted scene projection', () => {
  const policy = resolveHomepageSceneGeometryPolicy({
    ...baseInput,
    candidateReviewActive: true,
  });
  assert.equal(policy.owner, 'candidate-review');
  assert.equal(policy.renderServingField, true);
  assert.equal(policy.renderCandidateField, false);
  assert.equal(policy.renderNaturalPulse, false);
});

test('a natural intra presentation keeps the serving fan beside its pair owner', () => {
  const policy = resolveHomepageSceneGeometryPolicy({
    ...baseInput,
    presentationActive: true,
    presentationSource: 'walker',
    presentationKind: 'intra',
    presentationMode: 'presenting',
  });
  assert.equal(policy.owner, 'handover-pair');
  assert.equal(policy.renderServingField, true);
  assert.equal(policy.renderCandidateField, false);
  assert.equal(policy.renderNaturalPulse, false);
  assert.equal(policy.renderTriggeredIntra, false);
  assert.equal(policy.renderCinemaPair, true);
  assert.equal(policy.renderAuthorityPair, false);
});

test('an accepted inter presentation keeps the serving fan beside its source-target pair', () => {
  const policy = resolveHomepageSceneGeometryPolicy({
    ...baseInput,
    presentationActive: true,
    presentationSource: 'walker',
    presentationKind: 'inter',
    presentationMode: 'presenting',
  });
  assert.equal(policy.owner, 'handover-pair');
  assert.equal(policy.renderServingField, true);
  assert.equal(policy.renderCandidateField, false);
  assert.equal(policy.renderNaturalPulse, false);
  assert.equal(policy.renderTriggeredIntra, false);
  assert.equal(policy.renderCinemaPair, true);
  assert.equal(policy.renderAuthorityPair, false);
});

test('manual intra keeps the established triggered pair and suppresses duplicate pair layers', () => {
  const policy = resolveHomepageSceneGeometryPolicy({
    ...baseInput,
    presentationActive: true,
    presentationSource: 'manual',
    presentationKind: 'intra',
    presentationMode: 'presenting',
  });
  assert.equal(policy.owner, 'handover-pair');
  assert.equal(policy.renderServingField, true);
  assert.equal(policy.renderTriggeredIntra, true);
  assert.equal(policy.renderCinemaPair, false);
  assert.equal(policy.renderNaturalPulse, false);
});

test('authority transition keeps the serving fan while its pair owns source and target', () => {
  const policy = resolveHomepageSceneGeometryPolicy({
    ...baseInput,
    authorityTransitionActive: true,
    presentationActive: true,
    presentationSource: 'walker',
    presentationKind: 'inter',
    presentationMode: 'presenting',
  });
  assert.equal(policy.owner, 'authority-pair');
  assert.equal(policy.renderServingField, true);
  assert.equal(policy.renderCinemaPair, false);
  assert.equal(policy.renderAuthorityPair, true);
});

test('a retained pulse cannot repaint during presentation cooldown', () => {
  const policy = resolveHomepageSceneGeometryPolicy({
    ...baseInput,
    naturalPulseAvailable: true,
    presentationMode: 'cooldown',
  });
  assert.equal(policy.owner, 'steady');
  assert.equal(policy.renderServingField, true);
  assert.equal(policy.renderNaturalPulse, false);
});

test('non-homepage lanes retain their legacy geometry defaults', () => {
  const policy = resolveHomepageSceneGeometryPolicy({
    ...baseInput,
    homepageVisualIdentity: false,
    candidateReviewActive: true,
    authorityTransitionActive: true,
    presentationActive: true,
    presentationSource: 'walker',
    presentationKind: 'inter',
    presentationMode: 'presenting',
    naturalPulseAvailable: true,
  });
  assert.deepEqual(policy, {
    owner: 'legacy',
    renderServingField: true,
    renderCandidateField: true,
    renderNaturalPulse: true,
    renderTriggeredIntra: true,
    renderCinemaPair: true,
    renderAuthorityPair: true,
  });
});
