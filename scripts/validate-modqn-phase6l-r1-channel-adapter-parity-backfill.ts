import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateHexagonalBeamLayout } from '../src/core/beam/layout.ts';
import {
  computeLinkBudget as computeCoreLinkBudget,
  computeSinr as computeCoreSinr,
} from '../src/core/channel/index.ts';
import { sampleLosStateTr38811 } from '../src/core/channel/los-probability.ts';
import type { ChannelResult, DeploymentEnvironment, LinkBudgetOptions } from '../src/core/channel/types.ts';
import { computeLinkBudget as computeRuntimeLinkBudget } from '../src/engine/signal/link-budget.ts';
import type {
  ActiveBeamAssignment,
  LinkSample,
  SatelliteSnapshot,
  UEPosition,
} from '../src/engine/signal/types.ts';
import {
  MODQN_BEAM_COUNT_CLAIM_LABELS,
  getModqnBeamCountBridgeClaim,
} from '../src/modqn/replay-bundle/index.ts';
import { loadProfile } from '../src/profiles/index.ts';
import type { GainModel, Profile } from '../src/profiles/types.ts';

type NumberForJson = number | 'Infinity' | '-Infinity' | 'NaN';
type DiffStatus = 'MATCH' | 'MISMATCH' | 'SENTINEL_MATCH' | 'SENTINEL_MISMATCH';

interface Scenario {
  caseId: string;
  description: string;
  profile: Profile;
  ue: UEPosition;
  satellites: SatelliteSnapshot[];
  activeAssignments: ActiveBeamAssignment[];
  simTimeSec: number;
  beamPowerOverrideDbmByKey?: ReadonlyMap<string, number>;
}

interface CoreSample {
  key: string;
  sample: LinkSample;
  channelResult: ChannelResult;
  coreReuseGroup: number | null;
  coreCoChannelKeys: string[];
}

interface NumericDiff {
  field: keyof LinkSample;
  runtime: NumberForJson;
  core: NumberForJson;
  absDiffDb: number | null;
  status: DiffStatus;
}

interface SampleComparison {
  key: string;
  runtimeCoChannelKeys: string[];
  coreCoChannelKeys: string[];
  reuseGroup: {
    runtimeFrequencyReuse: number;
    runtimeFrequencyIndex: number;
    coreLayoutFrequencyReuse: number | null;
    coreReuseGroup: number | null;
    status: 'CORE_BACKED' | 'INTENTIONAL_NON_CORE_PARITY';
  };
  channelResult: {
    fsplDb: NumberForJson;
    shadowFadingDb: NumberForJson;
    clutterLossDb: NumberForJson;
    implementationLossDb: NumberForJson;
    beamGainDb: NumberForJson;
    atmosphericDb: NumberForJson;
    scanLossDb: NumberForJson;
    totalPathLossDb: NumberForJson;
    rxPowerDbm: NumberForJson;
  };
  diffs: NumericDiff[];
  mismatchCount: number;
}

interface CaseSummary {
  caseId: string;
  description: string;
  profileId: string;
  formulaFamily: Profile['formulaFamily'];
  activeAssignmentKeys: string[];
  comparedSampleCount: number;
  mismatchCount: number;
  maxAbsDiffDb: number | null;
  samples: SampleComparison[];
}

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const VALIDATOR_SCRIPT = 'node --import tsx/esm scripts/validate-modqn-phase6l-r1-channel-adapter-parity-backfill.ts';
const SUMMARY_SCHEMA_VERSION = 'phase6l-r1-channel-adapter-parity-backfill-summary-v1';
const DB_TOLERANCE = 1e-6;

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

const COMPARED_LINK_SAMPLE_FIELDS = [
  'rsrpDbm',
  'sinrDb',
  'signalDbm',
  'intraInterferenceDbm',
  'interInterferenceDbm',
  'noiseDbm',
  'denominatorDbm',
  'txPowerDbm',
  'pathLossDb',
  'beamGainDb',
  'steeringLossDb',
  'receiverGainDbi',
] as const satisfies ReadonlyArray<keyof LinkSample>;

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

