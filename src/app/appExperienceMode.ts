import { HANDOVER_MODE_STORAGE_KEY, type RuntimeHandoverMode } from '../modqn/runtimeControls';

export const APP_EXPERIENCE_MODES = ['sinr-experiment', 'modqn-demo'] as const;

export type AppExperienceMode = (typeof APP_EXPERIENCE_MODES)[number];

export const DEFAULT_APP_EXPERIENCE_MODE: AppExperienceMode = 'sinr-experiment';
export const APP_MODE_STORAGE_KEY = 'leo-beam-sim.app-mode.v1';
export const PROFILE_BY_MODE_STORAGE_KEY = 'leo-beam-sim.profile-by-app-mode.v1';

export const APP_MODE_HANDOVER_MAP: Readonly<
  Record<AppExperienceMode, Extract<RuntimeHandoverMode, 'sinr-offset' | 'decision-overlay-on-live-sinr'>>
> = {
  'sinr-experiment': 'sinr-offset',
  'modqn-demo': 'decision-overlay-on-live-sinr',
};

// MODQN consolidation: the MODQN live page reuses the SINR scene render directly, so
// it opens on the SAME candidate-rich 100-UE-spread profile as sinr-experiment (the
// paper-faithful 4sat/7beam profile is clustered → 0 multi-beam cones). The MODQN
// proof is the Q-value sidebar (Family-B envelope), not the live scene's geometry.
export const APP_MODE_DEFAULT_PROFILE: Readonly<Record<AppExperienceMode, string>> = {
  'sinr-experiment': 'hobs-2024-candidate-rich',
  'modqn-demo': 'hobs-2024-candidate-rich',
};

export function isAppExperienceMode(value: unknown): value is AppExperienceMode {
  return typeof value === 'string' && APP_EXPERIENCE_MODES.includes(value as AppExperienceMode);
}

export function appModeForRuntimeHandover(mode: RuntimeHandoverMode): AppExperienceMode | null {
  if (mode === 'decision-overlay-on-live-sinr') return 'modqn-demo';
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

  try {
    const legacyHandoverMode = window.localStorage.getItem(HANDOVER_MODE_STORAGE_KEY);
    const migrated = (
      legacyHandoverMode === 'sinr-offset'
      || legacyHandoverMode === 'decision-overlay-on-live-sinr'
      || legacyHandoverMode === 'omega-heuristic'
    )
      ? appModeForRuntimeHandover(legacyHandoverMode) ?? DEFAULT_APP_EXPERIENCE_MODE
      : DEFAULT_APP_EXPERIENCE_MODE;
    try {
      window.localStorage.setItem(APP_MODE_STORAGE_KEY, migrated);
    } catch {
      // Storage can be unavailable in private or embedded browser contexts.
    }
    return migrated;
  } catch {
    return DEFAULT_APP_EXPERIENCE_MODE;
  }
}

export function persistAppMode(mode: AppExperienceMode): void {
  if (typeof window === 'undefined') return;

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
  // MODQN consolidation: the MODQN live page reuses the SINR scene render directly, so
  // it ALWAYS uses the candidate-rich default profile — never an independently-persisted
  // one. A stale persisted `modqn-demo -> paper-faithful` (the old default, saved by any
  // earlier MODQN visit) renders the DEGENERATE clustered scene (served=0, no beam
  // cones). Ignoring it here fixes existing browsers without a manual cache clear.
  if (mode === 'modqn-demo') return APP_MODE_DEFAULT_PROFILE[mode];
  const storedProfileId = stored[mode];
  if (storedProfileId !== undefined && isKnownProfileId(storedProfileId)) {
    return storedProfileId;
  }
  return APP_MODE_DEFAULT_PROFILE[mode];
}

