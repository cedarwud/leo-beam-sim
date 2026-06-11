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
    retiringSlice: 'S4 (one serving truth per lane)',
    description:
      'sinr-live runs TWO serving oracles: mosaic/aggregate read the cell truth while the rendered beams are the steered HandoverManager truth — cell-serving sats need not match beamed sats.',
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
  /** SatIds with at least one visibly mounted steered beam (MainScene replica). */
  readonly visibleBeamSatIds: ReadonlySet<string>;
  readonly mustHoldViolations: readonly InvariantViolation[];
  readonly knownGapViolations: readonly InvariantViolation[];
}

/** The render-plan flags the steered mount predicate depends on. */
export interface SteeredMountPlanFlags {
  readonly showLiveBeamCones: boolean;
  readonly showCellOverlay: boolean;
  readonly showSinrLiveCellBeams: boolean;
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
 * REPLICA of the MainScene steered-beam mount predicate (MainScene.tsx ~1538):
 *   SHOW_BEAMS && showLiveBeamCones && !showCellOverlay && !showSinrLiveCellBeams
 *   && viz.displaySats.filter(sat => viz.beamSatIds.has(sat.id))
 *   && (viz.satBeams.get(sat.id) ?? []).length > 0
 * Replicated (not imported) because the predicate currently lives inline in
 * MainScene JSX; S5/S6 extract it to a shared resolver consumed by BOTH the
 * mount and this invariant, retiring the replica. Until then the governance
 * QUAR-S5-BEAMRENDER text locks pin the JSX so the replica cannot silently
 * diverge from the mount.
 */
export function resolveSteeredVisibleBeamSatIds(
  viz: VizFrame,
  plan: SteeredMountPlanFlags,
): Set<string> {
  if (!plan.showLiveBeamCones || plan.showCellOverlay || plan.showSinrLiveCellBeams) {
    return new Set();
  }
  const visible = new Set<string>();
  for (const sat of viz.displaySats) {
    if (!viz.beamSatIds.has(sat.id)) continue;
    if ((viz.satBeams.get(sat.id)?.length ?? 0) > 0) visible.add(sat.id);
  }
  return visible;
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
