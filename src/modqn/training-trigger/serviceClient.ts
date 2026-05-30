import type {
  LeoProducerDispatchEnvelope,
  ServiceAvailability,
  ServiceClientConfig,
  SensitivitySweepRequest,
  SensitivitySweepResponse,
  BatchDetail,
  JobLifecycleActionResponse,
  PostTrainResponse,
  TrainingJobDetail,
  TrainingJobSummary,
  TrainingRequest,
  JobStatus,
} from './types';

const DEFAULT_PROBE_TIMEOUT_MS = 1500;

function normalizedBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/$/, '');
}

export const LEO_PRODUCER_DISPATCH_SCHEMA = 'leo-modqn-producer-dispatch-request-v1' as const;
export const LEO_RUN_CONFIG_SCHEMA = 'leo-modqn-training-run-config-v1' as const;

let dispatchSequence = 0;

function nextDispatchJobId(createdAtMs: number): string {
  dispatchSequence = (dispatchSequence + 1) % 100000;
  return `leo-dispatch-${createdAtMs}-${dispatchSequence}`;
}

interface BuildDispatchEnvelopeOptions {
  readonly createdAtMs?: number;
  readonly clientJobId?: string;
}

export function buildProducerDispatchEnvelope(
  config: ServiceClientConfig,
  request: TrainingRequest,
  options: BuildDispatchEnvelopeOptions = {},
): LeoProducerDispatchEnvelope {
  const createdAtMs = options.createdAtMs ?? Date.now();
  const producerServiceBaseUrl = normalizedBaseUrl(config.baseUrl);
  return {
    schema: LEO_PRODUCER_DISPATCH_SCHEMA,
    producerTruthOwner: 'modqn-paper-reproduction',
    consumerOwner: 'leo-beam-sim',
    requestedBy: 'leo-beam-sim-training-orchestrator',
    ntnSimCoreRuntimeDependency: false,
    runConfig: {
      schema: LEO_RUN_CONFIG_SCHEMA,
      jobId: options.clientJobId ?? nextDispatchJobId(createdAtMs),
      createdAtMs,
      producerTruthOwner: 'modqn-paper-reproduction',
      orchestrator: {
        owner: 'leo-beam-sim',
        role: 'job-orchestration-only',
        producerServiceBaseUrl,
        ntnSimCoreRuntimeDependency: false,
      },
      request,
    },
  };
}

function encodeArtifactPath(filename: string): string {
  return filename
    .split('/')
    .filter(segment => segment.length > 0)
    .map(segment => encodeURIComponent(segment))
    .join('/');
}

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export async function probeService(config: ServiceClientConfig): Promise<ServiceAvailability> {
  const timeoutMs = config.probeTimeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS;
  const controller = new AbortController();
  const startedAt = nowMs();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${normalizedBaseUrl(config.baseUrl)}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    const latencyMs = nowMs() - startedAt;
    if (!response.ok) {
      return { reachable: false, latencyMs, error: `HTTP ${response.status}` };
    }
    let version: string | undefined;
    try {
      const body: unknown = await response.json();
      if (body && typeof body === 'object' && typeof (body as Record<string, unknown>).version === 'string') {
        version = (body as Record<string, unknown>).version as string;
      }
    } catch {
      // body is optional; reachable is still true
    }
    return { reachable: true, latencyMs, version };
  } catch (error) {
    const latencyMs = nowMs() - startedAt;
    const isAbort = typeof DOMException !== 'undefined'
      && error instanceof DOMException
      && error.name === 'AbortError';
    const message = isAbort
      ? `probe timed out after ${timeoutMs}ms`
      : (error instanceof Error ? error.message : String(error));
    return { reachable: false, latencyMs, error: message };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

export async function postTrain(
  config: ServiceClientConfig,
  request: TrainingRequest,
): Promise<PostTrainResponse> {
  const envelope = buildProducerDispatchEnvelope(config, request);
  const response = await fetch(`${normalizedBaseUrl(config.baseUrl)}/train`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(envelope),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`postTrain: HTTP ${response.status}${text ? `: ${text}` : ''}`);
  }
  return response.json();
}

