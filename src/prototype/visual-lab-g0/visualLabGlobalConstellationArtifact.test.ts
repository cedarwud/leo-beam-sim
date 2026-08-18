import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

type Artifact = {
  readonly schema: string;
  readonly constellation: 'starlink' | 'oneweb';
  readonly instantUtc: string;
  readonly snapshotPath: string;
  readonly satelliteCount: number;
  readonly ntpuVisibleSatelliteCount: number;
  readonly medianAltitudeKm: number;
  readonly satelliteIds: readonly string[];
  readonly positionsWorld: readonly number[];
  readonly visibility: readonly number[];
};

async function load(name: string): Promise<Artifact> {
  return JSON.parse(await readFile(`public/global-first-frame/${name}-20260812.json`, 'utf8')) as Artifact;
}

const starlink = await load('starlink');
const oneweb = await load('oneweb');

for (const artifact of [starlink, oneweb]) {
  assert.equal(artifact.schema, 'visual-lab-global-constellation-artifact-v1');
  assert.equal(artifact.instantUtc, '2026-08-12T12:00:00.000Z');
  assert.match(artifact.snapshotPath, new RegExp(`/tle-archive/${artifact.constellation}/${artifact.constellation}_20260812\\.tle$`));
  assert.equal(artifact.satelliteIds.length, artifact.satelliteCount);
  assert.equal(artifact.positionsWorld.length, artifact.satelliteCount * 3);
  assert.equal(artifact.visibility.length, artifact.satelliteCount);
  assert.ok(artifact.ntpuVisibleSatelliteCount > 0);
  assert.ok(artifact.medianAltitudeKm > 0);
  assert.doesNotMatch(JSON.stringify(artifact), /mock|fake|placeholder/i);
}

assert.ok(starlink.satelliteCount > oneweb.satelliteCount * 5, 'the default global view must retain the real constellation-density contrast');
assert.ok(oneweb.medianAltitudeKm > starlink.medianAltitudeKm + 400, 'the default global view must retain the real orbit-shell altitude contrast');

console.log('visual-lab global constellation artifacts preserve the real Starlink/OneWeb contrast');
