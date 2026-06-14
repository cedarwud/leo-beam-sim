/**
 * Headless Plane-A telemetry feed (P2; fixes codex [P1] tab-coupling).
 *
 * The live AlgorithmDock (mode='live') must show training telemetry regardless
 * of which LEFT sidebar tab is mounted. JobsPanel — the original SSE owner —
 * lives in the 'jobs' tab, which is NOT the default tab on
 * `modqn-live-cell-preview` (that default is 'replay', appRuntimeModel.ts:133),
 * so the dock would be starved whenever JobsPanel is unmounted.
 *
 * This headless component is mounted at App level whenever `appMode` is
 * 'modqn-demo', independent of any tab. It is the SINGLE publisher into the
 * liveTelemetryStore: it polls active jobs and opens one SSE stream per active
 * job, mirroring JobsPanel's stream effect, and calls publishTelemetryEvent.
 * It renders nothing.
 *
 * Race fix (codex [P2]): the 3 s `/jobs` poll can report a job `done` before
 * the SSE stream has emitted its FINAL `progress` line (which carries the
 * terminal reward scalars). So a stream is NOT closed the instant the job
 * leaves the active poll list — it is kept open until a terminal SSE event
 * (`done`/`failed`/`cancelled`) is observed, or a short grace period elapses.
 */
import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import { getJobs, jobStreamUrl } from '../../modqn/training-trigger/serviceClient';
import { hasConfiguredTrainingService, readTrainingServiceBaseUrl } from '../../modqn/training-trigger/baseUrl';
import { parseTrainingProgressEvent } from '../../modqn/training-trigger/parseProgressEvent';
import { ACTIVE_POLL_INTERVAL_MS, isActiveStatus } from '../../modqn/training-trigger/jobsPolling';
import type { TrainingJobSummary } from '../../modqn/training-trigger/types';
import { publishTelemetryEvent, reconcileTelemetry } from './liveTelemetryStore';

const SSE_EVENT_TYPES = ['queued', 'heartbeat', 'progress', 'done', 'failed', 'cancelled'] as const;
const TERMINAL_SSE_TYPES: ReadonlySet<string> = new Set(['done', 'failed', 'cancelled']);
/** Keep a no-longer-active stream open this long awaiting its terminal SSE event. */
const TERMINAL_GRACE_MS = 12_000;

interface ManagedSource {
  readonly source: EventSource;
  readonly handleMessage: (event: MessageEvent<string>) => void;
  graceTimer: ReturnType<typeof setTimeout> | null;
}

export interface TrainingTelemetryFeedProps {
  /** Mount only when training telemetry is relevant (appMode === 'modqn-demo'). */
  readonly enabled: boolean;
}

export function TrainingTelemetryFeed({ enabled }: TrainingTelemetryFeedProps): JSX.Element | null {
  // Only reach the training backend when a service URL is actually configured —
  // the demo ships none, so polling/SSE against the default :8765 just loops
  // ERR_CONNECTION_REFUSED. (Opt-in; un-gates the moment a URL is stored.)
  const liveEnabled = enabled && hasConfiguredTrainingService();
  const [activeJobIds, setActiveJobIds] = useState<readonly string[]>([]);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sourcesRef = useRef<Map<string, ManagedSource>>(new Map());

  const closeSource = useCallback((jobId: string) => {
    const managed = sourcesRef.current.get(jobId);
    if (managed === undefined) return;
    for (const eventType of SSE_EVENT_TYPES) managed.source.removeEventListener(eventType, managed.handleMessage);
    managed.source.onmessage = null;
    managed.source.close();
    if (managed.graceTimer !== null) clearTimeout(managed.graceTimer);
    sourcesRef.current.delete(jobId);
  }, []);

  const openSource = useCallback((jobId: string) => {
    if (sourcesRef.current.has(jobId)) return;
    const source = new EventSource(jobStreamUrl({ baseUrl: readTrainingServiceBaseUrl() }, jobId));
    const handleMessage = (event: MessageEvent<string>) => {
      const parsed = parseTrainingProgressEvent(event.data);
      if (parsed === null) return;
      publishTelemetryEvent(parsed);
      // Terminal SSE event = the final data has been delivered; close now.
      if (TERMINAL_SSE_TYPES.has(parsed.type)) closeSource(jobId);
    };
    source.onmessage = handleMessage;
    for (const eventType of SSE_EVENT_TYPES) source.addEventListener(eventType, handleMessage);
    sourcesRef.current.set(jobId, { source, handleMessage, graceTimer: null });
  }, [closeSource]);

  // Poll active jobs (lightweight; just enough to know which streams to open).
  useEffect(() => {
    if (!liveEnabled) return;
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      try {
        const response = await getJobs({ baseUrl: readTrainingServiceBaseUrl() }, { limit: 50 });
        if (cancelled) return;
        setActiveJobIds(activeIdsOf(response.jobs));
        // Prune telemetry for jobs the authoritative list no longer knows about
        // (deleted / LRU-expired) so the dock never shows a stale run (codex [P2]).
        reconcileTelemetry(new Set(response.jobs.map(job => job.jobId)));
      } catch {
        // Transient poll failure: KEEP the previous active ids/streams (do NOT
        // clear) so a job completing in this window still delivers its final
        // SSE events; just retry on the next tick (codex [P2]).
      }
      if (cancelled) return;
      // Fixed short discovery cadence while mounted, so a freshly submitted job
      // is picked up promptly instead of being stranded behind a 30 s idle
      // interval (codex [P2]).
      pollTimerRef.current = setTimeout(tick, ACTIVE_POLL_INTERVAL_MS);
    };

    void tick();
    return () => {
      cancelled = true;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [liveEnabled]);

  const activeJobIdsKey = activeJobIds.join('|');

  // Reconcile EventSources against the active set, keeping streams open through
  // terminal events / a grace window.
  useEffect(() => {
    const sources = sourcesRef.current;
    if (!liveEnabled || typeof EventSource === 'undefined') {
      for (const jobId of [...sources.keys()]) closeSource(jobId);
      return;
    }
    const active = new Set(activeJobIds);
    // Open (or keep) a stream for every active job; cancel any pending grace close.
    for (const jobId of active) {
      openSource(jobId);
      const managed = sources.get(jobId);
      if (managed?.graceTimer != null) {
        clearTimeout(managed.graceTimer);
        managed.graceTimer = null;
      }
    }
    // For open streams whose job left the active set, schedule a grace close
    // (a terminal SSE event will close earlier; this just bounds a leak).
    for (const [jobId, managed] of sources) {
      if (!active.has(jobId) && managed.graceTimer === null) {
        managed.graceTimer = setTimeout(() => closeSource(jobId), TERMINAL_GRACE_MS);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveEnabled, activeJobIdsKey, openSource, closeSource]);

  // Close everything on unmount.
  useEffect(() => {
    const sources = sourcesRef.current;
    return () => {
      for (const jobId of [...sources.keys()]) {
        const managed = sources.get(jobId);
        if (managed === undefined) continue;
        for (const eventType of SSE_EVENT_TYPES) managed.source.removeEventListener(eventType, managed.handleMessage);
        managed.source.onmessage = null;
        managed.source.close();
        if (managed.graceTimer !== null) clearTimeout(managed.graceTimer);
        sources.delete(jobId);
      }
    };
  }, []);

  return null;
}

function activeIdsOf(jobs: readonly TrainingJobSummary[]): readonly string[] {
  return jobs.filter(job => isActiveStatus(job.status)).map(job => job.jobId).sort();
}
