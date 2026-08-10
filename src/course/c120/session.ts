/**
 * Pure local session state for the exact 120-minute C-120 course.
 *
 * This module stores course decisions and references to provider-owned replay
 * outcomes. It deliberately contains no browser storage and no scientific
 * formula: the only scientific values that enter a session are copied from a
 * replay validated against the current C-120 scenario.
 */

import {
  assertC120Replay,
  assertC120Scenario,
  assertC120ScenarioIdentity,
  C120_CONSTRUCTED_RESPONSE_KEYS,
  C120_COURSE_ID,
  C120ContractError,
  C120_SEGMENTS,
  replayInputId,
  type C120AuthoritativeReplay,
  type C120ClinicActionId,
  type C120ConstructedResponseKey,
  type C120ConstructedResponses,
  type C120CourseDataProvider,
  type C120LabACandidateId,
  type C120LabBRuleId,
  type C120LabBHoldCountId,
  type C120LabBLowerThresholdId,
  type C120LabBThresholdId,
  type C120LabCAction,
  type C120LabCSlots,
  type C120ReplayInput,
  type C120MissionContractId,
  type C120Scenario,
  type C120ScenarioIdentity,
  type C120SegmentId,
  type C120SourceMode,
  type C120WorkbookInput,
  type C120WorkbookReplayRecord,
  type C120WorkbookStatus,
} from './contract';
import { parseC120ReplayInput, resolveC120Replay } from './replay';

export const C120_SESSION_SCHEMA_VERSION = 'c120-local-session-v2' as const;
export const C120_SESSION_STORAGE_PREFIX = 'c120-session-v2' as const;

const IDENTITY_KEYS = [
  'courseId',
  'contractVersion',
  'providerKind',
  'providerId',
  'fixtureId',
  'fixtureVersion',
  'scenarioId',
  'sourceMode',
  'tleSourceId',
  'targetUtc',
  'claimBoundary',
  'claimLevels',
  'units',
] as const;

const SESSION_KEYS = [
  'schemaVersion',
  'identity',
  'sessionId',
  'status',
  'checkpointOrdinal',
  'completedSegments',
  'constructedResponses',
  'missionContractId',
  'replayRecords',
  'labA',
  'labB',
  'labC',
  'clinic',
  'transfer',
  'hintProvenance',
] as const;

const LAB_A_KEYS = ['candidateId', 'hiddenConditionId', 'replayInputId'] as const;
const LAB_B_KEYS = ['frozenRuleId', 'thresholdId', 'holdCountId', 'lowerThresholdId', 'replayInputId'] as const;
const LAB_C_KEYS = ['slots', 'revisionOrdinal', 'withheldEvent', 'replayInputId'] as const;
const CLINIC_KEYS = ['actionId', 'featureSetId', 'selectedFeatureIds', 'replayInputId'] as const;
const TRANSFER_KEYS = [
  'domainId', 'retrievalAnswerId', 'retrievalPowerEnergyId', 'retrievalDynamicPolicyId',
  'retrievalPredictionSavingId', 'transferWhatIfId', 'powerTimePathwayId',
] as const;
const REPLAY_RECORD_KEYS = ['input', 'replayId', 'replayInputId', 'outcome'] as const;

const EVIDENCE_KEYS = [
  'servicePass',
  'deadlinePass',
  'freshnessStatus',
  'systemPowerW',
  'consumedEnergyJ',
  'energyBudgetJ',
  'budgetRemainingJ',
  'rateBitsPerSec',
  'deliveredBits',
  'energyEfficiencyBitsPerJ',
  'activeTimeSec',
  'switchCount',
  'wakeCount',
  'warningCodes',
] as const;

const LAB_A_CANDIDATES: readonly C120LabACandidateId[] = ['pace', 'balanced', 'burst-to-sleep'];
const LAB_B_RULES: readonly C120LabBRuleId[] = ['switch-now', 'stable-two', 'hysteresis'];
const CLINIC_ACTIONS: readonly C120ClinicActionId[] = ['protect-service', 'chase-score'];
const LAB_C_ACTIONS: readonly C120LabCAction[] = [
  'fixed-contact',
  'fixed-outage',
  'send-urgent',
  'batch-periodic',
  'send-bulk',
  'flush-batch',
  'wait',
  'sleep',
];

export interface C120LabASessionState {
  readonly candidateId: C120LabACandidateId | null;
  readonly hiddenConditionId: 'high-idle-cost' | 'tight-service-window' | null;
  readonly replayInputId: string | null;
}

export interface C120LabBSessionState {
  readonly frozenRuleId: C120LabBRuleId | null;
  readonly thresholdId: C120LabBThresholdId | null;
  readonly holdCountId: C120LabBHoldCountId | null;
  readonly lowerThresholdId: C120LabBLowerThresholdId | null;
  readonly replayInputId: string | null;
}

