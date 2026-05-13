import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateHexagonalBeamLayout } from '../src/core/beam/layout.ts';
import {
  MODQN_BEAM_COUNT_CLAIM_LABELS,
  getModqnBeamCountBridgeClaim,
} from '../src/modqn/replay-bundle/index.ts';
import {
  CORE_LAYOUT_FREQUENCY_REUSE_VALUES,
  MAX_BEAMS_PER_SATELLITE,
  computeBeamGeometry,
  generateCoreSceneBeamOffsetsKm,
  resolveCoreLayoutFrequencyReuse,
  type CoreSceneBeamOffsetKm,
} from '../src/scene/beam-layout.ts';

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const PHASE5A_SAT_ID = 'phase5a-scene-sat';
const ALTITUDE_KM = 550;
const BEAMWIDTH_3DB_RAD = 0.058;
const SUPPORTED_CORE_FREQUENCY_REUSE_VALUES = [1, 3, 7] as const;
const UNSUPPORTED_RUNTIME_FREQUENCY_REUSE_VALUES = [2, 4, 5, 6] as const;
const CURRENT_RUNTIME_BEAM_COUNT = 7;

function readRepoFile(relativePath: string): string {
  return readFileSync(join(ROOT_DIR, relativePath), 'utf8');
}

function assertNearEqual(actual: number, expected: number, label: string): void {
  assert.ok(
    Math.abs(actual - expected) <= 1e-12,
    `${label} drifted: expected ${expected}, got ${actual}`,
  );
}

function assertNoProducerIdentity(value: object, label: string): void {
  for (const key of Object.keys(value)) {
    assert.equal(/^producer/i.test(key), false, `${label} leaked producer identity field ${key}`);
  }
}

function isCoreSupportedFrequencyReuse(frequencyReuse: number): boolean {
  return (CORE_LAYOUT_FREQUENCY_REUSE_VALUES as readonly number[]).includes(frequencyReuse);
}

function generateSceneOffsetsWithoutThrow(
  beamDiameterKm: number,
  frequencyReuse: number,
): CoreSceneBeamOffsetKm[] {
  let sceneOffsets: CoreSceneBeamOffsetKm[] | null = null;
  assert.doesNotThrow(() => {
    sceneOffsets = generateCoreSceneBeamOffsetsKm({
      coreLayoutSatId: PHASE5A_SAT_ID,
      maxBeams: CURRENT_RUNTIME_BEAM_COUNT,
      beamDiameterKm,
      altitudeKm: ALTITUDE_KM,
      frequencyReuse,
    });
  }, `scene adapter threw for runtime K=${frequencyReuse}`);

  assert.ok(sceneOffsets, `scene adapter did not return offsets for runtime K=${frequencyReuse}`);
  return sceneOffsets;
}

