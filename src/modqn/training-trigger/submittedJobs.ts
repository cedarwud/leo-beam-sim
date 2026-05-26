export const SUBMITTED_JOB_IDS_KEY = 'leo-beam-sim.training-submitted-job-ids.v1' as const;
export const SUBMITTED_JOB_IDS_CAP = 50;

export interface SubmittedJobRecord {
  readonly jobId: string;
  readonly submittedAtMs: number;
  readonly hyperparamSummary: string;
}

export function readSubmittedJobIds(): readonly SubmittedJobRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(SUBMITTED_JOB_IDS_KEY);
    if (raw === null) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidRecord);
  } catch {
    return [];
  }
}

export function appendSubmittedJobId(record: SubmittedJobRecord): void {
  if (typeof window === 'undefined') return;
  const existing = readSubmittedJobIds();
  const next = [record, ...existing.filter(r => r.jobId !== record.jobId)].slice(0, SUBMITTED_JOB_IDS_CAP);
  try {
    window.localStorage.setItem(SUBMITTED_JOB_IDS_KEY, JSON.stringify(next));
  } catch {
    // best-effort persistence
  }
}

function isValidRecord(value: unknown): value is SubmittedJobRecord {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.jobId === 'string'
    && typeof v.submittedAtMs === 'number'
    && Number.isFinite(v.submittedAtMs)
    && typeof v.hyperparamSummary === 'string';
}
