/**
 * Strict, provider-bound recovery bundle for the C-120 Energy Decision Workbook.
 *
 * The provider-owned workbook remains untouched inside the bundle. Learner UI
 * evidence and telemetry are carried beside it so an incomplete or complete
 * workbook can be reopened without inventing or recalculating scientific data.
 */

import {
  assertC120Workbook,
  C120_CLAIM_BOUNDARY,
  C120_SEGMENTS,
  type C120CourseDataProvider,
  type C120EnergyDecisionWorkbook,
  type C120ScenarioIdentity,
  type C120SegmentId,
} from './contract';
import {
  assessC120ConstructedResponse,
  validateC120InteractionState,
  type C120InteractionState,
} from './learningState';
import {
  makeC120WorkbookInput,
  restoreC120Session,
  serializeC120Session,
  type C120Session,
} from './session';

export const C120_RECOVERY_BUNDLE_VERSION = 'c120-reopenable-workbook-bundle-v2' as const;

export interface C120InvalidActionCount {
  readonly segmentId: C120SegmentId;
  readonly code: string;
  readonly count: number;
}

export interface C120LearnerTelemetry {
  readonly activeSecondsBySegment: Readonly<Record<C120SegmentId, number>>;
  /** True while instructor talk, waiting, or another non-learner interval is active. */
  readonly activeTimingPaused: boolean;
  readonly artifactCompletionBySegment: Readonly<Record<C120SegmentId, boolean>>;
  readonly firstAnswers: Readonly<Record<string, string>>;
  readonly invalidActions: readonly C120InvalidActionCount[];
  readonly scaffoldEvents: readonly string[];
  readonly instructorRescueCount: number;
  readonly exportCount: number;
  readonly importCount: number;
  readonly causalRubric: {
    readonly status: 'AUTO-MARKERS / NOT HUMAN-SCORED';
    readonly comparableBoundarySelected: boolean;
    readonly evidenceClauseCount: number;
    readonly withheldReplayCount: number;
    readonly falsifierPresent: boolean;
  };
}

export interface C120RecoveryBundle {
  readonly schemaVersion: typeof C120_RECOVERY_BUNDLE_VERSION;
  readonly identity: C120ScenarioIdentity;
  readonly claimBoundary: typeof C120_CLAIM_BOUNDARY;
  readonly activeSegment: C120SegmentId;
  readonly workbook: C120EnergyDecisionWorkbook;
  readonly session: C120Session;
  readonly interaction: C120InteractionState;
  readonly telemetry: C120LearnerTelemetry;
}

const TELEMETRY_KEYS = [
  'activeSecondsBySegment', 'activeTimingPaused', 'artifactCompletionBySegment', 'firstAnswers', 'invalidActions', 'scaffoldEvents',
  'instructorRescueCount', 'exportCount', 'importCount', 'causalRubric',
] as const;
const BUNDLE_KEYS = [
  'schemaVersion', 'identity', 'claimBoundary', 'activeSegment',
  'workbook', 'session', 'interaction', 'telemetry',
] as const;

function fail(message: string): never {
  throw new Error(`C-120 recovery violation: ${message}`);
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[], label: string): void {
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...expected].sort())) {
    fail(`${label} has unknown or missing fields`);
  }
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || !Number.isFinite(value)) {
    fail(`${label} must be a non-negative integer`);
  }
  return value;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createInitialC120Telemetry(): C120LearnerTelemetry {
  return {
    activeSecondsBySegment: Object.fromEntries(C120_SEGMENTS.map(segment => [segment.id, 0])) as Record<C120SegmentId, number>,
    activeTimingPaused: false,
    artifactCompletionBySegment: Object.fromEntries(C120_SEGMENTS.map(segment => [segment.id, false])) as Record<C120SegmentId, boolean>,
    firstAnswers: {},
    invalidActions: [],
    scaffoldEvents: [],
    instructorRescueCount: 0,
    exportCount: 0,
    importCount: 0,
    causalRubric: {
      status: 'AUTO-MARKERS / NOT HUMAN-SCORED',
      comparableBoundarySelected: false,
      evidenceClauseCount: 0,
      withheldReplayCount: 0,
      falsifierPresent: false,
    },
  };
}

