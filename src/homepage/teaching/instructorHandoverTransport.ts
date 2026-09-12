import type { TeachingHandoverKind } from './handoverTeachingScript';
import {
  INSTRUCTOR_HANDOVER_BEAM_COUNT,
  INSTRUCTOR_HANDOVER_SCENARIO,
  INSTRUCTOR_HANDOVER_SCENARIO_ID,
  INSTRUCTOR_HANDOVER_SCENARIO_VERSION,
  instructorHandoverEntryStartSec,
  resolveInstructorHandoverScenarioPosition,
  type InstructorHandoverScenarioPosition,
} from './instructorHandoverScenario';

export const INSTRUCTOR_HANDOVER_SPEEDS = Object.freeze([1, 2, 5, 10, 20] as const);
export type InstructorHandoverSpeed = (typeof INSTRUCTOR_HANDOVER_SPEEDS)[number];
export type InstructorHandoverTransportStatus = 'closed' | 'playing' | 'paused' | 'complete';

export interface InstructorHandoverTransportState {
  readonly scenarioId: typeof INSTRUCTOR_HANDOVER_SCENARIO_ID;
  readonly scenarioVersion: typeof INSTRUCTOR_HANDOVER_SCENARIO_VERSION;
  readonly runId: number;
  readonly entryKind: TeachingHandoverKind | null;
  readonly sourceTimeSec: number;
  readonly speed: InstructorHandoverSpeed;
  readonly status: InstructorHandoverTransportStatus;
}

function freezeState(
  state: Omit<InstructorHandoverTransportState, 'scenarioId' | 'scenarioVersion'>,
): InstructorHandoverTransportState {
  return Object.freeze({
    scenarioId: INSTRUCTOR_HANDOVER_SCENARIO_ID,
    scenarioVersion: INSTRUCTOR_HANDOVER_SCENARIO_VERSION,
    ...state,
  });
}

export function createInstructorHandoverTransportState(): InstructorHandoverTransportState {
  return freezeState({
    runId: 0,
    entryKind: null,
    sourceTimeSec: 0,
    speed: 1,
    status: 'closed',
  });
}

export function openInstructorHandoverTransport(
  state: InstructorHandoverTransportState,
  entryKind: TeachingHandoverKind,
): InstructorHandoverTransportState {
  return freezeState({
    runId: state.runId + 1,
    entryKind,
    sourceTimeSec: instructorHandoverEntryStartSec(entryKind),
    speed: state.speed,
    status: 'playing',
  });
}

export function closeInstructorHandoverTransport(
  state: InstructorHandoverTransportState,
): InstructorHandoverTransportState {
  return freezeState({
    runId: state.runId,
    entryKind: null,
    sourceTimeSec: 0,
    speed: state.speed,
    status: 'closed',
  });
}

export function restartInstructorHandoverTransport(
  state: InstructorHandoverTransportState,
): InstructorHandoverTransportState {
  if (state.entryKind === null) return state;
  return freezeState({
    runId: state.runId + 1,
    entryKind: state.entryKind,
    sourceTimeSec: instructorHandoverEntryStartSec(state.entryKind),
    speed: state.speed,
    status: 'playing',
  });
}

export function setInstructorHandoverPaused(
  state: InstructorHandoverTransportState,
  paused: boolean,
): InstructorHandoverTransportState {
  if (state.entryKind === null) return state;
  if (state.status === 'complete') {
    return paused ? state : restartInstructorHandoverTransport(state);
  }
  const status: InstructorHandoverTransportStatus = paused ? 'paused' : 'playing';
  return state.status === status ? state : freezeState({ ...state, status });
}

export function setInstructorHandoverSpeed(
  state: InstructorHandoverTransportState,
  speed: InstructorHandoverSpeed,
): InstructorHandoverTransportState {
  if (!INSTRUCTOR_HANDOVER_SPEEDS.includes(speed)) return state;
  return state.speed === speed ? state : freezeState({ ...state, speed });
}

export function seekInstructorHandoverTransport(
  state: InstructorHandoverTransportState,
  sourceTimeSec: number,
): InstructorHandoverTransportState {
  if (state.entryKind === null) return state;
  const windowStartSec = instructorHandoverEntryStartSec(state.entryKind);
  const clamped = Number.isFinite(sourceTimeSec)
    ? Math.max(windowStartSec, Math.min(INSTRUCTOR_HANDOVER_SCENARIO.totalSec, sourceTimeSec))
    : windowStartSec;
  const status: InstructorHandoverTransportStatus = clamped >= INSTRUCTOR_HANDOVER_SCENARIO.totalSec
    ? 'complete'
    : state.status === 'playing' ? 'playing' : 'paused';
  return freezeState({ ...state, sourceTimeSec: clamped, status });
}

export function advanceInstructorHandoverTransport(
  state: InstructorHandoverTransportState,
  wallDeltaSec: number,
): InstructorHandoverTransportState {
  if (state.status !== 'playing' || !Number.isFinite(wallDeltaSec) || wallDeltaSec <= 0) return state;
  const sourceTimeSec = Math.min(
    INSTRUCTOR_HANDOVER_SCENARIO.totalSec,
    state.sourceTimeSec + wallDeltaSec * state.speed,
  );
  return freezeState({
    ...state,
    sourceTimeSec,
    status: sourceTimeSec >= INSTRUCTOR_HANDOVER_SCENARIO.totalSec ? 'complete' : 'playing',
  });
}

export interface InstructorHandoverTransportSnapshot extends InstructorHandoverScenarioPosition {
  readonly scenarioId: typeof INSTRUCTOR_HANDOVER_SCENARIO_ID;
  readonly scenarioVersion: typeof INSTRUCTOR_HANDOVER_SCENARIO_VERSION;
  readonly beamCount: typeof INSTRUCTOR_HANDOVER_BEAM_COUNT;
  readonly runId: number;
  readonly entryKind: TeachingHandoverKind;
  readonly speed: InstructorHandoverSpeed;
  readonly status: Exclude<InstructorHandoverTransportStatus, 'closed'>;
  readonly paused: boolean;
  readonly windowStartSec: number;
  readonly windowEndSec: number;
  readonly windowDurationSec: number;
}

export function resolveInstructorHandoverTransportSnapshot(
  state: InstructorHandoverTransportState,
): InstructorHandoverTransportSnapshot | null {
  if (state.entryKind === null || state.status === 'closed') return null;
  const position = resolveInstructorHandoverScenarioPosition(state.sourceTimeSec);
  const windowStartSec = instructorHandoverEntryStartSec(state.entryKind);
  const windowEndSec = INSTRUCTOR_HANDOVER_SCENARIO.totalSec;
  return Object.freeze({
    ...position,
    scenarioId: state.scenarioId,
    scenarioVersion: state.scenarioVersion,
    beamCount: INSTRUCTOR_HANDOVER_BEAM_COUNT,
    runId: state.runId,
    entryKind: state.entryKind,
    speed: state.speed,
    status: state.status,
    paused: state.status !== 'playing',
    windowStartSec,
    windowEndSec,
    windowDurationSec: windowEndSec - windowStartSec,
  });
}
