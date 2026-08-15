import {
  TLE_PASS_INDEX_SCHEMA_VERSION,
  type BuildTimeChunkedCandidateIndexInput,
  type PassIndexBuildConfig,
  type PassIndexChunkReceipt,
  type PassIndexChunkWindow,
  type PassIndexCoarseDisposition,
  type PassIndexIdentityInput,
  type TimeChunkedCandidateIndex,
} from './types';

const SHA256_PATTERN = /^[0-9a-f]{64}$/;

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return value;
}

function safePositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive safe integer`);
  }
}

function requiredText(value: string, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${label} must be non-empty`);
  return value.trim();
}

export function validatePassIndexConfig(config: PassIndexBuildConfig): void {
  safePositiveInteger(config.durationS, 'durationS');
  safePositiveInteger(config.exactStepS, 'exactStepS');
  safePositiveInteger(config.coarseStepS, 'coarseStepS');
  safePositiveInteger(config.chunkDurationS, 'chunkDurationS');
  if (config.durationS % config.exactStepS !== 0) throw new TypeError('exactStepS must divide durationS');
  if (config.durationS % config.chunkDurationS !== 0) throw new TypeError('chunkDurationS must divide durationS');
  if (config.chunkDurationS % config.exactStepS !== 0) throw new TypeError('exactStepS must divide chunkDurationS');
  if (!Number.isSafeInteger(config.endpointPaddingS) || config.endpointPaddingS < 0) {
    throw new TypeError('endpointPaddingS must be a non-negative safe integer');
  }
  if (!Number.isFinite(config.horizonElevationDeg)) throw new TypeError('horizonElevationDeg must be finite');
  if (!Number.isFinite(config.coarseGuardElevationDeg)) {
    throw new TypeError('coarseGuardElevationDeg must be finite');
  }
  if (config.coarseGuardElevationDeg > config.horizonElevationDeg) {
    throw new TypeError('coarseGuardElevationDeg must not exceed horizonElevationDeg');
  }
}

function normalizedIds(ids: readonly string[]): readonly string[] {
  const normalized = ids.map((id, index) => requiredText(id, `satelliteIds[${index}]`));
  const unique = new Set(normalized);
  if (unique.size !== normalized.length) throw new TypeError('satelliteIds must be unique');
  return Object.freeze([...unique].sort());
}

function chunkWindows(config: PassIndexBuildConfig): readonly PassIndexChunkWindow[] {
  const chunkCount = config.durationS / config.chunkDurationS;
  return Object.freeze(Array.from({ length: chunkCount }, (_unused, chunkIndex) => {
    const startS = chunkIndex * config.chunkDurationS;
    const endS = (chunkIndex + 1) * config.chunkDurationS;
    return deepFreeze({
      chunkIndex,
      startS,
      endS,
      paddedStartS: startS - config.endpointPaddingS,
      paddedEndS: endS + config.endpointPaddingS,
      startAnchorIndexInclusive: startS / config.exactStepS,
      endAnchorIndexExclusive: chunkIndex === chunkCount - 1
        ? config.durationS / config.exactStepS + 1
        : endS / config.exactStepS,
    });
  }));
}

function failOpenDisposition(
  satelliteId: string,
  chunkIndex: number,
  classify: BuildTimeChunkedCandidateIndexInput['classify'],
  chunk: PassIndexChunkWindow,
): PassIndexCoarseDisposition {
  try {
    const disposition = classify(satelliteId, chunk);
    if (disposition?.kind === 'candidate') {
      return { kind: 'candidate', reason: requiredText(disposition.reason, 'candidate reason') };
    }
    if (disposition?.kind === 'uncertain') {
      return { kind: 'uncertain', reason: requiredText(disposition.reason, 'uncertainty reason') };
    }
    if (disposition?.kind === 'excluded') {
      return {
        kind: 'excluded',
        proof: {
          revision: requiredText(disposition.proof?.revision, 'exclusion proof revision'),
          basis: requiredText(disposition.proof?.basis, 'exclusion proof basis'),
        },
      };
    }
    throw new TypeError('classifier returned an unknown disposition');
  } catch (error) {
    const detail = error instanceof Error && error.message.trim() !== ''
      ? error.message
      : 'classifier failed without a diagnostic';
    return {
      kind: 'uncertain',
      reason: `fail-open classification for ${satelliteId} in chunk ${chunkIndex}: ${detail}`,
    };
  }
}

/**
 * Pure time-chunk admission coordinator. It does not infer exclusion from
 * samples: only a classifier-supplied conservative proof may remove a source.
 */
