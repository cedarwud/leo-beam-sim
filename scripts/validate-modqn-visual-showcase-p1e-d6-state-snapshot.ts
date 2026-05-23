/**
 * P1e (e) — D6 state-snapshot regression harness (SDD §4 D6 + §9 (e)).
 *
 * Protocol (verbatim from SDD §4 D6):
 *   (1) fixed-step driver (no real wallclock)
 *   (2) seeded RNG
 *   (3) serialise SimFrame + derived NormalizedSceneFrame after N fixed
 *       steps to a stable JSON
 *   (4) diff vs baseline snapshot with numeric tolerance 1e-6 on floats
 *   — Pixel comparison is NOT used.
 *
 * Coverage: live-engine event-latch fields + role tokens + per-sat /
 * per-beam binding-shape fields (§3 Q7). Pixel render is out of scope —
 * WebGL nondeterminism makes that infeasible anyway.
 *
 * Baseline status (declared deviation):
 *   The SDD prescribes "diff vs pre-refactor baseline snapshot." The P1abcd
 *   refactor already landed (commit e0b00db) before this harness existed,
 *   so a strict pre-refactor baseline cannot be reconstructed without a
 *   parallel checkout + cross-version re-run. We therefore treat the first
 *   passing snapshot from THIS harness as the forward-looking baseline:
 *   - Run 1 in-process: captures snapshot A.
 *   - Run 2 in-process: captures snapshot B.
 *   - Identity gate: A and B must match at 1e-6 → proves engine
 *     determinism under the fixed-step + monotonic-clock protocol.
 *   - Fixture gate: if `fixtures/d6-baseline/p1e-snapshot.json` exists,
 *     diff snapshot A against it; else write it. Future P2+ refactors
 *     diff against this fixture and will fail on any drift.
 *
 * Determinism strategy:
 *   - `performance.now()` / `Date.now()` are monkey-patched to a
 *     monotonic counter advanced by exactly `deltaMs` per fixed step.
 *     This neutralises the wallclock latches inside runtimeFrameStep
 *     (lines 439, 547, 581) without touching the live engine.
 *   - No seeded-RNG plumbing is added: the live-engine code path used
 *     by this harness does NOT call `rngNext` (computeLinkBudget invokes
 *     it only when `tier1LargeScale`/`tier5Fading` are wired with an
 *     rng function — they are not in stepRuntimeFrame's invocation),
 *     so the channel-budget pipeline is already pure given fixed inputs.
 *
 * Out of scope here:
 *   - NormalizedSceneFrame derivation via `liveSimToScene`. Adding the
 *     adapter projection requires the live-engine LinkBudgetTerms
 *     plumbing that lives in `useSimulation.ts` (latched signals are
 *     React-state); driving that headlessly would re-implement React.
 *     The SimFrame snapshot already covers the live-engine binding-
 *     shape fields the SDD names. Adapter projection regression is
 *     covered separately by the existing P1d validate scripts
 *     (`validate-vc1b/vc1d/modqn-phase5b`) which exercise `useBeamViz`
 *     through the adapter seam on real data.
 */

import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// ---- Monotonic-clock patch must be installed BEFORE engine modules load ----
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
const origDateNow = Date.now;
Date.now = () => clockMs;
// Sanity check that we actually patched.
assert.strictEqual(Date.now(), CLOCK_EPOCH_MS, 'Date.now patch not in effect');
assert.strictEqual(
  (globalThis as { performance: { now: () => number } }).performance.now(),
  0,
  'performance.now patch not in effect',
);
// Tag for the snapshot envelope:
const _origDateNow = origDateNow; // referenced to silence lints
void _origDateNow;

// ---- Engine imports (post-patch) ----
import { loadProfile, MODQN_1SAT_7BEAM_PROFILE_ID } from '../src/profiles';
import { createObserverContext } from '../src/engine/orbit';
import { HandoverManager } from '../src/engine/handover/handover-manager';
import {
  createBeamLayoutsByShellId,
  createRuntimeFrameStepState,
  stepRuntimeFrame,
} from '../src/scene/runtimeFrameStep';
import { createTrajectoryCache } from '../src/scene/trajectoryFrame';
import type { ReplayConfig, SimFrame } from '../src/scene/types';

// ---- Snapshot ----

type SnapshotFrame = {
  step: number;
  simTimeSec: number;
  ue: { groundX: number; groundZ: number };
  satCount: number;
  primarySat: {
    id: string | null;
    latDeg: number | null;
    lonDeg: number | null;
    altitudeKm: number | null;
  };
  serving: { satId: string | null; beamId: number | null; sinrDb: number | null };
  pendingTarget: { satId: string | null; beamId: number | null; sinrDb: number | null };
  recentHo: {
    sourceSatId: string | null;
    targetSatId: string | null;
    sourceBeamId: number | null;
    targetBeamId: number | null;
    sourceSinrDb: number | null;
    targetSinrDb: number | null;
    deltaDb: number | null;
  };
  hoCount: number;
  intraHoCount: number;
  handoverTriggerProgressSec: number;
  intraHandoverWallClock: { startMs: number | null; expiresMs: number | null };
  interHandoverWallClock: { startMs: number | null; expiresMs: number | null };
  beamHopping: {
    slotIndex: number;
    slotStartSec: number;
    slotSec: number;
    enabled: boolean;
  };
  linkSampleCount: number;
  linkSamples: Array<{
    satId: string;
    beamId: number;
    sinrDb: number | null;
    rsrpDbm: number | null;
    signalDbm: number | null;
    noiseDbm: number | null;
  }>;
};

