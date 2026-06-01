#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_EPOCH_MS, LIVE_SIM_TIMELINE_DURATION_SEC } from '../src/app/appRuntimeConfig.ts';
import { liveWalkerHandoverEventIndexToRailEvents } from '../src/app/liveWalkerHandoverRailAdapter.ts';
import { MODQN_4SAT_7BEAM_PAPER_FAITHFUL_PROFILE_ID, loadProfile } from '../src/profiles/index.ts';
import {
  buildLiveWalkerHandoverEventIndex,
  clampLiveWalkerEventSourceTimeSec,
  createLiveWalkerHandoverEventFromRuntimeEvent,
  LIVE_WALKER_HANDOVER_EVENT_INDEX_DEFAULT_STEP_SEC,
  LIVE_WALKER_HANDOVER_EVENT_INDEX_DURATION_SEC,
  LIVE_WALKER_HANDOVER_EVENT_INDEX_PRIMARY_UE_ID,
  type LiveWalkerHandoverEvent,
  type LiveWalkerHandoverEventIndex,
} from '../src/scene/liveWalkerHandoverEventIndex.ts';
import type { HandoverEvent } from '../src/engine/handover/types.ts';

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const VALIDATOR_SCRIPT = 'node --import tsx/esm scripts/validate-live-walker-handover-event-index-7200.ts';

function readRepoFile(relativePath: string): string {
  return readFileSync(join(ROOT_DIR, relativePath), 'utf8');
}

function pass(label: string): void {
  console.log(`PASS: ${label}`);
}

function assertContains(source: string, needle: string, label: string): void {
  assert.ok(source.includes(needle), `${label} missing ${needle}`);
}

function assertNotContains(source: string, needle: string, label: string): void {
  assert.ok(!source.includes(needle), `${label} unexpectedly contains ${needle}`);
}

function validatePackageScript(): void {
  const packageJson = JSON.parse(readRepoFile('package.json')) as {
    scripts?: Record<string, string>;
  };
  assert.equal(
    packageJson.scripts?.['validate:live-walker:handover-event-index-7200'],
    VALIDATOR_SCRIPT,
    'package.json must expose the live Walker handover event index validator',
  );
  pass('package exposes validate:live-walker:handover-event-index-7200');
}

function validateHelperStaticBoundary(): void {
  const source = readRepoFile('src/scene/liveWalkerHandoverEventIndex.ts');
  const adapterSource = readRepoFile('src/app/liveWalkerHandoverRailAdapter.ts');

  assertContains(source, 'export interface LiveWalkerHandoverEventIndex', 'event index model');
  assertContains(source, 'export function buildLiveWalkerHandoverEventIndex', 'event index helper');
  assertContains(source, 'export function createLiveWalkerHandoverEventFromRuntimeEvent', 'runtime event mapper');
  assertContains(adapterSource, 'export function liveWalkerHandoverEventIndexToRailEvents', 'plain rail adapter');
  assertContains(source, 'createTrajectoryCache', 'event index helper reuses trajectory cache');
  assertContains(source, 'stepRuntimeFrame', 'event index helper reuses runtime frame path');
  assertContains(source, 'new HandoverManager(input.profile.handover)', 'event index helper reuses HandoverManager');
  assertContains(source, "sourceOwner: 'live-walker'", 'event index source owner');
  assertContains(source, "horizonKind: 'live-walker-window'", 'event index horizon kind');
  assertContains(source, "aggregateClaim: 'not-100-ue-aggregate'", 'event index primary UE claim boundary');
  assertNotContains(source, "from 'react'", 'event index helper must stay out of React render path');
  assertNotContains(source, '@react-three', 'event index helper must not import R3F/Three render hooks');
  assertNotContains(source, 'replay-bundle', 'event index helper must not consume MODQN replay bundles');
  assertNotContains(source, 'producerTruth', 'event index helper must not consume producer trace rows');
  assertNotContains(source, 'producer-proof', 'event index helper must not emit producer-proof claims');
  assertNotContains(adapterSource, "from 'react'", 'rail adapter must stay out of React render path');
  assertNotContains(adapterSource, '@react-three', 'rail adapter must not import R3F/Three render hooks');
  assertNotContains(adapterSource, 'stepRuntimeFrame', 'rail adapter must not do runtime stepping');
  assertNotContains(adapterSource, 'HandoverManager', 'rail adapter must not own handover runtime state');
  assertNotContains(adapterSource, 'replay-bundle', 'rail adapter must not consume MODQN replay bundles');
  assertNotContains(adapterSource, 'producerTruth', 'rail adapter must not consume producer trace rows');
  assertNotContains(adapterSource, 'producer-proof', 'rail adapter must not emit producer-proof claims');

  pass('event index helper is a plain live runtime data boundary');
}