export interface C120LabCSessionState {
  readonly slots: C120LabCSlots;
  readonly revisionOrdinal: 0 | 1;
  readonly withheldEvent: 'none' | 'shorter-window' | 'surprise-urgent';
  readonly replayInputId: string | null;
}

export interface C120ClinicSessionState {
  readonly actionId: C120ClinicActionId | null;
  readonly featureSetId: 'decision-time-only' | 'post-action-mixed' | null;
  readonly selectedFeatureIds: readonly string[];
  readonly replayInputId: string | null;
}

export interface C120TransferSessionState {
  readonly domainId: string | null;
  readonly retrievalAnswerId: string | null;
  readonly retrievalPowerEnergyId: string | null;
  readonly retrievalDynamicPolicyId: string | null;
  readonly retrievalPredictionSavingId: string | null;
  readonly transferWhatIfId: string | null;
  readonly powerTimePathwayId: string | null;
}

export interface C120Session {
  readonly schemaVersion: typeof C120_SESSION_SCHEMA_VERSION;
  readonly identity: C120ScenarioIdentity;
  readonly sessionId: string;
  readonly status: C120WorkbookStatus;
  readonly checkpointOrdinal: number;
  readonly completedSegments: readonly C120SegmentId[];
  readonly constructedResponses: C120ConstructedResponses;
  readonly missionContractId: string | null;
  readonly replayRecords: readonly C120WorkbookReplayRecord[];
  readonly labA: C120LabASessionState;
  readonly labB: C120LabBSessionState;
  readonly labC: C120LabCSessionState;
  readonly clinic: C120ClinicSessionState;
  readonly transfer: C120TransferSessionState;
  readonly hintProvenance: readonly string[];
}

export interface C120SessionOptions {
  readonly sessionId?: string;
}

export interface C120LabCSessionUpdate {
  readonly slots: C120LabCSlots;
  readonly revisionOrdinal: 0 | 1;
  readonly withheldEvent: 'none' | 'shorter-window' | 'surprise-urgent';
  readonly replayInputId?: string | null;
}

export interface C120ClinicSessionUpdate {
  readonly actionId: C120ClinicActionId | null;
  readonly featureSetId: 'decision-time-only' | 'post-action-mixed' | null;
  readonly selectedFeatureIds: readonly string[];
  readonly replayInputId?: string | null;
}

type UnknownRecord = Record<string, unknown>;
type SessionBinding = Pick<C120CourseDataProvider, 'kind' | 'providerId'>;

function fail(message: string): never {
  throw new C120ContractError(`session ${message}`);
}

function asRecord(value: unknown, label: string): UnknownRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  return value as UnknownRecord;
}

function exactKeys(value: UnknownRecord, expected: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    fail(`${label} has unknown or missing fields`);
  }
}

function nonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') fail(`${label} must be a non-empty string`);
  return value;
}

function nullableString(value: unknown, label: string): string | null {
  if (value === null) return null;
  return nonEmptyString(value, label);
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || !Number.isFinite(value) || value < 0) {
    fail(`${label} must be a non-negative integer`);
  }
  return value;
}

function finiteNonNegative(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    fail(`${label} must be finite and non-negative`);
  }
  return value;
}

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && allowed.includes(value as T);
}

function replayMissionId(value: string | null, label: string): C120MissionContractId {
  if (!isOneOf(value, ['mission-fixed-service-boundary', 'mission-different-deadline'] as const)) {
    fail(`${label} requires a selected mission contract`);
  }
  return value;
}

function validatedScenario(provider: C120CourseDataProvider): C120Scenario {
  if (typeof provider !== 'object' || provider === null) fail('provider is missing');
  if (typeof provider.getScenario !== 'function') fail('provider.getScenario is missing');
  const scenario = provider.getScenario();
  assertC120Scenario(scenario, provider);
  return scenario;
}

function validatedIdentity(
  value: unknown,
  expected?: C120ScenarioIdentity,
  provider?: SessionBinding,
): C120ScenarioIdentity {
  const candidate = asRecord(value, 'identity');
  exactKeys(candidate, IDENTITY_KEYS, 'identity');
  assertC120ScenarioIdentity(candidate, provider, 'identity');
  if (expected !== undefined && !sameJson(candidate, expected)) {
    fail('identity does not match the current C-120 scenario');
  }
  return jsonClone(candidate) as C120ScenarioIdentity;
}

