import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  loadVisualLabGlobalConstellationArtifact,
  parseVisualLabGlobalConstellationArtifact,
  VISUAL_LAB_GLOBAL_CONSTELLATION_ARTIFACT_URLS,
  VISUAL_LAB_GLOBAL_CONSTELLATION_ARCHIVE_DATES,
  VISUAL_LAB_GLOBAL_CONSTELLATION_INSTANT_UTC,
  type VisualLabGlobalConstellationArtifact,
} from './visualLabGlobalConstellationArtifact';

async function readArtifact(constellation: 'oneweb' | 'starlink'): Promise<VisualLabGlobalConstellationArtifact> {
  const raw = JSON.parse(
    await readFile(`public/global-first-frame/${constellation}-20260825.json`, 'utf8'),
  ) as unknown;
  return parseVisualLabGlobalConstellationArtifact(raw, { expectedConstellation: constellation });
}

const starlink = await readArtifact('starlink');
const oneweb = await readArtifact('oneweb');

for (const artifact of [starlink, oneweb]) {
  assert.equal(artifact.instantUtc, VISUAL_LAB_GLOBAL_CONSTELLATION_INSTANT_UTC);
  assert.equal(artifact.satelliteIds.length, artifact.satelliteCount);
  assert.equal(artifact.positionsWorld.length, artifact.satelliteCount * 3);
  assert.equal(artifact.visibility.length, artifact.satelliteCount);
  assert.equal(artifact.visibility.reduce((sum, value) => sum + value, 0), artifact.ntpuVisibleSatelliteCount);
  assert.ok(artifact.ntpuVisibleSatelliteCount > 0);
  assert.ok(Object.isFrozen(artifact));
}

assert.ok(starlink.satelliteCount > oneweb.satelliteCount * 5);
assert.ok(oneweb.medianAltitudeKm > starlink.medianAltitudeKm + 400);

const loaderStarlink = await loadVisualLabGlobalConstellationArtifact(
  VISUAL_LAB_GLOBAL_CONSTELLATION_ARTIFACT_URLS.starlink,
  {
    fetcher: async () => new Response(JSON.stringify(starlink), { status: 200 }),
  },
);
assert.equal(loaderStarlink.satelliteCount, starlink.satelliteCount);

function expectReject(mutator: (artifact: VisualLabGlobalConstellationArtifact) => unknown): void {
  assert.throws(() => parseVisualLabGlobalConstellationArtifact(mutator(starlink), {
    expectedConstellation: 'starlink',
  }));
}

expectReject(artifact => ({ ...artifact, sourceKind: 'SYNTHETIC' }));
expectReject(artifact => ({ ...artifact, instantUtc: '2026-08-25T12:00:01.000Z' }));
expectReject(artifact => ({ ...artifact, snapshotPath: `/tle-archive/oneweb/oneweb_${VISUAL_LAB_GLOBAL_CONSTELLATION_ARCHIVE_DATES.oneweb}.tle` }));
expectReject(artifact => ({ ...artifact, satelliteIds: [...artifact.satelliteIds.slice(0, -1), artifact.satelliteIds[0]] }));
expectReject(artifact => ({ ...artifact, positionsWorld: artifact.positionsWorld.slice(0, -1) }));
expectReject(artifact => ({ ...artifact, visibility: [...artifact.visibility.slice(0, -1), 2] }));

console.log('visual-lab global constellation artifact loader is strict and source-bound');
