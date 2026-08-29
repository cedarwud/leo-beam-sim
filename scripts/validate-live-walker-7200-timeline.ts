#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_EPOCH_MS, LIVE_SIM_TIMELINE_DURATION_SEC } from '../src/app/appRuntimeConfig.ts';
import {
  clampTimelineTime,
  resolveTimelineRailDescriptor,
} from '../src/app/timelineRailAuthority.ts';
import { HandoverManager } from '../src/engine/handover/handover-manager.ts';
import {
  computeTopocentricPoint,
  createObserverContext,
  generateWalkerConstellation,
  propagateOrbitElement,
} from '../src/engine/orbit/index.ts';
import { MODQN_4SAT_7BEAM_PAPER_FAITHFUL_PROFILE_ID, loadProfile } from '../src/profiles/index.ts';
import {
  SIM_DURATION_SEC,
  SIM_STEP_SEC,
  createBeamLayoutsByShellId,
  createRuntimeFrameStepState,
  createTrajectoryCache,
  getTrajectoryMaxTimeSec,
  stepRuntimeFrame,
} from '../src/scene/runtimeFrameStep.ts';

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const TWO_HOUR_TIMELINE_SEC = 7200;
const EXPECTED_MODQN_POOL_SIZE = 384;
const MIN_FORMAL_SERVING_CANDIDATES = 8;
const SERVING_ELEVATION_DEG = 15;
const CACHE_ELEVATION_DEG = 10;
const VALIDATOR_SCRIPT = 'node --import tsx/esm scripts/validate-live-walker-7200-timeline.ts';

function readRepoFile(relativePath: string): string {
  return readFileSync(join(ROOT_DIR, relativePath), 'utf8');
}

function pass(label: string): void {
  console.log(`PASS: ${label}`);
}

function validatePackageScript(): void {
  const packageJson = JSON.parse(readRepoFile('package.json')) as {
    scripts?: Record<string, string>;
  };
  assert.equal(
    packageJson.scripts?.['validate:live-walker:7200-timeline'],
    VALIDATOR_SCRIPT,
    'package.json must expose the committed 7200s live Walker validator',
  );
  pass('package exposes validate:live-walker:7200-timeline');
}

function validateRuntimeWindowAndCache(): ReturnType<typeof createTrajectoryCache> {
  const profile = loadProfile(MODQN_4SAT_7BEAM_PAPER_FAITHFUL_PROFILE_ID);
  const observer = createObserverContext(profile.orbit.observerLatDeg, profile.orbit.observerLonDeg);
  const trajectoryCache = createTrajectoryCache(profile, observer, APP_EPOCH_MS);
  const maxTimeSec = getTrajectoryMaxTimeSec(trajectoryCache);

  assert.equal(LIVE_SIM_TIMELINE_DURATION_SEC, TWO_HOUR_TIMELINE_SEC, 'live-sim timeline duration is 7200s');
  assert.equal(SIM_DURATION_SEC, TWO_HOUR_TIMELINE_SEC, 'runtime trajectory cache duration is 7200s');
  assert.equal(maxTimeSec, TWO_HOUR_TIMELINE_SEC, 'trajectory cache reaches the 7200s live window end');
  assert.equal(
    trajectoryCache.length,
    Math.ceil(TWO_HOUR_TIMELINE_SEC / SIM_STEP_SEC) + 1,
    'trajectory cache has one entry per SIM_STEP_SEC through 7200s',
  );

  const appRuntimeConfigSource = readRepoFile('src/app/appRuntimeConfig.ts');
  assert.ok(
    appRuntimeConfigSource.includes('windowLengthSec: LIVE_SIM_TIMELINE_DURATION_SEC'),
    'app runtime config uses the validated live timeline constant for replay.windowLengthSec',
  );

  const minCacheVisible = Math.min(...trajectoryCache.map(step => step.length));
  assert.ok(
    minCacheVisible >= MIN_FORMAL_SERVING_CANDIDATES,
    `trajectory cache keeps at least L=8 candidates at >=${CACHE_ELEVATION_DEG}deg elevation`,
  );

  pass(`runtime cache spans ${maxTimeSec}s with min cached visible satellites ${minCacheVisible}`);
  return trajectoryCache;
}

