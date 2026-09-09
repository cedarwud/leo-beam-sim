import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { LocaleProvider } from '../../i18n';
import { loadProfile } from '../../profiles';
import { WalkerResultsRail } from './WalkerResultsRail';

const profile = loadProfile('hobs-2024-candidate-rich');
const markup = renderToStaticMarkup(
  <LocaleProvider initialLocale="zh-TW">
    <WalkerResultsRail
      profile={profile}
      physicalServing={{
        satId: 'sat-a',
        beamId: null,
        sinrDb: 8,
        elevationDeg: 70,
        rangeKm: 600,
        status: 'live',
      }}
      physicalServingBudget={{
        signalDbm: -90,
        intraInterferenceDbm: -104,
        interInterferenceDbm: -106,
        noiseDbm: -110,
        denominatorDbm: -101,
        txPowerDbm: 31,
        pathLossDb: 180,
        beamGainDb: 42,
        steeringLossDb: 1,
        receiverGainDbi: 0,
      }}
      servingCellId={0}
      pendingTargetSatId="sat-b"
      angleAwareFormulaFrame={{
        ueId: 'ue-primary',
        satId: 'sat-a',
        beamId: 1,
        timeSec: 2,
        selected: 1,
        terms: {
          timeSec: 2,
          previousTimeSec: 1,
          previousThetaRad: 0,
          previousPowerW: 1.25,
          previousTransmitGainLinear: 1,
          segmentStartTimeSec: 0,
          segmentStartThetaRad: 0,
          segmentStartTransmitGainLinear: 1,
          segmentStartPowerW: 2,
          thetaRad: 0.02,
          distanceM: 600_000,
          powerW: 1.25,
          transmitGainLinear: 1,
          channelGainLinear: 1,
          desiredSignalW: 0.5,
          interferenceW: 0.05,
          noiseW: 0.01,
          gammaLinear: 8,
          gammaDb: 9.03,
          bandwidthHz: 25e6,
          beamLoad: 4,
          throughputBps: 30e6,
          conversionEfficiency: 0.6,
          powerConsumptionW: 2.083333,
          fixedPowerW: 0,
          systemPowerW: 12.5,
          energyEfficiencyBitsPerJoule: 900,
        },
      }}
      simTimeSec={2}
      beamHopEnabled={false}
      isFormulaEvidenceStale={false}
    >
      <div data-testid="serving-candidate-sentinel">top comparison</div>
    </WalkerResultsRail>
  </LocaleProvider>,
);

assert.match(markup, /data-testid="walker-results-rail"/);
assert.match(markup, /data-testid="walker-results-source-badge"/);
assert.match(markup, /來源 · 合成 Walker 計算值/);
assert.match(markup, /data-right-rail-source="walker-live-scene-frame"/);
assert.doesNotMatch(markup, /目前波束配置|Current beam configuration|walker-beam-frame-status/);
assert.ok(
  markup.indexOf('serving-candidate-sentinel') < markup.indexOf('walker-calculation-results'),
  'serving/candidate comparison must remain above all calculation disclosures',
);

for (const section of ['sinr', 'power', 'throughput', 'ee']) {
  assert.match(markup, new RegExp(`data-testid="walker-result-section-${section}"`));
}
assert.equal((markup.match(/<details\b/g) ?? []).length, 4);
assert.doesNotMatch(markup, /<details[^>]*\sopen(?:=|\s|>)/);
assert.match(markup, /<strong>SINR<\/strong>/);
assert.match(markup, /<strong>Power<\/strong>/);
assert.doesNotMatch(markup, /SINR 公式各項|<strong>功率<\/strong>/);

