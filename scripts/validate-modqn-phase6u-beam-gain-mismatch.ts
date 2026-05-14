import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createObserverContext } from '../src/engine/orbit/index.ts';
import { HandoverManager } from '../src/engine/handover/handover-manager.ts';
import type { LinkSample } from '../src/engine/signal/types.ts';
import {
  BEAM_GAIN_FLOOR_DB,
  computeBeamGainDb as computeEngineBeamGainDb,
  computeOffAxisDeg as computeEngineOffAxisDeg,
} from '../src/engine/signal/beam-gain.ts';
import { loadProfile } from '../src/profiles/index.ts';
import type { GainModel, Profile } from '../src/profiles/types.ts';
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
import { computeBeamGain as computeCoreBeamGain } from '../src/core/channel/beam-gain.ts';
import { computeFspl as computeCoreFspl } from '../src/core/channel/fspl.ts';
import { computeLinkBudget as computeCoreLinkBudget } from '../src/core/channel/link-budget.ts';
import type {
  BeamGainInput,
  ChannelResult,
  DeploymentEnvironment,
  LinkBudgetOptions,
} from '../src/core/channel/types.ts';

type Phase6UStatus =
  | 'MISMATCH_CHARACTERIZED'
  | 'ADAPTER_MAPPING_FIX_READY'
  | 'BLOCKED_BY_MODEL_DIFFERENCE';
type ScanStatus = 'PASS' | 'FAIL';
type CaseKind =
  | 'center-beam'
  | 'off-axis-beam'
  | 'scan-loss'
  | 'candidate-rich'
  | 'tr38811-like'
  | 'phase6t-shadow-sample';
type CauseKey =
  | 'off-axis-angle-mapping'
  | 'beam-diameter-beamwidth-conversion'
  | 'peak-gain-convention'
  | 'antenna-model-mismatch'
  | 'scan-loss-mapping'
  | 'implementation-loss-placement'
  | 'beam-gain-floor-convention'
  | 'none-observed';

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
  p50: number | null;
  max: number | null;
  mean: number | null;
}

interface Phase6UFixtureFile {
  schemaVersion: string;
  phase: '6U';
  comparisonMode: 'validator-only-beam-gain-mismatch-characterization';
  phase6TFixturePath: string;
  requiredProfiles: string[];
  requiredCaseKinds: CaseKind[];
  allowedPhase6UStatuses: Phase6UStatus[];
  expectedPhase6UStatus: Phase6UStatus;
  diagnosticPolicy: {
    runtimeAdoption: 'not-adopted';
    formulaChanges: 'forbidden';
    browserSmoke: 'not-required';
    adapterOnlyFixReadyWhen: string;
  };
  thresholds: {
    centerGainAbsToleranceDb: number;
    engineSampleRecomputeAbsToleranceDb: number;
    scanLossAbsToleranceDb: number;
    implementationLossPlacementAbsToleranceDb: number;
    mismatchMeanAbsThresholdDb: number;
    adapterReadyP50ResidualThresholdDb: number;
    modelDifferenceP50ResidualThresholdDb: number;
  };
}

interface Phase6TFixtureFile {
  schemaVersion: string;
  phase: '6T';
  comparisonMode: string;
  requiredProfiles: string[];
  sourceChannelPolicy: {
    runtimeAdoption: string;
  };
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

interface DeterministicRunner {
  profile: Profile;
  observer: ReturnType<typeof createObserverContext>;
  beamLayoutsByShellId: Map<string, ShellBeamLayout>;
  trajectoryCache: CachedSatState[][];
  hoManager: HandoverManager;
  frameStepState: RuntimeFrameStepState;
}

interface BeamGainCase {
  caseId: string;
  caseKind: CaseKind;
  profileId: string;
  formulaFamily: Profile['formulaFamily'];
  source: 'analytic-fixture' | 'phase6t-shadow-sample';
  frameIndex: number | null;
  simTimeSec: number | null;
  sampleKey: string;
  offAxisAngleDeg: number;
  scanAngleDeg: number;
  altitudeKm: number;
  slantRangeKm: number;
  beamDiameterKm: number;
  diameterAdaptedBeamDiameterKm: number;
  engineBeamwidth3dBDeg: number;
  engineGainDb: number;
  engineSampleGainDb: number | null;
  coreRawGainDb: number;
  coreDiameterAdaptedGainDb: number;
  engineScanLossDb: number;
  coreScanLossDb: number;
  implementationLossPlacementDiffDb: number;
  rawBeamGainDiffDb: number;
  diameterAdaptedBeamGainDiffDb: number;
  rawLinkImpactEstimateDb: number;
  diameterAdaptedLinkImpactEstimateDb: number;
  causes: CauseKey[];
}

interface CauseSummary {
  cause: CauseKey;
  status: 'ROOT_CAUSE' | 'NOT_OBSERVED' | 'SECONDARY' | 'NOT_APPLICABLE';
  evidence: string;
}

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const PHASE6U_FIXTURE_PATH = 'scripts/fixtures/modqn-phase6u-beam-gain-mismatch.json';
const PHASE6T_FIXTURE_PATH = 'scripts/fixtures/modqn-phase6t-source-channel-shadow-kpi.json';
const VALIDATOR_SCRIPT = 'node --import tsx/esm scripts/validate-modqn-phase6u-beam-gain-mismatch.ts';
const SUMMARY_SCHEMA_VERSION = 'phase6u-beam-gain-mismatch-summary-v1';
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
    p50: roundNullable(percentile(finite, 0.5)),
    max: roundNullable(finite[finite.length - 1] ?? null),
    mean: roundNullable(mean),
  };
}

