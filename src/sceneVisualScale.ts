export type SceneScale = 'paper-faithful' | 'demo-readability';

export interface SceneVisualScaleState {
  sceneScale: SceneScale;
  ueMarkerScale: number;
}

export interface SceneVisualScaleMultipliers {
  /** Multiplier applied on top of FOOTPRINT_RADIUS_WORLD for live rendering. */
  beamFootprintMultiplier: number;
  /** Multiplier applied to MARKER_HEIGHT / MARKER_RADIUS in GroundScene. */
  ueMarkerMultiplier: number;
}

export const DEFAULT_SCENE_VISUAL_SCALE_STATE: SceneVisualScaleState = {
  sceneScale: 'paper-faithful',
  ueMarkerScale: 1.0,
};

export const SCENE_VISUAL_SCALE_OVERRIDES_KEY =
  'leo-beam-sim.scene-visual-scale.v1';

const SCENE_SCALE_MULTIPLIERS: Record<SceneScale, number> = {
  'paper-faithful': 1.0,
  'demo-readability': 1.6,
};

export function createSceneVisualScaleState(): SceneVisualScaleState {
  return { ...DEFAULT_SCENE_VISUAL_SCALE_STATE };
}

export function resolveSceneVisualScaleMultipliers(
  state: SceneVisualScaleState,
): SceneVisualScaleMultipliers {
  return {
    beamFootprintMultiplier: SCENE_SCALE_MULTIPLIERS[state.sceneScale],
    ueMarkerMultiplier: state.ueMarkerScale,
  };
}

export function hasSceneVisualScaleOverrides(
  state: SceneVisualScaleState,
): boolean {
  return state.sceneScale !== DEFAULT_SCENE_VISUAL_SCALE_STATE.sceneScale
    || state.ueMarkerScale !== DEFAULT_SCENE_VISUAL_SCALE_STATE.ueMarkerScale;
}

export function getSceneVisualScaleResetKey(
  state: SceneVisualScaleState,
): string {
  return [state.sceneScale, state.ueMarkerScale.toFixed(2)].join('|');
}

export function getSceneVisualScaleEvidenceKey(
  state: SceneVisualScaleState,
): string {
  return [state.sceneScale, state.ueMarkerScale.toFixed(2)].join('|');
}
