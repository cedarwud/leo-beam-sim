#!/usr/bin/env node

/**
 * Repeatable source-side alignment gate for homepage `/`.
 *
 * This command joins the real cell-truth event index with the existing
 * multi-candidate decision diagnostic. It never creates a target or a second
 * clock. The event index supplies the natural Intra -> Inter window; the
 * diagnostic supplies the selected decision witnesses that are checked for
 * stable same-frame EE maximum evidence.
 *
 * Browser pixels, canvas health, and scene/rail snapshot identity remain a
 * separate port-3000 gate. This command must not be used as a substitute for
 * that browser acceptance.
 */
import assert from 'node:assert/strict';

import { evaluateHomepageDecisionEeAlignment } from '../src/homepage/controller/homepageAcceptanceAlignment';
import { HOMEPAGE_NATURAL_HANDOVER_STORY_PRIMARY_JOG_KM } from '../src/homepage/controller/homepageStoryScenario';
import { selectHomepageDemoWindow } from '../src/homepage/controller/homepageDemoWindow';
import { loadProfile } from '../src/profiles';
import {
  buildSinrLiveCellHandoverEventIndex,
} from '../src/scene/sinrLiveCellHandoverEventIndex';
import { runMultiCandidateWindow } from './diagnose-multi-candidate-window';

const PROFILE_ID = 'hobs-2024-candidate-rich';
const EPOCH_UTC_MS = Date.UTC(2026, 7, 25, 12, 0, 0);
// The first continuous intra -> inter service chain in the canonical seven-cell
// fixture occurs after the earlier disconnected inter rows. Keep the gate
// inside the same two-hour source run, but wide enough to exercise that real
// chain instead of accepting an unrelated pair at 476 -> 606 s.
const DURATION_SEC = Number(process.env.HOMEPAGE_ALIGNMENT_DURATION_SEC ?? 1100);
const STEP_SEC = Number(process.env.HOMEPAGE_ALIGNMENT_STEP_SEC ?? 2);
const UE_COUNT = Number(process.env.HOMEPAGE_ALIGNMENT_UE_COUNT ?? 100);

function key(key: { readonly satelliteId: string; readonly beamId: number }): string {
  return `${key.satelliteId}|${key.beamId}`;
}

function latestBefore<T extends { readonly simTimeSec: number }>(
  values: readonly T[],
  sourceTimeSec: number,
): T | null {
  return values
    .filter(value => value.simTimeSec < sourceTimeSec)
    .sort((left, right) => right.simTimeSec - left.simTimeSec)[0] ?? null;
}

const profile = loadProfile(PROFILE_ID);
const jog = HOMEPAGE_NATURAL_HANDOVER_STORY_PRIMARY_JOG_KM;

const sourceIndex = buildSinrLiveCellHandoverEventIndex({
  profile,
  epochUtcMs: EPOCH_UTC_MS,
  simStepSec: STEP_SEC,
  ueCount: UE_COUNT,
  ueDistributionMode: 'seven-cell-asymmetric',
  uePrimaryAnchorMode: 'observer',
  ueDistributionScope: 'beam-footprint',
  ueMobilityMode: 'static',
  eventUeScope: 'primary-ue-only',
  focusCellId: null,
  servingBeamCount: 7,
  candidateBeamCount: 7,
  beamHoppingEnabled: false,
  beamPointingMode: 'sampled-steering',
  multiCandidateDecisionEnabled: true,
  primaryJogEastKm: jog.east,
  primaryJogNorthKm: jog.north,
});

assert.deepEqual(
  sourceIndex.sourceGapReasons,
  [],
  `homepage source index must be complete: ${sourceIndex.sourceGapReasons.join('; ')}`,
);

const window = selectHomepageDemoWindow(sourceIndex.events, 0, DURATION_SEC);
assert.ok(window, 'homepage must expose a complete natural Intra -> Inter source window');
assert.equal(window.alignment.aligned, true, 'natural source window must pass the geometry/order alignment gate');
assert.equal(window.events[0].kind, 'intra');
assert.equal(window.events[1].kind, 'inter');
assert.ok(window.events[0].sourceTimeSec < window.events[1].sourceTimeSec);

interface DecisionWitness {
  readonly simTimeSec: number;
  readonly kind: 'intra' | 'inter';
  readonly targetKey: string;
  readonly alignment: ReturnType<typeof evaluateHomepageDecisionEeAlignment>;
}

const witnesses: DecisionWitness[] = [];
const diagnostic = runMultiCandidateWindow({
  durationSec: DURATION_SEC,
  stepSec: STEP_SEC,
  ueCount: UE_COUNT,
  requireFlow: true,
  onDecisionFrame: ({ frame, decision }) => {
    const target = decision.selectedTarget;
    if (target === null) return;
    const kind = decision.selectedKind === 'intra-satellite' ? 'intra' : 'inter';
    witnesses.push({
      simTimeSec: frame.simTimeSec,
      kind,
      targetKey: key(target),
      alignment: evaluateHomepageDecisionEeAlignment(decision, target),
    });
  },
});

assert.ok(diagnostic.decisionCommits.length > 0, 'source diagnostic must publish at least one decision commit');

for (const event of window.events) {
  const witness = latestBefore(
    witnesses.filter(item => item.kind === event.kind && item.targetKey === key({
      satelliteId: event.toSatId,
      beamId: event.toBeamId!,
    })),
    event.sourceTimeSec,
  );
  assert.ok(
    witness,
    `${event.kind} source event at ${event.sourceTimeSec}s must have a prior selected decision witness for ${event.toSatId}|${event.toBeamId}`,
  );
  assert.equal(
    witness.alignment.aligned,
    true,
    `${event.kind} selected target must be the stable same-frame EE maximum: ${witness.alignment.failedChecks.join(', ')}`,
  );
}

console.log('HOMEPAGE ALIGNMENT PASSED');
console.log(`sourceWindow=${window.leadInSec}-${window.endSec}s`);
console.log(`intra=${window.events[0].sourceTimeSec}s ${window.events[0].fromSatId}|${window.events[0].fromBeamId} -> ${window.events[0].toSatId}|${window.events[0].toBeamId}`);
console.log(`inter=${window.events[1].sourceTimeSec}s ${window.events[1].fromSatId}|${window.events[1].fromBeamId} -> ${window.events[1].toSatId}|${window.events[1].toBeamId}`);
console.log(`decisionCommits=${diagnostic.decisionCommits.length} intra=${diagnostic.decisionCommitKinds.intra} inter=${diagnostic.decisionCommitKinds.inter}`);
console.log('browserGate=REQUIRED http://127.0.0.1:3000/');
