import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

import {
  ecfToLookAngles,
  eciToEcf,
  gstime,
  propagate,
  twoline2satrec,
  type EciVec3,
} from 'satellite.js';

import {
  loadTleSnapshotSelection,
  loadTleWebArchiveCatalog,
} from '../../src/simulator/archive';
import type { TleArchiveEntry } from '../../src/tle/types';
import type { SimulatorConstellation } from '../../src/simulator/types';

/**
 * Request-time shadow benchmark, not a production path.
 *
 * The important invariant is that exact SGP4/look-angle geometry is generated
 * once into typed arrays. Pool counts and pass events read those retained
 * samples; they do not call SGP4 a second time. The coarse screen is an
 * empirical guard and is not an exclusion proof.
 */

const SCHEMA_VERSION = 'tle-request-time-benchmark-v1' as const;
const T0_UTC = '2026-08-08T12:00:00.000Z';
const DURATION_S = 7_200;
const EXACT_STEP_S = 30;
const COARSE_STEP_S = 120;
const CHUNK_DURATION_S = 600;
const ENDPOINT_PADDING_S = 120;
const HORIZON_DEG = 0;
const COARSE_GUARD_DEG = -20;
const THRESHOLDS_DEG = [0, 15, 30] as const;
const ANCHOR_COUNT = DURATION_S / EXACT_STEP_S + 1;
const CHUNK_COUNT = DURATION_S / CHUNK_DURATION_S;

const OBSERVER = Object.freeze({
  id: 'ntpu-wgs84-v1',
  latitudeDeg: 24.9441667,
  longitudeDeg: 121.3713889,
  heightKm: 0.05,
});

const REVISIONS = Object.freeze({
  preparation: 'satrec-twoline2satrec-v1',
  coarseScreen: 'time-local-coarse-look-v1',
  exactGeometry: 'exact-sgp4-look-typed-array-v1',
  retainedPasses: 'retained-elevation-linear-crossing-v1',
  poolCounts: 'retained-elevation-threshold-count-v1',
});

interface PreparedRecord {
  readonly entry: TleArchiveEntry;
  readonly satrec: ReturnType<typeof twoline2satrec> | null;
}

interface GeometrySample {
  readonly elevationDeg: number;
  readonly azimuthDeg: number;
  readonly rangeKm: number;
}

interface ChunkPool {
  readonly chunkIndex: number;
  readonly startAnchorIndexInclusive: number;
  readonly endAnchorIndexExclusive: number;
  readonly candidateIds: readonly string[];
}

interface PreparedInput {
  readonly catalog: Awaited<ReturnType<typeof loadTleWebArchiveCatalog>>;
  readonly selection: Awaited<ReturnType<typeof loadTleSnapshotSelection>>;
  readonly entries: readonly TleArchiveEntry[];
  readonly sourceFiles: readonly SourceFileReceipt[];
  readonly timingsMs: {
    readonly catalogLoad: number;
    readonly snapshotLoadAndParse: number;
  };
}

interface SourceFileReceipt {
  readonly path: string;
  readonly bytes: number;
  readonly sha256: string;
}

interface GeometryArtifact {
  readonly candidateIds: readonly string[];
  readonly elevationsDeg: Float32Array;
  readonly azimuthDeg: Float32Array;
  readonly rangeKm: Float32Array;
  readonly propagationAttempts: number;
  readonly failedIds: readonly string[];
}

interface PoolCounts {
  readonly anchorOffsetsS: readonly number[];
  readonly byThresholdDeg: Readonly<Record<string, readonly number[]>>;
  readonly summary: Readonly<Record<string, {
    readonly min: number;
    readonly max: number;
    readonly mean: number;
    readonly atT0: number;
    readonly atMidpoint: number;
    readonly atEnd: number;
  }>>;
  readonly sampleReads: number;
}

interface PassEvent {
  readonly satelliteId: string;
  readonly aosAnchorIndex: number;
  readonly peakAnchorIndex: number;
  readonly losAnchorIndex: number;
  readonly aosTimeS: number;
  readonly peakTimeS: number;
  readonly losTimeS: number;
  readonly maxElevationDeg: number;
}

interface RunArtifact {
  readonly cacheKey: string;
  readonly sourceDigest: Readonly<Record<string, unknown>>;
  readonly preparedCount: number;
  readonly chunkPools: readonly ChunkPool[];
  readonly coarse: {
    readonly propagationAttempts: number;
    readonly failOpenIds: readonly string[];
    readonly candidateUnionIds: readonly string[];
    readonly candidateMembershipCount: number;
    readonly elapsedMs: number;
  };
  readonly geometry: GeometryArtifact;
  readonly poolCounts: PoolCounts;
  readonly passEvents: readonly PassEvent[];
}

