import assert from 'node:assert/strict';
import {
  BEAM_PULSE_SPECS,
  BEAM_ROLE_TOKENS,
  frequencyReuseColor,
  resolveBeamPulseOpacity,
  resolveBeamVisualEncoding,
} from '../src/constants/beamRoleTokens.ts';
import { assertCanvasNonBlank, sampleCanvas, withVc2Browser } from './_vc2-browser-fixture.ts';
import { MEASURED_BROWSER_GATE_FLOORS_MS, runBrowserValidator } from './lib/browser-gate.ts';

function assertTokenContract(): void {
  assert.equal(BEAM_ROLE_TOKENS.serving.dashed, false, 'serving must stay solid');
  assert.equal(BEAM_ROLE_TOKENS.serving.pulse, 'none', 'serving must not pulse');
  assert.equal(BEAM_ROLE_TOKENS.pending.dashed, false, 'pending must be solid after Phase 2D');
  assert.equal(BEAM_ROLE_TOKENS.pending.pulse, 'breathe', 'pending must breathe');
  assert.equal(BEAM_ROLE_TOKENS.approach.dashed, false, 'approach must be solid after Phase 2D');
  assert.equal(BEAM_ROLE_TOKENS.approach.pulse, 'pulse', 'approach must pulse');
  assert.equal(BEAM_ROLE_TOKENS.recentSource.dashed, false, 'recentSource must be solid after Phase 2D');
  assert.equal(BEAM_ROLE_TOKENS.recentSource.pulse, 'fade', 'recentSource must fade');
  assert.equal(BEAM_ROLE_TOKENS.inactive.dashed, true, 'inactive remains the only role-level dash owner');
  assert.equal(BEAM_ROLE_TOKENS.inactive.pulse, 'none', 'inactive must not pulse');

  assert.deepEqual(BEAM_PULSE_SPECS.breathe, { periodSec: 2.4, amplitude: 0.06 });
  assert.deepEqual(BEAM_PULSE_SPECS.pulse, { periodSec: 1.4, amplitude: 0.05 });
  assert.deepEqual(BEAM_PULSE_SPECS.fade, { periodSec: 5, amplitude: 0.10 });
}

function assertPulseMath(): void {
  const pendingBase = BEAM_ROLE_TOKENS.pending.coneOpacity;
  const pendingPeak = resolveBeamPulseOpacity({
    baseOpacity: pendingBase,
    pulse: 'breathe',
    elapsedSec: 0.6,
  });
  const pendingTrough = resolveBeamPulseOpacity({
    baseOpacity: pendingBase,
    pulse: 'breathe',
    elapsedSec: 1.8,
  });
  assert.ok(pendingPeak > pendingBase + 0.055, 'pending breathe peak did not reach the declared amplitude');
  assert.ok(pendingTrough < pendingBase - 0.055, 'pending breathe trough did not reach the declared amplitude');

  const approachBase = BEAM_ROLE_TOKENS.approach.coneOpacity;
  const approachPeak = resolveBeamPulseOpacity({
    baseOpacity: approachBase,
    pulse: 'pulse',
    elapsedSec: 0.35,
  });
  const approachTrough = resolveBeamPulseOpacity({
    baseOpacity: approachBase,
    pulse: 'pulse',
    elapsedSec: 1.05,
  });
  assert.ok(approachPeak > approachBase + 0.045, 'approach pulse peak did not reach the declared amplitude');
  assert.ok(approachTrough < approachBase - 0.045, 'approach pulse trough did not reach the declared amplitude');

  const recentBase = BEAM_ROLE_TOKENS.recentSource.coneOpacity;
  const recentStart = resolveBeamPulseOpacity({
    baseOpacity: recentBase,
    pulse: 'fade',
    elapsedSec: 0,
    roleAgeSec: 0,
  });
  const recentMid = resolveBeamPulseOpacity({
    baseOpacity: recentBase,
    pulse: 'fade',
    elapsedSec: 1,
    roleAgeSec: 1,
  });
  const recentEnd = resolveBeamPulseOpacity({
    baseOpacity: recentBase,
    pulse: 'fade',
    elapsedSec: 2,
    roleAgeSec: 2,
  });
  assert.ok(recentStart > recentMid && recentMid > recentEnd, 'recentSource fade must be monotonic over the linger window');

  const reduced = resolveBeamPulseOpacity({
    baseOpacity: pendingBase,
    pulse: 'breathe',
    elapsedSec: 0.6,
    reducedMotion: true,
  });
  assert.equal(reduced, pendingBase, 'reducedMotion must collapse pulse opacity to the static value');
}

