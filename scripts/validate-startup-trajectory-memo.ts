#!/usr/bin/env node

// Truth golden (Rule#2/#6) for L5 (startup-perf SDD): `createTrajectoryCache` was
// wrapped in a single-entry module-level memo so the back-to-back sinr-live double
// build (live `useSimulation` + offline cinema index scan, ~0.9 s each, identical
// inputs) reuses one array instead of recomputing. This gate proves the memo
// changed only WHEN the trajectory is computed, never WHAT it produces:
//   - memoized output is byte-identical to a fresh memo-bypassing compute;
//   - a repeat same-key call returns the SAME reference (the perf win is real);
//   - a different key recomputes and never returns a stale/colliding cache;
//   - the cache the runtime shares is treated read-only by `interpolateVisibleSats`.
//
// Run: node --import tsx/esm scripts/validate-startup-trajectory-memo.ts

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_EPOCH_MS } from '../src/app/appRuntimeConfig.ts';
import { createObserverContext } from '../src/engine/orbit/index.ts';
import { MODQN_4SAT_7BEAM_PAPER_FAITHFUL_PROFILE_ID, loadProfile } from '../src/profiles/index.ts';
import {
  computeTrajectoryCache,
  createTrajectoryCache,
  getTrajectoryMaxTimeSec,
  interpolateVisibleSats,
} from '../src/scene/trajectoryFrame.ts';
import type { Profile } from '../src/profiles/types.ts';

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const VALIDATOR_SCRIPT = 'node --import tsx/esm scripts/validate-startup-trajectory-memo.ts';

function readRepoFile(relativePath: string): string {
  return readFileSync(join(ROOT_DIR, relativePath), 'utf8');
}

function pass(label: string): void {
  console.log(`PASS: ${label}`);
}

function observerFor(profile: Profile): ReturnType<typeof createObserverContext> {
  return createObserverContext(profile.orbit.observerLatDeg, profile.orbit.observerLonDeg);
}

// ---- Static boundary: the memo wrapper + pure compute are the single code path ----
function validateStaticBoundary(): void {
  const source = readRepoFile('src/scene/trajectoryFrame.ts');
  assert.ok(
    source.includes('export function createTrajectoryCache'),
    'trajectoryFrame must keep the public createTrajectoryCache entry point',
  );
  assert.ok(
    source.includes('export function computeTrajectoryCache'),
    'trajectoryFrame must export the memo-bypassing computeTrajectoryCache (bake + gate)',
  );
  // The memoized wrapper MUST delegate to the pure compute (one build code path).
  assert.ok(
    source.includes('computeTrajectoryCache(profile, observer, epochUtcMs)')
    && source.includes('memoizedTrajectoryKey')
    && source.includes('memoizedTrajectoryCache'),
    'createTrajectoryCache must memoize over computeTrajectoryCache so memo == fresh by construction',
  );

  const packageJson = JSON.parse(readRepoFile('package.json')) as { scripts?: Record<string, string> };
  assert.equal(
    packageJson.scripts?.['validate:startup:trajectory-memo'],
    VALIDATOR_SCRIPT,
    'package.json must expose validate:startup:trajectory-memo',
  );
  assert.ok(
    packageJson.scripts?.['validate:governance:full']?.includes('validate:startup:trajectory-memo'),
    'trajectory-memo gate must be wired into validate:governance:full',
  );
  pass('memo wrapper + pure compute are a single build path and the gate is wired');
}

const startedAtMs = Date.now();

validateStaticBoundary();

// ---- Determinism: memoized output is byte-identical to a fresh compute ----
const richProfile = loadProfile('hobs-2024-candidate-rich');
const richObserver = observerFor(richProfile);

