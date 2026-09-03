import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  DEFAULT_SATELLITE_CONSTELLATION,
  SATELLITE_MODEL_CATALOG,
} from './satelliteModelCatalog';

const source = await readFile(new URL('./SatelliteMarker.tsx', import.meta.url), 'utf8');

assert.match(source, /showLabel\?: boolean/);
assert.match(source, /showLabel = true/);
assert.match(source, /\{showLabel && \(/);
assert.match(source, /labelColor\?: string/);
assert.match(source, /labelOutlineColor\?: string/);
assert.match(source, /labelOutlineWidth\?: number/);
assert.match(source, /color=\{labelColor \?\? accent\}/);
assert.match(source, /outlineColor=\{labelOutlineColor\}/);
assert.match(source, /outlineWidth=\{labelOutlineWidth\}/);
assert.match(source, /visible\?: boolean/);
assert.match(source, /visible = true/);
assert.match(source, /<group position=\{position\} visible=\{visible\}>/);
assert.match(source, /const modelInstance = useMemo\(\(\) => cloneSatelliteModel\(scene\), \[scene\]\)/);
assert.match(source, /useLayoutEffect\(\(\) => \{\s*applySatelliteTint\(modelInstance, satelliteTintColor\)/);
assert.doesNotMatch(source, /\}, \[satelliteTintColor, scene\]\)/);
assert.match(source, /satelliteModelForConstellation/);
assert.match(source, /useGLTF\.preload\(SATELLITE_MODEL_CATALOG\.starlink\.path\)/);
assert.doesNotMatch(source, /models\/sat\.glb/);
assert.match(source, /const accent = satelliteTintColor \?\? '#aaccff'/);
assert.doesNotMatch(source, /const accent = eventRole \?/);

assert.equal(DEFAULT_SATELLITE_CONSTELLATION, 'starlink');
assert.deepEqual(SATELLITE_MODEL_CATALOG.starlink, {
  path: '/models/satellite-starlink.glb',
  scale: 0.411,
  rotation: [0.35, 0.6, 0],
  centerOffset: [0.01, 0, -0.307],
});
assert.deepEqual(SATELLITE_MODEL_CATALOG.oneweb, {
  path: '/models/satellite-oneweb.glb',
  scale: 0.336,
  rotation: [0.2, -0.5, 0.1],
  centerOffset: [-1.349, 0.234, 2.092],
});

console.log('satellite marker model catalog and label visibility tests passed');