function validateOneSecondServingCoverage(): void {
  const profile = loadProfile(MODQN_4SAT_7BEAM_PAPER_FAITHFUL_PROFILE_ID);
  const observer = createObserverContext(profile.orbit.observerLatDeg, profile.orbit.observerLonDeg);
  const elements = generateWalkerConstellation({
    shells: profile.orbit.shells,
    epochUtcMs: APP_EPOCH_MS,
    observerLatDeg: observer.latDeg,
    observerLonDeg: observer.lonDeg,
    phaseSeed: profile.orbit.constellationSeed,
  });
  assert.equal(elements.length, EXPECTED_MODQN_POOL_SIZE, 'MODQN Walker pool remains P=384');

  let minServingVisible = Infinity;
  let minCacheVisible = Infinity;
  let minServingTimeSec = 0;
  let minCacheTimeSec = 0;

  for (let tSec = 0; tSec <= TWO_HOUR_TIMELINE_SEC; tSec += 1) {
    const atUtcMs = APP_EPOCH_MS + tSec * 1000;
    let servingVisible = 0;
    let cacheVisible = 0;

    for (const element of elements) {
      const orbitPoint = propagateOrbitElement(element, atUtcMs);
      const topo = computeTopocentricPoint(observer, orbitPoint.ecefKm);
      if (topo.elevationDeg >= CACHE_ELEVATION_DEG) cacheVisible += 1;
      if (topo.elevationDeg >= SERVING_ELEVATION_DEG) servingVisible += 1;
    }

    if (servingVisible < minServingVisible) {
      minServingVisible = servingVisible;
      minServingTimeSec = tSec;
    }
    if (cacheVisible < minCacheVisible) {
      minCacheVisible = cacheVisible;
      minCacheTimeSec = tSec;
    }
  }

  assert.ok(
    minServingVisible >= MIN_FORMAL_SERVING_CANDIDATES,
    `P=384 must provide at least L=8 serving candidates at >=${SERVING_ELEVATION_DEG}deg for the whole 7200s window`,
  );
  assert.ok(
    minCacheVisible >= MIN_FORMAL_SERVING_CANDIDATES,
    `P=384 must provide at least L=8 cached candidates at >=${CACHE_ELEVATION_DEG}deg for the whole 7200s window`,
  );

  pass(
    `1s coverage scan min serving=${minServingVisible} at ${minServingTimeSec}s, `
    + `min cache=${minCacheVisible} at ${minCacheTimeSec}s`,
  );
}

function validateEndOfWindowFrame(trajectoryCache: ReturnType<typeof createTrajectoryCache>): void {
  const profile = loadProfile(MODQN_4SAT_7BEAM_PAPER_FAITHFUL_PROFILE_ID);
  const observer = createObserverContext(profile.orbit.observerLatDeg, profile.orbit.observerLonDeg);
  const sampleTimeSec = TWO_HOUR_TIMELINE_SEC - 1;
  const output = stepRuntimeFrame({
    profile,
    replay: {
      epochUtcMs: APP_EPOCH_MS,
      startOffsetSec: 0,
      loop: true,
      windowLengthSec: LIVE_SIM_TIMELINE_DURATION_SEC,
    },
    speed: 1,
    paused: true,
    deltaSec: 0,
    observer,
    beamLayoutsByShellId: createBeamLayoutsByShellId(profile),
    trajectoryCache,
    hoManager: new HandoverManager(profile.handover),
    state: createRuntimeFrameStepState(sampleTimeSec),
    ueCount: 100,
    ueDistributionMode: 'random',
    uePrimaryAnchorMode: 'distribution',
    ueDistributionScope: 'service-area',
    ueMobilityMode: 'static',
  });

  assert.equal(output.frame.simTimeSec, sampleTimeSec, 'end-of-window frame preserves the requested sim time');
  assert.ok(
    output.frame.satellites.length >= MIN_FORMAL_SERVING_CANDIDATES,
    'end-of-window frame has enough visible satellites for L=8 display/runtime selection',
  );
  assert.equal(output.frame.perUePositions.length, 100, 'end-of-window frame keeps the MODQN 100-UE baseline');
  pass(`end-of-window runtime frame renders ${output.frame.satellites.length} visible satellites`);
}

