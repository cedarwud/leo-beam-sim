#!/usr/bin/env node
/**
 * Unit gate for the handover-cinema pure model (S1). Proves the candidate detail
 * + SINR explainer are lane-gated, look up the focused event faithfully, never
 * fabricate a SINR value, and always carry the lane-truthful claim.
 * Run: `npm run validate:phase-c:handover-cinema:model`.
 */
import {
  buildCinemaCandidateDetail,
  decideSinrOffsetExplainer,
  toCandidateHighlightCommand,
} from './handoverCinema';
import type {
  LiveWalkerHandoverEvent,
  LiveWalkerHandoverEventIndex,
} from '../scene/liveWalkerHandoverEventIndex';
import type { SceneLane } from './sceneLane';

let passed = 0;
function pass(label: string): void {
  passed += 1;
  console.log(`PASS ${String(passed).padStart(2, '0')}: ${label}`);
}
function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (!Object.is(actual, expected)) {
    throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`);
  }
}
function assertNotNull<T>(value: T | null, label: string): T {
  if (value === null) throw new Error(`${label}: expected non-null, got null`);
  return value;
}
function assertNull(value: unknown, label: string): void {
  if (value !== null) throw new Error(`${label}: expected null, got ${JSON.stringify(value)}`);
}
function check(label: string, fn: () => void): void {
  fn();
  pass(label);
}

function ev(overrides: Partial<LiveWalkerHandoverEvent> = {}): LiveWalkerHandoverEvent {
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
    ...overrides,
  };
}

function index(events: LiveWalkerHandoverEvent[], offsetDb = 2): LiveWalkerHandoverEventIndex {
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
    offsetDb,
    sourceGapReasons: [],
    events,
  };
}

check('buildCinemaCandidateDetail resolves the focused event by id on sinr-live', () => {
  const detail = assertNotNull(
    buildCinemaCandidateDetail(index([ev()]), 'evt-inter-1', 'sinr-live'),
    'detail',
  );
  assertEqual(detail.fromSatId, 'SAT-2', 'fromSatId');
  assertEqual(detail.fromBeamId, 3, 'fromBeamId');
  assertEqual(detail.toSatId, 'SAT-5', 'toSatId');
  assertEqual(detail.toBeamId, 1, 'toBeamId');
  assertEqual(detail.fromSinrDb, -4.2, 'fromSinrDb');
  assertEqual(detail.toSinrDb, 1.6, 'toSinrDb');
  assertEqual(detail.deltaDb, 5.8, 'deltaDb');
  assertEqual(detail.offsetDb, 2, 'offsetDb');
  assertEqual(detail.claimKind, 'profile-derived-forecast', 'claimKind');
});

check('buildCinemaCandidateDetail is lane-gated to sinr-live (S1)', () => {
  const otherLanes: SceneLane[] = ['modqn-live-cell-preview', 'modqn-replay-proof', 'artifact-replay'];
  for (const lane of otherLanes) {
    assertNull(buildCinemaCandidateDetail(index([ev()]), 'evt-inter-1', lane), `lane ${lane}`);
  }
});

check('buildCinemaCandidateDetail fails closed on null index / null id / unknown id', () => {
  assertNull(buildCinemaCandidateDetail(null, 'evt-inter-1', 'sinr-live'), 'null index');
  assertNull(buildCinemaCandidateDetail(index([ev()]), null, 'sinr-live'), 'null id');
  assertNull(buildCinemaCandidateDetail(index([ev()]), 'nope', 'sinr-live'), 'unknown id');
});

check('toCandidateHighlightCommand strips SINR (geometry only) and null-passes through', () => {
  const detail = buildCinemaCandidateDetail(index([ev()]), 'evt-inter-1', 'sinr-live');
  const cmd = assertNotNull(toCandidateHighlightCommand(detail), 'cmd');
  assertEqual(cmd.kind, 'inter', 'cmd.kind');
  assertEqual(cmd.fromSatId, 'SAT-2', 'cmd.fromSatId');
  assertEqual(cmd.fromBeamId, 3, 'cmd.fromBeamId');
  assertEqual(cmd.toSatId, 'SAT-5', 'cmd.toSatId');
  assertEqual(cmd.toBeamId, 1, 'cmd.toBeamId');
  assertEqual(Object.prototype.hasOwnProperty.call(cmd, 'toSinrDb'), false, 'cmd carries no SINR');
  assertNull(toCandidateHighlightCommand(null), 'null detail');
});

check('decideSinrOffsetExplainer emits serving+winner rows, winner selected, no fabrication', () => {
  const detail = buildCinemaCandidateDetail(index([ev()]), 'evt-inter-1', 'sinr-live');
  const model = assertNotNull(decideSinrOffsetExplainer(detail), 'model');
  assertEqual(model.rows.length, 2, 'row count');
  const [serving, winner] = model.rows;
  assertEqual(serving.role, 'serving', 'serving role');
  assertEqual(serving.isSelected, false, 'serving not selected');
  assertEqual(serving.sinrDb, -4.2, 'serving sinr');
  assertEqual(winner.role, 'winner', 'winner role');
  assertEqual(winner.isSelected, true, 'winner selected');
  assertEqual(winner.sinrDb, 1.6, 'winner sinr');
  assertEqual(model.offsetDb, 2, 'model offset');
  assertEqual(model.kind, 'inter', 'model kind');
  assertEqual(model.claimKind, 'profile-derived-forecast', 'model claim');
});

check('decideSinrOffsetExplainer preserves a null serving SINR (cold attach), never invents one', () => {
  const detail = buildCinemaCandidateDetail(index([ev({ fromSinrDb: null, deltaDb: null })]), 'evt-inter-1', 'sinr-live');
  const model = assertNotNull(decideSinrOffsetExplainer(detail), 'model');
  assertEqual(model.rows[0].sinrDb, null, 'cold-attach serving sinr stays null');
  assertEqual(model.deltaDb, null, 'cold-attach delta stays null');
});

check('decideSinrOffsetExplainer returns null when no candidate', () => {
  assertNull(decideSinrOffsetExplainer(null), 'null candidate');
});

console.log(`\n${passed} checks passed.`);
