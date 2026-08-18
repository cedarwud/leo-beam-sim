import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { TimelineBar } from './TimelineBar';

const baseProps = {
  currentTimeSec: 60,
  durationSec: 7200,
  paused: true,
  speed: 1,
  onTogglePause: () => undefined,
  onSeek: () => undefined,
  onSpeedChange: () => undefined,
  sourceOwner: 'tle-run',
  horizonKind: 'archived-tle-run',
  horizonLabel: 'Archived TLE run',
  horizonSec: 7200,
  claimKind: 'run-bundle',
} as const;

const defaultMarkup = renderToStaticMarkup(<TimelineBar {...baseProps} />);
const anchorMarkup = renderToStaticMarkup(<TimelineBar {...baseProps} stepSec={30} />);
const fineScrubMarkup = renderToStaticMarkup(
  <TimelineBar {...baseProps} stepSec={30} scrubStepSec={1} />,
);
const lockedAnchorMarkup = renderToStaticMarkup(
  <TimelineBar {...baseProps} stepSec={30} paused={false} disabled />,
);

assert.match(defaultMarkup, /aria-label="Step backward 10 seconds"/);
assert.match(defaultMarkup, /aria-label="Step forward 10 seconds"/);
assert.match(defaultMarkup, /aria-label="Timeline scrubber \(10-second steps\)"/);
assert.match(defaultMarkup, /<input[^>]*type="range"[^>]*step="10"[^>]*>/);

assert.match(anchorMarkup, /aria-label="Step backward 30 seconds"/);
assert.match(anchorMarkup, /aria-label="Step forward 30 seconds"/);
assert.match(anchorMarkup, /aria-label="Timeline scrubber \(30-second steps\)"/);
assert.match(anchorMarkup, /<input[^>]*type="range"[^>]*step="30"[^>]*>/);

assert.match(fineScrubMarkup, /aria-label="Step backward 30 seconds"/);
assert.match(fineScrubMarkup, /aria-label="Step forward 30 seconds"/);
assert.match(fineScrubMarkup, /aria-label="Timeline scrubber \(1-second steps\)"/);
assert.match(fineScrubMarkup, /<input[^>]*type="range"[^>]*step="1"[^>]*>/);

assert.match(lockedAnchorMarkup, /data-testid="timeline-bar"[^>]*data-disabled="true"/);
assert.match(lockedAnchorMarkup, /data-testid="timeline-jump-start"[^>]*disabled/);
assert.match(lockedAnchorMarkup, /data-testid="timeline-step-backward"[^>]*disabled/);
assert.match(lockedAnchorMarkup, /data-testid="timeline-toggle-play"[^>]*disabled/);
assert.match(lockedAnchorMarkup, /data-testid="timeline-step-forward"[^>]*disabled/);
assert.match(lockedAnchorMarkup, /data-testid="timeline-jump-end"[^>]*disabled/);
assert.match(lockedAnchorMarkup, /data-testid="timeline-speed-5x"[^>]*disabled/);
assert.match(lockedAnchorMarkup, /data-testid="timeline-scrubber"[^>]*disabled/);

const source = readFileSync(fileURLToPath(new URL('./TimelineBar.tsx', import.meta.url)), 'utf8');
assert.match(source, /event\.key === 'ArrowLeft'[\s\S]*?seekTo\(safeCurrentTimeSec - safeStepSec\)/);
assert.match(source, /event\.key === 'ArrowRight'[\s\S]*?seekTo\(safeCurrentTimeSec \+ safeStepSec\)/);
assert.match(source, /event\.key === 'PageDown'[\s\S]*?seekTo\(safeCurrentTimeSec - safeStepSec\)/);
assert.match(source, /event\.key === 'PageUp'[\s\S]*?seekTo\(safeCurrentTimeSec \+ safeStepSec\)/);

console.log('TimelineBar supports 30-second TLE anchors and locks every transport while the run is incomplete.');
