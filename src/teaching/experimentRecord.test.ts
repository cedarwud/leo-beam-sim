import { describe, expect, it } from 'vitest';
import type { ExperimentRecord } from './experimentRecord';

describe('ExperimentRecord', () => {
  it('should compile with a valid record', () => {
    const record: ExperimentRecord = {
      experimentId: 'test-exp-1',
      scenarioIdentity: 'test-scenario',
      windowId: 'win-1',
      windowStartSec: 0,
      windowEndSec: 10,
      changedInput: null,
      unchangedInputs: null,
      units: { txPower: 'dBm' },
      absenceReason: null,
      interpretation: null,
      tradeoff: null,
      limitation: null,

      paEfficiency: 0.5,
      rfOutput: 40,
      paInput: 80,
      circuitPower: 10,
      totalPower: 90,
      scopeStatus: 'active',

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

    expect(record.experimentId).toBe('test-exp-1');
  });
});
