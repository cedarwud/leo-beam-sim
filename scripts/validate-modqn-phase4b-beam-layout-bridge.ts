import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateHexagonalBeamLayout } from '../src/core/beam/layout.ts';
import type { SatelliteBeamLayout } from '../src/core/beam/types.ts';
import {
  MODQN_BEAM_COUNT_CLAIM_LABELS,
  MODQN_BASELINE_BEAMS_PER_SATELLITE,
  MODQN_PAPER_ID,
  MODQN_REPLAY_BUNDLE_SCHEMA_VERSION,
  MODQN_TOTAL_BASELINE_BEAMS,
  createBeamLayoutBridgeCatalogByProducerId,
  createBeamLayoutBridgeIdentity,
  deriveCoreBeamId,
  getModqnBeamCountBridgeClaim,
  parseModqnReplayBundle,
  type ModqnBeamReference,
} from '../src/modqn/replay-bundle/index.ts';

const SELECTED_PHASE4B_BUNDLE_PATH =
  '/home/u24/papers/modqn-paper-reproduction/artifacts/phase-1c-regenerated-7beam-baseline-2026-05-11/phase-03a-replay-bundle-v1';

const EXPECTED_TIMELINE_ROWS = 1000;
const EXPECTED_SATELLITE_COUNT = 4;
const BEAM_DIAMETER_KM = 42.5;
const ALTITUDE_KM = 550;
const FRF = 3;

function readBundleFromPath(bundlePath: string) {
  const evaluationSummaryPath = join(bundlePath, 'evaluation/summary.json');

  return parseModqnReplayBundle({
    sourcePath: bundlePath,
    manifestJson: readFileSync(join(bundlePath, 'manifest.json'), 'utf8'),
    provenanceMapJson: readFileSync(join(bundlePath, 'provenance-map.json'), 'utf8'),
    timelineJsonl: readFileSync(join(bundlePath, 'timeline/step-trace.jsonl'), 'utf8'),
    evaluationSummaryJson: existsSync(evaluationSummaryPath)
      ? readFileSync(evaluationSummaryPath, 'utf8')
      : undefined,
  });
}

function assertUnique<T>(values: readonly T[], label: string): void {
  const unique = new Set(values);
  assert.equal(unique.size, values.length, `${label} contains duplicates`);
}

function assertProducerReferencePreserved(
  beam: ModqnBeamReference,
  identity: ReturnType<typeof createBeamLayoutBridgeIdentity>,
  label: string,
): void {
  assert.equal(identity.producerSatId, beam.satId, `${label} producerSatId drifted`);
  assert.equal(identity.producerSatIndex, beam.satIndex, `${label} producerSatIndex drifted`);
  assert.equal(identity.producerBeamId, beam.beamId, `${label} producerBeamId drifted`);
  assert.equal(identity.producerBeamIndex, beam.beamIndex, `${label} producerBeamIndex drifted`);
  assert.equal(identity.producerLocalBeamIndex, beam.localBeamIndex, `${label} producerLocalBeamIndex drifted`);
}

function assertCoreLayoutOrderIsNumeric(): void {
  const layout = generateHexagonalBeamLayout({
    satId: 'phase4b-order-probe',
    numBeams: 19,
    beamDiameterKm: BEAM_DIAMETER_KM,
    altitudeKm: ALTITUDE_KM,
    frf: FRF,
  });
  const numericOrder = layout.beams.map(beam => beam.beamId);
  const lexicographicOrder = [...numericOrder].sort();

  assert.equal(layout.beams.length, 19, '19-beam order probe did not stay on the core layout surface');
  for (const [beamOffset, beam] of layout.beams.entries()) {
    assert.equal('producerSatId' in beam, false, `19-beam order probe beam ${beamOffset} leaked producerSatId`);
    assert.equal('producerBeamId' in beam, false, `19-beam order probe beam ${beamOffset} leaked producerBeamId`);
    assert.equal('producerBeamIndex' in beam, false, `19-beam order probe beam ${beamOffset} leaked producerBeamIndex`);
    assert.equal('producerLocalBeamIndex' in beam, false, `19-beam order probe beam ${beamOffset} leaked producerLocalBeamIndex`);
  }
  assert.equal(numericOrder[2], 'phase4b-order-probe-b2');
  assert.equal(numericOrder[10], 'phase4b-order-probe-b10');
  assert.ok(
    lexicographicOrder.indexOf('phase4b-order-probe-b10') < lexicographicOrder.indexOf('phase4b-order-probe-b2'),
    'order probe did not expose the lexicographic b10/b2 hazard',
  );
  assert.notDeepEqual(
    numericOrder.slice(0, 12),
    lexicographicOrder.slice(0, 12),
    'core layout order collapsed to lexicographic order',
  );
}

