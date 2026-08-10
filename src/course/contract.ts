/**
 * C-90-ENERGY-1 course contract.
 *
 * This is intentionally a data-only seam.  The student route consumes frames
 * and identities from a CourseDataProvider; it never derives a link budget or
 * an energy-efficiency value in the browser.
 */

export const C90_ROUTE = '/course/c90';
export const C90_CONTRACT_VERSION = 'c90-energy-1-fixture-v1';
export const C90_CLAIM_BOUNDARY =
  'SIMULATED TEACHING DATA / NOT LIVE BACKEND / NOT MEASURED / NOT CANONICAL-PARITY-VERIFIED';

export type ProviderKind = 'fixture' | 'stub' | 'canonical-live';
export type ProvenanceClass = 'SOURCE' | 'MODEL-DERIVED' | 'COURSE-ASSUMPTION';
export type ClaimLevel =
  | 'SIMULATED_TEACHING'
  | 'NOT_LIVE_BACKEND'
  | 'NOT_MEASURED'
  | 'NOT_CANONICAL_PARITY_VERIFIED';

export const C90_CLAIM_LEVELS: readonly ClaimLevel[] = [
  'SIMULATED_TEACHING',
  'NOT_LIVE_BACKEND',
  'NOT_MEASURED',
  'NOT_CANONICAL_PARITY_VERIFIED',
];

export type WorldPosition = readonly [number, number, number];

export interface CourseIdentity {
  readonly contractVersion: typeof C90_CONTRACT_VERSION;
  readonly providerKind: ProviderKind;
  readonly providerId: string;
  readonly fixtureId: string;
  readonly scenarioId: string;
  readonly targetUtc: string;
  readonly frameId: string;
}

export interface ScenarioIdentity {
  readonly contractVersion: typeof C90_CONTRACT_VERSION;
  readonly providerKind: ProviderKind;
  readonly providerId: string;
  readonly fixtureId: string;
  readonly scenarioId: string;
  readonly tleSourceId: string;
  readonly targetUtc: string;
}

export interface CourseManifest {
  readonly courseId: 'C-90-ENERGY-1';
  readonly title: string;
  readonly providerKind: ProviderKind;
  readonly providerId: string;
  readonly contractVersion: typeof C90_CONTRACT_VERSION;
  readonly scenario: ScenarioIdentity;
  readonly claimBoundary: typeof C90_CLAIM_BOUNDARY;
  readonly claimLevels: readonly ClaimLevel[];
  readonly availableStages: readonly CourseStage[];
}

export type CourseStage = 'ready' | 'tle' | 'e1' | 'e2' | 'iot' | 'competition' | 'complete';

export type TleSourceRole = 'course-compatible' | 'teaching-comparison';
export type TleSourceMode = 'bundled' | 'imported' | 'fallback';

export interface TleSource {
  readonly sourceId: string;
  readonly sourceKind: 'archive-snapshot';
  readonly constellation: 'oneweb' | 'starlink';
  readonly archiveDate: string;
  readonly archivePath: string;
  readonly archiveSha256: string;
  readonly recordSha256: string;
  readonly objectName: string;
  readonly noradCatalogId: number;
  readonly tleCatalogToken: string;
  readonly epochUtc: string;
  readonly checksumValid: true;
  readonly filename: string;
  readonly label: string;
  readonly shortLabel: string;
  readonly role: TleSourceRole;
  readonly line0: string;
  readonly line1: string;
  readonly line2: string;
  readonly provenance: 'SOURCE';
  readonly note: string;
}

export interface TleStage {
  readonly id: 'source' | 'target-time' | 'propagation' | 'ntpu-frame' | 'scenario';
  readonly title: string;
  readonly input: string;
  readonly transformation: string;
  readonly output: string;
  readonly unit: string;
  readonly purpose: string;
  readonly provenance: ProvenanceClass;
}

export interface TleObserver {
  readonly observerId: string;
  readonly label: string;
  readonly latitudeDeg: number;
  readonly longitudeDeg: number;
  readonly heightKm: number;
  readonly provenance: 'COURSE-ASSUMPTION';
  readonly note: string;
}

export interface TleTimeWindow {
  readonly windowId: 'course-10m' | 'context-30m' | 'context-90m';
  readonly label: string;
  readonly description: string;
  readonly targetUtc: string;
  readonly startUtc: string;
  readonly endUtc: string;
  readonly startOffsetSec: number;
  readonly durationSec: number;
  readonly stepSec: number;
  readonly frameCount: number;
}

export interface TleTrajectoryFrame {
  readonly frameId: string;
  readonly frameIndex: number;
  readonly elapsedSec: number;
  readonly targetUtc: string;
  readonly ageSeconds: number;
  /** Model-output separation from the designated course source, never measured error. */
  readonly modelDeltaFromCourseSourceKm: number;
  readonly temePositionKm: WorldPosition;
  readonly temeVelocityKmPerSec: WorldPosition;
  readonly geodetic: {
    readonly latitudeDeg: number;
    readonly longitudeDeg: number;
    readonly altitudeKm: number;
  };
  readonly look: {
    readonly azimuthDeg: number;
    readonly elevationDeg: number;
    readonly rangeKm: number;
    readonly visible: boolean;
  };
  readonly scene: {
    readonly satellitePosition: WorldPosition;
    readonly observerPosition: WorldPosition;
  };
}

export interface TleTrajectoryBundle {
  readonly schemaVersion: 'tle-trajectory-bundle-v1';
  readonly producerVersion: string;
  readonly model: string;
  readonly bundleId: string;
  readonly sourceId: string;
  readonly sourceRecordSha256: string;
  readonly observerId: string;
  readonly windowId: TleTimeWindow['windowId'];
  readonly startUtc: string;
  readonly endUtc: string;
  readonly stepSec: number;
  readonly frames: readonly TleTrajectoryFrame[];
}

export interface TleExternalSource {
  readonly sourceId: string;
  readonly label: string;
  readonly url: string;
  readonly accessNote: string;
}

export interface TleJourney {
  readonly schemaVersion: 'c90-tle-study-v1';
  readonly source: TleSource;
  readonly sources: readonly TleSource[];
  readonly windows: readonly TleTimeWindow[];
  readonly trajectoryBundles: readonly TleTrajectoryBundle[];
  readonly observer: TleObserver;
  readonly defaultSourceId: string;
  readonly courseSourceId: string;
  readonly defaultWindowId: TleTimeWindow['windowId'];
  readonly externalSources: readonly TleExternalSource[];
  readonly archiveCatalogCommand: string;
  readonly updateCommand: string;
  readonly generationCommand: string;
  readonly boundary: string;
  readonly targetUtc: string;
  readonly stages: readonly TleStage[];
  readonly scenario: ScenarioIdentity;
}

export const C90_TLE_STAGE_ORDER: readonly TleStage['id'][] = Object.freeze([
  'source',
  'target-time',
  'propagation',
  'ntpu-frame',
  'scenario',
]);

export type ServiceStatus = 'served' | 'deadline-missed' | 'expired';

