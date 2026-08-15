import {
  SELECTABLE_TLE_ARTIFACT_SCHEMA,
  SELECTABLE_TLE_RUN_KEY_PREFIX,
  type SelectableTleArtifactManifest,
  type TleArtifactChunkKind,
  type TleArtifactChunkEnvelope,
  type TleArtifactChunkRef,
  type TleArtifactChunkSet,
  type ValidatedTleArtifactManifest,
} from './types';
import { verifySelectableTleArtifactIdentity } from './identity';

const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const PASS_INDEX_KEY_PATTERN = /^tle-pass-index:[0-9a-f]{64}$/;
const RUN_KEY_PATTERN = new RegExp(`^${SELECTABLE_TLE_RUN_KEY_PREFIX}[0-9a-f]{64}$`);
const UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

function fail(message: string): never {
  throw new TypeError(`invalid selectable TLE artifact: ${message}`);
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') fail(`${label} must be non-empty`);
  return value.trim();
}

function exactText<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  const normalized = text(value, label);
  if (!allowed.includes(normalized as T)) fail(`${label} is unsupported`);
  return normalized as T;
}

function sha256(value: unknown, label: string): string {
  const normalized = text(value, label);
  if (!SHA256_PATTERN.test(normalized)) fail(`${label} must be lowercase SHA-256`);
  return normalized;
}

function safeInteger(value: unknown, label: string, minimum = 0): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    fail(`${label} must be a safe integer >= ${minimum}`);
  }
  return value as number;
}