function assertRuntimeAdapterMatchesCoreLayoutForFrequencyReuse(
  beamDiameterKm: number,
  frequencyReuse: number,
): void {
  const reuseResolution = resolveCoreLayoutFrequencyReuse(frequencyReuse);
  const sceneOffsets = generateSceneOffsetsWithoutThrow(beamDiameterKm, frequencyReuse);
  const isSupported = isCoreSupportedFrequencyReuse(frequencyReuse);
  const geometry = computeBeamGeometry(ALTITUDE_KM, BEAMWIDTH_3DB_RAD);
  const coreLayout = generateHexagonalBeamLayout({
    satId: PHASE5A_SAT_ID,
    numBeams: CURRENT_RUNTIME_BEAM_COUNT,
    beamDiameterKm,
    altitudeKm: ALTITUDE_KM,
    frf: reuseResolution.coreLayoutFrequencyReuse,
  });

  assertNearEqual(geometry.footprintRadiusKm * 2, beamDiameterKm, `K=${frequencyReuse} beam diameter`);
  assert.equal(sceneOffsets.length, CURRENT_RUNTIME_BEAM_COUNT, `scene adapter did not emit the current 7-beam runtime path for K=${frequencyReuse}`);
  assert.equal(coreLayout.beams.length, CURRENT_RUNTIME_BEAM_COUNT, `core layout did not emit the current 7-beam runtime path for K=${frequencyReuse}`);
  assert.equal(reuseResolution.runtimeFrequencyReuse, frequencyReuse, `runtime frequency reuse drifted for K=${frequencyReuse}`);
  assert.equal(sceneOffsets[0]?.runtimeFrequencyReuse, frequencyReuse, `scene metadata lost runtime K=${frequencyReuse}`);
  assert.equal(
    sceneOffsets[0]?.coreLayoutFrequencyReuse,
    reuseResolution.coreLayoutFrequencyReuse,
    `scene metadata lost core-layout FRF for K=${frequencyReuse}`,
  );
  assert.equal(
    sceneOffsets[0]?.reuseGroupSource,
    isSupported ? 'core-layout' : 'runtime-frequency-reuse-compatibility',
    `scene metadata mislabeled reuseGroupSource for K=${frequencyReuse}`,
  );

  for (const [index, sceneBeam] of sceneOffsets.entries()) {
    const coreBeam = coreLayout.beams[index];
    assert.ok(coreBeam, `missing core beam at index ${index}`);
    assertNoProducerIdentity(sceneBeam, `scene beam ${index}`);
    assert.equal(sceneBeam.beamId, index + 1, `scene beam ${index} numeric beamId is not derived 1-based`);
    assert.equal(sceneBeam.coreLayoutSatId, PHASE5A_SAT_ID, `scene beam ${index} coreLayoutSatId drifted`);
    assert.equal(sceneBeam.coreBeamId, `${PHASE5A_SAT_ID}-b${index}`, `scene beam ${index} coreBeamId drifted`);
    assert.equal(sceneBeam.coreBeamId, coreBeam.beamId, `scene beam ${index} coreBeamId no longer comes from core layout`);
    assert.equal(sceneBeam.coreLocalBeamIndex, index, `scene beam ${index} coreLocalBeamIndex drifted`);
    assert.equal(sceneBeam.runtimeFrequencyReuse, frequencyReuse, `scene beam ${index} runtimeFrequencyReuse drifted for K=${frequencyReuse}`);
    assert.equal(
      sceneBeam.coreLayoutFrequencyReuse,
      reuseResolution.coreLayoutFrequencyReuse,
      `scene beam ${index} coreLayoutFrequencyReuse drifted for K=${frequencyReuse}`,
    );
    assert.equal(
      sceneBeam.reuseGroupSource,
      isSupported ? 'core-layout' : 'runtime-frequency-reuse-compatibility',
      `scene beam ${index} reuseGroupSource drifted for K=${frequencyReuse}`,
    );

    if (isSupported) {
      assert.equal(sceneBeam.reuseGroup, coreBeam.reuseGroup, `scene beam ${index} core reuseGroup drifted for K=${frequencyReuse}`);
    } else {
      assert.equal(
        sceneBeam.reuseGroup,
        index % frequencyReuse,
        `scene beam ${index} compatibility reuseGroup drifted for unsupported K=${frequencyReuse}`,
      );
      assert.notEqual(
        sceneBeam.reuseGroupSource,
        'core-layout',
        `scene beam ${index} mislabeled unsupported K=${frequencyReuse} as core reuse truth`,
      );
    }

    assertNearEqual(sceneBeam.dEastKm, coreBeam.offsetEastKm, `scene beam ${index} east offset for K=${frequencyReuse}`);
    assertNearEqual(sceneBeam.dNorthKm, coreBeam.offsetNorthKm, `scene beam ${index} north offset for K=${frequencyReuse}`);
  }
}

