import {
  SIMULATOR_CONTRACT_VERSION,
  type LoadedTleSnapshotSelection,
  type SimulationAnalysisFrame,
  type SimulatorParameters,
  type SimulatorTleState,
  type TleWebArchiveCatalog,
} from '../../simulator/types';
import type { SimulationAnalysisFrameBuildOptions } from '../../simulator/analysis';

export const HOMEPAGE_FIRST_FRAME_CACHE_SCHEMA = 'homepage-first-frame-v5' as const;
export const HOMEPAGE_FIRST_FRAME_ARTIFACT_SCHEMA = 'homepage-first-frame-artifact-v3' as const;
export const HOMEPAGE_FIRST_FRAME_FORMULA_VERSION = `canonical-ee:${SIMULATOR_CONTRACT_VERSION}:v1` as const;
export const HOMEPAGE_FIRST_FRAME_LINK_SHAPE_VERSION = 'canonical-link-result:before-satellite-cap-power-v1' as const;

export const HOMEPAGE_FIRST_FRAME_SESSION_STORAGE_KEY = 'leo-beam-sim:homepage:first-frame:v5';
export const HOMEPAGE_DEFAULT_FIRST_FRAME_ARTIFACT_URL = '/homepage-first-frame/starlink-20260812.json';
const MAX_MODULE_CACHE_ENTRIES = 4;
const LEGACY_HOMEPAGE_FIRST_FRAME_SESSION_STORAGE_KEYS = [
  'leo-beam-sim:homepage:first-frame:v4',
  'leo-beam-sim:homepage:first-frame:v3',
] as const;

export interface HomepageFirstFrameCacheKey {
  readonly schema: typeof HOMEPAGE_FIRST_FRAME_CACHE_SCHEMA;
  readonly constellation: TleWebArchiveCatalog['constellation'];
  readonly requestedInstantUtc: string;
  readonly appliedInstantUtc: string;
  readonly archiveId: string;
  readonly archiveContentSha256: string | null;
  readonly snapshotPath: string;
  readonly snapshotSha256: string;
  readonly formulaVersion: typeof HOMEPAGE_FIRST_FRAME_FORMULA_VERSION;
  readonly linkShapeVersion: typeof HOMEPAGE_FIRST_FRAME_LINK_SHAPE_VERSION;
  readonly parametersVersion: string;
  /** Digest of every scenario option that can change the first-frame result. */
  readonly frameOptionsVersion: string;
}

export type HomepageFirstFrameCacheHit =
  | {
    readonly frame: SimulationAnalysisFrame;
    readonly source: 'module';
  }
  | {
    /** Session storage keeps only this compact state; the canonical frame is rebuilt by the hook. */
    readonly source: 'session';
    readonly tleState: SimulatorTleState;
  };

interface PersistedHomepageFirstFrame {
  readonly schema: typeof HOMEPAGE_FIRST_FRAME_CACHE_SCHEMA;
  readonly key: HomepageFirstFrameCacheKey;
  readonly tleState: SimulatorTleState;
}

export interface HomepageFirstFrameArtifact {
  readonly schema: typeof HOMEPAGE_FIRST_FRAME_ARTIFACT_SCHEMA;
  readonly key: HomepageFirstFrameCacheKey;
  readonly tleState: SimulatorTleState;
}

export interface HomepageFirstFrameArtifactExpectation {
  readonly requestedInstantUtc: string;
  readonly appliedInstantUtc: string;
  readonly catalog: TleWebArchiveCatalog;
  readonly parameters: SimulatorParameters;
  readonly frameOptions?: SimulationAnalysisFrameBuildOptions;
}

/**
 * The persisted session payload is intentionally compact, but it is still
 * treated as untrusted input.  Callers must provide the current catalog and
 * model parameters before accepting it as a first frame.
 */
export type HomepageFirstFrameSessionExpectation = HomepageFirstFrameArtifactExpectation;

const moduleCache = new Map<string, SimulationAnalysisFrame>();
const artifactJsonPromiseCache = new Map<string, Promise<unknown | null>>();

function stableParameterText(parameters: SimulatorParameters): string {
  return JSON.stringify(parameters);
}

function fnvHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function homepageFirstFrameParametersVersion(parameters: SimulatorParameters): string {
  return `parameters-v1:${fnvHash(stableParameterText(parameters))}`;
}

