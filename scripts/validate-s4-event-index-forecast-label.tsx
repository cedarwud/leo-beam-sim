/**
 * Consolidation S4-4 (Decision D4) — cinema event-index coarse-dt forecast label.
 *
 * The disease (s4-one-serving-truth-plan.md §1 problem 5 / §3 S4-4): the
 * sinrLiveCells handover event index is precomputed OFFLINE by re-running the sim
 * at a FIXED COARSE step (App passes simStepSec=30 s, App.tsx build site), while
 * the live scene advances at a finer variable per-frame dt (~16 ms). So a clicked
 * cinema marker is a coarse FORECAST of where a handover lands — not necessarily
 * the exact transition the live scene displayed — yet the cinema SINR explainer
 * disclosed nothing about it.
 *
 * The cut (Decision D4 = LABEL, not align — re-running at the live dt over the
 * 7200 s × 100-UE window is build-cost-prohibitive): the cinema SINR explainer
 * carries the canonical `EVENT_INDEX_COARSE_FORECAST_NOTE` whenever it renders a
 * cell-truth (sinrLiveCells) handover, so a clicked event is honestly a forecast.
 * This is a BEHAVIOR lock (governance-lock-strategy.md rule 3): it renders the
 * real `<SinrOffsetExplainer>` through the real cinema model and grounds the
 * "coarse offline cell scan" claim against the real index builder.
 *
 * Sections:
 *   V. VALUE / anti-launder — the canonical note names a forecast + the
 *      finer-live-rate contrast, so it cannot be laundered to a vacuous string.
 *   R. RENDER — the explainer shows the note for a cell-truth handover and does
 *      NOT show it for a non-cell-truth (steered/live-walker) handover (negative
 *      control + non-vacuity).
 *   I. INDEX GROUNDING — the real `buildSinrLiveCellHandoverEventIndex` is a
 *      coarse offline cell scan (records the passed coarse simStepSec + the
 *      additive sinrLiveCells trajectory path), so the disclosure is not a lie.
 *   D. Determinism — run-twice A==B on the rendered markup.
 *
 * Positive-control mutations (each must turn this gate RED):
 *   - drop the explainer forecast block / its sourceOwner gate                → R
 *   - blank / reword the note so it omits "forecast"                          → V
 *   - render the note for the steered (non-cell-truth) source too             → R (negative control)
 */
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { SinrOffsetExplainer } from '../src/ui/SinrOffsetExplainer.tsx';
import {
  buildCinemaCandidateDetail,
  type CinemaCandidateDetail,
} from '../src/app/handoverCinema.ts';
import { EVENT_INDEX_COARSE_FORECAST_NOTE } from '../src/scene/liveWalkerHandoverEventIndex.ts';
import type {
  LiveWalkerHandoverEvent,
  LiveWalkerHandoverEventIndex,
} from '../src/scene/liveWalkerHandoverEventIndex.ts';
import { buildSinrLiveCellHandoverEventIndex as buildCellIndex } from '../src/scene/sinrLiveCellHandoverEventIndex.ts';
import { loadProfile } from '../src/profiles/index.ts';

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

console.log('S4-4 (D4) cinema event-index coarse-dt forecast label\n');

// ── shared fixtures (mirror handoverCinema.test cell-truth shape) ───────────
function cellEvent(): LiveWalkerHandoverEvent {
  return {
    id: 'evt-cell-intra-1',
    sourceTimeSec: 123,
    kind: 'intra',
    fromSatId: 'SAT-2',
    fromBeamId: null,
    toSatId: 'SAT-2',
    toBeamId: null,
    ueId: 'live-ue-17',
    fromCellId: 8,
    toCellId: 11,
    fromBeamIdentity: 'SAT-2#cell8',
    toBeamIdentity: 'SAT-2#cell11',
    fromFrequencyIndex: 2,
    toFrequencyIndex: 5,
    fromOffAxisDeg: 1.25,
    toOffAxisDeg: 1.72,
    fromSinrDb: -4.2,
    toSinrDb: 1.6,
    deltaDb: 5.8,
    sourceStartSec: 113,
    sourceEndSec: 143,
    clickTargetSec: 123,
    primaryUeId: 'live-ue-0',
    count: 1,
  };
}

