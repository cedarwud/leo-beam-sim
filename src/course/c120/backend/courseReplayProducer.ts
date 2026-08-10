/**
 * Server-only, data-only producer for the bounded C-120 classroom replay.
 *
 * The producer owns a small, explicit course trace.  It does not import the
 * browser/course contract and it does not implement link-budget or energy
 * formulas.  Every closure step is delegated to canonicalRuntime.ts; only
 * the declared idle/sleep/outage course-power assumptions are applied when a
 * step intentionally has no serving beam.
 */

import { createHash } from 'node:crypto';

import {
  C120_ANGLE_AWARE_CONTRACT_VERSION,
  C120_CANONICAL_UNITS,
  type C120CanonicalRuntimeAdapter,
} from './canonicalRuntime';
import { C120_ONEWEB_OBJECT_NAME } from './orbitSource';

export { C120_ONEWEB_OBJECT_NAME } from './orbitSource';

export const C120_COURSE_REPLAY_SCHEMA_VERSION = 'c120-course-replay-producer-v2' as const;
export const C120_COURSE_REPLAY_PRODUCER_KIND = 'C120_COURSE_REPLAY_PRODUCER' as const;
/** Frozen scenario identity for this producer; it is not an arbitrary caller label. */
export const C120_FROZEN_SCENARIO_ID = 'c120-ntpu-energy-decision-01' as const;
/**
 * The only SGP4 materializer accepted by the optional backend lane.  This is
 * an input/provenance pin, not a second orbit implementation: the replay
 * trace below keeps its existing course-owned assumptions and delegates all
 * canonical closure/evaluation to the runtime adapter.
 */
export const C120_MATERIALIZED_SGP4_MODEL_VERSION = 'satellite.js@6.0.2-sgp4-omm-v1' as const;

const fixedValue = <T extends string>(value: number, unit: T): Readonly<{ readonly value: number; readonly unit: T }> => Object.freeze({
  value,
  unit,
});

/**
 * One comparable link assumption set is frozen across all choices.  These
 * are classroom assumptions, not OneWeb measurements, hardware telemetry, or
 * a whole-satellite/whole-constellation model.
 */
export const C120_COURSE_ASSUMPTION = Object.freeze({
  kind: 'COURSE_ASSUMPTION',
  version: 'c120-comparable-link-oneweb-0314-ntpu-v2',
  scope: 'single ONEWEB-0314 pass observed from NTPU',
  measured: false,
  wholeSatelliteCanonical: false,
  values: Object.freeze({
    propagationGainUb: fixedValue(1e-6, 'linear'),
    receiveGainUb: fixedValue(1, 'linear'),
    noisePowerW: fixedValue(1e-9, 'W'),
    beamBandwidthHz: fixedValue(1_000_000, 'Hz'),
    beamPowerCapW: fixedValue(2, 'W'),
    satellitePowerCapW: fixedValue(3, 'W'),
    beamPatternG0Linear: fixedValue(1, 'linear'),
    beamPatternTheta3dbRad: fixedValue(0.05, 'rad'),
    circuitPowerW: fixedValue(0.338, 'W'),
    basebandPowerPerSatelliteW: fixedValue(0.2, 'W'),
    switchEnergyJ: fixedValue(0.12, 'J'),
    idlePowerW: fixedValue(0.2, 'W'),
    sleepPowerW: fixedValue(0.05, 'W'),
    outagePowerW: fixedValue(0.2, 'W'),
    slotDurationSec: fixedValue(30, 's'),
    labAHorizonSec: fixedValue(150, 's'),
    labAWorkloadBits: fixedValue(1_500_000, 'bit'),
  }),
  note: 'All numeric values are versioned course assumptions. They are not OneWeb measurements and do not establish official hardware/channel accuracy or full canonical parity.',
} as const);

export type C120CourseAssumption = typeof C120_COURSE_ASSUMPTION;

export const C120_COURSE_CLAIM = Object.freeze({
  kind: 'MODEL_DERIVED_COURSE_COMPUTATION',
  label: 'model-derived course computation',
  measured: false,
  wholeSatelliteCanonical: false,
  canonicalParity: 'none beyond the pinned runtime call',
  runtimeHashProvenance: 'delegated to canonical-runtime adapter',
  producerVerifiesRuntimeHashes: false,
  note: 'Closure and evaluation are delegated to the pinned canonical runtime adapter; this producer does not verify runtime/golden-fixture hashes itself and does not claim full canonical parity.',
} as const);

export type C120CourseClaim = typeof C120_COURSE_CLAIM;

/** The units are exactly the bridge units enforced by canonicalRuntime.ts. */
export const C120_COURSE_REPLAY_UNITS = C120_CANONICAL_UNITS;
export type C120CourseReplayUnits = typeof C120_COURSE_REPLAY_UNITS;

export const C120_NTPU_OBSERVER_ID = 'NTPU' as const;

export interface C120CourseSourceSnapshotIdentity {
  readonly kind: 'orbit-source-snapshot';
  readonly snapshotId: string;
  readonly contentSha256: string;
  readonly providerId: string;
  readonly objectName: typeof C120_ONEWEB_OBJECT_NAME;
}

export interface C120CourseOrbitSnapshotIdentity {
  readonly kind: 'orbit-pass-snapshot';
  readonly snapshotId: string;
  readonly contentSha256: string;
  readonly providerId: string;
  readonly sourceSnapshotId: string;
  readonly objectName: typeof C120_ONEWEB_OBJECT_NAME;
  readonly observerId: typeof C120_NTPU_OBSERVER_ID;
  readonly passId: string;
  /** Stable pass ordinal from the supplied snapshot, never a wall-clock value. */
  readonly passIndex: number;
  readonly targetUtc: string;
}

/**
 * The narrow materialized-scenario shape consumed by the backend replay lane.
 * The concrete materializer may carry additional course fields; only this
 * provider/TLE anchor is admitted here.  Keeping this as a structural seam
 * avoids importing the browser/course contract into the server-only producer.
 */
export interface C120CourseReplayMaterializedScenario {
  readonly manifest: Readonly<{
    readonly providerKind: string;
    readonly providerId: string;
    readonly scenario: Readonly<{
      readonly providerKind: string;
      readonly providerId: string;
      readonly scenarioId: string;
      readonly sourceMode: string;
      readonly tleSourceId: string;
      readonly targetUtc: string;
    }>;
  }>;
  readonly tle: Readonly<{
    readonly sourceEpochUtc: string;
    readonly targetUtc: string;
    readonly producerLabel: string;
    readonly recordSha256: string;
    readonly lines: readonly [string, string, string];
    readonly frame: Readonly<{
      readonly identity: Readonly<{
        readonly providerKind: string;
        readonly providerId: string;
        readonly scenarioId: string;
        readonly surface: string;
      }>;
    }>;
  }>;
}

export type C120CourseLabACandidateId = 'pace' | 'balanced' | 'burst-to-sleep';
export type C120CourseLabBFrozenRuleId = 'switch-now' | 'stable-two' | 'hysteresis';
export type C120CourseClinicActionId = 'protect-service' | 'chase-score';

export type C120CourseLabCVariableAction =
  | 'send-urgent'
  | 'batch-periodic'
  | 'send-bulk'
  | 'flush-batch'
  | 'wait'
  | 'sleep';

