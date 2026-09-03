import assert from 'node:assert/strict';

import {
  createHomepagePlaybackTransportState,
  deriveHomepagePlaybackTransportState,
  reduceHomepagePlaybackTransport,
  type HomepagePlaybackSpeedResolver,
  type HomepagePlaybackTransportSpeedContext,
} from './playbackTransport';

const ordinaryPlayback: HomepagePlaybackTransportSpeedContext = {
  directorSlowActive: false,
  candidateComparisonSlowActive: false,
  autoSlowApplied: false,
};

const candidateComparisonPlayback: HomepagePlaybackTransportSpeedContext = {
  directorSlowActive: false,
  candidateComparisonSlowActive: true,
  autoSlowApplied: true,
};

const defaultState = createHomepagePlaybackTransportState({}, ordinaryPlayback);
assert.deepEqual(defaultState, {
  paused: false,
  selectedSpeed: 1,
  effectiveSpeed: 1,
});

const selectedTenDuringComparison = reduceHomepagePlaybackTransport(
  defaultState,
  { type: 'set-speed', speed: 10 },
  candidateComparisonPlayback,
);
assert.equal(selectedTenDuringComparison.state.selectedSpeed, 10);
assert.equal(
  selectedTenDuringComparison.state.effectiveSpeed,
  0.5,
  'the existing HO comparison cap remains the effective simulation speed',
);
assert.equal(selectedTenDuringComparison.seekTargetSec, null);

const ordinaryTen = deriveHomepagePlaybackTransportState(
  { paused: false, selectedSpeed: 10 },
  ordinaryPlayback,
);
assert.equal(ordinaryTen.selectedSpeed, 10);
assert.equal(
  ordinaryTen.effectiveSpeed,
  10,
  'a selected accelerated preset remains effective outside presentation slow-mo',
);

const pausedAccelerated = reduceHomepagePlaybackTransport(
  ordinaryTen,
  { type: 'pause' },
  ordinaryPlayback,
);
assert.deepEqual(
  pausedAccelerated.state,
  {
    paused: true,
    selectedSpeed: 10,
    effectiveSpeed: 10,
  },
  'pause gates runtime advancement without overwriting the selected or effective rate',
);

const resumedAcceleratedDuringComparison = reduceHomepagePlaybackTransport(
  pausedAccelerated.state,
  { type: 'play' },
  candidateComparisonPlayback,
);
assert.deepEqual(
  resumedAcceleratedDuringComparison.state,
  {
    paused: false,
    selectedSpeed: 10,
    effectiveSpeed: 0.5,
  },
  'resume keeps the selected preset while re-deriving the active comparison cap',
);

const selectedTwentyDuringAutoSlow = deriveHomepagePlaybackTransportState(
  { paused: false, selectedSpeed: 20 },
  {
    directorSlowActive: false,
    candidateComparisonSlowActive: false,
    autoSlowApplied: true,
  },
);
assert.equal(selectedTwentyDuringAutoSlow.selectedSpeed, 20);
assert.equal(
  selectedTwentyDuringAutoSlow.effectiveSpeed,
  0.5,
  'visible handover auto-slow can cap the consumed rate even without comparison focus',
);

const directorFocus = deriveHomepagePlaybackTransportState(
  { paused: false, selectedSpeed: 20 },
  {
    directorSlowActive: true,
    candidateComparisonSlowActive: true,
    autoSlowApplied: true,
  },
);
assert.equal(directorFocus.selectedSpeed, 20);
assert.equal(directorFocus.effectiveSpeed, 0.25);

const directorOnly = deriveHomepagePlaybackTransportState(
  { paused: false, selectedSpeed: 20 },
  {
    directorSlowActive: true,
    candidateComparisonSlowActive: false,
    autoSlowApplied: false,
  },
);
assert.equal(
  directorOnly.effectiveSpeed,
  0.25,
  'director focus owns its cinema cap even when the ordinary auto-slow signals are absent',
);

const comparisonReleased = deriveHomepagePlaybackTransportState(
  selectedTenDuringComparison.state,
  ordinaryPlayback,
);
assert.equal(comparisonReleased.selectedSpeed, 10);
assert.equal(
  comparisonReleased.effectiveSpeed,
  10,
  'clearing presentation slow-mo restores the selected rate; the cap is not latched',
);

const paused = reduceHomepagePlaybackTransport(
  defaultState,
  { type: 'pause' },
  ordinaryPlayback,
);
assert.equal(paused.state.paused, true);
assert.equal(paused.state.effectiveSpeed, 1);

const pausedDuringComparison = reduceHomepagePlaybackTransport(
  defaultState,
  { type: 'pause' },
  candidateComparisonPlayback,
);
assert.equal(pausedDuringComparison.state.paused, true);
assert.equal(pausedDuringComparison.state.selectedSpeed, 1);
assert.equal(
  pausedDuringComparison.state.effectiveSpeed,
  0.5,
  'paused is separate from effective rate; resuming will still use the current cap',
);

const played = reduceHomepagePlaybackTransport(
  paused.state,
  { type: 'play' },
  ordinaryPlayback,
);
assert.equal(played.state.paused, false);

const toggled = reduceHomepagePlaybackTransport(
  played.state,
  { type: 'toggle' },
  ordinaryPlayback,
);
assert.equal(toggled.state.paused, true);

const seek = reduceHomepagePlaybackTransport(
  defaultState,
  { type: 'seek', targetSec: 123.456 },
  ordinaryPlayback,
);
assert.equal(seek.seekTargetSec, 123.456);
assert.deepEqual(
  seek.state,
  defaultState,
  'seek does not create a second simulation clock or mutate transport time',
);

const resolverInputs: unknown[] = [];
const injectedResolver: HomepagePlaybackSpeedResolver = input => {
  resolverInputs.push(input);
  return 7;
};
const injected = deriveHomepagePlaybackTransportState(
  { paused: true, selectedSpeed: 10 },
  candidateComparisonPlayback,
  injectedResolver,
);
assert.equal(injected.effectiveSpeed, 7);
assert.equal(resolverInputs.length, 1);

console.log('homepage playback transport ownership checks pass');
