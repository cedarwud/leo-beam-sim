/**
 * Plane-A live training telemetry store (Master SDD v2 §3.1 / §3.4 / §3.5 INV-2).
 *
 * A tiny `useSyncExternalStore`-backed module store that holds the latest
 * SSE `TrainingProgressEvent` per job plus the timestamps needed for INV-2
 * staleness. It is fed by the single existing `EventSource` owner
 * (`JobsPanel`, P2) via `publishTelemetryEvent`; this module opens NO second
 * stream. The snapshot is referentially stable until a new event arrives, so
 * consumers never spin (G4). Time-derived status (live/stalled/offline) is NOT
 * in the snapshot — it is computed by the consumer from a `nowMs` tick via the
 * pure `resolveTelemetryStatus`, keeping the snapshot stable.
 */
import { useSyncExternalStore } from 'react';
import type { JobStatus, TrainingProgressEvent } from '../../modqn/training-trigger/types';
import { isActiveStatus } from '../../modqn/training-trigger/jobsPolling';

export type TelemetryStatus = 'live' | 'stalled' | 'offline';

/**
 * Thresholds reconciled to the producer's 10 s heartbeat cadence
 * (`modqn-paper-reproduction` api.py:817 / worker.py:248). Master SDD v2 §7 G2
 * mentions a loose "3 s" that predates the 10 s heartbeat fact in §3.5 INV-2;
 * at a 10 s cadence a 3 s silence is normal, so "offline" must allow for a
 * couple of missed beats. These are tunable display constants (no truth
 * impact); the final polish pass may revisit them.
 */
export const HEARTBEAT_INTERVAL_MS = 10_000;
/** Heartbeat silence beyond this ⇒ connection presumed dead (≈ 2.5 missed beats). */
export const OFFLINE_AFTER_MS = 25_000;
/** Heartbeat alive but no `progress` event for this long ⇒ stalled, not offline. */
export const STALL_AFTER_MS = 20_000;

export interface LiveTelemetryEntry {
  /** Latest event of ANY type — use for lifecycle status / terminal detection. */
  readonly latestEvent: TrainingProgressEvent;
  /** Last `progress` event (sticky reward metrics), or null if none yet. */
  readonly lastProgressEvent: TrainingProgressEvent | null;
  /**
   * Last `progress` event that actually carried a finite `episode` (sticky for
   * the episode-progress tile). The producer's FINAL scalar line is a `progress`
   * event with metrics + episodeBudget but NO episode, so this is tracked apart
   * from lastProgressEvent to avoid the episode tile blanking at completion.
   */
  readonly lastEpisodeEvent: TrainingProgressEvent | null;
  /** tsMs of the last `progress` event, or null if none seen yet. */
  readonly lastProgressMs: number | null;
  /** tsMs of the last event of ANY type (proves the stream is alive). */
  readonly lastHeartbeatMs: number;
}

/**
 * Pure INV-2 status resolver. `jobStatus` is the job's lifecycle status; only
 * the active statuses (queued/running/paused per the shared `isActiveStatus`
 * classifier) can be live/stalled — every terminal status (done/completed/
 * failed/cancelled/expired) is offline. Deterministic — `nowMs` is a parameter,
 * never read from the clock here, so it is unit-testable.
 */
export function resolveTelemetryStatus(
  lastProgressMs: number | null,
  lastHeartbeatMs: number | null,
  nowMs: number,
  jobStatus: JobStatus,
): TelemetryStatus {
  if (lastHeartbeatMs === null) return 'offline';
  if (!isActiveStatus(jobStatus)) return 'offline';
  if (nowMs - lastHeartbeatMs > OFFLINE_AFTER_MS) return 'offline';
  // Stall (INV-2) applies only to a RUNNING job whose progress FROZE: we have
  // seen a progress sample and it has since aged out. A queued/paused job, or a
  // running job still awaiting its first progress, is 'live' (connected) — we
  // have no frozen-progress evidence and no job-start clock to claim a stall.
  if (jobStatus === 'running' && lastProgressMs !== null && nowMs - lastProgressMs > STALL_AFTER_MS) {
    return 'stalled';
  }
  return 'live';
}

// --- module store (useSyncExternalStore) ---

type Snapshot = Readonly<Record<string, LiveTelemetryEntry>>;

const EMPTY_SNAPSHOT: Snapshot = Object.freeze({});
let snapshot: Snapshot = EMPTY_SNAPSHOT;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** Push a parsed SSE event into the store. Called by the EventSource owner. */
export function publishTelemetryEvent(event: TrainingProgressEvent): void {
  const previous = snapshot[event.jobId];
  const isProgress = event.type === 'progress';
  const hasEpisode = typeof event.episode === 'number' && Number.isFinite(event.episode);
  snapshot = Object.freeze({
    ...snapshot,
    [event.jobId]: {
      latestEvent: event,
      // Sticky: heartbeat/terminal events carry no episode/metrics, so keep the
      // last progress payload for display tiles instead of overwriting it.
      lastProgressEvent: isProgress ? event : (previous?.lastProgressEvent ?? null),
      // Only an episode-bearing progress event updates this — the producer's
      // final metrics-only progress line (no episode) must not blank it.
      lastEpisodeEvent: isProgress && hasEpisode ? event : (previous?.lastEpisodeEvent ?? null),
      lastProgressMs: isProgress ? event.tsMs : (previous?.lastProgressMs ?? null),
      // ANY event (heartbeat or progress) proves the stream is alive.
      lastHeartbeatMs: event.tsMs,
    },
  });
  emit();
}

/**
 * Prune store entries for jobs the authoritative job list no longer knows about
 * (deleted by the user or LRU-expired). Called by the feed each successful poll
 * so the live dock never shows a deleted run's terminal scalars indefinitely
 * (codex [P2]). A no-op (stable identity) when every entry is still known.
 */
export function reconcileTelemetry(knownJobIds: ReadonlySet<string>): void {
  let changed = false;
  const next: Record<string, LiveTelemetryEntry> = {};
  for (const [jobId, entry] of Object.entries(snapshot)) {
    if (knownJobIds.has(jobId)) {
      next[jobId] = entry;
    } else {
      changed = true;
    }
  }
  if (!changed) return;
  snapshot = Object.freeze(next);
  emit();
}

/** Drop a job's telemetry (e.g. when its stream closes). */
export function clearTelemetry(jobId: string): void {
  if (!(jobId in snapshot)) return;
  const next: Record<string, LiveTelemetryEntry> = { ...snapshot };
  delete next[jobId];
  snapshot = Object.freeze(next);
  emit();
}

/** Test-only: reset the store to empty. */
export function resetTelemetryStore(): void {
  snapshot = EMPTY_SNAPSHOT;
  emit();
}

/** Non-hook read (test/diagnostic). */
export function getTelemetrySnapshot(): Snapshot {
  return snapshot;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useLiveTelemetry(): Snapshot {
  return useSyncExternalStore(subscribe, getTelemetrySnapshot, getTelemetrySnapshot);
}

export function useLiveTelemetryEntry(jobId: string | null): LiveTelemetryEntry | null {
  const all = useLiveTelemetry();
  return jobId === null ? null : (all[jobId] ?? null);
}
