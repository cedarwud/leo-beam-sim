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
import {
  DEFAULT_SIMULATOR_PARAMETERS,
  type SimulatorTab,
} from '../../simulator/types';
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

const catalog = await loadTleWebArchiveCatalog(
  '/tle-archive/oneweb/catalog.json',
  fetchFromPublic,
);
const selection = await loadTleSnapshotSelection(
  catalog,
  '2026-08-07T23:59:59.000Z',
  fetchFromPublic,
);
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
const finalResultTestIds = [
  'sinr-result-signal',
  'sinr-result-off-axis-angle',
  'sinr-result-distance',
  'sinr-result-elevation',
  'sinr-result-channel-gain',
  'sinr-result-beam-gain',
  'sinr-result-receive-gain',
  'sinr-result-interference',
  'sinr-result-lagged-interference',
  'sinr-result-reuse-color',
  'sinr-result-beam-bandwidth',
  'sinr-result-system-noise-temperature',
  'sinr-result-noise',
  'sinr-result-value',
  'ee-result-throughput',
  'ee-result-system-power',
  'ee-result-delivered-bits',
  'ee-result-consumed-energy',
  'ee-result-evaluation',
  'power-result-requested',
  'power-result-before-satellite-cap',
  'power-result-actual',
  'power-result-pa-efficiency',
  'power-result-pa',
  'power-result-rfc',
  'power-result-baseband',
  'power-result-system',
  'throughput-result-gamma',
  'throughput-result-minimum-rate',
  'throughput-result-beam-bandwidth',
  'throughput-result-serving-beam-load',
  'throughput-result-sinr',
  'throughput-result-rate',
  'throughput-result-total-rate',
  'throughput-result-qos',
] as const;

function renderControls(activeTab: SimulatorTab): string {
  return renderToStaticMarkup(
    <LocaleProvider initialLocale="en">
      <HomepageCanonicalControls
        analysis={analysis}
        activeTab={activeTab === 'ee' ? 'energy' : activeTab}
        onActiveTabChange={() => {}}
      />
    </LocaleProvider>,
  );
}

const scenarioControlsMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <HomepageCanonicalControls
      analysis={analysis}
      activeTab="scenario"
      onActiveTabChange={() => {}}
    />
  </LocaleProvider>,
);

function renderResults(activeTab: SimulatorTab, state: HomepageCanonicalAnalysisState = analysis): string {
  return renderToStaticMarkup(
    <LocaleProvider initialLocale="en">
      <HomepageCanonicalAnalysis activeTab={activeTab} analysis={state} />
    </LocaleProvider>,
  );
}

function renderRightRail(state: HomepageCanonicalAnalysisState = analysis): string {
  return renderToStaticMarkup(
    <LocaleProvider initialLocale="en">
      <HomepageRightRail analysis={state} />
    </LocaleProvider>,
  );
}

const controlsMarkup = tabs.map(renderControls).join('\n');
const rightRailMarkup = renderRightRail();
const composedRightRailMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <HomepageRightRail analysis={analysis}>
      <div data-testid="serving-candidate-sentinel">Serving / candidate</div>
    </HomepageRightRail>
  </LocaleProvider>,
);
const canonicalComparisonMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <HomepageCanonicalServingComparison frame={frame} />
  </LocaleProvider>,
);
const sourceControlsMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <CanonicalSourceControls analysis={analysis} />
  </LocaleProvider>,
);
const loadingSourceControlsMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <CanonicalSourceControls
      analysis={{
        ...analysis,
        status: 'loading',
        runReady: false,
        runProgress: {
          status: 'running',
          completedAnchors: 12,
          totalAnchors: 241,
          anchorIndex: 11,
          anchorUtc: '2026-08-07T23:59:59.000Z',
          fraction: 12 / 241,
          progress: 12 / 241,
        },
      }}
    />
  </LocaleProvider>,
);
const sinrBeamControlsMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <CanonicalSinrTab analysis={analysis} initialSection="beam" />
  </LocaleProvider>,
);
const sinrNoiseControlsMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <CanonicalSinrTab analysis={analysis} initialSection="noise" />
  </LocaleProvider>,
);
const sinrChannelControlsMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <CanonicalSinrTab analysis={analysis} initialSection="channel" />
  </LocaleProvider>,
);
const sinrPowerControlsMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <CanonicalSinrTab analysis={analysis} initialSection="power" />
  </LocaleProvider>,
);
const sinrDefaultControlsMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <CanonicalSinrTab analysis={analysis} />
  </LocaleProvider>,
);
const sinrReceiverControlsMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <CanonicalSinrTab analysis={analysis} initialSection="receiver" />
  </LocaleProvider>,
);
const sinrInterferenceControlsMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <CanonicalSinrTab analysis={analysis} initialSection="interference" />
  </LocaleProvider>,
);

