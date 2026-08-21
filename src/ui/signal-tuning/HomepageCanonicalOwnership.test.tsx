import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderToStaticMarkup } from 'react-dom/server';
import { LocaleProvider } from '../../i18n';
import { buildSimulationAnalysisFrame, createSimulatorTleState } from '../../simulator/analysis';
import { loadTleSnapshotSelection, loadTleWebArchiveCatalog } from '../../simulator/archive';
import { DEFAULT_SIMULATOR_PARAMETERS, type SimulatorTab } from '../../simulator/types';
import { CanonicalSourceControls } from './CanonicalSourceControls';
import { CanonicalSinrTab } from './CanonicalSinrTab';
import { HomepageCanonicalAnalysis } from './HomepageCanonicalAnalysis';
import { HomepageCanonicalControls } from './HomepageCanonicalControls';
import { HomepageCanonicalServingComparison } from './HomepageCanonicalServingComparison';
import { HomepageRightRail } from './HomepageRightRail';
import type { HomepageCanonicalAnalysisState } from './useHomepageCanonicalAnalysis';

const fetchFromPublic = async (path: RequestInfo | URL): Promise<Response> => (
  new Response(await readFile(`public${String(path)}`), { status: 200 })
);

const catalog = await loadTleWebArchiveCatalog('/tle-archive/oneweb/catalog.json', fetchFromPublic);
const selection = await loadTleSnapshotSelection(catalog, '2026-08-07T23:59:59.000Z', fetchFromPublic);
const tleState = createSimulatorTleState(selection, '2026-08-07T23:59:59.000Z');
const frame = buildSimulationAnalysisFrame(tleState, DEFAULT_SIMULATOR_PARAMETERS);

const analysis: HomepageCanonicalAnalysisState = {
  frame,
  visualNextFrame: frame,
  evaluation: {
    deliveredBits: frame.ee.deliveredBits,
    consumedEnergyJ: frame.ee.consumedEnergyJ,
    energyEfficiencyBitsPerJ: frame.ee.evaluationBitsPerJ,
    durationSec: frame.ee.durationS,
  },
  resetEvaluation: () => {},
  catalog,
  status: 'ready',
  error: null,
  requestedConstellation: 'oneweb',
  setRequestedConstellation: () => {},
  resetRequestedConstellation: () => {},
  taipeiDateTime: '2026-08-08T07:59',
  setTaipeiDateTime: () => {},
  resetTaipeiDateTime: () => {},
  parameters: { ...DEFAULT_SIMULATOR_PARAMETERS },
  setParameters: () => {},
  resetParameters: () => {},
  frameOptions: { userPositionOverridesKm: [] },
  setFrameOptions: () => {},
  resetFrameOptions: () => {},
  runReady: true,
  runProgress: {
    status: 'complete',
    completedAnchors: 241,
    totalAnchors: 241,
    anchorIndex: 240,
    anchorUtc: frame.tleState.requestedInstantUtc,
    fraction: 1,
    progress: 1,
  },
  timeResolution: null,
  timeFallbackSearch: null,
  timelineDurationSec: 7200,
  timelineCurrentTimeSec: frame.runAnchor?.elapsedSec ?? 0,
  timelineStepSec: 30,
  selectTimelineTimeSec: () => {},
};

const tabs: readonly SimulatorTab[] = ['sinr', 'ee', 'power', 'throughput'];
const renderControls = (activeTab: SimulatorTab): string => renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <HomepageCanonicalControls
      analysis={analysis}
      activeTab={activeTab === 'ee' ? 'energy' : activeTab}
      onActiveTabChange={() => {}}
    />
  </LocaleProvider>,
);
const controlsMarkup = tabs.map(renderControls).join('\n');
const scenarioControlsMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <HomepageCanonicalControls analysis={analysis} activeTab="scenario" onActiveTabChange={() => {}} />
  </LocaleProvider>,
);
const sourceControlsMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <CanonicalSourceControls analysis={analysis} />
  </LocaleProvider>,
);
const mismatchedControlsMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <CanonicalSourceControls analysis={{ ...analysis, requestedConstellation: 'starlink' }} />
  </LocaleProvider>,
);

const sinrMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <CanonicalSinrTab analysis={analysis} />
  </LocaleProvider>,
);
const sinrBeamMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <CanonicalSinrTab analysis={analysis} initialSection="beam" />
  </LocaleProvider>,
);
const sinrChannelMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <CanonicalSinrTab analysis={analysis} initialSection="channel" />
  </LocaleProvider>,
);
const sinrInterferenceMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <CanonicalSinrTab analysis={analysis} initialSection="interference" />
  </LocaleProvider>,
);
const sinrNoiseMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <CanonicalSinrTab analysis={analysis} initialSection="noise" />
  </LocaleProvider>,
);
const rightRailMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <HomepageRightRail analysis={analysis} />
  </LocaleProvider>,
);
const composedRightRailMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <HomepageRightRail analysis={analysis}>
      <div data-testid="serving-candidate-sentinel">Serving / candidate</div>
    </HomepageRightRail>
  </LocaleProvider>,
);
const comparisonMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <HomepageCanonicalServingComparison frame={frame} />
  </LocaleProvider>,
);

assert.match(scenarioControlsMarkup, /data-testid="scenario-data-page"/);
assert.match(scenarioControlsMarkup, /data-testid="scenario-data-hour"[^>]*aria-label="Hour \(24-hour\)"/);
assert.match(scenarioControlsMarkup, /data-testid="scenario-data-minute"[^>]*aria-label="Minute"/);
assert.doesNotMatch(scenarioControlsMarkup, /AM|PM|上午|下午/);
assert.match(sourceControlsMarkup, /id="homepage-constellation-oneweb"/);
assert.match(sourceControlsMarkup, /id="homepage-constellation-starlink"/);
assert.match(sourceControlsMarkup, /data-testid="homepage-tle-time-control"[^>]*type="datetime-local"/);
assert.match(sourceControlsMarkup, /data-testid="homepage-tle-time-reset"/);
assert.match(sourceControlsMarkup, /data-testid="homepage-constellation-reset"/);
assert.match(mismatchedControlsMarkup, /data-requested-constellation="starlink"/);
assert.doesNotMatch(mismatchedControlsMarkup, /data-testid="homepage-tle-time-control"[^>]*\bmin=/);
assert.doesNotMatch(mismatchedControlsMarkup, /data-testid="homepage-tle-time-control"[^>]*\bmax=/);

// The left rail owns formulas and the actual SINR controls. Derived power,
// throughput, and EE values are not duplicated there.
assert.match(controlsMarkup, /SINR formula and inputs/);
assert.match(controlsMarkup, /Energy efficiency/);
assert.match(controlsMarkup, /P<sup>N<\/sup>/);
assert.doesNotMatch(controlsMarkup, /P<sub>event<\/sub>|J\/frame|Read-only|唯讀/);
for (const testId of [
  'sinr-result-signal',
  'ee-result-throughput',
  'power-result-system',
  'throughput-result-total-rate',
]) {
  assert.doesNotMatch(controlsMarkup, new RegExp(`data-testid="${testId}"`));
}

const topFormulaStart = sinrMarkup.indexOf('data-testid="homepage-sinr-top-formula"');
assert.notEqual(topFormulaStart, -1);
const topFormula = sinrMarkup.slice(topFormulaStart, sinrMarkup.indexOf('</div>', topFormulaStart));
assert.match(topFormula, /γ<sub>u,s,v<\/sub>\(t,[\s\S]*θ[\s\S]*\)/);
assert.match(topFormula, /<i>p<\/i><sub>u,s,v<\/sub>\(t, θ<sub>u,s,v<\/sub>\)/);
assert.match(topFormula, /H<sub>u,s,v<\/sub>\(t\)/);
assert.match(topFormula, /G<sup>T<\/sup>\(θ<sub>u,s,v<\/sub>\)/);
assert.match(topFormula, /I<sub>u,s,v<\/sub>\(t,[\s\S]*θ[\s\S]*\) \+ σ²/);
assert.doesNotMatch(topFormula, /<i>p<\/i><sup>r<\/sup>|h<sub>|G<sup>(?:R|LS)<\/sup>|SINR =/);
assert.match(sinrMarkup, /id="canonical-sinr-section-tab-power"[^>]*aria-selected="true"/);
assert.match(sinrMarkup, /data-testid="canonical-sinr-power-chain"/);
assert.match(sinrBeamMarkup, /data-testid="canonical-sinr-formula-beam"[\s\S]*G<sup>T<\/sup>\(θ<sub>u,s,v<\/sub>\)/);
assert.match(sinrChannelMarkup, /data-testid="canonical-sinr-formula-channel"[\s\S]*H<sub>u,s,v<\/sub>\(t\)/);
assert.match(sinrChannelMarkup, /data-testid="sinr-tab-carrier-frequency-control"/);
assert.match(sinrInterferenceMarkup, /data-testid="canonical-sinr-formula-interference"[\s\S]*I<sub>u,s,v<\/sub>/);
assert.match(sinrInterferenceMarkup, /data-testid="sinr-tab-frequency-reuse-control"/);
assert.doesNotMatch(sinrInterferenceMarkup, /canonical-sinr-interference-full-formula|I<sup>[ab]<\/sup>/);
assert.match(sinrNoiseMarkup, /σ²\s*=\s*B<sup>w<\/sup>\s*·\s*N<sub>0<\/sub>/);
assert.doesNotMatch(`${sinrMarkup}${sinrBeamMarkup}${sinrChannelMarkup}`, /G<sup>(?:R|LS)<\/sup>|L<sub>|θ<sub>3dB<\/sub>|H<sub>u,b<\/sub>/);

