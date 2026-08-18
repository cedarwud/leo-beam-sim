import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import {
  loadTleSnapshotSelection,
  loadTleWebArchiveCatalog,
  type TleArchiveFetcher,
} from '../src/simulator/archive';
import {
  deriveObserverLinkGeometry,
  NTPU_TLE_OBSERVER,
} from '../src/simulator/observer';
import { createTlePropagationFrameWithSatelliteExclusions } from '../src/tle/propagation';
import { parseUtcInstant } from '../src/tle/time';
import { utcToAsiaTaipei } from '../src/tle/timezone';
import {
  candidateToVisualLabBookmark,
  createVisualLabBookmarksArtifact,
  rankVisualLabBookmarkCandidates,
  SELECTION_POLICY,
  type VisualLabBookmarkCandidate,
  type VisualLabBookmarkDescriptors,
  type VisualLabBookmarkSource,
} from '../src/visualLab/bookmarks';
import type {
  SimulatorConstellation,
  TleWebArchiveCatalog,
  TleWebArchiveSnapshot,
} from '../src/simulator/types';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const artifactPath = join(repoRoot, 'public/homepage-first-frame/visual-lab-bookmarks.json');
const candidateCount = SELECTION_POLICY.candidateSnapshotsPerConstellation;

const catalogUrls: readonly { readonly constellation: SimulatorConstellation; readonly url: string }[] = [
  { constellation: 'oneweb', url: '/tle-archive/oneweb/catalog.json' },
  { constellation: 'starlink', url: '/tle-archive/starlink/catalog.json' },
];

const fetchFromPublic: TleArchiveFetcher = async (input, init) => (
  new Response(await readFile(join(repoRoot, 'public', String(input).replace(/^\/+/, ''))), {
    status: 200,
    headers: { 'content-type': 'application/octet-stream' },
  })
);

function sampleSnapshots(
  snapshots: readonly TleWebArchiveSnapshot[],
  count: number,
): readonly TleWebArchiveSnapshot[] {
  if (snapshots.length < count) {
    throw new Error(`archive contains ${snapshots.length} snapshots; ${count} measured candidates are required`);
  }
  const selected = new Map<string, TleWebArchiveSnapshot>();
  for (let index = 0; index < count; index += 1) {
    const sourceIndex = Math.round(index * (snapshots.length - 1) / (count - 1));
    const snapshot = snapshots[sourceIndex];
    if (snapshot === undefined) throw new Error(`unable to sample archive snapshot ${sourceIndex}`);
    selected.set(snapshot.path, snapshot);
  }
  const result = [...selected.values()];
  if (result.length !== count) throw new Error('archive sampling produced duplicate candidate snapshots');
  return Object.freeze(result);
}

function circularAzimuthSpan(azimuths: readonly number[]): number {
  if (azimuths.length < 2) return 0;
  const sorted = [...azimuths].sort((left, right) => left - right);
  let largestGap = 0;
  for (let index = 1; index < sorted.length; index += 1) {
    largestGap = Math.max(largestGap, sorted[index]! - sorted[index - 1]!);
  }
  largestGap = Math.max(largestGap, sorted[0]! + 360 - sorted[sorted.length - 1]!);
  return 360 - largestGap;
}

async function measureCandidate(
  catalog: TleWebArchiveCatalog,
  metadata: TleWebArchiveSnapshot,
  fetcher: TleArchiveFetcher,
): Promise<VisualLabBookmarkCandidate> {
  const instantUtc = parseUtcInstant(metadata.maxEpochUtc, `${metadata.path}.maxEpochUtc`).value;
  const selection = await loadTleSnapshotSelection(catalog, instantUtc, fetcher);
  if (selection.snapshot.metadata.path !== metadata.path) {
    throw new Error(
      `fail-closed candidate anchor: ${metadata.path} does not resolve atomically at ${instantUtc}; `
      + `resolved ${selection.snapshot.metadata.path}`,
    );
  }
  const frame = createTlePropagationFrameWithSatelliteExclusions(
    selection.manifest,
    instantUtc,
  );
  const measured = frame.satellites.map(satellite => ({
    satellite,
    geometry: deriveObserverLinkGeometry(satellite.positionTemeKm, instantUtc),
  }));
  const visible = measured
    .filter(item => item.geometry.visible)
    .sort((left, right) => (
      right.geometry.elevationDeg - left.geometry.elevationDeg
      || left.satellite.satelliteId.localeCompare(right.satellite.satelliteId)
    ));
  if (visible.length === 0) {
    throw new Error(`fail-closed candidate anchor: no NTPU-visible satellite at ${instantUtc} from ${metadata.path}`);
  }
  const selected = visible[0]!;
  const lowestElevation = visible.reduce(
    (minimum, item) => Math.min(minimum, item.geometry.elevationDeg),
    selected.geometry.elevationDeg,
  );
  const minimumRange = visible.reduce(
    (minimum, item) => Math.min(minimum, item.geometry.rangeKm),
    selected.geometry.rangeKm,
  );
  const maximumRange = visible.reduce(
    (maximum, item) => Math.max(maximum, item.geometry.rangeKm),
    selected.geometry.rangeKm,
  );
  const descriptors: VisualLabBookmarkDescriptors = Object.freeze({
    visibleSatelliteCount: visible.length,
    propagatedSatelliteCount: frame.satellites.length,
    selectedElevationDeg: selected.geometry.elevationDeg,
    selectedRangeKm: selected.geometry.rangeKm,
    selectedAzimuthDeg: selected.geometry.azimuthDeg,
    elevationSpreadDeg: selected.geometry.elevationDeg - lowestElevation,
    visibleAzimuthSpanDeg: circularAzimuthSpan(visible.map(item => item.geometry.azimuthDeg)),
    visibleRangeSpanKm: maximumRange - minimumRange,
    selectedSatelliteId: selected.satellite.satelliteId,
    comparisonSatelliteId: visible[1]?.satellite.satelliteId ?? null,
  });
  const source: VisualLabBookmarkSource = Object.freeze({
    catalogUrl: catalogUrls.find(item => item.constellation === catalog.constellation)!.url,
    archiveId: catalog.archiveId,
    archiveContentSha256: catalog.archiveContentSha256 ?? (() => {
      throw new Error(`${catalog.constellation} catalog has no archiveContentSha256`);
    })(),
    archiveDate: metadata.archiveDate,
    path: metadata.path,
    sha256: metadata.sha256,
    recordCount: metadata.recordCount,
    maxPropagationAgeMs: catalog.maxPropagationAgeMs,
    sourceKind: 'ARCHIVED_TLE',
    propagationModel: 'SGP4',
    measuredFrameId: frame.frameId,
    propagatedSatelliteCount: frame.satellites.length,
    propagationExclusionCount: selection.manifest.entries.length - frame.satellites.length,
  });
  return Object.freeze({
    constellation: catalog.constellation,
    instantUtc,
    source,
    descriptors,
  });
}

