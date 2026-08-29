import { formatSatelliteLabel } from '../../utils/formatSatelliteLabel';
import type { BeamIdentitySource, CandidateLinkKey } from './candidateDecisionContract';

export interface CandidateDisplayKeyInput {
  readonly key: CandidateLinkKey;
  readonly beamIdentitySource: BeamIdentitySource;
}

/**
 * One compact identity string shared by the accepted scene projection and the
 * right rail. Walker's current cell-surrogate adapter intentionally publishes
 * a one-based link-budget beam ID equal to the one-based displayed cell ID.
 * Physical-beam producers do not fabricate a cell suffix.
 */
export function formatCandidateDisplayKey(input: CandidateDisplayKeyInput): string {
  const satellite = formatSatelliteLabel(input.key.satelliteId);
  const beam = `B${input.key.beamId}`;
  return input.beamIdentitySource === 'walker-cell-surrogate'
    ? `${satellite} / ${beam} / C${input.key.beamId}`
    : `${satellite} / ${beam}`;
}
