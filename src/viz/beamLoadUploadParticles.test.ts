#!/usr/bin/env node

import * as THREE from 'three';
import {
  MAX_FOCUS_CONES,
  UPLOAD_PARTICLES_GLOBAL_CAP,
  UPLOAD_PARTICLES_MIN_FLOOR,
  UPLOAD_PARTICLES_PER_CONE_HARD_CAP,
  normalizeUploadParticleProgress,
  resolveUploadParticleConeCount,
  resolveUploadParticleCountForLoad,
  resolveUploadParticleEnabledCount,
  resolveUploadParticleGlobalCount,
} from './beamLoadUploadParticles';
import { resolveUploadParticleConePlans } from './BeamLoadUploadParticles';
import type { CellBeamConeRenderItem } from './CellBeamCones';
import type { BeamLoadContentionModel, UeBeamLoadContention } from '../scene/beamLoadContention';

function cone(satId: string, beamIndex: number, cellId: number): CellBeamConeRenderItem {
  return {
    assignment: { cellId, satId, beamIndex, satVisualIndex: 0 },
    color: '#76ead7',
    apex: new THREE.Vector3(0, 100, 0),
    baseCenter: new THREE.Vector3(cellId * 10, 0, 0),
    midpoint: new THREE.Vector3(0, 50, 0),
    quaternion: new THREE.Quaternion(),
    heightWorld: 100,
    baseRadiusWorld: 10,
  } as unknown as CellBeamConeRenderItem;
}

function contentionModel(input: {
  readonly focusedUeId?: string;
  readonly focusedLoad?: number;
  readonly focusedNormalized?: number;
  readonly maxLoad?: number;
  readonly loadByBeamKey?: ReadonlyArray<readonly [string, number]>;
}): BeamLoadContentionModel {
  const byUeId = new Map<string, UeBeamLoadContention>();
  if (input.focusedUeId) {
    byUeId.set(input.focusedUeId, {
      ueId: input.focusedUeId,
      beamKey: 'sat-a|3',
      load: input.focusedLoad ?? 0,
      normalizedLoad: input.focusedNormalized ?? 0,
      served: (input.focusedLoad ?? 0) > 0,
    });
  }
  return {
    byUeId,
    loadByBeamKey: new Map(input.loadByBeamKey ?? []),
    maxLoad: input.maxLoad ?? 0,
    servedUeCount: byUeId.size,
    loadedBeamCount: (input.loadByBeamKey ?? []).length,
  };
}

const focusedUe = { id: 'ue-0', servingSatelliteId: 'sat-a', servingBeamId: '3' };

