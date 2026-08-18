import {
  loadTleSnapshotSelection,
  loadTleWebArchiveCatalog,
} from '../../simulator/archive';
import {
  buildTleAnalysisRun,
  type TleAnalysisRun,
  type TleAnalysisRunBuildInput,
} from '../../simulator/tleAnalysisRun';
import type { LoadedTleSnapshotSelection, TleWebArchiveCatalog } from '../../simulator/types';
import {
  buildTleRunBundle,
  type TleRunBuildInput,
  type TleRunBundle,
  type TleRunProgress,
} from '../../tle/run';
import {
  ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST,
  resolveScientificStoryEvidence,
  type ScientificFixtureManifest,
  type ScientificStoryEvidence,
  type ScientificStoryEvidenceResult,
} from '../model';

export type ScientificExplanationLoadPhase =
  | 'catalog'
  | 'snapshot'
  | 'geometry'
  | 'analysis'
  | 'verification';

export interface ScientificExplanationPendingState {
  readonly status: 'pending';
  readonly phase: ScientificExplanationLoadPhase;
  readonly progress: TleRunProgress | null;
}

export interface ScientificExplanationAvailableState {
  readonly status: 'available';
  readonly evidence: ScientificStoryEvidence;
  readonly source: ScientificFixtureManifest['source'];
}

export interface ScientificExplanationRefusedState {
  readonly status: 'refused';
  readonly reason: string;
  readonly recovery: string;
}

export type ScientificExplanationRouteState =
  | ScientificExplanationPendingState
  | ScientificExplanationAvailableState
  | ScientificExplanationRefusedState;

export interface ScientificExplanationPipeline {
  readonly loadCatalog: (url: string) => Promise<TleWebArchiveCatalog>;
  readonly loadSelection: (
    catalog: TleWebArchiveCatalog,
    requestedInstantUtc: string,
  ) => Promise<LoadedTleSnapshotSelection>;
  readonly buildGeometryRun: (input: TleRunBuildInput) => Promise<TleRunBundle>;
  readonly buildAnalysisRun: (input: TleAnalysisRunBuildInput) => TleAnalysisRun;
  readonly resolveEvidence: (input: {
    readonly manifest: ScientificFixtureManifest;
    readonly referenceRun: TleAnalysisRun;
    readonly angleProbeRun: TleAnalysisRun | null;
    readonly serviceTargetProbeRun: TleAnalysisRun | null;
  }) => ScientificStoryEvidenceResult;
}

export interface LoadScientificExplanationRunOptions {
  readonly signal?: AbortSignal;
  readonly onPending?: (state: ScientificExplanationPendingState) => void;
  readonly manifest?: ScientificFixtureManifest;
  readonly pipeline?: ScientificExplanationPipeline;
}

const DEFAULT_PIPELINE: ScientificExplanationPipeline = Object.freeze({
  loadCatalog: loadTleWebArchiveCatalog,
  loadSelection: loadTleSnapshotSelection,
  buildGeometryRun: buildTleRunBundle,
  buildAnalysisRun: buildTleAnalysisRun,
  resolveEvidence: resolveScientificStoryEvidence,
});

function pending(
  phase: ScientificExplanationLoadPhase,
  progress: TleRunProgress | null = null,
): ScientificExplanationPendingState {
  return Object.freeze({ status: 'pending', phase, progress });
}

function assertSourceIdentity(
  manifest: ScientificFixtureManifest,
  catalog: TleWebArchiveCatalog,
  selection: LoadedTleSnapshotSelection,
  geometryRun: TleRunBundle,
): void {
  const source = manifest.source;
  if (catalog.constellation !== source.constellation || catalog.archiveId !== source.archiveId) {
    throw new Error('accepted TLE catalog identity does not match the frozen scientific fixture');
  }
  if (catalog.archiveContentSha256 !== source.archiveContentSha256) {
    throw new Error('accepted TLE catalog digest does not match the frozen scientific fixture');
  }
  if (
    selection.snapshot.metadata.path !== source.snapshotPath
    || selection.snapshot.metadata.archiveDate !== source.archiveDate
    || selection.snapshot.sha256 !== source.selectedTleSha256
  ) {
    throw new Error('accepted TLE snapshot identity does not match the frozen scientific fixture');
  }
  if (geometryRun.runId !== source.geometryRunId) {
    throw new Error('completed TLE geometry run identity does not match the frozen scientific fixture');
  }
}

export async function loadScientificExplanationRun(
  options: LoadScientificExplanationRunOptions = {},
): Promise<ScientificExplanationAvailableState> {
  const manifest = options.manifest ?? ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST;
  const pipeline = options.pipeline ?? DEFAULT_PIPELINE;
  const catalogUrl = `/tle-archive/${manifest.source.constellation}/catalog.json`;

  options.onPending?.(pending('catalog'));
  const catalog = await pipeline.loadCatalog(catalogUrl);

  options.onPending?.(pending('snapshot'));
  const selection = await pipeline.loadSelection(catalog, manifest.source.requestedInstantUtc);

  options.onPending?.(pending('geometry'));
  const geometryRun = await pipeline.buildGeometryRun({
    selection,
    t0Utc: manifest.source.requestedInstantUtc,
    signal: options.signal,
    onProgress: progress => options.onPending?.(pending('geometry', progress)),
  });
  assertSourceIdentity(manifest, catalog, selection, geometryRun);

  options.onPending?.(pending('analysis'));
  const referenceRun = pipeline.buildAnalysisRun({
    selection,
    geometryRun,
    parameters: manifest.referenceParameters,
  });
  const angleProbeRun = referenceRun.withParameters(Object.freeze({
    ...manifest.referenceParameters,
    [manifest.fixtures.angleResponse.control.parameterKey]: manifest.fixtures.angleResponse.control.probeValue,
  }));
  const serviceTargetProbeRun = referenceRun.withParameters(Object.freeze({
    ...manifest.referenceParameters,
    [manifest.fixtures.serviceTargetStress.control.parameterKey]: manifest.fixtures.serviceTargetStress.control.probeValue,
  }));

  options.onPending?.(pending('verification'));
  const resolved = pipeline.resolveEvidence({
    manifest,
    referenceRun,
    angleProbeRun,
    serviceTargetProbeRun,
  });
  if (resolved.status === 'unavailable') {
    throw new Error(`${resolved.fixtureId}: ${resolved.reason}. ${resolved.recovery}`);
  }

  return Object.freeze({
    status: 'available',
    evidence: resolved.evidence,
    source: manifest.source,
  });
}

export function scientificExplanationRefusal(error: unknown): ScientificExplanationRefusedState {
  const reason = error instanceof Error ? error.message : String(error);
  return Object.freeze({
    status: 'refused',
    reason,
    recovery: '重新載入同一筆已凍結的軌道來源；若仍失敗，保留拒絕狀態並檢查來源檔案。',
  });
}
