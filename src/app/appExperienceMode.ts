// The open string tail on the public mode type keeps retained downstream
// modules type-checkable until their second-wave removal. This module itself
// only accepts and produces the canonical value below.
export type RuntimeHandoverMode = 'sinr-offset';

export const APP_EXPERIENCE_MODES = ['sinr-experiment'] as const;

export type AppExperienceMode = (typeof APP_EXPERIENCE_MODES)[number] | (string & {});

export const DEFAULT_APP_EXPERIENCE_MODE: AppExperienceMode = 'sinr-experiment';
export const APP_MODE_STORAGE_KEY = 'leo-beam-sim.app-mode.v1';
export const PROFILE_BY_MODE_STORAGE_KEY = 'leo-beam-sim.profile-by-app-mode.v1';

export const APP_MODE_HANDOVER_MAP: Readonly<
  Record<string, 'sinr-offset'>
> = {
  'sinr-experiment': 'sinr-offset',
};

export const APP_MODE_DEFAULT_PROFILE: Readonly<Record<string, string>> = {
  'sinr-experiment': 'hobs-2024-candidate-rich',
};

export function isAppExperienceMode(value: unknown): value is AppExperienceMode {
  return value === 'sinr-experiment';
}

export function appModeForRuntimeHandover(mode: string): AppExperienceMode | null {
  if (mode === 'sinr-offset') return 'sinr-experiment';
  return null;
}

export function readPersistedAppMode(): AppExperienceMode {
  if (typeof window === 'undefined') return DEFAULT_APP_EXPERIENCE_MODE;

  try {
    const stored = window.localStorage.getItem(APP_MODE_STORAGE_KEY);
    if (isAppExperienceMode(stored)) return stored;
  } catch {
    return DEFAULT_APP_EXPERIENCE_MODE;
  }

  return DEFAULT_APP_EXPERIENCE_MODE;
}

export function persistAppMode(mode: AppExperienceMode): void {
  if (typeof window === 'undefined') return;
  if (!isAppExperienceMode(mode)) return;

  try {
    window.localStorage.setItem(APP_MODE_STORAGE_KEY, mode);
  } catch {
    // Storage can be unavailable in private or embedded browser contexts.
  }
}

export type ProfileByMode = Partial<Record<AppExperienceMode, string>>;

export function readPersistedProfileByMode(): ProfileByMode {
  if (typeof window === 'undefined') return {};

  try {
    const stored = window.localStorage.getItem(PROFILE_BY_MODE_STORAGE_KEY);
    if (stored === null) return {};
    const parsed: unknown = JSON.parse(stored);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    const result: ProfileByMode = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (isAppExperienceMode(key) && typeof value === 'string') {
        result[key] = value;
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function persistProfileByMode(map: ProfileByMode): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(PROFILE_BY_MODE_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Storage can be unavailable in private or embedded browser contexts.
  }
}

export function resolveProfileForAppMode(
  mode: AppExperienceMode,
  stored: ProfileByMode,
  isKnownProfileId: (id: string) => boolean,
): string {
  const storedProfileId = stored[mode];
  if (storedProfileId !== undefined && isKnownProfileId(storedProfileId)) {
    return storedProfileId;
  }
  return APP_MODE_DEFAULT_PROFILE[mode] ?? APP_MODE_DEFAULT_PROFILE['sinr-experiment'];
}