/** Kept broad for callers that label fixed slots; parser pins their positions. */
export type C120CourseLabCSlotAction = 'fixed-contact' | 'fixed-outage' | C120CourseLabCVariableAction;

export type C120CourseLabCSchedule = readonly [
  'fixed-contact',
  C120CourseLabCVariableAction,
  C120CourseLabCVariableAction,
  'fixed-outage',
  C120CourseLabCVariableAction,
  C120CourseLabCVariableAction,
];

export interface C120CourseLabAAction {
  readonly kind: 'lab-a';
  readonly candidateId: C120CourseLabACandidateId;
}

export interface C120CourseLabBAction {
  readonly kind: 'lab-b';
  readonly frozenRuleId: C120CourseLabBFrozenRuleId;
}

export interface C120CourseLabCAction {
  readonly kind: 'lab-c';
  readonly schedule: C120CourseLabCSchedule;
}

export interface C120CourseClinicAction {
  readonly kind: 'clinic';
  readonly actionId: C120CourseClinicActionId;
}

export type C120CourseReplayAction =
  | C120CourseLabAAction
  | C120CourseLabBAction
  | C120CourseLabCAction
  | C120CourseClinicAction;

export interface C120CourseReplayRequest {
  readonly scenarioId: string;
  readonly providerId: string;
  readonly sourceSnapshot: C120CourseSourceSnapshotIdentity;
  readonly orbitSnapshot: C120CourseOrbitSnapshotIdentity;
  readonly units: C120CourseReplayUnits;
  readonly courseAssumption: C120CourseAssumption;
  readonly action: C120CourseReplayAction;
}

export type C120CourseStepState = 'active' | 'idle' | 'sleep' | 'outage';
export type C120CourseStepMarker = 'fixed-contact' | 'fixed-outage';
export type C120CourseStepPowerSource =
  | 'canonical-closure'
  | 'course-assumption'
  | 'course-assumption-plus-canonical-switch';

export interface C120CourseReplayInputReceipt {
  readonly kind: 'canonical-input-receipt';
  readonly mode: 'closure' | 'evaluation';
  readonly sha256: string;
  readonly request: Readonly<{
    readonly mode: 'closure' | 'evaluation';
    readonly inputs: Readonly<Record<string, unknown>>;
    readonly units: C120CourseReplayUnits;
  }>;
}

export interface C120CourseReplayOutputReceipt {
  readonly kind: 'canonical-output-receipt';
  readonly mode: 'closure' | 'evaluation';
  /** Binds the output receipt to the exact canonical input receipt. */
  readonly inputSha256: string;
  readonly sha256: string;
  readonly output: Readonly<Record<string, unknown>>;
}

export interface C120CourseReplayClosureStepReceipt {
  readonly stepIndex: number;
  readonly state: C120CourseStepState;
  readonly marker: C120CourseStepMarker | null;
  readonly durationSec: number;
  readonly geometry: Readonly<{ readonly thetaRad: number; readonly servingBeam: number }>;
  readonly switchIndicator: number;
  readonly inputReceipt: C120CourseReplayInputReceipt;
  readonly outputReceipt: C120CourseReplayOutputReceipt;
  readonly evaluationContribution: Readonly<{
    readonly rateBps: number;
    readonly powerW: number;
    readonly durationSec: number;
    readonly powerSource: C120CourseStepPowerSource;
    readonly coursePowerW: number | null;
    readonly canonicalSwitchPowerW: number;
  }>;
}

export interface C120CourseReplayEvaluationReceipt {
  readonly inputReceipt: C120CourseReplayInputReceipt;
  readonly outputReceipt: C120CourseReplayOutputReceipt;
  readonly derivedFrom: readonly Readonly<{
    readonly stepIndex: number;
    readonly state: C120CourseStepState;
    readonly rateBps: number;
    readonly powerW: number;
    readonly durationSec: number;
    readonly powerSource: C120CourseStepPowerSource;
  }>[];
}

export interface C120CourseReplayReceipt {
  readonly schemaVersion: typeof C120_COURSE_REPLAY_SCHEMA_VERSION;
  readonly producerKind: typeof C120_COURSE_REPLAY_PRODUCER_KIND;
  readonly identity: Readonly<{
    readonly scenarioId: string;
    readonly providerId: string;
    readonly sourceSnapshot: C120CourseSourceSnapshotIdentity;
    readonly orbitSnapshot: C120CourseOrbitSnapshotIdentity;
    readonly units: C120CourseReplayUnits;
  }>;
  readonly action: C120CourseReplayAction;
  readonly courseAssumption: C120CourseAssumption;
  readonly claim: C120CourseClaim;
  readonly courseWorkload: Readonly<{
    readonly kind: 'lab-a-frozen-workload';
    readonly horizonSec: number;
    readonly workloadBits: number;
  }> | null;
  readonly canonicalRuntime: Readonly<{
    readonly contractVersion: typeof C120_ANGLE_AWARE_CONTRACT_VERSION;
    readonly execution: 'closure-steps-and-evaluation-via-c120-canonical-runtime-adapter';
    readonly productionBinding: 'pinned-runtime-by-adapter';
    readonly runtimeHashProvenance: 'delegated-to-canonical-runtime-adapter';
    readonly producerVerifiesRuntimeHashes: false;
    readonly parityClaim: 'none-beyond-pinned-runtime-call';
  }>;
  readonly closureSteps: readonly C120CourseReplayClosureStepReceipt[];
  readonly evaluation: C120CourseReplayEvaluationReceipt;
}

export type C120CourseReplayCanonicalAdapter = C120CanonicalRuntimeAdapter;

export interface C120CourseReplayProducer {
  readonly produce: (request: C120CourseReplayRequest) => Promise<C120CourseReplayReceipt>;
}

export type C120CourseReplayProducerErrorCode =
  | 'INPUT_INVALID'
  | 'IDENTITY_MISMATCH'
  | 'UNITS_MISMATCH'
  | 'ASSUMPTION_MISMATCH'
  | 'CANONICAL_OUTPUT_INVALID'
  | 'CANONICAL_EXECUTION_FAILED';

export class C120CourseReplayProducerError extends Error {
  readonly name = 'C120CourseReplayProducerError';

  constructor(
    readonly code: C120CourseReplayProducerErrorCode,
    message: string,
  ) {
    super(message);
  }
}

interface PlainRecord {
  readonly [key: string]: unknown;
}

interface TraceStep {
  readonly state: C120CourseStepState;
  readonly marker: C120CourseStepMarker | null;
  readonly thetaRad: number;
  readonly servingBeam: number;
  readonly minimumRateBps: number;
  readonly switchIndicator: number;
  readonly durationSec: number;
}

