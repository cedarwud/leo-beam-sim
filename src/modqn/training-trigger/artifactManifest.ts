import { artifactUrl } from './serviceClient';
import type { ServiceClientConfig } from './types';

export interface UserTrainedManifestSummary {
  readonly jobId: string;
  readonly userTrained: boolean;
  readonly paperFaithful: boolean;
  readonly trainerSubcommand?: string;
  readonly submittedAtMs?: number;
  readonly serviceVersion?: string;
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
  const userTrained = raw.userTrained === true;
  const paperFaithful = raw.paperFaithful !== false;
  const metadata = isRecord(raw.userTrainingMetadata) ? raw.userTrainingMetadata : undefined;
  return {
    jobId,
    userTrained,
    paperFaithful,
    trainerSubcommand: typeof metadata?.trainerSubcommand === 'string' ? metadata.trainerSubcommand : undefined,
    submittedAtMs: typeof metadata?.submittedAtMs === 'number' ? metadata.submittedAtMs : undefined,
    serviceVersion: typeof metadata?.serviceVersion === 'string' ? metadata.serviceVersion : undefined,
    raw,
  };
}
