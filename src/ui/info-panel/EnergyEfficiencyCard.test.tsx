import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { LocaleProvider } from '../../i18n';
import type { PaperEnergyEfficiencyConfig } from '../../profiles/types';
import type { PaperEnergyEfficiency } from '../../utils/paperEnergyEfficiency';
import { EnergyEfficiencyCard } from './EnergyEfficiencyCard';

const powerSurface: PaperEnergyEfficiencyConfig = {
  beamPowerBaseW: 0.25,
  beamPowerLoadScaleW: 0.35,
  beamPowerLoadExponent: 0.5,
  beamPowerMaxW: 10,
  publishedReferenceMbitsPerJoule: 596.92,
  ch5DemoBandwidthMHz: 500,
  ch5DemoFrequencyReuse: 1,
};

const energyEfficiency: PaperEnergyEfficiency = {
  coverageWeightedBitsPerJoule: 200e6,
  perServedUeBitsPerJoule: 250e6,
  bandwidthMHz: 500,
  frequencyReuse: 1,
  allocatedBandwidthHz: 500e6,
  totalUeCount: 100,
  servedUeCount: 80,
  finiteSinrServedUeCount: 78,
  coverageFraction: 0.8,
  loadSummary: {
    count: 25,
    min: 1,
    p05: 1,
    median: 2,
    p95: 6,
    max: 9,
    mean: 3.2,
  },
  throughputSummaryBps: {
    count: 80,
    min: 0,
    p05: 0,
    median: 180e6,
    p95: 320e6,
    max: 400e6,
    mean: 190e6,
  },
  sinrDbSummary: {
    count: 78,
    min: -14,
    p05: -10,
    median: -5.1,
    p95: -2.2,
    max: 1.4,
    mean: -5.8,
  },
  powerSummaryW: {
    count: 25,
    min: 0.6,
    p05: 0.6,
    median: 0.74,
    p95: 1.11,
    max: 1.3,
    mean: 0.82,
  },
  perUeRawPowerSummaryW: {
    count: 80,
    min: 0.2,
    p05: 0.25,
    median: 0.37,
    p95: 0.7,
    max: 1.3,
    mean: 0.41,
  },
  publishedReferenceMbitsPerJoule: 596.92,
};

function textOf(markup: string): string {
  return markup
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

assert.equal(
  energyEfficiency.perServedUeBitsPerJoule * energyEfficiency.coverageFraction,
  energyEfficiency.coverageWeightedBitsPerJoule,
  'fixture must preserve served-average × coverage = all-UE EE',
);

const markup = renderToStaticMarkup(
  <LocaleProvider initialLocale="zh-TW">
    <EnergyEfficiencyCard
      energyEfficiency={energyEfficiency}
      powerSurface={powerSurface}
    />
  </LocaleProvider>,
);
const text = textOf(markup);

assert.match(markup, /data-testid="energy-efficiency-card"/);
assert.match(markup, /data-testid="energy-efficiency-headline"/);
assert.match(markup, /data-testid="energy-efficiency-served-average"/);
assert.match(markup, /data-testid="energy-efficiency-coverage"/);
assert.doesNotMatch(text, /Current-frame mean over all|unserved UEs count as 0/);
assert.match(text, /全場即時效率 200\.00 Mbit\/J/);
assert.match(text, /被服務使用者的平均 EE 250\.00 Mbit\/J 80 位使用者已取得服務/);
assert.match(text, /覆蓋率 80\.0% 80 \/ 100 位使用者已取得服務/);
assert.doesNotMatch(text, /= EE|Average across every UE/);
assert.doesNotMatch(markup, /data-testid="energy-efficiency-aggregation-result"/);
assert.match(text, /計算 EE 時用的頻寬 500\.0 MHz 用於 EE 計算/);
assert.doesNotMatch(text, /reuse factor/i);
assert.match(text, /使用者總數 100 位使用者 80 已取得服務 · 20 尚未取得服務/);
assert.match(text, /每道波束上的使用者數 \(s,v\) 平均 3\.2 位使用者 在作用中的波束上量測/);
assert.match(text, /被服務使用者的吞吐量 平均 190\.0 Mbit\/s EE 分子 R_u/);
assert.match(text, /被服務使用者的訊號品質 平均 -5\.8 dB 在已服務使用者上量測/);
assert.match(text, /每道波束的功率 平均 0\.82 W 取決於負載的每道波束原始功率/);
assert.match(text, /每個使用者分攤到的功率 平均 0\.41 W 每道波束原始功率 ÷ U_s,v/);
assert.doesNotMatch(
  text,
  /Overall EE \(all UEs\)|Served-UE EE mean|Service coverage|Bandwidth used in EE|UE population|UEs on beam|Served-UE throughput|Served UE SINR|Raw power per beam|Raw power share per UE|Waiting for|Measured across|Load-dependent|EE aggregation|Mbits\/J|Mbps/,
  'zh-TW must not leak the card\'s old hardcoded English labels',
);
assert.doesNotMatch(text, /5th percentile|95th percentile|range/);
assert.doesNotMatch(text, /Profile bandwidth 500\.0 MHz/);
assert.doesNotMatch(text, /SINR values available|Finite numeric SINR among served UEs/);
assert.doesNotMatch(markup, /data-testid="energy-efficiency-valid-sinr"/);
assert.doesNotMatch(markup, /data-testid="energy-efficiency-reference"/);
assert.doesNotMatch(markup, /data-testid="energy-efficiency-formula"/);
assert.doesNotMatch(text, /Chapter 5 reference/);
assert.doesNotMatch(text, /596\.92/);
assert.doesNotMatch(text, /Each UE is calculated first/);
assert.doesNotMatch(text, /Paper definition|Eq\. \(3\.39\)|Current raw beam-power input|At median/);
assert.doesNotMatch(text, /\bp50\b|\bp95\b|Valid SINR|B \/ K|U b/);
assert.doesNotMatch(text, /Ch5 demo/i);
assert.doesNotMatch(text, /live baseline/i);
assert.doesNotMatch(text, /Published/i);

const emptyMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="zh-TW">
    <EnergyEfficiencyCard
      energyEfficiency={null}
      powerSurface={powerSurface}
    />
  </LocaleProvider>,
);
const emptyText = textOf(emptyMarkup);
assert.doesNotMatch(emptyText, /Current-frame mean over all|unserved UEs count as 0/);
assert.match(emptyText, /等待使用者分配結果/);
assert.doesNotMatch(emptyText, /Chapter 5 reference|596\.92/);

const englishMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <EnergyEfficiencyCard
      energyEfficiency={energyEfficiency}
      powerSurface={powerSurface}
    />
  </LocaleProvider>,
);
const englishText = textOf(englishMarkup);
assert.match(englishText, /Field-wide instantaneous EE 200\.00 Mbit\/J/);
assert.match(englishText, /Mean EE of served users 250\.00 Mbit\/J 80 served users/);
assert.match(englishText, /Coverage 80\.0% 80 \/ 100 users served/);
assert.match(englishText, /Total users 100 users 80 served · 20 unserved/);
assert.match(englishText, /Users per beam \(s,v\) Mean 3\.2 users Measured across active beams/);
assert.match(englishText, /Throughput of served users Mean 190\.0 Mbit\/s EE numerator R_u/);
assert.match(englishText, /Signal quality of served users Mean -5\.8 dB Measured across served users/);
assert.match(englishText, /Power per beam Mean 0\.82 W Load-dependent raw power per beam/);
assert.match(englishText, /Power share per user Mean 0\.41 W Raw beam power ÷ U_s,v/);

console.log('Energy efficiency presentation validation passed.');