const fresh = computeTrajectoryCache(richProfile, richObserver, APP_EPOCH_MS);
const memoizedFirst = createTrajectoryCache(richProfile, richObserver, APP_EPOCH_MS);
assert.deepEqual(memoizedFirst, fresh, 'memoized cache must structurally equal a fresh compute');
assert.equal(
  JSON.stringify(memoizedFirst),
  JSON.stringify(fresh),
  'memoized cache must serialize byte-identically to a fresh compute',
);
assert.ok(fresh.length > 0, 'trajectory cache must be non-empty (real config)');
pass(`memoized == fresh compute (${fresh.length} steps, ${getTrajectoryMaxTimeSec(fresh)}s)`);

// ---- Memo is active: a repeat same-key call returns the SAME reference ----
const memoizedSecond = createTrajectoryCache(richProfile, richObserver, APP_EPOCH_MS);
assert.equal(memoizedSecond, memoizedFirst, 'repeat same-key call must hit the memo (same reference)');
assert.notEqual(fresh, memoizedFirst, 'memo-bypassing compute must NOT return the memoized reference');
pass('repeat same-key call hits the memo (reference identity = the real perf win)');

// ---- Key isolation: a different epoch recomputes and does not collide ----
const driftedEpoch = APP_EPOCH_MS + 7_200_000; // +2h: satellites have moved
const driftedFresh = computeTrajectoryCache(richProfile, richObserver, driftedEpoch);
const driftedMemoized = createTrajectoryCache(richProfile, richObserver, driftedEpoch);
assert.equal(
  JSON.stringify(driftedMemoized),
  JSON.stringify(driftedFresh),
  'a different epoch must compute its own (byte-identical to fresh) cache',
);
assert.notEqual(
  JSON.stringify(driftedMemoized),
  JSON.stringify(memoizedFirst),
  'a different epoch must NOT return the stale cache (no key collision)',
);
// Single-entry eviction: re-requesting the original key after a different key must
// recompute data deep-equal to the original (no corruption of the evicted entry).
const richAfterEviction = createTrajectoryCache(richProfile, richObserver, APP_EPOCH_MS);
assert.deepEqual(richAfterEviction, fresh, 're-request after eviction must equal the original fresh compute');
pass('different key recomputes without collision; eviction + re-request stays correct');

// ---- Read-only safety: the shared cache is never mutated by the hot consumer ----
const sharedCache = createTrajectoryCache(richProfile, richObserver, APP_EPOCH_MS);
const beforeJson = JSON.stringify(sharedCache);
const maxTimeSec = getTrajectoryMaxTimeSec(sharedCache);
// Sweep interpolation across the window (looped + clamped) — the path that runs
// every frame in `useSimulation` and the offline index scan.
for (let i = 0; i <= 20; i += 1) {
  const t = (maxTimeSec * i) / 20;
  interpolateVisibleSats(sharedCache, t, true);
  interpolateVisibleSats(sharedCache, t, false);
}
assert.equal(
  JSON.stringify(sharedCache),
  beforeJson,
  'interpolateVisibleSats must not mutate the shared (memoized) trajectory cache',
);
pass('shared memoized cache is read-only across the per-frame interpolation sweep');

// ---- Second topology: determinism + memo hold on a different profile ----
const altProfile = loadProfile(MODQN_4SAT_7BEAM_PAPER_FAITHFUL_PROFILE_ID);
const altObserver = observerFor(altProfile);
const altFresh = computeTrajectoryCache(altProfile, altObserver, APP_EPOCH_MS);
const altMemoized = createTrajectoryCache(altProfile, altObserver, APP_EPOCH_MS);
assert.equal(
  JSON.stringify(altMemoized),
  JSON.stringify(altFresh),
  'second topology: memoized == fresh compute',
);
assert.equal(
  createTrajectoryCache(altProfile, altObserver, APP_EPOCH_MS),
  altMemoized,
  'second topology: repeat call hits the memo',
);
pass('determinism + memo hold on a second topology');

const elapsedMs = Date.now() - startedAtMs;
assert.ok(elapsedMs < 120000, `trajectory-memo gate should remain bounded; took ${elapsedMs}ms`);
console.log(`validate:startup:trajectory-memo passed in ${elapsedMs}ms`);
