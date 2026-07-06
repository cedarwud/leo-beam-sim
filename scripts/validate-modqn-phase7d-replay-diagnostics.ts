import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MODQN_BEAM_CATALOG_ORDER,
  MODQN_EXPECTED_EVENT_COUNTS,
  MODQN_FIXTURE_ONLY_EVIDENCE_STATUS,
  MODQN_PAPER_ID,
  MODQN_REPLAY_7BEAM_EVIDENCE_STATUS,
  MODQN_REPLAY_7BEAM_MODE_KEY,
  MODQN_REPLAY_7BEAM_MODE_LABEL,
  MODQN_REPLAY_BUNDLE_SCHEMA_VERSION,
  MODQN_PRODUCER_BASELINE_RUN_PATH,
  MODQN_TOTAL_BASELINE_BEAMS,
  SELECTED_MODQN_PHASE7C_REPLAY_BUNDLE_PATH,
  SUPPORTED_MODQN_HANDOVER_EVENT_KINDS,
  createModqnReplayBundleLoadPlan,
  createModqnReplayEnvelopeFromContents,
  getModqnBeamCountBridgeClaim,
  getModqnPhase7cExpectedShape,
  loadModqnReplayEnvelopeFromSurfaceReader,
  parseModqnReplayBundle,
  type ModqnHandoverEventKind,
  type ModqnReplayBundleContents,
  type ModqnReplayBundleSurface,
  type ModqnReplayEnvelope,
} from '../src/modqn/replay-bundle/index.ts';
import { ensureModqnCurrentBaselineExport } from './support/modqn-current-baseline-export.ts';
import { skipIfDataUnavailable } from './lib/ci-data-guard.ts';

// CI-environment guard (P2 SN-3c): the staged bundle is /tmp-ephemeral and
// self-heals from the producer repo via ensureModqnCurrentBaselineExport(). Skip
// (visibly, exit 0 + marker) only when the staging AND the producer baseline run
// are BOTH absent — the hosted-CI signature. See scripts/lib/ci-data-guard.ts for
// the SKIP semantics.
skipIfDataUnavailable([{
  path: join(SELECTED_MODQN_PHASE7C_REPLAY_BUNDLE_PATH, 'manifest.json'),
  why: 'staged baseline pilot02 replay bundle — /tmp staging; self-heals from the producer repo when present',
  regenerableFrom: MODQN_PRODUCER_BASELINE_RUN_PATH,
}]);

function readSurfaceFromDisk(surface: ModqnReplayBundleSurface): string | undefined {
  if (!existsSync(surface.absolutePath)) return undefined;
  return readFileSync(surface.absolutePath, 'utf8');
}

function readBundleContentsFromPlan(
  plan: ReturnType<typeof createModqnReplayBundleLoadPlan>,
): ModqnReplayBundleContents {
  assert.ok(existsSync(plan.sourcePath), `selected evidence path is missing: ${plan.sourcePath}`);

  const surfaceTexts = new Map<string, string>();
  for (const surface of plan.requiredSurfaces) {
    assert.ok(
      existsSync(surface.absolutePath),
      `required Phase 7D surface is missing: ${surface.relativePath} at ${surface.absolutePath}`,
    );
    surfaceTexts.set(surface.contentsKey, readFileSync(surface.absolutePath, 'utf8'));
  }

  const evaluationSummaryPath = join(plan.sourcePath, 'evaluation/summary.json');

  return {
    sourcePath: plan.sourcePath,
    manifestJson: surfaceTexts.get('manifestJson') ?? '',
    provenanceMapJson: surfaceTexts.get('provenanceMapJson') ?? '',
    timelineJsonl: surfaceTexts.get('timelineJsonl') ?? '',
    evaluationSummaryJson: existsSync(evaluationSummaryPath)
      ? readFileSync(evaluationSummaryPath, 'utf8')
      : undefined,
  };
}

function flattenRows(envelope: ModqnReplayEnvelope) {
  return envelope.replaySlots.flatMap(slot => slot.rows);
}