export function validateC120Telemetry(value: unknown): C120LearnerTelemetry {
  const candidate = record(value, 'telemetry');
  exactKeys(candidate, TELEMETRY_KEYS, 'telemetry');
  const active = record(candidate.activeSecondsBySegment, 'telemetry.activeSecondsBySegment');
  exactKeys(active, C120_SEGMENTS.map(segment => segment.id), 'telemetry.activeSecondsBySegment');
  const activeSecondsBySegment = Object.fromEntries(C120_SEGMENTS.map(segment => [
    segment.id,
    nonNegativeInteger(active[segment.id], `telemetry.activeSecondsBySegment.${segment.id}`),
  ])) as Record<C120SegmentId, number>;
  if (typeof candidate.activeTimingPaused !== 'boolean') fail('telemetry.activeTimingPaused must be boolean');
  const activeTimingPaused = candidate.activeTimingPaused;
  const completion = record(candidate.artifactCompletionBySegment, 'telemetry.artifactCompletionBySegment');
  exactKeys(completion, C120_SEGMENTS.map(segment => segment.id), 'telemetry.artifactCompletionBySegment');
  const artifactCompletionBySegment = Object.fromEntries(C120_SEGMENTS.map(segment => {
    if (typeof completion[segment.id] !== 'boolean') fail(`telemetry.artifactCompletionBySegment.${segment.id} must be boolean`);
    return [segment.id, completion[segment.id]];
  })) as Record<C120SegmentId, boolean>;
  const first = record(candidate.firstAnswers, 'telemetry.firstAnswers');
  if (Object.values(first).some(item => typeof item !== 'string')) fail('telemetry.firstAnswers values must be text');
  if (!Array.isArray(candidate.invalidActions)) fail('telemetry.invalidActions must be an array');
  const invalidActions = candidate.invalidActions.map((raw, index) => {
    const item = record(raw, `telemetry.invalidActions[${index}]`);
    exactKeys(item, ['segmentId', 'code', 'count'], `telemetry.invalidActions[${index}]`);
    if (!C120_SEGMENTS.some(segment => segment.id === item.segmentId)) fail(`telemetry.invalidActions[${index}].segmentId is unsupported`);
    if (typeof item.code !== 'string' || item.code.trim() === '') fail(`telemetry.invalidActions[${index}].code must be text`);
    return {
      segmentId: item.segmentId as C120SegmentId,
      code: item.code,
      count: nonNegativeInteger(item.count, `telemetry.invalidActions[${index}].count`),
    };
  });
  if (!Array.isArray(candidate.scaffoldEvents) || candidate.scaffoldEvents.some(item => typeof item !== 'string')) {
    fail('telemetry.scaffoldEvents must be a text array');
  }
  const rubric = record(candidate.causalRubric, 'telemetry.causalRubric');
  exactKeys(rubric, ['status', 'comparableBoundarySelected', 'evidenceClauseCount', 'withheldReplayCount', 'falsifierPresent'], 'telemetry.causalRubric');
  if (rubric.status !== 'AUTO-MARKERS / NOT HUMAN-SCORED') fail('telemetry.causalRubric.status mismatch');
  if (typeof rubric.comparableBoundarySelected !== 'boolean' || typeof rubric.falsifierPresent !== 'boolean') {
    fail('telemetry.causalRubric boolean markers are invalid');
  }
  return {
    activeSecondsBySegment,
    activeTimingPaused,
    artifactCompletionBySegment,
    firstAnswers: clone(first) as Readonly<Record<string, string>>,
    invalidActions,
    scaffoldEvents: [...candidate.scaffoldEvents] as string[],
    instructorRescueCount: nonNegativeInteger(candidate.instructorRescueCount, 'telemetry.instructorRescueCount'),
    exportCount: nonNegativeInteger(candidate.exportCount, 'telemetry.exportCount'),
    importCount: nonNegativeInteger(candidate.importCount, 'telemetry.importCount'),
    causalRubric: {
      status: 'AUTO-MARKERS / NOT HUMAN-SCORED',
      comparableBoundarySelected: rubric.comparableBoundarySelected,
      evidenceClauseCount: nonNegativeInteger(rubric.evidenceClauseCount, 'telemetry.causalRubric.evidenceClauseCount'),
      withheldReplayCount: nonNegativeInteger(rubric.withheldReplayCount, 'telemetry.causalRubric.withheldReplayCount'),
      falsifierPresent: rubric.falsifierPresent,
    },
  };
}

