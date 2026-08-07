import assert from 'node:assert/strict';
import {
  CLASSROOM_BASELINE_TX_POWER_DBM,
  CLASSROOM_CANDIDATE_TX_POWER_DBM,
  compareClassroomEnergyArms,
  type TeachingEnergyReadout,
} from './teaching';
import {
  freezeClassroomEnergyArm,
  getClassroomEnergyCaptureBlockReason,
  type ClassroomEnergyCaptureInput,
} from './App';

const READOUT: TeachingEnergyReadout = {
  powerTrain: null,
  throughputMbps: 10,
  cumulativeDataMbit: 100,
  cumulativeEnergyJ: 80,
  elapsedSec: 60,
  runEeMbitPerJ: 1.25,
  handoverEnergyJ: 4,
  totalEnergyJ: 84,
  handoverCount: 2,
  lowSinrRatioPct: 10,
  lowSinrThresholdDb: 14,
  t3FixedComparison: {
    sourceKind: 'deterministic-fixture',
    assignedBeamLoad: 1,
    sinrDb: 0,
    bandwidthMHz: 20,
    frequencyReuse: 1,
    allocatedBandwidthMHz: 20,
    throughputMbps: 20,
    dataMbit: 1200,
    serviceStatus: 'served',
    serviceIdentity: 't3-fixed-u1-sinr0',
    producerStatus: 'valid',
    absenceReason: null,
  },
};

function input(overrides: Partial<ClassroomEnergyCaptureInput> = {}): ClassroomEnergyCaptureInput {
  return {
    role: 'baseline',
    expectedTxPowerDbm: CLASSROOM_BASELINE_TX_POWER_DBM,
    txPowerDbm: CLASSROOM_BASELINE_TX_POWER_DBM,
    liveSinrScene: true,
    paused: true,
    contextDrifted: false,
    currentContextKey: 'locked-context',
    lockedContextKey: 'locked-context',
    windowStartSimTimeSec: 100,
    windowEndSimTimeSec: 160,
    readout: READOUT,
    servingLoad: 1,
    servingSinrDb: 10,
    serviceStatus: 'served',
    serviceIdentity: 'sat-a/cell-0',
    producerStatus: 'valid',
    absenceReason: null,
    ...overrides,
  };
}

assert.equal(getClassroomEnergyCaptureBlockReason(input({ txPowerDbm: CLASSROOM_CANDIDATE_TX_POWER_DBM })), 'wrong-power');
assert.equal(getClassroomEnergyCaptureBlockReason(input({ paused: false })), 'timeline-running');
assert.equal(getClassroomEnergyCaptureBlockReason(input({ readout: { ...READOUT, totalEnergyJ: null } })), 'missing-readout');
assert.equal(getClassroomEnergyCaptureBlockReason(input({ contextDrifted: true })), 'context-mismatch');
assert.equal(getClassroomEnergyCaptureBlockReason(input({ currentContextKey: 'new-context' })), 'context-mismatch');
assert.equal(getClassroomEnergyCaptureBlockReason(input({ windowStartSimTimeSec: 160, windowEndSimTimeSec: 160 })), 'invalid-window');

const frozenBaseline = freezeClassroomEnergyArm(input());
assert.notEqual(frozenBaseline, null);
assert.equal(Object.isFrozen(frozenBaseline), true);
assert.equal(frozenBaseline?.comparisonContextKey, 'locked-context');
assert.equal(typeof frozenBaseline?.cumulativeDataMbit, 'number');

const frozenCandidate = freezeClassroomEnergyArm(input({
  role: 'candidate',
  expectedTxPowerDbm: CLASSROOM_CANDIDATE_TX_POWER_DBM,
  txPowerDbm: CLASSROOM_CANDIDATE_TX_POWER_DBM,
}));
assert.notEqual(frozenCandidate, null);
assert.equal(Object.isFrozen(frozenCandidate), true);

const mismatchedWindow = compareClassroomEnergyArms(
  frozenBaseline!,
  Object.freeze({ ...frozenCandidate!, windowEndSimTimeSec: 161 }),
);
assert.equal(mismatchedWindow.comparable, false);
assert.equal(mismatchedWindow.qualified, null);
assert.ok(mismatchedWindow.reasonCodes.includes('WINDOW_END_MISMATCH'));
assert.deepEqual(mismatchedWindow.gates, {
  dataRetention: null,
  lowSinr: null,
  runEe: null,
  energySaving: null,
});

console.log('Classroom energy App bridge validation passed.');
