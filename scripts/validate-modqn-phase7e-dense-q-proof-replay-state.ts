#!/usr/bin/env node

// MODQN Phase 7E — Family-B dense-Q proof replay-state integration gate.
//
// Loads the REAL producer Family-B dense-Q window from disk (the dual-axis
// bundle: physical beamStates decoupled from the action catalog A) through the
// same loader/replay-state pipeline the dev server uses, and asserts:
//   * the new mode resolves its own identity / claim boundary (NOT baseline,
//     NOT paper-faithful, NOT a beats-baseline claim),
//   * the dual-axis shape validator accepts physical beamStates != catalog A,
//   * every row is dense-Q proof-ready with the original-weight argmax self-check
//     reproducing the producer's selected action,
//   * the playback model validates,
//   * the family-b path stays gated by modeKey (fail-closed negative controls).
//
// Parallel to phase7c (baseline). Unlike phase7c it does NOT regenerate the
// bundle (leo never trains Family-B); it requires the producer-exported bundle
// staged at MODQN_FAMILY_B_DENSE_Q_BUNDLE_PATH.

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MODQN_FAMILY_B_DENSE_Q_BUNDLE_PATH,
  MODQN_FAMILY_B_DENSE_Q_EVIDENCE_STATUS,
  MODQN_FAMILY_B_DENSE_Q_MODE_KEY,
  MODQN_FAMILY_B_DENSE_Q_MODE_LABEL,
  SELECTED_MODQN_PHASE7C_REPLAY_BUNDLE_PATH,
  buildModqnDenseQProofFromReplayRow,
  createModqnReplayBundleLoadPlan,
  createModqnReplayEnvelopeFromContents,
  createModqnReplayPlaybackShellModel,
  getModqnReplayPlaybackModelValidationIssue,
  isModqnDenseQProofReady,
  type ModqnReplayBundleContents,
  type ModqnReplayEnvelope,
} from '../src/modqn/replay-bundle/index.ts';