export interface CourseSceneFrame {
  readonly identity: CourseIdentity;
  readonly frameIndex: number;
  readonly elapsedSec: number;
  readonly satellite: {
    readonly id: string;
    readonly position: WorldPosition;
    readonly altitudeKm: number;
  };
  readonly beam: {
    readonly id: string;
    readonly position: WorldPosition;
    readonly qualityLabel: string;
    readonly trendLabel: string;
  };
  readonly link: {
    readonly servingBeamId: string;
    readonly visible: boolean;
    readonly rangeKm: number;
    readonly azimuthDeg: number;
    readonly elevationDeg: number;
  };
  readonly service: {
    readonly rateMbps: number;
    readonly deliveredDataMbit: number;
    readonly deadlineSec: number;
    readonly status: ServiceStatus;
  };
  readonly energy: {
    readonly powerW: number;
    readonly energyJ: number;
    readonly eeMbitPerJ: number;
  };
}

/**
 * Field units are part of the Phase-1 schema.  They describe fixture values;
 * they are not an instruction for the browser to calculate a scientific model.
 */
export const C90_FRAME_UNITS = Object.freeze({
  elapsedSec: 's',
  satelliteAltitudeKm: 'km',
  rangeKm: 'km',
  azimuthDeg: 'deg',
  elevationDeg: 'deg',
  rateMbps: 'Mbit/s',
  deliveredDataMbit: 'Mbit',
  deadlineSec: 's',
  powerW: 'W',
  energyJ: 'J',
  eeMbitPerJ: 'Mbit/J',
} as const);

export interface CourseOutcome {
  readonly completionSec: number;
  readonly deadlineSec: number;
  readonly serviceStatus: ServiceStatus;
  readonly deliveredDataMbit: number;
  readonly powerW: number;
  readonly energyJ: number;
  readonly eeMbitPerJ: number;
}

export type E1ArmId = 'balanced' | 'low-power' | 'fast-finish';

export interface E1Arm {
  readonly id: E1ArmId;
  readonly label: string;
  readonly shortLabel: string;
  readonly changedPolicy: string;
  readonly learnerPrompt: string;
  readonly frames: readonly CourseSceneFrame[];
  readonly outcome: CourseOutcome;
}

export interface E1Experiment {
  readonly id: 'E1';
  readonly question: string;
  readonly scenario: ScenarioIdentity;
  readonly payloadMbit: number;
  readonly deadlineSec: number;
  readonly arms: readonly E1Arm[];
  readonly invariant: string;
}

export type E2Action = 'switch-now' | 'wait' | 'remain';

export interface E2Branch {
  readonly action: E2Action;
  readonly label: string;
  readonly plainLanguageRule: string;
  readonly frames: readonly CourseSceneFrame[];
  readonly outcome: CourseOutcome;
}

export interface E2Trace {
  readonly id: 'trace-a' | 'trace-b';
  readonly title: string;
  readonly trend: string;
  readonly changedInput: string;
  readonly branches: readonly E2Branch[];
}

export interface E2Experiment {
  readonly id: 'E2';
  readonly question: string;
  readonly scenario: ScenarioIdentity;
  readonly traceA: E2Trace;
  readonly traceB: E2Trace;
  readonly invariant: string;
}

export interface IoTTaskCard {
  readonly id: 'alarm' | 'environment' | 'bulk';
  readonly label: string;
  readonly arrivalSec: number;
  readonly window: string;
  readonly freshnessGoal: string;
  readonly value: string;
}

export type IoTVersion = 'baseline' | 'learner' | 'revision';
export type IoTTaskStatus = 'delivered-fresh' | 'delivered-stale' | 'expired';

export interface IoTTaskResult {
  readonly taskId: IoTTaskCard['id'];
  readonly status: IoTTaskStatus;
  readonly deliveredMbit: number;
}

export interface IoTRun {
  readonly version: IoTVersion;
  readonly label: string;
  readonly rule: string;
  readonly taskResults: readonly IoTTaskResult[];
  readonly deliveredDataMbit: number;
  readonly expiredCount: number;
  readonly freshCount: number;
  readonly activeTimeSec: number;
  readonly energyJ: number;
  readonly eeMbitPerJ: number;
  readonly frame: CourseSceneFrame;
}

export interface IoTChallenge {
  readonly id: 'IOT-CHALLENGE';
  readonly question: string;
  readonly scenario: ScenarioIdentity;
  readonly tasks: readonly IoTTaskCard[];
  readonly windows: readonly string[];
  readonly runs: readonly IoTRun[];
  readonly invariant: string;
}

export interface IdeaCard {
  readonly sensedData: string;
  readonly stateToPredict: string;
  readonly baseline: string;
  readonly controlAction: string;
  readonly powerTimePathway: string;
  readonly energyIndicator: string;
  readonly serviceConstraint: string;
  readonly falsifier: string;
}

export interface E1Record {
  readonly prediction: string;
  readonly checkpointUpdate: string;
  readonly armOrder: readonly E1ArmId[];
  readonly completedArmIds: readonly E1ArmId[];
  readonly selectedArm: E1ArmId | null;
  readonly verdict: 'accept' | 'qualify' | 'reject' | null;
  readonly explanation: string;
}

export interface E2Record {
  readonly prediction: string;
  readonly traceAAction: E2Action | null;
  readonly traceAReplayAction: E2Action | null;
  readonly traceBAction: E2Action | null;
  readonly frozenRule: string;
  readonly verdict: 'accept' | 'qualify' | 'reject' | null;
  readonly explanation: string;
}

export interface IoTRecord {
  readonly prediction: string;
  readonly selectedRule: string;
  readonly revisedRule: string;
  readonly verdict: 'accept' | 'qualify' | 'reject' | null;
  readonly explanation: string;
}

export interface TleRecord {
  readonly explanation: string;
  readonly selectedSourceId: string;
  readonly selectedWindowId: TleTimeWindow['windowId'];
  readonly selectedFrameIndex: number;
  readonly sourceMode: TleSourceMode;
  readonly sourceConfirmed: boolean;
  readonly importedFilename: string | null;
  readonly fallbackUsed: boolean;
}

export interface LearningBundleInput {
  readonly exportedAt: string;
  readonly sessionId: string;
  readonly readyCheckCompleted: boolean;
  readonly tle: TleRecord;
  readonly e1: E1Record;
  readonly e2: E2Record;
  readonly iot: IoTRecord;
  readonly ideaCard: IdeaCard;
}

export interface LearningBundle {
  readonly bundleVersion: 'c90-learning-bundle-v1';
  readonly sessionId: string;
  readonly exportedAt: string;
  readonly readyCheckCompleted: boolean;
  readonly course: CourseManifest;
  readonly scenario: ScenarioIdentity;
  readonly claimBoundary: typeof C90_CLAIM_BOUNDARY;
  readonly provenance: {
    readonly providerId: string;
    readonly fixtureId: string;
    readonly deterministicReplay: true;
    readonly source: 'fixture-provider';
  };
  readonly prediction: {
    readonly tle: string;
    readonly e1: string;
    readonly e2: string;
    readonly iot: string;
  };
  readonly tle: TleRecord & {
    readonly source: TleSource;
    readonly window: TleTimeWindow;
    readonly observer: TleObserver;
    readonly trajectory: {
      readonly bundleId: string;
      readonly producerVersion: string;
      readonly model: string;
      readonly frame: TleTrajectoryFrame;
    };
    readonly comparisonsAtTarget: readonly {
      readonly sourceId: string;
      readonly archiveDate: string;
      readonly epochUtc: string;
      readonly ageSeconds: number;
      readonly modelDeltaFromCourseSourceKm: number;
    }[];
    readonly stages: readonly TleStage[];
  };
  readonly e1: E1Record & { readonly arms: readonly E1Arm[] };
  readonly e2: E2Record & { readonly traceA: E2Trace; readonly traceB: E2Trace };
  readonly iot: IoTRecord & { readonly tasks: readonly IoTTaskCard[]; readonly runs: readonly IoTRun[] };
  readonly ideaCard: IdeaCard;
}

