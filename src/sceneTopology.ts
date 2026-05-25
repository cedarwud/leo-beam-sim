import type { Profile } from './profiles/types';

export const SCENE_TOPOLOGY_OVERRIDES_KEY = 'leo-beam-sim.scene-topology.v1';

export interface SceneTopologyState {
  satsPerPlane: number | null;
  beamCountPerSatellite: number | null;
  ueCount: number | null;
}

export function createSceneTopologyState(): SceneTopologyState {
  return {
    satsPerPlane: null,
    beamCountPerSatellite: null,
    ueCount: null,
  };
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
    || topology.ueCount !== null;
}

export function getSceneTopologyResetKey(
  topology: SceneTopologyState,
): string {
  return [
    topology.satsPerPlane ?? 'base',
    topology.beamCountPerSatellite ?? 'base',
    topology.ueCount ?? 'base',
  ].join('|');
}

export function getSceneTopologyEvidenceKey(
  topology: SceneTopologyState,
): string {
  return [
    topology.satsPerPlane ?? 'base',
    topology.beamCountPerSatellite ?? 'base',
    topology.ueCount ?? 'base',
  ].join('|');
}
