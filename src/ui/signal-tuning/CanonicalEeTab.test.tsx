import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderToStaticMarkup } from 'react-dom/server';
import { LocaleProvider } from '../../i18n';
import { buildSimulationAnalysisFrame, createSimulatorTleState } from '../../simulator/analysis';
import { loadTleSnapshotSelection, loadTleWebArchiveCatalog } from '../../simulator/archive';
import { DEFAULT_SIMULATOR_PARAMETERS } from '../../simulator/types';
import { CanonicalEeTab } from './CanonicalEeTab';
import { formatEnergyEfficiency } from './formatters';
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
const analysis: HomepageCanonicalAnalysisState = {
  frame,
  visualNextFrame: frame,
  evaluation: {
    deliveredBits: 0,
    consumedEnergyJ: 0,
    energyEfficiencyBitsPerJ: 0,
    durationSec: 0,
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
  runProgress: null,
  timeResolution: null,
  timeFallbackSearch: null,
  timelineDurationSec: 7200,
  timelineCurrentTimeSec: 0,
  timelineStepSec: 30,
  selectTimelineTimeSec: () => {},
};

const markup = renderToStaticMarkup(
  <LocaleProvider initialLocale="zh-TW">
    <CanonicalEeTab analysis={analysis} />
  </LocaleProvider>,
);
const visibleText = markup.replace(/<[^>]+>/g, '');

for (const testId of [
  'ee-tab-eta-max-value',
  'ee-tab-backoff-value',
  'ee-tab-rfc-value',
  'ee-tab-bb-value',
]) {
  assert.match(markup, new RegExp(`data-testid="${testId}"`));
  assert.match(markup, new RegExp(`data-testid="${testId}"[\\s\\S]*?data-readonly="true"`));
  assert.match(markup, new RegExp(`data-testid="${testId}"[\\s\\S]*font-size:22px`));
}
const eeValueCard = markup.match(
  /data-testid="ee-tab-eta-max-value"[\s\S]*?data-testid="ee-tab-backoff-value"/,
)?.[0] ?? '';
assert.match(markup, /data-testid="ee-tab-calculated-value"[\s\S]*?data-readonly="true"/);
assert.match(markup, new RegExp(`data-testid="ee-tab-calculated-value"[\\s\\S]*?${formatEnergyEfficiency(frame.ee.instantaneousBitsPerJ)}`));
assert.match(eeValueCard, /data-control-label="true"[\s\S]*data-control-symbol="true"[\s\S]*data-control-value="true"/);
assert.doesNotMatch(markup, /ee-tab-(?:eta-max|backoff|rfc|bb)-control/);
assert.doesNotMatch(markup, /<input\\b|<select\\b|\\bdisabled(?:=|\\s|>)/);
assert.doesNotMatch(visibleText, /唯讀|Read-only/i);
assert.doesNotMatch(visibleText, /分子|分母|numerator|denominator/i);
assert.doesNotMatch(visibleText, /2\s*小時|two-hour/i);
assert.doesNotMatch(visibleText, /EEeval|EE_eval|eval/);
assert.equal((visibleText.match(/連線指示/g) ?? []).length, 1);
assert.equal((visibleText.match(/鏈路實際速率/g) ?? []).length, 1);
assert.equal((visibleText.match(/共同系統總功率/g) ?? []).length, 1);
for (const testId of [
  'homepage-ee-formula-x',
  'homepage-ee-formula-rate',
  'homepage-ee-formula-system-power',
]) {
  assert.match(markup, new RegExp(`data-testid="${testId}"`));
}
assert.doesNotMatch(markup, /data-testid="homepage-ee-formula-denominator"/);
assert.doesNotMatch(markup, /data-testid="homepage-ee-formula-numerator"/);
assert.match(markup, /P<sup>N<\/sup>/);
const xFormula = markup.match(/data-testid="homepage-ee-formula-x"[\s\S]*?data-testid="homepage-ee-formula-rate"/)?.[0] ?? '';
assert.match(xFormula, /x<sub>u,s,v<\/sub>\(t\)/);
const rateFormula = markup.match(/data-testid="homepage-ee-formula-rate"[\s\S]*?data-testid="homepage-ee-formula-system-power"/)?.[0] ?? '';
assert.match(rateFormula, /R<sub>u,s,v<\/sub>\(t, θ\)/);
assert.match(rateFormula, /B<sup>w<\/sup>/);
assert.match(rateFormula, /U<sub>s,v<\/sub>\(t\)/);
assert.match(rateFormula, /γ<sub>u,s,v<\/sub>\(t, θ\)/);
assert.match(markup, /data-testid="homepage-ee-formula-system-power"/);
assert.match(markup, /P<sup>N<\/sup>\(t, θ\)/);
assert.match(markup, /P<sup>f<\/sup>\(t\)/);
assert.match(markup, /P<sup>p<\/sup><sub>s,v<\/sub>\(t, θ\)/);
const instantaneousFormula = markup.match(/data-testid="homepage-ee-formula-instantaneous"[\s\S]*?<\/div>\s*<\/div>/)?.[0] ?? '';
assert.match(instantaneousFormula, /η<sup>e<\/sup><sub>u,s,v<\/sub>\(t, θ\)/);
assert.match(instantaneousFormula, /x<sub>u,s,v<\/sub>\(t\)R<sub>u,s,v<\/sub>\(t, θ\)/);
assert.match(instantaneousFormula, /Σ<sub>t<\/sub>P<sup>N<\/sup>\(t, θ\)Δt<sub>t<\/sub>/);
assert.doesNotMatch(instantaneousFormula, /η<sup>e<\/sup><sub>u<\/sub>\(θ\)/);
assert.doesNotMatch(markup, /η<sup>e<\/sup>\[/);
assert.doesNotMatch(markup, /<strong>Θ<\/strong>|Θ<sub>|; <strong>/);
assert.doesNotMatch(markup, /ŝ|v̂/);
assert.match(markup, /η<sup>e<\/sup>/);
assert.doesNotMatch(visibleText, /EEinst|EE_inst/);

console.log('CanonicalEeTab shows the single-link η^e_{u,s,v}(t, θ) contribution formula and current energy values.');
