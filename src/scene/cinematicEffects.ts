import { BEAM_ROLE_TOKENS, type BeamVisualRole } from '../constants/beamRoleTokens';
import type { BeamTarget } from './beamTargetTypes';
import type { CinematicMode } from './types';

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
/**
 * Spotlight FogExp2 density. Visibility ≈ `exp(−(density·cameraDist)²)`, so this
 * saturates to the near-black {@link CINEMATIC_FOG_COLOR} as the camera dollies out.
 *
 * The original 0.00129 was authored (pre-49db65d) for a scene where the spotlight
 * point-lights formed a TIGHT pool under the protagonist UE (UE-anchored beams) and
 * the camera framed it CLOSE. Two later changes broke that envelope without re-tuning
 * the fog: c8d211d spread the point-lights out to earth-fixed cell centres
 * (disableUeAnchor on sinr-live), and f973f9e pulled the default/oblique camera back
 * ~200 wu. At the current default dist ≈ 819 wu, 0.00129 already drowns ~67% of the
 * frame, and a modest zoom-out (≈1185 wu) goes ~90% black — the "must be close /
 * black when zoomed out" report. Lowered to 0.00075 so the spotlight still DIMS +
 * vignettes (focus is also carried by {@link CINEMATIC_LIGHT_DIM_MULTIPLIER} = 0.6)
 * but stays legible across the OrbitControls zoom range (≈69% at 819 wu, ≈45% at
 * 1185 wu; still ~black at the 3000 wu max). Display-only (Rule#6): fog mounts ONLY
 * in spotlight mode, so off-spotlight rendering is untouched.
 */
export const CINEMATIC_FOG_DENSITY = 0.00075;
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
