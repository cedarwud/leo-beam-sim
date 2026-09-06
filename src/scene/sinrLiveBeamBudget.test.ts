import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SINR_LIVE_FOCUSED_CELL_PHYSICAL_BEAM_COUNT,
  resolveHomepageBeamBudgets,
  resolveSinrLiveBeamBudget,
} from './sinrLiveBeamBudget';

assert.equal(
  resolveSinrLiveBeamBudget({
    fallbackBeamCount: 7,
    satelliteId: 'sat-serving',
    roleBeamCount: 1,
    beamCountBySatellite: { 'sat-serving': 19 },
  }),
  1,
  'a serving-role override wins over a per-satellite override',
);
assert.equal(
  resolveSinrLiveBeamBudget({
    fallbackBeamCount: 7,
    satelliteId: 'sat-candidate',
    beamCountBySatellite: { 'sat-candidate': 19 },
  }),
  19,
  'a per-satellite override wins over the global fallback',
);
assert.equal(
  resolveSinrLiveBeamBudget({ fallbackBeamCount: 7, satelliteId: 'sat-other' }),
  7,
  'the global fallback remains the final source',
);

console.log('sinrLiveBeamBudget.test.ts: PASS');

// ---------------------------------------------------------------------------
// The homepage budget seam.
//
// `beamMetrics.test.ts` proves a 7/19 input produces 7/19 rows.
// `HomepageBeamRail.test.tsx` proves a 7/19 projection renders 26 rows. Neither
// proves the publisher passes the serving budget as the serving budget: that
// line had no test, and crossing the two roles left every suite green. Three of
// the eight regressions in `6b9474e` had exactly this shape.
// ---------------------------------------------------------------------------
test('the homepage budgets keep serving and candidate on their own roles', () => {
  const budgets = resolveHomepageBeamBudgets({
    servingBeamCount: 7,
    candidateBeamCount: 19,
    profileBeamsPerSatellite: 7,
  });
  assert.equal(budgets.servingBeamCount, 7);
  assert.equal(budgets.candidateBeamCount, 19);
  assert.equal(budgets.physicalServingBeamCount, 7);
  assert.equal(budgets.physicalCandidateBeamCount, 19);
  // Asymmetric on purpose: with 7/7 a crossed wire is invisible.
  assert.notEqual(budgets.servingBeamCount, budgets.candidateBeamCount);
});

test('each role falls back to the profile layout independently of the other', () => {
  const servingOnly = resolveHomepageBeamBudgets({
    servingBeamCount: 19,
    candidateBeamCount: undefined,
    profileBeamsPerSatellite: 7,
  });
  assert.equal(servingOnly.servingBeamCount, 19, 'an explicit serving budget is not overwritten');
  assert.equal(servingOnly.candidateBeamCount, 7, 'the absent candidate budget takes the profile layout');

  const candidateOnly = resolveHomepageBeamBudgets({
    servingBeamCount: undefined,
    candidateBeamCount: 19,
    profileBeamsPerSatellite: 7,
  });
  assert.equal(candidateOnly.servingBeamCount, 7);
  assert.equal(candidateOnly.candidateBeamCount, 19);

  const neither = resolveHomepageBeamBudgets({ profileBeamsPerSatellite: 7 });
  assert.equal(neither.servingBeamCount, 7);
  assert.equal(neither.candidateBeamCount, 7);
  assert.equal(neither.physicalServingBeamCount, 7);
  assert.equal(neither.physicalCandidateBeamCount, 7);
});

test('a focused-cell role of 1 keeps the physical seven-beam layout, per role', () => {
  const focusedServing = resolveHomepageBeamBudgets({
    servingBeamCount: 1,
    candidateBeamCount: 19,
    profileBeamsPerSatellite: 7,
  });
  // The role budget stays 1 -- one focused geographic cell -- while the
  // physical budget stays at the shipped layout so the model can still evaluate
  // B1..B7 on that cell. Losing this pairing is what makes "the rail shows one
  // beam" and "the model sees one beam" get confused for each other.
  assert.equal(focusedServing.servingBeamCount, 1);
  assert.equal(focusedServing.physicalServingBeamCount, SINR_LIVE_FOCUSED_CELL_PHYSICAL_BEAM_COUNT);
  assert.equal(focusedServing.candidateBeamCount, 19);
  assert.equal(focusedServing.physicalCandidateBeamCount, 19);

  const focusedCandidate = resolveHomepageBeamBudgets({
    servingBeamCount: 19,
    candidateBeamCount: 1,
    profileBeamsPerSatellite: 7,
  });
  assert.equal(focusedCandidate.candidateBeamCount, 1);
  assert.equal(focusedCandidate.physicalCandidateBeamCount, SINR_LIVE_FOCUSED_CELL_PHYSICAL_BEAM_COUNT);
  assert.equal(focusedCandidate.physicalServingBeamCount, 19);
});

test('an unusable role budget still resolves to the profile layout, not to nothing', () => {
  // `buildHomepageBeamMetrics` now throws on an unresolvable budget. That is
  // the right behaviour for corrupt data, but it must not fire for values this
  // resolver is supposed to normalise, or the homepage crashes on a 0.
  for (const unusable of [0, -4, Number.NaN]) {
    const budgets = resolveHomepageBeamBudgets({
      servingBeamCount: unusable,
      candidateBeamCount: 7,
      profileBeamsPerSatellite: 7,
    });
    assert.ok(
      budgets.physicalServingBeamCount >= 1,
      `a serving role value of ${String(unusable)} must still yield a usable physical budget`,
    );
  }
});
