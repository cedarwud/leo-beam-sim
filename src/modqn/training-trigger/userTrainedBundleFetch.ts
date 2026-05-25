/**
 * Consumer-side counterpart to backend SDD §6.4
 * `GET /artifacts/<id>/<filename>` static serving.
 *
 * This composes the MODQN runtime bundle fetcher in `runtime-fetch.ts` with
 * the training-trigger service URL builder in `serviceClient.artifactUrl`.
 * It is intentionally thin: envelope assembly and parsing remain owned by
 * `runtime-fetch.ts` and `replay-state.ts`.
 *
 * Per Phase D training visualization mini-SDD §6 and §10.1.
 */
import {
  fetchModqnReplayBundleEnvelope,
  type ModqnRuntimeBundleFetchResult,
} from '../replay-bundle/runtime-fetch';
import { artifactUrl } from './serviceClient';
import type { ServiceClientConfig } from './types';

export interface FetchUserTrainedBundleParams {
  readonly config: ServiceClientConfig;
  readonly jobId: string;
  readonly fetchImpl?: typeof fetch;
  readonly clock?: () => number;
}

export async function fetchUserTrainedBundleEnvelope(
  params: FetchUserTrainedBundleParams,
): Promise<ModqnRuntimeBundleFetchResult> {
  const fetchUrlBase = artifactUrl(params.config, params.jobId, '').replace(/\/$/, '');

  return fetchModqnReplayBundleEnvelope({
    sourcePath: `user-trained:${params.jobId}`,
    sourceOwner: 'modqn-paper-reproduction',
    fetchUrlBase,
    fetchImpl: params.fetchImpl,
    clock: params.clock,
  });
}