export interface CourseDataProvider {
  readonly kind: ProviderKind;
  readonly providerId: string;
  getManifest(): CourseManifest;
  getTleJourney(): TleJourney;
  getE1Experiment(): E1Experiment;
  getE2Experiment(): E2Experiment;
  getIoTChallenge(): IoTChallenge;
  buildLearningBundle(input: LearningBundleInput): LearningBundle;
}

export class CourseContractError extends Error {
  constructor(message: string) {
    super(`C-90 contract violation: ${message}`);
    this.name = 'CourseContractError';
  }
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function record(value: unknown, label: string): UnknownRecord {
  if (!isRecord(value)) throw new CourseContractError(`${label} is missing or not an object`);
  return value;
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new CourseContractError(`${label} is missing or empty`);
  }
  return value;
}

function finiteNumber(value: unknown, label: string, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum) {
    throw new CourseContractError(`${label} must be finite and >= ${minimum}`);
  }
  return value;
}

function positiveNumber(value: unknown, label: string): number {
  return finiteNumber(value, label, Number.MIN_VALUE);
}

function integerValue(value: unknown, label: string, minimum = 0): number {
  const number = finiteNumber(value, label, minimum);
  if (!Number.isInteger(number)) throw new CourseContractError(`${label} must be an integer`);
  return number;
}

function booleanValue(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new CourseContractError(`${label} must be boolean`);
  return value;
}

function arrayValue(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new CourseContractError(`${label} is missing or not an array`);
  return value;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new CourseContractError(`${label} has an unsupported value`);
  }
  return value as T;
}

function utcValue(value: unknown, label: string): string {
  const utc = stringValue(value, label);
  if (!utc.endsWith('Z') || !Number.isFinite(Date.parse(utc))) {
    throw new CourseContractError(`${label} must be a parseable UTC timestamp ending in Z`);
  }
  return utc;
}

function sameIdentity(actual: ScenarioIdentity, expected: ScenarioIdentity, label: string): void {
  const keys: readonly (keyof ScenarioIdentity)[] = [
    'contractVersion',
    'providerKind',
    'providerId',
    'fixtureId',
    'scenarioId',
    'tleSourceId',
    'targetUtc',
  ];
  for (const key of keys) {
    if (actual[key] !== expected[key]) {
      throw new CourseContractError(`${label}.${key} does not match the manifest scenario`);
    }
  }
}

function assertProviderKind(value: unknown, label: string): ProviderKind {
  return enumValue(value, ['fixture', 'stub', 'canonical-live'], label);
}

function assertProvenance(value: unknown, label: string): ProvenanceClass {
  return enumValue(value, ['SOURCE', 'MODEL-DERIVED', 'COURSE-ASSUMPTION'], label);
}

export function assertScenarioIdentity(value: unknown, label = 'scenario'): asserts value is ScenarioIdentity {
  const candidate = record(value, label);
  if (candidate.contractVersion !== C90_CONTRACT_VERSION) {
    throw new CourseContractError(`${label}.contractVersion is not ${C90_CONTRACT_VERSION}`);
  }
  assertProviderKind(candidate.providerKind, `${label}.providerKind`);
  stringValue(candidate.providerId, `${label}.providerId`);
  stringValue(candidate.fixtureId, `${label}.fixtureId`);
  stringValue(candidate.scenarioId, `${label}.scenarioId`);
  stringValue(candidate.tleSourceId, `${label}.tleSourceId`);
  utcValue(candidate.targetUtc, `${label}.targetUtc`);
}

export function assertCourseIdentity(
  value: unknown,
  expectedScenario: ScenarioIdentity,
  label = 'frame.identity',
): asserts value is CourseIdentity {
  const candidate = record(value, label);
  if (candidate.contractVersion !== C90_CONTRACT_VERSION) {
    throw new CourseContractError(`${label}.contractVersion is not ${C90_CONTRACT_VERSION}`);
  }
  assertProviderKind(candidate.providerKind, `${label}.providerKind`);
  stringValue(candidate.providerId, `${label}.providerId`);
  stringValue(candidate.fixtureId, `${label}.fixtureId`);
  stringValue(candidate.scenarioId, `${label}.scenarioId`);
  utcValue(candidate.targetUtc, `${label}.targetUtc`);
  stringValue(candidate.frameId, `${label}.frameId`);
  if (
    candidate.providerKind !== expectedScenario.providerKind
    || candidate.providerId !== expectedScenario.providerId
    || candidate.fixtureId !== expectedScenario.fixtureId
    || candidate.scenarioId !== expectedScenario.scenarioId
    || candidate.targetUtc !== expectedScenario.targetUtc
  ) {
    throw new CourseContractError(`${label} does not match the manifest scenario identity`);
  }
}

export function assertCourseManifest(
  value: unknown,
  expectedProvider?: Pick<CourseDataProvider, 'kind' | 'providerId'>,
  label = 'manifest',
): asserts value is CourseManifest {
  const candidate = record(value, label);
  if (candidate.courseId !== 'C-90-ENERGY-1') throw new CourseContractError(`${label}.courseId is not C-90-ENERGY-1`);
  stringValue(candidate.title, `${label}.title`);
  assertProviderKind(candidate.providerKind, `${label}.providerKind`);
  stringValue(candidate.providerId, `${label}.providerId`);
  if (candidate.contractVersion !== C90_CONTRACT_VERSION) {
    throw new CourseContractError(`${label}.contractVersion is not ${C90_CONTRACT_VERSION}`);
  }
  if (candidate.claimBoundary !== C90_CLAIM_BOUNDARY) {
    throw new CourseContractError(`${label}.claimBoundary is not the Phase-1 boundary`);
  }
  const claimLevels = arrayValue(candidate.claimLevels, `${label}.claimLevels`);
  if (claimLevels.length !== C90_CLAIM_LEVELS.length || C90_CLAIM_LEVELS.some(level => !claimLevels.includes(level))) {
    throw new CourseContractError(`${label}.claimLevels are incomplete or reordered`);
  }
  const availableStages = arrayValue(candidate.availableStages, `${label}.availableStages`);
  const requiredStages: readonly CourseStage[] = ['ready', 'tle', 'e1', 'e2', 'iot', 'competition', 'complete'];
  if (requiredStages.some(stage => !availableStages.includes(stage))) {
    throw new CourseContractError(`${label}.availableStages are incomplete`);
  }
  assertScenarioIdentity(candidate.scenario, `${label}.scenario`);
  if (candidate.providerKind !== (candidate.scenario as ScenarioIdentity).providerKind
    || candidate.providerId !== (candidate.scenario as ScenarioIdentity).providerId) {
    throw new CourseContractError(`${label} and ${label}.scenario disagree on provider identity`);
  }
  if (expectedProvider !== undefined && (
    candidate.providerKind !== expectedProvider.kind
    || candidate.providerId !== expectedProvider.providerId
  )) {
    throw new CourseContractError(`${label} does not match the CourseDataProvider identity`);
  }
}

function assertWorldPosition(value: unknown, label: string): void {
  const position = arrayValue(value, label);
  if (position.length !== 3) throw new CourseContractError(`${label} must contain exactly three coordinates`);
  position.forEach((coordinate, index) => finiteNumber(coordinate, `${label}[${index}]`, Number.NEGATIVE_INFINITY));
}

