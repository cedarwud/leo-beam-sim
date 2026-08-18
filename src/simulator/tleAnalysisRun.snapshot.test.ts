import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { loadTleSnapshotSelection, loadTleWebArchiveCatalog } from './archive';
import { DEFAULT_SIMULATOR_PARAMETERS } from './types';
import { buildTleRunBundle } from '../tle/run';
import {
  buildTleAnalysisRun,
  createTleAnalysisRunSnapshot,
  hydrateTleAnalysisRunSnapshot,
  TleAnalysisRunSnapshotError,
} from './tleAnalysisRun';

const fetchFromPublic = async (path: RequestInfo | URL): Promise<Response> => (
  new Response(await readFile(`public${String(path)}`), { status: 200 })
);

const catalog = await loadTleWebArchiveCatalog('/tle-archive/oneweb/catalog.json', fetchFromPublic);
const requestedInstantUtc = '2026-08-07T23:59:59.000Z';
const selection = await loadTleSnapshotSelection(catalog, requestedInstantUtc, fetchFromPublic);
const geometryRun = await buildTleRunBundle({ selection, t0Utc: requestedInstantUtc, yieldEveryAnchors: 241 });
const source = buildTleAnalysisRun({
  selection,
  geometryRun,
  parameters: DEFAULT_SIMULATOR_PARAMETERS,
});

const sourceCandidateAnchor = source.anchorSelections.find(anchor => anchor.candidateSatelliteId !== null);
assert.ok(sourceCandidateAnchor);
const sourceCandidateId = sourceCandidateAnchor.candidateSatelliteId!;
const heterogeneousSource = source.withFrameOptions({
  beamLayoutCount: 19,
  perSatelliteBeamLayoutCount: { [sourceCandidateId]: 1 },
  representativeUserIndex: 50,
});
const heterogeneousSnapshot = createTleAnalysisRunSnapshot(heterogeneousSource);
const heterogeneousHydrated = hydrateTleAnalysisRunSnapshot(heterogeneousSnapshot);
assert.deepEqual(heterogeneousHydrated.frameOptions, heterogeneousSource.frameOptions);
assert.equal(heterogeneousHydrated.getFrame(sourceCandidateAnchor.anchorIndex)?.scenario.beamLayout.beamCount, 19);
assert.equal(heterogeneousHydrated.getFrame(sourceCandidateAnchor.anchorIndex)?.candidateScenario?.beamLayout.beamCount, 1);
assert.equal(
  heterogeneousHydrated.getFrame(sourceCandidateAnchor.anchorIndex)?.scenario.ueSubstrateId,
  heterogeneousHydrated.getFrame(sourceCandidateAnchor.anchorIndex)?.candidateScenario?.ueSubstrateId,
);

const snapshot = createTleAnalysisRunSnapshot(source);
assert.equal(snapshot.schema, 'tle-analysis-run-snapshot-v1');
assert.equal(snapshot.frames, undefined, 'production snapshots must not repeat the full constellation per anchor');
const hydrated = hydrateTleAnalysisRunSnapshot(snapshot);
assert.equal(hydrated.analysisRunId, source.analysisRunId);
assert.equal(hydrated.geometryRunId, source.geometryRunId);
assert.notEqual(hydrated.geometryRun, geometryRun, 'hydration owns a data-only geometry instance, not the producer closure');
assert.equal(hydrated.passPlan.policyRevision, source.passPlan.policyRevision);
assert.deepEqual(hydrated.evaluation, source.evaluation);
assert.deepEqual(hydrated.anchorSelections, source.anchorSelections);
assert.deepEqual(hydrated.handoverTrace, source.handoverTrace);
for (const anchorIndex of [0, 1, 240]) {
  const sourceFrame = source.getFrame(anchorIndex);
  const hydratedFrame = hydrated.getFrame(anchorIndex);
  assert.ok(sourceFrame);
  assert.ok(hydratedFrame);
  assert.equal(hydratedFrame?.frameId, sourceFrame?.frameId);
  assert.equal(hydratedFrame?.tleFrameId, sourceFrame?.tleFrameId);
  assert.equal(hydratedFrame?.selectedSatelliteId, sourceFrame?.selectedSatelliteId);
  assert.equal(hydratedFrame?.runAnchor?.anchorIndex, anchorIndex);
  assert.deepEqual(hydratedFrame?.canonical, sourceFrame?.canonical);
  assert.deepEqual(hydratedFrame?.power, sourceFrame?.power);
  assert.deepEqual(hydratedFrame?.throughput, sourceFrame?.throughput);
  assert.deepEqual(hydratedFrame?.ee, sourceFrame?.ee);
  assert.deepEqual(hydratedFrame?.handover, sourceFrame?.handover);
}

const changed = hydrated.withParameters({
  ...DEFAULT_SIMULATOR_PARAMETERS,
  beamPowerCapW: DEFAULT_SIMULATOR_PARAMETERS.beamPowerCapW * 0.9,
});
assert.equal(changed.geometryRun.runId, hydrated.geometryRun.runId, 'parameter rebuild must retain hydrated geometry identity');
assert.equal(changed.passPlan, hydrated.passPlan, 'parameter rebuild must retain hydrated pass-plan identity');

const wrongIdentity = {
  ...snapshot,
  sourceIdentity: { ...snapshot.sourceIdentity, publicationSha256: 'd'.repeat(64) },
};
assert.throws(
  () => hydrateTleAnalysisRunSnapshot(wrongIdentity),
  error => error instanceof TleAnalysisRunSnapshotError && error.code === 'IDENTITY_MISMATCH',
);

const transferSnapshot = createTleAnalysisRunSnapshot(source);
const transferredSnapshot = structuredClone(transferSnapshot, {
  transfer: [
    transferSnapshot.geometryRun.positionsTemeKm.buffer,
    transferSnapshot.geometryRun.velocitiesTemeKmPerSec.buffer,
  ],
});
assert.equal(transferSnapshot.geometryRun.positionsTemeKm.byteLength, 0);
const transferredHydrated = hydrateTleAnalysisRunSnapshot(transferredSnapshot);
assert.equal(transferredHydrated.geometryRun.runId, source.geometryRun.runId);
assert.equal(transferredHydrated.getFrame(240)?.frameId, source.getFrame(240)?.frameId);

console.log('TLE AnalysisRun snapshot/hydrate parity and geometry reuse passed');