function assertSelectedArtifactStatus(envelope: ModqnReplayEnvelope): void {
  assert.equal(
    envelope.claimBoundary.artifactStatus,
    'current-baseline-run-exported-bundle',
  );
  assert.match(
    envelope.sourcePath,
    /baseline-modqn-pilot02-rerun-2026-05-15-export$/,
    'selected replay path should point at the current producer baseline export',
  );
}

function assertEnvelopeIdentity(envelope: ModqnReplayEnvelope): void {
  assert.equal(envelope.modeKey, MODQN_REPLAY_7BEAM_MODE_KEY);
  assert.equal(envelope.modeLabel, MODQN_REPLAY_7BEAM_MODE_LABEL);
  assert.equal(envelope.evidenceStatus, MODQN_REPLAY_7BEAM_EVIDENCE_STATUS);
  assert.equal(envelope.sourceOwner, 'modqn-paper-reproduction');
  assert.equal(envelope.sourcePath, SELECTED_MODQN_PHASE7C_REPLAY_BUNDLE_PATH);
  assert.equal(envelope.sourceSchemaVersion, MODQN_REPLAY_BUNDLE_SCHEMA_VERSION);
  assert.equal(envelope.paperId, MODQN_PAPER_ID);
}

function assertRequiredSurfacesExist(): void {
  const loadPlan = createModqnReplayBundleLoadPlan();
  assert.deepEqual(loadPlan.requiredSurfaces.map(surface => surface.relativePath), [
    'manifest.json',
    'provenance-map.json',
    'timeline/step-trace.jsonl',
  ]);

  for (const surface of loadPlan.requiredSurfaces) {
    assert.ok(existsSync(surface.absolutePath), `${surface.relativePath} must exist`);
    assert.ok(readFileSync(surface.absolutePath, 'utf8').trim().length > 0, `${surface.relativePath} must be non-empty`);
  }
}

function assertReplayShape(envelope: ModqnReplayEnvelope): void {
  const expected = getModqnPhase7cExpectedShape();
  assert.equal(expected.schema, MODQN_REPLAY_BUNDLE_SCHEMA_VERSION);
  assert.equal(envelope.sourceSchemaVersion, expected.schema);
  assert.equal(envelope.paperId, expected.paperId);
  assert.equal(envelope.diagnostics.adapter.satelliteCount, expected.satelliteCount);
  assert.equal(envelope.diagnostics.adapter.beamCountPerSatellite, expected.beamCountPerSatellite);
  assert.equal(envelope.diagnostics.adapter.totalBeamCount, expected.totalBeamCount);
  assert.equal(envelope.diagnostics.adapter.rowCount, expected.timelineRows);
  assert.equal(envelope.diagnostics.adapter.slotCount, expected.slotCount);
  assert.equal(envelope.replaySlots.length, expected.slotCount);
  assert.equal(flattenRows(envelope).length, expected.timelineRows);
  assert.equal(envelope.identityMap.users.length, 100);
  assert.equal(envelope.identityMap.beamBridges.length, MODQN_TOTAL_BASELINE_BEAMS);
  assert.equal(envelope.identityMap.producerBeamCatalogOrder, MODQN_BEAM_CATALOG_ORDER);
}

