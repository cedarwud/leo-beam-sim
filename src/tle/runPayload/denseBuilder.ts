import {
  buildTleAnalysisRun,
  type TleAnalysisRun,
} from '../../simulator/tleAnalysisRun';
import {
  loadTleSnapshotSelection,
  loadTleWebArchiveCatalog,
  type TleArchiveFetcher,
} from '../../simulator/archive';
import {
  DEFAULT_SIMULATOR_PARAMETERS,
  SIMULATOR_CATALOG_URLS,
  SIMULATOR_CONTRACT_VERSION,
  type SimulationAnalysisFrame,
  type SimulatorParameters,
} from '../../simulator/types';
import {
  buildTleRunBundle,
  TLE_RUN_ANCHOR_COUNT,
  TLE_RUN_DURATION_S,
  TLE_RUN_STEP_S,
  type TleRunBundle,
} from '../run';
import {
  createSelectableTlePassIndexKey,
  createSelectableTleRunKey,
  validateSelectableTleArtifactManifest,
  verifySelectableTleArtifactIdentity,
  verifyTleArtifactJsonChunk,
  type SelectableTleArtifactManifest,
  type TleArtifactChunkRef,
  type TleArtifactGeometryIdentity,
  type TleArtifactSourceReceipt,
  type ValidatedTleArtifactManifest,
} from '../runArtifact';
import {
  TLE_PROPAGATION_MODEL,
  TLE_SOURCE_KIND,
  type TleArchiveManifest,
} from '../types';
import type {
  RunPayloadAcceptedManifest,
  RunPayloadAcceptedPayload,
  RunPayloadBootstrapManifest,
  RunPayloadBootstrapPayload,
  RunPayloadCanonicalAnchor,
  RunPayloadCanonicalTimeline,
  RunPayloadChunkEnvelope,
  RunPayloadIdentity,
  RunPayloadPlan,
  RunPayloadWorkerBuildResult,
  SerializableJsonValue,
  SelectableRunRequest,
} from './types';
import type { RunPayloadDenseBuilder, RunPayloadWorkerBuildContext } from './workerRuntime';

const SHA256_PATTERN = /^[0-9a-f]{64}$/;

export interface BrowserDenseRunPayloadBuilderOptions {
  /** Browser defaults to the real static archive; tests may read the same files through a fetcher. */
  readonly fetcher?: TleArchiveFetcher;
  readonly catalogUrl?: string;
  readonly parameters?: SimulatorParameters;
  readonly passPolicy?: Parameters<typeof buildTleAnalysisRun>[0]['passPolicy'];
  readonly yieldEveryAnchors?: number;
}

export interface RunPayloadChunkBuild {
  readonly reference: TleArtifactChunkRef;
  readonly bytes: Uint8Array;
  readonly envelope: RunPayloadChunkEnvelope;
}

function fail(message: string): never {
  throw new Error(`archived-TLE run payload build failed: ${message}`);
}

function assertActive(context: RunPayloadWorkerBuildContext): void {
  if (context.signal.aborted) fail('request was cancelled before publication');
}

function assertFiniteJson(value: unknown, path = 'payload'): asserts value is SerializableJsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return;
    fail(`${path} contains a non-finite number`);
  }
  if (Array.isArray(value)) {
    value.forEach((child, index) => assertFiniteJson(child, `${path}[${index}]`));
    return;
  }
  if (typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) fail(`${path} contains a non-plain object`);
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      assertFiniteJson(child, `${path}.${key}`);
    }
    return;
  }
  fail(`${path} contains a non-serializable value`);
}

function toSerializableJson(value: unknown, label: string): SerializableJsonValue {
  assertFiniteJson(value, label);
  const encoded = JSON.stringify(value);
  if (encoded === undefined) fail(`${label} could not be encoded as JSON`);
  const decoded = JSON.parse(encoded) as unknown;
  assertFiniteJson(decoded, label);
  return decoded;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle === undefined) fail('Web Crypto SHA-256 is unavailable');
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await subtle.digest('SHA-256', copy.buffer);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function parametersSha256(parameters: SimulatorParameters): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(parameters));
  return sha256Hex(bytes);
}

