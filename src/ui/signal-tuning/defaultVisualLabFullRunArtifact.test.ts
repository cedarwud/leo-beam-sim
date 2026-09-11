import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  DEFAULT_SIMULATOR_PARAMETERS,
  SIMULATOR_CATALOG_URLS,
} from '../../simulator/types';
import { loadTleWebArchiveCatalog } from '../../simulator/archive';
import { LATEST_TLE_REFERENCE_INSTANT_UTC } from '../../tle/latestTleDefaults';
import {
  VISUAL_LAB_DEFAULT_FULL_RUN_ARTIFACT_URL,
  loadVisualLabDefaultFullRunArtifact,
} from './defaultVisualLabFullRunArtifact';

const previousFetch = globalThis.fetch;

function publicFetch(input: RequestInfo | URL): Promise<Response> {
  const raw = String(input);
  const relative = raw.startsWith('/') ? raw : new URL(raw).pathname;
  return readFile(`public${relative}`).then(bytes => new Response(bytes, { status: 200 }));
}

globalThis.fetch = publicFetch as typeof fetch;

try {
  const catalog = await loadTleWebArchiveCatalog(SIMULATOR_CATALOG_URLS.starlink, publicFetch);
  const expectation = {
    requestedInstantUtc: LATEST_TLE_REFERENCE_INSTANT_UTC,
    appliedInstantUtc: LATEST_TLE_REFERENCE_INSTANT_UTC,
    catalog,
    parameters: DEFAULT_SIMULATOR_PARAMETERS,
    frameOptions: { userPositionOverridesKm: [] },
  } as const;

  const run = await loadVisualLabDefaultFullRunArtifact(expectation);
  assert.notEqual(run, null, 'the checked-in default artifact must hydrate');
  if (run === null) throw new Error('expected a complete default run');
  assert.equal(run.anchorCount, 241);
  assert.equal(run.stepS, 30);
  assert.equal(run.geometryRun.satelliteCount, 5033);
  assert.equal(run.anchorSelections.length, 241);
  assert.equal(run.handoverTrace.anchors.length, 241);
  assert.equal(run.getFrame(0)?.provenance.sourceKind, 'ARCHIVED_TLE');
  assert.equal(run.getFrame(240)?.runAnchor?.anchorIndex, 240);
  assert.equal(run.getFrame(0)?.tleState.propagationFrame.satellites.length, 5033);

  assert.equal(
    await loadVisualLabDefaultFullRunArtifact({
      ...expectation,
      parameters: {
        ...DEFAULT_SIMULATOR_PARAMETERS,
        beamPowerCapW: DEFAULT_SIMULATOR_PARAMETERS.beamPowerCapW + 1,
      },
    }),
    null,
    'a parameter identity mismatch must fail closed before accepting the artifact',
  );
  assert.equal(
    await loadVisualLabDefaultFullRunArtifact({
      ...expectation,
      catalog: { ...catalog, archiveId: `${catalog.archiveId}-stale` },
    }),
    null,
    'a catalog identity mismatch must fail closed',
  );

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await originalFetch(input, init);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (String(input).endsWith('/geometry.bin')) bytes[0] ^= 0xff;
    return new Response(bytes, { status: 200 });
  }) as typeof fetch;
  assert.equal(
    await loadVisualLabDefaultFullRunArtifact(expectation),
    null,
    'a geometry content digest mismatch must fail closed',
  );

  console.log(`visual-lab default full-run artifact passed: ${VISUAL_LAB_DEFAULT_FULL_RUN_ARTIFACT_URL}`);
} finally {
  globalThis.fetch = previousFetch;
}
