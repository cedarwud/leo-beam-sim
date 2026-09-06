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
  // An `idle` beam is a CONFIGURED beam with no source measurement this frame.
  // `beamMetrics` synthesises these deliberately, to complete a sparse roster up
  // to the configured budget "so the rail still shows every configured row".
  // This helper could not produce one until 2026-09-06, so no rail test held a
  // single idle row -- see the idle-roster test below for what that cost.
  idle = false,
  throughputBps = 1_200_000,
}: {
  readonly satelliteId: string;
  readonly beamId: number;
  readonly role: HomepageBeamMetric['role'];
  readonly isPrimaryServing?: boolean;
  readonly unavailable?: boolean;
  readonly idle?: boolean;
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
    availability: idle ? 'idle' : unavailable ? 'unavailable' : 'available',
    sinrDb: idle || unavailable ? null : 11.25,
    powerW: idle || unavailable ? null : 8.5,
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

// Committed WITH a usable basis. The existing committed fixture deliberately
// has `winnerBasis: 'unavailable'`, so on its own it cannot distinguish the
// committed wording from the unavailable wording.
const committedWithBasisMarkup = renderRail('en', {
  ...candidateProjection,
  handoverStory: { ...handoverStory, selectionStatus: 'committed' },
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
// `data-story-kind` was renamed to `data-handover-kind` in 6b9474e, which
// merged the separate accepted-story section and live-presentation section
// into one explainer (see the "serving has one meaning on this rail" comment
// above HandoverExplainer). Same value, same purpose, new attribute name.
assert.match(storyMarkup, /data-handover-kind="inter"/);
assert.match(storyMarkup, /INTER · qualifying/, 'the visible kind badge must render the accepted story kind');
// A not-yet-committed story must show the pre-commit cue, not a winner claim.
assert.match(
  storyMarkup,
  /Evaluate: wait for EE to cross the trigger, then compare beams\./,
  'a ttt-stable story is not yet committed; the cue must not claim a beam has been selected',
);
assert.match(storyMarkup, /141\.18 Kbit\/J/);
// `6b9474e` deleted the cell-reuse topology and the EE-max selection criterion
// from this rail with no design comment. The projection kept computing both,
// and the only remaining reader was a 12 KB overlay component that nothing
// imported -- so a well-tested producer fed nobody. For a teaching simulator
// that is the wrong half to lose. The display is restored in
// `IntraHandoverExplainer`; these assertions are what stops it going away again.
//
// The fixtures contrast deliberately (7-cell vs 1-cell, winner vs no basis,
// ttt-stable vs committed) so hard-coded copy cannot satisfy them.
assert.match(storyMarkup, /data-story-cell-count="7"/);
assert.match(storyMarkup, /data-story-cell-example="seven-cell"/);
assert.match(storyMarkup, /data-story-target-is-winner="true"/);
assert.match(storyMarkup, /data-story-winner-basis="instantaneous-ee-max"/);
assert.match(storyMarkup, /data-story-qualified-candidate-count="2"/);
assert.match(storyMarkup, /7 cells reused per satellite \(C1–C7\)/, 'the 7-cell reuse topology must be visible, not only an attribute');

assert.match(intraStoryMarkup, /data-story-cell-count="1"/);
assert.match(intraStoryMarkup, /data-story-cell-example="one-cell"/);
assert.match(intraStoryMarkup, /1 cell reused per satellite \(C1\)/, 'the 1-cell topology must render its own copy, not the 7-cell copy');
assert.doesNotMatch(intraStoryMarkup, /7 cells reused/, 'contrasting fixtures must not both render the same sentence');

// The criterion is a criterion until the decision commits. `targetIsWinner` is
// derived independently of `selectionStatus`, so a ttt-stable story can carry a
// winner that has not been selected yet -- the retired overlay claimed
// "Selected by instantaneous EE ordering" on exactly this state, which is why
// it was not wired back in.
assert.match(storyMarkup, /Criterion: max instantaneous EE · 2 qualified/);
assert.doesNotMatch(storyMarkup, /Committed by max instantaneous EE/, 'a ttt-stable story has not committed');
assert.match(committedWithBasisMarkup, /Committed by max instantaneous EE · 2 qualified/);
assert.doesNotMatch(committedWithBasisMarkup, /Criterion: max instantaneous EE/);

// An absent basis must say so rather than implying an EE ordering happened.
assert.match(committedStoryMarkup, /data-story-winner-basis="unavailable"/);
assert.match(committedStoryMarkup, /data-story-target-is-winner="false"/);
assert.match(committedStoryMarkup, /Selection criterion unavailable · 2 qualified/);
assert.doesNotMatch(committedStoryMarkup, /max instantaneous EE/, 'no EE-ordering claim without a basis');
assert.match(
  committedStoryMarkup,
  /Committed: the selected beam is now serving\./,
  'a committed story must show the committed cue',
);
assert.match(committedStoryMarkup, /data-story-selection-status="committed"/);
assert.match(intraStoryMarkup, /data-handover-kind="intra"/);
assert.match(intraStoryMarkup, /INTRA · qualifying/, 'the visible kind badge must render the accepted story kind');

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

// 6b9474e merged the once-separate presentation section into the same
// unified explainer as the accepted story (same testid as line ~298); a live
// cinema presentation no longer gets its own testid.
assert.match(presentationMarkup, /data-testid="homepage-handover-story"/);
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
// 6b9474e deliberately flipped the initial state of this one disclosure (see
// the "keep the six same-satellite beams visible on first render" comment
// above `servingExpanded`'s useState in HomepageBeamRail.tsx): the serving
// satellite's other physical beams now start expanded so a 7-beam roster is
// visible without an extra click, while candidate groups (asserted below)
// still start collapsed.
assert.match(denseServingDetails, /\bopen(?:=|>)/, 'serving secondary beams start expanded by default');
const denseCandidateDetails = denseRosterMarkup.match(/<details[^>]*data-testid="homepage-satellite-group"[^>]*>/)?.[0] ?? '';
assert.doesNotMatch(denseCandidateDetails, /\bopen(?:=|>)/, 'dense candidate groups start collapsed');
assert.equal((denseRosterMarkup.match(/<details\b/g) ?? []).length, 2);

assert.match(allSurfaceReviewMarkup, /data-show-all-surfaces="true"/);
// The dedicated placeholder testids were removed by 6b9474e's merge: the idle
// (no story, no presentation) state now renders through the same unified
// section, with an empty kind and an explicit "no handover is active" cue,
// rather than a distinct placeholder element.
assert.match(allSurfaceReviewMarkup, /data-testid="homepage-handover-story"/);
assert.match(allSurfaceReviewMarkup, /data-handover-kind=""/);
assert.match(allSurfaceReviewMarkup, /data-handover-active="false"/);
assert.match(allSurfaceReviewMarkup, /Serving link: no handover is active\./);

// ---------------------------------------------------------------------------
// A sparse roster's idle rows must still reach the rail.
//
// This is acceptance sentence 2 -- 「右欄顯示服務衛星的全部七條波束」 -- and it
// depends on rows that have no measurement. `beamMetrics` completes a sparse
// roster up to the configured budget precisely so "the rail still shows every
// configured row", and those synthesised rows come out `availability: 'idle'`
// (asserted in beamMetrics.test.ts). With a sparse source frame, most of the
// seven ARE the idle ones.
//
// Measured: told 「右欄的波束列表不要顯示 idle 的波束」, a cheap model added
// `metric.availability !== 'idle'` to this rail's two metric lookups. It was on
// the right file, the change was coherent, and every gate stayed green -- because
// the `metric()` helper above could not produce an idle row, so no fixture in
// this file had ever contained one. Sentence 3 was satisfied by breaking
// sentence 2, silently.
//
// Whether idle beams should be hidden is the owner's call. Making that call
// invisible is not.
// ---------------------------------------------------------------------------
const sparseRosterMarkup = renderRail('en', {
  ...projection,
  beamMetrics: {
    ...projection.beamMetrics!,
    metrics: [
      metric({ satelliteId: 'sat-serving', beamId: 1, role: 'serving', isPrimaryServing: true }),
      metric({ satelliteId: 'sat-serving', beamId: 2, role: 'observed' }),
      // Beams 3..7 are configured but had no source measurement this frame.
      ...Array.from({ length: 5 }, (_, index) => metric({
        satelliteId: 'sat-serving',
        beamId: index + 3,
        role: 'observed',
        idle: true,
      })),
    ],
  },
});

assert.equal(
  (sparseRosterMarkup.match(/data-testid="homepage-beam-row"/g) ?? []).length,
  7,
  'all seven configured beams must reach the rail, including the five with no measurement',
);
assert.match(
  sparseRosterMarkup,
  /data-ee-availability="idle"/,
  'an idle beam must render as idle, not be dropped',
);
assert.equal(
  (sparseRosterMarkup.match(/data-ee-availability="idle"/g) ?? []).length,
  5,
  'every configured beam without a measurement keeps its row',
);

console.log('homepage beam rail checks pass');
