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
import {
  resolveSinrLiveVisibleBeamSatIds,
  type SteeredMountPlanFlags,
} from '../scene/sinrLiveBeamSelection';

export type { SteeredMountPlanFlags } from '../scene/sinrLiveBeamSelection';

/** Which UI surface claims the satellite is connected/serving. */
export type ConnectedClaimSurface =
  /** InfoPanel ACTIVE SERVING / canvas data-serving-satellite-id (primary UE). */
  | 'primary-serving'
  /** SinrServingAggregate served-N/N + beam-load rows (all perUePositions). */
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
  'population-beyond-display-cap': {
    retiringSlice: 'S5 (one beam render) — display cap applied at draw, never at truth',
    description:
      'Secondary UEs claim serving sats beyond MAX_BEAM_SATS/top-12, so the aggregate counts beams the steered render never draws (useBeamViz display slice gates truth).',
  },
  'two-serving-oracles-cell-vs-steered': {
    // D1 (s4-one-serving-truth-plan.md §4): S4 unified the cell-side DATA (one
    // cell serving record, pun retired, equivalence gated) but the must-hold
    // flip is RENDER-coupled — with cones parked + the steered render frozen, a
    // cell-serving sat genuinely has no VISIBLE beam — so it lands with S5.
    retiringSlice: 'S5 (one beam render) — flips to must-hold when the cell-cone layer is the lane\'s mounted render',
    description:
      'RENDER-layer divergence: sinr-live cell-side DATA is one serving record (S4), but the rendered beams are still the steered HandoverManager truth with the cell cones parked — a cell-serving sat has no visible beam until S5 mounts the cell-cone render.',
  },
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
   * `resolveSinrLiveVisibleBeamSatIds` (the steered branch while the cell cones
   * are parked; the cone-rendered set once S5 flips the render).
   */
  readonly visibleBeamSatIds: ReadonlySet<string>;
  readonly mustHoldViolations: readonly InvariantViolation[];
  readonly knownGapViolations: readonly InvariantViolation[];
}

/**
 * Collect every satellite the UI currently calls connected, per claim surface,
 * from the SAME pure derivations the UI mounts (not re-implemented logic):
 * primary = frame.serving (InfoPanel / SceneTelemetry), population =
 * deriveSinrServingMosaicAggregate over perUePositions (SinrServingAggregate),
 * cell truth = sinrLiveCells serving illuminated beams (mosaic re-point, 4c).
 */
export function collectConnectedClaims(frame: SimFrame): ConnectedClaim[] {
  const claims = new Map<string, ConnectedClaim>();
  const add = (surface: ConnectedClaimSurface, satId: string): void => {
    const key = `${surface}:${satId}`;
    if (!claims.has(key)) claims.set(key, { surface, satId });
  };

  if (frame.serving.satId !== null) add('primary-serving', frame.serving.satId);

  const aggregate = deriveSinrServingMosaicAggregate(frame.perUePositions);
  for (const load of aggregate.beamLoads) add('population-aggregate', load.satId);

  if (frame.sinrLiveCells) {
    for (const beam of frame.sinrLiveCells.illuminatedBeams) {
      if (beam.serving) add('cell-truth-serving', beam.satId);
    }
  }

  return [...claims.values()];
}

/**
 * The satIds with a visibly mounted beam this frame, for the invariant's
 * "connected ⟹ visible beam" check. S5-1 delegates to the ONE shared resolver
 * `resolveSinrLiveVisibleBeamSatIds` (src/scene/sinrLiveBeamSelection.ts) — the
 * former inline REPLICA of the MainScene steered-mount predicate is retired in
 * favour of the single source consumed by BOTH the mount and this invariant.
 *
 * Byte-identical to the legacy replica while the cell cones are parked: this
 * wrapper passes no `coneSatIds`, so the shared resolver's steered branch runs
 * (and its flag-true case returns the empty set, exactly as the old guard did).
 * S5-2 passes the mounted cones' `coneSatIds` so the invariant measures the cone
 * render once `showSinrLiveCellBeams` flips — that is the D1 must-hold flip.
 */
export function resolveSteeredVisibleBeamSatIds(
  viz: VizFrame,
  plan: SteeredMountPlanFlags,
): Set<string> {
  return resolveSinrLiveVisibleBeamSatIds({ viz, plan });
}

function classifyViolation(claim: ConnectedClaim, frame: SimFrame): ViolationClassification {
  switch (claim.surface) {
    case 'primary-serving':
      return frame.satellites.some(sat => sat.id === claim.satId)
        ? 'must-hold'
        : 'stale-serving-absent-from-truth-set';
    case 'population-aggregate':
      // The primary UE's serving sat is priority-injected into the display set;
      // a missing PRIMARY claim is a must-hold regression even when surfaced
      // through the population aggregate. Secondary-only sats are the audit's
      // display-cap gap.
      return claim.satId === frame.serving.satId && frame.satellites.some(sat => sat.id === claim.satId)
        ? 'must-hold'
        : 'population-beyond-display-cap';
    case 'cell-truth-serving':
      return 'two-serving-oracles-cell-vs-steered';
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
}): InvariantReport {
  const claims = collectConnectedClaims(input.frame);
  const visibleBeamSatIds = resolveSteeredVisibleBeamSatIds(input.viz, input.plan);
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
