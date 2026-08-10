import {
  C90_CLAIM_BOUNDARY,
  C90_CLAIM_LEVELS,
  C90_CONTRACT_VERSION,
  createValidatedCourseDataProvider,
  type CourseDataProvider,
  type CourseIdentity,
  type CourseManifest,
  type CourseOutcome,
  type CourseSceneFrame,
  type E1Arm,
  type E1ArmId,
  type E1Experiment,
  type E2Action,
  type E2Branch,
  type E2Experiment,
  type E2Trace,
  type IoTChallenge,
  type IoTTaskCard,
  type IoTTaskResult,
  type IoTRun,
  type LearningBundle,
  type LearningBundleInput,
  type ScenarioIdentity,
  type ServiceStatus,
  type TleExternalSource,
  type TleJourney,
  type TleObserver,
  type TleSource,
  type TleTimeWindow,
  type TleTrajectoryBundle,
} from '../contract';
import generatedTleStudy from './c90-tle-study.generated.json';

interface GeneratedTleStudy {
  readonly schemaVersion: 'c90-tle-study-v1';
  readonly targetUtc: string;
  readonly defaultSourceId: string;
  readonly courseSourceId: string;
  readonly defaultWindowId: TleTimeWindow['windowId'];
  readonly observer: TleObserver;
  readonly sources: readonly TleSource[];
  readonly windows: readonly TleTimeWindow[];
  readonly bundles: readonly TleTrajectoryBundle[];
  readonly externalSources: readonly TleExternalSource[];
  readonly archiveCatalogCommand: string;
  readonly updateCommand: string;
  readonly generationCommand: string;
  readonly boundary: string;
}

const TLE_STUDY_DATA = generatedTleStudy as unknown as GeneratedTleStudy;

const PROVIDER_ID = 'fixture-course-c90-v1';
const FIXTURE_ID = 'c90-ntpu-energy-fixture-v1';
const SCENARIO_ID = 'ntpu-pass-01';
const TARGET_UTC = TLE_STUDY_DATA.targetUtc;

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    if (!Object.isFrozen(value)) Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

export const C90_SCENARIO: ScenarioIdentity = Object.freeze({
  contractVersion: C90_CONTRACT_VERSION,
  providerKind: 'fixture',
  providerId: PROVIDER_ID,
  fixtureId: FIXTURE_ID,
  scenarioId: SCENARIO_ID,
  tleSourceId: TLE_STUDY_DATA.courseSourceId,
  targetUtc: TARGET_UTC,
});

const ELAPSED_SECONDS = [0, 60, 120, 180] as const;

const COURSE_TLE_BUNDLE: TleTrajectoryBundle = (() => {
  const bundle = TLE_STUDY_DATA.bundles.find(candidate => (
    candidate.sourceId === TLE_STUDY_DATA.courseSourceId
    && candidate.windowId === TLE_STUDY_DATA.defaultWindowId
  ));
  if (bundle === undefined) throw new Error('C-90 fixture is missing the course-compatible TLE trajectory bundle');
  return bundle;
})();

function courseTleFrameAtElapsed(elapsedSec: number) {
  const frame = COURSE_TLE_BUNDLE.frames.find(candidate => candidate.elapsedSec === elapsedSec);
  if (frame === undefined) {
    throw new Error(`C-90 fixture TLE bundle has no exact frame at ${elapsedSec} s`);
  }
  return frame;
}

function frameIdentity(frameId: string): CourseIdentity {
  return {
    contractVersion: C90_CONTRACT_VERSION,
    providerKind: 'fixture',
    providerId: PROVIDER_ID,
    fixtureId: FIXTURE_ID,
    scenarioId: SCENARIO_ID,
    targetUtc: TARGET_UTC,
    frameId,
  };
}

