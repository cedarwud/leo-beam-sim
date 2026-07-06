import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  computeBeamGain,
  computeOffAxisAngle,
} from '../src/core/channel/beam-gain.ts';
import {
  MODQN_BEAM_COUNT_CLAIM_LABELS,
  getModqnBeamCountBridgeClaim,
} from '../src/modqn/replay-bundle/index.ts';
import { skipIfDataUnavailable } from './lib/ci-data-guard.ts';

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_COMMIT = '54b44159084fca606afc90ad104b1ddbf23844fc';
const SOURCE_CONSTANTS_PATH = '/home/u24/papers/ntn-sim-core/src/core/common/constants.ts';
const SOURCE_BEAM_GAIN_PATH = '/home/u24/papers/ntn-sim-core/src/core/channel/beam-gain.ts';
const DESTINATION_CONSTANTS_PATH = 'src/core/common/constants.ts';
const DESTINATION_BEAM_GAIN_PATH = 'src/core/channel/beam-gain.ts';

// CI-environment guard (P2 SN-3c): the vendor-integrity re-hash reads the frozen
// ntn-sim-core source files in the read-only sibling checkout. Skip (visibly,
// exit 0 + marker) when that checkout is absent — the hosted-CI signature. See
// scripts/lib/ci-data-guard.ts for the SKIP semantics.
skipIfDataUnavailable([
  { path: SOURCE_CONSTANTS_PATH, why: 'ntn-sim-core vendor source for the constants.ts integrity re-hash (sibling checkout required)' },
  { path: SOURCE_BEAM_GAIN_PATH, why: 'ntn-sim-core vendor source for the beam-gain.ts integrity re-hash (sibling checkout required)' },
]);

const SOURCE_CONSTANTS_SHA256 = '4054c6e70979539843f3216ef5e31e6876715b40464fee2d7332ddaaa0f0ab7a';
const SOURCE_BEAM_GAIN_SHA256 = '359f2d34c67755f9f77885ea64da817c7b3caad282305994c56094a768129813';
const NORMALIZED_BEAM_GAIN_SHA256 = '66e789421dca47852e583ea960464cfa81ba0f7486d23cadd850654970fbeb98';
const NORMALIZED_BEAM_GAIN_LINE = 123;
const SOURCE_TRAILING_SPACE_LINE = '    return -reduction; ';
const DESTINATION_NORMALIZED_LINE = '    return -reduction;';

const NON_ADOPTION_SCAN_PATHS = [
  'src/engine/signal',
  'src/engine/handover',
  'src/engine/association',
  'src/scene/useSimulation.ts',
  'src/profiles',
  'src/ui',
  'src/modqn',
] as const;