function assertOffSlotDashOverride(): void {
  const encoding = resolveBeamVisualEncoding({
    role: 'prepared',
    isPrimary: true,
    isServing: false,
    isScheduledActive: false,
    frequencyColor: frequencyReuseColor(1),
  });
  assert.equal(encoding.dashed, true, 'off-slot pending beam must keep the slot-state dash override');
  assert.equal(encoding.pulse, 'breathe', 'off-slot pending beam must retain pending pulse identity');
}

async function assertBrowserFixture() {
  return withVc2Browser(async page => {
    const result = await page.evaluate(async () => window.__renderVc2NonTextChannelsFixture());
    const reduced = await page.evaluate(async () => window.__renderVc2NonTextChannelsFixture({ reducedMotion: true }));
    const sample = await sampleCanvas(page);
    assertCanvasNonBlank(sample, 'Phase 2D');

    const byRole = new Map(result.beams.map(beam => [beam.role, beam]));
    assert.equal(byRole.get('pending')?.dashed, false, 'pending fixture rendered dashed');
    assert.equal(byRole.get('pending')?.pulse, 'breathe', 'pending fixture did not breathe');
    assert.equal(byRole.get('approach')?.dashed, false, 'approach fixture rendered dashed');
    assert.equal(byRole.get('approach')?.pulse, 'pulse', 'approach fixture did not pulse');
    assert.equal(byRole.get('recentSource')?.dashed, false, 'recentSource fixture rendered dashed');
    assert.equal(byRole.get('recentSource')?.pulse, 'fade', 'recentSource fixture did not fade');

    const pendingSamples = byRole.get('pending')?.pulseSamples ?? [];
    assert.ok(Math.max(...pendingSamples) - Math.min(...pendingSamples) >= 0.1, 'pending pulse envelope was too flat');

    const recentSamples = byRole.get('recentSource')?.pulseSamples ?? [];
    assert.ok(
      recentSamples.every((value, index) => index === 0 || value <= recentSamples[index - 1]),
      'recentSource browser fixture fade samples were not monotonic',
    );

    for (const beam of reduced.beams) {
      assert.ok(
        beam.reducedMotionSamples.every(value => Math.abs(value - beam.staticOpacity) <= 0.0001),
        `${beam.role} did not collapse to static opacity under reducedMotion`,
      );
    }

    return {
      sample,
      pulseSamples: result.beams.map(beam => ({
        role: beam.role,
        dashed: beam.dashed,
        pulse: beam.pulse,
        samples: beam.pulseSamples,
      })),
      reducedMotion: 'static samples passed',
    };
  });
}

async function main(): Promise<void> {
  assertTokenContract();
  assertPulseMath();
  assertOffSlotDashOverride();
  const browser = await assertBrowserFixture();

  console.log('Visual Clarity Phase 2D role-pulse envelope validation passed.');
  console.log(JSON.stringify({
    v1: {
      tokenContract: 'passed',
      pulseMath: 'passed',
      offSlotDashOverride: 'passed',
    },
    v3: browser,
    result: 'PASS',
  }, null, 2));
}

void runBrowserValidator(
  {
    validator: 'validate-vc2d-role-pulse-envelopes',
    appUrl: process.env.APP_URL ?? process.argv[2],
    floorMs: MEASURED_BROWSER_GATE_FLOORS_MS.quickCanvas,
  },
  async () => main(),
).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
