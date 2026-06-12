#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  MODQN_DENSE_Q_REQUIRED_TIE_BREAK,
  MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL,
  buildModqnReplayHandoverCinemaGate,
  createModqnReplayPlaybackDisplayState,
  type ModqnBeamState,
  type ModqnPolicyDiagnostics,
  type ModqnReplayPlaybackDisplayState,
} from '../src/modqn/replay-bundle';
import { ModqnReplayCuePanel } from '../src/ui/ModqnReplayCuePanel';

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

function assertIncludes(haystack: string, needle: string, label: string): void {
  assert.ok(haystack.includes(needle), `${label} missing ${needle}`);
}

function assertNotIncludes(haystack: string, needle: string, label: string): void {
  assert.ok(!haystack.includes(needle), `${label} unexpectedly includes ${needle}`);
}

function beamState(beamIndex: number): ModqnBeamState {
  return {
    beamId: `sat-0-beam-${beamIndex}`,
    beamIndex,
    satId: 'sat-0',
    satIndex: 0,
    localBeamIndex: beamIndex,
    validUnderDecisionMask: true,
    validUnderPostStepMask: true,
    centerLocalTangentKm: {
      east: beamIndex * 12,
      north: beamIndex === 1 ? 18 : -6,
    },
    footprintKm: 24,
    footprintProvenance: {
      displayOnly: false,
      policy: 'producer-renderable-footprint',
    },
  };
}

function completePolicyDiagnostics(): ModqnPolicyDiagnostics {
  return {
    objectiveWeights: {
      throughput: 0.5,
      handover: 0.3,
      loadBalance: 0.2,
    },
    objectiveQByAction: [
      { q1Throughput: 4, q2Handover: 1, q3LoadBalance: 1 },
      { q1Throughput: 3, q2Handover: 4, q3LoadBalance: 3 },
      { q1Throughput: 1, q2Handover: 1, q3LoadBalance: 1 },
    ],
    scalarizedQByAction: [2.5, 3.3, 1],
    selectedActionIndex: 1,
    tieBreak: MODQN_DENSE_Q_REQUIRED_TIE_BREAK,
    invalidActionSentinel: '-inf',
  };
}

function completeDisplayState(
  overrides: Partial<ModqnReplayPlaybackDisplayState['currentSlot']['focusRow']> = {},
): ModqnReplayPlaybackDisplayState {
  const base = createModqnReplayPlaybackDisplayState(
    MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL,
    0,
    false,
    true,
  );
  const beamStates = [0, 1, 2].map(beamState);
  const focusRow = {
    ...base.currentSlot.focusRow,
    sourceRowIndex: 42,
    userId: 'ue-42',
    userIndex: 42,
    timeSec: 12,
    decisionTimeSec: 11,
    handoverEventId: 'producer-event-intra-42',
    handoverEventKind: 'intra-satellite-beam-switch' as const,
    previousServing: beamStates[0] as ModqnBeamState,
    selectedServing: beamStates[1] as ModqnBeamState,
    scalarReward: 3.3,
    rewardVector: {
      throughput: 4,
      handover: -0.5,
      loadBalance: -0.2,
    },
    policyDiagnostics: completePolicyDiagnostics(),
    decisionActionValidityMask: [true, true, true],
    actionValidityMask: [true, true, true],
    decisionUserPosition: {
      localTangentKm: {
        east: 6,
        north: -3,
      },
    },
    userPosition: {
      localTangentKm: {
        east: 6,
        north: -2.8,
      },
    },
    satelliteStates: [
      {
        satId: 'sat-0',
        satIndex: 0,
        coordinateFrameKind: 'topocentric-local-tangent',
        subSatellitePoint: {
          latDeg: 0.05,
          lonDeg: 0.15,
        },
      },
    ],
    beamStates,
    ...overrides,
  };

  return {
    ...base,
    currentSlot: {
      ...base.currentSlot,
      focusRow,
    },
  };
}

console.log('validate-modqn-replay-handover-cinema-gate');

{
  const displayState = createModqnReplayPlaybackDisplayState(
    MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL,
    0,
    false,
    true,
  );
  const gate = buildModqnReplayHandoverCinemaGate(displayState);

  assert.equal(gate.status, 'source-gap', 'current fallback artifact must keep D6 cinema blocked');
  assertIncludes(gate.sourceGapFields.join(','), 'timeline.sourceRowIdentity', 'missing event ID is a source gap');
  assertIncludes(gate.sourceGapFields.join(','), 'entities.ues.positionTrace', 'missing UE position is a source gap');
  assertIncludes(gate.sourceGapFields.join(','), 'entities.satellites.trajectory', 'missing satellite trajectory is a source gap');
  assertIncludes(gate.sourceGapFields.join(','), 'entities.beams.footprints', 'missing beam footprint is a source gap');
  assertIncludes(gate.sourceGapFields.join(','), 'diagnostics.denseQPolicy', 'missing dense-Q proof is a source gap');
}

{
  const gate = buildModqnReplayHandoverCinemaGate(completeDisplayState());

  assert.equal(gate.status, 'ready', 'complete producer sample unlocks D6 gate');
  assert.equal(gate.sourceGapFields.length, 0, 'ready gate has no source gaps');
  assertIncludes(gate.eventKey ?? '', 'event:producer-event-intra-42', 'event key includes producer event ID');
  assertIncludes(gate.eventKey ?? '', 'row:42', 'event key includes source row');
  assertIncludes(gate.eventKey ?? '', 'ue:ue-42', 'event key includes UE identity');
}

