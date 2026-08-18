import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { loadTleSnapshotSelection, loadTleWebArchiveCatalog } from '../../simulator/archive';
import { buildTleAnalysisRun } from '../../simulator/tleAnalysisRun';
import { DEFAULT_SIMULATOR_PARAMETERS, type SimulatorConstellation } from '../../simulator/types';
import {
  buildTleRunBundle,
  TLE_RUN_APPROVED_CANDIDATE_POOL_OPTIONS,
  TLE_RUN_STAGED_CANDIDATE_POOL_OPTIONS,
  TLE_RUN_ANCHOR_COUNT,
  type TleRunBundle,
} from './index';

const fetchFromPublic = async (path: RequestInfo | URL): Promise<Response> => (
  new Response(await readFile(`public${String(path)}`), { status: 200 })
);

const requestedInstantUtc = process.env.PARITY_INSTANT ?? '2026-08-12T12:00:00.000Z';
const coarseSafetyMarginDeg = Number(process.env.PARITY_MARGIN ?? TLE_RUN_APPROVED_CANDIDATE_POOL_OPTIONS.safetyMarginDeg);
const candidatePoolMode = process.env.PARITY_MODE === 'legacy'
  ? 'coarse-to-fine'
  : TLE_RUN_APPROVED_CANDIDATE_POOL_OPTIONS.mode;
const coarseStepS = Number(process.env.PARITY_COARSE_STEP ?? (
  candidatePoolMode === 'staged-coarse-to-fine'
    ? TLE_RUN_STAGED_CANDIDATE_POOL_OPTIONS.coarseStepS
    : 120
));
const coarseGuardWindowS = Number(process.env.PARITY_COARSE_GUARD ?? (
  candidatePoolMode === 'staged-coarse-to-fine'
    ? TLE_RUN_STAGED_CANDIDATE_POOL_OPTIONS.guardWindowS
    : 120
));
const requestedConstellations: readonly SimulatorConstellation[] = process.env.PARITY_CONSTELLATION === undefined
  ? ['oneweb', 'starlink']
  : [process.env.PARITY_CONSTELLATION as SimulatorConstellation];

function compareRunSemantics(
  constellation: SimulatorConstellation,
  fullRun: TleRunBundle,
  coarseRun: TleRunBundle,
): void {
  const fullAnalysis = buildTleAnalysisRun({
    selection: fullSelectionByConstellation.get(constellation)!,
    geometryRun: fullRun,
    parameters: DEFAULT_SIMULATOR_PARAMETERS,
  });
  const coarseAnalysis = buildTleAnalysisRun({
    selection: fullSelectionByConstellation.get(constellation)!,
    geometryRun: coarseRun,
    parameters: DEFAULT_SIMULATOR_PARAMETERS,
  });

  assert.equal(fullAnalysis.anchorCount, TLE_RUN_ANCHOR_COUNT);
  assert.equal(coarseAnalysis.anchorCount, TLE_RUN_ANCHOR_COUNT);
  for (let anchorIndex = 0; anchorIndex < TLE_RUN_ANCHOR_COUNT; anchorIndex += 1) {
    const fullSelection = fullAnalysis.anchorSelections[anchorIndex]!;
    const coarseSelection = coarseAnalysis.anchorSelections[anchorIndex]!;
    const fullServiceAnchor = fullAnalysis.passPlan.serviceAnchors[anchorIndex]!;
    const coarseServiceAnchor = coarseAnalysis.passPlan.serviceAnchors[anchorIndex]!;
    assert.deepEqual(
      {
        anchorIndex: coarseServiceAnchor.anchorIndex,
        servingPassId: coarseServiceAnchor.servingPassId,
        candidatePassId: coarseServiceAnchor.candidatePassId,
      },
      {
        anchorIndex: fullServiceAnchor.anchorIndex,
        servingPassId: fullServiceAnchor.servingPassId,
        candidatePassId: fullServiceAnchor.candidatePassId,
      },
      `${constellation}: pass-plan service identity mismatch at ${anchorIndex}`,
    );
    assert.deepEqual(
      {
        selectedSatelliteId: coarseSelection.selectedSatelliteId,
        candidateSatelliteId: coarseSelection.candidateSatelliteId,
        servingPassId: coarseSelection.servingPassId,
        candidatePassId: coarseSelection.candidatePassId,
        selectionKind: coarseSelection.selectionKind,
      },
      {
        selectedSatelliteId: fullSelection.selectedSatelliteId,
        candidateSatelliteId: fullSelection.candidateSatelliteId,
        servingPassId: fullSelection.servingPassId,
        candidatePassId: fullSelection.candidatePassId,
        selectionKind: fullSelection.selectionKind,
      },
      `${constellation}: anchor selection mismatch at ${anchorIndex}`,
    );

    const fullTrace = fullAnalysis.handoverTrace.anchors[anchorIndex]!;
    const coarseTrace = coarseAnalysis.handoverTrace.anchors[anchorIndex]!;
    assert.deepEqual(
      {
        anchorIndex: coarseTrace.anchorIndex,
        instantUtc: coarseTrace.instantUtc,
        servingSatelliteId: coarseTrace.servingSatelliteId,
        candidateSatelliteId: coarseTrace.candidateSatelliteId,
        event: coarseTrace.event,
        state: coarseTrace.state,
        eventFromSatelliteId: coarseTrace.eventFromSatelliteId,
        eventToSatelliteId: coarseTrace.eventToSatelliteId,
      },
      {
        anchorIndex: fullTrace.anchorIndex,
        instantUtc: fullTrace.instantUtc,
        servingSatelliteId: fullTrace.servingSatelliteId,
        candidateSatelliteId: fullTrace.candidateSatelliteId,
        event: fullTrace.event,
        state: fullTrace.state,
        eventFromSatelliteId: fullTrace.eventFromSatelliteId,
        eventToSatelliteId: fullTrace.eventToSatelliteId,
      },
      `${constellation}: handover mismatch at ${anchorIndex}`,
    );

    const fullFrame = fullAnalysis.getFrame(anchorIndex);
    const coarseFrame = coarseAnalysis.getFrame(anchorIndex);
    assert.ok(fullFrame, `${constellation}: full frame missing at ${anchorIndex}`);
    assert.ok(coarseFrame, `${constellation}: coarse frame missing at ${anchorIndex}`);
    assert.equal(coarseFrame?.selectedSatelliteId, fullFrame?.selectedSatelliteId, `${constellation}: serving result mismatch at ${anchorIndex}`);
    assert.equal(coarseFrame?.links[0]?.satelliteId, fullFrame?.links[0]?.satelliteId, `${constellation}: service link mismatch at ${anchorIndex}`);
    assert.deepEqual(coarseFrame?.canonical, fullFrame?.canonical, `${constellation}: canonical service result mismatch at ${anchorIndex}`);
    assert.deepEqual(coarseFrame?.power, fullFrame?.power, `${constellation}: power service result mismatch at ${anchorIndex}`);
    assert.deepEqual(coarseFrame?.throughput, fullFrame?.throughput, `${constellation}: throughput service result mismatch at ${anchorIndex}`);
    assert.deepEqual(coarseFrame?.ee, fullFrame?.ee, `${constellation}: EE service result mismatch at ${anchorIndex}`);
  }
}

