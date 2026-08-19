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
      canonicalEe={{
        status: 'valid',
        sumIdentity: true,
        systemPowerW: 12.5,
        eeInstMbitPerJ: 2.4,
        contributionSumMbitPerJ: 2.4,
        eeEvalMbitPerJ: 2.1,
        evaluationSampleCount: 3,
        frameSimTimeSec: 2,
        actualRfOutputW: 1.25,
        ratedRfOutputW: 2,
        evaluationDataMbit: 42,
        evaluationEnergyJ: 20,
        evaluationWindowStartSec: 0,
        evaluationWindowEndSec: 2,
        servingBeamIdentity: 'sat-a#cell0',
        perUserContributions: [
          {
            ueId: 'ue-primary',
            assignedBeamLoad: 4,
            allocatedBandwidthMHz: 25,
            sinrDb: 8,
            rateMbps: 30,
            contributionMbitPerJ: 1.2,
          },
          {
            ueId: 'ue-secondary',
            assignedBeamLoad: 4,
            allocatedBandwidthMHz: 25,
            sinrDb: 6,
            rateMbps: 20,
            contributionMbitPerJ: 1.2,
          },
        ],
        errorCode: null,
      }}
      livePaperEnergyEfficiency={null}
      perUePositions={[
        {
          id: 'ue-primary',
          servingSatId: 'sat-a',
          servingBeamId: null,
          servingCellId: 0,
          sinrDb: 8,
        },
      ]}
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
      simTimeSec={2}
      beamHopEnabled={false}
      isFormulaEvidenceStale={false}
    >
      <div data-testid="serving-candidate-sentinel">top comparison</div>
    </WalkerResultsRail>
  </LocaleProvider>,
);

assert.match(markup, /data-testid="walker-results-rail"/);
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
assert.match(markup, /data-embedded="true"/);
assert.match(markup, /<i>p<\/i><sub>u,s,v<\/sub>\(t, θ\) · h<sub>u,s,v<\/sub>\(t, θ\)/);
assert.doesNotMatch(markup, /P<sup>o<\/sup>|P<sup>r<\/sup>|I<sup>[ab]<\/sup>|η<sup>e<\/sup>/);

assert.match(markup, /data-testid="walker-result-power-output"[\s\S]*<i>p<\/i><sub>u,s,v<\/sub>[\s\S]*1\.25 W/);
assert.match(markup, /data-testid="walker-result-system-power"[\s\S]*P<sup>N<\/sup>[\s\S]*12\.5 W/);
assert.match(markup, /data-testid="walker-result-power-signal"[\s\S]*<i>p<\/i><sub>u,s,v<\/sub>\(t,[\s\S]*?θ[\s\S]*h<sub>u,s,v<\/sub>[\s\S]*-90 dBm/);
assert.match(markup, /data-testid="walker-result-power-intra-interference"[\s\S]*I<sub>u,s,v<\/sub>[\s\S]*-104 dBm/);
assert.match(markup, /data-testid="walker-result-power-inter-interference"[\s\S]*I<sub>u,s,v<\/sub>[\s\S]*-106 dBm/);
assert.match(markup, /data-testid="walker-result-power-noise"[\s\S]*σ²[\s\S]*-110 dBm/);
assert.match(markup, /data-testid="walker-result-link-throughput"[\s\S]*R<sub>u,s,v<\/sub>[\s\S]*30 Mbit\/s/);
assert.match(markup, /data-testid="walker-result-total-throughput"[\s\S]*50 Mbit\/s/);
assert.match(markup, /data-testid="walker-result-beam-load"[\s\S]*U<sub>s,v<\/sub>[\s\S]*4/);
assert.match(markup, /data-testid="walker-result-link-ee"[\s\S]*η<sub>u,s,v<\/sub>[\s\S]*1\.2 Mbit\/J/);
assert.match(markup, /data-testid="walker-result-instantaneous-ee"[\s\S]*2\.4 Mbit\/J/);
assert.match(markup, /data-testid="walker-result-evaluation-ee"[\s\S]*2\.1 Mbit\/J/);

const visibleText = markup.replace(/<[^>]+>/g, '');
assert.doesNotMatch(visibleText, /唯讀|Read-only/i);
assert.doesNotMatch(markup, /ŝ|v̂|<sub>(?:beam|max|sat|system)/);

console.log('Walker right rail keeps the duel first and exposes four collapsed same-frame result groups.');
