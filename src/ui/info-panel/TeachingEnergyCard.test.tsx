import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { LocaleProvider } from '../../i18n';
import { ZH_TW, EN } from '../../i18n/strings';
import { TeachingEnergyCard, type TeachingCanonicalReadout } from './TeachingEnergyCard';
import type { TeachingEnergyReadout } from '../../teaching';

const dummyReadout: TeachingEnergyReadout = {
  powerTrain: {
    txPowerDbm: 30,
    rfTxPowerW: 1.0,
    paInputW: 2.5,
    circuitPowerW: 0.5,
    totalPowerW: 3.0,
  },
  throughputMbps: 100,
  elapsedSec: 10,
  cumulativeDataMbit: 1000,
  handoverCount: 5,
  cumulativeEnergyJ: 30,
  handoverEnergyJ: 5,
  totalEnergyJ: 35,
  runEeMbitPerJ: 28.57,
  lowSinrThresholdDb: 0,
  lowSinrRatioPct: 10,
  t3FixedComparison: {
    sourceKind: 'deterministic-fixture',
    assignedBeamLoad: 1,
    sinrDb: 0,
    bandwidthMHz: 20,
    frequencyReuse: 1,
    allocatedBandwidthMHz: 20,
    throughputMbps: 20,
    dataMbit: 200,
    serviceStatus: 'served',
    serviceIdentity: 't3-fixed-u1-sinr0',
    producerStatus: 'valid',
    absenceReason: null,
  },
};

const canonicalPass: TeachingCanonicalReadout = {
  status: 'valid',
  sumIdentity: true,
  systemPowerW: 3.395,
  eeInstMbitPerJ: 2.945,
  contributionSumMbitPerJ: 2.945,
  eeEvalMbitPerJ: 2.901,
  perUserContributions: [
    {
      ueId: 'ue-1',
      status: 'served',
      satId: 'sat-a',
      cellId: 0,
      beamIdentity: 'sat-a#cell0',
      assignedBeamLoad: 2,
      allocatedBandwidthMHz: 5,
      sinrDb: 4,
      rateMbps: 5.25,
      contributionMbitPerJ: 1.2,
    },
    {
      ueId: 'ue-2',
      status: 'served',
      satId: 'sat-b',
      cellId: 1,
      beamIdentity: 'sat-b#cell1',
      assignedBeamLoad: 1,
      allocatedBandwidthMHz: 10,
      sinrDb: -2,
      rateMbps: 8.5,
      contributionMbitPerJ: 1.745,
    },
  ],
};

function textOf(markup: string): string {
  return markup
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

// Test string literals directly to ensure they don't leak formula/EE semantics
assert.equal(ZH_TW['panel.energy.reset.label'], '重新開始量測');
assert.equal(ZH_TW['panel.energy.reset.help'], '僅清除當前的量測視窗累積值並重新開始累積，而模擬時間、場景、播放速度與所有參數設定皆維持不變。');

assert.equal(EN['panel.energy.reset.label'], 'Restart measurement');
assert.equal(EN['panel.energy.reset.help'], 'Clears only the cumulative measurement window and restarts accumulation; simulation time, scene, playback speed, and all parameter settings are preserved.');

// Test zh-TW
const markupZh = renderToStaticMarkup(
  <LocaleProvider initialLocale="zh-TW">
    <TeachingEnergyCard readout={dummyReadout} onReset={() => {}} />
  </LocaleProvider>,
);

assert.match(markupZh, /data-testid="teaching-energy-reset"/);
assert.match(markupZh, /重新開始量測/);
assert.match(markupZh, /此區顯示單一連線的功率鏈與本次量測時間窗的累積效率。/);
assert.doesNotMatch(markupZh, /disabled/);

// Test EN
const markupEn = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <TeachingEnergyCard readout={dummyReadout} onReset={() => {}} />
  </LocaleProvider>,
);

assert.match(markupEn, /data-testid="teaching-energy-reset"/);
assert.match(markupEn, /Restart measurement/);
assert.match(markupEn, /data-testid="teaching-scope-note"/);
assert.match(markupEn, /This section shows the power chain for one link and its accumulated efficiency over the current measurement window\./);
assert.doesNotMatch(markupEn, /non-canonical|must not|canonical system P_sys/);
assert.doesNotMatch(markupEn, /ADR-003|BeamShift/);
assert.doesNotMatch(markupEn, /disabled/);

// The classroom card must expose the canonical gate even before the live frame
// bridge is available. Missing values remain dashes and the identity is pending.
const markupCanonicalPending = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <TeachingEnergyCard readout={dummyReadout} />
  </LocaleProvider>,
);
assert.match(markupCanonicalPending, /data-testid="canonical-status"/);
assert.match(markupCanonicalPending, /PENDING/);
assert.match(markupCanonicalPending, /data-testid="canonical-identity"/);
assert.match(markupCanonicalPending, /data-testid="canonical-per-user-contributions"[^>]*>[\s\S]*—/);
assert.match(markupCanonicalPending, /data-testid="canonical-system-power"[^>]*>[\s\S]*—/);
assert.match(markupCanonicalPending, /data-testid="canonical-user-details-unavailable"/);

