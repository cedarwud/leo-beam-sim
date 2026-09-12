import {
  buildHandoverTeachingScript,
  resolveTeachingFrame,
  teachingScriptTotalSec,
  type TeachingFrame,
  type TeachingHandoverKind,
  type TeachingIdentityBinding,
  type TeachingPhaseId,
  type TeachingScript,
} from './handoverTeachingScript';

export const INSTRUCTOR_HANDOVER_SCENARIO_SCHEMA_VERSION = 1 as const;
export const INSTRUCTOR_HANDOVER_SCENARIO_ID = 'homepage-seven-beam-intra-inter-v1';
export const INSTRUCTOR_HANDOVER_SCENARIO_VERSION = 1 as const;
export const INSTRUCTOR_HANDOVER_BEAM_COUNT = 7 as const;
export const INSTRUCTOR_HANDOVER_ALLOWED_CONTROLS = Object.freeze([
  'play-pause',
  'restart',
  'seek',
  'speed',
  'close',
] as const);
export const INSTRUCTOR_HANDOVER_REQUIRED_SURFACES = Object.freeze([
  'scene',
  'rail',
  'caption',
] as const);
export const INSTRUCTOR_HANDOVER_SEGMENT_ORDER = Object.freeze([
  'intra',
  'inter',
] as const satisfies readonly TeachingHandoverKind[]);

export interface InstructorHandoverScenarioSegment {
  readonly index: number;
  readonly kind: TeachingHandoverKind;
  readonly startSec: number;
  readonly durationSec: number;
  readonly endSec: number;
  readonly script: TeachingScript;
}

export interface InstructorHandoverScenario {
  readonly schemaVersion: typeof INSTRUCTOR_HANDOVER_SCENARIO_SCHEMA_VERSION;
  readonly scenarioId: typeof INSTRUCTOR_HANDOVER_SCENARIO_ID;
  readonly version: typeof INSTRUCTOR_HANDOVER_SCENARIO_VERSION;
  readonly beamCount: typeof INSTRUCTOR_HANDOVER_BEAM_COUNT;
  readonly allowedControls: typeof INSTRUCTOR_HANDOVER_ALLOWED_CONTROLS;
  readonly requiredSurfaces: typeof INSTRUCTOR_HANDOVER_REQUIRED_SURFACES;
  readonly segments: readonly InstructorHandoverScenarioSegment[];
  readonly totalSec: number;
}

function buildScenario(): InstructorHandoverScenario {
  let startSec = 0;
  const segments = INSTRUCTOR_HANDOVER_SEGMENT_ORDER.map((kind, index) => {
    const script = buildHandoverTeachingScript(kind);
    const durationSec = teachingScriptTotalSec(script);
    const segment = Object.freeze({
      index,
      kind,
      startSec,
      durationSec,
      endSec: startSec + durationSec,
      script,
    });
    startSec = segment.endSec;
    return segment;
  });
  return Object.freeze({
    schemaVersion: INSTRUCTOR_HANDOVER_SCENARIO_SCHEMA_VERSION,
    scenarioId: INSTRUCTOR_HANDOVER_SCENARIO_ID,
    version: INSTRUCTOR_HANDOVER_SCENARIO_VERSION,
    beamCount: INSTRUCTOR_HANDOVER_BEAM_COUNT,
    allowedControls: INSTRUCTOR_HANDOVER_ALLOWED_CONTROLS,
    requiredSurfaces: INSTRUCTOR_HANDOVER_REQUIRED_SURFACES,
    segments: Object.freeze(segments),
    totalSec: startSec,
  });
}

export const INSTRUCTOR_HANDOVER_SCENARIO = buildScenario();

export function isInstructorHandoverBeamTopologyAdmitted(
  servingBeamCount: number | null | undefined,
  candidateBeamCount: number | null | undefined,
): boolean {
  return servingBeamCount === INSTRUCTOR_HANDOVER_BEAM_COUNT
    && (candidateBeamCount ?? servingBeamCount) === INSTRUCTOR_HANDOVER_BEAM_COUNT;
}

export function clampInstructorHandoverSourceTime(sourceTimeSec: number): number {
  if (!Number.isFinite(sourceTimeSec)) return 0;
  return Math.max(0, Math.min(INSTRUCTOR_HANDOVER_SCENARIO.totalSec, sourceTimeSec));
}

export function instructorHandoverEntryStartSec(kind: TeachingHandoverKind): number {
  return INSTRUCTOR_HANDOVER_SCENARIO.segments.find(segment => segment.kind === kind)?.startSec ?? 0;
}

export interface InstructorHandoverScenarioPosition {
  readonly sourceTimeSec: number;
  readonly segment: InstructorHandoverScenarioSegment;
  readonly segmentTimeSec: number;
  readonly complete: boolean;
}

export function resolveInstructorHandoverScenarioPosition(
  sourceTimeSec: number,
): InstructorHandoverScenarioPosition {
  const clamped = clampInstructorHandoverSourceTime(sourceTimeSec);
  const segments = INSTRUCTOR_HANDOVER_SCENARIO.segments;
  const segment = segments.find((candidate, index) => (
    clamped < candidate.endSec || index === segments.length - 1
  )) ?? segments[segments.length - 1]!;
  return Object.freeze({
    sourceTimeSec: clamped,
    segment,
    segmentTimeSec: Math.max(0, Math.min(segment.durationSec, clamped - segment.startSec)),
    complete: clamped >= INSTRUCTOR_HANDOVER_SCENARIO.totalSec,
  });
}

export interface InstructorHandoverScenarioFrame extends InstructorHandoverScenarioPosition {
  readonly frame: TeachingFrame;
}

export function resolveInstructorHandoverScenarioFrame(
  sourceTimeSec: number,
  binding: TeachingIdentityBinding | null = null,
): InstructorHandoverScenarioFrame {
  const position = resolveInstructorHandoverScenarioPosition(sourceTimeSec);
  return Object.freeze({
    ...position,
    frame: resolveTeachingFrame(
      position.segment.script,
      position.segmentTimeSec,
      binding,
    ),
  });
}

export interface InstructorHandoverPhaseMarker {
  readonly sourceTimeSec: number;
  readonly segmentIndex: number;
  readonly kind: TeachingHandoverKind;
  readonly phase: TeachingPhaseId;
}

export const INSTRUCTOR_HANDOVER_PHASE_MARKERS: readonly InstructorHandoverPhaseMarker[] = Object.freeze(
  INSTRUCTOR_HANDOVER_SCENARIO.segments.flatMap(segment => {
    let localSec = 0;
    return segment.script.phases.map(phase => {
      const marker = Object.freeze({
        sourceTimeSec: segment.startSec + localSec,
        segmentIndex: segment.index,
        kind: segment.kind,
        phase: phase.id,
      });
      localSec += phase.durationSec;
      return marker;
    });
  }),
);
