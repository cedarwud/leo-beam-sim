import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeLinkBudget } from '../src/core/channel/link-budget.ts';
import type { ChannelResult, LinkBudgetOptions } from '../src/core/channel/types.ts';
import {
  MODQN_BEAM_COUNT_CLAIM_LABELS,
  getModqnBeamCountBridgeClaim,
} from '../src/modqn/replay-bundle/index.ts';
import { skipIfDataUnavailable } from './lib/ci-data-guard.ts';

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_COMMIT = '54b44159084fca606afc90ad104b1ddbf23844fc';
const SOURCE_LINK_BUDGET_PATH = '/home/u24/papers/ntn-sim-core/src/core/channel/link-budget.ts';

// CI-environment guard (P2 SN-3c): the vendor-integrity re-hash reads the frozen
// ntn-sim-core source in the read-only sibling checkout. Skip (visibly, exit 0 +
// marker) when that checkout is absent — the hosted-CI signature. See
// scripts/lib/ci-data-guard.ts for the SKIP semantics.
skipIfDataUnavailable([
  { path: SOURCE_LINK_BUDGET_PATH, why: 'ntn-sim-core vendor source for the link-budget.ts integrity re-hash (sibling checkout required)' },
]);
const DESTINATION_LINK_BUDGET_PATH = 'src/core/channel/link-budget.ts';
const LINK_BUDGET_SHA256 = '06179394f7263291de3d6e26af8b11d44098433f7c8dc0a90ec2b53388278953';
const ALLOWED_IMPORTS = [
  './types',
  './fspl',
  './shadow-fading',
  './beam-gain',
  './small-scale-fading',
] as const;

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
  'src/engine/association',
  'src/scene',
  'src/profiles',
  'src/ui',
  'src/modqn',
  'src/adapters',
  'src/runtime',
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
  const sourceText = readFileSync(SOURCE_LINK_BUDGET_PATH, 'utf8');
  const destinationText = readRepoFile(DESTINATION_LINK_BUDGET_PATH);

  assert.equal(
    sha256Text(sourceText),
    LINK_BUDGET_SHA256,
    `${SOURCE_LINK_BUDGET_PATH} source hash drifted from audited ${SOURCE_COMMIT}`,
  );
  assert.equal(
    sha256RepoFile(DESTINATION_LINK_BUDGET_PATH),
    LINK_BUDGET_SHA256,
    `${DESTINATION_LINK_BUDGET_PATH} destination hash drifted from audited source`,
  );
  assert.equal(
    destinationText,
    sourceText,
    `${DESTINATION_LINK_BUDGET_PATH} is not an exact source copy`,
  );

  for (const forbiddenPath of FORBIDDEN_VENDOR_PATHS) {
    assert.equal(
      existsSync(join(ROOT_DIR, forbiddenPath)),
      false,
      `${forbiddenPath} must not be vendored in Phase 6K`,
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
  const text = readRepoFile(DESTINATION_LINK_BUDGET_PATH);
  const importSources = extractImportSources(text);
  const forbiddenImportSources = /^(react|react-dom|three|@react-three)(\/|$)|(^|\/)(viz|app|scene)(\/|$)|\.tsx$/;
  const forbiddenExecutableTokens = /\b(React|window|document|navigator|localStorage|sessionStorage|fetch|HTMLCanvasElement|CanvasRenderingContext2D|WebGLRenderingContext|WebGL2RenderingContext)\b|(?:^|['"/])(?:viz|app|scene)(?:['"/]|$)|\.tsx\b/;

  assert.deepEqual(
    importSources,
    [...ALLOWED_IMPORTS],
    `${DESTINATION_LINK_BUDGET_PATH} import surface drifted from the Phase 6K composition contract`,
  );

  for (const importSource of importSources) {
    assert.equal(
      forbiddenImportSources.test(importSource),
      false,
      `${DESTINATION_LINK_BUDGET_PATH} imports forbidden runtime/UI source ${importSource}`,
    );
    assert.equal(
      importSource.startsWith('./'),
      true,
      `${DESTINATION_LINK_BUDGET_PATH} import ${importSource} is not a local channel helper`,
    );
    assert.equal(
      existsSync(join(ROOT_DIR, dirname(DESTINATION_LINK_BUDGET_PATH), `${importSource}.ts`)),
      true,
      `${DESTINATION_LINK_BUDGET_PATH} import ${importSource} does not resolve to an existing vendored helper`,
    );
  }

  assert.equal(
    forbiddenExecutableTokens.test(stripComments(text)),
    false,
    `${DESTINATION_LINK_BUDGET_PATH} references forbidden runtime/UI/browser tokens in executable code`,
  );
}

function assertLinkBudgetResult(
  actual: ChannelResult,
  expected: ChannelResult,
  label: string,
): void {
  for (const key of Object.keys(expected) as Array<keyof ChannelResult>) {
    assertApproxEqual(actual[key], expected[key], 1e-12, `${label} ${key}`);
  }

  const recomputedTotal =
    actual.fsplDb +
    actual.implementationLossDb +
    actual.shadowFadingDb +
    actual.clutterLossDb +
    actual.atmosphericDb +
    actual.scanLossDb -
    actual.beamGainDb -
    actual.smallScaleFadingDb;
  assertApproxEqual(actual.totalPathLossDb, recomputedTotal, 1e-12, `${label} totalPathLossDb composition`);
}

function assertLinkBudgetFixtures(): void {
  const fixtures: Array<{
    label: string;
    opts: LinkBudgetOptions;
    expected: ChannelResult;
  }> = [
    {
      label: 'tier0-only',
      opts: {
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
      },
      expected: {
        fsplDb: 176.20041441672927,
        shadowFadingDb: 0,
        clutterLossDb: 0,
        implementationLossDb: 0,
        beamGainDb: 0,
        atmosphericDb: 0,
        scanLossDb: 0,
        smallScaleFadingDb: 0,
        totalPathLossDb: 176.20041441672927,
        rxPowerDbm: -125.60041441672928,
      },
    },
    {
      label: 'nlos-shadow-clutter',
      opts: {
        distanceKm: 1932.2566,
        frequencyGhz: 2,
        txEirpDbm: 45,
        rxAntennaGainDb: 0.5,
        elevationDeg: 10,
        environment: 'dense-urban',
        largeScaleModel: '3gpp-baseline',
        beamGainInput: null,
        noisePowerDbm: -100,
        rngNext: fixedRng([0.11, 0.42]),
        isLos: false,
        tier1LargeScale: true,
        tier2Clutter: true,
        tier3BeamGain: false,
        tier4Atmospheric: false,
        implementationLossDb: 1.25,
      },
      expected: {
        fsplDb: 164.1918959010826,
        shadowFadingDb: -28.53849273041064,
        clutterLossDb: 34.3,
        implementationLossDb: 1.25,
        beamGainDb: 0,
        atmosphericDb: 0,
        scanLossDb: 0,
        smallScaleFadingDb: 0,
        totalPathLossDb: 171.20340317067195,
        rxPowerDbm: -125.70340317067195,
      },
    },
    {
      label: 'ka-full-shadowed',
      opts: {
        distanceKm: 1200.5,
        frequencyGhz: 28,
        txEirpDbm: 52,
        rxAntennaGainDb: 3.3,
        elevationDeg: 37,
        environment: 'suburban',
        largeScaleModel: '3gpp-extended',
        beamGainInput: {
          offAxisAngleDeg: 1.2,
          model: 'rpsat-3gpp',
          peakGainDbi: 30,
          beamDiameterKm: 50,
          altitudeKm: 600,
          slantRangeKm: 900,
        },
        noisePowerDbm: -99,
        rngNext: fixedRng([
          0.64, 0.23, 0.88, 0.12, 0.44, 0.31, 0.77, 0.52,
          0.96, 0.05, 0.68, 0.29, 0.15, 0.84, 0.39, 0.57,
        ]),
        isLos: true,
        tier1LargeScale: true,
        tier2Clutter: true,
        tier3BeamGain: true,
        tier4Atmospheric: true,
        tier35ScanLoss: true,
        scanAngleDeg: 30,
        scanMaxAngleDeg: 60,
        scanLossMaxDb: 3,
        tier5Fading: true,
        tier5FadingModel: 'shadowed-rician',
        implementationLossDb: 0.75,
      },
      expected: {
        fsplDb: 182.9804039147053,
        shadowFadingDb: 0.2581338174315961,
        clutterLossDb: 0,
        implementationLossDb: 0.75,
        beamGainDb: -6.825379484043937,
        atmosphericDb: 3.8894442963572144,
        scanLossDb: 0.75,
        smallScaleFadingDb: 0.33544924440737467,
        totalPathLossDb: 195.11791226813068,
        rxPowerDbm: -139.81791226813067,
      },
    },
    {
      label: 'ka-loo-nlos',
      opts: {
        distanceKm: 900,
        frequencyGhz: 20,
        txEirpDbm: 49,
        rxAntennaGainDb: 1.75,
        elevationDeg: 12.5,
        environment: 'suburban',
        largeScaleModel: '3gpp-extended',
        beamGainInput: {
          offAxisAngleDeg: 0,
          model: 'flat-debug',
          peakGainDbi: 31.7,
          beamDiameterKm: 50,
          altitudeKm: 600,
        },
        noisePowerDbm: -101,
        rngNext: fixedRng([0.21, 0.79, 0.33, 0.58, 0.46, 0.92, 0.17, 0.63]),
        isLos: false,
        tier1LargeScale: true,
        tier2Clutter: true,
        tier3BeamGain: true,
        tier4Atmospheric: true,
        tier35ScanLoss: true,
        scanAngleDeg: 72,
        scanMaxAngleDeg: 60,
        scanLossMaxDb: 2.5,
        tier5Fading: true,
        tier5FadingModel: 'loo',
        implementationLossDb: 2,
      },
      expected: {
        fsplDb: 177.55545010206612,
        shadowFadingDb: 4.624317799274335,
        clutterLossDb: 28.275,
        implementationLossDb: 2,
        beamGainDb: 31.7,
        atmosphericDb: 5.713260262647093,
        scanLossDb: 2.5,
        smallScaleFadingDb: -9.715037332906014,
        totalPathLossDb: 198.68306549689356,
        rxPowerDbm: -147.93306549689356,
      },
    },
  ];

  for (const fixture of fixtures) {
    assertLinkBudgetResult(computeLinkBudget(fixture.opts), fixture.expected, fixture.label);
  }
}

function assertRuntimeNotAdopted(): void {
  const blockedPatterns = [
    /\b@\/core\/channel(?:\/link-budget)?\b/,
    /\bsrc\/core\/channel(?:\/link-budget)?\b/,
    /\bcore\/channel\/link-budget\b/,
    /\.\.\/(?:\.\.\/)*core\/channel(?:\/link-budget)?\b/,
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
    `Phase 6K link-budget helper was adopted by runtime/UI/replay/MODQN surfaces:\n${leaks.join('\n')}`,
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
    packageJson.scripts?.['validate:modqn:phase6k-link-budget-vendor'],
    'node --import tsx/esm scripts/validate-modqn-phase6k-link-budget-vendor.ts',
    'package.json is missing the Phase 6K validator script',
  );
}

function assertDocumentation(): void {
  const docPath = 'docs/modqn-baseline-phase6k-link-budget-vendor.md';
  const doc = readRepoFile(docPath);
  assert.match(doc, /runtime adoption status:\s+\*\*not adopted\*\*/i, `${docPath} lost the non-adoption boundary`);
  assert.match(doc, new RegExp(LINK_BUDGET_SHA256), `${docPath} lost the copied source hash`);
}

function run(): void {
  assertVendorCopyIntegrity();
  assertImportSurfaceAndKillSwitch();
  assertLinkBudgetFixtures();
  assertRuntimeNotAdopted();
  assertClaimBoundaryText();
  assertPackageScript();
  assertDocumentation();

  console.log('MODQN Phase 6K link-budget vendor validation passed.');
  console.log(JSON.stringify({
    copiedSource: {
      sourceCommit: SOURCE_COMMIT,
      sourcePath: SOURCE_LINK_BUDGET_PATH,
      destinationPath: DESTINATION_LINK_BUDGET_PATH,
      sha256: LINK_BUDGET_SHA256,
      normalization: 'exact copy',
    },
    importSurface: {
      [DESTINATION_LINK_BUDGET_PATH]: ALLOWED_IMPORTS,
    },
    deterministicFixtures: [
      'Tier 0 FSPL-only fixture passed',
      'NLOS shadow-fading plus clutter fixture passed',
      'Ka-band extended shadowed-Rician fixture passed',
      'Ka-band extended Loo NLOS fixture passed',
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
