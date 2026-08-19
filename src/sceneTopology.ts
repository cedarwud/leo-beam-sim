import type { Profile } from './profiles/types';
import type { UeDistributionMode } from './engine/ue/multiUeState';
import type { UeMobilityMode, UeMobilityParams } from './engine/ue/multiUeMobility';
import type { SimulatorConstellation } from './simulator/types';
import {
  isSupportedBeamLayoutCount,
  type SupportedBeamLayoutCount,
} from './core/beam/completeHexPresets';

export const SCENE_TOPOLOGY_OVERRIDES_KEY = 'leo-beam-sim.scene-topology.v1';

export type BeamCountBySatellite = Readonly<Record<string, SupportedBeamLayoutCount>>;

export interface SceneTopologyState {
  /** Legacy Walker presentation preset; canonical TLE frames keep their own provenance. */
  constellation: SimulatorConstellation;
  satsPerPlane: number | null;
  beamCountPerSatellite: number | null;
  /** Optional per-satellite beam budgets; the global count remains the fallback. */
  beamCountBySatellite: BeamCountBySatellite;
  /** Role-scoped budgets follow the current serving/candidate identities across a HO. */
  servingBeamCount: SupportedBeamLayoutCount | null;
  candidateBeamCount: SupportedBeamLayoutCount | null;
  /** Internal switch; deliberately not exposed in the frontend yet. */
  beamHoppingEnabled: boolean;
  cellServingCount: number | null;
  ueCount: number | null;
  ueDistributionMode: UeDistributionMode | null;
  ueMobilityMode: UeMobilityMode | null;
  ueMobilityParams: UeMobilityParams | null;
  enableUeTrails: boolean | null;
}

export function createSceneTopologyState(): SceneTopologyState {
  return {
    constellation: 'starlink',
    satsPerPlane: null,
    beamCountPerSatellite: null,
    beamCountBySatellite: {},
    servingBeamCount: null,
    candidateBeamCount: null,
    beamHoppingEnabled: false,
    cellServingCount: null,
    ueCount: null,
    ueDistributionMode: null,
    ueMobilityMode: null,
    ueMobilityParams: null,
    enableUeTrails: null,
  };
}

/**
 * Legacy Walker constellation adapter.  It changes only the synthetic orbit
 * source supplied to the scene; canonical TLE/SGP4 frames never pass through
 * this function.  OneWeb keeps the same deterministic Walker mechanics but at
 * a higher shell with a smaller satellite pool.
 */
export function applyLegacyConstellationPreset(
  profile: Profile,
  constellation: SimulatorConstellation,
): Profile {
  if (constellation === 'starlink') return profile;
  const inclinationOffsets = [-2.4, -1.2, 0, 1.2, 2.4] as const;
  return {
    ...profile,
    orbit: {
      ...profile.orbit,
      shells: profile.orbit.shells.map((shell, index) => ({
        ...shell,
        id: `oneweb-${shell.id}`,
        altitudeKm: 1200,
        inclinationDeg: 87.9 + (inclinationOffsets[index] ?? 0),
        planes: Math.max(1, Math.round(shell.planes * 0.5)),
        satsPerPlane: Math.max(1, Math.round(shell.satsPerPlane * 0.6)),
      })),
    },
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
    || topology.constellation !== 'starlink'
    || topology.beamCountPerSatellite !== null
    || Object.keys(topology.beamCountBySatellite).length > 0
    || topology.servingBeamCount !== null
    || topology.candidateBeamCount !== null
    || topology.beamHoppingEnabled
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
    topology.constellation,
    topology.satsPerPlane ?? 'base',
    topology.beamCountPerSatellite ?? 'base',
    serializeBeamCountBySatellite(topology.beamCountBySatellite),
    topology.servingBeamCount ?? 'global',
    topology.candidateBeamCount ?? 'global',
    topology.beamHoppingEnabled ? 'hopping' : 'fixed',
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
    topology.constellation,
    topology.satsPerPlane ?? 'base',
    topology.beamCountPerSatellite ?? 'base',
    serializeBeamCountBySatellite(topology.beamCountBySatellite),
    topology.servingBeamCount ?? 'global',
    topology.candidateBeamCount ?? 'global',
    topology.beamHoppingEnabled ? 'hopping' : 'fixed',
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
