import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyBeamHoppingDemoOverride,
  BEAM_HOPPING_DEMO_SLOT_MAX,
  BEAM_HOPPING_DEMO_SLOT_MIN,
  DEFAULT_BEAM_HOPPING_DEMO_STATE,
} from '../src/ui/modqn-controls/BeamHoppingToggle';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readSource(relativePath: string): string {
  return readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

const PASSED: string[] = [];

function pass(label: string): void {
  PASSED.push(label);
}

function expect(condition: boolean, label: string): void {
  assert.ok(condition, label);
  pass(label);
}

function validateComponentContract(): void {
  const source = readSource('src/ui/modqn-controls/BeamHoppingToggle.tsx');
  expect(source.includes('export function BeamHoppingToggle'), 'BeamHoppingToggle is exported');
  expect(source.includes('export interface BeamHoppingDemoState'), 'BeamHoppingDemoState shape is exported');
  expect(source.includes('DEFAULT_BEAM_HOPPING_DEMO_STATE'), 'Default state exported');
  expect(source.includes("data-testid=\"beam-hopping-toggle\""), 'Root testid is beam-hopping-toggle');
  expect(source.includes("data-testid=\"beam-hopping-toggle-enabled\""), 'Enabled checkbox testid');
  expect(source.includes("data-testid=\"beam-hopping-toggle-slot-sec\""), 'Slot-sec slider testid');
  expect(source.includes('not paper baseline'), 'Provenance label calls out non-paper status');
  expect(source.includes('live-sim only'), 'Provenance label calls out live-sim only');
  expect(
    source.includes("if (appMode !== 'modqn-demo') return null"),
    'Toggle renders null outside modqn-demo',
  );
  expect(source.includes('applyBeamHoppingDemoOverride'), 'Override helper exported');
  expect(
    source.includes('producer truth: beamHopping') || source.includes('§7.5'),
    'Help text cites training-truth SDD §7.5 producer-truth constraint',
  );
}

function validateDefaultState(): void {
  expect(DEFAULT_BEAM_HOPPING_DEMO_STATE.enabled === false, 'Default state has hopping disabled');
  expect(
    DEFAULT_BEAM_HOPPING_DEMO_STATE.slotSec >= BEAM_HOPPING_DEMO_SLOT_MIN,
    'Default slotSec >= min',
  );
  expect(
    DEFAULT_BEAM_HOPPING_DEMO_STATE.slotSec <= BEAM_HOPPING_DEMO_SLOT_MAX,
    'Default slotSec <= max',
  );
  expect(BEAM_HOPPING_DEMO_SLOT_MIN === 1.0, 'Slot min is 1.0s');
  expect(BEAM_HOPPING_DEMO_SLOT_MAX === 5.0, 'Slot max is 5.0s');
}

function validateOverrideBehavior(): void {
  const profile = {
    beamHopping: {
      enabled: false,
      slotSec: 1.0,
      maxActiveBeamsPerSlot: 7,
      scheduler: 'round-robin',
      frameLengthSlots: 7,
    },
    other: 'untouched' as const,
  };

  const noChange = applyBeamHoppingDemoOverride(profile, {
    enabled: false,
    slotSec: 2.5,
  });
  expect(noChange === profile, 'Override disabled returns same profile reference');

  const enabled = applyBeamHoppingDemoOverride(profile, {
    enabled: true,
    slotSec: 3.0,
  });
  expect(enabled !== profile, 'Override enabled returns a new profile reference');
  expect(enabled.beamHopping.enabled === true, 'Override flips beamHopping.enabled to true');
  expect(enabled.beamHopping.slotSec === 3.0, 'Override applies user slotSec');
  expect(
    enabled.beamHopping.scheduler === 'round-robin',
    'Override preserves scheduler from base profile',
  );
  expect(
    enabled.beamHopping.maxActiveBeamsPerSlot === 7,
    'Override preserves maxActiveBeamsPerSlot from base profile',
  );
  expect(enabled.other === 'untouched', 'Override does not mutate sibling profile fields');
  expect(profile.beamHopping.enabled === false, 'Source profile is not mutated');
}

function validateAppWire(): void {
  const source = readSource('src/App.tsx');
  expect(source.includes('BeamHoppingToggle'), 'App.tsx imports BeamHoppingToggle');
  expect(
    source.includes('DEFAULT_BEAM_HOPPING_DEMO_STATE'),
    'App.tsx imports default state for initial useState',
  );
  expect(
    source.includes('applyBeamHoppingDemoOverride'),
    'App.tsx applies the demo override in effectiveProfile composition',
  );
  expect(
    source.includes('beamHoppingDemoState'),
    'App.tsx holds beamHoppingDemoState in component state',
  );
  expect(
    source.includes("setBeamHoppingDemoState"),
    'App.tsx exposes setBeamHoppingDemoState to the toggle',
  );
  expect(
    source.includes("appMode !== 'modqn-demo'") && source.includes('applyBeamHoppingDemoOverride'),
    'effectiveProfile gates override on appMode === modqn-demo',
  );

  const replayBranchSnippet = source.split('activeLeftSidebarTab === \'replay\'')[1] ?? '';
  expect(
    replayBranchSnippet.startsWith(' ?') && replayBranchSnippet.includes('BeamHoppingToggle'),
    'BeamHoppingToggle is mounted inside the replay tab branch',
  );
}

function validateProfileUntouched(): void {
  const profileJson = JSON.parse(
    readSource('src/profiles/modqn-4sat-7beam-paper-faithful.json'),
  );
  expect(
    profileJson.beamHopping.enabled === false,
    'Profile JSON still declares beamHopping disabled (override is runtime-only)',
  );
  expect(
    profileJson.beamHopping.maxActiveBeamsPerSlot === 7,
    'Profile JSON keeps maxActiveBeamsPerSlot at 7',
  );
  expect(
    profileJson.beamHopping.scheduler === 'round-robin',
    'Profile JSON keeps round-robin scheduler',
  );
}

function validateReplayPathUntouched(): void {
  const replayLayer = readSource('src/scene/modqn-replay-visuals/index.tsx');
  expect(
    replayLayer.includes('producer-display-proxy'),
    'Replay layer producer-display-proxy gate untouched',
  );
  expect(
    readSource('src/modqn/replay-bundle/playback-shell.ts').includes('validateSevenBeamPlaybackModel'),
    'Replay playback shell strict 7-beam validation untouched',
  );
}

function validateSceneSourceContract(): void {
  expect(
    readSource('src/scene/NormalizedSceneFrame.ts').includes("'live-sim' | 'artifact-replay'"),
    'NormalizedSceneFrame.sceneSource discriminator unchanged',
  );
}

validateComponentContract();
validateDefaultState();
validateOverrideBehavior();
validateAppWire();
validateProfileUntouched();
validateReplayPathUntouched();
validateSceneSourceContract();

assert.ok(PASSED.length >= 22, `expected >= 22 assertions; got ${PASSED.length}`);

console.log(`validate-phase-h-s4-beam-hopping-toggle: PASS (${PASSED.length}/0 assertions)`);
