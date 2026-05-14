import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateHexagonalBeamLayout } from '../src/core/beam/layout.ts';
import {
  expectedCoChannelCount,
  getCoChannelBeams,
} from '../src/core/beam/frequency-reuse.ts';
import {
  MODQN_BEAM_COUNT_CLAIM_LABELS,
  getModqnBeamCountBridgeClaim,
} from '../src/modqn/replay-bundle/index.ts';

type SupportedBeamCount = 7 | 19 | 37;
type SupportedFrf = 1 | 3 | 7;

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_COMMIT = '54b44159084fca606afc90ad104b1ddbf23844fc';
const SOURCE_PATH = '/home/u24/papers/ntn-sim-core/src/core/beam/frequency-reuse.ts';
const DESTINATION_PATH = 'src/core/beam/frequency-reuse.ts';
const COPIED_SOURCE_SHA256 = '45c1f4e3d94e28d1acacfe4c9c17c0f1b6beb1cbbf1d3bff7a8b39099c841feb';
const SUPPORTED_BEAM_COUNTS = [7, 19, 37] as const satisfies readonly SupportedBeamCount[];
const SUPPORTED_FRFS = [1, 3, 7] as const satisfies readonly SupportedFrf[];
const BEAM_DIAMETER_KM = 42.5;
const ALTITUDE_KM = 550;

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
  'scripts/validate-modqn-phase2-identity-adapter.ts',
  'scripts/validate-modqn-phase3b-beam-layout.ts',
  'scripts/validate-modqn-phase4b-beam-layout-bridge.ts',
  'scripts/validate-modqn-phase5a-runtime-beam-layout.ts',
  'scripts/validate-modqn-phase5b-visual-reuse-metadata.ts',
  'scripts/validate-modqn-phase5c-frequency-diagnostics.ts',
  'scripts/validate-modqn-phase5d-frequency-diagnostics-browser.mjs',
  'scripts/validate-modqn-phase6b-frequency-reuse-vendor.ts',
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

function assertNumericIndexOrdered(values: readonly number[], label: string): void {
  const sorted = [...values].sort((a, b) => a - b);
  assert.deepEqual(values, sorted, `${label} is not deterministic numeric-index ordered`);
  assert.equal(new Set(values).size, values.length, `${label} contains duplicate indices`);
}

function assertVendoredFileIntegrity(): void {
  const text = readRepoFile(DESTINATION_PATH);
  assert.equal(
    sha256RepoFile(DESTINATION_PATH),
    COPIED_SOURCE_SHA256,
    'vendored frequency-reuse.ts no longer matches the copied source hash',
  );
  for (const [lineIndex, line] of text.split(/\r?\n/).entries()) {
    assert.equal(/^\s*import\s/.test(line), false, `${DESTINATION_PATH}:${lineIndex + 1} gained an import`);
  }
}

