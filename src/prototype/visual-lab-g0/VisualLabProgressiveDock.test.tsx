import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  DEFAULT_VISUAL_LAB_INPUTS,
  VISUAL_LAB_INPUT_DEFINITIONS,
} from '../../visualLab/experiment';
import type { VisualLabCanonicalSnapshot } from './visualLabCanonicalSnapshotAdapter';
import { VisualLabProgressiveControlDock, type VisualLabProgressiveControlDockProps } from './VisualLabProgressiveControlDock';
import { VisualLabProgressiveResultDock } from './VisualLabProgressiveResultDock';
import type { VisualLabBeamDisplayFrame } from './visualLabBeamDisplayFrame';

const snapshot: VisualLabCanonicalSnapshot = {
  schemaVersion: 'visual-lab-canonical-snapshot-v1',
  isMock: false,
  source: {
    frameId: 'test-frame', tleFrameId: 'test-tle-frame', instantUtc: '2026-08-12T12:00:00.000Z',
    instantTaipei: '2026-08-12T20:00:00+08:00', tleEpochUtc: '2026-08-12T00:00:00.000Z',
    selectedSatelliteId: 'test-serving', constellation: 'starlink', archiveId: 'test-archive',
    archiveDate: '20260812', selectedTlePath: 'test.tle', sourceKind: 'ARCHIVED_TLE',
    propagationModel: 'SGP4', contractVersion: 'family-b-thesis-3.13-3.17-v1',
  },
  timeline: {
    availability: 'available', instantUtc: '2026-08-12T12:00:00.000Z', anchorIndex: 0,
    anchorCount: 241, elapsedSec: 0, durationSec: 7_200, stepSec: 30,
    servingSatelliteId: 'test-serving', candidateSatelliteId: 'test-candidate',
    servingPassId: 'serving-pass', candidatePassId: 'candidate-pass',
  },
  serving: {
    availability: 'available', satelliteId: 'test-serving', beamId: 1, userId: 'ue-1',
    sinrLinear: 10, sinrDb: 10, requestedPowerW: 1, actualPowerW: 1,
    throughputBps: 1_000_000, instantaneousEeBitsPerJ: 100_000,
    distanceKm: 1_000, elevationDeg: 45, reason: null,
  },
  candidate: {
    availability: 'available', satelliteId: 'test-candidate', beamId: 1, userId: 'ue-1',
    sinrLinear: 12, sinrDb: 10.8, requestedPowerW: 0.9, actualPowerW: 0.9,
    throughputBps: 1_100_000, instantaneousEeBitsPerJ: null,
    distanceKm: 1_050, elevationDeg: 42, reason: null,
  },
  deltaSinrDb: 0.8,
  throughput: { servingRateBps: 1_000_000, candidateRateBps: 1_100_000, totalRateBps: 100_000_000, cumulativeDeliveredBits: 3_000_000_000 },
  power: { servingActualPowerW: 1, candidateActualPowerW: 0.9, systemPowerW: 100, cumulativeConsumedEnergyJ: 3_000 },
  ee: { instantaneousBitsPerJ: 1_000_000, cumulativeBitsPerJ: 1_000_000 },
  evaluation: { availability: 'available', source: 'homepage-canonical-evaluation', deliveredBits: 3_000_000_000, consumedEnergyJ: 3_000, energyEfficiencyBitsPerJ: 1_000_000, durationSec: 30 },
  handover: {
    availability: 'available', state: 'monitoring', event: 'none', offsetDb: 3,
    tttSec: 30, progressSec: 0, ratio: 0, cumulativeCount: 0, reason: null,
    servingSatelliteId: 'test-serving', candidateSatelliteId: 'test-candidate', deltaDb: 0.8,
    eventFromSatelliteId: null, eventToSatelliteId: null,
  },
};

const beamFrame: VisualLabBeamDisplayFrame = {
  schemaVersion: 'visual-lab-beam-display-frame-v1',
  sourceFrameId: 'test-frame',
  globalLayoutCount: 7,
  globalBeamCount: 7,
  globalSatelliteCount: 1,
  illuminationMode: 'fixed',
  serving: { satelliteId: 'test-serving', visible: true, configuredLayoutCount: 7, activeTargetCount: 7, selectedBeamId: 1, targets: [] },
  candidate: { satelliteId: 'test-candidate', visible: true, configuredLayoutCount: 7, activeTargetCount: 7, selectedBeamId: 1, targets: [] },
};

const source = { constellation: 'starlink' as const, localDateTime: '2026-08-12T20:00' };