// A stale catalog must not leak its bounds into a different requested
// constellation while the replacement catalog is loading.
const mismatchedControlsMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <CanonicalSourceControls analysis={{ ...analysis, requestedConstellation: 'starlink' }} />
  </LocaleProvider>,
);
assert.match(mismatchedControlsMarkup, /data-requested-constellation="starlink"/);
assert.doesNotMatch(mismatchedControlsMarkup, /data-testid="homepage-tle-time-control"[^>]*\bmin=/);
assert.doesNotMatch(mismatchedControlsMarkup, /data-testid="homepage-tle-time-control"[^>]*\bmax=/);
assert.match(mismatchedControlsMarkup, /data-testid="homepage-tle-time-reset"[^>]*disabled/);

// Scenario data is now the first left-rail page. It is a local display surface;
// the existing TLE source adapter remains independently covered below.
assert.match(controlsMarkup, /id="signal-tuning-main-tab-scenario"[^>]*aria-controls="tuning-page-panel-scenario-data"/);
assert.match(scenarioControlsMarkup, /data-testid="scenario-data-page"/);
assert.match(scenarioControlsMarkup, /data-testid="scenario-data-time"[^>]*role="group"/);
assert.match(scenarioControlsMarkup, /data-testid="scenario-data-hour"[^>]*aria-label="Hour \(24-hour\)"/);
assert.match(scenarioControlsMarkup, /data-testid="scenario-data-minute"[^>]*aria-label="Minute"/);
assert.doesNotMatch(scenarioControlsMarkup, /AM|PM|上午|下午/);
assert.doesNotMatch(controlsMarkup, /data-testid="homepage-tle-scenario-disclosure"/);
assert.doesNotMatch(controlsMarkup, /data-testid="homepage-canonical-source-controls"/);
assert.match(controlsMarkup, /data-testid="homepage-model-parameter-reset"/);
assert.match(controlsMarkup, /data-testid="homepage-model-parameter-reset-button"[^>]*disabled/);
assert.match(sourceControlsMarkup, /id="homepage-constellation-oneweb"/);
assert.match(sourceControlsMarkup, /id="homepage-constellation-starlink"/);
assert.match(sourceControlsMarkup, /OneWeb/);
assert.match(sourceControlsMarkup, /Starlink/);
assert.match(sourceControlsMarkup, /data-testid="homepage-tle-time-control"[^>]*type="datetime-local"/);
assert.match(sourceControlsMarkup, /data-testid="homepage-tle-time-reset"/);
assert.match(sourceControlsMarkup, /data-testid="homepage-constellation-reset"/);
assert.match(sourceControlsMarkup, /data-testid="homepage-constellation-control"[^>]*data-source-provenance="[^"]+"[^>]*data-reset-value="starlink"/);
assert.match(sourceControlsMarkup, /data-testid="homepage-tle-time-control"[^>]*data-source-provenance="[^"]+"[^>]*data-reset-value="[^"]+"/);
assert.match(loadingSourceControlsMarkup, /data-testid="homepage-tle-run-progress"/);
assert.match(loadingSourceControlsMarkup, /<progress[^>]*max="241"[^>]*value="12"/);
assert.match(loadingSourceControlsMarkup, /12\/241 complete\./i);

