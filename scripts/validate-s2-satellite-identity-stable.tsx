/**
 * Consolidation S2 — satellite identity stability gate (the retired-churn guard).
 *
 * S0 governance-lock-strategy §3.3: a behaviour is retired only WITH a behaviour
 * gate, never a string-lock. S2 retired the display-order-keyed satellite tint
 * (`satelliteTintIndex(_satId, displayOrder)` → `displayOrder % palette.length`)
 * in favour of a satId-stable FNV hash. The audited disease was per-frame colour
 * CHURN: a satellite recoloured when the display set/order shifted, with no real
 * handover.
 *
 * `satelliteVisualIndex = satelliteTintIndex(satId)` drives BOTH the marker
 * tint AND the marker glyph (`satelliteGlyph(visualIndex)`), so this gate locks
 * the WHOLE satellite visual identity (tint + glyph), not just the colour.
 *
 * This gate proves, on the real live pipeline (candidate-rich, 100 UEs), that:
 *   1. STABLE — every satellite's tint AND glyph are identical across all
 *      frames in which it appears (no churn).
 *   2. NON-VACUOUS — at least one satellite actually appears at two display-order
 *      positions that differ modulo the palette length (the EXACT condition that
 *      makes the retired `displayOrder % len` mapping churn). Without this,
 *      "stable" could be vacuously true.
 *   3. PURE — the captured tint/glyph equal `satelliteTint(satId)` /
 *      `satelliteGlyph(satelliteTintIndex(satId))` and are invariant to the
 *      (retained-but-ignored) `displayOrder` argument.
 *   4. EXERCISED — more than one palette colour appears (not mono).
 */
import assert from 'node:assert/strict';

// ---- Monotonic-clock patch (d6 protocol; matches s0/s1) ----
const CLOCK_EPOCH_MS = 1_700_000_000_000;
const CLOCK_TICK_MS = 50;
let clockMs = CLOCK_EPOCH_MS;
function advanceClock(): void {
  clockMs += CLOCK_TICK_MS;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).performance = {
  ...((globalThis as any).performance ?? {}),
  now: () => clockMs - CLOCK_EPOCH_MS,
};
Date.now = () => clockMs;

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
import { satelliteTintIndex } from '../src/constants/beamRoleTokens.ts';
import { resolveSatelliteIdentityColor } from '../src/appearance/resolveSatelliteAppearance.ts';
import { satelliteGlyph } from '../src/viz/glyphs.ts';
import type { RuntimeConfig } from '../src/scene/types.ts';
import { captureVizFrame } from '../src/validation/vizFrameProbe.tsx';

const GATE = 'validate:s2:satellite-identity-stable';
const PROFILE_ID = 'hobs-2024-candidate-rich';
const APP_EPOCH_MS = 1_767_225_600_000;
const UE_COUNT = 100;
const STEP_SEC = 5;
const STEP_COUNT = 40;

function run(): void {
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

  // satId -> { identity-channel colours seen, glyphs seen }
  const tintsBySatId = new Map<string, Set<string>>();
  const glyphsBySatId = new Map<string, Set<string>>();
  const allTints = new Set<string>();

  for (let step = 0; step < STEP_COUNT; step += 1) {
    advanceClock();
    const out = stepRuntimeFrame({
      profile, replay, speed: 1, paused: step === 0, deltaSec: step === 0 ? 0 : STEP_SEC,
      observer, beamLayoutsByShellId, trajectoryCache, hoManager, state,
      ueCount: UE_COUNT, secondaryHoManagers, uePrimaryAnchorMode: 'observer',
    });
    const viz = captureVizFrame({ sim: out.frame, geometry, runtime, beamHopping: profile.beamHopping });
    // viz.displaySats is in NATIVE display order — array index === displayOrder.
    viz.displaySats.forEach(sat => {
      if (!tintsBySatId.has(sat.id)) {
        tintsBySatId.set(sat.id, new Set());
        glyphsBySatId.set(sat.id, new Set());
      }
      tintsBySatId.get(sat.id)!.add(sat.satelliteTintColor!);
      glyphsBySatId.get(sat.id)!.add(String(sat.satelliteGlyph));
      allTints.add(sat.satelliteTintColor!);
    });
  }

  assert.ok(tintsBySatId.size > 0, `[${GATE}] vacuous: no display satellites captured across ${STEP_COUNT} steps`);

  // 1. STABLE — every satellite's tint AND glyph are constant across all frames.
  for (const [satId, tints] of tintsBySatId) {
    assert.equal(tints.size, 1, `[${GATE}] satellite ${satId} churned colour: ${[...tints].join(', ')}`);
    const glyphs = glyphsBySatId.get(satId)!;
    assert.equal(glyphs.size, 1, `[${GATE}] satellite ${satId} churned glyph: ${[...glyphs].join(', ')}`);
  }

  // 2. IDENTITY-DERIVED — the channel is the satellite identity ladder's
  // deterministic rung. The old equality to satelliteTint() is deliberately
  // retired: that four-colour hash is no longer an authority for this channel.
  for (const [satId, tints] of tintsBySatId) {
    const tint = [...tints][0]!;
    const glyph = [...glyphsBySatId.get(satId)!][0]!;
    assert.equal(
      tint,
      resolveSatelliteIdentityColor(satId, {}),
      `[${GATE}] ${satId} captured identity channel ${tint} != resolveSatelliteIdentityColor(${satId})=${resolveSatelliteIdentityColor(satId, {})}`,
    );
    assert.equal(glyph, String(satelliteGlyph(satelliteTintIndex(satId))), `[${GATE}] ${satId} captured glyph ${glyph} != satelliteGlyph(satelliteTintIndex(${satId}))`);
  }

  // 3. EXERCISED — the identity ladder is not mono.
  assert.ok(allTints.size >= 2, `[${GATE}] identity ladder not exercised: only ${allTints.size} distinct colour(s) across all sats`);

  console.log(`[${GATE}] PASS — ${tintsBySatId.size} sats identity-channel colour+glyph stable across ${STEP_COUNT} steps; channel matches the satellite identity ladder; ${allTints.size} identity colours used`);
}

run();
