import assert from 'node:assert/strict';
import * as THREE from 'three';

import {
  constrainVisualLabCameraPose,
  visualLabOrbitControlLimits,
} from './visualLabCameraConstraints';

assert.equal(visualLabOrbitControlLimits('earth').maxPolarAngle, Math.PI);
assert.equal(visualLabOrbitControlLimits('sky').maxPolarAngle, Math.PI / 2);
assert.equal(visualLabOrbitControlLimits('service').maxPolarAngle, Math.PI / 2);

const target = new THREE.Vector3(0, 1.1, 0);
const belowGround = new THREE.Vector3(5, -3, 5);
const constrained = constrainVisualLabCameraPose('service', belowGround, target);
assert.ok(constrained.y >= target.y, 'local scene camera cannot cross below its horizontal target plane');

const global = constrainVisualLabCameraPose('earth', belowGround, target);
assert.equal(global.y, belowGround.y, 'global orbit view retains full-orbit camera freedom');

console.log('visual-lab local camera stops at the horizontal plane');
