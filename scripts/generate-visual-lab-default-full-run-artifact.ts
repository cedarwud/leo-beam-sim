import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync, gunzipSync, strFromU8 } from 'fflate';

import {
  createSelectableTlePassIndexKey,
  createSelectableTleRunKey,
  SELECTABLE_TLE_ARTIFACT_SCHEMA,
  validateSelectableTleArtifactManifest,
  verifySelectableTleArtifactIdentity,
  type ValidatedTleArtifactManifest,
} from '../src/tle/runArtifact';
import {
  buildTleRunBundle,
  createTleRunBundleSnapshot,
  TLE_RUN_ANCHOR_COUNT,
  TLE_RUN_APPROVED_CANDIDATE_POOL_OPTIONS,
  TLE_RUN_STEP_S,
} from '../src/tle/run';
import {
  buildTleAnalysisRun,
  createTleAnalysisRunSnapshot,
  TLE_ANALYSIS_RUN_SNAPSHOT_SCHEMA,
  hydrateTleAnalysisRunSnapshot,
} from '../src/simulator/tleAnalysisRun';
import {
  loadTleSnapshotSelection,
  loadTleWebArchiveCatalog,
} from '../src/simulator/archive';
import {
  DEFAULT_SIMULATOR_PARAMETERS,
  SIMULATOR_CATALOG_URLS,
  SIMULATOR_CONTRACT_VERSION,
} from '../src/simulator/types';
import { NTPU_TLE_OBSERVER } from '../src/simulator/observer';
import {
  VISUAL_LAB_DEFAULT_FULL_RUN_ARTIFACT_FORMULA_VERSION,
  VISUAL_LAB_DEFAULT_FULL_RUN_ARTIFACT_LINK_SHAPE_VERSION,
  VISUAL_LAB_DEFAULT_FULL_RUN_ARTIFACT_SCHEMA,
  VISUAL_LAB_DEFAULT_FULL_RUN_ARTIFACT_PROTOCOL,
  VISUAL_LAB_DEFAULT_FULL_RUN_GEOMETRY_ENCODING,
  type VisualLabDefaultFullRunArtifactManifest,
} from '../src/ui/signal-tuning/defaultVisualLabFullRunArtifact';
import {
  LATEST_TLE_ARCHIVE_DATES,
  LATEST_TLE_REFERENCE_ARTIFACT_DATE,
  LATEST_TLE_REFERENCE_INSTANT_UTC,
} from '../src/tle/latestTleDefaults';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = join(repoRoot, `public/visual-lab-default-full-run/starlink-${LATEST_TLE_REFERENCE_ARTIFACT_DATE}`);
const manifestPath = join(outputRoot, 'manifest.json');
const analysisPath = join(outputRoot, 'analysis.json.gz');
const geometryPath = join(outputRoot, 'geometry.bin');
const requestedInstantUtc = LATEST_TLE_REFERENCE_INSTANT_UTC;
const defaultFrameOptions = Object.freeze({ userPositionOverridesKm: Object.freeze([]) });

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function jsonBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

function fetchFromPublic(input: RequestInfo | URL): Promise<Response> {
  const relativePath = String(input).replace(/^\/+/, '');
  return readFile(join(repoRoot, 'public', relativePath)).then(bytes => (
    new Response(bytes, { status: 200 })
  ));
}

function parametersSha256(): string {
  return sha256(jsonBytes(DEFAULT_SIMULATOR_PARAMETERS));
}

function geometryConfig() {
  return {
    durationS: 7_200,
    stepS: 30,
    anchorCount: 241,
    coarseStepS: 120,
    chunkDurationS: 600,
    endpointPaddingS: 120,
    horizonElevationDeg: 0,
    coarseGuardElevationDeg: -20,
  } as const;
}

function sourceSnapshotKey(path: string): string {
  return path.replace(/^\/+/, '');
}

