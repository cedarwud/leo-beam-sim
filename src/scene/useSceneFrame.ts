import { useMemo } from 'react';
import { type NormalizedSceneFrame } from './NormalizedSceneFrame';
import { resolveSceneFrame, type SceneFrameResolutionInput } from './sceneFrameResolver';

export interface UseSceneFrameParameters {
  sceneFrameInput: SceneFrameResolutionInput;
}

export interface UseSceneFrameResult {
  sceneFrame: NormalizedSceneFrame;
}

export function useSceneFrame({ sceneFrameInput }: UseSceneFrameParameters): UseSceneFrameResult {
  const sceneFrame = useMemo(
      () => resolveSceneFrame(sceneFrameInput),
      [sceneFrameInput],
    );
  return { sceneFrame };
}