export function assertCourseSceneFrame(
  value: unknown,
  expectedScenario: ScenarioIdentity,
  label = 'frame',
): asserts value is CourseSceneFrame {
  const candidate = record(value, label) as unknown as CourseSceneFrame;
  assertCourseIdentity(candidate.identity, expectedScenario, `${label}.identity`);
  integerValue(candidate.frameIndex, `${label}.frameIndex`);
  finiteNumber(candidate.elapsedSec, `${label}.elapsedSec`);
  const satellite = record(candidate.satellite, `${label}.satellite`);
  stringValue(satellite.id, `${label}.satellite.id`);
  assertWorldPosition(satellite.position, `${label}.satellite.position`);
  positiveNumber(satellite.altitudeKm, `${label}.satellite.altitudeKm`);
  const beam = record(candidate.beam, `${label}.beam`);
  stringValue(beam.id, `${label}.beam.id`);
  assertWorldPosition(beam.position, `${label}.beam.position`);
  stringValue(beam.qualityLabel, `${label}.beam.qualityLabel`);
  stringValue(beam.trendLabel, `${label}.beam.trendLabel`);
  const link = record(candidate.link, `${label}.link`);
  stringValue(link.servingBeamId, `${label}.link.servingBeamId`);
  if (link.servingBeamId !== beam.id) throw new CourseContractError(`${label}.link.servingBeamId disagrees with beam.id`);
  booleanValue(link.visible, `${label}.link.visible`);
  positiveNumber(link.rangeKm, `${label}.link.rangeKm`);
  const azimuth = finiteNumber(link.azimuthDeg, `${label}.link.azimuthDeg`);
  const elevation = finiteNumber(link.elevationDeg, `${label}.link.elevationDeg`);
  if (azimuth >= 360) throw new CourseContractError(`${label}.link.azimuthDeg is outside ${C90_FRAME_UNITS.azimuthDeg} range`);
  if (elevation > 90) throw new CourseContractError(`${label}.link.elevationDeg is outside ${C90_FRAME_UNITS.elevationDeg} range`);
  const service = record(candidate.service, `${label}.service`);
  finiteNumber(service.rateMbps, `${label}.service.rateMbps`);
  const deliveredData = finiteNumber(service.deliveredDataMbit, `${label}.service.deliveredDataMbit`);
  const deadline = positiveNumber(service.deadlineSec, `${label}.service.deadlineSec`);
  const status = enumValue(service.status, ['served', 'deadline-missed', 'expired'], `${label}.service.status`);
  if (status !== 'served' && candidate.elapsedSec < deadline) {
    throw new CourseContractError(`${label}.service.status is incompatible with elapsed time`);
  }
  if (candidate.frameIndex > 0 && status === 'served' && deliveredData <= 0) {
    throw new CourseContractError(`${label}.served frame has no delivered ${C90_FRAME_UNITS.deliveredDataMbit}`);
  }
  const energy = record(candidate.energy, `${label}.energy`);
  finiteNumber(energy.powerW, `${label}.energy.powerW`);
  const energyJ = finiteNumber(energy.energyJ, `${label}.energy.energyJ`);
  const ee = finiteNumber(energy.eeMbitPerJ, `${label}.energy.eeMbitPerJ`);
  if (energyJ === 0 && (deliveredData > 0 || ee > 0)) {
    throw new CourseContractError(`${label}.energy has activity with zero ${C90_FRAME_UNITS.energyJ}`);
  }
  if (deliveredData === 0 && ee !== 0) {
    throw new CourseContractError(`${label}.energy.eeMbitPerJ is non-zero without delivered data`);
  }
}

export function assertCourseOutcome(
  value: unknown,
  label = 'outcome',
  expectedDeadlineSec?: number,
): asserts value is CourseOutcome {
  const candidate = record(value, label) as unknown as CourseOutcome;
  const completionSec = finiteNumber(candidate.completionSec, `${label}.completionSec`);
  const deadlineSec = positiveNumber(candidate.deadlineSec, `${label}.deadlineSec`);
  if (expectedDeadlineSec !== undefined && deadlineSec !== expectedDeadlineSec) {
    throw new CourseContractError(`${label}.deadlineSec disagrees with the experiment deadline`);
  }
  const status = enumValue(candidate.serviceStatus, ['served', 'deadline-missed', 'expired'], `${label}.serviceStatus`);
  if (status === 'served' && completionSec > deadlineSec) {
    throw new CourseContractError(`${label}.served outcome completes after its deadline`);
  }
  if (status !== 'served' && completionSec < deadlineSec) {
    throw new CourseContractError(`${label}.non-served outcome completes before its deadline`);
  }
  const deliveredData = finiteNumber(candidate.deliveredDataMbit, `${label}.deliveredDataMbit`);
  finiteNumber(candidate.powerW, `${label}.powerW`);
  const energyJ = finiteNumber(candidate.energyJ, `${label}.energyJ`);
  const ee = finiteNumber(candidate.eeMbitPerJ, `${label}.eeMbitPerJ`);
  if (energyJ === 0 && (deliveredData > 0 || ee > 0)) {
    throw new CourseContractError(`${label} has activity with zero ${C90_FRAME_UNITS.energyJ}`);
  }
  if (deliveredData === 0 && ee !== 0) {
    throw new CourseContractError(`${label}.eeMbitPerJ is non-zero without delivered data`);
  }
}

export function assertCourseFrameSeries(
  value: unknown,
  expectedScenario: ScenarioIdentity,
  expectedOutcome?: CourseOutcome,
  label = 'frames',
): asserts value is readonly CourseSceneFrame[] {
  const frames = arrayValue(value, label);
  if (frames.length === 0) throw new CourseContractError(`${label} is missing frames`);
  const frameIds = new Set<string>();
  let previous: CourseSceneFrame | undefined;
  for (const [index, frame] of frames.entries()) {
    assertCourseSceneFrame(frame, expectedScenario, `${label}/${index}`);
    if (frame.frameIndex !== index) throw new CourseContractError(`${label}/${index}.frameIndex is not sequential`);
    if (frameIds.has(frame.identity.frameId)) throw new CourseContractError(`${label} repeats frame identity ${frame.identity.frameId}`);
    frameIds.add(frame.identity.frameId);
    if (previous !== undefined && (
      frame.elapsedSec <= previous.elapsedSec
      || frame.service.deliveredDataMbit < previous.service.deliveredDataMbit
      || frame.energy.energyJ < previous.energy.energyJ
    )) {
      throw new CourseContractError(`${label}/${index} violates monotonic time/data/energy coherence`);
    }
    previous = frame;
  }
  if (expectedOutcome !== undefined) {
    assertCourseOutcome(expectedOutcome, `${label}.outcome`);
    const finalFrame = frames[frames.length - 1] as CourseSceneFrame;
    if (
      finalFrame.elapsedSec !== expectedOutcome.completionSec
      || finalFrame.service.deadlineSec !== expectedOutcome.deadlineSec
      || finalFrame.service.status !== expectedOutcome.serviceStatus
      || finalFrame.service.deliveredDataMbit !== expectedOutcome.deliveredDataMbit
      || finalFrame.energy.powerW !== expectedOutcome.powerW
      || finalFrame.energy.energyJ !== expectedOutcome.energyJ
      || Math.abs(finalFrame.energy.eeMbitPerJ - expectedOutcome.eeMbitPerJ) > 0.000001
    ) {
      throw new CourseContractError(`${label} disagrees with its fixture-provided outcome`);
    }
  }
}

