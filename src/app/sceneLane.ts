import type { AppExperienceMode } from './appExperienceMode';
import type { SceneSourceMode } from './appPersistence';

export type SceneLane =
  | 'sinr-live'
  | 'artifact-replay'
  // Retained downstream modules may still mention removed lanes until Wave 2.
  | (string & {});

export interface SceneLaneInput {
  readonly appMode: AppExperienceMode;
  readonly sceneSource: SceneSourceMode;
}

export function resolveSceneLane(input: SceneLaneInput): SceneLane {
  if (input.sceneSource === 'artifact-replay') return 'artifact-replay';
  void input.appMode;
  return 'sinr-live';
}

export function shouldEnableHomepageMultiCandidateAuthority(lane: SceneLane): boolean {
  return lane === 'sinr-live';
}

/**
 * Whether the legacy SINR-only HandoverManager must stop committing once a
 * link exists.
 *
 * The homepage's EE handover authority depends on this being true there: the
 * rail-timeline engine never sees an EE value, so a SINR-only handover from it
 * would fire above the EE floor and contradict the decision the homepage is
 * showing. It must stay false elsewhere, where that engine is still the
 * authority.
 *
 * This is a named function rather than an inline expression at the call site
 * because the invariant reached production as an unnamed positional argument
 * to `useSimulation`, and a repo-wide grep for it found exactly one file: no
 * test, no validator, no golden. Deleting the argument would have silently
 * handed primary handover back to the SINR engine on the homepage.
 */
export function shouldSuppressLegacyPrimaryHandover(
  lane: SceneLane,
  // Optional at the call site (MainScene's prop defaults to undefined), so the
  // undefined -> false narrowing happens here rather than relying on a default
  // parameter several layers away.
  homepageVisualIdentity: boolean | undefined,
): boolean {
  return homepageVisualIdentity === true && lane === 'sinr-live';
}
