/**
 * C-120-ENERGY-DECISION-1R data contract.
 *
 * This module owns identity, units, claim boundaries, provider validation and
 * replay envelopes only. It intentionally contains no link-budget or energy
 * formula. Every displayed scientific value must arrive in a validated,
 * versioned provider replay.
 */

export const C120_ROUTE = '/course/c120';
export const C120_COURSE_ID = 'C-120-ENERGY-DECISION-1R';
export const C120_CONTRACT_VERSION = 'c120-fixture-first-v2';
export const C120_WORKBOOK_VERSION = 'c120-energy-decision-workbook-v2';
export const C120_CLAIM_BOUNDARY =
  'SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED / NOT CANONICAL-PARITY-VERIFIED';

export type C120ProviderKind = 'fixture' | 'stub' | 'canonical-adapter';
export type C120SourceMode = 'bundled' | 'fallback';
export type C120WorkbookStatus = 'INCOMPLETE' | 'COMPLETE';

export const C120_CLAIM_LEVELS = Object.freeze([
  'SIMULATED_TEACHING_DATA',
  'NOT_LIVE',
  'NOT_MEASURED',
  'NOT_CANONICAL_PARITY_VERIFIED',
] as const);

export type C120ClaimLevel = (typeof C120_CLAIM_LEVELS)[number];

export const C120_UNITS = Object.freeze({
  elapsedTime: 's',
  activeTime: 's',
  deadline: 's',
  freshness: 's',
  power: 'W',
  consumedEnergy: 'J',
  energyBudget: 'J',
  rate: 'bit/s',
  deliveredData: 'bit',
  energyEfficiency: 'bit/J',
  angle: 'deg',
  distance: 'km',
  quality: 'teaching-band',
} as const);

export type C120UnitContract = typeof C120_UNITS;

export const C120_SEGMENTS = Object.freeze([
  { id: 'claim-detective', clock: '00–10', minutes: 10, label: 'Energy claim detective' },
  { id: 'tle-anchor', clock: '10–18', minutes: 8, label: 'TLE → NTPU data anchor' },
  { id: 'lab-a', clock: '18–41', minutes: 23, label: 'Lab A · Same job, different pace' },
  { id: 'lab-b', clock: '41–64', minutes: 23, label: 'Lab B · Act now or wait' },
  { id: 'recovery', clock: '64–69', minutes: 5, label: 'Recovery reset' },
  { id: 'lab-c', clock: '69–92', minutes: 23, label: 'Lab C · Spend the joules' },
  { id: 'clinic', clock: '92–106', minutes: 14, label: 'Evidence clinic' },
  { id: 'transfer', clock: '106–120', minutes: 14, label: 'Competition transfer' },
] as const);

export type C120SegmentId = (typeof C120_SEGMENTS)[number]['id'];

export const C120_CONSTRUCTED_RESPONSE_KEYS = Object.freeze([
  'openingClause',
  'labAClause',
  'labBClause',
  'recoveryClause',
  'labCClause',
  'clinicClause',
  'competitionHypothesis',
  'falsifier',
] as const);

export type C120ConstructedResponseKey = (typeof C120_CONSTRUCTED_RESPONSE_KEYS)[number];
export type C120ConstructedResponses = Partial<Record<C120ConstructedResponseKey, string>>;

export interface C120ScenarioIdentity {
  readonly courseId: typeof C120_COURSE_ID;
  readonly contractVersion: typeof C120_CONTRACT_VERSION;
  readonly providerKind: C120ProviderKind;
  readonly providerId: string;
  readonly fixtureId: string;
  readonly fixtureVersion: string;
  readonly scenarioId: string;
  readonly sourceMode: C120SourceMode;
  readonly tleSourceId: string;
  readonly targetUtc: string;
  readonly claimBoundary: typeof C120_CLAIM_BOUNDARY;
  readonly claimLevels: readonly C120ClaimLevel[];
  readonly units: C120UnitContract;
}

export type C120SurfaceId = 'tle' | 'lab-a' | 'lab-b' | 'lab-c' | 'clinic' | 'workbook';

export interface C120SurfaceIdentity {
  readonly courseId: typeof C120_COURSE_ID;
  readonly contractVersion: typeof C120_CONTRACT_VERSION;
  readonly providerKind: C120ProviderKind;
  readonly providerId: string;
  readonly fixtureId: string;
  readonly fixtureVersion: string;
  readonly scenarioId: string;
  readonly claimBoundary: typeof C120_CLAIM_BOUNDARY;
  readonly claimLevels: readonly C120ClaimLevel[];
  readonly units: C120UnitContract;
  readonly surface: C120SurfaceId;
}

