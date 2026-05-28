import { artifactUrl } from './serviceClient';
import type {
  ServiceClientConfig,
  TrainingRunMetadata,
  TrainingServiceManifest,
} from './types';

export interface UserTrainedManifestSummary {
  readonly jobId: string;
  readonly userTrained: boolean;
  readonly paperFaithful: boolean;
  readonly trainerSubcommand?: string;
  readonly submittedAtMs?: number;
  readonly serviceVersion?: string;
  readonly trainingServiceManifest?: TrainingServiceManifest;
  readonly replayBundlePresent?: boolean;
  readonly raw: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function fetchArtifactManifest(
  config: ServiceClientConfig,
  jobId: string,
): Promise<UserTrainedManifestSummary> {
  const url = artifactUrl(config, jobId, 'manifest.json');
  const response = await fetch(url, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`fetchArtifactManifest: HTTP ${response.status}`);
  }
  const raw = await response.json();
  if (!isRecord(raw)) {
    throw new Error('fetchArtifactManifest: manifest is not an object');
  }
  const serviceManifest = parseTrainingServiceManifest(raw);
  const userTrained = serviceManifest?.artifactTag === 'user-trained' || raw.userTrained === true;
  const paperFaithful = serviceManifest !== undefined ? false : raw.paperFaithful !== false;
  const metadata = isRecord(raw.userTrainingMetadata) ? raw.userTrainingMetadata : undefined;
  return {
    jobId,
    userTrained,
    paperFaithful,
    trainerSubcommand: serviceManifest?.trainerSubcommand
      ?? (typeof metadata?.trainerSubcommand === 'string' ? metadata.trainerSubcommand : undefined),
    submittedAtMs: typeof metadata?.submittedAtMs === 'number' ? metadata.submittedAtMs : undefined,
    serviceVersion: serviceManifest?.serviceVersion
      ?? (typeof metadata?.serviceVersion === 'string' ? metadata.serviceVersion : undefined),
    trainingServiceManifest: serviceManifest,
    replayBundlePresent: serviceManifest?.replayBundle?.present,
    raw,
  };
}

export async function fetchTrainingServiceManifest(
  config: ServiceClientConfig,
  jobId: string,
): Promise<TrainingServiceManifest> {
  const summary = await fetchArtifactManifest(config, jobId);
  if (summary.trainingServiceManifest === undefined) {
    throw new Error('fetchTrainingServiceManifest: artifact is not a training-service manifest');
  }
  return summary.trainingServiceManifest;
}

export async function fetchTrainingRunMetadata(
  config: ServiceClientConfig,
  manifest: TrainingServiceManifest,
): Promise<TrainingRunMetadata> {
  const runMetadataPath = manifest.rawRun?.runMetadataPath ?? 'raw-run/run_metadata.json';
  const response = await fetch(artifactUrl(config, manifest.jobId, runMetadataPath), {
    method: 'GET',
  });
  if (!response.ok) {
    throw new Error(`fetchTrainingRunMetadata: HTTP ${response.status}`);
  }
  const raw = await response.json();
  if (!isRecord(raw)) {
    throw new Error('fetchTrainingRunMetadata: run_metadata.json is not an object');
  }
  return raw as TrainingRunMetadata;
}

function parseTrainingServiceManifest(raw: Record<string, unknown>): TrainingServiceManifest | undefined {
  if (
    raw.schema !== 'modqn-training-service-artifact-manifest-v1'
    || raw.artifactTag !== 'user-trained'
    || raw.paperFaithful !== false
    || raw.effectivenessClaimAuthorized !== false
    || typeof raw.jobId !== 'string'
  ) {
    return undefined;
  }
  return {
    ...(raw as Omit<TrainingServiceManifest, 'raw'>),
    raw,
  };
}
