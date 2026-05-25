export const TRAINING_SERVICE_BASE_URL_KEY = 'leo-beam-sim.training-service.base-url.v1' as const;
export const DEFAULT_TRAINING_SERVICE_BASE_URL = 'http://127.0.0.1:8765' as const;

export function readTrainingServiceBaseUrl(): string {
  if (typeof window === 'undefined') return DEFAULT_TRAINING_SERVICE_BASE_URL;
  try {
    const stored = window.localStorage.getItem(TRAINING_SERVICE_BASE_URL_KEY);
    if (typeof stored === 'string' && stored.length > 0) return stored;
  } catch {
    // ignore - fall through to default
  }
  return DEFAULT_TRAINING_SERVICE_BASE_URL;
}

export function persistTrainingServiceBaseUrl(value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(TRAINING_SERVICE_BASE_URL_KEY, value);
  } catch {
    // ignore - best-effort persistence
  }
}