function validateCompletedSegments(value: unknown): C120SegmentId[] {
  if (!Array.isArray(value)) fail('completedSegments must be an array');
  const known = new Set<string>(C120_SEGMENTS.map(segment => segment.id));
  const seen = new Set<string>();
  const result: C120SegmentId[] = [];
  for (const [index, segment] of value.entries()) {
    if (typeof segment !== 'string' || !known.has(segment)) {
      fail(`completedSegments[${index}] is not an exact C-120 segment`);
    }
    if (seen.has(segment)) fail('completedSegments must not repeat a segment');
    seen.add(segment);
    result.push(segment as C120SegmentId);
  }
  return result;
}

function statusForSegments(segments: readonly C120SegmentId[]): C120WorkbookStatus {
  return segments.length === C120_SEGMENTS.length ? 'COMPLETE' : 'INCOMPLETE';
}

function validateResponses(value: unknown): C120ConstructedResponses {
  const candidate = asRecord(value, 'constructedResponses');
  const entries = Object.entries(candidate);
  if (entries.length > C120_CONSTRUCTED_RESPONSE_KEYS.length) {
    fail('constructedResponses exceeds the frozen eight-key ceiling');
  }
  const allowed = new Set<string>(C120_CONSTRUCTED_RESPONSE_KEYS);
  for (const [key, response] of entries) {
    if (!allowed.has(key)) fail(`constructedResponses.${key} is not a frozen response key`);
    if (typeof response !== 'string') fail(`constructedResponses.${key} must be text`);
  }
  return jsonClone(candidate) as C120ConstructedResponses;
}

function validateHintProvenance(value: unknown): string[] {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
    fail('hintProvenance must be a string array');
  }
  return [...value] as string[];
}

function validateTransfer(value: unknown): C120TransferSessionState {
  const candidate = asRecord(value, 'transfer');
  exactKeys(candidate, TRANSFER_KEYS, 'transfer');
  return {
    domainId: nullableString(candidate.domainId, 'transfer.domainId'),
    retrievalAnswerId: nullableString(candidate.retrievalAnswerId, 'transfer.retrievalAnswerId'),
    retrievalPowerEnergyId: nullableString(candidate.retrievalPowerEnergyId, 'transfer.retrievalPowerEnergyId'),
    retrievalDynamicPolicyId: nullableString(candidate.retrievalDynamicPolicyId, 'transfer.retrievalDynamicPolicyId'),
    retrievalPredictionSavingId: nullableString(candidate.retrievalPredictionSavingId, 'transfer.retrievalPredictionSavingId'),
    transferWhatIfId: nullableString(candidate.transferWhatIfId, 'transfer.transferWhatIfId'),
    powerTimePathwayId: nullableString(candidate.powerTimePathwayId, 'transfer.powerTimePathwayId'),
  };
}

function validateEvidence(value: unknown, label: string): void {
  const candidate = asRecord(value, label);
  exactKeys(candidate, EVIDENCE_KEYS, label);
  if (typeof candidate.servicePass !== 'boolean' || typeof candidate.deadlinePass !== 'boolean') {
    fail(`${label} service/deadline flags must be boolean`);
  }
  if (!['fresh', 'stale', 'expired', 'not-applicable'].includes(String(candidate.freshnessStatus))) {
    fail(`${label}.freshnessStatus is unsupported`);
  }
  for (const key of [
    'systemPowerW',
    'consumedEnergyJ',
    'energyBudgetJ',
    'budgetRemainingJ',
    'rateBitsPerSec',
    'deliveredBits',
    'energyEfficiencyBitsPerJ',
    'activeTimeSec',
    'switchCount',
    'wakeCount',
  ] as const) {
    finiteNonNegative(candidate[key], `${label}.${key}`);
  }
  if (!Array.isArray(candidate.warningCodes) || candidate.warningCodes.some(code => typeof code !== 'string')) {
    fail(`${label}.warningCodes must be a string array`);
  }
}

function validateReplayRecordShape(value: unknown, index: number): C120WorkbookReplayRecord {
  const candidate = asRecord(value, `replayRecords[${index}]`);
  exactKeys(candidate, REPLAY_RECORD_KEYS, `replayRecords[${index}]`);
  const parsedInput = parseC120ReplayInput(candidate.input);
  const expectedInputId = replayInputId(parsedInput);
  const replayId = nonEmptyString(candidate.replayId, `replayRecords[${index}].replayId`);
  const inputId = nonEmptyString(candidate.replayInputId, `replayRecords[${index}].replayInputId`);
  if (inputId !== expectedInputId) fail(`replayRecords[${index}].replayInputId does not encode its input`);
  validateEvidence(candidate.outcome, `replayRecords[${index}].outcome`);
  return {
    input: jsonClone(parsedInput),
    replayId,
    replayInputId: inputId,
    outcome: jsonClone(candidate.outcome) as C120WorkbookReplayRecord['outcome'],
  };
}