export function deriveC120TelemetryMarkers(
  telemetry: C120LearnerTelemetry,
  session: C120Session,
  interaction: C120InteractionState,
): C120LearnerTelemetry {
  const current = validateC120Telemetry(telemetry);
  const artifactCompletionBySegment = Object.fromEntries(C120_SEGMENTS.map(segment => [
    segment.id,
    session.completedSegments.includes(segment.id),
  ])) as Record<C120SegmentId, boolean>;
  const evidenceClauseCount = Object.keys(session.constructedResponses).filter(key => (
    assessC120ConstructedResponse(session.constructedResponses, key as keyof typeof session.constructedResponses).ready
  )).length;
  const withheldReplayCount = session.replayRecords.filter(record => (
    record.input.surface === 'lab-b'
    || record.input.surface === 'clinic'
    || (record.input.surface === 'lab-c' && record.input.withheldEvent !== 'none')
  )).length;
  return {
    ...current,
    artifactCompletionBySegment,
    causalRubric: {
      status: 'AUTO-MARKERS / NOT HUMAN-SCORED',
      comparableBoundarySelected: session.missionContractId !== null && interaction.retrievalAnswerId === 'same-boundary',
      evidenceClauseCount,
      withheldReplayCount,
      falsifierPresent: assessC120ConstructedResponse(session.constructedResponses, 'falsifier').ready,
    },
  };
}

export function incrementC120ActiveSecond(
  telemetry: C120LearnerTelemetry,
  segmentId: C120SegmentId,
): C120LearnerTelemetry {
  const current = validateC120Telemetry(telemetry);
  if (current.activeTimingPaused) return current;
  return {
    ...current,
    activeSecondsBySegment: {
      ...current.activeSecondsBySegment,
      [segmentId]: current.activeSecondsBySegment[segmentId] + 1,
    },
  };
}

/**
 * Pause or resume the learner-active clock.  The value is part of the strict
 * telemetry payload so a recovery import cannot silently resume timing during
 * instructor talk or a waiting interval.
 */
export function setC120ActiveTimingPaused(
  telemetry: C120LearnerTelemetry,
  paused: boolean,
): C120LearnerTelemetry {
  const current = validateC120Telemetry(telemetry);
  if (typeof paused !== 'boolean') fail('active timing pause state must be boolean');
  return current.activeTimingPaused === paused
    ? current
    : { ...current, activeTimingPaused: paused };
}

export function recordC120FirstAnswers(
  telemetry: C120LearnerTelemetry,
  answers: readonly [string, string][],
): C120LearnerTelemetry {
  const current = validateC120Telemetry(telemetry);
  const firstAnswers = { ...current.firstAnswers };
  for (const [key, value] of answers) {
    if (!(key in firstAnswers)) firstAnswers[key] = value;
  }
  return { ...current, firstAnswers };
}

export function recordC120InvalidAction(
  telemetry: C120LearnerTelemetry,
  segmentId: C120SegmentId,
  code: string,
): C120LearnerTelemetry {
  const current = validateC120Telemetry(telemetry);
  const found = current.invalidActions.find(item => item.segmentId === segmentId && item.code === code);
  const invalidActions = found === undefined
    ? [...current.invalidActions, { segmentId, code, count: 1 }]
    : current.invalidActions.map(item => item === found ? { ...item, count: item.count + 1 } : item);
  return { ...current, invalidActions };
}

export function recordC120Scaffold(
  telemetry: C120LearnerTelemetry,
  eventId: string,
): C120LearnerTelemetry {
  const current = validateC120Telemetry(telemetry);
  if (typeof eventId !== 'string' || eventId.trim() === '') fail('scaffold event must be text');
  return current.scaffoldEvents.includes(eventId)
    ? current
    : { ...current, scaffoldEvents: [...current.scaffoldEvents, eventId] };
}

