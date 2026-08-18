#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  clearScientificExplanationArtifactRequestCacheForTest,
  loadScientificExplanationArtifact,
  SCIENTIFIC_EXPLANATION_ARTIFACT_URL,
  scientificExplanationArtifactRefusal,
} from './scientificExplanationArtifactLoader';

const artifactText = readFileSync(
  new URL('../../../public/explain/accepted-scientific-demo-v1.json', import.meta.url),
  'utf8',
);
let fetchCount = 0;
const fetcher = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  fetchCount += 1;
  assert.equal(input, SCIENTIFIC_EXPLANATION_ARTIFACT_URL);
  assert.equal(init?.cache, 'no-cache', 'artifact fetch must revalidate after schema/content updates');
  return new Response(artifactText, { status: 200 });
};

clearScientificExplanationArtifactRequestCacheForTest();
const first = await loadScientificExplanationArtifact(SCIENTIFIC_EXPLANATION_ARTIFACT_URL, fetcher);
const second = await loadScientificExplanationArtifact(SCIENTIFIC_EXPLANATION_ARTIFACT_URL, fetcher);
assert.equal(first, second);
assert.equal(fetchCount, 1);
assert.equal(first.status, 'available');
assert.equal(first.artifact.stories.angleResponse.fixtureId, 'angle-response-v1');

clearScientificExplanationArtifactRequestCacheForTest();
await assert.rejects(
  loadScientificExplanationArtifact(SCIENTIFIC_EXPLANATION_ARTIFACT_URL, async () => new Response('{}', { status: 200 })),
  /schema mismatch/,
);
assert.match(scientificExplanationArtifactRefusal(new Error('artifact missing')).recovery, /離線重建/);

console.log('Scientific explanation artifact loader tests passed');