const LINK = Object.freeze({
  propagationGainUb: C120_COURSE_ASSUMPTION.values.propagationGainUb.value,
  receiveGainUb: C120_COURSE_ASSUMPTION.values.receiveGainUb.value,
  noisePowerW: C120_COURSE_ASSUMPTION.values.noisePowerW.value,
  beamBandwidthHz: C120_COURSE_ASSUMPTION.values.beamBandwidthHz.value,
  beamPowerCapW: C120_COURSE_ASSUMPTION.values.beamPowerCapW.value,
  satellitePowerCapW: C120_COURSE_ASSUMPTION.values.satellitePowerCapW.value,
  g0Linear: C120_COURSE_ASSUMPTION.values.beamPatternG0Linear.value,
  theta3dbRad: C120_COURSE_ASSUMPTION.values.beamPatternTheta3dbRad.value,
  circuitPowerW: C120_COURSE_ASSUMPTION.values.circuitPowerW.value,
  basebandPowerPerSatelliteW: C120_COURSE_ASSUMPTION.values.basebandPowerPerSatelliteW.value,
  switchEnergyJ: C120_COURSE_ASSUMPTION.values.switchEnergyJ.value,
  slotDurationSec: C120_COURSE_ASSUMPTION.values.slotDurationSec.value,
});

const ON_AXIS_THETA_RAD = 0;
const OFF_AXIS_THETA_RAD = 0.02;
const LAB_A_FROZEN_WORKLOAD_BITS = C120_COURSE_ASSUMPTION.values.labAWorkloadBits.value;
const LAB_A_HORIZON_SEC = C120_COURSE_ASSUMPTION.values.labAHorizonSec.value;
const LAB_A_ACTIVE_SLOT_COUNT = 1;
const LAB_A_ACTIVE_RATE_BPS = LAB_A_FROZEN_WORKLOAD_BITS / (LAB_A_ACTIVE_SLOT_COUNT * LINK.slotDurationSec);
const ACTIVE_RATE_BPS = 100_000;

function activeStep(overrides: Partial<TraceStep> = {}): TraceStep {
  return Object.freeze({
    state: 'active',
    marker: null,
    thetaRad: ON_AXIS_THETA_RAD,
    servingBeam: 0,
    minimumRateBps: ACTIVE_RATE_BPS,
    switchIndicator: 0,
    durationSec: LINK.slotDurationSec,
    ...overrides,
  });
}

function inactiveStep(state: Exclude<C120CourseStepState, 'active'>, overrides: Partial<TraceStep> = {}): TraceStep {
  return Object.freeze({
    state,
    marker: null,
    thetaRad: ON_AXIS_THETA_RAD,
    servingBeam: -1,
    minimumRateBps: 0,
    switchIndicator: 0,
    durationSec: LINK.slotDurationSec,
    ...overrides,
  });
}

const LAB_A_TRACES: Readonly<Record<C120CourseLabACandidateId, readonly TraceStep[]>> = Object.freeze({
  pace: Object.freeze([
    activeStep({ minimumRateBps: LAB_A_ACTIVE_RATE_BPS }),
    inactiveStep('idle'), inactiveStep('idle'), inactiveStep('idle'), inactiveStep('idle'),
  ]),
  balanced: Object.freeze([
    inactiveStep('idle'), inactiveStep('idle'), activeStep({ minimumRateBps: LAB_A_ACTIVE_RATE_BPS }),
    inactiveStep('sleep'), inactiveStep('idle'),
  ]),
  'burst-to-sleep': Object.freeze([
    activeStep({ minimumRateBps: LAB_A_ACTIVE_RATE_BPS }),
    inactiveStep('sleep'), inactiveStep('sleep'), inactiveStep('sleep'), inactiveStep('sleep'),
  ]),
});

const LAB_B_GEOMETRY = Object.freeze([ON_AXIS_THETA_RAD, OFF_AXIS_THETA_RAD, OFF_AXIS_THETA_RAD, ON_AXIS_THETA_RAD]);
const LAB_B_TRACES: Readonly<Record<C120CourseLabBFrozenRuleId, readonly TraceStep[]>> = Object.freeze({
  'switch-now': Object.freeze([
    activeStep({ thetaRad: LAB_B_GEOMETRY[0] }),
    activeStep({ thetaRad: LAB_B_GEOMETRY[1], switchIndicator: 1 }),
    activeStep({ thetaRad: LAB_B_GEOMETRY[2], switchIndicator: 1 }),
    activeStep({ thetaRad: LAB_B_GEOMETRY[3] }),
  ]),
  'stable-two': Object.freeze([
    activeStep({ thetaRad: LAB_B_GEOMETRY[0] }),
    inactiveStep('outage', { thetaRad: LAB_B_GEOMETRY[1], switchIndicator: 1 }),
    activeStep({ thetaRad: LAB_B_GEOMETRY[2], switchIndicator: 1 }),
    activeStep({ thetaRad: LAB_B_GEOMETRY[3] }),
  ]),
  hysteresis: Object.freeze([
    activeStep({ thetaRad: LAB_B_GEOMETRY[0] }),
    inactiveStep('outage', { thetaRad: LAB_B_GEOMETRY[1] }),
    inactiveStep('outage', { thetaRad: LAB_B_GEOMETRY[2] }),
    activeStep({ thetaRad: LAB_B_GEOMETRY[3] }),
  ]),
});

const LAB_C_ACTION_PROFILES: Readonly<Record<C120CourseLabCVariableAction, TraceStep>> = Object.freeze({
  'send-urgent': activeStep({ minimumRateBps: 150_000 }),
  'batch-periodic': activeStep({ minimumRateBps: 90_000 }),
  'send-bulk': activeStep({ minimumRateBps: 200_000 }),
  'flush-batch': activeStep({ minimumRateBps: 125_000 }),
  wait: inactiveStep('idle'),
  sleep: inactiveStep('sleep'),
});

const CLINIC_GEOMETRY = Object.freeze([0, 0.01, 0.02, 0.01]);
const CLINIC_TRACES: Readonly<Record<C120CourseClinicActionId, readonly TraceStep[]>> = Object.freeze({
  'protect-service': Object.freeze([
    activeStep({ thetaRad: CLINIC_GEOMETRY[0], minimumRateBps: 90_000 }),
    activeStep({ thetaRad: CLINIC_GEOMETRY[1], minimumRateBps: 90_000 }),
    activeStep({ thetaRad: CLINIC_GEOMETRY[2], minimumRateBps: 90_000, switchIndicator: 1 }),
    activeStep({ thetaRad: CLINIC_GEOMETRY[3], minimumRateBps: 90_000 }),
  ]),
  'chase-score': Object.freeze([
    activeStep({ thetaRad: CLINIC_GEOMETRY[0], minimumRateBps: 150_000 }),
    activeStep({ thetaRad: CLINIC_GEOMETRY[1], minimumRateBps: 150_000, switchIndicator: 1 }),
    activeStep({ thetaRad: CLINIC_GEOMETRY[2], minimumRateBps: 150_000, switchIndicator: 1 }),
    activeStep({ thetaRad: CLINIC_GEOMETRY[3], minimumRateBps: 150_000 }),
  ]),
});

const LAB_C_VARIABLE_ACTIONS = new Set<C120CourseLabCVariableAction>([
  'send-urgent', 'batch-periodic', 'send-bulk', 'flush-batch', 'wait', 'sleep',
]);

function fail(code: C120CourseReplayProducerErrorCode, message: string): never {
  throw new C120CourseReplayProducerError(code, message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return false;
  return Object.getOwnPropertySymbols(value).length === 0;
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) return fail('INPUT_INVALID', `${path} must be a plain JSON object`);
  return value;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[], path: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) return fail('INPUT_INVALID', `${path} has unknown or missing fields`);
}

function requiredKeys(value: Record<string, unknown>, expected: readonly string[], path: string): void {
  for (const key of expected) {
    if (!(key in value)) return fail('INPUT_INVALID', `${path}.${key} is missing`);
  }
}

function nonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') return fail('INPUT_INVALID', `${path} must be non-empty text`);
  return value;
}

function finiteNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fail('INPUT_INVALID', `${path} must be finite`);
  return value;
}

function integer(value: unknown, path: string): number {
  const number = finiteNumber(value, path);
  if (!Number.isInteger(number) || number < 0) return fail('INPUT_INVALID', `${path} must be a non-negative integer`);
  return number;
}

function contentAddress(value: unknown, path: string): string {
  const text = nonEmptyString(value, path);
  if (!/^(?:sha256:)?[0-9a-f]{64}$/.test(text)) return fail('INPUT_INVALID', `${path} must be a SHA-256 content address`);
  return text;
}

function utcText(value: unknown, path: string): string {
  const text = nonEmptyString(value, path);
  if (!text.endsWith('Z') || !Number.isFinite(Date.parse(text))) return fail('INPUT_INVALID', `${path} must be UTC text ending in Z`);
  return text;
}

function canonicalize(value: unknown, path = 'value'): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return finiteNumber(value, path);
  if (typeof value === 'undefined') return fail('INPUT_INVALID', `${path} must not be undefined`);
  if (Array.isArray(value)) {
    const output: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      if (!(index in value)) return fail('INPUT_INVALID', `${path}[${index}] must not be sparse`);
      output.push(canonicalize(value[index], `${path}[${index}]`));
    }
    return output;
  }
  const object = record(value, path);
  const output: Record<string, unknown> = {};
  for (const key of Object.keys(object).sort()) output[key] = canonicalize(object[key], `${path}.${key}`);
  return output;
}

function canonicalJson(value: unknown): string {
  const json = JSON.stringify(canonicalize(value));
  if (json === undefined) return fail('INPUT_INVALID', 'value cannot be represented as JSON');
  return json;
}

function sha256(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}

function rawSha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function cloneCanonical<T>(value: T, path: string): T {
  return canonicalize(value, path) as T;
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
  Object.freeze(value);
  if (Array.isArray(value)) value.forEach(item => deepFreeze(item));
  else Object.values(value as Record<string, unknown>).forEach(item => deepFreeze(item));
  return value;
}

function validateUnits(value: unknown): C120CourseReplayUnits {
  const units = record(value, 'units');
  exactKeys(units, Object.keys(C120_COURSE_REPLAY_UNITS), 'units');
  if (canonicalJson(units) !== canonicalJson(C120_COURSE_REPLAY_UNITS)) return fail('UNITS_MISMATCH', 'units do not match pinned canonical runtime units');
  return cloneCanonical(C120_COURSE_REPLAY_UNITS, 'units') as C120CourseReplayUnits;
}

function validateAssumption(value: unknown): C120CourseAssumption {
  const assumption = record(value, 'courseAssumption');
  exactKeys(assumption, Object.keys(C120_COURSE_ASSUMPTION), 'courseAssumption');
  if (canonicalJson(assumption) !== canonicalJson(C120_COURSE_ASSUMPTION)) return fail('ASSUMPTION_MISMATCH', 'courseAssumption is not the frozen comparable-link assumption');
  return cloneCanonical(C120_COURSE_ASSUMPTION, 'courseAssumption') as C120CourseAssumption;
}

function validateSourceSnapshot(value: unknown, providerId: string): C120CourseSourceSnapshotIdentity {
  const source = record(value, 'sourceSnapshot');
  exactKeys(source, ['kind', 'snapshotId', 'contentSha256', 'providerId', 'objectName'], 'sourceSnapshot');
  if (source.kind !== 'orbit-source-snapshot') return fail('IDENTITY_MISMATCH', 'source snapshot kind mismatch');
  const sourceProvider = nonEmptyString(source.providerId, 'sourceSnapshot.providerId');
  if (sourceProvider !== providerId) return fail('IDENTITY_MISMATCH', 'source snapshot providerId mismatch');
  if (source.objectName !== C120_ONEWEB_OBJECT_NAME) return fail('IDENTITY_MISMATCH', 'source snapshot objectName mismatch');
  return {
    kind: 'orbit-source-snapshot',
    snapshotId: nonEmptyString(source.snapshotId, 'sourceSnapshot.snapshotId'),
    contentSha256: contentAddress(source.contentSha256, 'sourceSnapshot.contentSha256'),
    providerId: sourceProvider,
    objectName: C120_ONEWEB_OBJECT_NAME,
  };
}

function validateOrbitSnapshot(value: unknown, providerId: string, sourceSnapshotId: string): C120CourseOrbitSnapshotIdentity {
  const orbit = record(value, 'orbitSnapshot');
  exactKeys(orbit, [
    'kind', 'snapshotId', 'contentSha256', 'providerId', 'sourceSnapshotId', 'objectName', 'observerId',
    'passId', 'passIndex', 'targetUtc',
  ], 'orbitSnapshot');
  if (orbit.kind !== 'orbit-pass-snapshot') return fail('IDENTITY_MISMATCH', 'orbit snapshot kind mismatch');
  const orbitProvider = nonEmptyString(orbit.providerId, 'orbitSnapshot.providerId');
  if (orbitProvider !== providerId) return fail('IDENTITY_MISMATCH', 'orbit snapshot providerId mismatch');
  if (orbit.sourceSnapshotId !== sourceSnapshotId) return fail('IDENTITY_MISMATCH', 'orbit/source snapshot binding mismatch');
  if (orbit.objectName !== C120_ONEWEB_OBJECT_NAME) return fail('IDENTITY_MISMATCH', 'orbit snapshot objectName mismatch');
  if (orbit.observerId !== C120_NTPU_OBSERVER_ID) return fail('IDENTITY_MISMATCH', 'orbit snapshot observerId mismatch');
  return {
    kind: 'orbit-pass-snapshot',
    snapshotId: nonEmptyString(orbit.snapshotId, 'orbitSnapshot.snapshotId'),
    contentSha256: contentAddress(orbit.contentSha256, 'orbitSnapshot.contentSha256'),
    providerId: orbitProvider,
    sourceSnapshotId,
    objectName: C120_ONEWEB_OBJECT_NAME,
    observerId: C120_NTPU_OBSERVER_ID,
    passId: nonEmptyString(orbit.passId, 'orbitSnapshot.passId'),
    passIndex: integer(orbit.passIndex, 'orbitSnapshot.passIndex'),
    targetUtc: utcText(orbit.targetUtc, 'orbitSnapshot.targetUtc'),
  };
}

