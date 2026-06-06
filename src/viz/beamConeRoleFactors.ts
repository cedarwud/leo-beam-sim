/**
 * Pure per-handover-role visual factors for BeamCone (P4 extraction, 2026-06-06).
 *
 * The BeamCone component (src/viz/SatelliteBeams.tsx) used to pick these
 * handover-role magic numbers inline at ~9 scattered JSX sites with repeated
 * `(isHandoverTarget ? A : isHandoverSource ? B : C)` ternaries — the
 * render-layer architecture audit flagged that scatter. They are collected here
 * as one pure, unit-tested function so a future per-role visual change is a
 * single edit. The values are BYTE-IDENTICAL to the prior inline expressions;
 * the final opacity/line-width arithmetic (loadIntensity / dimFactor / the
 * handover*Scale runtime composition + clampOpacity) stays at the JSX, since this
 * is policy (which role gets which factor), not runtime composition.
 */
export interface BeamConeRoleFactors {
  /** Inner ring-arc opacity multiplier — target gets a slight emphasis. */
  readonly innerArcMul: number;
  /** Ground disc ring opacity multiplier — the handover source is dimmed. */
  readonly groundDiscMul: number;
  /** Mid ring opacity multiplier. */
  readonly midRingMul: number;
  /** Added halo line width. */
  readonly haloLineWidthAdd: number;
  /** Halo line base opacity (before dim + line scale). */
  readonly haloLineOpacityBase: number;
  /** Added core line width. */
  readonly coreLineWidthAdd: number;
  /** Endpoint + glyph ring opacity multiplier. */
  readonly endpointMul: number;
  /** Added outer radius for the handover-role ring. */
  readonly roleRingOuterAdd: number;
}

export function resolveBeamConeRoleFactors(
  isHandoverSource: boolean,
  isHandoverTarget: boolean,
): BeamConeRoleFactors {
  return {
    innerArcMul: isHandoverTarget ? 1.1 : 1,
    groundDiscMul: isHandoverSource ? 0.62 : 1,
    midRingMul: isHandoverTarget ? 1.08 : isHandoverSource ? 0.52 : 1,
    haloLineWidthAdd: isHandoverTarget ? 8.2 : 3.2,
    haloLineOpacityBase: isHandoverTarget ? 0.58 : isHandoverSource ? 0.36 : 0.24,
    coreLineWidthAdd: isHandoverTarget ? 2.8 : isHandoverSource ? 0.5 : 0,
    endpointMul: isHandoverTarget ? 1.18 : isHandoverSource ? 0.58 : 1,
    roleRingOuterAdd: isHandoverTarget ? 7.2 : 4.8,
  };
}
