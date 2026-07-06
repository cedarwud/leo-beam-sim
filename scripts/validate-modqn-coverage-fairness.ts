#!/usr/bin/env node

// validate:modqn:coverage-fairness — the P3 slice-2 coverage/fairness gate.
//
// Locks the pure coverage/fairness aggregator (src/showcase/coverageFairness.ts)
// against BOTH staged H2 scene windows and pins the coverage WIN-AXIS invariant so
// the toggle-slam narrative (b1 red sea → a2 all-green) can never silently drift:
//   a2 auction hero:   Gini < 0.01  AND mean served-fraction > 0.99  (all-green)
//   b1 argmax baseline: Gini > 0.5  AND worst-off served-fraction == 0 (red sea)
// plus a tight reproduction of the controller oracle (a2 Gini≈0.0025 mean≈0.9968;
// b1 Gini≈0.7400 mean≈0.2600) to catch an algorithm regression.
//
// Assertions are BEHAVIORAL (run the aggregator on real producer windows, compare
// its OUTPUT) — NOT source-pinned string greps (frontend-change-contract Rule 4).
// The one structural assert (purity) guards the module's display-only boundary.
//
// Discovered automatically by validate:static:all (node --import, no '&&').

import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  currentFrameCoverage,
  windowServedFractionStats,
  type CoverageFrame,
} from '../src/showcase/coverageFairness.ts';
import {
  deriveWindowReplayCue,
  type WindowReplayCueFrame,
} from '../src/showcase/windowReplayCue.ts';
import { skipIfDataUnavailable } from './lib/ci-data-guard.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(HERE);
const SHOWCASE_DIR = join(REPO_ROOT, 'src/showcase');

// Staged read-only via the same /tmp convention as the decode-parity gate. /tmp is
// cleared on reboot, so the error path prints the exact re-stage command (SDD §8 R2).
const BUNDLES = '/tmp/leo-beam-sim/modqn-bundles';
const DENSE_ABLATION = `${BUNDLES}/h2-dense-ablation-2026-07-04`;

interface ArmExpectation {
  readonly arm: 'a2' | 'b1';
  readonly window: string;
  readonly frame0Served: number;
  readonly frame0Starved: number;
  // win-axis invariant bounds (the load-bearing gate)
  readonly giniBound: (g: number) => boolean;
  readonly meanBound: (m: number) => boolean;
  readonly minBound: (m: number) => boolean;
  // controller oracle (algorithm-drift tripwire), rel/abs tol 2e-3
  readonly oracleGini: number;
  readonly oracleMean: number;
}

const ARMS: readonly ArmExpectation[] = [
  {
    arm: 'a2',
    window: `${BUNDLES}/h2-scene-a2-t0_9000-w117_213/visual-showcase-v1.json`,
    frame0Served: 100,
    frame0Starved: 0,
    giniBound: g => g < 0.01,
    meanBound: m => m > 0.99,
    minBound: m => m > 0.9,
    oracleGini: 0.0025,
    oracleMean: 0.9968,
  },
  {
    arm: 'b1',
    window: `${BUNDLES}/h2-scene-b1-t0_9000-w117_213/visual-showcase-v1.json`,
    frame0Served: 26,
    frame0Starved: 74,
    giniBound: g => g > 0.5,
    meanBound: m => m < 0.4,
    minBound: m => m === 0,
    oracleGini: 0.74,
    oracleMean: 0.26,
  },
];

const ORACLE_TOL = 2e-3;

// CI-environment guard (P2 SN-3c): the staged H2 scene windows are this
// validator's data contract and it cannot self-heal (a human must re-stage after
// a reboot — loadWindowFrames() documents the exact command), so a missing
// staging is a visible SKIP (exit 0 + marker naming the missing window) rather
// than a red — on the dev machine AND on a hosted CI runner. See
// scripts/lib/ci-data-guard.ts for the SKIP semantics.
skipIfDataUnavailable(ARMS.map(({ arm, window }) => ({
  path: window,
  why: `staged H2 ${arm} scene window — /tmp cleared on reboot; re-stage via node scripts/build-h2-scene-payload.mjs (see loadWindowFrames)`,
})));

function checkPurity(): void {
  // The coverage aggregator must stay display-only: no render/engine truth deps.
  const forbidden = /^(react|three)(\/|$)/;
  const forbiddenPath = /(?:^|\/)(?:viz|app|scene|engine|core)\//;
  const importRe = /(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]/g;
  const file = join(SHOWCASE_DIR, 'coverageFairness.ts');
  assert.ok(existsSync(file), `coverageFairness.ts missing: ${file}`);
  const src = readFileSync(file, 'utf8');
  let m: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((m = importRe.exec(src)) !== null) {
    const spec = m[1];
    assert.ok(
      !forbidden.test(spec) && !forbiddenPath.test(spec),
      `PURITY: coverageFairness.ts imports forbidden module '${spec}' (display-only: no render/engine/truth deps)`,
    );
  }
  console.log('  [purity] coverageFairness.ts clean (no react/three/viz/app/scene/engine/core import)');
}

