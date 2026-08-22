import { DISPERSED_SEVEN_CELL_USER_COUNTS } from '../../topology/dispersedSevenCellTopology';

export interface UePosition {
  id: string;
  groundX: number;
  groundZ: number;
  eastKm: number;
  northKm: number;
}

export type UeDistributionMode = 'random' | 'grid' | 'clustered' | 'seven-cell-asymmetric';
export type UePrimaryAnchorMode = 'observer' | 'distribution';

export interface UeRectangleAreaKm {
  widthKm: number;
  heightKm: number;
}

export interface UeDistributionCellCenterKm {
  readonly eastKm: number;
  readonly northKm: number;
}

const SEVEN_CELL_SCATTER = [
  { east: 0.1, north: -0.08, stretchEast: 1, stretchNorth: 0.72, turn: 0.18 },
  { east: -0.12, north: 0.05, stretchEast: 0.78, stretchNorth: 1, turn: 0.76 },
  { east: 0.03, north: 0.13, stretchEast: 1, stretchNorth: 0.82, turn: 1.31 },
  { east: 0.14, north: 0.02, stretchEast: 0.84, stretchNorth: 1, turn: 2.04 },
  { east: -0.06, north: -0.14, stretchEast: 1, stretchNorth: 0.76, turn: 2.63 },
  { east: -0.14, north: -0.03, stretchEast: 0.8, stretchNorth: 1, turn: 3.42 },
  { east: 0.07, north: 0.1, stretchEast: 1, stretchNorth: 0.8, turn: 4.17 },
] as const;

function allocateWeightedUeCounts(ueCount: number, cellCount: number): number[] {
  // Preserve the established asymmetric seven-cell population. The 1-cell and
  // 19-cell scene presets are intentionally even: the former concentrates all
  // UEs into one cell, while the latter makes every scene cell visible.
  const weights = cellCount === DISPERSED_SEVEN_CELL_USER_COUNTS.length
    ? DISPERSED_SEVEN_CELL_USER_COUNTS
    : Array.from({ length: cellCount }, () => 1);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const exact = weights.map(weight => ueCount * weight / totalWeight);
  const counts = exact.map(Math.floor);
  let remaining = ueCount - counts.reduce((sum, value) => sum + value, 0);
  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index);
  for (let index = 0; remaining > 0; index = (index + 1) % order.length) {
    counts[order[index].index] += 1;
    remaining -= 1;
  }
  return counts;
}

function resolveCellScatterShape(cellIndex: number, cellCount: number): {
  east: number;
  north: number;
  stretchEast: number;
  stretchNorth: number;
  turn: number;
} {
  if (cellCount === SEVEN_CELL_SCATTER.length) {
    return SEVEN_CELL_SCATTER[cellIndex];
  }
  const turn = (cellIndex * Math.PI * (3 - Math.sqrt(5))) % (2 * Math.PI);
  return {
    east: 0,
    north: 0,
    stretchEast: 1,
    stretchNorth: 1,
    turn,
  };
}

function generateCellDistributedUePositions(params: {
  readonly ueCount: number;
  readonly primary: UePosition;
  readonly primaryAnchorMode: UePrimaryAnchorMode;
  readonly cellCentersKm: readonly UeDistributionCellCenterKm[];
  readonly cellRadiusKm: number;
  readonly ueWorldScale: number;
  readonly seed: number;
}): UePosition[] | null {
  if (params.cellCentersKm.length === 0 || !Number.isFinite(params.cellRadiusKm) || params.cellRadiusKm <= 0) {
    return null;
  }
  const allCenters = params.cellCentersKm;
  const counts = allocateWeightedUeCounts(params.ueCount, allCenters.length);
  const positions: UePosition[] = [];
  const rng = createSeededRng(params.seed);
  const anchorPrimary = params.primaryAnchorMode === 'observer';
  if (anchorPrimary) {
    positions.push(params.primary);
    counts[0] = Math.max(0, counts[0] - 1);
  }

  for (let cellIndex = 0; cellIndex < allCenters.length; cellIndex += 1) {
    const center = allCenters[cellIndex];
    const shape = resolveCellScatterShape(cellIndex, allCenters.length);
    const cosTurn = Math.cos(shape.turn);
    const sinTurn = Math.sin(shape.turn);
    for (let slot = 0; slot < counts[cellIndex]; slot += 1) {
      const radius = Math.sqrt(rng()) * params.cellRadiusKm * 0.5;
      const angle = rng() * 2 * Math.PI;
      const localEast = radius * Math.cos(angle) * shape.stretchEast;
      const localNorth = radius * Math.sin(angle) * shape.stretchNorth;
      const rotatedEast = localEast * cosTurn - localNorth * sinTurn;
      const rotatedNorth = localEast * sinTurn + localNorth * cosTurn;
      positions.push(createUePosition(
        positions.length,
        center.eastKm + rotatedEast + shape.east * params.cellRadiusKm,
        center.northKm + rotatedNorth + shape.north * params.cellRadiusKm,
        params.ueWorldScale,
      ));
    }
  }
  return positions;
}

