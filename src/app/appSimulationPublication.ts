import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { SimState } from '../scene/types';
import type { SceneLane } from './sceneLane';
import type { HandoverRailEvent } from '../ui/HandoverEventRail';
import {
  adaptHomepageSixActsFrameFacts,
  type SixActsFrameFacts,
} from '../course/sixActs/liveReplayBridge';
import {
  advanceSixActsSubtitleState,
  createSixActsSubtitleState,
  type SixActsSubtitleState,
} from '../course/sixActs/subtitleStateMachine';
import type { SixActsTeachingReceipt } from '../ui/SixActsTeachingOverlay';
import { liveObservedHandoverRailEventFromState } from './handoverRailBuilders';
import type { SixActsTeachingMode } from '../course/sixActs/teachingMode';

export interface AppSimulationPublicationInput {
  readonly state: SimState;
  readonly teachingMode: SixActsTeachingMode;
  readonly sceneLane: SceneLane;
  readonly policy: {
    readonly offsetDb: number;
    readonly tttSec: number;
  };
  readonly signalEvidenceKey: string;
  readonly liveSimTimeSecRef: MutableRefObject<number>;
  readonly walkerRuntimeHasPublishedRef: MutableRefObject<boolean>;
  readonly sixActsSubtitleRef: MutableRefObject<SixActsSubtitleState | null>;
  readonly sixActsTeachingFactsRef: MutableRefObject<SixActsFrameFacts | null>;
  readonly sixActsTeachingTraceRef: MutableRefObject<readonly SixActsFrameFacts[]>;
  readonly sixActsTeachingReceiptRef: MutableRefObject<SixActsTeachingReceipt | null>;
  readonly setSimState: Dispatch<SetStateAction<SimState>>;
  readonly setSixActsSubtitle: Dispatch<SetStateAction<SixActsSubtitleState | null>>;
  readonly setSixActsTeachingReceipt: Dispatch<SetStateAction<SixActsTeachingReceipt | null>>;
  readonly setLiveObservedHandoverRailEvents: Dispatch<SetStateAction<HandoverRailEvent[]>>;
  readonly setStaleFormulaEvidenceKey: Dispatch<SetStateAction<string | null>>;
}

/** Publish one scene frame to the shell-owned readout and teaching surfaces. */
export function publishAppSimulationFrame({
  state,
  teachingMode,
  sceneLane,
  policy,
  signalEvidenceKey,
  liveSimTimeSecRef,
  walkerRuntimeHasPublishedRef,
  sixActsSubtitleRef,
  sixActsTeachingFactsRef,
  sixActsTeachingTraceRef,
  sixActsTeachingReceiptRef,
  setSimState,
  setSixActsSubtitle,
  setSixActsTeachingReceipt,
  setLiveObservedHandoverRailEvents,
  setStaleFormulaEvidenceKey,
}: AppSimulationPublicationInput): void {
  liveSimTimeSecRef.current = state.simTimeSec;
  walkerRuntimeHasPublishedRef.current = true;
  setSimState(state);
  if (teachingMode === 'teaching' && sceneLane === 'sinr-live') {
    const facts = adaptHomepageSixActsFrameFacts(state);
    if (facts === null) {
      const hadSubtitle = sixActsSubtitleRef.current !== null;
      const hadReceipt = sixActsTeachingReceiptRef.current !== null;
      sixActsTeachingFactsRef.current = null;
      sixActsTeachingTraceRef.current = [];
      sixActsTeachingReceiptRef.current = null;
      sixActsSubtitleRef.current = null;
      if (hadSubtitle) setSixActsSubtitle(null);
      if (hadReceipt) setSixActsTeachingReceipt(null);
    } else {
      sixActsTeachingFactsRef.current = facts;
      const previousTrace = sixActsTeachingTraceRef.current;
      const previousPoint = previousTrace[previousTrace.length - 1];
      const nextTrace = previousPoint !== undefined && facts.simTimeSec < previousPoint.simTimeSec
        ? [facts]
        : previousPoint === undefined || facts.simTimeSec > previousPoint.simTimeSec
          ? [...previousTrace, facts]
          : previousTrace;
      sixActsTeachingTraceRef.current = nextTrace.slice(-96);
      const commit = facts.lastCommittedHandover;
      const previousReceipt = sixActsTeachingReceiptRef.current;
      if (
        commit !== null
        && commit.action === 'inter-handover'
        && commit.fromSatelliteId !== null
        && previousReceipt?.commit.timeMs !== commit.timeMs
      ) {
        const nextReceipt = Object.freeze({
          commit,
          simTimeSec: facts.simTimeSec,
          hoCount: state.hoCount,
        });
        sixActsTeachingReceiptRef.current = nextReceipt;
        setSixActsTeachingReceipt(nextReceipt);
      }
      const previous = sixActsSubtitleRef.current;
      const next = previous === null
        ? createSixActsSubtitleState(facts, policy)
        : advanceSixActsSubtitleState(previous, facts, policy);
      sixActsSubtitleRef.current = next;
      setSixActsSubtitle(next);
    }
  } else {
    const hadSubtitle = sixActsSubtitleRef.current !== null;
    const hadReceipt = sixActsTeachingReceiptRef.current !== null;
    sixActsTeachingFactsRef.current = null;
    sixActsTeachingTraceRef.current = [];
    sixActsTeachingReceiptRef.current = null;
    sixActsSubtitleRef.current = null;
    if (hadSubtitle) setSixActsSubtitle(null);
    if (hadReceipt) setSixActsTeachingReceipt(null);
  }
  const observedEvent = liveObservedHandoverRailEventFromState(state);
  if (observedEvent !== null) {
    setLiveObservedHandoverRailEvents(current => {
      if (current.some(event => event.id === observedEvent.id)) return current;
      return [...current, observedEvent].sort((a, b) => a.timeSec - b.timeSec);
    });
  }
  setStaleFormulaEvidenceKey(current => (
    current === signalEvidenceKey && state.physicalServingBudget !== null ? null : current
  ));
}