function catalogSummary(catalog: TleWebArchiveCatalog, catalogUrl: string) {
  if (catalog.archiveContentSha256 === undefined) {
    throw new Error(`${catalog.constellation} catalog has no archiveContentSha256`);
  }
  return Object.freeze({
    constellation: catalog.constellation,
    catalogUrl,
    archiveId: catalog.archiveId,
    archiveContentSha256: catalog.archiveContentSha256,
    snapshotCount: catalog.snapshotCount,
    firstArchiveDate: catalog.firstArchiveDate,
    lastArchiveDate: catalog.lastArchiveDate,
    maxPropagationAgeMs: catalog.maxPropagationAgeMs,
  });
}

const catalogs = await Promise.all(catalogUrls.map(async ({ constellation, url }) => ({
  constellation,
  url,
  catalog: await loadTleWebArchiveCatalog(url, fetchFromPublic),
})));

const candidateGroups = await Promise.all(catalogs.map(async ({ catalog }) => {
  const snapshots = sampleSnapshots(catalog.snapshots, candidateCount);
  const candidates: VisualLabBookmarkCandidate[] = [];
  for (const metadata of snapshots) {
    candidates.push(await measureCandidate(catalog, metadata, fetchFromPublic));
  }
  return candidates;
}));

const candidates = Object.freeze(candidateGroups.flat());
const ranked = rankVisualLabBookmarkCandidates(candidates, SELECTION_POLICY.selectedPerConstellation);
const bookmarks = ranked.map(candidateToVisualLabBookmark);
const generatedAtUtc = catalogs
  .flatMap(item => item.catalog.snapshots.map(snapshot => snapshot.maxEpochUtc))
  .map(value => parseUtcInstant(value, 'catalog maxEpochUtc').value)
  .sort()
  .at(-1);
if (generatedAtUtc === undefined) throw new Error('catalogs contain no maxEpochUtc values');

const artifact = createVisualLabBookmarksArtifact({
  generatedAtUtc,
  sourceCatalogs: catalogs.map(item => catalogSummary(item.catalog, item.url)),
  bookmarks,
});
const serialized = `${JSON.stringify(artifact, null, 2)}\n`;

if (process.argv.includes('--check')) {
  const current = await readFile(artifactPath, 'utf8');
  if (current !== serialized) throw new Error(`${artifactPath} is stale; run the generator without --check`);
  console.log(`Visual Lab bookmark artifact is current (${bookmarks.length} measured bookmarks; ${Buffer.byteLength(serialized)} bytes)`);
} else {
  await writeFile(artifactPath, serialized, 'utf8');
  console.log(`wrote ${artifactPath} (${bookmarks.length} measured bookmarks; ${Buffer.byteLength(serialized)} bytes)`);
}

for (const bookmark of bookmarks) {
  console.log(
    `${bookmark.id}: ${bookmark.constellation} ${bookmark.instantTaipei} `
    + `visible=${bookmark.descriptors.visibleSatelliteCount} `
    + `peak=${bookmark.descriptors.selectedElevationDeg.toFixed(1)}deg `
    + `source=${bookmark.source.path}`,
  );
}

// Keep the imported observer visible in the generated-script source contract;
// the runtime measurement uses the same observer through deriveObserverLinkGeometry.
if (NTPU_TLE_OBSERVER.id !== 'ntpu-wgs84-v1' || utcToAsiaTaipei(generatedAtUtc).length === 0) {
  throw new Error('unexpected NTPU observer or timezone conversion contract');
}