function controlProps(locale: 'zh-Hant' | 'en', activeModule: 'scene' | 'sinr' | 'power'): VisualLabProgressiveControlDockProps {
  return {
    locale,
    activeModule,
    inputs: DEFAULT_VISUAL_LAB_INPUTS,
    acceptedSource: source,
    draftSource: source,
    applyingSource: false,
    sourceDirty: false,
    beamLayoutCount: 7,
    beamIlluminationMode: 'fixed',
    ueGeometry: activeModule === 'scene' ? {
      acceptedAngleDeg: 0.8,
      draftAngleDeg: 1.2,
      maxAngleDeg: 2.4,
      hasDraft: true,
      onAngleChange: () => undefined,
      onReset: () => undefined,
    } : null,
    onDraftSourceChange: () => undefined,
    onApplySource: () => undefined,
    onBeamLayoutCountChange: () => undefined,
    onBeamIlluminationModeChange: () => undefined,
    onPerSatelliteBeamLayoutChange: () => undefined,
    onInputChange: () => undefined,
    onResetInput: () => undefined,
    onResetAll: () => undefined,
    snapshot,
  };
}

const controls = (locale: 'zh-Hant' | 'en'): string => (
  renderToStaticMarkup(<>
    <VisualLabProgressiveControlDock {...controlProps(locale, 'sinr')} />
    <VisualLabProgressiveControlDock {...controlProps(locale, 'power')} />
  </>)
);

const zhControls = controls('zh-Hant');
const enControls = controls('en');

for (const locale of ['zh-Hant', 'en'] as const) {
  const markup = controls(locale);
  const keys = [...markup.matchAll(/data-input-key="([^"]+)"/g)].map((match) => match[1]!);
  // SINR exposes the controls owned by its selected formula term; Power keeps
  // its full ledger. The default selected term owns minimumRateBps.
  const expectedVisibleKeys = new Set([
    'minimumRateBps',
    ...VISUAL_LAB_INPUT_DEFINITIONS.filter((definition) => definition.group === 'power').map((definition) => definition.key),
  ]);
  assert.equal(keys.length, expectedVisibleKeys.size, `${locale} renders the selected SINR term and Power controls`);
  for (const key of keys) assert.equal(expectedVisibleKeys.has(key), true, `${locale} only exposes owned controls`);
  for (const key of expectedVisibleKeys) assert.equal(keys.filter((renderedKey) => renderedKey === key).length, 1, `${locale} reaches ${key}`);
  assert.doesNotMatch(markup, /data-mock|canonical|accepted frame|prototype/i, `${locale} has no implementation-status copy`);
  assert.doesNotMatch(markup, /data-input-key="(?:throughput|ee|P_DL_actual|P_sys)"/, `${locale} keeps derived values out of controls`);
}

const zhResults = renderToStaticMarkup(<VisualLabProgressiveResultDock locale="zh-Hant" snapshot={snapshot} beamFrame={beamFrame} activeModule="scene" />);
const enResults = renderToStaticMarkup(<VisualLabProgressiveResultDock locale="en" snapshot={snapshot} beamFrame={beamFrame} activeModule="scene" />);
for (const markup of [zhResults, enResults]) {
  assert.match(markup, /SINR/);
  assert.match(markup, /Power|功率/);
  assert.match(markup, /Throughput|吞吐量/);
  assert.match(markup, /Energy efficiency|能源效率/);
  assert.match(markup, /Handover|換手/);
  assert.match(markup, /Beam configuration|波束配置/);
  assert.doesNotMatch(markup, /data-mock|canonical|accepted frame|prototype/i, 'results have no implementation-status copy');
}

assert.match(enResults, /Computed results/);
assert.match(zhResults, /計算結果/);
assert.match(enControls, /Bandwidth and service demand/);
assert.match(enControls, /Reset all/);
assert.match(zhControls, /頻寬與服務需求/);

const sceneControls = renderToStaticMarkup(
  <VisualLabProgressiveControlDock {...controlProps('zh-Hant', 'scene')} />,
);
assert.doesNotMatch(sceneControls, /幾何情境書籤|Geometry bookmarks/);
assert.equal((sceneControls.match(/aria-pressed="false"/g) ?? []).length >= 3, true);
assert.match(sceneControls, /自訂日期與時間/);
assert.doesNotMatch(sceneControls, /照射方式|固定照射|波束跳躍/);
assert.doesNotMatch(sceneControls, /衛星顯示|UE 數量|單 UE|多 UE/);
assert.match(sceneControls, /UE 與波束幾何/);
assert.match(sceneControls, /離軸角/);
assert.match(sceneControls, /波束大小/);
assert.match(sceneControls, /拖曳時立即更新場景/);
assert.doesNotMatch(sceneControls, /套用並重算|取消變更/);
assert.doesNotMatch(sceneControls, /收起|聚焦場景/);
assert.match(sceneControls, /服務衛星 · test-serving/);
assert.match(sceneControls, /候選衛星 · test-candidate/);
console.log('Visual-lab progressive docks render all 17 controls and localized read-only results.');
