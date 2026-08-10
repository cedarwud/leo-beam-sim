import {
  assertC120Workbook,
  C120_CLAIM_BOUNDARY,
  C120_CLAIM_LEVELS,
  C120_CONTRACT_VERSION,
  C120_COURSE_ID,
  C120_CONSTRUCTED_RESPONSE_KEYS,
  C120ContractError,
  C120_SEGMENTS,
  C120_UNITS,
  C120_WORKBOOK_VERSION,
  createValidatedC120Provider,
  type C120AuthoritativeReplay,
  type C120ChoiceOption,
  type C120ClinicActionId,
  type C120ConstructedResponses,
  type C120CourseDataProvider,
  type C120Evidence,
  type C120LabACandidateId,
  type C120LabAScenarioInput,
  type C120LabBRuleId,
  type C120LabBScenarioInput,
  type C120LabCAction,
  type C120LabCScenarioInput,
  type C120LabCSlots,
  type C120MissionContractOption,
  type C120Manifest,
  type C120ProviderKind,
  type C120ReplayInput,
  type C120ReplayFrame,
  type C120Scenario,
  type C120ScenarioIdentity,
  type C120SceneState,
  type C120SegmentId,
  type C120WorkbookInput,
  type C120WorkbookReplayRecord,
} from './contract';
import {
  c120SurfaceIdentity,
  makeC120Frame,
  makeC120Replay,
  parseC120ReplayInput,
  resolveC120Replay,
  type C120ReplayFrameSpec,
} from './replay';

export const C120_SCENARIO_ID = 'c120-ntpu-energy-decision-01';
export const C120_FIXTURE_ID = 'c120-energy-decision-fixture';
export const C120_FIXTURE_VERSION = 'c120-energy-decision-fixture-v2';
export const C120_TLE_SOURCE_ID = 'oneweb-0314-archive-2026-08-08';
export const C120_TARGET_UTC = '2026-08-09T04:00:00Z';
const C120_COMPARABLE_MISSION_ID = 'mission-fixed-service-boundary' as const;

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

function scene(
  satellitePosition: readonly [number, number, number],
  beamPosition: readonly [number, number, number],
  observerPosition: readonly [number, number, number],
  visible: boolean,
  azimuthDeg: number,
  elevationDeg: number,
  rangeKm: number,
): C120SceneState {
  return {
    satellitePosition,
    beamPosition,
    observerPosition,
    visible,
    azimuthDeg,
    elevationDeg,
    rangeKm,
  };
}

function frameSpec(
  elapsedSec: number,
  actionLabel: string,
  stateLabel: string,
  qualityLabel: string,
  sceneState: C120SceneState,
  evidence: C120Evidence,
): C120ReplayFrameSpec {
  return { elapsedSec, actionLabel, stateLabel, qualityLabel, scene: sceneState, evidence };
}

function identity(providerKind: 'fixture' | 'stub', providerId: string): C120ScenarioIdentity {
  return {
    courseId: C120_COURSE_ID,
    contractVersion: C120_CONTRACT_VERSION,
    providerKind,
    providerId,
    fixtureId: C120_FIXTURE_ID,
    fixtureVersion: C120_FIXTURE_VERSION,
    scenarioId: C120_SCENARIO_ID,
    sourceMode: providerKind === 'stub' ? 'fallback' : 'bundled',
    tleSourceId: C120_TLE_SOURCE_ID,
    targetUtc: C120_TARGET_UTC,
    claimBoundary: C120_CLAIM_BOUNDARY,
    claimLevels: C120_CLAIM_LEVELS,
    units: C120_UNITS,
  };
}

const TLE_SCENE = scene([58, 38, -26], [0, 15, 0], [0, 0, 0], true, 182.4, 38.1, 911.7);

const A_SCENE_0 = scene([58, 38, -26], [0, 14, 0], [0, 0, 0], true, 181.0, 38.0, 912.0);
const A_SCENE_1 = scene([60, 39, -24], [0, 15, 0], [0, 0, 0], true, 184.0, 41.0, 905.0);

const B_SCENE_0 = scene([58, 38, -26], [0, 14, 0], [0, 0, 0], true, 181.0, 38.0, 912.0);
const B_SCENE_1 = scene([59, 39, -25], [0, 15, 0], [0, 0, 0], true, 183.0, 40.0, 908.0);
const B_SCENE_2 = scene([61, 40, -23], [0, 16, 0], [0, 0, 0], true, 186.0, 43.0, 899.0);

const C_SCENE_0 = scene([58, 38, -26], [0, 14, 0], [0, 0, 0], true, 181.0, 38.0, 912.0);
const C_SCENE_1 = scene([59, 38, -25], [0, 14, 0], [0, 0, 0], true, 182.0, 39.0, 910.0);
const C_SCENE_2 = scene([60, 39, -24], [0, 15, 0], [0, 0, 0], true, 184.0, 41.0, 905.0);
const C_SCENE_3 = scene([61, 40, -23], [0, 16, 0], [0, 0, 0], false, 187.0, 8.0, 1040.0);
const C_SCENE_4 = scene([62, 40, -22], [0, 16, 0], [0, 0, 0], true, 189.0, 35.0, 920.0);
const C_SCENE_5 = scene([63, 41, -21], [0, 17, 0], [0, 0, 0], true, 191.0, 37.0, 916.0);

const CLINIC_SCENE_0 = scene([58, 38, -26], [0, 14, 0], [0, 0, 0], true, 181.0, 38.0, 912.0);
const CLINIC_SCENE_1 = scene([61, 40, -23], [0, 16, 0], [0, 0, 0], true, 186.0, 43.0, 899.0);

const TLE_FRAME_SPEC = frameSpec(
  0,
  'anchor source at target time',
  'NTPU service window anchor',
  'teaching-band:anchor',
  TLE_SCENE,
  {
    servicePass: false,
    deadlinePass: false,
    freshnessStatus: 'not-applicable',
    systemPowerW: 0,
    consumedEnergyJ: 0,
    energyBudgetJ: 0,
    budgetRemainingJ: 0,
    rateBitsPerSec: 0,
    deliveredBits: 0,
    energyEfficiencyBitsPerJ: 0,
    activeTimeSec: 0,
    switchCount: 0,
    wakeCount: 0,
    warningCodes: ['TLE_NO_POWER', 'TLE_NO_TRAFFIC', 'TLE_NO_ENERGY'],
  },
);

function labAInput(
  candidateId: C120LabACandidateId,
  hiddenConditionId: C120LabAScenarioInput['hiddenConditionId'] = 'high-idle-cost',
): C120LabAScenarioInput {
  return { surface: 'lab-a', missionContractId: C120_COMPARABLE_MISSION_ID, candidateId, hiddenConditionId };
}

