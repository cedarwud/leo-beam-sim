#!/usr/bin/env node

// Truth golden (Rule#2/#6): the INCREMENTAL cell-truth handover scan that the App
// drives across requestIdleCallback slices must be byte-identical to the one-shot
// build, regardless of slice size. The App moved the ~8 s/100-UE scan off the
// first-paint critical path by slicing it; this gate proves the slicing changed
// only WHEN the work runs, never WHAT it produces.
//
// Run: node --import tsx/esm scripts/validate-sinr-live-cell-handover-index-chunked-golden.ts

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_EPOCH_MS } from '../src/app/appRuntimeConfig.ts';
import { DEFAULT_UE_MOBILITY_PARAMS } from '../src/engine/ue/multiUeMobility.ts';
import { MODQN_4SAT_7BEAM_PAPER_FAITHFUL_PROFILE_ID, loadProfile } from '../src/profiles/index.ts';
import {
  buildSinrLiveCellHandoverEventIndex,
  createSinrLiveCellHandoverEventIndexBuilder,
  type BuildSinrLiveCellHandoverEventIndexInput,
} from '../src/scene/sinrLiveCellHandoverEventIndex.ts';
import {
  LIVE_WALKER_HANDOVER_EVENT_INDEX_DURATION_SEC,
  type LiveWalkerHandoverEventIndex,
} from '../src/scene/liveWalkerHandoverEventIndex.ts';

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const VALIDATOR_SCRIPT = 'node --import tsx/esm scripts/validate-sinr-live-cell-handover-index-chunked-golden.ts';

function readRepoFile(relativePath: string): string {
  return readFileSync(join(ROOT_DIR, relativePath), 'utf8');
}

function pass(label: string): void {
  console.log(`PASS: ${label}`);
}

// Drive the resumable builder to completion at a fixed slice size, then finalize.
function buildChunked(
  input: BuildSinrLiveCellHandoverEventIndexInput,
  maxStepsPerSlice: number,
): { index: LiveWalkerHandoverEventIndex; slices: number; totalSteps: number } {
  const builder = createSinrLiveCellHandoverEventIndexBuilder(input);
  let slices = 0;
  let done = false;
  // Hard cap well above the real step count (240 at simStepSec=30) so a slicing
  // bug that fails to advance can't spin forever.
  const sliceCeiling = LIVE_WALKER_HANDOVER_EVENT_INDEX_DURATION_SEC + 10;
  while (!done) {
    done = builder.runSlice(maxStepsPerSlice);
    slices += 1;
    assert.ok(slices < sliceCeiling, 'chunked builder failed to make progress (possible non-advancing slice)');
  }
  return { index: builder.finalize(), slices, totalSteps: builder.totalSteps };
}

function assertIndexIdentical(
  actual: LiveWalkerHandoverEventIndex,
  expected: LiveWalkerHandoverEventIndex,
  label: string,
): void {
  assert.deepEqual(actual, expected, `${label}: chunked index must structurally equal the one-shot build`);
  assert.equal(
    JSON.stringify(actual),
    JSON.stringify(expected),
    `${label}: chunked index must serialize byte-identically to the one-shot build`,
  );
}

// ---- Static boundary: the builder + one-shot wrapper are the single code path ----
function validateStaticBoundary(): void {
  const source = readRepoFile('src/scene/sinrLiveCellHandoverEventIndex.ts');
  assert.ok(
    source.includes('export function createSinrLiveCellHandoverEventIndexBuilder'),
    'index module must export the resumable builder factory',
  );
  assert.ok(
    source.includes('export function buildSinrLiveCellHandoverEventIndex'),
    'index module must keep the one-shot entry point',
  );
  // The one-shot MUST be the builder drained in a single slice (one code path).
  assert.ok(
    source.includes('createSinrLiveCellHandoverEventIndexBuilder(input)')
    && source.includes('builder.runSlice(Number.POSITIVE_INFINITY)')
    && source.includes('builder.finalize()'),
    'one-shot build must delegate to the builder so chunked == one-shot by construction',
  );

  const packageJson = JSON.parse(readRepoFile('package.json')) as { scripts?: Record<string, string> };
  assert.equal(
    packageJson.scripts?.['validate:sinr-live:handover-index-chunked-golden'],
    VALIDATOR_SCRIPT,
    'package.json must expose validate:sinr-live:handover-index-chunked-golden',
  );
  assert.ok(
    packageJson.scripts?.['validate:governance:full']?.includes('validate:sinr-live:handover-index-chunked-golden'),
    'chunked-golden must be wired into validate:governance:full',
  );
  pass('builder/one-shot are a single code path and the golden is gate-wired');
}

