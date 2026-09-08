/**
 * CHARACTERIZATION TEST — what candidate rail presentation produces TODAY.
 *
 * This photograph captures the exact rail presentation decisions before
 * converging rail presentation into `src/appearance/`.
 *
 * Every string in EXPECTED was produced by running the pre-convergence code.
 * It pins:
 *   1. Rail projection outputs across a grid (candidate sets, serving/target roles,
 *      EE values, configured cell counts / homepage flags)
 *   2. Handover story projection (phase, kind, source, target, status, sameSatellite)
 *   3. Public beam cell labels (B1..B7, decoded same-cell physical offsets, fallbacks)
 *   4. EE ratio and serving opacity envelope geometry across EE thresholds
 *
 * Style follows `src/appearance/handoverAppearanceModifiers.test.ts`:
 * pure node:test, node:assert/strict, no React, no canvas.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  candidateLinkKey,
  createCandidateGateResult,
  createHandoverCommitReceipt,
  createHandoverDecisionFrame,
  createMetricEvidence,
  freezeCandidateOpportunity,
  sameCandidateLinkKey,
  type CandidateDecisionState,
  type CandidateGateResult,
  type CandidateOpportunity,
  type HandoverDecisionFrame,
} from '../engine/handover/candidateDecisionContract';
import {
  buildAcceptedHandoverPresentationSession,
  createHandoverPresentationPolicyConfigHash,
} from '../scene/acceptedHandoverPresentationSnapshot';
import { projectHomepageRail } from '../homepage/controller/railProjection';
import { formatHomepageBeamCellLabel } from '../homepage/controller/homepageBeamIdentity';

const SOURCE_FRAME_ID = 'walker-frame-photo-1';

function metric(
  value: number | null,
  unit: string,
  status: 'available' | 'unavailable' = 'available',
  sourceFrameId = SOURCE_FRAME_ID,
) {
  return createMetricEvidence({
    status,
    value: status === 'available' ? value : null,
    unit,
    sourceFrameId: status === 'available' ? sourceFrameId : null,
    reason: status === 'available' ? null : 'fixture metric unavailable',
  });
}

function gate(code: CandidateGateResult['code'], result: CandidateGateResult['result'] = 'pass') {
  return createCandidateGateResult({
    code,
    category: code === 'ee-advantage' ? 'decision-trigger' : 'hard-qos',
    result,
    measured: result === 'pass' ? 1 : null,
    threshold: result === 'pass' ? 0 : null,
    unit: result === 'pass' ? 'ratio' : null,
    reason: result === 'pass' ? null : 'fixture candidate did not pass this gate',
  });
}

function opp(
  satelliteId: string,
  beamId: number,
  eeBitsPerJoule: number | null,
  sourceFrameId = SOURCE_FRAME_ID,
): CandidateOpportunity {
  return freezeCandidateOpportunity({
    key: candidateLinkKey(satelliteId, beamId),
    primaryUeId: 'ue-photo',
    sourceFrameId,
    beamIdentitySource: 'walker-cell-surrogate',
    geometryClass: 'service-eligible',
    elevation: metric(45, 'deg', 'available', sourceFrameId),
    steering: metric(4, 'deg', 'available', sourceFrameId),
    range: metric(850, 'km', 'available', sourceFrameId),
    sinr: metric(12, 'dB', 'available', sourceFrameId),
    predictedThroughput: metric(100, 'bit/s', 'available', sourceFrameId),
    remainingServiceTime: metric(120, 's', 'available', sourceFrameId),
    instantaneousEe: eeBitsPerJoule === null
      ? metric(null, 'bit/J', 'unavailable', sourceFrameId)
      : metric(eeBitsPerJoule, 'bit/J', 'available', sourceFrameId),
    forecastEe: null,
    gates: [
      gate('elevation'),
      gate('steering'),
      gate('scheduled-illumination'),
      gate('sinr'),
      gate('throughput'),
      gate('remaining-service-time'),
      gate('ee-advantage'),
    ],
  });
}

function state(key: ReturnType<typeof candidateLinkKey>, isCandidate: boolean, rank: number | null): CandidateDecisionState {
  return Object.freeze({
    key,
    hardEligibility: 'eligible',
    triggerStatus: isCandidate ? 'satisfied' : 'not-satisfied',
    qualificationSec: isCandidate ? 4 : 0,
    requiredTttSec: 3,
    stable: isCandidate,
    rank: isCandidate ? rank : null,
    rejectionCodes: Object.freeze([]),
  });
}

function makeDecision(opts: {
  phase: HandoverDecisionFrame['phase'];
  pairs: readonly [string, number, number | null][];
  serving: ReturnType<typeof candidateLinkKey> | null;
  leader?: ReturnType<typeof candidateLinkKey> | null;
  target?: ReturnType<typeof candidateLinkKey> | null;
  selectedKind?: any;
  recentCommit?: any;
}): HandoverDecisionFrame {
  const opportunities = opts.pairs.map(([s, b, ee]) => opp(s, b, ee));
  return createHandoverDecisionFrame({
    episodeId: 'episode-photo',
    sourceFrameId: SOURCE_FRAME_ID,
    epochToken: 'walker:epoch-photo',
    simTimeMs: 4000,
    phase: opts.phase,
    serving: opts.serving,
    opportunities,
    states: opportunities.map(item => {
      const isCand = opts.serving === null || !sameCandidateLinkKey(item.key, opts.serving);
      const rank = isCand ? (opts.target && sameCandidateLinkKey(item.key, opts.target) ? 1 : 2) : null;
      return state(item.key, isCand, rank);
    }),
    provisionalLeader: opts.leader ?? null,
    selectedTarget: opts.target ?? null,
    selectedKind: opts.selectedKind ?? null,
    selectionHoldSec: opts.target ? 1.0 : 0,
    selectionHoldRequiredSec: 1.5,
    mode: 'ee-optimization',
    recentCommit: opts.recentCommit ?? null,
  });
}

function snapshotFor(decision: HandoverDecisionFrame, configuredBeamCount: 1 | 7 | 19 = 7) {
  return buildAcceptedHandoverPresentationSession({
    decision,
    policyConfigHash: createHandoverPresentationPolicyConfigHash(`photo-${configuredBeamCount}`),
    pinnedKey: null,
    instantaneousEeActive: true,
    displayAllHardEligibleCandidates: true,
    configuredBeamCount,
  }).snapshot;
}

const source = candidateLinkKey('sat-a', 1);
const intraTarget = candidateLinkKey('sat-a', 2);
const interTarget = candidateLinkKey('sat-b', 1);

const cases = [
  {
    name: 'initial-attach',
    decision: makeDecision({
      phase: 'initial-attach',
      pairs: [['sat-a', 1, 200000]],
      serving: null,
      leader: source,
      target: source,
      selectedKind: 'initial-attach',
    }),
  },
  {
    name: 'monitoring-serving-only',
    decision: makeDecision({
      phase: 'monitoring',
      pairs: [['sat-a', 1, 250000]],
      serving: source,
    }),
  },
  {
    name: 'qualifying-intra-leader',
    decision: makeDecision({
      phase: 'qualifying',
      pairs: [['sat-a', 1, 200000], ['sat-a', 2, 350000]],
      serving: source,
      leader: intraTarget,
    }),
  },
  {
    name: 'qualifying-inter-multi',
    decision: makeDecision({
      phase: 'qualifying',
      pairs: [['sat-a', 1, 200000], ['sat-b', 1, 320000], ['sat-c', 1, 280000]],
      serving: source,
      leader: interTarget,
    }),
  },
  {
    name: 'selection-hold-inter',
    decision: makeDecision({
      phase: 'selection-hold',
      pairs: [['sat-a', 1, 200000], ['sat-b', 1, 350000]],
      serving: source,
      leader: interTarget,
      target: interTarget,
      selectedKind: 'inter-satellite',
    }),
  },
  {
    name: 'selection-hold-intra',
    decision: makeDecision({
      phase: 'selection-hold',
      pairs: [['sat-a', 1, 200000], ['sat-a', 2, 350000]],
      serving: source,
      leader: intraTarget,
      target: intraTarget,
      selectedKind: 'intra-satellite',
    }),
  },
  {
    name: 'switching-intra',
    decision: makeDecision({
      phase: 'switching',
      pairs: [['sat-a', 1, 200000], ['sat-a', 2, 350000]],
      serving: intraTarget,
      leader: null,
      target: null,
      recentCommit: createHandoverCommitReceipt({
        episodeId: 'episode-photo',
        sourceFrameId: SOURCE_FRAME_ID,
        simTimeMs: 4000,
        from: source,
        to: intraTarget,
        kind: 'intra-satellite',
        mode: 'ee-optimization',
        reason: 'intra commit photo',
        oldLinkEnded: true,
        newLinkStarted: true,
      }),
    }),
  },
  {
    name: 'guard-inter',
    decision: makeDecision({
      phase: 'guard',
      pairs: [['sat-a', 1, 200000], ['sat-b', 1, 350000]],
      serving: interTarget,
      leader: null,
      target: null,
      recentCommit: createHandoverCommitReceipt({
        episodeId: 'episode-photo',
        sourceFrameId: SOURCE_FRAME_ID,
        simTimeMs: 4000,
        from: source,
        to: interTarget,
        kind: 'inter-satellite',
        mode: 'ee-optimization',
        reason: 'inter commit photo',
        oldLinkEnded: true,
        newLinkStarted: true,
      }),
    }),
  },
  {
    name: 'candidate-overflow-8',
    decision: makeDecision({
      phase: 'qualifying',
      pairs: [
        ['sat-a', 1, 200000],
        ['sat-b', 1, 310000], ['sat-b', 2, 300000],
        ['sat-c', 1, 290000], ['sat-c', 2, 280000],
        ['sat-d', 1, 270000], ['sat-d', 2, 260000],
        ['sat-e', 1, 250000], ['sat-e', 2, 240000],
      ],
      serving: source,
      leader: interTarget,
    }),
  },
];

export function recordRailPhotograph(): string[] {
  const lines: string[] = [];
  for (const c of cases) {
    for (const cc of [1, 7] as const) {
      const snap = snapshotFor(c.decision, cc);
      const rail = projectHomepageRail(snap, { configuredCellCount: cc });
      const story = rail.handoverStory;
      const cands = rail.visibleCandidates ?? rail.candidates;
      const candList = cands.map(link => `${link.satelliteId}:${link.beamId}`).join(',');
      const sDesc = story
        ? `[phase=${story.phase} kind=${story.kind} cellCount=${story.cellCount} cellExample=${story.cellExample} src=${story.source.satelliteId}:${story.source.beamId} tgt=${story.target.satelliteId}:${story.target.beamId} winner=${story.winner ? `${story.winner.satelliteId}:${story.winner.beamId}` : 'null'} status=${story.selectionStatus} sameSat=${story.sameSatellite} qual=${story.qualifiedCandidateCount}/${story.qualifiedCandidateSatelliteCount}]`
        : 'none';
      lines.push(`GRID: case=${c.name} cc=${cc} -> phase=${rail.phase} cands=[${candList}] overflow=${rail.overflowKeys.length} story=${sDesc}`);
    }
  }

  for (const b of [1, 2, 7, 421, 841, 1261, 2521, NaN, -1]) {
    lines.push(`BEAM_LABEL: beamId=${b} -> ${formatHomepageBeamCellLabel(b)}`);
  }

  const eeScaleMin = 0;
  const eeScaleMax = 220000;
  const testEes = [null, 0, 50000, 110000, 220000, 330000];
  const testThresholds = [null, 150000, 220000];
  for (const ee of testEes) {
    const ratio = ee === null || eeScaleMax <= eeScaleMin
      ? 0
      : Math.max(0, Math.min(1, (ee - eeScaleMin) / (eeScaleMax - eeScaleMin)));
    lines.push(`EE_RATIO: ee=${ee} -> ${ratio.toFixed(4)}`);
    for (const thresh of testThresholds) {
      let opacity = 1;
      if (ee !== null) {
        const displayMax = Math.max(eeScaleMax, thresh ?? eeScaleMin, eeScaleMin + 1);
        const r = Math.max(0, Math.min(1, (ee - eeScaleMin) / (displayMax - eeScaleMin)));
        opacity = 0.3 + r * 0.7;
      }
      lines.push(`EE_OPACITY: ee=${ee} thresh=${thresh} -> ${opacity.toFixed(4)}`);
    }
  }

  return lines;
}

export const EXPECTED_RAIL_PRESENTATION_PHOTOGRAPH: readonly string[] = [
  "GRID: case=initial-attach cc=1 -> phase=initial-attach cands=[sat-a:1] overflow=0 story=none",
  "GRID: case=initial-attach cc=7 -> phase=initial-attach cands=[sat-a:1] overflow=0 story=none",
  "GRID: case=monitoring-serving-only cc=1 -> phase=monitoring cands=[] overflow=0 story=none",
  "GRID: case=monitoring-serving-only cc=7 -> phase=monitoring cands=[] overflow=0 story=none",
  "GRID: case=qualifying-intra-leader cc=1 -> phase=qualifying cands=[sat-a:2] overflow=0 story=[phase=qualifying kind=intra cellCount=1 cellExample=one-cell src=sat-a:1 tgt=sat-a:2 winner=null status=ttt-stable sameSat=true qual=1/1]",
  "GRID: case=qualifying-intra-leader cc=7 -> phase=qualifying cands=[sat-a:2] overflow=0 story=[phase=qualifying kind=intra cellCount=7 cellExample=seven-cell src=sat-a:1 tgt=sat-a:2 winner=null status=ttt-stable sameSat=true qual=1/1]",
  "GRID: case=qualifying-inter-multi cc=1 -> phase=qualifying cands=[sat-b:1,sat-c:1] overflow=0 story=[phase=qualifying kind=inter cellCount=1 cellExample=one-cell src=sat-a:1 tgt=sat-b:1 winner=null status=ttt-stable sameSat=false qual=2/2]",
  "GRID: case=qualifying-inter-multi cc=7 -> phase=qualifying cands=[sat-b:1,sat-c:1] overflow=0 story=[phase=qualifying kind=inter cellCount=7 cellExample=seven-cell src=sat-a:1 tgt=sat-b:1 winner=null status=ttt-stable sameSat=false qual=2/2]",
  "GRID: case=selection-hold-inter cc=1 -> phase=selection-hold cands=[sat-b:1] overflow=0 story=[phase=selection-hold kind=inter cellCount=1 cellExample=one-cell src=sat-a:1 tgt=sat-b:1 winner=sat-b:1 status=selected sameSat=false qual=1/1]",
  "GRID: case=selection-hold-inter cc=7 -> phase=selection-hold cands=[sat-b:1] overflow=0 story=[phase=selection-hold kind=inter cellCount=7 cellExample=seven-cell src=sat-a:1 tgt=sat-b:1 winner=sat-b:1 status=selected sameSat=false qual=1/1]",
  "GRID: case=selection-hold-intra cc=1 -> phase=selection-hold cands=[sat-a:2] overflow=0 story=[phase=selection-hold kind=intra cellCount=1 cellExample=one-cell src=sat-a:1 tgt=sat-a:2 winner=sat-a:2 status=selected sameSat=true qual=1/1]",
  "GRID: case=selection-hold-intra cc=7 -> phase=selection-hold cands=[sat-a:2] overflow=0 story=[phase=selection-hold kind=intra cellCount=7 cellExample=seven-cell src=sat-a:1 tgt=sat-a:2 winner=sat-a:2 status=selected sameSat=true qual=1/1]",
  "GRID: case=switching-intra cc=1 -> phase=switching cands=[sat-a:1] overflow=0 story=[phase=switching kind=intra cellCount=1 cellExample=one-cell src=sat-a:1 tgt=sat-a:2 winner=null status=committed sameSat=true qual=1/1]",
  "GRID: case=switching-intra cc=7 -> phase=switching cands=[sat-a:1] overflow=0 story=[phase=switching kind=intra cellCount=7 cellExample=seven-cell src=sat-a:1 tgt=sat-a:2 winner=null status=committed sameSat=true qual=1/1]",
  "GRID: case=guard-inter cc=1 -> phase=guard cands=[sat-a:1] overflow=0 story=[phase=guard kind=inter cellCount=1 cellExample=one-cell src=sat-a:1 tgt=sat-b:1 winner=null status=committed sameSat=false qual=1/1]",
  "GRID: case=guard-inter cc=7 -> phase=guard cands=[sat-a:1] overflow=0 story=[phase=guard kind=inter cellCount=7 cellExample=seven-cell src=sat-a:1 tgt=sat-b:1 winner=null status=committed sameSat=false qual=1/1]",
  "GRID: case=candidate-overflow-8 cc=1 -> phase=qualifying cands=[sat-b:1,sat-b:2,sat-c:1,sat-c:2,sat-d:1,sat-d:2,sat-e:1,sat-e:2] overflow=0 story=[phase=qualifying kind=inter cellCount=1 cellExample=one-cell src=sat-a:1 tgt=sat-b:1 winner=null status=ttt-stable sameSat=false qual=8/4]",
  "GRID: case=candidate-overflow-8 cc=7 -> phase=qualifying cands=[sat-b:1,sat-b:2,sat-c:1,sat-c:2,sat-d:1,sat-d:2,sat-e:1,sat-e:2] overflow=0 story=[phase=qualifying kind=inter cellCount=7 cellExample=seven-cell src=sat-a:1 tgt=sat-b:1 winner=null status=ttt-stable sameSat=false qual=8/4]",
  "BEAM_LABEL: beamId=1 -> B1",
  "BEAM_LABEL: beamId=2 -> B2",
  "BEAM_LABEL: beamId=7 -> B7",
  "BEAM_LABEL: beamId=421 -> B2",
  "BEAM_LABEL: beamId=841 -> B3",
  "BEAM_LABEL: beamId=1261 -> B4",
  "BEAM_LABEL: beamId=2521 -> B7",
  "BEAM_LABEL: beamId=NaN -> B—",
  "BEAM_LABEL: beamId=-1 -> B1",
  "EE_RATIO: ee=null -> 0.0000",
  "EE_OPACITY: ee=null thresh=null -> 1.0000",
  "EE_OPACITY: ee=null thresh=150000 -> 1.0000",
  "EE_OPACITY: ee=null thresh=220000 -> 1.0000",
  "EE_RATIO: ee=0 -> 0.0000",
  "EE_OPACITY: ee=0 thresh=null -> 0.3000",
  "EE_OPACITY: ee=0 thresh=150000 -> 0.3000",
  "EE_OPACITY: ee=0 thresh=220000 -> 0.3000",
  "EE_RATIO: ee=50000 -> 0.2273",
  "EE_OPACITY: ee=50000 thresh=null -> 0.4591",
  "EE_OPACITY: ee=50000 thresh=150000 -> 0.4591",
  "EE_OPACITY: ee=50000 thresh=220000 -> 0.4591",
  "EE_RATIO: ee=110000 -> 0.5000",
  "EE_OPACITY: ee=110000 thresh=null -> 0.6500",
  "EE_OPACITY: ee=110000 thresh=150000 -> 0.6500",
  "EE_OPACITY: ee=110000 thresh=220000 -> 0.6500",
  "EE_RATIO: ee=220000 -> 1.0000",
  "EE_OPACITY: ee=220000 thresh=null -> 1.0000",
  "EE_OPACITY: ee=220000 thresh=150000 -> 1.0000",
  "EE_OPACITY: ee=220000 thresh=220000 -> 1.0000",
  "EE_RATIO: ee=330000 -> 1.0000",
  "EE_OPACITY: ee=330000 thresh=null -> 1.0000",
  "EE_OPACITY: ee=330000 thresh=150000 -> 1.0000",
  "EE_OPACITY: ee=330000 thresh=220000 -> 1.0000",
];

test('candidate rail presentation characterization matches pre-convergence photograph', () => {
  const actual = recordRailPhotograph();
  assert.deepEqual(actual, EXPECTED_RAIL_PRESENTATION_PHOTOGRAPH);
});

test('keeps the prior candidate cards visible while a committed story is still presented', () => {
  const beforeSnapshot = snapshotFor(
    cases.find(({ name }) => name === 'selection-hold-intra')!.decision,
  );
  const beforeRail = projectHomepageRail(beforeSnapshot);
  const afterSnapshot = snapshotFor(
    cases.find(({ name }) => name === 'switching-intra')!.decision,
  );
  const afterRail = projectHomepageRail(afterSnapshot, {
    previousSnapshot: beforeSnapshot,
    previousStory: beforeRail.handoverStory,
  });

  assert.ok(beforeRail.handoverStory);
  assert.ok(afterRail.handoverStory);
  assert.deepEqual(
    afterRail.candidates.map(link => `${link.satelliteId}:${link.beamId}`),
    ['sat-a:1'],
    'the current accepted snapshot has moved on to a different candidate roster',
  );
  assert.deepEqual(
    afterRail.visibleCandidates?.map(link => `${link.satelliteId}:${link.beamId}`),
    ['sat-a:2'],
    'the rail keeps the prior candidate card that explains the committed story',
  );
  assert.equal(afterRail.candidateRosterRetained, true);
});

test('candidate rail presentation photograph proof of sensitivity: fails if outputs move', () => {
  const actual = recordRailPhotograph();
  const corrupted = [...actual];
  corrupted[0] = 'GRID: corrupted line';
  assert.notDeepEqual(actual, corrupted);
});