function parseAction(value: unknown): C120CourseReplayAction {
  const action = record(value, 'action');
  if (action.kind === 'lab-a') {
    exactKeys(action, ['kind', 'candidateId'], 'action.lab-a');
    if (action.candidateId !== 'pace' && action.candidateId !== 'balanced' && action.candidateId !== 'burst-to-sleep') return fail('INPUT_INVALID', 'action.lab-a.candidateId is unsupported');
    return { kind: 'lab-a', candidateId: action.candidateId };
  }
  if (action.kind === 'lab-b') {
    exactKeys(action, ['kind', 'frozenRuleId'], 'action.lab-b');
    if (action.frozenRuleId !== 'switch-now' && action.frozenRuleId !== 'stable-two' && action.frozenRuleId !== 'hysteresis') return fail('INPUT_INVALID', 'action.lab-b.frozenRuleId is unsupported');
    return { kind: 'lab-b', frozenRuleId: action.frozenRuleId };
  }
  if (action.kind === 'clinic') {
    exactKeys(action, ['kind', 'actionId'], 'action.clinic');
    if (action.actionId !== 'protect-service' && action.actionId !== 'chase-score') return fail('INPUT_INVALID', 'action.clinic.actionId is unsupported');
    return { kind: 'clinic', actionId: action.actionId };
  }
  if (action.kind === 'lab-c') {
    exactKeys(action, ['kind', 'schedule'], 'action.lab-c');
    if (!Array.isArray(action.schedule) || action.schedule.length !== 6) return fail('INPUT_INVALID', 'action.lab-c.schedule must contain exactly six slots');
    const slots = action.schedule.map((slot, index) => {
      if (typeof slot !== 'string') return fail('INPUT_INVALID', `action.lab-c.schedule[${index}] must be text`);
      return slot;
    });
    if (slots[0] !== 'fixed-contact' || slots[3] !== 'fixed-outage') return fail('INPUT_INVALID', 'action.lab-c.schedule must pin contact slot 0 and outage slot 3');
    for (const index of [1, 2, 4, 5]) {
      if (!LAB_C_VARIABLE_ACTIONS.has(slots[index] as C120CourseLabCVariableAction)) return fail('INPUT_INVALID', `action.lab-c.schedule[${index}] is unsupported`);
    }
    return {
      kind: 'lab-c',
      schedule: [
        'fixed-contact',
        slots[1] as C120CourseLabCVariableAction,
        slots[2] as C120CourseLabCVariableAction,
        'fixed-outage',
        slots[4] as C120CourseLabCVariableAction,
        slots[5] as C120CourseLabCVariableAction,
      ],
    };
  }
  return fail('INPUT_INVALID', 'action.kind is unsupported');
}

function validateRequest(value: unknown): {
  readonly scenarioId: string;
  readonly providerId: string;
  readonly sourceSnapshot: C120CourseSourceSnapshotIdentity;
  readonly orbitSnapshot: C120CourseOrbitSnapshotIdentity;
  readonly units: C120CourseReplayUnits;
  readonly courseAssumption: C120CourseAssumption;
  readonly action: C120CourseReplayAction;
} {
  const request = record(value, 'request');
  exactKeys(request, ['scenarioId', 'providerId', 'sourceSnapshot', 'orbitSnapshot', 'units', 'courseAssumption', 'action'], 'request');
  const scenarioId = nonEmptyString(request.scenarioId, 'scenarioId');
  if (scenarioId !== C120_FROZEN_SCENARIO_ID) return fail('IDENTITY_MISMATCH', 'scenarioId is not the frozen C-120 scenario identity');
  const providerId = nonEmptyString(request.providerId, 'providerId');
  const sourceSnapshot = validateSourceSnapshot(request.sourceSnapshot, providerId);
  const orbitSnapshot = validateOrbitSnapshot(request.orbitSnapshot, providerId, sourceSnapshot.snapshotId);
  const units = validateUnits(request.units);
  const courseAssumption = validateAssumption(request.courseAssumption);
  const action = parseAction(request.action);
  return { scenarioId, providerId, sourceSnapshot, orbitSnapshot, units, courseAssumption, action };
}

function tleChecksumIsValid(line: string): boolean {
  if (line.length !== 69 || !/^[0-9]$/.test(line[68] ?? '')) return false;
  let sum = 0;
  for (const character of line.slice(0, 68)) {
    if (character >= '0' && character <= '9') sum += character.charCodeAt(0) - 48;
    else if (character === '-') sum += 1;
  }
  return sum % 10 === Number(line[68]);
}

function validateMaterializedTle(value: unknown): {
  readonly sourceEpochUtc: string;
  readonly targetUtc: string;
  readonly producerLabel: string;
  readonly recordSha256: string;
  readonly lines: readonly [string, string, string];
  readonly providerId: string;
  readonly scenarioId: string;
} {
  const materialized = record(value, 'materializedScenario');
  const manifest = record(materialized.manifest, 'materializedScenario.manifest');
  if (manifest.providerKind !== 'canonical-adapter') return fail('IDENTITY_MISMATCH', 'materialized provider kind mismatch');
  const manifestProviderId = nonEmptyString(manifest.providerId, 'materializedScenario.manifest.providerId');
  const identity = record(manifest.scenario, 'materializedScenario.manifest.scenario');
  requiredKeys(identity, [
    'providerKind', 'providerId', 'scenarioId', 'sourceMode', 'tleSourceId', 'targetUtc',
  ], 'materializedScenario.manifest.scenario');
  if (identity.providerKind !== 'canonical-adapter') return fail('IDENTITY_MISMATCH', 'materialized scenario provider kind mismatch');
  const providerId = nonEmptyString(identity.providerId, 'materializedScenario.manifest.scenario.providerId');
  if (providerId !== manifestProviderId) return fail('IDENTITY_MISMATCH', 'materialized manifest/provider identity mismatch');
  if (!/^c120-canonical-adapter-[0-9a-f]{64}$/.test(providerId)) return fail('IDENTITY_MISMATCH', 'materialized provider identity is not content-addressed');
  const scenarioId = nonEmptyString(identity.scenarioId, 'materializedScenario.manifest.scenario.scenarioId');
  if (scenarioId !== C120_FROZEN_SCENARIO_ID) return fail('IDENTITY_MISMATCH', 'materialized scenarioId is not the frozen C-120 scenario identity');
  if (identity.sourceMode !== 'bundled') return fail('IDENTITY_MISMATCH', 'materialized scenario source mode mismatch');

  const tle = record(materialized.tle, 'materializedScenario.tle');
  requiredKeys(tle, ['sourceEpochUtc', 'targetUtc', 'producerLabel', 'recordSha256', 'lines', 'frame'], 'materializedScenario.tle');
  const sourceEpochUtc = utcText(tle.sourceEpochUtc, 'materializedScenario.tle.sourceEpochUtc');
  const targetUtc = utcText(tle.targetUtc, 'materializedScenario.tle.targetUtc');
  const identityTargetUtc = utcText(identity.targetUtc, 'materializedScenario.manifest.scenario.targetUtc');
  if (targetUtc !== identityTargetUtc) return fail('IDENTITY_MISMATCH', 'materialized TLE target UTC does not match scenario identity');
  const producerLabel = nonEmptyString(tle.producerLabel, 'materializedScenario.tle.producerLabel');
  if (!producerLabel.startsWith(C120_MATERIALIZED_SGP4_MODEL_VERSION)) return fail('IDENTITY_MISMATCH', 'materialized orbit model is not the pinned SGP4 producer');
  const recordSha256 = nonEmptyString(tle.recordSha256, 'materializedScenario.tle.recordSha256');
  if (!/^[0-9a-f]{64}$/.test(recordSha256)) return fail('INPUT_INVALID', 'materializedScenario.tle.recordSha256 must be a lowercase SHA-256 digest');
  if (identity.tleSourceId !== `c120-current-tle-${recordSha256}`) return fail('IDENTITY_MISMATCH', 'materialized TLE/source identity mismatch');

  if (!Array.isArray(tle.lines) || tle.lines.length !== 3) return fail('INPUT_INVALID', 'materializedScenario.tle.lines must contain exactly three lines');
  const lines = tle.lines.map((line, index) => nonEmptyString(line, `materializedScenario.tle.lines[${index}]`)) as [string, string, string];
  if (lines[0]!.trimEnd() !== C120_ONEWEB_OBJECT_NAME) return fail('IDENTITY_MISMATCH', 'materialized TLE object identity mismatch');
  if (!lines[1]!.startsWith('1 49100') || !lines[2]!.startsWith('2 49100')) return fail('IDENTITY_MISMATCH', 'materialized TLE catalog identity mismatch');
  if (!tleChecksumIsValid(lines[1]!) || !tleChecksumIsValid(lines[2]!)) return fail('IDENTITY_MISMATCH', 'materialized TLE checksum mismatch');
  // currentTleSource preserves the exact response hash while exposing
  // normalized lines. Accept only the four line-ending forms that its parser
  // can represent; a different byte stream remains a content-address failure.
  const lineBody = lines.join('\n');
  const crlfLineBody = lineBody.split('\n').join('\r\n');
  const rawTleVariants = [lineBody, `${lineBody}\n`, crlfLineBody, `${crlfLineBody}\r\n`];
  if (!rawTleVariants.some(rawTle => rawSha256(rawTle) === recordSha256)) {
    return fail('IDENTITY_MISMATCH', 'materialized TLE content address mismatch');
  }

  const frame = record(tle.frame, 'materializedScenario.tle.frame');
  const frameIdentity = record(frame.identity, 'materializedScenario.tle.frame.identity');
  requiredKeys(frameIdentity, ['providerKind', 'providerId', 'scenarioId', 'surface'], 'materializedScenario.tle.frame.identity');
  if (frameIdentity.providerKind !== 'canonical-adapter' || frameIdentity.surface !== 'tle') return fail('IDENTITY_MISMATCH', 'materialized TLE frame identity kind mismatch');
  if (frameIdentity.providerId !== providerId || frameIdentity.scenarioId !== scenarioId) return fail('IDENTITY_MISMATCH', 'materialized TLE frame/provider identity mismatch');

  return { sourceEpochUtc, targetUtc, producerLabel, recordSha256, lines, providerId, scenarioId };
}

