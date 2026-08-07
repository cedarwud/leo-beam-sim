import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createObserverContext } from '../src/engine/orbit/index.ts';
import { HandoverManager } from '../src/engine/handover/handover-manager.ts';
import type { HandoverEvent } from '../src/engine/handover/types.ts';
import type { ActiveBeamAssignment, LinkSample } from '../src/engine/signal/types.ts';
import { loadProfile } from '../src/profiles/index.ts';
import {
  resolveMaxTxPowerDbm,
  type GainModel,
  type Profile,
} from '../src/profiles/types.ts';
import {
  applyHandoverPolicyTuning,
  createHandoverPolicyTuningState,
  getHandoverPolicyResetKey,
} from '../src/handoverPolicyTuning.ts';
import {
  applySignalTuning,
  createSignalTuningState,
  getSignalTuningEvidenceKey,
  getSignalTuningResetKey,
} from '../src/signalTuning.ts';
import {
  MODQN_BEAM_COUNT_CLAIM_LABELS,
  getModqnBeamCountBridgeClaim,
} from '../src/modqn/replay-bundle/index.ts';
import {
  createBeamLayoutsByShellId,
  createRuntimeFrameStepState,
  createTrajectoryCache,
  getTrajectoryMaxTimeSec,
  stepRuntimeFrame,
  type RuntimeFrameStepState,
} from '../src/scene/runtimeFrameStep.ts';
import type { BeamCellState, SimFrame } from '../src/scene/types.ts';
import {
  beamAssignmentKey,
  normalizeReplayOffset,
  type CachedSatState,
  type ShellBeamLayout,
} from '../src/scene/simulationHelpers.ts';
import {
  computeFspl as computeCoreFspl,
  computeLinkBudget as computeCoreLinkBudget,
  computeSinr as computeCoreSinr,
} from '../src/core/channel/index.ts';
import { sampleLosStateTr38811 } from '../src/core/channel/los-probability.ts';
import type { ChannelResult, DeploymentEnvironment, LinkBudgetOptions } from '../src/core/channel/types.ts';

type Phase6TStatus =
  | 'SHADOW_COMPARISON_PASS'
  | 'SHADOW_COMPARISON_DRIFT_EXCEEDS_GATE'
  | 'BLOCKED_NEEDS_ADAPTER_REFINEMENT';
type ScanStatus = 'PASS' | 'FAIL';
type ReuseStatus = 'CORE_BACKED' | 'INTENTIONAL_NON_CORE_PARITY' | 'BLOCKED';

interface BaselineWindow {
  epochUtcMs: number;
  startOffsetSec: number;
  loop: boolean;
  frameDtSec: number;
  speed: number;
  frameCount: number;
}

interface NumericSummary {
  count: number;
  min: number | null;
  p05: number | null;
  p50: number | null;
  p95: number | null;
  max: number | null;
  mean: number | null;
}

interface DpcSummary {
  enabled: boolean;
  mode: string | null;
  updatePeriodSec: number | null;
  finalStateCount: number;
  txPowerDbm: NumericSummary | null;
}

interface KpiSummary {
  profileId: string;
  formulaFamily: Profile['formulaFamily'];
  profileClass: Profile['profileClass'];
  window: BaselineWindow & {
    firstFrameSimTimeSec: number | null;
    lastFrameSimTimeSec: number | null;
    frameStepSimSec: number;
  };
  beamConfig: {
    beamCountPerSatellite: number;
    maxActivePerSat: number;
    frequencyReuseK: number;
  };
  samples: {
    totalFrames: number;
    totalLinkSamples: number;
    finiteSinrSamples: number;
    nonFiniteSinrSamples: number;
    lowSinrBelowHandoverThresholdCount: number;
    lowSinrBelowZeroDbCount: number;
    handoverThresholdDb: number;
  };
  finiteSinrDb: NumericSummary;
  handoverEvents: {
    totalCount: number;
    intraSwitchCount: number;
    interHandoverCountRaw: number;
    initialAttachCount: number;
    interHandoverCountExcludingInitialAttach: number;
    initialAttachHandling: string;
    events: Array<{
      timeSec: number;
      action: HandoverEvent['action'];
      from: string | null;
      to: string;
      fromSinrDb: number | null;
      toSinrDb: number;
      deltaDb: number | null;
    }>;
  };
  dpcTxPower: DpcSummary;
  activeBeamSummary: {
    activeAssignmentsPerFrame: NumericSummary;
    activeBeamCellsPerFrame: NumericSummary;
    uniqueActiveAssignmentCount: number;
    uniqueActiveBeamCellCount: number;
    reuseGroupsByActiveAssignment: Record<string, number>;
    reuseGroupsByActiveBeamCell: Record<string, number>;
    reuseGroupSourcesByActiveBeamCell: Record<string, number>;
  };
}

interface Phase6PFixtureFile {
  schemaVersion: string;
  phase: '6P';
  status: string;
  baselines: Array<KpiSummary & { status: string; tuning?: unknown; servingTimeline?: unknown; pendingTargetTimeline?: unknown; recentHoLatchTimeline?: unknown }>;
}

interface Phase6TFixtureFile {
  schemaVersion: string;
  phase: '6T';
  comparisonMode: 'validator-only-source-channel-shadow-kpi';
  requiredProfiles: string[];
  sourceChannelPolicy: {
    adapterVersion: string;
    implementationLoss: 'phase6n-local-pathloss-minus-core-fspl';
    handoverShadow: 'validator-only-shadow-manager';
    dpcPolicy: 'consume-baseline-effective-tx-power-no-shadow-feedback';
    runtimeAdoption: 'not-adopted';
  };
  driftGate: {
    p50FiniteSinrDbAbsTolerance: number;
    lowSinrCountMinToleranceSamples: number;
    lowSinrCountFractionTolerance: number;
    totalHandoverCountAbsTolerance: number;
    intraSwitchCountAbsTolerance: number;
    interHandoverRawExact: true;
    interHandoverExcludingInitialAttachExact: true;
    initialAttachExact: true;
    dpcTxPowerSummaryAbsToleranceDb: number;
    activeMeanAbsTolerance: number;
  };
  allowedPhase6TStatuses: Phase6TStatus[];
}

interface RuntimeScanResult {
  status: ScanStatus;
  leaks: string[];
  scannedPaths: readonly string[];
}

interface ScanResult {
  status: ScanStatus;
  leaks: string[];
  scannedFiles: string[];
}

interface FrameRecord {
  frameIndex: number;
  simTimeSec: number;
  linkSamples: LinkSample[];
  activeAssignments: ActiveBeamAssignment[];
  beamCellsBySatId: Map<string, BeamCellState[]>;
}

interface DeterministicRunner {
  profile: Profile;
  observer: ReturnType<typeof createObserverContext>;
  beamLayoutsByShellId: Map<string, ShellBeamLayout>;
  trajectoryCache: CachedSatState[][];
  hoManager: HandoverManager;
  frameStepState: RuntimeFrameStepState;
}

interface ShadowAdapterDiagnostics {
  blockedReasons: string[];
  kSemantics: Record<string, {
    runtimeFrequencyReuse: number;
    reuseStatus: ReuseStatus;
    sampleCount: number;
    reasons: string[];
  }>;
  maxAbsLinkDiffByField: Record<string, number>;
}

interface DriftMetric {
  field: string;
  before: unknown;
  after: unknown;
  drift: number | null;
  tolerance: number | 'exact';
  status: ScanStatus;
}

interface ThresholdFailure {
  profileId: string;
  field: string;
  before: unknown;
  after: unknown;
  drift: number | null;
  tolerance: number | 'exact';
  reason: string;
}

