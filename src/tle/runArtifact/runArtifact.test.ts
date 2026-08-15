import assert from 'node:assert/strict';

import {
  SELECTABLE_TLE_ARTIFACT_SCHEMA,
  createSelectableTlePassIndexKey,
  createSelectableTleRunKey,
  validateSelectableTleArtifactManifest,
  verifySelectableTleArtifactIdentity,
  verifyTleArtifactChunkBytes,
  verifyTleArtifactJsonChunk,
  type TleArtifactChunkEnvelope,
  type TleArtifactChunkRef,
} from './index';

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

const bytes = new TextEncoder().encode('{"frame":0}');
const contentSha256 = await sha256(bytes);

function ref(
  kind: TleArtifactChunkRef['kind'],
  suffix: string,
  fields: Partial<TleArtifactChunkRef> = {},
): TleArtifactChunkRef {
  return {
    kind,
    schema: `${kind}-v1`,
    contentSha256,
    byteLength: bytes.byteLength,
    immutableKey: `sha256/${contentSha256}/${suffix}`,
    ...fields,
  };
}

const baseDraft = {
  schema: SELECTABLE_TLE_ARTIFACT_SCHEMA,
  status: 'bootstrap',
  runKey: `selectable-tle-run:${'a'.repeat(64)}`,
  passIndexKey: `tle-pass-index:${'b'.repeat(64)}`,
  geometryRunId: 'geometry-run-test-v1',
  source: {
    archiveId: 'starlink',
    publicationSha256: 'c'.repeat(64),
    sourceSnapshotDigest: 'd'.repeat(64),
    snapshotKey: 'tle-snapshot/starlink/20260812',
    snapshotSha256: 'e'.repeat(64),
    requestedT0Utc: '2026-08-12T12:00:00.000Z',
    appliedT0Utc: '2026-08-12T12:00:00.000Z',
  },
  geometry: {
    durationS: 7_200,
    stepS: 30,
    anchorCount: 241,
    coarseStepS: 120,
    chunkDurationS: 600,
    endpointPaddingS: 120,
    horizonElevationDeg: 0,
    coarseGuardElevationDeg: -20,
    observerId: 'ntpu-wgs84-v1',
    observerCoordinates: { latitudeDeg: 24.9441667, longitudeDeg: 121.3713889, altitudeM: 50 },
    visibilityPolicyRevision: 'horizon-v1',
    coarseIndexRevision: 'proof-envelope-v1',
    exactSgp4Revision: 'satellite-js-6.0.2',
  },
  analysis: {
    canonicalScenarioRevision: 'family-b-thesis-3.13-3.17-v1',
    parametersSha256: 'f'.repeat(64),
    formulaVersion: 'angle-aware-ee-v3',
    linkShapeVersion: 'canonical-link-shape-v1',
    analysisRunId: 'analysis-run-test-v1',
  },
  chunks: {
    bootstrapFrame: ref('bootstrap-frame', 'bootstrap'),
  },
} as const;

const parsedDraft = validateSelectableTleArtifactManifest(baseDraft);
const passIndexKey = await createSelectableTlePassIndexKey(parsedDraft);
const parsedWithPassKey = validateSelectableTleArtifactManifest({ ...baseDraft, passIndexKey });
const runKey = await createSelectableTleRunKey(parsedWithPassKey);
const base = { ...baseDraft, passIndexKey, runKey } as const;

const bootstrap = validateSelectableTleArtifactManifest(base);
assert.equal(bootstrap.status, 'bootstrap');
assert.equal('runReady' in bootstrap, false);
assert.ok(Object.isFrozen(bootstrap));
await verifySelectableTleArtifactIdentity(bootstrap);
await assert.rejects(() => verifySelectableTleArtifactIdentity({
  ...bootstrap,
  source: { ...bootstrap.source, sourceSnapshotDigest: '0'.repeat(64) },
}), /passIndexKey identity mismatch/);

const acceptedInput = {
  ...base,
  status: 'accepted',
  chunks: {
    ...base.chunks,
    passIndex: ref('pass-index', 'pass-index'),
    ntpuRanges: [
      ref('ntpu-range', 'ntpu-0', { startAnchorIndexInclusive: 0, endAnchorIndexExclusive: 121 }),
      ref('ntpu-range', 'ntpu-1', { startAnchorIndexInclusive: 121, endAnchorIndexExclusive: 241 }),
    ],
    globalObjectIndex: ref('global-object-index', 'global-index'),
    globalFirstCurrent: ref('global-current', 'global-0', { anchorIndex: 0, lod: 'overview' }),
  },
} as const;
const accepted = validateSelectableTleArtifactManifest(acceptedInput);
assert.equal('runReady' in accepted, false);
assert.equal(accepted.chunks.ntpuRanges?.length, 2);
await verifySelectableTleArtifactIdentity(accepted);

