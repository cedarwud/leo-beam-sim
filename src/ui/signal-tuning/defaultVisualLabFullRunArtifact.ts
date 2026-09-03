import { gunzipSync, strFromU8 } from 'fflate';

import {
  hydrateTleAnalysisRunSnapshot,
  TLE_ANALYSIS_RUN_SNAPSHOT_SCHEMA,
  type TleAnalysisRun,
  type TleAnalysisRunSnapshot,
} from '../../simulator/tleAnalysisRun';
import {
  TLE_RUN_ANCHOR_COUNT,
  TLE_RUN_STEP_S,
  type TleRunBundleSnapshot,
} from '../../tle/run';
import {
  SIMULATOR_CONTRACT_VERSION,
  type SimulatorConstellation,
  type SimulatorParameters,
  type TleWebArchiveCatalog,
} from '../../simulator/types';
import type { SimulationAnalysisFrameBuildOptions } from '../../simulator/analysis';
import { RUN_PAYLOAD_PROTOCOL_SCHEMA } from '../../tle/runPayload/types';
import type { RunPayloadIdentity } from '../../tle/runPayload/types';
import { LATEST_TLE_REFERENCE_ARTIFACT_DATE } from '../../tle/latestTleDefaults';

/**
 * A checked-in, source-bound complete run used only for the canonical default
 * request.  It is deliberately separate from the small first-frame artifact:
 * this payload contains the entire 241-anchor run and the exact geometry that
 * the Worker would otherwise have to build before publishing `ready`.
 */
export const VISUAL_LAB_DEFAULT_FULL_RUN_ARTIFACT_SCHEMA = 'visual-lab-default-full-run-artifact-v1' as const;
export const VISUAL_LAB_DEFAULT_FULL_RUN_ARTIFACT_PROTOCOL = RUN_PAYLOAD_PROTOCOL_SCHEMA;
export const VISUAL_LAB_DEFAULT_FULL_RUN_ARTIFACT_URL = `/visual-lab-default-full-run/starlink-${LATEST_TLE_REFERENCE_ARTIFACT_DATE}/manifest.json`;
export const VISUAL_LAB_DEFAULT_FULL_RUN_ARTIFACT_FORMULA_VERSION = 'angle-aware-ee-v3' as const;
export const VISUAL_LAB_DEFAULT_FULL_RUN_ARTIFACT_LINK_SHAPE_VERSION = 'canonical-link-result:before-satellite-cap-power-v1' as const;
export const VISUAL_LAB_DEFAULT_FULL_RUN_GEOMETRY_ENCODING = 'float64-anchor-major-v1' as const;

interface ArtifactFileDescriptor {
  readonly url: string;
  readonly contentSha256: string;
  readonly byteLength: number;
}

interface ArtifactSourceIdentity {
  readonly constellation: SimulatorConstellation;
  readonly archiveId: string;
  readonly archiveContentSha256: string | null;
  readonly snapshotPath: string;
  readonly snapshotSha256: string;
  readonly requestedInstantUtc: string;
  readonly appliedInstantUtc: string;
}

interface ArtifactModelIdentity {
  readonly contractVersion: typeof SIMULATOR_CONTRACT_VERSION;
  readonly formulaVersion: typeof VISUAL_LAB_DEFAULT_FULL_RUN_ARTIFACT_FORMULA_VERSION;
  readonly linkShapeVersion: typeof VISUAL_LAB_DEFAULT_FULL_RUN_ARTIFACT_LINK_SHAPE_VERSION;
  readonly parameters: SimulatorParameters;
  readonly frameOptions: Readonly<SimulationAnalysisFrameBuildOptions>;
}

interface ArtifactGeometryIdentity {
  readonly encoding: typeof VISUAL_LAB_DEFAULT_FULL_RUN_GEOMETRY_ENCODING;
  readonly anchorCount: typeof TLE_RUN_ANCHOR_COUNT;
  readonly stepS: typeof TLE_RUN_STEP_S;
  readonly satelliteCount: number;
  readonly scalarCountPerVector: number;
  readonly byteOrder: 'little-endian-ieee754';
}

export interface VisualLabDefaultFullRunArtifactManifest {
  readonly schema: typeof VISUAL_LAB_DEFAULT_FULL_RUN_ARTIFACT_SCHEMA;
  readonly protocol: typeof VISUAL_LAB_DEFAULT_FULL_RUN_ARTIFACT_PROTOCOL;
  /** The same run/pas-index identity fields used by ADR-010 payloads. */
  readonly identity: RunPayloadIdentity;
  readonly source: ArtifactSourceIdentity;
  readonly model: ArtifactModelIdentity;
  readonly snapshot: {
    readonly schema: typeof TLE_ANALYSIS_RUN_SNAPSHOT_SCHEMA;
    readonly runId: string;
    readonly analysisRunId: string;
    readonly geometryRunId: string;
    readonly anchorCount: typeof TLE_RUN_ANCHOR_COUNT;
  };
  readonly geometry: ArtifactGeometryIdentity;
  readonly files: {
    readonly analysis: ArtifactFileDescriptor;
    readonly geometry: ArtifactFileDescriptor;
  };
}