interface ProfileComparison {
  profileId: string;
  status: 'PASS' | 'DRIFT_EXCEEDS_GATE' | 'BLOCKED_NEEDS_ADAPTER_REFINEMENT';
  before: KpiSummary;
  after: KpiSummary;
  driftMetrics: DriftMetric[];
  failedThresholds: ThresholdFailure[];
  adapterBlockedReasons: string[];
  shadowAdapter: ShadowAdapterDiagnostics;
  shadowKpiExcerpt: {
    finiteSinrSamples: number;
    p50FiniteSinrDb: number | null;
    lowSinrBelowHandoverThresholdCount: number;
    lowSinrBelowZeroDbCount: number;
    handoverEvents: number;
    intraSwitchCount: number;
    interHandoverExcludingInitialAttach: number;
    initialAttachCount: number;
    dpcEnabled: boolean;
  };
}

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const PHASE6P_FIXTURE_PATH = 'scripts/fixtures/modqn-phase6p-hobs-sinr-kpi-baseline.json';
const PHASE6T_FIXTURE_PATH = 'scripts/fixtures/modqn-phase6t-source-channel-shadow-kpi.json';
const VALIDATOR_SCRIPT = 'node --import tsx/esm scripts/validate-modqn-phase6t-source-channel-shadow-kpi.ts';
const SUMMARY_SCHEMA_VERSION = 'phase6t-source-channel-shadow-kpi-summary-v1';
const ADAPTER_VERSION = 'phase6t-source-channel-shadow-adapter-v1';
const MODQN_PHASE_DOC_PREFIX = 'docs/modqn-baseline-';

const DEFAULT_WINDOWS: readonly (BaselineWindow & { profileId: string })[] = [
  {
    profileId: 'hobs-2024-paper-default',
    epochUtcMs: Date.UTC(2026, 0, 1, 0, 0, 0),
    startOffsetSec: 1065,
    loop: true,
    frameDtSec: 0.2,
    speed: 5,
    frameCount: 60,
  },
  {
    profileId: 'hobs-2024-candidate-rich',
    epochUtcMs: Date.UTC(2026, 0, 1, 0, 0, 0),
    startOffsetSec: 450,
    loop: true,
    frameDtSec: 0.2,
    speed: 5,
    frameCount: 60,
  },
  {
    profileId: 'hobs-2024-tr38811-research',
    epochUtcMs: Date.UTC(2026, 0, 1, 0, 0, 0),
    startOffsetSec: 1065,
    loop: true,
    frameDtSec: 0.2,
    speed: 5,
    frameCount: 60,
  },
] as const;

const RUNTIME_NON_ADOPTION_SCAN_PATHS = [
  'src/engine/signal',
  'src/engine/handover',
  'src/scene',
  'src/profiles',
  'src/ui',
  'src/modqn',
  'src/App.tsx',
  'src/signalTuning.ts',
  'src/handoverPolicyTuning.ts',
] as const;

function readRepoFile(relativePath: string): string {
  return readFileSync(join(ROOT_DIR, relativePath), 'utf8');
}

function listRepoFiles(relativePath: string): string[] {
  const fullPath = join(ROOT_DIR, relativePath);
  if (!existsSync(fullPath)) return [];
  const stat = statSync(fullPath);
  if (stat.isFile()) return [relativePath];
  return readdirSync(fullPath)
    .flatMap(entry => listRepoFiles(join(relativePath, entry)))
    .sort((a, b) => a.localeCompare(b));
}