assert.match(markup, /data-testid="formula-verification-card"/);
assert.match(markup, /class="leo-formula-verification-card"/);
assert.match(markup, /class="leo-formula-verification-card__headline"/);
assert.match(markup, /class="leo-formula-verification-card__identity"/);
assert.match(markup, /data-embedded="true"/);
assert.doesNotMatch(markup, /data-testid="formula-frame-formula"/);
assert.match(markup, /data-testid="formula-frame-distance"/);
assert.match(markup, /data-testid="formula-frame-sinr"/);
assert.doesNotMatch(markup, /h<sub>|I<sup>[ab]<\/sup>|dBm/);
assert.doesNotMatch(markup, /P<sup>o<\/sup>|P<sup>r<\/sup>|I<sup>[ab]<\/sup>|η<sup>e<\/sup>/);
const formulaTermsStart = markup.indexOf('data-testid="formula-frame-distance"');
const powerSectionStart = markup.indexOf('data-testid="walker-result-section-power"');
assert.ok(formulaTermsStart >= 0 && powerSectionStart > formulaTermsStart, 'SINR formula terms must render before the Power section');
assert.doesNotMatch(
  markup.slice(formulaTermsStart, powerSectionStart),
  /leo-walker-result-row__scope-tag|主要 UE|Primary UE/,
  'SINR formula symbols should not carry repeated scope badges',
);

assert.match(markup, /data-testid="walker-result-power-output"[\s\S]*data-scope="primary-ue"[\s\S]*<i>p<\/i><sub>u,s,v<\/sub>[\s\S]*主要 UE[\s\S]*1\.25 W/);
assert.match(markup, /data-testid="walker-result-system-power"[\s\S]*data-scope="system"[\s\S]*P<sup>N<\/sup>[\s\S]*系統[\s\S]*12\.5 W/);
assert.match(markup, /data-testid="walker-result-power-signal"[\s\S]*data-scope="primary-ue"[\s\S]*H<sub>u,s,v<\/sub>[\s\S]*主要 UE[\s\S]*500 mW/);
assert.match(markup, /data-testid="walker-result-power-interference"[\s\S]*data-scope="primary-ue"[\s\S]*I<sub>u,s,v<\/sub>[\s\S]*主要 UE[\s\S]*50 mW/);
assert.doesNotMatch(markup, /walker-result-power-intra-interference|walker-result-power-inter-interference/);
assert.match(markup, /data-testid="walker-result-power-noise"[\s\S]*data-scope="primary-ue"[\s\S]*σ²[\s\S]*主要 UE[\s\S]*10 mW/);
assert.match(markup, /data-testid="walker-result-power-consumption"[\s\S]*data-scope="beam-aggregate"[\s\S]*P<sup>p<\/sup><sub>s,v<\/sub>[\s\S]*波束聚合/);
assert.match(markup, /data-testid="walker-result-link-throughput"[\s\S]*data-scope="primary-ue"[\s\S]*R<sub>u,s,v<\/sub>[\s\S]*主要 UE[\s\S]*30 Mbit\/s/);
assert.match(markup, /data-testid="walker-result-beam-bandwidth"[\s\S]*data-scope="beam-aggregate"[\s\S]*B<sup>w<\/sup>[\s\S]*波束聚合/);
assert.match(markup, /data-testid="walker-result-beam-load"[\s\S]*data-scope="beam-aggregate"[\s\S]*U<sub>s,v<\/sub>[\s\S]*波束聚合[\s\S]*4/);
assert.match(markup, /data-testid="walker-result-link-ee"[\s\S]*data-scope="primary-ue"[\s\S]*η<sub>u,s,v<\/sub>[\s\S]*主要 UE[\s\S]*900 bit\/J/);
assert.match(markup, /data-testid="walker-result-instantaneous-ee"[\s\S]*data-scope="primary-ue"[\s\S]*R<sub>u,s,v<\/sub>[\s\S]*主要 UE[\s\S]*30 Mbit\/s/);
assert.match(markup, /data-testid="walker-result-ee-system-power"[\s\S]*data-scope="system"[\s\S]*P<sup>N<\/sup>[\s\S]*系統[\s\S]*12\.5 W/);
assert.match(markup, /data-testid="formula-frame-distance"[\s\S]*data-scope="primary-ue"/);
assert.match(markup, /data-testid="formula-frame-sinr"[\s\S]*data-scope="primary-ue"/);

const visibleText = markup.replace(/<[^>]+>/g, '');
assert.doesNotMatch(visibleText, /唯讀|Read-only/i);
assert.doesNotMatch(markup, /ŝ|v̂|<sub>(?:beam|max|sat|system)/);

console.log('Walker right rail keeps the duel first and exposes four collapsed same-frame result groups.');
