/**
 * P1e (d) — D8 forbidden-claim enforcement test (SDD §4 D8 + §9 P1
 * exit criterion (d) + §11 governance / claim boundary).
 *
 * Mode (per SDD §4 D8 closing rule):
 *   The ntn-sim-core validator at
 *   `npm run validate:visual-showcase:artifact` only checks schema
 *   shape — it does NOT detect a banner / storyKind / notes string that
 *   semantically contradicts the claim allow-list. We therefore operate
 *   in **"renderer rejects banner render but allows the rest of the
 *   frame"** mode: the artifact still loads (`loadShowcaseArtifact` +
 *   ntn-sim-core validator both PASS), but
 *   `decideClaimBoundaryBanner` returns `{ kind: 'blocked' }` and the
 *   React component renders the suppression notice.
 *
 *   This is the documented mode for the P1 commit per SDD line 502-507.
 *
 * Coverage:
 *   1. Real trigger artifact (`phase-01h-mp5-visual-showcase-cli-smoke-
 *      2026-05-22/visual-showcase-v1.json`) → banner renders the
 *      producer-allowed title.
 *   2. Synthetic: empty `allowedClaims` → fallback.
 *   3. Synthetic: title in BOTH allowedClaims and forbiddenClaims →
 *      blocked.
 *   4. Synthetic: evidenceStatus.notes includes a phrase from
 *      forbiddenClaims → blocked.
 *   5. ntn-sim-core validator must still PASS the synthetic in (3) and
 *      (4) — the test is meaningful only if the renderer is the gate,
 *      not the validator.
 */

import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { loadShowcaseArtifact } from '../src/showcase/loadShowcaseArtifact';
import { showcaseArtifactToScene } from '../src/showcase/showcaseArtifactToScene';
import { decideClaimBoundaryBanner } from '../src/ui/ClaimBoundaryBanner';
import { loadValidatorVisualShowcaseArtifact } from './visualShowcaseValidatorFixture';
import { skipIfDataUnavailable } from './lib/ci-data-guard';

const NTN_SIM_CORE_DIR = '/home/u24/papers/ntn-sim-core';