export function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createUePosition(index: number, eastKm: number, northKm: number, ueWorldScale: number): UePosition {
  return {
    id: `live-ue-${index}`,
    groundX: eastKm * ueWorldScale,
    groundZ: -northKm * ueWorldScale,
    eastKm,
    northKm,
  };
}

function isValidRectangleArea(area: UeRectangleAreaKm | undefined): area is UeRectangleAreaKm {
  return area !== undefined
    && Number.isFinite(area.widthKm)
    && Number.isFinite(area.heightKm)
    && area.widthKm > 0
    && area.heightKm > 0;
}

function clampToRectangle(
  eastKm: number,
  northKm: number,
  centerEastKm: number,
  centerNorthKm: number,
  area: UeRectangleAreaKm,
): { eastKm: number; northKm: number } {
  const halfWidthKm = area.widthKm / 2;
  const halfHeightKm = area.heightKm / 2;
  return {
    eastKm: Math.min(
      centerEastKm + halfWidthKm,
      Math.max(centerEastKm - halfWidthKm, eastKm),
    ),
    northKm: Math.min(
      centerNorthKm + halfHeightKm,
      Math.max(centerNorthKm - halfHeightKm, northKm),
    ),
  };
}

function generateRandomRectangleUePositions(params: {
  ueCount: number;
  primary: UePosition;
  primaryAnchorMode: UePrimaryAnchorMode;
  centerEastKm: number;
  centerNorthKm: number;
  area: UeRectangleAreaKm;
  ueWorldScale: number;
  seed: number;
}): UePosition[] {
  const {
    ueCount,
    primary,
    primaryAnchorMode,
    centerEastKm,
    centerNorthKm,
    area,
    ueWorldScale,
    seed,
  } = params;
  const rng = createSeededRng(seed);
  const anchorPrimary = primaryAnchorMode === 'observer';
  const positions: UePosition[] = anchorPrimary ? [primary] : [];

  // Source: modqn-paper-reproduction/src/modqn_paper_reproduction/env/step.py
  // _generate_user_positions(... distribution="uniform-rectangle", width_km, height_km)
  // with ASSUME-MODQN-REP-022's 200 km x 90 km area. SINR keeps slot 0 as the
  // live observer anchor; MODQN can render slot 0 from the distribution so
  // display layout follows the training UE area instead of display needs.
  for (let i = anchorPrimary ? 1 : 0; i < ueCount; i += 1) {
    const eastKm = centerEastKm + (rng() - 0.5) * area.widthKm;
    const northKm = centerNorthKm + (rng() - 0.5) * area.heightKm;
    positions.push(createUePosition(i, eastKm, northKm, ueWorldScale));
  }

  return positions;
}

function generateGridRectangleUePositions(params: {
  ueCount: number;
  primary: UePosition;
  centerEastKm: number;
  centerNorthKm: number;
  area: UeRectangleAreaKm;
  ueWorldScale: number;
}): UePosition[] {
  const {
    ueCount,
    primary,
    centerEastKm,
    centerNorthKm,
    area,
    ueWorldScale,
  } = params;
  const positions: UePosition[] = [primary];
  if (ueCount === 1) return positions;

  const aspect = area.widthKm / area.heightKm;
  const cols = Math.max(1, Math.ceil(Math.sqrt((ueCount - 1) * aspect)));
  const rows = Math.max(1, Math.ceil((ueCount - 1) / cols));
  const eastStepKm = cols === 1 ? 0 : area.widthKm / (cols - 1);
  const northStepKm = rows === 1 ? 0 : area.heightKm / (rows - 1);

  for (let i = 1; i < ueCount; i += 1) {
    const slot = i - 1;
    const row = Math.floor(slot / cols);
    const col = slot % cols;
    const eastKm = centerEastKm - area.widthKm / 2 + col * eastStepKm;
    const northKm = centerNorthKm - area.heightKm / 2 + row * northStepKm;
    positions.push(createUePosition(i, eastKm, northKm, ueWorldScale));
  }

  return positions;
}

