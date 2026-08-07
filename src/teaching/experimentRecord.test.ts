import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  experimentRecordToCsv,
  experimentRecordToJson,
  validateExperimentRecord,
  type ExperimentRecord,
} from './experimentRecord';

const record: ExperimentRecord = {
  schemaVersion: 't1-t6-experiment-record-v1',
  taskId: 'T3',
  experimentId: 'T3-run-1-1',
  runId: 'run-1',
  captureIndex: 1,
  capturedAtIso: '2026-08-07T00:00:00.000Z',
  scenarioIdentity: 'test-scenario',
  profileIdentity: 'test-profile',
  sceneSource: 'live-sim',
  sceneLane: 'sinr-live',
  windowId: 'win-1',
  windowStartSec: 0,
  windowEndSec: 10,
  durationSec: 10,
  changedInput: 'B/K',
  unchangedInputs: 'U=1; SINR=0 dB',
  changedControls: { bandwidthMHz: 20, frequencyReuse: 1 },
  unchangedControls: { assignedBeamLoad: 1, sinrDb: 0 },
  fieldAbsenceReasons: {},
  units: { bandwidth: 'MHz', throughput: 'Mbit/s' },
  absenceReason: null,
  interpretation: null,
  tradeoff: null,
  limitation: null,
  paEfficiency: null,
  rfOutput: null,
  paInput: null,
  circuitPower: null,
  totalPower: null,
  scopeStatus: null,
  energyKnobs: null,
  paPower: null,
  handoverEnergy: null,
  handoverCount: null,
  radioEnergy: null,
  totalEnergy: null,
  runEe: null,
  lowSinr: null,
  bandwidth: 20,
  reuseFactor: 1,
  load: 1,
  sinr: 0,
  throughput: 20,
  data: 200,
  serviceStatus: 'served',
  servingSatellite: null,
  servingCell: null,
  servingBeam: 't3-fixed-u1-sinr0',
  sourceKind: 'deterministic-fixture',
  beforeParams: null,
  afterParams: null,
  dataT4: null,
  energyT4: null,
  windowIdT4: null,
  simulationClock: 10,
  playbackState: 'paused',
  resetAction: null,
  explicitStateStatus: null,
  baselineArm: null,
  candidateArm: null,
  comparison: null,
  producerStatus: 'valid',
  systemPower: null,
  instantaneousEe: null,
  perUserContributionSum: null,
  ratioOfSums: null,
  sampleWindow: null,
  actualRf: null,
  ratedRf: null,
  serviceBeam: null,
  frameSimTime: null,
  evaluationData: null,
  evaluationEnergy: null,
  perUserContributions: null,
};

test('ExperimentRecord validates and exports recomputable JSON/CSV without T3 transmit power', () => {
  assert.deepEqual(validateExperimentRecord(record), { valid: true, errors: [] });
  const json = experimentRecordToJson(record);
  const csv = experimentRecordToCsv(record);
  assert.equal(JSON.parse(json).taskId, 'T3');
  assert.doesNotMatch(json, /NaN|Infinity/);
  assert.match(csv, /"record\.bandwidth","20"/);
  assert.match(csv, /"record\.unchangedControls\.sinrDb","0"/);
  assert.doesNotMatch(csv, /txPower/);
});

test('ExperimentRecord rejects non-finite values before export', () => {
  const invalid = { ...record, throughput: Number.NaN } as ExperimentRecord;
  assert.deepEqual(validateExperimentRecord(invalid), {
    valid: false,
    errors: ['record.throughput'],
  });
  assert.throws(() => experimentRecordToJson(invalid), /not exportable/);
});
