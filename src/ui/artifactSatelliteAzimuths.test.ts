#!/usr/bin/env node

/**
 * Unit coverage for the FIX-5 Option C azimuth derivation. Pure (no React /
 * three) so it runs directly under tsx:
 *   node --import tsx/esm src/ui/artifactSatelliteAzimuths.test.ts
 */

import { deriveSatelliteAzimuths } from './artifactSatelliteAzimuths';
import type { NormalizedSatellite } from '../scene/NormalizedSceneFrame';

let passed = 0;

function pass(label: string): void {
  passed += 1;
  console.log(`PASS ${String(passed).padStart(2, '0')}: ${label}`);
}

function check(label: string, fn: () => void): void {
  fn();
  pass(label);
}

function assertTrue(condition: boolean, label: string): void {
  if (!condition) throw new Error(label);
}

function assertClose(actual: number, expected: number, label: string, eps = 1e-6): void {
  if (Math.abs(actual - expected) > eps) {
    throw new Error(`${label}: expected ~${expected}, got ${actual}`);
  }
}

function sat(
  id: string,
  worldPos: readonly [number, number, number],
  visible = true,
  coordFrameKind: NormalizedSatellite['coordFrameKind'] = 'eci-km-no-earth-rotation-proxy',
): NormalizedSatellite {
  return {
    id,
    worldPos,
    visible,
    coordFrameKind,
    displayRole: 'context',
  } as NormalizedSatellite;
}

const R = 7151; // the real producer ring radius (LEO orbital radius proxy)

// ── Azimuth convention: atan2(x, z), bearing 0 = +Z, 90 = +X, 180 = −Z, 270 = −X ──
// Mirrors the producer ring (sat-0 +X / sat-1 +Z / sat-2 −X / sat-3 −Z).

check('flat producer ring → 4 markers at 90° spacing, radius preserved, no elevation', () => {
  const ring = [
    sat('sat-0', [R, 0, 0]), // +X → 90
    sat('sat-1', [0, 0, R]), // +Z → 0
    sat('sat-2', [-R, 0, 0]), // −X → 270
    sat('sat-3', [0, 0, -R]), // −Z → 180
  ];
  const { markers, hasElevationData, isFlatEciProxy } = deriveSatelliteAzimuths(ring);
  assertTrue(markers.length === 4, 'all 4 visible satellites surfaced');
  assertTrue(!hasElevationData, 'flat Y=0 proxy reports NO elevation data');
  assertTrue(isFlatEciProxy, 'flat ECI proxy ring is recognised → compass renders');

  const byId = new Map(markers.map(m => [m.id, m]));
  assertClose(byId.get('sat-0')!.azimuthDeg, 90, '+X bearing = 90');
  assertClose(byId.get('sat-1')!.azimuthDeg, 0, '+Z bearing = 0');
  assertClose(byId.get('sat-2')!.azimuthDeg, 270, '−X bearing = 270');
  assertClose(byId.get('sat-3')!.azimuthDeg, 180, '−Z bearing = 180');
  for (const m of markers) {
    assertClose(m.radiusWorld, R, `${m.id} ring radius preserved`);
  }

  // Sorted gaps are ~90° apart — the real-ring property the browser smoke checks.
  const sorted = markers.map(m => m.azimuthDeg).sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    assertClose(sorted[i]! - sorted[i - 1]!, 90, `gap ${i} ~90°`, 1e-6);
  }
});

check('azimuth is normalised into [0, 360)', () => {
  const { markers } = deriveSatelliteAzimuths([sat('sat-x', [-R, 0, 0])]);
  assertTrue(markers[0]!.azimuthDeg >= 0 && markers[0]!.azimuthDeg < 360, 'azimuth in [0,360)');
  assertClose(markers[0]!.azimuthDeg, 270, 'normalised −X = 270');
});

check('invisible satellites are excluded', () => {
  const { markers } = deriveSatelliteAzimuths([
    sat('sat-0', [R, 0, 0], true),
    sat('sat-hidden', [0, 0, R], false),
  ]);
  assertTrue(markers.length === 1, 'only the visible satellite surfaced');
  assertTrue(markers[0]!.id === 'sat-0', 'visible id kept');
});

check('degenerate (origin) and non-finite positions are skipped, no crash', () => {
  const { markers } = deriveSatelliteAzimuths([
    sat('sat-origin', [0, 0, 0]),
    sat('sat-nan', [Number.NaN, 0, 5]),
    sat('sat-inf', [5, 0, Number.POSITIVE_INFINITY]),
    sat('sat-ok', [R, 0, 0]),
  ]);
  assertTrue(markers.length === 1, 'only the well-formed satellite surfaced');
  assertTrue(markers[0]!.id === 'sat-ok', 'finite non-degenerate id kept');
});

check('real elevation (non-zero Y) flips hasElevationData true + suppresses the proxy claim', () => {
  const { hasElevationData, isFlatEciProxy } = deriveSatelliteAzimuths([sat('sat-hi', [R, 500, 0])]);
  assertTrue(hasElevationData, 'non-zero Y reports elevation present (data-driven honesty)');
  assertTrue(!isFlatEciProxy, 'elevation present → NOT the flat proxy → compass must not claim "no elevation"');
});

check('standard ecef-km frame is NOT the flat proxy (no misleading proxy caption)', () => {
  const ecef = [
    sat('sat-0', [R, 0, 0], true, 'ecef-km'),
    sat('sat-1', [0, 0, R], true, 'ecef-km'),
  ];
  const { markers, isFlatEciProxy } = deriveSatelliteAzimuths(ecef);
  assertTrue(markers.length === 2, 'ecef markers still derive azimuths');
  assertTrue(!isFlatEciProxy, 'ecef-km artifact → compass hidden (3D scene draws real geometry)');
});

check('mixed frames are NOT treated as the flat proxy', () => {
  const mixed = [
    sat('sat-0', [R, 0, 0], true, 'eci-km-no-earth-rotation-proxy'),
    sat('sat-1', [0, 0, R], true, 'ecef-km'),
  ];
  assertTrue(!deriveSatelliteAzimuths(mixed).isFlatEciProxy, 'mixed frame → not flat proxy');
});

check('empty input → no markers, no elevation, not flat proxy', () => {
  const { markers, hasElevationData, isFlatEciProxy } = deriveSatelliteAzimuths([]);
  assertTrue(markers.length === 0, 'no markers');
  assertTrue(!hasElevationData, 'no elevation');
  assertTrue(!isFlatEciProxy, 'empty derivation is not the flat proxy → no compass');
});

console.log(`\n[artifactSatelliteAzimuths] ${passed} passed`);
