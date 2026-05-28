import type { ClaimBoundaryBannerInput } from '../ui/ClaimBoundaryBanner';

/**
 * P1e follow-up: ClaimBoundaryBanner mount input for the live-sim path.
 *
 * The renderer accepts only the {sceneSource, claimBoundary, evidenceStatus,
 * provenance} subset of NormalizedSceneFrame. On the live-sim path no artifact
 * is loaded, so we feed the banner a static stub that mirrors the live-stub
 * shape emitted by `liveSimToScene` (allowedClaims / forbiddenClaims identical
 * to the producer-validated live boundary). The banner therefore renders in
 * `kind: 'rendered'` mode with the live SINR claim and the live forbidden-claim
 * list active.
 */
export const LIVE_SIM_CLAIM_BOUNDARY_INPUT: ClaimBoundaryBannerInput = {
  sceneSource: 'live-sim',
  provenance: {
    kind: 'live-stub',
    note: 'live-sim provenance - repo build info',
  },
  claimBoundary: {
    kind: 'live-stub',
    storyKind: 'live-sinr-sim',
    allowedClaims: ['interference-aware SINR (live)'],
    forbiddenClaims: [
      'Multi-Catfish-MODQN effectiveness',
      'Catfish-EE',
      'general EE-MODQN superiority',
      'active-TX EE recovery',
      'physical energy saving',
    ],
  },
  evidenceStatus: { kind: 'live-stub', status: 'live', notes: [] },
};
