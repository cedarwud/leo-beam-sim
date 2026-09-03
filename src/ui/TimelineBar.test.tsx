import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TimelineBar, type TimelineEventMarker } from './TimelineBar';

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

const eventMarkers: readonly TimelineEventMarker[] = [
  {
    id: 'intra-early',
    kind: 'intra',
    sourceTimeSec: 120.125,
    clickTargetSec: 118.25,
    ariaLabel: 'Seek to intra event at 2 minutes',
    title: 'Intra event · source 120.125 seconds',
  },
  {
    id: 'inter-late',
    kind: 'inter',
    sourceTimeSec: 3600.5,
    clickTargetSec: 3590.25,
    ariaLabel: 'Seek to inter event at 1 hour',
    title: 'Inter event · source 3600.5 seconds',
  },
];

const defaultMarkup = renderToStaticMarkup(<TimelineBar {...baseProps} />);
const anchorMarkup = renderToStaticMarkup(<TimelineBar {...baseProps} stepSec={30} />);
const fineScrubMarkup = renderToStaticMarkup(
  <TimelineBar {...baseProps} stepSec={30} scrubStepSec={1} />,
);
const lockedAnchorMarkup = renderToStaticMarkup(
  <TimelineBar {...baseProps} stepSec={30} paused={false} disabled />,
);
const markerMarkup = renderToStaticMarkup(
  <TimelineBar {...baseProps} eventMarkers={eventMarkers} onSelect={() => undefined} />,
);
const lockedMarkerMarkup = renderToStaticMarkup(
  <TimelineBar {...baseProps} eventMarkers={eventMarkers} onSelect={() => undefined} disabled />,
);
const declutterMarkup = renderToStaticMarkup(
  <TimelineBar
    {...baseProps}
    eventMarkers={[
      { ...eventMarkers[0]!, id: 'intra-near-a', sourceTimeSec: 120, clickTargetSec: 119 },
      { ...eventMarkers[0]!, id: 'intra-near-b', sourceTimeSec: 120.5, clickTargetSec: 119.5 },
    ]}
    onSelect={() => undefined}
  />,
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

assert.doesNotMatch(defaultMarkup, /timeline-event-marker-/);
assert.match(defaultMarkup, /class="leo-timeline-bar__ruler" aria-hidden="true"/);

assert.match(markerMarkup, /aria-label="Timeline event markers" role="group"/);
assert.match(markerMarkup, /data-testid="timeline-event-marker-intra-early"/);
assert.match(markerMarkup, /data-testid="timeline-event-marker-intra-early"[^>]*data-kind="intra"/);
assert.match(markerMarkup, /data-testid="timeline-event-marker-inter-late"[^>]*data-kind="inter"/);
assert.match(markerMarkup, /data-marker-kind="intra"/);
assert.match(markerMarkup, /data-marker-kind="inter"/);
assert.match(markerMarkup, /data-source-time-sec="120.125"[^>]*data-click-target-sec="118.25"/);
assert.match(markerMarkup, /data-source-time-sec="3600.5"[^>]*data-click-target-sec="3590.25"/);
assert.match(markerMarkup, /aria-label="Seek to intra event at 2 minutes"[^>]*title="Intra event · source 120.125 seconds"/);
assert.match(markerMarkup, /aria-label="Seek to inter event at 1 hour"[^>]*title="Inter event · source 3600.5 seconds"/);
assert.match(markerMarkup, /data-duration-sec="7200.000"/);
assert.match(markerMarkup, /--leo-timeline-marker-position:50\.00694444444444%/);
assert.match(lockedMarkerMarkup, /data-testid="timeline-event-marker-intra-early"[^>]*disabled/);
assert.match(lockedMarkerMarkup, /data-testid="timeline-event-marker-inter-late"[^>]*disabled/);
assert.match(declutterMarkup, /data-marker-id="intra-near-a"[^>]*data-marker-lane="0"/);
assert.match(declutterMarkup, /data-marker-id="intra-near-b"[^>]*data-marker-lane="1"/);
assert.match(declutterMarkup, /data-marker-id="intra-near-b"[^>]*data-source-time-sec="120.5"[^>]*data-click-target-sec="119.5"/);

type TestElementProps = Record<string, unknown> & { readonly children?: ReactNode };
type TestElement = ReactElement<TestElementProps>;

function findElements(node: ReactNode, predicate: (element: TestElement) => boolean): TestElement[] {
  if (Array.isArray(node)) return node.flatMap(child => findElements(child, predicate));
  if (!isValidElement(node)) return [];
  const element = node as TestElement;
  return [
    ...(predicate(element) ? [element] : []),
    ...findElements(element.props.children, predicate),
  ];
}

let selectedTargets: number[] = [];
let fallbackSeekTargets: number[] = [];
const interactiveTimeline = TimelineBar({
  ...baseProps,
  onSeek: targetTimeSec => fallbackSeekTargets.push(targetTimeSec),
  eventMarkers,
  onSelect: targetTimeSec => selectedTargets.push(targetTimeSec),
});
const markerButtons = findElements(
  interactiveTimeline,
  element => element.type === 'button' && String(element.props['data-testid'] ?? '').startsWith('timeline-event-marker-'),
);
assert.equal(markerButtons.length, 2, 'each valid event marker should render a keyboard-focusable button');
const firstMarkerButton = markerButtons.find(
  element => element.props['data-marker-id'] === 'intra-early',
);
assert.ok(firstMarkerButton, 'intra marker button should be present in the rendered tree');
((firstMarkerButton?.props.onClick) as (() => void))();
assert.deepEqual(selectedTargets, [118.25], 'marker selection should pass the exact click target to onSelect');
assert.deepEqual(fallbackSeekTargets, [], 'onSelect should be the only callback used for marker clicks when supplied');

selectedTargets = [];
const disabledTimeline = TimelineBar({
  ...baseProps,
  eventMarkers,
  onSelect: targetTimeSec => selectedTargets.push(targetTimeSec),
  disabled: true,
});
const disabledMarkerButton = findElements(
  disabledTimeline,
  element => element.type === 'button' && element.props['data-marker-id'] === 'inter-late',
)[0];
assert.equal(disabledMarkerButton?.props.disabled, true, 'disabled timelines should disable event marker buttons');
((disabledMarkerButton?.props.onClick) as (() => void))();
assert.deepEqual(selectedTargets, [], 'disabled marker clicks should not invoke onSelect');

const source = readFileSync(fileURLToPath(new URL('./TimelineBar.tsx', import.meta.url)), 'utf8');
assert.match(source, /event\.key === 'ArrowLeft'[\s\S]*?seekTo\(safeCurrentTimeSec - safeStepSec\)/);
assert.match(source, /event\.key === 'ArrowRight'[\s\S]*?seekTo\(safeCurrentTimeSec \+ safeStepSec\)/);
assert.match(source, /event\.key === 'PageDown'[\s\S]*?seekTo\(safeCurrentTimeSec - safeStepSec\)/);
assert.match(source, /event\.key === 'PageUp'[\s\S]*?seekTo\(safeCurrentTimeSec \+ safeStepSec\)/);
assert.match(source, /onClick=\{\(\) => selectEventMarker\(marker\)\}/);
assert.match(source, /onSelect \?\? onSeek\)\(marker\.clickTargetSec\)/);

console.log('TimelineBar preserves transport behavior and exposes accessible, source-time event markers.');
