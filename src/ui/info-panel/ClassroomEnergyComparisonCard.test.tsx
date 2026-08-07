import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { LocaleProvider } from '../../i18n';
import {
  CLASSROOM_BASELINE_TX_POWER_DBM,
  CLASSROOM_CANDIDATE_TX_POWER_DBM,
  compareClassroomEnergyArms,
  type ClassroomEnergyComparisonArm,
} from '../../teaching';
import { ClassroomEnergyComparisonCard, type ClassroomEnergyComparisonCardProps } from './ClassroomEnergyComparisonCard';

const BASELINE: ClassroomEnergyComparisonArm = Object.freeze({
  role: 'baseline',
  txPowerDbm: CLASSROOM_BASELINE_TX_POWER_DBM,
  windowStartSimTimeSec: 100,
  windowEndSimTimeSec: 160,
  elapsedSec: 60,
  comparisonContextKey: 'ssr-context',
  cumulativeDataMbit: 100,
  totalEnergyJ: 100,
  lowSinrRatioPct: 10,
  runEeMbitPerJ: 1,
  lowSinrThresholdDb: 14,
  handoverCount: 2,
  servingLoad: 1,
  servingSinrDb: 10,
  throughputMbps: 10,
  serviceStatus: 'served',
  serviceIdentity: 'sat-a/cell-0',
  producerStatus: 'valid',
  absenceReason: null,
});

const CANDIDATE: ClassroomEnergyComparisonArm = Object.freeze({
  role: 'candidate',
  txPowerDbm: CLASSROOM_CANDIDATE_TX_POWER_DBM,
  windowStartSimTimeSec: 100,
  windowEndSimTimeSec: 160,
  elapsedSec: 60,
  comparisonContextKey: 'ssr-context',
  cumulativeDataMbit: 96,
  totalEnergyJ: 90,
  lowSinrRatioPct: 12,
  runEeMbitPerJ: 1.1,
  lowSinrThresholdDb: 14,
  handoverCount: 3,
  servingLoad: 1,
  servingSinrDb: 9,
  throughputMbps: 9,
  serviceStatus: 'served',
  serviceIdentity: 'sat-a/cell-0',
  producerStatus: 'valid',
  absenceReason: null,
});

function props(overrides: Partial<ClassroomEnergyComparisonCardProps> = {}): ClassroomEnergyComparisonCardProps {
  return {
    baseline: BASELINE,
    candidate: CANDIDATE,
    result: compareClassroomEnergyArms(BASELINE, CANDIDATE),
    currentTxPowerDbm: CLASSROOM_BASELINE_TX_POWER_DBM,
    currentLowSinrThresholdDb: 14,
    baselineTargetTxPowerDbm: CLASSROOM_BASELINE_TX_POWER_DBM,
    candidateTargetTxPowerDbm: CLASSROOM_CANDIDATE_TX_POWER_DBM,
    baselineCapture: { canCapture: true, reason: null },
    candidateCapture: { canCapture: true, reason: null },
    contextDrifted: false,
    onCaptureBaseline: () => {},
    onCaptureCandidate: () => {},
    onClearArms: () => {},
    ...overrides,
  };
}

function render(propsValue: ClassroomEnergyComparisonCardProps, locale: 'zh-TW' | 'en'): string {
  return renderToStaticMarkup(
    <LocaleProvider initialLocale={locale}>
      <ClassroomEnergyComparisonCard {...propsValue} />
    </LocaleProvider>,
  );
}

const qualifiedZh = render(props(), 'zh-TW');
assert.match(qualifiedZh, /T5 實際資料功率減降反證/);
assert.match(qualifiedZh, /替換基準快照/);
assert.match(qualifiedZh, /替換候選快照/);
assert.match(qualifiedZh, /衛星發射功率/);
assert.match(qualifiedZh, /已累積時間/);
assert.match(qualifiedZh, /累積傳輸資料量/);
assert.match(qualifiedZh, /總耗能/);
assert.match(qualifiedZh, /整段累積效率/);
assert.match(qualifiedZh, /低 SINR 比例（&lt; 14 dB）/);
assert.match(qualifiedZh, /換手次數/);
assert.equal((qualifiedZh.match(/data-gate-state="pass"/g) ?? []).length, 5);
assert.doesNotMatch(qualifiedZh, /資料不足/);

const qualifiedEn = render(props(), 'en');
assert.match(qualifiedEn, /T5 Actual-data power-reduction falsifier/);
assert.match(qualifiedEn, /Replace baseline snapshot/);
assert.match(qualifiedEn, /Replace candidate snapshot/);
assert.equal((qualifiedEn.match(/data-gate-state="pass"/g) ?? []).length, 5);
assert.doesNotMatch(qualifiedEn, /資料不足/);

const emptyCaptureControls = render(props({
  baseline: null,
  candidate: null,
  result: null,
  baselineCapture: { canCapture: false, reason: 'wrong-power' },
  candidateCapture: { canCapture: false, reason: 'timeline-running' },
}), 'zh-TW');
assert.match(emptyCaptureControls, /擷取基準快照/);
assert.match(emptyCaptureControls, /擷取候選快照/);

const failClosed = render(
  props({
    baseline: null,
    candidate: null,
    result: compareClassroomEnergyArms(BASELINE, { ...CANDIDATE, totalEnergyJ: null } as unknown as ClassroomEnergyComparisonArm),
    baselineCapture: { canCapture: false, reason: 'wrong-power' },
    candidateCapture: { canCapture: false, reason: 'timeline-running' },
  }),
  'zh-TW',
);
assert.equal((failClosed.match(/data-gate-state="missing"/g) ?? []).length, 5);
assert.match(failClosed, /—／資料不足/);
assert.doesNotMatch(failClosed, />PASS</);
assert.doesNotMatch(failClosed, />FAIL</);
assert.match(failClosed, /目前發射功率不符合此快照的目標值。/);
assert.match(failClosed, /請先暫停時間軸。/);
assert.match(failClosed, /disabled/);
assert.doesNotMatch(failClosed, /PASS|FAIL/);

const mismatch = render(
  props({
    result: compareClassroomEnergyArms(BASELINE, { ...CANDIDATE, windowEndSimTimeSec: 161 } as ClassroomEnergyComparisonArm),
    contextDrifted: true,
  }),
  'zh-TW',
);
assert.match(mismatch, /場景或設定已變更，請重新開始量測。/);
assert.match(mismatch, /量測窗口不一致/);
assert.doesNotMatch(mismatch, />PASS</);

console.log('ClassroomEnergyComparisonCard SSR validation passed.');