function assertRuntimeAdapterMatchesCoreLayout(): void {
  assert.deepEqual(
    [...CORE_LAYOUT_FREQUENCY_REUSE_VALUES],
    [...SUPPORTED_CORE_FREQUENCY_REUSE_VALUES],
    'core layout FRF support drifted from Phase 5A-R1 assumptions',
  );

  const geometry = computeBeamGeometry(ALTITUDE_KM, BEAMWIDTH_3DB_RAD);
  const beamDiameterKm = geometry.footprintRadiusKm * 2;

  for (const frequencyReuse of SUPPORTED_CORE_FREQUENCY_REUSE_VALUES) {
    assertRuntimeAdapterMatchesCoreLayoutForFrequencyReuse(beamDiameterKm, frequencyReuse);
  }

  for (const frequencyReuse of UNSUPPORTED_RUNTIME_FREQUENCY_REUSE_VALUES) {
    assertRuntimeAdapterMatchesCoreLayoutForFrequencyReuse(beamDiameterKm, frequencyReuse);
  }

  const cappedProbe = generateCoreSceneBeamOffsetsKm({
    coreLayoutSatId: `${PHASE5A_SAT_ID}-sensitivity-probe`,
    maxBeams: 19,
    beamDiameterKm,
    altitudeKm: ALTITUDE_KM,
    frequencyReuse: 3,
  });
  assert.equal(
    cappedProbe.length,
    MAX_BEAMS_PER_SATELLITE,
    'Phase 5A runtime adapter exposed more than the current 7-beam path',
  );
}

function assertRuntimeAdapterContract(): void {
  const beamLayoutSource = readRepoFile('src/scene/beam-layout.ts');
  const typesSource = readRepoFile('src/scene/types.ts');

  assert.match(
    beamLayoutSource,
    /generateHexagonalBeamLayout/,
    'scene beam adapter no longer imports the vendored core layout generator',
  );
  assert.match(
    beamLayoutSource,
    /generateCoreSceneBeamOffsetsKm/,
    'scene beam adapter lost the stageable core layout adapter export',
  );
  assert.match(typesSource, /coreLayoutSatId\?: string/, 'BeamCellState lost coreLayoutSatId metadata');
  assert.match(typesSource, /coreBeamId\?: string/, 'BeamCellState lost coreBeamId metadata');
  assert.match(typesSource, /coreLocalBeamIndex\?: number/, 'BeamCellState lost coreLocalBeamIndex metadata');
  assert.match(typesSource, /reuseGroup\?: number/, 'BeamCellState lost reuseGroup metadata');
  assert.match(typesSource, /runtimeFrequencyReuse\?: number/, 'BeamCellState lost runtimeFrequencyReuse metadata');
  assert.match(typesSource, /coreLayoutFrequencyReuse\?: CoreLayoutFrequencyReuse/, 'BeamCellState lost coreLayoutFrequencyReuse metadata');
  assert.match(typesSource, /reuseGroupSource\?: ReuseGroupSource/, 'BeamCellState lost reuseGroupSource metadata');
  assert.match(
    beamLayoutSource,
    /resolveCoreLayoutFrequencyReuse/,
    'scene beam adapter lost the core-layout frequency reuse guard',
  );
  assert.match(
    beamLayoutSource,
    /runtime-frequency-reuse-compatibility/,
    'scene beam adapter lost explicit compatibility reuseGroup labeling',
  );
  assert.match(
    readRepoFile('docs/modqn-baseline-phase5a-runtime-beam-layout.md'),
    /must not be treated as core-backed reuse truth/,
    'Phase 5A docs no longer label unsupported K reuse groups as non-core compatibility behavior',
  );

  for (const relativePath of [
    'src/scene/beam-layout.ts',
    'src/scene/types.ts',
  ]) {
    const source = readRepoFile(relativePath);
    assert.doesNotMatch(source, /producer(Sat|Beam|Local|Global|Replay|Identity)/, `${relativePath} derives producer replay identity`);
    assert.doesNotMatch(source, /parseModqnReplayBundle|createBeamLayoutBridgeIdentity/, `${relativePath} consumes producer replay helpers`);
  }
}

