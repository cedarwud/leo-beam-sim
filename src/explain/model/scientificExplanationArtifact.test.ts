#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST,
  parseScientificExplanationArtifact,
} from './index';

const artifactUrl = new URL('../../../public/explain/accepted-scientific-demo-v1.json', import.meta.url);
const raw = JSON.parse(readFileSync(artifactUrl, 'utf8')) as unknown;
const artifact = parseScientificExplanationArtifact(raw, ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST);

assert.equal(artifact.source.geometryRunId, ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST.source.geometryRunId);
assert.equal(artifact.stories.angleResponse.reference.frameId,
  ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST.fixtures.angleResponse.referenceFrameId);
assert.equal(artifact.stories.angleResponse.probe.frameId,
  ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST.fixtures.angleResponse.probeFrameId);
assert.equal(artifact.stories.serviceTargetStress.reference.frameId,
  ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST.fixtures.serviceTargetStress.referenceFrameId);
assert.equal(artifact.stories.serviceTargetStress.probe.frameId,
  ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST.fixtures.serviceTargetStress.probeFrameId);
assert.equal(artifact.stories.servingChange.before.frameId,
  ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST.fixtures.servingChange.beforeFrameId);
assert.equal(artifact.stories.servingChange.decision.frameId,
  ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST.fixtures.servingChange.decisionFrameId);
assert.equal(artifact.stories.servingChange.after.frameId,
  ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST.fixtures.servingChange.afterFrameId);

for (const member of ['reference', 'probe'] as const) {
  const point = artifact.stories.angleResponse[member];
  for (const term of ['theta', 'transmitGain', 'actualBeamRf', 'totalRate', 'systemPower', 'eeInst'] as const) {
    assert.equal(point.terms[term]?.status, 'available', `${member}.${term} must be precomputed`);
  }
  assert.equal(point.terms.eeEval.status, 'unavailable');
  assert.match(point.terms.eeEval.status === 'unavailable' ? point.terms.eeEval.reason : '', /frame-scoped controlled comparison/);
  assert.equal(artifact.stories.serviceTargetStress[member].terms.eeEval.status, 'unavailable');
}

assert.equal(artifact.stories.angleResponse.eeEval.status, 'excluded');
assert.equal(artifact.stories.serviceTargetStress.eeEval.status, 'excluded');
assert.equal(artifact.stories.methodState.terms.eeEval.status, 'available');

const event = artifact.stories.servingChange.eventEvidence;
assert.equal(event.eventId, artifact.stories.servingChange.eventId);
assert.equal(event.fromSatelliteId, artifact.stories.servingChange.fromSatelliteId);
assert.equal(event.toSatelliteId, artifact.stories.servingChange.toSatelliteId);
assert.equal(event.targetSelection.satelliteId, artifact.stories.servingChange.toSatelliteId);
assert.ok(event.traceDigest.length > 0);

const corrupted = structuredClone(raw) as {
  stories: { servingChange: { eventEvidence: { toSatelliteId: string } } };
};
corrupted.stories.servingChange.eventEvidence.toSatelliteId = 'corrupted-satellite';
assert.throws(
  () => parseScientificExplanationArtifact(corrupted, ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST),
  /event evidence identity mismatch/,
);

console.log('Scientific explanation precomputed artifact tests passed');
