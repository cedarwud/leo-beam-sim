import { SCENE_SURFACE_IDS } from '../sceneSurfaceRegistry';
import type { SceneRenderPlan } from './contracts';

export function formatSceneRenderPlanReasons(plan: SceneRenderPlan): string {
  return SCENE_SURFACE_IDS.map(id => {
    const surface = plan.surfaces[id];
    return `${id}=${surface.reasonCode}`;
  }).join(';');
}

export function formatSceneRenderPlanIdentities(plan: SceneRenderPlan): string {
  return SCENE_SURFACE_IDS.map(id => {
    const surface = plan.surfaces[id];
    return `${id}=${surface.renderIdentity}`;
  }).join(';');
}

export function explainSceneRenderPlan(plan: SceneRenderPlan): readonly string[] {
  return Object.freeze(SCENE_SURFACE_IDS.map(id => {
    const surface = plan.surfaces[id];
    const state = surface.visible ? 'visible' : surface.mounted ? 'mounted-hidden' : 'not-mounted';
    return [
      id,
      state,
      `owner=${surface.owner}`,
      `source=${surface.source}`,
      `reason=${surface.reasonCode}`,
      `render=${surface.renderIdentity}`,
      `story=${surface.storyId ?? '-'}`,
    ].join(' ');
  }));
}

export function formatSceneRenderPlanOwners(plan: SceneRenderPlan): string {
  return SCENE_SURFACE_IDS.map(id => {
    const surface = plan.surfaces[id];
    return `${id}=${surface.owner}`;
  }).join(';');
}

export function formatSceneRenderPlanSources(plan: SceneRenderPlan): string {
  return SCENE_SURFACE_IDS.map(id => {
    const surface = plan.surfaces[id];
    return `${id}=${surface.source}`;
  }).join(';');
}