function assertProducerTruthPreserved(
  contents: ModqnReplayBundleContents,
  envelope: ModqnReplayEnvelope,
): void {
  const sourceBundle = parseModqnReplayBundle(contents);
  const envelopeRows = flattenRows(envelope);

  assert.equal(envelopeRows.length, sourceBundle.timelineRows.length);
  assert.deepEqual(envelope.provenanceMap, sourceBundle.provenanceMap);
  assert.deepEqual(envelope.replaySummary, sourceBundle.manifest.replaySummary);

  for (const [rowIndex, sourceRow] of sourceBundle.timelineRows.entries()) {
    const envelopeRow = envelopeRows[rowIndex];
    assert.ok(envelopeRow, `missing envelope row ${rowIndex}`);
    const producerTruth = envelopeRow.producerTruth;

    assert.deepEqual(producerTruth.timestamps, {
      slotIndex: sourceRow.slotIndex,
      timeSec: sourceRow.timeSec,
      decisionTimeSec: sourceRow.decisionTimeSec,
    });
    assert.deepEqual(producerTruth.selectedServing, sourceRow.selectedServing);
    assert.deepEqual(producerTruth.previousServing, sourceRow.previousServing);
    assert.deepEqual(producerTruth.candidateActionOrder, sourceRow.beamStates);
    assert.equal(producerTruth.beamCatalogOrder, sourceRow.beamCatalogOrder);
    assert.deepEqual(producerTruth.visibilityMask, sourceRow.visibilityMask);
    assert.deepEqual(producerTruth.actionValidityMask, sourceRow.actionValidityMask);
    assert.deepEqual(producerTruth.decisionVisibilityMask, sourceRow.decisionVisibilityMask);
    assert.deepEqual(producerTruth.decisionActionValidityMask, sourceRow.decisionActionValidityMask);
    assert.deepEqual(producerTruth.beamLoads, sourceRow.beamLoads);
    assert.deepEqual(producerTruth.beamThroughputs, sourceRow.beamThroughputs);
    assert.deepEqual(Object.keys(producerTruth.rewardVector), Object.keys(sourceRow.rewardVector));
    assert.deepEqual(producerTruth.rewardVector, sourceRow.rewardVector);
    assert.equal(producerTruth.scalarReward, sourceRow.scalarReward);
    assert.equal(producerTruth.handoverEvent.kind, sourceRow.handoverEvent.kind);
    assert.deepEqual(producerTruth.handoverEvent, sourceRow.handoverEvent);
    assert.deepEqual(producerTruth.policyDiagnostics, sourceRow.policyDiagnostics);
    assert.deepEqual(producerTruth.sourceRow, sourceRow);
    assert.equal(envelopeRow.selectedActionIdentity.selectedActionIndex, sourceRow.selectedServing.beamIndex);
    assert.equal(envelopeRow.handoverIdentity.producerEventKind, sourceRow.handoverEvent.kind);
  }
}

function assertDiagnosticsNamespaceSeparation(
  contents: ModqnReplayBundleContents,
  envelope: ModqnReplayEnvelope,
): void {
  const sourceBundle = parseModqnReplayBundle(contents);
  const rowsWithPolicyDiagnostics = sourceBundle.timelineRows.filter(row => row.policyDiagnostics !== undefined);
  assert.ok(envelope.diagnostics.adapter, 'diagnostics.adapter must exist');
  assert.ok(envelope.diagnostics.producerPolicyDiagnostics, 'producer policy diagnostics namespace must exist');
  assert.equal(rowsWithPolicyDiagnostics.length, 1000);
  assert.equal(envelope.diagnostics.producerPolicyDiagnostics.status, 'present-from-producer');
  assert.equal(envelope.diagnostics.producerPolicyDiagnostics.rowsWithDiagnostics, rowsWithPolicyDiagnostics.length);
  assert.equal(envelope.diagnostics.adapter.rowsWithPolicyDiagnostics, rowsWithPolicyDiagnostics.length);

  const adapterKeys = new Set(Object.keys(envelope.diagnostics.adapter));
  const firstPolicyDiagnostics = rowsWithPolicyDiagnostics[0]?.policyDiagnostics;
  assert.ok(firstPolicyDiagnostics, 'source rows must contain producer policy diagnostics');
  for (const producerKey of Object.keys(firstPolicyDiagnostics)) {
    assert.equal(
      adapterKeys.has(producerKey),
      false,
      `adapter diagnostics must not overwrite producer policy diagnostics key ${producerKey}`,
    );
  }
}