// Power parameters remain editable in the left rail; EE and throughput values
// are presented as data cards rather than sliders.
for (const testId of [
  'power-tab-beam-cap-control',
  'power-tab-satellite-cap-control',
]) {
  assert.match(controlsMarkup, new RegExp(`data-testid="${testId}"[^>]*data-control-active="true"`));
}
for (const testId of [
  'ee-tab-eta-max-value',
  'ee-tab-backoff-value',
  'ee-tab-rfc-value',
  'ee-tab-bb-value',
  'throughput-tab-minimum-rate-value',
  'throughput-tab-system-bandwidth-value',
]) {
  assert.match(controlsMarkup, new RegExp(`data-testid="${testId}"[\\s\\S]*?data-readonly="true"`));
  assert.doesNotMatch(controlsMarkup, new RegExp(`data-testid="${testId.replace('-value', '-control')}"`));
}
assert.doesNotMatch(controlsMarkup, /唯讀|Read-only/i);
for (const [markup, testId] of [
  [sinrBeamControlsMarkup, 'sinr-tab-g0-control'],
  [sinrBeamControlsMarkup, 'sinr-tab-theta3db-control'],
  [sinrChannelControlsMarkup, 'sinr-tab-carrier-frequency-control'],
  [sinrChannelControlsMarkup, 'sinr-tab-atmospheric-loss-control'],
  [sinrReceiverControlsMarkup, 'sinr-tab-receiver-gain-control'],
  [sinrNoiseControlsMarkup, 'sinr-tab-antenna-noise-temperature-control'],
  [sinrNoiseControlsMarkup, 'sinr-tab-noise-figure-control'],
  [sinrNoiseControlsMarkup, 'sinr-tab-noise-reference-temperature-control'],
  [sinrInterferenceControlsMarkup, 'sinr-tab-frequency-reuse-control'],
] as const) {
  const controlTag = markup.match(new RegExp(`<div[^>]*data-testid="${testId}"[^>]*>`))?.[0];
  assert.ok(controlTag, `${testId} should render an editable control`);
  assert.match(controlTag, /data-control-active="true"/);
  assert.doesNotMatch(controlTag, /data-source-provenance=/);
  assert.match(controlTag, /data-reset-value="[^"]+"/);
}
for (const testId of [
  'sinr-tab-scintillation-control',
  'sinr-tab-shadow-fading-control',
  'sinr-tab-channel-scale-control',
]) {
  assert.doesNotMatch(sinrChannelControlsMarkup, new RegExp(`data-testid="${testId}"`));
}
assert.doesNotMatch(sinrPowerControlsMarkup, /sinr-tab-beam-cap-control/);
assert.doesNotMatch(sinrPowerControlsMarkup, /sinr-tab-satellite-cap-control/);
assert.match(sinrDefaultControlsMarkup, /id="canonical-sinr-section-tab-power"[^>]*aria-selected="true"/);
assert.doesNotMatch(sinrDefaultControlsMarkup, /id="canonical-sinr-section-tab-beam"[^>]*aria-selected="true"/);
const sinrTopFormulaStart = sinrDefaultControlsMarkup.indexOf('data-testid="homepage-sinr-top-formula"');
assert.notEqual(sinrTopFormulaStart, -1);
const sinrTopFormulaEnd = sinrDefaultControlsMarkup.indexOf('</div>', sinrTopFormulaStart);
const sinrTopFormula = sinrDefaultControlsMarkup.slice(sinrTopFormulaStart, sinrTopFormulaEnd);
assert.match(sinrTopFormula, /γ<sub>u,s,v<\/sub>\(t, θ\) =/);
assert.doesNotMatch(sinrTopFormula, /SINR =|SINR<sub>u<\/sub>/);
assert.match(sinrTopFormula, /<i>p<\/i><sup>r<\/sup><sub>u,s,v<\/sub>\(t, θ\)[\s\S]*h<sub>u,s,v<\/sub>\(t, θ\)/);
assert.match(sinrTopFormula, /I<sub>u,s,v<\/sub>\(t, θ\) \+ σ²/);
assert.doesNotMatch(sinrTopFormula, /G<sup>LS|G<sup>T|G<sup>R/);
assert.doesNotMatch(sinrDefaultControlsMarkup, /homepage-sinr-composite-channel|P̃<sub>|P̃<sup>/);
assert.match(sinrDefaultControlsMarkup, /canonical-sinr-section-tab-channel[\s\S]*h<sub>u,s,v<\/sub>\(t, θ\)/);
assert.match(sinrDefaultControlsMarkup, /canonical-sinr-section-tab-beam[\s\S]*G<sup>T<\/sup>\(θ\)/);
assert.match(sinrDefaultControlsMarkup, /canonical-sinr-section-tab-receiver[\s\S]*h<sub>u,s,v<\/sub>\(t, θ\)/);
assert.match(
  sinrInterferenceControlsMarkup,
  /data-testid="canonical-sinr-interference-full-formula"[\s\S]*γ<sub>u,s,v<\/sub>\(t, θ\)[\s\S]*<i>p<\/i><sup>r<\/sup><sub>u,s,v<\/sub>\(t, θ\)[\s\S]*h<sub>u,s,v<\/sub>\(t, θ\)[\s\S]*I<sub>u,s,v<\/sub>\(t, θ\) \+ σ²/,
);
assert.match(sinrPowerControlsMarkup, /<i>p<\/i><sup>r<\/sup><sub>u,s,v<\/sub>\(t, θ\)/);
assert.doesNotMatch(sinrPowerControlsMarkup, /P<sup>r<\/sup><sub>s,v<\/sub>|P<sup>o<\/sup><sub>s,v<\/sub>/);
assert.doesNotMatch(sinrPowerControlsMarkup, /P<sub>req,b<\/sub>|P̃<sub>|P̃<sup>/);
assert.doesNotMatch(sinrPowerControlsMarkup, /data-readonly="true"/);
assert.doesNotMatch(sinrInterferenceControlsMarkup, /sinr-tab-lagged-interference-control/);
assert.doesNotMatch(sinrReceiverControlsMarkup, /data-readonly="true"/);
assert.doesNotMatch(sinrInterferenceControlsMarkup, /data-readonly="true"/);
assert.match(controlsMarkup, /SINR formula and inputs/);
assert.match(controlsMarkup, /Energy efficiency/);
assert.match(controlsMarkup, /P<sup>N<\/sup>/);
assert.doesNotMatch(controlsMarkup, /P<sub>event<\/sub>/);
assert.doesNotMatch(controlsMarkup, /\d(?:\.\d+)?e[+-]\d/i);
assert.doesNotMatch(controlsMarkup, /J\/frame/);
assert.doesNotMatch(controlsMarkup, /canonical frame contains|Service load|data-testid="ee-open-(?:sinr|power|throughput)-tab"/);
assert.match(rightRailMarkup, /累積能源效率|Accumulated energy efficiency/);
assert.doesNotMatch(rightRailMarkup, /EE<sub>eval<\/sub>|EE_eval/);