function validateReplayRecords(
  value: unknown,
  scenario?: C120Scenario,
): C120WorkbookReplayRecord[] {
  if (!Array.isArray(value)) fail('replayRecords must be an array');
  const seen = new Set<string>();
  const records: C120WorkbookReplayRecord[] = [];
  for (const [index, rawRecord] of value.entries()) {
    const shaped = validateReplayRecordShape(rawRecord, index);
    if (seen.has(shaped.replayInputId)) fail('replayRecords must not repeat a replay input');
    seen.add(shaped.replayInputId);

    if (scenario !== undefined) {
      const authoritative = resolveC120Replay(scenario, shaped.input);
      if (shaped.replayId !== authoritative.replayId || shaped.replayInputId !== authoritative.replayInputId) {
        fail(`replayRecords[${index}] identity does not match an authoritative replay`);
      }
      if (!sameJson(shaped.outcome, authoritative.outcome)) {
        fail(`replayRecords[${index}] outcome is not provider-owned`);
      }
      records.push({
        input: jsonClone(authoritative.input),
        replayId: authoritative.replayId,
        replayInputId: authoritative.replayInputId,
        outcome: jsonClone(authoritative.outcome),
      });
    } else {
      records.push(shaped);
    }
  }
  return records;
}

function validateReplaySelection(
  scenario: C120Scenario | undefined,
  input: C120ReplayInput,
  selectedReplayInputId: string | null,
  label: string,
): void {
  if (selectedReplayInputId === null) return;
  const expectedInputId = replayInputId(input);
  if (selectedReplayInputId !== expectedInputId) fail(`${label}.replayInputId does not encode its selection`);
  if (scenario !== undefined) {
    const authoritative = resolveC120Replay(scenario, input);
    if (authoritative.replayInputId !== selectedReplayInputId) {
      fail(`${label}.replayInputId is not authoritative`);
    }
  }
}

function validateLabA(
  value: unknown,
  missionContractId: string | null,
  scenario?: C120Scenario,
): C120LabASessionState {
  const candidate = asRecord(value, 'labA');
  exactKeys(candidate, LAB_A_KEYS, 'labA');
  const candidateId = candidate.candidateId === null
    ? null
    : isOneOf(candidate.candidateId, LAB_A_CANDIDATES) ? candidate.candidateId : fail('labA.candidateId is unsupported');
  const hiddenConditionId = candidate.hiddenConditionId === null
    ? null
    : isOneOf(candidate.hiddenConditionId, ['high-idle-cost', 'tight-service-window'] as const)
      ? candidate.hiddenConditionId
      : fail('labA.hiddenConditionId is unsupported');
  const selectedReplayInputId = nullableString(candidate.replayInputId, 'labA.replayInputId');
  if ((candidateId === null || hiddenConditionId === null) && selectedReplayInputId !== null) fail('labA replay selection is incomplete');
  if (candidateId !== null && hiddenConditionId !== null) {
    validateReplaySelection(
      scenario,
      { surface: 'lab-a', missionContractId: replayMissionId(missionContractId, 'labA'), candidateId, hiddenConditionId },
      selectedReplayInputId,
      'labA',
    );
  }
  return { candidateId, hiddenConditionId, replayInputId: selectedReplayInputId };
}

function validateLabB(
  value: unknown,
  missionContractId: string | null,
  scenario?: C120Scenario,
): C120LabBSessionState {
  const candidate = asRecord(value, 'labB');
  exactKeys(candidate, LAB_B_KEYS, 'labB');
  const frozenRuleId = candidate.frozenRuleId === null
    ? null
    : isOneOf(candidate.frozenRuleId, LAB_B_RULES) ? candidate.frozenRuleId : fail('labB.frozenRuleId is unsupported');
  const thresholdId = candidate.thresholdId === null ? null
    : isOneOf(candidate.thresholdId, ['threshold-low', 'threshold-steady', 'threshold-high'] as const)
      ? candidate.thresholdId : fail('labB.thresholdId is unsupported');
  const holdCountId = candidate.holdCountId === null ? null
    : isOneOf(candidate.holdCountId, ['one-step', 'two-steps'] as const)
      ? candidate.holdCountId : fail('labB.holdCountId is unsupported');
  const lowerThresholdId = candidate.lowerThresholdId === null ? null
    : isOneOf(candidate.lowerThresholdId, ['lower-same', 'lower-one-band', 'lower-two-bands'] as const)
      ? candidate.lowerThresholdId : fail('labB.lowerThresholdId is unsupported');
  const selectedReplayInputId = nullableString(candidate.replayInputId, 'labB.replayInputId');
  if ([frozenRuleId, thresholdId, holdCountId, lowerThresholdId].some(value => value === null) && selectedReplayInputId !== null) {
    fail('labB replay selection has incomplete rule blocks');
  }
  if (frozenRuleId !== null && thresholdId !== null && holdCountId !== null && lowerThresholdId !== null) {
    validateReplaySelection(
      scenario,
      {
        surface: 'lab-b', missionContractId: replayMissionId(missionContractId, 'labB'), frozenRuleId,
        thresholdId, holdCountId, lowerThresholdId, traceId: 'trace-b-withheld',
      },
      selectedReplayInputId,
      'labB',
    );
  }
  return { frozenRuleId, thresholdId, holdCountId, lowerThresholdId, replayInputId: selectedReplayInputId };
}