interface FrameSeries {
  readonly idPrefix: string;
  readonly elapsedSeconds?: readonly number[];
  readonly deliveredDataMbit: readonly number[];
  readonly energyJ: readonly number[];
  readonly eeMbitPerJ: readonly number[];
  readonly powerW: readonly number[];
  readonly rateMbps: readonly number[];
  readonly statuses: readonly ServiceStatus[];
  readonly qualityLabels: readonly string[];
  readonly trendLabels: readonly string[];
  readonly beamId?: string;
}

function buildFrames(series: FrameSeries): readonly CourseSceneFrame[] {
  const elapsedSeconds = series.elapsedSeconds ?? ELAPSED_SECONDS;
  if (elapsedSeconds.length !== ELAPSED_SECONDS.length) {
    throw new Error(`Invalid elapsed-second series for ${series.idPrefix}`);
  }
  return ELAPSED_SECONDS.map((_elapsedSec, frameIndex) => {
    const elapsedSec = elapsedSeconds[frameIndex];
    const trajectory = courseTleFrameAtElapsed(elapsedSec);
    return {
    identity: frameIdentity(`${series.idPrefix}-${frameIndex}`),
    frameIndex,
    elapsedSec,
    satellite: {
      id: 'oneweb-0314-norad-49100',
      position: trajectory.scene.satellitePosition,
      altitudeKm: trajectory.geodetic.altitudeKm,
    },
    beam: {
      id: series.beamId ?? 'beam-ntpu-a',
      position: [0, 16, 0],
      qualityLabel: series.qualityLabels[frameIndex],
      trendLabel: series.trendLabels[frameIndex],
    },
    link: {
      servingBeamId: series.beamId ?? 'beam-ntpu-a',
      visible: trajectory.look.visible,
      rangeKm: trajectory.look.rangeKm,
      azimuthDeg: trajectory.look.azimuthDeg,
      elevationDeg: trajectory.look.elevationDeg,
    },
    service: {
      rateMbps: series.rateMbps[frameIndex],
      deliveredDataMbit: series.deliveredDataMbit[frameIndex],
      deadlineSec: 220,
      status: series.statuses[frameIndex],
    },
    energy: {
      powerW: series.powerW[frameIndex],
      energyJ: series.energyJ[frameIndex],
      eeMbitPerJ: series.eeMbitPerJ[frameIndex],
    },
  };
  });
}

function outcome(
  completionSec: number,
  serviceStatus: ServiceStatus,
  deliveredDataMbit: number,
  powerW: number,
  energyJ: number,
  eeMbitPerJ: number,
): CourseOutcome {
  return {
    completionSec,
    deadlineSec: 220,
    serviceStatus,
    deliveredDataMbit,
    powerW,
    energyJ,
    eeMbitPerJ,
  };
}

const BALANCED_FRAMES = buildFrames({
  idPrefix: 'e1-balanced',
  elapsedSeconds: [0, 60, 120, 180],
  deliveredDataMbit: [0, 36, 78, 120],
  energyJ: [0.1, 130, 270, 402],
  eeMbitPerJ: [0, 0.277, 0.289, 0.299],
  powerW: [24, 24, 23, 22],
  rateMbps: [0, 0.6, 0.7, 0.67],
  statuses: ['served', 'served', 'served', 'served'],
  qualityLabels: ['steady', 'good', 'good', 'good'],
  trendLabels: ['baseline', 'stable', 'stable', 'stable'],
});

const LOW_POWER_FRAMES = buildFrames({
  idPrefix: 'e1-low-power',
  elapsedSeconds: [0, 72, 144, 236],
  deliveredDataMbit: [0, 24, 56, 104],
  energyJ: [0.1, 110, 246, 396],
  eeMbitPerJ: [0, 0.218, 0.228, 0.263],
  powerW: [14, 14, 13, 12],
  rateMbps: [0, 0.4, 0.53, 0.48],
  statuses: ['served', 'served', 'served', 'deadline-missed'],
  qualityLabels: ['weak', 'weak', 'fair', 'fair'],
  trendLabels: ['lower cap', 'slow start', 'late progress', 'deadline risk'],
});