function gitOutput(args: string[]): string | null {
  try {
    return execFileSync('git', args, {
      cwd: ROOT_DIR,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

function round(value: number, digits = 6): number {
  if (!Number.isFinite(value)) return value;
  return Number(value.toFixed(digits));
}

function roundNullable(value: number | null, digits = 6): number | null {
  return value === null ? null : round(value, digits);
}

function percentile(sortedValues: readonly number[], ratio: number): number | null {
  if (sortedValues.length === 0) return null;
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.floor((sortedValues.length - 1) * ratio)),
  );
  return sortedValues[index];
}

function summarizeNumbers(values: readonly number[]): NumericSummary {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  const mean = finite.length === 0
    ? null
    : finite.reduce((sum, value) => sum + value, 0) / finite.length;

  return {
    count: finite.length,
    min: roundNullable(finite[0] ?? null),
    p05: roundNullable(percentile(finite, 0.05)),
    p50: roundNullable(percentile(finite, 0.5)),
    p95: roundNullable(percentile(finite, 0.95)),
    max: roundNullable(finite[finite.length - 1] ?? null),
    mean: roundNullable(mean),
  };
}

function dbmToMw(dbm: number): number {
  if (!Number.isFinite(dbm) || dbm < -300) return 0;
  return 10 ** (dbm / 10);
}

function mwToDbm(milliwatts: number): number {
  if (!Number.isFinite(milliwatts) || milliwatts <= 0) return -Infinity;
  return 10 * Math.log10(milliwatts);
}

function incrementCount(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

function stableRecord(counts: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function keyForAssignment(satId: string | null, beamId: number | null): string {
  return satId && beamId !== null ? `${satId}:B${beamId}` : 'none';
}

function normalizeGainModel(model: GainModel): LinkBudgetOptions['beamGainInput'] extends infer Input
  ? Input extends { model: infer Model } ? Model : never
  : never {
  if (model === 'bessel-j1-j3') return 'bessel-j1j3';
  if (model === 'bessel-j1') return 'bessel-j1';
  return 'flat-debug';
}

function prepareProfile(profileId: string): { baseProfile: Profile; profile: Profile } {
  const baseProfile = loadProfile(profileId);
  const signalTuning = createSignalTuningState(baseProfile);
  const handoverTuning = createHandoverPolicyTuningState(baseProfile);
  const signalTunedProfile = applySignalTuning(baseProfile, signalTuning);
  const profile = applyHandoverPolicyTuning(signalTunedProfile, handoverTuning);
  getSignalTuningEvidenceKey(signalTuning);
  getSignalTuningResetKey(signalTuning);
  getHandoverPolicyResetKey(handoverTuning);
  return { baseProfile, profile };
}

function createRunner(profile: Profile, window: BaselineWindow): DeterministicRunner {
  const observer = createObserverContext(profile.orbit.observerLatDeg, profile.orbit.observerLonDeg);
  const trajectoryCache = createTrajectoryCache(profile, observer, window.epochUtcMs);
  const maxTimeSec = getTrajectoryMaxTimeSec(trajectoryCache);
  const simTimeSec = normalizeReplayOffset(window.startOffsetSec, maxTimeSec, window.loop);
  return {
    profile,
    observer,
    beamLayoutsByShellId: createBeamLayoutsByShellId(profile),
    trajectoryCache,
    hoManager: new HandoverManager(profile.handover),
    frameStepState: createRuntimeFrameStepState(simTimeSec),
  };
}

function stepBaselineRunner(
  runner: DeterministicRunner,
  window: BaselineWindow,
): SimFrame {
  return stepRuntimeFrame({
    profile: runner.profile,
    replay: {
      epochUtcMs: window.epochUtcMs,
      startOffsetSec: window.startOffsetSec,
      loop: window.loop,
    },
    speed: window.speed,
    paused: false,
    deltaSec: window.frameDtSec,
    observer: runner.observer,
    beamLayoutsByShellId: runner.beamLayoutsByShellId,
    trajectoryCache: runner.trajectoryCache,
    hoManager: runner.hoManager,
    state: runner.frameStepState,
  }).frame;
}

function findBeamCell(frame: Pick<FrameRecord, 'beamCellsBySatId'>, assignment: ActiveBeamAssignment): BeamCellState | null {
  return frame.beamCellsBySatId
    .get(assignment.satId)
    ?.find(beam => beam.beamId === assignment.beamId)
    ?? null;
}

function summarizeActiveBeams(frames: readonly FrameRecord[]): KpiSummary['activeBeamSummary'] {
  const activeAssignmentsPerFrame: number[] = [];
  const activeBeamCellsPerFrame: number[] = [];
  const activeAssignmentKeys: string[] = [];
  const activeBeamCellKeys: string[] = [];
  const reuseGroupsByActiveAssignment: Record<string, number> = {};
  const reuseGroupsByActiveBeamCell: Record<string, number> = {};
  const reuseGroupSourcesByActiveBeamCell: Record<string, number> = {};

  for (const frame of frames) {
    activeAssignmentsPerFrame.push(frame.activeAssignments.length);
    const allBeamCells = [...frame.beamCellsBySatId.entries()].flatMap(([satId, beams]) =>
      beams.map(beam => ({ satId, beam })),
    );
    activeBeamCellsPerFrame.push(allBeamCells.length);

    for (const assignment of frame.activeAssignments) {
      activeAssignmentKeys.push(beamAssignmentKey(assignment.satId, assignment.beamId));
      const beam = findBeamCell(frame, assignment);
      incrementCount(reuseGroupsByActiveAssignment, String(beam?.reuseGroup ?? 'missing'));
    }

    for (const { satId, beam } of allBeamCells) {
      activeBeamCellKeys.push(beamAssignmentKey(satId, beam.beamId));
      incrementCount(reuseGroupsByActiveBeamCell, String(beam.reuseGroup ?? 'missing'));
      incrementCount(reuseGroupSourcesByActiveBeamCell, beam.reuseGroupSource ?? 'missing');
    }
  }

  return {
    activeAssignmentsPerFrame: summarizeNumbers(activeAssignmentsPerFrame),
    activeBeamCellsPerFrame: summarizeNumbers(activeBeamCellsPerFrame),
    uniqueActiveAssignmentCount: sortedUnique(activeAssignmentKeys).length,
    uniqueActiveBeamCellCount: sortedUnique(activeBeamCellKeys).length,
    reuseGroupsByActiveAssignment: stableRecord(reuseGroupsByActiveAssignment),
    reuseGroupsByActiveBeamCell: stableRecord(reuseGroupsByActiveBeamCell),
    reuseGroupSourcesByActiveBeamCell: stableRecord(reuseGroupSourcesByActiveBeamCell),
  };
}

function serializeEvents(eventLog: readonly HandoverEvent[]): KpiSummary['handoverEvents']['events'] {
  return eventLog.map(event => ({
    timeSec: round(event.timeMs / 1000),
    action: event.action,
    from: keyForAssignment(event.fromSatId, event.fromBeamId),
    to: keyForAssignment(event.toSatId, event.toBeamId),
    fromSinrDb: roundNullable(event.fromSinrDb),
    toSinrDb: round(event.toSinrDb),
    deltaDb: roundNullable(event.deltaDb),
  }));
}

function summarizeDpc(profile: Profile, runner: DeterministicRunner): DpcSummary {
  const powerControl = profile.channel.beamPowerControl;
  if (profile.formulaFamily !== 'hobs-tr38811' || !powerControl) {
    return {
      enabled: false,
      mode: null,
      updatePeriodSec: null,
      finalStateCount: 0,
      txPowerDbm: null,
    };
  }

  const values = [...runner.frameStepState.beamPowerControlRuntime.statesByKey.values()]
    .map(state => state.txPowerDbm);

  return {
    enabled: true,
    mode: powerControl.mode,
    updatePeriodSec: powerControl.updatePeriodSec,
    finalStateCount: values.length,
    txPowerDbm: summarizeNumbers(values),
  };
}

function summarizeKpis(
  profile: Profile,
  baseProfile: Profile,
  window: BaselineWindow,
  frames: readonly FrameRecord[],
  eventLog: readonly HandoverEvent[],
  dpcTxPower: DpcSummary,
): KpiSummary {
  const allSinrValues = frames.flatMap(frame => frame.linkSamples.map(sample => sample.sinrDb));
  const finiteSinrValues = allSinrValues.filter(Number.isFinite);
  const intraSwitchCount = eventLog.filter(event => event.action === 'intra-switch').length;
  const rawInterHandoverCount = eventLog.filter(event => event.action === 'inter-handover').length;
  const initialAttachCount = eventLog
    .filter(event => event.action === 'inter-handover' && event.fromSatId === null && event.fromBeamId === null)
    .length;

  return {
    profileId: profile.id,
    formulaFamily: profile.formulaFamily,
    profileClass: profile.profileClass,
    window: {
      ...window,
      firstFrameSimTimeSec: roundNullable(frames[0]?.simTimeSec ?? null),
      lastFrameSimTimeSec: roundNullable(frames[frames.length - 1]?.simTimeSec ?? null),
      frameStepSimSec: round(window.frameDtSec * window.speed),
    },
    beamConfig: {
      beamCountPerSatellite: baseProfile.beams.perSatellite,
      maxActivePerSat: baseProfile.beams.maxActivePerSat,
      frequencyReuseK: baseProfile.beams.frequencyReuse,
    },
    samples: {
      totalFrames: frames.length,
      totalLinkSamples: allSinrValues.length,
      finiteSinrSamples: finiteSinrValues.length,
      nonFiniteSinrSamples: allSinrValues.length - finiteSinrValues.length,
      lowSinrBelowHandoverThresholdCount: allSinrValues
        .filter(value => Number.isFinite(value) && value < profile.handover.sinrThresholdDb)
        .length,
      lowSinrBelowZeroDbCount: allSinrValues
        .filter(value => Number.isFinite(value) && value < 0)
        .length,
      handoverThresholdDb: profile.handover.sinrThresholdDb,
    },
    finiteSinrDb: summarizeNumbers(finiteSinrValues),
    handoverEvents: {
      totalCount: eventLog.length,
      intraSwitchCount,
      interHandoverCountRaw: rawInterHandoverCount,
      initialAttachCount,
      interHandoverCountExcludingInitialAttach: rawInterHandoverCount - initialAttachCount,
      initialAttachHandling: 'Initial attach remains separately reported and is not treated as MODQN reward evidence.',
      events: serializeEvents(eventLog),
    },
    dpcTxPower,
    activeBeamSummary: summarizeActiveBeams(frames),
  };
}

function adapterDiagnosticsEntry(
  diagnostics: ShadowAdapterDiagnostics,
  runtimeFrequencyReuse: number,
  reuseStatus: ReuseStatus,
  reason: string | null,
): void {
  const key = `K=${runtimeFrequencyReuse}:${reuseStatus}`;
  const entry = diagnostics.kSemantics[key] ?? {
    runtimeFrequencyReuse,
    reuseStatus,
    sampleCount: 0,
    reasons: [],
  };
  entry.sampleCount += 1;
  if (reason) entry.reasons.push(reason);
  diagnostics.kSemantics[key] = entry;
}

function resolveReuseStatus(
  beam: BeamCellState | null,
  diagnostics: ShadowAdapterDiagnostics,
  sampleKey: string,
): ReuseStatus {
  const runtimeFrequencyReuse = beam?.runtimeFrequencyReuse ?? NaN;
  if (!beam || beam.reuseGroup === undefined || beam.runtimeFrequencyReuse === undefined || !beam.reuseGroupSource) {
    const reason = `${sampleKey}: missing core reuse metadata`;
    diagnostics.blockedReasons.push(reason);
    adapterDiagnosticsEntry(diagnostics, Number.isFinite(runtimeFrequencyReuse) ? runtimeFrequencyReuse : -1, 'BLOCKED', reason);
    return 'BLOCKED';
  }

  if ([1, 3, 7].includes(beam.runtimeFrequencyReuse)) {
    if (beam.reuseGroupSource !== 'core-layout' || beam.coreLayoutFrequencyReuse !== beam.runtimeFrequencyReuse) {
      const reason = `${sampleKey}: K=${beam.runtimeFrequencyReuse} must be core-layout backed`;
      diagnostics.blockedReasons.push(reason);
      adapterDiagnosticsEntry(diagnostics, beam.runtimeFrequencyReuse, 'BLOCKED', reason);
      return 'BLOCKED';
    }
    adapterDiagnosticsEntry(diagnostics, beam.runtimeFrequencyReuse, 'CORE_BACKED', null);
    return 'CORE_BACKED';
  }

  if ([2, 4, 5, 6].includes(beam.runtimeFrequencyReuse)) {
    if (beam.reuseGroupSource !== 'runtime-frequency-reuse-compatibility') {
      const reason = `${sampleKey}: K=${beam.runtimeFrequencyReuse} compatibility case lost intentional non-core label`;
      diagnostics.blockedReasons.push(reason);
      adapterDiagnosticsEntry(diagnostics, beam.runtimeFrequencyReuse, 'BLOCKED', reason);
      return 'BLOCKED';
    }
    adapterDiagnosticsEntry(diagnostics, beam.runtimeFrequencyReuse, 'INTENTIONAL_NON_CORE_PARITY', null);
    return 'INTENTIONAL_NON_CORE_PARITY';
  }

  const reason = `${sampleKey}: unsupported runtime K=${beam.runtimeFrequencyReuse}`;
  diagnostics.blockedReasons.push(reason);
  adapterDiagnosticsEntry(diagnostics, beam.runtimeFrequencyReuse, 'BLOCKED', reason);
  return 'BLOCKED';
}

function shadowLinkBudgetOptions(
  profile: Profile,
  runner: DeterministicRunner,
  frame: SimFrame,
  sample: LinkSample,
  beam: BeamCellState,
): LinkBudgetOptions {
  const sat = frame.satellites.find(candidate => candidate.id === sample.satId);
  if (!sat) {
    throw new Error(`missing satellite ${sample.satId} for shadow sample`);
  }
  const layout = runner.beamLayoutsByShellId.get(sat.shellId);
  const rangeKm = frame.linkRangeKmBySatId.get(sample.satId) ?? sat.topo.rangeKm;
  const beamDiameterKm = layout?.beamDiameterKm
    ?? sat.altitudeKm * Math.tan(profile.antenna.beamwidth3dBRad / 2) * 2;
  const ueDistanceToBeamCenterKm = Math.hypot(beam.offsetEastKm, beam.offsetNorthKm);
  const offAxisAngleDeg = (Math.atan(ueDistanceToBeamCenterKm / Math.max(sat.altitudeKm, 1e-6)) * 180) / Math.PI;
  const bandwidthHz = profile.channel.bandwidthMHz * 1e6;
  const noisePowerDbm = profile.channel.noisePsdDbmHz + 10 * Math.log10(bandwidthHz);
  const implementationLossDb = sample.pathLossDb - computeCoreFspl(rangeKm, profile.channel.frequencyGHz);
  const environment = (profile.channel.tr38811?.environment ?? 'suburban') as DeploymentEnvironment;
  const losSeedKey = `${sample.satId}|${sample.beamId}|${Math.floor(frame.simTimeSec)}`;
  const isLos = profile.formulaFamily === 'hobs-tr38811'
    ? sampleLosStateTr38811(sat.topo.elevationDeg, environment, losSeedKey)
    : true;

  return {
    distanceKm: rangeKm,
    frequencyGhz: profile.channel.frequencyGHz,
    txEirpDbm: sample.txPowerDbm + profile.antenna.maxGainDbi,
    rxAntennaGainDb: profile.ueAntenna.maxGainDbi,
    elevationDeg: sat.topo.elevationDeg,
    environment,
    largeScaleModel: '3gpp-baseline',
    beamGainInput: {
      offAxisAngleDeg,
      model: normalizeGainModel(profile.antenna.model),
      peakGainDbi: profile.antenna.maxGainDbi,
      beamDiameterKm,
      altitudeKm: sat.altitudeKm,
      slantRangeKm: rangeKm,
    },
    noisePowerDbm,
    implementationLossDb,
    tier1LargeScale: false,
    tier2Clutter: false,
    tier3BeamGain: true,
    tier35ScanLoss: true,
    tier4Atmospheric: false,
    tier5Fading: false,
    scanAngleDeg: beam.scanAngleDeg,
    scanMaxAngleDeg: profile.antenna.maxSteeringAngleDeg,
    scanLossMaxDb: profile.antenna.scanLossAtMaxSteeringDb,
    rngNext: null,
    isLos,
  };
}

function computeShadowLinkSamples(
  profile: Profile,
  runner: DeterministicRunner,
  frame: SimFrame,
  diagnostics: ShadowAdapterDiagnostics,
): LinkSample[] {
  const activeKeys = new Set(frame.activeAssignments.map(assignment => beamAssignmentKey(assignment.satId, assignment.beamId)));
  const channelByKey = new Map<string, ChannelResult>();
  const beamByKey = new Map<string, BeamCellState>();
  const baselineByKey = new Map<string, LinkSample>();

  for (const sample of frame.linkSamples) {
    const key = beamAssignmentKey(sample.satId, sample.beamId);
    const beam = frame.beamCellsBySatId
      .get(sample.satId)
      ?.find(candidate => candidate.beamId === sample.beamId)
      ?? null;
    const reuseStatus = resolveReuseStatus(beam, diagnostics, key);
    if (!beam || reuseStatus === 'BLOCKED') continue;
    const channelResult = computeCoreLinkBudget(shadowLinkBudgetOptions(profile, runner, frame, sample, beam));
    channelByKey.set(key, channelResult);
    beamByKey.set(key, beam);
    baselineByKey.set(key, sample);

    for (const [field, actual, expected] of [
      ['rsrpDbm', channelResult.rxPowerDbm, sample.rsrpDbm],
      ['pathLossDb', channelResult.fsplDb + channelResult.implementationLossDb + channelResult.shadowFadingDb + channelResult.clutterLossDb + channelResult.atmosphericDb, sample.pathLossDb],
      ['beamGainDb', channelResult.beamGainDb, sample.beamGainDb],
      ['steeringLossDb', channelResult.scanLossDb, sample.steeringLossDb],
    ] as const) {
      diagnostics.maxAbsLinkDiffByField[field] = Math.max(
        diagnostics.maxAbsLinkDiffByField[field] ?? 0,
        Math.abs(actual - expected),
      );
    }
  }

  const shadowSamples: LinkSample[] = [];
  for (const [key, sample] of baselineByKey.entries()) {
    const channelResult = channelByKey.get(key);
    const beam = beamByKey.get(key);
    if (!channelResult || !beam) continue;

    const intraInterfererPowers: number[] = [];
    const interInterfererPowers: number[] = [];
    for (const [otherKey, otherChannelResult] of channelByKey.entries()) {
      if (otherKey === key || !activeKeys.has(otherKey)) continue;
      const otherBeam = beamByKey.get(otherKey);
      const otherSample = baselineByKey.get(otherKey);
      if (!otherBeam || !otherSample) continue;
      if (otherBeam.reuseGroup !== beam.reuseGroup) continue;
      if (otherSample.satId === sample.satId) {
        intraInterfererPowers.push(otherChannelResult.rxPowerDbm);
      } else {
        interInterfererPowers.push(otherChannelResult.rxPowerDbm);
      }
    }

    const sinrResult = computeCoreSinr({
      associationActive: true,
      servingRxPowerDbm: channelResult.rxPowerDbm,
      noisePowerDbm: sample.noiseDbm,
      intraInterferingRxPowersDbm: intraInterfererPowers,
      interInterferingRxPowersDbm: interInterfererPowers,
    });
    const intraMw = intraInterfererPowers.reduce((sum, value) => sum + dbmToMw(value), 0);
    const interMw = interInterfererPowers.reduce((sum, value) => sum + dbmToMw(value), 0);
    const denominatorDbm = mwToDbm(intraMw + interMw + dbmToMw(sample.noiseDbm));

    const shadowSample: LinkSample = {
      satId: sample.satId,
      beamId: sample.beamId,
      rsrpDbm: channelResult.rxPowerDbm,
      sinrDb: sinrResult.sinrDb,
      signalDbm: sinrResult.signalDbm,
      intraInterferenceDbm: mwToDbm(intraMw),
      interInterferenceDbm: mwToDbm(interMw),
      noiseDbm: sinrResult.noiseDbm,
      denominatorDbm,
      txPowerDbm: sample.txPowerDbm,
      pathLossDb: channelResult.fsplDb
        + channelResult.implementationLossDb
        + channelResult.shadowFadingDb
        + channelResult.clutterLossDb
        + channelResult.atmosphericDb,
      beamGainDb: channelResult.beamGainDb,
      steeringLossDb: channelResult.scanLossDb,
      receiverGainDbi: sample.receiverGainDbi,
    };
    shadowSamples.push(shadowSample);

    for (const [field, actual, expected] of [
      ['sinrDb', shadowSample.sinrDb, sample.sinrDb],
      ['intraInterferenceDbm', shadowSample.intraInterferenceDbm, sample.intraInterferenceDbm],
      ['interInterferenceDbm', shadowSample.interInterferenceDbm, sample.interInterferenceDbm],
      ['denominatorDbm', shadowSample.denominatorDbm, sample.denominatorDbm],
    ] as const) {
      if (Number.isFinite(actual) && Number.isFinite(expected)) {
        diagnostics.maxAbsLinkDiffByField[field] = Math.max(
          diagnostics.maxAbsLinkDiffByField[field] ?? 0,
          Math.abs(actual - expected),
        );
      } else if (actual !== expected) {
        diagnostics.maxAbsLinkDiffByField[field] = Infinity;
      }
    }
  }

  return shadowSamples;
}

function captureProfileComparison(
  profileId: string,
  window: BaselineWindow,
  phase6PFixtureBaseline: KpiSummary,
  phase6TFixture: Phase6TFixtureFile,
): ProfileComparison {
  const { baseProfile, profile } = prepareProfile(profileId);
  const runner = createRunner(profile, window);
  const shadowHoManager = new HandoverManager(profile.handover);
  const baselineFrames: FrameRecord[] = [];
  const shadowFrames: FrameRecord[] = [];
  const shadowAdapter: ShadowAdapterDiagnostics = {
    blockedReasons: [],
    kSemantics: {},
    maxAbsLinkDiffByField: {},
  };

  for (let frameIndex = 0; frameIndex < window.frameCount; frameIndex++) {
    const frame = stepBaselineRunner(runner, window);
    const baselineRecord: FrameRecord = {
      frameIndex,
      simTimeSec: frame.simTimeSec,
      linkSamples: frame.linkSamples,
      activeAssignments: [...frame.activeAssignments],
      beamCellsBySatId: frame.beamCellsBySatId,
    };
    baselineFrames.push(baselineRecord);

    const shadowLinkSamples = computeShadowLinkSamples(profile, runner, frame, shadowAdapter);
    if (
      shadowHoManager.state.satId
      && !shadowLinkSamples.some(sample => sample.satId === shadowHoManager.state.satId)
    ) {
      shadowHoManager.clearServing();
    }
    shadowHoManager.update(
      shadowLinkSamples,
      window.frameDtSec * window.speed,
      window.epochUtcMs + frame.simTimeSec * 1000,
    );
    shadowFrames.push({
      frameIndex,
      simTimeSec: frame.simTimeSec,
      linkSamples: shadowLinkSamples,
      activeAssignments: [...frame.activeAssignments],
      beamCellsBySatId: frame.beamCellsBySatId,
    });
  }

  const baselineRecomputed = summarizeKpis(
    profile,
    baseProfile,
    window,
    baselineFrames,
    runner.hoManager.eventLog,
    summarizeDpc(profile, runner),
  );
  const shadowSummary = summarizeKpis(
    profile,
    baseProfile,
    window,
    shadowFrames,
    shadowHoManager.eventLog,
    // Validator-only Phase 6T keeps DPC feedback owned by the baseline frame step.
    summarizeDpc(profile, runner),
  );

  const baselineDriftFailures = compareBaselineFixture(phase6PFixtureBaseline, baselineRecomputed)
    .map(reason => `${profileId}: Phase 6P before snapshot is not comparable: ${reason}`);
  const { driftMetrics, failedThresholds } = compareDriftGate(
    phase6PFixtureBaseline,
    shadowSummary,
    phase6TFixture,
  );
  const adapterBlockedReasons = [
    ...baselineDriftFailures,
    ...shadowAdapter.blockedReasons,
  ];
  const status = adapterBlockedReasons.length > 0
    ? 'BLOCKED_NEEDS_ADAPTER_REFINEMENT'
    : failedThresholds.length > 0
      ? 'DRIFT_EXCEEDS_GATE'
      : 'PASS';

  return {
    profileId,
    status,
    before: phase6PFixtureBaseline,
    after: shadowSummary,
    driftMetrics,
    failedThresholds,
    adapterBlockedReasons,
    shadowAdapter,
    shadowKpiExcerpt: {
      finiteSinrSamples: shadowSummary.samples.finiteSinrSamples,
      p50FiniteSinrDb: shadowSummary.finiteSinrDb.p50,
      lowSinrBelowHandoverThresholdCount: shadowSummary.samples.lowSinrBelowHandoverThresholdCount,
      lowSinrBelowZeroDbCount: shadowSummary.samples.lowSinrBelowZeroDbCount,
      handoverEvents: shadowSummary.handoverEvents.totalCount,
      intraSwitchCount: shadowSummary.handoverEvents.intraSwitchCount,
      interHandoverExcludingInitialAttach: shadowSummary.handoverEvents.interHandoverCountExcludingInitialAttach,
      initialAttachCount: shadowSummary.handoverEvents.initialAttachCount,
      dpcEnabled: shadowSummary.dpcTxPower.enabled,
    },
  };
}

function compareBaselineFixture(expected: KpiSummary, actual: KpiSummary): string[] {
  const failures: string[] = [];
  for (const [field, before, after] of [
    ['window', expected.window, actual.window],
    ['beamConfig', expected.beamConfig, actual.beamConfig],
    ['samples', expected.samples, actual.samples],
    ['finiteSinrDb', expected.finiteSinrDb, actual.finiteSinrDb],
    ['handoverEvents.counts', {
      totalCount: expected.handoverEvents.totalCount,
      intraSwitchCount: expected.handoverEvents.intraSwitchCount,
      interHandoverCountRaw: expected.handoverEvents.interHandoverCountRaw,
      initialAttachCount: expected.handoverEvents.initialAttachCount,
      interHandoverCountExcludingInitialAttach: expected.handoverEvents.interHandoverCountExcludingInitialAttach,
    }, {
      totalCount: actual.handoverEvents.totalCount,
      intraSwitchCount: actual.handoverEvents.intraSwitchCount,
      interHandoverCountRaw: actual.handoverEvents.interHandoverCountRaw,
      initialAttachCount: actual.handoverEvents.initialAttachCount,
      interHandoverCountExcludingInitialAttach: actual.handoverEvents.interHandoverCountExcludingInitialAttach,
    }],
    ['dpcTxPower', {
      enabled: expected.dpcTxPower.enabled,
      mode: expected.dpcTxPower.mode,
      updatePeriodSec: expected.dpcTxPower.updatePeriodSec,
      finalStateCount: expected.dpcTxPower.finalStateCount,
      txPowerDbm: expected.dpcTxPower.txPowerDbm,
    }, {
      enabled: actual.dpcTxPower.enabled,
      mode: actual.dpcTxPower.mode,
      updatePeriodSec: actual.dpcTxPower.updatePeriodSec,
      finalStateCount: actual.dpcTxPower.finalStateCount,
      txPowerDbm: actual.dpcTxPower.txPowerDbm,
    }],
    ['activeBeamSummary', expected.activeBeamSummary, actual.activeBeamSummary],
  ] as const) {
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      failures.push(`${field} drifted from ${PHASE6P_FIXTURE_PATH}`);
    }
  }
  return failures;
}

function pushMetric(
  profileId: string,
  metrics: DriftMetric[],
  failures: ThresholdFailure[],
  field: string,
  before: unknown,
  after: unknown,
  tolerance: number | 'exact',
  reason: string,
): void {
  const drift = typeof before === 'number' && typeof after === 'number'
    ? Math.abs(after - before)
    : null;
  const passed = tolerance === 'exact'
    ? JSON.stringify(before) === JSON.stringify(after)
    : typeof drift === 'number' && drift <= tolerance;
  const metric: DriftMetric = {
    field,
    before,
    after,
    drift: drift === null ? null : round(drift),
    tolerance,
    status: passed ? 'PASS' : 'FAIL',
  };
  metrics.push(metric);
  if (!passed) {
    failures.push({
      profileId,
      field,
      before,
      after,
      drift: metric.drift,
      tolerance,
      reason,
    });
  }
}

function compareNumericSummary(
  profileId: string,
  metrics: DriftMetric[],
  failures: ThresholdFailure[],
  fieldPrefix: string,
  before: NumericSummary,
  after: NumericSummary,
  meanTolerance: number,
): void {
  for (const field of ['count', 'min', 'p50', 'max'] as const) {
    pushMetric(profileId, metrics, failures, `${fieldPrefix}.${field}`, before[field], after[field], 'exact', 'Phase 6S requires exact active-summary count/min/p50/max parity.');
  }
  pushMetric(profileId, metrics, failures, `${fieldPrefix}.mean`, before.mean, after.mean, meanTolerance, 'Phase 6S active-summary mean drift gate exceeded.');
}

function compareDpcPowerSummary(
  profileId: string,
  metrics: DriftMetric[],
  failures: ThresholdFailure[],
  before: DpcSummary,
  after: DpcSummary,
  profile: Profile | null,
  toleranceDb: number,
): void {
  pushMetric(profileId, metrics, failures, 'dpc.enabled', before.enabled, after.enabled, 'exact', 'DPC enabled/disabled state must match by profile.');
  pushMetric(profileId, metrics, failures, 'dpc.mode', before.mode, after.mode, 'exact', 'DPC mode must match by profile.');
  pushMetric(profileId, metrics, failures, 'dpc.updatePeriodSec', before.updatePeriodSec, after.updatePeriodSec, 'exact', 'DPC update period must match by profile.');
  pushMetric(profileId, metrics, failures, 'dpc.finalStateCount', before.finalStateCount, after.finalStateCount, 'exact', 'DPC final state count must match.');

  if (!before.enabled && !after.enabled) return;
  if (!before.txPowerDbm || !after.txPowerDbm) {
    pushMetric(profileId, metrics, failures, 'dpc.txPowerDbm.available', before.txPowerDbm !== null, after.txPowerDbm !== null, 'exact', 'DPC power summary must remain available for DPC profiles.');
    return;
  }

  for (const field of ['min', 'p50', 'max', 'mean'] as const) {
    pushMetric(profileId, metrics, failures, `dpc.txPowerDbm.${field}`, before.txPowerDbm[field], after.txPowerDbm[field], toleranceDb, 'DPC TX-power summary drift gate exceeded.');
  }

  const powerControl = profile?.channel.beamPowerControl;
  if (powerControl && after.txPowerDbm.min !== null && after.txPowerDbm.max !== null) {
    const maxTxPowerDbm = resolveMaxTxPowerDbm(profile.channel);
    if (after.txPowerDbm.min < powerControl.minTxPowerDbm || after.txPowerDbm.max > maxTxPowerDbm) {
      failures.push({
        profileId,
        field: 'dpc.txPowerDbm.bounds',
        before: `${powerControl.minTxPowerDbm}..${maxTxPowerDbm}`,
        after: `${after.txPowerDbm.min}..${after.txPowerDbm.max}`,
        drift: null,
        tolerance: 'exact',
        reason: 'DPC TX-power values must remain within profile power bounds.',
      });
    }
  }
}

function compareDriftGate(
  before: KpiSummary,
  after: KpiSummary,
  phase6TFixture: Phase6TFixtureFile,
): { driftMetrics: DriftMetric[]; failedThresholds: ThresholdFailure[] } {
  const metrics: DriftMetric[] = [];
  const failures: ThresholdFailure[] = [];
  const gate = phase6TFixture.driftGate;
  const profile = existsSync(join(ROOT_DIR, `src/profiles/${before.profileId}.json`))
    ? loadProfile(before.profileId)
    : null;
  const lowSinrTolerance = Math.max(
    gate.lowSinrCountMinToleranceSamples,
    before.samples.finiteSinrSamples * gate.lowSinrCountFractionTolerance,
  );

  for (const field of ['totalFrames', 'totalLinkSamples', 'finiteSinrSamples', 'nonFiniteSinrSamples'] as const) {
    pushMetric(before.profileId, metrics, failures, `samples.${field}`, before.samples[field], after.samples[field], 'exact', 'Phase 6S requires exact sample-count parity.');
  }
  pushMetric(before.profileId, metrics, failures, 'finiteSinrDb.p50', before.finiteSinrDb.p50, after.finiteSinrDb.p50, gate.p50FiniteSinrDbAbsTolerance, 'Phase 6S p50 finite SINR drift gate exceeded.');
  pushMetric(before.profileId, metrics, failures, 'samples.lowSinrBelowHandoverThresholdCount', before.samples.lowSinrBelowHandoverThresholdCount, after.samples.lowSinrBelowHandoverThresholdCount, lowSinrTolerance, 'Phase 6S low-SINR below handover threshold drift gate exceeded.');
  pushMetric(before.profileId, metrics, failures, 'samples.lowSinrBelowZeroDbCount', before.samples.lowSinrBelowZeroDbCount, after.samples.lowSinrBelowZeroDbCount, lowSinrTolerance, 'Phase 6S low-SINR below 0 dB drift gate exceeded.');
  pushMetric(before.profileId, metrics, failures, 'handoverEvents.totalCount', before.handoverEvents.totalCount, after.handoverEvents.totalCount, gate.totalHandoverCountAbsTolerance, 'Phase 6S total handover event drift gate exceeded.');
  pushMetric(before.profileId, metrics, failures, 'handoverEvents.intraSwitchCount', before.handoverEvents.intraSwitchCount, after.handoverEvents.intraSwitchCount, gate.intraSwitchCountAbsTolerance, 'Phase 6S intra-switch event drift gate exceeded.');
  pushMetric(before.profileId, metrics, failures, 'handoverEvents.interHandoverCountRaw', before.handoverEvents.interHandoverCountRaw, after.handoverEvents.interHandoverCountRaw, 'exact', 'Phase 6S requires exact raw inter-handover count.');
  pushMetric(before.profileId, metrics, failures, 'handoverEvents.interHandoverCountExcludingInitialAttach', before.handoverEvents.interHandoverCountExcludingInitialAttach, after.handoverEvents.interHandoverCountExcludingInitialAttach, 'exact', 'Phase 6S requires exact inter-handover count excluding initial attach.');
  pushMetric(before.profileId, metrics, failures, 'handoverEvents.initialAttachCount', before.handoverEvents.initialAttachCount, after.handoverEvents.initialAttachCount, 'exact', 'Phase 6S requires exact initial attach count.');

  compareDpcPowerSummary(
    before.profileId,
    metrics,
    failures,
    before.dpcTxPower,
    after.dpcTxPower,
    profile,
    gate.dpcTxPowerSummaryAbsToleranceDb,
  );
  compareNumericSummary(
    before.profileId,
    metrics,
    failures,
    'activeBeamSummary.activeAssignmentsPerFrame',
    before.activeBeamSummary.activeAssignmentsPerFrame,
    after.activeBeamSummary.activeAssignmentsPerFrame,
    gate.activeMeanAbsTolerance,
  );
  compareNumericSummary(
    before.profileId,
    metrics,
    failures,
    'activeBeamSummary.activeBeamCellsPerFrame',
    before.activeBeamSummary.activeBeamCellsPerFrame,
    after.activeBeamSummary.activeBeamCellsPerFrame,
    gate.activeMeanAbsTolerance,
  );

  for (const [field, baseline, shadow] of [
    ['activeBeamSummary.uniqueActiveAssignmentCount', before.activeBeamSummary.uniqueActiveAssignmentCount, after.activeBeamSummary.uniqueActiveAssignmentCount],
    ['activeBeamSummary.uniqueActiveBeamCellCount', before.activeBeamSummary.uniqueActiveBeamCellCount, after.activeBeamSummary.uniqueActiveBeamCellCount],
    ['activeBeamSummary.reuseGroupsByActiveAssignment', before.activeBeamSummary.reuseGroupsByActiveAssignment, after.activeBeamSummary.reuseGroupsByActiveAssignment],
    ['activeBeamSummary.reuseGroupsByActiveBeamCell', before.activeBeamSummary.reuseGroupsByActiveBeamCell, after.activeBeamSummary.reuseGroupsByActiveBeamCell],
    ['activeBeamSummary.reuseGroupSourcesByActiveBeamCell', before.activeBeamSummary.reuseGroupSourcesByActiveBeamCell, after.activeBeamSummary.reuseGroupSourcesByActiveBeamCell],
  ] as const) {
    pushMetric(before.profileId, metrics, failures, field, baseline, shadow, 'exact', 'Phase 6S requires exact active/reuse summary parity.');
  }

  return { driftMetrics: metrics, failedThresholds: failures };
}

function loadPhase6PFixture(): Phase6PFixtureFile {
  const fixture = JSON.parse(readRepoFile(PHASE6P_FIXTURE_PATH)) as Phase6PFixtureFile;
  if (fixture.schemaVersion !== 'phase6p-hobs-sinr-kpi-baseline-fixture-v1') {
    throw new Error(`${PHASE6P_FIXTURE_PATH} has unexpected schemaVersion ${fixture.schemaVersion}`);
  }
  if (fixture.phase !== '6P') {
    throw new Error(`${PHASE6P_FIXTURE_PATH} has unexpected phase ${fixture.phase}`);
  }
  return fixture;
}

function loadPhase6TFixture(): Phase6TFixtureFile {
  const fixture = JSON.parse(readRepoFile(PHASE6T_FIXTURE_PATH)) as Phase6TFixtureFile;
  if (fixture.schemaVersion !== 'phase6t-source-channel-shadow-kpi-fixture-v1') {
    throw new Error(`${PHASE6T_FIXTURE_PATH} has unexpected schemaVersion ${fixture.schemaVersion}`);
  }
  if (fixture.phase !== '6T') {
    throw new Error(`${PHASE6T_FIXTURE_PATH} has unexpected phase ${fixture.phase}`);
  }
  if (fixture.sourceChannelPolicy.adapterVersion !== ADAPTER_VERSION) {
    throw new Error(`${PHASE6T_FIXTURE_PATH} adapterVersion drifted from ${ADAPTER_VERSION}`);
  }
  return fixture;
}

function validatePackageScript(): string[] {
  const packageJson = JSON.parse(readRepoFile('package.json')) as {
    scripts?: Record<string, string>;
  };
  return packageJson.scripts?.['validate:modqn:phase6t-source-channel-shadow-kpi'] === VALIDATOR_SCRIPT
    ? []
    : ['package.json is missing validate:modqn:phase6t-source-channel-shadow-kpi or its command drifted'];
}

function scanRuntimeNonAdoption(): RuntimeScanResult {
  const leaks: string[] = [];
  const importFromCoreChannel = /^\s*import\b.*\bfrom\s+['"][^'"]*(?:@\/core\/channel|src\/core\/channel|core\/channel)[^'"]*['"]/;
  const phase6TTokens = /\b(phase6t|modqn-phase6t-source-channel-shadow-kpi|validate-modqn-phase6t-source-channel-shadow-kpi|source-channel-shadow-kpi|SourceChannelShadow)\b/i;
  const files = RUNTIME_NON_ADOPTION_SCAN_PATHS
    .flatMap(scanPath => listRepoFiles(scanPath))
    .filter(file => ['.ts', '.tsx', '.json'].includes(extname(file)));

  for (const file of files) {
    const text = readRepoFile(file);
    for (const [lineIndex, line] of text.split(/\r?\n/).entries()) {
      if (importFromCoreChannel.test(line) || phase6TTokens.test(line)) {
        leaks.push(`${file}:${lineIndex + 1}: ${line.trim()}`);
      }
    }
  }

  return {
    status: leaks.length === 0 ? 'PASS' : 'FAIL',
    leaks,
    scannedPaths: RUNTIME_NON_ADOPTION_SCAN_PATHS,
  };
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function phaseDocsAndChangedFiles(): string[] {
  const changedTracked = gitOutput(['diff', '--name-only', '--diff-filter=ACMRTUXB', 'HEAD']);
  const changedUntracked = gitOutput(['ls-files', '--others', '--exclude-standard']);
  const changed = [
    ...(changedTracked ? changedTracked.split(/\r?\n/).filter(Boolean) : []),
    ...(changedUntracked ? changedUntracked.split(/\r?\n/).filter(Boolean) : []),
  ];
  const phaseDocs = listRepoFiles('docs')
    .filter(file => file.startsWith(MODQN_PHASE_DOC_PREFIX) && file.endsWith('.md'));

  return unique([...changed, ...phaseDocs])
    .filter(file => ['.ts', '.tsx', '.mjs', '.md', '.json'].includes(extname(file)))
    .filter(file => existsSync(join(ROOT_DIR, file)));
}

function assertClaimBoundaryHelpers(leaks: string[]): void {
  if (!/baseline/i.test(MODQN_BEAM_COUNT_CLAIM_LABELS[7])) {
    leaks.push('7-beam claim label lost baseline boundary');
  }
  for (const beamCount of [19, 37] as const) {
    const claim = getModqnBeamCountBridgeClaim(beamCount);
    if (claim.kind !== 'live-sensitivity-demo-only') {
      leaks.push(`${beamCount} claim kind drifted to ${claim.kind}`);
    }
    if (claim.supportsProducerReplayEvidence !== false) {
      leaks.push(`${beamCount} leaked producer replay evidence support`);
    }
    if (claim.mayDeriveProducerBeamIdentity !== false) {
      leaks.push(`${beamCount} leaked producer identity derivation`);
    }
    if (/baseline/i.test(claim.label)) {
      leaks.push(`${beamCount} label leaked baseline wording`);
    }
  }
}

function scanUnsupported1937Claims(): ScanResult {
  const scannedFiles = phaseDocsAndChangedFiles();
  const leaks: string[] = [];
  assertClaimBoundaryHelpers(leaks);

  for (const file of scannedFiles) {
    const text = readRepoFile(file);
    for (const [lineIndex, line] of text.split(/\r?\n/).entries()) {
      const normalized = line.replace(/\s+/g, ' ');
      const referencesExtendedCounts = /(19\s*\/\s*37|19[- ]?beam|37[- ]?beam|19\s+or\s+37|19\s+and\s+37)/i.test(normalized);
      const referencesEvidence = /trained[- ]baseline MODQN evidence|trained baseline MODQN evidence/i.test(normalized);
      const isNegatedBoundary = /\b(not|no|must not|does not|do not|without|unless|forbidden|reject|remain|remains|sensitivity\/demo|extension only|false|claim boundary|unsupported|stop|scope|non-scope|only)\b/i.test(normalized);
      if (referencesExtendedCounts && referencesEvidence && !isNegatedBoundary) {
        leaks.push(`${file}:${lineIndex + 1}: ${normalized.trim()}`);
      }
    }
  }

  return {
    status: leaks.length === 0 ? 'PASS' : 'FAIL',
    leaks,
    scannedFiles,
  };
}

function scanModqnReplayEvidenceClaims(): ScanResult {
  const scannedFiles = phaseDocsAndChangedFiles();
  const leaks: string[] = [];

  for (const file of scannedFiles) {
    const text = readRepoFile(file);
    for (const [lineIndex, line] of text.split(/\r?\n/).entries()) {
      const normalized = line.replace(/\s+/g, ' ');
      const referencesHobsSinr = /\b(HOBS|SINR live|live SINR|HOBS\/SINR live output|HOBS\/SINR live)\b/i.test(normalized);
      const referencesReplayEvidence = /MODQN replay evidence/i.test(normalized);
      const isNegatedBoundary = /\b(not|no|must not|does not|do not|without|unless|forbidden|reject|remain|remains|false|claim boundary|non-scope|separate|distinct|distinguish|risk|stop|labeled|labelled)\b/i.test(normalized);
      if (referencesHobsSinr && referencesReplayEvidence && !isNegatedBoundary) {
        leaks.push(`${file}:${lineIndex + 1}: ${normalized.trim()}`);
      }
    }
  }

  return {
    status: leaks.length === 0 ? 'PASS' : 'FAIL',
    leaks,
    scannedFiles,
  };
}

function validateFixtureCoverage(phase6PFixture: Phase6PFixtureFile, phase6TFixture: Phase6TFixtureFile): string[] {
  const failures: string[] = [];
  const phase6PProfileIds = new Set(phase6PFixture.baselines.map(baseline => baseline.profileId));
  const defaultProfileIds = DEFAULT_WINDOWS.map(window => window.profileId);

  for (const requiredProfileId of phase6TFixture.requiredProfiles) {
    if (!phase6PProfileIds.has(requiredProfileId)) {
      failures.push(`${PHASE6P_FIXTURE_PATH} is missing required before baseline ${requiredProfileId}`);
    }
    if (!defaultProfileIds.includes(requiredProfileId)) {
      failures.push(`Phase 6T default window list is missing required profile ${requiredProfileId}`);
    }
  }
  if (phase6TFixture.sourceChannelPolicy.runtimeAdoption !== 'not-adopted') {
    failures.push(`${PHASE6T_FIXTURE_PATH} must keep runtimeAdoption not-adopted`);
  }
  for (const requiredStatus of [
    'SHADOW_COMPARISON_PASS',
    'SHADOW_COMPARISON_DRIFT_EXCEEDS_GATE',
    'BLOCKED_NEEDS_ADAPTER_REFINEMENT',
  ] as const) {
    if (!phase6TFixture.allowedPhase6TStatuses.includes(requiredStatus)) {
      failures.push(`${PHASE6T_FIXTURE_PATH} missing allowed status ${requiredStatus}`);
    }
  }
  return failures;
}

function phase6TStatusFromComparisons(comparisons: readonly ProfileComparison[], structuralFailures: readonly string[]): Phase6TStatus {
  if (structuralFailures.length > 0 || comparisons.some(comparison => comparison.status === 'BLOCKED_NEEDS_ADAPTER_REFINEMENT')) {
    return 'BLOCKED_NEEDS_ADAPTER_REFINEMENT';
  }
  if (comparisons.some(comparison => comparison.status === 'DRIFT_EXCEEDS_GATE')) {
    return 'SHADOW_COMPARISON_DRIFT_EXCEEDS_GATE';
  }
  return 'SHADOW_COMPARISON_PASS';
}

function run(): void {
  const phase6PFixture = loadPhase6PFixture();
  const phase6TFixture = loadPhase6TFixture();
  const runtimeScan = scanRuntimeNonAdoption();
  const unsupportedClaimScan = scanUnsupported1937Claims();
  const replayEvidenceClaimScan = scanModqnReplayEvidenceClaims();
  const fixtureFailures = validateFixtureCoverage(phase6PFixture, phase6TFixture);
  const packageScriptFailures = validatePackageScript();

  const comparisons = phase6TFixture.requiredProfiles.map(profileId => {
    const phase6PBaseline = phase6PFixture.baselines.find(baseline => baseline.profileId === profileId);
    const window = DEFAULT_WINDOWS.find(candidate => candidate.profileId === profileId);
    if (!phase6PBaseline || !window) {
      throw new Error(`missing Phase 6T comparison inputs for ${profileId}`);
    }
    const { profileId: _profileId, ...baselineWindow } = window;
    return captureProfileComparison(profileId, baselineWindow, phase6PBaseline, phase6TFixture);
  });

  const structuralFailures = [
    ...fixtureFailures,
    ...packageScriptFailures,
    ...runtimeScan.leaks.map(leak => `runtime adoption leak: ${leak}`),
    ...unsupportedClaimScan.leaks.map(leak => `unsupported 19/37 claim: ${leak}`),
    ...replayEvidenceClaimScan.leaks.map(leak => `MODQN replay evidence claim leak: ${leak}`),
  ];
  const failedThresholds = comparisons.flatMap(comparison => comparison.failedThresholds);
  const phase6TStatus = phase6TStatusFromComparisons(comparisons, structuralFailures);
  const gitHead = gitOutput(['rev-parse', 'HEAD']);
  const summary = {
    schemaVersion: SUMMARY_SCHEMA_VERSION,
    phase: '6T',
    repo: 'leo-beam-sim',
    validator: VALIDATOR_SCRIPT,
    phase6PFixturePath: PHASE6P_FIXTURE_PATH,
    phase6TFixturePath: PHASE6T_FIXTURE_PATH,
    generatedAt: new Date().toISOString(),
    gitHead,
    runtimeBehaviorChanged: false,
    browserSmokeRun: false,
    runtimeAdoption: {
      status: 'not-adopted',
      evidence: runtimeScan,
      liveRuntimeImportsPhase6TValidator: false,
      liveRuntimeImportsCoreChannel: runtimeScan.status !== 'PASS',
    },
    sourceChannelPolicy: phase6TFixture.sourceChannelPolicy,
    phase6TStatus,
    adoptionGatePassed: phase6TStatus === 'SHADOW_COMPARISON_PASS',
    profileCount: comparisons.length,
    failedThresholdCount: failedThresholds.length,
    blockedReasonCount: comparisons.reduce((sum, comparison) => sum + comparison.adapterBlockedReasons.length, 0) + structuralFailures.length,
    unsupported1937TrainedBaselineClaimScan: unsupportedClaimScan.status,
    modqnReplayEvidenceClaimScan: replayEvidenceClaimScan.status,
    structuralFailures,
    failedThresholds,
    profiles: comparisons.map(comparison => ({
      profileId: comparison.profileId,
      status: comparison.status,
      before: {
        finiteSinrSamples: comparison.before.samples.finiteSinrSamples,
        p50FiniteSinrDb: comparison.before.finiteSinrDb.p50,
        lowSinrBelowHandoverThresholdCount: comparison.before.samples.lowSinrBelowHandoverThresholdCount,
        lowSinrBelowZeroDbCount: comparison.before.samples.lowSinrBelowZeroDbCount,
        handoverEvents: comparison.before.handoverEvents.totalCount,
        intraSwitchCount: comparison.before.handoverEvents.intraSwitchCount,
        interHandoverExcludingInitialAttach: comparison.before.handoverEvents.interHandoverCountExcludingInitialAttach,
        initialAttachCount: comparison.before.handoverEvents.initialAttachCount,
        dpcEnabled: comparison.before.dpcTxPower.enabled,
      },
      after: comparison.shadowKpiExcerpt,
      failedThresholdCount: comparison.failedThresholds.length,
      adapterBlockedReasons: comparison.adapterBlockedReasons,
      maxAbsLinkDiffByField: Object.fromEntries(
        Object.entries(comparison.shadowAdapter.maxAbsLinkDiffByField)
          .map(([field, value]) => [field, round(value)]),
      ),
      kSemantics: comparison.shadowAdapter.kSemantics,
      driftMetrics: comparison.driftMetrics,
    })),
    recommendation: phase6TStatus === 'SHADOW_COMPARISON_PASS'
      ? 'Phase 6U may consider a non-default runtime/profile flag with the same drift gate and explicit UI disclosure.'
      : 'Phase 6U should refine the source-channel adapter and rerun validator-only shadow KPI comparison before any live runtime flag, UI control, or handover behavior adoption.',
  };

  console.log(JSON.stringify(summary, null, 2));
  if (phase6TStatus !== 'SHADOW_COMPARISON_PASS') {
    process.exitCode = 1;
  }
}

run();
