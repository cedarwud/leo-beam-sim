import {
  SCENE_TOPOLOGY_OVERRIDES_KEY,
  createSceneTopologyState,
  type SceneTopologyState,
} from '../sceneTopology';
import {
  SCENE_VISUAL_SCALE_OVERRIDES_KEY,
  createSceneVisualScaleState,
  type SceneVisualScaleState,
} from '../sceneVisualScale';
import type { UeMobilityParams } from '../engine/ue/multiUeMobility';

export type SceneSourceMode = 'live-sim' | 'artifact-replay';

export function readSceneSourceFromUrl(): SceneSourceMode {
  if (typeof window === 'undefined') return 'live-sim';
  const params = new URLSearchParams(window.location.search);
  const src = params.get('sceneSource');
  return src === 'artifact-replay' ? 'artifact-replay' : 'live-sim';
}

export function readSceneTopologyOverrides(): SceneTopologyState {
  if (typeof window === 'undefined') return createSceneTopologyState();

  try {
    const stored = window.localStorage.getItem(SCENE_TOPOLOGY_OVERRIDES_KEY);
    if (stored === null) return createSceneTopologyState();
    const parsed: unknown = JSON.parse(stored);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return createSceneTopologyState();
    }
    const record = parsed as Partial<Record<keyof SceneTopologyState, unknown>>;
    const mobilityParams = record.ueMobilityParams;
    const normalizedMobilityParams: UeMobilityParams | null =
      mobilityParams !== null
      && typeof mobilityParams === 'object'
      && !Array.isArray(mobilityParams)
      && typeof (mobilityParams as Partial<UeMobilityParams>).speedKmPerSec === 'number'
      && typeof (mobilityParams as Partial<UeMobilityParams>).waypointCount === 'number'
      && typeof (mobilityParams as Partial<UeMobilityParams>).manhattanGridSpacingKm === 'number'
        ? {
            speedKmPerSec: (mobilityParams as UeMobilityParams).speedKmPerSec,
            waypointCount: (mobilityParams as UeMobilityParams).waypointCount,
            manhattanGridSpacingKm: (mobilityParams as UeMobilityParams).manhattanGridSpacingKm,
          }
        : null;
    return {
      satsPerPlane: typeof record.satsPerPlane === 'number' ? record.satsPerPlane : null,
      beamCountPerSatellite: typeof record.beamCountPerSatellite === 'number'
        ? record.beamCountPerSatellite
        : null,
      ueCount: typeof record.ueCount === 'number' ? record.ueCount : null,
      ueDistributionMode: record.ueDistributionMode === 'random'
        || record.ueDistributionMode === 'grid'
        || record.ueDistributionMode === 'clustered'
        ? record.ueDistributionMode
        : null,
      ueMobilityMode: record.ueMobilityMode === 'static'
        || record.ueMobilityMode === 'random-walk'
        || record.ueMobilityMode === 'waypoints'
        || record.ueMobilityMode === 'manhattan'
        ? record.ueMobilityMode
        : null,
      ueMobilityParams: normalizedMobilityParams,
      enableUeTrails: record.enableUeTrails === true ? true : null,
    };
  } catch {
    return createSceneTopologyState();
  }
}

export function persistSceneTopologyOverrides(sceneTopology: SceneTopologyState): void {
  try {
    window.localStorage.setItem(SCENE_TOPOLOGY_OVERRIDES_KEY, JSON.stringify(sceneTopology));
  } catch {
    // Storage can be unavailable in private or embedded browser contexts.
  }
}

export function readSceneVisualScaleOverrides(): SceneVisualScaleState {
  if (typeof window === 'undefined') return createSceneVisualScaleState();

  try {
    const stored = window.localStorage.getItem(SCENE_VISUAL_SCALE_OVERRIDES_KEY);
    if (stored === null) return createSceneVisualScaleState();
    const parsed: unknown = JSON.parse(stored);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return createSceneVisualScaleState();
    }
    const record = parsed as Partial<Record<keyof SceneVisualScaleState, unknown>>;
    const sceneScale = record.sceneScale === 'demo-readability' || record.sceneScale === 'paper-faithful'
      ? record.sceneScale
      : 'paper-faithful';
    return {
      sceneScale,
      ueMarkerScale: typeof record.ueMarkerScale === 'number' ? record.ueMarkerScale : 1.0,
    };
  } catch {
    return createSceneVisualScaleState();
  }
}

export function persistSceneVisualScaleOverrides(sceneVisualScale: SceneVisualScaleState): void {
  try {
    window.localStorage.setItem(SCENE_VISUAL_SCALE_OVERRIDES_KEY, JSON.stringify(sceneVisualScale));
  } catch {
    // Storage can be unavailable in private or embedded browser contexts.
  }
}