function labBInput(frozenRuleId: C120LabBRuleId): C120LabBScenarioInput {
  if (frozenRuleId === 'switch-now') {
    return {
      surface: 'lab-b', missionContractId: C120_COMPARABLE_MISSION_ID, frozenRuleId,
      thresholdId: 'threshold-low', holdCountId: 'one-step', lowerThresholdId: 'lower-same', traceId: 'trace-b-withheld',
    };
  }
  if (frozenRuleId === 'stable-two') {
    return {
      surface: 'lab-b', missionContractId: C120_COMPARABLE_MISSION_ID, frozenRuleId,
      thresholdId: 'threshold-steady', holdCountId: 'two-steps', lowerThresholdId: 'lower-one-band', traceId: 'trace-b-withheld',
    };
  }
  return {
    surface: 'lab-b', missionContractId: C120_COMPARABLE_MISSION_ID, frozenRuleId,
    thresholdId: 'threshold-high', holdCountId: 'two-steps', lowerThresholdId: 'lower-two-bands', traceId: 'trace-b-withheld',
  };
}

function labCInput(
  slots: C120LabCSlots,
  revisionOrdinal: C120LabCScenarioInput['revisionOrdinal'],
  withheldEvent: C120LabCScenarioInput['withheldEvent'],
): C120LabCScenarioInput {
  return { surface: 'lab-c', missionContractId: C120_COMPARABLE_MISSION_ID, slots, revisionOrdinal, withheldEvent };
}

function clinicInput(
  actionId: C120ClinicActionId,
  featureSetId: 'decision-time-only' | 'post-action-mixed' = actionId === 'protect-service' ? 'decision-time-only' : 'post-action-mixed',
): C120ReplayInput {
  return {
    surface: 'clinic', missionContractId: C120_COMPARABLE_MISSION_ID,
    actionId, featureSetId, traceId: 'chronological-trace-b',
  };
}