function validateTimelineAuthority(): void {
  const baseInput = {
    sceneSource: 'live-sim' as const,
    liveDurationSec: LIVE_SIM_TIMELINE_DURATION_SEC,
    liveCurrentTimeSec: 7199,
    artifactDurationSec: 300,
    artifactCurrentTimeSec: 7,
    artifactHandoverEventCount: 0,
    producerTraceRange: {
      startSec: 1,
      endSec: 10,
      durationSec: 10,
      rangeLabel: '1s-10s',
    },
    producerTraceCurrentTimeSec: 1,
    producerTraceDisplayDurationSec: 60,
    producerTraceDisplayCurrentTimeSec: 18,
    bundleProvenanceKind: 'paper-faithful' as const,
  };

  const livePreview = resolveTimelineRailDescriptor({
    ...baseInput,
    sceneLane: 'modqn-live-cell-preview',
  });
  assert.equal(livePreview.timeline.sourceOwner, 'live-walker', 'MODQN live preview timeline is live Walker-owned');
  assert.equal(livePreview.timeline.durationSec, TWO_HOUR_TIMELINE_SEC, 'MODQN live preview timeline uses 7200s duration');
  assert.equal(livePreview.timeline.horizonSec, TWO_HOUR_TIMELINE_SEC, 'MODQN live preview horizon is 7200s');
  assert.equal(livePreview.timeline.claimKind, 'overlay-demo', 'MODQN live preview remains an overlay/demo claim');
  assert.ok(livePreview.timeline.horizonLabel.includes('2 h'), 'live Walker horizon label may now show 2 h');
  assert.equal(livePreview.rail.sourceOwner, 'live-walker', 'MODQN live preview rail uses the live Walker event index');
  assert.equal(livePreview.rail.durationSec, TWO_HOUR_TIMELINE_SEC, 'MODQN live preview rail uses the validated 7200s live Walker window');
  assert.equal(livePreview.rail.claimKind, 'overlay-demo', 'MODQN live preview rail remains overlay/demo, not producer proof');

  const sinrLive = resolveTimelineRailDescriptor({
    ...baseInput,
    sceneLane: 'sinr-live',
  });
  assert.equal(sinrLive.rail.sourceOwner, 'sinr-live-cell-truth', 'SINR live rail is owned by the sinr-live cell-truth event index');
  assert.equal(sinrLive.rail.durationSec, TWO_HOUR_TIMELINE_SEC, 'SINR live rail uses the validated 7200s live Walker window');
  assert.equal(sinrLive.rail.claimKind, 'live-truth', 'SINR live rail carries the shipped live-truth cell claim');

  const proof = resolveTimelineRailDescriptor({
    ...baseInput,
    sceneLane: 'modqn-replay-proof',
  });
  assert.equal(proof.timeline.sourceOwner, 'modqn-producer-trace', 'MODQN replay proof timeline remains producer-owned');
  assert.equal(proof.timeline.durationSec, 10, 'MODQN replay proof does not inherit the 7200s live Walker window');
  assert.equal(proof.timeline.claimKind, 'producer-proof', 'MODQN replay proof remains producer proof');
  assert.notEqual(proof.timeline.durationSec, LIVE_SIM_TIMELINE_DURATION_SEC, 'producer proof is not fake 2h history');
  assert.equal(clampTimelineTime(7201, LIVE_SIM_TIMELINE_DURATION_SEC), TWO_HOUR_TIMELINE_SEC, 'live timeline seek clamps at 7200s');

  pass('timeline authority separates 2h live Walker overlay from 10s producer proof');
}

validatePackageScript();
const trajectoryCache = validateRuntimeWindowAndCache();
validateOneSecondServingCoverage();
validateEndOfWindowFrame(trajectoryCache);
validateTimelineAuthority();
