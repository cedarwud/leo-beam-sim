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

function allocateWeightedUeCounts(ueCount: number): number[] {
  const totalWeight = DISPERSED_SEVEN_CELL_USER_COUNTS.reduce((sum, weight) => sum + weight, 0);
  const exact = DISPERSED_SEVEN_CELL_USER_COUNTS.map(weight => ueCount * weight / totalWeight);
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

function generateSevenCellAsymmetricUePositions(params: {
  readonly ueCount: number;
  readonly primary: UePosition;
  readonly primaryAnchorMode: UePrimaryAnchorMode;
  readonly cellCentersKm: readonly UeDistributionCellCenterKm[];
  readonly cellRadiusKm: number;
  readonly ueWorldScale: number;
  readonly seed: number;
}): UePosition[] | null {
  if (params.cellCentersKm.length < 7 || !Number.isFinite(params.cellRadiusKm) || params.cellRadiusKm <= 0) {
    return null;
  }
  const centers = params.cellCentersKm.slice(0, 7);
  const counts = allocateWeightedUeCounts(params.ueCount);
  const positions: UePosition[] = [];
  const rng = createSeededRng(params.seed);
  const anchorPrimary = params.primaryAnchorMode === 'observer';
  if (anchorPrimary) {
    positions.push(params.primary);
    counts[0] = Math.max(0, counts[0] - 1);
  }

  for (let cellIndex = 0; cellIndex < centers.length; cellIndex += 1) {
    const center = centers[cellIndex];
    const shape = SEVEN_CELL_SCATTER[cellIndex];
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

export function generateUePositions(params: {
  ueCount: number;
  primaryEastKm: number;
  primaryNorthKm: number;
  primaryFootprintRadiusKm: number;
  ueWorldScale: number;
  seed?: number;
  mode?: UeDistributionMode;
  primaryAnchorMode?: UePrimaryAnchorMode;
  rectangleAreaKm?: UeRectangleAreaKm;
  /** Exact scene-cell centres used only by the hidden seven-cell preset. */
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
    const positions = generateSevenCellAsymmetricUePositions({
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