function loadWindowFrames(path: string): readonly CoverageFrame[] {
  if (!existsSync(path)) {
    // Best-effort hint about whether the ablation source is present for a rebuild.
    const srcHint = existsSync(DENSE_ABLATION)
      ? `The dense-ablation source IS present (${DENSE_ABLATION}).`
      : `The dense-ablation source is ALSO missing (${DENSE_ABLATION}).`;
    throw new Error(
      `staged H2 scene window missing: ${path}\n`
        + `  (/tmp is cleared on reboot — the known-fragile staging convention).\n`
        + `  ${srcHint}\n`
        + `  Re-stage the scene windows from the ablation source (SDD §8 R2):\n`
        + `    node scripts/build-h2-scene-payload.mjs \\\n`
        + `      ${DENSE_ABLATION}/<arm>-t0_9000-w117_213/visual-showcase-v1.json \\\n`
        + `      ${BUNDLES}/h2-scene-<arm>-t0_9000-w117_213/visual-showcase-v1.json \\\n`
        + `      ${DENSE_ABLATION}/<arm>-t0_9000-w117_213/timeline/step-trace.jsonl`,
    );
  }
  const art = JSON.parse(readFileSync(path, 'utf8')) as { timeline?: readonly CoverageFrame[] };
  const timeline = art.timeline ?? [];
  assert.ok(timeline.length > 0, `${path}: empty timeline`);
  return timeline;
}

function approx(actual: number, expected: number, tol: number, label: string): void {
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `${label}: ${actual} vs oracle ${expected} (|diff| ${Math.abs(actual - expected)} > tol ${tol})`,
  );
}

function checkArm(exp: ArmExpectation): void {
  const frames = loadWindowFrames(exp.window);
  const f0 = currentFrameCoverage(frames[0]);
  const stats = windowServedFractionStats(frames);

  // frame0 coverage matches the recorded producer served/starved split.
  assert.equal(f0.served, exp.frame0Served, `${exp.arm}: frame0 served (${f0.served}) != ${exp.frame0Served}`);
  assert.equal(
    f0.total - f0.served,
    exp.frame0Starved,
    `${exp.arm}: frame0 starved (${f0.total - f0.served}) != ${exp.frame0Starved}`,
  );

  // Win-axis invariant (the load-bearing gate): the narrative direction is locked.
  assert.ok(exp.giniBound(stats.gini), `${exp.arm}: Gini ${stats.gini} fails win-axis bound`);
  assert.ok(exp.meanBound(stats.meanServedFraction), `${exp.arm}: mean ${stats.meanServedFraction} fails win-axis bound`);
  assert.ok(exp.minBound(stats.minServedFraction), `${exp.arm}: worst-off ${stats.minServedFraction} fails win-axis bound`);

  // Algorithm-drift tripwire: reproduce the controller oracle numbers tightly.
  approx(stats.gini, exp.oracleGini, ORACLE_TOL, `${exp.arm} Gini`);
  approx(stats.meanServedFraction, exp.oracleMean, ORACLE_TOL, `${exp.arm} mean`);

  // Lorenz curve is well-formed: starts at origin, ends at (1, 1) when sum>0,
  // and cumulative served share is monotonic non-decreasing (convexity of Lorenz).
  const lp = stats.lorenzPoints;
  assert.deepEqual(lp[0], [0, 0], `${exp.arm}: Lorenz must start at origin`);
  const last = lp[lp.length - 1];
  approx(last[0], 1, 1e-9, `${exp.arm} Lorenz end pop`);
  approx(last[1], 1, 1e-9, `${exp.arm} Lorenz end share`);
  for (let i = 1; i < lp.length; i += 1) {
    assert.ok(lp[i][1] >= lp[i - 1][1] - 1e-12, `${exp.arm}: Lorenz share not monotonic at ${i}`);
  }

  console.log(
    `  [${exp.arm}] frame0 ${f0.served}/${f0.total} served · window mean ${stats.meanServedFraction.toFixed(4)} `
      + `min ${stats.minServedFraction.toFixed(4)} Gini ${stats.gini.toFixed(4)} (n=${stats.ueCount}) — win-axis OK`,
  );
}

interface RawWindowUe {
  readonly id: string;
  readonly servingSatelliteId: string;
  readonly servingBeamId: string;
  readonly targetSatelliteId: string | null;
  readonly targetBeamId: string | null;
  readonly served?: boolean;
  readonly starved?: boolean;
}

function loadRawFrame0(path: string): { readonly tSec: number; readonly ues: readonly RawWindowUe[] } {
  const art = JSON.parse(readFileSync(path, 'utf8')) as {
    timeline?: ReadonlyArray<{ tSec?: number; ues?: readonly RawWindowUe[] }>;
  };
  const f0 = art.timeline?.[0];
  assert.ok(f0 !== undefined && Array.isArray(f0.ues) && f0.ues.length > 0, `${path}: no frame-0 ues`);
  return { tSec: f0.tSec ?? 0, ues: f0.ues };
}