export interface VisualLabDefaultFullRunArtifactExpectation {
  readonly requestedInstantUtc: string;
  readonly appliedInstantUtc: string;
  readonly catalog: TleWebArchiveCatalog;
  readonly parameters: SimulatorParameters;
  readonly frameOptions?: SimulationAnalysisFrameBuildOptions;
}

const SHA256_PATTERN = /^[0-9a-f]{64}$/;

function failClosed(message: string): null {
  // Artifact loading is an optimization. A malformed or stale artifact must
  // never become a scientific fallback, so all validation failures collapse to
  // an explicit cache miss and let the existing Worker path take over.
  void message;
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sameJson(left: unknown, right: unknown): boolean {
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

function normalizedFrameOptions(options: SimulationAnalysisFrameBuildOptions | undefined): Readonly<SimulationAnalysisFrameBuildOptions> {
  return Object.freeze({
    ...(options?.beamLayoutCount === undefined ? {} : { beamLayoutCount: options.beamLayoutCount }),
    ...(Object.keys(options?.perSatelliteBeamLayoutCount ?? {}).length === 0
      ? {}
      : { perSatelliteBeamLayoutCount: Object.fromEntries(
        Object.entries(options?.perSatelliteBeamLayoutCount ?? {}).sort(([left], [right]) => left.localeCompare(right)),
      ) }),
    ...(options?.beamIlluminationMode === undefined ? {} : { beamIlluminationMode: options.beamIlluminationMode }),
    userPositionOverridesKm: Object.freeze([...(options?.userPositionOverridesKm ?? [])]
      .map(override => ({
        userIndex: override.userIndex,
        positionKm: [override.positionKm[0], override.positionKm[1]] as const,
      }))
      .sort((left, right) => left.userIndex - right.userIndex)),
    ...(options?.representativeUserIndex === undefined
      ? {}
      : { representativeUserIndex: options.representativeUserIndex }),
  });
}

function archiveSnapshotMatches(
  catalog: TleWebArchiveCatalog,
  source: ArtifactSourceIdentity,
): boolean {
  if (source.constellation !== catalog.constellation || source.archiveId !== catalog.archiveId) return false;
  if (source.archiveContentSha256 !== (catalog.archiveContentSha256 ?? null)) return false;
  const snapshot = catalog.snapshots.find(item => item.path === source.snapshotPath);
  return snapshot !== undefined && snapshot.sha256 === source.snapshotSha256;
}

function validSha(value: unknown): value is string {
  return typeof value === 'string' && SHA256_PATTERN.test(value);
}

function validateManifest(
  value: unknown,
  expectation: VisualLabDefaultFullRunArtifactExpectation,
): VisualLabDefaultFullRunArtifactManifest | null {
  if (!isRecord(value)) return failClosed('manifest is not an object');
  if (value.schema !== VISUAL_LAB_DEFAULT_FULL_RUN_ARTIFACT_SCHEMA) return failClosed('manifest schema mismatch');
  if (value.protocol !== VISUAL_LAB_DEFAULT_FULL_RUN_ARTIFACT_PROTOCOL) return failClosed('run payload protocol mismatch');
  if (!isRecord(value.identity) || !isRecord(value.source) || !isRecord(value.model)
    || !isRecord(value.snapshot) || !isRecord(value.geometry) || !isRecord(value.files)) {
    return failClosed('manifest identity sections are incomplete');
  }
  const source = value.source as unknown as ArtifactSourceIdentity;
  if (
    source.constellation !== expectation.catalog.constellation
    || source.requestedInstantUtc !== expectation.requestedInstantUtc
    || source.appliedInstantUtc !== expectation.appliedInstantUtc
    || !archiveSnapshotMatches(expectation.catalog, source)
    || !validSha(source.snapshotSha256)
  ) return failClosed('manifest source identity mismatch');
  const model = value.model as unknown as ArtifactModelIdentity;
  if (
    model.contractVersion !== SIMULATOR_CONTRACT_VERSION
    || model.formulaVersion !== VISUAL_LAB_DEFAULT_FULL_RUN_ARTIFACT_FORMULA_VERSION
    || model.linkShapeVersion !== VISUAL_LAB_DEFAULT_FULL_RUN_ARTIFACT_LINK_SHAPE_VERSION
    || !sameJson(model.parameters, expectation.parameters)
    || !sameJson(normalizedFrameOptions(model.frameOptions), normalizedFrameOptions(expectation.frameOptions))
  ) return failClosed('manifest canonical model identity mismatch');
  const snapshot = value.snapshot as unknown as VisualLabDefaultFullRunArtifactManifest['snapshot'];
  if (
    snapshot.schema !== TLE_ANALYSIS_RUN_SNAPSHOT_SCHEMA
    || snapshot.anchorCount !== TLE_RUN_ANCHOR_COUNT
    || typeof snapshot.runId !== 'string'
    || snapshot.analysisRunId !== snapshot.runId
    || typeof snapshot.geometryRunId !== 'string'
    || snapshot.geometryRunId.trim() === ''
  ) return failClosed('manifest analysis snapshot identity mismatch');
  const geometry = value.geometry as unknown as ArtifactGeometryIdentity;
  if (
    geometry.encoding !== VISUAL_LAB_DEFAULT_FULL_RUN_GEOMETRY_ENCODING
    || geometry.anchorCount !== TLE_RUN_ANCHOR_COUNT
    || geometry.stepS !== TLE_RUN_STEP_S
    || geometry.byteOrder !== 'little-endian-ieee754'
    || !Number.isSafeInteger(geometry.satelliteCount)
    || geometry.satelliteCount <= 0
    || geometry.scalarCountPerVector !== geometry.anchorCount * geometry.satelliteCount * 3
  ) return failClosed('manifest geometry identity mismatch');
  const files = value.files as unknown as VisualLabDefaultFullRunArtifactManifest['files'];
  for (const descriptor of [files.analysis, files.geometry]) {
    if (!isRecord(descriptor) || typeof descriptor.url !== 'string' || descriptor.url.trim() === ''
      || !validSha(descriptor.contentSha256) || !Number.isSafeInteger(descriptor.byteLength) || descriptor.byteLength <= 0) {
      return failClosed('manifest file descriptor is invalid');
    }
  }
  const identity = value.identity as unknown as RunPayloadIdentity;
  if (
    !isRecord(identity)
    || typeof identity.runKey !== 'string'
    || typeof identity.passIndexKey !== 'string'
    || typeof identity.geometryRunId !== 'string'
    || typeof identity.analysisRunId !== 'string'
    || typeof identity.sourceSnapshotDigest !== 'string'
    || identity.geometryRunId !== snapshot.geometryRunId
    || identity.analysisRunId !== snapshot.analysisRunId
    || identity.sourceSnapshotDigest !== source.snapshotSha256
  ) return failClosed('run payload identity mismatch');
  return value as unknown as VisualLabDefaultFullRunArtifactManifest;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  if (globalThis.crypto?.subtle === undefined) throw new Error('Web Crypto SHA-256 is unavailable');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes.slice().buffer);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function fetchBytes(url: string, expectedSha256: string, expectedByteLength: number): Promise<Uint8Array | null> {
  try {
    const response = await globalThis.fetch(url, { cache: 'force-cache' });
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength !== expectedByteLength) return null;
    if (await sha256Hex(bytes) !== expectedSha256) return null;
    return bytes;
  } catch {
    return null;
  }
}

function typedArrayFromLittleEndian(bytes: Uint8Array, offset: number, length: number): Float64Array | null {
  const byteLength = length * Float64Array.BYTES_PER_ELEMENT;
  if (offset < 0 || offset + byteLength > bytes.byteLength || offset % Float64Array.BYTES_PER_ELEMENT !== 0) return null;
  // Browser/Web Worker targets supported by this project are little-endian;
  // verify the assumption once rather than silently accepting byte-swapped
  // scientific geometry on an exotic runtime.
  const probe = new ArrayBuffer(2);
  new DataView(probe).setUint16(0, 0x0102, true);
  if (new Uint8Array(probe)[0] !== 0x02) return null;
  const copy = bytes.slice(offset, offset + byteLength);
  const values = new Float64Array(copy.buffer, copy.byteOffset, length);
  for (const value of values) if (!Number.isFinite(value)) return null;
  return values;
}

function inflateJson(bytes: Uint8Array): unknown | null {
  try {
    const jsonBytes = gunzipSync(bytes);
    return JSON.parse(strFromU8(jsonBytes)) as unknown;
  } catch {
    return null;
  }
}

function withGeometry(
  raw: unknown,
  geometryBytes: Uint8Array,
  geometry: ArtifactGeometryIdentity,
): TleAnalysisRunSnapshot | null {
  if (!isRecord(raw) || raw.schema !== TLE_ANALYSIS_RUN_SNAPSHOT_SCHEMA || !isRecord(raw.geometryRun)) return null;
  const scalarCount = geometry.scalarCountPerVector;
  const expectedBytes = scalarCount * Float64Array.BYTES_PER_ELEMENT * 2;
  if (geometryBytes.byteLength !== expectedBytes) return null;
  const positionsTemeKm = typedArrayFromLittleEndian(geometryBytes, 0, scalarCount);
  const velocitiesTemeKmPerSec = typedArrayFromLittleEndian(
    geometryBytes,
    scalarCount * Float64Array.BYTES_PER_ELEMENT,
    scalarCount,
  );
  if (positionsTemeKm === null || velocitiesTemeKmPerSec === null) return null;
  const geometryRun = raw.geometryRun as Record<string, unknown>;
  const snapshot = {
    ...raw,
    geometryRun: {
      ...geometryRun,
      positionsTemeKm,
      velocitiesTemeKmPerSec,
      positions: positionsTemeKm,
      velocities: velocitiesTemeKmPerSec,
    },
  } as unknown as TleAnalysisRunSnapshot;
  return snapshot;
}

function validateRun(
  run: TleAnalysisRun,
  manifest: VisualLabDefaultFullRunArtifactManifest,
  expectation: VisualLabDefaultFullRunArtifactExpectation,
): boolean {
  if (
    run.analysisRunId !== manifest.snapshot.analysisRunId
    || run.geometryRunId !== manifest.snapshot.geometryRunId
    || run.anchorCount !== TLE_RUN_ANCHOR_COUNT
    || run.stepS !== TLE_RUN_STEP_S
    || run.parameters === undefined
    || !sameJson(run.parameters, expectation.parameters)
    || !sameJson(normalizedFrameOptions(run.frameOptions), normalizedFrameOptions(expectation.frameOptions))
    || run.selection.snapshot.sha256 !== manifest.source.snapshotSha256
    || run.selection.snapshot.metadata.path !== manifest.source.snapshotPath
    || run.geometryRun.archiveId !== manifest.source.archiveId
    || run.geometryRun.publicationSha256 !== manifest.source.snapshotSha256
  ) return false;
  if (run.anchorSelections.length !== TLE_RUN_ANCHOR_COUNT || run.handoverTrace.anchors.length !== TLE_RUN_ANCHOR_COUNT) return false;
  for (const anchorIndex of [0, 1, TLE_RUN_ANCHOR_COUNT - 2, TLE_RUN_ANCHOR_COUNT - 1]) {
    const frame = run.getFrame(anchorIndex);
    if (
      frame === null
      || frame.provenance.sourceKind !== 'ARCHIVED_TLE'
      || frame.provenance.propagationModel !== 'SGP4'
      || frame.instantUtc !== new Date(Date.parse(expectation.appliedInstantUtc) + anchorIndex * TLE_RUN_STEP_S * 1_000).toISOString()
      || frame.runAnchor?.anchorIndex !== anchorIndex
    ) return false;
  }
  return true;
}

/** Load and validate the default complete run; null means safe Worker fallback. */
export async function loadVisualLabDefaultFullRunArtifact(
  expectation: VisualLabDefaultFullRunArtifactExpectation,
  url = VISUAL_LAB_DEFAULT_FULL_RUN_ARTIFACT_URL,
): Promise<TleAnalysisRun | null> {
  try {
    const response = await globalThis.fetch(url, { cache: 'force-cache' });
    if (!response.ok) return null;
    const manifest = validateManifest(await response.json() as unknown, expectation);
    if (manifest === null) return null;
    const [analysisBytes, geometryBytes] = await Promise.all([
      fetchBytes(manifest.files.analysis.url, manifest.files.analysis.contentSha256, manifest.files.analysis.byteLength),
      fetchBytes(manifest.files.geometry.url, manifest.files.geometry.contentSha256, manifest.files.geometry.byteLength),
    ]);
    if (analysisBytes === null || geometryBytes === null) return null;
    const analysisJson = inflateJson(analysisBytes);
    const snapshot = withGeometry(analysisJson, geometryBytes, manifest.geometry);
    if (snapshot === null) return null;
    const run = hydrateTleAnalysisRunSnapshot(snapshot);
    return validateRun(run, manifest, expectation) ? run : null;
  } catch {
    return null;
  }
}

export function defaultFullRunArtifactFrameOptionsMatch(
  left: SimulationAnalysisFrameBuildOptions | undefined,
  right: SimulationAnalysisFrameBuildOptions | undefined,
): boolean {
  return sameJson(normalizedFrameOptions(left), normalizedFrameOptions(right));
}

export type { ArtifactFileDescriptor, ArtifactGeometryIdentity, ArtifactModelIdentity, ArtifactSourceIdentity };