function cloneProfile(profile: Profile): Profile {
  return JSON.parse(JSON.stringify(profile)) as Profile;
}

function beamAssignmentKey(assignment: ActiveBeamAssignment): string {
  return `${assignment.satId}:${assignment.beamId}`;
}

function dbmToMw(dbm: number): number {
  if (!Number.isFinite(dbm) || dbm < -300) return 0;
  return 10 ** (dbm / 10);
}

function mwToDbm(milliwatts: number): number {
  if (!Number.isFinite(milliwatts) || milliwatts <= 0) return Number.NEGATIVE_INFINITY;
  return 10 * Math.log10(milliwatts);
}

function round(value: number): number {
  if (!Number.isFinite(value)) return value;
  return Math.round(value * 1_000_000) / 1_000_000;
}

function numberForJson(value: number): NumberForJson {
  if (value === Number.POSITIVE_INFINITY) return 'Infinity';
  if (value === Number.NEGATIVE_INFINITY) return '-Infinity';
  if (Number.isNaN(value)) return 'NaN';
  return round(value);
}

function normalizeGainModel(model: GainModel): NonNullable<LinkBudgetOptions['beamGainInput']>['model'] {
  if (model === 'bessel-j1-j3') return 'bessel-j1j3';
  if (model === 'bessel-j1') return 'bessel-j1';
  return 'flat-debug';
}

function beamDiameterKm(profile: Profile, altitudeKm: number): number {
  return 2 * altitudeKm * Math.tan(profile.antenna.beamwidth3dBRad / 2);
}

function runtimeFrequencyIndex(beamId: number, frequencyReuse: number): number {
  const groups = Math.max(1, Math.floor(frequencyReuse));
  return (Math.max(1, Math.floor(beamId)) - 1) % groups;
}

function coreLayoutFrequencyReuse(frequencyReuse: number): number | null {
  const normalized = Math.max(1, Math.floor(frequencyReuse));
  return normalized === 1 || normalized === 3 || normalized === 7 ? normalized : null;
}

function coreReuseGroupForBeam(
  profile: Profile,
  sat: SatelliteSnapshot,
  beamId: number,
): number | null {
  const frf = coreLayoutFrequencyReuse(profile.beams.frequencyReuse);
  if (frf === null) return null;
  const layout = generateHexagonalBeamLayout({
    satId: sat.id,
    numBeams: profile.beams.perSatellite,
    beamDiameterKm: beamDiameterKm(profile, sat.altitudeKm),
    altitudeKm: sat.altitudeKm,
    frf,
  });
  return layout.beams[beamId - 1]?.reuseGroup ?? null;
}

function linkSamplePathLossFromCore(result: ChannelResult): number {
  return result.fsplDb
    + result.shadowFadingDb
    + result.clutterLossDb
    + result.implementationLossDb
    + result.atmosphericDb;
}

