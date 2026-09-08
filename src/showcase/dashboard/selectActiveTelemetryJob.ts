import {
  isActiveStatus,
  type LiveTelemetryEntry,
  type TrainingProgressEvent,
} from './liveTelemetryStore';

export interface LiveEpisodeProgress {
  readonly episode: number;
  readonly budget: number | null;
}

/** Plane-A terminal reward summary keys (producer emits them at completion). */
export const REWARD_METRIC_KEYS = [
  ['scalarReward', 'scalar'],
  ['r1Mean', 'r1'],
  ['r2Mean', 'r2'],
  ['r3Mean', 'r3'],
  ['totalHandovers', 'handovers'],
] as const;

export function readFiniteMetric(metrics: Record<string, number> | undefined, key: string): number | null {
  const value = metrics?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function hasAnyRewardMetric(metrics: Record<string, number> | undefined): boolean {
  return REWARD_METRIC_KEYS.some(([key]) => readFiniteMetric(metrics, key) !== null);
}

function hasFiniteEpisode(event: TrainingProgressEvent | null): boolean {
  return event !== null && typeof event.episode === 'number' && Number.isFinite(event.episode);
}

/**
 * The END-OF-RUN reward summary for the "Terminal reward scalars" tile, or
 * undefined (the tile is a source gap). Defined ONLY for a terminal job, and
 * sourced from either the terminal event's own metrics or the producer's
 * metrics-only FINAL progress line (reward metrics but NO episode). A reward on
 * an episode-bearing progress event is a per-episode sample (the evolving curve)
 * and must NOT be mislabeled as a terminal summary (codex [P2]).
 */
export function selectTerminalRewardMetrics(entry: LiveTelemetryEntry): Record<string, number> | undefined {
  // The producer's final scalar line is a metrics-only progress event (reward,
  // NO episode) emitted just BEFORE the terminal SSE while status is still
  // 'running' — surface it immediately rather than waiting for the later `done`.
  // An episode-bearing progress reward is a per-episode sample (the curve), not
  // a terminal summary, so it is excluded here regardless of status.
  const finalLine = entry.lastProgressEvent;
  if (finalLine !== null && !hasFiniteEpisode(finalLine) && hasAnyRewardMetric(finalLine.metrics)) {
    return finalLine.metrics;
  }
  // Otherwise the terminal event's own metrics, once the job is terminal.
  if (!isActiveStatus(entry.latestEvent.status) && hasAnyRewardMetric(entry.latestEvent.metrics)) {
    return entry.latestEvent.metrics;
  }
  return undefined;
}

/**
 * A terminal (completed/failed/etc.) job that still carries a reward summary
 * worth showing — keeps a just-completed run selectable (codex [P2]).
 */
function hasTerminalRewardSummary(entry: LiveTelemetryEntry): boolean {
  return selectTerminalRewardMetrics(entry) !== undefined;
}

function laterEntry(
  candidateHeartbeat: number,
  candidateJobId: string,
  bestHeartbeat: number,
  bestJobId: string | null,
): boolean {
  return candidateHeartbeat > bestHeartbeat
    || (candidateHeartbeat === bestHeartbeat && (bestJobId === null || candidateJobId < bestJobId));
}

/**
 * Pick the telemetry job the live dock should display:
 *  1) the active (queued/running/paused) job with the most recent heartbeat;
 *  2) else the most recent terminal job that still carries a reward summary,
 *     so a just-completed run keeps showing its Terminal reward scalars until a
 *     newer run supersedes it;
 *  3) else null.
 */
export function selectActiveTelemetryJob(
  snapshot: Record<string, LiveTelemetryEntry>,
): string | null {
  let activeJobId: string | null = null;
  let activeHeartbeatMs = Number.NEGATIVE_INFINITY;
  let terminalJobId: string | null = null;
  let terminalHeartbeatMs = Number.NEGATIVE_INFINITY;

  for (const [jobId, entry] of Object.entries(snapshot)) {
    if (isActiveStatus(entry.latestEvent.status)) {
      if (laterEntry(entry.lastHeartbeatMs, jobId, activeHeartbeatMs, activeJobId)) {
        activeJobId = jobId;
        activeHeartbeatMs = entry.lastHeartbeatMs;
      }
    } else if (hasTerminalRewardSummary(entry)) {
      if (laterEntry(entry.lastHeartbeatMs, jobId, terminalHeartbeatMs, terminalJobId)) {
        terminalJobId = jobId;
        terminalHeartbeatMs = entry.lastHeartbeatMs;
      }
    }
  }

  return activeJobId ?? terminalJobId;
}

export function resolveLiveEpisodeProgress(
  entry: LiveTelemetryEntry,
): LiveEpisodeProgress | null {
  // Read the last EPISODE-bearing progress event so the tile freezes the last
  // real episode instead of blanking when the producer's final metrics-only
  // progress line (episodeBudget but no episode) arrives at completion.
  const event = entry.lastEpisodeEvent;
  if (event === null || typeof event.episode !== 'number' || !Number.isFinite(event.episode)) {
    return null;
  }
  const budget = typeof event.episodeBudget === 'number' && Number.isFinite(event.episodeBudget)
    ? event.episodeBudget
    : null;
  return { episode: event.episode, budget };
}