export interface C120FrameIdentity extends C120SurfaceIdentity {
  readonly replayId: string;
  readonly replayInputId: string;
  readonly frameId: string;
}

export interface C120Manifest {
  readonly courseId: typeof C120_COURSE_ID;
  readonly title: string;
  readonly exactMinutes: 120;
  readonly contractVersion: typeof C120_CONTRACT_VERSION;
  readonly providerKind: C120ProviderKind;
  readonly providerId: string;
  readonly scenario: C120ScenarioIdentity;
  readonly segments: typeof C120_SEGMENTS;
  readonly constructedResponseCeiling: 8;
  readonly claimBoundary: typeof C120_CLAIM_BOUNDARY;
  readonly claimLevels: readonly C120ClaimLevel[];
  readonly units: C120UnitContract;
}

export interface C120SceneState {
  readonly satellitePosition: readonly [number, number, number];
  readonly beamPosition: readonly [number, number, number];
  readonly observerPosition: readonly [number, number, number];
  readonly visible: boolean;
  readonly azimuthDeg: number;
  readonly elevationDeg: number;
  readonly rangeKm: number;
}

export interface C120Evidence {
  readonly servicePass: boolean;
  readonly deadlinePass: boolean;
  readonly freshnessStatus: 'fresh' | 'stale' | 'expired' | 'not-applicable';
  readonly systemPowerW: number;
  readonly consumedEnergyJ: number;
  readonly energyBudgetJ: number;
  readonly budgetRemainingJ: number;
  readonly rateBitsPerSec: number;
  readonly deliveredBits: number;
  readonly energyEfficiencyBitsPerJ: number;
  readonly activeTimeSec: number;
  readonly switchCount: number;
  readonly wakeCount: number;
  readonly warningCodes: readonly string[];
}

export interface C120ReplayFrame {
  readonly identity: C120FrameIdentity;
  readonly frameIndex: number;
  readonly elapsedSec: number;
  readonly actionLabel: string;
  readonly stateLabel: string;
  readonly qualityLabel: string;
  readonly scene: C120SceneState;
  readonly evidence: C120Evidence;
}

export type C120LabACandidateId = 'pace' | 'balanced' | 'burst-to-sleep';
export type C120LabBRuleId = 'switch-now' | 'stable-two' | 'hysteresis';
export type C120ClinicActionId = 'protect-service' | 'chase-score';
export type C120MissionContractId = 'mission-fixed-service-boundary' | 'mission-different-deadline';
export type C120LabAConditionId = 'high-idle-cost' | 'tight-service-window';
export type C120LabBThresholdId = 'threshold-low' | 'threshold-steady' | 'threshold-high';
export type C120LabBHoldCountId = 'one-step' | 'two-steps';
export type C120LabBLowerThresholdId = 'lower-same' | 'lower-one-band' | 'lower-two-bands';
export type C120ClinicFeatureSetId = 'decision-time-only' | 'post-action-mixed';

export type C120LabCAction =
  | 'fixed-contact'
  | 'fixed-outage'
  | 'send-urgent'
  | 'batch-periodic'
  | 'send-bulk'
  | 'flush-batch'
  | 'wait'
  | 'sleep';

export type C120LabCSlots = readonly [
  'fixed-contact',
  C120LabCAction,
  C120LabCAction,
  'fixed-outage',
  C120LabCAction,
  C120LabCAction,
];

export interface C120LabAScenarioInput {
  readonly surface: 'lab-a';
  readonly missionContractId: C120MissionContractId;
  readonly candidateId: C120LabACandidateId;
  readonly hiddenConditionId: C120LabAConditionId;
}

export interface C120LabBScenarioInput {
  readonly surface: 'lab-b';
  readonly missionContractId: C120MissionContractId;
  readonly frozenRuleId: C120LabBRuleId;
  readonly thresholdId: C120LabBThresholdId;
  readonly holdCountId: C120LabBHoldCountId;
  readonly lowerThresholdId: C120LabBLowerThresholdId;
  readonly traceId: 'trace-b-withheld';
}

export interface C120LabCScenarioInput {
  readonly surface: 'lab-c';
  readonly missionContractId: C120MissionContractId;
  readonly slots: C120LabCSlots;
  readonly revisionOrdinal: 0 | 1;
  readonly withheldEvent: 'none' | 'shorter-window' | 'surprise-urgent';
}

export interface C120ClinicScenarioInput {
  readonly surface: 'clinic';
  readonly missionContractId: C120MissionContractId;
  readonly actionId: C120ClinicActionId;
  readonly featureSetId: C120ClinicFeatureSetId;
  readonly traceId: 'chronological-trace-b';
}

