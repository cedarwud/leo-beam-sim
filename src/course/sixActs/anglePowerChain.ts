/**
 * Shared Act 3 gain primitive.
 *
 * The old Act 3 route owned this helper. Act 3 now lives in the homepage
 * handover preset, while Act 5 still uses the same canonical pattern for its
 * fixture. Keep the physics primitive in the six-acts model layer so deleting
 * a route cannot delete a producer that another act imports.
 */

import { computeBeamGainDb } from '../../engine/signal/beam-gain';

export type AngleLabPatternMode = 'demo' | 'canonical';

function demoGainDb(thetaDeg: number, theta3dbDeg: number): number {
  const ratio = thetaDeg / Math.max(theta3dbDeg, 1e-9);
  return -3 * ratio * ratio;
}

export function angleLabGainDb(
  thetaDeg: number,
  theta3dbDeg: number,
  mode: AngleLabPatternMode,
): number {
  if (mode === 'demo') return demoGainDb(Math.abs(thetaDeg), theta3dbDeg);
  return computeBeamGainDb(Math.abs(thetaDeg), theta3dbDeg, 'bessel-j1-j3');
}