function geometryBytesFromSnapshot(snapshot: ReturnType<typeof createTleRunBundleSnapshot>): Uint8Array {
  const positions = new Uint8Array(
    snapshot.positionsTemeKm.buffer,
    snapshot.positionsTemeKm.byteOffset,
    snapshot.positionsTemeKm.byteLength,
  );
  const velocities = new Uint8Array(
    snapshot.velocitiesTemeKmPerSec.buffer,
    snapshot.velocitiesTemeKmPerSec.byteOffset,
    snapshot.velocitiesTemeKmPerSec.byteLength,
  );
  const output = new Uint8Array(positions.byteLength + velocities.byteLength);
  output.set(positions, 0);
  output.set(velocities, positions.byteLength);
  return output;
}

function serializableAnalysisSnapshot(
  snapshot: ReturnType<typeof createTleAnalysisRunSnapshot>,
): unknown {
  const geometryRun = snapshot.geometryRun;
  const {
    positionsTemeKm: _positionsTemeKm,
    velocitiesTemeKmPerSec: _velocitiesTemeKmPerSec,
    positions: _positions,
    velocities: _velocities,
    ...geometryWithoutArrays
  } = geometryRun;
  void _positionsTemeKm;
  void _velocitiesTemeKmPerSec;
  void _positions;
  void _velocities;
  // The measured propagation wall time is an execution metric, not part of
  // the scientific run identity.  A published immutable artifact must be
  // byte-reproducible across generation hosts; keep the field for the normal
  // snapshot contract but canonicalize it to zero rather than baking in a
  // machine/timing-dependent value.
  const computationMetrics = {
    ...geometryRun.computationMetrics,
    wallTimeMs: 0,
  };
  return {
    ...snapshot,
    geometryRun: {
      ...geometryWithoutArrays,
      computationMetrics,
    },
  };
}

async function buildPayloadIdentity(
  selection: Awaited<ReturnType<typeof loadTleSnapshotSelection>>,
  geometryRunId: string,
  analysisRunId: string,
): Promise<{ readonly runKey: string; readonly passIndexKey: string }> {
  const bootstrapBytes = new TextEncoder().encode('visual-lab-default-full-run-bootstrap-v1');
  const bootstrapSha256 = sha256(bootstrapBytes);
  const draft = {
    schema: SELECTABLE_TLE_ARTIFACT_SCHEMA,
    status: 'bootstrap',
    runKey: `selectable-tle-run:${'0'.repeat(64)}`,
    passIndexKey: `tle-pass-index:${'0'.repeat(64)}`,
    geometryRunId,
    source: {
      archiveId: 'starlink' as const,
      publicationSha256: selection.snapshot.sha256,
      sourceSnapshotDigest: selection.snapshot.sha256,
      snapshotKey: sourceSnapshotKey(selection.snapshot.metadata.path),
      snapshotSha256: selection.snapshot.sha256,
      requestedT0Utc: requestedInstantUtc,
      appliedT0Utc: requestedInstantUtc,
    },
    geometry: {
      ...geometryConfig(),
      observerId: NTPU_TLE_OBSERVER.id,
      observerCoordinates: {
        latitudeDeg: NTPU_TLE_OBSERVER.latitudeDeg,
        longitudeDeg: NTPU_TLE_OBSERVER.longitudeDeg,
        altitudeM: NTPU_TLE_OBSERVER.heightKm * 1_000,
      },
      visibilityPolicyRevision: 'ntpu-observer-horizon-v1',
      coarseIndexRevision: 'dense-baseline-v1',
      exactSgp4Revision: 'satellite-js-sgp4-v1',
    },
    analysis: {
      canonicalScenarioRevision: SIMULATOR_CONTRACT_VERSION,
      parametersSha256: parametersSha256(),
      formulaVersion: VISUAL_LAB_DEFAULT_FULL_RUN_ARTIFACT_FORMULA_VERSION,
      linkShapeVersion: VISUAL_LAB_DEFAULT_FULL_RUN_ARTIFACT_LINK_SHAPE_VERSION,
      analysisRunId,
    },
    chunks: {
      bootstrapFrame: {
        kind: 'bootstrap-frame' as const,
        schema: 'bootstrap-frame-v1',
        contentSha256: bootstrapSha256,
        byteLength: bootstrapBytes.byteLength,
        immutableKey: `default-full-run/${bootstrapSha256}/bootstrap-frame.json`,
      },
    },
  } satisfies ValidatedTleArtifactManifest;
  const parsed = validateSelectableTleArtifactManifest(draft);
  const passIndexKey = await createSelectableTlePassIndexKey(parsed);
  const runKey = await createSelectableTleRunKey({ ...parsed, passIndexKey });
  await verifySelectableTleArtifactIdentity({ ...parsed, passIndexKey, runKey });
  return { runKey, passIndexKey };
}