/** Exposed so callers can bind request.analysis.parametersSha256 without FNV or a placeholder digest. */
export async function createRunPayloadParametersSha256(parameters: SimulatorParameters): Promise<string> {
  return parametersSha256(parameters);
}

function assertFixedGeometry(request: SelectableRunRequest): void {
  const { geometry } = request;
  const expected: Readonly<Record<string, number>> = {
    durationS: TLE_RUN_DURATION_S,
    stepS: TLE_RUN_STEP_S,
    anchorCount: TLE_RUN_ANCHOR_COUNT,
  };
  for (const [key, value] of Object.entries(expected)) {
    if (geometry[key as keyof typeof geometry] !== value) {
      fail(`geometry.${key} must be ${value} for the canonical archived-TLE run`);
    }
  }
}

function assertArchivedSource(
  catalog: Awaited<ReturnType<typeof loadTleWebArchiveCatalog>>,
  selection: Awaited<ReturnType<typeof loadTleSnapshotSelection>>,
): void {
  if (catalog.sourceKind !== TLE_SOURCE_KIND || catalog.propagationModel !== TLE_PROPAGATION_MODEL) {
    fail('catalog is not an ARCHIVED_TLE/SGP4 source');
  }
  if (selection.snapshot.metadata.path === '' || selection.snapshot.sha256 === '') {
    fail('selected archive snapshot has no source identity');
  }
  if (selection.manifest.entries.some(entry => entry.sourceKind !== TLE_SOURCE_KIND)) {
    fail('selected manifest contains a non-ARCHIVED_TLE record');
  }
}

function sourceReceipt(
  request: SelectableRunRequest,
  catalog: Awaited<ReturnType<typeof loadTleWebArchiveCatalog>>,
  selection: Awaited<ReturnType<typeof loadTleSnapshotSelection>>,
): TleArtifactSourceReceipt {
  const snapshotKey = selection.snapshot.metadata.path.replace(/^\/+/, '');
  if (snapshotKey === '') fail('selected archive snapshot path is empty');
  return {
    archiveId: catalog.constellation,
    publicationSha256: selection.snapshot.sha256,
    sourceSnapshotDigest: selection.snapshot.sha256,
    // runArtifact immutable keys are transport-relative; the actual absolute
    // archive path remains present in the source snapshot/frame provenance.
    snapshotKey,
    snapshotSha256: selection.snapshot.sha256,
    requestedT0Utc: request.requestedT0Utc,
    appliedT0Utc: request.requestedT0Utc,
  };
}

function geometryIdentity(
  request: SelectableRunRequest,
): TleArtifactGeometryIdentity {
  return {
    ...request.geometry,
    observerId: request.observer.id,
    observerCoordinates: request.observer.coordinates,
    visibilityPolicyRevision: 'ntpu-observer-horizon-v1',
    coarseIndexRevision: 'dense-baseline-v1',
    exactSgp4Revision: 'satellite-js-sgp4-v1',
  };
}

function identitySeed(
  source: TleArtifactSourceReceipt,
  geometry: TleArtifactGeometryIdentity,
  analysis: SelectableRunRequest['analysis'] & { readonly analysisRunId: string },
  geometryRunId: string,
  bootstrapFrame: TleArtifactChunkRef,
): SelectableTleArtifactManifest {
  /**
   * The identity helpers read only source/geometry/analysis/pass fields. The
   * seed is never validated or published; its bootstrap descriptor is a real
   * pre-identity frame digest, replaced by the final descriptor below.
   */
  return {
    schema: 'selectable-tle-artifact-envelope-v1',
    status: 'bootstrap',
    runKey: '',
    passIndexKey: '',
    geometryRunId,
    source,
    geometry,
    analysis,
    chunks: { bootstrapFrame: bootstrapFrame },
  };
}

function jsonBytes(value: SerializableJsonValue): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

