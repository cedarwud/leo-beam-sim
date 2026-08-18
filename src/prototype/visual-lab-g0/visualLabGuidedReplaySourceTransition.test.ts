import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./useVisualLabGuidedReplay.ts', import.meta.url), 'utf8');

const base: {
  readonly open: boolean;
  readonly trackedSource: string | null;
  readonly currentSource: string | null;
} = {
  open: true,
  trackedSource: 'oneweb:frame-a',
  currentSource: 'oneweb:frame-b',
};

assert.match(source, /export function guidedReplayShouldCloseForSourceChange\(/);
assert.match(source, /if \(!input\.open \|\| input\.trackedSource === null \|\| input\.currentSource === input\.trackedSource\)/);
assert.match(source, /return !input\.replayOwnsTransition;/);
assert.match(source, /const replayOwnsTransition = replaySourceTransitionRef\.current === revisionRef\.current;/);
assert.match(source, /replaySourceTransitionRef\.current = revision;/);
assert.match(source, /sourceRef\.current = visualLabReplaySourceIdentity\(session\.snapshot\(\)\);[\s\S]{0,180}replaySourceTransitionRef\.current = null;/);
assert.match(source, /const prepareIntraBeamTrace = useCallback/);
assert.match(source, /beamIlluminationMode: 'beam-hopping'/);
assert.match(source, /const restoreOriginalFrameOptions = useCallback/);
assert.match(source, /await restoreOriginalFrameOptions\(\);/);
assert.match(source, /visualLabCausalComparisonReady\(candidateSnapshot\)/);
assert.match(source, /visualLabCausalComparisonReady\(session\.snapshot\(\)\)/);
assert.match(source, /visualLabAcceptedReplayEvidenceReady\(restartedSnapshot\)/);
assert.match(source, /restartedSnapshot\.comparison\.classification !== 'identical'/);

// Keep the expected decision table executable without importing the hook (the
// hook imports a browser-only Three.js stylesheet).  The implementation above
// must have the same fail-closed boundary: only an owned transition is ignored.
const shouldClose = (input: typeof base & { replayOwnsTransition: boolean }): boolean => (
  input.open
  && input.trackedSource !== null
  && input.currentSource !== input.trackedSource
  && !input.replayOwnsTransition
);
assert.equal(shouldClose({ ...base, replayOwnsTransition: true }), false, 'owned A/B publication is acknowledged');
assert.equal(shouldClose({ ...base, replayOwnsTransition: false }), true, 'external source change closes replay');
assert.equal(shouldClose({ ...base, currentSource: base.trackedSource, replayOwnsTransition: false }), false, 'unchanged source stays open');
assert.equal(shouldClose({ ...base, open: false, replayOwnsTransition: false }), false, 'closed replay ignores source changes');
assert.equal(shouldClose({ ...base, trackedSource: null, replayOwnsTransition: false }), false, 'missing initial source is not external change');

console.log('visual-lab guided replay source-transition lifecycle tests passed');
