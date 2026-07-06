import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  computeDopplerShiftHz,
  dopplerSinrDegradationDb,
  estimateRadialVelocityKmS,
} from '../src/core/channel/doppler.ts';
import {
  getLosProbabilityTr38811,
  sampleLosStateTr38811,
} from '../src/core/channel/los-probability.ts';
import {
  sampleLooDb,
  sampleShadowedRicianDb,
} from '../src/core/channel/small-scale-fading.ts';
import {
  MODQN_BEAM_COUNT_CLAIM_LABELS,
  getModqnBeamCountBridgeClaim,
} from '../src/modqn/replay-bundle/index.ts';
import { skipIfDataUnavailable } from './lib/ci-data-guard.ts';

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_COMMIT = '54b44159084fca606afc90ad104b1ddbf23844fc';

const COPIED_FILES = [
  {
    sourcePath: '/home/u24/papers/ntn-sim-core/src/core/channel/small-scale-fading.ts',
    destinationPath: 'src/core/channel/small-scale-fading.ts',
    sha256: '9c16226b265a386c349d1052bed9b90351c112a0029d9a651fb9dd6cd49f0dc0',
    allowedImports: [] as string[],
  },
  {
    sourcePath: '/home/u24/papers/ntn-sim-core/src/core/channel/los-probability.ts',
    destinationPath: 'src/core/channel/los-probability.ts',
    sha256: '1cac93ddc0c1d6f21252c1241f8f9680dbc072b0e7ca798bcbc065f4a6dff45d',
    allowedImports: ['./types'],
  },
  {
    sourcePath: '/home/u24/papers/ntn-sim-core/src/core/channel/doppler.ts',
    destinationPath: 'src/core/channel/doppler.ts',
    sha256: '5aa97d8a056b463c6d2a0db00a38e34fca36841f7db0ac02b5f4a464a6f39f24',
    allowedImports: [] as string[],
  },
] as const;

