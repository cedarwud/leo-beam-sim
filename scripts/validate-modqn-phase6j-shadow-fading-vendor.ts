import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  classifyBand,
  getShadowFadingParams,
  sampleShadowFading,
} from '../src/core/channel/shadow-fading.ts';
import {
  MODQN_BEAM_COUNT_CLAIM_LABELS,
  getModqnBeamCountBridgeClaim,
} from '../src/modqn/replay-bundle/index.ts';

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_COMMIT = '54b44159084fca606afc90ad104b1ddbf23844fc';
const SOURCE_SHADOW_FADING_PATH = '/home/u24/papers/ntn-sim-core/src/core/channel/shadow-fading.ts';
const DESTINATION_SHADOW_FADING_PATH = 'src/core/channel/shadow-fading.ts';
const CLEANED_SOURCE_SHA256 = 'b49b08a3dcbcdcdd2753b88cf809869054c603f89a39cbd96ee4943861626935';
const CLEANED_IMPORT_LINE = "import type { DeploymentEnvironment, ShadowFadingParams } from './types';";
const REMOVED_PROFILE_IMPORT = "@/core/profiles/types";

const FORBIDDEN_VENDOR_PATHS = [
  'src/core/profiles',
  'src/runtime/engine/channel',
] as const;

const ALLOWED_LATER_PHASE_VENDOR_PATHS = [
  'src/core/channel/index.ts',
] as const;