function absSummary(cases: readonly BeamGainCase[], selector: (sample: BeamGainCase) => number): NumericSummary {
  return summarizeNumbers(cases.map(sample => Math.abs(selector(sample))));
}

function normalizeGainModel(model: GainModel): BeamGainInput['model'] {
  if (model === 'bessel-j1-j3') return 'bessel-j1j3';
  if (model === 'bessel-j1') return 'bessel-j1';
  return 'flat-debug';
}

function computeSteeringLossDb(
  scanAngleDeg: number,
  maxSteeringAngleDeg: number,
  scanLossAtMaxSteeringDb: number,
): number {
  if (
    scanAngleDeg <= 0
    || maxSteeringAngleDeg <= 0
    || scanLossAtMaxSteeringDb <= 0
  ) {
    return 0;
  }

  const ratio = Math.min(scanAngleDeg / maxSteeringAngleDeg, 1);
  return scanLossAtMaxSteeringDb * ratio * ratio;
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

function findBeamCell(frame: SimFrame, sample: LinkSample): BeamCellState | null {
  return frame.beamCellsBySatId
    .get(sample.satId)
    ?.find(beam => beam.beamId === sample.beamId)
    ?? null;
}

function channelOptionsForCase(input: {
  profile: Profile;
  offAxisAngleDeg: number;
  scanAngleDeg: number;
  beamDiameterKm: number;
  altitudeKm: number;
  slantRangeKm: number;
  txPowerDbm: number;
  pathLossDb: number;
  noisePowerDbm: number;
  elevationDeg: number;
}): LinkBudgetOptions {
  const environment = (input.profile.channel.tr38811?.environment ?? 'suburban') as DeploymentEnvironment;
  return {
    distanceKm: input.slantRangeKm,
    frequencyGhz: input.profile.channel.frequencyGHz,
    txEirpDbm: input.txPowerDbm + input.profile.antenna.maxGainDbi,
    rxAntennaGainDb: input.profile.ueAntenna.maxGainDbi,
    elevationDeg: input.elevationDeg,
    environment,
    largeScaleModel: '3gpp-baseline',
    beamGainInput: {
      offAxisAngleDeg: input.offAxisAngleDeg,
      model: normalizeGainModel(input.profile.antenna.model),
      peakGainDbi: input.profile.antenna.maxGainDbi,
      beamDiameterKm: input.beamDiameterKm,
      altitudeKm: input.altitudeKm,
      slantRangeKm: input.slantRangeKm,
    },
    noisePowerDbm: input.noisePowerDbm,
    implementationLossDb: input.pathLossDb - computeCoreFspl(input.slantRangeKm, input.profile.channel.frequencyGHz),
    tier1LargeScale: false,
    tier2Clutter: false,
    tier3BeamGain: true,
    tier35ScanLoss: true,
    tier4Atmospheric: false,
    tier5Fading: false,
    scanAngleDeg: input.scanAngleDeg,
    scanMaxAngleDeg: input.profile.antenna.maxSteeringAngleDeg,
    scanLossMaxDb: input.profile.antenna.scanLossAtMaxSteeringDb,
    rngNext: null,
    isLos: true,
  };
}

function nonBeamNonScanPathLossDb(result: ChannelResult): number {
  return result.fsplDb
    + result.implementationLossDb
    + result.shadowFadingDb
    + result.clutterLossDb
    + result.atmosphericDb;
}

function classifyCase(input: {
  engineSampleDiffDb: number;
  rawDiffDb: number;
  diameterAdaptedDiffDb: number;
  scanDiffDb: number;
  implementationLossPlacementDiffDb: number;
  coreRawGainDb: number;
  engineGainDb: number;
  thresholds: Phase6UFixtureFile['thresholds'];
}): CauseKey[] {
  const causes = new Set<CauseKey>();
  const {
    engineSampleDiffDb,
    rawDiffDb,
    diameterAdaptedDiffDb,
    scanDiffDb,
    implementationLossPlacementDiffDb,
    coreRawGainDb,
    engineGainDb,
    thresholds,
  } = input;

  if (Math.abs(engineSampleDiffDb) > thresholds.engineSampleRecomputeAbsToleranceDb) {
    causes.add('off-axis-angle-mapping');
  }
  if (Math.abs(rawDiffDb) > thresholds.mismatchMeanAbsThresholdDb) {
    causes.add('beam-diameter-beamwidth-conversion');
  }
  if (Math.abs(diameterAdaptedDiffDb) > thresholds.adapterReadyP50ResidualThresholdDb) {
    causes.add('antenna-model-mismatch');
  }
  if (Math.abs(scanDiffDb) > thresholds.scanLossAbsToleranceDb) {
    causes.add('scan-loss-mapping');
  }
  if (Math.abs(implementationLossPlacementDiffDb) > thresholds.implementationLossPlacementAbsToleranceDb) {
    causes.add('implementation-loss-placement');
  }
  if (engineGainDb <= BEAM_GAIN_FLOOR_DB && coreRawGainDb < BEAM_GAIN_FLOOR_DB) {
    causes.add('beam-gain-floor-convention');
  }

  if (causes.size === 0) causes.add('none-observed');
  return [...causes].sort((a, b) => a.localeCompare(b));
}

function createCase(input: {
  caseId: string;
  caseKind: CaseKind;
  profile: Profile;
  source: BeamGainCase['source'];
  frameIndex: number | null;
  simTimeSec: number | null;
  sampleKey: string;
  offAxisAngleDeg: number;
  scanAngleDeg: number;
  altitudeKm: number;
  slantRangeKm: number;
  beamDiameterKm: number;
  txPowerDbm: number;
  pathLossDb: number;
  noisePowerDbm: number;
  elevationDeg: number;
  engineSampleGainDb: number | null;
  thresholds: Phase6UFixtureFile['thresholds'];
}): BeamGainCase {
  const engineBeamwidth3dBDeg = input.profile.antenna.beamwidth3dBRad * (180 / Math.PI);
  const diameterAdaptedBeamDiameterKm = 2 * input.altitudeKm * Math.tan(input.profile.antenna.beamwidth3dBRad);
  const engineGainDb = computeEngineBeamGainDb(
    input.offAxisAngleDeg,
    engineBeamwidth3dBDeg,
    input.profile.antenna.model,
  );
  const coreRawGainDb = computeCoreBeamGain({
    offAxisAngleDeg: input.offAxisAngleDeg,
    model: normalizeGainModel(input.profile.antenna.model),
    peakGainDbi: input.profile.antenna.maxGainDbi,
    beamDiameterKm: input.beamDiameterKm,
    altitudeKm: input.altitudeKm,
    slantRangeKm: input.slantRangeKm,
  });
  const coreDiameterAdaptedGainDb = computeCoreBeamGain({
    offAxisAngleDeg: input.offAxisAngleDeg,
    model: normalizeGainModel(input.profile.antenna.model),
    peakGainDbi: input.profile.antenna.maxGainDbi,
    beamDiameterKm: diameterAdaptedBeamDiameterKm,
    altitudeKm: input.altitudeKm,
    slantRangeKm: input.slantRangeKm,
  });
  const rawLinkBudget = computeCoreLinkBudget(channelOptionsForCase({
    profile: input.profile,
    offAxisAngleDeg: input.offAxisAngleDeg,
    scanAngleDeg: input.scanAngleDeg,
    beamDiameterKm: input.beamDiameterKm,
    altitudeKm: input.altitudeKm,
    slantRangeKm: input.slantRangeKm,
    txPowerDbm: input.txPowerDbm,
    pathLossDb: input.pathLossDb,
    noisePowerDbm: input.noisePowerDbm,
    elevationDeg: input.elevationDeg,
  }));
  const diameterAdaptedLinkBudget = computeCoreLinkBudget(channelOptionsForCase({
    profile: input.profile,
    offAxisAngleDeg: input.offAxisAngleDeg,
    scanAngleDeg: input.scanAngleDeg,
    beamDiameterKm: diameterAdaptedBeamDiameterKm,
    altitudeKm: input.altitudeKm,
    slantRangeKm: input.slantRangeKm,
    txPowerDbm: input.txPowerDbm,
    pathLossDb: input.pathLossDb,
    noisePowerDbm: input.noisePowerDbm,
    elevationDeg: input.elevationDeg,
  }));
  const engineScanLossDb = computeSteeringLossDb(
    input.scanAngleDeg,
    input.profile.antenna.maxSteeringAngleDeg,
    input.profile.antenna.scanLossAtMaxSteeringDb,
  );
  const engineSampleDiffDb = input.engineSampleGainDb === null ? 0 : input.engineSampleGainDb - engineGainDb;
  const rawBeamGainDiffDb = coreRawGainDb - engineGainDb;
  const diameterAdaptedBeamGainDiffDb = coreDiameterAdaptedGainDb - engineGainDb;
  const scanDiffDb = rawLinkBudget.scanLossDb - engineScanLossDb;
  const implementationLossPlacementDiffDb = nonBeamNonScanPathLossDb(rawLinkBudget) - input.pathLossDb;

  return {
    caseId: input.caseId,
    caseKind: input.caseKind,
    profileId: input.profile.id,
    formulaFamily: input.profile.formulaFamily,
    source: input.source,
    frameIndex: input.frameIndex,
    simTimeSec: input.simTimeSec === null ? null : round(input.simTimeSec),
    sampleKey: input.sampleKey,
    offAxisAngleDeg: round(input.offAxisAngleDeg),
    scanAngleDeg: round(input.scanAngleDeg),
    altitudeKm: round(input.altitudeKm),
    slantRangeKm: round(input.slantRangeKm),
    beamDiameterKm: round(input.beamDiameterKm),
    diameterAdaptedBeamDiameterKm: round(diameterAdaptedBeamDiameterKm),
    engineBeamwidth3dBDeg: round(engineBeamwidth3dBDeg),
    engineGainDb: round(engineGainDb),
    engineSampleGainDb: input.engineSampleGainDb === null ? null : round(input.engineSampleGainDb),
    coreRawGainDb: round(coreRawGainDb),
    coreDiameterAdaptedGainDb: round(coreDiameterAdaptedGainDb),
    engineScanLossDb: round(engineScanLossDb),
    coreScanLossDb: round(rawLinkBudget.scanLossDb),
    implementationLossPlacementDiffDb: round(implementationLossPlacementDiffDb),
    rawBeamGainDiffDb: round(rawBeamGainDiffDb),
    diameterAdaptedBeamGainDiffDb: round(diameterAdaptedBeamGainDiffDb),
    rawLinkImpactEstimateDb: round(rawLinkBudget.rxPowerDbm - (
      input.txPowerDbm
      + input.profile.antenna.maxGainDbi
      + engineGainDb
      - engineScanLossDb
      - input.pathLossDb
      + input.profile.ueAntenna.maxGainDbi
    )),
    diameterAdaptedLinkImpactEstimateDb: round(diameterAdaptedLinkBudget.rxPowerDbm - (
      input.txPowerDbm
      + input.profile.antenna.maxGainDbi
      + engineGainDb
      - engineScanLossDb
      - input.pathLossDb
      + input.profile.ueAntenna.maxGainDbi
    )),
    causes: classifyCase({
      engineSampleDiffDb,
      rawDiffDb: rawBeamGainDiffDb,
      diameterAdaptedDiffDb: diameterAdaptedBeamGainDiffDb,
      scanDiffDb,
      implementationLossPlacementDiffDb,
      coreRawGainDb,
      engineGainDb,
      thresholds: input.thresholds,
    }),
  };
}

function createAnalyticCases(fixture: Phase6UFixtureFile): BeamGainCase[] {
  const { profile: defaultProfile } = prepareProfile('hobs-2024-paper-default');
  const { profile: tr38811Profile } = prepareProfile('hobs-2024-tr38811-research');
  const altitudeKm = defaultProfile.orbit.shells[0]?.altitudeKm ?? 550;
  const beamDiameterKm = 2 * altitudeKm * Math.tan(defaultProfile.antenna.beamwidth3dBRad / 2);
  const engineBeamwidth3dBDeg = defaultProfile.antenna.beamwidth3dBRad * (180 / Math.PI);
  const txPowerDbm = defaultProfile.channel.maxTxPowerDbm;
  const noisePowerDbm = defaultProfile.channel.noisePsdDbmHz
    + 10 * Math.log10(defaultProfile.channel.bandwidthMHz * 1e6);
  const pathLossDb = computeCoreFspl(altitudeKm, defaultProfile.channel.frequencyGHz) + 2.15;

  return [
    createCase({
      caseId: 'analytic-center-beam',
      caseKind: 'center-beam',
      profile: defaultProfile,
      source: 'analytic-fixture',
      frameIndex: null,
      simTimeSec: null,
      sampleKey: 'analytic:center',
      offAxisAngleDeg: 0,
      scanAngleDeg: 0,
      altitudeKm,
      slantRangeKm: altitudeKm,
      beamDiameterKm,
      txPowerDbm,
      pathLossDb,
      noisePowerDbm,
      elevationDeg: 90,
      engineSampleGainDb: null,
      thresholds: fixture.thresholds,
    }),
    createCase({
      caseId: 'analytic-off-axis-3db-width',
      caseKind: 'off-axis-beam',
      profile: defaultProfile,
      source: 'analytic-fixture',
      frameIndex: null,
      simTimeSec: null,
      sampleKey: 'analytic:off-axis-3db-width',
      offAxisAngleDeg: engineBeamwidth3dBDeg,
      scanAngleDeg: 0,
      altitudeKm,
      slantRangeKm: altitudeKm,
      beamDiameterKm,
      txPowerDbm,
      pathLossDb,
      noisePowerDbm,
      elevationDeg: 90,
      engineSampleGainDb: null,
      thresholds: fixture.thresholds,
    }),
    createCase({
      caseId: 'analytic-scan-loss',
      caseKind: 'scan-loss',
      profile: defaultProfile,
      source: 'analytic-fixture',
      frameIndex: null,
      simTimeSec: null,
      sampleKey: 'analytic:scan-loss',
      offAxisAngleDeg: engineBeamwidth3dBDeg / 2,
      scanAngleDeg: defaultProfile.antenna.maxSteeringAngleDeg * 0.75,
      altitudeKm,
      slantRangeKm: altitudeKm,
      beamDiameterKm,
      txPowerDbm,
      pathLossDb,
      noisePowerDbm,
      elevationDeg: 70,
      engineSampleGainDb: null,
      thresholds: fixture.thresholds,
    }),
    createCase({
      caseId: 'analytic-tr38811-like',
      caseKind: 'tr38811-like',
      profile: tr38811Profile,
      source: 'analytic-fixture',
      frameIndex: null,
      simTimeSec: null,
      sampleKey: 'analytic:tr38811-like',
      offAxisAngleDeg: engineBeamwidth3dBDeg,
      scanAngleDeg: tr38811Profile.antenna.maxSteeringAngleDeg * 0.5,
      altitudeKm,
      slantRangeKm: altitudeKm / Math.sin(45 * Math.PI / 180),
      beamDiameterKm,
      txPowerDbm: tr38811Profile.channel.maxTxPowerDbm,
      pathLossDb: computeCoreFspl(altitudeKm / Math.sin(45 * Math.PI / 180), tr38811Profile.channel.frequencyGHz) + 2.15,
      noisePowerDbm,
      elevationDeg: 45,
      engineSampleGainDb: null,
      thresholds: fixture.thresholds,
    }),
  ];
}

function collectPhase6TGeometryCases(fixture: Phase6UFixtureFile): BeamGainCase[] {
  const cases: BeamGainCase[] = [];

  for (const windowWithProfile of DEFAULT_WINDOWS) {
    if (!fixture.requiredProfiles.includes(windowWithProfile.profileId)) continue;
    const { profileId, ...window } = windowWithProfile;
    const { profile } = prepareProfile(profileId);
    const runner = createRunner(profile, window);

    for (let frameIndex = 0; frameIndex < window.frameCount; frameIndex += 1) {
      const frame = stepBaselineRunner(runner, window);

      for (const sample of frame.linkSamples) {
        const sat = frame.satellites.find(candidate => candidate.id === sample.satId);
        const beam = findBeamCell(frame, sample);
        if (!sat || !beam) continue;
        const layout = runner.beamLayoutsByShellId.get(sat.shellId);
        const beamDiameterKm = layout?.beamDiameterKm
          ?? sat.altitudeKm * Math.tan(profile.antenna.beamwidth3dBRad / 2) * 2;
        const distanceToUeKm = Math.hypot(beam.offsetEastKm, beam.offsetNorthKm);
        const offAxisAngleDeg = computeEngineOffAxisDeg(distanceToUeKm, sat.altitudeKm);
        const slantRangeKm = frame.linkRangeKmBySatId.get(sample.satId) ?? sat.topo.rangeKm;
        const sampleKey = beamAssignmentKey(sample.satId, sample.beamId);
        const caseKind: CaseKind = profile.id === 'hobs-2024-candidate-rich'
          ? 'candidate-rich'
          : profile.id === 'hobs-2024-tr38811-research'
            ? 'tr38811-like'
            : 'phase6t-shadow-sample';

        cases.push(createCase({
          caseId: `${profile.id}:frame-${frameIndex}:${sampleKey}`,
          caseKind,
          profile,
          source: 'phase6t-shadow-sample',
          frameIndex,
          simTimeSec: frame.simTimeSec,
          sampleKey,
          offAxisAngleDeg,
          scanAngleDeg: beam.scanAngleDeg,
          altitudeKm: sat.altitudeKm,
          slantRangeKm,
          beamDiameterKm,
          txPowerDbm: sample.txPowerDbm,
          pathLossDb: sample.pathLossDb,
          noisePowerDbm: sample.noiseDbm,
          elevationDeg: sat.topo.elevationDeg,
          engineSampleGainDb: sample.beamGainDb,
          thresholds: fixture.thresholds,
        }));
      }
    }
  }

  return cases;
}

function loadPhase6UFixture(): Phase6UFixtureFile {
  const fixture = JSON.parse(readRepoFile(PHASE6U_FIXTURE_PATH)) as Phase6UFixtureFile;
  if (fixture.schemaVersion !== 'phase6u-beam-gain-mismatch-fixture-v1') {
    throw new Error(`${PHASE6U_FIXTURE_PATH} has unexpected schemaVersion ${fixture.schemaVersion}`);
  }
  if (fixture.phase !== '6U') {
    throw new Error(`${PHASE6U_FIXTURE_PATH} has unexpected phase ${fixture.phase}`);
  }
  if (fixture.comparisonMode !== 'validator-only-beam-gain-mismatch-characterization') {
    throw new Error(`${PHASE6U_FIXTURE_PATH} comparisonMode drifted`);
  }
  if (fixture.diagnosticPolicy.runtimeAdoption !== 'not-adopted') {
    throw new Error(`${PHASE6U_FIXTURE_PATH} must keep runtimeAdoption not-adopted`);
  }
  if (!fixture.allowedPhase6UStatuses.includes(fixture.expectedPhase6UStatus)) {
    throw new Error(`${PHASE6U_FIXTURE_PATH} expectedPhase6UStatus is not in allowedPhase6UStatuses`);
  }
  return fixture;
}

function loadPhase6TFixture(fixture: Phase6UFixtureFile): Phase6TFixtureFile {
  if (fixture.phase6TFixturePath !== PHASE6T_FIXTURE_PATH) {
    throw new Error(`${PHASE6U_FIXTURE_PATH} phase6TFixturePath drifted from ${PHASE6T_FIXTURE_PATH}`);
  }
  const phase6TFixture = JSON.parse(readRepoFile(fixture.phase6TFixturePath)) as Phase6TFixtureFile;
  if (phase6TFixture.schemaVersion !== 'phase6t-source-channel-shadow-kpi-fixture-v1') {
    throw new Error(`${fixture.phase6TFixturePath} has unexpected schemaVersion ${phase6TFixture.schemaVersion}`);
  }
  if (phase6TFixture.phase !== '6T') {
    throw new Error(`${fixture.phase6TFixturePath} has unexpected phase ${phase6TFixture.phase}`);
  }
  if (phase6TFixture.sourceChannelPolicy.runtimeAdoption !== 'not-adopted') {
    throw new Error(`${fixture.phase6TFixturePath} must remain validator-only/not adopted`);
  }
  return phase6TFixture;
}

function validateFixtureCoverage(
  fixture: Phase6UFixtureFile,
  phase6TFixture: Phase6TFixtureFile,
  cases: readonly BeamGainCase[],
): string[] {
  const failures: string[] = [];
  const defaultProfileIds = DEFAULT_WINDOWS.map(window => window.profileId);

  for (const requiredProfileId of fixture.requiredProfiles) {
    if (!defaultProfileIds.includes(requiredProfileId)) {
      failures.push(`Phase 6U default window list is missing required profile ${requiredProfileId}`);
    }
    if (!phase6TFixture.requiredProfiles.includes(requiredProfileId)) {
      failures.push(`${PHASE6T_FIXTURE_PATH} is missing required Phase 6U profile ${requiredProfileId}`);
    }
  }

  const coveredKinds = new Set(cases.map(sample => sample.caseKind));
  for (const requiredCaseKind of fixture.requiredCaseKinds) {
    if (!coveredKinds.has(requiredCaseKind)) {
      failures.push(`Phase 6U case coverage is missing ${requiredCaseKind}`);
    }
  }

  const centerCases = cases.filter(sample => sample.caseKind === 'center-beam');
  if (centerCases.length === 0) {
    failures.push('Phase 6U center beam case missing');
  } else {
    const maxCenterAbsDiff = Math.max(...centerCases.map(sample => Math.abs(sample.rawBeamGainDiffDb)));
    if (maxCenterAbsDiff > fixture.thresholds.centerGainAbsToleranceDb) {
      failures.push(`center beam mismatch ${maxCenterAbsDiff} exceeds ${fixture.thresholds.centerGainAbsToleranceDb}`);
    }
  }

  return failures;
}

function validatePackageScript(): string[] {
  const packageJson = JSON.parse(readRepoFile('package.json')) as {
    scripts?: Record<string, string>;
  };
  return packageJson.scripts?.['validate:modqn:phase6u-beam-gain-mismatch'] === VALIDATOR_SCRIPT
    ? []
    : ['package.json is missing validate:modqn:phase6u-beam-gain-mismatch or its command drifted'];
}

function scanRuntimeNonAdoption(): RuntimeScanResult {
  const leaks: string[] = [];
  const importFromCoreChannel = /^\s*import\b.*\bfrom\s+['"][^'"]*(?:@\/core\/channel|src\/core\/channel|core\/channel)[^'"]*['"]/;
  const phase6UTokens = /\b(phase6u|modqn-phase6u-beam-gain-mismatch|validate-modqn-phase6u-beam-gain-mismatch|BeamGainMismatch)\b/i;
  const files = RUNTIME_NON_ADOPTION_SCAN_PATHS
    .flatMap(scanPath => listRepoFiles(scanPath))
    .filter(file => ['.ts', '.tsx', '.json'].includes(extname(file)));

  for (const file of files) {
    const text = readRepoFile(file);
    for (const [lineIndex, line] of text.split(/\r?\n/).entries()) {
      if (importFromCoreChannel.test(line) || phase6UTokens.test(line)) {
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

function summarizeByProfile(cases: readonly BeamGainCase[]): Record<string, {
  sampleCount: number;
  rawAbsBeamGainDiffDb: NumericSummary;
  diameterAdaptedAbsBeamGainDiffDb: NumericSummary;
  rawLinkImpactEstimateAbsDb: NumericSummary;
  diameterAdaptedLinkImpactEstimateAbsDb: NumericSummary;
}> {
  const profileIds = [...new Set(cases.map(sample => sample.profileId))].sort((a, b) => a.localeCompare(b));
  return Object.fromEntries(profileIds.map(profileId => {
    const profileCases = cases.filter(sample => sample.profileId === profileId);
    return [profileId, {
      sampleCount: profileCases.length,
      rawAbsBeamGainDiffDb: absSummary(profileCases, sample => sample.rawBeamGainDiffDb),
      diameterAdaptedAbsBeamGainDiffDb: absSummary(profileCases, sample => sample.diameterAdaptedBeamGainDiffDb),
      rawLinkImpactEstimateAbsDb: absSummary(profileCases, sample => sample.rawLinkImpactEstimateDb),
      diameterAdaptedLinkImpactEstimateAbsDb: absSummary(profileCases, sample => sample.diameterAdaptedLinkImpactEstimateDb),
    }];
  }));
}

function summarizeByCaseKind(cases: readonly BeamGainCase[]): Record<string, {
  sampleCount: number;
  rawAbsBeamGainDiffDb: NumericSummary;
  diameterAdaptedAbsBeamGainDiffDb: NumericSummary;
}> {
  const caseKinds = [...new Set(cases.map(sample => sample.caseKind))].sort((a, b) => a.localeCompare(b));
  return Object.fromEntries(caseKinds.map(caseKind => {
    const matchingCases = cases.filter(sample => sample.caseKind === caseKind);
    return [caseKind, {
      sampleCount: matchingCases.length,
      rawAbsBeamGainDiffDb: absSummary(matchingCases, sample => sample.rawBeamGainDiffDb),
      diameterAdaptedAbsBeamGainDiffDb: absSummary(matchingCases, sample => sample.diameterAdaptedBeamGainDiffDb),
    }];
  }));
}

function summarizeCauses(
  cases: readonly BeamGainCase[],
  fixture: Phase6UFixtureFile,
): CauseSummary[] {
  const rawAbs = absSummary(cases, sample => sample.rawBeamGainDiffDb);
  const adaptedAbs = absSummary(cases, sample => sample.diameterAdaptedBeamGainDiffDb);
  const engineSampleAbs = absSummary(
    cases.filter(sample => sample.engineSampleGainDb !== null),
    sample => (sample.engineSampleGainDb ?? sample.engineGainDb) - sample.engineGainDb,
  );
  const scanAbs = absSummary(cases, sample => sample.coreScanLossDb - sample.engineScanLossDb);
  const implementationAbs = absSummary(cases, sample => sample.implementationLossPlacementDiffDb);
  const floorCount = cases.filter(sample =>
    sample.engineGainDb <= BEAM_GAIN_FLOOR_DB && sample.coreRawGainDb < BEAM_GAIN_FLOOR_DB
  ).length;
  const peakGainAppliesToBessel = cases.some(sample => sample.coreRawGainDb > sample.engineGainDb + 20);

  return [
    {
      cause: 'off-axis-angle-mapping',
      status: (engineSampleAbs.max ?? 0) > fixture.thresholds.engineSampleRecomputeAbsToleranceDb ? 'ROOT_CAUSE' : 'NOT_OBSERVED',
      evidence: `engine sample recompute max abs diff ${engineSampleAbs.max ?? 0} dB`,
    },
    {
      cause: 'beam-diameter-beamwidth-conversion',
      status: (rawAbs.mean ?? 0) > fixture.thresholds.mismatchMeanAbsThresholdDb
        && (adaptedAbs.mean ?? Number.POSITIVE_INFINITY) < (rawAbs.mean ?? 0)
        ? 'ROOT_CAUSE'
        : 'NOT_OBSERVED',
      evidence: `raw mean abs diff ${rawAbs.mean ?? 0} dB; diameter-adapted mean abs diff ${adaptedAbs.mean ?? 0} dB`,
    },
    {
      cause: 'peak-gain-convention',
      status: peakGainAppliesToBessel ? 'SECONDARY' : 'NOT_OBSERVED',
      evidence: 'both Bessel paths emit relative beam-pattern gain; antenna max gain is applied outside the Bessel helper',
    },
    {
      cause: 'antenna-model-mismatch',
      status: (adaptedAbs.p50 ?? 0) > fixture.thresholds.modelDifferenceP50ResidualThresholdDb ? 'ROOT_CAUSE' : 'NOT_OBSERVED',
      evidence: `diameter-adapted p50 residual ${adaptedAbs.p50 ?? 0} dB; threshold ${fixture.thresholds.modelDifferenceP50ResidualThresholdDb} dB`,
    },
    {
      cause: 'scan-loss-mapping',
      status: (scanAbs.max ?? 0) > fixture.thresholds.scanLossAbsToleranceDb ? 'ROOT_CAUSE' : 'NOT_OBSERVED',
      evidence: `scan-loss max abs diff ${scanAbs.max ?? 0} dB`,
    },
    {
      cause: 'implementation-loss-placement',
      status: (implementationAbs.max ?? 0) > fixture.thresholds.implementationLossPlacementAbsToleranceDb ? 'ROOT_CAUSE' : 'NOT_OBSERVED',
      evidence: `implementation-loss placement max abs diff ${implementationAbs.max ?? 0} dB`,
    },
    {
      cause: 'beam-gain-floor-convention',
      status: floorCount > 0 ? 'SECONDARY' : 'NOT_APPLICABLE',
      evidence: `${floorCount} covered cases reached the engine ${BEAM_GAIN_FLOOR_DB} dB floor while core remained below that floor`,
    },
  ];
}

function phase6UStatusFromEvidence(
  cases: readonly BeamGainCase[],
  causeSummary: readonly CauseSummary[],
  structuralFailures: readonly string[],
  fixture: Phase6UFixtureFile,
): Phase6UStatus {
  if (structuralFailures.length > 0) return 'MISMATCH_CHARACTERIZED';
  const rawAbs = absSummary(cases, sample => sample.rawBeamGainDiffDb);
  const adaptedAbs = absSummary(cases, sample => sample.diameterAdaptedBeamGainDiffDb);
  const hasModelRootCause = causeSummary.some(summary =>
    summary.cause === 'antenna-model-mismatch' && summary.status === 'ROOT_CAUSE'
  );

  if (hasModelRootCause) return 'BLOCKED_BY_MODEL_DIFFERENCE';
  if (
    (rawAbs.mean ?? 0) > fixture.thresholds.mismatchMeanAbsThresholdDb
    && (adaptedAbs.p50 ?? Number.POSITIVE_INFINITY) <= fixture.thresholds.adapterReadyP50ResidualThresholdDb
  ) {
    return 'ADAPTER_MAPPING_FIX_READY';
  }
  return 'MISMATCH_CHARACTERIZED';
}

function representativeCases(cases: readonly BeamGainCase[]): BeamGainCase[] {
  const selected: BeamGainCase[] = [];
  for (const caseKind of ['center-beam', 'off-axis-beam', 'scan-loss', 'candidate-rich', 'tr38811-like'] as const) {
    const matches = cases.filter(sample => sample.caseKind === caseKind);
    if (matches.length === 0) continue;
    selected.push(matches.reduce((best, sample) =>
      Math.abs(sample.rawBeamGainDiffDb) > Math.abs(best.rawBeamGainDiffDb) ? sample : best,
    ));
  }
  return selected;
}

function run(): void {
  const fixture = loadPhase6UFixture();
  const phase6TFixture = loadPhase6TFixture(fixture);
  const runtimeScan = scanRuntimeNonAdoption();
  const unsupportedClaimScan = scanUnsupported1937Claims();
  const replayEvidenceClaimScan = scanModqnReplayEvidenceClaims();
  const packageScriptFailures = validatePackageScript();
  const cases = [
    ...createAnalyticCases(fixture),
    ...collectPhase6TGeometryCases(fixture),
  ];
  const fixtureFailures = validateFixtureCoverage(fixture, phase6TFixture, cases);
  const causeSummary = summarizeCauses(cases, fixture);
  const structuralFailures = [
    ...fixtureFailures,
    ...packageScriptFailures,
    ...runtimeScan.leaks.map(leak => `runtime adoption leak: ${leak}`),
    ...unsupportedClaimScan.leaks.map(leak => `unsupported 19/37 claim: ${leak}`),
    ...replayEvidenceClaimScan.leaks.map(leak => `MODQN replay evidence claim leak: ${leak}`),
  ];
  const phase6UStatus = phase6UStatusFromEvidence(cases, causeSummary, structuralFailures, fixture);

  if (phase6UStatus !== fixture.expectedPhase6UStatus) {
    structuralFailures.push(
      `${PHASE6U_FIXTURE_PATH} expected ${fixture.expectedPhase6UStatus}, computed ${phase6UStatus}`,
    );
  }

  const gitHead = gitOutput(['rev-parse', 'HEAD']);
  const rawAbsBeamGainDiffDb = absSummary(cases, sample => sample.rawBeamGainDiffDb);
  const diameterAdaptedAbsBeamGainDiffDb = absSummary(cases, sample => sample.diameterAdaptedBeamGainDiffDb);
  const rawLinkImpactEstimateAbsDb = absSummary(cases, sample => sample.rawLinkImpactEstimateDb);
  const diameterAdaptedLinkImpactEstimateAbsDb = absSummary(cases, sample => sample.diameterAdaptedLinkImpactEstimateDb);
  const summary = {
    schemaVersion: SUMMARY_SCHEMA_VERSION,
    phase: '6U',
    repo: 'leo-beam-sim',
    validator: VALIDATOR_SCRIPT,
    phase6UFixturePath: PHASE6U_FIXTURE_PATH,
    phase6TFixturePath: PHASE6T_FIXTURE_PATH,
    generatedAt: new Date().toISOString(),
    gitHead,
    runtimeBehaviorChanged: false,
    browserSmokeRun: false,
    runtimeAdoption: {
      status: 'not-adopted',
      evidence: runtimeScan,
      liveRuntimeImportsPhase6UValidator: false,
      liveRuntimeImportsCoreChannel: runtimeScan.status !== 'PASS',
    },
    phase6UStatus,
    adapterOnlyFixReady: phase6UStatus === 'ADAPTER_MAPPING_FIX_READY',
    structuralFailures,
    unsupported1937TrainedBaselineClaimScan: unsupportedClaimScan.status,
    modqnReplayEvidenceClaimScan: replayEvidenceClaimScan.status,
    caseCount: cases.length,
    rawAbsBeamGainDiffDb,
    diameterAdaptedAbsBeamGainDiffDb,
    rawLinkImpactEstimateAbsDb,
    diameterAdaptedLinkImpactEstimateAbsDb,
    byProfile: summarizeByProfile(cases),
    byCaseKind: summarizeByCaseKind(cases),
    causeSummary,
    representativeCases: representativeCases(cases).map(sample => ({
      caseId: sample.caseId,
      caseKind: sample.caseKind,
      profileId: sample.profileId,
      sampleKey: sample.sampleKey,
      offAxisAngleDeg: sample.offAxisAngleDeg,
      scanAngleDeg: sample.scanAngleDeg,
      engineGainDb: sample.engineGainDb,
      coreRawGainDb: sample.coreRawGainDb,
      coreDiameterAdaptedGainDb: sample.coreDiameterAdaptedGainDb,
      rawBeamGainDiffDb: sample.rawBeamGainDiffDb,
      diameterAdaptedBeamGainDiffDb: sample.diameterAdaptedBeamGainDiffDb,
      rawLinkImpactEstimateDb: sample.rawLinkImpactEstimateDb,
      causes: sample.causes,
    })),
    recommendation: phase6UStatus === 'ADAPTER_MAPPING_FIX_READY'
      ? 'Phase 6V may implement an adapter-only diameter/beamwidth mapping fix, then rerun Phase 6T before any runtime adoption.'
      : 'Phase 6V should stay validator-only or adapter-design-only: resolve the J1+J3 antenna-pattern convention before changing live runtime behavior.',
  };

  console.log(`MODQN Phase 6U beam-gain mismatch status: ${phase6UStatus}`);
  console.log(JSON.stringify(summary, null, 2));

  if (structuralFailures.length > 0) {
    process.exitCode = 1;
  }
}

run();
