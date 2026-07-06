import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MODQN_FIXTURE_ONLY_EVIDENCE_STATUS,
  MODQN_EXPECTED_EVENT_COUNTS,
  MODQN_REPLAY_7BEAM_EVIDENCE_STATUS,
  MODQN_REPLAY_7BEAM_MODE_KEY,
  MODQN_REPLAY_7BEAM_MODE_LABEL,
  MODQN_PRODUCER_BASELINE_RUN_PATH,
  MODQN_TOTAL_BASELINE_BEAMS,
  SELECTED_MODQN_PHASE7C_REPLAY_BUNDLE_PATH,
  createModqnReplayBundleLoadPlan,
  createModqnReplayEnvelopeFromContents,
  getModqnBeamCountBridgeClaim,
  getModqnPhase7cExpectedShape,
  loadModqnReplayEnvelopeFromSurfaceReader,
  parseModqnReplayBundle,
  type ModqnReplayBundleSurface,
  type ModqnReplayBundleContents,
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
  assert.ok(existsSync(plan.sourcePath), `selected bundle path is missing: ${plan.sourcePath}`);
  const surfaceTexts = new Map<string, string>();

  for (const surface of plan.requiredSurfaces) {
    assert.ok(
      existsSync(surface.absolutePath),
      `required Phase 7C surface is missing: ${surface.relativePath} at ${surface.absolutePath}`,
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

function hasExplicitActionField(row: { readonly action?: unknown }): boolean {
  return Object.prototype.hasOwnProperty.call(row, 'action');
}

function assertSerializable(envelope: ModqnReplayEnvelope): void {
  const serialized = JSON.stringify(envelope);
  assert.ok(serialized.length > 0, 'envelope did not serialize');
  const parsed = JSON.parse(serialized) as { modeKey?: unknown; replaySlots?: unknown };
  assert.equal(parsed.modeKey, envelope.modeKey, 'serialized modeKey drifted');
  assert.ok(Array.isArray(parsed.replaySlots), 'serialized replaySlots is not an array');
}

function assertEnvelopeHeader(envelope: ModqnReplayEnvelope): void {
  assert.equal(envelope.modeKey, MODQN_REPLAY_7BEAM_MODE_KEY);
  assert.equal(envelope.modeLabel, MODQN_REPLAY_7BEAM_MODE_LABEL);
  assert.equal(envelope.evidenceStatus, MODQN_REPLAY_7BEAM_EVIDENCE_STATUS);
  assert.equal(envelope.sourceOwner, 'modqn-paper-reproduction');
  assert.equal(envelope.sourcePath, SELECTED_MODQN_PHASE7C_REPLAY_BUNDLE_PATH);
  assert.equal(envelope.claimBoundary.baselineModqnEvidence, true);
  assert.equal(envelope.claimBoundary.sourceClaimBoundary.notFullPaperFaithfulReproduction, true);
  assert.equal(envelope.claimBoundary.sourceClaimBoundary.not19Or37BeamTrainedEvidence, true);
  assert.match(
    envelope.claimBoundary.forbiddenClaims.join('\n'),
    /No 19-beam or 37-beam trained baseline MODQN evidence claim\./,
  );
  assert.match(
    envelope.claimBoundary.forbiddenClaims.join('\n'),
    /No HOBS\/SINR live output as MODQN replay evidence claim\./,
  );
}

function assertExpectedShape(envelope: ModqnReplayEnvelope): void {
  const expected = getModqnPhase7cExpectedShape();
  assert.equal(envelope.sourceSchemaVersion, expected.schema);
  assert.equal(envelope.paperId, expected.paperId);
  assert.equal(envelope.diagnostics.adapter.satelliteCount, expected.satelliteCount);
  assert.equal(envelope.diagnostics.adapter.beamCountPerSatellite, expected.beamCountPerSatellite);
  assert.equal(envelope.diagnostics.adapter.totalBeamCount, expected.totalBeamCount);
  assert.equal(envelope.diagnostics.adapter.rowCount, expected.timelineRows);
  assert.equal(envelope.diagnostics.adapter.slotCount, expected.slotCount);
  assert.deepEqual(envelope.diagnostics.adapter.requiredSurfaces, [
    'manifest.json',
    'provenance-map.json',
    'timeline/step-trace.jsonl',
  ]);
  assert.deepEqual(Object.keys(envelope.diagnostics.adapter.eventCounts).sort(), [
    'inter-satellite-handover',
    'intra-satellite-beam-switch',
    'none',
  ]);
  assert.equal(envelope.diagnostics.adapter.eventCounts.none, MODQN_EXPECTED_EVENT_COUNTS.none);
  assert.equal(
    envelope.diagnostics.adapter.eventCounts['intra-satellite-beam-switch'],
    MODQN_EXPECTED_EVENT_COUNTS['intra-satellite-beam-switch'],
  );
  assert.equal(
    envelope.diagnostics.adapter.eventCounts['inter-satellite-handover'],
    MODQN_EXPECTED_EVENT_COUNTS['inter-satellite-handover'],
  );
  assert.equal(envelope.diagnostics.adapter.rowsWithPolicyDiagnostics, expected.timelineRows);
  assert.equal(envelope.diagnostics.adapter.rowsWithoutPolicyDiagnostics, 0);
  assert.equal(envelope.diagnostics.adapter.bridgeStatus, 'built-for-accepted-7beam-path');
  assert.equal(envelope.diagnostics.producerPolicyDiagnostics.status, 'present-from-producer');
}

function assertIdentityBridge(envelope: ModqnReplayEnvelope): void {
  assert.equal(envelope.identityMap.producerBeamCatalogOrder, 'satellite-major-beam-minor');
  assert.equal(envelope.identityMap.beamCountBridgeClaim.kind, 'accepted-regenerated-baseline-evidence');
  assert.equal(envelope.identityMap.beamCountBridgeClaim.supportsProducerReplayEvidence, true);
  assert.equal(envelope.identityMap.beamCountBridgeClaim.mayDeriveProducerBeamIdentity, true);
  assert.equal(envelope.identityMap.beamBridges.length, MODQN_TOTAL_BASELINE_BEAMS);
  assert.equal(envelope.identityMap.users.length, 100);

  for (const [beamOffset, bridge] of envelope.identityMap.beamBridges.entries()) {
    assert.equal(bridge.producerBeamIndex, beamOffset, `beam bridge ${beamOffset} producer order drifted`);
    assert.equal(bridge.coreBeamId, `${bridge.coreLayoutSatId}-b${bridge.producerLocalBeamIndex}`);
    assert.equal(bridge.leoLocalBeamNumericId, bridge.producerLocalBeamIndex + 1);
    assert.equal(bridge.leoGlobalBeamNumericId, bridge.producerBeamIndex + 1);
  }

  for (const beamCount of [19, 37] as const) {
    const claim = getModqnBeamCountBridgeClaim(beamCount);
    assert.equal(claim.kind, 'live-sensitivity-demo-only');
    assert.equal(claim.supportsProducerReplayEvidence, false);
    assert.equal(claim.mayDeriveProducerBeamIdentity, false);
    assert.doesNotMatch(claim.label, /trained baseline/i);
  }
}

function assertSlotGrouping(envelope: ModqnReplayEnvelope): void {
  assert.equal(envelope.replaySlots.length, 10);
  let expectedSourceRowIndex = 0;
  for (const [slotOffset, slot] of envelope.replaySlots.entries()) {
    assert.equal(slot.slotIndex, slotOffset + 1, `slot ${slotOffset} producer slot index drifted`);
    assert.equal(slot.rowCount, 100, `slot ${slot.slotIndex} row count drifted`);
    assert.equal(slot.sourceRowStartIndex, expectedSourceRowIndex);
    assert.equal(slot.sourceRowEndIndex, expectedSourceRowIndex + slot.rowCount - 1);
    for (const [slotRowIndex, row] of slot.rows.entries()) {
      assert.equal(row.slotRowIndex, slotRowIndex, `slot ${slot.slotIndex} row order drifted`);
      assert.equal(row.sourceRowIndex, expectedSourceRowIndex, `slot ${slot.slotIndex} source row order drifted`);
      assert.equal(row.userIdentity.deterministicUserKey, `${row.producerTruth.userId}|${row.producerTruth.userIndex}`);
      expectedSourceRowIndex += 1;
    }
  }
  assert.equal(expectedSourceRowIndex, 1000);
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
    assert.deepEqual(envelopeRow.producerTruth.timestamps, {
      slotIndex: sourceRow.slotIndex,
      timeSec: sourceRow.timeSec,
      decisionTimeSec: sourceRow.decisionTimeSec,
    });
    assert.deepEqual(envelopeRow.producerTruth.userPosition, sourceRow.userPosition);
    assert.deepEqual(envelopeRow.producerTruth.decisionUserPosition, sourceRow.decisionUserPosition);
    assert.deepEqual(envelopeRow.producerTruth.previousServing, sourceRow.previousServing);
    assert.deepEqual(envelopeRow.producerTruth.selectedServing, sourceRow.selectedServing);
    const actionTruth = envelopeRow.producerTruth.actionTruth;
    assert.equal(actionTruth.selectedServingBeamIndex, sourceRow.selectedServing.beamIndex);
    if (hasExplicitActionField(sourceRow)) {
      assert.equal(actionTruth.kind, 'explicit-source-action');
      if (actionTruth.kind !== 'explicit-source-action') {
        assert.fail(`row ${rowIndex} explicit source action was not preserved`);
      }
      assert.equal(actionTruth.sourceField, 'timeline/step-trace.jsonl.action');
      assert.equal(actionTruth.displayOnly, false);
      assert.deepEqual(actionTruth.action, sourceRow.action);
    } else {
      assert.equal(actionTruth.kind, 'selected-serving-display-identity-alias');
      if (actionTruth.kind !== 'selected-serving-display-identity-alias') {
        assert.fail(`row ${rowIndex} selected-serving alias was not marked display-only`);
      }
      assert.equal(actionTruth.sourceField, 'timeline/step-trace.jsonl.selectedServing.beamIndex');
      assert.equal(actionTruth.displayOnly, true);
    }
    assert.deepEqual(envelopeRow.producerTruth.candidateActionOrder, sourceRow.beamStates);
    assert.deepEqual(envelopeRow.producerTruth.visibilityMask, sourceRow.visibilityMask);
    assert.deepEqual(envelopeRow.producerTruth.actionValidityMask, sourceRow.actionValidityMask);
    assert.deepEqual(envelopeRow.producerTruth.decisionVisibilityMask, sourceRow.decisionVisibilityMask);
    assert.deepEqual(envelopeRow.producerTruth.decisionActionValidityMask, sourceRow.decisionActionValidityMask);
    assert.deepEqual(envelopeRow.producerTruth.beamLoads, sourceRow.beamLoads);
    assert.deepEqual(envelopeRow.producerTruth.beamThroughputs, sourceRow.beamThroughputs);
    assert.deepEqual(envelopeRow.producerTruth.rewardVector, sourceRow.rewardVector);
    assert.equal(envelopeRow.producerTruth.scalarReward, sourceRow.scalarReward);
    assert.deepEqual(envelopeRow.producerTruth.satelliteStates, sourceRow.satelliteStates);
    assert.deepEqual(envelopeRow.producerTruth.beamStates, sourceRow.beamStates);
    assert.deepEqual(envelopeRow.producerTruth.kpiOverlay, sourceRow.kpiOverlay);
    assert.deepEqual(envelopeRow.producerTruth.handoverEvent, sourceRow.handoverEvent);
    assert.deepEqual(envelopeRow.producerTruth.policyDiagnostics, sourceRow.policyDiagnostics);
    assert.deepEqual(envelopeRow.producerTruth.sourceRow, sourceRow);
    assert.equal(envelopeRow.selectedActionIdentity.selectedActionIndex, sourceRow.selectedServing.beamIndex);
    assert.equal(envelopeRow.handoverIdentity.producerEventKind, sourceRow.handoverEvent.kind);

    const sourceTopCandidates = sourceRow.policyDiagnostics?.topCandidates ?? [];
    const envelopeTopCandidates = envelopeRow.producerTruth.policyDiagnostics?.topCandidates ?? [];
    assert.deepEqual(
      envelopeTopCandidates.map(candidate => candidate.beamIndex),
      sourceTopCandidates.map(candidate => candidate.beamIndex),
      `row ${rowIndex} top candidate order drifted`,
    );
  }
}

function assertFailClosedBehavior(contents: ModqnReplayBundleContents): void {
  assert.throws(
    () => createModqnReplayBundleLoadPlan({ sourcePath: '/tmp/not-selected-modqn-phase7c-bundle' }),
    /selected path or explicit fixtureOnly=true/,
    'non-selected evidence path should fail closed unless fixture-only is explicit',
  );
  assert.throws(
    () => createModqnReplayBundleLoadPlan({ sourceOwner: 'leo-beam-sim' }),
    /sourceOwner/,
    'evidence-capable replay should not allow caller-overridden source ownership',
  );
  assert.throws(
    () => createModqnReplayEnvelopeFromContents({
      ...contents,
      manifestJson: '',
    }),
    /required surface manifest\.json/,
    'empty manifest surface should fail closed',
  );
  assert.throws(
    () => loadModqnReplayEnvelopeFromSurfaceReader(surface => {
      if (surface.relativePath === 'manifest.json') return undefined;
      return readSurfaceFromDisk(surface);
    }),
    /required surface manifest\.json/,
    'missing manifest surface should fail closed through adapter load path',
  );

  const mutatedManifest = JSON.parse(contents.manifestJson) as {
    baselineSurface: { beamCountPerSatellite: number };
  };
  mutatedManifest.baselineSurface.beamCountPerSatellite = 19;
  assert.throws(
    () => createModqnReplayEnvelopeFromContents({
      ...contents,
      manifestJson: JSON.stringify(mutatedManifest),
    }),
    /manifest\.baselineSurface\.beamCountPerSatellite/,
    '19-beam mutation should not emit evidence-capable output',
  );

  const fixtureEnvelope = createModqnReplayEnvelopeFromContents({
    ...contents,
    sourcePath: '/tmp/modqn-phase7c-fixture-only',
  }, {
    sourcePath: '/tmp/modqn-phase7c-fixture-only',
    fixtureOnly: true,
    sourceOwner: 'fixture',
  });
  assert.equal(fixtureEnvelope.evidenceStatus, MODQN_FIXTURE_ONLY_EVIDENCE_STATUS);
  assert.equal(fixtureEnvelope.modeKey, 'sensitivity-demo');
  assert.equal(fixtureEnvelope.claimBoundary.baselineModqnEvidence, false);
  assert.equal(fixtureEnvelope.claimBoundary.artifactStatus, 'fixture-only-non-evidence-not-producer-artifact');
  assert.equal(fixtureEnvelope.identityMap.beamBridges.length, 0);
  assert.equal(fixtureEnvelope.diagnostics.adapter.bridgeStatus, 'skipped-fixture-only-non-evidence');
}

function run(): void {
  ensureModqnCurrentBaselineExport();
  const loadPlan = createModqnReplayBundleLoadPlan();
  const contents = readBundleContentsFromPlan(loadPlan);
  const envelope = loadModqnReplayEnvelopeFromSurfaceReader(readSurfaceFromDisk);
  const envelopeRows = flattenRows(envelope);
  const explicitSourceActionRows = envelopeRows
    .filter(row => row.producerTruth.actionTruth.kind === 'explicit-source-action')
    .length;
  const selectedServingDisplayAliasRows = envelopeRows
    .filter(row => row.producerTruth.actionTruth.kind === 'selected-serving-display-identity-alias')
    .length;

  assertEnvelopeHeader(envelope);
  assertExpectedShape(envelope);
  assertIdentityBridge(envelope);
  assertSlotGrouping(envelope);
  assertProducerTruthPreserved(contents, envelope);
  assertFailClosedBehavior(contents);
  assertSerializable(envelope);

  console.log('MODQN Phase 7C replay state model validation passed.');
  console.log(JSON.stringify({
    bundlePath: envelope.sourcePath,
    modeKey: envelope.modeKey,
    modeLabel: envelope.modeLabel,
    evidenceStatus: envelope.evidenceStatus,
    sourceOwner: envelope.sourceOwner,
    replayEnvelope: {
      sourceSchemaVersion: envelope.sourceSchemaVersion,
      paperId: envelope.paperId,
      replaySlots: envelope.replaySlots.length,
      rows: envelope.diagnostics.adapter.rowCount,
      identityBridgeRecords: envelope.identityMap.beamBridges.length,
      userIdentities: envelope.identityMap.users.length,
      diagnosticsNamespaces: Object.keys(envelope.diagnostics),
    },
    actionTruth: {
      explicitSourceActionRows,
      selectedServingDisplayAliasRows,
      selectedActionIdentitySource: 'selectedServing.beamIndex display identity only when sourceRow.action is absent',
    },
    eventCounts: envelope.diagnostics.adapter.eventCounts,
    policyDiagnostics: envelope.diagnostics.producerPolicyDiagnostics,
    failClosed: {
      selectedPathRequired: true,
      requiredSurfaces: envelope.diagnostics.adapter.requiredSurfaces,
      fixtureOnlyStatus: MODQN_FIXTURE_ONLY_EVIDENCE_STATUS,
    },
    claimBoundary: {
      baselineModqnEvidence: envelope.claimBoundary.baselineModqnEvidence,
      artifactStatus: envelope.claimBoundary.artifactStatus,
      beamCountBoundary: envelope.claimBoundary.beamCountBoundary,
    },
    result: 'PASS',
  }, null, 2));
}

run();
