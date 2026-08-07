#!/usr/bin/env node
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

import { loadProfile } from '../profiles';
import { createInitialSimState } from '../scene/initialSimState';
import { LocaleProvider } from '../i18n';
import type { TeachingEnergyReadout } from '../teaching';
import { InfoPanel } from './InfoPanel';

const profile = loadProfile('hobs-2024-candidate-rich');
const state = createInitialSimState(profile);
const teachingEnergy: TeachingEnergyReadout = {
  powerTrain: {
    txPowerDbm: 30,
    rfTxPowerW: 1,
    paInputW: 2,
    circuitPowerW: 0.5,
    totalPowerW: 2.5,
  },
  throughputMbps: 1,
  elapsedSec: 1,
  cumulativeDataMbit: 1,
  handoverCount: 0,
  cumulativeEnergyJ: 2.5,
  handoverEnergyJ: 0,
  totalEnergyJ: 2.5,
  runEeMbitPerJ: 0.4,
  lowSinrThresholdDb: 0,
  lowSinrRatioPct: 0,
  t3FixedComparison: {
    sourceKind: 'deterministic-fixture',
    assignedBeamLoad: 1,
    sinrDb: 0,
    bandwidthMHz: 20,
    frequencyReuse: 1,
    allocatedBandwidthMHz: 20,
    throughputMbps: 20,
    dataMbit: 20,
    serviceStatus: 'served',
    serviceIdentity: 't3-fixed-u1-sinr0',
    producerStatus: 'valid',
    absenceReason: null,
  },
};

const markup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <InfoPanel
      {...state}
      canonicalEe={{
        status: 'valid',
        sumIdentity: true,
        systemPowerW: 4.25,
        eeInstMbitPerJ: 1.5,
        contributionSumMbitPerJ: 1.5,
        eeEvalMbitPerJ: null,
        evaluationSampleCount: 0,
        frameSimTimeSec: 1,
        actualRfOutputW: 1,
        ratedRfOutputW: 2,
        evaluationDataMbit: null,
        evaluationEnergyJ: null,
        evaluationWindowStartSec: null,
        evaluationWindowEndSec: null,
        servingBeamIdentity: 'sat-a#cell0',
        perUserContributions: [{ ueId: 'ue-live', contributionMbitPerJ: 1.5 }],
        errorCode: null,
      }}
      profile={profile}
      teachingEnergy={teachingEnergy}
      showFormulaTerms={false}
    />
  </LocaleProvider>,
);

assert.match(markup, /data-testid="canonical-status"[^>]*>[\s\S]*VALID/);
assert.match(markup, /data-testid="canonical-identity"[^>]*>[\s\S]*PASS/);
assert.match(markup, /data-testid="canonical-system-power"[^>]*>[\s\S]*4\.250/);
assert.match(markup, /data-testid="canonical-user-contribution-ue-live"/);
assert.match(markup, /data-testid="canonical-ee-eval"[^>]*>[\s\S]*—/);

console.log('InfoPanel canonical SimState fallback integration test passed.');