function assertEventBoundary(envelope: ModqnReplayEnvelope): void {
  const observed: Record<ModqnHandoverEventKind, number> = {
    none: 0,
    'intra-satellite-beam-switch': 0,
    'inter-satellite-handover': 0,
  };

  assert.ok(
    SUPPORTED_MODQN_HANDOVER_EVENT_KINDS.includes('inter-satellite-handover'),
    'inter-satellite handover may exist in the adapter type boundary',
  );

  for (const row of flattenRows(envelope)) {
    const sourceKind = row.producerTruth.handoverEvent.kind;
    observed[sourceKind] += 1;
    assert.equal(row.handoverIdentity.producerEventKind, sourceKind);
    if (sourceKind === 'none') {
      assert.equal(row.handoverIdentity.semanticKind, 'no-event');
    }
    if (sourceKind === 'intra-satellite-beam-switch') {
      assert.equal(row.handoverIdentity.semanticKind, 'intra-satellite-beam-handover');
    }
  }

  assert.deepEqual(observed, envelope.diagnostics.adapter.eventCounts);
  assert.equal(observed.none, MODQN_EXPECTED_EVENT_COUNTS.none);
  assert.equal(
    observed['intra-satellite-beam-switch'],
    MODQN_EXPECTED_EVENT_COUNTS['intra-satellite-beam-switch'],
  );
  assert.equal(
    observed['inter-satellite-handover'],
    MODQN_EXPECTED_EVENT_COUNTS['inter-satellite-handover'],
  );
  assert.doesNotMatch(envelope.claimBoundary.allowedClaims.join('\n'), /inter-satellite handover/i);
}

function assertFixtureOnlyBehavior(contents: ModqnReplayBundleContents): void {
  const fixtureEnvelope = createModqnReplayEnvelopeFromContents({
    ...contents,
    sourcePath: '/tmp/modqn-phase7d-fixture-only',
  }, {
    sourcePath: '/tmp/modqn-phase7d-fixture-only',
    fixtureOnly: true,
    sourceOwner: 'fixture',
  });

  assert.equal(fixtureEnvelope.modeKey, 'sensitivity-demo');
  assert.equal(fixtureEnvelope.evidenceStatus, MODQN_FIXTURE_ONLY_EVIDENCE_STATUS);
  assert.equal(fixtureEnvelope.claimBoundary.baselineModqnEvidence, false);
  assert.equal(fixtureEnvelope.claimBoundary.acceptedEvidenceShape, 'none-fixture-only');
  assert.equal(fixtureEnvelope.claimBoundary.artifactStatus, 'fixture-only-non-evidence-not-producer-artifact');
  assert.equal(fixtureEnvelope.identityMap.beamBridges.length, 0);
  assert.equal(fixtureEnvelope.diagnostics.adapter.bridgeStatus, 'skipped-fixture-only-non-evidence');
  assert.doesNotMatch(fixtureEnvelope.claimBoundary.allowedClaims.join('\n'), /producer-owned/i);

  const producerOwnerFixtureEnvelope = createModqnReplayEnvelopeFromContents({
    ...contents,
    sourcePath: '/tmp/modqn-phase7d-producer-owner-fixture-only',
  }, {
    sourcePath: '/tmp/modqn-phase7d-producer-owner-fixture-only',
    fixtureOnly: true,
    sourceOwner: 'modqn-paper-reproduction',
  });

  assert.equal(producerOwnerFixtureEnvelope.sourceOwner, 'modqn-paper-reproduction');
  assert.equal(producerOwnerFixtureEnvelope.evidenceStatus, MODQN_FIXTURE_ONLY_EVIDENCE_STATUS);
  assert.equal(producerOwnerFixtureEnvelope.claimBoundary.baselineModqnEvidence, false);
  assert.equal(producerOwnerFixtureEnvelope.claimBoundary.artifactStatus, 'fixture-only-non-evidence-not-producer-artifact');
  assert.equal(producerOwnerFixtureEnvelope.identityMap.beamBridges.length, 0);
}

