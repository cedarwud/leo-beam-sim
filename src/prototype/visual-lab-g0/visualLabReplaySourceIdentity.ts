import type { LabSnapshot } from '../../visualLab/session';

/**
 * Identify the immutable orbit geometry behind a replay.
 *
 * `tleFrameId` identifies one SGP4 sample and therefore changes whenever the
 * timeline seeks. It is not a source identity. Replays may seek inside one
 * geometry run; a new constellation or rebuilt archived-TLE geometry must
 * still invalidate them.
 */
export function visualLabReplaySourceIdentity(snapshot: LabSnapshot): string | null {
  const identity = snapshot.accepted?.identity;
  if (identity === undefined || identity === null) return null;
  const geometrySource = identity.geometryRunId
    ?? `${identity.archiveId}:${identity.archiveDate}:${identity.tleEpochUtc}`;
  return `${identity.constellation}:${geometrySource}`;
}