const CLAIM_SCAN_PATHS = [
  'docs/modqn-baseline-live-integration-mini-sdd.md',
  'docs/modqn-baseline-phase1-evidence-lock.md',
  'docs/modqn-baseline-phase2-identity-adapter.md',
  'docs/modqn-baseline-phase3a-beam-vendor-readiness.md',
  'docs/modqn-baseline-phase3b-beam-layout-vendor.md',
  'docs/modqn-baseline-phase4a-runtime-adoption-contract.md',
  'docs/modqn-baseline-phase4b-beam-layout-bridge.md',
  'docs/modqn-baseline-phase5a-runtime-beam-layout.md',
  'docs/modqn-baseline-phase5b-visual-reuse-metadata.md',
  'docs/modqn-baseline-phase5c-frequency-diagnostics.md',
  'docs/modqn-baseline-phase5d-frequency-diagnostics-browser.md',
  'docs/modqn-baseline-phase6a-signal-handover-reuse-readiness.md',
  'docs/modqn-baseline-phase6b-frequency-reuse-vendor.md',
  'docs/modqn-baseline-phase6c-channel-sinr-vendor-readiness.md',
  'docs/modqn-baseline-phase6d-channel-leaf-vendor.md',
  'docs/modqn-baseline-phase6e-beam-gain-vendor-readiness.md',
  'docs/modqn-baseline-phase6f-beam-gain-vendor.md',
  'scripts/validate-modqn-phase2-identity-adapter.ts',
  'scripts/validate-modqn-phase3b-beam-layout.ts',
  'scripts/validate-modqn-phase4b-beam-layout-bridge.ts',
  'scripts/validate-modqn-phase5a-runtime-beam-layout.ts',
  'scripts/validate-modqn-phase5b-visual-reuse-metadata.ts',
  'scripts/validate-modqn-phase5c-frequency-diagnostics.ts',
  'scripts/validate-modqn-phase5d-frequency-diagnostics-browser.mjs',
  'scripts/validate-modqn-phase6b-frequency-reuse-vendor.ts',
  'scripts/validate-modqn-phase6d-channel-leaf-vendor.ts',
  'scripts/validate-modqn-phase6f-beam-gain-vendor.ts',
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

function assertVendorCopyIntegrity(): void {
  const sourceConstants = readFileSync(SOURCE_CONSTANTS_PATH, 'utf8');
  const sourceBeamGain = readFileSync(SOURCE_BEAM_GAIN_PATH, 'utf8');
  const destinationConstants = readRepoFile(DESTINATION_CONSTANTS_PATH);
  const destinationBeamGain = readRepoFile(DESTINATION_BEAM_GAIN_PATH);

  assert.equal(sha256Text(sourceConstants), SOURCE_CONSTANTS_SHA256, 'source constants.ts hash drifted');
  assert.equal(sha256Text(sourceBeamGain), SOURCE_BEAM_GAIN_SHA256, 'source beam-gain.ts hash drifted');
  assert.equal(
    sha256RepoFile(DESTINATION_CONSTANTS_PATH),
    SOURCE_CONSTANTS_SHA256,
    'destination constants.ts no longer matches source constants.ts',
  );
  assert.equal(
    destinationConstants,
    sourceConstants,
    'destination constants.ts is not an exact source copy',
  );
  assert.equal(
    sha256RepoFile(DESTINATION_BEAM_GAIN_PATH),
    NORMALIZED_BEAM_GAIN_SHA256,
    'destination beam-gain.ts normalized hash drifted',
  );

  const sourceLines = sourceBeamGain.split('\n');
  const destinationLines = destinationBeamGain.split('\n');
  assert.equal(
    sourceLines[NORMALIZED_BEAM_GAIN_LINE - 1],
    SOURCE_TRAILING_SPACE_LINE,
    'source beam-gain.ts no longer has the expected line-123 trailing space',
  );
  assert.equal(
    destinationLines[NORMALIZED_BEAM_GAIN_LINE - 1],
    DESTINATION_NORMALIZED_LINE,
    'destination beam-gain.ts did not normalize the expected line',
  );

  const normalizedSourceLines = [...sourceLines];
  normalizedSourceLines[NORMALIZED_BEAM_GAIN_LINE - 1] = DESTINATION_NORMALIZED_LINE;
  assert.equal(
    destinationBeamGain,
    normalizedSourceLines.join('\n'),
    'destination beam-gain.ts differs from source by more than the documented trailing-space normalization',
  );
}

function assertImportSurfaceAndKillSwitch(): void {
  const files = [
    {
      label: DESTINATION_CONSTANTS_PATH,
      text: readRepoFile(DESTINATION_CONSTANTS_PATH),
      allowedImports: [] as string[],
    },
    {
      label: DESTINATION_BEAM_GAIN_PATH,
      text: readRepoFile(DESTINATION_BEAM_GAIN_PATH),
      allowedImports: ['@/core/common/constants', './types'],
    },
    {
      label: 'src/core/channel/types.ts',
      text: readRepoFile('src/core/channel/types.ts'),
      allowedImports: [] as string[],
    },
  ];
  const forbiddenImportSources = /^(react|react-dom|three|@react-three)(\/|$)|(^|\/)(viz|app|scene)(\/|$)/;
  const forbiddenBrowserApis = /\b(window|document|navigator|localStorage|sessionStorage|fetch|HTMLCanvasElement|CanvasRenderingContext2D|WebGLRenderingContext|WebGL2RenderingContext)\b/;

  for (const file of files) {
    const imports = extractImportSources(file.text);
    assert.deepEqual(imports, file.allowedImports, `${file.label} import surface drifted`);
    for (const importSource of imports) {
      assert.equal(
        forbiddenImportSources.test(importSource),
        false,
        `${file.label} imports forbidden runtime/UI source ${importSource}`,
      );
    }
    assert.equal(
      forbiddenBrowserApis.test(stripComments(file.text)),
      false,
      `${file.label} references a browser API in executable code`,
    );
  }
}

function assertBeamGainFixtures(): void {
  const fixtures = [
    {
      label: 'flat-debug',
      input: {
        offAxisAngleDeg: 7.25,
        model: 'flat-debug' as const,
        peakGainDbi: 31.7,
        beamDiameterKm: 50,
        altitudeKm: 600,
      },
      expected: 31.7,
    },
    {
      label: 'rpsat-3gpp quadratic side-lobe reduction',
      input: {
        offAxisAngleDeg: 1.2,
        model: 'rpsat-3gpp' as const,
        peakGainDbi: 30,
        beamDiameterKm: 50,
        altitudeKm: 600,
        slantRangeKm: 900,
      },
      expected: -6.825379484043937,
    },
    {
      label: 'itu-r side-lobe cap',
      input: {
        offAxisAngleDeg: 12,
        model: 'itu-r' as const,
        peakGainDbi: 30,
        beamDiameterKm: 42.5,
        altitudeKm: 550,
        slantRangeKm: 1932.2566,
      },
      expected: -30,
    },
    {
      label: 'bessel-j1',
      input: {
        offAxisAngleDeg: 1.75,
        model: 'bessel-j1' as const,
        peakGainDbi: 30,
        beamDiameterKm: 50,
        altitudeKm: 600,
        slantRangeKm: 880,
      },
      expected: -24.152586419924724,
    },
    {
      label: 'bessel-j1j3',
      input: {
        offAxisAngleDeg: 2.4,
        model: 'bessel-j1j3' as const,
        peakGainDbi: 30,
        beamDiameterKm: 50,
        altitudeKm: 600,
        slantRangeKm: 880,
      },
      expected: -5.256852599395714,
    },
  ];

  for (const fixture of fixtures) {
    assertApproxEqual(
      computeBeamGain(fixture.input),
      fixture.expected,
      1e-12,
      `computeBeamGain ${fixture.label}`,
    );
  }
}

function assertOffAxisFixtures(): void {
  // Tuple annotation keeps the per-fixture `as const` args spreadable: a union
  // of readonly tuples is not itself a tuple type for spread-call purposes.
  const fixtures: ReadonlyArray<{
    label: string;
    args: readonly [number, number, number, number, number];
    expected: number;
  }> = [
    {
      label: 'boresight',
      args: [0, 0, 0, 0, 550] as const,
      expected: 0,
    },
    {
      label: 'equatorial diagonal offset',
      args: [0, 0, 0.25, 0.5, 550] as const,
      expected: 6.451602261001425,
    },
    {
      label: 'tokyo-neighborhood offset',
      args: [35, 139, 35.1, 139.2, 600] as const,
      expected: 2.0384551083825824,
    },
    {
      label: 'southern-hemisphere offset',
      args: [-12.5, 130.25, -12.25, 130.75, 1200] as const,
      expected: 2.9128729998439513,
    },
    {
      label: 'nan guard',
      args: [Number.NaN, 0, 1, 1, 550] as const,
      expected: 0,
    },
  ];

  for (const fixture of fixtures) {
    assertApproxEqual(
      computeOffAxisAngle(...fixture.args),
      fixture.expected,
      1e-12,
      `computeOffAxisAngle ${fixture.label}`,
    );
  }
}

function assertRuntimeNotAdopted(): void {
  const blockedPatterns = [
    /\b@\/core\/channel\/beam-gain\b/,
    /\bsrc\/core\/channel\/beam-gain\b/,
    /\bcore\/channel\/beam-gain\b/,
    /\b@\/core\/common\/constants\b/,
    /\bsrc\/core\/common\/constants\b/,
    /\bcore\/common\/constants\b/,
    /\bcomputeBeamGain\b/,
    /\bcomputeOffAxisAngle\b/,
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
    `beam-gain/common constants were adopted by runtime/UI/MODQN surfaces:\n${leaks.join('\n')}`,
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
  for (const relativePath of CLAIM_SCAN_PATHS) {
    const fullPath = join(ROOT_DIR, relativePath);
    if (!existsSync(fullPath)) continue;
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
    packageJson.scripts?.['validate:modqn:phase6f-beam-gain-vendor'],
    'node --import tsx/esm scripts/validate-modqn-phase6f-beam-gain-vendor.ts',
    'package.json is missing the Phase 6F validator script',
  );
}

function run(): void {
  assertVendorCopyIntegrity();
  assertImportSurfaceAndKillSwitch();
  assertBeamGainFixtures();
  assertOffAxisFixtures();
  assertRuntimeNotAdopted();
  assertClaimBoundaryText();
  assertPackageScript();

  console.log('MODQN Phase 6F beam-gain vendor validation passed.');
  console.log(JSON.stringify({
    copiedSource: {
      sourceCommit: SOURCE_COMMIT,
      files: [
        {
          sourcePath: SOURCE_CONSTANTS_PATH,
          destinationPath: DESTINATION_CONSTANTS_PATH,
          sourceSha256: SOURCE_CONSTANTS_SHA256,
          destinationSha256: SOURCE_CONSTANTS_SHA256,
          normalization: 'exact copy',
        },
        {
          sourcePath: SOURCE_BEAM_GAIN_PATH,
          destinationPath: DESTINATION_BEAM_GAIN_PATH,
          sourceSha256: SOURCE_BEAM_GAIN_SHA256,
          destinationSha256: NORMALIZED_BEAM_GAIN_SHA256,
          normalization: 'removed only the trailing space from line 123: `return -reduction; ` -> `return -reduction;`',
        },
      ],
    },
    importSurface: {
      [DESTINATION_CONSTANTS_PATH]: [],
      [DESTINATION_BEAM_GAIN_PATH]: ['@/core/common/constants', './types'],
    },
    mathFixtures: {
      computeBeamGain: 'flat-debug, rpsat-3gpp, itu-r, bessel-j1, and bessel-j1j3 fixtures passed',
      computeOffAxisAngle: 'deterministic off-axis fixtures passed',
    },
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