function linkBudgetOptionsForCore(
  scenario: Scenario,
  sat: SatelliteSnapshot,
  beam: SatelliteSnapshot['beamCellsKm'][number],
  runtimeSample: LinkSample,
): LinkBudgetOptions {
  const profile = scenario.profile;
  const environment = (profile.channel.tr38811?.environment ?? 'suburban') as DeploymentEnvironment;
  const losSeedKey = `${sat.id}|${beam.beamId}|${Math.floor(scenario.simTimeSec)}`;
  const isLos = profile.formulaFamily === 'hobs-tr38811'
    ? sampleLosStateTr38811(sat.elevationDeg, environment, losSeedKey)
    : true;
  const dEast = scenario.ue.offsetEastKm - beam.offsetEastKm;
  const dNorth = scenario.ue.offsetNorthKm - beam.offsetNorthKm;
  const offAxisAngleDeg = (Math.atan(Math.hypot(dEast, dNorth) / Math.max(sat.altitudeKm, 1e-6)) * 180) / Math.PI;
  const bandwidthHz = profile.channel.bandwidthMHz * 1e6;
  const noisePowerDbm = profile.channel.noisePsdDbmHz + 10 * Math.log10(bandwidthHz);

  return {
    distanceKm: sat.rangeKm,
    frequencyGhz: profile.channel.frequencyGHz,
    txEirpDbm: runtimeSample.txPowerDbm + profile.antenna.maxGainDbi,
    rxAntennaGainDb: profile.ueAntenna.maxGainDbi,
    elevationDeg: sat.elevationDeg,
    environment,
    largeScaleModel: '3gpp-extended',
    beamGainInput: {
      offAxisAngleDeg,
      model: normalizeGainModel(profile.antenna.model),
      peakGainDbi: profile.antenna.model === 'flat' ? 0 : profile.antenna.maxGainDbi,
      beamDiameterKm: beamDiameterKm(profile, sat.altitudeKm),
      altitudeKm: sat.altitudeKm,
      slantRangeKm: sat.rangeKm,
    },
    noisePowerDbm,
    implementationLossDb: 0,
    tier1LargeScale: false,
    tier2Clutter: profile.formulaFamily === 'hobs-tr38811' && !isLos,
    tier3BeamGain: true,
    tier35ScanLoss: true,
    tier4Atmospheric: profile.channel.pathLossComponents.includes('atmospheric')
      || profile.channel.pathLossComponents.includes('scintillation'),
    tier5Fading: false,
    scanAngleDeg: beam.scanAngleDeg,
    scanMaxAngleDeg: profile.antenna.maxSteeringAngleDeg,
    scanLossMaxDb: profile.antenna.scanLossAtMaxSteeringDb,
    rngNext: null,
    isLos,
  };
}

function compareNumber(field: keyof LinkSample, runtime: number, core: number): NumericDiff {
  const runtimeFinite = Number.isFinite(runtime);
  const coreFinite = Number.isFinite(core);

  if (!runtimeFinite || !coreFinite) {
    return {
      field,
      runtime: numberForJson(runtime),
      core: numberForJson(core),
      absDiffDb: null,
      status: Object.is(runtime, core) ? 'SENTINEL_MATCH' : 'SENTINEL_MISMATCH',
    };
  }

  const absDiffDb = Math.abs(runtime - core);
  return {
    field,
    runtime: numberForJson(runtime),
    core: numberForJson(core),
    absDiffDb: round(absDiffDb),
    status: absDiffDb <= DB_TOLERANCE ? 'MATCH' : 'MISMATCH',
  };
}

function findRuntimeSample(samples: readonly LinkSample[], assignment: ActiveBeamAssignment): LinkSample {
  const sample = samples.find(candidate =>
    candidate.satId === assignment.satId && candidate.beamId === assignment.beamId,
  );
  if (!sample) {
    throw new Error(`missing runtime sample for ${beamAssignmentKey(assignment)}`);
  }
  return sample;
}

