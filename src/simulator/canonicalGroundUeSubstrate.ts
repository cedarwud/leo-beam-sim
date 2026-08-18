import {
  createCompleteHexBeamLayout,
  type SupportedBeamLayoutCount,
} from '../core/beam/completeHexPresets';

/**
 * Stable identity for the fixed ground population used by complete-ring
 * Visual Lab comparisons.  The identity is deliberately independent of the
 * selected beam layout: changing 1/7/19 changes boresights and associations,
 * not the physical UE population.
 */
export const CANONICAL_GROUND_UE_SUBSTRATE_ID = 'canonical-ground-ue-substrate-v1' as const;

/** The complete-ring substrate is derived from the accepted explicit 7-beam preset. */
export const CANONICAL_GROUND_UE_SUBSTRATE_SOURCE_LAYOUT = 7 as const satisfies SupportedBeamLayoutCount;

/** Number of fixed physical UEs in the complete-ring comparison substrate. */
export const CANONICAL_GROUND_UE_COUNT = 100 as const;

/** Local tangent-plane cell radius retained from the accepted Visual Lab preset. */
export const CANONICAL_GROUND_UE_CELL_RADIUS_KM = 20 as const;

/**
 * Declared safety bound for user-supplied fixed-substrate positions.  It is
 * wide enough for the accepted 19-beam footprint while rejecting accidental
 * world-coordinate or otherwise unbounded inputs.
 */
export const CANONICAL_GROUND_UE_SUBSTRATE_MAX_RADIUS_KM = 100 as const;

const GOLDEN_ANGLE_RADIANS = Math.PI * (3 - Math.sqrt(5));
const LOCAL_USER_RADIUS_FRACTION = 0.7;

export interface CanonicalGroundUe {
  /** Stable zero-based index retained for frame-vector addressing. */
  readonly index: number;
  /** Stable public identity; this does not encode the current serving beam. */
  readonly userId: string;
  /** Position in the local tangent plane, in km. */
  readonly positionKm: readonly [number, number];
  /** Source 7-beam cell retained only as substrate provenance. */
  readonly sourceCellIndex: number;
  /** Source 7-beam cell-local ordinal retained only as substrate provenance. */
  readonly sourceCellLocalIndex: number;
}

export interface CanonicalGroundUeSubstrate {
  readonly substrateId: typeof CANONICAL_GROUND_UE_SUBSTRATE_ID;
  readonly sourceLayoutCount: typeof CANONICAL_GROUND_UE_SUBSTRATE_SOURCE_LAYOUT;
  readonly ueCount: typeof CANONICAL_GROUND_UE_COUNT;
  readonly maxRadiusKm: typeof CANONICAL_GROUND_UE_SUBSTRATE_MAX_RADIUS_KM;
  readonly users: readonly CanonicalGroundUe[];
}

function freeze<T>(value: T): T {
  return Object.freeze(value);
}

function centerForAxial(q: number, r: number): readonly [number, number] {
  return freeze([
    CANONICAL_GROUND_UE_CELL_RADIUS_KM * Math.sqrt(3) * (q + r / 2),
    CANONICAL_GROUND_UE_CELL_RADIUS_KM * 1.5 * r,
  ] as [number, number]);
}

function createDefaultSubstrate(): CanonicalGroundUeSubstrate {
  // The angular/axial order comes from the same complete-ring factory used by
  // canonicalSevenCellScenario.  UV spacing is irrelevant to the local
  // tangent-plane substrate; only the stable axial identities are needed.
  const layout = createCompleteHexBeamLayout({
    satelliteId: 'ground-ue-substrate',
    beamCount: CANONICAL_GROUND_UE_SUBSTRATE_SOURCE_LAYOUT,
    halfPowerBeamWidthDeg: 1,
  });
  const baseUsers = Math.floor(CANONICAL_GROUND_UE_COUNT / layout.beamCount);
  const extraUsers = CANONICAL_GROUND_UE_COUNT % layout.beamCount;
  const users: CanonicalGroundUe[] = [];

  for (const cell of layout.beamPositions) {
    const centerKm = centerForAxial(cell.axialQ, cell.axialR);
    const userCount = baseUsers + (cell.beamId < extraUsers ? 1 : 0);
    for (let cellLocalIndex = 0; cellLocalIndex < userCount; cellLocalIndex += 1) {
      // Keep this operation order aligned with the previously accepted
      // explicit-7 scenario generator so its positions remain bit-identical.
      const radialFraction = cellLocalIndex === 0
        ? 0
        : LOCAL_USER_RADIUS_FRACTION * Math.sqrt(cellLocalIndex / userCount);
      const angle = cellLocalIndex * GOLDEN_ANGLE_RADIANS + cell.beamId * 0.37;
      const positionKm = freeze([
        centerKm[0] + CANONICAL_GROUND_UE_CELL_RADIUS_KM * radialFraction * Math.cos(angle),
        centerKm[1] + CANONICAL_GROUND_UE_CELL_RADIUS_KM * radialFraction * Math.sin(angle),
      ] as [number, number]);
      const index = users.length;
      users.push(freeze({
        index,
        userId: `ue-${index + 1}`,
        positionKm,
        sourceCellIndex: cell.beamId,
        sourceCellLocalIndex: cellLocalIndex,
      }));
    }
  }

  if (users.length !== CANONICAL_GROUND_UE_COUNT) {
    throw new Error(`canonical ground UE substrate must contain ${CANONICAL_GROUND_UE_COUNT} users`);
  }
  return freeze({
    substrateId: CANONICAL_GROUND_UE_SUBSTRATE_ID,
    sourceLayoutCount: CANONICAL_GROUND_UE_SUBSTRATE_SOURCE_LAYOUT,
    ueCount: CANONICAL_GROUND_UE_COUNT,
    maxRadiusKm: CANONICAL_GROUND_UE_SUBSTRATE_MAX_RADIUS_KM,
    users: freeze(users),
  });
}

/** One immutable, deterministic substrate shared by explicit 1/7/19 layouts. */
export const CANONICAL_GROUND_UE_SUBSTRATE = createDefaultSubstrate();
