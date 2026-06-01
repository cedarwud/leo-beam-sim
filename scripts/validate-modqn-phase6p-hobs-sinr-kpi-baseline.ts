import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createObserverContext } from '../src/engine/orbit/index.ts';
import { HandoverManager } from '../src/engine/handover/handover-manager.ts';
import type { HandoverEvent } from '../src/engine/handover/types.ts';
import type { BeamPowerControlState } from '../src/engine/signal/power-control.ts';
import type { ActiveBeamAssignment, LinkSample } from '../src/engine/signal/types.ts';
import { loadProfile } from '../src/profiles/index.ts';
import type { Profile } from '../src/profiles/types.ts';
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
import type { BeamCellState } from '../src/scene/types.ts';
import {
  beamAssignmentKey,
  normalizeReplayOffset,
  type CachedSatState,
  type ShellBeamLayout,
} from '../src/scene/simulationHelpers.ts';

type Phase6PStatus = 'PASS' | 'PARTIAL_BASELINE_CAPTURED' | 'BLOCKED_NEEDS_RUNTIME_EXTRACTION';
type ScanStatus = 'PASS' | 'FAIL';

interface BaselineWindow {
  epochUtcMs: number;
  startOffsetSec: number;
  loop: boolean;
  frameDtSec: number;
  speed: number;
  frameCount: number;
}

interface TimelineSegment {
  startFrame: number;
  endFrame: number;
  startSimTimeSec: number;
  endSimTimeSec: number;
  key: string;
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
  finalStateSample: Array<{
    key: string;
    txPowerDbm: number;
    stepDb: number;
    efficiencyScore: number | null;
  }>;
}

