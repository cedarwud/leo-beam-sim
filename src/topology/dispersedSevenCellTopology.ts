/**
 * Shared axial topology for the homepage ground display and the local
 * canonical seven-beam experiment. Only the seven listed cells are active
 * beam/UE targets. The surrounding radius-two cells are a fixed display and
 * experiment substrate, not a TLE or campus-boundary claim.
 */

export const DISPERSED_SEVEN_CELL_LAYOUT_ID = 'dispersed-radius-two-v1' as const;

/**
 * The complete radius-two axial substrate contains 19 cells. Keeping this
 * list beside the active layout prevents the display and canonical scenario
 * from silently drifting to different ground-cell domains.
 */
export const RADIUS_TWO_SUBSTRATE_AXIAL_COORDINATES = Object.freeze([
  Object.freeze({ q: -2, r: 0 }),
  Object.freeze({ q: -2, r: 1 }),
  Object.freeze({ q: -2, r: 2 }),
  Object.freeze({ q: -1, r: -1 }),
  Object.freeze({ q: -1, r: 0 }),
  Object.freeze({ q: -1, r: 1 }),
  Object.freeze({ q: -1, r: 2 }),
  Object.freeze({ q: 0, r: -2 }),
  Object.freeze({ q: 0, r: -1 }),
  Object.freeze({ q: 0, r: 0 }),
  Object.freeze({ q: 0, r: 1 }),
  Object.freeze({ q: 0, r: 2 }),
  Object.freeze({ q: 1, r: -2 }),
  Object.freeze({ q: 1, r: -1 }),
  Object.freeze({ q: 1, r: 0 }),
  Object.freeze({ q: 1, r: 1 }),
  Object.freeze({ q: 2, r: -2 }),
  Object.freeze({ q: 2, r: -1 }),
  Object.freeze({ q: 2, r: 0 }),
] as const);

/**
 * Fixed irregular targets. A radius-two hex disk has only two completely
 * non-adjacent seven-cell selections, and both are regular six-rings around
 * the centre. This layout breaks that ring with one adjacent outer pair,
 * which is the minimum adjacency needed for visible irregularity.
 */
export const DISPERSED_SEVEN_CELL_AXIAL_COORDINATES = Object.freeze([
  Object.freeze({ id: 0 as const, q: 0, r: 0 }),
  Object.freeze({ id: 1 as const, q: 2, r: 0 }),
  Object.freeze({ id: 2 as const, q: 0, r: 2 }),
  Object.freeze({ id: 3 as const, q: -1, r: 2 }),
  Object.freeze({ id: 4 as const, q: -2, r: 1 }),
  Object.freeze({ id: 5 as const, q: 0, r: -2 }),
  Object.freeze({ id: 6 as const, q: 2, r: -2 }),
] as const);

export type DispersedSevenCellId =
  typeof DISPERSED_SEVEN_CELL_AXIAL_COORDINATES[number]['id'];

export interface AxialCoordinate {
  readonly q: number;
  readonly r: number;
}

export function axialHexDistance(
  left: AxialCoordinate,
  right: AxialCoordinate,
): number {
  const dq = left.q - right.q;
  const dr = left.r - right.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

export function isRadiusTwoSubstrateAxialCoordinate(
  coordinate: AxialCoordinate,
): boolean {
  return RADIUS_TWO_SUBSTRATE_AXIAL_COORDINATES.some(
    candidate => candidate.q === coordinate.q && candidate.r === coordinate.r,
  );
}