export function buildTimeChunkedCandidateIndex(
  input: BuildTimeChunkedCandidateIndexInput,
): TimeChunkedCandidateIndex {
  validatePassIndexConfig(input.config);
  if (typeof input.classify !== 'function') throw new TypeError('classify must be a function');
  const ids = normalizedIds(input.satelliteIds);
  if (ids.length === 0) throw new TypeError('satelliteIds must not be empty');
  const windows = chunkWindows(input.config);
  const candidateUnion = new Set<string>();
  const uncertainUnion = new Set<string>();
  const exclusionCountById = new Map(ids.map(id => [id, 0]));
  let classificationAttemptCount = 0;

  const chunks: readonly PassIndexChunkReceipt[] = windows.map(chunk => {
    const candidateIds: string[] = [];
    const exclusions: Array<PassIndexChunkReceipt['exclusions'][number]> = [];
    const uncertainties: Array<PassIndexChunkReceipt['uncertainties'][number]> = [];
    for (const satelliteId of ids) {
      classificationAttemptCount += 1;
      const disposition = failOpenDisposition(
        satelliteId,
        chunk.chunkIndex,
        input.classify,
        chunk,
      );
      if (disposition.kind === 'excluded') {
        exclusionCountById.set(satelliteId, (exclusionCountById.get(satelliteId) ?? 0) + 1);
        exclusions.push({ satelliteId, proof: disposition.proof });
        continue;
      }
      candidateIds.push(satelliteId);
      candidateUnion.add(satelliteId);
      if (disposition.kind === 'uncertain') {
        uncertainUnion.add(satelliteId);
        uncertainties.push({ satelliteId, reason: disposition.reason });
      }
    }
    return deepFreeze({
      ...chunk,
      candidateIds,
      exclusions,
      uncertainties,
    });
  });

  return deepFreeze({
    schemaVersion: TLE_PASS_INDEX_SCHEMA_VERSION,
    config: { ...input.config },
    sourceSatelliteCount: ids.length,
    chunks,
    candidateUnionIds: [...candidateUnion].sort(),
    uncertainIds: [...uncertainUnion].sort(),
    excludedIds: ids.filter(id => exclusionCountById.get(id) === windows.length),
    candidateMembershipCount: chunks.reduce((sum, chunk) => sum + chunk.candidateIds.length, 0),
    classificationAttemptCount,
  });
}

function canonicalIdentityPayload(input: PassIndexIdentityInput): string {
  validatePassIndexConfig(input.config);
  const publicationSha256 = requiredText(input.publicationSha256, 'publicationSha256');
  const resolvedSnapshotDigest = requiredText(input.resolvedSnapshotDigest, 'resolvedSnapshotDigest');
  if (!SHA256_PATTERN.test(publicationSha256)) throw new TypeError('publicationSha256 must be lowercase SHA-256');
  if (!SHA256_PATTERN.test(resolvedSnapshotDigest)) throw new TypeError('resolvedSnapshotDigest must be lowercase SHA-256');
  const instantMs = Date.parse(input.requestedT0Utc);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(input.requestedT0Utc)
    || !Number.isFinite(instantMs)) {
    throw new TypeError('requestedT0Utc must be an ISO UTC instant ending in Z');
  }
  const observerValues = [input.observer.latitudeDeg, input.observer.longitudeDeg, input.observer.heightKm];
  if (!observerValues.every(Number.isFinite)) throw new TypeError('observer coordinates must be finite');
  if (input.observer.latitudeDeg < -90 || input.observer.latitudeDeg > 90) {
    throw new TypeError('observer.latitudeDeg must be between -90 and 90');
  }
  if (input.observer.longitudeDeg < -180 || input.observer.longitudeDeg > 180) {
    throw new TypeError('observer.longitudeDeg must be between -180 and 180');
  }
  return JSON.stringify([
    TLE_PASS_INDEX_SCHEMA_VERSION,
    requiredText(input.archiveId, 'archiveId'),
    publicationSha256,
    resolvedSnapshotDigest,
    new Date(instantMs).toISOString(),
    [
      requiredText(input.observer.id, 'observer.id'),
      input.observer.latitudeDeg,
      input.observer.longitudeDeg,
      input.observer.heightKm,
    ],
    requiredText(input.visibilityPolicyRevision, 'visibilityPolicyRevision'),
    requiredText(input.coarseIndexRevision, 'coarseIndexRevision'),
    requiredText(input.exactSgp4Revision, 'exactSgp4Revision'),
    [
      input.config.durationS,
      input.config.exactStepS,
      input.config.coarseStepS,
      input.config.chunkDurationS,
      input.config.endpointPaddingS,
      input.config.horizonElevationDeg,
      input.config.coarseGuardElevationDeg,
    ],
  ]);
}

/** Content key only; candidate/output bytes remain independently validated. */
export async function createPassIndexKey(input: PassIndexIdentityInput): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle === undefined) throw new Error('Web Crypto SHA-256 is unavailable');
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(canonicalIdentityPayload(input)));
  const hex = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return `tle-pass-index:${hex}`;
}