async function chunkReference(
  kind: TleArtifactChunkRef['kind'],
  bytes: Uint8Array,
  fields: Pick<TleArtifactChunkRef, 'startAnchorIndexInclusive' | 'endAnchorIndexExclusive' | 'anchorIndex' | 'lod'> = {},
): Promise<TleArtifactChunkRef> {
  const contentSha256 = await sha256Hex(bytes);
  if (!SHA256_PATTERN.test(contentSha256)) fail(`chunk ${kind} did not produce a SHA-256 digest`);
  return {
    kind,
    schema: `${kind}-v1`,
    contentSha256,
    byteLength: bytes.byteLength,
    immutableKey: `sha256/${contentSha256}/${kind}.json`,
    ...fields,
  };
}

async function buildChunk(
  kind: TleArtifactChunkRef['kind'],
  identity: RunPayloadIdentity,
  recordCount: number,
  payload: SerializableJsonValue,
  fields: Pick<TleArtifactChunkRef, 'startAnchorIndexInclusive' | 'endAnchorIndexExclusive' | 'anchorIndex' | 'lod'> = {},
): Promise<RunPayloadChunkBuild> {
  const envelopeWithoutDigest = {
    schema: `${kind}-v1`,
    kind,
    runKey: identity.runKey,
    passIndexKey: identity.passIndexKey,
    sourceSnapshotDigest: identity.sourceSnapshotDigest,
    geometryRunId: identity.geometryRunId,
    analysisRunId: identity.analysisRunId,
    recordCount,
    ...fields,
    payload,
  };
  const bytes = jsonBytes(toSerializableJson(envelopeWithoutDigest, `${kind} envelope`));
  const reference = await chunkReference(kind, bytes, fields);
  return {
    reference,
    bytes,
    envelope: { ...envelopeWithoutDigest, ...reference } as RunPayloadChunkEnvelope,
  };
}

function compactAnchor(
  analysisRun: TleAnalysisRun,
  frame: SimulationAnalysisFrame,
  anchorIndex: number,
): RunPayloadCanonicalAnchor {
  const selection = analysisRun.anchorSelections[anchorIndex];
  if (selection === undefined) fail(`canonical timeline is missing anchor selection ${anchorIndex}`);
  const trace = analysisRun.handoverTrace.anchors[anchorIndex] ?? null;
  return {
    anchorIndex,
    instantUtc: frame.instantUtc,
    frameId: frame.frameId,
    tleFrameId: frame.tleFrameId,
    selectedSatelliteId: frame.selectedSatelliteId,
    candidateSatelliteId: frame.candidateLink?.satelliteId ?? null,
    selection: toSerializableJson(selection, `anchor ${anchorIndex} selection`),
    handover: trace === null ? null : toSerializableJson(trace, `anchor ${anchorIndex} handover`),
    canonical: toSerializableJson({
      contractVersion: frame.contractVersion,
      inputs: frame.inputs,
      links: frame.links,
      candidateLink: frame.candidateLink,
      candidateComparison: frame.candidateComparison,
      power: frame.power,
      throughput: frame.throughput,
      ee: frame.ee,
      provenance: frame.provenance,
      canonical: frame.canonical,
      runAnchor: frame.runAnchor ?? null,
    }, `anchor ${anchorIndex} canonical values`),
  };
}

function assertFrameSource(frame: SimulationAnalysisFrame, anchorIndex: number): void {
  if (frame.provenance.sourceKind !== TLE_SOURCE_KIND) fail(`anchor ${anchorIndex} is not ARCHIVED_TLE`);
  if (frame.provenance.propagationModel !== TLE_PROPAGATION_MODEL) fail(`anchor ${anchorIndex} is not SGP4`);
  if (frame.tleState.propagationFrame.sourceKind !== TLE_SOURCE_KIND) fail(`anchor ${anchorIndex} TLE frame source is not ARCHIVED_TLE`);
  if (frame.tleState.propagationFrame.propagationModel !== TLE_PROPAGATION_MODEL) fail(`anchor ${anchorIndex} TLE frame is not SGP4`);
  if (frame.contractVersion !== SIMULATOR_CONTRACT_VERSION) fail(`anchor ${anchorIndex} contract version drifted`);
}