interface BaselineSummary {
  profileId: string;
  formulaFamily: Profile['formulaFamily'];
  profileClass: Profile['profileClass'];
  status: Phase6PStatus;
  tuning: {
    signalEvidenceKey: string;
    signalResetKey: string;
    handoverPolicyKey: string;
    appHandoverResetKey: string;
  };
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
  servingTimeline: {
    uniqueStateCount: number;
    nullFrameCount: number;
    segments: TimelineSegment[];
  };
  pendingTargetTimeline: {
    frameCount: number;
    uniqueStateCount: number;
    segments: TimelineSegment[];
  };
  recentHoLatchTimeline: {
    available: boolean;
    frameCount: number;
    uniqueStateCount: number;
    segments: TimelineSegment[];
  };
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

interface FixtureFile {
  schemaVersion: string;
  phase: '6P';
  status: Phase6PStatus;
  scriptAddressability: {
    fullyScriptAddressableToday: boolean;
    captureMode: string;
    blocker: string;
    phase6QRecommendation: string;
  };
  claimBoundary: {
    hobsSinrBaselineOnly: boolean;
    acceptedModqnEvidenceBeamCount: 7;
    sensitivityDemoOnlyBeamCounts: [19, 37];
    channelKpiParityCreatesModqnEvidence: false;
    eeHeaCatfishScope: 'non-scope';
  };
  baselines: BaselineSummary[];
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
  servingKey: string;
  pendingTargetKey: string;
  recentHoKey: string;
}

interface DeterministicRunner {
  profile: Profile;
  observer: ReturnType<typeof createObserverContext>;
  beamLayoutsByShellId: Map<string, ShellBeamLayout>;
  trajectoryCache: CachedSatState[][];
  hoManager: HandoverManager;
  maxTimeSec: number;
  frameStepState: RuntimeFrameStepState;
}

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_PATH = 'scripts/fixtures/modqn-phase6p-hobs-sinr-kpi-baseline.json';
const SUMMARY_SCHEMA_VERSION = 'phase6p-hobs-sinr-kpi-baseline-fixture-v1';
const VALIDATOR_SCRIPT = 'node --import tsx/esm scripts/validate-modqn-phase6p-hobs-sinr-kpi-baseline.ts';
const MODQN_PHASE_DOC_PREFIX = 'docs/modqn-baseline-';

const EPOCH_UTC_MS = Date.UTC(2026, 0, 1, 0, 0, 0);
const FRAME_DT_SEC = 0.2;
const SPEED = 5;
const FRAME_COUNT = 60;

const DEFAULT_WINDOWS: readonly (BaselineWindow & { profileId: string })[] = [
  {
    profileId: 'hobs-2024-paper-default',
    epochUtcMs: EPOCH_UTC_MS,
    startOffsetSec: 1065,
    loop: true,
    frameDtSec: FRAME_DT_SEC,
    speed: SPEED,
    frameCount: FRAME_COUNT,
  },
  {
    profileId: 'hobs-2024-candidate-rich',
    epochUtcMs: EPOCH_UTC_MS,
    startOffsetSec: 450,
    loop: true,
    frameDtSec: FRAME_DT_SEC,
    speed: SPEED,
    frameCount: FRAME_COUNT,
  },
  {
    profileId: 'hobs-2024-tr38811-research',
    epochUtcMs: EPOCH_UTC_MS,
    startOffsetSec: 1065,
    loop: true,
    frameDtSec: FRAME_DT_SEC,
    speed: SPEED,
    frameCount: FRAME_COUNT,
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

function incrementCount(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

function stableRecord(counts: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function keyForAssignment(satId: string | null, beamId: number | null): string {
  return satId && beamId !== null ? `${satId}:B${beamId}` : 'none';
}

function compressTimeline(
  frames: readonly FrameRecord[],
  selectKey: (frame: FrameRecord) => string,
): TimelineSegment[] {
  const segments: TimelineSegment[] = [];
  for (const frame of frames) {
    const key = selectKey(frame);
    const previous = segments[segments.length - 1];
    if (previous && previous.key === key) {
      previous.endFrame = frame.frameIndex;
      previous.endSimTimeSec = round(frame.simTimeSec);
      continue;
    }
    segments.push({
      startFrame: frame.frameIndex,
      endFrame: frame.frameIndex,
      startSimTimeSec: round(frame.simTimeSec),
      endSimTimeSec: round(frame.simTimeSec),
      key,
    });
  }
  return segments;
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function prepareProfile(profileId: string): {
  baseProfile: Profile;
  profile: Profile;
  signalEvidenceKey: string;
  signalResetKey: string;
  handoverPolicyKey: string;
  appHandoverResetKey: string;
} {
  const baseProfile = loadProfile(profileId);
  const signalTuning = createSignalTuningState(baseProfile);
  const handoverTuning = createHandoverPolicyTuningState(baseProfile);
  const signalTunedProfile = applySignalTuning(baseProfile, signalTuning);
  const profile = applyHandoverPolicyTuning(signalTunedProfile, handoverTuning);
  const handoverPolicyKey = getHandoverPolicyResetKey(handoverTuning);

  return {
    baseProfile,
    profile,
    signalEvidenceKey: getSignalTuningEvidenceKey(signalTuning),
    signalResetKey: getSignalTuningResetKey(signalTuning),
    handoverPolicyKey,
    appHandoverResetKey: `0:${handoverPolicyKey}`,
  };
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
    maxTimeSec,
    frameStepState: createRuntimeFrameStepState(simTimeSec),
  };
}

function stepRunner(
  runner: DeterministicRunner,
  window: BaselineWindow,
  frameIndex: number,
): FrameRecord {
  const { frame } = stepRuntimeFrame({
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
  });
  const recentHoKey =
    frame.recentHoSourceSatId
    && frame.recentHoTargetSatId
    && frame.recentHoSourceBeamId !== null
    && frame.recentHoTargetBeamId !== null
      ? `${frame.recentHoSourceSatId}:B${frame.recentHoSourceBeamId}->${frame.recentHoTargetSatId}:B${frame.recentHoTargetBeamId}`
      : 'none';

  return {
    frameIndex,
    simTimeSec: frame.simTimeSec,
    linkSamples: frame.linkSamples,
    activeAssignments: [...frame.activeAssignments],
    beamCellsBySatId: frame.beamCellsBySatId,
    servingKey: keyForAssignment(frame.serving.satId, frame.serving.beamId),
    pendingTargetKey: keyForAssignment(frame.pendingTargetSatId, frame.pendingTargetBeamId),
    recentHoKey,
  };
}

function summarizeDpc(
  profile: Profile,
  statesByKey: ReadonlyMap<string, BeamPowerControlState>,
): DpcSummary {
  const powerControl = profile.channel.beamPowerControl;
  if (profile.formulaFamily !== 'hobs-tr38811' || !powerControl) {
    return {
      enabled: false,
      mode: null,
      updatePeriodSec: null,
      finalStateCount: 0,
      txPowerDbm: null,
      finalStateSample: [],
    };
  }

  const entries = [...statesByKey.entries()]
    .sort(([left], [right]) => left.localeCompare(right));

  return {
    enabled: true,
    mode: powerControl.mode,
    updatePeriodSec: powerControl.updatePeriodSec,
    finalStateCount: entries.length,
    txPowerDbm: summarizeNumbers(entries.map(([, state]) => state.txPowerDbm)),
    finalStateSample: entries.slice(0, 12).map(([key, state]) => ({
      key,
      txPowerDbm: round(state.txPowerDbm),
      stepDb: round(state.stepDb),
      efficiencyScore: roundNullable(state.efficiencyScore),
    })),
  };
}

function findBeamCell(
  frame: FrameRecord,
  assignment: ActiveBeamAssignment,
): BeamCellState | null {
  return frame.beamCellsBySatId
    .get(assignment.satId)
    ?.find(beam => beam.beamId === assignment.beamId)
    ?? null;
}

function summarizeActiveBeams(frames: readonly FrameRecord[]): BaselineSummary['activeBeamSummary'] {
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

function serializeEvents(
  eventLog: readonly HandoverEvent[],
): BaselineSummary['handoverEvents']['events'] {
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

function captureBaseline(profileId: string, window: BaselineWindow): BaselineSummary {
  const {
    baseProfile,
    profile,
    signalEvidenceKey,
    signalResetKey,
    handoverPolicyKey,
    appHandoverResetKey,
  } = prepareProfile(profileId);
  const runner = createRunner(profile, window);
  const frames: FrameRecord[] = [];

  for (let frameIndex = 0; frameIndex < window.frameCount; frameIndex++) {
    frames.push(stepRunner(runner, window, frameIndex));
  }

  const allSinrValues = frames.flatMap(frame => frame.linkSamples.map(sample => sample.sinrDb));
  const finiteSinrValues = allSinrValues.filter(Number.isFinite);
  const servingSegments = compressTimeline(frames, frame => frame.servingKey);
  const pendingSegments = compressTimeline(frames, frame => frame.pendingTargetKey)
    .filter(segment => segment.key !== 'none');
  const recentHoSegments = compressTimeline(frames, frame => frame.recentHoKey)
    .filter(segment => segment.key !== 'none');
  const intraSwitchCount = runner.hoManager.eventLog
    .filter(event => event.action === 'intra-switch')
    .length;
  const rawInterHandoverCount = runner.hoManager.eventLog
    .filter(event => event.action === 'inter-handover')
    .length;
  const initialAttachCount = runner.hoManager.eventLog
    .filter(event => event.action === 'inter-handover' && event.fromSatId === null && event.fromBeamId === null)
    .length;

  return {
    profileId: profile.id,
    formulaFamily: profile.formulaFamily,
    profileClass: profile.profileClass,
    status: 'PASS',
    tuning: {
      signalEvidenceKey,
      signalResetKey,
      handoverPolicyKey,
      appHandoverResetKey,
    },
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
    servingTimeline: {
      uniqueStateCount: sortedUnique(servingSegments.map(segment => segment.key)).length,
      nullFrameCount: frames.filter(frame => frame.servingKey === 'none').length,
      segments: servingSegments,
    },
    pendingTargetTimeline: {
      frameCount: frames.filter(frame => frame.pendingTargetKey !== 'none').length,
      uniqueStateCount: sortedUnique(pendingSegments.map(segment => segment.key)).length,
      segments: pendingSegments,
    },
    recentHoLatchTimeline: {
      available: true,
      frameCount: frames.filter(frame => frame.recentHoKey !== 'none').length,
      uniqueStateCount: sortedUnique(recentHoSegments.map(segment => segment.key)).length,
      segments: recentHoSegments,
    },
    handoverEvents: {
      totalCount: runner.hoManager.eventLog.length,
      intraSwitchCount,
      interHandoverCountRaw: rawInterHandoverCount,
      initialAttachCount,
      interHandoverCountExcludingInitialAttach: rawInterHandoverCount - initialAttachCount,
      initialAttachHandling: 'HandoverManager records initial attach as inter-handover; Phase 6P reports it separately and does not treat it as MODQN reward evidence.',
      events: serializeEvents(runner.hoManager.eventLog),
    },
    dpcTxPower: summarizeDpc(profile, runner.frameStepState.beamPowerControlRuntime.statesByKey),
    activeBeamSummary: summarizeActiveBeams(frames),
  };
}

function createFixture(windows = DEFAULT_WINDOWS): FixtureFile {
  return {
    schemaVersion: SUMMARY_SCHEMA_VERSION,
    phase: '6P',
    status: 'PASS',
    scriptAddressability: {
      fullyScriptAddressableToday: true,
      captureMode: 'shared deterministic runtime frame-step helper imported from src/scene/runtimeFrameStep.ts by both useSimulation and this validator',
      blocker: 'none; Phase 6Q extracted the shared non-React HOBS/SINR frame-step path',
      phase6QRecommendation: 'complete; keep future Phase 6R work behavior-preserving unless an explicit channel-adoption gate is opened',
    },
    claimBoundary: {
      hobsSinrBaselineOnly: true,
      acceptedModqnEvidenceBeamCount: 7,
      sensitivityDemoOnlyBeamCounts: [19, 37],
      channelKpiParityCreatesModqnEvidence: false,
      eeHeaCatfishScope: 'non-scope',
    },
    baselines: windows.map(({ profileId, ...window }) => captureBaseline(profileId, window)),
  };
}

function loadFixture(): FixtureFile {
  const fixture = JSON.parse(readRepoFile(FIXTURE_PATH)) as FixtureFile;
  if (fixture.schemaVersion !== SUMMARY_SCHEMA_VERSION) {
    throw new Error(`${FIXTURE_PATH} has unexpected schemaVersion ${fixture.schemaVersion}`);
  }
  if (fixture.phase !== '6P') {
    throw new Error(`${FIXTURE_PATH} has unexpected phase ${fixture.phase}`);
  }
  return fixture;
}

function assertFixtureCoverage(fixture: FixtureFile): string[] {
  const failures: string[] = [];
  const profileIds = new Set(fixture.baselines.map(baseline => baseline.profileId));
  for (const requiredProfileId of [
    'hobs-2024-paper-default',
    'hobs-2024-candidate-rich',
    'hobs-2024-tr38811-research',
  ]) {
    if (!profileIds.has(requiredProfileId)) failures.push(`missing baseline for ${requiredProfileId}`);
  }
  if (fixture.status !== 'PASS') {
    failures.push(`fixture status drifted to ${fixture.status}`);
  }
  if (fixture.scriptAddressability.fullyScriptAddressableToday !== true) {
    failures.push('scriptAddressability must disclose the shared runtime frame-step extraction');
  }
  for (const baseline of fixture.baselines) {
    if (baseline.beamConfig.beamCountPerSatellite !== 7) {
      failures.push(`${baseline.profileId} baseline changed beam count from current 7-beam path`);
    }
    if (baseline.beamConfig.frequencyReuseK !== 3) {
      failures.push(`${baseline.profileId} baseline changed frequency reuse K from fixed K=3`);
    }
    if (baseline.window.epochUtcMs !== EPOCH_UTC_MS) {
      failures.push(`${baseline.profileId} baseline changed epoch`);
    }
    if (baseline.window.frameCount !== FRAME_COUNT) {
      failures.push(`${baseline.profileId} baseline changed frame count`);
    }
  }
  return failures;
}

function validatePackageScript(): string[] {
  const packageJson = JSON.parse(readRepoFile('package.json')) as {
    scripts?: Record<string, string>;
  };
  return packageJson.scripts?.['validate:modqn:phase6p-hobs-sinr-kpi-baseline'] === VALIDATOR_SCRIPT
    ? []
    : ['package.json is missing validate:modqn:phase6p-hobs-sinr-kpi-baseline or its command drifted'];
}

function validateRuntimeConstants(): string[] {
  const failures: string[] = [];
  const appSource = readRepoFile('src/App.tsx');
  const useSimulationSource = readRepoFile('src/scene/useSimulation.ts');
  const runtimeFrameStepSource = readRepoFile('src/scene/runtimeFrameStep.ts');
  const expectations: Array<[string, RegExp]> = [
    ['App APP_EPOCH_MS import/use', /\bAPP_EPOCH_MS\b/],
    ['runtimeFrameStep MIN_ELEVATION_DEG', /export const MIN_ELEVATION_DEG = 15/],
    ['runtimeFrameStep CACHE_ELEVATION_DEG', /export const CACHE_ELEVATION_DEG = 10/],
    ['runtimeFrameStep SIM_DURATION_SEC', /export const SIM_DURATION_SEC = 7200/],
    ['runtimeFrameStep SIM_STEP_SEC', /export const SIM_STEP_SEC = 20/],
    ['runtimeFrameStep MAX_STEERING_EXTRA_RINGS', /export const MAX_STEERING_EXTRA_RINGS = 3/],
    ['runtimeFrameStep RECENT_HO_LINGER_SEC', /export const RECENT_HO_LINGER_SEC = 5/],
    ['useSimulation shared step import', /\bstepRuntimeFrame\b/],
  ];
  for (const [label, pattern] of expectations) {
    const source = label.startsWith('App')
      ? appSource
      : label.startsWith('useSimulation')
        ? useSimulationSource
        : runtimeFrameStepSource;
    if (!pattern.test(source)) failures.push(`${label} drifted from Phase 6P harness assumptions`);
  }
  return failures;
}

function scanRuntimeNonAdoption(): RuntimeScanResult {
  const leaks: string[] = [];
  const importFromCoreChannel = /^\s*import\b.*\bfrom\s+['"][^'"]*(?:@\/core\/channel|src\/core\/channel|core\/channel)[^'"]*['"]/;
  const phase6PQTokens = /\b(phase6p|phase6q|modqn-phase6p-hobs-sinr-kpi-baseline|validate-modqn-phase6p-hobs-sinr-kpi-baseline|HobsSinrKpiBaseline)\b/i;
  const files = RUNTIME_NON_ADOPTION_SCAN_PATHS
    .flatMap(scanPath => listRepoFiles(scanPath))
    .filter(file => ['.ts', '.tsx', '.json'].includes(extname(file)));

  for (const file of files) {
    const text = readRepoFile(file);
    for (const [lineIndex, line] of text.split(/\r?\n/).entries()) {
      if (importFromCoreChannel.test(line) || phase6PQTokens.test(line)) {
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

function deepDiffLabel(actual: unknown, expected: unknown, label: string): string[] {
  if (JSON.stringify(actual) === JSON.stringify(expected)) return [];
  return [`${label} drifted from ${FIXTURE_PATH}`];
}

function run(): void {
  if (process.argv.includes('--capture')) {
    console.log(JSON.stringify(createFixture(), null, 2));
    return;
  }

  const fixture = loadFixture();
  const recomputed = createFixture(
    fixture.baselines.map(baseline => ({
      profileId: baseline.profileId,
      epochUtcMs: baseline.window.epochUtcMs,
      startOffsetSec: baseline.window.startOffsetSec,
      loop: baseline.window.loop,
      frameDtSec: baseline.window.frameDtSec,
      speed: baseline.window.speed,
      frameCount: baseline.window.frameCount,
    })),
  );
  const runtimeScan = scanRuntimeNonAdoption();
  const unsupportedClaimScan = scanUnsupported1937Claims();
  const replayEvidenceClaimScan = scanModqnReplayEvidenceClaims();
  const fixtureCoverageFailures = assertFixtureCoverage(fixture);
  const packageScriptFailures = validatePackageScript();
  const runtimeConstantFailures = validateRuntimeConstants();
  const fixtureDiffs = [
    ...deepDiffLabel(recomputed.scriptAddressability, fixture.scriptAddressability, 'scriptAddressability'),
    ...deepDiffLabel(recomputed.claimBoundary, fixture.claimBoundary, 'claimBoundary'),
    ...deepDiffLabel(recomputed.baselines, fixture.baselines, 'baselines'),
  ];
  const failures = [
    ...fixtureCoverageFailures,
    ...packageScriptFailures,
    ...runtimeConstantFailures,
    ...fixtureDiffs,
    ...runtimeScan.leaks.map(leak => `runtime adoption leak: ${leak}`),
    ...unsupportedClaimScan.leaks.map(leak => `unsupported 19/37 claim: ${leak}`),
    ...replayEvidenceClaimScan.leaks.map(leak => `MODQN replay evidence claim leak: ${leak}`),
  ];

  const summary = {
    schemaVersion: 'phase6p-hobs-sinr-kpi-baseline-summary-v1',
    phase: '6P',
    repo: 'leo-beam-sim',
    validator: VALIDATOR_SCRIPT,
    fixturePath: FIXTURE_PATH,
    generatedAt: new Date().toISOString(),
    status: failures.length === 0 ? fixture.status : 'FAIL',
    scriptAddressability: fixture.scriptAddressability,
    baselineCount: fixture.baselines.length,
    baselineFixtureSummary: fixture.baselines.map(baseline => ({
      profileId: baseline.profileId,
      status: baseline.status,
      frames: baseline.window.frameCount,
      firstFrameSimTimeSec: baseline.window.firstFrameSimTimeSec,
      lastFrameSimTimeSec: baseline.window.lastFrameSimTimeSec,
      finiteSinrSamples: baseline.samples.finiteSinrSamples,
      lowSinrBelowHandoverThresholdCount: baseline.samples.lowSinrBelowHandoverThresholdCount,
      hoEvents: baseline.handoverEvents.totalCount,
      initialAttachCount: baseline.handoverEvents.initialAttachCount,
      intraSwitchCount: baseline.handoverEvents.intraSwitchCount,
      interHandoverExcludingInitialAttach: baseline.handoverEvents.interHandoverCountExcludingInitialAttach,
      dpcEnabled: baseline.dpcTxPower.enabled,
    })),
    unsupported1937TrainedBaselineClaimScan: unsupportedClaimScan.status,
    modqnReplayEvidenceClaimScan: replayEvidenceClaimScan.status,
    runtimeNonAdoptionScan: runtimeScan,
    runtimeConstantsChecked: runtimeConstantFailures.length === 0,
    failures,
  };

  console.log(JSON.stringify(summary, null, 2));
  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

run();
