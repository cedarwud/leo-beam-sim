import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  loadTleSnapshotSelection,
  loadTleWebArchiveCatalog,
} from '../../simulator/archive';
import { NTPU_TLE_OBSERVER } from '../../simulator/observer';
import { buildTleAnalysisRun } from '../../simulator/tleAnalysisRun';
import { DEFAULT_SIMULATOR_PARAMETERS } from '../../simulator/types';
import { buildTleRunBundle } from '../run';
import {
  aggregateTleEventAtlas,
  buildTleEventAtlasWindowReceipt,
  type TleEventAtlasAcceptedWindowReceipt,
} from './index';

const fetchFromPublic = async (path: RequestInfo | URL): Promise<Response> => (
  new Response(await readFile(`public${String(path)}`), { status: 200 })
);

const requestedT0Utc = '2026-08-07T23:59:59.000Z';
const catalog = await loadTleWebArchiveCatalog('/tle-archive/oneweb/catalog.json', fetchFromPublic);
const selection = await loadTleSnapshotSelection(catalog, requestedT0Utc, fetchFromPublic);
const geometryRun = await buildTleRunBundle({
  selection,
  t0Utc: requestedT0Utc,
  candidatePool: { mode: 'full-reference' },
  yieldEveryAnchors: 241,
});
const analysisRun = buildTleAnalysisRun({
  selection,
  geometryRun,
  parameters: DEFAULT_SIMULATOR_PARAMETERS,
});
const digest = 'a'.repeat(64);
const window = buildTleEventAtlasWindowReceipt({
  constellation: 'oneweb',
  selection,
  analysisRun,
  evidenceClass: 'canonical-research',
  propagationMode: 'full-reference',
  configDigest: digest,
  canonicalParameterDigest: 'b'.repeat(64),
  canonicalScenarioDigest: 'c'.repeat(64),
  source: {
    archiveId: catalog.archiveId,
    archiveDate: selection.snapshot.metadata.archiveDate,
    publicationPath: selection.snapshot.metadata.path,
    publicationSha256: selection.snapshot.sha256,
    publicationByteLength: selection.snapshot.byteLength,
    publicationRecordCount: selection.snapshot.metadata.recordCount,
    admittedRecordCount: selection.manifest.entries.length,
    resolvedSnapshotDigest: 'd'.repeat(64),
  },
});

assert.equal(window.status, 'accepted');
assert.equal(window.propagationMode, 'full-reference');
assert.equal(window.evidenceClass, 'canonical-research');
assert.equal(window.handoverPolicy.offsetDb, 3);
assert.equal(window.handoverPolicy.tttSec, 30);
assert.ok(window.events.length > 0, 'reference window must yield source-backed serving changes');
for (const event of window.events) {
  assert.equal(event.anchors.length, 3);
  assert.deepEqual(event.anchors.map(anchor => anchor.role), ['before', 'decision', 'after']);
  assert.equal(event.tleIdentities.length, 2);
  assert.ok(event.tleIdentities.every(identity => identity.line1.startsWith('1 ')));
  assert.ok(event.tleIdentities.every(identity => identity.line2.startsWith('2 ')));
  assert.equal(event.anchors[1]?.instantUtc, event.triggerInstantUtc);
  assert.equal(event.preCommit.servingSatelliteId, event.fromSatelliteId);
  assert.equal(event.preCommit.candidateSatelliteId, event.toSatelliteId);
  assert.equal(event.postCommit.servingSatelliteId, event.toSatelliteId);
  assert.equal(event.anchors[1]?.servingSatelliteId, event.toSatelliteId);
}

assert.throws(() => buildTleEventAtlasWindowReceipt({
  constellation: 'oneweb',
  selection,
  analysisRun,
  evidenceClass: 'canonical-research',
  propagationMode: 'staged-coarse-to-fine',
  configDigest: digest,
  canonicalParameterDigest: 'b'.repeat(64),
  canonicalScenarioDigest: 'c'.repeat(64),
  source: window.source,
}), /cannot claim canonical-research/);

const windowStepMs = 30 * 60 * 1_000;
const overlappingWindows = Array.from({ length: 4 }, (_unused, index): TleEventAtlasAcceptedWindowReceipt => ({
  ...window,
  requestedT0Utc: new Date(Date.parse(requestedT0Utc) + index * windowStepMs).toISOString(),
  events: window.events.map(event => ({
    ...event,
    variantId: `${event.variantId}-window-${index}`,
    sourceEventId: `${event.sourceEventId}-window-${index}`,
    requestedT0Utc: new Date(Date.parse(requestedT0Utc) + index * windowStepMs).toISOString(),
  })),
}));
const atlas = aggregateTleEventAtlas({
  atlasId: 'tle-event-atlas:test',
  generatedAtUtc: '2026-08-18T00:00:00.000Z',
  constellation: 'oneweb',
  evidenceClass: 'canonical-research',
  propagationMode: 'full-reference',
  sourceArchiveContentSha256: 'e'.repeat(64),
  configDigest: digest,
  search: {
    startUtc: requestedT0Utc,
    endUtcExclusive: new Date(Date.parse(requestedT0Utc) + 4 * windowStepMs).toISOString(),
    windowStepSec: 1_800,
    physicalDurationSec: 7_200,
  },
  observer: NTPU_TLE_OBSERVER,
  canonicalParameterDigest: 'b'.repeat(64),
  canonicalScenarioDigest: 'c'.repeat(64),
  windows: overlappingWindows,
});

assert.equal(atlas.summary.expectedWindowCount, 4);
assert.equal(atlas.summary.acceptedWindowCount, 4);
assert.equal(atlas.summary.coverageComplete, true);
assert.equal(atlas.summary.populationClaimsAllowed, true);
assert.ok(atlas.eventVariants.length >= atlas.logicalEvents.length);
assert.equal(atlas.preferredEvents.length, atlas.logicalEvents.length);
assert.ok(atlas.logicalEvents.every(event => event.variantIds.length === 4));
assert.equal(atlas.summary.uniqueServingChangeCount, atlas.logicalEvents.length);
assert.equal(atlas.rankedPreferredVariantIds.length, atlas.logicalEvents.length);
assert.throws(() => aggregateTleEventAtlas({
  ...atlas,
  windows: overlappingWindows.slice(1),
}), /coverage is incomplete/);

console.log('canonical TLE Event Atlas window and aggregation tests passed');
