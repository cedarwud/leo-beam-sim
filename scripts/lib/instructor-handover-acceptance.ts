export type R5InstructorSurface = 'root' | 'scene' | 'rail' | 'caption';

export interface R5InstructorTelemetry {
  readonly surface: string;
  readonly binding: string;
  readonly scenarioId: string;
  readonly scenarioVersion: string;
  readonly beamCount: string;
  readonly runId: string;
  readonly entryKind: string;
  readonly segmentIndex: string;
  readonly segmentKind: string;
  readonly status: string;
  readonly paused: string;
  readonly speed: string;
  readonly sourceTimeSec: string;
  readonly segmentTimeSec: string;
  readonly durationSec: string;
  readonly windowStartSec: string;
  readonly windowEndSec: string;
  readonly complete: string;
  readonly storyId: string;
  readonly pairKey: string;
  readonly phase: string;
  readonly committed: string;
}

export interface R5InstructorRootTelemetry extends R5InstructorTelemetry {
  readonly runtimeBeamCount: string;
  readonly runtimeCandidateBeamCount: string;
  readonly sevenBeamAdmitted: string;
}

export const R5_SCENARIO_ID = 'homepage-seven-beam-intra-inter-v1';
export const R5_SCENARIO_VERSION = '1';
export const R5_BEAM_COUNT = '7';

export const R5_COMPARABLE_FIELDS = Object.freeze([
  'binding',
  'scenarioId',
  'scenarioVersion',
  'beamCount',
  'runId',
  'entryKind',
  'segmentIndex',
  'segmentKind',
  'status',
  'paused',
  'speed',
  'sourceTimeSec',
  'segmentTimeSec',
  'durationSec',
  'windowStartSec',
  'windowEndSec',
  'complete',
  'storyId',
  'pairKey',
  'phase',
  'committed',
] as const satisfies readonly (keyof R5InstructorTelemetry)[]);

const R5_NUMERIC_FIELDS = new Set<keyof R5InstructorTelemetry>([
  'sourceTimeSec',
  'segmentTimeSec',
  'durationSec',
  'windowStartSec',
  'windowEndSec',
]);
const EPSILON_SEC = 0.001;