function generateClusteredRectangleUePositions(params: {
  ueCount: number;
  primary: UePosition;
  centerEastKm: number;
  centerNorthKm: number;
  area: UeRectangleAreaKm;
  ueWorldScale: number;
  seed: number;
}): UePosition[] {
  const {
    ueCount,
    primary,
    centerEastKm,
    centerNorthKm,
    area,
    ueWorldScale,
    seed,
  } = params;
  const positions: UePosition[] = [primary];
  if (ueCount === 1) return positions;

  const rng = createSeededRng(seed);
  const clusterCount = Math.max(1, Math.ceil(Math.sqrt(ueCount)));
  const clusterSize = Math.ceil(ueCount / clusterCount);
  const clusterRadiusKm = Math.min(area.widthKm, area.heightKm) / (4 * Math.sqrt(clusterCount));
  const centers = Array.from({ length: clusterCount }, (_, index) => {
    if (index === 0) return { eastKm: centerEastKm, northKm: centerNorthKm };
    return {
      eastKm: centerEastKm + (rng() - 0.5) * area.widthKm,
      northKm: centerNorthKm + (rng() - 0.5) * area.heightKm,
    };
  });

  for (let i = 1; i < ueCount; i += 1) {
    const clusterIndex = Math.min(clusterCount - 1, Math.floor(i / clusterSize));
    const center = centers[clusterIndex];
    const scatterR = Math.sqrt(rng()) * clusterRadiusKm;
    const scatterTheta = rng() * 2 * Math.PI;
    const clamped = clampToRectangle(
      center.eastKm + scatterR * Math.cos(scatterTheta),
      center.northKm + scatterR * Math.sin(scatterTheta),
      centerEastKm,
      centerNorthKm,
      area,
    );
    positions.push(createUePosition(i, clamped.eastKm, clamped.northKm, ueWorldScale));
  }

  return positions;
}

function generateRandomUePositions(params: {
  ueCount: number;
  primary: UePosition;
  primaryAnchorMode: UePrimaryAnchorMode;
  primaryEastKm: number;
  primaryNorthKm: number;
  primaryFootprintRadiusKm: number;
  ueWorldScale: number;
  seed: number;
}): UePosition[] {
  const {
    ueCount,
    primary,
    primaryAnchorMode,
    primaryEastKm,
    primaryNorthKm,
    primaryFootprintRadiusKm,
    ueWorldScale,
    seed,
  } = params;
  const rng = createSeededRng(seed);
  const radiusKm = Math.max(0, primaryFootprintRadiusKm);
  const anchorPrimary = primaryAnchorMode === 'observer';
  const positions: UePosition[] = anchorPrimary ? [primary] : [];

  for (let i = anchorPrimary ? 1 : 0; i < ueCount; i += 1) {
    const r = Math.sqrt(rng()) * radiusKm;
    const theta = rng() * 2 * Math.PI;
    const eastKm = primaryEastKm + r * Math.cos(theta);
    const northKm = primaryNorthKm + r * Math.sin(theta);
    positions.push(createUePosition(i, eastKm, northKm, ueWorldScale));
  }

  return positions;
}

