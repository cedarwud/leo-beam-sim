import type { ClaimBoundaryBannerInput } from '../ui/ClaimBoundaryBanner';

/**
 * P1e follow-up: ClaimBoundaryBanner mount input for the live-sim path.
 *
 * The renderer accepts only the {sceneSource, claimBoundary, evidenceStatus,
 * provenance} subset of NormalizedSceneFrame. On the live-sim path no artifact
 * is loaded, so we feed the banner a static stub that mirrors the live-stub
 * shape emitted by `liveSimToScene` (allowedClaims / forbiddenClaims identical
 * to the producer-validated live boundary). The banner therefore renders in
 * `kind: 'rendered'` mode with the live SINR + derived EE claims and the live
 * forbidden-claim list active. Keep both lists byte-identical to
 * `liveSimToScene`'s — they are the same boundary stated twice.
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
    allowedClaims: [
      'interference-aware SINR (live)',
      'reward-surface r1 EE derived from live SINR (bit/joule)',
      'load-dependent live cell-truth EE readout (bit/joule; not paper reproduction)',
      'Ch5-aligned live U/gamma EE projection (display-only; not paper reproduction)',
    ],
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