const FAST_FINISH_FRAMES = buildFrames({
  idPrefix: 'e1-fast-finish',
  elapsedSeconds: [0, 47, 94, 142],
  deliveredDataMbit: [0, 44, 90, 120],
  energyJ: [0.1, 160, 310, 450],
  eeMbitPerJ: [0, 0.275, 0.29, 0.267],
  powerW: [38, 38, 36, 34],
  rateMbps: [0, 0.73, 0.77, 0.82],
  statuses: ['served', 'served', 'served', 'served'],
  qualityLabels: ['strong', 'strong', 'strong', 'strong'],
  trendLabels: ['high cap', 'fast progress', 'fast progress', 'complete early'],
});

const E1_ARMS: readonly E1Arm[] = [
  {
    id: 'balanced',
    label: 'Balanced',
    shortLabel: '平衡',
    changedPolicy: '中等功率控制；優先維持可交付服務',
    learnerPrompt: '預測：它會如何平衡完成時間與總 J？',
    frames: BALANCED_FRAMES,
    outcome: outcome(180, 'served', 120, 22, 402, 0.299),
  },
  {
    id: 'low-power',
    label: 'Low-power',
    shortLabel: '低功率',
    changedPolicy: '較低功率上限；接受較慢的資料進度',
    learnerPrompt: '預測：較低 W 是否一定讓任務更省能？',
    frames: LOW_POWER_FRAMES,
    outcome: outcome(236, 'deadline-missed', 104, 12, 396, 0.263),
  },
  {
    id: 'fast-finish',
    label: 'Fast-finish',
    shortLabel: '快速完成',
    changedPolicy: '較高功率；用更快的 rate 換取較短 active time',
    learnerPrompt: '預測：更快完成是否會抵銷較高的 W？',
    frames: FAST_FINISH_FRAMES,
    outcome: outcome(142, 'served', 120, 34, 450, 0.267),
  },
];

const E1_EXPERIMENT: E1Experiment = Object.freeze({
  id: 'E1',
  question: '同一 NTPU pass、payload 與 deadline 下，降低瞬時功率一定比較省總能量嗎？',
  scenario: C90_SCENARIO,
  payloadMbit: 120,
  deadlineSec: 220,
  arms: E1_ARMS,
  invariant: 'scenario、payload、deadline、frame clock 與 energy boundary 固定；只改離散 power policy。',
});

function buildE2Branch(
  traceId: 'trace-a' | 'trace-b',
  action: E2Action,
  values: {
    readonly data: readonly number[];
    readonly energy: readonly number[];
    readonly ee: readonly number[];
    readonly power: readonly number[];
    readonly rate: readonly number[];
    readonly status: readonly ServiceStatus[];
    readonly quality: readonly string[];
    readonly trend: readonly string[];
    readonly elapsedSeconds: readonly number[];
    readonly completionSec: number;
    readonly outcomeStatus: ServiceStatus;
    readonly outcomeData: number;
    readonly outcomePower: number;
    readonly outcomeEnergy: number;
    readonly outcomeEe: number;
  },
): E2Branch {
  const label: Record<E2Action, string> = {
    'switch-now': 'Switch now',
    wait: 'Wait for stable improvement',
    remain: 'Remain on current beam',
  };
  const rule: Record<E2Action, string> = {
    'switch-now': '看到候選鏈路變好就現在切換',
    wait: '只有改善穩定才切換',
    remain: '先留在目前鏈路直到任務結束',
  };
  const frames = buildFrames({
    idPrefix: `e2-${traceId}-${action}`,
    deliveredDataMbit: values.data,
    energyJ: values.energy,
    eeMbitPerJ: values.ee,
    powerW: values.power,
    rateMbps: values.rate,
    statuses: values.status,
    qualityLabels: values.quality,
    trendLabels: values.trend,
    elapsedSeconds: values.elapsedSeconds,
    beamId: action === 'switch-now' ? 'beam-ntpu-b' : 'beam-ntpu-a',
  });
  return {
    action,
    label: label[action],
    plainLanguageRule: rule[action],
    frames,
    outcome: outcome(
      values.completionSec,
      values.outcomeStatus,
      values.outcomeData,
      values.outcomePower,
      values.outcomeEnergy,
      values.outcomeEe,
    ),
  };
}