export type C120ReplayInput =
  | C120LabAScenarioInput
  | C120LabBScenarioInput
  | C120LabCScenarioInput
  | C120ClinicScenarioInput;

export interface C120AuthoritativeReplay {
  readonly identity: C120SurfaceIdentity;
  readonly replayId: string;
  readonly replayInputId: string;
  readonly input: C120ReplayInput;
  readonly mechanismLabel: string;
  readonly conditionLabel: string;
  readonly frames: readonly C120ReplayFrame[];
  readonly outcome: C120Evidence;
  readonly cardLedger: readonly C120CardEvidence[];
}

export interface C120CardEvidence {
  readonly cardId: string;
  readonly generatedAtSec: number;
  readonly sentAtSec: number | null;
  readonly receivedAtSec: number | null;
  readonly state: 'queued' | 'sent' | 'received' | 'expired' | 'not-sent';
  readonly servicePass: boolean;
  readonly freshnessStatus: C120Evidence['freshnessStatus'];
  readonly consumedEnergyJ: number;
  readonly budgetRemainingJ: number;
  readonly deliveredBits: number;
  readonly energyEfficiencyBitsPerJ: number;
}

export interface C120ChoiceOption<T extends string> {
  readonly id: T;
  readonly label: string;
  readonly description: string;
}

export interface C120TleAnchor {
  readonly identity: C120SurfaceIdentity;
  readonly sourceLabel: string;
  readonly sourceEpochUtc: string;
  readonly targetUtc: string;
  readonly observerLabel: string;
  readonly producerLabel: string;
  readonly downloadPath: string;
  readonly recordSha256: string;
  readonly lines: readonly [string, string, string];
  readonly frame: C120ReplayFrame;
  readonly lineage: readonly {
    readonly order: 1 | 2 | 3;
    readonly label: string;
    readonly value: string;
    readonly provenance: 'SOURCE' | 'MODEL-DERIVED' | 'COURSE-ASSUMPTION';
  }[];
  readonly tleDoesNotContain: readonly ['power', 'traffic', 'handover', 'energy'];
}

export interface C120MissionContractOption {
  readonly id: C120MissionContractId;
  readonly payloadBits: number;
  readonly deadlineSec: number;
  readonly boundaryLabel: string;
  readonly comparisonStatus: 'COMPARABLE' | 'INCOMPARABLE';
  readonly explanation: string;
}

export interface C120Scenario {
  readonly manifest: C120Manifest;
  readonly missionContracts: readonly C120MissionContractOption[];
  readonly tle: C120TleAnchor;
  readonly labA: {
    readonly candidates: readonly C120ChoiceOption<C120LabACandidateId>[];
    readonly referenceReplay: C120AuthoritativeReplay;
    readonly replays: readonly C120AuthoritativeReplay[];
  };
  readonly labB: {
    readonly rules: readonly C120ChoiceOption<C120LabBRuleId>[];
    readonly traceALabel: string;
    readonly replays: readonly C120AuthoritativeReplay[];
  };
  readonly labC: {
    readonly slotLabels: readonly [string, string, string, string, string, string];
    readonly allowedActionsBySlot: readonly [
      readonly ['fixed-contact'],
      readonly C120LabCAction[],
      readonly C120LabCAction[],
      readonly ['fixed-outage'],
      readonly C120LabCAction[],
      readonly C120LabCAction[],
    ];
    readonly replays: readonly C120AuthoritativeReplay[];
  };
  readonly clinic: {
    readonly featureCards: readonly {
      readonly id: string;
      readonly label: string;
      readonly availableAtDecisionTime: boolean;
      readonly explanation: string;
    }[];
    readonly actions: readonly C120ChoiceOption<C120ClinicActionId>[];
    readonly honestModelScorePercent: number;
    readonly oracleModelScorePercent: number;
    readonly replays: readonly C120AuthoritativeReplay[];
  };
}

export interface C120WorkbookReplayRecord {
  readonly input: C120ReplayInput;
  readonly replayId: string;
  readonly replayInputId: string;
  readonly outcome: C120Evidence;
}

export interface C120WorkbookInput {
  readonly scenarioId: string;
  readonly sessionId: string;
  readonly status: C120WorkbookStatus;
  readonly checkpointOrdinal: number;
  readonly sourceMode: C120SourceMode;
  readonly completedSegments: readonly C120SegmentId[];
  readonly constructedResponses: C120ConstructedResponses;
  readonly missionContractId: string | null;
  readonly replayRecords: readonly C120WorkbookReplayRecord[];
  readonly hintProvenance: readonly string[];
  readonly transfer: {
    readonly domainId: string | null;
    readonly retrievalAnswerId: string | null;
    readonly retrievalPowerEnergyId: string | null;
    readonly retrievalDynamicPolicyId: string | null;
    readonly retrievalPredictionSavingId: string | null;
    readonly transferWhatIfId: string | null;
    readonly powerTimePathwayId: string | null;
  };
}

