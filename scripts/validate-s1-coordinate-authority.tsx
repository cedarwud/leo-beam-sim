/**
 * Consolidation S1 — coordinate authority replacement gate.
 *
 * S1 retired the live-satellite `mag > 1000` frame guess in useBeamViz and the
 * 6× duplicated `111.32` literal. This gate is the behavior replacement for the
 * retired heuristic (S0 governance-lock-strategy §3.3: a heuristic is retired
 * only WITH a behavior gate, never a string-lock):
 *
 *  1. The single-source scale constants hold their values.
 *  2. `projectSatelliteRenderWorld` selects by `worldFrame` TYPE, not magnitude
 *     — the decisive positive controls: a `'live-enu'` coordinate with magnitude
 *     > 1000 is still SCALED (not normalized), and (S1b) a `'replay-worldpos'`
 *     coordinate with magnitude <= 1000 is still NORMALIZED (not scaled), where
 *     the retired magnitude guess would have done the opposite. The guess
 *     survives only for legacy/untagged coordinates.
 *  3. End-to-end: the real live pipeline projects EVERY displaySat through the
 *     live-enu branch (world == sim dome-world × satPosScaleFactor), id-matched
 *     to the sim truth — proving the live lane is fully type-driven.
 */
import assert from 'node:assert/strict';

// ---- Monotonic-clock patch (d6 protocol; matches geometry-trace) ----
const CLOCK_EPOCH_MS = 1_700_000_000_000;
let clockMs = CLOCK_EPOCH_MS;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).performance = {
  ...((globalThis as any).performance ?? {}),
  now: () => clockMs - CLOCK_EPOCH_MS,
};
Date.now = () => clockMs;

import { projectSatelliteRenderWorld } from '../src/scene/satelliteRenderProjection.ts';
import { EARTH_KM_PER_DEG } from '../src/engine/orbit/earth-constants.ts';
import { SKY_DOME_H_RADIUS, SKY_DOME_V_RADIUS } from '../src/scene/sceneScale.ts';
import { loadProfile } from '../src/profiles/index.ts';
import { createObserverContext } from '../src/engine/orbit';
import { HandoverManager } from '../src/engine/handover/handover-manager';
import {
  createBeamLayoutsByShellId,
  createRuntimeFrameStepState,
  createTrajectoryCache,
  stepRuntimeFrame,
} from '../src/scene/runtimeFrameStep.ts';
import { deriveRuntimeVisualSettings } from '../src/scene/runtimeConfig.ts';
import { sceneGeometryFromProfile } from '../src/scene/SceneGeometry.ts';
import type { RuntimeConfig } from '../src/scene/types.ts';
import { captureVizFrame } from '../src/validation/vizFrameProbe.tsx';

const GATE = 'validate:s1:coordinate-authority';
let checks = 0;
function ok(cond: boolean, msg: string): void {
  assert.ok(cond, `[${GATE}] ${msg}`);
  checks += 1;
}
const near = (a: number, b: number, tol = 1e-9): boolean => Math.abs(a - b) <= tol;

// ---- 1. Single-source dedup constants ----
ok(EARTH_KM_PER_DEG === 111.32, `EARTH_KM_PER_DEG single source === 111.32 (got ${EARTH_KM_PER_DEG})`);
ok(SKY_DOME_H_RADIUS === 700 && SKY_DOME_V_RADIUS === 400, 'SKY_DOME radii single source (700 / 400)');

// ---- 2. Type-driven projection (heuristic retired) ----
{
  const alt = 360;
  const satPosScaleFactor = alt / SKY_DOME_V_RADIUS; // 0.9 — de-punned divisor
  ok(near(satPosScaleFactor, 0.9), 'satPosScaleFactor = visualSatelliteAltitude / SKY_DOME_V_RADIUS');

  // POSITIVE CONTROL: live coord with magnitude > 1000 must be SCALED, not
  // normalized. The retired heuristic would have normalized this to `alt`.
  const liveHuge = projectSatelliteRenderWorld([2000, 0, 0], 'live-enu', alt, satPosScaleFactor);
  ok(
    near(liveHuge.x, 2000 * satPosScaleFactor) && near(liveHuge.length(), 2000 * satPosScaleFactor),
    `live-enu is magnitude-INDEPENDENT: [2000,0,0] → scaled to ${2000 * satPosScaleFactor} (NOT normalized to ${alt})`,
  );
  const liveSmall = projectSatelliteRenderWorld([400, 0, 0], 'live-enu', alt, satPosScaleFactor);
  ok(near(liveSmall.x, 400 * satPosScaleFactor), 'live-enu small coord scaled identically (magnitude ignored)');

  // S1b: replay-worldpos is now magnitude-INDEPENDENT (type-driven), mirroring
  // live-enu. A small (mag<=1000) replay coord NORMALIZES to the altitude where
  // the retired magnitude guess would have SCALED it — the Verdict 3 unit control.
  // Test vector [200,0,0]: mag 200 ≠ SKY_DOME_V_RADIUS, so normalize-to-alt (360)
  // genuinely differs from scale-by-satPosScaleFactor (180) — not a coincidence.
  const replayHuge = projectSatelliteRenderWorld([6878, 0, 0], 'replay-worldpos', alt, satPosScaleFactor);
  ok(near(replayHuge.length(), alt), `replay-worldpos huge coord normalized to altitude ${alt}`);
  const replaySmall = projectSatelliteRenderWorld([200, 0, 0], 'replay-worldpos', alt, satPosScaleFactor);
  ok(
    near(replaySmall.x, alt) && near(replaySmall.length(), alt) && !near(replaySmall.x, 200 * satPosScaleFactor),
    `replay-worldpos small coord (mag<=1000) NORMALIZED to ${alt} (magnitude IGNORED; retired guess would have scaled to ${200 * satPosScaleFactor})`,
  );

  // Legacy/untagged path keeps the magnitude guess for satellites no adapter
  // has tagged yet: huge normalizes, small scales.
  const legacyHuge = projectSatelliteRenderWorld([6878, 0, 0], undefined, alt, satPosScaleFactor);
  ok(near(legacyHuge.length(), alt), 'legacy/untagged huge coord normalized (magnitude guess retained)');
  const legacySmall = projectSatelliteRenderWorld([200, 0, 0], undefined, alt, satPosScaleFactor);
  ok(near(legacySmall.x, 200 * satPosScaleFactor), 'legacy/untagged small coord scaled (magnitude guess retained)');
}