function assertSha256(value: unknown, label: string): string {
  const hash = stringValue(value, label);
  if (!/^[0-9a-f]{64}$/.test(hash)) throw new CourseContractError(`${label} must be a lowercase SHA-256`);
  return hash;
}

function tleChecksumIsValid(line: string): boolean {
  if (line.length < 69 || !/\d/.test(line[68] ?? '')) return false;
  let checksum = 0;
  for (const character of line.slice(0, 68)) {
    if (/\d/.test(character)) checksum += Number(character);
    if (character === '-') checksum += 1;
  }
  return checksum % 10 === Number(line[68]);
}

function assertTleSource(value: unknown, label: string): TleSource {
  const source = record(value, label) as unknown as TleSource;
  stringValue(source.sourceId, `${label}.sourceId`);
  if (source.sourceKind !== 'archive-snapshot') throw new CourseContractError(`${label}.sourceKind must be archive-snapshot`);
  enumValue(source.constellation, ['oneweb', 'starlink'], `${label}.constellation`);
  if (!/^\d{8}$/.test(stringValue(source.archiveDate, `${label}.archiveDate`))) {
    throw new CourseContractError(`${label}.archiveDate must be YYYYMMDD`);
  }
  stringValue(source.archivePath, `${label}.archivePath`);
  assertSha256(source.archiveSha256, `${label}.archiveSha256`);
  assertSha256(source.recordSha256, `${label}.recordSha256`);
  stringValue(source.objectName, `${label}.objectName`);
  integerValue(source.noradCatalogId, `${label}.noradCatalogId`, 1);
  stringValue(source.tleCatalogToken, `${label}.tleCatalogToken`);
  utcValue(source.epochUtc, `${label}.epochUtc`);
  if (source.checksumValid !== true) throw new CourseContractError(`${label}.checksumValid must be true`);
  const filename = stringValue(source.filename, `${label}.filename`);
  if (!filename.endsWith('.tle')) throw new CourseContractError(`${label}.filename must identify a TLE record`);
  stringValue(source.label, `${label}.label`);
  stringValue(source.shortLabel, `${label}.shortLabel`);
  enumValue(source.role, ['course-compatible', 'teaching-comparison'], `${label}.role`);
  stringValue(source.line0, `${label}.line0`);
  const line1 = stringValue(source.line1, `${label}.line1`);
  const line2 = stringValue(source.line2, `${label}.line2`);
  if (!line1.startsWith('1 ') || !line2.startsWith('2 ') || !tleChecksumIsValid(line1) || !tleChecksumIsValid(line2)) {
    throw new CourseContractError(`${label} must contain checksum-valid TLE line 1 and line 2 records`);
  }
  if (line1.slice(2, 7) !== line2.slice(2, 7) || line1.slice(2, 7).trim() !== source.tleCatalogToken.trim()) {
    throw new CourseContractError(`${label} TLE catalog identity is inconsistent`);
  }
  if (source.provenance !== 'SOURCE') throw new CourseContractError(`${label}.provenance must be SOURCE`);
  const note = stringValue(source.note, `${label}.note`).toLowerCase();
  if ((!note.includes('offline') && !note.includes('離線')) || /https?:\/\//.test(note)) {
    throw new CourseContractError(`${label} must be a bounded offline source`);
  }
  return source;
}

function assertTleObserver(value: unknown, label: string): TleObserver {
  const observer = record(value, label) as unknown as TleObserver;
  stringValue(observer.observerId, `${label}.observerId`);
  stringValue(observer.label, `${label}.label`);
  const latitude = finiteNumber(observer.latitudeDeg, `${label}.latitudeDeg`, -90);
  const longitude = finiteNumber(observer.longitudeDeg, `${label}.longitudeDeg`, -180);
  if (latitude > 90 || longitude > 180) throw new CourseContractError(`${label} latitude/longitude is outside degree range`);
  finiteNumber(observer.heightKm, `${label}.heightKm`, -1);
  if (observer.provenance !== 'COURSE-ASSUMPTION') throw new CourseContractError(`${label}.provenance must be COURSE-ASSUMPTION`);
  stringValue(observer.note, `${label}.note`);
  return observer;
}

function assertTleWindow(value: unknown, expectedTargetUtc: string, label: string): TleTimeWindow {
  const window = record(value, label) as unknown as TleTimeWindow;
  enumValue(window.windowId, ['course-10m', 'context-30m', 'context-90m'], `${label}.windowId`);
  stringValue(window.label, `${label}.label`);
  stringValue(window.description, `${label}.description`);
  const targetUtc = utcValue(window.targetUtc, `${label}.targetUtc`);
  const startUtc = utcValue(window.startUtc, `${label}.startUtc`);
  const endUtc = utcValue(window.endUtc, `${label}.endUtc`);
  if (targetUtc !== expectedTargetUtc || Date.parse(endUtc) <= Date.parse(startUtc)) {
    throw new CourseContractError(`${label} target/start/end UTC is incoherent`);
  }
  const startOffsetSec = integerValue(window.startOffsetSec, `${label}.startOffsetSec`);
  const durationSec = integerValue(window.durationSec, `${label}.durationSec`, 1);
  const stepSec = integerValue(window.stepSec, `${label}.stepSec`, 1);
  const frameCount = integerValue(window.frameCount, `${label}.frameCount`, 2);
  if (
    Date.parse(startUtc) !== Date.parse(targetUtc) + startOffsetSec * 1000
    || Date.parse(endUtc) !== Date.parse(startUtc) + durationSec * 1000
    || frameCount !== Math.floor(durationSec / stepSec) + 1
  ) {
    throw new CourseContractError(`${label} frame/time-window accounting is incoherent`);
  }
  return window;
}

function assertTleTrajectoryFrame(
  value: unknown,
  source: TleSource,
  window: TleTimeWindow,
  index: number,
  label: string,
): TleTrajectoryFrame {
  const frame = record(value, label) as unknown as TleTrajectoryFrame;
  stringValue(frame.frameId, `${label}.frameId`);
  if (frame.frameIndex !== index) throw new CourseContractError(`${label}.frameIndex is not sequential`);
  const elapsedSec = integerValue(frame.elapsedSec, `${label}.elapsedSec`);
  const targetUtc = utcValue(frame.targetUtc, `${label}.targetUtc`);
  const expectedElapsed = window.startOffsetSec + index * window.stepSec;
  const expectedTarget = Date.parse(window.targetUtc) + expectedElapsed * 1000;
  if (elapsedSec !== expectedElapsed || Date.parse(targetUtc) !== expectedTarget) {
    throw new CourseContractError(`${label} is not aligned to its time-window clock`);
  }
  const ageSeconds = finiteNumber(frame.ageSeconds, `${label}.ageSeconds`, Number.NEGATIVE_INFINITY);
  if (ageSeconds !== Math.round((Date.parse(targetUtc) - Date.parse(source.epochUtc)) / 1000)) {
    throw new CourseContractError(`${label}.ageSeconds does not equal targetUtc - epochUtc`);
  }
  finiteNumber(frame.modelDeltaFromCourseSourceKm, `${label}.modelDeltaFromCourseSourceKm`);
  assertWorldPosition(frame.temePositionKm, `${label}.temePositionKm`);
  assertWorldPosition(frame.temeVelocityKmPerSec, `${label}.temeVelocityKmPerSec`);
  const geodetic = record(frame.geodetic, `${label}.geodetic`);
  const latitude = finiteNumber(geodetic.latitudeDeg, `${label}.geodetic.latitudeDeg`, -90);
  const longitude = finiteNumber(geodetic.longitudeDeg, `${label}.geodetic.longitudeDeg`, -180);
  if (latitude > 90 || longitude > 180) throw new CourseContractError(`${label}.geodetic is outside degree range`);
  positiveNumber(geodetic.altitudeKm, `${label}.geodetic.altitudeKm`);
  const look = record(frame.look, `${label}.look`);
  const azimuth = finiteNumber(look.azimuthDeg, `${label}.look.azimuthDeg`);
  const elevation = finiteNumber(look.elevationDeg, `${label}.look.elevationDeg`, -90);
  if (azimuth >= 360 || elevation > 90) throw new CourseContractError(`${label}.look angles are outside degree range`);
  positiveNumber(look.rangeKm, `${label}.look.rangeKm`);
  booleanValue(look.visible, `${label}.look.visible`);
  const scene = record(frame.scene, `${label}.scene`);
  assertWorldPosition(scene.satellitePosition, `${label}.scene.satellitePosition`);
  assertWorldPosition(scene.observerPosition, `${label}.scene.observerPosition`);
  return frame;
}