/**
 * Convert one verified materialized SGP4/TLE anchor into the backend bridge
 * request.  The generated source/orbit identities are content-addressed from
 * the pinned TLE and model marker; no orbit or energy value is recomputed here.
 * The existing course assumptions and canonical units remain unchanged.
 */
export function createC120CourseReplayRequestFromMaterializedScenario(
  value: unknown,
  actionValue: unknown,
): C120CourseReplayRequest {
  const materialized = validateMaterializedTle(value);
  const action = parseAction(actionValue);
  const sourceSnapshotId = `c120-current-tle-${materialized.recordSha256}`;
  const orbitIdentity = {
    materializer: 'c120-course-replay-materialized-sgp4-tle-v1',
    model: C120_MATERIALIZED_SGP4_MODEL_VERSION,
    providerId: materialized.providerId,
    scenarioId: materialized.scenarioId,
    sourceSnapshotId,
    targetUtc: materialized.targetUtc,
    tleContentSha256: materialized.recordSha256,
  } as const;
  const orbitContentSha256 = sha256(orbitIdentity);
  const sourceSnapshot: C120CourseSourceSnapshotIdentity = {
    kind: 'orbit-source-snapshot',
    snapshotId: sourceSnapshotId,
    contentSha256: materialized.recordSha256,
    providerId: materialized.providerId,
    objectName: C120_ONEWEB_OBJECT_NAME,
  };
  const orbitSnapshot: C120CourseOrbitSnapshotIdentity = {
    kind: 'orbit-pass-snapshot',
    snapshotId: `c120-sgp4-orbit-${orbitContentSha256}`,
    contentSha256: orbitContentSha256,
    providerId: materialized.providerId,
    sourceSnapshotId,
    objectName: C120_ONEWEB_OBJECT_NAME,
    observerId: C120_NTPU_OBSERVER_ID,
    passId: `c120-ntpu-pass-${materialized.recordSha256.slice(0, 16)}`,
    passIndex: 0,
    targetUtc: materialized.targetUtc,
  };
  return {
    scenarioId: materialized.scenarioId,
    providerId: materialized.providerId,
    sourceSnapshot,
    orbitSnapshot,
    units: cloneCanonical(C120_COURSE_REPLAY_UNITS, 'materialized request units') as C120CourseReplayUnits,
    courseAssumption: cloneCanonical(C120_COURSE_ASSUMPTION, 'materialized request assumption') as C120CourseAssumption,
    action,
  };
}

function traceForAction(action: C120CourseReplayAction): readonly TraceStep[] {
  if (action.kind === 'lab-a') return LAB_A_TRACES[action.candidateId];
  if (action.kind === 'lab-b') return LAB_B_TRACES[action.frozenRuleId];
  if (action.kind === 'clinic') return CLINIC_TRACES[action.actionId];
  return [
    inactiveStep('idle', { marker: 'fixed-contact' }),
    LAB_C_ACTION_PROFILES[action.schedule[1]],
    LAB_C_ACTION_PROFILES[action.schedule[2]],
    inactiveStep('outage', { marker: 'fixed-outage' }),
    LAB_C_ACTION_PROFILES[action.schedule[4]],
    LAB_C_ACTION_PROFILES[action.schedule[5]],
  ];
}

function courseWorkloadForAction(action: C120CourseReplayAction): C120CourseReplayReceipt['courseWorkload'] {
  if (action.kind !== 'lab-a') return null;
  return {
    kind: 'lab-a-frozen-workload',
    horizonSec: LAB_A_HORIZON_SEC,
    workloadBits: LAB_A_FROZEN_WORKLOAD_BITS,
  };
}

function closureInputs(step: TraceStep): Readonly<Record<string, unknown>> {
  const served = step.state === 'active' && step.servingBeam >= 0;
  return {
    theta_rad_ub: [[step.thetaRad]],
    propagation_gain_ub: [[LINK.propagationGainUb]],
    receive_gain_ub: [[LINK.receiveGainUb]],
    serving_beam_u: [served ? step.servingBeam : -1],
    beam_active_b: [served],
    beam_load_b: [served ? 1 : 0],
    beam_satellite_b: [0],
    beam_color_b: [0],
    lagged_interference_u_w: [0],
    noise_power_w: LINK.noisePowerW,
    beam_bandwidth_hz: LINK.beamBandwidthHz,
    minimum_rate_bps: served ? step.minimumRateBps : 0,
    beam_power_cap_w: [LINK.beamPowerCapW],
    satellite_power_cap_w: LINK.satellitePowerCapW,
    g0_linear: LINK.g0Linear,
    theta_3db_rad: LINK.theta3dbRad,
    p_circuit_w: LINK.circuitPowerW,
    p_baseband_per_satellite_w: LINK.basebandPowerPerSatelliteW,
    frame_duration_s: step.durationSec,
    e_train_j_b: [0],
    train_indicator_b: [0],
    e_switch_j: LINK.switchEnergyJ,
    switch_indicator_b: [step.switchIndicator],
  };
}