export async function getJobs(
  config: ServiceClientConfig,
  filter?: { status?: JobStatus; limit?: number },
): Promise<{ jobs: TrainingJobSummary[] }> {
  const url = new URL(`${normalizedBaseUrl(config.baseUrl)}/jobs`);
  if (filter?.status) url.searchParams.set('status', filter.status);
  if (typeof filter?.limit === 'number') url.searchParams.set('limit', String(filter.limit));
  const response = await fetch(url.toString(), { method: 'GET' });
  if (!response.ok) throw new Error(`getJobs: HTTP ${response.status}`);
  return response.json();
}

export async function getJobDetail(
  config: ServiceClientConfig,
  jobId: string,
): Promise<TrainingJobDetail> {
  const response = await fetch(`${normalizedBaseUrl(config.baseUrl)}/jobs/${encodeURIComponent(jobId)}`, {
    method: 'GET',
  });
  if (!response.ok) throw new Error(`getJobDetail: HTTP ${response.status}`);
  return response.json();
}

export async function postSensitivitySweep(
  config: ServiceClientConfig,
  request: SensitivitySweepRequest,
  idempotencyKey?: string,
): Promise<SensitivitySweepResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const response = await fetch(`${normalizedBaseUrl(config.baseUrl)}/sensitivity-sweep`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`postSensitivitySweep: HTTP ${response.status}${text ? `: ${text}` : ''}`);
  }
  return response.json();
}

export async function getBatch(
  config: ServiceClientConfig,
  batchId: string,
): Promise<BatchDetail> {
  const response = await fetch(`${normalizedBaseUrl(config.baseUrl)}/batches/${encodeURIComponent(batchId)}`, {
    method: 'GET',
  });
  if (!response.ok) throw new Error(`getBatch: HTTP ${response.status}`);
  return response.json();
}

export function jobStreamUrl(
  config: ServiceClientConfig,
  jobId: string,
): string {
  return `${normalizedBaseUrl(config.baseUrl)}/jobs/${encodeURIComponent(jobId)}/stream`;
}

export function artifactUrl(
  config: ServiceClientConfig,
  jobId: string,
  filename: string,
): string {
  const encodedPath = encodeArtifactPath(filename);
  const suffix = encodedPath.length > 0 ? `/${encodedPath}` : '';
  return `${normalizedBaseUrl(config.baseUrl)}/artifacts/${encodeURIComponent(jobId)}${suffix}`;
}

async function postJobLifecycleAction(
  config: ServiceClientConfig,
  jobId: string,
  action: 'pause' | 'resume' | 'cancel',
): Promise<JobLifecycleActionResponse> {
  const actionLabel = action === 'pause' ? 'Pause' : action === 'resume' ? 'Resume' : 'Cancel';
  const response = await fetch(`${normalizedBaseUrl(config.baseUrl)}/jobs/${encodeURIComponent(jobId)}/${action}`, {
    method: 'POST',
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`post${actionLabel}Job: HTTP ${response.status}${text ? `: ${text}` : ''}`);
  }
  return response.json();
}

export async function postPauseJob(
  config: ServiceClientConfig,
  jobId: string,
): Promise<JobLifecycleActionResponse> {
  return postJobLifecycleAction(config, jobId, 'pause');
}

export async function postResumeJob(
  config: ServiceClientConfig,
  jobId: string,
): Promise<JobLifecycleActionResponse> {
  return postJobLifecycleAction(config, jobId, 'resume');
}

export async function postCancelJob(
  config: ServiceClientConfig,
  jobId: string,
): Promise<{ jobId: string; status: 'cancelled'; message: string }> {
  return postJobLifecycleAction(
    config,
    jobId,
    'cancel',
  ) as Promise<{ jobId: string; status: 'cancelled'; message: string }>;
}

export async function deleteJob(
  config: ServiceClientConfig,
  jobId: string,
): Promise<{ jobId: string; status?: 'deleted'; message: string }> {
  const response = await fetch(`${normalizedBaseUrl(config.baseUrl)}/jobs/${encodeURIComponent(jobId)}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`deleteJob: HTTP ${response.status}`);
  }
  return response.json();
}