export function assertTleJourney(
  value: unknown,
  expectedScenario: ScenarioIdentity,
  label = 'tleJourney',
): asserts value is TleJourney {
  const candidate = record(value, label) as unknown as TleJourney;
  if (candidate.schemaVersion !== 'c90-tle-study-v1') throw new CourseContractError(`${label}.schemaVersion is unsupported`);
  const targetUtc = utcValue(candidate.targetUtc, `${label}.targetUtc`);
  if (targetUtc !== expectedScenario.targetUtc) throw new CourseContractError(`${label}.targetUtc disagrees with the manifest scenario`);
  assertScenarioIdentity(candidate.scenario, `${label}.scenario`);
  sameIdentity(candidate.scenario, expectedScenario, `${label}.scenario`);

  const sources = arrayValue(candidate.sources, `${label}.sources`).map((source, index) => assertTleSource(source, `${label}.sources/${index}`));
  if (sources.length < 2) throw new CourseContractError(`${label}.sources must include a course source and an age comparison`);
  const sourceIds = new Set(sources.map(source => source.sourceId));
  if (sourceIds.size !== sources.length) throw new CourseContractError(`${label}.sources repeat a sourceId`);
  const defaultSourceId = stringValue(candidate.defaultSourceId, `${label}.defaultSourceId`);
  const courseSourceId = stringValue(candidate.courseSourceId, `${label}.courseSourceId`);
  const courseSource = sources.find(source => source.sourceId === courseSourceId);
  if (
    defaultSourceId !== courseSourceId
    || courseSourceId !== expectedScenario.tleSourceId
    || courseSource?.role !== 'course-compatible'
    || sources.filter(source => source.role === 'course-compatible').length !== 1
  ) {
    throw new CourseContractError(`${label} must expose exactly one manifest-compatible default source`);
  }
  const source = assertTleSource(candidate.source, `${label}.source`);
  if (source.sourceId !== defaultSourceId || !sourceIds.has(source.sourceId)) {
    throw new CourseContractError(`${label}.source is not its declared default source`);
  }

  const observer = assertTleObserver(candidate.observer, `${label}.observer`);
  const windows = arrayValue(candidate.windows, `${label}.windows`).map((window, index) => assertTleWindow(window, targetUtc, `${label}.windows/${index}`));
  const windowIds = new Set(windows.map(window => window.windowId));
  if (windows.length !== 3 || windowIds.size !== windows.length) throw new CourseContractError(`${label}.windows must provide the three bounded presets`);
  const defaultWindowId = enumValue(candidate.defaultWindowId, ['course-10m', 'context-30m', 'context-90m'], `${label}.defaultWindowId`);
  if (defaultWindowId !== 'course-10m' || !windowIds.has(defaultWindowId)) {
    throw new CourseContractError(`${label}.defaultWindowId must select the classroom window`);
  }

  const bundleKeys = new Set<string>();
  const bundles = arrayValue(candidate.trajectoryBundles, `${label}.trajectoryBundles`);
  for (const [bundleIndex, bundleValue] of bundles.entries()) {
    const bundle = record(bundleValue, `${label}.trajectoryBundles/${bundleIndex}`) as unknown as TleTrajectoryBundle;
    if (bundle.schemaVersion !== 'tle-trajectory-bundle-v1') throw new CourseContractError(`${label}.trajectoryBundles/${bundleIndex}.schemaVersion is unsupported`);
    stringValue(bundle.producerVersion, `${label}.trajectoryBundles/${bundleIndex}.producerVersion`);
    stringValue(bundle.model, `${label}.trajectoryBundles/${bundleIndex}.model`);
    stringValue(bundle.bundleId, `${label}.trajectoryBundles/${bundleIndex}.bundleId`);
    const bundleSource = sources.find(sourceCandidate => sourceCandidate.sourceId === bundle.sourceId);
    const bundleWindow = windows.find(windowCandidate => windowCandidate.windowId === bundle.windowId);
    if (bundleSource === undefined || bundleWindow === undefined) throw new CourseContractError(`${label}.trajectoryBundles/${bundleIndex} references an unknown source/window`);
    if (
      bundle.sourceRecordSha256 !== bundleSource.recordSha256
      || bundle.observerId !== observer.observerId
      || bundle.startUtc !== bundleWindow.startUtc
      || bundle.endUtc !== bundleWindow.endUtc
      || bundle.stepSec !== bundleWindow.stepSec
    ) {
      throw new CourseContractError(`${label}.trajectoryBundles/${bundleIndex} identity disagrees with its source/window/observer`);
    }
    const bundleKey = `${bundle.sourceId}/${bundle.windowId}`;
    if (bundleKeys.has(bundleKey)) throw new CourseContractError(`${label}.trajectoryBundles repeat ${bundleKey}`);
    bundleKeys.add(bundleKey);
    const frames = arrayValue(bundle.frames, `${label}.trajectoryBundles/${bundleIndex}.frames`);
    if (frames.length !== bundleWindow.frameCount) throw new CourseContractError(`${label}.trajectoryBundles/${bundleIndex}.frames is incomplete`);
    frames.forEach((frame, frameIndex) => {
      const checked = assertTleTrajectoryFrame(frame, bundleSource, bundleWindow, frameIndex, `${label}.trajectoryBundles/${bundleIndex}.frames/${frameIndex}`);
      if (bundleSource.sourceId === courseSourceId && checked.modelDeltaFromCourseSourceKm > 0.001) {
        throw new CourseContractError(`${label}.trajectoryBundles/${bundleIndex} course-source model delta is not zero`);
      }
    });
  }
  if (bundleKeys.size !== sources.length * windows.length) throw new CourseContractError(`${label}.trajectoryBundles do not cover every source/window pair`);

  const externalSources = arrayValue(candidate.externalSources, `${label}.externalSources`);
  if (externalSources.length < 2) throw new CourseContractError(`${label}.externalSources are missing`);
  externalSources.forEach((sourceValue, index) => {
    const external = record(sourceValue, `${label}.externalSources/${index}`);
    stringValue(external.sourceId, `${label}.externalSources/${index}.sourceId`);
    stringValue(external.label, `${label}.externalSources/${index}.label`);
    const url = stringValue(external.url, `${label}.externalSources/${index}.url`);
    if (!url.startsWith('https://')) throw new CourseContractError(`${label}.externalSources/${index}.url must use HTTPS`);
    stringValue(external.accessNote, `${label}.externalSources/${index}.accessNote`);
  });
  stringValue(candidate.archiveCatalogCommand, `${label}.archiveCatalogCommand`);
  stringValue(candidate.updateCommand, `${label}.updateCommand`);
  stringValue(candidate.generationCommand, `${label}.generationCommand`);
  stringValue(candidate.boundary, `${label}.boundary`);

  const stages = arrayValue(candidate.stages, `${label}.stages`);
  if (stages.length !== C90_TLE_STAGE_ORDER.length) throw new CourseContractError(`${label}.stages must be bounded to the Phase-1 journey`);
  const expectedStageProvenance: readonly ProvenanceClass[] = ['SOURCE', 'COURSE-ASSUMPTION', 'MODEL-DERIVED', 'MODEL-DERIVED', 'COURSE-ASSUMPTION'];
  stages.forEach((stageValue, index) => {
    const stage = record(stageValue, `${label}.stages/${index}`) as unknown as TleStage;
    if (stage.id !== C90_TLE_STAGE_ORDER[index]) throw new CourseContractError(`${label}.stages/${index} is out of order`);
    stringValue(stage.title, `${label}.stages/${index}.title`);
    stringValue(stage.input, `${label}.stages/${index}.input`);
    stringValue(stage.transformation, `${label}.stages/${index}.transformation`);
    stringValue(stage.output, `${label}.stages/${index}.output`);
    stringValue(stage.unit, `${label}.stages/${index}.unit`);
    stringValue(stage.purpose, `${label}.stages/${index}.purpose`);
    const provenance = assertProvenance(stage.provenance, `${label}.stages/${index}.provenance`);
    if (provenance !== expectedStageProvenance[index]) throw new CourseContractError(`${label}.stages/${index}.provenance does not match its bounded stage role`);
  });
  const firstStage = stages[0] as TleStage;
  const targetStage = stages[1] as TleStage;
  const scenarioStage = stages[4] as TleStage;
  if (firstStage.input !== source.filename || targetStage.input !== targetUtc || scenarioStage.output !== expectedScenario.scenarioId) {
    throw new CourseContractError(`${label}.stages do not preserve source/target provenance`);
  }
}

