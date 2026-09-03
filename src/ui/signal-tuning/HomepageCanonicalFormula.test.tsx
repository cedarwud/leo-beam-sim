import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderToStaticMarkup } from 'react-dom/server';
import { LocaleProvider } from '../../i18n';
import {
  buildSimulationAnalysisFrame,
  createSimulatorTleState,
} from '../../simulator/analysis';
import {
  loadTleSnapshotSelection,
  loadTleWebArchiveCatalog,
} from '../../simulator/archive';
import { DEFAULT_SIMULATOR_PARAMETERS, type SimulationAnalysisFrame } from '../../simulator/types';
import { HomepageCanonicalAnalysis } from './HomepageCanonicalAnalysis';
import { HomepageCanonicalServingComparison } from './HomepageCanonicalServingComparison';
import { formatPower } from './formatters';
import type { HomepageCanonicalAnalysisState } from './useHomepageCanonicalAnalysis';

const fetchFromPublic = async (path: RequestInfo | URL): Promise<Response> => (
  new Response(await readFile(`public${String(path)}`), { status: 200 })
);

const catalog = await loadTleWebArchiveCatalog('/tle-archive/oneweb/catalog.json', fetchFromPublic);
const selection = await loadTleSnapshotSelection(catalog, '2026-08-07T23:59:59.000Z', fetchFromPublic);
const frame = buildSimulationAnalysisFrame(
  createSimulatorTleState(selection, '2026-08-07T23:59:59.000Z'),
  DEFAULT_SIMULATOR_PARAMETERS,
);
const link = frame.links[0]!;
const denominatorW = link.interferenceW + link.noiseW;

// The displayed SINR must remain the canonical frame result, not a page-local
// approximation.  The fixture also exercises the fW power formatter path.
assert.ok(denominatorW > 0 && Number.isFinite(denominatorW));
assert.ok(
  Math.abs(link.signalW / denominatorW - link.sinrLinear)
    <= Number.EPSILON * Math.max(Math.abs(link.sinrLinear), 1),
  'S / (I + noise) must equal the frame-owned SINR ratio',
);
assert.ok(
  Math.abs(10 * Math.log10(Math.max(link.sinrLinear, 1e-30)) - link.sinrDb)
    <= Number.EPSILON * Math.max(Math.abs(link.sinrDb), 1),
  'the frame-owned SINR dB value must be the 10 log10 conversion of the ratio',
);
for (const power of [link.signalW, link.interferenceW, link.noiseW]) {
  assert.match(formatPower(power), /W$/, `power field must be formatted with watts: ${power}`);
}
assert.match(formatPower(link.signalW), /fW$/);
assert.match(formatPower(link.noiseW), /fW$/);
assert.equal(formatPower(1e-18), '1 aW');
assert.equal(formatPower(1e-15), '1 fW');

const analysis = {
  frame,
  visualNextFrame: frame,
  evaluation: {
    deliveredBits: frame.ee.deliveredBits,
    consumedEnergyJ: frame.ee.consumedEnergyJ,
    energyEfficiencyBitsPerJ: frame.ee.evaluationBitsPerJ,
    durationSec: frame.ee.durationS,
  },
  resetEvaluation: () => {},
  status: 'ready',
  error: null,
} as unknown as HomepageCanonicalAnalysisState;
const sinrMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <HomepageCanonicalAnalysis activeTab="sinr" analysis={analysis} />
  </LocaleProvider>,
);
const comparisonMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <HomepageCanonicalServingComparison frame={frame} />
  </LocaleProvider>,
);
const handoverFrame = Object.freeze({
  ...frame,
  handover: Object.freeze({
    anchorIndex: 2,
    instantUtc: frame.instantUtc,
    offsetDb: 3,
    tttSec: 30,
    progressSec: 15,
    ratio: 0.5,
    cumulativeCount: 2,
    state: 'pending' as const,
    event: 'none' as const,
    reason: 'candidate satisfies offset',
    servingSatelliteId: link.satelliteId,
    candidateSatelliteId: frame.candidateLink?.satelliteId ?? null,
    servingVisible: true,
    candidateVisible: frame.candidateLink !== null,
    servingSinrDb: link.sinrDb,
    candidateSinrDb: frame.candidateLink?.sinrDb ?? null,
    deltaDb: frame.candidateLink === null ? null : frame.candidateLink.sinrDb - link.sinrDb,
    eventFromSatelliteId: null,
    eventToSatelliteId: null,
  }),
}) satisfies SimulationAnalysisFrame;
const handoverComparisonMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <HomepageCanonicalServingComparison frame={handoverFrame} />
  </LocaleProvider>,
);