const fullSelectionByConstellation = new Map<SimulatorConstellation, Awaited<ReturnType<typeof loadTleSnapshotSelection>>>();

for (const constellation of requestedConstellations) {
  const catalog = await loadTleWebArchiveCatalog(`/tle-archive/${constellation}/catalog.json`, fetchFromPublic);
  const selection = await loadTleSnapshotSelection(catalog, requestedInstantUtc, fetchFromPublic);
  fullSelectionByConstellation.set(constellation, selection);

  const fullStartedAt = performance.now();
  const fullRun = await buildTleRunBundle({
    selection,
    t0Utc: requestedInstantUtc,
    candidatePool: { mode: 'full-reference' },
    yieldEveryAnchors: TLE_RUN_ANCHOR_COUNT,
  });
  const fullWallTimeMs = performance.now() - fullStartedAt;

  const coarseStartedAt = performance.now();
  const coarseRun = await buildTleRunBundle({
    selection,
    t0Utc: requestedInstantUtc,
    candidatePool: {
      mode: candidatePoolMode,
      coarseStepS,
      safetyMarginDeg: coarseSafetyMarginDeg,
      guardWindowS: coarseGuardWindowS,
      ...(candidatePoolMode === 'staged-coarse-to-fine' ? { visibilityScreenStepS: TLE_RUN_STAGED_CANDIDATE_POOL_OPTIONS.visibilityScreenStepS } : {}),
    },
    yieldEveryAnchors: TLE_RUN_ANCHOR_COUNT,
  });
  const coarseWallTimeMs = performance.now() - coarseStartedAt;

  compareRunSemantics(constellation, fullRun, coarseRun);
  assert.equal(fullRun.computationMetrics.mode, 'full-reference');
  assert.equal(coarseRun.computationMetrics.mode, candidatePoolMode);
  assert.equal(coarseRun.computationMetrics.inputRecords, fullRun.computationMetrics.inputRecords);
  console.log(JSON.stringify({
    constellation,
    inputRecords: coarseRun.computationMetrics.inputRecords,
    coarseAnchors: coarseRun.computationMetrics.coarseAnchorCount,
    coarseSamples: coarseRun.computationMetrics.coarseSamples,
    fineCandidates: coarseRun.computationMetrics.fineCandidateCount,
    fineSamples: coarseRun.computationMetrics.fineSamples,
    visibilityScreenSamples: coarseRun.computationMetrics.visibilityScreenSamples,
    visibilityScreenCandidates: coarseRun.computationMetrics.visibilityScreenCandidateCount,
    workingSatelliteCount: coarseRun.computationMetrics.workingSatelliteCount,
    finalSatelliteCount: coarseRun.satelliteCount,
    fullSamples: fullRun.computationMetrics.totalSamples,
    coarseToFineSamples: coarseRun.computationMetrics.totalSamples,
    reductionRatio: coarseRun.computationMetrics.reductionRatio,
    fullWallTimeMs: Math.round(fullWallTimeMs),
    coarseToFineWallTimeMs: Math.round(coarseWallTimeMs),
    peakArrayBytes: coarseRun.computationMetrics.workingSatelliteCount * TLE_RUN_ANCHOR_COUNT * 3 * Float64Array.BYTES_PER_ELEMENT * 2,
    publishedArrayBytes: coarseRun.satelliteCount * TLE_RUN_ANCHOR_COUNT * 3 * Float64Array.BYTES_PER_ELEMENT * 2,
  }));
  assert.ok(coarseRun.computationMetrics.fineCandidateCount <= fullRun.computationMetrics.fineCandidateCount);
  assert.ok(coarseRun.computationMetrics.totalSamples < fullRun.computationMetrics.totalSamples, `${constellation}: candidate pool did not reduce samples`);
  assert.ok(coarseRun.computationMetrics.reductionRatio > 0, `${constellation}: candidate pool reduction ratio is not positive`);

}

console.log('TLE coarse-to-fine candidate-pool parity passed');