function validateLabC(
  value: unknown,
  missionContractId: string | null,
  scenario?: C120Scenario,
): C120LabCSessionState {
  const candidate = asRecord(value, 'labC');
  exactKeys(candidate, LAB_C_KEYS, 'labC');
  if (!Array.isArray(candidate.slots) || candidate.slots.length !== 6) {
    fail('labC.slots must contain exactly six slots');
  }
  if (candidate.slots.some(action => !isOneOf(action, LAB_C_ACTIONS))) {
    fail('labC.slots contains an unsupported action');
  }
  const revisionOrdinal = candidate.revisionOrdinal === 0 || candidate.revisionOrdinal === 1
    ? candidate.revisionOrdinal
    : fail('labC.revisionOrdinal must be 0 or 1');
  const withheldEvent = isOneOf(candidate.withheldEvent, ['none', 'shorter-window', 'surprise-urgent'] as const)
    ? candidate.withheldEvent
    : fail('labC.withheldEvent is unsupported');
  const selectedReplayInputId = nullableString(candidate.replayInputId, 'labC.replayInputId');
  if (selectedReplayInputId !== null && missionContractId === null) fail('labC replay selection requires a mission contract');
  const parsedInput = parseC120ReplayInput({
    surface: 'lab-c',
    missionContractId: missionContractId ?? 'mission-fixed-service-boundary',
    slots: candidate.slots,
    revisionOrdinal,
    withheldEvent,
  });
  if (parsedInput.surface !== 'lab-c') fail('labC input surface was not preserved');
  if (scenario !== undefined) {
    parsedInput.slots.forEach((action, index) => {
      const allowed = scenario.labC.allowedActionsBySlot[index] as readonly C120LabCAction[] | undefined;
      if (!allowed?.includes(action)) {
        fail(`labC.slots[${index}] is not allowed by the scenario`);
      }
    });
  }
  validateReplaySelection(scenario, parsedInput, selectedReplayInputId, 'labC');
  return {
    slots: jsonClone(parsedInput.slots),
    revisionOrdinal: parsedInput.revisionOrdinal,
    withheldEvent: parsedInput.withheldEvent,
    replayInputId: selectedReplayInputId,
  };
}

function validateClinic(
  value: unknown,
  missionContractId: string | null,
  scenario?: C120Scenario,
): C120ClinicSessionState {
  const candidate = asRecord(value, 'clinic');
  exactKeys(candidate, CLINIC_KEYS, 'clinic');
  const actionId = candidate.actionId === null
    ? null
    : isOneOf(candidate.actionId, CLINIC_ACTIONS) ? candidate.actionId : fail('clinic.actionId is unsupported');
  const featureSetId = candidate.featureSetId === null ? null
    : isOneOf(candidate.featureSetId, ['decision-time-only', 'post-action-mixed'] as const)
      ? candidate.featureSetId : fail('clinic.featureSetId is unsupported');
  if (!Array.isArray(candidate.selectedFeatureIds) || candidate.selectedFeatureIds.some(id => typeof id !== 'string' || id.trim() === '')) {
    fail('clinic.selectedFeatureIds must be non-empty strings');
  }
  const selectedFeatureIds = [...candidate.selectedFeatureIds] as string[];
  if (new Set(selectedFeatureIds).size !== selectedFeatureIds.length) {
    fail('clinic.selectedFeatureIds must not repeat a feature');
  }
  if (scenario !== undefined) {
    const featureIds = new Set(scenario.clinic.featureCards.map(card => card.id));
    if (selectedFeatureIds.some(id => !featureIds.has(id))) {
      fail('clinic.selectedFeatureIds contains an unknown feature');
    }
  }
  const selectedReplayInputId = nullableString(candidate.replayInputId, 'clinic.replayInputId');
  if ((actionId === null || featureSetId === null) && selectedReplayInputId !== null) fail('clinic replay selection is incomplete');
  if (actionId !== null && featureSetId !== null) {
    validateReplaySelection(
      scenario,
      {
        surface: 'clinic', missionContractId: replayMissionId(missionContractId, 'clinic'),
        actionId, featureSetId, traceId: 'chronological-trace-b',
      },
      selectedReplayInputId,
      'clinic',
    );
  }
  return { actionId, featureSetId, selectedFeatureIds, replayInputId: selectedReplayInputId };
}

