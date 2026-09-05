/**
 * The one function allowed to answer "what is this link's EE for a handover
 * decision". SDD `docs/sdd/FRONTEND-AUTHORITY-REFACTOR-SDD.md` §2 F3 / §4:
 * `AngleAwareLinkTerms` carries two EE fields that look interchangeable but
 * are not --
 *
 * - `energyEfficiencyBitsPerJoule` (required): measured physics, computed in
 *   `src/engine/signal/link-budget.ts` (`computeAngleAwareEnergyEfficiency`).
 * - `homepageDemoEeBitsPerJoule` (optional): a seeded, rate-limited DISPLAY
 *   animation (`src/engine/handover/homepageDemoEe.ts`) written only by
 *   `SinrLiveCellModel.decorateHomepageDemoEe`. It has no relationship to the
 *   link's real geometry or link budget -- it is bounded to a fixed
 *   [80k,180k] bit/J range and every non-serving candidate is hard-clamped to
 *   `serving - 4000`, by construction, regardless of physics.
 *
 * A decision surface (TTT, selection-hold, the EE floor gate,
 * `InstantaneousEePolicy`) must only ever read the first field. Reading the
 * second here is what F3 documents: it made the floor gate protect a frozen
 * seed value instead of the link's actual state, and made no non-serving
 * candidate able to ever out-score serving regardless of real geometry.
 *
 * Display code (the homepage EE readout, beam color/opacity) is the one
 * legitimate reader of `homepageDemoEeBitsPerJoule` and should keep reading
 * it directly off `AngleAwareLinkTerms` -- SDD §10: authoring the displayed
 * *scenario* is fine, authoring the *decision's* input is not. This module
 * exists only for the decision side.
 */

import type { AngleAwareLinkTerms } from '../signal/types';

/** Real measured EE for a handover decision. Never the display trajectory. */
export function resolveDecisionEeBitsPerJoule(
  angleAware: AngleAwareLinkTerms | undefined,
): number | null {
  const value = angleAware?.energyEfficiencyBitsPerJoule;
  return value !== undefined && Number.isFinite(value) ? value : null;
}