function assertE1Experiment(value: unknown, expectedScenario: ScenarioIdentity, label: string): void {
  const candidate = record(value, label) as unknown as E1Experiment;
  if (candidate.id !== 'E1') throw new CourseContractError(`${label}.id must be E1`);
  stringValue(candidate.question, `${label}.question`);
  stringValue(candidate.invariant, `${label}.invariant`);
  assertScenarioIdentity(candidate.scenario, `${label}.scenario`);
  sameIdentity(candidate.scenario, expectedScenario, `${label}.scenario`);
  positiveNumber(candidate.payloadMbit, `${label}.payloadMbit`);
  const deadlineSec = positiveNumber(candidate.deadlineSec, `${label}.deadlineSec`);
  const arms = arrayValue(candidate.arms, `${label}.arms`);
  if (arms.length === 0) throw new CourseContractError(`${label}.arms is missing`);
  const armIds = new Set<string>();
  for (const [index, armValue] of arms.entries()) {
    const arm = record(armValue, `${label}.arms/${index}`) as unknown as E1Arm;
    enumValue(arm.id, ['balanced', 'low-power', 'fast-finish'], `${label}.arms/${index}.id`);
    if (armIds.has(arm.id)) throw new CourseContractError(`${label} repeats arm ${arm.id}`);
    armIds.add(arm.id);
    stringValue(arm.label, `${label}.arms/${index}.label`);
    stringValue(arm.shortLabel, `${label}.arms/${index}.shortLabel`);
    stringValue(arm.changedPolicy, `${label}.arms/${index}.changedPolicy`);
    stringValue(arm.learnerPrompt, `${label}.arms/${index}.learnerPrompt`);
    assertCourseOutcome(arm.outcome, `${label}.arms/${index}.outcome`, deadlineSec);
    assertCourseFrameSeries(arm.frames, expectedScenario, arm.outcome, `${label}.arms/${index}.frames`);
  }
  const requiredArmIds: readonly E1Arm['id'][] = ['balanced', 'low-power', 'fast-finish'];
  if (armIds.size !== requiredArmIds.length || requiredArmIds.some(armId => !armIds.has(armId))) {
    throw new CourseContractError(`${label}.arms must provide balanced, low-power, and fast-finish branches`);
  }
}

function assertE2Experiment(value: unknown, expectedScenario: ScenarioIdentity, label: string): void {
  const candidate = record(value, label) as unknown as E2Experiment;
  if (candidate.id !== 'E2') throw new CourseContractError(`${label}.id must be E2`);
  stringValue(candidate.question, `${label}.question`);
  stringValue(candidate.invariant, `${label}.invariant`);
  assertScenarioIdentity(candidate.scenario, `${label}.scenario`);
  sameIdentity(candidate.scenario, expectedScenario, `${label}.scenario`);
  const traceIds = new Set<string>();
  const traces: readonly E2Trace[] = [candidate.traceA, candidate.traceB];
  traces.forEach((trace, traceIndex) => {
    const traceRecord = record(trace, `${label}.trace`) as unknown as E2Trace;
    enumValue(traceRecord.id, ['trace-a', 'trace-b'], `${label}.trace.id`);
    const expectedTraceId = traceIndex === 0 ? 'trace-a' : 'trace-b';
    if (traceRecord.id !== expectedTraceId || traceIds.has(traceRecord.id)) {
      throw new CourseContractError(`${label} must provide distinct trace-a then trace-b experiments`);
    }
    traceIds.add(traceRecord.id);
    stringValue(traceRecord.title, `${label}.trace.title`);
    stringValue(traceRecord.trend, `${label}.trace.trend`);
    stringValue(traceRecord.changedInput, `${label}.trace.changedInput`);
    const actions = new Set<string>();
    const branches = arrayValue(traceRecord.branches, `${label}.${traceRecord.id}.branches`);
    if (branches.length === 0) throw new CourseContractError(`${label}.${traceRecord.id}.branches is missing`);
    branches.forEach((branchValue, index) => {
      const branch = record(branchValue, `${label}.${traceRecord.id}.branches/${index}`) as unknown as E2Branch;
      enumValue(branch.action, ['switch-now', 'wait', 'remain'], `${label}.${traceRecord.id}.branches/${index}.action`);
      if (actions.has(branch.action)) throw new CourseContractError(`${label}.${traceRecord.id} repeats ${branch.action}`);
      actions.add(branch.action);
      stringValue(branch.label, `${label}.${traceRecord.id}.branches/${index}.label`);
      stringValue(branch.plainLanguageRule, `${label}.${traceRecord.id}.branches/${index}.plainLanguageRule`);
      assertCourseOutcome(branch.outcome, `${label}.${traceRecord.id}.branches/${index}.outcome`);
      assertCourseFrameSeries(branch.frames, expectedScenario, branch.outcome, `${label}.${traceRecord.id}.branches/${index}.frames`);
    });
    const requiredActions: readonly E2Action[] = ['switch-now', 'wait', 'remain'];
    if (actions.size !== requiredActions.length || requiredActions.some(action => !actions.has(action))) {
      throw new CourseContractError(`${label}.${traceRecord.id}.branches must provide switch-now, wait, and remain`);
    }
  });
}

