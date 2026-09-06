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
import {
  createHomepageHandoverJumpIntent,
  resolveHomepageHandoverJumpIntent,
} from '../src/homepage/controller/handoverJumpIntent.ts';
import { HANDOVER_COMMIT_PATH_ACTIONS } from '../src/engine/handover/commitProvenance.ts';

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

// ── Sentence 4 — 服務波束不會永遠是 B1 ───────────────────────────────────────
check('4. the serving beam can move within a satellite, and the proof of it still runs', () => {
  // Stated honestly: this sentence is BEHAVIOURAL -- it needs a scenario in
  // which the serving beam actually moves -- and that scenario lives in
  // `src/scene/sinrLiveCellIntraDecision.test.ts` ("one-cell layout commits a
  // real same-satellite same-cell intra handover"). Restating it here would
  // mean duplicating that model harness, which duplicates the thing being
  // guarded. So this check does two cheaper things it can actually do.
  //
  // First: the ability for the serving beam to move within one satellite is
  // still modelled at all. If no commit path may produce an intra-switch, the
  // serving beam is structurally pinned and no scenario could show otherwise.
  const intraCapablePaths = Object.entries(HANDOVER_COMMIT_PATH_ACTIONS)
    .filter(([, actions]) => actions.includes('intra-switch'))
    .map(([path]) => path);
  assert.ok(
    intraCapablePaths.length >= 1,
    'no commit path may produce an intra-switch, so the serving beam cannot move within a '
    + 'satellite at all. That is this sentence failing at the level of what the model can express.',
  );

  // Second: the behavioural proof is still WIRED. 97 of this repo's test files
  // were once run by nothing, so "the scenario exists" and "the scenario runs"
  // are different claims -- this asserts the second one for a specific,
  // load-bearing proof rather than trusting that it is still in the gate.
  const pkg = JSON.parse(repoFile('package.json')) as { scripts?: Record<string, string> };
  assert.match(
    pkg.scripts?.['check:baseline'] ?? '',
    /sinrLiveCellIntraDecision\.test\.ts/,
    'the scenario that proves the serving beam moves is no longer in check:baseline. '
    + 'The proof may still exist; nothing runs it, which is the same as not having it.',
  );
});

// ── Sentence 5 — 按 Intra 只出現 intra ───────────────────────────────────────
check('5. an intra request never resolves an inter event', () => {
  // `resolveHomepageHandoverJumpIntent` refuses a matching event whose kind
  // differs from the requested kind. The existing test asserts only the
  // MATCHING direction (an inter intent resolving an inter event), so the
  // refusal -- which is the whole sentence -- had no test at all.
  const interEvent = { id: 'evt-inter-1', kind: 'inter' } as never;
  const intraEvent = { id: 'evt-intra-1', kind: 'intra' } as never;

  assert.equal(
    resolveHomepageHandoverJumpIntent(
      createHomepageHandoverJumpIntent('intra'),
      { indexBuilding: false, matchingEvent: interEvent },
    ),
    null,
    'pressing Intra must not resolve an inter event -- this is the sentence, stated directly',
  );
  assert.equal(
    resolveHomepageHandoverJumpIntent(
      createHomepageHandoverJumpIntent('inter'),
      { indexBuilding: false, matchingEvent: intraEvent },
    ),
    null,
    'the refusal must hold in both directions, or it is a coincidence of one fixture',
  );

  // The positive direction, so a resolver that refuses everything cannot pass.
  const accepted = resolveHomepageHandoverJumpIntent(
    createHomepageHandoverJumpIntent('intra'),
    { indexBuilding: false, matchingEvent: intraEvent },
  );
  assert.equal(accepted?.kind, 'intra', 'a matching intra event must still resolve');
  assert.equal(accepted?.eventId, 'evt-intra-1');

  // While the index is building there is no answer yet, so there must be no
  // guess: a stale event shown during a rebuild is an inter event intruding.
  assert.equal(
    resolveHomepageHandoverJumpIntent(
      createHomepageHandoverJumpIntent('intra'),
      { indexBuilding: true, matchingEvent: intraEvent },
    ),
    null,
    'no selection may be resolved while the event index is still building',
  );
});

// ── Anti-dilution ────────────────────────────────────────────────────────────
// Measured: told 「換手事件列表好像漏掉了一些事件」, a cheap model changed no
// production code at all. It read this file, decided the SENTENCE LIST was what
// was incomplete, and added two checks -- for sentence 4, that two satellites
// get different colours; for sentence 5, that an event-kind enum has three
// members. Neither has anything to do with the sentence above it. Both pass
// trivially. It then reported "6 個檢查全部通過 ✓".
//
// That is the original problem statement verbatim: change nothing, report
// success. Here it did it to the oracle itself, which is worse than breaking
// production -- the run would print that five sentences held while two of the
// claims were empty.
//
// A count cannot tell a real check from a hollow one. What it can do is make
// adding one a deliberate edit of a literal, in the same commit, visible in
// review. That is the same claim this whole file makes and no larger.
const EXPECTED_CHECKS = 6;
assert.equal(
  passed,
  EXPECTED_CHECKS,
  `expected ${EXPECTED_CHECKS} acceptance checks, ran ${passed}. Adding one is fine -- adding one `
  + 'without saying so is how this file stops meaning anything. Every check here must be able to '
  + 'fail: prove it by breaking the production code it covers before you commit it.',
);

console.log(`\ncheck:acceptance: ${passed} sentences held.`);
