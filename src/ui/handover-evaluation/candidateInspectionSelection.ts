import { useCallback, useEffect, useSyncExternalStore } from 'react';

import {
  candidateLinkKey,
  candidateLinkKeyString,
  sameCandidateLinkKey,
  type CandidateLinkKey,
} from '../../engine/handover/candidateDecisionContract';

export interface CandidateInspectionSnapshot {
  readonly episodeId: string | null;
  /**
   * The accepted publication against which the interaction was evaluated.
   * A pin without this anchor is not safe to pass to the central publisher.
   */
  readonly basedOnSnapshotId: string | null;
  readonly pinnedKey: CandidateLinkKey | null;
  readonly revision: number;
  readonly pinResolution: CandidateInspectionPinResolution | null;
}

export type CandidateInspectionPinResolutionReason =
  | 'accepted'
  | 'stale-snapshot-revalidated'
  | 'episode-mismatch'
  | 'pair-not-present'
  | 'snapshot-unavailable';

/** The result of applying a route-scoped pin request to the latest snapshot. */
export interface CandidateInspectionPinResolution {
  readonly accepted: boolean;
  readonly revalidated: boolean;
  readonly reason: CandidateInspectionPinResolutionReason;
  readonly basedOnSnapshotId: string | null;
}

/**
 * Pin requests carry the publication identity read by the emitting control.
 * The store only accepts a non-null pin after it has been checked against the
 * latest accepted key set registered with `activateSnapshot`.
 */
export interface CandidateInspectionPinRequest {
  readonly episodeId: string;
  readonly basedOnSnapshotId: string;
  readonly pinnedKey: CandidateLinkKey | null;
}

export interface CandidateInspectionSnapshotInput {
  readonly episodeId: string;
  readonly snapshotId: string;
  /** All pair keys present in the latest accepted decision snapshot. */
  readonly validKeys: readonly CandidateLinkKey[];
}

export interface CandidateInspectionStore {
  readonly getSnapshot: () => CandidateInspectionSnapshot;
  readonly subscribe: (listener: () => void) => () => void;
  readonly activateEpisode: (episodeId: string) => void;
  /** Register the latest accepted frame and revalidate any existing pin. */
  readonly activateSnapshot: (input: CandidateInspectionSnapshotInput) => CandidateInspectionPinResolution;
  /** Apply a pin request that may have been emitted by an older snapshot. */
  readonly setPinnedRequest: (request: CandidateInspectionPinRequest) => CandidateInspectionPinResolution;
  readonly togglePinnedRequest: (request: CandidateInspectionPinRequest) => CandidateInspectionPinResolution;
  /** Legacy convenience wrappers; new callers should use request methods. */
  readonly setPinnedKey: (episodeId: string, key: CandidateLinkKey | null) => CandidateInspectionPinResolution;
  readonly togglePinnedKey: (episodeId: string, key: CandidateLinkKey) => CandidateInspectionPinResolution;
}

function copyKey(key: CandidateLinkKey | null): CandidateLinkKey | null {
  return key === null ? null : candidateLinkKey(key.satelliteId, key.beamId);
}

function freezeSnapshot(
  episodeId: string | null,
  basedOnSnapshotId: string | null,
  pinnedKey: CandidateLinkKey | null,
  revision: number,
  pinResolution: CandidateInspectionPinResolution | null,
): CandidateInspectionSnapshot {
  return Object.freeze({
    episodeId,
    basedOnSnapshotId,
    pinnedKey: copyKey(pinnedKey),
    revision,
    pinResolution: pinResolution === null ? null : Object.freeze({ ...pinResolution }),
  });
}

function nonEmpty(value: string, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`candidate inspection: ${label} must be non-empty`);
  }
  return value;
}

function sameKeyOrNull(left: CandidateLinkKey | null, right: CandidateLinkKey | null): boolean {
  return left === null && right === null
    ? true
    : left !== null && right !== null && sameCandidateLinkKey(left, right);
}

function keySet(keys: readonly CandidateLinkKey[]): ReadonlySet<string> {
  const result = new Set<string>();
  for (const key of keys) result.add(candidateLinkKeyString(key));
  return result;
}

function keyIn(keys: ReadonlySet<string>, key: CandidateLinkKey): boolean {
  return keys.has(candidateLinkKeyString(key));
}

function resolution(
  accepted: boolean,
  revalidated: boolean,
  reason: CandidateInspectionPinResolutionReason,
  basedOnSnapshotId: string | null,
): CandidateInspectionPinResolution {
  return Object.freeze({ accepted, revalidated, reason, basedOnSnapshotId });
}

/**
 * Route-scoped inspection state shared by the right rail and R3F scene.
 * Selection changes presentation only; the scientific decision frame remains
 * immutable and never reads this store.
 */