const TRACE_A: E2Trace = Object.freeze({
  id: 'trace-a',
  title: 'Trace A · 穩定改善',
  trend: '候選 beam 的改善會持續一段時間',
  changedInput: 'Trace A：candidate quality stable improvement',
  branches: [
    buildE2Branch('trace-a', 'switch-now', {
      data: [0, 34, 68, 110], energy: [0.1, 110, 214, 318], ee: [0, 0.309, 0.318, 0.346],
      power: [24, 24, 23, 21], rate: [0, 0.57, 0.57, 0.7], status: ['served', 'served', 'served', 'served'],
      quality: ['candidate rising', 'good', 'good', 'good'], trend: ['improving', 'stable', 'stable', 'stable'],
      elapsedSeconds: [0, 57, 113, 170],
      completionSec: 170, outcomeStatus: 'served', outcomeData: 110, outcomePower: 21, outcomeEnergy: 318, outcomeEe: 0.346,
    }),
    buildE2Branch('trace-a', 'wait', {
      data: [0, 30, 70, 110], energy: [0.1, 100, 198, 294], ee: [0, 0.3, 0.354, 0.374],
      power: [23, 22, 21, 20], rate: [0, 0.5, 0.67, 0.67], status: ['served', 'served', 'served', 'served'],
      quality: ['candidate rising', 'fair', 'good', 'good'], trend: ['wait', 'settling', 'stable', 'stable'],
      elapsedSeconds: [0, 63, 126, 188],
      completionSec: 188, outcomeStatus: 'served', outcomeData: 110, outcomePower: 20, outcomeEnergy: 294, outcomeEe: 0.374,
    }),
    buildE2Branch('trace-a', 'remain', {
      data: [0, 26, 54, 84], energy: [0.1, 108, 230, 330], ee: [0, 0.241, 0.235, 0.255],
      power: [22, 22, 21, 20], rate: [0, 0.43, 0.47, 0.5], status: ['served', 'served', 'served', 'deadline-missed'],
      quality: ['current weak', 'weak', 'weak', 'weak'], trend: ['remain', 'declining', 'declining', 'deadline risk'],
      elapsedSeconds: [0, 77, 154, 230],
      completionSec: 230, outcomeStatus: 'deadline-missed', outcomeData: 84, outcomePower: 20, outcomeEnergy: 330, outcomeEe: 0.255,
    }),
  ],
});