function steeredEvent(): LiveWalkerHandoverEvent {
  return {
    id: 'evt-inter-1',
    sourceTimeSec: 42,
    kind: 'inter',
    fromSatId: 'SAT-2',
    fromBeamId: 3,
    toSatId: 'SAT-5',
    toBeamId: 1,
    fromSinrDb: -4.2,
    toSinrDb: 1.6,
    deltaDb: 5.8,
    sourceStartSec: 32,
    sourceEndSec: 62,
    clickTargetSec: 42,
    primaryUeId: 'live-ue-0',
    count: 1,
  };
}

function cellIndex(events: LiveWalkerHandoverEvent[]): LiveWalkerHandoverEventIndex {
  return {
    sourceOwner: 'sinr-live-cell-truth',
    horizonKind: 'live-walker-window',
    claimKind: 'live-truth',
    durationSec: 7200,
    ueScope: 'cell-truth-ue-events',
    primaryUeId: 'live-ue-0',
    aggregateUeCount: 100,
    aggregateClaim: 'cell-truth-event-index',
    generation: {
      profileId: 'p',
      epochUtcMs: 0,
      simStepSec: 30,
      handoverPolicyKey: 'k',
      topologyKey: 't',
      runtimeFramePath: 'stepRuntimeFrame+sinrLiveCells',
    },
    offsetDb: 2,
    sourceGapReasons: [],
    events,
  };
}

function steeredIndex(events: LiveWalkerHandoverEvent[]): LiveWalkerHandoverEventIndex {
  return {
    sourceOwner: 'live-walker',
    horizonKind: 'live-walker-window',
    claimKind: 'profile-derived-forecast',
    durationSec: 7200,
    ueScope: 'primary-ue-only',
    primaryUeId: 'live-ue-0',
    aggregateUeCount: 1,
    aggregateClaim: 'not-100-ue-aggregate',
    generation: {
      profileId: 'p',
      epochUtcMs: 0,
      simStepSec: 1,
      handoverPolicyKey: 'k',
      topologyKey: 't',
      runtimeFramePath: 'stepRuntimeFrame',
    },
    offsetDb: 2,
    sourceGapReasons: [],
    events,
  };
}

function renderExplainer(detail: CinemaCandidateDetail | null): string {
  return renderToStaticMarkup(<SinrOffsetExplainer candidate={detail} visible />);
}

// ── V. VALUE / anti-launder ────────────────────────────────────────────────
console.log('V. canonical note value');
check('note declares a forecast', () => {
  assert.match(EVENT_INDEX_COARSE_FORECAST_NOTE, /forecast/i, 'must name it a forecast');
});
check('note contrasts the finer live frame rate', () => {
  assert.match(EVENT_INDEX_COARSE_FORECAST_NOTE, /(frame rate|frame dt|variable|live-displayed)/i, 'must contrast the live rate');
});
check('note is a non-trivial sentence', () => {
  assert.ok(EVENT_INDEX_COARSE_FORECAST_NOTE.trim().length >= 40, 'note must be a real sentence');
});

// ── R. RENDER (cell-truth shows the note; steered does NOT) ──────────────────
console.log('\nR. cinema explainer surfaces the forecast note for cell-truth events');
const cellDetail = buildCinemaCandidateDetail(cellIndex([cellEvent()]), 'evt-cell-intra-1', 'sinr-live');
const steeredDetail = buildCinemaCandidateDetail(steeredIndex([steeredEvent()]), 'evt-inter-1', 'sinr-live');
assert.ok(cellDetail !== null, 'precondition: cell-truth candidate detail resolves');
assert.ok(steeredDetail !== null, 'precondition: steered candidate detail resolves');
const cellMarkup = renderExplainer(cellDetail);
const steeredMarkup = renderExplainer(steeredDetail);

