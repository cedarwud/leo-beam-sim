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
import { satelliteTint, satelliteTintIndex, SATELLITE_TINT_PALETTE } from '../src/constants/beamRoleTokens.ts';
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
    ...deriveRuntimeVisualSettings('tuning', false),
    beamDensity: 'all',
    viewport: { width: 1600, height: 1000 },
    ueCount: UE_COUNT,
    uePrimaryAnchorMode: 'observer',
  };

  const PALETTE_LEN = SATELLITE_TINT_PALETTE.length;
  // satId -> { tints seen, glyphs seen, displayOrders seen }
  const tintsBySatId = new Map<string, Set<string>>();
  const glyphsBySatId = new Map<string, Set<string>>();
  const ordersBySatId = new Map<string, Set<number>>();
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
    viz.displaySats.forEach((sat, displayOrder) => {
      if (!tintsBySatId.has(sat.id)) {
        tintsBySatId.set(sat.id, new Set());
        glyphsBySatId.set(sat.id, new Set());
        ordersBySatId.set(sat.id, new Set());
      }
      tintsBySatId.get(sat.id)!.add(sat.satelliteTintColor);
      glyphsBySatId.get(sat.id)!.add(String(sat.satelliteGlyph));
      ordersBySatId.get(sat.id)!.add(displayOrder);
      allTints.add(sat.satelliteTintColor);
    });
  }

  assert.ok(tintsBySatId.size > 0, `[${GATE}] vacuous: no display satellites captured across ${STEP_COUNT} steps`);

  // 1. STABLE — every satellite's tint AND glyph are constant across all frames.
  for (const [satId, tints] of tintsBySatId) {
    assert.equal(tints.size, 1, `[${GATE}] satellite ${satId} churned colour: ${[...tints].join(', ')}`);
    const glyphs = glyphsBySatId.get(satId)!;
    assert.equal(glyphs.size, 1, `[${GATE}] satellite ${satId} churned glyph: ${[...glyphs].join(', ')}`);
  }

  // 2. NON-VACUOUS — at least one sat appeared at two display orders that differ
  //    MODULO the palette length: the EXACT condition under which the retired
  //    `displayOrder % len` mapping would have churned (orders that collide
  //    mod-len, e.g. {0,4,8}, are a no-op for the old code and prove nothing).
  let churnExposedSats = 0;
  let maxOrderSpread = 0;
  for (const orders of ordersBySatId.values()) {
    maxOrderSpread = Math.max(maxOrderSpread, orders.size);
    if (new Set([...orders].map(o => o % PALETTE_LEN)).size >= 2) churnExposedSats += 1;
  }
  assert.ok(
    churnExposedSats > 0,
    `[${GATE}] vacuous stability: no satellite spanned display orders differing mod ${PALETTE_LEN} (max distinct orders=${maxOrderSpread}) — the retired mapping's churn condition was never exercised`,
  );

  // 3. PURE — captured tint/glyph == the satId-keyed functions, displayOrder ignored.
  for (const [satId, tints] of tintsBySatId) {
    const tint = [...tints][0]!;
    const glyph = [...glyphsBySatId.get(satId)!][0]!;
    assert.equal(tint, satelliteTint(satId), `[${GATE}] ${satId} captured tint ${tint} != satelliteTint(${satId})=${satelliteTint(satId)}`);
    assert.equal(glyph, String(satelliteGlyph(satelliteTintIndex(satId))), `[${GATE}] ${satId} captured glyph ${glyph} != satelliteGlyph(satelliteTintIndex(${satId}))`);
    for (const order of [0, 1, 7, 99]) {
      assert.equal(satelliteTint(satId, order), tint, `[${GATE}] ${satId} satelliteTint not display-order-invariant at order ${order}`);
      assert.equal(satelliteTintIndex(satId, order), satelliteTintIndex(satId), `[${GATE}] ${satId} satelliteTintIndex not display-order-invariant at order ${order}`);
      assert.equal(String(satelliteGlyph(satelliteTintIndex(satId, order))), glyph, `[${GATE}] ${satId} satelliteGlyph not display-order-invariant at order ${order}`);
    }
  }

  // 4. EXERCISED — palette is not mono.
  assert.ok(allTints.size >= 2, `[${GATE}] palette not exercised: only ${allTints.size} distinct tint(s) across all sats`);
  for (const tint of allTints) {
    assert.ok((SATELLITE_TINT_PALETTE as readonly string[]).includes(tint), `[${GATE}] tint ${tint} is not a palette colour`);
  }

  console.log(`[${GATE}] PASS — ${tintsBySatId.size} sats tint+glyph stable across ${STEP_COUNT} steps; ${churnExposedSats} sats spanned mod-${PALETTE_LEN} display orders (max ${maxOrderSpread} ranks) yet kept their identity; ${allTints.size}/${SATELLITE_TINT_PALETTE.length} palette colours used`);
}

run();
