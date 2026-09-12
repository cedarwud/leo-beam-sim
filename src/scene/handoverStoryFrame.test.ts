import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir } from 'node:fs/promises';

import {
  candidateLinkKey,
  createCandidateGateResult,
  createHandoverCommitReceipt,
  createHandoverDecisionFrame,
  createMetricEvidence,
  freezeCandidateOpportunity,
  type CandidateDecisionState,
  type CandidateGateResult,
  type HandoverDecisionFrame,
  type HandoverKind,
} from '../engine/handover/candidateDecisionContract';
import {
  buildAcceptedHandoverPresentationSession,
  createHandoverPresentationPolicyConfigHash,
  type AcceptedHandoverPresentationSnapshot,
} from './acceptedHandoverPresentationSnapshot';
import type {
  HandoverPresentationEvent,
  HandoverPresentationView,
} from './handoverPresentationOwner';
import type { NormalizedSceneFrame } from './NormalizedSceneFrame';
import {
  HANDOVER_STORY_FRAME_SCHEMA_VERSION,
  handoverStoryPairKey,
  resolveAcceptedHandoverStoryFrame,
  resolveHandoverStoryFrameSet,
  resolvePresentationHandoverStoryFrame,
  resolveReplayHandoverStoryFrame,
  resolveTeachingHandoverStoryFrame,
  validateHandoverStoryFrame,
  type HandoverStoryFrame,
  type HandoverTeachingFrameInput,
  type HandoverTeachingSceneStory,
} from './handoverStoryFrame';

function metric(sourceFrameId: string, value: number, unit: string) {
  return createMetricEvidence({
    status: 'available',
    value,
    unit,
    sourceFrameId,
    reason: null,
  });
}

function gate(
  code: CandidateGateResult['code'],
  result: CandidateGateResult['result'] = 'pass',
) {
  return createCandidateGateResult({
    code,
    category: code === 'ee-advantage' ? 'decision-trigger' : 'hard-qos',
    result,
    measured: result === 'unavailable' ? null : 1,
    threshold: result === 'unavailable' ? null : 0,
    unit: result === 'unavailable' ? null : 'unit',
    reason: result === 'pass' ? null : `${code} unavailable in fixture`,
  });
}

