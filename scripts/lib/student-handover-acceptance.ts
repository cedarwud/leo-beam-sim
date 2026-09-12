/**
 * Independent R6 acceptance oracle.
 *
 * This module intentionally imports no production activity reducer, evidence
 * projector, telemetry composer, or React component. Browser and mutation
 * gates read DOM telemetry into these plain data structures and compare it
 * against this separately maintained contract.
 */

export type R6StudentSurface = 'root' | 'scene' | 'rail' | 'caption' | 'activity';
export type R6StudentStep = 'predict' | 'operate' | 'observe' | 'explain' | 'complete';
export type R6CheckpointId =
  | 'candidate-comparison'
  | 'conditions-and-hold'
  | 'commit-receipt';
export type R6EvidenceClaim =
  | 'serving-below-floor'
  | 'replacement-above-floor'
  | 'replacement-beats-serving'
  | 'hold-complete'
  | 'committed';

export interface R6StudentTelemetry {
  readonly surface: string;
  readonly binding: string;
  readonly schemaVersion: string;
  readonly activityId: string;
  readonly activityVersion: string;
  readonly step: string;
  readonly runId: string;
  readonly prediction: string;
  readonly predictionLocked: string;
  readonly checkpointId: string;
  readonly observedCheckpoints: string;
  readonly explanation: string;
  readonly evidenceClaims: string;
  readonly receiptId: string;
  readonly resetIdentity: string;
  readonly scenarioId: string;
  readonly scenarioVersion: string;
  readonly segment: string;
  readonly instructorRunId: string;
  readonly sourceTimeSec: string;
  readonly storyId: string;
  readonly pairKey: string;
  readonly storyPhase: string;
  readonly committed: string;
}

export interface R6EvidenceTelemetry {
  readonly checkpointId: string;
  readonly sourceTimeSec: string;
  readonly storyId: string;
  readonly pairKey: string;
  readonly claims: Readonly<Record<R6EvidenceClaim, string>>;
}

export const R6_ACTIVITY_ID = 'r6-intra-guided-flow-v1';
export const R6_ACTIVITY_VERSION = '1';
export const R6_SCHEMA_VERSION = '1';
export const R6_SCENARIO_ID = 'homepage-seven-beam-intra-inter-v1';
export const R6_SCENARIO_VERSION = '1';
export const R6_RESET_IDENTITY = 'r6-intra-guided-flow-v1:predict:clean';
export const R6_SUPPORTED_EXPLANATION = 'all-four-conditions-held';

export const R6_COMPARABLE_FIELDS = Object.freeze([
  'binding',
  'schemaVersion',
  'activityId',
  'activityVersion',
  'step',
  'runId',
  'prediction',
  'predictionLocked',
  'checkpointId',
  'observedCheckpoints',
  'explanation',
  'evidenceClaims',
  'receiptId',
  'resetIdentity',
  'scenarioId',
  'scenarioVersion',
  'segment',
  'instructorRunId',
  'sourceTimeSec',
  'storyId',
  'pairKey',
  'storyPhase',
  'committed',
] as const satisfies readonly (keyof R6StudentTelemetry)[]);

export const R6_RESET_EQUIVALENCE_FIELDS = Object.freeze([
  'binding',
  'schemaVersion',
  'activityId',
  'activityVersion',
  'step',
  'runId',
  'prediction',
  'predictionLocked',
  'checkpointId',
  'observedCheckpoints',
  'explanation',
  'evidenceClaims',
  'receiptId',
  'resetIdentity',
  'scenarioId',
  'scenarioVersion',
  'segment',
  'sourceTimeSec',
  'storyId',
  'pairKey',
  'storyPhase',
  'committed',
] as const satisfies readonly (keyof R6StudentTelemetry)[]);

interface ExpectedCheckpoint {
  readonly id: R6CheckpointId;
  readonly sourceTimeSec: number;
  readonly storyPhase: 'measuring' | 'holding' | 'switching';
  readonly committed: boolean;
  readonly observedCheckpoints: string;
  readonly truth: Readonly<Record<R6EvidenceClaim, boolean>>;
}

