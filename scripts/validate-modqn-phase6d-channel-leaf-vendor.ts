import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeFspl } from '../src/core/channel/fspl.ts';
import { computeSinr } from '../src/core/channel/sinr.ts';
import {
  MODQN_BEAM_COUNT_CLAIM_LABELS,
  getModqnBeamCountBridgeClaim,
} from '../src/modqn/replay-bundle/index.ts';

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_COMMIT = '54b44159084fca606afc90ad104b1ddbf23844fc';

const COPIED_FILES = [
  {
    sourcePath: '/home/u24/papers/ntn-sim-core/src/core/channel/types.ts',
    destinationPath: 'src/core/channel/types.ts',
    sha256: '6b6faa287c5affe9f35342da64e536e95658f13db7323fde0213c3b810ee4e84',
    allowedImports: [],
  },
  {
    sourcePath: '/home/u24/papers/ntn-sim-core/src/core/channel/sinr.ts',
    destinationPath: 'src/core/channel/sinr.ts',
    sha256: 'b344fa62c9161b041acabf47145eff615cf4ba1678a7d7740126c41eb357788d',
    allowedImports: ['./types'],
  },
  {
    sourcePath: '/home/u24/papers/ntn-sim-core/src/core/channel/fspl.ts',
    destinationPath: 'src/core/channel/fspl.ts',
    sha256: '5bf7c1089d560be9dcfbcb2901fc57c9090b1af27ffef9cb3e4d082d0bbf2da1',
    allowedImports: [],
  },
] as const;

const RUNTIME_NON_ADOPTION_SCAN_PATHS = [
  'src/engine/signal',
  'src/engine/handover',
  'src/scene/useSimulation.ts',
  'src/profiles',
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
  'scripts/validate-modqn-phase2-identity-adapter.ts',
  'scripts/validate-modqn-phase3b-beam-layout.ts',
  'scripts/validate-modqn-phase4b-beam-layout-bridge.ts',
  'scripts/validate-modqn-phase5a-runtime-beam-layout.ts',
  'scripts/validate-modqn-phase5b-visual-reuse-metadata.ts',
  'scripts/validate-modqn-phase5c-frequency-diagnostics.ts',
  'scripts/validate-modqn-phase5d-frequency-diagnostics-browser.mjs',
  'scripts/validate-modqn-phase6b-frequency-reuse-vendor.ts',
  'scripts/validate-modqn-phase6d-channel-leaf-vendor.ts',
] as const;

function readRepoFile(relativePath: string): string {
  return readFileSync(join(ROOT_DIR, relativePath), 'utf8');
}

