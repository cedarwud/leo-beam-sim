import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildSimulationAnalysisFrame,
  createSimulatorTleState,
} from '../../simulator/analysis';
import {
  loadTleSnapshotSelection,
  loadTleWebArchiveCatalog,
} from '../../simulator/archive';
import { DEFAULT_SIMULATOR_PARAMETERS, type SimulationAnalysisFrame } from '../../simulator/types';
import {
  clearHomepageFirstFrameCacheForTests,
  clearHomepageFirstFrameModuleCacheForTests,
  createHomepageFirstFrameCacheKey,
  homepageFirstFrameOptionsVersion,
  homepageFirstFrameCacheId,
  parseHomepageFirstFrameArtifact,
  readHomepageFirstFrameCache,
  readHomepageFirstFrameSessionCache,
  writeHomepageFirstFrameCache,
} from './homepageFirstFrameCache';

const fetchFromPublic = async (path: RequestInfo | URL): Promise<Response> => (
  new Response(await readFile(`public${String(path)}`), { status: 200 })
);

const storage = new Map<string, string>();
const sessionStorageShim: Storage = {
  get length() { return storage.size; },
  clear: () => storage.clear(),
  getItem: key => storage.get(key) ?? null,
  key: index => [...storage.keys()][index] ?? null,
  removeItem: key => { storage.delete(key); },
  setItem: (key, value) => { storage.set(key, value); },
};
const previousSessionStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: sessionStorageShim });

