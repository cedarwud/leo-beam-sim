#!/usr/bin/env node
/**
 * check:acceptance -- the five sentences, asserted outside any component test.
 *
 * SDD §7 defines this refactor as done when a cheap model handles the owner's
 * five real requests in one shot, or fails with a clear red signal. Each
 * sentence had a guard. Every guard lived in the test file beside the code it
 * guarded, and that is not enough -- measured three times, on three different
 * invariants, by three runs of the actual experiment:
 *
 *   - EE threshold 135: SURVIVED. Pinned as a literal in eeCommitPermit.test.ts
 *     AND in scripts/check-handover.ts. The model updated both and the red came
 *     from real behaviour it had not considered.
 *   - Cone alpha ladder: FELL. One pin, in the file being edited, and derived
 *     from the constants it guarded. The model changed 0.8 to 0.5 and rewrote
 *     the assertion. Second pin added; the same request then went red.
 *   - "All seven beams reach the rail": FELL. One pin, in the rail's own test.
 *     Told to hide idle beams, the model added the filter, hit this assertion,
 *     changed the expected count from 7 to 2, deleted the idle assertion, and
 *     reported success. Its own summary said so plainly.
 *
 * The pattern is not "add another assertion". It is that an acceptance sentence
 * needs a statement of what it means that does NOT sit in the file a request
 * will send someone to edit. That is what this file is. It is deliberately dull:
 * it drives the real components and asserts the sentence, nothing else.
 *
 * Honest limit, stated because the alternative is pretending: nothing here stops
 * someone editing THIS file too. Two files make it a deliberate act instead of
 * an accident, and a deliberate act is reviewable. That is the whole claim.
 *
 * Run: npm run check:acceptance
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { DEFAULT_EE_THRESHOLD_KBIT_PER_JOULE } from '../src/engine/handover/eeThreshold.ts';
import { mintMeasuredEePermit } from '../src/engine/handover/eeCommitPermit.ts';
import { resolveHomepageBeamBudgets } from '../src/scene/sinrLiveBeamBudget.ts';
import { homepageSatelliteColorForBeam } from '../src/homepage/controller/homepageSatelliteVisualIdentity.ts';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
function repoFile(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

let passed = 0;
function check(sentence: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${sentence}`);
}

// ── Sentence 1 — EE 低於閾值才觸發換手 ───────────────────────────────────────
check('1. a link at or above the EE floor may not hand over', () => {
  const threshold = DEFAULT_EE_THRESHOLD_KBIT_PER_JOULE * 1000;
  assert.equal(
    mintMeasuredEePermit({
      path: 'live-cell:ee-optimization',
      servingEeBitsPerJoule: threshold,
      targetEeBitsPerJoule: threshold * 2,
      thresholdBitsPerJoule: threshold,
    }),
    null,
    'a serving link exactly at the floor is still healthy',
  );
  assert.notEqual(
    mintMeasuredEePermit({
      path: 'live-cell:ee-optimization',
      servingEeBitsPerJoule: threshold - 1,
      targetEeBitsPerJoule: threshold * 2,
      thresholdBitsPerJoule: threshold,
    }),
    null,
    'one bit/J below the floor must be replaceable, or the rule is unreachable',
  );
});

// ── Sentence 2 — 右欄顯示服務衛星的全部七條波束 ──────────────────────────────
check('2. the rail does not drop configured beams by availability', () => {
  // Stated as a structural claim rather than a render, on purpose. Duplicating
  // the rail's render fixture here would duplicate the thing being guarded; what
  // needs to live in a second file is the RULE, and the rule is narrow: the rail
  // is a projection of the roster, so it must not decide which configured beams
  // exist. `beamMetrics.ts` completes a sparse roster to the configured budget
  // precisely so the rail shows every configured row, and those rows are `idle`.
  //
  // The measured edit was `.filter(metric => ... && metric.availability !== 'idle')`,
  // twice, in HomepageBeamRail.tsx. Variants ('available', a status allowlist)
  // are the same act, so this matches any availability test inside a filter.
  const rail = repoFile('src/ui/homepage/HomepageBeamRail.tsx');
  const filters = rail.match(/\.filter\(([^)]|\)(?!\s*[;,)]))*\)/g) ?? [];
  const droppers = filters.filter(f => /\bavailability\b/.test(f));
  assert.deepEqual(
    droppers,
    [],
    'HomepageBeamRail filters rows on `availability`, so a configured beam with no measurement '
    + 'this frame never reaches the rail. That is acceptance sentence 2 -- 右欄顯示服務衛星的全部'
    + '七條波束 -- failing, because with a sparse source frame most of the seven ARE the '
    + 'unmeasured ones. Hiding them may well be what the owner wants; it is a product decision '
    + 'about the roster, so make it in beamMetrics.ts where the roster is built, and change this '
    + `line deliberately. Found: ${droppers.join(' | ')}`,
  );

  // The other half: the roster really does synthesise those rows, so the rule
  // above is protecting something that exists.
  const metrics = repoFile('src/homepage/controller/beamMetrics.ts');
  assert.match(
    metrics,
    /the one-based roster when the source map is sparse/,
    'beamMetrics no longer documents completing a sparse roster; if that behaviour went away, '
    + 'sentence 2 means something different now and this oracle is stale.',
  );
});

// ── Sentence 3 — 波束顏色隨 EE 由淡到濃 ──────────────────────────────────────
check('3. a stronger EE renders as a deeper beam colour', () => {
  const faint = homepageSatelliteColorForBeam('shell-pro-42-P21-S1', 0, { isServing: true, eeNormalized: 0.05 });
  const strong = homepageSatelliteColorForBeam('shell-pro-42-P21-S1', 0, { isServing: true, eeNormalized: 0.95 });
  assert.ok(strong.lightness < faint.lightness, 'higher EE must be deeper, not paler');
  assert.ok(strong.saturation > faint.saturation, 'higher EE must be more saturated');
  assert.notEqual(strong.color, faint.color, 'the gradient must be visible, not rounded away');
  assert.equal(strong.hueDegrees, faint.hueDegrees, 'EE changes intensity, never satellite identity');
});

// ── Beam budget — the seam sentence 2 depends on ─────────────────────────────
check('the serving and candidate beam budgets do not cross', () => {
  const budgets = resolveHomepageBeamBudgets({
    servingBeamCount: 7,
    candidateBeamCount: 19,
    profileBeamsPerSatellite: 7,
  });
  assert.equal(budgets.servingBeamCount, 7);
  assert.equal(budgets.candidateBeamCount, 19);
});

console.log(`\ncheck:acceptance: ${passed} sentences held.`);