function coursePowerFor(state: Exclude<C120CourseStepState, 'active'>): number {
  if (state === 'idle') return C120_COURSE_ASSUMPTION.values.idlePowerW.value;
  if (state === 'sleep') return C120_COURSE_ASSUMPTION.values.sleepPowerW.value;
  return C120_COURSE_ASSUMPTION.values.outagePowerW.value;
}

function assertJsonSafe(value: unknown, path: string): asserts value is PlainRecord {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return fail('CANONICAL_OUTPUT_INVALID', `${path} must be finite`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((child, index) => assertJsonSafe(child, `${path}[${index}]`));
    return;
  }
  if (!isRecord(value)) return fail('CANONICAL_OUTPUT_INVALID', `${path} must be a plain JSON value`);
  Object.entries(value).forEach(([key, child]) => assertJsonSafe(child, `${path}.${key}`));
}

function validateClosureOutput(value: unknown): Readonly<Record<string, unknown>> {
  const output = record(value, 'closure output');
  assertJsonSafe(output, 'closure output');
  if (output.contract_version !== C120_ANGLE_AWARE_CONTRACT_VERSION) return fail('CANONICAL_OUTPUT_INVALID', 'closure output contract version mismatch');
  const accounting = record(output.system_accounting, 'closure output.system_accounting');
  exactKeys(accounting, [
    'system_throughput_bps', 'system_consumed_power_w', 'system_ee_bits_per_j', 'per_user_contributions_bits_per_j', 'zero_over_zero',
  ], 'closure output.system_accounting');
  const throughput = finiteNumber(accounting.system_throughput_bps, 'closure output.system_accounting.system_throughput_bps');
  const power = finiteNumber(accounting.system_consumed_power_w, 'closure output.system_accounting.system_consumed_power_w');
  const efficiency = finiteNumber(accounting.system_ee_bits_per_j, 'closure output.system_accounting.system_ee_bits_per_j');
  if (typeof accounting.zero_over_zero !== 'boolean') return fail('CANONICAL_OUTPUT_INVALID', 'closure zero_over_zero must be boolean');
  if (throughput < 0 || power < 0 || efficiency < 0) return fail('CANONICAL_OUTPUT_INVALID', 'closure output has negative physical values');
  if (power === 0 && throughput > 0) return fail('CANONICAL_OUTPUT_INVALID', 'closure output has throughput with zero power');
  if (power === 0 && throughput === 0 && efficiency !== 0) return fail('CANONICAL_OUTPUT_INVALID', 'zero-power zero-throughput closure must have zero EE');
  if (accounting.zero_over_zero !== (power === 0 && throughput === 0)) return fail('CANONICAL_OUTPUT_INVALID', 'closure zero_over_zero does not match power/throughput');
  if (power > 0 && Math.abs(efficiency - throughput / power) > 1e-12 * Math.abs(throughput / power) + 1e-15) return fail('CANONICAL_OUTPUT_INVALID', 'closure output EE is not throughput divided by power');
  return cloneCanonical(output, 'closure output') as Readonly<Record<string, unknown>>;
}

function evaluationInputArray(value: unknown, path: string, duration = false): number[] {
  if (!Array.isArray(value)) return fail('CANONICAL_OUTPUT_INVALID', `${path} must be an array`);
  return value.map((item, index) => {
    if (typeof item !== 'number' || !Number.isFinite(item) || (duration ? item <= 0 : item < 0)) {
      return fail('CANONICAL_OUTPUT_INVALID', `${path}[${index}] is outside its physical domain`);
    }
    return item;
  });
}

function closeEnough(actual: number, expected: number): boolean {
  return Math.abs(actual - expected) <= 1e-9 + 1e-12 * Math.abs(expected);
}

function validateEvaluationOutput(
  value: unknown,
  inputs: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  const output = record(value, 'evaluation output');
  assertJsonSafe(output, 'evaluation output');
  exactKeys(output, ['delivered_bits', 'consumed_energy_j', 'energy_efficiency_bits_per_j', 'zero_over_zero'], 'evaluation output');
  const rates = evaluationInputArray(inputs.step_throughputs_bps, 'evaluation inputs.step_throughputs_bps');
  const powers = evaluationInputArray(inputs.step_consumed_power_w, 'evaluation inputs.step_consumed_power_w');
  const durations = evaluationInputArray(inputs.step_duration_s, 'evaluation inputs.step_duration_s', true);
  if (rates.length !== powers.length || rates.length !== durations.length) return fail('CANONICAL_OUTPUT_INVALID', 'evaluation input arrays must have equal lengths');
  const expectedBits = rates.reduce((sum, rate, index) => sum + rate * durations[index]!, 0);
  const expectedEnergy = powers.reduce((sum, power, index) => sum + power * durations[index]!, 0);
  const expectedEfficiency = expectedEnergy === 0 ? 0 : expectedBits / expectedEnergy;
  const expectedZeroOverZero = expectedEnergy === 0;
  const bits = finiteNumber(output.delivered_bits, 'evaluation output.delivered_bits');
  const energy = finiteNumber(output.consumed_energy_j, 'evaluation output.consumed_energy_j');
  const efficiency = finiteNumber(output.energy_efficiency_bits_per_j, 'evaluation output.energy_efficiency_bits_per_j');
  if (bits < 0 || energy < 0 || efficiency < 0) return fail('CANONICAL_OUTPUT_INVALID', 'evaluation output has negative physical values');
  if (energy === 0 && (bits > 0 || efficiency !== 0)) return fail('CANONICAL_OUTPUT_INVALID', 'evaluation output has invalid zero energy');
  if (energy > 0 && Math.abs(efficiency - bits / energy) > 1e-12 * Math.abs(bits / energy) + 1e-15) return fail('CANONICAL_OUTPUT_INVALID', 'evaluation output EE is not delivered bits divided by energy');
  if (!closeEnough(bits, expectedBits) || !closeEnough(energy, expectedEnergy) || !closeEnough(efficiency, expectedEfficiency)) return fail('CANONICAL_OUTPUT_INVALID', 'evaluation output does not match its derived input arrays');
  if (output.zero_over_zero !== expectedZeroOverZero) return fail('CANONICAL_OUTPUT_INVALID', 'evaluation zero_over_zero does not match its derived input arrays');
  return cloneCanonical(output, 'evaluation output') as Readonly<Record<string, unknown>>;
}

function makeInputReceipt(
  mode: 'closure' | 'evaluation',
  inputs: Readonly<Record<string, unknown>>,
): C120CourseReplayInputReceipt {
  const request = {
    mode,
    inputs: cloneCanonical(inputs, `${mode} inputs`),
    units: cloneCanonical(C120_COURSE_REPLAY_UNITS, `${mode} units`),
  } as const;
  return {
    kind: 'canonical-input-receipt',
    mode,
    sha256: sha256(request),
    request,
  };
}

function makeOutputReceipt(
  mode: 'closure' | 'evaluation',
  inputReceipt: C120CourseReplayInputReceipt,
  output: Readonly<Record<string, unknown>>,
): C120CourseReplayOutputReceipt {
  return {
    kind: 'canonical-output-receipt',
    mode,
    inputSha256: inputReceipt.sha256,
    sha256: sha256({ inputSha256: inputReceipt.sha256, output }),
    output,
  };
}

