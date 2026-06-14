import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  classifyBand,
  computeBeamGain,
  computeDopplerShiftHz,
  computeFspl,
  computeLinkBudget,
  computeOffAxisAngle,
  computeSinr,
  dopplerSinrDegradationDb,
  estimateRadialVelocityKmS,
  getShadowFadingParams,
  sampleShadowFading,
  sampleShadowedRicianDb,
} from '../src/core/channel/index.ts';
import {
  MODQN_BEAM_COUNT_CLAIM_LABELS,
  getModqnBeamCountBridgeClaim,
} from '../src/modqn/replay-bundle/index.ts';

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_COMMIT = '54b44159084fca606afc90ad104b1ddbf23844fc';
const SOURCE_INDEX_PATH = '/home/u24/papers/ntn-sim-core/src/core/channel/index.ts';
const DESTINATION_INDEX_PATH = 'src/core/channel/index.ts';
const INDEX_SHA256 = 'a393bf18c5e19003b60fe1debb045bdde9ab2cfe4730b353fa9e0eea8b230b14';

const FORBIDDEN_COPY_PATHS = [
  'src/core/profiles',
  'src/runtime/engine/channel',
  'src/runtime/engine/channel.ts',
  'src/runtime/engine/channel-step.ts',
  'src/runtime/engine/channel-sinr-helpers.ts',
  'src/core/engine/channel-step.ts',
  'src/core/engine/channel-sinr-helpers.ts',
  'src/engine/channel-step.ts',
  'src/engine/channel-sinr-helpers.ts',
] as const;

const NON_ADOPTION_SCAN_PATHS = [
  'src/engine/signal',
  'src/engine/handover',
  'src/scene',
  'src/profiles',
  'src/ui',
  'src/modqn',
] as const;

const CLAIM_SCAN_ROOTS = [
  'docs',
  'scripts',
  'src/modqn',
] as const;

function readRepoFile(relativePath: string): string {
  return readFileSync(join(ROOT_DIR, relativePath), 'utf8');
}

