import { useEffect, useState } from 'react';
import {
  loadScientificExplanationArtifact,
  preloadScientificExplanationArtifact,
  SCIENTIFIC_EXPLANATION_ARTIFACT_INITIAL_STATE,
  scientificExplanationArtifactRefusal,
  type ScientificExplanationArtifactRouteState,
} from './scientificExplanationArtifactLoader';

preloadScientificExplanationArtifact();

export function useScientificExplanationRun(retryKey: number): ScientificExplanationArtifactRouteState {
  const [state, setState] = useState<ScientificExplanationArtifactRouteState>(
    SCIENTIFIC_EXPLANATION_ARTIFACT_INITIAL_STATE,
  );

  useEffect(() => {
    let active = true;
    setState(SCIENTIFIC_EXPLANATION_ARTIFACT_INITIAL_STATE);
    void loadScientificExplanationArtifact().then(next => {
      if (active) setState(next);
    }).catch(error => {
      if (active) setState(scientificExplanationArtifactRefusal(error));
    });
    return () => { active = false; };
  }, [retryKey]);

  return state;
}
