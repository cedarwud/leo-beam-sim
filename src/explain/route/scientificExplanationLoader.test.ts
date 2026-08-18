import assert from 'node:assert/strict';

import type { TleRunProgress } from '../../tle/run';
import { ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST } from '../model';
import {
  loadScientificExplanationRun,
  scientificExplanationRefusal,
  type ScientificExplanationLoadPhase,
  type ScientificExplanationPipeline,
} from './scientificExplanationLoader';

const manifest = ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST;
const phases: ScientificExplanationLoadPhase[] = [];
const probeParameters: unknown[] = [];
const progress: TleRunProgress = Object.freeze({
  status: 'running',
  completedAnchors: 17,
  totalAnchors: 241,
  anchorIndex: 16,
  anchorUtc: manifest.source.requestedInstantUtc,
  fraction: 17 / 241,
  progress: 17 / 241,
});

const catalog = {
  constellation: manifest.source.constellation,
  archiveId: manifest.source.archiveId,
  archiveContentSha256: manifest.source.archiveContentSha256,
} as Awaited<ReturnType<ScientificExplanationPipeline['loadCatalog']>>;
const selection = {
  catalog,
  snapshot: {
    metadata: {
      path: manifest.source.snapshotPath,
      archiveDate: manifest.source.archiveDate,
    },
    sha256: manifest.source.selectedTleSha256,
  },
} as Awaited<ReturnType<ScientificExplanationPipeline['loadSelection']>>;
const geometryRun = {
  runId: manifest.source.geometryRunId,
} as Awaited<ReturnType<ScientificExplanationPipeline['buildGeometryRun']>>;
const referenceRun = {
  parameters: manifest.referenceParameters,
  withParameters(parameters: unknown) {
    probeParameters.push(parameters);
    return { ...referenceRun, parameters };
  },
} as ReturnType<ScientificExplanationPipeline['buildAnalysisRun']>;
const acceptedEvidence = { methodState: { anchorIndex: manifest.fixtures.method.anchorIndex } } as unknown as
  Extract<ReturnType<ScientificExplanationPipeline['resolveEvidence']>, { readonly status: 'available' }>['evidence'];

const pipeline: ScientificExplanationPipeline = {
  async loadCatalog(url) {
    assert.equal(url, '/tle-archive/oneweb/catalog.json');
    return catalog;
  },
  async loadSelection(receivedCatalog, requestedInstantUtc) {
    assert.equal(receivedCatalog, catalog);
    assert.equal(requestedInstantUtc, manifest.source.requestedInstantUtc);
    return selection;
  },
  async buildGeometryRun(input) {
    assert.equal(input.selection, selection);
    assert.equal(input.t0Utc, manifest.source.requestedInstantUtc);
    await input.onProgress?.(progress);
    return geometryRun;
  },
  buildAnalysisRun(input) {
    assert.equal(input.geometryRun, geometryRun);
    assert.deepEqual(input.parameters, manifest.referenceParameters);
    return referenceRun;
  },
  resolveEvidence(input) {
    assert.equal(input.referenceRun, referenceRun);
    assert.notEqual(input.angleProbeRun, null);
    assert.notEqual(input.serviceTargetProbeRun, null);
    return { status: 'available', evidence: acceptedEvidence };
  },
};

const loaded = await loadScientificExplanationRun({
  manifest,
  pipeline,
  onPending: state => phases.push(state.phase),
});
assert.equal(loaded.status, 'available');
assert.equal(loaded.evidence, acceptedEvidence);
assert.deepEqual(phases, ['catalog', 'snapshot', 'geometry', 'geometry', 'analysis', 'verification']);
assert.equal(probeParameters.length, 2);
assert.equal((probeParameters[0] as Record<string, number>).theta3dbRad, manifest.fixtures.angleResponse.control.probeValue);
assert.equal((probeParameters[1] as Record<string, number>).minimumRateBps, manifest.fixtures.serviceTargetStress.control.probeValue);

await assert.rejects(
  loadScientificExplanationRun({
    manifest,
    pipeline: { ...pipeline, loadCatalog: async () => { throw new Error('catalog unavailable'); } },
  }),
  /catalog unavailable/,
);
assert.deepEqual(scientificExplanationRefusal(new Error('catalog unavailable')), {
  status: 'refused',
  reason: 'catalog unavailable',
  recovery: '重新載入同一筆已凍結的軌道來源；若仍失敗，保留拒絕狀態並檢查來源檔案。',
});

console.log('Scientific explanation route loader tests passed');