function sha256Text(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function sha256RepoFile(relativePath: string): string {
  return sha256Text(readRepoFile(relativePath));
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

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

// Like stripComments, but preserves line structure (blanks out comment bodies
// instead of deleting them) so per-line scans keep accurate 1-based line
// numbers. Used by the runtime-adoption scan so that a real future adoption
// still reports the correct line, while documentation/JSDoc that merely names
// `core/channel` (to declare it is NOT imported) is not mistaken for adoption.
function stripCommentsPreservingLines(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, match => match.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/gm, (_match, prefix: string) => prefix);
}

function extractImportSources(source: string): string[] {
  const imports: string[] = [];
  const importPattern = /^\s*import\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"];?/gm;
  for (const match of source.matchAll(importPattern)) {
    imports.push(match[1]);
  }
  return imports;
}

function extractExportSources(source: string): string[] {
  const exports: string[] = [];
  const exportPattern = /^\s*export\s+(?:type\s+)?(?:\{[\s\S]*?\}|\*)\s+from\s+['"]([^'"]+)['"];?/gm;
  for (const match of source.matchAll(exportPattern)) {
    exports.push(match[1]);
  }
  return exports;
}

function fixedRng(values: readonly number[]): () => number {
  let index = 0;
  return () => {
    const value = values[index % values.length];
    index += 1;
    return value;
  };
}

function assertApproxEqual(actual: number, expected: number, tolerance: number, label: string): void {
  assert.ok(Number.isFinite(actual), `${label}: actual value is not finite`);
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected}, got ${actual}, diff ${Math.abs(actual - expected)}`,
  );
}

function assertIndexCopyIntegrity(): void {
  const sourceText = readFileSync(SOURCE_INDEX_PATH, 'utf8');
  const destinationText = readRepoFile(DESTINATION_INDEX_PATH);

  assert.equal(
    sha256Text(sourceText),
    INDEX_SHA256,
    `${SOURCE_INDEX_PATH} source hash drifted from audited ${SOURCE_COMMIT}`,
  );
  assert.equal(
    sha256RepoFile(DESTINATION_INDEX_PATH),
    INDEX_SHA256,
    `${DESTINATION_INDEX_PATH} destination hash drifted from audited source`,
  );
  assert.equal(
    destinationText,
    sourceText,
    `${DESTINATION_INDEX_PATH} is not an exact source copy`,
  );
}

function assertIndexKillSwitchAndExports(): void {
  const sourceText = readFileSync(SOURCE_INDEX_PATH, 'utf8');
  const destinationText = readRepoFile(DESTINATION_INDEX_PATH);
  const sourceExportSources = extractExportSources(sourceText);
  const destinationExportSources = extractExportSources(destinationText);
  const forbiddenModuleSources = /^(react|react-dom|three|@react-three)(\/|$)|(^|\/)(viz|app|scene|runtime|profiles)(\/|$)|\.tsx$/;
  const forbiddenExecutableTokens = /\b(React|window|document|navigator|localStorage|sessionStorage|fetch|HTMLCanvasElement|CanvasRenderingContext2D|WebGLRenderingContext|WebGL2RenderingContext)\b|(?:^|['"/])(?:viz|app|scene|runtime|profiles)(?:['"/]|$)|\.tsx\b/;

  assert.deepEqual(extractImportSources(destinationText), [], `${DESTINATION_INDEX_PATH} must remain import-free`);
  assert.deepEqual(
    destinationExportSources,
    sourceExportSources,
    `${DESTINATION_INDEX_PATH} export source list drifted from source`,
  );
  assert.ok(destinationExportSources.length > 0, `${DESTINATION_INDEX_PATH} did not expose any channel modules`);

  for (const exportSource of destinationExportSources) {
    assert.equal(
      exportSource.startsWith('./'),
      true,
      `${DESTINATION_INDEX_PATH} export ${exportSource} is not a local channel module`,
    );
    assert.equal(
      exportSource.includes('..'),
      false,
      `${DESTINATION_INDEX_PATH} export ${exportSource} escapes the channel directory`,
    );
    assert.equal(
      forbiddenModuleSources.test(exportSource),
      false,
      `${DESTINATION_INDEX_PATH} exports forbidden runtime/UI/profile module ${exportSource}`,
    );

    const resolvedPath = join(dirname(DESTINATION_INDEX_PATH), `${exportSource}.ts`);
    assert.equal(
      existsSync(join(ROOT_DIR, resolvedPath)),
      true,
      `${DESTINATION_INDEX_PATH} export ${exportSource} does not resolve to local ${resolvedPath}`,
    );
    assert.equal(
      statSync(join(ROOT_DIR, resolvedPath)).isFile(),
      true,
      `${DESTINATION_INDEX_PATH} export ${exportSource} resolved path is not a file`,
    );
  }

  const sourceExportsLosProbability = sourceExportSources.includes('./los-probability');
  const destinationExportsLosProbability = destinationExportSources.includes('./los-probability');
  assert.equal(
    destinationExportsLosProbability,
    sourceExportsLosProbability,
    `${DESTINATION_INDEX_PATH} must not export los-probability unless the source barrel does`,
  );

  assert.equal(
    forbiddenExecutableTokens.test(stripComments(destinationText)),
    false,
    `${DESTINATION_INDEX_PATH} references forbidden runtime/UI/browser/profile tokens in executable code`,
  );
}

function assertBarrelRuntimeSmoke(): void {
  assertApproxEqual(computeFspl(550, 28), 176.20041441672927, 1e-12, 'barrel computeFspl');
  assert.equal(classifyBand(28), 'ka-band', 'barrel classifyBand');
  assert.deepEqual(
    getShadowFadingParams(90, 'rural', 2),
    { losSigmaDb: 0.72, nlosSigmaDb: 11.52, clutterLossDb: 16.3 },
    'barrel getShadowFadingParams',
  );
  assertApproxEqual(sampleShadowFading(3.5, fixedRng([0.11, 0.42])), -6.44417577783466, 1e-12, 'barrel sampleShadowFading');
  assertApproxEqual(
    computeBeamGain({
      offAxisAngleDeg: 0,
      model: 'flat-debug',
      peakGainDbi: 30,
      beamDiameterKm: 50,
      altitudeKm: 600,
    }),
    30,
    1e-12,
    'barrel computeBeamGain',
  );
  assertApproxEqual(computeOffAxisAngle(0, 0, 0, 0, 600), 0, 1e-12, 'barrel computeOffAxisAngle');
  assertApproxEqual(computeSinr({
    servingRxPowerDbm: -80,
    noisePowerDbm: -100,
  }).sinrDb, 20, 1e-12, 'barrel computeSinr');
  assertApproxEqual(
    computeLinkBudget({
      distanceKm: 550,
      frequencyGhz: 28,
      txEirpDbm: 48.5,
      rxAntennaGainDb: 2.1,
      elevationDeg: 90,
      environment: 'rural',
      largeScaleModel: '3gpp-baseline',
      beamGainInput: null,
      noisePowerDbm: -100,
      rngNext: null,
      isLos: true,
      tier1LargeScale: false,
      tier2Clutter: false,
      tier3BeamGain: false,
      tier4Atmospheric: false,
    }).totalPathLossDb,
    176.20041441672927,
    1e-12,
    'barrel computeLinkBudget',
  );
  assertApproxEqual(
    sampleShadowedRicianDb(10, true, fixedRng([
      0.11, 0.42, 0.73, 0.19, 0.37, 0.61,
      0.83, 0.27, 0.49, 0.91, 0.08, 0.56,
    ])),
    -2.766767023120301,
    1e-12,
    'barrel sampleShadowedRicianDb',
  );
  assertApproxEqual(computeDopplerShiftHz(7.5, 2), 50034.61427972281, 1e-9, 'barrel computeDopplerShiftHz');
  assertApproxEqual(estimateRadialVelocityKmS(7.5, 60, true), 3.750000000000001, 1e-12, 'barrel estimateRadialVelocityKmS');
  assertApproxEqual(dopplerSinrDegradationDb(1200, 30), 0.022920723214684163, 1e-12, 'barrel dopplerSinrDegradationDb');
}

function assertForbiddenFilesNotCopied(): void {
  for (const forbiddenPath of FORBIDDEN_COPY_PATHS) {
    assert.equal(
      existsSync(join(ROOT_DIR, forbiddenPath)),
      false,
      `${forbiddenPath} must not be copied for Phase 6L`,
    );
  }
}

function assertRuntimeNotAdopted(): void {
  const blockedPatterns = [
    /\b@\/core\/channel(?:\/[\w-]+)?\b/,
    /\bsrc\/core\/channel(?:\/[\w-]+)?\b/,
    /\bcore\/channel(?:\/[\w-]+)?\b/,
    /\.\.\/(?:\.\.\/)*core\/channel(?:\/[\w-]+)?\b/,
  ];
  const scannedFiles = NON_ADOPTION_SCAN_PATHS
    .flatMap(scanPath => listRepoFiles(scanPath))
    .filter(file => ['.ts', '.tsx', '.json'].includes(extname(file)));
  const leaks: string[] = [];

  for (const file of scannedFiles) {
    // Scan executable code only: JSON has no comments, TS/TSX gets comments
    // blanked (line-structure preserved) so that documentation declaring a
    // module does NOT import `core/channel` is not misread as an adoption.
    const rawText = readRepoFile(file);
    const text = extname(file) === '.json' ? rawText : stripCommentsPreservingLines(rawText);
    for (const [lineIndex, line] of text.split(/\r?\n/).entries()) {
      if (blockedPatterns.some(pattern => pattern.test(line))) {
        leaks.push(`${file}:${lineIndex + 1}: ${line.trim()}`);
      }
    }
  }

  assert.equal(
    leaks.length,
    0,
    `Phase 6L channel barrel was adopted by runtime/UI/MODQN surfaces:\n${leaks.join('\n')}`,
  );
}

function assertClaimBoundaryText(): void {
  assert.equal(/baseline/i.test(MODQN_BEAM_COUNT_CLAIM_LABELS[7]), true, '7-beam claim label lost baseline boundary');
  for (const beamCount of [19, 37] as const) {
    const claim = getModqnBeamCountBridgeClaim(beamCount);
    assert.equal(claim.kind, 'live-sensitivity-demo-only', `${beamCount} claim kind drifted`);
    assert.equal(claim.supportsProducerReplayEvidence, false, `${beamCount} leaked replay evidence support`);
    assert.equal(claim.mayDeriveProducerBeamIdentity, false, `${beamCount} leaked producer identity derivation`);
    assert.equal(/baseline/i.test(claim.label), false, `${beamCount} label leaked baseline wording`);
    assert.match(claim.label, /sensitivity\/demo extension only/);
  }

  const leaks: string[] = [];
  const scannedFiles = CLAIM_SCAN_ROOTS
    .flatMap(scanPath => listRepoFiles(scanPath))
    .filter(file => ['.ts', '.tsx', '.mjs', '.md'].includes(extname(file)));

  for (const relativePath of scannedFiles) {
    const fullPath = join(ROOT_DIR, relativePath);
    const text = readFileSync(fullPath, 'utf8');
    for (const [lineIndex, line] of text.split(/\r?\n/).entries()) {
      const normalized = line.replace(/\s+/g, ' ');
      const referencesExtendedCounts = /(19\s*\/\s*37|19[- ]?beam|37[- ]?beam|19\s+or\s+37)/i.test(normalized);
      const referencesEvidence = /trained[- ]baseline MODQN evidence|trained baseline MODQN evidence/i.test(normalized);
      const isNegatedBoundary = /\b(not|no|must not|does not|do not|without|unless|forbidden|reject|remain|remains|sensitivity\/demo|extension only|false|claim boundary|unsupported|stop|implies|claims)\b/i.test(normalized);

      if (referencesExtendedCounts && referencesEvidence && !isNegatedBoundary) {
        leaks.push(`${relative(ROOT_DIR, fullPath)}:${lineIndex + 1}: ${normalized.trim()}`);
      }
    }
  }

  assert.equal(leaks.length, 0, `unsupported 19/37 trained-baseline claim(s):\n${leaks.join('\n')}`);
}

function assertPackageScript(): void {
  const packageJson = JSON.parse(readRepoFile('package.json')) as {
    scripts?: Record<string, string>;
  };
  assert.equal(
    packageJson.scripts?.['validate:modqn:phase6l-channel-index-vendor'],
    'node --import tsx/esm scripts/validate-modqn-phase6l-channel-index-vendor.ts',
    'package.json is missing the Phase 6L validator script',
  );
}

function assertDocumentation(): void {
  const docPath = 'docs/modqn-baseline-phase6l-channel-index-vendor.md';
  const doc = readRepoFile(docPath);
  assert.match(doc, new RegExp(INDEX_SHA256), `${docPath} lost the copied source hash`);
  assert.match(doc, /runtime adoption status:\s+\*\*not adopted\*\*/i, `${docPath} lost the non-adoption boundary`);
  assert.match(doc, /19` and `37` beams remain live sensitivity\/demo extensions only/i, `${docPath} lost the claim boundary`);
}

