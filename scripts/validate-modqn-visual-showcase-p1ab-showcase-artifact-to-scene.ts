/**
 * Test: showcaseArtifactToScene adapter.
 *
 * Verifies (SDD §9 P1 / §13 trigger artifact):
 *   - Trigger artifact maps frame 0 → NormalizedSceneFrame.
 *   - channelMetricKind === 'snr-no-interference' threads through.
 *   - 100 UEs, 4 satellites, 28 beams present.
 *   - SceneGeometry brand check passes (REPLAY_GEOMETRY_BRAND).
 *   - sceneSource === 'artifact-replay'.
 *   - frame 0 handoverState.kind ('intra-satellite-beam-switch') is preserved.
 */

import assert from 'node:assert/strict';
import { showcaseArtifactToScene } from '../src/showcase/showcaseArtifactToScene';
import { isReplaySceneGeometry } from '../src/scene/SceneGeometry';
import { loadValidatorVisualShowcaseArtifact } from './visualShowcaseValidatorFixture';

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

console.log('validate-modqn-visual-showcase-p1ab-showcase-artifact-to-scene');

const { artifact, source } = loadValidatorVisualShowcaseArtifact();
console.log(`  artifact source: ${source.label}`);
const frame0 = showcaseArtifactToScene(artifact, 0);

test('sceneSource is artifact-replay', () => {
  assert.strictEqual(frame0.sceneSource, 'artifact-replay');
});

test('channelMetricKind is snr-no-interference', () => {
  assert.strictEqual(frame0.channelMetricKind, 'snr-no-interference');
  assert.strictEqual(frame0.metrics.channelMetricKind, 'snr-no-interference');
});

test('entity counts: 100 UEs / 4 satellites / 28 beams', () => {
  assert.strictEqual(frame0.satellites.length, 4);
  assert.strictEqual(frame0.ues.length, 100);
  assert.strictEqual(frame0.beams.length, 28);
});

test('SceneGeometry carries REPLAY_GEOMETRY_BRAND', () => {
  assert.ok(isReplaySceneGeometry(frame0.geometry));
});

test('frame 0 handoverState.kind preserved as intra-satellite-beam-switch', () => {
  assert.strictEqual(frame0.handover.kind, 'intra-satellite-beam-switch');
});

test('every UE channel metric is branded with kind=snr-no-interference', () => {
  for (const ue of frame0.ues) {
    const cm = ue.channelMetric;
    assert.ok(typeof cm.kind === 'string' && typeof cm.dB === 'number');
    assert.strictEqual(ue.channelMetric.kind, 'snr-no-interference');
  }
});

test('every satellite has a world-space position projected via coordToWorld', () => {
  for (const s of frame0.satellites) {
    assert.strictEqual(s.coordFrameKind, 'eci-km-no-earth-rotation-proxy');
    assert.strictEqual(s.worldPos.length, 3);
    // R1: ECI proxy should equal the raw positionEcefKm — identity mapping.
    // Cross-check sat-0 against the artifact's raw value.
  }
  const raw = artifact.timeline[0].satellites[0].positionEcefKm;
  assert.strictEqual(frame0.satellites[0].worldPos[0], raw[0]);
  assert.strictEqual(frame0.satellites[0].worldPos[1], raw[1]);
  assert.strictEqual(frame0.satellites[0].worldPos[2], raw[2]);
});

test('eventRoles maps every beam', () => {
  assert.strictEqual(frame0.eventRoles.byBeamId.size, 28);
});

test('truthOwnership is preserved on the replay path', () => {
  assert.ok(frame0.truthOwnership);
  assert.strictEqual(
    frame0.truthOwnership && frame0.truthOwnership.sinr.channelMetricKind,
    'snr-no-interference',
  );
});

test('claimBoundary carries producer storyKind', () => {
  assert.ok(frame0.claimBoundary);
  const cb = frame0.claimBoundary as { storyKind?: string };
  assert.strictEqual(typeof cb.storyKind, 'string');
});

console.log('OK');