try {
  const catalog = await loadTleWebArchiveCatalog('/tle-archive/oneweb/catalog.json', fetchFromPublic);
  const selection = await loadTleSnapshotSelection(catalog, '2026-08-07T23:59:59.000Z', fetchFromPublic);
  const tleState = createSimulatorTleState(selection, '2026-08-07T23:59:59.000Z');
  const frame = buildSimulationAnalysisFrame(tleState, DEFAULT_SIMULATOR_PARAMETERS);
  const key = createHomepageFirstFrameCacheKey(
    '2026-08-07T23:59:59.000Z',
    '2026-08-07T23:59:59.000Z',
    catalog,
    selection,
    DEFAULT_SIMULATOR_PARAMETERS,
  );

  clearHomepageFirstFrameCacheForTests();
  writeHomepageFirstFrameCache(key, frame);
  const moduleHit = readHomepageFirstFrameCache(key);
  assert.equal(moduleHit?.source, 'module');
  if (moduleHit?.source !== 'module') throw new Error('expected module cache hit');
  assert.equal(moduleHit.frame.frameId, frame.frameId);
  assert.equal(moduleHit.frame.provenance.propagationModel, 'SGP4');
  assert.equal(moduleHit.frame.provenance.archiveId, catalog.archiveId);
  assert.ok(moduleHit.frame.links.every(link => Number.isFinite(link.beforeSatelliteCapPowerW)));
  assert.ok(moduleHit.frame.candidateLink === null || Number.isFinite(moduleHit.frame.candidateLink.beforeSatelliteCapPowerW));
  const sessionPayload = [...storage.values()][0] ?? '';
  assert.ok(sessionPayload.length < 100_000, `compact session payload must stay small, got ${sessionPayload.length} bytes`);

  clearHomepageFirstFrameModuleCacheForTests();
  const sessionHit = readHomepageFirstFrameCache(key);
  assert.equal(sessionHit?.source, 'session');
  if (sessionHit?.source !== 'session') throw new Error('expected session cache hit');
  const rebuilt = buildSimulationAnalysisFrame(sessionHit.tleState, DEFAULT_SIMULATOR_PARAMETERS);
  assert.equal(rebuilt.frameId, frame.frameId);
  assert.equal(rebuilt.provenance.propagationModel, 'SGP4');
  assert.equal(sessionHit.tleState.selectedSatelliteId, frame.tleState.selectedSatelliteId);
  assert.ok(sessionHit.tleState.propagationFrame.satellites.length <= 2);
  assert.ok(sessionHit.tleState.propagationFrame.provenance.snapshots.length <= 2);

  const sessionExpectation = {
    requestedInstantUtc: key.requestedInstantUtc,
    appliedInstantUtc: key.appliedInstantUtc,
    catalog,
    parameters: DEFAULT_SIMULATOR_PARAMETERS,
  };
  const expectationHit = readHomepageFirstFrameSessionCache(sessionExpectation);
  assert.notEqual(expectationHit, null, 'session cache must validate against the current catalog and parameters');
  assert.equal(expectationHit?.selectedSatelliteId, frame.selectedSatelliteId);
  assert.equal(
    readHomepageFirstFrameSessionCache({
      ...sessionExpectation,
      parameters: { ...DEFAULT_SIMULATOR_PARAMETERS, beamPowerCapW: DEFAULT_SIMULATOR_PARAMETERS.beamPowerCapW + 0.1 },
    }),
    null,
    'session cache must fail closed when the parameter fingerprint changes',
  );
  assert.equal(
    readHomepageFirstFrameSessionCache({
      ...sessionExpectation,
      catalog: { ...catalog, archiveId: `${catalog.archiveId}-stale` },
    }),
    null,
    'session cache must fail closed when the archive identity changes',
  );

  const legacyFrame = {
    ...frame,
    links: frame.links.map(link => ({ ...link, beforeSatelliteCapPowerW: undefined })),
  } as unknown as SimulationAnalysisFrame;
  clearHomepageFirstFrameCacheForTests();
  assert.equal(
    writeHomepageFirstFrameCache(key, legacyFrame),
    false,
    'frames from before the link power field was published must not enter module/session cache',
  );
  assert.equal(storage.size, 0);

  const changedParameterKey = createHomepageFirstFrameCacheKey(
    key.requestedInstantUtc,
    key.appliedInstantUtc,
    catalog,
    selection,
    { ...DEFAULT_SIMULATOR_PARAMETERS, beamPowerCapW: DEFAULT_SIMULATOR_PARAMETERS.beamPowerCapW + 0.1 },
  );
  assert.notEqual(homepageFirstFrameCacheId(key), homepageFirstFrameCacheId(changedParameterKey));
  assert.equal(readHomepageFirstFrameCache(changedParameterKey), null);

  const changedOptionsKey = createHomepageFirstFrameCacheKey(
    key.requestedInstantUtc,
    key.appliedInstantUtc,
    catalog,
    selection,
    DEFAULT_SIMULATOR_PARAMETERS,
    { representativeUserIndex: 1 },
  );
  assert.notEqual(
    key.frameOptionsVersion,
    changedOptionsKey.frameOptionsVersion,
    'scenario options must participate in first-frame identity',
  );
  assert.notEqual(homepageFirstFrameCacheId(key), homepageFirstFrameCacheId(changedOptionsKey));
  assert.equal(readHomepageFirstFrameCache(changedOptionsKey), null);
  assert.equal(
    homepageFirstFrameOptionsVersion({
      userPositionOverridesKm: [
        { userIndex: 4, positionKm: [2, 3] },
        { userIndex: 1, positionKm: [0, 1] },
      ],
      perSatelliteBeamLayoutCount: { z: 19, a: 7 },
    }),
    homepageFirstFrameOptionsVersion({
      userPositionOverridesKm: [
        { userIndex: 1, positionKm: [0, 1] },
        { userIndex: 4, positionKm: [2, 3] },
      ],
      perSatelliteBeamLayoutCount: { a: 7, z: 19 },
    }),
    'option identity must be independent of insertion order',
  );

  const changedArchiveKey = { ...key, archiveId: `${key.archiveId}-changed` };
  assert.notEqual(homepageFirstFrameCacheId(key), homepageFirstFrameCacheId(changedArchiveKey));
  assert.equal(readHomepageFirstFrameCache(changedArchiveKey), null);
  const staleLinkShapeKey = {
    ...key,
    linkShapeVersion: 'canonical-link-result:legacy' as never,
  };
  assert.equal(
    readHomepageFirstFrameCache(staleLinkShapeKey),
    null,
    'a cache key without the current before-satellite-cap link shape must fail closed',
  );

  const starlinkCatalog = await loadTleWebArchiveCatalog(
    '/tle-archive/starlink/catalog.json',
    fetchFromPublic,
  );
  const artifact = JSON.parse(await readFile('public/homepage-first-frame/starlink-20260812.json', 'utf8')) as unknown;
  const artifactState = parseHomepageFirstFrameArtifact(artifact, {
    requestedInstantUtc: '2026-08-12T12:00:00.000Z',
    appliedInstantUtc: '2026-08-12T12:00:00.000Z',
    catalog: starlinkCatalog,
    parameters: DEFAULT_SIMULATOR_PARAMETERS,
  });
  assert.notEqual(artifactState, null, 'checked-in default artifact must match the latest Starlink catalog and default parameters');
  if (artifactState === null) throw new Error('expected default artifact state');
  assert.equal(
    buildSimulationAnalysisFrame(artifactState, DEFAULT_SIMULATOR_PARAMETERS).provenance.propagationModel,
    'SGP4',
  );
  assert.equal(artifactState.propagationFrame.satellites.length <= 2, true);
  const rebuiltArtifactFrame = buildSimulationAnalysisFrame(artifactState, DEFAULT_SIMULATOR_PARAMETERS);
  assert.ok(rebuiltArtifactFrame.links.every(link => Number.isFinite(link.beforeSatelliteCapPowerW)));
  assert.ok(rebuiltArtifactFrame.candidateLink === null || Number.isFinite(rebuiltArtifactFrame.candidateLink.beforeSatelliteCapPowerW));
  assert.equal(
    parseHomepageFirstFrameArtifact(
      { ...(artifact as Record<string, unknown>), schema: 'homepage-first-frame-artifact-v1' },
      {
        requestedInstantUtc: '2026-08-12T12:00:00.000Z',
        appliedInstantUtc: '2026-08-12T12:00:00.000Z',
        catalog: starlinkCatalog,
        parameters: DEFAULT_SIMULATOR_PARAMETERS,
      },
    ),
    null,
    'pre-link-power artifact schema must fail closed',
  );
  assert.equal(
    parseHomepageFirstFrameArtifact(artifact, {
      requestedInstantUtc: '2026-08-12T12:00:00.000Z',
      appliedInstantUtc: '2026-08-12T12:00:00.000Z',
      catalog: { ...starlinkCatalog, archiveId: `${starlinkCatalog.archiveId}-stale` },
      parameters: DEFAULT_SIMULATOR_PARAMETERS,
    }),
    null,
    'artifact must fail closed when the archive identity changes',
  );
  assert.equal(
    parseHomepageFirstFrameArtifact(artifact, {
      requestedInstantUtc: '2026-08-12T12:00:00.000Z',
      appliedInstantUtc: '2026-08-12T12:00:00.000Z',
      catalog: starlinkCatalog,
      parameters: DEFAULT_SIMULATOR_PARAMETERS,
      frameOptions: { representativeUserIndex: 1 },
    }),
    null,
    'artifact must fail closed when scenario options change',
  );

  console.log('Homepage first-frame cache is key-bound, SGP4-proven, and session-reload safe.');
} finally {
  clearHomepageFirstFrameCacheForTests();
  if (previousSessionStorage === undefined) {
    delete (globalThis as { sessionStorage?: Storage }).sessionStorage;
  } else {
    Object.defineProperty(globalThis, 'sessionStorage', previousSessionStorage);
  }
}