function canonicalPower(output: Readonly<Record<string, unknown>>): number {
  const accounting = record(output.system_accounting, 'closure output.system_accounting');
  return finiteNumber(accounting.system_consumed_power_w, 'closure output.system_accounting.system_consumed_power_w');
}

function canonicalRate(output: Readonly<Record<string, unknown>>): number {
  const accounting = record(output.system_accounting, 'closure output.system_accounting');
  return finiteNumber(accounting.system_throughput_bps, 'closure output.system_accounting.system_throughput_bps');
}

function evaluationContribution(
  step: TraceStep,
  output: Readonly<Record<string, unknown>>,
): C120CourseReplayClosureStepReceipt['evaluationContribution'] {
  const canonicalRateBps = canonicalRate(output);
  const canonicalPowerW = canonicalPower(output);
  if (step.state === 'active') {
    return {
      rateBps: canonicalRateBps,
      powerW: canonicalPowerW,
      durationSec: step.durationSec,
      powerSource: 'canonical-closure',
      coursePowerW: null,
      canonicalSwitchPowerW: 0,
    };
  }
  if (canonicalRateBps !== 0) return fail('CANONICAL_OUTPUT_INVALID', `${step.state} closure produced non-zero throughput`);
  const coursePowerW = coursePowerFor(step.state);
  return {
    rateBps: 0,
    powerW: coursePowerW + canonicalPowerW,
    durationSec: step.durationSec,
    powerSource: canonicalPowerW === 0 ? 'course-assumption' : 'course-assumption-plus-canonical-switch',
    coursePowerW,
    canonicalSwitchPowerW: canonicalPowerW,
  };
}

async function runClosureStep(
  adapter: C120CourseReplayCanonicalAdapter,
  stepIndex: number,
  step: TraceStep,
): Promise<C120CourseReplayClosureStepReceipt> {
  const inputs = closureInputs(step);
  const inputReceipt = makeInputReceipt('closure', inputs);
  let rawOutput: unknown;
  try {
    rawOutput = await adapter.run({ mode: 'closure', inputs, units: C120_CANONICAL_UNITS });
  } catch (error) {
    return fail('CANONICAL_EXECUTION_FAILED', error instanceof Error ? error.message : String(error));
  }
  const output = validateClosureOutput(rawOutput);
  const outputReceipt = makeOutputReceipt('closure', inputReceipt, output);
  return {
    stepIndex,
    state: step.state,
    marker: step.marker,
    durationSec: step.durationSec,
    geometry: { thetaRad: step.thetaRad, servingBeam: step.servingBeam },
    switchIndicator: step.switchIndicator,
    inputReceipt,
    outputReceipt,
    evaluationContribution: evaluationContribution(step, output),
  };
}

async function runEvaluation(
  adapter: C120CourseReplayCanonicalAdapter,
  steps: readonly C120CourseReplayClosureStepReceipt[],
): Promise<C120CourseReplayEvaluationReceipt> {
  const derivedFrom = steps.map(step => ({
    stepIndex: step.stepIndex,
    state: step.state,
    rateBps: step.evaluationContribution.rateBps,
    powerW: step.evaluationContribution.powerW,
    durationSec: step.evaluationContribution.durationSec,
    powerSource: step.evaluationContribution.powerSource,
  }));
  const inputs = {
    step_throughputs_bps: derivedFrom.map(step => step.rateBps),
    step_consumed_power_w: derivedFrom.map(step => step.powerW),
    step_duration_s: derivedFrom.map(step => step.durationSec),
  };
  const inputReceipt = makeInputReceipt('evaluation', inputs);
  let rawOutput: unknown;
  try {
    rawOutput = await adapter.run({ mode: 'evaluation', inputs, units: C120_CANONICAL_UNITS });
  } catch (error) {
    return fail('CANONICAL_EXECUTION_FAILED', error instanceof Error ? error.message : String(error));
  }
  const output = validateEvaluationOutput(rawOutput, inputs);
  return {
    inputReceipt,
    outputReceipt: makeOutputReceipt('evaluation', inputReceipt, output),
    derivedFrom,
  };
}

export async function produceC120CourseReplay(
  value: C120CourseReplayRequest,
  canonicalAdapter: C120CourseReplayCanonicalAdapter,
): Promise<C120CourseReplayReceipt> {
  if (canonicalAdapter === null || typeof canonicalAdapter !== 'object' || typeof canonicalAdapter.run !== 'function') return fail('CANONICAL_EXECUTION_FAILED', 'canonical runtime adapter is unavailable');
  const request = validateRequest(value);
  const trace = traceForAction(request.action);
  const closureSteps: C120CourseReplayClosureStepReceipt[] = [];
  for (let index = 0; index < trace.length; index += 1) closureSteps.push(await runClosureStep(canonicalAdapter, index, trace[index]!));
  const evaluation = await runEvaluation(canonicalAdapter, closureSteps);
  const courseWorkload = courseWorkloadForAction(request.action);
  if (courseWorkload !== null) {
    const horizonSec = closureSteps.reduce((sum, step) => sum + step.durationSec, 0);
    const deliveredBits = Number(evaluation.outputReceipt.output.delivered_bits);
    if (horizonSec !== courseWorkload.horizonSec) return fail('CANONICAL_OUTPUT_INVALID', 'Lab A trace horizon does not match its frozen 150 s horizon');
    if (!closeEnough(deliveredBits, courseWorkload.workloadBits)) return fail('CANONICAL_OUTPUT_INVALID', 'Lab A delivered bits do not match its frozen 1,500,000-bit workload');
  }
  const result = {
    schemaVersion: C120_COURSE_REPLAY_SCHEMA_VERSION,
    producerKind: C120_COURSE_REPLAY_PRODUCER_KIND,
    identity: {
      scenarioId: request.scenarioId,
      providerId: request.providerId,
      sourceSnapshot: request.sourceSnapshot,
      orbitSnapshot: request.orbitSnapshot,
      units: request.units,
    },
    action: request.action,
    courseAssumption: request.courseAssumption,
    claim: C120_COURSE_CLAIM,
    courseWorkload,
    canonicalRuntime: {
      contractVersion: C120_ANGLE_AWARE_CONTRACT_VERSION,
      execution: 'closure-steps-and-evaluation-via-c120-canonical-runtime-adapter',
      productionBinding: 'pinned-runtime-by-adapter',
      runtimeHashProvenance: 'delegated-to-canonical-runtime-adapter',
      producerVerifiesRuntimeHashes: false,
      parityClaim: 'none-beyond-pinned-runtime-call',
    } as const,
    closureSteps,
    evaluation,
  };
  return deepFreeze(cloneCanonical(result, 'course replay receipt'));
}

export function createC120CourseReplayProducer(
  options: Readonly<{ readonly canonicalAdapter: C120CourseReplayCanonicalAdapter }>,
): C120CourseReplayProducer {
  if (options === null || typeof options !== 'object' || options.canonicalAdapter === null || typeof options.canonicalAdapter !== 'object' || typeof options.canonicalAdapter.run !== 'function') return fail('CANONICAL_EXECUTION_FAILED', 'canonical runtime adapter is unavailable');
  const adapter = options.canonicalAdapter;
  return Object.freeze({
    produce: (request: C120CourseReplayRequest): Promise<C120CourseReplayReceipt> => produceC120CourseReplay(request, adapter),
  });
}