async function makeArtifact(): Promise<{
  readonly manifest: VisualLabDefaultFullRunArtifactManifest;
  readonly analysisBytes: Uint8Array;
  readonly geometryBytes: Uint8Array;
  readonly runAnchorCount: number;
  readonly satelliteCount: number;
}> {
  const catalog = await loadTleWebArchiveCatalog(SIMULATOR_CATALOG_URLS.starlink, fetchFromPublic);
  const selection = await loadTleSnapshotSelection(catalog, requestedInstantUtc, fetchFromPublic);
  if (selection.snapshot.metadata.archiveDate !== LATEST_TLE_ARCHIVE_DATES.starlink) {
    throw new Error(`default artifact snapshot date drifted: ${selection.snapshot.metadata.archiveDate}`);
  }
  const geometryRun = await buildTleRunBundle({
    selection,
    t0Utc: requestedInstantUtc,
    candidatePool: TLE_RUN_APPROVED_CANDIDATE_POOL_OPTIONS,
    yieldEveryAnchors: TLE_RUN_ANCHOR_COUNT,
  });
  const analysisRun = buildTleAnalysisRun({
    selection,
    geometryRun,
    parameters: DEFAULT_SIMULATOR_PARAMETERS,
    frameOptions: defaultFrameOptions,
  });
  const snapshot = createTleAnalysisRunSnapshot(analysisRun);
  const geometrySnapshot = createTleRunBundleSnapshot(geometryRun);
  const geometryBytes = geometryBytesFromSnapshot(geometrySnapshot);
  const analysisJson = JSON.stringify(serializableAnalysisSnapshot(snapshot));
  // Pin the gzip header timestamp so the generated public artifact is
  // reproducible and `--check` can detect actual content drift.
  const analysisBytes = gzipSync(new TextEncoder().encode(analysisJson), { level: 9, mtime: 0 });
  const identity = await buildPayloadIdentity(selection, geometryRun.runId, analysisRun.analysisRunId);
  const manifest: VisualLabDefaultFullRunArtifactManifest = {
    schema: VISUAL_LAB_DEFAULT_FULL_RUN_ARTIFACT_SCHEMA,
    protocol: VISUAL_LAB_DEFAULT_FULL_RUN_ARTIFACT_PROTOCOL,
    identity: {
      ...identity,
      geometryRunId: geometryRun.runId,
      analysisRunId: analysisRun.analysisRunId,
      sourceSnapshotDigest: selection.snapshot.sha256,
    },
    source: {
      constellation: 'starlink',
      archiveId: catalog.archiveId,
      archiveContentSha256: catalog.archiveContentSha256 ?? null,
      snapshotPath: selection.snapshot.metadata.path,
      snapshotSha256: selection.snapshot.sha256,
      requestedInstantUtc,
      appliedInstantUtc: requestedInstantUtc,
    },
    model: {
      contractVersion: SIMULATOR_CONTRACT_VERSION,
      formulaVersion: VISUAL_LAB_DEFAULT_FULL_RUN_ARTIFACT_FORMULA_VERSION,
      linkShapeVersion: VISUAL_LAB_DEFAULT_FULL_RUN_ARTIFACT_LINK_SHAPE_VERSION,
      parameters: DEFAULT_SIMULATOR_PARAMETERS,
      frameOptions: defaultFrameOptions,
    },
    snapshot: {
      schema: TLE_ANALYSIS_RUN_SNAPSHOT_SCHEMA,
      runId: snapshot.runId,
      analysisRunId: snapshot.analysisRunId,
      geometryRunId: snapshot.geometryRunId,
      anchorCount: snapshot.anchorCount,
    },
    geometry: {
      encoding: VISUAL_LAB_DEFAULT_FULL_RUN_GEOMETRY_ENCODING,
      anchorCount: geometryRun.anchorCount,
      stepS: geometryRun.stepS,
      satelliteCount: geometryRun.satelliteCount,
      scalarCountPerVector: geometryRun.anchorCount * geometryRun.satelliteCount * 3,
      byteOrder: 'little-endian-ieee754',
    },
    files: {
      analysis: {
        url: `/visual-lab-default-full-run/starlink-${LATEST_TLE_REFERENCE_ARTIFACT_DATE}/analysis.json.gz`,
        contentSha256: sha256(analysisBytes),
        byteLength: analysisBytes.byteLength,
      },
      geometry: {
        url: `/visual-lab-default-full-run/starlink-${LATEST_TLE_REFERENCE_ARTIFACT_DATE}/geometry.bin`,
        contentSha256: sha256(geometryBytes),
        byteLength: geometryBytes.byteLength,
      },
    },
  };
  return {
    manifest,
    analysisBytes,
    geometryBytes,
    runAnchorCount: analysisRun.anchorCount,
    satelliteCount: geometryRun.satelliteCount,
  };
}