const TRACE_B: E2Trace = Object.freeze({
  id: 'trace-b',
  title: 'Trace B · 短暫改善後回落',
  trend: '候選 beam 只短暫變好，之後回落',
  changedInput: 'Trace B：only the future candidate-link trend changes',
  branches: [
    buildE2Branch('trace-b', 'switch-now', {
      data: [0, 32, 58, 88], energy: [0.1, 125, 244, 352], ee: [0, 0.256, 0.238, 0.25],
      power: [25, 25, 24, 22], rate: [0, 0.53, 0.43, 0.5], status: ['served', 'served', 'served', 'deadline-missed'],
      quality: ['brief rise', 'brief good', 'falling', 'weak'], trend: ['improving briefly', 'peak', 'declining', 'declining'],
      elapsedSeconds: [0, 75, 150, 224],
      completionSec: 224, outcomeStatus: 'deadline-missed', outcomeData: 88, outcomePower: 22, outcomeEnergy: 352, outcomeEe: 0.25,
    }),
    buildE2Branch('trace-b', 'wait', {
      data: [0, 34, 72, 110], energy: [0.1, 104, 205, 302], ee: [0, 0.327, 0.351, 0.364],
      power: [23, 22, 21, 20], rate: [0, 0.57, 0.63, 0.63], status: ['served', 'served', 'served', 'served'],
      quality: ['brief rise', 'fair', 'good', 'good'], trend: ['wait', 'settling', 'stable', 'stable'],
      elapsedSeconds: [0, 60, 120, 180],
      completionSec: 180, outcomeStatus: 'served', outcomeData: 110, outcomePower: 20, outcomeEnergy: 302, outcomeEe: 0.364,
    }),
    buildE2Branch('trace-b', 'remain', {
      data: [0, 30, 64, 96], energy: [0.1, 112, 222, 310], ee: [0, 0.268, 0.288, 0.31],
      power: [22, 22, 21, 20], rate: [0, 0.5, 0.57, 0.53], status: ['served', 'served', 'served', 'served'],
      quality: ['current steady', 'fair', 'fair', 'fair'], trend: ['remain', 'stable', 'stable', 'stable'],
      elapsedSeconds: [0, 70, 140, 210],
      completionSec: 210, outcomeStatus: 'served', outcomeData: 96, outcomePower: 20, outcomeEnergy: 310, outcomeEe: 0.31,
    }),
  ],
});

const E2_EXPERIMENT: E2Experiment = Object.freeze({
  id: 'E2',
  question: '在 overlap event，現在切換、等待或留下，哪一個規則能跨過 withheld trend？',
  scenario: C90_SCENARIO,
  traceA: TRACE_A,
  traceB: TRACE_B,
  invariant: '同一 payload、deadline、合法 action、energy boundary 與 stopping rule；B 只改 future link trend。',
});

const IOT_TASKS: readonly IoTTaskCard[] = Object.freeze([
  { id: 'alarm', label: 'Flood alarm', arrivalSec: 18, window: '18–42 s', freshnessGoal: '必須 fresh', value: '立即告警' },
  { id: 'environment', label: 'Air quality sample', arrivalSec: 34, window: '34–118 s', freshnessGoal: '118 s 前 fresh', value: '週期環境資料' },
  { id: 'bulk', label: 'Image batch', arrivalSec: 62, window: '62–176 s', freshnessGoal: '可延後但不可無限 stale', value: 'delay-tolerant bulk' },
]);

const IOT_WINDOWS = ['contact window 1 · 18–62 s', 'contact window 2 · 92–132 s', 'contact window 3 · 150–190 s'] as const;

function iotFrame(version: 'baseline' | 'learner' | 'revision', data: number, energy: number, ee: number, power: number): CourseSceneFrame {
  const elapsedSec = version === 'baseline' ? 120 : version === 'learner' ? 100 : 108;
  const trajectory = courseTleFrameAtElapsed(elapsedSec);
  return {
    identity: frameIdentity(`iot-${version}`),
    frameIndex: version === 'baseline' ? 0 : version === 'learner' ? 1 : 2,
    elapsedSec,
    satellite: { id: 'oneweb-0314-norad-49100', position: trajectory.scene.satellitePosition, altitudeKm: trajectory.geodetic.altitudeKm },
    beam: { id: 'beam-ntpu-a', position: [0, 16, 0], qualityLabel: 'good', trendLabel: 'same mission window' },
    link: { servingBeamId: 'beam-ntpu-a', visible: trajectory.look.visible, rangeKm: trajectory.look.rangeKm, azimuthDeg: trajectory.look.azimuthDeg, elevationDeg: trajectory.look.elevationDeg },
    service: { rateMbps: 0.68, deliveredDataMbit: data, deadlineSec: 190, status: 'served' },
    energy: { powerW: power, energyJ: energy, eeMbitPerJ: ee },
  };
}