function buildScenario(scenarioIdentity: C120ScenarioIdentity): C120Scenario {
  const tleIdentity = c120SurfaceIdentity(scenarioIdentity, 'tle');
  const tleFrame: C120ReplayFrame = makeC120Frame(
    tleIdentity,
    'tle-anchor-replay',
    'tle-anchor-input',
    0,
    TLE_FRAME_SPEC,
  );

  const labAReplays: readonly C120AuthoritativeReplay[] = [
    makeC120Replay(
      scenarioIdentity,
      'lab-a-pace-replay',
      labAInput('pace'),
      'race-to-idle candidate',
      'fixed workload with high idle cost',
      [
        frameSpec(0, 'start pace candidate', 'active transfer', 'teaching-band:strong', A_SCENE_0, {
          servicePass: false,
          deadlinePass: false,
          freshnessStatus: 'stale',
          systemPowerW: 48,
          consumedEnergyJ: 192,
          energyBudgetJ: 600,
          budgetRemainingJ: 408,
          rateBitsPerSec: 700000,
          deliveredBits: 280000,
          energyEfficiencyBitsPerJ: 1458.333,
          activeTimeSec: 4,
          switchCount: 0,
          wakeCount: 1,
          warningCodes: ['DEADLINE_PENDING'],
        }),
        frameSpec(32, 'finish and sleep', 'sleep after burst', 'teaching-band:strong', A_SCENE_1, {
          servicePass: true,
          deadlinePass: true,
          freshnessStatus: 'fresh',
          systemPowerW: 20,
          consumedEnergyJ: 560,
          energyBudgetJ: 600,
          budgetRemainingJ: 40,
          rateBitsPerSec: 600000,
          deliveredBits: 1200000,
          energyEfficiencyBitsPerJ: 2142.857,
          activeTimeSec: 28,
          switchCount: 0,
          wakeCount: 1,
          warningCodes: [],
        }),
      ],
    ),
    makeC120Replay(
      scenarioIdentity,
      'lab-a-balanced-replay',
      labAInput('balanced'),
      'balanced pace candidate',
      'fixed workload with high idle cost',
      [
        frameSpec(0, 'start balanced candidate', 'active transfer', 'teaching-band:strong', A_SCENE_0, {
          servicePass: false,
          deadlinePass: false,
          freshnessStatus: 'stale',
          systemPowerW: 30,
          consumedEnergyJ: 120,
          energyBudgetJ: 600,
          budgetRemainingJ: 480,
          rateBitsPerSec: 500000,
          deliveredBits: 200000,
          energyEfficiencyBitsPerJ: 1666.667,
          activeTimeSec: 4,
          switchCount: 0,
          wakeCount: 1,
          warningCodes: ['DEADLINE_PENDING'],
        }),
        frameSpec(40, 'finish at balanced pace', 'completed service', 'teaching-band:strong', A_SCENE_1, {
          servicePass: true,
          deadlinePass: true,
          freshnessStatus: 'fresh',
          systemPowerW: 24,
          consumedEnergyJ: 480,
          energyBudgetJ: 600,
          budgetRemainingJ: 120,
          rateBitsPerSec: 500000,
          deliveredBits: 1200000,
          energyEfficiencyBitsPerJ: 2500,
          activeTimeSec: 36,
          switchCount: 0,
          wakeCount: 1,
          warningCodes: [],
        }),
      ],
    ),
    makeC120Replay(
      scenarioIdentity,
      'lab-a-burst-to-sleep-replay',
      labAInput('burst-to-sleep'),
      'burst-to-sleep candidate',
      'fixed workload with high idle cost',
      [
        frameSpec(0, 'start burst candidate', 'active transfer', 'teaching-band:strong', A_SCENE_0, {
          servicePass: false,
          deadlinePass: false,
          freshnessStatus: 'stale',
          systemPowerW: 60,
          consumedEnergyJ: 180,
          energyBudgetJ: 600,
          budgetRemainingJ: 420,
          rateBitsPerSec: 900000,
          deliveredBits: 270000,
          energyEfficiencyBitsPerJ: 1500,
          activeTimeSec: 3,
          switchCount: 0,
          wakeCount: 1,
          warningCodes: ['DEADLINE_PENDING'],
        }),
        frameSpec(24, 'sleep before final payload', 'expired service', 'teaching-band:weak', A_SCENE_1, {
          servicePass: false,
          deadlinePass: false,
          freshnessStatus: 'expired',
          systemPowerW: 12,
          consumedEnergyJ: 420,
          energyBudgetJ: 600,
          budgetRemainingJ: 180,
          rateBitsPerSec: 0,
          deliveredBits: 900000,
          energyEfficiencyBitsPerJ: 2142.857,
          activeTimeSec: 18,
          switchCount: 0,
          wakeCount: 1,
          warningCodes: ['DEADLINE_MISSED', 'FRESHNESS_EXPIRED'],
        }),
      ],
    ),
    makeC120Replay(
      scenarioIdentity,
      'lab-a-pace-tight-window-replay',
      labAInput('pace', 'tight-service-window'),
      'race-to-idle candidate',
      'authored tighter service window revealed only after freeze',
      [
        frameSpec(0, 'start pace candidate', 'tight window opens', 'teaching-band:strong', A_SCENE_0, {
          servicePass: false, deadlinePass: false, freshnessStatus: 'stale', systemPowerW: 50,
          consumedEnergyJ: 200, energyBudgetJ: 620, budgetRemainingJ: 420, rateBitsPerSec: 720000,
          deliveredBits: 288000, energyEfficiencyBitsPerJ: 1440, activeTimeSec: 4,
          switchCount: 0, wakeCount: 1, warningCodes: ['DEADLINE_PENDING'],
        }),
        frameSpec(30, 'finish before tighter deadline', 'qualified service complete', 'teaching-band:strong', A_SCENE_1, {
          servicePass: true, deadlinePass: true, freshnessStatus: 'fresh', systemPowerW: 22,
          consumedEnergyJ: 580, energyBudgetJ: 620, budgetRemainingJ: 40, rateBitsPerSec: 620000,
          deliveredBits: 1200000, energyEfficiencyBitsPerJ: 2068.966, activeTimeSec: 27,
          switchCount: 0, wakeCount: 1, warningCodes: [],
        }),
      ],
    ),
    makeC120Replay(
      scenarioIdentity,
      'lab-a-balanced-tight-window-replay',
      labAInput('balanced', 'tight-service-window'),
      'balanced pace candidate',
      'authored tighter service window revealed only after freeze',
      [
        frameSpec(0, 'start balanced candidate', 'tight window opens', 'teaching-band:strong', A_SCENE_0, {
          servicePass: false, deadlinePass: false, freshnessStatus: 'stale', systemPowerW: 30,
          consumedEnergyJ: 120, energyBudgetJ: 620, budgetRemainingJ: 500, rateBitsPerSec: 500000,
          deliveredBits: 200000, energyEfficiencyBitsPerJ: 1666.667, activeTimeSec: 4,
          switchCount: 0, wakeCount: 1, warningCodes: ['DEADLINE_PENDING'],
        }),
        frameSpec(30, 'window closes before final payload', 'lower energy but unqualified service', 'teaching-band:weak', A_SCENE_1, {
          servicePass: false, deadlinePass: false, freshnessStatus: 'expired', systemPowerW: 18,
          consumedEnergyJ: 430, energyBudgetJ: 620, budgetRemainingJ: 190, rateBitsPerSec: 0,
          deliveredBits: 1050000, energyEfficiencyBitsPerJ: 2441.86, activeTimeSec: 30,
          switchCount: 0, wakeCount: 1, warningCodes: ['DEADLINE_MISSED', 'SERVICE_UNQUALIFIED'],
        }),
      ],
    ),
    makeC120Replay(
      scenarioIdentity,
      'lab-a-burst-tight-window-replay',
      labAInput('burst-to-sleep', 'tight-service-window'),
      'burst-to-sleep candidate',
      'authored tighter service window revealed only after freeze',
      [
        frameSpec(0, 'start burst candidate', 'tight window opens', 'teaching-band:strong', A_SCENE_0, {
          servicePass: false, deadlinePass: false, freshnessStatus: 'stale', systemPowerW: 62,
          consumedEnergyJ: 186, energyBudgetJ: 620, budgetRemainingJ: 434, rateBitsPerSec: 920000,
          deliveredBits: 276000, energyEfficiencyBitsPerJ: 1483.871, activeTimeSec: 3,
          switchCount: 0, wakeCount: 1, warningCodes: ['DEADLINE_PENDING'],
        }),
        frameSpec(24, 'burst ends before payload completes', 'deadline missed after early sleep', 'teaching-band:weak', A_SCENE_1, {
          servicePass: false, deadlinePass: false, freshnessStatus: 'expired', systemPowerW: 12,
          consumedEnergyJ: 440, energyBudgetJ: 620, budgetRemainingJ: 180, rateBitsPerSec: 0,
          deliveredBits: 980000, energyEfficiencyBitsPerJ: 2227.273, activeTimeSec: 19,
          switchCount: 0, wakeCount: 1, warningCodes: ['DEADLINE_MISSED', 'PAYLOAD_INCOMPLETE'],
        }),
      ],
    ),
  ];

  const labBReplays: readonly C120AuthoritativeReplay[] = [
    makeC120Replay(
      scenarioIdentity,
      'lab-b-switch-now-replay',
      labBInput('switch-now'),
      'frozen rule: switch now',
      'Trace B withholds the later quality dip',
      [
        frameSpec(0, 'observe first quality event', 'serving beam A', 'teaching-band:medium', B_SCENE_0, {
          servicePass: false,
          deadlinePass: false,
          freshnessStatus: 'stale',
          systemPowerW: 24,
          consumedEnergyJ: 96,
          energyBudgetJ: 500,
          budgetRemainingJ: 404,
          rateBitsPerSec: 420000,
          deliveredBits: 168000,
          energyEfficiencyBitsPerJ: 1750,
          activeTimeSec: 4,
          switchCount: 0,
          wakeCount: 1,
          warningCodes: ['TRACE_PENDING'],
        }),
        frameSpec(20, 'switch at first improvement', 'serving beam B', 'teaching-band:strong', B_SCENE_1, {
          servicePass: false,
          deadlinePass: false,
          freshnessStatus: 'expired',
          systemPowerW: 26,
          consumedEnergyJ: 370,
          energyBudgetJ: 500,
          budgetRemainingJ: 130,
          rateBitsPerSec: 160000,
          deliveredBits: 700000,
          energyEfficiencyBitsPerJ: 1891.892,
          activeTimeSec: 18,
          switchCount: 3,
          wakeCount: 1,
          warningCodes: ['WITHHELD_DIP', 'DEADLINE_MISSED'],
        }),
      ],
    ),
    makeC120Replay(
      scenarioIdentity,
      'lab-b-stable-two-replay',
      labBInput('stable-two'),
      'frozen rule: hold quality for two steps',
      'Trace B withholds the later quality dip',
      [
        frameSpec(0, 'observe first quality event', 'serving beam A', 'teaching-band:medium', B_SCENE_0, {
          servicePass: false,
          deadlinePass: false,
          freshnessStatus: 'stale',
          systemPowerW: 24,
          consumedEnergyJ: 96,
          energyBudgetJ: 500,
          budgetRemainingJ: 404,
          rateBitsPerSec: 420000,
          deliveredBits: 168000,
          energyEfficiencyBitsPerJ: 1750,
          activeTimeSec: 4,
          switchCount: 0,
          wakeCount: 1,
          warningCodes: ['TRACE_PENDING'],
        }),
        frameSpec(40, 'switch after two stable events', 'serving beam B', 'teaching-band:strong', B_SCENE_2, {
          servicePass: true,
          deadlinePass: true,
          freshnessStatus: 'fresh',
          systemPowerW: 23,
          consumedEnergyJ: 390,
          energyBudgetJ: 500,
          budgetRemainingJ: 110,
          rateBitsPerSec: 500000,
          deliveredBits: 1000000,
          energyEfficiencyBitsPerJ: 2564.103,
          activeTimeSec: 34,
          switchCount: 1,
          wakeCount: 1,
          warningCodes: [],
        }),
      ],
    ),
    makeC120Replay(
      scenarioIdentity,
      'lab-b-hysteresis-replay',
      labBInput('hysteresis'),
      'frozen rule: switch with a hysteresis band',
      'Trace B withholds the later quality dip',
      [
        frameSpec(0, 'observe first quality event', 'serving beam A', 'teaching-band:medium', B_SCENE_0, {
          servicePass: false,
          deadlinePass: false,
          freshnessStatus: 'stale',
          systemPowerW: 24,
          consumedEnergyJ: 96,
          energyBudgetJ: 500,
          budgetRemainingJ: 404,
          rateBitsPerSec: 420000,
          deliveredBits: 168000,
          energyEfficiencyBitsPerJ: 1750,
          activeTimeSec: 4,
          switchCount: 0,
          wakeCount: 1,
          warningCodes: ['TRACE_PENDING'],
        }),
        frameSpec(40, 'switch only after clear separation', 'serving beam B', 'teaching-band:strong', B_SCENE_2, {
          servicePass: true,
          deadlinePass: true,
          freshnessStatus: 'fresh',
          systemPowerW: 22,
          consumedEnergyJ: 340,
          energyBudgetJ: 500,
          budgetRemainingJ: 160,
          rateBitsPerSec: 500000,
          deliveredBits: 1000000,
          energyEfficiencyBitsPerJ: 2941.176,
          activeTimeSec: 30,
          switchCount: 2,
          wakeCount: 1,
          warningCodes: [],
        }),
      ],
    ),
  ];

  const labCReplays: readonly C120AuthoritativeReplay[] = [
    makeC120Replay(
      scenarioIdentity,
      'lab-c-immediate-baseline-replay',
      labCInput(
        ['fixed-contact', 'send-urgent', 'send-urgent', 'fixed-outage', 'send-bulk', 'sleep'],
        0,
        'none',
      ),
      'baseline schedule: send as soon as possible',
      'fixed contact/outage with no withheld event',
      [
        frameSpec(0, 'hold fixed contact', 'contact open', 'teaching-band:strong', C_SCENE_0, {
          servicePass: false,
          deadlinePass: false,
          freshnessStatus: 'stale',
          systemPowerW: 30,
          consumedEnergyJ: 60,
          energyBudgetJ: 520,
          budgetRemainingJ: 460,
          rateBitsPerSec: 400000,
          deliveredBits: 100000,
          energyEfficiencyBitsPerJ: 1666.667,
          activeTimeSec: 2,
          switchCount: 0,
          wakeCount: 1,
          warningCodes: ['SCHEDULE_IN_PROGRESS'],
        }),
        frameSpec(30, 'send urgent card', 'urgent sent', 'teaching-band:strong', C_SCENE_1, {
          servicePass: false,
          deadlinePass: false,
          freshnessStatus: 'stale',
          systemPowerW: 32,
          consumedEnergyJ: 170,
          energyBudgetJ: 520,
          budgetRemainingJ: 350,
          rateBitsPerSec: 450000,
          deliveredBits: 500000,
          energyEfficiencyBitsPerJ: 2941.176,
          activeTimeSec: 8,
          switchCount: 0,
          wakeCount: 2,
          warningCodes: ['SCHEDULE_IN_PROGRESS'],
        }),
        frameSpec(60, 'send second urgent card', 'urgent delivered', 'teaching-band:strong', C_SCENE_2, {
          servicePass: true,
          deadlinePass: true,
          freshnessStatus: 'fresh',
          systemPowerW: 31,
          consumedEnergyJ: 260,
          energyBudgetJ: 520,
          budgetRemainingJ: 260,
          rateBitsPerSec: 450000,
          deliveredBits: 900000,
          energyEfficiencyBitsPerJ: 3461.538,
          activeTimeSec: 14,
          switchCount: 0,
          wakeCount: 3,
          warningCodes: ['SCHEDULE_IN_PROGRESS'],
        }),
        frameSpec(90, 'hold fixed outage', 'contact closed', 'teaching-band:offline', C_SCENE_3, {
          servicePass: true,
          deadlinePass: true,
          freshnessStatus: 'fresh',
          systemPowerW: 0,
          consumedEnergyJ: 260,
          energyBudgetJ: 520,
          budgetRemainingJ: 260,
          rateBitsPerSec: 0,
          deliveredBits: 900000,
          energyEfficiencyBitsPerJ: 3461.538,
          activeTimeSec: 14,
          switchCount: 0,
          wakeCount: 3,
          warningCodes: ['FIXED_OUTAGE'],
        }),
        frameSpec(120, 'send bulk card', 'bulk transfer', 'teaching-band:medium', C_SCENE_4, {
          servicePass: true,
          deadlinePass: true,
          freshnessStatus: 'fresh',
          systemPowerW: 30,
          consumedEnergyJ: 410,
          energyBudgetJ: 520,
          budgetRemainingJ: 110,
          rateBitsPerSec: 400000,
          deliveredBits: 1250000,
          energyEfficiencyBitsPerJ: 3048.78,
          activeTimeSec: 28,
          switchCount: 0,
          wakeCount: 4,
          warningCodes: ['SCHEDULE_IN_PROGRESS'],
        }),
        frameSpec(150, 'finish baseline', 'schedule complete', 'teaching-band:strong', C_SCENE_5, {
          servicePass: true,
          deadlinePass: true,
          freshnessStatus: 'fresh',
          systemPowerW: 28,
          consumedEnergyJ: 510,
          energyBudgetJ: 520,
          budgetRemainingJ: 10,
          rateBitsPerSec: 380000,
          deliveredBits: 1500000,
          energyEfficiencyBitsPerJ: 2941.176,
          activeTimeSec: 42,
          switchCount: 0,
          wakeCount: 4,
          warningCodes: [],
        }),
      ],
      [
        { cardId: 'U1', generatedAtSec: 12, sentAtSec: 30, receivedAtSec: 42, state: 'received', servicePass: true, freshnessStatus: 'fresh', consumedEnergyJ: 170, budgetRemainingJ: 350, deliveredBits: 500000, energyEfficiencyBitsPerJ: 2941.176 },
        { cardId: 'P1', generatedAtSec: 45, sentAtSec: 60, receivedAtSec: 72, state: 'received', servicePass: true, freshnessStatus: 'fresh', consumedEnergyJ: 260, budgetRemainingJ: 260, deliveredBits: 900000, energyEfficiencyBitsPerJ: 3461.538 },
        { cardId: 'B1', generatedAtSec: 100, sentAtSec: 120, receivedAtSec: 145, state: 'received', servicePass: true, freshnessStatus: 'fresh', consumedEnergyJ: 510, budgetRemainingJ: 10, deliveredBits: 1500000, energyEfficiencyBitsPerJ: 2941.176 },
      ],
    ),
    makeC120Replay(
      scenarioIdentity,
      'lab-c-batched-replay',
      labCInput(
        ['fixed-contact', 'wait', 'batch-periodic', 'fixed-outage', 'flush-batch', 'sleep'],
        0,
        'shorter-window',
      ),
      'learner schedule: batch periodic work',
      'shorter contact window is withheld until replay',
      [
        frameSpec(0, 'hold fixed contact', 'contact open', 'teaching-band:strong', C_SCENE_0, {
          servicePass: false,
          deadlinePass: false,
          freshnessStatus: 'stale',
          systemPowerW: 30,
          consumedEnergyJ: 60,
          energyBudgetJ: 520,
          budgetRemainingJ: 460,
          rateBitsPerSec: 400000,
          deliveredBits: 100000,
          energyEfficiencyBitsPerJ: 1666.667,
          activeTimeSec: 2,
          switchCount: 0,
          wakeCount: 1,
          warningCodes: ['SCHEDULE_IN_PROGRESS'],
        }),
        frameSpec(30, 'wait for periodic card', 'sleep between arrivals', 'teaching-band:strong', C_SCENE_1, {
          servicePass: false,
          deadlinePass: false,
          freshnessStatus: 'stale',
          systemPowerW: 10,
          consumedEnergyJ: 110,
          energyBudgetJ: 520,
          budgetRemainingJ: 410,
          rateBitsPerSec: 0,
          deliveredBits: 100000,
          energyEfficiencyBitsPerJ: 909.091,
          activeTimeSec: 5,
          switchCount: 0,
          wakeCount: 1,
          warningCodes: ['SCHEDULE_IN_PROGRESS'],
        }),
        frameSpec(60, 'batch periodic card', 'batch queued', 'teaching-band:strong', C_SCENE_2, {
          servicePass: false,
          deadlinePass: false,
          freshnessStatus: 'stale',
          systemPowerW: 18,
          consumedEnergyJ: 170,
          energyBudgetJ: 520,
          budgetRemainingJ: 350,
          rateBitsPerSec: 260000,
          deliveredBits: 300000,
          energyEfficiencyBitsPerJ: 1764.706,
          activeTimeSec: 12,
          switchCount: 0,
          wakeCount: 2,
          warningCodes: ['SCHEDULE_IN_PROGRESS'],
        }),
        frameSpec(90, 'hold fixed outage', 'contact closed', 'teaching-band:offline', C_SCENE_3, {
          servicePass: false,
          deadlinePass: false,
          freshnessStatus: 'expired',
          systemPowerW: 0,
          consumedEnergyJ: 170,
          energyBudgetJ: 520,
          budgetRemainingJ: 350,
          rateBitsPerSec: 0,
          deliveredBits: 300000,
          energyEfficiencyBitsPerJ: 1764.706,
          activeTimeSec: 12,
          switchCount: 0,
          wakeCount: 2,
          warningCodes: ['FIXED_OUTAGE', 'FRESHNESS_EXPIRED'],
        }),
        frameSpec(120, 'flush batch', 'batch transfer', 'teaching-band:medium', C_SCENE_4, {
          servicePass: false,
          deadlinePass: false,
          freshnessStatus: 'expired',
          systemPowerW: 20,
          consumedEnergyJ: 250,
          energyBudgetJ: 520,
          budgetRemainingJ: 270,
          rateBitsPerSec: 280000,
          deliveredBits: 600000,
          energyEfficiencyBitsPerJ: 2400,
          activeTimeSec: 24,
          switchCount: 0,
          wakeCount: 3,
          warningCodes: ['WITHHELD_SHORTER_WINDOW'],
        }),
        frameSpec(150, 'finish batched schedule', 'urgent missed', 'teaching-band:weak', C_SCENE_5, {
          servicePass: false,
          deadlinePass: false,
          freshnessStatus: 'expired',
          systemPowerW: 18,
          consumedEnergyJ: 300,
          energyBudgetJ: 520,
          budgetRemainingJ: 220,
          rateBitsPerSec: 220000,
          deliveredBits: 800000,
          energyEfficiencyBitsPerJ: 2666.667,
          activeTimeSec: 28,
          switchCount: 0,
          wakeCount: 3,
          warningCodes: ['DEADLINE_MISSED', 'FRESHNESS_EXPIRED'],
        }),
      ],
      [
        { cardId: 'U1', generatedAtSec: 12, sentAtSec: 120, receivedAtSec: null, state: 'expired', servicePass: false, freshnessStatus: 'expired', consumedEnergyJ: 250, budgetRemainingJ: 270, deliveredBits: 600000, energyEfficiencyBitsPerJ: 2400 },
        { cardId: 'P1', generatedAtSec: 45, sentAtSec: 120, receivedAtSec: 142, state: 'received', servicePass: false, freshnessStatus: 'stale', consumedEnergyJ: 280, budgetRemainingJ: 240, deliveredBits: 720000, energyEfficiencyBitsPerJ: 2571.429 },
        { cardId: 'B1', generatedAtSec: 100, sentAtSec: null, receivedAtSec: null, state: 'not-sent', servicePass: false, freshnessStatus: 'expired', consumedEnergyJ: 300, budgetRemainingJ: 220, deliveredBits: 800000, energyEfficiencyBitsPerJ: 2666.667 },
      ],
    ),
    makeC120Replay(
      scenarioIdentity,
      'lab-c-revision-replay',
      labCInput(
        ['fixed-contact', 'send-urgent', 'batch-periodic', 'fixed-outage', 'flush-batch', 'send-urgent'],
        1,
        'surprise-urgent',
      ),
      'one-revision schedule: protect urgent arrival',
      'surprise urgent event is withheld until the frozen revision replay',
      [
        frameSpec(0, 'hold fixed contact', 'contact open', 'teaching-band:strong', C_SCENE_0, {
          servicePass: false,
          deadlinePass: false,
          freshnessStatus: 'stale',
          systemPowerW: 30,
          consumedEnergyJ: 60,
          energyBudgetJ: 520,
          budgetRemainingJ: 460,
          rateBitsPerSec: 400000,
          deliveredBits: 100000,
          energyEfficiencyBitsPerJ: 1666.667,
          activeTimeSec: 2,
          switchCount: 0,
          wakeCount: 1,
          warningCodes: ['SCHEDULE_IN_PROGRESS'],
        }),
        frameSpec(30, 'send urgent card', 'urgent sent', 'teaching-band:strong', C_SCENE_1, {
          servicePass: false,
          deadlinePass: false,
          freshnessStatus: 'stale',
          systemPowerW: 30,
          consumedEnergyJ: 150,
          energyBudgetJ: 520,
          budgetRemainingJ: 370,
          rateBitsPerSec: 450000,
          deliveredBits: 500000,
          energyEfficiencyBitsPerJ: 3333.333,
          activeTimeSec: 8,
          switchCount: 0,
          wakeCount: 2,
          warningCodes: ['SCHEDULE_IN_PROGRESS'],
        }),
        frameSpec(60, 'batch periodic card', 'periodic queued', 'teaching-band:strong', C_SCENE_2, {
          servicePass: true,
          deadlinePass: true,
          freshnessStatus: 'fresh',
          systemPowerW: 18,
          consumedEnergyJ: 220,
          energyBudgetJ: 520,
          budgetRemainingJ: 300,
          rateBitsPerSec: 280000,
          deliveredBits: 800000,
          energyEfficiencyBitsPerJ: 3636.364,
          activeTimeSec: 14,
          switchCount: 0,
          wakeCount: 2,
          warningCodes: ['SCHEDULE_IN_PROGRESS'],
        }),
        frameSpec(90, 'hold fixed outage', 'contact closed', 'teaching-band:offline', C_SCENE_3, {
          servicePass: true,
          deadlinePass: true,
          freshnessStatus: 'fresh',
          systemPowerW: 0,
          consumedEnergyJ: 220,
          energyBudgetJ: 520,
          budgetRemainingJ: 300,
          rateBitsPerSec: 0,
          deliveredBits: 800000,
          energyEfficiencyBitsPerJ: 3636.364,
          activeTimeSec: 14,
          switchCount: 0,
          wakeCount: 2,
          warningCodes: ['FIXED_OUTAGE'],
        }),
        frameSpec(120, 'flush periodic batch', 'batch delivered', 'teaching-band:medium', C_SCENE_4, {
          servicePass: true,
          deadlinePass: true,
          freshnessStatus: 'fresh',
          systemPowerW: 20,
          consumedEnergyJ: 350,
          energyBudgetJ: 520,
          budgetRemainingJ: 170,
          rateBitsPerSec: 330000,
          deliveredBits: 1150000,
          energyEfficiencyBitsPerJ: 3285.714,
          activeTimeSec: 24,
          switchCount: 0,
          wakeCount: 3,
          warningCodes: ['WITHHELD_SURPRISE_URGENT'],
        }),
        frameSpec(150, 'send surprise urgent card', 'revised schedule complete', 'teaching-band:strong', C_SCENE_5, {
          servicePass: true,
          deadlinePass: true,
          freshnessStatus: 'fresh',
          systemPowerW: 26,
          consumedEnergyJ: 460,
          energyBudgetJ: 520,
          budgetRemainingJ: 60,
          rateBitsPerSec: 360000,
          deliveredBits: 1450000,
          energyEfficiencyBitsPerJ: 3152.174,
          activeTimeSec: 36,
          switchCount: 0,
          wakeCount: 4,
          warningCodes: [],
        }),
      ],
      [
        { cardId: 'U1', generatedAtSec: 12, sentAtSec: 30, receivedAtSec: 42, state: 'received', servicePass: true, freshnessStatus: 'fresh', consumedEnergyJ: 150, budgetRemainingJ: 370, deliveredBits: 500000, energyEfficiencyBitsPerJ: 3333.333 },
        { cardId: 'P1', generatedAtSec: 45, sentAtSec: 120, receivedAtSec: 142, state: 'received', servicePass: true, freshnessStatus: 'fresh', consumedEnergyJ: 350, budgetRemainingJ: 170, deliveredBits: 1150000, energyEfficiencyBitsPerJ: 3285.714 },
        { cardId: 'U2', generatedAtSec: 118, sentAtSec: 150, receivedAtSec: 158, state: 'received', servicePass: true, freshnessStatus: 'fresh', consumedEnergyJ: 460, budgetRemainingJ: 60, deliveredBits: 1450000, energyEfficiencyBitsPerJ: 3152.174 },
      ],
    ),
  ];

  const clinicReplays: readonly C120AuthoritativeReplay[] = [
    makeC120Replay(
      scenarioIdentity,
      'clinic-protect-service-replay',
      clinicInput('protect-service'),
      'frozen honest action: protect service',
      'chronological Trace B with decision-time features only',
      [
        frameSpec(0, 'freeze honest action', 'decision-time features available', 'teaching-band:medium', CLINIC_SCENE_0, {
          servicePass: false,
          deadlinePass: false,
          freshnessStatus: 'stale',
          systemPowerW: 24,
          consumedEnergyJ: 96,
          energyBudgetJ: 500,
          budgetRemainingJ: 404,
          rateBitsPerSec: 420000,
          deliveredBits: 168000,
          energyEfficiencyBitsPerJ: 1750,
          activeTimeSec: 4,
          switchCount: 0,
          wakeCount: 1,
          warningCodes: ['CLINIC_REPLAY_PENDING'],
        }),
        frameSpec(40, 'replay held-out action', 'service protected', 'teaching-band:strong', CLINIC_SCENE_1, {
          servicePass: true,
          deadlinePass: true,
          freshnessStatus: 'fresh',
          systemPowerW: 24,
          consumedEnergyJ: 430,
          energyBudgetJ: 500,
          budgetRemainingJ: 70,
          rateBitsPerSec: 450000,
          deliveredBits: 1000000,
          energyEfficiencyBitsPerJ: 2325.581,
          activeTimeSec: 36,
          switchCount: 1,
          wakeCount: 1,
          warningCodes: [],
        }),
      ],
    ),
    makeC120Replay(
      scenarioIdentity,
      'clinic-chase-score-replay',
      clinicInput('chase-score'),
      'frozen leaky action: chase prediction score',
      'chronological Trace B includes an unavailable future outcome',
      [
        frameSpec(0, 'freeze leaky action', 'future outcome is not available', 'teaching-band:medium', CLINIC_SCENE_0, {
          servicePass: false,
          deadlinePass: false,
          freshnessStatus: 'stale',
          systemPowerW: 24,
          consumedEnergyJ: 96,
          energyBudgetJ: 500,
          budgetRemainingJ: 404,
          rateBitsPerSec: 420000,
          deliveredBits: 168000,
          energyEfficiencyBitsPerJ: 1750,
          activeTimeSec: 4,
          switchCount: 0,
          wakeCount: 1,
          warningCodes: ['CLINIC_REPLAY_PENDING'],
        }),
        frameSpec(40, 'replay held-out action', 'prediction score chased', 'teaching-band:weak', CLINIC_SCENE_1, {
          servicePass: false,
          deadlinePass: false,
          freshnessStatus: 'expired',
          systemPowerW: 19,
          consumedEnergyJ: 300,
          energyBudgetJ: 500,
          budgetRemainingJ: 200,
          rateBitsPerSec: 500000,
          deliveredBits: 1000000,
          energyEfficiencyBitsPerJ: 3333.333,
          activeTimeSec: 24,
          switchCount: 2,
          wakeCount: 1,
          warningCodes: ['POST_ACTION_LEAKAGE', 'DEADLINE_MISSED', 'FRESHNESS_EXPIRED'],
        }),
      ],
    ),
    makeC120Replay(
      scenarioIdentity,
      'clinic-chase-score-decision-time-replay',
      clinicInput('chase-score', 'decision-time-only'),
      'frozen action Q with decision-time features only',
      'chronological Trace B; feature boundary remains honest while the action prioritizes score',
      [
        frameSpec(0, 'freeze action Q', 'decision-time features available', 'teaching-band:medium', CLINIC_SCENE_0, {
          servicePass: false, deadlinePass: false, freshnessStatus: 'stale', systemPowerW: 24,
          consumedEnergyJ: 96, energyBudgetJ: 500, budgetRemainingJ: 404, rateBitsPerSec: 420000,
          deliveredBits: 168000, energyEfficiencyBitsPerJ: 1750, activeTimeSec: 4,
          switchCount: 0, wakeCount: 1, warningCodes: ['CLINIC_REPLAY_PENDING'],
        }),
        frameSpec(40, 'replay held-out action', 'score-prioritized action misses service', 'teaching-band:weak', CLINIC_SCENE_1, {
          servicePass: false, deadlinePass: false, freshnessStatus: 'expired', systemPowerW: 20,
          consumedEnergyJ: 320, energyBudgetJ: 500, budgetRemainingJ: 180, rateBitsPerSec: 480000,
          deliveredBits: 1000000, energyEfficiencyBitsPerJ: 3125, activeTimeSec: 26,
          switchCount: 2, wakeCount: 1, warningCodes: ['DEADLINE_MISSED', 'FRESHNESS_EXPIRED'],
        }),
      ],
    ),
  ];

  const missionContracts: readonly C120MissionContractOption[] = [
    {
      id: 'mission-fixed-service-boundary',
      payloadBits: 1500000,
      deadlineSec: 150,
      boundaryLabel: 'same workload, same contact window, system W and consumed J',
      comparisonStatus: 'COMPARABLE',
      explanation: 'Use this contract for A/B/C evidence comparisons.',
    },
    {
      id: 'mission-different-deadline',
      payloadBits: 900000,
      deadlineSec: 60,
      boundaryLabel: 'different workload and deadline',
      comparisonStatus: 'INCOMPARABLE',
      explanation: 'Do not rank this option against the fixed service boundary.',
    },
  ];

  const candidates: readonly C120ChoiceOption<C120LabACandidateId>[] = [
    { id: 'pace', label: 'Pace to idle', description: 'Finish quickly, then sleep.' },
    { id: 'balanced', label: 'Balanced pace', description: 'Keep the transfer active at a moderate rate.' },
    { id: 'burst-to-sleep', label: 'Burst then sleep', description: 'Use a high burst followed by an early sleep state.' },
  ];
  const rules: readonly C120ChoiceOption<C120LabBRuleId>[] = [
    { id: 'switch-now', label: 'Switch now', description: 'React to the first improvement.' },
    { id: 'stable-two', label: 'Stable for two', description: 'Switch after two stable quality events.' },
    { id: 'hysteresis', label: 'Hysteresis band', description: 'Require clear separation before switching back.' },
  ];
  const actions: readonly C120ChoiceOption<C120ClinicActionId>[] = [
    { id: 'protect-service', label: 'Action P', description: 'Apply the authored P control policy.' },
    { id: 'chase-score', label: 'Action Q', description: 'Apply the authored Q control policy.' },
  ];
  const allowedActionsBySlot: C120Scenario['labC']['allowedActionsBySlot'] = [
    ['fixed-contact'],
    ['send-urgent', 'batch-periodic', 'send-bulk', 'wait', 'sleep'],
    ['send-urgent', 'batch-periodic', 'send-bulk', 'flush-batch', 'wait', 'sleep'],
    ['fixed-outage'],
    ['send-urgent', 'batch-periodic', 'send-bulk', 'flush-batch', 'wait', 'sleep'],
    ['send-urgent', 'batch-periodic', 'send-bulk', 'flush-batch', 'wait', 'sleep'],
  ];

  const manifest: C120Manifest = {
    courseId: C120_COURSE_ID,
    title: 'C-120 Energy Decision 1R',
    exactMinutes: 120,
    contractVersion: C120_CONTRACT_VERSION,
    providerKind: scenarioIdentity.providerKind,
    providerId: scenarioIdentity.providerId,
    scenario: scenarioIdentity,
    segments: C120_SEGMENTS,
    constructedResponseCeiling: 8,
    claimBoundary: C120_CLAIM_BOUNDARY,
    claimLevels: C120_CLAIM_LEVELS,
    units: C120_UNITS,
  };

  return {
    manifest,
    missionContracts,
    tle: {
      identity: tleIdentity,
      sourceLabel: 'ONEWEB-0314 archive snapshot',
      sourceEpochUtc: '2026-08-08T02:21:56.292480Z',
      targetUtc: C120_TARGET_UTC,
      observerLabel: 'NTPU teaching observer',
      producerLabel: 'deterministic C-120 fixture replay producer',
      downloadPath: '/course/c120/oneweb-0314-pinned.tle',
      recordSha256: '112fc0b2ed26b7199eca5792447b85278151424b9ae186d11684fd1daf166c9d',
      lines: [
        'ONEWEB-0314',
        '1 49100U 21075AB  26220.09856820  .00000012  00000+0 -26667-5 0  9994',
        '2 49100  87.9186 355.5353 0001620  86.6329 273.4988 13.17650635240405',
      ],
      frame: tleFrame,
      lineage: [
        { order: 1, label: 'source TLE record', value: C120_TLE_SOURCE_ID, provenance: 'SOURCE' },
        { order: 2, label: 'target UTC', value: C120_TARGET_UTC, provenance: 'COURSE-ASSUMPTION' },
        { order: 3, label: 'NTPU visual anchor', value: 'ntpu-observer-window-v1', provenance: 'MODEL-DERIVED' },
      ],
      tleDoesNotContain: ['power', 'traffic', 'handover', 'energy'],
    },
    labA: {
      candidates,
      referenceReplay: labAReplays[1]!,
      replays: labAReplays,
    },
    labB: {
      rules,
      traceALabel: 'Trace A teaches the rule; Trace B withholds its later quality trend.',
      replays: labBReplays,
    },
    labC: {
      slotLabels: ['fixed contact', 'slot 2', 'slot 3', 'fixed outage', 'slot 5', 'slot 6'],
      allowedActionsBySlot,
      replays: labCReplays,
    },
    clinic: {
      featureCards: [
        { id: 'quality-now', label: 'Quality at decision time', availableAtDecisionTime: true, explanation: 'A legal decision-time feature.' },
        { id: 'freshness-now', label: 'Freshness at decision time', availableAtDecisionTime: true, explanation: 'A legal decision-time feature.' },
        { id: 'timestamp', label: 'Event timestamp', availableAtDecisionTime: true, explanation: 'Required to separate chronological rows.' },
        { id: 'future-delivered', label: 'Future delivered bits', availableAtDecisionTime: false, explanation: 'Post-action outcome; leakage if used as a feature.' },
        { id: 'future-service', label: 'Future service result', availableAtDecisionTime: false, explanation: 'Held-out outcome; not available at decision time.' },
      ],
      actions,
      honestModelScorePercent: 78,
      oracleModelScorePercent: 99,
      replays: clinicReplays,
    },
  };
}

function workbookRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new C120ContractError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function nonEmpty(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new C120ContractError(`${label} must be non-empty`);
  return value;
}

function cloneConstructedResponses(value: unknown): C120ConstructedResponses {
  const responses = workbookRecord(value, 'workbook.constructedResponses');
  const allowed = new Set<string>(C120_CONSTRUCTED_RESPONSE_KEYS);
  const entries = Object.entries(responses);
  if (entries.length > 8) throw new C120ContractError('workbook exceeds eight constructed responses');
  for (const [key, response] of entries) {
    if (!allowed.has(key)) throw new C120ContractError(`workbook.constructedResponses.${key} is unsupported`);
    if (typeof response !== 'string') throw new C120ContractError(`workbook.constructedResponses.${key} must be text`);
  }
  return cloneJson(responses) as C120ConstructedResponses;
}

function assertExactKeys(value: Record<string, unknown>, expected: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) throw new C120ContractError(`${label} has unknown or missing fields`);
}

function buildWorkbookForScenario(
  provider: C120CourseDataProvider,
  scenario: C120Scenario,
  rawInput: C120WorkbookInput,
) {
  const input = workbookRecord(rawInput, 'workbook input');
  assertExactKeys(input, [
    'scenarioId', 'sessionId', 'status', 'checkpointOrdinal', 'sourceMode',
    'completedSegments', 'constructedResponses', 'missionContractId',
    'replayRecords', 'hintProvenance', 'transfer',
  ], 'workbook input');
  const scenarioIdentity = scenario.manifest.scenario;
  if (input.scenarioId !== scenarioIdentity.scenarioId) throw new C120ContractError('workbook input scenarioId mismatch');
  const sessionId = nonEmpty(input.sessionId, 'workbook input.sessionId');
  if (input.status !== 'INCOMPLETE' && input.status !== 'COMPLETE') throw new C120ContractError('workbook input.status mismatch');
  if (input.sourceMode !== scenarioIdentity.sourceMode) throw new C120ContractError('workbook input.sourceMode mismatch');
  if (typeof input.checkpointOrdinal !== 'number' || !Number.isInteger(input.checkpointOrdinal) || input.checkpointOrdinal < 0) {
    throw new C120ContractError('workbook input.checkpointOrdinal must be a non-negative integer');
  }

  if (!Array.isArray(input.completedSegments)) throw new C120ContractError('workbook input.completedSegments must be an array');
  const completedSegments = input.completedSegments.map((segment, index) => {
    if (typeof segment !== 'string' || !C120_SEGMENTS.some(candidate => candidate.id === segment)) {
      throw new C120ContractError(`workbook input.completedSegments[${index}] is unsupported`);
    }
    return segment as C120SegmentId;
  });
  if (new Set(completedSegments).size !== completedSegments.length) {
    throw new C120ContractError('workbook input.completedSegments must not repeat a segment');
  }

  const constructedResponses = cloneConstructedResponses(input.constructedResponses);

  let missionContract: C120MissionContractOption | null = null;
  if (input.missionContractId !== null) {
    const missionContractId = nonEmpty(input.missionContractId, 'workbook input.missionContractId');
    const found = scenario.missionContracts.find(candidate => candidate.id === missionContractId);
    if (found === undefined) throw new C120ContractError('workbook input.missionContractId is unknown');
    missionContract = cloneJson(found);
  }

  if (!Array.isArray(input.replayRecords)) throw new C120ContractError('workbook input.replayRecords must be an array');
  const replayRecords: C120WorkbookReplayRecord[] = input.replayRecords.map((rawRecord, index) => {
    const record = workbookRecord(rawRecord, `workbook input.replayRecords[${index}]`);
    assertExactKeys(record, ['input', 'replayId', 'replayInputId', 'outcome'], `workbook input.replayRecords[${index}]`);
    const parsedInput = parseC120ReplayInput(record.input);
    if (missionContract !== null && parsedInput.missionContractId !== missionContract.id) {
      throw new C120ContractError(`workbook input.replayRecords[${index}] mission contract mismatch`);
    }
    const replay = resolveC120Replay(scenario, parsedInput);
    if (record.replayId !== replay.replayId || record.replayInputId !== replay.replayInputId) {
      throw new C120ContractError(`workbook input.replayRecords[${index}] replay identity mismatch`);
    }
    if (JSON.stringify(record.outcome) !== JSON.stringify(replay.outcome)) {
      throw new C120ContractError(`workbook input.replayRecords[${index}] outcome is not provider-owned`);
    }
    return {
      input: cloneJson(replay.input),
      replayId: replay.replayId,
      replayInputId: replay.replayInputId,
      outcome: cloneJson(replay.outcome),
    };
  });

  if (!Array.isArray(input.hintProvenance) || input.hintProvenance.some(value => typeof value !== 'string')) {
    throw new C120ContractError('workbook input.hintProvenance must be a string array');
  }
  const transfer = workbookRecord(input.transfer, 'workbook input.transfer');
  const transferKeys = [
    'domainId', 'retrievalAnswerId', 'retrievalPowerEnergyId', 'retrievalDynamicPolicyId',
    'retrievalPredictionSavingId', 'transferWhatIfId', 'powerTimePathwayId',
  ] as const;
  assertExactKeys(transfer, transferKeys, 'workbook input.transfer');
  for (const key of transferKeys) {
    if (transfer[key] !== null && typeof transfer[key] !== 'string') {
      throw new C120ContractError(`workbook input.transfer.${key} must be text or null`);
    }
  }

  const workbook = {
    schemaVersion: C120_WORKBOOK_VERSION,
    identity: c120SurfaceIdentity(scenarioIdentity, 'workbook'),
    status: input.status,
    sessionId,
    checkpointOrdinal: input.checkpointOrdinal,
    sourceMode: scenarioIdentity.sourceMode,
    claimBoundary: C120_CLAIM_BOUNDARY,
    scenarioId: scenarioIdentity.scenarioId,
    completedSegments,
    constructedResponseCount: Object.keys(constructedResponses).length,
    constructedResponses,
    missionContract,
    tle: cloneJson(scenario.tle),
    replayRecords,
    hintProvenance: cloneJson(input.hintProvenance),
    transfer: {
      domainId: transfer.domainId as string | null,
      retrievalAnswerId: transfer.retrievalAnswerId as string | null,
      retrievalPowerEnergyId: transfer.retrievalPowerEnergyId as string | null,
      retrievalDynamicPolicyId: transfer.retrievalDynamicPolicyId as string | null,
      retrievalPredictionSavingId: transfer.retrievalPredictionSavingId as string | null,
      transferWhatIfId: transfer.transferWhatIfId as string | null,
      powerTimePathwayId: transfer.powerTimePathwayId as string | null,
    },
    provenance: {
      providerKind: scenarioIdentity.providerKind,
      providerId: scenarioIdentity.providerId,
      fixtureId: scenarioIdentity.fixtureId,
      fixtureVersion: scenarioIdentity.fixtureVersion,
      deterministicReplay: true as const,
      browserScientificFormula: false as const,
    },
  };
  assertC120Workbook(workbook, scenarioIdentity);
  void provider;
  return workbook;
}

