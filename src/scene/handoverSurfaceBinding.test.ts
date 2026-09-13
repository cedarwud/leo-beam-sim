import assert from 'node:assert/strict';
import test from 'node:test';

import {
  HANDOVER_STORY_FRAME_SCHEMA_VERSION,
  freezeHandoverStoryFrame,
  resolveHandoverStoryFrameSet,
  resolveTeachingHandoverStoryFrame,
  type HandoverStoryEndpoint,
  type HandoverStoryFrame,
} from './handoverStoryFrame';
import {
  handoverSurfaceIdentityAttributes,
  resolveHandoverSurfaceBinding,
  resolveHandoverSurfaceBindings,
} from './handoverSurfaceBinding';
import {
  resolveBoundSceneHandoverStoryFrameSet,
  resolveBoundSceneHandoverSurfaceBindingSet,
} from './sceneHandoverStoryFrameSet';

const endpoint = (
  satelliteId: string,
  beamId: string,
): HandoverStoryEndpoint => ({
  satelliteId,
  cellId: Number(beamId) - 1,
  beamId,
  satelliteLabel: null,
  beamLabel: null,
  geometryStatus: 'drawable',
  ee: null,
  sinr: null,
  elevationDeg: null,
});
function acceptedFrame(): HandoverStoryFrame {
  return freezeHandoverStoryFrame({
    schemaVersion: HANDOVER_STORY_FRAME_SCHEMA_VERSION,
    storyId: 'accepted:episode-a:sat-a|1->sat-b|2',
    kind: 'inter',
    phase: 'switching',
    progress01: null,
    committed: false,
    ueId: 'ue-0',
    from: endpoint('sat-a', '1'),
    to: endpoint('sat-b', '2'),
    provenance: {
      producer: 'walker',
      claimClass: 'accepted-decision',
      decisionEvidence: 'accepted',
      snapshotId: 'snapshot-a',
      episodeId: 'episode-a',
      sourceFrameId: 'frame-a',
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
}
function teachingFrame(): HandoverStoryFrame {
  const frame = resolveTeachingHandoverStoryFrame({
    story: {
      kind: 'intra',
      sourceSatelliteId: 'sat-c',
      sourceCellId: 0,
      targetSatelliteId: null,
      targetCellId: 1,
      storyKey: 'teaching-intra:sat-c:0',
    },
    frame: {
      phase: { id: 'countdown' },
      phaseProgress01: 0.5,
      elapsedSec: 4,
      totalSec: 10,
      serving: {
        id: 'source', satelliteLabel: 'C', beamLabel: 'B1',
        eeKbitPerJoule: 100, elevationDeg: 45, role: 'serving',
      },
      winner: {
        id: 'target', satelliteLabel: 'C', beamLabel: 'B2',
        eeKbitPerJoule: 130, elevationDeg: 50, role: 'winner',
      },
      committed: false,
      switchProgress01: 0,
    },
  });
  assert.ok(frame);
  return frame;
}
test('accepted binding preserves the exact normalized frame reference', () => {
  const frame = acceptedFrame();
  const binding = resolveHandoverSurfaceBinding('accepted', frame);
  assert.ok(binding);
  assert.equal(binding.frame, frame);
  assert.equal(binding.source, 'accepted');
  assert.equal(binding.pairKey, 'inter:sat-a|1|0>sat-b|2|1');
  assert.match(binding.identityKey, /snapshot-a\|episode-a\|frame-a$/);
});

test('source and claim class mismatches fail closed', () => {
  const accepted = acceptedFrame();
  const teaching = teachingFrame();
  assert.equal(resolveHandoverSurfaceBinding('teaching', accepted), null);
  assert.equal(resolveHandoverSurfaceBinding('accepted', teaching), null);
  assert.equal(resolveHandoverSurfaceBinding('replay', teaching), null);
});

test('one binding set keeps the same frames for scene, rail and caption', () => {
  const accepted = acceptedFrame();
  const teaching = teachingFrame();
  const set = resolveHandoverStoryFrameSet({
    accepted, presentation: null, teaching, replay: null,
  });
  const bindings = resolveHandoverSurfaceBindings(set);
  assert.equal(bindings.accepted?.frame, accepted);
  assert.equal(bindings.teaching?.frame, teaching);
  assert.equal(bindings.active, bindings.teaching);
  assert.equal(bindings.active?.frame, set.active);
});
test('scene, rail and caption attributes carry one identical accepted identity', () => {
  const binding = resolveHandoverSurfaceBinding('accepted', acceptedFrame());
  assert.ok(binding);
  const scene = handoverSurfaceIdentityAttributes('scene', binding);
  const rail = handoverSurfaceIdentityAttributes('rail', binding);
  const caption = handoverSurfaceIdentityAttributes('caption', binding);
  const identityFields = [
    'data-handover-surface-active-source',
    'data-handover-surface-story-source',
    'data-handover-surface-story-id',
    'data-handover-surface-story-pair-key',
    'data-handover-surface-story-kind',
    'data-handover-surface-story-phase',
    'data-handover-surface-story-committed',
    'data-handover-surface-story-producer',
    'data-handover-surface-story-claim-class',
    'data-handover-surface-story-decision-evidence',
    'data-handover-surface-story-disclosure',
    'data-handover-surface-story-decision-input-allowed',
    'data-handover-surface-story-snapshot-id',
    'data-handover-surface-story-episode-id',
    'data-handover-surface-story-source-frame-id',
    'data-handover-surface-story-clock-basis',
    'data-handover-surface-story-clock-current-sec',
    'data-handover-surface-story-clock-duration-sec',
    'data-handover-surface-story-identity',
  ] as const;
  for (const field of identityFields) {
    assert.equal(scene[field], rail[field]);
    assert.equal(rail[field], caption[field]);
  }
  assert.equal(scene['data-handover-surface'], 'scene');
  assert.equal(rail['data-handover-surface'], 'rail');
  assert.equal(caption['data-handover-surface'], 'caption');
});

test('an absent binding publishes an explicit empty identity', () => {
  const attributes = handoverSurfaceIdentityAttributes('caption', null);
  assert.equal(attributes['data-handover-surface-binding'], 'none');
  assert.equal(attributes['data-handover-surface-story-id'], '');
  assert.equal(attributes['data-handover-surface-story-snapshot-id'], '');
});

function presentationFrame(): HandoverStoryFrame {
  return freezeHandoverStoryFrame({
    schemaVersion: HANDOVER_STORY_FRAME_SCHEMA_VERSION,
    storyId: 'presentation:manual:inter:sat-a>sat-b',
    kind: 'inter',
    phase: 'switching',
    progress01: 0.5,
    committed: false,
    ueId: 'ue-0',
    from: endpoint('sat-a', '1'),
    to: endpoint('sat-b', '2'),
    provenance: {
      producer: 'manual',
      claimClass: 'presentation-command',
      decisionEvidence: 'none',
      snapshotId: null,
      episodeId: null,
      sourceFrameId: null,
      disclosure: 'presentation-command-not-decision-evidence',
      decisionInputAllowed: false,
    },
    clock: {
      basis: 'presentation-wall-clock',
      currentSec: 4,
      durationSec: 12,
      sourceTimeSec: 42,
    },
  });
}

function replayFrame(): HandoverStoryFrame {
  return freezeHandoverStoryFrame({
    schemaVersion: HANDOVER_STORY_FRAME_SCHEMA_VERSION,
    storyId: 'replay:artifact:inter:sat-r1>sat-r2',
    kind: 'inter',
    phase: 'holding',
    progress01: 0.4,
    committed: false,
    ueId: 'ue-replay',
    from: endpoint('sat-r1', '3'),
    to: endpoint('sat-r2', '4'),
    provenance: {
      producer: 'artifact-replay',
      claimClass: 'recorded-replay',
      decisionEvidence: 'none',
      snapshotId: null,
      episodeId: null,
      sourceFrameId: null,
      disclosure: 'artifact-replay-read-only',
      decisionInputAllowed: false,
    },
    clock: {
      basis: 'replay-time',
      currentSec: 8,
      durationSec: 20,
      sourceTimeSec: 8,
    },
  });
}

test('artifact replay excludes accepted, teaching and presentation bindings', () => {
  const accepted = acceptedFrame();
  const teaching = teachingFrame();
  const replay = replayFrame();
  const presentation = presentationFrame();
  const sharedBindings = resolveHandoverSurfaceBindings(
    resolveHandoverStoryFrameSet({ accepted, presentation, teaching, replay }),
  );
  const local = resolveHandoverStoryFrameSet({
    accepted,
    presentation,
    teaching,
    replay,
  });
  const bound = resolveBoundSceneHandoverStoryFrameSet({
    lane: 'artifact-replay',
    localPresentation: local.presentation,
    sharedBindings,
  });

  assert.equal(bound.accepted, null);
  assert.equal(bound.presentation, null);
  assert.equal(bound.teaching, null);
  assert.equal(bound.replay, replay);
  assert.equal(bound.active, replay);
  assert.equal(bound.activeSource, 'replay');
  assert.deepEqual(bound.availableSources, ['replay']);
});

test('live scene preserves shared frames, adds local presentation, and drops replay', () => {
  const accepted = acceptedFrame();
  const teaching = teachingFrame();
  const replay = replayFrame();
  const presentation = presentationFrame();
  const sharedBindings = resolveHandoverSurfaceBindings(
    resolveHandoverStoryFrameSet({
      accepted,
      presentation: null,
      teaching,
      replay,
    }),
  );
  const local = resolveHandoverStoryFrameSet({
    accepted: null,
    presentation,
    teaching: null,
    replay: null,
  });
  const bound = resolveBoundSceneHandoverStoryFrameSet({
    lane: 'live',
    localPresentation: local.presentation,
    sharedBindings,
  });

  assert.equal(bound.accepted, accepted);
  assert.equal(bound.presentation, presentation);
  assert.equal(bound.teaching, teaching);
  assert.equal(bound.replay, null);
  assert.equal(bound.active, teaching);
  assert.equal(bound.activeSource, 'teaching');
  assert.deepEqual(bound.availableSources, ['accepted', 'presentation', 'teaching']);
});

test('live binding composition preserves exact shell authority and only creates presentation', () => {
  const accepted = acceptedFrame();
  const teaching = teachingFrame();
  const replay = replayFrame();
  const presentation = presentationFrame();
  const sharedBindings = resolveHandoverSurfaceBindings(
    resolveHandoverStoryFrameSet({
      accepted, presentation: null, teaching, replay,
    }),
  );
  const bound = resolveBoundSceneHandoverSurfaceBindingSet({
    lane: 'live',
    localPresentation: presentation,
    sharedBindings,
  });

  assert.equal(bound.accepted, sharedBindings.accepted);
  assert.equal(bound.teaching, sharedBindings.teaching);
  assert.equal(bound.replay, null);
  assert.equal(bound.presentation?.frame, presentation);
  assert.equal(bound.active, sharedBindings.teaching);
  assert.equal(bound.activeSource, 'teaching');
});

test('artifact binding composition preserves the exact shell replay binding', () => {
  const sharedBindings = resolveHandoverSurfaceBindings(
    resolveHandoverStoryFrameSet({
      accepted: acceptedFrame(),
      presentation: presentationFrame(),
      teaching: teachingFrame(),
      replay: replayFrame(),
    }),
  );
  const bound = resolveBoundSceneHandoverSurfaceBindingSet({
    lane: 'artifact-replay',
    localPresentation: presentationFrame(),
    sharedBindings,
  });

  assert.equal(bound.accepted, null);
  assert.equal(bound.presentation, null);
  assert.equal(bound.teaching, null);
  assert.equal(bound.replay, sharedBindings.replay);
  assert.equal(bound.active, sharedBindings.replay);
  assert.equal(bound.activeSource, 'replay');
});

test('identity key changes when phase, clock basis, or accepted provenance mutates', () => {
  const original = acceptedFrame();
  const originalBinding = resolveHandoverSurfaceBinding('accepted', original);
  assert.ok(originalBinding);

  const phaseMutation = freezeHandoverStoryFrame({
    ...original,
    phase: 'holding',
  });
  const clockMutation = freezeHandoverStoryFrame({
    ...original,
    clock: { ...original.clock, basis: 'replay-time' },
  });
  const provenanceMutation = freezeHandoverStoryFrame({
    ...original,
    provenance: { ...original.provenance, sourceFrameId: 'frame-mutated' },
  });

  for (const mutation of [phaseMutation, clockMutation, provenanceMutation]) {
    const binding = resolveHandoverSurfaceBinding('accepted', mutation);
    assert.ok(binding);
    assert.notEqual(binding.identityKey, originalBinding.identityKey);
  }
});

test('shared binding absence is authoritative and never falls back to local accepted state', () => {
  const localAccepted = acceptedFrame();
  const local = resolveHandoverStoryFrameSet({
    accepted: localAccepted,
    presentation: null,
    teaching: null,
    replay: null,
  });
  const emptyShared = resolveHandoverSurfaceBindings(
    resolveHandoverStoryFrameSet({
      accepted: null,
      presentation: null,
      teaching: null,
      replay: null,
    }),
  );
  const bound = resolveBoundSceneHandoverStoryFrameSet({
    lane: 'live',
    localPresentation: local.presentation,
    sharedBindings: emptyShared,
  });

  assert.equal(bound.accepted, null);
  assert.equal(bound.active, null);
  assert.equal(bound.activeSource, 'none');
  assert.deepEqual(bound.availableSources, []);
});
