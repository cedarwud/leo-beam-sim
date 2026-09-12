import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';

import {
  formatSceneRenderPlanIdentities,
  formatSceneRenderPlanOwners,
  formatSceneRenderPlanReasons,
  formatSceneRenderPlanSources,
  type SceneRenderPlan,
} from './sceneRenderPlan';

const DATASET_KEYS = Object.freeze([
  'sceneRenderPlanVersion',
  'sceneRenderLane',
  'sceneRenderStoryOwner',
  'sceneRenderStorySource',
  'sceneRenderStoryId',
  'sceneRenderStoryPairKey',
  'sceneRenderSurfaceCount',
  'sceneRenderMountedSurfaces',
  'sceneRenderVisibleSurfaces',
  'sceneRenderSurfaceOwners',
  'sceneRenderSurfaceSources',
  'sceneRenderSurfaceReasons',
  'sceneRenderSurfaceIdentities',
] as const);

function clearDataset(canvas: HTMLCanvasElement): void {
  for (const key of DATASET_KEYS) delete canvas.dataset[key];
}

/** Read-only publication of the exact production scene-composition plan. */
export function SceneRenderPlanCanvasTelemetry({
  plan,
}: {
  readonly plan: SceneRenderPlan;
}) {
  const gl = useThree(state => state.gl);
  const version = String(plan.schemaVersion);
  const lane = plan.lane;
  const storyOwner = plan.story.owner;
  const storySource = plan.story.activeSource;
  const storyId = plan.story.storyId ?? '';
  const storyPairKey = plan.story.pairKey ?? '';
  const surfaceCount = String(Object.keys(plan.surfaces).length);
  const mounted = plan.mountedSurfaceIds.join(',');
  const visible = plan.visibleSurfaceIds.join(',');
  const owners = formatSceneRenderPlanOwners(plan);
  const sources = formatSceneRenderPlanSources(plan);
  const reasons = formatSceneRenderPlanReasons(plan);
  const identities = formatSceneRenderPlanIdentities(plan);

  useEffect(() => {
    const dataset = gl.domElement.dataset;
    dataset.sceneRenderPlanVersion = version;
    dataset.sceneRenderLane = lane;
    dataset.sceneRenderStoryOwner = storyOwner;
    dataset.sceneRenderStorySource = storySource;
    dataset.sceneRenderStoryId = storyId;
    dataset.sceneRenderStoryPairKey = storyPairKey;
    dataset.sceneRenderSurfaceCount = surfaceCount;
    dataset.sceneRenderMountedSurfaces = mounted;
    dataset.sceneRenderVisibleSurfaces = visible;
    dataset.sceneRenderSurfaceOwners = owners;
    dataset.sceneRenderSurfaceSources = sources;
    dataset.sceneRenderSurfaceReasons = reasons;
    dataset.sceneRenderSurfaceIdentities = identities;
  }, [
    gl,
    identities,
    lane,
    mounted,
    owners,
    reasons,
    sources,
    storyId,
    storyOwner,
    storyPairKey,
    storySource,
    surfaceCount,
    version,
    visible,
  ]);

  useEffect(() => () => clearDataset(gl.domElement), [gl]);
  return null;
}
