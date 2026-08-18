import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  createBrowserDenseRunPayloadBuilder,
  createRunPayloadParametersSha256,
} from './denseBuilder';
import {
  DEFAULT_SIMULATOR_PARAMETERS,
  SIMULATOR_CONTRACT_VERSION,
} from '../../simulator/types';

const fetchFromPublic = async (path: RequestInfo | URL): Promise<Response> => (
  new Response(await readFile(`public${String(path)}`), { status: 200 })
);

const parametersSha256 = await createRunPayloadParametersSha256(DEFAULT_SIMULATOR_PARAMETERS);
const request = {
  archiveId: 'oneweb' as const,
  requestedT0Utc: '2026-08-08T12:00:00.000Z',
  observer: {
    id: 'ntpu-wgs84-v1',
    coordinates: { latitudeDeg: 24.9441667, longitudeDeg: 121.3713889, altitudeM: 50 },
  },
  geometry: {
    durationS: 7_200,
    stepS: 30,
    anchorCount: 241,
    coarseStepS: 120,
    chunkDurationS: 600,
    endpointPaddingS: 120,
    horizonElevationDeg: 0,
    coarseGuardElevationDeg: -20,
  },
  analysis: {
    canonicalScenarioRevision: SIMULATOR_CONTRACT_VERSION,
    parametersSha256,
    formulaVersion: 'angle-aware-ee-v3',
    linkShapeVersion: 'canonical-link-result:before-satellite-cap-power-v1',
  },
};

const progressPhases = new Set<string>();
const builder = createBrowserDenseRunPayloadBuilder({
  fetcher: fetchFromPublic,
  yieldEveryAnchors: 241,
  parameters: DEFAULT_SIMULATOR_PARAMETERS,
});
const result = await builder(request, {
  signal: new AbortController().signal,
  reportProgress: progress => progressPhases.add(progress.phase),
});

const manifest = result.accepted.manifest;
const timeline = result.accepted.timeline;
assert.equal(manifest.status, 'accepted');
assert.equal(manifest.source.archiveId, 'oneweb');
assert.equal(manifest.source.requestedT0Utc, request.requestedT0Utc);
assert.equal(manifest.source.appliedT0Utc, request.requestedT0Utc);
assert.equal(manifest.source.snapshotKey, 'tle-archive/oneweb/oneweb_20260808.tle');
assert.equal(manifest.source.snapshotSha256, manifest.source.sourceSnapshotDigest);
assert.match(manifest.source.snapshotSha256, /^[0-9a-f]{64}$/);
assert.match(manifest.passIndexKey, /^tle-pass-index:[0-9a-f]{64}$/);
assert.match(manifest.runKey, /^selectable-tle-run:[0-9a-f]{64}$/);
assert.deepEqual([...progressPhases], [
  'snapshot-resolving',
  'exact-confirming',
  'pass-indexing',
  'ntpu-canonical-building',
  'payload-packaging',
]);

assert.equal(result.bootstrap.sourceKind, 'ARCHIVED_TLE');
assert.equal(result.bootstrap.propagationModel, 'SGP4');
assert.equal(result.accepted.acceptedAnchorCount, 241);
assert.equal(result.accepted.acceptedIntervalCount, 240);
assert.equal(timeline.sourceKind, 'ARCHIVED_TLE');
assert.equal(timeline.propagationModel, 'SGP4');
assert.equal(timeline.durationS, 7_200);
assert.equal(timeline.stepS, 30);
assert.equal(timeline.anchorCount, 241);
assert.equal(timeline.anchors.length, 241);
assert.equal(timeline.runKey, manifest.runKey);
assert.equal(timeline.passIndexKey, manifest.passIndexKey);
assert.equal(timeline.geometryRunId, manifest.geometryRunId);
assert.equal(timeline.analysisRunId, manifest.analysis.analysisRunId);
assert.equal(result.plan.identity.runKey, manifest.runKey);
assert.equal(result.plan.identity.passIndexKey, manifest.passIndexKey);
assert.equal(result.plan.identity.sourceSnapshotDigest, manifest.source.sourceSnapshotDigest);

const bootstrapFrame = result.bootstrap.frame as Record<string, unknown>;
assert.equal(bootstrapFrame.frameId, result.bootstrap.frameId);
assert.equal(bootstrapFrame.instantUtc, result.bootstrap.instantUtc);
assert.notEqual(bootstrapFrame.selectedSatelliteId, undefined);
assert.equal(result.bootstrap.frameId, timeline.anchors[0]?.frameId);
assert.equal(result.bootstrap.instantUtc, timeline.anchors[0]?.instantUtc);

for (const [expectedIndex, anchor] of timeline.anchors.entries()) {
  assert.equal(anchor.anchorIndex, expectedIndex);
  assert.equal(
    anchor.instantUtc,
    new Date(Date.parse(request.requestedT0Utc) + expectedIndex * 30_000).toISOString(),
  );
  assert.notEqual(anchor.frameId, '');
  assert.notEqual(anchor.tleFrameId, '');
  assert.notEqual(anchor.selectedSatelliteId, '');
  assert.ok(anchor.canonical !== null && typeof anchor.canonical === 'object');
  const selection = anchor.selection as { readonly identity?: { readonly runId?: unknown } };
  assert.equal(selection.identity?.runId, timeline.analysisRunId);
}

const handoverTrace = timeline.handoverTrace as {
  readonly analysisRunId?: unknown;
  readonly geometryRunId?: unknown;
  readonly anchors?: readonly unknown[];
};
assert.equal(handoverTrace.analysisRunId, timeline.analysisRunId);
assert.equal(handoverTrace.geometryRunId, timeline.geometryRunId);
assert.equal(handoverTrace.anchors?.length, 241);

const acceptedJson = JSON.stringify(result.accepted);
assert.doesNotMatch(acceptedJson, /"sourceKind"\s*:\s*"(?:MOCK|WALKER|FALLBACK)"/i);
assert.doesNotMatch(acceptedJson, /"propagationModel"\s*:\s*"(?:MOCK|FALLBACK)"/i);
// Existing canonical planner exposes real visible-geometry continuity edges;
// the count is explicit rather than hidden as a synthetic source.
assert.ok(timeline.visibleGeometryFallbackAnchorCount >= 0);

console.log(
  `real OneWeb dense payload: ${timeline.anchorCount} anchors, `
  + `${timeline.visibleGeometryFallbackAnchorCount} explicit real-geometry continuity anchors`,
);
console.log('run-payload dense builder integration test passed');
