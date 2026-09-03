import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

import { candidateLinkKey } from '../../engine/handover/candidateDecisionContract';
import type { CandidatePresentationLink } from '../../engine/handover/candidatePresentationPlan';
import {
  homepageSatelliteColorForBeam,
  type HomepageSatelliteVisualColor,
} from '../../homepage/controller/homepageSatelliteVisualIdentity';
import type {
  HomepageBeamMetric,
  HomepageHandoverPresentation,
  HomepageHandoverStoryProjection,
  HomepageRailProjection,
} from '../../homepage/controller/contracts';
import { LocaleProvider } from '../../i18n';
import {
  HomepageBeamRail,
  type HomepageBeamRailSnapshotMetadata,
} from './HomepageBeamRail';

const SNAPSHOT_ID = 'homepage-snapshot-test-1';
const SOURCE_FRAME_ID = 'homepage-frame-test-1';

function metric({
  satelliteId,
  beamId,
  role,
  isPrimaryServing = false,
  unavailable = false,
  throughputBps = 1_200_000,
}: {
  readonly satelliteId: string;
  readonly beamId: number;
  readonly role: HomepageBeamMetric['role'];
  readonly isPrimaryServing?: boolean;
  readonly unavailable?: boolean;
  readonly throughputBps?: number;
}): HomepageBeamMetric {
  const color: HomepageSatelliteVisualColor = homepageSatelliteColorForBeam(satelliteId, beamId);
  const joinKey = `${satelliteId}/beam/${beamId}`;
  return {
    key: candidateLinkKey(satelliteId, beamId),
    joinKey,
    sourceFrameId: SOURCE_FRAME_ID,
    snapshotId: SNAPSHOT_ID,
    satelliteId,
    beamId,
    role,
    availability: unavailable ? 'unavailable' : 'available',
    sinrDb: unavailable ? null : 11.25,
    powerW: unavailable ? null : 8.5,
    throughputBps: unavailable ? null : throughputBps,
    energyEfficiencyBitsPerJoule: unavailable ? null : 141_176,
    eeNormalized: unavailable ? null : 0.5,
    eeBasis: unavailable ? 'not-available' : 'active-assignment',
    reason: unavailable ? 'counterfactual sample was not supplied' : null,
    isPrimaryServing,
    color,
  };
}

const projection: HomepageRailProjection = {
  snapshotId: SNAPSHOT_ID,
  sourceFrameId: SOURCE_FRAME_ID,
  phase: 'qualifying',
  serving: null,
  candidates: [],
  overflowKeys: [],
  counts: {
    observed: 3,
    hardEligible: 1,
    triggerSatisfied: 1,
    tttStable: 0,
    displayed: 3,
    overflow: 0,
  },
  activeDataLinkCount: 1,
  beamMetrics: {
    sourceFrameId: SOURCE_FRAME_ID,
    snapshotId: SNAPSHOT_ID,
    simTimeSec: 42,
    metrics: [
      metric({ satelliteId: 'sat-serving', beamId: 1, role: 'serving', isPrimaryServing: true }),
      metric({ satelliteId: 'sat-candidate', beamId: 2, role: 'candidate' }),
      metric({ satelliteId: 'sat-candidate', beamId: 3, role: 'candidate', unavailable: true }),
      metric({ satelliteId: 'sat-observed', beamId: 4, role: 'observed' }),
    ],
    availableEeMinBitsPerJoule: 141_176,
    availableEeMaxBitsPerJoule: 141_176,
  },
};

function candidatePresentationLink(beamId: number): CandidatePresentationLink {
  const key = candidateLinkKey('sat-candidate', beamId);
  const stableJoinKey = `episode-test/link/${key.satelliteId}|${key.beamId}`;
  return {
    joinKey: stableJoinKey,
    sceneJoinKey: stableJoinKey,
    railJoinKey: stableJoinKey,
    key,
    sourceFrameId: SOURCE_FRAME_ID,
    satelliteId: key.satelliteId,
    beamId: key.beamId,
    displayKey: `${key.satelliteId} / B${key.beamId}`,
    opportunity: null,
    state: null,
    role: 'observed',
    isServing: false,
    isCandidate: true,
    isPinned: false,
    satelliteIdentity: {} as CandidatePresentationLink['satelliteIdentity'],
    beamIdentity: null,
    visual: {
      role: 'observed',
      footprintStyle: 'dotted',
      coneStyle: 'hidden',
      dataLinkStyle: 'none',
      isMeasurementOnly: true,
      isActiveDataLink: false,
    },
  };
}

