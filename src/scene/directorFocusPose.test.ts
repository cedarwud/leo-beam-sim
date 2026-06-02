#!/usr/bin/env node

import * as THREE from 'three';
import { resolveDirectorFocusPose, type DirectorFocusFramingPose } from './directorFocusPose';

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

const UE: readonly [number, number, number] = [10, 0, 20];
const ALPHA = 1;

// ---- legacy fallback (no framing) ----

check('intra fallback: target is the UE, position pulled up+back by intra offset', () => {
  const pose = resolveDirectorFocusPose(UE, ALPHA, 'intra');
  assertClose(pose.target.x, UE[0], 'target.x');
  assertClose(pose.target.y, UE[1], 'target.y');
  assertClose(pose.target.z, UE[2], 'target.z');
  assertClose(pose.position.x, UE[0], 'position.x');
  assertClose(pose.position.y, UE[1] + 220 * ALPHA, 'position.y');
  assertClose(pose.position.z, UE[2] + 260 * ALPHA, 'position.z');
});

check('inter fallback (no framing): legacy inter offset, target is the UE', () => {
  const pose = resolveDirectorFocusPose(UE, ALPHA, 'inter');
  assertClose(pose.target.x, UE[0], 'target.x');
  assertClose(pose.position.y, UE[1] + 430 * ALPHA, 'position.y');
  assertClose(pose.position.z, UE[2] + 520 * ALPHA, 'position.z');
});

check('intra ignores framing by design (single-satellite beam switch)', () => {
  const framing: DirectorFocusFramingPose = {
    fromSatWorldPos: [100, 400, 50],
    toSatWorldPos: [-100, 420, -60],
  };
  const withFraming = resolveDirectorFocusPose(UE, ALPHA, 'intra', framing);
  const without = resolveDirectorFocusPose(UE, ALPHA, 'intra');
  assertTrue(withFraming.position.equals(without.position), 'intra position unchanged by framing');
  assertTrue(withFraming.target.equals(without.target), 'intra target unchanged by framing');
});

// ---- inter satellite-pair framing ----

check('inter with both sats: target is the centroid of {UE, fromSat, toSat}', () => {
  const fromSat: [number, number, number] = [110, 400, 50];
  const toSat: [number, number, number] = [-90, 420, -60];
  const pose = resolveDirectorFocusPose(UE, ALPHA, 'inter', {
    fromSatWorldPos: fromSat,
    toSatWorldPos: toSat,
  });
  const cx = (UE[0] + fromSat[0] + toSat[0]) / 3;
  const cy = (UE[1] + fromSat[1] + toSat[1]) / 3;
  const cz = (UE[2] + fromSat[2] + toSat[2]) / 3;
  assertClose(pose.target.x, cx, 'target.x = centroid');
  assertClose(pose.target.y, cy, 'target.y = centroid');
  assertClose(pose.target.z, cz, 'target.z = centroid');
});

check('inter with both sats: camera pulls up + back from the framed group', () => {
  const pose = resolveDirectorFocusPose(UE, ALPHA, 'inter', {
    fromSatWorldPos: [110, 400, 50],
    toSatWorldPos: [-90, 420, -60],
  });
  assertTrue(pose.position.y > pose.target.y, 'position above centroid');
  assertTrue(pose.position.z > pose.target.z, 'position behind centroid');
  // Back distance must clear the group spread so all framed points stay in frame.
  const framedPoints = [
    new THREE.Vector3(...UE),
    new THREE.Vector3(110, 400, 50),
    new THREE.Vector3(-90, 420, -60),
  ];
  const radius = Math.max(...framedPoints.map(point => point.distanceTo(pose.target)));
  assertTrue(pose.position.distanceTo(pose.target) >= radius, 'pulled back beyond group radius');
});

check('inter pair framing differs from the legacy inter fallback', () => {
  const framed = resolveDirectorFocusPose(UE, ALPHA, 'inter', {
    fromSatWorldPos: [110, 400, 50],
    toSatWorldPos: [-90, 420, -60],
  });
  const legacy = resolveDirectorFocusPose(UE, ALPHA, 'inter');
  assertTrue(!framed.position.equals(legacy.position), 'pair framing moves the camera');
  assertTrue(!framed.target.equals(legacy.target), 'pair framing retargets to the centroid');
});

check('inter with only the target sat: target = midpoint(UE, toSat)', () => {
  const toSat: [number, number, number] = [-90, 420, -60];
  const pose = resolveDirectorFocusPose(UE, ALPHA, 'inter', { toSatWorldPos: toSat });
  assertClose(pose.target.x, (UE[0] + toSat[0]) / 2, 'target.x = midpoint');
  assertClose(pose.target.y, (UE[1] + toSat[1]) / 2, 'target.y = midpoint');
  assertClose(pose.target.z, (UE[2] + toSat[2]) / 2, 'target.z = midpoint');
});

check('inter with non-finite / malformed sat positions falls back to legacy', () => {
  const legacy = resolveDirectorFocusPose(UE, ALPHA, 'inter');
  const nan = resolveDirectorFocusPose(UE, ALPHA, 'inter', {
    fromSatWorldPos: [Number.NaN, 1, 2],
    toSatWorldPos: null,
  });
  assertTrue(nan.position.equals(legacy.position), 'NaN sat ignored → legacy position');
  assertTrue(nan.target.equals(legacy.target), 'NaN sat ignored → legacy target');
});

console.log(`\n[directorFocusPose] ${passed} passed`);
