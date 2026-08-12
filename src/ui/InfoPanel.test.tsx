#!/usr/bin/env node
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

import { loadProfile } from '../profiles';
import { createInitialSimState } from '../scene/initialSimState';
import { LocaleProvider } from '../i18n';
import { InfoPanel } from './InfoPanel';

const profile = loadProfile('hobs-2024-candidate-rich');
const state = createInitialSimState(profile);

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
      showFormulaTerms={false}
    />
  </LocaleProvider>,
);

assert.doesNotMatch(markup, /canonical-status/);
assert.doesNotMatch(markup, /classroom-energy-comparison/);
assert.doesNotMatch(markup, /experiment-record-card/);
assert.match(markup, /info-panel/);

console.log('InfoPanel active runtime surface test passed.');