{
  // Windowed action space (regression guard, mirrors the denseQProof.ts fix):
  // focusRow.beamStates is the PHYSICAL beam list and under a windowed action
  // space is LONGER than the dense action catalog. The gate must index dense Q
  // by policyDiagnostics.candidateActionOrder (length A), NOT beamStates.
  // Reverting cinema-gate to `actionOrder: focusRow.beamStates ?? []` makes the
  // dense-Q proof source-gap here (5 != 3) and this assertion fails.
  const catalogBeams = [0, 1, 2].map(beamState); // A = 3 (dense catalog)
  const physicalBeams = [0, 1, 2, 3, 4].map(beamState); // 5 physical beams
  const gate = buildModqnReplayHandoverCinemaGate(completeDisplayState({
    beamStates: physicalBeams,
    decisionActionValidityMask: [true, true, true],
    policyDiagnostics: {
      ...completePolicyDiagnostics(),
      candidateActionOrder: catalogBeams,
    },
  }));

  assert.equal(gate.status, 'ready', 'windowed bundle: dense catalog (not the longer physical beam list) unlocks D6 cinema');
  assert.equal(gate.sourceGapFields.length, 0, 'windowed ready gate has no source gaps');
  assert.equal(gate.denseQProof?.status, 'proof-ready', 'windowed dense-Q proof is ready off the catalog');
  const windowedProof = gate.denseQProof;
  if (windowedProof && windowedProof.status === 'proof-ready') {
    assert.equal(windowedProof.actionCount, 3, 'dense-Q action count follows the catalog, not the physical beam count');
  }
}

{
  const gate = buildModqnReplayHandoverCinemaGate(completeDisplayState({
    policyDiagnostics: {
      objectiveWeights: { throughput: 0.5, handover: 0.3, loadBalance: 0.2 },
      topCandidates: [
        {
          ...beamState(1),
          objectiveQ: { throughput: 3, handover: 4, loadBalance: 3 },
          scalarizedQ: 3.3,
        },
      ],
    },
  }));

  assert.equal(gate.status, 'source-gap', 'top-K diagnostics alone keep D6 cinema blocked');
  assertIncludes(gate.sourceGapFields.join(','), 'diagnostics.denseQPolicy', 'top-K-only state maps to dense-Q source gap');
}

{
  const displayOnlyBeams = [0, 1, 2].map(index => ({
    ...beamState(index),
    footprintProvenance: {
      displayOnly: true,
      policy: 'display-derived-footprint',
    },
  }));
  const gate = buildModqnReplayHandoverCinemaGate(completeDisplayState({
    beamStates: displayOnlyBeams,
  }));

  assert.equal(gate.status, 'source-gap', 'display-only beam footprints keep D6 cinema blocked');
  assertIncludes(gate.sourceGapFields.join(','), 'entities.beams.footprints', 'display-only footprint maps to beam footprint gap');
}

{
  const gate = buildModqnReplayHandoverCinemaGate(completeDisplayState({
    satelliteStates: [
      {
        satId: 'sat-0',
        satIndex: 0,
        coordinateFrameKind: 'eci-km-no-earth-rotation-proxy',
        subSatellitePoint: {
          latDeg: 0.05,
          lonDeg: 0.15,
        },
      },
    ],
  }));

  assert.equal(gate.status, 'source-gap', 'proxy satellite frame keeps D6 cinema blocked');
  assertIncludes(gate.sourceGapFields.join(','), 'entities.satellites.trajectory', 'proxy satellite maps to trajectory gap');
}

{
  const blockedHtml = renderToString(
    <ModqnReplayCuePanel
      appMode="modqn-demo"
      displayState={createModqnReplayPlaybackDisplayState(MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL, 0, false, true)}
      proofViewportActive={false}
    />,
  );
  assertIncludes(blockedHtml, 'data-testid="modqn-replay-cinema-readiness"', 'cue panel renders D6 readiness stamp');
  assertIncludes(blockedHtml, 'data-replay-cinema-status="source-gap"', 'cue panel exposes blocked status');
  assertIncludes(blockedHtml, 'diagnostics.denseQPolicy', 'cue panel exposes dense-Q source gap');

  const readyHtml = renderToString(
    <ModqnReplayCuePanel
      appMode="modqn-demo"
      displayState={completeDisplayState()}
      proofViewportActive={false}
    />,
  );
  assertIncludes(readyHtml, 'data-replay-cinema-status="ready"', 'cue panel exposes ready status');
  assertIncludes(readyHtml, 'event:producer-event-intra-42', 'cue panel exposes producer event key');
}

const gateSource = read('src/modqn/replay-bundle/replayHandoverCinemaGate.ts');
assertNotIncludes(gateSource, 'liveWalker', 'D6 replay gate must not import live Walker state');
assertNotIncludes(gateSource, 'sinr', 'D6 replay gate must not import live SINR state');
assertNotIncludes(gateSource, '../scene', 'D6 replay gate must not depend on scene renderer fallbacks');
assertNotIncludes(gateSource, 'useHandoverCinema', 'D6 replay gate must not reuse live cinema runtime');
assertIncludes(
  gateSource,
  'focusRow.policyDiagnostics?.candidateActionOrder ?? focusRow.beamStates',
  'D6 gate indexes dense Q by the policy action catalog, falling back to the physical beam list',
);

const panelSource = read('src/ui/ModqnReplayCuePanel.tsx');
assertIncludes(panelSource, 'buildModqnReplayHandoverCinemaGate', 'cue panel consumes D6 gate');
assertIncludes(panelSource, 'data-testid="modqn-replay-cinema-readiness"', 'cue panel keeps stable D6 test id');

console.log('PASS: MODQN replay handover cinema gate fails closed until one producer sample has event, geometry, reward, masks, and dense-Q proof');
