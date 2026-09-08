// Consolidation S0 — the connected-sat-has-beam BEHAVIOR invariant.
//
// "Every satellite the UI calls connected has a visible beam" — as a TEST, not
// a hope (docs/frontend-consolidation-program.md §3 S0). The 2026-06-10 audit
// found display ranking gating truth renders (top-12 display slice + MAX_BEAM_SATS
// inside useBeamViz), so a UI surface can claim a satellite is serving while no
// beam for it is drawn. This module computes BOTH sides of the invariant from
// the same data the UI consumes, and classifies violations:
//
//   - 'must-hold' violations fail the gate: they are regressions against what
//     the current baseline render actually guarantees.
//   - KNOWN-GAP violations are the audit's documented defects, measured live and
//     reported (never silently passed); each carries the consolidation slice
//     that retires it, at which point its id moves out of KNOWN_GAPS and the
//     claim class becomes must-hold.
//
// Pure module: no React, no THREE — usable headless and from browser gates.

import type { SimFrame, VizFrame } from '../scene/types';
import { deriveSinrServingMosaicAggregate } from '../scene/sinrServingMosaic';
import { resolvePrimaryCellServingSatId } from '../scene/sinrLiveCellModel';
import {
  resolveSinrLiveVisibleBeamSatIds,
  type SteeredMountPlanFlags,
} from '../scene/sinrLiveBeamSelection';

export type { SteeredMountPlanFlags } from '../scene/sinrLiveBeamSelection';

/** Which UI surface claims the satellite is connected/serving. */
export type ConnectedClaimSurface =
  /** InfoPanel ACTIVE SERVING / canvas data-serving-satellite-id (primary UE). */
  | 'primary-serving'
  /** Population served-N/N + beam-load aggregate over all perUePositions (deriveSinrServingMosaicAggregate). */
  | 'population-aggregate'
  /** Earth-fixed cell truth serving beams (sim.sinrLiveCells, S-cells-2/4c). */
  | 'cell-truth-serving';

export interface ConnectedClaim {
  readonly surface: ConnectedClaimSurface;
  readonly satId: string;
}

export interface KnownGapContract {
  /** Consolidation slice that retires the gap (then this class becomes must-hold). */
  readonly retiringSlice: string;
  readonly description: string;
}

export const KNOWN_GAPS: Record<string, KnownGapContract> = {
  // S5-3 RETIRED 2026-06-11 (one beam render): 'population-beyond-display-cap'
  // and 'two-serving-oracles-cell-vs-steered' both flipped to must-hold when the
  // cell-cone layer became the sinr-live lane's mounted render. The cones now
  // beam every serving sat (focus cap retired → draw-all; serving-sat-complete
  // cone-apex map for sats beyond the top-12 display slice), and primary +
  // population + cell-truth all read the one cell oracle (D-ORACLE A,
  // collectConnectedClaims). Their classifyViolation cases now return must-hold;
  // the connected-sat gate ENFORCES 0 of each (positive control: cone-cripple a
  // serving sat → must-hold). See docs/s5-one-beam-render-plan.md §3 S5-3.
  'stale-serving-absent-from-truth-set': {
    retiringSlice: 'S2/S3 (sat identity pipeline + one reset)',
    description:
      'HandoverManager latches a serving satId across a satellite-set rotation; the sat is no longer in frame.satellites, so no beam can exist for it while panels still claim it.',
  },
};

export type ViolationClassification = 'must-hold' | keyof typeof KNOWN_GAPS;

export interface InvariantViolation {
  readonly claim: ConnectedClaim;
  readonly classification: ViolationClassification;
}

export interface InvariantReport {
  /** All distinct (surface, satId) connected claims found in the frame. */
  readonly claims: readonly ConnectedClaim[];
  /**
   * SatIds with at least one visibly mounted beam this frame, from the shared
   * `resolveSinrLiveVisibleBeamSatIds`: on the sinr-live lane (cones mounted,
   * S5-2) this is the cone-rendered set (`coneSatIds`); on the steered
   * lanes it is the steered `<SatelliteBeams>` mount set.
   */
  readonly visibleBeamSatIds: ReadonlySet<string>;
  readonly mustHoldViolations: readonly InvariantViolation[];
  readonly knownGapViolations: readonly InvariantViolation[];
}

/**
 * Collect every satellite the UI currently calls connected, per claim surface,
 * from the SAME pure derivations the UI mounts (not re-implemented logic).
 *
 * The serving ORACLE depends on the lane (S5 D-ORACLE A, s5-one-beam-render-plan
 * §1.4 / §4):
 *
 *  - **Cone lane** (sinr-live — `frame.sinrLiveCells` present): the lane's
 *    rendered beams ARE the earth-fixed cell cones, and the mosaic + published
 *    perUePositions are already re-pointed to the cell model (S4). So ALL THREE
 *    claim surfaces read the cell truth — primary = the primary UE's cell serving
 *    sat, population = every UE's cell serving sat, cell-truth = the serving
 *    illuminated beams. The steered `frame.serving` / `frame.perUePositions` are
 *    the OTHER oracle (the steered render that left this lane in S5-2); sourcing
 *    them here would claim sats the cones never beam and break the must-hold flip.
 *  - **Steered lanes** (no cell truth): primary = `frame.serving`
 *    (InfoPanel / SceneTelemetry), population = `deriveSinrServingMosaicAggregate`
 *    over the steered `perUePositions` — unchanged.
 *
 * NOTE (S5-2b, retired): the InfoPanel "ACTIVE SERVING" label is now re-pointed
 * to this SAME primary cell-truth resolver (`resolvePrimaryCellServingSatId`) in
 * `useSimStatePublisher.buildPublishedPrimaryServing`, so the panel label, the
 * cones, and this must-hold invariant share ONE primary oracle (no more steered
 * label-vs-cone divergence). The coupling is guarded by
 * `validate:s5:infopanel-cone-coupling` (label sat ∈ rendered cone set, MIRROR of
 * this resolver). This invariant still measures the rendered BEAM (cones).
 */