assert.throws(() => validateSelectableTleArtifactManifest({
  ...acceptedInput,
  chunks: {
    ...acceptedInput.chunks,
    ntpuRanges: [
      ref('ntpu-range', 'gap-0', { startAnchorIndexInclusive: 0, endAnchorIndexExclusive: 100 }),
      ref('ntpu-range', 'gap-1', { startAnchorIndexInclusive: 101, endAnchorIndexExclusive: 241 }),
    ],
  },
}), /contiguous/);
assert.throws(() => validateSelectableTleArtifactManifest({
  ...acceptedInput,
  status: 'bootstrap',
  chunks: {
    ...acceptedInput.chunks,
    passIndex: { ...acceptedInput.chunks.passIndex, immutableKey: base.chunks.bootstrapFrame.immutableKey },
  },
}), /duplicate immutable chunk key/);
assert.throws(() => validateSelectableTleArtifactManifest({
  ...base,
  geometry: { ...base.geometry, anchorCount: 240 },
}), /canonical/);
assert.throws(() => validateSelectableTleArtifactManifest({
  ...base,
  source: { ...base.source, snapshotKey: '../../private/snapshot.tle' },
}), /opaque relative lookup key/);

await verifyTleArtifactChunkBytes(base.chunks.bootstrapFrame, bytes);
await assert.rejects(
  () => verifyTleArtifactChunkBytes({ ...base.chunks.bootstrapFrame, byteLength: bytes.byteLength + 1 }, bytes),
  /byte length/,
);
const altered = bytes.slice();
altered[0] = altered[0] === 1 ? 2 : 1;
await assert.rejects(() => verifyTleArtifactChunkBytes(base.chunks.bootstrapFrame, altered), /SHA-256/);

const envelope: TleArtifactChunkEnvelope = {
  schema: 'bootstrap-frame-v1',
  kind: 'bootstrap-frame',
  runKey,
  passIndexKey,
  sourceSnapshotDigest: base.source.sourceSnapshotDigest,
  geometryRunId: base.geometryRunId,
  analysisRunId: base.analysis.analysisRunId,
  recordCount: 1,
  payload: { frame: 0 },
};
const envelopeBytes = new TextEncoder().encode(JSON.stringify(envelope));
const envelopeRef: TleArtifactChunkRef = {
  kind: 'bootstrap-frame',
  schema: 'bootstrap-frame-v1',
  contentSha256: await sha256(envelopeBytes),
  byteLength: envelopeBytes.byteLength,
  immutableKey: 'sha256/bootstrap-envelope-v1',
};
const envelopeManifest = validateSelectableTleArtifactManifest({
  ...base,
  chunks: { bootstrapFrame: envelopeRef },
});
const verifiedEnvelope = await verifyTleArtifactJsonChunk(
  envelopeManifest,
  envelopeRef,
  envelopeBytes,
);
assert.deepEqual(verifiedEnvelope.payload, { frame: 0 });

const mismatchedEnvelopeBytes = new TextEncoder().encode(JSON.stringify({
  ...envelope,
  runKey: `selectable-tle-run:${'9'.repeat(64)}`,
}));
const mismatchedRef = {
  ...envelopeRef,
  contentSha256: await sha256(mismatchedEnvelopeBytes),
  byteLength: mismatchedEnvelopeBytes.byteLength,
  immutableKey: 'sha256/mismatched-envelope-v1',
};
const mismatchedManifest = validateSelectableTleArtifactManifest({
  ...base,
  chunks: { bootstrapFrame: mismatchedRef },
});
await assert.rejects(
  () => verifyTleArtifactJsonChunk(mismatchedManifest, mismatchedRef, mismatchedEnvelopeBytes),
  /envelope runKey disagrees/,
);

const undeclaredRef = { ...envelopeRef, immutableKey: 'sha256/undeclared-envelope-v1' };
await assert.rejects(
  () => verifyTleArtifactJsonChunk(envelopeManifest, undeclaredRef, envelopeBytes),
  /not declared by its manifest/,
);

console.log('selectable TLE artifact manifest tests passed');