function stableFrameOptionsText(options: SimulationAnalysisFrameBuildOptions | undefined): string {
  const userPositionOverrides = [...(options?.userPositionOverridesKm ?? [])]
    .map(override => ({
      userIndex: override.userIndex,
      positionKm: [override.positionKm[0], override.positionKm[1]],
    }))
    .sort((left, right) => left.userIndex - right.userIndex);
  const perSatelliteBeamLayoutCount = Object.fromEntries(
    Object.entries(options?.perSatelliteBeamLayoutCount ?? {})
      .sort(([left], [right]) => left.localeCompare(right)),
  );
  return JSON.stringify({
    beamLayoutCount: options?.beamLayoutCount ?? null,
    perSatelliteBeamLayoutCount,
    beamIlluminationMode: options?.beamIlluminationMode ?? null,
    userPositionOverridesKm: userPositionOverrides,
    representativeUserIndex: options?.representativeUserIndex ?? null,
  });
}

export function homepageFirstFrameOptionsVersion(
  options?: SimulationAnalysisFrameBuildOptions,
): string {
  return `frame-options-v1:${fnvHash(stableFrameOptionsText(options))}`;
}

export function createHomepageFirstFrameCacheKey(
  requestedInstantUtc: string,
  appliedInstantUtc: string,
  catalog: TleWebArchiveCatalog,
  selection: LoadedTleSnapshotSelection,
  parameters: SimulatorParameters,
  frameOptions?: SimulationAnalysisFrameBuildOptions,
): HomepageFirstFrameCacheKey {
  return Object.freeze({
    schema: HOMEPAGE_FIRST_FRAME_CACHE_SCHEMA,
    constellation: catalog.constellation,
    requestedInstantUtc,
    appliedInstantUtc,
    archiveId: catalog.archiveId,
    archiveContentSha256: catalog.archiveContentSha256 ?? null,
    snapshotPath: selection.snapshot.metadata.path,
    snapshotSha256: selection.snapshot.sha256,
    formulaVersion: HOMEPAGE_FIRST_FRAME_FORMULA_VERSION,
    linkShapeVersion: HOMEPAGE_FIRST_FRAME_LINK_SHAPE_VERSION,
    parametersVersion: homepageFirstFrameParametersVersion(parameters),
    frameOptionsVersion: homepageFirstFrameOptionsVersion(frameOptions),
  });
}

/**
 * Recreate the same cache identity from a validated compact state.  This is
 * used by the checked-in first-frame artifact path, where loading the full
 * archive selection would defeat the purpose of the artifact.
 */
export function createHomepageFirstFrameCacheKeyFromTleState(
  requestedInstantUtc: string,
  appliedInstantUtc: string,
  catalog: TleWebArchiveCatalog,
  tleState: SimulatorTleState,
  parameters: SimulatorParameters,
  frameOptions?: SimulationAnalysisFrameBuildOptions,
): HomepageFirstFrameCacheKey {
  return Object.freeze({
    schema: HOMEPAGE_FIRST_FRAME_CACHE_SCHEMA,
    constellation: catalog.constellation,
    requestedInstantUtc,
    appliedInstantUtc,
    archiveId: catalog.archiveId,
    archiveContentSha256: catalog.archiveContentSha256 ?? null,
    snapshotPath: tleState.archiveSnapshot.metadata.path,
    snapshotSha256: tleState.archiveSnapshot.sha256,
    formulaVersion: HOMEPAGE_FIRST_FRAME_FORMULA_VERSION,
    linkShapeVersion: HOMEPAGE_FIRST_FRAME_LINK_SHAPE_VERSION,
    parametersVersion: homepageFirstFrameParametersVersion(parameters),
    frameOptionsVersion: homepageFirstFrameOptionsVersion(frameOptions),
  });
}

export function homepageFirstFrameCacheId(key: HomepageFirstFrameCacheKey): string {
  return JSON.stringify(key);
}

function sessionStorageOrNull(): Storage | null {
  try {
    return typeof globalThis.sessionStorage === 'undefined' ? null : globalThis.sessionStorage;
  } catch {
    return null;
  }
}

function freezeDeep<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) freezeDeep(child);
  return value;
}

