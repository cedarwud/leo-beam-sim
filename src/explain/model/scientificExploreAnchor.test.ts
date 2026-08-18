#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST,
  createScientificExploreAnchor,
  parseScientificExplanationArtifact,
} from './index';

function value(term: { readonly status: string; readonly value?: number }, label: string): number {
  assert.equal(term.status, 'available', `${label} must be available`);
  assert.equal(typeof term.value, 'number', `${label} must be numeric`);
  return term.value!;
}

const artifactUrl = new URL('../../../public/explain/accepted-scientific-demo-v1.json', import.meta.url);
const artifact = parseScientificExplanationArtifact(
  JSON.parse(readFileSync(artifactUrl, 'utf8')) as unknown,
  ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST,
);
const source = artifact.stories.angleResponse.reference;
const anchor = createScientificExploreAnchor(source);

assert.equal(anchor.sourceFrameId, source.frameId);
assert.equal(anchor.selectedSatelliteId, source.selectedSatelliteId);
assert.deepEqual(anchor.identity, source.identity);
assert.equal(anchor.reference.sourceFrameId, source.frameId);
assert.ok(anchor.pathLimitKm > 0);

for (const term of ['theta', 'transmitGain', 'rawH', 'pReqUser', 'sinr', 'representativeRate', 'eeInst'] as const) {
  assert.ok(Math.abs(value(anchor.reference.terms[term], `reference.${term}`)
    - value(source.terms[term], `accepted.${term}`)) <= Math.max(
    1e-12,
    Math.abs(value(source.terms[term], `accepted.${term}`)) * 1e-9,
  ));
}

const centre = anchor.buildAtRadialOffsetKm(0);
const edge = anchor.buildAtRadialOffsetKm(anchor.pathLimitKm);
const stressed = anchor.build({
  radialOffsetKm: anchor.pathLimitKm,
  parameterOverrides: {
    theta3dbRad: anchor.referenceParameters.theta3dbRad * 0.6,
    minimumRateBps: anchor.referenceParameters.minimumRateBps * 8,
  },
});
assert.equal(centre.identity.userId, source.identity.userId);
assert.equal(edge.identity.beamId, source.identity.beamId);
assert.equal(centre.instantUtc, edge.instantUtc);
assert.notEqual(centre.frameId, edge.frameId);
assert.notEqual(value(centre.terms.theta, 'centre.theta'), value(edge.terms.theta, 'edge.theta'));
assert.notEqual(value(centre.terms.transmitGain, 'centre.transmitGain'), value(edge.terms.transmitGain, 'edge.transmitGain'));
assert.notEqual(value(centre.terms.sinr, 'centre.sinr'), value(edge.terms.sinr, 'edge.sinr'));
assert.notEqual(value(stressed.terms.gammaReq, 'stressed.gammaReq'), value(edge.terms.gammaReq, 'edge.gammaReq'));
assert.notEqual(value(stressed.terms.transmitGain, 'stressed.transmitGain'), value(edge.terms.transmitGain, 'edge.transmitGain'));
assert.throws(() => anchor.buildAtRadialOffsetKm(anchor.pathLimitKm + 0.1), /must stay within/);

console.log('Scientific fixed-anchor UE Explore tests passed');
