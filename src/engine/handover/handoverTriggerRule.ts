/**
 * The rule the owner keeps asking for: EE below threshold triggers handover,
 * and nothing else does.
 *
 * SDD `docs/sdd/FRONTEND-AUTHORITY-REFACTOR-SDD.md` §2 F1: this predicate is
 * the boundary gate inside the multi-candidate primary decision lane
 * (`sinrLiveCellModel.ts`). Every proposed commit reaching that lane --
 * whether the upstream selection was `ee-optimization` (SDD F1's one
 * selection-time EE check, `handoverSelectionPolicy.ts`
 * `instantaneousEeTriggerStatus`) or `service-continuity-protection`
 * (`selectServiceContinuityFallback`) -- must satisfy {@link
 * isHandoverEePermitted} before it is allowed to change who is serving.
 *
 * This module does NOT govern the separate SINR-only rail-timeline engine
 * (`handover-manager.ts`). That engine's five commit call sites (SDD F1:
 * lines 221, 265, 319, 345, 389) never import this file and never read an EE
 * value -- they are the other six of F1's seven commit paths, and F2 records
 * that the legacy intra rule among them switches purely on
 * `best.sinrDb > currentSinr`.
 */

export { isEeBelowThreshold } from './eeThreshold';

export interface HandoverEeGateInput {
  /** False only for the very first attach, which is not a handover. */
  readonly hasCurrentServing: boolean;
  /**
   * Precomputed `isEeBelowThreshold(servingEeBitsPerJoule, thresholdBitsPerJoule)`
   * for the currently serving link. Passed in rather than recomputed so a
   * caller that already evaluated it (to decide whether to run the
   * continuity-fallback search) shares the exact same reading.
   */
  readonly servingBelowThreshold: boolean;
  readonly servingEeBitsPerJoule: number | null;
  readonly targetEeBitsPerJoule: number | null;
  readonly thresholdBitsPerJoule: number;
}

/**
 * Whether a proposed commit may take effect.
 *
 * - No current serving link: not a handover, just an admission. The target
 *   only needs to be at or above the floor.
 * - A current serving link: this is a real handover. The serving link must
 *   already be below the floor -- a replacement may not start while service
 *   is still healthy, no matter how good the target looks -- and the target
 *   must be strictly better than the degraded serving link, so the floor can
 *   never select a worse beam.
 */
export function isHandoverEePermitted(input: HandoverEeGateInput): boolean {
  if (!input.hasCurrentServing) {
    return input.targetEeBitsPerJoule !== null
      && Number.isFinite(input.targetEeBitsPerJoule)
      && input.targetEeBitsPerJoule >= input.thresholdBitsPerJoule;
  }
  return input.servingBelowThreshold
    && input.servingEeBitsPerJoule !== null
    && Number.isFinite(input.servingEeBitsPerJoule)
    && input.targetEeBitsPerJoule !== null
    && Number.isFinite(input.targetEeBitsPerJoule)
    && input.targetEeBitsPerJoule > input.servingEeBitsPerJoule;
}
