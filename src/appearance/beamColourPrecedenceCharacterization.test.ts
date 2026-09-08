/**
 * Characterization of the homepage/beam-identity seam in the multi-candidate
 * scene resolver.
 *
 * This is pure: it invokes the exported renderer-neutral resolver directly;
 * it does not mount React, create a canvas, or render a Three.js scene.
 *
 * The two expected colours are intentionally literals.  They were read from
 * the current running code before this test was written:
 * homepage projection for sat-serving/beam 1 -> #5d80e9
 * beam identity fallback in this fixture -> #beam-identity
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  candidateLinkKey,
  candidateLinkKeyString,
} from '../engine/handover/candidateDecisionContract';
import type {
  MultiCandidateSceneIdentity,
  MultiCandidateSceneLinkInstruction,
  MultiCandidateScenePresentation,
} from '../scene/multiCandidateScenePresentation';
import {
  resolveMultiCandidateBeamScene,
  type MultiCandidateBeamSceneResolverInput,
} from '../viz/MultiCandidateBeamScene';

const SATELLITE_ID = 'sat-serving';
const BEAM_ID = 1;
const SOURCE_FRAME_ID = 'beam-colour-precedence-frame';
const KEY = candidateLinkKey(SATELLITE_ID, BEAM_ID);
const PAIR_KEY = candidateLinkKeyString(KEY);

// The scene resolver only reads these identity colour fields.  Keeping the
// fixture explicit makes the two competing rungs unambiguous at this seam.
const identity = {
  satellite: { threeColor: '#satellite-identity' },
  beam: { threeColor: '#beam-identity' },
} as unknown as MultiCandidateSceneIdentity;

const instruction = {
  joinKey: 'beam-colour-precedence-join',
  sceneJoinKey: 'beam-colour-precedence-scene-join',
  railJoinKey: 'beam-colour-precedence-rail-join',
  pairKey: PAIR_KEY,
  key: KEY,
  sourceFrameId: SOURCE_FRAME_ID,
  satelliteId: SATELLITE_ID,
  beamId: BEAM_ID,
  displayKey: 'S / beam 1',
  role: 'serving',
  isServing: true,
  isCandidate: false,
  isPinned: false,
  transitionRole: null,
  satelliteIdentity: { satelliteId: SATELLITE_ID } as MultiCandidateSceneLinkInstruction['satelliteIdentity'],
  beamIdentity: { satelliteId: SATELLITE_ID, beamId: BEAM_ID } as MultiCandidateSceneLinkInstruction['beamIdentity'],
  identity,
  cone: { style: 'restrained-translucent', visible: true, volume: 1 },
  footprint: { style: 'solid', visible: true },
  link: { style: 'solid-data', isSolidData: true, isMeasurementOnly: false },
} as unknown as MultiCandidateSceneLinkInstruction;

const presentation = {
  episodeId: 'beam-colour-precedence-episode',
  sourceFrameId: SOURCE_FRAME_ID,
  budget: { maxSatelliteGroups: 1, maxCandidatePairs: 1, maxConeVolumes: 1 },
  instructions: [instruction],
  serving: instruction,
  candidates: [],
  coneVolumeCount: 1,
  activeDataLinkCount: 1,
  solidDataLinkCount: 1,
} as unknown as MultiCandidateScenePresentation;

function resolve(homepageVisualIdentity: boolean): string {
  const input: MultiCandidateBeamSceneResolverInput = {
    presentation,
    placementByCellId: new Map([[0, { cellId: 0, worldX: 0, worldZ: 0, radiusWorld: 10 }]]),
    satelliteWorldById: new Map([[SATELLITE_ID, { x: 0, y: 100, z: 0 }]]),
    primaryUeWorld: { x: 1, y: 0, z: 1 },
    reducedMotion: true,
    homepageVisualIdentity,
  };
  return resolveMultiCandidateBeamScene(input).instructions[0]!.beamColor;
}

test('homepage colour outranks beam identity at the MultiCandidate scene seam', () => {
  assert.equal(
    resolve(true),
    '#5d80e9',
    'the homepage projection must be the cone colour when homepage identity is enabled',
  );
  assert.equal(
    resolve(false),
    '#beam-identity',
    'the beam identity must remain the fallback when homepage identity is disabled',
  );
  assert.notEqual(
    resolve(true),
    resolve(false),
    'homepage colour and beam identity must remain distinguishable rungs',
  );
});