export function createC120ProviderFromScenario(
  providerKind: C120ProviderKind,
  providerId: string,
  scenario: C120Scenario,
): C120CourseDataProvider {
  const frozenScenario = deepFreeze(cloneJson(scenario));
  const provider: C120CourseDataProvider = {
    kind: providerKind,
    providerId,
    getScenario: () => cloneJson(frozenScenario),
    buildWorkbook: (input: C120WorkbookInput) => buildWorkbookForScenario(provider, frozenScenario, input),
  };
  return createValidatedC120Provider(provider);
}

export const C120_FIXTURE_SCENARIO: C120Scenario = deepFreeze(
  buildScenario(identity('fixture', 'c120-fixture-provider')),
);

export const C120_STUB_SCENARIO: C120Scenario = deepFreeze(
  buildScenario(identity('stub', 'c120-stub-provider')),
);

/** Alias kept for the fixture-first course seam. */
export const C120_SCENARIO = C120_FIXTURE_SCENARIO;

export const C120_FIXTURE_PROVIDER: C120CourseDataProvider = createC120ProviderFromScenario(
  'fixture',
  'c120-fixture-provider',
  C120_FIXTURE_SCENARIO,
);

export const C120_STUB_PROVIDER: C120CourseDataProvider = createC120ProviderFromScenario(
  'stub',
  'c120-stub-provider',
  C120_STUB_SCENARIO,
);
