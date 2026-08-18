import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { loadTleSnapshotSelection, loadTleWebArchiveCatalog } from '../../simulator/archive';
import { buildTleAnalysisRun } from '../../simulator/tleAnalysisRun';
import { DEFAULT_SIMULATOR_PARAMETERS, SIMULATOR_CATALOG_URLS } from '../../simulator/types';
import { buildTleRunBundle } from '../../tle/run';
import { adaptTleAnalysisRunToVisualLabTimeline } from './visualLabCanonicalTimelineAdapter';

const fetchFromPublic = async (path: RequestInfo | URL): Promise<Response> => (
  new Response(await readFile(`public${String(path)}`), { status: 200 })
);

const instantUtc = '2026-08-08T12:00:00.000Z';
const catalog = await loadTleWebArchiveCatalog(SIMULATOR_CATALOG_URLS.oneweb, fetchFromPublic);
const selection = await loadTleSnapshotSelection(catalog, instantUtc, fetchFromPublic);
const geometryRun = await buildTleRunBundle({ selection, t0Utc: instantUtc });
const run = buildTleAnalysisRun({ selection, geometryRun, parameters: DEFAULT_SIMULATOR_PARAMETERS });
const timeline = adaptTleAnalysisRunToVisualLabTimeline(run);

assert.equal(timeline.isMock, false);
assert.equal(timeline.analysisRunId, run.analysisRunId);
assert.equal(timeline.durationSec, 7_200);
assert.equal(timeline.anchorCount, 241);
assert.equal(timeline.points[0]?.timeSec, 0);
const finalPoint = timeline.points[timeline.points.length - 1];
assert.equal(finalPoint?.timeSec, 7_200);
assert.equal(timeline.points[0]?.deliveredBits, 0);
assert.equal(timeline.points[0]?.energyJ, 0);
assert.equal(
  timeline.points[0]?.instantaneousEeBitsPerJ,
  run.getFrame(0)?.ee.instantaneousBitsPerJ,
  'story anchors retain canonical instantaneous EE even before cumulative energy begins',
);
assert.equal(finalPoint?.deliveredBits, run.evaluation.deliveredBits);
assert.equal(finalPoint?.energyJ, run.evaluation.consumedEnergyJ);
assert.ok(timeline.points.every((point, index, points) => index === 0 || point.timeSec > points[index - 1]!.timeSec));
assert.ok(timeline.points.every(point => point.servingSatelliteId.length > 0));
assert.ok(timeline.points.every(point => Number.isFinite(point.throughputBps) && Number.isFinite(point.powerW)));
assert.ok(timeline.points.every(point => Number.isFinite(point.instantaneousEeBitsPerJ)));
assert.deepEqual(
  timeline.markers.map(marker => marker.eventId),
  run.handoverTrace.servingChangeEvents.map(event => event.eventId),
);
for (const marker of timeline.markers) {
  assert.ok(timeline.points.some(point => point.anchorIndex === marker.anchorIndex));
  if (marker.anchorIndex > 0) {
    assert.ok(
      timeline.points.some(point => point.anchorIndex === marker.anchorIndex - 1),
      `inter-handover ${marker.eventId} must retain a real before anchor`,
    );
  }
  if (marker.anchorIndex < run.anchorCount - 1) {
    assert.ok(
      timeline.points.some(point => point.anchorIndex === marker.anchorIndex + 1),
      `inter-handover ${marker.eventId} must retain a real after anchor`,
    );
  }
}
assert.equal(adaptTleAnalysisRunToVisualLabTimeline(run), timeline, 'default projection is cached per immutable run');

console.log('visual-lab canonical timeline adapter passed');
