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
  type SimulatorConstellation,
  type SimulationAnalysisFrame,
  type SimulatorLoadStatus,
  type SimulatorParameters,
  type TleWebArchiveCatalog,
} from '../../simulator/types';

const HOMEPAGE_CANONICAL_TAIPEI_LOCAL = '2026-08-08T20:00';
const HOMEPAGE_DEFAULT_CONSTELLATION: SimulatorConstellation = 'starlink';

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export interface HomepageCanonicalAnalysisState {
  readonly frame: SimulationAnalysisFrame | null;
  readonly catalog: TleWebArchiveCatalog | null;
  readonly status: SimulatorLoadStatus;
  readonly error: string | null;
  readonly requestedConstellation: SimulatorConstellation;
  readonly setRequestedConstellation: (next: SimulatorConstellation) => void;
  readonly taipeiDateTime: string;
  readonly setTaipeiDateTime: (next: string) => void;
  readonly resetTaipeiDateTime: () => void;
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
  const [requestedConstellation, setRequestedConstellation] = useState<SimulatorConstellation>(
    HOMEPAGE_DEFAULT_CONSTELLATION,
  );
  const [taipeiDateTime, setTaipeiDateTime] = useState(HOMEPAGE_CANONICAL_TAIPEI_LOCAL);
  const [catalog, setCatalog] = useState<TleWebArchiveCatalog | null>(null);
  const [tleState, setTleState] = useState<ReturnType<typeof createSimulatorTleState> | null>(null);
  const [status, setStatus] = useState<SimulatorLoadStatus>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [parameters, setParametersState] = useState<SimulatorParameters>({ ...DEFAULT_SIMULATOR_PARAMETERS });
  const lastAcceptedFrame = useRef<SimulationAnalysisFrame | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    let cancelled = false;
    setStatus('loading');
    setLoadError(null);
    // A new constellation/time request is atomic. Do not recompute a hybrid
    // frame from the previous TLE state while the new archive is loading;
    // the right rail keeps the last fully accepted frame instead.
    setTleState(null);
    // A constellation switch must not leave the previous archive metadata
    // available to the new request while its catalog is being validated.
    setCatalog(null);
    void (async () => {
      try {
        const nextCatalog = await loadTleWebArchiveCatalog(
          SIMULATOR_CATALOG_URLS[requestedConstellation],
        );
        if (nextCatalog.constellation !== requestedConstellation) {
          throw new Error(
            `homepage catalog mismatch: requested ${requestedConstellation}, received ${nextCatalog.constellation}`,
          );
        }
        const utc = simulatorTaipeiDateTimeToUtc(taipeiDateTime);
        const selection = await loadTleSnapshotSelection(nextCatalog, utc);
        const nextState = createSimulatorTleState(selection, utc);
        if (cancelled || currentRequest !== requestId.current) return;
        setCatalog(nextCatalog);
        setTleState(nextState);
        setStatus('ready');
      } catch (error) {
        if (cancelled || currentRequest !== requestId.current) return;
        setLoadError(readableError(error));
        setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, [requestedConstellation, taipeiDateTime]);

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
  // React renders once before an effect runs. Gate the published catalog by
  // request identity so that this intermediate render cannot expose the old
  // constellation's bounds as the requested catalog.
  const currentCatalog = catalog?.constellation === requestedConstellation ? catalog : null;

  return {
    frame,
    catalog: currentCatalog,
    status: computed.error === null ? status : 'error',
    error,
    requestedConstellation,
    setRequestedConstellation: next => {
      if (next === requestedConstellation) return;
      setStatus('loading');
      setLoadError(null);
      setTleState(null);
      setCatalog(null);
      setRequestedConstellation(next);
    },
    taipeiDateTime,
    setTaipeiDateTime: next => {
      if (next === taipeiDateTime) return;
      setStatus('loading');
      setLoadError(null);
      setTleState(null);
      setTaipeiDateTime(next);
    },
    resetTaipeiDateTime: () => {
      // Do not guess a date when the requested constellation has no accepted
      // catalog yet. A guessed fallback could violate that archive's bounds.
      const latestArchiveDate = currentCatalog?.lastArchiveDate;
      if (latestArchiveDate === undefined) return;
      const normalized = `${latestArchiveDate.slice(0, 4)}-${latestArchiveDate.slice(4, 6)}-${latestArchiveDate.slice(6, 8)}`;
      const next = `${normalized}T20:00`;
      if (next === taipeiDateTime) return;
      setStatus('loading');
      setLoadError(null);
      setTleState(null);
      setTaipeiDateTime(next);
    },
    parameters,
    setParameters: next => setParametersState({ ...next }),
    resetParameters: () => setParametersState({ ...DEFAULT_SIMULATOR_PARAMETERS }),
  };
}