function tleStateForSession(frame: SimulationAnalysisFrame): SimulatorTleState {
  const tleState = frame.tleState;
  const selectedId = tleState.selectedSatelliteId;
  const candidateId = tleState.candidateSatellite?.satelliteId ?? null;
  const retainedIds = new Set([selectedId, ...(candidateId === null ? [] : [candidateId])]);
  const retainedSatellites = tleState.propagationFrame.satellites.filter(satellite => retainedIds.has(satellite.satelliteId));
  const retainedProvenanceSnapshots = tleState.propagationFrame.provenance.snapshots
    .filter(snapshot => retainedIds.has(snapshot.satelliteId));
  const retainedEpochs: Record<string, string> = {};
  for (const satellite of retainedSatellites) retainedEpochs[satellite.satelliteId] = satellite.tleEpochUtc;
  const retainedEntries = tleState.archiveSnapshot.entries.filter(entry => retainedIds.has(entry.satelliteId));
  const compactState: SimulatorTleState = {
    ...tleState,
    propagationFrame: {
      ...tleState.propagationFrame,
      resolvedEpochsUtc: retainedEpochs,
      satellites: retainedSatellites,
      provenance: {
        ...tleState.propagationFrame.provenance,
        snapshots: retainedProvenanceSnapshots,
      },
    },
    archiveSnapshot: {
      ...tleState.archiveSnapshot,
      entries: retainedEntries,
    },
    catalog: {
      ...tleState.catalog,
      snapshots: [],
    },
  };
  return freezeDeep(compactState);
}

function tleStateMatchesKey(tleState: SimulatorTleState, key: HomepageFirstFrameCacheKey): boolean {
  if (tleState.requestedInstantUtc !== key.appliedInstantUtc) return false;
  if (tleState.catalog.constellation !== key.constellation) return false;
  if (tleState.catalog.archiveId !== key.archiveId) return false;
  if ((tleState.catalog.archiveContentSha256 ?? null) !== key.archiveContentSha256) return false;
  if (tleState.archiveSnapshot.metadata.path !== key.snapshotPath) return false;
  if (tleState.archiveSnapshot.sha256 !== key.snapshotSha256) return false;
  if (tleState.selectedSnapshot.sourcePath !== key.snapshotPath) return false;
  if (tleState.selectedSnapshot.sourceKind !== 'ARCHIVED_TLE') return false;
  if (tleState.propagationFrame.sourceKind !== 'ARCHIVED_TLE') return false;
  if (tleState.propagationFrame.propagationModel !== 'SGP4') return false;
  if (tleState.propagationFrame.provenance.archiveId !== key.archiveId) return false;
  if (tleState.propagationFrame.satellites.length === 0 || tleState.propagationFrame.satellites.length > 2) return false;
  const selected = tleState.propagationFrame.satellites.find(satellite => satellite.satelliteId === tleState.selectedSatelliteId);
  if (selected === undefined) return false;
  const candidateId = tleState.candidateSatellite?.satelliteId ?? null;
  if (candidateId === tleState.selectedSatelliteId) return false;
  if (candidateId !== null && !tleState.propagationFrame.satellites.some(satellite => satellite.satelliteId === candidateId)) return false;
  if (tleState.propagationFrame.provenance.snapshots.some(snapshot => !tleState.propagationFrame.satellites.some(satellite => satellite.satelliteId === snapshot.satelliteId))) return false;
  return true;
}

function artifactKeyMatchesExpectation(
  key: HomepageFirstFrameCacheKey,
  expectation: HomepageFirstFrameArtifactExpectation,
): boolean {
  return key.schema === HOMEPAGE_FIRST_FRAME_CACHE_SCHEMA
    && key.constellation === expectation.catalog.constellation
    && key.requestedInstantUtc === expectation.requestedInstantUtc
    && key.appliedInstantUtc === expectation.appliedInstantUtc
    && key.archiveId === expectation.catalog.archiveId
    && key.archiveContentSha256 === (expectation.catalog.archiveContentSha256 ?? null)
    && key.formulaVersion === HOMEPAGE_FIRST_FRAME_FORMULA_VERSION
    && key.linkShapeVersion === HOMEPAGE_FIRST_FRAME_LINK_SHAPE_VERSION
    && key.parametersVersion === homepageFirstFrameParametersVersion(expectation.parameters)
    && key.frameOptionsVersion === homepageFirstFrameOptionsVersion(expectation.frameOptions);
}