function globalObjectIndexPayload(geometryRun: TleRunBundle): SerializableJsonValue {
  return toSerializableJson({
    satellites: geometryRun.satellites,
    exclusionProvenance: geometryRun.exclusionProvenance,
    sourceCount: geometryRun.exclusionProvenance.sourceCount,
    includedCount: geometryRun.exclusionProvenance.includedCount,
  }, 'global object index');
}

function globalCurrentPayload(geometryRun: TleRunBundle): SerializableJsonValue {
  return toSerializableJson({
    anchorIndex: 0,
    instantUtc: geometryRun.getAnchorUtc(0),
    sourceKind: TLE_SOURCE_KIND,
    propagationModel: TLE_PROPAGATION_MODEL,
    objects: geometryRun.satellites.map((satellite, satelliteIndex) => {
      const state = geometryRun.readStateByIndex(0, satelliteIndex);
      return {
        satelliteId: satellite.satelliteId,
        satelliteName: satellite.satelliteName,
        sourcePath: satellite.sourcePath,
        sourceKind: state.sourceKind,
        propagationModel: state.propagationModel,
        positionTemeKm: state.positionTemeKm,
        velocityTemeKmPerSec: state.velocityTemeKmPerSec,
      };
    }),
  }, 'global current frame');
}

function timelinePayload(
  identity: RunPayloadIdentity,
  analysisRun: TleAnalysisRun,
  anchors: readonly RunPayloadCanonicalAnchor[],
): RunPayloadCanonicalTimeline {
  const fallbackCount = analysisRun.anchorSelections.filter(selection => (
    selection.selectionKind === 'visible-geometry-fallback'
  )).length;
  return {
    ...identity,
    sourceKind: TLE_SOURCE_KIND,
    propagationModel: TLE_PROPAGATION_MODEL,
    durationS: analysisRun.durationS,
    stepS: analysisRun.stepS,
    anchorCount: analysisRun.anchorCount,
    anchors,
    anchorSelections: toSerializableJson(analysisRun.anchorSelections, 'anchor selections'),
    handoverTrace: toSerializableJson(analysisRun.handoverTrace, 'handover trace'),
    evaluation: toSerializableJson(analysisRun.evaluation, 'run evaluation'),
    visibleGeometryFallbackAnchorCount: fallbackCount,
  };
}

function progress(
  context: RunPayloadWorkerBuildContext,
  phase: Parameters<RunPayloadWorkerBuildContext['reportProgress']>[0]['phase'],
  completedUnits: number,
  totalUnits: number,
  detail: string,
): void {
  context.reportProgress({ phase, completedUnits, totalUnits, detail });
}

/**
 * Real browser dense producer.  It is intentionally an adapter: archive
 * resolution, SGP4, pass planning, and canonical EE remain owned by their
 * existing modules; this file only packages their verified outputs.
 */