export function createCandidateInspectionStore(): CandidateInspectionStore {
  let snapshot = freezeSnapshot(null, null, null, 0, null);
  let currentValidKeys: ReadonlySet<string> = new Set<string>();
  const listeners = new Set<() => void>();
  const publish = (
    episodeId: string | null,
    basedOnSnapshotId: string | null,
    pinnedKey: CandidateLinkKey | null,
    pinResolution: CandidateInspectionPinResolution | null,
  ) => {
    snapshot = freezeSnapshot(
      episodeId,
      basedOnSnapshotId,
      pinnedKey,
      snapshot.revision + 1,
      pinResolution,
    );
    for (const listener of listeners) listener();
  };
  const activateEpisode = (episodeId: string) => {
    nonEmpty(episodeId, 'episodeId');
    if (snapshot.episodeId === episodeId) return;
    currentValidKeys = new Set<string>();
    publish(episodeId, null, null, null);
  };

  const activateSnapshot = (input: CandidateInspectionSnapshotInput): CandidateInspectionPinResolution => {
    const episodeId = nonEmpty(input.episodeId, 'episodeId');
    const snapshotId = nonEmpty(input.snapshotId, 'snapshotId');
    const nextKeys = keySet(input.validKeys);
    const episodeChanged = snapshot.episodeId !== episodeId;
    const previousSnapshotId = snapshot.basedOnSnapshotId;
    const previousPin = episodeChanged ? null : snapshot.pinnedKey;
    currentValidKeys = nextKeys;

    if (episodeChanged) {
      const result = resolution(true, false, 'accepted', snapshotId);
      publish(episodeId, snapshotId, null, result);
      return result;
    }

    if (previousPin !== null && !keyIn(nextKeys, previousPin)) {
      const result = resolution(false, previousSnapshotId !== null && previousSnapshotId !== snapshotId, 'pair-not-present', snapshotId);
      if (previousSnapshotId !== snapshotId || snapshot.pinnedKey !== null || snapshot.pinResolution?.reason !== result.reason) {
        publish(episodeId, snapshotId, null, result);
      }
      return result;
    }

    const revalidated = previousPin !== null
      && previousSnapshotId !== null
      && previousSnapshotId !== snapshotId;
    const result = resolution(
      true,
      revalidated,
      revalidated ? 'stale-snapshot-revalidated' : 'accepted',
      snapshotId,
    );
    if (
      previousSnapshotId !== snapshotId
      || snapshot.basedOnSnapshotId !== snapshotId
      || snapshot.pinResolution?.reason !== result.reason
      || snapshot.pinResolution?.revalidated !== result.revalidated
    ) {
      publish(episodeId, snapshotId, previousPin, result);
    }
    return result;
  };

  const setPinnedRequest = (request: CandidateInspectionPinRequest): CandidateInspectionPinResolution => {
    const episodeId = nonEmpty(request.episodeId, 'request.episodeId');
    const basedOnSnapshotId = nonEmpty(request.basedOnSnapshotId, 'request.basedOnSnapshotId');
    const requestedKey = request.pinnedKey === null ? null : copyKey(request.pinnedKey);
    const latestSnapshotId = snapshot.basedOnSnapshotId;

    if (snapshot.episodeId !== episodeId) {
      return resolution(false, false, 'episode-mismatch', latestSnapshotId);
    }

    // Clearing is safe even if the originating frame is stale: it cannot
    // resurrect old science or replace a newer pin.
    if (requestedKey === null) {
      const result = resolution(true, basedOnSnapshotId !== latestSnapshotId, 'accepted', latestSnapshotId);
      if (snapshot.pinnedKey !== null) publish(episodeId, latestSnapshotId, null, result);
      return result;
    }

    if (latestSnapshotId === null) {
      return resolution(false, false, 'snapshot-unavailable', null);
    }

    if (!keyIn(currentValidKeys, requestedKey)) {
      const result = resolution(false, basedOnSnapshotId !== latestSnapshotId, 'pair-not-present', latestSnapshotId);
      // A stale request for an absent pair must never evict a different pin
      // that was accepted on the newer snapshot. Only clear the requested
      // pair (or publish the rejection while already unpinned).
      if (
        (snapshot.pinnedKey !== null && sameCandidateLinkKey(snapshot.pinnedKey, requestedKey))
        || (snapshot.pinnedKey === null && snapshot.pinResolution?.reason !== result.reason)
      ) {
        publish(episodeId, latestSnapshotId, null, result);
      }
      return result;
    }

    const staleRequest = basedOnSnapshotId !== latestSnapshotId;
    const result = resolution(true, staleRequest, staleRequest ? 'stale-snapshot-revalidated' : 'accepted', latestSnapshotId);
    if (
      !sameKeyOrNull(snapshot.pinnedKey, requestedKey)
      || snapshot.basedOnSnapshotId !== latestSnapshotId
      || snapshot.pinResolution?.reason !== result.reason
      || snapshot.pinResolution?.revalidated !== result.revalidated
    ) {
      publish(episodeId, latestSnapshotId, requestedKey, result);
    }
    return result;
  };

  const togglePinnedRequest = (request: CandidateInspectionPinRequest): CandidateInspectionPinResolution => {
    const currentKey = snapshot.episodeId === request.episodeId ? snapshot.pinnedKey : null;
    return setPinnedRequest({
      episodeId: request.episodeId,
      basedOnSnapshotId: request.basedOnSnapshotId,
      pinnedKey: currentKey !== null && request.pinnedKey !== null && sameCandidateLinkKey(currentKey, request.pinnedKey)
        ? null
        : request.pinnedKey,
    });
  };

  const setPinnedKey = (episodeId: string, key: CandidateLinkKey | null): CandidateInspectionPinResolution => {
    // Keep old callers source-compatible while making an unanchored non-null
    // pin fail closed. They must migrate to setPinnedRequest once they have an
    // accepted snapshot ID.
    if (snapshot.episodeId !== episodeId) {
      return resolution(false, false, 'episode-mismatch', snapshot.basedOnSnapshotId);
    }
    if (snapshot.basedOnSnapshotId === null) {
      if (key === null && snapshot.pinnedKey !== null) {
        publish(episodeId, null, null, resolution(true, false, 'accepted', null));
        return snapshot.pinResolution ?? resolution(true, false, 'accepted', null);
      }
      return key === null
        ? resolution(true, false, 'accepted', null)
        : resolution(false, false, 'snapshot-unavailable', null);
    }
    return setPinnedRequest({ episodeId, basedOnSnapshotId: snapshot.basedOnSnapshotId, pinnedKey: key });
  };

  const togglePinnedKey = (episodeId: string, key: CandidateLinkKey): CandidateInspectionPinResolution => {
    if (snapshot.episodeId !== episodeId) return resolution(false, false, 'episode-mismatch', snapshot.basedOnSnapshotId);
    if (snapshot.basedOnSnapshotId === null) return resolution(false, false, 'snapshot-unavailable', null);
    return togglePinnedRequest({ episodeId, basedOnSnapshotId: snapshot.basedOnSnapshotId, pinnedKey: key });
  };

  return Object.freeze({
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    activateEpisode,
    activateSnapshot,
    setPinnedRequest,
    togglePinnedRequest,
    setPinnedKey,
    togglePinnedKey,
  });
}

