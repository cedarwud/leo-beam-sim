import {
  loadVisualLabGlobalConstellationArtifact,
  VISUAL_LAB_GLOBAL_CONSTELLATION_ARTIFACT_URLS,
  type LoadVisualLabGlobalConstellationArtifactOptions,
  type VisualLabGlobalConstellationArtifact,
  type VisualLabGlobalConstellationArtifactFetcher,
} from './visualLabGlobalConstellationArtifact';
import type { SimulatorConstellation } from '../../simulator/types';

/**
 * Lifecycle exposed to the visual shell for one precomputed global frame.
 *
 * `ready` is always backed by a validated archived-TLE/SGP4 artifact.  The
 * store never substitutes an artifact from another constellation or creates
 * a synthetic frame when the request fails.
 */
export type VisualLabGlobalConstellationFirstFrameState =
  | Readonly<{
      readonly status: 'idle';
      readonly constellation: SimulatorConstellation;
      readonly artifact: null;
    }>
  | Readonly<{
      readonly status: 'loading';
      readonly constellation: SimulatorConstellation;
      readonly artifact: null;
    }>
  | Readonly<{
      readonly status: 'ready';
      readonly constellation: SimulatorConstellation;
      readonly artifact: VisualLabGlobalConstellationArtifact;
      /** True when this result was served from a validated in-memory cache. */
      readonly cacheHit: boolean;
    }>
  | Readonly<{
      readonly status: 'error';
      readonly constellation: SimulatorConstellation;
      readonly artifact: null;
      readonly error: string;
    }>;

export type VisualLabGlobalConstellationFirstFrameListener = (
  state: VisualLabGlobalConstellationFirstFrameState,
) => void;

export interface VisualLabGlobalConstellationStoreOptions {
  readonly fetcher?: VisualLabGlobalConstellationArtifactFetcher;
  readonly artifactUrls?: Readonly<Record<SimulatorConstellation, string>>;
  /** Optional already validated real artifacts for SSR/test warm starts. */
  readonly initialArtifacts?: Partial<Record<SimulatorConstellation, VisualLabGlobalConstellationArtifact>>;
}

export interface LoadVisualLabGlobalConstellationFirstFrameOptions {
  readonly forceReload?: boolean;
  readonly signal?: AbortSignal;
}

function constellationState(
  constellation: SimulatorConstellation,
): VisualLabGlobalConstellationFirstFrameState {
  return Object.freeze({ status: 'idle', constellation, artifact: null });
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== '') return error.message;
  return String(error);
}

/**
 * Cache-backed resource for the compact global first-frame artifacts.
 *
 * This is intentionally separate from the expensive timeline/session build:
 * the first global render only fetches and validates a published JSON
 * artifact.  Concurrent requests for the same constellation share one
 * promise, and later calls are synchronous from the cache through `peek`.
 */
export class VisualLabGlobalConstellationStore {
  private readonly fetcher: VisualLabGlobalConstellationArtifactFetcher | undefined;
  private readonly artifactUrls: Readonly<Record<SimulatorConstellation, string>>;
  private readonly artifacts = new Map<SimulatorConstellation, VisualLabGlobalConstellationArtifact>();
  private readonly states = new Map<SimulatorConstellation, VisualLabGlobalConstellationFirstFrameState>();
  private readonly inFlight = new Map<SimulatorConstellation, Promise<VisualLabGlobalConstellationFirstFrameState>>();
  private readonly listeners = new Set<VisualLabGlobalConstellationFirstFrameListener>();

  public constructor(options: VisualLabGlobalConstellationStoreOptions = {}) {
    this.fetcher = options.fetcher;
    this.artifactUrls = options.artifactUrls ?? VISUAL_LAB_GLOBAL_CONSTELLATION_ARTIFACT_URLS;
    for (const constellation of ['oneweb', 'starlink'] as const) {
      const initial = options.initialArtifacts?.[constellation];
      if (initial !== undefined) {
        if (initial.constellation !== constellation) {
          throw new Error(`initial global artifact constellation mismatch: expected ${constellation}`);
        }
        this.artifacts.set(constellation, initial);
        this.states.set(constellation, Object.freeze({
          status: 'ready',
          constellation,
          artifact: initial,
          cacheHit: true,
        }));
      } else {
        this.states.set(constellation, constellationState(constellation));
      }
    }
  }

  /** Return the validated artifact synchronously, or null before a load. */
  public peek(constellation: SimulatorConstellation): VisualLabGlobalConstellationArtifact | null {
    return this.artifacts.get(constellation) ?? null;
  }

  /** Return the current lifecycle state without starting a request. */
  public state(constellation: SimulatorConstellation): VisualLabGlobalConstellationFirstFrameState {
    return this.states.get(constellation) ?? constellationState(constellation);
  }

  /** Subscribe to state changes for useSyncExternalStore or a local hook. */
  public subscribe(listener: VisualLabGlobalConstellationFirstFrameListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Load one constellation's precomputed first frame.  A cached artifact is
   * returned without network I/O unless `forceReload` is requested.  Errors
   * resolve as an explicit `error` state; no stale or synthetic replacement
   * is returned.
   */
  public load(
    constellation: SimulatorConstellation,
    options: LoadVisualLabGlobalConstellationFirstFrameOptions = {},
  ): Promise<VisualLabGlobalConstellationFirstFrameState> {
    const cached = this.artifacts.get(constellation);
    if (!options.forceReload && cached !== undefined) {
      const ready = Object.freeze({
        status: 'ready' as const,
        constellation,
        artifact: cached,
        cacheHit: true,
      });
      this.publish(ready);
      return Promise.resolve(ready);
    }

    const running = this.inFlight.get(constellation);
    if (running !== undefined) return running;

    this.publish(Object.freeze({ status: 'loading' as const, constellation, artifact: null }));
    const request = loadVisualLabGlobalConstellationArtifact(
      this.artifactUrls[constellation],
      {
        fetcher: this.fetcher,
        expectedConstellation: constellation,
        signal: options.signal,
      } satisfies LoadVisualLabGlobalConstellationArtifactOptions,
    ).then((artifact) => {
      this.artifacts.set(constellation, artifact);
      const ready = Object.freeze({
        status: 'ready' as const,
        constellation,
        artifact,
        cacheHit: false,
      });
      this.publish(ready);
      return ready;
    }).catch((error: unknown) => {
      const failed = Object.freeze({
        status: 'error' as const,
        constellation,
        artifact: null,
        error: errorMessage(error),
      });
      this.publish(failed);
      return failed;
    }).finally(() => {
      this.inFlight.delete(constellation);
    });
    this.inFlight.set(constellation, request);
    return request;
  }

  /** Drop one validated cache entry; the next load will fetch it again. */
  public invalidate(constellation: SimulatorConstellation): void {
    this.artifacts.delete(constellation);
    this.publish(constellationState(constellation));
  }

  private publish(state: VisualLabGlobalConstellationFirstFrameState): void {
    this.states.set(state.constellation, state);
    for (const listener of this.listeners) listener(state);
  }
}

export function createVisualLabGlobalConstellationStore(
  options: VisualLabGlobalConstellationStoreOptions = {},
): VisualLabGlobalConstellationStore {
  return new VisualLabGlobalConstellationStore(options);
}

/** One shared browser resource; it never contains mock or generated data. */
export const visualLabGlobalConstellationStore = new VisualLabGlobalConstellationStore();