function generateGridUePositions(params: {
  ueCount: number;
  primary: UePosition;
  primaryEastKm: number;
  primaryNorthKm: number;
  primaryFootprintRadiusKm: number;
  ueWorldScale: number;
}): UePosition[] {
  const {
    ueCount,
    primary,
    primaryEastKm,
    primaryNorthKm,
    primaryFootprintRadiusKm,
    ueWorldScale,
  } = params;
  const radiusKm = Math.max(0, primaryFootprintRadiusKm);
  const positions: UePosition[] = [primary];
  if (ueCount === 1) return positions;
  if (radiusKm === 0) {
    return Array.from({ length: ueCount }, (_, index) => (
      index === 0 ? primary : createUePosition(index, primaryEastKm, primaryNorthKm, ueWorldScale)
    ));
  }

  let spacingKm = radiusKm / Math.max(1, Math.ceil(Math.sqrt(ueCount)));
  let candidates: Array<{ eastOffsetKm: number; northOffsetKm: number; radiusKm: number }> = [];

  while (candidates.length < ueCount - 1) {
    const maxCoord = Math.ceil(radiusKm / spacingKm) + 2;
    candidates = [];
    for (let row = -maxCoord; row <= maxCoord; row += 1) {
      for (let col = -maxCoord; col <= maxCoord; col += 1) {
        const eastOffsetKm = spacingKm * (col + row / 2);
        const northOffsetKm = spacingKm * (Math.sqrt(3) / 2) * row;
        const pointRadiusKm = Math.hypot(eastOffsetKm, northOffsetKm);
        if (pointRadiusKm > 1e-9 && pointRadiusKm <= radiusKm + 1e-9) {
          candidates.push({ eastOffsetKm, northOffsetKm, radiusKm: pointRadiusKm });
        }
      }
    }
    spacingKm /= 2;
  }

  candidates.sort((left, right) => (
    left.radiusKm - right.radiusKm
    || left.northOffsetKm - right.northOffsetKm
    || left.eastOffsetKm - right.eastOffsetKm
  ));

  for (let i = 1; i < ueCount; i += 1) {
    const candidate = candidates[i - 1];
    positions.push(createUePosition(
      i,
      primaryEastKm + candidate.eastOffsetKm,
      primaryNorthKm + candidate.northOffsetKm,
      ueWorldScale,
    ));
  }

  return positions;
}

function generateClusteredUePositions(params: {
  ueCount: number;
  primary: UePosition;
  primaryEastKm: number;
  primaryNorthKm: number;
  primaryFootprintRadiusKm: number;
  ueWorldScale: number;
  seed: number;
}): UePosition[] {
  const {
    ueCount,
    primary,
    primaryEastKm,
    primaryNorthKm,
    primaryFootprintRadiusKm,
    ueWorldScale,
    seed,
  } = params;
  const radiusKm = Math.max(0, primaryFootprintRadiusKm);
  const positions: UePosition[] = [primary];
  if (ueCount === 1) return positions;
  if (radiusKm === 0) {
    return Array.from({ length: ueCount }, (_, index) => (
      index === 0 ? primary : createUePosition(index, primaryEastKm, primaryNorthKm, ueWorldScale)
    ));
  }

  const rng = createSeededRng(seed);
  const clusterCount = Math.ceil(Math.sqrt(ueCount));
  const clusterSize = Math.ceil(ueCount / clusterCount);
  const clusterRadiusKm = radiusKm / (2 * Math.sqrt(clusterCount));
  const centerRadiusKm = Math.max(0, radiusKm - clusterRadiusKm);
  const centers = [{ eastOffsetKm: 0, northOffsetKm: 0 }];

  for (let clusterIndex = 1; clusterIndex < clusterCount; clusterIndex += 1) {
    const centerR = Math.sqrt(rng()) * centerRadiusKm;
    const centerTheta = rng() * 2 * Math.PI;
    centers.push({
      eastOffsetKm: centerR * Math.cos(centerTheta),
      northOffsetKm: centerR * Math.sin(centerTheta),
    });
  }

  // The primary UE occupies slot 0 in cluster 0 so it can remain fixed at the
  // observer point while preserving ceil(N/M) slot buckets for the secondaries.
  for (let i = 1; i < ueCount; i += 1) {
    const clusterIndex = Math.min(clusterCount - 1, Math.floor(i / clusterSize));
    const center = centers[clusterIndex];
    const scatterR = Math.sqrt(rng()) * clusterRadiusKm;
    const scatterTheta = rng() * 2 * Math.PI;
    const eastKm = primaryEastKm + center.eastOffsetKm + scatterR * Math.cos(scatterTheta);
    const northKm = primaryNorthKm + center.northOffsetKm + scatterR * Math.sin(scatterTheta);
    positions.push(createUePosition(i, eastKm, northKm, ueWorldScale));
  }

  return positions;
}