function run(): void {
  assertIndexCopyIntegrity();
  assertIndexKillSwitchAndExports();
  assertBarrelRuntimeSmoke();
  assertForbiddenFilesNotCopied();
  assertRuntimeNotAdopted();
  assertClaimBoundaryText();
  assertPackageScript();
  assertDocumentation();

  const exportSources = extractExportSources(readRepoFile(DESTINATION_INDEX_PATH));
  console.log('MODQN Phase 6L channel index vendor validation passed.');
  console.log(JSON.stringify({
    copiedSource: {
      sourceCommit: SOURCE_COMMIT,
      sourcePath: SOURCE_INDEX_PATH,
      destinationPath: DESTINATION_INDEX_PATH,
      sha256: INDEX_SHA256,
      normalization: 'exact copy',
    },
    exportSurface: {
      exportedModules: exportSources,
      losProbabilityExportedBySource: exportSources.includes('./los-probability'),
      allExportedModulesResolveLocally: true,
    },
    forbiddenCopies: FORBIDDEN_COPY_PATHS,
    runtimeAdoption: 'not adopted',
    scannedForRuntimeAdoption: NON_ADOPTION_SCAN_PATHS,
    claimBoundary: {
      7: MODQN_BEAM_COUNT_CLAIM_LABELS[7],
      19: MODQN_BEAM_COUNT_CLAIM_LABELS[19],
      37: MODQN_BEAM_COUNT_CLAIM_LABELS[37],
    },
    result: 'PASS',
  }, null, 2));
}

run();