export interface C120EnergyDecisionWorkbook {
  readonly schemaVersion: typeof C120_WORKBOOK_VERSION;
  readonly identity: C120SurfaceIdentity;
  readonly status: C120WorkbookStatus;
  readonly sessionId: string;
  readonly checkpointOrdinal: number;
  readonly sourceMode: C120SourceMode;
  readonly claimBoundary: typeof C120_CLAIM_BOUNDARY;
  readonly scenarioId: string;
  readonly completedSegments: readonly C120SegmentId[];
  readonly constructedResponseCount: number;
  readonly constructedResponses: C120ConstructedResponses;
  readonly missionContract: C120MissionContractOption | null;
  readonly tle: C120TleAnchor;
  readonly replayRecords: readonly C120WorkbookReplayRecord[];
  readonly hintProvenance: readonly string[];
  readonly transfer: C120WorkbookInput['transfer'];
  readonly provenance: {
    readonly providerKind: C120ProviderKind;
    readonly providerId: string;
    readonly fixtureId: string;
    readonly fixtureVersion: string;
    readonly deterministicReplay: true;
    readonly browserScientificFormula: false;
  };
}

export interface C120CourseDataProvider {
  readonly kind: C120ProviderKind;
  readonly providerId: string;
  getScenario(): C120Scenario;
  buildWorkbook(input: C120WorkbookInput): C120EnergyDecisionWorkbook;
}

export class C120ContractError extends Error {
  constructor(message: string) {
    super(`C-120 contract violation: ${message}`);
    this.name = 'C120ContractError';
  }
}

type UnknownRecord = Record<string, unknown>;

function record(value: unknown, label: string): UnknownRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new C120ContractError(`${label} must be an object`);
  }
  return value as UnknownRecord;
}

function nonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new C120ContractError(`${label} must be a non-empty string`);
  }
  return value;
}

function finiteNumber(value: unknown, label: string, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum) {
    throw new C120ContractError(`${label} must be finite and >= ${minimum}`);
  }
  return value;
}

function exactJson(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new C120ContractError(`${label} does not match the frozen contract`);
  }
}

function exactIdentityField(
  candidate: UnknownRecord,
  expected: C120ScenarioIdentity,
  key: 'courseId' | 'contractVersion' | 'providerKind' | 'providerId' | 'fixtureId' | 'fixtureVersion' | 'scenarioId' | 'claimBoundary',
  label: string,
): void {
  if (candidate[key] !== expected[key]) {
    throw new C120ContractError(`${label}.${key} does not match scenario identity`);
  }
}

export function assertC120ScenarioIdentity(
  value: unknown,
  expectedProvider?: Pick<C120CourseDataProvider, 'kind' | 'providerId'>,
  label = 'scenario',
): asserts value is C120ScenarioIdentity {
  const candidate = record(value, label);
  if (candidate.courseId !== C120_COURSE_ID) throw new C120ContractError(`${label}.courseId mismatch`);
  if (candidate.contractVersion !== C120_CONTRACT_VERSION) throw new C120ContractError(`${label}.contractVersion mismatch`);
  if (!['fixture', 'stub', 'canonical-adapter'].includes(String(candidate.providerKind))) {
    throw new C120ContractError(`${label}.providerKind is unsupported`);
  }
  nonEmptyString(candidate.providerId, `${label}.providerId`);
  nonEmptyString(candidate.fixtureId, `${label}.fixtureId`);
  nonEmptyString(candidate.fixtureVersion, `${label}.fixtureVersion`);
  nonEmptyString(candidate.scenarioId, `${label}.scenarioId`);
  if (!['bundled', 'fallback'].includes(String(candidate.sourceMode))) {
    throw new C120ContractError(`${label}.sourceMode is unsupported`);
  }
  nonEmptyString(candidate.tleSourceId, `${label}.tleSourceId`);
  const targetUtc = nonEmptyString(candidate.targetUtc, `${label}.targetUtc`);
  if (!targetUtc.endsWith('Z') || !Number.isFinite(Date.parse(targetUtc))) {
    throw new C120ContractError(`${label}.targetUtc must be a UTC timestamp`);
  }
  if (candidate.claimBoundary !== C120_CLAIM_BOUNDARY) {
    throw new C120ContractError(`${label}.claimBoundary mismatch`);
  }
  exactJson(candidate.claimLevels, C120_CLAIM_LEVELS, `${label}.claimLevels`);
  exactJson(candidate.units, C120_UNITS, `${label}.units`);
  if (expectedProvider !== undefined && (
    candidate.providerKind !== expectedProvider.kind || candidate.providerId !== expectedProvider.providerId
  )) {
    throw new C120ContractError(`${label} does not match provider identity`);
  }
}