// ---- 3. End-to-end: the real live pipeline is fully type-driven ----
{
  const PROFILE_ID = 'hobs-2024-candidate-rich';
  const APP_EPOCH_MS = 1_767_225_600_000;
  const UE_COUNT = 100;
  const profile = loadProfile(PROFILE_ID);
  const observer = createObserverContext(profile.orbit.observerLatDeg, profile.orbit.observerLonDeg);
  const trajectoryCache = createTrajectoryCache(profile, observer, APP_EPOCH_MS);
  const beamLayoutsByShellId = createBeamLayoutsByShellId(profile);
  const hoManager = new HandoverManager(profile.handover);
  const secondaryHoManagers = Array.from({ length: UE_COUNT - 1 }, () => new HandoverManager(profile.handover));
  const state = createRuntimeFrameStepState(0);
  const replay = { epochUtcMs: APP_EPOCH_MS, startOffsetSec: 0, loop: false, windowLengthSec: 7200 };
  const geometry = sceneGeometryFromProfile({
    shell: { altitudeKm: profile.orbit.shells[0]?.altitudeKm },
    antenna: { beamwidth3dBRad: profile.antenna.beamwidth3dBRad },
    handover: { triggerTimeSec: profile.handover.triggerTimeSec },
    orbit: { shells: profile.orbit.shells.map(s => ({ id: s.id, altitudeKm: s.altitudeKm })) },
    beams: { frequencyReuse: profile.beams.frequencyReuse },
  });
  const runtime: RuntimeConfig = {
    appMode: 'sinr-experiment',
    presentationMode: 'demo-readability',
    replay,
    ...deriveRuntimeVisualSettings(false),
    beamDensity: 'all',
    viewport: { width: 1600, height: 1000 },
    ueCount: UE_COUNT,
    uePrimaryAnchorMode: 'observer',
  };
  const out = stepRuntimeFrame({
    profile, replay, speed: 1, paused: false, deltaSec: 60, observer, beamLayoutsByShellId,
    trajectoryCache, hoManager, state, ueCount: UE_COUNT, secondaryHoManagers,
    uePrimaryAnchorMode: 'observer',
  });
  const viz = captureVizFrame({ sim: out.frame, geometry, runtime, beamHopping: profile.beamHopping });

  // Geometry has no visualSatelliteAltitude / kmPerWorldUnit → useBeamViz
  // fallback: sinr-experiment ⇒ 600; satPosScaleFactor = 600 / 400 = 1.5.
  const satScale = 600 / SKY_DOME_V_RADIUS;
  const simById = new Map(out.frame.satellites.map(s => [s.id, s.world]));
  ok(viz.displaySats.length > 0, 'live pipeline produced display satellites');
  let matched = 0;
  for (const disp of viz.displaySats) {
    const simWorld = simById.get(disp.id);
    assert.ok(simWorld, `[${GATE}] displaySat ${disp.id} has no matching sim satellite`);
    ok(
      near(disp.world.x, simWorld.x * satScale, 1e-6) &&
        near(disp.world.y, simWorld.y * satScale, 1e-6) &&
        near(disp.world.z, simWorld.z * satScale, 1e-6),
      `displaySat ${disp.id} == sim dome-world × ${satScale} (live-enu branch end-to-end)`,
    );
    matched += 1;
  }
  ok(matched >= 10, `end-to-end coverage: ${matched} display satellites projected via live-enu`);
}

console.log(`[${GATE}] PASS — ${checks} checks (type-driven projection, dedup constants, end-to-end live lane)`);
