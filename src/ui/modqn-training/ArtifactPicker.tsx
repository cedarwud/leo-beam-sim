import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import type { AppExperienceMode } from '../appMode';
import { readTrainingServiceBaseUrl } from '../../modqn/training-trigger/baseUrl';
import { getJobs } from '../../modqn/training-trigger/serviceClient';
import {
  readSubmittedJobIds,
  type SubmittedJobRecord,
} from '../../modqn/training-trigger/submittedJobs';
import { shortJobId } from '../../modqn/training-trigger/jobsPolling';
import type { TrainingJobSummary } from '../../modqn/training-trigger/types';

const PICKER_POLL_MS = 30000;

interface ArtifactPickerProps {
  readonly appMode: AppExperienceMode;
  readonly selectedJobId: string | null;
  readonly onLoadEntry: (jobId: string) => void;
}

function formatTimestamp(timestampMs: number | undefined): string {
  if (typeof timestampMs !== 'number' || !Number.isFinite(timestampMs)) return 'unknown time';
  return new Date(timestampMs).toLocaleString();
}

function toSubmittedRecord(job: TrainingJobSummary): SubmittedJobRecord {
  return {
    jobId: job.jobId,
    submittedAtMs: job.submittedAtMs,
    hyperparamSummary: job.hyperparamSummary,
  };
}

export function ArtifactPicker({
  appMode,
  selectedJobId,
  onLoadEntry,
}: ArtifactPickerProps): ReactElement | null {
  const enabled = appMode === 'modqn-demo';
  const [doneJobs, setDoneJobs] = useState<readonly TrainingJobSummary[]>([]);
  const [history, setHistory] = useState<readonly SubmittedJobRecord[]>([]);
  const cancelledRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    cancelledRef.current = false;
    if (!enabled) return;
    setHistory(readSubmittedJobIds());

    const tick = async () => {
      if (cancelledRef.current) return;
      try {
        const response = await getJobs(
          { baseUrl: readTrainingServiceBaseUrl() },
          { status: 'done', limit: 50 },
        );
        if (cancelledRef.current) return;
        setDoneJobs(response.jobs);
      } catch {
        // ignore - keep last good list
      }
      if (cancelledRef.current) return;
      setHistory(readSubmittedJobIds());
      timerRef.current = setTimeout(tick, PICKER_POLL_MS);
    };

    void tick();
    return () => {
      cancelledRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled]);

  const handleLoad = useCallback((jobId: string) => {
    onLoadEntry(jobId);
  }, [onLoadEntry]);

  if (!enabled) return null;

  const doneById = new Map(doneJobs.map(job => [job.jobId, job]));
  const historyById = new Map(history.map(record => [record.jobId, record]));
  const merged = [
    ...history.map(record => {
      const done = doneById.get(record.jobId);
      return done ? toSubmittedRecord(done) : record;
    }),
    ...doneJobs
      .filter(job => !historyById.has(job.jobId))
      .map(toSubmittedRecord),
  ].sort((a, b) => b.submittedAtMs - a.submittedAtMs);
  const isEmpty = doneJobs.length === 0 && history.length === 0;

  return (
    <section
      className="artifact-picker"
      aria-label="MODQN training artifacts"
      data-testid="artifact-picker"
    >
      <header className="artifact-picker__section">
        <h3>Producer-official bundles</h3>
        <div className="artifact-picker__producer-empty" data-testid="artifact-picker-producer-empty">
          No producer-official bundles available in this build.
        </div>
      </header>
      <header className="artifact-picker__section">
        <h3>User-trained bundles</h3>
        {isEmpty ? (
          <div className="artifact-picker__empty" data-testid="artifact-picker-empty">
            No training artifacts yet.
          </div>
        ) : (
          <div className="artifact-picker__entries">
            {merged.map(record => {
              const selected = selectedJobId === record.jobId;
              return (
                <div
                  key={record.jobId}
                  className={
                    selected
                      ? 'artifact-picker__entry artifact-picker__entry--selected'
                      : 'artifact-picker__entry'
                  }
                  data-testid="artifact-picker-entry"
                  aria-current={selected ? 'true' : undefined}
                >
                  <div className="artifact-picker__entry-header">
                    <span className="artifact-picker__job-id">{shortJobId(record.jobId)}</span>
                    <span className="artifact-picker__chip artifact-picker__chip--user-trained" data-testid="artifact-picker-user-trained-chip">user-trained</span>
                  </div>
                  <div className="artifact-picker__meta">
                    submitted {formatTimestamp(record.submittedAtMs)}
                  </div>
                  <div className="artifact-picker__summary">{record.hyperparamSummary}</div>
                  <button
                    type="button"
                    data-testid="artifact-picker-load"
                    onClick={() => handleLoad(record.jobId)}
                  >
                    Load into scene
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </header>
    </section>
  );
}