function generateUePositionsForField(params: {
  ueCount: number;
  primaryEastKm: number;
  primaryNorthKm: number;
  primaryFootprintRadiusKm: number;
  ueWorldScale: number;
  seed?: number;
  mode?: UeDistributionMode;
  primaryAnchorMode?: UePrimaryAnchorMode;
  rectangleAreaKm?: UeRectangleAreaKm;
  /** Exact scene-cell centres used by the live scene-cell distribution preset. */
  cellCentersKm?: readonly UeDistributionCellCenterKm[];
  cellRadiusKm?: number;
  /**
   * Demo intra-handover trigger: an ENU offset (km) applied ONLY to the primary
   * (index 0) UE — it slides to an adjacent beam cell so the engine genuinely does
   * an intra (same-sat beam switch). The secondary distribution stays centred on
   * `primaryEastKm` (this offset is NOT added to the field centre), so only the
   * protagonist jogs. Default 0 = no jog.
   */
  primaryJogEastKm?: number;
  primaryJogNorthKm?: number;
}): UePosition[] {
  const {
    primaryEastKm,
    primaryNorthKm,
    primaryFootprintRadiusKm,
    ueWorldScale,
    seed = 42,
    mode = 'random',
    primaryAnchorMode = 'observer',
    rectangleAreaKm,
    primaryJogEastKm = 0,
    primaryJogNorthKm = 0,
    cellCentersKm,
    cellRadiusKm = primaryFootprintRadiusKm,
  } = params;
  const ueCount = Math.max(1, Math.trunc(params.ueCount));
  const primary = createUePosition(
    0,
    primaryEastKm + primaryJogEastKm,
    primaryNorthKm + primaryJogNorthKm,
    ueWorldScale,
  );

  if (ueCount === 1 && primaryAnchorMode === 'observer') {
    return [primary];
  }

  if (mode === 'seven-cell-asymmetric' && cellCentersKm !== undefined) {
    const positions = generateCellDistributedUePositions({
      ueCount,
      primary,
      primaryAnchorMode,
      cellCentersKm,
      cellRadiusKm,
      ueWorldScale,
      seed,
    });
    if (positions !== null) return positions;
  }

  if (isValidRectangleArea(rectangleAreaKm)) {
    switch (mode) {
      case 'grid':
        return generateGridRectangleUePositions({
          ueCount,
          primary,
          centerEastKm: primaryEastKm,
          centerNorthKm: primaryNorthKm,
          area: rectangleAreaKm,
          ueWorldScale,
        });
      case 'clustered':
        return generateClusteredRectangleUePositions({
          ueCount,
          primary,
          centerEastKm: primaryEastKm,
          centerNorthKm: primaryNorthKm,
          area: rectangleAreaKm,
          ueWorldScale,
          seed,
        });
      case 'random':
        return generateRandomRectangleUePositions({
          ueCount,
          primary,
          primaryAnchorMode,
          centerEastKm: primaryEastKm,
          centerNorthKm: primaryNorthKm,
          area: rectangleAreaKm,
          ueWorldScale,
          seed,
        });
      case 'seven-cell-asymmetric':
        return generateClusteredRectangleUePositions({
          ueCount,
          primary,
          centerEastKm: primaryEastKm,
          centerNorthKm: primaryNorthKm,
          area: rectangleAreaKm,
          ueWorldScale,
          seed,
        });
    }
  }

  switch (mode) {
    case 'grid':
      return generateGridUePositions({
        ueCount,
        primary,
        primaryEastKm,
        primaryNorthKm,
        primaryFootprintRadiusKm,
        ueWorldScale,
      });
    case 'clustered':
      return generateClusteredUePositions({
        ueCount,
        primary,
        primaryEastKm,
        primaryNorthKm,
        primaryFootprintRadiusKm,
        ueWorldScale,
        seed,
      });
    case 'random':
      return generateRandomUePositions({
        ueCount,
        primary,
        primaryAnchorMode,
        primaryEastKm,
        primaryNorthKm,
        primaryFootprintRadiusKm,
        ueWorldScale,
        seed,
      });
    case 'seven-cell-asymmetric':
      return generateClusteredUePositions({
        ueCount,
        primary,
        primaryEastKm,
        primaryNorthKm,
        primaryFootprintRadiusKm,
        ueWorldScale,
        seed,
      });
  }
}


/**
 * THE cell→UE scan. Index of the UE nearest the centre of `focusCellId`, or
 * `null` when no cell is focused, cell centres are unavailable, or the focused
 * cell holds no UE.
 *
 * There used to be several verbatim copies of this loop (this one, the wrapper
 * below, and an inline copy inside {@link generateUePositions} that picked the
 * demo-jog target). Callers now differ only in what they do with "nobody found":
 * {@link resolveFocusUeIndex} falls back to index 0, the jog gives up.
 */
