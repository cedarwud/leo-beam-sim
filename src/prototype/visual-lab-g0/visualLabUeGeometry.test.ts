import assert from 'node:assert/strict';
import {
  degreesFromRadians,
  offAxisAngleRadForVisualLabUe,
  positionForVisualLabUeOffAxisAngle,
  radiansFromDegrees,
} from './visualLabUeGeometry';

const geometry = {
  satelliteDistanceKm: 900,
  satelliteElevationDeg: 52,
  beamCenterKm: [12, -8] as const,
  userPositionKm: [20, 0] as const,
  maxRadiusKm: 20,
};

const centerAngle = offAxisAngleRadForVisualLabUe({
  ...geometry,
  userPositionKm: geometry.beamCenterKm,
});
assert.ok(Math.abs(centerAngle) < 1e-12, 'the beam centre is zero off-axis angle');

const movedAngle = offAxisAngleRadForVisualLabUe(geometry);
assert.ok(movedAngle > 0, 'a radial UE displacement produces a derived angle');

const solvedPosition = positionForVisualLabUeOffAxisAngle(geometry, movedAngle);
const solvedAngle = offAxisAngleRadForVisualLabUe({
  ...geometry,
  userPositionKm: solvedPosition,
});
assert.ok(Math.abs(solvedAngle - movedAngle) < 1e-10, 'the slider inverse uses the exact angle function');

const displayDegrees = degreesFromRadians(movedAngle);
assert.ok(Math.abs(radiansFromDegrees(displayDegrees) - movedAngle) < 1e-12);

console.log('Visual-lab UE angle geometry remains source-backed through the draft-position seam.');