// The right rail exposes the complete active-tab calculation fields.
assert.match(rightRailMarkup, /data-testid="homepage-right-rail"/);
assert.doesNotMatch(rightRailMarkup, /Walker/i);
assert.doesNotMatch(rightRailMarkup, /<input\b/);
assert.doesNotMatch(rightRailMarkup, /<select\b|<textarea\b|contenteditable="true"/);
assert.doesNotMatch(rightRailMarkup, /data-control-active="true"/);
assert.match(composedRightRailMarkup, /data-testid="homepage-serving-comparison"/);
assert.ok(
    composedRightRailMarkup.indexOf('serving-candidate-sentinel')
    < composedRightRailMarkup.indexOf('homepage-canonical-results'),
  'the existing serving/candidate block must stay above appended canonical results',
);
assert.match(canonicalComparisonMarkup, new RegExp(`data-analysis-frame-id="${frame.frameId}"`));
assert.match(canonicalComparisonMarkup, new RegExp(`data-serving-satellite-id="${frame.selectedSatelliteId}"`));
assert.match(canonicalComparisonMarkup, /data-candidate-satellite-id="[^"]+"/);
assert.match(canonicalComparisonMarkup, /data-formula-authority="canonical-tle-analysis-frame"/);
assert.match(canonicalComparisonMarkup, /data-handover-decision="not-in-frame"/);
assert.match(canonicalComparisonMarkup, /data-testid="canonical-serving-actual-power"/);
assert.match(canonicalComparisonMarkup, /data-testid="canonical-candidate-actual-power"/);
assert.match(canonicalComparisonMarkup, /data-testid="canonical-serving-instantaneous-ee"/);
assert.match(canonicalComparisonMarkup, /data-testid="canonical-candidate-instantaneous-ee"/);
assert.doesNotMatch(canonicalComparisonMarkup, /canonical-(?:serving|candidate)-(?:requested|before-satellite-cap)-power/);
assert.doesNotMatch(canonicalComparisonMarkup, /上限狀態|Cap status/);
assert.match(canonicalComparisonMarkup, /data-formula-symbol="p-dl-post-satellite-cap"/);
assert.doesNotMatch(canonicalComparisonMarkup, /single reference link has 0 W co-channel interference/);
assert.match(canonicalComparisonMarkup, /Candidate satellite/);
assert.match(canonicalComparisonMarkup, /Switching data is unavailable/);
assert.doesNotMatch(canonicalComparisonMarkup, /live context/i);
assert.doesNotMatch(canonicalComparisonMarkup, /counterfactual|same-frame|not a handover event|not fabricated/);
assert.doesNotMatch(canonicalComparisonMarkup, /computeLinkBudget/);
assert.doesNotMatch(`${rightRailMarkup}${canonicalComparisonMarkup}`, /P_DL(?:,actual|_actual)/);
// EE aggregation is frame/evaluation-owned; the absence of a handover policy
// in the adjacent comparison must not suppress valid EE values.
const eeResultMarkup = renderResults('ee');
assert.match(eeResultMarkup, /data-testid="ee-result-evaluation"/);
assert.match(eeResultMarkup, /data-testid="ee-result-consumed-energy"/);
const powerResultMarkup = renderResults('power');
assert.doesNotMatch(powerResultMarkup, /data-testid="power-result-event"/);
const emptyEvaluationAnalysis: HomepageCanonicalAnalysisState = {
  ...analysis,
  evaluation: {
    ...analysis.evaluation,
    energyEfficiencyBitsPerJ: 0,
    durationSec: 0,
  },
};
const emptyEeResultMarkup = renderResults('ee', emptyEvaluationAnalysis);
const emptyEeRightRailMarkup = renderRightRail(emptyEvaluationAnalysis);
assert.match(emptyEeResultMarkup, /data-testid="ee-result-evaluation"[^>]*>[\s\S]*?<strong[^>]*>—<\/strong>/);
assert.match(emptyEeRightRailMarkup, /data-result-layout="persistent-collapsible"/);
assert.match(emptyEeRightRailMarkup, /data-testid="ee-result-evaluation"[^>]*>[\s\S]*?<strong[^>]*>—<\/strong>/);