export function assertC120SurfaceIdentity(
  value: unknown,
  expected: C120ScenarioIdentity,
  surface: C120SurfaceId,
  label: string = surface,
): asserts value is C120SurfaceIdentity {
  const candidate = record(value, `${label}.identity`);
  for (const key of ['courseId', 'contractVersion', 'providerKind', 'providerId', 'fixtureId', 'fixtureVersion', 'scenarioId', 'claimBoundary'] as const) {
    exactIdentityField(candidate, expected, key, `${label}.identity`);
  }
  if (candidate.surface !== surface) throw new C120ContractError(`${label}.identity.surface mismatch`);
  exactJson(candidate.claimLevels, C120_CLAIM_LEVELS, `${label}.identity.claimLevels`);
  exactJson(candidate.units, C120_UNITS, `${label}.identity.units`);
}

function assertC120Evidence(value: unknown, label: string): asserts value is C120Evidence {
  const candidate = record(value, label);
  for (const key of ['servicePass', 'deadlinePass'] as const) {
    if (typeof candidate[key] !== 'boolean') throw new C120ContractError(`${label}.${key} must be boolean`);
  }
  if (!['fresh', 'stale', 'expired', 'not-applicable'].includes(String(candidate.freshnessStatus))) {
    throw new C120ContractError(`${label}.freshnessStatus is unsupported`);
  }
  for (const key of [
    'systemPowerW', 'consumedEnergyJ', 'energyBudgetJ', 'budgetRemainingJ',
    'rateBitsPerSec', 'deliveredBits', 'energyEfficiencyBitsPerJ', 'activeTimeSec',
    'switchCount', 'wakeCount',
  ] as const) {
    finiteNumber(candidate[key], `${label}.${key}`);
  }
  if (!Array.isArray(candidate.warningCodes) || candidate.warningCodes.some(item => typeof item !== 'string')) {
    throw new C120ContractError(`${label}.warningCodes must be a string array`);
  }
}

function assertC120Frame(
  value: unknown,
  expected: C120ScenarioIdentity,
  surface: C120SurfaceId,
  replayId: string,
  replayInputId: string,
  index: number,
  label: string,
): asserts value is C120ReplayFrame {
  const candidate = record(value, label);
  const identity = record(candidate.identity, `${label}.identity`);
  assertC120SurfaceIdentity(identity, expected, surface, label);
  if (identity.replayId !== replayId) throw new C120ContractError(`${label}.identity.replayId mismatch`);
  if (identity.replayInputId !== replayInputId) throw new C120ContractError(`${label}.identity.replayInputId mismatch`);
  nonEmptyString(identity.frameId, `${label}.identity.frameId`);
  if (candidate.frameIndex !== index) throw new C120ContractError(`${label}.frameIndex must be contiguous`);
  finiteNumber(candidate.elapsedSec, `${label}.elapsedSec`);
  nonEmptyString(candidate.actionLabel, `${label}.actionLabel`);
  nonEmptyString(candidate.stateLabel, `${label}.stateLabel`);
  nonEmptyString(candidate.qualityLabel, `${label}.qualityLabel`);
  const scene = record(candidate.scene, `${label}.scene`);
  for (const key of ['satellitePosition', 'beamPosition', 'observerPosition'] as const) {
    if (!Array.isArray(scene[key]) || scene[key].length !== 3 || scene[key].some(item => typeof item !== 'number' || !Number.isFinite(item))) {
      throw new C120ContractError(`${label}.scene.${key} must be a finite xyz tuple`);
    }
  }
  if (typeof scene.visible !== 'boolean') throw new C120ContractError(`${label}.scene.visible must be boolean`);
  for (const key of ['azimuthDeg', 'elevationDeg', 'rangeKm'] as const) {
    finiteNumber(scene[key], `${label}.scene.${key}`, key === 'elevationDeg' ? -90 : 0);
  }
  assertC120Evidence(candidate.evidence, `${label}.evidence`);
}

