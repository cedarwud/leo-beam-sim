#!/usr/bin/env node

import { resolveBeamConeRoleFactors, type BeamConeRoleFactors } from './beamConeRoleFactors';

let passed = 0;
function check(label: string, actual: number, expected: number): void {
  if (!Object.is(actual, expected)) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
  passed += 1;
  console.log(`PASS ${String(passed).padStart(2, '0')}: ${label}`);
}

function assertFactors(label: string, f: BeamConeRoleFactors, expected: BeamConeRoleFactors): void {
  for (const key of Object.keys(expected) as (keyof BeamConeRoleFactors)[]) {
    check(`${label}.${key}`, f[key], expected[key]);
  }
}

console.log('beamConeRoleFactors.test');

// Values pinned BYTE-IDENTICAL to the prior SatelliteBeams inline expressions.
assertFactors('neither', resolveBeamConeRoleFactors(false, false), {
  innerArcMul: 1,
  groundDiscMul: 1,
  midRingMul: 1,
  haloLineWidthAdd: 3.2,
  haloLineOpacityBase: 0.24,
  coreLineWidthAdd: 0,
  endpointMul: 1,
  roleRingOuterAdd: 4.8,
});

assertFactors('source', resolveBeamConeRoleFactors(true, false), {
  innerArcMul: 1,
  groundDiscMul: 0.62,
  midRingMul: 0.52,
  haloLineWidthAdd: 3.2,
  haloLineOpacityBase: 0.36,
  coreLineWidthAdd: 0.5,
  endpointMul: 0.58,
  roleRingOuterAdd: 4.8,
});

assertFactors('target', resolveBeamConeRoleFactors(false, true), {
  innerArcMul: 1.1,
  groundDiscMul: 1,
  midRingMul: 1.08,
  haloLineWidthAdd: 8.2,
  haloLineOpacityBase: 0.58,
  coreLineWidthAdd: 2.8,
  endpointMul: 1.18,
  roleRingOuterAdd: 7.2,
});

// target precedence (a beam is never both, but the ternaries prefer target).
assertFactors('target-wins', resolveBeamConeRoleFactors(true, true), {
  innerArcMul: 1.1,
  groundDiscMul: 0.62,
  midRingMul: 1.08,
  haloLineWidthAdd: 8.2,
  haloLineOpacityBase: 0.58,
  coreLineWidthAdd: 2.8,
  endpointMul: 1.18,
  roleRingOuterAdd: 7.2,
});

console.log(`[beamConeRoleFactors.test] PASS ${passed}/0`);
