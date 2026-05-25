// MODQN ω-Handover S2 — runtime bundle fetch helper.
//
// Owns:
//   * Mapping the producer artifact's fs absolute path
//     (SELECTED_MODQN_PHASE7C_REPLAY_BUNDLE_PATH) into the dev-server URL
//     route `/modqn-bundles/<basename>/...` served by the vite plugin in
//     vite.config.ts.
//   * Browser-side fetch of the three required surfaces (manifest,
//     provenance map, timeline JSONL) plus the optional evaluation summary.
//   * Parse + envelope assembly through the existing loader.ts /
//     replay-state.ts pipeline. We DO NOT vendor a second parser.
//
// Boundary notes:
//   * Bundle bytes are immutable per CLAUDE.md §3 + SDD §4.1.6. This helper
//     only fetches + parses + wraps; it never edits.
//   * Fetch failure throws ModqnRuntimeBundleFetchError so the caller in
//     App.tsx can surface a banner and fall back to the typed-reference
//     shell model from playback-shell.ts.
//   * The dev URL route lives at /modqn-bundles/<basename of bundle path>/
//     and is configured in vite.config.ts (modqnBundleStaticServer plugin).
//
// References: docs/modqn-omega-handover-sdd.md §9.3 (S2 acceptance), §2.1
// (replace MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL consumption), §5.1
// (component diagram).
import {
  SELECTED_MODQN_PHASE7C_REPLAY_BUNDLE_PATH,
  createModqnReplayEnvelopeFromContents,
  type ModqnReplayBundleLoadOptions,
  type ModqnReplayEnvelope,
} from './replay-state';

export const MODQN_BUNDLE_DEV_ROUTE_PREFIX = '/modqn-bundles' as const;

export interface ModqnRuntimeBundleFetchResult {
  readonly envelope: ModqnReplayEnvelope;
  readonly fetchedAtMs: number;
  readonly sourcePath: string;
  readonly fetchUrlBase: string;
}

export class ModqnRuntimeBundleFetchError extends Error {
  readonly surface: string;
  readonly status: number | null;
  readonly cause: unknown;

  constructor(
    message: string,
    options: { surface: string; status: number | null; cause?: unknown },
  ) {
    super(message);
    this.name = 'ModqnRuntimeBundleFetchError';
    this.surface = options.surface;
    this.status = options.status;
    this.cause = options.cause;
  }
}

function basenameOf(path: string): string {
  const trimmed = path.replace(/\/+$/, '');
  const slash = trimmed.lastIndexOf('/');
  return slash === -1 ? trimmed : trimmed.slice(slash + 1);
}

export function getModqnBundleDevFetchUrlBase(sourcePath: string): string {
  return `${MODQN_BUNDLE_DEV_ROUTE_PREFIX}/${basenameOf(sourcePath)}`;
}

async function fetchTextSurface(
  base: string,
  relative: string,
  fetchImpl: typeof fetch,
): Promise<string> {
  const url = `${base}/${relative}`;
  let response: Response;
  try {
    response = await fetchImpl(url);
  } catch (cause) {
    throw new ModqnRuntimeBundleFetchError(
      `MODQN runtime bundle fetch failed for ${relative}: ${(cause as Error).message ?? 'network error'}`,
      { surface: relative, status: null, cause },
    );
  }
  if (!response.ok) {
    throw new ModqnRuntimeBundleFetchError(
      `MODQN runtime bundle fetch returned HTTP ${response.status} for ${relative}`,
      { surface: relative, status: response.status },
    );
  }
  let text: string;
  try {
    text = await response.text();
  } catch (cause) {
    throw new ModqnRuntimeBundleFetchError(
      `MODQN runtime bundle response body read failed for ${relative}: ${(cause as Error).message}`,
      { surface: relative, status: response.status, cause },
    );
  }
  if (text.trim().length === 0) {
    throw new ModqnRuntimeBundleFetchError(
      `MODQN runtime bundle returned empty body for ${relative}`,
      { surface: relative, status: response.status },
    );
  }
  return text;
}

async function fetchOptionalTextSurface(
  base: string,
  relative: string,
  fetchImpl: typeof fetch,
): Promise<string | undefined> {
  try {
    const response = await fetchImpl(`${base}/${relative}`);
    if (!response.ok) return undefined;
    const text = await response.text();
    return text.trim().length === 0 ? undefined : text;
  } catch {
    // Optional surfaces are absence-honest. Producer parity with
    // createModqnReplayBundleLoadPlan's optionalSurfaces handling.
    return undefined;
  }
}

export interface FetchModqnReplayBundleOptions
  extends Omit<ModqnReplayBundleLoadOptions, 'sourcePath'> {
  readonly sourcePath?: string;
  readonly fetchImpl?: typeof fetch;
  readonly fetchUrlBase?: string;
  readonly clock?: () => number;
}

export async function fetchModqnReplayBundleEnvelope(
  options: FetchModqnReplayBundleOptions = {},
): Promise<ModqnRuntimeBundleFetchResult> {
  const sourcePath = options.sourcePath ?? SELECTED_MODQN_PHASE7C_REPLAY_BUNDLE_PATH;
  const fetchImpl = options.fetchImpl ?? fetch;
  const fetchUrlBase = options.fetchUrlBase ?? getModqnBundleDevFetchUrlBase(sourcePath);
  const clock = options.clock ?? (() => Date.now());

  const [manifestJson, provenanceMapJson, timelineJsonl] = await Promise.all([
    fetchTextSurface(fetchUrlBase, 'manifest.json', fetchImpl),
    fetchTextSurface(fetchUrlBase, 'provenance-map.json', fetchImpl),
    fetchTextSurface(fetchUrlBase, 'timeline/step-trace.jsonl', fetchImpl),
  ]);
  const evaluationSummaryJson = await fetchOptionalTextSurface(
    fetchUrlBase,
    'evaluation/summary.json',
    fetchImpl,
  );

  const envelope = createModqnReplayEnvelopeFromContents(
    {
      sourcePath,
      manifestJson,
      provenanceMapJson,
      timelineJsonl,
      evaluationSummaryJson,
    },
    {
      sourcePath,
      sourceOwner: options.sourceOwner,
      modeKey: options.modeKey,
      fixtureOnly: options.fixtureOnly,
    },
  );

  return {
    envelope,
    fetchedAtMs: clock(),
    sourcePath,
    fetchUrlBase,
  };
}
