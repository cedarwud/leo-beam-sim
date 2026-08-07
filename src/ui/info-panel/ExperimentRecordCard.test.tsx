import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ExperimentRecordCard } from './ExperimentRecordCard';
import type { ExperimentRecord } from '../../teaching';

test('ExperimentRecordCard renders nothing when record is null', () => {
  const html = renderToStaticMarkup(<ExperimentRecordCard record={null} />);
  assert.equal(html, '');
});

test('ExperimentRecordCard renders every shared/task field and both exports', () => {
  const record: ExperimentRecord = {
    schemaVersion: 't1-t6-experiment-record-v1',
    taskId: 'T6',
    experimentId: 'test-exp',
    runId: 'run-1',
    captureIndex: 1,
    capturedAtIso: '2026-08-07T00:00:00.000Z',
    scenarioIdentity: 'test-scene',
    profileIdentity: 'test-profile',
    sceneSource: 'live-sim',
    sceneLane: 'sinr-live',
    windowId: 'win-1',
    windowStartSec: 0,
    windowEndSec: 10,
    durationSec: 10,
    changedInput: null,
    unchangedInputs: null,
    changedControls: {},
    unchangedControls: {},
    fieldAbsenceReasons: { taskOnly: 'not-selected-task' },
    units: null,
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
    bandwidth: null,
    reuseFactor: null,
    load: null,
    sinr: null,
    throughput: null,
    data: null,
    serviceStatus: null,
    servingSatellite: null,
    servingCell: null,
    servingBeam: null,
    sourceKind: null,
    beforeParams: null,
    afterParams: null,
    dataT4: null,
    energyT4: null,
    windowIdT4: null,
    simulationClock: 10,
    playbackState: 'paused',
    resetAction: null,
    explicitStateStatus: 'VALID',
    baselineArm: null,
    candidateArm: null,
    comparison: null,
    producerStatus: 'valid',
    systemPower: 3.395,
    instantaneousEe: 2.945,
    perUserContributionSum: 2.945,
    ratioOfSums: null,
    sampleWindow: 'baseline',
    actualRf: 1,
    ratedRf: 2,
    serviceBeam: 'sat-a#cell0',
    frameSimTime: 10,
    evaluationData: null,
    evaluationEnergy: null,
    perUserContributions: [{ ueId: 'ue-1', contributionMbitPerJ: 2.945 }],
  };

  const html = renderToStaticMarkup(<ExperimentRecordCard record={record} />);
  assert.match(html, /實驗紀錄 · T6/);
  assert.match(html, /data-record-field="systemPower"/);
  assert.match(html, /data-record-field="perUserContributions"/);
  assert.match(html, /下載 JSON 紀錄/);
  assert.match(html, /下載 CSV 紀錄/);
  assert.match(html, /data-testid="download-record-json"[^>]*style="[^"]*background:rgba\(12, 35, 44, 0\.72\)/);
  assert.match(html, /data-testid="download-record-json"[^>]*style="[^"]*border:1px solid rgba\(218,244,255,0\.18\)/);
  assert.match(html, /data-testid="download-record-csv"[^>]*style="[^"]*background:rgba\(12, 35, 44, 0\.72\)/);
  assert.match(html, /data-testid="download-record-csv"[^>]*style="[^"]*border:1px solid rgba\(218,244,255,0\.18\)/);
  assert.match(html, /data-record-valid="true"/);
});