function sha256RepoFile(relativePath: string): string {
  return createHash('sha256').update(readRepoFile(relativePath)).digest('hex');
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

function dbmToMilliwatts(dbm: number): number {
  if (Number.isNaN(dbm) || !Number.isFinite(dbm)) return 0;
  if (dbm < -300) return 0;
  if (dbm > 100) return 10 ** 10;
  return 10 ** (dbm / 10);
}

function milliwattsToDbm(milliwatts: number): number {
  if (Number.isNaN(milliwatts) || !Number.isFinite(milliwatts) || milliwatts <= 1e-30) return -300;
  return 10 * Math.log10(milliwatts);
}

function expectedFsplDb(distanceKm: number, frequencyGhz: number): number {
  return 32.45 + (20 * Math.log10(frequencyGhz * 1000)) + (20 * Math.log10(distanceKm));
}

function expectedSinr(opts: {
  associationActive?: boolean;
  servingRxPowerDbm: number;
  noisePowerDbm: number;
  intraInterferingRxPowersDbm?: readonly number[];
  interInterferingRxPowersDbm?: readonly number[];
}): {
  signalDbm: number;
  interferenceDbm: number;
  noiseDbm: number;
  sinrDb: number;
} {
  const associationActive = opts.associationActive ?? true;
  const signalLinear = associationActive ? dbmToMilliwatts(opts.servingRxPowerDbm) : 0;
  const noiseLinear = dbmToMilliwatts(opts.noisePowerDbm);
  const intraInterferenceLinear = (opts.intraInterferingRxPowersDbm ?? [])
    .reduce((sum, value) => sum + dbmToMilliwatts(value), 0);
  const interInterferenceLinear = (opts.interInterferingRxPowersDbm ?? [])
    .reduce((sum, value) => sum + dbmToMilliwatts(value), 0);
  const interferenceLinear = intraInterferenceLinear + interInterferenceLinear;
  const denominator = interferenceLinear + noiseLinear;
  const sinrLinear = denominator > 0 ? signalLinear / denominator : 0;
  const sinrDb = sinrLinear > 1e-20 ? 10 * Math.log10(sinrLinear) : -100;

  return {
    signalDbm: opts.servingRxPowerDbm,
    interferenceDbm: milliwattsToDbm(interferenceLinear),
    noiseDbm: opts.noisePowerDbm,
    sinrDb: Number.isNaN(sinrDb) ? -100 : sinrDb,
  };
}

function assertVendoredFileIntegrityAndPurity(): void {
  const forbiddenImportSources = /^(react|react-dom|three|@react-three)(\/|$)|(^|\/)(viz|app|scene)(\/|$)/;
  const forbiddenBrowserApis = /\b(window|document|navigator|localStorage|sessionStorage|fetch|HTMLCanvasElement|CanvasRenderingContext2D|WebGLRenderingContext|WebGL2RenderingContext)\b/;

  for (const copiedFile of COPIED_FILES) {
    const text = readRepoFile(copiedFile.destinationPath);
    assert.equal(
      sha256RepoFile(copiedFile.destinationPath),
      copiedFile.sha256,
      `${copiedFile.destinationPath} no longer matches the copied source SHA-256`,
    );

    const importSources = extractImportSources(text);
    assert.deepEqual(
      importSources,
      copiedFile.allowedImports,
      `${copiedFile.destinationPath} import surface drifted from the leaf-only contract`,
    );
    for (const importSource of importSources) {
      assert.equal(
        forbiddenImportSources.test(importSource),
        false,
        `${copiedFile.destinationPath} imports forbidden runtime/UI source ${importSource}`,
      );
    }

    const codeOnly = stripComments(text);
    assert.equal(
      forbiddenBrowserApis.test(codeOnly),
      false,
      `${copiedFile.destinationPath} references a browser API in executable code`,
    );
  }
}

function assertFsplFixtures(): void {
  const fixtures = [
    { distanceKm: 1, frequencyGhz: 1 },
    { distanceKm: 550, frequencyGhz: 28 },
    { distanceKm: 1932.2566, frequencyGhz: 2 },
    { distanceKm: 1200.5, frequencyGhz: 20 },
  ];

  for (const fixture of fixtures) {
    assertApproxEqual(
      computeFspl(fixture.distanceKm, fixture.frequencyGhz),
      expectedFsplDb(fixture.distanceKm, fixture.frequencyGhz),
      1e-12,
      `computeFspl(${fixture.distanceKm}, ${fixture.frequencyGhz})`,
    );
  }
}

function assertSinrFixtures(): void {
  const fixtures = [
    {
      label: 'noise-limited serving link',
      opts: {
        servingRxPowerDbm: -80,
        noisePowerDbm: -100,
      },
    },
    {
      label: 'intra and inter interference combiner',
      opts: {
        servingRxPowerDbm: -82.5,
        noisePowerDbm: -101.2,
        intraInterferingRxPowersDbm: [-95.5, -97],
        interInterferingRxPowersDbm: [-102.25],
      },
    },
    {
      label: 'inactive association clamp',
      opts: {
        associationActive: false,
        servingRxPowerDbm: -79,
        noisePowerDbm: -103,
        intraInterferingRxPowersDbm: [-91],
        interInterferingRxPowersDbm: [-93],
      },
    },
    {
      label: 'extremely weak interferer floor',
      opts: {
        servingRxPowerDbm: -89,
        noisePowerDbm: -108,
        intraInterferingRxPowersDbm: [-350],
        interInterferingRxPowersDbm: [],
      },
    },
  ];

  for (const fixture of fixtures) {
    const actual = computeSinr(fixture.opts);
    const expected = expectedSinr(fixture.opts);
    assertApproxEqual(actual.signalDbm, expected.signalDbm, 1e-12, `${fixture.label} signalDbm`);
    assertApproxEqual(actual.interferenceDbm, expected.interferenceDbm, 1e-12, `${fixture.label} interferenceDbm`);
    assertApproxEqual(actual.noiseDbm, expected.noiseDbm, 1e-12, `${fixture.label} noiseDbm`);
    assertApproxEqual(actual.sinrDb, expected.sinrDb, 1e-12, `${fixture.label} sinrDb`);
  }
}

function assertRuntimeNotAdopted(): void {
  const blockedPatterns = [
    /\bsrc\/core\/channel\b/,
    /\bcore\/channel\b/,
    /\bchannel\/fspl\b/,
    /\bchannel\/sinr\b/,
    /\bchannel\/types\b/,
    /\bcomputeFspl\b/,
    /\bcomputeSinr\b/,
  ];
  const scannedFiles = RUNTIME_NON_ADOPTION_SCAN_PATHS
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
    `channel leaf helpers were adopted by signal/handover/runtime surfaces:\n${leaks.join('\n')}`,
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
    packageJson.scripts?.['validate:modqn:phase6d-channel-leaf-vendor'],
    'node --import tsx/esm scripts/validate-modqn-phase6d-channel-leaf-vendor.ts',
    'package.json lost the Phase 6D validator script',
  );
}

function run(): void {
  assertVendoredFileIntegrityAndPurity();
  assertFsplFixtures();
  assertSinrFixtures();
  assertRuntimeNotAdopted();
  assertClaimBoundaryText();
  assertPackageScript();

  console.log('MODQN Phase 6D channel leaf vendor validation passed.');
  console.log(JSON.stringify({
    copiedSource: {
      sourceCommit: SOURCE_COMMIT,
      files: COPIED_FILES.map(({ sourcePath, destinationPath, sha256, allowedImports }) => ({
        sourcePath,
        destinationPath,
        sha256,
        allowedImports,
      })),
    },
    mathFixtures: {
      fspl: 'independent FSPL formula fixtures passed',
      sinr: 'independent linear-power SINR fixtures passed',
    },
    runtimeAdoption: 'not adopted',
    scannedForRuntimeAdoption: RUNTIME_NON_ADOPTION_SCAN_PATHS,
    claimBoundary: {
      7: MODQN_BEAM_COUNT_CLAIM_LABELS[7],
      19: MODQN_BEAM_COUNT_CLAIM_LABELS[19],
      37: MODQN_BEAM_COUNT_CLAIM_LABELS[37],
    },
    result: 'PASS',
  }, null, 2));
}

run();
