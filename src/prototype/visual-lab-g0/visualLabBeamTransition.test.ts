import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./VisualLabBeamCone.tsx', import.meta.url), 'utf8');

assert.match(source, /function AnimatedBeamMaterial/);
assert.match(source, /material\.color\.lerp\(targetColorRef\.current, blend\)/);
assert.match(source, /THREE\.MathUtils\.lerp\(material\.opacity, targetOpacityRef\.current, blend\)/);
assert.match(source, /1 - Math\.exp\(/, 'beam transitions use frame-rate-independent damping');
assert.doesNotMatch(source, /<meshBasicMaterial[^>]*color=\{style\.color\}/s, 'the cone material does not jump directly to a new replay color');

console.log('visual-lab beam cone fades color and opacity between replay states');