export const homepageCandidateInspectionStore = createCandidateInspectionStore();

export function useCandidateInspectionSelection(
  episodeId: string,
  acceptedSnapshot: CandidateInspectionSnapshotInput | null = null,
): {
  readonly pinnedKey: CandidateLinkKey | null;
  readonly basedOnSnapshotId: string | null;
  readonly pinResolution: CandidateInspectionPinResolution | null;
  readonly setPinnedKey: (key: CandidateLinkKey | null) => void;
  readonly togglePinnedKey: (key: CandidateLinkKey) => void;
} {
  const snapshot = useSyncExternalStore(
    homepageCandidateInspectionStore.subscribe,
    homepageCandidateInspectionStore.getSnapshot,
    homepageCandidateInspectionStore.getSnapshot,
  );
  useEffect(() => {
    if (acceptedSnapshot === null) {
      homepageCandidateInspectionStore.activateEpisode(episodeId);
      return;
    }
    homepageCandidateInspectionStore.activateSnapshot(acceptedSnapshot);
  }, [acceptedSnapshot, episodeId]);
  // Keep the last accepted pin available while a newer publication is being
  // registered by the passive effect. The publisher independently validates
  // the key against its current decision before planning, so transiently
  // retaining this episode-scoped request cannot resurrect an absent pair and
  // avoids one-frame pin flicker on every accepted snapshot advance.
  const isCurrentEpisode = snapshot.episodeId === episodeId;
  return {
    pinnedKey: isCurrentEpisode ? snapshot.pinnedKey : null,
    basedOnSnapshotId: isCurrentEpisode ? snapshot.basedOnSnapshotId : null,
    pinResolution: isCurrentEpisode ? snapshot.pinResolution : null,
    setPinnedKey: useCallback(
      key => {
        if (acceptedSnapshot === null) {
          homepageCandidateInspectionStore.setPinnedKey(episodeId, key);
          return;
        }
        // An event may fire before the passive registration effect after a
        // publication commit. Register the snapshot synchronously at the
        // interaction boundary, then apply the anchored request.
        homepageCandidateInspectionStore.activateSnapshot(acceptedSnapshot);
        homepageCandidateInspectionStore.setPinnedRequest({
          episodeId,
          basedOnSnapshotId: acceptedSnapshot.snapshotId,
          pinnedKey: key,
        });
      },
      [acceptedSnapshot, episodeId],
    ),
    togglePinnedKey: useCallback(
      key => {
        if (acceptedSnapshot === null) {
          homepageCandidateInspectionStore.togglePinnedKey(episodeId, key);
          return;
        }
        homepageCandidateInspectionStore.activateSnapshot(acceptedSnapshot);
        homepageCandidateInspectionStore.togglePinnedRequest({
          episodeId,
          basedOnSnapshotId: acceptedSnapshot.snapshotId,
          pinnedKey: key,
        });
      },
      [acceptedSnapshot, episodeId],
    ),
  };
}