function buildCoreSamples(scenario: Scenario, runtimeSamples: readonly LinkSample[]): Map<string, CoreSample> {
  const coreSamples = new Map<string, CoreSample>();
  const runtimeByKey = new Map(runtimeSamples.map(sample => [`${sample.satId}:${sample.beamId}`, sample]));
  const activeKeys = new Set(scenario.activeAssignments.map(beamAssignmentKey));

  for (const sat of scenario.satellites) {
    for (const beam of sat.beamCellsKm) {
      const key = `${sat.id}:${beam.beamId}`;
      const runtimeSample = runtimeByKey.get(key);
      if (!runtimeSample) continue;
      const channelResult = computeCoreLinkBudget(linkBudgetOptionsForCore(scenario, sat, beam, runtimeSample));
      coreSamples.set(key, {
        key,
        channelResult,
        coreReuseGroup: coreReuseGroupForBeam(scenario.profile, sat, beam.beamId),
        coreCoChannelKeys: [],
        sample: {
          satId: sat.id,
          beamId: beam.beamId,
          rsrpDbm: channelResult.rxPowerDbm,
          sinrDb: Number.NEGATIVE_INFINITY,
          signalDbm: channelResult.rxPowerDbm,
          intraInterferenceDbm: Number.NEGATIVE_INFINITY,
          interInterferenceDbm: Number.NEGATIVE_INFINITY,
          noiseDbm: runtimeSample.noiseDbm,
          denominatorDbm: runtimeSample.noiseDbm,
          txPowerDbm: runtimeSample.txPowerDbm,
          pathLossDb: linkSamplePathLossFromCore(channelResult),
          beamGainDb: channelResult.beamGainDb,
          steeringLossDb: channelResult.scanLossDb,
          receiverGainDbi: runtimeSample.receiverGainDbi,
        },
      });
    }
  }

  for (const [key, entry] of coreSamples.entries()) {
    const sample = entry.sample;
    const intraPowers: number[] = [];
    const interPowers: number[] = [];
    const coChannelKeys: string[] = [];

    for (const [otherKey, other] of coreSamples.entries()) {
      if (otherKey === key || !activeKeys.has(otherKey)) continue;
      if (entry.coreReuseGroup === null || other.coreReuseGroup === null) continue;
      if (entry.coreReuseGroup !== other.coreReuseGroup) continue;
      coChannelKeys.push(otherKey);
      if (other.sample.satId === sample.satId) {
        intraPowers.push(other.channelResult.rxPowerDbm);
      } else {
        interPowers.push(other.channelResult.rxPowerDbm);
      }
    }

    const sinrResult = computeCoreSinr({
      associationActive: true,
      servingRxPowerDbm: entry.channelResult.rxPowerDbm,
      noisePowerDbm: sample.noiseDbm,
      intraInterferingRxPowersDbm: intraPowers,
      interInterferingRxPowersDbm: interPowers,
    });
    const intraMw = intraPowers.reduce((sum, value) => sum + dbmToMw(value), 0);
    const interMw = interPowers.reduce((sum, value) => sum + dbmToMw(value), 0);

    entry.coreCoChannelKeys = coChannelKeys.sort((a, b) => a.localeCompare(b));
    entry.sample = {
      ...sample,
      sinrDb: sinrResult.sinrDb,
      signalDbm: sinrResult.signalDbm,
      intraInterferenceDbm: mwToDbm(intraMw),
      interInterferenceDbm: mwToDbm(interMw),
      noiseDbm: sinrResult.noiseDbm,
      denominatorDbm: mwToDbm(intraMw + interMw + dbmToMw(sample.noiseDbm)),
    };
  }

  return coreSamples;
}

function runtimeCoChannelKeys(
  scenario: Scenario,
  assignment: ActiveBeamAssignment,
): string[] {
  const targetIndex = runtimeFrequencyIndex(assignment.beamId, scenario.profile.beams.frequencyReuse);
  return scenario.activeAssignments
    .filter(other =>
      !(other.satId === assignment.satId && other.beamId === assignment.beamId)
      && runtimeFrequencyIndex(other.beamId, scenario.profile.beams.frequencyReuse) === targetIndex,
    )
    .map(beamAssignmentKey)
    .sort((a, b) => a.localeCompare(b));
}

