import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

import {
  loadTleSnapshotSelection,
  loadTleWebArchiveCatalog,
} from '../../src/simulator/archive';
import type { SimulatorConstellation } from '../../src/simulator/types';
import {
  buildCandidateIndex,
  buildChunkedCandidateIndex,
  DEFAULT_PASS_INDEX_CONFIG,
  PASS_INDEX_SCHEMA_VERSION,
  scanExactVisibility,
  scanExactVisibilityByChunk,
  sortedDifference,
  type PassIndexConfig,
} from './pass-index';

interface CliOptions {
  readonly constellation: SimulatorConstellation;
  readonly t0Utc: string;
  readonly config: PassIndexConfig;
}

function valueAfter(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
}

function finiteArg(args: readonly string[], name: string, fallback: number): number {
  const raw = valueAfter(args, name);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
}

function parseArgs(args: readonly string[]): CliOptions {
  const rawConstellation = valueAfter(args, '--constellation') ?? 'starlink';
  if (rawConstellation !== 'starlink' && rawConstellation !== 'oneweb') {
    throw new TypeError('--constellation must be starlink or oneweb');
  }
  const t0Utc = valueAfter(args, '--time') ?? '2026-08-08T12:00:00.000Z';
  if (!Number.isFinite(Date.parse(t0Utc))) throw new TypeError('--time must be an ISO instant');
  return {
    constellation: rawConstellation,
    t0Utc: new Date(t0Utc).toISOString(),
    config: Object.freeze({
      ...DEFAULT_PASS_INDEX_CONFIG,
      coarseStepS: finiteArg(args, '--coarse-step', DEFAULT_PASS_INDEX_CONFIG.coarseStepS),
      chunkDurationS: finiteArg(args, '--chunk-duration', DEFAULT_PASS_INDEX_CONFIG.chunkDurationS),
      coarseGuardElevationDeg: finiteArg(args, '--guard', DEFAULT_PASS_INDEX_CONFIG.coarseGuardElevationDeg),
      endpointPaddingS: finiteArg(args, '--padding', DEFAULT_PASS_INDEX_CONFIG.endpointPaddingS),
    }),
  };
}

const options = parseArgs(process.argv.slice(2));
const fetchFromPublic = async (path: RequestInfo | URL): Promise<Response> => (
  new Response(await readFile(`public${String(path)}`), { status: 200 })
);

const loadStartedAt = performance.now();
const catalog = await loadTleWebArchiveCatalog(
  `/tle-archive/${options.constellation}/catalog.json`,
  fetchFromPublic,
);
const selection = await loadTleSnapshotSelection(catalog, options.t0Utc, fetchFromPublic);
const loadMs = performance.now() - loadStartedAt;

const candidate = buildCandidateIndex(selection.manifest.entries, options.t0Utc, options.config);
const exactCandidate = scanExactVisibility(
  selection.manifest.entries,
  options.t0Utc,
  candidate.satelliteIds,
  options.config,
);
const chunkedCandidate = buildChunkedCandidateIndex(
  selection.manifest.entries,
  options.t0Utc,
  options.config,
);
const exactChunkedCandidate = scanExactVisibilityByChunk(
  selection.manifest.entries,
  options.t0Utc,
  chunkedCandidate,
  options.config,
);
const denseReference = scanExactVisibility(
  selection.manifest.entries,
  options.t0Utc,
  null,
  options.config,
);

const missedVisibleIds = sortedDifference(denseReference.satelliteIds, candidate.satelliteIds);
const exactMissedIds = sortedDifference(denseReference.satelliteIds, exactCandidate.satelliteIds);
const exactUnexpectedIds = sortedDifference(exactCandidate.satelliteIds, denseReference.satelliteIds);
const chunkedMissedIds = sortedDifference(denseReference.satelliteIds, exactChunkedCandidate.satelliteIds);
const chunkedUnexpectedIds = sortedDifference(exactChunkedCandidate.satelliteIds, denseReference.satelliteIds);
const chunkedMissedSamples = sortedDifference(
  denseReference.visibleSampleKeys,
  exactChunkedCandidate.visibleSampleKeys,
);
const chunkedUnexpectedSamples = sortedDifference(
  exactChunkedCandidate.visibleSampleKeys,
  denseReference.visibleSampleKeys,
);
const falsePositiveIds = sortedDifference(candidate.satelliteIds, denseReference.satelliteIds);
const sourceCount = selection.manifest.entries.length;