function canonicalizeSession(value: unknown, provider?: C120CourseDataProvider): C120Session {
  const scenario = provider === undefined ? undefined : validatedScenario(provider);
  const candidate = asRecord(value, 'session');
  exactKeys(candidate, SESSION_KEYS, 'session');
  if (candidate.schemaVersion !== C120_SESSION_SCHEMA_VERSION) {
    fail('schemaVersion is unsupported; migration is not allowed');
  }
  const expectedIdentity = scenario?.manifest.scenario;
  const identity = validatedIdentity(candidate.identity, expectedIdentity, provider);
  const sessionId = nonEmptyString(candidate.sessionId, 'sessionId');
  const checkpointOrdinal = nonNegativeInteger(candidate.checkpointOrdinal, 'checkpointOrdinal');
  const completedSegments = validateCompletedSegments(candidate.completedSegments);
  const status = candidate.status === 'INCOMPLETE' || candidate.status === 'COMPLETE'
    ? candidate.status
    : fail('status is unsupported');
  if (status !== statusForSegments(completedSegments)) {
    fail('status must be derived from exact segment completion');
  }
  const constructedResponses = validateResponses(candidate.constructedResponses);
  const missionContractId = nullableString(candidate.missionContractId, 'missionContractId');
  if (missionContractId !== null && scenario !== undefined && !scenario.missionContracts.some(contract => contract.id === missionContractId)) {
    fail('missionContractId is not in the current scenario');
  }
  const replayRecords = validateReplayRecords(candidate.replayRecords, scenario);
  if (missionContractId !== null && replayRecords.some(record => record.input.missionContractId !== missionContractId)) {
    fail('replayRecords mission contract does not match the session');
  }
  const labA = validateLabA(candidate.labA, missionContractId, scenario);
  const labB = validateLabB(candidate.labB, missionContractId, scenario);
  const labC = validateLabC(candidate.labC, missionContractId, scenario);
  const clinic = validateClinic(candidate.clinic, missionContractId, scenario);
  const transfer = validateTransfer(candidate.transfer);
  const hintProvenance = validateHintProvenance(candidate.hintProvenance);

  return {
    schemaVersion: C120_SESSION_SCHEMA_VERSION,
    identity,
    sessionId,
    status,
    checkpointOrdinal,
    completedSegments,
    constructedResponses,
    missionContractId,
    replayRecords,
    labA,
    labB,
    labC,
    clinic,
    transfer,
    hintProvenance,
  };
}

function normalizedOptions(options?: C120SessionOptions | string): C120SessionOptions {
  if (options === undefined) return {};
  if (typeof options === 'string') return { sessionId: options };
  return options;
}

function defaultLabCSlots(scenario: C120Scenario): C120LabCSlots {
  const defaultAction = (index: number): C120LabCAction => {
    const allowed = scenario.labC.allowedActionsBySlot[index] as readonly C120LabCAction[] | undefined;
    if (allowed?.includes('wait')) return 'wait';
    const action = allowed?.[0];
    if (action === undefined) fail(`scenario.labC.allowedActionsBySlot[${index}] is empty`);
    return action;
  };
  return [
    'fixed-contact',
    defaultAction(1),
    defaultAction(2),
    'fixed-outage',
    defaultAction(4),
    defaultAction(5),
  ];
}

export function createC120Session(
  provider: C120CourseDataProvider,
  options?: C120SessionOptions | string,
): C120Session {
  const scenario = validatedScenario(provider);
  const requested = normalizedOptions(options);
  const sessionId = requested.sessionId ?? `c120-${provider.providerId}-${scenario.manifest.scenario.scenarioId}`;
  const fresh: C120Session = {
    schemaVersion: C120_SESSION_SCHEMA_VERSION,
    identity: jsonClone(scenario.manifest.scenario),
    sessionId: nonEmptyString(sessionId, 'sessionId'),
    status: 'INCOMPLETE',
    checkpointOrdinal: 0,
    completedSegments: [],
    constructedResponses: {},
    missionContractId: null,
    replayRecords: [],
    labA: { candidateId: null, hiddenConditionId: null, replayInputId: null },
    labB: { frozenRuleId: null, thresholdId: null, holdCountId: null, lowerThresholdId: null, replayInputId: null },
    labC: {
      slots: defaultLabCSlots(scenario),
      revisionOrdinal: 0,
      withheldEvent: 'none',
      replayInputId: null,
    },
    clinic: { actionId: null, featureSetId: null, selectedFeatureIds: [], replayInputId: null },
    transfer: {
      domainId: null,
      retrievalAnswerId: null,
      retrievalPowerEnergyId: null,
      retrievalDynamicPolicyId: null,
      retrievalPredictionSavingId: null,
      transferWhatIfId: null,
      powerTimePathwayId: null,
    },
    hintProvenance: [],
  };
  return canonicalizeSession(fresh, provider);
}