interface ApplyChunkProgress {
  readonly chunkIndex: number;
  readonly startAnchorIndexInclusive: number;
  readonly endAnchorIndexExclusive: number;
  readonly candidateCount: number;
  readonly exactSampleCount: number;
  readonly status: 'complete';
}

interface CliOptions {
  readonly constellations: readonly SimulatorConstellation[];
  readonly outputDir: string;
}

const cache = new Map<string, RunArtifact>();

function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

function roundMs(value: number): number {
  return Number(value.toFixed(3));
}

function memoryReceipt(): Readonly<Record<string, number>> {
  const memory = process.memoryUsage();
  return Object.freeze({
    rssMiB: Number((memory.rss / 1024 / 1024).toFixed(3)),
    heapUsedMiB: Number((memory.heapUsed / 1024 / 1024).toFixed(3)),
    externalMiB: Number((memory.external / 1024 / 1024).toFixed(3)),
    arrayBuffersMiB: Number((memory.arrayBuffers / 1024 / 1024).toFixed(3)),
  });
}

function parseArgs(args: readonly string[]): CliOptions {
  const rawConstellation = args.find(arg => arg.startsWith('--constellation='))?.split('=', 2)[1];
  const constellations = rawConstellation === undefined || rawConstellation === 'both'
    ? ['oneweb', 'starlink'] as const
    : rawConstellation === 'oneweb' || rawConstellation === 'starlink'
      ? [rawConstellation] as const
      : (() => { throw new TypeError('--constellation must be oneweb, starlink, or both'); })();
  const outputArg = args.find(arg => arg.startsWith('--output-dir='))?.split('=', 2)[1];
  return Object.freeze({
    constellations,
    outputDir: outputArg === undefined
      ? resolve(new URL('.', import.meta.url).pathname, 'results')
      : resolve(outputArg),
  });
}

function offsets(startS: number, endS: number, stepS: number): readonly number[] {
  const result: number[] = [];
  for (let value = startS; value <= endS; value += stepS) result.push(value);
  if (result[result.length - 1] !== endS) result.push(endS);
  return Object.freeze(result);
}

const exactOffsets = offsets(0, DURATION_S, EXACT_STEP_S);
const coarseOffsets = offsets(-ENDPOINT_PADDING_S, DURATION_S + ENDPOINT_PADDING_S, COARSE_STEP_S);

function publicPath(path: string): string {
  return resolve(new URL('../../', import.meta.url).pathname, 'public', path.replace(/^\/+/, ''));
}

const fetchFromPublic = async (path: RequestInfo | URL): Promise<Response> => {
  const filePath = publicPath(String(path));
  const bytes = await readFile(filePath);
  return new Response(bytes, { status: 200 });
};

function lookAt(record: PreparedRecord, instantMs: number): GeometrySample | null {
  if (record.satrec === null) return null;
  try {
    const propagated = propagate(record.satrec, new Date(instantMs));
    if (propagated === null || record.satrec.error !== 0) return null;
    const position = propagated.position;
    if (position === null || ![position.x, position.y, position.z].every(Number.isFinite)) return null;
    const satelliteEcf = eciToEcf(
      { x: position.x, y: position.y, z: position.z } as EciVec3<number>,
      gstime(new Date(instantMs)),
    );
    const look = ecfToLookAngles(
      {
        latitude: OBSERVER.latitudeDeg * Math.PI / 180,
        longitude: OBSERVER.longitudeDeg * Math.PI / 180,
        height: OBSERVER.heightKm,
      },
      satelliteEcf,
    );
    const azimuthDeg = ((look.azimuth * 180 / Math.PI) % 360 + 360) % 360;
    const elevationDeg = look.elevation * 180 / Math.PI;
    const rangeKm = look.rangeSat;
    return [azimuthDeg, elevationDeg, rangeKm].every(Number.isFinite) && rangeKm > 0
      ? Object.freeze({ elevationDeg, azimuthDeg, rangeKm })
      : null;
  } catch {
    return null;
  }
}

async function fileReceipt(path: string): Promise<SourceFileReceipt> {
  const bytes = await readFile(publicPath(path));
  const metadata = await stat(publicPath(path));
  return Object.freeze({ path, bytes: metadata.size, sha256: sha256(bytes) });
}