const report = {
  schemaVersion: PASS_INDEX_SCHEMA_VERSION,
  status: missedVisibleIds.length === 0
    && exactMissedIds.length === 0
    && exactUnexpectedIds.length === 0
    && chunkedMissedIds.length === 0
    && chunkedUnexpectedIds.length === 0
    && chunkedMissedSamples.length === 0
    && chunkedUnexpectedSamples.length === 0
    ? 'PASS'
    : 'FAIL',
  source: {
    constellation: options.constellation,
    requestedT0Utc: options.t0Utc,
    archiveId: catalog.archiveId,
    archiveDate: selection.snapshot.metadata.archiveDate,
    snapshotPath: selection.snapshot.metadata.path,
    snapshotSha256: selection.snapshot.sha256,
    sourceSatelliteCount: sourceCount,
  },
  observer: {
    id: 'ntpu-wgs84-v1',
    horizonElevationDeg: options.config.horizonElevationDeg,
  },
  config: options.config,
  correctness: {
    denseVisibleCount: denseReference.satelliteIds.size,
    candidateCount: candidate.satelliteIds.size,
    exactCandidateVisibleCount: exactCandidate.satelliteIds.size,
    missedVisibleCount: missedVisibleIds.length,
    missedVisibleIds,
    exactMissedCount: exactMissedIds.length,
    exactMissedIds,
    exactUnexpectedCount: exactUnexpectedIds.length,
    exactUnexpectedIds,
    falsePositiveCount: falsePositiveIds.length,
    candidateReductionPercent: 100 * (1 - candidate.satelliteIds.size / sourceCount),
    chunkedCandidateUnionCount: chunkedCandidate.satelliteIds.size,
    chunkedCandidateMemberships: chunkedCandidate.candidateMemberships,
    chunkCandidateCounts: chunkedCandidate.chunks.map(chunk => chunk.candidateSatelliteIds.size),
    chunkedExactVisibleCount: exactChunkedCandidate.satelliteIds.size,
    chunkedMissedIdentityCount: chunkedMissedIds.length,
    chunkedMissedIds,
    chunkedUnexpectedIdentityCount: chunkedUnexpectedIds.length,
    chunkedUnexpectedIds,
    chunkedMissedVisibleSampleCount: chunkedMissedSamples.length,
    chunkedUnexpectedVisibleSampleCount: chunkedUnexpectedSamples.length,
  },
  work: {
    candidatePropagationAttempts: candidate.propagationAttempts,
    exactCandidatePropagationAttempts: exactCandidate.propagationAttempts,
    denseReferencePropagationAttempts: denseReference.propagationAttempts,
    chunkedCandidatePropagationAttempts: chunkedCandidate.propagationAttempts,
    exactChunkedPropagationAttempts: exactChunkedCandidate.propagationAttempts,
    chunkedIndexedTotalPropagationAttempts: (
      chunkedCandidate.propagationAttempts + exactChunkedCandidate.propagationAttempts
    ),
    indexedTotalPropagationAttempts: candidate.propagationAttempts + exactCandidate.propagationAttempts,
    attemptReductionPercent: 100 * (
      1 - (candidate.propagationAttempts + exactCandidate.propagationAttempts)
        / denseReference.propagationAttempts
    ),
    chunkedAttemptReductionPercent: 100 * (
      1 - (chunkedCandidate.propagationAttempts + exactChunkedCandidate.propagationAttempts)
        / denseReference.propagationAttempts
    ),
    candidateFailClosedAdmissions: candidate.admittedFailClosed,
    candidateFailedSatelliteCount: candidate.failedSatelliteIds.size,
    exactCandidateFailedSatelliteCount: exactCandidate.failedSatelliteIds.size,
    exactChunkedFailedSatelliteCount: exactChunkedCandidate.failedSatelliteIds.size,
    denseReferenceFailedSatelliteCount: denseReference.failedSatelliteIds.size,
  },
  timingMs: {
    load: loadMs,
    candidateIndex: candidate.elapsedMs,
    exactCandidate: exactCandidate.elapsedMs,
    indexedTotal: candidate.elapsedMs + exactCandidate.elapsedMs,
    denseReference: denseReference.elapsedMs,
    chunkedCandidateIndex: chunkedCandidate.elapsedMs,
    exactChunkedCandidate: exactChunkedCandidate.elapsedMs,
    chunkedIndexedTotal: chunkedCandidate.elapsedMs + exactChunkedCandidate.elapsedMs,
  },
  process: {
    maxRssMiB: process.resourceUsage().maxRSS / 1024,
    node: process.version,
    platform: process.platform,
  },
};

console.log(JSON.stringify(report, null, 2));
if (report.status !== 'PASS') process.exitCode = 1;
