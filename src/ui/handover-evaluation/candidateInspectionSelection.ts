import { useCallback, useEffect, useSyncExternalStore } from 'react';

import {
  candidateLinkKey,
  sameCandidateLinkKey,
  type CandidateLinkKey,
} from '../../engine/handover/candidateDecisionContract';

export interface CandidateInspectionSnapshot {
  readonly episodeId: string | null;
  readonly pinnedKey: CandidateLinkKey | null;
  readonly revision: number;
}

export interface CandidateInspectionStore {
  readonly getSnapshot: () => CandidateInspectionSnapshot;
  readonly subscribe: (listener: () => void) => () => void;
  readonly activateEpisode: (episodeId: string) => void;
  readonly setPinnedKey: (episodeId: string, key: CandidateLinkKey | null) => void;
  readonly togglePinnedKey: (episodeId: string, key: CandidateLinkKey) => void;
}

function copyKey(key: CandidateLinkKey | null): CandidateLinkKey | null {
  return key === null ? null : candidateLinkKey(key.satelliteId, key.beamId);
}

function freezeSnapshot(
  episodeId: string | null,
  pinnedKey: CandidateLinkKey | null,
  revision: number,
): CandidateInspectionSnapshot {
  return Object.freeze({ episodeId, pinnedKey: copyKey(pinnedKey), revision });
}

/**
 * Route-scoped inspection state shared by the right rail and R3F scene.
 * Selection changes presentation only; the scientific decision frame remains
 * immutable and never reads this store.
 */
export function createCandidateInspectionStore(): CandidateInspectionStore {
  let snapshot = freezeSnapshot(null, null, 0);
  const listeners = new Set<() => void>();
  const publish = (episodeId: string, pinnedKey: CandidateLinkKey | null) => {
    snapshot = freezeSnapshot(episodeId, pinnedKey, snapshot.revision + 1);
    for (const listener of listeners) listener();
  };
  const activateEpisode = (episodeId: string) => {
    if (snapshot.episodeId === episodeId) return;
    publish(episodeId, null);
  };
  const setPinnedKey = (episodeId: string, key: CandidateLinkKey | null) => {
    const currentKey = snapshot.episodeId === episodeId ? snapshot.pinnedKey : null;
    if (
      snapshot.episodeId === episodeId
      && ((currentKey === null && key === null)
        || (currentKey !== null && key !== null && sameCandidateLinkKey(currentKey, key)))
    ) return;
    publish(episodeId, key);
  };
  return Object.freeze({
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    activateEpisode,
    setPinnedKey,
    togglePinnedKey: (episodeId: string, key: CandidateLinkKey) => {
      const currentKey = snapshot.episodeId === episodeId ? snapshot.pinnedKey : null;
      setPinnedKey(
        episodeId,
        currentKey !== null && sameCandidateLinkKey(currentKey, key) ? null : key,
      );
    },
  });
}

export const homepageCandidateInspectionStore = createCandidateInspectionStore();

export function useCandidateInspectionSelection(episodeId: string): {
  readonly pinnedKey: CandidateLinkKey | null;
  readonly setPinnedKey: (key: CandidateLinkKey | null) => void;
  readonly togglePinnedKey: (key: CandidateLinkKey) => void;
} {
  const snapshot = useSyncExternalStore(
    homepageCandidateInspectionStore.subscribe,
    homepageCandidateInspectionStore.getSnapshot,
    homepageCandidateInspectionStore.getSnapshot,
  );
  useEffect(() => {
    homepageCandidateInspectionStore.activateEpisode(episodeId);
  }, [episodeId]);
  return {
    pinnedKey: snapshot.episodeId === episodeId ? snapshot.pinnedKey : null,
    setPinnedKey: useCallback(
      key => homepageCandidateInspectionStore.setPinnedKey(episodeId, key),
      [episodeId],
    ),
    togglePinnedKey: useCallback(
      key => homepageCandidateInspectionStore.togglePinnedKey(episodeId, key),
      [episodeId],
    ),
  };
}