async function writeOrCheck(path: string, bytes: Uint8Array, check: boolean): Promise<void> {
  let existing: Uint8Array | null = null;
  try {
    existing = new Uint8Array(await readFile(path));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  if (check) {
    if (existing === null || existing.byteLength !== bytes.byteLength || sha256(existing) !== sha256(bytes)) {
      throw new Error(`default full-run artifact is stale or missing: ${relative(repoRoot, path)}`);
    }
    return;
  }
  if (existing !== null && existing.byteLength === bytes.byteLength && sha256(existing) === sha256(bytes)) return;
  await writeFile(path, bytes);
}

const check = process.argv.includes('--check');
const built = await makeArtifact();
await mkdir(outputRoot, { recursive: true });
const manifestBytes = new TextEncoder().encode(`${JSON.stringify(built.manifest, null, 2)}\n`);
await writeOrCheck(manifestPath, manifestBytes, check);
await writeOrCheck(analysisPath, built.analysisBytes, check);
await writeOrCheck(geometryPath, built.geometryBytes, check);

// The generator itself rehydrates the exact published snapshot before it
// exits. This catches a corrupt snapshot/geometry split before a browser sees
// it, without making the checked-in artifact a second scientific producer.
const rawSnapshot = JSON.parse(strFromU8(gunzipSync(built.analysisBytes))) as Record<string, unknown>;
const geometryRun = rawSnapshot.geometryRun as Record<string, unknown>;
const positionBytes = built.geometryBytes.slice(0, built.geometryBytes.byteLength / 2);
const velocityBytes = built.geometryBytes.slice(built.geometryBytes.byteLength / 2);
geometryRun.positionsTemeKm = new Float64Array(positionBytes.buffer, positionBytes.byteOffset, positionBytes.byteLength / 8);
geometryRun.velocitiesTemeKmPerSec = new Float64Array(velocityBytes.buffer, velocityBytes.byteOffset, velocityBytes.byteLength / 8);
geometryRun.positions = geometryRun.positionsTemeKm;
geometryRun.velocities = geometryRun.velocitiesTemeKmPerSec;
const hydrated = hydrateTleAnalysisRunSnapshot(rawSnapshot as unknown as Parameters<typeof hydrateTleAnalysisRunSnapshot>[0]);
if (hydrated.anchorCount !== TLE_RUN_ANCHOR_COUNT || hydrated.geometryRun.satelliteCount !== built.satelliteCount) {
  throw new Error('generated default full-run artifact failed its own 241-anchor round-trip');
}
for (const anchorIndex of [0, TLE_RUN_ANCHOR_COUNT - 1]) {
  if (hydrated.getFrame(anchorIndex) === null) throw new Error(`generated artifact has no frame at anchor ${anchorIndex}`);
}

console.log(`${check ? 'checked' : 'generated'} ${relative(repoRoot, manifestPath)}`);
console.log(`  ${built.runAnchorCount} anchors, ${built.satelliteCount} retained satellites`);
console.log(`  analysis ${built.analysisBytes.byteLength} bytes gzip; geometry ${built.geometryBytes.byteLength} bytes`);
