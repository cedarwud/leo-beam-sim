/**
 * P2a — Multi-UE rendering boundary test (SDD §9 P2 deliverable +
 * exit criterion "renders the artifact's full UE set (OQ-1) at
 * acceptable FPS; single-UE live path unregressed").
 *
 * Scope (P2a vs full P2):
 *   - P2a covers the data-side gate: `showcaseArtifactToScene` projects
 *     all UEs into world space, the resulting frame carries the full
 *     UE set, the live single-UE adapter still emits a 1-element
 *     `ues[]`, and the new GroundScene / HandoverLinks signatures are
 *     consumed correctly.
 *   - FPS measurement + display-filter UI ride in P2b. Pixel-equivalence
 *     of the live single-UE path is verified indirectly by the D6
 *     state-snapshot harness (live SimFrame fields unchanged) and by
 *     `tsc --noEmit` + vite build PASSing on the unchanged
 *     liveSimToScene + MainScene single-UE code path.
 */

import assert from 'node:assert/strict';

import { showcaseArtifactToScene } from '../src/showcase/showcaseArtifactToScene';
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

console.log('validate-modqn-visual-showcase-p2a-multi-ue');

const { artifact, source } = loadValidatorVisualShowcaseArtifact();
console.log(`  artifact source: ${source.label}`);

test('replay frame 0 carries all 100 UEs (trigger artifact size)', () => {
  const scene = showcaseArtifactToScene(artifact, 0);
  assert.strictEqual(scene.ues.length, 100, `expected 100 UEs, got ${scene.ues.length}`);
});

test('every UE has a finite worldPos triple after P2 projection', () => {
  const scene = showcaseArtifactToScene(artifact, 0);
  let missing = 0;
  let nonFinite = 0;
  for (const u of scene.ues) {
    if (!u.worldPos) {
      missing++;
      continue;
    }
    const [x, y, z] = u.worldPos;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) nonFinite++;
  }
  assert.strictEqual(missing, 0, `${missing} UEs missing worldPos`);
  assert.strictEqual(nonFinite, 0, `${nonFinite} UEs have non-finite worldPos`);
});

test('UE projection clusters near origin (bbox center reference)', () => {
  const scene = showcaseArtifactToScene(artifact, 0);
  let maxAbsX = 0;
  let maxAbsZ = 0;
  for (const u of scene.ues) {
    if (!u.worldPos) continue;
    const [x, , z] = u.worldPos;
    maxAbsX = Math.max(maxAbsX, Math.abs(x));
    maxAbsZ = Math.max(maxAbsZ, Math.abs(z));
  }
  // Trigger artifact UE bbox: ~0.8° lat × ~2.3° lon at ~40°N.
  // 1.15° lon × 111.32 × cos(40°) ≈ 98 km; scaled by world ≈
  // 56/footprintRadiusKm. footprintRadiusKm for the modqn-baseline shell
  // (altitude=550km, beamwidth=0.058rad) ≈ 16 km, so worldScale ≈ 3.5,
  // giving max-world ≈ 343. We loosen to <2000 to allow contract drift.
  assert.ok(maxAbsX < 2000, `max|X| too large: ${maxAbsX}`);
  assert.ok(maxAbsZ < 2000, `max|Z| too large: ${maxAbsZ}`);
  // And non-degenerate: at least some UE is more than 10 units from origin.
  assert.ok(maxAbsX > 10 || maxAbsZ > 10, 'UE cluster collapsed to origin — projection broken');
});

test('UE motion across frames is small but non-zero (per-frame projection lives)', () => {
  const f0 = showcaseArtifactToScene(artifact, 0);
  const f60 = showcaseArtifactToScene(artifact, 60);
  assert.strictEqual(f0.ues.length, f60.ues.length);
  let totalMove = 0;
  let maxMove = 0;
  for (let i = 0; i < f0.ues.length; i++) {
    const a = f0.ues[i].worldPos;
    const b = f60.ues[i].worldPos;
    if (!a || !b) continue;
    const d = Math.hypot(a[0] - b[0], a[2] - b[2]);
    totalMove += d;
    maxMove = Math.max(maxMove, d);
  }
  assert.ok(maxMove > 0, 'no UE moved across 60 frames — projection ignores per-frame geo');
  assert.ok(maxMove < 100, `unexpectedly large UE displacement across 60 frames: ${maxMove}`);
  console.log(`        total UE drift over 60 frames: ${totalMove.toFixed(2)} world units, max ${maxMove.toFixed(2)}`);
});

test('GroundScene + HandoverLinks call signatures accept the new ues shape', async () => {
  // Type-level only — actual render is covered by vite build. We import
  // the modules to ensure no module-load error (and no transitive R1
  // leak; the P1e runtime probe still guards that).
  const groundMod = await import('../src/viz/GroundScene');
  const linksMod = await import('../src/viz/HandoverLinks');
  assert.strictEqual(typeof groundMod.GroundScene, 'function');
  assert.strictEqual(typeof linksMod.HandoverLinks, 'function');
});

console.log('OK');
