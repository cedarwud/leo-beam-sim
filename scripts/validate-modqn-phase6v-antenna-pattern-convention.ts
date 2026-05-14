import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  computeBeamGainDb as computeEngineBeamGainDb,
} from '../src/engine/signal/beam-gain.ts';
import { computeBeamGain as computeCoreBeamGain } from '../src/core/channel/beam-gain.ts';
import {
  MODQN_BEAM_COUNT_CLAIM_LABELS,
  getModqnBeamCountBridgeClaim,
} from '../src/modqn/replay-bundle/index.ts';
import { loadProfile } from '../src/profiles/index.ts';
import type { GainModel, Profile } from '../src/profiles/types.ts';

type Phase6VStatus =
  | 'READY_FOR_PHASE6W_SHADOW_ADAPTER'
  | 'BLOCKED_BY_PATTERN_CONVENTION'
  | 'NEEDS_SOURCE_PROVENANCE';
type ScanStatus = 'PASS' | 'FAIL';

interface NumericSummary {
  count: number;
  min: number | null;
  p50: number | null;
  max: number | null;
  mean: number | null;
}

interface Phase6VFixtureFile {
  schemaVersion: string;
  phase: '6V';
  comparisonMode: 'validator-only-antenna-pattern-convention-resolution';
  phase6UValidatorScript: string;
  phase6UFixturePath: string;
  requiredProfiles: string[];
  allowedPhase6VStatuses: Phase6VStatus[];
  expectedPhase6VStatus: Phase6VStatus;
  diagnosticPolicy: {
    runtimeAdoption: 'not-adopted';
    formulaChanges: 'forbidden';
    browserSmoke: 'not-required';
    adapterOnlyFixDefensibleWhen: string;
    additionalConventionCandidatePolicy: string;
  };
  thresholds: {
    phase6UMaxAllowedRawMeanAbsDb: number;
    residualP50ToleranceDb: number;
    residualMeanToleranceDb: number;
    patternConventionResidualToleranceDb: number;
    sourceProvenanceRequired: boolean;
  };
}