// The right rail is result-only and keeps one accepted frame as its source.
assert.match(rightRailMarkup, /data-testid="homepage-right-rail"/);
assert.match(rightRailMarkup, /data-result-layout="persistent-collapsible"/);
for (const testId of [
  'homepage-result-section-sinr',
  'homepage-result-section-power',
  'homepage-result-section-throughput',
  'homepage-result-section-ee',
  'sinr-result-value',
  'power-result-system',
  'throughput-result-total-rate',
  'ee-result-evaluation',
]) {
  assert.match(rightRailMarkup, new RegExp(`data-testid="${testId}"`));
}
assert.doesNotMatch(rightRailMarkup, /<input\b|<select\b|<textarea\b|contenteditable="true"/);
assert.doesNotMatch(rightRailMarkup, /data-control-active="true"|目前波束配置/);
assert.ok(
  composedRightRailMarkup.indexOf('serving-candidate-sentinel')
    < composedRightRailMarkup.indexOf('homepage-canonical-results'),
  'the serving/candidate block must stay above appended canonical results',
);

assert.match(comparisonMarkup, new RegExp(`data-analysis-frame-id="${frame.frameId}"`));
assert.match(comparisonMarkup, new RegExp(`data-serving-satellite-id="${frame.selectedSatelliteId}"`));
assert.match(comparisonMarkup, /data-formula-authority="canonical-tle-analysis-frame"/);
assert.match(comparisonMarkup, /data-testid="canonical-serving-actual-power"/);
assert.match(comparisonMarkup, /data-testid="canonical-candidate-actual-power"/);
assert.match(comparisonMarkup, /data-testid="canonical-serving-instantaneous-ee"/);
assert.doesNotMatch(comparisonMarkup, /canonical-(?:serving|candidate)-(?:requested|before-satellite-cap)-power|上限狀態|Cap status/);
assert.doesNotMatch(`${rightRailMarkup}${comparisonMarkup}`, /P_DL(?:,actual|_actual)|computeLinkBudget/);

const resultIdsByTab: Readonly<Record<SimulatorTab, readonly string[]>> = {
  sinr: ['sinr-result-signal', 'sinr-result-channel-gain', 'sinr-result-beam-gain', 'sinr-result-interference', 'sinr-result-noise', 'sinr-result-value'],
  ee: ['ee-result-throughput', 'ee-result-system-power', 'ee-result-evaluation'],
  power: ['power-result-requested', 'power-result-pa', 'power-result-pa-efficiency', 'power-result-fixed', 'power-result-system'],
  throughput: ['throughput-result-beam-bandwidth', 'throughput-result-serving-beam-load', 'throughput-result-sinr', 'throughput-result-rate', 'throughput-result-total-rate'],
};

for (const tab of tabs) {
  const markup = renderToStaticMarkup(
    <LocaleProvider initialLocale="en">
      <HomepageCanonicalAnalysis activeTab={tab} analysis={analysis} />
    </LocaleProvider>,
  );
  assert.match(markup, /data-testid="homepage-canonical-results"/);
  for (const testId of resultIdsByTab[tab]) {
    assert.match(markup, new RegExp(`data-testid="${testId}"`));
  }
  assert.doesNotMatch(markup, /<input\b|type="range"|type="datetime-local"|homepage-constellation-/);
  assert.doesNotMatch(markup, /CANONICAL\s*·|family-b-thesis|frame\s+analysis-[0-9a-f]+/);
}

console.log('Homepage ownership keeps formulas and controls on the left and accepted-frame values on the right.');
