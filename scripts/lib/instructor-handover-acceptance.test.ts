import assert from 'node:assert/strict';
import test from 'node:test';

import {
  R5_COMPARABLE_FIELDS,
  validateR5InstructorSurfaceSet,
  validateR5ReplayEquivalence,
  type R5InstructorRootTelemetry,
  type R5InstructorSurface,
  type R5InstructorTelemetry,
} from './instructor-handover-acceptance';

function surface(
  kind: 'intra' | 'inter',
  target: R5InstructorSurface,
): R5InstructorTelemetry {
  const inter = kind === 'inter';
  return {
    surface: target,
    binding: 'active',
    scenarioId: 'homepage-seven-beam-intra-inter-v1',
    scenarioVersion: '1',
    beamCount: '7',
    runId: '4',
    entryKind: 'intra',
    segmentIndex: inter ? '1' : '0',
    segmentKind: kind,
    status: 'paused',
    paused: 'true',
    speed: '5',
    sourceTimeSec: inter ? '124' : '52',
    segmentTimeSec: '52',
    durationSec: '144',
    windowStartSec: '0',
    windowEndSec: '144',
    complete: 'false',
    storyId: `teaching-${kind}:sat-a:0`,
    pairKey: `${kind}:sat-a|B1|0>${inter ? 'sat-b' : 'sat-a'}|B2|1`,
    phase: 'switching',
    committed: 'true',
  };
}

function root(kind: 'intra' | 'inter'): R5InstructorRootTelemetry {
  return {
    ...surface(kind, 'root'),
    runtimeBeamCount: '7',
    runtimeCandidateBeamCount: '7',
    sevenBeamAdmitted: 'true',
  };
}

function directInterSurface(target: R5InstructorSurface): R5InstructorTelemetry {
  return {
    ...surface('inter', target),
    entryKind: 'inter',
    durationSec: '72',
    windowStartSec: '72',
  };
}

function directInterRoot(): R5InstructorRootTelemetry {
  return {
    ...directInterSurface('root'),
    runtimeBeamCount: '7',
    runtimeCandidateBeamCount: '7',
    sevenBeamAdmitted: 'true',
  };
}

function validate(kind: 'intra' | 'inter') {
  return validateR5InstructorSurfaceSet(
    root(kind),
    surface(kind, 'scene'),
    surface(kind, 'rail'),
    surface(kind, 'caption'),
  );
}

test('independent R5 contract accepts the Intra switching checkpoint', () => {
  assert.deepEqual(validate('intra'), []);
});

test('independent R5 contract accepts the Inter switching checkpoint after Intra', () => {
  assert.deepEqual(validate('inter'), []);
});

test('independent R5 contract accepts a direct Inter entry window', () => {
  assert.deepEqual(
    validateR5InstructorSurfaceSet(
      directInterRoot(),
      directInterSurface('scene'),
      directInterSurface('rail'),
      directInterSurface('caption'),
    ),
    [],
  );
});

test('every comparable scene, rail, or caption mutation turns the gate red', () => {
  for (const kind of ['intra', 'inter'] as const) {
    const pristineRoot = root(kind);
    const pristine = {
      scene: surface(kind, 'scene'),
      rail: surface(kind, 'rail'),
      caption: surface(kind, 'caption'),
    } as const;
    for (const field of R5_COMPARABLE_FIELDS) {
      for (const target of ['scene', 'rail', 'caption'] as const) {
        const mutated = {
          ...pristine,
          [target]: {
            ...pristine[target],
            [field]: `${pristine[target][field] || 'empty'}-mutated`,
          },
        };
        assert.ok(
          validateR5InstructorSurfaceSet(
            pristineRoot,
            mutated.scene,
            mutated.rail,
            mutated.caption,
          ).length > 0,
          `${kind}.${target}.${field} stayed green`,
        );
      }
    }
  }
});
test('replay equivalence ignores run and playback-control identity', () => {
  const first = surface('inter', 'scene');
  const replay = {
    ...first,
    runId: '9',
    speed: '20',
    status: 'playing',
    paused: 'false',
  };
  assert.deepEqual(validateR5ReplayEquivalence(first, replay), []);
});

test('a replay story mutation turns equivalence red', () => {
  const first = surface('inter', 'scene');
  assert.ok(validateR5ReplayEquivalence(first, {
    ...first,
    storyId: `${first.storyId}-mutated`,
  }).length > 0);
});

test('a root source-time mutation turns the cross-surface gate red', () => {
  const mutatedRoot = { ...root('intra'), sourceTimeSec: '53' };
  assert.ok(validateR5InstructorSurfaceSet(
    mutatedRoot,
    surface('intra', 'scene'),
    surface('intra', 'rail'),
    surface('intra', 'caption'),
  ).length > 0);
});