const IOT_RUNS: readonly IoTRun[] = Object.freeze([
  {
    version: 'baseline', label: 'Baseline · send immediately', rule: '每次 arrival 都立即送出',
    taskResults: [
      { taskId: 'alarm', status: 'delivered-fresh', deliveredMbit: 24 },
      { taskId: 'environment', status: 'delivered-stale', deliveredMbit: 32 },
      { taskId: 'bulk', status: 'expired', deliveredMbit: 40 },
    ], deliveredDataMbit: 96, expiredCount: 1, freshCount: 1, activeTimeSec: 120, energyJ: 260, eeMbitPerJ: 0.369,
    frame: iotFrame('baseline', 96, 260, 0.369, 22),
  },
  {
    version: 'learner', label: 'Learner rule', rule: 'IF alarm → send now; routine → batch for next good window',
    taskResults: [
      { taskId: 'alarm', status: 'delivered-fresh', deliveredMbit: 24 },
      { taskId: 'environment', status: 'delivered-fresh', deliveredMbit: 32 },
      { taskId: 'bulk', status: 'delivered-fresh', deliveredMbit: 40 },
    ], deliveredDataMbit: 96, expiredCount: 0, freshCount: 3, activeTimeSec: 100, energyJ: 218, eeMbitPerJ: 0.44,
    frame: iotFrame('learner', 96, 218, 0.44, 20),
  },
  {
    version: 'revision', label: 'One revision', rule: '保留 alarm 優先，bulk 改到 window 3，保護 freshness',
    taskResults: [
      { taskId: 'alarm', status: 'delivered-fresh', deliveredMbit: 24 },
      { taskId: 'environment', status: 'delivered-fresh', deliveredMbit: 32 },
      { taskId: 'bulk', status: 'delivered-fresh', deliveredMbit: 48 },
    ], deliveredDataMbit: 104, expiredCount: 0, freshCount: 3, activeTimeSec: 108, energyJ: 230, eeMbitPerJ: 0.452,
    frame: iotFrame('revision', 104, 230, 0.452, 20),
  },
]);

const IOT_CHALLENGE: IoTChallenge = Object.freeze({
  id: 'IOT-CHALLENGE',
  question: '有限 transmission windows 下，哪些資料現在送、批次送，或給更高 priority？',
  scenario: C90_SCENARIO,
  tasks: IOT_TASKS,
  windows: IOT_WINDOWS,
  runs: IOT_RUNS,
  invariant: 'task cards、arrival、legal windows、freshness goals、power/rate policy 與 energy boundary 固定；只改 rule/schedule。',
});

const COURSE_TLE_SOURCE = TLE_STUDY_DATA.sources.find(source => source.sourceId === TLE_STUDY_DATA.courseSourceId);
const COURSE_TLE_TARGET_FRAME = COURSE_TLE_BUNDLE.frames.find(frame => frame.targetUtc === TARGET_UTC);

if (COURSE_TLE_SOURCE === undefined || COURSE_TLE_TARGET_FRAME === undefined) {
  throw new Error('C-90 fixture is missing its designated TLE source/target frame');
}