function evaluateScenario(scenario: Scenario): CaseSummary {
  const runtimeSamples = computeRuntimeLinkBudget(scenario.ue, scenario.satellites, {
    formulaFamily: scenario.profile.formulaFamily,
    channel: scenario.profile.channel,
    antenna: scenario.profile.antenna,
    ueAntenna: scenario.profile.ueAntenna,
    beams: scenario.profile.beams,
    activeAssignments: scenario.activeAssignments,
    simTimeSec: scenario.simTimeSec,
    beamPowerOverrideDbmByKey: scenario.beamPowerOverrideDbmByKey,
  });
  const coreSamples = buildCoreSamples(scenario, runtimeSamples);
  const samples: SampleComparison[] = [];

  for (const assignment of scenario.activeAssignments) {
    const key = beamAssignmentKey(assignment);
    const runtimeSample = findRuntimeSample(runtimeSamples, assignment);
    const coreSample = coreSamples.get(key);
    if (!coreSample) {
      throw new Error(`missing core sample for ${key}`);
    }

    const diffs = COMPARED_LINK_SAMPLE_FIELDS.map(field =>
      compareNumber(field, runtimeSample[field], coreSample.sample[field]),
    );
    samples.push({
      key,
      runtimeCoChannelKeys: runtimeCoChannelKeys(scenario, assignment),
      coreCoChannelKeys: coreSample.coreCoChannelKeys,
      reuseGroup: {
        runtimeFrequencyReuse: scenario.profile.beams.frequencyReuse,
        runtimeFrequencyIndex: runtimeFrequencyIndex(assignment.beamId, scenario.profile.beams.frequencyReuse),
        coreLayoutFrequencyReuse: coreLayoutFrequencyReuse(scenario.profile.beams.frequencyReuse),
        coreReuseGroup: coreSample.coreReuseGroup,
        status: coreLayoutFrequencyReuse(scenario.profile.beams.frequencyReuse) === null
          ? 'INTENTIONAL_NON_CORE_PARITY'
          : 'CORE_BACKED',
      },
      channelResult: Object.fromEntries(
        Object.entries(coreSample.channelResult).map(([field, value]) => [field, numberForJson(value)]),
      ) as SampleComparison['channelResult'],
      diffs,
      mismatchCount: diffs.filter(diff => diff.status === 'MISMATCH' || diff.status === 'SENTINEL_MISMATCH').length,
    });
  }

  const finiteDiffs = samples
    .flatMap(sample => sample.diffs)
    .map(diff => diff.absDiffDb)
    .filter((diff): diff is number => diff !== null);

  return {
    caseId: scenario.caseId,
    description: scenario.description,
    profileId: scenario.profile.id,
    formulaFamily: scenario.profile.formulaFamily,
    activeAssignmentKeys: scenario.activeAssignments.map(beamAssignmentKey),
    comparedSampleCount: samples.length,
    mismatchCount: samples.reduce((sum, sample) => sum + sample.mismatchCount, 0),
    maxAbsDiffDb: finiteDiffs.length > 0 ? round(Math.max(...finiteDiffs)) : null,
    samples,
  };
}

function createSatellite(
  profile: Profile,
  satId: string,
  rangeKm: number,
  elevationDeg: number,
  azimuthDeg: number,
): SatelliteSnapshot {
  const altitudeKm = profile.orbit.shells[0].altitudeKm;
  const layout = generateHexagonalBeamLayout({
    satId,
    numBeams: profile.beams.perSatellite,
    beamDiameterKm: beamDiameterKm(profile, altitudeKm),
    altitudeKm,
    frf: coreLayoutFrequencyReuse(profile.beams.frequencyReuse) ?? 1,
  });

  return {
    id: satId,
    shellId: profile.orbit.shells[0].id,
    altitudeKm,
    ecefKm: [0, 0, 0],
    rangeKm,
    elevationDeg,
    azimuthDeg,
    beamCellsKm: layout.beams.map((beam, index) => ({
      beamId: index + 1,
      offsetEastKm: beam.offsetEastKm,
      offsetNorthKm: beam.offsetNorthKm,
      scanAngleDeg: (Math.atan(Math.hypot(beam.offsetEastKm, beam.offsetNorthKm) / altitudeKm) * 180) / Math.PI,
    })),
  };
}