export function replayInputId(input: C120ReplayInput): string {
  const mission = input.missionContractId;
  if (input.surface === 'lab-a') return `lab-a:${mission}:${input.candidateId}:${input.hiddenConditionId}`;
  if (input.surface === 'lab-b') {
    return `lab-b:${mission}:${input.frozenRuleId}:${input.thresholdId}:${input.holdCountId}:${input.lowerThresholdId}:${input.traceId}`;
  }
  if (input.surface === 'clinic') return `clinic:${mission}:${input.actionId}:${input.featureSetId}:${input.traceId}`;
  return `lab-c:${mission}:${input.slots.join('|')}:r${input.revisionOrdinal}:${input.withheldEvent}`;
}

function assertReplayInput(value: unknown, label: string): C120ReplayInput {
  const candidate = record(value, label);
  if (!['mission-fixed-service-boundary', 'mission-different-deadline'].includes(String(candidate.missionContractId))) {
    throw new C120ContractError(`${label}.missionContractId is unsupported`);
  }
  if (candidate.surface === 'lab-a') {
    if (!['pace', 'balanced', 'burst-to-sleep'].includes(String(candidate.candidateId))) {
      throw new C120ContractError(`${label}.candidateId is unsupported`);
    }
    if (!['high-idle-cost', 'tight-service-window'].includes(String(candidate.hiddenConditionId))) {
      throw new C120ContractError(`${label}.hiddenConditionId is unsupported`);
    }
    return candidate as unknown as C120LabAScenarioInput;
  }
  if (candidate.surface === 'lab-b') {
    if (!['switch-now', 'stable-two', 'hysteresis'].includes(String(candidate.frozenRuleId))) {
      throw new C120ContractError(`${label}.frozenRuleId is unsupported`);
    }
    if (!['threshold-low', 'threshold-steady', 'threshold-high'].includes(String(candidate.thresholdId))) {
      throw new C120ContractError(`${label}.thresholdId is unsupported`);
    }
    if (!['one-step', 'two-steps'].includes(String(candidate.holdCountId))) {
      throw new C120ContractError(`${label}.holdCountId is unsupported`);
    }
    if (!['lower-same', 'lower-one-band', 'lower-two-bands'].includes(String(candidate.lowerThresholdId))) {
      throw new C120ContractError(`${label}.lowerThresholdId is unsupported`);
    }
    if (candidate.traceId !== 'trace-b-withheld') throw new C120ContractError(`${label}.traceId mismatch`);
    return candidate as unknown as C120LabBScenarioInput;
  }
  if (candidate.surface === 'clinic') {
    if (!['protect-service', 'chase-score'].includes(String(candidate.actionId))) {
      throw new C120ContractError(`${label}.actionId is unsupported`);
    }
    if (!['decision-time-only', 'post-action-mixed'].includes(String(candidate.featureSetId))) {
      throw new C120ContractError(`${label}.featureSetId is unsupported`);
    }
    if (candidate.traceId !== 'chronological-trace-b') throw new C120ContractError(`${label}.traceId mismatch`);
    return candidate as unknown as C120ClinicScenarioInput;
  }
  if (candidate.surface === 'lab-c') {
    const supportedActions: readonly C120LabCAction[] = [
      'fixed-contact', 'fixed-outage', 'send-urgent', 'batch-periodic',
      'send-bulk', 'flush-batch', 'wait', 'sleep',
    ];
    if (!Array.isArray(candidate.slots) || candidate.slots.length !== 6) {
      throw new C120ContractError(`${label}.slots must contain six actions`);
    }
    if (candidate.slots[0] !== 'fixed-contact' || candidate.slots[3] !== 'fixed-outage') {
      throw new C120ContractError(`${label}.slots fixed contact/outage anchors mismatch`);
    }
    if (candidate.slots.some(action => !supportedActions.includes(action as C120LabCAction))) {
      throw new C120ContractError(`${label}.slots contains an unsupported action`);
    }
    if (candidate.revisionOrdinal !== 0 && candidate.revisionOrdinal !== 1) {
      throw new C120ContractError(`${label}.revisionOrdinal mismatch`);
    }
    if (!['none', 'shorter-window', 'surprise-urgent'].includes(String(candidate.withheldEvent))) {
      throw new C120ContractError(`${label}.withheldEvent mismatch`);
    }
    return candidate as unknown as C120LabCScenarioInput;
  }
  throw new C120ContractError(`${label}.surface is unsupported`);
}

