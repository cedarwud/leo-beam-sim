import type { Profile } from './profiles/types';
import type { UeDistributionMode } from './engine/ue/multiUeState';
import type { UeMobilityMode, UeMobilityParams } from './engine/ue/multiUeMobility';
import {
  isSupportedBeamLayoutCount,
  type SupportedBeamLayoutCount,
} from './core/beam/completeHexPresets';

export const SCENE_TOPOLOGY_OVERRIDES_KEY = 'leo-beam-sim.scene-topology.v1';

export type BeamCountBySatellite = Readonly<Record<string, SupportedBeamLayoutCount>>;

export interface SceneTopologyState {
  satsPerPlane: number | null;
  beamCountPerSatellite: number | null;
  /** Optional per-satellite beam budgets; the global count remains the fallback. */
  beamCountBySatellite: BeamCountBySatellite;
  cellServingCount: number | null;
  ueCount: number | null;
  ueDistributionMode: UeDistributionMode | null;
  ueMobilityMode: UeMobilityMode | null;
  ueMobilityParams: UeMobilityParams | null;
  enableUeTrails: boolean | null;
}

export function createSceneTopologyState(): SceneTopologyState {
  return {
    satsPerPlane: null,
    beamCountPerSatellite: null,
    beamCountBySatellite: {},
    cellServingCount: null,
    ueCount: null,
    ueDistributionMode: null,
    ueMobilityMode: null,
    ueMobilityParams: null,
    enableUeTrails: null,
  };
}

/**
 * Keep persisted per-satellite beam controls bounded to the same choices shown
 * by the scenario sidebar. Invalid or legacy values fail closed to an empty
 * override map, leaving the global scene setting in charge.
 */
export function normalizeBeamCountBySatellite(value: unknown): BeamCountBySatellite {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {};

  const normalized: Record<string, SupportedBeamLayoutCount> = {};
  for (const [satelliteId, beamCount] of Object.entries(value)) {
    if (
      satelliteId.length === 0
      || typeof beamCount !== 'number'
      || !isSupportedBeamLayoutCount(beamCount)
    ) continue;
    normalized[satelliteId] = beamCount;
  }
  return normalized;
}

function serializeBeamCountBySatellite(beamCountBySatellite: BeamCountBySatellite): string {
  return Object.entries(beamCountBySatellite)
    .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
    .map(([satelliteId, beamCount]) => `${satelliteId}:${beamCount}`)
    .join(',');
}

export function applySceneTopology(
  profile: Profile,
  topology: SceneTopologyState,
): Profile {
  const primaryShell = profile.orbit.shells[0];
  const overriddenShells = topology.satsPerPlane !== null && primaryShell
    ? [
        { ...primaryShell, satsPerPlane: topology.satsPerPlane },
        ...profile.orbit.shells.slice(1),
      ]
    : profile.orbit.shells;

  const overriddenBeams = topology.beamCountPerSatellite !== null
    ? {
        ...profile.beams,
        perSatellite: topology.beamCountPerSatellite,
        maxActivePerSat: topology.beamCountPerSatellite,
      }
    : profile.beams;

  return {
    ...profile,
    orbit: { ...profile.orbit, shells: overriddenShells },
    beams: overriddenBeams,
  };
}

export function hasSceneTopologyOverrides(
  topology: SceneTopologyState,
): boolean {
  return topology.satsPerPlane !== null
    || topology.beamCountPerSatellite !== null
    || Object.keys(topology.beamCountBySatellite).length > 0
    || topology.ueCount !== null
    || (topology.ueDistributionMode !== null && topology.ueDistributionMode !== 'random')
    || (topology.ueMobilityMode !== null && topology.ueMobilityMode !== 'static')
    || topology.ueMobilityParams !== null
    || topology.enableUeTrails === true;
}

export function getSceneTopologyResetKey(
  topology: SceneTopologyState,
): string {
  return [
    topology.satsPerPlane ?? 'base',
    topology.beamCountPerSatellite ?? 'base',
    serializeBeamCountBySatellite(topology.beamCountBySatellite),
    topology.ueCount ?? 'base',
    topology.ueDistributionMode ?? 'random',
    topology.ueMobilityMode ?? 'static',
    topology.ueMobilityParams?.speedKmPerSec ?? 'default',
    topology.ueMobilityParams?.waypointCount ?? 'default',
    topology.ueMobilityParams?.manhattanGridSpacingKm ?? 'default',
    topology.enableUeTrails === true ? 'ue-trails' : 'no-ue-trails',
  ].join('|');
}

export function getSceneTopologyEvidenceKey(
  topology: SceneTopologyState,
): string {
  return [
    topology.satsPerPlane ?? 'base',
    topology.beamCountPerSatellite ?? 'base',
    serializeBeamCountBySatellite(topology.beamCountBySatellite),
    topology.ueCount ?? 'base',
    topology.ueDistributionMode ?? 'random',
    topology.ueMobilityMode ?? 'static',
    topology.ueMobilityParams?.speedKmPerSec ?? 'default',
    topology.ueMobilityParams?.waypointCount ?? 'default',
    topology.ueMobilityParams?.manhattanGridSpacingKm ?? 'default',
    topology.enableUeTrails === true ? 'ue-trails' : 'no-ue-trails',
  ].join('|');
}

export type { UeMobilityParams };
