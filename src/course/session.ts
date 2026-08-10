import type {
  CourseDataProvider,
  CourseManifest,
  CourseStage,
  E1ArmId,
  E1Record,
  E2Action,
  E2Record,
  IdeaCard,
  IoTRecord,
  IoTVersion,
  LearningBundleInput,
  TleSourceMode,
  TleTimeWindow,
} from './contract';

const E1_ARM_IDS: readonly E1ArmId[] = ['balanced', 'low-power', 'fast-finish'];
const E2_ACTIONS: readonly E2Action[] = ['switch-now', 'wait', 'remain'];
const IOT_VERSIONS: readonly IoTVersion[] = ['baseline', 'learner', 'revision'];
const VERDICTS: readonly NonNullable<E1Record['verdict']>[] = ['accept', 'qualify', 'reject'];
export const COURSE_SESSION_STORAGE_VERSION = 'c90-session-v2';

export interface CourseSessionState {
  readonly sessionId: string;
  readonly resetOrdinal: number;
  readonly activeStage: CourseStage;
  readonly readyCheckCompleted: boolean;
  readonly tleStageIndex: number;
  readonly tleCompleted: boolean;
  readonly tleExplanation: string;
  readonly tleSelectedSourceId: string;
  readonly tleSelectedWindowId: TleTimeWindow['windowId'];
  readonly tleTimelineIndex: number;
  readonly tleSourceMode: TleSourceMode;
  readonly tleSourceConfirmed: boolean;
  readonly tleImportedFilename: string | null;
  readonly tleFallbackUsed: boolean;
  readonly e1Prediction: string;
  readonly e1CheckpointUpdate: string;
  readonly e1CheckpointCaptured: boolean;
  readonly e1ArmOrder: readonly E1ArmId[];
  readonly e1ActiveArmId: E1ArmId | null;
  readonly e1TimelineIndex: number;
  readonly e1CompletedArmIds: readonly E1ArmId[];
  readonly e1SelectedArm: E1ArmId | null;
  readonly e1Verdict: E1Record['verdict'];
  readonly e1Explanation: string;
  readonly e2Prediction: string;
  readonly e2TraceId: 'trace-a' | 'trace-b';
  readonly e2ActiveAction: E2Action | null;
  readonly e2TimelineIndex: number;
  readonly e2TraceAAction: E2Action | null;
  readonly e2TraceAReplayAction: E2Action | null;
  readonly e2TraceBAction: E2Action | null;
  readonly e2TraceACompleted: boolean;
  readonly e2TraceAReplayCompleted: boolean;
  readonly e2TraceBCompleted: boolean;
  readonly e2FrozenRule: string;
  readonly e2RuleFrozen: boolean;
  readonly e2Verdict: E2Record['verdict'];
  readonly e2Explanation: string;
  readonly iotPrediction: string;
  readonly iotSelectedVersion: IoTVersion;
  readonly iotObservedVersions: readonly IoTVersion[];
  readonly iotSelectedRule: string;
  readonly iotRevisedRule: string;
  readonly iotVerdict: IoTRecord['verdict'];
  readonly iotExplanation: string;
  readonly ideaCard: IdeaCard;
}

const EMPTY_IDEA_CARD: IdeaCard = {
  sensedData: '',
  stateToPredict: '',
  baseline: '',
  controlAction: '',
  powerTimePathway: '',
  energyIndicator: '',
  serviceConstraint: '',
  falsifier: '',
};