function renderRail(
  initialLocale: 'en' | 'zh-TW',
  railProjection: HomepageRailProjection = projection,
  selectedJoinKey: string | null = 'sat-candidate/beam/3',
  handoverPresentation: HomepageHandoverPresentation | null = null,
  acceptedSnapshotMetadata: HomepageBeamRailSnapshotMetadata = {
    snapshotId: SNAPSHOT_ID,
    sourceFrameId: SOURCE_FRAME_ID,
    phase: 'qualifying',
  },
  showAllSurfaces = false,
): string {
  return renderToStaticMarkup(
    <LocaleProvider initialLocale={initialLocale}>
      <HomepageBeamRail
        projection={railProjection}
        acceptedSnapshotMetadata={acceptedSnapshotMetadata}
        selectedJoinKey={selectedJoinKey}
        handoverPresentation={handoverPresentation}
        showAllSurfaces={showAllSurfaces}
      />
    </LocaleProvider>,
  );
}

const candidateProjection: HomepageRailProjection = {
  ...projection,
  candidates: [candidatePresentationLink(2), candidatePresentationLink(3)],
};

const handoverStory: HomepageHandoverStoryProjection = {
  snapshotId: SNAPSHOT_ID,
  sourceFrameId: SOURCE_FRAME_ID,
  phase: 'qualifying',
  kind: 'inter',
  cellCount: 7,
  cellExample: 'seven-cell',
  source: { satelliteId: 'sat-serving', beamId: 1 },
  target: { satelliteId: 'sat-candidate', beamId: 2 },
  winner: { satelliteId: 'sat-candidate', beamId: 2 },
  sourceEeBitsPerJoule: 120_000,
  targetEeBitsPerJoule: 141_176,
  winnerEeBitsPerJoule: 141_176,
  winnerBasis: 'instantaneous-ee-max',
  targetIsWinner: true,
  qualifiedCandidateCount: 2,
  qualifiedCandidateSatelliteCount: 1,
  selectionStatus: 'ttt-stable',
  sameSatellite: false,
};

const storyMarkup = renderRail('en', {
  ...candidateProjection,
  handoverStory,
});
const intraStoryMarkup = renderRail('en', {
  ...candidateProjection,
  handoverStory: {
    ...handoverStory,
    kind: 'intra',
    cellCount: 1,
    cellExample: 'one-cell',
    source: { satelliteId: 'sat-candidate', beamId: 2 },
    target: { satelliteId: 'sat-candidate', beamId: 3 },
    sameSatellite: true,
  },
});
const committedStoryMarkup = renderRail('en', {
  ...candidateProjection,
  handoverStory: {
    ...handoverStory,
    winner: null,
    winnerEeBitsPerJoule: null,
    targetIsWinner: false,
    winnerBasis: 'unavailable',
    selectionStatus: 'committed',
  },
});

function rosterProjection(servingCount: number, candidateCount: number): HomepageRailProjection {
  const servingMetrics = Array.from({ length: servingCount }, (_, index) => metric({
    satelliteId: 'sat-serving',
    beamId: index + 1,
    role: index === 0 ? 'serving' : 'observed',
    isPrimaryServing: index === 0,
  }));
  const candidateMetrics = Array.from({ length: candidateCount }, (_, index) => metric({
    satelliteId: 'sat-candidate',
    beamId: index + 1,
    role: 'candidate',
  }));
  return {
    ...projection,
    candidates: candidateMetrics.map(candidate => candidatePresentationLink(candidate.beamId)),
    beamMetrics: {
      ...projection.beamMetrics!,
      metrics: [...servingMetrics, ...candidateMetrics],
    },
  };
}

