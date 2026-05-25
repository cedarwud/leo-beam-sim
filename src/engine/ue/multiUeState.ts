export interface UePosition {
  id: string;
  groundX: number;
  groundZ: number;
  eastKm: number;
  northKm: number;
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

export function generateUePositions(params: {
  ueCount: number;
  primaryEastKm: number;
  primaryNorthKm: number;
  primaryFootprintRadiusKm: number;
  ueWorldScale: number;
  seed?: number;
}): UePosition[] {
  const {
    primaryEastKm,
    primaryNorthKm,
    primaryFootprintRadiusKm,
    ueWorldScale,
    seed = 42,
  } = params;
  const ueCount = Math.max(1, Math.trunc(params.ueCount));
  const primary: UePosition = {
    id: 'live-ue-0',
    groundX: primaryEastKm * ueWorldScale,
    groundZ: -primaryNorthKm * ueWorldScale,
    eastKm: primaryEastKm,
    northKm: primaryNorthKm,
  };

  if (ueCount === 1) {
    return [primary];
  }

  const rng = createSeededRng(seed);
  const radiusKm = Math.max(0, primaryFootprintRadiusKm);
  const positions: UePosition[] = [primary];

  for (let i = 1; i < ueCount; i += 1) {
    const r = Math.sqrt(rng()) * radiusKm;
    const theta = rng() * 2 * Math.PI;
    const eastKm = primaryEastKm + r * Math.cos(theta);
    const northKm = primaryNorthKm + r * Math.sin(theta);
    positions.push({
      id: `live-ue-${i}`,
      groundX: eastKm * ueWorldScale,
      groundZ: -northKm * ueWorldScale,
      eastKm,
      northKm,
    });
  }

  return positions;
}