const assert = {
  equal<TValue>(actual: TValue, expected: TValue, label = 'value'): void {
    if (!Object.is(actual, expected)) {
      throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`);
    }
  },
  ok(condition: boolean, label: string): void {
    if (!condition) throw new Error(label);
  },
};

let passed = 0;

function pass(label: string): void {
  passed += 1;
  console.log(`PASS ${String(passed).padStart(2, '0')}: ${label}`);
}

function check(label: string, fn: () => void): void {
  fn();
  pass(label);
}

console.log('beamLoadUploadParticles.test');

check('focus cone count clamps to MAX_FOCUS_CONES', () => {
  assert.equal(resolveUploadParticleConeCount(0), 0, 'zero cones');
  assert.equal(resolveUploadParticleConeCount(1), 1, 'one cone');
  assert.equal(resolveUploadParticleConeCount(MAX_FOCUS_CONES), MAX_FOCUS_CONES, 'max cones');
  assert.equal(resolveUploadParticleConeCount(MAX_FOCUS_CONES + 4), MAX_FOCUS_CONES, 'over max cones');
  assert.equal(resolveUploadParticleConeCount(-1), 0, 'negative cones');
  assert.equal(resolveUploadParticleConeCount(Number.NaN), 0, 'NaN cones');
});

check('per-cone count stays inside the floor and hard cap', () => {
  const low = resolveUploadParticleCountForLoad(0);
  const mid = resolveUploadParticleCountForLoad(0.5);
  const high = resolveUploadParticleCountForLoad(1);
  assert.ok(low >= UPLOAD_PARTICLES_MIN_FLOOR, 'zero load keeps floor coverage');
  assert.ok(mid > low, 'mid load increases density');
  assert.ok(high > mid, 'high load increases density');
  assert.ok(high <= UPLOAD_PARTICLES_PER_CONE_HARD_CAP, 'high load respects hard cap');
  assert.ok(resolveUploadParticleCountForLoad(-100) >= UPLOAD_PARTICLES_MIN_FLOOR, 'negative input clamps low');
  assert.equal(resolveUploadParticleCountForLoad(100), UPLOAD_PARTICLES_PER_CONE_HARD_CAP, 'absurd high input clamps');
});

check('global sum never exceeds UPLOAD_PARTICLES_GLOBAL_CAP', () => {
  assert.equal(
    resolveUploadParticleGlobalCount([UPLOAD_PARTICLES_PER_CONE_HARD_CAP, UPLOAD_PARTICLES_PER_CONE_HARD_CAP]),
    UPLOAD_PARTICLES_GLOBAL_CAP,
    'two hard-capped cones equal global cap',
  );
  assert.equal(resolveUploadParticleGlobalCount([999, 999]), UPLOAD_PARTICLES_GLOBAL_CAP, 'absurd input clamps globally');
  assert.equal(resolveUploadParticleGlobalCount([12, Number.NaN, -30, 8]), 20, 'invalid/negative counts ignored');
});

check('progress wraps into [0, 1)', () => {
  for (const [elapsedSec, phaseOffset] of [
    [0, 0],
    [0.25, 0.5],
    [99.2, 0.99],
    [-4.2, -0.75],
  ] as const) {
    const progress = normalizeUploadParticleProgress(elapsedSec, phaseOffset);
    assert.ok(progress >= 0, `progress ${progress} should be >= 0`);
    assert.ok(progress < 1, `progress ${progress} should be < 1`);
  }
});

check('disabled, paused, and reduced-motion gates resolve to zero active particles', () => {
  assert.equal(resolveUploadParticleEnabledCount({ enabled: false, count: 96 }), 0, 'disabled count');
  assert.equal(resolveUploadParticleEnabledCount({ paused: true, count: 96 }), 0, 'paused count');
  assert.equal(resolveUploadParticleEnabledCount({ reducedMotion: true, count: 96 }), 0, 'reduced-motion count');
  assert.equal(resolveUploadParticleEnabledCount({ count: 96 }), 96, 'active count');
});

check('INV-3: focused UE present streams exactly ONE cone — a 2nd cone gets no borrowed-load particles', () => {
  const plans = resolveUploadParticleConePlans({
    focusCones: [cone('sat-a', 3, 1), cone('sat-a', 9, 2)],
    beamLoadContention: contentionModel({ focusedUeId: 'ue-0', focusedLoad: 4, focusedNormalized: 1, maxLoad: 4 }),
    focusedUe,
    enabled: true,
    paused: false,
    reducedMotion: false,
  });
  assert.equal(plans.length, 1, 'only the focused UE cone streams, not a borrowed 2nd cone');
  assert.ok(plans[0].count > 0, 'focused cone streams its real load');
});

check('focused stream count rises with the focused UE real load', () => {
  const opts = (normalized: number, load: number) => ({
    focusCones: [cone('sat-a', 3, 1)],
    beamLoadContention: contentionModel({ focusedUeId: 'ue-0', focusedLoad: load, focusedNormalized: normalized, maxLoad: load }),
    focusedUe,
    enabled: true,
    paused: false,
    reducedMotion: false,
  });
  const low = resolveUploadParticleConePlans(opts(0.1, 1))[0]?.count ?? 0;
  const high = resolveUploadParticleConePlans(opts(1, 4))[0]?.count ?? 0;
  assert.ok(high > low, 'higher focused load => denser stream');
  assert.ok(high <= UPLOAD_PARTICLES_PER_CONE_HARD_CAP, 'stream respects per-cone hard cap');
});

check('orchestration respects global + cone caps and gates', () => {
  const base = {
    focusCones: [cone('sat-a', 3, 1), cone('sat-a', 9, 2), cone('sat-a', 5, 3)],
    beamLoadContention: contentionModel({ focusedUeId: 'ue-0', focusedLoad: 4, focusedNormalized: 1, maxLoad: 4 }),
    focusedUe,
    enabled: true,
    paused: false,
    reducedMotion: false,
  };
  const plans = resolveUploadParticleConePlans(base);
  assert.ok(plans.length <= MAX_FOCUS_CONES, 'never more than MAX_FOCUS_CONES plans');
  const total = plans.reduce((sum, p) => sum + p.count, 0);
  assert.ok(total <= UPLOAD_PARTICLES_GLOBAL_CAP, 'global particle sum within cap');
  assert.equal(resolveUploadParticleConePlans({ ...base, enabled: false }).length, 0, 'disabled => no plans');
  assert.equal(resolveUploadParticleConePlans({ ...base, paused: true }).length, 0, 'paused => no plans');
  assert.equal(resolveUploadParticleConePlans({ ...base, reducedMotion: true }).length, 0, 'reduced-motion => no plans');
});

check('zero focused beam load yields no particles (INV-3 no fabrication)', () => {
  const plans = resolveUploadParticleConePlans({
    focusCones: [cone('sat-a', 3, 1)],
    beamLoadContention: contentionModel({ focusedUeId: 'ue-0', focusedLoad: 0, focusedNormalized: 0, maxLoad: 0 }),
    focusedUe,
    enabled: true,
    paused: false,
    reducedMotion: false,
  });
  assert.equal(plans.length, 0, 'unserved/zero-load focus => no stream');
});

console.log(`[beamLoadUploadParticles.test] PASS ${passed}/${passed}`);
