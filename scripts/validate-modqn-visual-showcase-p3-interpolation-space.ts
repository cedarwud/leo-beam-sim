/**
 * P3 — Interpolation-space test (SDD §9 P3 exit criterion).
 *
 *   "interpolation-space test: assert intermediate frame positions are
 *    linear in world space between consecutive samples"
 *
 * This validator drives the `showcaseArtifactToSceneInterpolated` adapter at
 * fractional times between consecutive timeline frames on the SDD-pinned
 * trigger artifact and proves two binding facts:
 *
 *   (A) Positive — world-space linearity. For both satellites and UEs the
 *       interpolated `worldPos` at fractional time `t = t0 + alpha * (t1 - t0)`
 *       equals `lerp(f0.worldPos, f1.worldPos, alpha)` (i.e. the adapter
 *       performs a linear blend in world space after `coordToWorld`).
 *
 *   (B) Negative — Re-applying a non-identity coordToWorld to a raw lerp
 *       would NOT match the world-space lerp. We construct a synthetic
 *       non-identity transform `T(theta)` (rotation about the Y axis by an
 *       angle that varies between bracket samples) — the analogue of the
 *       Earth-rotation compensation that R1 forbids the adapter from
 *       re-introducing between samples — and prove:
 *
 *           lerp(T(theta0)*p0, T(theta1)*p1, alpha)  !=  T(theta_alpha)*lerp(p0, p1, alpha)
 *
 *       The first expression is the world-space lerp that the adapter
 *       performs. The second is what "lerp positionEcefKm, then re-apply
 *       coordToWorld at the synthesized intermediate time" would produce.
 *       The two are equal only when the transform is constant across the
 *       bracket — which is exactly the R1 invariant the
 *       `eci-km-no-earth-rotation-proxy` frame guarantees (and which the
 *       adapter's identity coordToWorld preserves by construction). Showing
 *       the inequality under a non-identity T proves the adapter's choice
 *       to lerp in world space is load-bearing, not incidental.
 *
 * Constraints (per SDD §9 P3 + R1 + R6):
 *   - No imports from `core/channel`, `core/beam`, `HandoverManager`,
 *     `computeLinkBudget`, `buildLinkContext`, `runtimeFrameStep`. This
 *     validator is replay-only.
 *   - Live-sim path unchanged.
 */

import assert from 'node:assert/strict';

import { showcaseArtifactToScene } from '../src/showcase/showcaseArtifactToScene';
import { showcaseArtifactToSceneInterpolated } from '../src/showcase/showcaseArtifactToSceneInterpolated';
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

console.log('validate-modqn-visual-showcase-p3-interpolation-space');

const { artifact, source } = loadValidatorVisualShowcaseArtifact();
console.log(`  artifact source: ${source.label}`);
const timesSec = artifact.timebase.timesSec ?? artifact.timeline.map((f) => f.tSec);

// World-space linearity must hold up to numerical noise (no truth recompute).
const EPS_WORLD_KM = 1e-9;
// The synthetic non-identity transform must produce a measurable disagreement
// to prove the test has substance.
const NONLINEAR_MIN_DELTA_WORLD = 1e-3;

function lerp(a: number, b: number, alpha: number): number {
  return a * (1 - alpha) + b * alpha;
}

/**
 * Synthetic rotation about the Y axis by `thetaRad`. This is the analogue of
 * the Earth-rotation matrix coordToWorld would have to apply if the producer
 * had chosen the ECEF-rotating frame. The
 * `eci-km-no-earth-rotation-proxy` frame avoids this by design (OQ-2 / R1)
 * — `coordToWorld` is the identity for the trigger artifact. We use this
 * synthetic transform purely to demonstrate that lerping in raw coord space
 * then re-applying a per-sample transform diverges from the world-space lerp.
 */
function rotY(p: readonly [number, number, number], thetaRad: number): [number, number, number] {
  const c = Math.cos(thetaRad);
  const s = Math.sin(thetaRad);
  return [
    c * p[0] + s * p[2],
    p[1],
    -s * p[0] + c * p[2],
  ];
}

test('artifact has at least two timeline frames (required for interpolation)', () => {
  assert.ok(timesSec.length >= 2, `timeline has ${timesSec.length} frames; need >= 2`);
});

