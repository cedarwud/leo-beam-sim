/**
 * P1e — Static-frame integration test (SDD §9 P1 deliverable: "render one
 * timeline frame through existing components at reduced scale").
 *
 * This is the consolidated end-to-end smoke. It exercises the full replay
 * pipeline on the real trigger artifact:
 *
 *   1. SHA-256 verify the trigger artifact bytes against the SDD-pinned
 *      hash (catches accidental fixture drift).
 *   2. ntn-sim-core `validate:visual-showcase:artifact` PASS (R3 / D7
 *      pre-render gate).
 *   3. `loadShowcaseArtifact` PASS — schema + claim-boundary + Q5
 *      handover-kind binding all hold.
 *   4. `ShowcaseReplayController` constructs without error and reports
 *      the correct timeline length.
 *   5. `showcaseArtifactToScene(artifact, frameIndex)` produces a
 *      `NormalizedSceneFrame` with:
 *        - sceneSource === 'artifact-replay'
 *        - channelMetricKind === 'snr-no-interference'
 *        - satellites / ues / beams / links populated (trigger artifact
 *          dimensions: 4 sats / 100 UEs / 28 beams)
 *        - geometry carries REPLAY brand (via SceneGeometry check inside
 *          adapter — confirmed by adapter returning without throw)
 *        - claimBoundary.allowedClaims non-empty
 *   6. `decideClaimBoundaryBanner(scene)` returns kind='rendered' with
 *      the producer-allowed title.
 *   7. Per §3 Q5 verification: the artifact's one declared intra-handover
 *      frame has `handoverState.kind === 'intra'` (or whatever the
 *      producer emits) and adapter passes that into
 *      `transitionProgress.intra` truth-respectingly.
 *
 * Headless React render of `<MainScene />` is intentionally NOT performed
 * — see SDD §9 exit criterion gating: this slice is the truth-boundary
 * gate, not the visual gate. The visual gate (`vite build` + browser
 * dogfood + manual screenshot) ships with the host integration into
 * App.tsx (a P1 follow-up).
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { loadShowcaseArtifact } from '../src/showcase/loadShowcaseArtifact';
import { showcaseArtifactToScene } from '../src/showcase/showcaseArtifactToScene';
import { ShowcaseReplayController } from '../src/showcase/ShowcaseReplayController';
import { decideClaimBoundaryBanner } from '../src/ui/ClaimBoundaryBanner';
import {
  PINNED_VISUAL_SHOWCASE_ARTIFACT_SHA256,
  loadValidatorVisualShowcaseArtifact,
} from './visualShowcaseValidatorFixture';
import { skipIfDataUnavailable } from './lib/ci-data-guard';

const NTN_SIM_CORE_DIR = '/home/u24/papers/ntn-sim-core';

// CI-environment guard (P2 SN-3c): this validator spawns ntn-sim-core's
// validate:visual-showcase:artifact oracle inside the read-only sibling checkout.
// Skip (visibly, exit 0 + marker) when that checkout is absent — the hosted-CI
// signature. See scripts/lib/ci-data-guard.ts for the SKIP semantics.
skipIfDataUnavailable([{
  path: `${NTN_SIM_CORE_DIR}/package.json`,
  why: 'ntn-sim-core sibling checkout — spawns its validate:visual-showcase:artifact oracle on the trigger artifact',
}]);

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

console.log('validate-modqn-visual-showcase-p1e-static-frame-integration');

const { rawBytes: raw, rawText, source } = loadValidatorVisualShowcaseArtifact();
console.log(`  artifact source: ${source.label}`);

function withArtifactPath<T>(fn: (artifactPath: string) => T): T {
  if (source.path) return fn(source.path);
  const tmp = mkdtempSync(path.join(tmpdir(), 'visual-showcase-fixture-'));
  try {
    const outPath = path.join(tmp, 'visual-showcase-v1.json');
    writeFileSync(outPath, rawText);
    return fn(outPath);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

test('artifact SHA-256 matches pinned hash when the pinned trigger is available', () => {
  const hash = createHash('sha256').update(raw).digest('hex');
  if (!source.isPinnedTrigger) {
    assert.strictEqual(source.kind, 'synthetic');
    return;
  }
  if (hash !== PINNED_VISUAL_SHOWCASE_ARTIFACT_SHA256) {
    throw new Error(
      `trigger artifact hash drifted.\n  expected: ${PINNED_VISUAL_SHOWCASE_ARTIFACT_SHA256}\n  actual:   ${hash}\n  path:     ${source.path}`,
    );
  }
});

test('ntn-sim-core validate:visual-showcase:artifact PASSes', () => {
  const r = withArtifactPath((artifactPath) => spawnSync(
      'npm',
      ['run', '--silent', 'validate:visual-showcase:artifact', '--', artifactPath],
      { cwd: NTN_SIM_CORE_DIR, encoding: 'utf8' },
    ));
  if (r.status !== 0) {
    throw new Error(
      `ntn-sim-core validator failed (exit ${r.status}):\n${r.stdout}\n${r.stderr}`,
    );
  }
});

let artifactLoaded = false;
let artifact: ReturnType<typeof loadShowcaseArtifact>;
test('loadShowcaseArtifact PASSes on trigger artifact', () => {
  artifact = loadShowcaseArtifact(JSON.parse(rawText));
  artifactLoaded = true;
  assert.strictEqual(artifact.schemaVersion, 'visual-showcase-v1');
  assert.strictEqual(artifact.scenario.profile, 'modqn-multi-ue');
  assert.strictEqual(artifact.timeline.length, 61);
  assert.strictEqual(artifact.entities.satellites.length, 4);
  assert.strictEqual(artifact.entities.ues.length, 100);
  assert.strictEqual(artifact.entities.beams.length, 28);
  assert.strictEqual(
    artifact.truthOwnership.sinr.channelMetricKind,
    'snr-no-interference',
  );
});

test('ShowcaseReplayController constructs and reports timeline length', () => {
  assert.ok(artifactLoaded, 'requires load step');
  const ctl = new ShowcaseReplayController(artifact);
  assert.strictEqual(ctl.totalFrames(), 61);
  assert.strictEqual(ctl.currentFrameIndex(), 0);
});

test('frame 0 adapts to a NormalizedSceneFrame with replay invariants', () => {
  const scene = showcaseArtifactToScene(artifact, 0);
  assert.strictEqual(scene.sceneSource, 'artifact-replay');
  assert.strictEqual(scene.channelMetricKind, 'snr-no-interference');
  assert.strictEqual(scene.frameIndex, 0);
  assert.ok(scene.satellites.length >= 1, 'satellites populated');
  assert.ok(scene.ues.length >= 1, 'ues populated');
  assert.ok(scene.beams.length >= 1, 'beams populated');
  assert.ok(scene.links.length >= 1, 'links populated');
  // Geometry: adapter throws if the brand stamping fails; reaching here
  // proves the SceneGeometry was constructed via the REPLAY path.
  assert.ok(scene.geometry != null, 'geometry attached');
  // Claim boundary preserved end-to-end.
  const cb = scene.claimBoundary as { allowedClaims: string[]; storyKind: string };
  assert.ok(cb.allowedClaims.length > 0, 'allowedClaims preserved');
  assert.strictEqual(cb.storyKind, 'modqn-handover-baseline');
});

test('Q5 handover-kind binding: every frame carries handoverState.kind, non-none kind passes through adapter', () => {
  // Trigger artifact (SDD §2.4): kind counts = 1 × 'intra-satellite-beam-switch' + 60 × 'none'.
  let nonNoneIndex = -1;
  let nonNoneKind = '';
  for (let i = 0; i < artifact.timeline.length; i++) {
    const kind = artifact.timeline[i].handoverState.kind;
    assert.ok(
      typeof kind === 'string' && kind.length > 0,
      `frame ${i}: handoverState.kind absent/empty — Q5 binding broken`,
    );
    if (kind !== 'none' && nonNoneIndex === -1) {
      nonNoneIndex = i;
      nonNoneKind = kind;
    }
  }
  assert.notStrictEqual(
    nonNoneIndex,
    -1,
    'expected at least one non-"none" handover frame in trigger artifact',
  );
  assert.strictEqual(
    nonNoneKind,
    'intra-satellite-beam-switch',
    `expected the documented kind from §2.4, got ${nonNoneKind}`,
  );
  const nonNoneScene = showcaseArtifactToScene(artifact, nonNoneIndex);
  assert.strictEqual(
    nonNoneScene.handover.kind,
    'intra-satellite-beam-switch',
    `adapter must propagate handoverState.kind=${nonNoneKind} (frame ${nonNoneIndex})`,
  );
});

test('claim-boundary banner decision on frame 0 = rendered with producer title', () => {
  const scene = showcaseArtifactToScene(artifact, 0);
  const decision = decideClaimBoundaryBanner(scene);
  if (decision.kind !== 'rendered') {
    throw new Error(`expected rendered, got ${decision.kind}: ${JSON.stringify(decision)}`);
  }
  assert.strictEqual(decision.title, 'baseline MODQN multi-UE replay artifact');
});

console.log('OK');