function assertProducerIdentityDerivationGuard(beam: ModqnBeamReference): void {
  assert.doesNotThrow(
    () => createBeamLayoutBridgeIdentity(beam, { beamCountPerSatellite: 7 }),
    '7-beam baseline path should derive producer replay identity',
  );

  for (const beamCount of [19, 37, 61] as const) {
    assert.throws(
      () => createBeamLayoutBridgeIdentity(beam, { beamCountPerSatellite: beamCount }),
      /producer replay identity may only be derived for the accepted 7-beam baseline path/,
      `${beamCount}-beam bridge identity call should reject producer identity derivation`,
    );
    assert.throws(
      () => createBeamLayoutBridgeCatalogByProducerId([beam], { beamCountPerSatellite: beamCount }),
      /producer replay identity may only be derived for the accepted 7-beam baseline path/,
      `${beamCount}-beam bridge catalog call should reject before producer identity derivation`,
    );
  }
}

function assertClaimBoundaryText(): void {
  const claim7 = getModqnBeamCountBridgeClaim(7);
  assert.equal(claim7.kind, 'accepted-regenerated-baseline-evidence');
  assert.equal(claim7.supportsProducerReplayEvidence, true);
  assert.equal(claim7.mayDeriveProducerBeamIdentity, true);
  assert.equal(claim7.label, MODQN_BEAM_COUNT_CLAIM_LABELS[7]);

  for (const beamCount of [19, 37] as const) {
    const claim = getModqnBeamCountBridgeClaim(beamCount);
    assert.equal(claim.kind, 'live-sensitivity-demo-only', `${beamCount} claim kind drifted`);
    assert.equal(claim.supportsProducerReplayEvidence, false, `${beamCount} leaked producer evidence support`);
    assert.equal(claim.mayDeriveProducerBeamIdentity, false, `${beamCount} leaked producer identity derivation`);
    assert.equal(/baseline/i.test(claim.label), false, `${beamCount} label leaked baseline wording`);
    assert.match(claim.label, /sensitivity\/demo extension only/);
  }

  const unsupported = getModqnBeamCountBridgeClaim(61);
  assert.equal(unsupported.kind, 'unsupported');
  assert.equal(unsupported.supportsProducerReplayEvidence, false);
  assert.equal(unsupported.mayDeriveProducerBeamIdentity, false);

  const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
  const docsAndValidators = [
    'docs/modqn-baseline-live-integration-mini-sdd.md',
    'docs/modqn-baseline-phase1-evidence-lock.md',
    'docs/modqn-baseline-phase2-identity-adapter.md',
    'docs/modqn-baseline-phase3b-beam-layout-vendor.md',
    'docs/modqn-baseline-phase4a-runtime-adoption-contract.md',
    'docs/modqn-baseline-phase4b-beam-layout-bridge.md',
    'scripts/validate-modqn-phase4b-beam-layout-bridge.ts',
    'src/modqn/replay-bundle/beam-layout-bridge.ts',
  ];

  for (const relativePath of docsAndValidators) {
    const fullPath = join(rootDir, relativePath);
    if (!existsSync(fullPath)) continue;

    const text = readFileSync(fullPath, 'utf8');
    for (const [lineIndex, line] of text.split(/\r?\n/).entries()) {
      const normalized = line.replace(/\s+/g, ' ');
      const referencesExtendedCounts = /(19\s*\/\s*37|19[- ]?beam|37[- ]?beam|19\s+or\s+37|19\s*\/\s*37)/i.test(normalized);
      const referencesEvidence = /trained baseline MODQN evidence/i.test(normalized);
      const isNegatedBoundary = /\b(not|no|must not|does not|do not|without|unless|forbidden|reject|remain|remains|sensitivity\/demo|extension only|false)\b/i.test(normalized);

      assert.equal(
        referencesExtendedCounts && referencesEvidence && !isNegatedBoundary,
        false,
        `${relativePath}:${lineIndex + 1} leaks an unsupported 19/37 evidence claim`,
      );
    }
  }
}