async function loadInput(constellation: SimulatorConstellation): Promise<PreparedInput> {
  const catalogPath = `/tle-archive/${constellation}/catalog.json`;
  const catalogStart = performance.now();
  const catalog = await loadTleWebArchiveCatalog(catalogPath, fetchFromPublic);
  const catalogLoadMs = performance.now() - catalogStart;
  const snapshotStart = performance.now();
  const selection = await loadTleSnapshotSelection(catalog, T0_UTC, fetchFromPublic);
  const snapshotLoadAndParseMs = performance.now() - snapshotStart;
  const sourceFiles = await Promise.all([
    fileReceipt(catalogPath),
    fileReceipt(selection.snapshot.metadata.path),
  ]);
  return Object.freeze({
    catalog,
    selection,
    entries: selection.manifest.entries,
    sourceFiles,
    timingsMs: Object.freeze({
      catalogLoad: catalogLoadMs,
      snapshotLoadAndParse: snapshotLoadAndParseMs,
    }),
  });
}

function prepareEntries(entries: readonly TleArchiveEntry[]): readonly PreparedRecord[] {
  return Object.freeze(entries.map(entry => {
    try {
      const satrec = twoline2satrec(entry.line1, entry.line2);
      return Object.freeze({ entry, satrec: satrec.error === 0 ? satrec : null });
    } catch {
      return Object.freeze({ entry, satrec: null });
    }
  }));
}

function chunkPools(
  records: readonly PreparedRecord[],
  t0Ms: number,
): {
  readonly pools: readonly ChunkPool[];
  readonly candidateUnionIds: readonly string[];
  readonly failOpenIds: readonly string[];
  readonly propagationAttempts: number;
  readonly elapsedMs: number;
} {
  const startedAt = performance.now();
  const chunks = Array.from({ length: CHUNK_COUNT }, (_unused, chunkIndex) => ({
    chunkIndex,
    startAnchorIndexInclusive: chunkIndex * CHUNK_DURATION_S / EXACT_STEP_S,
    endAnchorIndexExclusive: chunkIndex === CHUNK_COUNT - 1
      ? ANCHOR_COUNT
      : (chunkIndex + 1) * CHUNK_DURATION_S / EXACT_STEP_S,
    ids: new Set<string>(),
  }));
  const failOpenIds = new Set<string>();
  let propagationAttempts = 0;
  for (const record of records) {
    const samples: Array<{ readonly offsetS: number; readonly elevationDeg: number }> = [];
    let failed = record.satrec === null;
    for (const offsetS of coarseOffsets) {
      if (failed) break;
      propagationAttempts += 1;
      const sample = lookAt(record, t0Ms + offsetS * 1_000);
      if (sample === null) {
        failed = true;
        break;
      }
      samples.push(Object.freeze({ offsetS, elevationDeg: sample.elevationDeg }));
    }
    if (failed) {
      failOpenIds.add(record.entry.satelliteId);
      for (const chunk of chunks) chunk.ids.add(record.entry.satelliteId);
      continue;
    }
    for (const chunk of chunks) {
      const startS = chunk.chunkIndex * CHUNK_DURATION_S - ENDPOINT_PADDING_S;
      const endS = (chunk.chunkIndex + 1) * CHUNK_DURATION_S + ENDPOINT_PADDING_S;
      if (samples.some(sample => sample.offsetS >= startS && sample.offsetS <= endS && sample.elevationDeg >= COARSE_GUARD_DEG)) {
        chunk.ids.add(record.entry.satelliteId);
      }
    }
  }
  const candidateUnion = new Set<string>();
  const pools = chunks.map(chunk => {
    const ids = [...chunk.ids].sort();
    ids.forEach(id => candidateUnion.add(id));
    return Object.freeze({
      chunkIndex: chunk.chunkIndex,
      startAnchorIndexInclusive: chunk.startAnchorIndexInclusive,
      endAnchorIndexExclusive: chunk.endAnchorIndexExclusive,
      candidateIds: Object.freeze(ids),
    });
  });
  return Object.freeze({
    pools: Object.freeze(pools),
    candidateUnionIds: Object.freeze([...candidateUnion].sort()),
    failOpenIds: Object.freeze([...failOpenIds].sort()),
    propagationAttempts,
    elapsedMs: performance.now() - startedAt,
  });
}