function createScenarios(): Scenario[] {
  const fsplControl = cloneProfile(loadProfile('hobs-2024-paper-default'));
  fsplControl.id = 'phase6l-r1-fspl-control';
  fsplControl.channel.pathLossComponents = ['fspl'];

  const hobsDefault = cloneProfile(loadProfile('hobs-2024-paper-default'));
  const rxGainProbe = cloneProfile(fsplControl);
  rxGainProbe.id = 'phase6l-r1-rx-gain-probe';
  rxGainProbe.ueAntenna.maxGainDbi = 3;

  const tr38811Dpc = cloneProfile(loadProfile('hobs-2024-tr38811-research'));
  const ue: UEPosition = {
    latDeg: 40,
    lonDeg: 116,
    offsetEastKm: 0,
    offsetNorthKm: 0,
  };

  return [
    {
      caseId: 'fspl-center-control',
      description: 'FSPL-only center beam control; expected to prove the comparator can observe near-parity.',
      profile: fsplControl,
      ue,
      satellites: [createSatellite(fsplControl, 'phase6l-r1-A', 1200, 45, 140)],
      activeAssignments: [{ satId: 'phase6l-r1-A', beamId: 1 }],
      simTimeSec: 100,
    },
    {
      caseId: 'hobs-local-loss-offaxis',
      description: 'Current HOBS path-loss components and off-axis beam gain versus raw vendored source channel tiers.',
      profile: hobsDefault,
      ue,
      satellites: [createSatellite(hobsDefault, 'phase6l-r1-B', 1200, 35, 155)],
      activeAssignments: [{ satId: 'phase6l-r1-B', beamId: 2 }],
      simTimeSec: 125,
    },
    {
      caseId: 'runtime-k3-numeric-intra-vs-core-reuse',
      description: 'Runtime numeric K=3 co-channel selection versus core layout reuse-group selection.',
      profile: fsplControl,
      ue,
      satellites: [createSatellite(fsplControl, 'phase6l-r1-C', 1180, 42, 120)],
      activeAssignments: [
        { satId: 'phase6l-r1-C', beamId: 1 },
        { satId: 'phase6l-r1-C', beamId: 4 },
      ],
      simTimeSec: 150,
    },
    {
      caseId: 'receiver-gain-interference-convention',
      description: 'Runtime applies UE receiver gain to desired signal only; source channel rx gain is per-link.',
      profile: rxGainProbe,
      ue,
      satellites: [
        createSatellite(rxGainProbe, 'phase6l-r1-D1', 1100, 50, 100),
        createSatellite(rxGainProbe, 'phase6l-r1-D2', 1135, 48, 105),
      ],
      activeAssignments: [
        { satId: 'phase6l-r1-D1', beamId: 1 },
        { satId: 'phase6l-r1-D2', beamId: 1 },
      ],
      simTimeSec: 175,
    },
    {
      caseId: 'tr38811-dpc-source-tier-probe',
      description: 'TR 38.811 profile with fixed DPC powers; current runtime remains the behavior path.',
      profile: tr38811Dpc,
      ue,
      satellites: [
        createSatellite(tr38811Dpc, 'phase6l-r1-E1', 1350, 18, 80),
        createSatellite(tr38811Dpc, 'phase6l-r1-E2', 1390, 22, 90),
      ],
      activeAssignments: [
        { satId: 'phase6l-r1-E1', beamId: 1 },
        { satId: 'phase6l-r1-E2', beamId: 1 },
      ],
      beamPowerOverrideDbmByKey: new Map([
        ['phase6l-r1-E1:1', 44.5],
        ['phase6l-r1-E2:1', 46],
      ]),
      simTimeSec: 210,
    },
  ];
}

function validatePackageScript(): string[] {
  const packageJson = JSON.parse(readRepoFile('package.json')) as {
    scripts?: Record<string, string>;
  };
  return packageJson.scripts?.['validate:modqn:phase6l-r1-channel-adapter-parity-backfill'] === VALIDATOR_SCRIPT
    ? []
    : ['package.json is missing validate:modqn:phase6l-r1-channel-adapter-parity-backfill or its command drifted'];
}

