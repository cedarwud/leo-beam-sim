import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ExperimentRecordCard } from './ExperimentRecordCard';
import type { ExperimentRecord } from '../../teaching';

describe('ExperimentRecordCard', () => {
  it('renders nothing when record is null', () => {
    const html = renderToStaticMarkup(<ExperimentRecordCard record={null} />);
    assert.equal(html, '');
  });

  it('renders the record details when provided', () => {
    const record: ExperimentRecord = {
      experimentId: 'test-exp',
      scenarioIdentity: 'test-scene',
      windowId: 'win-1',
      windowStartSec: 0,
      windowEndSec: 10,
      changedInput: null,
      unchangedInputs: null,
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
      txPower: null,
      bandwidth: null,
      reuseFactor: null,
      load: null,
      sinr: null,
      throughput: null,
      data: null,
      serviceStatus: null,
      beforeParams: null,
      afterParams: null,
      dataT4: null,
      energyT4: null,
      windowIdT4: null,
      simulationClock: null,
      playbackState: null,
      explicitStateStatus: null,
      producerStatus: null,
      systemPower: null,
      instantaneousEe: null,
      perUserContributionSum: null,
      ratioOfSums: null,
      sampleWindow: null,
      actualRf: null,
      ratedRf: null,
      serviceBeam: null,
    };

    const html = renderToStaticMarkup(<ExperimentRecordCard record={record} />);
    assert.match(html, /實驗 ID: test-exp/);
    assert.match(html, /下載 JSON 紀錄/);
  });
});
