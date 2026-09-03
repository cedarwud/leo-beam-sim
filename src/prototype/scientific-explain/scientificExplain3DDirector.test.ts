import assert from 'node:assert/strict';

import {
  BASELINE_THETA_DEG,
  CAMERA_POSES,
  DETERMINISTIC_RECONSTRUCTED_STEER_THETA_DEG,
  EPISODE_TOTAL_DURATION_SEC,
  FIXED_ELEVATION_DEG,
  INTERACTION_CHECKPOINT_TIME_SEC,
  SATELLITE_POSITION,
  SCIENTIFIC_EXPLAIN_3D_BEATS,
  SCIENTIFIC_EXPLAIN_3D_BEAT_IDS,
  UE_GROUND_POSITION,
  calculateAntennaGain,
  calculateBoresightGroundCenter,
  calculateBoresightUnitVector,
  calculateElevationDeg,
  calculateOffAxisAngleDeg,
  findBeatIndexById,
  resolveTimeToBeat,
  reviewFrameCourseTime,
} from './scientificExplain3DDirector';

// 1. Episode duration and beats structure
assert.ok(EPISODE_TOTAL_DURATION_SEC >= 60 && EPISODE_TOTAL_DURATION_SEC <= 90, `episode duration ${EPISODE_TOTAL_DURATION_SEC} is between 60 and 90 seconds`);
assert.equal(SCIENTIFIC_EXPLAIN_3D_BEATS.length, 7);
assert.deepEqual(
  SCIENTIFIC_EXPLAIN_3D_BEATS.map(b => b.id),
  [...SCIENTIFIC_EXPLAIN_3D_BEAT_IDS],
);

// Verify cumulative times match startSec
let expectedStart = 0;
for (const beat of SCIENTIFIC_EXPLAIN_3D_BEATS) {
  assert.equal(beat.startSec, expectedStart, `beat ${beat.id} starts at expected sec`);
  expectedStart += beat.durationSec;
  assert.ok(beat.caption.length <= 2, `beat ${beat.id} caption has <= 2 lines`);
  assert.ok(beat.camera in CAMERA_POSES, `beat ${beat.id} references a valid camera pose`);
}
assert.equal(expectedStart, EPISODE_TOTAL_DURATION_SEC);

// 2. Physical Elevation Angle Invariance
const defaultElev = calculateElevationDeg();
assert.ok(Number.isFinite(defaultElev) && defaultElev > 45 && defaultElev < 80);
assert.equal(defaultElev, FIXED_ELEVATION_DEG);

// Elevation depends only on satellite & UE positions
assert.equal(
  calculateElevationDeg(SATELLITE_POSITION, UE_GROUND_POSITION),
  FIXED_ELEVATION_DEG,
);

// 3. Camera movement does not change physical positions or angles
const baselineCenter = calculateBoresightGroundCenter(BASELINE_THETA_DEG);
const baselineTheta = calculateOffAxisAngleDeg(baselineCenter);
assert.ok(Math.abs(baselineTheta - BASELINE_THETA_DEG) < 1e-6, `baseline theta is exactly ${BASELINE_THETA_DEG} deg (got ${baselineTheta})`);

// Across all camera poses, physical angles remain invariant
for (const poseKey of Object.keys(CAMERA_POSES)) {
  const elev = calculateElevationDeg(SATELLITE_POSITION, UE_GROUND_POSITION);
  const offAxis = calculateOffAxisAngleDeg(baselineCenter, SATELLITE_POSITION, UE_GROUND_POSITION);
  assert.equal(elev, FIXED_ELEVATION_DEG, `pose ${poseKey} does not affect elevation`);
  assert.equal(offAxis, baselineTheta, `pose ${poseKey} does not affect off-axis angle`);
}

// 4. Beam Steering modifies boresight and off-axis angle, while elevation stays fixed
const steeredCenterPositive = calculateBoresightGroundCenter(5.0);
const thetaPositive = calculateOffAxisAngleDeg(steeredCenterPositive);
assert.ok(Math.abs(thetaPositive - 5.0) < 1e-6, `steered theta is exactly 5.0 deg (got ${thetaPositive})`);
assert.ok(thetaPositive > baselineTheta, `steered angle is larger than baseline (${thetaPositive} > ${baselineTheta})`);

// Elevation is strictly invariant under beam steer
assert.equal(calculateElevationDeg(SATELLITE_POSITION, UE_GROUND_POSITION), FIXED_ELEVATION_DEG);

// 5. Antenna Gain model
const gainZero = calculateAntennaGain(0);
assert.equal(gainZero.gainRatio, 1.0);
assert.equal(gainZero.gainDb, 0);

const gainBaseline = calculateAntennaGain(BASELINE_THETA_DEG);
assert.ok(gainBaseline.gainRatio < 1.0 && gainBaseline.gainRatio > 0.1);
assert.ok(gainBaseline.gainDb < 0 && gainBaseline.gainDb > -10);

const gainSteered = calculateAntennaGain(5.0);
assert.ok(gainSteered.gainRatio < gainBaseline.gainRatio);
assert.ok(gainSteered.gainDb < gainBaseline.gainDb);

// 6. Time resolution and seeking
assert.equal(resolveTimeToBeat(0).beat.id, 'establish');
assert.equal(resolveTimeToBeat(15).beat.id, 'perspective-side');
assert.equal(resolveTimeToBeat(25).beat.id, 'perspective-top');
assert.equal(resolveTimeToBeat(30).beat.id, 'perspective-oblique');
assert.equal(resolveTimeToBeat(INTERACTION_CHECKPOINT_TIME_SEC).beat.id, 'interaction');
assert.equal(resolveTimeToBeat(55).beat.id, 'comparison');
assert.equal(resolveTimeToBeat(70).beat.id, 'formula-reveal');
assert.equal(resolveTimeToBeat(EPISODE_TOTAL_DURATION_SEC).beat.id, 'formula-reveal');

// 7. Beat index locator
assert.equal(findBeatIndexById('establish'), 0);
assert.equal(findBeatIndexById('interaction'), 4);
assert.equal(findBeatIndexById('formula-reveal'), 6);
assert.equal(findBeatIndexById('unknown-beat'), null);

// 8. Review frame times
assert.ok(reviewFrameCourseTime(0) >= 0 && reviewFrameCourseTime(0) < 12);
assert.ok(reviewFrameCourseTime(4) >= 36 && reviewFrameCourseTime(4) < 52);

console.log('scientificExplain3DDirector unit tests PASS');