const TLE_JOURNEY: TleJourney = {
  schemaVersion: TLE_STUDY_DATA.schemaVersion,
  source: COURSE_TLE_SOURCE,
  sources: TLE_STUDY_DATA.sources,
  windows: TLE_STUDY_DATA.windows,
  trajectoryBundles: TLE_STUDY_DATA.bundles,
  observer: TLE_STUDY_DATA.observer,
  defaultSourceId: TLE_STUDY_DATA.defaultSourceId,
  courseSourceId: TLE_STUDY_DATA.courseSourceId,
  defaultWindowId: TLE_STUDY_DATA.defaultWindowId,
  externalSources: TLE_STUDY_DATA.externalSources,
  archiveCatalogCommand: TLE_STUDY_DATA.archiveCatalogCommand,
  updateCommand: TLE_STUDY_DATA.updateCommand,
  generationCommand: TLE_STUDY_DATA.generationCommand,
  boundary: TLE_STUDY_DATA.boundary,
  targetUtc: TARGET_UTC,
  scenario: C90_SCENARIO,
  stages: [
    { id: 'source', title: '1 · 選來源並讀 epoch', input: COURSE_TLE_SOURCE.filename, transformation: '由所選物件 TLE line 1 解析 epoch；archive 日期只作查詢鍵', output: `${COURSE_TLE_SOURCE.objectName} · epoch ${COURSE_TLE_SOURCE.epochUtc}`, unit: 'UTC / field labels', purpose: '分辨檔名日期、TLE epoch 與下載時間', provenance: 'SOURCE' },
    { id: 'target-time', title: '2 · 指定計算時間', input: TARGET_UTC, transformation: '明確綁定 target UTC；now 只有被選為 target 時才參與計算', output: `target − epoch = ${COURSE_TLE_TARGET_FRAME.ageSeconds} s`, unit: 'UTC / s', purpose: '看見 propagation age，避免把 epoch 當作現在', provenance: 'COURSE-ASSUMPTION' },
    { id: 'propagation', title: '3 · 預算 orbital state', input: 'checksum-valid TLE + selected target UTC', transformation: 'backstage SGP4 producer（browser 不重算）', output: 'TEME position / velocity trace', unit: 'km / km/s', purpose: '從 element set 得到指定時間的 model state', provenance: 'MODEL-DERIVED' },
    { id: 'ntpu-frame', title: '4 · 轉成 NTPU 視角', input: `TEME state + ${TLE_STUDY_DATA.observer.observerId}`, transformation: '預先計算 Earth-fixed / geodetic / topocentric look angle', output: `az ${COURSE_TLE_TARGET_FRAME.look.azimuthDeg}°, el ${COURSE_TLE_TARGET_FRAME.look.elevationDeg}°, range ${COURSE_TLE_TARGET_FRAME.look.rangeKm} km`, unit: 'deg / km / boolean', purpose: '同一 producer frame 驅動 scene、timeline 與 readout', provenance: 'MODEL-DERIVED' },
    { id: 'scenario', title: '5 · 產生課程 scenario', input: 'source + target + frame identity', transformation: '封裝 versioned fixture scenario', output: SCENARIO_ID, unit: 'scenario id', purpose: '同一 identity 驅動 scene、KPI 與 export', provenance: 'COURSE-ASSUMPTION' },
  ],
};

deepFreeze(C90_SCENARIO);
deepFreeze(E1_EXPERIMENT);
deepFreeze(E2_EXPERIMENT);
deepFreeze(IOT_CHALLENGE);
deepFreeze(TLE_JOURNEY);

function courseManifest(): CourseManifest {
  return deepFreeze({
    courseId: 'C-90-ENERGY-1',
    title: 'Energy decisions in an NTPU LEO pass',
    providerKind: 'fixture',
    providerId: PROVIDER_ID,
    contractVersion: C90_CONTRACT_VERSION,
    scenario: C90_SCENARIO,
    claimBoundary: C90_CLAIM_BOUNDARY,
    claimLevels: C90_CLAIM_LEVELS,
    availableStages: ['ready', 'tle', 'e1', 'e2', 'iot', 'competition', 'complete'],
  });
}