export function createBrowserDenseRunPayloadBuilder(
  options: BrowserDenseRunPayloadBuilderOptions = {},
): RunPayloadDenseBuilder {
  const parameters = options.parameters ?? DEFAULT_SIMULATOR_PARAMETERS;
  return async (request, context): Promise<RunPayloadWorkerBuildResult> => {
    assertFixedGeometry(request);
    if (request.analysis.canonicalScenarioRevision !== SIMULATOR_CONTRACT_VERSION) {
      fail('request canonical scenario revision does not match the simulator contract');
    }
    const expectedParametersSha256 = await parametersSha256(parameters);
    if (request.analysis.parametersSha256 !== expectedParametersSha256) {
      fail('request parametersSha256 does not match the injected canonical parameters');
    }

    const catalogUrl = options.catalogUrl ?? SIMULATOR_CATALOG_URLS[request.archiveId];
    progress(context, 'snapshot-resolving', 0, 1, `loading archived TLE catalog ${catalogUrl}`);
    const catalog = options.fetcher === undefined
      ? await loadTleWebArchiveCatalog(catalogUrl)
      : await loadTleWebArchiveCatalog(catalogUrl, options.fetcher);
    assertActive(context);
    if (catalog.constellation !== request.archiveId) fail('catalog constellation disagrees with request archiveId');
    const selection = options.fetcher === undefined
      ? await loadTleSnapshotSelection(catalog, request.requestedT0Utc)
      : await loadTleSnapshotSelection(catalog, request.requestedT0Utc, options.fetcher);
    assertActive(context);
    assertArchivedSource(catalog, selection);
    progress(context, 'snapshot-resolving', 1, 1, `resolved ${selection.manifest.entries.length} archived TLE records`);

    const geometryRun = await buildTleRunBundle({
      selection,
      t0Utc: request.requestedT0Utc,
      signal: context.signal,
      yieldEveryAnchors: options.yieldEveryAnchors,
      onProgress: runProgress => progress(
        context,
        'exact-confirming',
        runProgress.completedAnchors,
        runProgress.totalAnchors,
        `SGP4 anchor ${runProgress.completedAnchors}/${runProgress.totalAnchors}`,
      ),
    });
    assertActive(context);
    if (geometryRun.t0Utc !== request.requestedT0Utc) fail('geometry run applied a different UTC instant');
    progress(context, 'pass-indexing', 0, 1, 'building real pass and handover plan');
    const analysisRun = buildTleAnalysisRun({
      selection,
      geometryRun,
      parameters,
      passPolicy: options.passPolicy,
    });
    assertActive(context);
    progress(context, 'pass-indexing', 1, 1, `indexed ${analysisRun.passPlan.passes.length} real passes`);

    const firstFrame = analysisRun.getFrame(0);
    if (firstFrame === null) fail('real archived-TLE analysis has no first canonical frame');
    assertFrameSource(firstFrame, 0);
    const firstFrameValue = toSerializableJson(firstFrame, 'first canonical frame');
    const source = sourceReceipt(request, catalog, selection);
    const geometry = geometryIdentity(request);
    const analysis = {
      ...request.analysis,
      analysisRunId: analysisRun.analysisRunId,
    };
    const provisionalBytes = jsonBytes(toSerializableJson({
      sourceKind: TLE_SOURCE_KIND,
      propagationModel: TLE_PROPAGATION_MODEL,
      frameId: firstFrame.frameId,
      instantUtc: firstFrame.instantUtc,
      frame: firstFrameValue,
    }, 'first frame identity seed'));
    const provisionalReference = await chunkReference('bootstrap-frame', provisionalBytes);
    const seed = identitySeed(source, geometry, analysis, geometryRun.runId, provisionalReference);
    const passIndexKey = await createSelectableTlePassIndexKey(seed as ValidatedTleArtifactManifest);
    const runKey = await createSelectableTleRunKey({
      ...seed,
      passIndexKey,
    } as ValidatedTleArtifactManifest);
    const identity: RunPayloadIdentity = {
      runKey,
      passIndexKey,
      geometryRunId: geometryRun.runId,
      analysisRunId: analysisRun.analysisRunId,
      sourceSnapshotDigest: source.sourceSnapshotDigest,
    };

    progress(context, 'ntpu-canonical-building', 0, TLE_RUN_ANCHOR_COUNT, 'serializing canonical anchor timeline');
    const anchors: RunPayloadCanonicalAnchor[] = [];
    for (let anchorIndex = 0; anchorIndex < TLE_RUN_ANCHOR_COUNT; anchorIndex += 1) {
      assertActive(context);
      const frame = analysisRun.getFrame(anchorIndex);
      if (frame === null) fail(`real archived-TLE analysis has no frame at anchor ${anchorIndex}`);
      assertFrameSource(frame, anchorIndex);
      anchors.push(compactAnchor(analysisRun, frame, anchorIndex));
      progress(context, 'ntpu-canonical-building', anchorIndex + 1, TLE_RUN_ANCHOR_COUNT, `canonical anchor ${anchorIndex + 1}/${TLE_RUN_ANCHOR_COUNT}`);
    }
    const timeline = timelinePayload(identity, analysisRun, anchors);
    const bootstrapChunkPayload = toSerializableJson({
      sourceKind: TLE_SOURCE_KIND,
      propagationModel: TLE_PROPAGATION_MODEL,
      frameId: firstFrame.frameId,
      instantUtc: firstFrame.instantUtc,
      frame: firstFrameValue,
    }, 'bootstrap frame payload');
    const bootstrapChunk = await buildChunk('bootstrap-frame', identity, 1, bootstrapChunkPayload);
    const bootstrapManifestInput = {
      ...seed,
      runKey,
      passIndexKey,
      chunks: { bootstrapFrame: bootstrapChunk.reference },
    } satisfies SelectableTleArtifactManifest;
    const bootstrapManifest = validateSelectableTleArtifactManifest(bootstrapManifestInput) as RunPayloadBootstrapManifest;
    await verifySelectableTleArtifactIdentity(bootstrapManifest);
    await verifyTleArtifactJsonChunk(bootstrapManifest, bootstrapChunk.reference, bootstrapChunk.bytes);
    const bootstrapPayload: RunPayloadBootstrapPayload = {
      manifest: bootstrapManifest,
      bootstrapFrame: bootstrapChunk.envelope,
      sourceKind: TLE_SOURCE_KIND,
      propagationModel: TLE_PROPAGATION_MODEL,
      frameId: firstFrame.frameId,
      instantUtc: firstFrame.instantUtc,
      frame: firstFrameValue,
    };

    progress(context, 'payload-packaging', 0, 4, 'packaging pass, local canonical, and global chunks');
    const passIndexChunk = await buildChunk(
      'pass-index',
      identity,
      analysisRun.passPlan.passes.length,
      toSerializableJson(analysisRun.passPlan, 'pass index payload'),
    );
    progress(context, 'payload-packaging', 1, 4, 'packaged pass index');
    const ntpuChunk = await buildChunk(
      'ntpu-range',
      identity,
      timeline.anchorCount,
      toSerializableJson(timeline, 'NTPU canonical timeline'),
      { startAnchorIndexInclusive: 0, endAnchorIndexExclusive: TLE_RUN_ANCHOR_COUNT },
    );
    progress(context, 'payload-packaging', 2, 4, 'packaged complete NTPU anchor range');
    const globalObjectChunk = await buildChunk(
      'global-object-index',
      identity,
      geometryRun.satelliteCount,
      globalObjectIndexPayload(geometryRun),
    );
    const globalCurrentChunk = await buildChunk(
      'global-current',
      identity,
      geometryRun.satelliteCount,
      globalCurrentPayload(geometryRun),
      { anchorIndex: 0, lod: 'overview' },
    );
    progress(context, 'payload-packaging', 4, 4, 'packaged global anchor-0 view');

    const acceptedManifestInput = {
      ...bootstrapManifest,
      status: 'accepted',
      chunks: {
        bootstrapFrame: bootstrapChunk.reference,
        passIndex: passIndexChunk.reference,
        ntpuRanges: [ntpuChunk.reference],
        globalObjectIndex: globalObjectChunk.reference,
        globalFirstCurrent: globalCurrentChunk.reference,
      },
    } satisfies SelectableTleArtifactManifest;
    const acceptedManifest = validateSelectableTleArtifactManifest(acceptedManifestInput) as RunPayloadAcceptedManifest;
    await verifySelectableTleArtifactIdentity(acceptedManifest);
    for (const child of [bootstrapChunk, passIndexChunk, ntpuChunk, globalObjectChunk, globalCurrentChunk]) {
      await verifyTleArtifactJsonChunk(acceptedManifest, child.reference, child.bytes);
    }
    const acceptedPayload: RunPayloadAcceptedPayload = {
      manifest: acceptedManifest,
      acceptedAnchorCount: TLE_RUN_ANCHOR_COUNT,
      acceptedIntervalCount: TLE_RUN_ANCHOR_COUNT - 1,
      timeline,
    };
    const plan: RunPayloadPlan = {
      protocol: 'selectable-tle-run-payload-v1',
      request,
      identity,
      manifest: bootstrapManifest,
    };
    return { plan, bootstrap: bootstrapPayload, accepted: acceptedPayload };
  };
}