export const R6_EXPECTED_CHECKPOINTS: Readonly<Record<R6CheckpointId, ExpectedCheckpoint>> =
  Object.freeze({
    'candidate-comparison': Object.freeze({
      id: 'candidate-comparison',
      sourceTimeSec: 20,
      storyPhase: 'measuring',
      committed: false,
      observedCheckpoints: 'candidate-comparison',
      truth: Object.freeze({
        'serving-below-floor': false,
        'replacement-above-floor': true,
        'replacement-beats-serving': true,
        'hold-complete': false,
        committed: false,
      }),
    }),
    'conditions-and-hold': Object.freeze({
      id: 'conditions-and-hold',
      sourceTimeSec: 40,
      storyPhase: 'holding',
      committed: false,
      observedCheckpoints: 'candidate-comparison,conditions-and-hold',
      truth: Object.freeze({
        'serving-below-floor': true,
        'replacement-above-floor': true,
        'replacement-beats-serving': true,
        'hold-complete': true,
        committed: false,
      }),
    }),
    'commit-receipt': Object.freeze({
      id: 'commit-receipt',
      sourceTimeSec: 52,
      storyPhase: 'switching',
      committed: true,
      observedCheckpoints: 'candidate-comparison,conditions-and-hold,commit-receipt',
      truth: Object.freeze({
        'serving-below-floor': true,
        'replacement-above-floor': true,
        'replacement-beats-serving': true,
        'hold-complete': true,
        committed: true,
      }),
    }),
  });

const SURFACES = Object.freeze([
  'root', 'scene', 'rail', 'caption', 'activity',
] as const satisfies readonly R6StudentSurface[]);
const STEPS = new Set<R6StudentStep>([
  'predict', 'operate', 'observe', 'explain', 'complete',
]);
const PREDICTIONS = new Set([
  'stay-serving', 'switch-target', 'insufficient-evidence',
]);
const CLAIMS = Object.freeze([
  'serving-below-floor',
  'replacement-above-floor',
  'replacement-beats-serving',
  'hold-complete',
  'committed',
] as const satisfies readonly R6EvidenceClaim[]);
const COMPARABLE_CLAIMS = new Set<R6EvidenceClaim>([
  'serving-below-floor',
  'replacement-above-floor',
  'replacement-beats-serving',
  'hold-complete',
]);
const EPSILON_SEC = 0.001;

