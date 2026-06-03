/**
 * Phase 6o channel-adapter parity — SELF-REGRESSION validator.
 *
 * Scope honesty (provenance audit 2026-06-04): this recomputes leo's VENDORED
 * `src/core/channel` (`computeLinkBudget` / `computeSinr`) against a COMMITTED
 * leo fixture (`scripts/fixtures/modqn-phase6o-channel-adapter-parity.json`,
 * with explicit `fixture-literal` range / off-axis sources) and asserts numeric
 * agreement. It LOCKS leo's own channel compute against drift. It is NOT a live
 * comparison against `ntn-sim-core`'s authoritative `baseline-kpi-*.json`: the
 * committed fixture is the reference, not the upstream oracle. "Parity" here
 * means regression parity vs that frozen fixture. Re-verifying genuine vendor
 * parity against `ntn-sim-core` happens at vendor time by running ntn-sim-core's
 * own validators (CLAUDE.md §4), not by this script.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateHexagonalBeamLayout } from '../src/core/beam/layout.ts';
import { computeLinkBudget, computeSinr } from '../src/core/channel/index.ts';
import type {
  ChannelResult,
  LinkBudgetOptions,
  SinrResult,
} from '../src/core/channel/types.ts';
import {
  MODQN_BEAM_COUNT_CLAIM_LABELS,
  getModqnBeamCountBridgeClaim,
} from '../src/modqn/replay-bundle/index.ts';

type DbmValue = number | '-Infinity';
type ReuseGroupSource = 'core-layout' | 'runtime-frequency-reuse-compatibility';
type CaseStatus = 'PASS' | 'FAIL' | 'INTENTIONAL_NON_CORE_PARITY';

interface TierFlags {
  tier1LargeScale: boolean;
  tier2Clutter: boolean;
  tier3BeamGain: boolean;
  tier35ScanLoss: boolean;
  tier4Atmospheric: boolean;
  tier5Fading: boolean;
  largeScaleModel: '3gpp-baseline' | '3gpp-extended';
}

interface IdentityFixture {
  leoSatId: string;
  leoBeamId: number;
  leoAssignmentKey: string;
  coreLayoutSatId: string;
  coreBeamId: string;
  coreLocalBeamIndex: number;
  runtimeFrequencyReuse: number;
  coreLayoutFrequencyReuse: number;
  reuseGroup: number;
  reuseGroupSource: ReuseGroupSource;
  offsetEastKm: number;
  offsetNorthKm: number;
  producerSatId?: string | null;
  producerBeamId?: string | null;
  producerBeamIndex?: number | null;
  producerLocalBeamIndex?: number | null;
  producerEvidenceStatus?: string | null;
  serializationKey?: string;
}

interface GeometryFixture {
  rangeKm: number;
  rangeSource: 'topocentric' | 'tr38811-slant' | 'fixture-literal';
  elevationDeg: number;
  azimuthDeg: number;
  satAltitudeKm: number;
  satEcefKm: [number, number, number];
  ueLatDeg: number;
  ueLonDeg: number;
  ueOffsetEastKm: number;
  ueOffsetNorthKm: number;
  beamCenterOffsetEastKm: number;
  beamCenterOffsetNorthKm: number;
  ueDistanceToBeamCenterKm: number;
  offAxisAngleDeg: number;
  offAxisSource: 'leo-ground-distance-over-altitude' | 'core-geodetic' | 'fixture-literal';
  beamDiameterKm: number;
  beamwidth3dBDeg: number;
  scanAngleDeg: number;
  scanMaxAngleDeg: number;
  scanLossMaxDb: number;
}

interface ChannelInputFixture {
  frequencyGHz: number;
  bandwidthMHz: number;
  bandwidthHz: number;
  noisePsdDbmHz: number;
  noisePowerDbm: number;
  txPowerDbm: number;
  txPowerSource: string;
  dpcOverrideKey: string | null;
  txEirpDbm: number;
  antennaPeakGainDbi: number;
  rxAntennaGainDb: number;
  antennaModel: 'bessel-j1j3' | 'bessel-j1' | 'flat-debug';
  environment: 'rural' | 'suburban' | 'dense-urban';
  implementationLossDb: number;
  losSource: string;
  losSeedKey: string;
  isLos: boolean;
  tierFlags: TierFlags;
}

interface LinkFixture {
  identity: IdentityFixture;
  geometry: GeometryFixture;
  channel: ChannelInputFixture;
}

interface InterfererFixture extends LinkFixture {
  active: boolean;
  channelResult: ChannelResult;
}

interface LinkSampleFixture {
  satId: string;
  beamId: number;
  rsrpDbm: number;
  sinrDb: number;
  signalDbm: number;
  intraInterferenceDbm: DbmValue;
  interInterferenceDbm: DbmValue;
  noiseDbm: number;
  denominatorDbm: DbmValue;
  txPowerDbm: number;
  pathLossDb: number;
  beamGainDb: number;
  steeringLossDb: number;
  receiverGainDbi: number;
}

interface CaseExpectedFixture {
  activeAssignmentKeys: string[];
  coChannelKeys: string[];
  intraInterfererKeys: string[];
  interInterfererKeys: string[];
  channelResult: ChannelResult;
  sinrResult: SinrResult;
  linkSample: LinkSampleFixture;
}

interface CaseFixture extends LinkFixture {
  caseId: string;
  profileId: string;
  formulaFamily: 'hobs-legacy' | 'hobs-tr38811';
  profileGroup: string;
  signalTuningKey: string;
  handoverTuningKey: string;
  epochUtcMs: number;
  simTimeSec: number;
  frameSlotIndex: number;
  adapterVersion: string;
  beamCountPerSatellite: number;
  associationActive: boolean;
  coreParityEligible: boolean;
  expectedStatus: CaseStatus;
  nonParityFields: string[];
  activeAssignments: Array<{ satId: string; beamId: number; key: string }>;
  interferers: InterfererFixture[];
  expected: CaseExpectedFixture;
  notes: string[];
}

interface FixtureFile {
  schemaVersion: string;
  adapterVersion: string;
  cases: CaseFixture[];
}

interface NumericDiff {
  field: string;
  actual: DbmValue;
  expected: DbmValue;
  absDiff: number | null;
  tolerance: number;
  status: 'PASS' | 'FAIL' | 'SENTINEL_MATCH';
}

interface CaseSummary {
  caseId: string;
  profileId: string;
  formulaFamily: string;
  runtimeFrequencyReuse: number;
  coreLayoutFrequencyReuse: number;
  beamCountPerSatellite: number;
  reuseGroupSource: ReuseGroupSource;
  coreParityEligible: boolean;
  status: CaseStatus;
  exactMismatches: string[];
  numericDiffs: NumericDiff[];
  interferenceSetDiffs: string[];
  nonParityFields: string[];
  notes: string[];
}

interface RuntimeScanResult {
  status: 'PASS' | 'FAIL';
  leaks: string[];
  scannedPaths: readonly string[];
}

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_PATH = 'scripts/fixtures/modqn-phase6o-channel-adapter-parity.json';
const ADAPTER_VERSION = 'phase6n-leo-channel-core-adapter-v1';
const PHASE6N_DECISION_STATUS = 'READY_FOR_PARITY_VALIDATOR';
const SUMMARY_SCHEMA_VERSION = 'phase6o-channel-adapter-parity-summary-v1';
const VALIDATOR_SCRIPT = 'node --import tsx/esm scripts/validate-modqn-phase6o-channel-adapter-parity.ts';

const CHANNEL_RESULT_FIELDS = [
  'fsplDb',
  'shadowFadingDb',
  'clutterLossDb',
  'implementationLossDb',
  'beamGainDb',
  'atmosphericDb',
  'scanLossDb',
  'smallScaleFadingDb',
  'totalPathLossDb',
  'rxPowerDbm',
] as const satisfies ReadonlyArray<keyof ChannelResult>;

const LINK_SAMPLE_NUMERIC_FIELDS = [
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
] as const satisfies ReadonlyArray<keyof LinkSampleFixture>;

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

const MODQN_PHASE_DOC_PREFIX = 'docs/modqn-baseline-';

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

function dbmToMw(dbm: number): number {
  if (!Number.isFinite(dbm) || dbm < -300) return 0;
  return 10 ** (dbm / 10);
}

function mwToLeoDbm(milliwatts: number): DbmValue {
  if (!Number.isFinite(milliwatts) || milliwatts <= 0) return '-Infinity';
  return 10 * Math.log10(milliwatts);
}

function normalizeDbmValue(value: DbmValue): number {
  return value === '-Infinity' ? Number.NEGATIVE_INFINITY : value;
}

function sorted(values: readonly string[]): string[] {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function pushExactMismatch(
  mismatches: string[],
  label: string,
  actual: unknown,
  expected: unknown,
): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    mismatches.push(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function toleranceForField(field: string): number {
  if (/noiseDbm|txPowerDbm|receiverGainDbi/.test(field)) return 1e-9;
  if (/fsplDb|implementationLossDb|scanLossDb/.test(field)) return 1e-6;
  if (/beamGainDb/.test(field)) return 0.25;
  return 0.25;
}

function recordNumericDiff(
  diffs: NumericDiff[],
  maxAbsDiffByField: Record<string, number>,
  field: string,
  actual: DbmValue,
  expected: DbmValue,
): void {
  const tolerance = toleranceForField(field);
  if (actual === '-Infinity' || expected === '-Infinity') {
    const status = actual === expected ? 'SENTINEL_MATCH' : 'FAIL';
    diffs.push({ field, actual, expected, absDiff: null, tolerance, status });
    return;
  }

  const actualNumber = normalizeDbmValue(actual);
  const expectedNumber = normalizeDbmValue(expected);
  const absDiff = Math.abs(actualNumber - expectedNumber);
  const status = absDiff <= tolerance ? 'PASS' : 'FAIL';
  diffs.push({ field, actual, expected, absDiff, tolerance, status });
  maxAbsDiffByField[field] = Math.max(maxAbsDiffByField[field] ?? 0, absDiff);
}

function linkBudgetOptions(link: LinkFixture): LinkBudgetOptions {
  return {
    distanceKm: link.geometry.rangeKm,
    frequencyGhz: link.channel.frequencyGHz,
    txEirpDbm: link.channel.txEirpDbm,
    rxAntennaGainDb: link.channel.rxAntennaGainDb,
    elevationDeg: link.geometry.elevationDeg,
    environment: link.channel.environment,
    largeScaleModel: link.channel.tierFlags.largeScaleModel,
    beamGainInput: {
      offAxisAngleDeg: link.geometry.offAxisAngleDeg,
      model: link.channel.antennaModel,
      peakGainDbi: link.channel.antennaPeakGainDbi,
      beamDiameterKm: link.geometry.beamDiameterKm,
      altitudeKm: link.geometry.satAltitudeKm,
      slantRangeKm: link.geometry.rangeKm,
    },
    noisePowerDbm: link.channel.noisePowerDbm,
    implementationLossDb: link.channel.implementationLossDb,
    tier1LargeScale: link.channel.tierFlags.tier1LargeScale,
    tier2Clutter: link.channel.tierFlags.tier2Clutter,
    tier3BeamGain: link.channel.tierFlags.tier3BeamGain,
    tier35ScanLoss: link.channel.tierFlags.tier35ScanLoss,
    tier4Atmospheric: link.channel.tierFlags.tier4Atmospheric,
    tier5Fading: link.channel.tierFlags.tier5Fading,
    scanAngleDeg: link.geometry.scanAngleDeg,
    scanMaxAngleDeg: link.geometry.scanMaxAngleDeg,
    scanLossMaxDb: link.geometry.scanLossMaxDb,
    rngNext: null,
    isLos: link.channel.isLos,
  };
}

function channelPathLossForLeoSample(channelResult: ChannelResult): number {
  return channelResult.fsplDb
    + channelResult.implementationLossDb
    + channelResult.shadowFadingDb
    + channelResult.clutterLossDb
    + channelResult.atmosphericDb;
}

function validateReuseMetadata(link: LinkFixture, caseFixture: CaseFixture, exactMismatches: string[]): void {
  const { identity, geometry } = link;
  pushExactMismatch(
    exactMismatches,
    `${caseFixture.caseId}.${identity.leoAssignmentKey}.leoAssignmentKey`,
    identity.leoAssignmentKey,
    `${identity.leoSatId}:${identity.leoBeamId}`,
  );
  pushExactMismatch(
    exactMismatches,
    `${caseFixture.caseId}.${identity.leoAssignmentKey}.coreBeamId`,
    identity.coreBeamId,
    `${identity.coreLayoutSatId}-b${identity.coreLocalBeamIndex}`,
  );

  if (identity.reuseGroupSource === 'core-layout') {
    pushExactMismatch(
      exactMismatches,
      `${caseFixture.caseId}.${identity.leoAssignmentKey}.coreLayoutFrequencyReuse`,
      identity.coreLayoutFrequencyReuse,
      identity.runtimeFrequencyReuse,
    );
    if (![1, 3, 7].includes(identity.runtimeFrequencyReuse)) {
      exactMismatches.push(`${caseFixture.caseId}.${identity.leoAssignmentKey}: unsupported core-layout runtime K ${identity.runtimeFrequencyReuse}`);
      return;
    }
    const layout = generateHexagonalBeamLayout({
      satId: identity.coreLayoutSatId,
      numBeams: caseFixture.beamCountPerSatellite,
      beamDiameterKm: geometry.beamDiameterKm,
      altitudeKm: geometry.satAltitudeKm,
      frf: identity.coreLayoutFrequencyReuse,
    });
    const coreBeam = layout.beams[identity.coreLocalBeamIndex];
    pushExactMismatch(
      exactMismatches,
      `${caseFixture.caseId}.${identity.leoAssignmentKey}.coreLayoutBeamId`,
      identity.coreBeamId,
      coreBeam?.beamId,
    );
    pushExactMismatch(
      exactMismatches,
      `${caseFixture.caseId}.${identity.leoAssignmentKey}.coreLayoutReuseGroup`,
      identity.reuseGroup,
      coreBeam?.reuseGroup,
    );
  } else {
    pushExactMismatch(
      exactMismatches,
      `${caseFixture.caseId}.${identity.leoAssignmentKey}.compatCoreLayoutFrequencyReuse`,
      identity.coreLayoutFrequencyReuse,
      1,
    );
    pushExactMismatch(
      exactMismatches,
      `${caseFixture.caseId}.${identity.leoAssignmentKey}.compatReuseGroup`,
      identity.reuseGroup,
      identity.coreLocalBeamIndex % identity.runtimeFrequencyReuse,
    );
  }
}

function adaptCase(caseFixture: CaseFixture): {
  channelResult: ChannelResult;
  sinrResult: SinrResult;
  linkSample: LinkSampleFixture;
  coChannelKeys: string[];
  intraInterfererKeys: string[];
  interInterfererKeys: string[];
  activeAssignmentKeys: string[];
  interfererResults: Array<{ key: string; result: ChannelResult }>;
} {
  const channelResult = computeLinkBudget(linkBudgetOptions(caseFixture));
  const activeAssignmentKeys = caseFixture.activeAssignments.map(assignment => assignment.key);
  const candidateKey = caseFixture.identity.leoAssignmentKey;

  const interfererResults = caseFixture.interferers.map(interferer => ({
    key: interferer.identity.leoAssignmentKey,
    result: computeLinkBudget(linkBudgetOptions(interferer)),
  }));

  const resultByKey = new Map(interfererResults.map(entry => [entry.key, entry.result]));
  const activeKeySet = new Set(activeAssignmentKeys);
  const coChannelInterferers = caseFixture.interferers.filter(interferer =>
    interferer.identity.leoAssignmentKey !== candidateKey
      && activeKeySet.has(interferer.identity.leoAssignmentKey)
      && interferer.identity.reuseGroup === caseFixture.identity.reuseGroup,
  );
  const intraInterferers = coChannelInterferers.filter(interferer => interferer.identity.leoSatId === caseFixture.identity.leoSatId);
  const interInterferers = coChannelInterferers.filter(interferer => interferer.identity.leoSatId !== caseFixture.identity.leoSatId);
  const intraPowers = intraInterferers.map(interferer => resultByKey.get(interferer.identity.leoAssignmentKey)?.rxPowerDbm ?? Number.NEGATIVE_INFINITY);
  const interPowers = interInterferers.map(interferer => resultByKey.get(interferer.identity.leoAssignmentKey)?.rxPowerDbm ?? Number.NEGATIVE_INFINITY);
  const sinrResult = computeSinr({
    associationActive: caseFixture.associationActive,
    servingRxPowerDbm: channelResult.rxPowerDbm,
    noisePowerDbm: caseFixture.channel.noisePowerDbm,
    intraInterferingRxPowersDbm: intraPowers,
    interInterferingRxPowersDbm: interPowers,
  });
  const intraMw = intraPowers.reduce((sum, value) => sum + dbmToMw(value), 0);
  const interMw = interPowers.reduce((sum, value) => sum + dbmToMw(value), 0);
  const denominatorMw = intraMw + interMw + dbmToMw(caseFixture.channel.noisePowerDbm);
  const linkSample: LinkSampleFixture = {
    satId: caseFixture.identity.leoSatId,
    beamId: caseFixture.identity.leoBeamId,
    rsrpDbm: channelResult.rxPowerDbm,
    sinrDb: sinrResult.sinrDb,
    signalDbm: sinrResult.signalDbm,
    intraInterferenceDbm: mwToLeoDbm(intraMw),
    interInterferenceDbm: mwToLeoDbm(interMw),
    noiseDbm: caseFixture.channel.noisePowerDbm,
    denominatorDbm: mwToLeoDbm(denominatorMw),
    txPowerDbm: caseFixture.channel.txPowerDbm,
    pathLossDb: channelPathLossForLeoSample(channelResult),
    beamGainDb: channelResult.beamGainDb,
    steeringLossDb: channelResult.scanLossDb,
    receiverGainDbi: caseFixture.channel.rxAntennaGainDb,
  };

  return {
    channelResult,
    sinrResult,
    linkSample,
    activeAssignmentKeys,
    coChannelKeys: coChannelInterferers.map(interferer => interferer.identity.leoAssignmentKey),
    intraInterfererKeys: intraInterferers.map(interferer => interferer.identity.leoAssignmentKey),
    interInterfererKeys: interInterferers.map(interferer => interferer.identity.leoAssignmentKey),
    interfererResults,
  };
}

class LeoChannelCoreAdapter {
  adapt(caseFixture: CaseFixture): ReturnType<typeof adaptCase> {
    return adaptCase(caseFixture);
  }
}

function evaluateCase(caseFixture: CaseFixture, maxAbsDiffByField: Record<string, number>): CaseSummary {
  const exactMismatches: string[] = [];
  const numericDiffs: NumericDiff[] = [];
  const interferenceSetDiffs: string[] = [];

  pushExactMismatch(exactMismatches, `${caseFixture.caseId}.adapterVersion`, caseFixture.adapterVersion, ADAPTER_VERSION);
  pushExactMismatch(exactMismatches, `${caseFixture.caseId}.profileId`, caseFixture.profileId, caseFixture.profileId);
  pushExactMismatch(exactMismatches, `${caseFixture.caseId}.formulaFamily`, caseFixture.formulaFamily, caseFixture.formulaFamily);
  pushExactMismatch(exactMismatches, `${caseFixture.caseId}.epochUtcMs`, caseFixture.epochUtcMs, caseFixture.epochUtcMs);
  pushExactMismatch(exactMismatches, `${caseFixture.caseId}.simTimeSec`, caseFixture.simTimeSec, caseFixture.simTimeSec);
  pushExactMismatch(exactMismatches, `${caseFixture.caseId}.leoBeamIdFromCoreIndex`, caseFixture.identity.leoBeamId, caseFixture.identity.coreLocalBeamIndex + 1);
  pushExactMismatch(exactMismatches, `${caseFixture.caseId}.producerEvidenceStatus`, caseFixture.identity.producerEvidenceStatus, 'not-replay');
  pushExactMismatch(exactMismatches, `${caseFixture.caseId}.losSeedKey`, caseFixture.channel.losSeedKey, `${caseFixture.identity.leoSatId}|${caseFixture.identity.leoBeamId}|${Math.floor(caseFixture.simTimeSec)}`);

  const expectedCoreEligible =
    caseFixture.identity.reuseGroupSource === 'core-layout'
    && [1, 3, 7].includes(caseFixture.identity.runtimeFrequencyReuse)
    && caseFixture.identity.coreLayoutFrequencyReuse === caseFixture.identity.runtimeFrequencyReuse;
  const expectedStatus: CaseStatus = expectedCoreEligible ? 'PASS' : 'INTENTIONAL_NON_CORE_PARITY';

  pushExactMismatch(exactMismatches, `${caseFixture.caseId}.coreParityEligible`, caseFixture.coreParityEligible, expectedCoreEligible);
  pushExactMismatch(exactMismatches, `${caseFixture.caseId}.expectedStatus`, caseFixture.expectedStatus, expectedStatus);
  pushExactMismatch(exactMismatches, `${caseFixture.caseId}.tierFlags`, caseFixture.channel.tierFlags, {
    tier1LargeScale: false,
    tier2Clutter: false,
    tier3BeamGain: true,
    tier35ScanLoss: true,
    tier4Atmospheric: false,
    tier5Fading: false,
    largeScaleModel: '3gpp-baseline',
  });
  pushExactMismatch(exactMismatches, `${caseFixture.caseId}.txPowerSource`, caseFixture.channel.txPowerSource, caseFixture.channel.dpcOverrideKey ? 'dpc-override' : 'profile-max');
  pushExactMismatch(exactMismatches, `${caseFixture.caseId}.associationActive`, caseFixture.associationActive, true);

  validateReuseMetadata(caseFixture, caseFixture, exactMismatches);
  for (const interferer of caseFixture.interferers) {
    validateReuseMetadata(interferer, caseFixture, exactMismatches);
  }

  const adapted = new LeoChannelCoreAdapter().adapt(caseFixture);
  const activeExpected = sorted(caseFixture.expected.activeAssignmentKeys);
  const activeActual = sorted(adapted.activeAssignmentKeys);
  const coChannelExpected = sorted(caseFixture.expected.coChannelKeys);
  const coChannelActual = sorted(adapted.coChannelKeys);
  const intraExpected = sorted(caseFixture.expected.intraInterfererKeys);
  const intraActual = sorted(adapted.intraInterfererKeys);
  const interExpected = sorted(caseFixture.expected.interInterfererKeys);
  const interActual = sorted(adapted.interInterfererKeys);

  for (const [label, actual, expected] of [
    ['activeAssignmentKeys', activeActual, activeExpected],
    ['coChannelKeys', coChannelActual, coChannelExpected],
    ['intraInterfererKeys', intraActual, intraExpected],
    ['interInterfererKeys', interActual, interExpected],
  ] as const) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      interferenceSetDiffs.push(`${caseFixture.caseId}.${label}: expected ${expected.join(',') || '<empty>'}, got ${actual.join(',') || '<empty>'}`);
    }
  }

  for (const field of CHANNEL_RESULT_FIELDS) {
    recordNumericDiff(
      numericDiffs,
      maxAbsDiffByField,
      `channelResult.${field}`,
      adapted.channelResult[field],
      caseFixture.expected.channelResult[field],
    );
  }
  for (const field of ['signalDbm', 'interferenceDbm', 'noiseDbm', 'sinrDb'] as const satisfies ReadonlyArray<keyof SinrResult>) {
    recordNumericDiff(
      numericDiffs,
      maxAbsDiffByField,
      `sinrResult.${field}`,
      adapted.sinrResult[field],
      caseFixture.expected.sinrResult[field],
    );
  }
  for (const field of LINK_SAMPLE_NUMERIC_FIELDS) {
    recordNumericDiff(
      numericDiffs,
      maxAbsDiffByField,
      `linkSample.${field}`,
      adapted.linkSample[field],
      caseFixture.expected.linkSample[field],
    );
  }
  for (const interferer of caseFixture.interferers) {
    const actual = adapted.interfererResults.find(entry => entry.key === interferer.identity.leoAssignmentKey);
    if (!actual) {
      exactMismatches.push(`${caseFixture.caseId}.${interferer.identity.leoAssignmentKey}: missing computed interferer result`);
      continue;
    }
    for (const field of CHANNEL_RESULT_FIELDS) {
      recordNumericDiff(
        numericDiffs,
        maxAbsDiffByField,
        `interfererChannelResult.${field}`,
        actual.result[field],
        interferer.channelResult[field],
      );
    }
  }

  const numericFailures = numericDiffs.filter(diff => diff.status === 'FAIL');
  const hasFailures = exactMismatches.length > 0
    || interferenceSetDiffs.length > 0
    || numericFailures.length > 0;

  return {
    caseId: caseFixture.caseId,
    profileId: caseFixture.profileId,
    formulaFamily: caseFixture.formulaFamily,
    runtimeFrequencyReuse: caseFixture.identity.runtimeFrequencyReuse,
    coreLayoutFrequencyReuse: caseFixture.identity.coreLayoutFrequencyReuse,
    beamCountPerSatellite: caseFixture.beamCountPerSatellite,
    reuseGroupSource: caseFixture.identity.reuseGroupSource,
    coreParityEligible: caseFixture.coreParityEligible,
    status: hasFailures ? 'FAIL' : caseFixture.expectedStatus,
    exactMismatches,
    numericDiffs,
    interferenceSetDiffs,
    nonParityFields: caseFixture.nonParityFields,
    notes: caseFixture.notes,
  };
}

function loadFixture(): FixtureFile {
  const fixture = JSON.parse(readRepoFile(FIXTURE_PATH)) as FixtureFile;
  if (fixture.schemaVersion !== 'phase6o-channel-adapter-parity-fixture-v1') {
    throw new Error(`${FIXTURE_PATH} has unexpected schemaVersion ${fixture.schemaVersion}`);
  }
  if (fixture.adapterVersion !== ADAPTER_VERSION) {
    throw new Error(`${FIXTURE_PATH} has unexpected adapterVersion ${fixture.adapterVersion}`);
  }
  return fixture;
}

function assertFixtureCoverage(cases: readonly CaseFixture[]): string[] {
  const failures: string[] = [];
  const ids = new Set(cases.map(caseFixture => caseFixture.caseId));
  for (const requiredId of [
    'single-sat-center-no-interference',
    'single-sat-offaxis-no-interference',
    'same-sat-same-reuse-intra',
    'same-sat-different-reuse-excluded',
    'dual-sat-same-reuse-inter',
    'dual-sat-mixed-intra-inter',
    'inactive-same-reuse-excluded',
    'tr38811-nlos-dpc-fixed',
  ]) {
    if (!ids.has(requiredId)) failures.push(`missing required fixture case ${requiredId}`);
  }

  for (const k of [1, 3, 7]) {
    const matching = cases.filter(caseFixture =>
      caseFixture.identity.runtimeFrequencyReuse === k
      && caseFixture.identity.reuseGroupSource === 'core-layout'
      && caseFixture.coreParityEligible,
    );
    if (matching.length === 0) failures.push(`missing core-backed FRF K=${k} case`);
  }

  for (const k of [2, 4, 5, 6]) {
    const matching = cases.filter(caseFixture =>
      caseFixture.identity.runtimeFrequencyReuse === k
      && caseFixture.identity.reuseGroupSource === 'runtime-frequency-reuse-compatibility'
      && !caseFixture.coreParityEligible
      && caseFixture.expectedStatus === 'INTENTIONAL_NON_CORE_PARITY',
    );
    if (matching.length === 0) failures.push(`missing intentional non-core parity compatibility K=${k} case`);
  }

  return failures;
}

function scanRuntimeNonAdoption(): RuntimeScanResult {
  const leaks: string[] = [];
  const importFromCoreChannel = /^\s*import\b.*\bfrom\s+['"][^'"]*(?:@\/core\/channel|src\/core\/channel|core\/channel)[^'"]*['"]/;
  const phase6OTokens = /\b(LeoChannelCoreAdapter|modqn-phase6o-channel-adapter-parity|phase6o-channel-adapter-parity|validate-modqn-phase6o-channel-adapter-parity)\b/;
  const files = RUNTIME_NON_ADOPTION_SCAN_PATHS
    .flatMap(scanPath => listRepoFiles(scanPath))
    .filter(file => ['.ts', '.tsx', '.json'].includes(extname(file)));

  for (const file of files) {
    const text = readRepoFile(file);
    for (const [lineIndex, line] of text.split(/\r?\n/).entries()) {
      if (importFromCoreChannel.test(line) || phase6OTokens.test(line)) {
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

function scanUnsupported1937Claims(): { status: 'PASS' | 'FAIL'; leaks: string[]; scannedFiles: string[] } {
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

function scanModqnReplayEvidenceClaims(): { status: 'PASS' | 'FAIL'; leaks: string[]; scannedFiles: string[] } {
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

function validatePackageScript(): string[] {
  const packageJson = JSON.parse(readRepoFile('package.json')) as {
    scripts?: Record<string, string>;
  };
  return packageJson.scripts?.['validate:modqn:phase6o-channel-adapter-parity'] === VALIDATOR_SCRIPT
    ? []
    : ['package.json is missing validate:modqn:phase6o-channel-adapter-parity or its command drifted'];
}

function run(): void {
  const fixture = loadFixture();
  const maxAbsDiffByField: Record<string, number> = {};
  const cases = fixture.cases.map(caseFixture => evaluateCase(caseFixture, maxAbsDiffByField));
  const runtimeScan = scanRuntimeNonAdoption();
  const unsupportedClaimScan = scanUnsupported1937Claims();
  const replayEvidenceClaimScan = scanModqnReplayEvidenceClaims();
  const fixtureCoverageFailures = assertFixtureCoverage(fixture.cases);
  const packageScriptFailures = validatePackageScript();
  const caseFailures = cases.flatMap(caseSummary => [
    ...caseSummary.exactMismatches.map(failure => `${caseSummary.caseId}: ${failure}`),
    ...caseSummary.interferenceSetDiffs.map(failure => `${caseSummary.caseId}: ${failure}`),
    ...caseSummary.numericDiffs
      .filter(diff => diff.status === 'FAIL')
      .map(diff => `${caseSummary.caseId}: ${diff.field} expected ${diff.expected}, got ${diff.actual}`),
  ]);
  const failures = [
    ...fixtureCoverageFailures,
    ...packageScriptFailures,
    ...caseFailures,
    ...runtimeScan.leaks.map(leak => `runtime adoption leak: ${leak}`),
    ...unsupportedClaimScan.leaks.map(leak => `unsupported 19/37 claim: ${leak}`),
    ...replayEvidenceClaimScan.leaks.map(leak => `MODQN replay evidence claim leak: ${leak}`),
  ];
  const nonParityFields = unique(fixture.cases.flatMap(caseFixture => caseFixture.nonParityFields));
  const gitHead = gitOutput(['rev-parse', 'HEAD']);
  const exactMismatchCount = cases.reduce((sum, caseSummary) => sum + caseSummary.exactMismatches.length, 0);
  const numericToleranceFailureCount = cases.reduce(
    (sum, caseSummary) => sum + caseSummary.numericDiffs.filter(diff => diff.status === 'FAIL').length,
    0,
  );

  const summary = {
    schemaVersion: SUMMARY_SCHEMA_VERSION,
    phase: '6O',
    phase6NDecisionStatus: PHASE6N_DECISION_STATUS,
    adapterVersion: ADAPTER_VERSION,
    generatedAt: new Date().toISOString(),
    repo: 'leo-beam-sim',
    gitHead,
    runtimeBehaviorChanged: runtimeScan.status !== 'PASS',
    browserSmokeRun: false,
    overallStatus: failures.length === 0 ? 'PASS' : 'FAIL',
    caseCount: cases.length,
    coreParityEligibleCaseCount: cases.filter(caseSummary => caseSummary.coreParityEligible).length,
    compatibilityCaseCount: cases.filter(caseSummary => caseSummary.reuseGroupSource === 'runtime-frequency-reuse-compatibility').length,
    intentionalNonParityCaseCount: cases.filter(caseSummary => caseSummary.status === 'INTENTIONAL_NON_CORE_PARITY').length,
    exactMismatchCount,
    numericToleranceFailureCount,
    maxAbsDiffByField,
    unsupported1937TrainedBaselineClaimScan: unsupportedClaimScan.status,
    modqnReplayEvidenceClaimScan: replayEvidenceClaimScan.status,
    runtimeNonAdoptionScan: runtimeScan,
    cases,
    nonParityFields,
    failures,
  };

  console.log(JSON.stringify(summary, null, 2));
  if (summary.overallStatus !== 'PASS') {
    process.exitCode = 1;
  }
}

run();
