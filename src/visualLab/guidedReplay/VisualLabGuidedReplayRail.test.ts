import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./VisualLabGuidedReplayRail.tsx', import.meta.url), 'utf8');

assert.match(source, /aria-busy=\{busy\}/);
assert.match(source, /data-guided-prepared=\{String\(prepared\)\}/);
assert.match(source, /data-guided-status=\{guidedStatus\}/);
assert.match(source, /尚未準備真實來源/);
assert.match(source, /Real source not ready/);
assert.match(source, /準備真實 A／B/);
assert.match(source, /Preparing real A\/B/);
assert.match(source, /copy\.replay/);

console.log('visual-lab guided replay exposes immediate preparation state');
