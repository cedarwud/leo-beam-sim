import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';

import type {
  HomepageHandoverStoryProjection,
  HomepageRailProjection,
} from '../homepage/controller/contracts';
import {
  buildHandoverTeachingScript,
  resolveTeachingFrame,
} from '../homepage/teaching/handoverTeachingScript';
import { LocaleProvider } from '../i18n';
import {
  HANDOVER_STORY_FRAME_SCHEMA_VERSION,
  freezeHandoverStoryFrame,
  resolveTeachingHandoverStoryFrame,
  type HandoverStoryEndpoint,
} from '../scene/handoverStoryFrame';
import {
  resolveHandoverAcceptedSurfaceProjection,
} from '../scene/handoverAcceptedSurfaceProjection';
import {
  resolveHandoverSurfaceBinding,
  type HandoverSurfaceBinding,
} from '../scene/handoverSurfaceBinding';
import {
  resolveHandoverTeachingSurfaceProjection,
  type HandoverTeachingSurfaceProjection,
} from '../scene/handoverTeachingSurfaceProjection';
import {
  HandoverTeachingCaption,
  HandoverTeachingRail,
} from '../ui/homepage/HandoverTeachingRail';
import { HomepageBeamRail } from '../ui/homepage/HomepageBeamRail';
const SNAPSHOT_ID = 'snapshot-surface-r4';
const EPISODE_ID = 'episode-surface-r4';
const SOURCE_FRAME_ID = 'frame-surface-r4';

function endpoint(
  satelliteId: string,
  beamId: string,
): HandoverStoryEndpoint {
  return {
    satelliteId,
    cellId: Number(beamId) - 1,
    beamId,
    satelliteLabel: null,
    beamLabel: null,
    geometryStatus: 'drawable',
    ee: null,
    sinr: null,
    elevationDeg: null,
  };
}

function acceptedBinding(): HandoverSurfaceBinding {
  const frame = freezeHandoverStoryFrame({
    schemaVersion: HANDOVER_STORY_FRAME_SCHEMA_VERSION,
    storyId: `accepted:${EPISODE_ID}:sat-a|1->sat-b|2`,
    kind: 'inter',
    phase: 'holding',
    progress01: null,
    committed: false,
    ueId: 'ue-r4',
    from: endpoint('sat-a', '1'),
    to: endpoint('sat-b', '2'),
    provenance: {
      producer: 'walker',
      claimClass: 'accepted-decision',
      decisionEvidence: 'accepted',
      snapshotId: SNAPSHOT_ID,
      episodeId: EPISODE_ID,
      sourceFrameId: SOURCE_FRAME_ID,
      disclosure: 'accepted-decision-read-only',
      decisionInputAllowed: false,
    },
    clock: {
      basis: 'simulation-time',
      currentSec: 42,
      durationSec: null,
      sourceTimeSec: 42,
    },
  });
  const binding = resolveHandoverSurfaceBinding('accepted', frame);
  assert.ok(binding);
  return binding;
}

function railStory(): HomepageHandoverStoryProjection {
  return {
    snapshotId: SNAPSHOT_ID,
    sourceFrameId: SOURCE_FRAME_ID,
    phase: 'selection-hold',
    kind: 'inter',
    cellCount: 7,
    cellExample: 'seven-cell',
    source: { satelliteId: 'sat-a', beamId: 1 },
    target: { satelliteId: 'sat-b', beamId: 2 },
    winner: { satelliteId: 'sat-b', beamId: 2 },
    sourceEeBitsPerJoule: 120_000,
    targetEeBitsPerJoule: 145_000,
    winnerEeBitsPerJoule: 145_000,
    winnerBasis: 'instantaneous-ee-max',
    targetIsWinner: true,
    qualifiedCandidateCount: 1,
    qualifiedCandidateSatelliteCount: 1,
    selectionStatus: 'ttt-stable',
    sameSatellite: false,
  };
}

function railProjection(): HomepageRailProjection {
  return {
    snapshotId: SNAPSHOT_ID,
    sourceFrameId: SOURCE_FRAME_ID,
    phase: 'selection-hold',
    decision: null,
    serving: null,
    candidates: [],
    visibleCandidates: [],
    overflowKeys: [],
    counts: {
      observed: 1,
      hardEligible: 1,
      triggerSatisfied: 1,
      tttStable: 1,
      displayed: 0,
      overflow: 0,
    },
    activeDataLinkCount: 1,
    beamMetrics: null,
    handoverStory: railStory(),
  };
}

function acceptedSurfaceProjection(
  projection: HomepageRailProjection = railProjection(),
  producer: 'walker' | 'tle' = 'walker',
) {
  return resolveHandoverAcceptedSurfaceProjection(
    acceptedBinding(),
    projection,
    producer,
  );
}

function attribute(markup: string, name: string): string {
  const match = markup.match(new RegExp(`${name}="([^"]*)"`));
  assert.ok(match, `missing ${name}`);
  return match[1]!
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&');
}

