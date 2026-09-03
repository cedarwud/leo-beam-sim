import assert from 'node:assert/strict';
import test from 'node:test';

import {
  candidateLinkKey,
  createHandoverDecisionFrame,
  type HandoverDecisionFrame,
} from '../../engine/handover/candidateDecisionContract';
import { produceCandidateOpportunitySet } from '../../engine/handover/candidateOpportunityProducer';
import type { SimFrame } from '../../scene/types';
import {
  adaptHomepageSourceFrame,
  isHomepageSourceFrameJoinCurrent,
  type HomepageSourceFrameAdapterInput,
} from './sourceFrameAdapter';

const EPOCH_UTC_MS = Date.parse('2026-08-16T00:00:00.000Z');
const SOURCE_FRAME_ID = `walker:${EPOCH_UTC_MS}:${EPOCH_UTC_MS + 1_250}`;
const PRIMARY_UE_ID = 'ue-primary';

function opportunitySet(sourceFrameId = SOURCE_FRAME_ID, primaryUeId = PRIMARY_UE_ID) {
  return produceCandidateOpportunitySet({
    primaryUeId,
    sourceFrameId,
    thresholds: {
      minimumElevationDeg: 10,
      maximumSteeringDeg: 20,
      minimumSinrDb: 0,
      minimumThroughputBps: null,
      minimumRemainingServiceTimeSec: null,
    },
    measurements: [],
  });
}

function decision(sourceFrameId = SOURCE_FRAME_ID): HandoverDecisionFrame {
  return createHandoverDecisionFrame({
    episodeId: 'homepage-source-adapter',
    sourceFrameId,
    epochToken: `walker:${EPOCH_UTC_MS}`,
    simTimeMs: EPOCH_UTC_MS + 1_250,
    phase: 'monitoring',
    serving: candidateLinkKey('sat-serving', 1),
    opportunities: [],
    states: [],
    provisionalLeader: null,
    selectedTarget: null,
    selectedKind: null,
    selectionHoldSec: 0,
    selectionHoldRequiredSec: 1,
    mode: 'sinr-offset',
    recentCommit: null,
  });
}

function frame(overrides: Partial<SimFrame> = {}): SimFrame {
  return {
    simTimeSec: 1.25,
    perUePositions: [{
      id: PRIMARY_UE_ID,
      eastKm: 0,
      northKm: 0,
      groundX: 0,
      groundZ: 0,
      sinrDb: null,
      servingSatId: null,
      servingBeamId: null,
      pendingTargetSatId: null,
      pendingTargetBeamId: null,
      triggerProgressSec: 0,
    }],
    sinrLiveCells: {
      simTimeSec: 1.25,
      cells: [],
      ues: [],
      primaryUeId: PRIMARY_UE_ID,
      primaryCandidateOpportunities: opportunitySet(),
      illuminatedBeams: [],
      servedCellCount: 0,
      servedUeCount: 0,
      servingSatCount: 0,
      intraHandoverCount: 0,
      interHandoverCount: 0,
      cumulativeIntraHandoverCount: 0,
      cumulativeInterHandoverCount: 0,
      angleAwareFormulaFrame: null,
      recentHandoverEvents: [],
    },
    handoverDecisionFrame: decision(),
    ...overrides,
  } as SimFrame;
}

function input(overrides: Partial<HomepageSourceFrameAdapterInput> = {}): HomepageSourceFrameAdapterInput {
  return {
    frame: frame(),
    epochUtcMs: EPOCH_UTC_MS,
    dtSec: 1 / 60,
    ...overrides,
  };
}

test('carries one Walker identity, opportunity set, and canonical decision together', () => {
  const source = adaptHomepageSourceFrame(input());

  assert.equal(source.sourceFrameId, SOURCE_FRAME_ID);
  assert.equal(source.epochToken, `walker:${EPOCH_UTC_MS}`);
  assert.equal(source.simTimeMs, EPOCH_UTC_MS + 1_250);
  assert.equal(source.simTimeSec, 1.25);
  assert.equal(source.dtSec, 1 / 60);
  assert.equal(source.primaryUeId, PRIMARY_UE_ID);
  assert.equal(source.opportunitySet?.sourceFrameId, source.sourceFrameId);
  assert.equal(source.decision?.sourceFrameId, source.sourceFrameId);
  assert.deepEqual(source.serving, candidateLinkKey('sat-serving', 1));
  assert.ok(Object.isFrozen(source));
});

test('does not infer a new serving pair when the canonical decision says detached', () => {
  const detached = createHandoverDecisionFrame({
    ...decision(),
    serving: null,
    phase: 'initial-attach',
  });
  const source = adaptHomepageSourceFrame(input({
    frame: frame({ handoverDecisionFrame: detached }),
  }));
  assert.equal(source.serving, null);
});

test('rejects mixed source-frame identity instead of joining stale candidates', () => {
  assert.throws(
    () => adaptHomepageSourceFrame(input({
      frame: frame({
        sinrLiveCells: {
          ...frame().sinrLiveCells!,
          primaryCandidateOpportunities: opportunitySet('stale-source-frame'),
        },
      }),
    })),
    /candidate opportunity\/sourceFrameId/,
  );
});

test('rejects a decision whose source identity differs from the Walker frame', () => {
  assert.throws(
    () => adaptHomepageSourceFrame(input({
      frame: frame({ handoverDecisionFrame: decision('stale-decision-frame') }),
    })),
    /decision\/sourceFrameId/,
  );
});

test('rejects a cell container whose simulation time differs from the Walker frame', () => {
  assert.throws(
    () => adaptHomepageSourceFrame(input({
      frame: frame({
        sinrLiveCells: {
          ...frame().sinrLiveCells!,
          simTimeSec: 1.250001,
        },
      }),
    })),
    /cell frame\/simTimeSec/,
  );
});

test('runtime preflight reports a mixed frame without throwing', () => {
  const mixed = frame({ handoverDecisionFrame: decision('stale-decision-frame') });
  assert.equal(isHomepageSourceFrameJoinCurrent(mixed, EPOCH_UTC_MS), false);
  assert.equal(isHomepageSourceFrameJoinCurrent(frame(), EPOCH_UTC_MS), true);
});

test('runtime preflight rejects a stale cell container even without a candidate set', () => {
  const staleCellFrame = frame({
    sinrLiveCells: {
      ...frame().sinrLiveCells!,
      sourceFrameId: 'stale-cell-frame',
      primaryCandidateOpportunities: null,
    },
  });
  assert.equal(isHomepageSourceFrameJoinCurrent(staleCellFrame, EPOCH_UTC_MS), false);
});

console.log('homepage source frame adapter checks pass');
