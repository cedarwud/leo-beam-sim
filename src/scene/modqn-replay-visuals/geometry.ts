import * as THREE from 'three';
import type { ModqnReplayScenePoint } from '../modqnReplaySceneVisuals';
import { DISC_Y_WORLD } from './constants';

export function formatPoint(point: ModqnReplayScenePoint): string {
  return [point.x, point.y, point.z].map(value => value.toFixed(1)).join(',');
}

export function samePoint(a: ModqnReplayScenePoint, b: ModqnReplayScenePoint): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < 0.1;
}

export function createArcPoints(
  source: ModqnReplayScenePoint,
  target: ModqnReplayScenePoint,
  controlY: number,
): Array<[number, number, number]> {
  const sourceVector = new THREE.Vector3(source.x, DISC_Y_WORLD + 2, source.z);
  const targetVector = new THREE.Vector3(target.x, DISC_Y_WORLD + 2, target.z);
  const control = new THREE.Vector3(
    (source.x + target.x) / 2,
    controlY,
    (source.z + target.z) / 2,
  );
  const curve = new THREE.QuadraticBezierCurve3(sourceVector, control, targetVector);
  return curve.getPoints(28).map(point => [point.x, point.y, point.z]);
}

export function pointOnQuadraticArc(
  source: ModqnReplayScenePoint,
  target: ModqnReplayScenePoint,
  controlY: number,
  progress: number,
): THREE.Vector3 {
  const start = new THREE.Vector3(source.x, DISC_Y_WORLD + 2, source.z);
  const end = new THREE.Vector3(target.x, DISC_Y_WORLD + 2, target.z);
  const control = new THREE.Vector3(
    (source.x + target.x) / 2,
    controlY,
    (source.z + target.z) / 2,
  );
  const curve = new THREE.QuadraticBezierCurve3(start, control, end);
  return curve.getPoint(progress);
}
