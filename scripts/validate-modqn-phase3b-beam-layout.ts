import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateHexagonalBeamLayout } from '../src/core/beam/layout.ts';
import { MODQN_BEAM_COUNT_CLAIM_LABELS } from '../src/modqn/replay-bundle/index.ts';

type SupportedBeamCount = 7 | 19 | 37;
type SupportedFrf = 1 | 3 | 7;

const SUPPORTED_BEAM_COUNTS = [7, 19, 37] as const satisfies readonly SupportedBeamCount[];
const SUPPORTED_FRFS = [1, 3, 7] as const satisfies readonly SupportedFrf[];
const BEAM_DIAMETER_KM = 42.5;
const ALTITUDE_KM = 550;
const SAT_ID = 'phase3b-sat';

const EXPECTED_RING_RADIUS = {
  7: 1,
  19: 2,
  37: 3,
} as const satisfies Readonly<Record<SupportedBeamCount, number>>;

const EXPECTED_REUSE_DISTRIBUTIONS = {
  7: {
    3: { 0: 1, 1: 3, 2: 3 },
    7: { 0: 1, 1: 2, 2: 1, 5: 1, 6: 2 },
  },
  19: {
    3: { 0: 7, 1: 6, 2: 6 },
    7: { 0: 3, 1: 2, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2 },
  },
  37: {
    3: { 0: 13, 1: 12, 2: 12 },
    7: { 0: 3, 1: 5, 2: 5, 3: 7, 4: 7, 5: 5, 6: 5 },
  },
} as const satisfies Readonly<
  Record<SupportedBeamCount, Readonly<Record<3 | 7, Readonly<Record<number, number>>>>>
>;

function assertThrows(label: string, action: () => unknown): void {
  assert.throws(action, Error, `${label} should throw`);
}

function countReuseGroups(beams: readonly { reuseGroup: number }[]): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const beam of beams) {
    counts[beam.reuseGroup] = (counts[beam.reuseGroup] ?? 0) + 1;
  }
  return counts;
}

function assertUnique<T>(values: readonly T[], label: string): void {
  const unique = new Set(values);
  assert.equal(unique.size, values.length, `${label} contains duplicates`);
}

function recoverAxialCoordinate(
  offsetEastKm: number,
  offsetNorthKm: number,
  spacingKm: number,
): { q: number; r: number; radius: number } {
  const rawR = offsetNorthKm / (spacingKm * Math.sqrt(3) / 2);
  const rawQ = (offsetEastKm / spacingKm) - (rawR / 2);
  const q = Math.round(rawQ);
  const r = Math.round(rawR);
  const s = -q - r;
  const tolerance = 1e-9;

  assert.ok(Math.abs(rawQ - q) < tolerance, `q coordinate is not integer-like: ${rawQ}`);
  assert.ok(Math.abs(rawR - r) < tolerance, `r coordinate is not integer-like: ${rawR}`);

  return {
    q,
    r,
    radius: Math.max(Math.abs(q), Math.abs(r), Math.abs(s)),
  };
}

function assertRingCompleteLayout(numBeams: SupportedBeamCount): void {
  const layout = generateHexagonalBeamLayout({
    satId: SAT_ID,
    numBeams,
    beamDiameterKm: BEAM_DIAMETER_KM,
    altitudeKm: ALTITUDE_KM,
    frf: 3,
  });
  const spacingKm = BEAM_DIAMETER_KM * Math.sqrt(3) / 2;
  const radiusCounts = new Map<number, number>();

  for (const beam of layout.beams) {
    const { radius } = recoverAxialCoordinate(beam.offsetEastKm, beam.offsetNorthKm, spacingKm);
    radiusCounts.set(radius, (radiusCounts.get(radius) ?? 0) + 1);
  }

  const expectedRadius = EXPECTED_RING_RADIUS[numBeams];
  assert.equal(Math.max(...radiusCounts.keys()), expectedRadius, `${numBeams} max ring radius drifted`);
  assert.equal(radiusCounts.get(0), 1, `${numBeams} center ring count drifted`);

  for (let radius = 1; radius <= expectedRadius; radius += 1) {
    assert.equal(radiusCounts.get(radius), 6 * radius, `${numBeams} ring ${radius} count drifted`);
  }
}

