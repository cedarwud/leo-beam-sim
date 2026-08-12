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
import { HomepageCanonicalAnalysis } from './HomepageCanonicalAnalysis';
import { HomepageCanonicalControls } from './HomepageCanonicalControls';
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
  catalog,
  status: 'ready',
  error: null,
  requestedConstellation: 'oneweb',
  setRequestedConstellation: () => {},
  taipeiDateTime: '2026-08-08T07:59',
  setTaipeiDateTime: () => {},
  resetTaipeiDateTime: () => {},
  parameters: { ...DEFAULT_SIMULATOR_PARAMETERS },
  setParameters: () => {},
  resetParameters: () => {},
};

const tabs: readonly SimulatorTab[] = ['sinr', 'ee', 'power', 'throughput'];
const finalResultTestIds = [
  'sinr-result-actual-power',
  'sinr-result-signal',
  'sinr-result-interference',
  'sinr-result-noise',
  'sinr-result-value',
  'ee-result-throughput',
  'ee-result-system-power',
  'ee-result-instantaneous',
  'ee-result-evaluation',
  'ee-result-contribution-sum',
  'power-result-requested',
  'power-result-actual',
  'power-result-pa-efficiency',
  'power-result-pa',
  'power-result-overhead',
  'power-result-system',
  'throughput-result-gamma',
  'throughput-result-requested-power',
  'throughput-result-actual-power',
  'throughput-result-sinr',
  'throughput-result-rate',
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

function renderResults(activeTab: SimulatorTab): string {
  return renderToStaticMarkup(
    <LocaleProvider initialLocale="en">
      <HomepageCanonicalAnalysis activeTab={activeTab} analysis={analysis} />
    </LocaleProvider>,
  );
}

const controlsMarkup = tabs.map(renderControls).join('\n');

// A stale catalog must not leak its bounds into a different requested
// constellation while the replacement catalog is loading.
const mismatchedControlsMarkup = renderToStaticMarkup(
  <LocaleProvider initialLocale="en">
    <HomepageCanonicalControls
      analysis={{ ...analysis, requestedConstellation: 'starlink' }}
      activeTab="sinr"
      onActiveTabChange={() => {}}
    />
  </LocaleProvider>,
);
assert.match(mismatchedControlsMarkup, /data-requested-constellation="starlink"/);
assert.doesNotMatch(mismatchedControlsMarkup, /data-testid="homepage-tle-time-control"[^>]*\bmin=/);
assert.doesNotMatch(mismatchedControlsMarkup, /data-testid="homepage-tle-time-control"[^>]*\bmax=/);
assert.match(mismatchedControlsMarkup, /data-testid="homepage-tle-time-reset"[^>]*disabled/);

// The left rail owns the scenario source and every adjustable/fixed parameter.
// Both constellations are available even when the accepted frame is OneWeb.
assert.match(controlsMarkup, /id="homepage-constellation-oneweb"/);
assert.match(controlsMarkup, /id="homepage-constellation-starlink"/);
assert.match(controlsMarkup, /OneWeb/);
assert.match(controlsMarkup, /Starlink/);
assert.match(controlsMarkup, /data-testid="homepage-tle-time-control"[^>]*type="datetime-local"/);
assert.match(controlsMarkup, /data-testid="homepage-tle-time-reset"/);

// Editable parameters remain in the left rail; fixed/intermediate parameters
// are explicitly marked read-only rather than masquerading as sliders.
for (const testId of [
  'power-tab-beam-cap-control',
  'power-tab-satellite-cap-control',
  'power-tab-eta-max-control',
  'power-tab-rfc-control',
  'power-tab-bb-control',
  'throughput-tab-minimum-rate-control',
  'throughput-tab-bandwidth-control',
]) {
  assert.match(controlsMarkup, new RegExp(`data-testid="${testId}"[^>]*data-control-active="true"`));
}
assert.match(controlsMarkup, /data-readonly="true"/);
assert.match(controlsMarkup, /Currently fixed power inputs/);
assert.match(controlsMarkup, /Currently fixed service inputs/);
assert.match(controlsMarkup, /SINR calculation inputs/);
assert.match(controlsMarkup, /EE aggregation and event inputs/);

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
    'sinr-result-actual-power',
    'sinr-result-signal',
    'sinr-result-interference',
    'sinr-result-noise',
    'sinr-result-value',
  ],
  ee: [
    'ee-result-throughput',
    'ee-result-system-power',
    'ee-result-instantaneous',
    'ee-result-evaluation',
    'ee-result-contribution-sum',
  ],
  power: [
    'power-result-requested',
    'power-result-actual',
    'power-result-pa-efficiency',
    'power-result-pa',
    'power-result-overhead',
    'power-result-system',
  ],
  throughput: [
    'throughput-result-gamma',
    'throughput-result-requested-power',
    'throughput-result-actual-power',
    'throughput-result-sinr',
    'throughput-result-rate',
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
