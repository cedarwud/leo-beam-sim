/**
 * P1e (b2) — runtime driver. Exercises the artifact-replay code path end to
 * end (load → adapter → first NormalizedSceneFrame). If any forbidden live-
 * engine module is transitively imported (and therefore evaluated) the
 * loader hook (`p1e-runtime-side-effect-loader.mjs`) replaces that module's
 * source with a top-level `throw`, killing this process before the success
 * print line is reached.
 */

import assert from 'node:assert/strict';

import { showcaseArtifactToScene } from '../src/showcase/showcaseArtifactToScene';
import { ShowcaseReplayController } from '../src/showcase/ShowcaseReplayController';
import { loadValidatorVisualShowcaseArtifact } from './visualShowcaseValidatorFixture';

const { artifact } = loadValidatorVisualShowcaseArtifact();
assert.strictEqual(artifact.schemaVersion, 'visual-showcase-v1');
assert.strictEqual(artifact.timeline.length, 61);

const controller = new ShowcaseReplayController(artifact);
assert.strictEqual(controller.currentFrameIndex(), 0, 'controller initialised at frame 0');

const adapted = showcaseArtifactToScene(artifact, 0);
assert.strictEqual(adapted.sceneSource, 'artifact-replay');
assert.strictEqual(adapted.channelMetricKind, 'snr-no-interference');
assert.ok(adapted.satellites.length > 0, 'replay frame has satellites');
assert.ok(adapted.ues.length > 0, 'replay frame has UEs');
assert.ok(adapted.beams.length > 0, 'replay frame has beams');

console.log('REPLAY_DRIVER_OK');
