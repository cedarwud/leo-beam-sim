import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';

import type { SinrLiveCellBeamConeRenderItem } from '../viz/SinrLiveCellBeamCones';
import { resolveSinrLiveCellTruthSpineParticlePlans } from './sinrLiveCellTruthSpineParticlePlans';

const cone: SinrLiveCellBeamConeRenderItem = {
  cellId: 2,
  satId: 'sat-a',
  frequencyIndex: 0,
  serving: true,
  color: '#abc123',
  apex: new THREE.Vector3(1, 2, 3),
  baseCenter: new THREE.Vector3(4, 0, 5),
  baseRadiusWorld: 6,
};

test('builds a stable particle row from the restricted hero cone', () => {
  const plans = resolveSinrLiveCellTruthSpineParticlePlans({
    enabled: true,
    multiCandidateCentralOverlayActive: false,
    displayHeroRecord: { servingSatId: 'sat-a', cellId: 2 },
    coneItems: [cone],
    restrictItems: items => items,
    particlesPerBeam: 3,
  });

  assert.equal(plans.length, 3);
  assert.deepEqual(plans.map(plan => plan.id), [
    'cell-truth:sat-a:C2:P0',
    'cell-truth:sat-a:C2:P1',
    'cell-truth:sat-a:C2:P2',
  ]);
  assert.deepEqual(plans.map(plan => plan.phaseOffset), [0, 1 / 3, 2 / 3]);
  assert.equal(plans[0]!.beamId, 3);
  assert.deepEqual(plans[0]!.start.toArray(), [1, 2, 3]);
  assert.deepEqual(plans[0]!.end.toArray(), [4, 0, 5]);
  assert.notStrictEqual(plans[0]!.start, plans[1]!.start);
});

test('returns no particles when the display gate or hero cone is unavailable', () => {
  const input = {
    enabled: true,
    multiCandidateCentralOverlayActive: false,
    displayHeroRecord: { servingSatId: 'sat-a', cellId: 2 },
    coneItems: [cone],
    restrictItems: () => [],
    particlesPerBeam: 3,
  };

  assert.deepEqual(
    resolveSinrLiveCellTruthSpineParticlePlans({ ...input, enabled: false }),
    [],
  );
  assert.deepEqual(
    resolveSinrLiveCellTruthSpineParticlePlans(input),
    [],
  );
});