function opportunity(
  sourceFrameId: string,
  satelliteId: string,
  beamId: number,
  eeBitsPerJoule: number,
) {
  return freezeCandidateOpportunity({
    key: candidateLinkKey(satelliteId, beamId),
    primaryUeId: 'ue-ntpu',
    sourceFrameId,
    beamIdentitySource: 'walker-cell-surrogate',
    geometryClass: 'service-eligible',
    elevation: metric(sourceFrameId, 45, 'deg'),
    steering: metric(sourceFrameId, 4, 'deg'),
    range: metric(sourceFrameId, 850, 'km'),
    sinr: metric(sourceFrameId, 12, 'dB'),
    predictedThroughput: metric(sourceFrameId, 100, 'bit/s'),
    remainingServiceTime: metric(sourceFrameId, 120, 's'),
    instantaneousEe: metric(sourceFrameId, eeBitsPerJoule, 'bit/J'),
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

function state(
  satelliteId: string,
  beamId: number,
  rank: number,
): CandidateDecisionState {
  return {
    key: candidateLinkKey(satelliteId, beamId),
    hardEligibility: 'eligible',
    triggerStatus: 'satisfied',
    qualificationSec: 4,
    requiredTttSec: 3,
    stable: true,
    rank,
    rejectionCodes: [],
  };
}

const policyConfigHash = createHandoverPresentationPolicyConfigHash('story-frame-test');

function switchingDecision(kind: HandoverKind): {
  readonly decision: HandoverDecisionFrame;
  readonly source: ReturnType<typeof candidateLinkKey>;
  readonly target: ReturnType<typeof candidateLinkKey>;
} {
  const source = candidateLinkKey('sat-a', 1);
  const target = kind === 'intra-satellite'
    ? candidateLinkKey('sat-a', 2)
    : candidateLinkKey('sat-b', 2);
  const sourceFrameId = `frame-${kind}`;
  const decision = createHandoverDecisionFrame({
    episodeId: `episode-${kind}`,
    sourceFrameId,
    epochToken: `epoch-${kind}`,
    simTimeMs: 12_000,
    phase: 'switching',
    serving: source,
    opportunities: [
      opportunity(sourceFrameId, source.satelliteId, source.beamId, 120_000),
      opportunity(sourceFrameId, target.satelliteId, target.beamId, 160_000),
    ],
    states: [
      state(source.satelliteId, source.beamId, 2),
      state(target.satelliteId, target.beamId, 1),
    ],
    provisionalLeader: target,
    selectedTarget: target,
    selectedKind: kind,
    selectionHoldSec: 1,
    selectionHoldRequiredSec: 1.5,
    mode: 'ee-optimization',
    recentCommit: null,
  });
  return { decision, source, target };
}

function acceptedSnapshot(
  kind: HandoverKind,
  committed = false,
): AcceptedHandoverPresentationSnapshot {
  const { decision, source, target } = switchingDecision(kind);
  const initial = buildAcceptedHandoverPresentationSession({
    decision,
    policyConfigHash,
    pinnedKey: null,
    instantaneousEeActive: true,
    displayAllHardEligibleCandidates: true,
    configuredBeamCount: 7,
  });
  if (!committed) return initial.snapshot;
  const commitFrameId = `commit-${kind}`;
  const receipt = createHandoverCommitReceipt({
    episodeId: decision.episodeId,
    sourceFrameId: commitFrameId,
    simTimeMs: 12_500,
    from: source,
    to: target,
    kind,
    mode: 'ee-optimization',
    reason: 'story-frame commit fixture',
    oldLinkEnded: true,
    newLinkStarted: true,
  });
  const committedDecision = createHandoverDecisionFrame({
    ...decision,
    sourceFrameId: commitFrameId,
    simTimeMs: 12_500,
    serving: target,
    opportunities: [
      opportunity(commitFrameId, target.satelliteId, target.beamId, 165_000),
    ],
    states: [state(target.satelliteId, target.beamId, 1)],
    provisionalLeader: null,
    selectedTarget: null,
    selectedKind: null,
    recentCommit: receipt,
  });
  return buildAcceptedHandoverPresentationSession({
    decision: committedDecision,
    policyConfigHash,
    pinnedKey: null,
    previousSnapshot: initial.snapshot,
    instantaneousEeActive: true,
    displayAllHardEligibleCandidates: true,
    configuredBeamCount: 7,
  }).snapshot;
}

function presentationView(
  event: HandoverPresentationEvent,
  phase: HandoverPresentationView['phase'] = 'releasing',
  progress01 = 0.75,
): HandoverPresentationView {
  return {
    active: true,
    event,
    phase,
    progress01,
    autoSlowActive: true,
    sourceRole: 'serving',
    targetRole: phase === 'settled' ? 'serving' : 'candidate',
  };
}

function presentationEvent(
  source: HandoverPresentationEvent['source'],
  kind: HandoverPresentationEvent['kind'],
): HandoverPresentationEvent {
  const intra = kind === 'intra';
  return {
    eventId: `${source}-${kind}-event`,
    source,
    kind,
    ueId: 'ue-1',
    sourceTimeSec: 42,
    from: {
      satId: 'sat-a',
      cellId: 0,
      beamId: 1,
      drawable: true,
    },
    to: {
      satId: intra ? 'sat-a' : 'sat-b',
      cellId: intra ? 0 : 2,
      beamId: intra ? 2 : 3,
      drawable: true,
    },
    durationMs: 12_000,
    fromSinrDb: 8,
    toSinrDb: 12,
    deltaDb: 4,
  };
}

function teachingFrame(
  phase: HandoverTeachingFrameInput['phase']['id'] = 'countdown',
): HandoverTeachingFrameInput {
  return {
    phase: { id: phase },
    phaseProgress01: 0.5,
    elapsedSec: 24,
    totalSec: 48,
    serving: {
      id: 'serving',
      satelliteLabel: 'SAT-A',
      beamLabel: 'B1',
      eeKbitPerJoule: 124,
      elevationDeg: 52,
      role: 'serving',
    },
    winner: {
      id: 'winner',
      satelliteLabel: 'SAT-B',
      beamLabel: 'B2',
      eeKbitPerJoule: 162,
      elevationDeg: 61,
      role: 'winner',
    },
    committed: phase === 'settled',
    switchProgress01: phase === 'switching' ? 0.5 : 0,
  };
}

function teachingStory(kind: 'intra' | 'inter'): HandoverTeachingSceneStory {
  return {
    kind,
    sourceSatelliteId: 'sat-a',
    sourceCellId: 0,
    targetSatelliteId: kind === 'inter' ? 'sat-b' : null,
    targetCellId: kind === 'intra' ? 1 : null,
    storyKey: `teaching-${kind}`,
  };
}

function replayFrame(kind: 'intra' | 'inter'): NormalizedSceneFrame {
  const intra = kind === 'intra';
  return {
    sceneSource: 'artifact-replay',
    frameIndex: 7,
    tSec: 42,
    handover: {
      kind: intra
        ? 'intra-satellite-beam-switch'
        : 'inter-satellite-handover',
      phase: 'committing',
      sourceHandoverOccurred: true,
      servingSatelliteId: 'sat-a',
      servingBeamId: 'beam-a',
      targetSatelliteId: intra ? 'sat-a' : 'sat-b',
      targetBeamId: 'beam-b',
    },
    transitionProgress: intra
      ? {
        intra: {
          satId: 'sat-a',
          fromBeamId: 'beam-a',
          toBeamId: 'beam-b',
          progress01: 0.6,
          expiresAtSec: 43,
        },
      }
      : {
        inter: {
          fromSatId: 'sat-a',
          fromBeamId: 'beam-a',
          toSatId: 'sat-b',
          toBeamId: 'beam-b',
          progress01: 0.6,
          expiresAtSec: 43,
        },
      },
  } as unknown as NormalizedSceneFrame;
}

function requireFrame(frame: HandoverStoryFrame | null): HandoverStoryFrame {
  assert.ok(frame);
  return frame;
}

test('accepted adapter preserves exact pair, evidence, provenance and commit state', () => {
  for (const kind of ['intra-satellite', 'inter-satellite'] as const) {
    const snapshot = acceptedSnapshot(kind);
    const frame = requireFrame(resolveAcceptedHandoverStoryFrame({
      snapshot,
      producer: 'walker',
      resolveCellId: beamId => beamId - 1,
      isDrawable: (_satelliteId, cellId) => cellId !== null,
    }));

    assert.equal(frame.schemaVersion, HANDOVER_STORY_FRAME_SCHEMA_VERSION);
    assert.equal(frame.kind, kind === 'intra-satellite' ? 'intra' : 'inter');
    assert.equal(frame.phase, 'switching');
    assert.equal(frame.committed, false);
    assert.equal(frame.from.satelliteId, 'sat-a');
    assert.equal(frame.from.beamId, '1');
    assert.equal(frame.from.cellId, 0);
    assert.equal(frame.to.beamId, '2');
    assert.equal(frame.to.cellId, 1);
    assert.equal(frame.from.ee?.value, 120_000);
    assert.equal(frame.to.ee?.value, 160_000);
    assert.equal(frame.from.ee?.sourceFrameId, snapshot.sourceFrameId);
    assert.equal(frame.provenance.snapshotId, snapshot.snapshotId);
    assert.equal(frame.provenance.decisionEvidence, 'accepted');
    assert.equal(frame.provenance.decisionInputAllowed, false);
    assert.equal(frame.clock.basis, 'simulation-time');
    assert.equal(frame.clock.currentSec, 12);
    assert.ok(Object.isFrozen(frame));
    assert.ok(Object.isFrozen(frame.from));
    assert.ok(Object.isFrozen(frame.from.ee));
  }
});
test('accepted adapter recognises the exact retained commit without rewriting EE evidence', () => {
  const snapshot = acceptedSnapshot('inter-satellite', true);
  const frame = requireFrame(resolveAcceptedHandoverStoryFrame({
    snapshot,
    producer: 'tle',
    resolveCellId: beamId => beamId - 1,
  }));

  assert.equal(frame.committed, true);
  assert.equal(frame.provenance.producer, 'tle');
  assert.equal(frame.from.ee?.value, 120_000);
  assert.equal(frame.to.ee?.value, 160_000);
  assert.equal(frame.from.ee?.sourceFrameId, 'frame-inter-satellite');
  assert.equal(frame.to.ee?.sourceFrameId, 'frame-inter-satellite');
  assert.equal(frame.progress01, null);
});

test('accepted adapter fails closed when no accepted transition exists', () => {
  assert.equal(resolveAcceptedHandoverStoryFrame({
    snapshot: null,
    producer: 'walker',
    resolveCellId: () => null,
  }), null);
});

test('accepted adapter preserves exact beam identity when no cell mapping is supplied', () => {
  const frame = requireFrame(resolveAcceptedHandoverStoryFrame({
    snapshot: acceptedSnapshot('intra-satellite'),
    producer: 'walker',
  }));
  assert.equal(frame.from.cellId, null);
  assert.equal(frame.to.cellId, null);
  assert.equal(frame.from.beamId, '1');
  assert.equal(frame.to.beamId, '2');
});

test('presentation adapter distinguishes observed events from display commands', () => {
  const manual = requireFrame(resolvePresentationHandoverStoryFrame({
    view: presentationView(presentationEvent('manual', 'inter')),
  }));
  assert.equal(manual.kind, 'inter');
  assert.equal(manual.phase, 'switching');
  assert.equal(manual.progress01, 0.75);
  assert.equal(manual.from.beamId, '1');
  assert.equal(manual.to.beamId, '3');
  assert.equal(manual.from.sinr?.value, 8);
  assert.equal(manual.from.sinr?.provenance, 'observed-presentation');
  assert.equal(manual.provenance.producer, 'manual');
  assert.equal(manual.provenance.claimClass, 'presentation-command');
  assert.equal(manual.provenance.decisionEvidence, 'none');
  assert.equal(manual.clock.currentSec, 9);

  const observed = requireFrame(resolvePresentationHandoverStoryFrame({
    view: presentationView(presentationEvent('walker', 'intra'), 'measuring', 0.25),
  }));
  assert.equal(observed.kind, 'intra');
  assert.equal(observed.phase, 'measuring');
  assert.equal(observed.from.satelliteId, observed.to.satelliteId);
  assert.notEqual(observed.from.beamId, observed.to.beamId);
  assert.equal(observed.provenance.claimClass, 'observed-simulation');
  assert.equal(observed.provenance.disclosure, 'observed-simulation-read-only');
});

test('presentation adapter rejects inactive or undrawable stories', () => {
  const event = presentationEvent('cinema', 'inter');
  assert.equal(resolvePresentationHandoverStoryFrame({
    view: { ...presentationView(event), active: false },
  }), null);
  assert.equal(resolvePresentationHandoverStoryFrame({
    view: {
      ...presentationView(event),
      event: { ...event, to: { ...event.to, drawable: false } },
    },
  }), null);
});

test('teaching adapter keeps authored values visibly outside decision evidence', () => {
  const frame = requireFrame(resolveTeachingHandoverStoryFrame({
    story: teachingStory('intra'),
    frame: teachingFrame(),
    isDrawable: () => true,
  }));

  assert.equal(frame.kind, 'intra');
  assert.equal(frame.phase, 'holding');
  assert.equal(frame.progress01, 0.5);
  assert.equal(frame.from.satelliteId, 'sat-a');
  assert.equal(frame.to.satelliteId, 'sat-a');
  assert.equal(frame.from.cellId, 0);
  assert.equal(frame.to.cellId, 1);
  assert.equal(frame.from.beamId, null);
  assert.equal(frame.from.beamLabel, 'B1');
  assert.equal(frame.to.beamLabel, 'B2');
  assert.equal(frame.from.ee?.status, 'authored');
  assert.equal(frame.from.ee?.provenance, 'authored-teaching');
  assert.equal(frame.provenance.claimClass, 'authored-teaching');
  assert.equal(frame.provenance.decisionEvidence, 'none');
  assert.equal(frame.provenance.snapshotId, null);
  assert.equal(frame.provenance.sourceFrameId, null);
  assert.equal(frame.provenance.decisionInputAllowed, false);
  assert.equal(frame.clock.basis, 'teaching-script');
  assert.ok(Object.isFrozen(frame.to.ee));
});

test('teaching adapter fails closed on impossible identities or non-finite authored EE', () => {
  const invalidInter = {
    ...teachingStory('inter'),
    targetSatelliteId: 'sat-a',
  };
  assert.equal(resolveTeachingHandoverStoryFrame({
    story: invalidInter,
    frame: teachingFrame(),
  }), null);

  const invalidEe = teachingFrame();
  assert.equal(resolveTeachingHandoverStoryFrame({
    story: teachingStory('intra'),
    frame: {
      ...invalidEe,
      serving: { ...invalidEe.serving, eeKbitPerJoule: Number.NaN },
    },
  }), null);
});

test('artifact replay adapter preserves source-native beam tokens and recorded provenance', () => {
  for (const kind of ['intra', 'inter'] as const) {
    const frame = requireFrame(resolveReplayHandoverStoryFrame({
      frame: replayFrame(kind),
    }));
    assert.equal(frame.kind, kind);
    assert.equal(frame.phase, 'switching');
    assert.equal(frame.progress01, 0.6);
    assert.equal(frame.from.beamId, 'beam-a');
    assert.equal(frame.to.beamId, 'beam-b');
    assert.equal(frame.provenance.producer, 'artifact-replay');
    assert.equal(frame.provenance.claimClass, 'recorded-replay');
    assert.equal(frame.provenance.decisionEvidence, 'none');
    assert.equal(frame.provenance.decisionInputAllowed, false);
    assert.equal(frame.clock.basis, 'replay-time');
    assert.equal(frame.clock.currentSec, 42);
    if (kind === 'intra') {
      assert.equal(frame.from.satelliteId, frame.to.satelliteId);
    } else {
      assert.notEqual(frame.from.satelliteId, frame.to.satelliteId);
    }
  }
});

test('artifact replay adapter does not reconstruct missing or unknown event truth', () => {
  const missingTransition = replayFrame('inter');
  assert.equal(resolveReplayHandoverStoryFrame({
    frame: { ...missingTransition, transitionProgress: {} },
  }), null);
  const unknownPhase = replayFrame('inter');
  assert.equal(resolveReplayHandoverStoryFrame({
    frame: {
      ...unknownPhase,
      handover: { ...unknownPhase.handover, phase: 'producer-private-phase' },
    },
  }), null);
});

test('frame-set ownership is deterministic across teaching, live and replay inputs', () => {
  const accepted = requireFrame(resolveAcceptedHandoverStoryFrame({
    snapshot: acceptedSnapshot('inter-satellite'),
    producer: 'walker',
    resolveCellId: beamId => beamId - 1,
  }));
  const presentation = requireFrame(resolvePresentationHandoverStoryFrame({
    view: presentationView(presentationEvent('cinema', 'inter')),
  }));
  const teaching = requireFrame(resolveTeachingHandoverStoryFrame({
    story: teachingStory('inter'),
    frame: teachingFrame('switching'),
  }));
  const replay = requireFrame(resolveReplayHandoverStoryFrame({
    frame: replayFrame('inter'),
  }));

  const all = resolveHandoverStoryFrameSet({
    accepted,
    presentation,
    teaching,
    replay,
  });
  assert.equal(all.active, teaching);
  assert.equal(all.activeSource, 'teaching');
  assert.deepEqual(all.availableSources, [
    'accepted',
    'presentation',
    'teaching',
    'replay',
  ]);

  const withoutTeaching = resolveHandoverStoryFrameSet({
    accepted,
    presentation,
    teaching: null,
    replay,
  });
  assert.equal(withoutTeaching.active, presentation);
  assert.equal(withoutTeaching.activeSource, 'presentation');

  const replayOnly = resolveHandoverStoryFrameSet({
    accepted: null,
    presentation: null,
    teaching: null,
    replay,
  });
  assert.equal(replayOnly.active, replay);
  assert.equal(replayOnly.activeSource, 'replay');
});

test('pair key is stable across phases and source clocks', () => {
  const first = requireFrame(resolvePresentationHandoverStoryFrame({
    view: presentationView(presentationEvent('walker', 'inter'), 'measuring', 0.2),
  }));
  const second = requireFrame(resolvePresentationHandoverStoryFrame({
    view: presentationView(presentationEvent('walker', 'inter'), 'settled', 1),
  }));
  assert.equal(handoverStoryPairKey(first), handoverStoryPairKey(second));
});

test('validator rejects kind, clock and decision-direction corruption', () => {
  const valid = requireFrame(resolvePresentationHandoverStoryFrame({
    view: presentationView(presentationEvent('manual', 'inter')),
  }));
  assert.doesNotThrow(() => validateHandoverStoryFrame(valid));
  assert.throws(() => validateHandoverStoryFrame({
    ...valid,
    to: { ...valid.to, satelliteId: valid.from.satelliteId },
  }), /different satellites/);
  assert.throws(() => validateHandoverStoryFrame({
    ...valid,
    clock: { ...valid.clock, currentSec: Number.NaN },
  }), /clock/);
  assert.throws(() => validateHandoverStoryFrame({
    ...valid,
    provenance: {
      ...valid.provenance,
      decisionInputAllowed: true,
    } as unknown as HandoverStoryFrame['provenance'],
  }), /never be decision inputs/);

  const intra = requireFrame(resolvePresentationHandoverStoryFrame({
    view: presentationView(presentationEvent('manual', 'intra')),
  }));
  assert.throws(() => validateHandoverStoryFrame({
    ...intra,
    to: {
      ...intra.to,
      cellId: intra.from.cellId,
      beamId: intra.from.beamId,
      beamLabel: 'misleading-display-label',
    },
  }), /identities must differ/);
});

test('story contract stays runtime-free and teaching renderer consumes only the shared projection', async () => {
  const moduleDirectory = new URL('./handover-story/', import.meta.url);
  const moduleNames = (await readdir(moduleDirectory)).filter(name => name.endsWith('.ts'));
  const moduleSources = await Promise.all(moduleNames.map(name =>
    readFile(new URL(name, moduleDirectory), 'utf8')));
  const contractSource = [
    await readFile(new URL('./handoverStoryFrame.ts', import.meta.url), 'utf8'),
    ...moduleSources,
  ].join('\n');
  const rendererSource = await readFile(new URL('../viz/HandoverTeachingBeamCones.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(contractSource, /from ['"]react['"]/);
  assert.doesNotMatch(contractSource, /from ['"]three['"]/);
  assert.doesNotMatch(contractSource, /from ['"]@react-three\/fiber['"]/);
  assert.doesNotMatch(contractSource, /from ['"][^'"]*\/viz\//);
  assert.doesNotMatch(contractSource, /\bDate\.now\s*\(/);
  assert.doesNotMatch(contractSource, /\bperformance\.now\s*\(/);
  assert.match(
    rendererSource,
    /readonly projectionRef: MutableRefObject<HandoverTeachingSurfaceProjection \| null>/,
  );
  assert.doesNotMatch(rendererSource, /HandoverTeachingSceneStory/);
  assert.doesNotMatch(rendererSource, /readonly story:/);
  assert.doesNotMatch(rendererSource, /readonly frameRef:/);
  assert.doesNotMatch(rendererSource, /frameRef\.current/);
  assert.doesNotMatch(rendererSource, /story\.(source|target)(SatelliteId|CellId)/);
});
