import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  createVisualLabGlobalConstellationStore,
  type VisualLabGlobalConstellationArtifact,
} from './index';
import { parseVisualLabGlobalConstellationArtifact } from './visualLabGlobalConstellationArtifact';
import { LATEST_TLE_REFERENCE_ARTIFACT_DATE } from '../../tle/latestTleDefaults';

async function fixture(constellation: 'oneweb' | 'starlink'): Promise<VisualLabGlobalConstellationArtifact> {
  const raw = JSON.parse(await readFile(`public/global-first-frame/${constellation}-${LATEST_TLE_REFERENCE_ARTIFACT_DATE}.json`, 'utf8')) as unknown;
  return parseVisualLabGlobalConstellationArtifact(raw, { expectedConstellation: constellation });
}

const starlink = await fixture('starlink');
let requests = 0;
const states: string[] = [];
const store = createVisualLabGlobalConstellationStore({
  fetcher: async (_input, _init) => {
    requests += 1;
    return new Response(JSON.stringify(starlink), { status: 200 });
  },
});
const unsubscribe = store.subscribe((state) => states.push(`${state.constellation}:${state.status}`));

assert.equal(store.peek('starlink'), null);
assert.equal(store.state('starlink').status, 'idle');
const first = await store.load('starlink');
assert.equal(first.status, 'ready');
if (first.status !== 'ready') throw new Error('first artifact did not become ready');
assert.equal(first.cacheHit, false);
assert.equal(first.artifact.constellation, 'starlink');
assert.deepEqual(store.peek('starlink'), starlink);
assert.deepEqual(states.slice(0, 2), ['starlink:loading', 'starlink:ready']);
assert.equal(requests, 1);

const cached = await store.load('starlink');
assert.equal(cached.status, 'ready');
if (cached.status !== 'ready') throw new Error('cached artifact did not remain ready');
assert.equal(cached.cacheHit, true);
assert.equal(requests, 1);

let concurrentRequests = 0;
const concurrentStore = createVisualLabGlobalConstellationStore({
  fetcher: async () => {
    concurrentRequests += 1;
    await new Promise(resolve => setTimeout(resolve, 0));
    return new Response(JSON.stringify(starlink), { status: 200 });
  },
});
const concurrentA = concurrentStore.load('starlink');
const concurrentB = concurrentStore.load('starlink');
assert.equal(concurrentA, concurrentB);
await concurrentA;
assert.equal(concurrentRequests, 1);

store.invalidate('starlink');
assert.equal(store.peek('starlink'), null);
assert.equal(store.state('starlink').status, 'idle');

const badStore = createVisualLabGlobalConstellationStore({
  fetcher: async () => new Response(JSON.stringify({ ...starlink, constellation: 'oneweb' }), { status: 200 }),
});
const bad = await badStore.load('starlink');
assert.equal(bad.status, 'error');
if (bad.status !== 'error') throw new Error('invalid artifact did not fail closed');
assert.match(bad.error, /constellation/);
assert.equal(badStore.peek('starlink'), null);
assert.equal(badStore.peek('oneweb'), null);

unsubscribe();
console.log('visual-lab global constellation cache/store passed');
