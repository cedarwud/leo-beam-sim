export interface UePosition {
  id: string;
  groundX: number;
  groundZ: number;
  eastKm: number;
  northKm: number;
}

export type UeDistributionMode = 'random' | 'grid' | 'clustered';

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

function generateRandomUePositions(params: {
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
  const rng = createSeededRng(seed);
  const radiusKm = Math.max(0, primaryFootprintRadiusKm);
  const positions: UePosition[] = [primary];

  for (let i = 1; i < ueCount; i += 1) {
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
}): UePosition[] {
  const {
    primaryEastKm,
    primaryNorthKm,
    primaryFootprintRadiusKm,
    ueWorldScale,
    seed = 42,
    mode = 'random',
  } = params;
  const ueCount = Math.max(1, Math.trunc(params.ueCount));
  const primary = createUePosition(0, primaryEastKm, primaryNorthKm, ueWorldScale);

  if (ueCount === 1) {
    return [primary];
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
        primaryEastKm,
        primaryNorthKm,
        primaryFootprintRadiusKm,
        ueWorldScale,
        seed,
      });
  }
}