export function collectConnectedClaims(frame: SimFrame): ConnectedClaim[] {
  const claims = new Map<string, ConnectedClaim>();
  const add = (surface: ConnectedClaimSurface, satId: string): void => {
    const key = `${surface}:${satId}`;
    if (!claims.has(key)) claims.set(key, { surface, satId });
  };

  const cellFrame = frame.sinrLiveCells;
  if (cellFrame !== undefined) {
    // Cone lane: one cell-truth oracle for all three claim surfaces. The primary
    // resolution is the SHARED resolvePrimaryCellServingSatId (sinrLiveCellModel)
    // — the SAME source the InfoPanel publisher re-points to (S5-2b), so the
    // panel label, the cones, and this must-hold invariant cannot drift.
    const primaryServingSatId = resolvePrimaryCellServingSatId(cellFrame, frame.perUePositions);
    if (primaryServingSatId !== null) add('primary-serving', primaryServingSatId);
    for (const ue of cellFrame.ues) {
      if (ue.servingSatId !== null) add('population-aggregate', ue.servingSatId);
    }
    for (const beam of cellFrame.illuminatedBeams) {
      if (beam.serving) add('cell-truth-serving', beam.satId);
    }
    return [...claims.values()];
  }

  if (frame.serving.satId !== null) add('primary-serving', frame.serving.satId);

  const aggregate = deriveSinrServingMosaicAggregate(frame.perUePositions);
  for (const load of aggregate.beamLoads) add('population-aggregate', load.satId);

  return [...claims.values()];
}

/**
 * The satIds with a visibly mounted beam this frame, for the invariant's
 * "connected ⟹ visible beam" check. Delegates to the ONE shared resolver
 * `resolveSinrLiveVisibleBeamSatIds` (src/scene/sinrLiveBeamSelection.ts), the
 * single source consumed by BOTH the MainScene mount and this invariant (S5-1
 * retired the former inline REPLICA of the steered-mount predicate).
 *
 * Forwards `coneSatIds` to the shared resolver: on the sinr-live lane
 * (`plan.showSinrLiveCellBeams` true, S5-2) the visible set IS the mounted cones'
 * serving satIds, so a cell-serving sat with no cone fails the must-hold; off
 * that lane (`coneSatIds` undefined) the steered `<SatelliteBeams>` predicate
 * runs unchanged.
 */
export function resolveSteeredVisibleBeamSatIds(
  viz: VizFrame,
  plan: SteeredMountPlanFlags,
  coneSatIds?: ReadonlySet<string>,
): Set<string> {
  return resolveSinrLiveVisibleBeamSatIds({ viz, plan, coneSatIds });
}

function classifyViolation(claim: ConnectedClaim, frame: SimFrame): ViolationClassification {
  switch (claim.surface) {
    case 'primary-serving':
    case 'population-aggregate':
      // S5-3 (one beam render = finish-line): the cell-cone render now beams
      // EVERY serving sat (focus cap retired + serving-sat-complete cone-apex
      // map), so a connected sat with no beam is a real regression, not a
      // display-cap gap. Both primary and population must hold — the only
      // remaining gap is a sat the truth no longer carries (stale latch).
      return frame.satellites.some(sat => sat.id === claim.satId)
        ? 'must-hold'
        : 'stale-serving-absent-from-truth-set';
    case 'cell-truth-serving':
      return 'must-hold';
  }
}

/**
 * Evaluate the invariant for one frame: every connected claim must have a
 * visible beam for its satId, else it is classified must-hold vs known-gap.
 */
export function evaluateConnectedSatBeamInvariant(input: {
  readonly frame: SimFrame;
  readonly viz: VizFrame;
  readonly plan: SteeredMountPlanFlags;
  /**
   * The satIds the cell-cone render mounts a cone for this frame (S5-2). Read
   * only when `plan.showSinrLiveCellBeams` is true (the cones ARE the lane's
   * render); the visible-beam set is then exactly these satIds, so a cell-serving
   * sat with no cone fails the must-hold. Undefined while the cones are parked
   * (steered branch).
   */
  readonly coneSatIds?: ReadonlySet<string>;
}): InvariantReport {
  const claims = collectConnectedClaims(input.frame);
  const visibleBeamSatIds = resolveSteeredVisibleBeamSatIds(input.viz, input.plan, input.coneSatIds);
  const mustHoldViolations: InvariantViolation[] = [];
  const knownGapViolations: InvariantViolation[] = [];

  for (const claim of claims) {
    if (visibleBeamSatIds.has(claim.satId)) continue;
    const classification = classifyViolation(claim, input.frame);
    const violation: InvariantViolation = { claim, classification };
    if (classification === 'must-hold') mustHoldViolations.push(violation);
    else knownGapViolations.push(violation);
  }

  return { claims, visibleBeamSatIds, mustHoldViolations, knownGapViolations };
}