const markupCanonicalPass = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <TeachingEnergyCard readout={dummyReadout} canonicalReadout={canonicalPass} />
  </LocaleProvider>,
);
assert.match(markupCanonicalPass, /data-testid="canonical-status"[^>]*>[\s\S]*VALID/);
assert.match(markupCanonicalPass, /data-testid="canonical-identity"[^>]*>[\s\S]*PASS/);
assert.match(markupCanonicalPass, /data-testid="canonical-user-contribution-ue-1"/);
assert.match(markupCanonicalPass, /data-testid="canonical-per-user-contributions"[^>]* hidden/);
assert.match(markupCanonicalPass, /data-testid="canonical-user-details-table"/);
for (const testId of [
  'canonical-user-status-ue-1',
  'canonical-user-satellite-ue-1',
      'canonical-user-cell-ue-1',
  'canonical-user-beam-ue-1',
  'canonical-user-load-ue-1',
  'canonical-user-bandwidth-ue-1',
  'canonical-user-sinr-ue-1',
  'canonical-user-rate-ue-1',
  'canonical-user-contribution-ue-1',
]) {
  assert.match(markupCanonicalPass, new RegExp(`data-testid="${testId}"`));
}
const canonicalPassText = textOf(markupCanonicalPass);
assert.match(canonicalPassText, /Canonical per-user detail/);
assert.match(canonicalPassText, /ue-1.*SERVED.*sat-a.*0.*2.*5\.00 MHz.*4\.00 dB.*5\.25 Mbit\/s.*1\.200 Mbit\/J/);
assert.match(canonicalPassText, /ue-2.*SERVED.*sat-b.*1.*1.*10\.00 MHz.*-2\.00 dB.*8\.50 Mbit\/s.*1\.745 Mbit\/J/);
assert.match(canonicalPassText, /not physical per-user transmit power/);
assert.match(canonicalPassText, /sat-a#cell0/);
assert.match(canonicalPassText, /Sum identity Σ_u r_\{1,u\} = EE_inst/);
assert.match(canonicalPassText, /Partial-payload scope/);

const markupCanonicalBaseline = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <TeachingEnergyCard
      readout={dummyReadout}
      canonicalReadout={{
        ...canonicalPass,
        eeEvalMbitPerJ: null,
        perUserContributions: null,
      }}
    />
  </LocaleProvider>
);
assert.match(markupCanonicalBaseline, /data-testid="canonical-ee-eval"[^>]*>[\s\S]*—/);
assert.match(markupCanonicalBaseline, /data-testid="canonical-per-user-contributions"[^>]*>[\s\S]*—/);

const markupCanonicalFail = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <TeachingEnergyCard
      readout={dummyReadout}
      canonicalReadout={{ ...canonicalPass, status: 'invalid', sumIdentity: false }}
    />
  </LocaleProvider>,
);
assert.match(markupCanonicalFail, /data-testid="canonical-status"[^>]*>[\s\S]*INVALID/);
assert.match(markupCanonicalFail, /data-testid="canonical-identity"[^>]*>[\s\S]*FAIL/);

const markupCanonicalError = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <TeachingEnergyCard
      readout={dummyReadout}
      canonicalReadout={{
        ...canonicalPass,
        status: 'invalid',
        sumIdentity: null,
        perUserContributions: null,
        errorCode: 'ACTIVE_KEY_MISMATCH',
      }}
    />
  </LocaleProvider>,
);
assert.match(markupCanonicalError, /data-canonical-error-code="ACTIVE_KEY_MISMATCH"/);
assert.match(markupCanonicalError, /data-testid="canonical-error-text"[^>]*>[\s\S]*Error code: ACTIVE_KEY_MISMATCH/);

const markupCanonicalAvailability = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <TeachingEnergyCard
      readout={dummyReadout}
      canonicalReadout={{
        ...canonicalPass,
        perUserContributions: [
          {
            ueId: 'ue-outage',
            status: 'outage',
            satId: 'sat-a',
            cellId: 0,
            assignedBeamLoad: 2,
            allocatedBandwidthMHz: 5,
            sinrDb: null,
            rateMbps: 0,
            contributionMbitPerJ: 0,
          },
          {
            ueId: 'ue-unserved',
            status: 'unserved',
            satId: null,
            cellId: null,
            assignedBeamLoad: 0,
            allocatedBandwidthMHz: 0,
            sinrDb: null,
            rateMbps: 0,
            contributionMbitPerJ: 0,
          },
        ],
      }}
    />
  </LocaleProvider>,
);
assert.match(markupCanonicalAvailability, /ue-outage/);
assert.match(markupCanonicalAvailability, /OUTAGE/);
assert.match(markupCanonicalAvailability, /ue-unserved/);
assert.match(markupCanonicalAvailability, /UNSERVED/);
assert.match(markupCanonicalAvailability, /data-testid="canonical-user-sinr-value-ue-outage"[^>]*>—<span[^>]*>dB<\/span><\/span>/);
assert.match(markupCanonicalAvailability, /data-testid="canonical-user-sinr-value-ue-unserved"[^>]*>—<span[^>]*>dB<\/span><\/span>/);
assert.match(markupCanonicalAvailability, /data-testid="canonical-user-satellite-ue-unserved"[^>]*>[\s\S]*—/);

// Test disabled state (readout is null)
const markupDisabled = renderToStaticMarkup(
  <LocaleProvider initialLocale="zh-TW">
    <TeachingEnergyCard readout={null} onReset={() => {}} />
  </LocaleProvider>,
);
assert.match(markupDisabled, /disabled/);
assert.match(markupDisabled, /data-testid="teaching-energy-reset"/);

// Test disabled state (no callback supplied)
const markupNoCallback = renderToStaticMarkup(
  <LocaleProvider initialLocale="zh-TW">
    <TeachingEnergyCard readout={dummyReadout} />
  </LocaleProvider>,
);
assert.match(markupNoCallback, /disabled/);
assert.match(markupNoCallback, /data-testid="teaching-energy-reset"/);

console.log('TeachingEnergyCard explicit reset presentation validation passed.');