// Choose a handful of bracket indices that exercise different parts of the
// timeline.
const bracketSamples = [0, Math.floor(timesSec.length / 2) - 1, timesSec.length - 2];

for (const bracketIdx of bracketSamples) {
  if (bracketIdx < 0 || bracketIdx >= timesSec.length - 1) continue;
  const t0 = timesSec[bracketIdx];
  const t1 = timesSec[bracketIdx + 1];
  if (t0 === undefined || t1 === undefined) continue;
  const span = t1 - t0;

  for (const alpha of [0.25, 0.5, 0.75]) {
    const tSec = t0 + span * alpha;
    const f0 = showcaseArtifactToScene(artifact, bracketIdx);
    const f1 = showcaseArtifactToScene(artifact, bracketIdx + 1);
    const fInterp = showcaseArtifactToSceneInterpolated(artifact, tSec);

    test(
      `(A) sat worldPos linear in world space at bracket=${bracketIdx} alpha=${alpha}`,
      () => {
        assert.strictEqual(
          fInterp.satellites.length,
          f0.satellites.length,
          'satellite list length mismatch',
        );
        for (const sat of fInterp.satellites) {
          const sat0 = f0.satellites.find((s) => s.id === sat.id);
          const sat1 = f1.satellites.find((s) => s.id === sat.id);
          assert.ok(sat0 && sat1, `satellite ${sat.id} missing on a bracket frame`);
          const expected: readonly [number, number, number] = [
            lerp(sat0.worldPos[0], sat1.worldPos[0], alpha),
            lerp(sat0.worldPos[1], sat1.worldPos[1], alpha),
            lerp(sat0.worldPos[2], sat1.worldPos[2], alpha),
          ];
          for (let k = 0; k < 3; k++) {
            const diff = Math.abs(sat.worldPos[k] - expected[k]);
            assert.ok(
              diff < EPS_WORLD_KM,
              `sat ${sat.id} axis ${k} non-linear in world space: actual=${sat.worldPos[k]} expected=${expected[k]} diff=${diff}`,
            );
          }
        }
      },
    );

    test(
      `(A) UE worldPos linear in world space at bracket=${bracketIdx} alpha=${alpha}`,
      () => {
        for (const ue of fInterp.ues) {
          const ue0 = f0.ues.find((u) => u.id === ue.id);
          const ue1 = f1.ues.find((u) => u.id === ue.id);
          assert.ok(ue0 && ue1, `ue ${ue.id} missing on a bracket frame`);
          if (!ue0.worldPos || !ue1.worldPos || !ue.worldPos) continue;
          const expected: readonly [number, number, number] = [
            lerp(ue0.worldPos[0], ue1.worldPos[0], alpha),
            lerp(ue0.worldPos[1], ue1.worldPos[1], alpha),
            lerp(ue0.worldPos[2], ue1.worldPos[2], alpha),
          ];
          for (let k = 0; k < 3; k++) {
            const diff = Math.abs(ue.worldPos[k] - expected[k]);
            assert.ok(
              diff < EPS_WORLD_KM,
              `ue ${ue.id} axis ${k} non-linear in world space: actual=${ue.worldPos[k]} expected=${expected[k]} diff=${diff}`,
            );
          }
        }
      },
    );

    test(
      `(B) non-identity transform diverges from world-space lerp at bracket=${bracketIdx} alpha=${alpha}`,
      () => {
        // Simulate an Earth-rotation-style transform that varies between
        // bracket samples. The two strategies produce DIFFERENT results
        // unless the transform is constant — proving that the adapter's
        // choice to lerp in world space (post-coordToWorld) is load-bearing.
        //
        // theta0 = 0, theta1 = pi/6 (30°) — well outside numerical noise.
        const theta0 = 0;
        const theta1 = Math.PI / 6;
        const thetaAlpha = lerp(theta0, theta1, alpha);
        let maxResidual = 0;
        let observed = 0;
        for (const sat of fInterp.satellites) {
          const sat0 = f0.satellites.find((s) => s.id === sat.id);
          const sat1 = f1.satellites.find((s) => s.id === sat.id);
          if (!sat0 || !sat1) continue;
          // World-space lerp of the synthetic-transformed bracket positions.
          // This is the analogue of what the adapter actually computes: lerp
          // post-coordToWorld.
          const tp0 = rotY(sat0.worldPos, theta0);
          const tp1 = rotY(sat1.worldPos, theta1);
          const worldSpaceLerp: readonly [number, number, number] = [
            lerp(tp0[0], tp1[0], alpha),
            lerp(tp0[1], tp1[1], alpha),
            lerp(tp0[2], tp1[2], alpha),
          ];
          // Lerp the raw positions, then apply the synthetic transform at
          // theta_alpha. This is the analogue of what the FORBIDDEN path
          // would do: lerp positionEcefKm, then re-apply coordToWorld at the
          // interpolated time. (R1 forbids this because it would invent
          // geometry between samples for the ECI proxy.)
          const rawLerp: readonly [number, number, number] = [
            lerp(sat0.worldPos[0], sat1.worldPos[0], alpha),
            lerp(sat0.worldPos[1], sat1.worldPos[1], alpha),
            lerp(sat0.worldPos[2], sat1.worldPos[2], alpha),
          ];
          const rawLerpThenTransform = rotY(rawLerp, thetaAlpha);
          for (let k = 0; k < 3; k++) {
            const diff = Math.abs(worldSpaceLerp[k] - rawLerpThenTransform[k]);
            if (diff > maxResidual) maxResidual = diff;
          }
          observed++;
        }
        assert.ok(observed > 0, 'expected at least one satellite to compare');
        assert.ok(
          maxResidual > NONLINEAR_MIN_DELTA_WORLD,
          `synthetic transform did not produce a measurable divergence (max=${maxResidual}); test has no substance`,
        );
      },
    );

    test(
      `(C) every satellite sample declares the ECI proxy coord frame at bracket=${bracketIdx}`,
      () => {
        // R1 binding (SDD §10 OQ-2 closure): every satellite sample in the
        // bracket frames must declare `coordinateFrameKind =
        // 'eci-km-no-earth-rotation-proxy'`. The adapter's identity-mapping
        // coordToWorld is the only legitimate projection here, and the
        // world-space lerp preserves R1 by construction (no per-sample
        // Earth-rotation compensation is reintroduced).
        const frames = [artifact.timeline[bracketIdx], artifact.timeline[bracketIdx + 1]];
        for (const frame of frames) {
          assert.ok(frame, 'expected bracket frame to exist');
          for (const sat of frame.satellites) {
            assert.strictEqual(
              sat.coordinateFrameKind,
              'eci-km-no-earth-rotation-proxy',
              `sat ${sat.id} at tSec=${frame.tSec} carries coord frame ${sat.coordinateFrameKind}`,
            );
          }
        }
      },
    );

    test(
      `(D) intermediate tSec is preserved on the interpolated frame at bracket=${bracketIdx} alpha=${alpha}`,
      () => {
        assert.ok(
          Math.abs(fInterp.tSec - tSec) < 1e-9,
          `interpolated frame tSec=${fInterp.tSec} differs from request tSec=${tSec}`,
        );
      },
    );
  }
}

test('boundary: tSec === timesSec[i] returns the discrete frame', () => {
  for (const i of [0, Math.floor(timesSec.length / 2), timesSec.length - 1]) {
    const t = timesSec[i];
    if (t === undefined) continue;
    const fDiscrete = showcaseArtifactToScene(artifact, i);
    const fInterp = showcaseArtifactToSceneInterpolated(artifact, t);
    assert.strictEqual(
      fInterp.satellites.length,
      fDiscrete.satellites.length,
      `satellite length mismatch at boundary index ${i}`,
    );
    for (let k = 0; k < fInterp.satellites.length; k++) {
      const a = fInterp.satellites[k];
      const b = fDiscrete.satellites[k];
      if (!a || !b) continue;
      for (let axis = 0; axis < 3; axis++) {
        const diff = Math.abs(a.worldPos[axis] - b.worldPos[axis]);
        assert.ok(
          diff < EPS_WORLD_KM,
          `boundary index ${i} sat[${k}] axis ${axis} drift ${diff}`,
        );
      }
    }
  }
});

console.log('OK');