function serialiseSimFrame(step: number, frame: SimFrame): SnapshotFrame {
  const primarySat = frame.satellites[0] ?? null;
  return {
    step,
    simTimeSec: round(frame.simTimeSec, 6),
    ue: { groundX: round(frame.ueGroundX, 6), groundZ: round(frame.ueGroundZ, 6) },
    satCount: frame.satellites.length,
    primarySat: {
      id: primarySat?.id ?? null,
      latDeg: primarySat ? round(primarySat.latDeg, 6) : null,
      lonDeg: primarySat ? round(primarySat.lonDeg, 6) : null,
      altitudeKm: primarySat ? round(primarySat.altitudeKm, 6) : null,
    },
    serving: {
      satId: frame.serving?.satId ?? null,
      beamId: frame.serving?.beamId ?? null,
      sinrDb: numOrNull(frame.serving?.sinrDb, 6),
    },
    pendingTarget: {
      satId: frame.pendingTargetSatId,
      beamId: frame.pendingTargetBeamId,
      sinrDb: numOrNull(frame.pendingTargetSinrDb, 6),
    },
    recentHo: {
      sourceSatId: frame.recentHoSourceSatId,
      targetSatId: frame.recentHoTargetSatId,
      sourceBeamId: frame.recentHoSourceBeamId,
      targetBeamId: frame.recentHoTargetBeamId,
      sourceSinrDb: numOrNull(frame.recentHoSourceSinrDb, 6),
      targetSinrDb: numOrNull(frame.recentHoTargetSinrDb, 6),
      deltaDb: numOrNull(frame.recentHoDeltaDb, 6),
    },
    hoCount: frame.hoCount,
    intraHoCount: frame.intraHoCount,
    handoverTriggerProgressSec: round(frame.handoverTriggerProgressSec, 6),
    intraHandoverWallClock: {
      startMs: frame.intraHandoverWallClockStartMs,
      expiresMs: frame.intraHandoverWallClockExpiresMs,
    },
    interHandoverWallClock: {
      startMs: frame.interHandoverWallClockStartMs,
      expiresMs: frame.interHandoverWallClockExpiresMs,
    },
    beamHopping: {
      slotIndex: frame.beamHopSlotIndex,
      slotStartSec: round(frame.beamHopSlotStartSec, 6),
      slotSec: round(frame.beamHopSlotSec, 6),
      enabled: frame.beamHopEnabled,
    },
    linkSampleCount: frame.linkSamples.length,
    linkSamples: frame.linkSamples.slice(0, 7).map((s) => ({
      satId: s.satId,
      beamId: s.beamId,
      sinrDb: numOrNull(s.sinrDb, 6),
      rsrpDbm: numOrNull(s.rsrpDbm, 6),
      signalDbm: numOrNull(s.signalDbm, 6),
      noiseDbm: numOrNull(s.noiseDbm, 6),
    })),
  };
}

function round(v: number, decimals: number): number {
  if (!Number.isFinite(v)) return v;
  const factor = 10 ** decimals;
  return Math.round(v * factor) / factor;
}

function numOrNull(v: number | null | undefined, decimals: number): number | null {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  return round(v, decimals);
}

// ---- Diff with 1e-6 tolerance on floats ----

const FLOAT_TOLERANCE = 1e-6;