export function assertC120Replay(
  value: unknown,
  expected: C120ScenarioIdentity,
  expectedSurface?: Exclude<C120SurfaceId, 'tle' | 'workbook'>,
  label = 'replay',
): asserts value is C120AuthoritativeReplay {
  const candidate = record(value, label);
  const input = assertReplayInput(candidate.input, `${label}.input`);
  if (expectedSurface !== undefined && input.surface !== expectedSurface) {
    throw new C120ContractError(`${label}.input.surface mismatch`);
  }
  const inputId = replayInputId(input);
  if (candidate.replayInputId !== inputId) throw new C120ContractError(`${label}.replayInputId does not encode its input`);
  const replayId = nonEmptyString(candidate.replayId, `${label}.replayId`);
  assertC120SurfaceIdentity(candidate.identity, expected, input.surface, label);
  nonEmptyString(candidate.mechanismLabel, `${label}.mechanismLabel`);
  nonEmptyString(candidate.conditionLabel, `${label}.conditionLabel`);
  if (!Array.isArray(candidate.frames) || candidate.frames.length < 2) {
    throw new C120ContractError(`${label}.frames must contain at least two authoritative frames`);
  }
  candidate.frames.forEach((frame, index) => assertC120Frame(frame, expected, input.surface, replayId, inputId, index, `${label}.frames/${index}`));
  assertC120Evidence(candidate.outcome, `${label}.outcome`);
  const lastFrame = candidate.frames[candidate.frames.length - 1] as C120ReplayFrame;
  exactJson(candidate.outcome, lastFrame.evidence, `${label}.outcome`);
  if (!Array.isArray(candidate.cardLedger)) throw new C120ContractError(`${label}.cardLedger must be an array`);
  candidate.cardLedger.forEach((entry, index) => {
    const card = record(entry, `${label}.cardLedger/${index}`);
    nonEmptyString(card.cardId, `${label}.cardLedger/${index}.cardId`);
    finiteNumber(card.generatedAtSec, `${label}.cardLedger/${index}.generatedAtSec`);
    for (const key of ['sentAtSec', 'receivedAtSec'] as const) {
      if (card[key] !== null) finiteNumber(card[key], `${label}.cardLedger/${index}.${key}`);
    }
    if (!['queued', 'sent', 'received', 'expired', 'not-sent'].includes(String(card.state))) {
      throw new C120ContractError(`${label}.cardLedger/${index}.state is unsupported`);
    }
    if (typeof card.servicePass !== 'boolean') throw new C120ContractError(`${label}.cardLedger/${index}.servicePass must be boolean`);
    if (!['fresh', 'stale', 'expired', 'not-applicable'].includes(String(card.freshnessStatus))) {
      throw new C120ContractError(`${label}.cardLedger/${index}.freshnessStatus is unsupported`);
    }
    for (const key of ['consumedEnergyJ', 'budgetRemainingJ', 'deliveredBits', 'energyEfficiencyBitsPerJ'] as const) {
      finiteNumber(card[key], `${label}.cardLedger/${index}.${key}`);
    }
  });
}

function assertC120Tle(value: unknown, expected: C120ScenarioIdentity): asserts value is C120TleAnchor {
  const candidate = record(value, 'tle');
  assertC120SurfaceIdentity(candidate.identity, expected, 'tle');
  for (const key of ['sourceLabel', 'sourceEpochUtc', 'targetUtc', 'observerLabel', 'producerLabel', 'downloadPath', 'recordSha256'] as const) {
    nonEmptyString(candidate[key], `tle.${key}`);
  }
  if (!Array.isArray(candidate.lines) || candidate.lines.length !== 3 || candidate.lines.some(line => typeof line !== 'string' || line.trim() === '')) {
    throw new C120ContractError('tle.lines must contain the pinned three-line record');
  }
  const frame = record(candidate.frame, 'tle.frame');
  const identity = record(frame.identity, 'tle.frame.identity');
  const replayId = nonEmptyString(identity.replayId, 'tle.frame.identity.replayId');
  const inputId = nonEmptyString(identity.replayInputId, 'tle.frame.identity.replayInputId');
  assertC120Frame(frame, expected, 'tle', replayId, inputId, 0, 'tle.frame');
  if (!Array.isArray(candidate.lineage) || candidate.lineage.length !== 3) {
    throw new C120ContractError('tle.lineage must contain exactly three steps');
  }
  exactJson(candidate.tleDoesNotContain, ['power', 'traffic', 'handover', 'energy'], 'tle.tleDoesNotContain');
}

