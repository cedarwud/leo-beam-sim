/**
 * Consolidation S5-1 — shared sinr-live visible-beam resolver gate (headless).
 *
 * Proves the ONE shared resolver `resolveSinrLiveVisibleBeamSatIds`
 * (src/scene/sinrLiveBeamSelection.ts) that BOTH the MainScene mount and the
 * connected-sat invariant consume:
 *
 *   (a) STEERED branch (cones parked, today's path): reproduces the steered
 *       SatelliteBeams mount predicate — displaySats ∩ beamSatIds ∩ satBeams>0 —
 *       and is empty when the steered cones are off; AND
 *       connectedSatBeamInvariant.resolveSteeredVisibleBeamSatIds delegates to it
 *       byte-identically (the replica is retired).
 *   (b) CONE branch (showSinrLiveCellBeams true — the S5-2 render): the visible
 *       set is exactly the mounted cones' serving satIds (coneSatIds). Crippling
 *       a cone drops its sat — the NEW positive control that replaces the
 *       steered-cripple control once the render flips (this IS what the D1
 *       must-hold flip will measure).
 *   (c) BYTE-IDENTITY: flag-true with no coneSatIds returns the empty set, exactly
 *       as the legacy resolveSteeredVisibleBeamSatIds did, so S5-1 is a pure
 *       behavior-invariant extraction (real-frame coverage is inherited by
 *       validate:s0:connected-sat-has-beam staying 760/1 green).
 *   (d) WRAPPER delegation under CONE flags injects no coneSatIds (returns empty) —
 *       the wrapper's one degree of freedom; a wrapper that forwarded a bogus
 *       coneSatIds would make this non-empty and fail.
 *
 * Non-vacuous: the steered set and the cone set are both non-empty, and the
 * cripple provably removes a sat that was present.
 */
import assert from 'node:assert/strict';

import {
  resolveSinrLiveVisibleBeamSatIds,
  type SteeredMountPlanFlags,
} from '../src/scene/sinrLiveBeamSelection.ts';
import { resolveSteeredVisibleBeamSatIds } from '../src/validation/connectedSatBeamInvariant.ts';
import type { VizFrame } from '../src/scene/types.ts';

const log = (line: string): void => console.log(`[validate:s5:shared-cone-selector] ${line}`);

function sorted(set: ReadonlySet<string>): string[] {
  return [...set].sort();
}

/**
 * Minimal synthetic VizFrame — the resolver reads ONLY displaySats[].id,
 * beamSatIds, and satBeams[].length, so a partial frame cast is sufficient and
 * keeps the gate a focused unit test (no runtime/clock needed).
 */
function makeViz(input: {
  displaySatIds: readonly string[];
  beamSatIds: readonly string[];
  /** satId -> beam count (a sat with 0 beams is in the map but excluded by the >0 check). */
  beamCounts: Record<string, number>;
}): VizFrame {
  return {
    displaySats: input.displaySatIds.map(id => ({ id })),
    beamSatIds: new Set(input.beamSatIds),
    satBeams: new Map(
      Object.entries(input.beamCounts).map(([id, n]) => [id, Array.from({ length: n }, () => ({}))]),
    ),
  } as unknown as VizFrame;
}

// A=2 beams, B=1 beam, C in beamSatIds but 0 beams (must be excluded), D not in
// beamSatIds (must be excluded even though it has beams).
const viz = makeViz({
  displaySatIds: ['A', 'B', 'C', 'D'],
  beamSatIds: ['A', 'B', 'C'],
  beamCounts: { A: 2, B: 1, C: 0, D: 3 },
});

const STEERED: SteeredMountPlanFlags = {
  showLiveBeamCones: true,
  showSinrLiveCellBeams: false,
};

let checks = 0;
const check = (cond: boolean, label: string): void => {
  assert.ok(cond, label);
  checks += 1;
};

// ---- (a) STEERED branch + delegation byte-identity ----
const steered = resolveSinrLiveVisibleBeamSatIds({ viz, plan: STEERED });
check(
  JSON.stringify(sorted(steered)) === JSON.stringify(['A', 'B']),
  `steered branch = displaySats ∩ beamSatIds ∩ satBeams>0 (got ${JSON.stringify(sorted(steered))}, want [A,B])`,
);
check(steered.size > 0, 'non-vacuous: steered visible set is non-empty');

const delegated = resolveSteeredVisibleBeamSatIds(viz, STEERED);
check(
  JSON.stringify(sorted(delegated)) === JSON.stringify(sorted(steered)),
  'connectedSatBeamInvariant.resolveSteeredVisibleBeamSatIds delegates byte-identically (steered branch)',
);

// steered OFF: no live beam cones -> empty
check(
  resolveSinrLiveVisibleBeamSatIds({ viz, plan: { ...STEERED, showLiveBeamCones: false } }).size === 0,
  'steered off when showLiveBeamCones=false',
);
// ---- (b) CONE branch + positive control ----
const CONE: SteeredMountPlanFlags = { ...STEERED, showSinrLiveCellBeams: true };
const coneSatIds = new Set(['X', 'Y', 'Z']);
const coneVisible = resolveSinrLiveVisibleBeamSatIds({ viz, plan: CONE, coneSatIds });
check(
  JSON.stringify(sorted(coneVisible)) === JSON.stringify(['X', 'Y', 'Z']),
  `cone branch = mounted cones' serving satIds (got ${JSON.stringify(sorted(coneVisible))}, want [X,Y,Z])`,
);
check(coneVisible.size > 0, 'non-vacuous: cone visible set is non-empty');
check(
  !steered.has('X') && coneVisible.has('X'),
  'cone branch ignores the steered set (X is cone-only, never a steered beam sat)',
);

// POSITIVE CONTROL (the future must-hold measurement): crippling a cone — removing
// Y from the rendered set — drops Y from the visible set. Y was present above.
const crippled = resolveSinrLiveVisibleBeamSatIds({
  viz,
  plan: CONE,
  coneSatIds: new Set(['X', 'Z']),
});
check(
  coneVisible.has('Y') && !crippled.has('Y') && JSON.stringify(sorted(crippled)) === JSON.stringify(['X', 'Z']),
  `positive control: crippling cone Y drops it (got ${JSON.stringify(sorted(crippled))}, want [X,Z])`,
);

// ---- (c) byte-identity: flag-true + no coneSatIds = empty (matches legacy guard) ----
check(
  resolveSinrLiveVisibleBeamSatIds({ viz, plan: CONE }).size === 0,
  'flag-true with no coneSatIds returns empty (byte-identical to the legacy resolver)',
);

// ---- (d) WRAPPER delegation under CONE flags injects NO coneSatIds ----
// The wrapper's one degree of freedom is whether it forwards a coneSatIds. Under
// the steered flags (check above) the cone branch is dormant, so that branch alone
// cannot catch a wrapper that wrongly injected a bogus coneSatIds. Asserting the
// wrapper returns EMPTY under showSinrLiveCellBeams=true proves it passes none — an
// injected coneSatIds would make the cone branch non-empty and the gate would fail.
check(
  resolveSteeredVisibleBeamSatIds(viz, CONE).size === 0,
  'wrapper delegates with NO coneSatIds (cone-flag delegation returns empty; catches an injected coneSatIds)',
);

log(`PASS — shared visible-beam resolver verified (${checks} checks; steered delegation byte-identical, cone branch + cripple positive control non-vacuous)`);
