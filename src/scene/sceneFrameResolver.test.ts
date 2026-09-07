import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveSceneFrame } from './sceneFrameResolver';
import type { NormalizedSceneFrame } from './NormalizedSceneFrame';
import type { SceneGeometry } from './SceneGeometry';
import type { SimFrame } from './types';

const sim = {} as SimFrame;
const geometry = {} as SceneGeometry;

test('returns a supplied immutable scene frame before touching the live projector', () => {
  const supplied = { sceneSource: 'live' } as unknown as NormalizedSceneFrame;
  let projectorCalled = false;

  const result = resolveSceneFrame({
    propSceneFrame: supplied,
    sceneGeometry: geometry,
    sim,
    simSource: 'live',
    projectLiveFrame: () => {
      projectorCalled = true;
      return {} as NormalizedSceneFrame;
    },
  });

  assert.strictEqual(result, supplied);
  assert.equal(projectorCalled, false);
});

test('adds archived-TLE provenance and claim metadata to the projected frame', () => {
  const projected = {
    sceneSource: 'live',
    provenance: { kind: 'live' },
  } as unknown as NormalizedSceneFrame;
  const result = resolveSceneFrame({
    sceneGeometry: geometry,
    sim,
    simSource: 'archived-tle',
    archivedTleFrameIdentity: {
      frameId: 'frame-17',
      provenance: {
        archiveId: 'archive-2',
        propagationModel: 'SGP4',
      },
    } as never,
    projectLiveFrame: () => projected,
  });

  assert.equal(result.sceneSource, 'archived-tle');
  assert.deepEqual(result.provenance, {
    kind: 'archived-tle',
    sourceKind: 'ARCHIVED_TLE',
    propagationModel: 'SGP4',
    archiveId: 'archive-2',
    frameId: 'frame-17',
    note: 'Projection of one accepted immutable SGP4/canonical analysis frame.',
  });
  assert.deepEqual(result.claimBoundary?.forbiddenClaims, [
    'live ephemeris',
    'multi-satellite RF interference',
    'synthetic handover events',
    'physical energy saving',
  ]);
  assert.deepEqual(result.evidenceStatus?.notes, [
    'candidate is comparison-only and never an active interference owner',
  ]);
});

test('fails closed when an archived frame has no immutable identity', () => {
  assert.throws(
    () => resolveSceneFrame({
      sceneGeometry: geometry,
      sim,
      simSource: 'archived-tle',
      projectLiveFrame: () => ({} as NormalizedSceneFrame),
    }),
    /immutable frame provenance/,
  );
});