for (const testId of [
  'sinr-result-channel-gain',
  'sinr-result-beam-gain',
]) {
  const row = sinrMarkup.match(new RegExp(`data-testid="${testId}"[\\s\\S]*?</div>`))?.[0];
  assert.ok(row, `${testId} should be visible in the homepage SINR result`);
  assert.doesNotMatch(row, /(?:^|\s)linear(?:<|$)/);
}
assert.doesNotMatch(sinrMarkup, /G<sup>LS<\/sup>|L<sub>(?:FS|atm|scan)<\/sub>/);
assert.match(sinrMarkup, /data-testid="sinr-result-beam-bandwidth"[\s\S]*?(?:MHz|GHz)/);
assert.match(sinrMarkup, /Effective channel factor H<sub[^>]*>u,s,v<\/sub>\(t\)/);
assert.match(sinrMarkup, /Transmit gain from the link off-axis angle and θ₃dB/);
assert.doesNotMatch(sinrMarkup, /H<sub>u,b<\/sub>|Propagation and fading gain/);
assert.doesNotMatch(sinrMarkup, /data-testid="sinr-canonical-formula-header"/);
assert.doesNotMatch(sinrMarkup, /data-testid="sinr-result-scope"/);
assert.match(sinrMarkup, /data-testid="sinr-result-signal"[\s\S]*?>Received signal power[\s\S]*?Product of p, H, and G/);
assert.match(sinrMarkup, /data-testid="sinr-result-interference"[\s\S]*?Total co-channel interference/);
assert.match(sinrMarkup, /data-testid="sinr-result-noise"[\s\S]*?Noise power in the SINR denominator/);
assert.doesNotMatch(sinrMarkup, /Useful signal|Useful received power|有用訊號/);
assert.match(sinrMarkup, /data-testid="sinr-result-reuse-color"[\s\S]*?>1<\/strong>/);
assert.doesNotMatch(sinrMarkup, /A higher SINR means|SINR 越高/);
for (const testId of [
  'canonical-serving-actual-power',
  'canonical-candidate-actual-power',
  'canonical-serving-instantaneous-ee',
  'canonical-candidate-instantaneous-ee',
]) {
  const row = comparisonMarkup.match(new RegExp(`data-testid="${testId}"[\\s\\S]*?</div>`))?.[0];
  assert.ok(row, `${testId} should be visible in the serving/candidate comparison`);
  assert.doesNotMatch(row, /(?:^|\s)linear(?:<|$)/);
}
assert.match(sinrMarkup, /data-testid="sinr-result-value"[\s\S]*?dB/);
assert.doesNotMatch(sinrMarkup, /Linear value|線性值/);
assert.doesNotMatch(comparisonMarkup, /同一時刻|same instant/);
assert.doesNotMatch(comparisonMarkup, /同刻功率與速率|Same-instant power and rate/);
assert.doesNotMatch(comparisonMarkup, /兩鏈路都未碰到功率上限|When neither link hits a power cap/);
assert.doesNotMatch(comparisonMarkup, /live context/i);
assert.doesNotMatch(comparisonMarkup, /canonical-(?:serving|candidate)-(?:requested|before-satellite-cap)-power/);
assert.doesNotMatch(comparisonMarkup, /上限狀態|Cap status/);
assert.match(comparisonMarkup, /data-testid="canonical-serving-instantaneous-ee"[\s\S]*?bit\/J/);
assert.match(comparisonMarkup, /data-testid="canonical-candidate-instantaneous-ee"/);
for (const testId of [
  'sinr-result-signal',
  'sinr-result-interference',
  'sinr-result-noise',
]) {
  const row = sinrMarkup.match(new RegExp(`data-testid="${testId}"[\\s\\S]*?</div>`))?.[0];
  assert.ok(row, `${testId} should be visible in the SINR result`);
  assert.match(row, /fW/);
}
assert.doesNotMatch(`${sinrMarkup}${comparisonMarkup}`, />linear</);
assert.match(handoverComparisonMarkup, /data-handover-state="pending"/);
assert.match(handoverComparisonMarkup, /data-handover-count="2"/);
assert.match(handoverComparisonMarkup, /\+3\.0 dB/);
assert.match(handoverComparisonMarkup, /15\.0 \/ 30\.0 s/);
assert.match(handoverComparisonMarkup, /data-testid="info-panel-duel-handover-count"[\s\S]*?>2</);
assert.match(handoverComparisonMarkup, /data-testid="canonical-tle-handover-reason"/);
assert.match(handoverComparisonMarkup, /candidate satisfies offset/);
assert.doesNotMatch(handoverComparisonMarkup, /Switching data is unavailable/);

console.log('Homepage canonical SINR closure and dimensionless/watt readouts are consistent.');