function validateIndexMetadata(events: readonly LiveWalkerHandoverEvent[], requireEvents: boolean): void {
  const intraCount = events.filter(event => event.kind === 'intra').length;
  const interCount = events.filter(event => event.kind === 'inter').length;
  if (requireEvents) {
    assert.ok(events.length > 0, 'eventful live Walker fixture should contain handover events');
    assert.ok(intraCount > 0, 'eventful live Walker fixture should exercise intra events');
    assert.ok(interCount > 0, 'eventful live Walker fixture should exercise inter events');
  }
  pass(`event index has ${events.length} primary-UE events (${intraCount} intra, ${interCount} inter)`);
}

function validateEventOrderingAndBounds(events: readonly LiveWalkerHandoverEvent[]): void {
  const ids = new Set<string>();
  let previousTimeSec = -Infinity;

  for (const event of events) {
    assert.ok(!ids.has(event.id), `duplicate event id ${event.id}`);
    ids.add(event.id);
    assert.ok(
      event.sourceTimeSec >= previousTimeSec,
      `events must be source-time sorted: ${event.id}`,
    );
    previousTimeSec = event.sourceTimeSec;
    assert.ok(Number.isFinite(event.sourceTimeSec), `sourceTimeSec must be finite for ${event.id}`);
    assert.ok(event.sourceTimeSec >= 0, `sourceTimeSec must be >=0 for ${event.id}`);
    assert.ok(
      event.sourceTimeSec <= LIVE_WALKER_HANDOVER_EVENT_INDEX_DURATION_SEC,
      `sourceTimeSec must be within 7200s for ${event.id}`,
    );
    assert.equal(
      event.clickTargetSec,
      clampLiveWalkerEventSourceTimeSec(event.sourceTimeSec),
      `click target must clamp to source time for ${event.id}`,
    );
    assert.equal(event.clickTargetSec, event.sourceTimeSec, `click target must equal source time for ${event.id}`);
    assert.ok(event.sourceStartSec >= 0, `source focus start must be clamped for ${event.id}`);
    assert.ok(
      event.sourceEndSec <= LIVE_WALKER_HANDOVER_EVENT_INDEX_DURATION_SEC,
      `source focus end must be clamped for ${event.id}`,
    );
    assert.equal(event.primaryUeId, LIVE_WALKER_HANDOVER_EVENT_INDEX_PRIMARY_UE_ID, 'event must be primary UE scoped');
    assert.equal(event.count, 1, 'primary UE event rows must not claim aggregate counts');
  }

  pass('event ordering, bounds, and source-time click targets are valid');
}

function validateEventKinds(events: readonly LiveWalkerHandoverEvent[]): void {
  for (const event of events) {
    if (event.kind === 'intra') {
      assert.equal(event.fromSatId, event.toSatId, `intra event must stay on one satellite: ${event.id}`);
      assert.notEqual(event.fromBeamId, event.toBeamId, `intra event must change beam: ${event.id}`);
    } else {
      assert.notEqual(event.fromSatId, event.toSatId, `inter event must change satellite: ${event.id}`);
    }
  }
  pass('intra/inter event semantics are structurally valid');
}