// P3 slice-3 window-cue invariant (BEHAVIORAL, not a source grep): the pure display
// adapter deriveWindowReplayCue reads the recorded window's producer served / serving
// / target truth for a focus UE, so the modqn-replay-proof cue panel agrees with the
// on-screen field. Locks: a2 focus UE = served (green) with the frame's serving beam;
// b1 starved focus UE = served=false (red-sea truth flows); null frame -> null; and the
// adapter stays display-only (no render/engine import; never names SINR / reward).
function checkWindowReplayCue(): void {
  const file = join(SHOWCASE_DIR, 'windowReplayCue.ts');
  assert.ok(existsSync(file), `windowReplayCue.ts missing: ${file}`);
  const src = readFileSync(file, 'utf8');
  const forbidden = /^(react|three)(\/|$)/;
  const forbiddenPath = /(?:^|\/)(?:viz|app|scene|engine|core)\//;
  const importRe = /(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((m = importRe.exec(src)) !== null) {
    const spec = m[1];
    assert.ok(
      !forbidden.test(spec) && !forbiddenPath.test(spec),
      `PURITY: windowReplayCue.ts imports forbidden module '${spec}' (display-only: no render/engine/truth deps)`,
    );
  }
  assert.ok(
    !/sinr/i.test(src) && !/reward/i.test(src),
    'PURITY: windowReplayCue.ts must not name SINR or reward (it reads served/serving/target truth only, derives neither)',
  );

  const a2 = ARMS.find(arm => arm.arm === 'a2');
  assert.ok(a2 !== undefined, 'a2 arm expectation present');
  const a2f0 = loadRawFrame0(a2.window);
  const a2ue0 = a2f0.ues[0];
  const a2frame: WindowReplayCueFrame = { frameIndex: 0, tSec: a2f0.tSec, ues: a2f0.ues };
  const a2cue = deriveWindowReplayCue(a2frame, a2ue0.id);
  assert.ok(a2cue !== null, 'a2 window focus-UE cue must derive');
  assert.equal(a2cue.focusUeId, a2ue0.id, 'a2 cue focus UE matches the requested UE');
  assert.equal(a2cue.focusSelection, 'elevated', 'a2 cue reports the elevated focus selection');
  assert.equal(a2cue.served, true, 'a2 focus UE is served (all-green window)');
  assert.equal(a2cue.servingBeamId, a2ue0.servingBeamId, 'a2 cue serving beam == recorded frame serving beam');
  assert.equal(
    a2cue.servingSatelliteId,
    a2ue0.servingSatelliteId,
    'a2 cue serving satellite == recorded frame serving satellite',
  );
  assert.ok(
    ['serving-beam-hold', 'intra-satellite-beam-switch', 'inter-satellite-handover'].includes(a2cue.eventKind),
    'a2 cue event kind is a valid classification',
  );

  // Null frame -> null cue (the caller falls back to the baseline cue).
  assert.equal(deriveWindowReplayCue(null, a2ue0.id), null, 'null frame yields null cue');

  // b1 red sea: a starved focus UE surfaces served=false, proving producer coverage
  // truth flows through the cue (not just the a2 happy path).
  const b1 = ARMS.find(arm => arm.arm === 'b1');
  assert.ok(b1 !== undefined, 'b1 arm expectation present');
  const b1f0 = loadRawFrame0(b1.window);
  const starved = b1f0.ues.find(ue => ue.starved === true);
  assert.ok(starved !== undefined, 'b1 frame0 carries at least one starved UE (red-sea truth)');
  const b1frame: WindowReplayCueFrame = { frameIndex: 0, tSec: b1f0.tSec, ues: b1f0.ues };
  const b1cue = deriveWindowReplayCue(b1frame, starved.id);
  assert.ok(b1cue !== null, 'b1 starved focus-UE cue must derive');
  assert.equal(b1cue.served, false, 'b1 starved focus UE surfaces served=false (red-sea truth flows)');

  console.log(
    `  [window-cue] a2 focus ${a2cue.focusUeId} served=${a2cue.served} beam=${a2cue.servingBeamLabel} `
      + `· b1 starved ${b1cue.focusUeId} served=${b1cue.served} — cue agrees with recorded window`,
  );
}

function checkGateWiring(): void {
  // Guard the self-discovery contract: this file must sit in scripts/ so
  // validate-static-all.mjs picks it up (it scans the validate:* leaves).
  const files = readdirSync(HERE);
  assert.ok(
    files.includes('validate-modqn-coverage-fairness.ts'),
    'this validator must live in scripts/ for validate:static:all self-discovery',
  );
}

function main(): void {
  console.log('validate:modqn:coverage-fairness');
  checkGateWiring();
  checkPurity();
  for (const arm of ARMS) checkArm(arm);
  checkWindowReplayCue();
  console.log('PASS: coverageFairness reproduces the producer coverage win-axis on both H2 windows,');
  console.log('      and deriveWindowReplayCue agrees with the recorded window on both arms.');
}

try {
  main();
} catch (err) {
  console.error(`FAIL: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