export function findFocusCellUeIndex(
  positions: readonly UePosition[],
  cellCentersKm: readonly UeDistributionCellCenterKm[] | undefined,
  focusCellId: number | null | undefined,
): number | null {
  if (focusCellId === null || focusCellId === undefined) return null;
  if (cellCentersKm === undefined || cellCentersKm.length === 0) return null;
  let bestIndex = -1;
  let bestDistanceKm = Infinity;
  for (let index = 0; index < positions.length; index += 1) {
    const position = positions[index];
    let nearestCellId = -1;
    let nearestDistanceKm = Infinity;
    for (let cellIndex = 0; cellIndex < cellCentersKm.length; cellIndex += 1) {
      const centre = cellCentersKm[cellIndex];
      const distanceKm = Math.hypot(
        position.eastKm - centre.eastKm,
        position.northKm - centre.northKm,
      );
      if (distanceKm < nearestDistanceKm) {
        nearestDistanceKm = distanceKm;
        nearestCellId = cellIndex;
      }
    }
    if (nearestCellId !== focusCellId) continue;
    if (nearestDistanceKm < bestDistanceKm) {
      bestDistanceKm = nearestDistanceKm;
      bestIndex = index;
    }
  }
  return bestIndex < 0 ? null : bestIndex;
}

/**
 * Index of the UE that represents `focusCellId` — the one nearest that cell's
 * centre. Returns 0 (the historical protagonist) when no cell is focused, when
 * cell centres are unavailable, or when the focused cell holds no UE.
 *
 * Positional FALLBACK only. `live-ue-N` ids are positional, so an index is a
 * fragile way to name a UE and re-deriving one per frame lets the protagonist
 * change hands as soon as anybody moves. Prefer {@link resolveProtagonistUeIndex}
 * with the id that `SinrLiveCellModel` pinned at focus-change time; this scan is
 * what answers the question the first time, before any pin exists.
 */
export function resolveFocusUeIndex(
  positions: readonly UePosition[],
  cellCentersKm: readonly UeDistributionCellCenterKm[] | undefined,
  focusCellId: number | null | undefined,
): number {
  return findFocusCellUeIndex(positions, cellCentersKm, focusCellId) ?? 0;
}

/**
 * THE protagonist oracle. One decision, consumed by every surface that has to
 * agree on "who are we watching": the main `S3HandoverManager`'s UE, the scene
 * ground anchor, the `applyPerTickUeMobility` primary, the demo-jog target, and
 * — via `SinrLiveCellFrame.primaryUeId` — the panels, rail and cones.
 *
 * Resolution order, and why:
 *
 * 1. `focusUeId` — the id `SinrLiveCellModel.setFocusCell` PINNED when the focus
 *    last changed. This is the authoritative answer. It is an **id**, not an
 *    index, because `live-ue-N` ids are positional: an index taken on one
 *    population names a different UE the moment the UE count changes, and a
 *    per-frame nearest-to-centre scan hands the role to somebody else the moment
 *    the protagonist walks out of the cell that selected it (which is exactly
 *    what happens once the focused UE is the one drifting).
 * 2. the nearest-to-focus-cell scan — the cold-start answer, used on the first
 *    frame of a focus (before the model has stepped and taken a pin) and by
 *    callers that have no cell model at all.
 * 3. index 0 — the historical protagonist, when nothing is focused.
 */
export function resolveProtagonistUeIndex(
  positions: readonly UePosition[],
  cellCentersKm: readonly UeDistributionCellCenterKm[] | undefined,
  focusCellId: number | null | undefined,
  focusUeId?: string | null,
): number {
  if (focusUeId !== null && focusUeId !== undefined) {
    const pinned = positions.findIndex(position => position.id === focusUeId);
    if (pinned >= 0) return pinned;
  }
  return resolveFocusUeIndex(positions, cellCentersKm, focusCellId);
}

/**
 * Public entry point. Generates the field, then applies the demo intra jog to
 * the UE the panels are actually WATCHING.
 *
 * The jog exists to slide the protagonist into an adjacent beam cell so the
 * engine performs a genuine intra handover. It used to be baked into the
 * index-0 anchor, which meant the trigger always nudged the observer-anchored
 * UE in cell 0 — so with a different cell focused, the panels followed one UE
 * while the handover animation played on another. Applying it to the focused
 * UE instead keeps "what I am watching" and "what just handed over" the same
 * UE. With no focus set this resolves to index 0, i.e. the original behaviour.
 */
