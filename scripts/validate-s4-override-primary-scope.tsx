/**
 * Consolidation S4-4 (Decision D3) — decision/ω override primary-only honest label.
 *
 * The disease (s4-one-serving-truth-plan.md §1 problem 5 / §3 S4-4): the ω /
 * decision override is installed ONLY on the primary UE's HandoverManager
 * (`useSimulation` `hoManager`, 1 of N UEs). The secondary UE population and the
 * earth-fixed cell managers take no override parameter — they follow live
 * SINR-offset. But the override-mode disclosure copy (the heuristic banner + the
 * InfoPanel decision-overlay copy) did NOT say so, so the live-cell-preview demo
 * could read as if the override drove the whole served population.
 *
 * The cut (Decision D3 = LABEL, not extend): every override-mode disclosure
 * carries the canonical `OVERRIDE_PRIMARY_UE_SCOPE_NOTE` (primary-UE-only scope;
 * the rest follow live SINR-offset). The SDD §4.4 banner headline stays exact
 * (it is exact-equality-locked); the scope note is an ADDITIVE second banner
 * line + an appended clause on the InfoPanel override-mode `duelDetail`. This is
 * a BEHAVIOR lock (governance-lock-strategy.md rule 3): it calls the real copy
 * resolver and renders the real banner — no source-text pin.
 *
 * Sections:
 *   V. VALUE / anti-launder — the canonical note names the primary UE and the
 *      SINR-offset fallback, so it cannot be laundered to a vacuous/wrong string.
 *   C. COPY behavior — both override modes' duelDetail carry the note; the
 *      default `sinr-offset` mode does NOT (positive control + non-vacuity).
 *   B. BANNER render — the rendered banner carries BOTH the SDD headline and the
 *      scope note (the additive second line).
 *   D. Determinism — run-twice A==B on the copy resolver + banner markup.
 *
 * Positive-control mutations (each must turn this gate RED):
 *   - drop `${OVERRIDE_PRIMARY_UE_SCOPE_NOTE}` from a duelDetail            → C
 *   - add the note to the `sinr-offset` duelDetail                          → C
 *   - blank / reword the note so it omits "primary UE"                      → V
 *   - delete the banner scope line                                         → B
 */
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { getLiveStatusModeCopy } from '../src/ui/InfoPanel.tsx';
import {
  HeuristicNotPaperBanner,
  HEURISTIC_NOT_PAPER_BANNER_TEXT,
} from '../src/ui/HeuristicNotPaperBanner.tsx';
import { OVERRIDE_PRIMARY_UE_SCOPE_NOTE } from '../src/modqn/runtimeControls.ts';

let failures = 0;
function check(label: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓ ${label}`);
  } catch (err) {
    failures += 1;
    console.error(`  ✗ ${label}`);
    console.error(`      ${err instanceof Error ? err.message : String(err)}`);
  }
}

console.log('S4-4 (D3) override primary-only honest label\n');

// ── V. VALUE / anti-launder ────────────────────────────────────────────────
console.log('V. canonical note value');
check('note names the PRIMARY UE scope', () => {
  assert.match(OVERRIDE_PRIMARY_UE_SCOPE_NOTE, /primary UE/i, 'must name the primary UE');
});
check('note names the live SINR-offset fallback for the rest', () => {
  assert.match(OVERRIDE_PRIMARY_UE_SCOPE_NOTE, /SINR-offset/i, 'must name the SINR-offset fallback');
});
check('note is a non-trivial sentence', () => {
  assert.ok(OVERRIDE_PRIMARY_UE_SCOPE_NOTE.trim().length >= 30, 'note must be a real sentence');
});

// ── C. COPY behavior ───────────────────────────────────────────────────────
console.log('\nC. InfoPanel override-mode copy carries the scope note');
const overlay = getLiveStatusModeCopy('decision-overlay-on-live-sinr');
const heuristic = getLiveStatusModeCopy('omega-heuristic');
const sinrOffset = getLiveStatusModeCopy('sinr-offset');

check('decision-overlay duelDetail includes the primary-only note', () => {
  assert.ok(
    overlay.duelDetail.includes(OVERRIDE_PRIMARY_UE_SCOPE_NOTE),
    'decision-overlay copy must disclose the primary-only override scope',
  );
});
check('omega-heuristic duelDetail includes the primary-only note', () => {
  assert.ok(
    heuristic.duelDetail.includes(OVERRIDE_PRIMARY_UE_SCOPE_NOTE),
    'omega-heuristic copy must disclose the primary-only override scope',
  );
});
check('default sinr-offset duelDetail does NOT include the note (no override installed)', () => {
  assert.ok(
    !sinrOffset.duelDetail.includes(OVERRIDE_PRIMARY_UE_SCOPE_NOTE),
    'sinr-offset is not an override mode — it must not carry the override scope note',
  );
});
check('the two override duelDetails still keep their own mode description', () => {
  // Non-vacuity: the note is appended, not replacing the existing copy.
  assert.ok(overlay.duelDetail.includes('MODQN replay decision overlay'), 'overlay keeps its description');
  assert.ok(heuristic.duelDetail.includes('omega weighted heuristic policy'), 'heuristic keeps its description');
});

// ── B. BANNER render ───────────────────────────────────────────────────────
console.log('\nB. heuristic banner renders headline + scope note');
const bannerMarkup = renderToStaticMarkup(<HeuristicNotPaperBanner />);
check('banner renders the SDD §4.4 headline (unchanged)', () => {
  assert.ok(bannerMarkup.includes(HEURISTIC_NOT_PAPER_BANNER_TEXT), 'SDD headline must still render');
});
check('banner renders the additive primary-only scope line', () => {
  assert.ok(bannerMarkup.includes(OVERRIDE_PRIMARY_UE_SCOPE_NOTE), 'scope note must render in the banner');
});
check('banner exposes the scope-line testid', () => {
  assert.ok(
    bannerMarkup.includes('data-testid="heuristic-not-paper-banner-scope"'),
    'scope line must be addressable for the browser layer',
  );
});

// ── D. Determinism ─────────────────────────────────────────────────────────
console.log('\nD. determinism (run-twice A==B)');
check('copy resolver is deterministic', () => {
  assert.equal(
    getLiveStatusModeCopy('decision-overlay-on-live-sinr').duelDetail,
    overlay.duelDetail,
    'overlay copy must be stable across calls',
  );
  assert.equal(
    getLiveStatusModeCopy('omega-heuristic').duelDetail,
    heuristic.duelDetail,
    'heuristic copy must be stable across calls',
  );
});
check('banner markup is deterministic', () => {
  assert.equal(renderToStaticMarkup(<HeuristicNotPaperBanner />), bannerMarkup, 'banner markup must be stable');
});

if (failures > 0) {
  console.error(`\nFAIL: ${failures} check(s) failed.`);
  process.exit(1);
}
console.log('\nPASS: override primary-only honest label is present, behavior-gated, non-vacuous.');