const COURSE_STAGES: readonly CourseStage[] = ['ready', 'tle', 'e1', 'e2', 'iot', 'competition', 'complete'];

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOptionalMember(value: unknown, predicate: (candidate: unknown) => boolean): boolean {
  return value === null || predicate(value);
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

function isIdeaCard(value: unknown): value is IdeaCard {
  if (!isRecord(value)) return false;
  return (Object.keys(EMPTY_IDEA_CARD) as (keyof IdeaCard)[]).every(key => typeof value[key] === 'string');
}

function isPersistableSession(value: unknown): value is CourseSessionState {
  if (!isRecord(value)) return false;
  if (typeof value.sessionId !== 'string' || !/^c90-.+-session-\d+$/.test(value.sessionId)) return false;
  if (!Number.isInteger(value.resetOrdinal) || Number(value.resetOrdinal) < 0) return false;
  if (typeof value.activeStage !== 'string' || !COURSE_STAGES.includes(value.activeStage as CourseStage)) return false;
  if (typeof value.readyCheckCompleted !== 'boolean' || typeof value.tleStageIndex !== 'number' || !Number.isInteger(value.tleStageIndex) || Number(value.tleStageIndex) < 0 || typeof value.tleCompleted !== 'boolean' || typeof value.tleExplanation !== 'string') return false;
  if (typeof value.tleSelectedSourceId !== 'string' || value.tleSelectedSourceId.trim() === '' || !isTleWindowId(value.tleSelectedWindowId) || typeof value.tleTimelineIndex !== 'number' || !Number.isInteger(value.tleTimelineIndex) || Number(value.tleTimelineIndex) < 0) return false;
  if (!isTleSourceMode(value.tleSourceMode) || typeof value.tleSourceConfirmed !== 'boolean' || (value.tleImportedFilename !== null && typeof value.tleImportedFilename !== 'string') || typeof value.tleFallbackUsed !== 'boolean') return false;
  if ((value.tleSourceMode === 'imported') !== (typeof value.tleImportedFilename === 'string' && value.tleImportedFilename.trim() !== '') || value.tleFallbackUsed !== (value.tleSourceMode === 'fallback')) return false;
  if (typeof value.e1Prediction !== 'string' || typeof value.e1CheckpointUpdate !== 'string' || typeof value.e1CheckpointCaptured !== 'boolean') return false;
  if (!isStringArray(value.e1ArmOrder) || !value.e1ArmOrder.every(item => isE1ArmId(item as E1ArmId)) || !isStringArray(value.e1CompletedArmIds) || !value.e1CompletedArmIds.every(item => isE1ArmId(item as E1ArmId))) return false;
  if (!isOptionalMember(value.e1ActiveArmId, item => typeof item === 'string' && isE1ArmId(item as E1ArmId)) || typeof value.e1TimelineIndex !== 'number' || !Number.isInteger(value.e1TimelineIndex) || Number(value.e1TimelineIndex) < 0) return false;
  if (!isOptionalMember(value.e1SelectedArm, item => typeof item === 'string' && isE1ArmId(item as E1ArmId)) || !isOptionalMember(value.e1Verdict, item => typeof item === 'string' && VERDICTS.includes(item as Verdict)) || typeof value.e1Explanation !== 'string') return false;
  if (typeof value.e2Prediction !== 'string' || (value.e2TraceId !== 'trace-a' && value.e2TraceId !== 'trace-b') || !isOptionalMember(value.e2ActiveAction, item => typeof item === 'string' && isE2Action(item as E2Action)) || typeof value.e2TimelineIndex !== 'number' || !Number.isInteger(value.e2TimelineIndex) || Number(value.e2TimelineIndex) < 0) return false;
  if (!isOptionalMember(value.e2TraceAAction, item => typeof item === 'string' && isE2Action(item as E2Action)) || !isOptionalMember(value.e2TraceAReplayAction, item => typeof item === 'string' && isE2Action(item as E2Action)) || !isOptionalMember(value.e2TraceBAction, item => typeof item === 'string' && isE2Action(item as E2Action))) return false;
  if (typeof value.e2TraceACompleted !== 'boolean' || typeof value.e2TraceAReplayCompleted !== 'boolean' || typeof value.e2TraceBCompleted !== 'boolean' || typeof value.e2FrozenRule !== 'string' || typeof value.e2RuleFrozen !== 'boolean' || !isOptionalMember(value.e2Verdict, item => typeof item === 'string' && VERDICTS.includes(item as Verdict)) || typeof value.e2Explanation !== 'string') return false;
  if (typeof value.iotPrediction !== 'string' || !isOptionalMember(value.iotSelectedVersion, item => typeof item === 'string' && isIoTVersion(item as IoTVersion)) || !isStringArray(value.iotObservedVersions) || !value.iotObservedVersions.every(item => isIoTVersion(item as IoTVersion)) || typeof value.iotSelectedRule !== 'string' || typeof value.iotRevisedRule !== 'string' || !isOptionalMember(value.iotVerdict, item => typeof item === 'string' && VERDICTS.includes(item as Verdict)) || typeof value.iotExplanation !== 'string') return false;
  return isIdeaCard(value.ideaCard);
}

type Verdict = NonNullable<E1Record['verdict']>;

function isNonBlank(value: string): boolean {
  return value.trim() !== '';
}

function isVerdict(value: CourseSessionState['e1Verdict']): value is Verdict {
  return value !== null && VERDICTS.includes(value);
}

function isE1ArmId(value: E1ArmId): boolean {
  return E1_ARM_IDS.includes(value);
}

function isE2Action(value: E2Action): boolean {
  return E2_ACTIONS.includes(value);
}

function isIoTVersion(value: IoTVersion): boolean {
  return IOT_VERSIONS.includes(value);
}

function isTleWindowId(value: unknown): value is TleTimeWindow['windowId'] {
  return value === 'course-10m' || value === 'context-30m' || value === 'context-90m';
}

function isTleSourceMode(value: unknown): value is TleSourceMode {
  return value === 'bundled' || value === 'imported' || value === 'fallback';
}

function hasExactMembers<T>(actual: readonly T[], expected: readonly T[]): boolean {
  return actual.length === expected.length
    && new Set(actual).size === expected.length
    && expected.every(value => actual.includes(value));
}

export function createInitialCourseSession(manifest: CourseManifest, resetOrdinal = 0): CourseSessionState {
  return {
    sessionId: `c90-${manifest.providerId}-session-${resetOrdinal}`,
    resetOrdinal,
    activeStage: 'ready',
    readyCheckCompleted: false,
    tleStageIndex: 0,
    tleCompleted: false,
    tleExplanation: '',
    tleSelectedSourceId: manifest.scenario.tleSourceId,
    tleSelectedWindowId: 'course-10m',
    tleTimelineIndex: 0,
    tleSourceMode: 'bundled',
    tleSourceConfirmed: false,
    tleImportedFilename: null,
    tleFallbackUsed: false,
    e1Prediction: '',
    e1CheckpointUpdate: '',
    e1CheckpointCaptured: false,
    e1ArmOrder: [],
    e1ActiveArmId: null,
    e1TimelineIndex: 0,
    e1CompletedArmIds: [],
    e1SelectedArm: null,
    e1Verdict: null,
    e1Explanation: '',
    e2Prediction: '',
    e2TraceId: 'trace-a',
    e2ActiveAction: null,
    e2TimelineIndex: 0,
    e2TraceAAction: null,
    e2TraceAReplayAction: null,
    e2TraceBAction: null,
    e2TraceACompleted: false,
    e2TraceAReplayCompleted: false,
    e2TraceBCompleted: false,
    e2FrozenRule: '',
    e2RuleFrozen: false,
    e2Verdict: null,
    e2Explanation: '',
    iotPrediction: '',
    iotSelectedVersion: 'baseline',
    iotObservedVersions: ['baseline'],
    iotSelectedRule: '',
    iotRevisedRule: '',
    iotVerdict: null,
    iotExplanation: '',
    ideaCard: EMPTY_IDEA_CARD,
  };
}

export interface CourseSessionStorageEnvelope {
  readonly schemaVersion: typeof COURSE_SESSION_STORAGE_VERSION;
  readonly courseId: CourseManifest['courseId'];
  readonly providerId: string;
  readonly contractVersion: CourseManifest['contractVersion'];
  readonly state: CourseSessionState;
}

export function courseSessionStorageKey(manifest: CourseManifest): string {
  return `${COURSE_SESSION_STORAGE_VERSION}:${manifest.courseId}:${manifest.providerId}:${manifest.contractVersion}`;
}

export function serializeCourseSession(manifest: CourseManifest, state: CourseSessionState): string {
  const envelope: CourseSessionStorageEnvelope = {
    schemaVersion: COURSE_SESSION_STORAGE_VERSION,
    courseId: manifest.courseId,
    providerId: manifest.providerId,
    contractVersion: manifest.contractVersion,
    state,
  };
  return JSON.stringify(envelope);
}

export function restoreCourseSession(manifest: CourseManifest, serialized: string | null | undefined): CourseSessionState | null {
  if (!serialized) return null;
  try {
    const parsed: unknown = JSON.parse(serialized);
    if (!isRecord(parsed)
      || parsed.schemaVersion !== COURSE_SESSION_STORAGE_VERSION
      || parsed.courseId !== manifest.courseId
      || parsed.providerId !== manifest.providerId
      || parsed.contractVersion !== manifest.contractVersion
      || !isPersistableSession(parsed.state)) {
      return null;
    }
    const state = parsed.state;
    if (state.sessionId !== `c90-${manifest.providerId}-session-${state.resetOrdinal}`) return null;
    return state;
  } catch {
    return null;
  }
}

export function markReadyCheckComplete(state: CourseSessionState): CourseSessionState {
  if (state.readyCheckCompleted) return state;
  if (state.activeStage !== 'ready') return state;
  return { ...state, readyCheckCompleted: true, activeStage: 'tle' };
}

export function advanceTleStage(state: CourseSessionState, stageCount: number, canComplete: boolean): CourseSessionState {
  if (!state.readyCheckCompleted || state.activeStage !== 'tle' || !Number.isInteger(stageCount) || stageCount <= 0) {
    return state;
  }
  if (state.tleCompleted) return state;
  if (state.tleStageIndex < stageCount - 1) {
    return { ...state, tleStageIndex: state.tleStageIndex + 1 };
  }
  if (!canComplete) return state;
  return {
    ...state,
    tleStageIndex: stageCount - 1,
    tleCompleted: true,
    activeStage: 'e1',
  };
}

export function setTleExplanation(state: CourseSessionState, explanation: string): CourseSessionState {
  return { ...state, tleExplanation: explanation };
}

export function setTleSourceSelection(
  state: CourseSessionState,
  sourceId: string,
  sourceMode: TleSourceMode,
  importedFilename: string | null = null,
): CourseSessionState {
  if (state.activeStage !== 'tle' || state.e1ArmOrder.length > 0 || sourceId.trim() === '' || !isTleSourceMode(sourceMode)) return state;
  if (sourceMode === 'imported' && (importedFilename === null || importedFilename.trim() === '')) return state;
  if (sourceMode !== 'imported' && importedFilename !== null) return state;
  return {
    ...state,
    tleSelectedSourceId: sourceId,
    tleTimelineIndex: 0,
    tleSourceMode: sourceMode,
    tleSourceConfirmed: true,
    tleImportedFilename: importedFilename,
    tleFallbackUsed: sourceMode === 'fallback',
    tleCompleted: false,
  };
}

export function setTleWindowSelection(state: CourseSessionState, windowId: TleTimeWindow['windowId']): CourseSessionState {
  if (state.activeStage !== 'tle' || state.e1ArmOrder.length > 0 || !isTleWindowId(windowId)) return state;
  return { ...state, tleSelectedWindowId: windowId, tleTimelineIndex: 0, tleCompleted: false };
}

export function setTleTimelineIndex(state: CourseSessionState, frameIndex: number, frameCount: number): CourseSessionState {
  if (state.activeStage !== 'tle' || !Number.isInteger(frameIndex) || !Number.isInteger(frameCount) || frameCount <= 0) return state;
  return { ...state, tleTimelineIndex: Math.max(0, Math.min(frameIndex, frameCount - 1)) };
}

export function setE1Prediction(state: CourseSessionState, prediction: string): CourseSessionState {
  return { ...state, e1Prediction: prediction };
}

export function setE1CheckpointUpdate(state: CourseSessionState, checkpointUpdate: string): CourseSessionState {
  return {
    ...state,
    e1CheckpointUpdate: checkpointUpdate,
    e1CheckpointCaptured: state.e1CheckpointCaptured || (state.e1ActiveArmId !== null && state.e1TimelineIndex > 0),
  };
}

export function startE1Arm(state: CourseSessionState, armId: E1ArmId): CourseSessionState {
  if (!isE1ArmId(armId) || state.activeStage === 'complete') return state;
  if (state.e1ActiveArmId !== null && state.e1ActiveArmId !== armId) return state;
  return {
    ...state,
    activeStage: 'e1',
    e1ActiveArmId: armId,
    e1TimelineIndex: 0,
    e1ArmOrder: state.e1ArmOrder.includes(armId) ? state.e1ArmOrder : [...state.e1ArmOrder, armId],
  };
}

export function advanceE1Frame(state: CourseSessionState, frameCount: number): CourseSessionState {
  if (state.activeStage !== 'e1' || state.e1ActiveArmId === null || !Number.isInteger(frameCount) || frameCount <= 0) {
    return state;
  }
  return { ...state, e1TimelineIndex: Math.min(state.e1TimelineIndex + 1, frameCount - 1) };
}

export function finishE1Arm(state: CourseSessionState, armId: E1ArmId): CourseSessionState {
  if (
    state.activeStage !== 'e1'
    || state.e1ActiveArmId !== armId
    || !isE1ArmId(armId)
    || state.e1TimelineIndex < 1
    || !state.e1CheckpointCaptured
    || !isNonBlank(state.e1CheckpointUpdate)
  ) {
    return state;
  }
  return {
    ...state,
    e1ActiveArmId: null,
    e1TimelineIndex: 0,
    e1CompletedArmIds: state.e1CompletedArmIds.includes(armId)
      ? state.e1CompletedArmIds
      : [...state.e1CompletedArmIds, armId],
  };
}

export function setE1Decision(
  state: CourseSessionState,
  selectedArm: E1ArmId | null,
  verdict: CourseSessionState['e1Verdict'],
  explanation: string,
): CourseSessionState {
  if (selectedArm !== null && (!isE1ArmId(selectedArm) || !state.e1CompletedArmIds.includes(selectedArm))) {
    return state;
  }
  if (verdict !== null && !isVerdict(verdict)) return state;
  return { ...state, e1SelectedArm: selectedArm, e1Verdict: verdict, e1Explanation: explanation };
}

export function startE2(state: CourseSessionState): CourseSessionState {
  if (
    state.activeStage !== 'e1'
    || !hasExactMembers(state.e1CompletedArmIds, E1_ARM_IDS)
    || !isNonBlank(state.e1Prediction)
    || !isNonBlank(state.e1CheckpointUpdate)
    || state.e1SelectedArm === null
    || state.e1Verdict === null
    || !isNonBlank(state.e1Explanation)
  ) {
    return state;
  }
  return { ...state, activeStage: 'e2', e2ActiveAction: null, e2TimelineIndex: 0 };
}

export function selectE2Action(state: CourseSessionState, action: E2Action): CourseSessionState {
  if (state.activeStage !== 'e2' || !isE2Action(action)) return state;
  if (state.e2TraceId === 'trace-b' && (!state.e2TraceAReplayCompleted || !state.e2RuleFrozen)) return state;
  return { ...state, e2ActiveAction: action, e2TimelineIndex: 0 };
}

export function advanceE2Frame(state: CourseSessionState, frameCount: number): CourseSessionState {
  if (state.activeStage !== 'e2' || state.e2ActiveAction === null || !Number.isInteger(frameCount) || frameCount <= 0) {
    return state;
  }
  return { ...state, e2TimelineIndex: Math.min(state.e2TimelineIndex + 1, frameCount - 1) };
}

export function setE2TraceAction(state: CourseSessionState, action: E2Action): CourseSessionState {
  if (state.activeStage !== 'e2' || state.e2ActiveAction !== action || !isE2Action(action) || state.e2TimelineIndex < 1) {
    return state;
  }
  if (state.e2TraceId === 'trace-a') {
    if (state.e2TraceAAction === null) {
      return { ...state, e2TraceAAction: action, e2TraceACompleted: true };
    }
    if (state.e2TraceAReplayAction === null && state.e2TraceAAction !== action) {
      return { ...state, e2TraceAReplayAction: action, e2TraceAReplayCompleted: true };
    }
    return state;
  }
  if (!state.e2TraceAReplayCompleted || !state.e2RuleFrozen || state.e2TraceBCompleted) return state;
  return { ...state, e2TraceBAction: action, e2TraceBCompleted: true };
}

export function setE2Trace(state: CourseSessionState, traceId: 'trace-a' | 'trace-b'): CourseSessionState {
  if (traceId === 'trace-b' && (!state.e2TraceAReplayCompleted || !state.e2RuleFrozen)) return state;
  return { ...state, e2TraceId: traceId, e2ActiveAction: null, e2TimelineIndex: 0 };
}

export function setE2Decision(
  state: CourseSessionState,
  frozenRule: string,
  verdict: CourseSessionState['e2Verdict'],
  explanation: string,
): CourseSessionState {
  if (verdict !== null && !isVerdict(verdict)) return state;
  return {
    ...state,
    e2FrozenRule: state.e2RuleFrozen ? state.e2FrozenRule : frozenRule,
    e2Verdict: verdict,
    e2Explanation: explanation,
  };
}

export function freezeE2Rule(state: CourseSessionState): CourseSessionState {
  if (state.activeStage !== 'e2' || !isNonBlank(state.e2FrozenRule) || state.e2RuleFrozen) return state;
  return { ...state, e2RuleFrozen: true };
}

export function startIoT(state: CourseSessionState): CourseSessionState {
  if (
    state.activeStage !== 'e2'
    || !isNonBlank(state.e2Prediction)
    || !state.e2TraceACompleted
    || !state.e2TraceAReplayCompleted
    || !state.e2TraceBCompleted
    || !state.e2RuleFrozen
    || !isNonBlank(state.e2FrozenRule)
    || state.e2Verdict === null
    || !isNonBlank(state.e2Explanation)
  ) {
    return state;
  }
  return { ...state, activeStage: 'iot' };
}

export function setIoTVersion(state: CourseSessionState, version: IoTVersion): CourseSessionState {
  if (state.activeStage !== 'iot' || !isIoTVersion(version)) return state;
  if (version === 'learner' && !state.iotObservedVersions.includes('baseline')) return state;
  if (version === 'revision' && !state.iotObservedVersions.includes('learner')) return state;
  return {
    ...state,
    iotSelectedVersion: version,
    iotObservedVersions: state.iotObservedVersions.includes(version)
      ? state.iotObservedVersions
      : [...state.iotObservedVersions, version],
  };
}

export function setIoTRecord(
  state: CourseSessionState,
  prediction: string,
  selectedRule: string,
  revisedRule: string,
  verdict: CourseSessionState['iotVerdict'],
  explanation: string,
): CourseSessionState {
  if (verdict !== null && !isVerdict(verdict)) return state;
  return { ...state, iotPrediction: prediction, iotSelectedRule: selectedRule, iotRevisedRule: revisedRule, iotVerdict: verdict, iotExplanation: explanation };
}

export function startCompetition(state: CourseSessionState): CourseSessionState {
  if (
    state.activeStage !== 'iot'
    || !hasExactMembers(state.iotObservedVersions, IOT_VERSIONS)
    || state.iotSelectedVersion === 'baseline'
    || !isNonBlank(state.iotPrediction)
    || !isNonBlank(state.iotSelectedRule)
    || !isNonBlank(state.iotRevisedRule)
    || state.iotVerdict === null
    || !isNonBlank(state.iotExplanation)
  ) {
    return state;
  }
  return { ...state, activeStage: 'competition' };
}

export function setIdeaCardField(
  state: CourseSessionState,
  field: keyof IdeaCard,
  value: string,
): CourseSessionState {
  if (!Object.prototype.hasOwnProperty.call(EMPTY_IDEA_CARD, field)) return state;
  return { ...state, ideaCard: { ...state.ideaCard, [field]: value } };
}

export function completeCourse(state: CourseSessionState): CourseSessionState {
  if (state.activeStage !== 'competition' || Object.values(state.ideaCard).some(value => !isNonBlank(value))) return state;
  return { ...state, activeStage: 'complete' };
}

export function buildLearningBundleInput(state: CourseSessionState, provider: CourseDataProvider): LearningBundleInput {
  const readiness = courseSessionExportReadiness(state, provider);
  if (!readiness.ready) {
    throw new Error(`learning bundle export blocked: ${readiness.reasons.join('; ')}`);
  }
  return {
    exportedAt: new Date().toISOString(),
    sessionId: state.sessionId,
    readyCheckCompleted: state.readyCheckCompleted,
    tle: {
      explanation: state.tleExplanation,
      selectedSourceId: state.tleSelectedSourceId,
      selectedWindowId: state.tleSelectedWindowId,
      selectedFrameIndex: state.tleTimelineIndex,
      sourceMode: state.tleSourceMode,
      sourceConfirmed: state.tleSourceConfirmed,
      importedFilename: state.tleImportedFilename,
      fallbackUsed: state.tleFallbackUsed,
    },
    e1: {
      prediction: state.e1Prediction,
      checkpointUpdate: state.e1CheckpointUpdate,
      armOrder: state.e1ArmOrder,
      completedArmIds: state.e1CompletedArmIds,
      selectedArm: state.e1SelectedArm,
      verdict: state.e1Verdict,
      explanation: state.e1Explanation,
    },
    e2: {
      prediction: state.e2Prediction,
      traceAAction: state.e2TraceAAction,
      traceAReplayAction: state.e2TraceAReplayAction,
      traceBAction: state.e2TraceBAction,
      frozenRule: state.e2FrozenRule,
      verdict: state.e2Verdict,
      explanation: state.e2Explanation,
    },
    iot: {
      prediction: state.iotPrediction,
      selectedRule: state.iotSelectedRule,
      revisedRule: state.iotRevisedRule,
      verdict: state.iotVerdict,
      explanation: state.iotExplanation,
    },
    ideaCard: state.ideaCard,
  };
}

export interface CourseSessionReadiness {
  readonly ready: boolean;
  readonly reasons: readonly string[];
}

interface SessionReadinessRequirements {
  readonly e1ArmIds: readonly E1ArmId[];
  readonly tleStageCount?: number;
  readonly traceAActions: readonly E2Action[];
  readonly traceBActions: readonly E2Action[];
  readonly iotVersions: readonly IoTVersion[];
}

function collectReadinessReasons(state: CourseSessionState, requirements: SessionReadinessRequirements): string[] {
  const reasons: string[] = [];
  if (!state.readyCheckCompleted) reasons.push('ready check 尚未完成');
  if (!state.tleCompleted || (requirements.tleStageCount !== undefined && (
    requirements.tleStageCount <= 0 || state.tleStageIndex !== requirements.tleStageCount - 1
  ))) {
    reasons.push('TLE staged journey 尚未完成');
  }
  if (!state.tleSourceConfirmed || !isNonBlank(state.tleSelectedSourceId)) reasons.push('TLE 尚未由學生選擇、匯入或明示使用 fallback');
  if (!isTleWindowId(state.tleSelectedWindowId) || state.tleTimelineIndex < 0) reasons.push('TLE time-window / frame selection 無效');
  if (state.tleSourceMode === 'imported' && !isNonBlank(state.tleImportedFilename ?? '')) reasons.push('TLE import 缺少檔名 provenance');
  if (state.tleFallbackUsed !== (state.tleSourceMode === 'fallback')) reasons.push('TLE fallback provenance 不一致');
  if (!isNonBlank(state.tleExplanation)) reasons.push('TLE 尚未留下 source → derived → course explanation');
  if (!isNonBlank(state.e1Prediction)) reasons.push('E1 尚未留下執行前 prediction');
  if (!isNonBlank(state.e1CheckpointUpdate) || !state.e1CheckpointCaptured) reasons.push('E1 尚未留下 mid-run observation update');
  if (!hasExactMembers(state.e1CompletedArmIds, requirements.e1ArmIds) || !hasExactMembers(state.e1ArmOrder, requirements.e1ArmIds)) reasons.push('E1 尚未跑完三臂');
  if (state.e1ActiveArmId !== null) reasons.push('E1 尚有 arm 尚未結束');
  if (state.e1SelectedArm === null || !state.e1CompletedArmIds.includes(state.e1SelectedArm) || !isVerdict(state.e1Verdict) || !isNonBlank(state.e1Explanation)) {
    reasons.push('E1 尚未留下 verdict 與解釋');
  }
  const traceAIsValid = state.e2TraceAAction !== null
    && state.e2TraceAReplayAction !== null
    && state.e2TraceAAction !== state.e2TraceAReplayAction
    && requirements.traceAActions.includes(state.e2TraceAAction)
    && requirements.traceAActions.includes(state.e2TraceAReplayAction);
  const traceBIsValid = state.e2TraceBAction !== null && requirements.traceBActions.includes(state.e2TraceBAction);
  if (!isNonBlank(state.e2Prediction)) reasons.push('E2 尚未留下 overlap event prediction');
  if (!state.e2TraceACompleted || !state.e2TraceAReplayCompleted || !state.e2TraceBCompleted || !traceAIsValid || !traceBIsValid) {
    reasons.push('E2 Trace A/B 尚未完成 replay 與 withheld run');
  }
  if (!state.e2RuleFrozen || !isNonBlank(state.e2FrozenRule) || !isVerdict(state.e2Verdict) || !isNonBlank(state.e2Explanation)) {
    reasons.push('E2 尚未凍結白話規則並完成解釋');
  }
  if (!hasExactMembers(state.iotObservedVersions, requirements.iotVersions)) reasons.push('IoT 尚未依序觀察 baseline、learner、revision');
  if (!isIoTVersion(state.iotSelectedVersion) || state.iotSelectedVersion === 'baseline' || !isNonBlank(state.iotPrediction) || !isNonBlank(state.iotSelectedRule) || !isNonBlank(state.iotRevisedRule) || !isVerdict(state.iotVerdict) || !isNonBlank(state.iotExplanation)) {
    reasons.push('IoT 尚未完成 prediction、rule、revision 與解釋');
  }
  if (Object.values(state.ideaCard).some(value => !isNonBlank(value))) reasons.push('競賽 idea card 尚有空欄');
  return reasons;
}

export function courseSessionExportReadiness(state: CourseSessionState, provider?: CourseDataProvider): CourseSessionReadiness {
  const reasons = collectReadinessReasons(state, {
    e1ArmIds: E1_ARM_IDS,
    traceAActions: E2_ACTIONS,
    traceBActions: E2_ACTIONS,
    iotVersions: IOT_VERSIONS,
  });
  if (provider !== undefined) {
    try {
      const journey = provider.getTleJourney();
      const source = journey.sources.find(candidate => candidate.sourceId === state.tleSelectedSourceId);
      const window = journey.windows.find(candidate => candidate.windowId === state.tleSelectedWindowId);
      const bundle = journey.trajectoryBundles.find(candidate => candidate.sourceId === state.tleSelectedSourceId && candidate.windowId === state.tleSelectedWindowId);
      if (source === undefined || window === undefined || bundle?.frames[state.tleTimelineIndex] === undefined) reasons.push('TLE selected source/window/frame 不存在於 provider');
      if (state.tleSelectedSourceId !== journey.courseSourceId || source?.role !== 'course-compatible') reasons.push('TLE 尚未切回與 E1 scenario 相容的 course source');
    } catch (error) {
      reasons.push(`TLE provider selection unavailable: ${String(error)}`);
    }
  }
  return { ready: reasons.length === 0, reasons };
}

export function courseSessionReadiness(state: CourseSessionState, provider: CourseDataProvider): CourseSessionReadiness {
  const reasons: string[] = [];
  try {
    const tleStageCount = provider.getTleJourney().stages.length;
    const journey = provider.getTleJourney();
    const e1ArmIds = provider.getE1Experiment().arms.map(arm => arm.id);
    const e2 = provider.getE2Experiment();
    const iotVersions = provider.getIoTChallenge().runs.map(run => run.version);
    if (!hasExactMembers(e1ArmIds, E1_ARM_IDS) || e1ArmIds.length !== 3) reasons.push('provider E1 arms 不符合 C-90 三臂 contract');
    if (!hasExactMembers(iotVersions, IOT_VERSIONS)) reasons.push('provider IoT runs 未提供 baseline、learner、revision');
    const selectedSource = journey.sources.find(source => source.sourceId === state.tleSelectedSourceId);
    const selectedWindow = journey.windows.find(window => window.windowId === state.tleSelectedWindowId);
    const selectedBundle = journey.trajectoryBundles.find(bundle => bundle.sourceId === state.tleSelectedSourceId && bundle.windowId === state.tleSelectedWindowId);
    if (selectedSource === undefined || selectedWindow === undefined || selectedBundle?.frames[state.tleTimelineIndex] === undefined) reasons.push('provider 找不到 learner 選定的 TLE source/window/frame');
    if (state.tleSelectedSourceId !== journey.courseSourceId || selectedSource?.role !== 'course-compatible') reasons.push('learner 選定的 TLE 尚未與 E1 scenario identity 對齊');
    const traceAActions = e2.traceA.branches.map(branch => branch.action);
    const traceBActions = e2.traceB.branches.map(branch => branch.action);
    if (!hasExactMembers(traceAActions, E2_ACTIONS) || !hasExactMembers(traceBActions, E2_ACTIONS)) reasons.push('provider E2 branches 不符合三種 action contract');
    reasons.push(...collectReadinessReasons(state, { e1ArmIds, tleStageCount, traceAActions, traceBActions, iotVersions }));
  } catch (error) {
    reasons.push(`provider data unavailable: ${String(error)}`);
    reasons.push(...courseSessionExportReadiness(state).reasons);
  }
  return { ready: reasons.length === 0, reasons };
}