export const newC120Session = createC120Session;

export function resetC120Session(
  provider: C120CourseDataProvider,
  options?: C120SessionOptions | string,
): C120Session {
  return createC120Session(provider, options);
}

export function assertC120Session(value: unknown, provider?: C120CourseDataProvider): asserts value is C120Session {
  canonicalizeSession(value, provider);
}

export function validateC120Session(value: unknown, provider?: C120CourseDataProvider): C120Session {
  return canonicalizeSession(value, provider);
}

export function completeC120Segment(session: C120Session, segmentId: C120SegmentId): C120Session {
  const current = canonicalizeSession(session);
  if (!C120_SEGMENTS.some(segment => segment.id === segmentId)) fail(`segment ${String(segmentId)} is unsupported`);
  const completedSegments = current.completedSegments.includes(segmentId)
    ? [...current.completedSegments]
    : [...current.completedSegments, segmentId];
  return canonicalizeSession({
    ...current,
    completedSegments,
    status: statusForSegments(completedSegments),
  });
}

export const markC120SegmentComplete = completeC120Segment;

export function setC120CheckpointOrdinal(session: C120Session, checkpointOrdinal: number): C120Session {
  const current = canonicalizeSession(session);
  nonNegativeInteger(checkpointOrdinal, 'checkpointOrdinal');
  return canonicalizeSession({ ...current, checkpointOrdinal });
}

export function setC120ConstructedResponse(
  session: C120Session,
  key: C120ConstructedResponseKey,
  response: string,
): C120Session {
  if (!C120_CONSTRUCTED_RESPONSE_KEYS.includes(key)) fail(`constructed response key ${String(key)} is unsupported`);
  if (typeof response !== 'string') fail('constructed response must be text');
  const current = canonicalizeSession(session);
  return canonicalizeSession({
    ...current,
    constructedResponses: { ...current.constructedResponses, [key]: response },
  });
}

export function setC120ConstructedResponses(
  session: C120Session,
  responses: C120ConstructedResponses,
): C120Session {
  const current = canonicalizeSession(session);
  const constructedResponses = validateResponses(responses);
  return canonicalizeSession({ ...current, constructedResponses });
}

export function setC120MissionContract(
  session: C120Session,
  missionContractId: string | null,
  provider?: C120CourseDataProvider,
): C120Session {
  const current = canonicalizeSession(session, provider);
  const scenario = provider === undefined ? undefined : validatedScenario(provider);
  const normalized = nullableString(missionContractId, 'missionContractId');
  if (normalized !== null && scenario !== undefined && !scenario.missionContracts.some(contract => contract.id === normalized)) {
    fail('missionContractId is not in the current scenario');
  }
  if (current.replayRecords.length > 0 && normalized !== current.missionContractId) {
    fail('missionContractId cannot change after an authoritative replay exists');
  }
  return canonicalizeSession({ ...current, missionContractId: normalized }, provider);
}

export function setC120LabCState(
  session: C120Session,
  state: C120LabCSessionUpdate,
  provider?: C120CourseDataProvider,
): C120Session {
  const current = canonicalizeSession(session, provider);
  const nextLabC = {
    slots: state.slots,
    revisionOrdinal: state.revisionOrdinal,
    withheldEvent: state.withheldEvent,
    replayInputId: state.replayInputId ?? null,
  };
  return canonicalizeSession({ ...current, labC: nextLabC }, provider);
}

export function setC120ClinicState(
  session: C120Session,
  state: C120ClinicSessionUpdate,
  provider?: C120CourseDataProvider,
): C120Session {
  const current = canonicalizeSession(session, provider);
  const nextClinic = {
    actionId: state.actionId,
    featureSetId: state.featureSetId,
    selectedFeatureIds: state.selectedFeatureIds,
    replayInputId: state.replayInputId ?? null,
  };
  return canonicalizeSession({ ...current, clinic: nextClinic }, provider);
}

export function setC120TransferState(
  session: C120Session,
  transfer: C120TransferSessionState,
): C120Session {
  const current = canonicalizeSession(session);
  return canonicalizeSession({ ...current, transfer });
}

export function setC120HintProvenance(
  session: C120Session,
  hintProvenance: readonly string[],
): C120Session {
  const current = canonicalizeSession(session);
  return canonicalizeSession({ ...current, hintProvenance });
}