const NON_ADOPTION_SCAN_PATHS = [
  'src/engine/signal',
  'src/engine/handover',
  'src/scene/useSimulation.ts',
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

function extractImportSources(source: string): string[] {
  const imports: string[] = [];
  const importPattern = /^\s*import\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"];?/gm;
  for (const match of source.matchAll(importPattern)) {
    imports.push(match[1]);
  }
  return imports;
}

function assertApproxEqual(actual: number, expected: number, tolerance: number, label: string): void {
  assert.ok(Number.isFinite(actual), `${label}: actual value is not finite`);
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected}, got ${actual}, diff ${Math.abs(actual - expected)}`,
  );
}

function fixedRng(values: readonly number[]): () => number {
  let index = 0;
  return () => {
    const value = values[index % values.length];
    index += 1;
    return value;
  };
}

function assertVendorCopyIntegrity(): void {
  const sourceText = readFileSync(SOURCE_SHADOW_FADING_PATH, 'utf8');
  const destinationText = readRepoFile(DESTINATION_SHADOW_FADING_PATH);

  assert.equal(
    sha256Text(sourceText),
    CLEANED_SOURCE_SHA256,
    'cleaned source shadow-fading.ts hash drifted from the accepted Phase 6I cleanup',
  );
  assert.equal(
    sha256RepoFile(DESTINATION_SHADOW_FADING_PATH),
    CLEANED_SOURCE_SHA256,
    'destination shadow-fading.ts hash does not match the cleaned source hash',
  );
  assert.equal(
    destinationText,
    sourceText,
    'destination shadow-fading.ts is not an exact copy of the cleaned source',
  );

  assert.equal(sourceText.includes(CLEANED_IMPORT_LINE), true, 'source lost the Phase 6I ./types import cleanup');
  assert.equal(destinationText.includes(CLEANED_IMPORT_LINE), true, 'destination lost the Phase 6I ./types import cleanup');
  assert.equal(sourceText.includes(REMOVED_PROFILE_IMPORT), false, 'source still imports the profile DeploymentEnvironment type');
  assert.equal(destinationText.includes(REMOVED_PROFILE_IMPORT), false, 'destination still imports the profile DeploymentEnvironment type');

  for (const forbiddenPath of FORBIDDEN_VENDOR_PATHS) {
    assert.equal(
      existsSync(join(ROOT_DIR, forbiddenPath)),
      false,
      `${forbiddenPath} must not be vendored in Phase 6J`,
    );
  }

  for (const allowedPath of ALLOWED_LATER_PHASE_VENDOR_PATHS) {
    const fullPath = join(ROOT_DIR, allowedPath);
    if (existsSync(fullPath)) {
      assert.equal(
        statSync(fullPath).isFile(),
        true,
        `${allowedPath} must remain a file when present as the later Phase 6L channel barrel copy`,
      );
    }
  }
}

function assertImportSurfaceAndKillSwitch(): void {
  const text = readRepoFile(DESTINATION_SHADOW_FADING_PATH);
  const importSources = extractImportSources(text);
  const forbiddenImportSources = /^(react|react-dom|three|@react-three)(\/|$)|(^|\/)(viz|app|scene)(\/|$)|\.tsx$/;
  const forbiddenExecutableTokens = /\b(React|window|document|navigator|localStorage|sessionStorage|fetch|HTMLCanvasElement|CanvasRenderingContext2D|WebGLRenderingContext|WebGL2RenderingContext)\b|(?:^|['"/])(?:viz|app|scene)(?:['"/]|$)|\.tsx\b/;

  assert.deepEqual(
    importSources,
    ['./types'],
    `${DESTINATION_SHADOW_FADING_PATH} import surface must remain only ./types`,
  );
  assert.equal(
    importSources.includes(REMOVED_PROFILE_IMPORT),
    false,
    `${DESTINATION_SHADOW_FADING_PATH} must not import ${REMOVED_PROFILE_IMPORT}`,
  );
  for (const importSource of importSources) {
    assert.equal(
      forbiddenImportSources.test(importSource),
      false,
      `${DESTINATION_SHADOW_FADING_PATH} imports forbidden runtime/UI source ${importSource}`,
    );
  }

  assert.equal(
    forbiddenExecutableTokens.test(stripComments(text)),
    false,
    `${DESTINATION_SHADOW_FADING_PATH} references forbidden runtime/UI/browser tokens in executable code`,
  );
}

function assertShadowFadingFixtures(): void {
  const bandFixtures = [
    { label: 'S-band low carrier', actual: classifyBand(2), expected: 's-band' },
    { label: 'S-band upper edge below Ka', actual: classifyBand(17.999), expected: 's-band' },
    { label: 'Ka-band threshold', actual: classifyBand(18), expected: 'ka-band' },
    { label: 'Ka-band carrier', actual: classifyBand(28), expected: 'ka-band' },
  ] as const;

  for (const fixture of bandFixtures) {
    assert.equal(fixture.actual, fixture.expected, fixture.label);
  }

  const paramsFixtures = [
    {
      label: 'S-band dense urban clamps to 10deg',
      actual: getShadowFadingParams(5, 'dense-urban', 2),
      expected: { losSigmaDb: 3.5, nlosSigmaDb: 15.5, clutterLossDb: 34.3 },
    },
    {
      label: 'S-band suburban interpolation at 45deg',
      actual: getShadowFadingParams(45, 'suburban', 2),
      expected: { losSigmaDb: 1.17, nlosSigmaDb: 10.405000000000001, clutterLossDb: 18.455 },
    },
    {
      label: 'S-band rural default carrier',
      actual: getShadowFadingParams(84, 'rural'),
      expected: { losSigmaDb: 0.72, nlosSigmaDb: 11.52, clutterLossDb: 16.3 },
    },
    {
      label: 'Ka-band suburban table lookup',
      actual: getShadowFadingParams(20, 'suburban', 28),
      expected: { losSigmaDb: 1.6, nlosSigmaDb: 10, clutterLossDb: 24.6 },
    },
    {
      label: 'Ka-band dense urban interpolation at 75deg',
      actual: getShadowFadingParams(75, 'dense-urban', 28),
      expected: { losSigmaDb: 2.7, nlosSigmaDb: 12.2, clutterLossDb: 33.15 },
    },
  ];

  for (const fixture of paramsFixtures) {
    assertApproxEqual(fixture.actual.losSigmaDb, fixture.expected.losSigmaDb, 1e-12, `${fixture.label} losSigmaDb`);
    assertApproxEqual(fixture.actual.nlosSigmaDb, fixture.expected.nlosSigmaDb, 1e-12, `${fixture.label} nlosSigmaDb`);
    assertApproxEqual(fixture.actual.clutterLossDb, fixture.expected.clutterLossDb, 1e-12, `${fixture.label} clutterLossDb`);
  }

  const sampleFixtures = [
    {
      label: 'shadow fading sample dense urban sigma',
      actual: sampleShadowFading(3.5, fixedRng([0.11, 0.42])),
      expected: -6.44417577783466,
    },
    {
      label: 'shadow fading sample interpolated NLOS sigma',
      actual: sampleShadowFading(10.405, fixedRng([0.64, 0.23])),
      expected: 1.2320561331998887,
    },
    {
      label: 'shadow fading zero sigma',
      actual: sampleShadowFading(0, fixedRng([0.37, 0.61])),
      expected: 0,
    },
  ];

  for (const fixture of sampleFixtures) {
    assertApproxEqual(fixture.actual, fixture.expected, 1e-12, fixture.label);
  }
}

function assertRuntimeNotAdopted(): void {
  const blockedPatterns = [
    /\b@\/core\/channel\/shadow-fading\b/,
    /\bsrc\/core\/channel\/shadow-fading\b/,
    /\bcore\/channel\/shadow-fading\b/,
    /\.\.\/(?:\.\.\/)*core\/channel\/shadow-fading\b/,
    /\bclassifyBand\b/,
    /\bgetShadowFadingParams\b/,
    /\bsampleShadowFading\b/,
  ];
  const scannedFiles = NON_ADOPTION_SCAN_PATHS
    .flatMap(scanPath => listRepoFiles(scanPath))
    .filter(file => ['.ts', '.tsx', '.json'].includes(extname(file)));
  const leaks: string[] = [];

  for (const file of scannedFiles) {
    const text = readRepoFile(file);
    for (const [lineIndex, line] of text.split(/\r?\n/).entries()) {
      if (blockedPatterns.some(pattern => pattern.test(line))) {
        leaks.push(`${file}:${lineIndex + 1}: ${line.trim()}`);
      }
    }
  }

  assert.equal(
    leaks.length,
    0,
    `Phase 6J shadow-fading helper was adopted by runtime/UI/MODQN surfaces:\n${leaks.join('\n')}`,
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
    packageJson.scripts?.['validate:modqn:phase6j-shadow-fading-vendor'],
    'node --import tsx/esm scripts/validate-modqn-phase6j-shadow-fading-vendor.ts',
    'package.json is missing the Phase 6J validator script',
  );
}

function run(): void {
  assertVendorCopyIntegrity();
  assertImportSurfaceAndKillSwitch();
  assertShadowFadingFixtures();
  assertRuntimeNotAdopted();
  assertClaimBoundaryText();
  assertPackageScript();

  console.log('MODQN Phase 6J shadow-fading vendor validation passed.');
  console.log(JSON.stringify({
    copiedSource: {
      sourceCommit: SOURCE_COMMIT,
      sourcePath: SOURCE_SHADOW_FADING_PATH,
      destinationPath: DESTINATION_SHADOW_FADING_PATH,
      cleanedSourceSha256: CLEANED_SOURCE_SHA256,
      normalization: 'exact copy of accepted Phase 6I cleaned source',
      phase6iImportCleanup: {
        from: "import type { DeploymentEnvironment } from '@/core/profiles/types';",
        to: CLEANED_IMPORT_LINE,
      },
    },
    importSurface: {
      [DESTINATION_SHADOW_FADING_PATH]: ['./types'],
    },
    deterministicFixtures: [
      'classifyBand fixtures passed',
      'getShadowFadingParams table, clamp, and interpolation fixtures passed',
      'sampleShadowFading fixed RNG fixtures passed',
    ],
    forbiddenCopies: FORBIDDEN_VENDOR_PATHS,
    allowedLaterPhaseCopies: ALLOWED_LATER_PHASE_VENDOR_PATHS,
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