function finite(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sameField(
  field: keyof R6StudentTelemetry,
  left: string,
  right: string,
): boolean {
  if (field !== 'sourceTimeSec') return left === right;
  const leftValue = finite(left);
  const rightValue = finite(right);
  return leftValue !== null
    && rightValue !== null
    && Math.abs(leftValue - rightValue) <= EPSILON_SEC;
}

function commaValues(value: string): readonly string[] {
  return value.length === 0 ? [] : value.split(',');
}

function validateEnvelope(
  telemetry: R6StudentTelemetry,
  expectedSurface: R6StudentSurface,
  errors: string[],
): void {
  if (telemetry.surface !== expectedSurface) {
    errors.push(`${expectedSurface}.surface=${telemetry.surface}`);
  }
  if (telemetry.binding !== 'active') errors.push(`${expectedSurface}.binding=${telemetry.binding}`);
  if (telemetry.schemaVersion !== R6_SCHEMA_VERSION) {
    errors.push(`${expectedSurface}.schemaVersion=${telemetry.schemaVersion}`);
  }
  if (telemetry.activityId !== R6_ACTIVITY_ID) {
    errors.push(`${expectedSurface}.activityId=${telemetry.activityId}`);
  }
  if (telemetry.activityVersion !== R6_ACTIVITY_VERSION) {
    errors.push(`${expectedSurface}.activityVersion=${telemetry.activityVersion}`);
  }
  if (telemetry.scenarioId !== R6_SCENARIO_ID) {
    errors.push(`${expectedSurface}.scenarioId=${telemetry.scenarioId}`);
  }
  if (telemetry.scenarioVersion !== R6_SCENARIO_VERSION) {
    errors.push(`${expectedSurface}.scenarioVersion=${telemetry.scenarioVersion}`);
  }
  if (telemetry.segment !== 'intra') errors.push(`${expectedSurface}.segment=${telemetry.segment}`);
  if (telemetry.resetIdentity !== R6_RESET_IDENTITY) {
    errors.push(`${expectedSurface}.resetIdentity=${telemetry.resetIdentity}`);
  }
  if (telemetry.instructorRunId.length === 0) {
    errors.push(`${expectedSurface}.instructorRunId is empty`);
  }
  if (telemetry.storyId.length === 0) errors.push(`${expectedSurface}.storyId is empty`);
  if (telemetry.pairKey.length === 0) errors.push(`${expectedSurface}.pairKey is empty`);
  if (finite(telemetry.sourceTimeSec) === null) {
    errors.push(`${expectedSurface}.sourceTimeSec=${telemetry.sourceTimeSec}`);
  }
}

function validateShared(
  root: R6StudentTelemetry,
  surface: R6StudentTelemetry,
  label: string,
  errors: string[],
): void {
  for (const field of R6_COMPARABLE_FIELDS) {
    if (!sameField(field, root[field], surface[field])) {
      errors.push(`${label}.${field}=${surface[field]} != root.${field}=${root[field]}`);
    }
  }
}

function validateCheckpoint(
  telemetry: R6StudentTelemetry,
  checkpointId: R6CheckpointId,
  errors: string[],
): void {
  const expected = R6_EXPECTED_CHECKPOINTS[checkpointId];
  const sourceTimeSec = finite(telemetry.sourceTimeSec);
  if (telemetry.checkpointId !== expected.id) {
    errors.push(`checkpointId=${telemetry.checkpointId}, expected ${expected.id}`);
  }
  if (sourceTimeSec === null || Math.abs(sourceTimeSec - expected.sourceTimeSec) > EPSILON_SEC) {
    errors.push(`sourceTimeSec=${telemetry.sourceTimeSec}, expected ${expected.sourceTimeSec}`);
  }
  if (telemetry.storyPhase !== expected.storyPhase) {
    errors.push(`storyPhase=${telemetry.storyPhase}, expected ${expected.storyPhase}`);
  }
  if (telemetry.committed !== String(expected.committed)) {
    errors.push(`committed=${telemetry.committed}, expected ${expected.committed}`);
  }
  if (telemetry.observedCheckpoints !== expected.observedCheckpoints) {
    errors.push(
      `observedCheckpoints=${telemetry.observedCheckpoints}, expected ${expected.observedCheckpoints}`,
    );
  }
}

function validateStep(
  telemetry: R6StudentTelemetry,
  expectedCheckpointId: R6CheckpointId | null,
  errors: string[],
): void {
  if (!STEPS.has(telemetry.step as R6StudentStep)) {
    errors.push(`step=${telemetry.step}`);
    return;
  }
  const step = telemetry.step as R6StudentStep;
  const predictionLocked = telemetry.predictionLocked === 'true';
  if (telemetry.predictionLocked !== 'true' && telemetry.predictionLocked !== 'false') {
    errors.push(`predictionLocked=${telemetry.predictionLocked}`);
  }
  if (step === 'predict') {
    if (predictionLocked) errors.push('predict step is locked');
    if (telemetry.runId !== '') errors.push(`predict.runId=${telemetry.runId}`);
    if (telemetry.checkpointId !== '') errors.push(`predict.checkpointId=${telemetry.checkpointId}`);
    if (telemetry.observedCheckpoints !== '') {
      errors.push(`predict.observedCheckpoints=${telemetry.observedCheckpoints}`);
    }
    if (telemetry.explanation !== '') errors.push(`predict.explanation=${telemetry.explanation}`);
    if (telemetry.evidenceClaims !== '') errors.push(`predict.evidenceClaims=${telemetry.evidenceClaims}`);
    if (telemetry.receiptId !== '') errors.push(`predict.receiptId=${telemetry.receiptId}`);
    const sourceTimeSec = finite(telemetry.sourceTimeSec);
    if (sourceTimeSec === null || Math.abs(sourceTimeSec) > EPSILON_SEC) {
      errors.push(`predict.sourceTimeSec=${telemetry.sourceTimeSec}`);
    }
    if (telemetry.storyPhase !== 'serving') errors.push(`predict.storyPhase=${telemetry.storyPhase}`);
    if (telemetry.committed !== 'false') errors.push(`predict.committed=${telemetry.committed}`);
    return;
  }

  if (!predictionLocked) errors.push(`${step}.predictionLocked=false`);
  if (telemetry.runId.length === 0) errors.push(`${step}.runId is empty`);
  if (!PREDICTIONS.has(telemetry.prediction)) errors.push(`${step}.prediction=${telemetry.prediction}`);
  if (step === 'operate') {
    if (telemetry.checkpointId !== '') errors.push(`operate.checkpointId=${telemetry.checkpointId}`);
    if (telemetry.observedCheckpoints !== '') {
      errors.push(`operate.observedCheckpoints=${telemetry.observedCheckpoints}`);
    }
    const sourceTimeSec = finite(telemetry.sourceTimeSec);
    if (sourceTimeSec === null || Math.abs(sourceTimeSec) > EPSILON_SEC) {
      errors.push(`operate.sourceTimeSec=${telemetry.sourceTimeSec}`);
    }
    return;
  }

  const checkpoint = expectedCheckpointId
    ?? (step === 'observe' ? telemetry.checkpointId as R6CheckpointId : 'commit-receipt');
  if (!(checkpoint in R6_EXPECTED_CHECKPOINTS)) {
    errors.push(`unknown checkpoint=${checkpoint}`);
    return;
  }
  validateCheckpoint(telemetry, checkpoint, errors);

  if (step !== 'complete' && telemetry.receiptId !== '') {
    errors.push(`${step}.receiptId=${telemetry.receiptId}`);
  }
  if (step === 'complete') {
    if (telemetry.explanation !== R6_SUPPORTED_EXPLANATION) {
      errors.push(`complete.explanation=${telemetry.explanation}`);
    }
    const selectedClaims = commaValues(telemetry.evidenceClaims);
    if (selectedClaims.length === 0) errors.push('complete.evidenceClaims is empty');
    if (!selectedClaims.some(claim => COMPARABLE_CLAIMS.has(claim as R6EvidenceClaim))) {
      errors.push(`complete.evidenceClaims=${telemetry.evidenceClaims} has no comparable claim`);
    }
    const expectedReceipt = `${R6_ACTIVITY_ID}:${telemetry.runId}:complete`;
    if (telemetry.receiptId !== expectedReceipt) {
      errors.push(`complete.receiptId=${telemetry.receiptId}, expected ${expectedReceipt}`);
    }
  }
}

export function validateR6StudentSurfaceSet(
  root: R6StudentTelemetry,
  scene: R6StudentTelemetry,
  rail: R6StudentTelemetry,
  caption: R6StudentTelemetry,
  activity: R6StudentTelemetry,
  expectedCheckpointId: R6CheckpointId | null = null,
): readonly string[] {
  const errors: string[] = [];
  const entries = [
    ['root', root],
    ['scene', scene],
    ['rail', rail],
    ['caption', caption],
    ['activity', activity],
  ] as const;
  for (const [surface, telemetry] of entries) {
    validateEnvelope(telemetry, surface, errors);
  }
  for (const [surface, telemetry] of entries.slice(1)) {
    validateShared(root, telemetry, surface, errors);
  }
  validateStep(root, expectedCheckpointId, errors);
  return errors;
}

export function assertR6StudentSurfaceSet(
  root: R6StudentTelemetry,
  scene: R6StudentTelemetry,
  rail: R6StudentTelemetry,
  caption: R6StudentTelemetry,
  activity: R6StudentTelemetry,
  expectedCheckpointId: R6CheckpointId | null = null,
): void {
  const errors = validateR6StudentSurfaceSet(
    root, scene, rail, caption, activity, expectedCheckpointId,
  );
  if (errors.length > 0) {
    throw new Error(`R6 student surface mismatch:\n${errors.join('\n')}`);
  }
}

export function validateR6EvidenceTelemetry(
  evidence: R6EvidenceTelemetry,
  expectedCheckpointId: R6CheckpointId,
  activity: R6StudentTelemetry,
): readonly string[] {
  const errors: string[] = [];
  const expected = R6_EXPECTED_CHECKPOINTS[expectedCheckpointId];
  if (evidence.checkpointId !== expectedCheckpointId) {
    errors.push(`evidence.checkpointId=${evidence.checkpointId}`);
  }
  const sourceTimeSec = finite(evidence.sourceTimeSec);
  if (sourceTimeSec === null || Math.abs(sourceTimeSec - expected.sourceTimeSec) > EPSILON_SEC) {
    errors.push(`evidence.sourceTimeSec=${evidence.sourceTimeSec}`);
  }
  if (evidence.storyId !== activity.storyId) {
    errors.push(`evidence.storyId=${evidence.storyId} != activity.storyId=${activity.storyId}`);
  }
  if (evidence.pairKey !== activity.pairKey) {
    errors.push(`evidence.pairKey=${evidence.pairKey} != activity.pairKey=${activity.pairKey}`);
  }
  for (const claim of CLAIMS) {
    const expectedValue = String(expected.truth[claim]);
    if (evidence.claims[claim] !== expectedValue) {
      errors.push(`evidence.${claim}=${evidence.claims[claim]}, expected ${expectedValue}`);
    }
  }
  return errors;
}

export function validateR6ResetEquivalence(
  initial: R6StudentTelemetry,
  reset: R6StudentTelemetry,
): readonly string[] {
  const errors: string[] = [];
  for (const field of R6_RESET_EQUIVALENCE_FIELDS) {
    if (!sameField(field, initial[field], reset[field])) {
      errors.push(`${field}: ${initial[field]} != ${reset[field]}`);
    }
  }
  return errors;
}

export function expectedR6Checkpoint(id: R6CheckpointId): ExpectedCheckpoint {
  return R6_EXPECTED_CHECKPOINTS[id];
}