export function assertC120Scenario(
  value: unknown,
  provider: Pick<C120CourseDataProvider, 'kind' | 'providerId'>,
): asserts value is C120Scenario {
  const candidate = record(value, 'scenarioPayload');
  const manifest = record(candidate.manifest, 'manifest');
  assertC120ScenarioIdentity(manifest.scenario, provider);
  const expected = manifest.scenario as unknown as C120ScenarioIdentity;
  if (manifest.courseId !== C120_COURSE_ID || manifest.contractVersion !== C120_CONTRACT_VERSION) {
    throw new C120ContractError('manifest course or contract identity mismatch');
  }
  if (manifest.providerKind !== provider.kind || manifest.providerId !== provider.providerId) {
    throw new C120ContractError('manifest provider identity mismatch');
  }
  if (manifest.exactMinutes !== 120 || manifest.constructedResponseCeiling !== 8) {
    throw new C120ContractError('manifest cadence or response ceiling mismatch');
  }
  exactJson(manifest.segments, C120_SEGMENTS, 'manifest.segments');
  exactJson(manifest.claimLevels, C120_CLAIM_LEVELS, 'manifest.claimLevels');
  exactJson(manifest.units, C120_UNITS, 'manifest.units');
  if (manifest.claimBoundary !== C120_CLAIM_BOUNDARY) throw new C120ContractError('manifest.claimBoundary mismatch');
  if (!Array.isArray(candidate.missionContracts) || candidate.missionContracts.length < 2) {
    throw new C120ContractError('missionContracts must include comparable and incomparable options');
  }
  assertC120Tle(candidate.tle, expected);
  for (const surface of ['labA', 'labB', 'labC', 'clinic'] as const) {
    const section = record(candidate[surface], surface);
    if (!Array.isArray(section.replays) || section.replays.length < 2) {
      throw new C120ContractError(`${surface}.replays must include consequential alternatives`);
    }
    const expectedSurface = surface === 'labA' ? 'lab-a' : surface === 'labB' ? 'lab-b' : surface === 'labC' ? 'lab-c' : 'clinic';
    section.replays.forEach((replay, index) => assertC120Replay(replay, expected, expectedSurface, `${surface}.replays/${index}`));
  }
  const labA = record(candidate.labA, 'labA');
  assertC120Replay(labA.referenceReplay, expected, 'lab-a', 'labA.referenceReplay');
}

export function assertC120Workbook(
  value: unknown,
  expected: C120ScenarioIdentity,
): asserts value is C120EnergyDecisionWorkbook {
  const candidate = record(value, 'workbook');
  if (candidate.schemaVersion !== C120_WORKBOOK_VERSION) throw new C120ContractError('workbook.schemaVersion mismatch');
  assertC120SurfaceIdentity(candidate.identity, expected, 'workbook');
  if (!['INCOMPLETE', 'COMPLETE'].includes(String(candidate.status))) throw new C120ContractError('workbook.status mismatch');
  if (candidate.scenarioId !== expected.scenarioId) throw new C120ContractError('workbook.scenarioId mismatch');
  if (candidate.claimBoundary !== C120_CLAIM_BOUNDARY) throw new C120ContractError('workbook.claimBoundary mismatch');
  const responseCount = finiteNumber(candidate.constructedResponseCount, 'workbook.constructedResponseCount');
  if (responseCount > 8) throw new C120ContractError('workbook exceeds eight constructed responses');
}

export function createValidatedC120Provider(provider: C120CourseDataProvider): C120CourseDataProvider {
  if (typeof provider !== 'object' || provider === null) throw new C120ContractError('provider is missing');
  if (!['fixture', 'stub', 'canonical-adapter'].includes(provider.kind)) throw new C120ContractError('provider.kind is unsupported');
  nonEmptyString(provider.providerId, 'provider.providerId');
  if (typeof provider.getScenario !== 'function' || typeof provider.buildWorkbook !== 'function') {
    throw new C120ContractError('provider methods are incomplete');
  }
  const scenario = provider.getScenario();
  assertC120Scenario(scenario, provider);
  const probe = provider.buildWorkbook({
    scenarioId: scenario.manifest.scenario.scenarioId,
    sessionId: 'gate0-provider-probe',
    status: 'INCOMPLETE',
    checkpointOrdinal: 0,
    sourceMode: scenario.manifest.scenario.sourceMode,
    completedSegments: [],
    constructedResponses: {},
    missionContractId: null,
    replayRecords: [],
    hintProvenance: [],
    transfer: {
      domainId: null,
      retrievalAnswerId: null,
      retrievalPowerEnergyId: null,
      retrievalDynamicPolicyId: null,
      retrievalPredictionSavingId: null,
      transferWhatIfId: null,
      powerTimePathwayId: null,
    },
  });
  assertC120Workbook(probe, scenario.manifest.scenario);
  return provider;
}

export function evidenceChanged(a: C120Evidence, b: C120Evidence): boolean {
  return a.servicePass !== b.servicePass
    || a.deadlinePass !== b.deadlinePass
    || a.freshnessStatus !== b.freshnessStatus
    || a.consumedEnergyJ !== b.consumedEnergyJ
    || a.deliveredBits !== b.deliveredBits
    || a.energyEfficiencyBitsPerJ !== b.energyEfficiencyBitsPerJ;
}
