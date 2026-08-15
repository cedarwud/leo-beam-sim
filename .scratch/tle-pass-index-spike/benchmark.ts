import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';

import {
  loadTleSnapshotSelection,
  loadTleWebArchiveCatalog,
} from '../../src/simulator/archive';
import type { SimulatorConstellation } from '../../src/simulator/types';
import {
  buildCandidateIndex,
  buildChunkedCandidateIndex,
  coarseSampleOffsets,
  DEFAULT_PASS_INDEX_CONFIG,
  exactSampleOffsets,
  PASS_INDEX_SCHEMA_VERSION,
  scanExactVisibility,
  scanExactVisibilityByChunk,
  scanExactPassEvents,
  sortedDifference,
  type PassIndexConfig,
} from './pass-index';

const EVENT_NUMERIC_TOLERANCES = Object.freeze({
  aosTimeS: 0.001,
  peakTimeS: 0.001,
  losTimeS: 0.001,
  maxElevationDeg: 0.000001,
});

function sortedValues(values: ReadonlySet<string>): readonly string[] {
  return [...values].sort();
}

function sha256(value: Uint8Array | string): string {
  return createHash('sha256').update(value).digest('hex');
}

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
      durationS: finiteArg(args, '--duration', DEFAULT_PASS_INDEX_CONFIG.durationS),
      exactStepS: finiteArg(args, '--exact-step', DEFAULT_PASS_INDEX_CONFIG.exactStepS),
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
const chunkedPassEvents = scanExactPassEvents(
  selection.manifest.entries,
  options.t0Utc,
  chunkedCandidate,
  options.config,
);
const densePassEvents = scanExactPassEvents(
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
const chunkedEventMap = new Map(chunkedPassEvents.events.map(event => [event.eventKey, event]));
const denseEventMap = new Map(densePassEvents.events.map(event => [event.eventKey, event]));
const missingEventKeys = [...denseEventMap.keys()].filter(key => !chunkedEventMap.has(key)).sort();
const unexpectedEventKeys = [...chunkedEventMap.keys()].filter(key => !denseEventMap.has(key)).sort();
const denseVisibilityFailureIds = denseReference.failedSatelliteIds;
const chunkedVisibilityFailureIds = exactChunkedCandidate.failedSatelliteIds;
const missingVisibilityFailureIds = sortedDifference(denseVisibilityFailureIds, chunkedVisibilityFailureIds);
const unexpectedVisibilityFailureIds = sortedDifference(chunkedVisibilityFailureIds, denseVisibilityFailureIds);
const denseEventFailureIds = densePassEvents.failedSatelliteIds;
const chunkedEventFailureIds = chunkedPassEvents.failedSatelliteIds;
const missingEventFailureIds = sortedDifference(denseEventFailureIds, chunkedEventFailureIds);
const unexpectedEventFailureIds = sortedDifference(chunkedEventFailureIds, denseEventFailureIds);
let maxAosErrorS = 0;
let maxPeakErrorS = 0;
let maxLosErrorS = 0;
let maxPeakElevationErrorDeg = 0;
const eventNumericToleranceViolations: Array<{
  readonly eventKey: string;
  readonly aosTimeS: number;
  readonly peakTimeS: number;
  readonly losTimeS: number;
  readonly maxElevationDeg: number;
}> = [];
for (const [key, denseEvent] of denseEventMap) {
  const chunkedEvent = chunkedEventMap.get(key);
  if (chunkedEvent === undefined) continue;
  const error = {
    aosTimeS: Math.abs(denseEvent.aosTimeSec - chunkedEvent.aosTimeSec),
    peakTimeS: Math.abs(denseEvent.peakTimeSec - chunkedEvent.peakTimeSec),
    losTimeS: Math.abs(denseEvent.losTimeSec - chunkedEvent.losTimeSec),
    maxElevationDeg: Math.abs(denseEvent.maxElevationDeg - chunkedEvent.maxElevationDeg),
  };
  maxAosErrorS = Math.max(maxAosErrorS, error.aosTimeS);
  maxPeakErrorS = Math.max(maxPeakErrorS, error.peakTimeS);
  maxLosErrorS = Math.max(maxLosErrorS, error.losTimeS);
  maxPeakElevationErrorDeg = Math.max(maxPeakElevationErrorDeg, error.maxElevationDeg);
  if (
    error.aosTimeS > EVENT_NUMERIC_TOLERANCES.aosTimeS
    || error.peakTimeS > EVENT_NUMERIC_TOLERANCES.peakTimeS
    || error.losTimeS > EVENT_NUMERIC_TOLERANCES.losTimeS
    || error.maxElevationDeg > EVENT_NUMERIC_TOLERANCES.maxElevationDeg
  ) {
    eventNumericToleranceViolations.push(Object.freeze({ eventKey: key, ...error }));
  }
}
const sourceCount = selection.manifest.entries.length;
const spikeParityPass = (
  missedVisibleIds.length === 0
  && exactMissedIds.length === 0
  && exactUnexpectedIds.length === 0
  && chunkedMissedIds.length === 0
  && chunkedUnexpectedIds.length === 0
  && chunkedMissedSamples.length === 0
  && chunkedUnexpectedSamples.length === 0
  && missingEventKeys.length === 0
  && unexpectedEventKeys.length === 0
  && missingVisibilityFailureIds.length === 0
  && unexpectedVisibilityFailureIds.length === 0
  && missingEventFailureIds.length === 0
  && unexpectedEventFailureIds.length === 0
  && eventNumericToleranceViolations.length === 0
  && [
    candidate.failedSatelliteIds,
    exactCandidate.failedSatelliteIds,
    chunkedCandidate.failedSatelliteIds,
    denseReference.failedSatelliteIds,
    exactChunkedCandidate.failedSatelliteIds,
    densePassEvents.failedSatelliteIds,
    chunkedPassEvents.failedSatelliteIds,
  ].every(failures => failures.size === 0)
);

const [passIndexSource, benchmarkSource, satellitePackageSource] = await Promise.all([
  readFile(new URL('./pass-index.ts', import.meta.url)),
  readFile(new URL('./benchmark.ts', import.meta.url)),
  readFile(new URL('../../node_modules/satellite.js/package.json', import.meta.url), 'utf8'),
]);
const satellitePackage = JSON.parse(satellitePackageSource) as { readonly version?: unknown };

const report = {
  schemaVersion: PASS_INDEX_SCHEMA_VERSION,
  status: spikeParityPass ? 'PASS_SPIKE_NOT_ACCEPTANCE_GATE' : 'FAIL',
  spikeParity: spikeParityPass ? 'PASS' : 'FAIL',
  formalProductionPassParity: {
    status: 'BLOCKED',
    reason: 'active src/tle/pass extractor and planner remain dirty/untracked; this scratch oracle is self-contained and cannot self-certify production parity',
    source: 'src/tle/pass/**',
  },
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
    latitudeDeg: 24.9441667,
    longitudeDeg: 121.3713889,
    heightKm: 0.05,
    horizonElevationDeg: options.config.horizonElevationDeg,
  },
  config: options.config,
  provenance: {
    exactSampleOffsetsS: exactSampleOffsets(options.config),
    coarseSampleOffsetsS: coarseSampleOffsets(options.config),
    eventNumericTolerances: EVENT_NUMERIC_TOLERANCES,
    satelliteJsVersion: typeof satellitePackage.version === 'string' ? satellitePackage.version : 'unknown',
    scratchSourceSha256: {
      passIndexTs: sha256(passIndexSource),
      benchmarkTs: sha256(benchmarkSource),
    },
    productionPassExtractorImported: false,
  },
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
    denseCompletePassCount: densePassEvents.events.length,
    chunkedCompletePassCount: chunkedPassEvents.events.length,
    missingCompletePassCount: missingEventKeys.length,
    missingCompletePassKeys: missingEventKeys,
    unexpectedCompletePassCount: unexpectedEventKeys.length,
    unexpectedCompletePassKeys: unexpectedEventKeys,
    failureSetParity: {
      visibility: {
        pass: missingVisibilityFailureIds.length === 0 && unexpectedVisibilityFailureIds.length === 0,
        denseIds: sortedValues(denseVisibilityFailureIds),
        chunkedIds: sortedValues(chunkedVisibilityFailureIds),
        missingIds: missingVisibilityFailureIds,
        unexpectedIds: unexpectedVisibilityFailureIds,
      },
      completePassEvents: {
        pass: missingEventFailureIds.length === 0 && unexpectedEventFailureIds.length === 0,
        denseIds: sortedValues(denseEventFailureIds),
        chunkedIds: sortedValues(chunkedEventFailureIds),
        missingIds: missingEventFailureIds,
        unexpectedIds: unexpectedEventFailureIds,
      },
    },
    eventNumericTolerancePass: eventNumericToleranceViolations.length === 0,
    eventNumericToleranceViolations,
    eventNumericTolerances: EVENT_NUMERIC_TOLERANCES,
    maxAosErrorS,
    maxPeakErrorS,
    maxLosErrorS,
    maxPeakElevationErrorDeg,
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
    chunkedPassPropagationAttempts: chunkedPassEvents.propagationAttempts,
    densePassPropagationAttempts: densePassEvents.propagationAttempts,
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
    chunkedPassEvents: chunkedPassEvents.elapsedMs,
    densePassEvents: densePassEvents.elapsedMs,
  },
  process: {
    maxRssMiB: process.resourceUsage().maxRSS / 1024,
    node: process.version,
    platform: process.platform,
    argv: process.argv.slice(1),
  },
};

console.log(JSON.stringify(report, null, 2));
if (report.status === 'FAIL') process.exitCode = 1;
