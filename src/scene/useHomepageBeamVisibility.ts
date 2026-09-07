import { useMemo } from 'react';
import { resolveHomepageSceneBeamVisibility, type HomepageSceneBeamVisibilityInput } from './homepageSceneBeamVisibility';

export interface UseHomepageBeamVisibilityParameters {
  homepageSceneBeamVisibilityInput: HomepageSceneBeamVisibilityInput;
}

export interface UseHomepageBeamVisibilityResult {
  homepageBeamVisibility: ReadonlySet<string>;
}

export function useHomepageBeamVisibility({ homepageSceneBeamVisibilityInput }: UseHomepageBeamVisibilityParameters): UseHomepageBeamVisibilityResult {
  const homepageBeamVisibility = useMemo(
      () => resolveHomepageSceneBeamVisibility(homepageSceneBeamVisibilityInput),
      [homepageSceneBeamVisibilityInput],
    );
  return { homepageBeamVisibility };
}
