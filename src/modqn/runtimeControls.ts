export type RuntimeHandoverMode =
  | 'sinr-offset'
  | 'decision-overlay-on-live-sinr'
  | 'omega-heuristic';

export interface RuntimeOmegaState {
  readonly throughput: number;
  readonly handover: number;
  readonly loadBalance: number;
}

export const DEFAULT_RUNTIME_HANDOVER_MODE: RuntimeHandoverMode = 'sinr-offset';

/**
 * S4-4 (Decision D3) honest-label note. The ω / decision override is installed
 * ONLY on the primary UE's HandoverManager (`useSimulation` `hoManager`, 1 of N
 * UEs — `useSimulation.ts` override-install site). The secondary UE population
 * and the earth-fixed cell managers take no override parameter; they always
 * follow the live SINR-offset handover policy. This note is surfaced verbatim by
 * the heuristic disclosure banner (`HeuristicNotPaperBanner`) and the InfoPanel
 * override-mode copy so the live-cell-preview demo never implies the override
 * drives the whole served population. Pinned by `validate:s4:override-primary-scope`.
 */
export const OVERRIDE_PRIMARY_UE_SCOPE_NOTE =
  'Override drives the primary UE only — the rest of the served UEs follow the live SINR-offset policy.';

// MODQN paper-faithful training-time omega, from docs/modqn-omega-handover-sdd.md §12.8.
export const MODQN_PAPER_FAITHFUL_OMEGA: RuntimeOmegaState = Object.freeze({
  throughput: 0.4,
  handover: 0.3,
  loadBalance: 0.3,
});

export const HANDOVER_MODE_STORAGE_KEY = 'leo-beam-sim.handover-mode.v1';

/** Legacy value stored before OQ-7 renamed the public MODQN mode. */
const LEGACY_MODQN_REPLAY_VALUE = 'modqn-replay';

const PERSISTABLE_MODES = new Set<RuntimeHandoverMode>([
  'sinr-offset',
  'decision-overlay-on-live-sinr',
]);

/**
 * Read the persisted handover mode, migrating the legacy `'modqn-replay'`
 * value to `'decision-overlay-on-live-sinr'` on the fly.
 */
export function readPersistedHandoverMode(): RuntimeHandoverMode {
  if (typeof window === 'undefined') return DEFAULT_RUNTIME_HANDOVER_MODE;
  try {
    const stored = window.localStorage.getItem(HANDOVER_MODE_STORAGE_KEY);
    if (stored === 'sinr-offset' || stored === 'decision-overlay-on-live-sinr') return stored;
    if (stored === LEGACY_MODQN_REPLAY_VALUE) {
      try {
        window.localStorage.setItem(
          HANDOVER_MODE_STORAGE_KEY,
          'decision-overlay-on-live-sinr',
        );
      } catch {
        // Storage unavailable; still return the migrated value.
      }
      return 'decision-overlay-on-live-sinr';
    }
  } catch {
    // Storage unavailable in private/embedded contexts.
  }
  return DEFAULT_RUNTIME_HANDOVER_MODE;
}

export function persistHandoverMode(mode: RuntimeHandoverMode): void {
  if (typeof window === 'undefined') return;
  if (!PERSISTABLE_MODES.has(mode)) return;
  try {
    window.localStorage.setItem(HANDOVER_MODE_STORAGE_KEY, mode);
  } catch {
    // Storage unavailable.
  }
}