// CI-environment guard (P2 SN-3c): this validator spawns ntn-sim-core's
// validate:visual-showcase:artifact oracle inside the read-only sibling checkout.
// Skip (visibly, exit 0 + marker) when that checkout is absent — the hosted-CI
// signature. See scripts/lib/ci-data-guard.ts for the SKIP semantics.
skipIfDataUnavailable([{
  path: `${NTN_SIM_CORE_DIR}/package.json`,
  why: 'ntn-sim-core sibling checkout — spawns its validate:visual-showcase:artifact oracle against synthetic artifacts',
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

function runNtnValidator(jsonPath: string): { ok: boolean; output: string } {
  const r = spawnSync(
    'npm',
    ['run', '--silent', 'validate:visual-showcase:artifact', '--', jsonPath],
    { cwd: NTN_SIM_CORE_DIR, encoding: 'utf8' },
  );
  return {
    ok: r.status === 0,
    output: (r.stdout ?? '') + (r.stderr ?? ''),
  };
}

function withSyntheticArtifact<T>(
  baseRawText: string,
  mutate: (root: Record<string, unknown>) => void,
  fn: (jsonPath: string) => T,
): T {
  const tmp = mkdtempSync(path.join(tmpdir(), 'p1e-d8-'));
  try {
    const obj = JSON.parse(baseRawText) as Record<string, unknown>;
    mutate(obj);
    const outPath = path.join(tmp, 'synthetic.visual-showcase-v1.json');
    writeFileSync(outPath, JSON.stringify(obj));
    return fn(outPath);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

console.log('validate-modqn-visual-showcase-p1e-d8-forbidden-claim');
const { rawText: triggerRaw, source } = loadValidatorVisualShowcaseArtifact();
console.log(`  artifact source: ${source.label}`);

// ---- Case 1: trigger artifact → rendered ----

test('trigger artifact: banner decision = rendered with producer title', () => {
  const artifact = loadShowcaseArtifact(JSON.parse(triggerRaw));
  const scene = showcaseArtifactToScene(artifact, 0);
  const decision = decideClaimBoundaryBanner(scene);
  if (decision.kind !== 'rendered') {
    throw new Error(`expected rendered, got ${decision.kind}: ${JSON.stringify(decision)}`);
  }
  assert.strictEqual(decision.title, 'baseline MODQN multi-UE replay artifact');
  assert.strictEqual(decision.storyKind, 'modqn-handover-baseline');
  assert.strictEqual(decision.evidenceStatus, 'baseline');
  assert.ok(decision.subtitle.includes('evidence: baseline'));
});

// ---- Case 2: empty allowedClaims → fallback ----

test('synthetic: empty allowedClaims → banner = fallback', () => {
  withSyntheticArtifact(
    triggerRaw,
    (obj) => {
      const provenance = obj.provenance as { claimBoundary: { allowedClaims: string[] } };
      provenance.claimBoundary.allowedClaims = [];
    },
    (jsonPath) => {
      // ntn-sim-core validator may or may not accept empty list; we still
      // pump through our loader (which checks schema shape only).
      const artifact = loadShowcaseArtifact(JSON.parse(readFileSync(jsonPath, 'utf8')));
      const scene = showcaseArtifactToScene(artifact, 0);
      const decision = decideClaimBoundaryBanner(scene);
      assert.strictEqual(decision.kind, 'fallback');
    },
  );
});

// ---- Case 3: title overlaps forbiddenClaims → blocked ----

test('synthetic: allowedClaims[0] also in forbiddenClaims → banner = blocked', () => {
  withSyntheticArtifact(
    triggerRaw,
    (obj) => {
      const provenance = obj.provenance as {
        claimBoundary: { allowedClaims: string[]; forbiddenClaims: string[] };
      };
      // Inject overlap: the producer-listed primary claim is now also
      // listed as forbidden. This is a producer-side contradiction that
      // ntn-sim-core's schema check does not catch.
      provenance.claimBoundary.forbiddenClaims = [
        provenance.claimBoundary.allowedClaims[0],
        ...provenance.claimBoundary.forbiddenClaims,
      ];
    },
    (jsonPath) => {
      // (i) ntn-sim-core validator must still pass — D8's whole point is
      // that the renderer is the final gate.
      const v = runNtnValidator(jsonPath);
      assert.ok(
        v.ok,
        `ntn-sim-core validator unexpectedly rejected synthetic-case-3:\n${v.output}`,
      );
      // (ii) Renderer's decision must be `blocked`.
      const artifact = loadShowcaseArtifact(JSON.parse(readFileSync(jsonPath, 'utf8')));
      const scene = showcaseArtifactToScene(artifact, 0);
      const decision = decideClaimBoundaryBanner(scene);
      if (decision.kind !== 'blocked') {
        throw new Error(`expected blocked, got ${decision.kind}: ${JSON.stringify(decision)}`);
      }
      assert.ok(decision.reasons.length > 0);
      assert.ok(
        decision.reasons.some((r) => r.includes('forbiddenClaims')),
        `expected reason to mention forbiddenClaims, got ${JSON.stringify(decision.reasons)}`,
      );
    },
  );
});

// ---- Case 4: notes contain a forbidden phrase → blocked ----

test('synthetic: evidenceStatus.notes contains a forbidden phrase → banner = blocked', () => {
  withSyntheticArtifact(
    triggerRaw,
    (obj) => {
      const provenance = obj.provenance as {
        claimBoundary: { forbiddenClaims: string[] };
        evidenceStatus: { notes: string[] };
      };
      // Inject the literal forbidden phrase verbatim into a note. The
      // producer's first forbidden entry is "Multi-Catfish not promoted";
      // we splice that exact text into a note. Real-world this is the
      // failure mode where a producer marketing-leak slips through.
      const phrase = provenance.claimBoundary.forbiddenClaims[0];
      provenance.evidenceStatus.notes = [
        ...provenance.evidenceStatus.notes,
        `Surprise note containing "${phrase}" verbatim.`,
      ];
    },
    (jsonPath) => {
      const v = runNtnValidator(jsonPath);
      assert.ok(
        v.ok,
        `ntn-sim-core validator unexpectedly rejected synthetic-case-4:\n${v.output}`,
      );
      const artifact = loadShowcaseArtifact(JSON.parse(readFileSync(jsonPath, 'utf8')));
      const scene = showcaseArtifactToScene(artifact, 0);
      const decision = decideClaimBoundaryBanner(scene);
      if (decision.kind !== 'blocked') {
        throw new Error(`expected blocked, got ${decision.kind}: ${JSON.stringify(decision)}`);
      }
      assert.ok(
        decision.reasons.some((r) => r.includes('forbidden phrase')),
        `expected forbidden-phrase reason, got ${JSON.stringify(decision.reasons)}`,
      );
    },
  );
});

console.log('OK');