// ---- Builder mechanics: progress + no-partial-truth ----
function validateBuilderMechanics(input: BuildSinrLiveCellHandoverEventIndexInput): void {
  const builder = createSinrLiveCellHandoverEventIndexBuilder(input);
  assert.equal(builder.totalSteps, Math.ceil(LIVE_WALKER_HANDOVER_EVENT_INDEX_DURATION_SEC / 30), 'totalSteps = ceil(duration/step)');
  assert.equal(builder.stepsCompleted(), 0, 'no steps run before the first slice');
  assert.equal(builder.isDone(), false, 'non-terminal builder is not done at construction');
  assert.throws(() => builder.finalize(), /before the scan completed/, 'finalize must refuse partial truth');

  builder.runSlice(1);
  assert.equal(builder.stepsCompleted(), 1, 'one slice of one step advances exactly one step');
  assert.equal(builder.isDone(), false, 'one step does not complete the 240-step scan');

  while (!builder.runSlice(16)) { /* drain */ }
  assert.equal(builder.isDone(), true, 'builder reaches done after draining');
  assert.equal(builder.stepsCompleted(), builder.totalSteps, 'completed steps reach the planned total');
  assert.doesNotThrow(() => builder.finalize(), 'finalize is valid once done');
  pass('builder reports progress and refuses to finalize partial truth');
}

const startedAtMs = Date.now();

validateStaticBoundary();

// ---- Primary invariance proof on the REAL sinr-live config (candidate-rich, 100 UEs) ----
const realInput: BuildSinrLiveCellHandoverEventIndexInput = {
  profile: loadProfile('hobs-2024-candidate-rich'),
  epochUtcMs: APP_EPOCH_MS,
  simStepSec: 30,
  ueCount: 100,
  ueDistributionMode: 'random',
  uePrimaryAnchorMode: 'observer',
  ueDistributionScope: 'beam-footprint',
  ueDistributionRadiusKm: undefined,
  ueMobilityMode: 'static',
  ueMobilityParams: DEFAULT_UE_MOBILITY_PARAMS,
};

validateBuilderMechanics(realInput);

const oneShot = buildSinrLiveCellHandoverEventIndex(realInput);
// The scan must produce a non-trivial event stream (so slice-invariance is a real
// test, not a vacuous one over an empty array). Which KINDS appear is data-driven
// — candidate-rich at these params yields inter without intra — so we don't pin
// the kind mix here; the invariance proof below is kind-agnostic.
const intraCount = oneShot.events.filter(e => e.kind === 'intra').length;
const interCount = oneShot.events.filter(e => e.kind === 'inter').length;
assert.ok(oneShot.events.length > 0, 'real sinr-live config must produce handover events');
assert.equal(intraCount + interCount, oneShot.events.length, 'every event is intra or inter');
pass(`one-shot build = ${oneShot.events.length} events (${intraCount} intra, ${interCount} inter)`);

// Slice size = 1 (extreme: yield after every single sim step) must equal one-shot.
const chunked1 = buildChunked(realInput, 1);
assert.equal(chunked1.slices, chunked1.totalSteps, 'slice=1 should take one slice per step');
assertIndexIdentical(chunked1.index, oneShot, 'slice=1');
pass(`slice=1 (${chunked1.slices} slices) == one-shot`);

// Slice size = 7 (mid: a few steps per idle deadline) must equal one-shot.
const chunked7 = buildChunked(realInput, 7);
assertIndexIdentical(chunked7.index, oneShot, 'slice=7');
pass(`slice=7 (${chunked7.slices} slices) == one-shot`);

// ---- Determinism + a second topology (cheap, low UE count) ----
const altInput: BuildSinrLiveCellHandoverEventIndexInput = {
  profile: loadProfile(MODQN_4SAT_7BEAM_PAPER_FAITHFUL_PROFILE_ID),
  epochUtcMs: APP_EPOCH_MS,
  simStepSec: 30,
  ueCount: 6,
  ueDistributionMode: 'random',
  uePrimaryAnchorMode: 'observer',
  ueDistributionScope: 'beam-footprint',
  ueMobilityMode: 'static',
  ueMobilityParams: DEFAULT_UE_MOBILITY_PARAMS,
};
const altOneShotA = buildSinrLiveCellHandoverEventIndex(altInput);
const altOneShotB = buildSinrLiveCellHandoverEventIndex(altInput);
assertIndexIdentical(altOneShotB, altOneShotA, 'determinism (one-shot x2)');
assertIndexIdentical(buildChunked(altInput, 1).index, altOneShotA, 'second-topology slice=1');
assertIndexIdentical(buildChunked(altInput, 3).index, altOneShotA, 'second-topology slice=3');
pass('one-shot is deterministic and chunked == one-shot on a second topology');

const elapsedMs = Date.now() - startedAtMs;
assert.ok(elapsedMs < 120000, `chunked golden should remain bounded; took ${elapsedMs}ms`);
console.log(`validate:sinr-live:handover-index-chunked-golden passed in ${elapsedMs}ms`);