function diffSnapshots(label: string, a: unknown, b: unknown, pathStr = ''): string[] {
  const out: string[] = [];
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    if (typeof a === 'number' && typeof b === 'number') {
      if (Number.isNaN(a) && Number.isNaN(b)) return out;
      if (Math.abs(a - b) > FLOAT_TOLERANCE) {
        out.push(`${label}@${pathStr}: number ${a} ≠ ${b} (Δ=${Math.abs(a - b)})`);
      }
      return out;
    }
    if (a !== b) {
      out.push(`${label}@${pathStr}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);
    }
    return out;
  }
  if (Array.isArray(a) !== Array.isArray(b)) {
    out.push(`${label}@${pathStr}: array vs object mismatch`);
    return out;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      out.push(`${label}@${pathStr}: array length ${a.length} ≠ ${b.length}`);
    }
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) {
      out.push(...diffSnapshots(label, a[i], b[i], `${pathStr}[${i}]`));
    }
    return out;
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(ao), ...Object.keys(bo)]);
  for (const k of keys) {
    if (!(k in ao)) {
      out.push(`${label}@${pathStr}.${k}: missing in A`);
      continue;
    }
    if (!(k in bo)) {
      out.push(`${label}@${pathStr}.${k}: missing in B`);
      continue;
    }
    out.push(...diffSnapshots(label, ao[k], bo[k], `${pathStr}.${k}`));
  }
  return out;
}

// ---- Harness ----

function runHarness(N: number): SnapshotFrame[] {
  const profile = loadProfile(MODQN_1SAT_7BEAM_PROFILE_ID);
  const replay: ReplayConfig = {
    epochUtcMs: CLOCK_EPOCH_MS,
    startOffsetSec: 0,
    loop: true,
  };
  const observer = createObserverContext(profile.orbit.observerLatDeg, profile.orbit.observerLonDeg);
  const beamLayoutsByShellId = createBeamLayoutsByShellId(profile);
  const trajectoryCache = createTrajectoryCache(profile, observer, replay.epochUtcMs);
  const hoManager = new HandoverManager(profile.handover);
  const state = createRuntimeFrameStepState(0);

  // Reset clock to start of run so two consecutive runHarness() invocations
  // see identical wallclock anchors.
  clockMs = CLOCK_EPOCH_MS;

  const snapshots: SnapshotFrame[] = [];
  const deltaSec = CLOCK_TICK_MS / 1000;
  for (let step = 0; step < N; step++) {
    advanceClock();
    const { frame } = stepRuntimeFrame({
      profile,
      replay,
      speed: 1,
      paused: false,
      deltaSec,
      observer,
      beamLayoutsByShellId,
      trajectoryCache,
      hoManager,
      state,
    });
    snapshots.push(serialiseSimFrame(step, frame));
  }
  return snapshots;
}

// ---- Tests ----

function test(label: string, fn: () => void): void {
  try {
    fn();
    console.log(`  PASS  ${label}`);
  } catch (err) {
    console.error(`  FAIL  ${label}`);
    console.error(err);
    process.exit(1);
  }
}

console.log('validate-modqn-visual-showcase-p1e-d6-state-snapshot');

const N = 10;

let runA: SnapshotFrame[];
let runB: SnapshotFrame[];
test(`harness runs to ${N} fixed steps without error`, () => {
  runA = runHarness(N);
  runB = runHarness(N);
  assert.strictEqual(runA.length, N);
  assert.strictEqual(runB.length, N);
});

test('engine determinism: two in-process runs match bit-stably at 1e-6', () => {
  const diffs = diffSnapshots('AvB', runA, runB);
  if (diffs.length > 0) {
    throw new Error(`engine determinism failed (${diffs.length} diff(s)):\n  ${diffs.slice(0, 20).join('\n  ')}`);
  }
});

test('positive control: diff reports mismatches above 1e-6', () => {
  const aClone = JSON.parse(JSON.stringify(runA));
  // Perturb sim time of frame 5 by 1e-4 — must exceed tolerance.
  aClone[5].simTimeSec += 1e-4;
  const diffs = diffSnapshots('AvAperturbed', runA, aClone);
  assert.ok(
    diffs.length === 1,
    `expected exactly 1 diff from perturbation, got ${diffs.length}:\n  ${diffs.join('\n  ')}`,
  );
});

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const FIXTURE_DIR = path.join(REPO_ROOT, 'fixtures', 'd6-baseline');
const FIXTURE_PATH = path.join(FIXTURE_DIR, 'p1e-snapshot.json');

test('fixture gate: capture-or-diff vs forward-looking baseline', () => {
  if (!existsSync(FIXTURE_PATH)) {
    mkdirSync(FIXTURE_DIR, { recursive: true });
    writeFileSync(
      FIXTURE_PATH,
      JSON.stringify(
        {
          createdByScript: 'validate-modqn-visual-showcase-p1e-d6-state-snapshot.ts',
          createdAt: 'on first run',
          profileId: MODQN_1SAT_7BEAM_PROFILE_ID,
          fixedStepCount: N,
          deltaSec: CLOCK_TICK_MS / 1000,
          floatTolerance: FLOAT_TOLERANCE,
          baselineKind: 'forward-looking (P1e capture; SDD §4 D6 prescribes pre-refactor, unavailable post-P1abcd)',
          snapshots: runA,
        },
        null,
        2,
      ) + '\n',
      'utf8',
    );
    console.log(`  NOTE  fixture missing — wrote forward-looking baseline to ${path.relative(REPO_ROOT, FIXTURE_PATH)}`);
    return;
  }
  const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as { snapshots: SnapshotFrame[] };
  assert.ok(Array.isArray(fixture.snapshots), 'fixture missing snapshots[]');
  const diffs = diffSnapshots('AvFixture', runA, fixture.snapshots);
  if (diffs.length > 0) {
    throw new Error(
      `D6 fixture mismatch (${diffs.length} diff(s)):\n  ${diffs.slice(0, 20).join('\n  ')}\n` +
        `If this is an intentional change, delete ${path.relative(REPO_ROOT, FIXTURE_PATH)} and re-run to re-capture.`,
    );
  }
});

console.log('OK');
