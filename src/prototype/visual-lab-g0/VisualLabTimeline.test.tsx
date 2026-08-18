import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import type { VisualLabCanonicalSnapshot } from './visualLabCanonicalSnapshotAdapter';
import type { VisualLabCanonicalTimeline, VisualLabCanonicalTimelinePoint } from './visualLabCanonicalTimelineAdapter';
import { buildVisualLabSeriesPath, VisualLabTimeline } from './VisualLabTimeline';

const point = (overrides: Partial<VisualLabCanonicalTimelinePoint>): VisualLabCanonicalTimelinePoint => ({
  anchorIndex: 0,
  timeSec: 0,
  instantUtc: '2026-08-12T12:00:00.000Z',
  servingSatelliteId: 'serving',
  candidateSatelliteId: null,
  servingSinrDb: 10,
  candidateSinrDb: null,
  throughputBps: 10,
  powerW: 5,
  instantaneousEeBitsPerJ: 2,
  deliveredBits: 10,
  energyJ: 2,
  cumulativeEeBitsPerJ: 5,
  handoverCount: 0,
  ...overrides,
});

const points = [
  point({ anchorIndex: 0, timeSec: 0, throughputBps: 10, powerW: Number.NaN }),
  point({ anchorIndex: 1, timeSec: 30, throughputBps: Number.NaN, powerW: Number.NaN }),
  point({ anchorIndex: 2, timeSec: 60, throughputBps: 30, powerW: Number.NaN }),
];

const throughputPath = buildVisualLabSeriesPath(points, 60, (entry) => entry.throughputBps);
assert.equal(throughputPath.hasData, true);
assert.equal((throughputPath.d.match(/M/g) ?? []).length, 2, 'a missing sample starts a new sub-path');
assert.doesNotMatch(throughputPath.d, /L/, 'a missing sample is never joined through');

const unavailablePath = buildVisualLabSeriesPath(points, 60, (entry) => entry.powerW);
assert.deepEqual(unavailablePath, { d: '', hasData: false }, 'an all-missing series has no path');

const snapshot = {
  throughput: { totalRateBps: null },
  power: { systemPowerW: null },
  ee: { cumulativeBitsPerJ: null },
} as unknown as VisualLabCanonicalSnapshot;
const timeline = {
  schemaVersion: 'visual-lab-canonical-timeline-v1',
  isMock: false,
  availability: 'available',
  analysisRunId: 'analysis-run',
  geometryRunId: 'geometry-run',
  durationSec: 60,
  stepSec: 30,
  anchorCount: points.length,
  points,
  markers: [],
} as unknown as VisualLabCanonicalTimeline;
const markup = renderToStaticMarkup(
  <VisualLabTimeline snapshot={snapshot} timeline={timeline} currentTimeSec={0} />,
);
assert.match(markup, /data-series-availability="unavailable"/, 'missing series is labelled unavailable');
assert.doesNotMatch(markup, /data-series-availability="unavailable"[^>]*d=/, 'unavailable series never receives an SVG path');

console.log('visual-lab timeline missing-value handling passed');