check('cell-truth explainer renders the coarse-forecast note', () => {
  assert.ok(cellMarkup.includes(EVENT_INDEX_COARSE_FORECAST_NOTE), 'cell-truth cinema must disclose the forecast');
});
check('cell-truth explainer exposes the forecast testid', () => {
  assert.ok(cellMarkup.includes('data-testid="sinr-explainer-forecast"'), 'forecast block must be addressable');
});
check('steered (non-cell-truth) explainer does NOT render the note (negative control)', () => {
  assert.ok(!steeredMarkup.includes(EVENT_INDEX_COARSE_FORECAST_NOTE), 'steered cinema must not carry the cell-truth forecast note');
  assert.ok(!steeredMarkup.includes('data-testid="sinr-explainer-forecast"'), 'steered cinema must not carry the forecast block');
});
check('the explainer still renders its core SINR content (non-vacuity)', () => {
  assert.ok(cellMarkup.includes('data-testid="handover-cinema-sinr-explainer"'), 'explainer still mounts');
  assert.ok(cellMarkup.includes('sinr-candidate-row'), 'explainer still shows candidate rows');
});

// ── I. INDEX GROUNDING (the real builder is a coarse offline cell scan) ──────
// Build once (ueCount:1) and reuse in I + O so we pay the offline scan once.
const builtCellIndex = buildCellIndex({
  profile: loadProfile('hobs-2024-candidate-rich'),
  epochUtcMs: 0,
  simStepSec: 30,
  ueCount: 1,
});
console.log('\nI. real index builder is a coarse offline cell scan');
check('buildSinrLiveCellHandoverEventIndex records the passed coarse step + cell trajectory path', () => {
  assert.equal(builtCellIndex.generation.simStepSec, 30, 'index re-runs at the coarse 30s step (≠ live frame dt)');
  assert.equal(builtCellIndex.generation.runtimeFramePath, 'stepRuntimeFrame+sinrLiveCells', 'index is the additive sinrLiveCells offline scan');
  assert.equal(builtCellIndex.sourceOwner, 'sinr-live-cell-truth', 'index is the cell-truth source');
});

// ── O. ORTHOGONAL AXES (claimKind = SOURCE truth; the note = TIMING fidelity) ─
// The cell-truth index keeps claimKind 'live-truth' BECAUSE the rendered SINR is
// leo's real cell-truth (verbatim from the engine), while the visible note above
// discloses only that marker TIMING is a coarse offline forecast. The two axes
// are independent (S4-4 D4 review). Pinning the real builder's claimKind here
// makes the design explicit + catches an accidental flip inside the D4 slice
// (a flip would falsely imply the SINR is a profile projection).
console.log('\nO. orthogonal axes: claimKind is the SOURCE axis, not the timing axis');
check('real cell-truth index keeps claimKind "live-truth" (source truth, not a profile forecast)', () => {
  assert.equal(builtCellIndex.claimKind, 'live-truth', 'cell-truth SINR is real leo truth; timing-forecast lives in the visible note, not claimKind');
});

// ── D. Determinism ─────────────────────────────────────────────────────────
console.log('\nD. determinism (run-twice A==B)');
check('explainer markup is deterministic', () => {
  assert.equal(renderExplainer(cellDetail), cellMarkup, 'cell-truth markup must be stable');
  assert.equal(renderExplainer(steeredDetail), steeredMarkup, 'steered markup must be stable');
});

if (failures > 0) {
  console.error(`\nFAIL: ${failures} check(s) failed.`);
  process.exit(1);
}
console.log('\nPASS: cinema event-index coarse-dt forecast label is present, behavior-gated, non-vacuous.');
