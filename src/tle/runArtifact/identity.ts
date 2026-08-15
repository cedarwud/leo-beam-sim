import { createPassIndexKey } from '../passIndex';
import {
  SELECTABLE_TLE_ARTIFACT_SCHEMA,
  SELECTABLE_TLE_RUN_KEY_PREFIX,
  type ValidatedTleArtifactManifest,
} from './types';

async function sha256Hex(value: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle === undefined) throw new Error('Web Crypto SHA-256 is unavailable');
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function createSelectableTleRunKey(
  manifest: ValidatedTleArtifactManifest,
): Promise<string> {
  const payload = JSON.stringify([
    SELECTABLE_TLE_ARTIFACT_SCHEMA,
    manifest.passIndexKey,
    manifest.geometryRunId,
    manifest.source.snapshotSha256,
    manifest.source.appliedT0Utc,
    manifest.analysis.canonicalScenarioRevision,
    manifest.analysis.parametersSha256,
    manifest.analysis.formulaVersion,
    manifest.analysis.linkShapeVersion,
    manifest.analysis.analysisRunId,
  ]);
  return `${SELECTABLE_TLE_RUN_KEY_PREFIX}${await sha256Hex(payload)}`;
}

export async function createSelectableTlePassIndexKey(
  manifest: ValidatedTleArtifactManifest,
): Promise<string> {
  return createPassIndexKey({
    archiveId: manifest.source.archiveId,
    publicationSha256: manifest.source.publicationSha256,
    resolvedSnapshotDigest: manifest.source.sourceSnapshotDigest,
    requestedT0Utc: manifest.source.requestedT0Utc,
    observer: {
      id: manifest.geometry.observerId,
      latitudeDeg: manifest.geometry.observerCoordinates.latitudeDeg,
      longitudeDeg: manifest.geometry.observerCoordinates.longitudeDeg,
      heightKm: manifest.geometry.observerCoordinates.altitudeM / 1_000,
    },
    visibilityPolicyRevision: manifest.geometry.visibilityPolicyRevision,
    coarseIndexRevision: manifest.geometry.coarseIndexRevision,
    exactSgp4Revision: manifest.geometry.exactSgp4Revision,
    config: {
      durationS: manifest.geometry.durationS,
      exactStepS: manifest.geometry.stepS,
      coarseStepS: manifest.geometry.coarseStepS,
      chunkDurationS: manifest.geometry.chunkDurationS,
      endpointPaddingS: manifest.geometry.endpointPaddingS,
      horizonElevationDeg: manifest.geometry.horizonElevationDeg,
      coarseGuardElevationDeg: manifest.geometry.coarseGuardElevationDeg,
    },
  });
}

/** Recomputes scientific identity keys; syntax-only manifest parsing is not enough. */
export async function verifySelectableTleArtifactIdentity(
  manifest: ValidatedTleArtifactManifest,
): Promise<void> {
  const expectedPassIndexKey = await createSelectableTlePassIndexKey(manifest);
  if (manifest.passIndexKey !== expectedPassIndexKey) {
    throw new TypeError('invalid selectable TLE artifact: passIndexKey identity mismatch');
  }
  const expectedRunKey = await createSelectableTleRunKey({
    ...manifest,
    passIndexKey: expectedPassIndexKey,
  });
  if (manifest.runKey !== expectedRunKey) {
    throw new TypeError('invalid selectable TLE artifact: runKey identity mismatch');
  }
}
