import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderToStaticMarkup } from 'react-dom/server';
import { LocaleProvider } from '../../i18n';
import { buildSimulationAnalysisFrame, createSimulatorTleState } from '../../simulator/analysis';
import { loadTleSnapshotSelection, loadTleWebArchiveCatalog } from '../../simulator/archive';
import { DEFAULT_SIMULATOR_PARAMETERS } from '../../simulator/types';
import { HomepageCanonicalAnalysis } from './HomepageCanonicalAnalysis';
import { HomepageCanonicalServingComparison } from './HomepageCanonicalServingComparison';
import { HomepageRightRail } from './HomepageRightRail';
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
const analysis = {
  frame,
  resetEvaluation: () => {},
  evaluation: {
    deliveredBits: 0,
    consumedEnergyJ: 0,
    energyEfficiencyBitsPerJ: 0,
    durationSec: 0,
  },
  status: 'ready',
  error: null,
} as unknown as HomepageCanonicalAnalysisState;

const eeMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <HomepageCanonicalAnalysis activeTab="ee" analysis={analysis} />
  </LocaleProvider>,
);
const sinrMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <HomepageCanonicalAnalysis activeTab="sinr" analysis={analysis} />
  </LocaleProvider>,
);
const railMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <HomepageRightRail analysis={analysis} />
  </LocaleProvider>,
);
const comparisonMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <HomepageCanonicalServingComparison frame={frame} />
  </LocaleProvider>,
);
const emptyFrameAnalysis = {
  ...analysis,
  frame: null,
  visualNextFrame: null,
  evaluation: {
    deliveredBits: 0,
    consumedEnergyJ: 0,
    energyEfficiencyBitsPerJ: 0,
    durationSec: 0,
  },
} as unknown as HomepageCanonicalAnalysisState;
const emptyFrameEeMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <HomepageCanonicalAnalysis activeTab="ee" analysis={emptyFrameAnalysis} />
  </LocaleProvider>,
);
const rawErrorAnalysis = {
  ...emptyFrameAnalysis,
  error: 'SGP4 failed for 47380 at the requested instant',
} as unknown as HomepageCanonicalAnalysisState;
const rawErrorMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <HomepageCanonicalAnalysis activeTab="sinr" analysis={rawErrorAnalysis} />
  </LocaleProvider>,
);
const emptyFrameRightRailMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <HomepageRightRail analysis={emptyFrameAnalysis} />
  </LocaleProvider>,
);
const powerMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <HomepageCanonicalAnalysis activeTab="power" analysis={analysis} />
  </LocaleProvider>,
);

assert.match(eeMarkup, /data-testid="ee-result-evaluation"[^>]*>[\s\S]*?<strong[^>]*>[^<]+<\/strong>/);
assert.match(eeMarkup, /η<sub>u,s,v<\/sub>\(t,[\s\S]*θ[\s\S]*\)/);
assert.doesNotMatch(eeMarkup, /data-testid="ee-result-instantaneous"/);
assert.doesNotMatch(eeMarkup, /data-testid="ee-canonical-formula-row"/);
assert.doesNotMatch(eeMarkup, /Σ<sub>u<\/sub>R<sub>u<\/sub> \/ P<sub>sys<\/sub>/);
assert.match(eeMarkup, /Realized EE of the representative serving link/);
assert.doesNotMatch(eeMarkup, /EE_eval|EE<sub>eval<\/sub>|Accumulated energy efficiency|累積能源效率/);
assert.doesNotMatch(railMarkup, /data-active-result-tab=/);
assert.match(railMarkup, /data-testid="ee-result-throughput"[^>]*>[\s\S]*?<strong[^>]*>[^<]+<\/strong>/);
assert.match(railMarkup, /data-testid="ee-result-system-power"[^>]*>[\s\S]*?<strong[^>]*>[^<]+<\/strong>/);
assert.match(railMarkup, /data-testid="ee-result-evaluation"/);
assert.match(railMarkup, /data-result-layout="persistent-collapsible"/);
assert.match(railMarkup, /data-testid="homepage-result-section-sinr"/);
assert.match(railMarkup, /data-testid="homepage-result-section-power"/);
assert.match(railMarkup, /data-testid="homepage-result-section-throughput"/);
assert.match(railMarkup, /data-testid="homepage-result-section-ee"/);
assert.match(railMarkup, /data-testid="sinr-result-value"/);
assert.match(railMarkup, /data-testid="power-result-system"/);
assert.match(railMarkup, /data-testid="throughput-result-total-rate"/);
assert.match(railMarkup, /data-testid="ee-result-evaluation"/);
assert.match(sinrMarkup, /I<sub>u,s,v<\/sub>\(t,[\s\S]*θ[\s\S]*\)[\s\S]*Total co-channel interference/);
assert.doesNotMatch(sinrMarkup, /G<sup>LS<\/sup>|L<sub>(?:FS|atm|scan)<\/sub>|θ<sub>3dB<\/sub>|G<sup>R<\/sup>/);
assert.doesNotMatch(sinrMarkup, /H<sub>u,b<\/sub>/);
assert.match(emptyFrameEeMarkup, /data-testid="ee-result-evaluation"[\s\S]*?<strong[^>]*>—<\/strong>/);
assert.match(rawErrorMarkup, /Preparing results/);
assert.doesNotMatch(rawErrorMarkup, /SGP4 failed|47380/);
assert.match(emptyFrameRightRailMarkup, /data-result-layout="persistent-collapsible"/);
assert.match(emptyFrameRightRailMarkup, /data-testid="ee-result-evaluation"[\s\S]*?<strong[^>]*>—<\/strong>/);
assert.doesNotMatch(powerMarkup, /Average power from event energy|事件能量換算的平均功率|data-testid="power-result-event"/);
assert.doesNotMatch(comparisonMarkup, /single reference link has 0 W co-channel interference/);
assert.match(comparisonMarkup, /Switching data is unavailable/);
assert.doesNotMatch(comparisonMarkup, /canonical frame|counterfactual|same-frame|not fabricated|one-active-satellite/);

console.log('Homepage result semantics keep unavailable values concise and suppress runtime error details.');
