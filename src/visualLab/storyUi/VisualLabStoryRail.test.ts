import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  formatStoryMetric,
  storyPointMetrics,
  storySourceIdentities,
  storyStepForBeat,
  type StoryRailStory,
  type StoryRailStep,
} from './storyRailModel';

const railSource = await readFile(new URL('./VisualLabStoryRail.tsx', import.meta.url), 'utf8');
const styleSource = await readFile(new URL('./VisualLabStoryRail.scss', import.meta.url), 'utf8');

// Contract checks keep this adapter on the semantic controller seam.
assert.match(railSource, /visualLabExperienceCopy/);
assert.match(railSource, /controller\.tick\(\)/);
assert.match(railSource, /setInterval\(/);
assert.match(railSource, /onSeek\(timeSec\)/);
assert.match(railSource, /onInspect\(target\)/);
assert.match(railSource, /onForkExplore\(\)/);
for (const control of ['previous', 'next', 'restart', 'play', 'pause']) {
  assert.match(railSource, new RegExp(`controller\\.${control}\\(\\)`));
}
assert.match(railSource, /data-story-choice=\{story\?\.kind/);
assert.match(railSource, /data-story-beat=\{phase\}/);

// Styling is self-contained and keeps host visual-lab variables overridable.
assert.match(styleSource, /--story-rail-background/);
assert.match(styleSource, /--vlab-bg/);
assert.match(styleSource, /\.vlab-story-rail--light/);
assert.match(styleSource, /#f5efe4/);
assert.match(styleSource, /font-size: 16px/);
assert.match(styleSource, /font-size: 14px/);
assert.match(styleSource, /min-height: 44px/);
assert.match(styleSource, /overflow-x: auto/);
assert.match(styleSource, /prefers-reduced-motion/);

const pointStep = {
  id: 'story:before',
  phase: 'before',
  index: 0,
  instantUtc: '2026-08-13T12:00:00.000Z',
  anchorIndex: 4,
  point: {
    anchorIndex: 4,
    timeSec: 120,
    instantUtc: '2026-08-13T12:00:00.000Z',
    servingSatelliteId: 'serving-true',
    candidateSatelliteId: 'candidate-true',
    servingSinrDb: 8.25,
    candidateSinrDb: 9.1,
    throughputBps: 12_500_000,
    powerW: 1.125,
    instantaneousEeBitsPerJ: 2_750_000,
    deliveredBits: 1,
    energyJ: 2,
    cumulativeEeBitsPerJ: 2_500_000,
    handoverCount: 0,
  },
  marker: null,
  beamTrace: null,
} satisfies StoryRailStep;

assert.deepEqual(storyPointMetrics(null), {
  sinrDb: null,
  throughputBps: null,
  powerW: null,
  energyEfficiencyBitsPerJ: null,
});
assert.deepEqual(storyPointMetrics(pointStep), {
  sinrDb: 8.25,
  throughputBps: 12_500_000,
  powerW: 1.125,
  energyEfficiencyBitsPerJ: 2_750_000,
});
assert.equal(formatStoryMetric(null, 'throughput', 'en'), '—');
assert.equal(formatStoryMetric(8.25, 'sinr', 'en'), '8.3 dB');
assert.equal(formatStoryMetric(12_500_000, 'throughput', 'en'), '12.5 Mbit/s');
assert.equal(formatStoryMetric(1.125, 'power', 'en'), '1.125 W');
assert.equal(formatStoryMetric(2_500_000, 'energy-efficiency', 'en'), '2.5 Mbit/J');

const interStory = {
  storyId: 'event-real',
  kind: 'inter-handover',
  descriptor: {
    storyId: 'event-real',
    kind: 'inter-handover',
    source: {
      kind: 'inter-handover',
      eventId: 'event-real',
      fromSatelliteId: 'from-true',
      toSatelliteId: 'to-true',
    },
    availability: { status: 'available', reason: null, sourceKind: 'accepted-canonical-real' },
  },
  availability: { status: 'available', reason: null, sourceKind: 'accepted-canonical-real' },
  steps: [pointStep],
} satisfies StoryRailStory;

assert.deepEqual(storySourceIdentities(interStory), {
  fromSatelliteId: 'from-true',
  toSatelliteId: 'to-true',
});
assert.equal(storyStepForBeat(interStory, 'before'), pointStep);
assert.equal(storyStepForBeat(interStory, 'decision'), null);

const unavailableIntra = {
  storyId: 'intra-handover',
  kind: 'intra-handover',
  descriptor: {
    storyId: 'intra-handover',
    kind: 'intra-handover',
    source: { kind: 'intra-handover', traceId: null, from: null, to: null },
    availability: {
      status: 'unavailable',
      reason: 'No accepted canonical beam identity trace.',
      reasonCode: 'missing-real-trace',
      sourceKind: 'unsupported',
    },
  },
  availability: {
    status: 'unavailable',
    reason: 'No accepted canonical beam identity trace.',
    reasonCode: 'missing-real-trace',
    sourceKind: 'unsupported',
  },
  steps: [],
} satisfies StoryRailStory;
assert.deepEqual(storySourceIdentities(unavailableIntra), {
  fromSatelliteId: null,
  toSatelliteId: null,
});

console.log('visual-lab story rail contract and readout tests passed');
