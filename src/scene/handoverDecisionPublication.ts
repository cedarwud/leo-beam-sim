import type { HandoverDecisionFrame } from '../engine/handover/candidateDecisionContract';

function keyOf(key: HandoverDecisionFrame['serving']): string {
  return key === null ? 'none' : `${key.satelliteId}|${key.beamId}`;
}

const boundaryKeyCache = new WeakMap<HandoverDecisionFrame, string>();

/**
 * Discrete publication identity for the right rail. Numeric measurements and
 * source-frame IDs intentionally do not participate, so the normal one-second
 * teaching cadence remains intact. Decision phase/role/gate boundaries do
 * participate and therefore publish immediately.
 */
export function handoverDecisionBoundaryKey(frame: HandoverDecisionFrame | null | undefined): string {
  if (frame === null || frame === undefined) return 'none';
  const cached = boundaryKeyCache.get(frame);
  if (cached !== undefined) return cached;
  const statesByKey = new Map(frame.states.map(state => [keyOf(state.key), state] as const));
  const states = frame.opportunities.map(opportunity => {
    const state = statesByKey.get(keyOf(opportunity.key));
    return state === undefined ? `missing:${keyOf(opportunity.key)}` : [
      keyOf(state.key),
      state.hardEligibility,
      state.triggerStatus,
      state.stable ? 'stable' : 'unstable',
    ].join(':');
  });
  const receipt = frame.recentCommit === null
    ? 'none'
    : [
      frame.recentCommit.kind,
      keyOf(frame.recentCommit.from),
      keyOf(frame.recentCommit.to),
      frame.recentCommit.mode,
    ].join(':');
  const boundaryKey = JSON.stringify([
    frame.episodeId,
    frame.phase,
    frame.mode,
    keyOf(frame.serving),
    keyOf(frame.provisionalLeader),
    keyOf(frame.selectedTarget),
    frame.opportunities.length,
    states,
    receipt,
  ]);
  boundaryKeyCache.set(frame, boundaryKey);
  return boundaryKey;
}
