import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import type { AppExperienceMode } from '../appMode';
import { readTrainingServiceBaseUrl } from '../../modqn/training-trigger/baseUrl';
import { getBatch, getJobDetail, getJobs, jobStreamUrl } from '../../modqn/training-trigger/serviceClient';
import {
  readSubmittedJobIds,
  type SubmittedJobRecord,
} from '../../modqn/training-trigger/submittedJobs';
import {
  computePollIntervalMs,
  countActiveJobs,
  formatRunningFor,
  isActiveStatus,
  isDoneStatus,
  shortJobId,
} from '../../modqn/training-trigger/jobsPolling';
import type {
  BatchDetail,
  TrainingJobDetail,
  TrainingJobSummary,
  TrainingProgressEvent,
} from '../../modqn/training-trigger/types';

interface JobsPanelProps {
  readonly appMode: AppExperienceMode;
  readonly onLoadIntoScene?: (jobId: string) => void;
}

function formatTimestamp(timestampMs: number | undefined): string {
  if (typeof timestampMs !== 'number' || !Number.isFinite(timestampMs)) return 'unknown time';
  return new Date(timestampMs).toLocaleString();
}

function getStartedAtMs(job: TrainingJobSummary): number | undefined {
  return typeof job.startedAtMs === 'number' && Number.isFinite(job.startedAtMs)
    ? job.startedAtMs
    : job.submittedAtMs;
}

export interface EpisodeProgressReadout {
  readonly current: number;
  readonly total: number;
  readonly percent: number;
}

// Parse the LAST `episode N / M` line in the stdout tail. Returns null
// if absent or unparseable. M must be a positive integer to avoid
// divide-by-zero.
export function parseEpisodeProgress(
  stdoutTail: string | undefined,
): EpisodeProgressReadout | null {
  if (typeof stdoutTail !== 'string' || stdoutTail.length === 0) return null;
  const matches = [...stdoutTail.matchAll(/episode\s+(\d+)\s*\/\s*(\d+)/g)];
  if (matches.length === 0) return null;
  const last = matches[matches.length - 1];
  const current = Number(last[1]);
  const total = Number(last[2]);
  if (!Number.isFinite(current) || !Number.isFinite(total)) return null;
  if (total <= 0) return null;
  const ratio = current / total;
  const percent = Math.min(100, Math.max(0, Math.round(ratio * 100)));
  return { current, total, percent };
}

function parseTrainingProgressEvent(raw: string): TrainingProgressEvent | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const record = parsed as Partial<TrainingProgressEvent>;
    return typeof record.id === 'number' && typeof record.jobId === 'string'
      ? record as TrainingProgressEvent
      : null;
  } catch {
    return null;
  }
}

function progressFromStreamEvent(
  event: TrainingProgressEvent | undefined,
): EpisodeProgressReadout | null {
  if (
    event === undefined
    || typeof event.episode !== 'number'
    || typeof event.episodeBudget !== 'number'
    || event.episodeBudget <= 0
  ) {
    return null;
  }
  const percent = Math.min(
    100,
    Math.max(0, Math.round((event.episode / event.episodeBudget) * 100)),
  );
  return {
    current: event.episode,
    total: event.episodeBudget,
    percent,
  };
}

function formatMetric(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(3) : '-';
}

function collectBatchIds(
  jobs: readonly TrainingJobSummary[],
  history: readonly SubmittedJobRecord[],
): string[] {
  const batchIds = new Set<string>();
  for (const job of jobs) {
    if (typeof job.batchId === 'string' && job.batchId.length > 0) batchIds.add(job.batchId);
  }
  for (const record of history) {
    if (typeof record.batchId === 'string' && record.batchId.length > 0) batchIds.add(record.batchId);
  }
  return [...batchIds].sort();
}