export function makeC120RecoveryBundle(
  provider: C120CourseDataProvider,
  workbook: C120EnergyDecisionWorkbook,
  session: C120Session,
  interaction: C120InteractionState,
  telemetry: C120LearnerTelemetry,
  activeSegment: C120SegmentId,
): C120RecoveryBundle {
  const scenario = provider.getScenario();
  const identity = scenario.manifest.scenario;
  assertC120Workbook(workbook, identity);
  const restoredSession = restoreC120Session(serializeC120Session(session, provider), provider);
  const checkedInteraction = validateC120InteractionState(interaction);
  const checkedTelemetry = deriveC120TelemetryMarkers(telemetry, restoredSession, checkedInteraction);
  if (!C120_SEGMENTS.some(segment => segment.id === activeSegment)) fail('activeSegment is unsupported');
  const firstIncompleteIndex = C120_SEGMENTS.findIndex(segment => !restoredSession.completedSegments.includes(segment.id));
  const activeIndex = C120_SEGMENTS.findIndex(segment => segment.id === activeSegment);
  if (firstIncompleteIndex !== -1
    && activeIndex > firstIncompleteIndex
    && !restoredSession.completedSegments.includes(activeSegment)) {
    fail('activeSegment is locked by session completion order');
  }
  if (workbook.sessionId !== restoredSession.sessionId || workbook.scenarioId !== identity.scenarioId) {
    fail('workbook and session identity do not match');
  }
  if (workbook.provenance.providerId !== identity.providerId || workbook.provenance.providerKind !== identity.providerKind) {
    fail('workbook provider provenance does not match');
  }
  const expectedWorkbook = provider.buildWorkbook(makeC120WorkbookInput(restoredSession, provider));
  if (JSON.stringify(workbook) !== JSON.stringify(expectedWorkbook)) {
    fail('workbook does not exactly match the strict session and provider');
  }
  return {
    schemaVersion: C120_RECOVERY_BUNDLE_VERSION,
    identity: clone(identity),
    claimBoundary: C120_CLAIM_BOUNDARY,
    activeSegment,
    workbook: clone(workbook),
    session: restoredSession,
    interaction: checkedInteraction,
    telemetry: checkedTelemetry,
  };
}

export function serializeC120RecoveryBundle(bundle: C120RecoveryBundle): string {
  return JSON.stringify(bundle, null, 2);
}

export function restoreC120RecoveryBundle(
  serialized: string,
  provider: C120CourseDataProvider,
): C120RecoveryBundle {
  if (typeof serialized !== 'string') fail('bundle must be JSON text');
  let raw: unknown;
  try {
    raw = JSON.parse(serialized) as unknown;
  } catch {
    fail('bundle is invalid JSON');
  }
  const candidate = record(raw, 'bundle');
  exactKeys(candidate, BUNDLE_KEYS, 'bundle');
  if (candidate.schemaVersion !== C120_RECOVERY_BUNDLE_VERSION) fail('schemaVersion is unsupported; migration is not allowed');
  if (candidate.claimBoundary !== C120_CLAIM_BOUNDARY) fail('claimBoundary mismatch');
  const scenario = provider.getScenario();
  if (JSON.stringify(candidate.identity) !== JSON.stringify(scenario.manifest.scenario)) fail('identity does not match the current provider scenario');
  if (!C120_SEGMENTS.some(segment => segment.id === candidate.activeSegment)) fail('activeSegment is unsupported');
  const session = restoreC120Session(JSON.stringify(candidate.session), provider);
  const interaction = validateC120InteractionState(candidate.interaction);
  const telemetry = validateC120Telemetry(candidate.telemetry);
  const workbook = candidate.workbook as C120EnergyDecisionWorkbook;
  assertC120Workbook(workbook, scenario.manifest.scenario);
  return makeC120RecoveryBundle(
    provider,
    workbook,
    session,
    interaction,
    { ...telemetry, importCount: telemetry.importCount + 1 },
    candidate.activeSegment as C120SegmentId,
  );
}
