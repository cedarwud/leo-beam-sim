import assert from 'node:assert/strict';
import test from 'node:test';

import {
  candidateLinkKey,
  createHandoverCommitReceipt,
  type HandoverDecisionFrame,
} from '../engine/handover/candidateDecisionContract';
import {
  cellLinkBudgetBeamId,
  intraCellLinkBudgetBeamId,
} from './sinrLiveCellModel';
import {
  commitReceiptMatchesHandoverPresentation,
  resolveAuthorityHandoverPresentationEvent,
  resolveAuthorityHandoverPresentationSnapshot,
  resolveHandoverAuthorityJoin,
} from './handoverAuthorityJoin';

const from = candidateLinkKey('SAT-A', 2);
const interTarget = candidateLinkKey('SAT-B', 4);
const intraTarget = candidateLinkKey('SAT-A', 5);

function frame(overrides: Partial<HandoverDecisionFrame> = {}): HandoverDecisionFrame {
  return {
    episodeId: 'episode-1',
    sourceFrameId: 'frame-10',
    simTimeMs: 10_000,
    phase: 'evaluating',
    serving: from,
    opportunities: [],
    states: [],
    provisionalLeader: null,
    selectedTarget: null,
    selectedKind: null,
    selectionHoldSec: 0,
    selectionHoldRequiredSec: 1,
    mode: 'service-continuity-protection',
    recentCommit: null,
    ...overrides,
  };
}

test('selected inter target remains measurement-only while the old serving link is sole solid owner', () => {
  const result = resolveHandoverAuthorityJoin(frame({
    phase: 'switching',
    selectedTarget: interTarget,
    selectedKind: 'inter-satellite',
  }));

  assert.equal(result?.transition?.kind, 'inter');
  assert.equal(result?.transition?.boundary, 'selected');
  assert.deepEqual(result?.transition?.from, from);
  assert.deepEqual(result?.transition?.to, interTarget);
  assert.deepEqual(result?.solidDataLinkKey, from);
  assert.equal(result?.solidDataLinkCount, 1);
  assert.equal(result?.showTransitionCue, true);
});

test('committed inter target atomically becomes the only solid owner', () => {
  const receipt = createHandoverCommitReceipt({
    episodeId: 'episode-1',
    sourceFrameId: 'frame-10',
    simTimeMs: 10_000,
    from,
    to: interTarget,
    kind: 'inter-satellite',
    mode: 'service-continuity-protection',
    reason: 'fixture',
    oldLinkEnded: true,
    newLinkStarted: true,
  });
  const result = resolveHandoverAuthorityJoin(frame({
    phase: 'switching',
    serving: interTarget,
    recentCommit: receipt,
  }));

  assert.equal(result?.transition?.boundary, 'committed');
  assert.deepEqual(result?.solidDataLinkKey, interTarget);
  assert.equal(result?.solidDataLinkCount, 1);
});

test('same-satellite beam switch uses the same transition contract', () => {
  const result = resolveHandoverAuthorityJoin(frame({
    phase: 'switching',
    selectedTarget: intraTarget,
    selectedKind: 'intra-satellite',
  }));

  assert.equal(result?.transition?.kind, 'intra');
  assert.equal(result?.transition?.from.satelliteId, result?.transition?.to.satelliteId);
  assert.notEqual(result?.transition?.from.beamId, result?.transition?.to.beamId);
  assert.equal(result?.showTransitionCue, true);
});

test('guard keeps only committed serving and cannot replay a stale transition pair', () => {
  const result = resolveHandoverAuthorityJoin(frame({
    phase: 'guard',
    serving: interTarget,
  }));

  assert.equal(result?.transition, null);
  assert.equal(result?.showTransitionCue, false);
  assert.deepEqual(result?.solidDataLinkKey, interTarget);
  assert.equal(result?.solidDataLinkCount, 1);
});

test('authority absence preserves the legacy lane boundary', () => {
  assert.equal(resolveHandoverAuthorityJoin(null), null);
});

test('presentation adapter keeps exact beam-to-cell geometry and fails closed when missing', () => {
  const join = resolveHandoverAuthorityJoin(frame({
    phase: 'switching',
    selectedTarget: interTarget,
    selectedKind: 'inter-satellite',
  }));
  const event = resolveAuthorityHandoverPresentationEvent(join, {
    source: 'walker',
    hasCellPlacement: () => true,
    hasSatelliteWorld: () => true,
    durationMs: { intra: 8_000, inter: 6_000 },
  });
  assert.equal(event?.from.cellId, from.beamId - 1);
  assert.equal(event?.to.cellId, interTarget.beamId - 1);
  assert.equal(event?.from.beamId, from.beamId);
  assert.equal(event?.to.beamId, interTarget.beamId);
  assert.equal(event?.eventId, join?.transition?.eventId);

  const missing = resolveAuthorityHandoverPresentationEvent(join, {
    source: 'walker',
    hasCellPlacement: cellId => cellId !== interTarget.beamId - 1,
    hasSatelliteWorld: () => true,
    durationMs: { intra: 8_000, inter: 6_000 },
  });
  assert.equal(missing, null);
});

