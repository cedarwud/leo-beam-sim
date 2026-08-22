/**
 * Display-only ground projection for the archived-TLE homepage centre.
 *
 * The canonical seven-cell frame keeps cell ids 0..6 and its local 20 km
 * experiment geometry for analysis. The homepage display uses a compact,
 * regular seven-cell teaching cluster instead of borrowing positions from the
 * older 37-cell substrate. This module is deliberately pure: it owns neither
 * TLE state nor serving/handover truth.
 */

export const ARCHIVED_TLE_DISPLAY_CELL_IDS = Object.freeze([
  0, 2, 7, 13, 18, 23, 36,
] as const);

export const ARCHIVED_TLE_CANONICAL_CELL_IDS = Object.freeze([
  0, 1, 2, 3, 4, 5, 6,
] as const);

/**
 * Slightly open the regular pointy-hex ring so the renderer's 1.04 outer rim
 * has a visible gap instead of painting across a shared edge.
 */
export const ARCHIVED_TLE_DISPLAY_RING_SPACING = 1.05;

export const ARCHIVED_TLE_DISPLAY_AXIAL_COORDINATES = Object.freeze([
  Object.freeze({ q: 0, r: 0 }),
  Object.freeze({ q: -ARCHIVED_TLE_DISPLAY_RING_SPACING, r: ARCHIVED_TLE_DISPLAY_RING_SPACING }),
  Object.freeze({ q: -ARCHIVED_TLE_DISPLAY_RING_SPACING, r: 0 }),
  Object.freeze({ q: 0, r: -ARCHIVED_TLE_DISPLAY_RING_SPACING }),
  Object.freeze({ q: ARCHIVED_TLE_DISPLAY_RING_SPACING, r: -ARCHIVED_TLE_DISPLAY_RING_SPACING }),
  Object.freeze({ q: 0, r: ARCHIVED_TLE_DISPLAY_RING_SPACING }),
  Object.freeze({ q: ARCHIVED_TLE_DISPLAY_RING_SPACING, r: 0 }),
] as const);

export const ARCHIVED_TLE_NTPU_GROUND_BOUNDS_KM = Object.freeze({
  widthKm: 200,
  // NTPU.glb's measured 1375.866516 x 918.623901 Wu bounds converted through
  // the 200 km-wide scene scale. The 90 km paper rectangle is an inscribed
  // analysis area, not the full campus ground mesh that must contain this view.
  heightKm: 133.53386979293273,
});

/** The outer footprint ring is slightly wider than the cone base radius. */
export const ARCHIVED_TLE_FOOTPRINT_EXTENT_SCALE = 1.04;
/** Keep the display-only footprint just inside the configured scene bounds. */
export const ARCHIVED_TLE_GROUND_PADDING_KM = 1;

export interface ArchivedTleCanonicalCellLike {
  readonly index: number;
  readonly centerKm: readonly [number, number];
}

export interface ArchivedTleCanonicalUserLike {
  readonly index: number;
  readonly cellIndex: number;
  readonly positionKm: readonly [number, number];
}

export interface ArchivedTleDisplayCellPlacement {
  /** Canonical frame id retained by serving/candidate truth. */
  readonly canonicalCellId: number;
  /** ID in the historical 37-cell substrate used to derive this position. */
  readonly displayCellId: number;
  readonly q: number;
  readonly r: number;
  readonly canonicalCenterKm: readonly [number, number];
  readonly centerKm: readonly [number, number];
  readonly radiusKm: number;
}

export interface ArchivedTleSevenCellPlacement {
  /** Uniform local-offset scale from canonical cells into the scene layout. */
  readonly fitScale: number;
  readonly sourceCellRadiusKm: number;
  readonly boundsKm: {
    readonly widthKm: number;
    readonly heightKm: number;
  };
  readonly cells: readonly ArchivedTleDisplayCellPlacement[];
  readonly cellByCanonicalId: ReadonlyMap<number, ArchivedTleDisplayCellPlacement>;
}

export interface BuildArchivedTleSevenCellPlacementOptions {
  readonly cells: readonly ArchivedTleCanonicalCellLike[];
  readonly sourceCellRadiusKm: number;
  readonly boundsKm?: {
    readonly widthKm: number;
    readonly heightKm: number;
  };
  readonly paddingKm?: number;
}

function assertFinitePositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive finite number`);
  }
}

function axialCenterKm(
  q: number,
  r: number,
  radiusKm: number,
): readonly [number, number] {
  return [
    radiusKm * Math.sqrt(3) * (q + r / 2),
    radiusKm * 1.5 * r,
  ] as const;
}

function validateCells(cells: readonly ArchivedTleCanonicalCellLike[]): void {
  if (cells.length !== ARCHIVED_TLE_DISPLAY_CELL_IDS.length) {
    throw new RangeError(`archived TLE display placement requires ${ARCHIVED_TLE_DISPLAY_CELL_IDS.length} canonical cells`);
  }
  const ids = new Set<number>();
  for (const cell of cells) {
    if (!Number.isInteger(cell.index) || ids.has(cell.index)) {
      throw new RangeError('archived TLE display placement canonical cell ids must be unique integers');
    }
    if (!Number.isFinite(cell.centerKm[0]) || !Number.isFinite(cell.centerKm[1])) {
      throw new RangeError(`archived TLE display placement cell ${cell.index} center must be finite`);
    }
    ids.add(cell.index);
  }
  for (const cellId of ARCHIVED_TLE_CANONICAL_CELL_IDS) {
    if (!ids.has(cellId)) {
      throw new RangeError(`archived TLE display placement missing canonical cell ${cellId}`);
    }
  }
}

/**
 * Build one immutable mapping shared by archived adapter beam targets, cell
 * cones/footprints, and display UE positions.
 */
export function buildArchivedTleSevenCellPlacement(
  options: BuildArchivedTleSevenCellPlacementOptions,
): ArchivedTleSevenCellPlacement {
  const boundsKm = options.boundsKm ?? ARCHIVED_TLE_NTPU_GROUND_BOUNDS_KM;
  const paddingKm = options.paddingKm ?? ARCHIVED_TLE_GROUND_PADDING_KM;
  validateCells(options.cells);
  assertFinitePositive(options.sourceCellRadiusKm, 'sourceCellRadiusKm');
  assertFinitePositive(boundsKm.widthKm, 'boundsKm.widthKm');
  assertFinitePositive(boundsKm.heightKm, 'boundsKm.heightKm');
  if (!Number.isFinite(paddingKm) || paddingKm < 0) {
    throw new RangeError('paddingKm must be a non-negative finite number');
  }
  if (boundsKm.widthKm <= paddingKm * 2 || boundsKm.heightKm <= paddingKm * 2) {
    throw new RangeError('display bounds must exceed twice the padding');
  }

  const rawCenters = ARCHIVED_TLE_DISPLAY_AXIAL_COORDINATES.map(({ q, r }, index) => ({
    q,
    r,
    centerKm: axialCenterKm(q, r, options.sourceCellRadiusKm),
  }));
  const maxCenterAbsX = Math.max(...rawCenters.map(({ centerKm }) => Math.abs(centerKm[0])));
  const maxCenterAbsY = Math.max(...rawCenters.map(({ centerKm }) => Math.abs(centerKm[1])));
  const maxFootprintAbsX = maxCenterAbsX
    + options.sourceCellRadiusKm * ARCHIVED_TLE_FOOTPRINT_EXTENT_SCALE;
  const maxFootprintAbsY = maxCenterAbsY
    + options.sourceCellRadiusKm * ARCHIVED_TLE_FOOTPRINT_EXTENT_SCALE;
  const fitScale = Math.min(
    1,
    (boundsKm.widthKm / 2 - paddingKm) / maxFootprintAbsX,
    (boundsKm.heightKm / 2 - paddingKm) / maxFootprintAbsY,
  );
  if (!Number.isFinite(fitScale) || fitScale <= 0) {
    throw new RangeError('archived TLE display placement cannot fit within the supplied bounds');
  }

  const canonicalById = new Map(options.cells.map(cell => [cell.index, cell]));
  const cells = rawCenters.map(({ q, r, centerKm }, index) => {
    const canonicalCellId = ARCHIVED_TLE_CANONICAL_CELL_IDS[index]!;
    const canonicalCell = canonicalById.get(canonicalCellId);
    if (canonicalCell === undefined) {
      throw new RangeError(`archived TLE display placement missing canonical cell ${canonicalCellId}`);
    }
    return Object.freeze({
      canonicalCellId,
      displayCellId: ARCHIVED_TLE_DISPLAY_CELL_IDS[index]!,
      q,
      r,
      canonicalCenterKm: Object.freeze([
        canonicalCell.centerKm[0],
        canonicalCell.centerKm[1],
      ] as [number, number]),
      centerKm: Object.freeze([
        centerKm[0] * fitScale,
        centerKm[1] * fitScale,
      ] as [number, number]),
      radiusKm: options.sourceCellRadiusKm * fitScale,
    });
  });

  return Object.freeze({
    fitScale,
    sourceCellRadiusKm: options.sourceCellRadiusKm,
    boundsKm: Object.freeze({ widthKm: boundsKm.widthKm, heightKm: boundsKm.heightKm }),
    cells: Object.freeze(cells),
    cellByCanonicalId: new Map(cells.map(cell => [cell.canonicalCellId, cell])),
  });
}

/** Remap a canonical UE's local offset into its selected display cell. */
export function remapArchivedTleUePosition(
  placement: ArchivedTleSevenCellPlacement,
  user: ArchivedTleCanonicalUserLike,
): readonly [number, number] {
  const cell = placement.cellByCanonicalId.get(user.cellIndex);
  if (cell === undefined) {
    throw new RangeError(`archived TLE display placement missing UE ${user.index} cell ${user.cellIndex}`);
  }
  const localEastKm = user.positionKm[0] - cell.canonicalCenterKm[0];
  const localNorthKm = user.positionKm[1] - cell.canonicalCenterKm[1];
  return Object.freeze([
    cell.centerKm[0] + localEastKm * placement.fitScale,
    cell.centerKm[1] + localNorthKm * placement.fitScale,
  ] as [number, number]);
}
