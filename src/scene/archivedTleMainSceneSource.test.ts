import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./MainScene.tsx', import.meta.url), 'utf8');

assert.doesNotMatch(
  source,
  /import\s+\{\s*HomepageTleSceneContent\s*\}/,
  'the homepage must not import the retired parallel TLE renderer',
);
assert.doesNotMatch(
  source,
  /<HomepageTleSceneContent\b/,
  'the homepage must not mount the retired parallel TLE renderer',
);

const liveStart = source.indexOf('function SceneContent(');
const archivedStart = source.indexOf('function ArchivedTleSceneContent(');
const renderStart = source.indexOf('function SceneRenderContent(');
assert.ok(liveStart >= 0 && archivedStart > liveStart && renderStart > archivedStart);

const liveWrapper = source.slice(liveStart, archivedStart);
const archivedWrapper = source.slice(archivedStart, renderStart);
const sharedRenderer = source.slice(renderStart, source.indexOf('interface MainSceneProps'));

assert.match(liveWrapper, /useSimulation\(/, 'only the live source wrapper owns Walker simulation');
assert.doesNotMatch(
  liveWrapper,
  /\bactive\b/,
  'the Walker wrapper must not implement a dormant mounted state',
);
assert.match(liveWrapper, /<SceneRenderContent[^>]*simSource="live"/s);
assert.doesNotMatch(
  archivedWrapper,
  /useSimulation\(/,
  'the archived-TLE source wrapper must not mount a hidden Walker simulation',
);
assert.match(archivedWrapper, /adaptSimulationAnalysisFrameToArchivedTleSimFrame/);
assert.match(archivedWrapper, /<SceneRenderContent/);
assert.match(archivedWrapper, /simSource="archived-tle"/);
assert.match(archivedWrapper, /canonicalHandoverEvent=\{frame\.handover\}/);
assert.match(archivedWrapper, /archivedTleFrameIdentity=\{frame\}/);

assert.match(
  sharedRenderer,
  /sceneSource=\{sceneFrame\.sceneSource\}/,
  'the shared canvas telemetry must read the normalized source discriminator',
);
assert.match(sharedRenderer, /sceneSource: 'archived-tle' as const/);
assert.match(sharedRenderer, /status: 'accepted-immutable-frame' as const/);
assert.match(
  sharedRenderer,
  /liveSimToScene\(sim, sceneGeometry, \{\s*source: simSource === 'archived-tle' \? 'archived-tle' : 'walker'/,
  'the normalized projection seam must receive an explicit producer identity',
);

for (const originalRenderer of [
  'BaseSceneLayout',
  'GroundScene',
  'HandoverLinks',
  'SatelliteMarker',
  'SinrLiveCellBeamCones',
  'SinrLiveCellFootprintRings',
  'OrbitTrail',
  'SpineParticles',
  'ServingGroundRipple',
  'HandoverToastOverlay',
]) {
  assert.match(
    sharedRenderer,
    new RegExp(`<${originalRenderer}\\b`),
    `the shared renderer must retain ${originalRenderer}`,
  );
}

assert.match(source, /<ArchivedTleSceneContent/);
assert.match(source, /data-scene-source=\{homepageTleSceneActive\s*\? 'archived-tle'/);
assert.match(source, /simulationSource === 'archived-tle'/);
assert.doesNotMatch(source, /canonicalAnalysisFrame !== undefined/);
assert.match(
  source,
  /\) : homepageTleSceneActive \? \(\s*<ArchivedTleSceneContent[\s\S]*?\) : \(\s*<SceneContent/,
  'only the explicitly selected scientific producer may be mounted',
);
assert.match(
  sharedRenderer,
  /enabled: simSource === 'live'/,
  'archived TLE must fail closed before the legacy cell scheduler',
);

console.log('archived TLE MainScene source contract tests passed');