function learningBundleTleRecord(input: LearningBundleInput['tle']): LearningBundle['tle'] {
  if (!input.sourceConfirmed || input.selectedSourceId !== TLE_JOURNEY.courseSourceId) {
    throw new Error('C-90 fixture export requires an explicitly confirmed course-compatible TLE source');
  }
  const source = TLE_JOURNEY.sources.find(candidate => candidate.sourceId === input.selectedSourceId);
  const window = TLE_JOURNEY.windows.find(candidate => candidate.windowId === input.selectedWindowId);
  const bundle = TLE_JOURNEY.trajectoryBundles.find(candidate => (
    candidate.sourceId === input.selectedSourceId
    && candidate.windowId === input.selectedWindowId
  ));
  const frame = bundle?.frames[input.selectedFrameIndex];
  if (source === undefined || window === undefined || bundle === undefined || frame === undefined) {
    throw new Error('C-90 fixture export TLE source/window/frame identity is unavailable');
  }
  if (input.sourceMode === 'imported' && (input.importedFilename === null || input.importedFilename.trim() === '')) {
    throw new Error('C-90 fixture export imported TLE is missing its local filename');
  }
  if (input.sourceMode !== 'imported' && input.importedFilename !== null) {
    throw new Error('C-90 fixture export has an imported filename without imported source mode');
  }
  if (input.fallbackUsed !== (input.sourceMode === 'fallback')) {
    throw new Error('C-90 fixture export fallback provenance is inconsistent');
  }
  const comparisonsAtTarget = TLE_JOURNEY.sources.map(comparisonSource => {
    const comparisonBundle = TLE_JOURNEY.trajectoryBundles.find(candidate => (
      candidate.sourceId === comparisonSource.sourceId
      && candidate.windowId === input.selectedWindowId
    ));
    const comparisonFrame = comparisonBundle?.frames.find(candidate => candidate.targetUtc === TLE_JOURNEY.targetUtc);
    if (comparisonFrame === undefined) throw new Error(`C-90 fixture comparison frame unavailable: ${comparisonSource.sourceId}`);
    return {
      sourceId: comparisonSource.sourceId,
      archiveDate: comparisonSource.archiveDate,
      epochUtc: comparisonSource.epochUtc,
      ageSeconds: comparisonFrame.ageSeconds,
      modelDeltaFromCourseSourceKm: comparisonFrame.modelDeltaFromCourseSourceKm,
    };
  });
  return {
    ...input,
    source,
    window,
    observer: TLE_JOURNEY.observer,
    trajectory: {
      bundleId: bundle.bundleId,
      producerVersion: bundle.producerVersion,
      model: bundle.model,
      frame,
    },
    comparisonsAtTarget,
    stages: TLE_JOURNEY.stages,
  };
}

export class FixtureCourseDataProvider implements CourseDataProvider {
  readonly kind = 'fixture' as const;
  readonly providerId = PROVIDER_ID;

  getManifest(): CourseManifest {
    return courseManifest();
  }

  getTleJourney(): TleJourney {
    return TLE_JOURNEY;
  }

  getE1Experiment(): E1Experiment {
    return E1_EXPERIMENT;
  }

  getE2Experiment(): E2Experiment {
    return E2_EXPERIMENT;
  }

  getIoTChallenge(): IoTChallenge {
    return IOT_CHALLENGE;
  }

  buildLearningBundle(input: LearningBundleInput): LearningBundle {
    const tle = learningBundleTleRecord(input.tle);
    return deepFreeze({
      bundleVersion: 'c90-learning-bundle-v1',
      sessionId: input.sessionId,
      exportedAt: input.exportedAt,
      readyCheckCompleted: input.readyCheckCompleted,
      course: this.getManifest(),
      scenario: C90_SCENARIO,
      claimBoundary: C90_CLAIM_BOUNDARY,
      provenance: {
        providerId: PROVIDER_ID,
        fixtureId: FIXTURE_ID,
        deterministicReplay: true,
        source: 'fixture-provider',
      },
      prediction: {
        tle: input.tle.explanation,
        e1: input.e1.prediction,
        e2: input.e2.prediction,
        iot: input.iot.prediction,
      },
      tle,
      e1: { ...input.e1, arms: E1_ARMS },
      e2: { ...input.e2, traceA: TRACE_A, traceB: TRACE_B },
      iot: { ...input.iot, tasks: IOT_TASKS, runs: IOT_RUNS },
      ideaCard: input.ideaCard,
    });
  }
}

export const C90_FIXTURE_PROVIDER = createValidatedCourseDataProvider(new FixtureCourseDataProvider());
export const C90_FIXTURE_IDS = Object.freeze({ providerId: PROVIDER_ID, fixtureId: FIXTURE_ID, scenarioId: SCENARIO_ID });
