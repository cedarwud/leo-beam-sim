import type { TrainingProgressEvent } from './types';

/**
 * Parse a raw SSE `event.data` JSON string into a TrainingProgressEvent.
 * Returns null on malformed JSON or a payload missing the required
 * `id: number` + `jobId: string` discriminators. Shared by the JobsPanel
 * display stream and the headless TrainingTelemetryFeed store stream.
 */
export function parseTrainingProgressEvent(raw: string): TrainingProgressEvent | null {
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
