import {
  ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST,
  parseScientificExplanationArtifact,
  type ScientificExplanationArtifact,
  type SourceFixtureManifest,
} from '../model';

export const SCIENTIFIC_EXPLANATION_ARTIFACT_URL = '/explain/accepted-scientific-demo-v1.json' as const;

export interface ScientificExplanationArtifactPendingState {
  readonly status: 'pending';
  readonly phase: 'artifact';
}

export interface ScientificExplanationArtifactAvailableState {
  readonly status: 'available';
  readonly artifact: ScientificExplanationArtifact;
  readonly source: SourceFixtureManifest;
}

export interface ScientificExplanationArtifactRefusedState {
  readonly status: 'refused';
  readonly reason: string;
  readonly recovery: string;
}

export type ScientificExplanationArtifactRouteState =
  | ScientificExplanationArtifactPendingState
  | ScientificExplanationArtifactAvailableState
  | ScientificExplanationArtifactRefusedState;

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const requestCache = new Map<string, Promise<ScientificExplanationArtifactAvailableState>>();

export const SCIENTIFIC_EXPLANATION_ARTIFACT_INITIAL_STATE: ScientificExplanationArtifactPendingState = Object.freeze({
  status: 'pending',
  phase: 'artifact',
});

export function loadScientificExplanationArtifact(
  url = SCIENTIFIC_EXPLANATION_ARTIFACT_URL,
  fetcher: Fetcher = globalThis.fetch,
): Promise<ScientificExplanationArtifactAvailableState> {
  const cached = requestCache.get(url);
  if (cached !== undefined) return cached;
  const request = (async () => {
    const response = await fetcher(url, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`precomputed scientific artifact returned HTTP ${response.status}`);
    const artifact = parseScientificExplanationArtifact(
      await response.json(),
      ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST,
    );
    return Object.freeze({
      status: 'available' as const,
      artifact,
      source: artifact.source,
    });
  })();
  requestCache.set(url, request);
  void request.catch(() => requestCache.delete(url));
  return request;
}

export function preloadScientificExplanationArtifact(): void {
  if (typeof window !== 'undefined') void loadScientificExplanationArtifact().catch(() => undefined);
}

export function scientificExplanationArtifactRefusal(error: unknown): ScientificExplanationArtifactRefusedState {
  return Object.freeze({
    status: 'refused',
    reason: error instanceof Error ? error.message : String(error),
    recovery: '重新載入已儲存的 accepted artifact；若仍失敗，請離線重建並核對該檔案。',
  });
}

export function clearScientificExplanationArtifactRequestCacheForTest(): void {
  requestCache.clear();
}