export function generateUePositions(params: Parameters<typeof generateUePositionsForField>[0] & {
  /** Cell whose representative UE should receive the jog; null = index 0. */
  readonly focusCellId?: number | null;
  /**
   * The pinned protagonist id (see {@link resolveProtagonistUeIndex}). When it
   * names a UE of this field it wins over the nearest-to-centre scan, so the jog
   * lands on exactly the UE the panels, the cones and the main HandoverManager
   * are following — including after the protagonist has drifted out of the cell
   * that originally selected it.
   */
  readonly focusUeId?: string | null;
}): UePosition[] {
  const jogEastKm = params.primaryJogEastKm ?? 0;
  const jogNorthKm = params.primaryJogNorthKm ?? 0;
  const focusCellId = params.focusCellId ?? null;
  const centers = params.cellCentersKm;
  const hasJog = jogEastKm !== 0 || jogNorthKm !== 0;

  // No focus, or nothing to redirect: the original index-0 path, untouched.
  if (!hasJog || focusCellId === null || centers === undefined) {
    return generateUePositionsForField(params);
  }

  // Build the field WITHOUT the jog so cell membership reflects resting
  // positions, then move only the focused cell's representative UE.
  const positions = generateUePositionsForField({
    ...params,
    primaryJogEastKm: 0,
    primaryJogNorthKm: 0,
  });
  const centre = centers[focusCellId];
  if (centre === undefined) return positions;

  // The ONE protagonist oracle, minus its index-0 fallback: a jog aimed at the
  // default UE when the focused cell is empty would move somebody the panels are
  // not watching, so give up instead (the pre-consolidation behaviour).
  const pinnedIndex = params.focusUeId === null || params.focusUeId === undefined
    ? -1
    : positions.findIndex(position => position.id === params.focusUeId);
  const jogIndex = pinnedIndex >= 0
    ? pinnedIndex
    : findFocusCellUeIndex(positions, centers, focusCellId) ?? -1;
  if (jogIndex < 0) return positions;

  // Aim the jog at the NEAREST NEIGHBOURING cell instead of keeping the raw
  // east-west vector. The trigger's fixed +28 km east was tuned for cell 0; on
  // other cells of the hex lattice the same vector can land back inside the
  // cell it started in, so the demo silently produces no handover. Preserving
  // the jog's MAGNITUDE but pointing it at a neighbour makes the button do the
  // same thing from every cell.
  let neighbourCellId = -1;
  let neighbourDistanceKm = Infinity;
  for (let cellIndex = 0; cellIndex < centers.length; cellIndex += 1) {
    if (cellIndex === focusCellId) continue;
    const candidate = centers[cellIndex];
    const distanceKm = Math.hypot(candidate.eastKm - centre.eastKm, candidate.northKm - centre.northKm);
    if (distanceKm < neighbourDistanceKm) {
      neighbourDistanceKm = distanceKm;
      neighbourCellId = cellIndex;
    }
  }

  const target = positions[jogIndex];
  const magnitudeKm = Math.hypot(jogEastKm, jogNorthKm);
  let deltaEastKm = jogEastKm;
  let deltaNorthKm = jogNorthKm;
  if (neighbourCellId >= 0 && neighbourDistanceKm > 0) {
    const neighbour = centers[neighbourCellId];
    // Walk from the UE toward the neighbour's centre, far enough to clear the
    // boundary: the neighbour centre itself is always inside the neighbour.
    const towardEastKm = neighbour.eastKm - target.eastKm;
    const towardNorthKm = neighbour.northKm - target.northKm;
    const towardKm = Math.hypot(towardEastKm, towardNorthKm);
    if (towardKm > 0) {
      const stepKm = Math.max(magnitudeKm, towardKm);
      deltaEastKm = (towardEastKm / towardKm) * stepKm;
      deltaNorthKm = (towardNorthKm / towardKm) * stepKm;
    }
  }

  const moved = positions.slice();
  moved[jogIndex] = createUePosition(
    jogIndex,
    target.eastKm + deltaEastKm,
    target.northKm + deltaNorthKm,
    params.ueWorldScale,
  );
  return moved;
}
