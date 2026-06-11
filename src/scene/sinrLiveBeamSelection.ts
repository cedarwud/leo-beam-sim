// Consolidation S5 — the ONE shared sinr-live visible-beam resolver.
//
// docs/s5-one-beam-render-plan.md §2: the program's disease is "two serving
// oracles in one viewport" plus a hand-copied REPLICA — the steered-beam mount
// predicate lives inline in MainScene JSX (MainScene.tsx ~1542) and is RE-COPIED
// in connectedSatBeamInvariant.resolveSteeredVisibleBeamSatIds, kept from
// diverging only by QUAR-S5-BEAMRENDER text locks on the JSX. This module is the
// single source: "which satellites have a visible beam this frame" is computed in
// ONE pure function consumed by BOTH the MainScene mount AND the connected-sat
// invariant, so the replica retires and divergence becomes impossible by
// construction (not by a text lock).
//
// S5-1 (this slice): the invariant delegates here; the cone branch is DORMANT
// (nothing passes `coneSatIds` while the cell cones are parked) so it is
// byte-identical to the legacy resolver for every input. S5-2 flips the render
// (showSinrLiveCellBeams) and wires `coneSatIds` from the mounted cell cones into
// BOTH consumers, retiring the inline predicate + the replica together.
//
// Pure module: no React, no THREE — usable headless and from validators.

import type { VizFrame } from './types';

/**
 * The render-plan flags the sinr-live visible-beam resolver depends on (a subset
 * of `SceneLaneRenderPlan`). Defined here, next to the resolver that reads them,
 * and re-exported from `connectedSatBeamInvariant` for back-compat.
 */
export interface SteeredMountPlanFlags {
  readonly showLiveBeamCones: boolean;
  readonly showCellOverlay: boolean;
  readonly showSinrLiveCellBeams: boolean;
}

export interface SinrLiveVisibleBeamInput {
  readonly viz: VizFrame;
  readonly plan: SteeredMountPlanFlags;
  /**
   * The satIds the CELL-CONE render actually mounts a cone for this frame
   * (`new Set(coneItems.map(i => i.satId))`). Read ONLY when
   * `plan.showSinrLiveCellBeams` is true (the cones are the lane's render).
   * Undefined / empty while the cones are parked — the steered branch ignores it,
   * and the cone branch then returns the empty set, exactly matching the legacy
   * resolver (which returned empty whenever the flag was true).
   */
  readonly coneSatIds?: ReadonlySet<string>;
}

/**
 * The ONE shared sinr-live visible-beam resolver (S5 keystone).
 *
 *  - Cone render (`showSinrLiveCellBeams` true — S5-2+): the visible beams ARE the
 *    mounted cell cones, so the visible set is exactly the cones' serving satIds
 *    (`coneSatIds`). A cell-serving sat with no rendered cone is NOT visible —
 *    which is precisely what the connected-sat-has-beam must-hold flip measures.
 *  - Steered render (the current / parked path): the steered `<SatelliteBeams>`
 *    mount predicate — `displaySats ∩ beamSatIds ∩ (satBeams.length > 0)` —
 *    returning the empty set when the steered cones are off (no live beam cones,
 *    or the MODQN cell overlay owns the lane).
 *
 * Byte-identity guarantee (S5-1): with `coneSatIds` undefined this is
 * value-identical to the legacy `resolveSteeredVisibleBeamSatIds` for EVERY input
 * — the flag-true case returns the empty set just as the legacy guard did, and the
 * flag-false branch reproduces the steered predicate exactly.
 */
export function resolveSinrLiveVisibleBeamSatIds(input: SinrLiveVisibleBeamInput): Set<string> {
  const { viz, plan, coneSatIds } = input;
  if (plan.showSinrLiveCellBeams) {
    return new Set(coneSatIds ?? []);
  }
  if (!plan.showLiveBeamCones || plan.showCellOverlay) {
    return new Set();
  }
  const visible = new Set<string>();
  for (const sat of viz.displaySats) {
    if (!viz.beamSatIds.has(sat.id)) continue;
    if ((viz.satBeams.get(sat.id)?.length ?? 0) > 0) visible.add(sat.id);
  }
  return visible;
}