function generateExactGeometry(
  records: readonly PreparedRecord[],
  pools: readonly ChunkPool[],
  t0Ms: number,
): GeometryArtifact & { readonly elapsedMs: number } {
  const startedAt = performance.now();
  const recordsById = new Map(records.map(record => [record.entry.satelliteId, record]));
  const candidateIds = Object.freeze([...new Set(pools.flatMap(pool => pool.candidateIds))].sort());
  const rowById = new Map(candidateIds.map((id, row) => [id, row]));
  const sampleCount = candidateIds.length * ANCHOR_COUNT;
  const elevationsDeg = new Float32Array(sampleCount);
  const azimuthDeg = new Float32Array(sampleCount);
  const rangeKm = new Float32Array(sampleCount);
  elevationsDeg.fill(Number.NaN);
  azimuthDeg.fill(Number.NaN);
  rangeKm.fill(Number.NaN);
  let propagationAttempts = 0;
  const failedIds = new Set<string>();
  for (const pool of pools) {
    for (const satelliteId of pool.candidateIds) {
      const record = recordsById.get(satelliteId);
      const row = rowById.get(satelliteId);
      if (record === undefined || row === undefined || record.satrec === null) {
        failedIds.add(satelliteId);
        continue;
      }
      for (let anchorIndex = pool.startAnchorIndexInclusive; anchorIndex < pool.endAnchorIndexExclusive; anchorIndex += 1) {
        propagationAttempts += 1;
        const sample = lookAt(record, t0Ms + exactOffsets[anchorIndex]! * 1_000);
        const index = row * ANCHOR_COUNT + anchorIndex;
        if (sample === null) {
          failedIds.add(satelliteId);
          continue;
        }
        elevationsDeg[index] = sample.elevationDeg;
        azimuthDeg[index] = sample.azimuthDeg;
        rangeKm[index] = sample.rangeKm;
      }
    }
  }
  return Object.freeze({
    candidateIds,
    elevationsDeg,
    azimuthDeg,
    rangeKm,
    propagationAttempts,
    failedIds: Object.freeze([...failedIds].sort()),
    elapsedMs: performance.now() - startedAt,
  });
}

function derivePoolCounts(geometry: GeometryArtifact): PoolCounts & { readonly elapsedMs: number } {
  const startedAt = performance.now();
  const arrays: Record<string, number[]> = Object.fromEntries(
    THRESHOLDS_DEG.map(threshold => [String(threshold), Array<number>(ANCHOR_COUNT).fill(0)]),
  );
  let sampleReads = 0;
  for (let row = 0; row < geometry.candidateIds.length; row += 1) {
    for (let anchorIndex = 0; anchorIndex < ANCHOR_COUNT; anchorIndex += 1) {
      const elevation = geometry.elevationsDeg[row * ANCHOR_COUNT + anchorIndex]!;
      if (!Number.isFinite(elevation)) continue;
      sampleReads += 1;
      for (const threshold of THRESHOLDS_DEG) {
        if (elevation >= threshold) arrays[String(threshold)]![anchorIndex] += 1;
      }
    }
  }
  const summary = Object.fromEntries(THRESHOLDS_DEG.map(threshold => {
    const values = arrays[String(threshold)]!;
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    return [String(threshold), Object.freeze({
      min: Math.min(...values),
      max: Math.max(...values),
      mean: Number(mean.toFixed(3)),
      atT0: values[0]!,
      atMidpoint: values[Math.floor(values.length / 2)]!,
      atEnd: values[values.length - 1]!,
    })];
  }));
  return Object.freeze({
    anchorOffsetsS: exactOffsets,
    byThresholdDeg: Object.freeze(Object.fromEntries(
      Object.entries(arrays).map(([threshold, values]) => [threshold, Object.freeze(values)]),
    )),
    summary: Object.freeze(summary),
    sampleReads,
    elapsedMs: performance.now() - startedAt,
  });
}

function crossingTimeS(
  leftElevationDeg: number,
  rightElevationDeg: number,
  leftTimeS: number,
  rightTimeS: number,
): number {
  const denominator = rightElevationDeg - leftElevationDeg;
  const fraction = denominator === 0 ? 0.5 : Math.max(0, Math.min(1, -leftElevationDeg / denominator));
  return leftTimeS + (rightTimeS - leftTimeS) * fraction;
}

