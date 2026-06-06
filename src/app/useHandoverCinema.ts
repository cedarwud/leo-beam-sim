/**
 * Handover cinema controller (S1.1).
 *
 * A THIN wrapper around the existing Director focus orchestration
 * (`useDirectorOrchestration`) + camera FSM — it does NOT reimplement the
 * seek / 0.05x slow-mo / camera-tween lifecycle. It adds the cinema's three
 * affordances on top of that machinery:
 *   - arm with an intra/inter filter (delegates to the existing handlers),
 *   - exit (delegates to the existing cancel + camera exit),
 *   - resolve the focused handover's candidate detail (beam ids + recorded live
 *     SINR) from the live Walker index, which feeds the candidate-beam highlight
 *     scene layer and the SINR explainer.
 *
 * Honesty: it owns no truth. The candidate detail is built ONLY from the real
 * `sinr-live` handover index (`buildCinemaCandidateDetail`) — no producer/MODQN
 * dependency, no fabrication (governance Rule#6, CLAUDE.md §3).
 */
import { useCallback, useMemo, useState } from 'react';
import type { LiveWalkerHandoverEventIndex } from '../scene/liveWalkerHandoverEventIndex';
import type { DirectorFocusPhase } from '../scene/types';
import type { SceneLane } from './sceneLane';
import {
  buildCinemaCandidateDetail,
  type CinemaCandidateDetail,
} from './handoverCinema';

export type HandoverCinemaArmFilter = 'off' | 'intra' | 'inter';

export interface UseHandoverCinemaParams {
  readonly sceneLane: SceneLane;
  readonly handoverEventIndex: LiveWalkerHandoverEventIndex | null;
  /** Event id of the armed/active live Director focus (from the orchestration). */
  readonly focusedEventId: string | null;
  /** Camera FSM phase; non-idle (or an armed event) means the cinema is engaged. */
  readonly directorPhase: DirectorFocusPhase;
  /** Existing Director handlers — wrapped, never rewritten. */
  readonly armIntraFocus: () => void;
  readonly armInterFocus: () => void;
  /** Existing exit path (cancel armed-but-unfired + camera.exitDirectorFocus). */
  readonly exitFocus: () => void;
}

export interface HandoverCinema {
  /** The active filter, derived to follow real state (resets to 'off' when idle). */
  readonly armFilter: HandoverCinemaArmFilter;
  /** True while a focus is armed or playing — drives highlight + explainer visibility. */
  readonly cinemaActive: boolean;
  /** The focused handover's two candidate beams + recorded live SINR (sinr-live only). */
  readonly focusedCandidate: CinemaCandidateDetail | null;
  readonly armIntra: () => void;
  readonly armInter: () => void;
  readonly exit: () => void;
}

export function useHandoverCinema(params: UseHandoverCinemaParams): HandoverCinema {
  const {
    sceneLane,
    handoverEventIndex,
    focusedEventId,
    directorPhase,
    armIntraFocus,
    armInterFocus,
    exitFocus,
  } = params;

  const [requestedFilter, setRequestedFilter] = useState<HandoverCinemaArmFilter>('off');

  const armIntra = useCallback(() => {
    setRequestedFilter('intra');
    armIntraFocus();
  }, [armIntraFocus]);

  const armInter = useCallback(() => {
    setRequestedFilter('inter');
    armInterFocus();
  }, [armInterFocus]);

  const exit = useCallback(() => {
    setRequestedFilter('off');
    exitFocus();
  }, [exitFocus]);

  // A focus is engaged while the FSM is non-idle OR an event is armed-but-unfired
  // (the ~300ms fade + async seek-land window). This drives highlight + explainer.
  const cinemaActive = directorPhase !== 'idle' || focusedEventId !== null;

  // Follow real state: external exits (Escape / viewport click / lane switch go
  // through the orchestration, not through this hook) clear the focus without
  // calling `exit()`, so snap the displayed filter back to 'off' once idle.
  const armFilter: HandoverCinemaArmFilter = cinemaActive ? requestedFilter : 'off';

  const focusedCandidate = useMemo(
    () => buildCinemaCandidateDetail(handoverEventIndex, focusedEventId, sceneLane),
    [handoverEventIndex, focusedEventId, sceneLane],
  );

  return { armFilter, cinemaActive, focusedCandidate, armIntra, armInter, exit };
}