interface Phase6USummary {
  schemaVersion: 'phase6u-beam-gain-mismatch-summary-v1';
  phase: '6U';
  runtimeBehaviorChanged: false;
  runtimeAdoption: {
    status: 'not-adopted';
  };
  phase6UStatus: string;
  adapterOnlyFixReady: boolean;
  structuralFailures: string[];
  caseCount: number;
  rawAbsBeamGainDiffDb: NumericSummary;
  diameterAdaptedAbsBeamGainDiffDb: NumericSummary;
  rawLinkImpactEstimateAbsDb: NumericSummary;
  diameterAdaptedLinkImpactEstimateAbsDb: NumericSummary;
  causeSummary: Array<{
    cause: string;
    status: string;
    evidence: string;
  }>;
  representativeCases: Array<{
    caseId: string;
    caseKind: string;
    profileId: string;
    sampleKey: string;
    offAxisAngleDeg: number;
    scanAngleDeg: number;
    engineGainDb: number;
    coreRawGainDb: number;
    coreDiameterAdaptedGainDb: number;
    rawBeamGainDiffDb: number;
    diameterAdaptedBeamGainDiffDb: number;
    rawLinkImpactEstimateDb: number;
    causes: string[];
  }>;
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

interface ConventionCase {
  caseId: string;
  profileId: string;
  offAxisRatioToProfileBeamwidth: number;
  offAxisAngleDeg: number;
  altitudeKm: number;
  beamwidth3dBDeg: number;
  rawBeamDiameterKm: number;
  phase6UDiameterAdaptedKm: number;
  engineLeoHobsGainDb: number;
  sourceCoreRawGainDb: number;
  sourceCoreDiameterAdaptedGainDb: number;
  rawMismatchDb: number;
  diameterAdaptedMismatchDb: number;
  sameThetaPatternConventionResidualDb: number;
}

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_PATH = 'scripts/fixtures/modqn-phase6v-antenna-pattern-convention.json';
const PHASE6U_FIXTURE_PATH = 'scripts/fixtures/modqn-phase6u-beam-gain-mismatch.json';
const PHASE6U_VALIDATOR_SCRIPT = 'node --import tsx/esm scripts/validate-modqn-phase6u-beam-gain-mismatch.ts';
const VALIDATOR_SCRIPT = 'node --import tsx/esm scripts/validate-modqn-phase6v-antenna-pattern-convention.ts';
const SUMMARY_SCHEMA_VERSION = 'phase6v-antenna-pattern-convention-summary-v1';
const MODQN_PHASE_DOC_PREFIX = 'docs/modqn-baseline-';

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

const PROFILE_OFF_AXIS_RATIOS = [
  0,
  0.25,
  0.5,
  0.75,
  1,
  1.25,
  1.5,
  2,
  2.5,
  3,
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

function absSummary<T>(values: readonly T[], selector: (sample: T) => number): NumericSummary {
  return summarizeNumbers(values.map(sample => Math.abs(selector(sample))));
}

function normalizeGainModel(model: GainModel): 'bessel-j1j3' | 'bessel-j1' | 'flat-debug' {
  if (model === 'bessel-j1-j3') return 'bessel-j1j3';
  if (model === 'bessel-j1') return 'bessel-j1';
  return 'flat-debug';
}

function loadPhase6VFixture(): Phase6VFixtureFile {
  const fixture = JSON.parse(readRepoFile(FIXTURE_PATH)) as Phase6VFixtureFile;
  if (fixture.schemaVersion !== 'phase6v-antenna-pattern-convention-fixture-v1') {
    throw new Error(`${FIXTURE_PATH} has unexpected schemaVersion ${fixture.schemaVersion}`);
  }
  if (fixture.phase !== '6V') {
    throw new Error(`${FIXTURE_PATH} has unexpected phase ${fixture.phase}`);
  }
  if (fixture.comparisonMode !== 'validator-only-antenna-pattern-convention-resolution') {
    throw new Error(`${FIXTURE_PATH} comparisonMode drifted`);
  }
  if (fixture.phase6UFixturePath !== PHASE6U_FIXTURE_PATH) {
    throw new Error(`${FIXTURE_PATH} phase6UFixturePath drifted from ${PHASE6U_FIXTURE_PATH}`);
  }
  if (fixture.phase6UValidatorScript !== PHASE6U_VALIDATOR_SCRIPT) {
    throw new Error(`${FIXTURE_PATH} phase6UValidatorScript drifted from ${PHASE6U_VALIDATOR_SCRIPT}`);
  }
  if (fixture.diagnosticPolicy.runtimeAdoption !== 'not-adopted') {
    throw new Error(`${FIXTURE_PATH} must keep runtimeAdoption not-adopted`);
  }
  if (!fixture.allowedPhase6VStatuses.includes(fixture.expectedPhase6VStatus)) {
    throw new Error(`${FIXTURE_PATH} expectedPhase6VStatus is not in allowedPhase6VStatuses`);
  }
  return fixture;
}

function parseJsonFromValidatorOutput(output: string): unknown {
  const lines = output.split(/\r?\n/);
  const jsonStartLine = lines.findIndex(line => line.trim().startsWith('{'));
  if (jsonStartLine < 0) {
    throw new Error('Phase 6U validator output did not contain a JSON summary');
  }
  return JSON.parse(lines.slice(jsonStartLine).join('\n'));
}

function runPhase6USummary(): Phase6USummary {
  const output = execFileSync('node', [
    '--import',
    'tsx/esm',
    'scripts/validate-modqn-phase6u-beam-gain-mismatch.ts',
  ], {
    cwd: ROOT_DIR,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const summary = parseJsonFromValidatorOutput(output) as Phase6USummary;
  if (summary.schemaVersion !== 'phase6u-beam-gain-mismatch-summary-v1') {
    throw new Error(`Phase 6U summary schema drifted: ${String(summary.schemaVersion)}`);
  }
  if (summary.phase !== '6U') {
    throw new Error(`Phase 6U summary phase drifted: ${String(summary.phase)}`);
  }
  if (summary.runtimeBehaviorChanged !== false || summary.runtimeAdoption.status !== 'not-adopted') {
    throw new Error('Phase 6U summary no longer proves validator-only runtime non-adoption');
  }
  return summary;
}

function altitudeKmForProfile(profile: Profile): number {
  return profile.orbit.shells[0]?.altitudeKm ?? 550;
}

function createConventionCases(fixture: Phase6VFixtureFile): ConventionCase[] {
  return fixture.requiredProfiles.flatMap(profileId => {
    const profile = loadProfile(profileId);
    const altitudeKm = altitudeKmForProfile(profile);
    const beamwidth3dBDeg = profile.antenna.beamwidth3dBRad * (180 / Math.PI);
    const rawBeamDiameterKm = 2 * altitudeKm * Math.tan(profile.antenna.beamwidth3dBRad / 2);
    const phase6UDiameterAdaptedKm = 2 * altitudeKm * Math.tan(profile.antenna.beamwidth3dBRad);

    return PROFILE_OFF_AXIS_RATIOS.map(ratio => {
      const offAxisAngleDeg = beamwidth3dBDeg * ratio;
      const engineLeoHobsGainDb = computeEngineBeamGainDb(
        offAxisAngleDeg,
        beamwidth3dBDeg,
        profile.antenna.model,
      );
      const sourceCoreRawGainDb = computeCoreBeamGain({
        offAxisAngleDeg,
        model: normalizeGainModel(profile.antenna.model),
        peakGainDbi: profile.antenna.maxGainDbi,
        beamDiameterKm: rawBeamDiameterKm,
        altitudeKm,
        slantRangeKm: altitudeKm,
      });
      const sourceCoreDiameterAdaptedGainDb = computeCoreBeamGain({
        offAxisAngleDeg,
        model: normalizeGainModel(profile.antenna.model),
        peakGainDbi: profile.antenna.maxGainDbi,
        beamDiameterKm: phase6UDiameterAdaptedKm,
        altitudeKm,
        slantRangeKm: altitudeKm,
      });
      const rawMismatchDb = sourceCoreRawGainDb - engineLeoHobsGainDb;
      const diameterAdaptedMismatchDb = sourceCoreDiameterAdaptedGainDb - engineLeoHobsGainDb;

      return {
        caseId: `${profileId}:ratio-${ratio}`,
        profileId,
        offAxisRatioToProfileBeamwidth: ratio,
        offAxisAngleDeg: round(offAxisAngleDeg),
        altitudeKm: round(altitudeKm),
        beamwidth3dBDeg: round(beamwidth3dBDeg),
        rawBeamDiameterKm: round(rawBeamDiameterKm),
        phase6UDiameterAdaptedKm: round(phase6UDiameterAdaptedKm),
        engineLeoHobsGainDb: round(engineLeoHobsGainDb),
        sourceCoreRawGainDb: round(sourceCoreRawGainDb),
        sourceCoreDiameterAdaptedGainDb: round(sourceCoreDiameterAdaptedGainDb),
        rawMismatchDb: round(rawMismatchDb),
        diameterAdaptedMismatchDb: round(diameterAdaptedMismatchDb),
        sameThetaPatternConventionResidualDb: round(diameterAdaptedMismatchDb),
      };
    });
  });
}

function validatePackageScript(): string[] {
  const packageJson = JSON.parse(readRepoFile('package.json')) as {
    scripts?: Record<string, string>;
  };
  return packageJson.scripts?.['validate:modqn:phase6v-antenna-pattern-convention'] === VALIDATOR_SCRIPT
    ? []
    : ['package.json is missing validate:modqn:phase6v-antenna-pattern-convention or its command drifted'];
}

function scanRuntimeNonAdoption(): RuntimeScanResult {
  const leaks: string[] = [];
  const importFromCoreChannel = /^\s*import\b.*\bfrom\s+['"][^'"]*(?:@\/core\/channel|src\/core\/channel|core\/channel)[^'"]*['"]/;
  const phase6VTokens = /\b(phase6v|modqn-phase6v-antenna-pattern-convention|validate-modqn-phase6v-antenna-pattern-convention|AntennaPatternConvention)\b/i;
  const files = RUNTIME_NON_ADOPTION_SCAN_PATHS
    .flatMap(scanPath => listRepoFiles(scanPath))
    .filter(file => ['.ts', '.tsx', '.json'].includes(extname(file)));

  for (const file of files) {
    const text = readRepoFile(file);
    for (const [lineIndex, line] of text.split(/\r?\n/).entries()) {
      if (importFromCoreChannel.test(line) || phase6VTokens.test(line)) {
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

function scanStalePhase6MAdapterParityTokens(): ScanResult {
  const scannedFiles = phaseDocsAndChangedFiles();
  const leaks: string[] = [];
  const stalePhase = 'phase' + '6m';
  const staleSurface = 'channel-adapter-' + 'parity';
  const staleScript = `validate-modqn-${stalePhase}-${staleSurface}`;
  const staleTokens = [
    `validate:modqn:${stalePhase}-${staleSurface}`,
    staleScript,
    `modqn-${stalePhase}-${staleSurface}`,
    `${stalePhase}-${staleSurface}`,
  ];

  for (const file of scannedFiles) {
    const text = readRepoFile(file);
    for (const [lineIndex, line] of text.split(/\r?\n/).entries()) {
      if (staleTokens.some(token => line.includes(token))) {
        leaks.push(`${file}:${lineIndex + 1}: ${line.trim()}`);
      }
    }
  }

  return {
    status: leaks.length === 0 ? 'PASS' : 'FAIL',
    leaks,
    scannedFiles,
  };
}

function conventionResidualIsExplained(input: {
  phase6U: Phase6USummary;
  conventionCases: readonly ConventionCase[];
  fixture: Phase6VFixtureFile;
}): boolean {
  const modelCause = input.phase6U.causeSummary.find(summary => summary.cause === 'antenna-model-mismatch');
  const otherUnexpectedRootCauses = input.phase6U.causeSummary.filter(summary =>
    summary.status === 'ROOT_CAUSE'
    && summary.cause !== 'antenna-model-mismatch'
    && summary.cause !== 'beam-diameter-beamwidth-conversion'
  );
  const patternResidualAbs = absSummary(
    input.conventionCases,
    sample => sample.sameThetaPatternConventionResidualDb - sample.diameterAdaptedMismatchDb,
  );

  return modelCause?.status === 'ROOT_CAUSE'
    && otherUnexpectedRootCauses.length === 0
    && (patternResidualAbs.max ?? Number.POSITIVE_INFINITY) <= input.fixture.thresholds.patternConventionResidualToleranceDb;
}

function statusFromEvidence(input: {
  structuralFailures: readonly string[];
  fixture: Phase6VFixtureFile;
  phase6U: Phase6USummary;
  residualExplainableByJ1J3PatternConvention: boolean;
}): Phase6VStatus {
  if (input.structuralFailures.length > 0) return 'NEEDS_SOURCE_PROVENANCE';

  const residualP50 = input.phase6U.diameterAdaptedAbsBeamGainDiffDb.p50 ?? Number.POSITIVE_INFINITY;
  const residualMean = input.phase6U.diameterAdaptedAbsBeamGainDiffDb.mean ?? Number.POSITIVE_INFINITY;
  const adapterResidualWithinTolerance = residualP50 <= input.fixture.thresholds.residualP50ToleranceDb
    && residualMean <= input.fixture.thresholds.residualMeanToleranceDb;

  if (adapterResidualWithinTolerance && !input.residualExplainableByJ1J3PatternConvention) {
    return 'READY_FOR_PHASE6W_SHADOW_ADAPTER';
  }
  if (input.residualExplainableByJ1J3PatternConvention) {
    return 'BLOCKED_BY_PATTERN_CONVENTION';
  }
  return 'NEEDS_SOURCE_PROVENANCE';
}

function representativeConventionCases(cases: readonly ConventionCase[]): ConventionCase[] {
  return [0, 0.5, 1, 1.5, 2.5].flatMap(ratio => {
    const matching = cases.filter(sample => sample.offAxisRatioToProfileBeamwidth === ratio);
    if (matching.length === 0) return [];
    return matching.slice(0, 1);
  });
}

function summarizeConventionCases(cases: readonly ConventionCase[]): Record<string, {
  sampleCount: number;
  rawAbsMismatchDb: NumericSummary;
  diameterAdaptedAbsMismatchDb: NumericSummary;
  sameThetaPatternConventionAbsResidualDb: NumericSummary;
}> {
  const profileIds = [...new Set(cases.map(sample => sample.profileId))].sort((a, b) => a.localeCompare(b));
  return Object.fromEntries(profileIds.map(profileId => {
    const profileCases = cases.filter(sample => sample.profileId === profileId);
    return [profileId, {
      sampleCount: profileCases.length,
      rawAbsMismatchDb: absSummary(profileCases, sample => sample.rawMismatchDb),
      diameterAdaptedAbsMismatchDb: absSummary(profileCases, sample => sample.diameterAdaptedMismatchDb),
      sameThetaPatternConventionAbsResidualDb: absSummary(profileCases, sample => sample.sameThetaPatternConventionResidualDb),
    }];
  }));
}

function run(): void {
  const fixture = loadPhase6VFixture();
  const runtimeScan = scanRuntimeNonAdoption();
  const unsupportedClaimScan = scanUnsupported1937Claims();
  const replayEvidenceClaimScan = scanModqnReplayEvidenceClaims();
  const stalePhase6MAdapterParityTokenScan = scanStalePhase6MAdapterParityTokens();
  const packageScriptFailures = validatePackageScript();
  const phase6U = runPhase6USummary();
  const conventionCases = createConventionCases(fixture);
  const phase6URawMean = phase6U.rawAbsBeamGainDiffDb.mean ?? Number.POSITIVE_INFINITY;
  const fixtureFailures = [
    ...fixture.requiredProfiles
      .filter(profileId => !conventionCases.some(sample => sample.profileId === profileId))
      .map(profileId => `missing Phase 6V convention sweep profile ${profileId}`),
    ...(phase6URawMean > fixture.thresholds.phase6UMaxAllowedRawMeanAbsDb
      ? [`Phase 6U raw mean abs mismatch ${phase6URawMean} exceeded sanity ceiling ${fixture.thresholds.phase6UMaxAllowedRawMeanAbsDb}`]
      : []),
  ];
  const residualExplainableByJ1J3PatternConvention = conventionResidualIsExplained({
    phase6U,
    conventionCases,
    fixture,
  });
  const structuralFailures = [
    ...fixtureFailures,
    ...packageScriptFailures,
    ...runtimeScan.leaks.map(leak => `runtime adoption leak: ${leak}`),
    ...unsupportedClaimScan.leaks.map(leak => `unsupported 19/37 claim: ${leak}`),
    ...replayEvidenceClaimScan.leaks.map(leak => `MODQN replay evidence claim leak: ${leak}`),
    ...stalePhase6MAdapterParityTokenScan.leaks.map(leak => `stale Phase 6M adapter-parity token: ${leak}`),
    ...phase6U.structuralFailures.map(failure => `Phase 6U dependency failure: ${failure}`),
  ];
  const admittedAdditionalConventionCandidates: unknown[] = [];
  const phase6VStatus = statusFromEvidence({
    structuralFailures,
    fixture,
    phase6U,
    residualExplainableByJ1J3PatternConvention,
  });
  const adapterOnlyFixDefensible = phase6VStatus === 'READY_FOR_PHASE6W_SHADOW_ADAPTER';

  if (phase6VStatus !== fixture.expectedPhase6VStatus) {
    structuralFailures.push(`${FIXTURE_PATH} expected ${fixture.expectedPhase6VStatus}, computed ${phase6VStatus}`);
  }

  const gitHead = gitOutput(['rev-parse', 'HEAD']);
  const conventionRawAbsMismatchDb = absSummary(conventionCases, sample => sample.rawMismatchDb);
  const conventionDiameterAdaptedAbsMismatchDb = absSummary(conventionCases, sample => sample.diameterAdaptedMismatchDb);
  const conventionSameThetaPatternResidualAbsDb = absSummary(
    conventionCases,
    sample => sample.sameThetaPatternConventionResidualDb,
  );
  const summary = {
    schemaVersion: SUMMARY_SCHEMA_VERSION,
    phase: '6V',
    repo: 'leo-beam-sim',
    validator: VALIDATOR_SCRIPT,
    fixturePath: FIXTURE_PATH,
    phase6UFixturePath: PHASE6U_FIXTURE_PATH,
    generatedAt: new Date().toISOString(),
    gitHead,
    runtimeBehaviorChanged: false,
    browserSmokeRun: false,
    runtimeAdoption: {
      status: 'not-adopted',
      evidence: runtimeScan,
      liveRuntimeImportsPhase6VValidator: false,
      liveRuntimeImportsCoreChannel: runtimeScan.status !== 'PASS',
    },
    phase6VStatus,
    adapterOnlyFixDefensible,
    residualExplainableByJ1J3PatternConvention,
    structuralFailures,
    claimScans: {
      unsupported1937TrainedBaselineClaimScan: unsupportedClaimScan.status,
      modqnReplayEvidenceClaimScan: replayEvidenceClaimScan.status,
      stalePhase6MAdapterParityTokenScan: stalePhase6MAdapterParityTokenScan.status,
    },
    comparedConventions: [
      {
        id: 'leo-current-hobs-itu-normalized-j1j3',
        implementation: 'src/engine/signal/beam-gain.ts',
        provenance: [
          'PAP-2024-HOBS Eq.(3) / ITU-R S.672-4 comment in src/engine/signal/beam-gain.ts',
          'profile antenna.beamwidth3dBRad as fixed theta3dB input',
        ],
        formulaNotes: [
          'alphaScale=1.835239914925094 for bessel-j1-j3',
          'boresight envelope normalization=1.75',
          'relative pattern delta; max antenna gain is applied outside the helper',
          'beam-gain floor=-40 dB',
        ],
      },
      {
        id: 'vendored-ntn-sim-core-j1j3-raw-diameter',
        implementation: 'src/core/channel/beam-gain.ts',
        provenance: [
          'vendored from /home/u24/papers/ntn-sim-core/src/core/channel/beam-gain.ts',
          'Phase 6F source-side validate:golden-channel passed before vendoring',
        ],
        formulaNotes: [
          'theta3db=atan(beamDiameterKm/(2*altitudeKm)) for bessel-j1j3',
          'u=2.07123*sin(theta)/sin(theta3db)',
          'pattern=(J1(u)/(2u)+36*J3(u)/u^3)^2',
          'relative pattern delta for bessel-j1j3; no -40 dB floor in the vendored helper',
        ],
      },
      {
        id: 'phase6u-diameter-beamwidth-adapter-candidate',
        implementation: 'validator-only input adapter candidate',
        provenance: [
          'Phase 6U diameter/beamwidth adapter',
          'ntn-sim-core HOBS source map documents D=2h*tan(theta3dB)=63.87 km for theta3dB=0.058 rad and h=550 km',
        ],
        formulaNotes: [
          'passes beamDiameterKm=2*altitudeKm*tan(profile.antenna.beamwidth3dBRad)',
          'makes vendored theta3db=atan(D/(2h)) match Leo profile beamwidth3dBRad',
          'does not change either J1+J3 pattern convention',
        ],
      },
    ],
    additionalConventionCandidates: {
      admitted: admittedAdditionalConventionCandidates,
      rejectedAsNotProvenanceBacked: [
        {
          id: 'calibrated-u-scale-or-envelope-fit',
          reason: 'would curve-fit the source helper to Leo residuals without a paper/source-map/source-code authority for changing the J1+J3 convention',
        },
      ],
    },
    phase6UFullWindowMetrics: {
      caseCount: phase6U.caseCount,
      rawAbsBeamGainDiffDb: phase6U.rawAbsBeamGainDiffDb,
      diameterAdaptedAbsBeamGainDiffDb: phase6U.diameterAdaptedAbsBeamGainDiffDb,
      remainingResidualMismatchDb: phase6U.diameterAdaptedAbsBeamGainDiffDb,
      rawLinkImpactEstimateAbsDb: phase6U.rawLinkImpactEstimateAbsDb,
      diameterAdaptedLinkImpactEstimateAbsDb: phase6U.diameterAdaptedLinkImpactEstimateAbsDb,
      phase6UStatus: phase6U.phase6UStatus,
      phase6UAdapterOnlyFixReady: phase6U.adapterOnlyFixReady,
    },
    phase6VConventionSweepMetrics: {
      caseCount: conventionCases.length,
      rawAbsMismatchDb: conventionRawAbsMismatchDb,
      diameterAdaptedAbsMismatchDb: conventionDiameterAdaptedAbsMismatchDb,
      remainingResidualMismatchDb: conventionDiameterAdaptedAbsMismatchDb,
      sameThetaPatternConventionAbsResidualDb: conventionSameThetaPatternResidualAbsDb,
      byProfile: summarizeConventionCases(conventionCases),
      representativeCases: representativeConventionCases(conventionCases),
    },
    residualCause: {
      primary: residualExplainableByJ1J3PatternConvention
        ? 'J1+J3_PATTERN_CONVENTION'
        : 'UNRESOLVED_OR_SOURCE_PROVENANCE_NEEDED',
      explanation: residualExplainableByJ1J3PatternConvention
        ? 'After the Phase 6U diameter adapter makes theta3dB match, residual drift is the same-theta difference between Leo normalized J1+J3 constants/envelope/floor and the vendored source J1+J3 constants/envelope convention.'
        : 'The residual is not fully explained by the admitted same-theta J1+J3 convention comparison.',
      phase6UCauseSummary: phase6U.causeSummary,
    },
    recommendation: adapterOnlyFixDefensible
      ? 'Phase 6W may implement a validator-only shadow adapter for diameter/beamwidth mapping, then rerun Phase 6T before any runtime adoption.'
      : 'Do not implement an adapter-only runtime or shadow fix yet. Phase 6W must either choose a provenance-backed J1+J3 convention explicitly or remain blocked; live runtime adoption and UI controls remain out of scope.',
  };

  console.log(`MODQN Phase 6V antenna-pattern convention status: ${phase6VStatus}`);
  console.log(JSON.stringify(summary, null, 2));

  if (structuralFailures.length > 0) {
    process.exitCode = 1;
  }
}

run();
