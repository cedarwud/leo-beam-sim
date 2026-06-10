import type { TrainingJobSummary } from './types';

export const ACTIVE_POLL_INTERVAL_MS = 3000;
export const IDLE_POLL_INTERVAL_MS = 30000;

export function computePollIntervalMs(activeJobCount: number): number {
  return activeJobCount > 0 ? ACTIVE_POLL_INTERVAL_MS : IDLE_POLL_INTERVAL_MS;
}

export function countActiveJobs(jobs: readonly TrainingJobSummary[]): number {
  return jobs.filter(j => isActiveStatus(j.status)).length;
}

export function isActiveStatus(status: TrainingJobSummary['status']): boolean {
  return status === 'queued' || status === 'running' || status === 'paused';
}

export function isCancellableStatus(status: TrainingJobSummary['status']): boolean {
  return status === 'queued' || status === 'running';
}

export function isDoneStatus(status: TrainingJobSummary['status']): boolean {
  return status === 'done' || status === 'completed';
}

export function formatRunningFor(elapsedMs: number): string {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return '0s';
  const totalSec = Math.floor(elapsedMs / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function shortJobId(jobId: string): string {
  return jobId.length <= 10 ? jobId : `${jobId.slice(0, 6)}…${jobId.slice(-4)}`;
}
