export const UI_MODES = ['presentation', 'tuning', 'diagnostics'] as const;

export type UiMode = (typeof UI_MODES)[number];

export const DEFAULT_UI_MODE: UiMode = 'presentation';
export const UI_MODE_STORAGE_KEY = 'leo-beam-sim.ui-mode.v1';

export function isUiMode(value: unknown): value is UiMode {
  return typeof value === 'string' && UI_MODES.includes(value as UiMode);
}

export function readPersistedUiMode(): UiMode {
  if (typeof window === 'undefined') return DEFAULT_UI_MODE;

  try {
    const stored = window.localStorage.getItem(UI_MODE_STORAGE_KEY);
    return isUiMode(stored) ? stored : DEFAULT_UI_MODE;
  } catch {
    return DEFAULT_UI_MODE;
  }
}

export function persistUiMode(mode: UiMode): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(UI_MODE_STORAGE_KEY, mode);
  } catch {
    // Storage can be unavailable in private or embedded browser contexts.
  }
}
