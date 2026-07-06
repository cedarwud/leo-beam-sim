import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MODQN_BEAM_CATALOG_ORDER,
  MODQN_PAPER_ID,
  MODQN_REPLAY_BUNDLE_SCHEMA_VERSION,
  MODQN_BASELINE_BEAMS_PER_SATELLITE,
  MODQN_BEAM_COUNT_CLAIM_LABELS,
  MODQN_PRODUCER_BASELINE_RUN_PATH,
  MODQN_TOTAL_BASELINE_BEAMS,
  SELECTED_MODQN_PHASE7C_REPLAY_BUNDLE_PATH,
  SUPPORTED_MODQN_HANDOVER_EVENT_KINDS,
  adaptModqnHandoverEvent,
  createBeamCatalogByProducerId,
  createBeamIdentity,
  createSelectedActionIdentity,
  createUserIdentity,
  deriveProducerBeamId,
  deriveProducerBeamIndex,
  parseModqnReplayBundle,
  type ModqnBeamReference,
  type ModqnHandoverEventKind,
} from '../src/modqn/replay-bundle/index.ts';
import { ensureModqnCurrentBaselineExport } from './support/modqn-current-baseline-export.ts';
import { skipIfDataUnavailable } from './lib/ci-data-guard.ts';

const EXPECTED_TIMELINE_ROWS = 1000;

// CI-environment guard (P2 SN-3c): the default staged bundle is /tmp-ephemeral and
// self-heals from the producer repo via ensureModqnCurrentBaselineExport(); an
// explicit argv[2] bundle path is never guarded. Skip (visibly, exit 0 + marker)
// only when the staging AND the producer baseline run are BOTH absent — the
// hosted-CI signature. See scripts/lib/ci-data-guard.ts for the SKIP semantics.
if (process.argv[2] === undefined) {
  skipIfDataUnavailable([{
    path: join(SELECTED_MODQN_PHASE7C_REPLAY_BUNDLE_PATH, 'manifest.json'),
    why: 'staged baseline pilot02 replay bundle — /tmp staging; self-heals from the producer repo when present',
    regenerableFrom: MODQN_PRODUCER_BASELINE_RUN_PATH,
  }]);
}

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

function assertArrayLength(actual: readonly unknown[], expected: number, label: string): void {
  assert.equal(actual.length, expected, `${label} length drifted`);
}

function assertReferenceInCatalog(
  ref: ModqnBeamReference,
  catalog: ReadonlyMap<string, ModqnBeamReference>,
  label: string,
): void {
  const beam = catalog.get(ref.beamId);
  assert.ok(beam, `${label} ${ref.beamId} is missing from beamStates`);
  assert.equal(beam.satId, ref.satId, `${label} satId drifted`);
  assert.equal(beam.satIndex, ref.satIndex, `${label} satIndex drifted`);
  assert.equal(beam.localBeamIndex, ref.localBeamIndex, `${label} localBeamIndex drifted`);
  assert.equal(beam.beamIndex, ref.beamIndex, `${label} beamIndex drifted`);
}

function sortedKeys(value: Readonly<Record<string, unknown>>): readonly string[] {
  return Object.keys(value).sort();
}

