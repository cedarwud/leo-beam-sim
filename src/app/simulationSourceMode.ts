/**
 * The source selector is an app-level view preference, independent of the
 * scene lane and of the scientific values rendered by either source.
 */
export const SIMULATION_SOURCE_MODES = ['walker', 'archived-tle'] as const;

export type SimulationSourceMode = (typeof SIMULATION_SOURCE_MODES)[number];

export const DEFAULT_SIMULATION_SOURCE_MODE: SimulationSourceMode = 'walker';
/**
 * The source switch stays hidden so the homepage mounts exactly one producer.
 * The homepage producer is Walker; archived TLE remains available to dedicated
 * simulator and teaching routes, but cannot silently replace live handover.
 */
export const HOMEPAGE_SIMULATION_SOURCE_SWITCH_VISIBLE = false;
export const SIMULATION_SOURCE_MODE_STORAGE_KEY = 'leo-beam-sim.simulation-source-mode.v1';

export function isSimulationSourceMode(value: unknown): value is SimulationSourceMode {
  return typeof value === 'string'
    && SIMULATION_SOURCE_MODES.includes(value as SimulationSourceMode);
}

/**
 * Read the last explicit source choice without making SSR or private-storage
 * availability part of the app's startup contract. Any malformed or
 * unavailable storage resolves to the Walker default.
 */
export function readPersistedSimulationSourceMode(): SimulationSourceMode {
  if (typeof window === 'undefined') return DEFAULT_SIMULATION_SOURCE_MODE;

  try {
    const stored = window.localStorage.getItem(SIMULATION_SOURCE_MODE_STORAGE_KEY);
    return isSimulationSourceMode(stored)
      ? stored
      : DEFAULT_SIMULATION_SOURCE_MODE;
  } catch {
    return DEFAULT_SIMULATION_SOURCE_MODE;
  }
}

/** Resolve the source the homepage is currently allowed to mount. */
export function readHomepageSimulationSourceMode(): SimulationSourceMode {
  return HOMEPAGE_SIMULATION_SOURCE_SWITCH_VISIBLE
    ? readPersistedSimulationSourceMode()
    : DEFAULT_SIMULATION_SOURCE_MODE;
}

/**
 * Persist only the typed source choice. Storage failures are intentionally
 * ignored: the caller's in-memory state remains authoritative for this load.
 */
export function persistSimulationSourceMode(mode: SimulationSourceMode): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(SIMULATION_SOURCE_MODE_STORAGE_KEY, mode);
  } catch {
    // Storage can be unavailable in private or embedded browser contexts.
  }
}
