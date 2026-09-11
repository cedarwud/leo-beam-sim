import {
  SCENE_TOPOLOGY_OVERRIDES_KEY,
  createSceneTopologyState,
  normalizeBeamCountBySatellite,
  type SceneTopologyState,
} from '../sceneTopology';
import {
  SCENE_VISUAL_SCALE_OVERRIDES_KEY,
  createSceneVisualScaleState,
  type SceneVisualScaleState,
} from '../sceneVisualScale';
import type { UeMobilityParams } from '../engine/ue/multiUeMobility';
import { isSupportedBeamLayoutCount } from '../core/beam/completeHexPresets';

export type SceneSourceMode = 'live-sim' | 'artifact-replay';

// Top-level view axis (orthogonal to the scene lane): 'scene' = the full-height
// 3D viewport; 'dashboard' = a future full-area data-flow surface. Deep-linkable
// via ?view=dashboard, mirroring the sceneSource URL pattern (no react-router).
// These helpers remain display-only and are currently unused by the app shell.
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
      constellation: record.constellation === 'oneweb' ? 'oneweb' : 'starlink',
      // Focus is a viewpoint, not a scenario parameter: a reload starts back on
      // the default protagonist rather than restoring a stale cell id that may
      // not exist under a different beam layout.
      focusCellId: null,
      satsPerPlane: typeof record.satsPerPlane === 'number' ? record.satsPerPlane : null,
      // A persisted global beam count reaches `profile.beams.perSatellite`
      // unvalidated (`sceneTopology.ts` applySceneTopology), so an unsupported
      // stored value silently becomes the physical beam layout: 2 renders two
      // beams, and 0 or -5 propagate verbatim -- measured, not assumed. The two
      // sibling role counts below have always rejected anything outside
      // [1, 7, 19]; this one never did, which is the whole asymmetry.
      beamCountPerSatellite: typeof record.beamCountPerSatellite === 'number'
        && isSupportedBeamLayoutCount(record.beamCountPerSatellite)
        ? record.beamCountPerSatellite
        : null,
      beamCountBySatellite: normalizeBeamCountBySatellite(record.beamCountBySatellite),
      servingBeamCount: typeof record.servingBeamCount === 'number'
        && isSupportedBeamLayoutCount(record.servingBeamCount)
        ? record.servingBeamCount
        : null,
      candidateBeamCount: typeof record.candidateBeamCount === 'number'
        && isSupportedBeamLayoutCount(record.candidateBeamCount)
        ? record.candidateBeamCount
        : null,
      beamHoppingEnabled: record.beamHoppingEnabled === true,
      cellServingCount: null,
      ueCount: typeof record.ueCount === 'number' ? record.ueCount : null,
      ueDistributionMode: record.ueDistributionMode === 'random'
        || record.ueDistributionMode === 'grid'
        || record.ueDistributionMode === 'clustered'
        || record.ueDistributionMode === 'seven-cell-asymmetric'
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

/**
 * Homepage-only narrative switch. The default is deliberately enabled so the
 * default route teaches the decision story; an explicit saved choice wins.
 */
export const HOMEPAGE_NARRATIVE_TEACHING_MODE_KEY = 'leo-beam-sim.homepage-narrative-teaching-mode.v1';

export function readHomepageNarrativeTeachingMode(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const stored = window.localStorage.getItem(HOMEPAGE_NARRATIVE_TEACHING_MODE_KEY);
    if (stored === 'true') return true;
    if (stored === 'false') return false;
  } catch {
    // Storage can be unavailable in private or embedded browser contexts.
  }
  return true;
}

export function persistHomepageNarrativeTeachingMode(enabled: boolean): void {
  try {
    window.localStorage.setItem(HOMEPAGE_NARRATIVE_TEACHING_MODE_KEY, String(enabled));
  } catch {
    // Storage can be unavailable in private or embedded browser contexts.
  }
}
