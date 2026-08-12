import { useEffect, useMemo, useRef, useState } from 'react';
import { loadTleSnapshotSelection, loadTleWebArchiveCatalog } from '../../simulator/archive';
import {
  buildSimulationAnalysisFrame,
  createSimulatorTleState,
  simulatorTaipeiDateTimeToUtc,
} from '../../simulator/analysis';
import {
  DEFAULT_SIMULATOR_PARAMETERS,
  SIMULATOR_CATALOG_URLS,
  type SimulationAnalysisFrame,
  type SimulatorLoadStatus,
  type SimulatorParameters,
} from '../../simulator/types';

const HOMEPAGE_CANONICAL_TAIPEI_LOCAL = '2026-08-08T20:00';

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export interface HomepageCanonicalAnalysisState {
  readonly frame: SimulationAnalysisFrame | null;
  readonly status: SimulatorLoadStatus;
  readonly error: string | null;
  readonly parameters: SimulatorParameters;
  readonly setParameters: (next: SimulatorParameters) => void;
  readonly resetParameters: () => void;
}

/**
 * Load one accepted archived-TLE frame for the compact homepage projections.
 *
 * This is deliberately a separate, explicitly identified canonical analysis
 * frame. The restored Walker scene remains a legacy visual surface and is not
 * allowed to supply page-specific SINR/power shortcuts to these projections.
 */
export function useHomepageCanonicalAnalysis(): HomepageCanonicalAnalysisState {
  const [tleState, setTleState] = useState<ReturnType<typeof createSimulatorTleState> | null>(null);
  const [status, setStatus] = useState<SimulatorLoadStatus>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [parameters, setParametersState] = useState<SimulatorParameters>({ ...DEFAULT_SIMULATOR_PARAMETERS });
  const lastAcceptedFrame = useRef<SimulationAnalysisFrame | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setLoadError(null);
    void (async () => {
      try {
        const catalog = await loadTleWebArchiveCatalog(SIMULATOR_CATALOG_URLS.oneweb);
        if (catalog.constellation !== 'oneweb') {
          throw new Error(`homepage canonical catalog mismatch: ${catalog.constellation}`);
        }
        const utc = simulatorTaipeiDateTimeToUtc(HOMEPAGE_CANONICAL_TAIPEI_LOCAL);
        const selection = await loadTleSnapshotSelection(catalog, utc);
        const nextState = createSimulatorTleState(selection, utc);
        if (cancelled) return;
        setTleState(nextState);
        setStatus('ready');
      } catch (error) {
        if (cancelled) return;
        setTleState(null);
        setLoadError(readableError(error));
        setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const computed = useMemo((): { readonly frame: SimulationAnalysisFrame | null; readonly error: string | null } => {
    if (tleState === null) return { frame: null, error: null };
    try {
      return { frame: buildSimulationAnalysisFrame(tleState, parameters), error: null };
    } catch (error) {
      return { frame: null, error: readableError(error) };
    }
  }, [parameters, tleState]);

  useEffect(() => {
    if (status === 'ready' && computed.frame !== null) lastAcceptedFrame.current = computed.frame;
  }, [computed.frame, status]);

  const frame = computed.frame ?? lastAcceptedFrame.current;
  const error = loadError ?? computed.error;

  return {
    frame,
    status: computed.error === null ? status : 'error',
    error,
    parameters,
    setParameters: next => setParametersState({ ...next }),
    resetParameters: () => setParametersState({ ...DEFAULT_SIMULATOR_PARAMETERS }),
  };
}