function assertLayoutInvariants(numBeams: SupportedBeamCount, frf: SupportedFrf): void {
  const layout = generateHexagonalBeamLayout({
    satId: SAT_ID,
    numBeams,
    beamDiameterKm: BEAM_DIAMETER_KM,
    altitudeKm: ALTITUDE_KM,
    frf,
  });

  assert.equal(layout.satId, SAT_ID, `${numBeams}/FRF${frf} satId drifted`);
  assert.equal(layout.beams.length, numBeams, `${numBeams}/FRF${frf} beam count drifted`);
  assert.equal(layout.beamDiameterKm, BEAM_DIAMETER_KM, `${numBeams}/FRF${frf} beamDiameterKm drifted`);
  assert.equal(layout.altitudeKm, ALTITUDE_KM, `${numBeams}/FRF${frf} altitudeKm drifted`);

  const beamIds = layout.beams.map(beam => beam.beamId);
  assertUnique(beamIds, `${numBeams}/FRF${frf} beam IDs`);
  for (const [index, beam] of layout.beams.entries()) {
    assert.equal(beam.beamId, `${SAT_ID}-b${index}`, `${numBeams}/FRF${frf} beam order drifted at index ${index}`);
    assert.ok(Number.isFinite(beam.offsetEastKm), `${beam.beamId} offsetEastKm is not finite`);
    assert.ok(Number.isFinite(beam.offsetNorthKm), `${beam.beamId} offsetNorthKm is not finite`);
    assert.equal(beam.isActive, true, `${beam.beamId} isActive default drifted`);
    assert.equal(Number.isInteger(beam.reuseGroup), true, `${beam.beamId} reuseGroup is not an integer`);
    assert.ok(beam.reuseGroup >= 0 && beam.reuseGroup <= frf - 1, `${beam.beamId} reuseGroup outside FRF range`);
  }

  assert.equal(layout.beams[0]?.beamId, `${SAT_ID}-b0`, `${numBeams}/FRF${frf} center beam ID drifted`);
  assert.equal(layout.beams[0]?.offsetEastKm, 0, `${numBeams}/FRF${frf} center east offset drifted`);
  assert.equal(layout.beams[0]?.offsetNorthKm, 0, `${numBeams}/FRF${frf} center north offset drifted`);

  const coordinatePairs = layout.beams.map(beam => `${beam.offsetEastKm.toPrecision(15)},${beam.offsetNorthKm.toPrecision(15)}`);
  assertUnique(coordinatePairs, `${numBeams}/FRF${frf} coordinate pairs`);

  if (numBeams >= 19) {
    assert.equal(beamIds[2], `${SAT_ID}-b2`, `${numBeams}/FRF${frf} IDs appear lexicographically sorted`);
    assert.equal(beamIds[10], `${SAT_ID}-b10`, `${numBeams}/FRF${frf} numeric index order drifted`);
  }

  const reuseDistribution = countReuseGroups(layout.beams);
  if (frf === 1) {
    assert.deepEqual(reuseDistribution, { 0: numBeams }, `${numBeams}/FRF1 distribution drifted`);
  }
  if (frf === 3 || frf === 7) {
    assert.deepEqual(
      reuseDistribution,
      EXPECTED_REUSE_DISTRIBUTIONS[numBeams][frf],
      `${numBeams}/FRF${frf} distribution drifted`,
    );
  }
}

function assertAcceptedInputs(): void {
  for (const frf of SUPPORTED_FRFS) {
    generateHexagonalBeamLayout({
      satId: SAT_ID,
      numBeams: 7,
      beamDiameterKm: BEAM_DIAMETER_KM,
      altitudeKm: ALTITUDE_KM,
      frf,
    });
  }

  for (const frf of [0, 2, 4, 6, 8, Number.NaN]) {
    assertThrows(`FRF ${frf}`, () => generateHexagonalBeamLayout({
      satId: SAT_ID,
      numBeams: 7,
      beamDiameterKm: BEAM_DIAMETER_KM,
      altitudeKm: ALTITUDE_KM,
      frf,
    }));
  }

  for (const numBeams of [0, -1, -37]) {
    assertThrows(`numBeams ${numBeams}`, () => generateHexagonalBeamLayout({
      satId: SAT_ID,
      numBeams,
      beamDiameterKm: BEAM_DIAMETER_KM,
      altitudeKm: ALTITUDE_KM,
      frf: 3,
    }));
  }
}

