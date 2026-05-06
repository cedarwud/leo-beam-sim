import { BEAM_ROLE_TOKENS, type BeamVisualRole } from '../constants/beamRoleTokens';
import type { CinematicMode } from './types';
import type { BeamTarget } from '../viz/SatelliteBeams';

export type CinematicSpotlightRole = 'serving' | 'pending';

export interface CinematicSpotlightTarget {
  id: string;
  role: CinematicSpotlightRole;
  satelliteId: string;
  beamId: number;
  groundX: number;
  groundZ: number;
  color: string;
  intensity: number;
}

export const CINEMATIC_LIGHT_DIM_MULTIPLIER = 0.6;
export const CINEMATIC_FOG_COLOR = '#020912';
export const CINEMATIC_FOG_DENSITY = 0.00129;
export const CINEMATIC_EVENT_LIGHT_HEIGHT_WORLD = 12;
export const CINEMATIC_EVENT_LIGHT_DISTANCE_WORLD = 170;
export const CINEMATIC_EVENT_LIGHT_DECAY = 1.0;
export const CINEMATIC_SERVING_LIGHT_INTENSITY = 76;
export const CINEMATIC_PENDING_LIGHT_INTENSITY = 68;
export const CINEMATIC_NON_EVENT_CONE_OPACITY_MULTIPLIER = 0.5;

export function isSpotlightMode(cinematicMode: CinematicMode): boolean {
  return cinematicMode === 'spotlight';
}

export function resolveCinematicLightIntensity(
  baseIntensity: number,
  cinematicMode: CinematicMode,
): number {
  return isSpotlightMode(cinematicMode)
    ? baseIntensity * CINEMATIC_LIGHT_DIM_MULTIPLIER
    : baseIntensity;
}

export function resolveCinematicConeOpacityMultiplier(
  visualRole: BeamVisualRole,
  cinematicMode: CinematicMode,
): number {
  if (!isSpotlightMode(cinematicMode)) return 1;
  return visualRole === 'otherActive' || visualRole === 'inactive'
    ? CINEMATIC_NON_EVENT_CONE_OPACITY_MULTIPLIER
    : 1;
}

export function spotlightRoleForBeam(
  beam: Pick<BeamTarget, 'showBeam' | 'isServing' | 'role' | 'isScheduledActive'>,
): CinematicSpotlightRole | null {
  if (!beam.showBeam || !beam.isScheduledActive) return null;
  if (beam.isServing) return 'serving';
  return beam.role === 'prepared' ? 'pending' : null;
}

export function resolveCinematicSpotlightTargets(input: {
  satBeams: Map<string, BeamTarget[]>;
  cinematicMode: CinematicMode;
}): CinematicSpotlightTarget[] {
  if (!isSpotlightMode(input.cinematicMode)) return [];

  const targets: CinematicSpotlightTarget[] = [];

  for (const [satelliteId, beams] of input.satBeams.entries()) {
    for (const beam of beams) {
      const role = spotlightRoleForBeam(beam);
      if (!role) continue;

      targets.push({
        id: `cinematic-${role}-${satelliteId}-B${beam.beamId}`,
        role,
        satelliteId,
        beamId: beam.beamId,
        groundX: beam.groundX,
        groundZ: beam.groundZ,
        color: BEAM_ROLE_TOKENS[role].color,
        intensity: role === 'serving'
          ? CINEMATIC_SERVING_LIGHT_INTENSITY
          : CINEMATIC_PENDING_LIGHT_INTENSITY,
      });
    }
  }

  return targets;
}