const markup = renderRail('en', candidateProjection, 'episode-test/link/sat-candidate|3');
const zhMarkup = renderRail('zh-TW', candidateProjection);
const orphanMetricMarkup = renderRail('en', projection, null);
const linkedMarkup = renderRail(
  'en',
  {
    ...projection,
    candidates: [candidatePresentationLink(2), candidatePresentationLink(3)],
  },
  'episode-test/link/sat-candidate|3',
);
const gigaMarkup = renderRail('en', {
  ...projection,
  beamMetrics: {
    ...projection.beamMetrics!,
    metrics: [
      metric({
        satelliteId: 'sat-serving',
        beamId: 1,
        role: 'serving',
        isPrimaryServing: true,
        throughputBps: 1_200_000_000,
      }),
      ...projection.beamMetrics!.metrics.slice(1),
    ],
  },
});
const presentation: HomepageHandoverPresentation = {
  eventId: 'cinema-intra-test',
  kind: 'intra',
  source: 'cinema',
  phase: 'measuring',
  progress01: 0.2,
  from: { satelliteId: 'sat-candidate', beamId: 2, sinrDb: -12.5 },
  to: { satelliteId: 'sat-candidate', beamId: 3, sinrDb: -11.8 },
  deltaDb: 0.7,
};
const presentationMarkup = renderRail('en', candidateProjection, null, presentation);
const presentationWithoutCandidateMarkup = renderRail('en', projection, null, presentation);
const staleMetadataMarkup = renderRail(
  'en',
  projection,
  null,
  null,
  {
    snapshotId: 'stale-snapshot',
    sourceFrameId: 'stale-frame',
    phase: 'monitoring',
  },
);
const servingColor = homepageSatelliteColorForBeam('sat-serving', 1).color;

assert.match(markup, /data-testid="homepage-beam-rail"/);
assert.match(markup, /data-formula-contract="simplified-ee-c1-c9"/);
assert.match(markup, /data-formula-contract-version="single-sinr-previous-step-power-v2"/);
assert.match(markup, /data-power-metric="P\^p_\{s,v\}"/);
assert.match(markup, /Power/);
assert.match(markup, /data-snapshot-id="homepage-snapshot-test-1"/);
assert.match(markup, /data-source-frame-id="homepage-frame-test-1"/);
assert.match(markup, /data-phase="qualifying"/);
assert.match(markup, /data-serving-beam-count="1"/);
assert.match(markup, /data-serving-primary-beam-count="1"/);
assert.match(markup, /data-serving-other-beam-count="0"/);
assert.match(markup, /data-testid="homepage-primary-serving-beam"/);
assert.match(markup, /data-candidate-beam-count="2"/);
assert.match(
  staleMetadataMarkup,
  /data-snapshot-id="homepage-snapshot-test-1"[^>]*data-source-frame-id="homepage-frame-test-1"[^>]*data-phase="qualifying"/,
  'rail identity must remain projection-owned when optional metadata is stale',
);
assert.doesNotMatch(markup, /homepage-beam-rail-transport|homepage-beam-rail-counts|Selected speed|Effective speed|Paused|>Beam values</);
assert.doesNotMatch(markup, /homepage-candidate-counts|Observed|Hard-eligible|Trigger satisfied|TTT-stable|Overflow/);
assert.match(storyMarkup, /data-testid="homepage-handover-story"/);
assert.match(storyMarkup, /data-story-kind="inter"/);
assert.match(storyMarkup, /data-story-cell-count="7"/);
assert.match(storyMarkup, /data-story-cell-example="seven-cell"/);
assert.match(storyMarkup, /Inter · 7 cells/);
assert.match(storyMarkup, /data-story-target-is-winner="true"/);
assert.match(storyMarkup, /data-story-winner-basis="instantaneous-ee-max"/);
assert.match(storyMarkup, /Selected · maximum instantaneous EE criterion/);
assert.match(storyMarkup, /141\.18 Kbit\/J/);
assert.match(committedStoryMarkup, /<h3[^>]*>Instantaneous EE comparison<\/h3>/);
assert.doesNotMatch(committedStoryMarkup, /EE winner|EE 勝出|MAX EE|EE 最大/);
assert.match(intraStoryMarkup, /data-story-kind="intra"/);
assert.match(intraStoryMarkup, /data-story-cell-count="1"/);
assert.match(intraStoryMarkup, /data-story-cell-example="one-cell"/);
assert.match(intraStoryMarkup, /Intra · 1 cell/);

