import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { LocaleProvider } from '../../i18n';
import type { SimulationAnalysisFrame, TleWebArchiveCatalog } from '../../simulator/types';
import { CanonicalSourceControls } from './CanonicalSourceControls';
import { TleScenarioDisclosure } from './TleScenarioDisclosure';
import type { HomepageCanonicalAnalysisState } from './useHomepageCanonicalAnalysis';

const catalog = {
  constellation: 'starlink',
  firstArchiveDate: '20250727',
  lastArchiveDate: '20260812',
} as TleWebArchiveCatalog;

const frame = {
  selectedSatelliteId: '51894',
  instantTaipei: '2026-07-27T20:00:00.000',
  provenance: { constellation: 'starlink' },
  tleState: { archiveDate: '20260726' },
} as unknown as SimulationAnalysisFrame;

const base: HomepageCanonicalAnalysisState = {
  frame,
  visualNextFrame: frame,
  evaluation: { deliveredBits: 1, consumedEnergyJ: 1, energyEfficiencyBitsPerJ: 1, durationSec: 1 },
  resetEvaluation: () => {},
  catalog,
  status: 'ready',
  error: null,
  requestedConstellation: 'starlink',
  setRequestedConstellation: () => {},
  resetRequestedConstellation: () => {},
  taipeiDateTime: '2026-07-27T20:00',
  setTaipeiDateTime: () => {},
  resetTaipeiDateTime: () => {},
  applyRequestedOrbitSettings: () => {},
  orbitSettingsDirty: false,
  parameters: {} as HomepageCanonicalAnalysisState['parameters'],
  setParameters: () => {},
  resetParameters: () => {},
  frameOptions: { userPositionOverridesKm: [] },
  setFrameOptions: () => {},
  resetFrameOptions: () => {},
  runReady: true,
  runProgress: null,
  timeResolution: {
    requestedInstantUtc: '2026-07-27T12:00:00.000Z',
    appliedInstantUtc: '2026-07-27T12:00:00.000Z',
    usedFallback: false,
    offsetSeconds: 0,
    attemptedInstantCount: 1,
    exactFailure: null,
  },
  timeFallbackSearch: null,
  timelineDurationSec: 7_200,
  timelineCurrentTimeSec: 0,
  timelineStepSec: 30,
  selectTimelineTimeSec: () => {},
};

function render(analysis: HomepageCanonicalAnalysisState): string {
  return renderToStaticMarkup(
    <LocaleProvider initialLocale="zh-TW">
      <CanonicalSourceControls analysis={analysis} />
    </LocaleProvider>,
  );
}

function renderDisclosure(analysis: HomepageCanonicalAnalysisState): string {
  return renderToStaticMarkup(
    <LocaleProvider initialLocale="zh-TW">
      <TleScenarioDisclosure analysis={analysis} />
    </LocaleProvider>,
  );
}

const accepted = render(base);
assert.match(accepted, /data-testid="homepage-tle-apply"[^>]*disabled/);
assert.match(accepted, /目前使用 Starlink 的 archived TLE/);
assert.match(accepted, /模擬時間：2026-07-27 20:00:00/);
assert.doesNotMatch(accepted, />資料日期</);
assert.ok(accepted.indexOf('Starlink') < accepted.indexOf('OneWeb'));
assert.doesNotMatch(accepted, /四個分頁會共用同一筆運算狀態/);
assert.doesNotMatch(accepted, /來源：所選星系的本機 archived TLE catalog/);

const disclosure = renderDisclosure(base);
assert.match(disclosure, /模擬時間 2026-07-27 20:00:00/);
assert.doesNotMatch(disclosure, />資料日期</);

const draft = render({ ...base, orbitSettingsDirty: true, taipeiDateTime: '2026-07-28T20:00' });
assert.match(draft, /data-testid="homepage-tle-apply"/);
assert.doesNotMatch(draft, /data-testid="homepage-tle-apply"[^>]*disabled/);
assert.match(draft, /已變更但尚未套用/);
assert.match(draft, /按下「套用並重新計算」後才會更換場景與結果/);

const rebuilding = render({
  ...base,
  frame: null,
  visualNextFrame: null,
  status: 'loading',
  runReady: false,
  runProgress: {
    status: 'running',
    completedAnchors: 17,
    totalAnchors: 241,
    anchorIndex: 16,
    anchorUtc: '2026-07-27T12:08:00.000Z',
    fraction: 17 / 241,
    progress: 17 / 241,
  },
  timeResolution: null,
});
assert.match(rebuilding, /正在計算 Starlink 軌道/);
assert.match(rebuilding, /已完成 17\/241/);
assert.doesNotMatch(rebuilding, /上一筆有效結果/);

const failedRebuild = render({
  ...base,
  frame: null,
  visualNextFrame: null,
  status: 'error',
  error: 'no viable complete run',
  runReady: false,
  runProgress: null,
  timeResolution: null,
});
assert.doesNotMatch(failedRebuild, /目前不顯示未完成結果/);
assert.doesNotMatch(failedRebuild, /調整設定或重試/);
assert.doesNotMatch(failedRebuild, /no viable complete run/);
assert.doesNotMatch(failedRebuild, /右側仍保留上一筆結果/);

const fallback = render({
  ...base,
  timeResolution: {
    requestedInstantUtc: '2026-07-27T12:00:00.000Z',
    appliedInstantUtc: '2026-07-27T11:30:00.000Z',
    usedFallback: true,
    offsetSeconds: -1_800,
    attemptedInstantCount: 2,
    exactFailure: 'no complete run',
  },
});
assert.match(fallback, /data-testid="homepage-tle-time-fallback-disclosure"/);
assert.match(fallback, /原選時間：2026-07-27 20:00:00/);
assert.match(fallback, /實際套用時間：2026-07-27 19:30:00/);
assert.match(fallback, /提早 30 分/);

console.log('CanonicalSourceControls requires explicit apply and discloses nearest-time fallback.');