function countBatchStatus(batch: BatchDetail, status: string): number {
  const value = batch.counts[status];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function batchJobTotal(batch: BatchDetail): number {
  if (batch.jobs.length > 0) return batch.jobs.length;
  return Object.values(batch.counts).reduce((sum, value) => (
    typeof value === 'number' && Number.isFinite(value) ? sum + value : sum
  ), 0);
}

function batchCompletionReadout(batch: BatchDetail): EpisodeProgressReadout {
  const total = Math.max(1, batchJobTotal(batch));
  const complete = countBatchStatus(batch, 'done')
    + countBatchStatus(batch, 'failed')
    + countBatchStatus(batch, 'cancelled');
  const percent = Math.min(100, Math.max(0, Math.round((complete / total) * 100)));
  return { current: complete, total, percent };
}

function formatBatchCounts(batch: BatchDetail): string {
  const queued = countBatchStatus(batch, 'queued');
  const running = countBatchStatus(batch, 'running');
  const done = countBatchStatus(batch, 'done');
  const failed = countBatchStatus(batch, 'failed');
  const cancelled = countBatchStatus(batch, 'cancelled');
  return `queued ${queued} · running ${running} · done ${done} · failed ${failed} · cancelled ${cancelled}`;
}

export function JobsPanel({ appMode, onLoadIntoScene }: JobsPanelProps): ReactElement | null {
  const enabled = appMode === 'modqn-demo';
  const [jobs, setJobs] = useState<readonly TrainingJobSummary[]>([]);
  const [history, setHistory] = useState<readonly SubmittedJobRecord[]>([]);
  const [offline, setOffline] = useState(false);
  const [detail, setDetail] = useState<Record<string, TrainingJobDetail | undefined>>({});
  const [batchDetails, setBatchDetails] = useState<Record<string, BatchDetail | undefined>>({});
  const [batchErrors, setBatchErrors] = useState<Record<string, string | undefined>>({});
  const [streamEvents, setStreamEvents] = useState<Record<string, TrainingProgressEvent | undefined>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const activeCountRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setHistory(readSubmittedJobIds());

    const tick = async () => {
      if (cancelled) return;
      try {
        const response = await getJobs(
          { baseUrl: readTrainingServiceBaseUrl() },
          { limit: 50 },
        );
        if (cancelled) return;
        const currentHistory = readSubmittedJobIds();
        setJobs(response.jobs);
        setHistory(currentHistory);
        activeCountRef.current = countActiveJobs(response.jobs);
        setOffline(false);
        const batchIds = collectBatchIds(response.jobs, currentHistory);
        if (batchIds.length > 0) {
          const nextDetails: Record<string, BatchDetail | undefined> = {};
          const nextErrors: Record<string, string | undefined> = {};
          await Promise.all(batchIds.map(async batchId => {
            try {
              nextDetails[batchId] = await getBatch({ baseUrl: readTrainingServiceBaseUrl() }, batchId);
              nextErrors[batchId] = undefined;
            } catch (error) {
              nextErrors[batchId] = error instanceof Error ? error.message : String(error);
            }
          }));
          if (cancelled) return;
          setBatchDetails(prev => ({ ...prev, ...nextDetails }));
          setBatchErrors(prev => ({ ...prev, ...nextErrors }));
        }
      } catch {
        if (cancelled) return;
        activeCountRef.current = 0;
        setOffline(true);
      }
      if (cancelled) return;
      setHistory(readSubmittedJobIds());
      const intervalMs = computePollIntervalMs(activeCountRef.current);
      timerRef.current = setTimeout(tick, intervalMs);
    };

    void tick();

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled]);

  const handleRefreshDetail = useCallback(async (jobId: string) => {
    try {
      const d = await getJobDetail({ baseUrl: readTrainingServiceBaseUrl() }, jobId);
      setDetail(prev => ({ ...prev, [jobId]: d }));
    } catch {
      // ignore - keep previous detail
    }
  }, []);

  const handleRefreshBatch = useCallback(async (batchId: string) => {
    try {
      const batch = await getBatch({ baseUrl: readTrainingServiceBaseUrl() }, batchId);
      setBatchDetails(prev => ({ ...prev, [batchId]: batch }));
      setBatchErrors(prev => ({ ...prev, [batchId]: undefined }));
    } catch (error) {
      setBatchErrors(prev => ({
        ...prev,
        [batchId]: error instanceof Error ? error.message : String(error),
      }));
    }
  }, []);

  const activeJobIds = useMemo(
    () => jobs.filter(job => isActiveStatus(job.status)).map(job => job.jobId).sort(),
    [jobs],
  );
  const activeJobIdsKey = activeJobIds.join('|');

  useEffect(() => {
    if (!enabled || activeJobIds.length === 0 || typeof EventSource === 'undefined') return;
    const sources = activeJobIds.map(jobId => {
      const source = new EventSource(jobStreamUrl({ baseUrl: readTrainingServiceBaseUrl() }, jobId));
      const handleMessage = (event: MessageEvent<string>) => {
        const parsed = parseTrainingProgressEvent(event.data);
        if (parsed === null) return;
        setStreamEvents(current => ({ ...current, [parsed.jobId]: parsed }));
      };
      source.onmessage = handleMessage;
      for (const eventType of ['queued', 'heartbeat', 'progress', 'done', 'failed']) {
        source.addEventListener(eventType, handleMessage);
      }
      return { source, handleMessage };
    });
    return () => {
      for (const { source, handleMessage } of sources) {
        for (const eventType of ['queued', 'heartbeat', 'progress', 'done', 'failed']) {
          source.removeEventListener(eventType, handleMessage);
        }
        source.onmessage = null;
        source.close();
      }
    };
  }, [activeJobIdsKey, enabled]);

  if (!enabled) return null;

  const nowMs = Date.now();
  const activeJobs = jobs.filter(j => isActiveStatus(j.status));
  const doneJobs = jobs.filter(j => isDoneStatus(j.status));
  const knownIds = new Set(jobs.map(j => j.jobId));
  const expiredJobs = history.filter(h => !knownIds.has(h.jobId));
  const batchIds = collectBatchIds(jobs, history);
  const isEmpty = activeJobs.length === 0
    && doneJobs.length === 0
    && expiredJobs.length === 0
    && batchIds.length === 0;

  return (
    <section
      className="leo-jobs-panel"
      aria-label="Training jobs"
      data-testid="jobs-panel"
    >
      {offline ? (
        <div role="status" className="leo-jobs-panel__offline" data-testid="jobs-panel-offline">
          Training backend unreachable — polling paused
        </div>
      ) : null}

      {batchIds.length > 0 ? (
        <section className="leo-jobs-panel__section" aria-label="Sensitivity sweep batches">
          <h3>Batches</h3>
          {batchIds.map(batchId => {
            const batch = batchDetails[batchId];
            const error = batchErrors[batchId];
            const progress = batch ? batchCompletionReadout(batch) : null;
            return (
              <div
                key={batchId}
                className="leo-jobs-panel__card leo-jobs-panel__card--batch"
                data-testid="jobs-panel-batch-card"
              >
                <div className="leo-jobs-panel__card-header">
                  <span className="leo-jobs-panel__job-id">{shortJobId(batchId)}</span>
                  <span className="leo-jobs-panel__status">{batch?.status ?? 'loading'}</span>
                </div>
                {batch ? (
                  <>
                    <div className="leo-jobs-panel__meta">
                      {formatBatchCounts(batch)}
                    </div>
                    <div
                      className="leo-jobs-panel__progress-determinate"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={progress?.percent ?? 0}
                      data-testid="jobs-panel-batch-progress"
                    >
                      <div
                        className="leo-jobs-panel__progress-determinate-fill"
                        style={{ width: `${progress?.percent ?? 0}%` }}
                      />
                    </div>
                    <span className="leo-jobs-panel__progress-readout">
                      cells {progress?.current ?? 0} / {progress?.total ?? 0} · {progress?.percent ?? 0}%
                    </span>
                    <div className="leo-jobs-panel__batch-cells" aria-label="Batch cells">
                      {batch.jobs.slice(0, 6).map(cell => (
                        <div
                          key={`${cell.jobId}-${cell.cellIndex}-${cell.seedIndex}`}
                          className="leo-jobs-panel__batch-cell"
                          data-testid="jobs-panel-batch-cell"
                        >
                          <span>{cell.axisLabel}={cell.axisValue}</span>
                          <strong>{cell.status}</strong>
                        </div>
                      ))}
                    </div>
                    {batch.jobs.length > 6 ? (
                      <div className="leo-jobs-panel__meta">
                        +{batch.jobs.length - 6} more cells
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="leo-jobs-panel__meta">Fetching batch detail from backend</div>
                )}
                {error ? (
                  <div className="leo-jobs-panel__note" data-testid="jobs-panel-batch-error">
                    {error}
                  </div>
                ) : null}
                <button
                  type="button"
                  data-testid="jobs-panel-refresh-batch"
                  onClick={() => { void handleRefreshBatch(batchId); }}
                >
                  Refresh batch
                </button>
              </div>
            );
          })}
        </section>
      ) : null}

      {activeJobs.length > 0 ? (
        <section className="leo-jobs-panel__section" aria-label="Active training jobs">
          <h3>Active</h3>
          {activeJobs.map(job => {
            const startedAtMs = getStartedAtMs(job);
            const stdoutTail = detail[job.jobId]?.stdoutTail;
            const streamEvent = streamEvents[job.jobId];
            const streamProgress = progressFromStreamEvent(streamEvent);
            const progress = streamProgress ?? parseEpisodeProgress(stdoutTail);
            return (
              <div
                key={job.jobId}
                className="leo-jobs-panel__card leo-jobs-panel__card--active"
                data-testid="jobs-panel-active-card"
              >
                <div className="leo-jobs-panel__card-header">
                  <span className="leo-jobs-panel__job-id">{shortJobId(job.jobId)}</span>
                  <span className="leo-jobs-panel__status">{job.status}</span>
                </div>
                {startedAtMs !== undefined ? (
                  <div className="leo-jobs-panel__meta">
                    running for {formatRunningFor(nowMs - startedAtMs)}
                  </div>
                ) : null}
                <div className="leo-jobs-panel__meta">
                  {job.arm ?? 'legacy'}{job.batchId ? ` · batch ${shortJobId(job.batchId)}` : ''}
                </div>
                {progress === null ? (
                  <div
                    className="leo-jobs-panel__progress-indeterminate"
                    role="progressbar"
                    aria-busy="true"
                  />
                ) : (
                  <>
                    <div
                      className="leo-jobs-panel__progress-determinate"
                      role="progressbar"
                      aria-busy="true"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={progress.percent}
                    >
                      <div
                        className="leo-jobs-panel__progress-determinate-fill"
                        style={{ width: `${progress.percent}%` }}
                      />
                    </div>
                    <span
                      className="leo-jobs-panel__progress-readout"
                      data-testid="jobs-panel-active-card-percent"
                    >
                      episode {progress.current} / {progress.total} · {progress.percent}%
                    </span>
                  </>
                )}
                {streamEvent?.metrics ? (
                  <div className="leo-jobs-panel__stream-metrics" data-testid="jobs-panel-sse-metrics">
                    scalar {formatMetric(streamEvent.metrics.scalarReward)} · r1 {formatMetric(streamEvent.metrics.r1Mean)} · ho {formatMetric(streamEvent.metrics.totalHandovers)}
                  </div>
                ) : null}
                <button
                  type="button"
                  data-testid="jobs-panel-refresh-detail"
                  onClick={() => { void handleRefreshDetail(job.jobId); }}
                >
                  Refresh detail
                </button>
                {stdoutTail ? (
                  <pre className="leo-jobs-panel__stdout">{stdoutTail}</pre>
                ) : null}
              </div>
            );
          })}
        </section>
      ) : null}

      {doneJobs.length > 0 ? (
        <section className="leo-jobs-panel__section" aria-label="Completed training jobs">
          <h3>Done</h3>
          {doneJobs.map(job => (
            <div
              key={job.jobId}
              className="leo-jobs-panel__card leo-jobs-panel__card--done"
              data-testid="jobs-panel-done-card"
            >
              <div className="leo-jobs-panel__card-header">
                <span className="leo-jobs-panel__job-id">{shortJobId(job.jobId)}</span>
                <span className="leo-jobs-panel__status">{job.status}</span>
              </div>
              <div className="leo-jobs-panel__meta">
                finished {formatTimestamp(job.finishedAtMs)}
              </div>
              <div className="leo-jobs-panel__meta">
                {job.arm ?? 'legacy'}{job.batchId ? ` · batch ${shortJobId(job.batchId)}` : ''}
              </div>
              <button
                type="button"
                data-testid="jobs-panel-load-into-scene"
                disabled={onLoadIntoScene === undefined}
                title={onLoadIntoScene === undefined ? 'Wired in PR-θ' : undefined}
                onClick={() => { onLoadIntoScene?.(job.jobId); }}
              >
                Load into scene
              </button>
            </div>
          ))}
        </section>
      ) : null}

      {expiredJobs.length > 0 ? (
        <section className="leo-jobs-panel__section" aria-label="Expired training jobs">
          <h3>Expired</h3>
          {expiredJobs.map(record => (
            <div
              key={record.jobId}
              className="leo-jobs-panel__card leo-jobs-panel__card--expired"
              data-testid="jobs-panel-expired-card"
            >
              <div className="leo-jobs-panel__card-header">
                <span className="leo-jobs-panel__job-id">{shortJobId(record.jobId)}</span>
                <span className="leo-jobs-panel__status">expired</span>
              </div>
              <div className="leo-jobs-panel__meta">
                submitted {formatTimestamp(record.submittedAtMs)}
              </div>
              {record.batchId ? (
                <div className="leo-jobs-panel__meta">
                  batch {shortJobId(record.batchId)}
                </div>
              ) : null}
              <div className="leo-jobs-panel__summary">{record.hyperparamSummary}</div>
              <div className="leo-jobs-panel__note">Backend no longer has this job</div>
            </div>
          ))}
        </section>
      ) : null}

      {isEmpty && !offline ? (
        <p className="leo-jobs-panel__empty" data-testid="jobs-panel-empty">
          No training jobs yet — start one from the Training tab.
        </p>
      ) : null}
    </section>
  );
}