test('authority presentation follows selected and committed frame boundaries instead of a wall clock', () => {
  const selectedJoin = resolveHandoverAuthorityJoin(frame({
    phase: 'switching',
    selectedTarget: interTarget,
    selectedKind: 'inter-satellite',
  }));
  const selectedEvent = resolveAuthorityHandoverPresentationEvent(selectedJoin, {
    source: 'walker',
    hasCellPlacement: () => true,
    hasSatelliteWorld: () => true,
    durationMs: { intra: 8_000, inter: 6_000 },
  });
  const selected = resolveAuthorityHandoverPresentationSnapshot(selectedJoin, selectedEvent);
  assert.equal(selected.mode, 'presenting');
  assert.equal(selected.view.phase, 'holding');
  assert.equal(selected.view.targetRole, 'candidate');

  const receipt = createHandoverCommitReceipt({
    episodeId: 'episode-1',
    sourceFrameId: 'frame-10',
    simTimeMs: 10_000,
    from,
    to: interTarget,
    kind: 'inter-satellite',
    mode: 'service-continuity-protection',
    reason: 'fixture',
    oldLinkEnded: true,
    newLinkStarted: true,
  });
  const committedJoin = resolveHandoverAuthorityJoin(frame({
    phase: 'switching',
    serving: interTarget,
    recentCommit: receipt,
  }));
  const committedEvent = resolveAuthorityHandoverPresentationEvent(committedJoin, {
    source: 'walker',
    hasCellPlacement: () => true,
    hasSatelliteWorld: () => true,
    durationMs: { intra: 8_000, inter: 6_000 },
  });
  const committed = resolveAuthorityHandoverPresentationSnapshot(committedJoin, committedEvent);
  assert.equal(committed.view.phase, 'releasing');
  assert.equal(committed.view.targetRole, 'serving');
  assert.equal(commitReceiptMatchesHandoverPresentation(receipt, committedEvent), true);
  assert.equal(commitReceiptMatchesHandoverPresentation(receipt, selectedEvent), true);
  assert.equal(commitReceiptMatchesHandoverPresentation(null, committedEvent), false);
  assert.equal(commitReceiptMatchesHandoverPresentation(receipt, {
    ...committedEvent!,
    to: { ...committedEvent!.to, cellId: committedEvent!.to.cellId + 1 },
  }), false);

  const guard = resolveAuthorityHandoverPresentationSnapshot(
    resolveHandoverAuthorityJoin(frame({ phase: 'guard', serving: interTarget })),
    committedEvent,
  );
  assert.equal(guard.mode, 'idle');
  assert.equal(guard.view.active, false);
});

test('same-cell intra cue keeps exact beam identity through selected and committed boundaries', () => {
  const cellId = 4;
  const source = candidateLinkKey('SAT-A', cellLinkBudgetBeamId(cellId));
  const target = candidateLinkKey('SAT-A', intraCellLinkBudgetBeamId(cellId));
  const selectedJoin = resolveHandoverAuthorityJoin(frame({
    phase: 'switching',
    serving: source,
    selectedTarget: target,
    selectedKind: 'intra-satellite',
  }));
  const geometry = {
    source: 'walker' as const,
    hasCellPlacement: (candidateCellId: number) => candidateCellId === cellId,
    hasSatelliteWorld: (satelliteId: string) => satelliteId === 'SAT-A',
    durationMs: { intra: 8_000, inter: 6_000 },
  };
  const selectedEvent = resolveAuthorityHandoverPresentationEvent(selectedJoin, geometry);

  assert.equal(selectedEvent?.from.cellId, cellId);
  assert.equal(selectedEvent?.to.cellId, cellId);
  assert.equal(selectedEvent?.from.beamId, source.beamId);
  assert.equal(selectedEvent?.to.beamId, target.beamId);
  assert.equal(selectedEvent?.eventId, selectedJoin?.transition?.eventId);
  const selected = resolveAuthorityHandoverPresentationSnapshot(selectedJoin, selectedEvent);
  assert.equal(selected.view.phase, 'holding');
  assert.equal(selected.view.targetRole, 'candidate');

  const receipt = createHandoverCommitReceipt({
    episodeId: 'episode-1',
    sourceFrameId: 'frame-10',
    simTimeMs: 10_000,
    from: source,
    to: target,
    kind: 'intra-satellite',
    mode: 'service-continuity-protection',
    reason: 'same-cell beam replacement fixture',
    oldLinkEnded: true,
    newLinkStarted: true,
  });
  const committedJoin = resolveHandoverAuthorityJoin(frame({
    phase: 'switching',
    serving: target,
    recentCommit: receipt,
  }));
  const committedEvent = resolveAuthorityHandoverPresentationEvent(committedJoin, geometry);

  assert.equal(committedEvent?.eventId, selectedEvent?.eventId);
  assert.equal(commitReceiptMatchesHandoverPresentation(receipt, selectedEvent), true);
  assert.equal(commitReceiptMatchesHandoverPresentation(receipt, committedEvent), true);
  const committed = resolveAuthorityHandoverPresentationSnapshot(committedJoin, committedEvent);
  assert.equal(committed.view.phase, 'releasing');
  assert.equal(committed.view.targetRole, 'serving');
});
