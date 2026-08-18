import assert from 'node:assert/strict';
import * as THREE from 'three';

import { buildVisualLabBeamConeTransform } from './visualLabBeamGeometry';

const satellite = [1.25, 5.5, -2.1] as const;
const ground = [-.8, .25, 1.4] as const;
const transform = buildVisualLabBeamConeTransform(satellite, ground);

const apex = new THREE.Vector3(0, transform.length / 2, 0)
  .applyQuaternion(transform.quaternion)
  .add(transform.midpoint);
const baseCenter = new THREE.Vector3(0, -transform.length / 2, 0)
  .applyQuaternion(transform.quaternion)
  .add(transform.midpoint);

assert.ok(apex.distanceTo(new THREE.Vector3(...satellite)) < 1e-9, 'the cone apex must stay at the satellite');
assert.ok(baseCenter.distanceTo(new THREE.Vector3(...ground)) < 1e-9, 'the cone base must land on the ground target');
assert.ok(transform.length > 0);
assert.throws(
  () => buildVisualLabBeamConeTransform(satellite, satellite),
  /distinct/,
);

console.log('visual-lab beam cone points from satellite apex to ground footprint');