// No final result is duplicated on the left, and the old visible provenance
// banner (CANONICAL · family · frame-id) is absent from the control rail.
for (const testId of finalResultTestIds) {
  assert.doesNotMatch(controlsMarkup, new RegExp(`data-testid="${testId}"`));
}
assert.doesNotMatch(controlsMarkup, /CANONICAL\s*·/);
assert.doesNotMatch(controlsMarkup, /family-b-thesis-3\.13-3\.17-v1/);
assert.doesNotMatch(controlsMarkup, /frame\s+analysis-[0-9a-f]+/);

const resultIdsByTab: Readonly<Record<SimulatorTab, readonly string[]>> = {
  sinr: [
    'sinr-result-signal',
    'sinr-result-off-axis-angle',
    'sinr-result-distance',
    'sinr-result-elevation',
    'sinr-result-channel-gain',
    'sinr-result-beam-gain',
    'sinr-result-receive-gain',
    'sinr-result-interference',
    'sinr-result-lagged-interference',
    'sinr-result-reuse-color',
    'sinr-result-beam-bandwidth',
    'sinr-result-system-noise-temperature',
    'sinr-result-noise',
    'sinr-result-value',
  ],
  ee: [
    'ee-result-throughput',
    'ee-result-system-power',
    'ee-result-delivered-bits',
    'ee-result-consumed-energy',
    'ee-result-evaluation',
  ],
  power: [
    'power-result-requested',
    'power-result-before-satellite-cap',
    'power-result-actual',
    'power-result-pa-efficiency',
    'power-result-pa',
    'power-result-rfc',
    'power-result-baseband',
    'power-result-system',
  ],
  throughput: [
    'throughput-result-gamma',
    'throughput-result-minimum-rate',
    'throughput-result-beam-bandwidth',
    'throughput-result-serving-beam-load',
    'throughput-result-sinr',
    'throughput-result-rate',
    'throughput-result-total-rate',
    'throughput-result-qos',
  ],
};

for (const tab of tabs) {
  const resultMarkup = renderResults(tab);
  assert.match(resultMarkup, /data-testid="homepage-canonical-results"/);
  for (const testId of resultIdsByTab[tab]) {
    assert.match(resultMarkup, new RegExp(`data-testid="${testId}"`));
  }

  // The right rail is result-only: no editable source, range, date-time, or
  // constellation control may appear alongside the final projection.
  assert.doesNotMatch(resultMarkup, /<input\b/);
  assert.doesNotMatch(resultMarkup, /type="range"/);
  assert.doesNotMatch(resultMarkup, /type="datetime-local"/);
  assert.doesNotMatch(resultMarkup, /homepage-constellation-/);
  assert.doesNotMatch(resultMarkup, /data-testid="homepage-canonical-source-controls"/);
  assert.doesNotMatch(resultMarkup, /CANONICAL\s*·/);
  assert.doesNotMatch(resultMarkup, /family-b-thesis-3\.13-3\.17-v1/);
  assert.doesNotMatch(resultMarkup, /frame\s+analysis-[0-9a-f]+/);
}

console.log('Homepage ownership keeps source/parameters on the left and final projections on the right.');