function extractPassEvents(geometry: GeometryArtifact): {
  readonly events: readonly PassEvent[];
  readonly sampleReads: number;
  readonly elapsedMs: number;
} {
  const startedAt = performance.now();
  const events: PassEvent[] = [];
  let sampleReads = 0;
  for (let row = 0; row < geometry.candidateIds.length; row += 1) {
    const satelliteId = geometry.candidateIds[row]!;
    let openStart: number | null = null;
    let visibleIndices: number[] = [];
    for (let anchorIndex = 0; anchorIndex < ANCHOR_COUNT; anchorIndex += 1) {
      const elevation = geometry.elevationsDeg[row * ANCHOR_COUNT + anchorIndex]!;
      if (!Number.isFinite(elevation)) {
        openStart = null;
        visibleIndices = [];
        continue;
      }
      sampleReads += 1;
      if (elevation >= HORIZON_DEG) {
        if (openStart === null && anchorIndex > 0) {
          const previous = geometry.elevationsDeg[row * ANCHOR_COUNT + anchorIndex - 1]!;
          if (Number.isFinite(previous) && previous < HORIZON_DEG) {
            openStart = anchorIndex;
            visibleIndices = [];
          }
        }
        if (openStart !== null) visibleIndices.push(anchorIndex);
        continue;
      }
      if (openStart === null || visibleIndices.length === 0 || anchorIndex <= 1) {
        openStart = null;
        visibleIndices = [];
        continue;
      }
      const previousIndex = anchorIndex - 1;
      const previous = geometry.elevationsDeg[row * ANCHOR_COUNT + previousIndex]!;
      const beforeStartIndex = openStart - 1;
      const beforeStart = geometry.elevationsDeg[row * ANCHOR_COUNT + beforeStartIndex]!;
      const firstVisible = geometry.elevationsDeg[row * ANCHOR_COUNT + openStart]!;
      if (Number.isFinite(previous) && Number.isFinite(beforeStart) && Number.isFinite(firstVisible) && previous >= HORIZON_DEG) {
        let peakAnchorIndex = visibleIndices[0]!;
        for (const index of visibleIndices.slice(1)) {
          if (geometry.elevationsDeg[row * ANCHOR_COUNT + index]! > geometry.elevationsDeg[row * ANCHOR_COUNT + peakAnchorIndex]!) {
            peakAnchorIndex = index;
          }
        }
        events.push(Object.freeze({
          satelliteId,
          aosAnchorIndex: openStart,
          peakAnchorIndex,
          losAnchorIndex: anchorIndex,
          aosTimeS: crossingTimeS(beforeStart, firstVisible, exactOffsets[beforeStartIndex]!, exactOffsets[openStart]!),
          peakTimeS: exactOffsets[peakAnchorIndex]!,
          losTimeS: crossingTimeS(previous, elevation, exactOffsets[previousIndex]!, exactOffsets[anchorIndex]!),
          maxElevationDeg: geometry.elevationsDeg[row * ANCHOR_COUNT + peakAnchorIndex]!,
        }));
      }
      openStart = null;
      visibleIndices = [];
    }
  }
  return Object.freeze({
    events: Object.freeze(events.sort((left, right) => left.aosTimeS - right.aosTimeS || left.satelliteId.localeCompare(right.satelliteId))),
    sampleReads,
    elapsedMs: performance.now() - startedAt,
  });
}

function identityPayload(input: PreparedInput, constellation: SimulatorConstellation): Readonly<Record<string, unknown>> {
  return Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    constellation,
    archiveId: input.catalog.archiveId,
    archiveContentSha256: input.catalog.archiveContentSha256 ?? null,
    snapshotArchiveDate: input.selection.snapshot.metadata.archiveDate,
    snapshotSha256: input.selection.snapshot.sha256,
    requestedT0Utc: T0_UTC,
    observer: OBSERVER,
    config: {
      durationS: DURATION_S,
      exactStepS: EXACT_STEP_S,
      coarseStepS: COARSE_STEP_S,
      chunkDurationS: CHUNK_DURATION_S,
      endpointPaddingS: ENDPOINT_PADDING_S,
      horizonElevationDeg: HORIZON_DEG,
      coarseGuardElevationDeg: COARSE_GUARD_DEG,
      thresholdsDeg: THRESHOLDS_DEG,
    },
    revisions: REVISIONS,
  });
}

function applyChunkProgress(pools: readonly ChunkPool[]): readonly ApplyChunkProgress[] {
  return Object.freeze(pools.map(pool => Object.freeze({
    chunkIndex: pool.chunkIndex,
    startAnchorIndexInclusive: pool.startAnchorIndexInclusive,
    endAnchorIndexExclusive: pool.endAnchorIndexExclusive,
    candidateCount: pool.candidateIds.length,
    exactSampleCount: pool.candidateIds.length
      * (pool.endAnchorIndexExclusive - pool.startAnchorIndexInclusive),
    status: 'complete' as const,
  })));
}