function assertClaimBoundaryText(): void {
  assert.equal(/baseline/i.test(MODQN_BEAM_COUNT_CLAIM_LABELS[7]), true, '7-beam label lost baseline boundary');
  for (const beamCount of [19, 37] as const) {
    assert.equal(/baseline/i.test(MODQN_BEAM_COUNT_CLAIM_LABELS[beamCount]), false, `${beamCount}-beam label leaked baseline wording`);
    assert.match(MODQN_BEAM_COUNT_CLAIM_LABELS[beamCount], /sensitivity\/demo extension only/);
  }

  const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
  const trainedBaselinePhrase = ['trained', 'baseline', 'MODQN', 'evidence'].join(' ');
  const docsAndValidators = [
    'docs/modqn-baseline-live-integration-mini-sdd.md',
    'docs/modqn-baseline-phase1-evidence-lock.md',
    'docs/modqn-baseline-phase2-identity-adapter.md',
    'docs/modqn-baseline-phase3a-beam-vendor-readiness.md',
    'docs/modqn-baseline-phase3b-beam-layout-vendor.md',
    'scripts/validate-modqn-phase2-identity-adapter.ts',
    'scripts/validate-modqn-phase3b-beam-layout.ts',
  ];

  for (const relativePath of docsAndValidators) {
    const text = readFileSync(join(rootDir, relativePath), 'utf8');
    for (const [lineIndex, line] of text.split(/\r?\n/).entries()) {
      const normalized = line.replace(/\s+/g, ' ');
      const referencesExtendedCounts = /(19\s*\/\s*37|19[- ]?beam|37[- ]?beam|19\s+or\s+37|19\s*\/\s*37)/i.test(normalized);
      const referencesEvidence = normalized.toLowerCase().includes(trainedBaselinePhrase.toLowerCase());
      const isNegatedBoundary = /\b(not|no|must not|does not|do not|without|unless|forbidden|reject|remain|remains|sensitivity\/demo|extension only|stop|implies)\b/i.test(normalized);

      assert.equal(
        referencesExtendedCounts && referencesEvidence && !isNegatedBoundary,
        false,
        `${relativePath}:${lineIndex + 1} leaks an unsupported 19/37 evidence claim`,
      );
    }
  }
}

function run(): void {
  assertAcceptedInputs();

  for (const numBeams of SUPPORTED_BEAM_COUNTS) {
    assertRingCompleteLayout(numBeams);
    for (const frf of SUPPORTED_FRFS) {
      assertLayoutInvariants(numBeams, frf);
    }
  }

  assertClaimBoundaryText();

  console.log('MODQN Phase 3B beam layout validation passed.');
  console.log(JSON.stringify({
    copiedSourceFiles: [
      '/home/u24/papers/ntn-sim-core/src/core/beam/layout.ts',
      '/home/u24/papers/ntn-sim-core/src/core/beam/types.ts',
    ],
    localModule: 'src/core/beam/layout.ts',
    beamCounts: SUPPORTED_BEAM_COUNTS,
    frfs: SUPPORTED_FRFS,
    expectedReuseDistributions: EXPECTED_REUSE_DISTRIBUTIONS,
    ringRadii: EXPECTED_RING_RADIUS,
    claimBoundary: {
      7: MODQN_BEAM_COUNT_CLAIM_LABELS[7],
      19: MODQN_BEAM_COUNT_CLAIM_LABELS[19],
      37: MODQN_BEAM_COUNT_CLAIM_LABELS[37],
    },
    runtimeAdoption: false,
    uiControlsAdded: false,
    artifactCopied: false,
    result: 'PASS',
  }, null, 2));
}

run();