function validateRuntimeEventMapper(): void {
  const intraRuntimeEvent: HandoverEvent = {
    timeMs: APP_EPOCH_MS + 12_000,
    action: 'intra-switch',
    fromSatId: 'sat-a',
    fromBeamId: 1,
    fromSinrDb: 4,
    toSatId: 'sat-a',
    toBeamId: 2,
    toSinrDb: 6,
    deltaDb: 2,
  };
  const interRuntimeEvent: HandoverEvent = {
    timeMs: APP_EPOCH_MS + 24_000,
    action: 'inter-handover',
    fromSatId: 'sat-a',
    fromBeamId: 2,
    fromSinrDb: 3,
    toSatId: 'sat-b',
    toBeamId: 1,
    toSinrDb: 7,
    deltaDb: 4,
  };
  const initialAttachRuntimeEvent: HandoverEvent = {
    timeMs: APP_EPOCH_MS,
    action: 'inter-handover',
    fromSatId: null,
    fromBeamId: null,
    fromSinrDb: null,
    toSatId: 'sat-a',
    toBeamId: 1,
    toSinrDb: 8,
    deltaDb: null,
  };

  const intra = createLiveWalkerHandoverEventFromRuntimeEvent(intraRuntimeEvent, APP_EPOCH_MS, 0);
  const inter = createLiveWalkerHandoverEventFromRuntimeEvent(interRuntimeEvent, APP_EPOCH_MS, 1);
  const initialAttach = createLiveWalkerHandoverEventFromRuntimeEvent(
    initialAttachRuntimeEvent,
    APP_EPOCH_MS,
    2,
  );

  assert.ok(intra, 'runtime mapper must keep valid intra events');
  assert.ok(inter, 'runtime mapper must keep valid inter events');
  assert.equal(initialAttach, null, 'runtime mapper must not turn initial attach into a handover event');
  validateEventKinds([intra, inter]);
  assert.equal(intra.clickTargetSec, intra.sourceTimeSec, 'fixture intra click target uses source time');
  assert.equal(inter.clickTargetSec, inter.sourceTimeSec, 'fixture inter click target uses source time');
  pass('runtime event mapper rejects attaches and preserves intra/inter semantics');
}

function validateRailAdapter(index: LiveWalkerHandoverEventIndex): void {
  const railEvents = liveWalkerHandoverEventIndexToRailEvents(index);
  assert.equal(railEvents.length, index.events.length, 'rail adapter must not synthesize or drop source-backed live events');

  for (let i = 0; i < index.events.length; i += 1) {
    const sourceEvent = index.events[i];
    const railEvent = railEvents[i];
    assert.ok(sourceEvent, `source event ${i} missing`);
    assert.ok(railEvent, `rail event ${i} missing`);
    assert.equal(railEvent.id, sourceEvent.id, 'rail event id must preserve source event id');
    assert.equal(railEvent.source, 'live-walker', 'rail event source must be live-walker');
    assert.equal(railEvent.timeSec, sourceEvent.sourceTimeSec, 'rail source time must come from sourceTimeSec');
    assert.equal(railEvent.sourceTimeSec, sourceEvent.sourceTimeSec, 'rail sourceTimeSec must be explicit');
    assert.equal(railEvent.clickTargetSec, sourceEvent.clickTargetSec, 'rail click target must use clickTargetSec');
    assert.equal(railEvent.clickTargetSec, sourceEvent.sourceTimeSec, 'rail click target must seek source time, not display axis');
    assert.equal(railEvent.count, 1, 'rail adapter must preserve primary-UE row count only');
    assert.ok(railEvent.detail?.includes('primary-ue-only'), 'rail event detail must preserve primary UE scope');
    assert.ok(railEvent.detail?.includes('not-100-ue-aggregate'), 'rail event detail must preserve non-aggregate claim');
  }

  const emptyRailEvents = liveWalkerHandoverEventIndexToRailEvents({ ...index, events: [] });
  assert.equal(emptyRailEvents.length, 0, 'rail adapter must keep a source-backed empty index empty');
  pass('rail adapter preserves source time, click targets, and primary-UE-only semantics');
}

validatePackageScript();
validateHelperStaticBoundary();

assert.equal(
  LIVE_WALKER_HANDOVER_EVENT_INDEX_DURATION_SEC,
  LIVE_SIM_TIMELINE_DURATION_SEC,
  'event index duration must share the validated 7200s live-sim horizon',
);
assert.equal(
  LIVE_WALKER_HANDOVER_EVENT_INDEX_DEFAULT_STEP_SEC,
  1,
  'default event-index step should be 1s for deterministic first-slice validation',
);

