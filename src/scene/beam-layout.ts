import { generateHexagonalBeamLayout } from '../core/beam/layout';
import {
  FOOTPRINT_RADIUS_WORLD as PURE_FOOTPRINT_RADIUS_WORLD,
  MAX_BEAMS_PER_SATELLITE as PURE_MAX_BEAMS_PER_SATELLITE,
  computeBeamGeometry,
  type BeamGeometry,
} from './beam-geometry-pure';

export { computeBeamGeometry };
export type { BeamGeometry };
// Re-export display constants from the R1-safe pure module so existing
// live-side consumers keep the same import path.
export const FOOTPRINT_RADIUS_WORLD = PURE_FOOTPRINT_RADIUS_WORLD;
export const MAX_BEAMS_PER_SATELLITE = PURE_MAX_BEAMS_PER_SATELLITE;

export const CORE_LAYOUT_FREQUENCY_REUSE_VALUES = [1, 3, 7] as const;
export type CoreLayoutFrequencyReuse = typeof CORE_LAYOUT_FREQUENCY_REUSE_VALUES[number];
export type ReuseGroupSource = 'core-layout' | 'runtime-frequency-reuse-compatibility';

export interface CoreLayoutFrequencyReuseResolution {
  runtimeFrequencyReuse: number;
  coreLayoutFrequencyReuse: CoreLayoutFrequencyReuse;
  reuseGroupSource: ReuseGroupSource;
}

export interface BeamOffsetKm {
  beamId: number;
  dEastKm: number;
  dNorthKm: number;
}

export interface CoreSceneBeamOffsetKm extends BeamOffsetKm {
  coreLayoutSatId: string;
  coreBeamId: string;
  coreLocalBeamIndex: number;
  reuseGroup: number;
  runtimeFrequencyReuse: number;
  coreLayoutFrequencyReuse: CoreLayoutFrequencyReuse;
  reuseGroupSource: ReuseGroupSource;
}

export interface CoreSceneBeamLayoutConfig {
  coreLayoutSatId: string;
  maxBeams: number;
  beamDiameterKm: number;
  altitudeKm: number;
  frequencyReuse: number;
}

const COMPATIBILITY_CORE_LAYOUT_FREQUENCY_REUSE: CoreLayoutFrequencyReuse = 1;

function isCoreLayoutFrequencyReuse(value: number): value is CoreLayoutFrequencyReuse {
  return (CORE_LAYOUT_FREQUENCY_REUSE_VALUES as readonly number[]).includes(value);
}

function normalizeRuntimeFrequencyReuse(frequencyReuse: number): number {
  if (!Number.isFinite(frequencyReuse)) return 1;
  return Math.max(1, Math.floor(frequencyReuse));
}

export function resolveCoreLayoutFrequencyReuse(
  frequencyReuse: number,
): CoreLayoutFrequencyReuseResolution {
  const runtimeFrequencyReuse = normalizeRuntimeFrequencyReuse(frequencyReuse);

  if (isCoreLayoutFrequencyReuse(runtimeFrequencyReuse)) {
    return {
      runtimeFrequencyReuse,
      coreLayoutFrequencyReuse: runtimeFrequencyReuse,
      reuseGroupSource: 'core-layout',
    };
  }

  return {
    runtimeFrequencyReuse,
    coreLayoutFrequencyReuse: COMPATIBILITY_CORE_LAYOUT_FREQUENCY_REUSE,
    reuseGroupSource: 'runtime-frequency-reuse-compatibility',
  };
}

function deriveCompatibilityReuseGroup(
  coreLocalBeamIndex: number,
  runtimeFrequencyReuse: number,
): number {
  return coreLocalBeamIndex % runtimeFrequencyReuse;
}

export function generateBeamOffsetsKm(
  spacingKm: number,
  maxBeams: number,
): BeamOffsetKm[] {
  const beamLimit = Math.min(Math.floor(maxBeams), MAX_BEAMS_PER_SATELLITE);
  if (beamLimit <= 0) return [];

  const beams: BeamOffsetKm[] = [];
  let id = 1;

  beams.push({ beamId: id++, dEastKm: 0, dNorthKm: 0 });
  for (let ring = 1; beams.length < beamLimit; ring++) {
    const ringBeams = 6 * ring;
    for (let i = 0; i < ringBeams && beams.length < beamLimit; i++) {
      const angle = (i / ringBeams) * Math.PI * 2;
      beams.push({
        beamId: id++,
        dEastKm: Math.cos(angle) * spacingKm * ring,
        dNorthKm: Math.sin(angle) * spacingKm * ring,
      });
    }
  }

  return beams;
}

export function generateCoreSceneBeamOffsetsKm(
  config: CoreSceneBeamLayoutConfig,
): CoreSceneBeamOffsetKm[] {
  const beamLimit = Math.min(Math.floor(config.maxBeams), MAX_BEAMS_PER_SATELLITE);
  if (beamLimit <= 0) return [];
  const reuseResolution = resolveCoreLayoutFrequencyReuse(config.frequencyReuse);

  const layout = generateHexagonalBeamLayout({
    satId: config.coreLayoutSatId,
    numBeams: beamLimit,
    beamDiameterKm: config.beamDiameterKm,
    altitudeKm: config.altitudeKm,
    frf: reuseResolution.coreLayoutFrequencyReuse,
  });

  return layout.beams.map((beam, coreLocalBeamIndex) => {
    const reuseGroup = reuseResolution.reuseGroupSource === 'core-layout'
      ? beam.reuseGroup
      : deriveCompatibilityReuseGroup(
        coreLocalBeamIndex,
        reuseResolution.runtimeFrequencyReuse,
      );

    return {
      beamId: coreLocalBeamIndex + 1,
      dEastKm: beam.offsetEastKm,
      dNorthKm: beam.offsetNorthKm,
      coreLayoutSatId: layout.satId,
      coreBeamId: beam.beamId,
      coreLocalBeamIndex,
      reuseGroup,
      runtimeFrequencyReuse: reuseResolution.runtimeFrequencyReuse,
      coreLayoutFrequencyReuse: reuseResolution.coreLayoutFrequencyReuse,
      reuseGroupSource: reuseResolution.reuseGroupSource,
    };
  });
}