function loadHomepageFirstFrameArtifactJson(url: string): Promise<unknown | null> {
  const cached = artifactJsonPromiseCache.get(url);
  if (cached !== undefined) return cached;
  // Keep the JSON promise for this page lifetime.  The checked-in artifact is
  // immutable, so this both coalesces StrictMode's overlapping effects and
  // avoids a second request when the catalog happens to finish after the
  // artifact.  A rejected fetch is converted to null and remains a safe
  // fail-closed result; a reload starts a fresh page lifetime.
  const request = (async (): Promise<unknown | null> => {
    try {
      const response = await globalThis.fetch(url, { cache: 'force-cache' });
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  })();
  artifactJsonPromiseCache.set(url, request);
  return request;
}

/** Start the default artifact request before the catalog has finished parsing. */
export function preloadHomepageFirstFrameArtifact(
  url = HOMEPAGE_DEFAULT_FIRST_FRAME_ARTIFACT_URL,
): void {
  void loadHomepageFirstFrameArtifactJson(url);
}

/** Compact state shared by the session cache and the checked-in artifact. */
export function compactHomepageFirstFrameTleState(frame: SimulationAnalysisFrame): SimulatorTleState {
  return tleStateForSession(frame);
}

export function parseHomepageFirstFrameArtifact(
  raw: unknown,
  expectation: HomepageFirstFrameArtifactExpectation,
): SimulatorTleState | null {
  if (raw === null || typeof raw !== 'object') return null;
  const candidate = raw as Partial<HomepageFirstFrameArtifact>;
  if (candidate.schema !== HOMEPAGE_FIRST_FRAME_ARTIFACT_SCHEMA || candidate.key === undefined || candidate.tleState === undefined) return null;
  if (!artifactKeyMatchesExpectation(candidate.key, expectation)) return null;
  if (!tleStateMatchesKey(candidate.tleState, candidate.key)) return null;
  return freezeDeep(candidate.tleState);
}

export async function loadHomepageFirstFrameArtifact(
  expectation: HomepageFirstFrameArtifactExpectation,
  url = HOMEPAGE_DEFAULT_FIRST_FRAME_ARTIFACT_URL,
): Promise<SimulatorTleState | null> {
  return parseHomepageFirstFrameArtifact(await loadHomepageFirstFrameArtifactJson(url), expectation);
}

function frameHasCurrentLinkPowerShape(frame: SimulationAnalysisFrame): boolean {
  // `beforeSatelliteCapPowerW` was added to the producer-facing link contract.
  // A frame from an older module/session/artifact path must not be published,
  // otherwise the right-rail pre-satellite-cap row silently renders as a dash.
  return frame.links.every(link => Number.isFinite(link.beforeSatelliteCapPowerW))
    && (frame.candidateLink === null || Number.isFinite(frame.candidateLink.beforeSatelliteCapPowerW));
}

function frameMatchesKey(frame: SimulationAnalysisFrame, key: HomepageFirstFrameCacheKey): boolean {
  if (frame.instantUtc !== key.appliedInstantUtc) return false;
  if (frame.provenance.constellation !== key.constellation) return false;
  if (frame.provenance.archiveId !== key.archiveId) return false;
  if (frame.provenance.selectedTlePath !== key.snapshotPath) return false;
  if (frame.provenance.propagationModel !== 'SGP4' || frame.provenance.sourceKind !== 'ARCHIVED_TLE') return false;
  if (frame.provenance.analysisContractVersion !== SIMULATOR_CONTRACT_VERSION) return false;
  if (key.linkShapeVersion !== HOMEPAGE_FIRST_FRAME_LINK_SHAPE_VERSION) return false;
  if (homepageFirstFrameParametersVersion(frame.parameters) !== key.parametersVersion) return false;
  if (frame.tleState.selectedSatelliteId !== frame.selectedSatelliteId) return false;
  if (!frame.tleState.propagationFrame.satellites.some(satellite => satellite.satelliteId === frame.selectedSatelliteId)) return false;
  if (!frameHasCurrentLinkPowerShape(frame)) return false;
  return true;
}

function readPersistedSession(key: HomepageFirstFrameCacheKey): SimulatorTleState | null {
  const storage = sessionStorageOrNull();
  if (storage === null) return null;
  try {
    const raw = storage.getItem(HOMEPAGE_FIRST_FRAME_SESSION_STORAGE_KEY);
    if (raw === null) return null;
    const persisted = JSON.parse(raw) as Partial<PersistedHomepageFirstFrame>;
    if (persisted.schema !== HOMEPAGE_FIRST_FRAME_CACHE_SCHEMA || persisted.key === undefined || persisted.tleState === undefined) return null;
    if (homepageFirstFrameCacheId(persisted.key) !== homepageFirstFrameCacheId(key)) return null;
    if (!tleStateMatchesKey(persisted.tleState, key)) return null;
    return freezeDeep(persisted.tleState);
  } catch {
    return null;
  }
}

/**
 * Read the compact session payload without loading the full TLE snapshot.
 *
 * This is the warm-reload fast path.  The current catalog identity, requested
 * instant, formula contract, and parameter fingerprint are all checked before
 * the compact state is allowed to rebuild a canonical frame.
 */
export function readHomepageFirstFrameSessionCache(
  expectation: HomepageFirstFrameSessionExpectation,
): SimulatorTleState | null {
  const storage = sessionStorageOrNull();
  if (storage === null) return null;
  try {
    const raw = storage.getItem(HOMEPAGE_FIRST_FRAME_SESSION_STORAGE_KEY);
    if (raw === null) return null;
    const persisted = JSON.parse(raw) as Partial<PersistedHomepageFirstFrame>;
    if (persisted.schema !== HOMEPAGE_FIRST_FRAME_CACHE_SCHEMA || persisted.key === undefined || persisted.tleState === undefined) return null;
    if (!artifactKeyMatchesExpectation(persisted.key, expectation)) return null;
    if (!tleStateMatchesKey(persisted.tleState, persisted.key)) return null;
    return freezeDeep(persisted.tleState);
  } catch {
    return null;
  }
}

export function readHomepageFirstFrameCache(key: HomepageFirstFrameCacheKey): HomepageFirstFrameCacheHit | null {
  const id = homepageFirstFrameCacheId(key);
  const moduleFrame = moduleCache.get(id);
  if (moduleFrame !== undefined && frameMatchesKey(moduleFrame, key)) {
    return { frame: moduleFrame, source: 'module' };
  }
  const sessionFrame = readPersistedSession(key);
  if (sessionFrame === null) return null;
  return { tleState: sessionFrame, source: 'session' };
}

export function writeHomepageFirstFrameModuleCache(
  key: HomepageFirstFrameCacheKey,
  frame: SimulationAnalysisFrame,
): boolean {
  if (!frameMatchesKey(frame, key)) return false;
  const id = homepageFirstFrameCacheId(key);
  moduleCache.delete(id);
  moduleCache.set(id, frame);
  while (moduleCache.size > MAX_MODULE_CACHE_ENTRIES) {
    const oldest = moduleCache.keys().next().value;
    if (typeof oldest !== 'string') break;
    moduleCache.delete(oldest);
  }
  return true;
}

export function writeHomepageFirstFrameCache(
  key: HomepageFirstFrameCacheKey,
  frame: SimulationAnalysisFrame,
): boolean {
  if (!writeHomepageFirstFrameModuleCache(key, frame)) return false;

  const storage = sessionStorageOrNull();
  if (storage === null) return true;
  try {
    const persisted: PersistedHomepageFirstFrame = {
      schema: HOMEPAGE_FIRST_FRAME_CACHE_SCHEMA,
      key,
      tleState: tleStateForSession(frame),
    };
    storage.setItem(HOMEPAGE_FIRST_FRAME_SESSION_STORAGE_KEY, JSON.stringify(persisted));
    for (const legacyKey of LEGACY_HOMEPAGE_FIRST_FRAME_SESSION_STORAGE_KEYS) storage.removeItem(legacyKey);
    return true;
  } catch {
    // A restricted or full session store must not block the canonical path.
    return true;
  }
}

export function clearHomepageFirstFrameModuleCacheForTests(): void {
  moduleCache.clear();
}

export function clearHomepageFirstFrameCacheForTests(): void {
  clearHomepageFirstFrameModuleCacheForTests();
  artifactJsonPromiseCache.clear();
  const storage = sessionStorageOrNull();
  try {
    storage?.removeItem(HOMEPAGE_FIRST_FRAME_SESSION_STORAGE_KEY);
  } catch {
    // Test cleanup is best effort in browsers that disable session storage.
  }
}
