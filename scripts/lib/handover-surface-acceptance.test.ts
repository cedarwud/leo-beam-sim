import assert from 'node:assert/strict';
import test from 'node:test';

import {
  R4_COMPARABLE_FIELDS,
  validateR4AcceptedRoot,
  validateR4SurfaceSet,
  type R4AcceptedRootTelemetry,
  type R4SurfaceTelemetry,
} from './handover-surface-acceptance';

function acceptedSurface(surface: 'scene' | 'rail' | 'caption'): R4SurfaceTelemetry {
  return {
    surface,
    binding: 'bound',
    contract: surface === 'scene' ? '' : 'matched',
    activeSource: 'accepted',
    source: 'accepted',
    storyId: 'accepted:episode-a:sat-a|1->sat-b|2',
    kind: 'inter',
    pairKey: 'inter:sat-a|1|0>sat-b|2|1',
    phase: 'holding',
    committed: 'false',
    producer: 'walker',
    claimClass: 'accepted-decision',
    decisionEvidence: 'accepted',
    disclosure: 'accepted-decision-read-only',
    decisionInputAllowed: 'false',
    snapshotId: 'snapshot-a',
    episodeId: 'episode-a',
    sourceFrameId: 'frame-a',
    clockBasis: 'simulation-time',
    clockCurrentSec: '42',
    clockDurationSec: '',
    identity: 'accepted|identity|a',
  };
}

function teachingSurface(surface: 'scene' | 'rail' | 'caption'): R4SurfaceTelemetry {
  return {
    surface,
    binding: 'bound',
    contract: surface === 'scene' ? '' : 'matched',
    activeSource: 'teaching',
    source: 'teaching',
    storyId: 'teaching-intra:sat-c:0',
    kind: 'intra',
    pairKey: 'intra:sat-c|B1|0>sat-c|B2|1',
    phase: 'holding',
    committed: 'false',
    producer: 'teaching',
    claimClass: 'authored-teaching',
    decisionEvidence: 'none',
    disclosure: 'authored-teaching-not-measured',
    decisionInputAllowed: 'false',
    snapshotId: '',
    episodeId: '',
    sourceFrameId: '',
    clockBasis: 'teaching-script',
    clockCurrentSec: '18',
    clockDurationSec: '90',
    identity: 'teaching|identity|a',
  };
}

function mutate(
  telemetry: R4SurfaceTelemetry,
  field: (typeof R4_COMPARABLE_FIELDS)[number],
): R4SurfaceTelemetry {
  const current = telemetry[field];
  const next = field === 'committed'
    ? (current === 'true' ? 'false' : 'true')
    : `${current || 'empty'}-mutated`;
  return { ...telemetry, [field]: next };
}

const ACCEPTED_ROOT: R4AcceptedRootTelemetry = {
  snapshotId: 'snapshot-a',
  episodeId: 'episode-a',
  sourceFrameId: 'frame-a',
  phase: 'selection-hold',
  simTimeSec: '42',
};

test('independent acceptance contract accepts complete accepted telemetry', () => {
  const scene = acceptedSurface('scene');
  const rail = acceptedSurface('rail');
  const caption = acceptedSurface('caption');
  assert.deepEqual(validateR4SurfaceSet('accepted', scene, rail, caption), []);
  assert.deepEqual(validateR4AcceptedRoot(scene, ACCEPTED_ROOT), []);
});

test('independent acceptance contract accepts complete teaching telemetry', () => {
  assert.deepEqual(
    validateR4SurfaceSet(
      'teaching',
      teachingSurface('scene'),
      teachingSurface('rail'),
      teachingSurface('caption'),
    ),
    [],
  );
});

test('every comparable scene, rail, or caption identity mutation turns the gate red', () => {
  const pristine = {
    scene: acceptedSurface('scene'),
    rail: acceptedSurface('rail'),
    caption: acceptedSurface('caption'),
  } as const;
  for (const field of R4_COMPARABLE_FIELDS) {
    for (const surface of ['scene', 'rail', 'caption'] as const) {
      const mutated = {
        ...pristine,
        [surface]: mutate(pristine[surface], field),
      };
      const errors = validateR4SurfaceSet(
        'accepted',
        mutated.scene,
        mutated.rail,
        mutated.caption,
      );
      assert.ok(errors.length > 0, `${surface}.${field} mutation stayed green`);
      assert.deepEqual(
        validateR4SurfaceSet(
          'accepted',
          pristine.scene,
          pristine.rail,
          pristine.caption,
        ),
        [],
        `${surface}.${field} did not return green after restoration`,
      );
    }
  }
});

test('accepted root snapshot, episode, frame, phase, and clock mutations turn red', () => {
  const scene = acceptedSurface('scene');
  for (const field of Object.keys(ACCEPTED_ROOT) as (keyof R4AcceptedRootTelemetry)[]) {
    const mutated = { ...ACCEPTED_ROOT, [field]: `${ACCEPTED_ROOT[field]}-mutated` };
    assert.ok(validateR4AcceptedRoot(scene, mutated).length > 0, `${field} stayed green`);
  }
  assert.deepEqual(validateR4AcceptedRoot(scene, ACCEPTED_ROOT), []);
});