// CI-environment guard (P2 SN-3c): assertVendorCopyIntegrity() re-hashes the frozen
// ntn-sim-core source files in the read-only sibling checkout. Skip (visibly,
// exit 0 + marker) when that checkout is absent — the hosted-CI signature. See
// scripts/lib/ci-data-guard.ts for the SKIP semantics.
skipIfDataUnavailable(COPIED_FILES.map(({ sourcePath }) => ({
  path: sourcePath,
  why: 'ntn-sim-core vendor source for the channel-remainder integrity re-hash (sibling checkout required)',
})));

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
  for (const copiedFile of COPIED_FILES) {
    const sourceText = readFileSync(copiedFile.sourcePath, 'utf8');
    const destinationText = readRepoFile(copiedFile.destinationPath);

    assert.equal(
      sha256Text(sourceText),
      copiedFile.sha256,
      `${copiedFile.sourcePath} source hash drifted from audited ${SOURCE_COMMIT}`,
    );
    assert.equal(
      sha256RepoFile(copiedFile.destinationPath),
      copiedFile.sha256,
      `${copiedFile.destinationPath} destination hash drifted from audited source`,
    );
    assert.equal(
      destinationText,
      sourceText,
      `${copiedFile.destinationPath} is not an exact source copy`,
    );
  }

  for (const forbiddenPath of FORBIDDEN_VENDOR_PATHS) {
    assert.equal(
      existsSync(join(ROOT_DIR, forbiddenPath)),
      false,
      `${forbiddenPath} must not be vendored in Phase 6H`,
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
  const forbiddenImportSources = /^(react|react-dom|three|@react-three)(\/|$)|(^|\/)(viz|app|scene)(\/|$)|\.tsx$/;
  const forbiddenExecutableTokens = /\b(React|window|document|navigator|localStorage|sessionStorage|fetch|HTMLCanvasElement|CanvasRenderingContext2D|WebGLRenderingContext|WebGL2RenderingContext)\b|(?:^|['"/])(?:viz|app|scene)(?:['"/]|$)|\.tsx\b/;

  for (const copiedFile of COPIED_FILES) {
    const text = readRepoFile(copiedFile.destinationPath);
    const importSources = extractImportSources(text);
    assert.deepEqual(
      importSources,
      copiedFile.allowedImports,
      `${copiedFile.destinationPath} import surface drifted from Phase 6H leaf contract`,
    );

    for (const importSource of importSources) {
      assert.equal(
        forbiddenImportSources.test(importSource),
        false,
        `${copiedFile.destinationPath} imports forbidden runtime/UI source ${importSource}`,
      );
    }

    assert.equal(
      forbiddenExecutableTokens.test(stripComments(text)),
      false,
      `${copiedFile.destinationPath} references forbidden runtime/UI/browser tokens in executable code`,
    );
  }
}

function assertSmallScaleFadingFixtures(): void {
  const fixtures = [
    {
      label: 'shadowed-rician 10deg LOS',
      actual: sampleShadowedRicianDb(10, true, fixedRng([
        0.11, 0.42, 0.73, 0.19, 0.37, 0.61,
        0.83, 0.27, 0.49, 0.91, 0.08, 0.56,
      ])),
      expected: -2.766767023120301,
    },
    {
      label: 'shadowed-rician 37deg NLOS',
      actual: sampleShadowedRicianDb(37, false, fixedRng([
        0.64, 0.23, 0.88, 0.12, 0.44, 0.31,
        0.77, 0.52, 0.96, 0.05, 0.68, 0.29,
        0.15, 0.84, 0.39, 0.57,
      ])),
      expected: 4.1290355973920265,
    },
    {
      label: 'loo 12.5deg',
      actual: sampleLooDb(12.5, fixedRng([0.21, 0.79, 0.33, 0.58, 0.46, 0.92])),
      expected: 0.6935076148666407,
    },
    {
      label: 'loo 70deg',
      actual: sampleLooDb(70, fixedRng([0.67, 0.14, 0.91, 0.36, 0.25, 0.82])),
      expected: -0.0020824126380100194,
    },
  ];

  for (const fixture of fixtures) {
    assertApproxEqual(fixture.actual, fixture.expected, 1e-12, fixture.label);
  }
}

function assertLosProbabilityFixtures(): void {
  const probabilityFixtures = [
    {
      label: 'dense urban clamp to 10deg',
      actual: getLosProbabilityTr38811(9, 'dense-urban'),
      expected: 0.282,
    },
    {
      label: 'suburban nearest 20deg',
      actual: getLosProbabilityTr38811(15, 'suburban'),
      expected: 0.869,
    },
    {
      label: 'rural nearest 80deg',
      actual: getLosProbabilityTr38811(84, 'rural'),
      expected: 0.952,
    },
    {
      label: 'dense urban 90deg',
      actual: getLosProbabilityTr38811(90, 'dense-urban'),
      expected: 0.981,
    },
  ];

  for (const fixture of probabilityFixtures) {
    assertApproxEqual(fixture.actual, fixture.expected, 1e-12, fixture.label);
  }

  const stateFixtures = [
    {
      label: 'dense urban deterministic NLOS',
      actual: sampleLosStateTr38811(10, 'dense-urban', 'phase6h:dense:10:false'),
      expected: false,
    },
    {
      label: 'suburban deterministic LOS',
      actual: sampleLosStateTr38811(45, 'suburban', 'phase6h:suburban:45:true'),
      expected: true,
    },
    {
      label: 'rural deterministic LOS',
      actual: sampleLosStateTr38811(88, 'rural', 'phase6h:rural:88:true'),
      expected: true,
    },
  ];

  for (const fixture of stateFixtures) {
    assert.equal(fixture.actual, fixture.expected, fixture.label);
  }
}

function assertDopplerFixtures(): void {
  const fixtures = [
    {
      label: 'doppler S-band approaching',
      actual: computeDopplerShiftHz(7.5, 2),
      expected: 50034.61427972281,
    },
    {
      label: 'doppler Ka-band receding',
      actual: computeDopplerShiftHz(-3.2, 28),
      expected: -298873.4292975443,
    },
    {
      label: 'radial velocity low elevation approaching',
      actual: estimateRadialVelocityKmS(7.56, 10, true),
      expected: 7.445146612772292,
    },
    {
      label: 'radial velocity high elevation receding',
      actual: estimateRadialVelocityKmS(7.56, 65, false),
      expected: -3.1949940587596877,
    },
    {
      label: 'radial velocity zenith',
      actual: estimateRadialVelocityKmS(7.56, 90, true),
      expected: 4.629164900776995e-16,
    },
    {
      label: 'doppler degradation zero',
      actual: dopplerSinrDegradationDb(0, 30),
      expected: 0,
    },
    {
      label: 'doppler degradation small ICI',
      actual: dopplerSinrDegradationDb(1200, 30),
      expected: 0.022920723214684163,
    },
    {
      label: 'doppler degradation cap',
      actual: dopplerSinrDegradationDb(24000, 30),
      expected: 30,
    },
  ];

  for (const fixture of fixtures) {
    assertApproxEqual(fixture.actual, fixture.expected, 1e-12, fixture.label);
  }
}

function assertRuntimeNotAdopted(): void {
  const blockedPatterns = [
    /\b@\/core\/channel\/small-scale-fading\b/,
    /\bsrc\/core\/channel\/small-scale-fading\b/,
    /\bcore\/channel\/small-scale-fading\b/,
    /\.\.\/(?:\.\.\/)*core\/channel\/small-scale-fading\b/,
    /\b@\/core\/channel\/los-probability\b/,
    /\bsrc\/core\/channel\/los-probability\b/,
    /\bcore\/channel\/los-probability\b/,
    /\.\.\/(?:\.\.\/)*core\/channel\/los-probability\b/,
    /\b@\/core\/channel\/doppler\b/,
    /\bsrc\/core\/channel\/doppler\b/,
    /\bcore\/channel\/doppler\b/,
    /\.\.\/(?:\.\.\/)*core\/channel\/doppler\b/,
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
    `Phase 6H pure-channel helpers were adopted by runtime/UI/MODQN surfaces:\n${leaks.join('\n')}`,
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
    packageJson.scripts?.['validate:modqn:phase6h-pure-channel-remainder-vendor'],
    'node --import tsx/esm scripts/validate-modqn-phase6h-pure-channel-remainder-vendor.ts',
    'package.json is missing the Phase 6H validator script',
  );
}

function run(): void {
  assertVendorCopyIntegrity();
  assertImportSurfaceAndKillSwitch();
  assertSmallScaleFadingFixtures();
  assertLosProbabilityFixtures();
  assertDopplerFixtures();
  assertRuntimeNotAdopted();
  assertClaimBoundaryText();
  assertPackageScript();

  console.log('MODQN Phase 6H pure-channel remainder vendor validation passed.');
  console.log(JSON.stringify({
    copiedSource: {
      sourceCommit: SOURCE_COMMIT,
      files: COPIED_FILES.map(file => ({
        sourcePath: file.sourcePath,
        destinationPath: file.destinationPath,
        sha256: file.sha256,
        normalization: 'exact copy',
      })),
    },
    importSurface: Object.fromEntries(COPIED_FILES.map(file => [file.destinationPath, file.allowedImports])),
    deterministicFixtures: [
      'sampleShadowedRicianDb fixed RNG fixtures passed',
      'sampleLooDb fixed RNG fixtures passed',
      'getLosProbabilityTr38811 fixtures passed',
      'sampleLosStateTr38811 seed-key fixtures passed',
      'computeDopplerShiftHz fixtures passed',
      'estimateRadialVelocityKmS fixtures passed',
      'dopplerSinrDegradationDb fixtures passed',
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