function assertCoChannelSemantics(numBeams: SupportedBeamCount, frf: SupportedFrf): {
  actualCountRange: [number, number];
  helperHeuristic: number;
  reuseGroupCounts: Record<number, number>;
} {
  const layout = generateHexagonalBeamLayout({
    satId: `phase6b-${numBeams}-frf${frf}`,
    numBeams,
    beamDiameterKm: BEAM_DIAMETER_KM,
    altitudeKm: ALTITUDE_KM,
    frf,
  });
  const reuseGroups = layout.beams.map(beam => beam.reuseGroup);
  const reuseGroupCounts: Record<number, number> = {};
  const actualCounts: number[] = [];

  assert.equal(layout.beams.length, numBeams, `${numBeams}/FRF${frf} layout count drifted`);
  for (const [index, beam] of layout.beams.entries()) {
    assert.equal(beam.beamId, `phase6b-${numBeams}-frf${frf}-b${index}`, `${numBeams}/FRF${frf} beam order drifted`);
    assert.equal(Number.isInteger(beam.reuseGroup), true, `${beam.beamId} reuseGroup is not an integer`);
    assert.ok(beam.reuseGroup >= 0 && beam.reuseGroup < frf, `${beam.beamId} reuseGroup outside FRF range`);
    reuseGroupCounts[beam.reuseGroup] = (reuseGroupCounts[beam.reuseGroup] ?? 0) + 1;
  }

  for (let servingBeamIndex = 0; servingBeamIndex < numBeams; servingBeamIndex += 1) {
    const coChannel = getCoChannelBeams(servingBeamIndex, numBeams, frf, reuseGroups);
    const repeat = getCoChannelBeams(servingBeamIndex, numBeams, frf, reuseGroups);
    const servingGroup = reuseGroups[servingBeamIndex];
    const expected = reuseGroups
      .map((reuseGroup, index) => ({ reuseGroup, index }))
      .filter(entry => entry.index !== servingBeamIndex && entry.reuseGroup === servingGroup)
      .map(entry => entry.index);
    const label = `${numBeams}/FRF${frf}/serving${servingBeamIndex}`;

    assert.deepEqual(coChannel, repeat, `${label} co-channel set is not deterministic`);
    assert.deepEqual(coChannel, expected, `${label} co-channel set does not match same reuseGroup semantics`);
    assertNumericIndexOrdered(coChannel, `${label} co-channel set`);
    assert.equal(coChannel.includes(servingBeamIndex), false, `${label} includes the serving beam`);

    for (const candidateIndex of coChannel) {
      assert.equal(Number.isInteger(candidateIndex), true, `${label} emitted a non-integer candidate`);
      assert.ok(candidateIndex >= 0 && candidateIndex < numBeams, `${label} emitted out-of-range candidate ${candidateIndex}`);
      assert.equal(
        reuseGroups[candidateIndex],
        servingGroup,
        `${label} emitted a beam outside serving reuseGroup ${servingGroup}`,
      );
    }

    actualCounts.push(coChannel.length);
  }

  const helperHeuristic = expectedCoChannelCount(numBeams, frf);
  const minActual = Math.min(...actualCounts);
  const maxActual = Math.max(...actualCounts);

  assert.equal(Number.isInteger(helperHeuristic), true, `${numBeams}/FRF${frf} helper count is not an integer`);
  assert.ok(helperHeuristic >= 0 && helperHeuristic < numBeams, `${numBeams}/FRF${frf} helper count is outside range`);

  if (frf === 1) {
    assert.equal(minActual, numBeams - 1, `${numBeams}/FRF1 min co-channel count drifted`);
    assert.equal(maxActual, numBeams - 1, `${numBeams}/FRF1 max co-channel count drifted`);
    assert.equal(helperHeuristic, numBeams - 1, `${numBeams}/FRF1 helper should be exact`);
  } else {
    assert.ok(
      helperHeuristic >= minActual && helperHeuristic <= maxActual,
      `${numBeams}/FRF${frf} helper heuristic fell outside actual uneven group-size range`,
    );
  }

  return {
    actualCountRange: [minActual, maxActual],
    helperHeuristic,
    reuseGroupCounts,
  };
}

function assertAllFrequencyReuseSemantics(): Record<string, {
  actualCountRange: [number, number];
  helperHeuristic: number;
  reuseGroupCounts: Record<number, number>;
}> {
  const summary: Record<string, {
    actualCountRange: [number, number];
    helperHeuristic: number;
    reuseGroupCounts: Record<number, number>;
  }> = {};

  for (const numBeams of SUPPORTED_BEAM_COUNTS) {
    for (const frf of SUPPORTED_FRFS) {
      summary[`${numBeams}/FRF${frf}`] = assertCoChannelSemantics(numBeams, frf);
    }
  }

  assert.equal(expectedCoChannelCount(19, 0), 0, 'helper no longer guards non-positive FRF');
  return summary;
}

function assertRuntimeNotAdopted(): void {
  const blockedPatterns = [
    /\bsrc\/core\/beam\/frequency-reuse\b/,
    /\bcore\/beam\/frequency-reuse\b/,
    /\bfrequency-reuse\.ts\b/,
    /\bgetCoChannelBeams\b/,
    /\bexpectedCoChannelCount\b/,
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
    `frequency-reuse helper was adopted by signal/handover/runtime surfaces:\n${leaks.join('\n')}`,
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
    packageJson.scripts?.['validate:modqn:phase6b-frequency-reuse-vendor'],
    'node --import tsx/esm scripts/validate-modqn-phase6b-frequency-reuse-vendor.ts',
    'package.json lost the Phase 6B validator script',
  );
}

function run(): void {
  assertVendoredFileIntegrity();
  const coChannelSummary = assertAllFrequencyReuseSemantics();
  assertRuntimeNotAdopted();
  assertClaimBoundaryText();
  assertPackageScript();

  console.log('MODQN Phase 6B frequency reuse vendor validation passed.');
  console.log(JSON.stringify({
    copiedSource: {
      sourceCommit: SOURCE_COMMIT,
      sourcePath: SOURCE_PATH,
      destinationPath: DESTINATION_PATH,
      sha256: COPIED_SOURCE_SHA256,
    },
    beamCounts: SUPPORTED_BEAM_COUNTS,
    frfs: SUPPORTED_FRFS,
    coChannelSummary,
    expectedCoChannelCountUse: 'helper heuristic only for FRF 3/7 uneven hex group sizes',
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