assert.equal(
  (markup.match(/data-testid="homepage-beam-row"/g) ?? []).length,
  3,
  'one row must render for each serving or candidate metric; observed-only metrics stay out of the rail',
);
assert.equal(
  (markup.match(/data-testid="homepage-satellite-group"/g) ?? []).length,
  1,
  'only candidate satellites retain projected groups; observed-only satellites stay out of the rail',
);
assert.doesNotMatch(markup, /sat-observed/);
assert.match(markup, /data-sat-id="sat-serving"[^>]*data-beam-id="1"[^>]*data-role="serving"/);
assert.ok(markup.includes(`border:1px solid ${servingColor}`), 'serving row outline must use its beam hue');
assert.ok(markup.includes(`${servingColor}20`), 'serving section wash must use its beam hue');
assert.match(markup, /data-sat-id="sat-candidate"[^>]*data-beam-id="3"[^>]*data-join-key="episode-test\/link\/sat-candidate\|3"[^>]*data-selected="true"/);
assert.match(markup, /data-ee-availability="unavailable"/);
assert.doesNotMatch(markup, /N\/A|無資料/);
assert.match(markup, /title="counterfactual sample was not supplied"/);
assert.match(markup, /aria-label="counterfactual sample was not supplied"/);
assert.match(markup, /data-testid="homepage-beam-rail-toggle-groups"[^>]*aria-expanded="false"/);
assert.match(markup, /aria-controls="homepage-serving-beam-details homepage-projected-groups"/);
assert.match(markup, /data-control-scope="serving-and-candidate-details"/);
assert.match(markup, /Expand all/);
assert.doesNotMatch(markup, /data-testid="homepage-serving-beam-details"/, 'a one-beam serving roster has no other-beam disclosure');
const candidateDetails = markup.match(/<details[^>]*data-testid="homepage-satellite-group"[^>]*>/)?.[0] ?? '';
assert.notEqual(candidateDetails, '', 'candidate details must render');
assert.doesNotMatch(candidateDetails, /\bopen(?:=|>)/, 'candidate groups start collapsed');

for (const label of ['Power', 'Throughput', 'SINR', '>EE<']) {
  assert.match(markup, new RegExp(label));
}

assert.doesNotMatch(markup, /完整波束明細|展開其餘/);
assert.equal((markup.match(/<details\b/g) ?? []).length, 1);

