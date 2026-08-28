import assert from 'node:assert/strict';
import test from 'node:test';

import {
  candidateLinkKey,
  type HandoverDecisionFrame,
} from '../engine/handover/candidateDecisionContract';
import type { LinkSample } from '../engine/signal/types';
import { sceneGeometryFromProfile } from '../scene/SceneGeometry';
import { createEmptyFrame } from '../scene/simulationHelpers';
import type { SinrLiveCellFrame } from '../scene/sinrLiveCellModel';
import { liveSimToScene } from './liveSimToScene';

const PRIMARY_UE_ID = 'ue-primary';
const OLD_PAIR = candidateLinkKey('SAT-A', 2);
const SERVING_PAIR = candidateLinkKey('SAT-B', 7);

function sample(satelliteId: string, beamId: number, sinrDb: number): LinkSample {
  return {
    satId: satelliteId,
    beamId,
    rsrpDbm: -78,
    sinrDb,
    signalDbm: -78,
    intraInterferenceDbm: -104,
    interInterferenceDbm: -103,
    noiseDbm: -105,
    denominatorDbm: -99,
    txPowerDbm: 50,
    pathLossDb: 151,
    beamGainDb: 4,
    steeringLossDb: 1,
    receiverGainDbi: 2.5,
  };
}

function decisionFrame(): HandoverDecisionFrame {
  return {
    episodeId: 'episode-1',
    sourceFrameId: 'walker-frame-10',
    simTimeMs: 10_000,
    phase: 'monitoring',
    serving: SERVING_PAIR,
    opportunities: [],
    states: [],
    provisionalLeader: null,
    selectedTarget: null,
    selectedKind: null,
    selectionHoldSec: 0,
    selectionHoldRequiredSec: 1,
    mode: 'sinr-offset',
    recentCommit: null,
    epochToken: 'walker-epoch',
  };
}

test('multi-candidate scene projects exactly the authoritative primary serving pair', () => {
  const authoritativeSample = sample(SERVING_PAIR.satelliteId, SERVING_PAIR.beamId, 8.5);
  const legacySample = sample(OLD_PAIR.satelliteId, OLD_PAIR.beamId, -3);
  const frame = createEmptyFrame(10);
  frame.serving = { satId: OLD_PAIR.satelliteId, beamId: OLD_PAIR.beamId, sinrDb: -3 };
  frame.linkSamples = [legacySample, sample('SAT-C', 5, 4)];
  frame.perUePositions = [{
    id: PRIMARY_UE_ID,
    groundX: 12,
    groundZ: 18,
    eastKm: 12,
    northKm: -18,
    sinrDb: legacySample.sinrDb,
    servingSatId: OLD_PAIR.satelliteId,
    servingBeamId: OLD_PAIR.beamId,
    pendingTargetSatId: null,
    pendingTargetBeamId: null,
    triggerProgressSec: 0,
  }];
  frame.steeringBeamCellsBySatId = new Map([
    [OLD_PAIR.satelliteId, [{
      beamId: OLD_PAIR.beamId,
      offsetEastKm: 0,
      offsetNorthKm: 0,
      scanAngleDeg: 0,
    }]],
    [SERVING_PAIR.satelliteId, [{
      beamId: SERVING_PAIR.beamId,
      offsetEastKm: 5,
      offsetNorthKm: 1,
      scanAngleDeg: 3,
    }]],
  ]);
  const cellFrame: SinrLiveCellFrame = {
    simTimeSec: 10,
    cells: [],
    ues: [{
      ueId: PRIMARY_UE_ID,
      cellId: 2,
      cellDistanceKm: 3,
      offAxisDeg: 0.4,
      servingSatId: SERVING_PAIR.satelliteId,
      servingBeamId: SERVING_PAIR.beamId,
      beamIdentity: `${SERVING_PAIR.satelliteId}#cell7`,
      frequencyIndex: 1,
      sinrDb: authoritativeSample.sinrDb,
      servingLinkSample: authoritativeSample,
      handoverKind: 'none',
    }],
    illuminatedBeams: [],
    servedCellCount: 1,
    servedUeCount: 1,
    servingSatCount: 1,
    intraHandoverCount: 0,
    interHandoverCount: 0,
    cumulativeIntraHandoverCount: 0,
    cumulativeInterHandoverCount: 0,
    primaryUeId: PRIMARY_UE_ID,
    recentHandoverEvents: [],
  };
  frame.sinrLiveCells = cellFrame;
  frame.handoverDecisionFrame = decisionFrame();

  const geometry = sceneGeometryFromProfile({
    shell: { altitudeKm: 550 },
    antenna: { beamwidth3dBRad: 0.08 },
    handover: { triggerTimeSec: 1 },
    orbit: { shells: [{ id: 'shell-0', altitudeKm: 550 }] },
    beams: { frequencyReuse: 3 },
  });
  const projected = liveSimToScene(frame, geometry);

  assert.equal(projected.links.length, 1, 'candidate mode exposes one active primary data link');
  assert.equal(projected.links[0]?.sourceId, SERVING_PAIR.satelliteId);
  assert.equal(projected.links[0]?.beamId, String(SERVING_PAIR.beamId));
  assert.equal(projected.links[0]?.targetId, PRIMARY_UE_ID);
  assert.equal(projected.links[0]?.role, 'serving');
  assert.equal(projected.links.some(link => link.sourceId === OLD_PAIR.satelliteId), false);
  assert.equal(projected.metrics.servingSatelliteId, SERVING_PAIR.satelliteId);
  assert.equal(projected.metrics.servingBeamId, String(SERVING_PAIR.beamId));
  assert.equal(projected.ues[0]?.servingSatelliteId, SERVING_PAIR.satelliteId);
  assert.equal(projected.ues[0]?.servingBeamId, String(SERVING_PAIR.beamId));
  assert.equal(
    projected.beams.find(beam => beam.satelliteId === SERVING_PAIR.satelliteId)?.role,
    'serving',
  );
  assert.equal(
    projected.beams.find(beam => beam.satelliteId === OLD_PAIR.satelliteId)?.role,
    'inactive',
  );

  frame.sinrLiveCells = {
    ...cellFrame,
    ues: [{
      ...cellFrame.ues[0]!,
      servingSatId: OLD_PAIR.satelliteId,
      servingBeamId: OLD_PAIR.beamId,
      servingLinkSample: legacySample,
      sinrDb: legacySample.sinrDb,
    }],
  };
  const mismatched = liveSimToScene(frame, geometry);
  assert.equal(mismatched.links.length, 0, 'a mixed pair/sample join fails closed instead of drawing a stale link');
  assert.equal(mismatched.metrics.servingSatelliteId, SERVING_PAIR.satelliteId);
  assert.equal(mismatched.metrics.servingBeamId, String(SERVING_PAIR.beamId));
  assert.equal(Number.isNaN(mismatched.metrics.serving.dB), true);

  frame.sinrLiveCells = {
    ...cellFrame,
    ues: [{
      ...cellFrame.ues[0]!,
      sinrDb: legacySample.sinrDb,
      servingLinkSample: legacySample,
    }],
  };
  const staleSampleOnly = liveSimToScene(frame, geometry);
  assert.equal(
    staleSampleOnly.links.length,
    0,
    'a stale sample fails closed even when the serving record still names the decision pair',
  );
  assert.equal(staleSampleOnly.metrics.servingSatelliteId, SERVING_PAIR.satelliteId);
  assert.equal(staleSampleOnly.metrics.servingBeamId, String(SERVING_PAIR.beamId));
  assert.equal(Number.isNaN(staleSampleOnly.metrics.serving.dB), true);
});