function assertFailClosedBehavior(contents: ModqnReplayBundleContents): void {
  assert.throws(
    () => loadModqnReplayEnvelopeFromSurfaceReader(() => undefined),
    /required surface manifest\.json/,
    'missing selected path or unreadable selected surfaces must fail before envelope emission',
  );
  assert.throws(
    () => loadModqnReplayEnvelopeFromSurfaceReader(surface => {
      if (surface.relativePath === 'manifest.json') return undefined;
      return readSurfaceFromDisk(surface);
    }),
    /required surface manifest\.json/,
    'missing manifest must fail closed',
  );
  assert.throws(
    () => loadModqnReplayEnvelopeFromSurfaceReader(surface => {
      if (surface.relativePath === 'provenance-map.json') return undefined;
      return readSurfaceFromDisk(surface);
    }),
    /required surface provenance-map\.json/,
    'missing provenance map must fail closed',
  );
  assert.throws(
    () => loadModqnReplayEnvelopeFromSurfaceReader(surface => {
      if (surface.relativePath === 'timeline/step-trace.jsonl') return undefined;
      return readSurfaceFromDisk(surface);
    }),
    /required surface timeline\/step-trace\.jsonl/,
    'missing timeline must fail closed',
  );
  assert.throws(
    () => createModqnReplayBundleLoadPlan({ sourcePath: '/tmp/non-selected-modqn-phase7d-bundle' }),
    /selected path or explicit fixtureOnly=true/,
    'non-selected evidence paths must fail unless fixtureOnly=true',
  );
  assert.doesNotThrow(
    () => createModqnReplayBundleLoadPlan({
      sourcePath: '/tmp/non-selected-modqn-phase7d-bundle',
      fixtureOnly: true,
    }),
    'non-selected paths are allowed only as explicit fixture-only non-evidence inputs',
  );
  assert.throws(
    () => createModqnReplayBundleLoadPlan({ sourceOwner: 'leo-beam-sim' }),
    /sourceOwner/,
    'sourceOwner override must not make evidence-capable replay producer-owned',
  );
  assert.throws(
    () => createModqnReplayEnvelopeFromContents({
      ...contents,
      manifestJson: '',
    }),
    /required surface manifest\.json/,
    'empty manifest contents must fail closed',
  );
}

function assertClaimBoundaries(envelope: ModqnReplayEnvelope): void {
  assert.equal(envelope.claimBoundary.baselineModqnEvidence, true);
  assert.equal(envelope.claimBoundary.acceptedEvidenceShape, '7-beam producer baseline only');
  assert.equal(envelope.claimBoundary.sourceClaimBoundary.notFullPaperFaithfulReproduction, true);
  assert.equal(envelope.claimBoundary.sourceClaimBoundary.not19Or37BeamTrainedEvidence, true);
  assert.equal(envelope.claimBoundary.beamCountBoundary[7], 'accepted regenerated baseline MODQN evidence path');
  assert.equal(envelope.claimBoundary.beamCountBoundary[19], 'live sensitivity/demo extension only');
  assert.equal(envelope.claimBoundary.beamCountBoundary[37], 'live sensitivity/demo extension only');

  const claim7 = getModqnBeamCountBridgeClaim(7);
  const claim19 = getModqnBeamCountBridgeClaim(19);
  const claim37 = getModqnBeamCountBridgeClaim(37);
  assert.equal(claim7.supportsProducerReplayEvidence, true);
  assert.equal(claim7.mayDeriveProducerBeamIdentity, true);
  assert.equal(claim19.supportsProducerReplayEvidence, false);
  assert.equal(claim19.mayDeriveProducerBeamIdentity, false);
  assert.equal(claim37.supportsProducerReplayEvidence, false);
  assert.equal(claim37.mayDeriveProducerBeamIdentity, false);
  assert.doesNotMatch(`${claim19.label}\n${claim37.label}`, /trained baseline/i);

  const forbiddenClaims = envelope.claimBoundary.forbiddenClaims.join('\n');
  assert.match(forbiddenClaims, /No full paper-faithful reproduction claim\./);
  assert.match(forbiddenClaims, /No 19-beam or 37-beam trained baseline MODQN evidence claim\./);
  assert.match(forbiddenClaims, /No EE\/HEA\/Catfish\/Multi-Catfish\/Catfish-over-HEA scope claim\./);
  assert.match(forbiddenClaims, /No HOBS\/SINR live output as MODQN replay evidence claim\./);

  const positiveClaimText = [
    envelope.modeKey,
    envelope.modeLabel,
    envelope.evidenceStatus,
    envelope.sourceOwner,
    envelope.claimBoundary.artifactStatus,
    ...envelope.claimBoundary.allowedClaims,
    envelope.claimBoundary.beamCountBoundary[7],
  ].join('\n');

  assert.doesNotMatch(positiveClaimText, /19-beam|37-beam|trained baseline/i);
  assert.doesNotMatch(positiveClaimText, /\bEE\b|\bHEA\b|Catfish|Multi-Catfish|Catfish-over-HEA/i);
  assert.doesNotMatch(positiveClaimText, /HOBS\/SINR/i);
  assert.doesNotMatch(positiveClaimText, /full paper-faithful/i);
  assert.doesNotMatch(positiveClaimText, /recovered frozen|exact restoration/i);
}