const profile = loadProfile(MODQN_4SAT_7BEAM_PAPER_FAITHFUL_PROFILE_ID);
const startedAtMs = Date.now();
const index = buildLiveWalkerHandoverEventIndex({
  profile,
  epochUtcMs: APP_EPOCH_MS,
  claimKind: 'overlay-demo',
});
const elapsedMs = Date.now() - startedAtMs;

assert.ok(elapsedMs < 30000, `event index generation should remain bounded; took ${elapsedMs}ms`);
assert.equal(index.sourceOwner, 'live-walker', 'source owner must be live-walker');
assert.equal(index.horizonKind, 'live-walker-window', 'horizon kind must be live-walker-window');
assert.equal(index.claimKind, 'overlay-demo', 'live preview claim must be overlay-demo, not producer-proof');
assert.equal(index.durationSec, 7200, 'duration must be exactly 7200s');
assert.equal(index.generation.profileId, MODQN_4SAT_7BEAM_PAPER_FAITHFUL_PROFILE_ID, 'profile id must match MODQN Walker profile');
assert.equal(index.generation.epochUtcMs, APP_EPOCH_MS, 'event index epoch must match app runtime epoch');
assert.equal(index.generation.simStepSec, 1, 'event index generation step must be 1s');
assert.equal(index.generation.runtimeFramePath, 'stepRuntimeFrame', 'event index must come from runtime frame path');
assert.ok(index.generation.handoverPolicyKey.includes('policy=sinr-offset'), 'handover policy key must be source-derived');
assert.ok(index.generation.topologyKey.includes('ueScope=primary-ue-only'), 'topology key must state primary UE scope');
assert.equal(index.ueScope, 'primary-ue-only', 'first event index slice is primary UE only');
assert.equal(index.primaryUeId, LIVE_WALKER_HANDOVER_EVENT_INDEX_PRIMARY_UE_ID, 'primary UE id must be stable');
assert.equal(index.aggregateUeCount, 1, 'first event index slice must not claim 100-UE aggregation');
assert.equal(index.aggregateClaim, 'not-100-ue-aggregate', 'index must explicitly reject aggregate semantics');
assert.deepEqual(index.sourceGapReasons, [], 'validated live Walker index should not report source gaps');

validateIndexMetadata(index.events, false);
validateEventOrderingAndBounds(index.events);
validateEventKinds(index.events);
validateRuntimeEventMapper();
validateRailAdapter(index);

const secondIndex = buildLiveWalkerHandoverEventIndex({
  profile,
  epochUtcMs: APP_EPOCH_MS,
  claimKind: 'overlay-demo',
});
assert.deepEqual(secondIndex, index, 'event index helper must be deterministic for identical inputs');
pass('event index output is deterministic for identical inputs');

const eventfulProfile = loadProfile('hobs-2024-candidate-rich');
const eventfulIndex = buildLiveWalkerHandoverEventIndex({
  profile: eventfulProfile,
  epochUtcMs: APP_EPOCH_MS,
  claimKind: 'profile-derived-forecast',
  uePrimaryAnchorMode: 'observer',
});
assert.equal(eventfulIndex.sourceOwner, 'live-walker', 'eventful fixture source owner must be live-walker');
assert.equal(eventfulIndex.horizonKind, 'live-walker-window', 'eventful fixture horizon must be live-walker-window');
assert.equal(eventfulIndex.claimKind, 'profile-derived-forecast', 'eventful fixture is profile-derived forecast');
assert.equal(eventfulIndex.durationSec, 7200, 'eventful fixture duration must be exactly 7200s');
assert.equal(eventfulIndex.ueScope, 'primary-ue-only', 'eventful fixture must remain primary UE scoped');
validateIndexMetadata(eventfulIndex.events, true);
validateEventOrderingAndBounds(eventfulIndex.events);
validateEventKinds(eventfulIndex.events);
validateRailAdapter(eventfulIndex);

pass(`event index generation completed in ${elapsedMs}ms`);

console.log('validate:live-walker:handover-event-index-7200 passed');