function run(): void {
  ensureModqnCurrentBaselineExport();
  const bundlePath = process.argv[2] ?? SELECTED_MODQN_PHASE7C_REPLAY_BUNDLE_PATH;
  const bundle = readBundleFromPath(bundlePath);

  assert.equal(bundle.manifest.bundleSchemaVersion, MODQN_REPLAY_BUNDLE_SCHEMA_VERSION);
  assert.equal(bundle.manifest.paperId, MODQN_PAPER_ID);
  assert.equal(bundle.manifest.baselineSurface.beamCountPerSatellite, MODQN_BASELINE_BEAMS_PER_SATELLITE);
  assert.equal(bundle.manifest.baselineSurface.totalBeamCount, MODQN_TOTAL_BASELINE_BEAMS);
  assert.equal(bundle.manifest.baselineSurface.episodesCompleted, 200);
  assert.equal(bundle.manifest.claimBoundary.notFullPaperFaithfulReproduction, true);
  assert.equal(bundle.manifest.claimBoundary.not19Or37BeamTrainedEvidence, true);
  assert.equal(bundle.provenanceMap.bundleSchemaVersion, MODQN_REPLAY_BUNDLE_SCHEMA_VERSION);

  assert.ok(bundle.timelineRows.length > 0, 'timeline/step-trace.jsonl is empty');
  assert.equal(bundle.timelineRows.length, EXPECTED_TIMELINE_ROWS);

  const eventCounts = new Map<ModqnHandoverEventKind, number>();
  const rewardKeySignatures = new Set<string>();
  let rowsWithDiagnostics = 0;
  let rowsWithoutDiagnostics = 0;
  let selectedActionValidRows = 0;
  let selectedTopCandidateRows = 0;

  for (const [rowIndex, row] of bundle.timelineRows.entries()) {
    const rowLabel = `timeline row ${rowIndex + 1}`;
    const rowBeforeAdapter = JSON.stringify(row);

    assert.equal(row.beamCatalogOrder, MODQN_BEAM_CATALOG_ORDER, `${rowLabel} beamCatalogOrder drifted`);
    assertArrayLength(row.beamStates, MODQN_TOTAL_BASELINE_BEAMS, `${rowLabel} beamStates`);
    assertArrayLength(row.visibilityMask, MODQN_TOTAL_BASELINE_BEAMS, `${rowLabel} visibilityMask`);
    assertArrayLength(row.actionValidityMask, MODQN_TOTAL_BASELINE_BEAMS, `${rowLabel} actionValidityMask`);
    assertArrayLength(row.decisionVisibilityMask, MODQN_TOTAL_BASELINE_BEAMS, `${rowLabel} decisionVisibilityMask`);
    assertArrayLength(row.decisionActionValidityMask, MODQN_TOTAL_BASELINE_BEAMS, `${rowLabel} decisionActionValidityMask`);
    assertArrayLength(row.beamLoads, MODQN_TOTAL_BASELINE_BEAMS, `${rowLabel} beamLoads`);
    assertArrayLength(row.beamThroughputs, MODQN_TOTAL_BASELINE_BEAMS, `${rowLabel} beamThroughputs`);

    const catalog = createBeamCatalogByProducerId(row.beamStates);
    assert.equal(catalog.size, MODQN_TOTAL_BASELINE_BEAMS, `${rowLabel} beam catalog has duplicate IDs`);

    for (const beam of row.beamStates) {
      const identity = createBeamIdentity(beam, MODQN_BASELINE_BEAMS_PER_SATELLITE);
      assert.equal(identity.producerBeamId, deriveProducerBeamId(beam.satId, beam.localBeamIndex));
      assert.equal(
        identity.producerBeamIndex,
        deriveProducerBeamIndex(beam.satIndex, beam.localBeamIndex, MODQN_BASELINE_BEAMS_PER_SATELLITE),
      );
      assert.equal(identity.producerLocalBeamIndex, beam.localBeamIndex);
      assert.equal(identity.leoLocalBeamNumericId, beam.localBeamIndex + 1);
      assert.equal(identity.leoGlobalBeamNumericId, beam.beamIndex + 1);
    }

    assertReferenceInCatalog(row.previousServing, catalog, `${rowLabel} previousServing`);
    assertReferenceInCatalog(row.selectedServing, catalog, `${rowLabel} selectedServing`);

    const userIdentity = createUserIdentity(row.userId, row.userIndex);
    assert.equal(userIdentity.producerUserId, row.userId);
    assert.equal(userIdentity.deterministicUserKey, `${row.userId}|${row.userIndex}`);

    const selectedAction = createSelectedActionIdentity(row);
    assert.equal(selectedAction.selectedActionIndex, row.selectedServing.beamIndex, `${rowLabel} selected action index drifted`);
    assert.equal(selectedAction.selectedProducerBeamId, row.selectedServing.beamId, `${rowLabel} selected beam ID drifted`);
    assert.equal(selectedAction.decisionActionValid, row.selectedServing.validUnderDecisionMask, `${rowLabel} decision mask drifted`);
    assert.equal(selectedAction.postStepActionValid, row.selectedServing.validUnderPostStepMask, `${rowLabel} post-step mask drifted`);
    assert.equal(row.decisionActionValidityMask[selectedAction.selectedActionIndex], row.selectedServing.validUnderDecisionMask);
    assert.equal(row.actionValidityMask[selectedAction.selectedActionIndex], row.selectedServing.validUnderPostStepMask);
    if (selectedAction.decisionActionValid && selectedAction.postStepActionValid) selectedActionValidRows += 1;

    const eventIdentity = adaptModqnHandoverEvent(row.handoverEvent, row.previousServing, row.selectedServing);
    eventCounts.set(row.handoverEvent.kind, (eventCounts.get(row.handoverEvent.kind) ?? 0) + 1);
    if (row.handoverEvent.kind === 'intra-satellite-beam-switch') {
      assert.equal(eventIdentity.semanticKind, 'intra-satellite-beam-handover');
      assert.equal(eventIdentity.leoHandoverAction, 'intra-switch');
    }
    if (row.handoverEvent.kind === 'none') {
      assert.equal(eventIdentity.semanticKind, 'no-event');
      assert.equal(eventIdentity.leoHandoverAction, 'stay');
    }

    rewardKeySignatures.add(sortedKeys(row.rewardVector).join('|'));
    assert.equal(typeof row.scalarReward, 'number', `${rowLabel} scalarReward type drifted`);

    if (Object.prototype.hasOwnProperty.call(row, 'policyDiagnostics')) {
      rowsWithDiagnostics += 1;
      assert.ok(row.policyDiagnostics, `${rowLabel} policyDiagnostics exists but is not readable`);
      if (row.policyDiagnostics.topCandidates !== undefined) {
        const [topCandidate] = row.policyDiagnostics.topCandidates;
        if (topCandidate !== undefined) {
          selectedTopCandidateRows += topCandidate.beamIndex === row.selectedServing.beamIndex ? 1 : 0;
          assertReferenceInCatalog(topCandidate, catalog, `${rowLabel} policyDiagnostics.topCandidates[0]`);
        }
      }
    } else {
      rowsWithoutDiagnostics += 1;
      assert.equal(row.policyDiagnostics, undefined, `${rowLabel} invented policyDiagnostics`);
    }

    assert.equal(JSON.stringify(row), rowBeforeAdapter, `${rowLabel} was mutated by identity adapter helpers`);
  }

  assert.deepEqual(SUPPORTED_MODQN_HANDOVER_EVENT_KINDS, [
    'none',
    'intra-satellite-beam-switch',
    'inter-satellite-handover',
  ]);

  const syntheticInterEvent = adaptModqnHandoverEvent(
    { kind: 'inter-satellite-handover', eventId: 'adapter-support-check' },
    {
      beamId: 'sat-0-beam-1',
      beamIndex: 1,
      satId: 'sat-0',
      satIndex: 0,
      localBeamIndex: 1,
    },
    {
      beamId: 'sat-1-beam-2',
      beamIndex: 9,
      satId: 'sat-1',
      satIndex: 1,
      localBeamIndex: 2,
    },
  );
  assert.equal(syntheticInterEvent.semanticKind, 'inter-satellite-handover');
  assert.equal(syntheticInterEvent.leoHandoverAction, 'inter-handover');

  for (const beamCount of [19, 37] as const) {
    assert.equal(
      /baseline/i.test(MODQN_BEAM_COUNT_CLAIM_LABELS[beamCount]),
      false,
      `${beamCount}-beam adapter label leaked a baseline claim`,
    );
    assert.match(MODQN_BEAM_COUNT_CLAIM_LABELS[beamCount], /sensitivity\/demo extension only/);
  }

  assert.deepEqual([...rewardKeySignatures], ['r1Throughput|r2Handover|r3LoadBalance']);
  assert.equal(rowsWithDiagnostics, 1000);
  assert.equal(rowsWithoutDiagnostics, 0);
  assert.equal(selectedActionValidRows, EXPECTED_TIMELINE_ROWS);
  assert.equal(selectedTopCandidateRows, EXPECTED_TIMELINE_ROWS);

  const interSatelliteRows = eventCounts.get('inter-satellite-handover') ?? 0;
  assert.equal(interSatelliteRows, 0, 'selected artifact unexpectedly contains inter-satellite handover rows');

  console.log('MODQN Phase 2 identity adapter validation passed.');
  console.log(JSON.stringify({
    bundlePath,
    schema: bundle.manifest.bundleSchemaVersion,
    paperId: bundle.manifest.paperId,
    beamCountPerSatellite: bundle.manifest.baselineSurface.beamCountPerSatellite,
    totalBeamCount: bundle.manifest.baselineSurface.totalBeamCount,
    timelineRows: bundle.timelineRows.length,
    eventCounts: Object.fromEntries(eventCounts),
    interSatelliteHandoverRows: interSatelliteRows,
    interSatelliteSupport: 'supported by adapter type and mapping; not observed in selected artifact',
    rewardVectorKeys: [...rewardKeySignatures],
    diagnostics: {
      rowsWithDiagnostics,
      rowsWithoutDiagnostics,
      inventedDiagnostics: 0,
    },
    identity: {
      beamIndexing: '0-based global satellite-major / beam-minor',
      localBeamIndexing: '0-based per satellite',
      leoNumericIds: 'derived separately as 1-based local/global visual IDs',
      selectedActionIndex: 'selectedServing.beamIndex',
    },
    claimBoundary: {
      notFullPaperFaithfulReproduction: bundle.manifest.claimBoundary.notFullPaperFaithfulReproduction,
      not19Or37BeamTrainedEvidence: bundle.manifest.claimBoundary.not19Or37BeamTrainedEvidence,
      nineteenAndThirtySeven: [MODQN_BEAM_COUNT_CLAIM_LABELS[19], MODQN_BEAM_COUNT_CLAIM_LABELS[37]],
    },
    result: 'PASS',
  }, null, 2));
}

run();