function finite(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${label} must be finite`);
  return value;
}

function utc(value: unknown, label: string): string {
  const normalized = text(value, label);
  if (!UTC_PATTERN.test(normalized) || !Number.isFinite(Date.parse(normalized))) {
    fail(`${label} must be an ISO UTC instant ending in Z`);
  }
  return new Date(Date.parse(normalized)).toISOString();
}

function immutableKey(value: unknown, label: string): string {
  const normalized = text(value, label);
  if (!/^[a-z0-9][a-zA-Z0-9._/-]*$/.test(normalized)) {
    fail(`${label} must be an opaque relative lookup key`);
  }
  if (normalized.includes('\\') || normalized.split('/').includes('..')) {
    fail(`${label} must not contain parent traversal`);
  }
  return normalized;
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return value;
}

function chunkRef(value: unknown, expectedKind: TleArtifactChunkKind, label: string): TleArtifactChunkRef {
  const input = record(value, label);
  const kind = exactText(input.kind, [expectedKind], `${label}.kind`);
  let startAnchorIndexInclusive: number | undefined;
  let endAnchorIndexExclusive: number | undefined;
  let anchorIndex: number | undefined;
  let lod: TleArtifactChunkRef['lod'];
  if (input.startAnchorIndexInclusive !== undefined || input.endAnchorIndexExclusive !== undefined) {
    startAnchorIndexInclusive = safeInteger(
      input.startAnchorIndexInclusive,
      `${label}.startAnchorIndexInclusive`,
    );
    endAnchorIndexExclusive = safeInteger(
      input.endAnchorIndexExclusive,
      `${label}.endAnchorIndexExclusive`,
      1,
    );
    if (endAnchorIndexExclusive <= startAnchorIndexInclusive) {
      fail(`${label} anchor range must be increasing`);
    }
  }
  if (input.anchorIndex !== undefined) {
    anchorIndex = safeInteger(input.anchorIndex, `${label}.anchorIndex`);
  }
  if (input.lod !== undefined) {
    lod = exactText(input.lod, ['overview', 'full-current'] as const, `${label}.lod`);
  }
  if (kind === 'ntpu-range') {
    if (startAnchorIndexInclusive === undefined || endAnchorIndexExclusive === undefined) {
      fail(`${label} must declare its anchor range`);
    }
    if (anchorIndex !== undefined || lod !== undefined) {
      fail(`${label} must not declare current-frame fields`);
    }
  } else if (kind === 'global-current') {
    if (anchorIndex === undefined || lod === undefined) {
      fail(`${label} must declare anchorIndex and lod`);
    }
    if (startAnchorIndexInclusive !== undefined || endAnchorIndexExclusive !== undefined) {
      fail(`${label} must not declare an anchor range`);
    }
  } else if (
    startAnchorIndexInclusive !== undefined
    || endAnchorIndexExclusive !== undefined
    || anchorIndex !== undefined
    || lod !== undefined
  ) {
    fail(`${label} declares fields that are not valid for ${kind}`);
  }
  return {
    kind,
    schema: text(input.schema, `${label}.schema`),
    contentSha256: sha256(input.contentSha256, `${label}.contentSha256`),
    byteLength: safeInteger(input.byteLength, `${label}.byteLength`, 1),
    immutableKey: immutableKey(input.immutableKey, `${label}.immutableKey`),
    ...(startAnchorIndexInclusive === undefined ? {} : { startAnchorIndexInclusive }),
    ...(endAnchorIndexExclusive === undefined ? {} : { endAnchorIndexExclusive }),
    ...(anchorIndex === undefined ? {} : { anchorIndex }),
    ...(lod === undefined ? {} : { lod }),
  };
}

function optionalChunkArray(
  value: unknown,
  kind: TleArtifactChunkKind,
  label: string,
): readonly TleArtifactChunkRef[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length === 0) fail(`${label} must be a non-empty array`);
  return value.map((item, index) => chunkRef(item, kind, `${label}[${index}]`));
}

function validateUniqueChunkKeys(chunks: readonly TleArtifactChunkRef[]): void {
  const keys = new Set<string>();
  for (const chunk of chunks) {
    if (keys.has(chunk.immutableKey)) fail(`duplicate immutable chunk key ${chunk.immutableKey}`);
    keys.add(chunk.immutableKey);
  }
}

function manifestChunkRefs(manifest: ValidatedTleArtifactManifest): readonly TleArtifactChunkRef[] {
  return [
    manifest.chunks.bootstrapFrame,
    ...(manifest.chunks.passIndex === undefined ? [] : [manifest.chunks.passIndex]),
    ...(manifest.chunks.ntpuRanges ?? []),
    ...(manifest.chunks.globalObjectIndex === undefined ? [] : [manifest.chunks.globalObjectIndex]),
    ...(manifest.chunks.globalFirstCurrent === undefined ? [] : [manifest.chunks.globalFirstCurrent]),
    ...(manifest.chunks.globalCurrents ?? []),
  ];
}

function sameChunkDescriptor(left: TleArtifactChunkRef, right: TleArtifactChunkRef): boolean {
  return left.kind === right.kind
    && left.schema === right.schema
    && left.contentSha256 === right.contentSha256
    && left.byteLength === right.byteLength
    && left.immutableKey === right.immutableKey
    && left.startAnchorIndexInclusive === right.startAnchorIndexInclusive
    && left.endAnchorIndexExclusive === right.endAnchorIndexExclusive
    && left.anchorIndex === right.anchorIndex
    && left.lod === right.lod;
}

function declaredChunkReference(
  manifest: ValidatedTleArtifactManifest,
  reference: TleArtifactChunkRef,
): TleArtifactChunkRef {
  const declared = manifestChunkRefs(manifest).find(chunk => chunk.immutableKey === reference.immutableKey);
  if (declared === undefined) fail('chunk reference is not declared by its manifest');
  if (!sameChunkDescriptor(declared, reference)) {
    fail('chunk reference descriptor disagrees with its manifest declaration');
  }
  return declared;
}

function validateAcceptedCoverage(chunks: TleArtifactChunkSet, anchorCount: number): void {
  if (chunks.passIndex === undefined) fail('accepted manifest requires passIndex');
  if (chunks.globalObjectIndex === undefined) fail('accepted manifest requires globalObjectIndex');
  if (chunks.globalFirstCurrent === undefined) fail('accepted manifest requires globalFirstCurrent');
  if (chunks.globalFirstCurrent.anchorIndex !== 0) fail('globalFirstCurrent must describe anchor 0');
  const ranges = chunks.ntpuRanges;
  if (ranges === undefined || ranges.length === 0) fail('accepted manifest requires ntpuRanges');
  const ordered = [...ranges].sort((a, b) => (
    (a.startAnchorIndexInclusive ?? 0) - (b.startAnchorIndexInclusive ?? 0)
  ));
  let nextAnchor = 0;
  for (const range of ordered) {
    if (range.startAnchorIndexInclusive !== nextAnchor) {
      fail(`ntpuRanges must be contiguous at anchor ${nextAnchor}`);
    }
    nextAnchor = range.endAnchorIndexExclusive ?? fail('ntpu range end is unavailable');
  }
  if (nextAnchor !== anchorCount) fail(`ntpuRanges must cover exactly ${anchorCount} anchors`);
}

/**
 * Runtime parser for a cache/server manifest. It validates structure and
 * declared identities; child bytes are verified separately before use.
 */
export function validateSelectableTleArtifactManifest(value: unknown): ValidatedTleArtifactManifest {
  const input = record(value, 'manifest');
  const schema = exactText(input.schema, [SELECTABLE_TLE_ARTIFACT_SCHEMA], 'schema');
  const status = exactText(input.status, ['bootstrap', 'accepted'], 'status');
  const runKey = text(input.runKey, 'runKey');
  if (!RUN_KEY_PATTERN.test(runKey)) fail('runKey must be a content-addressed selectable TLE run key');
  const passIndexKey = text(input.passIndexKey, 'passIndexKey');
  if (!PASS_INDEX_KEY_PATTERN.test(passIndexKey)) fail('passIndexKey must be a content-addressed TLE pass-index key');

  const sourceInput = record(input.source, 'source');
  const source = {
    archiveId: exactText(sourceInput.archiveId, ['starlink', 'oneweb'], 'source.archiveId'),
    publicationSha256: sha256(sourceInput.publicationSha256, 'source.publicationSha256'),
    sourceSnapshotDigest: sha256(sourceInput.sourceSnapshotDigest, 'source.sourceSnapshotDigest'),
    snapshotKey: immutableKey(sourceInput.snapshotKey, 'source.snapshotKey'),
    snapshotSha256: sha256(sourceInput.snapshotSha256, 'source.snapshotSha256'),
    requestedT0Utc: utc(sourceInput.requestedT0Utc, 'source.requestedT0Utc'),
    appliedT0Utc: utc(sourceInput.appliedT0Utc, 'source.appliedT0Utc'),
  } as const;

  const geometryInput = record(input.geometry, 'geometry');
  const coordinatesInput = record(geometryInput.observerCoordinates, 'geometry.observerCoordinates');
  const geometry = {
    durationS: safeInteger(geometryInput.durationS, 'geometry.durationS', 1),
    stepS: safeInteger(geometryInput.stepS, 'geometry.stepS', 1),
    anchorCount: safeInteger(geometryInput.anchorCount, 'geometry.anchorCount', 2),
    coarseStepS: safeInteger(geometryInput.coarseStepS, 'geometry.coarseStepS', 1),
    chunkDurationS: safeInteger(geometryInput.chunkDurationS, 'geometry.chunkDurationS', 1),
    endpointPaddingS: safeInteger(geometryInput.endpointPaddingS, 'geometry.endpointPaddingS'),
    horizonElevationDeg: finite(geometryInput.horizonElevationDeg, 'geometry.horizonElevationDeg'),
    coarseGuardElevationDeg: finite(
      geometryInput.coarseGuardElevationDeg,
      'geometry.coarseGuardElevationDeg',
    ),
    observerId: text(geometryInput.observerId, 'geometry.observerId'),
    observerCoordinates: {
      latitudeDeg: finite(coordinatesInput.latitudeDeg, 'geometry.observerCoordinates.latitudeDeg'),
      longitudeDeg: finite(coordinatesInput.longitudeDeg, 'geometry.observerCoordinates.longitudeDeg'),
      altitudeM: finite(coordinatesInput.altitudeM, 'geometry.observerCoordinates.altitudeM'),
    },
    visibilityPolicyRevision: text(
      geometryInput.visibilityPolicyRevision,
      'geometry.visibilityPolicyRevision',
    ),
    coarseIndexRevision: text(geometryInput.coarseIndexRevision, 'geometry.coarseIndexRevision'),
    exactSgp4Revision: text(geometryInput.exactSgp4Revision, 'geometry.exactSgp4Revision'),
  } as const;
  if (geometry.observerCoordinates.latitudeDeg < -90 || geometry.observerCoordinates.latitudeDeg > 90) {
    fail('geometry observer latitude is out of range');
  }
  if (geometry.observerCoordinates.longitudeDeg < -180 || geometry.observerCoordinates.longitudeDeg > 180) {
    fail('geometry observer longitude is out of range');
  }
  if (geometry.durationS !== 7_200 || geometry.stepS !== 30 || geometry.anchorCount !== 241) {
    fail('geometry must use the canonical 7200-second, 30-second, 241-anchor axis');
  }
  if (geometry.durationS / geometry.stepS + 1 !== geometry.anchorCount) {
    fail('geometry duration, step, and anchor count disagree');
  }
  if (geometry.durationS % geometry.chunkDurationS !== 0) {
    fail('geometry chunkDurationS must divide durationS');
  }
  if (geometry.chunkDurationS % geometry.stepS !== 0) {
    fail('geometry stepS must divide chunkDurationS');
  }
  if (geometry.coarseGuardElevationDeg > geometry.horizonElevationDeg) {
    fail('geometry coarse guard must not exceed the horizon threshold');
  }

  const analysisInput = record(input.analysis, 'analysis');
  const analysis = {
    canonicalScenarioRevision: text(
      analysisInput.canonicalScenarioRevision,
      'analysis.canonicalScenarioRevision',
    ),
    parametersSha256: sha256(analysisInput.parametersSha256, 'analysis.parametersSha256'),
    formulaVersion: text(analysisInput.formulaVersion, 'analysis.formulaVersion'),
    linkShapeVersion: text(analysisInput.linkShapeVersion, 'analysis.linkShapeVersion'),
    analysisRunId: text(analysisInput.analysisRunId, 'analysis.analysisRunId'),
  } as const;

  const chunksInput = record(input.chunks, 'chunks');
  const ntpuRanges = optionalChunkArray(chunksInput.ntpuRanges, 'ntpu-range', 'chunks.ntpuRanges');
  const globalCurrents = optionalChunkArray(
    chunksInput.globalCurrents,
    'global-current',
    'chunks.globalCurrents',
  );
  const chunks: TleArtifactChunkSet = {
    bootstrapFrame: chunkRef(chunksInput.bootstrapFrame, 'bootstrap-frame', 'chunks.bootstrapFrame'),
    ...(chunksInput.passIndex === undefined
      ? {}
      : { passIndex: chunkRef(chunksInput.passIndex, 'pass-index', 'chunks.passIndex') }),
    ...(ntpuRanges === undefined ? {} : { ntpuRanges }),
    ...(chunksInput.globalObjectIndex === undefined
      ? {}
      : {
        globalObjectIndex: chunkRef(
          chunksInput.globalObjectIndex,
          'global-object-index',
          'chunks.globalObjectIndex',
        ),
      }),
    ...(chunksInput.globalFirstCurrent === undefined
      ? {}
      : {
        globalFirstCurrent: chunkRef(
          chunksInput.globalFirstCurrent,
          'global-current',
          'chunks.globalFirstCurrent',
        ),
      }),
    ...(globalCurrents === undefined ? {} : { globalCurrents }),
  };
  const allChunks = [
    chunks.bootstrapFrame,
    ...(chunks.passIndex === undefined ? [] : [chunks.passIndex]),
    ...(chunks.ntpuRanges ?? []),
    ...(chunks.globalObjectIndex === undefined ? [] : [chunks.globalObjectIndex]),
    ...(chunks.globalFirstCurrent === undefined ? [] : [chunks.globalFirstCurrent]),
    ...(chunks.globalCurrents ?? []),
  ];
  validateUniqueChunkKeys(allChunks);
  for (const chunk of allChunks) {
    if ((chunk.anchorIndex ?? 0) >= geometry.anchorCount) fail(`${chunk.kind} anchorIndex is out of range`);
    if ((chunk.endAnchorIndexExclusive ?? 0) > geometry.anchorCount) {
      fail(`${chunk.kind} anchor range is out of range`);
    }
  }
  if (status === 'accepted') validateAcceptedCoverage(chunks, geometry.anchorCount);

  return deepFreeze({
    schema,
    status,
    runKey,
    passIndexKey,
    geometryRunId: text(input.geometryRunId, 'geometryRunId'),
    source,
    geometry,
    analysis,
    chunks,
  });
}

/** Verifies an immutable child payload before parsing or publishing it. */
export async function verifyTleArtifactChunkBytes(
  reference: TleArtifactChunkRef,
  bytes: Uint8Array,
): Promise<void> {
  if (!(bytes instanceof Uint8Array)) fail('chunk bytes must be a Uint8Array');
  if (bytes.byteLength !== reference.byteLength) fail('chunk byte length does not match its receipt');
  const subtle = globalThis.crypto?.subtle;
  if (subtle === undefined) throw new Error('Web Crypto SHA-256 is unavailable');
  const digest = await subtle.digest('SHA-256', new Uint8Array(bytes));
  const actual = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  if (actual !== reference.contentSha256) fail('chunk SHA-256 does not match its receipt');
}

function optionalExactInteger(
  value: unknown,
  expected: number | undefined,
  label: string,
): number | undefined {
  if (expected === undefined) {
    if (value !== undefined) fail(`${label} is not declared by the chunk reference`);
    return undefined;
  }
  const parsed = safeInteger(value, label);
  if (parsed !== expected) fail(`${label} disagrees with the chunk reference`);
  return parsed;
}

/**
 * Binds decoded child metadata to the parent manifest and its exact descriptor.
 * Payload-specific semantic validation remains with the neutral producer.
 */
function validateTleArtifactChunkEnvelope(
  value: unknown,
  manifest: ValidatedTleArtifactManifest,
  reference: TleArtifactChunkRef,
): TleArtifactChunkEnvelope {
  const input = record(value, 'chunk envelope');
  const schema = text(input.schema, 'chunk envelope.schema');
  if (schema !== reference.schema) fail('chunk envelope schema disagrees with its reference');
  const kind = exactText(input.kind, [reference.kind], 'chunk envelope.kind');
  const runKey = text(input.runKey, 'chunk envelope.runKey');
  if (runKey !== manifest.runKey) fail('chunk envelope runKey disagrees with its manifest');
  const passIndexKey = text(input.passIndexKey, 'chunk envelope.passIndexKey');
  if (passIndexKey !== manifest.passIndexKey) fail('chunk envelope passIndexKey disagrees with its manifest');
  const sourceSnapshotDigest = sha256(
    input.sourceSnapshotDigest,
    'chunk envelope.sourceSnapshotDigest',
  );
  if (sourceSnapshotDigest !== manifest.source.sourceSnapshotDigest) {
    fail('chunk envelope sourceSnapshotDigest disagrees with its manifest');
  }
  const geometryRunId = text(input.geometryRunId, 'chunk envelope.geometryRunId');
  if (geometryRunId !== manifest.geometryRunId) fail('chunk envelope geometryRunId disagrees with its manifest');
  const analysisRunId = text(input.analysisRunId, 'chunk envelope.analysisRunId');
  if (analysisRunId !== manifest.analysis.analysisRunId) {
    fail('chunk envelope analysisRunId disagrees with its manifest');
  }
  const startAnchorIndexInclusive = optionalExactInteger(
    input.startAnchorIndexInclusive,
    reference.startAnchorIndexInclusive,
    'chunk envelope.startAnchorIndexInclusive',
  );
  const endAnchorIndexExclusive = optionalExactInteger(
    input.endAnchorIndexExclusive,
    reference.endAnchorIndexExclusive,
    'chunk envelope.endAnchorIndexExclusive',
  );
  const anchorIndex = optionalExactInteger(
    input.anchorIndex,
    reference.anchorIndex,
    'chunk envelope.anchorIndex',
  );
  let lod: TleArtifactChunkRef['lod'];
  if (reference.lod === undefined) {
    if (input.lod !== undefined) fail('chunk envelope.lod is not declared by the chunk reference');
  } else {
    lod = exactText(input.lod, [reference.lod], 'chunk envelope.lod');
  }
  if (!Object.prototype.hasOwnProperty.call(input, 'payload')) fail('chunk envelope payload is required');
  return Object.freeze({
    schema,
    kind,
    runKey,
    passIndexKey,
    sourceSnapshotDigest,
    geometryRunId,
    analysisRunId,
    recordCount: safeInteger(input.recordCount, 'chunk envelope.recordCount'),
    ...(startAnchorIndexInclusive === undefined ? {} : { startAnchorIndexInclusive }),
    ...(endAnchorIndexExclusive === undefined ? {} : { endAnchorIndexExclusive }),
    ...(anchorIndex === undefined ? {} : { anchorIndex }),
    ...(lod === undefined ? {} : { lod }),
    payload: input.payload,
  });
}

/**
 * Integrity path for JSON chunks: recompute parent identity, verify exact bytes,
 * decode JSON, then bind the child envelope back to its descriptor and parent.
 * It still does not claim canonical-frame or timeline acceptance.
 */
export async function verifyTleArtifactJsonChunk(
  manifest: ValidatedTleArtifactManifest,
  reference: TleArtifactChunkRef,
  bytes: Uint8Array,
): Promise<TleArtifactChunkEnvelope> {
  const declaredReference = declaredChunkReference(manifest, reference);
  await verifySelectableTleArtifactIdentity(manifest);
  await verifyTleArtifactChunkBytes(declaredReference, bytes);
  let decoded: string;
  try {
    decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    fail('chunk bytes are not valid UTF-8');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded);
  } catch {
    fail('chunk bytes are not valid JSON');
  }
  return validateTleArtifactChunkEnvelope(parsed, manifest, declaredReference);
}