function scanRuntimeNonAdoption(): { status: 'PASS' | 'FAIL'; leaks: string[]; scannedPaths: readonly string[] } {
  const leaks: string[] = [];
  const importFromCoreChannel = /^\s*import\b.*\bfrom\s+['"][^'"]*(?:@\/core\/channel|src\/core\/channel|core\/channel|\/core\/channel)[^'"]*['"]/;
  const phase6LBackfillTokens = /\b(phase6l-r1-channel-adapter-parity-backfill|validate-modqn-phase6l-r1-channel-adapter-parity-backfill)\b/i;
  const files = RUNTIME_NON_ADOPTION_SCAN_PATHS
    .flatMap(scanPath => listRepoFiles(scanPath))
    .filter(file => ['.ts', '.tsx', '.json'].includes(extname(file)));

  for (const file of files) {
    const text = readRepoFile(file);
    for (const [lineIndex, line] of text.split(/\r?\n/).entries()) {
      if (importFromCoreChannel.test(line) || phase6LBackfillTokens.test(line)) {
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

function validateClaimBoundary(): string[] {
  const failures: string[] = [];

  if (!/baseline/i.test(MODQN_BEAM_COUNT_CLAIM_LABELS[7])) {
    failures.push('7-beam claim label lost baseline boundary');
  }

  for (const beamCount of [19, 37] as const) {
    const claim = getModqnBeamCountBridgeClaim(beamCount);
    if (claim.kind !== 'live-sensitivity-demo-only') {
      failures.push(`${beamCount} claim kind drifted to ${claim.kind}`);
    }
    if (claim.supportsProducerReplayEvidence !== false) {
      failures.push(`${beamCount} leaked producer replay evidence support`);
    }
    if (claim.mayDeriveProducerBeamIdentity !== false) {
      failures.push(`${beamCount} leaked producer identity derivation`);
    }
    if (/baseline/i.test(claim.label)) {
      failures.push(`${beamCount} label leaked baseline wording`);
    }
  }

  return failures;
}

function aggregateMaxDiffByField(cases: readonly CaseSummary[]): Partial<Record<keyof LinkSample, number>> {
  const maxByField: Partial<Record<keyof LinkSample, number>> = {};

  for (const diff of cases.flatMap(caseSummary => caseSummary.samples.flatMap(sample => sample.diffs))) {
    if (diff.absDiffDb === null) continue;
    maxByField[diff.field] = Math.max(maxByField[diff.field] ?? 0, diff.absDiffDb);
  }

  return Object.fromEntries(
    Object.entries(maxByField).sort(([left], [right]) => left.localeCompare(right)),
  ) as Partial<Record<keyof LinkSample, number>>;
}

function run(): void {
  const runtimeScan = scanRuntimeNonAdoption();
  const packageScriptFailures = validatePackageScript();
  const claimBoundaryFailures = validateClaimBoundary();
  const cases = createScenarios().map(evaluateScenario);
  const structuralFailures = [
    ...packageScriptFailures,
    ...claimBoundaryFailures,
    ...runtimeScan.leaks.map(leak => `runtime adoption leak: ${leak}`),
  ];
  const totalMismatchCount = cases.reduce((sum, caseSummary) => sum + caseSummary.mismatchCount, 0);
  const summary = {
    schemaVersion: SUMMARY_SCHEMA_VERSION,
    phase: '6L-R1',
    repo: 'leo-beam-sim',
    validator: VALIDATOR_SCRIPT,
    generatedAt: new Date().toISOString(),
    runtimeBehaviorChanged: false,
    runtimeAdoption: {
      status: 'not-adopted',
      evidence: runtimeScan,
      liveRuntimeImportsPhase6LR1BackfillValidator: false,
      liveRuntimeImportsCoreChannel: runtimeScan.status !== 'PASS',
    },
    comparisonPolicy: {
      runtimePath: 'src/engine/signal/link-budget.ts',
      corePath: 'src/core/channel/index.ts',
      implementationLossShim: 'disabled',
      sourceTierPolicy: 'core atmospheric/clutter/beam/scan tiers are allowed; stochastic fading tiers disabled',
      mismatchHandling: 'quantified-only; mismatches do not rewrite runtime behavior',
    },
    claimBoundary: {
      7: MODQN_BEAM_COUNT_CLAIM_LABELS[7],
      19: MODQN_BEAM_COUNT_CLAIM_LABELS[19],
      37: MODQN_BEAM_COUNT_CLAIM_LABELS[37],
    },
    status: structuralFailures.length > 0
      ? 'STRUCTURAL_FAILURE'
      : totalMismatchCount > 0
        ? 'MISMATCHES_QUANTIFIED'
        : 'PARITY_WITHIN_TOLERANCE',
    structuralFailures,
    caseCount: cases.length,
    comparedSampleCount: cases.reduce((sum, caseSummary) => sum + caseSummary.comparedSampleCount, 0),
    totalMismatchCount,
    maxAbsDiffByField: aggregateMaxDiffByField(cases),
    cases,
  };

  assert.equal(cases.length >= 5, true, 'Phase 6L-R1 backfill should cover the fixed parity-readiness scenario set');
  console.log(`MODQN Phase 6L-R1 channel adapter parity backfill status: ${summary.status}`);
  console.log(JSON.stringify(summary, null, 2));

  if (structuralFailures.length > 0) {
    process.exitCode = 1;
  }
}

run();