function run(): void {
  ensureModqnCurrentBaselineExport();
  const loadPlan = createModqnReplayBundleLoadPlan();
  const contents = readBundleContentsFromPlan(loadPlan);
  const envelope = loadModqnReplayEnvelopeFromSurfaceReader(readSurfaceFromDisk);

  assertEnvelopeIdentity(envelope);
  assertSelectedArtifactStatus(envelope);
  assertRequiredSurfacesExist();
  assertReplayShape(envelope);
  assertProducerTruthPreserved(contents, envelope);
  assertDiagnosticsNamespaceSeparation(contents, envelope);
  assertEventBoundary(envelope);
  assertFixtureOnlyBehavior(contents);
  assertFailClosedBehavior(contents);
  assertClaimBoundaries(envelope);

  console.log('MODQN Phase 7D replay diagnostics validation passed.');
  console.log(JSON.stringify({
    bundlePath: envelope.sourcePath,
    modeKey: envelope.modeKey,
    modeLabel: envelope.modeLabel,
    evidenceStatus: envelope.evidenceStatus,
    sourceOwner: envelope.sourceOwner,
    artifactStatus: envelope.claimBoundary.artifactStatus,
    replayShape: {
      schema: envelope.sourceSchemaVersion,
      paperId: envelope.paperId,
      satelliteCount: envelope.diagnostics.adapter.satelliteCount,
      beamsPerSatellite: envelope.diagnostics.adapter.beamCountPerSatellite,
      totalBeams: envelope.diagnostics.adapter.totalBeamCount,
      rows: envelope.diagnostics.adapter.rowCount,
      slots: envelope.diagnostics.adapter.slotCount,
      userIdentities: envelope.identityMap.users.length,
      identityBridgeRecords: envelope.identityMap.beamBridges.length,
    },
    diagnosticsNamespaces: Object.keys(envelope.diagnostics),
    eventCounts: envelope.diagnostics.adapter.eventCounts,
    fixtureOnly: {
      evidenceStatus: MODQN_FIXTURE_ONLY_EVIDENCE_STATUS,
      baselineModqnEvidence: false,
      producerBeamBridgeEvidence: 'skipped-fixture-only-non-evidence',
    },
    failClosed: {
      missingSelectedPath: true,
      missingManifest: true,
      missingProvenanceMap: true,
      missingTimeline: true,
      nonSelectedPathRequiresFixtureOnly: true,
      sourceOwnerOverrideCannotPromoteFixture: true,
    },
    claimBoundary: {
      baselineModqnEvidenceShape: '7-beam producer baseline only',
      nineteenAndThirtySeven: [
        envelope.claimBoundary.beamCountBoundary[19],
        envelope.claimBoundary.beamCountBoundary[37],
      ],
      hobsSinrLiveOutputIsModqnReplayEvidence: false,
    },
    result: 'PASS',
  }, null, 2));
}

run();