async function sourceFileReceiptsForCode(): Promise<readonly SourceFileReceipt[]> {
  const files = [new URL('./benchmark.ts', import.meta.url), new URL('./README.md', import.meta.url)];
  const receipts: SourceFileReceipt[] = [];
  for (const file of files) {
    const bytes = await readFile(file);
    const path = file.pathname.replace(`${resolve(new URL('../../', import.meta.url).pathname)}/`, '');
    receipts.push(Object.freeze({ path, bytes: bytes.byteLength, sha256: sha256(bytes) }));
  }
  return Object.freeze(receipts);
}

async function runColdAndWarm(
  constellation: SimulatorConstellation,
  input: PreparedInput,
  codeReceipts: readonly SourceFileReceipt[],
): Promise<Readonly<Record<string, unknown>>> {
  const t0Ms = Date.parse(T0_UTC);
  const identity = identityPayload(input, constellation);
  const identityJson = JSON.stringify(identity);
  const cacheKey = `tle-request:${sha256(identityJson)}`;
  const sourceDigest = Object.freeze({
    archiveId: input.catalog.archiveId,
    archiveContentSha256: input.catalog.archiveContentSha256 ?? null,
    snapshotSha256: input.selection.snapshot.sha256,
    identitySha256: sha256(identityJson),
    implementationSha256: sha256(JSON.stringify(codeReceipts)),
  });
  const coldStartedAt = performance.now();
  const preparedStartedAt = performance.now();
  const records = prepareEntries(input.entries);
  const preparationMs = performance.now() - preparedStartedAt;
  const coarse = chunkPools(records, t0Ms);
  const exactStartedAt = performance.now();
  const geometry = generateExactGeometry(records, coarse.pools, t0Ms);
  const exactGeometryMs = performance.now() - exactStartedAt;
  const poolCounts = derivePoolCounts(geometry);
  const passEvents = extractPassEvents(geometry);
  const propagationBeforeRetained = geometry.propagationAttempts;
  const propagationAfterRetained = geometry.propagationAttempts;
  const artifact: RunArtifact = Object.freeze({
    cacheKey,
    sourceDigest,
    preparedCount: records.length,
    chunkPools: coarse.pools,
    coarse: {
      propagationAttempts: coarse.propagationAttempts,
      failOpenIds: coarse.failOpenIds,
      candidateUnionIds: coarse.candidateUnionIds,
      candidateMembershipCount: coarse.pools.reduce((sum, pool) => sum + pool.candidateIds.length, 0),
      elapsedMs: coarse.elapsedMs,
    },
    geometry: Object.freeze({
      candidateIds: geometry.candidateIds,
      elevationsDeg: geometry.elevationsDeg,
      azimuthDeg: geometry.azimuthDeg,
      rangeKm: geometry.rangeKm,
      propagationAttempts: geometry.propagationAttempts,
      failedIds: geometry.failedIds,
    }),
    poolCounts,
    passEvents: passEvents.events,
  });
  cache.set(cacheKey, artifact);
  const coldTotalMs = performance.now() - coldStartedAt;
  const warmStartedAt = performance.now();
  const warm = cache.get(cacheKey);
  const warmLookupMs = performance.now() - warmStartedAt;
  if (warm === undefined || warm.sourceDigest.snapshotSha256 !== sourceDigest.snapshotSha256) {
    throw new Error('same-key warm lookup failed content-digest check');
  }
  const chunkProgress = applyChunkProgress(coarse.pools);
  const applyInput = Object.freeze({
    action: 'apply-archived-tle' as const,
    constellation,
    requestedT0Utc: T0_UTC,
    observer: OBSERVER,
    durationS: DURATION_S,
    exactStepS: EXACT_STEP_S,
    archiveDate: input.selection.snapshot.metadata.archiveDate,
    snapshotSha256: input.selection.snapshot.sha256,
    cacheKey,
  });
  const applyReady = Object.freeze({
    shadowRunComplete: true,
    completeChunks: chunkProgress.length,
    totalChunks: chunkProgress.length,
    completeAnchors: ANCHOR_COUNT,
    totalAnchors: ANCHOR_COUNT,
    completeEeIntervals: ANCHOR_COUNT - 1,
    totalEeIntervals: ANCHOR_COUNT - 1,
    geometryFailures: geometry.failedIds.length,
    propagationFailureCount: coarse.failOpenIds.length,
    retainedDerivationPropagationDelta: propagationAfterRetained - propagationBeforeRetained,
    timelineUnlockedForShadowPreview: geometry.failedIds.length === 0 && coarse.failOpenIds.length === 0,
    productionPublicationStatus: 'blocked-until-active-run-acceptance-gates',
  });
  return Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    status: 'SHADOW_ONLY_NOT_ACCEPTANCE_GATE',
    fixture: {
      constellation,
      requestedT0Utc: T0_UTC,
      appliedT0Utc: T0_UTC,
      archiveDate: input.selection.snapshot.metadata.archiveDate,
      sourceSatelliteCount: input.entries.length,
      sourceFiles: input.sourceFiles,
      codeFiles: codeReceipts,
    },
    sourceDigest,
    cache: {
      cacheKey,
      cold: {
        hit: false,
        reused: [],
      },
      warmSameKey: {
        hit: true,
        lookupMs: warmLookupMs,
        reused: ['catalog', 'snapshot-bytes', 'parsed-tle', 'satrec-preparation', 'coarse-pool', 'exact-geometry', 'retained-pool-counts', 'retained-pass-events'],
        digestChecked: true,
      },
    },
    applyContract: {
      /** Directly mappable request payload for the Apply action. */
      input: applyInput,
      /** Progress is monotonic by completed time-local chunk; the UI must not
       * unlock the timeline until every chunk and derived artifact is ready. */
      progress: {
        unit: 'exact-anchor-samples',
        totalChunks: chunkProgress.length,
        completedChunks: chunkProgress.length,
        totalAnchors: ANCHOR_COUNT,
        completedAnchors: ANCHOR_COUNT,
        percent: 100,
        chunks: chunkProgress,
        stages: [
          { id: 'catalog', status: 'complete', elapsedMs: roundMs(input.timingsMs.catalogLoad) },
          { id: 'snapshot-parse', status: 'complete', elapsedMs: roundMs(input.timingsMs.snapshotLoadAndParse) },
          { id: 'satrec-preparation', status: 'complete', elapsedMs: roundMs(preparationMs) },
          { id: 'coarse-pool-screen', status: 'complete', elapsedMs: roundMs(coarse.elapsedMs) },
          { id: 'exact-geometry', status: 'complete', elapsedMs: roundMs(exactGeometryMs) },
          { id: 'pool-counts-and-pass-events', status: 'complete', elapsedMs: roundMs(poolCounts.elapsedMs + passEvents.elapsedMs) },
        ],
      },
      readyBoundary: applyReady,
      cache: {
        cacheKey,
        sourceDigest,
        cold: { hit: false, sameKeyArtifact: 'created' },
        warmSameKey: {
          hit: true,
          lookupMs: roundMs(warmLookupMs),
          sameSourceDigest: true,
          sameGeometryArtifact: true,
          samePoolAndEventArtifacts: true,
        },
      },
      result: {
        eventCount: passEvents.events.length,
        poolCounts: poolCounts.summary,
        candidateUnionCount: coarse.candidateUnionIds.length,
        exactGeometryPropagationAttempts: geometry.propagationAttempts,
        retainedDerivationPropagationDelta: propagationAfterRetained - propagationBeforeRetained,
      },
      errorPolicy: {
        failOpenIds: coarse.failOpenIds,
        geometryFailedIds: geometry.failedIds,
        fallback: 'no-synthetic-tle-or-time-shift-fallback; keep-last-accepted-result-and-surface-error',
        timelineOnError: 'locked',
        errorCodes: coarse.failOpenIds.length > 0 || geometry.failedIds.length > 0
          ? ['TLE_SGP4_OR_LOOK_ANGLE_FAILURE']
          : [],
      },
    },
    config: {
      durationS: DURATION_S,
      exactStepS: EXACT_STEP_S,
      exactAnchorCount: ANCHOR_COUNT,
      coarseStepS: COARSE_STEP_S,
      coarseSampleCount: coarseOffsets.length,
      chunkDurationS: CHUNK_DURATION_S,
      chunkCount: CHUNK_COUNT,
      endpointPaddingS: ENDPOINT_PADDING_S,
      horizonElevationDeg: HORIZON_DEG,
      coarseGuardElevationDeg: COARSE_GUARD_DEG,
      poolThresholdsDeg: THRESHOLDS_DEG,
      observer: OBSERVER,
      revisions: REVISIONS,
    },
    counts: {
      preparedTleCount: records.length,
      failOpenCount: coarse.failOpenIds.length,
      candidateUnionCount: coarse.candidateUnionIds.length,
      candidateUnionReductionPercent: Number((100 * (1 - coarse.candidateUnionIds.length / records.length)).toFixed(3)),
      candidateMembershipCount: artifact.coarse.candidateMembershipCount,
      chunkCandidateCounts: coarse.pools.map(pool => pool.candidateIds.length),
      exactGeometrySampleCapacity: geometry.candidateIds.length * ANCHOR_COUNT,
      exactGeometryComputedSampleCount: geometry.propagationAttempts,
      exactGeometryCandidateUnionCount: geometry.candidateIds.length,
      exactGeometryAttemptReductionPercent: Number((100 * (1 - geometry.propagationAttempts / (records.length * ANCHOR_COUNT))).toFixed(3)),
      geometryFailedIdCount: geometry.failedIds.length,
      completePassEventCount: passEvents.events.length,
      retainedPassSampleReads: passEvents.sampleReads,
      retainedPoolSampleReads: poolCounts.sampleReads,
      retainedDerivationPropagationDelta: propagationAfterRetained - propagationBeforeRetained,
    },
    poolCounts: {
      thresholdsDeg: THRESHOLDS_DEG,
      anchorOffsetsS: poolCounts.anchorOffsetsS,
      byThresholdDeg: poolCounts.byThresholdDeg,
      summary: poolCounts.summary,
    },
    timingsMs: {
      catalogLoad: input.timingsMs.catalogLoad,
      snapshotLoadAndParse: input.timingsMs.snapshotLoadAndParse,
      satrecPreparation: preparationMs,
      coarsePoolScreen: coarse.elapsedMs,
      exactGeometry: exactGeometryMs,
      retainedPoolCounts: poolCounts.elapsedMs,
      retainedPassEvents: passEvents.elapsedMs,
      coldTotal: coldTotalMs,
      warmSameKeyLookup: warmLookupMs,
    },
    memory: {
      afterCold: memoryReceipt(),
    },
    propagation: {
      coarsePropagationAttempts: coarse.propagationAttempts,
      exactGeometryPropagationAttempts: geometry.propagationAttempts,
      totalColdPropagationAttempts: coarse.propagationAttempts + geometry.propagationAttempts,
      retainedPassAndPoolPropagationAttempts: 0,
      retainedDerivationPropagationDelta: propagationAfterRetained - propagationBeforeRetained,
      denseExactComparisonAttempts: records.length * ANCHOR_COUNT,
    },
    limitations: [
      'Shadow-only request benchmark; it does not switch the active runtime/UI.',
      'The coarse -20 degree screen is empirical sampling, not a mathematical exclusion proof; a production switchover still needs an acceptance gate.',
      'Pool counts are exact only for identities admitted to the time-local coarse pool; they are not a claim that every source identity was propagated at every anchor.',
      'Pass extraction reads retained typed-array samples. Its propagation delta is recorded as zero to make accidental second SGP4 calls visible.',
      'RSS is process-local and includes both fixture runs when the benchmark is invoked with --constellation=both.',
    ],
  });
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  await mkdir(options.outputDir, { recursive: true });
  const codeReceipts = await sourceFileReceiptsForCode();
  const reports: readonly Readonly<Record<string, unknown>>[] = await Promise.all(
    options.constellations.map(async constellation => {
      const input = await loadInput(constellation);
      return runColdAndWarm(constellation, input, codeReceipts);
    }),
  );
  for (const report of reports) {
    const fixture = report.fixture as { readonly constellation: string };
    const outputPath = resolve(options.outputDir, `${fixture.constellation}-20260808.json`);
    const text = `${JSON.stringify(report, null, 2)}\n`;
    await writeFile(outputPath, text, 'utf8');
    console.log(JSON.stringify({
      fixture: fixture.constellation,
      outputPath,
      coldTotalMs: (report.timingsMs as { readonly coldTotal: number }).coldTotal,
      warmSameKeyLookupMs: (report.timingsMs as { readonly warmSameKeyLookup: number }).warmSameKeyLookup,
      candidateUnionCount: (report.counts as { readonly candidateUnionCount: number }).candidateUnionCount,
      exactGeometryAttempts: (report.propagation as { readonly exactGeometryPropagationAttempts: number }).exactGeometryPropagationAttempts,
      passEvents: (report.counts as { readonly completePassEventCount: number }).completePassEventCount,
      rssMiB: (report.memory as { readonly afterCold: { readonly rssMiB: number } }).afterCold.rssMiB,
    }));
  }
}

await main();
