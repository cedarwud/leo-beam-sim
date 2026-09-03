import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');

test('homepage routes playback intent through the extracted transport', () => {
  assert.match(appSource, /import \{ useHomepagePlaybackTransport \} from '\.\/homepage\/controller\/useHomepagePlaybackTransport';/);
  assert.match(appSource, /const legacyPlayback = usePlaybackControls\(/);
  assert.match(appSource, /const homepagePlayback = useHomepagePlaybackTransport\(/);
  assert.match(appSource, /const playback = isRootHomepage \? homepagePlayback : legacyPlayback;/);
});

test('homepage seek is acknowledged by the transport before the canonical source seek', () => {
  assert.match(appSource, /const transportTarget = isRootHomepage[\s\S]*homepagePlayback\.requestSeek\(target\)/);
  assert.match(appSource, /requestLiveTimelineSeek\(\{[\s\S]*targetSec: absoluteTargetSec/);
});
