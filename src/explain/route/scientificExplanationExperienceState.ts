export const SCIENTIFIC_EXPLANATION_STORAGE_NAMESPACE = 'leo-beam-sim:/explain/:';

export type ScientificExplanationLessonState =
  | { readonly stage: 'entry' }
  | { readonly stage: 'orient'; readonly recordId: 'scientific-causal-lab-v1'; readonly actionId: 'a1-orient' };

export interface ScientificExplanationPresentationState {
  readonly visibleLayer: 'source-token' | 'causal-lab';
}

export interface ScientificExplanationCaptureState {
  readonly readiness: 'not-requested';
}

export interface ScientificExplanationExperienceState {
  readonly lesson: ScientificExplanationLessonState;
  readonly presentation: ScientificExplanationPresentationState;
  readonly capture: ScientificExplanationCaptureState;
}

export type ScientificExplanationExperienceAction =
  | { readonly type: 'reveal-orientation' }
  | { readonly type: 'return-to-entry' };

export const INITIAL_SCIENTIFIC_EXPLANATION_EXPERIENCE: ScientificExplanationExperienceState = Object.freeze({
  lesson: Object.freeze({ stage: 'entry' }),
  presentation: Object.freeze({ visibleLayer: 'source-token' }),
  capture: Object.freeze({ readiness: 'not-requested' }),
});

export function scientificExplanationStorageKey(suffix: string): string {
  if (!/^[a-z0-9][a-z0-9._-]*$/u.test(suffix)) throw new Error('invalid /explain storage-key suffix');
  return `${SCIENTIFIC_EXPLANATION_STORAGE_NAMESPACE}${suffix}`;
}

export function reduceScientificExplanationExperience(
  _state: ScientificExplanationExperienceState,
  action: ScientificExplanationExperienceAction,
): ScientificExplanationExperienceState {
  if (action.type === 'return-to-entry') return INITIAL_SCIENTIFIC_EXPLANATION_EXPERIENCE;
  return Object.freeze({
    lesson: Object.freeze({
      stage: 'orient',
      recordId: 'scientific-causal-lab-v1',
      actionId: 'a1-orient',
    }),
    presentation: Object.freeze({ visibleLayer: 'causal-lab' }),
    capture: Object.freeze({ readiness: 'not-requested' }),
  });
}