function teachingFixture(): {
  readonly projection: HandoverTeachingSurfaceProjection;
} {
  const script = buildHandoverTeachingScript('intra');
  const frame = resolveTeachingFrame(script, 18, null);
  const storyFrame = resolveTeachingHandoverStoryFrame({
    story: {
      kind: 'intra',
      sourceSatelliteId: 'sat-t',
      sourceCellId: 0,
      targetSatelliteId: null,
      targetCellId: 1,
      storyKey: 'teaching-intra:sat-t:0',
    },
    frame,
  });
  assert.ok(storyFrame);
  const binding = resolveHandoverSurfaceBinding('teaching', storyFrame);
  assert.ok(binding);
  const projection = resolveHandoverTeachingSurfaceProjection(binding, frame, 'intra');
  assert.ok(projection);
  return { projection };
}
test('accepted rail publishes the same story identity as the shared binding', () => {
  const binding = acceptedBinding();
  const projection = railProjection();
  const surfaceProjection = resolveHandoverAcceptedSurfaceProjection(
    binding,
    projection,
    'walker',
  );
  const markup = renderToStaticMarkup(
    <LocaleProvider initialLocale="en">
      <HomepageBeamRail
        projection={projection}
        handoverSurfaceProjection={surfaceProjection}
      />
    </LocaleProvider>,
  );

  assert.equal(attribute(markup, 'data-handover-surface'), 'rail');
  assert.equal(attribute(markup, 'data-handover-surface-contract'), 'matched');
  assert.equal(
    attribute(markup, 'data-handover-surface-story-identity'),
    binding.identityKey,
  );
  assert.equal(
    attribute(markup, 'data-handover-surface-story-snapshot-id'),
    SNAPSHOT_ID,
  );
  assert.equal(
    attribute(markup, 'data-handover-surface-story-source-frame-id'),
    SOURCE_FRAME_ID,
  );
});

test('accepted rail reports a source-frame mismatch instead of accepting drift', () => {
  const projection = { ...railProjection(), sourceFrameId: 'foreign-frame' };
  const markup = renderToStaticMarkup(
    <HomepageBeamRail
      projection={projection}
      handoverSurfaceProjection={acceptedSurfaceProjection(projection)}
    />,
  );
  assert.equal(attribute(markup, 'data-handover-surface-contract'), 'mismatch');
});

test('accepted rail renderer owns no local phase or identity composer', async () => {
  const source = await readFile(
    new URL('../ui/homepage/HomepageBeamRail.tsx', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(source, /acceptedHandoverStoryPhase/);
  assert.doesNotMatch(source, /resolveAcceptedHandoverSurfaceStatus/);
  assert.doesNotMatch(source, /handoverStoryBinding/);
  assert.match(source, /handoverSurfaceProjection\?\.contractStatus/);
});

test('accepted narrative caption follows the live App-owned binding telemetry', async () => {
  const source = await readFile(
    new URL('../scene/SceneNarrativeCaption.tsx', import.meta.url),
    'utf8',
  );
  assert.match(source, /storyBindingsRef\?\.current\?\.accepted \?\? storyBinding/);
  assert.match(source, /handoverSurfaceIdentityAttributes\('caption', currentBinding\)/);
  assert.match(source, /data-handover-surface-contract', contractStatus/);
  assert.doesNotMatch(source, /acceptedHandoverStoryPhase/);
});

test('teaching rail and caption publish one exact authored story identity', () => {
  const { projection } = teachingFixture();
  const railMarkup = renderToStaticMarkup(
    <HandoverTeachingRail
      projection={projection}
      paused={false}
      onPausedChange={() => undefined}
      onRestart={() => undefined}
      onSeek={() => undefined}
      speed={1}
      onSpeedChange={() => undefined}
      onClose={() => undefined}
    />,
  );
  const captionMarkup = renderToStaticMarkup(
    <HandoverTeachingCaption projection={projection} />,
  );

  assert.equal(attribute(railMarkup, 'data-handover-surface-contract'), 'matched');
  assert.equal(attribute(captionMarkup, 'data-handover-surface-contract'), 'matched');
  assert.equal(
    attribute(railMarkup, 'data-handover-surface-story-identity'),
    attribute(captionMarkup, 'data-handover-surface-story-identity'),
  );
  assert.equal(
    attribute(railMarkup, 'data-handover-surface-story-pair-key'),
    projection.binding.pairKey,
  );
});

test('accepted rail rejects phase and producer drift from the shared binding', () => {
  const phaseProjection = { ...railProjection(), phase: 'switching' as const };
  const phaseMarkup = renderToStaticMarkup(
    <HomepageBeamRail
      projection={phaseProjection}
      handoverSurfaceProjection={acceptedSurfaceProjection(phaseProjection)}
    />,
  );
  assert.equal(attribute(phaseMarkup, 'data-handover-surface-contract'), 'mismatch');

  const projection = railProjection();
  const producerMarkup = renderToStaticMarkup(
    <HomepageBeamRail
      projection={projection}
      sourceProvenance="archived-tle"
      handoverSurfaceProjection={acceptedSurfaceProjection(projection, 'tle')}
    />,
  );
  assert.equal(attribute(producerMarkup, 'data-handover-surface-contract'), 'mismatch');
});

test('teaching projection fails closed on kind or accepted-clock drift', () => {
  const { projection } = teachingFixture();
  assert.equal(
    resolveHandoverTeachingSurfaceProjection(
      projection.binding,
      projection.frame,
      'inter',
    ),
    null,
  );
  assert.equal(
    resolveHandoverTeachingSurfaceProjection(
      projection.binding,
      { ...projection.frame, elapsedSec: projection.frame.elapsedSec + 1 },
      'intra',
    ),
    null,
  );
});