function loadFamilyBContents(): ModqnReplayBundleContents {
  const plan = createModqnReplayBundleLoadPlan({
    sourcePath: MODQN_FAMILY_B_DENSE_Q_BUNDLE_PATH,
    modeKey: MODQN_FAMILY_B_DENSE_Q_MODE_KEY,
  });
  assert.equal(
    plan.evidenceStatus,
    MODQN_FAMILY_B_DENSE_Q_EVIDENCE_STATUS,
    'load plan resolves the family-b dense-q evidence status',
  );
  assert.ok(
    existsSync(plan.sourcePath),
    `Family-B dense-Q bundle is not staged at ${plan.sourcePath}. `
      + `Stage it: ln -sfn <producer artifacts>/dense-q-proof-window-600-130 ${plan.sourcePath}`,
  );

  const surfaceTexts = new Map<string, string>();
  for (const surface of plan.requiredSurfaces) {
    assert.ok(
      existsSync(surface.absolutePath),
      `required Phase 7E surface is missing: ${surface.relativePath} at ${surface.absolutePath}`,
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

function run(): void {
  const contents = loadFamilyBContents();
  const envelope: ModqnReplayEnvelope = createModqnReplayEnvelopeFromContents(contents, {
    sourcePath: MODQN_FAMILY_B_DENSE_Q_BUNDLE_PATH,
    modeKey: MODQN_FAMILY_B_DENSE_Q_MODE_KEY,
  });

  // --- envelope identity (its OWN mode, not baseline / user-trained) ---
  assert.equal(envelope.modeKey, MODQN_FAMILY_B_DENSE_Q_MODE_KEY);
  assert.equal(envelope.modeLabel, MODQN_FAMILY_B_DENSE_Q_MODE_LABEL);
  assert.equal(envelope.evidenceStatus, MODQN_FAMILY_B_DENSE_Q_EVIDENCE_STATUS);
  assert.equal(envelope.sourceOwner, 'modqn-paper-reproduction');
  assert.equal(envelope.sourcePath, MODQN_FAMILY_B_DENSE_Q_BUNDLE_PATH);

  // --- claim boundary honesty ---
  assert.equal(envelope.claimBoundary.baselineModqnEvidence, false, 'family-b is NOT baseline MODQN evidence');
  assert.equal(envelope.claimBoundary.acceptedEvidenceShape, 'family-b-dense-q-proof-window');
  assert.equal(envelope.claimBoundary.artifactStatus, 'family-b-dense-q-window');
  assert.equal(envelope.diagnostics.adapter.bridgeStatus, 'skipped-family-b-dense-q-window');
  const allowed = envelope.claimBoundary.allowedClaims.join('\n');
  assert.match(allowed, /non-paper-faithful/, 'family-b allowed claims state non-paper-faithful');
  assert.match(allowed, /NOT a beats-baseline claim/, 'family-b allowed claims disclaim beats-baseline');
  const forbidden = envelope.claimBoundary.forbiddenClaims.join('\n');
  assert.match(forbidden, /No full paper-faithful reproduction claim\./);
  assert.match(forbidden, /No 19-beam or 37-beam trained baseline MODQN evidence claim\./);

  // --- dual-axis at the real-data level: physical beamStates exceed catalog A ---
  const totalBeamCount = envelope.diagnostics.adapter.totalBeamCount;
  const firstRow = envelope.replaySlots[0]?.rows[0];
  assert.ok(firstRow, 'family-b envelope has at least one row');
  const beamStatesLen = firstRow.producerTruth.beamStates.length;
  const catalogLen = firstRow.producerTruth.policyDiagnostics?.candidateActionOrder?.length ?? 0;
  assert.ok(
    beamStatesLen > totalBeamCount,
    `dual-axis: physical beamStates (${beamStatesLen}) must exceed the action catalog A (${totalBeamCount})`,
  );
  assert.equal(catalogLen, totalBeamCount, 'dense action catalog length equals totalBeamCount A');
  assert.equal(
    firstRow.producerTruth.decisionActionValidityMask.length,
    totalBeamCount,
    'decision mask is catalog-axis (A), not the physical beam axis',
  );

  // --- dense-Q proof-ready for EVERY row (the G3 "MODQN is wired" payoff) ---
  const rows = envelope.replaySlots.flatMap(slot => slot.rows);
  let proofReadyRows = 0;
  for (const [index, row] of rows.entries()) {
    const proof = buildModqnDenseQProofFromReplayRow(row);
    if (!isModqnDenseQProofReady(proof)) {
      const detail = proof.status === 'source-gap' ? proof.reasons.join('; ') : 'unknown';
      throw new Error(`row ${index} dense-Q proof is not ready: ${detail}`);
    }
    assert.equal(proof.selfCheck.status, 'passed', `row ${index} original-weight self-check passed`);
    assert.equal(
      proof.recomputedSelectedActionIndex,
      proof.selectedActionIndex,
      `row ${index} original-weight argmax reproduces the producer selected action`,
    );
    assert.equal(proof.actionCount, totalBeamCount, `row ${index} action count equals the catalog A`);
    proofReadyRows += 1;
  }
  assert.equal(proofReadyRows, rows.length, 'every Family-B row is dense-Q proof-ready');

  // --- playback model accepts the family-b shell ---
  const shell = createModqnReplayPlaybackShellModel(envelope);
  const issue = getModqnReplayPlaybackModelValidationIssue(shell);
  assert.equal(issue, null, `family-b playback model is valid (${issue?.code ?? 'ok'}: ${issue?.message ?? ''})`);
  assert.equal(shell.modeKey, MODQN_FAMILY_B_DENSE_Q_MODE_KEY);
  assert.equal(shell.diagnosticsStatus, 'present-from-producer');

  // --- fail-closed negative controls (the family-b path is gated by modeKey) ---
  assert.throws(
    () => createModqnReplayBundleLoadPlan({ sourcePath: MODQN_FAMILY_B_DENSE_Q_BUNDLE_PATH }),
    /fail-closed/,
    'without the family-b modeKey the bundle path is rejected by the selected-path fail-closed assert',
  );
  assert.throws(
    () => createModqnReplayBundleLoadPlan({
      sourcePath: SELECTED_MODQN_PHASE7C_REPLAY_BUNDLE_PATH,
      modeKey: MODQN_FAMILY_B_DENSE_Q_MODE_KEY,
    }),
    /fail-closed/,
    'family-b mode requires the family-b bundle path (rejects the baseline selected path)',
  );

  console.log('MODQN Phase 7E Family-B dense-Q replay-state validation passed.');
  console.log(JSON.stringify({
    bundlePath: envelope.sourcePath,
    modeKey: envelope.modeKey,
    modeLabel: envelope.modeLabel,
    evidenceStatus: envelope.evidenceStatus,
    totalBeamCountCatalogA: totalBeamCount,
    physicalBeamStates: beamStatesLen,
    denseCatalog: catalogLen,
    rows: rows.length,
    slots: envelope.replaySlots.length,
    denseQProofReadyRows: proofReadyRows,
    handoverEventCounts: envelope.diagnostics.adapter.eventCounts,
    bridgeStatus: envelope.diagnostics.adapter.bridgeStatus,
    acceptedEvidenceShape: envelope.claimBoundary.acceptedEvidenceShape,
    artifactStatus: envelope.claimBoundary.artifactStatus,
    result: 'PASS',
  }, null, 2));
}

run();