function assertNoBeamCountControls(): void {
  for (const relativePath of [
    'src/App.tsx',
    'src/ui/ControlBar.tsx',
    'src/scene/runtimeConfig.ts',
  ]) {
    const source = readRepoFile(relativePath);
    assert.doesNotMatch(source, /7\s*\/\s*19\s*\/\s*37/, `${relativePath} exposed 7/19/37 as a UI control`);
    assert.doesNotMatch(source, /19[- ]?beam|37[- ]?beam/i, `${relativePath} exposed 19/37 beam-count UI wording`);
    assert.doesNotMatch(source, /beamCount|beam-count/, `${relativePath} added a beam-count control surface`);
  }
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

  const docsAndValidators = [
    'docs/modqn-baseline-live-integration-mini-sdd.md',
    'docs/modqn-baseline-phase1-evidence-lock.md',
    'docs/modqn-baseline-phase2-identity-adapter.md',
    'docs/modqn-baseline-phase3b-beam-layout-vendor.md',
    'docs/modqn-baseline-phase4a-runtime-adoption-contract.md',
    'docs/modqn-baseline-phase4b-beam-layout-bridge.md',
    'docs/modqn-baseline-phase5a-runtime-beam-layout.md',
    'scripts/validate-modqn-phase5a-runtime-beam-layout.ts',
  ];

  for (const relativePath of docsAndValidators) {
    const fullPath = join(ROOT_DIR, relativePath);
    if (!existsSync(fullPath)) continue;
    const text = readFileSync(fullPath, 'utf8');
    for (const [lineIndex, line] of text.split(/\r?\n/).entries()) {
      const normalized = line.replace(/\s+/g, ' ');
      const referencesExtendedCounts = /(19\s*\/\s*37|19[- ]?beam|37[- ]?beam|19\s+or\s+37)/i.test(normalized);
      const referencesEvidence = /trained[- ]baseline MODQN evidence|trained baseline MODQN evidence/i.test(normalized);
      const isNegatedBoundary = /\b(not|no|must not|does not|do not|without|unless|forbidden|reject|remain|remains|sensitivity\/demo|extension only|false|claim boundary)\b/i.test(normalized);

      assert.equal(
        referencesExtendedCounts && referencesEvidence && !isNegatedBoundary,
        false,
        `${relativePath}:${lineIndex + 1} leaks an unsupported 19/37 evidence claim`,
      );
    }
  }
}

function assertPackageScript(): void {
  const packageJson = JSON.parse(readRepoFile('package.json')) as {
    scripts?: Record<string, string>;
  };
  assert.equal(
    packageJson.scripts?.['validate:modqn:phase5a-runtime-beam-layout'],
    'node --import tsx/esm scripts/validate-modqn-phase5a-runtime-beam-layout.ts',
    'package.json lost the Phase 5A validator script',
  );
}

function run(): void {
  assertRuntimeAdapterMatchesCoreLayout();
  assertRuntimeAdapterContract();
  assertNoBeamCountControls();
  assertClaimBoundaryText();
  assertPackageScript();

  console.log('MODQN Phase 5A runtime beam layout validation passed.');
  console.log(JSON.stringify({
    runtimeGeometrySource: 'generateHexagonalBeamLayout',
    runtimeBeamCount: CURRENT_RUNTIME_BEAM_COUNT,
    downstreamBeamId: 'derived 1-based numeric Leo compatibility ID',
    metadataFields: [
      'coreLayoutSatId',
      'coreBeamId',
      'coreLocalBeamIndex',
      'reuseGroup',
      'runtimeFrequencyReuse',
      'coreLayoutFrequencyReuse',
      'reuseGroupSource',
    ],
    coreSupportedFrequencyReuse: [...CORE_LAYOUT_FREQUENCY_REUSE_VALUES],
    compatibilityFrequencyReuse: [...UNSUPPORTED_RUNTIME_FREQUENCY_REUSE_VALUES],
    compatibilityReuseGroupSource: 'runtime-frequency-reuse-compatibility',
    strictPhase5RuntimeConsumerDependency: false,
    producerReplayIdentityDerivedInSceneRuntime: false,
    uiBeamCountControlsAdded: false,
    hobsSinrPresentedAsModqnReplayEvidence: false,
    claimBoundary: {
      7: MODQN_BEAM_COUNT_CLAIM_LABELS[7],
      19: MODQN_BEAM_COUNT_CLAIM_LABELS[19],
      37: MODQN_BEAM_COUNT_CLAIM_LABELS[37],
    },
    result: 'PASS',
  }, null, 2));
}

run();