function assertIoTChallenge(value: unknown, expectedScenario: ScenarioIdentity, label: string): void {
  const candidate = record(value, label) as unknown as IoTChallenge;
  if (candidate.id !== 'IOT-CHALLENGE') throw new CourseContractError(`${label}.id must be IOT-CHALLENGE`);
  stringValue(candidate.question, `${label}.question`);
  stringValue(candidate.invariant, `${label}.invariant`);
  assertScenarioIdentity(candidate.scenario, `${label}.scenario`);
  sameIdentity(candidate.scenario, expectedScenario, `${label}.scenario`);
  const tasks = arrayValue(candidate.tasks, `${label}.tasks`);
  const taskIds = new Set<string>();
  for (const [index, taskValue] of tasks.entries()) {
    const task = record(taskValue, `${label}.tasks/${index}`) as unknown as IoTTaskCard;
    enumValue(task.id, ['alarm', 'environment', 'bulk'], `${label}.tasks/${index}.id`);
    if (taskIds.has(task.id)) throw new CourseContractError(`${label} repeats task ${task.id}`);
    taskIds.add(task.id);
    stringValue(task.label, `${label}.tasks/${index}.label`);
    finiteNumber(task.arrivalSec, `${label}.tasks/${index}.arrivalSec`);
    stringValue(task.window, `${label}.tasks/${index}.window`);
    stringValue(task.freshnessGoal, `${label}.tasks/${index}.freshnessGoal`);
    stringValue(task.value, `${label}.tasks/${index}.value`);
  }
  const requiredTaskIds: readonly IoTTaskCard['id'][] = ['alarm', 'environment', 'bulk'];
  if (taskIds.size !== requiredTaskIds.length || requiredTaskIds.some(taskId => !taskIds.has(taskId))) {
    throw new CourseContractError(`${label}.tasks must provide alarm, environment, and bulk cards`);
  }
  const windows = arrayValue(candidate.windows, `${label}.windows`);
  if (windows.length === 0 || windows.some((window, index) => typeof window !== 'string' || window.trim() === '')) {
    throw new CourseContractError(`${label}.windows are missing or malformed`);
  }
  const versions = new Set<string>();
  const runs = arrayValue(candidate.runs, `${label}.runs`);
  if (runs.length === 0) throw new CourseContractError(`${label}.runs is missing`);
  runs.forEach((runValue, index) => {
    const run = record(runValue, `${label}.runs/${index}`) as unknown as IoTRun;
    enumValue(run.version, ['baseline', 'learner', 'revision'], `${label}.runs/${index}.version`);
    if (versions.has(run.version)) throw new CourseContractError(`${label} repeats run ${run.version}`);
    versions.add(run.version);
    stringValue(run.label, `${label}.runs/${index}.label`);
    stringValue(run.rule, `${label}.runs/${index}.rule`);
    finiteNumber(run.deliveredDataMbit, `${label}.runs/${index}.deliveredDataMbit`);
    integerValue(run.expiredCount, `${label}.runs/${index}.expiredCount`);
    integerValue(run.freshCount, `${label}.runs/${index}.freshCount`);
    finiteNumber(run.activeTimeSec, `${label}.runs/${index}.activeTimeSec`);
    finiteNumber(run.energyJ, `${label}.runs/${index}.energyJ`);
    finiteNumber(run.eeMbitPerJ, `${label}.runs/${index}.eeMbitPerJ`);
    assertCourseSceneFrame(run.frame, expectedScenario, `${label}.runs/${index}.frame`);
    if (
      run.activeTimeSec !== run.frame.elapsedSec
      || run.deliveredDataMbit !== run.frame.service.deliveredDataMbit
      || run.energyJ !== run.frame.energy.energyJ
      || run.eeMbitPerJ !== run.frame.energy.eeMbitPerJ
    ) {
      throw new CourseContractError(`${label}.runs/${index} disagrees with its frame`);
    }
    const results = arrayValue(run.taskResults, `${label}.runs/${index}.taskResults`);
    let deliveredByTask = 0;
    let freshByTask = 0;
    let expiredByTask = 0;
    const resultIds = new Set<string>();
    results.forEach((resultValue, resultIndex) => {
      const result = record(resultValue, `${label}.runs/${index}.taskResults/${resultIndex}`) as unknown as IoTTaskResult;
      if (!taskIds.has(result.taskId)) throw new CourseContractError(`${label}.runs/${index} references an unknown task`);
      if (resultIds.has(result.taskId)) throw new CourseContractError(`${label}.runs/${index} repeats task ${result.taskId}`);
      resultIds.add(result.taskId);
      enumValue(result.status, ['delivered-fresh', 'delivered-stale', 'expired'], `${label}.runs/${index}.taskResults/${resultIndex}.status`);
      const delivered = finiteNumber(result.deliveredMbit, `${label}.runs/${index}.taskResults/${resultIndex}.deliveredMbit`);
      deliveredByTask += delivered;
      if (result.status === 'delivered-fresh') freshByTask += 1;
      if (result.status === 'expired') expiredByTask += 1;
    });
    if (
      deliveredByTask !== run.deliveredDataMbit
      || freshByTask !== run.freshCount
      || expiredByTask !== run.expiredCount
    ) {
      throw new CourseContractError(`${label}.runs/${index} has task-result accounting incoherence`);
    }
    if (resultIds.size !== taskIds.size || [...taskIds].some(taskId => !resultIds.has(taskId))) {
      throw new CourseContractError(`${label}.runs/${index} must report every task card exactly once`);
    }
  });
  const requiredVersions: readonly IoTVersion[] = ['baseline', 'learner', 'revision'];
  if (versions.size !== requiredVersions.length || requiredVersions.some(version => !versions.has(version))) {
    throw new CourseContractError(`${label}.runs must provide baseline, learner, and revision versions`);
  }
}

export function assertCourseDataProvider(value: unknown): asserts value is CourseDataProvider {
  const candidate = record(value, 'CourseDataProvider');
  const kind = assertProviderKind(candidate.kind, 'CourseDataProvider.kind');
  const providerId = stringValue(candidate.providerId, 'CourseDataProvider.providerId');
  const call = <T>(methodName: keyof CourseDataProvider): T => {
    const method = candidate[methodName];
    if (typeof method !== 'function') throw new CourseContractError(`CourseDataProvider.${String(methodName)} is missing`);
    return (method as () => T).call(value);
  };
  const manifest = call<CourseManifest>('getManifest');
  assertCourseManifest(manifest, { kind, providerId });
  const expectedScenario = manifest.scenario;
  assertTleJourney(call<TleJourney>('getTleJourney'), expectedScenario);
  assertE1Experiment(call<E1Experiment>('getE1Experiment'), expectedScenario, 'E1');
  assertE2Experiment(call<E2Experiment>('getE2Experiment'), expectedScenario, 'E2');
  assertIoTChallenge(call<IoTChallenge>('getIoTChallenge'), expectedScenario, 'IoT');
  const buildLearningBundle = candidate.buildLearningBundle;
  if (typeof buildLearningBundle !== 'function') {
    throw new CourseContractError('CourseDataProvider.buildLearningBundle is missing');
  }
}

/** Validate a provider at the seam while preserving its existing interface. */
export function createValidatedCourseDataProvider(provider: CourseDataProvider): CourseDataProvider {
  assertCourseDataProvider(provider);
  return provider;
}