function run(): void {
  const bundlePath = process.argv[2] ?? SELECTED_PHASE4B_BUNDLE_PATH;
  const bundle = readBundleFromPath(bundlePath);

  assert.equal(bundle.manifest.bundleSchemaVersion, MODQN_REPLAY_BUNDLE_SCHEMA_VERSION);
  assert.equal(bundle.manifest.paperId, MODQN_PAPER_ID);
  assert.equal(bundle.manifest.baselineSurface.beamCountPerSatellite, MODQN_BASELINE_BEAMS_PER_SATELLITE);
  assert.equal(bundle.manifest.baselineSurface.totalBeamCount, MODQN_TOTAL_BASELINE_BEAMS);
  assert.equal(bundle.manifest.baselineSurface.satelliteCount, EXPECTED_SATELLITE_COUNT);
  assert.equal(bundle.manifest.claimBoundary.not19Or37BeamTrainedEvidence, true);
  assert.equal(bundle.timelineRows.length, EXPECTED_TIMELINE_ROWS);

  assertCoreLayoutOrderIsNumeric();
  assertClaimBoundaryText();
  assertProducerIdentityDerivationGuard(bundle.timelineRows[0].beamStates[0]);

  const baselineLayoutsByProducerSatId = new Map<string, SatelliteBeamLayout>();
  const observedProducerBeamIds = new Set<string>();
  const observedCoreBeamIdsBySatId = new Map<string, Set<string>>();
  let bridgedRows = 0;
  let bridgedBeamReferences = 0;
  let mutatedRows = 0;

  function getBaselineLayout(producerSatId: string): SatelliteBeamLayout {
    const existing = baselineLayoutsByProducerSatId.get(producerSatId);
    if (existing !== undefined) return existing;

    const layout = generateHexagonalBeamLayout({
      satId: producerSatId,
      numBeams: MODQN_BASELINE_BEAMS_PER_SATELLITE,
      beamDiameterKm: BEAM_DIAMETER_KM,
      altitudeKm: ALTITUDE_KM,
      frf: FRF,
    });
    baselineLayoutsByProducerSatId.set(producerSatId, layout);
    return layout;
  }

  for (const [rowIndex, row] of bundle.timelineRows.entries()) {
    const rowLabel = `timeline row ${rowIndex + 1}`;
    const rowBeforeBridge = JSON.stringify(row);

    assert.equal(row.beamStates.length, MODQN_TOTAL_BASELINE_BEAMS, `${rowLabel} beamStates length drifted`);
    assert.equal(row.satelliteStates.length, EXPECTED_SATELLITE_COUNT, `${rowLabel} satellite count drifted`);
    assert.equal(
      row.satelliteStates.length * MODQN_BASELINE_BEAMS_PER_SATELLITE,
      MODQN_TOTAL_BASELINE_BEAMS,
      `${rowLabel} 4x7 parity drifted`,
    );

    const bridgeCatalog = createBeamLayoutBridgeCatalogByProducerId(row.beamStates);
    assert.equal(bridgeCatalog.size, MODQN_TOTAL_BASELINE_BEAMS, `${rowLabel} bridge catalog size drifted`);
    assertUnique(row.beamStates.map(beam => beam.beamId), `${rowLabel} producerBeamId`);

    let previousProducerBeamIndex = -1;
    const rowCoreBeamIdsBySatId = new Map<string, Set<string>>();

    for (const [beamOffset, beam] of row.beamStates.entries()) {
      const beamLabel = `${rowLabel} beamStates[${beamOffset}]`;
      assert.equal(beam.beamIndex, beamOffset, `${beamLabel} no longer follows numeric beam index order`);
      assert.ok(beam.beamIndex > previousProducerBeamIndex, `${beamLabel} producer order is not numeric ascending`);
      previousProducerBeamIndex = beam.beamIndex;

      const identity = bridgeCatalog.get(beam.beamId);
      assert.ok(identity, `${beamLabel} missing from bridge catalog`);
      assertProducerReferencePreserved(beam, identity, beamLabel);
      assert.equal(identity.coreLayoutSatId, beam.satId, `${beamLabel} default coreLayoutSatId drifted`);
      assert.equal(
        identity.coreBeamId,
        `${beam.satId}-b${beam.localBeamIndex}`,
        `${beamLabel} coreBeamId drifted from producer-local index rule`,
      );
      assert.equal(identity.coreBeamId, deriveCoreBeamId(beam.satId, beam.localBeamIndex), `${beamLabel} deriveCoreBeamId drifted`);
      assert.equal(identity.leoSceneSatId, beam.satId, `${beamLabel} default leoSceneSatId drifted`);
      assert.equal(identity.leoLocalBeamNumericId, beam.localBeamIndex + 1, `${beamLabel} Leo local numeric ID drifted`);
      assert.equal(identity.leoGlobalBeamNumericId, beam.beamIndex + 1, `${beamLabel} Leo global numeric ID drifted`);
      assert.ok(identity.leoLocalBeamNumericId >= 1, `${beamLabel} Leo local numeric ID is not 1-based`);
      assert.ok(identity.leoGlobalBeamNumericId >= 1, `${beamLabel} Leo global numeric ID is not 1-based`);

      const layout = getBaselineLayout(beam.satId);
      const coreBeam = layout.beams[beam.localBeamIndex];
      assert.ok(coreBeam, `${beamLabel} missing core layout beam at local index ${beam.localBeamIndex}`);
      assert.equal(coreBeam.beamId, identity.coreBeamId, `${beamLabel} core layout lookup drifted`);

      const rowCoreIds = rowCoreBeamIdsBySatId.get(identity.coreLayoutSatId) ?? new Set<string>();
      assert.equal(rowCoreIds.has(identity.coreBeamId), false, `${beamLabel} duplicate coreBeamId per satellite`);
      rowCoreIds.add(identity.coreBeamId);
      rowCoreBeamIdsBySatId.set(identity.coreLayoutSatId, rowCoreIds);

      const observedCoreIds = observedCoreBeamIdsBySatId.get(identity.coreLayoutSatId) ?? new Set<string>();
      observedCoreIds.add(identity.coreBeamId);
      observedCoreBeamIdsBySatId.set(identity.coreLayoutSatId, observedCoreIds);
      observedProducerBeamIds.add(identity.producerBeamId);
      bridgedBeamReferences += 1;
    }

    for (const [satId, coreIds] of rowCoreBeamIdsBySatId) {
      assert.equal(coreIds.size, MODQN_BASELINE_BEAMS_PER_SATELLITE, `${rowLabel} ${satId} core ID parity drifted`);
    }

    const mappedIdentity = createBeamLayoutBridgeIdentity(row.selectedServing, {
      coreLayoutSatIdsByProducerSatId: {
        [row.selectedServing.satId]: `${row.selectedServing.satId}-core-layout`,
      },
      leoSceneSatIdsByProducerSatId: new Map([
        [row.selectedServing.satId, `${row.selectedServing.satId}-leo-scene`],
      ]),
    });
    assert.equal(mappedIdentity.producerBeamId, row.selectedServing.beamId, `${rowLabel} explicit bridge mutated producer ID`);
    assert.equal(mappedIdentity.coreLayoutSatId, `${row.selectedServing.satId}-core-layout`, `${rowLabel} explicit core sat bridge failed`);
    assert.equal(
      mappedIdentity.coreBeamId,
      `${row.selectedServing.satId}-core-layout-b${row.selectedServing.localBeamIndex}`,
      `${rowLabel} explicit core beam bridge failed`,
    );
    assert.equal(mappedIdentity.leoSceneSatId, `${row.selectedServing.satId}-leo-scene`, `${rowLabel} explicit Leo scene sat bridge failed`);

    assert.throws(
      () => createBeamLayoutBridgeIdentity(row.selectedServing, {
        coreLayoutSatIdsByProducerSatId: { 'unrelated-sat': 'core-sat' },
      }),
      /missing mapping/,
      `${rowLabel} explicit core bridge table should reject missing mappings`,
    );

    if (JSON.stringify(row) !== rowBeforeBridge) mutatedRows += 1;
    bridgedRows += 1;
  }

  assert.equal(mutatedRows, 0, 'bridge calls mutated producer timeline rows');
  assert.equal(observedProducerBeamIds.size, MODQN_TOTAL_BASELINE_BEAMS, 'unique producer beam parity drifted');
  assert.equal(baselineLayoutsByProducerSatId.size, EXPECTED_SATELLITE_COUNT, 'core layout satellite count drifted');

  for (const [satId, coreIds] of observedCoreBeamIdsBySatId) {
    assert.equal(coreIds.size, MODQN_BASELINE_BEAMS_PER_SATELLITE, `${satId} observed core beam ID parity drifted`);
  }

  console.log('MODQN Phase 4B beam layout bridge validation passed.');
  console.log(JSON.stringify({
    bundlePath,
    schema: bundle.manifest.bundleSchemaVersion,
    paperId: bundle.manifest.paperId,
    parsedThroughPhase2Loader: true,
    bridgeApi: {
      module: 'src/modqn/replay-bundle/beam-layout-bridge.ts',
      defaultCoreLayoutSatId: 'producerSatId',
      coreBeamIdRule: '${coreLayoutSatId}-b${producerLocalBeamIndex}',
      leoNumericIds: 'derived 1-based local/global display helpers',
      explicitBridgeTables: 'supported for coreLayoutSatId and leoSceneSatId',
      producerIdentityDerivationGuard:
        'beamCountPerSatellite must have mayDeriveProducerBeamIdentity=true; 19, 37, and unsupported counts throw',
    },
    parity: {
      satelliteCount: EXPECTED_SATELLITE_COUNT,
      beamsPerSatellite: MODQN_BASELINE_BEAMS_PER_SATELLITE,
      mappedBeams: observedProducerBeamIds.size,
      expectedMappedBeams: MODQN_TOTAL_BASELINE_BEAMS,
      bridgedRows,
      bridgedBeamReferences,
      duplicateProducerBeamIds: 0,
      duplicateCoreBeamIdsPerSatellite: 0,
      mutatedRows,
    },
    order: {
      producerBeamOrder: '0-based global satellite-major / beam-minor',
      coreBeamOrder: 'numeric index order; b10/b2 lexicographic hazard checked with 19-beam layout probe',
    },
    claimBoundary: {
      7: getModqnBeamCountBridgeClaim(7),
      19: getModqnBeamCountBridgeClaim(19),
      37: getModqnBeamCountBridgeClaim(37),
    },
    runtimeAdoption: false,
    uiControlsAdded: false,
    artifactCopied: false,
    result: 'PASS',
  }, null, 2));
}

run();