assert.match(zhMarkup, /Power/);
assert.match(zhMarkup, />EE</);
assert.doesNotMatch(zhMarkup, /即時/);
assert.match(zhMarkup, /全部展開/);
assert.doesNotMatch(zhMarkup, /N\/A|無資料/);
assert.doesNotMatch(zhMarkup, /Snapshot|Source frame|Phase|Walker/);
assert.doesNotMatch(zhMarkup, /homepage-beam-rail-transport|homepage-beam-rail-counts|選定速度|實際速度|已暫停|>波束數值</);
assert.doesNotMatch(zhMarkup, /候選計數|觀測|硬條件合格|觸發滿足|TTT 穩定|溢出/);
assert.doesNotMatch(zhMarkup, /sat-observed/);
assert.match(zhMarkup, /background-color:#06131b/);
assert.match(markup, /1\.2 Mbit\/s/);
assert.match(markup, /141\.18 Kbit\/J/);
assert.match(gigaMarkup, /1\.2 Gbit\/s/);
assert.doesNotMatch(markup, /1,200,000 bit\/s|141,176 bit\/J/);

assert.equal(
  (linkedMarkup.match(/data-testid="homepage-beam-row"/g) ?? []).length,
  3,
  'stable presentation links must join to the two matching candidate metrics plus serving',
);
assert.match(
  linkedMarkup,
  /data-beam-id="2"[^>]*data-join-key="episode-test\/link\/sat-candidate\|2"[^>]*data-ee-availability="available"/,
);
assert.match(linkedMarkup, /episode-test\/link\/sat-candidate\|3"[^>]*data-selected="true"/);
assert.match(linkedMarkup, /1\.2 Mbit\/s/);
assert.match(linkedMarkup, /data-pair-key="sat-candidate\/beam\/2"/);

assert.match(presentationMarkup, /data-testid="homepage-handover-presentation"/);
assert.match(presentationMarkup, /data-handover-kind="intra"/);
assert.match(presentationMarkup, /data-handover-from-beam-id="2"/);
assert.match(presentationMarkup, /data-handover-to-beam-id="3"/);
assert.match(presentationMarkup, /data-handover-endpoint="source"/);
assert.match(presentationMarkup, /data-handover-endpoint="target"/);
assert.match(presentationMarkup, /sat-candidate \/ B2/);
assert.match(presentationMarkup, /sat-candidate \/ B3/);
assert.equal(
  (presentationWithoutCandidateMarkup.match(/data-testid="homepage-satellite-group"/g) ?? []).length,
  0,
  'handover presentation endpoints must not create candidate groups outside projection.candidates',
);

assert.equal(
  (orphanMetricMarkup.match(/data-testid="homepage-satellite-group"/g) ?? []).length,
  0,
  'candidate metrics alone must not create candidate groups',
);
assert.doesNotMatch(orphanMetricMarkup, /sat-candidate/);

const missingMetricMarkup = renderRail('en', {
  ...candidateProjection,
  candidates: [...candidateProjection.candidates, candidatePresentationLink(7)],
}, null);
assert.doesNotMatch(missingMetricMarkup, /N\/A|無資料/);
assert.match(missingMetricMarkup, /data-metric-unavailable-reason="No accepted beam metric was supplied for this projected link\."/);
assert.match(missingMetricMarkup, /aria-label="No accepted beam metric was supplied for this projected link\."/);

const denseRosterMarkup = renderRail(
  'en',
  rosterProjection(7, 19),
  null,
);
const allSurfaceReviewMarkup = renderRail('en', projection, null, null, undefined, true);
assert.equal(
  (denseRosterMarkup.match(/data-testid="homepage-beam-row"/g) ?? []).length,
  26,
  'the rail must show every selected serving/candidate beam from the shared roster',
);
assert.match(denseRosterMarkup, /data-displayed-beam-count="26"/);
assert.match(denseRosterMarkup, /data-beam-metric-count="26"/);
assert.match(denseRosterMarkup, /data-serving-beam-count="7"/);
assert.match(denseRosterMarkup, /data-serving-primary-beam-count="1"/);
assert.match(denseRosterMarkup, /data-serving-other-beam-count="6"/);
assert.equal(
  (denseRosterMarkup.match(/data-testid="homepage-satellite-group"/g) ?? []).length,
  1,
  'only the candidate satellite is grouped; all serving-satellite beams stay in the service section',
);
assert.doesNotMatch(denseRosterMarkup, /sat-observed/);
assert.match(denseRosterMarkup, /data-pair-key="sat-serving\/beam\/7"/);
assert.match(denseRosterMarkup, /data-pair-key="sat-candidate\/beam\/19"/);
const denseServingDetails = denseRosterMarkup.match(/<details[^>]*data-testid="homepage-serving-beam-details"[^>]*>/)?.[0] ?? '';
assert.notEqual(denseServingDetails, '', 'dense serving rosters expose an other-beam disclosure');
assert.doesNotMatch(denseServingDetails, /\bopen(?:=|>)/, 'serving secondary beams start collapsed');
const denseCandidateDetails = denseRosterMarkup.match(/<details[^>]*data-testid="homepage-satellite-group"[^>]*>/)?.[0] ?? '';
assert.doesNotMatch(denseCandidateDetails, /\bopen(?:=|>)/, 'dense candidate groups start collapsed');
assert.equal((denseRosterMarkup.match(/<details\b/g) ?? []).length, 2);

assert.match(allSurfaceReviewMarkup, /data-show-all-surfaces="true"/);
assert.match(allSurfaceReviewMarkup, /data-testid="homepage-handover-story-placeholder"/);
assert.match(allSurfaceReviewMarkup, /data-testid="homepage-handover-presentation-placeholder"/);

console.log('homepage beam rail checks pass');