function finite(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sameField(
  field: keyof R5InstructorTelemetry,
  left: string,
  right: string,
): boolean {
  if (!R5_NUMERIC_FIELDS.has(field)) return left === right;
  const leftValue = finite(left);
  const rightValue = finite(right);
  return leftValue !== null
    && rightValue !== null
    && Math.abs(leftValue - rightValue) <= EPSILON_SEC;
}

interface ExpectedPosition {
  readonly segmentIndex: string;
  readonly segmentKind: 'intra' | 'inter';
  readonly segmentTimeSec: number;
  readonly phase: 'serving' | 'measuring' | 'holding' | 'switching' | 'settled';
  readonly committed: boolean;
}

function expectedPosition(sourceTimeSec: number): ExpectedPosition | null {
  if (!Number.isFinite(sourceTimeSec) || sourceTimeSec < 0 || sourceTimeSec > 144) return null;
  const inter = sourceTimeSec >= 72;
  const local = inter ? sourceTimeSec - 72 : sourceTimeSec;
  const phase = local < 12
    ? 'serving'
    : local < 28
      ? 'measuring'
      : local < 46
        ? 'holding'
        : local < 58
          ? 'switching'
          : 'settled';
  const committed = phase === 'settled' || (phase === 'switching' && local >= 52);
  return {
    segmentIndex: inter ? '1' : '0',
    segmentKind: inter ? 'inter' : 'intra',
    segmentTimeSec: local,
    phase,
    committed,
  };
}

function validateEnvelope(
  telemetry: R5InstructorTelemetry,
  expectedSurface: R5InstructorSurface,
  errors: string[],
): void {
  if (telemetry.surface !== expectedSurface) {
    errors.push(`${expectedSurface}.surface=${telemetry.surface}`);
  }
  if (telemetry.binding !== 'active') errors.push(`${expectedSurface}.binding=${telemetry.binding}`);
  if (telemetry.scenarioId !== R5_SCENARIO_ID) {
    errors.push(`${expectedSurface}.scenarioId=${telemetry.scenarioId}`);
  }
  if (telemetry.scenarioVersion !== R5_SCENARIO_VERSION) {
    errors.push(`${expectedSurface}.scenarioVersion=${telemetry.scenarioVersion}`);
  }
  if (telemetry.beamCount !== R5_BEAM_COUNT) {
    errors.push(`${expectedSurface}.beamCount=${telemetry.beamCount}`);
  }
  if (telemetry.storyId.length === 0) errors.push(`${expectedSurface}.storyId is empty`);
  if (telemetry.pairKey.length === 0) errors.push(`${expectedSurface}.pairKey is empty`);
}

function validateShared(
  root: R5InstructorTelemetry,
  surface: R5InstructorTelemetry,
  label: string,
  errors: string[],
): void {
  for (const field of R5_COMPARABLE_FIELDS) {
    if (!sameField(field, root[field], surface[field])) {
      errors.push(`${label}.${field}=${surface[field]} != root.${field}=${root[field]}`);
    }
  }
}

function validatePosition(telemetry: R5InstructorTelemetry, errors: string[]): void {
  const sourceTimeSec = finite(telemetry.sourceTimeSec);
  const segmentTimeSec = finite(telemetry.segmentTimeSec);
  const durationSec = finite(telemetry.durationSec);
  const windowStartSec = finite(telemetry.windowStartSec);
  const windowEndSec = finite(telemetry.windowEndSec);
  if (sourceTimeSec === null || segmentTimeSec === null) {
    errors.push('source or segment time is not finite');
    return;
  }
  const expected = expectedPosition(sourceTimeSec);
  if (expected === null) {
    errors.push(`sourceTimeSec=${telemetry.sourceTimeSec} is outside the scenario`);
    return;
  }
  if (telemetry.segmentIndex !== expected.segmentIndex) {
    errors.push(`segmentIndex=${telemetry.segmentIndex}`);
  }
  if (telemetry.segmentKind !== expected.segmentKind) {
    errors.push(`segmentKind=${telemetry.segmentKind}`);
  }
  if (Math.abs(segmentTimeSec - expected.segmentTimeSec) > EPSILON_SEC) {
    errors.push(`segmentTimeSec=${telemetry.segmentTimeSec}`);
  }
  if (telemetry.phase !== expected.phase) errors.push(`phase=${telemetry.phase}`);
  if (telemetry.committed !== String(expected.committed)) {
    errors.push(`committed=${telemetry.committed}`);
  }
  const expectedWindowStartSec = telemetry.entryKind === 'inter' ? 72 : 0;
  const expectedDurationSec = 144 - expectedWindowStartSec;
  if (durationSec !== expectedDurationSec) {
    errors.push(`durationSec=${telemetry.durationSec}`);
  }
  if (windowEndSec !== 144) errors.push(`windowEndSec=${telemetry.windowEndSec}`);
  if (windowStartSec !== expectedWindowStartSec) {
    errors.push(`windowStartSec=${telemetry.windowStartSec}`);
  }
  const expectedComplete = sourceTimeSec >= 144;
  if (telemetry.complete !== String(expectedComplete)) {
    errors.push(`complete=${telemetry.complete}`);
  }
  if ((telemetry.status === 'complete') !== expectedComplete) {
    errors.push(`status=${telemetry.status} at sourceTimeSec=${telemetry.sourceTimeSec}`);
  }
  if (telemetry.paused !== String(telemetry.status !== 'playing')) {
    errors.push(`paused=${telemetry.paused} for status=${telemetry.status}`);
  }
}

export function validateR5InstructorSurfaceSet(
  root: R5InstructorRootTelemetry,
  scene: R5InstructorTelemetry,
  rail: R5InstructorTelemetry,
  caption: R5InstructorTelemetry,
): readonly string[] {
  const errors: string[] = [];
  validateEnvelope(root, 'root', errors);
  validateEnvelope(scene, 'scene', errors);
  validateEnvelope(rail, 'rail', errors);
  validateEnvelope(caption, 'caption', errors);
  validateShared(root, scene, 'scene', errors);
  validateShared(root, rail, 'rail', errors);
  validateShared(root, caption, 'caption', errors);
  validatePosition(root, errors);
  if (root.runtimeBeamCount !== R5_BEAM_COUNT) {
    errors.push(`root.runtimeBeamCount=${root.runtimeBeamCount}`);
  }
  if (root.runtimeCandidateBeamCount !== R5_BEAM_COUNT) {
    errors.push(`root.runtimeCandidateBeamCount=${root.runtimeCandidateBeamCount}`);
  }
  if (root.sevenBeamAdmitted !== 'true') {
    errors.push(`root.sevenBeamAdmitted=${root.sevenBeamAdmitted}`);
  }
  if (root.entryKind !== 'intra' && root.entryKind !== 'inter') {
    errors.push(`root.entryKind=${root.entryKind}`);
  }
  if (!['playing', 'paused', 'complete'].includes(root.status)) {
    errors.push(`root.status=${root.status}`);
  }
  if (root.paused !== 'true' && root.paused !== 'false') {
    errors.push(`root.paused=${root.paused}`);
  }
  if (!['1', '2', '5', '10', '20'].includes(root.speed)) {
    errors.push(`root.speed=${root.speed}`);
  }
  return errors;
}

export function assertR5InstructorSurfaceSet(
  root: R5InstructorRootTelemetry,
  scene: R5InstructorTelemetry,
  rail: R5InstructorTelemetry,
  caption: R5InstructorTelemetry,
): void {
  const errors = validateR5InstructorSurfaceSet(root, scene, rail, caption);
  if (errors.length > 0) {
    throw new Error(`R5 instructor surface mismatch:\n${errors.join('\n')}`);
  }
}

export const R5_REPLAY_STORY_FIELDS = Object.freeze([
  'scenarioId',
  'scenarioVersion',
  'beamCount',
  'entryKind',
  'segmentIndex',
  'segmentKind',
  'sourceTimeSec',
  'segmentTimeSec',
  'durationSec',
  'windowStartSec',
  'windowEndSec',
  'complete',
  'storyId',
  'pairKey',
  'phase',
  'committed',
] as const satisfies readonly (keyof R5InstructorTelemetry)[]);

export function validateR5ReplayEquivalence(
  left: R5InstructorTelemetry,
  right: R5InstructorTelemetry,
): readonly string[] {
  const errors: string[] = [];
  for (const field of R5_REPLAY_STORY_FIELDS) {
    if (!sameField(field, left[field], right[field])) {
      errors.push(`${field}: ${left[field]} != ${right[field]}`);
    }
  }
  return errors;
}
