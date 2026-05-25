import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import type { AppExperienceMode } from '../appMode';
import { readTrainingServiceBaseUrl } from '../../modqn/training-trigger/baseUrl';
import { getJobDetail, getJobs } from '../../modqn/training-trigger/serviceClient';
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
  TrainingJobDetail,
  TrainingJobSummary,
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

export function JobsPanel({ appMode, onLoadIntoScene }: JobsPanelProps): ReactElement | null {
  const enabled = appMode === 'modqn-demo';
  const [jobs, setJobs] = useState<readonly TrainingJobSummary[]>([]);
  const [history, setHistory] = useState<readonly SubmittedJobRecord[]>([]);
  const [offline, setOffline] = useState(false);
  const [detail, setDetail] = useState<Record<string, TrainingJobDetail | undefined>>({});
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
        setJobs(response.jobs);
        activeCountRef.current = countActiveJobs(response.jobs);
        setOffline(false);
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

  if (!enabled) return null;

  const nowMs = Date.now();
  const activeJobs = jobs.filter(j => isActiveStatus(j.status));
  const doneJobs = jobs.filter(j => isDoneStatus(j.status));
  const knownIds = new Set(jobs.map(j => j.jobId));
  const expiredJobs = history.filter(h => !knownIds.has(h.jobId));
  const isEmpty = activeJobs.length === 0 && doneJobs.length === 0 && expiredJobs.length === 0;

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

      {activeJobs.length > 0 ? (
        <section className="leo-jobs-panel__section" aria-label="Active training jobs">
          <h3>Active</h3>
          {activeJobs.map(job => {
            const startedAtMs = getStartedAtMs(job);
            const stdoutTail = detail[job.jobId]?.stdoutTail;
            const progress = parseEpisodeProgress(stdoutTail);
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
