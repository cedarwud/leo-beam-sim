import assert from 'node:assert/strict';
import {
  computeBoresightAxisEcefKm,
  intersectBeamAxisWithEarth,
  resolveBeamPointing,
} from '../engine/signal/beam-pointing';
import { computeSinrLiveBeamFootprintEllipse } from './sinrLiveBeamGeometry';

const ellipse = computeSinrLiveBeamFootprintEllipse({
  apex: { x: 120, y: 700, z: -80 },
  baseCenter: { x: 0, y: 0, z: 0 },
  radiusWorld: 40,
});

assert(ellipse.longAxisWorld > ellipse.shortAxisWorld, 'an oblique beam footprint is visibly elliptical');
assert(ellipse.elevationDeg > 0 && ellipse.elevationDeg < 90, 'ellipse retains the rendered beam elevation');
assert.equal(ellipse.shortAxisWorld, 40, 'short axis keeps the cell footprint radius');

const exaggerated = computeSinrLiveBeamFootprintEllipse({
  apex: { x: 120, y: 700, z: -80 },
  baseCenter: { x: 0, y: 0, z: 0 },
  radiusWorld: 40,
  tiltExaggeration: 3,
});
assert(exaggerated.longAxisWorld > ellipse.longAxisWorld, 'legacy teaching projection makes a small tilt legible');
assert(exaggerated.renderElevationDeg < exaggerated.elevationDeg, 'exaggeration lowers only the rendered elevation');

const overhead = computeSinrLiveBeamFootprintEllipse({
  apex: { x: 0, y: 700, z: 0 },
  baseCenter: { x: 0, y: 0, z: 0 },
  radiusWorld: 40,
  tiltExaggeration: 3,
});
assert.equal(overhead.longAxisWorld, 40, 'overhead beam footprint remains circular');

const axis = computeBoresightAxisEcefKm({
  satLatDeg: 0,
  satLonDeg: 0,
  satAltitudeKm: 550,
  targetLatDeg: 0,
  targetLonDeg: 0,
});
const ground = intersectBeamAxisWithEarth({
  satLatDeg: 0,
  satLonDeg: 0,
  satAltitudeKm: 550,
  axisEcefKm: axis,
  observerLatDeg: 0,
  observerLonDeg: 0,
});
assert(ground !== null, 'a boresight aimed at Earth intersects the surface');
assert(Math.abs((ground?.eastKm ?? NaN)) < 1e-9, 'boresight ground centre keeps east coordinate');
assert(Math.abs((ground?.northKm ?? NaN)) < 1e-9, 'boresight ground centre keeps north coordinate');

const held = resolveBeamPointing({
  satLatDeg: 0.04,
  satLonDeg: 0.03,
  satAltitudeKm: 550,
  targetLatDeg: 0,
  targetLonDeg: 0,
  observerLatDeg: 0,
  observerLonDeg: 0,
  axisEcefKm: axis,
});
assert(Math.abs(held.ground.eastKm) > 1, 'a held ECEF axis produces a moving ground footprint');

console.log('sinrLiveBeamGeometry.test.ts: PASS');