function isAuthoritativeReplay(value: unknown): value is C120AuthoritativeReplay {
  return asRecord(value, 'replay selection') !== undefined
    && 'frames' in (value as UnknownRecord)
    && 'outcome' in (value as UnknownRecord)
    && 'identity' in (value as UnknownRecord);
}

function applyReplaySelection(
  session: C120Session,
  input: C120ReplayInput,
  selectedReplayInputId: string,
): C120Session {
  if (input.surface === 'lab-a') {
    return {
      ...session,
      labA: { candidateId: input.candidateId, hiddenConditionId: input.hiddenConditionId, replayInputId: selectedReplayInputId },
    };
  }
  if (input.surface === 'lab-b') {
    return {
      ...session,
      labB: {
        frozenRuleId: input.frozenRuleId,
        thresholdId: input.thresholdId,
        holdCountId: input.holdCountId,
        lowerThresholdId: input.lowerThresholdId,
        replayInputId: selectedReplayInputId,
      },
    };
  }
  if (input.surface === 'lab-c') {
    return {
      ...session,
      labC: {
        slots: jsonClone(input.slots),
        revisionOrdinal: input.revisionOrdinal,
        withheldEvent: input.withheldEvent,
        replayInputId: selectedReplayInputId,
      },
    };
  }
  return {
    ...session,
    clinic: {
      ...session.clinic,
      actionId: input.actionId,
      featureSetId: input.featureSetId,
      replayInputId: selectedReplayInputId,
    },
  };
}

export function addC120ReplayRecord(
  session: C120Session,
  provider: C120CourseDataProvider,
  replayOrInput: C120AuthoritativeReplay | C120ReplayInput,
): C120Session {
  const current = canonicalizeSession(session, provider);
  const scenario = validatedScenario(provider);
  let inputValue: unknown = replayOrInput;
  if (isAuthoritativeReplay(replayOrInput)) {
    const parsedInput = parseC120ReplayInput(replayOrInput.input);
    assertC120Replay(replayOrInput, scenario.manifest.scenario, parsedInput.surface, 'selected replay');
    inputValue = parsedInput;
  }
  const authoritative = resolveC120Replay(scenario, inputValue);
  if (current.missionContractId === null || authoritative.input.missionContractId !== current.missionContractId) {
    fail('authoritative replay mission contract does not match the session');
  }
  const record: C120WorkbookReplayRecord = {
    input: jsonClone(authoritative.input),
    replayId: authoritative.replayId,
    replayInputId: authoritative.replayInputId,
    outcome: jsonClone(authoritative.outcome),
  };
  const replayRecords = [
    ...current.replayRecords.filter(existing => existing.replayInputId !== record.replayInputId),
    record,
  ];
  const selected = applyReplaySelection({ ...current, replayRecords }, authoritative.input, authoritative.replayInputId);
  return canonicalizeSession(selected, provider);
}

export const recordC120Replay = addC120ReplayRecord;

export function makeC120WorkbookInput(
  session: C120Session,
  provider?: C120CourseDataProvider,
): C120WorkbookInput {
  const current = canonicalizeSession(session, provider);
  return {
    scenarioId: current.identity.scenarioId,
    sessionId: current.sessionId,
    status: statusForSegments(current.completedSegments),
    checkpointOrdinal: current.checkpointOrdinal,
    sourceMode: current.identity.sourceMode as C120SourceMode,
    completedSegments: jsonClone(current.completedSegments),
    constructedResponses: jsonClone(current.constructedResponses),
    missionContractId: current.missionContractId,
    replayRecords: jsonClone(current.replayRecords),
    hintProvenance: jsonClone(current.hintProvenance),
    transfer: jsonClone(current.transfer),
  };
}

export const toC120WorkbookInput = makeC120WorkbookInput;

export function serializeC120Session(
  session: C120Session,
  provider?: C120CourseDataProvider,
): string {
  const current = canonicalizeSession(session, provider);
  return JSON.stringify(current);
}

export function restoreC120Session(
  serialized: string,
  provider: C120CourseDataProvider,
): C120Session {
  if (typeof serialized !== 'string') fail('serialized session must be JSON text');
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized) as unknown;
  } catch {
    fail('serialized session is invalid JSON');
  }
  return canonicalizeSession(parsed, provider);
}

export const deserializeC120Session = restoreC120Session;

export function getC120SessionStorageKey(provider: C120CourseDataProvider): string {
  const scenario = validatedScenario(provider);
  const identity = scenario.manifest.scenario;
  return [
    C120_SESSION_STORAGE_PREFIX,
    encodeURIComponent(C120_COURSE_ID),
    encodeURIComponent(identity.providerId),
    encodeURIComponent(identity.scenarioId),
  ].join(':');
}

export const c120SessionStorageKey = getC120SessionStorageKey;
